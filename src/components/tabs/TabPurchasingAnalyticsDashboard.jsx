import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Building2,
  Clock3,
  Crown,
  DollarSign,
  FileText,
  Gauge,
  LockKeyhole,
  Package,
  RefreshCw,
  ShieldAlert,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
} from 'lucide-react';

import erpOrchestrator from '../../utils/erpOrchestrator';

const EMPTY_OBJECT = Object.freeze({});

const DEFAULT_OWNER_RESULT = {
  summary: {},
  purchasingAnalytics: {},
  purchaseAnalytics: {},
  supplierAnalytics: {},
  productAnalytics: {},
  branchAnalytics: {},
  warningCards: [],
  warnings: [],
  metadata: {},
};

const DEFAULT_RADAR_RESULT = {
  summary: {},
  records: [],
  purchasingRadar: [],
  purchaseRadar: [],
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
  const purchasingSource = safeObject(source.purchasingAnalytics || source.purchaseAnalytics || source.purchasing_analytics || source.purchase_analytics);

  return {
    ...DEFAULT_OWNER_RESULT,
    ...source,
    summary: safeObject(source.summary),
    purchasingAnalytics: purchasingSource,
    purchaseAnalytics: purchasingSource,
    supplierAnalytics: safeObject(source.supplierAnalytics || source.supplier_analytics),
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
    purchasingRadar: safeArray(source.purchasingRadar || source.purchasing_radar || source.purchaseRadar || source.purchase_radar),
    purchaseRadar: safeArray(source.purchaseRadar || source.purchase_radar || source.purchasingRadar || source.purchasing_radar),
    riskCards: safeArray(source.riskCards || source.risk_cards),
    ownerActionCenter: safeArray(source.ownerActionCenter || source.owner_action_center),
    recommendations: safeArray(source.recommendations),
    warnings: safeArray(source.warnings),
    metadata: safeObject(source.metadata),
  };
};

const normalizeSupplierRow = (row = {}, index = 0) => ({
  id: row.id || row.supplier_id || row.supplierId || `SUPPLIER-PURCHASE-${index + 1}`,
  supplierName: getFirstString(row, ['supplier_name', 'supplierName', 'name', 'supplier', 'label'], `Supplier ${index + 1}`),
  totalPurchase: getFirstValue(row, ['totalPurchase', 'total_purchase', 'purchaseValue', 'purchase_value', 'totalPurchaseValue', 'total_purchase_value'], 0),
  transactionCount: getFirstValue(row, ['transactionCount', 'transaction_count', 'totalTransaction', 'total_transaction', 'purchaseCount', 'purchase_count'], 0),
  averagePurchase: getFirstValue(row, ['averagePurchase', 'average_purchase', 'avgPurchase', 'avg_purchase', 'averagePurchaseValue', 'average_purchase_value'], 0),
  status: row.status || row.supplierStatus || row.supplier_status || 'MONITOR',
  raw: row,
});

const normalizeProductPurchaseRow = (row = {}, index = 0) => ({
  id: row.id || row.product_id || row.productId || row.item_id || row.itemId || `PRODUCT-PURCHASE-${index + 1}`,
  productName: getFirstString(row, ['product_name', 'productName', 'item_name', 'itemName', 'name', 'product', 'item', 'label'], `Produk/Bahan ${index + 1}`),
  qtyPurchase: getFirstValue(row, ['qtyPurchase', 'qty_purchase', 'purchaseQty', 'purchase_qty', 'quantity', 'qty'], 0),
  purchaseValue: getFirstValue(row, ['purchaseValue', 'purchase_value', 'totalPurchase', 'total_purchase', 'totalValue', 'total_value'], 0),
  supplier: getFirstString(row, ['supplier_name', 'supplierName', 'supplier', 'vendor', 'vendorName'], '-'),
  status: row.status || row.purchaseStatus || row.purchase_status || 'MONITOR',
  raw: row,
});

const normalizeOutstandingPoRow = (row = {}, index = 0) => ({
  id: row.id || row.po_number || row.poNumber || row.purchase_order_number || `OUTSTANDING-PO-${index + 1}`,
  poNumber: getFirstString(row, ['po_number', 'poNumber', 'purchase_order_number', 'purchaseOrderNumber', 'reference_number', 'referenceNumber'], `PO-${index + 1}`),
  supplier: getFirstString(row, ['supplier_name', 'supplierName', 'supplier', 'vendor', 'vendorName'], '-'),
  outstandingValue: getFirstValue(row, ['outstandingValue', 'outstanding_value', 'outstandingAmount', 'outstanding_amount', 'remainingValue', 'remaining_value'], 0),
  dueDate: row.dueDate || row.due_date || row.jatuhTempo || row.jatuh_tempo || row.deadline || '',
  status: row.status || row.poStatus || row.po_status || row.purchaseStatus || row.purchase_status || 'MONITOR',
  raw: row,
});

const normalizeBranchRow = (row = {}, index = 0) => ({
  id: row.id || row.branch_id || row.branchId || `BRANCH-PURCHASE-${index + 1}`,
  branchName: getFirstString(row, ['branch_name', 'branchName', 'name', 'branch', 'label'], `Cabang ${index + 1}`),
  totalPurchase: getFirstValue(row, ['totalPurchase', 'total_purchase', 'purchaseValue', 'purchase_value', 'totalPurchaseValue', 'total_purchase_value'], 0),
  purchaseOrderCount: getFirstValue(row, ['purchaseOrderCount', 'purchase_order_count', 'poCount', 'po_count', 'orderCount', 'order_count'], 0),
  supplierCount: getFirstValue(row, ['supplierCount', 'supplier_count', 'totalSupplier', 'total_supplier'], 0),
  growth: getFirstValue(row, ['growth', 'growthPercent', 'growth_percent', 'purchaseGrowth', 'purchase_growth'], 0),
  status: row.status || row.branchStatus || row.branch_status || 'MONITOR',
  raw: row,
});

const normalizeRiskRow = (row = {}, index = 0) => ({
  id: row.id || row.code || row.reference_number || `PURCHASING-RISK-${index + 1}`,
  severity: row.severity || row.priority || row.level || row.status || 'INFO',
  title: row.title || row.name || row.code || 'Purchasing Risk',
  message: row.message || row.description || row.notes || '',
  recommendation: row.recommendation || row.action_hint || row.actionHint || '',
  amount: row.amount || row.value || row.outstandingValue || row.outstanding_value || 0,
  raw: row,
});

const normalizeInsightRow = (row = {}, index = 0) => ({
  id: row.id || row.code || row.reference_number || `PURCHASING-INSIGHT-${index + 1}`,
  severity: row.severity || row.priority || row.level || row.status || 'INFO',
  title: row.title || row.name || row.code || 'Purchasing Insight',
  message: row.message || row.description || row.notes || '',
  recommendation: row.recommendation || row.action_hint || row.actionHint || '',
  raw: row,
});

const getSupplierRows = (purchasingAnalytics = {}, supplierAnalytics = {}) => {
  const rows = [
    ...safeArray(purchasingAnalytics.supplierAnalytics || purchasingAnalytics.supplier_analytics),
    ...safeArray(purchasingAnalytics.topSuppliers || purchasingAnalytics.top_suppliers),
    ...safeArray(purchasingAnalytics.supplierRanking || purchasingAnalytics.supplier_ranking),
    ...safeArray(supplierAnalytics.supplierRanking || supplierAnalytics.supplier_ranking),
    ...safeArray(supplierAnalytics.topSuppliers || supplierAnalytics.top_suppliers),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeSupplierRow(row, index));
};

const getProductPurchaseRows = (purchasingAnalytics = {}, productAnalytics = {}) => {
  const rows = [
    ...safeArray(purchasingAnalytics.productPurchasingAnalytics || purchasingAnalytics.product_purchasing_analytics),
    ...safeArray(purchasingAnalytics.productPurchaseAnalytics || purchasingAnalytics.product_purchase_analytics),
    ...safeArray(purchasingAnalytics.purchaseByProduct || purchasingAnalytics.purchase_by_product),
    ...safeArray(purchasingAnalytics.itemPurchaseAnalytics || purchasingAnalytics.item_purchase_analytics),
    ...safeArray(productAnalytics.purchaseProducts || productAnalytics.purchase_products),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeProductPurchaseRow(row, index));
};

const getOutstandingPoRows = (purchasingAnalytics = {}) => {
  const rows = [
    ...safeArray(purchasingAnalytics.outstandingPoAnalytics || purchasingAnalytics.outstanding_po_analytics),
    ...safeArray(purchasingAnalytics.outstandingPOAnalytics || purchasingAnalytics.outstanding_po),
    ...safeArray(purchasingAnalytics.outstandingPurchaseOrders || purchasingAnalytics.outstanding_purchase_orders),
    ...safeArray(purchasingAnalytics.openPurchaseOrders || purchasingAnalytics.open_purchase_orders),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeOutstandingPoRow(row, index));
};

const getBranchPurchaseRows = (purchasingAnalytics = {}, branchAnalytics = {}) => {
  const rows = [
    ...safeArray(purchasingAnalytics.branchPurchasingComparison || purchasingAnalytics.branch_purchasing_comparison),
    ...safeArray(purchasingAnalytics.branchPurchaseComparison || purchasingAnalytics.branch_purchase_comparison),
    ...safeArray(purchasingAnalytics.branchPurchasingAnalytics || purchasingAnalytics.branch_purchasing_analytics),
    ...safeArray(purchasingAnalytics.purchaseByBranch || purchasingAnalytics.purchase_by_branch),
    ...safeArray(branchAnalytics.purchasingComparison || branchAnalytics.purchasing_comparison),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeBranchRow(row, index));
};

const getPurchasingRiskRows = (radarResult = {}) => {
  const rows = [
    ...safeArray(radarResult.purchasingRadar),
    ...safeArray(radarResult.purchaseRadar),
    ...safeArray(radarResult.riskCards),
    ...safeArray(radarResult.ownerActionCenter),
    ...safeArray(radarResult.records),
  ];

  return rows.slice(0, 8).map((row, index) => normalizeRiskRow(row, index));
};

const getPurchasingInsightRows = (ownerResult = {}, radarResult = {}) => {
  const purchasingAnalytics = safeObject(ownerResult.purchasingAnalytics);

  const rows = [
    ...safeArray(purchasingAnalytics.insights || purchasingAnalytics.purchasingInsights || purchasingAnalytics.purchasing_insights),
    ...safeArray(purchasingAnalytics.warningCards || purchasingAnalytics.warning_cards),
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
    MONITOR: 'border-slate-200 bg-slate-50 text-slate-600',
    OPEN: 'border-blue-200 bg-blue-50 text-blue-700',
    OVERDUE: 'border-red-200 bg-red-50 text-red-700',
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

const PurchasingKpiCard = ({ title, value, icon, tone = 'white', isMoney = false, isPercent = false }) => {
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

const PurchasingCard = ({ title, subtitle, icon, children }) => (
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
      Purchasing Analytics Dashboard hanya bisa diakses oleh OWNER, DEWA, MONITOR_DEWA, atau HO_TANGERANG.
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
          Gagal memuat Purchasing Analytics Dashboard.
        </div>
        <p className="mt-1 text-sm font-bold leading-relaxed text-red-700">
          {message || 'Terjadi kesalahan saat membaca ERP Purchasing Command Center.'}
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

const PurchasingPerformanceSection = ({ purchasingAnalytics, summary }) => {
  const purchaseTrend = getFirstStringFrom(
    [purchasingAnalytics, summary],
    ['purchaseTrend', 'purchase_trend', 'purchasingTrend', 'purchasing_trend', 'purchaseTrendSummary', 'purchase_trend_summary'],
    '',
  );

  const poTrend = getFirstStringFrom(
    [purchasingAnalytics, summary],
    ['poTrend', 'po_trend', 'purchaseOrderTrend', 'purchase_order_trend', 'poTrendSummary', 'po_trend_summary'],
    '',
  );

  const purchasingSummary = getFirstStringFrom(
    [purchasingAnalytics, summary],
    ['purchasingSummary', 'purchasing_summary', 'purchaseSummary', 'purchase_summary', 'summaryText', 'trendSummary', 'trend_summary'],
    '',
  );

  return (
    <PurchasingCard
      title="Purchasing Performance"
      subtitle="Purchase Trend, PO Trend, dan Purchasing Summary dari orchestrator."
      icon={<BarChart3 size={17} className="text-red-600" />}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-500">
            <TrendingUp size={13} />
            Purchase Trend
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-emerald-800">
            {purchaseTrend || 'Purchase trend belum tersedia dari orchestrator.'}
          </p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-blue-500">
            <FileText size={13} />
            PO Trend
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-blue-800">
            {poTrend || 'PO trend belum tersedia dari orchestrator.'}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-500">
            <Gauge size={13} />
            Purchasing Summary
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-amber-800">
            {purchasingSummary || 'Purchasing summary belum tersedia dari orchestrator.'}
          </p>
        </div>
      </div>
    </PurchasingCard>
  );
};

const SupplierAnalyticsSection = ({ rows }) => (
  <PurchasingCard
    title="Supplier Analytics"
    subtitle="Nama Supplier, Total Purchase, Transaction Count, Average Purchase, dan Status dari orchestrator."
    icon={<Truck size={17} className="text-red-600" />}
  >
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Nama Supplier
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Total Purchase
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Transaction Count
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Average Purchase
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
                Supplier analytics belum tersedia dari orchestrator.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    {index === 0 && <Crown size={15} className="text-amber-500" />}
                    <div className="text-sm font-black text-slate-900">
                      {row.supplierName}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-emerald-700">
                  {formatMoney(row.totalPurchase)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-slate-900">
                  {formatNumber(row.transactionCount)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-blue-700">
                  {formatMoney(row.averagePurchase)}
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
  </PurchasingCard>
);

const ProductPurchasingAnalyticsSection = ({ rows }) => (
  <PurchasingCard
    title="Product Purchasing Analytics"
    subtitle="Nama Produk/Bahan, Qty Purchase, Purchase Value, Supplier, dan Status dari orchestrator."
    icon={<Package size={17} className="text-red-600" />}
  >
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Nama Produk/Bahan
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Qty Purchase
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Purchase Value
            </th>
            <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Supplier
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
                Product purchasing analytics belum tersedia dari orchestrator.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-5 py-4 text-sm font-black text-slate-900">
                  {row.productName}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-slate-900">
                  {formatNumber(row.qtyPurchase)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-emerald-700">
                  {formatMoney(row.purchaseValue)}
                </td>
                <td className="px-5 py-4 text-sm font-bold text-slate-600">
                  {row.supplier}
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
  </PurchasingCard>
);

const OutstandingPoAnalyticsSection = ({ rows }) => (
  <PurchasingCard
    title="Outstanding PO Analytics"
    subtitle="PO Number, Supplier, Outstanding Value, Due Date, dan Status dari orchestrator."
    icon={<FileText size={17} className="text-red-600" />}
  >
    <div className="max-h-[560px] space-y-3 overflow-y-auto">
      {rows.length === 0 ? (
        <EmptyMiniState text="Outstanding PO analytics belum tersedia dari orchestrator." />
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-950">
                  {row.poNumber}
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-500">
                  Supplier {row.supplier}
                </div>
              </div>

              <StatusBadge status={row.status} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Outstanding Value
                </div>
                <div className="mt-1 text-sm font-black text-red-700">
                  {formatMoney(row.outstandingValue)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Due Date
                </div>
                <div className="mt-1 text-sm font-black text-slate-950">
                  {formatDateLabel(row.dueDate)}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  </PurchasingCard>
);

const BranchPurchasingComparisonSection = ({ rows }) => (
  <PurchasingCard
    title="Branch Purchasing Comparison"
    subtitle="Perbandingan performa pembelian antar cabang dari orchestrator."
    icon={<Building2 size={17} className="text-red-600" />}
  >
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {rows.length === 0 ? (
        <EmptyMiniState text="Branch purchasing comparison belum tersedia dari orchestrator." />
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
                  Branch Purchasing
                </div>
              </div>

              <StatusBadge status={row.status} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Purchase
                </div>
                <div className="mt-1 text-sm font-black text-emerald-700">
                  {formatMoney(row.totalPurchase)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  PO Count
                </div>
                <div className="mt-1 text-sm font-black text-slate-950">
                  {formatNumber(row.purchaseOrderCount)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Supplier
                </div>
                <div className="mt-1 text-sm font-black text-slate-950">
                  {formatNumber(row.supplierCount)}
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
  </PurchasingCard>
);

const PurchasingRiskPanel = ({ rows }) => (
  <PurchasingCard
    title="Purchasing Risk Panel"
    subtitle="Risk berasal dari erpOrchestrator.getBusinessRadar()."
    icon={<ShieldAlert size={17} className="text-red-600" />}
  >
    <div className="max-h-[620px] space-y-3 overflow-y-auto">
      {rows.length === 0 ? (
        <EmptyMiniState text="Purchasing risk belum tersedia dari orchestrator." />
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
  </PurchasingCard>
);

const PurchasingInsightPanel = ({ rows }) => (
  <PurchasingCard
    title="Purchasing Insight Panel"
    subtitle="Insight hanya berasal dari orchestrator."
    icon={<Activity size={17} className="text-red-600" />}
  >
    <div className="max-h-[620px] space-y-3 overflow-y-auto">
      {rows.length === 0 ? (
        <EmptyMiniState text="Purchasing insight belum tersedia dari orchestrator." />
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
  </PurchasingCard>
);

function TabPurchasingAnalyticsDashboard(props = {}) {
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
    dashboard: 'PURCHASING_ANALYTICS',
    includePurchasingAnalytics: true,
    includePurchaseAnalytics: true,
    includeSupplierAnalytics: true,
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
          error: error?.message || 'Gagal memuat Purchasing Analytics Dashboard.',
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
  const purchasingAnalytics = ownerResult.purchasingAnalytics;
  const supplierAnalytics = ownerResult.supplierAnalytics;
  const productAnalytics = ownerResult.productAnalytics;
  const branchAnalytics = ownerResult.branchAnalytics;

  const totalPurchase = getFirstValueFrom(
    [purchasingAnalytics, summary],
    ['totalPurchase', 'total_purchase', 'purchaseCount', 'purchase_count'],
    0,
  );

  const totalPurchaseOrder = getFirstValueFrom(
    [purchasingAnalytics, summary],
    ['totalPurchaseOrder', 'total_purchase_order', 'totalPO', 'total_po', 'poCount', 'po_count'],
    0,
  );

  const totalSupplier = getFirstValueFrom(
    [purchasingAnalytics, supplierAnalytics, summary],
    ['totalSupplier', 'total_supplier', 'supplierCount', 'supplier_count'],
    0,
  );

  const totalPurchaseValue = getFirstValueFrom(
    [purchasingAnalytics, summary],
    ['totalPurchaseValue', 'total_purchase_value', 'purchaseValue', 'purchase_value', 'totalPurchaseAmount', 'total_purchase_amount'],
    0,
  );

  const averagePurchaseValue = getFirstValueFrom(
    [purchasingAnalytics, summary],
    ['averagePurchaseValue', 'average_purchase_value', 'avgPurchaseValue', 'avg_purchase_value', 'averagePurchase', 'average_purchase'],
    0,
  );

  const outstandingPo = getFirstValueFrom(
    [purchasingAnalytics, summary],
    ['outstandingPO', 'outstandingPo', 'outstanding_po', 'outstandingPurchaseOrder', 'outstanding_purchase_order'],
    0,
  );

  const purchaseGrowth = getFirstValueFrom(
    [purchasingAnalytics, summary],
    ['purchaseGrowth', 'purchase_growth', 'purchasingGrowth', 'purchasing_growth', 'growth', 'growthPercent', 'growth_percent'],
    0,
  );

  const supplierRows = getSupplierRows(purchasingAnalytics, supplierAnalytics);
  const productPurchaseRows = getProductPurchaseRows(purchasingAnalytics, productAnalytics);
  const outstandingPoRows = getOutstandingPoRows(purchasingAnalytics);
  const branchPurchaseRows = getBranchPurchaseRows(purchasingAnalytics, branchAnalytics);
  const purchasingRiskRows = getPurchasingRiskRows(radarResult);
  const purchasingInsightRows = getPurchasingInsightRows(ownerResult, radarResult);

  const bestSupplier = getFirstStringFrom(
    [purchasingAnalytics, supplierAnalytics, summary],
    ['bestSupplier', 'best_supplier', 'topSupplier', 'top_supplier'],
    supplierRows[0]?.supplierName || '-',
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
                <ShoppingCart size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                ERP Purchasing Command Center
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              PURCHASING ANALYTICS DASHBOARD
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Owner Purchasing Command Center untuk memantau purchase, PO, supplier, outstanding PO, product purchasing, branch comparison, risk, dan insight dari orchestrator.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                OWNER PURCHASING COMMAND CENTER
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
            REFRESH PURCHASING DASHBOARD
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
            <PurchasingKpiCard title="Total Purchase" value={totalPurchase} icon={<ShoppingCart size={18} />} tone="red" />
            <PurchasingKpiCard title="Total Purchase Order" value={totalPurchaseOrder} icon={<FileText size={18} />} tone="green" />
            <PurchasingKpiCard title="Total Supplier" value={totalSupplier} icon={<Truck size={18} />} tone="blue" />
            <PurchasingKpiCard title="Total Purchase Value" value={totalPurchaseValue} icon={<DollarSign size={18} />} tone="amber" isMoney />
            <PurchasingKpiCard title="Average Purchase Value" value={averagePurchaseValue} icon={<Gauge size={18} />} tone="white" isMoney />
            <PurchasingKpiCard title="Outstanding PO" value={outstandingPo} icon={<Clock3 size={18} />} tone="orange" />
            <PurchasingKpiCard title="Best Supplier" value={bestSupplier} icon={<Crown size={18} />} tone="white" />
            <PurchasingKpiCard title="Purchase Growth" value={purchaseGrowth} icon={<Award size={18} />} tone="white" isPercent />
          </div>

          <PurchasingPerformanceSection
            purchasingAnalytics={purchasingAnalytics}
            summary={summary}
          />

          <SupplierAnalyticsSection rows={supplierRows} />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <ProductPurchasingAnalyticsSection rows={productPurchaseRows} />
            </div>

            <div className="xl:col-span-5">
              <OutstandingPoAnalyticsSection rows={outstandingPoRows} />
            </div>
          </section>

          <BranchPurchasingComparisonSection rows={branchPurchaseRows} />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-6">
              <PurchasingRiskPanel rows={purchasingRiskRows} />
            </div>

            <div className="xl:col-span-6">
              <PurchasingInsightPanel rows={purchasingInsightRows} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default TabPurchasingAnalyticsDashboard;
