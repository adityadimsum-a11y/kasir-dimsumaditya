import { useEffect, useMemo, useState } from "react";

import {
  activateTangerangGoLiveCutover,
  getTangerangGoLiveBootstrap,
} from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import StatCard from "../../components/ui/StatCard";

function localDateString() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 10);
}

const EMPTY_FORM = {
  product_id: "",
  cutover_date: localDateString(),
  official_price_per_unit: "",
  opening_stock_qty: "",
  opening_unit_cost: "",
  source_reference: "",
  notes: "",
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatQty(value) {
  return `${numberValue(value).toLocaleString("id-ID", {
    maximumFractionDigits: 2,
  })} pcs`;
}

function isAuthRequired(result) {
  const message = String(
    result?.message || result?.error?.message || ""
  ).toUpperCase();
  const code = String(
    result?.error?.code || result?.code || ""
  ).toUpperCase();

  return (
    code.includes("AUTH_REQUIRED") ||
    message.includes("AUTH_REQUIRED") ||
    (message.includes("SESSION") &&
      (message.includes("TIDAK AKTIF") ||
        message.includes("KADALUWARSA")))
  );
}

function makeOperationId(productId) {
  const product = String(productId || "PRODUCT")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 18);
  return `GOLIVE-TGR-${product}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

function InfoRow({ label, value }) {
  return (
    <div className="da-payload-row">
      <span>{label}</span>
      <strong>{safeText(value)}</strong>
    </div>
  );
}

export default function TangerangGoLiveCutoverPanel({
  sessionToken,
  onSessionExpired,
  onCutoverChanged,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [bootstrap, setBootstrap] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [activationResult, setActivationResult] = useState(null);

  const loadData = async () => {
    if (!sessionToken) return;

    setLoading(true);
    setError("");

    const result = await getTangerangGoLiveBootstrap(sessionToken, {
      cutover_date: form.cutover_date || localDateString(),
      source: "frontend_part_2f_tangerang_real_go_live",
    });

    if (!result?.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setBootstrap(null);
      setError(
        result?.message || "Kesiapan aktivasi penjualan belum bisa dibaca."
      );
      setLoading(false);
      return;
    }

    const data = result?.data || {};
    const products = asArray(data.products);

    setBootstrap(data);
    setForm((current) => ({
      ...current,
      product_id:
        current.product_id || products[0]?.product_id || "",
      cutover_date:
        current.cutover_date || data.cutover_date || localDateString(),
    }));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  const products = asArray(bootstrap?.products);
  const selectedProduct = useMemo(
    () => products.find((row) => row.product_id === form.product_id) || null,
    [products, form.product_id]
  );

  const existingStock = numberValue(selectedProduct?.physical_qty) > 0;
  const alreadyActivated = Boolean(selectedProduct?.cutover_id);
  const openingValue =
    numberValue(form.opening_stock_qty) *
    numberValue(form.opening_unit_cost);
  const phrase = safeText(
    bootstrap?.confirmation_phrase,
    "AKTIFKAN KASIR TANGERANG"
  );
  const foundationReady = bootstrap?.foundation_ready === true;

  const validationErrors = useMemo(() => {
    const errors = [];

    if (!foundationReady) {
      errors.push(
        "Konfigurasi aktivasi belum lengkap. Perbarui sistem atau hubungi administrator."
      );
    }
    if (!form.product_id) {
      errors.push("Produk wajib dipilih.");
    }
    if (alreadyActivated) {
      errors.push("Produk ini sudah pernah diaktifkan untuk penjualan.");
    }
    if (numberValue(form.official_price_per_unit) <= 0) {
      errors.push("Harga jual resmi per pcs wajib lebih dari Rp0.");
    }
    if (!existingStock && numberValue(form.opening_stock_qty) <= 0) {
      errors.push("Stok freezer awal wajib lebih dari 0 pcs.");
    }
    if (!existingStock && numberValue(form.opening_unit_cost) <= 0) {
      errors.push("HPP awal per pcs wajib lebih dari Rp0.");
    }
    if (String(form.source_reference || "").trim().length < 5) {
      errors.push(
        "Isi sumber pemeriksaan stok/HPP, misalnya hasil stock opname freezer."
      );
    }
    if (!form.cutover_date) {
      errors.push("Tanggal mulai live wajib diisi.");
    }

    return errors;
  }, [
    foundationReady,
    form,
    alreadyActivated,
    existingStock,
  ]);

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setError("");
    setSuccess("");
  };

  const handleProductChange = (value) => {
    setForm((current) => ({
      ...EMPTY_FORM,
      cutover_date: current.cutover_date || localDateString(),
      product_id: value,
    }));
    setActivationResult(null);
    setConfirmation("");
    setError("");
    setSuccess("");
  };

  const handlePreview = (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    setConfirmation("");
    setConfirmOpen(true);
  };

  const handleActivate = async () => {
    if (saving || validationErrors.length > 0) return;

    if (confirmation.trim().toUpperCase() !== phrase.toUpperCase()) {
      setError(`Ketik persis: ${phrase}`);
      return;
    }

    const operationId = makeOperationId(form.product_id);
    setSaving(true);
    setError("");
    setSuccess("");

    const result = await activateTangerangGoLiveCutover(
      sessionToken,
      {
        product_id: form.product_id,
        location_id: bootstrap?.location?.location_id || "",
        cutover_date: form.cutover_date,
        official_price_per_unit: numberValue(
          form.official_price_per_unit
        ),
        opening_stock_qty: existingStock
          ? 0
          : numberValue(form.opening_stock_qty),
        opening_unit_cost: existingStock
          ? 0
          : numberValue(form.opening_unit_cost),
        source_reference: String(form.source_reference || "").trim(),
        notes: String(form.notes || "").trim(),
        confirmation: phrase,
        operation_id: operationId,
        request_id: operationId,
        idempotency_key: operationId,
        source: "frontend_part_2f_tangerang_real_go_live",
      }
    );

    if (!result?.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setError(result?.message || "Aktivasi penjualan gagal.");
      setSaving(false);
      return;
    }

    setActivationResult(result?.data || {});
    setSuccess(
      result?.message ||
        "Kasir Tangerang berhasil diaktifkan untuk transaksi nyata."
    );
    setConfirmOpen(false);
    setConfirmation("");
    setSaving(false);
    await loadData();
    await onCutoverChanged?.();
  };

  const rows = products.map((row) => ({
    ...row,
    status_label: row.order_ready
      ? "Kasir Aktif"
      : row.cutover_id
      ? "Aktif, Perlu Stok/Harga"
      : "Belum Diaktifkan",
  }));

  const columns = [
    {
      key: "product_name",
      label: "Produk",
      render: (row) => (
        <div>
          <strong>{safeText(row.product_name)}</strong>
          <div className="da-muted">
            {safeText(row.product_code, row.product_id)}
          </div>
        </div>
      ),
    },
    {
      key: "price_rule_active",
      label: "Harga Resmi",
      render: (row) => (
        <div>
          <Badge tone={row.price_rule_active ? "success" : "warning"}>
            {row.price_rule_active ? "Aktif" : "Belum Ada"}
          </Badge>
          {row.price_rule_active ? (
            <div className="da-muted" style={{ marginTop: 6 }}>
              {formatRupiah(row.official_price_per_unit)} / pcs
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "free_qty",
      label: "Stok Bebas",
      render: (row) => (
        <div>
          <strong>{formatQty(row.free_qty)}</strong>
          <div className="da-muted">
            Fisik {formatQty(row.physical_qty)}
          </div>
        </div>
      ),
    },
    {
      key: "status_label",
      label: "Status",
      render: (row) => (
        <div>
          <Badge tone={row.order_ready ? "success" : "warning"}>
            {row.status_label}
          </Badge>
          {row.cutover_id ? (
            <div className="da-muted" style={{ marginTop: 6 }}>
              {row.cutover_id}
            </div>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <Card>
        <div className="da-section-heading">
          <div>
            <span>OPENING PRODUK</span>
            <h2>Opening Stok & Aktivasi Penjualan</h2>
            <p>
              Siapkan harga resmi dan stok awal produk sebelum dipakai transaksi. HPP pembukaan dan histori tetap terkunci setelah disimpan.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Badge tone={foundationReady ? "success" : "warning"}>
              {foundationReady ? "Siap Diproses" : "Konfigurasi Belum Lengkap"}
            </Badge>
            <Badge tone="danger">Permanen</Badge>
            <Button
              type="button"
              variant="ghost"
              onClick={loadData}
              disabled={loading || saving}
            >
              {loading ? "Membaca..." : "Perbarui"}
            </Button>
          </div>
        </div>

        <div className="da-form-warning" style={{ marginTop: 14 }}>
          <strong>Periksa sebelum menyimpan.</strong> Harga dan stok pembukaan harus sesuai kondisi fisik dan keputusan Owner.
        </div>

        {error ? (
          <div className="da-form-warning" style={{ marginTop: 14 }}>
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="da-form-success" style={{ marginTop: 14 }}>
            {success}
          </div>
        ) : null}

        <div className="da-stat-grid" style={{ marginTop: 16 }}>
          <StatCard
            label="Lokasi"
            value={safeText(bootstrap?.location?.location_code, "TGR")}
            description={safeText(
              bootstrap?.location?.location_name,
              "Tangerang HO"
            )}
          />
          <StatCard
            label="Produk Aktif"
            value={numberValue(
              bootstrap?.counts?.active_products
            ).toLocaleString("id-ID")}
            description="Produk aktif yang dapat disiapkan untuk penjualan."
          />
          <StatCard
            label="Sudah Diaktifkan"
            value={numberValue(
              bootstrap?.counts?.active_cutovers
            ).toLocaleString("id-ID")}
            tone={
              numberValue(bootstrap?.counts?.active_cutovers) > 0
                ? "success"
                : "warning"
            }
            description="Satu aktivasi pembukaan per produk dan lokasi."
          />
          <StatCard
            label="Siap Transaksi"
            value={numberValue(
              bootstrap?.counts?.order_ready_products
            ).toLocaleString("id-ID")}
            tone={
              numberValue(bootstrap?.counts?.order_ready_products) > 0
                ? "success"
                : "warning"
            }
            description="Memiliki harga resmi dan stok bebas."
          />
        </div>
      </Card>

      <Card>
        <div className="da-section-heading">
          <div>
            <span>OPENING & AKTIVASI</span>
            <h2>Siapkan Produk untuk Penjualan</h2>
            <p>
              Masukkan hanya harga resmi dan stok fisik yang sudah diperiksa.
            </p>
          </div>
          <Badge tone={alreadyActivated ? "success" : "warning"}>
            {alreadyActivated ? "Sudah Aktif" : "Belum Diaktifkan"}
          </Badge>
        </div>

        <form onSubmit={handlePreview}>
          <div className="da-form-grid" style={{ marginTop: 14 }}>
            <label className="da-field">
              Produk
              <select
                className="da-input"
                value={form.product_id}
                disabled={saving || !foundationReady}
                onChange={(event) =>
                  handleProductChange(event.target.value)
                }
              >
                <option value="">Pilih produk</option>
                {products.map((row) => (
                  <option key={row.product_id} value={row.product_id}>
                    {safeText(row.product_name, row.product_id)}
                  </option>
                ))}
              </select>
            </label>

            <label className="da-field">
              Lokasi Terkunci
              <input
                type="text"
                value={safeText(
                  bootstrap?.location?.location_name,
                  "Tangerang HO"
                )}
                disabled
                readOnly
              />
            </label>

            <label className="da-field">
              Tanggal Mulai
              <input
                type="date"
                value={form.cutover_date}
                disabled={saving || alreadyActivated}
                onChange={(event) =>
                  updateForm("cutover_date", event.target.value)
                }
              />
            </label>

            <label className="da-field">
              Harga Jual Resmi / Pcs
              <input
                type="number"
                min="1"
                step="1"
                value={form.official_price_per_unit}
                placeholder="Masukkan harga resmi"
                disabled={saving || alreadyActivated}
                onChange={(event) =>
                  updateForm(
                    "official_price_per_unit",
                    event.target.value
                  )
                }
              />
            </label>

            <label className="da-field">
              Stok Freezer Awal / Pcs
              <input
                type="number"
                min="0"
                step="1"
                value={
                  existingStock
                    ? selectedProduct?.physical_qty || 0
                    : form.opening_stock_qty
                }
                placeholder="Hasil hitung fisik freezer"
                disabled={saving || alreadyActivated || existingStock}
                onChange={(event) =>
                  updateForm("opening_stock_qty", event.target.value)
                }
              />
            </label>

            <label className="da-field">
              HPP Awal Terkunci / Pcs
              <input
                type="number"
                min="0"
                step="1"
                value={existingStock ? "" : form.opening_unit_cost}
                placeholder={
                  existingStock
                    ? "Tidak diperlukan, stok sudah ada"
                    : "Masukkan HPP hasil audit"
                }
                disabled={saving || alreadyActivated || existingStock}
                onChange={(event) =>
                  updateForm("opening_unit_cost", event.target.value)
                }
              />
            </label>

            <label className="da-field" style={{ gridColumn: "1 / -1" }}>
              Sumber Pemeriksaan Stok dan HPP
              <input
                type="text"
                value={form.source_reference}
                placeholder="Contoh: Stock opname freezer Tangerang tanggal ..."
                disabled={saving || alreadyActivated}
                onChange={(event) =>
                  updateForm("source_reference", event.target.value)
                }
              />
            </label>

            <label className="da-field" style={{ gridColumn: "1 / -1" }}>
              Catatan Owner
              <input
                type="text"
                value={form.notes}
                placeholder="Catatan aktivasi nyata, opsional"
                disabled={saving || alreadyActivated}
                onChange={(event) =>
                  updateForm("notes", event.target.value)
                }
              />
            </label>
          </div>

          {existingStock ? (
            <div className="da-form-success" style={{ marginTop: 14 }}>
              Stok barang jadi sudah tersedia. Sistem tidak akan menambah stok pembukaan lagi; aktivasi hanya menetapkan harga dan status penjualan.
            </div>
          ) : null}

          {!existingStock && form.opening_stock_qty && form.opening_unit_cost ? (
            <div className="da-form-warning" style={{ marginTop: 14 }}>
              Nilai stok pembukaan: <strong>{formatRupiah(openingValue)}</strong>.
              Nilai ini menjadi modal historis stok awal dan tidak mengikuti
              perubahan HPP berikutnya.
            </div>
          ) : null}

          {alreadyActivated ? (
            <div className="da-form-success" style={{ marginTop: 14 }}>
              <strong>Kasir sudah diaktifkan.</strong>
              <div style={{ marginTop: 8 }}>
                Aktivasi ID: {safeText(selectedProduct?.cutover_id)}
              </div>
              <div>
                Rule harga: {safeText(selectedProduct?.price_rule_id)}
              </div>
              <div>
                Stok bebas: {formatQty(selectedProduct?.free_qty)}
              </div>
            </div>
          ) : null}

          <div className="da-form-actions">
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setForm({
                  ...EMPTY_FORM,
                  product_id: form.product_id,
                });
                setError("");
                setSuccess("");
                setActivationResult(null);
              }}
            >
              Reset
            </Button>
            <Button
              type="submit"
              disabled={
                saving ||
                alreadyActivated ||
                !foundationReady
              }
            >
              Preview Aktivasi Nyata
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="da-section-heading">
          <div>
            <span>Status Produk Tangerang</span>
            <h2>Daftar Produk & Kesiapan</h2>
            <p>
              Produk baru dianggap siap transaksi ketika harga resmi dan
              stok bebas sama-sama tersedia.
            </p>
          </div>
          <Badge tone="success">Data Terpusat</Badge>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.product_id}
        />
      </Card>

      {activationResult ? (
        <Card>
          <div className="da-section-heading">
            <div>
              <span>Aktivasi Berhasil</span>
              <h2>Benang Merah Sudah Tersambung</h2>
              <p>
                Buka Kasir / Order, perbarui data, lalu jalankan
                transaksi pelanggan nyata pertama.
              </p>
            </div>
            <Badge tone="success">Kasir Aktif</Badge>
          </div>

          <div className="da-payload-list">
            <InfoRow label="Aktivasi ID" value={activationResult.cutover_id} />
            <InfoRow label="Rule Harga" value={activationResult.price_rule_id} />
            <InfoRow label="Layer Stok" value={activationResult.stock_layer_id} />
            <InfoRow label="Mutasi Stok" value={activationResult.stock_movement_id} />
            <InfoRow label="Jurnal Pembukaan" value={activationResult.journal_id} />
            <InfoRow label="Arsip" value={activationResult.archive_id} />
            <InfoRow
              label="Stok Bebas Setelah Aktivasi"
              value={formatQty(activationResult?.stock_after?.free_qty)}
            />
          </div>
        </Card>
      ) : null}

      <Modal
        open={confirmOpen}
        title="Konfirmasi Aktivasi Penjualan"
        subtitle="Harga dan stok pembukaan akan disimpan permanen."
        onClose={() => {
          if (!saving) {
            setConfirmOpen(false);
            setConfirmation("");
          }
        }}
      >
        <div className="da-payload-list">
          <InfoRow
            label="Produk"
            value={selectedProduct?.product_name}
          />
          <InfoRow
            label="Lokasi"
            value={bootstrap?.location?.location_name}
          />
          <InfoRow label="Tanggal Mulai" value={form.cutover_date} />
          <InfoRow
            label="Harga Resmi / Pcs"
            value={formatRupiah(form.official_price_per_unit)}
          />
          <InfoRow
            label="Stok Freezer Awal"
            value={
              existingStock
                ? formatQty(selectedProduct?.physical_qty)
                : formatQty(form.opening_stock_qty)
            }
          />
          <InfoRow
            label="HPP Awal / Pcs"
            value={
              existingStock
                ? "Menggunakan stok yang sudah ada"
                : formatRupiah(form.opening_unit_cost)
            }
          />
          <InfoRow
            label="Nilai Stok Pembukaan"
            value={existingStock ? "Tidak menambah stok" : formatRupiah(openingValue)}
          />
          <InfoRow
            label="Sumber Pemeriksaan"
            value={form.source_reference}
          />
        </div>

        <div className="da-form-warning" style={{ marginTop: 16 }}>
          Setelah aktif, harga dikunci server dan stok akan berkurang dari
          layer HPP historis ketika Order nyata dibuat.
        </div>

        <label className="da-field" style={{ marginTop: 16 }}>
          Ketik persis untuk mengaktifkan
          <input
            type="text"
            value={confirmation}
            placeholder={phrase}
            disabled={saving}
            onChange={(event) =>
              setConfirmation(event.target.value.toUpperCase())
            }
          />
        </label>

        <div className="da-form-actions">
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() => {
              setConfirmOpen(false);
              setConfirmation("");
            }}
          >
            Kembali Cek
          </Button>
          <Button
            disabled={
              saving ||
              confirmation.trim().toUpperCase() !== phrase.toUpperCase()
            }
            onClick={handleActivate}
          >
            {saving ? "Mengaktifkan..." : "Opening Stok & Aktivasi Penjualan"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
