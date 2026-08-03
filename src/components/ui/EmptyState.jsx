import Button from "./Button";

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}) {
  return (
    <div className="da-empty-state">
      <div className="da-empty-icon">●</div>
      <h3>{title}</h3>
      <p>{description}</p>

      {actionLabel ? (
        <Button variant="ghost" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
