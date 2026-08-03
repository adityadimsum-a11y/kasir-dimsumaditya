import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Banknote,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  DollarSign,
  Eye,
  FileText,
  Filter,
  Landmark,
  Layers,
  LockKeyhole,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';

import erpOrchestrator from '../../utils/erpOrchestrator';

const EMPTY_OBJECT = Object.freeze({});

const PERIOD_OPTIONS = [
  'TODAY',
  'THIS_WEEK',
  'THIS_MONTH',
  'THIS_YEAR',
  'ALL',
];

const DEFAULT_SUMMARY = {
  cashIn: 0,
  totalCashIn: 0,
  cashOut: 0,
  totalCashOut: 0,
  netCashflow: 0,
  currentCashPosition: 0,
  cashPosition: 0,
  operatingCashflow: 0,
  investingCashflow: 0,
  financingCashflow: 0,
  cashBalance: 0,
  bankBalance: 0,
  totalTransactions: 0,
  status: '',
  cashPositionStatus: '',
};

const DEFAULT_RESULT = {
  summary: DEFAULT_SUMMARY,
  records: [],
  branchCashflow: [],
  branchCashflowRows: [],
  trends: [],
  trendSummary: {},
  cashTrendSummary: {},
  riskCards: [],
  warningCards: [],
  accountBalances: [],
  filters: {},
  metadata: {},
  warnings: [],
};

const normalizeCode = (value) => {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^\w./-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const safeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.records)) return value.records;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

const safeObject = (value) => {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === undefined || value === null || value === '') return 0;

  const parsed = Number(
    String(value)
      .trim()
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.'),
  );

  return Number.isFinite(parsed) ? parsed : 0;
};

const safeNumber = (value, fallback = 0) => {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value) => {
  return Math.round(safeNumber(value, 0));
};

const formatMoney = (value) => {
  return `Rp${roundMoney(value).toLocaleString('id-ID')}`;
};

const formatNumber = (value) => {
  return Math.round(safeNumber(value, 0)).toLocaleString('id-ID');
};

const formatDateTime = (value) => {
  if (!value) return '-';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateLabel = (value) => {
  if (!value) return '-';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const stringifyJson = (value) => {
  if (value === undefined || value === null || value === '') return '{}';

  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch (error) {
      return value;
    }
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
};

const getTodayDate = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
};

const toIsoDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toISOString().substring(0, 10);
};

const resolvePeriodRange = (periodValue) => {
  const period = normalizeCode(periodValue || 'THIS_MONTH');
  const today = getTodayDate();

  if (period === 'ALL') {
    return {
      startDate: '',
      endDate: '',
      granularity: 'MONTHLY',
    };
  }

  if (period === 'TODAY') {
    return {
      startDate: toIsoDate(today),
      endDate: toIsoDate(today),
      granularity: 'DAILY',
    };
  }

  if (period === 'THIS_WEEK') {
    const day = today.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = new Date(today);
    start.setDate(today.getDate() + mondayOffset);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return {
      startDate: toIsoDate(start),
      endDate: toIsoDate(end),
      granularity: 'DAILY',
    };
  }

  if (period === 'THIS_YEAR') {
    const start = new Date(today.getFullYear(), 0, 1);
    const end = new Date(today.getFullYear(), 11, 31);

    return {
      startDate: toIsoDate(start),
      endDate: toIsoDate(end),
      granularity: 'MONTHLY',
    };
  }

  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    granularity: 'DAILY',
  };
};

const isOwnerRole = (user = {}) => {
  const role = normalizeCode(
    user.role ||
    user.user_role ||
    user.userRole ||
    user.access_role ||
    user.accessRole ||
    user.position ||
    user.level ||
    '',
  );

  return ['OWNER', 'DEWA', 'MONITOR_DEWA', 'HO_TANGERANG'].includes(role);
};

const getUserLabel = (user = {}) => {
  return (
    user.name ||
    user.full_name ||
    user.fullName ||
    user.username ||
    user.email ||
    user.id ||
    'OWNER'
  );
};

const mergeCashflowDefaults = (result) => {
  const source = safeObject(result);

  return {
    ...DEFAULT_RESULT,
    ...source,
    summary: {
      ...DEFAULT_SUMMARY,
      ...safeObject(source.summary),
    },
    records: safeArray(source.records),
    branchCashflow: safeArray(source.branchCashflow || source.branch_cashflow),
    branchCashflowRows: safeArray(source.branchCashflowRows || source.branch_cashflow_rows),
    trends: safeArray(source.trends || source.cashflowTrends || source.cashflow_trends),
    trendSummary: safeObject(source.trendSummary || source.trend_summary),
    cashTrendSummary: safeObject(source.cashTrendSummary || source.cash_trend_summary),
    riskCards: safeArray(source.riskCards || source.risk_cards),
    warningCards: safeArray(source.warningCards || source.warning_cards),
    accountBalances: safeArray(source.accountBalances || source.account_balances),
    filters: safeObject(source.filters),
    metadata: safeObject(source.metadata),
    warnings: safeArray(source.warnings),
  };
};

const getSummaryValue = (summary = {}, keys = []) => {
  for (const key of keys) {
    if (summary[key] !== undefined && summary[key] !== null && summary[key] !== '') {
      return summary[key];
    }
  }

  return 0;
};

const normalizeCashPositionStatus = (value, cashPosition) => {
  const status = normalizeCode(value || '');

  if (['HEALTHY', 'GOOD', 'SAFE', 'AMAN'].includes(status)) return 'HEALTHY';
  if (['WARNING', 'WARN', 'WASPADA'].includes(status)) return 'WARNING';
  if (['CRITICAL', 'DANGER', 'BAHAYA', 'KRITIS'].includes(status)) return 'CRITICAL';

  if (safeNumber(cashPosition, 0) < 0) return 'CRITICAL';
  if (safeNumber(cashPosition, 0) === 0) return 'WARNING';

  return 'HEALTHY';
};

const getStatusTone = (status) => {
  const normalized = normalizeCashPositionStatus(status, 0);

  const toneMap = {
    HEALTHY: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    WARNING: 'border-amber-200 bg-amber-50 text-amber-700',
    CRITICAL: 'border-red-200 bg-red-50 text-red-700',
  };

  return toneMap[normalized] || 'border-slate-200 bg-slate-50 text-slate-600';
};

const getSeverityTone = (severity) => {
  const normalized = normalizeCode(severity);

  const toneMap = {
    CRITICAL: 'border-red-200 bg-red-50 text-red-700',
    HIGH: 'border-orange-200 bg-orange-50 text-orange-700',
    MEDIUM: 'border-amber-200 bg-amber-50 text-amber-700',
    WARNING: 'border-amber-200 bg-amber-50 text-amber-700',
    LOW: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    INFO: 'border-blue-200 bg-blue-50 text-blue-700',
  };

  return toneMap[normalized] || 'border-slate-200 bg-slate-50 text-slate-600';
};

const getBranchCashflowRows = (result) => {
  const branchRows = [
    ...safeArray(result.branchCashflow),
    ...safeArray(result.branchCashflowRows),
    ...safeArray(result.branch_cashflow),
    ...safeArray(result.branch_cashflow_rows),
    ...safeArray(result.branchAnalytics?.cashflow),
    ...safeArray(result.branchAnalytics?.records),
  ];

  return branchRows.map((row, index) => ({
    id: row.id || row.branch_id || row.branchId || row.branch || `BRANCH-CASHFLOW-${index + 1}`,
    branch: row.branch || row.branch_name || row.branchName || row.branch_id || row.branchId || '-',
    cashIn: row.cashIn ?? row.cash_in ?? row.totalCashIn ?? row.total_cash_in ?? 0,
    cashOut: row.cashOut ?? row.cash_out ?? row.totalCashOut ?? row.total_cash_out ?? 0,
    netCashflow: row.netCashflow ?? row.net_cashflow ?? row.net_movement ?? 0,
    metadata: safeObject(row.metadata || row.meta || row),
  }));
};

const getTrendRows = (result) => {
  return safeArray(result.trends).map((row, index) => ({
    id: row.id || row.period || row.date || `TREND-${index + 1}`,
    period: row.period || row.date || row.label || '-',
    cashIn: row.cashIn ?? row.cash_in ?? 0,
    cashOut: row.cashOut ?? row.cash_out ?? 0,
    netCashflow: row.netCashflow ?? row.net_cashflow ?? 0,
    direction: row.direction || row.trend || '',
    metadata: safeObject(row.metadata || row.meta || row),
  }));
};

const getWarningRows = (result) => {
  const rows = [
    ...safeArray(result.warningCards),
    ...safeArray(result.riskCards),
    ...safeArray(result.warnings),
  ];

  return rows.map((row, index) => ({
    id: row.id || row.code || `CASHFLOW-WARNING-${index + 1}`,
    severity: row.severity || row.priority || row.level || 'INFO',
    title: row.title || row.message || row.code || 'Cashflow Warning',
    message: row.message || row.description || row.notes || '',
    amount: row.amount || row.value || 0,
    actionHint: row.action_hint || row.actionHint || row.recommendation || '',
    metadata: safeObject(row.metadata || row.meta || row),
  }));
};

const StatusBadge = ({ status, cashPosition }) => {
  const normalized = normalizeCashPositionStatus(status, cashPosition);

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getStatusTone(normalized)}`}>
      {normalized}
    </span>
  );
};

const SeverityBadge = ({ severity }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getSeverityTone(severity)}`}>
    {normalizeCode(severity || 'INFO')}
  </span>
);

const KpiCard = ({ title, value, icon, tone = 'white' }) => {
  const toneMap = {
    red: 'bg-red-600 text-white',
    dark: 'bg-slate-950 text-white',
    orange: 'border border-orange-100 bg-orange-50 text-orange-900',
    amber: 'border border-amber-100 bg-amber-50 text-amber-900',
    green: 'border border-emerald-100 bg-emerald-50 text-emerald-900',
    blue: 'border border-blue-100 bg-blue-50 text-blue-900',
    white: 'border border-slate-100 bg-white text-slate-900',
  };

  return (
    <div className={`rounded-2xl p-5 shadow-sm ${toneMap[tone] || toneMap.white}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">
            {title}
          </div>
          <div className="mt-2 text-xl font-black">
            {formatMoney(value)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/80 p-3 text-red-600 shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className="space-y-4">
    <div className="animate-pulse rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="h-5 w-1/3 rounded-full bg-slate-100" />
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="h-24 rounded-2xl bg-slate-100" />
        <div className="h-24 rounded-2xl bg-slate-100" />
        <div className="h-24 rounded-2xl bg-slate-100" />
      </div>
    </div>

    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
        >
          <div className="h-4 w-1/4 rounded-full bg-slate-100" />
          <div className="mt-4 h-3 w-2/3 rounded-full bg-slate-100" />
          <div className="mt-2 h-3 w-1/2 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  </div>
);

const AccessDenied = () => (
  <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center shadow-sm">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-red-600 shadow-sm">
      <LockKeyhole size={28} />
    </div>
    <h2 className="mt-4 text-2xl font-black text-red-900">
      ACCESS DENIED
    </h2>
    <p className="mx-auto mt-2 max-w-xl text-sm font-bold leading-relaxed text-red-700">
      Cashflow Dashboard hanya bisa diakses oleh OWNER atau DEWA.
    </p>
  </div>
);

const EmptyState = () => (
  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-8 text-center shadow-sm">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
      <Wallet size={24} />
    </div>
    <div className="mt-4 text-lg font-black text-amber-900">
      Tidak ada data cashflow.
    </div>
    <p className="mx-auto mt-2 max-w-xl text-sm font-bold leading-relaxed text-amber-700">
      Tidak ada record cashflow dari orchestrator untuk filter yang sedang aktif.
    </p>
  </div>
);

const ErrorState = ({ message }) => (
  <div className="rounded-2xl border border-red-100 bg-red-50 p-6 shadow-sm">
    <div className="flex items-start gap-4">
      <div className="rounded-2xl bg-white p-3 text-red-600 shadow-sm">
        <AlertTriangle size={22} />
      </div>
      <div>
        <div className="text-sm font-black text-red-900">
          Gagal memuat Cashflow Dashboard.
        </div>
        <p className="mt-1 text-sm font-bold leading-relaxed text-red-700">
          {message || 'Terjadi kesalahan saat membaca erpOrchestrator.getCashflowDashboard().'}
        </p>
      </div>
    </div>
  </div>
);

const DetailModal = ({ item, onClose }) => {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <FileText size={18} className="text-red-600" />
              Cashflow Detail
            </div>
            <p className="mt-1 text-xs font-bold text-slate-400">
              Detail cashflow dari ERP Intelligence. Read only.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
            aria-label="Close cashflow detail"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {item.type || 'CASHFLOW'}
              </span>
              <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {item.module || item.branch || item.period || 'ERP'}
              </span>
            </div>

            <h2 className="mt-4 text-xl font-black text-slate-950">
              {item.title || item.label || item.branch || item.period || 'Cashflow Item'}
            </h2>

            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
              {item.description || item.message || 'Detail data cashflow dari orchestrator.'}
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-950 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-800 p-4 text-sm font-black text-white">
              <FileText size={16} className="text-amber-300" />
              Raw JSON
            </div>
            <pre className="max-h-[520px] overflow-auto p-4 text-xs font-semibold leading-relaxed text-slate-200">
              {stringifyJson(item.raw || item.metadata || item)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

const CashPositionCard = ({ summary, onClick }) => {
  const cashPosition = getSummaryValue(summary, [
    'currentCashPosition',
    'cashPosition',
    'cash_position',
  ]);

  const cashBalance = getSummaryValue(summary, [
    'cashBalance',
    'cash_balance',
  ]);

  const bankBalance = getSummaryValue(summary, [
    'bankBalance',
    'bank_balance',
  ]);

  const status = normalizeCashPositionStatus(
    summary.cashPositionStatus || summary.cash_position_status || summary.status,
    cashPosition,
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl bg-slate-950 p-6 text-left text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-black">
            <Landmark size={18} className="text-amber-300" />
            Cash Position Card
          </div>
          <p className="mt-1 text-sm font-medium text-slate-300">
            Saldo kas dan posisi cash berasal dari result.summary orchestrator.
          </p>

          <div className="mt-6 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            Current Cash Position
          </div>
          <div className="mt-2 text-4xl font-black tracking-tight">
            {formatMoney(cashPosition)}
          </div>
        </div>

        <div className="grid min-w-[260px] grid-cols-1 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Status
            </div>
            <div className="mt-2">
              <StatusBadge status={status} cashPosition={cashPosition} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Cash Balance
            </div>
            <div className="mt-1 text-lg font-black text-white">
              {formatMoney(cashBalance)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Bank Balance
            </div>
            <div className="mt-1 text-lg font-black text-white">
              {formatMoney(bankBalance)}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};

const BreakdownCard = ({ title, value, icon, tone = 'white', onClick }) => {
  const toneMap = {
    green: 'border-emerald-100 bg-emerald-50 text-emerald-900',
    red: 'border-red-100 bg-red-50 text-red-900',
    blue: 'border-blue-100 bg-blue-50 text-blue-900',
    white: 'border-slate-100 bg-white text-slate-900',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${toneMap[tone] || toneMap.white}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">
            {title}
          </div>
          <div className="mt-2 text-2xl font-black">
            {formatMoney(value)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/80 p-3 text-red-600 shadow-sm">
          {icon}
        </div>
      </div>
    </button>
  );
};

const BranchCashflowTable = ({ rows, onSelect }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
      <div>
        <div className="flex items-center gap-2 text-sm font-black text-slate-900">
          <Building2 size={17} className="text-red-600" />
          Branch Cashflow
        </div>
        <p className="mt-1 text-[11px] font-semibold text-slate-400">
          Data cabang hanya ditampilkan jika tersedia dari orchestrator.
        </p>
      </div>

      <span className="rounded-full border border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {formatNumber(rows.length)} branch
      </span>
    </div>

    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Cabang
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Cash In
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Cash Out
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Net Cashflow
            </th>
            <th className="px-5 py-4 text-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Detail
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-8 text-center text-sm font-bold text-slate-400">
                Branch cashflow belum tersedia dari orchestrator.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-5 py-4 text-sm font-black text-slate-900">
                  {row.branch}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-emerald-700">
                  {formatMoney(row.cashIn)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-red-700">
                  {formatMoney(row.cashOut)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-black text-slate-900">
                  {formatMoney(row.netCashflow)}
                </td>
                <td className="px-5 py-4 text-center">
                  <button
                    type="button"
                    onClick={() => onSelect({
                      ...row,
                      type: 'BRANCH_CASHFLOW',
                      title: row.branch,
                      raw: row.metadata,
                    })}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
                    aria-label={`Detail cashflow ${row.branch}`}
                  >
                    <Eye size={15} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const TrendPanel = ({ trends, trendSummary, onSelect }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
      <div>
        <div className="flex items-center gap-2 text-sm font-black text-slate-900">
          <BarChart3 size={17} className="text-red-600" />
          Trend Panel
        </div>
        <p className="mt-1 text-[11px] font-semibold text-slate-400">
          Trend harian / bulanan berasal dari orchestrator.
        </p>
      </div>

      <span className="rounded-full border border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {formatNumber(trends.length)} trend
      </span>
    </div>

    <div className="p-5">
      <div className="mb-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
          Cash Trend Summary
        </div>
        <div className="mt-2 text-sm font-bold leading-relaxed text-slate-700">
          {trendSummary.title || trendSummary.message || trendSummary.summary || 'Cash trend summary belum tersedia dari orchestrator.'}
        </div>
      </div>

      {trends.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm font-bold leading-relaxed text-amber-700">
          Trend cashflow belum tersedia dari orchestrator.
        </div>
      ) : (
        <div className="space-y-3">
          {trends.map((trend) => (
            <button
              key={trend.id}
              type="button"
              onClick={() => onSelect({
                ...trend,
                type: 'CASHFLOW_TREND',
                title: `Trend ${trend.period}`,
                raw: trend.metadata,
              })}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition-all hover:border-red-100 hover:bg-red-50"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Period
                  </div>
                  <div className="mt-1 text-sm font-black text-slate-900">
                    {formatDateLabel(trend.period)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-right">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      In
                    </div>
                    <div className="mt-1 text-sm font-black text-emerald-700">
                      {formatMoney(trend.cashIn)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      Out
                    </div>
                    <div className="mt-1 text-sm font-black text-red-700">
                      {formatMoney(trend.cashOut)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      Net
                    </div>
                    <div className="mt-1 text-sm font-black text-slate-900">
                      {formatMoney(trend.netCashflow)}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);

const WarningPanel = ({ warnings, onSelect }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
        <AlertTriangle size={17} className="text-red-600" />
        Warning Panel
      </div>
      <p className="mt-1 text-[11px] font-semibold text-slate-400">
        Warning berasal dari orchestrator.
      </p>
    </div>

    <div className="max-h-[680px] space-y-3 overflow-y-auto p-5">
      {warnings.length === 0 ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold leading-relaxed text-emerald-700">
          Tidak ada warning cashflow dari orchestrator.
        </div>
      ) : (
        warnings.map((warning) => (
          <button
            key={warning.id}
            type="button"
            onClick={() => onSelect({
              ...warning,
              type: 'CASHFLOW_WARNING',
              raw: warning.metadata,
            })}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition-all hover:border-red-100 hover:bg-red-50"
          >
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={warning.severity} />
              {safeNumber(warning.amount, 0) !== 0 && (
                <span className="rounded-full border border-slate-100 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  {formatMoney(warning.amount)}
                </span>
              )}
            </div>

            <div className="mt-3 text-sm font-black text-slate-900">
              {warning.title}
            </div>

            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
              {warning.message || warning.actionHint || '-'}
            </p>

            {warning.actionHint && (
              <div className="mt-3 rounded-2xl border border-slate-100 bg-white p-3 text-xs font-bold leading-relaxed text-slate-600">
                {warning.actionHint}
              </div>
            )}
          </button>
        ))
      )}
    </div>
  </div>
);

function TabCashflowDashboard(props = {}) {
  const {
    dbData,
    source,
    user,
    currentUser,
    session,
  } = props;

  const activeUser = user || currentUser || session?.user || EMPTY_OBJECT;
  const sourceData = source || dbData || EMPTY_OBJECT;
  const ownerAllowed = isOwnerRole(activeUser);

  const [filters, setFilters] = useState({
    branch: '',
    period: 'THIS_MONTH',
    search: '',
  });

  const [appliedFilters, setAppliedFilters] = useState({
    branch: '',
    period: 'THIS_MONTH',
    search: '',
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedItem, setSelectedItem] = useState(null);
  const [cashflowState, setCashflowState] = useState({
    loading: true,
    error: '',
    result: DEFAULT_RESULT,
  });

  const periodRange = useMemo(() => {
    return resolvePeriodRange(appliedFilters.period);
  }, [appliedFilters.period]);

  const requestInput = useMemo(() => ({
    branch: appliedFilters.branch,
    period: appliedFilters.period,
    search: appliedFilters.search,
    startDate: periodRange.startDate,
    endDate: periodRange.endDate,
    granularity: periodRange.granularity,
  }), [
    appliedFilters.branch,
    appliedFilters.period,
    appliedFilters.search,
    periodRange.endDate,
    periodRange.granularity,
    periodRange.startDate,
  ]);

  useEffect(() => {
    if (!ownerAllowed) {
      setCashflowState({
        loading: false,
        error: '',
        result: DEFAULT_RESULT,
      });
      return;
    }

    if (typeof erpOrchestrator?.getCashflowDashboard !== 'function') {
      setCashflowState({
        loading: false,
        error: 'erpOrchestrator.getCashflowDashboard() belum tersedia.',
        result: DEFAULT_RESULT,
      });
      return;
    }

    let isMounted = true;

    setCashflowState((prev) => ({
      ...prev,
      loading: true,
      error: '',
    }));

    Promise.resolve()
      .then(() => {
        return erpOrchestrator.getCashflowDashboard(
          requestInput,
          {
            source: sourceData,
            dbData: sourceData,
            readonly: true,
            user: activeUser,
            executor: getUserLabel(activeUser),
          },
        );
      })
      .then((result) => {
        if (!isMounted) return;

        setCashflowState({
          loading: false,
          error: '',
          result: mergeCashflowDefaults(result),
        });
      })
      .catch((error) => {
        if (!isMounted) return;

        setCashflowState({
          loading: false,
          error: error?.message || 'Gagal memuat Cashflow Dashboard.',
          result: DEFAULT_RESULT,
        });
      });

    return () => {
      isMounted = false;
    };
  }, [
    activeUser,
    ownerAllowed,
    refreshKey,
    requestInput,
    sourceData,
  ]);

  const result = mergeCashflowDefaults(cashflowState.result);
  const summary = result.summary;
  const records = result.records;
  const branchRows = getBranchCashflowRows(result);
  const trends = getTrendRows(result);
  const warnings = getWarningRows(result);
  const trendSummary = {
    ...result.trendSummary,
    ...result.cashTrendSummary,
  };

  const totalCashIn = getSummaryValue(summary, ['totalCashIn', 'cashIn', 'cash_in']);
  const totalCashOut = getSummaryValue(summary, ['totalCashOut', 'cashOut', 'cash_out']);
  const netCashflow = getSummaryValue(summary, ['netCashflow', 'net_cashflow']);
  const currentCashPosition = getSummaryValue(summary, ['currentCashPosition', 'cashPosition', 'cash_position']);
  const operatingCashflow = getSummaryValue(summary, ['operatingCashflow', 'operating_cashflow']);
  const investingCashflow = getSummaryValue(summary, ['investingCashflow', 'investing_cashflow']);
  const financingCashflow = getSummaryValue(summary, ['financingCashflow', 'financing_cashflow']);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleApplyFilter = () => {
    setAppliedFilters(filters);
  };

  const handleReset = () => {
    const resetFilters = {
      branch: '',
      period: 'THIS_MONTH',
      search: '',
    };

    setFilters(resetFilters);
    setAppliedFilters(resetFilters);
  };

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (!ownerAllowed) {
    return (
      <div className="space-y-6 pb-10 text-slate-700 normal-case">
        <AccessDenied />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      <div className="relative overflow-hidden rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-red-600/30 blur-2xl" />
        <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-amber-400/20 blur-2xl" />

        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="rounded-2xl bg-red-600 p-2 shadow-sm">
                <Wallet size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                ERP Cash Intelligence Layer
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              CASHFLOW DASHBOARD
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Enterprise Cashflow Dashboard untuk Owner. Semua analytics berasal dari erpOrchestrator.getCashflowDashboard().
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white">
              OWNER ONLY
            </span>
            <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">
              READ ONLY
            </span>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
              THIN UI
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
        <KpiCard title="Total Cash In" value={totalCashIn} icon={<TrendingUp size={18} />} tone="green" />
        <KpiCard title="Total Cash Out" value={totalCashOut} icon={<TrendingDown size={18} />} tone="orange" />
        <KpiCard title="Net Cashflow" value={netCashflow} icon={<Activity size={18} />} tone="blue" />
        <KpiCard title="Current Cash Position" value={currentCashPosition} icon={<DollarSign size={18} />} tone="red" />
        <KpiCard title="Operating Cashflow" value={operatingCashflow} icon={<Banknote size={18} />} />
        <KpiCard title="Investing Cashflow" value={investingCashflow} icon={<Landmark size={18} />} />
        <KpiCard title="Financing Cashflow" value={financingCashflow} icon={<Wallet size={18} />} />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <Filter size={17} className="text-red-600" />
              Filter Cashflow
            </div>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">
              Filter dikirim ke orchestrator. UI tidak menghitung cashflow sendiri.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 transition-all hover:bg-amber-100"
          >
            <RefreshCw size={14} />
            REFRESH
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              <Building2 size={12} />
              Branch
            </span>
            <input
              type="text"
              value={filters.branch}
              onChange={(event) => handleFilterChange('branch', event.target.value)}
              placeholder="Cabang"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
            />
          </label>

          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              <CalendarDays size={12} />
              Period
            </span>
            <select
              value={filters.period}
              onChange={(event) => handleFilterChange('period', event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
            >
              {PERIOD_OPTIONS.map((period) => (
                <option key={period} value={period}>
                  {period}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              <Search size={12} />
              Search
            </span>
            <input
              type="text"
              value={filters.search}
              onChange={(event) => handleFilterChange('search', event.target.value)}
              placeholder="Cari cashflow"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleApplyFilter}
            className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-sm transition-all hover:bg-red-700"
          >
            <Filter size={14} />
            FILTER
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 transition-all hover:bg-slate-50"
          >
            <X size={14} />
            RESET
          </button>
        </div>
      </div>

      {cashflowState.error && (
        <ErrorState message={cashflowState.error} />
      )}

      {cashflowState.loading ? (
        <LoadingSkeleton />
      ) : records.length === 0 && branchRows.length === 0 && trends.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <CashPositionCard
            summary={summary}
            onClick={() => setSelectedItem({
              type: 'CASH_POSITION',
              title: 'Cash Position',
              description: 'Cash position summary dari orchestrator.',
              raw: summary,
            })}
          />

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <Layers size={18} className="text-red-600" />
              Cashflow Breakdown
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <BreakdownCard
                title="Cash In"
                value={totalCashIn}
                icon={<TrendingUp size={18} />}
                tone="green"
                onClick={() => setSelectedItem({
                  type: 'CASHFLOW_BREAKDOWN',
                  title: 'Cash In',
                  raw: summary,
                })}
              />
              <BreakdownCard
                title="Cash Out"
                value={totalCashOut}
                icon={<TrendingDown size={18} />}
                tone="red"
                onClick={() => setSelectedItem({
                  type: 'CASHFLOW_BREAKDOWN',
                  title: 'Cash Out',
                  raw: summary,
                })}
              />
              <BreakdownCard
                title="Net Cashflow"
                value={netCashflow}
                icon={<Activity size={18} />}
                tone="blue"
                onClick={() => setSelectedItem({
                  type: 'CASHFLOW_BREAKDOWN',
                  title: 'Net Cashflow',
                  raw: summary,
                })}
              />
            </div>
          </section>

          <BranchCashflowTable
            rows={branchRows}
            onSelect={setSelectedItem}
          />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <TrendPanel
                trends={trends}
                trendSummary={trendSummary}
                onSelect={setSelectedItem}
              />
            </div>

            <div className="xl:col-span-4">
              <WarningPanel
                warnings={warnings}
                onSelect={setSelectedItem}
              />
            </div>
          </section>
        </>
      )}

      <DetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}

export default TabCashflowDashboard;
