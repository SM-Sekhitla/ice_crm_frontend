import { env } from "node:process";
import { afterEach, expect, it, vi } from "vitest";

// Optional integration test: only target a disposable backend/database.
// Uses native fetch and the real frontend services, never a mocked transport.
it.skipIf(!env.CRM_LIVE_API_URL)(
  "communicates with FastAPI and PostgreSQL through the frontend client",
  async () => {
    vi.resetModules();
    const storage = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    vi.stubEnv("VITE_API_URL", env.CRM_LIVE_API_URL!);
    const { signIn, signOut, request, json } = await import("./http");
    const { api } = await import("./api");
    const { newCampaign } = await import("../lib/campaigns");
    const user = await signIn(env.CRM_TEST_EMAIL!, env.CRM_TEST_PASSWORD!);
    const nonce = Date.now().toString();
    const productId = await api.addProduct(
      {
        name: "HTTP integration",
        code: `H${Date.now().toString(36)}`,
        type: "Product",
        status: "Active",
        description: "Integration test",
        color: "#C1121F",
        ownerId: user.id,
      },
      user.id,
    );
    const contactId = await api.addContact(
      {
        firstName: "Integration",
        lastName: "Contact",
        email: `http-${nonce}@example.com`,
        productIds: [productId],
        ownerId: user.id,
        phone: "",
        company: "",
        jobTitle: "",
        source: "Website",
        notes: "",
        consent: true,
        consentSource: "Test-only opt-in",
        consentDate: "2026-01-01",
      },
      user.id,
    );
    await api.addNote(
      contactId,
      "Saved through the frontend HTTP client",
      user.id,
    );
    let db = await api.getDatabase(user.id);
    expect(db.contacts.find((person) => person.id === contactId)?.notes).toBe(
      "Saved through the frontend HTTP client",
    );
    const association = db.associations.find(
      (relation) => relation.contactId === contactId,
    )!;
    await api.updateStage(association.id, "New Lead", user.id, {
      value: 500,
      followUp: "2026-12-01",
    });
    db = await api.getDatabase(user.id);
    const task = db.followUps.find(
      (item) => item.associationId === association.id,
    )!;
    await api.setFollowUpStatus(task.id, "Completed", user.id);
    const signatureId = await api.saveUploadedSignature(
      {
        name: `HTTP ${nonce}`,
        sourceFileName: "signature.html",
        html: '<html><body style="font-family:Arial;color:#d32f2f"><p>Regards</p><script>bad()</script></body></html>',
      },
      user.id,
    );
    const sender = await request<{ id: string }>(
      "/senders",
      json("POST", {
        name: `HTTP ${nonce}`,
        senderName: "Integration",
        email: "integration@example.com",
        replyTo: "reply@example.com",
        status: "Verified",
        productIds: [productId],
        userIds: [user.id],
      }),
    );
    const campaignId = await api.saveCampaign(
      {
        ...newCampaign(productId),
        name: `HTTP ${nonce}`,
        subject: "Hello {{first_name}}",
        bodyHtml: "<p>Hello {{first_name}}</p>",
        senderId: sender.id,
        signatureId,
        recipientIds: [contactId],
      },
      user.id,
    );
    const preview = await api.validateCampaignPreview(campaignId, contactId);
    expect(preview.subject).toBe("Hello Integration");
    expect(preview.signatureHtml).toContain("#d32f2f");
    expect(preview.signatureHtml).not.toContain("bad()");
    await api.submitCampaign(
      campaignId,
      { mode: "now", delivery: "simulation", confirmed: true },
      user.id,
    );
    const deadline = Date.now() + 15000;
    do {
      db = await api.getDatabase(user.id);
      if (
        db.campaigns.find((campaign) => campaign.id === campaignId)?.status ===
        "Sent"
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    } while (Date.now() < deadline);
    expect(
      db.campaigns.find((campaign) => campaign.id === campaignId)?.status,
    ).toBe("Sent");
    expect(
      db.campaignRecipients.find(
        (recipient) => recipient.campaignId === campaignId,
      )?.status,
    ).toBe("Simulated");
    expect(
      db.leads.find((lead) => lead.associationId === association.id)
        ?.nextFollowUp,
    ).toBe("");
    await signOut();
    await expect(request("/workspace")).rejects.toMatchObject({ status: 401 });
  },
  30000,
);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
