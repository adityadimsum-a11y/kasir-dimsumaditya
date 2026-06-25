import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  Crown,
  Gauge,
  LockKeyhole,
  Package,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import erpOrchestrator from '../../utils/erpOrchestrator';

const EMPTY_OBJECT = Object.freeze({});

const DEFAULT_OWNER_RESULT = {
  summary: {},
  productionAnalytics: {},
  productAnalytics: {},
  branchAnalytics: {},
  warningCards: [],
  warnings: [],
  metadata: {},
};

const DEFAULT_RADAR_RESULT = {
  summary: {},
  records: [],
  productionRadar: [],
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
    productionAnalytics: safeObject(source.productionAnalytics || source.production_analytics),
    productAnalytics: safeObject(source.productAnalytics || source.product_analytics),
    branchAnalytics: safeObject(source.branchAnalytics || source.branch_analytics),
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
    productionRadar: safeArray(source.productionRadar || source.production_radar),
    riskCards: safeArray(source.riskCards || source.risk_cards),
    ownerActionCenter: safeArray(source.ownerActionCenter || source.owner_action_center),
    recommendations: safeArray(source.recommendations),
    warnings: safeArray(source.warnings),
    metadata: safeObject(source.metadata),
  };
};

const normalizeProductProductionRow = (row = {}, index = 0) => ({
  id: row.id || row.product_id || row.productId || `PRODUCTION-PRODUCT-${index + 1}`,
  productName: getFirstString(row, ['product_name', 'productName', 'name', 'product', 'label'], `Produk ${index + 1}`),
  qtyProduction: getFirstValue(row, ['qtyProduction', 'qty_production', 'productionQty', 'production_qty', 'totalOutput', 'total_output', 'outputQty', 'output_qty'], 0),
  batchCount: getFirstValue(row, ['batchCount', 'batch_count', 'totalBatch', 'total_batch', 'batch'], 0),
  yieldPercent: getFirstValue(row, ['yieldPercent', 'yield_percent', 'yield', 'averageYield', 'average_yield'], 0),
  rejectPercent: getFirstValue(row, ['rejectPercent', 'reject_percent', 'rejectRate', 'reject_rate'], 0),
  rejectQty: getFirstValue(row, ['rejectQty', 'reject_qty', 'totalReject', 'total_reject'], 0),
  status: row.status || row.productionStatus || row.production_status || 'MONITOR',
  raw: row,
});

const normalizeLineRow = (row = {}, index = 0) => ({
  id: row.id || row.line_id || row.lineId || `PRODUCTION-LINE-${index + 1}`,
  line: getFirstString(row, ['line', 'line_name', 'lineName', 'name', 'label'], `Line ${index + 1}`),
  output: getFirstValue(row, ['output', 'totalOutput', 'total_output', 'outputQty', 'output_qty'], 0),
  efficiency: getFirstValue(row, ['efficiency', 'efficiencyPercent', 'efficiency_percent', 'productionEfficiency', 'production_efficiency'], 0),
  status: row.status || row.lineStatus || row.line_status || 'MONITOR',
  raw: row,
});

const normalizeBranchRow = (row = {}, index = 0) => ({
  id: row.id || row.branch_id || row.branchId || `PRODUCTION-BRANCH-${index + 1}`,
  branchName: getFirstString(row, ['branch_name', 'branchName', 'name', 'branch', 'label'], `Cabang ${index + 1}`),
  totalProduction: getFirstValue(row, ['totalProduction', 'total_production', 'productionQty', 'production_qty'], 0),
  totalBatch: getFirstValue(row, ['totalBatch', 'total_batch', 'batchCount', 'batch_count'], 0),
  totalOutput: getFirstValue(row, ['totalOutput', 'total_output', 'outputQty', 'output_qty'], 0),
  efficiency: getFirstValue(row, ['efficiency', 'efficiencyPercent', 'efficiency_percent', 'productionEfficiency', 'production_efficiency'], 0),
  status: row.status || row.branchStatus || row.branch_status || 'MONITOR',
  raw: row,
});

const normalizeRiskRow = (row = {}, index = 0) => ({
  id: row.id || row.code || row.reference_number || `PRODUCTION-RISK-${index + 1}`,
  severity: row.severity || row.priority || row.level || row.status || 'INFO',
  title: row.title || row.name || row.code || 'Production Risk',
  message: row.message || row.description || row.notes || '',
  recommendation: row.recommendation || row.action_hint || row.actionHint || '',
  amount: row.amount || row.value || row.rejectQty || row.reject_qty || 0,
  raw: row,
});

const normalizeInsightRow = (row = {}, index = 0) => ({
  id: row.id || row.code || row.reference_number || `PRODUCTION-INSIGHT-${index + 1}`,
  severity: row.severity || row.priority || row.level || row.status || 'INFO',
  title: row.title || row.name || row.code || 'Production Insight',
  message: row.message || row.description || row.notes || '',
  recommendation: row.recommendation || row.action_hint || row.actionHint || '',
  raw: row,
});

const getProductProductionRows = (productionAnalytics = {}, productAnalytics = {}) => {
  const rows = [
    ...safeArray(productionAnalytics.productProductionAnalytics || productionAnalytics.product_production_analytics),
    ...safeArray(productionAnalytics.topProductionProducts || productionAnalytics.top_production_products),
    ...safeArray(productionAnalytics.productionByProduct || productionAnalytics.production_by_product),
    ...safeArray(productionAnalytics.productRanking || productionAnalytics.product_ranking),
    ...safeArray(productAnalytics.productionProducts || productAnalytics.production_products),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeProductProductionRow(row, index));
};

const getProductionLineRows = (productionAnalytics = {}) => {
  const rows = [
    ...safeArray(productionAnalytics.productionLineAnalytics || productionAnalytics.production_line_analytics),
    ...safeArray(productionAnalytics.lineAnalytics || productionAnalytics.line_analytics),
    ...safeArray(productionAnalytics.productionLines || productionAnalytics.production_lines),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeLineRow(row, index));
};

const getBranchProductionRows = (productionAnalytics = {}, branchAnalytics = {}) => {
  const rows = [
    ...safeArray(productionAnalytics.branchProductionComparison || productionAnalytics.branch_production_comparison),
    ...safeArray(productionAnalytics.branchProductionAnalytics || productionAnalytics.branch_production_analytics),
    ...safeArray(productionAnalytics.productionByBranch || productionAnalytics.production_by_branch),
    ...safeArray(branchAnalytics.productionComparison || branchAnalytics.production_comparison),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeBranchRow(row, index));
};

const getProductionRiskRows = (radarResult = {}) => {
  const rows = [
    ...safeArray(radarResult.productionRadar),
    ...safeArray(radarResult.riskCards),
    ...safeArray(radarResult.ownerActionCenter),
    ...safeArray(radarResult.records),
  ];

  return rows.slice(0, 8).map((row, index) => normalizeRiskRow(row, index));
};

const getProductionInsightRows = (ownerResult = {}, radarResult = {}) => {
  const productionAnalytics = safeObject(ownerResult.productionAnalytics);

  const rows = [
    ...safeArray(productionAnalytics.insights || productionAnalytics.productionInsights || productionAnalytics.production_insights),
    ...safeArray(productionAnalytics.warningCards || productionAnalytics.warning_cards),
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

const ProductionKpiCard = ({ title, value, icon, tone = 'white', isPercent = false }) => {
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

const ProductionCard = ({ title, subtitle, icon, children }) => (
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
      Production Analytics Dashboard hanya bisa diakses oleh OWNER, DEWA, MONITOR_DEWA, atau HO_TANGERANG.
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
          Gagal memuat Production Analytics Dashboard.
        </div>
        <p className="mt-1 text-sm font-bold leading-relaxed text-red-700">
          {message || 'Terjadi kesalahan saat membaca ERP Production Command Center.'}
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

const ProductionPerformanceSection = ({ productionAnalytics, summary }) => {
  const productionTrend = getFirstStringFrom(
    [productionAnalytics, summary],
    ['productionTrend', 'production_trend', 'productionTrendSummary', 'production_trend_summary'],
    '',
  );

  const batchTrend = getFirstStringFrom(
    [productionAnalytics, summary],
    ['batchTrend', 'batch_trend', 'batchTrendSummary', 'batch_trend_summary'],
    '',
  );

  const efficiencySummary = getFirstStringFrom(
    [productionAnalytics, summary],
    ['efficiencySummary', 'efficiency_summary', 'productionEfficiencySummary', 'production_efficiency_summary', 'trendSummary', 'trend_summary'],
    '',
  );

  return (
    <ProductionCard
      title="Production Performance"
      subtitle="Production Trend, Batch Trend, dan Efficiency Summary dari orchestrator."
      icon={<BarChart3 size={17} className="text-red-600" />}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-500">
            <TrendingUp size={13} />
            Production Trend
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-emerald-800">
            {productionTrend || 'Production trend belum tersedia dari orchestrator.'}
          </p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-blue-500">
            <ClipboardList size={13} />
            Batch Trend
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-blue-800">
            {batchTrend || 'Batch trend belum tersedia dari orchestrator.'}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-500">
            <Gauge size={13} />
            Efficiency Summary
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-amber-800">
            {efficiencySummary || 'Efficiency summary belum tersedia dari orchestrator.'}
          </p>
        </div>
      </div>
    </ProductionCard>
  );
};

const ProductProductionAnalyticsSection = ({ rows }) => (
  <ProductionCard
    title="Product Production Analytics"
    subtitle="Top produk yang paling banyak diproduksi dari orchestrator."
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
              Qty Produksi
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Batch
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Yield %
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Reject %
            </th>
            <th className="px-5 py-4 text-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Status
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-5 py-8 text-center text-sm font-bold text-slate-400">
                Product production analytics belum tersedia dari orchestrator.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-5 py-4 text-sm font-black text-slate-900">
                  {row.productName}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-slate-900">
                  {formatNumber(row.qtyProduction)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-slate-900">
                  {formatNumber(row.batchCount)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-emerald-700">
                  {formatPercent(row.yieldPercent)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-red-700">
                  {formatPercent(row.rejectPercent)}
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
  </ProductionCard>
);

const ProductionLineAnalyticsSection = ({ rows }) => (
  <ProductionCard
    title="Production Line Analytics"
    subtitle="Line, Output, Efficiency, dan Status jika tersedia dari orchestrator."
    icon={<Activity size={17} className="text-red-600" />}
  >
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.length === 0 ? (
        <EmptyMiniState text="Production line analytics belum tersedia dari orchestrator." />
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-950">
                  {row.line}
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-400">
                  Production Line
                </div>
              </div>

              <StatusBadge status={row.status} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Output
                </div>
                <div className="mt-1 text-sm font-black text-slate-950">
                  {formatNumber(row.output)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Efficiency
                </div>
                <div className="mt-1 text-sm font-black text-emerald-700">
                  {formatPercent(row.efficiency)}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  </ProductionCard>
);

const ProductionQualitySection = ({ productionAnalytics, summary }) => {
  const rejectQty = getFirstValueFrom(
    [productionAnalytics, summary],
    ['rejectQty', 'reject_qty', 'totalReject', 'total_reject'],
    0,
  );

  const rejectRate = getFirstValueFrom(
    [productionAnalytics, summary],
    ['rejectRate', 'reject_rate', 'rejectPercent', 'reject_percent'],
    0,
  );

  const yieldValue = getFirstValueFrom(
    [productionAnalytics, summary],
    ['yield', 'yieldPercent', 'yield_percent', 'averageYield', 'average_yield'],
    0,
  );

  const qualitySummary = getFirstStringFrom(
    [productionAnalytics, summary],
    ['qualitySummary', 'quality_summary', 'productionQualitySummary', 'production_quality_summary'],
    '',
  );

  return (
    <ProductionCard
      title="Production Quality Analytics"
      subtitle="Reject Qty, Reject Rate, Yield, dan Quality Summary dari orchestrator."
      icon={<Gauge size={17} className="text-red-600" />}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">
            Reject Qty
          </div>
          <div className="mt-1 text-2xl font-black text-red-700">
            {formatNumber(rejectQty)}
          </div>
        </div>

        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-400">
            Reject Rate
          </div>
          <div className="mt-1 text-2xl font-black text-orange-700">
            {formatPercent(rejectRate)}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-500">
            Yield
          </div>
          <div className="mt-1 text-2xl font-black text-emerald-700">
            {formatPercent(yieldValue)}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-950 p-4 text-white">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          Quality Summary
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-200">
          {qualitySummary || 'Quality summary belum tersedia dari orchestrator.'}
        </p>
      </div>
    </ProductionCard>
  );
};

const BranchProductionComparisonSection = ({ rows }) => (
  <ProductionCard
    title="Branch Production Comparison"
    subtitle="Perbandingan performa produksi antar cabang dari orchestrator."
    icon={<Building2 size={17} className="text-red-600" />}
  >
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {rows.length === 0 ? (
        <EmptyMiniState text="Branch production comparison belum tersedia dari orchestrator." />
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
                  Branch Production
                </div>
              </div>

              <StatusBadge status={row.status} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Produksi
                </div>
                <div className="mt-1 text-sm font-black text-slate-950">
                  {formatNumber(row.totalProduction)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Batch
                </div>
                <div className="mt-1 text-sm font-black text-slate-950">
                  {formatNumber(row.totalBatch)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Output
                </div>
                <div className="mt-1 text-sm font-black text-emerald-700">
                  {formatNumber(row.totalOutput)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Efficiency
                </div>
                <div className="mt-1 text-sm font-black text-blue-700">
                  {formatPercent(row.efficiency)}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  </ProductionCard>
);

const ProductionRiskPanel = ({ rows }) => (
  <ProductionCard
    title="Production Risk Panel"
    subtitle="Risk berasal dari erpOrchestrator.getBusinessRadar()."
    icon={<ShieldAlert size={17} className="text-red-600" />}
  >
    <div className="max-h-[620px] space-y-3 overflow-y-auto">
      {rows.length === 0 ? (
        <EmptyMiniState text="Production risk belum tersedia dari orchestrator." />
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
                  {formatNumber(row.amount)}
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
  </ProductionCard>
);

const ProductionInsightPanel = ({ rows }) => (
  <ProductionCard
    title="Production Insight Panel"
    subtitle="Insight hanya berasal dari orchestrator."
    icon={<Activity size={17} className="text-red-600" />}
  >
    <div className="max-h-[620px] space-y-3 overflow-y-auto">
      {rows.length === 0 ? (
        <EmptyMiniState text="Production insight belum tersedia dari orchestrator." />
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
  </ProductionCard>
);

function TabProductionAnalyticsDashboard(props = {}) {
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
    dashboard: 'PRODUCTION_ANALYTICS',
    includeProductionAnalytics: true,
    includeProductAnalytics: true,
    includeBranchAnalytics: true,
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
          error: error?.message || 'Gagal memuat Production Analytics Dashboard.',
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
  const productionAnalytics = ownerResult.productionAnalytics;
  const productAnalytics = ownerResult.productAnalytics;
  const branchAnalytics = ownerResult.branchAnalytics;

  const totalProduksi = getFirstValueFrom(
    [productionAnalytics, summary],
    ['totalProduksi', 'total_produksi', 'totalProduction', 'total_production', 'productionCount', 'production_count'],
    0,
  );

  const totalBatchProduksi = getFirstValueFrom(
    [productionAnalytics, summary],
    ['totalBatchProduksi', 'total_batch_produksi', 'totalBatchProduction', 'total_batch_production', 'totalBatch', 'total_batch', 'batchCount', 'batch_count'],
    0,
  );

  const totalOutputProduksi = getFirstValueFrom(
    [productionAnalytics, summary],
    ['totalOutputProduksi', 'total_output_produksi', 'totalOutputProduction', 'total_output_production', 'totalOutput', 'total_output'],
    0,
  );

  const totalReject = getFirstValueFrom(
    [productionAnalytics, summary],
    ['totalReject', 'total_reject', 'rejectQty', 'reject_qty'],
    0,
  );

  const averageYield = getFirstValueFrom(
    [productionAnalytics, summary],
    ['averageYield', 'average_yield', 'yield', 'yieldPercent', 'yield_percent'],
    0,
  );

  const productionEfficiency = getFirstValueFrom(
    [productionAnalytics, summary],
    ['productionEfficiency', 'production_efficiency', 'efficiency', 'efficiencyPercent', 'efficiency_percent'],
    0,
  );

  const productionGrowth = getFirstValueFrom(
    [productionAnalytics, summary],
    ['productionGrowth', 'production_growth', 'growth', 'growthPercent', 'growth_percent'],
    0,
  );

  const productProductionRows = getProductProductionRows(productionAnalytics, productAnalytics);
  const productionLineRows = getProductionLineRows(productionAnalytics);
  const branchProductionRows = getBranchProductionRows(productionAnalytics, branchAnalytics);
  const productionRiskRows = getProductionRiskRows(radarResult);
  const productionInsightRows = getProductionInsightRows(ownerResult, radarResult);

  const bestPerformingProduct = getFirstStringFrom(
    [productionAnalytics, summary],
    ['bestPerformingProduct', 'best_performing_product', 'bestProduct', 'best_product', 'topProduct', 'top_product'],
    productProductionRows[0]?.productName || '-',
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
                <Boxes size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                ERP Production Command Center
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              PRODUCTION ANALYTICS DASHBOARD
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Owner Production Command Center untuk memantau produksi, batch, output, reject, yield, efficiency, quality, branch comparison, risk, dan insight dari orchestrator.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                OWNER PRODUCTION COMMAND CENTER
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
            REFRESH PRODUCTION DASHBOARD
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
            <ProductionKpiCard title="Total Produksi" value={totalProduksi} icon={<Boxes size={18} />} tone="red" />
            <ProductionKpiCard title="Total Batch Produksi" value={totalBatchProduksi} icon={<ClipboardList size={18} />} tone="green" />
            <ProductionKpiCard title="Total Output Produksi" value={totalOutputProduksi} icon={<TrendingUp size={18} />} tone="blue" />
            <ProductionKpiCard title="Total Reject" value={totalReject} icon={<TrendingDown size={18} />} tone="orange" />
            <ProductionKpiCard title="Average Yield" value={averageYield} icon={<Gauge size={18} />} tone="amber" isPercent />
            <ProductionKpiCard title="Production Efficiency" value={productionEfficiency} icon={<Activity size={18} />} tone="white" isPercent />
            <ProductionKpiCard title="Best Performing Product" value={bestPerformingProduct} icon={<Crown size={18} />} tone="white" />
            <ProductionKpiCard title="Production Growth" value={productionGrowth} icon={<Award size={18} />} tone="white" isPercent />
          </div>

          <ProductionPerformanceSection
            productionAnalytics={productionAnalytics}
            summary={summary}
          />

          <ProductProductionAnalyticsSection rows={productProductionRows} />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-6">
              <ProductionLineAnalyticsSection rows={productionLineRows} />
            </div>

            <div className="xl:col-span-6">
              <ProductionQualitySection
                productionAnalytics={productionAnalytics}
                summary={summary}
              />
            </div>
          </section>

          <BranchProductionComparisonSection rows={branchProductionRows} />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-6">
              <ProductionRiskPanel rows={productionRiskRows} />
            </div>

            <div className="xl:col-span-6">
              <ProductionInsightPanel rows={productionInsightRows} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default TabProductionAnalyticsDashboard;
