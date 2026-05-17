import type { UIMessage } from "ai";

type LaunchKind = "app" | "url";

type LaunchTarget = {
  kind: LaunchKind;
  target: string;
  url?: string;
  label: string;
};

export type LaunchResult = {
  handled: boolean;
  ok: boolean;
  userText: string;
  assistantText: string;
  target?: LaunchTarget;
  error?: string;
};

const APP_ALIASES: Record<string, string> = {
  brave: "brave",
  browser: "brave",
  discord: "discord",
  whatsapp: "whatsapp",
  "whats app": "whatsapp",
  spotify: "spotify",
  music: "spotify",
  roblox: "roblox",
};

const SITE_ALIASES: Record<string, { url: string; label: string }> = {
  youtube: { url: "https://www.youtube.com", label: "YouTube" },
  yt: { url: "https://www.youtube.com", label: "YouTube" },
  instagram: { url: "https://www.instagram.com", label: "Instagram" },
  insta: { url: "https://www.instagram.com", label: "Instagram" },
  news: { url: "https://news.google.com", label: "Google News" },
  "google news": { url: "https://news.google.com", label: "Google News" },
  google: { url: "https://www.google.com", label: "Google" },
  gmail: { url: "https://mail.google.com", label: "Gmail" },
  drive: { url: "https://drive.google.com", label: "Google Drive" },
  calendar: { url: "https://calendar.google.com", label: "Google Calendar" },
  maps: { url: "https://www.google.com/maps", label: "Google Maps" },
  docs: { url: "https://docs.google.com", label: "Google Docs" },
  sheets: { url: "https://sheets.google.com", label: "Google Sheets" },
  chatgpt: { url: "https://chatgpt.com", label: "ChatGPT" },
  openai: { url: "https://chatgpt.com", label: "ChatGPT" },
  claude: { url: "https://claude.ai", label: "Claude" },
  gemini: { url: "https://gemini.google.com", label: "Gemini" },
  github: { url: "https://github.com", label: "GitHub" },
  reddit: { url: "https://www.reddit.com", label: "Reddit" },
  twitter: { url: "https://x.com", label: "X" },
  x: { url: "https://x.com", label: "X" },
  tiktok: { url: "https://www.tiktok.com", label: "TikTok" },
  twitch: { url: "https://www.twitch.tv", label: "Twitch" },
  netflix: { url: "https://www.netflix.com", label: "Netflix" },
  facebook: { url: "https://www.facebook.com", label: "Facebook" },
  canva: { url: "https://www.canva.com", label: "Canva" },
  figma: { url: "https://www.figma.com", label: "Figma" },
  notion: { url: "https://www.notion.so", label: "Notion" },
  pinterest: { url: "https://www.pinterest.com", label: "Pinterest" },
  amazon: { url: "https://www.amazon.com", label: "Amazon" },
  shopee: { url: "https://shopee.co.id", label: "Shopee" },
  tokopedia: { url: "https://www.tokopedia.com", label: "Tokopedia" },
  steam: { url: "https://store.steampowered.com", label: "Steam" },
  "epic games": { url: "https://store.epicgames.com", label: "Epic Games" },
  "whatsapp web": { url: "https://web.whatsapp.com", label: "WhatsApp Web" },
  "discord web": { url: "https://discord.com/app", label: "Discord" },
  "roblox website": { url: "https://www.roblox.com", label: "Roblox" },
};

function makeMessage(role: "user" | "assistant", text: string): UIMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    parts: [{ type: "text", text }],
  };
}

export function appendLocalMessages(
  messages: UIMessage[],
  userText: string,
  assistantText: string,
) {
  return [...messages, makeMessage("user", userText), makeMessage("assistant", assistantText)];
}

function normalize(raw: string) {
  return raw
    .toLowerCase()
    .replace(/\bmisty\b[:,]?\s*/g, "")
    .replace(/[?!]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTarget(raw: string) {
  return raw
    .replace(/\s+(in|on|from|with)\s+brave$/i, "")
    .replace(/^the\s+/i, "")
    .trim();
}

function searchUrl(query: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function youtubeSearchUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function resolveLaunchTarget(text: string): LaunchTarget | null {
  const normalized = normalize(text);
  if (!normalized) return null;

  const newsMatch = normalized.match(
    /^(?:open\s+)?(?:latest\s+)?news(?:\s+(?:about|on|for)\s+(.+))?$/,
  );
  if (newsMatch) {
    const topic = newsMatch[1]?.trim();
    return topic
      ? {
          kind: "url",
          target: "brave",
          url: searchUrl(`${topic} news`),
          label: `news about ${topic}`,
        }
      : {
          kind: "url",
          target: "brave",
          url: SITE_ALIASES.news.url,
          label: SITE_ALIASES.news.label,
        };
  }

  const latestMatch = normalized.match(/^(?:open\s+)?(?:latest|today'?s)\s+(.+?)\s+news$/);
  if (latestMatch) {
    const topic = latestMatch[1].trim();
    return {
      kind: "url",
      target: "brave",
      url: searchUrl(`${topic} news`),
      label: `news about ${topic}`,
    };
  }

  const youtubeSearchMatch = normalized.match(
    /^(?:search|find|play)\s+(.+?)\s+(?:on|in)\s+youtube$/,
  );
  if (youtubeSearchMatch) {
    const query = youtubeSearchMatch[1].trim();
    return {
      kind: "url",
      target: "brave",
      url: youtubeSearchUrl(query),
      label: `YouTube search for ${query}`,
    };
  }

  const searchMatch = normalized.match(/^(?:search|google|look up)\s+(.+)$/);
  if (searchMatch) {
    const query = searchMatch[1].trim();
    return { kind: "url", target: "brave", url: searchUrl(query), label: `search for ${query}` };
  }

  const openMatch = normalized.match(/^(?:open|launch|start|run|go to|visit)\s+(.+)$/);
  if (!openMatch) return null;

  const targetText = cleanTarget(openMatch[1]);
  if (!targetText) return null;

  const app = APP_ALIASES[targetText];
  if (app) return { kind: "app", target: app, label: targetText };

  const site = SITE_ALIASES[targetText];
  if (site) return { kind: "url", target: "brave", url: site.url, label: site.label };

  if (targetText.startsWith("news about ") || targetText.startsWith("news on ")) {
    const topic = targetText.replace(/^news (about|on) /, "").trim();
    return {
      kind: "url",
      target: "brave",
      url: searchUrl(`${topic} news`),
      label: `news about ${topic}`,
    };
  }

  if (/^https?:\/\//.test(targetText)) {
    return { kind: "url", target: "brave", url: targetText, label: targetText };
  }

  if (targetText.includes(".")) {
    return { kind: "url", target: "brave", url: `https://${targetText}`, label: targetText };
  }

  return {
    kind: "url",
    target: "brave",
    url: searchUrl(targetText),
    label: `search for ${targetText}`,
  };
}

async function invokeLaunch(target: LaunchTarget) {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("launch_target", {
    target: target.target,
    url: target.url ?? null,
  });
}

export async function tryHandleLauncherCommand(text: string): Promise<LaunchResult> {
  const target = resolveLaunchTarget(text);
  if (!target) {
    return { handled: false, ok: false, userText: text, assistantText: "" };
  }

  try {
    if (typeof window === "undefined") throw new Error("Launcher is only available in the app.");

    try {
      await invokeLaunch(target);
    } catch (invokeError) {
      if (target.kind === "url" && target.url) {
        window.open(target.url, "_blank", "noopener,noreferrer");
        return {
          handled: true,
          ok: true,
          userText: text,
          assistantText: `Opened ${target.label}.`,
          target,
        };
      }

      throw invokeError;
    }

    return {
      handled: true,
      ok: true,
      userText: text,
      assistantText: `Opened ${target.label}.`,
      target,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      handled: true,
      ok: false,
      userText: text,
      assistantText: `I couldn't open ${target.label}: ${message}`,
      target,
      error: message,
    };
  }
}
