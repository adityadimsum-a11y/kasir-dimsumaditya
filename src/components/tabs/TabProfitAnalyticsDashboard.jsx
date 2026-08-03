import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Building2,
  Crown,
  DollarSign,
  Gauge,
  LockKeyhole,
  Package,
  RefreshCw,
  ShieldAlert,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import erpOrchestrator from '../../utils/erpOrchestrator';

const EMPTY_OBJECT = Object.freeze({});

const REQUIRED_CHANNELS = [
  'OFFLINE',
  'GOFOOD',
  'GRABFOOD',
  'SHOPEEFOOD',
  'TIKTOK',
];

const DEFAULT_OWNER_RESULT = {
  summary: {},
  profitAnalytics: {},
  productAnalytics: {},
  branchAnalytics: {},
  channelAnalytics: {},
  warningCards: [],
  warnings: [],
  metadata: {},
};

const DEFAULT_RADAR_RESULT = {
  summary: {},
  records: [],
  profitRadar: [],
  financialRadar: [],
  riskCards: [],
  ownerActionCenter: [],
  recommendations: [],
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

const formatMoney = (value) => {
  return `Rp${Math.round(safeNumber(value, 0)).toLocaleString('id-ID')}`;
};

const formatNumber = (value) => {
  return Math.round(safeNumber(value, 0)).toLocaleString('id-ID');
};

const formatPercent = (value) => {
  return `${Math.round(safeNumber(value, 0) * 100) / 100}%`;
};

const getFirstValue = (source = {}, keys = [], fallback = 0) => {
  const objectSource = safeObject(source);

  for (const key of keys) {
    if (objectSource[key] !== undefined && objectSource[key] !== null && objectSource[key] !== '') {
      return objectSource[key];
    }
  }

  return fallback;
};

const getFirstValueFrom = (sources = [], keys = [], fallback = 0) => {
  for (const source of sources) {
    const value = getFirstValue(source, keys, undefined);

    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return fallback;
};

const getFirstString = (source = {}, keys = [], fallback = '-') => {
  const objectSource = safeObject(source);

  for (const key of keys) {
    if (objectSource[key] !== undefined && objectSource[key] !== null && String(objectSource[key]).trim() !== '') {
      return String(objectSource[key]);
    }
  }

  return fallback;
};

const getFirstStringFrom = (sources = [], keys = [], fallback = '-') => {
  for (const source of sources) {
    const value = getFirstString(source, keys, '');

    if (value) return value;
  }

  return fallback;
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

const mergeOwnerDefaults = (result) => {
  const source = safeObject(result);

  return {
    ...DEFAULT_OWNER_RESULT,
    ...source,
    summary: safeObject(source.summary),
    profitAnalytics: safeObject(source.profitAnalytics || source.profit_analytics),
    productAnalytics: safeObject(source.productAnalytics || source.product_analytics),
    branchAnalytics: safeObject(source.branchAnalytics || source.branch_analytics),
    channelAnalytics: safeObject(source.channelAnalytics || source.channel_analytics),
    warningCards: safeArray(source.warningCards || source.warning_cards),
    warnings: safeArray(source.warnings),
    metadata: safeObject(source.metadata),
  };
};

const mergeRadarDefaults = (result) => {
  const source = safeObject(result);

  return {
    ...DEFAULT_RADAR_RESULT,
    ...source,
    summary: safeObject(source.summary),
    records: safeArray(source.records),
    profitRadar: safeArray(source.profitRadar || source.profit_radar),
    financialRadar: safeArray(source.financialRadar || source.financial_radar),
    riskCards: safeArray(source.riskCards || source.risk_cards),
    ownerActionCenter: safeArray(source.ownerActionCenter || source.owner_action_center),
    recommendations: safeArray(source.recommendations),
    warnings: safeArray(source.warnings),
    metadata: safeObject(source.metadata),
  };
};

const normalizeProductProfitRow = (row = {}, index = 0) => ({
  id: row.id || row.product_id || row.productId || `PRODUCT-PROFIT-${index + 1}`,
  productName: getFirstString(row, ['product_name', 'productName', 'name', 'product', 'label'], `Produk ${index + 1}`),
  revenue: getFirstValue(row, ['revenue', 'totalRevenue', 'total_revenue', 'productRevenue', 'product_revenue', 'omzet'], 0),
  profit: getFirstValue(row, ['profit', 'totalProfit', 'total_profit', 'productProfit', 'product_profit', 'netProfit', 'net_profit'], 0),
  margin: getFirstValue(row, ['margin', 'profitMargin', 'profit_margin', 'marginPercent', 'margin_percent'], 0),
  status: row.status || row.profitStatus || row.profit_status || 'MONITOR',
  raw: row,
});

const normalizeBranchProfitRow = (row = {}, index = 0) => ({
  id: row.id || row.branch_id || row.branchId || `BRANCH-PROFIT-${index + 1}`,
  branchName: getFirstString(row, ['branch_name', 'branchName', 'name', 'branch', 'label'], `Cabang ${index + 1}`),
  revenue: getFirstValue(row, ['revenue', 'totalRevenue', 'total_revenue', 'branchRevenue', 'branch_revenue', 'omzet'], 0),
  profit: getFirstValue(row, ['profit', 'totalProfit', 'total_profit', 'branchProfit', 'branch_profit', 'netProfit', 'net_profit'], 0),
  margin: getFirstValue(row, ['margin', 'profitMargin', 'profit_margin', 'marginPercent', 'margin_percent'], 0),
  growth: getFirstValue(row, ['growth', 'growthPercent', 'growth_percent', 'profitGrowth', 'profit_growth'], 0),
  status: row.status || row.branchStatus || row.branch_status || row.profitStatus || row.profit_status || 'MONITOR',
  raw: row,
});

const normalizeChannelProfitRow = (row = {}, index = 0) => ({
  id: row.id || row.channel || row.sales_channel || `CHANNEL-PROFIT-${index + 1}`,
  channel: normalizeCode(row.channel || row.sales_channel || row.salesChannel || row.name || row.label || `CHANNEL_${index + 1}`),
  revenue: getFirstValue(row, ['revenue', 'totalRevenue', 'total_revenue', 'channelRevenue', 'channel_revenue', 'omzet'], 0),
  profit: getFirstValue(row, ['profit', 'totalProfit', 'total_profit', 'channelProfit', 'channel_profit', 'netProfit', 'net_profit'], 0),
  margin: getFirstValue(row, ['margin', 'profitMargin', 'profit_margin', 'marginPercent', 'margin_percent'], 0),
  status: row.status || row.channelStatus || row.channel_status || row.profitStatus || row.profit_status || 'MONITOR',
  raw: row,
});

const normalizeRiskRow = (row = {}, index = 0) => ({
  id: row.id || row.code || row.reference_number || `PROFIT-RISK-${index + 1}`,
  severity: row.severity || row.priority || row.level || row.status || 'INFO',
  title: row.title || row.name || row.code || 'Profit Risk',
  message: row.message || row.description || row.notes || '',
  recommendation: row.recommendation || row.action_hint || row.actionHint || '',
  amount: row.amount || row.value || row.lossAmount || row.loss_amount || 0,
  raw: row,
});

const normalizeInsightRow = (row = {}, index = 0) => ({
  id: row.id || row.code || row.reference_number || `PROFIT-INSIGHT-${index + 1}`,
  severity: row.severity || row.priority || row.level || row.status || 'INFO',
  title: row.title || row.name || row.code || 'Profit Insight',
  message: row.message || row.description || row.notes || '',
  recommendation: row.recommendation || row.action_hint || row.actionHint || '',
  raw: row,
});

const getProductProfitRows = (profitAnalytics = {}, productAnalytics = {}) => {
  const rows = [
    ...safeArray(profitAnalytics.productProfitAnalytics || profitAnalytics.product_profit_analytics),
    ...safeArray(profitAnalytics.productProfitRanking || profitAnalytics.product_profit_ranking),
    ...safeArray(profitAnalytics.topProductProfit || profitAnalytics.top_product_profit),
    ...safeArray(profitAnalytics.topProfitProducts || profitAnalytics.top_profit_products),
    ...safeArray(productAnalytics.productProfitAnalytics || productAnalytics.product_profit_analytics),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeProductProfitRow(row, index));
};

const getBranchProfitRows = (profitAnalytics = {}, branchAnalytics = {}) => {
  const rows = [
    ...safeArray(profitAnalytics.branchProfitComparison || profitAnalytics.branch_profit_comparison),
    ...safeArray(profitAnalytics.branchProfitAnalytics || profitAnalytics.branch_profit_analytics),
    ...safeArray(profitAnalytics.profitByBranch || profitAnalytics.profit_by_branch),
    ...safeArray(branchAnalytics.branchProfitComparison || branchAnalytics.branch_profit_comparison),
    ...safeArray(branchAnalytics.branchRanking || branchAnalytics.branch_ranking),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeBranchProfitRow(row, index));
};

const getChannelProfitRows = (profitAnalytics = {}, channelAnalytics = {}) => {
  const rows = [
    ...safeArray(profitAnalytics.channelProfitAnalytics || profitAnalytics.channel_profit_analytics),
    ...safeArray(profitAnalytics.profitByChannel || profitAnalytics.profit_by_channel),
    ...safeArray(profitAnalytics.channelAnalytics || profitAnalytics.channel_analytics),
    ...safeArray(channelAnalytics.channelProfitAnalytics || channelAnalytics.channel_profit_analytics),
    ...safeArray(channelAnalytics.channelAnalytics || channelAnalytics.channel_analytics),
  ];

  const channelMap = new Map();

  rows.forEach((row, index) => {
    const normalized = normalizeChannelProfitRow(row, index);
    if (!normalized.channel) return;
    channelMap.set(normalized.channel, normalized);
  });

  return REQUIRED_CHANNELS.map((channel) => (
    channelMap.get(channel) || {
      id: `CHANNEL-PROFIT-${channel}`,
      channel,
      revenue: 0,
      profit: 0,
      margin: 0,
      status: 'MONITOR',
      raw: {},
    }
  ));
};

const getProfitRiskRows = (radarResult = {}) => {
  const rows = [
    ...safeArray(radarResult.profitRadar),
    ...safeArray(radarResult.financialRadar),
    ...safeArray(radarResult.riskCards),
    ...safeArray(radarResult.ownerActionCenter),
    ...safeArray(radarResult.records),
  ];

  return rows.slice(0, 8).map((row, index) => normalizeRiskRow(row, index));
};

const getProfitInsightRows = (ownerResult = {}, radarResult = {}) => {
  const profitAnalytics = safeObject(ownerResult.profitAnalytics);

  const rows = [
    ...safeArray(profitAnalytics.insights || profitAnalytics.profitInsights || profitAnalytics.profit_insights),
    ...safeArray(profitAnalytics.warningCards || profitAnalytics.warning_cards),
    ...safeArray(ownerResult.warningCards),
    ...safeArray(ownerResult.warnings),
    ...safeArray(radarResult.recommendations),
    ...safeArray(radarResult.ownerActionCenter),
    ...safeArray(radarResult.warnings),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeInsightRow(row, index));
};

const getToneBySeverity = (severity) => {
  const normalized = normalizeCode(severity);

  const toneMap = {
    CRITICAL: 'border-red-200 bg-red-50 text-red-700',
    HIGH: 'border-orange-200 bg-orange-50 text-orange-700',
    WARNING: 'border-amber-200 bg-amber-50 text-amber-700',
    MEDIUM: 'border-amber-200 bg-amber-50 text-amber-700',
    LOW: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    INFO: 'border-blue-200 bg-blue-50 text-blue-700',
    HEALTHY: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    GOOD: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    PROFITABLE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    LOSS: 'border-red-200 bg-red-50 text-red-700',
    NEGATIVE_MARGIN: 'border-red-200 bg-red-50 text-red-700',
    MONITOR: 'border-slate-200 bg-slate-50 text-slate-600',
  };

  return toneMap[normalized] || 'border-slate-200 bg-slate-50 text-slate-600';
};

const SeverityBadge = ({ severity }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getToneBySeverity(severity)}`}>
    {normalizeCode(severity || 'INFO')}
  </span>
);

const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getToneBySeverity(status)}`}>
    {normalizeCode(status || 'MONITOR')}
  </span>
);

const ProfitKpiCard = ({ title, value, icon, tone = 'white', isMoney = true, isPercent = false }) => {
  const toneMap = {
    red: 'bg-red-600 text-white',
    dark: 'bg-slate-950 text-white',
    orange: 'border border-orange-100 bg-orange-50 text-orange-900',
    amber: 'border border-amber-100 bg-amber-50 text-amber-900',
    green: 'border border-emerald-100 bg-emerald-50 text-emerald-900',
    blue: 'border border-blue-100 bg-blue-50 text-blue-900',
    white: 'border border-slate-100 bg-white text-slate-900',
  };

  const displayValue = isPercent
    ? formatPercent(value)
    : isMoney
      ? formatMoney(value)
      : typeof value === 'number'
        ? formatNumber(value)
        : String(value || value === 0 ? value : '-');

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

const ProfitCard = ({ title, subtitle, icon, children }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
      <div>
        <div className="flex items-center gap-2 text-sm font-black text-slate-900">
          {icon}
          {title}
        </div>
        {subtitle && (
          <p className="mt-1 text-[11px] font-semibold text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
    </div>

    <div className="p-5">
      {children}
    </div>
  </div>
);

const LoadingSkeleton = () => (
  <div className="space-y-4">
    <div className="animate-pulse rounded-2xl bg-slate-950 p-8 shadow-sm">
      <div className="h-5 w-1/3 rounded-full bg-white/10" />
      <div className="mt-5 h-10 w-2/3 rounded-full bg-white/10" />
      <div className="mt-4 h-4 w-1/2 rounded-full bg-white/10" />
    </div>

    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
        >
          <div className="h-4 w-1/2 rounded-full bg-slate-100" />
          <div className="mt-4 h-7 w-2/3 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
        >
          <div className="h-4 w-1/3 rounded-full bg-slate-100" />
          <div className="mt-5 space-y-2">
            <div className="h-3 w-full rounded-full bg-slate-100" />
            <div className="h-3 w-4/5 rounded-full bg-slate-100" />
            <div className="h-3 w-3/5 rounded-full bg-slate-100" />
          </div>
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
      Profit Analytics Dashboard hanya bisa diakses oleh OWNER, DEWA, MONITOR_DEWA, atau HO_TANGERANG.
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
          Gagal memuat Profit Analytics Dashboard.
        </div>
        <p className="mt-1 text-sm font-bold leading-relaxed text-red-700">
          {message || 'Terjadi kesalahan saat membaca ERP Profit Command Center.'}
        </p>
      </div>
    </div>
  </div>
);

const EmptyMiniState = ({ text }) => (
  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm font-bold leading-relaxed text-amber-700">
    {text}
  </div>
);

const ProfitPerformanceSection = ({ profitAnalytics, summary }) => {
  const revenueTrend = getFirstStringFrom(
    [profitAnalytics, summary],
    ['revenueTrend', 'revenue_trend', 'revenueTrendSummary', 'revenue_trend_summary'],
    '',
  );

  const profitTrend = getFirstStringFrom(
    [profitAnalytics, summary],
    ['profitTrend', 'profit_trend', 'profitTrendSummary', 'profit_trend_summary'],
    '',
  );

  const marginSummary = getFirstStringFrom(
    [profitAnalytics, summary],
    ['marginSummary', 'margin_summary', 'profitMarginSummary', 'profit_margin_summary', 'summaryText', 'trendSummary', 'trend_summary'],
    '',
  );

  return (
    <ProfitCard
      title="Profit Performance"
      subtitle="Revenue Trend, Profit Trend, dan Margin Summary dari orchestrator."
      icon={<BarChart3 size={17} className="text-red-600" />}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-500">
            <TrendingUp size={13} />
            Revenue Trend
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-emerald-800">
            {revenueTrend || 'Revenue trend belum tersedia dari orchestrator.'}
          </p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-blue-500">
            <DollarSign size={13} />
            Profit Trend
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-blue-800">
            {profitTrend || 'Profit trend belum tersedia dari orchestrator.'}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-500">
            <Gauge size={13} />
            Margin Summary
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-amber-800">
            {marginSummary || 'Margin summary belum tersedia dari orchestrator.'}
          </p>
        </div>
      </div>
    </ProfitCard>
  );
};

const ProductProfitAnalyticsSection = ({ rows }) => (
  <ProfitCard
    title="Product Profit Analytics"
    subtitle="Nama Produk, Revenue, Profit, Margin, dan Status dari orchestrator."
    icon={<Package size={17} className="text-red-600" />}
  >
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Nama Produk
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
            <th className="px-5 py-4 text-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Status
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-8 text-center text-sm font-bold text-slate-400">
                Product profit analytics belum tersedia dari orchestrator.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    {index === 0 && <Crown size={15} className="text-amber-500" />}
                    <div className="text-sm font-black text-slate-900">
                      {row.productName}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-emerald-700">
                  {formatMoney(row.revenue)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-blue-700">
                  {formatMoney(row.profit)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-slate-900">
                  {formatPercent(row.margin)}
                </td>
                <td className="px-5 py-4 text-center">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </ProfitCard>
);

const BranchProfitComparisonSection = ({ rows }) => (
  <ProfitCard
    title="Branch Profit Comparison"
    subtitle="Nama Cabang, Revenue, Profit, Margin, Growth, dan Status dari orchestrator."
    icon={<Building2 size={17} className="text-red-600" />}
  >
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {rows.length === 0 ? (
        <EmptyMiniState text="Branch profit comparison belum tersedia dari orchestrator." />
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-950">
                  {row.branchName}
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-400">
                  Branch Profit
                </div>
              </div>

              <StatusBadge status={row.status} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Revenue
                </div>
                <div className="mt-1 text-sm font-black text-emerald-700">
                  {formatMoney(row.revenue)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Profit
                </div>
                <div className="mt-1 text-sm font-black text-blue-700">
                  {formatMoney(row.profit)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Margin
                </div>
                <div className="mt-1 text-sm font-black text-slate-950">
                  {formatPercent(row.margin)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Growth
                </div>
                <div className="mt-1 text-sm font-black text-red-700">
                  {formatPercent(row.growth)}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  </ProfitCard>
);

const ChannelProfitAnalyticsSection = ({ rows }) => (
  <ProfitCard
    title="Channel Profit Analytics"
    subtitle="Channel, Revenue, Profit, Margin, dan Status dari orchestrator."
    icon={<ShoppingBag size={17} className="text-red-600" />}
  >
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      {rows.map((row) => (
        <div
          key={row.id}
          className="rounded-2xl border border-slate-100 bg-slate-50 p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-black text-slate-950">
                {row.channel}
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-400">
                Channel Profit
              </div>
            </div>

            <StatusBadge status={row.status} />
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-white p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                Revenue
              </div>
              <div className="mt-1 text-sm font-black text-emerald-700">
                {formatMoney(row.revenue)}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                Profit
              </div>
              <div className="mt-1 text-sm font-black text-blue-700">
                {formatMoney(row.profit)}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                Margin
              </div>
              <div className="mt-1 text-sm font-black text-slate-950">
                {formatPercent(row.margin)}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </ProfitCard>
);

const ProfitRiskPanel = ({ rows }) => (
  <ProfitCard
    title="Profit Risk Panel"
    subtitle="Risk berasal dari erpOrchestrator.getBusinessRadar()."
    icon={<ShieldAlert size={17} className="text-red-600" />}
  >
    <div className="max-h-[620px] space-y-3 overflow-y-auto">
      {rows.length === 0 ? (
        <EmptyMiniState text="Profit risk belum tersedia dari orchestrator." />
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={row.severity} />
              {safeNumber(row.amount, 0) !== 0 && (
                <span className="rounded-full border border-slate-100 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  {formatMoney(row.amount)}
                </span>
              )}
            </div>

            <div className="mt-3 text-sm font-black text-slate-900">
              {row.title}
            </div>

            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
              {row.message || row.recommendation || '-'}
            </p>

            {row.recommendation && (
              <div className="mt-3 rounded-2xl border border-slate-100 bg-white p-3 text-xs font-bold leading-relaxed text-slate-600">
                {row.recommendation}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  </ProfitCard>
);

const ProfitInsightPanel = ({ rows }) => (
  <ProfitCard
    title="Profit Insight Panel"
    subtitle="Insight hanya berasal dari orchestrator."
    icon={<Activity size={17} className="text-red-600" />}
  >
    <div className="max-h-[620px] space-y-3 overflow-y-auto">
      {rows.length === 0 ? (
        <EmptyMiniState text="Profit insight belum tersedia dari orchestrator." />
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={row.severity} />
            </div>

            <div className="mt-3 text-sm font-black text-slate-900">
              {row.title}
            </div>

            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
              {row.message || row.recommendation || '-'}
            </p>
          </div>
        ))
      )}
    </div>
  </ProfitCard>
);

function TabProfitAnalyticsDashboard(props = {}) {
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

  const [refreshKey, setRefreshKey] = useState(0);
  const [dashboardState, setDashboardState] = useState({
    loading: true,
    error: '',
    ownerResult: DEFAULT_OWNER_RESULT,
    radarResult: DEFAULT_RADAR_RESULT,
  });

  const requestInput = useMemo(() => ({
    readonly: true,
    dashboard: 'PROFIT_ANALYTICS',
    includeProfitAnalytics: true,
    includeProductAnalytics: true,
    includeBranchAnalytics: true,
    includeChannelAnalytics: true,
  }), []);

  useEffect(() => {
    if (!ownerAllowed) {
      setDashboardState({
        loading: false,
        error: '',
        ownerResult: DEFAULT_OWNER_RESULT,
        radarResult: DEFAULT_RADAR_RESULT,
      });
      return;
    }

    const missingApi = [
      ['getOwnerAnalytics', erpOrchestrator?.getOwnerAnalytics],
      ['getBusinessRadar', erpOrchestrator?.getBusinessRadar],
    ].find(([, api]) => typeof api !== 'function');

    if (missingApi) {
      setDashboardState({
        loading: false,
        error: `erpOrchestrator.${missingApi[0]}() belum tersedia.`,
        ownerResult: DEFAULT_OWNER_RESULT,
        radarResult: DEFAULT_RADAR_RESULT,
      });
      return;
    }

    let isMounted = true;

    setDashboardState((prev) => ({
      ...prev,
      loading: true,
      error: '',
    }));

    const context = {
      source: sourceData,
      dbData: sourceData,
      readonly: true,
      user: activeUser,
      executor: getUserLabel(activeUser),
    };

    Promise.all([
      erpOrchestrator.getOwnerAnalytics(requestInput, context),
      erpOrchestrator.getBusinessRadar(requestInput, context),
    ])
      .then(([ownerResult, radarResult]) => {
        if (!isMounted) return;

        setDashboardState({
          loading: false,
          error: '',
          ownerResult: mergeOwnerDefaults(ownerResult),
          radarResult: mergeRadarDefaults(radarResult),
        });
      })
      .catch((error) => {
        if (!isMounted) return;

        setDashboardState({
          loading: false,
          error: error?.message || 'Gagal memuat Profit Analytics Dashboard.',
          ownerResult: DEFAULT_OWNER_RESULT,
          radarResult: DEFAULT_RADAR_RESULT,
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

  const ownerResult = mergeOwnerDefaults(dashboardState.ownerResult);
  const radarResult = mergeRadarDefaults(dashboardState.radarResult);

  const summary = ownerResult.summary;
  const profitAnalytics = ownerResult.profitAnalytics;
  const productAnalytics = ownerResult.productAnalytics;
  const branchAnalytics = ownerResult.branchAnalytics;
  const channelAnalytics = ownerResult.channelAnalytics;

  const totalRevenue = getFirstValueFrom(
    [profitAnalytics, summary],
    ['totalRevenue', 'total_revenue', 'revenue', 'omzet'],
    0,
  );

  const totalProfit = getFirstValueFrom(
    [profitAnalytics, summary],
    ['totalProfit', 'total_profit', 'profit'],
    0,
  );

  const grossProfit = getFirstValueFrom(
    [profitAnalytics, summary],
    ['grossProfit', 'gross_profit', 'totalGrossProfit', 'total_gross_profit'],
    0,
  );

  const netProfit = getFirstValueFrom(
    [profitAnalytics, summary],
    ['netProfit', 'net_profit', 'totalNetProfit', 'total_net_profit'],
    0,
  );

  const profitMargin = getFirstValueFrom(
    [profitAnalytics, summary],
    ['profitMargin', 'profit_margin', 'netMargin', 'net_margin', 'netProfitMargin', 'net_profit_margin'],
    0,
  );

  const averageOrderValue = getFirstValueFrom(
    [profitAnalytics, summary],
    ['averageOrderValue', 'average_order_value', 'avgOrderValue', 'avg_order_value', 'aov'],
    0,
  );

  const profitGrowth = getFirstValueFrom(
    [profitAnalytics, summary],
    ['profitGrowth', 'profit_growth', 'growth', 'growthPercent', 'growth_percent'],
    0,
  );

  const productProfitRows = getProductProfitRows(profitAnalytics, productAnalytics);
  const branchProfitRows = getBranchProfitRows(profitAnalytics, branchAnalytics);
  const channelProfitRows = getChannelProfitRows(profitAnalytics, channelAnalytics);
  const profitRiskRows = getProfitRiskRows(radarResult);
  const profitInsightRows = getProfitInsightRows(ownerResult, radarResult);

  const bestProductProfit = getFirstStringFrom(
    [profitAnalytics, summary],
    ['bestProductProfit', 'best_product_profit', 'bestProfitProduct', 'best_profit_product', 'topProfitProduct', 'top_profit_product'],
    productProfitRows[0]?.productName || '-',
  );

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

        <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="rounded-2xl bg-red-600 p-2 shadow-sm">
                <DollarSign size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                ERP Profit Command Center
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              PROFIT ANALYTICS DASHBOARD
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Owner Profit Command Center untuk memantau revenue, profit, gross profit, net profit, margin, product profit, branch profit, channel profit, risk, dan insight dari orchestrator.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                OWNER PROFIT COMMAND CENTER
              </span>
              <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">
                READ ONLY
              </span>
              <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
                THIN UI
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-amber-200 transition-all hover:bg-amber-300/20"
          >
            <RefreshCw size={14} />
            REFRESH PROFIT DASHBOARD
          </button>
        </div>
      </div>

      {dashboardState.error && (
        <ErrorState message={dashboardState.error} />
      )}

      {dashboardState.loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ProfitKpiCard title="Total Revenue" value={totalRevenue} icon={<DollarSign size={18} />} tone="red" />
            <ProfitKpiCard title="Total Profit" value={totalProfit} icon={<Activity size={18} />} tone="green" />
            <ProfitKpiCard title="Gross Profit" value={grossProfit} icon={<TrendingUp size={18} />} tone="blue" />
            <ProfitKpiCard title="Net Profit" value={netProfit} icon={<Gauge size={18} />} tone="amber" />
            <ProfitKpiCard title="Profit Margin" value={profitMargin} icon={<BarChart3 size={18} />} tone="white" isMoney={false} isPercent />
            <ProfitKpiCard title="Average Order Value" value={averageOrderValue} icon={<ShoppingBag size={18} />} tone="white" />
            <ProfitKpiCard title="Best Product Profit" value={bestProductProfit} icon={<Award size={18} />} tone="white" isMoney={false} />
            <ProfitKpiCard title="Profit Growth" value={profitGrowth} icon={<TrendingDown size={18} />} tone="orange" isMoney={false} isPercent />
          </div>

          <ProfitPerformanceSection
            profitAnalytics={profitAnalytics}
            summary={summary}
          />

          <ProductProfitAnalyticsSection rows={productProfitRows} />

          <BranchProfitComparisonSection rows={branchProfitRows} />

          <ChannelProfitAnalyticsSection rows={channelProfitRows} />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-6">
              <ProfitRiskPanel rows={profitRiskRows} />
            </div>

            <div className="xl:col-span-6">
              <ProfitInsightPanel rows={profitInsightRows} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default TabProfitAnalyticsDashboard;
