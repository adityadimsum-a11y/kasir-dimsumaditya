import React, { useMemo, useState } from 'react';
import {
  Wallet,
  Search,
  Filter,
  Building,
  User,
  Shield,
  AlertTriangle,
  Calendar,
  FileText,
  History,
  Users,
  TrendingUp,
  RotateCcw,
  Send,
  Eye,
  Banknote,
  CreditCard,
  Landmark,
  CheckCircle,
  Clock,
  X,
  Download,
} from 'lucide-react';

import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import erpOrchestrator from '../../services/erpOrchestrator';

// ======================================================
// LUCIDE ICON COMPATIBILITY
// Project lama pakai lucide-react versi lama.
// Alias ini menjaga nama icon lama tetap bisa dipakai
// tanpa memaksa update dependency lucide-react.
// ======================================================

const WalletCards = Wallet;
const Building2 = Building;
const UserRound = User;
const ShieldCheck = Shield;
const CalendarClock = Calendar;
const ReceiptText = FileText;
const Crown = Users;
const Undo2 = RotateCcw;
const BadgeDollarSign = Wallet;
const ArrowDownCircle = Download;

const RECEIVABLE_PAYMENT_TABLE_NAME = 'receivable_payments';

const RECEIVABLE_STATUS = [
  'OPEN',
  'PARTIAL',
  'OVERDUE',
  'PAID',
  'VOID',
];

const DUE_FILTERS = [
  'ALL',
  'NOT_DUE',
  'DUE_TODAY',
  'OVERDUE',
  'AGING_0_30',
  'AGING_31_60',
  'AGING_61_90',
  'AGING_GT_90',
];

const PAYMENT_METHODS = [
  'CASH',
  'TRANSFER',
  'QRIS',
];

const DEFAULT_PAYMENT_FORM = {
  payment_id: '',
  payment_code: '',
  payment_date: '',
  receivable_id: '',
  receivable_code: '',
  sales_id: '',
  customer_id: '',
  customer_name: '',
  branch_id: '',
  account_id: '',
  account_name: '',
  payment_method: 'TRANSFER',
  amount: '',
  reference_number: '',
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

const formatMoney = (value) => {
  return `Rp${roundMoney(value).toLocaleString('id-ID')}`;
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

const daysBetween = (fromDate, toDate) => {
  if (!fromDate || !toDate) return 0;

  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;

  return Math.floor((to.getTime() - from.getTime()) / 86400000);
};

const getAgingBucket = (agingDays) => {
  const days = Math.max(toNumber(agingDays), 0);

  if (days <= 30) return '0 - 30 hari';
  if (days <= 60) return '31 - 60 hari';
  if (days <= 90) return '61 - 90 hari';

  return '> 90 hari';
};

const normalizeReceivableStatus = ({ status, outstandingBalance, dueDate, todayStr }) => {
  const normalized = normalizeCode(status || '');

  if (normalized === 'VOID') return 'VOID';

  if (roundMoney(outstandingBalance) <= 0) return 'PAID';

  if (dueDate && dueDate < todayStr) return 'OVERDUE';

  if (['PARTIAL', 'SEBAGIAN'].includes(normalized)) return 'PARTIAL';
  if (['OVERDUE', 'JATUH_TEMPO'].includes(normalized)) return 'OVERDUE';
  if (['OPEN', 'UNPAID', 'PIUTANG'].includes(normalized)) return 'OPEN';

  return 'OPEN';
};

const normalizePaymentStatus = (row) => {
  const normalized = normalizeCode(row?.status || row?.payment_status || row?.transaction_status || 'POSTED');

  if (['VOID', 'VOIDED'].includes(normalized)) return 'VOID';
  if (['POSTED', 'PAID', 'FINAL', 'LOCKED'].includes(normalized)) return 'POSTED';
  if (['DRAFT', 'OPEN'].includes(normalized)) return 'DRAFT';

  return normalized || 'POSTED';
};

const getRawReceivableRows = ({
  receivables,
  accountReceivables,
  account_receivables,
  piutang,
  piutang_customers,
  receivableRecords,
  receivable_records,
  dbData,
}) => {
  return [
    ...safeArray(receivables),
    ...safeArray(accountReceivables),
    ...safeArray(account_receivables),
    ...safeArray(piutang),
    ...safeArray(piutang_customers),
    ...safeArray(receivableRecords),
    ...safeArray(receivable_records),
    ...safeArray(dbData?.receivables),
    ...safeArray(dbData?.accountReceivables),
    ...safeArray(dbData?.account_receivables),
    ...safeArray(dbData?.piutang),
    ...safeArray(dbData?.piutang_customers),
    ...safeArray(dbData?.receivableRecords),
    ...safeArray(dbData?.receivable_records),
  ];
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

const getRawPaymentRows = ({
  receivablePayments,
  receivable_payments,
  piutangPayments,
  piutang_payments,
  collectionPayments,
  collection_payments,
  dbData,
}) => {
  return [
    ...safeArray(receivablePayments),
    ...safeArray(receivable_payments),
    ...safeArray(piutangPayments),
    ...safeArray(piutang_payments),
    ...safeArray(collectionPayments),
    ...safeArray(collection_payments),
    ...safeArray(dbData?.receivablePayments),
    ...safeArray(dbData?.receivable_payments),
    ...safeArray(dbData?.piutangPayments),
    ...safeArray(dbData?.piutang_payments),
    ...safeArray(dbData?.collectionPayments),
    ...safeArray(dbData?.collection_payments),
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

const getRawAccountRows = ({
  masterCashBankAccounts,
  master_cash_bank_accounts,
  cashBankAccounts,
  cash_bank_accounts,
  masterAccounts,
  master_accounts,
  bankAccounts,
  bank_accounts,
  cashAccounts,
  cash_accounts,
  dbData,
}) => {
  if (Array.isArray(master_cash_bank_accounts)) return master_cash_bank_accounts;
  if (Array.isArray(masterCashBankAccounts)) return masterCashBankAccounts;
  if (Array.isArray(cash_bank_accounts)) return cash_bank_accounts;
  if (Array.isArray(cashBankAccounts)) return cashBankAccounts;
  if (Array.isArray(master_accounts)) return master_accounts;
  if (Array.isArray(masterAccounts)) return masterAccounts;
  if (Array.isArray(bank_accounts)) return bank_accounts;
  if (Array.isArray(bankAccounts)) return bankAccounts;
  if (Array.isArray(cash_accounts)) return cash_accounts;
  if (Array.isArray(cashAccounts)) return cashAccounts;

  if (Array.isArray(dbData?.master_cash_bank_accounts)) return dbData.master_cash_bank_accounts;
  if (Array.isArray(dbData?.masterCashBankAccounts)) return dbData.masterCashBankAccounts;
  if (Array.isArray(dbData?.cash_bank_accounts)) return dbData.cash_bank_accounts;
  if (Array.isArray(dbData?.cashBankAccounts)) return dbData.cashBankAccounts;
  if (Array.isArray(dbData?.master_accounts)) return dbData.master_accounts;
  if (Array.isArray(dbData?.masterAccounts)) return dbData.masterAccounts;
  if (Array.isArray(dbData?.bank_accounts)) return dbData.bank_accounts;
  if (Array.isArray(dbData?.bankAccounts)) return dbData.bankAccounts;
  if (Array.isArray(dbData?.cash_accounts)) return dbData.cash_accounts;
  if (Array.isArray(dbData?.cashAccounts)) return dbData.cashAccounts;

  return [];
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

const normalizeCustomerDisplay = (record) => {
  const raw = record?.raw || record || {};
  const customerId = String(raw.customer_id || raw.customerId || record?.id || raw.id || '').trim();

  return {
    id: String(raw.id || customerId).trim(),
    customer_id: customerId,
    customer_code: String(raw.customer_code || raw.customerCode || raw.code || customerId || '').trim(),
    customer_name: String(raw.customer_name || raw.customerName || raw.nama_pelanggan || raw.name || record?.name || '').trim(),
    customer_type: normalizeCode(raw.customer_type || raw.customerType || raw.type || 'RETAIL'),
    branch_id: String(raw.branch_id || raw.branchId || record?.branch_id || '').trim(),
    status: normalizeMasterStatus(raw),
    isDeleted: isSoftDeleted(raw),
    raw,
  };
};

const normalizeAccountDisplay = (record) => {
  const raw = record?.raw || record || {};
  const accountId = String(raw.account_id || raw.accountId || raw.cash_account_id || raw.bank_account_id || raw.id || record?.id || '').trim();

  return {
    id: String(raw.id || accountId).trim(),
    account_id: accountId,
    account_code: String(raw.account_code || raw.accountCode || raw.code || accountId || '').trim(),
    account_name: String(raw.account_name || raw.accountName || raw.nama_akun || raw.name || record?.name || '').trim(),
    account_type: normalizeCode(raw.account_type || raw.accountType || raw.type || 'BANK'),
    branch_id: String(raw.branch_id || raw.branchId || record?.branch_id || '').trim(),
    bank_name: String(raw.bank_name || raw.bankName || raw.nama_bank || '').trim(),
    current_balance: roundMoney(raw.current_balance || raw.saldo_sekarang || raw.balance || raw.saldo || 0),
    status: normalizeMasterStatus(raw),
    isDeleted: isSoftDeleted(raw),
    raw,
  };
};

const normalizeSalesReceivableSource = (row, todayStr) => {
  const packageInput = row?.sales_transaction_package || row?.salesTransactionPackage || row?.sales_order_package || row || {};
  const header = packageInput.sales_header || packageInput.order_header || packageInput.header || row?.sales_header || row?.order_header || row || {};
  const snapshot = packageInput.sales_snapshot || packageInput.snapshot_package || parseJson(header.sales_snapshot_json, null) || null;
  const snapshotPayload = snapshot?.payload?.sales_snapshot || snapshot?.payload?.order_snapshot || snapshot?.payload || null;
  const snapshotHeader = snapshotPayload?.sales_header || snapshotPayload?.order_header || snapshotPayload?.transaction_header || {};

  const finalHeader = {
    ...snapshotHeader,
    ...header,
  };

  const salesId = String(finalHeader.sales_id || finalHeader.order_id || finalHeader.id || row?.sales_id || row?.id || '').trim();
  const paymentStatus = normalizeCode(finalHeader.payment_status || finalHeader.paymentStatus || '');

  if (!['UNPAID', 'PARTIAL'].includes(paymentStatus)) return null;

  const outstandingBalance = roundMoney(
    finalHeader.outstanding_balance ||
    finalHeader.remaining_amount ||
    finalHeader.amount_receivable ||
    finalHeader.piutang ||
    0,
  );

  if (outstandingBalance <= 0) return null;

  const dueDate = normalizeDate(finalHeader.due_date || finalHeader.dueDate || finalHeader.sales_due_date || '');
  const transactionDate = normalizeDate(finalHeader.sales_date || finalHeader.order_date || finalHeader.date || finalHeader.created_at || row?.date || '');
  const agingDays = toNumber(finalHeader.aging_days || finalHeader.agingDays || (dueDate ? Math.max(daysBetween(dueDate, todayStr), 0) : 0));

  return {
    id: `AR-${salesId}`,
    receivable_id: String(finalHeader.receivable_id || `AR-${salesId}`).trim(),
    receivable_code: String(finalHeader.receivable_code || finalHeader.invoice_number || finalHeader.sales_code || salesId || '').trim(),
    sales_id: salesId,
    customer_id: String(finalHeader.customer_id || finalHeader.customerId || '').trim(),
    customer_name: String(finalHeader.customer_name || finalHeader.customerName || '').trim(),
    sales_channel: normalizeCode(finalHeader.sales_channel || finalHeader.channel || 'OFFLINE_RESTO'),
    branch_id: String(finalHeader.branch_id || finalHeader.branchId || '').trim(),
    invoice_number: String(finalHeader.invoice_number || finalHeader.no_invoice || finalHeader.sales_code || '').trim(),
    transaction_date: transactionDate,
    due_date: dueDate,
    total_invoice: roundMoney(finalHeader.total_invoice || finalHeader.total_amount || finalHeader.grand_total || 0),
    amount_paid: roundMoney(finalHeader.amount_paid || finalHeader.paid_amount || 0),
    outstanding_balance: outstandingBalance,
    aging_days: agingDays,
    status: normalizeReceivableStatus({
      status: paymentStatus === 'PARTIAL' ? 'PARTIAL' : 'OPEN',
      outstandingBalance,
      dueDate,
      todayStr,
    }),
    notes: String(finalHeader.notes || '').trim(),
    source_type: 'SALES',
    raw: row,
  };
};

const normalizeReceivableRecord = (row, todayStr) => {
  const packageInput = row?.receivable_package || row?.account_receivable_package || row?.piutang_package || row || {};
  const header = packageInput.receivable_header || packageInput.piutang_header || packageInput.header || row?.receivable_header || row || {};
  const snapshot = packageInput.snapshot_package || packageInput.receivable_snapshot || parseJson(header.snapshot_package_json, null) || null;
  const snapshotPayload = snapshot?.payload?.receivable_snapshot || snapshot?.payload || null;
  const snapshotHeader = snapshotPayload?.receivable_header || snapshotPayload?.transaction_header || {};

  const finalHeader = {
    ...snapshotHeader,
    ...header,
  };

  const salesId = String(finalHeader.sales_id || finalHeader.order_id || '').trim();
  const receivableId = String(finalHeader.receivable_id || finalHeader.piutang_id || finalHeader.id || (salesId ? `AR-${salesId}` : '') || row?.id || '').trim();
  const dueDate = normalizeDate(finalHeader.due_date || finalHeader.dueDate || '');
  const transactionDate = normalizeDate(finalHeader.transaction_date || finalHeader.sales_date || finalHeader.invoice_date || finalHeader.date || finalHeader.created_at || '');
  const outstandingBalance = roundMoney(
    finalHeader.outstanding_balance ||
    finalHeader.remaining_amount ||
    finalHeader.amount_receivable ||
    finalHeader.piutang ||
    0,
  );

  const agingDays = toNumber(
    finalHeader.aging_days ||
    finalHeader.agingDays ||
    (dueDate ? Math.max(daysBetween(dueDate, todayStr), 0) : 0),
  );

  const status = normalizeReceivableStatus({
    status: finalHeader.status || finalHeader.receivable_status || finalHeader.piutang_status,
    outstandingBalance,
    dueDate,
    todayStr,
  });

  return {
    id: String(finalHeader.id || receivableId).trim(),
    receivable_id: receivableId,
    receivable_code: String(finalHeader.receivable_code || finalHeader.piutang_code || finalHeader.invoice_number || receivableId || '').trim(),
    sales_id: salesId,
    customer_id: String(finalHeader.customer_id || finalHeader.customerId || '').trim(),
    customer_name: String(finalHeader.customer_name || finalHeader.customerName || '').trim(),
    sales_channel: normalizeCode(finalHeader.sales_channel || finalHeader.channel || 'OFFLINE_RESTO'),
    branch_id: String(finalHeader.branch_id || finalHeader.branchId || '').trim(),
    invoice_number: String(finalHeader.invoice_number || finalHeader.no_invoice || '').trim(),
    transaction_date: transactionDate,
    due_date: dueDate,
    total_invoice: roundMoney(finalHeader.total_invoice || finalHeader.total_amount || finalHeader.invoice_amount || 0),
    amount_paid: roundMoney(finalHeader.amount_paid || finalHeader.paid_amount || 0),
    outstanding_balance: outstandingBalance,
    aging_days: agingDays,
    status,
    notes: String(finalHeader.notes || finalHeader.keterangan || '').trim(),
    source_type: 'RECEIVABLE',
    search_text: normalizeText([
      receivableId,
      finalHeader.receivable_code,
      salesId,
      finalHeader.customer_id,
      finalHeader.customer_name,
      finalHeader.sales_channel,
      finalHeader.branch_id,
      finalHeader.invoice_number,
      status,
    ].filter(Boolean).join(' ')),
    raw: row,
  };
};

const normalizePaymentRecord = (row) => {
  const packageInput = row?.receivable_payment_package || row?.payment_package || row || {};
  const header = packageInput.payment_header || packageInput.receivable_payment_header || packageInput.header || row?.payment_header || row || {};

  const paymentId = String(header.payment_id || header.receivable_payment_id || header.transaction_id || row?.payment_id || row?.id || '').trim();

  return {
    id: String(header.id || paymentId).trim(),
    payment_id: paymentId,
    payment_code: String(header.payment_code || header.receivable_payment_code || header.transaction_code || paymentId || '').trim(),
    payment_date: normalizeDate(header.payment_date || header.transaction_date || header.date || header.created_at || ''),
    receivable_id: String(header.receivable_id || header.piutang_id || '').trim(),
    receivable_code: String(header.receivable_code || header.piutang_code || '').trim(),
    sales_id: String(header.sales_id || '').trim(),
    customer_id: String(header.customer_id || '').trim(),
    customer_name: String(header.customer_name || '').trim(),
    branch_id: String(header.branch_id || '').trim(),
    account_id: String(header.account_id || header.cash_account_id || '').trim(),
    account_name: String(header.account_name || header.cash_account_name || '').trim(),
    payment_method: normalizeCode(header.payment_method || 'TRANSFER'),
    amount: roundMoney(header.amount || header.payment_amount || header.nominal || 0),
    reference_number: String(header.reference_number || header.ref_number || '').trim(),
    notes: String(header.notes || header.keterangan || '').trim(),
    status: normalizePaymentStatus(header),
    raw: row,
  };
};

const buildMasterSource = ({
  dbData,
  rawReceivableRows,
  rawSalesRows,
  rawPaymentRows,
  rawCustomerRows,
  rawBranchRows,
  rawAccountRows,
}) => {
  return {
    ...(dbData || {}),

    receivables: rawReceivableRows,
    account_receivables: rawReceivableRows,
    piutang: rawReceivableRows,

    sales_transactions: rawSalesRows,
    salesTransactions: rawSalesRows,
    sales_orders: rawSalesRows,
    salesOrders: rawSalesRows,
    orders: rawSalesRows,

    receivable_payments: rawPaymentRows,
    receivablePayments: rawPaymentRows,
    piutang_payments: rawPaymentRows,

    master_customers: rawCustomerRows,
    masterCustomers: rawCustomerRows,
    customers: rawCustomerRows,

    master_branches: rawBranchRows,
    masterBranches: rawBranchRows,
    master_branch: rawBranchRows,

    master_cash_bank_accounts: rawAccountRows,
    masterCashBankAccounts: rawAccountRows,
    cash_bank_accounts: rawAccountRows,
    cashBankAccounts: rawAccountRows,
    master_accounts: rawAccountRows,
    masterAccounts: rawAccountRows,
  };
};

const normalizeReceivablePaymentPackageFromOrchestrator = (result) => {
  const base = result?.transaction_package || result?.package || result?.data || result || {};

  return {
    receivable_payment_package:
      base.receivable_payment_package ||
      base.receivablePaymentPackage ||
      base.payment_package ||
      base.collection_package ||
      base.receivable_payment ||
      null,

    cash_transaction_package:
      base.cash_transaction_package ||
      base.cashTransactionPackage ||
      base.cash_bank_package ||
      base.cashflow_package ||
      base.cash ||
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
      base.receivable_payment_snapshot ||
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
      base.receivable_payment_reversal_package ||
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

const validatePaymentPackage = (packageResult) => {
  const missing = [];

  if (!packageResult.receivable_payment_package) missing.push('receivable_payment_package');
  if (!packageResult.cash_transaction_package) missing.push('cash_transaction_package');
  if (!packageResult.accounting_package) missing.push('accounting_package');
  if (!packageResult.snapshot_package) missing.push('snapshot_package');

  return missing;
};

const validateVoidPackage = (packageResult) => {
  const missing = [];

  if (!packageResult.reversal_package) missing.push('reversal_package');

  return missing;
};

const createReceivablePaymentCommand = ({
  paymentForm,
  selectedReceivable,
  executor,
  masterSource,
}) => {
  return {
    transaction_type: 'RECEIVABLE_PAYMENT',
    action: 'POST',
    mode: 'POST',

    receivable_payment_header: {
      payment_id: paymentForm.payment_id,
      payment_code: paymentForm.payment_code,
      payment_date: paymentForm.payment_date,

      receivable_id: selectedReceivable.receivable_id,
      receivable_code: selectedReceivable.receivable_code,
      sales_id: selectedReceivable.sales_id,

      customer_id: selectedReceivable.customer_id,
      customer_name: selectedReceivable.customer_name,

      branch_id: selectedReceivable.branch_id,

      account_id: paymentForm.account_id,
      account_name: paymentForm.account_name,

      payment_method: paymentForm.payment_method,
      amount: roundMoney(paymentForm.amount),
      reference_number: paymentForm.reference_number,

      total_invoice: selectedReceivable.total_invoice,
      outstanding_balance_before: selectedReceivable.outstanding_balance,

      notes: paymentForm.notes,
      status: 'POSTED',

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

export default function TabPiutang({
  receivables = [],
  accountReceivables,
  account_receivables,
  piutang,
  piutang_customers,
  receivableRecords,
  receivable_records,

  salesTransactions = [],
  sales_transactions,
  salesOrders,
  sales_orders,
  orders,
  salesPackages,
  sales_packages,

  receivablePayments = [],
  receivable_payments,
  piutangPayments,
  piutang_payments,
  collectionPayments,
  collection_payments,

  masterCustomers = [],
  master_customers,
  customers,
  pelanggan,

  masterBranches = [],
  master_branches,
  master_branch,
  branches,

  masterCashBankAccounts = [],
  master_cash_bank_accounts,
  cashBankAccounts,
  cash_bank_accounts,
  masterAccounts,
  master_accounts,
  bankAccounts,
  bank_accounts,
  cashAccounts,
  cash_accounts,

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

  const [selectedReceivable, setSelectedReceivable] = useState(null);
  const [detailReceivable, setDetailReceivable] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    ...DEFAULT_PAYMENT_FORM,
    payment_date: todayStr,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState(isOwnerMode ? 'ALL' : userBranchId || 'ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dueFilter, setDueFilter] = useState('ALL');

  const rawReceivableRows = useMemo(() => {
    return getRawReceivableRows({
      receivables,
      accountReceivables,
      account_receivables,
      piutang,
      piutang_customers,
      receivableRecords,
      receivable_records,
      dbData,
    });
  }, [
    receivables,
    accountReceivables,
    account_receivables,
    piutang,
    piutang_customers,
    receivableRecords,
    receivable_records,
    dbData,
  ]);

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

  const rawPaymentRows = useMemo(() => {
    return getRawPaymentRows({
      receivablePayments,
      receivable_payments,
      piutangPayments,
      piutang_payments,
      collectionPayments,
      collection_payments,
      dbData,
    });
  }, [receivablePayments, receivable_payments, piutangPayments, piutang_payments, collectionPayments, collection_payments, dbData]);

  const rawCustomerRows = useMemo(() => {
    return getRawCustomerRows({
      masterCustomers,
      master_customers,
      customers,
      pelanggan,
      dbData,
    });
  }, [masterCustomers, master_customers, customers, pelanggan, dbData]);

  const rawBranchRows = useMemo(() => {
    return getRawBranchRows({
      masterBranches,
      master_branches,
      master_branch,
      branches,
      dbData,
    });
  }, [masterBranches, master_branches, master_branch, branches, dbData]);

  const rawAccountRows = useMemo(() => {
    return getRawAccountRows({
      masterCashBankAccounts,
      master_cash_bank_accounts,
      cashBankAccounts,
      cash_bank_accounts,
      masterAccounts,
      master_accounts,
      bankAccounts,
      bank_accounts,
      cashAccounts,
      cash_accounts,
      dbData,
    });
  }, [
    masterCashBankAccounts,
    master_cash_bank_accounts,
    cashBankAccounts,
    cash_bank_accounts,
    masterAccounts,
    master_accounts,
    bankAccounts,
    bank_accounts,
    cashAccounts,
    cash_accounts,
    dbData,
  ]);

  const masterSource = useMemo(() => {
    return buildMasterSource({
      dbData,
      rawReceivableRows,
      rawSalesRows,
      rawPaymentRows,
      rawCustomerRows,
      rawBranchRows,
      rawAccountRows,
    });
  }, [dbData, rawReceivableRows, rawSalesRows, rawPaymentRows, rawCustomerRows, rawBranchRows, rawAccountRows]);

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

  const accountRecords = useMemo(() => {
    const extractedRows = typeof masterDataApi.extractMasterRows === 'function'
      ? masterDataApi.extractMasterRows(masterSource, 'CASH_BANK_ACCOUNT')
      : rawAccountRows;

    const rows = safeArray(extractedRows).length > 0 ? safeArray(extractedRows) : rawAccountRows;

    return rows
      .map(normalizeAccountDisplay)
      .filter((account) => !account.isDeleted)
      .sort((a, b) => String(a.account_name).localeCompare(String(b.account_name)));
  }, [masterDataApi, masterSource, rawAccountRows]);

  const branchNameById = useMemo(() => {
    const map = new Map();

    branchRecords.forEach((branch) => {
      map.set(branch.branch_id, branch.branch_name || branch.branch_id);
      map.set(branch.branch_code, branch.branch_name || branch.branch_id);
    });

    return map;
  }, [branchRecords]);

  const customerNameById = useMemo(() => {
    const map = new Map();

    customerRecords.forEach((customer) => {
      map.set(customer.customer_id, customer.customer_name || customer.customer_id);
      map.set(customer.customer_code, customer.customer_name || customer.customer_id);
    });

    return map;
  }, [customerRecords]);

  const accountNameById = useMemo(() => {
    const map = new Map();

    accountRecords.forEach((account) => {
      map.set(account.account_id, account.account_name || account.account_id);
      map.set(account.account_code, account.account_name || account.account_id);
    });

    return map;
  }, [accountRecords]);

  const receivableRecordsFinal = useMemo(() => {
    const directRows = rawReceivableRows.map((row) => normalizeReceivableRecord(row, todayStr));
    const salesRows = rawSalesRows
      .map((row) => normalizeSalesReceivableSource(row, todayStr))
      .filter(Boolean);

    const map = new Map();

    [...salesRows, ...directRows].forEach((row) => {
      if (!row.receivable_id && !row.sales_id) return;
      const key = row.receivable_id || row.sales_id;
      map.set(key, {
        ...row,
        customer_name: row.customer_name || customerNameById.get(row.customer_id) || '',
        search_text: normalizeText([
          row.receivable_id,
          row.receivable_code,
          row.sales_id,
          row.customer_id,
          row.customer_name || customerNameById.get(row.customer_id),
          row.sales_channel,
          row.branch_id,
          row.invoice_number,
          row.status,
        ].filter(Boolean).join(' ')),
      });
    });

    return Array.from(map.values())
      .sort((a, b) => {
        const dateCompare = String(b.transaction_date || '').localeCompare(String(a.transaction_date || ''));
        if (dateCompare !== 0) return dateCompare;
        return String(b.receivable_id || '').localeCompare(String(a.receivable_id || ''));
      });
  }, [rawReceivableRows, rawSalesRows, todayStr, customerNameById]);

  const paymentRecords = useMemo(() => {
    return rawPaymentRows
      .map(normalizePaymentRecord)
      .sort((a, b) => {
        const dateCompare = String(b.payment_date || '').localeCompare(String(a.payment_date || ''));
        if (dateCompare !== 0) return dateCompare;
        return String(b.payment_id || '').localeCompare(String(a.payment_id || ''));
      });
  }, [rawPaymentRows]);

  const effectiveBranchFilter = !isOwnerMode && userBranchId ? userBranchId : branchFilter;

  const activeAccountsByBranch = useMemo(() => {
    return accountRecords.filter((account) => {
      if (account.status !== 'ACTIVE') return false;
      if (!selectedReceivable?.branch_id) return true;
      if (isOwnerMode) return true;
      return account.branch_id === selectedReceivable.branch_id;
    });
  }, [accountRecords, selectedReceivable, isOwnerMode]);

  const matchesDueFilter = (receivable) => {
    if (dueFilter === 'ALL') return true;

    const dueDate = receivable.due_date;
    const agingDays = toNumber(receivable.aging_days);

    if (dueFilter === 'NOT_DUE') return dueDate && dueDate > todayStr;
    if (dueFilter === 'DUE_TODAY') return dueDate && dueDate === todayStr;
    if (dueFilter === 'OVERDUE') return receivable.status === 'OVERDUE';
    if (dueFilter === 'AGING_0_30') return agingDays >= 0 && agingDays <= 30;
    if (dueFilter === 'AGING_31_60') return agingDays >= 31 && agingDays <= 60;
    if (dueFilter === 'AGING_61_90') return agingDays >= 61 && agingDays <= 90;
    if (dueFilter === 'AGING_GT_90') return agingDays > 90;

    return true;
  };

  const filteredReceivables = useMemo(() => {
    const keyword = normalizeText(searchQuery);

    return receivableRecordsFinal.filter((receivable) => {
      const branchOk = effectiveBranchFilter === 'ALL' || receivable.branch_id === effectiveBranchFilter;
      const customerOk = customerFilter === 'ALL' || receivable.customer_id === customerFilter;
      const statusOk = statusFilter === 'ALL' || receivable.status === statusFilter;
      const dueOk = matchesDueFilter(receivable);
      const searchOk = !keyword || receivable.search_text.includes(keyword);

      return branchOk && customerOk && statusOk && dueOk && searchOk;
    });
  }, [
    receivableRecordsFinal,
    effectiveBranchFilter,
    customerFilter,
    statusFilter,
    dueFilter,
    searchQuery,
  ]);

  const selectedPaymentHistory = useMemo(() => {
    if (!selectedReceivable && !detailReceivable) return [];

    const target = selectedReceivable || detailReceivable;

    return paymentRecords.filter((payment) => {
      return payment.receivable_id === target.receivable_id ||
        payment.sales_id === target.sales_id;
    });
  }, [paymentRecords, selectedReceivable, detailReceivable]);

  const analytics = useMemo(() => {
    const scoped = receivableRecordsFinal.filter((receivable) => {
      if (receivable.status === 'VOID') return false;
      if (effectiveBranchFilter === 'ALL') return true;
      return receivable.branch_id === effectiveBranchFilter;
    });

    const active = scoped.filter((receivable) => receivable.status !== 'PAID');
    const totalPiutang = active.reduce((sum, receivable) => sum + toNumber(receivable.outstanding_balance), 0);
    const overdueRows = active.filter((receivable) => receivable.status === 'OVERDUE');
    const overdueAmount = overdueRows.reduce((sum, receivable) => sum + toNumber(receivable.outstanding_balance), 0);

    const totalInvoice = scoped.reduce((sum, receivable) => sum + toNumber(receivable.total_invoice), 0);
    const totalPaid = scoped.reduce((sum, receivable) => sum + toNumber(receivable.amount_paid), 0);
    const collectionRate = totalInvoice > 0 ? (totalPaid / totalInvoice) * 100 : 0;

    const customerMap = new Map();

    active.forEach((receivable) => {
      const key = receivable.customer_id || receivable.customer_name || 'UNKNOWN';

      if (!customerMap.has(key)) {
        customerMap.set(key, {
          customer_id: receivable.customer_id,
          customer_name: receivable.customer_name || customerNameById.get(receivable.customer_id) || key,
          outstanding_balance: 0,
          total_invoice: 0,
          overdue_count: 0,
        });
      }

      const row = customerMap.get(key);
      row.outstanding_balance += toNumber(receivable.outstanding_balance);
      row.total_invoice += toNumber(receivable.total_invoice);
      if (receivable.status === 'OVERDUE') row.overdue_count += 1;
    });

    const topDebtor = Array.from(customerMap.values())
      .sort((a, b) => b.outstanding_balance - a.outstanding_balance)[0] || null;

    const agingSummary = {
      '0 - 30 hari': 0,
      '31 - 60 hari': 0,
      '61 - 90 hari': 0,
      '> 90 hari': 0,
    };

    active.forEach((receivable) => {
      const bucket = getAgingBucket(receivable.aging_days);
      agingSummary[bucket] += toNumber(receivable.outstanding_balance);
    });

    return {
      total_piutang: roundMoney(totalPiutang),
      overdue_amount: roundMoney(overdueAmount),
      overdue_customer: new Set(overdueRows.map((row) => row.customer_id || row.customer_name)).size,
      collection_rate: Math.round(collectionRate * 100) / 100,
      top_debtor: topDebtor,
      aging_summary: agingSummary,
      open_count: active.length,
      paid_count: scoped.filter((receivable) => receivable.status === 'PAID').length,
      void_count: receivableRecordsFinal.filter((receivable) => receivable.status === 'VOID').length,
    };
  }, [receivableRecordsFinal, effectiveBranchFilter, customerNameById]);

  const notify = (message, type = 'success') => {
    if (typeof showToast === 'function') {
      showToast(message, type);
      return;
    }

    if (type === 'error') {
      window.alert(message);
    }
  };

  const handleSelectReceivable = (receivable) => {
    const newId = generateId('AR-PAY', todayStr);

    setSelectedReceivable(receivable);
    setDetailReceivable(receivable);
    setPaymentForm({
      ...DEFAULT_PAYMENT_FORM,
      payment_id: newId,
      payment_code: newId,
      payment_date: todayStr,
      receivable_id: receivable.receivable_id,
      receivable_code: receivable.receivable_code,
      sales_id: receivable.sales_id,
      customer_id: receivable.customer_id,
      customer_name: receivable.customer_name,
      branch_id: receivable.branch_id,
      amount: String(receivable.outstanding_balance || ''),
    });
  };

  const handleAccountChange = (accountId) => {
    const account = accountRecords.find((item) => item.account_id === accountId);

    setPaymentForm((prev) => ({
      ...prev,
      account_id: accountId,
      account_name: account?.account_name || '',
    }));
  };

  const validatePaymentForm = () => {
    const warnings = [];

    if (!selectedReceivable) warnings.push('Pilih piutang terlebih dahulu.');
    if (!paymentForm.payment_id.trim()) warnings.push('Payment ID wajib diisi.');
    if (!paymentForm.payment_code.trim()) warnings.push('Payment Code wajib diisi.');
    if (!paymentForm.payment_date.trim()) warnings.push('Tanggal pembayaran wajib diisi.');
    if (!paymentForm.account_id.trim()) warnings.push('Account kas/bank penerima wajib dipilih.');
    if (!paymentForm.payment_method.trim()) warnings.push('Payment method wajib dipilih.');
    if (roundMoney(paymentForm.amount) <= 0) warnings.push('Nominal pembayaran wajib lebih dari 0.');

    if (selectedReceivable && roundMoney(paymentForm.amount) > roundMoney(selectedReceivable.outstanding_balance)) {
      warnings.push('Pembayaran tidak boleh melebihi outstanding balance.');
    }

    const accountExists = accountRecords.some((account) => {
      return account.account_id === paymentForm.account_id &&
        account.status === 'ACTIVE' &&
        !account.isDeleted &&
        (isOwnerMode || account.branch_id === selectedReceivable?.branch_id);
    });

    if (paymentForm.account_id && !accountExists) {
      warnings.push('Account kas/bank tidak ditemukan atau tidak aktif.');
    }

    if (!isOwnerMode && userBranchId && selectedReceivable?.branch_id !== userBranchId) {
      warnings.push('User cabang hanya boleh memproses piutang cabangnya sendiri.');
    }

    if (selectedReceivable?.status === 'PAID') {
      warnings.push('Piutang sudah PAID dan tidak bisa menerima pembayaran lagi.');
    }

    if (selectedReceivable?.status === 'VOID') {
      warnings.push('Piutang VOID tidak bisa menerima pembayaran.');
    }

    return warnings;
  };

  const persistPayment = async (action, payload) => {
    if (typeof sendToSheet !== 'function') {
      notify('sendToSheet belum tersedia. Riwayat pembayaran belum bisa disimpan ke cloud.', 'error');
      return false;
    }

    let isSuccess = false;

    try {
      isSuccess = await sendToSheet(action, RECEIVABLE_PAYMENT_TABLE_NAME, payload);
    } catch (error) {
      isSuccess = false;
    }

    if (!isSuccess) {
      try {
        isSuccess = await sendToSheet(action, payload, RECEIVABLE_PAYMENT_TABLE_NAME);
      } catch (error) {
        isSuccess = false;
      }
    }

    return Boolean(isSuccess);
  };

  const runProcessReceivablePayment = async () => {
    if (!erpOrchestrator || typeof erpOrchestrator.processReceivablePayment !== 'function') {
      return {
        ok: false,
        message: 'erpOrchestrator.processReceivablePayment() belum tersedia. Revisi harus dilakukan di src/services/erpOrchestrator.js.',
      };
    }

    const command = createReceivablePaymentCommand({
      paymentForm,
      selectedReceivable,
      executor,
      masterSource,
    });

    try {
      const result = await Promise.resolve(
        erpOrchestrator.processReceivablePayment(command, {
          source: masterSource,
          dbData: masterSource,
          masterData: masterSource,
          executor,
          mode: 'POST',
        }),
      );

      if (result?.ok === false) {
        return {
          ok: false,
          message: result.message || result.error || 'erpOrchestrator.processReceivablePayment() mengembalikan status tidak OK.',
        };
      }

      const packageResult = normalizeReceivablePaymentPackageFromOrchestrator(result);
      const missing = validatePaymentPackage(packageResult);

      if (missing.length > 0) {
        return {
          ok: false,
          message: `Package pembayaran piutang belum lengkap: ${missing.join(', ')}. Revisi alur di src/services/erpOrchestrator.js, bukan di UI.`,
        };
      }

      return {
        ok: true,
        packageResult,
      };
    } catch (error) {
      return {
        ok: false,
        message: error.message || 'erpOrchestrator.processReceivablePayment() gagal dijalankan.',
      };
    }
  };

  const createPaymentPayload = (packageResult) => {
    return {
      id: paymentForm.payment_id,
      date: todayStr,

      payment_id: paymentForm.payment_id,
      payment_code: paymentForm.payment_code,
      payment_date: paymentForm.payment_date,

      receivable_id: selectedReceivable.receivable_id,
      receivable_code: selectedReceivable.receivable_code,
      sales_id: selectedReceivable.sales_id,

      customer_id: selectedReceivable.customer_id,
      customer_name: selectedReceivable.customer_name,

      branch_id: selectedReceivable.branch_id,

      account_id: paymentForm.account_id,
      account_name: paymentForm.account_name,

      payment_method: paymentForm.payment_method,
      amount: roundMoney(paymentForm.amount),
      reference_number: paymentForm.reference_number,

      total_invoice: selectedReceivable.total_invoice,
      outstanding_balance_before: selectedReceivable.outstanding_balance,

      notes: paymentForm.notes,

      status: 'POSTED',
      payment_status: 'POSTED',

      receivable_payment_package: packageResult.receivable_payment_package,
      receivable_payment_package_json: JSON.stringify(packageResult.receivable_payment_package),

      cash_transaction_package: packageResult.cash_transaction_package,
      cash_transaction_package_json: JSON.stringify(packageResult.cash_transaction_package),

      accounting_package: packageResult.accounting_package,
      accounting_package_json: JSON.stringify(packageResult.accounting_package),

      snapshot_package: packageResult.snapshot_package,
      snapshot_package_json: JSON.stringify(packageResult.snapshot_package),

      orchestrator_response_json: JSON.stringify(packageResult.raw_orchestrator_response),
      engine_warnings_json: JSON.stringify(packageResult.warnings || []),

      created_at: new Date().toISOString(),
      created_by: executor,
      posted_at: new Date().toISOString(),
      posted_by: executor,
      updated_at: new Date().toISOString(),
      updated_by: executor,
    };
  };

  const handleProcessPayment = async () => {
    const warnings = validatePaymentForm();

    if (warnings.length > 0) {
      notify(warnings.join('\n'), 'error');
      return;
    }

    const confirmed = window.confirm(
      `Proses pembayaran piutang ${formatMoney(paymentForm.amount)}? Kas/Bank, jurnal, dan snapshot wajib dibuat oleh erpOrchestrator.`,
    );

    if (!confirmed) return;

    const orchestratorResult = await runProcessReceivablePayment();

    if (!orchestratorResult.ok) {
      notify(orchestratorResult.message, 'error');
      return;
    }

    const payload = createPaymentPayload(orchestratorResult.packageResult);
    const isSuccess = await persistPayment('insert', payload);

    if (isSuccess) {
      notify('Pembayaran piutang berhasil diproses melalui erpOrchestrator. Kas/Bank, jurnal, dan snapshot dibuat oleh orchestrator.', 'success');

      setPaymentForm({
        ...DEFAULT_PAYMENT_FORM,
        payment_date: todayStr,
      });
      setSelectedReceivable(null);
    }
  };

  const runProcessVoidPayment = async (payment) => {
    if (!erpOrchestrator || typeof erpOrchestrator.processVoidTransaction !== 'function') {
      return {
        ok: false,
        message: 'erpOrchestrator.processVoidTransaction() belum tersedia. Revisi harus dilakukan di src/services/erpOrchestrator.js.',
      };
    }

    try {
      const result = await Promise.resolve(
        erpOrchestrator.processVoidTransaction({
          transaction_type: 'RECEIVABLE_PAYMENT',
          transaction_id: payment.payment_id,
          transaction_code: payment.payment_code,
          branch_id: payment.branch_id,
          original_transaction: payment.raw,
          reason: 'VOID_RECEIVABLE_PAYMENT_FROM_UI',
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
      const missing = validateVoidPackage(packageResult);

      if (missing.length > 0) {
        return {
          ok: false,
          message: `Package void pembayaran piutang belum lengkap: ${missing.join(', ')}. Revisi alur di src/services/erpOrchestrator.js, bukan di UI.`,
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

  const handleVoidPayment = async (payment) => {
    if (payment.status !== 'POSTED') {
      notify('Hanya pembayaran POSTED yang bisa di-void.', 'error');
      return;
    }

    const confirmed = window.confirm(
      `Void pembayaran ${payment.payment_code || payment.payment_id}? Histori tidak dihapus, orchestrator akan membuat reversal package.`,
    );

    if (!confirmed) return;

    const voidResult = await runProcessVoidPayment(payment);

    if (!voidResult.ok) {
      notify(voidResult.message, 'error');
      return;
    }

    const payload = {
      ...(payment.raw || {}),
      id: payment.id || payment.payment_id,
      payment_id: payment.payment_id,
      status: 'VOID',
      payment_status: 'VOID',

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

    const isSuccess = await persistPayment('update', payload);

    if (isSuccess) {
      notify('Pembayaran piutang berhasil di-void melalui erpOrchestrator. Reversal package dibuat oleh orchestrator.', 'success');
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
                <WalletCards size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                Financial Control Layer
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              Piutang Resmi Dimsum Aditya
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-300">
              Thin UI piutang. Pembayaran, kas/bank, jurnal, reversal, dan snapshot wajib dibuat oleh erpOrchestrator.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">{isOwnerMode ? 'Owner Mode Lintas Cabang' : 'Branch Mode'}</Badge>
            <Badge tone="amber">Thin UI</Badge>
            <Badge tone="green">Sales Source Only</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Total Piutang" value={formatMoney(analytics.total_piutang)} icon={<WalletCards size={18} />} tone="red" />
        <StatCard title="Overdue Amount" value={formatMoney(analytics.overdue_amount)} icon={<AlertTriangle size={18} />} tone="white" />
        <StatCard title="Overdue Customer" value={analytics.overdue_customer} icon={<UserRound size={18} />} tone="gold" />
        <StatCard title="Collection Rate" value={`${analytics.collection_rate}%`} icon={<TrendingUp size={18} />} tone="white" />
        <StatCard title="Open / Paid" value={`${analytics.open_count} / ${analytics.paid_count}`} icon={<CheckCircle size={18} />} tone="white" />
        <StatCard title="Void" value={analytics.void_count} icon={<Undo2 size={18} />} tone="dark" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-red-50 p-3 text-red-600">
              <Crown size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Top Debtor</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.top_debtor?.customer_name || '-'}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                {formatMoney(analytics.top_debtor?.outstanding_balance || 0)}
              </div>
            </div>
          </div>
        </div>

        {Object.entries(analytics.aging_summary).map(([label, amount]) => (
          <div key={label} className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
                <Clock size={20} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Aging {label}</div>
                <div className="mt-1 text-lg font-black text-slate-900">
                  {formatMoney(amount)}
                </div>
                <div className="mt-1 text-xs font-bold text-slate-500">
                  Outstanding balance
                </div>
              </div>
            </div>
          </div>
        )).slice(0, 2)}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Object.entries(analytics.aging_summary).slice(2).map(([label, amount]) => (
          <div key={label} className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-red-50 p-3 text-red-600">
                <CalendarClock size={20} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Aging {label}</div>
                <div className="mt-1 text-lg font-black text-slate-900">
                  {formatMoney(amount)}
                </div>
                <div className="mt-1 text-xs font-bold text-slate-500">
                  Monitoring koleksi
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {analytics.overdue_amount > 0 && (
        <div className="rounded-[2rem] border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-3 text-amber-700 shadow-sm">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black text-amber-900">OVERDUE RECEIVABLE WARNING</h2>
                <p className="mt-1 text-xs font-bold text-amber-700">
                  Total overdue saat ini {formatMoney(analytics.overdue_amount)} dari {analytics.overdue_customer} customer.
                </p>
              </div>
            </div>
            <Badge tone="amber">Collection Priority</Badge>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <ArrowDownCircle size={16} className="text-red-600" />
                  Input Pembayaran Piutang
                </h2>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  Pembayaran sebagian atau lunas wajib melalui orchestrator.
                </p>
              </div>

              {selectedReceivable && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReceivable(null);
                    setPaymentForm({ ...DEFAULT_PAYMENT_FORM, payment_date: todayStr });
                  }}
                  className="rounded-xl bg-slate-100 p-2 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {!selectedReceivable && (
              <div className="rounded-[2rem] border border-amber-100 bg-amber-50 p-5 text-sm font-bold text-amber-800">
                Pilih piutang dari tabel untuk menginput pembayaran.
              </div>
            )}

            {selectedReceivable && (
              <div className="space-y-4">
                <div className="rounded-[2rem] border border-red-100 bg-red-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-600">Invoice Dipilih</div>
                  <div className="mt-2 text-sm font-black text-slate-900">{selectedReceivable.receivable_code}</div>
                  <div className="mt-1 text-xs font-bold text-slate-600">{selectedReceivable.customer_name}</div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold">
                    <div className="text-red-700">Outstanding</div>
                    <div className="text-right text-red-950">{formatMoney(selectedReceivable.outstanding_balance)}</div>
                    <div className="text-red-700">Status</div>
                    <div className="text-right text-red-950">{selectedReceivable.status}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Payment ID" required>
                    <input
                      value={paymentForm.payment_id}
                      onChange={(event) => setPaymentForm({ ...paymentForm, payment_id: normalizeCode(event.target.value) })}
                      className={inputClass}
                      placeholder="AR-PAY-001"
                    />
                  </Field>

                  <Field label="Payment Code" required>
                    <input
                      value={paymentForm.payment_code}
                      onChange={(event) => setPaymentForm({ ...paymentForm, payment_code: normalizeCode(event.target.value) })}
                      className={inputClass}
                      placeholder="AR-PAY-001"
                    />
                  </Field>
                </div>

                <Field label="Tanggal Bayar" required>
                  <input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(event) => setPaymentForm({ ...paymentForm, payment_date: event.target.value })}
                    className={inputClass}
                  />
                </Field>

                <Field label="Account Kas/Bank Penerima" required>
                  <select
                    value={paymentForm.account_id}
                    onChange={(event) => handleAccountChange(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Pilih account</option>
                    {activeAccountsByBranch.map((account) => (
                      <option key={account.account_id} value={account.account_id}>
                        {account.account_name} — {account.account_type} — {formatMoney(account.current_balance)}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Payment Method" required>
                    <select
                      value={paymentForm.payment_method}
                      onChange={(event) => setPaymentForm({ ...paymentForm, payment_method: event.target.value })}
                      className={inputClass}
                    >
                      {PAYMENT_METHODS.map((method) => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Amount" required>
                    <input
                      value={paymentForm.amount}
                      onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })}
                      className={inputClass}
                      placeholder="0"
                    />
                  </Field>
                </div>

                <Field label="Reference Number">
                  <input
                    value={paymentForm.reference_number}
                    onChange={(event) => setPaymentForm({ ...paymentForm, reference_number: event.target.value })}
                    className={inputClass}
                    placeholder="Bukti transfer / ref"
                  />
                </Field>

                <Field label="Notes">
                  <textarea
                    value={paymentForm.notes}
                    onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })}
                    rows={3}
                    className={`${inputClass} resize-none`}
                    placeholder="Catatan pembayaran..."
                  />
                </Field>

                <button
                  type="button"
                  onClick={handleProcessPayment}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-sm transition-all hover:bg-red-700"
                >
                  <Send size={16} />
                  Proses Pembayaran
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
              <History size={17} className="text-red-600" />
              Riwayat Pembayaran
            </h2>

            <div className="mt-4 space-y-3">
              {selectedPaymentHistory.length === 0 && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-bold text-slate-500">
                  Belum ada pembayaran untuk invoice yang dipilih.
                </div>
              )}

              {selectedPaymentHistory.map((payment) => (
                <div key={payment.payment_id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-black text-slate-900">{payment.payment_code}</div>
                      <div className="mt-1 text-[11px] font-bold text-slate-400">{formatDate(payment.payment_date)}</div>
                      <div className="mt-2 text-sm font-black text-emerald-700">{formatMoney(payment.amount)}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge tone={payment.status === 'POSTED' ? 'green' : payment.status === 'VOID' ? 'dark' : 'amber'}>
                        {payment.status}
                      </Badge>

                      {payment.status === 'POSTED' && (
                        <button
                          type="button"
                          onClick={() => handleVoidPayment(payment)}
                          className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100"
                          title="Void pembayaran"
                        >
                          <Undo2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold">
                    <div className="text-slate-400">Method</div>
                    <div className="text-right text-slate-700">{payment.payment_method}</div>
                    <div className="text-slate-400">Account</div>
                    <div className="text-right text-slate-700">{accountNameById.get(payment.account_id) || payment.account_name || '-'}</div>
                  </div>
                </div>
              ))}
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
                    Daftar Piutang Resmi
                  </h2>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    Sumber piutang wajib dari Sales dan erpOrchestrator.processSales().
                  </p>
                </div>

                <div className="flex flex-col gap-2 2xl:flex-row">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-xs font-bold outline-none transition-all placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50 md:w-64"
                      placeholder="Cari invoice, customer, sales..."
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
                        {RECEIVABLE_STATUS.map((status) => (
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
                      value={customerFilter}
                      onChange={(event) => setCustomerFilter(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none focus:border-red-500"
                    >
                      <option value="ALL">SEMUA CUSTOMER</option>
                      {customerRecords.map((customer) => (
                        <option key={customer.customer_id} value={customer.customer_id}>
                          {customer.customer_name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={dueFilter}
                      onChange={(event) => setDueFilter(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none focus:border-red-500"
                    >
                      {DUE_FILTERS.map((filter) => (
                        <option key={filter} value={filter}>{filter}</option>
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
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Invoice</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Customer</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cabang / Channel</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Due / Aging</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Invoice</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Outstanding</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Status</th>
                    <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredReceivables.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-14 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-red-50 text-red-600">
                          <WalletCards size={24} />
                        </div>
                        <div className="mt-3 text-sm font-black text-slate-800">Piutang tidak ditemukan</div>
                        <div className="mt-1 text-xs font-semibold text-slate-400">
                          Ubah filter atau cek transaksi sales unpaid/partial.
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredReceivables.map((receivable) => {
                    const branchName = branchNameById.get(receivable.branch_id) || 'Branch tidak ditemukan';
                    const customerName = customerNameById.get(receivable.customer_id) || receivable.customer_name || 'Customer tidak ditemukan';

                    return (
                      <tr key={`${receivable.receivable_id}-${receivable.sales_id}`} className="border-b border-slate-100 transition-colors hover:bg-red-50/30">
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                              receivable.status === 'OVERDUE'
                                ? 'bg-red-600 text-white'
                                : receivable.status === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-700'
                            }`}>
                              <ReceiptText size={18} />
                            </div>
                            <div>
                              <div className="font-black text-slate-900">{receivable.receivable_code || receivable.invoice_number || receivable.receivable_id}</div>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                <Badge tone="slate">{receivable.receivable_id || '-'}</Badge>
                                {receivable.sales_id && <Badge tone="amber">{receivable.sales_id}</Badge>}
                              </div>
                              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                                <CalendarClock size={12} />
                                {receivable.transaction_date ? formatDate(receivable.transaction_date) : '-'}
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
                                {receivable.customer_id || '-'}
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
                                <div className="text-slate-400">{receivable.branch_id || '-'}</div>
                              </div>
                            </div>
                            <Badge tone="purple">{receivable.sales_channel || '-'}</Badge>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="text-xs font-black text-slate-900">
                            {receivable.due_date ? formatDate(receivable.due_date) : '-'}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-slate-400">
                            Aging {receivable.aging_days} hari
                          </div>
                          <div className="mt-2">
                            <Badge tone={receivable.aging_days > 90 ? 'red' : receivable.aging_days > 30 ? 'amber' : 'slate'}>
                              {getAgingBucket(receivable.aging_days)}
                            </Badge>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="text-sm font-black text-slate-900">{formatMoney(receivable.total_invoice)}</div>
                          <div className="mt-1 text-[11px] font-bold text-emerald-700">
                            Paid {formatMoney(receivable.amount_paid)}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className={`text-sm font-black ${receivable.outstanding_balance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                            {formatMoney(receivable.outstanding_balance)}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-slate-400">
                            Source {receivable.source_type}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <Badge tone={
                            receivable.status === 'PAID'
                              ? 'green'
                              : receivable.status === 'OVERDUE'
                                ? 'red'
                                : receivable.status === 'PARTIAL'
                                  ? 'amber'
                                  : receivable.status === 'VOID'
                                    ? 'dark'
                                    : 'slate'
                          }>
                            {receivable.status}
                          </Badge>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setDetailReceivable(receivable)}
                              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-amber-100 hover:bg-amber-50 hover:text-amber-700"
                              title="Lihat detail invoice"
                            >
                              <Eye size={15} />
                            </button>

                            {['OPEN', 'PARTIAL', 'OVERDUE'].includes(receivable.status) && (
                              <button
                                type="button"
                                onClick={() => handleSelectReceivable(receivable)}
                                className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100"
                                title="Input pembayaran"
                              >
                                <Send size={15} />
                              </button>
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
                Menampilkan <span className="text-slate-800">{filteredReceivables.length}</span> dari <span className="text-slate-800">{receivableRecordsFinal.length}</span> piutang.
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge tone="red">Merah = Overdue</Badge>
                <Badge tone="amber">Gold = Partial / Open</Badge>
                <Badge tone="green">Green = Paid</Badge>
              </div>
            </div>
          </div>

          {detailReceivable && (
            <div className="mt-6 rounded-[2rem] border border-slate-100 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 p-5">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <FileText size={17} className="text-red-600" />
                    Detail Invoice Piutang
                  </h2>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    Detail hanya menampilkan snapshot/source. Pembayaran tetap melalui orchestrator.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setDetailReceivable(null)}
                  className="rounded-xl bg-slate-100 p-2 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Invoice</div>
                  <div className="mt-2 text-sm font-black text-slate-900">{detailReceivable.receivable_code}</div>
                  <div className="mt-1 text-[11px] font-bold text-slate-500">{detailReceivable.invoice_number || '-'}</div>
                </div>

                <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Customer</div>
                  <div className="mt-2 text-sm font-black text-slate-900">{detailReceivable.customer_name}</div>
                  <div className="mt-1 text-[11px] font-bold text-slate-500">{detailReceivable.customer_id}</div>
                </div>

                <div className="rounded-3xl border border-red-100 bg-red-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-red-500">Outstanding</div>
                  <div className="mt-2 text-sm font-black text-red-900">{formatMoney(detailReceivable.outstanding_balance)}</div>
                  <div className="mt-1 text-[11px] font-bold text-red-600">{detailReceivable.status}</div>
                </div>

                <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-600">Aging</div>
                  <div className="mt-2 text-sm font-black text-amber-900">{detailReceivable.aging_days} hari</div>
                  <div className="mt-1 text-[11px] font-bold text-amber-700">{getAgingBucket(detailReceivable.aging_days)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
