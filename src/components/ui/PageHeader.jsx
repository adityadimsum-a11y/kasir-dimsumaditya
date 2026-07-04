import Badge from "./Badge";

export default function PageHeader({ title, description, badge }) {
  return (
    <div className="da-page-header">
      <div>
        <div className="da-page-kicker">Dimsum Aditya</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      {badge ? <Badge tone="warning">{badge}</Badge> : null}
    </div>
  );
}
