import { useState } from "react";
import {
  ArrowLeft,
  ArrowDownToLine,
  Copy,
  Monitor,
  Smartphone,
  Pencil,
  XCircle,
  Send,
  CheckCircle2,
  Clock3,
  ShieldCheck,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCRM } from "../../app/context";
import {
  Badge,
  Button,
  Empty,
  PageHeader,
} from "../../components/ui/primitives";
import { campaignCanManage, tokensFor } from "../../lib/campaigns";
import { recipientCounts } from "../../services/campaign-service";
import { date, downloadCsv } from "../../lib/format";
import type { Campaign } from "../../types/campaigns";
import { EmailPreview } from "./EmailPreview";
export const campaignStatusLabel = (c: Campaign) =>
  c.mode === "simulation" && c.status === "Sent"
    ? "Simulation complete"
    : c.status;
export const campaignTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-ZA", {
        timeZone: "Africa/Johannesburg",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value)) + " SAST"
    : "—";
export function CampaignDetail({
  campaign: c,
  onBack,
  onEdit,
  onAction,
}: {
  campaign: Campaign;
  onBack: () => void;
  onEdit: () => void;
  onAction: (action: "duplicate" | "cancel" | "delete", c: Campaign) => void;
}) {
  const { db, user } = useCRM();
  const [tab, setTab] = useState("Overview");
  const [mobile, setMobile] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [search, setSearch] = useState("");
  const rows = db.campaignRecipients.filter((r) => r.campaignId === c.id);
  const counts = recipientCounts(rows);
  const sender = db.senders.find((s) => s.id === c.senderId);
  const signature = db.signatures.find((s) => s.id === c.signatureId);
  const previewContact = db.contacts.find((p) =>
    db.associations.some(
      (a) => a.contactId === p.id && a.productId === c.productId,
    ),
  );
  const selected = rows.find((r) => r.id === recipient) ?? rows[0];
  const tokens =
    selected?.tokens ??
    (previewContact
      ? tokensFor(db, previewContact, c.productId, sender)
      : {
          first_name: "there",
          last_name: "",
          company_name: "your organisation",
          product_name:
            db.products.find((p) => p.id === c.productId)?.name ??
            "our solution",
          assigned_bdo: "ICE team",
          sender_name: sender?.senderName ?? "ICE Business Development",
        });
  const manageable = campaignCanManage(c, user);
  return (
    <>
      <button className="campaign-back" onClick={onBack}>
        <ArrowLeft size={14} />
        All campaigns
      </button>
      <PageHeader
        eyebrow={`MARKETING / ${c.type.toUpperCase()}`}
        title={c.name}
        description={`${db.products.find((p) => p.id === c.productId)?.name ?? "Product"} · Created ${date(c.createdAt)} by ${db.users.find((u) => u.id === c.createdBy)?.firstName ?? "ICE team"}`}
        actions={
          <>
            {manageable && c.status === "Draft" && (
              <Button variant="primary" onClick={onEdit}>
                <Pencil size={14} />
                Edit draft
              </Button>
            )}
            <Button onClick={() => onAction("duplicate", c)}>
              <Copy size={14} />
              Duplicate
            </Button>
            {manageable && ["Scheduled", "Sending"].includes(c.status) && (
              <Button onClick={() => onAction("cancel", c)}>
                <XCircle size={14} />
                Cancel campaign
              </Button>
            )}
          </>
        }
      />
      <div className="campaign-detail-status">
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
        <span>
          <ShieldCheck size={14} />
          {c.mode === "simulation"
            ? "Server simulation · no email sent"
            : `${db.emailProvider.toUpperCase()} delivery`}
        </span>
        {c.status === "Scheduled" && (
          <span>
            <Clock3 size={13} />
            {campaignTime(c.scheduledAt)}
          </span>
        )}
      </div>
      <section className="panel campaign-detail-panel">
        <div className="tabs campaign-detail-tabs">
          {[
            "Overview",
            "Recipients",
            "Email content",
            "Analytics",
            "Delivery logs",
          ].map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
              {t === "Recipients" && <span>{rows.length}</span>}
            </button>
          ))}
        </div>
        <div className="campaign-detail-body">
          {tab === "Overview" && (
            <>
              <div className="campaign-report-metrics">
                {[
                  { label: "Queued", count: counts.queued, icon: Clock3 },
                  {
                    label:
                      c.mode === "simulation"
                        ? "Simulated messages"
                        : "Provider accepted",
                    count:
                      c.mode === "simulation"
                        ? counts.simulated
                        : counts.accepted,
                    icon: Send,
                  },
                  {
                    label: "Dispatching",
                    count: counts.dispatching,
                    icon: Send,
                  },
                  { label: "Failed", count: counts.failed, icon: ShieldCheck },
                  {
                    label: "Unknown outcome",
                    count: counts.unknown,
                    icon: ShieldCheck,
                  },
                  {
                    label: "Excluded",
                    count: counts.excluded,
                    icon: CheckCircle2,
                  },
                ].map((m) => (
                  <div key={m.label}>
                    <span>
                      <m.icon size={16} />
                      {m.label}
                    </span>
                    <strong>{m.count}</strong>
                  </div>
                ))}
              </div>
              <div className="campaign-overview-grid">
                <div>
                  <h3>Campaign details</h3>
                  <dl className="detail-grid">
                    <dt>Status</dt>
                    <dd>{campaignStatusLabel(c)}</dd>
                    <dt>Sender</dt>
                    <dd>{sender?.senderName ?? "Not selected"}</dd>
                    <dt>From address</dt>
                    <dd>{sender?.email ?? "Not selected"}</dd>
                    <dt>Reply-to</dt>
                    <dd>{sender?.replyTo ?? "—"}</dd>
                    <dt>Subject</dt>
                    <dd>{c.subject || "Not set"}</dd>
                    <dt>Scheduled for</dt>
                    <dd>{campaignTime(c.scheduledAt)}</dd>
                    <dt>Processed at</dt>
                    <dd>{campaignTime(c.sentAt)}</dd>
                  </dl>
                </div>
                <div className="campaign-provider-notice">
                  <ShieldCheck size={26} />
                  <h3>A clear view. No invented metrics.</h3>
                  <p>
                    These counts come from the server recipient log. Provider
                    delivery, opens, clicks, and unsubscribes need an email
                    provider and tracking integration.
                  </p>
                  <span>Delivered —</span>
                  <span>Open rate —</span>
                  <span>Click rate —</span>
                </div>
              </div>
              {c.description && (
                <p className="campaign-description">{c.description}</p>
              )}
            </>
          )}
          {(tab === "Recipients" || tab === "Delivery logs") && (
            <>
              <div className="campaign-log-toolbar">
                <input
                  aria-label="Search campaign recipients"
                  placeholder="Search name or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Button
                  disabled={!rows.length}
                  onClick={() =>
                    downloadCsv("ice-campaign-recipient-log.csv", [
                      ["Name", "Email", "Status", "Reason", "Processed (SAST)"],
                      ...rows.map((r) => [
                        r.name,
                        r.email,
                        r.status,
                        r.reason,
                        campaignTime(r.processedAt),
                      ]),
                    ])
                  }
                >
                  <ArrowDownToLine size={14} />
                  Export log
                </Button>
              </div>
              {rows.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Recipient</th>
                        <th>Processing status</th>
                        <th>Details</th>
                        <th>Processed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows
                        .filter((r) =>
                          `${r.name} ${r.email}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                        )
                        .map((r) => (
                          <tr key={r.id}>
                            <td>
                              <strong>{r.name}</strong>
                              <small>{r.email}</small>
                            </td>
                            <td>
                              <Badge
                                tone={
                                  r.status === "Simulated" ||
                                  r.status === "Accepted"
                                    ? "green"
                                    : r.status === "Excluded"
                                      ? "amber"
                                      : "neutral"
                                }
                              >
                                {r.status === "Simulated"
                                  ? "Simulated · not sent"
                                  : r.status}
                              </Badge>
                            </td>
                            <td className="campaign-log-reason">
                              {r.reason || "Waiting for scheduled processing."}
                            </td>
                            <td>{campaignTime(r.processedAt)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {!rows.some((r) =>
                    `${r.name} ${r.email}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  ) && (
                    <Empty
                      title="No matching recipients"
                      description="Try another name or email."
                    />
                  )}
                </div>
              ) : (
                <Empty
                  title="No processing logs yet"
                  description="Recipient snapshots are recorded when the campaign is submitted."
                />
              )}
            </>
          )}
          {tab === "Email content" && (
            <>
              <div className="campaign-preview-controls">
                <label>
                  Recipient preview
                  <select
                    value={selected?.id ?? ""}
                    onChange={(e) => setRecipient(e.target.value)}
                  >
                    {rows.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                    {!rows.length && (
                      <option value="">
                        {previewContact
                          ? `${previewContact.firstName} ${previewContact.lastName}`
                          : "Fallback values"}
                      </option>
                    )}
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
              <EmailPreview
                draft={c}
                tokens={tokens}
                signatureHtml={signature?.html}
                sender={
                  sender
                    ? `${sender.senderName} <${sender.email}>`
                    : "Not selected"
                }
                recipient={
                  selected?.email ?? previewContact?.email ?? "Preview only"
                }
                mobile={mobile}
              />
            </>
          )}
          {tab === "Analytics" && (
            <>
              <div className="campaign-analytics-heading">
                <h3>Campaign processing</h3>
                <p>Actual counts from this campaign’s server recipient log.</p>
              </div>
              {rows.length ? (
                <div className="campaign-analytics-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: "Queued", count: counts.queued },
                        { name: "Accepted", count: counts.accepted },
                        { name: "Simulated", count: counts.simulated },
                        { name: "Dispatching", count: counts.dispatching },
                        { name: "Failed", count: counts.failed },
                        { name: "Unknown", count: counts.unknown },
                        { name: "Excluded", count: counts.excluded },
                      ]}
                    >
                      <CartesianGrid
                        vertical={false}
                        strokeDasharray="3 5"
                        stroke="#eee4e8"
                      />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12, fill: "#82727a" }}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#82727a" }}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="count"
                        name="Recipients"
                        fill="#c1121f"
                        radius={[5, 5, 0, 0]}
                        barSize={45}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty
                  title="No processing data"
                  description="Submit a campaign to populate this chart."
                />
              )}
              <div className="callout">
                Delivery rate, open rate, click rate, and unsubscribe counts are
                unavailable without provider tracking. Provider acceptance does
                not confirm inbox delivery.
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
