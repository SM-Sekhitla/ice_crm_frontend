export const campaignStatuses = [
  "Draft",
  "Scheduled",
  "Sending",
  "Sent",
  "Partially Failed",
  "Failed",
  "Cancelled",
] as const;
export const campaignTypes = [
  "Product Announcement",
  "Newsletter",
  "Follow-up",
  "Promotional",
  "General Communication",
] as const;
export const personalisationTokens = [
  "first_name",
  "last_name",
  "company_name",
  "product_name",
  "assigned_bdo",
  "sender_name",
] as const;
export type PersonalisationToken = (typeof personalisationTokens)[number];
export interface CampaignAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
}
export interface CampaignInput {
  name: string;
  description: string;
  productId: string;
  type: (typeof campaignTypes)[number];
  senderId: string;
  subject: string;
  bodyHtml: string;
  signatureId: string;
  recipientIds: string[];
  attachments: CampaignAttachment[];
}
export interface Campaign extends CampaignInput {
  id: string;
  status: (typeof campaignStatuses)[number];
  recipients: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  scheduledAt: string | null;
  sentAt: string | null;
  mode: "smtp" | "simulation";
  signatureHtml: string;
}
export interface CampaignRecipient {
  id: string;
  campaignId: string;
  contactId: string | null;
  email: string;
  name: string;
  status:
    | "Queued"
    | "Dispatching"
    | "Accepted"
    | "Simulated"
    | "Excluded"
    | "Failed"
    | "Unknown";
  reason: string;
  processedAt: string | null;
  tokens: Record<PersonalisationToken, string>;
}
export interface SenderConfiguration {
  id: string;
  name: string;
  senderName: string;
  email: string;
  replyTo: string;
  provider: string;
  status: "Verified" | "Unverified";
  productIds: string[];
  userIds: string[];
}
export interface EmailSignature {
  id: string;
  name: string;
  html: string;
  ownerId?: string;
  sourceFileName?: string;
  createdAt?: string;
}

export interface AudienceSegment {
  id: string;
  name: string;
  productId: string;
  createdBy: string;
  contactIds: string[];
}
