export default function FinanceSnapshot({ eyebrow, value, caption, metrics = [] }) {
  return (
    <section className="da-finance-snapshot-v13" aria-label={eyebrow || "Ringkasan keuangan"}>
      <div className="da-finance-snapshot-hero-v13">
        <div className="da-finance-snapshot-kicker-v13">{eyebrow}</div>
        <div className="da-finance-snapshot-value-v13">{value}</div>
        {caption ? <div className="da-finance-snapshot-caption-v13">{caption}</div> : null}
        <div className="da-finance-snapshot-glow-v13" aria-hidden="true" />
      </div>
      <div className="da-finance-snapshot-metrics-v13">
        {metrics.map((metric, index) => (
          <article key={`${metric.label}-${index}`} className={`da-finance-snapshot-metric-v13 tone-${metric.tone || "default"}`}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            {metric.helper ? <small>{metric.helper}</small> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
