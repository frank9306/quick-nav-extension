import type { NavItem } from "./storage"

export interface FeishuSyncSettings {
  enabled: boolean
  appId: string
  appSecret: string
  appToken: string
  tableId: string
  lastSyncedAt?: number
}

export interface FeishuRecord {
  recordId: string
  fields: Record<string, unknown>
}

export interface RemoteNavRecord {
  recordId: string
  item: NavItem
}

export interface SyncResult {
  pulled: number
  pushed: number
  created: number
  updated: number
  skipped: number
  deleted: number
  errors: string[]
}

export const emptySyncResult = (): SyncResult => ({
  pulled: 0,
  pushed: 0,
  created: 0,
  updated: 0,
  skipped: 0,
  deleted: 0,
  errors: []
})
