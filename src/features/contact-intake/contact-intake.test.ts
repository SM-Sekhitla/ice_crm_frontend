// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import * as Tooltip from "@radix-ui/react-tooltip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { intakeToken } from "./links";
import { canEditContact } from "../../lib/permissions";
import type { Database, User } from "../../types";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  submit: vi.fn(),
  request: vi.fn(),
  qr: vi.fn(),
}));
vi.mock("../../services/http", () => ({
  verifyContactIntake: mocks.verify,
  submitContactIntake: mocks.submit,
  request: mocks.request,
  json: (method: string, body: unknown) => ({
    method,
    body: JSON.stringify(body),
  }),
}));
vi.mock("../../app/context", () => ({
  useCRM: () => ({ user: { id: "bdo", firstName: "Alex", lastName: "Smith" } }),
}));
vi.mock("qrcode", () => ({ toDataURL: mocks.qr }));
let root: Root;
let container: HTMLDivElement;
const TOKEN = "A".repeat(64);
beforeEach(() => {
  vi.clearAllMocks();
  window.location.hash = `token=${TOKEN}`;
  mocks.verify.mockResolvedValue({ available: true });
  mocks.submit.mockResolvedValue({ message: "Received" });
  mocks.qr.mockResolvedValue("data:image/png;base64,test");
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
async function renderForm() {
  const { PublicContactForm } = await import("./PublicContactForm");
  await act(async () => root.render(createElement(PublicContactForm)));
}
describe("public contact collection", () => {
  it("reads valid QR fragment tokens, rejecting missing or malformed links", () => {
    expect(intakeToken(`#token=${TOKEN}`)).toBe(TOKEN);
    for (const hash of [
      "",
      "#token=short",
      "#token=<script>",
      `#token=${TOKEN}!`,
    ])
      expect(intakeToken(hash)).toBe("");
  });
  it("opens a standalone form with exactly six fields and no workspace navigation", async () => {
    await renderForm();
    expect(mocks.verify).toHaveBeenCalledWith(TOKEN);
    expect(
      Array.from(container.querySelectorAll("input")).map(
        (input) => input.name,
      ),
    ).toEqual([
      "firstName",
      "lastName",
      "email",
      "phone",
      "company",
      "jobTitle",
    ]);
    expect(container.querySelectorAll("input[required]")).toHaveLength(3);
    expect(container.querySelector("nav")).toBeNull();
    expect(container.querySelector('input[type="password"]')).toBeNull();
  });
  it("submits the six trimmed fields and shows confirmation without exposing contact IDs", async () => {
    await renderForm();
    for (const [name, value] of Object.entries({
      firstName: " Alex ",
      lastName: "Smith",
      email: "alex@example.com",
      phone: "+27 712345678",
      company: "ICE",
      jobTitle: "Director",
    }))
      container.querySelector<HTMLInputElement>(
        `input[name="${name}"]`,
      )!.value = value;
    await act(async () =>
      container
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(mocks.submit).toHaveBeenCalledExactlyOnceWith(TOKEN, {
      firstName: "Alex",
      lastName: "Smith",
      email: "alex@example.com",
      phone: "+27 712345678",
      company: "ICE",
      jobTitle: "Director",
    });
    expect(container.querySelector("form")).toBeNull();
    expect(container.textContent).toContain("Your details have been received");
  });
  it("rejects disabled links and retains entered fields when submission fails", async () => {
    mocks.verify.mockRejectedValueOnce(new Error("Form unavailable"));
    await renderForm();
    expect(container.querySelector("form")).toBeNull();
    expect(container.textContent).toContain("Form unavailable");
    await act(async () => root.unmount());
    root = createRoot(container);
    mocks.verify.mockResolvedValue({ available: true });
    mocks.submit.mockRejectedValueOnce(new Error("Please try again shortly"));
    await renderForm();
    container.querySelector<HTMLInputElement>(
      'input[name="firstName"]',
    )!.value = "Alex";
    await act(async () =>
      container
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Please try again shortly",
    );
    expect(
      container.querySelector<HTMLInputElement>('input[name="firstName"]')
        ?.value,
    ).toBe("Alex");
  });
  it("allows a BDO to edit their QR captures while retaining other contact write boundaries", () => {
    const user = { id: "bdo", role: "BDO", productIds: [] } as unknown as User;
    const db = {
      contacts: [
        { id: "mine", capturedBy: "bdo" },
        { id: "other", capturedBy: "someone" },
      ],
      associations: [],
    } as unknown as Database;
    expect(canEditContact(user, db, "mine")).toBe(true);
    expect(canEditContact(user, db, "other")).toBe(false);
  });
  it("draws the owner's exact link locally and disables it only after confirmation", async () => {
    const url = `https://crm.example.com/connect#token=${TOKEN}`;
    mocks.request.mockResolvedValue({ enabled: true, url });
    const { ContactQrButton } = await import("./ContactQr");
    await act(async () =>
      root.render(
        createElement(Tooltip.Provider, null, createElement(ContactQrButton)),
      ),
    );
    await act(async () => container.querySelector("button")!.click());
    // Modal is portalled to the document body.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mocks.qr).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ margin: 4, errorCorrectionLevel: "M" }),
    );
    const disable = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === "Disable link",
    )!;
    await act(async () => disable.click());
    expect(mocks.request).not.toHaveBeenCalledWith(
      "/contact-intake-link",
      expect.objectContaining({ method: "DELETE" }),
    );
    const confirmations = Array.from(
      document.querySelectorAll("button"),
    ).filter((button) => button.textContent === "Disable link");
    await act(async () => confirmations[confirmations.length - 1].click());
    expect(mocks.request).toHaveBeenCalledWith(
      "/contact-intake-link",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(document.body.textContent).toContain("Generate my QR code");
  });
});
