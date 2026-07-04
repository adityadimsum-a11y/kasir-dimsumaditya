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

const initialForm = {
  drop_date: new Date().toISOString().slice(0, 10),
  supplier_id: "",
  invoice_no: "",
  qty_kg: "",
  unit_cost: "",
  amount_paid: "0",
  payment_wallet_id: "",
  note: "",
};

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

function getMoneyValue(row) {
  return (
    row?.remaining_amount ||
    row?.outstanding_amount ||
    row?.total_amount ||
    row?.amount ||
    row?.original_amount ||
    0
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

function normalizeSupplier(row) {
  return {
    id: row.supplier_id || row.id || row.code || "",
    name: row.supplier_name || row.name || row.nama_supplier || row.vendor_name || "",
  };
}

function normalizeWallet(row) {
  return {
    id: row.wallet_id || row.id || row.code || "",
    name: row.wallet_name || row.name || row.nama_dompet || row.account_name || "",
  };
}

function buildDropPreview(form, suppliers, wallets) {
  const qtyKg = numberValue(form.qty_kg);
  const unitCost = numberValue(form.unit_cost);
  const amountPaid = numberValue(form.amount_paid);

  const totalAmount = qtyKg * unitCost;
  const remainingAmount = Math.max(totalAmount - amountPaid, 0);

  const supplier = suppliers.find((item) => item.id === form.supplier_id);
  const wallet = wallets.find((item) => item.id === form.payment_wallet_id);

  let paymentStatus = "BELUM DIBAYAR";
  if (totalAmount > 0 && amountPaid >= totalAmount) paymentStatus = "LUNAS";
  if (amountPaid > 0 && amountPaid < totalAmount) paymentStatus = "BAYAR SEBAGIAN";

  return {
    drop_date: form.drop_date,
    supplier_id: form.supplier_id,
    supplier_name: supplier?.name || "",
    invoice_no: form.invoice_no,
    qty_kg: qtyKg,
    unit_cost: unitCost,
    total_amount: totalAmount,
    amount_paid: amountPaid,
    remaining_amount: remainingAmount,
    payment_status: paymentStatus,
    payment_wallet_id: form.payment_wallet_id,
    payment_wallet_name: wallet?.name || "",
    note: form.note,
  };
}

function validateDropForm(form, preview) {
  const errors = [];

  if (!form.drop_date) errors.push("Tanggal DROP wajib diisi.");
  if (!form.supplier_id) errors.push("Supplier wajib dipilih.");
  if (preview.qty_kg <= 0) errors.push("Kg ayam harus lebih dari 0.");
  if (preview.unit_cost <= 0) errors.push("Harga/kg aktual harus lebih dari 0.");
  if (preview.amount_paid < 0) errors.push("Bayar saat DROP tidak boleh minus.");
  if (preview.amount_paid > preview.total_amount) {
    errors.push("Bayar saat DROP tidak boleh lebih besar dari total modal ayam.");
  }
  if (preview.amount_paid > 0 && !form.payment_wallet_id) {
    errors.push("Kalau ada pembayaran, dompet pembayaran wajib dipilih.");
  }

  return errors;
}

export default function DropAyamPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState(null);
  const [error, setError] = useState("");
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const purchases = asArray(bootstrap?.purchases);
  const lots = asArray(bootstrap?.chicken_lots);
  const payables = asArray(bootstrap?.payables);

  const suppliers = asArray(bootstrap?.suppliers)
    .map(normalizeSupplier)
    .filter((item) => item.id);

  const wallets = asArray(bootstrap?.wallets)
    .map(normalizeWallet)
    .filter((item) => item.id);

  const summary = useMemo(() => buildSummary(bootstrap), [bootstrap]);

  const preview = useMemo(() => {
    return buildDropPreview(form, suppliers, wallets);
  }, [form, suppliers, wallets]);

  const validationErrors = useMemo(() => {
    return validateDropForm(form, preview);
  }, [form, preview]);

  const canOpenConfirmation = validationErrors.length === 0;

  const loadData = async () => {
    setLoading(true);
    setError("");

    const result = await getDropAyamBootstrap(session?.sessionToken, {
      source: "frontend_part_2b_1_drop_ayam_form_preview",
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

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handlePreviewSubmit = (event) => {
    event.preventDefault();

    if (!canOpenConfirmation) {
      return;
    }

    setConfirmOpen(true);
  };

  const handleResetForm = () => {
    setForm(initialForm);
    setConfirmOpen(false);
  };

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
        badge="Form Preview"
      />

      <div className="da-dashboard-banner">
        <div>
          <div className="da-dashboard-banner-kicker">Nyawa produksi</div>
          <div className="da-dashboard-banner-title">
            DROP Ayam → Lot Harga Aktual
          </div>
          <div className="da-dashboard-banner-desc">
            Tahap ini sudah mengaktifkan form dan preview. Tombol simpan transaksi
            hidup baru dipasang di Part 2B-2.
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
              Isi data nota ayam. Sistem akan menghitung total modal dan sisa hutang.
              Tahap ini belum menyimpan transaksi hidup.
            </p>
          </div>

          <Badge tone="warning">Preview Only</Badge>
        </div>

        <form onSubmit={handlePreviewSubmit}>
          <div className="da-drop-form-preview">
            <div className="da-drop-field">
              <label>Tanggal DROP</label>
              <input
                type="date"
                className="da-input"
                value={form.drop_date}
                onChange={(event) => updateForm("drop_date", event.target.value)}
              />
            </div>

            <div className="da-drop-field">
              <label>Supplier</label>
              <select
                className="da-select"
                value={form.supplier_id}
                onChange={(event) => updateForm("supplier_id", event.target.value)}
              >
                <option value="">Pilih supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name || supplier.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="da-drop-field">
              <label>No Nota Supplier</label>
              <input
                className="da-input"
                value={form.invoice_no}
                placeholder="Contoh: NANA-2026-001"
                onChange={(event) => updateForm("invoice_no", event.target.value)}
              />
            </div>

            <div className="da-drop-field">
              <label>Kg Ayam</label>
              <input
                className="da-input"
                inputMode="decimal"
                value={form.qty_kg}
                placeholder="Contoh: 1020"
                onChange={(event) => updateForm("qty_kg", event.target.value)}
              />
            </div>

            <div className="da-drop-field">
              <label>Harga / Kg Aktual</label>
              <input
                className="da-input"
                inputMode="numeric"
                value={form.unit_cost}
                placeholder="Contoh: 36500"
                onChange={(event) => updateForm("unit_cost", event.target.value)}
              />
            </div>

            <div className="da-drop-field">
              <label>Bayar Saat DROP</label>
              <input
                className="da-input"
                inputMode="numeric"
                value={form.amount_paid}
                placeholder="0 kalau belum bayar"
                onChange={(event) => updateForm("amount_paid", event.target.value)}
              />
            </div>

            <div className="da-drop-field">
              <label>Dompet Pembayaran</label>
              <select
                className="da-select"
                value={form.payment_wallet_id}
                onChange={(event) =>
                  updateForm("payment_wallet_id", event.target.value)
                }
              >
                <option value="">Pilih kalau ada pembayaran</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name || wallet.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="da-drop-field da-drop-field-wide">
              <label>Catatan</label>
              <input
                className="da-input"
                value={form.note}
                placeholder="Contoh: turun ayam pagi / titip travel / nota berjalan"
                onChange={(event) => updateForm("note", event.target.value)}
              />
            </div>
          </div>

          <div className="da-drop-preview-panel">
            <div>
              <div className="da-mini-title">Preview Modal Ayam</div>
              <div className="da-big-text">{formatRupiah(preview.total_amount)}</div>
              <p className="da-muted">
                {preview.qty_kg.toLocaleString("id-ID")} kg ×{" "}
                {formatRupiah(preview.unit_cost)} / kg
              </p>
            </div>

            <div>
              <div className="da-mini-title">Bayar Saat DROP</div>
              <div className="da-big-text">{formatRupiah(preview.amount_paid)}</div>
              <p className="da-muted">
                Sisa hutang: <strong>{formatRupiah(preview.remaining_amount)}</strong>
              </p>
            </div>

            <div>
              <div className="da-mini-title">Status Bayar</div>
              <div className="da-big-text">{preview.payment_status}</div>
              <p className="da-muted">
                Status ini masih preview dan belum tersimpan.
              </p>
            </div>
          </div>

          {validationErrors.length > 0 ? (
            <div className="da-form-warning">
              {validationErrors.map((item) => (
                <div key={item}>• {item}</div>
              ))}
            </div>
          ) : null}

          <div className="da-form-actions">
            <Button type="button" variant="ghost" onClick={handleResetForm}>
              Reset Form
            </Button>

            <Button type="submit" disabled={!canOpenConfirmation}>
              Preview & Konfirmasi
            </Button>
          </div>
        </form>
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
        open={confirmOpen}
        title="Konfirmasi Preview DROP Ayam"
        subtitle="Belum menyimpan transaksi hidup"
        onClose={() => setConfirmOpen(false)}
      >
        <div className="da-modal-summary">
          <div>
            <div className="da-mini-title">Total Modal Ayam</div>
            <div className="da-big-text">{formatRupiah(preview.total_amount)}</div>
            <p className="da-muted">
              Harga/kg aktual ini nanti akan dikunci untuk nota/drop ini.
            </p>
          </div>

          <Badge tone={preview.remaining_amount > 0 ? "warning" : "success"}>
            {preview.payment_status}
          </Badge>
        </div>

        <div className="da-detail-grid">
          <div className="da-detail-box">
            <div className="da-mini-title">DROP</div>
            <p><strong>Tanggal:</strong> {safeText(preview.drop_date)}</p>
            <p><strong>Supplier:</strong> {safeText(preview.supplier_name)}</p>
            <p><strong>No Nota:</strong> {safeText(preview.invoice_no, "Belum diisi")}</p>
          </div>

          <div className="da-detail-box">
            <div className="da-mini-title">Ayam Masuk</div>
            <p><strong>Kg:</strong> {preview.qty_kg.toLocaleString("id-ID")} kg</p>
            <p><strong>Harga/kg:</strong> {formatRupiah(preview.unit_cost)}</p>
            <p><strong>Total modal:</strong> {formatRupiah(preview.total_amount)}</p>
          </div>

          <div className="da-detail-box">
            <div className="da-mini-title">Pembayaran</div>
            <p><strong>Dibayar:</strong> {formatRupiah(preview.amount_paid)}</p>
            <p><strong>Dompet:</strong> {safeText(preview.payment_wallet_name, "Belum bayar")}</p>
            <p><strong>Sisa hutang:</strong> {formatRupiah(preview.remaining_amount)}</p>
          </div>

          <div className="da-detail-box">
            <div className="da-mini-title">Payload Part 2B-2</div>
            <p><strong>Action:</strong> legacyCreateChickenDropFromOldPurchase</p>
            <p><strong>Status:</strong> Preview saja, belum submit.</p>
            <p><strong>Catatan:</strong> {safeText(preview.note, "Tidak ada catatan")}</p>
          </div>
        </div>

        <div className="da-modal-note" style={{ marginTop: 14 }}>
          Kalau nanti di Part 2B-2 disimpan, backend akan membuat DROP Ayam, Lot Harga
          Aktual, stok ayam masuk, hutang Nana jika belum lunas, mutasi dompet jika ada
          pembayaran, arsip, dan audit.
        </div>

        <div className="da-form-actions">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Koreksi Lagi
          </Button>

          <Button type="button" disabled>
            Simpan Live di Part 2B-2
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(selectedDrop)}
        title={selectedDrop ? "Detail DROP Ayam" : ""}
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
