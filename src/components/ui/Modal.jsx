import { ArrowLeft, X } from "lucide-react";

export default function Modal({ open, title, subtitle, onClose, children, onBack, size = "lg" }) {
  if (!open) return null;

  return (
    <div className="da-modal-backdrop" onMouseDown={onClose}>
      <section
        className={`da-modal da-modal-v2 da-modal-size-${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Detail"}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="da-modal-header">
          <div className="da-modal-header-left">
            {onBack ? (
              <button type="button" className="da-modal-back" onClick={onBack} aria-label="Kembali">
                <ArrowLeft size={19} />
              </button>
            ) : null}
            <div>
              <div className="da-modal-title">{title}</div>
              {subtitle ? <div className="da-modal-subtitle">{subtitle}</div> : null}
            </div>
          </div>

          <button type="button" className="da-modal-close" onClick={onClose} aria-label="Tutup">
            <X size={19} />
          </button>
        </header>

        <div className="da-modal-body">{children}</div>
      </section>
    </div>
  );
}
