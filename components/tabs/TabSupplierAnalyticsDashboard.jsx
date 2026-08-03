import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  Clock3,
  Crown,
  DollarSign,
  Eye,
  FileText,
  Filter,
  Gauge,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingDown,
  Truck,
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
];

const DEFAULT_SUMMARY = {
  totalSupplier: 0,
  totalSuppliers: 0,
  supplierCount: 0,
  activeSupplier: 0,
  activeSuppliers: 0,
  activeSupplierCount: 0,
  totalPurchaseValue: 0,
  supplierPurchaseValue: 0,
  totalSupplierPurchase: 0,
  totalHutangSupplier: 0,
  supplierPayable: 0,
  totalSupplierPayable: 0,
};

const DEFAULT_SUPPLIER_ANALYTICS = {
  supplierRanking: [],
  topSuppliers: [],
  topSupplierPurchase: [],
  riskSuppliers: [],
  highRiskSuppliers: [],
  problemSuppliers: [],
  delayedSuppliers: [],
  unstableSuppliers: [],
  inactiveSuppliers: [],
  supplierComparisonAnalytics: [],
  supplierComparison: [],
  warningCards: [],
  bestSupplier: null,
  riskSupplier: null,
};

const DEFAULT_RESULT = {
  summary: DEFAULT_SUMMARY,
  supplierAnalytics: DEFAULT_SUPPLIER_ANALYTICS,
  warningCards: [],
  warnings: [],
  metadata: {},
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

const formatPercent = (value) => {
  const number = safeNumber(value, 0);
  return `${Math.round(number * 100) / 100}%`;
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

const mergeOwnerAnalyticsDefaults = (result) => {
  const source = safeObject(result);
  const supplierAnalytics = safeObject(source.supplierAnalytics);

  return {
    ...DEFAULT_RESULT,
    ...source,
    summary: {
      ...DEFAULT_SUMMARY,
      ...safeObject(source.summary),
    },
    supplierAnalytics: {
      ...DEFAULT_SUPPLIER_ANALYTICS,
      ...supplierAnalytics,
      supplierRanking: safeArray(supplierAnalytics.supplierRanking || supplierAnalytics.supplier_ranking || supplierAnalytics.ranking),
      topSuppliers: safeArray(supplierAnalytics.topSuppliers || supplierAnalytics.top_suppliers),
      topSupplierPurchase: safeArray(supplierAnalytics.topSupplierPurchase || supplierAnalytics.top_supplier_purchase),
      riskSuppliers: safeArray(supplierAnalytics.riskSuppliers || supplierAnalytics.risk_suppliers),
      highRiskSuppliers: safeArray(supplierAnalytics.highRiskSuppliers || supplierAnalytics.high_risk_suppliers),
      problemSuppliers: safeArray(supplierAnalytics.problemSuppliers || supplierAnalytics.problem_suppliers),
      delayedSuppliers: safeArray(supplierAnalytics.delayedSuppliers || supplierAnalytics.delayed_suppliers),
      unstableSuppliers: safeArray(supplierAnalytics.unstableSuppliers || supplierAnalytics.unstable_suppliers),
      inactiveSuppliers: safeArray(supplierAnalytics.inactiveSuppliers || supplierAnalytics.inactive_suppliers),
      supplierComparisonAnalytics: safeArray(supplierAnalytics.supplierComparisonAnalytics || supplierAnalytics.supplier_comparison_analytics),
      supplierComparison: safeArray(supplierAnalytics.supplierComparison || supplierAnalytics.supplier_comparison),
      warningCards: safeArray(supplierAnalytics.warningCards || supplierAnalytics.warning_cards),
      bestSupplier: supplierAnalytics.bestSupplier || supplierAnalytics.best_supplier || null,
      riskSupplier: supplierAnalytics.riskSupplier || supplierAnalytics.risk_supplier || null,
    },
    warningCards: safeArray(source.warningCards),
    warnings: safeArray(source.warnings),
    metadata: safeObject(source.metadata),
  };
};

const getSummaryValue = (summary = {}, supplierAnalytics = {}, keys = []) => {
  for (const key of keys) {
    if (summary[key] !== undefined && summary[key] !== null && summary[key] !== '') {
      return summary[key];
    }

    if (supplierAnalytics[key] !== undefined && supplierAnalytics[key] !== null && supplierAnalytics[key] !== '') {
      return supplierAnalytics[key];
    }
  }

  return 0;
};

const normalizeSupplierRow = (row = {}, index = 0) => {
  const supplierId = String(row.supplier_id || row.supplierId || row.id || row.supplier || '').trim();
  const supplierName = String(
    row.supplier_name ||
    row.supplierName ||
    row.name ||
    row.supplier ||
    row.label ||
    supplierId ||
    `Supplier ${index + 1}`,
  ).trim();

  return {
    id: supplierId || `SUPPLIER-${index + 1}`,
    rank: row.rank || row.ranking || index + 1,
    supplier_id: supplierId,
    supplier_name: supplierName,
    totalPurchase: row.totalPurchase ?? row.total_purchase ?? row.purchaseValue ?? row.purchase_value ?? row.totalPurchaseValue ?? row.total_purchase_value ?? 0,
    totalHutang: row.totalHutang ?? row.total_hutang ?? row.payable ?? row.totalPayable ?? row.total_payable ?? row.supplierPayable ?? row.supplier_payable ?? 0,
    totalTransaction: row.totalTransaction ?? row.total_transaction ?? row.transactionCount ?? row.transaction_count ?? row.purchaseCount ?? row.purchase_count ?? 0,
    lastTransactionDate: row.lastTransactionDate || row.last_transaction_date || row.lastPurchaseDate || row.last_purchase_date || '',
    performanceScore: row.performanceScore ?? row.performance_score ?? row.score ?? row.supplierScore ?? row.supplier_score ?? 0,
    qualityScore: row.qualityScore ?? row.quality_score ?? 0,
    stabilityScore: row.stabilityScore ?? row.stability_score ?? 0,
    delayCount: row.delayCount ?? row.delay_count ?? row.lateDeliveryCount ?? row.late_delivery_count ?? 0,
    inactiveDays: row.inactiveDays ?? row.inactive_days ?? row.daysInactive ?? row.days_inactive ?? 0,
    status: row.status || row.supplierStatus || row.supplier_status || row.riskStatus || row.risk_status || '',
    metadata: safeObject(row.metadata || row.meta || row),
    raw: row,
  };
};

const normalizeNamedSupplier = (value) => {
  if (!value) return '-';
  if (typeof value === 'string') return value;

  const row = normalizeSupplierRow(value);
  return row.supplier_name || '-';
};

const getSupplierRankingRows = (supplierAnalytics = {}) => {
  const explicitRows = safeArray(
    supplierAnalytics.supplierRanking ||
    supplierAnalytics.supplier_ranking ||
    supplierAnalytics.ranking ||
    supplierAnalytics.rankings,
  );

  const sourceRows = explicitRows.length > 0
    ? explicitRows
    : safeArray(supplierAnalytics.topSuppliers);

  return sourceRows.map((row, index) => normalizeSupplierRow(row, index));
};

const getTopSupplierRows = (supplierAnalytics = {}) => {
  const sourceRows = [
    ...safeArray(supplierAnalytics.topSuppliers),
    ...safeArray(supplierAnalytics.topSupplierPurchase),
  ];

  const finalRows = sourceRows.length > 0
    ? sourceRows
    : safeArray(supplierAnalytics.supplierRanking);

  return finalRows.slice(0, 10).map((row, index) => normalizeSupplierRow(row, index));
};

const getRiskSupplierRows = (supplierAnalytics = {}) => {
  const sourceRows = [
    ...safeArray(supplierAnalytics.riskSuppliers),
    ...safeArray(supplierAnalytics.highRiskSuppliers),
    ...safeArray(supplierAnalytics.problemSuppliers),
    ...safeArray(supplierAnalytics.delayedSuppliers),
    ...safeArray(supplierAnalytics.unstableSuppliers),
  ];

  return sourceRows.map((row, index) => normalizeSupplierRow(row, index));
};

const getInactiveSupplierRows = (supplierAnalytics = {}) => {
  return safeArray(supplierAnalytics.inactiveSuppliers)
    .map((row, index) => normalizeSupplierRow(row, index));
};

const getComparisonRows = (supplierAnalytics = {}) => {
  const explicitRows = [
    ...safeArray(supplierAnalytics.supplierComparisonAnalytics),
    ...safeArray(supplierAnalytics.supplierComparison),
  ];

  const finalRows = explicitRows.length > 0
    ? explicitRows
    : safeArray(supplierAnalytics.supplierRanking);

  return finalRows.map((row, index) => normalizeSupplierRow(row, index));
};

const getWarningRows = (result = {}) => {
  const rows = [
    ...safeArray(result.warningCards),
    ...safeArray(result.warnings),
    ...safeArray(result.supplierAnalytics?.warningCards),
    ...safeArray(result.supplierAnalytics?.highRiskSuppliers),
  ];

  return rows.map((row, index) => ({
    id: row.id || row.code || row.supplier_id || row.supplierId || `SUPPLIER-WARNING-${index + 1}`,
    severity: row.severity || row.priority || row.level || row.riskStatus || 'INFO',
    title: row.title || row.supplier_name || row.supplierName || row.message || row.code || 'Supplier Warning',
    message: row.message || row.description || row.notes || '',
    actionHint: row.action_hint || row.actionHint || row.recommendation || '',
    amount: row.amount || row.value || row.totalHutang || row.total_hutang || row.payable || 0,
    metadata: safeObject(row.metadata || row.meta || row),
    raw: row,
  }));
};

const getSeverityTone = (severity) => {
  const normalized = normalizeCode(severity || 'INFO');

  const toneMap = {
    CRITICAL: 'border-red-200 bg-red-50 text-red-700',
    HIGH: 'border-orange-200 bg-orange-50 text-orange-700',
    WARNING: 'border-amber-200 bg-amber-50 text-amber-700',
    MEDIUM: 'border-amber-200 bg-amber-50 text-amber-700',
    LOW: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    INFO: 'border-blue-200 bg-blue-50 text-blue-700',
    RISK: 'border-red-200 bg-red-50 text-red-700',
  };

  return toneMap[normalized] || 'border-slate-200 bg-slate-50 text-slate-600';
};

const getStatusTone = (status) => {
  const normalized = normalizeCode(status || 'MONITOR');

  const toneMap = {
    ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    GOOD: 'border-blue-200 bg-blue-50 text-blue-700',
    HEALTHY: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    WARNING: 'border-amber-200 bg-amber-50 text-amber-700',
    RISK: 'border-red-200 bg-red-50 text-red-700',
    HIGH_RISK: 'border-red-200 bg-red-50 text-red-700',
    INACTIVE: 'border-red-200 bg-red-50 text-red-700',
    CRITICAL: 'border-red-200 bg-red-50 text-red-700',
  };

  return toneMap[normalized] || 'border-slate-200 bg-slate-50 text-slate-600';
};

const SeverityBadge = ({ severity }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getSeverityTone(severity)}`}>
    {normalizeCode(severity || 'INFO')}
  </span>
);

const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getStatusTone(status)}`}>
    {normalizeCode(status || 'MONITOR')}
  </span>
);

const KpiCard = ({ title, value, icon, tone = 'white', isMoney = false }) => {
  const toneMap = {
    red: 'bg-red-600 text-white',
    dark: 'bg-slate-950 text-white',
    orange: 'border border-orange-100 bg-orange-50 text-orange-900',
    amber: 'border border-amber-100 bg-amber-50 text-amber-900',
    green: 'border border-emerald-100 bg-emerald-50 text-emerald-900',
    blue: 'border border-blue-100 bg-blue-50 text-blue-900',
    white: 'border border-slate-100 bg-white text-slate-900',
  };

  const displayValue = isMoney
    ? formatMoney(value)
    : value || value === 0
      ? String(value)
      : '-';

  return (
    <div className={`rounded-2xl p-5 shadow-sm ${toneMap[tone] || toneMap.white}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">
            {title}
          </div>
          <div className="mt-2 truncate text-xl font-black">
            {displayValue}
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
      Supplier Analytics Dashboard hanya bisa diakses oleh OWNER atau DEWA.
    </p>
  </div>
);

const EmptyState = () => (
  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-8 text-center shadow-sm">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
      <Truck size={24} />
    </div>
    <div className="mt-4 text-lg font-black text-amber-900">
      Tidak ada data supplier analytics.
    </div>
    <p className="mx-auto mt-2 max-w-xl text-sm font-bold leading-relaxed text-amber-700">
      Tidak ada analytics supplier dari orchestrator untuk filter yang sedang aktif.
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
          Gagal memuat Supplier Analytics Dashboard.
        </div>
        <p className="mt-1 text-sm font-bold leading-relaxed text-red-700">
          {message || 'Terjadi kesalahan saat membaca erpOrchestrator.getOwnerAnalytics().'}
        </p>
      </div>
    </div>
  </div>
);

const DetailModal = ({ item, onClose }) => {
  if (!item) return null;

  const metadata = safeObject(item.metadata || item.raw);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <FileText size={18} className="text-red-600" />
              Supplier Analytics Detail
            </div>
            <p className="mt-1 text-xs font-bold text-slate-400">
              Detail analytics supplier dari ERP Owner Analytics. Read only.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
            aria-label="Close supplier detail"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {item.type || 'SUPPLIER_ANALYTICS'}
              </span>
              <StatusBadge status={item.status || 'MONITOR'} />
            </div>

            <h2 className="mt-4 text-xl font-black text-slate-950">
              {item.supplier_name || item.title || 'Supplier Detail'}
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Purchase
                </div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  {formatMoney(item.totalPurchase)}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Hutang
                </div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  {formatMoney(item.totalHutang)}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Transaction
                </div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  {formatNumber(item.totalTransaction)}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Performance
                </div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  {formatPercent(item.performanceScore)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-950 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-800 p-4 text-sm font-black text-white">
              <FileText size={16} className="text-amber-300" />
              Raw Analytics JSON
            </div>
            <pre className="max-h-[520px] overflow-auto p-4 text-xs font-semibold leading-relaxed text-slate-200">
              {stringifyJson(metadata)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

const SupplierRankingTable = ({ rows, onSelect }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
      <div>
        <div className="flex items-center gap-2 text-sm font-black text-slate-900">
          <BarChart3 size={17} className="text-red-600" />
          Supplier Ranking
        </div>
        <p className="mt-1 text-[11px] font-semibold text-slate-400">
          Urutan ranking mengikuti data dari orchestrator.
        </p>
      </div>

      <span className="rounded-full border border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {formatNumber(rows.length)} supplier
      </span>
    </div>

    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Ranking
            </th>
            <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Nama Supplier
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Total Purchase
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Total Hutang
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Total Transaction
            </th>
            <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Last Transaction
            </th>
            <th className="px-5 py-4 text-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Detail
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-5 py-8 text-center text-sm font-bold text-slate-400">
                Supplier ranking belum tersedia dari orchestrator.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={`${row.id}-${row.rank}`} className="hover:bg-slate-50">
                <td className="px-5 py-4 text-sm font-black text-slate-900">
                  #{row.rank}
                </td>
                <td className="px-5 py-4">
                  <div className="text-sm font-black text-slate-900">
                    {row.supplier_name}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-400">
                    {row.supplier_id || '-'}
                  </div>
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-emerald-700">
                  {formatMoney(row.totalPurchase)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-red-700">
                  {formatMoney(row.totalHutang)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-slate-900">
                  {formatNumber(row.totalTransaction)}
                </td>
                <td className="px-5 py-4 text-sm font-bold text-slate-600">
                  {formatDateLabel(row.lastTransactionDate)}
                </td>
                <td className="px-5 py-4 text-center">
                  <button
                    type="button"
                    onClick={() => onSelect({
                      ...row,
                      type: 'SUPPLIER_RANKING',
                    })}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
                    aria-label={`Detail ${row.supplier_name}`}
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

const TopSupplierPanel = ({ rows, onSelect }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
        <Award size={17} className="text-red-600" />
        Top Supplier
      </div>
      <p className="mt-1 text-[11px] font-semibold text-slate-400">
        Top supplier berdasarkan purchase dari orchestrator.
      </p>
    </div>

    <div className="max-h-[680px] space-y-3 overflow-y-auto p-5">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm font-bold leading-relaxed text-amber-700">
          Top supplier belum tersedia.
        </div>
      ) : (
        rows.map((row) => (
          <button
            key={`TOP-${row.id}-${row.rank}`}
            type="button"
            onClick={() => onSelect({
              ...row,
              type: 'TOP_SUPPLIER',
            })}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition-all hover:border-red-100 hover:bg-red-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Crown size={16} className="text-amber-500" />
                  <div className="text-sm font-black text-slate-900">
                    {row.supplier_name}
                  </div>
                </div>
                <div className="mt-2 text-xs font-semibold text-slate-500">
                  Purchase {formatMoney(row.totalPurchase)} · Transaction {formatNumber(row.totalTransaction)}
                </div>
              </div>

              <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                #{row.rank}
              </span>
            </div>
          </button>
        ))
      )}
    </div>
  </div>
);

const RiskSupplierPanel = ({ rows, onSelect }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
        <ShieldAlert size={17} className="text-red-600" />
        Risk Supplier
      </div>
      <p className="mt-1 text-[11px] font-semibold text-slate-400">
        Hutang tinggi, keterlambatan, kualitas buruk, atau supply tidak stabil dari orchestrator.
      </p>
    </div>

    <div className="max-h-[680px] space-y-3 overflow-y-auto p-5">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold leading-relaxed text-emerald-700">
          Tidak ada risk supplier dari orchestrator.
        </div>
      ) : (
        rows.map((row) => (
          <button
            key={`RISK-${row.id}-${row.rank}`}
            type="button"
            onClick={() => onSelect({
              ...row,
              type: 'RISK_SUPPLIER',
            })}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition-all hover:border-red-100 hover:bg-red-50"
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={row.status || 'RISK'} />
              <span className="rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-red-700">
                Hutang {formatMoney(row.totalHutang)}
              </span>
            </div>

            <div className="mt-3 text-sm font-black text-slate-900">
              {row.supplier_name}
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-bold">
              <div className="rounded-xl bg-white p-3 text-slate-600">
                Delay<br />
                <span className="text-slate-950">{formatNumber(row.delayCount)}</span>
              </div>
              <div className="rounded-xl bg-white p-3 text-slate-600">
                Quality<br />
                <span className="text-slate-950">{formatPercent(row.qualityScore)}</span>
              </div>
              <div className="rounded-xl bg-white p-3 text-slate-600">
                Stability<br />
                <span className="text-slate-950">{formatPercent(row.stabilityScore)}</span>
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  </div>
);

const InactiveSupplierPanel = ({ rows, onSelect }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
        <Clock3 size={17} className="text-red-600" />
        Inactive Supplier
      </div>
      <p className="mt-1 text-[11px] font-semibold text-slate-400">
        Supplier yang lama tidak transaksi dari orchestrator.
      </p>
    </div>

    <div className="max-h-[680px] space-y-3 overflow-y-auto p-5">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold leading-relaxed text-emerald-700">
          Tidak ada inactive supplier dari orchestrator.
        </div>
      ) : (
        rows.map((row) => (
          <button
            key={`INACTIVE-${row.id}-${row.rank}`}
            type="button"
            onClick={() => onSelect({
              ...row,
              type: 'INACTIVE_SUPPLIER',
            })}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition-all hover:border-red-100 hover:bg-red-50"
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={row.status || 'INACTIVE'} />
              <span className="rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-red-700">
                {formatNumber(row.inactiveDays)} hari
              </span>
            </div>

            <div className="mt-3 text-sm font-black text-slate-900">
              {row.supplier_name}
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Clock3 size={13} />
              Last transaction {formatDateLabel(row.lastTransactionDate)}
            </div>
          </button>
        ))
      )}
    </div>
  </div>
);

const SupplierComparisonPanel = ({ rows, onSelect }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
      <div>
        <div className="flex items-center gap-2 text-sm font-black text-slate-900">
          <Gauge size={17} className="text-red-600" />
          Supplier Comparison Analytics
        </div>
        <p className="mt-1 text-[11px] font-semibold text-slate-400">
          Purchase Value, Transaction Count, Hutang, dan Performance Score berasal dari orchestrator.
        </p>
      </div>

      <span className="rounded-full border border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {formatNumber(rows.length)} rows
      </span>
    </div>

    <div className="grid grid-cols-1 gap-4 p-5 xl:grid-cols-2">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm font-bold leading-relaxed text-amber-700 xl:col-span-2">
          Supplier comparison analytics belum tersedia dari orchestrator.
        </div>
      ) : (
        rows.map((row) => (
          <button
            key={`COMPARE-${row.id}-${row.rank}`}
            type="button"
            onClick={() => onSelect({
              ...row,
              type: 'SUPPLIER_COMPARISON_ANALYTICS',
            })}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-left transition-all hover:border-red-100 hover:bg-red-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-950">
                  {row.supplier_name}
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-400">
                  Comparison Analytics
                </div>
              </div>

              <StatusBadge status={row.status || 'MONITOR'} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Purchase Value
                </div>
                <div className="mt-1 text-sm font-black text-emerald-700">
                  {formatMoney(row.totalPurchase)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Transaction Count
                </div>
                <div className="mt-1 text-sm font-black text-slate-950">
                  {formatNumber(row.totalTransaction)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Hutang
                </div>
                <div className="mt-1 text-sm font-black text-red-700">
                  {formatMoney(row.totalHutang)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Performance Score
                </div>
                <div className="mt-1 text-sm font-black text-blue-700">
                  {formatPercent(row.performanceScore)}
                </div>
              </div>
            </div>
          </button>
        ))
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
        Warning supplier berasal dari orchestrator.
      </p>
    </div>

    <div className="max-h-[680px] space-y-3 overflow-y-auto p-5">
      {warnings.length === 0 ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold leading-relaxed text-emerald-700">
          Tidak ada warning supplier dari orchestrator.
        </div>
      ) : (
        warnings.map((warning) => (
          <button
            key={warning.id}
            type="button"
            onClick={() => onSelect({
              ...warning,
              supplier_name: warning.title,
              type: 'SUPPLIER_WARNING',
              raw: warning.raw,
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

function TabSupplierAnalyticsDashboard(props = {}) {
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
    supplier: '',
    period: 'THIS_MONTH',
    search: '',
  });

  const [appliedFilters, setAppliedFilters] = useState({
    supplier: '',
    period: 'THIS_MONTH',
    search: '',
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedItem, setSelectedItem] = useState(null);
  const [analyticsState, setAnalyticsState] = useState({
    loading: true,
    error: '',
    result: DEFAULT_RESULT,
  });

  const requestInput = useMemo(() => ({
    supplier: appliedFilters.supplier,
    supplier_id: appliedFilters.supplier,
    period: appliedFilters.period,
    search: appliedFilters.search,
    readonly: true,
  }), [
    appliedFilters.period,
    appliedFilters.search,
    appliedFilters.supplier,
  ]);

  useEffect(() => {
    if (!ownerAllowed) {
      setAnalyticsState({
        loading: false,
        error: '',
        result: DEFAULT_RESULT,
      });
      return;
    }

    if (typeof erpOrchestrator?.getOwnerAnalytics !== 'function') {
      setAnalyticsState({
        loading: false,
        error: 'erpOrchestrator.getOwnerAnalytics() belum tersedia.',
        result: DEFAULT_RESULT,
      });
      return;
    }

    let isMounted = true;

    setAnalyticsState((prev) => ({
      ...prev,
      loading: true,
      error: '',
    }));

    Promise.resolve()
      .then(() => {
        return erpOrchestrator.getOwnerAnalytics(
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

        setAnalyticsState({
          loading: false,
          error: '',
          result: mergeOwnerAnalyticsDefaults(result),
        });
      })
      .catch((error) => {
        if (!isMounted) return;

        setAnalyticsState({
          loading: false,
          error: error?.message || 'Gagal memuat Supplier Analytics Dashboard.',
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

  const result = mergeOwnerAnalyticsDefaults(analyticsState.result);
  const summary = result.summary;
  const supplierAnalytics = result.supplierAnalytics;

  const rankingRows = getSupplierRankingRows(supplierAnalytics);
  const topSupplierRows = getTopSupplierRows(supplierAnalytics);
  const riskSupplierRows = getRiskSupplierRows(supplierAnalytics);
  const inactiveSupplierRows = getInactiveSupplierRows(supplierAnalytics);
  const comparisonRows = getComparisonRows(supplierAnalytics);
  const warningRows = getWarningRows(result);

  const totalSupplier = getSummaryValue(summary, supplierAnalytics, [
    'totalSupplier',
    'totalSuppliers',
    'supplierCount',
    'supplier_count',
  ]);

  const activeSupplier = getSummaryValue(summary, supplierAnalytics, [
    'activeSupplier',
    'activeSuppliers',
    'activeSupplierCount',
    'active_supplier_count',
  ]);

  const totalPurchaseValue = getSummaryValue(summary, supplierAnalytics, [
    'totalPurchaseValue',
    'supplierPurchaseValue',
    'totalSupplierPurchase',
    'total_supplier_purchase',
    'purchaseValue',
    'purchase_value',
  ]);

  const totalHutangSupplier = getSummaryValue(summary, supplierAnalytics, [
    'totalHutangSupplier',
    'supplierPayable',
    'totalSupplierPayable',
    'total_supplier_payable',
    'payable',
    'totalPayable',
  ]);

  const bestSupplier = normalizeNamedSupplier(supplierAnalytics.bestSupplier) || topSupplierRows[0]?.supplier_name || '-';
  const riskSupplier = normalizeNamedSupplier(supplierAnalytics.riskSupplier) || riskSupplierRows[0]?.supplier_name || '-';

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
      supplier: '',
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
                <Truck size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                ERP Supplier Intelligence Layer
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              SUPPLIER ANALYTICS DASHBOARD
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Enterprise Supplier Intelligence Dashboard untuk Owner. Semua analytics berasal dari erpOrchestrator.getOwnerAnalytics().
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard title="Total Supplier" value={formatNumber(totalSupplier)} icon={<Truck size={18} />} tone="red" />
        <KpiCard title="Active Supplier" value={formatNumber(activeSupplier)} icon={<CheckCircle2 size={18} />} tone="green" />
        <KpiCard title="Total Purchase Value" value={totalPurchaseValue} icon={<DollarSign size={18} />} tone="blue" isMoney />
        <KpiCard title="Total Hutang Supplier" value={totalHutangSupplier} icon={<Wallet size={18} />} tone="amber" isMoney />
        <KpiCard title="Best Supplier" value={bestSupplier} icon={<Crown size={18} />} tone="white" />
        <KpiCard title="Risk Supplier" value={riskSupplier} icon={<ShieldAlert size={18} />} tone="orange" />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <Filter size={17} className="text-red-600" />
              Filter Supplier Analytics
            </div>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">
              Filter dikirim ke orchestrator. UI tidak menghitung analytics supplier sendiri.
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
              <Truck size={12} />
              Supplier
            </span>
            <input
              type="text"
              value={filters.supplier}
              onChange={(event) => handleFilterChange('supplier', event.target.value)}
              placeholder="Supplier"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
            />
          </label>

          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              <BarChart3 size={12} />
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
              placeholder="Cari supplier"
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

      {analyticsState.error && (
        <ErrorState message={analyticsState.error} />
      )}

      {analyticsState.loading ? (
        <LoadingSkeleton />
      ) : rankingRows.length === 0 && topSupplierRows.length === 0 && riskSupplierRows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <SupplierRankingTable
            rows={rankingRows}
            onSelect={setSelectedItem}
          />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-4">
              <TopSupplierPanel
                rows={topSupplierRows}
                onSelect={setSelectedItem}
              />
            </div>

            <div className="xl:col-span-4">
              <RiskSupplierPanel
                rows={riskSupplierRows}
                onSelect={setSelectedItem}
              />
            </div>

            <div className="xl:col-span-4">
              <InactiveSupplierPanel
                rows={inactiveSupplierRows}
                onSelect={setSelectedItem}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <SupplierComparisonPanel
                rows={comparisonRows}
                onSelect={setSelectedItem}
              />
            </div>

            <div className="xl:col-span-4">
              <WarningPanel
                warnings={warningRows}
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

export default TabSupplierAnalyticsDashboard;
