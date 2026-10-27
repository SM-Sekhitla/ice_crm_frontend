import { z } from "zod";
import type { Contact, Database } from "../types";
export const provinces = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
];
export const contactDetailsSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(80),
    lastName: z.string().trim().min(1, "Last name is required").max(80),
    email: z
      .string()
      .trim()
      .email("Enter a valid email address")
      .transform((v) => v.toLowerCase()),
    phone: z.string().trim().max(40),
    company: z.string().trim().max(160),
    jobTitle: z.string().trim().max(120),
    source: z.string().trim().min(1, "Select a source").max(80),
    notes: z.string().max(10000),
    consent: z.boolean(),
    doNotEmail: z.boolean().optional(),
    alternativePhone: z.string().trim().max(40).optional(),
    industry: z.string().trim().max(100).optional(),
    website: z
      .string()
      .trim()
      .refine(
        (v) => !v || (/^https?:\/\//i.test(v) && URL.canParse(v)),
        "Use a full http:// or https:// website address",
      )
      .optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    address: z.string().trim().max(300).optional(),
    city: z.string().trim().max(100).optional(),
    province: z.string().max(100).optional(),
    country: z.string().trim().max(100).optional(),
    consentSource: z.string().trim().max(200).optional(),
    consentDate: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.consent && !v.consentSource?.trim())
      ctx.addIssue({
        code: "custom",
        path: ["consentSource"],
        message: "Record where consent was obtained",
      });
    if (
      v.consent &&
      (!v.consentDate ||
        !/^\d{4}-\d{2}-\d{2}$/.test(v.consentDate) ||
        Number.isNaN(Date.parse(v.consentDate)) ||
        new Date(v.consentDate).toISOString().slice(0, 10) !== v.consentDate ||
        v.consentDate >
          new Date().toLocaleDateString("en-CA", {
            timeZone: "Africa/Johannesburg",
          }))
    )
      ctx.addIssue({
        code: "custom",
        path: ["consentDate"],
        message: "Record a valid consent date, no later than today",
      });
  });
export const contactSchema = contactDetailsSchema.safeExtend({
  productIds: z
    .array(z.string())
    .min(1, "Select at least one product")
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Select each product only once",
    ),
  ownerId: z.string().min(1, "Select an owner"),
});
export type ContactDetailsInput = z.infer<typeof contactDetailsSchema>;
export function contactDefaults(contact?: Contact): ContactDetailsInput {
  return {
    firstName: contact?.firstName ?? "",
    lastName: contact?.lastName ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    company: contact?.company ?? "",
    jobTitle: contact?.jobTitle ?? "",
    source: contact?.source ?? "Website",
    notes: contact?.notes ?? "",
    consent: contact?.consent ?? false,
    doNotEmail: contact?.doNotEmail ?? false,
    alternativePhone: contact?.alternativePhone ?? "",
    industry: contact?.industry ?? "",
    website: contact?.website ?? "",
    tags: contact?.tags ?? [],
    address: contact?.address ?? "",
    city: contact?.city ?? "",
    province: contact?.province ?? "",
    country: contact?.country ?? "South Africa",
    consentSource: contact?.consentSource ?? "",
    consentDate: contact?.consentDate ?? "",
  };
}
export interface ContactFilters {
  product: string;
  stage: string;
  owner: string;
  source: string;
  consent: string;
  company: string;
  tag: string;
  from: string;
  to: string;
}
export const emptyContactFilters: ContactFilters = {
  product: "",
  stage: "",
  owner: "",
  source: "",
  consent: "",
  company: "",
  tag: "",
  from: "",
  to: "",
};
export function filterContacts(
  db: Database,
  filters: ContactFilters,
  search: string,
  view: string,
  userId: string,
  isClient = false,
) {
  return db.contacts.filter((c) => {
    const relationships = db.associations.filter((a) => a.contactId === c.id);
    return (
      relationships.some(
        (a) =>
          (!isClient || a.stage === "Client") &&
          (!filters.product || a.productId === filters.product) &&
          (!filters.stage || a.stage === filters.stage) &&
          (!filters.owner || a.ownerId === filters.owner) &&
          (view !== "My contacts" || a.ownerId === userId) &&
          (view !== "Not yet converted" || a.stage === "Contact"),
      ) &&
      `${c.firstName} ${c.lastName} ${c.email} ${c.company} ${c.phone} ${(c.tags ?? []).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!filters.source || c.source === filters.source) &&
      (!filters.company ||
        c.company.toLowerCase().includes(filters.company.toLowerCase())) &&
      (!filters.tag ||
        c.tags?.some((t) =>
          t.toLowerCase().includes(filters.tag.toLowerCase()),
        )) &&
      (!filters.from ||
        new Date(c.createdAt).toLocaleDateString("en-CA", {
          timeZone: "Africa/Johannesburg",
        }) >= filters.from) &&
      (!filters.to ||
        new Date(c.createdAt).toLocaleDateString("en-CA", {
          timeZone: "Africa/Johannesburg",
        }) <= filters.to) &&
      (!filters.consent ||
        (filters.consent === "Opted in"
          ? c.consent && !c.doNotEmail
          : filters.consent === "Do not email"
            ? c.doNotEmail
            : !c.consent)) &&
      (view !== "Recently added" ||
        Date.now() - Date.parse(c.createdAt) < 30 * 86400000)
    );
  });
}
