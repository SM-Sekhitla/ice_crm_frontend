import { canManageAssociation } from "../../lib/permissions";
import { useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Plus,
  RefreshCw,
  TrendingUp,
  Users,
  UserRoundCheck,
  Target,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCRM } from "../../app/context";
import {
  Avatar,
  Button,
  Empty,
  PageHeader,
  Tip,
} from "../../components/ui/primitives";
import { date, downloadCsv, money, relative } from "../../lib/format";
import { dashboardData } from "./metrics";
import { api } from "../../services/api";

export function Dashboard() {
  const reducedMotion = useReducedMotion();
  const { db, user, refresh, addContact, openContact } = useCRM();
  const [product, setProduct] = useState("");
  const [days, setDays] = useState(90);
  const [metric, setMetric] = useState("Contacts");
  const [busy, setBusy] = useState(false);
  const data = useMemo(
    () => dashboardData(db, product, days),
    [db, product, days],
  );
  const change = data.previousContacts.length
    ? Math.round(
        ((data.contacts.length - data.previousContacts.length) /
          data.previousContacts.length) *
          100,
      )
    : null;
  const followUps = db.followUps
    .filter(
      (f) =>
        f.status === "Open" &&
        data.relations.some((a) => a.id === f.associationId),
    )
    .map((f) => ({ ...f, nextFollowUp: f.dueDate }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4);
  const pipelineValue = data.activeLeads.reduce(
    (total, lead) => total + lead.expectedValue,
    0,
  );
  const wonValue = data.clients.reduce(
    (total, client) => total + client.dealValue,
    0,
  );
  const performance = db.products
    .filter((p) => !product || p.id === product)
    .map((p) => ({
      ...p,
      count:
        metric === "Clients"
          ? data.clients.filter(
              (c) =>
                db.associations.find((a) => a.id === c.associationId)
                  ?.productId === p.id,
            ).length
          : metric === "Leads"
            ? data.activeLeads.filter(
                (l) =>
                  db.associations.find((a) => a.id === l.associationId)
                    ?.productId === p.id,
              ).length
            : new Set(
                data.relations
                  .filter((a) => a.productId === p.id)
                  .map((a) => a.contactId),
              ).size,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
  const funnel = [
    { name: "Contacts", count: data.contacts.length },
    {
      name: "Leads",
      count: data.relations.filter((a) => a.stage !== "Contact").length,
    },
    {
      name: "Qualified",
      count: data.relations.filter((a) =>
        ["Qualified", "Proposal Sent", "Negotiation", "Client"].includes(
          a.stage,
        ),
      ).length,
    },
    {
      name: "Clients",
      count: data.relations.filter((a) => a.stage === "Client").length,
    },
  ];
  const pipelineStages = [
    "New Lead",
    "Contacted",
    "Interested",
    "Qualified",
    "Proposal Sent",
    "Negotiation",
    "On Hold",
  ]
    .map((stage, i) => ({
      stage,
      color: [
        "#f4b942",
        "#e39e56",
        "#e78371",
        "#df6068",
        "#c33b4a",
        "#a92232",
        "#777477",
      ][i],
      count: data.activeLeads.filter(
        (l) =>
          db.associations.find((a) => a.id === l.associationId)?.stage ===
          stage,
      ).length,
    }))
    .filter((s) => s.count > 0);
  return (
    <>
      <PageHeader
        eyebrow="RELATIONSHIPS. OPPORTUNITIES. GROWTH."
        title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${user.firstName}`}
        description="A clear view of your business. A confident next move."
        actions={
          <>
            <Button
              onClick={() =>
                downloadCsv("ice-dashboard.csv", [
                  ["Metric", "Value"],
                  ["Contacts", data.contacts.length],
                  ["Active leads", data.activeLeads.length],
                  ["Clients", data.clients.length],
                  ["Lead-to-client conversion", `${data.conversion}%`],
                  ["Pipeline value (ZAR)", pipelineValue],
                ])
              }
            >
              <ArrowDownToLine size={16} />
              Export report
            </Button>
            <Button variant="primary" onClick={addContact}>
              <Plus size={17} />
              Add contact
            </Button>
          </>
        }
      />
      <div className="dashboard-filters">
        <div className="dashboard-view-label">
          <span />
          Business overview{" "}
          <span className="view-label-sub">/ Performance</span>
        </div>
        <div className="dashboard-filter-controls">
          <select
            aria-label="Filter dashboard by product"
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
          <div className="date-control">
            <CalendarDays size={15} />
            <select
              aria-label="Dashboard date range"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last 12 months</option>
            </select>
          </div>
          <Tip label="Refresh dashboard">
            <button
              aria-label="Refresh dashboard"
              className="icon-button refresh-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await refresh();
                  toast.success("Dashboard is up to date");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCw size={16} className={busy ? "spin" : ""} />
            </button>
          </Tip>
        </div>
      </div>
      <div className="metrics-grid">
        {[
          {
            label: "Total contacts",
            value: data.contacts.length,
            icon: Users,
            note: "People in your network",
            tag:
              change === null
                ? "Selected period"
                : `${change >= 0 ? "+" : ""}${change}% vs previous`,
          },
          {
            label: "Active leads",
            value: data.activeLeads.length,
            icon: Target,
            note: `${data.activeLeads.filter((l) => l.nextFollowUp && new Date(l.nextFollowUp) < new Date()).length} awaiting a follow-up`,
            tag: "Open opportunities",
          },
          {
            label: "Total clients",
            value: data.clients.length,
            icon: UserRoundCheck,
            note: "Connections turned into clients",
            tag: "Relationships won",
          },
          {
            label: "Lead-to-client rate",
            value: `${data.conversion}%`,
            icon: TrendingUp,
            note: "From leads created in this period",
            tag: "Conversion",
          },
        ].map((m, i) => (
          <div className="metric-card" key={m.label}>
            <div className="metric-label">
              <span>{m.label}</span>
              <m.icon size={17} />
            </div>
            <div className="metric-value">
              {m.value}
              <span className="metric-index">0{i + 1}</span>
            </div>
            <div className="metric-foot">{m.note}</div>
            <div className="metric-tag">
              {i === 0 && change !== null && <ArrowUpRight size={12} />}
              <span>{m.tag}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="chart-grid">
        <section className="panel acquisition">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">NETWORK GROWTH</span>
              <h2>Every connection counts.</h2>
            </div>
            <span className="chart-legend">
              <i />
              New contacts
            </span>
          </div>
          <div className="chart-summary">
            <strong>{data.contacts.length}</strong>
            <span>
              contacts acquired in the last{" "}
              {days === 365 ? "12 months" : `${days} days`}
            </span>
          </div>
          <div className="area-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.trend}
                margin={{ top: 10, right: 12, left: -24, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="contactGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#c1121f" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="#c1121f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 5"
                  vertical={false}
                  stroke="#eae8e6"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#86817d" }}
                  minTickGap={35}
                  dy={10}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#86817d" }}
                />
                <Tooltip
                  contentStyle={{
                    border: "1px solid #e8e3df",
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: "0 8px 24px #25201b0a",
                  }}
                />
                <Area
                  isAnimationActive={!reducedMotion}
                  type="monotone"
                  dataKey="contacts"
                  name="New contacts"
                  stroke="#c1121f"
                  strokeWidth={2.5}
                  fill="url(#contactGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="panel-footer">
            <span>New relationships, measured over time.</span>
            <Link to="/contacts">
              Explore contacts
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
        <section className="pipeline-focus">
          <div className="pipeline-focus-heading">
            <span>
              <i />
              OPPORTUNITY SNAPSHOT
            </span>
            <ArrowUpRight size={20} />
          </div>
          <p className="pipeline-focus-label">Your next chapter in growth.</p>
          <strong className="pipeline-focus-value">
            {money(pipelineValue)}
          </strong>
          <p className="pipeline-focus-caption">
            across {data.activeLeads.length} open opportunities
          </p>
          <div
            className="pipeline-distribution"
            aria-label="Distribution of active lead stages"
          >
            {pipelineStages.map((s) => (
              <span
                key={s.stage}
                title={`${s.stage}: ${s.count}`}
                style={{ flex: s.count, background: s.color }}
              />
            ))}
          </div>
          <div className="pipeline-stage-legend">
            {pipelineStages.map((s) => (
              <span key={s.stage}>
                <i style={{ background: s.color }} />
                {s.stage}
                <b>{s.count}</b>
              </span>
            ))}
          </div>
          <div className="pipeline-won">
            <span>Converted deal value</span>
            <strong>{money(wonValue)}</strong>
          </div>
          <Link to="/leads" className="pipeline-focus-link">
            Open your pipeline
            <ArrowRight size={17} />
          </Link>
        </section>
      </div>
      <div className="secondary-grid">
        <section className="panel performance-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">YOUR PORTFOLIO</span>
              <h2>Product performance</h2>
            </div>
            <select
              aria-label="Product performance metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
            >
              {["Contacts", "Leads", "Clients"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="product-performance">
            {performance.map((p, i) => (
              <div className="performance-row" key={p.id}>
                <span className="rank">0{i + 1}</span>
                <div className="performance-product">
                  <span>{p.name}</span>
                  <div className="performance-track">
                    <i
                      style={{
                        width: `${(p.count / Math.max(...performance.map((p) => p.count), 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <strong>{p.count}</strong>
              </div>
            ))}
          </div>
          <div className="panel-footer">
            <span>{db.products.length} products</span>
            <Link to="/products">
              View portfolio
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
        <section className="panel funnel-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">THE BIGGER PICTURE</span>
              <h2>Connection to conversion</h2>
            </div>
            <span className="conversion-stamp">{data.conversion}%</span>
          </div>
          <div className="funnel">
            {funnel.map((f, i) => (
              <div className="funnel-row" key={f.name}>
                <span className="funnel-step">0{i + 1}</span>
                <div className="funnel-detail">
                  <div>
                    <span>{f.name}</span>
                    <strong>{f.count}</strong>
                  </div>
                  <div className="funnel-track">
                    <div
                      style={{
                        width: `${data.contacts.length ? (f.count / data.contacts.length) * 100 : 0}%`,
                        opacity: 0.3 + i * 0.22,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="panel-footer">
            <span>Cumulative stages in this contact cohort</span>
          </div>
        </section>
        <section className="panel follow-up-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">KEEP THE MOMENTUM</span>
              <h2>
                Next on your list{" "}
                <span className="count-bubble">{followUps.length}</span>
              </h2>
            </div>
            <Link
              to="/leads"
              className="text-link"
              aria-label="View all follow-ups"
            >
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="follow-ups">
            {followUps.length ? (
              followUps.map((l) => {
                const a = db.associations.find(
                  (a) => a.id === l.associationId,
                )!;
                const c = db.contacts.find((c) => c.id === a.contactId)!;
                const p = db.products.find((p) => p.id === a.productId)!;
                return (
                  <div className="follow-up" key={l.id}>
                    <Avatar name={`${c.firstName} ${c.lastName}`} />
                    <button
                      className="record-link"
                      onClick={() => openContact(c.id)}
                    >
                      <strong>
                        {c.firstName} {c.lastName}
                      </strong>
                      <span>{p.name}</span>
                    </button>
                    <div className="follow-up-time">
                      <span
                        className={
                          new Date(l.nextFollowUp) < new Date() ? "overdue" : ""
                        }
                      >
                        <Clock3 size={11} />
                        {date(l.nextFollowUp).replace(
                          ` ${new Date().getFullYear()}`,
                          "",
                        )}
                      </span>
                      <small>{l.priority} priority</small>
                    </div>
                    <Tip label="Complete follow-up">
                      <button
                        className="complete-button"
                        aria-label={`Complete follow-up for ${c.firstName}`}
                        disabled={!canManageAssociation(user, a)}
                        onClick={async () => {
                          try {
                            await api.setFollowUpStatus(
                              l.id,
                              "Completed",
                              user.id,
                            );
                            await refresh();
                            toast.success("Follow-up completed");
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                      >
                        <Check size={14} />
                      </button>
                    </Tip>
                  </div>
                );
              })
            ) : (
              <Empty
                title="All caught up"
                description="No follow-ups in this period."
              />
            )}
          </div>
        </section>
      </div>
      <section className="panel activity-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">THE WORK BEHIND THE PROGRESS</span>
            <h2>Workspace activity</h2>
          </div>
          <span className="subtle-label">
            <span className="live-dot" />
            Latest updates
          </span>
        </div>
        <div className="activity-list">
          {db.activities
            .filter(
              (a) =>
                (!product || a.productId === product) &&
                Date.now() - new Date(a.createdAt).getTime() <= days * 86400000,
            )
            .slice(0, 4)
            .map((a, i) => {
              const u = db.users.find((u) => u.id === a.userId)!;
              const p = db.products.find((p) => p.id === a.productId);
              return (
                <div className="activity-row" key={a.id}>
                  <span className={`activity-icon activity-icon-${i % 3}`}>
                    {i % 2 === 0 ? (
                      <UserRoundCheck size={16} />
                    ) : (
                      <Users size={16} />
                    )}
                  </span>
                  <div>
                    <button
                      className="activity-description"
                      disabled={!a.contactId}
                      onClick={() => a.contactId && openContact(a.contactId)}
                    >
                      {a.description}
                    </button>
                    <span>
                      {u.firstName} {u.lastName}
                      <i>·</i>
                      {p?.name}
                    </span>
                  </div>
                  <span className="activity-time">{relative(a.createdAt)}</span>
                </div>
              );
            })}
        </div>
      </section>
      <div className="dashboard-bottom">
        <span>Built on connections. Driven by possibility.</span>
        <span>
          <span className="live-dot" />
          All changes saved locally
        </span>
      </div>
    </>
  );
}
