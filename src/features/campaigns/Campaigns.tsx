import { useMemo, useState } from "react";
import {
  Archive,
  ArrowUpRight,
  Copy,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { useCRM } from "../../app/context";
import {
  Badge,
  Button,
  Empty,
  Modal,
  PageHeader,
} from "../../components/ui/primitives";
import { can } from "../../lib/permissions";
import { campaignCanManage } from "../../lib/campaigns";
import { date } from "../../lib/format";
import { api } from "../../services/api";
import type { Campaign } from "../../types/campaigns";
import { CampaignWizard } from "./CampaignWizard";
import {
  CampaignDetail,
  campaignStatusLabel,
  campaignTime,
} from "./CampaignDetail";

export function Campaigns() {
  const { db, user, refresh } = useCRM();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All campaigns");
  const [product, setProduct] = useState("");
  const [sender, setSender] = useState("");
  const [owner, setOwner] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [action, setAction] = useState<{
    type: "duplicate" | "cancel" | "delete";
    campaign: Campaign;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rows = useMemo(
    () =>
      db.campaigns
        .filter(
          (c) =>
            (status === "All campaigns" || c.status === status) &&
            (!product || c.productId === product) &&
            (!sender || c.senderId === sender) &&
            (!owner || c.createdBy === owner) &&
            (!from ||
              new Date(c.createdAt).toLocaleDateString("en-CA", {
                timeZone: "Africa/Johannesburg",
              }) >= from) &&
            (!to ||
              new Date(c.createdAt).toLocaleDateString("en-CA", {
                timeZone: "Africa/Johannesburg",
              }) <= to) &&
            `${c.name} ${c.subject} ${db.products.find((p) => p.id === c.productId)?.name}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [db, status, product, sender, owner, from, to, search],
  );
  const current = db.campaigns.find((c) => c.id === detail);
  const edited = db.campaigns.find((c) => c.id === editing);
  const real = db.campaigns;
  const realIds = new Set(real.map((c) => c.id));
  const logs = db.campaignRecipients.filter((r) => realIds.has(r.campaignId));
  function showAction(
    type: "duplicate" | "cancel" | "delete",
    campaign: Campaign,
  ) {
    setAction({ type, campaign });
    setError("");
  }
  if (editing)
    return (
      <CampaignWizard
        key={editing}
        initial={edited}
        onClose={() => setEditing(null)}
        onSubmitted={(id) => {
          setEditing(null);
          setDetail(id);
        }}
      />
    );
  return (
    <>
      {current ? (
        <CampaignDetail
          campaign={current}
          onBack={() => setDetail(null)}
          onEdit={() => {
            setEditing(current.id);
            setDetail(null);
          }}
          onAction={showAction}
        />
      ) : (
        <>
          <PageHeader
            eyebrow="MARKETING / CAMPAIGNS"
            title="Campaigns"
            description="Connect your products with the people ready to hear from you."
            actions={
              <>
                <Button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await refresh();
                      toast.success("Campaigns refreshed");
                    } catch (e) {
                      toast.error((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <RefreshCw size={14} />
                  Refresh
                </Button>
                {can(user, "campaigns.manage") && (
                  <Button variant="primary" onClick={() => setEditing("new")}>
                    <Plus size={16} />
                    Create campaign
                  </Button>
                )}
              </>
            }
          />
          <section className="campaigns-overview">
            <div className="campaigns-overview-brand">
              <Mail size={24} />
              <span>
                Thoughtful outreach.
                <br />
                <strong>Measurable progress.</strong>
              </span>
            </div>
            {[
              {
                label: "Your drafts",
                count: real.filter((c) => c.status === "Draft").length,
              },
              {
                label: "Scheduled",
                count: real.filter((c) => c.status === "Scheduled").length,
              },
              {
                label: "Completed campaigns",
                count: real.filter((c) => c.status === "Sent").length,
              },
              {
                label: "Provider accepted",
                count: logs.filter((r) => r.status === "Accepted").length,
              },
            ].map((m) => (
              <div key={m.label}>
                <span>{m.label}</span>
                <strong>{m.count.toString().padStart(2, "0")}</strong>
              </div>
            ))}
          </section>
          <div className="campaign-processing-banner">
            <span className="campaign-mode-pill">
              <span />
              SERVER PROCESSING
            </span>
            <p>
              The server worker processes scheduled campaigns, even when this
              page is closed. Each campaign records its delivery mode.
            </p>
          </div>
          <section className="panel campaign-list-panel">
            <div
              className="portfolio-view-tabs"
              role="group"
              aria-label="Campaign status views"
            >
              {["All campaigns", "Draft", "Scheduled", "Sent", "Cancelled"].map(
                (s) => (
                  <button
                    key={s}
                    className={status === s ? "active" : ""}
                    aria-pressed={status === s}
                    onClick={() => setStatus(s)}
                  >
                    {s === "Sent" ? "Completed" : s}
                    <small>
                      {
                        db.campaigns.filter(
                          (c) => s === "All campaigns" || c.status === s,
                        ).length
                      }
                    </small>
                  </button>
                ),
              )}
              <select
                aria-label="Other campaign status"
                value={
                  ["Failed", "Partially Failed", "Sending"].includes(status)
                    ? status
                    : ""
                }
                onChange={(e) => setStatus(e.target.value || "All campaigns")}
              >
                <option value="">Other statuses</option>
                <option>Failed</option>
                <option>Partially Failed</option>
                <option>Sending</option>
              </select>
            </div>
            <div className="campaign-list-toolbar">
              <div className="search-input">
                <Search size={16} />
                <input
                  aria-label="Search campaigns"
                  placeholder="Search campaigns or subjects…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                aria-label="Filter campaign product"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              >
                <option value="">All products</option>
                {db.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter campaign sender"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
              >
                <option value="">All senders</option>
                {db.senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter campaign owner"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              >
                <option value="">All owners</option>
                {db.users
                  .filter((u) => db.campaigns.some((c) => c.createdBy === u.id))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
              </select>
              <label>
                From
                <input
                  type="date"
                  aria-label="Campaigns created from"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  aria-label="Campaigns created to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </div>
            {rows.length ? (
              <div className="table-scroll">
                <table className="campaign-list-table">
                  <thead>
                    <tr>
                      <th>Campaign / subject</th>
                      <th>Product</th>
                      <th>Status</th>
                      <th>Audience</th>
                      <th>Schedule / updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <button
                            className="campaign-name"
                            aria-label={`Open campaign ${c.name}`}
                            onClick={() => setDetail(c.id)}
                          >
                            <span className="campaign-list-icon">
                              <Mail size={17} />
                            </span>
                            <span>
                              <strong>{c.name}</strong>
                              <small>{c.subject || "No subject yet"}</small>
                            </span>
                            <ArrowUpRight size={13} />
                          </button>
                        </td>
                        <td>
                          {db.products.find((p) => p.id === c.productId)?.name}
                        </td>
                        <td>
                          <Badge
                            tone={
                              c.status === "Sent"
                                ? "green"
                                : c.status === "Scheduled"
                                  ? "blue"
                                  : "neutral"
                            }
                          >
                            {campaignStatusLabel(c)}
                          </Badge>
                        </td>
                        <td>
                          {c.recipients}
                          <small>selected</small>
                        </td>
                        <td>
                          {c.scheduledAt
                            ? campaignTime(c.scheduledAt)
                            : date(c.updatedAt)}
                        </td>
                        <td>
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <button
                                className="icon-button"
                                aria-label={`Actions for ${c.name}`}
                              >
                                <MoreHorizontal size={17} />
                              </button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content
                                className="dropdown"
                                align="end"
                                sideOffset={6}
                              >
                                <DropdownMenu.Item
                                  onSelect={() => setDetail(c.id)}
                                >
                                  <ArrowUpRight size={14} />
                                  View campaign
                                </DropdownMenu.Item>
                                {campaignCanManage(c, user) &&
                                  c.status === "Draft" && (
                                    <DropdownMenu.Item
                                      onSelect={() => setEditing(c.id)}
                                    >
                                      Edit draft
                                    </DropdownMenu.Item>
                                  )}
                                <DropdownMenu.Item
                                  onSelect={() => showAction("duplicate", c)}
                                >
                                  <Copy size={14} />
                                  Duplicate as draft
                                </DropdownMenu.Item>
                                {campaignCanManage(c, user) &&
                                  ["Scheduled", "Sending"].includes(
                                    c.status,
                                  ) && (
                                    <DropdownMenu.Item
                                      onSelect={() => showAction("cancel", c)}
                                    >
                                      <XCircle size={14} />
                                      Cancel campaign
                                    </DropdownMenu.Item>
                                  )}
                                {campaignCanManage(c, user) &&
                                  c.status === "Draft" && (
                                    <DropdownMenu.Item
                                      onSelect={() => showAction("delete", c)}
                                    >
                                      <Trash2 size={14} />
                                      Delete draft
                                    </DropdownMenu.Item>
                                  )}
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="No campaigns found"
                description="Create a campaign or try a different search and filter combination."
                action={
                  <Button
                    onClick={() => {
                      setSearch("");
                      setStatus("All campaigns");
                      setProduct("");
                      setSender("");
                      setOwner("");
                      setFrom("");
                      setTo("");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            )}
            <div className="portfolio-list-footer">
              <span>{rows.length} campaigns in this view</span>
              <span>
                <Archive size={12} />
                Completed processing logs are retained
              </span>
            </div>
          </section>
        </>
      )}
      {action && (
        <Modal
          open
          onOpenChange={(v) => !v && !busy && setAction(null)}
          title={
            action.type === "duplicate"
              ? "Duplicate campaign?"
              : action.type === "cancel"
                ? "Cancel campaign?"
                : "Delete campaign draft?"
          }
          description={
            action.type === "duplicate"
              ? "Create an editable copy. Consent and access are checked again; previous processing logs are not copied."
              : action.type === "cancel"
                ? "Queued messages will be excluded. Existing processing history will be retained."
                : "This removes the unsent draft. This cannot be undone."
          }
        >
          <div className="form-body">
            <strong>{action.campaign.name}</strong>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <Button disabled={busy} onClick={() => setAction(null)}>
              Keep campaign
            </Button>
            <Button
              variant={action.type === "delete" ? "danger" : "primary"}
              loading={busy}
              onClick={async () => {
                try {
                  setBusy(true);
                  if (action.type === "duplicate") {
                    const id = await api.duplicateCampaign(
                      action.campaign.id,
                      user.id,
                    );
                    await refresh();
                    setDetail(null);
                    setEditing(id);
                  } else if (action.type === "cancel") {
                    await api.cancelCampaign(action.campaign.id, user.id);
                    await refresh();
                    toast.success("Campaign cancelled");
                  } else {
                    await api.deleteCampaign(action.campaign.id, user.id);
                    await refresh();
                    setDetail(null);
                    toast.success("Campaign draft deleted");
                  }
                  setAction(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {action.type === "duplicate"
                ? "Create draft copy"
                : action.type === "cancel"
                  ? "Cancel campaign"
                  : "Delete draft"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
