import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Building2,
  Crown,
  DollarSign,
  Gauge,
  LockKeyhole,
  Package,
  Percent,
  RefreshCw,
  Scissors,
  ShieldAlert,
  Tags,
  TrendingDown,
  Trash2,
  Wallet,
} from 'lucide-react';

import erpOrchestrator from '../../utils/erpOrchestrator';

const EMPTY_OBJECT = Object.freeze({});

const DEFAULT_OWNER_RESULT = {
  summary: {},
  profitLeakageAnalytics: {},
  profitAnalytics: {},
  productAnalytics: {},
  branchAnalytics: {},
  inventoryAnalytics: {},
  expenseAnalytics: {},
  discountAnalytics: {},
  wasteAnalytics: {},
  warningCards: [],
  warnings: [],
  metadata: {},
};

const DEFAULT_RADAR_RESULT = {
  summary: {},
  records: [],
  profitLeakageRadar: [],
  profitRadar: [],
  financialRadar: [],
  inventoryRadar: [],
  riskCards: [],
  ownerActionCenter: [],
  recommendations: [],
  warnings: [],
  metadata: {},
};

const DEFAULT_NOTIFICATIONS_RESULT = {
  summary: {},
  records: [],
  notifications: [],
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
  const profitLeakageAnalytics = safeObject(
    source.profitLeakageAnalytics ||
    source.profit_leakage_analytics ||
    source.leakageAnalytics ||
    source.leakage_analytics,
  );

  return {
    ...DEFAULT_OWNER_RESULT,
    ...source,
    summary: safeObject(source.summary),
    profitLeakageAnalytics: {
      ...profitLeakageAnalytics,
    },
    profitAnalytics: safeObject(source.profitAnalytics || source.profit_analytics),
    productAnalytics: safeObject(source.productAnalytics || source.product_analytics),
    branchAnalytics: safeObject(source.branchAnalytics || source.branch_analytics),
    inventoryAnalytics: safeObject(source.inventoryAnalytics || source.inventory_analytics),
    expenseAnalytics: safeObject(source.expenseAnalytics || source.expense_analytics),
    discountAnalytics: safeObject(source.discountAnalytics || source.discount_analytics),
    wasteAnalytics: safeObject(source.wasteAnalytics || source.waste_analytics),
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
    profitLeakageRadar: safeArray(source.profitLeakageRadar || source.profit_leakage_radar || source.leakageRadar || source.leakage_radar),
    profitRadar: safeArray(source.profitRadar || source.profit_radar),
    financialRadar: safeArray(source.financialRadar || source.financial_radar),
    inventoryRadar: safeArray(source.inventoryRadar || source.inventory_radar),
    riskCards: safeArray(source.riskCards || source.risk_cards),
    ownerActionCenter: safeArray(source.ownerActionCenter || source.owner_action_center),
    recommendations: safeArray(source.recommendations),
    warnings: safeArray(source.warnings),
    metadata: safeObject(source.metadata),
  };
};

const mergeNotificationDefaults = (result) => {
  const source = safeObject(result);

  return {
    ...DEFAULT_NOTIFICATIONS_RESULT,
    ...source,
    summary: safeObject(source.summary),
    records: safeArray(source.records || source.notifications),
    notifications: safeArray(source.notifications || source.records),
    warnings: safeArray(source.warnings),
    metadata: safeObject(source.metadata),
  };
};

const normalizeLeakageRow = (row = {}, index = 0, prefix = 'LEAKAGE') => ({
  id: row.id || row.code || row.product_id || row.productId || row.branch_id || row.branchId || row.reference_number || `${prefix}-${index + 1}`,
  name: getFirstString(row, ['name', 'title', 'product_name', 'productName', 'branch_name', 'branchName', 'expense_name', 'expenseName', 'label'], `${prefix} ${index + 1}`),
  category: getFirstString(row, ['category', 'type', 'source', 'module'], '-'),
  revenue: getFirstValue(row, ['revenue', 'totalRevenue', 'total_revenue', 'omzet'], 0),
  profit: getFirstValue(row, ['profit', 'totalProfit', 'total_profit', 'netProfit', 'net_profit'], 0),
  margin: getFirstValue(row, ['margin', 'profitMargin', 'profit_margin', 'marginPercent', 'margin_percent'], 0),
  leakageValue: getFirstValue(row, ['leakageValue', 'leakage_value', 'leakageCost', 'leakage_cost', 'loss', 'lossAmount', 'loss_amount', 'cost', 'amount', 'value'], 0),
  marginLoss: getFirstValue(row, ['marginLoss', 'margin_loss', 'lossMargin', 'loss_margin'], 0),
  wasteCost: getFirstValue(row, ['wasteCost', 'waste_cost', 'wasteValue', 'waste_value'], 0),
  discountCost: getFirstValue(row, ['discountCost', 'discount_cost', 'discountValue', 'discount_value'], 0),
  deadStockCost: getFirstValue(row, ['deadStockCost', 'dead_stock_cost', 'deadStockValue', 'dead_stock_value'], 0),
  shrinkageCost: getFirstValue(row, ['shrinkageCost', 'shrinkage_cost', 'shrinkageValue', 'shrinkage_value'], 0),
  expenseCost: getFirstValue(row, ['expenseCost', 'expense_cost', 'unproductiveExpense', 'unproductive_expense', 'cost', 'amount'], 0),
  qty: getFirstValue(row, ['qty', 'quantity', 'totalQty', 'total_qty', 'wasteQty', 'waste_qty'], 0),
  age: getFirstValue(row, ['age', 'ageDays', 'age_days', 'inventoryAge', 'inventory_age', 'daysNoMovement', 'days_no_movement'], 0),
  branchName: getFirstString(row, ['branch_name', 'branchName', 'branch'], '-'),
  channel: normalizeCode(getFirstString(row, ['channel', 'sales_channel', 'salesChannel'], '-')),
  status: row.status || row.leakageStatus || row.leakage_status || row.riskStatus || row.risk_status || 'MONITOR',
  message: row.message || row.description || row.notes || '',
  recommendation: row.recommendation || row.action_hint || row.actionHint || '',
  raw: row,
});

const normalizeRiskRow = (row = {}, index = 0) => ({
  id: row.id || row.code || row.reference_number || `LEAKAGE-RISK-${index + 1}`,
  severity: row.severity || row.priority || row.level || row.status || 'INFO',
  title: row.title || row.name || row.code || 'Profit Leakage Risk',
  message: row.message || row.description || row.notes || '',
  recommendation: row.recommendation || row.action_hint || row.actionHint || '',
  amount: row.amount || row.value || row.leakageValue || row.leakage_value || row.lossAmount || row.loss_amount || 0,
  raw: row,
});

const normalizeActionRow = (row = {}, index = 0) => ({
  id: row.id || row.code || row.notification_id || row.reference_number || `OWNER-ACTION-${index + 1}`,
  priority: row.priority || row.severity || row.level || row.status || 'INFO',
  title: row.title || row.name || row.code || 'Owner Action Recommendation',
  message: row.message || row.description || row.notes || '',
  recommendation: row.recommendation || row.action_hint || row.actionHint || row.action || '',
  module: row.module || row.source || row.category || 'PROFIT_LEAKAGE',
  timestamp: row.timestamp || row.created_at || row.createdAt || row.date || '',
  raw: row,
});

const getNegativeMarginRows = (ownerResult = {}) => {
  const profitLeakageAnalytics = safeObject(ownerResult.profitLeakageAnalytics);
  const profitAnalytics = safeObject(ownerResult.profitAnalytics);
  const productAnalytics = safeObject(ownerResult.productAnalytics);

  const rows = [
    ...safeArray(profitLeakageAnalytics.negativeMarginProducts || profitLeakageAnalytics.negative_margin_products),
    ...safeArray(profitLeakageAnalytics.negativeMarginProductPanel || profitLeakageAnalytics.negative_margin_product_panel),
    ...safeArray(profitLeakageAnalytics.lossProducts || profitLeakageAnalytics.loss_products),
    ...safeArray(profitAnalytics.negativeMarginProducts || profitAnalytics.negative_margin_products),
    ...safeArray(productAnalytics.negativeMarginProducts || productAnalytics.negative_margin_products),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeLeakageRow(row, index, 'NEGATIVE-MARGIN'));
};

const getWasteRows = (ownerResult = {}) => {
  const profitLeakageAnalytics = safeObject(ownerResult.profitLeakageAnalytics);
  const wasteAnalytics = safeObject(ownerResult.wasteAnalytics);

  const rows = [
    ...safeArray(profitLeakageAnalytics.wasteAnalysis || profitLeakageAnalytics.waste_analysis),
    ...safeArray(profitLeakageAnalytics.wasteAnalysisPanel || profitLeakageAnalytics.waste_analysis_panel),
    ...safeArray(profitLeakageAnalytics.wasteCosts || profitLeakageAnalytics.waste_costs),
    ...safeArray(wasteAnalytics.wasteAnalysis || wasteAnalytics.waste_analysis),
    ...safeArray(wasteAnalytics.records),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeLeakageRow(row, index, 'WASTE'));
};

const getDiscountRows = (ownerResult = {}) => {
  const profitLeakageAnalytics = safeObject(ownerResult.profitLeakageAnalytics);
  const discountAnalytics = safeObject(ownerResult.discountAnalytics);

  const rows = [
    ...safeArray(profitLeakageAnalytics.discountLeakage || profitLeakageAnalytics.discount_leakage),
    ...safeArray(profitLeakageAnalytics.discountLeakagePanel || profitLeakageAnalytics.discount_leakage_panel),
    ...safeArray(profitLeakageAnalytics.discountCosts || profitLeakageAnalytics.discount_costs),
    ...safeArray(discountAnalytics.discountLeakage || discountAnalytics.discount_leakage),
    ...safeArray(discountAnalytics.records),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeLeakageRow(row, index, 'DISCOUNT'));
};

const getDeadStockRows = (ownerResult = {}) => {
  const profitLeakageAnalytics = safeObject(ownerResult.profitLeakageAnalytics);
  const inventoryAnalytics = safeObject(ownerResult.inventoryAnalytics);

  const rows = [
    ...safeArray(profitLeakageAnalytics.deadStockLoss || profitLeakageAnalytics.dead_stock_loss),
    ...safeArray(profitLeakageAnalytics.deadStockLossPanel || profitLeakageAnalytics.dead_stock_loss_panel),
    ...safeArray(profitLeakageAnalytics.deadStockCosts || profitLeakageAnalytics.dead_stock_costs),
    ...safeArray(inventoryAnalytics.deadStockProducts || inventoryAnalytics.dead_stock_products),
    ...safeArray(inventoryAnalytics.deadStockItems || inventoryAnalytics.dead_stock_items),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeLeakageRow(row, index, 'DEAD-STOCK'));
};

const getExpenseRows = (ownerResult = {}) => {
  const profitLeakageAnalytics = safeObject(ownerResult.profitLeakageAnalytics);
  const expenseAnalytics = safeObject(ownerResult.expenseAnalytics);

  const rows = [
    ...safeArray(profitLeakageAnalytics.expenseLeakage || profitLeakageAnalytics.expense_leakage),
    ...safeArray(profitLeakageAnalytics.expenseLeakagePanel || profitLeakageAnalytics.expense_leakage_panel),
    ...safeArray(profitLeakageAnalytics.unproductiveExpenses || profitLeakageAnalytics.unproductive_expenses),
    ...safeArray(expenseAnalytics.unproductiveExpenses || expenseAnalytics.unproductive_expenses),
    ...safeArray(expenseAnalytics.records),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeLeakageRow(row, index, 'EXPENSE'));
};

const getBranchLeakageRows = (ownerResult = {}) => {
  const profitLeakageAnalytics = safeObject(ownerResult.profitLeakageAnalytics);
  const branchAnalytics = safeObject(ownerResult.branchAnalytics);

  const rows = [
    ...safeArray(profitLeakageAnalytics.branchLeakageComparison || profitLeakageAnalytics.branch_leakage_comparison),
    ...safeArray(profitLeakageAnalytics.branchLeakageAnalytics || profitLeakageAnalytics.branch_leakage_analytics),
    ...safeArray(profitLeakageAnalytics.leakageByBranch || profitLeakageAnalytics.leakage_by_branch),
    ...safeArray(branchAnalytics.branchLeakageComparison || branchAnalytics.branch_leakage_comparison),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeLeakageRow(row, index, 'BRANCH-LEAKAGE'));
};

const getLeakageRiskRows = (radarResult = {}) => {
  const rows = [
    ...safeArray(radarResult.profitLeakageRadar),
    ...safeArray(radarResult.profitRadar),
    ...safeArray(radarResult.financialRadar),
    ...safeArray(radarResult.inventoryRadar),
    ...safeArray(radarResult.riskCards),
    ...safeArray(radarResult.records),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeRiskRow(row, index));
};

const getOwnerActionRows = (ownerResult = {}, radarResult = {}, notificationResult = {}) => {
  const profitLeakageAnalytics = safeObject(ownerResult.profitLeakageAnalytics);

  const rows = [
    ...safeArray(profitLeakageAnalytics.ownerActionRecommendation || profitLeakageAnalytics.owner_action_recommendation),
    ...safeArray(profitLeakageAnalytics.recommendations),
    ...safeArray(profitLeakageAnalytics.insights || profitLeakageAnalytics.profitLeakageInsights || profitLeakageAnalytics.profit_leakage_insights),
    ...safeArray(radarResult.ownerActionCenter),
    ...safeArray(radarResult.recommendations),
    ...safeArray(notificationResult.records),
    ...safeArray(notificationResult.notifications),
  ];

  return rows.slice(0, 10).map((row, index) => normalizeActionRow(row, index));
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
    NEGATIVE_MARGIN: 'border-red-200 bg-red-50 text-red-700',
    WASTE: 'border-orange-200 bg-orange-50 text-orange-700',
    DEAD_STOCK: 'border-red-200 bg-red-50 text-red-700',
    DISCOUNT: 'border-amber-200 bg-amber-50 text-amber-700',
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

const LeakageKpiCard = ({ title, value, icon, tone = 'white', isMoney = true }) => {
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

const LeakageCard = ({ title, subtitle, icon, children }) => (
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
      Profit Leakage Dashboard hanya bisa diakses oleh OWNER, DEWA, MONITOR_DEWA, atau HO_TANGERANG.
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
          Gagal memuat Profit Leakage Dashboard.
        </div>
        <p className="mt-1 text-sm font-bold leading-relaxed text-red-700">
          {message || 'Terjadi kesalahan saat membaca ERP Profit Leakage Command Center.'}
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

const NegativeMarginProductPanel = ({ rows }) => (
  <LeakageCard
    title="Negative Margin Product Panel"
    subtitle="Produk margin negatif berasal dari orchestrator."
    icon={<Package size={17} className="text-red-600" />}
  >
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Produk
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
              Margin Loss
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
                Negative margin product belum tersedia dari orchestrator.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    {index === 0 && <Crown size={15} className="text-amber-500" />}
                    <div>
                      <div className="text-sm font-black text-slate-900">
                        {row.name}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-400">
                        {row.branchName}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-emerald-700">
                  {formatMoney(row.revenue)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-blue-700">
                  {formatMoney(row.profit)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-red-700">
                  {formatPercent(row.margin)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-red-700">
                  {formatMoney(row.marginLoss || row.leakageValue)}
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
  </LeakageCard>
);

const LeakageListPanel = ({ title, subtitle, icon, rows, emptyText, amountKey = 'leakageValue', amountLabel = 'Leakage' }) => (
  <LeakageCard
    title={title}
    subtitle={subtitle}
    icon={icon}
  >
    <div className="max-h-[620px] space-y-3 overflow-y-auto">
      {rows.length === 0 ? (
        <EmptyMiniState text={emptyText} />
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-slate-950">
                  {row.name}
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-500">
                  {row.category}
                </div>
              </div>

              <StatusBadge status={row.status} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  {amountLabel}
                </div>
                <div className="mt-1 text-sm font-black text-red-700">
                  {formatMoney(row[amountKey] || row.leakageValue)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Qty / Age
                </div>
                <div className="mt-1 text-sm font-black text-slate-950">
                  {formatNumber(row.qty || row.age)}
                </div>
              </div>
            </div>

            {(row.message || row.recommendation) && (
              <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
                {row.message || row.recommendation}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  </LeakageCard>
);

const BranchLeakageComparison = ({ rows }) => (
  <LeakageCard
    title="Branch Leakage Comparison"
    subtitle="Perbandingan profit leakage antar cabang dari orchestrator."
    icon={<Building2 size={17} className="text-red-600" />}
  >
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {rows.length === 0 ? (
        <EmptyMiniState text="Branch leakage comparison belum tersedia dari orchestrator." />
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-slate-950">
                  {row.branchName || row.name}
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-400">
                  Branch Leakage
                </div>
              </div>

              <StatusBadge status={row.status} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Total Leakage
                </div>
                <div className="mt-1 text-sm font-black text-red-700">
                  {formatMoney(row.leakageValue)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Margin Loss
                </div>
                <div className="mt-1 text-sm font-black text-orange-700">
                  {formatMoney(row.marginLoss)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Waste Cost
                </div>
                <div className="mt-1 text-sm font-black text-slate-950">
                  {formatMoney(row.wasteCost)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Shrinkage
                </div>
                <div className="mt-1 text-sm font-black text-blue-700">
                  {formatMoney(row.shrinkageCost)}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  </LeakageCard>
);

const LeakageRiskPanel = ({ rows }) => (
  <LeakageCard
    title="Leakage Risk Panel"
    subtitle="Risk berasal dari erpOrchestrator.getBusinessRadar()."
    icon={<ShieldAlert size={17} className="text-red-600" />}
  >
    <div className="max-h-[620px] space-y-3 overflow-y-auto">
      {rows.length === 0 ? (
        <EmptyMiniState text="Leakage risk belum tersedia dari orchestrator." />
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
  </LeakageCard>
);

const OwnerActionRecommendation = ({ rows }) => (
  <LeakageCard
    title="Owner Action Recommendation"
    subtitle="Rekomendasi owner berasal dari orchestrator dan notification center."
    icon={<Bell size={17} className="text-red-600" />}
  >
    <div className="max-h-[620px] space-y-3 overflow-y-auto">
      {rows.length === 0 ? (
        <EmptyMiniState text="Owner action recommendation belum tersedia dari orchestrator." />
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={row.priority} />
              <span className="rounded-full border border-slate-100 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {row.module}
              </span>
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

            <div className="mt-2 text-[11px] font-bold text-slate-400">
              {formatDateTime(row.timestamp)}
            </div>
          </div>
        ))
      )}
    </div>
  </LeakageCard>
);

function TabProfitLeakageDashboard(props = {}) {
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
    notificationResult: DEFAULT_NOTIFICATIONS_RESULT,
  });

  const requestInput = useMemo(() => ({
    readonly: true,
    dashboard: 'PROFIT_LEAKAGE',
    includeProfitLeakageAnalytics: true,
    includeProfitAnalytics: true,
    includeProductAnalytics: true,
    includeBranchAnalytics: true,
    includeInventoryAnalytics: true,
    includeExpenseAnalytics: true,
  }), []);

  useEffect(() => {
    if (!ownerAllowed) {
      setDashboardState({
        loading: false,
        error: '',
        ownerResult: DEFAULT_OWNER_RESULT,
        radarResult: DEFAULT_RADAR_RESULT,
        notificationResult: DEFAULT_NOTIFICATIONS_RESULT,
      });
      return;
    }

    const missingApi = [
      ['getOwnerAnalytics', erpOrchestrator?.getOwnerAnalytics],
      ['getBusinessRadar', erpOrchestrator?.getBusinessRadar],
      ['getNotifications', erpOrchestrator?.getNotifications],
    ].find(([, api]) => typeof api !== 'function');

    if (missingApi) {
      setDashboardState({
        loading: false,
        error: `erpOrchestrator.${missingApi[0]}() belum tersedia.`,
        ownerResult: DEFAULT_OWNER_RESULT,
        radarResult: DEFAULT_RADAR_RESULT,
        notificationResult: DEFAULT_NOTIFICATIONS_RESULT,
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
      readonly: true,
      user: activeUser,
      executor: getUserLabel(activeUser),
    };

    Promise.all([
      erpOrchestrator.getOwnerAnalytics(requestInput, context),
      erpOrchestrator.getBusinessRadar(requestInput, context),
      erpOrchestrator.getNotifications(requestInput, context),
    ])
      .then(([ownerResult, radarResult, notificationResult]) => {
        if (!isMounted) return;

        setDashboardState({
          loading: false,
          error: '',
          ownerResult: mergeOwnerDefaults(ownerResult),
          radarResult: mergeRadarDefaults(radarResult),
          notificationResult: mergeNotificationDefaults(notificationResult),
        });
      })
      .catch((error) => {
        if (!isMounted) return;

        setDashboardState({
          loading: false,
          error: error?.message || 'Gagal memuat Profit Leakage Dashboard.',
          ownerResult: DEFAULT_OWNER_RESULT,
          radarResult: DEFAULT_RADAR_RESULT,
          notificationResult: DEFAULT_NOTIFICATIONS_RESULT,
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
  const notificationResult = mergeNotificationDefaults(dashboardState.notificationResult);

  const summary = ownerResult.summary;
  const profitLeakageAnalytics = ownerResult.profitLeakageAnalytics;

  const totalProfitLeakage = getFirstValueFrom(
    [profitLeakageAnalytics, summary],
    ['totalProfitLeakage', 'total_profit_leakage', 'profitLeakage', 'profit_leakage', 'totalLeakage', 'total_leakage'],
    0,
  );

  const marginLoss = getFirstValueFrom(
    [profitLeakageAnalytics, summary],
    ['marginLoss', 'margin_loss', 'totalMarginLoss', 'total_margin_loss'],
    0,
  );

  const negativeMarginProductCount = getFirstValueFrom(
    [profitLeakageAnalytics, summary],
    ['negativeMarginProductCount', 'negative_margin_product_count', 'negativeMarginCount', 'negative_margin_count'],
    0,
  );

  const wasteCost = getFirstValueFrom(
    [profitLeakageAnalytics, summary],
    ['wasteCost', 'waste_cost', 'totalWasteCost', 'total_waste_cost'],
    0,
  );

  const discountCost = getFirstValueFrom(
    [profitLeakageAnalytics, summary],
    ['discountCost', 'discount_cost', 'totalDiscountCost', 'total_discount_cost'],
    0,
  );

  const shrinkageCost = getFirstValueFrom(
    [profitLeakageAnalytics, summary],
    ['shrinkageCost', 'shrinkage_cost', 'totalShrinkageCost', 'total_shrinkage_cost'],
    0,
  );

  const deadStockCost = getFirstValueFrom(
    [profitLeakageAnalytics, summary],
    ['deadStockCost', 'dead_stock_cost', 'totalDeadStockCost', 'total_dead_stock_cost'],
    0,
  );

  const unproductiveExpense = getFirstValueFrom(
    [profitLeakageAnalytics, summary],
    ['unproductiveExpense', 'unproductive_expense', 'unproductiveExpenseCost', 'unproductive_expense_cost'],
    0,
  );

  const negativeMarginRows = getNegativeMarginRows(ownerResult);
  const wasteRows = getWasteRows(ownerResult);
  const discountRows = getDiscountRows(ownerResult);
  const deadStockRows = getDeadStockRows(ownerResult);
  const expenseRows = getExpenseRows(ownerResult);
  const branchLeakageRows = getBranchLeakageRows(ownerResult);
  const leakageRiskRows = getLeakageRiskRows(radarResult);
  const ownerActionRows = getOwnerActionRows(ownerResult, radarResult, notificationResult);

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
                <TrendingDown size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                ERP Profit Leakage Command Center
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              PROFIT LEAKAGE DASHBOARD
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Owner Profit Leakage Command Center untuk memantau kebocoran profit dari margin negatif, waste, diskon, shrinkage, dead stock, expense tidak produktif, branch leakage, risk, dan action recommendation dari orchestrator.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                OWNER PROFIT LEAKAGE COMMAND CENTER
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
            REFRESH LEAKAGE DASHBOARD
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
            <LeakageKpiCard title="Total Profit Leakage" value={totalProfitLeakage} icon={<TrendingDown size={18} />} tone="red" />
            <LeakageKpiCard title="Margin Loss" value={marginLoss} icon={<Percent size={18} />} tone="orange" />
            <LeakageKpiCard title="Negative Margin Product Count" value={negativeMarginProductCount} icon={<Package size={18} />} tone="amber" isMoney={false} />
            <LeakageKpiCard title="Waste Cost" value={wasteCost} icon={<Trash2 size={18} />} tone="white" />
            <LeakageKpiCard title="Discount Cost" value={discountCost} icon={<Tags size={18} />} tone="white" />
            <LeakageKpiCard title="Shrinkage Cost" value={shrinkageCost} icon={<Gauge size={18} />} tone="blue" />
            <LeakageKpiCard title="Dead Stock Cost" value={deadStockCost} icon={<ShieldAlert size={18} />} tone="white" />
            <LeakageKpiCard title="Unproductive Expense" value={unproductiveExpense} icon={<Wallet size={18} />} tone="green" />
          </div>

          <NegativeMarginProductPanel rows={negativeMarginRows} />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-6">
              <LeakageListPanel
                title="Waste Analysis Panel"
                subtitle="Waste cost dan waste analysis berasal dari orchestrator."
                icon={<Trash2 size={17} className="text-red-600" />}
                rows={wasteRows}
                emptyText="Waste analysis belum tersedia dari orchestrator."
                amountKey="wasteCost"
                amountLabel="Waste Cost"
              />
            </div>

            <div className="xl:col-span-6">
              <LeakageListPanel
                title="Discount Leakage Panel"
                subtitle="Discount leakage berasal dari orchestrator."
                icon={<Scissors size={17} className="text-red-600" />}
                rows={discountRows}
                emptyText="Discount leakage belum tersedia dari orchestrator."
                amountKey="discountCost"
                amountLabel="Discount Cost"
              />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-6">
              <LeakageListPanel
                title="Dead Stock Loss Panel"
                subtitle="Dead stock loss berasal dari orchestrator."
                icon={<Package size={17} className="text-red-600" />}
                rows={deadStockRows}
                emptyText="Dead stock loss belum tersedia dari orchestrator."
                amountKey="deadStockCost"
                amountLabel="Dead Stock Cost"
              />
            </div>

            <div className="xl:col-span-6">
              <LeakageListPanel
                title="Expense Leakage Panel"
                subtitle="Expense leakage dan unproductive expense berasal dari orchestrator."
                icon={<Wallet size={17} className="text-red-600" />}
                rows={expenseRows}
                emptyText="Expense leakage belum tersedia dari orchestrator."
                amountKey="expenseCost"
                amountLabel="Expense Cost"
              />
            </div>
          </section>

          <BranchLeakageComparison rows={branchLeakageRows} />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-6">
              <LeakageRiskPanel rows={leakageRiskRows} />
            </div>

            <div className="xl:col-span-6">
              <OwnerActionRecommendation rows={ownerActionRows} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default TabProfitLeakageDashboard;
