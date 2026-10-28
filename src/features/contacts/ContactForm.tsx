import { canAccessProduct } from "../../lib/permissions";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Contact } from "../../types";
import {
  contactSchema as schema,
  contactDefaults,
  provinces,
} from "../../lib/contacts";
import type { ContactInput as Values } from "../../types";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";
import { useCRM } from "../../app/context";
import { api } from "../../services/api";
import { Button, Modal } from "../../components/ui/primitives";
export function ContactForm({
  open,
  setOpen,
  contact,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  contact?: Contact;
}) {
  const { db, user, refresh, openContact } = useCRM();
  const [discard, setDiscard] = useState(false);
  const [tagText, setTagText] = useState((contact?.tags ?? []).join(", "));
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    setError,
    watch,
    setValue,
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...contactDefaults(contact),
      productIds: db.associations
        .filter((a) => a.contactId === contact?.id)
        .map((a) => a.productId),
      ownerId: user.id,
    },
  });
  const selected = watch("productIds");
  const close = () => {
    setOpen(false);
    reset();
    setTagText((contact?.tags ?? []).join(", "));
  };
  return (
    <>
      <Modal
        open={open}
        onOpenChange={(v) => {
          if (isSubmitting) return;
          if (!v && isDirty) setDiscard(true);
          else if (!v) close();
        }}
        title={contact ? "Edit contact" : "Add a new contact"}
        description="Good relationships start with the right details."
        drawer
      >
        <form
          className="drawer-form"
          onSubmit={handleSubmit(async (values) => {
            try {
              if (contact) {
                await api.updateContact(contact.id, values, user.id);
                await refresh();
                close();
                toast.success("Contact updated successfully.");
                return;
              }
              const id = await api.addContact(values, user.id);
              await refresh();
              close();
              toast.success("Contact added successfully.", {
                action: {
                  label: "View contact",
                  onClick: () => openContact(id),
                },
              });
            } catch (e) {
              setError(
                (e as Error).message.includes("email address already")
                  ? "email"
                  : "root.server",
                { message: (e as Error).message },
              );
            }
          })}
        >
          <fieldset
            className="form-body contact-form-fields"
            disabled={isSubmitting}
          >
            <div className="form-section-label">
              <span>01</span>Personal information
            </div>
            <div className="form-grid">
              {(
                [
                  "firstName",
                  "lastName",
                  "email",
                  "phone",
                  "company",
                  "jobTitle",
                ] as const
              ).map((field, i) => (
                <label
                  key={field}
                  className={field === "email" ? "span-two" : ""}
                >
                  {
                    [
                      "First name *",
                      "Last name *",
                      "Email address *",
                      "Phone number",
                      "Company",
                      "Job title",
                    ][i]
                  }
                  <input
                    {...register(field)}
                    type={field === "email" ? "email" : "text"}
                    placeholder={
                      [
                        "e.g. Thandi",
                        "e.g. Nkosi",
                        "thandi@company.co.za",
                        "+27",
                        "Company name",
                        "e.g. Managing Director",
                      ][i]
                    }
                  />
                  {errors[field] && (
                    <small className="field-error">
                      {errors[field]?.message}
                    </small>
                  )}
                </label>
              ))}
            </div>
            {!contact && (
              <>
                <div className="form-section-label">
                  <span>02</span>CRM information
                </div>
                <fieldset className="field-group">
                  <legend>Associated products *</legend>
                  {!db.products.some(
                    (product) =>
                      product.status === "Active" &&
                      canAccessProduct(user, product.id),
                  ) && (
                    <p className="form-hint">
                      Create an active product before adding contacts, or ask
                      your administrator to assign one to you.
                    </p>
                  )}
                  <div className="product-options">
                    {db.products
                      .filter(
                        (p) =>
                          p.status === "Active" && canAccessProduct(user, p.id),
                      )
                      .map((p) => (
                        <button
                          type="button"
                          className={selected.includes(p.id) ? "selected" : ""}
                          aria-pressed={selected.includes(p.id)}
                          key={p.id}
                          onClick={() =>
                            setValue(
                              "productIds",
                              selected.includes(p.id)
                                ? selected.filter((id) => id !== p.id)
                                : [...selected, p.id],
                              { shouldDirty: true, shouldValidate: true },
                            )
                          }
                        >
                          <span style={{ background: p.color }} />
                          {p.name}
                          {selected.includes(p.id) ? (
                            <Check size={13} />
                          ) : (
                            <Plus size={13} />
                          )}
                        </button>
                      ))}
                  </div>
                  {errors.productIds && (
                    <small className="field-error">
                      {errors.productIds.message}
                    </small>
                  )}
                </fieldset>

                <label>
                  Contact owner
                  <select {...register("ownerId")}>
                    {db.users
                      .filter(
                        (u) => user.role === "Super Admin" || u.id === user.id,
                      )
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            )}
            <div className="form-grid">
              <label>
                Source
                <select {...register("source")}>
                  {[
                    "Website",
                    "Referral",
                    "LinkedIn",
                    "Event",
                    "Outbound",
                    "Other",
                    ...(contact?.source &&
                    ![
                      "Website",
                      "Referral",
                      "LinkedIn",
                      "Event",
                      "Outbound",
                      "Other",
                    ].includes(contact.source)
                      ? [contact.source]
                      : []),
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>
                Alternative phone
                <input {...register("alternativePhone")} />
              </label>
              <label>
                Industry
                <input
                  {...register("industry")}
                  placeholder="e.g. Technology"
                />
              </label>
              <label className="span-two">
                Company website
                <input
                  {...register("website")}
                  placeholder="https://company.co.za"
                />
                {errors.website && (
                  <small className="field-error">
                    {errors.website.message}
                  </small>
                )}
              </label>
            </div>
            <label>
              Tags
              <input
                placeholder="e.g. Partner, Priority"
                value={tagText}
                onChange={(e) => {
                  setTagText(e.target.value);
                  setValue(
                    "tags",
                    e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                    { shouldDirty: true },
                  );
                }}
              />
              <small className="form-hint">Separate tags with commas.</small>
              {errors.tags && (
                <small className="field-error">
                  Up to 20 tags, 40 characters each.
                </small>
              )}
            </label>
            <label>
              Notes
              <textarea
                {...register("notes")}
                placeholder="Anything worth remembering…"
                rows={3}
              />
            </label>
            <div className="form-section-label">
              <span>03</span>Communication preferences
            </div>
            <label className="checkbox-label">
              <input type="checkbox" {...register("consent")} />
              <span>
                Email marketing consent
                <small>Only enable if the contact has provided consent.</small>
              </span>
            </label>
            {watch("consent") && (
              <div className="form-grid">
                <label>
                  Consent source *
                  <input
                    {...register("consentSource")}
                    placeholder="e.g. Signed form"
                  />
                  {errors.consentSource && (
                    <small className="field-error">
                      {errors.consentSource.message}
                    </small>
                  )}
                </label>
                <label>
                  Consent date *
                  <input type="date" {...register("consentDate")} />
                  {errors.consentDate && (
                    <small className="field-error">
                      {errors.consentDate.message}
                    </small>
                  )}
                </label>
              </div>
            )}
            <label className="checkbox-label">
              <input type="checkbox" {...register("doNotEmail")} />
              <span>
                Do not email
                <small>
                  Suppress email even when marketing consent is recorded.
                </small>
              </span>
            </label>
            <div className="form-section-label">
              <span>04</span>Location
            </div>
            <label>
              Street address
              <input {...register("address")} />
            </label>
            <div className="form-grid">
              <label>
                City
                <input {...register("city")} />
              </label>
              <label>
                Province
                <input list="contact-provinces" {...register("province")} />
                <datalist id="contact-provinces">
                  {provinces.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </label>
              <label>
                Country
                <input {...register("country")} />
              </label>
            </div>
            {errors.root?.server && (
              <p className="field-error" role="alert">
                {errors.root.server.message}
              </p>
            )}
          </fieldset>
          <div className="modal-footer">
            <Button
              disabled={isSubmitting}
              type="button"
              onClick={() => (isDirty ? setDiscard(true) : close())}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={isSubmitting}>
              {contact ? "Save changes" : "Create contact"} <Plus size={15} />
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={discard}
        onOpenChange={setDiscard}
        title="Discard unsaved contact?"
        description="The details you've entered will be lost."
      >
        <div className="modal-footer">
          <Button onClick={() => setDiscard(false)}>Keep editing</Button>
          <Button
            variant="danger"
            onClick={() => {
              setDiscard(false);
              close();
            }}
          >
            Discard changes
          </Button>
        </div>
      </Modal>
    </>
  );
}
