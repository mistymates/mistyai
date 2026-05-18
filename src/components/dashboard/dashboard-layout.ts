import { useEffect, useState } from "react";

export type WidgetId =
  | "agenda"
  | "weather"
  | "mood"
  | "tasks"
  | "habits"
  | "focus"
  | "sleep"
  | "water"
  | "workout"
  | "music"
  | "quote"
  | "quickai"
  | "usage"
  | "memorydigest";

export type WidgetMeta = { id: WidgetId; label: string; span: string };

export const ALL_WIDGETS: WidgetMeta[] = [
  { id: "agenda", label: "Agenda", span: "col-span-12 lg:col-span-6 row-span-2" },
  { id: "weather", label: "Weather", span: "col-span-6 lg:col-span-3" },
  { id: "mood", label: "Mood", span: "col-span-6 lg:col-span-3" },
  { id: "tasks", label: "Tasks", span: "col-span-12 lg:col-span-3 row-span-2" },
  { id: "habits", label: "Habits", span: "col-span-12 lg:col-span-3 row-span-2" },
  { id: "focus", label: "Focus", span: "col-span-6 lg:col-span-3" },
  { id: "sleep", label: "Sleep", span: "col-span-6 lg:col-span-3" },
  { id: "water", label: "Water", span: "col-span-6 lg:col-span-3" },
  { id: "workout", label: "Workout", span: "col-span-6 lg:col-span-3" },
  { id: "music", label: "Music", span: "col-span-12 lg:col-span-6" },
  { id: "quote", label: "Quote", span: "col-span-12 lg:col-span-6" },
  { id: "usage", label: "Token Cost", span: "col-span-12 lg:col-span-6" },
  { id: "memorydigest", label: "Memory Digest", span: "col-span-12 lg:col-span-6 row-span-2" },
  { id: "quickai", label: "Quick AI", span: "col-span-12" },
];

const LS_ORDER = "misty.dashboard.order";
const LS_HIDDEN = "misty.dashboard.hidden";

const defaultOrder = () => ALL_WIDGETS.map((widget) => widget.id);
const isKnownWidgetId = (id: string): id is WidgetId =>
  ALL_WIDGETS.some((widget) => widget.id === id);

export function useDashboardLayout() {
  const [order, setOrder] = useState<WidgetId[]>(() => {
    if (typeof window === "undefined") return defaultOrder();

    try {
      const saved = JSON.parse(localStorage.getItem(LS_ORDER) || "null") as WidgetId[] | null;
      if (Array.isArray(saved)) {
        const known = saved.filter((id): id is WidgetId => isKnownWidgetId(id));
        const missing = defaultOrder().filter((id) => !known.includes(id));
        return [...known, ...missing];
      }
    } catch {
      /* Fall back to the default layout when saved dashboard state is invalid. */
    }

    return defaultOrder();
  });

  const [hidden, setHidden] = useState<WidgetId[]>(() => {
    if (typeof window === "undefined") return [];

    try {
      const saved = JSON.parse(localStorage.getItem(LS_HIDDEN) || "[]") as string[];
      return Array.isArray(saved) ? saved.filter(isKnownWidgetId) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(LS_ORDER, JSON.stringify(order));
  }, [order]);

  useEffect(() => {
    localStorage.setItem(LS_HIDDEN, JSON.stringify(hidden));
  }, [hidden]);

  const reset = () => {
    setOrder(defaultOrder());
    setHidden([]);
  };

  return { order, setOrder, hidden, setHidden, reset };
}
