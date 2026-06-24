/**
 * ERP DIMSUM ADITYA V2
 * Core Engine: inventoryLayerEngine.js
 *
 * Purpose:
 * - Single Source of Truth untuk pengambilan modal FIFO.
 * - Membaca inventory_cost_layers sebagai sumber modal resmi.
 * - Mendukung multi branch, multi warehouse, multi franchise.
 * - Menghasilkan cost_layer_snapshot_json untuk Production, Sales, Accounting, Profit.
 *
 * Important Principle:
 * - FIFO mutlak.
 * - Engine ini tidak mengambil keputusan bisnis otomatis.
 * - Engine ini tidak menghapus histori.
 * - Engine ini tidak mengubah transaksi lama.
 * - Consumption bersifat immutable calculation: engine mengembalikan layer_updates
 *   agar caller/backend yang menyimpan perubahan secara eksplisit.
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

const DEFAULT_STATUS_ACTIVE = 'ACTIVE';
const DEFAULT_SCOPE_GLOBAL = 'GLOBAL';
const DEFAULT_WAREHOUSE = 'MAIN';
const ENGINE_VERSION = 'ERP_DA_V2_INVENTORY_LAYER_ENGINE_1';

const ACTIVE_STATUSES = new Set([
  'ACTIVE',
  'AKTIF',
  'OPEN',
  'AVAILABLE',
  'READY',
]);

const INACTIVE_STATUSES = new Set([
  'INACTIVE',
  'NONAKTIF',
  'CLOSED',
  'VOID',
  'VOIDED',
  'CANCELLED',
  'CANCELED',
  'DELETED',
  'REVERSED',
  'EXPIRED',
]);

const FIELD_MAP = Object.freeze({
  layerId: [
    'layer_id',
    'cost_layer_id',
    'inventory_layer_id',
    'id',
  ],

  itemId: [
    'item_id',
    'raw_material_id',
    'material_id',
    'product_id',
    'sku',
    'item_code',
  ],

  itemName: [
    'item_name',
    'raw_material_name',
    'material_name',
    'product_name',
    'nama_barang',
    'nama_bahan',
  ],

  category: [
    'category',
    'kategori',
    'item_category',
    'layer_category',
  ],

  branchId: [
    'branch_id',
    'branch',
    'cabang_id',
    'scope_branch_id',
  ],

  warehouseId: [
    'warehouse_id',
    'warehouse',
    'gudang_id',
    'location_id',
    'storage_id',
    'freezer_id',
  ],

  franchiseId: [
    'franchise_id',
    'franchise',
    'mitra_id',
    'scope_franchise_id',
  ],

  qtyRemaining: [
    'qty_remaining',
    'remaining_qty',
    'stock_remaining',
    'sisa_qty',
    'qty_available',
  ],

  qtyOriginal: [
    'qty_original',
    'original_qty',
    'qty_in',
    'received_qty',
    'initial_qty',
    'qty',
    'quantity',
  ],

  unit: [
    'unit',
    'satuan',
    'uom',
    'qty_unit',
    'item_unit',
  ],

  unitCost: [
    'unit_cost',
    'cost_per_unit',
    'hpp_per_unit',
    'harga_modal',
    'harga_satuan',
    'price',
    'unit_price',
  ],

  totalCost: [
    'total_cost',
    'total_hpp',
    'total_amount',
    'amount',
  ],

  sourceDocument: [
    'source_document',
    'source_table',
    'reference_table',
    'source_type',
    'document_type',
  ],

  sourceDocumentId: [
    'source_document_id',
    'source_id',
    'reference_id',
    'document_id',
    'purchase_id',
    'batch_id',
    'order_id',
  ],

  receivedDate: [
    'received_date',
    'date',
    'tanggal_masuk',
    'created_date',
    'transaction_date',
  ],

  expiredDate: [
    'expired_date',
    'expiry_date',
    'expiration_date',
    'tanggal_expired',
    'best_before_date',
  ],

  status: [
    'status',
    'layer_status',
    'status_active',
    'is_active',
  ],

  movementType: [
    'movement_type',
    'type',
    'transaction_type',
  ],

  createdBy: [
    'created_by',
    'updated_by',
    'executor_name',
    'pic',
  ],

  createdAt: [
    'created_at',
    'updated_at',
    'timestamp',
  ],

  notes: [
    'notes',
    'description',
    'keterangan',
  ],
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

  if (['TRUE', 'YES', 'YA', 'Y', '1', 'ACTIVE', 'AKTIF'].includes(normalized)) return true;
  if (['FALSE', 'NO', 'TIDAK', 'N', '0', 'INACTIVE', 'NONAKTIF'].includes(normalized)) return false;

  return fallback;
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

const dateToTime = (value) => {
  const normalized = normalizeDateString(value);
  if (!normalized) return 0;

  const parsed = new Date(`${normalized}T00:00:00`);
  const time = parsed.getTime();

  return Number.isFinite(time) ? time : 0;
};

const isDeletedRow = (row) => {
  if (!isObject(row)) return true;
  return toBoolean(row.isDeleted, false) || toBoolean(row.deleted, false);
};

const normalizeWarehouseId = (warehouseId) => {
  const normalized = normalizeCode(warehouseId || DEFAULT_WAREHOUSE);
  return normalized || DEFAULT_WAREHOUSE;
};

const normalizeFranchiseId = (franchiseId) => {
  const normalized = normalizeBranchId(franchiseId || '');
  return normalized === DEFAULT_SCOPE_GLOBAL ? '' : normalized;
};

const normalizeLayerStatus = (statusValue) => {
  if (statusValue === undefined || statusValue === null || statusValue === '') {
    return DEFAULT_STATUS_ACTIVE;
  }

  if (typeof statusValue === 'boolean') {
    return statusValue ? DEFAULT_STATUS_ACTIVE : 'INACTIVE';
  }

  const normalized = normalizeCode(statusValue);

  if (ACTIVE_STATUSES.has(normalized)) return DEFAULT_STATUS_ACTIVE;
  if (INACTIVE_STATUSES.has(normalized)) return normalized;

  return normalized || DEFAULT_STATUS_ACTIVE;
};

const isActiveLayerStatus = (status) => {
  const normalized = normalizeLayerStatus(status);
  return ACTIVE_STATUSES.has(normalized);
};

const generateLayerId = (prefix = 'LAY') => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
};

/* =========================================================================
   DATA EXTRACTION
   ========================================================================= */

export const extractInventoryLayers = (source) => {
  if (Array.isArray(source)) return source;

  if (!isObject(source)) return [];

  if (Array.isArray(source.inventory_cost_layers)) return source.inventory_cost_layers;
  if (Array.isArray(source.inventoryCostLayers)) return source.inventoryCostLayers;

  if (isObject(source.data)) {
    if (Array.isArray(source.data.inventory_cost_layers)) return source.data.inventory_cost_layers;
    if (Array.isArray(source.data.inventoryCostLayers)) return source.data.inventoryCostLayers;
  }

  return [];
};

/* =========================================================================
   LAYER NORMALIZATION
   ========================================================================= */

export const normalizeInventoryLayer = (rawLayer, index = 0) => {
  const rawLayerId = firstDefined(rawLayer, FIELD_MAP.layerId);
  const layerId = String(rawLayerId || `LAYER_ROW_${index + 1}`).trim();

  const itemId = String(firstDefined(rawLayer, FIELD_MAP.itemId) || '').trim();
  const itemName = String(firstDefined(rawLayer, FIELD_MAP.itemName) || '').trim();

  const branchId = normalizeBranchId(firstDefined(rawLayer, FIELD_MAP.branchId) || DEFAULT_SCOPE_GLOBAL);
  const warehouseId = normalizeWarehouseId(firstDefined(rawLayer, FIELD_MAP.warehouseId) || DEFAULT_WAREHOUSE);
  const franchiseId = normalizeFranchiseId(firstDefined(rawLayer, FIELD_MAP.franchiseId) || '');

  const qtyRemainingRaw = firstDefined(rawLayer, FIELD_MAP.qtyRemaining);
  const qtyOriginalRaw = firstDefined(rawLayer, FIELD_MAP.qtyOriginal);

  const qtyRemaining = toNumber(qtyRemainingRaw);
  const qtyOriginalCandidate = toNumber(qtyOriginalRaw);
  const qtyOriginal = Number.isFinite(qtyOriginalCandidate)
    ? qtyOriginalCandidate
    : qtyRemaining;

  const unit = normalizeUnit(firstDefined(rawLayer, FIELD_MAP.unit));
  const unitCost = toNumber(firstDefined(rawLayer, FIELD_MAP.unitCost));

  const totalCostRaw = toNumber(firstDefined(rawLayer, FIELD_MAP.totalCost));
  const totalCost = Number.isFinite(totalCostRaw)
    ? totalCostRaw
    : (Number.isFinite(qtyRemaining) && Number.isFinite(unitCost) ? qtyRemaining * unitCost : NaN);

  const sourceDocument = normalizeCode(firstDefined(rawLayer, FIELD_MAP.sourceDocument) || '');
  const sourceDocumentId = String(firstDefined(rawLayer, FIELD_MAP.sourceDocumentId) || '').trim();

  const receivedDate = normalizeDateString(firstDefined(rawLayer, FIELD_MAP.receivedDate));
  const expiredDate = normalizeDateString(firstDefined(rawLayer, FIELD_MAP.expiredDate));

  const status = normalizeLayerStatus(firstDefined(rawLayer, FIELD_MAP.status));
  const movementType = normalizeCode(firstDefined(rawLayer, FIELD_MAP.movementType) || '');

  return {
    id: layerId,
    layer_id: layerId,

    item_id: itemId,
    item_name: itemName,
    category: String(firstDefined(rawLayer, FIELD_MAP.category) || '').trim(),

    branch_id: branchId,
    warehouse_id: warehouseId,
    franchise_id: franchiseId,

    qty_remaining: qtyRemaining,
    qty_original: qtyOriginal,
    unit,
    unit_cost: unitCost,
    total_cost: totalCost,

    source_document: sourceDocument,
    source_document_id: sourceDocumentId,

    received_date: receivedDate,
    expired_date: expiredDate,

    status,
    movement_type: movementType,

    created_by: String(firstDefined(rawLayer, FIELD_MAP.createdBy) || '').trim(),
    created_at: String(firstDefined(rawLayer, FIELD_MAP.createdAt) || '').trim(),
    notes: String(firstDefined(rawLayer, FIELD_MAP.notes) || '').trim(),

    row_index: rawLayer?.row_index || '',
    isDeleted: Boolean(toBoolean(rawLayer?.isDeleted, false)),

    raw: isObject(rawLayer) ? { ...rawLayer } : rawLayer,
  };
};

export const normalizeInventoryLayers = (source) => {
  const rawLayers = extractInventoryLayers(source);
  const warnings = [];

  const layers = rawLayers
    .map((row, index) => {
      if (!isObject(row)) {
        warnings.push(makeWarning('INVALID_LAYER_ROW', 'Row inventory_cost_layers bukan object valid.', { index }));
        return null;
      }

      if (isDeletedRow(row)) return null;

      return normalizeInventoryLayer(row, index);
    })
    .filter(Boolean);

  return {
    layers,
    raw_count: rawLayers.length,
    warnings,
  };
};

/* =========================================================================
   LAYER VALIDATION
   ========================================================================= */

export const validateLayer = (layer, options = {}) => {
  const warnings = [];

  if (!isObject(layer)) {
    return {
      ok: false,
      warnings: [
        makeWarning('INVALID_LAYER_OBJECT', 'Cost layer bukan object valid.'),
      ],
    };
  }

  const normalizedLayer = layer.layer_id ? layer : normalizeInventoryLayer(layer);

  if (!normalizedLayer.layer_id) {
    warnings.push(makeWarning('MISSING_LAYER_ID', 'Layer tidak memiliki layer_id.'));
  }

  if (!normalizedLayer.item_id && !normalizedLayer.item_name) {
    warnings.push(makeWarning('ITEM_NOT_FOUND', 'Layer tidak memiliki item_id atau item_name.', {
      layer_id: normalizedLayer.layer_id,
    }));
  }

  if (!normalizedLayer.branch_id) {
    warnings.push(makeWarning('MISSING_BRANCH_ID', 'Layer tidak memiliki branch_id.', {
      layer_id: normalizedLayer.layer_id,
      item_id: normalizedLayer.item_id,
    }));
  }

  if (!normalizedLayer.warehouse_id) {
    warnings.push(makeWarning('MISSING_WAREHOUSE_ID', 'Layer tidak memiliki warehouse_id.', {
      layer_id: normalizedLayer.layer_id,
      item_id: normalizedLayer.item_id,
    }));
  }

  if (!Number.isFinite(Number(normalizedLayer.qty_remaining))) {
    warnings.push(makeWarning('INVALID_QTY_REMAINING', 'qty_remaining layer tidak valid.', {
      layer_id: normalizedLayer.layer_id,
      qty_remaining: normalizedLayer.qty_remaining,
    }));
  }

  if (!Number.isFinite(Number(normalizedLayer.qty_original))) {
    warnings.push(makeWarning('INVALID_QTY_ORIGINAL', 'qty_original layer tidak valid.', {
      layer_id: normalizedLayer.layer_id,
      qty_original: normalizedLayer.qty_original,
    }));
  }

  if (Number.isFinite(Number(normalizedLayer.qty_remaining)) && Number(normalizedLayer.qty_remaining) < 0) {
    warnings.push(makeWarning('NEGATIVE_QTY_REMAINING', 'qty_remaining layer tidak boleh negatif.', {
      layer_id: normalizedLayer.layer_id,
      qty_remaining: normalizedLayer.qty_remaining,
    }));
  }

  if (Number.isFinite(Number(normalizedLayer.qty_original)) && Number(normalizedLayer.qty_original) < 0) {
    warnings.push(makeWarning('NEGATIVE_QTY_ORIGINAL', 'qty_original layer tidak boleh negatif.', {
      layer_id: normalizedLayer.layer_id,
      qty_original: normalizedLayer.qty_original,
    }));
  }

  if (!normalizedLayer.unit) {
    warnings.push(makeWarning('INVALID_LAYER_UNIT', 'Satuan layer kosong atau tidak valid.', {
      layer_id: normalizedLayer.layer_id,
      item_id: normalizedLayer.item_id,
    }));
  }

  if (!Number.isFinite(Number(normalizedLayer.unit_cost)) || Number(normalizedLayer.unit_cost) < 0) {
    warnings.push(makeWarning('INVALID_UNIT_COST', 'unit_cost layer tidak valid.', {
      layer_id: normalizedLayer.layer_id,
      unit_cost: normalizedLayer.unit_cost,
    }));
  }

  if (Number.isFinite(Number(normalizedLayer.unit_cost)) && Number(normalizedLayer.unit_cost) === 0) {
    warnings.push(makeWarning('ZERO_UNIT_COST', 'unit_cost layer bernilai 0. Pastikan ini disengaja.', {
      layer_id: normalizedLayer.layer_id,
      item_id: normalizedLayer.item_id,
    }));
  }

  if (!normalizedLayer.source_document) {
    warnings.push(makeWarning('MISSING_SOURCE_DOCUMENT', 'Layer tidak memiliki source_document.', {
      layer_id: normalizedLayer.layer_id,
    }));
  }

  if (!normalizedLayer.source_document_id) {
    warnings.push(makeWarning('MISSING_SOURCE_DOCUMENT_ID', 'Layer tidak memiliki source_document_id.', {
      layer_id: normalizedLayer.layer_id,
    }));
  }

  if (!normalizedLayer.received_date) {
    warnings.push(makeWarning('MISSING_RECEIVED_DATE', 'Layer tidak memiliki received_date.', {
      layer_id: normalizedLayer.layer_id,
    }));
  }

  if (!normalizedLayer.status) {
    warnings.push(makeWarning('MISSING_LAYER_STATUS', 'Layer tidak memiliki status.', {
      layer_id: normalizedLayer.layer_id,
    }));
  }

  if (!isActiveLayerStatus(normalizedLayer.status)) {
    warnings.push(makeWarning('LAYER_INACTIVE', 'Layer tidak aktif.', {
      layer_id: normalizedLayer.layer_id,
      status: normalizedLayer.status,
    }));
  }

  const strict = Boolean(options.strict);
  const blockingCodes = new Set([
    'INVALID_LAYER_OBJECT',
    'MISSING_LAYER_ID',
    'ITEM_NOT_FOUND',
    'MISSING_BRANCH_ID',
    'MISSING_WAREHOUSE_ID',
    'INVALID_QTY_REMAINING',
    'INVALID_QTY_ORIGINAL',
    'NEGATIVE_QTY_REMAINING',
    'NEGATIVE_QTY_ORIGINAL',
    'INVALID_LAYER_UNIT',
    'INVALID_UNIT_COST',
    'MISSING_SOURCE_DOCUMENT',
    'MISSING_SOURCE_DOCUMENT_ID',
    'MISSING_RECEIVED_DATE',
    'MISSING_LAYER_STATUS',
    'LAYER_INACTIVE',
  ]);

  const softCodes = new Set([
    'ZERO_UNIT_COST',
  ]);

  const ok = strict
    ? !warnings.some((warning) => blockingCodes.has(warning.code) || softCodes.has(warning.code))
    : !warnings.some((warning) => blockingCodes.has(warning.code));

  return {
    ok,
    layer: normalizedLayer,
    warnings,
  };
};

/* =========================================================================
   CREATE COST LAYER
   ========================================================================= */

export const createCostLayer = (payload = {}, options = {}) => {
  const warnings = [];

  const layerId = String(
    payload.layer_id ||
    payload.layerId ||
    payload.id ||
    generateLayerId(options.prefix || 'LAY'),
  ).trim();

  const quantity = toNumber(
    payload.qty_original ??
    payload.qtyOriginal ??
    payload.qty_in ??
    payload.qty ??
    payload.quantity,
  );

  const qtyRemaining = toNumber(
    payload.qty_remaining ??
    payload.qtyRemaining ??
    payload.remaining_qty ??
    quantity,
  );

  const unitCost = toNumber(
    payload.unit_cost ??
    payload.unitCost ??
    payload.cost_per_unit ??
    payload.price ??
    payload.unit_price,
  );

  const unit = normalizeUnit(payload.unit || payload.satuan || payload.uom);

  const layer = {
    id: layerId,
    layer_id: layerId,

    item_id: String(payload.item_id || payload.itemId || payload.raw_material_id || payload.product_id || '').trim(),
    item_name: String(payload.item_name || payload.itemName || payload.raw_material_name || payload.product_name || '').trim(),
    category: String(payload.category || payload.kategori || '').trim(),

    branch_id: normalizeBranchId(payload.branch_id || payload.branchId || options.branchId || options.branch_id || DEFAULT_SCOPE_GLOBAL),
    warehouse_id: normalizeWarehouseId(payload.warehouse_id || payload.warehouseId || payload.location_id || options.warehouseId || options.warehouse_id || DEFAULT_WAREHOUSE),
    franchise_id: normalizeFranchiseId(payload.franchise_id || payload.franchiseId || options.franchiseId || options.franchise_id || ''),

    qty_remaining: qtyRemaining,
    qty_original: quantity,
    unit,
    unit_cost: unitCost,
    total_cost: Number.isFinite(quantity) && Number.isFinite(unitCost) ? quantity * unitCost : NaN,

    source_document: normalizeCode(payload.source_document || payload.sourceDocument || payload.source_table || payload.reference_table || ''),
    source_document_id: String(payload.source_document_id || payload.sourceDocumentId || payload.source_id || payload.reference_id || '').trim(),

    received_date: normalizeDateString(payload.received_date || payload.receivedDate || payload.date || getTodayISO()),
    expired_date: normalizeDateString(payload.expired_date || payload.expiredDate || payload.expiry_date || ''),

    status: normalizeLayerStatus(payload.status || DEFAULT_STATUS_ACTIVE),
    movement_type: normalizeCode(payload.movement_type || payload.movementType || 'LAYER_IN'),

    created_by: String(payload.created_by || payload.createdBy || options.createdBy || options.created_by || '').trim(),
    created_at: String(payload.created_at || payload.createdAt || new Date().toISOString()).trim(),
    notes: String(payload.notes || payload.description || '').trim(),

    isDeleted: false,
  };

  const validation = validateLayer(layer, options);
  warnings.push(...validation.warnings);

  return {
    ok: validation.ok,
    layer,
    warnings,
  };
};

/* =========================================================================
   FILTER HELPERS
   ========================================================================= */

const itemMatches = (layer, options = {}) => {
  const itemId = String(options.itemId || options.item_id || '').trim();
  const itemName = String(options.itemName || options.item_name || '').trim().toUpperCase();

  if (itemId && String(layer.item_id) !== itemId) return false;
  if (itemName && String(layer.item_name || '').toUpperCase() !== itemName) return false;

  return true;
};

const scopeMatches = (layer, options = {}) => {
  const branchId = normalizeBranchId(options.branchId || options.branch_id || '');
  const warehouseId = options.warehouseId || options.warehouse_id
    ? normalizeWarehouseId(options.warehouseId || options.warehouse_id)
    : '';

  const franchiseId = options.franchiseId || options.franchise_id
    ? normalizeFranchiseId(options.franchiseId || options.franchise_id)
    : '';

  if (branchId && branchId !== DEFAULT_SCOPE_GLOBAL && layer.branch_id !== branchId) {
    return false;
  }

  if (warehouseId && layer.warehouse_id !== warehouseId) {
    return false;
  }

  if (franchiseId && layer.franchise_id !== franchiseId) {
    return false;
  }

  return true;
};

const dateMatches = (layer, options = {}) => {
  const asOfDate = normalizeDateString(options.asOfDate || options.as_of_date || options.date || getTodayISO());
  const includeFutureLayers = Boolean(options.includeFutureLayers || options.include_future_layers);
  const excludeExpired = options.excludeExpired !== false && options.exclude_expired !== false;

  if (!includeFutureLayers && layer.received_date && layer.received_date > asOfDate) {
    return false;
  }

  if (excludeExpired && layer.expired_date && layer.expired_date < asOfDate) {
    return false;
  }

  return true;
};

const layerHasPositiveBalance = (layer) => {
  return Number.isFinite(Number(layer.qty_remaining)) && Number(layer.qty_remaining) > 0;
};

const fifoSort = (a, b) => {
  const receivedA = dateToTime(a.received_date);
  const receivedB = dateToTime(b.received_date);

  if (receivedA !== receivedB) return receivedA - receivedB;

  const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
  const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;

  const safeCreatedA = Number.isFinite(createdA) ? createdA : 0;
  const safeCreatedB = Number.isFinite(createdB) ? createdB : 0;

  if (safeCreatedA !== safeCreatedB) return safeCreatedA - safeCreatedB;

  return String(a.layer_id).localeCompare(String(b.layer_id));
};

const collectMismatchWarnings = (layers, options = {}) => {
  const warnings = [];

  const requestedBranch = normalizeBranchId(options.branchId || options.branch_id || '');
  const requestedWarehouse = options.warehouseId || options.warehouse_id
    ? normalizeWarehouseId(options.warehouseId || options.warehouse_id)
    : '';

  const requestedFranchise = options.franchiseId || options.franchise_id
    ? normalizeFranchiseId(options.franchiseId || options.franchise_id)
    : '';

  const itemFiltered = layers.filter((layer) => itemMatches(layer, options));

  if (itemFiltered.length === 0) {
    warnings.push(makeWarning('ITEM_NOT_FOUND', 'Item tidak ditemukan di inventory_cost_layers.', {
      item_id: options.itemId || options.item_id || '',
      item_name: options.itemName || options.item_name || '',
    }));
    return warnings;
  }

  if (requestedBranch && requestedBranch !== DEFAULT_SCOPE_GLOBAL) {
    const branchMatches = itemFiltered.filter((layer) => layer.branch_id === requestedBranch);
    if (branchMatches.length === 0) {
      warnings.push(makeWarning('BRANCH_MISMATCH', 'Item ditemukan, tetapi tidak tersedia pada branch yang diminta.', {
        requested_branch_id: requestedBranch,
        available_branch_ids: Array.from(new Set(itemFiltered.map((layer) => layer.branch_id))).sort(),
      }));
    }
  }

  if (requestedWarehouse) {
    const warehouseMatches = itemFiltered.filter((layer) => {
      const branchOk = !requestedBranch || requestedBranch === DEFAULT_SCOPE_GLOBAL || layer.branch_id === requestedBranch;
      return branchOk && layer.warehouse_id === requestedWarehouse;
    });

    if (warehouseMatches.length === 0) {
      warnings.push(makeWarning('WAREHOUSE_MISMATCH', 'Item ditemukan, tetapi tidak tersedia pada warehouse yang diminta.', {
        requested_warehouse_id: requestedWarehouse,
        available_warehouse_ids: Array.from(new Set(itemFiltered.map((layer) => layer.warehouse_id))).sort(),
      }));
    }
  }

  if (requestedFranchise) {
    const franchiseMatches = itemFiltered.filter((layer) => layer.franchise_id === requestedFranchise);
    if (franchiseMatches.length === 0) {
      warnings.push(makeWarning('FRANCHISE_MISMATCH', 'Item ditemukan, tetapi tidak tersedia pada franchise yang diminta.', {
        requested_franchise_id: requestedFranchise,
        available_franchise_ids: Array.from(new Set(itemFiltered.map((layer) => layer.franchise_id).filter(Boolean))).sort(),
      }));
    }
  }

  return warnings;
};

/* =========================================================================
   GET AVAILABLE LAYERS
   ========================================================================= */

export const getAvailableLayers = (source, options = {}) => {
  const normalized = normalizeInventoryLayers(source);
  const warnings = [...normalized.warnings];

  const allowInvalidLayers = Boolean(options.allowInvalidLayers || options.allow_invalid_layers);
  const strictValidation = Boolean(options.strictValidation || options.strict_validation);

  const validatedLayers = [];

  normalized.layers.forEach((layer) => {
    const validation = validateLayer(layer, { strict: strictValidation });

    if (validation.warnings.length > 0) {
      warnings.push(...validation.warnings);
    }

    if (validation.ok || allowInvalidLayers) {
      validatedLayers.push(layer);
    }
  });

  warnings.push(...collectMismatchWarnings(validatedLayers, options));

  const expiredLayers = validatedLayers.filter((layer) => {
    const asOfDate = normalizeDateString(options.asOfDate || options.as_of_date || options.date || getTodayISO());
    return itemMatches(layer, options) &&
      scopeMatches(layer, options) &&
      layer.expired_date &&
      layer.expired_date < asOfDate;
  });

  if (expiredLayers.length > 0) {
    warnings.push(makeWarning('LAYER_EXPIRED', 'Sebagian layer sudah expired dan tidak dipakai.', {
      layer_ids: expiredLayers.map((layer) => layer.layer_id),
    }));
  }

  const layers = validatedLayers
    .filter((layer) => itemMatches(layer, options))
    .filter((layer) => scopeMatches(layer, options))
    .filter((layer) => dateMatches(layer, options))
    .filter((layer) => isActiveLayerStatus(layer.status))
    .filter(layerHasPositiveBalance)
    .sort(fifoSort);

  if (layers.length === 0) {
    warnings.push(makeWarning('LAYER_EMPTY', 'Tidak ada layer aktif dengan saldo tersedia.', {
      item_id: options.itemId || options.item_id || '',
      item_name: options.itemName || options.item_name || '',
      branch_id: normalizeBranchId(options.branchId || options.branch_id || ''),
      warehouse_id: options.warehouseId || options.warehouse_id || '',
    }));
  }

  return {
    ok: layers.length > 0,
    layers,
    warnings,
  };
};

/* =========================================================================
   BALANCE
   ========================================================================= */

export const getLayerBalance = (source, options = {}) => {
  const available = getAvailableLayers(source, options);
  const warnings = [...available.warnings];

  const byUnit = {};
  let totalValue = 0;

  available.layers.forEach((layer) => {
    const unit = layer.unit || 'UNKNOWN';

    if (!byUnit[unit]) {
      byUnit[unit] = {
        unit,
        qty_remaining: 0,
        total_value: 0,
        layer_count: 0,
      };
    }

    const qty = Number(layer.qty_remaining || 0);
    const value = qty * Number(layer.unit_cost || 0);

    byUnit[unit].qty_remaining += qty;
    byUnit[unit].total_value += value;
    byUnit[unit].layer_count += 1;

    totalValue += value;
  });

  return {
    ok: available.ok,
    item_id: options.itemId || options.item_id || '',
    item_name: options.itemName || options.item_name || '',
    branch_id: normalizeBranchId(options.branchId || options.branch_id || ''),
    warehouse_id: options.warehouseId || options.warehouse_id || '',
    franchise_id: options.franchiseId || options.franchise_id || '',
    total_value: totalValue,
    by_unit: Object.values(byUnit),
    layer_count: available.layers.length,
    layers: available.layers.map((layer) => ({
      layer_id: layer.layer_id,
      item_id: layer.item_id,
      item_name: layer.item_name,
      branch_id: layer.branch_id,
      warehouse_id: layer.warehouse_id,
      franchise_id: layer.franchise_id,
      qty_remaining: layer.qty_remaining,
      qty_original: layer.qty_original,
      unit: layer.unit,
      unit_cost: layer.unit_cost,
      total_value: Number(layer.qty_remaining || 0) * Number(layer.unit_cost || 0),
      received_date: layer.received_date,
      expired_date: layer.expired_date,
      source_document: layer.source_document,
      source_document_id: layer.source_document_id,
      status: layer.status,
    })),
    warnings,
  };
};

/* =========================================================================
   UNIT CONVERSION HELPERS FOR CONSUMPTION
   ========================================================================= */

const convertQty = (params = {}) => {
  const {
    value,
    fromUnit,
    toUnit,
    branchId,
    rules,
    rulesSource,
    snapshot,
  } = params;

  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);

  if (from === to) {
    return {
      ok: true,
      value: Number(value),
      path: [],
      warnings: [],
    };
  }

  const result = convertUnits({
    value,
    fromUnit: from,
    toUnit: to,
    branchId,
    rules,
    rulesSource,
    snapshot,
  });

  return result;
};

/* =========================================================================
   CONSUMPTION
   ========================================================================= */

export const consumeCostLayer = (source, request = {}, options = {}) => {
  const warnings = [];

  const requestedQty = toNumber(
    request.qty ??
    request.quantity ??
    request.required_qty ??
    request.consume_qty ??
    options.qty,
  );

  const requestedUnit = normalizeUnit(
    request.unit ??
    request.required_unit ??
    request.consume_unit ??
    options.unit,
  );

  const branchId = normalizeBranchId(
    request.branch_id ??
    request.branchId ??
    options.branchId ??
    options.branch_id ??
    '',
  );

  const warehouseId = request.warehouse_id || request.warehouseId || options.warehouseId || options.warehouse_id || '';
  const franchiseId = request.franchise_id || request.franchiseId || options.franchiseId || options.franchise_id || '';

  if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
    return {
      ok: false,
      total_cost: 0,
      requested_qty: requestedQty,
      requested_unit: requestedUnit,
      fulfilled_qty: 0,
      fulfilled_unit: requestedUnit,
      insufficient_qty: requestedQty,
      consumed_layers: [],
      layer_updates: [],
      updated_layers: extractInventoryLayers(source),
      snapshot: null,
      warnings: [
        makeWarning('INVALID_CONSUMPTION_QTY', 'Qty konsumsi tidak valid.', {
          qty: request.qty ?? request.quantity ?? options.qty,
        }),
      ],
    };
  }

  if (!requestedUnit) {
    return {
      ok: false,
      total_cost: 0,
      requested_qty: requestedQty,
      requested_unit: requestedUnit,
      fulfilled_qty: 0,
      fulfilled_unit: requestedUnit,
      insufficient_qty: requestedQty,
      consumed_layers: [],
      layer_updates: [],
      updated_layers: extractInventoryLayers(source),
      snapshot: null,
      warnings: [
        makeWarning('INVALID_CONSUMPTION_UNIT', 'Satuan konsumsi kosong atau tidak valid.'),
      ],
    };
  }

  const available = getAvailableLayers(source, {
    ...options,
    ...request,
    branchId,
    warehouseId,
    franchiseId,
  });

  warnings.push(...available.warnings);

  if (available.layers.length === 0) {
    const snapshot = createLayerSnapshot({
      request: {
        ...request,
        qty: requestedQty,
        unit: requestedUnit,
        branch_id: branchId,
        warehouse_id: warehouseId,
        franchise_id: franchiseId,
      },
      consumedLayers: [],
      totalCost: 0,
      fulfilledQty: 0,
      insufficientQty: requestedQty,
      warnings,
    });

    return {
      ok: false,
      total_cost: 0,
      requested_qty: requestedQty,
      requested_unit: requestedUnit,
      fulfilled_qty: 0,
      fulfilled_unit: requestedUnit,
      insufficient_qty: requestedQty,
      consumed_layers: [],
      layer_updates: [],
      updated_layers: extractInventoryLayers(source),
      snapshot,
      warnings,
    };
  }

  let remainingRequestQty = requestedQty;
  let fulfilledRequestQty = 0;
  let totalCost = 0;

  const consumedLayers = [];
  const layerUpdates = [];

  const sourceLayers = normalizeInventoryLayers(source).layers;
  const updatedLayerMap = new Map(sourceLayers.map((layer) => [layer.layer_id, { ...layer }]));

  for (const layer of available.layers) {
    if (remainingRequestQty <= 0) break;

    const layerUnit = normalizeUnit(layer.unit);

    let neededInLayerUnit = remainingRequestQty;
    let conversionPathToLayerUnit = [];

    if (requestedUnit !== layerUnit) {
      const conversionToLayer = convertQty({
        value: remainingRequestQty,
        fromUnit: requestedUnit,
        toUnit: layerUnit,
        branchId: branchId || layer.branch_id,
        rules: options.rules,
        rulesSource: options.rulesSource || options.source || options.dbData || [],
      });

      if (!conversionToLayer.ok) {
        warnings.push(
          ...conversionToLayer.warnings,
          makeWarning('UNIT_MISMATCH', 'Satuan konsumsi berbeda dengan satuan layer dan tidak bisa dikonversi.', {
            layer_id: layer.layer_id,
            requested_unit: requestedUnit,
            layer_unit: layerUnit,
          }),
        );
        continue;
      }

      neededInLayerUnit = conversionToLayer.value;
      conversionPathToLayerUnit = conversionToLayer.path || [];
    }

    const availableQtyLayerUnit = Number(layer.qty_remaining || 0);
    const consumedQtyLayerUnit = Math.min(availableQtyLayerUnit, neededInLayerUnit);

    if (consumedQtyLayerUnit <= 0) continue;

    let consumedQtyRequestUnit = consumedQtyLayerUnit;
    let conversionPathToRequestUnit = [];

    if (requestedUnit !== layerUnit) {
      const conversionBack = convertQty({
        value: consumedQtyLayerUnit,
        fromUnit: layerUnit,
        toUnit: requestedUnit,
        branchId: branchId || layer.branch_id,
        rules: options.rules,
        rulesSource: options.rulesSource || options.source || options.dbData || [],
      });

      if (!conversionBack.ok) {
        warnings.push(
          ...conversionBack.warnings,
          makeWarning('UNIT_MISMATCH', 'Qty layer yang dikonsumsi tidak bisa dikonversi kembali ke satuan request.', {
            layer_id: layer.layer_id,
            requested_unit: requestedUnit,
            layer_unit: layerUnit,
          }),
        );
        continue;
      }

      consumedQtyRequestUnit = conversionBack.value;
      conversionPathToRequestUnit = conversionBack.path || [];
    }

    const cost = consumedQtyLayerUnit * Number(layer.unit_cost || 0);
    const newQtyRemaining = Number(layer.qty_remaining || 0) - consumedQtyLayerUnit;

    totalCost += cost;
    fulfilledRequestQty += consumedQtyRequestUnit;
    remainingRequestQty = Math.max(0, requestedQty - fulfilledRequestQty);

    const consumedRecord = {
      layer_id: layer.layer_id,
      item_id: layer.item_id,
      item_name: layer.item_name,

      branch_id: layer.branch_id,
      warehouse_id: layer.warehouse_id,
      franchise_id: layer.franchise_id,

      consumed_qty: consumedQtyLayerUnit,
      consumed_unit: layerUnit,

      consumed_qty_request_unit: consumedQtyRequestUnit,
      request_unit: requestedUnit,

      qty_before: Number(layer.qty_remaining || 0),
      qty_after: newQtyRemaining,
      qty_original: Number(layer.qty_original || 0),

      unit_cost: Number(layer.unit_cost || 0),
      total_cost: cost,

      source_document: layer.source_document,
      source_document_id: layer.source_document_id,
      received_date: layer.received_date,
      expired_date: layer.expired_date,

      conversion_path_to_layer_unit: conversionPathToLayerUnit,
      conversion_path_to_request_unit: conversionPathToRequestUnit,
    };

    consumedLayers.push(consumedRecord);

    const updatedLayer = {
      ...layer,
      qty_remaining: newQtyRemaining,
      total_cost: newQtyRemaining * Number(layer.unit_cost || 0),
      status: newQtyRemaining <= 0 ? 'CLOSED' : layer.status,
    };

    updatedLayerMap.set(layer.layer_id, updatedLayer);

    layerUpdates.push({
      layer_id: layer.layer_id,
      id: layer.layer_id,
      item_id: layer.item_id,
      item_name: layer.item_name,
      branch_id: layer.branch_id,
      warehouse_id: layer.warehouse_id,
      franchise_id: layer.franchise_id,
      qty_before: Number(layer.qty_remaining || 0),
      qty_consumed: consumedQtyLayerUnit,
      qty_after: newQtyRemaining,
      unit: layerUnit,
      unit_cost: Number(layer.unit_cost || 0),
      status: updatedLayer.status,
    });
  }

  const insufficientQty = Math.max(0, requestedQty - fulfilledRequestQty);

  if (insufficientQty > 0) {
    warnings.push(makeWarning('INSUFFICIENT_STOCK', 'Stok tidak cukup untuk memenuhi konsumsi FIFO.', {
      requested_qty: requestedQty,
      fulfilled_qty: fulfilledRequestQty,
      insufficient_qty: insufficientQty,
      unit: requestedUnit,
      item_id: request.itemId || request.item_id || '',
      item_name: request.itemName || request.item_name || '',
      branch_id: branchId,
      warehouse_id: warehouseId,
    }));
  }

  const snapshot = createLayerSnapshot({
    request: {
      ...request,
      qty: requestedQty,
      unit: requestedUnit,
      branch_id: branchId,
      warehouse_id: warehouseId,
      franchise_id: franchiseId,
    },
    consumedLayers,
    totalCost,
    fulfilledQty: fulfilledRequestQty,
    insufficientQty,
    warnings,
    options,
  });

  const updatedLayers = Array.from(updatedLayerMap.values()).sort(fifoSort);

  return {
    ok: insufficientQty <= 0 && consumedLayers.length > 0,
    total_cost: totalCost,
    requested_qty: requestedQty,
    requested_unit: requestedUnit,
    fulfilled_qty: fulfilledRequestQty,
    fulfilled_unit: requestedUnit,
    insufficient_qty: insufficientQty,
    consumed_layers: consumedLayers,
    layer_updates: layerUpdates,
    updated_layers: updatedLayers,
    snapshot,
    warnings,
  };
};

/* =========================================================================
   COST CALCULATION
   ========================================================================= */

export const calculateConsumptionCost = (source, request = {}, options = {}) => {
  const result = consumeCostLayer(source, request, {
    ...options,
    dryRun: true,
  });

  return {
    ok: result.ok,
    total_cost: result.total_cost,
    average_unit_cost: result.fulfilled_qty > 0 ? result.total_cost / result.fulfilled_qty : 0,
    requested_qty: result.requested_qty,
    requested_unit: result.requested_unit,
    fulfilled_qty: result.fulfilled_qty,
    fulfilled_unit: result.fulfilled_unit,
    insufficient_qty: result.insufficient_qty,
    consumed_layers: result.consumed_layers,
    snapshot: result.snapshot,
    warnings: result.warnings,
  };
};

/* =========================================================================
   SNAPSHOT
   ========================================================================= */

export const createLayerSnapshot = (params = {}) => {
  const generatedAt = params.generatedAt || params.generated_at || new Date().toISOString();
  const request = params.request || {};
  const consumedLayers = Array.isArray(params.consumedLayers)
    ? params.consumedLayers
    : Array.isArray(params.consumed_layers)
      ? params.consumed_layers
      : [];

  const totalCost = Number(params.totalCost ?? params.total_cost ?? 0);
  const fulfilledQty = Number(params.fulfilledQty ?? params.fulfilled_qty ?? 0);
  const insufficientQty = Number(params.insufficientQty ?? params.insufficient_qty ?? 0);

  const branchId = normalizeBranchId(request.branch_id || request.branchId || params.branchId || params.branch_id || '');
  const warehouseId = request.warehouse_id || request.warehouseId || params.warehouseId || params.warehouse_id || '';
  const franchiseId = request.franchise_id || request.franchiseId || params.franchiseId || params.franchise_id || '';

  return {
    snapshot_type: 'INVENTORY_COST_LAYER_CONSUMPTION',
    snapshot_version: ENGINE_VERSION,
    generated_at: generatedAt,

    item_id: request.item_id || request.itemId || '',
    item_name: request.item_name || request.itemName || '',

    branch_id: branchId,
    warehouse_id: warehouseId ? normalizeWarehouseId(warehouseId) : '',
    franchise_id: franchiseId ? normalizeFranchiseId(franchiseId) : '',

    requested_qty: Number(request.qty ?? request.quantity ?? request.required_qty ?? 0),
    requested_unit: normalizeUnit(request.unit || request.required_unit || ''),

    fulfilled_qty: fulfilledQty,
    fulfilled_unit: normalizeUnit(request.unit || request.required_unit || ''),

    insufficient_qty: insufficientQty,

    total_cost: totalCost,
    average_unit_cost: fulfilledQty > 0 ? totalCost / fulfilledQty : 0,

    consumed_layers: consumedLayers.map((layer) => ({
      layer_id: layer.layer_id,
      item_id: layer.item_id,
      item_name: layer.item_name,

      branch_id: layer.branch_id,
      warehouse_id: layer.warehouse_id,
      franchise_id: layer.franchise_id,

      consumed_qty: layer.consumed_qty,
      consumed_unit: layer.consumed_unit,

      consumed_qty_request_unit: layer.consumed_qty_request_unit,
      request_unit: layer.request_unit,

      qty_before: layer.qty_before,
      qty_after: layer.qty_after,
      qty_original: layer.qty_original,

      unit_cost: layer.unit_cost,
      total_cost: layer.total_cost,

      source_document: layer.source_document,
      source_document_id: layer.source_document_id,

      received_date: layer.received_date,
      expired_date: layer.expired_date,

      conversion_path_to_layer_unit: layer.conversion_path_to_layer_unit || [],
      conversion_path_to_request_unit: layer.conversion_path_to_request_unit || [],
    })),

    conversion_snapshot: params.options?.includeConversionSnapshot === false
      ? null
      : createConversionSnapshot(params.options?.rulesSource || params.options?.source || params.options?.dbData || [], {
          branchId,
          generatedAt,
        }),

    warnings: Array.isArray(params.warnings) ? params.warnings : [],
  };
};

/* =========================================================================
   SUMMARY HELPERS
   ========================================================================= */

export const hasEnoughStock = (source, request = {}, options = {}) => {
  const result = calculateConsumptionCost(source, request, options);
  return result.ok && result.insufficient_qty <= 0;
};

export const listLayerItems = (source, options = {}) => {
  const normalized = normalizeInventoryLayers(source);
  const branchId = normalizeBranchId(options.branchId || options.branch_id || '');
  const warehouseId = options.warehouseId || options.warehouse_id
    ? normalizeWarehouseId(options.warehouseId || options.warehouse_id)
    : '';

  const map = new Map();

  normalized.layers.forEach((layer) => {
    if (branchId && branchId !== DEFAULT_SCOPE_GLOBAL && layer.branch_id !== branchId) return;
    if (warehouseId && layer.warehouse_id !== warehouseId) return;
    if (!isActiveLayerStatus(layer.status)) return;
    if (!layerHasPositiveBalance(layer)) return;

    const key = layer.item_id || layer.item_name;
    if (!key) return;

    if (!map.has(key)) {
      map.set(key, {
        item_id: layer.item_id,
        item_name: layer.item_name,
        category: layer.category,
        units: new Set(),
        layer_count: 0,
      });
    }

    const item = map.get(key);
    item.units.add(layer.unit);
    item.layer_count += 1;
  });

  return Array.from(map.values()).map((item) => ({
    ...item,
    units: Array.from(item.units).sort(),
  }));
};

export default {
  extractInventoryLayers,
  normalizeInventoryLayer,
  normalizeInventoryLayers,

  createCostLayer,
  validateLayer,

  getAvailableLayers,
  getLayerBalance,

  consumeCostLayer,
  calculateConsumptionCost,

  createLayerSnapshot,

  hasEnoughStock,
  listLayerItems,
};
