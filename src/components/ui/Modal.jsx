export default function Modal({ open, title, subtitle, onClose, children }) {
  if (!open) return null;

  return (
    <div className="da-modal-backdrop" onMouseDown={onClose}>
      <section
        className="da-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="da-modal-header">
          <div>
            <div className="da-modal-title">{title}</div>
            {subtitle ? (
              <div className="da-modal-subtitle">{subtitle}</div>
            ) : null}
          </div>

          <button type="button" className="da-modal-close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="da-modal-body">{children}</div>
      </section>
    </div>
  );
}
