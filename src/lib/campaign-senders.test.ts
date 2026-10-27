import { describe, expect, it } from "vitest";
import { allowedSenders, tokensFor } from "./campaigns";
import type { Database, User, Contact } from "../types";
import type { SenderConfiguration } from "../types/campaigns";
const user: User = {
  id: "bdo",
  firstName: "Example",
  lastName: "User",
  email: "bdo@example.com",
  role: "BDO",
  productIds: ["soma"],
};
const sender: SenderConfiguration = {
  id: "selected",
  name: "Campaign sender",
  senderName: "Selected sender",
  email: "selected@example.com",
  replyTo: "reply@example.com",
  provider: "BREVO",
  status: "Verified",
  productIds: ["soma"],
  userIds: ["bdo"],
};
function workspace(): Database {
  return {
    version: 1,
    emailProvider: "brevo",
    emailDeliveryEnabled: true,
    brevoFromEmail: "default@example.com",
    brevoFromName: "Default invitation sender",
    users: [user],
    products: [],
    contacts: [],
    associations: [],
    leads: [],
    clients: [],
    activities: [],
    campaigns: [],
    campaignRecipients: [],
    senders: [sender],
    signatures: [],
    audienceSegments: [],
    followUps: [],
  };
}
describe("campaign sender eligibility", () => {
  it("allows an authorised verified Brevo sender different from the invitation default", () => {
    expect(allowedSenders(workspace(), user, "soma")).toEqual([sender]);
  });
  it("still requires product assignment even for the default address", () => {
    const db = workspace();
    db.senders = [{ ...sender, email: db.brevoFromEmail, productIds: [] }];
    expect(allowedSenders(db, user, "soma")).toEqual([]);
  });
  it("still enforces verification and BDO assignment", () => {
    const db = workspace();
    db.senders = [
      { ...sender, id: "unverified", status: "Unverified" },
      { ...sender, id: "other-user", userIds: ["another-bdo"] },
    ];
    expect(allowedSenders(db, user, "soma")).toEqual([]);
  });
  it("lets administrators select product-authorised senders without BDO assignment", () => {
    const db = workspace();
    db.senders = [{ ...sender, userIds: [] }];
    expect(
      allowedSenders(db, { ...user, role: "Super Admin" }, "soma"),
    ).toHaveLength(1);
    expect(
      allowedSenders(db, { ...user, role: "Super Admin" }, "another-product"),
    ).toEqual([]);
  });
  it("uses the selected sender's display name for personalised previews", () => {
    const contact: Contact = {
      id: "contact",
      firstName: "Person",
      lastName: "Example",
      email: "person@example.com",
      phone: "",
      company: "Example",
      jobTitle: "",
      source: "Website",
      createdAt: "2026-01-01T00:00:00Z",
      notes: "",
      consent: true,
      doNotEmail: false,
    };
    expect(tokensFor(workspace(), contact, "soma", sender).sender_name).toBe(
      "Selected sender",
    );
  });
});
