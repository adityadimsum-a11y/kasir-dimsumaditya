import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  Crown,
  DollarSign,
  Eye,
  FileText,
  Filter,
  LockKeyhole,
  RefreshCw,
  Search,
  Tag,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  UserX,
  WalletCards,
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
  'RESELLER',
  'DISTRIBUTOR',
  'FRANCHISE',
  'RETAIL',
  'CAFE',
  'RESTO',
];

const REQUIRED_CATEGORIES = [
  'RESELLER',
  'DISTRIBUTOR',
  'FRANCHISE',
  'RETAIL',
  'CAFE',
  'RESTO',
];

const DEFAULT_SUMMARY = {
  totalCustomer: 0,
  totalCustomers: 0,
  activeCustomer: 0,
  activeCustomers: 0,
  inactiveCustomer: 0,
  inactiveCustomers: 0,
  totalRevenueCustomer: 0,
  customerRevenue: 0,
  totalRevenue: 0,
  customerRetentionRate: 0,
  retentionRate: 0,
};

const DEFAULT_CUSTOMER_ANALYTICS = {
  customerRanking: [],
  topCustomers: [],
  loyalCustomers: [],
  frequentCustomers: [],
  inactiveCustomers: [],
  customerCategoryAnalytics: [],
  categoryAnalytics: [],
  topResellers: [],
  topDistributors: [],
  highRiskCustomers: [],
};

const DEFAULT_RESULT = {
  summary: DEFAULT_SUMMARY,
  customerAnalytics: DEFAULT_CUSTOMER_ANALYTICS,
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
  const customerAnalytics = safeObject(source.customerAnalytics);

  return {
    ...DEFAULT_RESULT,
    ...source,
    summary: {
      ...DEFAULT_SUMMARY,
      ...safeObject(source.summary),
    },
    customerAnalytics: {
      ...DEFAULT_CUSTOMER_ANALYTICS,
      ...customerAnalytics,
      customerRanking: safeArray(customerAnalytics.customerRanking || customerAnalytics.customer_ranking || customerAnalytics.ranking),
      topCustomers: safeArray(customerAnalytics.topCustomers || customerAnalytics.top_customers),
      loyalCustomers: safeArray(customerAnalytics.loyalCustomers || customerAnalytics.loyal_customers),
      frequentCustomers: safeArray(customerAnalytics.frequentCustomers || customerAnalytics.frequent_customers),
      inactiveCustomers: safeArray(customerAnalytics.inactiveCustomers || customerAnalytics.inactive_customers),
      customerCategoryAnalytics: safeArray(customerAnalytics.customerCategoryAnalytics || customerAnalytics.customer_category_analytics),
      categoryAnalytics: safeArray(customerAnalytics.categoryAnalytics || customerAnalytics.category_analytics),
      topResellers: safeArray(customerAnalytics.topResellers || customerAnalytics.top_resellers),
      topDistributors: safeArray(customerAnalytics.topDistributors || customerAnalytics.top_distributors),
      highRiskCustomers: safeArray(customerAnalytics.highRiskCustomers || customerAnalytics.high_risk_customers),
    },
    warningCards: safeArray(source.warningCards),
    warnings: safeArray(source.warnings),
    metadata: safeObject(source.metadata),
  };
};

const getSummaryValue = (summary = {}, customerAnalytics = {}, keys = []) => {
  for (const key of keys) {
    if (summary[key] !== undefined && summary[key] !== null && summary[key] !== '') {
      return summary[key];
    }

    if (customerAnalytics[key] !== undefined && customerAnalytics[key] !== null && customerAnalytics[key] !== '') {
      return customerAnalytics[key];
    }
  }

  return 0;
};

const normalizeCustomerRow = (row = {}, index = 0) => {
  const customerId = String(row.customer_id || row.customerId || row.id || row.customer || '').trim();
  const customerName = String(
    row.customer_name ||
    row.customerName ||
    row.name ||
    row.customer ||
    row.label ||
    customerId ||
    `Customer ${index + 1}`,
  ).trim();

  return {
    id: customerId || `CUSTOMER-${index + 1}`,
    rank: row.rank || row.ranking || index + 1,
    customer_id: customerId,
    customer_name: customerName,
    category: normalizeCode(row.customer_type || row.customerType || row.category || row.type || 'RETAIL'),
    branch: row.branch || row.branch_name || row.branchName || row.branch_id || row.branchId || '',
    totalOrder: row.totalOrder ?? row.total_order ?? row.orderCount ?? row.order_count ?? row.transactionCount ?? row.transaction_count ?? 0,
    totalRevenue: row.totalRevenue ?? row.total_revenue ?? row.revenue ?? row.omzet ?? 0,
    totalProfit: row.totalProfit ?? row.total_profit ?? row.netProfit ?? row.net_profit ?? row.grossProfit ?? row.gross_profit ?? 0,
    profitMargin: row.profitMargin ?? row.profit_margin ?? row.margin ?? row.marginPercent ?? row.margin_percent ?? 0,
    frequency: row.frequency ?? row.orderFrequency ?? row.order_frequency ?? row.totalOrder ?? row.total_order ?? 0,
    lastOrderDate: row.lastOrderDate || row.last_order_date || row.lastTransactionDate || row.last_transaction_date || row.last_order_at || '',
    inactiveDays: row.inactiveDays ?? row.inactive_days ?? row.daysInactive ?? row.days_inactive ?? row.daysNoOrder ?? row.days_no_order ?? 0,
    retentionRate: row.retentionRate ?? row.retention_rate ?? row.customerRetentionRate ?? row.customer_retention_rate ?? 0,
    riskStatus: row.riskStatus || row.risk_status || row.status || '',
    metadata: safeObject(row.metadata || row.meta || row),
    raw: row,
  };
};

const getCustomerRankingRows = (customerAnalytics = {}) => {
  const explicitRows = safeArray(
    customerAnalytics.customerRanking ||
    customerAnalytics.customer_ranking ||
    customerAnalytics.ranking ||
    customerAnalytics.rankings,
  );

  const sourceRows = explicitRows.length > 0
    ? explicitRows
    : safeArray(customerAnalytics.topCustomers);

  return sourceRows.map((row, index) => normalizeCustomerRow(row, index));
};

const getTopCustomerRows = (customerAnalytics = {}) => {
  const sourceRows = safeArray(customerAnalytics.topCustomers).length > 0
    ? safeArray(customerAnalytics.topCustomers)
    : safeArray(customerAnalytics.customerRanking);

  return sourceRows.slice(0, 10).map((row, index) => normalizeCustomerRow(row, index));
};

const getLoyalCustomerRows = (customerAnalytics = {}) => {
  const sourceRows = [
    ...safeArray(customerAnalytics.loyalCustomers),
    ...safeArray(customerAnalytics.frequentCustomers),
  ];

  const finalRows = sourceRows.length > 0
    ? sourceRows
    : safeArray(customerAnalytics.topCustomers);

  return finalRows.map((row, index) => normalizeCustomerRow(row, index));
};

const getInactiveCustomerRows = (customerAnalytics = {}) => {
  return safeArray(customerAnalytics.inactiveCustomers)
    .map((row, index) => normalizeCustomerRow(row, index));
};

const getCategoryRows = (customerAnalytics = {}) => {
  const explicitRows = [
    ...safeArray(customerAnalytics.customerCategoryAnalytics),
    ...safeArray(customerAnalytics.categoryAnalytics),
  ];

  const categoryMap = new Map();

  explicitRows.forEach((row) => {
    const category = normalizeCode(row.category || row.customer_type || row.customerType || row.type || row.name || '');
    if (!category) return;

    categoryMap.set(category, {
      category,
      customerCount: row.customerCount ?? row.customer_count ?? row.totalCustomer ?? row.total_customer ?? row.count ?? 0,
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
      customerCount: 0,
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
    ...safeArray(result.customerAnalytics?.highRiskCustomers),
  ];

  return rows.map((row, index) => ({
    id: row.id || row.code || row.customer_id || row.customerId || `CUSTOMER-WARNING-${index + 1}`,
    severity: row.severity || row.priority || row.level || row.riskStatus || 'INFO',
    title: row.title || row.customer_name || row.customerName || row.message || row.code || 'Customer Warning',
    message: row.message || row.description || row.notes || '',
    actionHint: row.action_hint || row.actionHint || row.recommendation || '',
    amount: row.amount || row.value || row.outstandingReceivable || row.outstanding_receivable || 0,
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
    {normalizeCode(category || 'RETAIL')}
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
      Customer Analytics Dashboard hanya bisa diakses oleh OWNER atau DEWA.
    </p>
  </div>
);

const EmptyState = () => (
  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-8 text-center shadow-sm">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
      <Users size={24} />
    </div>
    <div className="mt-4 text-lg font-black text-amber-900">
      Tidak ada data customer analytics.
    </div>
    <p className="mx-auto mt-2 max-w-xl text-sm font-bold leading-relaxed text-amber-700">
      Tidak ada analytics customer dari orchestrator untuk filter yang sedang aktif.
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
          Gagal memuat Customer Analytics Dashboard.
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
              Customer Analytics Detail
            </div>
            <p className="mt-1 text-xs font-bold text-slate-400">
              Detail analytics customer dari ERP Owner Analytics. Read only.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
            aria-label="Close customer detail"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {item.type || 'CUSTOMER_ANALYTICS'}
              </span>
              <CategoryBadge category={item.category} />
            </div>

            <h2 className="mt-4 text-xl font-black text-slate-950">
              {item.customer_name || item.title || 'Customer Detail'}
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Total Order
                </div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  {formatNumber(item.totalOrder)}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Revenue
                </div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  {formatMoney(item.totalRevenue)}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Profit
                </div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  {formatMoney(item.totalProfit)}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Last Order
                </div>
                <div className="mt-1 text-sm font-black text-slate-900">
                  {formatDateLabel(item.lastOrderDate)}
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

const CustomerRankingTable = ({ rows, onSelect }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
      <div>
        <div className="flex items-center gap-2 text-sm font-black text-slate-900">
          <BarChart3 size={17} className="text-red-600" />
          Customer Ranking
        </div>
        <p className="mt-1 text-[11px] font-semibold text-slate-400">
          Urutan ranking mengikuti data dari orchestrator.
        </p>
      </div>

      <span className="rounded-full border border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {formatNumber(rows.length)} customer
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
              Nama Customer
            </th>
            <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Kategori
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Total Order
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Revenue
            </th>
            <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Profit
            </th>
            <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Last Order
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
                Customer ranking belum tersedia dari orchestrator.
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
                    {row.customer_name}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-400">
                    {row.branch || '-'}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <CategoryBadge category={row.category} />
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-slate-900">
                  {formatNumber(row.totalOrder)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-emerald-700">
                  {formatMoney(row.totalRevenue)}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-blue-700">
                  {formatMoney(row.totalProfit)}
                </td>
                <td className="px-5 py-4 text-sm font-bold text-slate-600">
                  {formatDateLabel(row.lastOrderDate)}
                </td>
                <td className="px-5 py-4 text-center">
                  <button
                    type="button"
                    onClick={() => onSelect({
                      ...row,
                      type: 'CUSTOMER_RANKING',
                    })}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
                    aria-label={`Detail ${row.customer_name}`}
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

const TopCustomerPanel = ({ rows, onSelect }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
        <Award size={17} className="text-red-600" />
        Top Customer
      </div>
      <p className="mt-1 text-[11px] font-semibold text-slate-400">
        Top 10 customer berdasarkan revenue dari orchestrator.
      </p>
    </div>

    <div className="max-h-[680px] space-y-3 overflow-y-auto p-5">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm font-bold leading-relaxed text-amber-700">
          Top customer belum tersedia.
        </div>
      ) : (
        rows.map((row) => (
          <button
            key={`TOP-${row.id}-${row.rank}`}
            type="button"
            onClick={() => onSelect({
              ...row,
              type: 'TOP_CUSTOMER',
            })}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition-all hover:border-red-100 hover:bg-red-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Crown size={16} className="text-amber-500" />
                  <div className="text-sm font-black text-slate-900">
                    {row.customer_name}
                  </div>
                </div>
                <div className="mt-2 text-xs font-semibold text-slate-500">
                  Revenue {formatMoney(row.totalRevenue)} · Profit {formatMoney(row.totalProfit)}
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

const LoyalCustomerPanel = ({ rows, onSelect }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
        <UserCheck size={17} className="text-red-600" />
        Loyal Customer
      </div>
      <p className="mt-1 text-[11px] font-semibold text-slate-400">
        Customer dengan frekuensi order tertinggi dari orchestrator.
      </p>
    </div>

    <div className="max-h-[680px] space-y-3 overflow-y-auto p-5">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm font-bold leading-relaxed text-amber-700">
          Loyal customer belum tersedia.
        </div>
      ) : (
        rows.map((row) => (
          <button
            key={`LOYAL-${row.id}-${row.rank}`}
            type="button"
            onClick={() => onSelect({
              ...row,
              type: 'LOYAL_CUSTOMER',
            })}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition-all hover:border-red-100 hover:bg-red-50"
          >
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={row.category} />
              <span className="rounded-full border border-slate-100 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                Order {formatNumber(row.frequency)}
              </span>
            </div>

            <div className="mt-3 text-sm font-black text-slate-900">
              {row.customer_name}
            </div>

            <div className="mt-2 text-xs font-semibold text-slate-500">
              Last order {formatDateLabel(row.lastOrderDate)}
            </div>
          </button>
        ))
      )}
    </div>
  </div>
);

const InactiveCustomerPanel = ({ rows, onSelect }) => (
  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5">
      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
        <UserX size={17} className="text-red-600" />
        Inactive Customer
      </div>
      <p className="mt-1 text-[11px] font-semibold text-slate-400">
        Customer yang lama tidak order dari orchestrator.
      </p>
    </div>

    <div className="max-h-[680px] space-y-3 overflow-y-auto p-5">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold leading-relaxed text-emerald-700">
          Tidak ada inactive customer dari orchestrator.
        </div>
      ) : (
        rows.map((row) => (
          <button
            key={`INACTIVE-${row.id}-${row.rank}`}
            type="button"
            onClick={() => onSelect({
              ...row,
              type: 'INACTIVE_CUSTOMER',
            })}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition-all hover:border-red-100 hover:bg-red-50"
          >
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={row.category} />
              <span className="rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-red-700">
                {formatNumber(row.inactiveDays)} hari
              </span>
            </div>

            <div className="mt-3 text-sm font-black text-slate-900">
              {row.customer_name}
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Clock3 size={13} />
              Last order {formatDateLabel(row.lastOrderDate)}
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
          <Tag size={17} className="text-red-600" />
          Customer Category Analytics
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
            customer_name: row.category,
            category: row.category,
            type: 'CUSTOMER_CATEGORY_ANALYTICS',
            totalRevenue: row.revenue,
            totalProfit: row.profit,
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
              <Users size={18} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <div className="rounded-2xl bg-white p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                Jumlah Customer
              </div>
              <div className="mt-1 text-sm font-black text-slate-950">
                {formatNumber(row.customerCount)}
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
        Warning customer berasal dari orchestrator.
      </p>
    </div>

    <div className="max-h-[680px] space-y-3 overflow-y-auto p-5">
      {warnings.length === 0 ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold leading-relaxed text-emerald-700">
          Tidak ada warning customer dari orchestrator.
        </div>
      ) : (
        warnings.map((warning) => (
          <button
            key={warning.id}
            type="button"
            onClick={() => onSelect({
              ...warning,
              customer_name: warning.title,
              type: 'CUSTOMER_WARNING',
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

function TabCustomerAnalyticsDashboard(props = {}) {
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
    customer: '',
    category: 'ALL',
    branch: '',
    period: 'THIS_MONTH',
    search: '',
  });

  const [appliedFilters, setAppliedFilters] = useState({
    customer: '',
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
    customer: appliedFilters.customer,
    customer_id: appliedFilters.customer,
    category: appliedFilters.category === 'ALL' ? '' : appliedFilters.category,
    branch: appliedFilters.branch,
    branch_id: appliedFilters.branch,
    period: appliedFilters.period,
    search: appliedFilters.search,
    readonly: true,
  }), [
    appliedFilters.branch,
    appliedFilters.category,
    appliedFilters.customer,
    appliedFilters.period,
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
          error: error?.message || 'Gagal memuat Customer Analytics Dashboard.',
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
  const customerAnalytics = result.customerAnalytics;

  const rankingRows = getCustomerRankingRows(customerAnalytics);
  const topCustomerRows = getTopCustomerRows(customerAnalytics);
  const loyalCustomerRows = getLoyalCustomerRows(customerAnalytics);
  const inactiveCustomerRows = getInactiveCustomerRows(customerAnalytics);
  const categoryRows = getCategoryRows(customerAnalytics);
  const warningRows = getWarningRows(result);

  const totalCustomer = getSummaryValue(summary, customerAnalytics, [
    'totalCustomer',
    'totalCustomers',
    'customerCount',
    'customer_count',
  ]);

  const activeCustomer = getSummaryValue(summary, customerAnalytics, [
    'activeCustomer',
    'activeCustomers',
    'activeCustomerCount',
    'active_customer_count',
  ]);

  const inactiveCustomer = getSummaryValue(summary, customerAnalytics, [
    'inactiveCustomer',
    'inactiveCustomers',
    'inactiveCustomerCount',
    'inactive_customer_count',
  ]);

  const totalRevenueCustomer = getSummaryValue(summary, customerAnalytics, [
    'totalRevenueCustomer',
    'customerRevenue',
    'totalCustomerRevenue',
    'total_customer_revenue',
    'totalRevenue',
    'total_revenue',
  ]);

  const customerRetentionRate = getSummaryValue(summary, customerAnalytics, [
    'customerRetentionRate',
    'customer_retention_rate',
    'retentionRate',
    'retention_rate',
  ]);

  const bestCustomer = topCustomerRows[0]?.customer_name || '-';

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
      customer: '',
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
                <Users size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                ERP Customer Intelligence Layer
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              CUSTOMER ANALYTICS DASHBOARD
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Enterprise Customer Intelligence Dashboard untuk Owner. Semua analytics berasal dari erpOrchestrator.getOwnerAnalytics().
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
        <KpiCard title="Total Customer" value={formatNumber(totalCustomer)} icon={<Users size={18} />} tone="red" />
        <KpiCard title="Active Customer" value={formatNumber(activeCustomer)} icon={<UserCheck size={18} />} tone="green" />
        <KpiCard title="Inactive Customer" value={formatNumber(inactiveCustomer)} icon={<UserX size={18} />} tone="orange" />
        <KpiCard title="Total Revenue Customer" value={totalRevenueCustomer} icon={<DollarSign size={18} />} tone="blue" isMoney />
        <KpiCard title="Best Customer" value={bestCustomer} icon={<Crown size={18} />} tone="white" />
        <KpiCard title="Customer Retention Rate" value={customerRetentionRate} icon={<Activity size={18} />} tone="amber" isPercent />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <Filter size={17} className="text-red-600" />
              Filter Customer Analytics
            </div>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">
              Filter dikirim ke orchestrator. UI tidak menghitung ranking customer sendiri.
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
              <Users size={12} />
              Customer
            </span>
            <input
              type="text"
              value={filters.customer}
              onChange={(event) => handleFilterChange('customer', event.target.value)}
              placeholder="Customer"
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
              placeholder="Cari customer"
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
      ) : rankingRows.length === 0 && topCustomerRows.length === 0 && loyalCustomerRows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <CustomerRankingTable
            rows={rankingRows}
            onSelect={setSelectedItem}
          />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-4">
              <TopCustomerPanel
                rows={topCustomerRows}
                onSelect={setSelectedItem}
              />
            </div>

            <div className="xl:col-span-4">
              <LoyalCustomerPanel
                rows={loyalCustomerRows}
                onSelect={setSelectedItem}
              />
            </div>

            <div className="xl:col-span-4">
              <InactiveCustomerPanel
                rows={inactiveCustomerRows}
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

export default TabCustomerAnalyticsDashboard;
