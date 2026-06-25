import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  Clock3,
  Crown,
  DollarSign,
  Eye,
  FileText,
  Filter,
  Gauge,
  Layers,
  LockKeyhole,
  Package,
  RefreshCw,
  Search,
  Tag,
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

const CATEGORY_OPTIONS = [
  'ALL',
  'DIMSUM',
  'MINUMAN',
  'SNACK',
  'ADDON',
  'FROZEN',
  'LAINNYA',
];

const REQUIRED_CATEGORIES = [
  'DIMSUM',
  'MINUMAN',
  'SNACK',
  'ADDON',
  'FROZEN',
  'LAINNYA',
];

const DEFAULT_SUMMARY = {
  totalProduct: 0,
  totalProducts: 0,
  productCount: 0,
  activeProduct: 0,
  activeProducts: 0,
  activeProductCount: 0,
  totalRevenueProduct: 0,
  productRevenue: 0,
  totalProductRevenue: 0,
  totalProfitProduct: 0,
  productProfit: 0,
  totalProductProfit: 0,
};

const DEFAULT_PRODUCT_ANALYTICS = {
  productRanking: [],
  bestSellerProducts: [],
  topProducts: [],
  topProductRevenue: [],
  highestMarginProducts: [],
  topMarginProducts: [],
  slowMovingProducts: [],
  inactiveProducts: [],
  productCategoryAnalytics: [],
  categoryAnalytics: [],
  warningCards: [],
  highRiskProducts: [],
};

const DEFAULT_RESULT = {
  summary: DEFAULT_SUMMARY,
  productAnalytics: DEFAULT_PRODUCT_ANALYTICS,
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
  const productAnalytics = safeObject(source.productAnalytics);

  return {
    ...DEFAULT_RESULT,
    ...source,
    summary: {
      ...DEFAULT_SUMMARY,
      ...safeObject(source.summary),
    },
    productAnalytics: {
      ...DEFAULT_PRODUCT_ANALYTICS,
      ...productAnalytics,
      productRanking: safeArray(productAnalytics.productRanking || productAnalytics.product_ranking || productAnalytics.ranking),
      bestSellerProducts: safeArray(productAnalytics.bestSellerProducts || productAnalytics.best_seller_products),
      topProducts: safeArray(productAnalytics.topProducts || productAnalytics.top_products),
      topProductRevenue: safeArray(productAnalytics.topProductRevenue || productAnalytics.top_product_revenue),
      highestMarginProducts: safeArray(productAnalytics.highestMarginProducts || productAnalytics.highest_margin_products),
      topMarginProducts: safeArray(productAnalytics.topMarginProducts || productAnalytics.top_margin_products),
      slowMovingProducts: safeArray(productAnalytics.slowMovingProducts || productAnalytics.slow_moving_products),
      inactiveProducts: safeArray(productAnalytics.inactiveProducts || productAnalytics.inactive_products),
      productCategoryAnalytics: safeArray(productAnalytics.productCategoryAnalytics || productAnalytics.product_category_analytics),
      categoryAnalytics: safeArray(productAnalytics.categoryAnalytics || productAnalytics.category_analytics),
      warningCards: safeArray(productAnalytics.warningCards || productAnalytics.warning_cards),
      highRiskProducts: safeArray(productAnalytics.highRiskProducts || productAnalytics.high_risk_products),
    },
    warningCards: safeArray(source.warningCards),
    warnings: safeArray(source.warnings),
    metadata: safeObject(source.metadata),
  };
};

const getSummaryValue = (summary = {}, productAnalytics = {}, keys = []) => {
  for (const key of keys) {
    if (summary[key] !== undefined && summary[key] !== null && summary[key] !== '') {
      return summary[key];
    }

    if (productAnalytics[key] !== undefined && productAnalytics[key] !== null && productAnalytics[key] !== '') {
      return productAnalytics[key];
    }
  }

  return 0;
};

const normalizeProductRow = (row = {}, index = 0) => {
  const productId = String(row.product_id || row.productId || row.id || row.product || '').trim();
  const productName = String(
    row.product_name ||
    row.productName ||
    row.name ||
    row.product ||
    row.label ||
    productId ||
    `Produk ${index + 1}`,
  ).trim();

  return {
    id: productId || `PRODUCT-${index + 1}`,
    rank: row.rank || row.ranking || index + 1,
    product_id: productId,
    product_name: productName,
    category: normalizeCode(row.product_category || row.productCategory || row.category || row.type || 'LAINNYA'),
    branch: row.branch || row.branch_name || row.branchName || row.branch_id || row.branchId || '',
    qtySold: row.qtySold ?? row.qty_sold ?? row.quantitySold ?? row.quantity_sold ?? row.totalQty ?? row.total_qty ?? 0,
    revenue: row.totalRevenue ?? row.total_revenue ?? row.revenue ?? row.omzet ?? 0,
    profit: row.totalProfit ?? row.total_profit ?? row.netProfit ?? row.net_profit ?? row.grossProfit ?? row.gross_profit ?? 0,
    margin: row.profitMargin ?? row.profit_margin ?? row.margin ?? row.marginPercent ?? row.margin_percent ?? 0,
    hpp: row.hpp ?? row.totalHpp ?? row.total_hpp ?? row.cogs ?? row.cost ?? 0,
    lastSoldDate: row.lastSoldDate || row.last_sold_date || row.lastSalesDate || row.last_sales_date || row.lastOrderDate || row.last_order_date || '',
    daysUnsold: row.daysUnsold ?? row.days_unsold ?? row.daysNotSold ?? row.days_not_sold ?? row.inactiveDays ?? row.inactive_days ?? 0,
    stockQty: row.stockQty ?? row.stock_qty ?? row.currentStock ?? row.current_stock ?? row.stock ?? 0,
    status: row.status || row.productStatus || row.product_status || '',
    metadata: safeObject(row.metadata || row.meta || row),
    raw: row,
  };
};

const getProductRankingRows = (productAnalytics = {}) => {
  const explicitRows = safeArray(
    productAnalytics.productRanking ||
    productAnalytics.product_ranking ||
    productAnalytics.ranking ||
    productAnalytics.rankings,
  );

  const sourceRows = explicitRows.length > 0
    ? explicitRows
    : safeArray(productAnalytics.bestSellerProducts);

  return sourceRows.map((row, index) => normalizeProductRow(row, index));
};

const getBestSellerRows = (productAnalytics = {}) => {
  const sourceRows = [
    ...safeArray(productAnalytics.bestSellerProducts),
    ...safeArray(productAnalytics.topProducts),
    ...safeArray(productAnalytics.topProductRevenue),
  ];

  const finalRows = sourceRows.length > 0
    ? sourceRows
    : safeArray(productAnalytics.productRanking);

  return finalRows.slice(0, 10).map((row, index) => normalizeProductRow(row, index));
};

const getHighestMarginRows = (productAnalytics = {}) => {
  const sourceRows = [
    ...safeArray(productAnalytics.highestMarginProducts),
    ...safeArray(productAnalytics.topMarginProducts),
  ];

  return sourceRows.map((row, index) => normalizeProductRow(row, index));
};

const getSlowMovingRows = (productAnalytics = {}) => {
  const sourceRows = [
    ...safeArray(productAnalytics.slowMovingProducts),
    ...safeArray(productAnalytics.inactiveProducts),
  ];

  return sourceRows.map((row, index) => normalizeProductRow(row, index));
};

const getCategoryRows = (productAnalytics = {}) => {
  const explicitRows = [
    ...safeArray(productAnalytics.productCategoryAnalytics),
    ...safeArray(productAnalytics.categoryAnalytics),
  ];

  const categoryMap = new Map();

  explicitRows.forEach((row) => {
    const category = normalizeCode(row.category || row.product_category || row.productCategory || row.type || row.name || '');
    if (!category) return;

    categoryMap.set(category, {
      category,
      productCount: row.productCount ?? row.product_count ?? row.totalProduct ?? row.total_product ?? row.count ?? 0,
      revenue: row.revenue ?? row.totalRevenue ?? row.total_revenue ?? row.omzet ?? 0,
      profit: row.profit ?? row.totalProfit ?? row.total_profit ?? row.netProfit ?? row.net_profit ?? 0,
      metadata: safeObject(row.metadata || row.meta || row),
      raw: row,
    });
  });

  return REQUIRED_CATEGORIES.map((category) => {
    const row = categoryMap.get(category);

    return row || {
      category,
      productCount: 0,
      revenue: 0,
      profit: 0,
      metadata: {},
      raw: {},
    };
  });
};

const getWarningRows = (result = {}) => {
  const rows = [
    ...safeArray(result.warningCards),
    ...safeArray(result.warnings),
    ...safeArray(result.productAnalytics?.warningCards),
    ...safeArray(result.productAnalytics?.highRiskProducts),
  ];

  return rows.map((row, index) => ({
    id: row.id || row.code || row.product_id || row.productId || `PRODUCT-WARNING-${index + 1}`,
    severity: row.severity || row.priority || row.level || row.riskStatus || 'INFO',
    title: row.title || row.product_name || row.productName || row.message || row.code || 'Product Warning',
    message: row.message || row.description || row.notes || '',
    actionHint: row.action_hint || row.actionHint || row.recommendation || '',
    amount: row.amount || row.value || row.lossAmount || row.loss_amount || 0,
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

const SeverityBadge = ({ severity }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getSeverityTone(severity)}`}>
    {normalizeCode(severity || 'INFO')}
  </span>
);

const CategoryBadge = ({ category }) => (
  <span className="inline-flex items-center rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
    {normalizeCode(category || 'LAINNYA')}
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
      Product Analytics Dashboard hanya bisa diakses oleh OWNER atau DEWA.
    </p>
  </div>
);

const EmptyState = () => (
  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-8 text-center shadow-sm">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
      <Package size={24} />
    </div>
    <div className="mt-4 text-lg font-black text-amber-900">
      Tidak ada data product analytics.
    </div>
    <p className="mx-auto mt-2 max-w-xl text-sm font-bold leading-relaxed text-amber-700">
      Tidak ada analytics produk dari orchestrator untuk filter yang sedang aktif.
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
          Gagal memuat Product Analytics Dashboard.
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
              Product Analytics Detail
            </div>
            <p className="mt-1 text-xs font-bold text-slate-400">
              Detail analytics produk dari ERP Owner Analytics. Read only.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
            aria-label="Close product detail"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {item.type || 'PRODUCT_ANALYTICS'}
              </span>
              <CategoryBadge category={item.category} />
            </div>

            <h2 className="mt-4 text-xl font-black text-slate-950">
              {item.product_name || item.title || 'Product Detail'}
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Qty Sold
                </div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  {formatNumber(item.qtySold)}
                </div>
              </div>

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

const ProductRankingTable = ({ rows, onSelect }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
      <div>
        <div className="flex items-center gap-2 text-sm font-black text-slate-900">
          <BarChart3 size={17} className="text-red-600" />
          Product Ranking
        </div>
        <p className="mt-1 text-[11px] font-semibold text-slate-400">
          Urutan ranking mengikuti data dari orchestrator.
        </p>
      </div>

      <span className="rounded-full border border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {formatNumber(rows.length)} product
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
              Nama Produk
            </th>
            <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Category
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Qty Sold
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
              Detail
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-5 py-8 text-center text-sm font-bold text-slate-400">
                Product ranking belum tersedia dari orchestrator.
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
                    {row.product_name}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-400">
                    {row.branch || '-'}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <CategoryBadge category={row.category} />
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-slate-900">
                  {formatNumber(row.qtySold)}
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
                  <button
                    type="button"
                    onClick={() => onSelect({
                      ...row,
                      type: 'PRODUCT_RANKING',
                    })}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
                    aria-label={`Detail ${row.product_name}`}
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

const BestSellerPanel = ({ rows, onSelect }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
        <Award size={17} className="text-red-600" />
        Best Seller Product
      </div>
      <p className="mt-1 text-[11px] font-semibold text-slate-400">
        Top 10 produk terlaris dari orchestrator.
      </p>
    </div>

    <div className="max-h-[680px] space-y-3 overflow-y-auto p-5">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm font-bold leading-relaxed text-amber-700">
          Best seller product belum tersedia.
        </div>
      ) : (
        rows.map((row) => (
          <button
            key={`BEST-${row.id}-${row.rank}`}
            type="button"
            onClick={() => onSelect({
              ...row,
              type: 'BEST_SELLER_PRODUCT',
            })}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition-all hover:border-red-100 hover:bg-red-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Crown size={16} className="text-amber-500" />
                  <div className="text-sm font-black text-slate-900">
                    {row.product_name}
                  </div>
                </div>
                <div className="mt-2 text-xs font-semibold text-slate-500">
                  Qty {formatNumber(row.qtySold)} · Revenue {formatMoney(row.revenue)}
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

const HighestMarginPanel = ({ rows, onSelect }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
        <TrendingUp size={17} className="text-red-600" />
        Highest Margin Product
      </div>
      <p className="mt-1 text-[11px] font-semibold text-slate-400">
        Produk dengan margin tertinggi dari orchestrator.
      </p>
    </div>

    <div className="max-h-[680px] space-y-3 overflow-y-auto p-5">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm font-bold leading-relaxed text-amber-700">
          Highest margin product belum tersedia.
        </div>
      ) : (
        rows.map((row) => (
          <button
            key={`MARGIN-${row.id}-${row.rank}`}
            type="button"
            onClick={() => onSelect({
              ...row,
              type: 'HIGHEST_MARGIN_PRODUCT',
            })}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition-all hover:border-red-100 hover:bg-red-50"
          >
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={row.category} />
              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">
                Margin {formatPercent(row.margin)}
              </span>
            </div>

            <div className="mt-3 text-sm font-black text-slate-900">
              {row.product_name}
            </div>

            <div className="mt-2 text-xs font-semibold text-slate-500">
              Profit {formatMoney(row.profit)} · HPP {formatMoney(row.hpp)}
            </div>
          </button>
        ))
      )}
    </div>
  </div>
);

const SlowMovingPanel = ({ rows, onSelect }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
        <TrendingDown size={17} className="text-red-600" />
        Slow Moving Product
      </div>
      <p className="mt-1 text-[11px] font-semibold text-slate-400">
        Produk yang jarang terjual dari orchestrator.
      </p>
    </div>

    <div className="max-h-[680px] space-y-3 overflow-y-auto p-5">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold leading-relaxed text-emerald-700">
          Tidak ada slow moving product dari orchestrator.
        </div>
      ) : (
        rows.map((row) => (
          <button
            key={`SLOW-${row.id}-${row.rank}`}
            type="button"
            onClick={() => onSelect({
              ...row,
              type: 'SLOW_MOVING_PRODUCT',
            })}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition-all hover:border-red-100 hover:bg-red-50"
          >
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={row.category} />
              <span className="rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-red-700">
                {formatNumber(row.daysUnsold)} hari tidak terjual
              </span>
            </div>

            <div className="mt-3 text-sm font-black text-slate-900">
              {row.product_name}
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Clock3 size={13} />
              Last sold {formatDateLabel(row.lastSoldDate)} · Qty {formatNumber(row.qtySold)}
            </div>
          </button>
        ))
      )}
    </div>
  </div>
);

const CategoryAnalyticsPanel = ({ rows, onSelect }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
      <div>
        <div className="flex items-center gap-2 text-sm font-black text-slate-900">
          <Layers size={17} className="text-red-600" />
          Product Category Analytics
        </div>
        <p className="mt-1 text-[11px] font-semibold text-slate-400">
          Category analytics berasal dari orchestrator.
        </p>
      </div>

      <span className="rounded-full border border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {formatNumber(rows.length)} category
      </span>
    </div>

    <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <button
          key={`CATEGORY-${row.category}`}
          type="button"
          onClick={() => onSelect({
            ...row,
            product_name: row.category,
            category: row.category,
            type: 'PRODUCT_CATEGORY_ANALYTICS',
            qtySold: row.productCount,
            revenue: row.revenue,
            profit: row.profit,
            raw: row.raw,
          })}
          className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-left transition-all hover:border-red-100 hover:bg-red-50"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <CategoryBadge category={row.category} />
              <div className="mt-3 text-sm font-black text-slate-950">
                {row.category}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-3 text-red-600 shadow-sm">
              <Boxes size={18} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <div className="rounded-2xl bg-white p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                Jumlah Produk
              </div>
              <div className="mt-1 text-sm font-black text-slate-950">
                {formatNumber(row.productCount)}
              </div>
            </div>

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
              <div className="mt-1 text-sm font-black text-blue-700">
                {formatMoney(row.profit)}
              </div>
            </div>
          </div>
        </button>
      ))}
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
        Warning produk berasal dari orchestrator.
      </p>
    </div>

    <div className="max-h-[680px] space-y-3 overflow-y-auto p-5">
      {warnings.length === 0 ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold leading-relaxed text-emerald-700">
          Tidak ada warning produk dari orchestrator.
        </div>
      ) : (
        warnings.map((warning) => (
          <button
            key={warning.id}
            type="button"
            onClick={() => onSelect({
              ...warning,
              product_name: warning.title,
              type: 'PRODUCT_WARNING',
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

function TabProductAnalyticsDashboard(props = {}) {
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
    product: '',
    category: 'ALL',
    branch: '',
    period: 'THIS_MONTH',
    search: '',
  });

  const [appliedFilters, setAppliedFilters] = useState({
    product: '',
    category: 'ALL',
    branch: '',
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
    product: appliedFilters.product,
    product_id: appliedFilters.product,
    category: appliedFilters.category === 'ALL' ? '' : appliedFilters.category,
    branch: appliedFilters.branch,
    branch_id: appliedFilters.branch,
    period: appliedFilters.period,
    search: appliedFilters.search,
    readonly: true,
  }), [
    appliedFilters.branch,
    appliedFilters.category,
    appliedFilters.period,
    appliedFilters.product,
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
          error: error?.message || 'Gagal memuat Product Analytics Dashboard.',
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
  const productAnalytics = result.productAnalytics;

  const rankingRows = getProductRankingRows(productAnalytics);
  const bestSellerRows = getBestSellerRows(productAnalytics);
  const highestMarginRows = getHighestMarginRows(productAnalytics);
  const slowMovingRows = getSlowMovingRows(productAnalytics);
  const categoryRows = getCategoryRows(productAnalytics);
  const warningRows = getWarningRows(result);

  const totalProduct = getSummaryValue(summary, productAnalytics, [
    'totalProduct',
    'totalProducts',
    'productCount',
    'product_count',
  ]);

  const activeProduct = getSummaryValue(summary, productAnalytics, [
    'activeProduct',
    'activeProducts',
    'activeProductCount',
    'active_product_count',
  ]);

  const totalRevenueProduct = getSummaryValue(summary, productAnalytics, [
    'totalRevenueProduct',
    'productRevenue',
    'totalProductRevenue',
    'total_product_revenue',
    'totalRevenue',
    'total_revenue',
  ]);

  const totalProfitProduct = getSummaryValue(summary, productAnalytics, [
    'totalProfitProduct',
    'productProfit',
    'totalProductProfit',
    'total_product_profit',
    'totalProfit',
    'total_profit',
  ]);

  const bestSellerProduct = bestSellerRows[0]?.product_name || '-';
  const highestMarginProduct = highestMarginRows[0]?.product_name || '-';

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
      product: '',
      category: 'ALL',
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
                <Package size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                ERP Product Intelligence Layer
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              PRODUCT ANALYTICS DASHBOARD
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Enterprise Product Intelligence Dashboard untuk Owner. Semua analytics berasal dari erpOrchestrator.getOwnerAnalytics().
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
        <KpiCard title="Total Product" value={formatNumber(totalProduct)} icon={<Package size={18} />} tone="red" />
        <KpiCard title="Active Product" value={formatNumber(activeProduct)} icon={<CheckCircle2 size={18} />} tone="green" />
        <KpiCard title="Total Revenue Product" value={totalRevenueProduct} icon={<DollarSign size={18} />} tone="blue" isMoney />
        <KpiCard title="Total Profit Product" value={totalProfitProduct} icon={<Activity size={18} />} tone="amber" isMoney />
        <KpiCard title="Best Seller Product" value={bestSellerProduct} icon={<Crown size={18} />} tone="white" />
        <KpiCard title="Highest Margin Product" value={highestMarginProduct} icon={<Gauge size={18} />} tone="orange" />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <Filter size={17} className="text-red-600" />
              Filter Product Analytics
            </div>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">
              Filter dikirim ke orchestrator. UI tidak menghitung ranking produk sendiri.
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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              <Package size={12} />
              Product
            </span>
            <input
              type="text"
              value={filters.product}
              onChange={(event) => handleFilterChange('product', event.target.value)}
              placeholder="Produk"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
            />
          </label>

          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              <Tag size={12} />
              Category
            </span>
            <select
              value={filters.category}
              onChange={(event) => handleFilterChange('category', event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
            >
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

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
              placeholder="Cari produk"
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
      ) : rankingRows.length === 0 && bestSellerRows.length === 0 && highestMarginRows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <ProductRankingTable
            rows={rankingRows}
            onSelect={setSelectedItem}
          />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-4">
              <BestSellerPanel
                rows={bestSellerRows}
                onSelect={setSelectedItem}
              />
            </div>

            <div className="xl:col-span-4">
              <HighestMarginPanel
                rows={highestMarginRows}
                onSelect={setSelectedItem}
              />
            </div>

            <div className="xl:col-span-4">
              <SlowMovingPanel
                rows={slowMovingRows}
                onSelect={setSelectedItem}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <CategoryAnalyticsPanel
                rows={categoryRows}
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

export default TabProductAnalyticsDashboard;
