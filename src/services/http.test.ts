import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const user = {
  id: "test-user",
  firstName: "Test",
  lastName: "User",
  email: "test@example.com",
  role: "BDO",
  productIds: [],
};
function tokens(accessToken = "access", refreshToken = "refresh") {
  return { accessToken, refreshToken, user };
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
let storage: Map<string, string>;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules();
  storage = new Map();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("VITE_API_URL", "http://crm.test/api/v1");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("real API session transport", () => {
  it("authenticates against the server and sends bearer headers without cookies", async () => {
    fetchMock
      .mockResolvedValueOnce(response(tokens()))
      .mockResolvedValueOnce(response({ id: "test-user" }));
    const http = await import("./http");
    await expect(http.signIn(user.email, "password")).resolves.toEqual(user);
    await http.request("/auth/me");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://crm.test/api/v1/auth/login",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: user.email,
      password: "password",
    });
    expect(fetchMock.mock.calls[1][1].headers.get("Authorization")).toBe(
      "Bearer access",
    );
    expect(fetchMock.mock.calls[1][1].credentials).toBe("omit");
    expect([...storage.keys()]).toEqual(["ice-crm-refresh-token"]);
    expect(storage.get("ice-crm-refresh-token")).toBe("refresh");
  });
  it("shares refresh rotation between concurrent expired requests", async () => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith("/login")) return response(tokens());
      if (url.endsWith("/refresh")) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return response(tokens("new-access", "new-refresh"));
      }
      const authorization = new Headers(init.headers).get("Authorization");
      return authorization === "Bearer new-access"
        ? response({ ok: true })
        : response({ detail: "expired" }, 401);
    });
    const http = await import("./http");
    await http.signIn(user.email, "password");
    expect(
      await Promise.all([
        http.request("/workspace"),
        http.request("/workspace"),
      ]),
    ).toEqual([{ ok: true }, { ok: true }]);
    expect(
      fetchMock.mock.calls.filter(([url]) => url.endsWith("/refresh")),
    ).toHaveLength(1);
    expect(storage.get("ice-crm-refresh-token")).toBe("new-refresh");
  });
  it("restores a session from its refresh token after reload", async () => {
    storage.set("ice-crm-refresh-token", "existing-refresh");
    fetchMock.mockResolvedValueOnce(response(tokens("restored", "rotated")));
    const http = await import("./http");
    await expect(http.restoreSession()).resolves.toEqual(user);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      refreshToken: "existing-refresh",
    });
    expect(storage.get("ice-crm-refresh-token")).toBe("rotated");
  });
  it("clears rejected sessions and reports field errors without a local fallback", async () => {
    fetchMock
      .mockResolvedValueOnce(response(tokens()))
      .mockResolvedValueOnce(response({ detail: "expired" }, 401))
      .mockResolvedValueOnce(response({ detail: "revoked" }, 401));
    const http = await import("./http");
    const expired = vi.fn();
    http.onSessionExpired(expired);
    await http.signIn(user.email, "password");
    await expect(http.request("/workspace")).rejects.toMatchObject({
      status: 401,
    });
    expect(storage.size).toBe(0);
    expect(expired).toHaveBeenCalledOnce();
    fetchMock.mockResolvedValueOnce(
      response(
        { detail: [{ loc: ["body", "email"], msg: "Invalid email" }] },
        422,
      ),
    );
    await expect(http.request("/contacts")).rejects.toThrow(
      "email: Invalid email",
    );
  });
  it("reports server outages rather than manufacturing records", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    const http = await import("./http");
    await expect(http.request("/workspace")).rejects.toThrow(
      "Cannot reach the CRM server",
    );
  });
  it("revokes the server session and clears local credentials on logout", async () => {
    fetchMock
      .mockResolvedValueOnce(response(tokens()))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const http = await import("./http");
    await http.signIn(user.email, "password");
    await http.signOut();
    expect(fetchMock.mock.calls[1][0]).toBe(
      "http://crm.test/api/v1/auth/logout",
    );
    expect(storage.size).toBe(0);
  });
  it("does not restore credentials from a refresh that finishes after logout", async () => {
    storage.set("ice-crm-refresh-token", "old");
    let complete!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        }),
    );
    const http = await import("./http");
    const pending = http.restoreSession();
    http.clearSession();
    complete(response(tokens()));
    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(storage.size).toBe(0);
  });
});

it("verifies an invitation without putting its token in the URL or sending session credentials", async () => {
  fetchMock.mockResolvedValueOnce(response({ valid: true }));
  const http = await import("./http");
  const token = "one-time-invitation-token";
  await expect(http.verifyInvitation(token)).resolves.toEqual({ valid: true });
  expect(fetchMock.mock.calls[0][0]).toBe(
    "http://crm.test/api/v1/auth/invitations/verify",
  );
  expect(fetchMock.mock.calls[0][0]).not.toContain(token);
  expect(fetchMock.mock.calls[0][1].headers.get("Authorization")).toBeNull();
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ token });
});

it("adopts the invited user's session and clears the previous workspace after activation", async () => {
  const invitedUser = {
    ...user,
    id: "invited-user",
    onboardingCompleted: false,
  };
  fetchMock
    .mockResolvedValueOnce(response(tokens()))
    .mockResolvedValueOnce(
      response({
        accessToken: "invited-access",
        refreshToken: "invited-refresh",
        user: invitedUser,
      }),
    )
    .mockResolvedValueOnce(response({ ok: true }));
  const http = await import("./http");
  await http.signIn(user.email, "password");
  const clearPreviousWorkspace = vi.fn();
  http.onSessionExpired(clearPreviousWorkspace);
  await expect(
    http.activateAccount(
      "invitation-token",
      "NewPassword2026!",
      "NewPassword2026!",
    ),
  ).resolves.toEqual(invitedUser);
  expect(clearPreviousWorkspace).toHaveBeenCalledOnce();
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
    token: "invitation-token",
    password: "NewPassword2026!",
    confirmPassword: "NewPassword2026!",
  });
  expect(fetchMock.mock.calls[1][1].headers.get("Authorization")).toBeNull();
  await http.request("/workspace");
  expect(fetchMock.mock.calls[2][1].headers.get("Authorization")).toBe(
    "Bearer invited-access",
  );
  expect([...storage.entries()]).toEqual([
    ["ice-crm-refresh-token", "invited-refresh"],
  ]);
});

it("rejects used or expired invitations without creating a session", async () => {
  fetchMock.mockResolvedValueOnce(
    response({ detail: "Invitation expired" }, 400),
  );
  const http = await import("./http");
  await expect(
    http.activateAccount("old-token", "NewPassword2026!", "NewPassword2026!"),
  ).rejects.toMatchObject({ status: 400 });
  expect(storage.size).toBe(0);
});
