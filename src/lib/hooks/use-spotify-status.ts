import { useCallback, useEffect, useState } from "react";
import {
  SPOTIFY_AUTH_EVENT,
  SpotifyAPI,
  SpotifyAuth,
  type SpotifyTrack,
  type SpotifyUser,
} from "@/lib/spotify";

export function useSpotifyStatus() {
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!SpotifyAuth.hasStoredSession()) {
      setIsConnected(false);
      setUser(null);
      setCurrentTrack(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const accessToken = await SpotifyAuth.getValidAccessToken();
      if (!accessToken) {
        setIsConnected(false);
        setUser(null);
        setCurrentTrack(null);
        setLoading(false);
        return;
      }

      const userData = await SpotifyAPI.getCurrentUser();
      setUser(userData);
      setIsConnected(true);

      try {
        const playback = await SpotifyAPI.getCurrentPlayback();
        setCurrentTrack(playback?.item ?? null);
      } catch (playbackError) {
        console.error("Failed to fetch Spotify playback:", playbackError);
        setCurrentTrack(null);
      }
    } catch (sessionError) {
      console.error("Failed to restore Spotify session:", sessionError);
      SpotifyAuth.logout();
      setIsConnected(false);
      setUser(null);
      setCurrentTrack(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const onAuthChanged = () => void refresh();
    const onFocus = () => void refresh();

    window.addEventListener(SPOTIFY_AUTH_EVENT, onAuthChanged);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener(SPOTIFY_AUTH_EVENT, onAuthChanged);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!isConnected) return;

    const intervalId = window.setInterval(() => {
      void refresh();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [isConnected, refresh]);

  return {
    isConnected,
    user,
    currentTrack,
    loading,
    refresh,
  };
}
