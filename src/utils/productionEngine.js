/**
 * ERP DIMSUM ADITYA V2
 * Business Engine: productionEngine.js
 *
 * Purpose:
 * - Business Engine resmi untuk seluruh aktivitas produksi.
 * - Produksi = konsumsi bahan baku → finished goods → HPP → snapshot.
 *
 * Dependencies:
 * - conversionEngine.js
 * - bomEngine.js
 * - inventoryLayerEngine.js
 * - hppEngine.js
 * - snapshotEngine.js
 *
 * Important Principles:
 * - Engine ini TIDAK menyimpan data.
 * - Engine ini TIDAK update sheet.
 * - Engine ini TIDAK update database.
 * - Engine ini hanya memvalidasi, menghitung, mensimulasikan,
 *   dan membuat transaction package.
 */

import {
  normalizeBranchId,
  normalizeUnit,
  createConversionSnapshot,
} from './conversionEngine';

import {
  getActiveBom,
  scaleBom,
  createBomSnapshot,
  validateBom,
} from './bomEngine';

import {
  calculateConsumptionCost,
  createCostLayer,
} from './inventoryLayerEngine';

import {
  calculateProductionHpp,
} from './hppEngine';

import {
  createTransactionSnapshot,
  createSnapshot,
  lockSnapshot,
  readSnapshot,
} from './snapshotEngine';

/* =========================================================================
   CONSTANTS
   ========================================================================= */

const ENGINE_VERSION = 'ERP_DA_V2_PRODUCTION_ENGINE_1';
const DEFAULT_BRANCH_SCOPE = 'GLOBAL';
const DEFAULT_WAREHOUSE = 'MAIN';

const PRODUCTION_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  SIMULATED: 'SIMULATED',
  READY: 'READY',
  BLOCKED: 'BLOCKED',
  CREATED: 'CREATED',
  REVERSED: 'REVERSED',
});

const MOVEMENT_TYPES = Object.freeze({
  RAW_MATERIAL_CONSUME: 'PRODUCTION_CONSUME',
  FINISHED_GOODS_IN: 'PRODUCTION_OUTPUT',
  REVERSAL: 'PRODUCTION_REVERSAL',
});

/* =========================================================================
   BASIC HELPERS
   ========================================================================= */

const isObject = (value) => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const cleanText = (value) => {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const normalizeCode = (value) => {
  return cleanText(value)
    .toUpperCase()
    .replace(/[^\w./-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (value === undefined || value === null || value === '') return NaN;

  const cleaned = String(value)
    .trim()
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const safeNumber = (value, fallback = 0) => {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value) => {
  const number = safeNumber(value, 0);
  return Math.round(number * 100) / 100;
};

const makeWarning = (code, message, meta = {}) => ({
  code,
  message,
  meta,
});

const getTodayISO = () => {
  return new Date().toISOString().substring(0, 10);
};

const normalizeDateString = (value) => {
  if (!value) return '';

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return raw.substring(0, 10);

  return parsed.toISOString().substring(0, 10);
};

const normalizeWarehouseId = (warehouseId) => {
  const normalized = normalizeCode(warehouseId || DEFAULT_WAREHOUSE);
  return normalized || DEFAULT_WAREHOUSE;
};

const normalizeFranchiseId = (franchiseId) => {
  const normalized = normalizeBranchId(franchiseId || '');
  return normalized === DEFAULT_BRANCH_SCOPE ? '' : normalized;
};

const generateId = (prefix = 'ID') => {
  const safePrefix = normalizeCode(prefix || 'ID') || 'ID';
  return `${safePrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
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

/* =========================================================================
   SOURCE EXTRACTION
   ========================================================================= */

const extractBomSource = (params = {}) => {
  return (
    params.bomSource ||
    params.bom_source ||
    params.masterRecipeBom ||
    params.master_recipe_bom ||
    params.dbData ||
    params.source ||
    []
  );
};

const extractInventorySource = (params = {}) => {
  return (
    params.inventorySource ||
    params.inventory_source ||
    params.inventoryCostLayers ||
    params.inventory_cost_layers ||
    params.dbData ||
    params.source ||
    []
  );
};

const extractRulesSource = (params = {}) => {
  return (
    params.rulesSource ||
    params.rules_source ||
    params.masterConversionRules ||
    params.master_conversion_rules ||
    params.dbData ||
    params.source ||
    []
  );
};

/* =========================================================================
   INPUT NORMALIZATION
   ========================================================================= */

export const normalizeProductionInput = (input = {}) => {
  const targetQty = toNumber(
    input.target_qty ??
    input.targetQty ??
    input.actual_yield_qty ??
    input.actualYieldQty ??
    input.yield_qty,
  );

  const targetUnit = normalizeUnit(
    input.target_unit ??
    input.targetUnit ??
    input.actual_yield_unit ??
    input.actualYieldUnit ??
    input.yield_unit,
  );

  const branchId = normalizeBranchId(
    input.branch_id ??
    input.branchId ??
    DEFAULT_BRANCH_SCOPE,
  );

  const warehouseId = normalizeWarehouseId(
    input.warehouse_id ??
    input.warehouseId ??
    input.location_id ??
    input.locationId ??
    DEFAULT_WAREHOUSE,
  );

  const franchiseId = normalizeFranchiseId(
    input.franchise_id ??
    input.franchiseId ??
    '',
  );

  const productionDate = normalizeDateString(
    input.production_date ??
    input.productionDate ??
    input.date ??
    getTodayISO(),
  );

  return {
    production_id: String(input.production_id || input.productionId || input.id || '').trim(),
    batch_id: String(input.batch_id || input.batchId || '').trim(),

    branch_id: branchId,
    warehouse_id: warehouseId,
    franchise_id: franchiseId,

    recipe_id: String(input.recipe_id || input.recipeId || '').trim(),
    recipe_version: String(input.recipe_version || input.recipeVersion || '').trim(),
    recipe_code: String(input.recipe_code || input.recipeCode || '').trim(),

    product_id: String(input.product_id || input.productId || '').trim(),
    product_name: String(input.product_name || input.productName || '').trim(),

    target_qty: targetQty,
    target_unit: targetUnit,

    production_date: productionDate,

    operator: String(input.operator || input.pic || input.created_by || input.createdBy || '').trim(),
    notes: String(input.notes || input.description || input.keterangan || '').trim(),

    status: normalizeCode(input.status || PRODUCTION_STATUS.DRAFT),

    raw: { ...input },
  };
};

/* =========================================================================
   VALIDATION
   ========================================================================= */

export const validateProductionInput = (input = {}, options = {}) => {
  const warnings = [];
  const normalized = normalizeProductionInput(input);

  if (!normalized.branch_id || normalized.branch_id === DEFAULT_BRANCH_SCOPE) {
    warnings.push(makeWarning('INVALID_BRANCH', 'branch_id produksi tidak valid atau masih GLOBAL.', {
      branch_id: normalized.branch_id,
    }));
  }

  if (!normalized.warehouse_id) {
    warnings.push(makeWarning('INVALID_WAREHOUSE', 'warehouse_id produksi tidak valid.', {
      warehouse_id: normalized.warehouse_id,
    }));
  }

  if (!Number.isFinite(normalized.target_qty) || normalized.target_qty <= 0) {
    warnings.push(makeWarning('INVALID_TARGET_QTY', 'Target produksi tidak valid.', {
      target_qty: input.target_qty ?? input.targetQty,
    }));
  }

  if (!normalized.target_unit) {
    warnings.push(makeWarning('INVALID_TARGET_UNIT', 'Satuan target produksi tidak valid.', {
      target_unit: input.target_unit ?? input.targetUnit,
    }));
  }

  if (!normalized.recipe_id && !normalized.product_id && !normalized.product_name && !options.bom && !input.bom && !input.recipe) {
    warnings.push(makeWarning('MISSING_RECIPE_OR_PRODUCT', 'Produksi membutuhkan recipe_id atau product_id/product_name untuk resolve BOM.'));
  }

  const bomSource = extractBomSource({
    ...options,
    ...input,
  });

  const bom = options.bom || input.bom || input.recipe || null;

  if (bom) {
    const bomValidation = validateBom(bom, {
      asOfDate: normalized.production_date,
    });

    if (!bomValidation.ok) {
      warnings.push(...bomValidation.warnings);
    }
  } else {
    const activeBom = getActiveBom(bomSource, {
      productId: normalized.product_id,
      productName: normalized.product_name,
      recipeId: normalized.recipe_id,
      recipeVersion: normalized.recipe_version,
      recipeCode: normalized.recipe_code,
      branchId: normalized.branch_id,
      franchiseId: normalized.franchise_id,
      asOfDate: normalized.production_date,
    });

    if (!activeBom.ok || !activeBom.bom) {
      warnings.push(...activeBom.warnings);
      warnings.push(makeWarning('ACTIVE_BOM_NOT_AVAILABLE', 'BOM aktif tidak tersedia untuk produksi.', {
        recipe_id: normalized.recipe_id,
        product_id: normalized.product_id,
        product_name: normalized.product_name,
        branch_id: normalized.branch_id,
        franchise_id: normalized.franchise_id,
        production_date: normalized.production_date,
      }));
    }
  }

  return {
    ok: warnings.length === 0,
    input: normalized,
    warnings,
  };
};

/* =========================================================================
   BOM RESOLUTION & MATERIAL REQUIREMENT
   ========================================================================= */

const resolveProductionBom = (input = {}, options = {}) => {
  const normalized = normalizeProductionInput(input);
  const warnings = [];

  if (options.bom || input.bom || input.recipe) {
    const bom = options.bom || input.bom || input.recipe;

    const validation = validateBom(bom, {
      asOfDate: normalized.production_date,
    });

    warnings.push(...validation.warnings);

    return {
      ok: validation.ok,
      bom,
      warnings,
    };
  }

  const result = getActiveBom(extractBomSource({ ...options, ...input }), {
    productId: normalized.product_id,
    productName: normalized.product_name,
    recipeId: normalized.recipe_id,
    recipeVersion: normalized.recipe_version,
    recipeCode: normalized.recipe_code,
    branchId: normalized.branch_id,
    franchiseId: normalized.franchise_id,
    asOfDate: normalized.production_date,
  });

  return {
    ok: result.ok,
    bom: result.bom,
    warnings: result.warnings,
  };
};

export const calculateMaterialRequirement = (input = {}, options = {}) => {
  const warnings = [];
  const normalized = normalizeProductionInput(input);

  const bomResolution = resolveProductionBom(input, options);
  warnings.push(...bomResolution.warnings);

  if (!bomResolution.ok || !bomResolution.bom) {
    return {
      ok: false,
      material_requirements: [],
      scaled_bom: null,
      bom_snapshot: null,
      warnings,
    };
  }

  const scaleResult = scaleBom(bomResolution.bom, {
    targetYieldQty: normalized.target_qty,
    targetYieldUnit: normalized.target_unit,
    branchId: normalized.branch_id,
    franchiseId: normalized.franchise_id,
    rulesSource: extractRulesSource({ ...options, ...input }),
    rules: options.rules,
    source: options.dbData || input.dbData || options.source || input.source,
  });

  warnings.push(...scaleResult.warnings);

  const bomSnapshotResult = createBomSnapshot(bomResolution.bom, {
    targetYieldQty: normalized.target_qty,
    targetYieldUnit: normalized.target_unit,
    branchId: normalized.branch_id,
    franchiseId: normalized.franchise_id,
    rulesSource: extractRulesSource({ ...options, ...input }),
    rules: options.rules,
    source: options.dbData || input.dbData || options.source || input.source,
  });

  warnings.push(...bomSnapshotResult.warnings);

  if (!scaleResult.ok || !scaleResult.scaled_bom) {
    return {
      ok: false,
      material_requirements: [],
      scaled_bom: null,
      bom_snapshot: bomSnapshotResult.snapshot || null,
      warnings,
    };
  }

  const requirements = safeArray(scaleResult.scaled_bom.ingredients).map((ingredient, index) => ({
    index,
    ingredient_id: ingredient.ingredient_id,
    ingredient_name: ingredient.ingredient_name,
    category: ingredient.category || '',
    supplier_id: ingredient.supplier_id || '',
    required_qty: safeNumber(ingredient.required_qty, 0),
    required_unit: ingredient.required_unit,
    base_qty: safeNumber(ingredient.base_qty, 0),
    base_unit: ingredient.base_unit,
    scale_factor: safeNumber(ingredient.scale_factor, 1),
    waste_pct: safeNumber(ingredient.waste_pct, 0),
    shrinkage_pct: safeNumber(ingredient.shrinkage_pct, 0),
    adjustment_multiplier: safeNumber(ingredient.adjustment_multiplier, 1),
  }));

  return {
    ok: bomSnapshotResult.ok && requirements.length > 0,
    material_requirements: requirements,
    scaled_bom: scaleResult.scaled_bom,
    bom_snapshot: bomSnapshotResult.snapshot || null,
    warnings,
  };
};

/* =========================================================================
   PRODUCTION PLAN
   ========================================================================= */

export const createProductionPlan = (input = {}, options = {}) => {
  const warnings = [];
  const normalized = normalizeProductionInput(input);
  const validation = validateProductionInput(input, options);

  warnings.push(...validation.warnings);

  const materialRequirement = calculateMaterialRequirement(input, options);
  warnings.push(...materialRequirement.warnings);

  const planId = input.plan_id || input.planId || generateId('PROD-PLAN');

  const plan = {
    plan_id: planId,
    branch_id: normalized.branch_id,
    warehouse_id: normalized.warehouse_id,
    franchise_id: normalized.franchise_id,

    recipe_id: materialRequirement.bom_snapshot?.recipe_id || normalized.recipe_id,
    recipe_version: materialRequirement.bom_snapshot?.recipe_version || normalized.recipe_version,
    product_id: materialRequirement.bom_snapshot?.product_id || normalized.product_id,
    product_name: materialRequirement.bom_snapshot?.product_name || normalized.product_name,

    target_qty: normalized.target_qty,
    target_unit: normalized.target_unit,
    production_date: normalized.production_date,

    operator: normalized.operator,
    notes: normalized.notes,

    material_requirements: materialRequirement.material_requirements,
    bom_snapshot: materialRequirement.bom_snapshot,

    status: validation.ok && materialRequirement.ok
      ? PRODUCTION_STATUS.READY
      : PRODUCTION_STATUS.BLOCKED,

    generated_at: new Date().toISOString(),
    engine_version: ENGINE_VERSION,
  };

  return {
    ok: validation.ok && materialRequirement.ok,
    production_plan: plan,
    warnings,
  };
};

/* =========================================================================
   SIMULATION
   ========================================================================= */

export const simulateProduction = (input = {}, options = {}) => {
  const warnings = [];
  const normalized = normalizeProductionInput(input);

  const productionPlan = createProductionPlan(input, options);
  warnings.push(...productionPlan.warnings);

  const hppResult = calculateProductionHpp({
    ...options,
    ...input,

    productId: productionPlan.production_plan?.product_id || normalized.product_id,
    productName: productionPlan.production_plan?.product_name || normalized.product_name,
    recipeId: productionPlan.production_plan?.recipe_id || normalized.recipe_id,
    recipeVersion: productionPlan.production_plan?.recipe_version || normalized.recipe_version,

    targetYieldQty: normalized.target_qty,
    targetYieldUnit: normalized.target_unit,

    branchId: normalized.branch_id,
    warehouseId: normalized.warehouse_id,
    franchiseId: normalized.franchise_id,

    productionDate: normalized.production_date,

    inventorySource: extractInventorySource({ ...options, ...input }),
    bomSource: extractBomSource({ ...options, ...input }),
    rulesSource: extractRulesSource({ ...options, ...input }),
    rules: options.rules,
  });

  warnings.push(...hppResult.warnings);

  const materialConsumption = safeArray(hppResult.ingredient_cost_breakdown).map((ingredient) => ({
    ingredient_id: ingredient.ingredient_id,
    ingredient_name: ingredient.ingredient_name,
    category: ingredient.category || '',
    requested_qty: safeNumber(ingredient.requested_qty, 0),
    qty_used: safeNumber(ingredient.qty_used, 0),
    insufficient_qty: safeNumber(ingredient.insufficient_qty, 0),
    unit: ingredient.unit,
    total_cost: roundMoney(ingredient.total_cost),
    layer_cost: roundMoney(ingredient.layer_cost),
    consumed_layers: ingredient.consumed_layers || [],
    cost_layer_snapshot: ingredient.cost_layer_snapshot || null,
  }));

  const stockOk = materialConsumption.every((item) => safeNumber(item.insufficient_qty, 0) <= 0);

  return {
    ok: productionPlan.ok && hppResult.ok && stockOk,
    simulation: {
      simulation_id: input.simulation_id || input.simulationId || generateId('PROD-SIM'),

      branch_id: normalized.branch_id,
      warehouse_id: normalized.warehouse_id,
      franchise_id: normalized.franchise_id,

      production_date: normalized.production_date,
      target_qty: normalized.target_qty,
      target_unit: normalized.target_unit,

      product_id: hppResult.product_id || productionPlan.production_plan?.product_id || normalized.product_id,
      product_name: hppResult.product_name || productionPlan.production_plan?.product_name || normalized.product_name,

      recipe_id: hppResult.recipe_id || productionPlan.production_plan?.recipe_id || normalized.recipe_id,
      recipe_version: hppResult.recipe_version || productionPlan.production_plan?.recipe_version || normalized.recipe_version,

      total_hpp: roundMoney(hppResult.total_hpp),
      hpp_per_unit: hppResult.hpp_per_unit,
      hpp_per_pcs: hppResult.hpp_per_pcs,
      hpp_per_batch: roundMoney(hppResult.hpp_per_batch),

      material_consumption: materialConsumption,

      finished_goods_preview: {
        item_id: hppResult.product_id || productionPlan.production_plan?.product_id || normalized.product_id,
        item_name: hppResult.product_name || productionPlan.production_plan?.product_name || normalized.product_name,
        qty_original: normalized.target_qty,
        qty_remaining: normalized.target_qty,
        unit: normalized.target_unit,
        unit_cost: hppResult.hpp_per_unit,
        total_cost: roundMoney(hppResult.total_hpp),
      },

      hpp_snapshot: hppResult.hpp_snapshot,
      bom_snapshot: hppResult.bom_snapshot || productionPlan.production_plan?.bom_snapshot || null,
      cost_layer_snapshot: hppResult.cost_layer_snapshot,

      status: stockOk && hppResult.ok ? PRODUCTION_STATUS.SIMULATED : PRODUCTION_STATUS.BLOCKED,
      generated_at: new Date().toISOString(),
      engine_version: ENGINE_VERSION,
    },
    warnings,
  };
};

/* =========================================================================
   FINISHED GOODS LAYER
   ========================================================================= */

export const createFinishedGoodsLayer = (input = {}, options = {}) => {
  const warnings = [];

  const batchId = String(
    input.batch_id ||
    input.batchId ||
    input.production_batch_id ||
    input.productionBatchId ||
    options.batchId ||
    options.batch_id ||
    generateId('BATCH'),
  ).trim();

  const productId = String(
    input.product_id ||
    input.productId ||
    input.item_id ||
    input.itemId ||
    '',
  ).trim();

  const productName = String(
    input.product_name ||
    input.productName ||
    input.item_name ||
    input.itemName ||
    '',
  ).trim();

  const qty = toNumber(
    input.qty_original ??
    input.qty ??
    input.quantity ??
    input.target_qty ??
    input.targetQty,
  );

  const unit = normalizeUnit(
    input.unit ||
    input.target_unit ||
    input.targetUnit ||
    input.yield_unit,
  );

  const unitCost = toNumber(
    input.unit_cost ??
    input.unitCost ??
    input.hpp_per_unit ??
    input.hppPerUnit ??
    input.hpp_per_pcs,
  );

  const branchId = normalizeBranchId(input.branch_id || input.branchId || options.branchId || options.branch_id || DEFAULT_BRANCH_SCOPE);
  const warehouseId = normalizeWarehouseId(input.warehouse_id || input.warehouseId || options.warehouseId || options.warehouse_id || DEFAULT_WAREHOUSE);
  const franchiseId = normalizeFranchiseId(input.franchise_id || input.franchiseId || options.franchiseId || options.franchise_id || '');

  const layerResult = createCostLayer({
    layer_id: input.layer_id || input.layerId || generateId('FG-LAYER'),

    item_id: productId,
    item_name: productName,
    category: input.category || 'FINISHED_GOODS',

    branch_id: branchId,
    warehouse_id: warehouseId,
    franchise_id: franchiseId,

    qty_original: qty,
    qty_remaining: qty,
    unit,
    unit_cost: unitCost,

    source_document: 'PRODUCTION_BATCH',
    source_document_id: batchId,

    received_date: input.received_date || input.receivedDate || input.production_date || input.productionDate || getTodayISO(),
    expired_date: input.expired_date || input.expiredDate || '',

    status: 'ACTIVE',
    movement_type: MOVEMENT_TYPES.FINISHED_GOODS_IN,

    created_by: input.created_by || input.createdBy || input.operator || options.createdBy || options.created_by || '',
    created_at: input.created_at || input.createdAt || new Date().toISOString(),
    notes: input.notes || '',
  });

  warnings.push(...layerResult.warnings);

  return {
    ok: layerResult.ok,
    finished_goods_cost_layer: layerResult.layer,
    warnings,
  };
};

/* =========================================================================
   CREATE PRODUCTION BATCH PACKAGE
   ========================================================================= */

export const createProductionBatch = (input = {}, options = {}) => {
  const warnings = [];
  const normalized = normalizeProductionInput(input);

  const simulation = simulateProduction(input, options);
  warnings.push(...simulation.warnings);

  const batchId = normalized.batch_id || input.batch_id || input.batchId || generateId('PROD-BATCH');

  const hppSnapshot = simulation.simulation?.hpp_snapshot || null;
  const bomSnapshot = simulation.simulation?.bom_snapshot || null;
  const costLayerSnapshot = simulation.simulation?.cost_layer_snapshot || null;

  const finishedGoodsResult = createFinishedGoodsLayer({
    batch_id: batchId,
    product_id: simulation.simulation?.product_id || normalized.product_id,
    product_name: simulation.simulation?.product_name || normalized.product_name,
    qty_original: normalized.target_qty,
    unit: normalized.target_unit,
    unit_cost: simulation.simulation?.hpp_per_unit,
    branch_id: normalized.branch_id,
    warehouse_id: normalized.warehouse_id,
    franchise_id: normalized.franchise_id,
    production_date: normalized.production_date,
    operator: normalized.operator,
    notes: normalized.notes,
  }, options);

  warnings.push(...finishedGoodsResult.warnings);

  const batchHeader = {
    id: batchId,
    batch_id: batchId,

    date: normalized.production_date,
    production_date: normalized.production_date,

    branch_id: normalized.branch_id,
    warehouse_id: normalized.warehouse_id,
    franchise_id: normalized.franchise_id,

    recipe_id: simulation.simulation?.recipe_id || normalized.recipe_id,
    recipe_version: simulation.simulation?.recipe_version || normalized.recipe_version,

    product_id: simulation.simulation?.product_id || normalized.product_id,
    product_name: simulation.simulation?.product_name || normalized.product_name,

    target_qty: normalized.target_qty,
    target_unit: normalized.target_unit,

    actual_yield_qty: normalized.target_qty,
    actual_yield_unit: normalized.target_unit,

    total_hpp: roundMoney(simulation.simulation?.total_hpp || 0),
    hpp_per_unit: simulation.simulation?.hpp_per_unit || null,
    hpp_per_pcs: simulation.simulation?.hpp_per_pcs || null,

    status: simulation.ok && finishedGoodsResult.ok
      ? PRODUCTION_STATUS.CREATED
      : PRODUCTION_STATUS.BLOCKED,

    operator: normalized.operator,
    notes: normalized.notes,

    hpp_snapshot_json: hppSnapshot ? JSON.stringify(hppSnapshot) : '',
    bom_snapshot_json: bomSnapshot ? JSON.stringify(bomSnapshot) : '',
    cost_layer_snapshot_json: costLayerSnapshot ? JSON.stringify(costLayerSnapshot) : '',

    created_at: new Date().toISOString(),
    created_by: normalized.operator,
    isDeleted: false,
  };

  const productionSnapshotResult = createProductionSnapshot({
    batch_header: batchHeader,
    material_consumption: simulation.simulation?.material_consumption || [],
    finished_goods: finishedGoodsResult.finished_goods_cost_layer || null,
    hpp_snapshot: hppSnapshot,
    bom_snapshot: bomSnapshot,
    cost_layer_snapshot: costLayerSnapshot,
    warnings,
  }, {
    lock: true,
  });

  warnings.push(...productionSnapshotResult.warnings);

  const productionBatchPackage = {
    package_type: 'PRODUCTION_BATCH_PACKAGE',
    package_version: ENGINE_VERSION,
    generated_at: new Date().toISOString(),

    batch_header: {
      ...batchHeader,
      production_snapshot_json: productionSnapshotResult.snapshot
        ? JSON.stringify(productionSnapshotResult.snapshot)
        : '',
    },

    material_consumption: simulation.simulation?.material_consumption || [],
    finished_goods: finishedGoodsResult.finished_goods_cost_layer || null,

    hpp_snapshot: hppSnapshot,
    bom_snapshot: bomSnapshot,
    cost_layer_snapshot: costLayerSnapshot,
    production_snapshot: productionSnapshotResult.snapshot || null,

    status: simulation.ok && finishedGoodsResult.ok && productionSnapshotResult.ok
      ? PRODUCTION_STATUS.CREATED
      : PRODUCTION_STATUS.BLOCKED,

    warnings,
  };

  return {
    ok: simulation.ok && finishedGoodsResult.ok && productionSnapshotResult.ok,
    production_batch_package: productionBatchPackage,
    warnings,
  };
};

/* =========================================================================
   PRODUCTION SNAPSHOT
   ========================================================================= */

export const createProductionSnapshot = (input = {}, options = {}) => {
  const batchHeader = input.batch_header || input.batchHeader || {};
  const batchId = batchHeader.batch_id || batchHeader.id || input.batch_id || input.batchId || '';

  const snapshotResult = createTransactionSnapshot({
    snapshot_type: 'PRODUCTION',
    transaction_id: batchId,
    transaction_type: 'PRODUCTION_BATCH',

    branch_id: batchHeader.branch_id || input.branch_id || input.branchId || DEFAULT_BRANCH_SCOPE,
    created_by: batchHeader.created_by || batchHeader.operator || input.created_by || input.createdBy || 'SYSTEM',

    transaction_header: batchHeader,
    transaction_items: input.material_consumption || input.materialConsumption || [],

    hpp_snapshot: input.hpp_snapshot || input.hppSnapshot || null,
    bom_snapshot: input.bom_snapshot || input.bomSnapshot || null,
    cost_layer_snapshot: input.cost_layer_snapshot || input.costLayerSnapshot || null,

    production_snapshot: {
      batch_header: batchHeader,
      material_consumption: input.material_consumption || input.materialConsumption || [],
      finished_goods: input.finished_goods || input.finishedGoods || null,
    },

    warnings: input.warnings || [],

    engine_versions: {
      productionEngine: ENGINE_VERSION,
    },

    meta: {
      source_module: 'productionEngine',
      source_table: 'production_batches',
      source_id: batchId,
    },
  }, {
    lock: options.lock !== false,
    allowInvalid: options.allowInvalid,
  });

  return {
    ok: snapshotResult.ok,
    snapshot: snapshotResult.snapshot,
    warnings: snapshotResult.warnings,
  };
};

/* =========================================================================
   REVERSE PRODUCTION
   ========================================================================= */

const extractProductionSnapshotPayload = (input = {}) => {
  const directSnapshot =
    input.production_snapshot ||
    input.productionSnapshot ||
    parseJson(input.production_snapshot_json, null) ||
    parseJson(input.productionSnapshotJson, null);

  if (!directSnapshot) return null;

  const readResult = readSnapshot(directSnapshot, {
    allowInvalid: true,
    freeze: false,
  });

  if (!readResult.ok || !readResult.snapshot) return null;

  return readResult.snapshot.payload || null;
};

const createMaterialRestorationFromConsumption = (materialConsumption = [], reversalHeader = {}) => {
  const restorationLayers = [];

  safeArray(materialConsumption).forEach((ingredient) => {
    const consumedLayers = safeArray(ingredient.consumed_layers);

    consumedLayers.forEach((layer) => {
      restorationLayers.push({
        reversal_layer_id: generateId('REV-RM-LAYER'),

        item_id: layer.item_id || ingredient.ingredient_id,
        item_name: layer.item_name || ingredient.ingredient_name,

        branch_id: layer.branch_id || reversalHeader.branch_id,
        warehouse_id: layer.warehouse_id || reversalHeader.warehouse_id,
        franchise_id: layer.franchise_id || reversalHeader.franchise_id || '',

        qty_original: safeNumber(layer.consumed_qty, 0),
        qty_remaining: safeNumber(layer.consumed_qty, 0),
        unit: layer.consumed_unit || ingredient.unit,

        unit_cost: safeNumber(layer.unit_cost, 0),
        total_cost: roundMoney(safeNumber(layer.total_cost, 0)),

        source_document: 'PRODUCTION_REVERSAL',
        source_document_id: reversalHeader.reversal_id,

        original_layer_id: layer.layer_id,
        original_batch_id: reversalHeader.original_batch_id,

        received_date: reversalHeader.reversal_date,
        expired_date: layer.expired_date || '',

        movement_type: MOVEMENT_TYPES.REVERSAL,
        status: 'ACTIVE',

        notes: `Reversal bahan dari batch ${reversalHeader.original_batch_id}`,
      });
    });
  });

  return restorationLayers;
};

export const reverseProduction = (input = {}, options = {}) => {
  const warnings = [];

  const packageInput = input.production_batch_package || input.productionBatchPackage || input;
  const batchHeader = packageInput.batch_header || input.batch_header || input.batchHeader || {};

  const productionSnapshotPayload = extractProductionSnapshotPayload(batchHeader) ||
    extractProductionSnapshotPayload(packageInput) ||
    null;

  const originalBatchHeader = productionSnapshotPayload?.production_snapshot?.batch_header ||
    productionSnapshotPayload?.transaction_header ||
    batchHeader;

  const originalMaterialConsumption = productionSnapshotPayload?.production_snapshot?.material_consumption ||
    productionSnapshotPayload?.transaction_items ||
    packageInput.material_consumption ||
    [];

  const originalFinishedGoods = productionSnapshotPayload?.production_snapshot?.finished_goods ||
    packageInput.finished_goods ||
    null;

  const originalBatchId = originalBatchHeader.batch_id || originalBatchHeader.id || input.batch_id || input.batchId || '';

  if (!originalBatchId) {
    warnings.push(makeWarning('MISSING_ORIGINAL_BATCH_ID', 'Batch produksi original tidak ditemukan untuk reversal.'));
  }

  const reversalId = input.reversal_id || input.reversalId || generateId('PROD-REV');
  const reversalDate = normalizeDateString(input.reversal_date || input.reversalDate || input.date || getTodayISO());

  const reversalHeader = {
    id: reversalId,
    reversal_id: reversalId,

    original_batch_id: originalBatchId,
    reversal_date: reversalDate,
    date: reversalDate,

    branch_id: normalizeBranchId(originalBatchHeader.branch_id || input.branch_id || input.branchId || DEFAULT_BRANCH_SCOPE),
    warehouse_id: normalizeWarehouseId(originalBatchHeader.warehouse_id || input.warehouse_id || input.warehouseId || DEFAULT_WAREHOUSE),
    franchise_id: normalizeFranchiseId(originalBatchHeader.franchise_id || input.franchise_id || input.franchiseId || ''),

    reason: String(input.reason || input.notes || 'PRODUCTION_REVERSAL').trim(),
    operator: String(input.operator || input.created_by || input.createdBy || 'SYSTEM').trim(),

    status: PRODUCTION_STATUS.REVERSED,
    movement_type: MOVEMENT_TYPES.REVERSAL,

    created_at: new Date().toISOString(),
    created_by: String(input.operator || input.created_by || input.createdBy || 'SYSTEM').trim(),
    isDeleted: false,
  };

  const materialRestorationLayers = createMaterialRestorationFromConsumption(
    originalMaterialConsumption,
    reversalHeader,
  );

  if (materialRestorationLayers.length === 0) {
    warnings.push(makeWarning('EMPTY_MATERIAL_REVERSAL', 'Tidak ada material consumption yang bisa dibuat reversal.', {
      original_batch_id: originalBatchId,
    }));
  }

  let finishedGoodsReversal = null;

  if (originalFinishedGoods) {
    finishedGoodsReversal = {
      reversal_movement_id: generateId('REV-FG-OUT'),

      original_layer_id: originalFinishedGoods.layer_id || originalFinishedGoods.id || '',
      original_batch_id: originalBatchId,

      item_id: originalFinishedGoods.item_id || '',
      item_name: originalFinishedGoods.item_name || '',

      branch_id: originalFinishedGoods.branch_id || reversalHeader.branch_id,
      warehouse_id: originalFinishedGoods.warehouse_id || reversalHeader.warehouse_id,
      franchise_id: originalFinishedGoods.franchise_id || reversalHeader.franchise_id,

      qty_out: safeNumber(originalFinishedGoods.qty_original || originalFinishedGoods.qty_remaining, 0),
      unit: originalFinishedGoods.unit || '',

      unit_cost: safeNumber(originalFinishedGoods.unit_cost, 0),
      total_cost: roundMoney(
        safeNumber(originalFinishedGoods.qty_original || originalFinishedGoods.qty_remaining, 0) *
        safeNumber(originalFinishedGoods.unit_cost, 0),
      ),

      source_document: 'PRODUCTION_REVERSAL',
      source_document_id: reversalId,

      movement_type: 'FINISHED_GOODS_REVERSAL_OUT',
      notes: `Reversal finished goods dari batch ${originalBatchId}`,
    };
  } else {
    warnings.push(makeWarning('FINISHED_GOODS_LAYER_NOT_FOUND', 'Finished goods original tidak ditemukan untuk reversal.', {
      original_batch_id: originalBatchId,
    }));
  }

  const reversalSnapshotResult = createSnapshot({
    snapshot_type: 'PRODUCTION',
    transaction_id: reversalId,
    transaction_type: 'PRODUCTION_REVERSAL',
    branch_id: reversalHeader.branch_id,
    created_by: reversalHeader.created_by,
    engine_versions: {
      productionEngine: ENGINE_VERSION,
    },
    payload: {
      reversal_header: reversalHeader,
      original_batch_header: originalBatchHeader,
      material_restoration_layers: materialRestorationLayers,
      finished_goods_reversal: finishedGoodsReversal,
      original_production_snapshot_payload: productionSnapshotPayload,
    },
    warnings,
    meta: {
      source_module: 'productionEngine',
      source_table: 'production_batches',
      source_id: originalBatchId,
      reversal_id: reversalId,
    },
  }, {
    freeze: false,
    allowInvalid: true,
  });

  const lockedSnapshot = lockSnapshot(reversalSnapshotResult.snapshot, {
    allowInvalid: true,
    lockedBy: reversalHeader.created_by,
  });

  warnings.push(...reversalSnapshotResult.warnings);
  warnings.push(...lockedSnapshot.warnings);

  const reversalPackage = {
    package_type: 'PRODUCTION_REVERSAL_PACKAGE',
    package_version: ENGINE_VERSION,
    generated_at: new Date().toISOString(),

    reversal_header: reversalHeader,
    original_batch_header: originalBatchHeader,

    material_restoration_layers: materialRestorationLayers,
    finished_goods_reversal: finishedGoodsReversal,

    reversal_snapshot: lockedSnapshot.snapshot || reversalSnapshotResult.snapshot,

    status: warnings.some((warning) => warning.code === 'MISSING_ORIGINAL_BATCH_ID')
      ? PRODUCTION_STATUS.BLOCKED
      : PRODUCTION_STATUS.REVERSED,

    warnings,
  };

  return {
    ok: reversalPackage.status === PRODUCTION_STATUS.REVERSED,
    production_reversal_package: reversalPackage,
    warnings,
  };
};

/* =========================================================================
   DEFAULT EXPORT
   ========================================================================= */

export default {
  validateProductionInput,
  createProductionPlan,
  calculateMaterialRequirement,
  simulateProduction,
  createProductionBatch,
  createFinishedGoodsLayer,
  createProductionSnapshot,
  reverseProduction,
};
