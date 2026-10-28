import type {
  Campaign,
  CampaignRecipient,
  SenderConfiguration,
  EmailSignature,
  AudienceSegment,
} from "./campaigns";
export type { Campaign } from "./campaigns";
export const stages = [
  "Contact",
  "New Lead",
  "Contacted",
  "Interested",
  "Qualified",
  "Proposal Sent",
  "Negotiation",
  "Client",
  "Lost",
  "Not Interested",
  "On Hold",
] as const;
export type Stage = (typeof stages)[number];
export type Permission =
  | "calendar.view"
  | "calendar.manage"
  | "contacts.view"
  | "contacts.create"
  | "contacts.edit"
  | "contacts.delete"
  | "leads.manage"
  | "products.manage"
  | "campaigns.view"
  | "campaigns.manage"
  | "campaigns.send"
  | "users.manage"
  | "email_config.manage"
  | "logs.view";
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "Super Admin" | "BDO";
  productIds: string[];
  active?: boolean;
  deletedAt?: string | null;
  passwordSet?: boolean;
  onboardingCompleted?: boolean;
  invitationStatus?:
    "Queued" | "Dispatching" | "Accepted" | "Failed" | "Unknown" | "Cancelled";
  invitationReason?: string;
  invitationExpiresAt?: string;
}
export interface Product {
  id: string;
  name: string;
  code: string;
  type: "Product" | "Service" | "Project";
  description: string;
  status: "Active" | "Inactive" | "Archived";
  color: string;
  createdAt: string;
  ownerId: string;
}
export type ProductInput = Omit<Product, "id" | "createdAt">;

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  source: string;
  createdAt: string;
  notes: string;
  consent: boolean;
  doNotEmail: boolean;
  alternativePhone?: string;
  industry?: string;
  website?: string;
  tags?: string[];
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  consentSource?: string;
  consentDate?: string;
  updatedAt?: string;
}
export interface Association {
  id: string;
  contactId: string;
  productId: string;
  ownerId: string;
  stage: Stage;
  createdAt: string;
}
export interface Lead {
  id: string;
  associationId: string;
  expectedValue: number;
  priority: "High" | "Medium" | "Low";
  nextFollowUp: string;
  createdAt: string;
  convertedAt?: string;
}
export interface Client {
  id: string;
  associationId: string;
  clientSince: string;
  dealValue: number;
  reference: string;
}
export interface Activity {
  id: string;
  contactId?: string;
  productId: string | null;
  userId: string;
  description: string;
  createdAt: string;
}
export interface FollowUp {
  id: string;
  associationId: string;
  ownerId: string;
  title: string;
  dueDate: string;
  priority: "High" | "Medium" | "Low";
  notes: string;
  status: "Open" | "Completed";
  createdAt: string;
  completedAt?: string;
}
export interface Database {
  version: number;
  emailProvider: "smtp" | "brevo";
  emailDeliveryEnabled: boolean;
  brevoFromEmail: string;
  brevoFromName: string;
  users: User[];
  products: Product[];
  contacts: Contact[];
  associations: Association[];
  leads: Lead[];
  clients: Client[];
  activities: Activity[];
  campaigns: Campaign[];
  campaignRecipients: CampaignRecipient[];
  senders: SenderConfiguration[];
  signatures: EmailSignature[];
  audienceSegments: AudienceSegment[];
  followUps: FollowUp[];
}
export interface ContactInput {
  doNotEmail?: boolean;
  alternativePhone?: string;
  industry?: string;
  website?: string;
  tags?: string[];
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  consentSource?: string;
  consentDate?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  source: string;
  productIds: string[];
  ownerId: string;
  consent: boolean;
  notes: string;
}
