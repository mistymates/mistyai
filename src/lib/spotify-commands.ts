import {
  nextSpotifyTrack,
  pauseSpotifyPlayback,
  playSpotifyPlayback,
  previousSpotifyTrack,
  setSpotifyVolume,
  toggleSpotifyPlayback,
  transferSpotifyPlaybackToMisty,
} from "@/lib/spotify-player";

type SpotifyCommandKind = "next" | "previous" | "toggle" | "play" | "pause" | "transfer" | "volume";

type SpotifyCommand = {
  kind: SpotifyCommandKind;
  volume?: number;
};

export type SpotifyCommandResult = {
  handled: boolean;
  ok: boolean;
  userText: string;
  assistantText: string;
  error?: string;
};

function normalize(raw: string) {
  return raw
    .toLowerCase()
    .replace(/\b(misty)\b[:,]?\s*/g, "")
    .replace(/\b(please|can you|could you|would you)\b/g, "")
    .replace(/[?!.,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveSpotifyCommand(text: string): SpotifyCommand | null {
  const normalized = normalize(text);
  if (!normalized) return null;

  const mentionsMusic = /\b(song|track|music|spotify|playback|player|it|this)\b/.test(normalized);

  if (
    /^(skip|next|next one|next track|next song)$/.test(normalized) ||
    /\b(skip|next)\b.*\b(song|track|music|spotify|it|this)\b/.test(normalized) ||
    /\b(song|track)\b.*\b(skip|next)\b/.test(normalized)
  ) {
    return { kind: "next" };
  }

  if (
    /^(previous|prev|back|go back|last song|last track)$/.test(normalized) ||
    /\b(previous|prev|back|last)\b.*\b(song|track|music|spotify|it|this)\b/.test(normalized)
  ) {
    return { kind: "previous" };
  }

  if (
    /^(pause|stop)$/.test(normalized) ||
    /\b(pause|stop)\b.*\b(song|track|music|spotify|playback|it|this)\b/.test(normalized)
  ) {
    return { kind: "pause" };
  }

  if (
    /^(resume|play|continue)$/.test(normalized) ||
    /\b(resume|continue|play)\b.*\b(song|track|music|spotify|playback|it|this)\b/.test(normalized)
  ) {
    return { kind: "play" };
  }

  if (
    /^(toggle playback|play pause|pause play)$/.test(normalized) ||
    (mentionsMusic && /\b(toggle|play pause|pause play)\b/.test(normalized))
  ) {
    return { kind: "toggle" };
  }

  if (
    /\b(move|transfer|switch)\b.*\b(spotify|music|playback|player)\b.*\b(misty|here|this app)\b/.test(
      normalized,
    ) ||
    /\b(play|start)\b.*\b(in|inside|on)\b.*\b(misty|this app)\b/.test(normalized)
  ) {
    return { kind: "transfer" };
  }

  const volumeMatch = normalized.match(
    /\b(?:set\s+)?(?:spotify|music|playback|player)?\s*volume\s*(?:to)?\s*(\d{1,3})\b/,
  );
  if (volumeMatch) {
    const volume = Math.max(0, Math.min(100, Number(volumeMatch[1]))) / 100;
    return { kind: "volume", volume };
  }

  return null;
}

async function runSpotifyCommand(command: SpotifyCommand) {
  switch (command.kind) {
    case "next":
      await nextSpotifyTrack();
      return "Skipped.";
    case "previous":
      await previousSpotifyTrack();
      return "Back one track.";
    case "pause":
      await pauseSpotifyPlayback();
      return "Paused.";
    case "play":
      await playSpotifyPlayback();
      return "Playing.";
    case "toggle":
      await toggleSpotifyPlayback();
      return "Done.";
    case "transfer":
      await transferSpotifyPlaybackToMisty(true);
      return "Moved playback to Misty.";
    case "volume":
      await setSpotifyVolume(command.volume ?? 0.7);
      return `Volume set to ${Math.round((command.volume ?? 0.7) * 100)} percent.`;
  }
}

export async function tryHandleSpotifyCommand(text: string): Promise<SpotifyCommandResult> {
  const command = resolveSpotifyCommand(text);
  if (!command) {
    return { handled: false, ok: false, userText: text, assistantText: "" };
  }

  try {
    const assistantText = await runSpotifyCommand(command);
    return { handled: true, ok: true, userText: text, assistantText };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      handled: true,
      ok: false,
      userText: text,
      assistantText: `I couldn't control Spotify: ${message}`,
      error: message,
    };
  }
}
