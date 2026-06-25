import React, { useMemo, useState } from 'react';
import {
  Factory,
  Plus,
  Save,
  X,
  Edit2,
  Search,
  Filter,
  Building2,
  Warehouse,
  PackageCheck,
  ClipboardList,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  CalendarClock,
  ReceiptText,
  BadgeDollarSign,
  Package,
  Scale,
  History,
  Crown,
  TrendingUp,
  Undo2,
  Send,
  Copy,
  Play,
  Flag,
  FileText,
  Layers,
  FlaskConical,
  Activity,
} from 'lucide-react';

import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import erpOrchestrator from '../../services/erpOrchestrator';

const PRODUCTION_TABLE_NAME = 'production_batches';

const PRODUCTION_STATUS = [
  'DRAFT',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'VOID',
];

const DEFAULT_FORM = {
  id: '',
  production_id: '',
  production_code: '',
  production_date: '',
  branch_id: '',
  warehouse_id: '',
  recipe_id: '',
  recipe_version: '',
  product_id: '',
  product_name: '',
  planned_qty: '',
  actual_qty: '',
  yield_qty: '',
  status: 'DRAFT',
  notes: '',
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

const parseJson = (value, fallback = null) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(String(value));
  } catch (error) {
    return fallback;
  }
};

const safeArray = (value) => {
  return Array.isArray(value) ? value : [];
};

const isSoftDeleted = (row) => {
  const value = row?.isDeleted ?? row?.is_deleted ?? row?.deleted;
  return value === true || String(value || '').toUpperCase() === 'TRUE';
};

const normalizeMasterStatus = (row) => {
  if (isSoftDeleted(row)) return 'SOFT_DELETED';

  const value = row?.status ?? row?.status_active ?? row?.is_active;

  if (value === false) return 'NON_ACTIVE';
  if (value === true) return 'ACTIVE';

  const normalized = normalizeCode(value || 'ACTIVE');

  if (['NON_ACTIVE', 'NONAKTIF', 'INACTIVE', 'DISABLED', 'FALSE', 'NO', 'N', '0'].includes(normalized)) {
    return 'NON_ACTIVE';
  }

  return 'ACTIVE';
};

const normalizeProductionStatus = (row) => {
  const value = row?.status ?? row?.production_status ?? row?.batch_status ?? row?.transaction_status;
  const normalized = normalizeCode(value || 'DRAFT');

  if (['VOIDED', 'VOID'].includes(normalized)) return 'VOID';
  if (['CANCELLED', 'CANCELED', 'BATAL'].includes(normalized)) return 'CANCELLED';
  if (['COMPLETED', 'COMPLETE', 'DONE', 'FINISHED', 'POSTED'].includes(normalized)) return 'COMPLETED';
  if (['IN_PROGRESS', 'PROCESS', 'PROCESSING', 'STARTED', 'RUNNING'].includes(normalized)) return 'IN_PROGRESS';
  if (['DRAFT', 'OPEN'].includes(normalized)) return 'DRAFT';

  return normalized || 'DRAFT';
};

const getRawProductionRows = ({
  productionBatches,
  production_batches,
  productions,
  productionTransactions,
  production_transactions,
  dbData,
}) => {
  return [
    ...safeArray(productionBatches),
    ...safeArray(production_batches),
    ...safeArray(productions),
    ...safeArray(productionTransactions),
    ...safeArray(production_transactions),
    ...safeArray(dbData?.productionBatches),
    ...safeArray(dbData?.production_batches),
    ...safeArray(dbData?.productions),
    ...safeArray(dbData?.productionTransactions),
    ...safeArray(dbData?.production_transactions),
  ];
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

const getRawInventoryLayerRows = ({
  inventoryCostLayers,
  inventory_cost_layers,
  costLayers,
  cost_layers,
  dbData,
}) => {
  return [
    ...safeArray(inventoryCostLayers),
    ...safeArray(inventory_cost_layers),
    ...safeArray(costLayers),
    ...safeArray(cost_layers),
    ...safeArray(dbData?.inventoryCostLayers),
    ...safeArray(dbData?.inventory_cost_layers),
    ...safeArray(dbData?.costLayers),
    ...safeArray(dbData?.cost_layers),
  ];
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
    status: normalizeMasterStatus({
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
    warehouse_code: String(raw.warehouse_code || raw.location_code || raw.code || warehouseId || '').trim(),
    warehouse_name: String(raw.warehouse_name || raw.location_name || raw.nama_gudang || raw.name || record?.name || '').trim(),
    warehouse_type: normalizeCode(raw.warehouse_type || raw.location_type || raw.type || 'FINISHED_GOODS'),
    branch_id: String(raw.branch_id || raw.branchId || raw.scope_branch_id || record?.branch_id || '').trim(),
    status: normalizeMasterStatus(raw),
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
    product_category: normalizeCode(raw.product_category || raw.category || raw.kategori || 'UMUM'),
    branch_id: String(raw.branch_id || raw.branchId || record?.branch_id || '').trim(),
    default_warehouse_id: String(raw.default_warehouse_id || raw.warehouse_id || raw.warehouseId || '').trim(),
    selling_unit: normalizeCode(raw.selling_unit || raw.unit || raw.satuan || 'PCS'),
    production_unit: normalizeCode(raw.production_unit || raw.unit || raw.satuan || 'PCS'),
    current_hpp: roundMoney(raw.current_hpp || raw.hpp || raw.current_cost || 0),
    status: normalizeMasterStatus(raw),
    is_production_item: raw.is_production_item === true || String(raw.is_production_item || raw.isProductionItem || '').toUpperCase() === 'TRUE',
    isDeleted: isSoftDeleted(raw),
    raw,
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
    recipeId ||
    '',
  ).trim();

  const bomLines = raw.bom_lines ||
    raw.bomLines ||
    raw.recipe_lines ||
    raw.recipeLines ||
    raw.details ||
    raw.items ||
    parseJson(raw.bom_lines_json, []) ||
    parseJson(raw.details_json, []) ||
    [];

  return {
    id: String(raw.id || recipeId).trim(),
    recipe_id: recipeId,
    recipe_code: recipeCode,
    recipe_name: String(raw.recipe_name || raw.recipeName || raw.bom_name || raw.name || record?.name || '').trim(),
    product_id: String(raw.product_id || raw.productId || raw.item_id || '').trim(),
    product_name: String(raw.product_name || raw.productName || raw.item_name || '').trim(),
    branch_id: String(raw.branch_id || raw.branchId || record?.branch_id || '').trim(),
    version: String(raw.version || raw.recipe_version || raw.recipeVersion || 'V1').trim(),
    recipe_type: normalizeCode(raw.recipe_type || raw.type || 'PRODUKSI'),
    yield_qty: roundQty(raw.yield_qty || raw.output_qty || 0),
    yield_unit: normalizeCode(raw.yield_unit || raw.output_unit || 'PCS'),
    status: normalizeMasterStatus(raw),
    effective_date: normalizeDate(raw.effective_date || raw.start_date || raw.date || ''),
    expired_date: normalizeDate(raw.expired_date || raw.end_date || ''),
    bom_lines: Array.isArray(bomLines) ? bomLines : [],
    isDeleted: isSoftDeleted(raw),
    raw,
  };
};

const normalizeProductionRecord = (row) => {
  const packageInput = row?.production_batch_package || row?.productionBatchPackage || row?.production_transaction_package || row || {};
  const header = packageInput.batch_header || packageInput.production_header || packageInput.header || row?.production_header || row || {};
  const snapshot = packageInput.production_snapshot || packageInput.snapshot_package || parseJson(header.production_snapshot_json, null) || null;
  const snapshotPayload = snapshot?.payload?.production_snapshot || snapshot?.payload || null;
  const snapshotHeader = snapshotPayload?.batch_header || snapshotPayload?.production_header || snapshotPayload?.transaction_header || {};

  const finalHeader = {
    ...snapshotHeader,
    ...header,
  };

  const productionId = String(finalHeader.production_id || finalHeader.batch_id || finalHeader.id || row?.production_id || row?.id || '').trim();
  const productionCode = String(finalHeader.production_code || finalHeader.batch_code || finalHeader.code || productionId || '').trim();

  const materialConsumption =
    packageInput.material_consumption ||
    packageInput.consumed_materials ||
    packageInput.consumed_layers ||
    row?.material_consumption ||
    parseJson(header.material_consumption_json, []) ||
    [];

  const finishedGoodsLayer =
    packageInput.finished_goods_layer ||
    packageInput.finishedGoodsLayer ||
    packageInput.finished_goods_package ||
    row?.finished_goods_layer ||
    parseJson(header.finished_goods_layer_json, null) ||
    null;

  const actualHpp = roundMoney(
    finalHeader.actual_hpp ||
    finalHeader.total_hpp ||
    finalHeader.production_hpp ||
    packageInput.actual_hpp ||
    packageInput.total_hpp ||
    0,
  );

  const hppPerUnit = roundMoney(
    finalHeader.hpp_per_unit ||
    finalHeader.hpp_per_pcs ||
    packageInput.hpp_per_unit ||
    packageInput.hpp_per_pcs ||
    (toNumber(finalHeader.yield_qty || finalHeader.actual_qty) > 0 ? actualHpp / toNumber(finalHeader.yield_qty || finalHeader.actual_qty) : 0),
  );

  return {
    id: String(finalHeader.id || productionId).trim(),

    production_id: productionId,
    production_code: productionCode,
    production_date: normalizeDate(finalHeader.production_date || finalHeader.date || finalHeader.created_at || row?.date || ''),

    branch_id: String(finalHeader.branch_id || finalHeader.branchId || '').trim(),
    warehouse_id: String(finalHeader.warehouse_id || finalHeader.warehouseId || '').trim(),

    recipe_id: String(finalHeader.recipe_id || finalHeader.recipeId || finalHeader.bom_id || '').trim(),
    recipe_version: String(finalHeader.recipe_version || finalHeader.recipeVersion || finalHeader.version || '').trim(),

    product_id: String(finalHeader.product_id || finalHeader.productId || finalHeader.item_id || '').trim(),
    product_name: String(finalHeader.product_name || finalHeader.productName || finalHeader.item_name || '').trim(),

    planned_qty: roundQty(finalHeader.planned_qty || finalHeader.plannedQty || finalHeader.target_qty || 0),
    actual_qty: roundQty(finalHeader.actual_qty || finalHeader.actualQty || finalHeader.output_qty || 0),
    yield_qty: roundQty(finalHeader.yield_qty || finalHeader.yieldQty || finalHeader.actual_qty || finalHeader.output_qty || 0),

    status: normalizeProductionStatus(finalHeader),
    notes: String(finalHeader.notes || finalHeader.keterangan || '').trim(),

    actual_hpp: actualHpp,
    hpp_per_unit: hppPerUnit,

    material_consumption: Array.isArray(materialConsumption) ? materialConsumption : [],
    finished_goods_layer: finishedGoodsLayer,

    created_at: finalHeader.created_at || row?.created_at || '',
    updated_at: finalHeader.updated_at || row?.updated_at || '',
    started_at: finalHeader.started_at || row?.started_at || '',
    completed_at: finalHeader.completed_at || row?.completed_at || '',
    voided_at: finalHeader.voided_at || row?.voided_at || '',

    search_text: normalizeText([
      productionId,
      productionCode,
      finalHeader.product_id,
      finalHeader.product_name,
      finalHeader.recipe_id,
      finalHeader.recipe_version,
      finalHeader.branch_id,
      finalHeader.warehouse_id,
      finalHeader.status,
    ].filter(Boolean).join(' ')),

    raw: row,
  };
};

const buildMasterSource = ({
  dbData,
  rawProductionRows,
  rawBranchRows,
  rawWarehouseRows,
  rawProductRows,
  rawRecipeRows,
  rawMaterialRows,
  rawInventoryLayerRows,
}) => {
  return {
    ...(dbData || {}),

    production_batches: rawProductionRows,
    productionBatches: rawProductionRows,
    productions: rawProductionRows,

    master_branches: rawBranchRows,
    masterBranches: rawBranchRows,
    master_branch: rawBranchRows,

    master_warehouses: rawWarehouseRows,
    masterWarehouses: rawWarehouseRows,
    warehouses: rawWarehouseRows,

    master_products: rawProductRows,
    masterProducts: rawProductRows,
    products: rawProductRows,

    master_recipe_bom: rawRecipeRows,
    masterRecipeBom: rawRecipeRows,
    recipe_bom: rawRecipeRows,
    bom: rawRecipeRows,
    recipes: rawRecipeRows,

    master_raw_materials: rawMaterialRows,
    masterRawMaterials: rawMaterialRows,
    raw_materials: rawMaterialRows,
    rawMaterials: rawMaterialRows,

    inventory_cost_layers: rawInventoryLayerRows,
    inventoryCostLayers: rawInventoryLayerRows,
    cost_layers: rawInventoryLayerRows,
  };
};

const calculateMaterialUsageQty = (production) => {
  return safeArray(production.material_consumption).reduce((sum, item) => {
    return sum + toNumber(item.consumed_qty || item.qty || item.requested_qty || item.qty_out || 0);
  }, 0);
};

const normalizeProductionPackageFromOrchestrator = (result) => {
  const base = result?.transaction_package || result?.package || result?.data || result || {};

  return {
    production_batch_package:
      base.production_batch_package ||
      base.productionBatchPackage ||
      base.production_transaction_package ||
      base.production ||
      null,

    material_consumption_package:
      base.material_consumption_package ||
      base.materialConsumptionPackage ||
      base.material_consumption ||
      base.consumed_layers ||
      null,

    hpp_package:
      base.hpp_package ||
      base.hppPackage ||
      base.production_hpp_package ||
      base.production_hpp ||
      base.hpp ||
      null,

    finished_goods_layer_package:
      base.finished_goods_layer_package ||
      base.finishedGoodsLayerPackage ||
      base.finished_goods_package ||
      base.finished_goods_layer ||
      null,

    accounting_package:
      base.accounting_package ||
      base.accountingPackage ||
      base.journal_package ||
      base.journal ||
      null,

    snapshot_package:
      base.snapshot_package ||
      base.snapshotPackage ||
      base.production_snapshot ||
      base.snapshot ||
      null,

    warnings:
      base.warnings ||
      result?.warnings ||
      [],

    raw_orchestrator_response: result,
  };
};

const normalizeVoidPackageFromOrchestrator = (result) => {
  const base = result?.transaction_package || result?.package || result?.data || result || {};

  return {
    reversal_package:
      base.reversal_package ||
      base.reversalPackage ||
      base.void_package ||
      base.voidPackage ||
      base.production_reversal_package ||
      null,

    snapshot_package:
      base.snapshot_package ||
      base.snapshotPackage ||
      base.void_snapshot ||
      base.snapshot ||
      null,

    warnings:
      base.warnings ||
      result?.warnings ||
      [],

    raw_orchestrator_response: result,
  };
};

const validateCompletedOrchestratorPackage = (packageResult) => {
  const missing = [];

  if (!packageResult.production_batch_package) missing.push('production_batch_package');
  if (!packageResult.material_consumption_package) missing.push('material_consumption_package');
  if (!packageResult.hpp_package) missing.push('hpp_package');
  if (!packageResult.finished_goods_layer_package) missing.push('finished_goods_layer_package');
  if (!packageResult.accounting_package) missing.push('accounting_package');
  if (!packageResult.snapshot_package) missing.push('snapshot_package');

  return missing;
};

const validateVoidOrchestratorPackage = (packageResult) => {
  const missing = [];

  if (!packageResult.reversal_package) missing.push('reversal_package');

  return missing;
};

const createProductionCommand = ({
  form,
  mode,
  executor,
  masterSource,
}) => {
  return {
    transaction_type: 'PRODUCTION',
    action: mode,
    mode,

    production_header: {
      production_id: form.production_id,
      production_code: form.production_code,
      production_date: form.production_date,

      branch_id: form.branch_id,
      warehouse_id: form.warehouse_id,

      recipe_id: form.recipe_id,
      recipe_version: form.recipe_version,

      product_id: form.product_id,
      product_name: form.product_name,

      planned_qty: roundQty(form.planned_qty),
      actual_qty: roundQty(form.actual_qty),
      yield_qty: roundQty(form.yield_qty),

      status:
        mode === 'START'
          ? 'IN_PROGRESS'
          : mode === 'COMPLETE'
            ? 'COMPLETED'
            : 'DRAFT',

      notes: form.notes,
      created_by: executor,
      updated_by: executor,
    },

    source: masterSource,
    dbData: masterSource,
    masterData: masterSource,
  };
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

export default function TabProduction({
  productionBatches = [],
  production_batches,
  productions,
  productionTransactions,
  production_transactions,

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

  masterProducts = [],
  master_products,
  products,
  produk,

  masterRecipeBom = [],
  master_recipe_bom,
  recipeBom,
  recipe_bom,
  bom,
  recipes,

  masterRawMaterials = [],
  master_raw_materials,
  rawMaterials,
  raw_materials,
  bahan_baku,

  inventoryCostLayers,
  inventory_cost_layers,
  costLayers,
  cost_layers,

  dbData = {},
  sendToSheet,
  showToast,
  user,
}) {
  const todayStr = getTodayStr();
  const executor = user?.name || user?.email || 'SYSTEM';

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
    production_date: todayStr,
    branch_id: isOwnerMode ? '' : userBranchId,
  });

  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [selectedProduction, setSelectedProduction] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState(isOwnerMode ? 'ALL' : userBranchId || 'ALL');
  const [productFilter, setProductFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const rawProductionRows = useMemo(() => {
    return getRawProductionRows({
      productionBatches,
      production_batches,
      productions,
      productionTransactions,
      production_transactions,
      dbData,
    });
  }, [productionBatches, production_batches, productions, productionTransactions, production_transactions, dbData]);

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

  const rawProductRows = useMemo(() => {
    return getRawProductRows({
      masterProducts,
      master_products,
      products,
      produk,
      dbData,
    });
  }, [masterProducts, master_products, products, produk, dbData]);

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

  const rawInventoryLayerRows = useMemo(() => {
    return getRawInventoryLayerRows({
      inventoryCostLayers,
      inventory_cost_layers,
      costLayers,
      cost_layers,
      dbData,
    });
  }, [inventoryCostLayers, inventory_cost_layers, costLayers, cost_layers, dbData]);

  const masterSource = useMemo(() => {
    return buildMasterSource({
      dbData,
      rawProductionRows,
      rawBranchRows,
      rawWarehouseRows,
      rawProductRows,
      rawRecipeRows,
      rawMaterialRows,
      rawInventoryLayerRows,
    });
  }, [
    dbData,
    rawProductionRows,
    rawBranchRows,
    rawWarehouseRows,
    rawProductRows,
    rawRecipeRows,
    rawMaterialRows,
    rawInventoryLayerRows,
  ]);

  const masterDataApi = erpOrchestrator?.masterData || {};

  const branchRecords = useMemo(() => {
    const result = masterDataApi.getBranches?.(masterSource, {
      includeInactive: true,
      includeDeleted: true,
      validate: false,
    }) || { records: [] };

    return (result.records || [])
      .map(normalizeBranchDisplay)
      .filter((branch) => !branch.isDeleted)
      .sort((a, b) => String(a.branch_name).localeCompare(String(b.branch_name)));
  }, [masterDataApi, masterSource]);

  const warehouseRecords = useMemo(() => {
    const result = masterDataApi.getWarehouses?.(masterSource, {
      includeInactive: true,
      includeDeleted: true,
      validate: false,
    }) || { records: [] };

    return (result.records || [])
      .map(normalizeWarehouseDisplay)
      .filter((warehouse) => !warehouse.isDeleted)
      .sort((a, b) => String(a.warehouse_name).localeCompare(String(b.warehouse_name)));
  }, [masterDataApi, masterSource]);

  const productRecords = useMemo(() => {
    const result = masterDataApi.getProducts?.(masterSource, {
      includeInactive: true,
      includeDeleted: true,
      validate: false,
    }) || { records: [] };

    return (result.records || [])
      .map(normalizeProductDisplay)
      .filter((product) => !product.isDeleted)
      .sort((a, b) => String(a.product_name).localeCompare(String(b.product_name)));
  }, [masterDataApi, masterSource]);

  const recipeRecords = useMemo(() => {
    const extractedRows = typeof masterDataApi.extractMasterRows === 'function'
      ? masterDataApi.extractMasterRows(masterSource, 'RECIPE_BOM')
      : rawRecipeRows;

    return safeArray(extractedRows)
      .map(normalizeRecipeDisplay)
      .filter((recipe) => !recipe.isDeleted)
      .sort((a, b) => String(a.recipe_name).localeCompare(String(b.recipe_name)));
  }, [masterDataApi, masterSource, rawRecipeRows]);

  const productionRecords = useMemo(() => {
    return rawProductionRows
      .map(normalizeProductionRecord)
      .sort((a, b) => {
        const dateCompare = String(b.production_date || '').localeCompare(String(a.production_date || ''));
        if (dateCompare !== 0) return dateCompare;
        return String(b.production_id || '').localeCompare(String(a.production_id || ''));
      });
  }, [rawProductionRows]);

  const effectiveBranchFilter = !isOwnerMode && userBranchId ? userBranchId : branchFilter;

  const activeBranchRecords = useMemo(() => {
    return branchRecords.filter((branch) => branch.status === 'ACTIVE');
  }, [branchRecords]);

  const activeWarehousesByBranch = useMemo(() => {
    return warehouseRecords.filter((warehouse) => {
      if (warehouse.status !== 'ACTIVE') return false;
      if (!form.branch_id) return true;
      return warehouse.branch_id === form.branch_id;
    });
  }, [warehouseRecords, form.branch_id]);

  const activeProductsByBranch = useMemo(() => {
    return productRecords.filter((product) => {
      if (product.status !== 'ACTIVE') return false;
      if (!form.branch_id) return true;
      return product.branch_id === form.branch_id;
    });
  }, [productRecords, form.branch_id]);

  const activeRecipesByProductBranch = useMemo(() => {
    return recipeRecords.filter((recipe) => {
      if (recipe.status !== 'ACTIVE') return false;
      if (form.branch_id && recipe.branch_id !== form.branch_id) return false;
      if (form.product_id && recipe.product_id !== form.product_id) return false;

      const today = form.production_date || todayStr;
      const effectiveOk = !recipe.effective_date || recipe.effective_date <= today;
      const expiredOk = !recipe.expired_date || recipe.expired_date >= today;

      return effectiveOk && expiredOk;
    });
  }, [recipeRecords, form.branch_id, form.product_id, form.production_date, todayStr]);

  const branchNameById = useMemo(() => {
    const map = new Map();

    branchRecords.forEach((branch) => {
      map.set(branch.branch_id, branch.branch_name || branch.branch_id);
      map.set(branch.branch_code, branch.branch_name || branch.branch_id);
    });

    return map;
  }, [branchRecords]);

  const warehouseNameById = useMemo(() => {
    const map = new Map();

    warehouseRecords.forEach((warehouse) => {
      map.set(warehouse.warehouse_id, warehouse.warehouse_name || warehouse.warehouse_id);
      map.set(warehouse.warehouse_code, warehouse.warehouse_name || warehouse.warehouse_id);
    });

    return map;
  }, [warehouseRecords]);

  const productNameById = useMemo(() => {
    const map = new Map();

    productRecords.forEach((product) => {
      map.set(product.product_id, product.product_name || product.product_id);
      map.set(product.product_code, product.product_name || product.product_id);
    });

    return map;
  }, [productRecords]);

  const recipeNameById = useMemo(() => {
    const map = new Map();

    recipeRecords.forEach((recipe) => {
      map.set(recipe.recipe_id, recipe.recipe_name || recipe.recipe_id);
      map.set(recipe.recipe_code, recipe.recipe_name || recipe.recipe_id);
    });

    return map;
  }, [recipeRecords]);

  const filteredProductions = useMemo(() => {
    const keyword = normalizeText(searchQuery);

    return productionRecords.filter((production) => {
      const branchOk = effectiveBranchFilter === 'ALL' || production.branch_id === effectiveBranchFilter;
      const productOk = productFilter === 'ALL' || production.product_id === productFilter;
      const statusOk = statusFilter === 'ALL' || production.status === statusFilter;
      const searchOk = !keyword || production.search_text.includes(keyword);

      return branchOk && productOk && statusOk && searchOk;
    });
  }, [productionRecords, effectiveBranchFilter, productFilter, statusFilter, searchQuery]);

  const analytics = useMemo(() => {
    const scoped = productionRecords.filter((production) => {
      if (production.status === 'VOID' || production.status === 'CANCELLED') return false;
      if (effectiveBranchFilter === 'ALL') return true;
      return production.branch_id === effectiveBranchFilter;
    });

    const completed = scoped.filter((production) => production.status === 'COMPLETED');
    const totalFinishedGoods = completed.reduce((sum, production) => sum + toNumber(production.yield_qty || production.actual_qty), 0);
    const totalMaterialUsed = completed.reduce((sum, production) => sum + calculateMaterialUsageQty(production), 0);
    const totalHpp = completed.reduce((sum, production) => sum + toNumber(production.actual_hpp), 0);
    const averageHpp = totalFinishedGoods > 0 ? totalHpp / totalFinishedGoods : 0;

    const productMap = new Map();

    completed.forEach((production) => {
      const key = production.product_id || production.product_name || 'UNKNOWN';

      if (!productMap.has(key)) {
        productMap.set(key, {
          product_id: production.product_id,
          product_name: production.product_name || productNameById.get(production.product_id) || key,
          total_qty: 0,
          total_batches: 0,
          total_hpp: 0,
        });
      }

      const row = productMap.get(key);
      row.total_qty += toNumber(production.yield_qty || production.actual_qty);
      row.total_batches += 1;
      row.total_hpp += toNumber(production.actual_hpp);
    });

    const topProduct = Array.from(productMap.values())
      .sort((a, b) => b.total_qty - a.total_qty)[0] || null;

    return {
      total_produksi: completed.length,
      total_finished_goods: roundQty(totalFinishedGoods),
      total_bahan_terpakai: roundQty(totalMaterialUsed),
      rata_rata_hpp: roundMoney(averageHpp),
      draft_count: scoped.filter((production) => production.status === 'DRAFT').length,
      in_progress_count: scoped.filter((production) => production.status === 'IN_PROGRESS').length,
      void_count: productionRecords.filter((production) => production.status === 'VOID').length,
      top_produk_diproduksi: topProduct,
    };
  }, [productionRecords, effectiveBranchFilter, productNameById]);

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
      production_date: todayStr,
      branch_id: isOwnerMode ? '' : userBranchId,
    });
    setIsEditingDraft(false);
    setSelectedProduction(null);
  };

  const handleGenerateId = () => {
    const newId = generateId('PRDCT', todayStr);

    setForm((prev) => ({
      ...prev,
      id: prev.id || newId,
      production_id: prev.production_id || newId,
      production_code: prev.production_code || newId,
    }));
  };

  const handleBranchChange = (branchId) => {
    setForm((prev) => ({
      ...prev,
      branch_id: branchId,
      warehouse_id: '',
      product_id: '',
      product_name: '',
      recipe_id: '',
      recipe_version: '',
    }));
  };

  const handleProductChange = (productId) => {
    const product = productRecords.find((item) => item.product_id === productId);

    setForm((prev) => ({
      ...prev,
      product_id: productId,
      product_name: product?.product_name || '',
      warehouse_id: product?.default_warehouse_id || prev.warehouse_id,
      recipe_id: '',
      recipe_version: '',
    }));
  };

  const handleRecipeChange = (recipeId) => {
    const recipe = recipeRecords.find((item) => item.recipe_id === recipeId);

    setForm((prev) => ({
      ...prev,
      recipe_id: recipeId,
      recipe_version: recipe?.version || '',
      product_id: recipe?.product_id || prev.product_id,
      product_name: recipe?.product_name || productNameById.get(recipe?.product_id) || prev.product_name,
      planned_qty: prev.planned_qty || String(recipe?.yield_qty || ''),
      actual_qty: prev.actual_qty || String(recipe?.yield_qty || ''),
      yield_qty: prev.yield_qty || String(recipe?.yield_qty || ''),
    }));
  };

  const validateProductionForm = ({ action = 'DRAFT' } = {}) => {
    const warnings = [];

    if (!form.production_id.trim()) warnings.push('Production ID wajib diisi.');
    if (!form.production_code.trim()) warnings.push('Production Code wajib diisi.');
    if (!form.production_date.trim()) warnings.push('Tanggal produksi wajib diisi.');
    if (!form.branch_id.trim()) warnings.push('Branch ID wajib dipilih.');
    if (!form.warehouse_id.trim()) warnings.push('Warehouse ID wajib dipilih.');
    if (!form.recipe_id.trim()) warnings.push('Recipe ID wajib dipilih.');
    if (!form.recipe_version.trim()) warnings.push('Recipe Version wajib terisi.');
    if (!form.product_id.trim()) warnings.push('Product ID wajib dipilih.');
    if (!form.product_name.trim()) warnings.push('Nama produk wajib terisi.');
    if (toNumber(form.planned_qty) <= 0) warnings.push('Planned Qty wajib lebih dari 0.');

    if (action === 'COMPLETE') {
      if (toNumber(form.actual_qty) <= 0) warnings.push('Actual Qty wajib lebih dari 0 saat complete.');
      if (toNumber(form.yield_qty) <= 0) warnings.push('Yield Qty wajib lebih dari 0 saat complete.');
    }

    const branchExists = branchRecords.some((branch) => {
      return branch.branch_id === form.branch_id &&
        branch.status === 'ACTIVE' &&
        !branch.isDeleted;
    });

    if (form.branch_id && !branchExists) {
      warnings.push('Cabang tidak ditemukan atau tidak aktif.');
    }

    const warehouseExists = warehouseRecords.some((warehouse) => {
      return warehouse.warehouse_id === form.warehouse_id &&
        warehouse.branch_id === form.branch_id &&
        warehouse.status === 'ACTIVE' &&
        !warehouse.isDeleted;
    });

    if (form.warehouse_id && !warehouseExists) {
      warnings.push('Warehouse tidak ditemukan atau tidak aktif di cabang yang dipilih.');
    }

    const productExists = productRecords.some((product) => {
      return product.product_id === form.product_id &&
        product.branch_id === form.branch_id &&
        product.status === 'ACTIVE' &&
        !product.isDeleted;
    });

    if (form.product_id && !productExists) {
      warnings.push('Produk tidak ditemukan atau tidak aktif di cabang yang dipilih.');
    }

    const recipeExists = recipeRecords.some((recipe) => {
      return recipe.recipe_id === form.recipe_id &&
        recipe.product_id === form.product_id &&
        recipe.branch_id === form.branch_id &&
        recipe.status === 'ACTIVE' &&
        !recipe.isDeleted;
    });

    if (form.recipe_id && !recipeExists) {
      warnings.push('Resep aktif tidak ditemukan untuk produk dan cabang yang dipilih.');
    }

    if (!isOwnerMode && userBranchId && form.branch_id !== userBranchId) {
      warnings.push('User cabang hanya boleh membuat produksi di branch miliknya.');
    }

    return warnings;
  };

  const persistProduction = async (action, payload) => {
    if (typeof sendToSheet !== 'function') {
      notify('sendToSheet belum tersedia. Data produksi belum bisa disimpan ke cloud.', 'error');
      return false;
    }

    let isSuccess = false;

    try {
      isSuccess = await sendToSheet(action, PRODUCTION_TABLE_NAME, payload);
    } catch (error) {
      isSuccess = false;
    }

    if (!isSuccess) {
      try {
        isSuccess = await sendToSheet(action, payload, PRODUCTION_TABLE_NAME);
      } catch (error) {
        isSuccess = false;
      }
    }

    return Boolean(isSuccess);
  };

  const runProcessProduction = async ({ mode }) => {
    if (!erpOrchestrator || typeof erpOrchestrator.processProduction !== 'function') {
      return {
        ok: false,
        message: 'erpOrchestrator.processProduction() belum tersedia. Revisi harus dilakukan di src/services/erpOrchestrator.js.',
      };
    }

    const command = createProductionCommand({
      form,
      mode,
      executor,
      masterSource,
    });

    try {
      const result = await Promise.resolve(
        erpOrchestrator.processProduction(command, {
          source: masterSource,
          dbData: masterSource,
          masterData: masterSource,
          executor,
          mode,
        }),
      );

      if (result?.ok === false) {
        return {
          ok: false,
          message: result.message || result.error || 'erpOrchestrator.processProduction() mengembalikan status tidak OK.',
        };
      }

      const packageResult = normalizeProductionPackageFromOrchestrator(result);

      if (mode === 'COMPLETE') {
        const missing = validateCompletedOrchestratorPackage(packageResult);

        if (missing.length > 0) {
          return {
            ok: false,
            message: `Package orchestrator produksi belum lengkap: ${missing.join(', ')}. Revisi alur di src/services/erpOrchestrator.js, bukan di UI.`,
          };
        }
      }

      return {
        ok: true,
        packageResult,
      };
    } catch (error) {
      return {
        ok: false,
        message: error.message || 'erpOrchestrator.processProduction() gagal dijalankan.',
      };
    }
  };

  const createLocalPayload = ({
    status,
    packageResult = null,
    voidPackageResult = null,
  }) => {
    return {
      ...(selectedProduction?.raw || {}),

      id: selectedProduction?.id || form.production_id,
      date: selectedProduction?.raw?.date || todayStr,

      production_id: form.production_id,
      production_code: form.production_code,
      production_date: form.production_date,

      branch_id: form.branch_id,
      warehouse_id: form.warehouse_id,

      recipe_id: form.recipe_id,
      recipe_version: form.recipe_version,

      product_id: form.product_id,
      product_name: form.product_name,

      planned_qty: roundQty(form.planned_qty),
      actual_qty: roundQty(form.actual_qty),
      yield_qty: roundQty(form.yield_qty),

      status,
      production_status: status,

      notes: form.notes,

      production_batch_package: packageResult?.production_batch_package || selectedProduction?.raw?.production_batch_package || null,
      production_batch_package_json: packageResult?.production_batch_package ? JSON.stringify(packageResult.production_batch_package) : selectedProduction?.raw?.production_batch_package_json || '',

      material_consumption_package: packageResult?.material_consumption_package || selectedProduction?.raw?.material_consumption_package || null,
      material_consumption_package_json: packageResult?.material_consumption_package ? JSON.stringify(packageResult.material_consumption_package) : selectedProduction?.raw?.material_consumption_package_json || '',

      hpp_package: packageResult?.hpp_package || selectedProduction?.raw?.hpp_package || null,
      hpp_package_json: packageResult?.hpp_package ? JSON.stringify(packageResult.hpp_package) : selectedProduction?.raw?.hpp_package_json || '',

      finished_goods_layer_package: packageResult?.finished_goods_layer_package || selectedProduction?.raw?.finished_goods_layer_package || null,
      finished_goods_layer_package_json: packageResult?.finished_goods_layer_package ? JSON.stringify(packageResult.finished_goods_layer_package) : selectedProduction?.raw?.finished_goods_layer_package_json || '',

      accounting_package: packageResult?.accounting_package || selectedProduction?.raw?.accounting_package || null,
      accounting_package_json: packageResult?.accounting_package ? JSON.stringify(packageResult.accounting_package) : selectedProduction?.raw?.accounting_package_json || '',

      snapshot_package: packageResult?.snapshot_package || voidPackageResult?.snapshot_package || selectedProduction?.raw?.snapshot_package || null,
      snapshot_package_json: packageResult?.snapshot_package
        ? JSON.stringify(packageResult.snapshot_package)
        : voidPackageResult?.snapshot_package
          ? JSON.stringify(voidPackageResult.snapshot_package)
          : selectedProduction?.raw?.snapshot_package_json || '',

      reversal_package: voidPackageResult?.reversal_package || selectedProduction?.raw?.reversal_package || null,
      reversal_package_json: voidPackageResult?.reversal_package ? JSON.stringify(voidPackageResult.reversal_package) : selectedProduction?.raw?.reversal_package_json || '',

      actual_hpp: packageResult?.hpp_package?.actual_hpp || packageResult?.hpp_package?.total_hpp || selectedProduction?.raw?.actual_hpp || 0,
      hpp_per_unit: packageResult?.hpp_package?.hpp_per_unit || packageResult?.hpp_package?.hpp_per_pcs || selectedProduction?.raw?.hpp_per_unit || 0,

      orchestrator_response_json: packageResult?.raw_orchestrator_response
        ? JSON.stringify(packageResult.raw_orchestrator_response)
        : voidPackageResult?.raw_orchestrator_response
          ? JSON.stringify(voidPackageResult.raw_orchestrator_response)
          : selectedProduction?.raw?.orchestrator_response_json || '',

      engine_warnings_json: packageResult?.warnings
        ? JSON.stringify(packageResult.warnings)
        : voidPackageResult?.warnings
          ? JSON.stringify(voidPackageResult.warnings)
          : selectedProduction?.raw?.engine_warnings_json || '',

      created_at: selectedProduction?.raw?.created_at || new Date().toISOString(),
      created_by: selectedProduction?.raw?.created_by || executor,
      updated_at: new Date().toISOString(),
      updated_by: executor,

      started_at: status === 'IN_PROGRESS' ? selectedProduction?.raw?.started_at || new Date().toISOString() : selectedProduction?.raw?.started_at || '',
      started_by: status === 'IN_PROGRESS' ? selectedProduction?.raw?.started_by || executor : selectedProduction?.raw?.started_by || '',

      completed_at: status === 'COMPLETED' ? selectedProduction?.raw?.completed_at || new Date().toISOString() : selectedProduction?.raw?.completed_at || '',
      completed_by: status === 'COMPLETED' ? selectedProduction?.raw?.completed_by || executor : selectedProduction?.raw?.completed_by || '',

      voided_at: status === 'VOID' ? new Date().toISOString() : selectedProduction?.raw?.voided_at || '',
      voided_by: status === 'VOID' ? executor : selectedProduction?.raw?.voided_by || '',
    };
  };

  const handleSaveDraft = async () => {
    const warnings = validateProductionForm({ action: 'DRAFT' });

    if (warnings.length > 0) {
      notify(warnings.join('\n'), 'error');
      return;
    }

    const orchestratorResult = await runProcessProduction({ mode: 'DRAFT' });

    if (!orchestratorResult.ok) {
      notify(orchestratorResult.message, 'error');
      return;
    }

    const payload = createLocalPayload({
      status: 'DRAFT',
      packageResult: orchestratorResult.packageResult,
    });

    const action = isEditingDraft ? 'update' : 'insert';
    const isSuccess = await persistProduction(action, payload);

    if (isSuccess) {
      notify(isEditingDraft ? 'Draft produksi berhasil diperbarui.' : 'Draft produksi berhasil dibuat.', 'success');
      resetForm();
    }
  };

  const handleStartProduction = async () => {
    const warnings = validateProductionForm({ action: 'START' });

    if (warnings.length > 0) {
      notify(warnings.join('\n'), 'error');
      return;
    }

    const confirmed = window.confirm('Start production? Status akan menjadi IN_PROGRESS.');

    if (!confirmed) return;

    const orchestratorResult = await runProcessProduction({ mode: 'START' });

    if (!orchestratorResult.ok) {
      notify(orchestratorResult.message, 'error');
      return;
    }

    const payload = createLocalPayload({
      status: 'IN_PROGRESS',
      packageResult: orchestratorResult.packageResult,
    });

    const action = isEditingDraft ? 'update' : 'insert';
    const isSuccess = await persistProduction(action, payload);

    if (isSuccess) {
      notify('Produksi berhasil dimulai melalui erpOrchestrator.', 'success');
      resetForm();
    }
  };

  const handleCompleteProduction = async () => {
    const warnings = validateProductionForm({ action: 'COMPLETE' });

    if (warnings.length > 0) {
      notify(warnings.join('\n'), 'error');
      return;
    }

    const confirmed = window.confirm(
      'Complete production? Orchestrator akan mengambil BOM aktif, consume FIFO bahan, hitung HPP aktual, tambah finished goods layer, buat jurnal WIP, dan snapshot.',
    );

    if (!confirmed) return;

    const orchestratorResult = await runProcessProduction({ mode: 'COMPLETE' });

    if (!orchestratorResult.ok) {
      notify(orchestratorResult.message, 'error');
      return;
    }

    const payload = createLocalPayload({
      status: 'COMPLETED',
      packageResult: orchestratorResult.packageResult,
    });

    const action = isEditingDraft ? 'update' : 'insert';
    const isSuccess = await persistProduction(action, payload);

    if (isSuccess) {
      notify('Produksi berhasil completed melalui erpOrchestrator. FIFO, HPP, finished goods, jurnal, dan snapshot dibuat oleh orchestrator.', 'success');
      resetForm();
    }
  };

  const handleEditDraft = (production) => {
    if (production.status !== 'DRAFT') {
      notify('Hanya transaksi DRAFT yang boleh diedit.', 'error');
      return;
    }

    setSelectedProduction(production);
    setIsEditingDraft(true);

    setForm({
      id: production.id || production.production_id,
      production_id: production.production_id,
      production_code: production.production_code,
      production_date: production.production_date || todayStr,
      branch_id: production.branch_id,
      warehouse_id: production.warehouse_id,
      recipe_id: production.recipe_id,
      recipe_version: production.recipe_version,
      product_id: production.product_id,
      product_name: production.product_name,
      planned_qty: String(production.planned_qty || ''),
      actual_qty: String(production.actual_qty || ''),
      yield_qty: String(production.yield_qty || ''),
      status: 'DRAFT',
      notes: production.notes || '',
    });
  };

  const handleCloneProduction = (production) => {
    const newId = generateId('PRDCT', todayStr);

    setSelectedProduction(null);
    setIsEditingDraft(false);

    setForm({
      id: newId,
      production_id: newId,
      production_code: `${normalizeCode(production.production_code || production.production_id)}-CLONE`,
      production_date: todayStr,
      branch_id: production.branch_id,
      warehouse_id: production.warehouse_id,
      recipe_id: production.recipe_id,
      recipe_version: production.recipe_version,
      product_id: production.product_id,
      product_name: production.product_name,
      planned_qty: String(production.planned_qty || ''),
      actual_qty: '',
      yield_qty: '',
      status: 'DRAFT',
      notes: production.notes || '',
    });
  };

  const runProcessVoidTransaction = async (production) => {
    if (!erpOrchestrator || typeof erpOrchestrator.processVoidTransaction !== 'function') {
      return {
        ok: false,
        message: 'erpOrchestrator.processVoidTransaction() belum tersedia. Revisi harus dilakukan di src/services/erpOrchestrator.js.',
      };
    }

    try {
      const result = await Promise.resolve(
        erpOrchestrator.processVoidTransaction({
          transaction_type: 'PRODUCTION',
          transaction_id: production.production_id,
          transaction_code: production.production_code,
          branch_id: production.branch_id,
          original_transaction: production.raw,
          reason: 'VOID_PRODUCTION_FROM_UI',
          source: masterSource,
          dbData: masterSource,
          masterData: masterSource,
        }, {
          source: masterSource,
          dbData: masterSource,
          masterData: masterSource,
          executor,
        }),
      );

      if (result?.ok === false) {
        return {
          ok: false,
          message: result.message || result.error || 'erpOrchestrator.processVoidTransaction() mengembalikan status tidak OK.',
        };
      }

      const packageResult = normalizeVoidPackageFromOrchestrator(result);
      const missing = validateVoidOrchestratorPackage(packageResult);

      if (missing.length > 0) {
        return {
          ok: false,
          message: `Package void orchestrator belum lengkap: ${missing.join(', ')}. Revisi alur di src/services/erpOrchestrator.js, bukan di UI.`,
        };
      }

      return {
        ok: true,
        packageResult,
      };
    } catch (error) {
      return {
        ok: false,
        message: error.message || 'erpOrchestrator.processVoidTransaction() gagal dijalankan.',
      };
    }
  };

  const handleVoidProduction = async (production) => {
    if (!['IN_PROGRESS', 'COMPLETED'].includes(production.status)) {
      notify('Hanya transaksi IN_PROGRESS atau COMPLETED yang bisa di-void.', 'error');
      return;
    }

    const confirmed = window.confirm(
      `Void produksi ${production.production_code || production.production_id}? Histori tidak dihapus, orchestrator akan membuat reversal package.`,
    );

    if (!confirmed) return;

    const voidResult = await runProcessVoidTransaction(production);

    if (!voidResult.ok) {
      notify(voidResult.message, 'error');
      return;
    }

    const payload = {
      ...(production.raw || {}),
      id: production.id || production.production_id,
      production_id: production.production_id,
      status: 'VOID',
      production_status: 'VOID',
      reversal_package: voidResult.packageResult.reversal_package,
      reversal_package_json: JSON.stringify(voidResult.packageResult.reversal_package),
      void_snapshot_package: voidResult.packageResult.snapshot_package || null,
      void_snapshot_package_json: voidResult.packageResult.snapshot_package ? JSON.stringify(voidResult.packageResult.snapshot_package) : '',
      void_orchestrator_response_json: JSON.stringify(voidResult.packageResult.raw_orchestrator_response),
      void_engine_warnings_json: JSON.stringify(voidResult.packageResult.warnings || []),
      voided_at: new Date().toISOString(),
      voided_by: executor,
      updated_at: new Date().toISOString(),
      updated_by: executor,
    };

    const isSuccess = await persistProduction('update', payload);

    if (isSuccess) {
      notify('Produksi berhasil di-void melalui erpOrchestrator. Reversal package dibuat oleh orchestrator.', 'success');
      if (selectedProduction?.production_id === production.production_id) resetForm();
    }
  };

  const handleCancelDraft = async (production) => {
    if (production.status !== 'DRAFT') {
      notify('Hanya DRAFT yang bisa dibatalkan langsung.', 'error');
      return;
    }

    const confirmed = window.confirm(`Batalkan draft produksi ${production.production_code || production.production_id}?`);

    if (!confirmed) return;

    const payload = {
      ...(production.raw || {}),
      id: production.id || production.production_id,
      production_id: production.production_id,
      status: 'CANCELLED',
      production_status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
      cancelled_by: executor,
      updated_at: new Date().toISOString(),
      updated_by: executor,
    };

    const isSuccess = await persistProduction('update', payload);

    if (isSuccess) {
      notify('Draft produksi berhasil dibatalkan.', 'success');
      if (selectedProduction?.production_id === production.production_id) resetForm();
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
                <Factory size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                Modul Production ERP
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              Produksi Resmi Dimsum Aditya
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-300">
              Thin UI produksi. Semua BOM aktif, FIFO bahan, HPP aktual, finished goods, jurnal WIP, dan snapshot wajib dibuat oleh erpOrchestrator.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">{isOwnerMode ? 'Owner Mode Lintas Cabang' : 'Branch Mode'}</Badge>
            <Badge tone="amber">Thin UI</Badge>
            <Badge tone="green">Orchestrator Only</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Produksi" value={analytics.total_produksi} icon={<Factory size={18} />} tone="red" />
        <StatCard title="Finished Goods" value={analytics.total_finished_goods.toLocaleString('id-ID')} icon={<PackageCheck size={18} />} tone="white" />
        <StatCard title="Bahan Terpakai" value={analytics.total_bahan_terpakai.toLocaleString('id-ID')} icon={<Layers size={18} />} tone="gold" />
        <StatCard title="Rata-rata HPP" value={formatMoney(analytics.rata_rata_hpp)} icon={<BadgeDollarSign size={18} />} tone="white" />
        <StatCard title="Draft / Progress" value={`${analytics.draft_count} / ${analytics.in_progress_count}`} icon={<History size={18} />} tone="dark" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-red-50 p-3 text-red-600">
              <Crown size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Top Produk Diproduksi</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.top_produk_diproduksi?.product_name || '-'}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                {formatQty(analytics.top_produk_diproduksi?.total_qty || 0, 'PCS')}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
              <ClipboardList size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Resep Aktif Tersedia</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {activeRecipesByProductBranch.length}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                Sesuai branch & produk form
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <Activity size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Void Production</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.void_count}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                Reversal via orchestrator
              </div>
            </div>
          </div>
        </div>
      </div>

      {analytics.in_progress_count > 0 && (
        <div className="rounded-[2rem] border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-3 text-amber-700 shadow-sm">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black text-amber-900">PRODUCTION IN PROGRESS</h2>
                <p className="mt-1 text-xs font-bold text-amber-700">
                  Ada {analytics.in_progress_count} produksi berjalan. Selesaikan atau void melalui orchestrator agar histori tetap valid.
                </p>
              </div>
            </div>
            <Badge tone="amber">WIP Monitoring</Badge>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
                  {isEditingDraft ? <Edit2 size={16} className="text-red-600" /> : <Plus size={16} className="text-red-600" />}
                  {isEditingDraft ? 'Edit Draft Produksi' : 'Tambah Produksi'}
                </h2>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  DRAFT editable. COMPLETE locked. VOID via reversal package.
                </p>
              </div>

              {isEditingDraft && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl bg-slate-100 p-2 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Production ID" required>
                  <div className="flex gap-2">
                    <input
                      disabled={isEditingDraft}
                      value={form.production_id}
                      onChange={(event) => setForm({ ...form, production_id: normalizeCode(event.target.value), id: normalizeCode(event.target.value) })}
                      className={inputClass}
                      placeholder="PRDCT-001"
                    />
                    {!isEditingDraft && (
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

                <Field label="Production Code" required>
                  <input
                    value={form.production_code}
                    onChange={(event) => setForm({ ...form, production_code: normalizeCode(event.target.value) })}
                    className={inputClass}
                    placeholder="PROD-DIMSUM-001"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Tanggal" required>
                  <input
                    type="date"
                    value={form.production_date}
                    onChange={(event) => setForm({ ...form, production_date: event.target.value })}
                    className={inputClass}
                  />
                </Field>

                <Field label="Status">
                  <input
                    disabled
                    value={form.status}
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Cabang" required>
                <select
                  disabled={!isOwnerMode && Boolean(userBranchId)}
                  value={form.branch_id}
                  onChange={(event) => handleBranchChange(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Pilih cabang</option>
                  {activeBranchRecords.map((branch) => (
                    <option key={branch.branch_id} value={branch.branch_id}>
                      {branch.branch_name} — {branch.branch_id}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Finished Goods Warehouse" required>
                <select
                  value={form.warehouse_id}
                  onChange={(event) => setForm({ ...form, warehouse_id: event.target.value })}
                  className={inputClass}
                >
                  <option value="">Pilih gudang hasil produksi</option>
                  {activeWarehousesByBranch.map((warehouse) => (
                    <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                      {warehouse.warehouse_name} — {warehouse.warehouse_id}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Produk Produksi" required>
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
              </Field>

              <Field label="Resep BOM Aktif" required>
                <select
                  value={form.recipe_id}
                  onChange={(event) => handleRecipeChange(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Pilih resep aktif</option>
                  {activeRecipesByProductBranch.map((recipe) => (
                    <option key={recipe.recipe_id} value={recipe.recipe_id}>
                      {recipe.recipe_name} — {recipe.version}
                    </option>
                  ))}
                </select>
                {form.branch_id && form.product_id && activeRecipesByProductBranch.length === 0 && (
                  <div className="mt-2 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700">
                    Belum ada resep aktif untuk produk dan cabang ini.
                  </div>
                )}
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Recipe Version" required>
                  <input
                    value={form.recipe_version}
                    onChange={(event) => setForm({ ...form, recipe_version: normalizeCode(event.target.value) })}
                    className={inputClass}
                    placeholder="V1"
                  />
                </Field>

                <Field label="Planned Qty" required>
                  <input
                    value={form.planned_qty}
                    onChange={(event) => setForm({ ...form, planned_qty: event.target.value })}
                    className={inputClass}
                    placeholder="1000"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Actual Qty">
                  <input
                    value={form.actual_qty}
                    onChange={(event) => setForm({ ...form, actual_qty: event.target.value })}
                    className={inputClass}
                    placeholder="1000"
                  />
                </Field>

                <Field label="Yield Qty">
                  <input
                    value={form.yield_qty}
                    onChange={(event) => setForm({ ...form, yield_qty: event.target.value })}
                    className={inputClass}
                    placeholder="1000"
                  />
                </Field>
              </div>

              <Field label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Catatan produksi..."
                />
              </Field>

              <div className="rounded-[2rem] border border-amber-100 bg-amber-50 p-4">
                <div className="grid grid-cols-2 gap-3 text-[11px] font-bold">
                  <div className="text-amber-700">Produk</div>
                  <div className="text-right text-amber-950">{form.product_name || '-'}</div>

                  <div className="text-amber-700">Recipe</div>
                  <div className="text-right text-amber-950">{form.recipe_id || '-'}</div>

                  <div className="text-amber-700">Planned Qty</div>
                  <div className="text-right text-amber-950">{roundQty(form.planned_qty).toLocaleString('id-ID')}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-700 shadow-sm transition-all hover:bg-slate-50"
                >
                  <Save size={16} />
                  Draft
                </button>

                <button
                  type="button"
                  onClick={handleStartProduction}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-amber-700 shadow-sm transition-all hover:bg-amber-100"
                >
                  <Play size={16} />
                  Start
                </button>

                <button
                  type="button"
                  onClick={handleCompleteProduction}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-sm transition-all hover:bg-red-700"
                >
                  <Flag size={16} />
                  Complete
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-8">
          <div className="rounded-[2rem] border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <ShieldCheck size={17} className="text-red-600" />
                    Daftar Produksi Resmi
                  </h2>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    Data produksi terkunci: DRAFT editable, COMPLETE locked, VOID reversal.
                  </p>
                </div>

                <div className="flex flex-col gap-2 2xl:flex-row">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-xs font-bold outline-none transition-all placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50 md:w-64"
                      placeholder="Cari produksi, produk, resep..."
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
                        <option value="ALL">SEMUA STATUS</option>
                        {PRODUCTION_STATUS.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
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

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Produksi</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Produk / Resep</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cabang / Gudang</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Qty</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">HPP</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Material</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Status</th>
                    <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProductions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-14 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-red-50 text-red-600">
                          <Factory size={24} />
                        </div>
                        <div className="mt-3 text-sm font-black text-slate-800">Transaksi produksi tidak ditemukan</div>
                        <div className="mt-1 text-xs font-semibold text-slate-400">
                          Ubah filter atau buat produksi baru.
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredProductions.map((production) => {
                    const isDraft = production.status === 'DRAFT';
                    const isProgress = production.status === 'IN_PROGRESS';
                    const isCompleted = production.status === 'COMPLETED';
                    const isVoid = production.status === 'VOID';
                    const isCancelled = production.status === 'CANCELLED';

                    const branchName = branchNameById.get(production.branch_id) || 'Branch tidak ditemukan';
                    const warehouseName = warehouseNameById.get(production.warehouse_id) || 'Gudang tidak ditemukan';
                    const productName = productNameById.get(production.product_id) || production.product_name || 'Produk tidak ditemukan';
                    const recipeName = recipeNameById.get(production.recipe_id) || production.recipe_id || '-';
                    const materialUsed = calculateMaterialUsageQty(production);

                    return (
                      <tr key={`${production.production_id}-${production.production_code}`} className="border-b border-slate-100 transition-colors hover:bg-red-50/30">
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                              isCompleted ? 'bg-red-600 text-white' : isProgress ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              <Factory size={18} />
                            </div>
                            <div>
                              <div className="font-black text-slate-900">{production.production_code || production.production_id}</div>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                <Badge tone="slate">{production.production_id || '-'}</Badge>
                              </div>
                              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                                <CalendarClock size={12} />
                                {production.production_date ? formatDate(production.production_date) : '-'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <PackageCheck size={15} className="mt-0.5 shrink-0 text-slate-400" />
                              <div>
                                <div className="text-xs font-black text-slate-900">{productName}</div>
                                <div className="mt-1 text-[11px] font-semibold text-slate-400">{production.product_id || '-'}</div>
                              </div>
                            </div>

                            <div className="flex items-start gap-2">
                              <ClipboardList size={15} className="mt-0.5 shrink-0 text-slate-400" />
                              <div>
                                <div className="text-xs font-black text-slate-900">{recipeName}</div>
                                <div className="mt-1 text-[11px] font-semibold text-slate-400">
                                  {production.recipe_id || '-'} / {production.recipe_version || '-'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="space-y-2 text-[11px] font-bold">
                            <div className="flex items-start gap-2">
                              <Building2 size={14} className="mt-0.5 shrink-0 text-slate-400" />
                              <div>
                                <div className="text-slate-800">{branchName}</div>
                                <div className="text-slate-400">{production.branch_id || '-'}</div>
                              </div>
                            </div>

                            <div className="flex items-start gap-2">
                              <Warehouse size={14} className="mt-0.5 shrink-0 text-slate-400" />
                              <div>
                                <div className="text-slate-800">{warehouseName}</div>
                                <div className="text-slate-400">{production.warehouse_id || '-'}</div>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-bold">
                            <div className="text-slate-400">Plan</div>
                            <div className="text-right text-slate-900">{production.planned_qty.toLocaleString('id-ID')}</div>

                            <div className="text-slate-400">Actual</div>
                            <div className="text-right text-slate-900">{production.actual_qty.toLocaleString('id-ID')}</div>

                            <div className="text-slate-400">Yield</div>
                            <div className="text-right text-emerald-700">{production.yield_qty.toLocaleString('id-ID')}</div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="text-sm font-black text-slate-900">{formatMoney(production.actual_hpp)}</div>
                          <div className="mt-1 text-[11px] font-bold text-slate-400">
                            Per unit {formatMoney(production.hpp_per_unit)}
                          </div>
                          {isCompleted && (
                            <div className="mt-2">
                              <Badge tone="green">HPP LOCKED</Badge>
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="text-sm font-black text-slate-900">
                            {safeArray(production.material_consumption).length} row
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-slate-400">
                            Used {materialUsed.toLocaleString('id-ID')}
                          </div>
                          {isCompleted && (
                            <div className="mt-2">
                              <Badge tone="red">FIFO CONSUMED</Badge>
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 align-top">
                          <Badge tone={isCompleted ? 'green' : isProgress ? 'amber' : isVoid ? 'dark' : isDraft ? 'slate' : 'purple'}>
                            {production.status}
                          </Badge>
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                            <History size={12} />
                            {production.updated_at ? formatDate(production.updated_at) : production.production_date ? formatDate(production.production_date) : '-'}
                          </div>
                          {isCompleted && (
                            <div className="mt-2">
                              <Badge tone="red">ORCHESTRATOR COMPLETED</Badge>
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            {isDraft && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEditDraft(production)}
                                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                                  title="Edit draft"
                                >
                                  <Edit2 size={15} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleCancelDraft(production)}
                                  className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-amber-700 transition-all hover:bg-amber-100"
                                  title="Cancel draft"
                                >
                                  <X size={15} />
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => handleCloneProduction(production)}
                              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-amber-100 hover:bg-amber-50 hover:text-amber-700"
                              title="Clone production"
                            >
                              <Copy size={15} />
                            </button>

                            {(isProgress || isCompleted) && (
                              <button
                                type="button"
                                onClick={() => handleVoidProduction(production)}
                                className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100"
                                title="Void produksi"
                              >
                                <Undo2 size={15} />
                              </button>
                            )}

                            {(isVoid || isCancelled) && (
                              <Badge tone="dark">Locked</Badge>
                            )}

                            <button
                              type="button"
                              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500"
                              title="Snapshot/package tersedia"
                            >
                              <FileText size={15} />
                            </button>
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
                Menampilkan <span className="text-slate-800">{filteredProductions.length}</span> dari <span className="text-slate-800">{productionRecords.length}</span> transaksi produksi.
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge tone="red">Merah = Completed via Orchestrator</Badge>
                <Badge tone="amber">Gold = In Progress</Badge>
                <Badge tone="dark">Dark = Void / Locked</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
