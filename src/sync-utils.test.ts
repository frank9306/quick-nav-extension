import { describe, expect, it } from "vitest"

import type { NavItem } from "./storage"
import {
  ensureNavSyncIds,
  feishuFieldsToNavItem,
  mergeLocalAndRemoteNavItems,
  navItemToFeishuFields
} from "./sync-utils"

const baseItem: NavItem = {
  id: "local-1",
  syncId: "sync-1",
  title: "GitHub",
  url: "https://github.com/",
  description: "Code hosting",
  category: "开发",
  tags: ["代码"],
  clicks: 1,
  pinned: false,
  createdAt: 100,
  updatedAt: 100
}

describe("ensureNavSyncIds", () => {
  it("adds missing sync ids", () => {
    const { items, changed } = ensureNavSyncIds([{ ...baseItem, syncId: undefined }])

    expect(changed).toBe(true)
    expect(items[0].syncId).toMatch(/^nav_/) 
  })
})

describe("feishu field mapping", () => {
  it("round-trips nav items through fields", () => {
    const fields = navItemToFeishuFields(baseItem)
    const item = feishuFieldsToNavItem(fields, "fallback")

    expect(item?.syncId).toBe(baseItem.syncId)
    expect(item?.title).toBe(baseItem.title)
    expect(item?.tags).toEqual(baseItem.tags)
  })

  it("reads expanded fields when payload is absent", () => {
    const item = feishuFieldsToNavItem({
      syncId: "remote-1",
      title: "OpenAI",
      url: "https://openai.com/",
      category: "AI",
      tags: '["AI"]',
      pinned: true,
      createdAt: 100,
      updatedAt: 200
    }, "record-1")

    expect(item?.syncId).toBe("remote-1")
    expect(item?.tags).toEqual(["AI"])
    expect(item?.pinned).toBe(true)
  })
})

describe("mergeLocalAndRemoteNavItems", () => {
  it("uses newer remote item", () => {
    const { items } = mergeLocalAndRemoteNavItems([baseItem], [{
      recordId: "record-1",
      item: { ...baseItem, title: "GitHub Remote", updatedAt: 200 }
    }])

    expect(items[0].title).toBe("GitHub Remote")
  })

  it("keeps newer local item", () => {
    const { items } = mergeLocalAndRemoteNavItems([{ ...baseItem, updatedAt: 300 }], [{
      recordId: "record-1",
      item: { ...baseItem, title: "GitHub Remote", updatedAt: 200 }
    }])

    expect(items[0].title).toBe("GitHub")
  })

  it("pulls remote-only item", () => {
    const { items } = mergeLocalAndRemoteNavItems([], [{ recordId: "record-1", item: baseItem }])

    expect(items).toHaveLength(1)
    expect(items[0].title).toBe("GitHub")
  })
})
