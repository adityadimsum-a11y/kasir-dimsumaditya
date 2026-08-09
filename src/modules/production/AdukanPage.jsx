import { useEffect, useMemo, useState } from "react";
import { Factory, Layers, PackageCheck, Plus, RefreshCw, Scale } from "lucide-react";
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
  support_cost_total: "",
  support_cost_note: "",
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
    adukan_conversion_active: Number(row.adukan_conversion_active ?? row.uses_adukan ?? 0) === 1,
    chicken_kg_per_adukan: numberValue(row.chicken_kg_per_adukan || row.ayam_kg_per_adukan),
    default_yield_pcs: numberValue(row.default_yield_pcs || row.estimated_pcs_per_adukan || row.target_pcs_per_adukan),
    chicken_bag_kg: numberValue(row.chicken_bag_kg || row.ayam_kg_per_kantong),
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
      adukan_conversion_active:
        product.adukan_conversion_active || existing.adukan_conversion_active,
      chicken_kg_per_adukan:
        product.chicken_kg_per_adukan || existing.chicken_kg_per_adukan,
      default_yield_pcs:
        product.default_yield_pcs || existing.default_yield_pcs,
      chicken_bag_kg:
        product.chicken_bag_kg || existing.chicken_bag_kg,
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

  const configured = uniqueProducts.filter(
    (product) =>
      product.adukan_conversion_active &&
      product.chicken_kg_per_adukan > 0 &&
      product.default_yield_pcs > 0
  );

  if (configured.length > 0) return configured;

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

function buildProductionPreview(form, lots, people, products, fallbackConversion = {}) {
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

  const kgPerAdukan =
    numberValue(selectedProduct?.chicken_kg_per_adukan) ||
    numberValue(fallbackConversion?.chicken_kg_per_adukan);
  const pcsPerAdukan =
    numberValue(selectedProduct?.default_yield_pcs) ||
    numberValue(fallbackConversion?.estimated_pcs_per_adukan);
  const bagKg =
    numberValue(selectedProduct?.chicken_bag_kg) ||
    numberValue(fallbackConversion?.chicken_bag_kg);

  const plannedChickenKg = totalAdukan * kgPerAdukan;
  const plannedOutputPcs = totalAdukan * pcsPerAdukan;
  const actualOutputPcs = numberValue(form.actual_output_pcs);
  const supportCostTotal = numberValue(form.support_cost_total);

  const modalAyam = selectedLot ? plannedChickenKg * selectedLot.unit_cost : 0;
  const totalBatchCost = modalAyam + supportCostTotal;
  const hppAyamPerPcs =
    actualOutputPcs > 0 ? modalAyam / actualOutputPcs : 0;
  const hppBatchPerPcs =
    actualOutputPcs > 0 ? totalBatchCost / actualOutputPcs : 0;

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
    chicken_bag_kg: bagKg,
    pcs_per_adukan: pcsPerAdukan,
    planned_chicken_kg: plannedChickenKg,
    planned_output_pcs: plannedOutputPcs,
    actual_output_pcs: actualOutputPcs,
    variance_pcs: actualOutputPcs - plannedOutputPcs,
    modal_ayam: modalAyam,
    support_cost_total: supportCostTotal,
    support_cost_note: String(form.support_cost_note || "").trim(),
    total_batch_cost: totalBatchCost,
    hpp_ayam_per_pcs: hppAyamPerPcs,
    hpp_batch_per_pcs: hppBatchPerPcs,
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
  const kgPerAdukan = Number(preview.kg_per_adukan || 0);
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
    support_cost_total: Number(preview.support_cost_total || 0),
    support_cost_note: preview.support_cost_note || "",
    total_batch_cost: Number(preview.total_batch_cost || 0),

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
    support_cost_total: Number(preview.support_cost_total || 0),
    support_cost_note: preview.support_cost_note || "",
    total_batch_cost: Number(preview.total_batch_cost || 0),

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
  if (preview.kg_per_adukan <= 0 || preview.pcs_per_adukan <= 0 || preview.chicken_bag_kg <= 0) {
    errors.push("Standar produksi produk belum lengkap di Master Produk.");
  }
  if (preview.planned_chicken_kg <= 0) errors.push("Kg ayam dipakai harus lebih dari 0.");
  if (preview.selectedLot && preview.planned_chicken_kg > preview.selectedLot.remaining_kg) {
    errors.push("Kg ayam dipakai melebihi sisa kg di lot ayam.");
  }
  if (preview.actual_output_pcs <= 0) errors.push("Hasil fisik aktual wajib diisi dan harus lebih dari 0 pcs.");
  if (preview.support_cost_total > 0 && !preview.support_cost_note) {
    errors.push("Catatan biaya pendukung wajib diisi jika ada biaya pendukung.");
  }

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
  const [entryOpen, setEntryOpen] = useState(false);
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
    return buildProductionPreview(
      form,
      lots,
      productionPeople,
      productionProducts,
      bootstrap?.conversion || {}
    );
  }, [form, lots, productionPeople, productionProducts, bootstrap?.conversion]);

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
      source: "production_workspace",
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
    setEntryOpen(false);
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

  const primaryKgPerAdukan =
    numberValue(productionProducts[0]?.chicken_kg_per_adukan) ||
    numberValue(bootstrap?.conversion?.chicken_kg_per_adukan);
  const estimatedBatchCapacity =
    primaryKgPerAdukan > 0
      ? Math.floor(summary.totalKgAvailable / primaryKgPerAdukan)
      : 0;
  const recentColumns = [
    { key: "production_date", label: "Tanggal", render: (row) => formatDisplayDate(row.production_date || row.date) },
    { key: "product", label: "Produk", render: (row) => <strong>{safeText(row.product_name || row.output_product_name || row.item_name, "Hasil produksi")}</strong> },
    { key: "adukan", label: "Adukan", render: (row) => `${numberValue(row.total_adukan || row.adukan_qty || row.adukan).toLocaleString("id-ID")}x` },
    { key: "kg", label: "Ayam", render: (row) => `${numberValue(row.chicken_kg_used || row.used_kg || row.raw_material_kg).toLocaleString("id-ID")} kg` },
    { key: "pcs", label: "Hasil", render: (row) => `${numberValue(row.actual_output_pcs || row.actual_pcs || row.output_pcs || row.hasil_pcs || row.finished_good_qty || row.qty_pcs || row.qty).toLocaleString("id-ID")} pcs` },
    { key: "status", label: "Status", render: (row) => <Badge tone={getStatusTone(row.status)}>{safeText(row.status || "Tercatat")}</Badge> },
  ];

  return (
    <div className="da-page da-production-workspace-v6">
      <PageHeader
        title="Produksi / Adukan"
        eyebrow="Produksi & Stok"
        description="Kelola proses produksi dari pemakaian ayam sampai hasil barang jadi masuk ke stok."
        actions={(
          <div className="da-prod-page-actions-v6">
            <Button variant="secondary" onClick={loadData} disabled={loading || submitting}><RefreshCw size={15} /> {loading ? "Memuat" : "Perbarui"}</Button>
            <Button onClick={() => setEntryOpen(true)}><Plus size={16} /> Catat Produksi</Button>
          </div>
        )}
      />

      <ProductionFlowPanel activeStep={2} />

      {error ? <div className="da-prod-public-alert-v6 is-error">{error}</div> : null}
      {submitResult?.success ? <div className="da-prod-public-alert-v6 is-success">{submitResult.message}</div> : null}

      <section className="da-prod-kpi-grid-v6">
        <div className="da-prod-kpi-v6 tone-primary"><span className="icon"><Scale size={17} /></span><div><small>Ayam Tersedia</small><strong>{summary.totalKgAvailable.toLocaleString("id-ID")} kg</strong><p>{summary.activeLotCount} lot aktif</p></div></div>
        <div className="da-prod-kpi-v6"><span className="icon"><Factory size={17} /></span><div><small>Produksi Tercatat</small><strong>{summary.batchCount}</strong><p>{summary.totalAdukan} adukan</p></div></div>
        <div className="da-prod-kpi-v6"><span className="icon"><PackageCheck size={17} /></span><div><small>Hasil Produksi</small><strong>{summary.totalOutputPcs.toLocaleString("id-ID")} pcs</strong><p>Barang jadi tercatat</p></div></div>
        <div className="da-prod-kpi-v6 tone-warning"><span className="icon"><Layers size={17} /></span><div><small>Kapasitas Bahan</small><strong>{estimatedBatchCapacity} adukan</strong><p>Estimasi dari sisa ayam</p></div></div>
      </section>

      <section className="da-prod-main-grid-v6">
        <Card
          className="da-prod-primary-panel-v6"
          title="Produksi Terbaru"
          description="Batch produksi terakhir. Klik baris untuk melihat rincian hasil dan bahan yang dipakai."
          action={<Button variant="secondary" onClick={() => setEntryOpen(true)}><Plus size={14} /> Produksi Baru</Button>}
        >
          <DataTable
            columns={recentColumns}
            rows={productionBatches.slice(0, 10)}
            getRowKey={(row, index) => row.production_id || row.batch_id || index}
            onRowClick={setSelectedBatch}
          />
          {!productionBatches.length ? <div className="da-prod-empty-v6">Belum ada produksi yang tercatat.</div> : null}
        </Card>

        <Card className="da-prod-side-panel-v6" title="Kapasitas Produksi" description="Ringkasan bahan dan potensi produksi dari stok ayam saat ini.">
          <div className="da-prod-side-total-v6">
            <span>Sisa ayam</span>
            <strong>{summary.totalKgAvailable.toLocaleString("id-ID")} kg</strong>
            <small>Perkiraan maksimal {estimatedBatchCapacity} adukan</small>
          </div>
          <div className="da-prod-side-list-v6">
            <div><span>Lot aktif</span><strong>{summary.activeLotCount}</strong></div>
            <div><span>Produk produksi</span><strong>{productionProducts.length}</strong></div>
            <div><span>Gerak stok</span><strong>{summary.stockMovementCount}</strong></div>
            <div><span>Hasil tercatat</span><strong>{summary.totalOutputPcs.toLocaleString("id-ID")} pcs</strong></div>
          </div>
          <div className="da-prod-lot-list-v6">
            <span className="label">Lot bahan tersedia</span>
            {lots.slice(0, 4).map((lot) => (
              <div key={lot.id}><span>{lot.label}</span><strong>{lot.remaining_kg.toLocaleString("id-ID")} kg</strong></div>
            ))}
            {!lots.length ? <small>Belum ada lot bahan aktif.</small> : null}
          </div>
        </Card>
      </section>

      <Card className="da-prod-history-panel-v6" title="Riwayat Produksi" description="Seluruh produksi yang tercatat pada sistem.">
        <DataTable columns={columns} rows={productionBatches} getRowKey={(row, index) => row.production_id || row.batch_id || index} onRowClick={setSelectedBatch} />
      </Card>

      <Modal open={entryOpen} title="Catat Produksi" subtitle="Masukkan hasil produksi sesuai aktivitas dapur." onClose={() => { if (!submitting) setEntryOpen(false); }} size="xl">
        <form onSubmit={handlePreviewSubmit} className="da-prod-form-modal-v6">
          <div className="da-prod-form-grid-v6 is-production">
            <div className="da-drop-form-preview">
              <div className="da-drop-field"><label>Tanggal Produksi</label><input type="date" className="da-input" value={form.production_date} onChange={(event) => updateForm("production_date", event.target.value)} disabled={submitting} /></div>
              <div className="da-drop-field"><label>Lot Ayam</label><select className="da-select" value={form.chicken_lot_id} onChange={(event) => updateForm("chicken_lot_id", event.target.value)} disabled={submitting}><option value="">Pilih lot ayam</option>{lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.label} · sisa {lot.remaining_kg.toLocaleString("id-ID")} kg</option>)}</select></div>
              <div className="da-drop-field"><label>PIC Produksi</label>{productionPeople.length > 0 ? <select className="da-select" value={form.production_pic_id} onChange={(event) => { updateForm("production_pic_id", event.target.value); updateForm("production_pic_name", ""); }} disabled={submitting}><option value="">Pilih PIC produksi</option>{productionPeople.map((person) => <option key={person.id || person.name} value={person.id}>{person.name}{person.role ? ` · ${person.role}` : ""}</option>)}</select> : <input className="da-input" value={form.production_pic_name} placeholder="Nama PIC produksi" onChange={(event) => { updateForm("production_pic_name", event.target.value); updateForm("production_pic_id", ""); }} disabled={submitting} />}</div>
              <div className="da-drop-field"><label>Produk Hasil</label><select className="da-select" value={form.output_product_id} onChange={(event) => { const product = productionProducts.find((item) => item.id === event.target.value); updateForm("output_product_id", event.target.value); updateForm("output_product_code", product?.code || ""); updateForm("output_product_name", product?.name || ""); }} disabled={submitting || loading}><option value="">Pilih produk hasil</option>{productionProducts.map((product) => <option key={product.id || product.code} value={product.id}>{product.name}{product.code ? ` · ${product.code}` : ""}</option>)}</select></div>
              <div className="da-drop-field"><label>Jumlah Adukan</label><input className="da-input" inputMode="decimal" value={form.total_adukan} placeholder="0" onChange={(event) => updateForm("total_adukan", event.target.value)} disabled={submitting} /></div>
              <div className="da-drop-field"><label>Hasil Fisik Aktual</label><input className="da-input" inputMode="numeric" value={form.actual_output_pcs} placeholder="Wajib isi jumlah pcs nyata" onChange={(event) => updateForm("actual_output_pcs", event.target.value)} disabled={submitting} /></div>
              <div className="da-drop-field"><label>Biaya Pendukung Terpakai</label><input className="da-input" inputMode="numeric" value={form.support_cost_total} placeholder="0 (opsional)" onChange={(event) => updateForm("support_cost_total", event.target.value)} disabled={submitting} /><small className="da-prod-field-help-v9">Tidak memotong dompet lagi. Isi hanya biaya nyata yang dikapitalisasi ke batch.</small></div>
              <div className="da-drop-field"><label>Dasar Biaya Pendukung</label><input className="da-input" value={form.support_cost_note} placeholder="Contoh: bahan pendukung produksi hari ini" onChange={(event) => updateForm("support_cost_note", event.target.value)} disabled={submitting} /></div>
              <div className="da-drop-field da-drop-field-wide"><label>Catatan Produksi</label><input className="da-input" value={form.note} placeholder="Catatan produksi" onChange={(event) => updateForm("note", event.target.value)} disabled={submitting} /></div>
            </div>

            <div className="da-prod-production-preview-v6">
              <span>Ringkasan Produksi</span>
              <strong>{preview.actual_output_pcs.toLocaleString("id-ID")} pcs</strong>
              <div><span>Target hasil</span><b>{preview.planned_output_pcs.toLocaleString("id-ID")} pcs</b></div>
              <div><span>Ayam dipakai</span><b>{preview.planned_chicken_kg.toLocaleString("id-ID")} kg</b></div>
              <div><span>Standar batch</span><b>{preview.kg_per_adukan || 0} kg → {preview.pcs_per_adukan || 0} pcs</b></div>
              <div><span>Modal batch</span><b>{formatRupiah(preview.total_batch_cost)}</b></div>
              <div><span>HPP / pcs</span><b>{formatRupiah(preview.hpp_batch_per_pcs)}</b></div>
              <div><span>Produk</span><b>{safeText(preview.outputProduct?.name, "Belum dipilih")}</b></div>
            </div>
          </div>
          {showValidationErrors && validationErrors.length > 0 ? <div className="da-prod-public-alert-v6 is-error">{validationErrors.join(" ")}</div> : null}
          <div className="da-prod-modal-actions-v6"><Button type="button" variant="ghost" onClick={handleResetForm} disabled={submitting}>Kosongkan</Button><Button type="submit" disabled={submitting || loading}>Lanjutkan</Button></div>
        </form>
      </Modal>

      <Modal open={confirmOpen} title="Konfirmasi Produksi" subtitle="Periksa bahan dan hasil sebelum disimpan." onClose={() => { if (!submitting) setConfirmOpen(false); }}>
        <div className="da-prod-detail-v6">
          <div className="da-modal-summary"><div><div className="da-mini-title">Hasil Produksi</div><div className="da-big-text">{preview.actual_output_pcs.toLocaleString("id-ID")} pcs</div><p className="da-muted">{safeText(preview.outputProduct?.name, "Produk belum dipilih")}</p></div><Badge tone="warning">Siap Disimpan</Badge></div>
          <div className="da-prod-detail-grid-v6">
            <div><span>Ayam dipakai</span><strong>{preview.planned_chicken_kg.toLocaleString("id-ID")} kg</strong></div>
            <div><span>Target hasil</span><strong>{preview.planned_output_pcs.toLocaleString("id-ID")} pcs</strong></div>
            <div><span>Selisih hasil</span><strong>{preview.variance_pcs.toLocaleString("id-ID")} pcs</strong></div>
            <div><span>Lot ayam</span><strong>{safeText(preview.selectedLot?.label)}</strong></div>
            <div><span>PIC produksi</span><strong>{safeText(preview.productionPic?.name)}</strong></div>
            <div><span>Modal ayam</span><strong>{formatRupiah(preview.modal_ayam)}</strong></div>
            <div><span>Biaya pendukung</span><strong>{formatRupiah(preview.support_cost_total)}</strong></div>
            <div><span>Total modal batch</span><strong>{formatRupiah(preview.total_batch_cost)}</strong></div>
            <div><span>HPP / pcs</span><strong>{formatRupiah(preview.hpp_batch_per_pcs)}</strong></div>
          </div>
          <div className="da-prod-confirm-note-v6">Setelah disimpan, persediaan ayam akan berkurang dan hasil produksi akan masuk ke stok barang jadi secara otomatis.</div>
          {submitResult && !submitResult.success ? <div className="da-prod-public-alert-v6 is-error">{submitResult.message}</div> : null}
          <div className="da-prod-modal-actions-v6"><Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={submitting}>Kembali</Button><Button onClick={handleLiveSubmit} disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan Produksi"}</Button></div>
        </div>
      </Modal>

      <Modal open={Boolean(selectedBatch)} title="Detail Produksi" subtitle={selectedBatch?.production_id || selectedBatch?.batch_id || ""} onClose={() => setSelectedBatch(null)}>
        {selectedBatch ? (
          <div className="da-prod-detail-v6">
            <div className="da-modal-summary"><div><div className="da-mini-title">Hasil Produksi</div><div className="da-big-text">{numberValue(selectedBatch.actual_output_pcs || selectedBatch.actual_pcs || selectedBatch.output_pcs || selectedBatch.hasil_pcs || selectedBatch.finished_good_qty || selectedBatch.qty_pcs || selectedBatch.qty).toLocaleString("id-ID")} pcs</div><p className="da-muted">{safeText(selectedBatch.product_name || selectedBatch.output_product_name || selectedBatch.item_name, "Hasil produksi")}</p></div><Badge tone={getStatusTone(selectedBatch.status)}>{safeText(selectedBatch.status || "Tercatat")}</Badge></div>
            <div className="da-prod-detail-grid-v6">
              <div><span>Tanggal</span><strong>{formatDisplayDate(selectedBatch.production_date || selectedBatch.date)}</strong></div>
              <div><span>Lot ayam</span><strong>{safeText(selectedBatch.chicken_lot_id || selectedBatch.lot_id)}</strong></div>
              <div><span>Adukan</span><strong>{numberValue(selectedBatch.total_adukan || selectedBatch.adukan_qty || selectedBatch.adukan).toLocaleString("id-ID")}</strong></div>
              <div><span>Ayam dipakai</span><strong>{numberValue(selectedBatch.chicken_kg_used || selectedBatch.used_kg || selectedBatch.raw_material_kg).toLocaleString("id-ID")} kg</strong></div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );

}
