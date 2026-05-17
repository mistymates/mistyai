import { create } from "zustand";
import { persist } from "zustand/middleware";

interface GoogleAuthState {
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useGoogleAuthStore = create<GoogleAuthState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token }),
      logout: () => set({ token: null }),
    }),
    {
      name: "google-auth-storage",
    },
  ),
);
