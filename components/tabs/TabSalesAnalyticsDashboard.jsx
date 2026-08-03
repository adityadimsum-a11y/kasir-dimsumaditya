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
  Users,
} from 'lucide-react';

import erpOrchestrator from '../../utils/erpOrchestrator';

const EMPTY_OBJECT = Object.freeze({});

const REQUIRED_CHANNELS = [
  'OFFLINE',
  'GOFOOD',
  'GRABFOOD',
  'SHOPEEFOOD',
  'TIKTOK',
  'RESELLER',
];

const DEFAULT_OWNER_RESULT = {
  summary: {},
  salesAnalytics: {},
  customerAnalytics: {},
  productAnalytics: {},
  branchAnalytics: {},
  warningCards: [],
  warnings: [],
  metadata: {},
};

const DEFAULT_RADAR_RESULT = {
  summary: {},
  records: [],
  salesRadar: [],
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
    salesAnalytics: safeObject(source.salesAnalytics || source.sales_analytics),
    customerAnalytics: safeObject(source.customerAnalytics || source.customer_analytics),
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
    salesRadar: safeArray(source.salesRadar || source.sales_radar),
    riskCards: safeArray(source.riskCards || source.risk_cards),
    ownerActionCenter: safeArray(source.ownerActionCenter || source.owner_action_center),
    recommendations: safeArray(source.recommendations),
    warnings: safeArray(source.warnings),
    metadata: safeObject(source.metadata),
  };
};

const normalizeChannelRow = (row = {}, index = 0) => ({
  id: row.id || row.channel || row.sales_channel || `CHANNEL-${index + 1}`,
  channel: normalizeCode(row.channel || row.sales_channel || row.salesChannel || row.name || row.label || `CHANNEL_${index + 1}`),
  revenue: getFirstValue(row, ['revenue', 'totalRevenue', 'total_revenue', 'omzet'], 0),
  orderCount: getFirstValue(row, ['orderCount', 'order_count', 'totalOrder', 'total_order', 'transactionCount', 'transaction_count'], 0),
  contribution: getFirstValue(row, ['contribution', 'contributionPercent', 'contribution_percent', 'share', 'sharePercent', 'share_percent'], 0),
  status: row.status || row.trendStatus || row.trend_status || 'MONITOR',
  raw: row,
});

const normalizeProductRow = (row = {}, index = 0) => ({
  id: row.id || row.product_id || row.productId || `PRODUCT-${index + 1}`,
  name: getFirstString(row, ['product_name', 'productName', 'name', 'product', 'label'], `Produk ${index + 1}`),
  revenue: getFirstValue(row, ['revenue', 'totalRevenue', 'total_revenue', 'productRevenue', 'product_revenue', 'omzet'], 0),
  qty: getFirstValue(row, ['qtySold', 'qty_sold', 'quantitySold', 'quantity_sold', 'totalQty', 'total_qty'], 0),
  margin: getFirstValue(row, ['profitMargin', 'profit_margin', 'margin', 'marginPercent', 'margin_percent'], 0),
  status: row.status || row.salesStatus || row.sales_status || 'MONITOR',
  raw: row,
});

const normalizeCustomerRow = (row = {}, index = 0) => ({
  id: row.id || row.customer_id || row.customerId || `CUSTOMER-${index + 1}`,
  name: getFirstString(row, ['customer_name', 'customerName', 'name', 'customer', 'label'], `Customer ${index + 1}`),
  revenue: getFirstValue(row, ['revenue', 'totalRevenue', 'total_revenue', 'customerRevenue', 'customer_revenue', 'omzet'], 0),
  orderCount: getFirstValue(row, ['orderCount', 'order_count', 'totalOrder', 'total_order', 'transactionCount', 'transaction_count'], 0),
  averageOrderValue: getFirstValue(row, ['averageOrderValue', 'average_order_value', 'avgOrderValue', 'avg_order_value', 'aov'], 0),
  status: row.status || row.customerStatus || row.customer_status || 'MONITOR',
  raw: row,
});

const normalizeBranchRow = (row = {}, index = 0) => ({
  id: row.id || row.branch_id || row.branchId || `BRANCH-${index + 1}`,
  name: getFirstString(row, ['branch_name', 'branchName', 'name', 'branch', 'label'], `Cabang ${index + 1}`),
  revenue: getFirstValue(row, ['revenue', 'totalRevenue', 'total_revenue', 'branchRevenue', 'branch_revenue', 'omzet'], 0),
  orderCount: getFirstValue(row, ['orderCount', 'order_count', 'totalOrder', 'total_order', 'transactionCount', 'transaction_count'], 0),
  growth: getFirstValue(row, ['growth', 'growthPercent', 'growth_percent', 'salesGrowth', 'sales_growth'], 0),
  status: row.status || row.branchStatus || row.branch_status || 'MONITOR',
  raw: row,
});

const normalizeRiskRow = (row = {}, index = 0) => ({
  id: row.id || row.code || row.reference_number || `SALES-RISK-${index + 1}`,
  severity: row.severity || row.priority || row.level || row.status || 'INFO',
  title: row.title || row.name || row.code || 'Sales Risk',
  message: row.message || row.description || row.notes || '',
  recommendation: row.recommendation || row.action_hint || row.actionHint || '',
  amount: row.amount || row.value || 0,
  raw: row,
});

const normalizeInsightRow = (row = {}, index = 0) => ({
  id: row.id || row.code || row.reference_number || `SALES-INSIGHT-${index + 1}`,
  severity: row.severity || row.priority || row.level || row.status || 'INFO',
  title: row.title || row.name || row.code || 'Sales Insight',
  message: row.message || row.description || row.notes || '',
  recommendation: row.recommendation || row.action_hint || row.actionHint || '',
  raw: row,
});

const getChannelRows = (salesAnalytics = {}) => {
  const sourceRows = [
    ...safeArray(salesAnalytics.channelAnalytics || salesAnalytics.channel_analytics),
    ...safeArray(salesAnalytics.salesChannelAnalytics || salesAnalytics.sales_channel_analytics),
    ...safeArray(salesAnalytics.channelPerformance || salesAnalytics.channel_performance),
  ];

  const channelMap = new Map();

  sourceRows.forEach((row, index) => {
    const normalized = normalizeChannelRow(row, index);
    if (!normalized.channel) return;
    channelMap.set(normalized.channel, normalized);
  });

  return REQUIRED_CHANNELS.map((channel) => (
    channelMap.get(channel) || {
      id: `CHANNEL-${channel}`,
      channel,
      revenue: 0,
      orderCount: 0,
      contribution: 0,
      status: 'MONITOR',
      raw: {},
    }
  ));
};

const getTopProductRows = (salesAnalytics = {}, productAnalytics = {}) => {
  const rows = [
    ...safeArray(salesAnalytics.topProductSales || salesAnalytics.top_product_sales),
    ...safeArray(salesAnalytics.topProducts || salesAnalytics.top_products),
    ...safeArray(salesAnalytics.topProductRevenue || salesAnalytics.top_product_revenue),
    ...safeArray(salesAnalytics.bestSellerProducts || salesAnalytics.best_seller_products),
    ...safeArray(productAnalytics.topProducts || productAnalytics.top_products),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeProductRow(row, index));
};

const getTopCustomerRows = (salesAnalytics = {}, customerAnalytics = {}) => {
  const rows = [
    ...safeArray(salesAnalytics.topCustomerSales || salesAnalytics.top_customer_sales),
    ...safeArray(salesAnalytics.topCustomers || salesAnalytics.top_customers),
    ...safeArray(salesAnalytics.topCustomerRevenue || salesAnalytics.top_customer_revenue),
    ...safeArray(customerAnalytics.topCustomers || customerAnalytics.top_customers),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeCustomerRow(row, index));
};

const getBranchSalesRows = (salesAnalytics = {}, branchAnalytics = {}) => {
  const rows = [
    ...safeArray(salesAnalytics.branchSalesComparison || salesAnalytics.branch_sales_comparison),
    ...safeArray(salesAnalytics.branchSalesAnalytics || salesAnalytics.branch_sales_analytics),
    ...safeArray(salesAnalytics.branchPerformance || salesAnalytics.branch_performance),
    ...safeArray(branchAnalytics.branchComparison || branchAnalytics.branch_comparison),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeBranchRow(row, index));
};

const getSalesRiskRows = (radarResult = {}) => {
  const rows = [
    ...safeArray(radarResult.salesRadar),
    ...safeArray(radarResult.riskCards),
    ...safeArray(radarResult.ownerActionCenter),
    ...safeArray(radarResult.records),
  ];

  return rows.slice(0, 8).map((row, index) => normalizeRiskRow(row, index));
};

const getSalesInsightRows = (ownerResult = {}, radarResult = {}) => {
  const salesAnalytics = safeObject(ownerResult.salesAnalytics);

  const rows = [
    ...safeArray(salesAnalytics.insights || salesAnalytics.salesInsights || salesAnalytics.sales_insights),
    ...safeArray(salesAnalytics.warningCards || salesAnalytics.warning_cards),
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

const SalesKpiCard = ({ title, value, icon, tone = 'white', isMoney = true, isPercent = false }) => {
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

const SalesCard = ({ title, subtitle, icon, children }) => (
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
      Sales Analytics Dashboard hanya bisa diakses oleh OWNER, DEWA, MONITOR_DEWA, atau HO_TANGERANG.
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
          Gagal memuat Sales Analytics Dashboard.
        </div>
        <p className="mt-1 text-sm font-bold leading-relaxed text-red-700">
          {message || 'Terjadi kesalahan saat membaca ERP Sales Command Center.'}
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

const SalesPerformanceSection = ({ salesAnalytics, summary }) => {
  const revenueTrend = getFirstStringFrom(
    [salesAnalytics, summary],
    ['revenueTrend', 'revenue_trend', 'revenueTrendSummary', 'revenue_trend_summary'],
    '',
  );

  const orderTrend = getFirstStringFrom(
    [salesAnalytics, summary],
    ['orderTrend', 'order_trend', 'orderTrendSummary', 'order_trend_summary'],
    '',
  );

  const growthSummary = getFirstStringFrom(
    [salesAnalytics, summary],
    ['growthSummary', 'growth_summary', 'salesGrowthSummary', 'sales_growth_summary', 'trendSummary', 'trend_summary'],
    '',
  );

  return (
    <SalesCard
      title="Sales Performance"
      subtitle="Revenue Trend, Order Trend, dan Growth Summary dari orchestrator."
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
            <ShoppingBag size={13} />
            Order Trend
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-blue-800">
            {orderTrend || 'Order trend belum tersedia dari orchestrator.'}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-500">
            <Gauge size={13} />
            Growth Summary
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-amber-800">
            {growthSummary || 'Growth summary belum tersedia dari orchestrator.'}
          </p>
        </div>
      </div>
    </SalesCard>
  );
};

const ChannelAnalyticsSection = ({ rows }) => (
  <SalesCard
    title="Channel Analytics"
    subtitle="Revenue, Order Count, dan Contribution % per channel dari orchestrator."
    icon={<Activity size={17} className="text-red-600" />}
  >
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                {normalizeCode(row.status || 'MONITOR')}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-3 text-red-600 shadow-sm">
              <ShoppingBag size={18} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
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
                Order Count
              </div>
              <div className="mt-1 text-sm font-black text-slate-950">
                {formatNumber(row.orderCount)}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                Contribution
              </div>
              <div className="mt-1 text-sm font-black text-blue-700">
                {formatPercent(row.contribution)}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </SalesCard>
);

const TopProductSalesSection = ({ rows }) => (
  <SalesCard
    title="Top Product Sales"
    subtitle="Top produk berdasarkan revenue dan qty dari orchestrator."
    icon={<Package size={17} className="text-red-600" />}
  >
    <div className="max-h-[560px] space-y-3 overflow-y-auto">
      {rows.length === 0 ? (
        <EmptyMiniState text="Top product sales belum tersedia dari orchestrator." />
      ) : (
        rows.map((row, index) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {index === 0 && <Crown size={15} className="text-amber-500" />}
                <div className="truncate text-sm font-black text-slate-900">
                  {row.name}
                </div>
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-500">
                Qty {formatNumber(row.qty)} · Margin {formatPercent(row.margin)}
              </div>
            </div>

            <div className="text-right text-sm font-black text-emerald-700">
              {formatMoney(row.revenue)}
            </div>
          </div>
        ))
      )}
    </div>
  </SalesCard>
);

const TopCustomerSalesSection = ({ rows }) => (
  <SalesCard
    title="Top Customer Sales"
    subtitle="Customer terbaik berdasarkan omzet dari orchestrator."
    icon={<Users size={17} className="text-red-600" />}
  >
    <div className="max-h-[560px] space-y-3 overflow-y-auto">
      {rows.length === 0 ? (
        <EmptyMiniState text="Top customer sales belum tersedia dari orchestrator." />
      ) : (
        rows.map((row, index) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {index === 0 && <Award size={15} className="text-amber-500" />}
                <div className="truncate text-sm font-black text-slate-900">
                  {row.name}
                </div>
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-500">
                Order {formatNumber(row.orderCount)} · AOV {formatMoney(row.averageOrderValue)}
              </div>
            </div>

            <div className="text-right text-sm font-black text-emerald-700">
              {formatMoney(row.revenue)}
            </div>
          </div>
        ))
      )}
    </div>
  </SalesCard>
);

const BranchSalesComparisonSection = ({ rows }) => (
  <SalesCard
    title="Branch Sales Comparison"
    subtitle="Perbandingan performa cabang dari orchestrator."
    icon={<Building2 size={17} className="text-red-600" />}
  >
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {rows.length === 0 ? (
        <EmptyMiniState text="Branch sales comparison belum tersedia dari orchestrator." />
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-950">
                  {row.name}
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-400">
                  {normalizeCode(row.status || 'MONITOR')}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3 text-red-600 shadow-sm">
                <Building2 size={18} />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
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
                  Order
                </div>
                <div className="mt-1 text-sm font-black text-slate-950">
                  {formatNumber(row.orderCount)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Growth
                </div>
                <div className="mt-1 text-sm font-black text-blue-700">
                  {formatPercent(row.growth)}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  </SalesCard>
);

const SalesRiskPanel = ({ rows }) => (
  <SalesCard
    title="Sales Risk Panel"
    subtitle="Risk berasal dari erpOrchestrator.getBusinessRadar()."
    icon={<ShieldAlert size={17} className="text-red-600" />}
  >
    <div className="max-h-[620px] space-y-3 overflow-y-auto">
      {rows.length === 0 ? (
        <EmptyMiniState text="Sales risk belum tersedia dari orchestrator." />
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
  </SalesCard>
);

const SalesInsightPanel = ({ rows }) => (
  <SalesCard
    title="Sales Insight Panel"
    subtitle="Insight hanya berasal dari orchestrator."
    icon={<Activity size={17} className="text-red-600" />}
  >
    <div className="max-h-[620px] space-y-3 overflow-y-auto">
      {rows.length === 0 ? (
        <EmptyMiniState text="Sales insight belum tersedia dari orchestrator." />
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
  </SalesCard>
);

function TabSalesAnalyticsDashboard(props = {}) {
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
    dashboard: 'SALES_ANALYTICS',
    includeSalesAnalytics: true,
    includeCustomerAnalytics: true,
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
          error: error?.message || 'Gagal memuat Sales Analytics Dashboard.',
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
  const salesAnalytics = ownerResult.salesAnalytics;
  const customerAnalytics = ownerResult.customerAnalytics;
  const productAnalytics = ownerResult.productAnalytics;
  const branchAnalytics = ownerResult.branchAnalytics;

  const totalSales = getFirstValueFrom(
    [salesAnalytics, summary],
    ['totalSales', 'total_sales', 'salesCount', 'sales_count'],
    0,
  );

  const totalRevenue = getFirstValueFrom(
    [salesAnalytics, summary],
    ['totalRevenue', 'total_revenue', 'revenue', 'omzet'],
    0,
  );

  const averageOrderValue = getFirstValueFrom(
    [salesAnalytics, summary],
    ['averageOrderValue', 'average_order_value', 'avgOrderValue', 'avg_order_value', 'aov'],
    0,
  );

  const totalOrder = getFirstValueFrom(
    [salesAnalytics, summary],
    ['totalOrder', 'total_order', 'orderCount', 'order_count', 'transactionCount', 'transaction_count'],
    0,
  );

  const salesGrowth = getFirstValueFrom(
    [salesAnalytics, summary],
    ['salesGrowth', 'sales_growth', 'growth', 'growthPercent', 'growth_percent'],
    0,
  );

  const channelRows = getChannelRows(salesAnalytics);
  const topProductRows = getTopProductRows(salesAnalytics, productAnalytics);
  const topCustomerRows = getTopCustomerRows(salesAnalytics, customerAnalytics);
  const branchSalesRows = getBranchSalesRows(salesAnalytics, branchAnalytics);
  const salesRiskRows = getSalesRiskRows(radarResult);
  const salesInsightRows = getSalesInsightRows(ownerResult, radarResult);

  const bestChannel = getFirstStringFrom(
    [salesAnalytics, summary],
    ['bestChannel', 'best_channel', 'topChannel', 'top_channel'],
    channelRows.find((row) => safeNumber(row.revenue, 0) !== 0)?.channel || '-',
  );

  const bestBranch = getFirstStringFrom(
    [salesAnalytics, summary],
    ['bestBranch', 'best_branch', 'topBranch', 'top_branch'],
    branchSalesRows[0]?.name || '-',
  );

  const bestProduct = getFirstStringFrom(
    [salesAnalytics, summary],
    ['bestProduct', 'best_product', 'topProduct', 'top_product'],
    topProductRows[0]?.name || '-',
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
                <ShoppingBag size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                ERP Sales Command Center
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              SALES ANALYTICS DASHBOARD
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Owner Sales Command Center untuk memantau sales, revenue, channel, product, customer, branch comparison, risk, dan insight dari orchestrator.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                OWNER SALES COMMAND CENTER
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
            REFRESH SALES DASHBOARD
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
            <SalesKpiCard title="Total Sales" value={formatNumber(totalSales)} icon={<ShoppingBag size={18} />} tone="red" isMoney={false} />
            <SalesKpiCard title="Total Revenue" value={totalRevenue} icon={<DollarSign size={18} />} tone="green" />
            <SalesKpiCard title="Average Order Value" value={averageOrderValue} icon={<Gauge size={18} />} tone="blue" />
            <SalesKpiCard title="Total Order" value={formatNumber(totalOrder)} icon={<BarChart3 size={18} />} tone="amber" isMoney={false} />
            <SalesKpiCard title="Best Channel" value={bestChannel} icon={<Activity size={18} />} tone="white" isMoney={false} />
            <SalesKpiCard title="Best Branch" value={bestBranch} icon={<Building2 size={18} />} tone="white" isMoney={false} />
            <SalesKpiCard title="Best Product" value={bestProduct} icon={<Package size={18} />} tone="white" isMoney={false} />
            <SalesKpiCard title="Sales Growth" value={salesGrowth} icon={<TrendingUp size={18} />} tone="orange" isMoney={false} isPercent />
          </div>

          <SalesPerformanceSection
            salesAnalytics={salesAnalytics}
            summary={summary}
          />

          <ChannelAnalyticsSection rows={channelRows} />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-6">
              <TopProductSalesSection rows={topProductRows} />
            </div>

            <div className="xl:col-span-6">
              <TopCustomerSalesSection rows={topCustomerRows} />
            </div>
          </section>

          <BranchSalesComparisonSection rows={branchSalesRows} />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-6">
              <SalesRiskPanel rows={salesRiskRows} />
            </div>

            <div className="xl:col-span-6">
              <SalesInsightPanel rows={salesInsightRows} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default TabSalesAnalyticsDashboard;
