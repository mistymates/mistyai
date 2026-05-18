import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { dataService } from "@/lib/services/data-service";
import { googleCalendarService } from "@/lib/services/google-calendar-service";
import { useGoogleAuthStore } from "@/lib/stores/google-auth-store";
import { weatherService } from "@/lib/services/weather-service";
import { useAIContext } from "@/lib/hooks/use-ai-context";
import type { CalendarEvent, Task } from "@/lib/types/database";
import type { GoogleCalendarEvent } from "@/lib/services/google-calendar-service";

const useAuthedQuery = <T>(queryKey: string[], queryFn: () => Promise<T[]>, enabled = true) => {
  return useQuery({
    queryKey,
    queryFn,
    enabled,
    retry: false,
    initialData: [],
  });
};

export const useWeather = () => {
  return useQuery({
    queryKey: ["weather"],
    queryFn: async () => {
      const loc = await weatherService.getLocation();
      const weather = await weatherService.getWeather(loc.lat, loc.lon);
      return { ...weather, city: loc.city };
    },
    staleTime: 1000 * 60 * 30, // 30 mins
    retry: false,
  });
};

export const useTasks = () => {
  return useAuthedQuery(["tasks"], () => dataService.getTasks());
};

export const useNotes = () => {
  return useAuthedQuery(["notes"], () => dataService.getNotes());
};

export const useNotifications = () => {
  return useAuthedQuery(["notifications"], () => dataService.getNotifications());
};

export const useProjects = () => {
  return useAuthedQuery(["projects"], () => dataService.getProjects());
};

export const useHabits = () => {
  return useAuthedQuery(["habits"], () => dataService.getHabits());
};

export type CalendarItemSource = "local" | "task" | "google" | "holiday";

export interface CalendarItem {
  id: string;
  title: string;
  start: string;
  end: string | null;
  source: CalendarItemSource;
  type: string;
  allDay: boolean;
  dateKey: string;
  url?: string;
}

type CalendarRange = {
  start: Date;
  end: Date;
};

let lastExpiredGoogleToken: string | null = null;

const toDateKey = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const isWithinRange = (value: string | null | undefined, start: Date, end: Date) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= start && date < end;
};

const normalizeLocalEvent = (event: CalendarEvent): CalendarItem => ({
  id: `local:${event.id}`,
  title: event.title,
  start: event.start_time,
  end: event.end_time,
  source: "local",
  type: event.type || "event",
  allDay: !event.start_time.includes("T"),
  dateKey: toDateKey(event.start_time),
});

const normalizeTask = (task: Task): CalendarItem | null => {
  if (!task.due_date) return null;
  return {
    id: `task:${task.id}`,
    title: task.title,
    start: task.due_date,
    end: null,
    source: "task",
    type: task.done ? "completed-deadline" : "deadline",
    allDay: true,
    dateKey: toDateKey(task.due_date),
  };
};

const normalizeGoogleEvent = (
  event: GoogleCalendarEvent,
  source: Extract<CalendarItemSource, "google" | "holiday">,
): CalendarItem => {
  const start = event.start?.dateTime || event.start?.date || new Date().toISOString();
  const end = event.end?.dateTime || event.end?.date || null;
  const allDay = Boolean(event.start?.date && !event.start?.dateTime);

  return {
    id: `${source}:${event.id}`,
    title: event.summary || (source === "holiday" ? "Indonesian holiday" : "Untitled Event"),
    start,
    end,
    source,
    type: source === "holiday" ? "holiday" : "google",
    allDay,
    dateKey: toDateKey(start),
    url: event.htmlLink,
  };
};

function isGoogleAuthError(error: unknown) {
  return (
    axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)
  );
}

async function getGoogleCalendarEvents(
  token: string | null,
  range: CalendarRange,
  onGoogleAuthExpired?: () => void,
) {
  if (!token) return [] as CalendarItem[];

  const timeMin = range.start.toISOString();
  const timeMax = range.end.toISOString();

  try {
    const [googleEvents, holidayEvents] = await Promise.all([
      googleCalendarService.getEvents(token, { timeMin, timeMax, maxResults: 250 }),
      googleCalendarService.getIndonesiaHolidays(token, { timeMin, timeMax, maxResults: 100 }),
    ]);

    return [
      ...googleEvents.map((event) => normalizeGoogleEvent(event, "google")),
      ...holidayEvents.map((event) => normalizeGoogleEvent(event, "holiday")),
    ];
  } catch (error) {
    if (isGoogleAuthError(error)) {
      onGoogleAuthExpired?.();
      if (lastExpiredGoogleToken !== token) {
        toast.error("Google Calendar session expired. Please reconnect.");
        lastExpiredGoogleToken = token;
      }
    }
    return [] as CalendarItem[];
  }
}

async function getMergedCalendarItems(
  token: string | null,
  range: CalendarRange,
  onGoogleAuthExpired?: () => void,
) {
  const timeMin = range.start.toISOString();
  const timeMax = range.end.toISOString();
  const [localEvents, tasks, googleItems] = await Promise.all([
    dataService.getCalendarEvents(timeMin, timeMax),
    dataService.getTasks(),
    getGoogleCalendarEvents(token, range, onGoogleAuthExpired),
  ]);

  return [
    ...localEvents.map(normalizeLocalEvent),
    ...tasks
      .filter((task) => isWithinRange(task.due_date, range.start, range.end))
      .map(normalizeTask)
      .filter((item): item is CalendarItem => Boolean(item)),
    ...googleItems,
  ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

export const useCalendarItems = ({ start, end }: CalendarRange) => {
  const token = useGoogleAuthStore((state) => state.token);
  const expiresAt = useGoogleAuthStore((state) => state.expiresAt);
  const logout = useGoogleAuthStore((state) => state.logout);
  const validToken = token && expiresAt && expiresAt > Date.now() ? token : null;
  const startKey = start.toISOString();
  const endKey = end.toISOString();

  return useQuery({
    queryKey: ["calendar-items", validToken, startKey, endKey],
    queryFn: () => getMergedCalendarItems(validToken, { start, end }, logout),
    retry: false,
    initialData: [],
  });
};

export const useAgenda = () => {
  const token = useGoogleAuthStore((state) => state.token);
  const expiresAt = useGoogleAuthStore((state) => state.expiresAt);
  const logout = useGoogleAuthStore((state) => state.logout);
  const validToken = token && expiresAt && expiresAt > Date.now() ? token : null;

  return useQuery({
    queryKey: ["agenda", validToken],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 2);
      const items = await getMergedCalendarItems(validToken, { start, end }, logout);
      return items.map((item) => ({
        id: item.id,
        title: item.title,
        start_time: item.start,
        end_time: item.end,
        type: item.type,
      }));
    },
    retry: false,
    initialData: [],
  });
};

export const useTransactions = () => {
  return useAuthedQuery(["transactions"], () => dataService.getTransactions());
};

export const useJournalEntries = () => {
  return useAuthedQuery(["journal_entries"], () => dataService.getJournalEntries());
};

export const useMemories = () => {
  return useAuthedQuery(["memories"], () => dataService.getMemories());
};

export interface InsightData {
  briefing: string;
  insights: { icon: string; color: string; text: string }[];
}

export const useLiveInsights = (enabled = false) => {
  const { buildContextString } = useAIContext();

  return useQuery<InsightData>({
    queryKey: ["live_insights"],
    queryFn: async () => {
      const contextData = buildContextString();
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextData }),
      });
      if (!res.ok) throw new Error("Failed to fetch insights");
      return res.json();
    },
    enabled,
    staleTime: 1000 * 60 * 30, // 30 minutes
    retry: false,
  });
};

export const useUsageSummary = () => {
  return useQuery({
    queryKey: ["usage_summary"],
    queryFn: () => dataService.getUsageSummary(),
    staleTime: 1000 * 30,
    retry: false,
  });
};

export const useDailyMemoryDigest = () => {
  return useQuery({
    queryKey: ["daily_memory_digest"],
    queryFn: () => dataService.getDailyMemoryDigest(),
    staleTime: 1000 * 20,
    retry: false,
  });
};
