import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { getPageLabel, openFocusRoute } from "../../lib/navigation/focusRouter";

function text(value, fallback = "-") {
  const out = String(value ?? "").trim();
  return out || fallback;
}

export default function CrossModuleFocusBanner({ focusRequest, onClear }) {
  if (!focusRequest?.pageKey && !focusRequest?.focusId) return null;

  const focusId = focusRequest.focusId || focusRequest.searchQuery || "";
  const pageLabel = focusRequest.pageLabel || getPageLabel(focusRequest.pageKey);

  function openArchive() {
    const q = encodeURIComponent(focusId || focusRequest.searchQuery || "");
    openFocusRoute(`/archive/search?q=${q}`);
  }

  return (
    <Card>
      <div className="da-section-header">
        <div>
          <p className="da-kicker">Mode Fokus Aktif</p>
          <h2>Benang merah diarahkan ke {text(pageLabel, "halaman tujuan")}</h2>
          <p className="da-muted">
            Sistem sedang membawa ID sumber supaya modul tujuan bisa membuka transaksi yang sama tanpa bro cari manual.
          </p>
        </div>
        <Badge tone="warning">Cross Module Focus</Badge>
      </div>

      <div className="da-grid da-grid-3" style={{ marginTop: 14 }}>
        <div className="da-mini-card">
          <span className="da-muted">ID Fokus</span>
          <strong>{text(focusId)}</strong>
        </div>
        <div className="da-mini-card">
          <span className="da-muted">Halaman Tujuan</span>
          <strong>{text(pageLabel)}</strong>
        </div>
        <div className="da-mini-card">
          <span className="da-muted">Sumber</span>
          <strong>{text(focusRequest.sourceModule || focusRequest.sourcePath || "Action Hub / Arsip")}</strong>
        </div>
      </div>

      <div className="da-form-actions" style={{ justifyContent: "flex-start" }}>
        <Button type="button" variant="secondary" onClick={openArchive}>
          Cari ID di Arsip
        </Button>
        <Button type="button" variant="secondary" onClick={onClear}>
          Tutup Mode Fokus
        </Button>
      </div>
    </Card>
  );
}
