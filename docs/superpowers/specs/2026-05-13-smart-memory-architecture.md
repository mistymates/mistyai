# Design Spec: Smarter AI Memory Architecture

**Date:** 2026-05-13
**Status:** Approved
**Topic:** Expanding Memory Vault into a categorized, entity-linked AI brain.

## 1. Purpose

Transform the existing flat memory storage into a structured, categorized system that allows the Misty AI to understand the user deeply and in real-time. The system must support automatic AI categorization and metadata extraction without interrupting the user flow.

## 2. Core Architecture (Graph-Based)

The system uses a hybrid of vector search (for semantic retrieval) and relational metadata (for structured differentiation).

### 2.1 Database Schema (Supabase)

We will utilize and refine the existing `memories` table:

- **`category` (ENUM):** Updated to `Me`, `People`, `Preferences`, `Goals`, `Health`, `Relationships`.
- **`metadata` (JSONB):** Stores category-specific entities (e.g., `person_name`, `deadline`, `allergy_type`).
- **`memory_links`:** Used to relate memories across categories (e.g., a "Goal" linked to a "Relationship").

### 2.2 AI categorization Logic

The `/api/chat` handler will be updated to perform "Background Memory Processing":

1. **Detection:** AI evaluates if a message contains long-term factual information.
2. **Classification:** AI assigns the memory to one of the 6 core categories.
3. **Extraction:** AI generates a JSON metadata object based on the category.
4. **Insertion:** Data is pushed to Supabase with generated embeddings for real-time retrieval.

## 3. UI/UX Features

- **Categorized Tabs:** The Memory Vault page (`/app/memory`) will provide high-level filtering by category.
- **Manual Entry:** A category selector will be added to the "Add Memory" dialog.
- **AI Attribution:** Visual indicators for memories captured automatically by Misty.

## 4. Real-time AI Integration

The AI's system prompt and retrieval step in `/api/chat` will be enhanced:

- **Context Injection:** Retreived memories will be presented to the model with their category and metadata (e.g., `[Health: Allergy] User is allergic to shellfish`).
- **Relationship Traversal:** The AI will prioritize memories linked to current conversation topics.

## 5. Success Criteria

- [ ] Supabase schema supports the 6 specific categories.
- [ ] AI automatically saves relevant facts into the correct category with metadata.
- [ ] The Memory Vault UI allows filtering by these categories.
- [ ] The AI correctly recalls and references these categorized facts in conversation.
