import { useState } from "react";
import {
  Columns3,
  List,
  Search,
  SlidersHorizontal,
  CalendarDays,
  ArrowUpRight,
} from "lucide-react";
import { useCRM } from "../../app/context";
import {
  Avatar,
  Badge,
  Button,
  Empty,
  PageHeader,
} from "../../components/ui/primitives";
import { date, money } from "../../lib/format";
import type { Association, Stage } from "../../types";
import { TransitionDialog } from "../contacts/ContactDetail";
const pipeline: Stage[] = [
  "New Lead",
  "Contacted",
  "Interested",
  "Qualified",
  "Proposal Sent",
  "Negotiation",
];
export function Leads() {
  const { db, openContact } = useCRM();
  const [view, setView] = useState("Pipeline");
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState("");
  const [transition, setTransition] = useState<{
    association: Association;
    stage: Stage;
  } | null>(null);
  const [dragging, setDragging] = useState("");
  const [showOutcomes, setShowOutcomes] = useState(false);
  const rows = db.leads
    .map((l) => ({
      lead: l,
      association: db.associations.find((a) => a.id === l.associationId)!,
    }))
    .filter(({ association: a }) => {
      const c = db.contacts.find((c) => c.id === a.contactId)!;
      return (
        a.stage !== "Client" &&
        (!product || a.productId === product) &&
        `${c.firstName} ${c.lastName} ${c.company}`
          .toLowerCase()
          .includes(search.toLowerCase())
      );
    });
  return (
    <>
      <PageHeader
        eyebrow="TURN CONVERSATIONS INTO OPPORTUNITIES"
        title="Lead pipeline"
        description="A clear view of every opportunity. A thoughtful next step."
        actions={
          <div className="segmented">
            {[Columns3, List].map((Icon, i) => (
              <button
                key={i}
                onClick={() => setView(i ? "Table" : "Pipeline")}
                className={view === (i ? "Table" : "Pipeline") ? "active" : ""}
              >
                <Icon size={14} />
                {i ? "Table" : "Pipeline"}
              </button>
            ))}
          </div>
        }
      />
      <div className="pipeline-summary">
        <span>
          <i className="live-dot" />
          {rows.length} opportunities
        </span>
        <span className="vertical-divider" />
        <strong>
          {money(rows.reduce((n, r) => n + r.lead.expectedValue, 0))}
        </strong>
        <span>total pipeline value</span>
      </div>
      <div className="pipeline-toolbar">
        <div className="search-input">
          <Search size={15} />
          <input
            aria-label="Search leads"
            placeholder="Search opportunities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter lead product"
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
        <Button onClick={() => setShowOutcomes(!showOutcomes)}>
          <SlidersHorizontal size={14} />
          {showOutcomes ? "Hide" : "Show"} other outcomes
        </Button>
      </div>
      {view === "Pipeline" ? (
        <div className="kanban">
          {[
            ...pipeline,
            ...(showOutcomes
              ? (["On Hold", "Lost", "Not Interested"] as Stage[])
              : []),
          ].map((stage, i) => {
            const items = rows.filter((r) => r.association.stage === stage);
            return (
              <section
                className={`kanban-column ${dragging ? "drop-enabled" : ""}`}
                key={stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  const a = db.associations.find((a) => a.id === id);
                  if (a && a.stage !== stage)
                    setTransition({ association: a, stage });
                  setDragging("");
                }}
              >
                <div className="kanban-heading">
                  <span>
                    <i
                      style={{
                        background: [
                          "#98a4b8",
                          "#8babe8",
                          "#a699d2",
                          "#6baea1",
                          "#d5ac66",
                          "#6682bf",
                        ][i % 6],
                      }}
                    />
                    {stage}
                    <b>{items.length}</b>
                  </span>
                </div>
                <p className="kanban-total">
                  {money(items.reduce((n, r) => n + r.lead.expectedValue, 0))}
                </p>
                <div className="kanban-cards">
                  {items.length ? (
                    items.map(({ lead: l, association: a }) => {
                      const c = db.contacts.find((c) => c.id === a.contactId)!;
                      const p = db.products.find((p) => p.id === a.productId)!;
                      const u = db.users.find((u) => u.id === a.ownerId)!;
                      return (
                        <article
                          className={`lead-card ${dragging === a.id ? "dragging" : ""}`}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", a.id);
                            setDragging(a.id);
                          }}
                          onDragEnd={() => setDragging("")}
                          key={l.id}
                        >
                          <div className="lead-company">
                            {c.company}
                            <ArrowUpRight size={13} />
                          </div>
                          <button
                            className="lead-name"
                            onClick={() => openContact(c.id)}
                          >
                            {c.firstName} {c.lastName}
                          </button>
                          <span className="lead-product">
                            <i style={{ background: p.color }} />
                            {p.name}
                          </span>
                          <strong className="lead-value">
                            {money(l.expectedValue)}
                          </strong>
                          <div className="lead-card-bottom">
                            <span>
                              <CalendarDays size={12} />
                              {l.nextFollowUp
                                ? date(l.nextFollowUp)
                                    .split(" ")
                                    .slice(0, 2)
                                    .join(" ")
                                : "No follow-up"}
                            </span>
                            <Avatar
                              name={`${u.firstName} ${u.lastName}`}
                              small
                            />
                          </div>
                          <select
                            aria-label={`Change stage for ${c.firstName}`}
                            value={a.stage}
                            onChange={(e) =>
                              setTransition({
                                association: a,
                                stage: e.target.value as Stage,
                              })
                            }
                          >
                            {[
                              ...pipeline,
                              "Client",
                              "On Hold",
                              "Lost",
                              "Not Interested",
                            ].map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </article>
                      );
                    })
                  ) : (
                    <div className="kanban-empty">
                      No opportunities here yet
                      <span>Drop a lead here to move it forward</span>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Product</th>
                <th>Stage</th>
                <th>Value</th>
                <th>Priority</th>
                <th>Next follow-up</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ lead: l, association: a }) => {
                const c = db.contacts.find((c) => c.id === a.contactId)!;
                return (
                  <tr key={l.id}>
                    <td>
                      <button
                        className="record-link"
                        onClick={() => openContact(c.id)}
                      >
                        <strong>
                          {c.firstName} {c.lastName}
                        </strong>
                        <span>{c.company}</span>
                      </button>
                    </td>
                    <td>
                      {db.products.find((p) => p.id === a.productId)?.name}
                    </td>
                    <td>
                      <select
                        aria-label={`Stage for ${c.firstName}`}
                        value={a.stage}
                        onChange={(e) =>
                          setTransition({
                            association: a,
                            stage: e.target.value as Stage,
                          })
                        }
                      >
                        {[
                          ...pipeline,
                          "Client",
                          "On Hold",
                          "Lost",
                          "Not Interested",
                        ].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td>{money(l.expectedValue)}</td>
                    <td>
                      <Badge tone={l.priority === "High" ? "amber" : "neutral"}>
                        {l.priority}
                      </Badge>
                    </td>
                    <td>{date(l.nextFollowUp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && (
            <Empty
              title="No leads found"
              description="Convert a contact to create your first opportunity."
            />
          )}
        </section>
      )}
      {transition && (
        <TransitionDialog
          association={transition.association}
          stage={transition.stage}
          onClose={() => setTransition(null)}
        />
      )}
      <p className="data-note">
        Drag a card to change its stage, or use the stage selector. Every change
        is recorded.
      </p>
    </>
  );
}
