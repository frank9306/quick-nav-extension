import type { FeishuSyncSettings } from "./sync-types"

const FEISHU_SYNC_SETTINGS_KEY = "quick-nav-feishu-sync-settings"

export const defaultFeishuSyncSettings: FeishuSyncSettings = {
  enabled: false,
  appId: "",
  appSecret: "",
  appToken: "",
  tableId: ""
}

export class SyncStorage {
  static async getFeishuSettings(): Promise<FeishuSyncSettings> {
    try {
      const result = await chrome.storage.local.get([FEISHU_SYNC_SETTINGS_KEY])
      return {
        ...defaultFeishuSyncSettings,
        ...(result[FEISHU_SYNC_SETTINGS_KEY] || {})
      }
    } catch (error) {
      console.error("获取飞书同步设置失败:", error)
      return defaultFeishuSyncSettings
    }
  }

  static async setFeishuSettings(settings: FeishuSyncSettings): Promise<void> {
    await chrome.storage.local.set({
      [FEISHU_SYNC_SETTINGS_KEY]: {
        enabled: Boolean(settings.enabled),
        appId: settings.appId.trim(),
        appSecret: settings.appSecret.trim(),
        appToken: settings.appToken.trim(),
        tableId: settings.tableId.trim(),
        lastSyncedAt: settings.lastSyncedAt
      }
    })
  }
}
