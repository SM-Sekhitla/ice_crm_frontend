import type { User } from "../types";
import { json, request } from "./http";

export interface UserUpdateInput {
  firstName: string;
  lastName: string;
  email: string;
  role: User["role"];
  active: boolean;
  productIds: string[];
}
export function updateUser(id: string, input: UserUpdateInput) {
  return request<User>(
    `/users/${encodeURIComponent(id)}`,
    json("PUT", { ...input, email: input.email.trim().toLowerCase() }),
  );
}
export function deleteUserAccount(id: string, replacementOwnerId: string) {
  return request<void>(
    `/users/${encodeURIComponent(id)}`,
    json("DELETE", { replacementOwnerId }),
  );
}
