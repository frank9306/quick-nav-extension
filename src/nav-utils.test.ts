import { describe, expect, it } from "vitest"

import {
  deriveFaviconUrl,
  filterNavItems,
  isDuplicateUrl,
  normalizeNavUrl,
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
