import Badge from "./Badge";

export default function PageHeader({ title, description, badge, badgeTone = "warning", actions }) {
  return (
    <div className="da-page-header">
      <div>
        <div className="da-page-kicker">Dimsum Aditya</div>
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
