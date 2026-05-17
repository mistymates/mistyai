const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const SPOTIFY_REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

const SPOTIFY_ACCESS_TOKEN_KEY = "spotify_access_token";
const SPOTIFY_REFRESH_TOKEN_KEY = "spotify_refresh_token";
const SPOTIFY_TOKEN_EXPIRES_KEY = "spotify_token_expires";
const SPOTIFY_CODE_VERIFIER_KEY = "spotify_code_verifier";
const SPOTIFY_AUTH_STATE_KEY = "spotify_auth_state";

export const SPOTIFY_AUTH_EVENT = "misty:spotify-auth-changed";

export interface SpotifyTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface SpotifySession {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  email?: string;
  images: Array<{ url: string; height?: number; width?: number }>;
  product?: string;
}

export interface SpotifyArtist {
  name: string;
}

export interface SpotifyTrack {
  id?: string;
  name: string;
  uri?: string;
  artists: SpotifyArtist[];
  album: {
    images: Array<{ url: string; height?: number; width?: number }>;
  };
}

export interface SpotifyPlaybackDevice {
  id: string | null;
  is_active: boolean;
  name: string;
  type: string;
  volume_percent?: number;
}

export interface SpotifyDevicesResponse {
  devices: SpotifyPlaybackDevice[];
}

export interface SpotifyPlayback {
  is_playing: boolean;
  progress_ms: number;
  item: SpotifyTrack | null;
  device?: SpotifyPlaybackDevice;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function emitSpotifyAuthChanged() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(SPOTIFY_AUTH_EVENT));
}

function getRedirectUri() {
  if (!isBrowser()) return "";
  return SPOTIFY_REDIRECT_URI?.trim() || `${window.location.origin}/callback`;
}

function toBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createRandomString(length: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join("");
}

async function createCodeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return toBase64Url(digest);
}

function getStoredExpiresAt() {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(SPOTIFY_TOKEN_EXPIRES_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function storeTokenExpiry(expiresInSeconds: number) {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  localStorage.setItem(SPOTIFY_TOKEN_EXPIRES_KEY, String(expiresAt));
  return expiresAt;
}

export class SpotifyAuth {
  static async login() {
    if (!isBrowser()) return;

    const verifier = createRandomString(64);
    const state = createRandomString(24);
    const challenge = await createCodeChallenge(verifier);
    const redirectUri = getRedirectUri();

    localStorage.setItem(SPOTIFY_CODE_VERIFIER_KEY, verifier);
    localStorage.setItem(SPOTIFY_AUTH_STATE_KEY, state);

    const scopes = [
      "streaming",
      "user-read-private",
      "user-read-email",
      "user-read-playback-state",
      "user-modify-playback-state",
      "user-read-currently-playing",
      "playlist-read-private",
      "playlist-read-collaborative",
      "playlist-modify-public",
      "playlist-modify-private",
    ].join(" ");

    const params = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: scopes,
      code_challenge_method: "S256",
      code_challenge: challenge,
      state,
      show_dialog: "true",
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  static logout() {
    if (!isBrowser()) return;
    localStorage.removeItem(SPOTIFY_ACCESS_TOKEN_KEY);
    localStorage.removeItem(SPOTIFY_REFRESH_TOKEN_KEY);
    localStorage.removeItem(SPOTIFY_TOKEN_EXPIRES_KEY);
    localStorage.removeItem(SPOTIFY_CODE_VERIFIER_KEY);
    localStorage.removeItem(SPOTIFY_AUTH_STATE_KEY);
    emitSpotifyAuthChanged();
  }

  static getSession(): SpotifySession {
    if (!isBrowser()) {
      return { accessToken: null, refreshToken: null, expiresAt: null };
    }

    return {
      accessToken: localStorage.getItem(SPOTIFY_ACCESS_TOKEN_KEY),
      refreshToken: localStorage.getItem(SPOTIFY_REFRESH_TOKEN_KEY),
      expiresAt: getStoredExpiresAt(),
    };
  }

  static hasStoredSession() {
    const session = this.getSession();
    return Boolean(session.refreshToken || session.accessToken);
  }

  static isLoggedIn() {
    const session = this.getSession();
    return Boolean(session.accessToken && session.expiresAt && Date.now() < session.expiresAt);
  }

  static consumePkceVerifier(expectedState: string | null) {
    if (!isBrowser()) return null;

    const savedState = localStorage.getItem(SPOTIFY_AUTH_STATE_KEY);
    const verifier = localStorage.getItem(SPOTIFY_CODE_VERIFIER_KEY);

    localStorage.removeItem(SPOTIFY_AUTH_STATE_KEY);
    localStorage.removeItem(SPOTIFY_CODE_VERIFIER_KEY);

    if (!expectedState || !savedState || expectedState !== savedState || !verifier) {
      return null;
    }

    return verifier;
  }

  static async refreshAccessToken(refreshToken: string): Promise<SpotifyTokens | null> {
    try {
      const response = await fetch("/api/spotify/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) return null;
      return (await response.json()) as SpotifyTokens;
    } catch (error) {
      console.error("Spotify token refresh failed:", error);
      return null;
    }
  }

  static storeTokens(tokens: SpotifyTokens) {
    if (!isBrowser()) return;

    const existingRefreshToken = localStorage.getItem(SPOTIFY_REFRESH_TOKEN_KEY);
    localStorage.setItem(SPOTIFY_ACCESS_TOKEN_KEY, tokens.access_token);

    const refreshTokenToStore = tokens.refresh_token ?? existingRefreshToken;
    if (refreshTokenToStore) {
      localStorage.setItem(SPOTIFY_REFRESH_TOKEN_KEY, refreshTokenToStore);
    }

    storeTokenExpiry(tokens.expires_in);
    emitSpotifyAuthChanged();
  }

  static async getValidAccessToken(): Promise<string | null> {
    const session = this.getSession();

    if (session.accessToken && session.expiresAt && Date.now() < session.expiresAt) {
      return session.accessToken;
    }

    if (!session.refreshToken) {
      return null;
    }

    try {
      const refreshed = await this.refreshAccessToken(session.refreshToken);
      if (!refreshed?.access_token) {
        this.logout();
        return null;
      }

      this.storeTokens(refreshed);
      return refreshed.access_token;
    } catch (error) {
      console.error("Failed to refresh Spotify access token:", error);
      this.logout();
      return null;
    }
  }
}

export class SpotifyAPI {
  static async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
    const token = await SpotifyAuth.getValidAccessToken();
    if (!token) {
      throw new Error("No valid Spotify access token");
    }

    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (response.status === 204 || response.status === 202) {
      return null;
    }

    if (response.status === 401) {
      SpotifyAuth.logout();
      throw new Error("Spotify session expired");
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Spotify API error ${response.status}${body ? `: ${body}` : ""}`);
    }

    return (await response.json()) as T;
  }

  static async getCurrentUser() {
    return this.apiCall<SpotifyUser>("/me");
  }

  static async getCurrentPlayback() {
    return this.apiCall<SpotifyPlayback>("/me/player");
  }

  static async getDevices() {
    return this.apiCall<SpotifyDevicesResponse>("/me/player/devices");
  }

  static async playTrack(trackUri: string, deviceId?: string) {
    const endpoint = deviceId
      ? `/me/player/play?device_id=${encodeURIComponent(deviceId)}`
      : "/me/player/play";
    await this.apiCall(endpoint, {
      method: "PUT",
      body: JSON.stringify({ uris: [trackUri] }),
    });
  }

  static async pausePlayback(deviceId?: string) {
    const endpoint = deviceId
      ? `/me/player/pause?device_id=${encodeURIComponent(deviceId)}`
      : "/me/player/pause";
    await this.apiCall(endpoint, { method: "PUT" });
  }

  static async resumePlayback(deviceId?: string) {
    const endpoint = deviceId
      ? `/me/player/play?device_id=${encodeURIComponent(deviceId)}`
      : "/me/player/play";
    await this.apiCall(endpoint, { method: "PUT" });
  }

  static async nextTrack(deviceId?: string) {
    const endpoint = deviceId
      ? `/me/player/next?device_id=${encodeURIComponent(deviceId)}`
      : "/me/player/next";
    await this.apiCall(endpoint, { method: "POST" });
  }

  static async previousTrack(deviceId?: string) {
    const endpoint = deviceId
      ? `/me/player/previous?device_id=${encodeURIComponent(deviceId)}`
      : "/me/player/previous";
    await this.apiCall(endpoint, { method: "POST" });
  }

  static async transferPlayback(deviceId: string, play = false) {
    await this.apiCall("/me/player", {
      method: "PUT",
      body: JSON.stringify({
        device_ids: [deviceId],
        play,
      }),
    });
  }

  static async setVolume(volumePercent: number, deviceId?: string) {
    const clamped = Math.max(0, Math.min(100, Math.round(volumePercent)));
    const params = new URLSearchParams({ volume_percent: String(clamped) });
    if (deviceId) params.set("device_id", deviceId);
    await this.apiCall(`/me/player/volume?${params.toString()}`, { method: "PUT" });
  }

  static async searchTracks(query: string, limit = 20) {
    const params = new URLSearchParams({
      q: query,
      type: "track",
      limit: String(limit),
    });
    return this.apiCall<{ tracks: { items: SpotifyTrack[] } }>(`/search?${params.toString()}`);
  }
}
