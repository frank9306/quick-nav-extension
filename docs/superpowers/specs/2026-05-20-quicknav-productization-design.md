# QuickNav Productization Design

## Goal

Turn QuickNav from a personal new-tab navigation page into a more complete personal launcher and data management tool. The work is split into phases so each phase can ship independently, be verified clearly, and avoid coupling local UX improvements to the higher-risk Feishu sync work.

## Current Context

QuickNav is a Plasmo + React + TypeScript browser extension. It currently provides:

- A new-tab navigation grid with category filtering, text search, click counting, and background image rotation.
- A popup and context menu flow for adding the current page or a link.
- An options page for adding, editing, deleting, importing, exporting, resetting, and bulk deleting nav items.
- A daily memo feature stored in IndexedDB, with collapse state stored in `chrome.storage.local`.

The main implementation files are:

- `src/newtab.tsx` for the launch page and daily memo UI.
- `src/options.tsx` for navigation management, background settings, import/export, and bulk delete.
- `src/popup.tsx` for quick add.
- `src/storage.ts` for nav items, background settings, and memo UI settings.
- `src/memo-storage.ts` for daily memo data.

## Architecture Principles

Use small, incremental changes that keep existing local data readable. Avoid a large storage migration upfront. Add optional fields to existing records and normalize defaults at read time.

Keep the extension useful offline. Feishu sync is an optional transport layer, not the source of truth. Local storage remains the primary working store.

Separate responsibilities:

- `storage.ts` owns local navigation data, settings, recovery points, and simple data mutations.
- `memo-storage.ts` owns IndexedDB memo data and recurring memo rules.
- `feishu-sync.ts` owns Feishu API calls and field mapping.
- `sync-service.ts` owns local-vs-remote merge behavior and sync orchestration.
- React entry files own UI state and user interactions.

## Data Model

Extend `NavItem` with optional fields:

```ts
interface NavItem {
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
```

Existing records remain valid. Missing `clicks` is treated as `0`, missing `pinned` as `false`, missing `order` as sorted after explicit orders, and missing `lastVisitedAt` as not recently visited.

Add settings records in `chrome.storage.local` for:

- View mode: grid or grouped.
- Theme settings: mode, background enabled, scrim strength, card opacity, density.
- Sync settings: Feishu credentials, table identifiers, auto-sync enabled, auto-sync interval, last sync status.
- Recovery points: latest five local backups before destructive imports, resets, or sync pulls.

Add optional visit log records for statistics in a bounded store. Keep the most recent 1000 visits to avoid unbounded storage growth.

## Phase 1: Navigation Core Enhancements

Phase 1 improves daily launch speed and recognition without adding complex management UI or remote sync.

### Favicon Auto Fetch

When adding or editing a nav item, derive a favicon if one is not supplied. Use:

```text
https://www.google.com/s2/favicons?domain=<hostname>&sz=64
```

This avoids extra host permissions and avoids fetching arbitrary page HTML.

### Duplicate URL Detection

Normalize URLs before add checks:

- Lowercase hostname.
- Remove trailing slash from pathname when it is the only difference.
- Preserve path and query.

If a matching URL already exists, block the add and show a clear message in popup/options. Editing an existing item may keep its own URL.

### Pinning

Add `pinned?: boolean`. New-tab sort order becomes:

1. Pinned items first.
2. Explicit `order` values.
3. Higher `clicks`.
4. Newer `updatedAt`.

The new tab card and options list both provide pin/unpin controls.

### Recent Visits

When a nav item is opened, update both `clicks` and `lastVisitedAt`. Add a `最近访问` filter in the category strip. It shows items with `lastVisitedAt`, sorted descending.

### Keyboard Search

On the new tab page:

- `/` focuses the search input.
- `Ctrl+K` focuses the search input in Phase 1 and later opens the command palette in Phase 3.
- `Escape` clears search and blurs the input.

Keyboard handlers should not hijack typing inside inputs, textareas, or editable elements.

### Search Syntax

Support these query modes:

- `#tag` searches tags only.
- `@category` searches category only.
- Plain text searches title, description, tags, and hostname.

### Copy Link

Each nav card gets a copy URL action using `navigator.clipboard.writeText(item.url)`. Show a short success state on the clicked card.

## Phase 2: Management Enhancements

Phase 2 turns the options page into a practical data organization tool for larger nav collections.

### Drag Sorting

Use native HTML drag/drop to reorder the global nav list. Persist `order` values after drop. Initial implementation is global ordering, not per-category ordering, because global ordering composes cleanly with pinned sorting.

### Category Management

Add a category management section showing category names and item counts. Support:

- Rename category by updating all matching items.
- Merge category into another category.
- Delete empty category only. Non-empty categories must be merged or renamed because categories are derived from nav items.

### Tag Management

Add a tag management section showing tag names and item counts. Support:

- Rename tag across all items.
- Merge one tag into another.
- Delete tag from all items.

### Batch Editing

Extend existing multi-select support with:

- Batch set category.
- Batch add tags.
- Batch remove tags.
- Batch pin.
- Batch unpin.

### Recovery Points

Before import, reset, sync pull, or two-way sync, save a recovery point. Keep the latest five. A recovery point contains nav items, background settings, memo days, and metadata including timestamp and reason.

The options page lists recovery points and can restore one after confirmation.

### README Cleanup

Rewrite the current duplicated README into a concise document covering project purpose, features, commands, data structure, usage, and roadmap.

## Phase 3: Launcher, Personalization, Memo, and Feishu Sync

Phase 3 upgrades QuickNav into a full personal launcher and sync-enabled tool. It should be split into sub-phases.

### Phase 3A: Command Palette and Grouped View

`Ctrl+K` opens a command palette. It can:

- Open nav items.
- Add the current website.
- Switch category.
- Open the options page.
- Switch theme.
- Collapse or expand the memo.
- Trigger sync actions when Feishu sync is configured.

Grouped view adds a second new-tab display mode where items are grouped by category. Each group uses the same sort rules as the normal grid. Persist the selected view mode.

### Phase 3B: Stats and Theme Customization

Add a statistics panel showing:

- Total clicks.
- Most visited websites.
- Most visited categories.
- Recent activity.

If visit logs are added, also show 7-day and 30-day trends. Keep visit logs bounded to the latest 1000 records.

Add theme settings:

- Light, dark, or system mode.
- Background rotation on/off.
- Background scrim strength.
- Card opacity.
- Compact or comfortable density.

Apply theme through CSS classes and CSS variables so new-tab styling stays centralized.

### Phase 3C: Memo Enhancements

Extend the daily memo with:

- Drag sorting tasks within a day.
- Copy tasks to another date.
- Recurring rules: daily, weekdays, weekly.
- Completion history.

Use a separate IndexedDB object store for recurring rules, such as `memo-recurring-rules`, so existing daily memo records remain simple.

### Phase 3D: Feishu Bitable Hybrid Sync

Feishu sync is optional and configured from the options page.

Sync modes:

- Manual by default.
- Optional automatic sync.

Manual actions:

- Upload local data to Feishu.
- Pull Feishu data to local.
- Two-way sync.

Credentials and identifiers:

- `app_id`
- `app_secret`
- `app_token`
- `table_id`

The extension exchanges `app_id + app_secret` for a `tenant_access_token`. Cache the token only until expiry. Store credentials in local extension storage and show a warning that this is suitable for personal use, not for public distribution.

Suggested Feishu Bitable fields:

- `sync_id`: text
- `title`: text
- `url`: URL or text
- `description`: text
- `category`: text
- `tags`: text, comma-separated or JSON string
- `favicon`: text
- `pinned`: checkbox
- `order`: number
- `clicks`: number
- `last_visited_at`: number or date
- `created_at`: number or date
- `updated_at`: number or date
- `deleted_at`: number or date, optional

Conflict rules for the first version:

- Local-only item uploads to Feishu.
- Feishu-only item pulls to local.
- Item present on both sides uses `updatedAt` last-write-wins.
- `deletedAt` is a soft-delete marker, preventing deleted records from being resurrected by the other side.
- Create a local recovery point before pull or two-way sync.

Automatic sync:

- On new-tab load, if auto sync is enabled and the last sync is older than the configured interval, run sync in the background.
- After local add, edit, delete, pin, or reorder, debounce push work by 3 to 5 seconds.
- Sync failures update status in settings and do not block local use.

## Error Handling

Local actions should succeed even if optional features fail. Favicon derivation never blocks add/edit. Clipboard failures show a small error state. Feishu errors are captured in sync status and surfaced in the options page.

Destructive operations require confirmation. Import, reset, pull, and two-way sync create recovery points first.

## Testing Strategy

Each phase must pass `pnpm build`.

Manual verification for Phase 1:

- Add a URL and verify favicon is shown.
- Attempt to add a duplicate URL and verify it is blocked.
- Pin and unpin items from new tab and options.
- Open nav items and verify clicks and recent visits update.
- Verify `/`, `Ctrl+K`, and `Escape` search behavior.
- Verify `#tag`, `@category`, and plain text search.
- Copy a card URL and verify clipboard output.

Manual verification for Phase 2:

- Reorder items and reload new tab to verify order persists.
- Rename, merge, and delete categories according to rules.
- Rename, merge, and delete tags according to rules.
- Batch edit selected items.
- Import/reset and restore from a recovery point.
- Read README and verify it matches current behavior.

Manual verification for Phase 3:

- Execute each command palette action.
- Switch between grid and grouped view and reload.
- Verify stats update after visits.
- Change theme settings and reload.
- Sort, copy, and generate recurring memo tasks.
- Configure Feishu credentials against a test Bitable and verify upload, pull, two-way sync, conflict resolution, soft delete, recovery point creation, and sync failure status.

## Rollout Plan

Implement as separate plans and commits per phase or sub-phase:

1. Phase 1 navigation core enhancements.
2. Phase 2 management enhancements.
3. Phase 3A command palette and grouped view.
4. Phase 3B stats and theme customization.
5. Phase 3C memo enhancements.
6. Phase 3D Feishu Bitable sync.

Do not implement Feishu sync before the local data model changes from Phases 1 and 2 are stable.
