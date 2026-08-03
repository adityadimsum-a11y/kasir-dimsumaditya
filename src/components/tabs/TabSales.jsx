import React, { useMemo, useState } from 'react';
import {
  ShoppingBag,
  Plus,
  Save,
  X,
  Edit2,
  Search,
  Filter,
  Building2,
  Warehouse,
  UserRound,
  PackageCheck,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  CalendarClock,
  ReceiptText,
  WalletCards,
  CreditCard,
  Banknote,
  QrCode,
  History,
  Crown,
  TrendingUp,
  Undo2,
  Send,
  Copy,
  Flag,
  FileText,
  Store,
  Utensils,
  BadgeDollarSign,
  Package,
  Layers,
  Users,
  ShoppingCart,
} from 'lucide-react';

import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import erpOrchestrator from '../../services/erpOrchestrator';

const SALES_TABLE_NAME = 'sales_transactions';

const SALES_CHANNELS = [
  'OFFLINE_RESTO',
  'GOFOOD',
  'GRABFOOD',
  'SHOPEEFOOD',
  'TIKTOK',
  'RESELLER',
  'AGEN',
  'DISTRIBUTOR',
  'FRANCHISE',
];

const PAYMENT_METHODS = [
  'CASH',
  'TRANSFER',
  'QRIS',
  'PIUTANG',
];

const PAYMENT_STATUS = [
  'PAID',
  'PARTIAL',
  'UNPAID',
];

const ORDER_STATUS = [
  'DRAFT',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'VOID',
];

const DEFAULT_FORM = {
  id: '',
  sales_id: '',
  sales_code: '',
  sales_date: '',
  customer_id: '',
  customer_name: '',
  sales_channel: 'OFFLINE_RESTO',
  branch_id: '',
  warehouse_id: '',
  payment_method: 'CASH',
  payment_status: 'PAID',
  order_status: 'DRAFT',
  notes: '',
  amount_paid: '',
};

const DEFAULT_LINE_FORM = {
  line_id: '',
  product_id: '',
  product_name: '',
  qty: '',
  unit: 'PCS',
  selling_price: '',
  subtotal: '',
  discount: '',
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

const normalizeOrderStatus = (row) => {
  const value = row?.order_status ?? row?.sales_status ?? row?.status ?? row?.transaction_status;
  const normalized = normalizeCode(value || 'DRAFT');

  if (['VOIDED', 'VOID'].includes(normalized)) return 'VOID';
  if (['CANCELLED', 'CANCELED', 'BATAL'].includes(normalized)) return 'CANCELLED';
  if (['COMPLETED', 'COMPLETE', 'DONE', 'POSTED', 'PAID'].includes(normalized)) return 'COMPLETED';
  if (['CONFIRMED', 'CONFIRM', 'BOOKED', 'RESERVED'].includes(normalized)) return 'CONFIRMED';
  if (['DRAFT', 'OPEN'].includes(normalized)) return 'DRAFT';

  return normalized || 'DRAFT';
};

const normalizePaymentStatus = (value, totalAmount = 0, amountPaid = 0) => {
  const normalized = normalizeCode(value || '');

  if (['PAID', 'LUNAS'].includes(normalized)) return 'PAID';
  if (['PARTIAL', 'PARTIAL_PAYMENT', 'SEBAGIAN'].includes(normalized)) return 'PARTIAL';
  if (['UNPAID', 'PIUTANG', 'RECEIVABLE', 'BELUM_BAYAR'].includes(normalized)) return 'UNPAID';

  if (amountPaid >= totalAmount && totalAmount > 0) return 'PAID';
  if (amountPaid > 0 && amountPaid < totalAmount) return 'PARTIAL';

  return 'UNPAID';
};

const getRawSalesRows = ({
  salesTransactions,
  sales_transactions,
  salesOrders,
  sales_orders,
  orders,
  salesPackages,
  sales_packages,
  dbData,
}) => {
  return [
    ...safeArray(salesTransactions),
    ...safeArray(sales_transactions),
    ...safeArray(salesOrders),
    ...safeArray(sales_orders),
    ...safeArray(orders),
    ...safeArray(salesPackages),
    ...safeArray(sales_packages),
    ...safeArray(dbData?.salesTransactions),
    ...safeArray(dbData?.sales_transactions),
    ...safeArray(dbData?.salesOrders),
    ...safeArray(dbData?.sales_orders),
    ...safeArray(dbData?.orders),
    ...safeArray(dbData?.salesPackages),
    ...safeArray(dbData?.sales_packages),
  ];
};

const getRawCustomerRows = ({
  masterCustomers,
  master_customers,
  customers,
  pelanggan,
  dbData,
}) => {
  if (Array.isArray(master_customers)) return master_customers;
  if (Array.isArray(masterCustomers)) return masterCustomers;
  if (Array.isArray(customers)) return customers;
  if (Array.isArray(pelanggan)) return pelanggan;

  if (Array.isArray(dbData?.master_customers)) return dbData.master_customers;
  if (Array.isArray(dbData?.masterCustomers)) return dbData.masterCustomers;
  if (Array.isArray(dbData?.customers)) return dbData.customers;
  if (Array.isArray(dbData?.pelanggan)) return dbData.pelanggan;

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
  const branchId = String(raw.branch_id || raw.branchId || record?.id || raw.id || '').trim();

  return {
    id: String(raw.id || branchId).trim(),
    branch_id: branchId,
    branch_code: String(raw.branch_code || raw.branchCode || raw.code || branchId || '').trim(),
    branch_name: String(raw.branch_name || raw.branchName || raw.nama_cabang || raw.name || record?.name || branchId || '').trim(),
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
  const warehouseId = String(raw.warehouse_id || raw.warehouseId || raw.location_id || raw.locationId || record?.id || raw.id || '').trim();

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

const normalizeCustomerDisplay = (record) => {
  const raw = record?.raw || record || {};
  const customerId = String(raw.customer_id || raw.customerId || record?.id || raw.id || '').trim();

  return {
    id: String(raw.id || customerId).trim(),
    customer_id: customerId,
    customer_code: String(raw.customer_code || raw.customerCode || raw.code || customerId || '').trim(),
    customer_name: String(raw.customer_name || raw.customerName || raw.nama_pelanggan || raw.name || record?.name || '').trim(),
    customer_type: normalizeCode(raw.customer_type || raw.customerType || raw.type || 'RETAIL'),
    customer_group: normalizeCode(raw.customer_group || raw.customerGroup || raw.group || 'OFFLINE'),
    branch_id: String(raw.branch_id || raw.branchId || record?.branch_id || '').trim(),
    nomor_telepon: String(raw.nomor_telepon || raw.phone || raw.whatsapp || '').trim(),
    limit_piutang: roundMoney(raw.limit_piutang || raw.credit_limit || 0),
    jatuh_tempo_hari: toNumber(raw.jatuh_tempo_hari || raw.due_days || 0),
    status: normalizeMasterStatus(raw),
    isDeleted: isSoftDeleted(raw),
    raw,
  };
};

const normalizeProductDisplay = (record) => {
  const raw = record?.raw || record || {};
  const productId = String(raw.product_id || raw.productId || raw.item_id || raw.itemId || record?.id || raw.id || '').trim();

  const isSellableRaw = raw.is_sellable ?? raw.isSellable ?? raw.sellable;
  const isSellable = isSellableRaw === undefined || isSellableRaw === null || isSellableRaw === ''
    ? true
    : isSellableRaw === true || String(isSellableRaw).toUpperCase() === 'TRUE';

  return {
    id: String(raw.id || productId).trim(),
    product_id: productId,
    product_code: String(raw.product_code || raw.productCode || raw.item_code || raw.sku || raw.code || productId || '').trim(),
    product_name: String(raw.product_name || raw.productName || raw.item_name || raw.nama_produk || raw.name || record?.name || '').trim(),
    product_category: normalizeCode(raw.product_category || raw.category || raw.kategori || 'UMUM'),
    branch_id: String(raw.branch_id || raw.branchId || record?.branch_id || '').trim(),
    default_warehouse_id: String(raw.default_warehouse_id || raw.warehouse_id || raw.warehouseId || '').trim(),
    selling_unit: normalizeCode(raw.selling_unit || raw.unit || raw.satuan || 'PCS'),
    selling_price: roundMoney(raw.selling_price || raw.price || raw.harga_jual || 0),
    minimum_selling_price: roundMoney(raw.minimum_selling_price || raw.min_selling_price || 0),
    status: normalizeMasterStatus(raw),
    is_sellable: isSellable,
    isDeleted: isSoftDeleted(raw),
    raw,
  };
};

const normalizeSalesLine = (line = {}, index = 0) => {
  const qty = roundQty(line.qty || line.quantity || 0);
  const sellingPrice = roundMoney(line.selling_price || line.sellingPrice || line.price || line.unit_price || 0);
  const discount = roundMoney(line.discount || line.diskon || 0);
  const subtotal = roundMoney(line.subtotal || line.total || line.amount || Math.max(qty * sellingPrice - discount, 0));

  return {
    line_id: String(line.line_id || line.lineId || generateId(`SAL-L${index + 1}`, getTodayStr())).trim(),
    product_id: String(line.product_id || line.productId || line.item_id || '').trim(),
    product_name: String(line.product_name || line.productName || line.item_name || '').trim(),
    qty,
    unit: normalizeCode(line.unit || line.satuan || 'PCS'),
    selling_price: sellingPrice,
    subtotal,
    discount,
    notes: String(line.notes || line.keterangan || '').trim(),
  };
};

const extractPackageProfit = (base, header) => {
  const profitPackage =
    base.profit_package ||
    base.profitPackage ||
    base.profit ||
    header?.profit_package ||
    parseJson(header?.profit_package_json, null) ||
    null;

  return roundMoney(
    header?.actual_profit ||
    header?.total_profit ||
    profitPackage?.actual_profit ||
    profitPackage?.total_profit ||
    profitPackage?.gross_profit ||
    profitPackage?.net_profit ||
    0,
  );
};

const normalizeSalesRecord = (row) => {
  const packageInput = row?.sales_transaction_package || row?.salesTransactionPackage || row?.sales_order_package || row || {};
  const header = packageInput.sales_header || packageInput.order_header || packageInput.header || row?.sales_header || row?.order_header || row || {};
  const snapshot = packageInput.sales_snapshot || packageInput.snapshot_package || parseJson(header.sales_snapshot_json, null) || null;
  const snapshotPayload = snapshot?.payload?.sales_snapshot || snapshot?.payload?.order_snapshot || snapshot?.payload || null;
  const snapshotHeader = snapshotPayload?.sales_header || snapshotPayload?.order_header || snapshotPayload?.transaction_header || {};

  const finalHeader = {
    ...snapshotHeader,
    ...header,
  };

  const items =
    packageInput.sales_items ||
    packageInput.order_items ||
    packageInput.items ||
    snapshotPayload?.sales_items ||
    snapshotPayload?.order_items ||
    snapshotPayload?.transaction_items ||
    row?.sales_items ||
    row?.order_items ||
    parseJson(finalHeader.sales_items_json, []) ||
    parseJson(finalHeader.order_items_json, []) ||
    parseJson(finalHeader.items_json, []) ||
    [];

  const normalizedLines = Array.isArray(items)
    ? items.map(normalizeSalesLine)
    : [];

  const totalAmount = roundMoney(
    finalHeader.total_amount ||
    finalHeader.grand_total ||
    finalHeader.omzet ||
    finalHeader.subtotal ||
    normalizedLines.reduce((sum, line) => sum + toNumber(line.subtotal), 0),
  );

  const totalDiscount = roundMoney(
    finalHeader.total_discount ||
    normalizedLines.reduce((sum, line) => sum + toNumber(line.discount), 0),
  );

  const amountPaid = roundMoney(
    finalHeader.amount_paid ||
    finalHeader.paid_amount ||
    finalHeader.total_paid ||
    0,
  );

  const salesId = String(finalHeader.sales_id || finalHeader.order_id || finalHeader.id || row?.sales_id || row?.id || '').trim();
  const salesCode = String(finalHeader.sales_code || finalHeader.order_code || finalHeader.invoice_number || finalHeader.code || salesId || '').trim();

  return {
    id: String(finalHeader.id || salesId).trim(),

    sales_id: salesId,
    sales_code: salesCode,
    sales_date: normalizeDate(finalHeader.sales_date || finalHeader.order_date || finalHeader.date || finalHeader.created_at || row?.date || ''),

    customer_id: String(finalHeader.customer_id || finalHeader.customerId || '').trim(),
    customer_name: String(finalHeader.customer_name || finalHeader.customerName || '').trim(),

    sales_channel: normalizeCode(finalHeader.sales_channel || finalHeader.salesChannel || finalHeader.channel || 'OFFLINE_RESTO'),

    branch_id: String(finalHeader.branch_id || finalHeader.branchId || '').trim(),
    warehouse_id: String(finalHeader.warehouse_id || finalHeader.warehouseId || '').trim(),

    payment_method: normalizeCode(finalHeader.payment_method || finalHeader.paymentMethod || ''),
    payment_status: normalizePaymentStatus(finalHeader.payment_status || finalHeader.paymentStatus, totalAmount, amountPaid),

    order_status: normalizeOrderStatus(finalHeader),

    notes: String(finalHeader.notes || finalHeader.keterangan || '').trim(),

    amount_paid: amountPaid,
    total_amount: totalAmount,
    total_discount: totalDiscount,
    remaining_amount: roundMoney(
      finalHeader.remaining_amount ||
      finalHeader.piutang ||
      finalHeader.amount_receivable ||
      Math.max(totalAmount - amountPaid, 0),
    ),

    actual_profit: extractPackageProfit(packageInput, finalHeader),

    sales_items: normalizedLines,

    created_at: finalHeader.created_at || row?.created_at || '',
    updated_at: finalHeader.updated_at || row?.updated_at || '',
    confirmed_at: finalHeader.confirmed_at || row?.confirmed_at || '',
    completed_at: finalHeader.completed_at || row?.completed_at || '',
    voided_at: finalHeader.voided_at || row?.voided_at || '',

    search_text: normalizeText([
      salesId,
      salesCode,
      finalHeader.customer_id,
      finalHeader.customer_name,
      finalHeader.sales_channel,
      finalHeader.branch_id,
      finalHeader.warehouse_id,
      finalHeader.order_status,
      finalHeader.payment_method,
      finalHeader.payment_status,
      normalizedLines.map((line) => line.product_name).join(' '),
    ].filter(Boolean).join(' ')),

    raw: row,
  };
};

const buildMasterSource = ({
  dbData,
  rawSalesRows,
  rawCustomerRows,
  rawProductRows,
  rawBranchRows,
  rawWarehouseRows,
  rawInventoryLayerRows,
}) => {
  return {
    ...(dbData || {}),

    sales_transactions: rawSalesRows,
    salesTransactions: rawSalesRows,
    sales_orders: rawSalesRows,
    salesOrders: rawSalesRows,
    orders: rawSalesRows,

    master_customers: rawCustomerRows,
    masterCustomers: rawCustomerRows,
    customers: rawCustomerRows,

    master_products: rawProductRows,
    masterProducts: rawProductRows,
    products: rawProductRows,

    master_branches: rawBranchRows,
    masterBranches: rawBranchRows,
    master_branch: rawBranchRows,

    master_warehouses: rawWarehouseRows,
    masterWarehouses: rawWarehouseRows,
    warehouses: rawWarehouseRows,

    inventory_cost_layers: rawInventoryLayerRows,
    inventoryCostLayers: rawInventoryLayerRows,
    cost_layers: rawInventoryLayerRows,
  };
};

const calculateDraftSummary = (lines, form) => {
  const totalAmount = roundMoney((lines || []).reduce((sum, line) => sum + toNumber(line.subtotal), 0));
  const totalDiscount = roundMoney((lines || []).reduce((sum, line) => sum + toNumber(line.discount), 0));

  let amountPaid = 0;

  if (form.payment_method === 'PIUTANG' || form.payment_status === 'UNPAID') {
    amountPaid = 0;
  } else if (form.payment_status === 'PARTIAL') {
    amountPaid = roundMoney(form.amount_paid);
  } else {
    amountPaid = totalAmount;
  }

  return {
    total_amount: totalAmount,
    total_discount: totalDiscount,
    amount_paid: amountPaid,
    remaining_amount: roundMoney(Math.max(totalAmount - amountPaid, 0)),
    payment_status: normalizePaymentStatus(form.payment_status, totalAmount, amountPaid),
    total_lines: lines.length,
  };
};

const createSalesCommand = ({
  form,
  lines,
  summary,
  mode,
  executor,
  masterSource,
}) => {
  const normalizedLines = lines.map(normalizeSalesLine);

  return {
    transaction_type: 'SALES',
    action: mode,
    mode,

    sales_header: {
      sales_id: form.sales_id,
      sales_code: form.sales_code,
      sales_date: form.sales_date,

      customer_id: form.customer_id,
      customer_name: form.customer_name,

      sales_channel: form.sales_channel,

      branch_id: form.branch_id,
      warehouse_id: form.warehouse_id,

      payment_method: form.payment_method,
      payment_status: summary.payment_status,
      order_status:
        mode === 'CONFIRM'
          ? 'CONFIRMED'
          : mode === 'COMPLETE'
            ? 'COMPLETED'
            : 'DRAFT',

      notes: form.notes,

      amount_paid: summary.amount_paid,
      total_amount: summary.total_amount,
      total_discount: summary.total_discount,
      remaining_amount: summary.remaining_amount,

      created_by: executor,
      updated_by: executor,
    },

    sales_items: normalizedLines,
    order_items: normalizedLines,
    items: normalizedLines,

    source: masterSource,
    dbData: masterSource,
    masterData: masterSource,
  };
};

const normalizeSalesPackageFromOrchestrator = (result) => {
  const base = result?.transaction_package || result?.package || result?.data || result || {};

  return {
    sales_transaction_package:
      base.sales_transaction_package ||
      base.salesTransactionPackage ||
      base.sales_order_package ||
      base.order_package ||
      base.sales ||
      null,

    inventory_consumption_package:
      base.inventory_consumption_package ||
      base.inventoryConsumptionPackage ||
      base.finished_goods_consumption_package ||
      base.inventory_package ||
      base.consumed_layers ||
      null,

    hpp_package:
      base.hpp_package ||
      base.hppPackage ||
      base.cogs_package ||
      base.sales_hpp_package ||
      base.hpp ||
      null,

    profit_package:
      base.profit_package ||
      base.profitPackage ||
      base.sales_profit_package ||
      base.profit ||
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
      base.sales_snapshot ||
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
      base.sales_reversal_package ||
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

  if (!packageResult.sales_transaction_package) missing.push('sales_transaction_package');
  if (!packageResult.inventory_consumption_package) missing.push('inventory_consumption_package');
  if (!packageResult.hpp_package) missing.push('hpp_package');
  if (!packageResult.profit_package) missing.push('profit_package');
  if (!packageResult.accounting_package) missing.push('accounting_package');
  if (!packageResult.snapshot_package) missing.push('snapshot_package');

  return missing;
};

const validateVoidOrchestratorPackage = (packageResult) => {
  const missing = [];

  if (!packageResult.reversal_package) missing.push('reversal_package');

  return missing;
};

const getPaymentIcon = (method) => {
  const normalized = normalizeCode(method);

  if (normalized === 'CASH') return <Banknote size={14} className="text-emerald-600" />;
  if (normalized === 'TRANSFER') return <CreditCard size={14} className="text-slate-500" />;
  if (normalized === 'QRIS') return <QrCode size={14} className="text-purple-600" />;

  return <WalletCards size={14} className="text-amber-700" />;
};

const getChannelIcon = (channel) => {
  const normalized = normalizeCode(channel);

  if (normalized === 'OFFLINE_RESTO') return <Store size={14} />;
  if (['GOFOOD', 'GRABFOOD', 'SHOPEEFOOD', 'TIKTOK'].includes(normalized)) return <ShoppingBag size={14} />;
  if (['RESELLER', 'AGEN', 'DISTRIBUTOR'].includes(normalized)) return <Users size={14} />;
  if (normalized === 'FRANCHISE') return <Building2 size={14} />;

  return <ShoppingCart size={14} />;
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

export default function TabSales({
  salesTransactions = [],
  sales_transactions,
  salesOrders,
  sales_orders,
  orders,
  salesPackages,
  sales_packages,

  masterCustomers = [],
  master_customers,
  customers,
  pelanggan,

  masterProducts = [],
  master_products,
  products,
  produk,

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
    sales_date: todayStr,
    branch_id: isOwnerMode ? '' : userBranchId,
  });

  const [salesLines, setSalesLines] = useState([]);
  const [lineForm, setLineForm] = useState(DEFAULT_LINE_FORM);
  const [editingLineId, setEditingLineId] = useState('');

  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [selectedSales, setSelectedSales] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState(isOwnerMode ? 'ALL' : userBranchId || 'ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');

  const rawSalesRows = useMemo(() => {
    return getRawSalesRows({
      salesTransactions,
      sales_transactions,
      salesOrders,
      sales_orders,
      orders,
      salesPackages,
      sales_packages,
      dbData,
    });
  }, [salesTransactions, sales_transactions, salesOrders, sales_orders, orders, salesPackages, sales_packages, dbData]);

  const rawCustomerRows = useMemo(() => {
    return getRawCustomerRows({
      masterCustomers,
      master_customers,
      customers,
      pelanggan,
      dbData,
    });
  }, [masterCustomers, master_customers, customers, pelanggan, dbData]);

  const rawProductRows = useMemo(() => {
    return getRawProductRows({
      masterProducts,
      master_products,
      products,
      produk,
      dbData,
    });
  }, [masterProducts, master_products, products, produk, dbData]);

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
      rawSalesRows,
      rawCustomerRows,
      rawProductRows,
      rawBranchRows,
      rawWarehouseRows,
      rawInventoryLayerRows,
    });
  }, [
    dbData,
    rawSalesRows,
    rawCustomerRows,
    rawProductRows,
    rawBranchRows,
    rawWarehouseRows,
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

  const customerRecords = useMemo(() => {
    const result = masterDataApi.getCustomers?.(masterSource, {
      includeInactive: true,
      includeDeleted: true,
      validate: false,
    }) || { records: [] };

    return (result.records || [])
      .map(normalizeCustomerDisplay)
      .filter((customer) => !customer.isDeleted)
      .sort((a, b) => String(a.customer_name).localeCompare(String(b.customer_name)));
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

  const salesRecords = useMemo(() => {
    return rawSalesRows
      .map(normalizeSalesRecord)
      .sort((a, b) => {
        const dateCompare = String(b.sales_date || '').localeCompare(String(a.sales_date || ''));
        if (dateCompare !== 0) return dateCompare;
        return String(b.sales_id || '').localeCompare(String(a.sales_id || ''));
      });
  }, [rawSalesRows]);

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

  const activeCustomersByBranch = useMemo(() => {
    return customerRecords.filter((customer) => {
      if (customer.status !== 'ACTIVE') return false;
      if (!form.branch_id) return true;
      return customer.branch_id === form.branch_id;
    });
  }, [customerRecords, form.branch_id]);

  const activeProductsByBranch = useMemo(() => {
    return productRecords.filter((product) => {
      if (product.status !== 'ACTIVE') return false;
      if (!product.is_sellable) return false;
      if (!form.branch_id) return true;
      return product.branch_id === form.branch_id;
    });
  }, [productRecords, form.branch_id]);

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

  const customerNameById = useMemo(() => {
    const map = new Map();

    customerRecords.forEach((customer) => {
      map.set(customer.customer_id, customer.customer_name || customer.customer_id);
      map.set(customer.customer_code, customer.customer_name || customer.customer_id);
    });

    return map;
  }, [customerRecords]);

  const productNameById = useMemo(() => {
    const map = new Map();

    productRecords.forEach((product) => {
      map.set(product.product_id, product.product_name || product.product_id);
      map.set(product.product_code, product.product_name || product.product_id);
    });

    return map;
  }, [productRecords]);

  const filteredSales = useMemo(() => {
    const keyword = normalizeText(searchQuery);

    return salesRecords.filter((sale) => {
      const branchOk = effectiveBranchFilter === 'ALL' || sale.branch_id === effectiveBranchFilter;
      const channelOk = channelFilter === 'ALL' || sale.sales_channel === channelFilter;
      const statusOk = statusFilter === 'ALL' || sale.order_status === statusFilter;

      const dateOk = (!dateFromFilter || sale.sales_date >= dateFromFilter) &&
        (!dateToFilter || sale.sales_date <= dateToFilter);

      const searchOk = !keyword || sale.search_text.includes(keyword);

      return branchOk && channelOk && statusOk && dateOk && searchOk;
    });
  }, [
    salesRecords,
    effectiveBranchFilter,
    channelFilter,
    statusFilter,
    dateFromFilter,
    dateToFilter,
    searchQuery,
  ]);

  const draftSummary = useMemo(() => {
    return calculateDraftSummary(salesLines, form);
  }, [salesLines, form]);

  const analytics = useMemo(() => {
    const scoped = salesRecords.filter((sale) => {
      if (sale.order_status === 'VOID' || sale.order_status === 'CANCELLED') return false;
      if (effectiveBranchFilter === 'ALL') return true;
      return sale.branch_id === effectiveBranchFilter;
    });

    const completed = scoped.filter((sale) => sale.order_status === 'COMPLETED');

    const totalOmzet = completed.reduce((sum, sale) => sum + toNumber(sale.total_amount), 0);
    const totalProfit = completed.reduce((sum, sale) => sum + toNumber(sale.actual_profit), 0);

    const productMap = new Map();
    const customerMap = new Map();
    const channelMap = new Map();

    completed.forEach((sale) => {
      safeArray(sale.sales_items).forEach((line) => {
        const productKey = line.product_id || line.product_name || 'UNKNOWN';

        if (!productMap.has(productKey)) {
          productMap.set(productKey, {
            product_id: line.product_id,
            product_name: line.product_name || productNameById.get(line.product_id) || productKey,
            total_qty: 0,
            total_omzet: 0,
          });
        }

        const productRow = productMap.get(productKey);
        productRow.total_qty += toNumber(line.qty);
        productRow.total_omzet += toNumber(line.subtotal);
      });

      const customerKey = sale.customer_id || sale.customer_name || 'UNKNOWN';

      if (!customerMap.has(customerKey)) {
        customerMap.set(customerKey, {
          customer_id: sale.customer_id,
          customer_name: sale.customer_name || customerNameById.get(sale.customer_id) || customerKey,
          total_omzet: 0,
          total_transactions: 0,
        });
      }

      const customerRow = customerMap.get(customerKey);
      customerRow.total_omzet += toNumber(sale.total_amount);
      customerRow.total_transactions += 1;

      const channelKey = sale.sales_channel || 'UNKNOWN';

      if (!channelMap.has(channelKey)) {
        channelMap.set(channelKey, {
          sales_channel: channelKey,
          total_omzet: 0,
          total_transactions: 0,
        });
      }

      const channelRow = channelMap.get(channelKey);
      channelRow.total_omzet += toNumber(sale.total_amount);
      channelRow.total_transactions += 1;
    });

    const topProduct = Array.from(productMap.values())
      .sort((a, b) => b.total_omzet - a.total_omzet)[0] || null;

    const topCustomer = Array.from(customerMap.values())
      .sort((a, b) => b.total_omzet - a.total_omzet)[0] || null;

    const topChannel = Array.from(channelMap.values())
      .sort((a, b) => b.total_omzet - a.total_omzet)[0] || null;

    return {
      total_penjualan: completed.length,
      omzet: roundMoney(totalOmzet),
      profit: roundMoney(totalProfit),
      total_transaksi: completed.length,
      draft_count: scoped.filter((sale) => sale.order_status === 'DRAFT').length,
      confirmed_count: scoped.filter((sale) => sale.order_status === 'CONFIRMED').length,
      void_count: salesRecords.filter((sale) => sale.order_status === 'VOID').length,
      top_produk: topProduct,
      top_customer: topCustomer,
      top_channel: topChannel,
    };
  }, [salesRecords, effectiveBranchFilter, productNameById, customerNameById]);

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
      sales_date: todayStr,
      branch_id: isOwnerMode ? '' : userBranchId,
    });
    setSalesLines([]);
    setLineForm(DEFAULT_LINE_FORM);
    setEditingLineId('');
    setIsEditingDraft(false);
    setSelectedSales(null);
  };

  const handleGenerateId = () => {
    const newId = generateId('SAL', todayStr);

    setForm((prev) => ({
      ...prev,
      id: prev.id || newId,
      sales_id: prev.sales_id || newId,
      sales_code: prev.sales_code || newId,
    }));
  };

  const handleBranchChange = (branchId) => {
    setForm((prev) => ({
      ...prev,
      branch_id: branchId,
      warehouse_id: '',
      customer_id: '',
      customer_name: '',
    }));
    setSalesLines([]);
    setLineForm(DEFAULT_LINE_FORM);
    setEditingLineId('');
  };

  const handleCustomerChange = (customerId) => {
    const customer = customerRecords.find((item) => item.customer_id === customerId);
    const paymentMethod = customer?.customer_type && ['RESELLER', 'AGENT', 'AGEN', 'DISTRIBUTOR', 'FRANCHISE'].includes(customer.customer_type)
      ? 'PIUTANG'
      : form.payment_method;

    setForm((prev) => ({
      ...prev,
      customer_id: customerId,
      customer_name: customer?.customer_name || '',
      payment_method: paymentMethod,
      payment_status: paymentMethod === 'PIUTANG' ? 'UNPAID' : prev.payment_status,
    }));
  };

  const handlePaymentMethodChange = (method) => {
    const nextStatus = method === 'PIUTANG' ? 'UNPAID' : 'PAID';

    setForm((prev) => ({
      ...prev,
      payment_method: method,
      payment_status: nextStatus,
      amount_paid: method === 'PIUTANG' ? '0' : prev.amount_paid,
    }));
  };

  const recalculateLineSubtotal = (lineInput) => {
    const qty = toNumber(lineInput.qty);
    const sellingPrice = toNumber(lineInput.selling_price);
    const discount = toNumber(lineInput.discount);

    return {
      ...lineInput,
      subtotal: String(roundMoney(Math.max(qty * sellingPrice - discount, 0))),
    };
  };

  const handleProductChange = (productId) => {
    const product = productRecords.find((item) => item.product_id === productId);

    setLineForm((prev) => recalculateLineSubtotal({
      ...prev,
      product_id: productId,
      product_name: product?.product_name || '',
      unit: product?.selling_unit || prev.unit || 'PCS',
      selling_price: product?.selling_price ? String(product.selling_price) : prev.selling_price,
    }));

    if (!form.warehouse_id && product?.default_warehouse_id) {
      setForm((prev) => ({
        ...prev,
        warehouse_id: product.default_warehouse_id,
      }));
    }
  };

  const validateLine = (lineInput) => {
    const warnings = [];

    if (!lineInput.product_id.trim()) warnings.push('Produk wajib dipilih.');
    if (!lineInput.product_name.trim()) warnings.push('Nama produk wajib terisi.');
    if (toNumber(lineInput.qty) <= 0) warnings.push('Qty wajib lebih dari 0.');
    if (!lineInput.unit.trim()) warnings.push('Unit wajib diisi.');
    if (toNumber(lineInput.selling_price) < 0) warnings.push('Selling price tidak boleh negatif.');
    if (toNumber(lineInput.discount) < 0) warnings.push('Discount tidak boleh negatif.');

    const productExists = productRecords.some((product) => {
      return product.product_id === lineInput.product_id &&
        product.branch_id === form.branch_id &&
        product.status === 'ACTIVE' &&
        product.is_sellable &&
        !product.isDeleted;
    });

    if (lineInput.product_id && !productExists) {
      warnings.push('Produk tidak ditemukan, tidak aktif, atau tidak sellable di cabang yang dipilih.');
    }

    return warnings;
  };

  const handleAddOrUpdateLine = () => {
    const warnings = validateLine(lineForm);

    if (warnings.length > 0) {
      notify(warnings.join('\n'), 'error');
      return;
    }

    const normalizedLine = normalizeSalesLine({
      ...lineForm,
      line_id: editingLineId || lineForm.line_id || generateId('SAL-LINE', todayStr),
    });

    if (editingLineId) {
      setSalesLines((prev) => prev.map((line) => (
        line.line_id === editingLineId ? normalizedLine : line
      )));
      setEditingLineId('');
    } else {
      setSalesLines((prev) => [...prev, normalizedLine]);
    }

    setLineForm(DEFAULT_LINE_FORM);
  };

  const handleEditLine = (line) => {
    setEditingLineId(line.line_id);
    setLineForm({
      line_id: line.line_id,
      product_id: line.product_id,
      product_name: line.product_name,
      qty: String(line.qty),
      unit: line.unit,
      selling_price: String(line.selling_price),
      subtotal: String(line.subtotal),
      discount: String(line.discount || ''),
      notes: line.notes || '',
    });
  };

  const handleRemoveLine = (lineId) => {
    setSalesLines((prev) => prev.filter((line) => line.line_id !== lineId));

    if (editingLineId === lineId) {
      setEditingLineId('');
      setLineForm(DEFAULT_LINE_FORM);
    }
  };

  const validateSalesForm = ({ action = 'DRAFT' } = {}) => {
    const warnings = [];

    if (!form.sales_id.trim()) warnings.push('Sales ID wajib diisi.');
    if (!form.sales_code.trim()) warnings.push('Sales Code wajib diisi.');
    if (!form.sales_date.trim()) warnings.push('Tanggal penjualan wajib diisi.');
    if (!form.customer_id.trim()) warnings.push('Customer wajib dipilih.');
    if (!form.customer_name.trim()) warnings.push('Nama customer wajib terisi.');
    if (!form.sales_channel.trim()) warnings.push('Sales channel wajib dipilih.');
    if (!form.branch_id.trim()) warnings.push('Branch ID wajib dipilih.');
    if (!form.warehouse_id.trim()) warnings.push('Warehouse ID wajib dipilih.');
    if (!form.payment_method.trim()) warnings.push('Payment method wajib dipilih.');
    if (!form.payment_status.trim()) warnings.push('Payment status wajib dipilih.');
    if (salesLines.length === 0) warnings.push('Detail penjualan wajib minimal 1 item.');

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

    const customerExists = customerRecords.some((customer) => {
      return customer.customer_id === form.customer_id &&
        customer.branch_id === form.branch_id &&
        customer.status === 'ACTIVE' &&
        !customer.isDeleted;
    });

    if (form.customer_id && !customerExists) {
      warnings.push('Customer tidak ditemukan atau tidak aktif di cabang yang dipilih.');
    }

    salesLines.forEach((line) => {
      warnings.push(...validateLine({
        ...line,
        qty: String(line.qty),
        selling_price: String(line.selling_price),
        discount: String(line.discount),
      }));
    });

    if (form.payment_method === 'PIUTANG' && form.payment_status === 'PAID') {
      warnings.push('Payment method PIUTANG tidak boleh langsung PAID.');
    }

    if (action === 'COMPLETE' && draftSummary.total_amount <= 0) {
      warnings.push('Total penjualan wajib lebih dari 0 saat complete.');
    }

    if (!isOwnerMode && userBranchId && form.branch_id !== userBranchId) {
      warnings.push('User cabang hanya boleh membuat penjualan di branch miliknya.');
    }

    return warnings;
  };

  const persistSales = async (action, payload) => {
    if (typeof sendToSheet !== 'function') {
      notify('sendToSheet belum tersedia. Data penjualan belum bisa disimpan ke cloud.', 'error');
      return false;
    }

    let isSuccess = false;

    try {
      isSuccess = await sendToSheet(action, SALES_TABLE_NAME, payload);
    } catch (error) {
      isSuccess = false;
    }

    if (!isSuccess) {
      try {
        isSuccess = await sendToSheet(action, payload, SALES_TABLE_NAME);
      } catch (error) {
        isSuccess = false;
      }
    }

    return Boolean(isSuccess);
  };

  const runProcessSales = async ({ mode }) => {
    if (!erpOrchestrator || typeof erpOrchestrator.processSales !== 'function') {
      return {
        ok: false,
        message: 'erpOrchestrator.processSales() belum tersedia. Revisi harus dilakukan di src/services/erpOrchestrator.js.',
      };
    }

    const summary = calculateDraftSummary(salesLines, form);
    const command = createSalesCommand({
      form,
      lines: salesLines,
      summary,
      mode,
      executor,
      masterSource,
    });

    try {
      const result = await Promise.resolve(
        erpOrchestrator.processSales(command, {
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
          message: result.message || result.error || 'erpOrchestrator.processSales() mengembalikan status tidak OK.',
        };
      }

      const packageResult = normalizeSalesPackageFromOrchestrator(result);

      if (mode === 'COMPLETE') {
        const missing = validateCompletedOrchestratorPackage(packageResult);

        if (missing.length > 0) {
          return {
            ok: false,
            message: `Package orchestrator sales belum lengkap: ${missing.join(', ')}. Revisi alur di src/services/erpOrchestrator.js, bukan di UI.`,
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
        message: error.message || 'erpOrchestrator.processSales() gagal dijalankan.',
      };
    }
  };

  const createLocalPayload = ({
    status,
    packageResult = null,
    voidPackageResult = null,
  }) => {
    const summary = calculateDraftSummary(salesLines, form);
    const normalizedLines = salesLines.map(normalizeSalesLine);

    const profitFromPackage = roundMoney(
      packageResult?.profit_package?.actual_profit ||
      packageResult?.profit_package?.total_profit ||
      packageResult?.profit_package?.gross_profit ||
      packageResult?.profit_package?.net_profit ||
      selectedSales?.raw?.actual_profit ||
      0,
    );

    return {
      ...(selectedSales?.raw || {}),

      id: selectedSales?.id || form.sales_id,
      date: selectedSales?.raw?.date || todayStr,

      sales_id: form.sales_id,
      sales_code: form.sales_code,
      sales_date: form.sales_date,

      customer_id: form.customer_id,
      customer_name: form.customer_name,

      sales_channel: form.sales_channel,

      branch_id: form.branch_id,
      warehouse_id: form.warehouse_id,

      payment_method: form.payment_method,
      payment_status: summary.payment_status,
      order_status: status,
      status,

      notes: form.notes,

      amount_paid: summary.amount_paid,
      total_amount: summary.total_amount,
      total_discount: summary.total_discount,
      remaining_amount: summary.remaining_amount,

      sales_items: normalizedLines,
      sales_items_json: JSON.stringify(normalizedLines),
      order_items: normalizedLines,
      order_items_json: JSON.stringify(normalizedLines),

      sales_transaction_package: packageResult?.sales_transaction_package || selectedSales?.raw?.sales_transaction_package || null,
      sales_transaction_package_json: packageResult?.sales_transaction_package ? JSON.stringify(packageResult.sales_transaction_package) : selectedSales?.raw?.sales_transaction_package_json || '',

      inventory_consumption_package: packageResult?.inventory_consumption_package || selectedSales?.raw?.inventory_consumption_package || null,
      inventory_consumption_package_json: packageResult?.inventory_consumption_package ? JSON.stringify(packageResult.inventory_consumption_package) : selectedSales?.raw?.inventory_consumption_package_json || '',

      hpp_package: packageResult?.hpp_package || selectedSales?.raw?.hpp_package || null,
      hpp_package_json: packageResult?.hpp_package ? JSON.stringify(packageResult.hpp_package) : selectedSales?.raw?.hpp_package_json || '',

      profit_package: packageResult?.profit_package || selectedSales?.raw?.profit_package || null,
      profit_package_json: packageResult?.profit_package ? JSON.stringify(packageResult.profit_package) : selectedSales?.raw?.profit_package_json || '',

      accounting_package: packageResult?.accounting_package || selectedSales?.raw?.accounting_package || null,
      accounting_package_json: packageResult?.accounting_package ? JSON.stringify(packageResult.accounting_package) : selectedSales?.raw?.accounting_package_json || '',

      snapshot_package: packageResult?.snapshot_package || voidPackageResult?.snapshot_package || selectedSales?.raw?.snapshot_package || null,
      snapshot_package_json: packageResult?.snapshot_package
        ? JSON.stringify(packageResult.snapshot_package)
        : voidPackageResult?.snapshot_package
          ? JSON.stringify(voidPackageResult.snapshot_package)
          : selectedSales?.raw?.snapshot_package_json || '',

      reversal_package: voidPackageResult?.reversal_package || selectedSales?.raw?.reversal_package || null,
      reversal_package_json: voidPackageResult?.reversal_package ? JSON.stringify(voidPackageResult.reversal_package) : selectedSales?.raw?.reversal_package_json || '',

      actual_profit: profitFromPackage,

      orchestrator_response_json: packageResult?.raw_orchestrator_response
        ? JSON.stringify(packageResult.raw_orchestrator_response)
        : voidPackageResult?.raw_orchestrator_response
          ? JSON.stringify(voidPackageResult.raw_orchestrator_response)
          : selectedSales?.raw?.orchestrator_response_json || '',

      engine_warnings_json: packageResult?.warnings
        ? JSON.stringify(packageResult.warnings)
        : voidPackageResult?.warnings
          ? JSON.stringify(voidPackageResult.warnings)
          : selectedSales?.raw?.engine_warnings_json || '',

      created_at: selectedSales?.raw?.created_at || new Date().toISOString(),
      created_by: selectedSales?.raw?.created_by || executor,
      updated_at: new Date().toISOString(),
      updated_by: executor,

      confirmed_at: status === 'CONFIRMED' ? selectedSales?.raw?.confirmed_at || new Date().toISOString() : selectedSales?.raw?.confirmed_at || '',
      confirmed_by: status === 'CONFIRMED' ? selectedSales?.raw?.confirmed_by || executor : selectedSales?.raw?.confirmed_by || '',

      completed_at: status === 'COMPLETED' ? selectedSales?.raw?.completed_at || new Date().toISOString() : selectedSales?.raw?.completed_at || '',
      completed_by: status === 'COMPLETED' ? selectedSales?.raw?.completed_by || executor : selectedSales?.raw?.completed_by || '',

      voided_at: status === 'VOID' ? new Date().toISOString() : selectedSales?.raw?.voided_at || '',
      voided_by: status === 'VOID' ? executor : selectedSales?.raw?.voided_by || '',
    };
  };

  const handleSaveDraft = async () => {
    const warnings = validateSalesForm({ action: 'DRAFT' });

    if (warnings.length > 0) {
      notify(warnings.join('\n'), 'error');
      return;
    }

    const orchestratorResult = await runProcessSales({ mode: 'DRAFT' });

    if (!orchestratorResult.ok) {
      notify(orchestratorResult.message, 'error');
      return;
    }

    const payload = createLocalPayload({
      status: 'DRAFT',
      packageResult: orchestratorResult.packageResult,
    });

    const action = isEditingDraft ? 'update' : 'insert';
    const isSuccess = await persistSales(action, payload);

    if (isSuccess) {
      notify(isEditingDraft ? 'Draft penjualan berhasil diperbarui.' : 'Draft penjualan berhasil dibuat.', 'success');
      resetForm();
    }
  };

  const handleConfirmSales = async () => {
    const warnings = validateSalesForm({ action: 'CONFIRM' });

    if (warnings.length > 0) {
      notify(warnings.join('\n'), 'error');
      return;
    }

    const confirmed = window.confirm('Konfirmasi transaksi penjualan? Status akan menjadi CONFIRMED.');

    if (!confirmed) return;

    const orchestratorResult = await runProcessSales({ mode: 'CONFIRM' });

    if (!orchestratorResult.ok) {
      notify(orchestratorResult.message, 'error');
      return;
    }

    const payload = createLocalPayload({
      status: 'CONFIRMED',
      packageResult: orchestratorResult.packageResult,
    });

    const action = isEditingDraft ? 'update' : 'insert';
    const isSuccess = await persistSales(action, payload);

    if (isSuccess) {
      notify('Penjualan berhasil dikonfirmasi melalui erpOrchestrator.', 'success');
      resetForm();
    }
  };

  const handleCompleteSales = async () => {
    const warnings = validateSalesForm({ action: 'COMPLETE' });

    if (warnings.length > 0) {
      notify(warnings.join('\n'), 'error');
      return;
    }

    const confirmed = window.confirm(
      'Complete transaksi penjualan? Orchestrator akan consume Finished Goods FIFO, hitung HPP aktual, hitung profit, buat jurnal, dan snapshot.',
    );

    if (!confirmed) return;

    const orchestratorResult = await runProcessSales({ mode: 'COMPLETE' });

    if (!orchestratorResult.ok) {
      notify(orchestratorResult.message, 'error');
      return;
    }

    const payload = createLocalPayload({
      status: 'COMPLETED',
      packageResult: orchestratorResult.packageResult,
    });

    const action = isEditingDraft ? 'update' : 'insert';
    const isSuccess = await persistSales(action, payload);

    if (isSuccess) {
      notify('Penjualan berhasil completed melalui erpOrchestrator. FIFO, HPP, profit, jurnal, dan snapshot dibuat oleh orchestrator.', 'success');
      resetForm();
    }
  };

  const handleEditDraft = (sale) => {
    if (sale.order_status !== 'DRAFT') {
      notify('Hanya transaksi DRAFT yang boleh diedit.', 'error');
      return;
    }

    setSelectedSales(sale);
    setIsEditingDraft(true);

    setForm({
      id: sale.id || sale.sales_id,
      sales_id: sale.sales_id,
      sales_code: sale.sales_code,
      sales_date: sale.sales_date || todayStr,
      customer_id: sale.customer_id,
      customer_name: sale.customer_name,
      sales_channel: sale.sales_channel || 'OFFLINE_RESTO',
      branch_id: sale.branch_id,
      warehouse_id: sale.warehouse_id,
      payment_method: sale.payment_method || 'CASH',
      payment_status: sale.payment_status || 'PAID',
      order_status: 'DRAFT',
      notes: sale.notes || '',
      amount_paid: String(sale.amount_paid || ''),
    });

    setSalesLines((sale.sales_items || []).map(normalizeSalesLine));
    setLineForm(DEFAULT_LINE_FORM);
    setEditingLineId('');
  };

  const handleCloneSales = (sale) => {
    const newId = generateId('SAL', todayStr);

    setSelectedSales(null);
    setIsEditingDraft(false);

    setForm({
      id: newId,
      sales_id: newId,
      sales_code: `${normalizeCode(sale.sales_code || sale.sales_id)}-CLONE`,
      sales_date: todayStr,
      customer_id: sale.customer_id,
      customer_name: sale.customer_name,
      sales_channel: sale.sales_channel || 'OFFLINE_RESTO',
      branch_id: sale.branch_id,
      warehouse_id: sale.warehouse_id,
      payment_method: sale.payment_method || 'CASH',
      payment_status: sale.payment_status || 'PAID',
      order_status: 'DRAFT',
      notes: sale.notes || '',
      amount_paid: '',
    });

    setSalesLines((sale.sales_items || []).map((line, index) => ({
      ...normalizeSalesLine(line, index),
      line_id: generateId(`SAL-CLONE-L${index + 1}`, todayStr),
    })));
    setLineForm(DEFAULT_LINE_FORM);
    setEditingLineId('');
  };

  const runProcessVoidTransaction = async (sale) => {
    if (!erpOrchestrator || typeof erpOrchestrator.processVoidTransaction !== 'function') {
      return {
        ok: false,
        message: 'erpOrchestrator.processVoidTransaction() belum tersedia. Revisi harus dilakukan di src/services/erpOrchestrator.js.',
      };
    }

    try {
      const result = await Promise.resolve(
        erpOrchestrator.processVoidTransaction({
          transaction_type: 'SALES',
          transaction_id: sale.sales_id,
          transaction_code: sale.sales_code,
          branch_id: sale.branch_id,
          original_transaction: sale.raw,
          reason: 'VOID_SALES_FROM_UI',
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

  const handleVoidSales = async (sale) => {
    if (!['CONFIRMED', 'COMPLETED'].includes(sale.order_status)) {
      notify('Hanya transaksi CONFIRMED atau COMPLETED yang bisa di-void.', 'error');
      return;
    }

    const confirmed = window.confirm(
      `Void penjualan ${sale.sales_code || sale.sales_id}? Histori tidak dihapus, orchestrator akan membuat reversal package.`,
    );

    if (!confirmed) return;

    const voidResult = await runProcessVoidTransaction(sale);

    if (!voidResult.ok) {
      notify(voidResult.message, 'error');
      return;
    }

    const payload = {
      ...(sale.raw || {}),
      id: sale.id || sale.sales_id,
      sales_id: sale.sales_id,
      order_status: 'VOID',
      status: 'VOID',
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

    const isSuccess = await persistSales('update', payload);

    if (isSuccess) {
      notify('Penjualan berhasil di-void melalui erpOrchestrator. Reversal package dibuat oleh orchestrator.', 'success');
      if (selectedSales?.sales_id === sale.sales_id) resetForm();
    }
  };

  const handleCancelDraft = async (sale) => {
    if (sale.order_status !== 'DRAFT') {
      notify('Hanya DRAFT yang bisa dibatalkan langsung.', 'error');
      return;
    }

    const confirmed = window.confirm(`Batalkan draft penjualan ${sale.sales_code || sale.sales_id}?`);

    if (!confirmed) return;

    const payload = {
      ...(sale.raw || {}),
      id: sale.id || sale.sales_id,
      sales_id: sale.sales_id,
      order_status: 'CANCELLED',
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
      cancelled_by: executor,
      updated_at: new Date().toISOString(),
      updated_by: executor,
    };

    const isSuccess = await persistSales('update', payload);

    if (isSuccess) {
      notify('Draft penjualan berhasil dibatalkan.', 'success');
      if (selectedSales?.sales_id === sale.sales_id) resetForm();
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
                <ShoppingBag size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                Modul Sales ERP
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              Penjualan Resmi Dimsum Aditya
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-300">
              Thin UI sales. Semua FIFO Finished Goods, HPP aktual, profit, jurnal, dan snapshot wajib dibuat oleh erpOrchestrator.
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
        <StatCard title="Omzet" value={formatMoney(analytics.omzet)} icon={<ReceiptText size={18} />} tone="red" />
        <StatCard title="Profit" value={formatMoney(analytics.profit)} icon={<TrendingUp size={18} />} tone="white" />
        <StatCard title="Transaksi" value={analytics.total_transaksi} icon={<CheckCircle size={18} />} tone="gold" />
        <StatCard title="Draft / Confirmed" value={`${analytics.draft_count} / ${analytics.confirmed_count}`} icon={<History size={18} />} tone="white" />
        <StatCard title="Void" value={analytics.void_count} icon={<Undo2 size={18} />} tone="dark" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-red-50 p-3 text-red-600">
              <Crown size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Top Produk</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.top_produk?.product_name || '-'}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                {formatMoney(analytics.top_produk?.total_omzet || 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
              <UserRound size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Top Customer</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.top_customer?.customer_name || '-'}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                {formatMoney(analytics.top_customer?.total_omzet || 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <Store size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Top Channel</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.top_channel?.sales_channel || '-'}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                {formatMoney(analytics.top_channel?.total_omzet || 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {draftSummary.remaining_amount > 0 && (
        <div className="rounded-[2rem] border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-3 text-amber-700 shadow-sm">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black text-amber-900">PIUTANG PREVIEW</h2>
                <p className="mt-1 text-xs font-bold text-amber-700">
                  Draft form saat ini memiliki sisa pembayaran {formatMoney(draftSummary.remaining_amount)}.
                </p>
              </div>
            </div>
            <Badge tone="amber">Receivable Monitoring</Badge>
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
                  {isEditingDraft ? 'Edit Draft Penjualan' : 'Tambah Penjualan'}
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
                <Field label="Sales ID" required>
                  <div className="flex gap-2">
                    <input
                      disabled={isEditingDraft}
                      value={form.sales_id}
                      onChange={(event) => setForm({ ...form, sales_id: normalizeCode(event.target.value), id: normalizeCode(event.target.value) })}
                      className={inputClass}
                      placeholder="SAL-001"
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

                <Field label="Sales Code" required>
                  <input
                    value={form.sales_code}
                    onChange={(event) => setForm({ ...form, sales_code: normalizeCode(event.target.value) })}
                    className={inputClass}
                    placeholder="SAL-RESTO-001"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Tanggal" required>
                  <input
                    type="date"
                    value={form.sales_date}
                    onChange={(event) => setForm({ ...form, sales_date: event.target.value })}
                    className={inputClass}
                  />
                </Field>

                <Field label="Status">
                  <input
                    disabled
                    value={form.order_status}
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

              <Field label="Warehouse Finished Goods" required>
                <select
                  value={form.warehouse_id}
                  onChange={(event) => setForm({ ...form, warehouse_id: event.target.value })}
                  className={inputClass}
                >
                  <option value="">Pilih gudang penjualan</option>
                  {activeWarehousesByBranch.map((warehouse) => (
                    <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                      {warehouse.warehouse_name} — {warehouse.warehouse_id}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Customer" required>
                <select
                  value={form.customer_id}
                  onChange={(event) => handleCustomerChange(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Pilih customer resmi</option>
                  {activeCustomersByBranch.map((customer) => (
                    <option key={customer.customer_id} value={customer.customer_id}>
                      {customer.customer_name} — {customer.customer_type}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Sales Channel" required>
                <select
                  value={form.sales_channel}
                  onChange={(event) => setForm({ ...form, sales_channel: event.target.value })}
                  className={inputClass}
                >
                  {SALES_CHANNELS.map((channel) => (
                    <option key={channel} value={channel}>{channel}</option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Payment Method" required>
                  <select
                    value={form.payment_method}
                    onChange={(event) => handlePaymentMethodChange(event.target.value)}
                    className={inputClass}
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Payment Status" required>
                  <select
                    value={form.payment_status}
                    onChange={(event) => setForm({ ...form, payment_status: event.target.value })}
                    className={inputClass}
                  >
                    {PAYMENT_STATUS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {form.payment_status === 'PARTIAL' && (
                <Field label="Amount Paid">
                  <input
                    value={form.amount_paid}
                    onChange={(event) => setForm({ ...form, amount_paid: event.target.value })}
                    className={inputClass}
                    placeholder="0"
                  />
                </Field>
              )}

              <Field label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Catatan penjualan..."
                />
              </Field>

              <div className="rounded-[2rem] border border-slate-100 bg-slate-50/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black text-slate-900">Detail Penjualan</div>
                    <div className="text-[11px] font-semibold text-slate-400">Produk wajib dari Master Produk resmi.</div>
                  </div>
                  <Badge tone="amber">{salesLines.length} item</Badge>
                </div>

                <div className="space-y-3">
                  <Field label="Produk" required>
                    <select
                      value={lineForm.product_id}
                      onChange={(event) => handleProductChange(event.target.value)}
                      className={inputClass}
                    >
                      <option value="">Pilih produk sellable</option>
                      {activeProductsByBranch.map((product) => (
                        <option key={product.product_id} value={product.product_id}>
                          {product.product_name} — {formatMoney(product.selling_price)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Field label="Qty" required>
                      <input
                        value={lineForm.qty}
                        onChange={(event) => setLineForm(recalculateLineSubtotal({ ...lineForm, qty: event.target.value }))}
                        className={inputClass}
                        placeholder="1"
                      />
                    </Field>

                    <Field label="Unit" required>
                      <input
                        value={lineForm.unit}
                        onChange={(event) => setLineForm({ ...lineForm, unit: normalizeCode(event.target.value) })}
                        className={inputClass}
                        placeholder="PCS"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Field label="Selling Price" required>
                      <input
                        value={lineForm.selling_price}
                        onChange={(event) => setLineForm(recalculateLineSubtotal({ ...lineForm, selling_price: event.target.value }))}
                        className={inputClass}
                        placeholder="15000"
                      />
                    </Field>

                    <Field label="Discount">
                      <input
                        value={lineForm.discount}
                        onChange={(event) => setLineForm(recalculateLineSubtotal({ ...lineForm, discount: event.target.value }))}
                        className={inputClass}
                        placeholder="0"
                      />
                    </Field>
                  </div>

                  <Field label="Subtotal">
                    <input
                      value={lineForm.subtotal}
                      onChange={(event) => setLineForm({ ...lineForm, subtotal: event.target.value })}
                      className={inputClass}
                      placeholder="0"
                    />
                  </Field>

                  <Field label="Notes Item">
                    <input
                      value={lineForm.notes}
                      onChange={(event) => setLineForm({ ...lineForm, notes: event.target.value })}
                      className={inputClass}
                      placeholder="Catatan item..."
                    />
                  </Field>

                  <button
                    type="button"
                    onClick={handleAddOrUpdateLine}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-red-700 transition-all hover:bg-red-100"
                  >
                    <Plus size={15} />
                    {editingLineId ? 'Update Item' : 'Tambah Item'}
                  </button>
                </div>
              </div>

              {salesLines.length > 0 && (
                <div className="rounded-[2rem] border border-slate-100 bg-white">
                  <div className="border-b border-slate-100 p-4">
                    <div className="text-xs font-black text-slate-900">Item Draft</div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {salesLines.map((line) => (
                      <div key={line.line_id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-black text-slate-900">{line.product_name}</div>
                            <div className="mt-1 text-[11px] font-bold text-slate-400">
                              {formatQty(line.qty, line.unit)} × {formatMoney(line.selling_price)}
                            </div>
                            <div className="mt-1 text-xs font-black text-slate-900">
                              {formatMoney(line.subtotal)}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditLine(line)}
                              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(line.line_id)}
                              className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-[2rem] border border-amber-100 bg-amber-50 p-4">
                <div className="grid grid-cols-2 gap-3 text-[11px] font-bold">
                  <div className="text-amber-700">Total Omzet</div>
                  <div className="text-right text-amber-950">{formatMoney(draftSummary.total_amount)}</div>

                  <div className="text-amber-700">Discount</div>
                  <div className="text-right text-amber-950">{formatMoney(draftSummary.total_discount)}</div>

                  <div className="text-amber-700">Amount Paid</div>
                  <div className="text-right text-amber-950">{formatMoney(draftSummary.amount_paid)}</div>

                  <div className="text-amber-700">Sisa Piutang</div>
                  <div className="text-right text-amber-950">{formatMoney(draftSummary.remaining_amount)}</div>
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
                  onClick={handleConfirmSales}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-amber-700 shadow-sm transition-all hover:bg-amber-100"
                >
                  <Send size={16} />
                  Confirm
                </button>

                <button
                  type="button"
                  onClick={handleCompleteSales}
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
                    Daftar Penjualan Resmi
                  </h2>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    Data sales terkunci: DRAFT editable, COMPLETED locked, VOID reversal.
                  </p>
                </div>

                <div className="flex flex-col gap-2 2xl:flex-row">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-xs font-bold outline-none transition-all placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50 md:w-64"
                      placeholder="Cari sales, customer, produk..."
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
                        {ORDER_STATUS.map((status) => (
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
                      value={channelFilter}
                      onChange={(event) => setChannelFilter(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none focus:border-red-500"
                    >
                      <option value="ALL">SEMUA CHANNEL</option>
                      {SALES_CHANNELS.map((channel) => (
                        <option key={channel} value={channel}>{channel}</option>
                      ))}
                    </select>

                    <input
                      type="date"
                      value={dateFromFilter}
                      onChange={(event) => setDateFromFilter(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none focus:border-red-500"
                    />

                    <input
                      type="date"
                      value={dateToFilter}
                      onChange={(event) => setDateToFilter(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none focus:border-red-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1600px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Sales</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Customer</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Channel</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cabang / Gudang</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Payment</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Total</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Items</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Status</th>
                    <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSales.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-5 py-14 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-red-50 text-red-600">
                          <ShoppingBag size={24} />
                        </div>
                        <div className="mt-3 text-sm font-black text-slate-800">Transaksi penjualan tidak ditemukan</div>
                        <div className="mt-1 text-xs font-semibold text-slate-400">
                          Ubah filter atau buat penjualan baru.
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredSales.map((sale) => {
                    const isDraft = sale.order_status === 'DRAFT';
                    const isConfirmed = sale.order_status === 'CONFIRMED';
                    const isCompleted = sale.order_status === 'COMPLETED';
                    const isVoid = sale.order_status === 'VOID';
                    const isCancelled = sale.order_status === 'CANCELLED';

                    const branchName = branchNameById.get(sale.branch_id) || 'Branch tidak ditemukan';
                    const warehouseName = warehouseNameById.get(sale.warehouse_id) || 'Gudang tidak ditemukan';
                    const customerName = customerNameById.get(sale.customer_id) || sale.customer_name || 'Customer tidak ditemukan';

                    return (
                      <tr key={`${sale.sales_id}-${sale.sales_code}`} className="border-b border-slate-100 transition-colors hover:bg-red-50/30">
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                              isCompleted ? 'bg-red-600 text-white' : isConfirmed ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              <ReceiptText size={18} />
                            </div>
                            <div>
                              <div className="font-black text-slate-900">{sale.sales_code || sale.sales_id}</div>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                <Badge tone="slate">{sale.sales_id || '-'}</Badge>
                              </div>
                              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                                <CalendarClock size={12} />
                                {sale.sales_date ? formatDate(sale.sales_date) : '-'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-2">
                            <UserRound size={15} className="mt-0.5 shrink-0 text-slate-400" />
                            <div>
                              <div className="text-xs font-black text-slate-900">{customerName}</div>
                              <div className="mt-1 text-[11px] font-semibold text-slate-400">
                                {sale.customer_id || '-'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex items-center gap-2 text-xs font-black text-slate-900">
                            {getChannelIcon(sale.sales_channel)}
                            {sale.sales_channel || '-'}
                          </div>
                          {['GOFOOD', 'GRABFOOD', 'SHOPEEFOOD', 'TIKTOK'].includes(sale.sales_channel) && (
                            <div className="mt-2">
                              <Badge tone="purple">MERCHANT</Badge>
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="space-y-2 text-[11px] font-bold">
                            <div className="flex items-start gap-2">
                              <Building2 size={14} className="mt-0.5 shrink-0 text-slate-400" />
                              <div>
                                <div className="text-slate-800">{branchName}</div>
                                <div className="text-slate-400">{sale.branch_id || '-'}</div>
                              </div>
                            </div>

                            <div className="flex items-start gap-2">
                              <Warehouse size={14} className="mt-0.5 shrink-0 text-slate-400" />
                              <div>
                                <div className="text-slate-800">{warehouseName}</div>
                                <div className="text-slate-400">{sale.warehouse_id || '-'}</div>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex items-center gap-2 text-xs font-black text-slate-900">
                            {getPaymentIcon(sale.payment_method)}
                            {sale.payment_method || '-'}
                          </div>
                          <div className="mt-2">
                            <Badge tone={sale.payment_status === 'PAID' ? 'green' : sale.payment_status === 'PARTIAL' ? 'amber' : 'red'}>
                              {sale.payment_status || '-'}
                            </Badge>
                          </div>
                          <div className="mt-2 text-[11px] font-bold text-slate-400">
                            Sisa {formatMoney(sale.remaining_amount)}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="text-sm font-black text-slate-900">{formatMoney(sale.total_amount)}</div>
                          <div className="mt-1 text-[11px] font-bold text-emerald-700">
                            Profit {formatMoney(sale.actual_profit)}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-slate-400">
                            Diskon {formatMoney(sale.total_discount)}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="text-sm font-black text-slate-900">
                            {(sale.sales_items || []).length} item
                          </div>
                          <div className="mt-2 space-y-1">
                            {(sale.sales_items || []).slice(0, 3).map((line) => (
                              <div key={line.line_id} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                                <Package size={11} />
                                <span className="max-w-[180px] truncate">{line.product_name}</span>
                              </div>
                            ))}
                            {(sale.sales_items || []).length > 3 && (
                              <div className="text-[11px] font-bold text-slate-400">
                                +{(sale.sales_items || []).length - 3} item lagi
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <Badge tone={isCompleted ? 'green' : isConfirmed ? 'amber' : isVoid ? 'dark' : isDraft ? 'slate' : 'purple'}>
                            {sale.order_status}
                          </Badge>
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                            <History size={12} />
                            {sale.updated_at ? formatDate(sale.updated_at) : sale.sales_date ? formatDate(sale.sales_date) : '-'}
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
                                  onClick={() => handleEditDraft(sale)}
                                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                                  title="Edit draft"
                                >
                                  <Edit2 size={15} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleCancelDraft(sale)}
                                  className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-amber-700 transition-all hover:bg-amber-100"
                                  title="Cancel draft"
                                >
                                  <X size={15} />
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => handleCloneSales(sale)}
                              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-amber-100 hover:bg-amber-50 hover:text-amber-700"
                              title="Clone sales"
                            >
                              <Copy size={15} />
                            </button>

                            {(isConfirmed || isCompleted) && (
                              <button
                                type="button"
                                onClick={() => handleVoidSales(sale)}
                                className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100"
                                title="Void sales"
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
                Menampilkan <span className="text-slate-800">{filteredSales.length}</span> dari <span className="text-slate-800">{salesRecords.length}</span> transaksi penjualan.
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge tone="red">Merah = Completed via Orchestrator</Badge>
                <Badge tone="amber">Gold = Confirmed / Piutang</Badge>
                <Badge tone="dark">Dark = Void / Locked</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
