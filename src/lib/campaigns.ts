import { z } from "zod";
import type {
  Campaign,
  CampaignInput,
  SenderConfiguration,
  PersonalisationToken,
} from "../types/campaigns";
import { campaignTypes, personalisationTokens } from "../types/campaigns";
import type { Contact, Database, User } from "../types";
import { can, canAccessProduct, scopeDatabase } from "./permissions";

export const campaignSchema = z.object({
  name: z.string().trim().min(1, "Give your campaign a name.").max(100),
  description: z.string().trim().max(500),
  productId: z.string().min(1, "Choose a product."),
  type: z.enum(campaignTypes),
  senderId: z.string(),
  subject: z
    .string()
    .max(180)
    .refine((v) => !/[\r\n]/.test(v), "Use a single-line subject."),
  bodyHtml: z
    .string()
    .max(600000, "The email is too large. Use smaller images."),
  signatureId: z.string(),
  recipientIds: z
    .array(z.string())
    .max(1000)
    .transform((ids) => [...new Set(ids)]),
  attachments: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200),
        size: z.number().min(0).max(10_000_000),
        type: z.string().max(200),
      }),
    )
    .max(5),
});
export function newCampaign(productId = ""): CampaignInput {
  return {
    name: "",
    description: "",
    productId,
    type: "Product Announcement",
    senderId: "",
    subject: "",
    bodyHtml: "<p>Hi {{first_name}},</p><p></p>",
    signatureId: "",
    recipientIds: [],
    attachments: [],
  };
}
export function allowedSenders(db: Database, user: User, productId: string) {
  return db.senders.filter(
    (s) =>
      s.status === "Verified" &&
      s.productIds.includes(productId) &&
      (user.role === "Super Admin" || s.userIds.includes(user.id)),
  );
}
export function audience(db: Database, user: User, productId: string) {
  const scoped = scopeDatabase(db, user);
  const relations = scoped.associations.filter(
    (a) => a.productId === productId,
  );
  const emails = new Set<string>();
  return scoped.contacts
    .filter((c) => relations.some((a) => a.contactId === c.id))
    .map((contact) => {
      let reason = "";
      const email = contact.email.trim().toLowerCase();
      if (contact.doNotEmail) reason = "Do not email";
      else if (!contact.consent) reason = "No marketing consent";
      else if (!z.email().safeParse(email).success) reason = "Invalid email";
      else if (emails.has(email)) reason = "Duplicate email";
      if (!reason) emails.add(email);
      return {
        contact,
        association: relations.find((a) => a.contactId === contact.id)!,
        eligible: !reason,
        reason,
      };
    });
}
export function tokensFor(
  db: Database,
  contact: Contact,
  productId: string,
  sender?: SenderConfiguration,
): Record<PersonalisationToken, string> {
  const a = db.associations.find(
    (a) => a.contactId === contact.id && a.productId === productId,
  );
  const owner = db.users.find((u) => u.id === a?.ownerId);
  return {
    first_name: contact.firstName || "there",
    last_name: contact.lastName || "",
    company_name: contact.company || "your organisation",
    product_name:
      db.products.find((p) => p.id === productId)?.name || "our solution",
    assigned_bdo: owner ? `${owner.firstName} ${owner.lastName}` : "our team",
    sender_name: sender?.senderName || "ICE Business Development",
  };
}
export const escapeHtml = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function personalise(
  template: string,
  tokens: Record<PersonalisationToken, string>,
  html = false,
) {
  return template.replace(/{{\s*(\w+)\s*}}/g, (original, key: string) =>
    personalisationTokens.includes(key as PersonalisationToken)
      ? html
        ? escapeHtml(tokens[key as PersonalisationToken])
        : tokens[key as PersonalisationToken]
      : original,
  );
}
export function unknownTokens(template: string) {
  return [...template.matchAll(/{{\s*([^{}]+?)\s*}}/g)]
    .map((m) => m[1])
    .filter(
      (key) => !personalisationTokens.includes(key as PersonalisationToken),
    );
}
export function campaignCanManage(c: Campaign, user: User) {
  return (
    can(user, "campaigns.manage") &&
    canAccessProduct(user, c.productId) &&
    (user.role === "Super Admin" || c.createdBy === user.id)
  );
}
export function requireCampaign(db: Database, id: string, user: User) {
  const c = db.campaigns.find((c) => c.id === id);
  if (!c || !campaignCanManage(c, user))
    throw new Error("Campaign not accessible.");
  return c;
}
export function validateDraft(db: Database, input: CampaignInput, user: User) {
  if (
    !can(user, "campaigns.manage") ||
    !canAccessProduct(user, input.productId) ||
    !db.products.some((p) => p.id === input.productId && p.status === "Active")
  )
    throw new Error("Choose an accessible, active product.");
  if (
    input.senderId &&
    !allowedSenders(db, user, input.productId).some(
      (s) => s.id === input.senderId,
    )
  )
    throw new Error("Choose an authorised, verified sender for this product.");
  if (
    input.signatureId &&
    !db.signatures.some(
      (s) =>
        s.id === input.signatureId &&
        (!s.ownerId || s.ownerId === user.id || user.role === "Super Admin"),
    )
  )
    throw new Error("Choose an existing signature.");
  const visible = new Set(
    audience(db, user, input.productId).map((a) => a.contact.id),
  );
  if (input.recipientIds.some((id) => !visible.has(id)))
    throw new Error(
      "A selected contact is not accessible for this product. Refresh the audience.",
    );
}
export function requireReady(db: Database, c: Campaign, user: User) {
  const author = db.users.find((u) => u.id === c.createdBy);
  if (!author) throw new Error("Campaign owner no longer exists.");
  validateDraft(db, c, author);
  if (!can(user, "campaigns.send") || !can(author, "campaigns.send"))
    throw new Error("You cannot send campaigns.");
  if (!c.subject.trim()) throw new Error("Add an email subject.");
  if (
    !c.bodyHtml
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, "")
      .trim()
  )
    throw new Error("Add an email message.");
  if (unknownTokens(c.subject + c.bodyHtml).length)
    throw new Error("Remove unsupported personalisation tokens.");
  if (!allowedSenders(db, author, c.productId).some((s) => s.id === c.senderId))
    throw new Error("Choose an authorised, verified sender.");
  const selected = audience(db, author, c.productId).filter((r) =>
    c.recipientIds.includes(r.contact.id),
  );
  if (!selected.some((r) => r.eligible))
    throw new Error("Select at least one eligible recipient.");
  return selected;
}
