import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Banknote,
  BarChart3,
  Clock3,
  CreditCard,
  DollarSign,
  FileText,
  Gauge,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import erpOrchestrator from '../../utils/erpOrchestrator';

const EMPTY_OBJECT = Object.freeze({});

const DEFAULT_OWNER_RESULT = {
  summary: {},
  financialAnalytics: {},
  profitAnalytics: {},
  cashflowAnalytics: {},
  receivableAnalytics: {},
  payableAnalytics: {},
  warningCards: [],
  warnings: [],
  metadata: {},
};

const DEFAULT_CASHFLOW_RESULT = {
  summary: {},
  records: [],
  trends: [],
  trendSummary: {},
  cashTrendSummary: {},
  riskCards: [],
  warningCards: [],
  warnings: [],
  metadata: {},
};

const DEFAULT_RADAR_RESULT = {
  summary: {},
  records: [],
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

const stringifySummary = (value, fallback = '-') => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
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
    financialAnalytics: safeObject(source.financialAnalytics || source.financial_analytics),
    profitAnalytics: safeObject(source.profitAnalytics || source.profit_analytics),
    cashflowAnalytics: safeObject(source.cashflowAnalytics || source.cashflow_analytics),
    receivableAnalytics: safeObject(source.receivableAnalytics || source.receivable_analytics),
    payableAnalytics: safeObject(source.payableAnalytics || source.payable_analytics),
    warningCards: safeArray(source.warningCards || source.warning_cards),
    warnings: safeArray(source.warnings),
    metadata: safeObject(source.metadata),
  };
};

const mergeCashflowDefaults = (result) => {
  const source = safeObject(result);

  return {
    ...DEFAULT_CASHFLOW_RESULT,
    ...source,
    summary: safeObject(source.summary),
    records: safeArray(source.records),
    trends: safeArray(source.trends || source.cashflowTrends || source.cashflow_trends),
    trendSummary: safeObject(source.trendSummary || source.trend_summary),
    cashTrendSummary: safeObject(source.cashTrendSummary || source.cash_trend_summary),
    riskCards: safeArray(source.riskCards || source.risk_cards),
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
    financialRadar: safeArray(source.financialRadar || source.financial_radar),
    riskCards: safeArray(source.riskCards || source.risk_cards),
    ownerActionCenter: safeArray(source.ownerActionCenter || source.owner_action_center),
    recommendations: safeArray(source.recommendations),
    warnings: safeArray(source.warnings),
    metadata: safeObject(source.metadata),
  };
};

const normalizeRiskRow = (row = {}, index = 0) => ({
  id: row.id || row.code || row.reference_number || `FINANCIAL-RISK-${index + 1}`,
  severity: row.severity || row.priority || row.level || row.status || 'INFO',
  title: row.title || row.name || row.code || 'Financial Risk',
  message: row.message || row.description || row.notes || '',
  recommendation: row.recommendation || row.action_hint || row.actionHint || '',
  amount: row.amount || row.value || 0,
  raw: row,
});

const normalizeInsightRow = (row = {}, index = 0) => ({
  id: row.id || row.code || row.reference_number || `FINANCIAL-INSIGHT-${index + 1}`,
  severity: row.severity || row.priority || row.level || row.status || 'INFO',
  title: row.title || row.name || row.code || 'Financial Insight',
  message: row.message || row.description || row.notes || '',
  recommendation: row.recommendation || row.action_hint || row.actionHint || '',
  raw: row,
});

const getFinancialRiskRows = (radarResult = {}) => {
  const rows = [
    ...safeArray(radarResult.financialRadar),
    ...safeArray(radarResult.riskCards),
    ...safeArray(radarResult.ownerActionCenter),
    ...safeArray(radarResult.records),
  ];

  return rows.slice(0, 8).map((row, index) => normalizeRiskRow(row, index));
};

const getFinancialInsightRows = (ownerResult = {}, cashflowResult = {}, radarResult = {}) => {
  const rows = [
    ...safeArray(ownerResult.warningCards),
    ...safeArray(ownerResult.warnings),
    ...safeArray(cashflowResult.riskCards),
    ...safeArray(cashflowResult.warningCards),
    ...safeArray(cashflowResult.warnings),
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

const KpiCard = ({ title, value, icon, tone = 'white', isMoney = true, isPercent = false }) => {
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

const FinancialCard = ({ title, subtitle, icon, children }) => (
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
      Financial Analytics Dashboard hanya bisa diakses oleh OWNER, DEWA, MONITOR_DEWA, atau HO_TANGERANG.
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
          Gagal memuat Financial Analytics Dashboard.
        </div>
        <p className="mt-1 text-sm font-bold leading-relaxed text-red-700">
          {message || 'Terjadi kesalahan saat membaca ERP Financial Command Center.'}
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

const MetricTile = ({ title, value, icon, isMoney = true, isPercent = false }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
      {icon}
      {title}
    </div>
    <div className="mt-2 text-lg font-black text-slate-950">
      {isPercent ? formatPercent(value) : isMoney ? formatMoney(value) : formatNumber(value)}
    </div>
  </div>
);

const ProfitabilitySection = ({ summary, financialAnalytics, profitAnalytics }) => {
  const grossMargin = getFirstValueFrom(
    [profitAnalytics, financialAnalytics, summary],
    ['grossMargin', 'gross_margin', 'grossProfitMargin', 'gross_profit_margin'],
    0,
  );

  const netMargin = getFirstValueFrom(
    [profitAnalytics, financialAnalytics, summary],
    ['netMargin', 'net_margin', 'netProfitMargin', 'net_profit_margin', 'profitMargin', 'profit_margin'],
    0,
  );

  const ebitda = getFirstValueFrom(
    [profitAnalytics, financialAnalytics, summary],
    ['ebitda', 'EBITDA'],
    0,
  );

  const trendSummary = getFirstStringFrom(
    [profitAnalytics, financialAnalytics, summary],
    ['profitTrendSummary', 'profit_trend_summary', 'trendSummary', 'trend_summary', 'summaryText'],
    '',
  );

  return (
    <FinancialCard
      title="Profitability Analytics"
      subtitle="Gross Margin, Net Margin, EBITDA, dan Profit Trend Summary dari orchestrator."
      icon={<Gauge size={17} className="text-red-600" />}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricTile title="Gross Margin" value={grossMargin} icon={<BarChart3 size={13} />} isMoney={false} isPercent />
        <MetricTile title="Net Margin" value={netMargin} icon={<TrendingUp size={13} />} isMoney={false} isPercent />
        <MetricTile title="EBITDA" value={ebitda} icon={<DollarSign size={13} />} />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-950 p-4 text-white">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          Profit Trend Summary
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-200">
          {trendSummary || 'Profit trend summary belum tersedia dari orchestrator.'}
        </p>
      </div>
    </FinancialCard>
  );
};

const CashflowSection = ({ cashflowResult }) => {
  const summary = cashflowResult.summary;

  const cashIn = getFirstValue(summary, ['cashIn', 'cash_in', 'totalCashIn', 'total_cash_in'], 0);
  const cashOut = getFirstValue(summary, ['cashOut', 'cash_out', 'totalCashOut', 'total_cash_out'], 0);
  const netCashflow = getFirstValue(summary, ['netCashflow', 'net_cashflow'], 0);

  const cashTrend = getFirstStringFrom(
    [cashflowResult.cashTrendSummary, cashflowResult.trendSummary, summary],
    ['summary', 'message', 'title', 'trendSummary', 'cashTrend', 'cash_trend'],
    '',
  );

  return (
    <FinancialCard
      title="Cashflow Analytics"
      subtitle="Cash In, Cash Out, Net Cashflow, dan Cash Trend dari erpOrchestrator.getCashflowDashboard()."
      icon={<Wallet size={17} className="text-red-600" />}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricTile title="Cash In" value={cashIn} icon={<TrendingUp size={13} />} />
        <MetricTile title="Cash Out" value={cashOut} icon={<TrendingDown size={13} />} />
        <MetricTile title="Net Cashflow" value={netCashflow} icon={<Activity size={13} />} />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          Cash Trend
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-700">
          {cashTrend || 'Cash trend belum tersedia dari orchestrator.'}
        </p>
      </div>
    </FinancialCard>
  );
};

const ReceivableSection = ({ summary, receivableAnalytics }) => {
  const totalPiutang = getFirstValueFrom(
    [receivableAnalytics, summary],
    ['totalPiutang', 'total_piutang', 'receivableBalance', 'receivable_balance', 'totalReceivable', 'total_receivable'],
    0,
  );

  const overduePiutang = getFirstValueFrom(
    [receivableAnalytics, summary],
    ['overduePiutang', 'overdue_piutang', 'overdueReceivable', 'overdue_receivable', 'totalOverdue'],
    0,
  );

  const agingSummary = getFirstValueFrom(
    [receivableAnalytics, summary],
    ['agingSummary', 'aging_summary', 'aging', 'agingBuckets', 'aging_buckets'],
    null,
  );

  return (
    <FinancialCard
      title="Receivable Analytics"
      subtitle="Total Piutang, Overdue Piutang, dan Aging Summary dari orchestrator."
      icon={<FileText size={17} className="text-red-600" />}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <MetricTile title="Total Piutang" value={totalPiutang} icon={<DollarSign size={13} />} />
        <MetricTile title="Overdue Piutang" value={overduePiutang} icon={<Clock3 size={13} />} />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          Aging Summary
        </div>
        <pre className="mt-2 max-h-[220px] overflow-auto whitespace-pre-wrap text-xs font-semibold leading-relaxed text-slate-700">
          {stringifySummary(agingSummary, 'Aging summary piutang belum tersedia dari orchestrator.')}
        </pre>
      </div>
    </FinancialCard>
  );
};

const PayableSection = ({ summary, payableAnalytics }) => {
  const totalHutang = getFirstValueFrom(
    [payableAnalytics, summary],
    ['totalHutang', 'total_hutang', 'payableBalance', 'payable_balance', 'totalPayable', 'total_payable'],
    0,
  );

  const jatuhTempo = getFirstValueFrom(
    [payableAnalytics, summary],
    ['jatuhTempo', 'jatuh_tempo', 'duePayable', 'due_payable', 'dueAmount', 'due_amount'],
    0,
  );

  const agingSummary = getFirstValueFrom(
    [payableAnalytics, summary],
    ['agingSummary', 'aging_summary', 'aging', 'agingBuckets', 'aging_buckets'],
    null,
  );

  return (
    <FinancialCard
      title="Payable Analytics"
      subtitle="Total Hutang, Jatuh Tempo, dan Aging Summary dari orchestrator."
      icon={<CreditCard size={17} className="text-red-600" />}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <MetricTile title="Total Hutang" value={totalHutang} icon={<Banknote size={13} />} />
        <MetricTile title="Jatuh Tempo" value={jatuhTempo} icon={<Clock3 size={13} />} />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          Aging Summary
        </div>
        <pre className="mt-2 max-h-[220px] overflow-auto whitespace-pre-wrap text-xs font-semibold leading-relaxed text-slate-700">
          {stringifySummary(agingSummary, 'Aging summary hutang belum tersedia dari orchestrator.')}
        </pre>
      </div>
    </FinancialCard>
  );
};

const FinancialRiskPanel = ({ rows }) => (
  <FinancialCard
    title="Financial Risk Panel"
    subtitle="Risk berasal dari erpOrchestrator.getBusinessRadar()."
    icon={<ShieldAlert size={17} className="text-red-600" />}
  >
    <div className="max-h-[620px] space-y-3 overflow-y-auto">
      {rows.length === 0 ? (
        <EmptyMiniState text="Financial risk belum tersedia dari orchestrator." />
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
  </FinancialCard>
);

const FinancialInsightPanel = ({ rows }) => (
  <FinancialCard
    title="Financial Insight Panel"
    subtitle="Insight hanya berasal dari orchestrator."
    icon={<Activity size={17} className="text-red-600" />}
  >
    <div className="max-h-[620px] space-y-3 overflow-y-auto">
      {rows.length === 0 ? (
        <EmptyMiniState text="Financial insight belum tersedia dari orchestrator." />
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
  </FinancialCard>
);

function TabFinancialAnalyticsDashboard(props = {}) {
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
    cashflowResult: DEFAULT_CASHFLOW_RESULT,
    radarResult: DEFAULT_RADAR_RESULT,
  });

  const requestInput = useMemo(() => ({
    readonly: true,
    dashboard: 'FINANCIAL_ANALYTICS',
    includeFinancialAnalytics: true,
    includeProfitAnalytics: true,
    includeCashflowAnalytics: true,
    includeReceivableAnalytics: true,
    includePayableAnalytics: true,
  }), []);

  useEffect(() => {
    if (!ownerAllowed) {
      setDashboardState({
        loading: false,
        error: '',
        ownerResult: DEFAULT_OWNER_RESULT,
        cashflowResult: DEFAULT_CASHFLOW_RESULT,
        radarResult: DEFAULT_RADAR_RESULT,
      });
      return;
    }

    const missingApi = [
      ['getOwnerAnalytics', erpOrchestrator?.getOwnerAnalytics],
      ['getCashflowDashboard', erpOrchestrator?.getCashflowDashboard],
      ['getBusinessRadar', erpOrchestrator?.getBusinessRadar],
    ].find(([, api]) => typeof api !== 'function');

    if (missingApi) {
      setDashboardState({
        loading: false,
        error: `erpOrchestrator.${missingApi[0]}() belum tersedia.`,
        ownerResult: DEFAULT_OWNER_RESULT,
        cashflowResult: DEFAULT_CASHFLOW_RESULT,
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
      erpOrchestrator.getCashflowDashboard(requestInput, context),
      erpOrchestrator.getBusinessRadar(requestInput, context),
    ])
      .then(([ownerResult, cashflowResult, radarResult]) => {
        if (!isMounted) return;

        setDashboardState({
          loading: false,
          error: '',
          ownerResult: mergeOwnerDefaults(ownerResult),
          cashflowResult: mergeCashflowDefaults(cashflowResult),
          radarResult: mergeRadarDefaults(radarResult),
        });
      })
      .catch((error) => {
        if (!isMounted) return;

        setDashboardState({
          loading: false,
          error: error?.message || 'Gagal memuat Financial Analytics Dashboard.',
          ownerResult: DEFAULT_OWNER_RESULT,
          cashflowResult: DEFAULT_CASHFLOW_RESULT,
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
  const cashflowResult = mergeCashflowDefaults(dashboardState.cashflowResult);
  const radarResult = mergeRadarDefaults(dashboardState.radarResult);

  const summary = ownerResult.summary;
  const financialAnalytics = ownerResult.financialAnalytics;
  const profitAnalytics = ownerResult.profitAnalytics;
  const cashflowAnalytics = ownerResult.cashflowAnalytics;
  const receivableAnalytics = ownerResult.receivableAnalytics;
  const payableAnalytics = ownerResult.payableAnalytics;
  const cashflowSummary = cashflowResult.summary;

  const revenue = getFirstValueFrom(
    [financialAnalytics, profitAnalytics, summary],
    ['revenue', 'totalRevenue', 'total_revenue', 'omzet'],
    0,
  );

  const grossProfit = getFirstValueFrom(
    [financialAnalytics, profitAnalytics, summary],
    ['grossProfit', 'gross_profit', 'totalGrossProfit', 'total_gross_profit'],
    0,
  );

  const netProfit = getFirstValueFrom(
    [financialAnalytics, profitAnalytics, summary],
    ['netProfit', 'net_profit', 'totalProfit', 'total_profit'],
    0,
  );

  const profitMargin = getFirstValueFrom(
    [financialAnalytics, profitAnalytics, summary],
    ['profitMargin', 'profit_margin', 'netMargin', 'net_margin', 'netProfitMargin', 'net_profit_margin'],
    0,
  );

  const cashPosition = getFirstValueFrom(
    [cashflowSummary, cashflowAnalytics, financialAnalytics, summary],
    ['cashPosition', 'cash_position', 'currentCashPosition', 'current_cash_position', 'cashBalance', 'cash_balance'],
    0,
  );

  const operatingExpense = getFirstValueFrom(
    [financialAnalytics, profitAnalytics, summary],
    ['operatingExpense', 'operating_expense', 'opex', 'totalExpense', 'total_expense'],
    0,
  );

  const outstandingPiutang = getFirstValueFrom(
    [receivableAnalytics, financialAnalytics, summary, cashflowSummary],
    ['outstandingPiutang', 'outstanding_piutang', 'receivableBalance', 'receivable_balance', 'totalReceivable', 'total_receivable'],
    0,
  );

  const outstandingHutang = getFirstValueFrom(
    [payableAnalytics, financialAnalytics, summary, cashflowSummary],
    ['outstandingHutang', 'outstanding_hutang', 'payableBalance', 'payable_balance', 'totalPayable', 'total_payable'],
    0,
  );

  const financialRiskRows = getFinancialRiskRows(radarResult);
  const financialInsightRows = getFinancialInsightRows(ownerResult, cashflowResult, radarResult);

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
                <Wallet size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                ERP Financial Command Center
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              FINANCIAL ANALYTICS DASHBOARD
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Owner Financial Command Center untuk memantau revenue, profit, margin, cashflow, piutang, hutang, risk, dan insight dari orchestrator.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                OWNER FINANCIAL COMMAND CENTER
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
            REFRESH FINANCIAL DASHBOARD
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
            <KpiCard title="Revenue" value={revenue} icon={<DollarSign size={18} />} tone="red" />
            <KpiCard title="Gross Profit" value={grossProfit} icon={<TrendingUp size={18} />} tone="green" />
            <KpiCard title="Net Profit" value={netProfit} icon={<Activity size={18} />} tone="blue" />
            <KpiCard title="Profit Margin" value={profitMargin} icon={<Gauge size={18} />} tone="amber" isMoney={false} isPercent />
            <KpiCard title="Cash Position" value={cashPosition} icon={<Wallet size={18} />} tone="white" />
            <KpiCard title="Operating Expense" value={operatingExpense} icon={<Banknote size={18} />} tone="orange" />
            <KpiCard title="Outstanding Piutang" value={outstandingPiutang} icon={<FileText size={18} />} tone="white" />
            <KpiCard title="Outstanding Hutang" value={outstandingHutang} icon={<CreditCard size={18} />} tone="white" />
          </div>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <ProfitabilitySection
                summary={summary}
                financialAnalytics={financialAnalytics}
                profitAnalytics={profitAnalytics}
              />
            </div>

            <div className="xl:col-span-5">
              <CashflowSection cashflowResult={cashflowResult} />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-6">
              <ReceivableSection
                summary={summary}
                receivableAnalytics={receivableAnalytics}
              />
            </div>

            <div className="xl:col-span-6">
              <PayableSection
                summary={summary}
                payableAnalytics={payableAnalytics}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-6">
              <FinancialRiskPanel rows={financialRiskRows} />
            </div>

            <div className="xl:col-span-6">
              <FinancialInsightPanel rows={financialInsightRows} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default TabFinancialAnalyticsDashboard;
