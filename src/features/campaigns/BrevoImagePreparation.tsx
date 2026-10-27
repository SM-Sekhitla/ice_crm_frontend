import { useState } from "react";
import { Download, ExternalLink, ImageIcon } from "lucide-react";
import { Button, Modal } from "../../components/ui/primitives";
import {
  embeddedEmailImages,
  publicImageUrl,
  replaceEmbeddedEmailImages,
} from "../../lib/email-images";
import { sanitizeEmailHtml } from "./EmailPreview";

export function BrevoImagePreparation({
  bodyHtml,
  signatureHtml,
  onApply,
  onClose,
}: {
  bodyHtml: string;
  signatureHtml: string;
  onApply: (bodyHtml: string, signatureHtml: string) => Promise<void>;
  onClose: () => void;
}) {
  const images = embeddedEmailImages({
    Message: bodyHtml,
    Signature: signatureHtml,
  });
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function download(source: string, name: string) {
    const anchor = document.createElement("a");
    anchor.href = source;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title="Prepare images for Brevo"
      description="Keep your signature and message images by replacing embedded files with public image links."
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          try {
            const replacements = new Map(
              images.map((image) => [
                image.source,
                publicImageUrl(urls[image.id] ?? ""),
              ]),
            );
            setBusy(true);
            await onApply(
              sanitizeEmailHtml(
                replaceEmbeddedEmailImages(bodyHtml, replacements),
              ),
              sanitizeEmailHtml(
                replaceEmbeddedEmailImages(signatureHtml, replacements),
              ),
            );
            onClose();
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-body">
          <ol className="brevo-image-instructions">
            <li>Download each image below.</li>
            <li>
              Upload it to your Brevo Content library or a public image location
              on your website.
            </li>
            <li>Paste its direct HTTPS image URL below and save.</li>
          </ol>
          <a
            className="text-link"
            href="https://help.brevo.com/hc/en-us/articles/4504463584786-Add-and-manage-images-in-the-Content-library"
            target="_blank"
            rel="noopener noreferrer"
          >
            Brevo image-upload instructions <ExternalLink size={13} />
          </a>
          {images.map((image) => (
            <section className="brevo-image-item" key={image.id}>
              <div className="brevo-image-summary">
                <img
                  src={image.source}
                  alt={`Embedded image from ${image.locations.join(" and ")}`}
                />
                <div>
                  <strong>{image.name}</strong>
                  <small>{image.locations.join(" · ")}</small>
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => download(image.source, image.name)}
                  >
                    <Download size={13} />
                    Download image
                  </Button>
                </div>
              </div>
              <label>
                Public HTTPS image URL
                <input
                  type="url"
                  required
                  value={urls[image.id] ?? ""}
                  placeholder="https://your-public-image-host/image.png"
                  disabled={busy}
                  onChange={(event) => {
                    setUrls({ ...urls, [image.id]: event.target.value });
                    setError("");
                  }}
                />
              </label>
            </section>
          ))}
          {!images.length && <p>No embedded images remain.</p>}
          <p className="form-hint">
            Use a direct image link, not a sharing page or localhost address.
            The saved signature is updated for future drafts; sent and scheduled
            campaigns keep their existing snapshot.
          </p>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <Button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={busy}
            disabled={
              !images.length || images.some((image) => !urls[image.id]?.trim())
            }
          >
            <ImageIcon size={15} />
            Save image links
          </Button>
        </div>
      </form>
    </Modal>
  );
}
