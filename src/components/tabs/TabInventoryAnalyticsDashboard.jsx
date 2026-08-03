import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  Boxes,
  CheckCircle2,
  Clock3,
  Crown,
  DollarSign,
  Eye,
  FileText,
  Filter,
  Gauge,
  LockKeyhole,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
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

const DEFAULT_SUMMARY = {
  totalSku: 0,
  totalSKU: 0,
  totalProductSku: 0,
  skuCount: 0,
  activeSku: 0,
  activeSKU: 0,
  activeProductSku: 0,
  activeSkuCount: 0,
  totalInventoryValue: 0,
  inventoryValue: 0,
  totalStockValue: 0,
};

const DEFAULT_INVENTORY_ANALYTICS = {
  inventoryRanking: [],
  stockRanking: [],
  fastMovingProducts: [],
  fastMovingItems: [],
  slowMovingProducts: [],
  slowMovingItems: [],
  criticalStockProducts: [],
  criticalStockItems: [],
  lowStockProducts: [],
  inventoryComparisonAnalytics: [],
  inventoryComparison: [],
  warningCards: [],
  highRiskInventory: [],
  anomalyProducts: [],
  fastMovingProduct: null,
  slowMovingProduct: null,
  criticalStockProduct: null,
};

const DEFAULT_RESULT = {
  summary: DEFAULT_SUMMARY,
  inventoryAnalytics: DEFAULT_INVENTORY_ANALYTICS,
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

  return ['OWNER', 'DEWA'].includes(role);
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
  const inventoryAnalytics = safeObject(source.inventoryAnalytics);

  return {
    ...DEFAULT_RESULT,
    ...source,
    summary: {
      ...DEFAULT_SUMMARY,
      ...safeObject(source.summary),
    },
    inventoryAnalytics: {
      ...DEFAULT_INVENTORY_ANALYTICS,
      ...inventoryAnalytics,
      inventoryRanking: safeArray(inventoryAnalytics.inventoryRanking || inventoryAnalytics.inventory_ranking || inventoryAnalytics.ranking),
      stockRanking: safeArray(inventoryAnalytics.stockRanking || inventoryAnalytics.stock_ranking),
      fastMovingProducts: safeArray(inventoryAnalytics.fastMovingProducts || inventoryAnalytics.fast_moving_products),
      fastMovingItems: safeArray(inventoryAnalytics.fastMovingItems || inventoryAnalytics.fast_moving_items),
      slowMovingProducts: safeArray(inventoryAnalytics.slowMovingProducts || inventoryAnalytics.slow_moving_products),
      slowMovingItems: safeArray(inventoryAnalytics.slowMovingItems || inventoryAnalytics.slow_moving_items),
      criticalStockProducts: safeArray(inventoryAnalytics.criticalStockProducts || inventoryAnalytics.critical_stock_products),
      criticalStockItems: safeArray(inventoryAnalytics.criticalStockItems || inventoryAnalytics.critical_stock_items),
      lowStockProducts: safeArray(inventoryAnalytics.lowStockProducts || inventoryAnalytics.low_stock_products),
      inventoryComparisonAnalytics: safeArray(inventoryAnalytics.inventoryComparisonAnalytics || inventoryAnalytics.inventory_comparison_analytics),
      inventoryComparison: safeArray(inventoryAnalytics.inventoryComparison || inventoryAnalytics.inventory_comparison),
      warningCards: safeArray(inventoryAnalytics.warningCards || inventoryAnalytics.warning_cards),
      highRiskInventory: safeArray(inventoryAnalytics.highRiskInventory || inventoryAnalytics.high_risk_inventory),
      anomalyProducts: safeArray(inventoryAnalytics.anomalyProducts || inventoryAnalytics.anomaly_products),
      fastMovingProduct: inventoryAnalytics.fastMovingProduct || inventoryAnalytics.fast_moving_product || null,
      slowMovingProduct: inventoryAnalytics.slowMovingProduct || inventoryAnalytics.slow_moving_product || null,
      criticalStockProduct: inventoryAnalytics.criticalStockProduct || inventoryAnalytics.critical_stock_product || null,
    },
    warningCards: safeArray(source.warningCards),
    warnings: safeArray(source.warnings),
    metadata: safeObject(source.metadata),
  };
};

const getSummaryValue = (summary = {}, inventoryAnalytics = {}, keys = []) => {
  for (const key of keys) {
    if (summary[key] !== undefined && summary[key] !== null && summary[key] !== '') {
      return summary[key];
    }

    if (inventoryAnalytics[key] !== undefined && inventoryAnalytics[key] !== null && inventoryAnalytics[key] !== '') {
      return inventoryAnalytics[key];
    }
  }

  return 0;
};

const normalizeInventoryRow = (row = {}, index = 0) => {
  const productId = String(row.product_id || row.productId || row.item_id || row.itemId || row.id || row.product || '').trim();
  const productName = String(
    row.product_name ||
    row.productName ||
    row.item_name ||
    row.itemName ||
    row.name ||
    row.product ||
    row.label ||
    productId ||
    `Produk ${index + 1}`,
  ).trim();

  return {
    id: productId || `INVENTORY-${index + 1}`,
    rank: row.rank || row.ranking || index + 1,
    product_id: productId,
    product_name: productName,
    sku: row.sku || row.SKU || row.product_sku || row.productSku || row.item_sku || row.itemSku || productId || '-',
    category: normalizeCode(row.category || row.product_category || row.productCategory || row.type || 'LAINNYA'),
    currentStock: row.currentStock ?? row.current_stock ?? row.stock ?? row.stockQty ?? row.stock_qty ?? row.qty ?? 0,
    inventoryValue: row.inventoryValue ?? row.inventory_value ?? row.stockValue ?? row.stock_value ?? row.totalValue ?? row.total_value ?? 0,
    movementCount: row.movementCount ?? row.movement_count ?? row.totalMovement ?? row.total_movement ?? row.transactionCount ?? row.transaction_count ?? 0,
    daysCover: row.daysCover ?? row.days_cover ?? row.stockCoverDays ?? row.stock_cover_days ?? 0,
    lastMovementDate: row.lastMovementDate || row.last_movement_date || row.lastStockMovementDate || row.last_stock_movement_date || row.lastTransactionDate || row.last_transaction_date || '',
    lastSoldDate: row.lastSoldDate || row.last_sold_date || row.lastSalesDate || row.last_sales_date || '',
    daysNoMovement: row.daysNoMovement ?? row.days_no_movement ?? row.daysNotMoving ?? row.days_not_moving ?? row.inactiveDays ?? row.inactive_days ?? 0,
    minimumStock: row.minimumStock ?? row.minimum_stock ?? row.minStock ?? row.min_stock ?? row.reorderPoint ?? row.reorder_point ?? 0,
    maximumStock: row.maximumStock ?? row.maximum_stock ?? row.maxStock ?? row.max_stock ?? 0,
    status: row.status || row.stockStatus || row.stock_status || row.inventoryStatus || row.inventory_status || '',
    metadata: safeObject(row.metadata || row.meta || row),
    raw: row,
  };
};

const normalizeNamedProduct = (value) => {
  if (!value) return '-';
  if (typeof value === 'string') return value;

  const row = normalizeInventoryRow(value);
  return row.product_name || '-';
};

const getInventoryRankingRows = (inventoryAnalytics = {}) => {
  const explicitRows = safeArray(
    inventoryAnalytics.inventoryRanking ||
    inventoryAnalytics.inventory_ranking ||
    inventoryAnalytics.ranking ||
    inventoryAnalytics.stockRanking,
  );

  return explicitRows.map((row, index) => normalizeInventoryRow(row, index));
};

const getFastMovingRows = (inventoryAnalytics = {}) => {
  const sourceRows = [
    ...safeArray(inventoryAnalytics.fastMovingProducts),
    ...safeArray(inventoryAnalytics.fastMovingItems),
  ];

  return sourceRows.map((row, index) => normalizeInventoryRow(row, index));
};

const getSlowMovingRows = (inventoryAnalytics = {}) => {
  const sourceRows = [
    ...safeArray(inventoryAnalytics.slowMovingProducts),
    ...safeArray(inventoryAnalytics.slowMovingItems),
  ];

  return sourceRows.map((row, index) => normalizeInventoryRow(row, index));
};

const getCriticalStockRows = (inventoryAnalytics = {}) => {
  const sourceRows = [
    ...safeArray(inventoryAnalytics.criticalStockProducts),
    ...safeArray(inventoryAnalytics.criticalStockItems),
    ...safeArray(inventoryAnalytics.lowStockProducts),
  ];

  return sourceRows.map((row, index) => normalizeInventoryRow(row, index));
};

const getComparisonRows = (inventoryAnalytics = {}) => {
  const explicitRows = [
    ...safeArray(inventoryAnalytics.inventoryComparisonAnalytics),
    ...safeArray(inventoryAnalytics.inventoryComparison),
  ];

  const finalRows = explicitRows.length > 0
    ? explicitRows
    : safeArray(inventoryAnalytics.inventoryRanking);

  return finalRows.map((row, index) => normalizeInventoryRow(row, index));
};

const getWarningRows = (result = {}) => {
  const rows = [
    ...safeArray(result.warningCards),
    ...safeArray(result.warnings),
    ...safeArray(result.inventoryAnalytics?.warningCards),
    ...safeArray(result.inventoryAnalytics?.highRiskInventory),
    ...safeArray(result.inventoryAnalytics?.anomalyProducts),
  ];

  return rows.map((row, index) => ({
    id: row.id || row.code || row.product_id || row.productId || row.sku || `INVENTORY-WARNING-${index + 1}`,
    severity: row.severity || row.priority || row.level || row.riskStatus || 'INFO',
    title: row.title || row.product_name || row.productName || row.sku || row.message || row.code || 'Inventory Warning',
    message: row.message || row.description || row.notes || '',
    actionHint: row.action_hint || row.actionHint || row.recommendation || '',
    amount: row.amount || row.value || row.inventoryValue || row.inventory_value || 0,
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
    STOCK_ANOMALY: 'border-red-200 bg-red-50 text-red-700',
    NEGATIVE_STOCK: 'border-red-200 bg-red-50 text-red-700',
  };

  return toneMap[normalized] || 'border-slate-200 bg-slate-50 text-slate-600';
};

const getStatusTone = (status) => {
  const normalized = normalizeCode(status || 'MONITOR');

  const toneMap = {
    ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    GOOD: 'border-blue-200 bg-blue-50 text-blue-700',
    HEALTHY: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    FAST_MOVING: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    WARNING: 'border-amber-200 bg-amber-50 text-amber-700',
    SLOW_MOVING: 'border-amber-200 bg-amber-50 text-amber-700',
    OVERSTOCK: 'border-orange-200 bg-orange-50 text-orange-700',
    CRITICAL: 'border-red-200 bg-red-50 text-red-700',
    LOW_STOCK: 'border-red-200 bg-red-50 text-red-700',
    NEGATIVE_STOCK: 'border-red-200 bg-red-50 text-red-700',
    DEAD_STOCK: 'border-red-200 bg-red-50 text-red-700',
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
      Inventory Analytics Dashboard hanya bisa diakses oleh OWNER atau DEWA.
    </p>
  </div>
);

const EmptyState = () => (
  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-8 text-center shadow-sm">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
      <Boxes size={24} />
    </div>
    <div className="mt-4 text-lg font-black text-amber-900">
      Tidak ada data inventory analytics.
    </div>
    <p className="mx-auto mt-2 max-w-xl text-sm font-bold leading-relaxed text-amber-700">
      Tidak ada analytics inventory dari orchestrator untuk filter yang sedang aktif.
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
          Gagal memuat Inventory Analytics Dashboard.
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
              Inventory Analytics Detail
            </div>
            <p className="mt-1 text-xs font-bold text-slate-400">
              Detail analytics inventory dari ERP Owner Analytics. Read only.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
            aria-label="Close inventory detail"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {item.type || 'INVENTORY_ANALYTICS'}
              </span>
              <CategoryBadge category={item.category} />
              <StatusBadge status={item.status || 'MONITOR'} />
            </div>

            <h2 className="mt-4 text-xl font-black text-slate-950">
              {item.product_name || item.title || 'Inventory Detail'}
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Current Stock
                </div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  {formatNumber(item.currentStock)}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Inventory Value
                </div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  {formatMoney(item.inventoryValue)}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Movement Count
                </div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  {formatNumber(item.movementCount)}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Days Cover
                </div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  {formatNumber(item.daysCover)}
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

const InventoryRankingTable = ({ rows, onSelect }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
      <div>
        <div className="flex items-center gap-2 text-sm font-black text-slate-900">
          <BarChart3 size={17} className="text-red-600" />
          Inventory Ranking
        </div>
        <p className="mt-1 text-[11px] font-semibold text-slate-400">
          Urutan ranking mengikuti data dari orchestrator.
        </p>
      </div>

      <span className="rounded-full border border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {formatNumber(rows.length)} SKU
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
              SKU
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Current Stock
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Inventory Value
            </th>
            <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Last Movement Date
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
                Inventory ranking belum tersedia dari orchestrator.
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
                    {row.product_id || '-'}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <CategoryBadge category={row.sku} />
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-slate-900">
                  {formatNumber(row.currentStock)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-emerald-700">
                  {formatMoney(row.inventoryValue)}
                </td>
                <td className="px-5 py-4 text-sm font-bold text-slate-600">
                  {formatDateLabel(row.lastMovementDate)}
                </td>
                <td className="px-5 py-4 text-center">
                  <button
                    type="button"
                    onClick={() => onSelect({
                      ...row,
                      type: 'INVENTORY_RANKING',
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

const FastMovingPanel = ({ rows, onSelect }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
        <TrendingUp size={17} className="text-red-600" />
        Fast Moving Product
      </div>
      <p className="mt-1 text-[11px] font-semibold text-slate-400">
        Produk terlaris / pergerakan tercepat dari orchestrator.
      </p>
    </div>

    <div className="max-h-[680px] space-y-3 overflow-y-auto p-5">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm font-bold leading-relaxed text-amber-700">
          Fast moving product belum tersedia.
        </div>
      ) : (
        rows.map((row) => (
          <button
            key={`FAST-${row.id}-${row.rank}`}
            type="button"
            onClick={() => onSelect({
              ...row,
              type: 'FAST_MOVING_PRODUCT',
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
                  Movement {formatNumber(row.movementCount)} · Stock {formatNumber(row.currentStock)}
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

const SlowMovingPanel = ({ rows, onSelect }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
        <TrendingDown size={17} className="text-red-600" />
        Slow Moving Product
      </div>
      <p className="mt-1 text-[11px] font-semibold text-slate-400">
        Produk lama tidak bergerak dari orchestrator.
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
              <StatusBadge status={row.status || 'SLOW_MOVING'} />
              <span className="rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-orange-700">
                {formatNumber(row.daysNoMovement)} hari
              </span>
            </div>

            <div className="mt-3 text-sm font-black text-slate-900">
              {row.product_name}
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Clock3 size={13} />
              Last movement {formatDateLabel(row.lastMovementDate)}
            </div>
          </button>
        ))
      )}
    </div>
  </div>
);

const CriticalStockPanel = ({ rows, onSelect }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
        <ShieldAlert size={17} className="text-red-600" />
        Critical Stock Product
      </div>
      <p className="mt-1 text-[11px] font-semibold text-slate-400">
        Produk stok kritis / hampir habis dari orchestrator.
      </p>
    </div>

    <div className="max-h-[680px] space-y-3 overflow-y-auto p-5">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold leading-relaxed text-emerald-700">
          Tidak ada critical stock product dari orchestrator.
        </div>
      ) : (
        rows.map((row) => (
          <button
            key={`CRITICAL-${row.id}-${row.rank}`}
            type="button"
            onClick={() => onSelect({
              ...row,
              type: 'CRITICAL_STOCK_PRODUCT',
            })}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition-all hover:border-red-100 hover:bg-red-50"
          >
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={row.status || 'CRITICAL'} />
              <span className="rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-red-700">
                Stock {formatNumber(row.currentStock)}
              </span>
            </div>

            <div className="mt-3 text-sm font-black text-slate-900">
              {row.product_name}
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-bold">
              <div className="rounded-xl bg-white p-3 text-slate-600">
                Min<br />
                <span className="text-slate-950">{formatNumber(row.minimumStock)}</span>
              </div>
              <div className="rounded-xl bg-white p-3 text-slate-600">
                Cover<br />
                <span className="text-slate-950">{formatNumber(row.daysCover)} hari</span>
              </div>
              <div className="rounded-xl bg-white p-3 text-slate-600">
                Value<br />
                <span className="text-slate-950">{formatMoney(row.inventoryValue)}</span>
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  </div>
);

const InventoryComparisonPanel = ({ rows, onSelect }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
      <div>
        <div className="flex items-center gap-2 text-sm font-black text-slate-900">
          <Gauge size={17} className="text-red-600" />
          Inventory Comparison Analytics
        </div>
        <p className="mt-1 text-[11px] font-semibold text-slate-400">
          Stock, Inventory Value, Movement Count, dan Days Cover berasal dari orchestrator.
        </p>
      </div>

      <span className="rounded-full border border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {formatNumber(rows.length)} rows
      </span>
    </div>

    <div className="grid grid-cols-1 gap-4 p-5 xl:grid-cols-2">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm font-bold leading-relaxed text-amber-700 xl:col-span-2">
          Inventory comparison analytics belum tersedia dari orchestrator.
        </div>
      ) : (
        rows.map((row) => (
          <button
            key={`COMPARE-${row.id}-${row.rank}`}
            type="button"
            onClick={() => onSelect({
              ...row,
              type: 'INVENTORY_COMPARISON_ANALYTICS',
            })}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-left transition-all hover:border-red-100 hover:bg-red-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-950">
                  {row.product_name}
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-400">
                  SKU {row.sku}
                </div>
              </div>

              <StatusBadge status={row.status || 'MONITOR'} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Stock
                </div>
                <div className="mt-1 text-sm font-black text-slate-950">
                  {formatNumber(row.currentStock)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Inventory Value
                </div>
                <div className="mt-1 text-sm font-black text-emerald-700">
                  {formatMoney(row.inventoryValue)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Movement Count
                </div>
                <div className="mt-1 text-sm font-black text-blue-700">
                  {formatNumber(row.movementCount)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Days Cover
                </div>
                <div className="mt-1 text-sm font-black text-red-700">
                  {formatNumber(row.daysCover)}
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
        Warning inventory berasal dari orchestrator.
      </p>
    </div>

    <div className="max-h-[680px] space-y-3 overflow-y-auto p-5">
      {warnings.length === 0 ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold leading-relaxed text-emerald-700">
          Tidak ada warning inventory dari orchestrator.
        </div>
      ) : (
        warnings.map((warning) => (
          <button
            key={warning.id}
            type="button"
            onClick={() => onSelect({
              ...warning,
              product_name: warning.title,
              type: 'INVENTORY_WARNING',
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

function TabInventoryAnalyticsDashboard(props = {}) {
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
    period: 'THIS_MONTH',
    search: '',
  });

  const [appliedFilters, setAppliedFilters] = useState({
    product: '',
    category: 'ALL',
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
    period: appliedFilters.period,
    search: appliedFilters.search,
    readonly: true,
  }), [
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
          error: error?.message || 'Gagal memuat Inventory Analytics Dashboard.',
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
  const inventoryAnalytics = result.inventoryAnalytics;

  const rankingRows = getInventoryRankingRows(inventoryAnalytics);
  const fastMovingRows = getFastMovingRows(inventoryAnalytics);
  const slowMovingRows = getSlowMovingRows(inventoryAnalytics);
  const criticalStockRows = getCriticalStockRows(inventoryAnalytics);
  const comparisonRows = getComparisonRows(inventoryAnalytics);
  const warningRows = getWarningRows(result);

  const totalSku = getSummaryValue(summary, inventoryAnalytics, [
    'totalSku',
    'totalSKU',
    'totalProductSku',
    'total_product_sku',
    'skuCount',
    'sku_count',
  ]);

  const activeSku = getSummaryValue(summary, inventoryAnalytics, [
    'activeSku',
    'activeSKU',
    'activeProductSku',
    'active_product_sku',
    'activeSkuCount',
    'active_sku_count',
  ]);

  const totalInventoryValue = getSummaryValue(summary, inventoryAnalytics, [
    'totalInventoryValue',
    'total_inventory_value',
    'inventoryValue',
    'inventory_value',
    'totalStockValue',
    'total_stock_value',
  ]);

  const fastMovingProduct = normalizeNamedProduct(inventoryAnalytics.fastMovingProduct) || fastMovingRows[0]?.product_name || '-';
  const slowMovingProduct = normalizeNamedProduct(inventoryAnalytics.slowMovingProduct) || slowMovingRows[0]?.product_name || '-';
  const criticalStockProduct = normalizeNamedProduct(inventoryAnalytics.criticalStockProduct) || criticalStockRows[0]?.product_name || '-';

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
                <Boxes size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                ERP Inventory Intelligence Layer
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              INVENTORY ANALYTICS DASHBOARD
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Enterprise Inventory Intelligence Dashboard untuk Owner. Semua analytics berasal dari erpOrchestrator.getOwnerAnalytics().
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
        <KpiCard title="Total SKU" value={formatNumber(totalSku)} icon={<Package size={18} />} tone="red" />
        <KpiCard title="Active SKU" value={formatNumber(activeSku)} icon={<CheckCircle2 size={18} />} tone="green" />
        <KpiCard title="Total Inventory Value" value={totalInventoryValue} icon={<DollarSign size={18} />} tone="blue" isMoney />
        <KpiCard title="Slow Moving Product" value={slowMovingProduct} icon={<TrendingDown size={18} />} tone="orange" />
        <KpiCard title="Fast Moving Product" value={fastMovingProduct} icon={<TrendingUp size={18} />} tone="white" />
        <KpiCard title="Critical Stock Product" value={criticalStockProduct} icon={<ShieldAlert size={18} />} tone="amber" />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <Filter size={17} className="text-red-600" />
              Filter Inventory Analytics
            </div>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">
              Filter dikirim ke orchestrator. UI tidak menghitung analytics inventory sendiri.
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
              <Boxes size={12} />
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
              placeholder="Cari inventory"
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
      ) : rankingRows.length === 0 && fastMovingRows.length === 0 && slowMovingRows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <InventoryRankingTable
            rows={rankingRows}
            onSelect={setSelectedItem}
          />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-4">
              <FastMovingPanel
                rows={fastMovingRows}
                onSelect={setSelectedItem}
              />
            </div>

            <div className="xl:col-span-4">
              <SlowMovingPanel
                rows={slowMovingRows}
                onSelect={setSelectedItem}
              />
            </div>

            <div className="xl:col-span-4">
              <CriticalStockPanel
                rows={criticalStockRows}
                onSelect={setSelectedItem}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <InventoryComparisonPanel
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

export default TabInventoryAnalyticsDashboard;
