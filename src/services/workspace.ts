import type { Database } from "../types";

// The API owns all records. Only transport differences (nulls/decimal strings)
// are adapted here; no records or counts are fabricated when a request fails.
export function normalizeWorkspace(db: Database): Database {
  return {
    ...db,
    contacts: db.contacts.map((contact) => ({
      ...contact,
      updatedAt: contact.updatedAt ?? undefined,
    })),
    leads: db.leads.map((lead) => ({
      ...lead,
      expectedValue: Number(lead.expectedValue),
      convertedAt: lead.convertedAt ?? undefined,
    })),
    clients: db.clients.map((client) => ({
      ...client,
      dealValue: Number(client.dealValue),
    })),
    followUps: db.followUps.map((task) => ({
      ...task,
      completedAt: task.completedAt ?? undefined,
    })),
    activities: db.activities.map((entry) => ({
      ...entry,
      contactId: entry.contactId ?? undefined,
    })),
    campaigns: db.campaigns.map((campaign) => ({
      ...campaign,
      senderId: campaign.senderId ?? "",
      signatureId: campaign.signatureId ?? "",
      recipients: campaign.recipientIds.length,
      attachments: [],
    })),
  };
}
