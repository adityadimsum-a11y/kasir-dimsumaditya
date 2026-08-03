/**
 * ERP DIMSUM ADITYA V2
 * Business Engine: purchaseEngine.js
 *
 * Purpose:
 * - Business Engine resmi untuk seluruh pembelian ERP.
 * - Pembelian adalah sumber utama stok, modal, hutang supplier,
 *   dan inventory cost layer.
 *
 * Dependencies:
 * - inventoryLayerEngine.js
 * - snapshotEngine.js
 * - conversionEngine.js
 *
 * Important Principles:
 * - Engine ini TIDAK menyimpan data.
 * - Engine ini TIDAK update sheet.
 * - Engine ini TIDAK update database.
 * - Engine ini hanya memvalidasi, menghitung, dan membuat transaction package.
 * - Harga lama tidak boleh berubah. Harga pembelian dikunci melalui snapshot
 *   dan inventory cost layer.
 */

import {
  normalizeBranchId,
  normalizeUnit,
  createConversionSnapshot,
} from './conversionEngine';

import {
  createCostLayer,
} from './inventoryLayerEngine';

import {
  createTransactionSnapshot,
  createSnapshot,
  lockSnapshot,
  readSnapshot,
} from './snapshotEngine';

/* =========================================================================
   CONSTANTS
   ========================================================================= */

const ENGINE_VERSION = 'ERP_DA_V2_PURCHASE_ENGINE_1';

const DEFAULT_BRANCH_SCOPE = 'GLOBAL';
const DEFAULT_WAREHOUSE = 'MAIN';

const PURCHASE_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  ORDERED: 'ORDERED',
  RECEIVED: 'RECEIVED',
  PARTIAL_PAYMENT: 'PARTIAL_PAYMENT',
  PAID: 'PAID',
  PAYABLE: 'PAYABLE',
  BLOCKED: 'BLOCKED',
  REVERSED: 'REVERSED',
});

const PAYMENT_STATUS = Object.freeze({
  PAID: 'PAID',
  PARTIAL: 'PARTIAL',
  PAYABLE: 'PAYABLE',
});

const MOVEMENT_TYPES = Object.freeze({
  PURCHASE_IN: 'PURCHASE_IN',
  PURCHASE_REVERSAL: 'PURCHASE_REVERSAL',
});

const DOCUMENT_TYPES = Object.freeze({
  PURCHASE: 'PURCHASE',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  PURCHASE_REVERSAL: 'PURCHASE_REVERSAL',
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

const extractSupplierSource = (params = {}) => {
  if (Array.isArray(params.master_suppliers)) return params.master_suppliers;
  if (Array.isArray(params.masterSuppliers)) return params.masterSuppliers;

  if (isObject(params.dbData)) {
    if (Array.isArray(params.dbData.master_suppliers)) return params.dbData.master_suppliers;
    if (Array.isArray(params.dbData.masterSuppliers)) return params.dbData.masterSuppliers;
  }

  if (isObject(params.source)) {
    if (Array.isArray(params.source.master_suppliers)) return params.source.master_suppliers;
    if (Array.isArray(params.source.masterSuppliers)) return params.source.masterSuppliers;
  }

  return [];
};

const extractRawMaterialSource = (params = {}) => {
  if (Array.isArray(params.master_raw_materials)) return params.master_raw_materials;
  if (Array.isArray(params.masterRawMaterials)) return params.masterRawMaterials;

  if (isObject(params.dbData)) {
    if (Array.isArray(params.dbData.master_raw_materials)) return params.dbData.master_raw_materials;
    if (Array.isArray(params.dbData.masterRawMaterials)) return params.dbData.masterRawMaterials;
  }

  if (isObject(params.source)) {
    if (Array.isArray(params.source.master_raw_materials)) return params.source.master_raw_materials;
    if (Array.isArray(params.source.masterRawMaterials)) return params.source.masterRawMaterials;
  }

  return [];
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
   MASTER VALIDATION HELPERS
   ========================================================================= */

const normalizeMasterId = (value) => {
  return String(value || '').trim();
};

const isDeletedRow = (row) => {
  if (!isObject(row)) return true;

  const value = row.isDeleted ?? row.deleted;
  if (value === undefined || value === null || value === '') return false;

  const normalized = String(value).trim().toUpperCase();
  return ['TRUE', 'YES', 'YA', 'Y', '1'].includes(normalized);
};

const isInactiveRow = (row) => {
  if (!isObject(row)) return true;

  const status = row.status ?? row.status_active ?? row.is_active ?? row.active;

  if (status === undefined || status === null || status === '') return false;
  if (typeof status === 'boolean') return !status;

  const normalized = String(status).trim().toUpperCase();

  return ['FALSE', 'NO', 'TIDAK', 'N', '0', 'INACTIVE', 'NONAKTIF', 'DISABLED'].includes(normalized);
};

const findSupplier = (supplierSource = [], supplierId = '', supplierName = '') => {
  const cleanId = normalizeMasterId(supplierId);
  const cleanName = String(supplierName || '').trim().toUpperCase();

  return supplierSource.find((supplier) => {
    if (!isObject(supplier) || isDeletedRow(supplier) || isInactiveRow(supplier)) return false;

    const candidateId = normalizeMasterId(
      supplier.supplier_id ||
      supplier.id ||
      supplier.kode_supplier ||
      supplier.code,
    );

    const candidateName = String(
      supplier.supplier_name ||
      supplier.nama_supplier ||
      supplier.name ||
      '',
    ).trim().toUpperCase();

    if (cleanId && candidateId && candidateId === cleanId) return true;
    if (cleanName && candidateName && candidateName === cleanName) return true;

    return false;
  }) || null;
};

const findRawMaterial = (rawMaterialSource = [], itemId = '', itemName = '') => {
  const cleanId = normalizeMasterId(itemId);
  const cleanName = String(itemName || '').trim().toUpperCase();

  return rawMaterialSource.find((item) => {
    if (!isObject(item) || isDeletedRow(item) || isInactiveRow(item)) return false;

    const candidateId = normalizeMasterId(
      item.item_id ||
      item.raw_material_id ||
      item.material_id ||
      item.id ||
      item.sku,
    );

    const candidateName = String(
      item.item_name ||
      item.raw_material_name ||
      item.material_name ||
      item.nama_bahan ||
      item.name ||
      '',
    ).trim().toUpperCase();

    if (cleanId && candidateId && candidateId === cleanId) return true;
    if (cleanName && candidateName && candidateName === cleanName) return true;

    return false;
  }) || null;
};

/* =========================================================================
   INPUT NORMALIZATION
   ========================================================================= */

const extractPurchaseItems = (input = {}) => {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input.items)) return input.items;
  if (Array.isArray(input.purchase_items)) return input.purchase_items;
  if (Array.isArray(input.purchaseItems)) return input.purchaseItems;

  if (typeof input.items_json === 'string') {
    const parsed = parseJson(input.items_json, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  if (typeof input.itemsJson === 'string') {
    const parsed = parseJson(input.itemsJson, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  return [];
};

export const normalizePurchaseItem = (item = {}, index = 0) => {
  const qty = toNumber(item.qty ?? item.quantity ?? item.qty_in);
  const unit = normalizeUnit(item.unit || item.satuan || item.uom || item.qty_unit);
  const unitPrice = toNumber(item.unit_price ?? item.unitPrice ?? item.price ?? item.harga_satuan);
  const subtotalRaw = toNumber(item.subtotal ?? item.total ?? item.total_price ?? item.amount);

  return {
    index,

    item_id: String(
      item.item_id ||
      item.itemId ||
      item.raw_material_id ||
      item.rawMaterialId ||
      item.material_id ||
      item.product_id ||
      '',
    ).trim(),

    item_name: String(
      item.item_name ||
      item.itemName ||
      item.raw_material_name ||
      item.rawMaterialName ||
      item.material_name ||
      item.product_name ||
      item.name ||
      '',
    ).trim(),

    category: String(item.category || item.kategori || item.item_category || '').trim(),

    qty,
    unit,
    unit_price: unitPrice,

    subtotal: Number.isFinite(subtotalRaw)
      ? subtotalRaw
      : (Number.isFinite(qty) && Number.isFinite(unitPrice) ? qty * unitPrice : 0),

    expired_date: normalizeDateString(item.expired_date || item.expiredDate || item.expiry_date || ''),
    notes: String(item.notes || item.description || item.keterangan || '').trim(),

    source: { ...item },
  };
};

export const normalizePurchaseInput = (input = {}) => {
  const purchaseDate = normalizeDateString(
    input.purchase_date ||
    input.purchaseDate ||
    input.date ||
    getTodayISO(),
  );

  const branchId = normalizeBranchId(
    input.branch_id ||
    input.branchId ||
    DEFAULT_BRANCH_SCOPE,
  );

  const warehouseId = normalizeWarehouseId(
    input.warehouse_id ||
    input.warehouseId ||
    input.location_id ||
    input.locationId ||
    DEFAULT_WAREHOUSE,
  );

  const franchiseId = normalizeFranchiseId(
    input.franchise_id ||
    input.franchiseId ||
    '',
  );

  const items = extractPurchaseItems(input).map(normalizePurchaseItem);

  return {
    purchase_id: String(input.purchase_id || input.purchaseId || input.id || '').trim(),

    supplier_id: String(input.supplier_id || input.supplierId || '').trim(),
    supplier_name: String(input.supplier_name || input.supplierName || input.vendor_name || '').trim(),

    branch_id: branchId,
    warehouse_id: warehouseId,
    franchise_id: franchiseId,

    invoice_number: String(input.invoice_number || input.invoiceNumber || input.no_invoice || input.nota || '').trim(),
    purchase_date: purchaseDate,

    payment_method: normalizeCode(input.payment_method || input.paymentMethod || ''),
    payment_status: normalizeCode(input.payment_status || input.paymentStatus || ''),

    amount_paid: toNumber(input.amount_paid ?? input.amountPaid ?? input.paid_amount ?? input.dp_amount ?? 0),

    operator: String(input.operator || input.created_by || input.createdBy || input.pic || '').trim(),
    notes: String(input.notes || input.description || input.keterangan || '').trim(),

    items,
    raw: { ...input },
  };
};

/* =========================================================================
   VALIDATION
   ========================================================================= */

export const validatePurchaseInput = (input = {}, options = {}) => {
  const warnings = [];
  const normalized = normalizePurchaseInput(input);

  if (!normalized.branch_id || normalized.branch_id === DEFAULT_BRANCH_SCOPE) {
    warnings.push(makeWarning('INVALID_BRANCH', 'branch_id pembelian tidak valid atau masih GLOBAL.', {
      branch_id: normalized.branch_id,
    }));
  }

  if (!normalized.warehouse_id) {
    warnings.push(makeWarning('INVALID_WAREHOUSE', 'warehouse_id pembelian tidak valid.', {
      warehouse_id: normalized.warehouse_id,
    }));
  }

  if (!normalized.supplier_id && !normalized.supplier_name) {
    warnings.push(makeWarning('INVALID_SUPPLIER', 'supplier_id atau supplier_name wajib diisi.'));
  }

  const suppliers = extractSupplierSource({ ...options, ...input });

  if (suppliers.length > 0 && (normalized.supplier_id || normalized.supplier_name)) {
    const supplier = findSupplier(suppliers, normalized.supplier_id, normalized.supplier_name);

    if (!supplier) {
      warnings.push(makeWarning('SUPPLIER_NOT_FOUND', 'Supplier tidak ditemukan atau tidak aktif di master supplier.', {
        supplier_id: normalized.supplier_id,
        supplier_name: normalized.supplier_name,
      }));
    }
  }

  if (!normalized.purchase_date) {
    warnings.push(makeWarning('INVALID_PURCHASE_DATE', 'Tanggal pembelian tidak valid.'));
  }

  if (normalized.items.length === 0) {
    warnings.push(makeWarning('EMPTY_PURCHASE_ITEMS', 'Item pembelian kosong.'));
  }

  const rawMaterials = extractRawMaterialSource({ ...options, ...input });

  normalized.items.forEach((item) => {
    if (!item.item_id && !item.item_name) {
      warnings.push(makeWarning('INVALID_ITEM', 'Item pembelian tidak memiliki item_id atau item_name.', {
        index: item.index,
      }));
    }

    if (!Number.isFinite(item.qty) || item.qty <= 0) {
      warnings.push(makeWarning('INVALID_QTY', 'Qty item pembelian tidak valid.', {
        index: item.index,
        item_id: item.item_id,
        item_name: item.item_name,
        qty: item.qty,
      }));
    }

    if (!item.unit) {
      warnings.push(makeWarning('INVALID_UNIT', 'Satuan item pembelian tidak valid.', {
        index: item.index,
        item_id: item.item_id,
        item_name: item.item_name,
      }));
    }

    if (!Number.isFinite(item.unit_price) || item.unit_price < 0) {
      warnings.push(makeWarning('INVALID_UNIT_PRICE', 'Harga satuan item pembelian tidak valid.', {
        index: item.index,
        item_id: item.item_id,
        item_name: item.item_name,
        unit_price: item.unit_price,
      }));
    }

    if (Number.isFinite(item.unit_price) && item.unit_price === 0) {
      warnings.push(makeWarning('ZERO_UNIT_PRICE', 'Harga satuan item bernilai 0. Pastikan ini memang disengaja.', {
        index: item.index,
        item_id: item.item_id,
        item_name: item.item_name,
      }));
    }

    if (rawMaterials.length > 0 && (item.item_id || item.item_name)) {
      const rawMaterial = findRawMaterial(rawMaterials, item.item_id, item.item_name);

      if (!rawMaterial) {
        warnings.push(makeWarning('RAW_MATERIAL_NOT_FOUND', 'Item tidak ditemukan atau tidak aktif di master bahan baku.', {
          index: item.index,
          item_id: item.item_id,
          item_name: item.item_name,
        }));
      }
    }
  });

  if (Number.isFinite(normalized.amount_paid) && normalized.amount_paid < 0) {
    warnings.push(makeWarning('INVALID_AMOUNT_PAID', 'amount_paid tidak boleh negatif.', {
      amount_paid: normalized.amount_paid,
    }));
  }

  const blockingCodes = new Set([
    'INVALID_BRANCH',
    'INVALID_WAREHOUSE',
    'INVALID_SUPPLIER',
    'SUPPLIER_NOT_FOUND',
    'INVALID_PURCHASE_DATE',
    'EMPTY_PURCHASE_ITEMS',
    'INVALID_ITEM',
    'INVALID_QTY',
    'INVALID_UNIT',
    'INVALID_UNIT_PRICE',
    'RAW_MATERIAL_NOT_FOUND',
    'INVALID_AMOUNT_PAID',
  ]);

  return {
    ok: !warnings.some((warning) => blockingCodes.has(warning.code)),
    input: normalized,
    warnings,
  };
};

/* =========================================================================
   SUMMARY
   ========================================================================= */

export const calculatePurchaseSummary = (input = {}, options = {}) => {
  const normalized = normalizePurchaseInput(input);
  const warnings = [];

  const items = normalized.items.map((item) => ({
    ...item,
    subtotal: roundMoney(item.subtotal),
  }));

  const totalAmount = roundMoney(items.reduce((sum, item) => sum + safeNumber(item.subtotal, 0), 0));
  const amountPaid = roundMoney(Math.min(Math.max(safeNumber(normalized.amount_paid, 0), 0), totalAmount));
  const remainingAmount = roundMoney(Math.max(totalAmount - amountPaid, 0));

  let paymentStatus = PAYMENT_STATUS.PAYABLE;

  if (totalAmount > 0 && amountPaid >= totalAmount) {
    paymentStatus = PAYMENT_STATUS.PAID;
  } else if (amountPaid > 0 && remainingAmount > 0) {
    paymentStatus = PAYMENT_STATUS.PARTIAL;
  }

  if (safeNumber(normalized.amount_paid, 0) > totalAmount) {
    warnings.push(makeWarning('AMOUNT_PAID_EXCEEDS_TOTAL', 'amount_paid lebih besar dari total pembelian. Nilai dibatasi sebesar total pembelian.', {
      amount_paid: normalized.amount_paid,
      total_amount: totalAmount,
    }));
  }

  return {
    ok: true,
    purchase_id: normalized.purchase_id,
    total_amount: totalAmount,
    amount_paid: amountPaid,
    remaining_amount: remainingAmount,
    payment_status: paymentStatus,
    item_count: items.length,
    items,
    warnings,
  };
};

/* =========================================================================
   INVENTORY LAYER FROM PURCHASE
   ========================================================================= */

export const createInventoryLayerFromPurchase = (purchaseHeader = {}, item = {}, options = {}) => {
  const warnings = [];

  const purchaseId = String(
    purchaseHeader.purchase_id ||
    purchaseHeader.id ||
    options.purchaseId ||
    options.purchase_id ||
    generateId('PUR'),
  ).trim();

  const branchId = normalizeBranchId(
    purchaseHeader.branch_id ||
    purchaseHeader.branchId ||
    options.branchId ||
    options.branch_id ||
    DEFAULT_BRANCH_SCOPE,
  );

  const warehouseId = normalizeWarehouseId(
    purchaseHeader.warehouse_id ||
    purchaseHeader.warehouseId ||
    options.warehouseId ||
    options.warehouse_id ||
    DEFAULT_WAREHOUSE,
  );

  const franchiseId = normalizeFranchiseId(
    purchaseHeader.franchise_id ||
    purchaseHeader.franchiseId ||
    options.franchiseId ||
    options.franchise_id ||
    '',
  );

  const purchaseDate = normalizeDateString(
    purchaseHeader.purchase_date ||
    purchaseHeader.purchaseDate ||
    purchaseHeader.date ||
    options.purchaseDate ||
    options.purchase_date ||
    getTodayISO(),
  );

  const layerResult = createCostLayer({
    layer_id: item.layer_id || item.layerId || generateId('RM-LAYER'),

    item_id: item.item_id,
    item_name: item.item_name,
    category: item.category || 'RAW_MATERIAL',

    branch_id: branchId,
    warehouse_id: warehouseId,
    franchise_id: franchiseId,

    qty_original: item.qty,
    qty_remaining: item.qty,
    unit: item.unit,
    unit_cost: item.unit_price,

    source_document: DOCUMENT_TYPES.PURCHASE,
    source_document_id: purchaseId,

    received_date: purchaseDate,
    expired_date: item.expired_date || '',

    status: 'ACTIVE',
    movement_type: MOVEMENT_TYPES.PURCHASE_IN,

    created_by: purchaseHeader.created_by || purchaseHeader.operator || options.createdBy || options.created_by || '',
    created_at: new Date().toISOString(),
    notes: item.notes || purchaseHeader.notes || '',
  }, {
    branchId,
    warehouseId,
    franchiseId,
    createdBy: purchaseHeader.created_by || purchaseHeader.operator || options.createdBy || options.created_by || '',
  });

  warnings.push(...layerResult.warnings);

  return {
    ok: layerResult.ok,
    inventory_layer: layerResult.layer,
    warnings,
  };
};

/* =========================================================================
   LEDGER & CASHFLOW ENTRIES
   ========================================================================= */

const createSupplierLedgerEntry = (purchaseHeader = {}, summary = {}, options = {}) => {
  const totalAmount = roundMoney(summary.total_amount || 0);
  const amountPaid = roundMoney(summary.amount_paid || 0);
  const remainingAmount = roundMoney(summary.remaining_amount || 0);

  return {
    id: options.ledgerId || options.ledger_id || generateId('SUP-LEDGER'),
    ledger_id: options.ledgerId || options.ledger_id || generateId('SUP-LEDGER'),

    date: purchaseHeader.purchase_date,
    branch_id: purchaseHeader.branch_id,
    warehouse_id: purchaseHeader.warehouse_id,
    franchise_id: purchaseHeader.franchise_id || '',

    supplier_id: purchaseHeader.supplier_id,
    supplier_name: purchaseHeader.supplier_name,

    type: 'PURCHASE',
    reference_table: 'purchases',
    reference_id: purchaseHeader.purchase_id,
    invoice_number: purchaseHeader.invoice_number,

    debit: totalAmount,
    credit: amountPaid,
    amount_payable: remainingAmount,

    total_amount: totalAmount,
    amount_paid: amountPaid,
    remaining_amount: remainingAmount,

    payment_status: summary.payment_status,

    description: `Pembelian ${purchaseHeader.invoice_number || purchaseHeader.purchase_id}`,
    created_at: new Date().toISOString(),
    created_by: purchaseHeader.created_by || '',
    isDeleted: false,
  };
};

const createCashflowEntry = (purchaseHeader = {}, summary = {}, options = {}) => {
  if (safeNumber(summary.amount_paid, 0) <= 0) return null;

  return {
    id: options.cashflowId || options.cashflow_id || generateId('CASH-OUT'),

    date: purchaseHeader.purchase_date,
    branch_id: purchaseHeader.branch_id,

    type: 'OUT',
    category: 'PURCHASE',
    method: purchaseHeader.payment_method || '',

    amount: roundMoney(summary.amount_paid),

    description: `Pembayaran pembelian ${purchaseHeader.invoice_number || purchaseHeader.purchase_id}`,
    reference_table: 'purchases',
    reference_id: purchaseHeader.purchase_id,

    created_at: new Date().toISOString(),
    created_by: purchaseHeader.created_by || '',
    isDeleted: false,
  };
};

/* =========================================================================
   PURCHASE ORDER
   ========================================================================= */

export const createPurchaseOrder = (input = {}, options = {}) => {
  const warnings = [];

  const validation = validatePurchaseInput(input, options);
  warnings.push(...validation.warnings);

  const normalized = validation.input || normalizePurchaseInput(input);
  const summary = calculatePurchaseSummary(normalized);
  warnings.push(...summary.warnings);

  const purchaseId = normalized.purchase_id || generateId('PUR');

  const purchaseHeader = {
    id: purchaseId,
    purchase_id: purchaseId,

    date: normalized.purchase_date,
    purchase_date: normalized.purchase_date,

    branch_id: normalized.branch_id,
    warehouse_id: normalized.warehouse_id,
    franchise_id: normalized.franchise_id,

    supplier_id: normalized.supplier_id,
    supplier_name: normalized.supplier_name,

    invoice_number: normalized.invoice_number,

    payment_method: normalized.payment_method,
    payment_status: summary.payment_status,

    total_amount: summary.total_amount,
    amount_paid: summary.amount_paid,
    remaining_amount: summary.remaining_amount,

    status: validation.ok ? PURCHASE_STATUS.ORDERED : PURCHASE_STATUS.BLOCKED,

    operator: normalized.operator,
    notes: normalized.notes,

    created_at: new Date().toISOString(),
    created_by: normalized.operator,
    isDeleted: false,
  };

  const purchaseItems = summary.items.map((item) => ({
    id: generateId('PUR-ITEM'),
    purchase_id: purchaseId,

    item_id: item.item_id,
    item_name: item.item_name,
    category: item.category,

    qty: item.qty,
    unit: item.unit,
    unit_price: roundMoney(item.unit_price),
    subtotal: roundMoney(item.subtotal),

    expired_date: item.expired_date || '',
    notes: item.notes || '',

    source_index: item.index,
  }));

  const purchaseSnapshotResult = createPurchaseSnapshot({
    purchase_header: purchaseHeader,
    purchase_items: purchaseItems,
    inventory_layers: [],
    supplier_ledger_entry: null,
    cashflow_entry: null,
    warnings,
  }, {
    lock: true,
  });

  warnings.push(...purchaseSnapshotResult.warnings);

  const packageResult = {
    package_type: 'PURCHASE_ORDER_PACKAGE',
    package_version: ENGINE_VERSION,
    generated_at: new Date().toISOString(),

    purchase_header: {
      ...purchaseHeader,
      purchase_snapshot_json: purchaseSnapshotResult.snapshot
        ? JSON.stringify(purchaseSnapshotResult.snapshot)
        : '',
    },

    purchase_items: purchaseItems,
    inventory_layers: [],
    supplier_ledger_entry: null,
    cashflow_entry: null,
    purchase_snapshot: purchaseSnapshotResult.snapshot || null,

    status: validation.ok && purchaseSnapshotResult.ok
      ? PURCHASE_STATUS.ORDERED
      : PURCHASE_STATUS.BLOCKED,

    warnings,
  };

  return {
    ok: validation.ok && purchaseSnapshotResult.ok,
    purchase_transaction_package: packageResult,
    warnings,
  };
};

/* =========================================================================
   PURCHASE RECEIVING
   ========================================================================= */

export const receivePurchase = (input = {}, options = {}) => {
  const warnings = [];

  const validation = validatePurchaseInput(input, options);
  warnings.push(...validation.warnings);

  const normalized = validation.input || normalizePurchaseInput(input);
  const summary = calculatePurchaseSummary(normalized);
  warnings.push(...summary.warnings);

  const purchaseId = normalized.purchase_id || input.purchase_id || input.purchaseId || generateId('PUR');

  const purchaseHeader = {
    id: purchaseId,
    purchase_id: purchaseId,

    date: normalized.purchase_date,
    purchase_date: normalized.purchase_date,

    branch_id: normalized.branch_id,
    warehouse_id: normalized.warehouse_id,
    franchise_id: normalized.franchise_id,

    supplier_id: normalized.supplier_id,
    supplier_name: normalized.supplier_name,

    invoice_number: normalized.invoice_number,

    payment_method: normalized.payment_method,
    payment_status: summary.payment_status,

    total_amount: summary.total_amount,
    amount_paid: summary.amount_paid,
    remaining_amount: summary.remaining_amount,

    status: validation.ok ? PURCHASE_STATUS.RECEIVED : PURCHASE_STATUS.BLOCKED,

    operator: normalized.operator,
    notes: normalized.notes,

    created_at: new Date().toISOString(),
    created_by: normalized.operator,
    isDeleted: false,
  };

  const purchaseItems = summary.items.map((item) => ({
    id: generateId('PUR-ITEM'),
    purchase_id: purchaseId,

    item_id: item.item_id,
    item_name: item.item_name,
    category: item.category,

    qty: item.qty,
    unit: item.unit,
    unit_price: roundMoney(item.unit_price),
    subtotal: roundMoney(item.subtotal),

    expired_date: item.expired_date || '',
    notes: item.notes || '',

    source_index: item.index,
  }));

  const inventoryLayers = [];

  purchaseItems.forEach((item) => {
    const layerResult = createInventoryLayerFromPurchase(purchaseHeader, item, options);

    warnings.push(...layerResult.warnings);

    if (layerResult.ok && layerResult.inventory_layer) {
      inventoryLayers.push(layerResult.inventory_layer);
    }
  });

  const supplierLedgerEntry = createSupplierLedgerEntry(purchaseHeader, summary, options);
  const cashflowEntry = createCashflowEntry(purchaseHeader, summary, options);

  const purchaseSnapshotResult = createPurchaseSnapshot({
    purchase_header: purchaseHeader,
    purchase_items: purchaseItems,
    inventory_layers: inventoryLayers,
    supplier_ledger_entry: supplierLedgerEntry,
    cashflow_entry: cashflowEntry,
    warnings,
    rulesSource: extractRulesSource({ ...options, ...input }),
  }, {
    lock: true,
  });

  warnings.push(...purchaseSnapshotResult.warnings);

  const packageResult = {
    package_type: 'PURCHASE_TRANSACTION_PACKAGE',
    package_version: ENGINE_VERSION,
    generated_at: new Date().toISOString(),

    purchase_header: {
      ...purchaseHeader,
      purchase_snapshot_json: purchaseSnapshotResult.snapshot
        ? JSON.stringify(purchaseSnapshotResult.snapshot)
        : '',
    },

    purchase_items: purchaseItems,
    inventory_layers: inventoryLayers,
    supplier_ledger_entry: supplierLedgerEntry,
    cashflow_entry: cashflowEntry,
    purchase_snapshot: purchaseSnapshotResult.snapshot || null,

    status: validation.ok && inventoryLayers.length === purchaseItems.length && purchaseSnapshotResult.ok
      ? PURCHASE_STATUS.RECEIVED
      : PURCHASE_STATUS.BLOCKED,

    warnings,
  };

  return {
    ok: validation.ok && inventoryLayers.length === purchaseItems.length && purchaseSnapshotResult.ok,
    purchase_transaction_package: packageResult,
    warnings,
  };
};

/* =========================================================================
   PURCHASE SNAPSHOT
   ========================================================================= */

export const createPurchaseSnapshot = (input = {}, options = {}) => {
  const purchaseHeader = input.purchase_header || input.purchaseHeader || {};
  const purchaseId = purchaseHeader.purchase_id || purchaseHeader.id || input.purchase_id || input.purchaseId || '';

  const payload = {
    purchase_header: purchaseHeader,
    purchase_items: safeArray(input.purchase_items || input.purchaseItems),
    inventory_layers: safeArray(input.inventory_layers || input.inventoryLayers),
    supplier_ledger_entry: input.supplier_ledger_entry || input.supplierLedgerEntry || null,
    cashflow_entry: input.cashflow_entry || input.cashflowEntry || null,
    conversion_snapshot: createConversionSnapshot(input.rulesSource || input.rules_source || input.dbData || input.source || [], {
      branchId: purchaseHeader.branch_id || input.branch_id || input.branchId || DEFAULT_BRANCH_SCOPE,
    }),
  };

  const snapshotResult = createTransactionSnapshot({
    snapshot_type: 'PURCHASE',
    transaction_id: purchaseId,
    transaction_type: 'PURCHASE',

    branch_id: purchaseHeader.branch_id || input.branch_id || input.branchId || DEFAULT_BRANCH_SCOPE,
    created_by: purchaseHeader.created_by || purchaseHeader.operator || input.created_by || input.createdBy || 'SYSTEM',

    transaction_header: purchaseHeader,
    transaction_items: safeArray(input.purchase_items || input.purchaseItems),

    purchase_snapshot: payload,

    warnings: input.warnings || [],

    engine_versions: {
      purchaseEngine: ENGINE_VERSION,
    },

    meta: {
      source_module: 'purchaseEngine',
      source_table: 'purchases',
      source_id: purchaseId,
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
   REVERSE PURCHASE
   ========================================================================= */

const extractPurchaseSnapshotPayload = (input = {}) => {
  const directSnapshot =
    input.purchase_snapshot ||
    input.purchaseSnapshot ||
    parseJson(input.purchase_snapshot_json, null) ||
    parseJson(input.purchaseSnapshotJson, null);

  if (!directSnapshot) return null;

  const readResult = readSnapshot(directSnapshot, {
    allowInvalid: true,
    freeze: false,
  });

  if (!readResult.ok || !readResult.snapshot) return null;

  return readResult.snapshot.payload?.purchase_snapshot ||
    readResult.snapshot.payload?.additional_payload?.purchase_snapshot ||
    readResult.snapshot.payload ||
    null;
};

const createInventoryLayerReversals = (inventoryLayers = [], reversalHeader = {}) => {
  return safeArray(inventoryLayers).map((layer) => {
    const qtyOriginal = safeNumber(layer.qty_original ?? layer.qty_in ?? layer.qty ?? 0);
    const qtyRemaining = safeNumber(layer.qty_remaining ?? qtyOriginal, qtyOriginal);
    const qtyToReverse = qtyRemaining;

    return {
      id: generateId('PUR-REV-LAYER'),
      reversal_layer_id: generateId('PUR-REV-LAYER'),

      original_layer_id: layer.layer_id || layer.id || '',

      item_id: layer.item_id || '',
      item_name: layer.item_name || '',

      branch_id: layer.branch_id || reversalHeader.branch_id,
      warehouse_id: layer.warehouse_id || reversalHeader.warehouse_id,
      franchise_id: layer.franchise_id || reversalHeader.franchise_id || '',

      qty_out: qtyToReverse,
      qty_original_at_purchase: qtyOriginal,
      qty_remaining_at_void: qtyRemaining,
      unit: layer.unit || '',

      unit_cost: safeNumber(layer.unit_cost, 0),
      total_cost: roundMoney(qtyToReverse * safeNumber(layer.unit_cost, 0)),

      source_document: DOCUMENT_TYPES.PURCHASE_REVERSAL,
      source_document_id: reversalHeader.reversal_id,
      original_source_document_id: layer.source_document_id || '',

      movement_type: MOVEMENT_TYPES.PURCHASE_REVERSAL,
      status: 'REVERSAL',

      received_date: reversalHeader.reversal_date,
      expired_date: layer.expired_date || '',

      notes: `Reversal pembelian ${reversalHeader.original_purchase_id}`,
    };
  });
};

export const reversePurchase = (input = {}, options = {}) => {
  const warnings = [];

  const packageInput = input.purchase_transaction_package || input.purchaseTransactionPackage || input;
  const purchaseHeader = packageInput.purchase_header || input.purchase_header || input.purchaseHeader || {};

  const snapshotPayload = extractPurchaseSnapshotPayload(purchaseHeader) ||
    extractPurchaseSnapshotPayload(packageInput) ||
    null;

  const originalPurchaseHeader = snapshotPayload?.purchase_header ||
    snapshotPayload?.transaction_header ||
    purchaseHeader;

  const originalPurchaseItems = snapshotPayload?.purchase_items ||
    snapshotPayload?.transaction_items ||
    packageInput.purchase_items ||
    [];

  const originalInventoryLayers = snapshotPayload?.inventory_layers ||
    packageInput.inventory_layers ||
    [];

  const originalSupplierLedger = snapshotPayload?.supplier_ledger_entry ||
    packageInput.supplier_ledger_entry ||
    null;

  const originalCashflow = snapshotPayload?.cashflow_entry ||
    packageInput.cashflow_entry ||
    null;

  const originalPurchaseId = originalPurchaseHeader.purchase_id ||
    originalPurchaseHeader.id ||
    input.purchase_id ||
    input.purchaseId ||
    '';

  if (!originalPurchaseId) {
    warnings.push(makeWarning('MISSING_ORIGINAL_PURCHASE_ID', 'ID pembelian original tidak ditemukan untuk reversal.'));
  }

  const reversalId = input.reversal_id || input.reversalId || generateId('PUR-REV');
  const reversalDate = normalizeDateString(input.reversal_date || input.reversalDate || input.date || getTodayISO());

  const reversalHeader = {
    id: reversalId,
    reversal_id: reversalId,

    original_purchase_id: originalPurchaseId,
    reversal_date: reversalDate,
    date: reversalDate,

    branch_id: normalizeBranchId(originalPurchaseHeader.branch_id || input.branch_id || input.branchId || DEFAULT_BRANCH_SCOPE),
    warehouse_id: normalizeWarehouseId(originalPurchaseHeader.warehouse_id || input.warehouse_id || input.warehouseId || DEFAULT_WAREHOUSE),
    franchise_id: normalizeFranchiseId(originalPurchaseHeader.franchise_id || input.franchise_id || input.franchiseId || ''),

    supplier_id: originalPurchaseHeader.supplier_id || '',
    supplier_name: originalPurchaseHeader.supplier_name || '',

    invoice_number: originalPurchaseHeader.invoice_number || '',

    reason: String(input.reason || input.notes || 'PURCHASE_REVERSAL').trim(),
    operator: String(input.operator || input.created_by || input.createdBy || 'SYSTEM').trim(),

    status: PURCHASE_STATUS.REVERSED,
    movement_type: MOVEMENT_TYPES.PURCHASE_REVERSAL,

    created_at: new Date().toISOString(),
    created_by: String(input.operator || input.created_by || input.createdBy || 'SYSTEM').trim(),
    isDeleted: false,
  };

  const inventoryLayerReversals = createInventoryLayerReversals(
    originalInventoryLayers,
    reversalHeader,
  );

  originalInventoryLayers.forEach((layer) => {
    const qtyOriginal = safeNumber(layer.qty_original ?? layer.qty_in ?? layer.qty ?? 0);
    const qtyRemaining = safeNumber(layer.qty_remaining ?? qtyOriginal, qtyOriginal);

    if (qtyRemaining < qtyOriginal) {
      warnings.push(makeWarning('PURCHASE_LAYER_ALREADY_CONSUMED', 'Sebagian stok pembelian sudah dipakai. Reversal penuh membutuhkan reversal transaksi turunan terlebih dahulu.', {
        original_purchase_id: originalPurchaseId,
        layer_id: layer.layer_id || layer.id || '',
        qty_original: qtyOriginal,
        qty_remaining: qtyRemaining,
      }));
    }
  });

  if (inventoryLayerReversals.length === 0) {
    warnings.push(makeWarning('EMPTY_INVENTORY_REVERSAL', 'Tidak ada inventory layer yang bisa dibuat reversal.', {
      original_purchase_id: originalPurchaseId,
    }));
  }

  const supplierLedgerReversal = originalSupplierLedger
    ? {
        id: generateId('SUP-LEDGER-REV'),
        ledger_id: generateId('SUP-LEDGER-REV'),

        date: reversalDate,
        branch_id: reversalHeader.branch_id,
        warehouse_id: reversalHeader.warehouse_id,
        franchise_id: reversalHeader.franchise_id,

        supplier_id: reversalHeader.supplier_id,
        supplier_name: reversalHeader.supplier_name,

        type: 'PURCHASE_REVERSAL',
        reference_table: 'purchases',
        reference_id: originalPurchaseId,
        reversal_id: reversalId,

        debit: roundMoney(safeNumber(originalSupplierLedger.debit, 0) * -1),
        credit: roundMoney(safeNumber(originalSupplierLedger.credit, 0) * -1),
        amount_payable: roundMoney(safeNumber(originalSupplierLedger.amount_payable, 0) * -1),

        total_amount: roundMoney(safeNumber(originalSupplierLedger.total_amount, 0) * -1),
        amount_paid: roundMoney(safeNumber(originalSupplierLedger.amount_paid, 0) * -1),
        remaining_amount: roundMoney(safeNumber(originalSupplierLedger.remaining_amount, 0) * -1),

        description: `Reversal hutang supplier pembelian ${originalPurchaseId}`,
        created_at: new Date().toISOString(),
        created_by: reversalHeader.created_by,
        isDeleted: false,
      }
    : null;

  const cashflowReversal = originalCashflow
    ? {
        id: generateId('CASH-REV'),

        date: reversalDate,
        branch_id: reversalHeader.branch_id,

        type: 'REVERSAL',
        category: 'PURCHASE_REVERSAL',
        method: originalCashflow.method || '',

        amount: roundMoney(safeNumber(originalCashflow.amount, 0) * -1),

        description: `Reversal cashflow pembelian ${originalPurchaseId}`,
        reference_table: 'purchases',
        reference_id: originalPurchaseId,
        reversal_id: reversalId,

        created_at: new Date().toISOString(),
        created_by: reversalHeader.created_by,
        isDeleted: false,
      }
    : null;

  const reversalSnapshotResult = createSnapshot({
    snapshot_type: 'PURCHASE',
    transaction_id: reversalId,
    transaction_type: 'PURCHASE_REVERSAL',
    branch_id: reversalHeader.branch_id,
    created_by: reversalHeader.created_by,

    engine_versions: {
      purchaseEngine: ENGINE_VERSION,
    },

    payload: {
      reversal_header: reversalHeader,
      original_purchase_header: originalPurchaseHeader,
      original_purchase_items: originalPurchaseItems,
      inventory_layer_reversals: inventoryLayerReversals,
      supplier_ledger_reversal: supplierLedgerReversal,
      cashflow_reversal: cashflowReversal,
      original_purchase_snapshot_payload: snapshotPayload,
    },

    warnings,

    meta: {
      source_module: 'purchaseEngine',
      source_table: 'purchases',
      source_id: originalPurchaseId,
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
    package_type: 'PURCHASE_REVERSAL_PACKAGE',
    package_version: ENGINE_VERSION,
    generated_at: new Date().toISOString(),

    reversal_header: reversalHeader,
    original_purchase_header: originalPurchaseHeader,
    original_purchase_items: originalPurchaseItems,

    inventory_layer_reversals: inventoryLayerReversals,
    supplier_ledger_reversal: supplierLedgerReversal,
    cashflow_reversal: cashflowReversal,

    reversal_snapshot: lockedSnapshot.snapshot || reversalSnapshotResult.snapshot,

    status: warnings.some((warning) => warning.code === 'MISSING_ORIGINAL_PURCHASE_ID')
      ? PURCHASE_STATUS.BLOCKED
      : PURCHASE_STATUS.REVERSED,

    warnings,
  };

  return {
    ok: reversalPackage.status === PURCHASE_STATUS.REVERSED,
    purchase_reversal_package: reversalPackage,
    warnings,
  };
};

/* =========================================================================
   DEFAULT EXPORT
   ========================================================================= */

export default {
  validatePurchaseInput,
  createPurchaseOrder,
  receivePurchase,
  createInventoryLayerFromPurchase,
  createPurchaseSnapshot,
  calculatePurchaseSummary,
  reversePurchase,
};
