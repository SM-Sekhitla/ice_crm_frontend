import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, FileUp, Download } from "lucide-react";
import { toast } from "sonner";
import { useCRM } from "../../app/context";
import { Badge, Button, Modal } from "../../components/ui/primitives";
import {
  csvFields,
  parseContactCsv,
  previewContactCsv,
  suggestMapping,
  type CsvData,
  type CsvField,
} from "../../lib/contact-csv";
import { canAccessProduct } from "../../lib/permissions";
import { downloadCsv } from "../../lib/format";
import { api } from "../../services/api";

export function ContactImport({ onClose }: { onClose: () => void }) {
  const { db, user, refresh } = useCRM();
  const [csv, setCsv] = useState<CsvData | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<CsvField, string>>>({});
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [product, setProduct] = useState("");
  const [owner, setOwner] = useState(user.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const owners = db.users.filter(
    (u) =>
      (user.role === "Super Admin" || u.id === user.id) &&
      (!product || canAccessProduct(u, product)),
  );
  const preview = useMemo(
    () =>
      csv
        ? previewContactCsv(
            csv,
            mapping,
            product,
            owner,
            db.contacts.map((c) => c.email),
          )
        : [],
    [csv, mapping, product, owner, db.contacts],
  );
  const ready = preview.filter((r) => r.input);
  const validMapping = !!(
    mapping.firstName &&
    mapping.lastName &&
    mapping.email &&
    product &&
    owners.some((u) => u.id === owner) &&
    new Set(Object.values(mapping).filter(Boolean)).size ===
      Object.values(mapping).filter(Boolean).length
  );
  return (
    <Modal
      open
      onOpenChange={(v) => !v && !busy && onClose()}
      title="Import contacts"
      description={`Step ${step} of 3 · ${step === 1 ? "Upload a CSV" : step === 2 ? "Map columns & choose a product" : "Review before importing"}`}
      drawer
    >
      <div className="contact-import-content">
        {step === 1 && (
          <>
            <div className="contact-import-upload">
              <FileUp size={32} />
              <h3>Bring your network into ICE</h3>
              <p>
                Upload a CSV with a header row. Up to 1,000 contacts, 1 MB per
                file.
              </p>
              <label>
                Choose CSV file
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setError("");
                    setBusy(true);
                    try {
                      if (file.size > 1_000_000)
                        throw new Error("Use a CSV file smaller than 1 MB.");
                      const parsed = parseContactCsv(await file.text());
                      setCsv(parsed);
                      setMapping(suggestMapping(parsed.headers));
                      setFileName(file.name);
                      setStep(2);
                    } catch (err) {
                      setError((err as Error).message);
                    } finally {
                      setBusy(false);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
            </div>
            <Button
              onClick={() =>
                downloadCsv("ice-contact-import-template.csv", [
                  [
                    "First name",
                    "Last name",
                    "Email",
                    "Phone",
                    "Company",
                    "Job title",
                    "Tags",
                  ],
                  [
                    "Thandi",
                    "Nkosi",
                    "thandi@example.co.za",
                    "+27 82 123 4567",
                    "Example Company",
                    "Director",
                    "Partner",
                  ],
                ])
              }
            >
              <Download size={14} />
              Download CSV template
            </Button>
            <div className="callout">
              Consent is not assumed. Contacts without explicit consent remain
              opted out. Existing emails are skipped instead of creating
              duplicate people.
            </div>
          </>
        )}
        {step === 2 && csv && (
          <>
            <p className="contact-import-file">
              {fileName}
              <span>{csv.rows.length} rows</span>
            </p>
            <div className="form-grid">
              <label>
                Assign to product *
                <select
                  aria-label="Import product"
                  value={product}
                  onChange={(e) => {
                    setProduct(e.target.value);
                    setOwner(user.id);
                  }}
                >
                  <option value="">Choose an active product</option>
                  {db.products
                    .filter((p) => p.status === "Active")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Assigned owner
                <select
                  aria-label="Import owner"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                >
                  {owners.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <h3>Match your columns</h3>
            <p className="form-hint">
              First name, last name, and email are required. Each CSV column can
              map to one field.
            </p>
            <div className="contact-import-mapping">
              {csvFields.map((field) => (
                <label key={field}>
                  <span>
                    {field.replace(/([A-Z])/g, " $1")}
                    {["firstName", "lastName", "email"].includes(field)
                      ? " *"
                      : ""}
                  </span>
                  <select
                    aria-label={`Map ${field}`}
                    value={mapping[field] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [field]: e.target.value }))
                    }
                  >
                    <option value="">Do not import</option>
                    {csv.headers.map((h) => (
                      <option key={h}>{h}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <div className="contact-import-summary">
              <span>
                <strong>{ready.length}</strong>Ready
              </span>
              <span>
                <strong>
                  {preview.filter((r) => r.status === "Duplicate").length}
                </strong>
                Duplicates skipped
              </span>
              <span>
                <strong>
                  {preview.filter((r) => r.status === "Invalid").length}
                </strong>
                Invalid rows skipped
              </span>
            </div>
            <p className="form-hint">
              Only ready rows will be imported. Duplicate emails are checked
              again when saving. Product:{" "}
              {db.products.find((p) => p.id === product)?.name}.
            </p>
            <div className="table-scroll contact-import-preview">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Contact</th>
                    <th>Status / details</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.row}>
                      <td>{r.row}</td>
                      <td>
                        <strong>{r.name || "Missing name"}</strong>
                        <small>{r.email || "Missing email"}</small>
                      </td>
                      <td>
                        <Badge
                          tone={
                            r.status === "Ready"
                              ? "green"
                              : r.status === "Duplicate"
                                ? "amber"
                                : "neutral"
                          }
                        >
                          {r.status}
                        </Badge>
                        {r.status !== "Ready" && <p>{r.message}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.some((r) => r.status !== "Ready") && (
              <Button
                onClick={() =>
                  downloadCsv("ice-import-skipped-rows.csv", [
                    ["CSV row", "Email", "Status", "Reason"],
                    ...preview
                      .filter((r) => r.status !== "Ready")
                      .map((r) => [r.row, r.email, r.status, r.message]),
                  ])
                }
              >
                <Download size={14} />
                Download skipped-row report
              </Button>
            )}
          </>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="modal-footer">
        {step > 1 ? (
          <Button
            disabled={busy}
            onClick={() => {
              setStep((s) => s - 1);
              setError("");
            }}
          >
            <ArrowLeft size={14} />
            Back
          </Button>
        ) : (
          <Button disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        )}
        {step === 2 && (
          <Button
            variant="primary"
            disabled={!validMapping}
            onClick={() => setStep(3)}
          >
            Preview import
            <ArrowRight size={14} />
          </Button>
        )}
        {step === 3 && (
          <Button
            variant="primary"
            loading={busy}
            disabled={!ready.length}
            onClick={async () => {
              try {
                setBusy(true);
                const result = await api.importContacts(
                  ready.map((r) => r.input!),
                  user.id,
                );
                await refresh();
                toast.success(
                  `${result.imported} contacts imported${result.skipped ? `; ${result.skipped} existing emails skipped` : ""}`,
                );
                onClose();
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Import {ready.length} contacts
          </Button>
        )}
      </div>
    </Modal>
  );
}
