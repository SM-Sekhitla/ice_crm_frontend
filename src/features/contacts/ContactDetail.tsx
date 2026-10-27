import { ContactForm } from "./ContactForm";
import {
  ContactRelationships,
  DeleteContacts,
  FollowUps,
} from "./ContactActions";
import { can } from "../../lib/permissions";
import { useState } from "react";
import {
  ArrowRight,
  Building2,
  Mail,
  Phone,
  Save,
  Pencil,
  CalendarPlus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useCRM } from "../../app/context";
import { Avatar, Badge, Button, Modal } from "../../components/ui/primitives";
import { date, money, relative } from "../../lib/format";
import { api } from "../../services/api";
import type { Association, Stage } from "../../types";
export function ContactDetail({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const { db, user, refresh } = useCRM();
  const contact = db.contacts.find((c) => c.id === id);
  const [tab, setTab] = useState("Overview");
  const [notes, setNotes] = useState<string | null>(null);
  const [transition, setTransition] = useState<{
    association: Association;
    stage: Stage;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [discard, setDiscard] = useState(false);
  return (
    <>
      <Modal
        open={!!contact}
        onOpenChange={(v) => {
          if (!v) {
            if (notes !== null && notes !== contact?.notes) {
              setDiscard(true);
              return;
            }
            onClose();
            setNotes(null);
            setTab("Overview");
          }
        }}
        title="Contact workspace"
        description="One person. Every relationship, in one place."
        drawer
      >
        {contact && (
          <>
            <div className="contact-profile">
              <Avatar name={`${contact.firstName} ${contact.lastName}`} />
              <h2>
                {contact.firstName} {contact.lastName}
              </h2>
              <p>
                {contact.jobTitle} · {contact.company}
              </p>
              <div>
                <a href={`mailto:${contact.email}`}>
                  <Mail size={14} />
                  {contact.email}
                </a>
                <a href={`tel:${contact.phone}`}>
                  <Phone size={14} />
                  {contact.phone}
                </a>
              </div>
            </div>
            <div className="contact-record-actions">
              <Button onClick={() => setEditing(true)}>
                <Pencil size={14} />
                Edit contact
              </Button>
              <Button onClick={() => setTab("Follow-ups")}>
                <CalendarPlus size={14} />
                View follow-ups
              </Button>
              {can(user, "contacts.delete") && (
                <button
                  className="icon-button product-delete-action"
                  aria-label="Delete contact"
                  onClick={() => setDeleting(true)}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <div className="tabs record-tabs">
              {[
                "Overview",
                "Products",
                "Follow-ups",
                "Emails",
                "Notes",
                "Activities",
              ].map((t) => (
                <button
                  className={tab === t ? "active" : ""}
                  key={t}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="record-body">
              {tab === "Overview" && (
                <>
                  <h3>Contact information</h3>
                  <dl className="detail-grid">
                    <dt>Company</dt>
                    <dd>
                      <Building2 size={14} />
                      {contact.company || "—"}
                    </dd>
                    <dt>Source</dt>
                    <dd>{contact.source}</dd>
                    <dt>Created</dt>
                    <dd>{date(contact.createdAt)}</dd>
                    <dt>Marketing consent</dt>
                    <dd>
                      <Badge
                        tone={
                          contact.consent && !contact.doNotEmail
                            ? "green"
                            : "neutral"
                        }
                      >
                        {contact.consent && !contact.doNotEmail
                          ? "Opted in"
                          : "No consent"}
                      </Badge>
                    </dd>
                    <dt>Alternative phone</dt>
                    <dd>{contact.alternativePhone || "—"}</dd>
                    <dt>Industry</dt>
                    <dd>{contact.industry || "—"}</dd>
                    <dt>Website</dt>
                    <dd>
                      {contact.website ? (
                        <a
                          href={
                            /^https?:\/\//i.test(contact.website)
                              ? contact.website
                              : undefined
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          {contact.website}
                        </a>
                      ) : (
                        "—"
                      )}
                    </dd>
                    <dt>Location</dt>
                    <dd>
                      {[
                        contact.city,
                        contact.province,
                        contact.country ?? "South Africa",
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </dd>
                    <dt>Address</dt>
                    <dd>{contact.address || "—"}</dd>
                    <dt>Tags</dt>
                    <dd>{contact.tags?.join(", ") || "—"}</dd>
                    <dt>Do not email</dt>
                    <dd>{contact.doNotEmail ? "Yes" : "No"}</dd>
                    <dt>Consent source</dt>
                    <dd>{contact.consentSource || "—"}</dd>
                    <dt>Consent date</dt>
                    <dd>
                      {contact.consentDate ? date(contact.consentDate) : "—"}
                    </dd>
                  </dl>
                  <h3>Product relationships</h3>
                </>
              )}
              {(tab === "Overview" || tab === "Products") &&
                db.associations
                  .filter((a) => a.contactId === id)
                  .map((a) => {
                    const p = db.products.find((p) => p.id === a.productId)!;
                    const owner = db.users.find((u) => u.id === a.ownerId)!;
                    const lead = db.leads.find((l) => l.associationId === a.id);
                    return (
                      <div className="relationship-card" key={a.id}>
                        <div>
                          <span
                            className="product-icon"
                            style={{
                              color: p.color,
                              background: `${p.color}18`,
                            }}
                          >
                            {p.code}
                          </span>
                          <div>
                            <strong>{p.name}</strong>
                            <p>
                              {owner.firstName} {owner.lastName}
                            </p>
                          </div>
                          <Badge
                            tone={
                              a.stage === "Client"
                                ? "green"
                                : a.stage === "Contact"
                                  ? "neutral"
                                  : "blue"
                            }
                          >
                            {a.stage}
                          </Badge>
                        </div>
                        {lead && (
                          <p className="relationship-value">
                            Expected value{" "}
                            <strong>{money(lead.expectedValue)}</strong>
                          </p>
                        )}
                        {a.stage === "Contact" ? (
                          <Button
                            variant="primary"
                            onClick={() =>
                              setTransition({
                                association: a,
                                stage: "New Lead",
                              })
                            }
                          >
                            Convert to lead <ArrowRight size={14} />
                          </Button>
                        ) : a.stage !== "Client" ? (
                          <Button
                            onClick={() =>
                              setTransition({ association: a, stage: "Client" })
                            }
                          >
                            Convert to client <ArrowRight size={14} />
                          </Button>
                        ) : (
                          <p className="form-hint">
                            Client since{" "}
                            {date(
                              db.clients.find((c) => c.associationId === a.id)
                                ?.clientSince || a.createdAt,
                            )}
                          </p>
                        )}
                      </div>
                    );
                  })}
              {tab === "Products" && <ContactRelationships contact={contact} />}
              {tab === "Follow-ups" && <FollowUps contact={contact} />}
              {tab === "Emails" && (
                <>
                  <p className="form-hint">
                    Campaign processing history. SMTP acceptance does not
                    indicate real email delivery.
                  </p>
                  {db.campaignRecipients
                    .filter((r) => r.contactId === contact.id)
                    .map((r) => (
                      <div className="contact-task" key={r.id}>
                        <div>
                          <strong>
                            {db.campaigns.find((c) => c.id === r.campaignId)
                              ?.name ?? "Campaign"}
                          </strong>
                          <span>
                            {r.email} ·{" "}
                            {r.processedAt ? date(r.processedAt) : "Queued"}
                          </span>
                          <p>
                            {r.reason || "Waiting for scheduled processing."}
                          </p>
                        </div>
                        <Badge
                          tone={
                            r.status === "Simulated" || r.status === "Accepted"
                              ? "green"
                              : "neutral"
                          }
                        >
                          {r.status}
                        </Badge>
                      </div>
                    ))}
                  {!db.campaignRecipients.some(
                    (r) => r.contactId === contact.id,
                  ) && (
                    <p className="callout">
                      No campaign activity for this contact yet.
                    </p>
                  )}
                </>
              )}
              {tab === "Notes" && (
                <>
                  <label>
                    Internal notes
                    <textarea
                      rows={9}
                      value={notes ?? contact.notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add context for your team…"
                    />
                  </label>
                  <Button
                    variant="primary"
                    loading={busy}
                    onClick={async () => {
                      try {
                        setBusy(true);
                        await api.addNote(
                          contact.id,
                          notes ?? contact.notes,
                          user.id,
                        );
                        await refresh();
                        toast.success("Notes saved");
                      } catch (e) {
                        toast.error((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Save size={14} />
                    Save notes
                  </Button>
                </>
              )}
              {tab === "Activities" && (
                <div className="detail-timeline">
                  {db.activities
                    .filter((a) => a.contactId === id)
                    .map((a) => (
                      <div key={a.id}>
                        <span className="timeline-dot" />
                        <strong>{a.description}</strong>
                        <small>
                          {db.users.find((u) => u.id === a.userId)?.firstName} ·{" "}
                          {relative(a.createdAt)}
                        </small>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </>
        )}
      </Modal>
      {editing && contact && (
        <ContactForm
          open
          contact={contact}
          setOpen={(v) => !v && setEditing(false)}
        />
      )}
      {deleting && contact && (
        <DeleteContacts
          ids={[contact.id]}
          onClose={() => setDeleting(false)}
          onDeleted={onClose}
        />
      )}
      <Modal
        open={discard}
        onOpenChange={setDiscard}
        title="Discard unsaved notes?"
        description="Your notes have not been saved."
      >
        <div className="modal-footer">
          <Button onClick={() => setDiscard(false)}>Keep editing</Button>
          <Button variant="danger" onClick={onClose}>
            Discard notes
          </Button>
        </div>
      </Modal>
      {transition && (
        <TransitionDialog
          association={transition.association}
          stage={transition.stage}
          onClose={() => setTransition(null)}
        />
      )}
    </>
  );
}
export function TransitionDialog({
  association,
  stage,
  onClose,
}: {
  association: Association;
  stage: Stage;
  onClose: () => void;
}) {
  const { db, user, refresh } = useCRM();
  const c = db.contacts.find((c) => c.id === association.contactId)!;
  const p = db.products.find((p) => p.id === association.productId)!;
  const lead = db.leads.find((l) => l.associationId === association.id);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={
        stage === "Client"
          ? "Convert to client"
          : stage === "New Lead"
            ? "Convert to lead"
            : `Move to ${stage}`
      }
      description={`${c.firstName} ${c.lastName} · ${p.name}`}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          try {
            setBusy(true);
            await api.updateStage(association.id, stage, user.id, {
              value: Number(form.get("value")),
              followUp: String(form.get("followUp") || ""),
              notes: String(form.get("notes") || ""),
              reference: String(form.get("reference") || ""),
              conversionDate: String(form.get("conversionDate") || ""),
            });
            await refresh();
            toast.success(`${c.firstName} moved to ${stage} for ${p.name}`);
            onClose();
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-body">
          <div className="callout">
            This updates the relationship with {p.name} and preserves the
            contact's history.
          </div>
          {["New Lead", "Client"].includes(stage) && (
            <label>
              {stage === "Client" ? "Deal value" : "Expected value"} (ZAR)
              <input
                type="number"
                name="value"
                min="0"
                step="0.01"
                defaultValue={lead?.expectedValue || 0}
              />
            </label>
          )}
          {stage === "New Lead" && (
            <label>
              Next follow-up
              <input
                type="date"
                name="followUp"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
          )}
          {stage === "Client" && (
            <>
              <label>
                Conversion date
                <input
                  type="date"
                  name="conversionDate"
                  required
                  max={new Date().toISOString().slice(0, 10)}
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </label>
              <label>
                Client reference
                <input name="reference" placeholder="Optional reference" />
              </label>
            </>
          )}
          <label>
            {["Lost", "Not Interested"].includes(stage)
              ? "Outcome reason *"
              : "Notes"}
            <textarea
              name="notes"
              required={["Lost", "Not Interested"].includes(stage)}
              rows={3}
            />
          </label>
        </div>
        <div className="modal-footer">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} type="submit">
            Confirm {stage === "Client" ? "conversion" : "change"}
            <ArrowRight size={14} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
