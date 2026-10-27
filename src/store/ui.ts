import { create } from "zustand";
import { persist } from "zustand/middleware";
interface UIState {
  collapsed: boolean;
  userId: string | null;
  toggleSidebar: () => void;
  login: (id: string) => void;
  logout: () => void;
}
// Remove the obsolete browser database. It is never imported into the server.
if (localStorage.getItem("orbit-crm-demo-v1")) {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("ice-contact-views-")) localStorage.removeItem(key);
  }
}
localStorage.removeItem("orbit-crm-demo-v1");
localStorage.removeItem("orbit-recent-searches");
localStorage.removeItem("orbit-ui");
export const useUI = create<UIState>()(
  persist(
    (set) => ({
      collapsed: false,
      userId: null,
      toggleSidebar: () => set((s) => ({ collapsed: !s.collapsed })),
      login: (userId) => set({ userId }),
      logout: () => set({ userId: null }),
    }),
    {
      name: "ice-crm-ui",
      partialize: (state) => ({ collapsed: state.collapsed }),
    },
  ),
);
