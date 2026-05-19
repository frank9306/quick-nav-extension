# Bulk Navigation Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-select and batch delete support to the navigation management page.

**Architecture:** Keep selection state local to `options.tsx`. Reuse existing `NavStorage.deleteNavItem` for deletion to avoid expanding storage API unnecessarily.

**Tech Stack:** React 18, TypeScript, Chrome storage API.

---

### Task 1: Selection State and Handlers

**Files:**
- Modify: `src/options.tsx`

- [ ] Add `selectedItemIds` state.
- [ ] Add handlers for selecting one item, selecting all, clearing selection, and bulk deleting.

### Task 2: Management UI Controls

**Files:**
- Modify: `src/options.tsx`

- [ ] Add list header controls for select all, selected count, clear selection, and batch delete.
- [ ] Add one checkbox per navigation item.
- [ ] Disable batch delete when nothing is selected.

### Task 3: Verification

**Files:**
- Verify only

- [ ] Run `pnpm build` and confirm success.
