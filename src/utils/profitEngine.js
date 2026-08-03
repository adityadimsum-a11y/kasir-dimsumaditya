/**
 * ERP DIMSUM ADITYA V2
 * Financial Engine: profitEngine.js
 *
 * Purpose:
 * - Sumber tunggal perhitungan profit ERP Dimsum Aditya.
 *
 * Philosophy:
 * - Omzet bukan profit.
 * - Profit dihitung dari Revenue - HPP - Expense - Biaya Operasional - Beban Lain.
 *
 * Supported Data:
 * - Sales Package
 * - Purchase Package
 * - Accounting Package
 * - Expense
 * - Kasbon
 * - Gaji
 * - Kewajiban
 * - Profit Owner
 *
 * Important Principles:
 * - Engine ini TIDAK menyimpan data.
 * - Engine ini TIDAK update sheet.
 * - Engine ini TIDAK update database.
 * - Engine ini hanya membaca data/package, menghitung, dan membuat profit package.
 * - Profit lama tidak boleh berubah. Gunakan profit_snapshot untuk historical integrity.
 */

import {
  createSnapshot,
  lockSnapshot,
  readSnapshot,
} from './snapshotEngine';

/* =========================================================================
   CONSTANTS
   ========================================================================= */

const ENGINE_VERSION = 'ERP_DA_V2_PROFIT_ENGINE_1';

const DEFAULT_BRANCH_SCOPE = 'GLOBAL';
const CONSOLIDATED_SCOPE = 'CONSOLIDATED';

const PROFIT_STATUS = Object.freeze({
  CALCULATED: 'CALCULATED',
  BLOCKED: 'BLOCKED',
  PARTIAL: 'PARTIAL',
});

const PROFIT_SOURCE_TYPES = Object.freeze({
  SALES: 'SALES',
  PURCHASE: 'PURCHASE',
  ACCOUNTING: 'ACCOUNTING',
  EXPENSE: 'EXPENSE',
  KASBON: 'KASBON',
  PAYROLL: 'PAYROLL',
  OBLIGATION: 'OBLIGATION',
  OWNER_PROFIT: 'OWNER_PROFIT',
});

const EXPENSE_GROUPS = Object.freeze({
  OPERATING: 'OPERATING',
  PAYROLL: 'PAYROLL',
  OBLIGATION: 'OBLIGATION',
  KASBON: 'KASBON',
  OTHER: 'OTHER',
});

const ACCOUNTING_ROLES = Object.freeze({
  SALES_REVENUE: 'SALES_REVENUE',
  COST_OF_GOODS_SOLD: 'COST_OF_GOODS_SOLD',
  OPERATING_EXPENSE: 'OPERATING_EXPENSE',
  CASH_ADVANCE: 'CASH_ADVANCE',
  LIABILITY: 'LIABILITY',
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

const normalizeBranchId = (branchId) => {
  const normalized = normalizeCode(branchId || DEFAULT_BRANCH_SCOPE);
  return normalized || DEFAULT_BRANCH_SCOPE;
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

const dateInRange = (dateValue, options = {}) => {
  const date = normalizeDateString(dateValue);
  const dateFrom = normalizeDateString(options.dateFrom || options.date_from || '');
  const dateTo = normalizeDateString(options.dateTo || options.date_to || '');

  if (!date) return true;
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;

  return true;
};

const branchMatches = (branchId, options = {}) => {
  const requestedBranch = normalizeBranchId(options.branchId || options.branch_id || '');
  const currentBranch = normalizeBranchId(branchId || DEFAULT_BRANCH_SCOPE);

  if (!requestedBranch || requestedBranch === DEFAULT_BRANCH_SCOPE || requestedBranch === 'ALL' || requestedBranch === CONSOLIDATED_SCOPE) {
    return true;
  }

  return currentBranch === requestedBranch;
};

const addAmount = (target, key, amount) => {
  target[key] = roundMoney(safeNumber(target[key], 0) + safeNumber(amount, 0));
};

const marginPct = (profit, revenue) => {
  const safeRevenue = safeNumber(revenue, 0);
  if (safeRevenue <= 0) return 0;

  return (safeNumber(profit, 0) / safeRevenue) * 100;
};

/* =========================================================================
   SOURCE EXTRACTION
   ========================================================================= */

const extractSalesSource = (source = {}) => {
  if (Array.isArray(source)) return source;

  if (!isObject(source)) return [];

  if (Array.isArray(source.sales_packages)) return source.sales_packages;
  if (Array.isArray(source.salesPackages)) return source.salesPackages;
  if (Array.isArray(source.orders)) return source.orders;

  if (isObject(source.dbData)) {
    if (Array.isArray(source.dbData.sales_packages)) return source.dbData.sales_packages;
    if (Array.isArray(source.dbData.salesPackages)) return source.dbData.salesPackages;
    if (Array.isArray(source.dbData.orders)) return source.dbData.orders;
  }

  if (isObject(source.source)) return extractSalesSource(source.source);

  return [];
};

const extractPurchaseSource = (source = {}) => {
  if (!isObject(source)) return [];

  if (Array.isArray(source.purchase_packages)) return source.purchase_packages;
  if (Array.isArray(source.purchasePackages)) return source.purchasePackages;
  if (Array.isArray(source.purchases)) return source.purchases;

  if (isObject(source.dbData)) {
    if (Array.isArray(source.dbData.purchase_packages)) return source.dbData.purchase_packages;
    if (Array.isArray(source.dbData.purchasePackages)) return source.dbData.purchasePackages;
    if (Array.isArray(source.dbData.purchases)) return source.dbData.purchases;
  }

  if (isObject(source.source)) return extractPurchaseSource(source.source);

  return [];
};

const extractAccountingSource = (source = {}) => {
  if (!isObject(source)) return [];

  if (Array.isArray(source.accounting_packages)) return source.accounting_packages;
  if (Array.isArray(source.accountingPackages)) return source.accountingPackages;
  if (Array.isArray(source.journal_packages)) return source.journal_packages;
  if (Array.isArray(source.journalPackages)) return source.journalPackages;
  if (Array.isArray(source.general_ledger)) return source.general_ledger;
  if (Array.isArray(source.generalLedger)) return source.generalLedger;

  if (isObject(source.dbData)) {
    if (Array.isArray(source.dbData.accounting_packages)) return source.dbData.accounting_packages;
    if (Array.isArray(source.dbData.accountingPackages)) return source.dbData.accountingPackages;
    if (Array.isArray(source.dbData.journal_packages)) return source.dbData.journal_packages;
    if (Array.isArray(source.dbData.journalPackages)) return source.dbData.journalPackages;
    if (Array.isArray(source.dbData.general_ledger)) return source.dbData.general_ledger;
    if (Array.isArray(source.dbData.generalLedger)) return source.dbData.generalLedger;
  }

  if (isObject(source.source)) return extractAccountingSource(source.source);

  return [];
};

const extractExpenseSource = (source = {}) => {
  if (!isObject(source)) return [];

  if (Array.isArray(source.expenses)) return source.expenses;
  if (Array.isArray(source.expense_packages)) return source.expense_packages;
  if (Array.isArray(source.expensePackages)) return source.expensePackages;

  if (isObject(source.dbData)) {
    if (Array.isArray(source.dbData.expenses)) return source.dbData.expenses;
    if (Array.isArray(source.dbData.expense_packages)) return source.dbData.expense_packages;
    if (Array.isArray(source.dbData.expensePackages)) return source.dbData.expensePackages;
  }

  if (isObject(source.source)) return extractExpenseSource(source.source);

  return [];
};

const extractPayrollSource = (source = {}) => {
  if (!isObject(source)) return [];

  if (Array.isArray(source.payroll)) return source.payroll;
  if (Array.isArray(source.gaji)) return source.gaji;
  if (Array.isArray(source.payroll_packages)) return source.payroll_packages;
  if (Array.isArray(source.payrollPackages)) return source.payrollPackages;

  if (isObject(source.dbData)) {
    if (Array.isArray(source.dbData.payroll)) return source.dbData.payroll;
    if (Array.isArray(source.dbData.gaji)) return source.dbData.gaji;
    if (Array.isArray(source.dbData.payroll_packages)) return source.dbData.payroll_packages;
    if (Array.isArray(source.dbData.payrollPackages)) return source.dbData.payrollPackages;
  }

  if (isObject(source.source)) return extractPayrollSource(source.source);

  return [];
};

const extractKasbonSource = (source = {}) => {
  if (!isObject(source)) return [];

  if (Array.isArray(source.kasbon)) return source.kasbon;
  if (Array.isArray(source.kasbon_karyawan)) return source.kasbon_karyawan;
  if (Array.isArray(source.cash_advances)) return source.cash_advances;
  if (Array.isArray(source.cashAdvances)) return source.cashAdvances;

  if (isObject(source.dbData)) {
    if (Array.isArray(source.dbData.kasbon)) return source.dbData.kasbon;
    if (Array.isArray(source.dbData.kasbon_karyawan)) return source.dbData.kasbon_karyawan;
    if (Array.isArray(source.dbData.cash_advances)) return source.dbData.cash_advances;
    if (Array.isArray(source.dbData.cashAdvances)) return source.dbData.cashAdvances;
  }

  if (isObject(source.source)) return extractKasbonSource(source.source);

  return [];
};

const extractObligationSource = (source = {}) => {
  if (!isObject(source)) return [];

  const result = [];

  if (Array.isArray(source.master_kewajiban)) result.push(...source.master_kewajiban);
  if (Array.isArray(source.trx_pembayaran_kewajiban)) result.push(...source.trx_pembayaran_kewajiban);
  if (Array.isArray(source.obligations)) result.push(...source.obligations);
  if (Array.isArray(source.kewajiban)) result.push(...source.kewajiban);

  if (isObject(source.dbData)) {
    if (Array.isArray(source.dbData.master_kewajiban)) result.push(...source.dbData.master_kewajiban);
    if (Array.isArray(source.dbData.trx_pembayaran_kewajiban)) result.push(...source.dbData.trx_pembayaran_kewajiban);
    if (Array.isArray(source.dbData.obligations)) result.push(...source.dbData.obligations);
    if (Array.isArray(source.dbData.kewajiban)) result.push(...source.dbData.kewajiban);
  }

  if (isObject(source.source)) result.push(...extractObligationSource(source.source));

  return result;
};

const extractOwnerProfitSource = (source = {}) => {
  if (!isObject(source)) return [];

  if (Array.isArray(source.owner_profit)) return source.owner_profit;
  if (Array.isArray(source.ownerProfit)) return source.ownerProfit;
  if (Array.isArray(source.profit_owner)) return source.profit_owner;
  if (Array.isArray(source.profitOwner)) return source.profitOwner;

  if (isObject(source.dbData)) {
    if (Array.isArray(source.dbData.owner_profit)) return source.dbData.owner_profit;
    if (Array.isArray(source.dbData.ownerProfit)) return source.dbData.ownerProfit;
    if (Array.isArray(source.dbData.profit_owner)) return source.dbData.profit_owner;
    if (Array.isArray(source.dbData.profitOwner)) return source.dbData.profitOwner;
  }

  if (isObject(source.source)) return extractOwnerProfitSource(source.source);

  return [];
};

/* =========================================================================
   NORMALIZE SALES
   ========================================================================= */

const extractSnapshotPayload = (snapshotValue) => {
  if (!snapshotValue) return null;

  const readResult = readSnapshot(snapshotValue, {
    allowInvalid: true,
    freeze: false,
  });

  if (readResult.ok && readResult.snapshot) {
    return readResult.snapshot.payload || readResult.snapshot;
  }

  return parseJson(snapshotValue, null);
};

const normalizeSalesRecord = (record = {}, index = 0) => {
  const packageInput = record.sales_transaction_package || record.salesTransactionPackage || record;
  const orderHeader = packageInput.order_header || record.order_header || record;

  const salesSnapshot =
    packageInput.sales_snapshot ||
    orderHeader.sales_snapshot ||
    parseJson(orderHeader.sales_snapshot_json, null) ||
    parseJson(orderHeader.salesSnapshotJson, null);

  const salesSnapshotPayload = extractSnapshotPayload(salesSnapshot);

  const hppSnapshot =
    packageInput.hpp_snapshot ||
    orderHeader.hpp_snapshot ||
    parseJson(orderHeader.hpp_snapshot_json, null) ||
    parseJson(orderHeader.hppSnapshotJson, null);

  const orderItems =
    packageInput.order_items ||
    salesSnapshotPayload?.order_snapshot?.order_items ||
    salesSnapshotPayload?.transaction_items ||
    record.order_items ||
    parseJson(orderHeader.items_json, []) ||
    parseJson(orderHeader.itemsJson, []) ||
    [];

  const branchId = normalizeBranchId(orderHeader.branch_id || orderHeader.branchId || DEFAULT_BRANCH_SCOPE);

  const totalRevenue = safeNumber(
    orderHeader.total_revenue ??
    orderHeader.total_amount ??
    orderHeader.amount ??
    salesSnapshotPayload?.order_snapshot?.order_header?.total_revenue,
    0,
  );

  const totalHpp = safeNumber(
    orderHeader.total_hpp ??
    salesSnapshotPayload?.order_snapshot?.order_header?.total_hpp ??
    hppSnapshot?.total_hpp,
    0,
  );

  const grossProfit = safeNumber(
    orderHeader.gross_profit ??
    salesSnapshotPayload?.order_snapshot?.order_header?.gross_profit,
    totalRevenue - totalHpp,
  );

  return {
    source_type: PROFIT_SOURCE_TYPES.SALES,
    source_index: index,

    transaction_id: orderHeader.order_id || orderHeader.id || '',
    invoice_number: orderHeader.invoice_number || '',

    date: normalizeDateString(orderHeader.order_date || orderHeader.date || ''),
    branch_id: branchId,
    warehouse_id: orderHeader.warehouse_id || orderHeader.warehouseId || '',
    franchise_id: orderHeader.franchise_id || orderHeader.franchiseId || '',

    customer_id: orderHeader.customer_id || orderHeader.customerId || '',
    customer_name: orderHeader.customer_name || orderHeader.customerName || '',

    sales_channel: normalizeCode(orderHeader.sales_channel || orderHeader.salesChannel || ''),

    total_revenue: roundMoney(totalRevenue),
    total_hpp: roundMoney(totalHpp),
    gross_profit: roundMoney(grossProfit),
    gross_margin_pct: marginPct(grossProfit, totalRevenue),

    items: safeArray(orderItems).map((item, itemIndex) => ({
      index: item.index ?? itemIndex,
      item_id: item.item_id || item.product_id || item.id || '',
      item_name: item.item_name || item.product_name || item.name || '',
      qty: safeNumber(item.qty || item.quantity, 0),
      unit: item.unit || item.satuan || '',
      selling_price: safeNumber(item.selling_price || item.price || item.unit_price, 0),
      subtotal: roundMoney(item.subtotal || item.total || item.total_amount || 0),
      total_hpp: roundMoney(item.total_hpp || item.hpp || 0),
      gross_profit: roundMoney(item.gross_profit || 0),
      margin_pct: safeNumber(item.margin_pct, 0),
    })),

    hpp_snapshot: hppSnapshot || null,
    sales_snapshot: salesSnapshot || null,
    raw: record,
  };
};

const normalizeSalesRecords = (source = {}, options = {}) => {
  const warnings = [];
  const salesRows = extractSalesSource(source);

  const records = salesRows
    .map(normalizeSalesRecord)
    .filter((record) => {
      if (!dateInRange(record.date, options)) return false;
      if (!branchMatches(record.branch_id, options)) return false;
      return true;
    });

  records.forEach((record) => {
    if (record.total_revenue > 0 && record.total_hpp === 0) {
      warnings.push(makeWarning('SALES_HPP_MISSING', 'Sales record memiliki revenue tetapi HPP kosong. Profit bisa terlalu tinggi.', {
        transaction_id: record.transaction_id,
        invoice_number: record.invoice_number,
      }));
    }
  });

  return {
    records,
    warnings,
  };
};

/* =========================================================================
   NORMALIZE EXPENSES
   ========================================================================= */

const normalizeExpenseGroup = (value, fallback = EXPENSE_GROUPS.OPERATING) => {
  const normalized = normalizeCode(value || '');

  if (['PAYROLL', 'GAJI', 'SALARY', 'WAGE', 'UPAH'].includes(normalized)) return EXPENSE_GROUPS.PAYROLL;
  if (['OBLIGATION', 'KEWAJIBAN', 'CICILAN', 'HUTANG'].includes(normalized)) return EXPENSE_GROUPS.OBLIGATION;
  if (['KASBON', 'CASH_ADVANCE'].includes(normalized)) return EXPENSE_GROUPS.KASBON;
  if (['OTHER', 'LAINNYA', 'BEBAN_LAIN'].includes(normalized)) return EXPENSE_GROUPS.OTHER;
  if (['OPERATING', 'OPERASIONAL', 'OPEX', 'EXPENSE'].includes(normalized)) return EXPENSE_GROUPS.OPERATING;

  return fallback;
};

const normalizeExpenseRecord = (record = {}, index = 0, sourceType = PROFIT_SOURCE_TYPES.EXPENSE, forcedGroup = '') => {
  const expense = record.expense || record.expense_package || record;

  const amount = safeNumber(
    expense.amount ??
    expense.total_amount ??
    expense.nominal ??
    expense.nominal_dibayar ??
    expense.gaji_total ??
    expense.total_gaji ??
    expense.value,
    0,
  );

  const branchId = normalizeBranchId(expense.branch_id || expense.branchId || DEFAULT_BRANCH_SCOPE);

  return {
    source_type: sourceType,
    source_index: index,

    transaction_id: expense.expense_id || expense.payment_id || expense.id || '',
    date: normalizeDateString(expense.expense_date || expense.payment_date || expense.tanggal_bayar || expense.date || ''),

    branch_id: branchId,
    category: normalizeCode(expense.category || expense.kategori || expense.type || ''),
    group: forcedGroup || normalizeExpenseGroup(expense.expense_group || expense.group || expense.category || expense.kategori),

    amount: roundMoney(amount),

    description: expense.description || expense.notes || expense.keterangan || '',
    raw: record,
  };
};

const normalizeExpenseRecords = (source = {}, options = {}) => {
  const warnings = [];

  const expenses = extractExpenseSource(source)
    .map((row, index) => normalizeExpenseRecord(row, index, PROFIT_SOURCE_TYPES.EXPENSE, EXPENSE_GROUPS.OPERATING));

  const payroll = extractPayrollSource(source)
    .map((row, index) => normalizeExpenseRecord(row, index, PROFIT_SOURCE_TYPES.PAYROLL, EXPENSE_GROUPS.PAYROLL));

  const obligations = extractObligationSource(source)
    .map((row, index) => normalizeExpenseRecord(row, index, PROFIT_SOURCE_TYPES.OBLIGATION, EXPENSE_GROUPS.OBLIGATION));

  const kasbonRows = extractKasbonSource(source)
    .map((row, index) => normalizeExpenseRecord(row, index, PROFIT_SOURCE_TYPES.KASBON, EXPENSE_GROUPS.KASBON));

  const includeKasbonAsExpense = Boolean(options.includeKasbonAsExpense || options.include_kasbon_as_expense);

  if (kasbonRows.length > 0 && !includeKasbonAsExpense) {
    warnings.push(makeWarning('KASBON_NOT_INCLUDED_AS_EXPENSE', 'Kasbon dibaca sebagai cash advance dan tidak mengurangi net profit kecuali includeKasbonAsExpense=true.', {
      kasbon_count: kasbonRows.length,
    }));
  }

  const combined = [
    ...expenses,
    ...payroll,
    ...obligations,
    ...(includeKasbonAsExpense ? kasbonRows : []),
  ].filter((record) => {
    if (!dateInRange(record.date, options)) return false;
    if (!branchMatches(record.branch_id, options)) return false;
    return true;
  });

  const excluded = includeKasbonAsExpense
    ? []
    : kasbonRows.filter((record) => {
        if (!dateInRange(record.date, options)) return false;
        if (!branchMatches(record.branch_id, options)) return false;
        return true;
      });

  combined.forEach((record) => {
    if (record.amount < 0) {
      warnings.push(makeWarning('NEGATIVE_EXPENSE_AMOUNT', 'Expense bernilai negatif. Pastikan ini transaksi reversal atau koreksi.', {
        transaction_id: record.transaction_id,
        amount: record.amount,
      }));
    }
  });

  return {
    records: combined,
    excluded_kasbon: excluded,
    warnings,
  };
};

/* =========================================================================
   NORMALIZE PURCHASES
   ========================================================================= */

const normalizePurchaseRecord = (record = {}, index = 0) => {
  const packageInput = record.purchase_transaction_package || record.purchaseTransactionPackage || record;
  const purchaseHeader = packageInput.purchase_header || record.purchase_header || record;

  const totalAmount = safeNumber(purchaseHeader.total_amount || purchaseHeader.amount, 0);

  return {
    source_type: PROFIT_SOURCE_TYPES.PURCHASE,
    source_index: index,
    transaction_id: purchaseHeader.purchase_id || purchaseHeader.id || '',
    date: normalizeDateString(purchaseHeader.purchase_date || purchaseHeader.date || ''),
    branch_id: normalizeBranchId(purchaseHeader.branch_id || DEFAULT_BRANCH_SCOPE),
    supplier_id: purchaseHeader.supplier_id || '',
    supplier_name: purchaseHeader.supplier_name || '',
    total_amount: roundMoney(totalAmount),
    inventory_layers: safeArray(packageInput.inventory_layers),
    raw: record,
  };
};

const normalizePurchaseRecords = (source = {}, options = {}) => {
  const rows = extractPurchaseSource(source);

  return rows
    .map(normalizePurchaseRecord)
    .filter((record) => {
      if (!dateInRange(record.date, options)) return false;
      if (!branchMatches(record.branch_id, options)) return false;
      return true;
    });
};

/* =========================================================================
   NORMALIZE ACCOUNTING PACKAGES
   ========================================================================= */

const normalizeAccountingPackage = (record = {}, index = 0) => {
  const packageInput = record.journal_package || record.accounting_package || record;
  const journalHeader = packageInput.journal_header || record.journal_header || record;

  const lines = safeArray(packageInput.journal_lines || record.journal_lines || record.lines);

  return {
    source_type: PROFIT_SOURCE_TYPES.ACCOUNTING,
    source_index: index,
    journal_id: journalHeader.journal_id || journalHeader.id || '',
    journal_type: normalizeCode(journalHeader.journal_type || ''),
    date: normalizeDateString(journalHeader.journal_date || journalHeader.date || ''),
    branch_id: normalizeBranchId(journalHeader.branch_id || DEFAULT_BRANCH_SCOPE),
    lines: lines.map((line) => ({
      account_code: line.account_code || '',
      account_name: line.account_name || '',
      account_role: normalizeCode(line.account_role || line.meta?.role || ''),
      debit: roundMoney(line.debit || 0),
      credit: roundMoney(line.credit || 0),
      description: line.description || '',
    })),
    raw: record,
  };
};

const normalizeAccountingRecords = (source = {}, options = {}) => {
  const rows = extractAccountingSource(source);

  return rows
    .map(normalizeAccountingPackage)
    .filter((record) => {
      if (!dateInRange(record.date, options)) return false;
      if (!branchMatches(record.branch_id, options)) return false;
      return true;
    });
};

const summarizeAccountingRecords = (records = []) => {
  const summary = {
    revenue: 0,
    hpp: 0,
    expense: 0,
    other_income: 0,
    other_expense: 0,
    journal_count: records.length,
  };

  records.forEach((record) => {
    safeArray(record.lines).forEach((line) => {
      const role = normalizeCode(line.account_role);
      const debit = safeNumber(line.debit, 0);
      const credit = safeNumber(line.credit, 0);

      if (role === ACCOUNTING_ROLES.SALES_REVENUE) {
        addAmount(summary, 'revenue', credit - debit);
      }

      if (role === ACCOUNTING_ROLES.COST_OF_GOODS_SOLD) {
        addAmount(summary, 'hpp', debit - credit);
      }

      if (role === ACCOUNTING_ROLES.OPERATING_EXPENSE) {
        addAmount(summary, 'expense', debit - credit);
      }

      if (role === ACCOUNTING_ROLES.CASH_ADVANCE) {
        addAmount(summary, 'other_expense', debit - credit);
      }
    });
  });

  return {
    revenue: roundMoney(summary.revenue),
    hpp: roundMoney(summary.hpp),
    expense: roundMoney(summary.expense),
    other_income: roundMoney(summary.other_income),
    other_expense: roundMoney(summary.other_expense),
    journal_count: summary.journal_count,
  };
};

/* =========================================================================
   SUMMARY CALCULATORS
   ========================================================================= */

const summarizeRevenue = (salesRecords = [], accountingSummary = null, options = {}) => {
  const salesRevenue = roundMoney(
    salesRecords.reduce((sum, record) => sum + safeNumber(record.total_revenue, 0), 0),
  );

  const useAccountingAsSource =
    Boolean(options.useAccountingAsSource || options.use_accounting_as_source) ||
    (salesRecords.length === 0 && accountingSummary && accountingSummary.revenue !== 0);

  const revenue = useAccountingAsSource
    ? roundMoney(accountingSummary?.revenue || 0)
    : salesRevenue;

  return {
    source: useAccountingAsSource ? 'ACCOUNTING_PACKAGE' : 'SALES_PACKAGE',
    total_revenue: revenue,
    sales_revenue: salesRevenue,
    accounting_revenue: roundMoney(accountingSummary?.revenue || 0),
    transaction_count: salesRecords.length,
  };
};

const summarizeHpp = (salesRecords = [], accountingSummary = null, options = {}) => {
  const salesHpp = roundMoney(
    salesRecords.reduce((sum, record) => sum + safeNumber(record.total_hpp, 0), 0),
  );

  const useAccountingAsSource =
    Boolean(options.useAccountingAsSource || options.use_accounting_as_source) ||
    (salesRecords.length === 0 && accountingSummary && accountingSummary.hpp !== 0);

  const hpp = useAccountingAsSource
    ? roundMoney(accountingSummary?.hpp || 0)
    : salesHpp;

  return {
    source: useAccountingAsSource ? 'ACCOUNTING_PACKAGE' : 'SALES_PACKAGE_HPP_SNAPSHOT',
    total_hpp: hpp,
    sales_hpp: salesHpp,
    accounting_hpp: roundMoney(accountingSummary?.hpp || 0),
    transaction_count: salesRecords.length,
  };
};

const summarizeExpenses = (expenseRecords = [], accountingSummary = null, options = {}) => {
  const byGroup = {
    [EXPENSE_GROUPS.OPERATING]: 0,
    [EXPENSE_GROUPS.PAYROLL]: 0,
    [EXPENSE_GROUPS.OBLIGATION]: 0,
    [EXPENSE_GROUPS.KASBON]: 0,
    [EXPENSE_GROUPS.OTHER]: 0,
  };

  expenseRecords.forEach((record) => {
    const group = byGroup[record.group] !== undefined ? record.group : EXPENSE_GROUPS.OTHER;
    addAmount(byGroup, group, record.amount);
  });

  const directExpense = roundMoney(Object.values(byGroup).reduce((sum, amount) => sum + safeNumber(amount, 0), 0));

  const useAccountingAsExpenseSource =
    Boolean(options.useAccountingAsExpenseSource || options.use_accounting_as_expense_source) ||
    (expenseRecords.length === 0 && accountingSummary && accountingSummary.expense !== 0);

  const accountingExpense = roundMoney((accountingSummary?.expense || 0) + (accountingSummary?.other_expense || 0));

  const totalExpense = useAccountingAsExpenseSource
    ? accountingExpense
    : directExpense;

  return {
    source: useAccountingAsExpenseSource ? 'ACCOUNTING_PACKAGE' : 'EXPENSE_PAYROLL_OBLIGATION_PACKAGE',
    total_expense: totalExpense,

    operating_expense: roundMoney(byGroup[EXPENSE_GROUPS.OPERATING]),
    payroll_expense: roundMoney(byGroup[EXPENSE_GROUPS.PAYROLL]),
    obligation_expense: roundMoney(byGroup[EXPENSE_GROUPS.OBLIGATION]),
    kasbon_expense: roundMoney(byGroup[EXPENSE_GROUPS.KASBON]),
    other_expense: roundMoney(byGroup[EXPENSE_GROUPS.OTHER]),

    direct_expense: directExpense,
    accounting_expense: accountingExpense,

    transaction_count: expenseRecords.length,
    by_group: Object.keys(byGroup).map((group) => ({
      group,
      amount: roundMoney(byGroup[group]),
    })),
  };
};

const summarizePurchases = (purchaseRecords = []) => {
  const totalPurchaseCapital = roundMoney(
    purchaseRecords.reduce((sum, record) => sum + safeNumber(record.total_amount, 0), 0),
  );

  return {
    total_purchase_capital: totalPurchaseCapital,
    transaction_count: purchaseRecords.length,
    note: 'Purchase dibaca sebagai sumber modal/stok. Purchase tidak otomatis menjadi expense profit sampai keluar sebagai HPP atau expense resmi.',
  };
};

/* =========================================================================
   PROFIT CORE FUNCTIONS
   ========================================================================= */

export const calculateGrossProfit = (params = {}) => {
  const totalRevenue = safeNumber(params.totalRevenue ?? params.total_revenue ?? params.revenue, 0);
  const totalHpp = safeNumber(params.totalHpp ?? params.total_hpp ?? params.hpp, 0);

  const grossProfit = totalRevenue - totalHpp;

  return {
    total_revenue: roundMoney(totalRevenue),
    total_hpp: roundMoney(totalHpp),
    gross_profit: roundMoney(grossProfit),
    gross_margin_pct: marginPct(grossProfit, totalRevenue),
    margin_pct: marginPct(grossProfit, totalRevenue),
  };
};

export const calculateOperatingProfit = (params = {}) => {
  const grossProfit = safeNumber(params.grossProfit ?? params.gross_profit, 0);
  const operatingExpense = safeNumber(params.operatingExpense ?? params.operating_expense, 0);
  const payrollExpense = safeNumber(params.payrollExpense ?? params.payroll_expense, 0);

  const operatingProfit = grossProfit - operatingExpense - payrollExpense;

  return {
    gross_profit: roundMoney(grossProfit),
    operating_expense: roundMoney(operatingExpense),
    payroll_expense: roundMoney(payrollExpense),
    operating_profit: roundMoney(operatingProfit),
  };
};

export const calculateNetProfit = (params = {}) => {
  const operatingProfit = safeNumber(params.operatingProfit ?? params.operating_profit, 0);
  const obligationExpense = safeNumber(params.obligationExpense ?? params.obligation_expense, 0);
  const otherExpense = safeNumber(params.otherExpense ?? params.other_expense, 0);
  const otherIncome = safeNumber(params.otherIncome ?? params.other_income, 0);

  const netProfit = operatingProfit + otherIncome - obligationExpense - otherExpense;

  return {
    operating_profit: roundMoney(operatingProfit),
    other_income: roundMoney(otherIncome),
    obligation_expense: roundMoney(obligationExpense),
    other_expense: roundMoney(otherExpense),
    net_profit: roundMoney(netProfit),
  };
};

export const calculateOwnerShare = (params = {}) => {
  const warnings = [];

  const netProfit = safeNumber(params.netProfit ?? params.net_profit, 0);
  const ownerRule = params.ownerShareRule || params.owner_share_rule || params.ownerConfig || params.owner_config || {};

  let ownerShareAmount = safeNumber(
    ownerRule.amount ??
    ownerRule.owner_share_amount ??
    params.ownerShareAmount ??
    params.owner_share_amount,
    NaN,
  );

  const ownerSharePct = safeNumber(
    ownerRule.pct ??
    ownerRule.percent ??
    ownerRule.owner_share_pct ??
    params.ownerSharePct ??
    params.owner_share_pct,
    NaN,
  );

  if (!Number.isFinite(ownerShareAmount)) {
    if (Number.isFinite(ownerSharePct)) {
      ownerShareAmount = netProfit * (ownerSharePct / 100);
    } else {
      ownerShareAmount = 0;
      warnings.push(makeWarning('OWNER_SHARE_RULE_NOT_PROVIDED', 'Rule Profit Owner belum diberikan. owner_share_amount dihitung 0 agar ERP tidak mengambil keputusan otomatis.'));
    }
  }

  const safeOwnerShare = Math.max(0, Math.min(ownerShareAmount, Math.max(netProfit, 0)));
  const retainedProfit = netProfit - safeOwnerShare;

  return {
    net_profit: roundMoney(netProfit),
    owner_share_pct: Number.isFinite(ownerSharePct) ? ownerSharePct : null,
    owner_share_amount: roundMoney(safeOwnerShare),
    retained_profit: roundMoney(retainedProfit),
    brankas_profit_owner: {
      amount: roundMoney(safeOwnerShare),
      source: Number.isFinite(ownerSharePct) || ownerRule.amount !== undefined
        ? 'OWNER_RULE'
        : 'NO_RULE',
      rule: isObject(ownerRule) ? ownerRule : {},
    },
    warnings,
  };
};

/* =========================================================================
   DIMENSIONAL ANALYTICS
   ========================================================================= */

const upsertSummaryRow = (map, key, base = {}) => {
  const safeKey = key || 'UNKNOWN';

  if (!map.has(safeKey)) {
    map.set(safeKey, {
      key: safeKey,
      total_revenue: 0,
      total_hpp: 0,
      gross_profit: 0,
      transaction_count: 0,
      item_count: 0,
      ...base,
    });
  }

  return map.get(safeKey);
};

const finalizeProfitRows = (rows = []) => {
  return rows.map((row) => ({
    ...row,
    total_revenue: roundMoney(row.total_revenue),
    total_hpp: roundMoney(row.total_hpp),
    gross_profit: roundMoney(row.gross_profit),
    gross_margin_pct: marginPct(row.gross_profit, row.total_revenue),
    margin_pct: marginPct(row.gross_profit, row.total_revenue),
  }));
};

export const calculateProfitByChannel = (source = {}, options = {}) => {
  const sales = normalizeSalesRecords(source, options);
  const map = new Map();

  sales.records.forEach((record) => {
    const channel = record.sales_channel || 'UNKNOWN';
    const row = upsertSummaryRow(map, channel, {
      sales_channel: channel,
    });

    addAmount(row, 'total_revenue', record.total_revenue);
    addAmount(row, 'total_hpp', record.total_hpp);
    addAmount(row, 'gross_profit', record.gross_profit);
    row.transaction_count += 1;
    row.item_count += safeArray(record.items).length;
  });

  return {
    ok: true,
    by_channel: finalizeProfitRows(Array.from(map.values())),
    warnings: sales.warnings,
  };
};

export const calculateProfitByProduct = (source = {}, options = {}) => {
  const warnings = [];
  const sales = normalizeSalesRecords(source, options);
  warnings.push(...sales.warnings);

  const map = new Map();

  sales.records.forEach((record) => {
    safeArray(record.items).forEach((item) => {
      const key = item.item_id || item.item_name || 'UNKNOWN';
      const revenue = safeNumber(item.subtotal, 0);
      const hpp = safeNumber(item.total_hpp, 0);
      const profit = hpp === 0 && revenue > 0
        ? 0
        : revenue - hpp;

      if (revenue > 0 && hpp === 0) {
        warnings.push(makeWarning('PRODUCT_HPP_MISSING', 'HPP produk kosong pada order item. Profit produk tidak dihitung penuh.', {
          transaction_id: record.transaction_id,
          item_id: item.item_id,
          item_name: item.item_name,
        }));
      }

      const row = upsertSummaryRow(map, key, {
        product_id: item.item_id,
        product_name: item.item_name,
        qty_sold: 0,
        unit: item.unit || '',
      });

      addAmount(row, 'total_revenue', revenue);
      addAmount(row, 'total_hpp', hpp);
      addAmount(row, 'gross_profit', profit);
      addAmount(row, 'qty_sold', item.qty);
      row.transaction_count += 1;
      row.item_count += 1;
    });
  });

  return {
    ok: true,
    by_product: finalizeProfitRows(Array.from(map.values())),
    warnings,
  };
};

export const calculateProfitByCustomer = (source = {}, options = {}) => {
  const sales = normalizeSalesRecords(source, options);
  const map = new Map();

  sales.records.forEach((record) => {
    const key = record.customer_id || record.customer_name || 'UNKNOWN';
    const row = upsertSummaryRow(map, key, {
      customer_id: record.customer_id,
      customer_name: record.customer_name,
    });

    addAmount(row, 'total_revenue', record.total_revenue);
    addAmount(row, 'total_hpp', record.total_hpp);
    addAmount(row, 'gross_profit', record.gross_profit);
    row.transaction_count += 1;
    row.item_count += safeArray(record.items).length;
  });

  return {
    ok: true,
    by_customer: finalizeProfitRows(Array.from(map.values())),
    warnings: sales.warnings,
  };
};

/* =========================================================================
   BRANCH & CONSOLIDATED PROFIT
   ========================================================================= */

const createProfitPackageFromRecords = (records = {}, options = {}) => {
  const warnings = [];

  const salesRecords = safeArray(records.salesRecords);
  const purchaseRecords = safeArray(records.purchaseRecords);
  const expenseRecords = safeArray(records.expenseRecords);
  const excludedKasbon = safeArray(records.excludedKasbon);
  const accountingRecords = safeArray(records.accountingRecords);

  warnings.push(...safeArray(records.warnings));

  const accountingSummary = summarizeAccountingRecords(accountingRecords);

  const revenueSummary = summarizeRevenue(salesRecords, accountingSummary, options);
  const hppSummary = summarizeHpp(salesRecords, accountingSummary, options);
  const expenseSummary = summarizeExpenses(expenseRecords, accountingSummary, options);
  const purchaseSummary = summarizePurchases(purchaseRecords);

  const gross = calculateGrossProfit({
    totalRevenue: revenueSummary.total_revenue,
    totalHpp: hppSummary.total_hpp,
  });

  const operating = calculateOperatingProfit({
    grossProfit: gross.gross_profit,
    operatingExpense: expenseSummary.operating_expense,
    payrollExpense: expenseSummary.payroll_expense,
  });

  const net = calculateNetProfit({
    operatingProfit: operating.operating_profit,
    obligationExpense: expenseSummary.obligation_expense,
    otherExpense: expenseSummary.other_expense + expenseSummary.kasbon_expense,
    otherIncome: safeNumber(options.otherIncome || options.other_income, 0),
  });

  const ownerShare = calculateOwnerShare({
    netProfit: net.net_profit,
    ownerShareRule: options.ownerShareRule || options.owner_share_rule || options.ownerConfig || options.owner_config || {},
  });

  warnings.push(...ownerShare.warnings);

  const branchId = normalizeBranchId(options.branchId || options.branch_id || CONSOLIDATED_SCOPE);

  const analyticsChannel = calculateProfitByChannel({
    sales_packages: salesRecords,
  }, {});
  const analyticsProduct = calculateProfitByProduct({
    sales_packages: salesRecords,
  }, {});
  const analyticsCustomer = calculateProfitByCustomer({
    sales_packages: salesRecords,
  }, {});

  warnings.push(...analyticsChannel.warnings);
  warnings.push(...analyticsProduct.warnings);
  warnings.push(...analyticsCustomer.warnings);

  const profitCore = {
    revenue_summary: revenueSummary,
    hpp_summary: hppSummary,
    expense_summary: expenseSummary,
    purchase_summary: purchaseSummary,

    gross_profit: gross.gross_profit,
    gross_margin_pct: gross.gross_margin_pct,

    operating_profit: operating.operating_profit,
    net_profit: net.net_profit,

    owner_share: ownerShare,

    excluded_kasbon_summary: {
      total_excluded_kasbon: roundMoney(excludedKasbon.reduce((sum, row) => sum + safeNumber(row.amount, 0), 0)),
      transaction_count: excludedKasbon.length,
      note: 'Kasbon tidak otomatis menjadi expense kecuali includeKasbonAsExpense=true.',
    },

    analytics: {
      by_channel: analyticsChannel.by_channel,
      by_product: analyticsProduct.by_product,
      by_customer: analyticsCustomer.by_customer,
    },
  };

  const profitSnapshotResult = createProfitSnapshot({
    branch_id: branchId,
    report_type: branchId === CONSOLIDATED_SCOPE || branchId === 'ALL' ? 'CONSOLIDATED' : 'BRANCH',
    date_from: options.dateFrom || options.date_from || '',
    date_to: options.dateTo || options.date_to || '',
    profit_payload: profitCore,
    warnings,
    created_by: options.createdBy || options.created_by || 'SYSTEM',
  }, {
    lock: true,
  });

  warnings.push(...profitSnapshotResult.warnings);

  const profitPackage = {
    package_type: 'PROFIT_PACKAGE',
    package_version: ENGINE_VERSION,
    generated_at: new Date().toISOString(),

    report_type: branchId === CONSOLIDATED_SCOPE || branchId === 'ALL' ? 'CONSOLIDATED' : 'BRANCH',
    branch_id: branchId,
    date_from: normalizeDateString(options.dateFrom || options.date_from || ''),
    date_to: normalizeDateString(options.dateTo || options.date_to || ''),

    ...profitCore,

    profit_snapshot: profitSnapshotResult.snapshot || null,

    status: profitSnapshotResult.ok ? PROFIT_STATUS.CALCULATED : PROFIT_STATUS.PARTIAL,
    warnings,
  };

  return {
    ok: true,
    profit_package: profitPackage,
    warnings,
  };
};

export const calculateBranchProfit = (source = {}, options = {}) => {
  const branchId = normalizeBranchId(options.branchId || options.branch_id || '');

  const scopedOptions = {
    ...options,
    branchId,
    branch_id: branchId,
  };

  const sales = normalizeSalesRecords(source, scopedOptions);
  const expenses = normalizeExpenseRecords(source, scopedOptions);
  const purchases = normalizePurchaseRecords(source, scopedOptions);
  const accounting = normalizeAccountingRecords(source, scopedOptions);

  return createProfitPackageFromRecords({
    salesRecords: sales.records,
    purchaseRecords: purchases,
    expenseRecords: expenses.records,
    excludedKasbon: expenses.excluded_kasbon,
    accountingRecords: accounting,
    warnings: [
      ...sales.warnings,
      ...expenses.warnings,
    ],
  }, scopedOptions);
};

export const calculateConsolidatedProfit = (source = {}, options = {}) => {
  const scopedOptions = {
    ...options,
    branchId: CONSOLIDATED_SCOPE,
    branch_id: CONSOLIDATED_SCOPE,
  };

  const sales = normalizeSalesRecords(source, scopedOptions);
  const expenses = normalizeExpenseRecords(source, scopedOptions);
  const purchases = normalizePurchaseRecords(source, scopedOptions);
  const accounting = normalizeAccountingRecords(source, scopedOptions);

  const consolidated = createProfitPackageFromRecords({
    salesRecords: sales.records,
    purchaseRecords: purchases,
    expenseRecords: expenses.records,
    excludedKasbon: expenses.excluded_kasbon,
    accountingRecords: accounting,
    warnings: [
      ...sales.warnings,
      ...expenses.warnings,
    ],
  }, scopedOptions);

  const branchMap = new Map();

  sales.records.forEach((record) => {
    const key = record.branch_id || DEFAULT_BRANCH_SCOPE;
    if (!branchMap.has(key)) {
      branchMap.set(key, {
        branch_id: key,
        total_revenue: 0,
        total_hpp: 0,
        gross_profit: 0,
        expense: 0,
        net_profit: 0,
        transaction_count: 0,
      });
    }

    const row = branchMap.get(key);
    addAmount(row, 'total_revenue', record.total_revenue);
    addAmount(row, 'total_hpp', record.total_hpp);
    addAmount(row, 'gross_profit', record.gross_profit);
    row.transaction_count += 1;
  });

  expenses.records.forEach((record) => {
    const key = record.branch_id || DEFAULT_BRANCH_SCOPE;
    if (!branchMap.has(key)) {
      branchMap.set(key, {
        branch_id: key,
        total_revenue: 0,
        total_hpp: 0,
        gross_profit: 0,
        expense: 0,
        net_profit: 0,
        transaction_count: 0,
      });
    }

    const row = branchMap.get(key);
    addAmount(row, 'expense', record.amount);
  });

  const byBranch = Array.from(branchMap.values()).map((row) => ({
    ...row,
    total_revenue: roundMoney(row.total_revenue),
    total_hpp: roundMoney(row.total_hpp),
    gross_profit: roundMoney(row.gross_profit),
    expense: roundMoney(row.expense),
    net_profit: roundMoney(row.gross_profit - row.expense),
    gross_margin_pct: marginPct(row.gross_profit, row.total_revenue),
  }));

  consolidated.profit_package.consolidated_report = {
    owner_god_mode_scope: 'TANGERANG_CONTROL_CENTER',
    by_branch: byBranch,
  };

  return consolidated;
};

/* =========================================================================
   PROFIT SNAPSHOT
   ========================================================================= */

export const createProfitSnapshot = (input = {}, options = {}) => {
  const branchId = normalizeBranchId(input.branch_id || input.branchId || DEFAULT_BRANCH_SCOPE);

  const snapshotResult = createSnapshot({
    snapshot_type: 'PROFIT',
    snapshot_version: ENGINE_VERSION,

    transaction_id: input.transaction_id || input.transactionId || input.report_id || generateId('PROFIT-RPT'),
    transaction_type: input.report_type || input.reportType || 'PROFIT_REPORT',

    branch_id: branchId,
    created_by: input.created_by || input.createdBy || 'SYSTEM',

    engine_versions: {
      profitEngine: ENGINE_VERSION,
    },

    payload: {
      report_type: input.report_type || input.reportType || '',
      branch_id: branchId,
      date_from: normalizeDateString(input.date_from || input.dateFrom || ''),
      date_to: normalizeDateString(input.date_to || input.dateTo || ''),
      profit_payload: input.profit_payload || input.profitPayload || {},
    },

    warnings: input.warnings || [],

    meta: {
      source_module: 'profitEngine',
      historical_integrity: true,
    },
  }, {
    freeze: false,
    allowInvalid: true,
  });

  if (options.lock === false) {
    return snapshotResult;
  }

  const locked = lockSnapshot(snapshotResult.snapshot, {
    allowInvalid: true,
    lockedBy: input.created_by || input.createdBy || 'SYSTEM',
  });

  return {
    ok: locked.ok,
    snapshot: locked.snapshot || snapshotResult.snapshot,
    warnings: [
      ...snapshotResult.warnings,
      ...locked.warnings,
    ],
  };
};

/* =========================================================================
   DEFAULT EXPORT
   ========================================================================= */

export default {
  calculateGrossProfit,
  calculateOperatingProfit,
  calculateNetProfit,
  calculateOwnerShare,

  calculateBranchProfit,
  calculateConsolidatedProfit,

  calculateProfitByChannel,
  calculateProfitByProduct,
  calculateProfitByCustomer,

  createProfitSnapshot,
};
