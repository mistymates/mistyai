# Rebranding Mitski/Mistski to Misty

## Goal
Rebrand all occurrences of 'Mitski' and 'Mistski' to 'Misty' across the specified files to align with the new project name.

## Scope
The following files will be processed:
- docs/superpowers/plans/2025-05-22-task-5-ui-integration.md
- local-voice/wakeword-server.py
- src/components/FloatingOrb.tsx
- src/components/assistant/AssistantSidePanel.tsx
- src/components/assistant/GlobalAssistant.tsx
- src/lib/chat-storage.ts
- src/lib/hooks/use-realtime.ts
- src/lib/spotify-commands.ts
- src/routes/app.analytics.tsx
- src/routes/app.calendar.tsx
- src/routes/app.chat.tsx
- src/routes/app.dashboard.tsx
- src/routes/app.health.tsx
- src/routes/app.journal.tsx
- src/routes/app.memory.tsx
- src/routes/app.notes.tsx
- src/routes/app.projects.tsx
- src/routes/app.settings.tsx
- src/routes/app.tasks.tsx
- src/styles.css
- supabase/.temp/linked-project.json

## Strategy
1. **Case-Sensitive Replacement**:
   - `Mistski` -> `Misty`
   - `mistski` -> `misty`
   - `Mitski` -> `Misty`
   - `mitski` -> `misty`
   - `MITSKI` -> `MISTY`
   - `MISTSKI` -> `MISTY`
2. **Asset Renaming**:
   - `mistski-orb.png` -> `misty-orb.png` (references in code)
3. **Verification**:
   - Run `grep_search` on each file after modification to ensure no old names remain.

## Implementation Plan
1. Process files one by one using the `replace` tool.
2. For each file, identify all unique strings to be replaced.
3. Apply replacements sequentially.
4. Final verification across all targeted files.
