# IP-Based Weather Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically detect the user's location via IP address and fetch live weather data to display in the dashboard.

**Architecture:**

1. Use `ip-api.com` (free, no key required for local use) to get the user's city and coordinates.
2. Use `Open-Meteo` (free, no key required) to fetch weather data based on those coordinates.
3. Create a `useWeather` hook to manage the state and fetching.
4. Update the dashboard weather widget to display real data instead of placeholders.

**Tech Stack:** React, Axios, TanStack Query.

---

### Task 1: Create Weather Service

**Files:**

- Create: `src/lib/services/weather-service.ts`

- [ ] **Step 1: Implement location and weather fetching**

  ```tsx
  import axios from "axios";

  export const weatherService = {
    async getLocation() {
      const res = await axios.get("http://ip-api.com/json/");
      return {
        city: res.data.city,
        lat: res.data.lat,
        lon: res.data.lon,
      };
    },
    async getWeather(lat: number, lon: number) {
      const res = await axios.get(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`,
      );
      return res.data.current_weather;
    },
  };
  ```

---

### Task 2: Create Weather Hook

**Files:**

- Modify: `src/lib/hooks/use-data.ts`

- [ ] **Step 1: Add `useWeather` hook**
  ```tsx
  export const useWeather = () => {
    return useQuery({
      queryKey: ["weather"],
      queryFn: async () => {
        const loc = await weatherService.getLocation();
        const weather = await weatherService.getWeather(loc.lat, loc.lon);
        return { ...weather, city: loc.city };
      },
      staleTime: 1000 * 60 * 30, // 30 mins
    });
  };
  ```

---

### Task 3: Update Dashboard UI

**Files:**

- Modify: `src/routes/app.dashboard.tsx`

- [ ] **Step 1: Integrate `useWeather` into the dashboard**
  - Fetch weather data using the hook.
  - Replace the placeholder "18°" and "Berlin" with dynamic data.
  - Map weather codes (from Open-Meteo) to icons if possible, or keep a default cloud icon for now.

---

### Task 4: Verification

- [ ] **Step 1: Verify the dashboard displays the correct city and temperature**
  - Ensure the city matches the user's IP-based location.
  - Ensure the temperature is live.
