export default function Badge({ children, tone = "default" }) {
  return <span className={`da-badge da-badge-${tone}`}>{children}</span>;
}
