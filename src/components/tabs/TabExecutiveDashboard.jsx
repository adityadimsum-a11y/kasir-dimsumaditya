import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  Crown,
  DollarSign,
  Gauge,
  LockKeyhole,
  Package,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

import erpOrchestrator from '../../utils/erpOrchestrator';

const EMPTY_OBJECT = Object.freeze({});

const DEFAULT_OWNER_RESULT = {
  summary: {},
  customerAnalytics: {},
  salesAnalytics: {},
  cashflowAnalytics: {},
  inventoryAnalytics: {},
  warningCards: [],
  warnings: [],
  metadata: {},
};

const DEFAULT_RADAR_RESULT = {
  summary: {},
  records: [],
  riskCards: [],
  ownerActionCenter: [],
  recommendations: [],
  warnings: [],
  metadata: {},
};

const DEFAULT_HEALTH_RESULT = {
  summary: {},
  records: [],
  engineStatus: {},
  dataQuality: {},
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
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
      return source[key];
    }
  }

  return fallback;
};

const getFirstString = (source = {}, keys = [], fallback = '-') => {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && String(source[key]).trim() !== '') {
      return String(source[key]);
    }
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
    customerAnalytics: safeObject(source.customerAnalytics),
    salesAnalytics: safeObject(source.salesAnalytics),
    cashflowAnalytics: safeObject(source.cashflowAnalytics),
    inventoryAnalytics: safeObject(source.inventoryAnalytics),
    warningCards: safeArray(source.warningCards),
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
    riskCards: safeArray(source.riskCards || source.risk_cards),
    ownerActionCenter: safeArray(source.ownerActionCenter || source.owner_action_center),
    recommendations: safeArray(source.recommendations),
    warnings: safeArray(source.warnings),
    metadata: safeObject(source.metadata),
  };
};

const mergeHealthDefaults = (result) => {
  const source = safeObject(result);

  return {
    ...DEFAULT_HEALTH_RESULT,
    ...source,
    summary: safeObject(source.summary),
    records: safeArray(source.records),
    engineStatus: safeObject(source.engineStatus),
    dataQuality: safeObject(source.dataQuality),
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

const normalizeCustomerRow = (row = {}, index = 0) => ({
  id: row.id || row.customer_id || row.customerId || `CUSTOMER-${index + 1}`,
  name: getFirstString(row, ['customer_name', 'customerName', 'name', 'customer', 'label'], `Customer ${index + 1}`),
  revenue: getFirstValue(row, ['totalRevenue', 'total_revenue', 'customerRevenue', 'customer_revenue', 'revenue', 'omzet'], 0),
  orderCount: getFirstValue(row, ['totalOrder', 'total_order', 'orderCount', 'order_count', 'transactionCount'], 0),
  status: row.status || row.riskStatus || row.customerStatus || 'MONITOR',
  raw: row,
});

const normalizeProductRow = (row = {}, index = 0) => ({
  id: row.id || row.product_id || row.productId || `PRODUCT-${index + 1}`,
  name: getFirstString(row, ['product_name', 'productName', 'name', 'product', 'label'], `Produk ${index + 1}`),
  revenue: getFirstValue(row, ['totalRevenue', 'total_revenue', 'productRevenue', 'product_revenue', 'revenue', 'omzet'], 0),
  qty: getFirstValue(row, ['qtySold', 'qty_sold', 'quantitySold', 'quantity_sold', 'totalQty', 'total_qty'], 0),
  margin: getFirstValue(row, ['profitMargin', 'profit_margin', 'margin', 'marginPercent', 'margin_percent'], 0),
  raw: row,
});

const normalizeInsightRow = (row = {}, index = 0) => ({
  id: row.id || row.code || row.reference_key || `INSIGHT-${index + 1}`,
  severity: row.severity || row.priority || row.level || row.status || 'INFO',
  title: row.title || row.name || row.code || 'Executive Insight',
  message: row.message || row.description || row.notes || row.action_hint || row.recommendation || '',
  recommendation: row.recommendation || row.action_hint || row.actionHint || '',
  raw: row,
});

const getTopCustomerRows = (ownerResult) => {
  const customerAnalytics = safeObject(ownerResult.customerAnalytics);

  const rows = [
    ...safeArray(customerAnalytics.topCustomers || customerAnalytics.top_customers),
    ...safeArray(customerAnalytics.topCustomerRevenue || customerAnalytics.top_customer_revenue),
    ...safeArray(customerAnalytics.customerRanking || customerAnalytics.customer_ranking),
  ];

  return rows.slice(0, 5).map((row, index) => normalizeCustomerRow(row, index));
};

const getTopProductRows = (ownerResult) => {
  const salesAnalytics = safeObject(ownerResult.salesAnalytics);

  const rows = [
    ...safeArray(salesAnalytics.topProducts || salesAnalytics.top_products),
    ...safeArray(salesAnalytics.topProductRevenue || salesAnalytics.top_product_revenue),
    ...safeArray(salesAnalytics.bestSellerProducts || salesAnalytics.best_seller_products),
    ...safeArray(salesAnalytics.productRanking || salesAnalytics.product_ranking),
  ];

  return rows.slice(0, 5).map((row, index) => normalizeProductRow(row, index));
};

const getQuickInsightRows = (ownerResult, radarResult, healthResult, notificationResult) => {
  const rows = [
    ...safeArray(radarResult.ownerActionCenter),
    ...safeArray(radarResult.recommendations),
    ...safeArray(radarResult.riskCards),
    ...safeArray(ownerResult.warningCards),
    ...safeArray(ownerResult.warnings),
    ...safeArray(healthResult.warnings),
    ...safeArray(notificationResult.records),
  ];

  return rows.slice(0, 8).map((row, index) => normalizeInsightRow(row, index));
};

const getNotificationRows = (notificationResult) => {
  return safeArray(notificationResult.records || notificationResult.notifications)
    .slice(0, 10)
    .map((row, index) => ({
      id: row.id || row.notification_id || row.code || `NOTIF-${index + 1}`,
      priority: row.priority || row.severity || row.level || 'INFO',
      title: row.title || row.message || row.code || 'Notification',
      message: row.message || row.description || row.notes || '',
      module: row.module || row.source || row.category || 'ERP',
      timestamp: row.timestamp || row.created_at || row.date || row.createdAt || '',
      raw: row,
    }));
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

const KpiCard = ({ title, value, icon, tone = 'white', isMoney = true }) => {
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
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">
            {title}
          </div>
          <div className="mt-2 truncate text-xl font-black">
            {isMoney ? formatMoney(value) : String(value || value === 0 ? value : '-')}
          </div>
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/80 p-3 text-red-600 shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
};

const ExecutiveCard = ({ title, subtitle, icon, children }) => (
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

    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
      {[1, 2, 3, 4, 5, 6].map((item) => (
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
      Executive Dashboard hanya bisa diakses oleh OWNER, DEWA, MONITOR_DEWA, atau HO_TANGERANG.
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
          Gagal memuat Executive Dashboard.
        </div>
        <p className="mt-1 text-sm font-bold leading-relaxed text-red-700">
          {message || 'Terjadi kesalahan saat membaca ERP Central Intelligence.'}
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

const BusinessRadarSection = ({ radarResult }) => {
  const summary = radarResult.summary;
  const recommendationRows = [
    ...safeArray(radarResult.ownerActionCenter),
    ...safeArray(radarResult.recommendations),
    ...safeArray(radarResult.records),
  ].slice(0, 4);

  const criticalRisk = getFirstValue(summary, ['totalCriticalRisk', 'criticalRisk', 'critical_risk'], 0);
  const highRisk = getFirstValue(summary, ['totalHighRisk', 'highRisk', 'high_risk'], 0);
  const mediumRisk = getFirstValue(summary, ['totalMediumRisk', 'mediumRisk', 'medium_risk', 'totalWarningRisk'], 0);

  return (
    <ExecutiveCard
      title="Business Radar"
      subtitle="Critical risk, high risk, medium risk, dan recommendation dari erpOrchestrator.getBusinessRadar()."
      icon={<ShieldAlert size={17} className="text-red-600" />}
    >
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">
            Critical Risk
          </div>
          <div className="mt-1 text-2xl font-black text-red-700">
            {formatNumber(criticalRisk)}
          </div>
        </div>

        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-400">
            High Risk
          </div>
          <div className="mt-1 text-2xl font-black text-orange-700">
            {formatNumber(highRisk)}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-500">
            Medium Risk
          </div>
          <div className="mt-1 text-2xl font-black text-amber-700">
            {formatNumber(mediumRisk)}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {recommendationRows.length === 0 ? (
          <EmptyMiniState text="Recommendation belum tersedia dari orchestrator." />
        ) : (
          recommendationRows.map((row, index) => (
            <div
              key={row.id || row.code || `RADAR-REC-${index + 1}`}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={row.severity || row.priority || row.level || 'INFO'} />
              </div>
              <div className="mt-2 text-sm font-black text-slate-900">
                {row.title || row.name || row.code || 'Recommendation'}
              </div>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-600">
                {row.recommendation || row.action_hint || row.actionHint || row.message || row.description || '-'}
              </p>
            </div>
          ))
        )}
      </div>
    </ExecutiveCard>
  );
};

const SystemHealthSection = ({ healthResult }) => {
  const summary = healthResult.summary;

  const overallScore = getFirstValue(summary, ['healthScore', 'overallScore', 'score'], 0);
  const criticalAlert = getFirstValue(summary, ['totalCritical', 'criticalAlert', 'critical_alert', 'totalCriticalAlert'], 0);
  const warningAlert = getFirstValue(summary, ['totalWarning', 'warningAlert', 'warning_alert', 'totalWarningAlert'], 0);
  const healthyModule = getFirstValue(summary, ['healthyModule', 'healthyModules', 'totalPassed', 'totalHealthyModule'], 0);

  return (
    <ExecutiveCard
      title="System Health"
      subtitle="Overall score, alert, dan healthy module dari erpOrchestrator.getSystemHealth()."
      icon={<Gauge size={17} className="text-red-600" />}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-950 p-4 text-white">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Overall Score
          </div>
          <div className="mt-1 text-3xl font-black">
            {formatNumber(overallScore)}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-500">
            Healthy Module
          </div>
          <div className="mt-1 text-3xl font-black text-emerald-700">
            {formatNumber(healthyModule)}
          </div>
        </div>

        <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">
            Critical Alert
          </div>
          <div className="mt-1 text-2xl font-black text-red-700">
            {formatNumber(criticalAlert)}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-500">
            Warning Alert
          </div>
          <div className="mt-1 text-2xl font-black text-amber-700">
            {formatNumber(warningAlert)}
          </div>
        </div>
      </div>
    </ExecutiveCard>
  );
};

const NotificationPreviewSection = ({ notificationRows }) => (
  <ExecutiveCard
    title="Notification Center Preview"
    subtitle="Maksimal 10 notifikasi terbaru dari erpOrchestrator.getNotifications()."
    icon={<Bell size={17} className="text-red-600" />}
  >
    <div className="max-h-[520px] space-y-3 overflow-y-auto">
      {notificationRows.length === 0 ? (
        <EmptyMiniState text="Tidak ada notifikasi terbaru dari orchestrator." />
      ) : (
        notificationRows.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={item.priority} />
              <span className="rounded-full border border-slate-100 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {item.module}
              </span>
            </div>

            <div className="mt-2 text-sm font-black text-slate-900">
              {item.title}
            </div>

            <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-600">
              {item.message || '-'}
            </p>

            <div className="mt-2 text-[11px] font-bold text-slate-400">
              {formatDateTime(item.timestamp)}
            </div>
          </div>
        ))
      )}
    </div>
  </ExecutiveCard>
);

const TopCustomerSection = ({ rows }) => (
  <ExecutiveCard
    title="Top Customer"
    subtitle="Data dari result.customerAnalytics."
    icon={<Users size={17} className="text-red-600" />}
  >
    <div className="space-y-3">
      {rows.length === 0 ? (
        <EmptyMiniState text="Top customer belum tersedia dari orchestrator." />
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
                Order {formatNumber(row.orderCount)}
              </div>
            </div>
            <div className="text-right text-sm font-black text-emerald-700">
              {formatMoney(row.revenue)}
            </div>
          </div>
        ))
      )}
    </div>
  </ExecutiveCard>
);

const TopProductSection = ({ rows }) => (
  <ExecutiveCard
    title="Top Product"
    subtitle="Data dari result.salesAnalytics."
    icon={<Package size={17} className="text-red-600" />}
  >
    <div className="space-y-3">
      {rows.length === 0 ? (
        <EmptyMiniState text="Top product belum tersedia dari orchestrator." />
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
                Qty {formatNumber(row.qty)} · Margin {formatNumber(row.margin)}%
              </div>
            </div>
            <div className="text-right text-sm font-black text-emerald-700">
              {formatMoney(row.revenue)}
            </div>
          </div>
        ))
      )}
    </div>
  </ExecutiveCard>
);

const CashflowSnapshotSection = ({ cashflowAnalytics }) => {
  const cashIn = getFirstValue(cashflowAnalytics, ['cashIn', 'cash_in', 'totalCashIn', 'total_cash_in'], 0);
  const cashOut = getFirstValue(cashflowAnalytics, ['cashOut', 'cash_out', 'totalCashOut', 'total_cash_out'], 0);
  const netCashflow = getFirstValue(cashflowAnalytics, ['netCashflow', 'net_cashflow'], 0);
  const cashPosition = getFirstValue(cashflowAnalytics, ['cashPosition', 'cash_position', 'currentCashPosition', 'current_cash_position'], 0);

  return (
    <ExecutiveCard
      title="Cashflow Snapshot"
      subtitle="Data dari result.cashflowAnalytics."
      icon={<Wallet size={17} className="text-red-600" />}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-500">
            Cash In
          </div>
          <div className="mt-1 text-sm font-black text-emerald-700">
            {formatMoney(cashIn)}
          </div>
        </div>

        <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">
            Cash Out
          </div>
          <div className="mt-1 text-sm font-black text-red-700">
            {formatMoney(cashOut)}
          </div>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-500">
            Net Cashflow
          </div>
          <div className="mt-1 text-sm font-black text-blue-700">
            {formatMoney(netCashflow)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Cash Position
          </div>
          <div className="mt-1 text-sm font-black text-slate-900">
            {formatMoney(cashPosition)}
          </div>
        </div>
      </div>
    </ExecutiveCard>
  );
};

const QuickInsightSection = ({ rows }) => (
  <ExecutiveCard
    title="Quick Insight Panel"
    subtitle="Insight berasal dari orchestrator: radar, warning, health, dan notification."
    icon={<Activity size={17} className="text-red-600" />}
  >
    <div className="space-y-3">
      {rows.length === 0 ? (
        <EmptyMiniState text="Quick insight belum tersedia dari orchestrator." />
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={row.severity} />
            </div>

            <div className="mt-2 text-sm font-black text-slate-900">
              {row.title}
            </div>

            <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-600">
              {row.message || row.recommendation || '-'}
            </p>
          </div>
        ))
      )}
    </div>
  </ExecutiveCard>
);

function TabExecutiveDashboard(props = {}) {
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
    healthResult: DEFAULT_HEALTH_RESULT,
    notificationResult: DEFAULT_NOTIFICATIONS_RESULT,
  });

  const requestInput = useMemo(() => ({
    readonly: true,
    dashboard: 'EXECUTIVE',
    includeCustomerAnalytics: true,
    includeSalesAnalytics: true,
    includeCashflowAnalytics: true,
    includeInventoryAnalytics: true,
  }), []);

  useEffect(() => {
    if (!ownerAllowed) {
      setDashboardState({
        loading: false,
        error: '',
        ownerResult: DEFAULT_OWNER_RESULT,
        radarResult: DEFAULT_RADAR_RESULT,
        healthResult: DEFAULT_HEALTH_RESULT,
        notificationResult: DEFAULT_NOTIFICATIONS_RESULT,
      });
      return;
    }

    const missingApi = [
      ['getOwnerAnalytics', erpOrchestrator?.getOwnerAnalytics],
      ['getBusinessRadar', erpOrchestrator?.getBusinessRadar],
      ['getSystemHealth', erpOrchestrator?.getSystemHealth],
      ['getNotifications', erpOrchestrator?.getNotifications],
    ].find(([, api]) => typeof api !== 'function');

    if (missingApi) {
      setDashboardState({
        loading: false,
        error: `erpOrchestrator.${missingApi[0]}() belum tersedia.`,
        ownerResult: DEFAULT_OWNER_RESULT,
        radarResult: DEFAULT_RADAR_RESULT,
        healthResult: DEFAULT_HEALTH_RESULT,
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
      dbData: sourceData,
      readonly: true,
      user: activeUser,
      executor: getUserLabel(activeUser),
    };

    Promise.all([
      erpOrchestrator.getOwnerAnalytics(requestInput, context),
      erpOrchestrator.getBusinessRadar(requestInput, context),
      erpOrchestrator.getSystemHealth(requestInput, context),
      erpOrchestrator.getNotifications(requestInput, context),
    ])
      .then(([ownerResult, radarResult, healthResult, notificationResult]) => {
        if (!isMounted) return;

        setDashboardState({
          loading: false,
          error: '',
          ownerResult: mergeOwnerDefaults(ownerResult),
          radarResult: mergeRadarDefaults(radarResult),
          healthResult: mergeHealthDefaults(healthResult),
          notificationResult: mergeNotificationDefaults(notificationResult),
        });
      })
      .catch((error) => {
        if (!isMounted) return;

        setDashboardState({
          loading: false,
          error: error?.message || 'Gagal memuat Executive Dashboard.',
          ownerResult: DEFAULT_OWNER_RESULT,
          radarResult: DEFAULT_RADAR_RESULT,
          healthResult: DEFAULT_HEALTH_RESULT,
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
  const healthResult = mergeHealthDefaults(dashboardState.healthResult);
  const notificationResult = mergeNotificationDefaults(dashboardState.notificationResult);

  const summary = ownerResult.summary;
  const cashflowAnalytics = ownerResult.cashflowAnalytics;
  const inventoryAnalytics = ownerResult.inventoryAnalytics;

  const totalRevenue = getFirstValue(summary, ['totalRevenue', 'total_revenue', 'revenue', 'omzet'], 0);
  const netProfit = getFirstValue(summary, ['netProfit', 'net_profit', 'totalProfit', 'total_profit'], 0);
  const cashPosition = getFirstValue(cashflowAnalytics, ['cashPosition', 'cash_position', 'currentCashPosition', 'current_cash_position', 'cashBalance'], 0);
  const outstandingPiutang = getFirstValue(summary, ['outstandingPiutang', 'outstanding_piutang', 'receivableBalance', 'receivable_balance'], getFirstValue(cashflowAnalytics, ['receivableBalance', 'receivable_balance'], 0));
  const outstandingHutang = getFirstValue(summary, ['outstandingHutang', 'outstanding_hutang', 'payableBalance', 'payable_balance'], getFirstValue(cashflowAnalytics, ['payableBalance', 'payable_balance'], 0));
  const inventoryValue = getFirstValue(inventoryAnalytics, ['totalInventoryValue', 'total_inventory_value', 'inventoryValue', 'inventory_value'], getFirstValue(summary, ['inventoryValue', 'inventory_value'], 0));

  const topCustomerRows = getTopCustomerRows(ownerResult);
  const topProductRows = getTopProductRows(ownerResult);
  const notificationRows = getNotificationRows(notificationResult);
  const quickInsightRows = getQuickInsightRows(ownerResult, radarResult, healthResult, notificationResult);

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
                <Building2 size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                ERP Central Intelligence
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              EXECUTIVE COMMAND CENTER
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Owner Command Center untuk memantau revenue, profit, cash, risk, health, notification, customer, product, dan cashflow dari orchestrator.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                OWNER COMMAND CENTER
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
            REFRESH COMMAND CENTER
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <KpiCard title="Total Revenue" value={totalRevenue} icon={<DollarSign size={18} />} tone="red" />
            <KpiCard title="Net Profit" value={netProfit} icon={<TrendingUp size={18} />} tone="green" />
            <KpiCard title="Cash Position" value={cashPosition} icon={<Wallet size={18} />} tone="blue" />
            <KpiCard title="Outstanding Piutang" value={outstandingPiutang} icon={<Users size={18} />} tone="amber" />
            <KpiCard title="Outstanding Hutang" value={outstandingHutang} icon={<TrendingDown size={18} />} tone="orange" />
            <KpiCard title="Inventory Value" value={inventoryValue} icon={<Package size={18} />} tone="white" />
          </div>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <BusinessRadarSection radarResult={radarResult} />
            </div>

            <div className="xl:col-span-5">
              <SystemHealthSection healthResult={healthResult} />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-5">
              <NotificationPreviewSection notificationRows={notificationRows} />
            </div>

            <div className="xl:col-span-7">
              <QuickInsightSection rows={quickInsightRows} />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-4">
              <TopCustomerSection rows={topCustomerRows} />
            </div>

            <div className="xl:col-span-4">
              <TopProductSection rows={topProductRows} />
            </div>

            <div className="xl:col-span-4">
              <CashflowSnapshotSection cashflowAnalytics={cashflowAnalytics} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default TabExecutiveDashboard;
