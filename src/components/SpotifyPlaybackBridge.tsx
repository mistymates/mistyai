import { useEffect } from "react";
import { SPOTIFY_AUTH_EVENT, SpotifyAuth } from "@/lib/spotify";
import { bootstrapSpotifyPlayer, resetSpotifyPlayer } from "@/lib/spotify-player";

export function SpotifyPlaybackBridge() {
  useEffect(() => {
    if (SpotifyAuth.hasStoredSession()) {
      void bootstrapSpotifyPlayer();
    }

    const onAuthChanged = () => {
      if (SpotifyAuth.hasStoredSession()) {
        void bootstrapSpotifyPlayer();
      } else {
        resetSpotifyPlayer();
      }
    };

    window.addEventListener(SPOTIFY_AUTH_EVENT, onAuthChanged);
    return () => window.removeEventListener(SPOTIFY_AUTH_EVENT, onAuthChanged);
  }, []);

  return null;
}
