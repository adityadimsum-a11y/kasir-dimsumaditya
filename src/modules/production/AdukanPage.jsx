import { useEffect, useMemo, useState } from "react";
import {
  createProductionBatch,
  getProductionBootstrap,
  getProducts,
} from "../../lib/api/actions";
import ProductionFlowPanel from "./ProductionFlowPanel";
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


function isRealProductionBatch(row) {
  if (!row || typeof row !== "object") return false;

  const id = String(
    row.production_id || row.production_no || row.batch_id || row.id || row.source_id || ""
  ).trim();
  const productName = String(
    row.product_name || row.output_product_name || row.finished_product_name || row.item_name || ""
  ).trim();
  const lotId = String(row.chicken_lot_id || row.lot_id || row.source_chicken_lot_id || "").trim();
  const status = String(row.status || "").toUpperCase();
  const totalAdukan = numberValue(row.total_adukan || row.adukan_qty || row.jumlah_adukan || row.adukan);
  const outputPcs = numberValue(row.actual_output_pcs || row.actual_pcs || row.output_pcs || row.hasil_pcs || row.finished_good_qty || row.qty_pcs || row.qty);
  const chickenKg = numberValue(row.chicken_kg_used || row.kg_ayam_dipakai || row.used_kg || row.raw_material_kg);

  if (!id && !productName && !lotId && totalAdukan === 0 && outputPcs === 0 && chickenKg === 0) return false;
  if (!id && totalAdukan === 0 && outputPcs === 0 && chickenKg === 0) return false;
  if (status.includes("VOID") || status.includes("CANCEL") || status.includes("DELETE")) return false;

  return true;
}

function cleanProductionBatches(rows) {
  return asArray(rows).filter(isRealProductionBatch);
}

function isRealStockMovement(row) {
  if (!row || typeof row !== "object") return false;

  const id = String(row.movement_id || row.stock_movement_id || row.mutation_id || row.id || "").trim();
  const source = String(row.source_id || row.ref_id || row.production_id || row.batch_id || "").trim();
  const qty = numberValue(row.qty || row.qty_effect || row.quantity);
  const totalCost = numberValue(row.total_cost || row.amount || row.value);
  const direction = String(row.direction || row.movement_type || "").trim();

  if (!id && !source && qty === 0 && totalCost === 0 && !direction) return false;
  return true;
}

function cleanStockMovements(rows) {
  return asArray(rows).filter(isRealStockMovement);
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
    source_sheet: row._source_sheet || row.source_sheet || row.source_module || "",
    raw: row,
  };
}

function getLotSourcePriority(lot) {
  const source = String(
    lot?.source_sheet || lot?.raw?._source_sheet || lot?.raw?.source_module || ""
  ).toUpperCase();

  if (source.includes("CHICKEN_LOTS") || source.includes("TABCHICKENLOTS")) return 30;
  if (source.includes("CHICKEN_LOT")) return 25;
  if (source.includes("CHICKEN_DROP") || source.includes("DROP")) return 20;
  if (source.includes("INVENTORY_COST_LAYERS") || source.includes("COST_LAYER")) return 10;

  return 1;
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

    const existingPriority = getLotSourcePriority(existing);
    const currentPriority = getLotSourcePriority(lot);

    if (currentPriority > existingPriority) {
      map.set(lot.id, lot);
      return;
    }

    if (currentPriority < existingPriority) {
      return;
    }

    const existingRemaining = numberValue(existing.remaining_kg);
    const currentRemaining = numberValue(lot.remaining_kg);

    // Kalau sumber sama-sama kuat, ambil angka sisa terkecil agar stok tidak kebaca lebih besar dari kondisi aman.
    if (currentRemaining < existingRemaining) {
      map.set(lot.id, {
        ...existing,
        ...lot,
        remaining_kg: currentRemaining,
      });
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
    row.menu_id ||
    row.id ||
    row.product_code ||
    row.code ||
    "";

  const code =
    row.product_code ||
    row.sku ||
    row.code ||
    row.item_code ||
    row.menu_code ||
    id ||
    "";

  const name =
    row.product_name ||
    row.item_name ||
    row.name ||
    row.nama_produk ||
    row.menu_name ||
    row.nama_menu ||
    code ||
    "";

  return {
    id: String(id || "").trim(),
    code: String(code || "").trim(),
    name: String(name || "").trim(),
    category: row.category || row.product_category || row.type || row.product_type || "",
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
    ...asArray(data?.adukan_products),
    ...asArray(data?.adukanProducts),
    ...asArray(data?.productRows),
    ...asArray(data?.rows),
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

function extractProductRows(result) {
  const payload = result?.data || {};

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.products)) return payload.products;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.master_products)) return payload.master_products;

  return [];
}

/**
 * SUMMARY & PREVIEW
 */

function buildSummary(data) {
  const activeLots = getActiveLotsFromData(data);
  const batches = cleanProductionBatches(data?.production_batches);
  const stockMovements = cleanStockMovements(data?.stock_movements);

  const totalKgAvailable = activeLots.reduce((total, lot) => {
    return total + numberValue(lot.remaining_kg);
  }, 0);

  const totalAdukan = sumRows(batches, ["total_adukan", "adukan_qty", "jumlah_adukan", "adukan"]);
  const totalOutputPcs = sumRows(batches, [
    "actual_output_pcs",
    "actual_pcs",
    "output_pcs",
    "hasil_pcs",
    "finished_good_qty",
    "qty_pcs",
    "qty",
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

  const locationId = session?.user?.location_id || "";
  const productionDate = preview.production_date;
  const chickenLotId = preview.selectedLot?.id || "";

  const totalAdukan = Number(preview.total_adukan || 0);
  const kgPerAdukan = Number(preview.kg_per_adukan || 30);
  const chickenKgUsed = Number(preview.planned_chicken_kg || 0);
  const plannedOutputPcs = Number(preview.planned_output_pcs || 0);
  const actualOutputPcs = Number(preview.actual_output_pcs || 0);
  const chickenUnitCost = Number(preview.selectedLot?.unit_cost || 0);
  const chickenCost = Number(preview.modal_ayam || 0);
  const chickenCostPerPcs = Number(preview.hpp_ayam_per_pcs || 0);

  const production = {
    location_id: locationId,
    production_date: productionDate,

    chicken_lot_id: chickenLotId,
    source_chicken_lot_id: chickenLotId,
    lot_id: chickenLotId,

    total_adukan: totalAdukan,
    jumlah_adukan: totalAdukan,
    adukan_qty: totalAdukan,
    adukan: totalAdukan,

    kg_per_adukan: kgPerAdukan,
    chicken_kg_used: chickenKgUsed,
    kg_ayam_dipakai: chickenKgUsed,
    used_kg: chickenKgUsed,
    raw_material_kg: chickenKgUsed,

    planned_output_pcs: plannedOutputPcs,
    actual_output_pcs: actualOutputPcs,
    output_pcs: actualOutputPcs,
    hasil_pcs: actualOutputPcs,
    finished_good_qty: actualOutputPcs,
    qty_pcs: actualOutputPcs,

    chicken_unit_cost: chickenUnitCost,
    unit_cost: chickenUnitCost,
    harga_ayam_per_kg: chickenUnitCost,

    chicken_cost: chickenCost,
    modal_ayam: chickenCost,
    batch_chicken_cost: chickenCost,
    estimated_chicken_cost_per_pcs: chickenCostPerPcs,

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
    note: preview.note,
  };

  return {
    production,

    // Alias top-level untuk backend lama/adapter yang baca field flat.
    location_id: locationId,
    production_date: productionDate,

    chicken_lot_id: chickenLotId,
    source_chicken_lot_id: chickenLotId,
    lot_id: chickenLotId,

    total_adukan: totalAdukan,
    jumlah_adukan: totalAdukan,
    adukan_qty: totalAdukan,
    adukan: totalAdukan,

    kg_per_adukan: kgPerAdukan,
    chicken_kg_used: chickenKgUsed,
    kg_ayam_dipakai: chickenKgUsed,
    used_kg: chickenKgUsed,
    raw_material_kg: chickenKgUsed,

    planned_output_pcs: plannedOutputPcs,
    actual_output_pcs: actualOutputPcs,
    output_pcs: actualOutputPcs,
    hasil_pcs: actualOutputPcs,
    finished_good_qty: actualOutputPcs,
    qty_pcs: actualOutputPcs,

    chicken_unit_cost: chickenUnitCost,
    unit_cost: chickenUnitCost,
    harga_ayam_per_kg: chickenUnitCost,

    chicken_cost: chickenCost,
    modal_ayam: chickenCost,
    batch_chicken_cost: chickenCost,
    estimated_chicken_cost_per_pcs: chickenCostPerPcs,

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

    output_unit: "pcs",

    notes: preview.note,
    note: preview.note,
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
  const [fallbackProducts, setFallbackProducts] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

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

  const rawProductionBatches = useMemo(() => {
    return asArray(bootstrap?.production_batches);
  }, [bootstrap?.production_batches]);
  const productionBatches = useMemo(() => {
    return cleanProductionBatches(rawProductionBatches);
  }, [rawProductionBatches]);
  const hiddenProductionRows = Math.max(0, rawProductionBatches.length - productionBatches.length);

  const summary = useMemo(() => {
    return buildSummary({
      ...(bootstrap || {}),
      production_batches: productionBatches,
      stock_movements: cleanStockMovements(bootstrap?.stock_movements),
    });
  }, [bootstrap, productionBatches]);

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
      source: "frontend_part_3b_2c_produk_hasil_adukan_fallback",
    });

    if (!result.success) {
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      setError(result.message || "Gagal membaca data Produksi / Adukan.");
      setBootstrap(null);
      setFallbackProducts([]);
      setLoading(false);
      return;
    }

    setBootstrap(result.data || {});
    setNeedsRefresh(false);

    const productResult = await getProducts(session?.sessionToken, {
      source: "frontend_part_3b_2c_produk_hasil_adukan_get_products",
    });

    if (productResult?.success) {
      const productRows = extractProductRows(productResult);

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
    setNeedsRefresh(true);
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
          row.actual_output_pcs ||
            row.actual_pcs ||
            row.output_pcs ||
            row.hasil_pcs ||
            row.finished_good_qty ||
            row.qty_pcs ||
            row.qty
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
        badge="Simpan Transaksi"
      />

      <ProductionFlowPanel
        session={session}
        onSessionExpired={onSessionExpired}
        compact
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

      {!error && hiddenProductionRows > 0 ? (
        <div className="da-form-warning" style={{ marginBottom: 16 }}>
          {hiddenProductionRows} baris kosong/formatting produksi disembunyikan supaya adukan tidak menampilkan angka yatim.
        </div>
      ) : null}

      {submitResult ? (
        <div
          className={submitResult.success ? "da-form-success" : "da-form-warning"}
          style={{ marginBottom: 16 }}
        >
          {submitResult.message}
          {submitResult.success && needsRefresh ? (
            <div style={{ marginTop: 6, fontWeight: 700 }}>
              Data sudah tersimpan cepat. Klik Refresh Data kalau mau tarik ulang lot ayam, batch produksi, dan stok jadi terbaru.
            </div>
          ) : null}
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
          description="Total adukan yang tercatat pada sistem."
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

          <Badge tone="danger">Transaksi Aktif</Badge>
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
                disabled={submitting || loading}
              >
                <option value="">
                  {loading
                    ? "Membaca produk..."
                    : productionProducts.length > 0
                      ? "Pilih produk hasil"
                      : "Produk belum terbaca"}
                </option>
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

            <Button type="submit" disabled={submitting || loading}>
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
              Klik baris untuk melihat detail: lot ayam, hasil pcs, modal ayam, gerak stok, dan arsip ID terkait.
            </p>
          </div>

          <Badge tone="warning">Data Aktual</Badge>
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
        subtitle="Konfirmasi posting produksi"
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

          <Badge tone="danger">Simpan Transaksi</Badge>
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
            <div className="da-mini-title">Hasil Transaksi Sistem</div>
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
          Setelah disimpan, sistem akan memotong kg ayam dari lot, membuat batch produksi,
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
            {submitting ? "Menyimpan..." : "Simpan Produksi"}
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
                      selectedBatch.actual_pcs ||
                      selectedBatch.output_pcs ||
                      selectedBatch.hasil_pcs ||
                      selectedBatch.finished_good_qty ||
                      selectedBatch.qty_pcs ||
                      selectedBatch.qty
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
                <p><strong>Produk:</strong> {safeText(selectedBatch.product_name || selectedBatch.output_product_name)}</p>
                <p><strong>Adukan:</strong> {safeText(selectedBatch.total_adukan || selectedBatch.adukan_qty || selectedBatch.adukan)}</p>
                <p><strong>Hasil pcs:</strong> {numberValue(selectedBatch.actual_output_pcs || selectedBatch.actual_pcs || selectedBatch.output_pcs || selectedBatch.hasil_pcs || selectedBatch.finished_good_qty || selectedBatch.qty_pcs || selectedBatch.qty).toLocaleString("id-ID")} pcs</p>
              </div>

              <div className="da-detail-box">
                <div className="da-mini-title">Ayam Dipakai</div>
                <p><strong>Kg:</strong> {numberValue(selectedBatch.chicken_kg_used || selectedBatch.used_kg || selectedBatch.kg_ayam_dipakai).toLocaleString("id-ID")} kg</p>
                <p><strong>Lot:</strong> {safeText(selectedBatch.chicken_lot_id || selectedBatch.lot_id)}</p>
                <p><strong>Modal ayam:</strong> {formatRupiah(selectedBatch.chicken_cost || selectedBatch.modal_ayam || selectedBatch.total_batch_cost)}</p>
                <p><strong>Modal/pcs:</strong> {formatRupiah(selectedBatch.hpp_per_pcs || selectedBatch.estimated_chicken_cost_per_pcs)}</p>
              </div>

              <div className="da-detail-box">
                <div className="da-mini-title">Rantai ID</div>
                <p><strong>Produksi:</strong> {safeText(selectedBatch.production_id || selectedBatch.batch_id)}</p>
                <p><strong>Lot ayam:</strong> {safeText(selectedBatch.chicken_lot_id || selectedBatch.lot_id)}</p>
                <p><strong>Gerak stok:</strong> {safeText(selectedBatch.stock_movement_id || selectedBatch.finished_stock_movement_id || selectedBatch.movement_id)}</p>
                <p><strong>Layer modal:</strong> {safeText(selectedBatch.cost_layer_id || selectedBatch.finished_cost_layer_id || selectedBatch.layer_id)}</p>
              </div>
            </div>

            <div className="da-modal-note" style={{ marginTop: 14 }}>
              Rantai ini harus bisa ditelusuri: Lot Ayam → Produksi/Adukan → Gerak Stok IN → Stok Jadi → Order/Kasir.
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
