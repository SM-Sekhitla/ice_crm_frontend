import { useMemo, useState } from "react";
import {
  Archive,
  ArrowDownUp,
  ArrowUpRight,
  Layers3,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCRM } from "../../app/context";
import {
  Avatar,
  Badge,
  Button,
  Empty,
  PageHeader,
  Tip,
} from "../../components/ui/primitives";
import { can } from "../../lib/permissions";
import { productUsage } from "../../lib/products";
import type { Product } from "../../types";
import { ProductForm } from "./ProductForm";
import { ProductDeleteDialog } from "./ProductDeleteDialog";
import { ProductWorkspace } from "./ProductWorkspace";

type View = "All products" | Product["status"];
type Editor = { mode: "create" } | { mode: "edit"; productId: string };

export function Products() {
  const { db, user } = useCRM();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("All products");
  const [type, setType] = useState("");
  const [sort, setSort] = useState("newest");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const managed = can(user, "products.manage");
  const rows = useMemo(
    () =>
      db.products
        .map((product) => ({
          product,
          usage: productUsage(db, product.id),
          owner: db.users.find((u) => u.id === product.ownerId),
        }))
        .filter(
          ({ product }) =>
            (view === "All products" || product.status === view) &&
            (!type || product.type === type) &&
            `${product.name} ${product.code} ${product.description} ${product.type}`
              .toLowerCase()
              .includes(search.trim().toLowerCase()),
        )
        .sort((a, b) =>
          sort === "name"
            ? a.product.name.localeCompare(b.product.name)
            : sort === "contacts"
              ? b.usage.contacts - a.usage.contacts ||
                a.product.name.localeCompare(b.product.name)
              : b.product.createdAt.localeCompare(a.product.createdAt),
        ),
    [db, view, type, search, sort],
  );
  const detail = db.products.find((p) => p.id === detailId);
  const deleting = db.products.find((p) => p.id === deleteId);
  const editedProduct =
    editor?.mode === "edit"
      ? db.products.find((p) => p.id === editor.productId)
      : undefined;
  const hasFilters = !!(search || type || view !== "All products");
  function clearFilters() {
    setSearch("");
    setType("");
    setView("All products");
  }
  return (
    <>
      <PageHeader
        eyebrow="PORTFOLIO / PRODUCTS & PROJECTS"
        title="Product portfolio"
        description="Manage the products, services, and projects behind every relationship."
        actions={
          managed && (
            <Button
              variant="primary"
              onClick={() => setEditor({ mode: "create" })}
            >
              <Plus size={17} />
              Add Product
            </Button>
          )
        }
      />
      <section className="portfolio-overview" aria-label="Portfolio summary">
        <div className="portfolio-overview-intro">
          <span className="portfolio-overview-icon">
            <Layers3 size={21} />
          </span>
          <div>
            <h2>Your portfolio</h2>
            <p>A single view of what you’re building.</p>
          </div>
        </div>
        <dl>
          <div>
            <dt>Total products</dt>
            <dd>{db.products.length.toString().padStart(2, "0")}</dd>
          </div>
          <div>
            <dt>Active</dt>
            <dd>
              <span className="portfolio-summary-dot" />
              {db.products
                .filter((p) => p.status === "Active")
                .length.toString()
                .padStart(2, "0")}
            </dd>
          </div>
          <div>
            <dt>Connected contacts</dt>
            <dd>{new Set(db.associations.map((a) => a.contactId)).size}</dd>
          </div>
        </dl>
      </section>
      <section className="portfolio-workspace" aria-label="Products portfolio">
        <div
          className="portfolio-view-tabs"
          role="group"
          aria-label="Product status views"
        >
          {(["All products", "Active", "Inactive", "Archived"] as View[]).map(
            (v) => (
              <button
                key={v}
                className={view === v ? "active" : ""}
                aria-pressed={view === v}
                onClick={() => setView(v)}
              >
                {v === "Archived" && <Archive size={13} />}
                <span>{v}</span>
                <small>
                  {
                    db.products.filter(
                      (p) => v === "All products" || p.status === v,
                    ).length
                  }
                </small>
              </button>
            ),
          )}
        </div>
        <div className="portfolio-toolbar">
          <div className="search-input">
            <Search size={16} />
            <input
              aria-label="Search products"
              placeholder="Search by name, code, or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="portfolio-clear-search"
                aria-label="Clear product search"
                onClick={() => setSearch("")}
              >
                <X size={13} />
              </button>
            )}
          </div>
          <div className="portfolio-list-controls">
            <select
              aria-label="Filter products by type"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">All types</option>
              <option>Product</option>
              <option>Service</option>
              <option>Project</option>
            </select>
            <div className="portfolio-sort">
              <ArrowDownUp size={13} />
              <select
                aria-label="Sort products"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="name">Name A–Z</option>
                <option value="contacts">Most contacts</option>
              </select>
            </div>
          </div>
        </div>
        {rows.length ? (
          <>
            <div
              className={`portfolio-columns ${managed ? "" : "portfolio-readonly"}`}
              aria-hidden="true"
            >
              <span>Product / project</span>
              <span>Product owner</span>
              <span>Contacts</span>
              <span>Leads</span>
              <span>Clients</span>
              <span>Status</span>
              {managed && <span>Manage</span>}
            </div>
            <div
              className="portfolio-list"
              role="list"
              aria-label="Product records"
            >
              {rows.map(({ product: p, usage, owner }) => (
                <article
                  key={p.id}
                  role="listitem"
                  className={`portfolio-row ${managed ? "" : "portfolio-readonly"}`}
                  aria-label={p.name}
                >
                  <div className="portfolio-product">
                    <button
                      className="portfolio-symbol"
                      aria-label={`Open ${p.name} workspace`}
                      style={{ color: p.color, background: `${p.color}12` }}
                      onClick={() => setDetailId(p.id)}
                    >
                      <Package size={22} />
                    </button>
                    <div>
                      <button
                        className="portfolio-product-name"
                        onClick={() => setDetailId(p.id)}
                      >
                        {p.name}
                        <ArrowUpRight size={13} />
                      </button>
                      <div className="portfolio-product-meta">
                        <code>{p.code}</code>
                        <span>·</span>
                        <span>{p.type}</span>
                      </div>
                      <p title={p.description}>
                        {p.description || "No description added yet."}
                      </p>
                    </div>
                  </div>
                  <div className="portfolio-owner">
                    {owner ? (
                      <>
                        <Avatar
                          name={`${owner.firstName} ${owner.lastName}`}
                          small
                        />
                        <span>
                          {owner.firstName}
                          <small>{owner.lastName}</small>
                        </span>
                      </>
                    ) : (
                      <span>Owner details restricted</span>
                    )}
                  </div>
                  <div className="portfolio-total">
                    <strong>{usage.contacts}</strong>
                    <span>Contacts</span>
                  </div>
                  <div className="portfolio-total">
                    <strong>{usage.leads}</strong>
                    <span>Leads</span>
                  </div>
                  <div className="portfolio-total">
                    <strong>{usage.clients}</strong>
                    <span>Clients</span>
                  </div>
                  <div className="portfolio-status">
                    <Badge tone={p.status === "Active" ? "green" : "neutral"}>
                      {p.status}
                    </Badge>
                  </div>
                  {managed && (
                    <div className="portfolio-actions">
                      <Tip label="Edit product">
                        <button
                          className="icon-button"
                          aria-label={`Edit ${p.name}`}
                          onClick={() =>
                            setEditor({ mode: "edit", productId: p.id })
                          }
                        >
                          <Pencil size={15} />
                        </button>
                      </Tip>
                      <Tip label="Delete product">
                        <button
                          className="icon-button product-delete-action"
                          aria-label={`Delete ${p.name}`}
                          onClick={() => setDeleteId(p.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </Tip>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        ) : (
          <Empty
            title={
              hasFilters ? "No matching products" : "Your portfolio starts here"
            }
            description={
              hasFilters
                ? "Try another search or change your filters."
                : "Create a product, service, or project to start connecting your contacts."
            }
            action={
              hasFilters ? (
                <Button onClick={clearFilters}>Clear filters</Button>
              ) : managed ? (
                <Button
                  variant="primary"
                  onClick={() => setEditor({ mode: "create" })}
                >
                  <Plus size={15} />
                  Add Product
                </Button>
              ) : undefined
            }
          />
        )}
        <div className="portfolio-list-footer">
          <span>
            Showing <strong>{rows.length}</strong> of {db.products.length}{" "}
            products
          </span>
          <span>
            <span className="live-dot" />
            Changes saved to this workspace
          </span>
        </div>
      </section>
      <p className="portfolio-footnote">
        <Package size={13} />
        One portfolio. Every product relationship, connected.
      </p>
      {editor && (editor.mode === "create" || editedProduct) && (
        <ProductForm
          key={editor.mode === "create" ? "create" : editor.productId}
          product={editedProduct}
          onClose={() => setEditor(null)}
        />
      )}
      {detail && (
        <ProductWorkspace
          product={detail}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            setEditor({ mode: "edit", productId: detail.id });
            setDetailId(null);
          }}
          onDelete={() => {
            setDeleteId(detail.id);
            setDetailId(null);
          }}
        />
      )}
      {deleting && (
        <ProductDeleteDialog
          product={deleting}
          onClose={() => setDeleteId(null)}
        />
      )}
    </>
  );
}
