import { useState, type FormEvent } from "react";
import { Database, ShieldCheck } from "lucide-react";
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
              Signed in as {user.firstName} {user.lastName}. Your administrator
              manages your access.
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
    </>
  );
}
function PasswordForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="panel settings-panel">
      <h3>Change password</h3>
      <p>Changing your password signs out all sessions.</p>
      <form
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
          <label>
            Current password
            <input
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <label>
            New password
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
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
          firstName: data.get("firstName"),
          lastName: data.get("lastName"),
          role: data.get("role"),
          productIds,
        };
        await request(
          staff ? `/users/${staff.id}` : "/users",
          json(
            staff ? "PUT" : "POST",
            staff
              ? { ...fields, active: data.get("active") === "on" }
              : {
                  ...fields,
                  email: data.get("email"),
                  password: data.get("password"),
                },
          ),
        );
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
      toast.success(isUser ? "Account saved" : "Sender saved");
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
            : "Authorised sender identities for campaign delivery."
        }
        actions={
          <Button variant="primary" onClick={() => open("new")}>
            {isUser ? "Add user" : "Add sender"}
          </Button>
        }
      />
      {!isUser && (
        <div className="callout">
          Your server administrator configures the SMTP connection. Add only
          sender addresses authorised by your email provider.
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
                <th />
              </tr>
            </thead>
            <tbody>
              {db.users.map((member) => (
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
                    <Badge tone={member.active === false ? "neutral" : "green"}>
                      {member.active === false ? "Inactive" : "Active"}
                    </Badge>
                  </td>
                  <td>
                    <Button onClick={() => open(member)}>Edit</Button>
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
                <th />
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
                  <td>
                    <Button onClick={() => open(identity)}>Edit</Button>
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
                      disabled={!!staff}
                      defaultValue={staff?.email}
                    />
                  </label>
                  {!staff && (
                    <label>
                      Initial password
                      <input
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        minLength={12}
                        maxLength={128}
                        required
                      />
                    </label>
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
                      defaultValue={sender?.senderName}
                    />
                  </label>
                  <label>
                    From email
                    <input
                      type="email"
                      name="email"
                      required
                      defaultValue={sender?.email}
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
                  I have authorised this sender address with the SMTP provider.
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
