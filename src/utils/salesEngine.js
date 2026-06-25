/**
 * ERP DIMSUM ADITYA V2
 * Business Engine: salesEngine.js
 *
 * Purpose:
 * - Business Engine resmi untuk seluruh transaksi penjualan ERP.
 * - Penjualan adalah sumber omzet, piutang, cashflow masuk,
 *   gross profit, margin, dan analytics.
 *
 * Dependencies:
 * - inventoryLayerEngine.js
 * - hppEngine.js
 * - snapshotEngine.js
 * - conversionEngine.js
 *
 * Important Principles:
 * - Engine ini TIDAK menyimpan data.
 * - Engine ini TIDAK update sheet.
 * - Engine ini TIDAK update database.
 * - Engine ini hanya memvalidasi, menghitung, dan membuat transaction package.
 * - HPP wajib membaca hppEngine.js.
 * - Engine ini tidak menghitung HPP sendiri.
 * - Historical integrity dijaga melalui HPP Snapshot dan Sales Snapshot.
 */

import {
  normalizeBranchId,
  normalizeUnit,
  createConversionSnapshot,
} from './conversionEngine';

import {
  calculateConsumptionCost,
} from './inventoryLayerEngine';

import {
  calculateOrderHpp,
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

const ENGINE_VERSION = 'ERP_DA_V2_SALES_ENGINE_1';

const DEFAULT_BRANCH_SCOPE = 'GLOBAL';
const DEFAULT_WAREHOUSE = 'MAIN';

export const SALES_CHANNELS = Object.freeze({
  OFFLINE_RESTO: 'OFFLINE_RESTO',
  GOFOOD: 'GOFOOD',
  GRABFOOD: 'GRABFOOD',
  SHOPEEFOOD: 'SHOPEEFOOD',
  TIKTOKSHOP: 'TIKTOKSHOP',
  RESELLER: 'RESELLER',
  DISTRIBUTOR: 'DISTRIBUTOR',
  FRANCHISE: 'FRANCHISE',
});

const SALES_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  CREATED: 'CREATED',
  PAID: 'PAID',
  PARTIAL_PAYMENT: 'PARTIAL_PAYMENT',
  RECEIVABLE: 'RECEIVABLE',
  BLOCKED: 'BLOCKED',
  REVERSED: 'REVERSED',
});

const PAYMENT_STATUS = Object.freeze({
  PAID: 'PAID',
  PARTIAL: 'PARTIAL',
  RECEIVABLE: 'RECEIVABLE',
});

const MOVEMENT_TYPES = Object.freeze({
  SALES_OUT: 'SALES_OUT',
  SALES_REVERSAL: 'SALES_REVERSAL',
});

const DOCUMENT_TYPES = Object.freeze({
  ORDER: 'ORDER',
  SALES: 'SALES',
  SALES_REVERSAL: 'SALES_REVERSAL',
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

const extractCustomerSource = (params = {}) => {
  if (Array.isArray(params.master_customers)) return params.master_customers;
  if (Array.isArray(params.masterCustomers)) return params.masterCustomers;

  if (isObject(params.dbData)) {
    if (Array.isArray(params.dbData.master_customers)) return params.dbData.master_customers;
    if (Array.isArray(params.dbData.masterCustomers)) return params.dbData.masterCustomers;
  }

  if (isObject(params.source)) {
    if (Array.isArray(params.source.master_customers)) return params.source.master_customers;
    if (Array.isArray(params.source.masterCustomers)) return params.source.masterCustomers;
  }

  return [];
};

/* =========================================================================
   MASTER VALIDATION HELPERS
   ========================================================================= */

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

const normalizeMasterId = (value) => {
  return String(value || '').trim();
};

const findCustomer = (customerSource = [], customerId = '', customerName = '', branchId = '') => {
  const cleanId = normalizeMasterId(customerId);
  const cleanName = String(customerName || '').trim().toUpperCase();
  const cleanBranch = normalizeBranchId(branchId || '');

  return customerSource.find((customer) => {
    if (!isObject(customer) || isDeletedRow(customer) || isInactiveRow(customer)) return false;

    const candidateId = normalizeMasterId(
      customer.customer_id ||
      customer.id ||
      customer.kode_customer ||
      customer.code,
    );

    const candidateName = String(
      customer.customer_name ||
      customer.nama_customer ||
      customer.name ||
      '',
    ).trim().toUpperCase();

    const candidateBranch = normalizeBranchId(
      customer.branch_id ||
      customer.branchId ||
      customer.scope_branch_id ||
      '',
    );

    const isGlobalCustomer = !candidateBranch || candidateBranch === DEFAULT_BRANCH_SCOPE || candidateBranch === 'ALL';

    const identityMatch =
      (cleanId && candidateId && candidateId === cleanId) ||
      (cleanName && candidateName && candidateName === cleanName);

    if (!identityMatch) return false;

    if (!cleanBranch || cleanBranch === DEFAULT_BRANCH_SCOPE) return true;
    if (isGlobalCustomer) return true;

    return candidateBranch === cleanBranch;
  }) || null;
};

/* =========================================================================
   INPUT NORMALIZATION
   ========================================================================= */

const extractOrderItems = (input = {}) => {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input.items)) return input.items;
  if (Array.isArray(input.order_items)) return input.order_items;
  if (Array.isArray(input.orderItems)) return input.orderItems;

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

const normalizeSalesChannel = (value) => {
  const normalized = normalizeCode(value || '');
  return normalized;
};

export const normalizeOrderItem = (item = {}, index = 0) => {
  const qty = toNumber(item.qty ?? item.quantity ?? item.qty_out);
  const unit = normalizeUnit(item.unit || item.satuan || item.uom || item.qty_unit);
  const sellingPrice = toNumber(item.selling_price ?? item.sellingPrice ?? item.price ?? item.unit_price);
  const subtotalRaw = toNumber(item.subtotal ?? item.total ?? item.total_price ?? item.amount);

  return {
    index,

    item_id: String(
      item.item_id ||
      item.itemId ||
      item.product_id ||
      item.productId ||
      item.sku ||
      '',
    ).trim(),

    item_name: String(
      item.item_name ||
      item.itemName ||
      item.product_name ||
      item.productName ||
      item.name ||
      '',
    ).trim(),

    category: String(item.category || item.kategori || item.item_category || '').trim(),

    qty,
    unit,
    selling_price: sellingPrice,

    subtotal: Number.isFinite(subtotalRaw)
      ? subtotalRaw
      : (Number.isFinite(qty) && Number.isFinite(sellingPrice) ? qty * sellingPrice : 0),

    notes: String(item.notes || item.description || item.keterangan || '').trim(),

    source: { ...item },
  };
};

export const normalizeOrderInput = (input = {}) => {
  const orderDate = normalizeDateString(
    input.order_date ||
    input.orderDate ||
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

  const items = extractOrderItems(input).map(normalizeOrderItem);

  return {
    order_id: String(input.order_id || input.orderId || input.id || '').trim(),

    customer_id: String(input.customer_id || input.customerId || '').trim(),
    customer_name: String(input.customer_name || input.customerName || input.nama_customer || '').trim(),

    branch_id: branchId,
    warehouse_id: warehouseId,
    franchise_id: franchiseId,

    invoice_number: String(input.invoice_number || input.invoiceNumber || input.no_invoice || input.invoice_no || '').trim(),
    order_date: orderDate,

    sales_channel: normalizeSalesChannel(input.sales_channel || input.salesChannel || ''),
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

export const validateOrderInput = (input = {}, options = {}) => {
  const warnings = [];
  const normalized = normalizeOrderInput(input);

  if (!normalized.branch_id || normalized.branch_id === DEFAULT_BRANCH_SCOPE) {
    warnings.push(makeWarning('INVALID_BRANCH', 'branch_id order tidak valid atau masih GLOBAL.', {
      branch_id: normalized.branch_id,
    }));
  }

  if (!normalized.warehouse_id) {
    warnings.push(makeWarning('INVALID_WAREHOUSE', 'warehouse_id order tidak valid.', {
      warehouse_id: normalized.warehouse_id,
    }));
  }

  if (!normalized.customer_id && !normalized.customer_name) {
    warnings.push(makeWarning('INVALID_CUSTOMER', 'customer_id atau customer_name wajib diisi.'));
  }

  const customers = extractCustomerSource({ ...options, ...input });

  if (customers.length > 0 && (normalized.customer_id || normalized.customer_name)) {
    const customer = findCustomer(
      customers,
      normalized.customer_id,
      normalized.customer_name,
      normalized.branch_id,
    );

    if (!customer) {
      warnings.push(makeWarning('CUSTOMER_NOT_FOUND', 'Customer tidak ditemukan, tidak aktif, atau tidak sesuai branch.', {
        customer_id: normalized.customer_id,
        customer_name: normalized.customer_name,
        branch_id: normalized.branch_id,
      }));
    }
  }

  if (!normalized.order_date) {
    warnings.push(makeWarning('INVALID_ORDER_DATE', 'Tanggal order tidak valid.'));
  }

  if (!normalized.sales_channel) {
    warnings.push(makeWarning('INVALID_SALES_CHANNEL', 'sales_channel wajib diisi.'));
  } else if (!Object.values(SALES_CHANNELS).includes(normalized.sales_channel)) {
    warnings.push(makeWarning('UNSUPPORTED_SALES_CHANNEL', 'sales_channel tidak termasuk daftar resmi ERP.', {
      sales_channel: normalized.sales_channel,
      supported_channels: Object.values(SALES_CHANNELS),
    }));
  }

  if (normalized.items.length === 0) {
    warnings.push(makeWarning('EMPTY_ORDER_ITEMS', 'Item order kosong.'));
  }

  normalized.items.forEach((item) => {
    if (!item.item_id && !item.item_name) {
      warnings.push(makeWarning('INVALID_ITEM', 'Item order tidak memiliki item_id atau item_name.', {
        index: item.index,
      }));
    }

    if (!Number.isFinite(item.qty) || item.qty <= 0) {
      warnings.push(makeWarning('INVALID_QTY', 'Qty item order tidak valid.', {
        index: item.index,
        item_id: item.item_id,
        item_name: item.item_name,
        qty: item.qty,
      }));
    }

    if (!item.unit) {
      warnings.push(makeWarning('INVALID_UNIT', 'Satuan item order tidak valid.', {
        index: item.index,
        item_id: item.item_id,
        item_name: item.item_name,
      }));
    }

    if (!Number.isFinite(item.selling_price) || item.selling_price < 0) {
      warnings.push(makeWarning('INVALID_SELLING_PRICE', 'Harga jual item order tidak valid.', {
        index: item.index,
        item_id: item.item_id,
        item_name: item.item_name,
        selling_price: item.selling_price,
      }));
    }

    if (Number.isFinite(item.selling_price) && item.selling_price === 0) {
      warnings.push(makeWarning('ZERO_SELLING_PRICE', 'Harga jual item bernilai 0. Pastikan ini memang disengaja.', {
        index: item.index,
        item_id: item.item_id,
        item_name: item.item_name,
      }));
    }
  });

  if (Number.isFinite(normalized.amount_paid) && normalized.amount_paid < 0) {
    warnings.push(makeWarning('INVALID_AMOUNT_PAID', 'amount_paid tidak boleh negatif.', {
      amount_paid: normalized.amount_paid,
    }));
  }

  const inventoryReservation = reserveInventory(input, options);

  if (!inventoryReservation.ok) {
    warnings.push(...inventoryReservation.warnings);
  }

  const blockingCodes = new Set([
    'INVALID_BRANCH',
    'INVALID_WAREHOUSE',
    'INVALID_CUSTOMER',
    'CUSTOMER_NOT_FOUND',
    'INVALID_ORDER_DATE',
    'INVALID_SALES_CHANNEL',
    'UNSUPPORTED_SALES_CHANNEL',
    'EMPTY_ORDER_ITEMS',
    'INVALID_ITEM',
    'INVALID_QTY',
    'INVALID_UNIT',
    'INVALID_SELLING_PRICE',
    'INVALID_AMOUNT_PAID',
    'INSUFFICIENT_STOCK',
    'LAYER_EMPTY',
    'ITEM_NOT_FOUND',
    'BRANCH_MISMATCH',
    'WAREHOUSE_MISMATCH',
    'FRANCHISE_MISMATCH',
    'UNIT_MISMATCH',
  ]);

  return {
    ok: !warnings.some((warning) => blockingCodes.has(warning.code)),
    input: normalized,
    warnings,
  };
};

/* =========================================================================
   ORDER SUMMARY
   ========================================================================= */

export const calculateOrderSummary = (input = {}, options = {}) => {
  const normalized = normalizeOrderInput(input);
  const warnings = [];

  const items = normalized.items.map((item) => ({
    ...item,
    subtotal: roundMoney(item.subtotal),
  }));

  const totalRevenue = roundMoney(items.reduce((sum, item) => sum + safeNumber(item.subtotal, 0), 0));
  const amountPaid = roundMoney(Math.min(Math.max(safeNumber(normalized.amount_paid, 0), 0), totalRevenue));
  const remainingAmount = roundMoney(Math.max(totalRevenue - amountPaid, 0));

  let paymentStatus = PAYMENT_STATUS.RECEIVABLE;

  if (totalRevenue > 0 && amountPaid >= totalRevenue) {
    paymentStatus = PAYMENT_STATUS.PAID;
  } else if (amountPaid > 0 && remainingAmount > 0) {
    paymentStatus = PAYMENT_STATUS.PARTIAL;
  }

  if (safeNumber(normalized.amount_paid, 0) > totalRevenue) {
    warnings.push(makeWarning('AMOUNT_PAID_EXCEEDS_TOTAL', 'amount_paid lebih besar dari total penjualan. Nilai dibatasi sebesar total penjualan.', {
      amount_paid: normalized.amount_paid,
      total_revenue: totalRevenue,
    }));
  }

  return {
    ok: true,
    order_id: normalized.order_id,
    total_revenue: totalRevenue,
    total_amount: totalRevenue,
    amount_paid: amountPaid,
    remaining_amount: remainingAmount,
    payment_status: paymentStatus,
    item_count: items.length,
    items,
    warnings,
  };
};

/* =========================================================================
   INVENTORY RESERVATION / SIMULATION
   ========================================================================= */

export const reserveInventory = (input = {}, options = {}) => {
  const warnings = [];
  const normalized = normalizeOrderInput(input);

  const inventorySource = extractInventorySource({ ...options, ...input });
  const rulesSource = extractRulesSource({ ...options, ...input });

  const reservations = [];

  normalized.items.forEach((item) => {
    const consumption = calculateConsumptionCost(
      inventorySource,
      {
        itemId: item.item_id,
        itemName: item.item_name,
        qty: item.qty,
        unit: item.unit,
        branch_id: normalized.branch_id,
        warehouse_id: normalized.warehouse_id,
        franchise_id: normalized.franchise_id,
        date: normalized.order_date,
      },
      {
        branchId: normalized.branch_id,
        warehouseId: normalized.warehouse_id,
        franchiseId: normalized.franchise_id,
        asOfDate: normalized.order_date,
        rulesSource,
        rules: options.rules,
        includeConversionSnapshot: options.includeConversionSnapshot,
      },
    );

    warnings.push(...consumption.warnings);

    reservations.push({
      index: item.index,
      item_id: item.item_id,
      item_name: item.item_name,
      requested_qty: item.qty,
      requested_unit: item.unit,

      fulfilled_qty: consumption.fulfilled_qty,
      fulfilled_unit: consumption.fulfilled_unit,
      insufficient_qty: consumption.insufficient_qty,

      estimated_cost: roundMoney(consumption.total_cost),

      consumed_layers: consumption.consumed_layers || [],
      layer_updates: consumption.layer_updates || [],
      cost_layer_snapshot: consumption.snapshot || null,

      ok: consumption.ok,
      warnings: consumption.warnings,
    });
  });

  const allReserved = reservations.length > 0 && reservations.every((reservation) => reservation.ok && safeNumber(reservation.insufficient_qty, 0) <= 0);

  return {
    ok: allReserved,
    inventory_reservation: {
      reservation_id: input.reservation_id || input.reservationId || generateId('SALES-RESERVE'),
      branch_id: normalized.branch_id,
      warehouse_id: normalized.warehouse_id,
      franchise_id: normalized.franchise_id,
      order_date: normalized.order_date,
      reservations,
      generated_at: new Date().toISOString(),
      engine_version: ENGINE_VERSION,
    },
    warnings,
  };
};

/* =========================================================================
   ORDER PROFIT
   ========================================================================= */

export const calculateOrderProfit = (input = {}, options = {}) => {
  const normalized = normalizeOrderInput(input);
  const summary = calculateOrderSummary(input, options);

  const hppResult = calculateOrderHpp({
    ...options,
    ...input,

    items: summary.items.map((item) => ({
      product_id: item.item_id,
      product_name: item.item_name,
      item_id: item.item_id,
      item_name: item.item_name,
      qty: item.qty,
      unit: item.unit,
      selling_price: item.selling_price,
      subtotal: item.subtotal,
    })),

    totalRevenue: summary.total_revenue,

    branchId: normalized.branch_id,
    warehouseId: normalized.warehouse_id,
    franchiseId: normalized.franchise_id,

    orderDate: normalized.order_date,

    inventorySource: extractInventorySource({ ...options, ...input }),
    rulesSource: extractRulesSource({ ...options, ...input }),
    rules: options.rules,

    preferExistingSnapshot: options.preferExistingSnapshot,
    prefer_existing_snapshot: options.prefer_existing_snapshot,
  });

  return {
    ok: hppResult.ok,
    total_revenue: hppResult.total_revenue,
    total_hpp: hppResult.total_hpp,
    gross_profit: hppResult.gross_profit,
    gross_margin_pct: hppResult.gross_margin_pct,
    margin_pct: hppResult.margin_pct,

    order_item_breakdown: hppResult.order_item_breakdown || [],
    hpp_snapshot: hppResult.hpp_snapshot || null,
    cost_layer_snapshot: hppResult.cost_layer_snapshot || null,

    warnings: [
      ...summary.warnings,
      ...hppResult.warnings,
    ],
  };
};

/* =========================================================================
   CASHFLOW & RECEIVABLE
   ========================================================================= */

const createReceivableEntry = (orderHeader = {}, summary = {}, options = {}) => {
  if (safeNumber(summary.remaining_amount, 0) <= 0) return null;

  return {
    id: options.receivableId || options.receivable_id || generateId('AR'),

    date: orderHeader.order_date,
    branch_id: orderHeader.branch_id,
    warehouse_id: orderHeader.warehouse_id,
    franchise_id: orderHeader.franchise_id || '',

    customer_id: orderHeader.customer_id,
    customer_name: orderHeader.customer_name,

    type: 'RECEIVABLE',
    reference_table: 'orders',
    reference_id: orderHeader.order_id,
    invoice_number: orderHeader.invoice_number,

    total_amount: roundMoney(summary.total_revenue),
    amount_paid: roundMoney(summary.amount_paid),
    remaining_amount: roundMoney(summary.remaining_amount),

    payment_status: summary.payment_status,

    description: `Piutang invoice ${orderHeader.invoice_number || orderHeader.order_id}`,
    created_at: new Date().toISOString(),
    created_by: orderHeader.created_by || '',
    isDeleted: false,
  };
};

const createCashflowEntry = (orderHeader = {}, summary = {}, options = {}) => {
  if (safeNumber(summary.amount_paid, 0) <= 0) return null;

  return {
    id: options.cashflowId || options.cashflow_id || generateId('CASH-IN'),

    date: orderHeader.order_date,
    branch_id: orderHeader.branch_id,

    type: 'IN',
    category: 'SALES',
    method: orderHeader.payment_method || '',

    amount: roundMoney(summary.amount_paid),

    description: `Pembayaran invoice ${orderHeader.invoice_number || orderHeader.order_id}`,
    reference_table: 'orders',
    reference_id: orderHeader.order_id,

    created_at: new Date().toISOString(),
    created_by: orderHeader.created_by || '',
    isDeleted: false,
  };
};

/* =========================================================================
   SALES ORDER PACKAGE
   ========================================================================= */

export const createSalesOrder = (input = {}, options = {}) => {
  const warnings = [];

  const validation = validateOrderInput(input, options);
  warnings.push(...validation.warnings);

  const normalized = validation.input || normalizeOrderInput(input);

  const summary = calculateOrderSummary(normalized, options);
  warnings.push(...summary.warnings);

  const profit = calculateOrderProfit(normalized, options);
  warnings.push(...profit.warnings);

  const reservation = reserveInventory(normalized, options);
  warnings.push(...reservation.warnings);

  const orderId = normalized.order_id || generateId('ORD');

  const orderHeader = {
    id: orderId,
    order_id: orderId,

    date: normalized.order_date,
    order_date: normalized.order_date,

    branch_id: normalized.branch_id,
    warehouse_id: normalized.warehouse_id,
    franchise_id: normalized.franchise_id,

    customer_id: normalized.customer_id,
    customer_name: normalized.customer_name,

    invoice_number: normalized.invoice_number,

    sales_channel: normalized.sales_channel,
    payment_method: normalized.payment_method,
    payment_status: summary.payment_status,

    total_amount: summary.total_revenue,
    total_revenue: summary.total_revenue,
    amount_paid: summary.amount_paid,
    remaining_amount: summary.remaining_amount,

    total_hpp: profit.total_hpp,
    gross_profit: profit.gross_profit,
    gross_margin_pct: profit.gross_margin_pct,
    margin_pct: profit.margin_pct,

    status: validation.ok && profit.ok && reservation.ok
      ? (
          summary.payment_status === PAYMENT_STATUS.PAID
            ? SALES_STATUS.PAID
            : summary.payment_status === PAYMENT_STATUS.PARTIAL
              ? SALES_STATUS.PARTIAL_PAYMENT
              : SALES_STATUS.RECEIVABLE
        )
      : SALES_STATUS.BLOCKED,

    operator: normalized.operator,
    notes: normalized.notes,

    hpp_snapshot_json: profit.hpp_snapshot ? JSON.stringify(profit.hpp_snapshot) : '',
    cost_layer_snapshot_json: profit.cost_layer_snapshot ? JSON.stringify(profit.cost_layer_snapshot) : '',

    created_at: new Date().toISOString(),
    created_by: normalized.operator,
    isDeleted: false,
  };

  const orderItems = summary.items.map((item) => {
    const hppItem = safeArray(profit.order_item_breakdown).find((breakdown) => breakdown.index === item.index) || null;

    return {
      id: generateId('ORD-ITEM'),
      order_id: orderId,

      item_id: item.item_id,
      item_name: item.item_name,
      category: item.category,

      qty: item.qty,
      unit: item.unit,
      selling_price: roundMoney(item.selling_price),
      subtotal: roundMoney(item.subtotal),

      total_hpp: roundMoney(hppItem?.total_hpp || 0),
      hpp_per_unit: roundMoney(hppItem?.hpp_per_unit || 0),
      gross_profit: roundMoney(hppItem?.gross_profit || 0),
      margin_pct: safeNumber(hppItem?.margin_pct, 0),

      notes: item.notes || '',
      source_index: item.index,
    };
  });

  const inventoryConsumption = safeArray(reservation.inventory_reservation?.reservations).map((reservationItem) => ({
    item_id: reservationItem.item_id,
    item_name: reservationItem.item_name,
    requested_qty: reservationItem.requested_qty,
    requested_unit: reservationItem.requested_unit,
    fulfilled_qty: reservationItem.fulfilled_qty,
    fulfilled_unit: reservationItem.fulfilled_unit,
    insufficient_qty: reservationItem.insufficient_qty,
    estimated_cost: reservationItem.estimated_cost,
    consumed_layers: reservationItem.consumed_layers,
    layer_updates: reservationItem.layer_updates,
    cost_layer_snapshot: reservationItem.cost_layer_snapshot,
  }));

  const receivableEntry = createReceivableEntry(orderHeader, summary, options);
  const cashflowEntry = createCashflowEntry(orderHeader, summary, options);

  const salesSnapshotResult = createSalesSnapshot({
    order_header: orderHeader,
    order_items: orderItems,
    inventory_consumption: inventoryConsumption,
    receivable_entry: receivableEntry,
    cashflow_entry: cashflowEntry,
    hpp_snapshot: profit.hpp_snapshot,
    cost_layer_snapshot: profit.cost_layer_snapshot,
    warnings,
    rulesSource: extractRulesSource({ ...options, ...input }),
  }, {
    lock: true,
  });

  warnings.push(...salesSnapshotResult.warnings);

  const salesTransactionPackage = {
    package_type: 'SALES_TRANSACTION_PACKAGE',
    package_version: ENGINE_VERSION,
    generated_at: new Date().toISOString(),

    order_header: {
      ...orderHeader,
      sales_snapshot_json: salesSnapshotResult.snapshot
        ? JSON.stringify(salesSnapshotResult.snapshot)
        : '',
    },

    order_items: orderItems,
    inventory_consumption: inventoryConsumption,
    receivable_entry: receivableEntry,
    cashflow_entry: cashflowEntry,

    hpp_snapshot: profit.hpp_snapshot || null,
    sales_snapshot: salesSnapshotResult.snapshot || null,

    print_payload_customer: {
      invoice_number: orderHeader.invoice_number,
      order_date: orderHeader.order_date,
      customer_id: orderHeader.customer_id,
      customer_name: orderHeader.customer_name,
      branch_id: orderHeader.branch_id,
      sales_channel: orderHeader.sales_channel,
      items: orderItems.map((item) => ({
        item_name: item.item_name,
        qty: item.qty,
        unit: item.unit,
        selling_price: item.selling_price,
        subtotal: item.subtotal,
      })),
      total_amount: orderHeader.total_amount,
      amount_paid: orderHeader.amount_paid,
      remaining_amount: orderHeader.remaining_amount,
      payment_status: orderHeader.payment_status,
    },

    internal_profit_summary: {
      total_revenue: orderHeader.total_revenue,
      total_hpp: orderHeader.total_hpp,
      gross_profit: orderHeader.gross_profit,
      gross_margin_pct: orderHeader.gross_margin_pct,
      margin_pct: orderHeader.margin_pct,
    },

    status: validation.ok && profit.ok && reservation.ok && salesSnapshotResult.ok
      ? orderHeader.status
      : SALES_STATUS.BLOCKED,

    warnings,
  };

  return {
    ok: validation.ok && profit.ok && reservation.ok && salesSnapshotResult.ok,
    sales_transaction_package: salesTransactionPackage,
    warnings,
  };
};

/* =========================================================================
   SALES SNAPSHOT
   ========================================================================= */

export const createSalesSnapshot = (input = {}, options = {}) => {
  const orderHeader = input.order_header || input.orderHeader || {};
  const orderId = orderHeader.order_id || orderHeader.id || input.order_id || input.orderId || '';

  const snapshotResult = createTransactionSnapshot({
    snapshot_type: 'ORDER',
    transaction_id: orderId,
    transaction_type: 'SALES_ORDER',

    branch_id: orderHeader.branch_id || input.branch_id || input.branchId || DEFAULT_BRANCH_SCOPE,
    created_by: orderHeader.created_by || orderHeader.operator || input.created_by || input.createdBy || 'SYSTEM',

    transaction_header: orderHeader,
    transaction_items: safeArray(input.order_items || input.orderItems),

    hpp_snapshot: input.hpp_snapshot || input.hppSnapshot || null,
    cost_layer_snapshot: input.cost_layer_snapshot || input.costLayerSnapshot || null,

    order_snapshot: {
      order_header: orderHeader,
      order_items: safeArray(input.order_items || input.orderItems),
      inventory_consumption: safeArray(input.inventory_consumption || input.inventoryConsumption),
      receivable_entry: input.receivable_entry || input.receivableEntry || null,
      cashflow_entry: input.cashflow_entry || input.cashflowEntry || null,
      conversion_snapshot: createConversionSnapshot(input.rulesSource || input.rules_source || input.dbData || input.source || [], {
        branchId: orderHeader.branch_id || input.branch_id || input.branchId || DEFAULT_BRANCH_SCOPE,
      }),
    },

    warnings: input.warnings || [],

    engine_versions: {
      salesEngine: ENGINE_VERSION,
    },

    meta: {
      source_module: 'salesEngine',
      source_table: 'orders',
      source_id: orderId,
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
   REVERSE SALES
   ========================================================================= */

const extractSalesSnapshotPayload = (input = {}) => {
  const directSnapshot =
    input.sales_snapshot ||
    input.salesSnapshot ||
    parseJson(input.sales_snapshot_json, null) ||
    parseJson(input.salesSnapshotJson, null);

  if (!directSnapshot) return null;

  const readResult = readSnapshot(directSnapshot, {
    allowInvalid: true,
    freeze: false,
  });

  if (!readResult.ok || !readResult.snapshot) return null;

  return readResult.snapshot.payload?.order_snapshot ||
    readResult.snapshot.payload?.additional_payload?.order_snapshot ||
    readResult.snapshot.payload ||
    null;
};

const createInventoryRestorationFromSales = (inventoryConsumption = [], reversalHeader = {}) => {
  const restorationLayers = [];

  safeArray(inventoryConsumption).forEach((item) => {
    const consumedLayers = safeArray(item.consumed_layers);

    consumedLayers.forEach((layer) => {
      restorationLayers.push({
        id: generateId('SALES-REV-LAYER'),
        reversal_layer_id: generateId('SALES-REV-LAYER'),

        original_layer_id: layer.layer_id || '',

        item_id: layer.item_id || item.item_id,
        item_name: layer.item_name || item.item_name,

        branch_id: layer.branch_id || reversalHeader.branch_id,
        warehouse_id: layer.warehouse_id || reversalHeader.warehouse_id,
        franchise_id: layer.franchise_id || reversalHeader.franchise_id || '',

        qty_original: safeNumber(layer.consumed_qty, 0),
        qty_remaining: safeNumber(layer.consumed_qty, 0),
        unit: layer.consumed_unit || item.requested_unit,

        unit_cost: safeNumber(layer.unit_cost, 0),
        total_cost: roundMoney(safeNumber(layer.total_cost, 0)),

        source_document: DOCUMENT_TYPES.SALES_REVERSAL,
        source_document_id: reversalHeader.reversal_id,
        original_source_document_id: reversalHeader.original_order_id,

        received_date: reversalHeader.reversal_date,
        expired_date: layer.expired_date || '',

        movement_type: MOVEMENT_TYPES.SALES_REVERSAL,
        status: 'ACTIVE',

        notes: `Reversal penjualan invoice ${reversalHeader.original_order_id}`,
      });
    });
  });

  return restorationLayers;
};

export const reverseSales = (input = {}, options = {}) => {
  const warnings = [];

  const packageInput = input.sales_transaction_package || input.salesTransactionPackage || input;
  const orderHeader = packageInput.order_header || input.order_header || input.orderHeader || {};

  const snapshotPayload = extractSalesSnapshotPayload(orderHeader) ||
    extractSalesSnapshotPayload(packageInput) ||
    null;

  const originalOrderHeader = snapshotPayload?.order_header ||
    snapshotPayload?.transaction_header ||
    orderHeader;

  const originalOrderItems = snapshotPayload?.order_items ||
    snapshotPayload?.transaction_items ||
    packageInput.order_items ||
    [];

  const originalInventoryConsumption = snapshotPayload?.inventory_consumption ||
    packageInput.inventory_consumption ||
    [];

  const originalReceivable = snapshotPayload?.receivable_entry ||
    packageInput.receivable_entry ||
    null;

  const originalCashflow = snapshotPayload?.cashflow_entry ||
    packageInput.cashflow_entry ||
    null;

  const originalHppSnapshot = snapshotPayload?.hpp_snapshot ||
    packageInput.hpp_snapshot ||
    null;

  const originalOrderId = originalOrderHeader.order_id ||
    originalOrderHeader.id ||
    input.order_id ||
    input.orderId ||
    '';

  if (!originalOrderId) {
    warnings.push(makeWarning('MISSING_ORIGINAL_ORDER_ID', 'ID invoice original tidak ditemukan untuk reversal.'));
  }

  const reversalId = input.reversal_id || input.reversalId || generateId('SALES-REV');
  const reversalDate = normalizeDateString(input.reversal_date || input.reversalDate || input.date || getTodayISO());

  const reversalHeader = {
    id: reversalId,
    reversal_id: reversalId,

    original_order_id: originalOrderId,
    original_invoice_number: originalOrderHeader.invoice_number || '',

    reversal_date: reversalDate,
    date: reversalDate,

    branch_id: normalizeBranchId(originalOrderHeader.branch_id || input.branch_id || input.branchId || DEFAULT_BRANCH_SCOPE),
    warehouse_id: normalizeWarehouseId(originalOrderHeader.warehouse_id || input.warehouse_id || input.warehouseId || DEFAULT_WAREHOUSE),
    franchise_id: normalizeFranchiseId(originalOrderHeader.franchise_id || input.franchise_id || input.franchiseId || ''),

    customer_id: originalOrderHeader.customer_id || '',
    customer_name: originalOrderHeader.customer_name || '',

    reason: String(input.reason || input.notes || 'SALES_REVERSAL').trim(),
    operator: String(input.operator || input.created_by || input.createdBy || 'SYSTEM').trim(),

    status: SALES_STATUS.REVERSED,
    movement_type: MOVEMENT_TYPES.SALES_REVERSAL,

    created_at: new Date().toISOString(),
    created_by: String(input.operator || input.created_by || input.createdBy || 'SYSTEM').trim(),
    isDeleted: false,
  };

  const inventoryRestorationLayers = createInventoryRestorationFromSales(
    originalInventoryConsumption,
    reversalHeader,
  );

  if (inventoryRestorationLayers.length === 0) {
    warnings.push(makeWarning('EMPTY_INVENTORY_RESTORATION', 'Tidak ada inventory consumption yang bisa dibuat reversal.', {
      original_order_id: originalOrderId,
    }));
  }

  const receivableReversal = originalReceivable
    ? {
        id: generateId('AR-REV'),

        date: reversalDate,
        branch_id: reversalHeader.branch_id,
        warehouse_id: reversalHeader.warehouse_id,
        franchise_id: reversalHeader.franchise_id,

        customer_id: reversalHeader.customer_id,
        customer_name: reversalHeader.customer_name,

        type: 'RECEIVABLE_REVERSAL',
        reference_table: 'orders',
        reference_id: originalOrderId,
        reversal_id: reversalId,

        total_amount: roundMoney(safeNumber(originalReceivable.total_amount, 0) * -1),
        amount_paid: roundMoney(safeNumber(originalReceivable.amount_paid, 0) * -1),
        remaining_amount: roundMoney(safeNumber(originalReceivable.remaining_amount, 0) * -1),

        description: `Reversal piutang invoice ${originalOrderId}`,
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
        category: 'SALES_REVERSAL',
        method: originalCashflow.method || '',

        amount: roundMoney(safeNumber(originalCashflow.amount, 0) * -1),

        description: `Reversal cashflow invoice ${originalOrderId}`,
        reference_table: 'orders',
        reference_id: originalOrderId,
        reversal_id: reversalId,

        created_at: new Date().toISOString(),
        created_by: reversalHeader.created_by,
        isDeleted: false,
      }
    : null;

  const hppReversal = originalHppSnapshot
    ? {
        original_hpp_snapshot: originalHppSnapshot,
        total_revenue_reversal: roundMoney(safeNumber(originalOrderHeader.total_revenue || originalOrderHeader.total_amount, 0) * -1),
        total_hpp_reversal: roundMoney(safeNumber(originalOrderHeader.total_hpp, 0) * -1),
        gross_profit_reversal: roundMoney(safeNumber(originalOrderHeader.gross_profit, 0) * -1),
      }
    : null;

  const reversalSnapshotResult = createSnapshot({
    snapshot_type: 'ORDER',
    transaction_id: reversalId,
    transaction_type: 'SALES_REVERSAL',
    branch_id: reversalHeader.branch_id,
    created_by: reversalHeader.created_by,

    engine_versions: {
      salesEngine: ENGINE_VERSION,
    },

    payload: {
      reversal_header: reversalHeader,
      original_order_header: originalOrderHeader,
      original_order_items: originalOrderItems,
      inventory_restoration_layers: inventoryRestorationLayers,
      receivable_reversal: receivableReversal,
      cashflow_reversal: cashflowReversal,
      hpp_reversal: hppReversal,
      original_sales_snapshot_payload: snapshotPayload,
    },

    warnings,

    meta: {
      source_module: 'salesEngine',
      source_table: 'orders',
      source_id: originalOrderId,
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
    package_type: 'SALES_REVERSAL_PACKAGE',
    package_version: ENGINE_VERSION,
    generated_at: new Date().toISOString(),

    reversal_header: reversalHeader,
    original_order_header: originalOrderHeader,
    original_order_items: originalOrderItems,

    inventory_restoration_layers: inventoryRestorationLayers,
    receivable_reversal: receivableReversal,
    cashflow_reversal: cashflowReversal,
    hpp_reversal: hppReversal,

    reversal_snapshot: lockedSnapshot.snapshot || reversalSnapshotResult.snapshot,

    status: warnings.some((warning) => warning.code === 'MISSING_ORIGINAL_ORDER_ID')
      ? SALES_STATUS.BLOCKED
      : SALES_STATUS.REVERSED,

    warnings,
  };

  return {
    ok: reversalPackage.status === SALES_STATUS.REVERSED,
    sales_reversal_package: reversalPackage,
    warnings,
  };
};

/* =========================================================================
   DEFAULT EXPORT
   ========================================================================= */

export default {
  SALES_CHANNELS,

  validateOrderInput,
  createSalesOrder,
  calculateOrderSummary,
  reserveInventory,
  createSalesSnapshot,
  calculateOrderProfit,
  reverseSales,
};
