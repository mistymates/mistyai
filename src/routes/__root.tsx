import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { GlobalAssistant } from "@/components/assistant/GlobalAssistant";
import { CommandPalette } from "@/components/CommandPalette";
import { AssistantSidePanel } from "@/components/assistant/AssistantSidePanel";
import { MicPermissionModal } from "@/components/assistant/MicPermissionModal";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Misty AI" },
      { name: "description", content: "Misty AI assistant platform" },
      { name: "author", content: "Misty AI" },
      { property: "og:title", content: "Misty AI" },
      { property: "og:description", content: "Misty AI assistant platform" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@MistyAI" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}>
      <QueryClientProvider client={queryClient}>
        <RuntimeSettingsApplier />
        <TauriFullscreenHotkeys />
        <Outlet />
        <AssistantSidePanel />
        <GlobalAssistant />
        <CommandPalette />
        <MicPermissionModal />
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}

const accentHue: Record<string, string> = {
  violet: "300",
  cyan: "220",
  rose: "10",
  mint: "165",
  amber: "80",
};

function RuntimeSettingsApplier() {
  useEffect(() => {
    let mounted = true;

    const applySettings = (settings: { accent?: string; theme?: "dark" | "auto" | "light" }) => {
      if (!mounted) return;
      const root = document.documentElement;
      const selectedAccent = settings.accent || "violet";
      const hue = accentHue[selectedAccent] || accentHue.violet;
      const theme = settings.theme || "dark";
      const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
      const effectiveTheme = theme === "auto" ? (prefersLight ? "light" : "dark") : theme;

      root.dataset.theme = effectiveTheme;
      root.dataset.accent = selectedAccent;
      root.style.setProperty("--primary", `oklch(0.78 0.18 ${hue})`);
      root.style.setProperty("--ring", `oklch(0.78 0.18 ${hue})`);
      root.style.setProperty("--violet", `oklch(0.7 0.22 ${hue})`);
    };

    fetch("/api/settings")
      .then((response) => (response.ok ? response.json() : null))
      .then((settings) => {
        if (settings) applySettings(settings);
      })
      .catch((error) => console.warn("Appearance settings unavailable", error));

    const onStorage = (event: StorageEvent) => {
      if (event.key !== "misty-runtime-settings" || !event.newValue) return;
      try {
        applySettings(JSON.parse(event.newValue));
      } catch {
        // Ignore malformed cross-tab payloads.
      }
    };
    const onLocalSettingsChanged = (event: Event) => {
      applySettings(
        (event as CustomEvent<{ accent?: string; theme?: "dark" | "auto" | "light" }>).detail,
      );
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("misty-runtime-settings-changed", onLocalSettingsChanged);
    return () => {
      mounted = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("misty-runtime-settings-changed", onLocalSettingsChanged);
    };
  }, []);

  return null;
}

function TauriFullscreenHotkeys() {
  useEffect(() => {
    const hasTauriRuntime =
      typeof window !== "undefined" &&
      ("__TAURI_INTERNALS__" in (window as object) || "__TAURI__" in (window as object));
    if (!hasTauriRuntime) return;

    const onKeyDown = async (event: KeyboardEvent) => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const appWindow = getCurrentWindow();

        if (event.key === "F11") {
          event.preventDefault();
          const isFullscreen = await appWindow.isFullscreen();
          await appWindow.setFullscreen(!isFullscreen);
          return;
        }

        if (event.key === "Escape") {
          const isFullscreen = await appWindow.isFullscreen();
          if (isFullscreen) {
            event.preventDefault();
            await appWindow.setFullscreen(false);
          }
        }
      } catch (error) {
        console.warn("Fullscreen hotkeys unavailable", error);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
