import type { User } from "../types";

export const API_BASE_URL = (import.meta.env.VITE_API_URL || "/api/v1").replace(
  /\/$/,
  "",
);
const REFRESH_KEY = "ice-crm-refresh-token";
let accessToken: string | null = null;
let refreshToken: string | null = sessionStorage.getItem(REFRESH_KEY);
let refreshFlight: Promise<User> | null = null;
let generation = 0;
const expiryListeners = new Set<() => void>();

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}
function saveSession(result: AuthResponse) {
  accessToken = result.accessToken;
  refreshToken = result.refreshToken;
  sessionStorage.setItem(REFRESH_KEY, result.refreshToken);
}
export function clearSession() {
  generation++;
  refreshFlight = null;
  accessToken = null;
  refreshToken = null;
  sessionStorage.removeItem(REFRESH_KEY);
  for (const listener of expiryListeners) listener();
}
export function onSessionExpired(listener: () => void) {
  expiryListeners.add(listener);
  return () => {
    expiryListeners.delete(listener);
  };
}
async function decode<T>(response: Response): Promise<T> {
  if (response.ok) {
    if (response.status === 204) return undefined as T;
    return response.json();
  }
  let message = `Request failed (${response.status}).`;
  try {
    const body = await response.json();
    if (typeof body.detail === "string") message = body.detail;
    else if (Array.isArray(body.detail))
      message = body.detail
        .map(
          (entry: { loc?: string[]; msg: string }) =>
            `${entry.loc?.filter((part) => part !== "body").join(".") || "Input"}: ${entry.msg}`,
        )
        .join("; ");
  } catch {
    /* Proxies may return an HTML error page. */
  }
  throw new ApiError(response.status, message);
}
async function send(
  path: string,
  init: RequestInit = {},
  token?: string | null,
) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      credentials: "omit",
    });
  } catch {
    throw new Error(
      "Cannot reach the CRM server. Check your connection and try again.",
    );
  }
}
export async function signIn(email: string, password: string) {
  const epoch = ++generation;
  const response = await decode<AuthResponse>(
    await send("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  );
  if (epoch !== generation)
    throw new Error("Sign-in was cancelled. Please try again.");
  saveSession(response);
  return response.user;
}
export function restoreSession(): Promise<User> {
  if (refreshFlight) return refreshFlight;
  if (!refreshToken)
    return Promise.reject(new ApiError(401, "Please sign in."));
  const epoch = generation;
  const token = refreshToken;
  const flight = (async () => {
    try {
      const result = await decode<AuthResponse>(
        await send("/auth/refresh", {
          method: "POST",
          body: JSON.stringify({ refreshToken: token }),
        }),
      );
      if (generation !== epoch)
        throw new ApiError(401, "Session ended. Please sign in.");
      saveSession(result);
      return result.user;
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        generation === epoch
      )
        clearSession();
      throw error;
    }
  })();
  refreshFlight = flight;
  void flight
    .finally(() => {
      if (refreshFlight === flight) refreshFlight = null;
    })
    .catch(() => {});
  return flight;
}
export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const epoch = generation;
  const token = accessToken;
  let response = await send(path, init, token);
  if (response.status === 401 && refreshToken && epoch === generation) {
    // Another request may already have rotated the session while this response was in flight.
    if (accessToken === token) await restoreSession();
    if (epoch !== generation)
      throw new ApiError(401, "Session ended. Please sign in.");
    response = await send(path, init, accessToken);
  }
  if (epoch !== generation)
    throw new ApiError(401, "Session ended. Please sign in.");
  if (response.status === 401) clearSession();
  return decode<T>(response);
}
export async function signOut() {
  try {
    await request<void>("/auth/logout", { method: "POST" });
  } finally {
    clearSession();
  }
}
export const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export async function verifyInvitation(token: string) {
  return decode<{ valid: boolean }>(
    await send("/auth/invitations/verify", json("POST", { token })),
  );
}
export async function activateAccount(
  token: string,
  password: string,
  confirmPassword: string,
) {
  const result = await decode<AuthResponse>(
    await send(
      "/auth/invitations/accept",
      json("POST", { token, password, confirmPassword }),
    ),
  );
  clearSession();
  saveSession(result);
  return result.user;
}
