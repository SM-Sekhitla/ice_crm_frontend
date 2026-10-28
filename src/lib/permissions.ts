import type { Association, Database, Permission, User } from "../types";
const roles: Record<User["role"], Permission[]> = {
  "Super Admin": [
    "contacts.view",
    "contacts.create",
    "contacts.edit",
    "contacts.delete",
    "leads.manage",
    "products.manage",
    "campaigns.view",
    "campaigns.manage",
    "campaigns.send",
    "users.manage",
    "logs.view",
    "email_config.manage",
  ],
  BDO: [
    "contacts.view",
    "contacts.create",
    "contacts.edit",
    "leads.manage",
    "campaigns.view",
    "campaigns.manage",
    "campaigns.send",
  ],
};
export const can = (user: User, permission: Permission) =>
  roles[user.role].includes(permission);
export const canAccessProduct = (user: User, productId: string) =>
  user.role === "Super Admin" || user.productIds.includes(productId);
export function scopeDatabase(db: Database, user: User): Database {
  if (user.role === "Super Admin") return db;
  const campaigns = db.campaigns.filter(
    (c) => canAccessProduct(user, c.productId) && c.createdBy === user.id,
  );
  const campaignIds = new Set(campaigns.map((c) => c.id));
  return {
    ...db,
    products: db.products,
    contacts: db.contacts,
    associations: db.associations,
    leads: db.leads,
    clients: db.clients,
    followUps: db.followUps,
    campaigns,
    audienceSegments: db.audienceSegments.filter(
      (s) => s.createdBy === user.id && canAccessProduct(user, s.productId),
    ),
    signatures: db.signatures.filter(
      (s) => !s.ownerId || s.ownerId === user.id,
    ),
    campaignRecipients: db.campaignRecipients.filter((r) =>
      campaignIds.has(r.campaignId),
    ),
    senders: db.senders.filter(
      (s) =>
        s.userIds.includes(user.id) &&
        s.productIds.some((id) => canAccessProduct(user, id)),
    ),
    activities: db.activities.filter(
      (a) =>
        !!a.contactId ||
        (a.productId !== null &&
          canAccessProduct(user, a.productId) &&
          a.userId === user.id),
    ),
  };
}

export const canManageAssociation = (user: User, association: Association) =>
  user.role === "Super Admin" ||
  (association.ownerId === user.id &&
    canAccessProduct(user, association.productId));

export const canEditContact = (user: User, db: Database, contactId: string) =>
  can(user, "contacts.edit") &&
  (user.role === "Super Admin" ||
    db.associations.some(
      (association) =>
        association.contactId === contactId &&
        canManageAssociation(user, association),
    ));
