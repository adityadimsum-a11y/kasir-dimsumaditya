import Badge from "./Badge";

export default function PageHeader({
  title,
  description,
  badge,
  badgeTone = "warning",
  actions,
  eyebrow = "Dimsum Aditya · Operations ERP",
}) {
  return (
    <div className="da-page-header">
      <div>
        <div className="da-page-kicker">{eyebrow}</div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>

      {actions ? (
        <div className="da-page-actions">{actions}</div>
      ) : badge ? (
        <Badge tone={badgeTone}>{badge}</Badge>
      ) : null}
    </div>
  );
}
