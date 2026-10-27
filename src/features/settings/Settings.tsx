import { useState, type FormEvent } from "react";
import { Database, MailPlus, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { RecordActions } from "../../components/ui/RecordActions";
import { PasswordInput } from "../../components/ui/PasswordInput";
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
import { deleteUserAccount, updateUser } from "../../services/user-management";
import { can } from "../../lib/permissions";
import { clearSession, json, request } from "../../services/http";
import type { User } from "../../types";
import type { SenderConfiguration } from "../../types/campaigns";
import { SignatureManager } from "../signatures/SignatureManager";

export function Settings() {
  const { user } = useCRM();
  return (
    <>
      <PageHeader
        eyebrow="MAKE IT YOUR WORKSPACE"
        title="Settings"
        description="Your workspace connection and account security."
      />
      <div className="settings-layout">
        <section className="panel settings-panel">
          <div className="settings-row">
            <div>
              <h3>
                <Database size={17} />
                CRM server
              </h3>
              <p>
                CRM records are stored in PostgreSQL and loaded from your
                workspace API.
              </p>
            </div>
            <Badge tone="green">Connected</Badge>
          </div>
          <div className="settings-row">
            <div>
              <h3>
                <ShieldCheck size={17} />
                Role & access
              </h3>
              <p>
                Signed in as {user.firstName} {user.lastName}. Your
                administrator manages your access.
              </p>
            </div>
            <Badge>{user.role}</Badge>
          </div>
          <div className="settings-row">
            <div>
              <h3>Time zone</h3>
              <p>Dates are displayed in South African local time.</p>
            </div>
            <span>Africa/Johannesburg</span>
          </div>
        </section>
        <PasswordForm />
      </div>
    </>
  );
}
function PasswordForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="panel settings-password-panel">
      <div className="settings-section-heading">
        <h3>Change password</h3>
        <p>Choose a strong password. Updating it signs out all sessions.</p>
      </div>
      <form
        className="settings-password-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setError("");
          if (data.get("password") !== data.get("confirmation")) {
            setError("The new passwords do not match.");
            return;
          }
          setBusy(true);
          try {
            await request(
              "/auth/password",
              json("POST", {
                currentPassword: data.get("currentPassword"),
                password: data.get("password"),
              }),
            );
            clearSession();
            toast.success("Password updated. Please sign in again.");
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label className="settings-current-password">
            Current password
            <PasswordInput
              visibilityLabel="current password"
              disabled={busy}
              name="currentPassword"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <label>
            New password
            <PasswordInput
              visibilityLabel="new password"
              disabled={busy}
              name="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
          </label>
          <label>
            Confirm new password
            <PasswordInput
              visibilityLabel="password confirmation"
              disabled={busy}
              name="confirmation"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" loading={busy}>
          Change password
        </Button>
      </form>
    </section>
  );
}
export function Profile() {
  const { user, db } = useCRM();
  const [signatures, setSignatures] = useState(false);
  return (
    <>
      <PageHeader
        eyebrow="THE PERSON BEHIND THE CONNECTIONS"
        title="My profile"
        description="Your account and place in the workspace."
      />
      <section className="panel profile-panel">
        <Avatar name={`${user.firstName} ${user.lastName}`} />
        <h2>
          {user.firstName} {user.lastName}
        </h2>
        <p>{user.email}</p>
        <Badge tone="blue">{user.role}</Badge>
        <dl className="detail-grid">
          <dt>Workspace</dt>
          <dd>ICE business development</dd>
          <dt>Assigned products</dt>
          <dd>
            {user.role === "Super Admin"
              ? "All products"
              : user.productIds.length}
          </dd>
          <dt>Contacts managed</dt>
          <dd>
            {
              new Set(
                db.associations
                  .filter((a) => a.ownerId === user.id)
                  .map((a) => a.contactId),
              ).size
            }
          </dd>
          <dt>Time zone</dt>
          <dd>Africa/Johannesburg</dd>
          <dt>Email signatures</dt>
          <dd>
            <Button onClick={() => setSignatures(true)}>
              Manage email signatures
            </Button>
          </dd>
          <dt>Authentication</dt>
          <dd>Secure CRM account</dd>
        </dl>
      </section>
      {signatures && <SignatureManager onClose={() => setSignatures(false)} />}
    </>
  );
}
export function AdministrationPage({ type }: { type: "users" | "email" }) {
  const { db, user, refresh } = useCRM();
  const [editing, setEditing] = useState<
    User | SenderConfiguration | "new" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<User | null>(null);
  const [replacement, setReplacement] = useState(user.id);
  const [deleteError, setDeleteError] = useState("");
  const permission = type === "users" ? "users.manage" : "email_config.manage";
  if (!can(user, permission))
    return (
      <PageHeader
        title="Access restricted"
        description="This section is available to workspace administrators."
      />
    );
  const isUser = type === "users";
  const record = editing && editing !== "new" ? editing : null;
  const staff = isUser ? (record as User | null) : null;
  const sender = !isUser ? (record as SenderConfiguration | null) : null;
  const open = (value: typeof editing) => {
    setEditing(value);
    setError("");
  };
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const productIds = data.getAll("productIds").map(String);
    try {
      if (isUser) {
        const fields = {
          firstName: String(data.get("firstName")),
          lastName: String(data.get("lastName")),
          email: String(data.get("email")),
          role: String(data.get("role")) as User["role"],
          productIds,
        };
        if (staff)
          await updateUser(staff.id, {
            ...fields,
            active: data.get("active") === "on",
          });
        else await request("/users", json("POST", fields));
      } else {
        await request(
          sender ? `/senders/${sender.id}` : "/senders",
          json(sender ? "PUT" : "POST", {
            name: data.get("name"),
            senderName: data.get("senderName"),
            email: data.get("email"),
            replyTo: data.get("replyTo"),
            status: data.get("verified") === "on" ? "Verified" : "Unverified",
            productIds,
            userIds: data.getAll("userIds").map(String),
          }),
        );
      }
      setEditing(null);
      await refresh();
      toast.success(
        isUser
          ? staff
            ? "Account saved"
            : "Invitation queued for email delivery"
          : "Sender saved",
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE ADMINISTRATION"
        title={isUser ? "User management" : "Email configurations"}
        description={
          isUser
            ? "Manage team accounts, roles, and product access."
            : "Authorised sender identities for SMTP or Brevo delivery."
        }
        actions={
          <Button variant="primary" onClick={() => open("new")}>
            {isUser ? "Add user" : "Add sender"}
          </Button>
        }
      />
      {!isUser && (
        <div className="callout">
          The server uses {db.emailProvider.toUpperCase()}. Real delivery is{" "}
          {db.emailDeliveryEnabled ? "enabled" : "disabled"}. Add only addresses
          authorised by your provider.
          {db.emailProvider === "brevo" &&
            ` Campaigns use the sender you select. The default invitation sender is ${db.brevoFromEmail || "not configured"}.`}
        </div>
      )}
      <section className="panel table-scroll">
        {isUser ? (
          <table>
            <thead>
              <tr>
                <th>Team member</th>
                <th>Email</th>
                <th>Role</th>
                <th>Product access</th>
                <th>Status</th>
                <th className="record-actions-heading" scope="col">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {db.users
                .filter((member) => !member.deletedAt)
                .map((member) => (
                  <tr key={member.id}>
                    <td>
                      {member.firstName} {member.lastName}
                    </td>
                    <td>{member.email}</td>
                    <td>{member.role}</td>
                    <td>
                      {member.role === "Super Admin"
                        ? "All products"
                        : member.productIds.length}
                    </td>
                    <td>
                      <Badge
                        tone={
                          member.active === false
                            ? "neutral"
                            : member.passwordSet === false
                              ? "amber"
                              : "green"
                        }
                      >
                        {member.active === false
                          ? "Inactive"
                          : member.passwordSet === false
                            ? "Invitation pending"
                            : "Active"}
                      </Badge>
                      {member.passwordSet === false && (
                        <small
                          className="invitation-delivery-note"
                          title={member.invitationReason}
                        >
                          {member.invitationStatus === "Accepted"
                            ? "Invitation email accepted by provider"
                            : (member.invitationStatus ??
                              "Awaiting invitation")}
                          {member.invitationExpiresAt &&
                          Date.parse(member.invitationExpiresAt) < Date.now()
                            ? " · expired"
                            : ""}
                        </small>
                      )}
                    </td>
                    <td className="user-actions-cell">
                      <RecordActions
                        label={`Actions for ${member.firstName} ${member.lastName}`}
                        disabled={busy}
                        actions={[
                          {
                            label: "Edit user",
                            icon: <Pencil size={16} />,
                            onSelect: () => open(member),
                          },
                          ...(member.active !== false &&
                          member.passwordSet === false
                            ? [
                                {
                                  label: "Resend invitation",
                                  icon: <MailPlus size={16} />,
                                  onSelect: async () => {
                                    setBusy(true);
                                    try {
                                      await request(
                                        `/users/${member.id}/invitation`,
                                        json("POST"),
                                      );
                                      await refresh();
                                      toast.success(
                                        "New invitation queued. Previous links are now invalid.",
                                      );
                                    } catch (error) {
                                      toast.error((error as Error).message);
                                    } finally {
                                      setBusy(false);
                                    }
                                  },
                                },
                              ]
                            : []),
                          {
                            label: "Delete user",
                            icon: <Trash2 size={16} />,
                            destructive: true,
                            disabled: member.id === user.id,
                            onSelect: () => {
                              setDeleting(member);
                              setReplacement(user.id);
                              setDeleteError("");
                            },
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Sender</th>
                <th>From address</th>
                <th>Provider</th>
                <th>Product access</th>
                <th>Status</th>
                <th className="record-actions-heading" scope="col">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {db.senders.map((identity) => (
                <tr key={identity.id}>
                  <td>{identity.name}</td>
                  <td>{identity.email}</td>
                  <td>{identity.provider}</td>
                  <td>{identity.productIds.length} products</td>
                  <td>
                    <Badge
                      tone={identity.status === "Verified" ? "green" : "amber"}
                    >
                      {identity.status}
                    </Badge>
                  </td>
                  <td className="user-actions-cell">
                    <RecordActions
                      label={`Actions for ${identity.name}`}
                      disabled={busy}
                      actions={[
                        {
                          label: "Edit sender",
                          icon: <Pencil size={16} />,
                          onSelect: () => open(identity),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!isUser && !db.senders.length && (
          <Empty
            title="No senders configured"
            description="Add an authorised sender to start sending campaigns."
          />
        )}
      </section>
      <Modal
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
        title={`Delete ${deleting?.firstName ?? "user"} ${deleting?.lastName ?? ""}?`}
        description="This removes the login account and revokes sessions and invitation links. CRM records and historical attribution are retained."
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!deleting) return;
            setBusy(true);
            setDeleteError("");
            try {
              await deleteUserAccount(deleting.id, replacement);
              setDeleting(null);
              await refresh();
              toast.success("User account deleted and work reassigned");
            } catch (error) {
              setDeleteError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-body">
            <p>
              <strong>{deleting?.email}</strong> will no longer be able to sign
              in. The deleted account cannot be restored from this screen.
            </p>
            <label>
              Reassign their work to
              <select
                required
                value={replacement}
                onChange={(event) => setReplacement(event.target.value)}
                disabled={busy}
              >
                {db.users
                  .filter(
                    (member) =>
                      member.id !== deleting?.id &&
                      !member.deletedAt &&
                      member.active !== false &&
                      member.passwordSet !== false,
                  )
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.firstName} {member.lastName} · {member.role}
                    </option>
                  ))}
              </select>
            </label>
            <p className="form-hint">
              Owned products, contact relationships, open follow-ups and draft
              campaigns are reassigned. The replacement needs access to every
              affected product; a Super Admin can take over all of them.
            </p>
            {deleting && (
              <div className="callout">
                {
                  db.products.filter((item) => item.ownerId === deleting.id)
                    .length
                }{" "}
                products ·{" "}
                {
                  db.associations.filter((item) => item.ownerId === deleting.id)
                    .length
                }{" "}
                relationships ·{" "}
                {
                  db.followUps.filter(
                    (item) =>
                      item.ownerId === deleting.id && item.status === "Open",
                  ).length
                }{" "}
                open follow-ups ·{" "}
                {
                  db.campaigns.filter(
                    (item) =>
                      item.createdBy === deleting.id && item.status === "Draft",
                  ).length
                }{" "}
                drafts
              </div>
            )}
            <p className="form-hint">
              Their remaining queued campaigns are cancelled. Messages already
              being sent may finish. Contacts, clients, completed work and audit
              history are kept.
            </p>
            {deleteError && (
              <p className="field-error" role="alert">
                {deleteError}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <Button
              type="button"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Keep user
            </Button>
            <Button type="submit" variant="danger" loading={busy}>
              Delete user
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={editing !== null}
        onOpenChange={(value) => {
          if (!value && !busy) open(null);
        }}
        title={`${record ? "Edit" : "Add"} ${isUser ? "user" : "sender"}`}
      >
        <form onSubmit={save} key={record?.id ?? "new"}>
          <div className="form-body">
            <div className="form-grid">
              {isUser ? (
                <>
                  <label>
                    First name
                    <input
                      name="firstName"
                      required
                      maxLength={100}
                      defaultValue={staff?.firstName}
                    />
                  </label>
                  <label>
                    Last name
                    <input
                      name="lastName"
                      required
                      maxLength={100}
                      defaultValue={staff?.lastName}
                    />
                  </label>
                  <label>
                    Email address
                    <input
                      name="email"
                      type="email"
                      required
                      defaultValue={staff?.email}
                    />
                  </label>
                  {staff && (
                    <p className="form-hint">
                      Changing an email signs out existing sessions. Pending
                      accounts receive a new invitation at the corrected
                      address.
                    </p>
                  )}
                  {!staff && (
                    <p className="form-hint">
                      We’ll email a one-time invitation. Your colleague will
                      choose their own password.
                    </p>
                  )}
                  <label>
                    Role
                    <select name="role" defaultValue={staff?.role ?? "BDO"}>
                      <option>BDO</option>
                      <option>Super Admin</option>
                    </select>
                  </label>
                  {staff && (
                    <label className="checkbox-label">
                      <input
                        name="active"
                        type="checkbox"
                        defaultChecked={staff.active !== false}
                      />
                      Active account
                    </label>
                  )}
                </>
              ) : (
                <>
                  <label>
                    Account name
                    <input
                      name="name"
                      required
                      maxLength={150}
                      defaultValue={sender?.name}
                    />
                  </label>
                  <label>
                    Sender display name
                    <input
                      name="senderName"
                      required
                      maxLength={150}
                      defaultValue={
                        sender?.senderName ??
                        (db.emailProvider === "brevo" ? db.brevoFromName : "")
                      }
                    />
                  </label>
                  <label>
                    From email
                    <input
                      type="email"
                      name="email"
                      required
                      defaultValue={
                        sender?.email ??
                        (db.emailProvider === "brevo" ? db.brevoFromEmail : "")
                      }
                    />
                  </label>
                  <label>
                    Reply-to email
                    <input
                      type="email"
                      name="replyTo"
                      required
                      defaultValue={sender?.replyTo}
                    />
                  </label>
                </>
              )}
            </div>
            <fieldset>
              <legend>Assigned products</legend>
              {!db.products.length && (
                <p>Create a product first to assign product access.</p>
              )}
              {db.products.map((product) => (
                <label className="checkbox-label" key={product.id}>
                  <input
                    type="checkbox"
                    name="productIds"
                    value={product.id}
                    defaultChecked={(
                      staff?.productIds ??
                      sender?.productIds ??
                      []
                    ).includes(product.id)}
                  />
                  {product.name}
                </label>
              ))}
            </fieldset>
            {!isUser && (
              <>
                <fieldset>
                  <legend>Authorised users</legend>
                  {db.users
                    .filter((member) => member.active !== false)
                    .map((member) => (
                      <label className="checkbox-label" key={member.id}>
                        <input
                          type="checkbox"
                          name="userIds"
                          value={member.id}
                          defaultChecked={sender?.userIds.includes(member.id)}
                        />
                        {member.firstName} {member.lastName}
                      </label>
                    ))}
                </fieldset>
                <label className="checkbox-label">
                  <input
                    name="verified"
                    type="checkbox"
                    defaultChecked={sender?.status === "Verified"}
                  />
                  I have authorised this sender address with the configured
                  provider.
                </label>
              </>
            )}
            {staff && (
              <p>
                Saving an account revokes its existing sessions. Reassign owned
                relationships before removing product access.
              </p>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <Button type="button" disabled={busy} onClick={() => open(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={busy}>
              Save {isUser ? "user" : "sender"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
