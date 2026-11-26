import { create } from "zustand";
import { apiFetch, registerUnauthorizedHandler } from "../lib/api-client";
import { tokenStorage } from "../lib/token-storage";

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearLocal: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isHydrated: false,

  clearLocal: () => set({ user: null }),

  hydrate: async () => {
    try {
      const token = await tokenStorage.getAccessToken();
      if (!token) {
        set({ user: null, isHydrated: true });
        return;
      }
      const user = await apiFetch<AuthUser>("/auth/me");
      set({ user, isHydrated: true });
    } catch {
      await tokenStorage.clear();
      set({ user: null, isHydrated: true });
    }
  },

  login: async (username, password) => {
    const tokens = await apiFetch<{
      accessToken: string;
      refreshToken: string;
    }>("/auth/login", {
      method: "POST",
      body: { username, password },
      skipAuth: true,
    });
    await tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
    const user = await apiFetch<AuthUser>("/auth/me");
    console.log(user);
    set({ user });
  },

  logout: async () => {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (refreshToken) {
      await apiFetch("/auth/logout", {
        method: "POST",
        body: { refreshToken },
        skipAuth: true,
      }).catch(() => {});
    }
    await tokenStorage.clear();
    set({ user: null });
  },
}));

registerUnauthorizedHandler(() => {
  useAuthStore.getState().clearLocal();
});
