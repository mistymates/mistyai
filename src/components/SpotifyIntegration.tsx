import { Music4, Loader2 } from "lucide-react";
import { SpotifyAuth } from "@/lib/spotify";
import { useSpotifyStatus } from "@/lib/hooks/use-spotify-status";

export function SpotifyIntegration() {
  const { isConnected, user, currentTrack, loading } = useSpotifyStatus();

  const handleLogin = () => {
    void SpotifyAuth.login();
  };

  const handleLogout = () => {
    SpotifyAuth.logout();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-[color:var(--accent)]" />
        <span>Checking Spotify...</span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <button
        type="button"
        onClick={handleLogin}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-white/10"
      >
        <Music4 className="h-4 w-4 text-[color:var(--accent)]" />
        Connect Spotify
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
        <div className="flex min-w-0 items-center gap-3">
          {user?.images?.[0]?.url ? (
            <img
              src={user.images[0].url}
              alt={user.display_name}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[color:var(--violet)]/40 to-[color:var(--cyan)]/40">
              <Music4 className="h-4 w-4 text-foreground/80" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {user?.display_name || "Spotify connected"}
            </p>
            <p className="text-xs text-muted-foreground">
              {user?.product === "premium" ? "Spotify Premium connected" : "Spotify connected"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="text-xs text-muted-foreground transition hover:text-foreground"
        >
          Disconnect
        </button>
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Playback</p>
        {currentTrack ? (
          <div className="mt-2 flex items-center gap-3">
            {currentTrack.album.images?.[0]?.url ? (
              <img
                src={currentTrack.album.images[0].url}
                alt={currentTrack.name}
                className="h-12 w-12 rounded-xl object-cover"
              />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/5">
                <Music4 className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{currentTrack.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {currentTrack.artists?.map((artist) => artist.name).join(", ") || "Unknown artist"}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Spotify is connected. Start something on Spotify or move playback into Misty.
          </p>
        )}
      </div>
    </div>
  );
}
