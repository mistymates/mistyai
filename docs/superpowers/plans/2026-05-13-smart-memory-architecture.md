# Smarter AI Memory Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Memory Vault into a categorized, entity-linked AI brain that automatically captures and retrieves facts in real-time.

**Architecture:** A graph-based hybrid system using Supabase vector search for retrieval and JSONB metadata for categorization. The AI categorization logic is embedded in the chat API for zero-friction memory capture.

**Tech Stack:** React (TypeScript), Supabase, AI SDK (Gemini), TanStack Router.

---

### Task 1: Update Database Schema

**Files:**

- Create: `supabase/migrations/20260513000000_update_memory_categories.sql`

- [ ] **Step 1: Create migration to update memory categories**
      Create a new migration file to update the `memory_category` ENUM and ensure the schema is ready.

```sql
-- Update the memory_category ENUM to the requested set
DO $$ BEGIN
    -- Add new values if they don't exist
    -- Note: We don't remove old ones to avoid breaking existing data,
    -- but the UI/API will only use the new ones.
    ALTER TYPE memory_category ADD VALUE IF NOT EXISTS 'Me';
    ALTER TYPE memory_category ADD VALUE IF NOT EXISTS 'People';
    ALTER TYPE memory_category ADD VALUE IF NOT EXISTS 'Preferences';
    ALTER TYPE memory_category ADD VALUE IF NOT EXISTS 'Goals';
    ALTER TYPE memory_category ADD VALUE IF NOT EXISTS 'Health';
    ALTER TYPE memory_category ADD VALUE IF NOT EXISTS 'Relationships';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
```

- [ ] **Step 2: Apply migration**
      Explain to the user that the migration needs to be applied to their Supabase instance.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260513000000_update_memory_categories.sql
git commit -m "db: update memory categories enum"
```

---

### Task 2: Update TypeScript Definitions

**Files:**

- Modify: `src/lib/types/database.ts`

- [ ] **Step 1: Update MemoryCategory type**
      Update the union type to match the new architecture.

```typescript
// Replace lines 94-105 with:
export type MemoryCategory = "Me" | "People" | "Preferences" | "Goals" | "Health" | "Relationships";
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types/database.ts
git commit -m "types: update memory categories"
```

---

### Task 3: Implement AI Categorization in Chat API

**Files:**

- Modify: `src/routes/api/chat.ts`

- [ ] **Step 1: Add categorization prompt and logic**
      Implement a helper function to analyze user text for memories.

```typescript
// Add this helper function
async function extractMemory(text: string, google: any) {
  const model = google(process.env.GEMINI_MODEL ?? "gemini-2.0-flash");
  const prompt = `
    Analyze this message for long-term facts about the user.
    Categories: Me, People, Preferences, Goals, Health, Relationships.
    Output JSON ONLY: { "is_memory": boolean, "category": string, "content": string, "metadata": {} }
    
    Message: "${text}"
  `;

  const { text: result } = await generateText({
    model,
    prompt,
    responseFormat: { type: "json_object" },
  });

  return JSON.parse(result);
}
```

- [ ] **Step 2: Update background insertion logic**
      Modify the `supabase.from("memories").insert(...)` block to use the extracted category and metadata.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/chat.ts
git commit -m "api: implement AI memory categorization"
```

---

### Task 4: Update Memory Vault UI

**Files:**

- Modify: `src/routes/app.memory.tsx`

- [ ] **Step 1: Update categories array**
      Update the array used for tabs.

```typescript
const categories: ("All" | MemoryCategory)[] = [
  "All",
  "Me",
  "People",
  "Preferences",
  "Goals",
  "Health",
  "Relationships",
];
```

- [ ] **Step 2: Update "Add Memory" dialog**
      Add a category selector to the manual add form.

```tsx
<div className="space-y-2">
  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
    Category
  </label>
  <select
    value={newMemory.category}
    onChange={(e) => setNewMemory({ ...newMemory, category: e.target.value as MemoryCategory })}
    className="w-full bg-white/5 border border-white/10 rounded-md p-2 text-sm focus:ring-1 focus:ring-[color:var(--violet)] outline-none"
  >
    <option value="" disabled>
      Select category
    </option>
    {categories
      .filter((c) => c !== "All")
      .map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
  </select>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/app.memory.tsx
git commit -m "ui: update memory vault categories and manual entry"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Verify end-to-end**
      Run the app, tell Misty a personal fact, and check if it appears in the Memory Vault under the correct category.
