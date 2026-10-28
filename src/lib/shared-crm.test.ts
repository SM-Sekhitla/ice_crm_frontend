import { describe, expect, it } from "vitest";
import {
  canEditContact,
  canManageAssociation,
  scopeDatabase,
} from "./permissions";
import type { Database, User } from "../types";

const user: User = {
  id: "bdo",
  firstName: "Alex",
  lastName: "User",
  email: "alex@example.com",
  role: "BDO",
  productIds: ["assigned"],
};
const db = {
  products: [{ id: "assigned" }, { id: "unassigned" }],
  contacts: [{ id: "own" }, { id: "other" }, { id: "unlinked" }],
  associations: [
    { id: "own-rel", contactId: "own", ownerId: "bdo", productId: "assigned" },
    {
      id: "other-rel",
      contactId: "other",
      ownerId: "other-user",
      productId: "unassigned",
    },
  ],
  leads: [{ id: "lead", associationId: "other-rel" }],
  clients: [{ id: "client", associationId: "other-rel" }],
  followUps: [{ id: "task", associationId: "other-rel" }],
  campaigns: [
    { id: "own-campaign", createdBy: "bdo", productId: "assigned" },
    {
      id: "private-campaign",
      createdBy: "other-user",
      productId: "unassigned",
    },
  ],
  campaignRecipients: [{ id: "recipient", campaignId: "private-campaign" }],
  audienceSegments: [],
  signatures: [],
  senders: [],
  activities: [
    {
      id: "shared-history",
      contactId: "other",
      productId: "unassigned",
      userId: "other-user",
    },
    { id: "private-admin-history", productId: null, userId: "other-user" },
  ],
} as unknown as Database;

describe("shared CRM visibility", () => {
  it("retains every contact, lead, client and display reference for a BDO", () => {
    const shared = scopeDatabase(db, user);
    for (const key of [
      "contacts",
      "associations",
      "leads",
      "clients",
      "products",
      "followUps",
    ] as const) {
      expect(shared[key]).toEqual(db[key]);
    }
  });
  it("keeps unrelated campaigns and administration history restricted", () => {
    const shared = scopeDatabase(db, user);
    expect(shared.campaigns.map((item) => item.id)).toEqual(["own-campaign"]);
    expect(shared.campaignRecipients).toEqual([]);
    expect(shared.activities.map((item) => item.id)).toEqual([
      "shared-history",
    ]);
  });
  it("does not grant write access to another owner's relationships", () => {
    expect(canManageAssociation(user, db.associations[0])).toBe(true);
    expect(canManageAssociation(user, db.associations[1])).toBe(false);
    expect(canEditContact(user, db, "own")).toBe(true);
    expect(canEditContact(user, db, "other")).toBe(false);
    expect(canEditContact(user, db, "unlinked")).toBe(false);
  });
  it("retains Super Admin management access", () => {
    const admin = { ...user, role: "Super Admin" as const };
    expect(scopeDatabase(db, admin)).toBe(db);
    expect(canEditContact(admin, db, "other")).toBe(true);
    expect(canManageAssociation(admin, db.associations[1])).toBe(true);
  });
});
