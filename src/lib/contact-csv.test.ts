import { describe, expect, it } from "vitest";
import {
  parseContactCsv,
  previewContactCsv,
  suggestMapping,
} from "./contact-csv";
import { contactSchema, contactDefaults } from "./contacts";
describe("CSV contact import", () => {
  it("parses quoted commas, escaped quotes, BOM, and multiline notes", () => {
    const csv = parseContactCsv(
      '\uFEFFFirst name,Last name,Email,Notes\r\nAlex,Morgan,alex@example.co.za,"Line one, and ""quotes""\nLine two"\r\n',
    );
    expect(csv.rows[0][3]).toBe('Line one, and "quotes"\nLine two');
  });
  it("previews duplicates and invalid records without assuming consent", () => {
    const csv = parseContactCsv(
      "First name,Last name,Email\nAlex,Morgan,alex@example.co.za\nOther,Person,ALEX@example.co.za\nInvalid,Person,not-email\nExisting,Contact,existing@example.co.za",
    );
    const rows = previewContactCsv(
      csv,
      suggestMapping(csv.headers),
      "p1",
      "u1",
      ["existing@example.co.za"],
    );
    expect(rows.map((r) => r.status)).toEqual([
      "Ready",
      "Duplicate",
      "Invalid",
      "Duplicate",
    ]);
    expect(rows[0].input?.consent).toBe(false);
  });
  it("rejects malformed input and duplicate headers", () => {
    expect(() => parseContactCsv('Name,Email\n"unterminated,email')).toThrow(
      "not closed",
    );
    expect(() => parseContactCsv("Email,Email\na,b")).toThrow("unique");
    expect(() => parseContactCsv("Name,Email\nA,b,extra")).toThrow(
      "same number",
    );
  });
  it("requires consent provenance and a real date", () => {
    const input = {
      ...contactDefaults(),
      firstName: "A",
      lastName: "B",
      email: "a@b.co.za",
      productIds: ["p1"],
      ownerId: "u1",
      consent: true,
    };
    expect(contactSchema.safeParse(input).success).toBe(false);
    expect(
      contactSchema.safeParse({
        ...input,
        consentSource: "Signed form",
        consentDate: "2026-02-31",
      }).success,
    ).toBe(false);
  });
});
