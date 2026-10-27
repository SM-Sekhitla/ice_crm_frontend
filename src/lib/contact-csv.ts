import { contactDefaults, contactSchema } from "./contacts";
import type { ContactInput } from "../types";
export const csvFields = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "company",
  "jobTitle",
  "source",
  "notes",
  "tags",
  "city",
  "province",
  "country",
  "consent",
  "consentSource",
  "consentDate",
  "doNotEmail",
] as const;
export type CsvField = (typeof csvFields)[number];
export interface CsvData {
  headers: string[];
  rows: string[][];
}
export function parseContactCsv(text: string): CsvData {
  if (text.length > 1_000_000)
    throw new Error("Use a CSV file smaller than 1 MB.");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let endedQuote = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          endedQuote = true;
        }
      } else cell += c;
    } else if (c === '"') {
      if (cell || endedQuote)
        throw new Error(
          "Invalid quotation in CSV. Quote the entire cell and escape quotes by doubling them.",
        );
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
      endedQuote = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
      endedQuote = false;
    } else {
      if (endedQuote && c.trim())
        throw new Error("Unexpected text after a quoted CSV cell.");
      if (!endedQuote) cell += c;
    }
  }
  if (quoted) throw new Error("A quoted CSV cell was not closed.");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  if (rows.length < 2)
    throw new Error("The CSV needs a header row and at least one contact.");
  if (rows.length > 1001)
    throw new Error("Import up to 1,000 contacts per file.");
  const headers = rows.shift()!.map((h) => h.trim());
  if (
    headers.some((h) => !h) ||
    new Set(headers.map((h) => h.toLowerCase())).size !== headers.length
  )
    throw new Error("Each CSV column needs a unique, non-empty heading.");
  if (rows.some((r) => r.length !== headers.length))
    throw new Error(
      "Every row must have the same number of columns as the header.",
    );
  return { headers, rows };
}
export function suggestMapping(
  headers: string[],
): Partial<Record<CsvField, string>> {
  const aliases: Record<string, string> = {
    firstname: "firstName",
    lastname: "lastName",
    emailaddress: "email",
    phonenumber: "phone",
    companyname: "company",
    emailmarketingconsent: "consent",
  };
  const mapping: Partial<Record<CsvField, string>> = {};
  for (const h of headers) {
    const normalized = h.toLowerCase().replace(/[^a-z0-9]/g, "");
    const field =
      csvFields.find((f) => f.toLowerCase() === normalized) ??
      (aliases[normalized] as CsvField | undefined);
    if (field && !mapping[field]) mapping[field] = h;
  }
  return mapping;
}
export function previewContactCsv(
  csv: CsvData,
  mapping: Partial<Record<CsvField, string>>,
  productId: string,
  ownerId: string,
  existingEmails: string[],
) {
  const seen = new Set(existingEmails.map((e) => e.toLowerCase()));
  return csv.rows.map((row, index) => {
    const value = (field: CsvField) =>
      mapping[field]
        ? (row[csv.headers.indexOf(mapping[field]!)] ?? "").trim()
        : "";
    const email = value("email").toLowerCase();
    if (email && seen.has(email))
      return {
        row: index + 2,
        name: `${value("firstName")} ${value("lastName")}`.trim(),
        email,
        status: "Duplicate" as const,
        message: "Email already exists in the workspace or this file.",
        input: null,
      };
    const defaults = contactDefaults();
    const raw: ContactInput = {
      ...defaults,
      firstName: value("firstName"),
      lastName: value("lastName"),
      email,
      phone: value("phone"),
      company: value("company"),
      jobTitle: value("jobTitle"),
      source: value("source") || "CSV import",
      notes: value("notes"),
      tags: value("tags")
        .split(/[,;]/)
        .map((t) => t.trim())
        .filter(Boolean),
      city: value("city"),
      province: value("province"),
      country: value("country") || "South Africa",
      consent: ["true", "yes", "1"].includes(value("consent").toLowerCase()),
      doNotEmail: ["true", "yes", "1"].includes(
        value("doNotEmail").toLowerCase(),
      ),
      consentSource: value("consentSource"),
      consentDate: value("consentDate"),
      productIds: [productId],
      ownerId,
    };
    const parsed = contactSchema.safeParse(raw);
    const invalidBoolean = ["consent", "doNotEmail"].some(
      (f) =>
        value(f as CsvField) &&
        !["true", "yes", "1", "false", "no", "0"].includes(
          value(f as CsvField).toLowerCase(),
        ),
    );
    if (!parsed.success || invalidBoolean)
      return {
        row: index + 2,
        name: `${raw.firstName} ${raw.lastName}`,
        email,
        status: "Invalid" as const,
        message: invalidBoolean
          ? "Consent and do-not-email fields must be true/false, yes/no, or 1/0."
          : parsed.error!.issues.map((i) => i.message).join("; "),
        input: null,
      };
    seen.add(email);
    return {
      row: index + 2,
      name: `${raw.firstName} ${raw.lastName}`,
      email,
      status: "Ready" as const,
      message: "Ready to import",
      input: parsed.data,
    };
  });
}
