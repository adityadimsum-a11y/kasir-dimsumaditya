export default function StatCard({ label, value, description, tone = "default" }) {
  return (
    <section className={`da-stat-card da-stat-card-${tone}`}>
      <div className="da-stat-label">{label}</div>
      <div className="da-stat-value">{value}</div>
      {description ? <div className="da-stat-desc">{description}</div> : null}
    </section>
  );
}
