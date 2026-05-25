import { isDuplicateUrl } from "./nav-utils"
import type { NavItem } from "./storage"
import type { FeishuRecord, RemoteNavRecord, SyncResult } from "./sync-types"
import { emptySyncResult } from "./sync-types"

function asString(value: unknown): string {
  if (typeof value === "string") return value
  if (Array.isArray(value)) {
    return value.map(item => typeof item === "object" && item && "text" in item ? String(item.text) : String(item)).join("")
  }
  if (value && typeof value === "object" && "text" in value) return String(value.text)
  return value == null ? "" : String(value)
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return undefined
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1"
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(tag => String(tag).trim()).filter(Boolean)

  const text = asString(value).trim()
  if (!text) return []

  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed.map(tag => String(tag).trim()).filter(Boolean)
  } catch (error) {
    // Fall through to comma-separated parsing.
  }

  return text.split(",").map(tag => tag.trim()).filter(Boolean)
}

export function createSyncId(): string {
  return `nav_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function ensureNavSyncIds(items: NavItem[]): { items: NavItem[], changed: boolean } {
  let changed = false
  const nextItems = items.map(item => {
    if (item.syncId) return item

    changed = true
    return {
      ...item,
      syncId: createSyncId(),
      updatedAt: item.updatedAt || Date.now()
    }
  })

  return { items: nextItems, changed }
}

export function navItemToFeishuFields(item: NavItem): Record<string, unknown> {
  const itemWithSyncId = item.syncId ? item : { ...item, syncId: createSyncId() }

  const fields: Record<string, unknown> = {
    syncId: itemWithSyncId.syncId,
    title: item.title,
    url: item.url,
    description: item.description || "",
    category: item.category,
    tags: JSON.stringify(item.tags || []),
    favicon: item.favicon || "",
    clicks: item.clicks || 0,
    pinned: Boolean(item.pinned),
    order: typeof item.order === "number" ? item.order : undefined,
    lastVisitedAt: item.lastVisitedAt || undefined,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deletedAt: item.deletedAt || undefined,
    payload: JSON.stringify(itemWithSyncId)
  }

  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== null))
}

export function feishuFieldsToNavItem(fields: Record<string, unknown>, fallbackId: string): NavItem | null {
  const payload = asString(fields.payload)
  if (payload) {
    try {
      const parsed = JSON.parse(payload) as NavItem
      if (parsed.title && parsed.url && parsed.category && Array.isArray(parsed.tags)) {
        return {
          ...parsed,
          syncId: parsed.syncId || asString(fields.syncId) || fallbackId,
          updatedAt: parsed.updatedAt || asNumber(fields.updatedAt) || Date.now(),
          createdAt: parsed.createdAt || asNumber(fields.createdAt) || Date.now()
        }
      }
    } catch (error) {
      // Fall back to expanded fields.
    }
  }

  const title = asString(fields.title)
  const url = asString(fields.url)
  const category = asString(fields.category)
  if (!title || !url || !category) return null

  return {
    id: fallbackId,
    syncId: asString(fields.syncId) || fallbackId,
    title,
    url,
    description: asString(fields.description),
    category,
    tags: parseTags(fields.tags),
    favicon: asString(fields.favicon) || undefined,
    clicks: asNumber(fields.clicks) || 0,
    pinned: asBoolean(fields.pinned),
    order: asNumber(fields.order),
    lastVisitedAt: asNumber(fields.lastVisitedAt),
    deletedAt: asNumber(fields.deletedAt),
    createdAt: asNumber(fields.createdAt) || Date.now(),
    updatedAt: asNumber(fields.updatedAt) || Date.now()
  }
}

export function feishuRecordsToRemoteNavRecords(records: FeishuRecord[]): RemoteNavRecord[] {
  return records.map(record => {
    const item = feishuFieldsToNavItem(record.fields, record.recordId)
    return item ? { recordId: record.recordId, item } : null
  }).filter((record): record is RemoteNavRecord => Boolean(record))
}

function shouldUseRemote(localItem: NavItem | undefined, remoteItem: NavItem): boolean {
  if (!localItem) return true

  const localDeletedAt = localItem.deletedAt || 0
  const remoteDeletedAt = remoteItem.deletedAt || 0
  const localTimestamp = Math.max(localItem.updatedAt || 0, localDeletedAt)
  const remoteTimestamp = Math.max(remoteItem.updatedAt || 0, remoteDeletedAt)
  return remoteTimestamp > localTimestamp
}

export function mergeLocalAndRemoteNavItems(localItems: NavItem[], remoteRecords: RemoteNavRecord[]): { items: NavItem[], result: SyncResult } {
  const result = emptySyncResult()
  const localWithSyncIds = ensureNavSyncIds(localItems).items
  const mergedBySyncId = new Map<string, NavItem>()

  localWithSyncIds.forEach(item => {
    if (item.syncId) mergedBySyncId.set(item.syncId, item)
  })

  remoteRecords.forEach(record => {
    const remoteItem = record.item
    const syncId = remoteItem.syncId || record.recordId
    const localItem = mergedBySyncId.get(syncId)

    if (shouldUseRemote(localItem, remoteItem)) {
      mergedBySyncId.set(syncId, {
        ...remoteItem,
        id: localItem?.id || remoteItem.id || syncId,
        syncId
      })
      localItem ? result.updated++ : result.pulled++
    } else {
      result.skipped++
    }
  })

  const mergedItems = Array.from(mergedBySyncId.values())
  const dedupedItems: NavItem[] = []

  mergedItems.forEach(item => {
    const existingItem = dedupedItems.find(currentItem => isDuplicateUrl(currentItem.url, item.url))
    if (!existingItem) {
      dedupedItems.push(item)
      return
    }

    if (Math.max(item.updatedAt || 0, item.deletedAt || 0) > Math.max(existingItem.updatedAt || 0, existingItem.deletedAt || 0)) {
      const index = dedupedItems.findIndex(currentItem => currentItem === existingItem)
      dedupedItems[index] = item
    }
  })

  result.deleted = dedupedItems.filter(item => item.deletedAt).length
  return { items: dedupedItems, result }
}

export function getVisibleSyncedItems(items: NavItem[]): NavItem[] {
  return items.filter(item => !item.deletedAt)
}
