# Phase 1 Navigation Core Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add favicon derivation, duplicate URL prevention, pinning, recent visits, keyboard search, search syntax, and copy-link actions to the existing QuickNav navigation experience.

**Architecture:** Extract pure navigation helpers into `src/nav-utils.ts` so URL normalization, favicon derivation, sorting, and filtering can be tested without Chrome APIs. Keep persistent data mutations in `src/storage.ts`; keep UI interactions in `src/newtab.tsx`, `src/popup.tsx`, and `src/options.tsx`.

**Tech Stack:** Plasmo 0.90.5, React 18, TypeScript, Chrome Storage API, Vitest for pure helper tests.

---

## File Structure

- Create: `src/nav-utils.ts`
  - Owns pure helper functions: URL normalization, duplicate comparison, favicon URL derivation, nav sorting, search filtering, and editable-element detection.
- Create: `src/nav-utils.test.ts`
  - Tests the pure helpers with Vitest.
- Modify: `package.json`
  - Add a `test` script and `vitest` dev dependency.
- Modify: `src/storage.ts`
  - Extend `NavItem`, normalize item defaults, derive favicon values, block duplicate adds, record visits, and toggle pin state.
- Modify: `src/popup.tsx`
  - Show duplicate URL errors when quick add is blocked.
- Modify: `src/options.tsx`
  - Show duplicate URL errors when management add/edit is blocked and add pin/unpin controls in the list.
- Modify: `src/newtab.tsx`
  - Use new sort/filter helpers, add recent visits filter, keyboard search, favicon display, pin/unpin controls, and copy-link feedback.
- Modify: `src/style.css`
  - Add styles for favicon, card actions, pinned state, and compact copy feedback.

## Task 1: Add Tested Navigation Utility Helpers

**Files:**
- Modify: `package.json`
- Create: `src/nav-utils.ts`
- Create: `src/nav-utils.test.ts`

- [ ] **Step 1: Add Vitest and a test script**

Modify `package.json` so `scripts` and `devDependencies` include:

```json
"scripts": {
  "dev": "plasmo dev",
  "build": "plasmo build",
  "package": "plasmo package",
  "test": "vitest run"
},
"devDependencies": {
  "@ianvs/prettier-plugin-sort-imports": "4.1.1",
  "@types/chrome": "0.0.258",
  "@types/node": "20.11.5",
  "@types/react": "18.2.48",
  "@types/react-dom": "18.2.18",
  "prettier": "3.2.4",
  "typescript": "5.3.3",
  "vitest": "latest"
}
```

Run: `pnpm install`

Expected: lockfile updates successfully and `vitest` is installed.

- [ ] **Step 2: Write failing tests for navigation helpers**

Create `src/nav-utils.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test -- src/nav-utils.test.ts`

Expected: FAIL because `src/nav-utils.ts` does not exist yet.

- [ ] **Step 4: Implement utility helpers**

Create `src/nav-utils.ts`:

```ts
import type { NavItem } from "./storage"

export const RECENT_CATEGORY_NAME = "最近访问"
export const ALL_CATEGORY_NAME = "全部"

export function normalizeNavUrl(url: string): string {
  const parsed = new URL(url)
  parsed.hostname = parsed.hostname.toLowerCase()

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1)
  }

  return parsed.toString().replace(/\/$/, "")
}

export function isDuplicateUrl(leftUrl: string, rightUrl: string): boolean {
  try {
    return normalizeNavUrl(leftUrl) === normalizeNavUrl(rightUrl)
  } catch (error) {
    return leftUrl.trim() === rightUrl.trim()
  }
}

export function deriveFaviconUrl(url: string): string | undefined {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    if (!hostname) return undefined
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`
  } catch (error) {
    return undefined
  }
}

export function getNavHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch (error) {
    return url
  }
}

export function sortNavItems(items: NavItem[]): NavItem[] {
  return [...items].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) {
      return a.pinned ? -1 : 1
    }

    const aOrder = typeof a.order === "number" ? a.order : Number.POSITIVE_INFINITY
    const bOrder = typeof b.order === "number" ? b.order : Number.POSITIVE_INFINITY
    if (aOrder !== bOrder) return aOrder - bOrder

    const clickDelta = (b.clicks || 0) - (a.clicks || 0)
    if (clickDelta !== 0) return clickDelta

    return (b.updatedAt || 0) - (a.updatedAt || 0)
  })
}

export function filterNavItems(items: NavItem[], selectedCategory: string, searchQuery: string): NavItem[] {
  let filtered = items

  if (selectedCategory === RECENT_CATEGORY_NAME) {
    filtered = filtered
      .filter(item => Boolean(item.lastVisitedAt))
      .sort((a, b) => (b.lastVisitedAt || 0) - (a.lastVisitedAt || 0))
  } else if (selectedCategory !== ALL_CATEGORY_NAME) {
    filtered = filtered.filter(item => item.category === selectedCategory)
  }

  const query = searchQuery.trim().toLowerCase()
  if (!query) return selectedCategory === RECENT_CATEGORY_NAME ? filtered : sortNavItems(filtered)

  const searched = filtered.filter(item => {
    if (query.startsWith("#")) {
      const tagQuery = query.slice(1)
      return item.tags.some(tag => tag.toLowerCase().includes(tagQuery))
    }

    if (query.startsWith("@")) {
      const categoryQuery = query.slice(1)
      return item.category.toLowerCase().includes(categoryQuery)
    }

    return item.title.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.tags.some(tag => tag.toLowerCase().includes(query)) ||
      getNavHostname(item.url).includes(query)
  })

  return selectedCategory === RECENT_CATEGORY_NAME ? searched : sortNavItems(searched)
}

export function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- src/nav-utils.test.ts`

Expected: PASS for all helper tests.

- [ ] **Step 6: Commit utility helpers**

Run:

```bash
git add package.json pnpm-lock.yaml src/nav-utils.ts src/nav-utils.test.ts
git commit -m "test: add navigation utility coverage"
```

Expected: commit succeeds with only the test runner and utility files staged.

## Task 2: Integrate Favicon, Duplicate Detection, Pinning, and Visit Tracking in Storage

**Files:**
- Modify: `src/storage.ts`
- Test: `src/nav-utils.test.ts`

- [ ] **Step 1: Add a duplicate error and extend `NavItem`**

Modify the top of `src/storage.ts` to import helpers and extend the interface:

```ts
import { deriveFaviconUrl, isDuplicateUrl } from "./nav-utils"

// 导航数据存储服务
export interface NavItem {
  id: string
  title: string
  url: string
  description: string
  category: string
  tags: string[]
  favicon?: string
  clicks?: number
  pinned?: boolean
  order?: number
  lastVisitedAt?: number
  syncId?: string
  deletedAt?: number
  createdAt: number
  updatedAt: number
}

export class DuplicateNavItemError extends Error {
  existingItem: NavItem

  constructor(existingItem: NavItem) {
    super(`导航项已存在：${existingItem.title}`)
    this.name = "DuplicateNavItemError"
    this.existingItem = existingItem
  }
}
```

- [ ] **Step 2: Normalize nav items on read and import**

Add this helper above `export class NavStorage`:

```ts
function normalizeNavItem(item: NavItem): NavItem {
  const now = Date.now()

  return {
    ...item,
    description: item.description || "",
    tags: Array.isArray(item.tags) ? item.tags : [],
    favicon: item.favicon || deriveFaviconUrl(item.url),
    clicks: item.clicks || 0,
    pinned: Boolean(item.pinned),
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now
  }
}
```

Update `getNavItems` to normalize both stored and default records:

```ts
static async getNavItems(): Promise<NavItem[]> {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY])
    const items = result[STORAGE_KEY] || defaultNavItems
    return items.map(normalizeNavItem)
  } catch (error) {
    console.error('获取导航数据失败:', error)
    return defaultNavItems.map(normalizeNavItem)
  }
}
```

Update the `importNavItems` mapper so each imported item is normalized:

```ts
const validItems = items.filter(item =>
  item.title && item.url && item.category && Array.isArray(item.tags)
).map(item => normalizeNavItem({
  ...item,
  id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
  createdAt: item.createdAt || Date.now(),
  updatedAt: Date.now()
}))
```

- [ ] **Step 3: Block duplicate adds and derive favicon**

Replace `addNavItem` with:

```ts
static async addNavItem(item: Omit<NavItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<NavItem> {
  const items = await this.getNavItems()
  const existingItem = items.find(currentItem => isDuplicateUrl(currentItem.url, item.url))
  if (existingItem) {
    throw new DuplicateNavItemError(existingItem)
  }

  const now = Date.now()
  const newItem: NavItem = normalizeNavItem({
    ...item,
    favicon: item.favicon || deriveFaviconUrl(item.url),
    clicks: item.clicks || 0,
    pinned: Boolean(item.pinned),
    id: now.toString(),
    createdAt: now,
    updatedAt: now
  })

  items.push(newItem)
  await this.setNavItems(items)
  return newItem
}
```

- [ ] **Step 4: Prevent edit from duplicating another item**

In `updateNavItem`, after `index` is found and before `updatedItem` is built, add:

```ts
if (updates.url) {
  const duplicateItem = items.find(item => item.id !== id && isDuplicateUrl(item.url, updates.url!))
  if (duplicateItem) {
    throw new DuplicateNavItemError(duplicateItem)
  }
}
```

Build `updatedItem` with favicon fallback:

```ts
const updatedItem = normalizeNavItem({
  ...items[index],
  ...updates,
  id,
  favicon: updates.favicon || items[index].favicon || deriveFaviconUrl(updates.url || items[index].url),
  updatedAt: Date.now()
})
```

- [ ] **Step 5: Record recent visits and add pin toggling**

Replace `incrementClicks` updated item body with:

```ts
const updatedItem = normalizeNavItem({
  ...items[index],
  clicks: (items[index].clicks || 0) + 1,
  lastVisitedAt: Date.now(),
  updatedAt: Date.now()
})
```

Add this method after `incrementClicks`:

```ts
static async togglePinned(id: string): Promise<NavItem | null> {
  const items = await this.getNavItems()
  const index = items.findIndex(item => item.id === id)
  if (index === -1) return null

  const updatedItem = normalizeNavItem({
    ...items[index],
    pinned: !items[index].pinned,
    updatedAt: Date.now()
  })

  items[index] = updatedItem
  await this.setNavItems(items)
  return updatedItem
}
```

- [ ] **Step 6: Run tests and build**

Run: `pnpm test -- src/nav-utils.test.ts`

Expected: PASS.

Run: `pnpm build`

Expected: build succeeds.

- [ ] **Step 7: Commit storage integration**

Run:

```bash
git add src/storage.ts
git commit -m "feat: add nav item metadata handling"
```

Expected: commit succeeds with storage changes only.

## Task 3: Add Duplicate Handling and Pin Controls to Add/Manage UI

**Files:**
- Modify: `src/popup.tsx`
- Modify: `src/options.tsx`

- [ ] **Step 1: Handle duplicate errors in popup**

Update the import in `src/popup.tsx`:

```ts
import { DuplicateNavItemError, NavStorage, getStorageUsage } from "./storage"
```

Replace the `catch` block in `handleSubmit` with:

```ts
} catch (error) {
  if (error instanceof DuplicateNavItemError) {
    setMessage(`已存在：${error.existingItem.title}`)
  } else {
    setMessage("添加失败，请重试")
    console.error("添加导航项失败:", error)
  }
} finally {
  setIsSubmitting(false)
}
```

- [ ] **Step 2: Handle duplicate errors in options form**

Update the import in `src/options.tsx`:

```ts
import { DuplicateNavItemError, NavStorage, getStorageUsage } from "./storage"
```

Add form error state near the other state declarations:

```ts
const [formError, setFormError] = useState("")
```

At the start of `handleSubmit`, after `e.preventDefault()`, add:

```ts
setFormError("")
```

Replace the `catch` block in `handleSubmit` with:

```ts
} catch (error) {
  if (error instanceof DuplicateNavItemError) {
    setFormError(`已存在相同 URL：${error.existingItem.title}`)
  } else {
    setFormError("保存失败，请重试")
    console.error("保存失败:", error)
  }
}
```

Render the error above the submit buttons inside the add/edit form:

```tsx
{formError && (
  <div style={{ marginBottom: 16, color: "#dc2626", fontSize: "14px" }}>
    {formError}
  </div>
)}
```

- [ ] **Step 3: Add pin toggle to options list**

Add this handler near `handleDelete`:

```ts
const handleTogglePinned = async (id: string) => {
  try {
    await NavStorage.togglePinned(id)
    await loadNavItems()
  } catch (error) {
    console.error("切换置顶失败:", error)
  }
}
```

Add a button before the edit button in each list row action group:

```tsx
<button
  onClick={() => handleTogglePinned(item.id)}
  style={{ padding: "4px 12px", background: item.pinned ? "#2563eb" : "#64748b", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
>
  {item.pinned ? "取消置顶" : "置顶"}
</button>
```

In the item metadata row, add a pinned marker before category:

```tsx
{item.pinned && <span>已置顶</span>}
```

- [ ] **Step 4: Run build**

Run: `pnpm build`

Expected: build succeeds.

- [ ] **Step 5: Commit UI error and pin controls**

Run:

```bash
git add src/popup.tsx src/options.tsx
git commit -m "feat: handle duplicate nav items in forms"
```

Expected: commit succeeds with popup/options changes only.

## Task 4: Add New Tab Pinning, Recent Visits, Search Syntax, Keyboard Search, Favicon, and Copy Link

**Files:**
- Modify: `src/newtab.tsx`
- Modify: `src/style.css`

- [ ] **Step 1: Update imports and refs**

In `src/newtab.tsx`, update the React import:

```ts
import { useState, useEffect, useRef } from "react"
```

Add utility imports:

```ts
import { ALL_CATEGORY_NAME, RECENT_CATEGORY_NAME, filterNavItems, getNavHostname, isEditableElement } from "./nav-utils"
```

Add refs and copy state inside `IndexNewtab`:

```ts
const searchInputRef = useRef<HTMLInputElement | null>(null)
const [copiedItemId, setCopiedItemId] = useState<string | null>(null)
```

- [ ] **Step 2: Use helper-backed categories and filtering**

Change initial selected category to:

```ts
const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY_NAME)
```

Replace the `categories` definition with:

```ts
const recentCount = navItems.filter(item => item.lastVisitedAt).length
const categories: Category[] = [
  { name: ALL_CATEGORY_NAME, count: navItems.length },
  { name: RECENT_CATEGORY_NAME, count: recentCount },
  ...Object.entries(
    navItems.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  ).map(([name, count]) => ({ name, count }))
]
```

Replace the search/filter `useEffect` body with:

```ts
useEffect(() => {
  setFilteredItems(filterNavItems(navItems, selectedCategory, searchQuery))
}, [searchQuery, selectedCategory, navItems])
```

- [ ] **Step 3: Add keyboard search behavior**

Add this effect after the existing mount effect:

```ts
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (isEditableElement(event.target)) {
      if (event.key === "Escape" && event.target === searchInputRef.current) {
        setSearchQuery("")
        searchInputRef.current?.blur()
      }
      return
    }

    if (event.key === "/" || (event.key.toLowerCase() === "k" && event.ctrlKey)) {
      event.preventDefault()
      searchInputRef.current?.focus()
      return
    }

    if (event.key === "Escape") {
      setSearchQuery("")
      searchInputRef.current?.blur()
    }
  }

  window.addEventListener("keydown", handleKeyDown)
  return () => window.removeEventListener("keydown", handleKeyDown)
}, [])
```

Add the ref to the search input:

```tsx
ref={searchInputRef}
```

- [ ] **Step 4: Add pin and copy handlers**

Add these handlers near `handleItemClick`:

```ts
const handleTogglePinned = async (id: string) => {
  try {
    const updatedItem = await NavStorage.togglePinned(id)
    if (!updatedItem) return

    setNavItems(items => items.map(item => item.id === id ? updatedItem : item))
  } catch (error) {
    console.error("切换置顶失败:", error)
  }
}

const handleCopyUrl = async (item: NavItem) => {
  try {
    await navigator.clipboard.writeText(item.url)
    setCopiedItemId(item.id)
    window.setTimeout(() => {
      setCopiedItemId(currentId => currentId === item.id ? null : currentId)
    }, 1200)
  } catch (error) {
    console.error("复制链接失败:", error)
  }
}
```

- [ ] **Step 5: Render favicon and card actions**

Replace the card header block with:

```tsx
<div className="card-header">
  {item.favicon && <img src={item.favicon} alt="" className="card-favicon" />}
  <h3 className="card-title">
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => handleItemClick(item)}
      onAuxClick={(event) => {
        if (event.button === 1) handleItemClick(item)
      }}
    >
      {item.title}
    </a>
  </h3>
  <div className="card-actions">
    <button
      type="button"
      className={`card-action-btn ${item.pinned ? "active" : ""}`}
      onClick={() => handleTogglePinned(item.id)}
      title={item.pinned ? "取消置顶" : "置顶"}
    >
      {item.pinned ? "已置顶" : "置顶"}
    </button>
    <button
      type="button"
      className="card-action-btn"
      onClick={() => handleCopyUrl(item)}
      title="复制链接"
    >
      {copiedItemId === item.id ? "已复制" : "复制"}
    </button>
  </div>
</div>
```

Replace the footer hostname expression with:

```tsx
<span className="card-url">{getNavHostname(item.url)}</span>
```

Add pinned styling to the card wrapper:

```tsx
<div key={item.id} className={`nav-card ${item.pinned ? "pinned" : ""}`}>
```

- [ ] **Step 6: Add card action styles**

Append to `src/style.css` near the card styles:

```css
.nav-card.pinned {
  border-color: rgba(37, 99, 235, 0.35);
  box-shadow: 0 10px 36px rgba(37, 99, 235, 0.18);
}

.card-header {
  display: grid;
  grid-template-columns: 32px 1fr auto;
  gap: 10px;
  align-items: center;
}

.card-favicon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(255,255,255,0.8);
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
}

.card-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.card-action-btn {
  padding: 5px 8px !important;
  border: none;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.card-action-btn.active {
  background: rgba(37, 99, 235, 0.9) !important;
}
```

- [ ] **Step 7: Run tests and build**

Run: `pnpm test -- src/nav-utils.test.ts`

Expected: PASS.

Run: `pnpm build`

Expected: build succeeds.

- [ ] **Step 8: Commit new-tab enhancements**

Run:

```bash
git add src/newtab.tsx src/style.css
git commit -m "feat: enhance new tab navigation actions"
```

Expected: commit succeeds with new-tab and style changes only.

## Task 5: Manual Verification and Final Cleanup

**Files:**
- Verify only unless build or manual testing exposes a defect.

- [ ] **Step 1: Run full verification**

Run: `pnpm test`

Expected: all Vitest tests pass.

Run: `pnpm build`

Expected: Plasmo production build succeeds.

- [ ] **Step 2: Manually verify add flows**

Load `build/chrome-mv3-prod` or run `pnpm dev` and load the dev build.

Verify:

- Add a new URL from popup and confirm a favicon appears on the new tab card.
- Add the same URL again and confirm the popup shows `已存在：<title>`.
- Add a new URL from options and confirm it works.
- Edit an item to use another existing URL and confirm options shows `已存在相同 URL：<title>`.

- [ ] **Step 3: Manually verify new-tab interactions**

Verify:

- Click a nav card and confirm its click count increments.
- Return to new tab and confirm `最近访问` contains the clicked item.
- Pin an item and confirm it appears before non-pinned items.
- Unpin it and confirm it returns to normal sorting.
- Press `/` and confirm the search input focuses.
- Press `Ctrl+K` and confirm the search input focuses.
- Press `Escape` and confirm search clears and input blurs.
- Search `#AI`, `@开发`, and `github.com` and confirm results match the syntax.
- Click copy and paste into a text field to confirm the URL was copied.

- [ ] **Step 4: Check git status and commit any fixes**

Run: `git status --short`

Expected: no uncommitted changes if no fixes were needed.

If fixes were needed, run:

```bash
git add <fixed-files>
git commit -m "fix: polish phase 1 navigation enhancements"
```

Expected: fix commit succeeds with only relevant files staged.

## Self-Review

Spec coverage:

- Favicon auto fetch is covered by Tasks 1 and 2.
- Duplicate URL detection is covered by Tasks 1, 2, and 3.
- Pinning is covered by Tasks 2, 3, and 4.
- Recent visits are covered by Tasks 1, 2, and 4.
- Keyboard search is covered by Task 4.
- Search syntax is covered by Tasks 1 and 4.
- Copy link is covered by Task 4.

Completion scan:

- This plan contains no unresolved markers or undefined future-work markers.
- Each code-changing task includes concrete code snippets and verification commands.

Type consistency:

- `NavItem.pinned`, `NavItem.order`, `NavItem.lastVisitedAt`, `DuplicateNavItemError`, `NavStorage.togglePinned`, `filterNavItems`, and `sortNavItems` use the same names across tasks.
