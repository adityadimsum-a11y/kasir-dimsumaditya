import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Building2,
  CheckCircle2,
  Crown,
  DollarSign,
  Eye,
  FileText,
  Filter,
  Gauge,
  LockKeyhole,
  MapPin,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
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
  totalBranch: 0,
  totalBranches: 0,
  branchCount: 0,
  totalRevenue: 0,
  totalProfit: 0,
  netProfit: 0,
  averageMargin: 0,
  avgMargin: 0,
  profitMargin: 0,
};

const DEFAULT_BRANCH_ANALYTICS = {
  topBranchRevenue: [],
  topBranchProfit: [],
  worstBranch: [],
  branchRanking: [],
  branchComparison: [],
  underperformBranches: [],
  lowProfitBranches: [],
  negativeMarginBranches: [],
  negativeGrowthBranches: [],
};

const DEFAULT_RESULT = {
  summary: DEFAULT_SUMMARY,
  branchAnalytics: DEFAULT_BRANCH_ANALYTICS,
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
  const branchAnalytics = safeObject(source.branchAnalytics);

  return {
    ...DEFAULT_RESULT,
    ...source,
    summary: {
      ...DEFAULT_SUMMARY,
      ...safeObject(source.summary),
    },
    branchAnalytics: {
      ...DEFAULT_BRANCH_ANALYTICS,
      ...branchAnalytics,
      topBranchRevenue: safeArray(branchAnalytics.topBranchRevenue),
      topBranchProfit: safeArray(branchAnalytics.topBranchProfit),
      worstBranch: safeArray(branchAnalytics.worstBranch),
      branchRanking: safeArray(branchAnalytics.branchRanking || branchAnalytics.branch_ranking || branchAnalytics.ranking),
      branchComparison: safeArray(branchAnalytics.branchComparison || branchAnalytics.branch_comparison || branchAnalytics.comparison),
      underperformBranches: safeArray(branchAnalytics.underperformBranches || branchAnalytics.underperform_branches),
      lowProfitBranches: safeArray(branchAnalytics.lowProfitBranches || branchAnalytics.low_profit_branches),
      negativeMarginBranches: safeArray(branchAnalytics.negativeMarginBranches || branchAnalytics.negative_margin_branches),
      negativeGrowthBranches: safeArray(branchAnalytics.negativeGrowthBranches || branchAnalytics.negative_growth_branches),
    },
    warningCards: safeArray(source.warningCards),
    warnings: safeArray(source.warnings),
    metadata: safeObject(source.metadata),
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

const normalizeBranchRow = (row = {}, index = 0) => {
  const branchId = String(row.branch_id || row.branchId || row.id || row.branch || '').trim();
  const branchName = String(
    row.branch_name ||
    row.branchName ||
    row.name ||
    row.branch ||
    row.label ||
    branchId ||
    `Cabang ${index + 1}`,
  ).trim();

  return {
    id: branchId || `BRANCH-${index + 1}`,
    rank: row.rank || row.ranking || index + 1,
    branch_id: branchId,
    branch_name: branchName,
    region: row.region || row.area || row.city || row.kota || '',
    revenue: row.totalRevenue ?? row.total_revenue ?? row.revenue ?? row.omzet ?? 0,
    profit: row.netProfit ?? row.net_profit ?? row.totalProfit ?? row.total_profit ?? row.grossProfit ?? row.gross_profit ?? 0,
    margin: row.profitMargin ?? row.profit_margin ?? row.margin ?? row.marginPercent ?? row.margin_percent ?? 0,
    growth: row.growthPercent ?? row.growth_percent ?? row.revenueGrowth ?? row.revenue_growth ?? row.growth ?? 0,
    marginScore: row.marginScore ?? row.margin_score ?? row.profitMargin ?? row.profit_margin ?? row.margin ?? 0,
    healthScore: row.healthScore ?? row.health_score ?? row.score ?? row.branchHealthScore ?? row.branch_health_score ?? 0,
    warningCount: row.warningCount ?? row.warning_count ?? row.totalWarning ?? row.total_warning ?? 0,
    status: row.status || row.healthStatus || row.health_status || '',
    metadata: safeObject(row.metadata || row.meta || row),
    raw: row,
  };
};

const getRankingRows = (branchAnalytics = {}) => {
  const explicitRanking = safeArray(
    branchAnalytics.branchRanking ||
    branchAnalytics.branch_ranking ||
    branchAnalytics.ranking ||
    branchAnalytics.rankings,
  );

  const sourceRows = explicitRanking.length > 0
    ? explicitRanking
    : safeArray(branchAnalytics.topBranchRevenue);

  return sourceRows.map((row, index) => normalizeBranchRow(row, index));
};

const getTopPerformerRows = (branchAnalytics = {}) => {
  const sourceRows = safeArray(branchAnalytics.topBranchProfit).length > 0
    ? safeArray(branchAnalytics.topBranchProfit)
    : safeArray(branchAnalytics.topBranchRevenue);

  return sourceRows.slice(0, 5).map((row, index) => normalizeBranchRow(row, index));
};

const getUnderperformRows = (branchAnalytics = {}) => {
  const explicitRows = [
    ...safeArray(branchAnalytics.underperformBranches),
    ...safeArray(branchAnalytics.lowProfitBranches),
    ...safeArray(branchAnalytics.negativeMarginBranches),
    ...safeArray(branchAnalytics.negativeGrowthBranches),
  ];

  const sourceRows = explicitRows.length > 0
    ? explicitRows
    : safeArray(branchAnalytics.worstBranch);

  return sourceRows.map((row, index) => normalizeBranchRow(row, index));
};

const getComparisonRows = (branchAnalytics = {}, rankingRows = []) => {
  const explicitRows = safeArray(
    branchAnalytics.branchComparison ||
    branchAnalytics.branch_comparison ||
    branchAnalytics.comparison ||
    branchAnalytics.comparisonRows,
  );

  const sourceRows = explicitRows.length > 0 ? explicitRows : rankingRows;

  return sourceRows.map((row, index) => normalizeBranchRow(row, index));
};

const getWarningRows = (result = {}) => {
  const rows = [
    ...safeArray(result.warningCards),
    ...safeArray(result.warnings),
  ];

  return rows.map((row, index) => ({
    id: row.id || row.code || `BRANCH-WARNING-${index + 1}`,
    severity: row.severity || row.priority || row.level || 'INFO',
    title: row.title || row.message || row.code || 'Branch Warning',
    message: row.message || row.description || row.notes || '',
    actionHint: row.action_hint || row.actionHint || row.recommendation || '',
    amount: row.amount || row.value || 0,
    metadata: safeObject(row.metadata || row.meta || row),
    raw: row,
  }));
};

const getStatusTone = (status) => {
  const normalized = normalizeCode(status || '');

  const toneMap = {
    EXCELLENT: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    GOOD: 'border-blue-200 bg-blue-50 text-blue-700',
    HEALTHY: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    WARNING: 'border-amber-200 bg-amber-50 text-amber-700',
    CRITICAL: 'border-red-200 bg-red-50 text-red-700',
    LOSS: 'border-red-200 bg-red-50 text-red-700',
  };

  return toneMap[normalized] || 'border-slate-200 bg-slate-50 text-slate-600';
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
  };

  return toneMap[normalized] || 'border-slate-200 bg-slate-50 text-slate-600';
};

const StatusBadge = ({ status }) => {
  const label = status || 'MONITOR';

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getStatusTone(label)}`}>
      {label}
    </span>
  );
};

const SeverityBadge = ({ severity }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getSeverityTone(severity)}`}>
    {normalizeCode(severity || 'INFO')}
  </span>
);

const KpiCard = ({ title, value, icon, tone = 'white', isMoney = false, isPercent = false }) => {
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
    : isPercent
      ? formatPercent(value)
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
      Branch Performance Dashboard hanya bisa diakses oleh OWNER atau DEWA.
    </p>
  </div>
);

const EmptyState = () => (
  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-8 text-center shadow-sm">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
      <Building2 size={24} />
    </div>
    <div className="mt-4 text-lg font-black text-amber-900">
      Tidak ada data performa cabang.
    </div>
    <p className="mx-auto mt-2 max-w-xl text-sm font-bold leading-relaxed text-amber-700">
      Tidak ada analytics cabang dari orchestrator untuk filter yang sedang aktif.
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
          Gagal memuat Branch Performance Dashboard.
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
              Branch Analytics Detail
            </div>
            <p className="mt-1 text-xs font-bold text-slate-400">
              Detail analytics cabang dari ERP Owner Analytics. Read only.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
            aria-label="Close branch detail"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {item.type || 'BRANCH_ANALYTICS'}
              </span>
              <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {item.region || 'ALL_REGION'}
              </span>
            </div>

            <h2 className="mt-4 text-xl font-black text-slate-950">
              {item.branch_name || item.title || 'Branch Detail'}
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Revenue
                </div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  {formatMoney(item.revenue)}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Profit
                </div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  {formatMoney(item.profit)}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Margin
                </div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  {formatPercent(item.margin)}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Growth
                </div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  {formatPercent(item.growth)}
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

const RankingTable = ({ rows, onSelect }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
      <div>
        <div className="flex items-center gap-2 text-sm font-black text-slate-900">
          <BarChart3 size={17} className="text-red-600" />
          Ranking Cabang
        </div>
        <p className="mt-1 text-[11px] font-semibold text-slate-400">
          Urutan ranking mengikuti data dari orchestrator.
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
              Ranking
            </th>
            <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Nama Cabang
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Revenue
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Profit
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Margin
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Growth %
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
                Ranking cabang belum tersedia dari orchestrator.
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
                    {row.branch_name}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-400">
                    {row.region || '-'}
                  </div>
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-emerald-700">
                  {formatMoney(row.revenue)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-slate-900">
                  {formatMoney(row.profit)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-blue-700">
                  {formatPercent(row.margin)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-slate-900">
                  {formatPercent(row.growth)}
                </td>
                <td className="px-5 py-4 text-center">
                  <button
                    type="button"
                    onClick={() => onSelect({
                      ...row,
                      type: 'BRANCH_RANKING',
                    })}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
                    aria-label={`Detail ${row.branch_name}`}
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

const TopPerformerPanel = ({ rows, onSelect }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
        <Award size={17} className="text-red-600" />
        Top Performer
      </div>
      <p className="mt-1 text-[11px] font-semibold text-slate-400">
        Top 5 cabang terbaik dari orchestrator.
      </p>
    </div>

    <div className="space-y-3 p-5">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm font-bold leading-relaxed text-amber-700">
          Top performer belum tersedia.
        </div>
      ) : (
        rows.map((row) => (
          <button
            key={`TOP-${row.id}-${row.rank}`}
            type="button"
            onClick={() => onSelect({
              ...row,
              type: 'TOP_PERFORMER',
            })}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition-all hover:border-red-100 hover:bg-red-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Crown size={16} className="text-amber-500" />
                  <div className="text-sm font-black text-slate-900">
                    {row.branch_name}
                  </div>
                </div>
                <div className="mt-2 text-xs font-semibold text-slate-500">
                  Profit {formatMoney(row.profit)} · Margin {formatPercent(row.margin)}
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

const UnderperformPanel = ({ rows, onSelect }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
        <TrendingDown size={17} className="text-red-600" />
        Underperform Branch
      </div>
      <p className="mt-1 text-[11px] font-semibold text-slate-400">
        Profit rendah, margin negatif, atau growth negatif sesuai orchestrator.
      </p>
    </div>

    <div className="max-h-[640px] space-y-3 overflow-y-auto p-5">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold leading-relaxed text-emerald-700">
          Tidak ada underperform branch dari orchestrator.
        </div>
      ) : (
        rows.map((row) => (
          <button
            key={`UNDER-${row.id}-${row.rank}`}
            type="button"
            onClick={() => onSelect({
              ...row,
              type: 'UNDERPERFORM_BRANCH',
            })}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition-all hover:border-red-100 hover:bg-red-50"
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={row.status || 'WARNING'} />
              <span className="rounded-full border border-slate-100 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                Growth {formatPercent(row.growth)}
              </span>
            </div>

            <div className="mt-3 text-sm font-black text-slate-900">
              {row.branch_name}
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-bold">
              <div className="rounded-xl bg-white p-3 text-slate-600">
                Profit<br />
                <span className="text-slate-950">{formatMoney(row.profit)}</span>
              </div>
              <div className="rounded-xl bg-white p-3 text-slate-600">
                Margin<br />
                <span className="text-slate-950">{formatPercent(row.margin)}</span>
              </div>
              <div className="rounded-xl bg-white p-3 text-slate-600">
                Warning<br />
                <span className="text-slate-950">{formatNumber(row.warningCount)}</span>
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  </div>
);

const BranchComparisonPanel = ({ rows, onSelect }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
      <div>
        <div className="flex items-center gap-2 text-sm font-black text-slate-900">
          <Gauge size={17} className="text-red-600" />
          Branch Comparison
        </div>
        <p className="mt-1 text-[11px] font-semibold text-slate-400">
          Revenue vs Profit, Margin Score, dan Health Score dari orchestrator.
        </p>
      </div>

      <span className="rounded-full border border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {formatNumber(rows.length)} rows
      </span>
    </div>

    <div className="grid grid-cols-1 gap-4 p-5 xl:grid-cols-2">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm font-bold leading-relaxed text-amber-700 xl:col-span-2">
          Branch comparison belum tersedia dari orchestrator.
        </div>
      ) : (
        rows.map((row) => (
          <button
            key={`COMPARE-${row.id}-${row.rank}`}
            type="button"
            onClick={() => onSelect({
              ...row,
              type: 'BRANCH_COMPARISON',
            })}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-left transition-all hover:border-red-100 hover:bg-red-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-950">
                  {row.branch_name}
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-400">
                  Revenue vs Profit
                </div>
              </div>

              <StatusBadge status={row.status || 'MONITOR'} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Revenue
                </div>
                <div className="mt-1 text-sm font-black text-emerald-700">
                  {formatMoney(row.revenue)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Profit
                </div>
                <div className="mt-1 text-sm font-black text-slate-950">
                  {formatMoney(row.profit)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Margin Score
                </div>
                <div className="mt-1 text-sm font-black text-blue-700">
                  {formatPercent(row.marginScore)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Health Score
                </div>
                <div className="mt-1 text-sm font-black text-red-700">
                  {formatNumber(row.healthScore)}
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
        Warning berasal dari orchestrator.
      </p>
    </div>

    <div className="max-h-[640px] space-y-3 overflow-y-auto p-5">
      {warnings.length === 0 ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold leading-relaxed text-emerald-700">
          Tidak ada warning branch dari orchestrator.
        </div>
      ) : (
        warnings.map((warning) => (
          <button
            key={warning.id}
            type="button"
            onClick={() => onSelect({
              ...warning,
              type: 'BRANCH_WARNING',
              branch_name: warning.title,
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

function TabBranchPerformanceDashboard(props = {}) {
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
    region: '',
    period: 'THIS_MONTH',
    search: '',
  });

  const [appliedFilters, setAppliedFilters] = useState({
    branch: '',
    region: '',
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
    branch: appliedFilters.branch,
    branch_id: appliedFilters.branch,
    region: appliedFilters.region,
    period: appliedFilters.period,
    search: appliedFilters.search,
    readonly: true,
  }), [
    appliedFilters.branch,
    appliedFilters.period,
    appliedFilters.region,
    appliedFilters.search,
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
          error: error?.message || 'Gagal memuat Branch Performance Dashboard.',
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
  const branchAnalytics = result.branchAnalytics;

  const rankingRows = getRankingRows(branchAnalytics);
  const topPerformerRows = getTopPerformerRows(branchAnalytics);
  const underperformRows = getUnderperformRows(branchAnalytics);
  const comparisonRows = getComparisonRows(branchAnalytics, rankingRows);
  const warningRows = getWarningRows(result);

  const totalBranch = getSummaryValue(summary, [
    'totalBranch',
    'totalBranches',
    'branchCount',
    'branch_count',
  ]) || rankingRows.length;

  const totalRevenue = getSummaryValue(summary, [
    'totalRevenue',
    'total_revenue',
    'revenue',
    'omzet',
  ]);

  const totalProfit = getSummaryValue(summary, [
    'totalProfit',
    'total_profit',
    'netProfit',
    'net_profit',
    'grossProfit',
    'gross_profit',
  ]);

  const averageMargin = getSummaryValue(summary, [
    'averageMargin',
    'average_margin',
    'avgMargin',
    'avg_margin',
    'profitMargin',
    'profit_margin',
  ]);

  const bestBranch = topPerformerRows[0]?.branch_name || '-';
  const worstBranch = underperformRows[0]?.branch_name || '-';

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
      region: '',
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
                <Building2 size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                ERP Branch Intelligence Layer
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              BRANCH PERFORMANCE DASHBOARD
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Enterprise Branch Intelligence Dashboard untuk Owner. Semua analytics berasal dari erpOrchestrator.getOwnerAnalytics().
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
        <KpiCard title="Total Branch" value={formatNumber(totalBranch)} icon={<Building2 size={18} />} tone="red" />
        <KpiCard title="Total Revenue" value={totalRevenue} icon={<TrendingUp size={18} />} tone="green" isMoney />
        <KpiCard title="Total Profit" value={totalProfit} icon={<DollarSign size={18} />} tone="blue" isMoney />
        <KpiCard title="Average Margin" value={averageMargin} icon={<Gauge size={18} />} tone="amber" isPercent />
        <KpiCard title="Best Branch" value={bestBranch} icon={<Crown size={18} />} tone="white" />
        <KpiCard title="Worst Branch" value={worstBranch} icon={<TrendingDown size={18} />} tone="orange" />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <Filter size={17} className="text-red-600" />
              Filter Branch Performance
            </div>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">
              Filter dikirim ke orchestrator. UI tidak menghitung profit, omzet, atau ranking cabang.
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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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
              <MapPin size={12} />
              Region
            </span>
            <input
              type="text"
              value={filters.region}
              onChange={(event) => handleFilterChange('region', event.target.value)}
              placeholder="Region"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
            />
          </label>

          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              <Activity size={12} />
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
              placeholder="Cari cabang"
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
      ) : rankingRows.length === 0 && topPerformerRows.length === 0 && underperformRows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <RankingTable
            rows={rankingRows}
            onSelect={setSelectedItem}
          />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-4">
              <TopPerformerPanel
                rows={topPerformerRows}
                onSelect={setSelectedItem}
              />
            </div>

            <div className="xl:col-span-4">
              <UnderperformPanel
                rows={underperformRows}
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

          <BranchComparisonPanel
            rows={comparisonRows}
            onSelect={setSelectedItem}
          />
        </>
      )}

      <DetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}

export default TabBranchPerformanceDashboard;
