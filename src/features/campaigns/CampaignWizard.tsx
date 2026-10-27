import { SignatureManager } from "../signatures/SignatureManager";
import { lazy, Suspense, useMemo, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  Monitor,
  Smartphone,
  Save,
  Search,
  Send,
  Clock3,
  FlaskConical,
} from "lucide-react";
import { toast } from "sonner";
import { useCRM } from "../../app/context";
import {
  Avatar,
  Badge,
  Button,
  Empty,
  Modal,
  PageHeader,
} from "../../components/ui/primitives";
import {
  allowedSenders,
  audience,
  campaignSchema,
  newCampaign,
  tokensFor,
  unknownTokens,
} from "../../lib/campaigns";
import { can, canAccessProduct } from "../../lib/permissions";
import { api } from "../../services/api";
import {
  campaignTypes,
  type Campaign,
  type CampaignInput,
} from "../../types/campaigns";
import { stages } from "../../types";
const EmailComposer = lazy(() =>
  import("./EmailComposer").then((module) => ({
    default: module.EmailComposer,
  })),
);
import { EmailPreview } from "./EmailPreview";

const steps = ["Details", "Audience", "Compose", "Preview", "Launch"];
export function CampaignWizard({
  initial,
  onClose,
  onSubmitted,
}: {
  initial?: Campaign;
  onClose: () => void;
  onSubmitted: (id: string) => void;
}) {
  const { db, user, refresh } = useCRM();
  const campaignOwner =
    db.users.find((u) => u.id === initial?.createdBy) ?? user;
  const start = initial
    ? {
        name: initial.name,
        description: initial.description,
        productId: initial.productId,
        type: initial.type,
        senderId: initial.senderId,
        subject: initial.subject,
        bodyHtml: initial.bodyHtml,
        signatureId: initial.signatureId,
        recipientIds: initial.recipientIds,
        attachments: initial.attachments,
      }
    : newCampaign();
  const [draft, setDraft] = useState<CampaignInput>(start);
  const [baseline, setBaseline] = useState(JSON.stringify(start));
  const [id, setId] = useState(initial?.id);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [ack, setAck] = useState(false);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [owner, setOwner] = useState("");
  const [tag, setTag] = useState("");
  const [limit, setLimit] = useState(20);
  const [previewId, setPreviewId] = useState("");
  const [mobile, setMobile] = useState(false);
  const [test, setTest] = useState(false);
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [delivery, setDelivery] = useState<"smtp" | "simulation">("smtp");
  const [scheduled, setScheduled] = useState("");
  const [signatureManager, setSignatureManager] = useState(false);
  const [segmentModal, setSegmentModal] = useState(false);
  const [segmentId, setSegmentId] = useState("");
  const dirty = JSON.stringify(draft) !== baseline;
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    withResolver: true,
    enableBeforeUnload: dirty,
  });
  const rows = useMemo(
    () => audience(db, campaignOwner, draft.productId),
    [db, campaignOwner, draft.productId],
  );
  const filtered = rows.filter(
    (r) =>
      `${r.contact.firstName} ${r.contact.lastName} ${r.contact.company} ${r.contact.email}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!stage || r.association.stage === stage) &&
      (!owner || r.association.ownerId === owner) &&
      (!tag ||
        r.contact.tags?.some((t) =>
          t.toLowerCase().includes(tag.toLowerCase()),
        )),
  );
  const selected = rows.filter((r) =>
    draft.recipientIds.includes(r.contact.id),
  );
  const eligible = selected.filter((r) => r.eligible);
  const senders = allowedSenders(db, campaignOwner, draft.productId);
  const sender = senders.find((s) => s.id === draft.senderId);
  const signature = db.signatures.find((s) => s.id === draft.signatureId);
  const person =
    rows.find((r) => r.contact.id === previewId)?.contact ??
    eligible[0]?.contact ??
    rows[0]?.contact;
  const tokens = person
    ? tokensFor(db, person, draft.productId, sender)
    : {
        first_name: "there",
        last_name: "",
        company_name: "your organisation",
        product_name:
          db.products.find((p) => p.id === draft.productId)?.name ??
          "your product",
        assigned_bdo: `${user.firstName} ${user.lastName}`,
        sender_name: sender?.senderName ?? "ICE Business Development",
      };
  function update<K extends keyof CampaignInput>(
    key: K,
    value: CampaignInput[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
    setError("");
  }
  function close() {
    if (busy) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  function next() {
    setError("");
    if (step === 0 && (!draft.name.trim() || !draft.productId)) {
      setError("Enter a campaign name and choose a product.");
      return;
    }
    if (step === 1 && !eligible.length) {
      setError("Select at least one eligible contact.");
      return;
    }
    if (
      step === 2 &&
      (!sender ||
        !draft.subject.trim() ||
        !draft.bodyHtml.replace(/<[^>]*>/g, "").trim())
    ) {
      setError("Choose a sender and add an email subject and message.");
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  }
  async function save() {
    const parsed = campaignSchema.safeParse(draft);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    const campaignId = await api.saveCampaign(parsed.data, user.id, id);
    setId(campaignId);
    setBaseline(JSON.stringify(draft));
    await refresh();
    return campaignId;
  }
  async function saveDraft(exit = false) {
    try {
      setBusy(true);
      setError("");
      await save();
      toast.success("Campaign saved as draft");
      if (exit) onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const preview = (
    <EmailPreview
      draft={draft}
      tokens={tokens}
      signatureHtml={signature?.html}
      sender={
        sender ? `${sender.senderName} <${sender.email}>` : "Choose a sender"
      }
      recipient={person?.email ?? "Choose a contact"}
      mobile={mobile}
    />
  );
  return (
    <>
      <PageHeader
        eyebrow="MARKETING / CAMPAIGN BUILDER"
        title={
          initial
            ? "Make your message count."
            : "A new conversation starts here."
        }
        description="A considered message. The right people. One connected workflow."
        actions={
          <>
            <Button disabled={busy} onClick={close}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => saveDraft()}>
              <Save size={14} />
              Save draft
            </Button>
          </>
        }
      />
      <div className="campaign-stepper" aria-label="Campaign creation steps">
        {steps.map((label, i) => (
          <button
            key={label}
            className={`${step === i ? "active" : ""} ${step > i ? "complete" : ""}`}
            onClick={() => {
              if (i < step) {
                setStep(i);
                setError("");
              }
            }}
            disabled={i > step || busy}
            aria-current={step === i ? "step" : undefined}
          >
            <span>
              {step > i ? <Check size={13} /> : String(i + 1).padStart(2, "0")}
            </span>
            {label}
          </button>
        ))}
      </div>
      <div className="campaign-builder-layout">
        <section className="panel campaign-builder-panel">
          <div className="campaign-builder-heading">
            <span className="section-kicker">STEP {step + 1} / 5</span>
            <h2>
              {
                [
                  "Set the scene.",
                  "Choose your audience.",
                  "Give your message a voice.",
                  "See it through their eyes.",
                  "Ready when you are.",
                ][step]
              }
            </h2>
            <p>
              {
                [
                  "Give this campaign a clear purpose and a home in your portfolio.",
                  "Only consented, accessible contacts can be selected. Every person receives an individual message.",
                  "Compose once. Personalise for every relationship.",
                  "Check the subject, signature, and personalisation before you continue.",
                  "Review your campaign and choose its delivery mode and schedule.",
                ][step]
              }
            </p>
          </div>
          <div className="campaign-builder-content">
            {step === 0 && (
              <>
                <label>
                  Campaign name *
                  <input
                    autoFocus
                    value={draft.name}
                    maxLength={100}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="e.g. Cloud Connect · product introduction"
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Associated product *
                    <select
                      value={draft.productId}
                      onChange={(e) => {
                        const productId = e.target.value;
                        setDraft((d) => ({
                          ...d,
                          productId,
                          recipientIds: [],
                          senderId:
                            allowedSenders(db, campaignOwner, productId)[0]
                              ?.id ?? "",
                        }));
                      }}
                    >
                      <option value="">Choose a product</option>
                      {db.products
                        .filter(
                          (p) =>
                            p.status === "Active" &&
                            canAccessProduct(campaignOwner, p.id),
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Campaign type
                    <select
                      value={draft.type}
                      onChange={(e) =>
                        update("type", e.target.value as CampaignInput["type"])
                      }
                    >
                      {campaignTypes.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Description
                  <textarea
                    rows={4}
                    value={draft.description}
                    maxLength={500}
                    onChange={(e) => update("description", e.target.value)}
                    placeholder="What do you want this campaign to achieve?"
                  />
                </label>
                <div className="campaign-owner-note">
                  <Avatar
                    name={`${campaignOwner.firstName} ${campaignOwner.lastName}`}
                    small
                  />
                  <div>
                    <strong>
                      {campaignOwner.firstName} {campaignOwner.lastName}
                    </strong>
                    <span>Campaign owner · {campaignOwner.role}</span>
                  </div>
                </div>
                <p className="form-hint">
                  Changing the product resets recipient selection and the
                  sender. Your message is retained.
                </p>
              </>
            )}
            {step === 1 && (
              <>
                <div className="campaign-audience-counts">
                  <span>
                    <strong>{rows.length}</strong>Product contacts
                  </span>
                  <span>
                    <strong>{eligible.length}</strong>Selected & eligible
                  </span>
                  <span>
                    <strong>{rows.filter((r) => !r.eligible).length}</strong>
                    Excluded by preferences
                  </span>
                </div>
                <div className="campaign-audience-filters">
                  <div className="search-input">
                    <Search size={15} />
                    <input
                      aria-label="Search campaign audience"
                      placeholder="Search name, email, or company…"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setLimit(20);
                      }}
                    />
                  </div>
                  <select
                    aria-label="Audience lifecycle stage"
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                  >
                    <option value="">All lifecycle stages</option>
                    {stages.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Audience owner"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                  >
                    <option value="">All owners</option>
                    {db.users
                      .filter((u) =>
                        rows.some((r) => r.association.ownerId === u.id),
                      )
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName}
                        </option>
                      ))}
                  </select>
                  <input
                    aria-label="Audience tag"
                    placeholder="Filter by tag…"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                  />
                </div>
                <div className="campaign-segment-tools">
                  <label>
                    Saved audience
                    <select
                      aria-label="Saved campaign audiences"
                      value={segmentId}
                      onChange={(e) => {
                        setSegmentId(e.target.value);
                        const saved = db.audienceSegments.find(
                          (s) => s.id === e.target.value,
                        );
                        if (saved)
                          update(
                            "recipientIds",
                            saved.contactIds.filter((id) =>
                              rows.some(
                                (r) => r.contact.id === id && r.eligible,
                              ),
                            ),
                          );
                      }}
                    >
                      <option value="">Choose a saved audience</option>
                      {db.audienceSegments
                        .filter(
                          (s) =>
                            s.createdBy === user.id &&
                            s.productId === draft.productId,
                        )
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <Button
                    disabled={!eligible.length}
                    onClick={() => setSegmentModal(true)}
                  >
                    Save selected audience
                  </Button>
                  {segmentId && (
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await api.deleteAudienceSegment(segmentId, user.id);
                          setSegmentId("");
                          await refresh();
                          toast.success("Saved audience removed");
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      Remove saved audience
                    </Button>
                  )}
                </div>
                <div className="campaign-audience-actions">
                  <Button
                    onClick={() =>
                      update("recipientIds", [
                        ...new Set([
                          ...draft.recipientIds,
                          ...filtered
                            .filter((r) => r.eligible)
                            .map((r) => r.contact.id),
                        ]),
                      ])
                    }
                  >
                    <CheckCheck size={14} />
                    Select eligible
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => update("recipientIds", [])}
                  >
                    Clear selection
                  </Button>
                  <span>{draft.recipientIds.length} selected</span>
                </div>
                {filtered.length ? (
                  <div className="table-scroll campaign-audience-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Select</th>
                          <th>Contact</th>
                          <th>Lifecycle</th>
                          <th>Eligibility</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.slice(0, limit).map((r) => (
                          <tr
                            key={r.contact.id}
                            className={
                              !r.eligible ? "campaign-excluded-row" : ""
                            }
                          >
                            <td>
                              <input
                                type="checkbox"
                                disabled={
                                  !r.eligible &&
                                  !draft.recipientIds.includes(r.contact.id)
                                }
                                aria-label={`Select recipient ${r.contact.firstName} ${r.contact.lastName}`}
                                checked={draft.recipientIds.includes(
                                  r.contact.id,
                                )}
                                onChange={(e) =>
                                  update(
                                    "recipientIds",
                                    e.target.checked
                                      ? [...draft.recipientIds, r.contact.id]
                                      : draft.recipientIds.filter(
                                          (id) => id !== r.contact.id,
                                        ),
                                  )
                                }
                              />
                            </td>
                            <td>
                              <strong>
                                {r.contact.firstName} {r.contact.lastName}
                              </strong>
                              <small>{r.contact.email}</small>
                              <small>{r.contact.company}</small>
                            </td>
                            <td>
                              <Badge tone="neutral">
                                {r.association.stage}
                              </Badge>
                            </td>
                            <td>
                              <Badge tone={r.eligible ? "green" : "amber"}>
                                {r.eligible ? "Eligible" : r.reason}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="No matching contacts"
                    description="Try another filter or add contacts to this product."
                  />
                )}
                {filtered.length > limit && (
                  <Button onClick={() => setLimit((n) => n + 20)}>
                    Show more contacts
                  </Button>
                )}
              </>
            )}
            {step === 2 && (
              <>
                <div className="form-grid">
                  <label>
                    From account
                    <select
                      value={draft.senderId}
                      onChange={(e) => update("senderId", e.target.value)}
                    >
                      <option value="">Choose a verified sender</option>
                      {senders.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {s.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Signature
                    <select
                      value={draft.signatureId}
                      onChange={(e) => update("signatureId", e.target.value)}
                    >
                      <option value="">No signature</option>
                      {db.signatures
                        .filter(
                          (s) =>
                            !s.ownerId ||
                            s.ownerId === campaignOwner.id ||
                            campaignOwner.role === "Super Admin",
                        )
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <div className="campaign-signature-actions">
                  <Button
                    disabled={campaignOwner.id !== user.id}
                    title={
                      campaignOwner.id !== user.id
                        ? "Upload signatures from the campaign owner’s account"
                        : undefined
                    }
                    onClick={() => setSignatureManager(true)}
                  >
                    Upload or manage HTML signatures
                  </Button>
                  <p>
                    Use an existing HTML signature, including its colours,
                    layout, and images.
                  </p>
                </div>
                {sender && (
                  <p className="form-hint">
                    From: {sender.senderName} · Reply-to: {sender.replyTo}. Only
                    senders authorised by your administrator are available.
                  </p>
                )}
                <label>
                  Subject *
                  <input
                    maxLength={180}
                    value={draft.subject}
                    onChange={(e) => update("subject", e.target.value)}
                    placeholder="A better way forward for {{company_name}}"
                  />
                </label>
                <div className="campaign-message-label">Email message *</div>
                <Suspense
                  fallback={
                    <div className="campaign-editor-loading">
                      Loading email editor…
                    </div>
                  }
                >
                  <EmailComposer
                    value={draft.bodyHtml}
                    onChange={(value) => update("bodyHtml", value)}
                  />
                </Suspense>
                <p className="form-hint">
                  Use personalisation tokens in the subject or message. Missing
                  company names use “your organisation”; missing first names use
                  “there”.
                </p>
                {unknownTokens(draft.subject + draft.bodyHtml).length > 0 && (
                  <p className="field-error">
                    Unsupported tokens:{" "}
                    {unknownTokens(draft.subject + draft.bodyHtml).join(", ")}
                  </p>
                )}
              </>
            )}
            {step === 3 && (
              <>
                <div className="campaign-preview-controls">
                  <label>
                    Personalisation contact
                    <select
                      value={person?.id ?? ""}
                      onChange={(e) => setPreviewId(e.target.value)}
                    >
                      {rows.map((r) => (
                        <option key={r.contact.id} value={r.contact.id}>
                          {r.contact.firstName} {r.contact.lastName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="segmented">
                    <button
                      aria-label="Desktop email preview"
                      className={!mobile ? "active" : ""}
                      onClick={() => setMobile(false)}
                    >
                      <Monitor size={14} />
                    </button>
                    <button
                      aria-label="Mobile email preview"
                      className={mobile ? "active" : ""}
                      onClick={() => setMobile(true)}
                    >
                      <Smartphone size={14} />
                    </button>
                  </div>
                </div>
                {preview}
                <Button
                  disabled={!person || busy}
                  onClick={async () => {
                    try {
                      setBusy(true);
                      await save();
                      setTest(true);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <FlaskConical size={15} />
                  Validate server preview
                </Button>
              </>
            )}
            {step === 4 && (
              <>
                <div className="campaign-launch-summary">
                  <div>
                    <span>Campaign</span>
                    <strong>{draft.name}</strong>
                  </div>
                  <div>
                    <span>Product</span>
                    <strong>
                      {db.products.find((p) => p.id === draft.productId)?.name}
                    </strong>
                  </div>
                  <div>
                    <span>Sender</span>
                    <strong>{sender?.email ?? "Not selected"}</strong>
                  </div>
                  <div>
                    <span>Subject</span>
                    <strong>{draft.subject || "Not set"}</strong>
                  </div>
                  <div>
                    <span>Eligible selected recipients</span>
                    <strong>{eligible.length}</strong>
                  </div>
                  <div>
                    <span>Selected recipients now excluded</span>
                    <strong>
                      {draft.recipientIds.length - eligible.length}
                    </strong>
                  </div>
                </div>
                <fieldset className="campaign-launch-options">
                  <legend>When should it run?</legend>
                  <label className="checkbox-label">
                    <input
                      type="radio"
                      name="launch-mode"
                      checked={mode === "now"}
                      onChange={() => setMode("now")}
                    />
                    <span>
                      <Send size={15} />
                      Process now
                      <small>
                        Process personalised messages immediately. No email is
                        sent.
                      </small>
                    </span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="radio"
                      name="launch-mode"
                      checked={mode === "schedule"}
                      onChange={() => setMode("schedule")}
                    />
                    <span>
                      <Clock3 size={15} />
                      Schedule campaign
                      <small>
                        Schedules process while Campaigns is open, or when you
                        return.
                      </small>
                    </span>
                  </label>
                </fieldset>
                {mode === "schedule" && (
                  <label>
                    Schedule date & time (Africa/Johannesburg · SAST)
                    <input
                      type="datetime-local"
                      value={scheduled}
                      onChange={(e) => setScheduled(e.target.value)}
                    />
                  </label>
                )}
                <div className="callout">
                  Each recipient gets a separate personalised message. SMTP
                  acceptance is recorded; inbox delivery, opens, and clicks
                  require provider tracking.
                </div>
              </>
            )}
            {error && (
              <p className="field-error campaign-inline-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="campaign-builder-footer">
            <Button
              disabled={busy}
              onClick={() => (step ? setStep((s) => s - 1) : close())}
            >
              <ArrowLeft size={14} />
              {step ? "Back" : "Cancel"}
            </Button>
            <span>{step + 1} of 5</span>
            {step < 4 ? (
              <Button variant="primary" disabled={busy} onClick={next}>
                Continue
                <ArrowRight size={14} />
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={
                  busy || !eligible.length || !can(user, "campaigns.send")
                }
                onClick={() => {
                  if (
                    mode === "schedule" &&
                    (!scheduled ||
                      Date.parse(`${scheduled}:00+02:00`) <= Date.now())
                  ) {
                    setError("Choose a future schedule time in SAST.");
                    return;
                  }
                  setAck(false);
                  setConfirm(true);
                }}
              >
                Review campaign
                <ArrowRight size={14} />
              </Button>
            )}
          </div>
        </section>
        <aside className="campaign-builder-aside">
          <span className="section-kicker">
            THE RIGHT MESSAGE. THE RIGHT PEOPLE.
          </span>
          <h3>
            Make every
            <br />
            connection count.
          </h3>
          <div className="campaign-aside-stat">
            <strong>{eligible.length.toString().padStart(2, "0")}</strong>
            <span>eligible recipients selected</span>
          </div>
          <div className="campaign-aside-product">
            <span>PRODUCT</span>
            <strong>
              {db.products.find((p) => p.id === draft.productId)?.name ??
                "Choose your product"}
            </strong>
            <p>{draft.type}</p>
          </div>
          <div className="campaign-aside-note">
            <Check size={14} />
            <span>
              Consent and do-not-email preferences are checked again at
              processing time.
            </span>
          </div>
          <div className="campaign-aside-note">
            <Check size={14} />
            <span>
              One personalised message per person. No shared recipient lists.
            </span>
          </div>
          <span className="campaign-mode-pill">
            <span />
            CONNECTED TO CRM SERVER
          </span>
        </aside>
      </div>
      <Modal
        open={discard || blocker.status === "blocked"}
        onOpenChange={(v) => {
          if (!v) {
            setDiscard(false);
            blocker.reset?.();
          }
        }}
        title="Leave unsaved campaign changes?"
        description="Save your draft to keep your latest edits."
      >
        <div className="modal-footer">
          <Button
            onClick={() => {
              setDiscard(false);
              blocker.reset?.();
            }}
          >
            Keep editing
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setDiscard(false);
              if (blocker.status === "blocked") blocker.proceed();
              else onClose();
            }}
          >
            Discard changes
          </Button>
        </div>
      </Modal>
      <Modal
        open={confirm}
        onOpenChange={(v) => !busy && setConfirm(v)}
        title={
          mode === "now"
            ? "Confirm campaign launch"
            : "Confirm scheduled campaign"
        }
        description={
          delivery === "smtp"
            ? "Confirm recipients and content before sending through SMTP."
            : "Server simulation only. No real email will be sent."
        }
      >
        <div className="form-body">
          <label>
            Delivery mode
            <select
              value={delivery}
              onChange={(event) => {
                setDelivery(event.target.value as "smtp" | "simulation");
                setAck(false);
              }}
            >
              <option value="smtp">Send email via SMTP</option>
              <option value="simulation">
                Server simulation — no email sent
              </option>
            </select>
          </label>
          <div className="campaign-confirm-details">
            <strong>{draft.name}</strong>
            <span>
              {db.products.find((p) => p.id === draft.productId)?.name}
            </span>
            <span>Sender: {sender?.email ?? "Not selected"}</span>
            <span>Subject: {draft.subject}</span>
            <span>
              {eligible.length} eligible ·{" "}
              {draft.recipientIds.length - eligible.length} excluded selected
              contacts
            </span>
            {mode === "schedule" && (
              <span>{scheduled.replace("T", " at ")} SAST</span>
            )}
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            <span>
              {delivery === "smtp"
                ? "I authorise sending this campaign to the selected recipients."
                : "I confirm this server simulation will send no real email."}
            </span>
          </label>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <Button disabled={busy} onClick={() => setConfirm(false)}>
            Keep reviewing
          </Button>
          <Button
            variant="primary"
            disabled={!ack}
            loading={busy}
            onClick={async () => {
              try {
                setBusy(true);
                setError("");
                const campaignId = await save();
                await api.submitCampaign(
                  campaignId,
                  {
                    mode,
                    delivery,
                    scheduledAt:
                      mode === "schedule"
                        ? new Date(`${scheduled}:00+02:00`).toISOString()
                        : undefined,
                    confirmed: ack,
                  },
                  user.id,
                );
                await refresh();
                setConfirm(false);
                toast.success(
                  mode === "now"
                    ? "Campaign queued for server processing."
                    : "Campaign scheduled on the server.",
                );
                onSubmitted(campaignId);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {mode === "now" ? "Launch campaign" : "Schedule campaign"}
          </Button>
        </div>
      </Modal>
      <Modal
        open={segmentModal}
        onOpenChange={(v) => !busy && setSegmentModal(v)}
        title="Save selected audience"
        description="Saved selections are checked against current consent and access whenever applied."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setBusy(true);
              await api.saveAudienceSegment(
                String(new FormData(e.currentTarget).get("name")),
                draft.productId,
                eligible.map((r) => r.contact.id),
                user.id,
              );
              await refresh();
              setSegmentModal(false);
              toast.success("Audience saved");
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-body">
            <label>
              Audience name
              <input name="name" required maxLength={60} />
            </label>
          </div>
          <div className="modal-footer">
            <Button
              type="button"
              disabled={busy}
              onClick={() => setSegmentModal(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={busy}>
              Save audience
            </Button>
          </div>
        </form>
      </Modal>
      {signatureManager && (
        <SignatureManager
          onClose={() => setSignatureManager(false)}
          onSelect={(id) => update("signatureId", id)}
        />
      )}
      <Modal
        open={test}
        onOpenChange={(v) => !busy && setTest(v)}
        title="Validate server preview"
        description="Check the saved personalised draft against server-side consent and access rules. No email is sent."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setBusy(true);
              await api.validateCampaignPreview(id!, person!.id);
              toast.success("Server preview validated. No email sent.");
              setTest(false);
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-body">
            <p>
              The server checks the draft for{" "}
              {person?.email ?? "the selected contact"}.
            </p>
          </div>
          <div className="modal-footer">
            <Button
              type="button"
              disabled={busy}
              onClick={() => setTest(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" loading={busy} type="submit">
              Validate preview
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
