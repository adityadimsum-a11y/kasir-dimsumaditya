import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";

export default function ModulePlaceholder({ page }) {
  return (
    <div>
      <PageHeader
        title={page?.label || "Halaman"}
        description={
          page?.description ||
          "Halaman ini sudah masuk struktur baru dan siap disambungkan."
        }
        badge="Fondasi Baru"
      />

      <div className="da-grid da-grid-3">
        <Card>
          <div className="da-mini-title">Status</div>
          <div className="da-big-text">Siap dibangun</div>
          <p className="da-muted">
            Modul ini belum menyimpan transaksi. Ini hanya kerangka awal agar
            routing, theme, sidebar, dan role menu aman dulu.
          </p>
        </Card>

        <Card>
          <div className="da-mini-title">Aturan Data</div>
          <div className="da-big-text">Live Backend</div>
          <p className="da-muted">
            Data transaksi wajib lewat backend PHP/MySQL resmi, bukan
            dummy permanen di frontend.
          </p>
        </Card>

        <Card>
          <div className="da-mini-title">Traceability</div>
          <div className="da-big-text">ID & Arsip</div>
          <p className="da-muted">
            Setiap transaksi utama nanti harus punya ID, audit, arsip, dan detail
            yang bisa diklik.
          </p>
        </Card>
      </div>

      <div style={{ height: 18 }} />

      <Card>
        <EmptyState
          title="Modul belum diaktifkan"
          description="Kita sengaja mulai dari pondasi dulu. Setelah Part 1A hijau, baru masuk modul DROP Ayam sebagai awal nyawa usaha."
        />
      </Card>
    </div>
  );
}
