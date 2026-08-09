import { useEffect, useMemo, useState } from "react";
import { getSalesFlowControl } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";

function numberValue(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isAuthRequired(result) {
  const code = String(result?.error?.code || result?.code || "").toUpperCase();
  const message = String(result?.message || "").toUpperCase();
  return code.includes("AUTH_REQUIRED") || message.includes("AUTH_REQUIRED");
}

const FLOW_CONFIG = {
  order: {
    label: "Alur Penjualan",
    short: "Order → Pembayaran",
    title: "Alur Penjualan Langsung",
    description: "Dari stok siap jual sampai barang keluar dan HPP tercatat.",
    steps: [
      ["01", "Stok Siap Jual", "Produk tersedia sebagai stok bebas."],
      ["02", "Order", "Customer dan item dikunci dengan harga resmi."],
      ["03", "Invoice", "Tagihan resmi dibuat setelah order valid."],
      ["04", "Pembayaran / Piutang", "Uang masuk atau sisa tagihan tercatat sesuai kondisi nyata."],
      ["05", "Barang Keluar & HPP", "Stok berkurang dari cost layer historis saat barang diserahkan."],
    ],
  },
  po: {
    label: "Alur PO",
    short: "Reservasi → Penjualan",
    title: "Alur Antrian PO",
    description: "PO menahan stok terlebih dahulu dan baru menjadi penjualan saat dikonfirmasi.",
    steps: [
      ["01", "Buat PO", "Permintaan customer dicatat tanpa menjadi omzet."],
      ["02", "Reservasi Stok", "Stok ditahan agar tidak dipakai transaksi lain."],
      ["03", "Konfirmasi Penjualan", "PO diubah menjadi order resmi pada tanggal penjualan."],
      ["04", "Invoice & Pembayaran", "Invoice, uang masuk atau piutang terbentuk."],
      ["05", "Serahkan Barang", "Reservasi dipakai, stok keluar dan HPP dicatat."],
    ],
  },
  distribution: {
    label: "Alur Distribusi",
    short: "Request → Terima",
    title: "Alur Distribusi Antar Lokasi",
    description: "Barang berpindah antar lokasi tanpa membentuk omzet atau uang masuk.",
    steps: [
      ["01", "Request Cabang", "Cabang mengajukan kebutuhan barang."],
      ["02", "Persetujuan", "Tangerang memeriksa jumlah dan ketersediaan stok."],
      ["03", "DO & Pengiriman", "Stok sumber keluar dan nilainya masuk persediaan dalam perjalanan."],
      ["04", "Dalam Perjalanan", "Barang belum dihitung sebagai stok lokasi tujuan."],
      ["05", "Penerimaan Cabang", "Stok tujuan bertambah sesuai jumlah yang benar-benar diterima."],
    ],
  },
};

function businessBlockerLabel(item) {
  const code = String(item?.code || "").toUpperCase();
  if (code.includes("WITHOUT_INVOICE")) return "Ada order penjualan yang belum memiliki invoice.";
  if (code.includes("PAYMENT_WITHOUT_WALLET")) return "Ada pembayaran yang belum terhubung ke mutasi kas/bank.";
  if (code.includes("WITHOUT_RECEIVABLE")) return "Ada sisa invoice yang belum masuk ke piutang.";
  if (code.includes("WITHOUT_COGS")) return "Ada order yang sudah diserahkan tetapi HPP belum lengkap.";
  if (code.includes("ACTIVE_RESERVATION")) return "Ada PO batal yang masih menahan stok.";
  if (code.includes("WITHOUT_STOCK")) return "Ada fulfillment tanpa gerak stok barang keluar.";
  if (code.includes("DATE_MISMATCH")) return "Tanggal gerak stok dan jurnal HPP belum sama.";
  return item?.label || "Ada transaksi yang perlu diperiksa.";
}

export default function SalesFlowPanel({
  session,
  onSessionExpired,
  activeStep = "order",
  refreshKey = 0,
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const config = FLOW_CONFIG[activeStep] || FLOW_CONFIG.order;
  const locationId = session?.user?.location_id || session?.user?.location_code || "";
  const shouldReadSales = activeStep !== "distribution";

  const load = async () => {
    if (!shouldReadSales) return;
    setLoading(true);
    setError("");
    const result = await getSalesFlowControl(session?.sessionToken || "", { location_id: locationId });
    setLoading(false);

    if (!result?.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      setData(null);
      setError(result?.message || "Ringkasan penjualan belum dapat dibaca.");
      return;
    }
    setData(result.data || {});
  };

  useEffect(() => {
    if (shouldReadSales) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionToken, locationId, refreshKey, activeStep]);

  const summary = data?.summary || {};
  const blockers = Array.isArray(data?.blockers) ? data.blockers : [];
  const ready = !error && blockers.length === 0;
  const snapshot = useMemo(
    () => [
      ["Penjualan", numberValue(summary.sales_orders).toLocaleString("id-ID")],
      ["PO Aktif", numberValue(summary.open_po).toLocaleString("id-ID")],
      ["Uang Masuk", formatRupiah(numberValue(summary.payment_total))],
      ["Piutang", formatRupiah(numberValue(summary.receivable_open))],
    ],
    [summary]
  );

  return (
    <>
      <button type="button" className="da-flow-button" onClick={() => setOpen(true)}>
        <span className="da-flow-button-copy">
          <strong>{config.label}</strong>
          <small>{config.short}</small>
        </span>
        <span className="da-flow-button-arrow">→</span>
      </button>

      <Modal
        open={open}
        title={config.title}
        subtitle={config.description}
        onClose={() => setOpen(false)}
        size="lg"
      >
        <div className="da-flow-modal-current">
          <div>
            <span>Menu yang sedang dibuka</span>
            <strong>{activeStep === "po" ? "Antrian PO" : activeStep === "distribution" ? "Request & DO" : "Kasir / Order"}</strong>
          </div>
          {shouldReadSales ? <Badge tone={ready ? "success" : "warning"}>{ready ? "Alur normal" : "Perlu perhatian"}</Badge> : <Badge tone="success">Distribusi internal</Badge>}
        </div>

        <div className="da-flow-step-list">
          {config.steps.map(([number, title, description]) => (
            <div className="da-flow-step-item" key={number}>
              <span className="da-flow-step-number">{number}</span>
              <div>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
            </div>
          ))}
        </div>

        {shouldReadSales ? (
          <>
            <div className="da-flow-modal-stats">
              {snapshot.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{loading ? "..." : value}</strong>
                </div>
              ))}
            </div>

            {error ? <div className="da-form-warning">{error}</div> : null}
            {!error && blockers.length > 0 ? (
              <div className="da-form-warning">
                <strong>Perlu diperiksa sebelum transaksi dilanjutkan:</strong>
                {blockers.map((item) => (
                  <div key={item.code || item.label}>• {businessBlockerLabel(item)} ({numberValue(item.count)} data)</div>
                ))}
              </div>
            ) : null}
            <div className="da-form-actions">
              <Button variant="ghost" onClick={load} disabled={loading}>{loading ? "Memperbarui..." : "Perbarui Ringkasan"}</Button>
            </div>
          </>
        ) : (
          <div className="da-modal-note">
            Perpindahan antar lokasi tidak membentuk penjualan. Nilai barang tetap mengikuti HPP historis dan hanya direklasifikasi dari stok sumber → persediaan dalam perjalanan → stok tujuan.
          </div>
        )}
      </Modal>
    </>
  );
}
