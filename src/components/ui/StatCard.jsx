export default function StatCard({ label, value, description, helper, tone = "default", children, onClick }) {
  const supportingText = description || helper || "";
  const content = (
    <>
      <div className="da-stat-accent" aria-hidden="true" />
      <div className="da-stat-label">{label}</div>
      <div className="da-stat-value">{value}</div>
      {supportingText ? <div className="da-stat-desc">{supportingText}</div> : null}
      {children}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={`da-stat-card da-stat-card-${tone} da-stat-card-v2 is-clickable`.trim()} onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <section className={`da-stat-card da-stat-card-${tone} da-stat-card-v2`.trim()}>
      {content}
    </section>
  );
}
