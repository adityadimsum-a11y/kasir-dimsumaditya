import { useEffect, useMemo, useState } from "react";
import { getDropAyamBootstrap } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import DataTable from "../../components/ui/DataTable";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value) {
  const parsed = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeText(value, fallback = "-") {
  const text = String(value || "").trim();
  return text || fallback;
}

function sumRows(rows, fields) {
  return asArray(rows).reduce((total, row) => {
    for (const field of fields) {
      if (row?.[field] !== undefined && row?.[field] !== "") {
        return total + numberValue(row[field]);
      }
    }
    return total;
  }, 0);
}

function getStatusTone(status) {
  const value = String(status || "").toUpperCase();

  if (value.includes("LUNAS") || value.includes("PAID")) return "success";
  if (value.includes("PARTIAL")) return "warning";
  if (value.includes("OPEN") || value.includes("BELUM")) return "danger";

  return "warning";
}

function isAuthRequired(result) {
  const message = String(result?.message || result?.error?.message || "").toUpperCase();
  const code = String(result?.error?.code || result?.code || "").toUpperCase();

  return (
    code.includes("AUTH_REQUIRED") ||
    message.includes("AUTH_REQUIRED") ||
    (message.includes("SESSION") && message.includes("TIDAK AKTIF"))
  );
}

function buildSummary(data) {
  const purchases = asArray(data?.purchases);
  const lots = asArray(data?.chicken_lots);
  const payables = asArray(data?.payables);

  const totalKgMasuk = sumRows(purchases, ["qty_kg", "kg", "qty"]);
  const totalModalAyam = sumRows(purchases, ["total_amount"]);
  const totalDibayar = sumRows(purchases, ["amount_paid"]);
  const totalSisaHutang = sumRows(payables, [
    "remaining_amount",
    "outstanding_amount",
    "original_amount",
    "amount",
  ]);

  const totalKgSisa = sumRows(lots, ["qty_kg_remaining"]);

  return {
    totalDrop: purchases.length,
    totalLot: lots.length,
    totalHutang: payables.length,
    totalKgMasuk,
    totalKgSisa,
    totalModalAyam,
    totalDibayar,
    totalSisaHutang,
  };
}

export default function DropAyamPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState(null);
  const [error, setError] = useState("");
  const [selectedDrop, setSelectedDrop] = useState(null);

  const purchases = asArray(bootstrap?.purchases);
  const lots = asArray(bootstrap?.chicken_lots);
  const payables = asArray(bootstrap?.payables);
  const suppliers = asArray(bootstrap?.suppliers);
  const wallets = asArray(bootstrap?.wallets);

  const summary = useMemo(() => buildSummary(bootstrap), [bootstrap]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    const result = await getDropAyamBootstrap(session?.sessionToken, {
      source: "frontend_part_2a_drop_ayam_read_only",
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setError(result.message || "Gagal membaca data DROP Ayam.");
      setBootstrap(null);
      setLoading(false);
      return;
    }

    setBootstrap(result.data || {});
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionToken]);

  const getLinkedLot = (drop) => {
    return lots.find((lot) => {
      return String(lot.chicken_lot_id || "") === String(drop.chicken_lot_id || "");
    });
  };

  const getLinkedPayable = (drop) => {
    return payables.find((payable) => {
      return (
        String(payable.payable_id || "") === String(drop.payable_id || "") ||
        String(payable.source_id || "") === String(drop.purchase_id || "")
      );
    });
  };

  const columns = [
    {
      key: "purchase_date",
      label: "Tanggal",
      render: (row) => safeText(row.purchase_date || row.drop_date || row.date),
    },
    {
      key: "purchase_id",
      label: "DROP ID",
      render: (row) => <strong>{safeText(row.purchase_id)}</strong>,
    },
    {
      key: "supplier_name",
      label: "Supplier",
      render: (row) => safeText(row.supplier_name || "NANA CHICKEN"),
    },
    {
      key: "qty_kg",
      label: "Kg",
      render: (row) => `${numberValue(row.qty_kg).toLocaleString("id-ID")} kg`,
    },
    {
      key: "unit_cost",
      label: "Harga / Kg",
      render: (row) => formatRupiah(row.unit_cost),
    },
    {
      key: "total_amount",
      label: "Total Modal",
      render: (row) => formatRupiah(row.total_amount),
    },
    {
      key: "payment_status",
      label: "Status",
      render: (row) => (
        <Badge tone={getStatusTone(row.payment_status)}>
          {safeText(row.payment_status)}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="DROP Ayam"
        description="Catatan ayam masuk dari supplier. Harga ayam dikunci per nota/drop agar transaksi lama tidak berubah saat harga baru berubah."
        badge="Read Only Foundation"
      />

      <div className="da-dashboard-banner">
        <div>
          <div className="da-dashboard-banner-kicker">Nyawa produksi</div>
          <div className="da-dashboard-banner-title">
            DROP Ayam → Lot Harga Aktual
          </div>
          <div className="da-dashboard-banner-desc">
            Tahap ini baru membaca data hidup dari backend. Tombol simpan DROP Ayam
            akan dipasang di Part 2B setelah layar ini aman.
          </div>
        </div>

        <div className="da-dashboard-banner-actions">
          <Badge tone={error ? "danger" : "success"}>
            {error ? "Perlu Dicek" : "Terhubung"}
          </Badge>
          <Button variant="ghost" onClick={loadData} disabled={loading}>
            {loading ? "Membaca..." : "Refresh Data"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="da-login-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      ) : null}

      <div className="da-grid da-grid-3">
        <StatCard
          tone="primary"
          label="Total Modal Ayam"
          value={loading ? "..." : formatRupiah(summary.totalModalAyam)}
          description="Total nilai DROP Ayam yang terbaca dari backend."
        />

        <StatCard
          label="Kg Ayam Masuk"
          value={
            loading
              ? "..."
              : `${summary.totalKgMasuk.toLocaleString("id-ID")} kg`
          }
          description="Total kg ayam dari semua DROP yang tercatat."
        />

        <StatCard
          tone="warning"
          label="Sisa Hutang Nana"
          value={loading ? "..." : formatRupiah(summary.totalSisaHutang)}
          description="Sisa hutang supplier ayam yang terbaca."
        />
      </div>

      <div style={{ height: 16 }} />

      <div className="da-grid da-grid-3">
        <StatCard
          label="Jumlah DROP"
          value={loading ? "..." : summary.totalDrop}
          description="Jumlah nota/drop ayam."
        />

        <StatCard
          label="Lot Ayam Aktif"
          value={loading ? "..." : summary.totalLot}
          description="Lot harga aktual ayam yang siap dipakai produksi."
        />

        <StatCard
          label="Sisa Kg Ayam"
          value={
            loading
              ? "..."
              : `${summary.totalKgSisa.toLocaleString("id-ID")} kg`
          }
          description="Sisa kg ayam dari lot yang terbaca."
        />
      </div>

      <div style={{ height: 16 }} />

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">Form DROP Ayam</div>
            <div className="da-big-text">Input DROP Ayam</div>
            <p className="da-muted">
              Form simpan belum diaktifkan. Ini sengaja supaya kita cek field dan
              alur dulu sebelum membuat transaksi hidup.
            </p>
          </div>

          <Badge tone="warning">Part 2B</Badge>
        </div>

        <div className="da-drop-form-preview">
          <div className="da-drop-field">
            <label>Tanggal DROP</label>
            <input className="da-input" value="Akan diisi di Part 2B" disabled />
          </div>

          <div className="da-drop-field">
            <label>Supplier</label>
            <select className="da-select" disabled>
              <option>
                {suppliers.length > 0
                  ? `${suppliers.length} supplier terbaca`
                  : "NANA CHICKEN"}
              </option>
            </select>
          </div>

          <div className="da-drop-field">
            <label>Kg Ayam</label>
            <input className="da-input" value="Contoh: 1020" disabled />
          </div>

          <div className="da-drop-field">
            <label>Harga / Kg Aktual</label>
            <input className="da-input" value="Contoh: 36500" disabled />
          </div>

          <div className="da-drop-field">
            <label>Bayar Saat DROP</label>
            <input className="da-input" value="Boleh 0 / partial / lunas" disabled />
          </div>

          <div className="da-drop-field">
            <label>Dompet Pembayaran</label>
            <select className="da-select" disabled>
              <option>
                {wallets.length > 0
                  ? `${wallets.length} dompet terbaca`
                  : "Pilih dompet"}
              </option>
            </select>
          </div>
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">Daftar DROP Ayam</div>
            <div className="da-big-text">Nota Ayam yang Terbaca</div>
            <p className="da-muted">
              Klik baris untuk lihat detail popup tengah: DROP, lot, hutang,
              stok, dan ID terkait.
            </p>
          </div>

          <Badge tone="warning">Read Only</Badge>
        </div>

        <DataTable
          columns={columns}
          rows={loading ? [] : purchases}
          getRowKey={(row, index) => row.purchase_id || index}
          onRowClick={setSelectedDrop}
        />
      </Card>

      <Modal
        open={Boolean(selectedDrop)}
        title={selectedDrop ? `Detail DROP Ayam` : ""}
        subtitle={selectedDrop?.purchase_id || ""}
        onClose={() => setSelectedDrop(null)}
      >
        {selectedDrop ? (
          <div>
            <div className="da-modal-summary">
              <div>
                <div className="da-mini-title">Total Modal Ayam</div>
                <div className="da-big-text">
                  {formatRupiah(selectedDrop.total_amount)}
                </div>
                <p className="da-muted">
                  Harga/kg dikunci di nota ini:{" "}
                  <strong>{formatRupiah(selectedDrop.unit_cost)}</strong>.
                </p>
              </div>

              <Badge tone={getStatusTone(selectedDrop.payment_status)}>
                {safeText(selectedDrop.payment_status)}
              </Badge>
            </div>

            <div className="da-detail-grid">
              <div className="da-detail-box">
                <div className="da-mini-title">DROP</div>
                <p><strong>ID:</strong> {safeText(selectedDrop.purchase_id)}</p>
                <p><strong>Tanggal:</strong> {safeText(selectedDrop.purchase_date)}</p>
                <p><strong>Supplier:</strong> {safeText(selectedDrop.supplier_name)}</p>
                <p><strong>No Nota:</strong> {safeText(selectedDrop.invoice_no)}</p>
              </div>

              <div className="da-detail-box">
                <div className="da-mini-title">Ayam Masuk</div>
                <p><strong>Kg:</strong> {numberValue(selectedDrop.qty_kg).toLocaleString("id-ID")} kg</p>
                <p><strong>Harga/kg:</strong> {formatRupiah(selectedDrop.unit_cost)}</p>
                <p><strong>Total:</strong> {formatRupiah(selectedDrop.total_amount)}</p>
                <p><strong>Dibayar:</strong> {formatRupiah(selectedDrop.amount_paid)}</p>
              </div>

              <div className="da-detail-box">
                <div className="da-mini-title">Lot Harga Aktual</div>
                {(() => {
                  const lot = getLinkedLot(selectedDrop);
                  return lot ? (
                    <>
                      <p><strong>Lot ID:</strong> {safeText(lot.chicken_lot_id)}</p>
                      <p><strong>Sisa kg:</strong> {numberValue(lot.qty_kg_remaining).toLocaleString("id-ID")} kg</p>
                      <p><strong>Status:</strong> {safeText(lot.status)}</p>
                    </>
                  ) : (
                    <p className="da-muted">Lot belum terbaca di bootstrap.</p>
                  );
                })()}
              </div>

              <div className="da-detail-box">
                <div className="da-mini-title">Hutang Nana</div>
                {(() => {
                  const payable = getLinkedPayable(selectedDrop);
                  return payable ? (
                    <>
                      <p><strong>Hutang ID:</strong> {safeText(payable.payable_id)}</p>
                      <p><strong>Nominal:</strong> {formatRupiah(getMoneyValue(payable))}</p>
                      <p><strong>Status:</strong> {safeText(payable.status)}</p>
                    </>
                  ) : (
                    <p className="da-muted">Tidak ada hutang terkait / sudah lunas.</p>
                  );
                })()}
              </div>
            </div>

            <div className="da-modal-note" style={{ marginTop: 14 }}>
              Rantai transaksi ini harus tetap terkunci: DROP Ayam → Lot Harga
              Aktual → Produksi/Adukan → Stok Jadi → Order → Uang Masuk → Hutang
              Nana → 4 Amplop.
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
