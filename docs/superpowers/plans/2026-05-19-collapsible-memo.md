# Collapsible Memo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the new tab daily memo collapse into a compact remembered state.

**Architecture:** Store memo UI preference in `chrome.storage.local` because it is UI state, not memo business data. `newtab.tsx` reads and writes the collapsed state while keeping IndexedDB task data unchanged.

**Tech Stack:** Plasmo, React 18, TypeScript, Chrome storage API.

---

### Task 1: Memo UI Settings Storage

**Files:**
- Modify: `src/storage.ts`

- [ ] Add `MemoUiSettings` with `collapsed: boolean`.
- [ ] Add `getMemoUiSettings` and `setMemoUiSettings` to `NavStorage`.

### Task 2: New Tab Collapsed State

**Files:**
- Modify: `src/newtab.tsx`

- [ ] Load collapsed preference on mount.
- [ ] Persist preference when toggled.
- [ ] Render a compact `备忘 completed/total` pill when collapsed.
- [ ] Render a collapse button when expanded.

### Task 3: Styles and Verification

**Files:**
- Modify: `src/style.css`

- [ ] Add styles for collapse button and compact collapsed memo pill.
- [ ] Run `pnpm build` and confirm success.
