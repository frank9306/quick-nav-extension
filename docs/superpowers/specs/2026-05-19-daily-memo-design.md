# Daily Memo Design

## Goal

Add a lightweight daily memo task list to the QuickNav new tab page. The memo helps the user record what they need to do on a selected date without leaving the homepage.

## Product Requirements

- Show the memo on the new tab homepage, positioned at the upper-left on desktop.
- Default to today's local date.
- Allow switching to previous and next dates.
- Allow selecting any date with a native date picker.
- Store each date's tasks independently.
- A task has only text and completion state.
- Completed tasks remain visible, with subdued completed styling.
- Empty task text is ignored.
- Imported memo data overwrites local memo data for matching dates.

## Visual Design

The memo card follows the existing translucent glass style.

Desktop layout:

- Fixed upper-left card, about 300px wide.
- It should not cover the centered hero/search area.
- Card contains date controls, progress summary, task list, and add-task input.

Mobile layout:

- The memo is not fixed.
- It appears as a normal full-width card near the top of the page.
- It must not block search or navigation cards.

## Data Model

Memo data uses IndexedDB, not `chrome.storage.local`.

```ts
interface MemoTask {
  id: string
  text: string
  completed: boolean
  createdAt: number
  updatedAt: number
}

interface MemoDayRecord {
  date: string
  tasks: MemoTask[]
  updatedAt: number
}
```

Date keys use local ISO date format: `YYYY-MM-DD`.

IndexedDB structure:

```text
Database: quick-nav-db
Object store: memo-days
Key path: date
```

## Storage Boundaries

- `chrome.storage.local` continues to store navigation items and background settings.
- IndexedDB stores daily memo data only.
- IndexedDB logic should live in a separate `src/memo-storage.ts` module.
- `src/storage.ts` should not take on memo-specific IndexedDB responsibilities.

## Memo Storage API

Implement a `MemoStorage` service with these operations:

```ts
class MemoStorage {
  static getTasks(date: string): Promise<MemoTask[]>
  static setTasks(date: string, tasks: MemoTask[]): Promise<void>
  static addTask(date: string, text: string): Promise<MemoTask>
  static toggleTask(date: string, id: string): Promise<MemoTask | null>
  static deleteTask(date: string, id: string): Promise<boolean>
  static getAllDays(): Promise<MemoDayRecord[]>
  static importDays(days: MemoDayRecord[]): Promise<void>
}
```

## New Tab Flow

- On load, compute today's local date key.
- Load tasks for the selected date from IndexedDB.
- Render progress as completed count over total count.
- Previous/next controls update the selected date and reload tasks.
- The date picker updates the selected date and reloads tasks.
- Adding a task writes to IndexedDB and updates local state.
- Toggling a task writes to IndexedDB and updates local state.
- Deleting a task writes to IndexedDB and updates local state.

## Import and Export

Upgrade export from navigation-only JSON to a full backup format:

```ts
interface QuickNavBackup {
  version: 1
  exportedAt: number
  navItems: NavItem[]
  backgroundSettings: BackgroundSettings
  memoDays: MemoDayRecord[]
}
```

Export behavior:

- Read navigation items from `NavStorage`.
- Read background settings from `NavStorage`.
- Read all memo day records from IndexedDB.
- Download one JSON file named `quick-nav-backup.json`.

Import behavior:

- If the JSON is the new backup object, import available modules from it.
- `navItems` imports through existing navigation import validation.
- `backgroundSettings` imports through existing background settings storage.
- `memoDays` imports into IndexedDB.
- If local and imported memo data contain the same date, imported data overwrites the local date.
- If the JSON is the old array format, treat it as navigation-only import and leave background settings and memo data unchanged.

## Error Handling

- If IndexedDB fails to open or read, show an empty memo state and log the error.
- If a task is blank after trimming, do not save it.
- If import JSON is invalid, show the existing import failure alert.
- If a new backup is missing one module, skip that module and import the others.

## Files To Change

- `src/memo-storage.ts`: new IndexedDB service.
- `src/newtab.tsx`: memo UI state and interactions.
- `src/options.tsx`: unified import/export.
- `src/storage.ts`: reuse existing nav/background methods; no memo IndexedDB logic.
- `src/style.css`: memo card styling and responsive layout.

## Verification

- New tab defaults to today's memo.
- Adding a task persists after refresh.
- Tomorrow and today have independent task lists.
- Date picker can jump to a specific date.
- Completed state persists after refresh.
- Deleted tasks do not reappear after refresh.
- Export includes `navItems`, `backgroundSettings`, and `memoDays`.
- Import restores memo data to IndexedDB.
- Import overwrites matching memo dates.
- Old navigation-array imports still work.
- `pnpm build` passes.
