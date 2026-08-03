export default function Button({
  children,
  type = "button",
  variant = "primary",
  disabled = false,
  onClick,
  className = "",
  title,
}) {
  return (
    <button
      type={type}
      className={`da-button da-button-${variant} ${className}`.trim()}
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}
