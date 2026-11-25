import { describe, expect, it } from "vitest";
import { audience } from "./campaigns";
import type { Database, User } from "../types";
const user = { id: "bdo", role: "BDO", productIds: ["product"] } as User;
const db = {
  contacts: [
    {
      id: "contact",
      email: "person@example.com",
      consent: true,
      doNotEmail: false,
    },
  ],
  associations: [
    { contactId: "contact", productId: "product", ownerId: "other" },
  ],
  campaigns: [],
  audienceSegments: [],
  signatures: [],
  campaignRecipients: [],
  senders: [],
  activities: [],
  users: [],
  products: [],
} as unknown as Database;
describe("shared campaign audience", () => {
  it("allows contacts owned by another user with product access", () => {
    expect(audience(db, user, "product")[0]).toMatchObject({
      eligible: true,
      reason: "",
    });
  });
  it("excludes users without product access", () => {
    expect(
      audience(db, { ...user, productIds: [] }, "product")[0].eligible,
    ).toBe(false);
  });
  it("permits own relationships and admin access", () => {
    expect(audience(db, { ...user, id: "other" }, "product")[0].eligible).toBe(
      true,
    );
    expect(
      audience(db, { ...user, role: "Super Admin" }, "product")[0].eligible,
    ).toBe(true);
  });
  it("retains do-not-email and consent exclusions", () => {
    const own = { ...user, id: "other" };
    expect(
      audience(
        { ...db, contacts: [{ ...db.contacts[0], consent: false }] },
        own,
        "product",
      )[0].eligible,
    ).toBe(false);
    expect(
      audience(
        { ...db, contacts: [{ ...db.contacts[0], doNotEmail: true }] },
        own,
        "product",
      )[0].eligible,
    ).toBe(false);
  });
});
