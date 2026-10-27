import { createContext, useContext } from "react";
import type { Database, User } from "../types";
export interface AppContextValue {
  db: Database;
  user: User;
  refresh: () => Promise<void>;
  addContact: () => void;
  openContact: (id: string) => void;
}
export const AppContext = createContext<AppContextValue | null>(null);
export function useCRM() {
  const value = useContext(AppContext);
  if (!value) throw new Error("CRM context unavailable");
  return value;
}
