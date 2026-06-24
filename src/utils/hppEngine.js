/**
 * ERP DIMSUM ADITYA V2
 * Core Engine: hppEngine.js
 *
 * Purpose:
 * - Single Source of Truth untuk seluruh perhitungan HPP ERP.
 * - HPP = TOTAL MODAL AKTUAL.
 * - HPP dihitung dari BOM + FIFO Inventory Cost Layer.
 *
 * Dependencies:
 * - conversionEngine.js
 * - bomEngine.js
 * - inventoryLayerEngine.js
 *
 * Important Principles:
 * - Tidak ada hardcode HPP.
 * - Tidak ada hardcode bahan.
 * - Tidak menghitung HPP dari harga jual atau persentase.
 * - Tidak mengubah stok.
 * - Tidak menyimpan data.
 * - Tidak mengubah layer.
 * - Semua hasil HPP wajib bisa disimpan sebagai snapshot untuk historical integrity.
 */

import {
  normalizeBranchId,
  normalizeUnit,
  convertUnits,
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
} from './inventoryLayerEngine';

/* =========================================================================
   CONSTANTS
   ========================================================================= */

const ENGINE_VERSION = 'ERP_DA_V2_HPP_ENGINE_1';
const DEFAULT_SCOPE_GLOBAL = 'GLOBAL';
const DEFAULT_WAREHOUSE = 'MAIN';
const DEFAULT_HPP_UNIT = 'PCS';

/* =========================================================================
   BASIC HELPERS
   ========================================================================= */

const isObject = (value) => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const makeWarning = (code, message, meta = {}) => ({
  code,
  message,
  meta,
});

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

const normalizeDateString = (value) => {
  if (!value) return '';

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return raw.substring(0, 10);

  return parsed.toISOString().substring(0, 10);
};

const getTodayISO = () => {
  return new Date().toISOString().substring(0, 10);
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

const firstDefined = (source, keys) => {
  if (!isObject(source)) return undefined;

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (value !== undefined && value !== null && value !== '') return value;
    }
  }

  return undefined;
};

const roundMoney = (value) => {
  const number = safeNumber(value, 0);
  return Math.round(number * 100) / 100;
};

const calculateMarginPct = (grossProfit, revenue) => {
  const safeRevenue = safeNumber(revenue, 0);
  if (safeRevenue <= 0) return 0;

  return (safeNumber(grossProfit, 0) / safeRevenue) * 100;
};

const normalizeWarehouseId = (warehouseId) => {
  const normalized = normalizeCode(warehouseId || DEFAULT_WAREHOUSE);
  return normalized || DEFAULT_WAREHOUSE;
};

const normalizeFranchiseId = (franchiseId) => {
  const normalized = normalizeBranchId(franchiseId || '');
  return normalized === DEFAULT_SCOPE_GLOBAL ? '' : normalized;
};

/* =========================================================================
   SOURCE EXTRACTION
   ========================================================================= */

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

const extractOrderItems = (input = {}) => {
  if (Array.isArray(input)) return input;

  if (Array.isArray(input.items)) return input.items;
  if (Array.isArray(input.orderItems)) return input.orderItems;
  if (Array.isArray(input.order_items)) return input.order_items;

  if (typeof input.items_json === 'string') {
    const parsed = parseJson(input.items_json, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  if (typeof input.itemsJson === 'string') {
    const parsed = parseJson(input.itemsJson, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  if (typeof input.items === 'string') {
    const parsed = parseJson(input.items, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  return [];
};

/* =========================================================================
   INPUT VALIDATION
   ========================================================================= */

export const validateHppInput = (input = {}, options = {}) => {
  const warnings = [];
  const mode = normalizeCode(options.mode || input.mode || 'PRODUCTION');

  if (mode === 'PRODUCTION') {
    const targetYieldQty = toNumber(
      input.targetYieldQty ??
      input.target_yield_qty ??
      input.actualYieldQty ??
      input.actual_yield_qty ??
      input.yield_qty,
    );

    const targetYieldUnit = normalizeUnit(
      input.targetYieldUnit ??
      input.target_yield_unit ??
      input.actualYieldUnit ??
      input.actual_yield_unit ??
      input.yield_unit,
    );

    if (!Number.isFinite(targetYieldQty) || targetYieldQty <= 0) {
      warnings.push(makeWarning('INVALID_TARGET_YIELD', 'Target produksi / yield produksi tidak valid.', {
        target_yield_qty: input.targetYieldQty ?? input.target_yield_qty ?? input.actualYieldQty ?? input.actual_yield_qty,
      }));
    }

    if (!targetYieldUnit) {
      warnings.push(makeWarning('INVALID_TARGET_YIELD_UNIT', 'Satuan target produksi / yield produksi tidak valid.'));
    }

    if (!input.bom && !input.recipe && !input.recipe_id && !input.recipeId && !input.product_id && !input.productId && !input.product_name && !input.productName) {
      warnings.push(makeWarning('MISSING_BOM_REFERENCE', 'Referensi BOM / produk untuk perhitungan HPP produksi belum tersedia.'));
    }
  }

  if (mode === 'SALES' || mode === 'ORDER') {
    const items = extractOrderItems(input);

    if (items.length === 0) {
      warnings.push(makeWarning('EMPTY_ORDER_ITEMS', 'Order items kosong.'));
    }

    items.forEach((item, index) => {
      const qty = toNumber(item.qty ?? item.quantity);
      const unit = normalizeUnit(item.unit || item.satuan || item.uom);

      if (!item.product_id && !item.productId && !item.item_id && !item.itemId && !item.name && !item.product_name && !item.item_name) {
        warnings.push(makeWarning('INVALID_ORDER_ITEM_ID', 'Order item tidak memiliki product_id / item_id / nama produk.', {
          index,
        }));
      }

      if (!Number.isFinite(qty) || qty <= 0) {
        warnings.push(makeWarning('INVALID_ORDER_ITEM_QTY', 'Qty order item tidak valid.', {
          index,
          qty: item.qty ?? item.quantity,
        }));
      }

      if (!unit) {
        warnings.push(makeWarning('INVALID_ORDER_ITEM_UNIT', 'Satuan order item tidak valid.', {
          index,
        }));
      }
    });
  }

  return {
    ok: warnings.length === 0,
    warnings,
  };
};

/* =========================================================================
   GROSS PROFIT
   ========================================================================= */

export const calculateGrossProfit = (params = {}) => {
  const totalRevenue = safeNumber(
    params.totalRevenue ??
    params.total_revenue ??
    params.revenue ??
    params.total_amount,
    0,
  );

  const totalHpp = safeNumber(
    params.totalHpp ??
    params.total_hpp ??
    params.hpp ??
    params.cogs,
    0,
  );

  const grossProfit = totalRevenue - totalHpp;
  const grossMarginPct = calculateMarginPct(grossProfit, totalRevenue);

  return {
    total_revenue: roundMoney(totalRevenue),
    total_hpp: roundMoney(totalHpp),
    gross_profit: roundMoney(grossProfit),
    gross_margin_pct: grossMarginPct,
    margin_pct: grossMarginPct,
  };
};

/* =========================================================================
   PER UNIT / PER PCS COST
   ========================================================================= */

export const calculatePerPcsCost = (params = {}) => {
  const warnings = [];

  const totalHpp = safeNumber(params.totalHpp ?? params.total_hpp, 0);
  const yieldQty = toNumber(params.yieldQty ?? params.yield_qty ?? params.totalYieldQty ?? params.total_yield_qty);
  const yieldUnit = normalizeUnit(params.yieldUnit ?? params.yield_unit ?? params.totalYieldUnit ?? params.total_yield_unit);
  const targetUnit = normalizeUnit(params.targetUnit ?? params.target_unit ?? params.hppUnit ?? params.hpp_unit ?? DEFAULT_HPP_UNIT);

  if (!Number.isFinite(yieldQty) || yieldQty <= 0) {
    return {
      ok: false,
      hpp_per_unit: null,
      hpp_per_pcs: null,
      total_hpp: roundMoney(totalHpp),
      yield_qty: yieldQty,
      yield_unit: yieldUnit,
      target_unit: targetUnit,
      warnings: [
        makeWarning('INVALID_YIELD', 'Yield tidak valid untuk menghitung HPP per unit.', {
          yield_qty: yieldQty,
          yield_unit: yieldUnit,
        }),
      ],
    };
  }

  if (!yieldUnit) {
    return {
      ok: false,
      hpp_per_unit: null,
      hpp_per_pcs: null,
      total_hpp: roundMoney(totalHpp),
      yield_qty: yieldQty,
      yield_unit: yieldUnit,
      target_unit: targetUnit,
      warnings: [
        makeWarning('INVALID_YIELD_UNIT', 'Satuan yield tidak valid untuk menghitung HPP per unit.'),
      ],
    };
  }

  if (!targetUnit || targetUnit === yieldUnit) {
    const value = totalHpp / yieldQty;

    return {
      ok: true,
      hpp_per_unit: roundMoney(value),
      hpp_per_pcs: targetUnit === DEFAULT_HPP_UNIT || yieldUnit === DEFAULT_HPP_UNIT ? roundMoney(value) : null,
      total_hpp: roundMoney(totalHpp),
      yield_qty: yieldQty,
      yield_unit: yieldUnit,
      target_unit: targetUnit || yieldUnit,
      converted_yield_qty: yieldQty,
      conversion_path: [],
      warnings,
    };
  }

  const conversion = convertUnits({
    value: yieldQty,
    fromUnit: yieldUnit,
    toUnit: targetUnit,
    branchId: params.branchId || params.branch_id || DEFAULT_SCOPE_GLOBAL,
    rules: params.rules,
    rulesSource: params.rulesSource || params.rules_source || [],
  });

  if (!conversion.ok) {
    return {
      ok: false,
      hpp_per_unit: roundMoney(totalHpp / yieldQty),
      hpp_per_pcs: null,
      total_hpp: roundMoney(totalHpp),
      yield_qty: yieldQty,
      yield_unit: yieldUnit,
      target_unit: targetUnit,
      converted_yield_qty: null,
      conversion_path: [],
      warnings: [
        ...warnings,
        ...conversion.warnings,
        makeWarning('YIELD_TO_TARGET_UNIT_CONVERSION_FAILED', 'Konversi yield ke target unit HPP gagal.', {
          from_unit: yieldUnit,
          to_unit: targetUnit,
        }),
      ],
    };
  }

  const value = conversion.value > 0 ? totalHpp / conversion.value : null;

  return {
    ok: value !== null,
    hpp_per_unit: value !== null ? roundMoney(value) : null,
    hpp_per_pcs: targetUnit === DEFAULT_HPP_UNIT ? roundMoney(value) : null,
    total_hpp: roundMoney(totalHpp),
    yield_qty: yieldQty,
    yield_unit: yieldUnit,
    target_unit: targetUnit,
    converted_yield_qty: conversion.value,
    conversion_path: conversion.path || [],
    warnings,
  };
};

/* =========================================================================
   RECIPE COST / PRODUCTION HPP
   ========================================================================= */

const resolveProductionBom = (params = {}) => {
  const warnings = [];

  if (params.bom || params.recipe) {
    const bom = params.bom || params.recipe;
    const validation = validateBom(bom, {
      asOfDate: params.productionDate || params.production_date || params.date || getTodayISO(),
    });

    warnings.push(...validation.warnings);

    return {
      ok: validation.ok,
      bom,
      warnings,
    };
  }

  const bomResult = getActiveBom(extractBomSource(params), {
    productId: params.productId || params.product_id,
    productName: params.productName || params.product_name,
    recipeId: params.recipeId || params.recipe_id,
    recipeVersion: params.recipeVersion || params.recipe_version,
    recipeCode: params.recipeCode || params.recipe_code,
    branchId: params.branchId || params.branch_id,
    franchiseId: params.franchiseId || params.franchise_id,
    asOfDate: params.productionDate || params.production_date || params.date || getTodayISO(),
  });

  warnings.push(...bomResult.warnings);

  return {
    ok: bomResult.ok,
    bom: bomResult.bom,
    warnings,
  };
};

export const calculateRecipeCost = (params = {}) => {
  return calculateProductionHpp(params);
};

export const calculateProductionHpp = (params = {}) => {
  const warnings = [];

  const validation = validateHppInput(params, { mode: 'PRODUCTION' });
  warnings.push(...validation.warnings);

  const branchId = normalizeBranchId(params.branchId || params.branch_id || DEFAULT_SCOPE_GLOBAL);
  const warehouseId = normalizeWarehouseId(params.warehouseId || params.warehouse_id || DEFAULT_WAREHOUSE);
  const franchiseId = normalizeFranchiseId(params.franchiseId || params.franchise_id || '');
  const productionDate = normalizeDateString(params.productionDate || params.production_date || params.date || getTodayISO());

  const targetYieldQty = toNumber(
    params.targetYieldQty ??
    params.target_yield_qty ??
    params.actualYieldQty ??
    params.actual_yield_qty ??
    params.yield_qty,
  );

  const targetYieldUnit = normalizeUnit(
    params.targetYieldUnit ??
    params.target_yield_unit ??
    params.actualYieldUnit ??
    params.actual_yield_unit ??
    params.yield_unit,
  );

  const bomResolution = resolveProductionBom({
    ...params,
    branchId,
    franchiseId,
    productionDate,
  });

  warnings.push(...bomResolution.warnings);

  if (!bomResolution.ok || !bomResolution.bom) {
    const snapshot = createHppSnapshot({
      transactionType: 'PRODUCTION',
      branchId,
      warehouseId,
      franchiseId,
      transactionDate: productionDate,
      totalHpp: 0,
      ingredientCostBreakdown: [],
      bomSnapshot: null,
      costLayerSnapshot: null,
      warnings,
    });

    return {
      ok: false,
      total_hpp: 0,
      hpp_per_pcs: null,
      hpp_per_unit: null,
      hpp_per_batch: 0,
      ingredient_cost_breakdown: [],
      bom_snapshot: null,
      cost_layer_snapshot: null,
      hpp_snapshot: snapshot,
      warnings,
    };
  }

  const bomSnapshotResult = createBomSnapshot(bomResolution.bom, {
    targetYieldQty,
    targetYieldUnit,
    branchId,
    franchiseId,
    rulesSource: extractRulesSource(params),
    rules: params.rules,
    source: params.dbData || params.source,
    productionDate,
  });

  warnings.push(...bomSnapshotResult.warnings);

  if (!bomSnapshotResult.ok || !bomSnapshotResult.snapshot) {
    const snapshot = createHppSnapshot({
      transactionType: 'PRODUCTION',
      branchId,
      warehouseId,
      franchiseId,
      transactionDate: productionDate,
      totalHpp: 0,
      ingredientCostBreakdown: [],
      bomSnapshot: null,
      costLayerSnapshot: null,
      warnings,
    });

    return {
      ok: false,
      total_hpp: 0,
      hpp_per_pcs: null,
      hpp_per_unit: null,
      hpp_per_batch: 0,
      ingredient_cost_breakdown: [],
      bom_snapshot: null,
      cost_layer_snapshot: null,
      hpp_snapshot: snapshot,
      warnings,
    };
  }

  const bomSnapshot = bomSnapshotResult.snapshot;
  const inventorySource = extractInventorySource(params);
  const rulesSource = extractRulesSource(params);

  const ingredientCostBreakdown = [];
  const ingredientLayerSnapshots = [];

  let totalHpp = 0;
  let allIngredientsFulfilled = true;

  const ingredients = Array.isArray(bomSnapshot.ingredients) ? bomSnapshot.ingredients : [];

  if (ingredients.length === 0) {
    warnings.push(makeWarning('EMPTY_INGREDIENTS', 'BOM Snapshot tidak memiliki ingredient untuk dihitung HPP.', {
      recipe_id: bomSnapshot.recipe_id,
      product_id: bomSnapshot.product_id,
    }));
  }

  ingredients.forEach((ingredient, index) => {
    const consumeResult = calculateConsumptionCost(
      inventorySource,
      {
        itemId: ingredient.ingredient_id,
        itemName: ingredient.ingredient_name,
        qty: ingredient.required_qty,
        unit: ingredient.required_unit,
        branch_id: branchId,
        warehouse_id: warehouseId,
        franchise_id: franchiseId,
        date: productionDate,
      },
      {
        branchId,
        warehouseId,
        franchiseId,
        asOfDate: productionDate,
        rulesSource,
        rules: params.rules,
        includeConversionSnapshot: params.includeConversionSnapshot,
      },
    );

    warnings.push(...consumeResult.warnings);

    if (!consumeResult.ok || consumeResult.insufficient_qty > 0) {
      allIngredientsFulfilled = false;
    }

    const ingredientTotalCost = safeNumber(consumeResult.total_cost, 0);
    totalHpp += ingredientTotalCost;

    ingredientLayerSnapshots.push(consumeResult.snapshot);

    ingredientCostBreakdown.push({
      ingredient_id: ingredient.ingredient_id,
      ingredient_name: ingredient.ingredient_name,
      category: ingredient.category || '',
      supplier_id: ingredient.supplier_id || '',

      qty_used: safeNumber(consumeResult.fulfilled_qty, 0),
      requested_qty: safeNumber(ingredient.required_qty, 0),
      insufficient_qty: safeNumber(consumeResult.insufficient_qty, 0),

      unit: ingredient.required_unit,
      requested_unit: ingredient.required_unit,

      layer_cost: consumeResult.fulfilled_qty > 0
        ? roundMoney(ingredientTotalCost / consumeResult.fulfilled_qty)
        : 0,

      total_cost: roundMoney(ingredientTotalCost),

      cost_layer_snapshot: consumeResult.snapshot,
      consumed_layers: consumeResult.consumed_layers || [],

      source_index: index,
    });
  });

  const perUnit = calculatePerPcsCost({
    totalHpp,
    yieldQty: bomSnapshot.total_yield_qty,
    yieldUnit: bomSnapshot.total_yield_unit,
    targetUnit: params.hppUnit || params.hpp_unit || DEFAULT_HPP_UNIT,
    branchId,
    rules: params.rules,
    rulesSource,
  });

  warnings.push(...perUnit.warnings);

  const costLayerSnapshot = {
    snapshot_type: 'PRODUCTION_COST_LAYER_COLLECTION',
    snapshot_version: ENGINE_VERSION,
    generated_at: new Date().toISOString(),
    branch_id: branchId,
    warehouse_id: warehouseId,
    franchise_id: franchiseId,
    production_date: productionDate,
    recipe_id: bomSnapshot.recipe_id,
    product_id: bomSnapshot.product_id,
    ingredient_layer_snapshots: ingredientLayerSnapshots,
  };

  const hppSnapshot = createHppSnapshot({
    transactionType: 'PRODUCTION',
    branchId,
    warehouseId,
    franchiseId,
    transactionDate: productionDate,
    productId: bomSnapshot.product_id,
    productName: bomSnapshot.product_name,
    totalHpp,
    hppPerUnit: perUnit.hpp_per_unit,
    hppPerPcs: perUnit.hpp_per_pcs,
    yieldQty: bomSnapshot.total_yield_qty,
    yieldUnit: bomSnapshot.total_yield_unit,
    ingredientCostBreakdown,
    bomSnapshot,
    costLayerSnapshot,
    grossProfit: null,
    marginPct: null,
    warnings,
  });

  return {
    ok: validation.ok && bomResolution.ok && bomSnapshotResult.ok && allIngredientsFulfilled && perUnit.ok,
    total_hpp: roundMoney(totalHpp),
    hpp_per_pcs: perUnit.hpp_per_pcs,
    hpp_per_unit: perUnit.hpp_per_unit,
    hpp_per_batch: roundMoney(totalHpp),

    yield_qty: bomSnapshot.total_yield_qty,
    yield_unit: bomSnapshot.total_yield_unit,

    product_id: bomSnapshot.product_id,
    product_name: bomSnapshot.product_name,

    recipe_id: bomSnapshot.recipe_id,
    recipe_version: bomSnapshot.recipe_version,

    ingredient_cost_breakdown: ingredientCostBreakdown,
    bom_snapshot: bomSnapshot,
    cost_layer_snapshot: costLayerSnapshot,
    hpp_snapshot: hppSnapshot,

    warnings,
  };
};

/* =========================================================================
   ORDER / SALES HPP
   ========================================================================= */

const normalizeOrderItem = (rawItem = {}, index = 0) => {
  const productId = String(
    rawItem.product_id ||
    rawItem.productId ||
    rawItem.item_id ||
    rawItem.itemId ||
    rawItem.id ||
    '',
  ).trim();

  const productName = String(
    rawItem.product_name ||
    rawItem.productName ||
    rawItem.item_name ||
    rawItem.itemName ||
    rawItem.name ||
    '',
  ).trim();

  const qty = toNumber(rawItem.qty ?? rawItem.quantity);
  const unit = normalizeUnit(rawItem.unit || rawItem.satuan || rawItem.uom || DEFAULT_HPP_UNIT);

  const unitPrice = toNumber(
    rawItem.selling_price ??
    rawItem.sellingPrice ??
    rawItem.price ??
    rawItem.unit_price,
  );

  const subtotalRaw = toNumber(
    rawItem.subtotal ??
    rawItem.total ??
    rawItem.total_amount,
  );

  const revenue = Number.isFinite(subtotalRaw)
    ? subtotalRaw
    : (Number.isFinite(qty) && Number.isFinite(unitPrice) ? qty * unitPrice : 0);

  return {
    index,
    product_id: productId,
    product_name: productName,
    qty,
    unit,
    unit_price: Number.isFinite(unitPrice) ? unitPrice : 0,
    revenue,
    raw: { ...rawItem },
  };
};

const getExistingHppSnapshot = (params = {}) => {
  if (!params.preferExistingSnapshot && !params.prefer_existing_snapshot) return null;

  const snapshot =
    params.hppSnapshot ||
    params.hpp_snapshot ||
    parseJson(params.hpp_snapshot_json, null) ||
    parseJson(params.hppSnapshotJson, null);

  if (!snapshot || !isObject(snapshot)) return null;

  return snapshot;
};

const calculateOrderHppFromExistingSnapshot = (snapshot, params = {}) => {
  const totalRevenue = safeNumber(
    params.totalRevenue ??
    params.total_revenue ??
    params.total_amount ??
    snapshot.total_revenue,
    safeNumber(snapshot.total_revenue, 0),
  );

  const totalHpp = safeNumber(snapshot.total_hpp, 0);
  const profit = calculateGrossProfit({
    totalRevenue,
    totalHpp,
  });

  return {
    ok: true,
    from_existing_snapshot: true,

    total_hpp: profit.total_hpp,
    total_revenue: profit.total_revenue,
    gross_profit: profit.gross_profit,
    gross_margin_pct: profit.gross_margin_pct,
    margin_pct: profit.margin_pct,

    order_item_breakdown: Array.isArray(snapshot.order_item_breakdown)
      ? snapshot.order_item_breakdown
      : [],

    cost_layer_snapshot: snapshot.cost_layer_snapshot || null,
    bom_snapshot: snapshot.bom_snapshot || null,
    hpp_snapshot: snapshot,

    warnings: [
      makeWarning('USING_EXISTING_HPP_SNAPSHOT', 'HPP dihitung dari snapshot existing untuk menjaga historical integrity.', {
        snapshot_version: snapshot.snapshot_version,
        generated_at: snapshot.generated_at,
      }),
    ],
  };
};

export const calculateOrderHpp = (params = {}) => {
  const existingSnapshot = getExistingHppSnapshot({
    ...params,
    preferExistingSnapshot: params.preferExistingSnapshot !== false && params.prefer_existing_snapshot !== false,
  });

  if (existingSnapshot) {
    return calculateOrderHppFromExistingSnapshot(existingSnapshot, params);
  }

  const warnings = [];

  const validation = validateHppInput(params, { mode: 'SALES' });
  warnings.push(...validation.warnings);

  const branchId = normalizeBranchId(params.branchId || params.branch_id || DEFAULT_SCOPE_GLOBAL);
  const warehouseId = normalizeWarehouseId(params.warehouseId || params.warehouse_id || DEFAULT_WAREHOUSE);
  const franchiseId = normalizeFranchiseId(params.franchiseId || params.franchise_id || '');
  const orderDate = normalizeDateString(params.orderDate || params.order_date || params.date || getTodayISO());

  const inventorySource = extractInventorySource(params);
  const rulesSource = extractRulesSource(params);

  const rawItems = extractOrderItems(params);
  const orderItems = rawItems.map(normalizeOrderItem);

  const orderItemBreakdown = [];
  const itemLayerSnapshots = [];

  let totalRevenue = 0;
  let totalHpp = 0;
  let allItemsFulfilled = true;

  orderItems.forEach((item) => {
    totalRevenue += safeNumber(item.revenue, 0);

    const consumeResult = calculateConsumptionCost(
      inventorySource,
      {
        itemId: item.product_id,
        itemName: item.product_name,
        qty: item.qty,
        unit: item.unit,
        branch_id: branchId,
        warehouse_id: warehouseId,
        franchise_id: franchiseId,
        date: orderDate,
      },
      {
        branchId,
        warehouseId,
        franchiseId,
        asOfDate: orderDate,
        rulesSource,
        rules: params.rules,
        includeConversionSnapshot: params.includeConversionSnapshot,
      },
    );

    warnings.push(...consumeResult.warnings);

    if (!consumeResult.ok || consumeResult.insufficient_qty > 0) {
      allItemsFulfilled = false;
    }

    const itemHpp = safeNumber(consumeResult.total_cost, 0);
    totalHpp += itemHpp;

    const itemGrossProfit = item.revenue - itemHpp;
    const itemMarginPct = calculateMarginPct(itemGrossProfit, item.revenue);

    itemLayerSnapshots.push(consumeResult.snapshot);

    orderItemBreakdown.push({
      index: item.index,

      product_id: item.product_id,
      product_name: item.product_name,

      qty_sold: item.qty,
      unit: item.unit,
      unit_price: item.unit_price,

      revenue: roundMoney(item.revenue),

      total_hpp: roundMoney(itemHpp),
      hpp_per_unit: item.qty > 0 ? roundMoney(itemHpp / item.qty) : 0,

      gross_profit: roundMoney(itemGrossProfit),
      margin_pct: itemMarginPct,

      fulfilled_qty: consumeResult.fulfilled_qty,
      insufficient_qty: consumeResult.insufficient_qty,

      cost_layer_snapshot: consumeResult.snapshot,
      consumed_layers: consumeResult.consumed_layers || [],

      raw: item.raw,
    });
  });

  const profit = calculateGrossProfit({
    totalRevenue,
    totalHpp,
  });

  const costLayerSnapshot = {
    snapshot_type: 'ORDER_COST_LAYER_COLLECTION',
    snapshot_version: ENGINE_VERSION,
    generated_at: new Date().toISOString(),
    branch_id: branchId,
    warehouse_id: warehouseId,
    franchise_id: franchiseId,
    order_date: orderDate,
    item_layer_snapshots: itemLayerSnapshots,
  };

  const hppSnapshot = createHppSnapshot({
    transactionType: 'ORDER',
    branchId,
    warehouseId,
    franchiseId,
    transactionDate: orderDate,
    totalRevenue: profit.total_revenue,
    totalHpp: profit.total_hpp,
    grossProfit: profit.gross_profit,
    marginPct: profit.margin_pct,
    orderItemBreakdown,
    ingredientCostBreakdown: [],
    bomSnapshot: params.bomSnapshot || params.bom_snapshot || null,
    costLayerSnapshot,
    warnings,
  });

  return {
    ok: validation.ok && allItemsFulfilled,
    from_existing_snapshot: false,

    total_hpp: profit.total_hpp,
    total_revenue: profit.total_revenue,
    gross_profit: profit.gross_profit,
    gross_margin_pct: profit.gross_margin_pct,
    margin_pct: profit.margin_pct,

    order_item_breakdown: orderItemBreakdown,
    cost_layer_snapshot: costLayerSnapshot,
    bom_snapshot: params.bomSnapshot || params.bom_snapshot || null,
    hpp_snapshot: hppSnapshot,

    warnings,
  };
};

/* =========================================================================
   HPP SNAPSHOT
   ========================================================================= */

export const createHppSnapshot = (params = {}) => {
  const generatedAt = params.generatedAt || params.generated_at || new Date().toISOString();

  const branchId = normalizeBranchId(params.branchId || params.branch_id || DEFAULT_SCOPE_GLOBAL);
  const warehouseId = params.warehouseId || params.warehouse_id
    ? normalizeWarehouseId(params.warehouseId || params.warehouse_id)
    : '';

  const franchiseId = params.franchiseId || params.franchise_id
    ? normalizeFranchiseId(params.franchiseId || params.franchise_id)
    : '';

  const totalRevenue = params.totalRevenue ?? params.total_revenue;
  const totalHpp = safeNumber(params.totalHpp ?? params.total_hpp, 0);

  const grossProfit = params.grossProfit ?? params.gross_profit;
  const marginPct = params.marginPct ?? params.margin_pct;

  const resolvedGrossProfit = grossProfit === null || grossProfit === undefined
    ? null
    : roundMoney(grossProfit);

  const resolvedMarginPct = marginPct === null || marginPct === undefined
    ? null
    : safeNumber(marginPct, 0);

  return {
    snapshot_type: 'HPP',
    snapshot_version: ENGINE_VERSION,
    generated_at: generatedAt,

    transaction_type: normalizeCode(params.transactionType || params.transaction_type || ''),
    transaction_id: params.transactionId || params.transaction_id || '',
    transaction_date: normalizeDateString(params.transactionDate || params.transaction_date || params.date || ''),

    branch_id: branchId,
    warehouse_id: warehouseId,
    franchise_id: franchiseId,

    product_id: params.productId || params.product_id || '',
    product_name: params.productName || params.product_name || '',

    total_revenue: totalRevenue === undefined || totalRevenue === null ? null : roundMoney(totalRevenue),
    total_hpp: roundMoney(totalHpp),

    hpp_per_unit: params.hppPerUnit ?? params.hpp_per_unit ?? null,
    hpp_per_pcs: params.hppPerPcs ?? params.hpp_per_pcs ?? null,
    hpp_per_batch: params.hppPerBatch ?? params.hpp_per_batch ?? roundMoney(totalHpp),

    yield_qty: params.yieldQty ?? params.yield_qty ?? null,
    yield_unit: params.yieldUnit ?? params.yield_unit ?? '',

    gross_profit: resolvedGrossProfit,
    margin_pct: resolvedMarginPct,
    gross_margin_pct: resolvedMarginPct,

    ingredient_cost_breakdown: Array.isArray(params.ingredientCostBreakdown)
      ? params.ingredientCostBreakdown
      : Array.isArray(params.ingredient_cost_breakdown)
        ? params.ingredient_cost_breakdown
        : [],

    order_item_breakdown: Array.isArray(params.orderItemBreakdown)
      ? params.orderItemBreakdown
      : Array.isArray(params.order_item_breakdown)
        ? params.order_item_breakdown
        : [],

    bom_snapshot: params.bomSnapshot || params.bom_snapshot || null,
    cost_layer_snapshot: params.costLayerSnapshot || params.cost_layer_snapshot || null,

    conversion_snapshot: params.includeConversionSnapshot === false
      ? null
      : createConversionSnapshot(params.rulesSource || params.rules_source || params.dbData || params.source || [], {
          branchId,
          generatedAt,
        }),

    warnings: Array.isArray(params.warnings) ? params.warnings : [],
  };
};

/* =========================================================================
   SNAPSHOT HELPERS
   ========================================================================= */

export const stringifyHppSnapshot = (snapshot) => {
  return JSON.stringify(snapshot || null);
};

export const parseHppSnapshot = (snapshotValue) => {
  return parseJson(snapshotValue, null);
};

export const readHppFromSnapshot = (snapshotValue) => {
  const snapshot = parseHppSnapshot(snapshotValue);

  if (!snapshot) {
    return {
      ok: false,
      total_hpp: 0,
      gross_profit: 0,
      margin_pct: 0,
      snapshot: null,
      warnings: [
        makeWarning('HPP_SNAPSHOT_NOT_FOUND', 'HPP snapshot tidak ditemukan atau tidak valid.'),
      ],
    };
  }

  return {
    ok: true,
    total_hpp: safeNumber(snapshot.total_hpp, 0),
    gross_profit: safeNumber(snapshot.gross_profit, 0),
    margin_pct: safeNumber(snapshot.margin_pct ?? snapshot.gross_margin_pct, 0),
    snapshot,
    warnings: [],
  };
};

export default {
  validateHppInput,

  calculateProductionHpp,
  calculateOrderHpp,
  calculateRecipeCost,
  calculatePerPcsCost,
  calculateGrossProfit,

  createHppSnapshot,
  stringifyHppSnapshot,
  parseHppSnapshot,
  readHppFromSnapshot,
};
