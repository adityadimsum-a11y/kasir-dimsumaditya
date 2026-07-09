export default function Badge({ children, tone = "default", className = "" }) {
  return <span className={`da-badge da-badge-${tone} ${className}`.trim()}>{children}</span>;
}
