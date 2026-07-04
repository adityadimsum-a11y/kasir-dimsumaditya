import { useEffect, useMemo, useState } from "react";
import {
import {
  createProductionBatch,
  getProductionBootstrap,
  getProducts,
} from "../../lib/api/actions";
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
  production_pic_id: "",
  production_pic_name: "",
  output_product_id: "",
  output_product_code: "",
  output_product_name: "",
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

/**
 * LOT AYAM
 */

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

/**
 * PIC PRODUKSI
 */

function normalizePerson(row) {
  const id =
    row.employee_id ||
    row.karyawan_id ||
    row.user_id ||
    row.staff_id ||
    row.person_id ||
    row.id ||
    row.username ||
    "";

  const name =
    row.employee_name ||
    row.nama_karyawan ||
    row.display_name ||
    row.full_name ||
    row.name ||
    row.username ||
    "";

  return {
    id: String(id || "").trim(),
    name: String(name || "").trim(),
    role: row.role_name || row.position || row.jabatan || row.role || "",
    location_id: row.location_id || row.work_location_id || row.branch_id || "",
    status: row.status || row.is_active || "ACTIVE",
    raw: row,
  };
}

function uniquePeopleById(people) {
  const map = new Map();

  asArray(people).forEach((person) => {
    if (!person?.id && !person?.name) return;

    const key = person.id || person.name;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, person);
      return;
    }

    map.set(key, {
      ...existing,
      ...person,
      name: person.name || existing.name,
      role: person.role || existing.role,
      location_id: person.location_id || existing.location_id,
    });
  });

  return Array.from(map.values());
}

function getProductionPeopleFromData(data, session) {
  const sources = [
    ...asArray(data?.employees),
    ...asArray(data?.karyawan),
    ...asArray(data?.users),
    ...asArray(data?.staff),
    ...asArray(data?.team_members),
    ...asArray(data?.production_team),
    ...asArray(data?.pic_options),
    ...asArray(data?.production_pics),
  ];

  const homeLocationId = session?.user?.location_id || "";

  const people = sources
    .map(normalizePerson)
    .filter((person) => person.id || person.name)
    .filter((person) => {
      const status = String(person.status || "").toUpperCase();

      return (
        !status.includes("INACTIVE") &&
        !status.includes("NONAKTIF") &&
        !status.includes("VOID") &&
        !status.includes("DELETE")
      );
    })
    .filter((person) => {
      if (!homeLocationId || !person.location_id) return true;
      return String(person.location_id) === String(homeLocationId);
    });

  return uniquePeopleById(people);
}

/**
 * PRODUK HASIL ADUKAN
 */

function normalizeProduct(row) {
  const id =
    row.product_id ||
    row.item_id ||
    row.sku_id ||
    row.id ||
    row.product_code ||
    row.code ||
    "";

  const code =
    row.product_code ||
    row.sku ||
    row.code ||
    row.item_code ||
    id ||
    "";

  const name =
    row.product_name ||
    row.item_name ||
    row.name ||
    row.nama_produk ||
    row.menu_name ||
    code ||
    "";

  return {
    id: String(id || "").trim(),
    code: String(code || "").trim(),
    name: String(name || "").trim(),
    category: row.category || row.product_category || row.type || "",
    status: row.status || row.is_active || "ACTIVE",
    raw: row,
  };
}

function uniqueProductsById(products) {
  const map = new Map();

  asArray(products).forEach((product) => {
    if (!product?.id && !product?.code) return;

    const key = product.id || product.code;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, product);
      return;
    }

    map.set(key, {
      ...existing,
      ...product,
      id: product.id || existing.id,
      code: product.code || existing.code,
      name: product.name || existing.name,
      category: product.category || existing.category,
    });
  });

  return Array.from(map.values());
}

function getProductionProductsFromData(data) {
  const sources = [
    ...asArray(data?.products),
    ...asArray(data?.master_products),
    ...asArray(data?.items),
    ...asArray(data?.menus),
    ...asArray(data?.finished_products),
    ...asArray(data?.output_products),
  ];

  const products = sources
    .map(normalizeProduct)
    .filter((product) => product.id || product.code)
    .filter((product) => {
      const status = String(product.status || "").toUpperCase();

      return (
        !status.includes("INACTIVE") &&
        !status.includes("NONAKTIF") &&
        !status.includes("VOID") &&
        !status.includes("DELETE")
      );
    });

  const uniqueProducts = uniqueProductsById(products);

  const productionLike = uniqueProducts.filter((product) => {
    const text = `${product.name} ${product.code} ${product.category}`.toUpperCase();

    return (
      text.includes("DIMSUM") ||
      text.includes("AYAM MIX") ||
      text.includes("ORIGINAL") ||
      text.includes("ADUKAN")
    );
  });

  return productionLike.length > 0 ? productionLike : uniqueProducts;
}

/**
 * SUMMARY & PREVIEW
 */

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

function buildProductionPreview(form, lots, people, products) {
  const selectedLot = lots.find((lot) => lot.id === form.chicken_lot_id);
  const selectedPic = people.find((person) => person.id === form.production_pic_id);
  const selectedProduct = products.find((product) => product.id === form.output_product_id);

  const manualPicName = String(form.production_pic_name || "").trim();

  const productionPic = selectedPic
    ? selectedPic
    : manualPicName
      ? {
          id: "",
          name: manualPicName,
          role: "PIC Produksi",
        }
      : null;

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
    productionPic,
    outputProduct: selectedProduct || null,
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
  const picId = preview.productionPic?.id || "";
  const picName = preview.productionPic?.name || "";

  const productId = preview.outputProduct?.id || "";
  const productCode = preview.outputProduct?.code || "";
  const productName = preview.outputProduct?.name || "";

  const production = {
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

    product_id: productId,
    product_code: productCode,
    product_name: productName,

    output_product_id: productId,
    output_product_code: productCode,
    output_product_name: productName,

    finished_product_id: productId,
    finished_product_code: productCode,
    finished_product_name: productName,

    finished_good_product_id: productId,
    finished_good_product_code: productCode,
    finished_good_product_name: productName,

    output_unit: "pcs",

    production_pic_id: picId,
    production_pic_name: picName,
    pic_produksi_id: picId,
    pic_produksi: picName,
    kepala_dapur_id: picId,
    kepala_dapur: picName,
    kepala_dapur_name: picName,
    pic_name: picName,

    notes: preview.note,
  };

  return {
    production,

    production_pic_id: picId,
    production_pic_name: picName,
    pic_produksi_id: picId,
    pic_produksi: picName,
    kepala_dapur_id: picId,
    kepala_dapur: picName,
    kepala_dapur_name: picName,
    pic_name: picName,

    product_id: productId,
    product_code: productCode,
    product_name: productName,
    output_product_id: productId,
    output_product_code: productCode,
    output_product_name: productName,
    finished_product_id: productId,
    finished_product_code: productCode,
    finished_product_name: productName,
    finished_good_product_id: productId,
    finished_good_product_code: productCode,
    finished_good_product_name: productName,
  };
}

function validateForm(form, preview) {
  const errors = [];

  if (!form.production_date) errors.push("Tanggal produksi wajib diisi.");
  if (!form.chicken_lot_id) errors.push("Lot ayam wajib dipilih.");
  if (!preview.productionPic?.name) errors.push("PIC Produksi Hari Ini wajib diisi.");
  if (!preview.outputProduct?.id && !preview.outputProduct?.code) {
    errors.push("Produk hasil adukan wajib dipilih.");
  }
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
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [fallbackProducts, setFallbackProducts] = useState([]);

  const lots = useMemo(() => {
    return getActiveLotsFromData(bootstrap);
  }, [bootstrap]);

  const productionPeople = useMemo(() => {
    return getProductionPeopleFromData(bootstrap, session);
  }, [bootstrap, session]);

  const productionProducts = useMemo(() => {
  const fromProductionBootstrap = getProductionProductsFromData(bootstrap);

  if (fromProductionBootstrap.length > 0) {
    return fromProductionBootstrap;
  }

  return fallbackProducts;
}, [bootstrap, fallbackProducts]);

  const productionBatches = asArray(bootstrap?.production_batches);

  const summary = useMemo(() => buildSummary(bootstrap), [bootstrap]);

  const preview = useMemo(() => {
    return buildProductionPreview(form, lots, productionPeople, productionProducts);
  }, [form, lots, productionPeople, productionProducts]);

  const livePayload = useMemo(() => {
    return buildLiveProductionPayload({ preview, session });
  }, [preview, session]);

  const validationErrors = useMemo(() => {
    return validateForm(form, preview);
  }, [form, preview]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    const result = await getProductionBootstrap(session?.sessionToken, {
      source: "frontend_part_3b_2b_produk_hasil_adukan",
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

const productResult = await getProducts(session?.sessionToken, {
  source: "frontend_part_3b_2c_produk_hasil_adukan_fallback",
});

if (productResult?.success) {
  const productPayload = productResult.data || {};
  const productRows = Array.isArray(productPayload)
    ? productPayload
    : productPayload.products ||
      productPayload.rows ||
      productPayload.items ||
      productPayload.data ||
      [];

  setFallbackProducts(
    getProductionProductsFromData({
      products: productRows,
    })
  );
} else {
  setFallbackProducts([]);
}

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
    setSubmitResult(null);

    if (validationErrors.length > 0) return;

    setConfirmOpen(true);
  };

  const handleResetForm = () => {
    setForm(initialForm);
    setShowValidationErrors(false);
    setConfirmOpen(false);
    setSubmitResult(null);
  };

  const handleLiveSubmit = async () => {
    if (submitting || validationErrors.length > 0) return;

    setSubmitting(true);
    setSubmitResult(null);

    const result = await createProductionBatch(session?.sessionToken, livePayload);

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setSubmitResult({
        success: false,
        message: result.message || "Gagal menyimpan Produksi / Adukan.",
        data: result.data || null,
      });
      setSubmitting(false);
      return;
    }

    setSubmitResult({
      success: true,
      message: result.message || "Produksi / Adukan berhasil disimpan.",
      data: result.data || null,
    });

    setConfirmOpen(false);
    setSubmitting(false);
    setForm(initialForm);
    setShowValidationErrors(false);
    await loadData();
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
        badge="Live Submit"
      />

      <div className="da-dashboard-banner">
        <div>
          <div className="da-dashboard-banner-kicker">Dapur produksi</div>
          <div className="da-dashboard-banner-title">
            Lot Ayam → Adukan → Stok Jadi
          </div>
          <div className="da-dashboard-banner-desc">
            Form ini sudah bisa menyimpan produksi hidup. Pastikan produk hasil,
            PIC Produksi, adukan, lot ayam, dan hasil pcs benar sebelum klik Simpan Live.
          </div>
        </div>

        <div className="da-dashboard-banner-actions">
          <Badge tone={error ? "danger" : "success"}>
            {error ? "Perlu Dicek" : "Terhubung"}
          </Badge>

          <Button
            variant="ghost"
            onClick={loadData}
            disabled={loading || submitting}
          >
            {loading ? "Membaca..." : "Refresh Data"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="da-login-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      ) : null}

      {submitResult ? (
        <div
          className={submitResult.success ? "da-form-success" : "da-form-warning"}
          style={{ marginBottom: 16 }}
        >
          {submitResult.message}
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
              Pilih produk hasil, lot ayam, dan PIC Produksi Hari Ini. Sistem
              menghitung 1 adukan = 30 kg ayam dan estimasi 1.000 pcs.
            </p>
          </div>

          <Badge tone="danger">Live Transaction</Badge>
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
                disabled={submitting}
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
                disabled={submitting}
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
              <label>PIC Produksi Hari Ini</label>
              {productionPeople.length > 0 ? (
                <select
                  className="da-select"
                  value={form.production_pic_id}
                  onChange={(event) => {
                    updateForm("production_pic_id", event.target.value);
                    updateForm("production_pic_name", "");
                  }}
                  disabled={submitting}
                >
                  <option value="">Pilih PIC produksi</option>
                  {productionPeople.map((person) => (
                    <option key={person.id || person.name} value={person.id}>
                      {person.name}
                      {person.role ? ` · ${person.role}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="da-input"
                  value={form.production_pic_name}
                  placeholder="Ketik nama PIC produksi hari ini"
                  onChange={(event) => {
                    updateForm("production_pic_name", event.target.value);
                    updateForm("production_pic_id", "");
                  }}
                  disabled={submitting}
                />
              )}
            </div>

            <div className="da-drop-field">
              <label>Produk Hasil Adukan</label>
              <select
                className="da-select"
                value={form.output_product_id}
                onChange={(event) => {
                  const product = productionProducts.find(
                    (item) => item.id === event.target.value
                  );

                  updateForm("output_product_id", event.target.value);
                  updateForm("output_product_code", product?.code || "");
                  updateForm("output_product_name", product?.name || "");
                }}
                disabled={submitting}
              >
                <option value="">Pilih produk hasil</option>
                {productionProducts.map((product) => (
                  <option key={product.id || product.code} value={product.id}>
                    {product.name}
                    {product.code ? ` · ${product.code}` : ""}
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
                disabled={submitting}
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
                disabled={submitting}
              />
            </div>

            <div className="da-drop-field da-drop-field-wide">
              <label>Catatan Produksi</label>
              <input
                className="da-input"
                value={form.note}
                placeholder="Contoh: produksi pagi / hasil lebih / ada susut"
                onChange={(event) => updateForm("note", event.target.value)}
                disabled={submitting}
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
                Produk:{" "}
                <strong>{safeText(preview.outputProduct?.name, "Belum dipilih")}</strong>
              </p>
            </div>

            <div>
              <div className="da-mini-title">Modal Ayam Batch</div>
              <div className="da-big-text">{formatRupiah(preview.modal_ayam)}</div>
              <p className="da-muted">
                PIC: <strong>{safeText(preview.productionPic?.name, "Belum dipilih")}</strong>
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
            <Button
              type="button"
              variant="ghost"
              onClick={handleResetForm}
              disabled={submitting}
            >
              Reset Form
            </Button>

            <Button type="submit" disabled={submitting}>
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
              Klik baris untuk melihat detail popup tengah.
            </p>
          </div>

          <Badge tone="warning">Live Data</Badge>
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
        title="Konfirmasi Simpan Produksi"
        subtitle="Ini akan membuat transaksi hidup"
        onClose={() => {
          if (!submitting) setConfirmOpen(false);
        }}
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

          <Badge tone="danger">Live Submit</Badge>
        </div>

        <div className="da-detail-grid">
          <div className="da-detail-box">
            <div className="da-mini-title">Produksi</div>
            <p><strong>Tanggal:</strong> {formatDisplayDate(preview.production_date)}</p>
            <p><strong>PIC:</strong> {safeText(preview.productionPic?.name)}</p>
            <p><strong>Produk:</strong> {safeText(preview.outputProduct?.name)}</p>
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
            <div className="da-mini-title">Yang Dibuat Backend</div>
            <p><strong>Batch Produksi:</strong> Ya</p>
            <p><strong>Potong Kg Ayam Lot:</strong> Ya</p>
            <p><strong>Barang Jadi Masuk:</strong> Ya</p>
            <p><strong>Arsip & Audit:</strong> Ya</p>
          </div>
        </div>

        <div className="da-payload-preview">
          <div className="da-mini-title">Payload Live</div>

          <PayloadRow label="Action" value="legacyCreateProductionBatchFromOldFactory" />
          <PayloadRow label="location_id" value={livePayload.production.location_id} />
          <PayloadRow label="production_date" value={livePayload.production.production_date} />
          <PayloadRow label="chicken_lot_id" value={livePayload.production.chicken_lot_id} />
          <PayloadRow label="PIC Produksi" value={livePayload.production.production_pic_name} />
          <PayloadRow label="kepala_dapur" value={livePayload.production.kepala_dapur} />
          <PayloadRow label="product_id" value={livePayload.production.product_id} />
          <PayloadRow label="product_code" value={livePayload.production.product_code} />
          <PayloadRow label="product_name" value={livePayload.production.product_name} />
          <PayloadRow label="total_adukan" value={livePayload.production.total_adukan} />
          <PayloadRow label="chicken_kg_used" value={livePayload.production.chicken_kg_used} />
          <PayloadRow label="actual_output_pcs" value={livePayload.production.actual_output_pcs} />
          <PayloadRow label="chicken_unit_cost" value={formatRupiah(livePayload.production.chicken_unit_cost)} />
          <PayloadRow label="chicken_cost" value={formatRupiah(livePayload.production.chicken_cost)} />
        </div>

        <div className="da-modal-note" style={{ marginTop: 14 }}>
          Setelah disimpan, backend akan memotong kg ayam dari lot, membuat batch produksi,
          menambah stok jadi, mengunci modal batch, membuat catatan stok, arsip, dan audit.
        </div>

        {submitResult && !submitResult.success ? (
          <div className="da-form-warning" style={{ marginTop: 14 }}>
            {submitResult.message}
          </div>
        ) : null}

        <div className="da-form-actions">
          <Button
            variant="ghost"
            onClick={() => setConfirmOpen(false)}
            disabled={submitting}
          >
            Koreksi Lagi
          </Button>

          <Button
            type="button"
            onClick={handleLiveSubmit}
            disabled={submitting}
          >
            {submitting ? "Menyimpan..." : "Simpan Live Produksi"}
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
