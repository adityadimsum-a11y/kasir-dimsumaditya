/**
 * ERP DIMSUM ADITYA V2
 * Core Engine: bomEngine.js
 *
 * Purpose:
 * - Single Source of Truth untuk pembacaan Master Recipe BOM.
 * - Mendukung Global Recipe, Branch Recipe, dan Franchise Recipe.
 * - Mendukung banyak versi BOM, effective_date, expired_date, yield, waste, shrinkage.
 * - Menghasilkan BOM Snapshot untuk menjaga Historical Integrity.
 *
 * Important Principle:
 * - Engine ini TIDAK menghitung HPP.
 * - HPP adalah tanggung jawab hppEngine.js.
 * - Engine ini hanya membaca resep, validasi resep, scale resep, dan membuat snapshot.
 */

import {
  normalizeBranchId,
  normalizeUnit,
  convertUnits,
  createConversionSnapshot,
} from './conversionEngine';

/* =========================================================================
   CONSTANTS
   ========================================================================= */

const DEFAULT_SCOPE = 'GLOBAL';
const DEFAULT_STATUS_ACTIVE = 'ACTIVE';

const SCOPE_PRIORITY = Object.freeze({
  BRANCH: 300,
  FRANCHISE: 200,
  GLOBAL: 100,
  UNKNOWN: 0,
});

const FIELD_MAP = Object.freeze({
  id: ['id', 'bom_id', 'recipe_id', 'bom_recipe_id'],
  recipeId: ['recipe_id', 'bom_id', 'id', 'recipe_code'],
  recipeCode: ['recipe_code', 'kode_recipe', 'kode_bom', 'bom_code'],
  recipeVersion: ['recipe_version', 'version', 'versi', 'bom_version'],
  recipeName: ['recipe_name', 'nama_recipe', 'nama_bom', 'bom_name', 'name'],

  productId: ['product_id', 'produk_id', 'finished_good_id', 'item_output_id'],
  productName: ['product_name', 'produk_name', 'nama_produk', 'finished_good_name', 'item_output_name'],

  branchId: ['branch_id', 'scope_branch_id', 'branch', 'cabang_id'],
  franchiseId: ['franchise_id', 'scope_franchise_id', 'franchise', 'mitra_id'],
  scopeType: ['scope_type', 'scope', 'recipe_scope'],
  scopeId: ['scope_id', 'scope_ref_id'],

  effectiveDate: ['effective_date', 'tanggal_berlaku', 'valid_from', 'start_date'],
  expiredDate: ['expired_date', 'tanggal_berakhir', 'valid_until', 'end_date'],

  status: ['status', 'status_active', 'is_active', 'active'],
  isDefault: ['is_default', 'default_recipe', 'is_primary', 'primary_recipe'],

  yieldQty: ['yield_qty', 'total_yield_qty', 'hasil_qty', 'output_qty', 'qty_hasil'],
  yieldUnit: ['yield_unit', 'total_yield_unit', 'hasil_unit', 'output_unit', 'unit_hasil'],

  wastePct: ['waste_pct', 'waste_percent', 'susut_pct', 'waste_percentage'],
  shrinkagePct: ['shrinkage_pct', 'shrinkage_percent', 'penyusutan_pct', 'shrinkage_percentage'],

  ingredientsJson: [
    'ingredients_json',
    'ingredients',
    'bom_items_json',
    'recipe_items_json',
    'component_json',
    'components_json',
  ],

  ingredientId: [
    'ingredient_id',
    'raw_material_id',
    'material_id',
    'item_id',
    'bahan_id',
    'component_id',
  ],

  ingredientName: [
    'ingredient_name',
    'raw_material_name',
    'material_name',
    'item_name',
    'nama_bahan',
    'component_name',
  ],

  ingredientQty: [
    'ingredient_qty',
    'qty',
    'quantity',
    'required_qty',
    'qty_required',
    'qty_per_batch',
    'qty_per_recipe',
    'qty_per_yield',
    'jumlah',
  ],

  ingredientUnit: [
    'ingredient_unit',
    'unit',
    'satuan',
    'required_unit',
    'unit_required',
    'material_unit',
  ],

  ingredientWastePct: [
    'ingredient_waste_pct',
    'item_waste_pct',
    'material_waste_pct',
    'waste_pct_item',
  ],

  ingredientShrinkagePct: [
    'ingredient_shrinkage_pct',
    'item_shrinkage_pct',
    'material_shrinkage_pct',
    'shrinkage_pct_item',
  ],

  ingredientCategory: [
    'ingredient_category',
    'raw_material_category',
    'material_category',
    'category',
    'kategori_bahan',
  ],

  ingredientSupplierId: [
    'supplier_id',
    'default_supplier_id',
    'ingredient_supplier_id',
  ],

  priority: ['priority', 'sort_order', 'urutan'],
  updatedAt: ['updated_at', 'modified_at', 'last_updated_at'],
});

/* =========================================================================
   BASIC HELPERS
   ========================================================================= */

const isObject = (value) => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toUpperCase();

  if (['TRUE', 'YES', 'YA', 'Y', '1', 'ACTIVE', 'AKTIF', 'DEFAULT', 'PRIMARY'].includes(normalized)) {
    return true;
  }

  if (['FALSE', 'NO', 'TIDAK', 'N', '0', 'INACTIVE', 'NONAKTIF', 'DISABLED'].includes(normalized)) {
    return false;
  }

  return fallback;
};

const isDeletedRow = (row) => {
  if (!isObject(row)) return true;
  return toBoolean(row.isDeleted, false) || toBoolean(row.deleted, false);
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

const isWithinEffectivePeriod = (bom, targetDate) => {
  const date = normalizeDateString(targetDate || getTodayISO());
  const effectiveDate = normalizeDateString(bom.effective_date);
  const expiredDate = normalizeDateString(bom.expired_date);

  if (effectiveDate && date < effectiveDate) return false;
  if (expiredDate && date > expiredDate) return false;

  return true;
};

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  if (typeof value === 'object') {
    return Array.isArray(value.items) ? value.items : [];
  }

  try {
    const parsed = JSON.parse(String(value));
    if (Array.isArray(parsed)) return parsed;
    if (isObject(parsed) && Array.isArray(parsed.items)) return parsed.items;
    if (isObject(parsed) && Array.isArray(parsed.ingredients)) return parsed.ingredients;
    return [];
  } catch (error) {
    return [];
  }
};

const getStatusValue = (row) => {
  const rawStatus = firstDefined(row, FIELD_MAP.status);

  if (rawStatus === undefined || rawStatus === null || rawStatus === '') {
    return DEFAULT_STATUS_ACTIVE;
  }

  if (typeof rawStatus === 'boolean') {
    return rawStatus ? 'ACTIVE' : 'INACTIVE';
  }

  const normalized = String(rawStatus).trim().toUpperCase();

  if (['TRUE', 'YES', 'YA', 'Y', '1', 'ACTIVE', 'AKTIF', 'DEFAULT', 'PRIMARY'].includes(normalized)) {
    return 'ACTIVE';
  }

  if (['FALSE', 'NO', 'TIDAK', 'N', '0', 'INACTIVE', 'NONAKTIF', 'DISABLED'].includes(normalized)) {
    return 'INACTIVE';
  }

  return normalized || DEFAULT_STATUS_ACTIVE;
};

const isActiveStatus = (status) => {
  const normalized = String(status || '').toUpperCase();
  return ['ACTIVE', 'AKTIF', 'DEFAULT', 'PRIMARY', 'PUBLISHED'].includes(normalized);
};

const pickLatestUpdatedAt = (rows) => {
  let latest = '';

  rows.forEach((row) => {
    const raw = firstDefined(row, FIELD_MAP.updatedAt);
    if (!raw) return;

    const currentTime = new Date(raw).getTime();
    const latestTime = latest ? new Date(latest).getTime() : 0;

    if (Number.isFinite(currentTime) && currentTime > latestTime) {
      latest = raw;
    }
  });

  return latest;
};

/* =========================================================================
   SCOPE HELPERS
   ========================================================================= */

export const normalizeBomScopeType = (scopeType, branchId, franchiseId, scopeId) => {
  const normalizedScopeType = normalizeCode(scopeType);

  if (normalizedScopeType === 'BRANCH' || normalizedScopeType === 'CABANG') return 'BRANCH';
  if (normalizedScopeType === 'FRANCHISE' || normalizedScopeType === 'MITRA') return 'FRANCHISE';
  if (normalizedScopeType === 'GLOBAL' || normalizedScopeType === 'ALL' || normalizedScopeType === '*') return 'GLOBAL';

  const normalizedBranch = normalizeBranchId(branchId || '');
  const normalizedFranchise = normalizeBranchId(franchiseId || '');
  const normalizedScope = normalizeBranchId(scopeId || '');

  if (normalizedBranch && normalizedBranch !== DEFAULT_SCOPE) return 'BRANCH';
  if (normalizedFranchise && normalizedFranchise !== DEFAULT_SCOPE) return 'FRANCHISE';
  if (normalizedScope && normalizedScope !== DEFAULT_SCOPE) {
    if (String(normalizedScope).includes('FRANCHISE')) return 'FRANCHISE';
    return 'BRANCH';
  }

  return 'GLOBAL';
};

export const normalizeBomScopeId = (scopeType, branchId, franchiseId, scopeId) => {
  const type = normalizeBomScopeType(scopeType, branchId, franchiseId, scopeId);

  if (type === 'BRANCH') {
    return normalizeBranchId(branchId || scopeId || DEFAULT_SCOPE);
  }

  if (type === 'FRANCHISE') {
    return normalizeBranchId(franchiseId || scopeId || DEFAULT_SCOPE);
  }

  return DEFAULT_SCOPE;
};

const isScopeApplicable = (bom, options = {}) => {
  const requestedBranchId = normalizeBranchId(options.branchId || options.branch_id || DEFAULT_SCOPE);
  const requestedFranchiseId = normalizeBranchId(options.franchiseId || options.franchise_id || '');

  if (bom.scope_type === 'GLOBAL') return true;

  if (bom.scope_type === 'BRANCH') {
    if (!requestedBranchId || requestedBranchId === DEFAULT_SCOPE) return false;
    return bom.scope_id === requestedBranchId;
  }

  if (bom.scope_type === 'FRANCHISE') {
    if (!requestedFranchiseId) return false;
    return bom.scope_id === requestedFranchiseId;
  }

  return false;
};

/* =========================================================================
   DATA EXTRACTION
   ========================================================================= */

export const extractBomRows = (source) => {
  if (Array.isArray(source)) return source;

  if (!isObject(source)) return [];

  if (Array.isArray(source.master_recipe_bom)) return source.master_recipe_bom;
  if (Array.isArray(source.masterRecipeBom)) return source.masterRecipeBom;

  if (isObject(source.data)) {
    if (Array.isArray(source.data.master_recipe_bom)) return source.data.master_recipe_bom;
    if (Array.isArray(source.data.masterRecipeBom)) return source.data.masterRecipeBom;
  }

  return [];
};

const normalizeIngredient = (rawIngredient, index = 0, inherited = {}) => {
  const ingredientId = String(firstDefined(rawIngredient, FIELD_MAP.ingredientId) || '').trim();
  const ingredientName = String(firstDefined(rawIngredient, FIELD_MAP.ingredientName) || '').trim();

  const qty = toNumber(firstDefined(rawIngredient, FIELD_MAP.ingredientQty));
  const unit = normalizeUnit(firstDefined(rawIngredient, FIELD_MAP.ingredientUnit));

  const wastePctRaw = firstDefined(rawIngredient, FIELD_MAP.ingredientWastePct);
  const shrinkagePctRaw = firstDefined(rawIngredient, FIELD_MAP.ingredientShrinkagePct);

  const wastePct = Number.isFinite(toNumber(wastePctRaw))
    ? toNumber(wastePctRaw)
    : 0;

  const shrinkagePct = Number.isFinite(toNumber(shrinkagePctRaw))
    ? toNumber(shrinkagePctRaw)
    : 0;

  return {
    id: ingredientId || `${inherited.recipe_id || 'ING'}-${index + 1}`,
    ingredient_id: ingredientId,
    ingredient_name: ingredientName,
    category: String(firstDefined(rawIngredient, FIELD_MAP.ingredientCategory) || '').trim(),
    supplier_id: String(firstDefined(rawIngredient, FIELD_MAP.ingredientSupplierId) || '').trim(),
    qty,
    unit,
    waste_pct: wastePct,
    shrinkage_pct: shrinkagePct,
    row_index: rawIngredient.row_index || '',
    source: { ...rawIngredient },
  };
};

const normalizeBomHeaderFromRow = (row, index = 0) => {
  const recipeId = String(firstDefined(row, FIELD_MAP.recipeId) || `RECIPE_ROW_${index + 1}`).trim();
  const recipeCode = normalizeCode(firstDefined(row, FIELD_MAP.recipeCode) || recipeId);
  const recipeVersion = String(firstDefined(row, FIELD_MAP.recipeVersion) || '').trim();
  const recipeName = String(firstDefined(row, FIELD_MAP.recipeName) || recipeCode || recipeId).trim();

  const productId = String(firstDefined(row, FIELD_MAP.productId) || '').trim();
  const productName = String(firstDefined(row, FIELD_MAP.productName) || '').trim();

  const branchId = firstDefined(row, FIELD_MAP.branchId);
  const franchiseId = firstDefined(row, FIELD_MAP.franchiseId);
  const scopeTypeRaw = firstDefined(row, FIELD_MAP.scopeType);
  const scopeIdRaw = firstDefined(row, FIELD_MAP.scopeId);

  const scopeType = normalizeBomScopeType(scopeTypeRaw, branchId, franchiseId, scopeIdRaw);
  const scopeId = normalizeBomScopeId(scopeTypeRaw, branchId, franchiseId, scopeIdRaw);

  const yieldQty = toNumber(firstDefined(row, FIELD_MAP.yieldQty));
  const yieldUnit = normalizeUnit(firstDefined(row, FIELD_MAP.yieldUnit));

  const wastePctRaw = firstDefined(row, FIELD_MAP.wastePct);
  const shrinkagePctRaw = firstDefined(row, FIELD_MAP.shrinkagePct);

  const wastePct = Number.isFinite(toNumber(wastePctRaw))
    ? toNumber(wastePctRaw)
    : 0;

  const shrinkagePct = Number.isFinite(toNumber(shrinkagePctRaw))
    ? toNumber(shrinkagePctRaw)
    : 0;

  const priorityRaw = toNumber(firstDefined(row, FIELD_MAP.priority));
  const priority = Number.isFinite(priorityRaw) ? priorityRaw : 0;

  return {
    id: recipeId,
    recipe_id: recipeId,
    recipe_code: recipeCode,
    recipe_version: recipeVersion,
    recipe_name: recipeName,

    product_id: productId,
    product_name: productName,

    scope_type: scopeType,
    scope_id: scopeId,
    branch_id: scopeType === 'BRANCH' ? scopeId : DEFAULT_SCOPE,
    franchise_id: scopeType === 'FRANCHISE' ? scopeId : '',

    effective_date: normalizeDateString(firstDefined(row, FIELD_MAP.effectiveDate)),
    expired_date: normalizeDateString(firstDefined(row, FIELD_MAP.expiredDate)),

    status: getStatusValue(row),
    is_active: isActiveStatus(getStatusValue(row)),
    is_default: toBoolean(firstDefined(row, FIELD_MAP.isDefault), false),

    yield_qty: yieldQty,
    yield_unit: yieldUnit,

    waste_pct: wastePct,
    shrinkage_pct: shrinkagePct,

    priority,
    updated_at: firstDefined(row, FIELD_MAP.updatedAt) || '',
    row_indexes: row.row_index ? [row.row_index] : [],
    rows: [row],
  };
};

const bomGroupKey = (header) => {
  return [
    header.recipe_id,
    header.recipe_version,
    header.product_id,
    header.scope_type,
    header.scope_id,
    header.effective_date,
    header.expired_date,
  ].join('::');
};

const mergeBomHeader = (target, next) => {
  const merged = { ...target };

  Object.keys(next).forEach((key) => {
    const currentValue = merged[key];
    const nextValue = next[key];

    if (
      (currentValue === undefined || currentValue === null || currentValue === '' || Number.isNaN(currentValue)) &&
      nextValue !== undefined &&
      nextValue !== null &&
      nextValue !== ''
    ) {
      merged[key] = nextValue;
    }
  });

  merged.priority = Math.max(Number(merged.priority || 0), Number(next.priority || 0));
  merged.is_default = Boolean(merged.is_default || next.is_default);
  merged.is_active = Boolean(merged.is_active && next.is_active);
  merged.status = merged.is_active ? DEFAULT_STATUS_ACTIVE : 'INACTIVE';

  merged.row_indexes = Array.from(new Set([...(merged.row_indexes || []), ...(next.row_indexes || [])]));
  merged.rows = [...(merged.rows || []), ...(next.rows || [])];

  return merged;
};

/* =========================================================================
   BOM NORMALIZATION
   ========================================================================= */

export const normalizeBomRows = (source) => {
  const rows = extractBomRows(source);
  const grouped = new Map();
  const warnings = [];

  rows.forEach((row, index) => {
    if (!isObject(row)) {
      warnings.push(makeWarning('INVALID_BOM_ROW', 'Row BOM bukan object valid.', { index }));
      return;
    }

    if (isDeletedRow(row)) return;

    const header = normalizeBomHeaderFromRow(row, index);
    const key = bomGroupKey(header);

    if (!grouped.has(key)) {
      grouped.set(key, {
        ...header,
        ingredients: [],
      });
    } else {
      grouped.set(key, mergeBomHeader(grouped.get(key), header));
    }

    const currentBom = grouped.get(key);
    const ingredientsFromJson = parseJsonArray(firstDefined(row, FIELD_MAP.ingredientsJson));

    if (ingredientsFromJson.length > 0) {
      ingredientsFromJson.forEach((ingredient, ingredientIndex) => {
        if (!isObject(ingredient)) {
          warnings.push(makeWarning('INVALID_INGREDIENT_JSON_ROW', 'Ingredient JSON bukan object valid.', {
            recipe_id: header.recipe_id,
            ingredient_index: ingredientIndex,
          }));
          return;
        }

        currentBom.ingredients.push(
          normalizeIngredient(ingredient, currentBom.ingredients.length, {
            recipe_id: header.recipe_id,
          }),
        );
      });
      return;
    }

    const ingredientId = firstDefined(row, FIELD_MAP.ingredientId);
    const ingredientName = firstDefined(row, FIELD_MAP.ingredientName);
    const ingredientQty = firstDefined(row, FIELD_MAP.ingredientQty);
    const ingredientUnit = firstDefined(row, FIELD_MAP.ingredientUnit);

    if (
      ingredientId !== undefined ||
      ingredientName !== undefined ||
      ingredientQty !== undefined ||
      ingredientUnit !== undefined
    ) {
      currentBom.ingredients.push(
        normalizeIngredient(row, currentBom.ingredients.length, {
          recipe_id: header.recipe_id,
        }),
      );
    }
  });

  const boms = Array.from(grouped.values()).map((bom) => ({
    ...bom,
    updated_at: bom.updated_at || pickLatestUpdatedAt(bom.rows || []),
  }));

  return {
    boms,
    raw_count: rows.length,
    warnings,
  };
};

/* =========================================================================
   VALIDATION
   ========================================================================= */

export const validateBom = (bom, options = {}) => {
  const warnings = [];

  if (!isObject(bom)) {
    return {
      ok: false,
      warnings: [
        makeWarning('INVALID_BOM_OBJECT', 'BOM bukan object valid.'),
      ],
    };
  }

  if (!bom.recipe_id) {
    warnings.push(makeWarning('MISSING_RECIPE_ID', 'BOM tidak memiliki recipe_id.'));
  }

  if (!bom.product_id) {
    warnings.push(makeWarning('MISSING_PRODUCT_ID', 'BOM tidak memiliki product_id.', {
      recipe_id: bom.recipe_id,
    }));
  }

  if (!bom.is_active) {
    warnings.push(makeWarning('BOM_INACTIVE', 'BOM tidak aktif.', {
      recipe_id: bom.recipe_id,
      status: bom.status,
    }));
  }

  if (!Array.isArray(bom.ingredients) || bom.ingredients.length === 0) {
    warnings.push(makeWarning('EMPTY_INGREDIENTS', 'Ingredient BOM kosong.', {
      recipe_id: bom.recipe_id,
      product_id: bom.product_id,
    }));
  }

  if (!Number.isFinite(Number(bom.yield_qty)) || Number(bom.yield_qty) <= 0 || !bom.yield_unit) {
    warnings.push(makeWarning('INVALID_YIELD', 'Yield BOM tidak valid.', {
      recipe_id: bom.recipe_id,
      yield_qty: bom.yield_qty,
      yield_unit: bom.yield_unit,
    }));
  }

  if (Array.isArray(bom.ingredients)) {
    bom.ingredients.forEach((ingredient, index) => {
      if (!ingredient.ingredient_id && !ingredient.ingredient_name) {
        warnings.push(makeWarning('INVALID_INGREDIENT_NAME', 'Ingredient tidak memiliki ID atau nama bahan.', {
          recipe_id: bom.recipe_id,
          index,
        }));
      }

      if (!Number.isFinite(Number(ingredient.qty)) || Number(ingredient.qty) <= 0) {
        warnings.push(makeWarning('INVALID_INGREDIENT_QTY', 'Qty ingredient tidak valid.', {
          recipe_id: bom.recipe_id,
          ingredient_id: ingredient.ingredient_id,
          ingredient_name: ingredient.ingredient_name,
          qty: ingredient.qty,
        }));
      }

      if (!ingredient.unit) {
        warnings.push(makeWarning('INVALID_INGREDIENT_UNIT', 'Satuan ingredient kosong atau tidak valid.', {
          recipe_id: bom.recipe_id,
          ingredient_id: ingredient.ingredient_id,
          ingredient_name: ingredient.ingredient_name,
        }));
      }
    });
  }

  if (options.asOfDate && !isWithinEffectivePeriod(bom, options.asOfDate)) {
    warnings.push(makeWarning('BOM_OUTSIDE_EFFECTIVE_DATE', 'BOM berada di luar periode effective_date / expired_date.', {
      recipe_id: bom.recipe_id,
      as_of_date: normalizeDateString(options.asOfDate),
      effective_date: bom.effective_date,
      expired_date: bom.expired_date,
    }));
  }

  const blockingCodes = new Set([
    'INVALID_BOM_OBJECT',
    'MISSING_RECIPE_ID',
    'MISSING_PRODUCT_ID',
    'BOM_INACTIVE',
    'EMPTY_INGREDIENTS',
    'INVALID_YIELD',
    'INVALID_INGREDIENT_NAME',
    'INVALID_INGREDIENT_QTY',
    'INVALID_INGREDIENT_UNIT',
    'BOM_OUTSIDE_EFFECTIVE_DATE',
  ]);

  return {
    ok: !warnings.some((warning) => blockingCodes.has(warning.code)),
    warnings,
  };
};

/* =========================================================================
   RESOLVE ACTIVE BOM
   ========================================================================= */

const scoreBomCandidate = (bom) => {
  const scopeScore = SCOPE_PRIORITY[bom.scope_type] || SCOPE_PRIORITY.UNKNOWN;
  const defaultScore = bom.is_default ? 10 : 0;
  const activeScore = bom.is_active ? 5 : 0;
  const priorityScore = Number(bom.priority || 0);

  const effectiveTime = bom.effective_date ? new Date(bom.effective_date).getTime() : 0;
  const updatedTime = bom.updated_at ? new Date(bom.updated_at).getTime() : 0;

  return {
    total: scopeScore + defaultScore + activeScore + priorityScore,
    scopeScore,
    defaultScore,
    activeScore,
    priorityScore,
    effectiveTime: Number.isFinite(effectiveTime) ? effectiveTime : 0,
    updatedTime: Number.isFinite(updatedTime) ? updatedTime : 0,
  };
};

const sortBomCandidates = (a, b) => {
  const scoreA = scoreBomCandidate(a);
  const scoreB = scoreBomCandidate(b);

  if (scoreB.total !== scoreA.total) return scoreB.total - scoreA.total;
  if (scoreB.scopeScore !== scoreA.scopeScore) return scoreB.scopeScore - scoreA.scopeScore;
  if (scoreB.defaultScore !== scoreA.defaultScore) return scoreB.defaultScore - scoreA.defaultScore;
  if (scoreB.effectiveTime !== scoreA.effectiveTime) return scoreB.effectiveTime - scoreA.effectiveTime;
  if (scoreB.updatedTime !== scoreA.updatedTime) return scoreB.updatedTime - scoreA.updatedTime;

  return String(b.recipe_version || '').localeCompare(String(a.recipe_version || ''));
};

const applyBomFilters = (boms, options = {}) => {
  const productId = String(options.productId || options.product_id || '').trim();
  const productName = String(options.productName || options.product_name || '').trim().toUpperCase();
  const recipeId = String(options.recipeId || options.recipe_id || '').trim();
  const recipeVersion = String(options.recipeVersion || options.recipe_version || '').trim();
  const recipeCode = normalizeCode(options.recipeCode || options.recipe_code || '');
  const asOfDate = normalizeDateString(options.asOfDate || options.as_of_date || options.productionDate || options.date || getTodayISO());

  return boms.filter((bom) => {
    if (productId && String(bom.product_id) !== productId) return false;

    if (productName && String(bom.product_name || '').toUpperCase() !== productName) {
      return false;
    }

    if (recipeId && String(bom.recipe_id) !== recipeId) return false;
    if (recipeVersion && String(bom.recipe_version) !== recipeVersion) return false;
    if (recipeCode && normalizeCode(bom.recipe_code) !== recipeCode) return false;

    if (!isScopeApplicable(bom, options)) return false;
    if (!isWithinEffectivePeriod(bom, asOfDate)) return false;

    return true;
  });
};

export const resolveBom = (source, options = {}) => {
  const normalized = normalizeBomRows(source);
  const warnings = [...normalized.warnings];

  const includeInactive = Boolean(options.includeInactive || options.include_inactive);
  const allowInvalid = Boolean(options.allowInvalid || options.allow_invalid);

  let candidates = applyBomFilters(normalized.boms, options);

  if (!includeInactive) {
    const inactiveCount = candidates.filter((bom) => !bom.is_active).length;
    if (inactiveCount > 0) {
      warnings.push(makeWarning('BOM_INACTIVE', 'Sebagian BOM kandidat tidak aktif dan dikeluarkan dari seleksi.', {
        inactive_count: inactiveCount,
      }));
    }
    candidates = candidates.filter((bom) => bom.is_active);
  }

  if (!allowInvalid) {
    const validCandidates = [];
    candidates.forEach((bom) => {
      const validation = validateBom(bom, options);

      if (validation.ok) {
        validCandidates.push(bom);
      } else {
        warnings.push(...validation.warnings);
      }
    });

    candidates = validCandidates;
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      bom: null,
      candidates: [],
      warnings: [
        ...warnings,
        makeWarning('BOM_NOT_FOUND', 'BOM tidak ditemukan untuk kriteria yang diminta.', {
          product_id: options.productId || options.product_id || '',
          product_name: options.productName || options.product_name || '',
          branch_id: normalizeBranchId(options.branchId || options.branch_id || DEFAULT_SCOPE),
          franchise_id: normalizeBranchId(options.franchiseId || options.franchise_id || ''),
          as_of_date: normalizeDateString(options.asOfDate || options.as_of_date || options.productionDate || options.date || getTodayISO()),
        }),
      ],
    };
  }

  const sortedCandidates = [...candidates].sort(sortBomCandidates);
  const selectedBom = sortedCandidates[0];

  const sameTopScore = sortedCandidates.filter((bom) => {
    const selectedScore = scoreBomCandidate(selectedBom);
    const bomScore = scoreBomCandidate(bom);

    return (
      selectedScore.total === bomScore.total &&
      selectedScore.scopeScore === bomScore.scopeScore &&
      selectedScore.defaultScore === bomScore.defaultScore &&
      selectedScore.effectiveTime === bomScore.effectiveTime
    );
  });

  if (sameTopScore.length > 1) {
    warnings.push(makeWarning('MULTIPLE_ACTIVE_BOM', 'Ditemukan lebih dari satu BOM aktif dengan prioritas sama. Sistem memilih kandidat pertama berdasarkan sorting deterministik.', {
      product_id: selectedBom.product_id,
      selected_recipe_id: selectedBom.recipe_id,
      candidates: sameTopScore.map((bom) => ({
        recipe_id: bom.recipe_id,
        recipe_version: bom.recipe_version,
        scope_type: bom.scope_type,
        scope_id: bom.scope_id,
        effective_date: bom.effective_date,
      })),
    }));
  }

  return {
    ok: true,
    bom: selectedBom,
    candidates: sortedCandidates,
    warnings,
  };
};

export const getActiveBom = (source, options = {}) => {
  return resolveBom(source, {
    ...options,
    includeInactive: false,
    allowInvalid: false,
  });
};

/* =========================================================================
   REQUIREMENT CALCULATION & SCALE
   ========================================================================= */

const normalizePct = (value) => {
  const num = toNumber(value);
  if (!Number.isFinite(num)) return 0;
  return num;
};

const calculateAdjustmentMultiplier = (wastePct = 0, shrinkagePct = 0) => {
  const waste = normalizePct(wastePct);
  const shrinkage = normalizePct(shrinkagePct);

  return 1 + (waste / 100) + (shrinkage / 100);
};

export const calculateIngredientRequirement = (ingredient, scaleFactor = 1, options = {}) => {
  const warnings = [];

  if (!isObject(ingredient)) {
    return {
      ok: false,
      requirement: null,
      warnings: [
        makeWarning('INVALID_INGREDIENT_OBJECT', 'Ingredient bukan object valid.'),
      ],
    };
  }

  const factor = toNumber(scaleFactor);
  const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : NaN;

  if (!Number.isFinite(safeFactor)) {
    warnings.push(makeWarning('INVALID_SCALE_FACTOR', 'Scale factor ingredient tidak valid.', {
      scale_factor: scaleFactor,
    }));
  }

  const baseQty = toNumber(ingredient.qty);
  if (!Number.isFinite(baseQty) || baseQty <= 0) {
    warnings.push(makeWarning('INVALID_INGREDIENT_QTY', 'Qty ingredient tidak valid.', {
      ingredient_id: ingredient.ingredient_id,
      ingredient_name: ingredient.ingredient_name,
      qty: ingredient.qty,
    }));
  }

  if (!ingredient.unit) {
    warnings.push(makeWarning('INVALID_INGREDIENT_UNIT', 'Satuan ingredient kosong atau tidak valid.', {
      ingredient_id: ingredient.ingredient_id,
      ingredient_name: ingredient.ingredient_name,
    }));
  }

  const bomWastePct = normalizePct(options.bomWastePct || options.bom_waste_pct || 0);
  const bomShrinkagePct = normalizePct(options.bomShrinkagePct || options.bom_shrinkage_pct || 0);
  const ingredientWastePct = normalizePct(ingredient.waste_pct || 0);
  const ingredientShrinkagePct = normalizePct(ingredient.shrinkage_pct || 0);

  const applyWaste = options.applyWaste !== false && options.apply_waste !== false;
  const applyShrinkage = options.applyShrinkage !== false && options.apply_shrinkage !== false;

  const wastePct = applyWaste ? bomWastePct + ingredientWastePct : 0;
  const shrinkagePct = applyShrinkage ? bomShrinkagePct + ingredientShrinkagePct : 0;

  const adjustmentMultiplier = calculateAdjustmentMultiplier(wastePct, shrinkagePct);

  const scaledQty = Number.isFinite(baseQty) && Number.isFinite(safeFactor)
    ? baseQty * safeFactor
    : NaN;

  const requiredQty = Number.isFinite(scaledQty)
    ? scaledQty * adjustmentMultiplier
    : NaN;

  const ok = warnings.length === 0;

  return {
    ok,
    requirement: ok
      ? {
          ingredient_id: ingredient.ingredient_id,
          ingredient_name: ingredient.ingredient_name,
          category: ingredient.category || '',
          supplier_id: ingredient.supplier_id || '',
          base_qty: baseQty,
          base_unit: ingredient.unit,
          scale_factor: safeFactor,
          scaled_qty: scaledQty,
          waste_pct: wastePct,
          shrinkage_pct: shrinkagePct,
          adjustment_multiplier: adjustmentMultiplier,
          required_qty: requiredQty,
          required_unit: ingredient.unit,
          source_row_index: ingredient.row_index || '',
        }
      : null,
    warnings,
  };
};

const calculateYieldScaleFactor = (bom, targetYieldQty, targetYieldUnit, options = {}) => {
  const warnings = [];

  const bomYieldQty = toNumber(bom.yield_qty);
  const targetQty = toNumber(targetYieldQty);

  if (!Number.isFinite(bomYieldQty) || bomYieldQty <= 0) {
    return {
      ok: false,
      scale_factor: null,
      target_yield_qty: targetQty,
      target_yield_unit: normalizeUnit(targetYieldUnit),
      warnings: [
        makeWarning('INVALID_YIELD', 'Yield BOM tidak valid untuk scale.', {
          recipe_id: bom.recipe_id,
          yield_qty: bom.yield_qty,
          yield_unit: bom.yield_unit,
        }),
      ],
    };
  }

  if (!Number.isFinite(targetQty) || targetQty <= 0) {
    return {
      ok: false,
      scale_factor: null,
      target_yield_qty: targetQty,
      target_yield_unit: normalizeUnit(targetYieldUnit),
      warnings: [
        makeWarning('INVALID_TARGET_YIELD', 'Target yield tidak valid.', {
          target_yield_qty: targetYieldQty,
          target_yield_unit: targetYieldUnit,
        }),
      ],
    };
  }

  const bomYieldUnit = normalizeUnit(bom.yield_unit);
  const normalizedTargetUnit = normalizeUnit(targetYieldUnit || bomYieldUnit);

  if (!bomYieldUnit || !normalizedTargetUnit) {
    return {
      ok: false,
      scale_factor: null,
      target_yield_qty: targetQty,
      target_yield_unit: normalizedTargetUnit,
      warnings: [
        makeWarning('INVALID_YIELD_UNIT', 'Yield unit BOM atau target yield unit tidak valid.', {
          recipe_id: bom.recipe_id,
          yield_unit: bom.yield_unit,
          target_yield_unit: targetYieldUnit,
        }),
      ],
    };
  }

  if (bomYieldUnit === normalizedTargetUnit) {
    return {
      ok: true,
      scale_factor: targetQty / bomYieldQty,
      target_yield_qty: targetQty,
      target_yield_unit: normalizedTargetUnit,
      converted_target_yield_qty: targetQty,
      converted_target_yield_unit: bomYieldUnit,
      warnings,
    };
  }

  const conversionResult = convertUnits({
    value: targetQty,
    fromUnit: normalizedTargetUnit,
    toUnit: bomYieldUnit,
    rulesSource: options.rulesSource || options.source || options.dbData || [],
    rules: options.rules,
    branchId: options.branchId || options.branch_id || bom.branch_id || DEFAULT_SCOPE,
    category: options.conversionCategory || options.conversion_category || '',
  });

  if (!conversionResult.ok) {
    return {
      ok: false,
      scale_factor: null,
      target_yield_qty: targetQty,
      target_yield_unit: normalizedTargetUnit,
      warnings: [
        ...warnings,
        ...conversionResult.warnings,
        makeWarning('YIELD_CONVERSION_FAILED', 'Konversi target yield ke yield BOM gagal.', {
          recipe_id: bom.recipe_id,
          from_unit: normalizedTargetUnit,
          to_unit: bomYieldUnit,
        }),
      ],
    };
  }

  return {
    ok: true,
    scale_factor: conversionResult.value / bomYieldQty,
    target_yield_qty: targetQty,
    target_yield_unit: normalizedTargetUnit,
    converted_target_yield_qty: conversionResult.value,
    converted_target_yield_unit: bomYieldUnit,
    conversion_path: conversionResult.path,
    warnings,
  };
};

export const scaleBom = (bom, options = {}) => {
  const validation = validateBom(bom, options);
  const warnings = [...validation.warnings];

  if (!validation.ok) {
    return {
      ok: false,
      scaled_bom: null,
      warnings,
    };
  }

  const targetYieldQty = options.targetYieldQty || options.target_yield_qty || bom.yield_qty;
  const targetYieldUnit = options.targetYieldUnit || options.target_yield_unit || bom.yield_unit;

  const factorResult = calculateYieldScaleFactor(bom, targetYieldQty, targetYieldUnit, options);
  warnings.push(...factorResult.warnings);

  if (!factorResult.ok) {
    return {
      ok: false,
      scaled_bom: null,
      warnings,
    };
  }

  const requirements = [];
  const requirementWarnings = [];

  bom.ingredients.forEach((ingredient) => {
    const result = calculateIngredientRequirement(ingredient, factorResult.scale_factor, {
      ...options,
      bomWastePct: bom.waste_pct,
      bomShrinkagePct: bom.shrinkage_pct,
    });

    if (result.warnings.length > 0) {
      requirementWarnings.push(...result.warnings);
    }

    if (result.ok && result.requirement) {
      requirements.push(result.requirement);
    }
  });

  warnings.push(...requirementWarnings);

  return {
    ok: requirementWarnings.length === 0,
    scaled_bom: {
      recipe_id: bom.recipe_id,
      recipe_code: bom.recipe_code,
      recipe_version: bom.recipe_version,
      recipe_name: bom.recipe_name,

      product_id: bom.product_id,
      product_name: bom.product_name,

      scope_type: bom.scope_type,
      scope_id: bom.scope_id,
      branch_id: bom.branch_id,
      franchise_id: bom.franchise_id,

      effective_date: bom.effective_date,
      expired_date: bom.expired_date,

      base_yield_qty: bom.yield_qty,
      base_yield_unit: bom.yield_unit,

      target_yield_qty: factorResult.target_yield_qty,
      target_yield_unit: factorResult.target_yield_unit,
      converted_target_yield_qty: factorResult.converted_target_yield_qty,
      converted_target_yield_unit: factorResult.converted_target_yield_unit,

      scale_factor: factorResult.scale_factor,
      conversion_path: factorResult.conversion_path || [],

      waste_pct: bom.waste_pct,
      shrinkage_pct: bom.shrinkage_pct,

      ingredients: requirements,
    },
    warnings,
  };
};

/* =========================================================================
   SNAPSHOT
   ========================================================================= */

export const createBomSnapshot = (bom, options = {}) => {
  const generatedAt = options.generatedAt || options.generated_at || new Date().toISOString();

  const scaleResult = options.skipScale
    ? {
        ok: true,
        scaled_bom: {
          recipe_id: bom.recipe_id,
          recipe_code: bom.recipe_code,
          recipe_version: bom.recipe_version,
          recipe_name: bom.recipe_name,
          product_id: bom.product_id,
          product_name: bom.product_name,
          scope_type: bom.scope_type,
          scope_id: bom.scope_id,
          branch_id: bom.branch_id,
          franchise_id: bom.franchise_id,
          effective_date: bom.effective_date,
          expired_date: bom.expired_date,
          base_yield_qty: bom.yield_qty,
          base_yield_unit: bom.yield_unit,
          target_yield_qty: bom.yield_qty,
          target_yield_unit: bom.yield_unit,
          converted_target_yield_qty: bom.yield_qty,
          converted_target_yield_unit: bom.yield_unit,
          scale_factor: 1,
          conversion_path: [],
          waste_pct: bom.waste_pct,
          shrinkage_pct: bom.shrinkage_pct,
          ingredients: Array.isArray(bom.ingredients)
            ? bom.ingredients.map((ingredient) => ({
                ingredient_id: ingredient.ingredient_id,
                ingredient_name: ingredient.ingredient_name,
                category: ingredient.category || '',
                supplier_id: ingredient.supplier_id || '',
                base_qty: ingredient.qty,
                base_unit: ingredient.unit,
                scale_factor: 1,
                scaled_qty: ingredient.qty,
                waste_pct: ingredient.waste_pct || 0,
                shrinkage_pct: ingredient.shrinkage_pct || 0,
                adjustment_multiplier: calculateAdjustmentMultiplier(
                  ingredient.waste_pct || 0,
                  ingredient.shrinkage_pct || 0,
                ),
                required_qty: ingredient.qty,
                required_unit: ingredient.unit,
                source_row_index: ingredient.row_index || '',
              }))
            : [],
        },
        warnings: [],
      }
    : scaleBom(bom, options);

  const warnings = [...(scaleResult.warnings || [])];

  if (!scaleResult.ok || !scaleResult.scaled_bom) {
    return {
      ok: false,
      snapshot: null,
      warnings,
    };
  }

  const scaled = scaleResult.scaled_bom;

  const snapshot = {
    snapshot_type: 'BOM',
    snapshot_version: 'ERP_DA_V2_BOM_ENGINE_1',
    generated_at: generatedAt,

    recipe_id: scaled.recipe_id,
    recipe_code: scaled.recipe_code,
    recipe_version: scaled.recipe_version,
    recipe_name: scaled.recipe_name,

    product_id: scaled.product_id,
    product_name: scaled.product_name,

    branch_id: scaled.branch_id,
    franchise_id: scaled.franchise_id,
    scope_type: scaled.scope_type,
    scope_id: scaled.scope_id,

    effective_date: scaled.effective_date,
    expired_date: scaled.expired_date,

    base_yield_qty: scaled.base_yield_qty,
    base_yield_unit: scaled.base_yield_unit,

    total_yield_qty: scaled.target_yield_qty,
    total_yield_unit: scaled.target_yield_unit,

    converted_total_yield_qty: scaled.converted_target_yield_qty,
    converted_total_yield_unit: scaled.converted_target_yield_unit,

    scale_factor: scaled.scale_factor,

    waste_pct: scaled.waste_pct,
    shrinkage_pct: scaled.shrinkage_pct,

    ingredients: scaled.ingredients.map((ingredient) => ({
      ingredient_id: ingredient.ingredient_id,
      ingredient_name: ingredient.ingredient_name,
      category: ingredient.category,
      supplier_id: ingredient.supplier_id,
      base_qty: ingredient.base_qty,
      base_unit: ingredient.base_unit,
      required_qty: ingredient.required_qty,
      required_unit: ingredient.required_unit,
      scaled_qty: ingredient.scaled_qty,
      waste_pct: ingredient.waste_pct,
      shrinkage_pct: ingredient.shrinkage_pct,
      adjustment_multiplier: ingredient.adjustment_multiplier,
    })),

    yield_conversion_path: scaled.conversion_path || [],

    conversion_snapshot: options.includeConversionSnapshot === false
      ? null
      : createConversionSnapshot(options.rulesSource || options.source || options.dbData || [], {
          branchId: scaled.branch_id || options.branchId || options.branch_id || DEFAULT_SCOPE,
          generatedAt,
        }),
  };

  return {
    ok: true,
    snapshot,
    warnings,
  };
};

/* =========================================================================
   CONVENIENCE API
   ========================================================================= */

export const resolveAndSnapshotBom = (source, options = {}) => {
  const resolveResult = getActiveBom(source, options);

  if (!resolveResult.ok || !resolveResult.bom) {
    return {
      ok: false,
      bom: null,
      snapshot: null,
      warnings: resolveResult.warnings,
    };
  }

  const snapshotResult = createBomSnapshot(resolveResult.bom, options);

  return {
    ok: snapshotResult.ok,
    bom: resolveResult.bom,
    snapshot: snapshotResult.snapshot,
    warnings: [
      ...resolveResult.warnings,
      ...snapshotResult.warnings,
    ],
  };
};

export default {
  normalizeBomScopeType,
  normalizeBomScopeId,

  extractBomRows,
  normalizeBomRows,

  validateBom,
  resolveBom,
  getActiveBom,

  calculateIngredientRequirement,
  scaleBom,

  createBomSnapshot,
  resolveAndSnapshotBom,
};
