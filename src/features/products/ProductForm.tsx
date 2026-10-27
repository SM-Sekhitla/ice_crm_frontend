import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, Package, Save } from "lucide-react";
import { toast } from "sonner";
import { useCRM } from "../../app/context";
import { Badge, Button, Modal } from "../../components/ui/primitives";
import { productSchema } from "../../lib/products";
import { api } from "../../services/api";
import type { Product, ProductInput } from "../../types";

const colours = [
  "#c1121f",
  "#bb764e",
  "#b49644",
  "#668574",
  "#776a9a",
  "#597e98",
];

export function ProductForm({
  product,
  onClose,
}: {
  product?: Product;
  onClose: () => void;
}) {
  const { db, user, refresh } = useCRM();
  const [discard, setDiscard] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
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
          code: "",
          type: "Product",
          description: "",
          status: "Active",
          ownerId: user.id,
          color: colours[0],
        },
  });
  const [name, code, type, status, color] = watch([
    "name",
    "code",
    "type",
    "status",
    "color",
  ]);
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
        drawer
      >
        <form
          className="drawer-form"
          aria-busy={isSubmitting}
          onSubmit={handleSubmit(async (values) => {
            try {
              if (product) await api.updateProduct(product.id, values, user.id);
              else await api.addProduct(values, user.id);
              await refresh();
              toast.success(
                product
                  ? "Product updated successfully"
                  : "Product created successfully",
              );
              onClose();
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : "Unable to save this product. Please try again.";
              setError(
                message.includes("code already") ? "code" : "root.server",
                { message },
              );
            }
          })}
        >
          <fieldset
            className="form-body product-form-body"
            disabled={isSubmitting}
          >
            <div className="product-form-preview">
              <span
                className="portfolio-symbol"
                style={{ background: `${color}12`, color }}
              >
                <Package size={24} />
              </span>
              <div>
                <strong>{name.trim() || "Your product name"}</strong>
                <span>
                  {code.trim().toUpperCase() || "CODE"} <i>·</i> {type}
                </span>
              </div>
              <Badge tone={status === "Active" ? "green" : "neutral"}>
                {status}
              </Badge>
            </div>
            <div className="form-section-label">
              <span>01</span>Product details
            </div>
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
            <div className="form-grid">
              <label>
                Product code *
                <input
                  {...register("code")}
                  className="product-code-input"
                  placeholder="e.g. EA-01"
                  aria-invalid={!!errors.code}
                  aria-describedby={
                    errors.code ? "product-code-error" : undefined
                  }
                />
                {errors.code ? (
                  <small id="product-code-error" className="field-error">
                    {errors.code.message}
                  </small>
                ) : (
                  <small className="form-hint">
                    A unique identifier. Up to 12 characters.
                  </small>
                )}
              </label>
              <label>
                Record type
                <select {...register("type")}>
                  <option>Product</option>
                  <option>Service</option>
                  <option>Project</option>
                </select>
              </label>
            </div>
            <label>
              Description
              <textarea
                {...register("description")}
                placeholder="What does this product bring to your customers?"
                rows={4}
                aria-invalid={!!errors.description}
              />
              {errors.description && (
                <small className="field-error">
                  {errors.description.message}
                </small>
              )}
            </label>
            <div className="form-section-label">
              <span>02</span>Ownership & availability
            </div>
            <div className="form-grid">
              <label>
                Product owner
                <select {...register("ownerId")}>
                  {db.users
                    .filter((u) => u.active !== false)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                </select>
                {errors.ownerId && (
                  <small className="field-error">
                    {errors.ownerId.message}
                  </small>
                )}
              </label>
              <label>
                Status
                <select {...register("status")}>
                  <option>Active</option>
                  <option>Inactive</option>
                  <option>Archived</option>
                </select>
              </label>
            </div>
            <p className="form-hint">
              {status === "Active"
                ? "Active products can be selected when adding contacts. The owner receives access to this product."
                : "Existing relationships are retained. New contacts cannot be assigned to inactive or archived products."}
            </p>
            <fieldset className="field-group product-colour-group">
              <legend>Product colour</legend>
              <div
                className="product-colour-options"
                role="group"
                aria-label="Product colour presets"
              >
                {colours.map((c) => (
                  <button
                    type="button"
                    key={c}
                    className="product-colour-swatch"
                    style={{ background: c }}
                    aria-label={`Use colour ${c}`}
                    aria-pressed={c === color}
                    onClick={() =>
                      setValue("color", c, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    {c === color && <Check size={15} />}
                  </button>
                ))}
                <label className="product-custom-colour">
                  <input
                    type="color"
                    aria-label="Custom product colour"
                    {...register("color")}
                  />
                  <span>Custom</span>
                </label>
              </div>
              {errors.color && (
                <small className="field-error">{errors.color.message}</small>
              )}
            </fieldset>
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
