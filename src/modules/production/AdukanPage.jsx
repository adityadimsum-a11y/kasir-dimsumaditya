import { useEffect, useMemo, useState } from "react";
import { getProductionBootstrap } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import DataTable from "../../components/ui/DataTable";

const initialForm = {
  production_date: new Date().toISOString().slice(0, 10),
  chicken_lot_id: "",
  total_adukan: "",
  actual_output_pcs: "",
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

function formatDisplayDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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

function normalizeLot(row) {
  return {
    id: row.chicken_lot_id || row.lot_id || row.id || "",
    label:
      row.chicken_lot_id ||
      row.lot_id ||
      row.purchase_id ||
      row.source_id ||
      row.id ||
      "",
    supplier_name: row.supplier_name || row.supplier_id || "Supplier",
    unit_cost: numberValue(row.unit_cost || row.price_per_kg || row.cost_per_kg),
    remaining_kg: numberValue(
      row.qty_kg_remaining || row.remaining_kg || row.qty_remaining || row.qty_kg
    ),
    status: row.status || "Aktif",
    raw: row,
  };
}

function uniqueLotsById(lots) {
  const map = new Map();

  asArray(lots).forEach((lot) => {
    if (!lot?.id) return;

    const existing = map.get(lot.id);

    if (!existing) {
      map.set(lot.id, lot);
      return;
    }

    const existingRemaining = numberValue(existing.remaining_kg);
    const currentRemaining = numberValue(lot.remaining_kg);

    if (currentRemaining > existingRemaining) {
      map.set(lot.id, lot);
      return;
    }

    if (currentRemaining === existingRemaining) {
      map.set(lot.id, {
        ...existing,
        ...lot,
        remaining_kg: existingRemaining,
        unit_cost: lot.unit_cost || existing.unit_cost,
        label: lot.label || existing.label,
        supplier_name: lot.supplier_name || existing.supplier_name,
        status: lot.status || existing.status,
      });
    }
  });

  return Array.from(map.values());
}

function getActiveLotsFromData(data) {
  const normalizedLots = asArray(data?.chicken_lots)
    .map(normalizeLot)
    .filter((lot) => lot.id);

  return uniqueLotsById(normalizedLots).filter((lot) => {
    const status = String(lot.status || "").toUpperCase();

    return (
      lot.remaining_kg > 0 &&
      !status.includes("CLOSED") &&
      !status.includes("VOID") &&
      !status.includes("CANCEL")
    );
  });
}

function buildSummary(data) {
  const activeLots = getActiveLotsFromData(data);
  const batches = asArray(data?.production_batches);
  const stockMovements = asArray(data?.stock_movements);

  const totalKgAvailable = activeLots.reduce((total, lot) => {
    return total + numberValue(lot.remaining_kg);
  }, 0);

  const totalAdukan = sumRows(batches, ["total_adukan", "adukan_qty", "adukan"]);
  const totalOutputPcs = sumRows(batches, [
    "actual_output_pcs",
    "output_pcs",
    "finished_good_qty",
    "qty_pcs",
  ]);

  return {
    activeLotCount: activeLots.length,
    totalKgAvailable,
    batchCount: batches.length,
    totalAdukan,
    totalOutputPcs,
    stockMovementCount: stockMovements.length,
  };
}

function buildProductionPreview(form, lots) {
  const selectedLot = lots.find((lot) => lot.id === form.chicken_lot_id);
  const totalAdukan = numberValue(form.total_adukan);

  const kgPerAdukan = 30;
  const pcsPerAdukan = 1000;

  const plannedChickenKg = totalAdukan * kgPerAdukan;
  const plannedOutputPcs = totalAdukan * pcsPerAdukan;
  const actualOutputPcs = numberValue(form.actual_output_pcs) || plannedOutputPcs;

  const modalAyam = selectedLot ? plannedChickenKg * selectedLot.unit_cost : 0;
  const hppAyamPerPcs =
    actualOutputPcs > 0 ? modalAyam / actualOutputPcs : 0;

  const remainingAfterUse = selectedLot
    ? selectedLot.remaining_kg - plannedChickenKg
    : 0;

  return {
    selectedLot,
    production_date: form.production_date,
    total_adukan: totalAdukan,
    kg_per_adukan: kgPerAdukan,
    pcs_per_adukan: pcsPerAdukan,
    planned_chicken_kg: plannedChickenKg,
    planned_output_pcs: plannedOutputPcs,
    actual_output_pcs: actualOutputPcs,
    modal_ayam: modalAyam,
    hpp_ayam_per_pcs: hppAyamPerPcs,
    remaining_after_use: remainingAfterUse,
    note: form.note,
  };
}

function buildLiveProductionPayload({ preview, session }) {
  return {
    production: {
      location_id: session?.user?.location_id || "",
      production_date: preview.production_date,

      chicken_lot_id: preview.selectedLot?.id || "",
      source_chicken_lot_id: preview.selectedLot?.id || "",

      total_adukan: preview.total_adukan,
      kg_per_adukan: preview.kg_per_adukan,
      chicken_kg_used: preview.planned_chicken_kg,

      planned_output_pcs: preview.planned_output_pcs,
      actual_output_pcs: preview.actual_output_pcs,

      chicken_unit_cost: preview.selectedLot?.unit_cost || 0,
      chicken_cost: preview.modal_ayam,
      estimated_chicken_cost_per_pcs: preview.hpp_ayam_per_pcs,

      product_code: "DIMSUM_AYAM_MIX",
      output_unit: "pcs",
      notes: preview.note,
    },
  };
}

function validateForm(form, preview) {
  const errors = [];

  if (!form.production_date) errors.push("Tanggal produksi wajib diisi.");
  if (!form.chicken_lot_id) errors.push("Lot ayam wajib dipilih.");
  if (preview.total_adukan <= 0) errors.push("Jumlah adukan harus lebih dari 0.");
  if (preview.planned_chicken_kg <= 0) errors.push("Kg ayam dipakai harus lebih dari 0.");
  if (preview.selectedLot && preview.planned_chicken_kg > preview.selectedLot.remaining_kg) {
    errors.push("Kg ayam dipakai melebihi sisa kg di lot ayam.");
  }
  if (preview.actual_output_pcs <= 0) errors.push("Hasil pcs aktual harus lebih dari 0.");

  return errors;
}

function getStatusTone(status) {
  const value = String(status || "").toUpperCase();

  if (value.includes("SELESAI") || value.includes("COMPLETED") || value.includes("ACTIVE")) {
    return "success";
  }
  if (value.includes("VOID") || value.includes("CANCEL")) return "danger";

  return "warning";
}

function PayloadRow({ label, value }) {
  return (
    <div className="da-payload-row">
      <span>{label}</span>
      <strong>{safeText(value)}</strong>
    </div>
  );
}

export default function AdukanPage({ session, onSessionExpired }) {
  const [loading, setLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);

  const lots = useMemo(() => {
    return getActiveLotsFromData(bootstrap);
  }, [bootstrap]);

  const productionBatches = asArray(bootstrap?.production_batches);

  const summary = useMemo(() => buildSummary(bootstrap), [bootstrap]);

  const preview = useMemo(() => {
    return buildProductionPreview(form, lots);
  }, [form, lots]);

  const livePayload = useMemo(() => {
    return buildLiveProductionPayload({ preview, session });
  }, [preview, session]);

  const validationErrors = useMemo(() => {
    return validateForm(form, preview);
  }, [form, preview]);

  const canOpenConfirmation = validationErrors.length === 0;

  const loadData = async () => {
    setLoading(true);
    setError("");

    const result = await getProductionBootstrap(session?.sessionToken, {
      source: "frontend_part_3b_1_preview_payload_produksi_adukan",
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setError(result.message || "Gagal membaca data Produksi / Adukan.");
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
    setShowValidationErrors(true);

    if (!canOpenConfirmation) return;

    setConfirmOpen(true);
  };

  const handleResetForm = () => {
    setForm(initialForm);
    setShowValidationErrors(false);
    setConfirmOpen(false);
  };

  const columns = [
    {
      key: "production_date",
      label: "Tanggal",
      render: (row) => formatDisplayDate(row.production_date || row.date),
    },
    {
      key: "production_id",
      label: "Produksi ID",
      render: (row) => (
        <strong>{safeText(row.production_id || row.batch_id || row.id)}</strong>
      ),
    },
    {
      key: "chicken_lot_id",
      label: "Lot Ayam",
      render: (row) => safeText(row.chicken_lot_id || row.lot_id),
    },
    {
      key: "total_adukan",
      label: "Adukan",
      render: (row) =>
        `${numberValue(row.total_adukan || row.adukan_qty || row.adukan).toLocaleString(
          "id-ID"
        )} adukan`,
    },
    {
      key: "chicken_kg_used",
      label: "Ayam Dipakai",
      render: (row) =>
        `${numberValue(
          row.chicken_kg_used || row.used_kg || row.raw_material_kg
        ).toLocaleString("id-ID")} kg`,
    },
    {
      key: "actual_output_pcs",
      label: "Hasil Pcs",
      render: (row) =>
        `${numberValue(
          row.actual_output_pcs || row.output_pcs || row.finished_good_qty
        ).toLocaleString("id-ID")} pcs`,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <Badge tone={getStatusTone(row.status)}>
          {safeText(row.status || "Tercatat")}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Produksi / Adukan"
        description="Catat ayam dipakai produksi dari lot harga aktual, lalu hasil produksi masuk sebagai stok jadi."
        badge="Payload Preview"
      />

      <div className="da-dashboard-banner">
        <div>
          <div className="da-dashboard-banner-kicker">Dapur produksi</div>
          <div className="da-dashboard-banner-title">
            Lot Ayam → Adukan → Stok Jadi
          </div>
          <div className="da-dashboard-banner-desc">
            Tahap ini menyiapkan payload live produksi. Belum memotong stok ayam
            dan belum membuat batch produksi.
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
          label="Lot Ayam Aktif"
          value={loading ? "..." : summary.activeLotCount}
          description="Lot ayam yang masih punya sisa kg dan siap dipakai produksi."
        />

        <StatCard
          label="Sisa Kg Ayam"
          value={
            loading
              ? "..."
              : `${summary.totalKgAvailable.toLocaleString("id-ID")} kg`
          }
          description="Total sisa kg ayam dari lot aktif."
        />

        <StatCard
          tone="warning"
          label="Batch Produksi"
          value={loading ? "..." : summary.batchCount}
          description="Jumlah produksi/adukan yang sudah tercatat."
        />
      </div>

      <div style={{ height: 16 }} />

      <div className="da-grid da-grid-3">
        <StatCard
          label="Total Adukan"
          value={loading ? "..." : summary.totalAdukan}
          description="Total adukan yang terbaca dari backend."
        />

        <StatCard
          label="Hasil Produksi"
          value={
            loading
              ? "..."
              : `${summary.totalOutputPcs.toLocaleString("id-ID")} pcs`
          }
          description="Total hasil pcs yang tercatat."
        />

        <StatCard
          label="Gerak Stok"
          value={loading ? "..." : summary.stockMovementCount}
          description="Jumlah catatan stok yang terkait produksi."
        />
      </div>

      <div style={{ height: 16 }} />

      <Card>
        <div className="da-section-heading">
          <div>
            <div className="da-mini-title">Form Produksi</div>
            <div className="da-big-text">Input Adukan</div>
            <p className="da-muted">
              Pilih lot ayam yang akan dipakai. Sistem menghitung 1 adukan = 30 kg ayam
              dan estimasi 1.000 pcs. Tahap ini belum simpan live.
            </p>
          </div>

          <Badge tone="warning">Payload Preview</Badge>
        </div>

        <form onSubmit={handlePreviewSubmit}>
          <div className="da-drop-form-preview">
            <div className="da-drop-field">
              <label>Tanggal Produksi</label>
              <input
                type="date"
                className="da-input"
                value={form.production_date}
                onChange={(event) =>
                  updateForm("production_date", event.target.value)
                }
              />
            </div>

            <div className="da-drop-field">
              <label>Lot Ayam</label>
              <select
                className="da-select"
                value={form.chicken_lot_id}
                onChange={(event) =>
                  updateForm("chicken_lot_id", event.target.value)
                }
              >
                <option value="">Pilih lot ayam</option>
                {lots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.label} · sisa {lot.remaining_kg.toLocaleString("id-ID")} kg ·{" "}
                    {formatRupiah(lot.unit_cost)}/kg
                  </option>
                ))}
              </select>
            </div>

            <div className="da-drop-field">
              <label>Jumlah Adukan</label>
              <input
                className="da-input"
                inputMode="decimal"
                value={form.total_adukan}
                placeholder="Contoh: 1"
                onChange={(event) =>
                  updateForm("total_adukan", event.target.value)
                }
              />
            </div>

            <div className="da-drop-field">
              <label>Hasil Aktual Pcs</label>
              <input
                className="da-input"
                inputMode="numeric"
                value={form.actual_output_pcs}
                placeholder="Kosongkan untuk default 1.000 pcs/adukan"
                onChange={(event) =>
                  updateForm("actual_output_pcs", event.target.value)
                }
              />
            </div>

            <div className="da-drop-field da-drop-field-wide">
              <label>Catatan Produksi</label>
              <input
                className="da-input"
                value={form.note}
                placeholder="Contoh: produksi pagi / hasil lebih / ada susut"
                onChange={(event) => updateForm("note", event.target.value)}
              />
            </div>
          </div>

          <div className="da-drop-preview-panel">
            <div>
              <div className="da-mini-title">Ayam Dipakai</div>
              <div className="da-big-text">
                {preview.planned_chicken_kg.toLocaleString("id-ID")} kg
              </div>
              <p className="da-muted">
                {preview.total_adukan.toLocaleString("id-ID")} adukan × 30 kg.
              </p>
            </div>

            <div>
              <div className="da-mini-title">Hasil Produksi</div>
              <div className="da-big-text">
                {preview.actual_output_pcs.toLocaleString("id-ID")} pcs
              </div>
              <p className="da-muted">
                Estimasi default: {preview.planned_output_pcs.toLocaleString("id-ID")} pcs.
              </p>
            </div>

            <div>
              <div className="da-mini-title">Modal Ayam Batch</div>
              <div className="da-big-text">{formatRupiah(preview.modal_ayam)}</div>
              <p className="da-muted">
                Est. modal ayam/pcs:{" "}
                <strong>{formatRupiah(preview.hpp_ayam_per_pcs)}</strong>
              </p>
            </div>
          </div>

          {showValidationErrors && validationErrors.length > 0 ? (
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
            <div className="da-mini-title">Daftar Produksi</div>
            <div className="da-big-text">Adukan yang Terbaca</div>
            <p className="da-muted">
              Klik baris untuk melihat detail popup tengah. Tahap ini read-only.
            </p>
          </div>

          <Badge tone="warning">Read Only</Badge>
        </div>

        <DataTable
          columns={columns}
          rows={loading ? [] : productionBatches}
          getRowKey={(row, index) => row.production_id || row.batch_id || index}
          onRowClick={setSelectedBatch}
        />
      </Card>

      <Modal
        open={confirmOpen}
        title="Konfirmasi Preview Produksi"
        subtitle="Belum menyimpan transaksi hidup"
        onClose={() => setConfirmOpen(false)}
      >
        <div className="da-modal-summary">
          <div>
            <div className="da-mini-title">Ayam Dipakai</div>
            <div className="da-big-text">
              {preview.planned_chicken_kg.toLocaleString("id-ID")} kg
            </div>
            <p className="da-muted">
              Diambil dari lot:{" "}
              <strong>{safeText(preview.selectedLot?.label, "Belum dipilih")}</strong>
            </p>
          </div>

          <Badge tone="warning">Payload Preview</Badge>
        </div>

        <div className="da-detail-grid">
          <div className="da-detail-box">
            <div className="da-mini-title">Produksi</div>
            <p><strong>Tanggal:</strong> {formatDisplayDate(preview.production_date)}</p>
            <p><strong>Adukan:</strong> {preview.total_adukan.toLocaleString("id-ID")}</p>
            <p><strong>Ayam dipakai:</strong> {preview.planned_chicken_kg.toLocaleString("id-ID")} kg</p>
          </div>

          <div className="da-detail-box">
            <div className="da-mini-title">Lot Ayam</div>
            <p><strong>Lot:</strong> {safeText(preview.selectedLot?.label)}</p>
            <p><strong>Harga/kg:</strong> {formatRupiah(preview.selectedLot?.unit_cost || 0)}</p>
            <p><strong>Sisa setelah pakai:</strong> {preview.remaining_after_use.toLocaleString("id-ID")} kg</p>
          </div>

          <div className="da-detail-box">
            <div className="da-mini-title">Hasil Produksi</div>
            <p><strong>Default pcs:</strong> {preview.planned_output_pcs.toLocaleString("id-ID")} pcs</p>
            <p><strong>Aktual pcs:</strong> {preview.actual_output_pcs.toLocaleString("id-ID")} pcs</p>
            <p><strong>Modal ayam/pcs:</strong> {formatRupiah(preview.hpp_ayam_per_pcs)}</p>
          </div>

          <div className="da-detail-box">
            <div className="da-mini-title">Yang Akan Dibuat Backend</div>
            <p><strong>Batch Produksi:</strong> Ya</p>
            <p><strong>Potong Kg Ayam Lot:</strong> Ya, nanti di Part 3B-2</p>
            <p><strong>Barang Jadi Masuk:</strong> Ya, nanti di Part 3B-2</p>
            <p><strong>Arsip & Audit:</strong> Ya</p>
          </div>
        </div>

        <div className="da-payload-preview">
          <div className="da-mini-title">Payload Live Part 3B-2</div>

          <PayloadRow label="Action" value="legacyCreateProductionBatchFromOldFactory" />
          <PayloadRow label="location_id" value={livePayload.production.location_id} />
          <PayloadRow label="production_date" value={livePayload.production.production_date} />
          <PayloadRow label="chicken_lot_id" value={livePayload.production.chicken_lot_id} />
          <PayloadRow label="total_adukan" value={livePayload.production.total_adukan} />
          <PayloadRow label="chicken_kg_used" value={livePayload.production.chicken_kg_used} />
          <PayloadRow label="actual_output_pcs" value={livePayload.production.actual_output_pcs} />
          <PayloadRow label="chicken_unit_cost" value={formatRupiah(livePayload.production.chicken_unit_cost)} />
          <PayloadRow label="chicken_cost" value={formatRupiah(livePayload.production.chicken_cost)} />
          <PayloadRow label="product_code" value={livePayload.production.product_code} />
        </div>

        <div className="da-modal-note" style={{ marginTop: 14 }}>
          Tahap ini hanya menampilkan payload. Tombol simpan live masih dikunci supaya
          kita pastikan dulu mapping backend aman sebelum stok ayam benar-benar dipotong.
        </div>

        <div className="da-form-actions">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Koreksi Lagi
          </Button>

          <Button type="button" disabled>
            Simpan Live di Part 3B-2
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(selectedBatch)}
        title="Detail Produksi / Adukan"
        subtitle={selectedBatch?.production_id || selectedBatch?.batch_id || ""}
        onClose={() => setSelectedBatch(null)}
      >
        {selectedBatch ? (
          <div>
            <div className="da-modal-summary">
              <div>
                <div className="da-mini-title">Hasil Produksi</div>
                <div className="da-big-text">
                  {numberValue(
                    selectedBatch.actual_output_pcs ||
                      selectedBatch.output_pcs ||
                      selectedBatch.finished_good_qty
                  ).toLocaleString("id-ID")}{" "}
                  pcs
                </div>
                <p className="da-muted">
                  Lot ayam:{" "}
                  <strong>{safeText(selectedBatch.chicken_lot_id || selectedBatch.lot_id)}</strong>
                </p>
              </div>

              <Badge tone={getStatusTone(selectedBatch.status)}>
                {safeText(selectedBatch.status || "Tercatat")}
              </Badge>
            </div>

            <div className="da-detail-grid">
              <div className="da-detail-box">
                <div className="da-mini-title">Produksi</div>
                <p><strong>ID:</strong> {safeText(selectedBatch.production_id || selectedBatch.batch_id)}</p>
                <p><strong>Tanggal:</strong> {formatDisplayDate(selectedBatch.production_date || selectedBatch.date)}</p>
                <p><strong>Adukan:</strong> {safeText(selectedBatch.total_adukan || selectedBatch.adukan_qty || selectedBatch.adukan)}</p>
              </div>

              <div className="da-detail-box">
                <div className="da-mini-title">Ayam Dipakai</div>
                <p><strong>Kg:</strong> {numberValue(selectedBatch.chicken_kg_used || selectedBatch.used_kg).toLocaleString("id-ID")} kg</p>
                <p><strong>Lot:</strong> {safeText(selectedBatch.chicken_lot_id || selectedBatch.lot_id)}</p>
                <p><strong>Modal ayam:</strong> {formatRupiah(selectedBatch.chicken_cost || selectedBatch.modal_ayam)}</p>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
