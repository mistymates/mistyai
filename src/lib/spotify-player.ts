import { create } from "zustand";
import { SpotifyAPI, SpotifyAuth, type SpotifyTrack } from "@/lib/spotify";

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string;
        volume?: number;
        getOAuthToken: (cb: (token: string) => void) => void;
      }) => SpotifySdkPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

type SpotifySdkTrackWindow = {
  current_track: {
    id?: string;
    name: string;
    uri?: string;
    artists: Array<{ name: string }>;
    album?: {
      images?: Array<{ url: string }>;
    };
  };
};

type SpotifySdkState = {
  paused: boolean;
  position: number;
  duration: number;
  track_window: SpotifySdkTrackWindow;
};

type SpotifySdkPlayer = {
  addListener: (event: string, callback: (payload?: unknown) => void) => boolean;
  removeListener: (event: string, callback?: (payload?: unknown) => void) => boolean;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  getVolume: () => Promise<number>;
  setVolume: (volume: number) => Promise<void>;
  togglePlay: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  getCurrentState: () => Promise<SpotifySdkState | null>;
  activateElement?: () => Promise<void> | void;
};

type SpotifyPlayerState = {
  sdkReady: boolean;
  connecting: boolean;
  connected: boolean;
  initializing: boolean;
  isActive: boolean;
  isPaused: boolean;
  deviceId: string | null;
  volume: number;
  position: number;
  duration: number;
  currentTrack: SpotifyTrack | null;
  error: string | null;
  premiumRequired: boolean;
  setState: (patch: Partial<Omit<SpotifyPlayerState, "setState">>) => void;
};

const initialState = {
  sdkReady: false,
  connecting: false,
  connected: false,
  initializing: false,
  isActive: false,
  isPaused: true,
  deviceId: null,
  volume: 0.7,
  position: 0,
  duration: 0,
  currentTrack: null,
  error: null,
  premiumRequired: false,
};

const useSpotifyPlayerStore = create<SpotifyPlayerState>((set) => ({
  ...initialState,
  setState: (patch) => set(patch),
}));

let sdkPromise: Promise<void> | null = null;
let sdkPlayer: SpotifySdkPlayer | null = null;
let progressInterval: number | null = null;
let playerListenersAttached = false;
let connectPromise: Promise<SpotifySdkPlayer | null> | null = null;

function setPlayerState(patch: Partial<Omit<SpotifyPlayerState, "setState">>) {
  useSpotifyPlayerStore.getState().setState(patch);
}

function clearProgressLoop() {
  if (progressInterval) {
    window.clearInterval(progressInterval);
    progressInterval = null;
  }
}

function startProgressLoop() {
  clearProgressLoop();
  progressInterval = window.setInterval(() => {
    const state = useSpotifyPlayerStore.getState();
    if (!state.connected || state.isPaused || state.duration <= 0) return;

    setPlayerState({
      position: Math.min(state.duration, state.position + 500),
    });
  }, 500);
}

function mapTrack(track: SpotifySdkTrackWindow["current_track"]): SpotifyTrack {
  return {
    id: track.id,
    name: track.name,
    uri: track.uri,
    artists: track.artists.map((artist) => ({ name: artist.name })),
    album: {
      images: track.album?.images?.map((image) => ({ url: image.url })) ?? [],
    },
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isDeviceNotFoundError(error: unknown) {
  return error instanceof Error && error.message.includes("Device not found");
}

function getDeviceId() {
  return useSpotifyPlayerStore.getState().deviceId;
}

async function waitForDeviceId(attempts = 20) {
  for (let i = 0; i < attempts; i += 1) {
    const deviceId = getDeviceId();
    if (deviceId) return deviceId;
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }
  return null;
}

async function waitForSpotifyDevice(deviceId: string, attempts = 20) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await SpotifyAPI.getDevices();
      const devices = response?.devices ?? [];
      const mistyDevice = devices.find((device) => device.id === deviceId);
      if (mistyDevice) return mistyDevice;
    } catch {
      // Device discovery is eventually consistent after SDK ready.
    }

    await new Promise((resolve) => window.setTimeout(resolve, 300));
  }

  return null;
}

function activateFromUserGesture() {
  try {
    void sdkPlayer?.activateElement?.();
  } catch {
    // Browsers/WebViews differ here; playback API calls below still provide feedback.
  }
}

function applySdkState(state: SpotifySdkState | null) {
  if (!state) {
    setPlayerState({
      isActive: false,
      isPaused: true,
      position: 0,
      duration: 0,
      currentTrack: null,
    });
    clearProgressLoop();
    return;
  }

  setPlayerState({
    connected: true,
    isActive: true,
    isPaused: state.paused,
    position: state.position,
    duration: state.duration,
    currentTrack: mapTrack(state.track_window.current_track),
    error: null,
  });

  if (state.paused) clearProgressLoop();
  else startProgressLoop();
}

async function syncCurrentState() {
  const state = await sdkPlayer?.getCurrentState();
  if (state) applySdkState(state);
  return state ?? null;
}

async function waitForCurrentState(attempts = 10) {
  for (let i = 0; i < attempts; i += 1) {
    const state = await syncCurrentState();
    if (state) return state;
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }
  return null;
}

async function loadSpotifySdk() {
  if (typeof window === "undefined") return;
  if (window.Spotify) {
    setPlayerState({ sdkReady: true });
    return;
  }
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-spotify-sdk="true"]');
    if (existing) {
      const previousReady = window.onSpotifyWebPlaybackSDKReady;
      window.onSpotifyWebPlaybackSDKReady = () => {
        previousReady?.();
        setPlayerState({ sdkReady: true });
        resolve();
      };
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.dataset.spotifySdk = "true";
    script.onerror = () => reject(new Error("Failed to load Spotify Web Playback SDK"));

    const previousReady = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      previousReady?.();
      setPlayerState({ sdkReady: true });
      resolve();
    };

    document.body.appendChild(script);
  });

  return sdkPromise;
}

async function ensureSpotifyPlayer() {
  if (typeof window === "undefined" || !SpotifyAuth.hasStoredSession()) return null;

  if (connectPromise) return connectPromise;

  if (sdkPlayer) {
    if (
      !useSpotifyPlayerStore.getState().connected &&
      !useSpotifyPlayerStore.getState().connecting
    ) {
      setPlayerState({ connecting: true, error: null });
      const connected = await sdkPlayer.connect();
      setPlayerState({
        connected,
        connecting: false,
        error: connected ? null : "Spotify player connection failed.",
      });
    }
    return sdkPlayer;
  }

  connectPromise = (async () => {
    setPlayerState({
      initializing: true,
      connecting: true,
      premiumRequired: false,
      error: null,
    });

    await loadSpotifySdk();

    sdkPlayer = new window.Spotify!.Player({
      name: "Misty",
      volume: useSpotifyPlayerStore.getState().volume,
      getOAuthToken: async (cb) => {
        const token = await SpotifyAuth.getValidAccessToken();
        cb(token ?? "");
      },
    });

    if (!playerListenersAttached) {
      sdkPlayer.addListener("ready", async (payload) => {
        const device = payload as { device_id: string };
        setPlayerState({
          connected: true,
          connecting: false,
          initializing: false,
          deviceId: device.device_id,
          error: null,
        });
        try {
          const volume = await sdkPlayer?.getVolume();
          if (typeof volume === "number") setPlayerState({ volume });
        } catch {
          // Ignore volume sync failures.
        }
      });

      sdkPlayer.addListener("not_ready", () => {
        setPlayerState({
          connected: false,
          isActive: false,
          connecting: false,
          deviceId: null,
          position: 0,
        });
      });

      sdkPlayer.addListener("player_state_changed", (payload) => {
        applySdkState(payload as SpotifySdkState | null);
      });

      sdkPlayer.addListener("initialization_error", (payload) => {
        const error = payload as { message?: string };
        setPlayerState({
          error: error.message ?? "Spotify player failed to initialize.",
          connecting: false,
          initializing: false,
        });
      });

      sdkPlayer.addListener("authentication_error", (payload) => {
        const error = payload as { message?: string };
        setPlayerState({
          error: error.message ?? "Spotify authentication failed.",
          connecting: false,
          initializing: false,
        });
        SpotifyAuth.logout();
      });

      sdkPlayer.addListener("account_error", (payload) => {
        const error = payload as { message?: string };
        setPlayerState({
          error: error.message ?? "Spotify Premium is required for playback.",
          premiumRequired: true,
          connecting: false,
          initializing: false,
        });
      });

      sdkPlayer.addListener("playback_error", (payload) => {
        const error = payload as { message?: string };
        setPlayerState({
          error: error.message ?? "Spotify playback failed.",
        });
      });

      sdkPlayer.addListener("autoplay_failed", () => {
        setPlayerState({
          error: "Playback is ready, but the browser needs one click before audio can start.",
        });
      });

      playerListenersAttached = true;
    }

    const connected = await sdkPlayer.connect();
    setPlayerState({
      connected,
      connecting: false,
      initializing: false,
      error: connected ? null : "Spotify player connection failed.",
    });

    await waitForDeviceId();

    return sdkPlayer;
  })();

  try {
    return await connectPromise;
  } finally {
    connectPromise = null;
  }
}

export async function bootstrapSpotifyPlayer() {
  if (!SpotifyAuth.hasStoredSession()) return null;
  return ensureSpotifyPlayer();
}

export function resetSpotifyPlayer() {
  clearProgressLoop();
  sdkPlayer?.disconnect();
  sdkPlayer = null;
  playerListenersAttached = false;
  connectPromise = null;
  setPlayerState({ ...initialState });
}

async function activateAndTransfer(play = true) {
  activateFromUserGesture();
  const player = await ensureSpotifyPlayer();
  const deviceId = getDeviceId() ?? (await waitForDeviceId());
  if (!player || !deviceId) return false;

  const availableDevice = await waitForSpotifyDevice(deviceId);
  if (!availableDevice) {
    throw new Error("Spotify has not made Misty's playback device available yet.");
  }

  try {
    await SpotifyAPI.transferPlayback(deviceId, play);
  } catch (error) {
    if (!isDeviceNotFoundError(error)) throw error;

    await waitForSpotifyDevice(deviceId, 10);
    await SpotifyAPI.transferPlayback(deviceId, play);
  }

  await waitForCurrentState();
  return true;
}

async function ensureActiveMistyPlayback(play = false) {
  const player = await ensureSpotifyPlayer();
  if (!player) return null;

  const deviceId = getDeviceId() ?? (await waitForDeviceId());
  if (!deviceId) {
    throw new Error("Spotify did not finish creating Misty's playback device yet.");
  }

  if (!useSpotifyPlayerStore.getState().isActive) {
    await activateAndTransfer(play);
  }

  return { player, deviceId };
}

export async function transferSpotifyPlaybackToMisty(play = true) {
  setPlayerState({ connecting: true, error: null });
  try {
    const transferred = await activateAndTransfer(play);
    if (!transferred) {
      const message = "Spotify player is not ready yet.";
      setPlayerState({ error: message });
      throw new Error(message);
    }
  } catch (error) {
    const message = getErrorMessage(error, "Could not move Spotify playback to Misty.");
    setPlayerState({ error: message });
    throw new Error(message);
  } finally {
    setPlayerState({ connecting: false });
  }
}

export async function toggleSpotifyPlayback() {
  activateFromUserGesture();
  setPlayerState({ connecting: true, error: null });
  try {
    const playback = await ensureActiveMistyPlayback(true);
    if (!playback) return;

    if (!useSpotifyPlayerStore.getState().isActive) {
      await waitForCurrentState();
      return;
    }

    await playback.player.togglePlay();
    await waitForCurrentState();
  } catch (error) {
    const message = getErrorMessage(error, "Spotify play/pause failed.");
    setPlayerState({ error: message });
    throw new Error(message);
  } finally {
    setPlayerState({ connecting: false });
  }
}

export async function playSpotifyPlayback() {
  activateFromUserGesture();
  setPlayerState({ connecting: true, error: null });
  try {
    const playback = await ensureActiveMistyPlayback(true);
    if (!playback) return;

    if (useSpotifyPlayerStore.getState().isPaused) {
      await playback.player.togglePlay();
    }

    await waitForCurrentState();
  } catch (error) {
    const message = getErrorMessage(error, "Spotify play failed.");
    setPlayerState({ error: message });
    throw new Error(message);
  } finally {
    setPlayerState({ connecting: false });
  }
}

export async function pauseSpotifyPlayback() {
  activateFromUserGesture();
  setPlayerState({ connecting: true, error: null });
  try {
    const playback = await ensureActiveMistyPlayback(false);
    if (!playback) return;

    if (!useSpotifyPlayerStore.getState().isPaused) {
      await playback.player.togglePlay();
    }

    await waitForCurrentState();
  } catch (error) {
    const message = getErrorMessage(error, "Spotify pause failed.");
    setPlayerState({ error: message });
    throw new Error(message);
  } finally {
    setPlayerState({ connecting: false });
  }
}

export async function nextSpotifyTrack() {
  activateFromUserGesture();
  setPlayerState({ connecting: true, error: null });
  try {
    const playback = await ensureActiveMistyPlayback(true);
    if (!playback) return;

    await playback.player.nextTrack();
    await waitForCurrentState();
  } catch (error) {
    const message = getErrorMessage(error, "Spotify next track failed.");
    setPlayerState({ error: message });
    throw new Error(message);
  } finally {
    setPlayerState({ connecting: false });
  }
}

export async function previousSpotifyTrack() {
  activateFromUserGesture();
  setPlayerState({ connecting: true, error: null });
  try {
    const playback = await ensureActiveMistyPlayback(true);
    if (!playback) return;

    await playback.player.previousTrack();
    await waitForCurrentState();
  } catch (error) {
    const message = getErrorMessage(error, "Spotify previous track failed.");
    setPlayerState({ error: message });
    throw new Error(message);
  } finally {
    setPlayerState({ connecting: false });
  }
}

export async function setSpotifyVolume(volume: number) {
  const clamped = Math.max(0, Math.min(1, volume));
  setPlayerState({ volume: clamped });
  try {
    const player = await ensureSpotifyPlayer();
    if (!player) return;

    await player.setVolume(clamped);
  } catch (error) {
    const message = getErrorMessage(error, "Spotify volume update failed.");
    setPlayerState({ error: message });
    throw new Error(message);
  }
}

export function useSpotifyPlayer() {
  const state = useSpotifyPlayerStore();

  return {
    ...state,
    initialize: bootstrapSpotifyPlayer,
    transferToMisty: transferSpotifyPlaybackToMisty,
    togglePlay: toggleSpotifyPlayback,
    play: playSpotifyPlayback,
    pause: pauseSpotifyPlayback,
    nextTrack: nextSpotifyTrack,
    previousTrack: previousSpotifyTrack,
    setVolume: setSpotifyVolume,
  };
}
