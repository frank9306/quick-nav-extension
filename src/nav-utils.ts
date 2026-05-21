import type { NavItem } from "./storage"

export const RECENT_CATEGORY_NAME = "最近访问"
export const ALL_CATEGORY_NAME = "全部"
export const RECENT_NAV_LIMIT = 10

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

export function refreshFaviconUrl(url: string): string | undefined {
  const faviconUrl = deriveFaviconUrl(url)
  if (!faviconUrl) return undefined

  return `${faviconUrl}&refresh=${Date.now()}`
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

export function assignCategoryOrder(items: NavItem[], category: string): NavItem[] {
  let order = 0

  return items.map(item => {
    if (item.category !== category) return item

    return {
      ...item,
      order: order++
    }
  })
}

export function moveNavItemWithinCategory(items: NavItem[], id: string, direction: "up" | "down"): NavItem[] {
  const currentItem = items.find(item => item.id === id)
  if (!currentItem) return items

  const categoryItems = sortNavItems(items.filter(item => item.category === currentItem.category))
  const currentIndex = categoryItems.findIndex(item => item.id === id)
  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1

  if (currentIndex === -1 || nextIndex < 0 || nextIndex >= categoryItems.length) {
    return items
  }

  const reorderedCategoryItems = [...categoryItems]
  const [movedItem] = reorderedCategoryItems.splice(currentIndex, 1)
  reorderedCategoryItems.splice(nextIndex, 0, movedItem)

  const orderById = new Map(reorderedCategoryItems.map((item, index) => [item.id, index]))
  const now = Date.now()

  return items.map(item => {
    const order = orderById.get(item.id)
    if (order === undefined) return item

    return {
      ...item,
      order,
      updatedAt: item.id === id ? now : item.updatedAt
    }
  })
}

export function filterNavItems(items: NavItem[], selectedCategory: string, searchQuery: string): NavItem[] {
  let filtered = items

  if (selectedCategory === RECENT_CATEGORY_NAME) {
    filtered = filtered
      .filter(item => Boolean(item.lastVisitedAt))
      .sort((a, b) => (b.lastVisitedAt || 0) - (a.lastVisitedAt || 0))
      .slice(0, RECENT_NAV_LIMIT)
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
