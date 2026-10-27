import type { Database } from "../../types";
export function dashboardData(
  db: Database,
  productId: string,
  days: number,
  now = new Date(),
) {
  const end = now.getTime();
  const start = end - days * 86400000;
  const previous = start - days * 86400000;
  const relations = db.associations.filter(
    (a) => !productId || a.productId === productId,
  );
  const contactIds = new Set(relations.map((a) => a.contactId));
  const associationIds = new Set(relations.map((a) => a.id));
  const inPeriod = (s: string, from = start, to = end) =>
    new Date(s).getTime() >= from && new Date(s).getTime() <= to;
  const contacts = db.contacts.filter(
    (c) => contactIds.has(c.id) && inPeriod(c.createdAt),
  );
  const previousContacts = db.contacts.filter(
    (c) => contactIds.has(c.id) && inPeriod(c.createdAt, previous, start),
  );
  const ids = new Set(contacts.map((c) => c.id));
  const filteredRelations = relations.filter((a) => ids.has(a.contactId));
  const leads = db.leads.filter(
    (l) => associationIds.has(l.associationId) && inPeriod(l.createdAt),
  );
  const clients = db.clients.filter(
    (c) => associationIds.has(c.associationId) && inPeriod(c.clientSince),
  );
  const activeLeads = leads.filter((l) => {
    const a = relations.find((a) => a.id === l.associationId)!;
    return !["Client", "Lost", "Not Interested"].includes(a.stage);
  });
  const campaigns = db.campaigns.filter(
    (c) => (!productId || c.productId === productId) && inPeriod(c.createdAt),
  );
  const buckets = Math.min(days, 12);
  const trend = Array.from({ length: buckets }, (_, i) => {
    const from = start + (i / buckets) * (end - start);
    const to = start + ((i + 1) / buckets) * (end - start);
    return {
      label: new Date(from).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "short",
      }),
      contacts: contacts.filter(
        (c) =>
          new Date(c.createdAt).getTime() >= from &&
          new Date(c.createdAt).getTime() < to,
      ).length,
    };
  });
  return {
    contacts,
    previousContacts,
    activeLeads,
    clients,
    campaigns,
    relations: filteredRelations,
    trend,
    conversion: leads.length
      ? Math.round(
          (clients.filter((c) =>
            leads.some((l) => l.associationId === c.associationId),
          ).length /
            leads.length) *
            100,
        )
      : 0,
  };
}
