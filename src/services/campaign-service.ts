import { campaignSchema } from "../lib/campaigns";
import type { CampaignInput, CampaignRecipient } from "../types/campaigns";
import { json, request } from "./http";

const path = (id: string) => encodeURIComponent(id);
export const campaignMethods = {
  async saveUploadedSignature(
    input: { name: string; html: string; sourceFileName: string },
    _userId: string,
  ) {
    return (await request<{ id: string }>("/signatures", json("POST", input)))
      .id;
  },
  deleteSignature: (id: string, _userId: string) =>
    request<void>(`/signatures/${path(id)}`, json("DELETE")),
  saveAudienceSegment: (
    name: string,
    productId: string,
    contactIds: string[],
    _userId: string,
  ) =>
    request(
      "/audience-segments",
      json("POST", { name, productId, contactIds }),
    ),
  deleteAudienceSegment: (id: string, _userId: string) =>
    request<void>(`/audience-segments/${path(id)}`, json("DELETE")),
  async saveCampaign(input: CampaignInput, _userId: string, id?: string) {
    const values = campaignSchema.parse(input);
    if (values.attachments.length)
      throw new Error("File attachments are not supported by this server yet.");
    const { attachments: _attachments, ...fields } = values;
    const result = await request<{ id: string }>(
      id ? `/campaigns/${path(id)}` : "/campaigns",
      json(id ? "PUT" : "POST", {
        ...fields,
        senderId: fields.senderId || null,
        signatureId: fields.signatureId || null,
      }),
    );
    return result.id;
  },
  submitCampaign: (
    id: string,
    options: {
      mode: "now" | "schedule";
      delivery: "smtp" | "simulation";
      scheduledAt?: string;
      confirmed: boolean;
    },
    _userId: string,
  ) =>
    request(
      `/campaigns/${path(id)}/launch`,
      json("POST", {
        mode: options.delivery,
        confirm: options.confirmed,
        scheduledAt: options.mode === "schedule" ? options.scheduledAt : null,
      }),
    ),
  cancelCampaign: (id: string, _userId: string) =>
    request(`/campaigns/${path(id)}/cancel`, json("POST")),
  deleteCampaign: (id: string, _userId: string) =>
    request<void>(`/campaigns/${path(id)}`, json("DELETE")),
  async duplicateCampaign(id: string, _userId: string) {
    return (
      await request<{ id: string }>(
        `/campaigns/${path(id)}/duplicate`,
        json("POST"),
      )
    ).id;
  },
  validateCampaignPreview: (id: string, contactId: string) =>
    request<{ subject: string; bodyHtml: string; signatureHtml: string }>(
      `/campaigns/${path(id)}/preview/${path(contactId)}`,
      json("POST"),
    ),
};
export function recipientCounts(rows: CampaignRecipient[]) {
  return {
    queued: rows.filter((r) => r.status === "Queued").length,
    dispatching: rows.filter((r) => r.status === "Dispatching").length,
    accepted: rows.filter((r) => r.status === "Accepted").length,
    simulated: rows.filter((r) => r.status === "Simulated").length,
    excluded: rows.filter((r) => r.status === "Excluded").length,
    failed: rows.filter((r) => r.status === "Failed").length,
    unknown: rows.filter((r) => r.status === "Unknown").length,
  };
}
