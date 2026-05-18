import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Bell, Search, Sparkles, PanelRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAssistant } from "@/lib/assistant-store";
import { useRealtime } from "@/lib/hooks/use-realtime";
import { useNotifications } from "@/lib/hooks/use-data";
import { dataService } from "@/lib/services/data-service";
import { SpotifyPlaybackBridge } from "@/components/SpotifyPlaybackBridge";
import { ShaderBackground } from "@/components/ShaderBackground";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  useRealtime();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const toggleSidePanel = useAssistant((s) => s.toggleSidePanel);
  const sidePanelOpen = useAssistant((s) => s.sidePanelOpen);
  const notifications = useAssistant((s) => s.notifications);
  const setNotifications = useAssistant((s) => s.setNotifications);
  const { data: notificationRows = [] } = useNotifications();
  const unreadCount = notificationRows.filter((item) => !item.read).length;

  useEffect(() => {
    setNotifications(unreadCount);
  }, [setNotifications, unreadCount]);

  const markNotificationsRead = async () => {
    try {
      await dataService.markNotificationsRead();
      setNotifications(0);
    } catch (error) {
      console.error("Failed to mark notifications read", error);
    }
  };

  return (
    <SidebarProvider>
      <div className="relative min-h-screen flex w-full bg-transparent">
        <ShaderBackground />
        <SpotifyPlaybackBridge />
        <AppSidebar />
        <SidebarInset className="relative z-10 min-w-0 bg-transparent">
          <header className="sticky top-0 z-30 flex min-h-14 flex-wrap items-center gap-2 border-b border-white/5 bg-background/40 px-3 py-2 backdrop-blur-xl sm:flex-nowrap sm:gap-3 sm:px-4">
            <SidebarTrigger />
            <button
              type="button"
              onClick={() => {
                // Reuse the command palette shortcut so header and keyboard entry stay in sync.
                window.dispatchEvent(
                  new KeyboardEvent("keydown", {
                    key: "k",
                    metaKey: true,
                    ctrlKey: true,
                    bubbles: true,
                  }),
                );
              }}
              className="group relative order-3 flex h-9 min-w-0 flex-1 basis-full items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-left transition hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:order-none sm:max-w-md sm:basis-auto"
              aria-label="Open search and command palette"
            >
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground flex-1 truncate">
                Search or ask Misty…
              </span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground hidden sm:inline-block">
                ⌘K
              </kbd>
            </button>
            <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new KeyboardEvent("keydown", {
                      key: "j",
                      metaKey: true,
                      ctrlKey: true,
                      bubbles: true,
                    }),
                  )
                }
                className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-gradient-to-r from-[color:var(--violet)]/20 to-[color:var(--cyan)]/20 px-3 text-xs transition hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Ask Misty"
              >
                <Sparkles className="h-3.5 w-3.5 text-[color:var(--violet)]" />
                <span className="hidden sm:inline">Ask</span>
                <kbd className="text-[10px] px-1 rounded bg-white/10 text-muted-foreground hidden md:inline">
                  ⌘J
                </kbd>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="relative h-9 w-9 grid place-items-center rounded-lg hover:bg-white/5 transition"
                    aria-label="Open notifications"
                  >
                    <Bell className="h-4 w-4" />
                    {notifications > 0 && (
                      <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[color:var(--rose)] animate-pulse" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between gap-3">
                    <span>Notifications</span>
                    {notifications > 0 && (
                      <button
                        type="button"
                        onClick={markNotificationsRead}
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Mark read
                      </button>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notificationRows.length === 0 ? (
                    <DropdownMenuItem disabled>No notifications yet</DropdownMenuItem>
                  ) : (
                    notificationRows.slice(0, 6).map((item) => (
                      <DropdownMenuItem key={item.id} className="items-start gap-3 py-2">
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 rounded-full ${
                            item.read ? "bg-white/20" : "bg-[color:var(--rose)]"
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium truncate">{item.title}</span>
                          {item.message && (
                            <span className="block text-xs text-muted-foreground line-clamp-2">
                              {item.message}
                            </span>
                          )}
                        </span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                onClick={toggleSidePanel}
                aria-label="Toggle assistant panel"
                aria-pressed={sidePanelOpen}
                className={`grid h-9 w-9 place-items-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  sidePanelOpen
                    ? "bg-white/10 text-foreground"
                    : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                }`}
              >
                <PanelRight className="h-4 w-4" />
              </button>
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[color:var(--violet)] to-[color:var(--cyan)] grid place-items-center text-xs font-semibold">
                M
              </div>
            </div>
          </header>
          <main
            className={`flex-1 p-4 sm:p-6 lg:p-8 transition-[padding] duration-300 ${
              sidePanelOpen ? "lg:pr-[380px]" : ""
            }`}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={path}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
