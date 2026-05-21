import { describe, expect, it } from "vitest"

import {
  deriveFaviconUrl,
  filterNavItems,
  isDuplicateUrl,
  moveNavItemWithinCategory,
  normalizeNavUrl,
  RECENT_NAV_LIMIT,
  sortNavItems
} from "./nav-utils"
import type { NavItem } from "./storage"

const baseItem: NavItem = {
  id: "base",
  title: "Base",
  url: "https://example.com/",
  description: "Base description",
  category: "工具",
  tags: ["base"],
  createdAt: 100,
  updatedAt: 100
}

describe("normalizeNavUrl", () => {
  it("lowercases host and removes a trailing slash", () => {
    expect(normalizeNavUrl("HTTPS://Example.COM/path/")).toBe("https://example.com/path")
  })

  it("preserves query strings", () => {
    expect(normalizeNavUrl("https://example.com/path/?q=QuickNav")).toBe("https://example.com/path?q=QuickNav")
  })
})

describe("isDuplicateUrl", () => {
  it("matches equivalent normalized URLs", () => {
    expect(isDuplicateUrl("https://EXAMPLE.com/", "https://example.com")).toBe(true)
  })

  it("does not match different query strings", () => {
    expect(isDuplicateUrl("https://example.com?a=1", "https://example.com?a=2")).toBe(false)
  })
})

describe("deriveFaviconUrl", () => {
  it("builds a Google favicon URL from the hostname", () => {
    expect(deriveFaviconUrl("https://github.com/features")).toBe("https://www.google.com/s2/favicons?domain=github.com&sz=64")
  })

  it("returns undefined for invalid URLs", () => {
    expect(deriveFaviconUrl("not a url")).toBeUndefined()
  })
})

describe("sortNavItems", () => {
  it("sorts pinned items before ordered and clicked items", () => {
    const sorted = sortNavItems([
      { ...baseItem, id: "clicks", title: "Clicks", clicks: 99, updatedAt: 300 },
      { ...baseItem, id: "pinned", title: "Pinned", pinned: true, updatedAt: 100 },
      { ...baseItem, id: "ordered", title: "Ordered", order: 1, updatedAt: 200 }
    ])

    expect(sorted.map(item => item.id)).toEqual(["pinned", "ordered", "clicks"])
  })
})

describe("moveNavItemWithinCategory", () => {
  it("moves an item within its own category only", () => {
    const items: NavItem[] = [
      { ...baseItem, id: "tools-1", category: "工具", order: 0 },
      { ...baseItem, id: "tools-2", category: "工具", order: 1 },
      { ...baseItem, id: "dev-1", category: "开发", order: 0 }
    ]

    const moved = moveNavItemWithinCategory(items, "tools-2", "up")
    const sortedTools = sortNavItems(moved.filter(item => item.category === "工具"))
    const sortedDev = sortNavItems(moved.filter(item => item.category === "开发"))

    expect(sortedTools.map(item => item.id)).toEqual(["tools-2", "tools-1"])
    expect(sortedDev.map(item => item.id)).toEqual(["dev-1"])
  })

  it("does nothing when moving beyond category bounds", () => {
    const items: NavItem[] = [
      { ...baseItem, id: "tools-1", category: "工具", order: 0 },
      { ...baseItem, id: "tools-2", category: "工具", order: 1 }
    ]

    expect(moveNavItemWithinCategory(items, "tools-1", "up")).toEqual(items)
  })
})

describe("filterNavItems", () => {
  const items: NavItem[] = [
    {
      ...baseItem,
      id: "github",
      title: "GitHub",
      url: "https://github.com/",
      description: "Code hosting",
      category: "开发",
      tags: ["代码", "Git"]
    },
    {
      ...baseItem,
      id: "openai",
      title: "ChatGPT",
      url: "https://chat.openai.com/",
      description: "AI assistant",
      category: "AI平台",
      tags: ["AI", "ChatGPT"],
      lastVisitedAt: 200
    }
  ]

  it("filters by selected category", () => {
    expect(filterNavItems(items, "开发", "").map(item => item.id)).toEqual(["github"])
  })

  it("filters recent visits", () => {
    expect(filterNavItems(items, "最近访问", "").map(item => item.id)).toEqual(["openai"])
  })

  it("limits recent visits", () => {
    const recentItems = Array.from({ length: RECENT_NAV_LIMIT + 3 }, (_, index) => ({
      ...baseItem,
      id: `recent-${index}`,
      title: `Recent ${index}`,
      lastVisitedAt: index + 1
    }))

    expect(filterNavItems(recentItems, "最近访问", "")).toHaveLength(RECENT_NAV_LIMIT)
    expect(filterNavItems(recentItems, "最近访问", "")[0].id).toBe(`recent-${RECENT_NAV_LIMIT + 2}`)
  })

  it("supports tag search", () => {
    expect(filterNavItems(items, "全部", "#ai").map(item => item.id)).toEqual(["openai"])
  })

  it("supports category search", () => {
    expect(filterNavItems(items, "全部", "@开发").map(item => item.id)).toEqual(["github"])
  })

  it("supports plain hostname search", () => {
    expect(filterNavItems(items, "全部", "github.com").map(item => item.id)).toEqual(["github"])
  })
})
