import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const payload = {
  version: 1,
  users: [],
  products: [],
  contacts: [],
  associations: [],
  leads: [],
  clients: [],
  followUps: [],
  campaigns: [],
  campaignRecipients: [],
  senders: [],
  signatures: [],
  audienceSegments: [],
  activities: [],
};
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
function success(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}
describe("frontend backend contracts", () => {
  it("renders an empty server workspace without adding demo records", async () => {
    fetchMock.mockResolvedValue(success(payload));
    const { api } = await import("./api");
    expect(await api.getDatabase("ignored-client-user-id")).toEqual(payload);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/workspace");
  });
  it("uses atomic bulk mutations and server-generated IDs", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(success({ id: "server-product" }));
    const { api } = await import("./api");
    await api.deleteContacts(["a", "b"], "unused-actor");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      contactIds: ["a", "b"],
    });
    expect(
      await api.addProduct(
        {
          name: "Integration product",
          code: "INTEGRATION",
          type: "Product",
          description: "",
          status: "Active",
          color: "#C1121F",
          ownerId: "owner",
        },
        "unused-actor",
      ),
    ).toBe("server-product");
    expect(
      fetchMock.mock.calls.every(
        ([, init]) => !String(init.body).includes("unused-actor"),
      ),
    ).toBe(true);
  });
  it("sends nullable optional campaign references and an explicit delivery choice", async () => {
    fetchMock
      .mockResolvedValueOnce(success({ id: "campaign" }))
      .mockResolvedValueOnce(success({ status: "Sending" }));
    const { api } = await import("./api");
    const { newCampaign } = await import("../lib/campaigns");
    await api.saveCampaign(
      { ...newCampaign("product"), name: "Campaign" },
      "unused-actor",
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.senderId).toBeNull();
    expect(body.signatureId).toBeNull();
    expect(body).not.toHaveProperty("attachments");
    await api.submitCampaign(
      "campaign",
      { mode: "now", delivery: "email", confirmed: true },
      "unused-actor",
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      mode: "email",
      confirm: true,
      scheduledAt: null,
    });
  });
  it("uses dedicated note and follow-up status routes without overwriting other fields", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(success({}));
    const { api } = await import("./api");
    await api.addNote("contact", "Notes", "unused-actor");
    await api.setFollowUpStatus("task", "Completed", "unused-actor");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/contacts/contact/notes");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      status: "Completed",
    });
  });
});

it("updates a saved signature through the authenticated backend route", async () => {
  fetchMock.mockResolvedValueOnce(
    success({
      id: "signature",
      html: '<img src="https://cdn.example.com/image.png">',
    }),
  );
  const { api } = await import("./api");
  const input = {
    name: "Personal",
    sourceFileName: "signature.html",
    html: '<img src="https://cdn.example.com/image.png">',
  };
  await api.updateSignature("signature", input);
  expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/signatures/signature");
  expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(input);
});
