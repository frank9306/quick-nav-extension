import { FeishuSyncClient } from "./feishu-sync"
import { NavStorage } from "./storage"
import type { NavItem } from "./storage"
import { SyncStorage } from "./sync-storage"
import type { FeishuSyncSettings, SyncResult } from "./sync-types"
import { emptySyncResult } from "./sync-types"
import {
  ensureNavSyncIds,
  feishuRecordsToRemoteNavRecords,
  mergeLocalAndRemoteNavItems,
  navItemToFeishuFields
} from "./sync-utils"

function getRemoteRecordBySyncId(records: ReturnType<typeof feishuRecordsToRemoteNavRecords>): Map<string, string> {
  return new Map(records.map(record => [record.item.syncId || record.recordId, record.recordId]))
}

function shouldPushLocal(localItem: NavItem, remoteItem?: NavItem): boolean {
  if (!remoteItem) return true

  const localTimestamp = Math.max(localItem.updatedAt || 0, localItem.deletedAt || 0)
  const remoteTimestamp = Math.max(remoteItem.updatedAt || 0, remoteItem.deletedAt || 0)
  return localTimestamp > remoteTimestamp
}

export async function testFeishuConnection(settings: FeishuSyncSettings): Promise<number> {
  const client = new FeishuSyncClient(settings)
  return await client.testConnection()
}

export async function initializeFeishuFields(settings: FeishuSyncSettings): Promise<string[]> {
  const client = new FeishuSyncClient(settings)
  return await client.ensureRequiredFields()
}

export async function pullFromFeishu(settings: FeishuSyncSettings): Promise<SyncResult> {
  const client = new FeishuSyncClient(settings)
  const remoteRecords = feishuRecordsToRemoteNavRecords(await client.listRecords())
  const localItems = await NavStorage.getRawNavItems()
  const { items, result } = mergeLocalAndRemoteNavItems(localItems, remoteRecords)

  await NavStorage.setNavItems(items)
  await SyncStorage.setFeishuSettings({
    ...settings,
    lastSyncedAt: Date.now()
  })

  return result
}

export async function pushToFeishu(settings: FeishuSyncSettings): Promise<SyncResult> {
  const result = emptySyncResult()
  const client = new FeishuSyncClient(settings)
  await client.ensureRequiredFields()
  const { items: localItems, changed } = ensureNavSyncIds(await NavStorage.getRawNavItems())
  if (changed) await NavStorage.setNavItems(localItems)

  const remoteRecords = feishuRecordsToRemoteNavRecords(await client.listRecords())
  const recordIdBySyncId = getRemoteRecordBySyncId(remoteRecords)
  const remoteItemBySyncId = new Map(remoteRecords.map(record => [record.item.syncId || record.recordId, record.item]))

  for (const item of localItems) {
    const syncId = item.syncId
    if (!syncId) continue

    const recordId = recordIdBySyncId.get(syncId)
    const remoteItem = remoteItemBySyncId.get(syncId)
    if (!shouldPushLocal(item, remoteItem)) {
      result.skipped++
      continue
    }

    try {
      if (recordId) {
        await client.updateRecord(recordId, navItemToFeishuFields(item))
        result.updated++
      } else {
        await client.createRecord(navItemToFeishuFields(item))
        result.created++
      }
      result.pushed++
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      result.errors.push(`${item.title || item.url}：${message}`)
    }
  }

  await SyncStorage.setFeishuSettings({
    ...settings,
    lastSyncedAt: Date.now()
  })

  return result
}

export async function syncWithFeishu(settings: FeishuSyncSettings): Promise<SyncResult> {
  const client = new FeishuSyncClient(settings)
  await client.ensureRequiredFields()
  const { items: localItems, changed } = ensureNavSyncIds(await NavStorage.getRawNavItems())
  if (changed) await NavStorage.setNavItems(localItems)

  const remoteRecords = feishuRecordsToRemoteNavRecords(await client.listRecords())
  const { items: mergedItems, result } = mergeLocalAndRemoteNavItems(localItems, remoteRecords)
  await NavStorage.setNavItems(mergedItems)

  const pushResult = await pushToFeishu(settings)
  await SyncStorage.setFeishuSettings({
    ...settings,
    lastSyncedAt: Date.now()
  })

  return {
    pulled: result.pulled,
    pushed: pushResult.pushed,
    created: pushResult.created,
    updated: result.updated + pushResult.updated,
    skipped: result.skipped + pushResult.skipped,
    deleted: result.deleted,
    errors: [...result.errors, ...pushResult.errors]
  }
}
