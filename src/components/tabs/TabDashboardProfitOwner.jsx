import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BadgeDollarSign,
  Banknote,
  BarChart3,
  Boxes,
  Building2,
  CalendarClock,
  CheckCircle,
  Crown,
  Landmark,
  LockKeyhole,
  Package,
  PieChart,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Store,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  WalletCards,
} from 'lucide-react';

import erpOrchestrator from '../../utils/erpOrchestrator';

const PERIOD_OPTIONS = [
  { id: 'TODAY', label: 'Hari Ini' },
  { id: 'THIS_WEEK', label: 'Minggu Ini' },
  { id: 'THIS_MONTH', label: 'Bulan Ini' },
  { id: 'THIS_YEAR', label: 'Tahun Ini' },
  { id: 'CUSTOM', label: 'Custom Date' },
];

const CHANNELS = [
  { key: 'Offline', code: 'OFFLINE_RESTO', label: 'Offline', icon: Store },
  { key: 'GoFood', code: 'GOFOOD', label: 'GoFood', icon: ShoppingBag },
  { key: 'GrabFood', code: 'GRABFOOD', label: 'GrabFood', icon: ShoppingBag },
  { key: 'ShopeeFood', code: 'SHOPEEFOOD', label: 'ShopeeFood', icon: ShoppingBag },
  { key: 'TikTok', code: 'TIKTOK', label: 'TikTok', icon: ShoppingBag },
  { key: 'Franchise', code: 'FRANCHISE', label: 'Franchise', icon: Building2 },
];

const normalizeCode = (value) => {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^\w./-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const hasValue = (value) => {
  return value !== undefined && value !== null && value !== '';
};

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!hasValue(value)) return 0;

  const parsed = Number(
    String(value)
      .trim()
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.'),
  );

  return Number.isFinite(parsed) ? parsed : 0;
};

const safeArray = (value) => {
  return Array.isArray(value) ? value : [];
};

const pickValue = (row = {}, keys = []) => {
  for (const key of keys) {
    if (hasValue(row?.[key])) return row[key];
  }

  return undefined;
};

const formatMoney = (value) => {
  if (!hasValue(value)) return '-';
  return `Rp${Math.round(toNumber(value)).toLocaleString('id-ID')}`;
};

const formatPercent = (value) => {
  if (!hasValue(value)) return '-';
  return `${Number(toNumber(value).toFixed(2)).toLocaleString('id-ID')}%`;
};

const formatNumber = (value) => {
  if (!hasValue(value)) return '-';
  return Number(toNumber(value).toFixed(2)).toLocaleString('id-ID');
};

const getTodayStr = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const toDateInput = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return getTodayStr();

  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const formatDate = (value) => {
  if (!value) return '-';

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const resolveDateRange = (period, customStart, customEnd) => {
  const todayStr = getTodayStr();
  const today = new Date(`${todayStr}T00:00:00`);
  const year = today.getFullYear();
  const month = today.getMonth();

  if (period === 'CUSTOM') {
    return {
      startDate: customStart || todayStr,
      endDate: customEnd || todayStr,
    };
  }

  if (period === 'THIS_WEEK') {
    const day = today.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;

    const start = new Date(today);
    start.setDate(today.getDate() + mondayOffset);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return {
      startDate: toDateInput(start),
      endDate: toDateInput(end),
    };
  }

  if (period === 'THIS_MONTH') {
    return {
      startDate: toDateInput(new Date(year, month, 1)),
      endDate: toDateInput(new Date(year, month + 1, 0)),
    };
  }

  if (period === 'THIS_YEAR') {
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    };
  }

  return {
    startDate: todayStr,
    endDate: todayStr,
  };
};

const isOwnerRole = (user = {}) => {
  const role = normalizeCode(user.role || user.user_role || user.access_role || user.position || '');
  return ['OWNER', 'DEWA'].includes(role);
};

const getRowTitle = (row = {}, keys = []) => {
  return String(
    pickValue(row, keys) ||
      row.name ||
      row.label ||
      row.branch_name ||
      row.product_name ||
      row.customer_name ||
      row.supplier_name ||
      row.channel ||
      row.item_name ||
      row.id ||
      '-',
  );
};

const getRowSubtitle = (row = {}, keys = []) => {
  return String(
    pickValue(row, keys) ||
      row.branch_id ||
      row.product_id ||
      row.customer_id ||
      row.supplier_id ||
      row.item_id ||
      row.status ||
      '',
  );
};

const getRowMetric = (row = {}, keys = []) => {
  return pickValue(row, keys);
};

const getTrendTone = (direction) => {
  const normalized = normalizeCode(direction);

  if (normalized === 'UP') return 'text-emerald-700 bg-emerald-50 border-emerald-100';
  if (normalized === 'DOWN') return 'text-red-700 bg-red-50 border-red-100';

  return 'text-slate-600 bg-slate-50 border-slate-100';
};

const Badge = ({ children, tone = 'slate' }) => {
  const toneClass = {
    red: 'border-red-100 bg-red-50 text-red-700',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    gold: 'border-amber-100 bg-amber-50 text-amber-700',
    slate: 'border-slate-100 bg-slate-50 text-slate-600',
    dark: 'border-slate-800 bg-slate-950 text-white',
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${toneClass[tone] || toneClass.slate}`}>
      {children}
    </span>
  );
};

const KpiCard = ({ title, value, icon, tone = 'white', subtitle = '', trend = null }) => {
  const toneClass = {
    red: 'bg-red-600 text-white',
    dark: 'bg-slate-950 text-white',
    gold: 'border border-amber-100 bg-amber-50 text-amber-900',
    white: 'border border-slate-100 bg-white text-slate-900',
  };

  return (
    <div className={`rounded-[2rem] p-5 shadow-sm ${toneClass[tone] || toneClass.white}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">
            {title}
          </div>
          <div className="mt-2 break-words text-2xl font-black tracking-tight">
            {value}
          </div>
          {subtitle && (
            <div className="mt-1 text-[11px] font-bold opacity-70">
              {subtitle}
            </div>
          )}
          {trend && (
            <div className={`mt-3 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black ${getTrendTone(trend.direction)}`}>
              {normalizeCode(trend.direction) === 'DOWN' ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
              {formatPercent(trend.changePercent)}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/80 p-3 text-red-600 shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
};

const SectionCard = ({ title, subtitle, icon, children }) => (
  <div className="rounded-[2rem] border border-slate-100 bg-white shadow-sm">
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
      <div>
        <div className="flex items-center gap-2 text-sm font-black text-slate-900">
          <span className="text-red-600">{icon}</span>
          {title}
        </div>
        {subtitle && (
          <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-400">
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

const EmptyState = ({ text = 'Belum ada data dari orchestrator.' }) => (
  <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm font-bold leading-relaxed text-amber-800">
    {text}
  </div>
);

const RankList = ({
  rows,
  titleKeys = [],
  subtitleKeys = [],
  valueKeys = [],
  valueType = 'money',
}) => {
  const list = safeArray(rows);
  const maxValue = Math.max(
    1,
    ...list.map((row) => Math.abs(toNumber(getRowMetric(row, valueKeys)))),
  );

  if (list.length === 0) return <EmptyState />;

  return (
    <div className="space-y-3">
      {list.map((row, index) => {
        const metric = getRowMetric(row, valueKeys);
        const width = Math.max((Math.abs(toNumber(metric)) / maxValue) * 100, 4);
        const valueLabel = valueType === 'percent'
          ? formatPercent(metric)
          : valueType === 'number'
            ? formatNumber(metric)
            : formatMoney(metric);

        return (
          <div key={`${getRowTitle(row, titleKeys)}-${index}`} className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white">
                    {index + 1}
                  </span>
                  <div className="truncate text-sm font-black text-slate-900">
                    {getRowTitle(row, titleKeys)}
                  </div>
                </div>
                <div className="mt-1 truncate pl-8 text-[11px] font-bold text-slate-400">
                  {getRowSubtitle(row, subtitleKeys)}
                </div>
              </div>

              <div className="shrink-0 text-right text-sm font-black text-slate-900">
                {valueLabel}
              </div>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-red-600"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const MiniMetricCard = ({ title, value, icon, tone = 'white' }) => {
  const toneClass = {
    red: 'border-red-100 bg-red-50 text-red-900',
    gold: 'border-amber-100 bg-amber-50 text-amber-900',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-900',
    white: 'border-slate-100 bg-white text-slate-900',
    dark: 'border-slate-800 bg-slate-950 text-white',
  };

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${toneClass[tone] || toneClass.white}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-60">
            {title}
          </div>
          <div className="mt-2 text-xl font-black">
            {value}
          </div>
        </div>
        <div className="rounded-2xl bg-white/80 p-3 text-red-600 shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
};

const WarningCard = ({ warning }) => {
  const severity = normalizeCode(warning?.severity || '');
  const type = normalizeCode(warning?.type || warning?.id || '');
  const isCritical = severity === 'CRITICAL' || ['NEGATIVECASH', 'NEGATIVEPROFIT'].includes(type);
  const isInfo = severity === 'INFO' || type === 'BUSINESSHEALTHOK';

  const wrapperClass = isCritical
    ? 'border-red-100 bg-red-50'
    : isInfo
      ? 'border-emerald-100 bg-emerald-50'
      : 'border-amber-100 bg-amber-50';

  const textClass = isCritical
    ? 'text-red-900'
    : isInfo
      ? 'text-emerald-900'
      : 'text-amber-900';

  const Icon = isInfo ? CheckCircle : AlertTriangle;

  return (
    <div className={`rounded-[2rem] border p-5 shadow-sm ${wrapperClass}`}>
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-white p-3 text-red-600 shadow-sm">
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-black ${textClass}`}>
            {warning?.title || warning?.type || 'Warning'}
          </div>
          <div className={`mt-1 text-xs font-bold leading-relaxed ${textClass} opacity-80`}>
            {warning?.message || warning?.action_hint || '-'}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={isCritical ? 'red' : isInfo ? 'green' : 'gold'}>
              {warning?.severity || 'INFO'}
            </Badge>
            {hasValue(warning?.amount) && toNumber(warning.amount) !== 0 && (
              <Badge tone={isCritical ? 'red' : 'gold'}>
                {formatMoney(warning.amount)}
              </Badge>
            )}
            {hasValue(warning?.count) && toNumber(warning.count) > 0 && (
              <Badge tone="slate">
                {formatNumber(warning.count)} item
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const TrendCard = ({ title, trend, icon }) => {
  if (!trend) {
    return (
      <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
        <div className="text-sm font-black text-slate-900">{title}</div>
        <div className="mt-2 text-xs font-bold text-slate-400">Belum ada trend dari orchestrator.</div>
      </div>
    );
  }

  const direction = normalizeCode(trend.direction);
  const Icon = direction === 'DOWN' ? TrendingDown : TrendingUp;

  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            {title}
          </div>
          <div className="mt-2 text-xl font-black text-slate-900">
            {formatMoney(trend.currentValue)}
          </div>
          <div className="mt-1 text-[11px] font-bold text-slate-400">
            Previous: {formatMoney(trend.previousValue)}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-3 text-red-600 shadow-sm">
          {icon}
        </div>
      </div>

      <div className={`mt-4 inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-black ${getTrendTone(trend.direction)}`}>
        <Icon size={14} />
        {formatPercent(trend.changePercent)}
      </div>
    </div>
  );
};

const InventoryList = ({ rows, emptyText }) => {
  const list = safeArray(rows);

  if (list.length === 0) {
    return <EmptyState text={emptyText} />;
  }

  return (
    <div className="space-y-3">
      {list.slice(0, 8).map((item, index) => (
        <div key={`${item.item_id || item.item_name || index}`} className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-slate-900">
                {item.item_name || item.item_id || '-'}
              </div>
              <div className="mt-1 text-[11px] font-bold text-slate-400">
                {item.branch_id || '-'} · {item.warehouse_id || '-'}
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-sm font-black text-slate-900">
                {formatNumber(item.current_qty)}
              </div>
              <div className="mt-1 text-[10px] font-bold text-slate-400">
                Min: {formatNumber(item.minimum_qty)}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={normalizeCode(item.status) === 'CRITICAL' ? 'red' : normalizeCode(item.status) === 'LOW' ? 'gold' : 'slate'}>
              {item.status || 'STOCK'}
            </Badge>
            {item.last_movement_date && (
              <Badge tone="slate">
                Last: {formatDate(item.last_movement_date)}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const AccessDenied = () => (
  <div className="rounded-[2rem] border border-red-100 bg-red-50 p-8 text-center shadow-sm">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-red-600 shadow-sm">
      <LockKeyhole size={28} />
    </div>
    <h2 className="mt-4 text-2xl font-black text-red-900">
      ACCESS DENIED
    </h2>
    <p className="mx-auto mt-2 max-w-xl text-sm font-bold leading-relaxed text-red-700">
      Dashboard ini hanya bisa diakses oleh OWNER atau DEWA.
    </p>
  </div>
);

export default function TabDashboardProfitOwner({
  dbData = {},
  source = null,
  user = {},
}) {
  const [period, setPeriod] = useState('TODAY');
  const [customStart, setCustomStart] = useState(getTodayStr());
  const [customEnd, setCustomEnd] = useState(getTodayStr());
  const [refreshKey, setRefreshKey] = useState(0);

  const ownerAllowed = isOwnerRole(user);
  const dateRange = useMemo(() => resolveDateRange(period, customStart, customEnd), [period, customStart, customEnd]);
  const sourceData = source || dbData || {};

  const analyticsState = useMemo(() => {
    if (!ownerAllowed) {
      return {
        ok: false,
        status: 'ACCESS_DENIED',
        analytics: null,
        message: 'ACCESS DENIED',
      };
    }

    if (typeof erpOrchestrator?.getOwnerAnalytics !== 'function') {
      return {
        ok: false,
        status: 'MISSING_API',
        analytics: null,
        message: 'erpOrchestrator.getOwnerAnalytics() belum tersedia.',
      };
    }

    try {
      const analytics = erpOrchestrator.getOwnerAnalytics(
        {
          period,
          start_date: dateRange.startDate,
          end_date: dateRange.endDate,
          readonly: true,
          scope: 'OWNER_COMMAND_CENTER',
        },
        {
          source: sourceData,
          dbData: sourceData,
          user,
          readonly: true,
          executor: user?.email || user?.name || user?.username || 'OWNER_COMMAND_CENTER',
        },
      );

      return {
        ok: true,
        status: 'READY',
        analytics,
        message: '',
      };
    } catch (error) {
      return {
        ok: false,
        status: 'ERROR',
        analytics: null,
        message: error?.message || 'Gagal membaca Owner Analytics dari erpOrchestrator.',
      };
    }
  }, [ownerAllowed, period, dateRange.startDate, dateRange.endDate, sourceData, user, refreshKey]);

  if (!ownerAllowed) {
    return (
      <div className="space-y-6 pb-10 text-slate-700 normal-case">
        <AccessDenied />
      </div>
    );
  }

const analytics = analyticsState.analytics || {
  summary: {},
  branchAnalytics: {},
  productAnalytics: {},
  customerAnalytics: {},
  channelAnalytics: {},
  cashflowAnalytics: {},
  receivableAnalytics: {},
  payableAnalytics: {},
  inventoryAnalytics: {},
  warningCards: [],
  trendAnalytics: {},
};

const summary = analytics.summary || {};
const branchAnalytics = analytics.branchAnalytics || {};
const productAnalytics = analytics.productAnalytics || {};
const customerAnalytics = analytics.customerAnalytics || {};
const channelAnalytics = analytics.channelAnalytics || {};
const cashflowAnalytics = analytics.cashflowAnalytics || {};
const inventoryAnalytics = analytics.inventoryAnalytics || {};
const warningCards = safeArray(analytics.warningCards);
const trendAnalytics = analytics.trendAnalytics || {};

  const channelRows = CHANNELS.map((channel) => {
    const row = channelAnalytics[channel.key] || channelAnalytics[channel.code] || {};

    return {
      ...row,
      channel: row.channel || channel.code,
      label: channel.label,
      icon: channel.icon,
    };
  });

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm">
        <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-red-600/30 blur-2xl" />
        <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-amber-400/20 blur-2xl" />

        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="rounded-2xl bg-red-600 p-2 shadow-sm">
                <Crown size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                Owner Command Center
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              Dashboard Profit Owner
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Thin UI read only untuk membaca profit, cashflow, inventory, customer, channel, dan warning bisnis dari erpOrchestrator.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">ONE ERP HEART</Badge>
            <Badge tone="gold">READ ONLY</Badge>
            <Badge tone="green">getOwnerAnalytics()</Badge>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <CalendarClock size={17} className="text-red-600" />
              Filter Periode
            </div>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">
              Periode hanya dikirim ke orchestrator. UI tidak menghitung KPI sendiri.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-wrap gap-2">
              {PERIOD_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPeriod(item.id)}
                  className={`rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] transition-all ${
                    period === item.id
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:text-red-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {period === 'CUSTOM' && (
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
                />
                <input
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => setRefreshKey((prev) => prev + 1)}
              className="flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 transition-all hover:bg-amber-100"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="slate">
            {formatDate(dateRange.startDate)} — {formatDate(dateRange.endDate)}
          </Badge>
          <Badge tone={analyticsState.ok ? 'green' : 'red'}>
            {analyticsState.status}
          </Badge>
          {analytics?.generated_at && (
            <Badge tone="dark">
              Generated: {formatDate(analytics.generated_at)}
            </Badge>
          )}
        </div>
      </div>

      {!analyticsState.ok && (
        <div className="rounded-[2rem] border border-red-100 bg-red-50 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white p-3 text-red-600 shadow-sm">
              <AlertTriangle size={22} />
            </div>
            <div>
              <div className="text-sm font-black text-red-900">
                Dashboard belum bisa dimuat
              </div>
              <p className="mt-1 text-sm font-bold leading-relaxed text-red-700">
                {analyticsState.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {analyticsState.ok && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Total Omzet"
              value={formatMoney(summary.totalRevenue)}
              icon={<BadgeDollarSign size={18} />}
              tone="red"
              trend={trendAnalytics.revenueTrend}
            />
            <KpiCard
              title="Total HPP"
              value={formatMoney(summary.totalCOGS)}
              icon={<Package size={18} />}
              tone="white"
              subtitle="Dari orchestrator"
            />
            <KpiCard
              title="Gross Profit"
              value={formatMoney(summary.grossProfit)}
              icon={<Trophy size={18} />}
              tone="gold"
            />
            <KpiCard
              title="Net Profit"
              value={formatMoney(summary.netProfit)}
              icon={<TrendingUp size={18} />}
              tone={toNumber(summary.netProfit) < 0 ? 'dark' : 'white'}
              trend={trendAnalytics.profitTrend}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Profit Margin"
              value={formatPercent(summary.profitMargin)}
              icon={<Target size={18} />}
              tone={toNumber(summary.profitMargin) < 0 ? 'dark' : 'white'}
            />
            <KpiCard
              title="Cash In"
              value={formatMoney(summary.cashIn)}
              icon={<ArrowDownCircle size={18} />}
              tone="white"
            />
            <KpiCard
              title="Cash Out"
              value={formatMoney(summary.cashOut)}
              icon={<ArrowUpCircle size={18} />}
              tone="white"
            />
            <KpiCard
              title="Net Cashflow"
              value={formatMoney(summary.netCashflow)}
              icon={<Activity size={18} />}
              tone={toNumber(summary.netCashflow) < 0 ? 'dark' : 'gold'}
              trend={trendAnalytics.cashflowTrend}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <SectionCard
              title="Branch Analytics — Top Omzet"
              subtitle="Urutan sesuai hasil dari erpOrchestrator."
              icon={<Building2 size={17} />}
            >
              <RankList
                rows={branchAnalytics.topBranchRevenue}
                titleKeys={['branch_name', 'branch_id']}
                subtitleKeys={['branch_id']}
                valueKeys={['totalRevenue']}
              />
            </SectionCard>

            <SectionCard
              title="Branch Analytics — Top Profit"
              subtitle="Cabang dengan profit terbaik."
              icon={<Trophy size={17} />}
            >
              <RankList
                rows={branchAnalytics.topBranchProfit}
                titleKeys={['branch_name', 'branch_id']}
                subtitleKeys={['branch_id']}
                valueKeys={['netProfit', 'grossProfit']}
              />
            </SectionCard>

            <SectionCard
              title="Branch Analytics — Worst Branch"
              subtitle="Cabang dengan performa profit terendah."
              icon={<TrendingDown size={17} />}
            >
              <RankList
                rows={branchAnalytics.worstBranch}
                titleKeys={['branch_name', 'branch_id']}
                subtitleKeys={['branch_id']}
                valueKeys={['netProfit', 'grossProfit']}
              />
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <SectionCard
              title="Product Analytics — Produk Terlaris"
              subtitle="Berdasarkan qty sold dari orchestrator."
              icon={<ShoppingBag size={17} />}
            >
              <RankList
                rows={productAnalytics.topProducts}
                titleKeys={['product_name', 'product_id']}
                subtitleKeys={['product_id']}
                valueKeys={['qtySold']}
                valueType="number"
              />
            </SectionCard>

            <SectionCard
              title="Product Analytics — Profit Tertinggi"
              subtitle="Produk dengan kontribusi profit tertinggi."
              icon={<Trophy size={17} />}
            >
              <RankList
                rows={productAnalytics.topProfitProducts}
                titleKeys={['product_name', 'product_id']}
                subtitleKeys={['product_id']}
                valueKeys={['grossProfit', 'netProfit']}
              />
            </SectionCard>

            <SectionCard
              title="Product Analytics — Margin Terendah"
              subtitle="Produk yang perlu dievaluasi margin-nya."
              icon={<Target size={17} />}
            >
              <RankList
                rows={productAnalytics.lowMarginProducts}
                titleKeys={['product_name', 'product_id']}
                subtitleKeys={['product_id']}
                valueKeys={['profitMargin']}
                valueType="percent"
              />
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <SectionCard
              title="Customer Analytics — Top Customer"
              subtitle="Customer dengan omzet tertinggi."
              icon={<Users size={17} />}
            >
              <RankList
                rows={customerAnalytics.topCustomers}
                titleKeys={['customer_name', 'customer_id']}
                subtitleKeys={['customer_type', 'customer_id']}
                valueKeys={['totalRevenue']}
              />
            </SectionCard>

            <SectionCard
              title="Customer Analytics — Top Reseller"
              subtitle="Reseller terbaik dari master customer."
              icon={<Users size={17} />}
            >
              <RankList
                rows={customerAnalytics.topResellers}
                titleKeys={['customer_name', 'customer_id']}
                subtitleKeys={['customer_type', 'customer_id']}
                valueKeys={['totalRevenue']}
              />
            </SectionCard>

            <SectionCard
              title="Customer Analytics — Top Distributor"
              subtitle="Distributor terbaik dari master customer."
              icon={<Building2 size={17} />}
            >
              <RankList
                rows={customerAnalytics.topDistributors}
                titleKeys={['customer_name', 'customer_id']}
                subtitleKeys={['customer_type', 'customer_id']}
                valueKeys={['totalRevenue']}
              />
            </SectionCard>
          </div>

          <SectionCard
            title="Channel Analytics"
            subtitle="Offline, GoFood, GrabFood, ShopeeFood, TikTok, dan Franchise."
            icon={<PieChart size={17} />}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {channelRows.map((channel) => {
                const Icon = channel.icon;

                return (
                  <div key={channel.key || channel.label} className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-white p-3 text-red-600 shadow-sm">
                          <Icon size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-black text-slate-900">
                            {channel.label}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-slate-400">
                            {channel.channel || channel.code}
                          </div>
                        </div>
                      </div>

                      <Badge tone={toNumber(channel.totalRevenue) > 0 ? 'green' : 'slate'}>
                        {toNumber(channel.totalRevenue) > 0 ? 'ACTIVE' : 'NO DATA'}
                      </Badge>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                          Revenue
                        </div>
                        <div className="mt-1 text-sm font-black text-slate-900">
                          {formatMoney(channel.totalRevenue)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                          Profit
                        </div>
                        <div className="mt-1 text-sm font-black text-slate-900">
                          {formatMoney(channel.netProfit)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                          Margin
                        </div>
                        <div className="mt-1 text-sm font-black text-slate-900">
                          {formatPercent(channel.profitMargin)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                          Trx
                        </div>
                        <div className="mt-1 text-sm font-black text-slate-900">
                          {formatNumber(channel.transactionCount)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            title="Cashflow Analytics"
            subtitle="Saldo kas, bank, piutang, hutang, dan cash position dari orchestrator."
            icon={<WalletCards size={17} />}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MiniMetricCard
                title="Cash Balance"
                value={formatMoney(cashflowAnalytics.cashBalance)}
                icon={<Banknote size={18} />}
              />
              <MiniMetricCard
                title="Bank Balance"
                value={formatMoney(cashflowAnalytics.bankBalance)}
                icon={<Landmark size={18} />}
              />
              <MiniMetricCard
                title="Receivable"
                value={formatMoney(cashflowAnalytics.receivableBalance)}
                icon={<Users size={18} />}
                tone="gold"
              />
              <MiniMetricCard
                title="Payable"
                value={formatMoney(cashflowAnalytics.payableBalance)}
                icon={<WalletCards size={18} />}
              />
              <MiniMetricCard
                title="Cash Position"
                value={formatMoney(cashflowAnalytics.cashPosition)}
                icon={<ShieldCheck size={18} />}
                tone={toNumber(cashflowAnalytics.cashPosition) < 0 ? 'dark' : 'red'}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Inventory Analytics"
            subtitle="Critical stock, low stock, dan dead stock dari orchestrator."
            icon={<Boxes size={17} />}
          >
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-slate-900">Critical Stock</div>
                  <Badge tone="red">{safeArray(inventoryAnalytics.criticalStock).length} item</Badge>
                </div>
                <InventoryList rows={inventoryAnalytics.criticalStock} emptyText="Tidak ada stok kritis." />
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-slate-900">Low Stock</div>
                  <Badge tone="gold">{safeArray(inventoryAnalytics.lowStock).length} item</Badge>
                </div>
                <InventoryList rows={inventoryAnalytics.lowStock} emptyText="Tidak ada low stock." />
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-slate-900">Dead Stock</div>
                  <Badge tone="slate">{safeArray(inventoryAnalytics.deadStock).length} item</Badge>
                </div>
                <InventoryList rows={inventoryAnalytics.deadStock} emptyText="Tidak ada dead stock." />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Warning Cards"
            subtitle="Cash negatif, piutang overdue, hutang overdue, stok kritis, dan profit negatif."
            icon={<AlertTriangle size={17} />}
          >
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {warningCards.length > 0 ? (
                warningCards.map((warning, index) => (
                  <WarningCard key={`${warning.id || warning.type || index}`} warning={warning} />
                ))
              ) : (
                <EmptyState text="Tidak ada warning dari orchestrator." />
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Trend Analytics"
            subtitle="Trend revenue, profit, cashflow, dan transaksi dari orchestrator."
            icon={<BarChart3 size={17} />}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TrendCard
                title="Revenue Trend"
                trend={trendAnalytics.revenueTrend}
                icon={<TrendingUp size={18} />}
              />
              <TrendCard
                title="Profit Trend"
                trend={trendAnalytics.profitTrend}
                icon={<Trophy size={18} />}
              />
              <TrendCard
                title="Cashflow Trend"
                trend={trendAnalytics.cashflowTrend}
                icon={<Activity size={18} />}
              />
              <TrendCard
                title="Transaction Trend"
                trend={trendAnalytics.transactionTrend}
                icon={<BarChart3 size={18} />}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Read Only Compliance"
            subtitle="Dashboard ini tidak memiliki write action."
            icon={<CheckCircle size={17} />}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                <div className="text-sm font-black text-emerald-900">No Insert</div>
                <div className="mt-1 text-[11px] font-bold text-emerald-700">
                  Tidak ada create transaksi.
                </div>
              </div>
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                <div className="text-sm font-black text-emerald-900">No Update</div>
                <div className="mt-1 text-[11px] font-bold text-emerald-700">
                  Tidak ada edit transaksi.
                </div>
              </div>
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                <div className="text-sm font-black text-emerald-900">No Delete</div>
                <div className="mt-1 text-[11px] font-bold text-emerald-700">
                  Tidak ada hapus transaksi.
                </div>
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
