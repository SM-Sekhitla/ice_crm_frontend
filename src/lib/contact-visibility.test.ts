import { describe, expect, it } from "vitest";
import { emptyContactFilters, filterContacts } from "./contacts";
import type { Database } from "../types";
const db = {
  contacts: [
    {
      id: "manual",
      firstName: "Manual",
      lastName: "Contact",
      email: "manual@example.com",
      company: "",
      phone: "",
      createdAt: new Date().toISOString(),
    },
    {
      id: "qr",
      firstName: "QR",
      lastName: "Contact",
      email: "qr@example.com",
      company: "",
      phone: "",
      source: "QR contact form",
      capturedBy: "user",
      createdAt: new Date().toISOString(),
    },
  ],
  associations: [
    {
      contactId: "manual",
      productId: "product",
      stage: "Contact",
      ownerId: "other",
    },
  ],
} as unknown as Database;
const ids = (
  view = "All contacts",
  filters = emptyContactFilters,
  clients = false,
) => filterContacts(db, filters, "", view, "user", clients).map((c) => c.id);
describe("contacts without product relationships", () => {
  it("includes QR captures in all, recent and unconverted contacts", () => {
    for (const view of ["All contacts", "Recently added", "Not yet converted"])
      expect(ids(view)).toEqual(["manual", "qr"]);
  });
  it("uses the capturing user for My contacts and owner filters", () => {
    expect(ids("My contacts")).toEqual(["qr"]);
    expect(
      ids("All contacts", { ...emptyContactFilters, owner: "user" }),
    ).toEqual(["qr"]);
  });
  it("retains product, lifecycle and client boundaries", () => {
    expect(
      ids("All contacts", { ...emptyContactFilters, product: "product" }),
    ).toEqual(["manual"]);
    expect(
      ids("All contacts", { ...emptyContactFilters, stage: "New Lead" }),
    ).toEqual([]);
    expect(ids("All contacts", emptyContactFilters, true)).toEqual([]);
  });
});
