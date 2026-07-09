export default function Card({
  children,
  className = "",
  title,
  description,
  action,
}) {
  return (
    <section className={`da-card da-card-padding ${className}`.trim()}>
      {title || description || action ? (
        <div className="da-card-head">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p className="da-muted">{description}</p> : null}
          </div>
          {action ? <div>{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
