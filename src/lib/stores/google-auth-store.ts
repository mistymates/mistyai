import { create } from "zustand";
import { persist } from "zustand/middleware";

interface GoogleAuthState {
  token: string | null;
  expiresAt: number | null;
  setToken: (token: string | null, expiresInSeconds?: number) => void;
  clearExpiredToken: () => void;
  logout: () => void;
}

const DEFAULT_TOKEN_LIFETIME_SECONDS = 3600;

export const useGoogleAuthStore = create<GoogleAuthState>()(
  persist(
    (set, get) => ({
      token: null,
      expiresAt: null,
      setToken: (token, expiresInSeconds = DEFAULT_TOKEN_LIFETIME_SECONDS) =>
        set({
          token,
          expiresAt: token ? Date.now() + expiresInSeconds * 1000 : null,
        }),
      clearExpiredToken: () => {
        const { token, expiresAt } = get();
        if (token && (!expiresAt || expiresAt <= Date.now())) {
          set({ token: null, expiresAt: null });
        }
      },
      logout: () => set({ token: null, expiresAt: null }),
    }),
    {
      name: "google-auth-storage",
      partialize: (state) => ({ expiresAt: state.expiresAt }),
    },
  ),
);
