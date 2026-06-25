import React, { useMemo, useState } from 'react';
import {
  ShoppingCart,
  Plus,
  Save,
  X,
  Edit2,
  Search,
  Filter,
  Building2,
  Warehouse,
  Truck,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  CalendarClock,
  ReceiptText,
  WalletCards,
  Package,
  Scale,
  CreditCard,
  Banknote,
  QrCode,
  History,
  Crown,
  TrendingUp,
  Undo2,
  Send,
  FileText,
} from 'lucide-react';

import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import erpOrchestrator from '../../services/erpOrchestrator';

const PURCHASE_TABLE_NAME = 'purchase_transactions';

const PAYMENT_METHODS = [
  'CASH',
  'TRANSFER',
  'QRIS',
  'HUTANG',
];

const PAYMENT_STATUS = [
  'PAID',
  'PARTIAL',
  'UNPAID',
];

const PURCHASE_STATUS = [
  'DRAFT',
  'POSTED',
  'CANCELLED',
  'VOID',
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
  purchase_id: '',
  purchase_code: '',
  purchase_date: '',
  supplier_id: '',
  supplier_name: '',
  branch_id: '',
  warehouse_id: '',
  payment_method: 'CASH',
  payment_status: 'PAID',
  due_date: '',
  invoice_number: '',
  notes: '',
  status: 'DRAFT',
  amount_paid: '',
};

const DEFAULT_LINE_FORM = {
  line_id: '',
  raw_material_id: '',
  raw_material_name: '',
  qty: '',
  unit: 'KG',
  conversion_rule_id: '',
  unit_price: '',
  subtotal: '',
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

const addDays = (dateValue, days) => {
  const base = dateValue ? new Date(dateValue) : new Date();

  if (Number.isNaN(base.getTime())) return '';

  base.setDate(base.getDate() + toNumber(days));

  return base.toISOString().substring(0, 10);
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

const normalizePurchaseStatus = (row) => {
  const value = row?.status ?? row?.purchase_status ?? row?.transaction_status;

  const normalized = normalizeCode(value || 'DRAFT');

  if (['VOIDED', 'VOID'].includes(normalized)) return 'VOID';
  if (['CANCELLED', 'CANCELED', 'BATAL'].includes(normalized)) return 'CANCELLED';
  if (['POSTED', 'RECEIVED', 'FINAL', 'LOCKED'].includes(normalized)) return 'POSTED';
  if (['DRAFT', 'OPEN'].includes(normalized)) return 'DRAFT';

  return normalized || 'DRAFT';
};

const normalizePaymentStatus = (value, totalAmount = 0, amountPaid = 0) => {
  const normalized = normalizeCode(value || '');

  if (['PAID', 'LUNAS'].includes(normalized)) return 'PAID';
  if (['PARTIAL', 'PARTIAL_PAYMENT', 'SEBAGIAN'].includes(normalized)) return 'PARTIAL';
  if (['UNPAID', 'PAYABLE', 'HUTANG', 'BELUM_BAYAR'].includes(normalized)) return 'UNPAID';

  if (amountPaid >= totalAmount && totalAmount > 0) return 'PAID';
  if (amountPaid > 0 && amountPaid < totalAmount) return 'PARTIAL';

  return 'UNPAID';
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

const getRawPurchaseRows = ({
  purchases,
  purchaseTransactions,
  purchase_transactions,
  purchasePackages,
  purchase_packages,
  dbData,
}) => {
  return [
    ...safeArray(purchases),
    ...safeArray(purchaseTransactions),
    ...safeArray(purchase_transactions),
    ...safeArray(purchasePackages),
    ...safeArray(purchase_packages),
    ...safeArray(dbData?.purchases),
    ...safeArray(dbData?.purchaseTransactions),
    ...safeArray(dbData?.purchase_transactions),
    ...safeArray(dbData?.purchasePackages),
    ...safeArray(dbData?.purchase_packages),
  ];
};

const getRawSupplierRows = ({
  masterSuppliers,
  master_suppliers,
  suppliers,
  vendors,
  dbData,
}) => {
  if (Array.isArray(master_suppliers)) return master_suppliers;
  if (Array.isArray(masterSuppliers)) return masterSuppliers;
  if (Array.isArray(suppliers)) return suppliers;
  if (Array.isArray(vendors)) return vendors;

  if (Array.isArray(dbData?.master_suppliers)) return dbData.master_suppliers;
  if (Array.isArray(dbData?.masterSuppliers)) return dbData.masterSuppliers;
  if (Array.isArray(dbData?.suppliers)) return dbData.suppliers;
  if (Array.isArray(dbData?.vendors)) return dbData.vendors;

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

const getRawConversionRuleRows = ({
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
    warehouse_type: normalizeCode(raw.warehouse_type || raw.location_type || raw.type || 'RAW_MATERIAL'),
    branch_id: String(raw.branch_id || raw.branchId || raw.scope_branch_id || record?.branch_id || '').trim(),
    status: normalizeMasterStatus(raw),
    isDeleted: isSoftDeleted(raw),
    raw,
  };
};

const normalizeSupplierDisplay = (record) => {
  const raw = record?.raw || record || {};

  const supplierId = String(
    raw.supplier_id ||
    raw.supplierId ||
    record?.id ||
    raw.id ||
    '',
  ).trim();

  const supplierName = String(
    raw.supplier_name ||
    raw.supplierName ||
    raw.nama_supplier ||
    raw.vendor_name ||
    raw.name ||
    record?.name ||
    '',
  ).trim();

  return {
    id: String(raw.id || supplierId).trim(),
    supplier_id: supplierId,
    supplier_code: String(raw.supplier_code || raw.kode_supplier || raw.code || supplierId || '').trim(),
    supplier_name: supplierName,
    supplier_type: normalizeCode(raw.supplier_type || raw.type || raw.category || 'UMUM'),
    branch_id: String(raw.branch_id || raw.branchId || record?.branch_id || '').trim(),
    termin_hari: toNumber(raw.termin_hari || raw.term_days || raw.due_days || 0),
    metode_pembayaran_default: normalizeCode(raw.metode_pembayaran_default || raw.default_payment_method || raw.payment_method || 'TRANSFER'),
    status: normalizeMasterStatus(raw),
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
    status: normalizeMasterStatus(raw),
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

  return {
    id: ruleId,
    rule_id: ruleId,
    code: String(raw.rule_code || raw.code || ruleId || '').trim(),
    name: String(raw.rule_name || raw.name || `${fromUnit || '-'} → ${toUnit || '-'}`).trim(),
    from_unit: fromUnit,
    to_unit: toUnit,
    factor: toNumber(raw.factor || raw.conversion_factor || raw.ratio || raw.nilai || 0),
    branch_id: String(raw.branch_id || raw.branchId || '').trim(),
    status: normalizeMasterStatus(raw),
    isDeleted: isSoftDeleted(raw),
    raw,
  };
};

const normalizePurchaseLine = (line = {}, index = 0) => {
  const qty = roundQty(line.qty || line.quantity || 0);
  const unitPrice = roundMoney(line.unit_price || line.unitPrice || line.price || line.harga_satuan || 0);
  const subtotal = roundMoney(line.subtotal || line.total || line.amount || qty * unitPrice);

  return {
    line_id: String(line.line_id || line.lineId || generateId(`PUR-L${index + 1}`, getTodayStr())).trim(),
    raw_material_id: String(line.raw_material_id || line.rawMaterialId || line.material_id || line.item_id || '').trim(),
    raw_material_name: String(line.raw_material_name || line.rawMaterialName || line.material_name || line.item_name || '').trim(),
    qty,
    unit: normalizeCode(line.unit || line.satuan || ''),
    conversion_rule_id: String(line.conversion_rule_id || line.conversionRuleId || line.rule_id || '').trim(),
    unit_price: unitPrice,
    subtotal,
  };
};

const normalizePurchaseRecord = (row) => {
  const packageInput = row?.purchase_transaction_package || row?.purchaseTransactionPackage || row || {};
  const header = packageInput.purchase_header || packageInput.header || row?.purchase_header || row || {};
  const snapshot = packageInput.purchase_snapshot || packageInput.snapshot_package || parseJson(header.purchase_snapshot_json, null) || null;
  const snapshotPayload = snapshot?.payload?.purchase_snapshot || snapshot?.payload || null;
  const snapshotHeader = snapshotPayload?.purchase_header || snapshotPayload?.transaction_header || {};

  const finalHeader = {
    ...snapshotHeader,
    ...header,
  };

  const items = packageInput.purchase_items ||
    packageInput.items ||
    snapshotPayload?.purchase_items ||
    snapshotPayload?.transaction_items ||
    row?.purchase_items ||
    parseJson(header.purchase_items_json, []) ||
    parseJson(header.items_json, []) ||
    parseJson(header.itemsJson, []) ||
    [];

  const normalizedLines = Array.isArray(items)
    ? items.map(normalizePurchaseLine)
    : [];

  const totalAmount = roundMoney(
    finalHeader.total_amount ||
    finalHeader.amount ||
    finalHeader.grand_total ||
    finalHeader.subtotal ||
    normalizedLines.reduce((sum, line) => sum + toNumber(line.subtotal), 0),
  );

  const amountPaid = roundMoney(
    finalHeader.amount_paid ||
    finalHeader.paid_amount ||
    finalHeader.total_paid ||
    0,
  );

  const purchaseId = String(finalHeader.purchase_id || finalHeader.id || row?.purchase_id || row?.id || '').trim();
  const purchaseCode = String(finalHeader.purchase_code || finalHeader.purchaseCode || finalHeader.code || finalHeader.invoice_number || purchaseId || '').trim();

  return {
    id: String(finalHeader.id || purchaseId).trim(),

    purchase_id: purchaseId,
    purchase_code: purchaseCode,
    purchase_date: normalizeDate(finalHeader.purchase_date || finalHeader.date || finalHeader.created_at || row?.date || ''),

    supplier_id: String(finalHeader.supplier_id || finalHeader.supplierId || row?.supplier_id || '').trim(),
    supplier_name: String(finalHeader.supplier_name || finalHeader.supplierName || row?.supplier_name || '').trim(),

    branch_id: String(finalHeader.branch_id || finalHeader.branchId || '').trim(),
    warehouse_id: String(finalHeader.warehouse_id || finalHeader.warehouseId || '').trim(),

    payment_method: normalizeCode(finalHeader.payment_method || finalHeader.paymentMethod || ''),
    payment_status: normalizePaymentStatus(finalHeader.payment_status || finalHeader.paymentStatus, totalAmount, amountPaid),

    due_date: normalizeDate(finalHeader.due_date || finalHeader.dueDate || ''),
    invoice_number: String(finalHeader.invoice_number || finalHeader.no_invoice || finalHeader.nota || '').trim(),

    notes: String(finalHeader.notes || finalHeader.keterangan || '').trim(),
    status: normalizePurchaseStatus(finalHeader),

    amount_paid: amountPaid,
    total_amount: totalAmount,
    remaining_amount: roundMoney(
      finalHeader.remaining_amount ||
      finalHeader.hutang ||
      finalHeader.amount_payable ||
      Math.max(totalAmount - amountPaid, 0),
    ),

    purchase_items: normalizedLines,

    created_at: finalHeader.created_at || row?.created_at || '',
    updated_at: finalHeader.updated_at || row?.updated_at || '',
    posted_at: finalHeader.posted_at || row?.posted_at || '',
    voided_at: finalHeader.voided_at || row?.voided_at || '',

    search_text: normalizeText([
      purchaseId,
      purchaseCode,
      finalHeader.invoice_number,
      finalHeader.supplier_id,
      finalHeader.supplier_name,
      finalHeader.branch_id,
      finalHeader.warehouse_id,
      finalHeader.status,
      finalHeader.payment_method,
      finalHeader.payment_status,
    ].filter(Boolean).join(' ')),

    raw: row,
  };
};

const buildMasterSource = ({
  dbData,
  rawSupplierRows,
  rawMaterialRows,
  rawBranchRows,
  rawWarehouseRows,
  rawConversionRuleRows,
  rawPurchaseRows,
}) => {
  return {
    ...(dbData || {}),

    master_suppliers: rawSupplierRows,
    masterSuppliers: rawSupplierRows,
    suppliers: rawSupplierRows,

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

    master_conversion_rules: rawConversionRuleRows,
    masterConversionRules: rawConversionRuleRows,
    conversion_rules: rawConversionRuleRows,
    conversionRules: rawConversionRuleRows,

    purchases: rawPurchaseRows,
    purchase_transactions: rawPurchaseRows,
  };
};

const calculateDraftSummary = (lines, form) => {
  const totalAmount = roundMoney((lines || []).reduce((sum, line) => sum + toNumber(line.subtotal), 0));

  let amountPaid = 0;

  if (form.payment_method === 'HUTANG' || form.payment_status === 'UNPAID') {
    amountPaid = 0;
  } else if (form.payment_status === 'PARTIAL') {
    amountPaid = roundMoney(form.amount_paid);
  } else {
    amountPaid = totalAmount;
  }

  return {
    total_amount: totalAmount,
    amount_paid: amountPaid,
    remaining_amount: roundMoney(Math.max(totalAmount - amountPaid, 0)),
    payment_status: normalizePaymentStatus(form.payment_status, totalAmount, amountPaid),
    total_lines: lines.length,
  };
};

const createPurchaseCommand = ({
  form,
  lines,
  summary,
  executor,
  mode,
  masterSource,
}) => {
  const normalizedLines = lines.map(normalizePurchaseLine);

  return {
    transaction_type: 'PURCHASE',
    action: mode,
    mode,

    purchase_header: {
      purchase_id: form.purchase_id,
      purchase_code: form.purchase_code,
      purchase_date: form.purchase_date,

      supplier_id: form.supplier_id,
      supplier_name: form.supplier_name,

      branch_id: form.branch_id,
      warehouse_id: form.warehouse_id,

      payment_method: form.payment_method,
      payment_status: summary.payment_status,
      due_date: form.due_date,
      invoice_number: form.invoice_number,
      notes: form.notes,
      status: mode === 'POST' ? 'POSTED' : 'DRAFT',

      amount_paid: summary.amount_paid,
      total_amount: summary.total_amount,
      remaining_amount: summary.remaining_amount,

      created_by: executor,
      updated_by: executor,
    },

    purchase_items: normalizedLines,

    source: masterSource,
    dbData: masterSource,
    masterData: masterSource,
  };
};

const normalizePurchasePackageFromOrchestrator = (result) => {
  const base = result?.transaction_package || result?.package || result?.data || result || {};

  return {
    purchase_transaction_package:
      base.purchase_transaction_package ||
      base.purchasePackage ||
      base.purchase_package ||
      base.purchase ||
      null,

    inventory_layer_package:
      base.inventory_layer_package ||
      base.inventoryLayerPackage ||
      base.inventory_package ||
      base.fifo_layer_package ||
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
      base.purchase_snapshot ||
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
      base.purchase_reversal_package ||
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

const validatePostedOrchestratorPackage = (packageResult) => {
  const missing = [];

  if (!packageResult.purchase_transaction_package) missing.push('purchase_transaction_package');
  if (!packageResult.inventory_layer_package) missing.push('inventory_layer_package');
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

export default function TabPurchase({
  purchases = [],
  purchaseTransactions,
  purchase_transactions,
  purchasePackages,
  purchase_packages,

  masterSuppliers = [],
  master_suppliers,
  suppliers,
  vendors,

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
    purchase_date: todayStr,
    due_date: todayStr,
    branch_id: isOwnerMode ? '' : userBranchId,
  });

  const [purchaseLines, setPurchaseLines] = useState([]);
  const [lineForm, setLineForm] = useState(DEFAULT_LINE_FORM);
  const [editingLineId, setEditingLineId] = useState('');

  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState(isOwnerMode ? 'ALL' : userBranchId || 'ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');

  const rawPurchaseRows = useMemo(() => {
    return getRawPurchaseRows({
      purchases,
      purchaseTransactions,
      purchase_transactions,
      purchasePackages,
      purchase_packages,
      dbData,
    });
  }, [purchases, purchaseTransactions, purchase_transactions, purchasePackages, purchase_packages, dbData]);

  const rawSupplierRows = useMemo(() => {
    return getRawSupplierRows({
      masterSuppliers,
      master_suppliers,
      suppliers,
      vendors,
      dbData,
    });
  }, [masterSuppliers, master_suppliers, suppliers, vendors, dbData]);

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

  const rawConversionRuleRows = useMemo(() => {
    return getRawConversionRuleRows({
      masterConversionRules,
      master_conversion_rules,
      conversionRules,
      conversion_rules,
      dbData,
    });
  }, [masterConversionRules, master_conversion_rules, conversionRules, conversion_rules, dbData]);

  const masterSource = useMemo(() => {
    return buildMasterSource({
      dbData,
      rawSupplierRows,
      rawMaterialRows,
      rawBranchRows,
      rawWarehouseRows,
      rawConversionRuleRows,
      rawPurchaseRows,
    });
  }, [
    dbData,
    rawSupplierRows,
    rawMaterialRows,
    rawBranchRows,
    rawWarehouseRows,
    rawConversionRuleRows,
    rawPurchaseRows,
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

  const supplierRecords = useMemo(() => {
    const result = masterDataApi.getSuppliers?.(masterSource, {
      includeInactive: true,
      includeDeleted: true,
      validate: false,
    }) || { records: [] };

    return (result.records || [])
      .map(normalizeSupplierDisplay)
      .filter((supplier) => !supplier.isDeleted)
      .sort((a, b) => String(a.supplier_name).localeCompare(String(b.supplier_name)));
  }, [masterDataApi, masterSource]);

  const materialRecords = useMemo(() => {
    const result = masterDataApi.getRawMaterials?.(masterSource, {
      includeInactive: true,
      includeDeleted: true,
      validate: false,
    }) || { records: [] };

    return (result.records || [])
      .map(normalizeMaterialDisplay)
      .filter((material) => !material.isDeleted)
      .sort((a, b) => String(a.raw_material_name).localeCompare(String(b.raw_material_name)));
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

  const conversionRuleRecords = useMemo(() => {
    const extractedRows = typeof masterDataApi.extractMasterRows === 'function'
      ? masterDataApi.extractMasterRows(masterSource, 'CONVERSION_RULE')
      : rawConversionRuleRows;

    const searchResult = typeof masterDataApi.searchMaster === 'function'
      ? masterDataApi.searchMaster(masterSource, {
          masterType: 'CONVERSION_RULE',
          includeInactive: true,
          includeDeleted: true,
        }, {
          validate: false,
        })
      : { records: [] };

    const merged = [
      ...safeArray(extractedRows),
      ...safeArray(searchResult.records),
    ];

    const map = new Map();

    merged.map(normalizeConversionRuleDisplay).forEach((rule) => {
      if (!rule.rule_id) return;
      map.set(rule.rule_id, rule);
    });

    return Array.from(map.values())
      .filter((rule) => !rule.isDeleted && rule.status === 'ACTIVE')
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [masterDataApi, masterSource, rawConversionRuleRows]);

  const unitOptions = useMemo(() => {
    return Array.from(new Set([
      ...DEFAULT_UNIT_OPTIONS,
      ...materialRecords.flatMap((material) => [material.base_unit, material.purchase_unit, material.production_unit]).filter(Boolean),
      ...conversionRuleRecords.flatMap((rule) => [rule.from_unit, rule.to_unit]).filter(Boolean),
    ])).sort();
  }, [materialRecords, conversionRuleRecords]);

  const purchaseRecords = useMemo(() => {
    return rawPurchaseRows
      .map(normalizePurchaseRecord)
      .sort((a, b) => {
        const dateCompare = String(b.purchase_date || '').localeCompare(String(a.purchase_date || ''));
        if (dateCompare !== 0) return dateCompare;
        return String(b.purchase_id || '').localeCompare(String(a.purchase_id || ''));
      });
  }, [rawPurchaseRows]);

  const effectiveBranchFilter = !isOwnerMode && userBranchId ? userBranchId : branchFilter;

  const filteredPurchases = useMemo(() => {
    const keyword = normalizeText(searchQuery);

    return purchaseRecords.filter((purchase) => {
      const branchOk = effectiveBranchFilter === 'ALL' || purchase.branch_id === effectiveBranchFilter;
      const supplierOk = supplierFilter === 'ALL' || purchase.supplier_id === supplierFilter;
      const statusOk = statusFilter === 'ALL' || purchase.status === statusFilter;

      const dateOk = (!dateFromFilter || purchase.purchase_date >= dateFromFilter) &&
        (!dateToFilter || purchase.purchase_date <= dateToFilter);

      const searchOk = !keyword || purchase.search_text.includes(keyword);

      return branchOk && supplierOk && statusOk && dateOk && searchOk;
    });
  }, [
    purchaseRecords,
    effectiveBranchFilter,
    supplierFilter,
    statusFilter,
    dateFromFilter,
    dateToFilter,
    searchQuery,
  ]);

  const activeBranchRecords = useMemo(() => {
    return branchRecords.filter((branch) => branch.status === 'ACTIVE');
  }, [branchRecords]);

  const activeSuppliersByBranch = useMemo(() => {
    return supplierRecords.filter((supplier) => {
      if (supplier.status !== 'ACTIVE') return false;
      if (!form.branch_id) return true;
      return supplier.branch_id === form.branch_id;
    });
  }, [supplierRecords, form.branch_id]);

  const activeWarehousesByBranch = useMemo(() => {
    return warehouseRecords.filter((warehouse) => {
      if (warehouse.status !== 'ACTIVE') return false;
      if (!form.branch_id) return true;
      return warehouse.branch_id === form.branch_id;
    });
  }, [warehouseRecords, form.branch_id]);

  const activeMaterialsByBranch = useMemo(() => {
    return materialRecords.filter((material) => {
      if (material.status !== 'ACTIVE') return false;
      if (!form.branch_id) return true;
      return material.branch_id === form.branch_id;
    });
  }, [materialRecords, form.branch_id]);

  const branchNameById = useMemo(() => {
    const map = new Map();

    branchRecords.forEach((branch) => {
      map.set(branch.branch_id, branch.branch_name || branch.branch_id);
      map.set(branch.branch_code, branch.branch_name || branch.branch_id);
    });

    return map;
  }, [branchRecords]);

  const supplierNameById = useMemo(() => {
    const map = new Map();

    supplierRecords.forEach((supplier) => {
      map.set(supplier.supplier_id, supplier.supplier_name || supplier.supplier_id);
      map.set(supplier.supplier_code, supplier.supplier_name || supplier.supplier_id);
    });

    return map;
  }, [supplierRecords]);

  const warehouseNameById = useMemo(() => {
    const map = new Map();

    warehouseRecords.forEach((warehouse) => {
      map.set(warehouse.warehouse_id, warehouse.warehouse_name || warehouse.warehouse_id);
      map.set(warehouse.warehouse_code, warehouse.warehouse_name || warehouse.warehouse_id);
    });

    return map;
  }, [warehouseRecords]);

  const draftSummary = useMemo(() => {
    return calculateDraftSummary(purchaseLines, form);
  }, [purchaseLines, form]);

  const analytics = useMemo(() => {
    const scoped = purchaseRecords.filter((purchase) => {
      if (purchase.status === 'VOID' || purchase.status === 'CANCELLED') return false;
      if (effectiveBranchFilter === 'ALL') return true;
      return purchase.branch_id === effectiveBranchFilter;
    });

    const posted = scoped.filter((purchase) => purchase.status === 'POSTED');
    const totalPembelian = posted.reduce((sum, purchase) => sum + toNumber(purchase.total_amount), 0);
    const totalHutang = posted.reduce((sum, purchase) => sum + toNumber(purchase.remaining_amount), 0);

    const lineRows = posted.flatMap((purchase) => purchase.purchase_items || []);
    const totalQty = lineRows.reduce((sum, line) => sum + toNumber(line.qty), 0);
    const totalLineAmount = lineRows.reduce((sum, line) => sum + toNumber(line.subtotal), 0);
    const averagePrice = totalQty > 0 ? totalLineAmount / totalQty : 0;

    const supplierMap = new Map();

    posted.forEach((purchase) => {
      const key = purchase.supplier_id || purchase.supplier_name || 'UNKNOWN';

      if (!supplierMap.has(key)) {
        supplierMap.set(key, {
          supplier_id: purchase.supplier_id,
          supplier_name: purchase.supplier_name || supplierNameById.get(purchase.supplier_id) || key,
          total_amount: 0,
          total_transactions: 0,
        });
      }

      const row = supplierMap.get(key);
      row.total_amount += toNumber(purchase.total_amount);
      row.total_transactions += 1;
    });

    const topSupplier = Array.from(supplierMap.values())
      .sort((a, b) => b.total_amount - a.total_amount)[0] || null;

    const branchMap = new Map();

    posted.forEach((purchase) => {
      const key = purchase.branch_id || 'UNKNOWN';

      if (!branchMap.has(key)) {
        branchMap.set(key, {
          branch_id: key,
          branch_name: branchNameById.get(key) || key,
          total_amount: 0,
          total_transactions: 0,
        });
      }

      const row = branchMap.get(key);
      row.total_amount += toNumber(purchase.total_amount);
      row.total_transactions += 1;
    });

    return {
      total_pembelian: roundMoney(totalPembelian),
      total_hutang_supplier: roundMoney(totalHutang),
      total_transaksi: posted.length,
      draft_count: scoped.filter((purchase) => purchase.status === 'DRAFT').length,
      void_count: purchaseRecords.filter((purchase) => purchase.status === 'VOID').length,
      top_supplier: topSupplier,
      rata_rata_harga_beli: roundMoney(averagePrice),
      pembelian_per_cabang: Array.from(branchMap.values()).sort((a, b) => b.total_amount - a.total_amount),
    };
  }, [purchaseRecords, effectiveBranchFilter, supplierNameById, branchNameById]);

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
      purchase_date: todayStr,
      due_date: todayStr,
      branch_id: isOwnerMode ? '' : userBranchId,
    });
    setPurchaseLines([]);
    setLineForm(DEFAULT_LINE_FORM);
    setEditingLineId('');
    setIsEditingDraft(false);
    setSelectedPurchase(null);
  };

  const handleGenerateId = () => {
    const newId = generateId('PUR', todayStr);

    setForm((prev) => ({
      ...prev,
      id: prev.id || newId,
      purchase_id: prev.purchase_id || newId,
      purchase_code: prev.purchase_code || newId,
    }));
  };

  const handleSupplierChange = (supplierId) => {
    const supplier = supplierRecords.find((item) => item.supplier_id === supplierId);
    const branchId = supplier?.branch_id || form.branch_id;
    const paymentMethod = supplier?.metode_pembayaran_default || form.payment_method || 'TRANSFER';
    const paymentStatus = paymentMethod === 'HUTANG' ? 'UNPAID' : 'PAID';
    const dueDate = addDays(form.purchase_date || todayStr, supplier?.termin_hari || 0);

    setForm((prev) => ({
      ...prev,
      supplier_id: supplierId,
      supplier_name: supplier?.supplier_name || '',
      branch_id: branchId,
      warehouse_id: branchId === prev.branch_id ? prev.warehouse_id : '',
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      due_date: dueDate || prev.due_date,
    }));
  };

  const handleBranchChange = (branchId) => {
    setForm((prev) => ({
      ...prev,
      branch_id: branchId,
      supplier_id: '',
      supplier_name: '',
      warehouse_id: '',
    }));
    setPurchaseLines([]);
    setLineForm(DEFAULT_LINE_FORM);
    setEditingLineId('');
  };

  const handlePaymentMethodChange = (method) => {
    const nextStatus = method === 'HUTANG' ? 'UNPAID' : 'PAID';

    setForm((prev) => ({
      ...prev,
      payment_method: method,
      payment_status: nextStatus,
      amount_paid: method === 'HUTANG' ? '0' : prev.amount_paid,
    }));
  };

  const recalculateLineSubtotal = (lineInput) => {
    const qty = toNumber(lineInput.qty);
    const unitPrice = toNumber(lineInput.unit_price);

    return {
      ...lineInput,
      subtotal: String(roundMoney(qty * unitPrice)),
    };
  };

  const handleMaterialChange = (materialId) => {
    const material = materialRecords.find((item) => item.raw_material_id === materialId);

    setLineForm((prev) => recalculateLineSubtotal({
      ...prev,
      raw_material_id: materialId,
      raw_material_name: material?.raw_material_name || '',
      unit: material?.purchase_unit || material?.base_unit || prev.unit || 'KG',
      conversion_rule_id: material?.conversion_rule_id || prev.conversion_rule_id,
      unit_price: material?.latest_cost ? String(material.latest_cost) : prev.unit_price,
    }));
  };

  const validateLine = (lineInput) => {
    const warnings = [];

    if (!lineInput.raw_material_id.trim()) warnings.push('Bahan baku wajib dipilih.');
    if (!lineInput.raw_material_name.trim()) warnings.push('Nama bahan baku wajib terisi.');
    if (toNumber(lineInput.qty) <= 0) warnings.push('Qty wajib lebih dari 0.');
    if (!lineInput.unit.trim()) warnings.push('Unit wajib diisi.');
    if (toNumber(lineInput.unit_price) < 0) warnings.push('Unit price tidak boleh negatif.');

    const materialExists = materialRecords.some((material) => {
      return material.raw_material_id === lineInput.raw_material_id &&
        material.branch_id === form.branch_id &&
        !material.isDeleted &&
        material.status === 'ACTIVE';
    });

    if (lineInput.raw_material_id && !materialExists) {
      warnings.push('Bahan baku tidak ditemukan atau tidak aktif di cabang yang dipilih.');
    }

    return warnings;
  };

  const handleAddOrUpdateLine = () => {
    const warnings = validateLine(lineForm);

    if (warnings.length > 0) {
      notify(warnings.join('\n'), 'error');
      return;
    }

    const normalizedLine = normalizePurchaseLine({
      ...lineForm,
      line_id: editingLineId || lineForm.line_id || generateId('PUR-LINE', todayStr),
    });

    if (editingLineId) {
      setPurchaseLines((prev) => prev.map((line) => (
        line.line_id === editingLineId ? normalizedLine : line
      )));
      setEditingLineId('');
    } else {
      setPurchaseLines((prev) => [...prev, normalizedLine]);
    }

    setLineForm(DEFAULT_LINE_FORM);
  };

  const handleEditLine = (line) => {
    setEditingLineId(line.line_id);
    setLineForm({
      line_id: line.line_id,
      raw_material_id: line.raw_material_id,
      raw_material_name: line.raw_material_name,
      qty: String(line.qty),
      unit: line.unit,
      conversion_rule_id: line.conversion_rule_id,
      unit_price: String(line.unit_price),
      subtotal: String(line.subtotal),
    });
  };

  const handleRemoveLine = (lineId) => {
    setPurchaseLines((prev) => prev.filter((line) => line.line_id !== lineId));

    if (editingLineId === lineId) {
      setEditingLineId('');
      setLineForm(DEFAULT_LINE_FORM);
    }
  };

  const validatePurchaseForm = ({ posting = false } = {}) => {
    const warnings = [];

    if (!form.purchase_id.trim()) warnings.push('Purchase ID wajib diisi.');
    if (!form.purchase_code.trim()) warnings.push('Purchase Code wajib diisi.');
    if (!form.purchase_date.trim()) warnings.push('Tanggal pembelian wajib diisi.');
    if (!form.supplier_id.trim()) warnings.push('Supplier wajib dipilih.');
    if (!form.supplier_name.trim()) warnings.push('Nama supplier wajib terisi.');
    if (!form.branch_id.trim()) warnings.push('Branch ID wajib dipilih.');
    if (!form.warehouse_id.trim()) warnings.push('Warehouse ID wajib dipilih.');
    if (!form.payment_method.trim()) warnings.push('Payment method wajib dipilih.');
    if (!form.payment_status.trim()) warnings.push('Payment status wajib dipilih.');
    if (purchaseLines.length === 0) warnings.push('Detail pembelian wajib minimal 1 item.');

    const supplierExists = supplierRecords.some((supplier) => {
      return supplier.supplier_id === form.supplier_id &&
        supplier.branch_id === form.branch_id &&
        supplier.status === 'ACTIVE' &&
        !supplier.isDeleted;
    });

    if (form.supplier_id && !supplierExists) {
      warnings.push('Supplier tidak ditemukan atau tidak aktif di cabang yang dipilih.');
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

    if (!isOwnerMode && userBranchId && form.branch_id !== userBranchId) {
      warnings.push('User cabang hanya boleh membuat pembelian di branch miliknya.');
    }

    purchaseLines.forEach((line) => {
      warnings.push(...validateLine({
        ...line,
        qty: String(line.qty),
        unit_price: String(line.unit_price),
      }));
    });

    if (form.payment_method === 'HUTANG' && form.payment_status === 'PAID') {
      warnings.push('Payment method HUTANG tidak boleh langsung PAID.');
    }

    if (['HUTANG', 'TRANSFER'].includes(form.payment_method) && form.payment_status !== 'PAID' && !form.due_date) {
      warnings.push('Due date wajib diisi untuk transaksi belum lunas.');
    }

    if (posting && form.status === 'VOID') {
      warnings.push('Transaksi VOID tidak bisa diposting ulang.');
    }

    return warnings;
  };

  const createLocalPayload = ({
    status,
    packageResult = null,
    voidPackageResult = null,
  }) => {
    const summary = calculateDraftSummary(purchaseLines, form);
    const normalizedLines = purchaseLines.map(normalizePurchaseLine);

    return {
      ...(selectedPurchase?.raw || {}),

      id: selectedPurchase?.id || form.purchase_id,
      date: selectedPurchase?.raw?.date || todayStr,

      purchase_id: form.purchase_id,
      purchase_code: form.purchase_code,
      purchase_date: form.purchase_date,

      supplier_id: form.supplier_id,
      supplier_name: form.supplier_name,

      branch_id: form.branch_id,
      warehouse_id: form.warehouse_id,

      payment_method: form.payment_method,
      payment_status: summary.payment_status,
      due_date: form.due_date,
      invoice_number: form.invoice_number,

      notes: form.notes,

      status,
      purchase_status: status,

      amount_paid: summary.amount_paid,
      total_amount: summary.total_amount,
      remaining_amount: summary.remaining_amount,

      purchase_items: normalizedLines,
      purchase_items_json: JSON.stringify(normalizedLines),

      purchase_transaction_package: packageResult?.purchase_transaction_package || selectedPurchase?.raw?.purchase_transaction_package || null,
      purchase_transaction_package_json: packageResult?.purchase_transaction_package ? JSON.stringify(packageResult.purchase_transaction_package) : selectedPurchase?.raw?.purchase_transaction_package_json || '',

      inventory_layer_package: packageResult?.inventory_layer_package || selectedPurchase?.raw?.inventory_layer_package || null,
      inventory_layer_package_json: packageResult?.inventory_layer_package ? JSON.stringify(packageResult.inventory_layer_package) : selectedPurchase?.raw?.inventory_layer_package_json || '',

      accounting_package: packageResult?.accounting_package || selectedPurchase?.raw?.accounting_package || null,
      accounting_package_json: packageResult?.accounting_package ? JSON.stringify(packageResult.accounting_package) : selectedPurchase?.raw?.accounting_package_json || '',

      snapshot_package: packageResult?.snapshot_package || voidPackageResult?.snapshot_package || selectedPurchase?.raw?.snapshot_package || null,
      snapshot_package_json: packageResult?.snapshot_package
        ? JSON.stringify(packageResult.snapshot_package)
        : voidPackageResult?.snapshot_package
          ? JSON.stringify(voidPackageResult.snapshot_package)
          : selectedPurchase?.raw?.snapshot_package_json || '',

      reversal_package: voidPackageResult?.reversal_package || selectedPurchase?.raw?.reversal_package || null,
      reversal_package_json: voidPackageResult?.reversal_package ? JSON.stringify(voidPackageResult.reversal_package) : selectedPurchase?.raw?.reversal_package_json || '',

      orchestrator_response_json: packageResult?.raw_orchestrator_response
        ? JSON.stringify(packageResult.raw_orchestrator_response)
        : voidPackageResult?.raw_orchestrator_response
          ? JSON.stringify(voidPackageResult.raw_orchestrator_response)
          : selectedPurchase?.raw?.orchestrator_response_json || '',

      engine_warnings_json: packageResult?.warnings
        ? JSON.stringify(packageResult.warnings)
        : voidPackageResult?.warnings
          ? JSON.stringify(voidPackageResult.warnings)
          : selectedPurchase?.raw?.engine_warnings_json || '',

      created_at: selectedPurchase?.raw?.created_at || new Date().toISOString(),
      created_by: selectedPurchase?.raw?.created_by || executor,
      updated_at: new Date().toISOString(),
      updated_by: executor,

      posted_at: status === 'POSTED' ? selectedPurchase?.raw?.posted_at || new Date().toISOString() : selectedPurchase?.raw?.posted_at || '',
      posted_by: status === 'POSTED' ? selectedPurchase?.raw?.posted_by || executor : selectedPurchase?.raw?.posted_by || '',

      voided_at: status === 'VOID' ? new Date().toISOString() : selectedPurchase?.raw?.voided_at || '',
      voided_by: status === 'VOID' ? executor : selectedPurchase?.raw?.voided_by || '',
    };
  };

  const persistPurchase = async (action, payload) => {
    if (typeof sendToSheet !== 'function') {
      notify('sendToSheet belum tersedia. Data pembelian belum bisa disimpan ke cloud.', 'error');
      return false;
    }

    let isSuccess = false;

    try {
      isSuccess = await sendToSheet(action, PURCHASE_TABLE_NAME, payload);
    } catch (error) {
      isSuccess = false;
    }

    if (!isSuccess) {
      try {
        isSuccess = await sendToSheet(action, payload, PURCHASE_TABLE_NAME);
      } catch (error) {
        isSuccess = false;
      }
    }

    return Boolean(isSuccess);
  };

  const runProcessPurchase = async ({ mode }) => {
    if (!erpOrchestrator || typeof erpOrchestrator.processPurchase !== 'function') {
      return {
        ok: false,
        message: 'erpOrchestrator.processPurchase() belum tersedia. Revisi harus dilakukan di src/services/erpOrchestrator.js.',
      };
    }

    const summary = calculateDraftSummary(purchaseLines, form);
    const command = createPurchaseCommand({
      form,
      lines: purchaseLines,
      summary,
      executor,
      mode,
      masterSource,
    });

    try {
      const result = await Promise.resolve(
        erpOrchestrator.processPurchase(command, {
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
          message: result.message || result.error || 'erpOrchestrator.processPurchase() mengembalikan status tidak OK.',
        };
      }

      const packageResult = normalizePurchasePackageFromOrchestrator(result);

      if (mode === 'POST') {
        const missing = validatePostedOrchestratorPackage(packageResult);

        if (missing.length > 0) {
          return {
            ok: false,
            message: `Package orchestrator belum lengkap: ${missing.join(', ')}. Revisi alur di src/services/erpOrchestrator.js, bukan di UI.`,
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
        message: error.message || 'erpOrchestrator.processPurchase() gagal dijalankan.',
      };
    }
  };

  const handleSaveDraft = async () => {
    const warnings = validatePurchaseForm({ posting: false });

    if (warnings.length > 0) {
      notify(warnings.join('\n'), 'error');
      return;
    }

    const orchestratorResult = await runProcessPurchase({ mode: 'DRAFT' });

    if (!orchestratorResult.ok) {
      notify(orchestratorResult.message, 'error');
      return;
    }

    const payload = createLocalPayload({
      status: 'DRAFT',
      packageResult: orchestratorResult.packageResult,
    });

    const action = isEditingDraft ? 'update' : 'insert';
    const isSuccess = await persistPurchase(action, payload);

    if (isSuccess) {
      notify(isEditingDraft ? 'Draft pembelian berhasil diperbarui.' : 'Draft pembelian berhasil dibuat.', 'success');
      resetForm();
    }
  };

  const handlePostPurchase = async () => {
    const warnings = validatePurchaseForm({ posting: true });

    if (warnings.length > 0) {
      notify(warnings.join('\n'), 'error');
      return;
    }

    const confirmed = window.confirm(
      'Posting transaksi pembelian? Setelah POSTED, transaksi tidak boleh diedit dan hanya bisa VOID.',
    );

    if (!confirmed) return;

    const orchestratorResult = await runProcessPurchase({ mode: 'POST' });

    if (!orchestratorResult.ok) {
      notify(orchestratorResult.message, 'error');
      return;
    }

    const payload = createLocalPayload({
      status: 'POSTED',
      packageResult: orchestratorResult.packageResult,
    });

    const action = isEditingDraft ? 'update' : 'insert';
    const isSuccess = await persistPurchase(action, payload);

    if (isSuccess) {
      notify('Pembelian berhasil diposting melalui erpOrchestrator. FIFO Layer, jurnal, snapshot, dan purchase package dibuat oleh orchestrator.', 'success');
      resetForm();
    }
  };

  const handleEditDraft = (purchase) => {
    if (purchase.status !== 'DRAFT') {
      notify('Hanya transaksi DRAFT yang boleh diedit.', 'error');
      return;
    }

    setSelectedPurchase(purchase);
    setIsEditingDraft(true);

    setForm({
      id: purchase.id || purchase.purchase_id,
      purchase_id: purchase.purchase_id,
      purchase_code: purchase.purchase_code,
      purchase_date: purchase.purchase_date || todayStr,
      supplier_id: purchase.supplier_id,
      supplier_name: purchase.supplier_name,
      branch_id: purchase.branch_id,
      warehouse_id: purchase.warehouse_id,
      payment_method: purchase.payment_method || 'CASH',
      payment_status: purchase.payment_status || 'PAID',
      due_date: purchase.due_date || purchase.purchase_date || todayStr,
      invoice_number: purchase.invoice_number,
      notes: purchase.notes,
      status: 'DRAFT',
      amount_paid: String(purchase.amount_paid || ''),
    });

    setPurchaseLines((purchase.purchase_items || []).map(normalizePurchaseLine));
    setLineForm(DEFAULT_LINE_FORM);
    setEditingLineId('');
  };

  const runProcessVoidTransaction = async (purchase) => {
    if (!erpOrchestrator || typeof erpOrchestrator.processVoidTransaction !== 'function') {
      return {
        ok: false,
        message: 'erpOrchestrator.processVoidTransaction() belum tersedia. Revisi harus dilakukan di src/services/erpOrchestrator.js.',
      };
    }

    try {
      const result = await Promise.resolve(
        erpOrchestrator.processVoidTransaction({
          transaction_type: 'PURCHASE',
          transaction_id: purchase.purchase_id,
          transaction_code: purchase.purchase_code,
          branch_id: purchase.branch_id,
          original_transaction: purchase.raw,
          reason: 'VOID_PURCHASE_FROM_UI',
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

  const handleVoidPurchase = async (purchase) => {
    if (purchase.status !== 'POSTED') {
      notify('Hanya transaksi POSTED yang bisa di-void.', 'error');
      return;
    }

    const confirmed = window.confirm(
      `Void transaksi ${purchase.purchase_code || purchase.purchase_id}? Histori tidak dihapus, orchestrator akan membuat reversal package.`,
    );

    if (!confirmed) return;

    const voidResult = await runProcessVoidTransaction(purchase);

    if (!voidResult.ok) {
      notify(voidResult.message, 'error');
      return;
    }

    const payload = {
      ...(purchase.raw || {}),
      id: purchase.id || purchase.purchase_id,
      purchase_id: purchase.purchase_id,
      status: 'VOID',
      purchase_status: 'VOID',
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

    const isSuccess = await persistPurchase('update', payload);

    if (isSuccess) {
      notify('Transaksi pembelian berhasil di-void melalui erpOrchestrator. Reversal package dibuat oleh orchestrator.', 'success');
      if (selectedPurchase?.purchase_id === purchase.purchase_id) resetForm();
    }
  };

  const handleCancelDraft = async (purchase) => {
    if (purchase.status !== 'DRAFT') {
      notify('Hanya DRAFT yang bisa dibatalkan langsung.', 'error');
      return;
    }

    const confirmed = window.confirm(`Batalkan draft ${purchase.purchase_code || purchase.purchase_id}?`);

    if (!confirmed) return;

    const payload = {
      ...(purchase.raw || {}),
      id: purchase.id || purchase.purchase_id,
      purchase_id: purchase.purchase_id,
      status: 'CANCELLED',
      purchase_status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
      cancelled_by: executor,
      updated_at: new Date().toISOString(),
      updated_by: executor,
    };

    const isSuccess = await persistPurchase('update', payload);

    if (isSuccess) {
      notify('Draft pembelian berhasil dibatalkan.', 'success');
      if (selectedPurchase?.purchase_id === purchase.purchase_id) resetForm();
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
                <ShoppingCart size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                Modul Purchase ERP
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              Pembelian Resmi Dimsum Aditya
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-300">
              Thin UI purchase. Semua posting, FIFO Layer, jurnal, snapshot, dan void reversal wajib dibuat oleh erpOrchestrator.
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
        <StatCard title="Total Pembelian" value={formatMoney(analytics.total_pembelian)} icon={<ReceiptText size={18} />} tone="red" />
        <StatCard title="Total Hutang" value={formatMoney(analytics.total_hutang_supplier)} icon={<WalletCards size={18} />} tone="white" />
        <StatCard title="Transaksi Posted" value={analytics.total_transaksi} icon={<CheckCircle size={18} />} tone="gold" />
        <StatCard title="Rata-rata Harga" value={formatMoney(analytics.rata_rata_harga_beli)} icon={<Scale size={18} />} tone="white" />
        <StatCard title="Draft / Void" value={`${analytics.draft_count} / ${analytics.void_count}`} icon={<History size={18} />} tone="dark" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-red-50 p-3 text-red-600">
              <Crown size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Top Supplier</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.top_supplier?.supplier_name || '-'}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                {formatMoney(analytics.top_supplier?.total_amount || 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
              <Building2 size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pembelian Per Cabang</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.pembelian_per_cabang[0]?.branch_name || '-'}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                {formatMoney(analytics.pembelian_per_cabang[0]?.total_amount || 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <TrendingUp size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Preview Draft</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {formatMoney(draftSummary.total_amount)}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                {purchaseLines.length} item pembelian
              </div>
            </div>
          </div>
        </div>
      </div>

      {analytics.total_hutang_supplier > 0 && (
        <div className="rounded-[2rem] border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-3 text-amber-700 shadow-sm">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black text-amber-900">HUTANG SUPPLIER WARNING</h2>
                <p className="mt-1 text-xs font-bold text-amber-700">
                  Total hutang supplier aktif saat ini {formatMoney(analytics.total_hutang_supplier)}. Cek jadwal pembayaran dan due date.
                </p>
              </div>
            </div>
            <Badge tone="amber">Payable Monitoring</Badge>
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
                  {isEditingDraft ? 'Edit Draft Pembelian' : 'Tambah Pembelian'}
                </h2>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  DRAFT editable. POSTED locked. VOID via reversal package.
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
                <Field label="Purchase ID" required>
                  <div className="flex gap-2">
                    <input
                      disabled={isEditingDraft}
                      value={form.purchase_id}
                      onChange={(event) => setForm({ ...form, purchase_id: normalizeCode(event.target.value), id: normalizeCode(event.target.value) })}
                      className={inputClass}
                      placeholder="PUR-001"
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

                <Field label="Purchase Code" required>
                  <input
                    value={form.purchase_code}
                    onChange={(event) => setForm({ ...form, purchase_code: normalizeCode(event.target.value) })}
                    className={inputClass}
                    placeholder="PUR-AYAM-001"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Tanggal" required>
                  <input
                    type="date"
                    value={form.purchase_date}
                    onChange={(event) => setForm({ ...form, purchase_date: event.target.value })}
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

              <Field label="Supplier" required>
                <select
                  value={form.supplier_id}
                  onChange={(event) => handleSupplierChange(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Pilih supplier resmi</option>
                  {activeSuppliersByBranch.map((supplier) => (
                    <option key={supplier.supplier_id} value={supplier.supplier_id}>
                      {supplier.supplier_name} — {supplier.supplier_id}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Warehouse" required>
                <select
                  value={form.warehouse_id}
                  onChange={(event) => setForm({ ...form, warehouse_id: event.target.value })}
                  className={inputClass}
                >
                  <option value="">Pilih gudang masuk</option>
                  {activeWarehousesByBranch.map((warehouse) => (
                    <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                      {warehouse.warehouse_name} — {warehouse.warehouse_id}
                    </option>
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

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Due Date">
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(event) => setForm({ ...form, due_date: event.target.value })}
                    className={inputClass}
                  />
                </Field>

                <Field label="Invoice Number">
                  <input
                    value={form.invoice_number}
                    onChange={(event) => setForm({ ...form, invoice_number: event.target.value })}
                    className={inputClass}
                    placeholder="INV-001"
                  />
                </Field>
              </div>

              <Field label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Catatan pembelian..."
                />
              </Field>

              <div className="rounded-[2rem] border border-slate-100 bg-slate-50/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black text-slate-900">Detail Pembelian</div>
                    <div className="text-[11px] font-semibold text-slate-400">Bahan wajib dari Master Bahan Baku.</div>
                  </div>
                  <Badge tone="amber">{purchaseLines.length} item</Badge>
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

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Field label="Qty" required>
                      <input
                        value={lineForm.qty}
                        onChange={(event) => setLineForm(recalculateLineSubtotal({ ...lineForm, qty: event.target.value }))}
                        className={inputClass}
                        placeholder="10"
                      />
                    </Field>

                    <Field label="Unit" required>
                      <select
                        value={lineForm.unit}
                        onChange={(event) => setLineForm({ ...lineForm, unit: event.target.value })}
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
                      onChange={(event) => setLineForm({ ...lineForm, conversion_rule_id: event.target.value })}
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

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Field label="Unit Price" required>
                      <input
                        value={lineForm.unit_price}
                        onChange={(event) => setLineForm(recalculateLineSubtotal({ ...lineForm, unit_price: event.target.value }))}
                        className={inputClass}
                        placeholder="0"
                      />
                    </Field>

                    <Field label="Subtotal">
                      <input
                        value={lineForm.subtotal}
                        onChange={(event) => setLineForm({ ...lineForm, subtotal: event.target.value })}
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
                    {editingLineId ? 'Update Item' : 'Tambah Item'}
                  </button>
                </div>
              </div>

              {purchaseLines.length > 0 && (
                <div className="rounded-[2rem] border border-slate-100 bg-white">
                  <div className="border-b border-slate-100 p-4">
                    <div className="text-xs font-black text-slate-900">Item Draft</div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {purchaseLines.map((line) => (
                      <div key={line.line_id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-black text-slate-900">{line.raw_material_name}</div>
                            <div className="mt-1 text-[11px] font-bold text-slate-400">
                              {formatQty(line.qty, line.unit)} × {formatMoney(line.unit_price)}
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
                  <div className="text-amber-700">Total Pembelian</div>
                  <div className="text-right text-amber-950">{formatMoney(draftSummary.total_amount)}</div>

                  <div className="text-amber-700">Amount Paid</div>
                  <div className="text-right text-amber-950">{formatMoney(draftSummary.amount_paid)}</div>

                  <div className="text-amber-700">Sisa Hutang</div>
                  <div className="text-right text-amber-950">{formatMoney(draftSummary.remaining_amount)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-700 shadow-sm transition-all hover:bg-slate-50"
                >
                  <Save size={16} />
                  Simpan Draft
                </button>

                <button
                  type="button"
                  onClick={handlePostPurchase}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-sm transition-all hover:bg-red-700"
                >
                  <Send size={16} />
                  Posting
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
                    Daftar Pembelian Resmi
                  </h2>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    Data transaksi terkunci: DRAFT editable, POSTED locked, VOID reversal.
                  </p>
                </div>

                <div className="flex flex-col gap-2 2xl:flex-row">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-xs font-bold outline-none transition-all placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50 md:w-64"
                      placeholder="Cari purchase, invoice, supplier..."
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
                        {PURCHASE_STATUS.map((status) => (
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
                      value={supplierFilter}
                      onChange={(event) => setSupplierFilter(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none focus:border-red-500"
                    >
                      <option value="ALL">SEMUA SUPPLIER</option>
                      {supplierRecords.map((supplier) => (
                        <option key={supplier.supplier_id} value={supplier.supplier_id}>
                          {supplier.supplier_name}
                        </option>
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
              <table className="w-full min-w-[1500px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Transaksi</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Supplier</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cabang / Gudang</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Payment</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Total</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Items</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Status</th>
                    <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPurchases.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-14 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-red-50 text-red-600">
                          <ShoppingCart size={24} />
                        </div>
                        <div className="mt-3 text-sm font-black text-slate-800">Transaksi pembelian tidak ditemukan</div>
                        <div className="mt-1 text-xs font-semibold text-slate-400">
                          Ubah filter atau buat transaksi pembelian baru.
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredPurchases.map((purchase) => {
                    const isDraft = purchase.status === 'DRAFT';
                    const isPosted = purchase.status === 'POSTED';
                    const isVoid = purchase.status === 'VOID';
                    const isCancelled = purchase.status === 'CANCELLED';

                    const branchName = branchNameById.get(purchase.branch_id) || 'Branch tidak ditemukan';
                    const supplierName = supplierNameById.get(purchase.supplier_id) || purchase.supplier_name || 'Supplier tidak ditemukan';
                    const warehouseName = warehouseNameById.get(purchase.warehouse_id) || 'Gudang tidak ditemukan';

                    return (
                      <tr key={`${purchase.purchase_id}-${purchase.purchase_code}`} className="border-b border-slate-100 transition-colors hover:bg-red-50/30">
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                              isPosted ? 'bg-red-600 text-white' : isDraft ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              <ReceiptText size={18} />
                            </div>
                            <div>
                              <div className="font-black text-slate-900">{purchase.purchase_code || purchase.purchase_id}</div>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                <Badge tone="slate">{purchase.purchase_id || '-'}</Badge>
                                {purchase.invoice_number && <Badge tone="amber">{purchase.invoice_number}</Badge>}
                              </div>
                              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                                <CalendarClock size={12} />
                                {purchase.purchase_date ? formatDate(purchase.purchase_date) : '-'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-2">
                            <Truck size={15} className="mt-0.5 shrink-0 text-slate-400" />
                            <div>
                              <div className="text-xs font-black text-slate-900">{supplierName}</div>
                              <div className="mt-1 text-[11px] font-semibold text-slate-400">
                                {purchase.supplier_id || '-'}
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
                                <div className="text-slate-400">{purchase.branch_id || '-'}</div>
                              </div>
                            </div>

                            <div className="flex items-start gap-2">
                              <Warehouse size={14} className="mt-0.5 shrink-0 text-slate-400" />
                              <div>
                                <div className="text-slate-800">{warehouseName}</div>
                                <div className="text-slate-400">{purchase.warehouse_id || '-'}</div>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex items-center gap-2 text-xs font-black text-slate-900">
                            {getPaymentIcon(purchase.payment_method)}
                            {purchase.payment_method || '-'}
                          </div>
                          <div className="mt-2">
                            <Badge tone={purchase.payment_status === 'PAID' ? 'green' : purchase.payment_status === 'PARTIAL' ? 'amber' : 'red'}>
                              {purchase.payment_status || '-'}
                            </Badge>
                          </div>
                          <div className="mt-2 text-[11px] font-bold text-slate-400">
                            Due {purchase.due_date ? formatDate(purchase.due_date) : '-'}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="text-sm font-black text-slate-900">{formatMoney(purchase.total_amount)}</div>
                          <div className="mt-1 text-[11px] font-bold text-emerald-700">
                            Paid {formatMoney(purchase.amount_paid)}
                          </div>
                          <div className={`mt-1 text-[11px] font-black ${purchase.remaining_amount > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                            Sisa {formatMoney(purchase.remaining_amount)}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="text-sm font-black text-slate-900">
                            {(purchase.purchase_items || []).length} item
                          </div>
                          <div className="mt-2 space-y-1">
                            {(purchase.purchase_items || []).slice(0, 3).map((line) => (
                              <div key={line.line_id} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                                <Package size={11} />
                                <span className="max-w-[180px] truncate">{line.raw_material_name}</span>
                              </div>
                            ))}
                            {(purchase.purchase_items || []).length > 3 && (
                              <div className="text-[11px] font-bold text-slate-400">
                                +{(purchase.purchase_items || []).length - 3} item lagi
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <Badge tone={isPosted ? 'green' : isDraft ? 'amber' : isVoid ? 'dark' : 'slate'}>
                            {purchase.status}
                          </Badge>
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                            <History size={12} />
                            {purchase.updated_at ? formatDate(purchase.updated_at) : purchase.purchase_date ? formatDate(purchase.purchase_date) : '-'}
                          </div>
                          {isPosted && (
                            <div className="mt-2">
                              <Badge tone="red">ORCHESTRATOR POSTED</Badge>
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            {isDraft && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEditDraft(purchase)}
                                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                                  title="Edit draft"
                                >
                                  <Edit2 size={15} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleCancelDraft(purchase)}
                                  className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-amber-700 transition-all hover:bg-amber-100"
                                  title="Cancel draft"
                                >
                                  <X size={15} />
                                </button>
                              </>
                            )}

                            {isPosted && (
                              <button
                                type="button"
                                onClick={() => handleVoidPurchase(purchase)}
                                className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100"
                                title="Void transaksi"
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
                Menampilkan <span className="text-slate-800">{filteredPurchases.length}</span> dari <span className="text-slate-800">{purchaseRecords.length}</span> transaksi pembelian.
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge tone="red">Merah = Posted via Orchestrator</Badge>
                <Badge tone="amber">Gold = Draft / Hutang</Badge>
                <Badge tone="dark">Dark = Void / Locked</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
