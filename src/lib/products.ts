import { z } from "zod";
import type { Database } from "../types";

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Product name is required.")
    .max(80, "Use 80 characters or fewer."),
  code: z
    .string()
    .trim()
    .min(1, "Product code is required.")
    .max(12, "Use 12 characters or fewer.")
    .regex(/^[a-zA-Z0-9-]+$/, "Use letters, numbers, and hyphens only.")
    .transform((value) => value.toUpperCase()),
  type: z.enum(["Product", "Service", "Project"]),
  description: z.string().trim().max(1000, "Use 1,000 characters or fewer."),
  status: z.enum(["Active", "Inactive", "Archived"]),
  ownerId: z.string().min(1, "Select a product owner."),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a valid colour."),
});

export function productUsage(db: Database, productId: string) {
  const relationships = db.associations.filter(
    (a) => a.productId === productId,
  );
  const relationshipIds = new Set(relationships.map((a) => a.id));
  return {
    contacts: new Set(relationships.map((a) => a.contactId)).size,
    relationships: relationships.length,
    leads: db.leads.filter(
      (l) =>
        relationshipIds.has(l.associationId) &&
        relationships.some(
          (a) =>
            a.id === l.associationId &&
            !["Client", "Lost", "Not Interested"].includes(a.stage),
        ),
    ).length,
    clients: db.clients.filter((c) => relationshipIds.has(c.associationId))
      .length,
    campaigns: db.campaigns.filter((c) => c.productId === productId).length,
    get canDelete() {
      return this.relationships === 0 && this.campaigns === 0;
    },
  };
}
