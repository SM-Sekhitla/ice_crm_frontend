import { stages } from "../../types";
import { toast } from "sonner";
import { can } from "../../lib/permissions";
import {
  filterContacts,
  emptyContactFilters,
  type ContactFilters,
} from "../../lib/contacts";
import { api } from "../../services/api";
import { ContactForm } from "./ContactForm";
import { DeleteContacts } from "./ContactActions";
import { ContactImport } from "./ContactImport";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  FileUp,
  Pencil,
  Trash2,
  Tag,
  BookmarkPlus,
  ArrowDownUp,
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useCRM } from "../../app/context";
import {
  Avatar,
  Badge,
  Button,
  Empty,
  PageHeader,
  Modal,
} from "../../components/ui/primitives";
import type { Contact } from "../../types";
import { date, downloadCsv } from "../../lib/format";
interface SavedView {
  id: string;
  name: string;
  search: string;
  view: string;
  filters: ContactFilters;
}
export function Contacts({
  mode = "contacts",
}: {
  mode?: "contacts" | "clients";
}) {
  const { db, user, refresh, addContact, openContact } = useCRM();
  const [search, setSearch] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName,
        ) &&
        !document.querySelector('[role="dialog"]')
      ) {
        e.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  const [view, setView] = useState("All contacts");
  const [product, setProduct] = useState("");
  const [stage, setStage] = useState("");
  const [filters, setFilters] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState({});
  const [columnsOpen, setColumnsOpen] = useState(false);
  const isClient = mode === "clients";
  const [extra, setExtra] = useState<ContactFilters>({
    ...emptyContactFilters,
  });
  const [debounced, setDebounced] = useState(search);
  const [importing, setImporting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string[]>([]);
  const [tagging, setTagging] = useState(false);
  const [saveView, setSaveView] = useState(false);
  const [busy, setBusy] = useState(false);
  const viewKey = `ice-contact-views-${user.id}-${mode}`;
  const [saved, setSaved] = useState<SavedView[]>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(viewKey) || "[]");
      return Array.isArray(value)
        ? value.filter(
            (v) =>
              v &&
              typeof v.name === "string" &&
              typeof v.id === "string" &&
              v.filters,
          )
        : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 200);
    return () => clearTimeout(id);
  }, [search]);
  const activeFilters = { ...extra, product, stage };
  const data = useMemo(
    () =>
      filterContacts(
        db,
        { ...extra, product, stage },
        debounced,
        view,
        user.id,
        isClient,
      ),
    [db, extra, product, stage, debounced, view, user.id, isClient],
  );
  const hasFilters = Object.values(activeFilters).some(Boolean);
  function clearAll() {
    setProduct("");
    setStage("");
    setExtra({ ...emptyContactFilters });
  }
  function persistViews(next: SavedView[]) {
    try {
      localStorage.setItem(viewKey, JSON.stringify(next));
      setSaved(next);
    } catch {
      toast.error("Unable to save views in this browser.");
    }
  }
  const columns = useMemo<ColumnDef<Contact>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            disabled={search !== debounced}
            aria-label="Select all visible contacts"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            disabled={search !== debounced}
            aria-label={`Select ${row.original.firstName}`}
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
      },
      {
        accessorKey: "firstName",
        header: "Contact name",
        cell: ({ row }) => (
          <button
            className="table-person"
            aria-label={`Open ${row.original.firstName} ${row.original.lastName}`}
            onClick={() => openContact(row.original.id)}
          >
            <Avatar
              name={`${row.original.firstName} ${row.original.lastName}`}
              color={
                db.products.find(
                  (p) =>
                    p.id ===
                    db.associations.find((a) => a.contactId === row.original.id)
                      ?.productId,
                )?.color
              }
              small
            />
            <span>
              <strong>
                {row.original.firstName} {row.original.lastName}
              </strong>
              <small>{row.original.jobTitle}</small>
            </span>
          </button>
        ),
      },
      {
        accessorKey: "email",
        header: "Email address",
        cell: ({ getValue }) => (
          <span className="cell-secondary">{getValue<string>()}</span>
        ),
      },
      { accessorKey: "company", header: "Company" },
      {
        id: "products",
        header: "Products",
        cell: ({ row }) => (
          <div className="table-products">
            {db.associations
              .filter((a) => a.contactId === row.original.id)
              .map((a) => {
                const p = db.products.find((p) => p.id === a.productId)!;
                return (
                  <span key={p.id}>
                    <i style={{ background: p.color }} />
                    {p.name}
                  </span>
                );
              })}
          </div>
        ),
      },
      {
        id: "stage",
        header: "Lifecycle stage",
        cell: ({ row }) => (
          <div className="stacked-badges">
            {db.associations
              .filter((a) => a.contactId === row.original.id)
              .map((a) => (
                <Badge
                  key={a.id}
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
              ))}
          </div>
        ),
      },
      {
        id: "owner",
        header: "Owner",
        cell: ({ row }) => {
          const u = db.users.find(
            (u) =>
              u.id ===
              db.associations.find((a) => a.contactId === row.original.id)
                ?.ownerId,
          );
          return u ? (
            <span className="owner-cell">
              <Avatar name={`${u.firstName} ${u.lastName}`} small />
              {u.firstName}
            </span>
          ) : (
            "—"
          );
        },
      },
      { accessorKey: "phone", header: "Phone" },
      {
        id: "tags",
        header: "Tags",
        cell: ({ row }) => (
          <span className="contact-table-tags">
            {(row.original.tags ?? []).slice(0, 3).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="contact-row-actions">
            <button
              className="icon-button"
              aria-label={`Edit ${row.original.firstName} ${row.original.lastName}`}
              onClick={() => setEditId(row.original.id)}
            >
              <Pencil size={14} />
            </button>
            {can(user, "contacts.delete") && (
              <button
                className="icon-button product-delete-action"
                aria-label={`Delete ${row.original.firstName} ${row.original.lastName}`}
                onClick={() => setDeleting([row.original.id])}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Date added",
        cell: ({ getValue }) => date(getValue<string>()),
      },
    ],
    [db, openContact, user, search, debounced],
  );
  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection, columnVisibility },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    initialState: { pagination: { pageSize: 10 } },
  });
  function exportRows() {
    const selected = table.getSelectedRowModel().rows;
    const rows = selected.length ? selected.map((r) => r.original) : data;
    downloadCsv("ice-contacts.csv", [
      [
        "First name",
        "Last name",
        "Email",
        "Phone",
        "Company",
        "Job title",
        "Source",
        "Tags",
        "Consent",
        "Consent source",
        "Consent date",
        "Do not email",
        "City",
        "Province",
        "Country",
        "Notes",
        "Product codes",
      ],
      ...rows.map((c) => [
        c.firstName,
        c.lastName,
        c.email,
        c.phone,
        c.company,
        c.jobTitle,
        c.source,
        (c.tags ?? []).join(";"),
        String(c.consent),
        c.consentSource ?? "",
        c.consentDate ?? (c.consent ? c.createdAt.slice(0, 10) : ""),
        String(c.doNotEmail),
        c.city ?? "",
        c.province ?? "",
        c.country ?? "South Africa",
        c.notes,
        db.associations
          .filter((a) => a.contactId === c.id)
          .map((a) => db.products.find((p) => p.id === a.productId)?.code)
          .join(";"),
      ]),
    ]);
  }
  useEffect(() => {
    table.setPageIndex(0);
    setRowSelection({});
  }, [search, product, stage, extra, view, table]);
  const selectedIds = table
    .getSelectedRowModel()
    .rows.map((r) => r.original.id);
  const editing = db.contacts.find((c) => c.id === editId);

  return (
    <>
      <PageHeader
        eyebrow={
          isClient ? "RELATIONSHIPS THAT GO FURTHER" : "YOUR NETWORK, CONNECTED"
        }
        title={isClient ? "Clients" : "Contacts"}
        description={
          isClient
            ? "Keep your strongest relationships moving forward."
            : "The people behind your next opportunity. All in one place."
        }
        actions={
          <>
            <Button onClick={exportRows}>
              <ArrowDownToLine size={15} />
              Export {table.getSelectedRowModel().rows.length ? "selected" : ""}
            </Button>
            {!isClient && (
              <Button onClick={() => setImporting(true)}>
                <FileUp size={15} />
                Import contacts
              </Button>
            )}
            {!isClient && (
              <Button variant="primary" onClick={addContact}>
                <Plus size={16} />
                Add contact
              </Button>
            )}
          </>
        }
      />
      <div className="contact-saved-views">
        <label>
          Saved views
          <select
            aria-label="Saved contact views"
            value=""
            onChange={(e) => {
              const v = saved.find((v) => v.id === e.target.value);
              if (v) {
                setSearch(v.search);
                setView(v.view);
                setProduct(v.filters.product);
                setStage(v.filters.stage);
                setExtra({ ...emptyContactFilters, ...v.filters });
              }
            }}
          >
            <option value="">Choose a saved view</option>
            {saved.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={() => setSaveView(true)}>
          <BookmarkPlus size={14} />
          Save current view
        </Button>
        {saved.length > 0 && (
          <details>
            <summary>Manage saved views</summary>
            <div>
              {saved.map((v) => (
                <span key={v.id}>
                  {v.name}
                  <button
                    className="icon-button"
                    aria-label={`Delete saved view ${v.name}`}
                    onClick={() =>
                      persistViews(saved.filter((x) => x.id !== v.id))
                    }
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
            </div>
          </details>
        )}
      </div>
      <section className="panel table-panel">
        {!isClient && (
          <div className="tabs table-tabs">
            {[
              "All contacts",
              "My contacts",
              "Recently added",
              "Not yet converted",
            ].map((t) => (
              <button
                key={t}
                className={view === t ? "active" : ""}
                onClick={() => {
                  setView(t);
                  table.setPageIndex(0);
                }}
              >
                {t}
                {t === "All contacts" && <span>{db.contacts.length}</span>}
              </button>
            ))}
          </div>
        )}
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={16} />
            <input
              ref={searchInput}
              placeholder={`Search ${mode}…`}
              aria-label={`Search ${mode}`}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                table.setPageIndex(0);
              }}
            />
            <kbd>/</kbd>
          </div>
          <div>
            <Button onClick={() => setFilters(!filters)}>
              <SlidersHorizontal size={14} />
              Filters
              {hasFilters && <span className="filter-indicator" />}
            </Button>
            <div className="relative">
              <Button onClick={() => setColumnsOpen(!columnsOpen)}>
                Columns
              </Button>
              {columnsOpen && (
                <div className="columns-popover">
                  {table
                    .getAllLeafColumns()
                    .filter((c) => c.id !== "select")
                    .map((c) => (
                      <label className="checkbox-label" key={c.id}>
                        <input
                          type="checkbox"
                          checked={c.getIsVisible()}
                          onChange={c.getToggleVisibilityHandler()}
                        />
                        {typeof c.columnDef.header === "string"
                          ? c.columnDef.header
                          : c.id}
                      </label>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {filters && (
          <div className="filter-bar">
            <select
              aria-label="Filter by product"
              value={product}
              onChange={(e) => {
                setProduct(e.target.value);
                table.setPageIndex(0);
              }}
            >
              <option value="">All products</option>
              {db.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by lifecycle"
              value={stage}
              onChange={(e) => {
                setStage(e.target.value);
                table.setPageIndex(0);
              }}
            >
              <option value="">All stages</option>
              {stages.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              aria-label="Filter by owner"
              value={extra.owner}
              onChange={(e) =>
                setExtra((v) => ({ ...v, owner: e.target.value }))
              }
            >
              <option value="">All owners</option>
              {db.users
                .filter((u) => user.role === "Super Admin" || u.id === user.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
            </select>
            <select
              aria-label="Filter by source"
              value={extra.source}
              onChange={(e) =>
                setExtra((v) => ({ ...v, source: e.target.value }))
              }
            >
              <option value="">All sources</option>
              {[...new Set(db.contacts.map((c) => c.source))]
                .sort()
                .map((source) => (
                  <option key={source}>{source}</option>
                ))}
            </select>
            <select
              aria-label="Filter by email consent"
              value={extra.consent}
              onChange={(e) =>
                setExtra((v) => ({ ...v, consent: e.target.value }))
              }
            >
              <option value="">All email preferences</option>
              <option>Opted in</option>
              <option>No consent</option>
              <option>Do not email</option>
            </select>
            <input
              aria-label="Filter by company"
              placeholder="Company contains…"
              value={extra.company}
              onChange={(e) =>
                setExtra((v) => ({ ...v, company: e.target.value }))
              }
            />
            <input
              aria-label="Filter by tag"
              placeholder="Tag contains…"
              value={extra.tag}
              onChange={(e) => setExtra((v) => ({ ...v, tag: e.target.value }))}
            />
            <label>
              Created from
              <input
                type="date"
                aria-label="Contacts created from"
                value={extra.from}
                onChange={(e) =>
                  setExtra((v) => ({ ...v, from: e.target.value }))
                }
              />
            </label>
            <label>
              Created to
              <input
                type="date"
                aria-label="Contacts created to"
                value={extra.to}
                onChange={(e) =>
                  setExtra((v) => ({ ...v, to: e.target.value }))
                }
              />
            </label>
          </div>
        )}
        {hasFilters && (
          <div className="filter-chips">
            {Object.entries(activeFilters)
              .filter(([, value]) => value)
              .map(([key, value]) => (
                <button
                  key={key}
                  onClick={() =>
                    key === "product"
                      ? setProduct("")
                      : key === "stage"
                        ? setStage("")
                        : setExtra((v) => ({ ...v, [key]: "" }))
                  }
                >
                  {key}:{" "}
                  {key === "product"
                    ? db.products.find((p) => p.id === value)?.name
                    : key === "owner"
                      ? db.users.find((u) => u.id === value)?.firstName
                      : value}
                  <X size={12} />
                </button>
              ))}
            <button onClick={clearAll}>Clear all</button>
          </div>
        )}
        {selectedIds.length > 0 && (
          <div className="contact-bulk-bar">
            <strong>{selectedIds.length} selected</strong>
            <Button onClick={exportRows}>
              <ArrowDownToLine size={13} />
              Export selected
            </Button>
            <Button onClick={() => setTagging(true)}>
              <Tag size={13} />
              Add tag
            </Button>
            {can(user, "contacts.delete") && (
              <Button variant="danger" onClick={() => setDeleting(selectedIds)}>
                <Trash2 size={13} />
                Delete selected
              </Button>
            )}
            <button
              className="icon-button"
              aria-label="Clear selection"
              onClick={() => setRowSelection({})}
            >
              <X size={14} />
            </button>
          </div>
        )}
        {data.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => (
                      <th key={h.id}>
                        {h.column.getCanSort() ? (
                          <button
                            className="table-sort"
                            onClick={h.column.getToggleSortingHandler()}
                          >
                            {flexRender(
                              h.column.columnDef.header,
                              h.getContext(),
                            )}
                            <ArrowDownUp size={11} />
                          </button>
                        ) : (
                          flexRender(h.column.columnDef.header, h.getContext())
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={row.getIsSelected() ? "selected" : ""}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={`No ${mode} found`}
            description="Try another search or adjust your filters."
          />
        )}
        <div className="table-pagination">
          <span>
            {table.getSelectedRowModel().rows.length > 0
              ? `${table.getSelectedRowModel().rows.length} selected · `
              : ""}
            {data.length ? table.getState().pagination.pageIndex * 10 + 1 : 0}–
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * 10,
              data.length,
            )}{" "}
            of {data.length} {mode}
          </span>
          <div>
            <Button
              aria-label="Previous page"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft size={15} />
            </Button>
            <span>
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {Math.max(1, table.getPageCount())}
            </span>
            <Button
              aria-label="Next page"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      </section>
      <p className="data-note">
        One contact, many relationships. Lifecycle stages belong to each
        product.
      </p>
      {importing && <ContactImport onClose={() => setImporting(false)} />}
      {editing && (
        <ContactForm
          open
          contact={editing}
          setOpen={(v) => !v && setEditId(null)}
        />
      )}
      {deleting.length > 0 && (
        <DeleteContacts
          ids={deleting}
          onClose={() => setDeleting([])}
          onDeleted={() => setRowSelection({})}
        />
      )}
      <Modal
        open={tagging}
        onOpenChange={(v) => !busy && setTagging(v)}
        title="Tag selected contacts"
        description={`Add a tag to ${selectedIds.length} selected contacts.`}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              setBusy(true);
              await api.tagContacts(selectedIds, String(f.get("tag")), user.id);
              await refresh();
              toast.success("Tags added");
              setTagging(false);
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-body">
            <label>
              Tag
              <input name="tag" required maxLength={40} />
            </label>
          </div>
          <div className="modal-footer">
            <Button
              type="button"
              disabled={busy}
              onClick={() => setTagging(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              Add tag
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={saveView}
        onOpenChange={setSaveView}
        title="Save contact view"
        description="Keep this search and filter combination for later."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = String(
              new FormData(e.currentTarget).get("name"),
            ).trim();
            if (!name) return;
            if (
              saved.some((v) => v.name.toLowerCase() === name.toLowerCase())
            ) {
              toast.error("A saved view with this name already exists.");
              return;
            }
            persistViews([
              ...saved,
              {
                id: crypto.randomUUID(),
                name,
                search,
                view,
                filters: activeFilters,
              },
            ]);
            setSaveView(false);
          }}
        >
          <div className="form-body">
            <label>
              View name
              <input name="name" required maxLength={60} />
            </label>
          </div>
          <div className="modal-footer">
            <Button type="button" onClick={() => setSaveView(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save view
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
