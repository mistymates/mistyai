# Google Calendar API Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Supabase-backed calendar with the Google Calendar API for a single local user.

**Architecture:** We will use `@react-oauth/google` for authentication and fetch events directly from the Google Calendar API. We'll store the Google Client ID in the `.env` file and update the existing calendar hooks and pages to use the new data source.

**Tech Stack:** React, @react-oauth/google, Axios, TanStack Query.

---

### Task 1: Setup and Dependencies

**Files:**

- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Install dependencies**
      Run: `npm install @react-oauth/google axios`

- [ ] **Step 2: Add Google Client ID to `.env.example`**
      Add `VITE_GOOGLE_CLIENT_ID=` to `.env.example`.

---

### Task 2: Configure Google OAuth Provider

**Files:**

- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Wrap the application with `GoogleOAuthProvider`**

  ```tsx
  import { GoogleOAuthProvider } from "@react-oauth/google";

  // In RootComponent:
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <Outlet />
        ...
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
  ```

---

### Task 3: Create Google Calendar Service and Hooks

**Files:**

- Create: `src/lib/services/google-calendar-service.ts`
- Modify: `src/lib/hooks/use-data.ts`
- Create: `src/lib/stores/google-auth-store.ts`

- [ ] **Step 1: Create a simple store to hold the Google access token**

  ```tsx
  import { create } from "zustand";
  import { persist } from "zustand/middleware";

  interface GoogleAuthState {
    token: string | null;
    setToken: (token: string | null) => void;
  }

  export const useGoogleAuthStore = create<GoogleAuthState>()(
    persist(
      (set) => ({
        token: null,
        setToken: (token) => set({ token }),
      }),
      { name: "google-auth-storage" },
    ),
  );
  ```

- [ ] **Step 2: Create `google-calendar-service.ts`**

  ```tsx
  import axios from "axios";

  export const googleCalendarService = {
    async getEvents(token: string) {
      const response = await axios.get(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            timeMin: new Date().toISOString(),
            maxResults: 10,
            singleEvents: true,
            orderBy: "startTime",
          },
        },
      );
      return response.data.items;
    },
  };
  ```

- [ ] **Step 3: Update `useAgenda` hook in `use-data.ts`**
  - Import `useGoogleAuthStore` and `googleCalendarService`.
  - Update `useAgenda` to fetch from Google if a token exists.

---

### Task 4: Update Calendar UI for Authentication

**Files:**

- Modify: `src/routes/app.calendar.tsx`

- [ ] **Step 1: Add a "Login with Google" button to the Calendar page**
  - Use `useGoogleLogin` from `@react-oauth/google`.
  - Save the token to `useGoogleAuthStore` on success.
  - Display the login button if no token is present.

- [ ] **Step 2: Adapt UI to Google Event format**
  - Google events use `summary` instead of `title`.
  - Start time is in `start.dateTime` or `start.date`.

---

### Task 5: Cleanup and Verification

- [ ] **Step 1: Remove Supabase-based agenda logic**
  - Cleanup `dataService.getAgenda()` if no longer needed.
  - Verify the calendar page displays Google events correctly.
