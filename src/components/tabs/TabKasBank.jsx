import React, { useMemo, useState } from 'react';
import {
  WalletCards,
  Plus,
  Save,
  X,
  Edit2,
  Search,
  Filter,
  Building2,
  Landmark,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  CalendarClock,
  ReceiptText,
  History,
  Crown,
  TrendingUp,
  Undo2,
  Send,
  FileText,
  BadgeDollarSign,
  RefreshCw,
  ArrowDownCircle,
  ArrowUpCircle,
  Users,
} from 'lucide-react';

import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import erpOrchestrator from '../../services/erpOrchestrator';

const CASH_BANK_TABLE_NAME = 'cash_bank_transactions';

const ACCOUNT_TYPES = [
  'CASH',
  'BANK',
  'EWALLET',
];

const TRANSACTION_TYPES = [
  'MONEY_IN',
  'MONEY_OUT',
  'TRANSFER',
  'ADJUSTMENT',
];

const SOURCE_MODULES = [
  'PURCHASE',
  'SALES',
  'PRODUCTION',
  'EXPENSE',
  'OWNER_WITHDRAW',
  'OWNER_DEPOSIT',
  'MANUAL',
  'TRANSFER',
];

const TRANSACTION_STATUS = [
  'DRAFT',
  'POSTED',
  'VOID',
];

const DEFAULT_FORM = {
  id: '',
  transaction_id: '',
  transaction_code: '',
  transaction_date: '',
  transaction_type: 'MONEY_IN',
  source_module: 'MANUAL',
  branch_id: '',
  account_id: '',
  account_name: '',
  target_account_id: '',
  target_account_name: '',
  amount: '',
  reference_number: '',
  notes: '',
  status: 'DRAFT',
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

const normalizeTransactionStatus = (row) => {
  const value = row?.status ?? row?.transaction_status ?? row?.cash_status ?? row?.bank_status;
  const normalized = normalizeCode(value || 'DRAFT');

  if (['VOIDED', 'VOID'].includes(normalized)) return 'VOID';
  if (['POSTED', 'FINAL', 'LOCKED', 'DONE'].includes(normalized)) return 'POSTED';
  if (['DRAFT', 'OPEN'].includes(normalized)) return 'DRAFT';

  return normalized || 'DRAFT';
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

const getRawTransactionRows = ({
  cashBankTransactions,
  cash_bank_transactions,
  kasBankTransactions,
  kas_bank_transactions,
  cashflowTransactions,
  cashflow_transactions,
  moneyTransactions,
  money_transactions,
  dbData,
}) => {
  return [
    ...safeArray(cashBankTransactions),
    ...safeArray(cash_bank_transactions),
    ...safeArray(kasBankTransactions),
    ...safeArray(kas_bank_transactions),
    ...safeArray(cashflowTransactions),
    ...safeArray(cashflow_transactions),
    ...safeArray(moneyTransactions),
    ...safeArray(money_transactions),
    ...safeArray(dbData?.cashBankTransactions),
    ...safeArray(dbData?.cash_bank_transactions),
    ...safeArray(dbData?.kasBankTransactions),
    ...safeArray(dbData?.kas_bank_transactions),
    ...safeArray(dbData?.cashflowTransactions),
    ...safeArray(dbData?.cashflow_transactions),
    ...safeArray(dbData?.moneyTransactions),
    ...safeArray(dbData?.money_transactions),
  ];
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

const normalizeAccountDisplay = (record) => {
  const raw = record?.raw || record || {};

  const accountId = String(
    raw.account_id ||
    raw.accountId ||
    raw.cash_account_id ||
    raw.bank_account_id ||
    raw.id ||
    record?.id ||
    '',
  ).trim();

  const accountCode = String(
    raw.account_code ||
    raw.accountCode ||
    raw.code ||
    raw.kode_akun ||
    accountId ||
    '',
  ).trim();

  const accountName = String(
    raw.account_name ||
    raw.accountName ||
    raw.nama_akun ||
    raw.name ||
    record?.name ||
    '',
  ).trim();

  const accountType = normalizeCode(raw.account_type || raw.accountType || raw.type || raw.jenis_akun || 'CASH');

  return {
    id: String(raw.id || accountId).trim(),
    account_id: accountId,
    account_code: accountCode,
    account_name: accountName,
    account_type: ACCOUNT_TYPES.includes(accountType) ? accountType : 'CASH',
    branch_id: String(raw.branch_id || raw.branchId || record?.branch_id || '').trim(),
    bank_name: String(raw.bank_name || raw.bankName || raw.nama_bank || '').trim(),
    account_number: String(raw.account_number || raw.accountNumber || raw.no_rekening || raw.nomor_rekening || '').trim(),
    opening_balance: roundMoney(raw.opening_balance || raw.saldo_awal || 0),
    current_balance: roundMoney(raw.current_balance || raw.saldo_sekarang || raw.balance || raw.saldo || 0),
    status: normalizeMasterStatus(raw),
    isDeleted: isSoftDeleted(raw),
    raw,
  };
};

const normalizeCashBankRecord = (row) => {
  const packageInput =
    row?.cash_transaction_package ||
    row?.cashTransactionPackage ||
    row?.transfer_transaction_package ||
    row?.transferTransactionPackage ||
    row?.cashflow_package ||
    row ||
    {};

  const header =
    packageInput.cash_header ||
    packageInput.transfer_header ||
    packageInput.transaction_header ||
    packageInput.header ||
    row?.cash_header ||
    row?.transaction_header ||
    row ||
    {};

  const snapshot =
    packageInput.snapshot_package ||
    packageInput.cash_snapshot ||
    packageInput.transfer_snapshot ||
    parseJson(header.snapshot_package_json, null) ||
    parseJson(header.cash_snapshot_json, null) ||
    null;

  const snapshotPayload = snapshot?.payload?.cash_snapshot || snapshot?.payload?.transfer_snapshot || snapshot?.payload || null;
  const snapshotHeader = snapshotPayload?.cash_header || snapshotPayload?.transfer_header || snapshotPayload?.transaction_header || {};

  const finalHeader = {
    ...snapshotHeader,
    ...header,
  };

  const transactionId = String(
    finalHeader.transaction_id ||
    finalHeader.cash_transaction_id ||
    finalHeader.transfer_id ||
    finalHeader.kas_bank_id ||
    finalHeader.id ||
    row?.transaction_id ||
    row?.id ||
    '',
  ).trim();

  const transactionCode = String(
    finalHeader.transaction_code ||
    finalHeader.cash_transaction_code ||
    finalHeader.transfer_code ||
    finalHeader.code ||
    transactionId ||
    '',
  ).trim();

  const transactionType = normalizeCode(
    finalHeader.transaction_type ||
    finalHeader.cash_transaction_type ||
    finalHeader.type ||
    'MONEY_IN',
  );

  const amount = roundMoney(
    finalHeader.amount ||
    finalHeader.nominal ||
    finalHeader.total_amount ||
    0,
  );

  return {
    id: String(finalHeader.id || transactionId).trim(),

    transaction_id: transactionId,
    transaction_code: transactionCode,
    transaction_date: normalizeDate(finalHeader.transaction_date || finalHeader.cash_date || finalHeader.transfer_date || finalHeader.date || finalHeader.created_at || row?.date || ''),

    transaction_type: TRANSACTION_TYPES.includes(transactionType) ? transactionType : 'MONEY_IN',
    source_module: normalizeCode(finalHeader.source_module || finalHeader.sourceModule || finalHeader.module || 'MANUAL'),

    branch_id: String(finalHeader.branch_id || finalHeader.branchId || '').trim(),

    account_id: String(finalHeader.account_id || finalHeader.cash_account_id || finalHeader.from_account_id || finalHeader.source_account_id || '').trim(),
    account_name: String(finalHeader.account_name || finalHeader.cash_account_name || finalHeader.from_account_name || '').trim(),

    target_account_id: String(finalHeader.target_account_id || finalHeader.to_account_id || finalHeader.destination_account_id || '').trim(),
    target_account_name: String(finalHeader.target_account_name || finalHeader.to_account_name || finalHeader.destination_account_name || '').trim(),

    amount,
    reference_number: String(finalHeader.reference_number || finalHeader.ref_number || finalHeader.no_ref || '').trim(),

    notes: String(finalHeader.notes || finalHeader.keterangan || '').trim(),
    status: normalizeTransactionStatus(finalHeader),

    created_at: finalHeader.created_at || row?.created_at || '',
    updated_at: finalHeader.updated_at || row?.updated_at || '',
    posted_at: finalHeader.posted_at || row?.posted_at || '',
    voided_at: finalHeader.voided_at || row?.voided_at || '',

    search_text: normalizeText([
      transactionId,
      transactionCode,
      finalHeader.reference_number,
      finalHeader.transaction_type,
      finalHeader.source_module,
      finalHeader.branch_id,
      finalHeader.account_id,
      finalHeader.account_name,
      finalHeader.target_account_id,
      finalHeader.target_account_name,
      finalHeader.notes,
      finalHeader.status,
    ].filter(Boolean).join(' ')),

    raw: row,
  };
};

const buildMasterSource = ({
  dbData,
  rawAccountRows,
  rawTransactionRows,
  rawBranchRows,
}) => {
  return {
    ...(dbData || {}),

    master_cash_bank_accounts: rawAccountRows,
    masterCashBankAccounts: rawAccountRows,
    cash_bank_accounts: rawAccountRows,
    cashBankAccounts: rawAccountRows,
    master_accounts: rawAccountRows,
    masterAccounts: rawAccountRows,

    cash_bank_transactions: rawTransactionRows,
    cashBankTransactions: rawTransactionRows,
    kas_bank_transactions: rawTransactionRows,
    kasBankTransactions: rawTransactionRows,
    cashflow_transactions: rawTransactionRows,
    cashflowTransactions: rawTransactionRows,

    master_branches: rawBranchRows,
    masterBranches: rawBranchRows,
    master_branch: rawBranchRows,
  };
};

const normalizeCashPackageFromOrchestrator = (result) => {
  const base = result?.transaction_package || result?.package || result?.data || result || {};

  return {
    cash_transaction_package:
      base.cash_transaction_package ||
      base.cashTransactionPackage ||
      base.cashflow_package ||
      base.cash_package ||
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
      base.cash_snapshot ||
      base.snapshot ||
      null,

    warnings:
      base.warnings ||
      result?.warnings ||
      [],

    raw_orchestrator_response: result,
  };
};

const normalizeTransferPackageFromOrchestrator = (result) => {
  const base = result?.transaction_package || result?.package || result?.data || result || {};

  return {
    transfer_transaction_package:
      base.transfer_transaction_package ||
      base.transferTransactionPackage ||
      base.transfer_package ||
      base.transfer ||
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
      base.transfer_snapshot ||
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
      base.cash_reversal_package ||
      base.transfer_reversal_package ||
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

const validatePostedCashPackage = (packageResult, isTransfer) => {
  const missing = [];

  if (isTransfer) {
    if (!packageResult.transfer_transaction_package) missing.push('transfer_transaction_package');
  } else {
    if (!packageResult.cash_transaction_package) missing.push('cash_transaction_package');
  }

  if (!packageResult.accounting_package) missing.push('accounting_package');
  if (!packageResult.snapshot_package) missing.push('snapshot_package');

  return missing;
};

const validateVoidPackage = (packageResult) => {
  const missing = [];

  if (!packageResult.reversal_package) missing.push('reversal_package');

  return missing;
};

const getAccountIcon = (type) => {
  const normalized = normalizeCode(type);

  if (normalized === 'CASH') return <Banknote size={15} />;
  if (normalized === 'BANK') return <Landmark size={15} />;

  return <CreditCard size={15} />;
};

const getTransactionIcon = (type) => {
  const normalized = normalizeCode(type);

  if (normalized === 'MONEY_IN') return <ArrowDownCircle size={15} />;
  if (normalized === 'MONEY_OUT') return <ArrowUpCircle size={15} />;
  if (normalized === 'TRANSFER') return <ArrowRightLeft size={15} />;

  return <RefreshCw size={15} />;
};

const createCashCommand = ({
  form,
  mode,
  executor,
  masterSource,
}) => {
  return {
    transaction_type: 'CASH_BANK',
    action: mode,
    mode,

    cash_header: {
      transaction_id: form.transaction_id,
      transaction_code: form.transaction_code,
      transaction_date: form.transaction_date,

      transaction_type: form.transaction_type,
      source_module: form.source_module,

      branch_id: form.branch_id,

      account_id: form.account_id,
      account_name: form.account_name,

      target_account_id: form.target_account_id,
      target_account_name: form.target_account_name,

      amount: roundMoney(form.amount),
      reference_number: form.reference_number,

      notes: form.notes,
      status: mode === 'POST' ? 'POSTED' : 'DRAFT',

      created_by: executor,
      updated_by: executor,
    },

    source: masterSource,
    dbData: masterSource,
    masterData: masterSource,
  };
};

const createTransferCommand = ({
  form,
  mode,
  executor,
  masterSource,
}) => {
  return {
    transaction_type: 'TRANSFER',
    action: mode,
    mode,

    transfer_header: {
      transaction_id: form.transaction_id,
      transfer_id: form.transaction_id,
      transaction_code: form.transaction_code,
      transfer_code: form.transaction_code,
      transaction_date: form.transaction_date,
      transfer_date: form.transaction_date,

      transaction_type: 'TRANSFER',
      source_module: 'TRANSFER',

      branch_id: form.branch_id,

      from_account_id: form.account_id,
      from_account_name: form.account_name,

      to_account_id: form.target_account_id,
      to_account_name: form.target_account_name,

      amount: roundMoney(form.amount),
      reference_number: form.reference_number,

      notes: form.notes,
      status: mode === 'POST' ? 'POSTED' : 'DRAFT',

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

export default function TabKasBank({
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

  cashBankTransactions = [],
  cash_bank_transactions,
  kasBankTransactions,
  kas_bank_transactions,
  cashflowTransactions,
  cashflow_transactions,
  moneyTransactions,
  money_transactions,

  masterBranches = [],
  master_branches,
  master_branch,
  branches,

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
    transaction_date: todayStr,
    branch_id: isOwnerMode ? '' : userBranchId,
  });

  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [accountFilter, setAccountFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState(isOwnerMode ? 'ALL' : userBranchId || 'ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');

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

  const rawTransactionRows = useMemo(() => {
    return getRawTransactionRows({
      cashBankTransactions,
      cash_bank_transactions,
      kasBankTransactions,
      kas_bank_transactions,
      cashflowTransactions,
      cashflow_transactions,
      moneyTransactions,
      money_transactions,
      dbData,
    });
  }, [
    cashBankTransactions,
    cash_bank_transactions,
    kasBankTransactions,
    kas_bank_transactions,
    cashflowTransactions,
    cashflow_transactions,
    moneyTransactions,
    money_transactions,
    dbData,
  ]);

  const rawBranchRows = useMemo(() => {
    return getRawBranchRows({
      masterBranches,
      master_branches,
      master_branch,
      branches,
      dbData,
    });
  }, [masterBranches, master_branches, master_branch, branches, dbData]);

  const masterSource = useMemo(() => {
    return buildMasterSource({
      dbData,
      rawAccountRows,
      rawTransactionRows,
      rawBranchRows,
    });
  }, [dbData, rawAccountRows, rawTransactionRows, rawBranchRows]);

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

  const transactionRecords = useMemo(() => {
    return rawTransactionRows
      .map(normalizeCashBankRecord)
      .sort((a, b) => {
        const dateCompare = String(b.transaction_date || '').localeCompare(String(a.transaction_date || ''));
        if (dateCompare !== 0) return dateCompare;
        return String(b.transaction_id || '').localeCompare(String(a.transaction_id || ''));
      });
  }, [rawTransactionRows]);

  const effectiveBranchFilter = !isOwnerMode && userBranchId ? userBranchId : branchFilter;

  const activeBranchRecords = useMemo(() => {
    return branchRecords.filter((branch) => branch.status === 'ACTIVE');
  }, [branchRecords]);

  const activeAccountsByBranch = useMemo(() => {
    return accountRecords.filter((account) => {
      if (account.status !== 'ACTIVE') return false;
      if (!form.branch_id) return true;
      return account.branch_id === form.branch_id;
    });
  }, [accountRecords, form.branch_id]);

  const targetAccountsByBranch = useMemo(() => {
    return accountRecords.filter((account) => {
      if (account.status !== 'ACTIVE') return false;
      if (account.account_id === form.account_id) return false;
      if (isOwnerMode) return true;
      if (!form.branch_id) return true;
      return account.branch_id === form.branch_id;
    });
  }, [accountRecords, form.account_id, form.branch_id, isOwnerMode]);

  const branchNameById = useMemo(() => {
    const map = new Map();

    branchRecords.forEach((branch) => {
      map.set(branch.branch_id, branch.branch_name || branch.branch_id);
      map.set(branch.branch_code, branch.branch_name || branch.branch_id);
    });

    return map;
  }, [branchRecords]);

  const accountNameById = useMemo(() => {
    const map = new Map();

    accountRecords.forEach((account) => {
      map.set(account.account_id, account.account_name || account.account_id);
      map.set(account.account_code, account.account_name || account.account_id);
    });

    return map;
  }, [accountRecords]);

  const filteredTransactions = useMemo(() => {
    const keyword = normalizeText(searchQuery);

    return transactionRecords.filter((transaction) => {
      const branchOk = effectiveBranchFilter === 'ALL' || transaction.branch_id === effectiveBranchFilter;
      const accountOk = accountFilter === 'ALL' || transaction.account_id === accountFilter || transaction.target_account_id === accountFilter;
      const statusOk = statusFilter === 'ALL' || transaction.status === statusFilter;

      const dateOk = (!dateFromFilter || transaction.transaction_date >= dateFromFilter) &&
        (!dateToFilter || transaction.transaction_date <= dateToFilter);

      const searchOk = !keyword || transaction.search_text.includes(keyword);

      return branchOk && accountOk && statusOk && dateOk && searchOk;
    });
  }, [
    transactionRecords,
    effectiveBranchFilter,
    accountFilter,
    statusFilter,
    dateFromFilter,
    dateToFilter,
    searchQuery,
  ]);

  const analytics = useMemo(() => {
    const scopedAccounts = accountRecords.filter((account) => {
      if (account.status !== 'ACTIVE') return false;
      if (effectiveBranchFilter === 'ALL') return true;
      return account.branch_id === effectiveBranchFilter;
    });

    const postedTransactions = transactionRecords.filter((transaction) => {
      if (transaction.status !== 'POSTED') return false;
      if (effectiveBranchFilter === 'ALL') return true;
      return transaction.branch_id === effectiveBranchFilter;
    });

    const saldoKas = scopedAccounts
      .filter((account) => account.account_type === 'CASH')
      .reduce((sum, account) => sum + toNumber(account.current_balance), 0);

    const saldoBank = scopedAccounts
      .filter((account) => account.account_type === 'BANK')
      .reduce((sum, account) => sum + toNumber(account.current_balance), 0);

    const uangMasuk = postedTransactions
      .filter((transaction) => transaction.transaction_type === 'MONEY_IN')
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);

    const uangKeluar = postedTransactions
      .filter((transaction) => transaction.transaction_type === 'MONEY_OUT')
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);

    const totalTransfer = postedTransactions
      .filter((transaction) => transaction.transaction_type === 'TRANSFER')
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);

    const adjustmentNet = postedTransactions
      .filter((transaction) => transaction.transaction_type === 'ADJUSTMENT')
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);

    return {
      saldo_kas: roundMoney(saldoKas),
      saldo_bank: roundMoney(saldoBank),
      uang_masuk: roundMoney(uangMasuk),
      uang_keluar: roundMoney(uangKeluar),
      transfer: roundMoney(totalTransfer),
      cashflow_bersih: roundMoney(uangMasuk - uangKeluar + adjustmentNet),
      draft_count: transactionRecords.filter((transaction) => transaction.status === 'DRAFT').length,
      posted_count: postedTransactions.length,
      void_count: transactionRecords.filter((transaction) => transaction.status === 'VOID').length,
    };
  }, [accountRecords, transactionRecords, effectiveBranchFilter]);

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
      transaction_date: todayStr,
      branch_id: isOwnerMode ? '' : userBranchId,
    });
    setIsEditingDraft(false);
    setSelectedTransaction(null);
  };

  const handleGenerateId = () => {
    const newId = generateId('CASH', todayStr);

    setForm((prev) => ({
      ...prev,
      id: prev.id || newId,
      transaction_id: prev.transaction_id || newId,
      transaction_code: prev.transaction_code || newId,
    }));
  };

  const handleBranchChange = (branchId) => {
    setForm((prev) => ({
      ...prev,
      branch_id: branchId,
      account_id: '',
      account_name: '',
      target_account_id: '',
      target_account_name: '',
    }));
  };

  const handleAccountChange = (accountId) => {
    const account = accountRecords.find((item) => item.account_id === accountId);

    setForm((prev) => ({
      ...prev,
      account_id: accountId,
      account_name: account?.account_name || '',
      branch_id: account?.branch_id || prev.branch_id,
    }));
  };

  const handleTargetAccountChange = (accountId) => {
    const account = accountRecords.find((item) => item.account_id === accountId);

    setForm((prev) => ({
      ...prev,
      target_account_id: accountId,
      target_account_name: account?.account_name || '',
    }));
  };

  const handleTransactionTypeChange = (transactionType) => {
    setForm((prev) => ({
      ...prev,
      transaction_type: transactionType,
      source_module: transactionType === 'TRANSFER' ? 'TRANSFER' : prev.source_module === 'TRANSFER' ? 'MANUAL' : prev.source_module,
      target_account_id: transactionType === 'TRANSFER' ? prev.target_account_id : '',
      target_account_name: transactionType === 'TRANSFER' ? prev.target_account_name : '',
    }));
  };

  const applyOwnerDeposit = () => {
    setForm((prev) => ({
      ...prev,
      transaction_type: 'MONEY_IN',
      source_module: 'OWNER_DEPOSIT',
      target_account_id: '',
      target_account_name: '',
    }));
  };

  const applyOwnerWithdraw = () => {
    setForm((prev) => ({
      ...prev,
      transaction_type: 'MONEY_OUT',
      source_module: 'OWNER_WITHDRAW',
      target_account_id: '',
      target_account_name: '',
    }));
  };

  const applyTransfer = () => {
    setForm((prev) => ({
      ...prev,
      transaction_type: 'TRANSFER',
      source_module: 'TRANSFER',
    }));
  };

  const validateKasBankForm = ({ posting = false } = {}) => {
    const warnings = [];

    if (!form.transaction_id.trim()) warnings.push('Transaction ID wajib diisi.');
    if (!form.transaction_code.trim()) warnings.push('Transaction Code wajib diisi.');
    if (!form.transaction_date.trim()) warnings.push('Tanggal transaksi wajib diisi.');
    if (!form.transaction_type.trim()) warnings.push('Transaction Type wajib dipilih.');
    if (!form.source_module.trim()) warnings.push('Source Module wajib dipilih.');
    if (!form.branch_id.trim()) warnings.push('Branch ID wajib dipilih.');
    if (!form.account_id.trim()) warnings.push('Account sumber wajib dipilih.');
    if (roundMoney(form.amount) <= 0) warnings.push('Nominal wajib lebih dari 0.');

    const branchExists = branchRecords.some((branch) => {
      return branch.branch_id === form.branch_id &&
        branch.status === 'ACTIVE' &&
        !branch.isDeleted;
    });

    if (form.branch_id && !branchExists) {
      warnings.push('Cabang tidak ditemukan atau tidak aktif.');
    }

    const accountExists = accountRecords.some((account) => {
      return account.account_id === form.account_id &&
        account.status === 'ACTIVE' &&
        !account.isDeleted &&
        (isOwnerMode || account.branch_id === form.branch_id);
    });

    if (form.account_id && !accountExists) {
      warnings.push('Account sumber tidak ditemukan atau tidak aktif.');
    }

    if (form.transaction_type === 'TRANSFER') {
      if (!form.target_account_id.trim()) warnings.push('Target account wajib dipilih untuk transfer.');

      if (form.account_id && form.target_account_id && form.account_id === form.target_account_id) {
        warnings.push('Transfer tidak boleh ke account yang sama.');
      }

      const targetExists = accountRecords.some((account) => {
        return account.account_id === form.target_account_id &&
          account.status === 'ACTIVE' &&
          !account.isDeleted &&
          (isOwnerMode || account.branch_id === form.branch_id);
      });

      if (form.target_account_id && !targetExists) {
        warnings.push('Target account tidak ditemukan atau tidak aktif.');
      }
    }

    if (!isOwnerMode && userBranchId && form.branch_id !== userBranchId) {
      warnings.push('User cabang hanya boleh membuat transaksi kas/bank di branch miliknya.');
    }

    if (posting && form.status === 'VOID') {
      warnings.push('Transaksi VOID tidak bisa diposting ulang.');
    }

    return warnings;
  };

  const persistKasBank = async (action, payload) => {
    if (typeof sendToSheet !== 'function') {
      notify('sendToSheet belum tersedia. Data kas bank belum bisa disimpan ke cloud.', 'error');
      return false;
    }

    let isSuccess = false;

    try {
      isSuccess = await sendToSheet(action, CASH_BANK_TABLE_NAME, payload);
    } catch (error) {
      isSuccess = false;
    }

    if (!isSuccess) {
      try {
        isSuccess = await sendToSheet(action, payload, CASH_BANK_TABLE_NAME);
      } catch (error) {
        isSuccess = false;
      }
    }

    return Boolean(isSuccess);
  };

  const runProcessCashTransaction = async ({ mode }) => {
    if (form.transaction_type === 'TRANSFER') {
      if (!erpOrchestrator || typeof erpOrchestrator.processTransferTransaction !== 'function') {
        return {
          ok: false,
          message: 'erpOrchestrator.processTransferTransaction() belum tersedia. Revisi harus dilakukan di src/services/erpOrchestrator.js.',
        };
      }

      const command = createTransferCommand({
        form,
        mode,
        executor,
        masterSource,
      });

      try {
        const result = await Promise.resolve(
          erpOrchestrator.processTransferTransaction(command, {
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
            message: result.message || result.error || 'erpOrchestrator.processTransferTransaction() mengembalikan status tidak OK.',
          };
        }

        const packageResult = normalizeTransferPackageFromOrchestrator(result);

        if (mode === 'POST') {
          const missing = validatePostedCashPackage(packageResult, true);

          if (missing.length > 0) {
            return {
              ok: false,
              message: `Package transfer orchestrator belum lengkap: ${missing.join(', ')}. Revisi alur di src/services/erpOrchestrator.js, bukan di UI.`,
            };
          }
        }

        return {
          ok: true,
          packageResult,
          isTransfer: true,
        };
      } catch (error) {
        return {
          ok: false,
          message: error.message || 'erpOrchestrator.processTransferTransaction() gagal dijalankan.',
        };
      }
    }

    if (!erpOrchestrator || typeof erpOrchestrator.processCashTransaction !== 'function') {
      return {
        ok: false,
        message: 'erpOrchestrator.processCashTransaction() belum tersedia. Revisi harus dilakukan di src/services/erpOrchestrator.js.',
      };
    }

    const command = createCashCommand({
      form,
      mode,
      executor,
      masterSource,
    });

    try {
      const result = await Promise.resolve(
        erpOrchestrator.processCashTransaction(command, {
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
          message: result.message || result.error || 'erpOrchestrator.processCashTransaction() mengembalikan status tidak OK.',
        };
      }

      const packageResult = normalizeCashPackageFromOrchestrator(result);

      if (mode === 'POST') {
        const missing = validatePostedCashPackage(packageResult, false);

        if (missing.length > 0) {
          return {
            ok: false,
            message: `Package cash orchestrator belum lengkap: ${missing.join(', ')}. Revisi alur di src/services/erpOrchestrator.js, bukan di UI.`,
          };
        }
      }

      return {
        ok: true,
        packageResult,
        isTransfer: false,
      };
    } catch (error) {
      return {
        ok: false,
        message: error.message || 'erpOrchestrator.processCashTransaction() gagal dijalankan.',
      };
    }
  };

  const createLocalPayload = ({
    status,
    packageResult = null,
    voidPackageResult = null,
    isTransfer = false,
  }) => {
    return {
      ...(selectedTransaction?.raw || {}),

      id: selectedTransaction?.id || form.transaction_id,
      date: selectedTransaction?.raw?.date || todayStr,

      transaction_id: form.transaction_id,
      transaction_code: form.transaction_code,
      transaction_date: form.transaction_date,

      transaction_type: form.transaction_type,
      source_module: form.source_module,

      branch_id: form.branch_id,

      account_id: form.account_id,
      account_name: form.account_name,

      target_account_id: form.target_account_id,
      target_account_name: form.target_account_name,

      amount: roundMoney(form.amount),
      reference_number: form.reference_number,

      notes: form.notes,

      status,
      transaction_status: status,

      cash_transaction_package: !isTransfer ? packageResult?.cash_transaction_package || selectedTransaction?.raw?.cash_transaction_package || null : selectedTransaction?.raw?.cash_transaction_package || null,
      cash_transaction_package_json: !isTransfer && packageResult?.cash_transaction_package ? JSON.stringify(packageResult.cash_transaction_package) : selectedTransaction?.raw?.cash_transaction_package_json || '',

      transfer_transaction_package: isTransfer ? packageResult?.transfer_transaction_package || selectedTransaction?.raw?.transfer_transaction_package || null : selectedTransaction?.raw?.transfer_transaction_package || null,
      transfer_transaction_package_json: isTransfer && packageResult?.transfer_transaction_package ? JSON.stringify(packageResult.transfer_transaction_package) : selectedTransaction?.raw?.transfer_transaction_package_json || '',

      accounting_package: packageResult?.accounting_package || selectedTransaction?.raw?.accounting_package || null,
      accounting_package_json: packageResult?.accounting_package ? JSON.stringify(packageResult.accounting_package) : selectedTransaction?.raw?.accounting_package_json || '',

      snapshot_package: packageResult?.snapshot_package || voidPackageResult?.snapshot_package || selectedTransaction?.raw?.snapshot_package || null,
      snapshot_package_json: packageResult?.snapshot_package
        ? JSON.stringify(packageResult.snapshot_package)
        : voidPackageResult?.snapshot_package
          ? JSON.stringify(voidPackageResult.snapshot_package)
          : selectedTransaction?.raw?.snapshot_package_json || '',

      reversal_package: voidPackageResult?.reversal_package || selectedTransaction?.raw?.reversal_package || null,
      reversal_package_json: voidPackageResult?.reversal_package ? JSON.stringify(voidPackageResult.reversal_package) : selectedTransaction?.raw?.reversal_package_json || '',

      orchestrator_response_json: packageResult?.raw_orchestrator_response
        ? JSON.stringify(packageResult.raw_orchestrator_response)
        : voidPackageResult?.raw_orchestrator_response
          ? JSON.stringify(voidPackageResult.raw_orchestrator_response)
          : selectedTransaction?.raw?.orchestrator_response_json || '',

      engine_warnings_json: packageResult?.warnings
        ? JSON.stringify(packageResult.warnings)
        : voidPackageResult?.warnings
          ? JSON.stringify(voidPackageResult.warnings)
          : selectedTransaction?.raw?.engine_warnings_json || '',

      created_at: selectedTransaction?.raw?.created_at || new Date().toISOString(),
      created_by: selectedTransaction?.raw?.created_by || executor,
      updated_at: new Date().toISOString(),
      updated_by: executor,

      posted_at: status === 'POSTED' ? selectedTransaction?.raw?.posted_at || new Date().toISOString() : selectedTransaction?.raw?.posted_at || '',
      posted_by: status === 'POSTED' ? selectedTransaction?.raw?.posted_by || executor : selectedTransaction?.raw?.posted_by || '',

      voided_at: status === 'VOID' ? new Date().toISOString() : selectedTransaction?.raw?.voided_at || '',
      voided_by: status === 'VOID' ? executor : selectedTransaction?.raw?.voided_by || '',
    };
  };

  const handleSaveDraft = async () => {
    const warnings = validateKasBankForm({ posting: false });

    if (warnings.length > 0) {
      notify(warnings.join('\n'), 'error');
      return;
    }

    const orchestratorResult = await runProcessCashTransaction({ mode: 'DRAFT' });

    if (!orchestratorResult.ok) {
      notify(orchestratorResult.message, 'error');
      return;
    }

    const payload = createLocalPayload({
      status: 'DRAFT',
      packageResult: orchestratorResult.packageResult,
      isTransfer: orchestratorResult.isTransfer,
    });

    const action = isEditingDraft ? 'update' : 'insert';
    const isSuccess = await persistKasBank(action, payload);

    if (isSuccess) {
      notify(isEditingDraft ? 'Draft kas bank berhasil diperbarui.' : 'Draft kas bank berhasil dibuat.', 'success');
      resetForm();
    }
  };

  const handlePostTransaction = async () => {
    const warnings = validateKasBankForm({ posting: true });

    if (warnings.length > 0) {
      notify(warnings.join('\n'), 'error');
      return;
    }

    const confirmed = window.confirm(
      'Posting transaksi kas/bank? Setelah POSTED, transaksi tidak boleh diedit dan hanya bisa VOID.',
    );

    if (!confirmed) return;

    const orchestratorResult = await runProcessCashTransaction({ mode: 'POST' });

    if (!orchestratorResult.ok) {
      notify(orchestratorResult.message, 'error');
      return;
    }

    const payload = createLocalPayload({
      status: 'POSTED',
      packageResult: orchestratorResult.packageResult,
      isTransfer: orchestratorResult.isTransfer,
    });

    const action = isEditingDraft ? 'update' : 'insert';
    const isSuccess = await persistKasBank(action, payload);

    if (isSuccess) {
      notify('Transaksi kas/bank berhasil diposting melalui erpOrchestrator. Jurnal dan snapshot dibuat oleh orchestrator.', 'success');
      resetForm();
    }
  };

  const handleEditDraft = (transaction) => {
    if (transaction.status !== 'DRAFT') {
      notify('Hanya transaksi DRAFT yang boleh diedit.', 'error');
      return;
    }

    setSelectedTransaction(transaction);
    setIsEditingDraft(true);

    setForm({
      id: transaction.id || transaction.transaction_id,
      transaction_id: transaction.transaction_id,
      transaction_code: transaction.transaction_code,
      transaction_date: transaction.transaction_date || todayStr,
      transaction_type: transaction.transaction_type || 'MONEY_IN',
      source_module: transaction.source_module || 'MANUAL',
      branch_id: transaction.branch_id,
      account_id: transaction.account_id,
      account_name: transaction.account_name || accountNameById.get(transaction.account_id) || '',
      target_account_id: transaction.target_account_id,
      target_account_name: transaction.target_account_name || accountNameById.get(transaction.target_account_id) || '',
      amount: String(transaction.amount || ''),
      reference_number: transaction.reference_number || '',
      notes: transaction.notes || '',
      status: 'DRAFT',
    });
  };

  const runProcessVoidTransaction = async (transaction) => {
    if (!erpOrchestrator || typeof erpOrchestrator.processVoidTransaction !== 'function') {
      return {
        ok: false,
        message: 'erpOrchestrator.processVoidTransaction() belum tersedia. Revisi harus dilakukan di src/services/erpOrchestrator.js.',
      };
    }

    try {
      const result = await Promise.resolve(
        erpOrchestrator.processVoidTransaction({
          transaction_type: transaction.transaction_type === 'TRANSFER' ? 'TRANSFER' : 'CASH_BANK',
          transaction_id: transaction.transaction_id,
          transaction_code: transaction.transaction_code,
          branch_id: transaction.branch_id,
          original_transaction: transaction.raw,
          reason: 'VOID_CASH_BANK_FROM_UI',
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

  const handleVoidTransaction = async (transaction) => {
    if (transaction.status !== 'POSTED') {
      notify('Hanya transaksi POSTED yang bisa di-void.', 'error');
      return;
    }

    const confirmed = window.confirm(
      `Void transaksi ${transaction.transaction_code || transaction.transaction_id}? Histori tidak dihapus, orchestrator akan membuat reversal package.`,
    );

    if (!confirmed) return;

    const voidResult = await runProcessVoidTransaction(transaction);

    if (!voidResult.ok) {
      notify(voidResult.message, 'error');
      return;
    }

    const payload = {
      ...(transaction.raw || {}),
      id: transaction.id || transaction.transaction_id,
      transaction_id: transaction.transaction_id,
      status: 'VOID',
      transaction_status: 'VOID',
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

    const isSuccess = await persistKasBank('update', payload);

    if (isSuccess) {
      notify('Transaksi kas/bank berhasil di-void melalui erpOrchestrator. Reversal package dibuat oleh orchestrator.', 'success');
      if (selectedTransaction?.transaction_id === transaction.transaction_id) resetForm();
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
                Modul Kas & Bank ERP
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              Kas & Bank Dimsum Aditya
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-300">
              Thin UI cashflow. Semua jurnal, transfer, posting, reversal, dan snapshot wajib dibuat oleh erpOrchestrator.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">{isOwnerMode ? 'Owner Mode Lintas Cabang' : 'Branch Mode'}</Badge>
            <Badge tone="amber">Thin UI</Badge>
            <Badge tone="green">Orchestrator Only</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Saldo Kas" value={formatMoney(analytics.saldo_kas)} icon={<Banknote size={18} />} tone="red" />
        <StatCard title="Saldo Bank" value={formatMoney(analytics.saldo_bank)} icon={<Landmark size={18} />} tone="white" />
        <StatCard title="Uang Masuk" value={formatMoney(analytics.uang_masuk)} icon={<ArrowDownCircle size={18} />} tone="gold" />
        <StatCard title="Uang Keluar" value={formatMoney(analytics.uang_keluar)} icon={<ArrowUpCircle size={18} />} tone="white" />
        <StatCard title="Transfer" value={formatMoney(analytics.transfer)} icon={<ArrowRightLeft size={18} />} tone="white" />
        <StatCard title="Net Cashflow" value={formatMoney(analytics.cashflow_bersih)} icon={<TrendingUp size={18} />} tone="dark" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-red-50 p-3 text-red-600">
              <Crown size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Account Aktif</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {accountRecords.filter((account) => account.status === 'ACTIVE').length}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                Cash, Bank, dan E-Wallet
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
              <ReceiptText size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Posted Transaction</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.posted_count}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                Jurnal & snapshot terkunci
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <Undo2 size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Void Transaction</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.void_count}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                Reversal via orchestrator
              </div>
            </div>
          </div>
        </div>
      </div>

      {analytics.draft_count > 0 && (
        <div className="rounded-[2rem] border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-3 text-amber-700 shadow-sm">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black text-amber-900">DRAFT CASHFLOW WARNING</h2>
                <p className="mt-1 text-xs font-bold text-amber-700">
                  Ada {analytics.draft_count} transaksi kas/bank masih draft. Posting agar jurnal dan snapshot terkunci.
                </p>
              </div>
            </div>
            <Badge tone="amber">Cashflow Monitoring</Badge>
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
                  {isEditingDraft ? 'Edit Draft Kas Bank' : 'Tambah Transaksi Kas Bank'}
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

            <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3">
              <button
                type="button"
                onClick={applyOwnerDeposit}
                className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-700 transition-all hover:bg-emerald-100"
              >
                <Users size={13} />
                Owner Deposit
              </button>

              <button
                type="button"
                onClick={applyOwnerWithdraw}
                className="flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-black text-red-700 transition-all hover:bg-red-100"
              >
                <Users size={13} />
                Owner Withdraw
              </button>

              <button
                type="button"
                onClick={applyTransfer}
                className="flex items-center justify-center gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-[10px] font-black text-amber-700 transition-all hover:bg-amber-100"
              >
                <ArrowRightLeft size={13} />
                Transfer
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Transaction ID" required>
                  <div className="flex gap-2">
                    <input
                      disabled={isEditingDraft}
                      value={form.transaction_id}
                      onChange={(event) => setForm({ ...form, transaction_id: normalizeCode(event.target.value), id: normalizeCode(event.target.value) })}
                      className={inputClass}
                      placeholder="CASH-001"
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

                <Field label="Transaction Code" required>
                  <input
                    value={form.transaction_code}
                    onChange={(event) => setForm({ ...form, transaction_code: normalizeCode(event.target.value) })}
                    className={inputClass}
                    placeholder="CASH-IN-001"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Tanggal" required>
                  <input
                    type="date"
                    value={form.transaction_date}
                    onChange={(event) => setForm({ ...form, transaction_date: event.target.value })}
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

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Transaction Type" required>
                  <select
                    value={form.transaction_type}
                    onChange={(event) => handleTransactionTypeChange(event.target.value)}
                    className={inputClass}
                  >
                    {TRANSACTION_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Source Module" required>
                  <select
                    value={form.source_module}
                    onChange={(event) => setForm({ ...form, source_module: event.target.value })}
                    className={inputClass}
                    disabled={form.transaction_type === 'TRANSFER'}
                  >
                    {SOURCE_MODULES.map((source) => (
                      <option key={source} value={source}>{source}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label={form.transaction_type === 'TRANSFER' ? 'Account Sumber' : 'Account'} required>
                <select
                  value={form.account_id}
                  onChange={(event) => handleAccountChange(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Pilih account kas/bank</option>
                  {activeAccountsByBranch.map((account) => (
                    <option key={account.account_id} value={account.account_id}>
                      {account.account_name} — {account.account_type} — {formatMoney(account.current_balance)}
                    </option>
                  ))}
                </select>
              </Field>

              {form.transaction_type === 'TRANSFER' && (
                <Field label="Target Account" required>
                  <select
                    value={form.target_account_id}
                    onChange={(event) => handleTargetAccountChange(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Pilih target account</option>
                    {targetAccountsByBranch.map((account) => (
                      <option key={account.account_id} value={account.account_id}>
                        {account.account_name} — {account.account_type} — {branchNameById.get(account.branch_id) || account.branch_id}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <Field label="Amount" required>
                <input
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  className={inputClass}
                  placeholder="0"
                />
              </Field>

              <Field label="Reference Number">
                <input
                  value={form.reference_number}
                  onChange={(event) => setForm({ ...form, reference_number: event.target.value })}
                  className={inputClass}
                  placeholder="REF-001 / Bukti transfer"
                />
              </Field>

              <Field label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Catatan transaksi kas/bank..."
                />
              </Field>

              <div className="rounded-[2rem] border border-amber-100 bg-amber-50 p-4">
                <div className="grid grid-cols-2 gap-3 text-[11px] font-bold">
                  <div className="text-amber-700">Jenis</div>
                  <div className="text-right text-amber-950">{form.transaction_type}</div>

                  <div className="text-amber-700">Source</div>
                  <div className="text-right text-amber-950">{form.source_module}</div>

                  <div className="text-amber-700">Nominal</div>
                  <div className="text-right text-amber-950">{formatMoney(form.amount)}</div>
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
                  onClick={handlePostTransaction}
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
                    Daftar Transaksi Kas & Bank
                  </h2>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    Data cashflow terkunci: DRAFT editable, POSTED locked, VOID reversal.
                  </p>
                </div>

                <div className="flex flex-col gap-2 2xl:flex-row">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-xs font-bold outline-none transition-all placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50 md:w-64"
                      placeholder="Cari transaksi, akun, ref..."
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
                        {TRANSACTION_STATUS.map((status) => (
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
                      value={accountFilter}
                      onChange={(event) => setAccountFilter(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none focus:border-red-500"
                    >
                      <option value="ALL">SEMUA AKUN</option>
                      {accountRecords.map((account) => (
                        <option key={account.account_id} value={account.account_id}>
                          {account.account_name}
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
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Jenis</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Account</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cabang</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Nominal</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Source</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Status</th>
                    <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-14 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-red-50 text-red-600">
                          <WalletCards size={24} />
                        </div>
                        <div className="mt-3 text-sm font-black text-slate-800">Transaksi kas/bank tidak ditemukan</div>
                        <div className="mt-1 text-xs font-semibold text-slate-400">
                          Ubah filter atau buat transaksi kas/bank baru.
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredTransactions.map((transaction) => {
                    const isDraft = transaction.status === 'DRAFT';
                    const isPosted = transaction.status === 'POSTED';
                    const isVoid = transaction.status === 'VOID';

                    const branchName = branchNameById.get(transaction.branch_id) || 'Branch tidak ditemukan';
                    const accountName = accountNameById.get(transaction.account_id) || transaction.account_name || 'Account tidak ditemukan';
                    const targetName = accountNameById.get(transaction.target_account_id) || transaction.target_account_name || '';

                    return (
                      <tr key={`${transaction.transaction_id}-${transaction.transaction_code}`} className="border-b border-slate-100 transition-colors hover:bg-red-50/30">
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                              isPosted ? 'bg-red-600 text-white' : isDraft ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              <ReceiptText size={18} />
                            </div>
                            <div>
                              <div className="font-black text-slate-900">{transaction.transaction_code || transaction.transaction_id}</div>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                <Badge tone="slate">{transaction.transaction_id || '-'}</Badge>
                                {transaction.reference_number && <Badge tone="amber">{transaction.reference_number}</Badge>}
                              </div>
                              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                                <CalendarClock size={12} />
                                {transaction.transaction_date ? formatDate(transaction.transaction_date) : '-'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex items-center gap-2 text-xs font-black text-slate-900">
                            {getTransactionIcon(transaction.transaction_type)}
                            {transaction.transaction_type}
                          </div>
                          {transaction.transaction_type === 'TRANSFER' && (
                            <div className="mt-2">
                              <Badge tone="purple">TRANSFER</Badge>
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="space-y-2 text-[11px] font-bold">
                            <div className="flex items-start gap-2">
                              <WalletCards size={14} className="mt-0.5 shrink-0 text-slate-400" />
                              <div>
                                <div className="text-slate-800">{accountName}</div>
                                <div className="text-slate-400">{transaction.account_id || '-'}</div>
                              </div>
                            </div>

                            {transaction.transaction_type === 'TRANSFER' && (
                              <div className="flex items-start gap-2">
                                <ArrowRightLeft size={14} className="mt-0.5 shrink-0 text-slate-400" />
                                <div>
                                  <div className="text-slate-800">{targetName || 'Target tidak ditemukan'}</div>
                                  <div className="text-slate-400">{transaction.target_account_id || '-'}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-2 text-[11px] font-bold">
                            <Building2 size={14} className="mt-0.5 shrink-0 text-slate-400" />
                            <div>
                              <div className="text-slate-800">{branchName}</div>
                              <div className="text-slate-400">{transaction.branch_id || '-'}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className={`text-sm font-black ${
                            transaction.transaction_type === 'MONEY_IN'
                              ? 'text-emerald-700'
                              : transaction.transaction_type === 'MONEY_OUT'
                                ? 'text-red-700'
                                : 'text-slate-900'
                          }`}>
                            {formatMoney(transaction.amount)}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-slate-400">
                            {transaction.notes || '-'}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <Badge tone={
                            transaction.source_module === 'OWNER_DEPOSIT'
                              ? 'green'
                              : transaction.source_module === 'OWNER_WITHDRAW'
                                ? 'red'
                                : transaction.source_module === 'TRANSFER'
                                  ? 'purple'
                                  : 'slate'
                          }>
                            {transaction.source_module || 'MANUAL'}
                          </Badge>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <Badge tone={isPosted ? 'green' : isDraft ? 'amber' : isVoid ? 'dark' : 'slate'}>
                            {transaction.status}
                          </Badge>
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                            <History size={12} />
                            {transaction.updated_at ? formatDate(transaction.updated_at) : transaction.transaction_date ? formatDate(transaction.transaction_date) : '-'}
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
                              <button
                                type="button"
                                onClick={() => handleEditDraft(transaction)}
                                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                                title="Edit draft"
                              >
                                <Edit2 size={15} />
                              </button>
                            )}

                            {isPosted && (
                              <button
                                type="button"
                                onClick={() => handleVoidTransaction(transaction)}
                                className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100"
                                title="Void transaksi"
                              >
                                <Undo2 size={15} />
                              </button>
                            )}

                            {isVoid && (
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
                Menampilkan <span className="text-slate-800">{filteredTransactions.length}</span> dari <span className="text-slate-800">{transactionRecords.length}</span> transaksi kas/bank.
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge tone="red">Merah = Posted via Orchestrator</Badge>
                <Badge tone="amber">Gold = Draft</Badge>
                <Badge tone="dark">Dark = Void / Locked</Badge>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[2rem] border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
                <BadgeDollarSign size={17} className="text-red-600" />
                Master Account Kas & Bank
              </h2>
              <p className="mt-1 text-[11px] font-semibold text-slate-400">
                SSOT rekening kas, bank, dan e-wallet per cabang.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
              {accountRecords.filter((account) => {
                if (effectiveBranchFilter === 'ALL') return true;
                return account.branch_id === effectiveBranchFilter;
              }).map((account) => (
                <div key={account.account_id} className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-white p-3 text-red-600 shadow-sm">
                        {getAccountIcon(account.account_type)}
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900">{account.account_name}</div>
                        <div className="mt-1 text-[11px] font-bold text-slate-400">{account.account_code}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge tone={account.account_type === 'CASH' ? 'red' : account.account_type === 'BANK' ? 'green' : 'purple'}>
                            {account.account_type}
                          </Badge>
                          <Badge tone={account.status === 'ACTIVE' ? 'green' : 'amber'}>{account.status}</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Saldo</div>
                      <div className="mt-1 text-sm font-black text-slate-900">{formatMoney(account.current_balance)}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-bold">
                    <div className="text-slate-400">Bank</div>
                    <div className="text-right text-slate-700">{account.bank_name || '-'}</div>

                    <div className="text-slate-400">No. Rek</div>
                    <div className="text-right text-slate-700">{account.account_number || '-'}</div>

                    <div className="text-slate-400">Cabang</div>
                    <div className="text-right text-slate-700">{branchNameById.get(account.branch_id) || account.branch_id || '-'}</div>
                  </div>
                </div>
              ))}

              {accountRecords.length === 0 && (
                <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm font-bold text-amber-800 md:col-span-2 xl:col-span-3">
                  Master Account Kas & Bank belum tersedia. Tambahkan data account resmi agar transaksi kas/bank bisa diposting.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
