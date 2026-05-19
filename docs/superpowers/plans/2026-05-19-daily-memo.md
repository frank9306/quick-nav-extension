# Daily Memo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a date-based daily task memo to the new tab page with IndexedDB persistence and unified backup import/export.

**Architecture:** Keep navigation/background data in `chrome.storage.local`; add `src/memo-storage.ts` as the sole IndexedDB boundary for memo days. `newtab.tsx` owns memo UI state and interactions, while `options.tsx` composes backup export/import across both storage systems.

**Tech Stack:** Plasmo, React 18, TypeScript, Chrome extension APIs, IndexedDB.

---

### Task 1: IndexedDB Memo Storage

**Files:**
- Create: `src/memo-storage.ts`

- [ ] Create `MemoTask`, `MemoDayRecord`, and `MemoStorage` with `getTasks`, `setTasks`, `addTask`, `toggleTask`, `deleteTask`, `getAllDays`, and `importDays`.
- [ ] Use database `quick-nav-db`, version `1`, object store `memo-days`, key path `date`.
- [ ] Validate imported day records and overwrite matching dates.

### Task 2: New Tab Memo UI

**Files:**
- Modify: `src/newtab.tsx`

- [ ] Import `MemoStorage` and memo types.
- [ ] Add selected date state, task state, input state, and memo loading state.
- [ ] Add helpers for local date keys and previous/next date navigation.
- [ ] Load tasks whenever selected date changes.
- [ ] Add handlers for add, toggle, delete, and date picker changes.
- [ ] Render a left-top memo card before the hero content.

### Task 3: Memo Styling

**Files:**
- Modify: `src/style.css`

- [ ] Add glass styles for `.memo-card` and child elements.
- [ ] Position desktop memo card in the upper-left without blocking the centered hero.
- [ ] Add mobile rules so the memo card becomes full-width and non-fixed.

### Task 4: Unified Backup Import/Export

**Files:**
- Modify: `src/options.tsx`

- [ ] Import `MemoStorage` and backup memo types.
- [ ] Change export to write `quick-nav-backup.json` with `version`, `exportedAt`, `navItems`, `backgroundSettings`, and `memoDays`.
- [ ] Change import to support new backup object and old nav-only array.
- [ ] For new backup imports, import memo days with overwrite semantics.

### Task 5: Verification

**Files:**
- Verify only

- [ ] Run `pnpm build`.
- [ ] Confirm build succeeds.
- [ ] Check `git status --short` for changed files.
