import React, { useMemo, useState } from 'react';
import {
  ClipboardList,
  Plus,
  Save,
  X,
  Edit2,
  Trash2,
  Power,
  RotateCcw,
  Search,
  Filter,
  Copy,
  GitBranch,
  Building2,
  Warehouse,
  Package,
  PackageCheck,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Scale,
  ReceiptText,
  TrendingUp,
  History,
  Crown,
  BadgeDollarSign,
  Factory,
  Store,
  ShoppingBag,
  Users,
  Layers,
  Calculator,
  FlaskConical,
} from 'lucide-react';

import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import erpOrchestrator from '../../services/erpOrchestrator';
import { validateBom, createBomSnapshot, getActiveBom } from '../../utils/bomEngine';
import { calculateProductionHpp, calculatePerPcsCost } from '../../utils/hppEngine';
import { listKnownUnits } from '../../utils/conversionEngine';

const RECIPE_TABLE_NAME = 'master_recipe_bom';

const RECIPE_TYPES = [
  'PRODUKSI',
  'RESTO',
  'MERCHANT',
  'FRANCHISE',
];

const RECIPE_STATUS = [
  'ACTIVE',
  'NON_ACTIVE',
];

const DEFAULT_UNIT_OPTIONS = [
  'KG',
  'GRAM',
  'PCS',
  'PACK',
  'DUS',
  'LITER',
  'ML',
];

const DEFAULT_FORM = {
  id: '',
  recipe_id: '',
  recipe_code: '',
  recipe_name: '',
  product_id: '',
  product_name: '',
  branch_id: '',
  version: 'V1',
  recipe_type: 'PRODUKSI',
  yield_qty: '',
  yield_unit: 'PCS',
  status: 'ACTIVE',
  effective_date: '',
  expired_date: '',
  notes: '',
  revision_of: '',
};

const DEFAULT_LINE_FORM = {
  line_id: '',
  raw_material_id: '',
  raw_material_name: '',
  warehouse_id: '',
  qty: '',
  unit: 'GRAM',
  conversion_rule_id: '',
  waste_percent: '',
  latest_cost: '',
  estimated_cost: '',
};

const normalizeCode = (value) => {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^\w./-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const normalizeText = (value) => {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
};

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === undefined || value === null || value === '') return 0;

  const parsed = Number(
    String(value)
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.'),
  );

  return Number.isFinite(parsed) ? parsed : 0;
};

const roundMoney = (value) => {
  return Math.round(toNumber(value) * 100) / 100;
};

const roundQty = (value) => {
  return Math.round(toNumber(value) * 1000) / 1000;
};

const formatMoney = (value) => {
  return `Rp${roundMoney(value).toLocaleString('id-ID')}`;
};

const formatQty = (value, unit = '') => {
  return `${roundQty(value).toLocaleString('id-ID')} ${unit || ''}`.trim();
};

const normalizeDate = (value) => {
  if (!value) return '';

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return raw.substring(0, 10);

  return parsed.toISOString().substring(0, 10);
};

const isSoftDeleted = (row) => {
  const value = row?.isDeleted ?? row?.is_deleted ?? row?.deleted;
  return value === true || String(value || '').toUpperCase() === 'TRUE';
};

const normalizeStatus = (row) => {
  if (isSoftDeleted(row)) return 'SOFT_DELETED';

  const value = row?.status ?? row?.recipe_status ?? row?.status_active ?? row?.is_active;

  if (value === false) return 'NON_ACTIVE';
  if (value === true) return 'ACTIVE';

  const normalized = normalizeCode(value || 'ACTIVE');

  if (['NON_ACTIVE', 'NONAKTIF', 'INACTIVE', 'DISABLED', 'FALSE', 'NO', 'N', '0'].includes(normalized)) {
    return 'NON_ACTIVE';
  }

  return 'ACTIVE';
};

const parseJson = (value, fallback = null) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(String(value));
  } catch (error) {
    return fallback;
  }
};

const getRawRecipeRows = ({
  masterRecipeBom,
  master_recipe_bom,
  recipeBom,
  recipe_bom,
  bom,
  recipes,
  dbData,
}) => {
  if (Array.isArray(master_recipe_bom)) return master_recipe_bom;
  if (Array.isArray(masterRecipeBom)) return masterRecipeBom;
  if (Array.isArray(recipe_bom)) return recipe_bom;
  if (Array.isArray(recipeBom)) return recipeBom;
  if (Array.isArray(bom)) return bom;
  if (Array.isArray(recipes)) return recipes;

  if (Array.isArray(dbData?.master_recipe_bom)) return dbData.master_recipe_bom;
  if (Array.isArray(dbData?.masterRecipeBom)) return dbData.masterRecipeBom;
  if (Array.isArray(dbData?.recipe_bom)) return dbData.recipe_bom;
  if (Array.isArray(dbData?.recipeBom)) return dbData.recipeBom;
  if (Array.isArray(dbData?.bom)) return dbData.bom;
  if (Array.isArray(dbData?.recipes)) return dbData.recipes;

  return [];
};

const getRawProductRows = ({
  masterProducts,
  master_products,
  products,
  produk,
  dbData,
}) => {
  if (Array.isArray(master_products)) return master_products;
  if (Array.isArray(masterProducts)) return masterProducts;
  if (Array.isArray(products)) return products;
  if (Array.isArray(produk)) return produk;

  if (Array.isArray(dbData?.master_products)) return dbData.master_products;
  if (Array.isArray(dbData?.masterProducts)) return dbData.masterProducts;
  if (Array.isArray(dbData?.products)) return dbData.products;
  if (Array.isArray(dbData?.produk)) return dbData.produk;

  return [];
};

const getRawMaterialRows = ({
  masterRawMaterials,
  master_raw_materials,
  rawMaterials,
  raw_materials,
  bahan_baku,
  dbData,
}) => {
  if (Array.isArray(master_raw_materials)) return master_raw_materials;
  if (Array.isArray(masterRawMaterials)) return masterRawMaterials;
  if (Array.isArray(rawMaterials)) return rawMaterials;
  if (Array.isArray(raw_materials)) return raw_materials;
  if (Array.isArray(bahan_baku)) return bahan_baku;

  if (Array.isArray(dbData?.master_raw_materials)) return dbData.master_raw_materials;
  if (Array.isArray(dbData?.masterRawMaterials)) return dbData.masterRawMaterials;
  if (Array.isArray(dbData?.rawMaterials)) return dbData.rawMaterials;
  if (Array.isArray(dbData?.raw_materials)) return dbData.raw_materials;
  if (Array.isArray(dbData?.bahan_baku)) return dbData.bahan_baku;

  return [];
};

const getRawBranchRows = ({
  masterBranches,
  master_branches,
  master_branch,
  branches,
  dbData,
}) => {
  if (Array.isArray(master_branches)) return master_branches;
  if (Array.isArray(masterBranches)) return masterBranches;
  if (Array.isArray(master_branch)) return master_branch;
  if (Array.isArray(branches)) return branches;

  if (Array.isArray(dbData?.master_branches)) return dbData.master_branches;
  if (Array.isArray(dbData?.masterBranches)) return dbData.masterBranches;
  if (Array.isArray(dbData?.master_branch)) return dbData.master_branch;
  if (Array.isArray(dbData?.branches)) return dbData.branches;

  return [];
};

const getRawWarehouseRows = ({
  masterWarehouses,
  master_warehouses,
  masterLocations,
  master_locations,
  warehouses,
  locations,
  dbData,
}) => {
  if (Array.isArray(master_warehouses)) return master_warehouses;
  if (Array.isArray(masterWarehouses)) return masterWarehouses;
  if (Array.isArray(master_locations)) return master_locations;
  if (Array.isArray(masterLocations)) return masterLocations;
  if (Array.isArray(warehouses)) return warehouses;
  if (Array.isArray(locations)) return locations;

  if (Array.isArray(dbData?.master_warehouses)) return dbData.master_warehouses;
  if (Array.isArray(dbData?.masterWarehouses)) return dbData.masterWarehouses;
  if (Array.isArray(dbData?.master_locations)) return dbData.master_locations;
  if (Array.isArray(dbData?.masterLocations)) return dbData.masterLocations;
  if (Array.isArray(dbData?.warehouses)) return dbData.warehouses;
  if (Array.isArray(dbData?.locations)) return dbData.locations;

  return [];
};

const getRawConversionRules = ({
  masterConversionRules,
  master_conversion_rules,
  conversionRules,
  conversion_rules,
  dbData,
}) => {
  if (Array.isArray(master_conversion_rules)) return master_conversion_rules;
  if (Array.isArray(masterConversionRules)) return masterConversionRules;
  if (Array.isArray(conversion_rules)) return conversion_rules;
  if (Array.isArray(conversionRules)) return conversionRules;

  if (Array.isArray(dbData?.master_conversion_rules)) return dbData.master_conversion_rules;
  if (Array.isArray(dbData?.masterConversionRules)) return dbData.masterConversionRules;
  if (Array.isArray(dbData?.conversion_rules)) return dbData.conversion_rules;
  if (Array.isArray(dbData?.conversionRules)) return dbData.conversionRules;

  return [];
};

const normalizeBranchDisplay = (record) => {
  const raw = record?.raw || record || {};

  const branchId = String(
    raw.branch_id ||
    raw.branchId ||
    record?.id ||
    raw.id ||
    '',
  ).trim();

  return {
    id: String(raw.id || branchId).trim(),
    branch_id: branchId,
    branch_code: String(raw.branch_code || raw.branchCode || raw.code || branchId || '').trim(),
    branch_name: String(raw.branch_name || raw.branchName || raw.nama_cabang || raw.name || record?.name || branchId || '').trim(),
    branch_type: normalizeCode(raw.branch_type || raw.branchType || raw.type || ''),
    status: normalizeStatus({
      status: raw.branch_status || raw.status,
      is_active: raw.is_active,
      isDeleted: raw.isDeleted,
    }),
    isDeleted: isSoftDeleted(raw),
    raw,
  };
};

const normalizeWarehouseDisplay = (record) => {
  const raw = record?.raw || record || {};

  const warehouseId = String(
    raw.warehouse_id ||
    raw.warehouseId ||
    raw.location_id ||
    raw.locationId ||
    record?.id ||
    raw.id ||
    '',
  ).trim();

  return {
    id: String(raw.id || warehouseId).trim(),
    warehouse_id: warehouseId,
    warehouse_code: String(raw.warehouse_code || raw.warehouseCode || raw.location_code || raw.locationCode || raw.code || warehouseId || '').trim(),
    warehouse_name: String(raw.warehouse_name || raw.warehouseName || raw.location_name || raw.locationName || raw.nama_gudang || raw.name || record?.name || '').trim(),
    warehouse_type: normalizeCode(raw.warehouse_type || raw.warehouseType || raw.location_type || raw.type || 'RAW_MATERIAL'),
    branch_id: String(raw.branch_id || raw.branchId || raw.scope_branch_id || record?.branch_id || '').trim(),
    status: normalizeStatus(raw),
    isDeleted: isSoftDeleted(raw),
    raw,
  };
};

const normalizeProductDisplay = (record) => {
  const raw = record?.raw || record || {};

  const productId = String(
    raw.product_id ||
    raw.productId ||
    raw.item_id ||
    raw.itemId ||
    record?.id ||
    raw.id ||
    '',
  ).trim();

  return {
    id: String(raw.id || productId).trim(),
    product_id: productId,
    product_code: String(raw.product_code || raw.productCode || raw.item_code || raw.sku || raw.code || productId || '').trim(),
    product_name: String(raw.product_name || raw.productName || raw.item_name || raw.nama_produk || raw.name || record?.name || '').trim(),
    product_category: normalizeCode(raw.product_category || raw.productCategory || raw.category || raw.kategori || 'UMUM'),
    branch_id: String(raw.branch_id || raw.branchId || record?.branch_id || '').trim(),
    default_warehouse_id: String(raw.default_warehouse_id || raw.warehouse_id || raw.warehouseId || '').trim(),
    selling_unit: normalizeCode(raw.selling_unit || raw.sellingUnit || raw.unit || raw.satuan || 'PCS'),
    production_unit: normalizeCode(raw.production_unit || raw.productionUnit || raw.unit || raw.satuan || 'PCS'),
    selling_price: roundMoney(raw.selling_price || raw.price || raw.harga_jual || 0),
    current_hpp: roundMoney(raw.current_hpp || raw.hpp || raw.current_cost || 0),
    status: normalizeStatus(raw),
    isDeleted: isSoftDeleted(raw),
    raw,
  };
};

const normalizeMaterialDisplay = (record) => {
  const raw = record?.raw || record || {};

  const materialId = String(
    raw.raw_material_id ||
    raw.rawMaterialId ||
    raw.material_id ||
    raw.item_id ||
    raw.itemId ||
    record?.id ||
    raw.id ||
    '',
  ).trim();

  return {
    id: String(raw.id || materialId).trim(),
    raw_material_id: materialId,
    raw_material_code: String(raw.raw_material_code || raw.material_code || raw.item_code || raw.sku || raw.code || materialId || '').trim(),
    raw_material_name: String(raw.raw_material_name || raw.material_name || raw.item_name || raw.nama_bahan || raw.name || record?.name || '').trim(),
    category: normalizeCode(raw.category || raw.kategori || 'UMUM'),
    branch_id: String(raw.branch_id || raw.branchId || record?.branch_id || '').trim(),
    default_warehouse_id: String(raw.default_warehouse_id || raw.warehouse_id || raw.warehouseId || '').trim(),
    base_unit: normalizeCode(raw.base_unit || raw.unit || raw.satuan || ''),
    purchase_unit: normalizeCode(raw.purchase_unit || raw.purchaseUnit || raw.unit_beli || raw.unit || ''),
    production_unit: normalizeCode(raw.production_unit || raw.productionUnit || raw.unit_produksi || raw.unit || ''),
    conversion_rule_id: String(raw.conversion_rule_id || raw.rule_id || '').trim(),
    preferred_supplier_id: String(raw.preferred_supplier_id || raw.supplier_id || '').trim(),
    latest_cost: roundMoney(raw.latest_cost || raw.last_cost || raw.harga_terakhir || raw.average_cost || raw.avg_cost || 0),
    average_cost: roundMoney(raw.average_cost || raw.avg_cost || 0),
    status: normalizeStatus(raw),
    isDeleted: isSoftDeleted(raw),
    raw,
  };
};

const normalizeConversionRuleDisplay = (record) => {
  const raw = record?.raw || record || {};

  const ruleId = String(
    raw.rule_id ||
    raw.ruleId ||
    raw.conversion_rule_id ||
    raw.conversionRuleId ||
    raw.conversion_id ||
    raw.id ||
    '',
  ).trim();

  const fromUnit = normalizeCode(raw.from_unit || raw.fromUnit || raw.unit_from || raw.dari_satuan || '');
  const toUnit = normalizeCode(raw.to_unit || raw.toUnit || raw.unit_to || raw.ke_satuan || '');
  const factor = toNumber(raw.factor || raw.conversion_factor || raw.ratio || raw.nilai || 0);

  return {
    id: ruleId,
    rule_id: ruleId,
    code: String(raw.rule_code || raw.code || ruleId || '').trim(),
    name: String(raw.rule_name || raw.name || `${fromUnit || '-'} → ${toUnit || '-'}`).trim(),
    from_unit: fromUnit,
    to_unit: toUnit,
    factor,
    branch_id: String(raw.branch_id || raw.branchId || '').trim(),
    status: normalizeStatus(raw),
    isDeleted: isSoftDeleted(raw),
    raw,
  };
};

const normalizeBomLine = (line = {}, index = 0) => {
  const materialId = String(line.raw_material_id || line.rawMaterialId || line.material_id || line.item_id || '').trim();
  const qty = roundQty(line.qty || line.quantity || 0);
  const wastePercent = toNumber(line.waste_percent || line.wastePercent || 0);
  const latestCost = roundMoney(line.latest_cost || line.latestCost || line.unit_cost || line.cost || 0);
  const estimatedCost = roundMoney(
    line.estimated_cost ||
    line.estimatedCost ||
    qty * (1 + wastePercent / 100) * latestCost,
  );

  return {
    line_id: String(line.line_id || line.lineId || generateId(`BOM-L${index + 1}`, getTodayStr())).trim(),
    raw_material_id: materialId,
    raw_material_name: String(line.raw_material_name || line.rawMaterialName || line.material_name || line.item_name || '').trim(),
    warehouse_id: String(line.warehouse_id || line.warehouseId || '').trim(),
    qty,
    unit: normalizeCode(line.unit || line.satuan || ''),
    conversion_rule_id: String(line.conversion_rule_id || line.conversionRuleId || line.rule_id || '').trim(),
    waste_percent: wastePercent,
    latest_cost: latestCost,
    estimated_cost: estimatedCost,
  };
};

const normalizeRecipeDisplay = (record) => {
  const raw = record?.raw || record || {};

  const recipeId = String(
    raw.recipe_id ||
    raw.recipeId ||
    raw.bom_id ||
    raw.bomId ||
    record?.id ||
    raw.id ||
    '',
  ).trim();

  const recipeCode = String(
    raw.recipe_code ||
    raw.recipeCode ||
    raw.bom_code ||
    raw.bomCode ||
    raw.code ||
    record?.code ||
    recipeId ||
    '',
  ).trim();

  const productId = String(raw.product_id || raw.productId || raw.item_id || raw.itemId || '').trim();

  const bomLines = raw.bom_lines ||
    raw.bomLines ||
    raw.recipe_lines ||
    raw.recipeLines ||
    raw.details ||
    raw.items ||
    parseJson(raw.bom_lines_json, []) ||
    parseJson(raw.bomLinesJson, []) ||
    parseJson(raw.details_json, []) ||
    [];

  const status = normalizeStatus(raw);

  return {
    id: String(raw.id || recipeId).trim(),

    recipe_id: recipeId,
    recipe_code: recipeCode,
    recipe_name: String(raw.recipe_name || raw.recipeName || raw.bom_name || raw.name || record?.name || '').trim(),

    product_id: productId,
    product_name: String(raw.product_name || raw.productName || raw.item_name || raw.itemName || '').trim(),

    branch_id: String(raw.branch_id || raw.branchId || record?.branch_id || '').trim(),

    version: String(raw.version || raw.recipe_version || raw.recipeVersion || 'V1').trim(),
    recipe_type: normalizeCode(raw.recipe_type || raw.recipeType || raw.type || 'PRODUKSI'),

    yield_qty: roundQty(raw.yield_qty || raw.yieldQty || raw.output_qty || raw.target_qty || 0),
    yield_unit: normalizeCode(raw.yield_unit || raw.yieldUnit || raw.output_unit || raw.target_unit || 'PCS'),

    status,
    effective_date: normalizeDate(raw.effective_date || raw.effectiveDate || raw.start_date || raw.date || ''),
    expired_date: normalizeDate(raw.expired_date || raw.expiredDate || raw.end_date || ''),
    notes: String(raw.notes || raw.keterangan || raw.description || '').trim(),

    revision_of: String(raw.revision_of || raw.revisionOf || raw.previous_recipe_id || '').trim(),

    bom_lines: Array.isArray(bomLines)
      ? bomLines.map(normalizeBomLine)
      : [],

    created_at: raw.created_at || '',
    updated_at: raw.updated_at || '',
    date: raw.date || raw.created_at || raw.updated_at || '',

    isDeleted: isSoftDeleted(raw),

    search_text: normalizeText([
      recipeId,
      recipeCode,
      raw.recipe_name,
      raw.bom_name,
      productId,
      raw.product_name,
      raw.item_name,
      raw.branch_id,
      raw.version,
      raw.recipe_type,
    ].filter(Boolean).join(' ')),

    raw,
  };
};

const calculateBomEstimate = (form, lines, productRecords, masterSource) => {
  const safeLines = Array.isArray(lines) ? lines : [];
  const totalEstimatedCost = roundMoney(
    safeLines.reduce((sum, line) => {
      const qty = toNumber(line.qty);
      const wastePercent = toNumber(line.waste_percent);
      const latestCost = toNumber(line.latest_cost);
      const fallback = qty * (1 + wastePercent / 100) * latestCost;

      return sum + roundMoney(line.estimated_cost || fallback);
    }, 0),
  );

  const totalWasteQty = roundQty(
    safeLines.reduce((sum, line) => {
      return sum + toNumber(line.qty) * (toNumber(line.waste_percent) / 100);
    }, 0),
  );

  const yieldQty = toNumber(form.yield_qty);
  let hppPerUnit = yieldQty > 0 ? totalEstimatedCost / yieldQty : 0;

  try {
    const perPcs = calculatePerPcsCost({
      totalCost: totalEstimatedCost,
      total_cost: totalEstimatedCost,
      qty: yieldQty,
      quantity: yieldQty,
      yieldQty,
      yield_qty: yieldQty,
    });

    if (typeof perPcs === 'number') {
      hppPerUnit = perPcs;
    } else if (perPcs?.cost_per_pcs !== undefined) {
      hppPerUnit = perPcs.cost_per_pcs;
    } else if (perPcs?.hpp_per_pcs !== undefined) {
      hppPerUnit = perPcs.hpp_per_pcs;
    } else if (perPcs?.unit_cost !== undefined) {
      hppPerUnit = perPcs.unit_cost;
    }
  } catch (error) {
    hppPerUnit = yieldQty > 0 ? totalEstimatedCost / yieldQty : 0;
  }

  let hppEnginePreview = null;

  try {
    hppEnginePreview = calculateProductionHpp({
      recipe_id: form.recipe_id,
      recipe_code: form.recipe_code,
      recipe_name: form.recipe_name,
      product_id: form.product_id,
      product_name: form.product_name,
      branch_id: form.branch_id,
      targetYieldQty: yieldQty,
      targetYieldUnit: form.yield_unit,
      yield_qty: yieldQty,
      yield_unit: form.yield_unit,
      bom_rows: safeLines,
      bomRows: safeLines,
      bom: {
        ...form,
        bom_lines: safeLines,
      },
      source: masterSource,
      bomSource: masterSource,
      inventorySource: masterSource,
      rulesSource: masterSource,
    });
  } catch (error) {
    hppEnginePreview = null;
  }

  const product = productRecords.find((item) => item.product_id === form.product_id);
  const sellingPrice = roundMoney(product?.selling_price || 0);
  const estimatedMargin = sellingPrice > 0
    ? ((sellingPrice - hppPerUnit) / sellingPrice) * 100
    : 0;

  return {
    total_bahan_baku: safeLines.length,
    total_estimasi_biaya: roundMoney(totalEstimatedCost),
    estimasi_total_hpp: roundMoney(totalEstimatedCost),
    hpp_per_unit: roundMoney(hppPerUnit),
    total_waste_qty: totalWasteQty,
    selling_price: sellingPrice,
    estimasi_margin_percent: estimatedMargin,
    produk_terkait: product || null,
    hpp_engine_preview: hppEnginePreview,
  };
};

const getNextVersion = (version) => {
  const raw = String(version || 'V1').trim().toUpperCase();
  const match = raw.match(/V(\d+)$/);

  if (!match) return 'V2';

  return `V${Number(match[1]) + 1}`;
};

const applyVersionToCode = (code, nextVersion) => {
  const base = normalizeCode(code || 'RECIPE');

  if (/-V\d+$/i.test(base)) {
    return base.replace(/-V\d+$/i, `-${nextVersion}`);
  }

  if (/_V\d+$/i.test(base)) {
    return base.replace(/_V\d+$/i, `_${nextVersion}`);
  }

  return `${base}-${nextVersion}`;
};

const getRecipeTypeIcon = (type) => {
  const normalized = normalizeCode(type);

  if (normalized === 'PRODUKSI') return <Factory size={18} />;
  if (normalized === 'RESTO') return <Store size={18} />;
  if (normalized === 'MERCHANT') return <ShoppingBag size={18} />;
  if (normalized === 'FRANCHISE') return <Users size={18} />;

  return <ClipboardList size={18} />;
};

const Badge = ({ children, tone = 'slate' }) => {
  const toneMap = {
    red: 'bg-red-50 text-red-700 border-red-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
    dark: 'bg-slate-900 text-white border-slate-900',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border ${toneMap[tone] || toneMap.slate}`}>
      {children}
    </span>
  );
};

const StatCard = ({ title, value, icon, tone = 'white', subtitle = '' }) => {
  const toneMap = {
    red: 'bg-red-600 text-white',
    white: 'bg-white text-slate-800 border border-slate-100',
    gold: 'bg-amber-50 text-amber-800 border border-amber-100',
    dark: 'bg-slate-950 text-white',
  };

  return (
    <div className={`rounded-3xl p-5 shadow-sm ${toneMap[tone] || toneMap.white}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{title}</div>
          <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
          {subtitle && (
            <div className="mt-1 text-[11px] font-bold opacity-70">{subtitle}</div>
          )}
        </div>
        <div className="p-3 rounded-2xl bg-white/80 text-red-600 shadow-sm border border-white/50">
          {icon}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children, required = false }) => (
  <div>
    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
      {label} {required && <span className="text-red-600">*</span>}
    </label>
    {children}
  </div>
);

const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50 disabled:bg-slate-50 disabled:text-slate-400';

export default function TabMasterResepBOM({
  masterRecipeBom = [],
  master_recipe_bom,
  recipeBom,
  recipe_bom,
  bom,
  recipes,

  masterProducts = [],
  master_products,
  products,
  produk,

  masterRawMaterials = [],
  master_raw_materials,
  rawMaterials,
  raw_materials,
  bahan_baku,

  masterBranches = [],
  master_branches,
  master_branch,
  branches,

  masterWarehouses = [],
  master_warehouses,
  masterLocations,
  master_locations,
  warehouses,
  locations,

  masterConversionRules = [],
  master_conversion_rules,
  conversionRules,
  conversion_rules,

  dbData = {},
  sendToSheet,
  showToast,
  user,
}) {
  const todayStr = getTodayStr();

  const isOwnerMode = useMemo(() => {
    const role = normalizeCode(user?.role || user?.user_role || '');
    const branchType = normalizeCode(user?.branch_type || user?.branchType || '');
    const branchId = normalizeCode(user?.branch_id || user?.branchId || '');

    return [
      'OWNER',
      'SUPER_ADMIN',
      'ADMIN_PUSAT',
      'HEAD_OFFICE',
      'HQ',
      'DEWA',
      'AKUN_DEWA',
    ].includes(role) ||
      ['HEAD_OFFICE', 'HQ_FACTORY', 'HQ'].includes(branchType) ||
      ['TANGERANG', 'TANGERANG_HO', 'HO_TANGERANG'].includes(branchId);
  }, [user]);

  const userBranchId = String(user?.branch_id || user?.branchId || '').trim();

  const [form, setForm] = useState({
    ...DEFAULT_FORM,
    branch_id: isOwnerMode ? '' : userBranchId,
    effective_date: todayStr,
  });

  const [lineForm, setLineForm] = useState(DEFAULT_LINE_FORM);
  const [bomLines, setBomLines] = useState([]);
  const [editingLineId, setEditingLineId] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [isRevisionMode, setIsRevisionMode] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState(isOwnerMode ? 'ALL' : userBranchId || 'ALL');
  const [productFilter, setProductFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  const rawRecipeRows = useMemo(() => {
    return getRawRecipeRows({
      masterRecipeBom,
      master_recipe_bom,
      recipeBom,
      recipe_bom,
      bom,
      recipes,
      dbData,
    });
  }, [masterRecipeBom, master_recipe_bom, recipeBom, recipe_bom, bom, recipes, dbData]);

  const rawProductRows = useMemo(() => {
    return getRawProductRows({
      masterProducts,
      master_products,
      products,
      produk,
      dbData,
    });
  }, [masterProducts, master_products, products, produk, dbData]);

  const rawMaterialRows = useMemo(() => {
    return getRawMaterialRows({
      masterRawMaterials,
      master_raw_materials,
      rawMaterials,
      raw_materials,
      bahan_baku,
      dbData,
    });
  }, [masterRawMaterials, master_raw_materials, rawMaterials, raw_materials, bahan_baku, dbData]);

  const rawBranchRows = useMemo(() => {
    return getRawBranchRows({
      masterBranches,
      master_branches,
      master_branch,
      branches,
      dbData,
    });
  }, [masterBranches, master_branches, master_branch, branches, dbData]);

  const rawWarehouseRows = useMemo(() => {
    return getRawWarehouseRows({
      masterWarehouses,
      master_warehouses,
      masterLocations,
      master_locations,
      warehouses,
      locations,
      dbData,
    });
  }, [masterWarehouses, master_warehouses, masterLocations, master_locations, warehouses, locations, dbData]);

  const rawRuleRows = useMemo(() => {
    return getRawConversionRules({
      masterConversionRules,
      master_conversion_rules,
      conversionRules,
      conversion_rules,
      dbData,
    });
  }, [masterConversionRules, master_conversion_rules, conversionRules, conversion_rules, dbData]);

  const masterSource = useMemo(() => ({
    ...(dbData || {}),
    master_recipe_bom: rawRecipeRows,
    masterRecipeBom: rawRecipeRows,
    recipe_bom: rawRecipeRows,
    bom: rawRecipeRows,

    master_products: rawProductRows,
    masterProducts: rawProductRows,
    products: rawProductRows,

    master_raw_materials: rawMaterialRows,
    masterRawMaterials: rawMaterialRows,
    raw_materials: rawMaterialRows,
    rawMaterials: rawMaterialRows,

    master_branches: rawBranchRows,
    masterBranches: rawBranchRows,
    master_branch: rawBranchRows,

    master_warehouses: rawWarehouseRows,
    masterWarehouses: rawWarehouseRows,
    master_locations: rawWarehouseRows,
    masterLocations: rawWarehouseRows,
    warehouses: rawWarehouseRows,
    locations: rawWarehouseRows,

    master_conversion_rules: rawRuleRows,
    masterConversionRules: rawRuleRows,
    conversion_rules: rawRuleRows,
    conversionRules: rawRuleRows,
  }), [dbData, rawRecipeRows, rawProductRows, rawMaterialRows, rawBranchRows, rawWarehouseRows, rawRuleRows]);

  const branchRecords = useMemo(() => {
    const result = erpOrchestrator.masterData.getBranches(masterSource, {
      includeInactive: true,
      includeDeleted: true,
      validate: false,
    });

    return (result.records || [])
      .map(normalizeBranchDisplay)
      .filter((branch) => !branch.isDeleted)
      .sort((a, b) => String(a.branch_name).localeCompare(String(b.branch_name)));
  }, [masterSource]);

  const activeBranchRecords = useMemo(() => {
    return branchRecords.filter((branch) => branch.status === 'ACTIVE');
  }, [branchRecords]);

  const branchNameById = useMemo(() => {
    const map = new Map();

    branchRecords.forEach((branch) => {
      map.set(branch.branch_id, branch.branch_name || branch.branch_id);
      map.set(branch.branch_code, branch.branch_name || branch.branch_id);
    });

    return map;
  }, [branchRecords]);

  const productRecords = useMemo(() => {
    const result = erpOrchestrator.masterData.getProducts(masterSource, {
      includeInactive: true,
      includeDeleted: true,
      validate: false,
    });

    return (result.records || [])
      .map(normalizeProductDisplay)
      .filter((product) => !product.isDeleted)
      .sort((a, b) => String(a.product_name).localeCompare(String(b.product_name)));
  }, [masterSource]);

  const materialRecords = useMemo(() => {
    const result = erpOrchestrator.masterData.getRawMaterials(masterSource, {
      includeInactive: true,
      includeDeleted: true,
      validate: false,
    });

    return (result.records || [])
      .map(normalizeMaterialDisplay)
      .filter((material) => !material.isDeleted)
      .sort((a, b) => String(a.raw_material_name).localeCompare(String(b.raw_material_name)));
  }, [masterSource]);

  const warehouseRecords = useMemo(() => {
    const result = erpOrchestrator.masterData.getWarehouses(masterSource, {
      includeInactive: true,
      includeDeleted: true,
      validate: false,
    });

    return (result.records || [])
      .map(normalizeWarehouseDisplay)
      .filter((warehouse) => !warehouse.isDeleted)
      .sort((a, b) => String(a.warehouse_name).localeCompare(String(b.warehouse_name)));
  }, [masterSource]);

  const conversionRuleRecords = useMemo(() => {
    return rawRuleRows
      .map(normalizeConversionRuleDisplay)
      .filter((rule) => !rule.isDeleted && rule.status === 'ACTIVE')
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [rawRuleRows]);

  const unitOptions = useMemo(() => {
    try {
      const units = listKnownUnits(masterSource, {
        includeDefaultUnits: true,
      });

      const result = Array.isArray(units)
        ? units
        : Array.isArray(units?.units)
          ? units.units
          : [];

      return Array.from(new Set([
        ...DEFAULT_UNIT_OPTIONS,
        ...result.map((unit) => normalizeCode(unit.unit || unit.code || unit)).filter(Boolean),
        ...conversionRuleRecords.flatMap((rule) => [rule.from_unit, rule.to_unit]).filter(Boolean),
      ])).sort();
    } catch (error) {
      return Array.from(new Set([
        ...DEFAULT_UNIT_OPTIONS,
        ...conversionRuleRecords.flatMap((rule) => [rule.from_unit, rule.to_unit]).filter(Boolean),
      ])).sort();
    }
  }, [masterSource, conversionRuleRecords]);

  const recipeRecords = useMemo(() => {
    return rawRecipeRows
      .map(normalizeRecipeDisplay)
      .map((recipe) => ({
        ...recipe,
        estimate: calculateBomEstimate(recipe, recipe.bom_lines, productRecords, masterSource),
      }))
      .sort((a, b) => {
        if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
        if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
        return String(a.recipe_name).localeCompare(String(b.recipe_name));
      });
  }, [rawRecipeRows, productRecords, masterSource]);

  const productNameById = useMemo(() => {
    const map = new Map();

    productRecords.forEach((product) => {
      map.set(product.product_id, product.product_name || product.product_id);
      map.set(product.product_code, product.product_name || product.product_id);
    });

    return map;
  }, [productRecords]);

  const warehouseNameById = useMemo(() => {
    const map = new Map();

    warehouseRecords.forEach((warehouse) => {
      map.set(warehouse.warehouse_id, warehouse.warehouse_name || warehouse.warehouse_id);
      map.set(warehouse.warehouse_code, warehouse.warehouse_name || warehouse.warehouse_id);
    });

    return map;
  }, [warehouseRecords]);

  const activeProductsByBranch = useMemo(() => {
    return productRecords.filter((product) => {
      if (product.status !== 'ACTIVE') return false;
      if (!form.branch_id) return true;
      return product.branch_id === form.branch_id;
    });
  }, [productRecords, form.branch_id]);

  const activeMaterialsByBranch = useMemo(() => {
    return materialRecords.filter((material) => {
      if (material.status !== 'ACTIVE') return false;
      if (!form.branch_id) return true;
      return material.branch_id === form.branch_id;
    });
  }, [materialRecords, form.branch_id]);

  const activeWarehousesByBranch = useMemo(() => {
    return warehouseRecords.filter((warehouse) => {
      if (warehouse.status !== 'ACTIVE') return false;
      if (!form.branch_id) return true;
      return warehouse.branch_id === form.branch_id;
    });
  }, [warehouseRecords, form.branch_id]);

  const searchResultIds = useMemo(() => {
    const keyword = searchQuery.trim();

    if (!keyword) return new Set();

    const normalized = normalizeText(keyword);

    return new Set(
      recipeRecords
        .filter((recipe) => recipe.search_text.includes(normalized))
        .flatMap((recipe) => [recipe.id, recipe.recipe_id, recipe.recipe_code].filter(Boolean)),
    );
  }, [recipeRecords, searchQuery]);

  const effectiveBranchFilter = !isOwnerMode && userBranchId ? userBranchId : branchFilter;

  const filteredRecipes = useMemo(() => {
    const keyword = normalizeText(searchQuery);

    return recipeRecords.filter((recipe) => {
      const statusOk = statusFilter === 'ALL'
        ? !recipe.isDeleted
        : statusFilter === 'SOFT_DELETED'
          ? recipe.isDeleted || recipe.status === 'SOFT_DELETED'
          : recipe.status === statusFilter && !recipe.isDeleted;

      const branchOk = effectiveBranchFilter === 'ALL' || recipe.branch_id === effectiveBranchFilter;
      const productOk = productFilter === 'ALL' || recipe.product_id === productFilter;

      const searchOk = !keyword ||
        recipe.search_text.includes(keyword) ||
        searchResultIds.has(recipe.id) ||
        searchResultIds.has(recipe.recipe_id) ||
        searchResultIds.has(recipe.recipe_code);

      return statusOk && branchOk && productOk && searchOk;
    });
  }, [recipeRecords, statusFilter, effectiveBranchFilter, productFilter, searchQuery, searchResultIds]);

  const currentEstimate = useMemo(() => {
    return calculateBomEstimate(form, bomLines, productRecords, masterSource);
  }, [form, bomLines, productRecords, masterSource]);

  const analytics = useMemo(() => {
    const visible = recipeRecords.filter((recipe) => !recipe.isDeleted);
    const scoped = visible.filter((recipe) => {
      if (effectiveBranchFilter === 'ALL') return true;
      return recipe.branch_id === effectiveBranchFilter;
    });

    const active = scoped.filter((recipe) => recipe.status === 'ACTIVE').length;
    const totalBahan = scoped.reduce((sum, recipe) => sum + recipe.estimate.total_bahan_baku, 0);
    const totalBiaya = scoped.reduce((sum, recipe) => sum + recipe.estimate.total_estimasi_biaya, 0);

    const highestCost = [...scoped].sort((a, b) => b.estimate.total_estimasi_biaya - a.estimate.total_estimasi_biaya)[0] || null;
    const latestVersion = [...scoped].sort((a, b) => String(b.updated_at || b.date || '').localeCompare(String(a.updated_at || a.date || '')))[0] || null;

    return {
      total: scoped.length,
      active,
      inactive: scoped.filter((recipe) => recipe.status === 'NON_ACTIVE').length,
      deleted: recipeRecords.filter((recipe) => recipe.isDeleted || recipe.status === 'SOFT_DELETED').length,
      total_bahan: totalBahan,
      total_estimasi_biaya: roundMoney(totalBiaya),
      highest_cost: highestCost,
      latest_version: latestVersion,
    };
  }, [recipeRecords, effectiveBranchFilter]);

  const notify = (message, type = 'success') => {
    if (typeof showToast === 'function') {
      showToast(message, type);
      return;
    }

    if (type === 'error') {
      window.alert(message);
    }
  };

  const resetForm = () => {
    setForm({
      ...DEFAULT_FORM,
      branch_id: isOwnerMode ? '' : userBranchId,
      effective_date: todayStr,
    });
    setLineForm(DEFAULT_LINE_FORM);
    setBomLines([]);
    setEditingLineId('');
    setIsEditing(false);
    setIsRevisionMode(false);
    setSelectedRecipe(null);
  };

  const handleGenerateId = () => {
    const newId = generateId('BOM', todayStr);

    setForm((prev) => ({
      ...prev,
      id: prev.id || newId,
      recipe_id: prev.recipe_id || newId,
      recipe_code: prev.recipe_code || `${newId}-V1`,
      version: prev.version || 'V1',
    }));
  };

  const handleProductChange = (productId) => {
    const product = productRecords.find((item) => item.product_id === productId);

    setForm((prev) => ({
      ...prev,
      product_id: productId,
      product_name: product?.product_name || '',
      yield_unit: product?.production_unit || product?.selling_unit || prev.yield_unit || 'PCS',
    }));
  };

  const handleMaterialChange = (materialId) => {
    const material = materialRecords.find((item) => item.raw_material_id === materialId);
    const warehouseId = material?.default_warehouse_id || lineForm.warehouse_id || '';
    const unit = material?.production_unit || material?.base_unit || lineForm.unit || 'GRAM';
    const latestCost = material?.latest_cost || material?.average_cost || 0;

    setLineForm((prev) => ({
      ...prev,
      raw_material_id: materialId,
      raw_material_name: material?.raw_material_name || '',
      warehouse_id: warehouseId,
      unit,
      conversion_rule_id: material?.conversion_rule_id || prev.conversion_rule_id,
      latest_cost: latestCost ? String(latestCost) : prev.latest_cost,
      estimated_cost: String(roundMoney(toNumber(prev.qty) * (1 + toNumber(prev.waste_percent) / 100) * latestCost)),
    }));
  };

  const recalculateLineCost = (lineInput) => {
    return {
      ...lineInput,
      estimated_cost: String(roundMoney(
        toNumber(lineInput.qty) *
        (1 + toNumber(lineInput.waste_percent) / 100) *
        toNumber(lineInput.latest_cost),
      )),
    };
  };

  const handleLineChange = (next) => {
    setLineForm(recalculateLineCost(next));
  };

  const validateLine = (lineInput, existingLines = bomLines) => {
    const warnings = [];

    if (!lineInput.raw_material_id.trim()) warnings.push('Bahan baku wajib dipilih.');
    if (!lineInput.raw_material_name.trim()) warnings.push('Nama bahan baku wajib terisi.');
    if (!lineInput.warehouse_id.trim()) warnings.push('Warehouse detail BOM wajib dipilih.');
    if (toNumber(lineInput.qty) <= 0) warnings.push('Qty detail BOM harus lebih dari 0.');
    if (!lineInput.unit.trim()) warnings.push('Unit detail BOM wajib diisi.');
    if (toNumber(lineInput.waste_percent) < 0) warnings.push('Waste percent tidak boleh negatif.');
    if (toNumber(lineInput.latest_cost) < 0) warnings.push('Latest cost tidak boleh negatif.');

    const materialExists = materialRecords.some((material) => {
      return material.raw_material_id === lineInput.raw_material_id &&
        material.branch_id === form.branch_id &&
        !material.isDeleted;
    });

    if (lineInput.raw_material_id && !materialExists) {
      warnings.push('Bahan baku tidak ditemukan di cabang yang dipilih.');
    }

    const warehouseExists = warehouseRecords.some((warehouse) => {
      return warehouse.warehouse_id === lineInput.warehouse_id &&
        warehouse.branch_id === form.branch_id &&
        !warehouse.isDeleted;
    });

    if (lineInput.warehouse_id && !warehouseExists) {
      warnings.push('Warehouse detail tidak ditemukan di cabang yang dipilih.');
    }

    const duplicate = existingLines.find((line) => {
      if (editingLineId && line.line_id === editingLineId) return false;
      return line.raw_material_id === lineInput.raw_material_id;
    });

    if (duplicate) {
      warnings.push(`Bahan duplikat: ${duplicate.raw_material_name}. Satu bahan hanya boleh muncul satu kali dalam resep.`);
    }

    return warnings;
  };

  const handleAddOrUpdateLine = () => {
    const warnings = validateLine(lineForm);

    if (warnings.length > 0) {
      notify(warnings.join('\n'), 'error');
      return;
    }

    const normalizedLine = normalizeBomLine({
      ...lineForm,
      line_id: editingLineId || lineForm.line_id || generateId('BOM-LINE', todayStr),
    });

    if (editingLineId) {
      setBomLines((prev) => prev.map((line) => (
        line.line_id === editingLineId ? normalizedLine : line
      )));
      setEditingLineId('');
    } else {
      setBomLines((prev) => [...prev, normalizedLine]);
    }

    setLineForm(DEFAULT_LINE_FORM);
  };

  const handleEditLine = (line) => {
    setEditingLineId(line.line_id);
    setLineForm({
      line_id: line.line_id,
      raw_material_id: line.raw_material_id,
      raw_material_name: line.raw_material_name,
      warehouse_id: line.warehouse_id,
      qty: String(line.qty),
      unit: line.unit,
      conversion_rule_id: line.conversion_rule_id,
      waste_percent: String(line.waste_percent || ''),
      latest_cost: String(line.latest_cost || ''),
      estimated_cost: String(line.estimated_cost || ''),
    });
  };

  const handleRemoveLine = (lineId) => {
    setBomLines((prev) => prev.filter((line) => line.line_id !== lineId));

    if (editingLineId === lineId) {
      setEditingLineId('');
      setLineForm(DEFAULT_LINE_FORM);
    }
  };

  const validateForm = () => {
    const warnings = [];

    if (!form.recipe_id.trim()) warnings.push('Recipe ID wajib diisi.');
    if (!form.recipe_code.trim()) warnings.push('Recipe Code wajib diisi.');
    if (!form.recipe_name.trim()) warnings.push('Nama resep wajib diisi.');
    if (!form.product_id.trim()) warnings.push('Produk wajib dipilih.');
    if (!form.product_name.trim()) warnings.push('Nama produk wajib terisi.');
    if (!form.branch_id.trim()) warnings.push('Branch ID wajib dipilih.');
    if (!form.version.trim()) warnings.push('Version wajib diisi.');
    if (!form.recipe_type.trim()) warnings.push('Recipe Type wajib dipilih.');
    if (toNumber(form.yield_qty) <= 0) warnings.push('Yield Qty harus lebih dari 0.');
    if (!form.yield_unit.trim()) warnings.push('Yield Unit wajib diisi.');
    if (!form.status.trim()) warnings.push('Status resep wajib dipilih.');
    if (!form.effective_date.trim()) warnings.push('Effective Date wajib diisi.');
    if (form.expired_date && form.expired_date < form.effective_date) warnings.push('Expired Date tidak boleh sebelum Effective Date.');

    if (bomLines.length === 0) {
      warnings.push('Detail BOM wajib memiliki minimal 1 bahan baku.');
    }

    if (!isOwnerMode && userBranchId && form.branch_id !== userBranchId) {
      warnings.push('User cabang hanya boleh membuat/mengedit resep di branch miliknya.');
    }

    const branchExists = branchRecords.some((branch) => {
      return branch.branch_id === form.branch_id && !branch.isDeleted;
    });

    if (form.branch_id && !branchExists) {
      warnings.push('Branch ID tidak ditemukan di Master Cabang.');
    }

    const productExists = productRecords.some((product) => {
      return product.product_id === form.product_id &&
        product.branch_id === form.branch_id &&
        !product.isDeleted;
    });

    if (form.product_id && !productExists) {
      warnings.push('Produk tidak ditemukan di cabang yang dipilih.');
    }

    const duplicateLineIds = new Set();
    bomLines.forEach((line) => {
      if (duplicateLineIds.has(line.raw_material_id)) {
        warnings.push(`Bahan duplikat: ${line.raw_material_name}.`);
      }
      duplicateLineIds.add(line.raw_material_id);

      const lineWarnings = validateLine({
        ...line,
        qty: String(line.qty),
        waste_percent: String(line.waste_percent),
        latest_cost: String(line.latest_cost),
      }, bomLines.filter((candidate) => candidate.line_id !== line.line_id));

      warnings.push(...lineWarnings);
    });

    if (form.status === 'ACTIVE') {
      const activeDuplicate = recipeRecords.find((recipe) => {
        if (recipe.isDeleted || recipe.status !== 'ACTIVE') return false;
        if (isEditing && recipe.recipe_id === selectedRecipe?.recipe_id) return false;
        if (isRevisionMode && selectedRecipe && recipe.recipe_id === selectedRecipe.recipe_id) return false;

        return recipe.product_id === form.product_id && recipe.branch_id === form.branch_id;
      });

      if (activeDuplicate) {
        warnings.push(`Sudah ada resep aktif untuk produk dan cabang ini: ${activeDuplicate.recipe_code}. Nonaktifkan atau revisi versi lama terlebih dahulu.`);
      }
    }

    try {
      validateBom({
        recipe_id: form.recipe_id,
        recipe_code: form.recipe_code,
        recipe_name: form.recipe_name,
        product_id: form.product_id,
        product_name: form.product_name,
        branch_id: form.branch_id,
        version: form.version,
        recipe_type: form.recipe_type,
        yield_qty: toNumber(form.yield_qty),
        yield_unit: form.yield_unit,
        bom_lines: bomLines,
      }, {
        source: masterSource,
        rulesSource: masterSource,
      });
    } catch (error) {
      warnings.push('Validasi bomEngine tidak bisa dijalankan penuh, validasi UI tetap digunakan.');
    }

    try {
      getActiveBom(masterSource, {
        productId: form.product_id,
        branchId: form.branch_id,
        asOfDate: form.effective_date || todayStr,
      });
    } catch (error) {
      // Engine probe only.
    }

    return warnings;
  };

  const createPayload = (override = {}) => {
    const recipeId = String(form.recipe_id || selectedRecipe?.recipe_id || generateId('BOM', todayStr)).trim();
    const now = new Date().toISOString();
    const status = normalizeCode(form.status);
    const normalizedLines = bomLines.map((line, index) => normalizeBomLine(line, index));

    let bomSnapshot = null;

    try {
      const snapshotResult = createBomSnapshot({
        recipe_id: recipeId,
        recipe_code: normalizeCode(form.recipe_code || recipeId),
        recipe_name: normalizeText(form.recipe_name),
        product_id: form.product_id,
        product_name: form.product_name,
        branch_id: normalizeCode(form.branch_id),
        version: normalizeCode(form.version),
        yield_qty: roundQty(form.yield_qty),
        yield_unit: normalizeCode(form.yield_unit),
        bom_lines: normalizedLines,
        estimated_hpp: currentEstimate,
        created_by: user?.name || user?.email || 'SYSTEM',
      }, {
        source: masterSource,
        rulesSource: masterSource,
        lock: true,
      });

      bomSnapshot = snapshotResult?.snapshot || snapshotResult || null;
    } catch (error) {
      bomSnapshot = null;
    }

    return {
      ...(selectedRecipe?.raw || {}),

      id: selectedRecipe && isEditing ? selectedRecipe.id : recipeId,
      date: selectedRecipe && isEditing ? selectedRecipe.date : todayStr,

      recipe_id: recipeId,
      recipe_code: normalizeCode(form.recipe_code || recipeId),
      recipe_name: normalizeText(form.recipe_name),

      bom_id: recipeId,
      bom_code: normalizeCode(form.recipe_code || recipeId),
      bom_name: normalizeText(form.recipe_name),

      product_id: form.product_id,
      product_name: form.product_name,

      branch_id: normalizeCode(form.branch_id),

      version: normalizeCode(form.version),
      recipe_version: normalizeCode(form.version),

      recipe_type: normalizeCode(form.recipe_type),

      yield_qty: roundQty(form.yield_qty),
      yield_unit: normalizeCode(form.yield_unit),
      output_qty: roundQty(form.yield_qty),
      output_unit: normalizeCode(form.yield_unit),

      status,
      recipe_status: status,
      status_active: status === 'ACTIVE',
      is_active: status === 'ACTIVE',
      isDeleted: false,

      effective_date: normalizeDate(form.effective_date),
      expired_date: normalizeDate(form.expired_date),

      notes: form.notes.trim(),
      keterangan: form.notes.trim(),

      revision_of: form.revision_of || '',
      previous_recipe_id: form.revision_of || '',

      bom_lines: normalizedLines,
      bom_lines_json: JSON.stringify(normalizedLines),

      total_bahan_baku: currentEstimate.total_bahan_baku,
      total_estimasi_biaya: currentEstimate.total_estimasi_biaya,
      estimasi_total_hpp: currentEstimate.estimasi_total_hpp,
      hpp_per_unit: currentEstimate.hpp_per_unit,
      total_waste_qty: currentEstimate.total_waste_qty,
      estimasi_margin_percent: currentEstimate.estimasi_margin_percent,

      bom_snapshot_json: bomSnapshot ? JSON.stringify(bomSnapshot) : '',

      created_at: selectedRecipe && isEditing ? selectedRecipe.raw?.created_at || now : now,
      created_by: selectedRecipe && isEditing ? selectedRecipe.raw?.created_by || user?.name || user?.email || 'SYSTEM' : user?.name || user?.email || 'SYSTEM',
      updated_at: now,
      updated_by: user?.name || user?.email || 'SYSTEM',

      ...override,
    };
  };

  const persistRecipe = async (action, payload) => {
    if (typeof sendToSheet !== 'function') {
      notify('sendToSheet belum tersedia. Data resep belum bisa disimpan ke cloud.', 'error');
      return false;
    }

    let isSuccess = false;

    try {
      isSuccess = await sendToSheet(action, RECIPE_TABLE_NAME, payload);
    } catch (error) {
      isSuccess = false;
    }

    if (!isSuccess) {
      try {
        isSuccess = await sendToSheet(action, payload, RECIPE_TABLE_NAME);
      } catch (error) {
        isSuccess = false;
      }
    }

    return Boolean(isSuccess);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const warnings = validateForm();

    if (warnings.length > 0) {
      notify(warnings.join('\n'), 'error');
      return;
    }

    const action = isEditing ? 'update' : 'insert';
    const payload = createPayload();

    if (isRevisionMode && selectedRecipe && selectedRecipe.status === 'ACTIVE') {
      const oldPayload = {
        ...(selectedRecipe.raw || {}),
        id: selectedRecipe.id || selectedRecipe.recipe_id,
        recipe_id: selectedRecipe.recipe_id,
        status: 'NON_ACTIVE',
        recipe_status: 'NON_ACTIVE',
        status_active: false,
        is_active: false,
        updated_at: new Date().toISOString(),
        updated_by: user?.name || user?.email || 'SYSTEM',
        revision_closed_by: payload.recipe_id,
      };

      const oldUpdated = await persistRecipe('update', oldPayload);

      if (!oldUpdated) {
        notify('Gagal menonaktifkan resep versi lama. Revisi dibatalkan agar tidak ada dua resep aktif.', 'error');
        return;
      }
    }

    const isSuccess = await persistRecipe(action, payload);

    if (isSuccess) {
      notify(
        isRevisionMode
          ? 'Revisi resep berhasil dibuat dan versi lama dinonaktifkan.'
          : isEditing
            ? 'Master resep berhasil diperbarui.'
            : 'Resep baru berhasil ditambahkan.',
        'success',
      );
      resetForm();
    }
  };

  const handleEdit = (recipe) => {
    setSelectedRecipe(recipe);
    setIsEditing(true);
    setIsRevisionMode(false);

    setForm({
      id: recipe.id || recipe.recipe_id,
      recipe_id: recipe.recipe_id,
      recipe_code: recipe.recipe_code,
      recipe_name: recipe.recipe_name,
      product_id: recipe.product_id,
      product_name: recipe.product_name,
      branch_id: recipe.branch_id,
      version: recipe.version || 'V1',
      recipe_type: recipe.recipe_type || 'PRODUKSI',
      yield_qty: String(recipe.yield_qty || ''),
      yield_unit: recipe.yield_unit || 'PCS',
      status: recipe.status === 'SOFT_DELETED' ? 'NON_ACTIVE' : recipe.status || 'ACTIVE',
      effective_date: recipe.effective_date || todayStr,
      expired_date: recipe.expired_date || '',
      notes: recipe.notes || '',
      revision_of: recipe.revision_of || '',
    });

    setBomLines(recipe.bom_lines.map((line, index) => normalizeBomLine(line, index)));
    setLineForm(DEFAULT_LINE_FORM);
    setEditingLineId('');
  };

  const handleClone = (recipe) => {
    const cloneId = generateId('BOM', todayStr);
    const cloneVersion = 'V1';

    setSelectedRecipe(recipe);
    setIsEditing(false);
    setIsRevisionMode(false);

    setForm({
      id: cloneId,
      recipe_id: cloneId,
      recipe_code: `${normalizeCode(recipe.recipe_code || recipe.recipe_id)}-CLONE`,
      recipe_name: `${recipe.recipe_name} COPY`,
      product_id: recipe.product_id,
      product_name: recipe.product_name,
      branch_id: recipe.branch_id,
      version: cloneVersion,
      recipe_type: recipe.recipe_type || 'PRODUKSI',
      yield_qty: String(recipe.yield_qty || ''),
      yield_unit: recipe.yield_unit || 'PCS',
      status: 'NON_ACTIVE',
      effective_date: todayStr,
      expired_date: '',
      notes: recipe.notes || '',
      revision_of: recipe.recipe_id,
    });

    setBomLines(recipe.bom_lines.map((line, index) => ({
      ...normalizeBomLine(line, index),
      line_id: generateId(`BOM-CLONE-L${index + 1}`, todayStr),
    })));
    setLineForm(DEFAULT_LINE_FORM);
    setEditingLineId('');
  };

  const handleRevise = (recipe) => {
    const nextVersion = getNextVersion(recipe.version);
    const newId = generateId('BOM', todayStr);

    setSelectedRecipe(recipe);
    setIsEditing(false);
    setIsRevisionMode(true);

    setForm({
      id: newId,
      recipe_id: newId,
      recipe_code: applyVersionToCode(recipe.recipe_code || recipe.recipe_id, nextVersion),
      recipe_name: recipe.recipe_name,
      product_id: recipe.product_id,
      product_name: recipe.product_name,
      branch_id: recipe.branch_id,
      version: nextVersion,
      recipe_type: recipe.recipe_type || 'PRODUKSI',
      yield_qty: String(recipe.yield_qty || ''),
      yield_unit: recipe.yield_unit || 'PCS',
      status: 'ACTIVE',
      effective_date: todayStr,
      expired_date: '',
      notes: recipe.notes || '',
      revision_of: recipe.recipe_id,
    });

    setBomLines(recipe.bom_lines.map((line, index) => ({
      ...normalizeBomLine(line, index),
      line_id: generateId(`BOM-${nextVersion}-L${index + 1}`, todayStr),
    })));
    setLineForm(DEFAULT_LINE_FORM);
    setEditingLineId('');
  };

  const handleToggleStatus = async (recipe) => {
    const nextStatus = recipe.status === 'ACTIVE' ? 'NON_ACTIVE' : 'ACTIVE';

    if (nextStatus === 'ACTIVE') {
      const duplicateActive = recipeRecords.find((candidate) => {
        return candidate.recipe_id !== recipe.recipe_id &&
          candidate.status === 'ACTIVE' &&
          !candidate.isDeleted &&
          candidate.product_id === recipe.product_id &&
          candidate.branch_id === recipe.branch_id;
      });

      if (duplicateActive) {
        notify(`Tidak bisa mengaktifkan. Sudah ada resep aktif: ${duplicateActive.recipe_code}.`, 'error');
        return;
      }
    }

    const confirmed = window.confirm(
      `${nextStatus === 'NON_ACTIVE' ? 'Nonaktifkan' : 'Aktifkan ulang'} resep ${recipe.recipe_name}?`,
    );

    if (!confirmed) return;

    const payload = {
      ...(recipe.raw || {}),
      id: recipe.id || recipe.recipe_id,
      recipe_id: recipe.recipe_id,
      recipe_status: nextStatus,
      status: nextStatus,
      status_active: nextStatus === 'ACTIVE',
      is_active: nextStatus === 'ACTIVE',
      isDeleted: false,
      updated_at: new Date().toISOString(),
      updated_by: user?.name || user?.email || 'SYSTEM',
    };

    const isSuccess = await persistRecipe('update', payload);

    if (isSuccess) {
      notify(nextStatus === 'ACTIVE' ? 'Resep berhasil diaktifkan ulang.' : 'Resep berhasil dinonaktifkan.', 'success');
    }
  };

  const handleSoftDelete = async (recipe) => {
    const confirmed = window.confirm(
      `Soft delete resep ${recipe.recipe_name}? Histori tidak dihapus permanen, hanya disembunyikan dari transaksi aktif.`,
    );

    if (!confirmed) return;

    const payload = {
      ...(recipe.raw || {}),
      id: recipe.id || recipe.recipe_id,
      recipe_id: recipe.recipe_id,
      recipe_status: 'NON_ACTIVE',
      status: 'NON_ACTIVE',
      status_active: false,
      is_active: false,
      isDeleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: user?.name || user?.email || 'SYSTEM',
      updated_at: new Date().toISOString(),
      updated_by: user?.name || user?.email || 'SYSTEM',
    };

    const isSuccess = await persistRecipe('update', payload);

    if (isSuccess) {
      notify('Resep berhasil di-soft delete.', 'success');
      if (selectedRecipe?.recipe_id === recipe.recipe_id) resetForm();
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-red-600/30 blur-2xl" />
        <div className="absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-amber-400/20 blur-2xl" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="rounded-2xl bg-red-600 p-2 shadow-sm">
                <ClipboardList size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                Master Resep / BOM ERP
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              Pusat Resep Produksi Dimsum Aditya
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-300">
              Seluruh produksi, HPP, BOM, dan margin wajib memakai resep resmi aktif. Tidak ada hardcode bahan produksi.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">{isOwnerMode ? 'Owner Mode Lintas Cabang' : 'Branch Mode'}</Badge>
            <Badge tone="amber">Versioning Ready</Badge>
            <Badge tone="green">HPP Engine Ready</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Resep" value={analytics.total} icon={<ClipboardList size={18} />} tone="white" />
        <StatCard title="Aktif" value={analytics.active} icon={<CheckCircle size={18} />} tone="red" />
        <StatCard title="Total Bahan" value={analytics.total_bahan} icon={<Package size={18} />} tone="gold" />
        <StatCard title="Estimasi Biaya" value={formatMoney(analytics.total_estimasi_biaya)} icon={<ReceiptText size={18} />} tone="white" />
        <StatCard title="Soft Deleted" value={analytics.deleted} icon={<Trash2 size={18} />} tone="dark" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-red-50 p-3 text-red-600">
              <Crown size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Resep Estimasi Tertinggi</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.highest_cost?.recipe_name || '-'}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                {formatMoney(analytics.highest_cost?.estimate?.total_estimasi_biaya || 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
              <GitBranch size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Versi Terbaru</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.latest_version?.recipe_code || '-'}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                {analytics.latest_version?.version || '-'}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <Calculator size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Form HPP Preview</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {formatMoney(currentEstimate.hpp_per_unit)}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                Estimasi HPP per {form.yield_unit || 'unit'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {currentEstimate.total_bahan_baku > 0 && (
        <div className="rounded-[2rem] border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Estimasi Total HPP</div>
              <div className="mt-1 text-xl font-black text-amber-950">{formatMoney(currentEstimate.estimasi_total_hpp)}</div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">HPP Per Unit</div>
              <div className="mt-1 text-xl font-black text-amber-950">{formatMoney(currentEstimate.hpp_per_unit)}</div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Total Waste</div>
              <div className="mt-1 text-xl font-black text-amber-950">{currentEstimate.total_waste_qty.toLocaleString('id-ID')}</div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Margin Estimasi</div>
              <div className="mt-1 text-xl font-black text-amber-950">{currentEstimate.estimasi_margin_percent.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
                  {isRevisionMode ? <GitBranch size={16} className="text-red-600" /> : isEditing ? <Edit2 size={16} className="text-red-600" /> : <Plus size={16} className="text-red-600" />}
                  {isRevisionMode ? 'Revisi Versi Resep' : isEditing ? 'Edit Resep' : 'Tambah Resep'}
                </h2>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  Header resep resmi untuk produksi dan HPP.
                </p>
              </div>

              {(isEditing || isRevisionMode) && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl bg-slate-100 p-2 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Recipe ID" required>
                  <div className="flex gap-2">
                    <input
                      disabled={isEditing}
                      value={form.recipe_id}
                      onChange={(event) => setForm({ ...form, recipe_id: normalizeCode(event.target.value), id: normalizeCode(event.target.value) })}
                      className={inputClass}
                      placeholder="BOM-DIMSUM-AYAM"
                    />
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={handleGenerateId}
                        className="shrink-0 rounded-2xl border border-amber-200 bg-amber-50 px-3 text-[10px] font-black text-amber-700 transition-all hover:bg-amber-100"
                      >
                        ID
                      </button>
                    )}
                  </div>
                </Field>

                <Field label="Recipe Code" required>
                  <input
                    value={form.recipe_code}
                    onChange={(event) => setForm({ ...form, recipe_code: normalizeCode(event.target.value) })}
                    className={inputClass}
                    placeholder="DIMSUM-AYAM-V1"
                  />
                </Field>
              </div>

              <Field label="Nama Resep" required>
                <input
                  value={form.recipe_name}
                  onChange={(event) => setForm({ ...form, recipe_name: event.target.value })}
                  className={inputClass}
                  placeholder="Resep Dimsum Ayam Original isi 4"
                />
              </Field>

              <Field label="Cabang" required>
                <select
                  disabled={!isOwnerMode && Boolean(userBranchId)}
                  value={form.branch_id}
                  onChange={(event) => setForm({
                    ...form,
                    branch_id: event.target.value,
                    product_id: '',
                    product_name: '',
                  })}
                  className={inputClass}
                >
                  <option value="">Pilih cabang resmi</option>
                  {activeBranchRecords.map((branch) => (
                    <option key={branch.branch_id} value={branch.branch_id}>
                      {branch.branch_name} — {branch.branch_id}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Produk Terkait" required>
                <select
                  value={form.product_id}
                  onChange={(event) => handleProductChange(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Pilih produk resmi</option>
                  {activeProductsByBranch.map((product) => (
                    <option key={product.product_id} value={product.product_id}>
                      {product.product_name} — {product.product_id}
                    </option>
                  ))}
                </select>
                {form.branch_id && activeProductsByBranch.length === 0 && (
                  <div className="mt-2 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700">
                    Produk aktif belum tersedia untuk cabang ini.
                  </div>
                )}
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Version" required>
                  <input
                    value={form.version}
                    onChange={(event) => setForm({ ...form, version: normalizeCode(event.target.value) })}
                    className={inputClass}
                    placeholder="V1"
                  />
                </Field>

                <Field label="Recipe Type" required>
                  <select
                    value={form.recipe_type}
                    onChange={(event) => setForm({ ...form, recipe_type: event.target.value })}
                    className={inputClass}
                  >
                    {RECIPE_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Yield Qty" required>
                  <input
                    value={form.yield_qty}
                    onChange={(event) => setForm({ ...form, yield_qty: event.target.value })}
                    className={inputClass}
                    placeholder="1000"
                  />
                </Field>

                <Field label="Yield Unit" required>
                  <select
                    value={form.yield_unit}
                    onChange={(event) => setForm({ ...form, yield_unit: event.target.value })}
                    className={inputClass}
                  >
                    {unitOptions.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Status" required>
                  <select
                    value={form.status}
                    onChange={(event) => setForm({ ...form, status: event.target.value })}
                    className={inputClass}
                  >
                    {RECIPE_STATUS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Effective Date" required>
                  <input
                    type="date"
                    value={form.effective_date}
                    onChange={(event) => setForm({ ...form, effective_date: event.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Expired Date">
                <input
                  type="date"
                  value={form.expired_date}
                  onChange={(event) => setForm({ ...form, expired_date: event.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Catatan resep..."
                />
              </Field>

              <div className="rounded-[2rem] border border-slate-100 bg-slate-50/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black text-slate-900">Detail Bahan BOM</div>
                    <div className="text-[11px] font-semibold text-slate-400">Semua bahan wajib dari Master Bahan Baku.</div>
                  </div>
                  <Badge tone="amber">{bomLines.length} bahan</Badge>
                </div>

                <div className="space-y-3">
                  <Field label="Bahan Baku" required>
                    <select
                      value={lineForm.raw_material_id}
                      onChange={(event) => handleMaterialChange(event.target.value)}
                      className={inputClass}
                    >
                      <option value="">Pilih bahan baku</option>
                      {activeMaterialsByBranch.map((material) => (
                        <option key={material.raw_material_id} value={material.raw_material_id}>
                          {material.raw_material_name} — {material.raw_material_id}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Warehouse Detail" required>
                    <select
                      value={lineForm.warehouse_id}
                      onChange={(event) => handleLineChange({ ...lineForm, warehouse_id: event.target.value })}
                      className={inputClass}
                    >
                      <option value="">Pilih warehouse</option>
                      {activeWarehousesByBranch.map((warehouse) => (
                        <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                          {warehouse.warehouse_name} — {warehouse.warehouse_id}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Field label="Qty" required>
                      <input
                        value={lineForm.qty}
                        onChange={(event) => handleLineChange({ ...lineForm, qty: event.target.value })}
                        className={inputClass}
                        placeholder="30"
                      />
                    </Field>

                    <Field label="Unit" required>
                      <select
                        value={lineForm.unit}
                        onChange={(event) => handleLineChange({ ...lineForm, unit: event.target.value })}
                        className={inputClass}
                      >
                        {unitOptions.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="Conversion Rule">
                    <select
                      value={lineForm.conversion_rule_id}
                      onChange={(event) => handleLineChange({ ...lineForm, conversion_rule_id: event.target.value })}
                      className={inputClass}
                    >
                      <option value="">Tanpa rule khusus</option>
                      {conversionRuleRecords.map((rule) => (
                        <option key={rule.rule_id} value={rule.rule_id}>
                          {rule.name} — {rule.from_unit || '-'} → {rule.to_unit || '-'}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Field label="Waste %">
                      <input
                        value={lineForm.waste_percent}
                        onChange={(event) => handleLineChange({ ...lineForm, waste_percent: event.target.value })}
                        className={inputClass}
                        placeholder="0"
                      />
                    </Field>

                    <Field label="Latest Cost">
                      <input
                        value={lineForm.latest_cost}
                        onChange={(event) => handleLineChange({ ...lineForm, latest_cost: event.target.value })}
                        className={inputClass}
                        placeholder="0"
                      />
                    </Field>

                    <Field label="Estimated Cost">
                      <input
                        value={lineForm.estimated_cost}
                        onChange={(event) => setLineForm({ ...lineForm, estimated_cost: event.target.value })}
                        className={inputClass}
                        placeholder="0"
                      />
                    </Field>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddOrUpdateLine}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-red-700 transition-all hover:bg-red-100"
                  >
                    <Plus size={15} />
                    {editingLineId ? 'Update Detail Bahan' : 'Tambah Detail Bahan'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-sm transition-all hover:bg-red-700"
              >
                <Save size={16} />
                {isRevisionMode ? 'Simpan Revisi Resep' : isEditing ? 'Simpan Perubahan' : 'Tambah Resep'}
              </button>
            </form>
          </div>
        </div>

        <div className="xl:col-span-8">
          <div className="rounded-[2rem] border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <ShieldCheck size={17} className="text-red-600" />
                    Daftar Resep / BOM Resmi
                  </h2>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    Resep resmi untuk Production, HPP, BOM, dan Profit.
                  </p>
                </div>

                <div className="flex flex-col gap-2 2xl:flex-row">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-xs font-bold outline-none transition-all placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50 md:w-64"
                      placeholder="Cari resep, kode, produk..."
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div className="relative">
                      <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className="rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-xs font-black text-slate-600 outline-none focus:border-red-500"
                      >
                        <option value="ALL">SEMUA AKTIF/NONAKTIF</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="NON_ACTIVE">NON_ACTIVE</option>
                        <option value="SOFT_DELETED">SOFT_DELETED</option>
                      </select>
                    </div>

                    <select
                      disabled={!isOwnerMode && Boolean(userBranchId)}
                      value={effectiveBranchFilter}
                      onChange={(event) => {
                        if (isOwnerMode) setBranchFilter(event.target.value);
                      }}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none focus:border-red-500 disabled:bg-slate-50"
                    >
                      <option value="ALL">SEMUA CABANG</option>
                      {branchRecords.map((branch) => (
                        <option key={branch.branch_id} value={branch.branch_id}>
                          {branch.branch_name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={productFilter}
                      onChange={(event) => setProductFilter(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none focus:border-red-500"
                    >
                      <option value="ALL">SEMUA PRODUK</option>
                      {productRecords.map((product) => (
                        <option key={product.product_id} value={product.product_id}>
                          {product.product_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {bomLines.length > 0 && (
              <div className="border-b border-slate-100 bg-slate-50/60 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-black text-slate-900">
                      <FlaskConical size={15} className="text-red-600" />
                      Detail BOM Sedang Diedit
                    </h3>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">
                      Bahan duplikat, qty kosong, unit kosong, dan warehouse kosong akan diblokir.
                    </p>
                  </div>
                  <Badge tone="amber">{formatMoney(currentEstimate.total_estimasi_biaya)}</Badge>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Bahan</th>
                        <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Warehouse</th>
                        <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Qty</th>
                        <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Waste</th>
                        <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cost</th>
                        <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bomLines.map((line) => (
                        <tr key={line.line_id} className="border-b border-slate-100">
                          <td className="px-3 py-3 text-xs font-bold text-slate-800">
                            <div>{line.raw_material_name}</div>
                            <div className="mt-1 text-[11px] text-slate-400">{line.raw_material_id}</div>
                          </td>
                          <td className="px-3 py-3 text-xs font-bold text-slate-700">
                            {warehouseNameById.get(line.warehouse_id) || line.warehouse_id || '-'}
                          </td>
                          <td className="px-3 py-3 text-xs font-black text-slate-900">
                            {formatQty(line.qty, line.unit)}
                          </td>
                          <td className="px-3 py-3 text-xs font-bold text-amber-700">
                            {line.waste_percent || 0}%
                          </td>
                          <td className="px-3 py-3 text-xs font-black text-slate-900">
                            {formatMoney(line.estimated_cost)}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditLine(line)}
                                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(line.line_id)}
                                className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Resep</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Produk</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cabang</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Yield</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">HPP</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">BOM</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Periode</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Status</th>
                    <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecipes.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-5 py-14 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-red-50 text-red-600">
                          <ClipboardList size={24} />
                        </div>
                        <div className="mt-3 text-sm font-black text-slate-800">Resep tidak ditemukan</div>
                        <div className="mt-1 text-xs font-semibold text-slate-400">
                          Ubah filter atau tambahkan resep baru.
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredRecipes.map((recipe) => {
                    const isDeleted = recipe.isDeleted || recipe.status === 'SOFT_DELETED';
                    const isActive = recipe.status === 'ACTIVE' && !isDeleted;
                    const branchName = branchNameById.get(recipe.branch_id) || 'Branch tidak ditemukan';
                    const productName = productNameById.get(recipe.product_id) || recipe.product_name || 'Produk tidak ditemukan';
                    const isOrphanProduct = !productNameById.has(recipe.product_id);
                    const isOrphanBranch = !branchNameById.has(recipe.branch_id);

                    return (
                      <tr key={`${recipe.recipe_id}-${recipe.recipe_code}`} className="border-b border-slate-100 transition-colors hover:bg-red-50/30">
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isActive ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              {getRecipeTypeIcon(recipe.recipe_type)}
                            </div>
                            <div>
                              <div className="font-black text-slate-900">{recipe.recipe_name || '-'}</div>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                <Badge tone="slate">{recipe.recipe_id || '-'}</Badge>
                                <Badge tone="amber">{recipe.recipe_code || '-'}</Badge>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <Badge tone="purple">{recipe.version || '-'}</Badge>
                                <Badge tone={recipe.recipe_type === 'PRODUKSI' ? 'red' : 'slate'}>{recipe.recipe_type || '-'}</Badge>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-2">
                            <PackageCheck size={15} className={isOrphanProduct ? 'mt-0.5 shrink-0 text-red-500' : 'mt-0.5 shrink-0 text-slate-400'} />
                            <div>
                              <div className={`text-xs font-black ${isOrphanProduct ? 'text-red-600' : 'text-slate-800'}`}>
                                {productName}
                              </div>
                              <div className="mt-1 text-[11px] font-semibold text-slate-400">
                                {recipe.product_id || '-'}
                              </div>
                              {isOrphanProduct && (
                                <div className="mt-2">
                                  <Badge tone="red">ORPHAN PRODUCT</Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-2">
                            <Building2 size={15} className={isOrphanBranch ? 'mt-0.5 shrink-0 text-red-500' : 'mt-0.5 shrink-0 text-slate-400'} />
                            <div>
                              <div className={`text-xs font-black ${isOrphanBranch ? 'text-red-600' : 'text-slate-800'}`}>
                                {branchName}
                              </div>
                              <div className="mt-1 text-[11px] font-semibold text-slate-400">
                                {recipe.branch_id || '-'}
                              </div>
                              {isOrphanBranch && (
                                <div className="mt-2">
                                  <Badge tone="red">ORPHAN BRANCH</Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="text-sm font-black text-slate-900">
                            {formatQty(recipe.yield_qty, recipe.yield_unit)}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-slate-400">
                            Output produksi
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-bold">
                            <div className="text-slate-400">Total</div>
                            <div className="text-right text-slate-900">{formatMoney(recipe.estimate.estimasi_total_hpp)}</div>

                            <div className="text-slate-400">Per Unit</div>
                            <div className="text-right text-slate-900">{formatMoney(recipe.estimate.hpp_per_unit)}</div>

                            <div className="text-slate-400">Margin</div>
                            <div className="text-right text-emerald-700">{recipe.estimate.estimasi_margin_percent.toFixed(1)}%</div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="text-sm font-black text-slate-900">
                            {recipe.estimate.total_bahan_baku} bahan
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-slate-400">
                            Waste {recipe.estimate.total_waste_qty.toLocaleString('id-ID')}
                          </div>
                          {recipe.estimate.total_bahan_baku === 0 && (
                            <div className="mt-2">
                              <Badge tone="red">NO BOM</Badge>
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="space-y-1 text-[11px] font-bold text-slate-600">
                            <div>Efektif: {recipe.effective_date ? formatDate(recipe.effective_date) : '-'}</div>
                            <div>Expired: {recipe.expired_date ? formatDate(recipe.expired_date) : '-'}</div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <Badge tone={isDeleted ? 'dark' : isActive ? 'green' : 'amber'}>
                            {isDeleted ? 'SOFT_DELETED' : recipe.status}
                          </Badge>
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                            <History size={12} />
                            {recipe.updated_at ? formatDate(recipe.updated_at) : recipe.date ? formatDate(recipe.date) : '-'}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            {!isDeleted && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(recipe)}
                                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                                  title="Edit resep"
                                >
                                  <Edit2 size={15} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleClone(recipe)}
                                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-amber-100 hover:bg-amber-50 hover:text-amber-700"
                                  title="Clone resep"
                                >
                                  <Copy size={15} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRevise(recipe)}
                                  className="rounded-xl border border-purple-100 bg-purple-50 p-2 text-purple-700 transition-all hover:bg-purple-100"
                                  title="Revisi versi resep"
                                >
                                  <GitBranch size={15} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(recipe)}
                                  className={`rounded-xl border p-2 transition-all ${
                                    isActive
                                      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  }`}
                                  title={isActive ? 'Nonaktifkan resep' : 'Aktifkan resep'}
                                >
                                  {isActive ? <Power size={15} /> : <RotateCcw size={15} />}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSoftDelete(recipe)}
                                  className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100"
                                  title="Soft delete resep"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}

                            {isDeleted && (
                              <Badge tone="dark">Locked</Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
              <div className="text-[11px] font-bold text-slate-400">
                Menampilkan <span className="text-slate-800">{filteredRecipes.length}</span> dari <span className="text-slate-800">{recipeRecords.length}</span> data resep.
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge tone="red">Merah = Resep Aktif</Badge>
                <Badge tone="amber">Gold = HPP / Versioning</Badge>
                <Badge tone="purple">Revisi / Clone</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
