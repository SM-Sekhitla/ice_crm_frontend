import { useMemo, useState } from "react";
import { Check, FileCode2, ImagePlus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useCRM } from "../../app/context";
import { Badge, Button, Modal } from "../../components/ui/primitives";
import {
  prepareSignatureHtml,
  resolveSignatureHtml,
  sanitizeEmailHtml,
  type PreparedSignature,
} from "../../lib/email-html";
import { api } from "../../services/api";
import type { EmailSignature } from "../../types/campaigns";

async function readImage(file: File) {
  if (
    file.size > 250000 ||
    !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.type)
  )
    throw new Error("Choose a PNG, JPEG, GIF, or WebP image under 250 KB.");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("Unable to read the image. Please select it again."));
    reader.readAsDataURL(file);
  });
}
export function SignatureManager({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect?: (id: string) => void;
}) {
  const { db, user, refresh } = useCRM();
  const [prepared, setPrepared] = useState<PreparedSignature | null>(null);
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [omitted, setOmitted] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [inspected, setInspected] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<EmailSignature | null>(null);
  const [discard, setDiscard] = useState(false);
  const signatures = db.signatures.filter(
    (s) => !s.ownerId || s.ownerId === user.id || user.role === "Super Admin",
  );
  const html = useMemo(
    () =>
      prepared ? resolveSignatureHtml(prepared, replacements, omitted) : "",
    [prepared, replacements, omitted],
  );
  const unresolved =
    prepared?.images.filter(
      (image) => !replacements[image.id] && !omitted.includes(image.id),
    ) ?? [];
  const validContent =
    !!html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, "")
      .trim() || /<img\b/.test(html);
  function close() {
    if (busy) return;
    if (prepared) setDiscard(true);
    else onClose();
  }
  function reset() {
    setPrepared(null);
    setReplacements({});
    setOmitted([]);
    setName("");
    setFileName("");
    setError("");
  }
  return (
    <>
      <Modal
        open
        onOpenChange={(open) => !open && close()}
        title="Email signatures"
        description="Upload an HTML signature, repair local images, and preview before saving."
        drawer
      >
        <div className="signature-manager-body">
          {!prepared ? (
            <>
              <div className="signature-upload">
                <FileCode2 size={28} />
                <h3>Bring your existing signature.</h3>
                <p>
                  Upload a .html or .htm file. Inline fonts, colours, spacing,
                  links, and table layouts are supported.
                </p>
                <label className="signature-file-picker">
                  Upload HTML signature
                  <input
                    type="file"
                    accept=".html,.htm,text/html"
                    disabled={busy}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setError("");
                      setBusy(true);
                      try {
                        if (!/\.html?$/i.test(file.name) || file.size > 150000)
                          throw new Error(
                            "Choose an HTML or HTM file under 150 KB. Add images separately.",
                          );
                        const result = prepareSignatureHtml(await file.text());
                        setPrepared(result);
                        setName(
                          file.name.replace(/\.html?$/i, "").slice(0, 80),
                        );
                        setFileName(file.name);
                        setReplacements({});
                        setOmitted([]);
                        setInspected(null);
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
              <div className="section-heading">
                <h3>Available signatures</h3>
                <Badge>{signatures.length}</Badge>
              </div>
              <div className="signature-library">
                {signatures.map((signature) => {
                  const used = db.campaigns.some(
                    (c) => c.signatureId === signature.id,
                  );
                  return (
                    <div className="signature-library-item" key={signature.id}>
                      <FileCode2 size={19} />
                      <div>
                        <strong>{signature.name}</strong>
                        <small>
                          {signature.ownerId
                            ? `Uploaded HTML${signature.sourceFileName ? ` · ${signature.sourceFileName}` : ""}`
                            : "Built-in template"}
                        </small>
                      </div>
                      <Button
                        onClick={() =>
                          setInspected(
                            inspected === signature.id ? null : signature.id,
                          )
                        }
                      >
                        {inspected === signature.id ? "Hide" : "Preview"}
                      </Button>
                      {onSelect && (
                        <Button
                          variant="primary"
                          onClick={() => {
                            onSelect(signature.id);
                            onClose();
                          }}
                        >
                          Use signature
                        </Button>
                      )}
                      {signature.ownerId && (
                        <button
                          className="icon-button product-delete-action"
                          disabled={used || busy}
                          aria-label={`Delete signature ${signature.name}`}
                          title={
                            used
                              ? "Used by a campaign; retained for history"
                              : "Delete uploaded signature"
                          }
                          onClick={() => {
                            setDeleting(signature);
                            setError("");
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {inspected && (
                <div className="signature-preview">
                  <span>STORED SIGNATURE PREVIEW</span>
                  <div
                    className="email-signature-render"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeEmailHtml(
                        signatures.find((s) => s.id === inspected)?.html ?? "",
                      ),
                    }}
                  />
                </div>
              )}
              <p className="form-hint">
                Uploaded signatures are stored in your CRM account. Signatures
                used by campaigns are retained.
              </p>
            </>
          ) : (
            <>
              <div className="signature-uploaded-file">
                <FileCode2 size={19} />
                <div>
                  <strong>{fileName}</strong>
                  <span>HTML file imported</span>
                </div>
                <Button disabled={busy} onClick={reset}>
                  <X size={13} />
                  Start over
                </Button>
              </div>
              <label>
                Signature name *
                <input
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bruce · Business Development"
                />
              </label>
              {prepared.images.length > 0 && (
                <>
                  <div className="callout">
                    This signature contains {prepared.images.length} image
                    reference{prepared.images.length === 1 ? "" : "s"} that
                    cannot be used directly. A local file path only works on the
                    original computer. Upload each image below, or choose to
                    omit it.
                  </div>
                  <div className="signature-image-list">
                    {prepared.images.map((image) => (
                      <div key={image.id}>
                        <div className="signature-image-heading">
                          <ImagePlus size={17} />
                          <strong>{image.name}</strong>
                          {replacements[image.id] &&
                            !omitted.includes(image.id) && (
                              <Badge tone="green">Embedded</Badge>
                            )}
                          {omitted.includes(image.id) && <Badge>Omitted</Badge>}
                        </div>
                        <small title={image.source}>
                          {image.source || "Image has no source"}
                        </small>
                        <label>
                          Replacement image
                          <input
                            type="file"
                            aria-label={`Upload replacement for ${image.name}`}
                            accept="image/png,image/jpeg,image/gif,image/webp"
                            disabled={busy || omitted.includes(image.id)}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setBusy(true);
                              setError("");
                              try {
                                const value = await readImage(file);
                                setReplacements((v) => ({
                                  ...v,
                                  [image.id]: value,
                                }));
                              } catch (err) {
                                setError((err as Error).message);
                              } finally {
                                setBusy(false);
                                e.target.value = "";
                              }
                            }}
                          />
                        </label>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            disabled={busy}
                            checked={omitted.includes(image.id)}
                            onChange={(e) =>
                              setOmitted((v) =>
                                e.target.checked
                                  ? [...v, image.id]
                                  : v.filter((id) => id !== image.id),
                              )
                            }
                          />
                          Omit this image
                        </label>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="signature-preview">
                <span>PREVIEW · INLINE FORMATTING PRESERVED</span>
                <div
                  className="email-signature-render"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
              <p className="form-hint">
                Images referenced by HTTPS URLs remain remote. Uploaded
                replacement images are embedded in the saved signature.
                Stylesheets, scripts, forms, and unsafe styles are removed.
              </p>
              {unresolved.length > 0 && (
                <p className="field-error">
                  Resolve or omit {unresolved.length} remaining image
                  {unresolved.length === 1 ? "" : "s"} before saving.
                </p>
              )}
              {!validContent && (
                <p className="field-error">
                  The signature needs visible text or a supported image.
                </p>
              )}
              {html.length > 900000 && (
                <p className="field-error">
                  This signature is too large. Use smaller images.
                </p>
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
          <Button disabled={busy} onClick={close}>
            {prepared ? "Cancel" : "Close"}
          </Button>
          {prepared && (
            <Button
              variant="primary"
              loading={busy}
              disabled={
                !name.trim() ||
                !!unresolved.length ||
                !validContent ||
                html.length > 900000
              }
              onClick={async () => {
                try {
                  setBusy(true);
                  setError("");
                  const id = await api.saveUploadedSignature(
                    { name, html, sourceFileName: fileName },
                    user.id,
                  );
                  await refresh();
                  toast.success("HTML signature saved");
                  if (onSelect) {
                    onSelect(id);
                    onClose();
                  } else reset();
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Check size={14} />
              {onSelect ? "Save and use signature" : "Save signature"}
            </Button>
          )}
        </div>
      </Modal>
      <Modal
        open={discard}
        onOpenChange={setDiscard}
        title="Discard imported signature?"
        description="This signature and its uploaded images have not been saved."
      >
        <div className="modal-footer">
          <Button onClick={() => setDiscard(false)}>Keep editing</Button>
          <Button variant="danger" onClick={onClose}>
            Discard import
          </Button>
        </div>
      </Modal>
      {deleting && (
        <Modal
          open
          onOpenChange={(v) => !v && !busy && setDeleting(null)}
          title="Delete uploaded signature?"
          description={`Remove ${deleting.name} from your saved signatures.`}
        >
          <div className="form-body">
            <p className="form-hint">
              Signatures used by any campaign cannot be deleted.
            </p>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <Button disabled={busy} onClick={() => setDeleting(null)}>
              Keep signature
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                try {
                  setBusy(true);
                  await api.deleteSignature(deleting.id, user.id);
                  if (inspected === deleting.id) setInspected(null);
                  await refresh();
                  setDeleting(null);
                  toast.success("Signature deleted");
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete signature
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
