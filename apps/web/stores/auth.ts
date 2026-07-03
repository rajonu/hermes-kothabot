import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import type { Shop } from "@/lib/supabase/types";

interface AuthState {
  user: User | null;
  shop: Shop | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setShop: (shop: Shop | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  shop: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setShop: (shop) => set({ shop }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ user: null, shop: null, isLoading: false }),
}));
