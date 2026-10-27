import { useState } from "react";
import {
  CalendarPlus,
  Check,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useCRM } from "../../app/context";
import { Badge, Button, Empty, Modal } from "../../components/ui/primitives";
import { can, canAccessProduct } from "../../lib/permissions";
import { api } from "../../services/api";
import { date } from "../../lib/format";
import type { Contact, FollowUp } from "../../types";

export function DeleteContacts({
  ids,
  onClose,
  onDeleted,
}: {
  ids: string[];
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const { db, user, refresh } = useCRM();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const relations = new Set(
    db.associations.filter((a) => ids.includes(a.contactId)).map((a) => a.id),
  );
  return (
    <Modal
      open
      onOpenChange={(v) => !v && !busy && onClose()}
      title={
        ids.length === 1 ? "Delete contact?" : `Delete ${ids.length} contacts?`
      }
      description="This permanently removes the selected people and their product relationships."
    >
      <div className="form-body">
        <p className="callout">
          This also deletes{" "}
          {db.leads.filter((l) => relations.has(l.associationId)).length} lead
          records,{" "}
          {db.clients.filter((c) => relations.has(c.associationId)).length}{" "}
          client records, and{" "}
          {db.followUps.filter((f) => relations.has(f.associationId)).length}{" "}
          follow-ups. Existing activity descriptions remain in the audit log.
          This cannot be undone.
        </p>
        <div className="contact-delete-names">
          {db.contacts
            .filter((c) => ids.includes(c.id))
            .slice(0, 8)
            .map((c) => (
              <span key={c.id}>
                {c.firstName} {c.lastName}
                <small>{c.email}</small>
              </span>
            ))}
          {ids.length > 8 && <small>and {ids.length - 8} more contacts</small>}
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="modal-footer">
        <Button disabled={busy} onClick={onClose}>
          Keep contacts
        </Button>
        <Button
          variant="danger"
          loading={busy}
          onClick={async () => {
            try {
              setBusy(true);
              await api.deleteContacts(ids, user.id);
              await refresh();
              toast.success(
                `${ids.length} contact${ids.length === 1 ? "" : "s"} deleted`,
              );
              onDeleted?.();
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Trash2 size={14} />
          Delete permanently
        </Button>
      </div>
    </Modal>
  );
}
export function ContactRelationships({ contact }: { contact: Contact }) {
  const { db, user, refresh } = useCRM();
  const [selectedProduct, setSelectedProduct] = useState("");
  const [action, setAction] = useState<{
    type: "add" | "remove" | "owner";
    id?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const relations = db.associations.filter((a) => a.contactId === contact.id);
  const available = db.products.filter(
    (p) =>
      p.status === "Active" && !relations.some((a) => a.productId === p.id),
  );
  const chosen = relations.find((a) => a.id === action?.id);
  return (
    <>
      <div className="contact-section-actions">
        <p>Each product keeps its own owner and lifecycle.</p>
        <Button
          disabled={!available.length}
          onClick={() => {
            setSelectedProduct(available[0]?.id ?? "");
            setAction({ type: "add" });
            setError("");
          }}
        >
          <Plus size={14} />
          Add product
        </Button>
      </div>
      {relations.map((a) => {
        const product = db.products.find((p) => p.id === a.productId)!;
        const owner = db.users.find((u) => u.id === a.ownerId)!;
        const protectedHistory =
          a.stage !== "Contact" ||
          db.followUps.some((f) => f.associationId === a.id);
        return (
          <div className="contact-association-tools" key={a.id}>
            <span>{product.name}</span>
            <small>
              {owner.firstName} {owner.lastName}
            </small>
            {can(user, "products.manage") && (
              <button
                className="icon-button"
                aria-label={`Reassign ${product.name}`}
                onClick={() => {
                  setAction({ type: "owner", id: a.id });
                  setError("");
                }}
              >
                <Pencil size={14} />
              </button>
            )}
            <button
              className="icon-button product-delete-action"
              disabled={relations.length <= 1 || protectedHistory}
              aria-label={`Remove ${product.name} relationship`}
              title={
                protectedHistory
                  ? "History must be retained"
                  : relations.length <= 1
                    ? "At least one product is required"
                    : "Remove relationship"
              }
              onClick={() => {
                setAction({ type: "remove", id: a.id });
                setError("");
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
      {action && (
        <Modal
          open
          onOpenChange={(v) => !v && !busy && setAction(null)}
          title={
            action.type === "add"
              ? "Add product relationship"
              : action.type === "owner"
                ? "Reassign relationship"
                : "Remove product relationship?"
          }
          description={
            action.type === "remove"
              ? "Only this product association will be removed. The person and their other relationships remain."
              : `${contact.firstName} ${contact.lastName}`
          }
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                setBusy(true);
                if (action.type === "add")
                  await api.addContactProduct(
                    contact.id,
                    String(f.get("product")),
                    String(f.get("owner")),
                    user.id,
                  );
                else if (action.type === "owner")
                  await api.reassignContactProduct(
                    action.id!,
                    String(f.get("owner")),
                    user.id,
                  );
                else await api.removeContactProduct(action.id!, user.id);
                await refresh();
                setAction(null);
                toast.success("Product relationships updated");
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-body">
              {action.type === "add" && (
                <label>
                  Product
                  <select
                    name="product"
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                  >
                    {available.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {action.type !== "remove" && (
                <label>
                  Assigned owner
                  <select
                    name="owner"
                    defaultValue={chosen?.ownerId ?? user.id}
                  >
                    {db.users
                      .filter(
                        (u) =>
                          (user.role === "Super Admin" || u.id === user.id) &&
                          canAccessProduct(
                            u,
                            chosen?.productId ?? selectedProduct,
                          ),
                      )
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName}
                        </option>
                      ))}
                  </select>
                  <small className="form-hint">
                    The owner must have access to the selected product. Open
                    follow-ups move with a reassigned relationship.
                  </small>
                </label>
              )}
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <Button
                type="button"
                disabled={busy}
                onClick={() => setAction(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={action.type === "remove" ? "danger" : "primary"}
                loading={busy}
              >
                {action.type === "remove"
                  ? "Remove relationship"
                  : "Save relationship"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export function FollowUps({ contact }: { contact: Contact }) {
  const { db, user, refresh } = useCRM();
  const [editor, setEditor] = useState<FollowUp | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const relations = db.associations.filter((a) => a.contactId === contact.id);
  const tasks = db.followUps
    .filter((f) => relations.some((a) => a.id === f.associationId))
    .sort(
      (a, b) =>
        (a.status === b.status ? 0 : a.status === "Open" ? -1 : 1) ||
        a.dueDate.localeCompare(b.dueDate),
    );
  return (
    <>
      <div className="contact-section-actions">
        <p>Follow through on every conversation.</p>
        <Button
          onClick={() => {
            setEditor("new");
            setError("");
          }}
        >
          <CalendarPlus size={14} />
          Schedule follow-up
        </Button>
      </div>
      {tasks.length ? (
        tasks.map((f) => (
          <div
            className={`contact-task ${f.status === "Completed" ? "completed" : ""}`}
            key={f.id}
          >
            <div>
              <strong>{f.title}</strong>
              <span>
                {
                  db.products.find(
                    (p) =>
                      p.id ===
                      relations.find((a) => a.id === f.associationId)
                        ?.productId,
                  )?.name
                }{" "}
                · {date(f.dueDate)} ·{" "}
                {db.users.find((u) => u.id === f.ownerId)?.firstName}
              </span>
              {f.notes && <p>{f.notes}</p>}
            </div>
            <Badge
              tone={
                f.status === "Completed"
                  ? "green"
                  : f.priority === "High"
                    ? "amber"
                    : "neutral"
              }
            >
              {f.status === "Completed"
                ? "Completed"
                : `${f.priority} priority`}
            </Badge>
            {f.status === "Open" && (
              <button
                className="icon-button"
                aria-label={`Edit follow-up ${f.title}`}
                onClick={() => {
                  setEditor(f);
                  setError("");
                }}
              >
                <Pencil size={14} />
              </button>
            )}
            <button
              className="icon-button"
              disabled={busy}
              aria-label={`${f.status === "Open" ? "Complete" : "Reopen"} follow-up ${f.title}`}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.setFollowUpStatus(
                    f.id,
                    f.status === "Open" ? "Completed" : "Open",
                    user.id,
                  );
                  await refresh();
                  toast.success("Follow-up updated");
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {f.status === "Open" ? (
                <Check size={16} />
              ) : (
                <RotateCcw size={14} />
              )}
            </button>
          </div>
        ))
      ) : (
        <Empty
          title="No follow-ups yet"
          description="Schedule a next step for one of this contact's products."
        />
      )}
      {editor && (
        <Modal
          open
          onOpenChange={(v) => !v && !busy && setEditor(null)}
          title={editor === "new" ? "Schedule follow-up" : "Edit follow-up"}
          description={`${contact.firstName} ${contact.lastName}`}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                setBusy(true);
                await api.saveFollowUp(
                  {
                    associationId: String(f.get("relationship")),
                    title: String(f.get("title")),
                    dueDate: String(f.get("date")),
                    priority: f.get("priority") as FollowUp["priority"],
                    notes: String(f.get("notes")),
                  },
                  user.id,
                  editor === "new" ? undefined : editor.id,
                );
                await refresh();
                toast.success("Follow-up saved");
                setEditor(null);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-body">
              <label>
                Follow-up title
                <input
                  name="title"
                  required
                  maxLength={160}
                  defaultValue={editor === "new" ? "" : editor.title}
                  placeholder="e.g. Discuss proposal"
                />
              </label>
              <label>
                Product relationship
                <select
                  name="relationship"
                  defaultValue={
                    editor === "new" ? relations[0]?.id : editor.associationId
                  }
                >
                  {relations
                    .filter(
                      (a) => editor === "new" || a.id === editor.associationId,
                    )
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {db.products.find((p) => p.id === a.productId)?.name} ·{" "}
                        {db.users.find((u) => u.id === a.ownerId)?.firstName}
                      </option>
                    ))}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  Due date
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={
                      editor === "new"
                        ? new Date().toLocaleDateString("en-CA", {
                            timeZone: "Africa/Johannesburg",
                          })
                        : editor.dueDate
                    }
                  />
                </label>
                <label>
                  Priority
                  <select
                    name="priority"
                    defaultValue={editor === "new" ? "Medium" : editor.priority}
                  >
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </label>
              </div>
              <label>
                Notes
                <textarea
                  name="notes"
                  rows={3}
                  maxLength={5000}
                  defaultValue={editor === "new" ? "" : editor.notes}
                />
              </label>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <Button
                type="button"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={busy}>
                Save follow-up
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
