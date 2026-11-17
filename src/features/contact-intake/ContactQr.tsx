import { useEffect, useState } from "react";
import { Copy, Download, ExternalLink, QrCode, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useCRM } from "../../app/context";
import { Button, Modal } from "../../components/ui/primitives";
import { json, request } from "../../services/http";
import type { ContactIntakeLink } from "./links";

export function ContactQrButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <QrCode size={16} /> My contact QR
      </Button>
      {open && <ContactQr onClose={() => setOpen(false)} />}
    </>
  );
}
function ContactQr({ onClose }: { onClose: () => void }) {
  const { user } = useCRM();
  const [link, setLink] = useState<ContactIntakeLink | null>(null);
  const [qr, setQr] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<"replace" | "disable" | null>(null);
  useEffect(() => {
    let active = true;
    void request<ContactIntakeLink>("/contact-intake-link")
      .then((result) => {
        if (active) setLink(result);
      })
      .catch((error: Error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setQr("");
    if (!link?.url) return;
    void import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(link.url!, {
          width: 600,
          margin: 4,
          errorCorrectionLevel: "M",
          color: { dark: "#171719", light: "#ffffff" },
        }),
      )
      .then((result) => {
        if (active) setQr(result);
      })
      .catch(() => {
        if (active)
          setError(
            "Couldn’t draw the QR code. You can still copy your form link.",
          );
      });
    return () => {
      active = false;
    };
  }, [link?.url]);
  async function change(action: "create" | "replace" | "disable") {
    setBusy(true);
    setError("");
    try {
      if (action === "disable") {
        await request<void>("/contact-intake-link", json("DELETE"));
        setLink({ enabled: false, url: null });
        toast.success("Contact QR link disabled");
      } else {
        const result = await request<ContactIntakeLink>(
          "/contact-intake-link",
          json("POST", { replace: action === "replace" }),
        );
        setLink(result);
        toast.success(
          action === "replace"
            ? "New QR code created. The previous code no longer works."
            : "Your contact QR is ready",
        );
      }
      setConfirm(null);
    } catch (error) {
      setError((error as Error).message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Modal
        open
        onOpenChange={(open) => {
          if (!open && !busy) onClose();
        }}
        title="Your contact QR"
        description="Let a client scan your code and share their details. No sign-in needed."
      >
        <div className="form-body contact-qr-body">
          {loading ? (
            <p role="status">Loading your QR link…</p>
          ) : link?.url ? (
            <>
              <div className="contact-qr-card">
                <span className="eyebrow">SCAN TO CONNECT</span>
                {qr ? (
                  <img
                    src={qr}
                    width={260}
                    height={260}
                    alt={`Scan to share your details with ${user.firstName}`}
                  />
                ) : (
                  <div className="contact-qr-placeholder" role="status">
                    Preparing QR code…
                  </div>
                )}
                <strong>
                  {user.firstName} {user.lastName}
                </strong>
                <small>Share your contact details with our team</small>
              </div>
              <div className="contact-qr-actions">
                <Button
                  disabled={!qr || busy}
                  onClick={() => {
                    const anchor = document.createElement("a");
                    anchor.href = qr;
                    anchor.download = "crm-contact-qr.png";
                    anchor.click();
                  }}
                >
                  <Download size={15} /> Download QR
                </Button>
                <Button
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(link.url!);
                      toast.success("Contact form link copied");
                    } catch {
                      toast.error("Copy the form link from the field below.");
                    }
                  }}
                >
                  <Copy size={15} /> Copy link
                </Button>
              </div>
              <label className="contact-qr-link">
                Your form link
                <input
                  readOnly
                  value={link.url}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <a
                className="text-link"
                href={link.url}
                target="_blank"
                rel="noreferrer"
              >
                Open contact form <ExternalLink size={14} />
              </a>
              <p className="form-hint">
                Keep this code for future meetings. New contacts appear in the
                shared Contacts list. Existing email addresses are kept without
                changing their details.
              </p>
              <div className="contact-qr-manage">
                <Button disabled={busy} onClick={() => setConfirm("replace")}>
                  <RefreshCw size={14} /> Replace QR
                </Button>
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => setConfirm("disable")}
                >
                  Disable link
                </Button>
              </div>
            </>
          ) : link ? (
            <div className="contact-qr-empty">
              <QrCode size={46} />
              <h3>A simpler introduction.</h3>
              <p>
                Create your personal QR code. Clients scan it, enter their
                details, and become contacts in your CRM.
              </p>
              <Button
                variant="primary"
                loading={busy}
                onClick={() => void change("create")}
              >
                Generate my QR code
              </Button>
            </div>
          ) : null}
          {error && (
            <>
              <p className="field-error" role="alert">
                {error}
              </p>
              {!link && !loading && (
                <Button onClick={() => setConfirm("replace")}>
                  Generate a new QR code
                </Button>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <Button disabled={busy} onClick={onClose}>
            Done
          </Button>
        </div>
      </Modal>
      <Modal
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirm(null);
        }}
        title={
          confirm === "replace"
            ? "Replace your QR code?"
            : "Disable your contact form?"
        }
        description="The current QR code and any copies of its link will stop accepting submissions."
      >
        <div className="form-body">
          <p>
            {confirm === "replace"
              ? "You’ll get a new code to share. Previously saved contacts are kept."
              : "You can generate a new QR code when you’re ready to share the form again. Previously saved contacts are kept."}
          </p>
        </div>
        <div className="modal-footer">
          <Button disabled={busy} onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={() => confirm && void change(confirm)}
          >
            {confirm === "replace" ? "Replace QR" : "Disable link"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
