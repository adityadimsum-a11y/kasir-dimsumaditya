export default function Card({
  children,
  className = "",
  title,
  description,
  action,
  tone = "default",
}) {
  return (
    <section className={`da-card da-card-padding da-card-v2 da-card-tone-${tone} ${className}`.trim()}>
      {title || description || action ? (
        <div className="da-card-head">
          <div className="da-card-head-copy">
            {title ? <h2>{title}</h2> : null}
            {description ? <p className="da-muted">{description}</p> : null}
          </div>
          {action ? <div className="da-card-head-action">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
