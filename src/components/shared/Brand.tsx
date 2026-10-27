/** Original company symbol with a CRM wordmark; symbol only on the rail. */
export function Brand() {
  return (
    <span
      className="brand"
      role="img"
      aria-label="CRM — Customer Relationship Management"
    >
      <svg
        className="brand-logo-symbol"
        viewBox="0 0 444 444"
        aria-hidden="true"
        focusable="false"
      >
        <image href="/brand/ice-logo.png" width="2331" height="444" />
      </svg>
      <span className="brand-logo-full">
        <strong className="brand-logo-wordmark">CRM</strong>
        <small className="brand-logo-description">
          CUSTOMER RELATIONSHIP MANAGEMENT
        </small>
      </span>
    </span>
  );
}
