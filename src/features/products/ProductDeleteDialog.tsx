import { useState } from "react";
import { Archive, LockKeyhole, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCRM } from "../../app/context";
import { Button, Modal } from "../../components/ui/primitives";
import { productUsage } from "../../lib/products";
import { api } from "../../services/api";
import type { Product } from "../../types";

export function ProductDeleteDialog({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { db, user, refresh } = useCRM();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const usage = productUsage(db, product.id);
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      if (usage.canDelete) await api.deleteProduct(product.id, user.id);
      else
        await api.updateProduct(
          product.id,
          {
            name: product.name,
            code: product.code,
            type: product.type,
            description: product.description,
            ownerId: product.ownerId,
            color: product.color,
            status: "Archived",
          },
          user.id,
        );
      await refresh();
      toast.success(
        usage.canDelete
          ? "Product deleted successfully"
          : "Product archived. CRM history preserved.",
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update this product. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onOpenChange={(open) => !open && !busy && onClose()}
      title={
        usage.canDelete ? "Delete product?" : "This product has CRM history"
      }
      description={
        usage.canDelete
          ? `Permanently remove ${product.name} from your portfolio.`
          : `${product.name} is connected to records in your workspace.`
      }
    >
      <div className="form-body product-delete-body">
        <span
          className={`product-delete-icon ${usage.canDelete ? "" : "protected"}`}
        >
          {usage.canDelete ? <Trash2 size={23} /> : <LockKeyhole size={23} />}
        </span>
        {usage.canDelete ? (
          <>
            <p>
              This product has no linked contacts or campaigns. Deleting it
              removes the product and its user assignments. This action cannot
              be undone.
            </p>
            <div className="product-delete-record">
              <span style={{ background: product.color }} />
              <strong>{product.name}</strong>
            </div>
          </>
        ) : (
          <>
            <p>
              Archive this product to stop new contact assignments while keeping
              existing contacts, leads, clients, and campaigns available.
            </p>
            <div className="product-delete-impact">
              <span>
                <strong>{usage.contacts}</strong>Linked contacts
              </span>
              <span>
                <strong>{usage.leads}</strong>Active leads
              </span>
              <span>
                <strong>{usage.clients}</strong>Clients
              </span>
              <span>
                <strong>{usage.campaigns}</strong>Campaigns
              </span>
            </div>
            {product.status === "Archived" && (
              <p className="callout">
                This product is already archived. Its linked records must be
                retained, so it cannot be deleted.
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
        <Button onClick={onClose} disabled={busy}>
          {usage.canDelete ? "Keep product" : "Close"}
        </Button>
        {(usage.canDelete || product.status !== "Archived") && (
          <Button
            variant={usage.canDelete ? "danger" : "primary"}
            loading={busy}
            onClick={confirm}
          >
            {usage.canDelete ? <Trash2 size={15} /> : <Archive size={15} />}
            {usage.canDelete ? "Delete product" : "Archive product"}
          </Button>
        )}
      </div>
    </Modal>
  );
}
