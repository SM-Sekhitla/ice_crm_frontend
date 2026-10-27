import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Save } from "lucide-react";
import { toast } from "sonner";
import { useCRM } from "../../app/context";
import { Button, Modal } from "../../components/ui/primitives";
import { productSchema } from "../../lib/products";
import { api } from "../../services/api";
import type { Product, ProductInput } from "../../types";

export function ProductForm({
  product,
  onClose,
}: {
  product?: Product;
  onClose: () => void;
}) {
  const { user, refresh } = useCRM();
  const [discard, setDiscard] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          code: product.code,
          type: product.type,
          description: product.description,
          status: product.status,
          ownerId: product.ownerId,
          color: product.color,
        }
      : {
          name: "",
          code: crypto
            .randomUUID()
            .replaceAll("-", "")
            .slice(0, 12)
            .toUpperCase(),
          type: "Product",
          description: "",
          status: "Active",
          ownerId: user.id,
          color: "#c1121f",
        },
  });
  function requestClose() {
    if (isSubmitting) return;
    if (isDirty) setDiscard(true);
    else onClose();
  }
  return (
    <>
      <Modal
        open
        onOpenChange={(open) => !open && requestClose()}
        title={product ? "Edit product" : "Add Product"}
        description={
          product
            ? "Keep your portfolio details up to date."
            : "Give your next opportunity a place to grow."
        }
      >
        <form
          className="product-name-form"
          aria-busy={isSubmitting}
          onSubmit={handleSubmit(async (values) => {
            try {
              if (product) await api.updateProduct(product.id, values, user.id);
              else await api.addProduct(values, user.id);
              await refresh();
              toast.success(
                product
                  ? "Product updated successfully"
                  : "Product added successfully",
              );
              onClose();
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : "Unable to save this product. Please try again.";
              setError("root.server", { message });
            }
          })}
        >
          <fieldset
            className="form-body product-form-body"
            disabled={isSubmitting}
          >
            <label>
              Product name *
              <input
                {...register("name")}
                placeholder="e.g. Enterprise Analytics"
                autoFocus
                aria-invalid={!!errors.name}
                aria-describedby={
                  errors.name ? "product-name-error" : undefined
                }
              />
              {errors.name && (
                <small id="product-name-error" className="field-error">
                  {errors.name.message}
                </small>
              )}
            </label>
            {errors.root?.server && (
              <p className="field-error product-form-error" role="alert">
                {errors.root.server.message}
              </p>
            )}
          </fieldset>
          <div className="modal-footer">
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={requestClose}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {product ? <Save size={15} /> : <ArrowRight size={15} />}
              {product ? "Save changes" : "Add Product"}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={discard}
        onOpenChange={setDiscard}
        title="Discard product changes?"
        description="Your unsaved changes will be lost."
      >
        <div className="modal-footer">
          <Button onClick={() => setDiscard(false)}>Keep editing</Button>
          <Button variant="danger" onClick={onClose}>
            Discard changes
          </Button>
        </div>
      </Modal>
    </>
  );
}
