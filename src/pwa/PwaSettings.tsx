import { useState } from "react";
import { Download, RefreshCw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/primitives";
import { applyPwaUpdate, installPwa, usePwa } from "./client";

export function PwaSettings() {
  const { installed, installable, updateReady } = usePwa();
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel pwa-settings">
      <div className="settings-section-heading">
        <h3>
          <Smartphone size={18} /> CRM on your device
        </h3>
        <p>Keep your workspace a tap away, with its own home screen icon.</p>
      </div>
      {installed ? (
        <p className="pwa-installed">You’re using the installed CRM app.</p>
      ) : installable ? (
        <Button
          variant="primary"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await installPwa();
            } catch {
              toast.error(
                "Installation couldn't open. Try your browser’s install menu.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <Download size={16} /> Install CRM
        </Button>
      ) : (
        <p>
          On iPhone or iPad, open this site in Safari, tap{" "}
          <strong>Share</strong>, then <strong>Add to Home Screen</strong>. On
          Android or desktop, choose <strong>Install app</strong> or{" "}
          <strong>Add to Home screen</strong> in your browser menu when
          available.
        </p>
      )}
      <p className="form-hint">
        An internet connection is needed to view and save CRM records.
        Installation is available on the deployed HTTPS site in supported
        browsers.
      </p>
      {updateReady && (
        <div className="pwa-update">
          <div>
            <strong>A new version is ready</strong>
            <p>Save your changes before updating.</p>
          </div>
          <Button
            onClick={() => {
              if (
                window.confirm(
                  "Have you saved your changes? Update and reload the CRM now?",
                )
              )
                applyPwaUpdate();
            }}
          >
            <RefreshCw size={15} /> Update app
          </Button>
        </div>
      )}
    </section>
  );
}
