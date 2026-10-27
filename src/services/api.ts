import type {
  ContactInput,
  Database,
  FollowUp,
  ProductInput,
  Stage,
  User,
} from "../types";
import {
  contactDetailsSchema,
  contactSchema,
  type ContactDetailsInput,
} from "../lib/contacts";
import { productSchema } from "../lib/products";
import { campaignMethods } from "./campaign-service";
import { json, request } from "./http";
import { normalizeWorkspace } from "./workspace";

const path = (id: string) => encodeURIComponent(id);
export const api = {
  ...campaignMethods,
  async getDatabase(_userId?: string): Promise<Database> {
    return normalizeWorkspace(await request<Database>("/workspace"));
  },
  getUsers: () => request<User[]>("/users"),
  async addContact(input: ContactInput, _userId: string) {
    return (
      await request<{ id: string }>(
        "/contacts",
        json("POST", contactSchema.parse(input)),
      )
    ).id;
  },
  updateContact: (id: string, input: ContactDetailsInput, _userId: string) =>
    request(
      `/contacts/${path(id)}`,
      json("PUT", contactDetailsSchema.parse(input)),
    ),
  async importContacts(rows: ContactInput[], _userId: string) {
    const result = await request<{ importedIds: string[]; skipped: unknown[] }>(
      "/contacts/import",
      json("POST", { rows: rows.map((row) => contactSchema.parse(row)) }),
    );
    return {
      imported: result.importedIds.length,
      skipped: result.skipped.length,
    };
  },
  deleteContacts: (contactIds: string[], _userId: string) =>
    request<void>("/contacts/bulk-delete", json("POST", { contactIds })),
  tagContacts: (contactIds: string[], tag: string, _userId: string) =>
    request(
      "/contacts/bulk-tags",
      json("POST", { contactIds, tags: [tag.trim()] }),
    ),
  async addContactProduct(
    contactId: string,
    productId: string,
    ownerId: string,
    _userId: string,
  ) {
    return (
      await request<{ id: string }>(
        `/contacts/${path(contactId)}/associations`,
        json("POST", { productId, ownerId }),
      )
    ).id;
  },
  removeContactProduct: (id: string, _userId: string) =>
    request<void>(`/associations/${path(id)}`, json("DELETE")),
  reassignContactProduct: (id: string, ownerId: string, _userId: string) =>
    request(`/associations/${path(id)}/owner`, json("PUT", { ownerId })),
  saveFollowUp(
    input: Omit<
      FollowUp,
      "id" | "status" | "createdAt" | "ownerId" | "completedAt"
    >,
    _userId: string,
    id?: string,
  ) {
    const { associationId, ...body } = input;
    return request(
      id
        ? `/follow-ups/${path(id)}`
        : `/associations/${path(associationId)}/follow-ups`,
      json(id ? "PUT" : "POST", { ...body, status: "Open" }),
    );
  },
  setFollowUpStatus: (
    id: string,
    status: FollowUp["status"],
    _userId: string,
  ) => request(`/follow-ups/${path(id)}/status`, json("PUT", { status })),
  updateStage(
    id: string,
    stage: Stage,
    _userId: string,
    options?: {
      value?: number;
      followUp?: string;
      notes?: string;
      reference?: string;
      conversionDate?: string;
    },
  ) {
    return request(
      `/associations/${path(id)}/stage`,
      json("POST", {
        stage,
        ...(options?.value === undefined
          ? {}
          : { expectedValue: options.value, dealValue: options.value }),
        ...(options?.followUp
          ? { followUp: options.followUp.slice(0, 10) }
          : {}),
        ...(options?.conversionDate
          ? { conversionDate: options.conversionDate.slice(0, 10) }
          : {}),
        notes: options?.notes ?? "",
        reference: options?.reference ?? "",
      }),
    );
  },
  async addProduct(input: ProductInput, _userId: string) {
    return (
      await request<{ id: string }>(
        "/products",
        json("POST", productSchema.parse(input)),
      )
    ).id;
  },
  updateProduct: (id: string, input: ProductInput, _userId: string) =>
    request(`/products/${path(id)}`, json("PUT", productSchema.parse(input))),
  deleteProduct: (id: string, _userId: string) =>
    request<void>(`/products/${path(id)}`, json("DELETE")),
  addNote: (id: string, notes: string, _userId: string) =>
    request<void>(`/contacts/${path(id)}/notes`, json("PUT", { notes })),
};
