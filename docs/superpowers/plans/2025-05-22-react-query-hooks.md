# React Query Hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement React Query hooks for core data fetching (tasks, notes, projects, habits, agenda) using the existing `dataService`.

**Architecture:** Create custom hooks wrapping `useQuery` from TanStack Query, referencing the `dataService` methods.

**Tech Stack:** React, @tanstack/react-query, Supabase.

---

### Task 1: Create use-data.ts

**Files:**

- Create: `src/lib/hooks/use-data.ts`

- [ ] **Step 1: Create directory if it doesn't exist**
      Run: `mkdir -p src/lib/hooks`

- [ ] **Step 2: Implement hooks in `src/lib/hooks/use-data.ts`**

```typescript
import { useQuery } from "@tanstack/react-query";
import { dataService } from "@/lib/services/data-service";

export const useTasks = () => {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: () => dataService.getTasks(),
  });
};

export const useNotes = () => {
  return useQuery({
    queryKey: ["notes"],
    queryFn: () => dataService.getNotes(),
  });
};

export const useProjects = () => {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => dataService.getProjects(),
  });
};

export const useHabits = () => {
  return useQuery({
    queryKey: ["habits"],
    queryFn: () => dataService.getHabits(),
  });
};

export const useAgenda = () => {
  return useQuery({
    queryKey: ["agenda"],
    queryFn: () => dataService.getAgenda(),
  });
};
```

- [ ] **Step 3: Commit**

Run:

```bash
git add src/lib/hooks/use-data.ts
git commit -m "feat: implement react query hooks for core data"
```
