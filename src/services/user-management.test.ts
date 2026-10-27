import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.stubEnv("VITE_API_URL", "/api/v1");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("user management API", () => {
  it("includes the edited email and preserves the rest of the account input", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "staff", email: "new@example.com" }), {
        status: 200,
      }),
    );
    const { updateUser } = await import("./user-management");
    await updateUser("staff", {
      firstName: "Example",
      lastName: "User",
      email: " NEW@EXAMPLE.COM ",
      role: "BDO",
      active: true,
      productIds: ["product"],
    });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/users/staff");
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      firstName: "Example",
      lastName: "User",
      email: "new@example.com",
      role: "BDO",
      active: true,
      productIds: ["product"],
    });
  });
  it("sends an explicit replacement owner with a confirmed deletion", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const { deleteUserAccount } = await import("./user-management");
    await expect(deleteUserAccount("staff", "admin")).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/users/staff");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      replacementOwnerId: "admin",
    });
  });
  it("surfaces deletion protections rather than pretending the user was removed", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ detail: "You cannot delete your own account" }),
        { status: 409 },
      ),
    );
    const { deleteUserAccount } = await import("./user-management");
    await expect(deleteUserAccount("admin", "another-admin")).rejects.toThrow(
      "You cannot delete your own account",
    );
  });
});
