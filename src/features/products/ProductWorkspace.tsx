import { useState } from "react";
import { ArrowUpRight, Package, Pencil, Trash2 } from "lucide-react";
import { useCRM } from "../../app/context";
import {
  Avatar,
  Badge,
  Button,
  Empty,
  Modal,
} from "../../components/ui/primitives";
import { can } from "../../lib/permissions";
import { productUsage } from "../../lib/products";
import { date, relative } from "../../lib/format";
import type { Product } from "../../types";

export function ProductWorkspace({
  product,
  onClose,
  onEdit,
  onDelete,
}: {
  product: Product;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { db, user, openContact } = useCRM();
  const [tab, setTab] = useState("Overview");
  const usage = productUsage(db, product.id);
  const owner = db.users.find((u) => u.id === product.ownerId);
  const relationships = db.associations.filter(
    (a) => a.productId === product.id,
  );
  const activity = db.activities.filter((a) => a.productId === product.id);
  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={product.name}
      description={`${product.code} · ${product.type}`}
      drawer
    >
      <div className="product-workspace-banner">
        <span
          className="portfolio-symbol"
          style={{ background: `${product.color}12`, color: product.color }}
        >
          <Package size={25} />
        </span>
        <div>
          <span className="section-kicker">PRODUCT WORKSPACE</span>
          <Badge tone={product.status === "Active" ? "green" : "neutral"}>
            {product.status}
          </Badge>
        </div>
        {can(user, "products.manage") && (
          <div className="product-workspace-actions">
            <Button onClick={onEdit}>
              <Pencil size={14} />
              Edit product
            </Button>
            <button
              className="icon-button product-delete-action"
              aria-label={`Delete ${product.name}`}
              onClick={onDelete}
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
      <div className="tabs record-tabs">
        {["Overview", "Contacts", "Activity"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
            {t === "Contacts" && <span>{usage.contacts}</span>}
          </button>
        ))}
      </div>
      <div className="record-body product-workspace-body">
        {tab === "Overview" && (
          <>
            <div className="product-workspace-stats">
              {[
                ["Contacts", usage.contacts],
                ["Active leads", usage.leads],
                ["Clients", usage.clients],
              ].map(([label, value]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <h3>About this product</h3>
            <p className="product-workspace-description">
              {product.description || "No description added yet."}
            </p>
            <dl className="detail-grid">
              <dt>Product owner</dt>
              <dd>
                {owner
                  ? `${owner.firstName} ${owner.lastName}`
                  : "Owner details restricted"}
              </dd>
              <dt>Created</dt>
              <dd>{date(product.createdAt)}</dd>
              <dt>Record type</dt>
              <dd>{product.type}</dd>
              <dt>Availability</dt>
              <dd>
                {product.status === "Active"
                  ? "Accepting new contacts"
                  : "Existing relationships only"}
              </dd>
            </dl>
          </>
        )}
        {tab === "Contacts" &&
          (relationships.length ? (
            relationships.map((a) => {
              const c = db.contacts.find((c) => c.id === a.contactId)!;
              return (
                <div className="follow-up" key={a.id}>
                  <Avatar name={`${c.firstName} ${c.lastName}`} small />
                  <button
                    className="record-link"
                    onClick={() => openContact(c.id)}
                  >
                    <strong>
                      {c.firstName} {c.lastName}
                    </strong>
                    <span>{c.company}</span>
                  </button>
                  <Badge tone={a.stage === "Client" ? "green" : "blue"}>
                    {a.stage}
                  </Badge>
                  <ArrowUpRight size={13} />
                </div>
              );
            })
          ) : (
            <Empty
              title="No contacts yet"
              description="Contacts associated with this product will appear here."
            />
          ))}
        {tab === "Activity" &&
          (activity.length ? (
            <div className="detail-timeline">
              {activity.map((a) => (
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
          ) : (
            <Empty
              title="No activity yet"
              description="Product updates and relationship activity will appear here."
            />
          ))}
      </div>
    </Modal>
  );
}
