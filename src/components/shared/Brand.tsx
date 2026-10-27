/** Compact app identity using the ICE website's crimson and dark palette. */
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-symbol">
        ICE
        <span className="brand-corner" />
      </span>
      <span className="brand-text">
        <strong>
          ICE<span className="brand-divider">/</span>
          <span className="brand-product">CRM</span>
        </strong>
        <small>BUSINESS DEVELOPMENT</small>
      </span>
    </span>
  );
}
