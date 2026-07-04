export default function Card({ children, className = "" }) {
  return <section className={`da-card da-card-padding ${className}`}>{children}</section>;
}
