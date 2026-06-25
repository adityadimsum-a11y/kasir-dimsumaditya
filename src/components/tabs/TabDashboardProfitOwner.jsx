import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BadgeDollarSign,
  Banknote,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle,
  Crown,
  Filter,
  Landmark,
  LockKeyhole,
  Package,
  PieChart,
  ReceiptText,
  RefreshCw,
  Search,
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

import { getTodayStr, formatDate } from '../../utils/helpers';
import erpOrchestrator from '../../services/erpOrchestrator';

const PERIOD_OPTIONS = [
  { id: 'TODAY', label: 'Hari Ini' },
  { id: 'THIS_WEEK', label: 'Minggu Ini' },
  { id: 'THIS_MONTH', label: 'Bulan Ini' },
  { id: 'THIS_YEAR', label: 'Tahun Ini' },
  { id: 'CUSTOM', label: 'Custom Date' },
];

const CHANNEL_ORDER = [
  'GOFOOD',
  'GRABFOOD',
  'SHOPEEFOOD',
  'OFFLINE_RESTO',
  'RESELLER',
  'FRANCHISE',
];

const normalizeCode = (value) => {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^\w./-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const normalizeText = (value) => {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
};

const safeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.records)) return value.records;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (value && typeof value === 'object') return Object.values(value).filter((item) => item && typeof item === 'object');
  return [];
};

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === undefined || value === null || value === '') return 0;

  const parsed = Number(
    String(value)
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.'),
  );

  return Number.isFinite(parsed) ? parsed : 0;
};

const roundMoney = (value) => {
  return Math.round(toNumber(value) * 100) / 100;
};

const roundPercent = (value) => {
  return Math.round(toNumber(value) * 100) / 100;
};

const formatMoney = (value) => {
  return `Rp${roundMoney(value).toLocaleString('id-ID')}`;
};

const formatPercent = (value) => {
  return `${roundPercent(value).toLocaleString('id-ID')}%`;
};

const normalizeDate = (value) => {
  if (!value) return '';

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return raw.substring(0, 10);

  return parsed.toISOString().substring(0, 10);
};

const toDateInput = (date) => {
  const parsed = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(parsed.getTime())) return getTodayStr();

  return parsed.toISOString().substring(0, 10);
};

const getFirstValue = (...values) => {
  return values.find((value) => value !== undefined && value !== null && value !== '');
};

const getFirstNumber = (...values) => {
  const found = getFirstValue(...values);
  return roundMoney(found || 0);
};

const getFirstPercent = (...values) => {
  const found = getFirstValue(...values);
  return roundPercent(found || 0);
};

const resolveDateRange = ({ period, customStart, customEnd, todayStr }) => {
  const today = new Date(`${todayStr}T00:00:00`);
  const year = today.getFullYear();
  const month = today.getMonth();

  if (period === 'CUSTOM') {
    return {
      start_date: customStart || todayStr,
      end_date: customEnd || todayStr,
      label: `${customStart || todayStr} sampai ${customEnd || todayStr}`,
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
      start_date: toDateInput(start),
      end_date: toDateInput(end),
      label: 'Minggu ini',
    };
  }

  if (period === 'THIS_MONTH') {
    return {
      start_date: toDateInput(new Date(year, month, 1)),
      end_date: toDateInput(new Date(year, month + 1, 0)),
      label: 'Bulan ini',
    };
  }

  if (period === 'THIS_YEAR') {
    return {
      start_date: `${year}-01-01`,
      end_date: `${year}-12-31`,
      label: 'Tahun ini',
    };
  }

  return {
    start_date: todayStr,
    end_date: todayStr,
    label: 'Hari ini',
  };
};

const normalizeRankRows = (source, config = {}) => {
  const {
    nameKeys = ['name', 'label', 'title'],
    valueKeys = ['value', 'amount', 'total', 'omzet', 'profit', 'margin', 'qty'],
    subtitleKeys = ['subtitle', 'description', 'code', 'id'],
    limit = 5,
    valueType = 'money',
  } = config;

  return safeArray(source)
    .map((row, index) => {
      const name = getFirstValue(
        ...nameKeys.map((key) => row?.[key]),
        row?.branch_name,
        row?.product_name,
        row?.customer_name,
        row?.supplier_name,
        row?.sales_channel,
        row?.channel,
        row?.branch_id,
        row?.product_id,
        row?.customer_id,
        row?.id,
        `Data ${index + 1}`,
      );

      const value = getFirstNumber(
        ...valueKeys.map((key) => row?.[key]),
        row?.total_amount,
        row?.total_omzet,
        row?.total_profit,
        row?.net_profit,
        row?.gross_profit,
        row?.outstanding_balance,
        row?.qty,
      );

      const subtitle = getFirstValue(
        ...subtitleKeys.map((key) => row?.[key]),
        row?.branch_id,
        row?.product_id,
        row?.customer_id,
        row?.sales_channel,
        row?.channel,
        '',
      );

      const marginPercent = getFirstPercent(
        row?.margin_percent,
        row?.profit_margin_percent,
        row?.margin,
      );

      return {
        id: String(row?.id || row?.code || row?.branch_id || row?.product_id || row?.customer_id || row?.sales_channel || index),
        name: String(name || `Data ${index + 1}`),
        subtitle: String(subtitle || ''),
        value,
        value_type: valueType,
        margin_percent: marginPercent,
        raw: row,
      };
    })
    .filter((row) => row.name)
    .slice(0, limit);
};

const normalizeChannelRows = (source) => {
  const rows = normalizeRankRows(source, {
    nameKeys: ['sales_channel', 'channel', 'name', 'label'],
    valueKeys: ['omzet', 'total_omzet', 'sales', 'value', 'amount', 'total_amount'],
    subtitleKeys: ['total_transactions', 'transactions', 'count', 'subtitle'],
    limit: 20,
  });

  const map = new Map();

  rows.forEach((row) => {
    map.set(normalizeCode(row.name), row);
  });

  return CHANNEL_ORDER.map((channel) => {
    const row = map.get(channel);

    return row || {
      id: channel,
      name: channel,
      subtitle: 'Belum ada data dari orchestrator',
      value: 0,
      value_type: 'money',
      margin_percent: 0,
      raw: null,
    };
  });
};

const normalizeWarnings = ({ rawWarnings, metrics }) => {
  const orchestratorWarnings = safeArray(rawWarnings).map((warning, index) => {
    const type = normalizeCode(warning?.type || warning?.code || warning?.warning_type || `WARNING_${index + 1}`);

    return {
      id: String(warning?.id || type || index),
      type,
      title: String(warning?.title || warning?.message || type.replaceAll('_', ' ')),
      message: String(warning?.message || warning?.description || warning?.notes || ''),
      severity: normalizeCode(warning?.severity || warning?.level || 'WARNING'),
      amount: roundMoney(warning?.amount || warning?.value || 0),
      raw: warning,
    };
  });

  if (orchestratorWarnings.length > 0) return orchestratorWarnings;

  const derived = [];

  if (metrics.cashflow.cash_position < 0) {
    derived.push({
      id: 'CASH_NEGATIF',
      type: 'CASH_NEGATIF',
      title: 'Cash negatif',
      message: 'Cash position dari orchestrator berada di bawah nol.',
      severity: 'CRITICAL',
      amount: metrics.cashflow.cash_position,
    });
  }

  if (metrics.cashflow.total_piutang_overdue > 0) {
    derived.push({
      id: 'PIUTANG_OVERDUE_TINGGI',
      type: 'PIUTANG_OVERDUE_TINGGI',
      title: 'Piutang overdue tinggi',
      message: 'Ada piutang overdue yang perlu ditagih.',
      severity: 'WARNING',
      amount: metrics.cashflow.total_piutang_overdue,
    });
  }

  if (metrics.cashflow.total_hutang_due > 0) {
    derived.push({
      id: 'HUTANG_JATUH_TEMPO',
      type: 'HUTANG_JATUH_TEMPO',
      title: 'Hutang jatuh tempo',
      message: 'Ada hutang supplier yang perlu diprioritaskan.',
      severity: 'WARNING',
      amount: metrics.cashflow.total_hutang_due,
    });
  }

  if (metrics.inventory.critical_stock_count > 0) {
    derived.push({
      id: 'STOK_KRITIS',
      type: 'STOK_KRITIS',
      title: 'Stok kritis',
      message: `${metrics.inventory.critical_stock_count} item stok kritis menurut orchestrator.`,
      severity: 'WARNING',
      amount: metrics.inventory.critical_stock_count,
    });
  }

  if (metrics.kpi.net_profit < 0) {
    derived.push({
      id: 'PROFIT_NEGATIF',
      type: 'PROFIT_NEGATIF',
      title: 'Profit negatif',
      message: 'Net profit periode ini negatif.',
      severity: 'CRITICAL',
      amount: metrics.kpi.net_profit,
    });
  }

  if (derived.length === 0) {
    derived.push({
      id: 'BUSINESS_HEALTH_OK',
      type: 'BUSINESS_HEALTH_OK',
      title: 'Tidak ada warning kritis',
      message: 'Tidak ada warning kritis yang dikirim dari orchestrator untuk periode ini.',
      severity: 'INFO',
      amount: 0,
    });
  }

  return derived;
};

const normalizeMetricsResponse = ({ response, apiName, dateRange }) => {
  const base = response?.owner_analytics ||
    response?.dashboard_metrics ||
    response?.metrics ||
    response?.data ||
    response?.dashboard ||
    response ||
    {};

  const kpiSource = base.kpi || base.financial || base.profit || base.summary || {};
  const cashflowSource = base.cashflow || base.cash_flow || base.cash || {};
  const analyticsSource = base.analytics || base.owner_analytics || base.breakdown || {};
  const branchSource = analyticsSource.cabang || analyticsSource.branch || analyticsSource.branches || base.branch_analytics || {};
  const productSource = analyticsSource.produk || analyticsSource.product || analyticsSource.products || base.product_analytics || {};
  const customerSource = analyticsSource.customer || analyticsSource.customers || base.customer_analytics || {};
  const channelSource = analyticsSource.channel || analyticsSource.channels || base.channel_analytics || {};
  const inventorySource = base.inventory || base.stock || base.inventory_analytics || {};

  const totalOmzet = getFirstNumber(
    kpiSource.total_omzet,
    kpiSource.omzet,
    kpiSource.revenue,
    kpiSource.sales,
    base.total_omzet,
  );

  const totalHpp = getFirstNumber(
    kpiSource.total_hpp,
    kpiSource.hpp,
    kpiSource.cogs,
    kpiSource.total_cogs,
    base.total_hpp,
  );

  const grossProfit = getFirstNumber(
    kpiSource.gross_profit,
    kpiSource.laba_kotor,
    totalOmzet - totalHpp,
  );

  const netProfit = getFirstNumber(
    kpiSource.net_profit,
    kpiSource.laba_bersih,
    kpiSource.operating_profit,
    base.net_profit,
    grossProfit,
  );

  const profitMarginPercent = getFirstPercent(
    kpiSource.profit_margin_percent,
    kpiSource.margin_percent,
    totalOmzet > 0 ? (netProfit / totalOmzet) * 100 : 0,
  );

  const cashIn = getFirstNumber(
    kpiSource.cash_in,
    cashflowSource.cash_in,
    cashflowSource.money_in,
    base.cash_in,
  );

  const cashOut = getFirstNumber(
    kpiSource.cash_out,
    cashflowSource.cash_out,
    cashflowSource.money_out,
    base.cash_out,
  );

  const cashflowBersih = getFirstNumber(
    kpiSource.cashflow_bersih,
    cashflowSource.cashflow_bersih,
    cashflowSource.net_cashflow,
    cashIn - cashOut,
  );

  const saldoKas = getFirstNumber(
    cashflowSource.saldo_kas,
    cashflowSource.cash_balance,
    cashflowSource.total_cash,
  );

  const saldoBank = getFirstNumber(
    cashflowSource.saldo_bank,
    cashflowSource.bank_balance,
    cashflowSource.total_bank,
  );

  const totalPiutang = getFirstNumber(
    cashflowSource.total_piutang,
    cashflowSource.receivable,
    cashflowSource.account_receivable,
    base.total_piutang,
  );

  const totalHutang = getFirstNumber(
    cashflowSource.total_hutang,
    cashflowSource.payable,
    cashflowSource.account_payable,
    base.total_hutang,
  );

  const cashPosition = getFirstNumber(
    cashflowSource.cash_position,
    cashflowSource.net_cash_position,
    saldoKas + saldoBank + totalPiutang - totalHutang,
  );

  const metrics = {
    api_name: apiName,
    generated_at: response?.generated_at || base.generated_at || new Date().toISOString(),
    date_range: dateRange,

    kpi: {
      total_omzet: totalOmzet,
      total_hpp: totalHpp,
      gross_profit: grossProfit,
      net_profit: netProfit,
      profit_margin_percent: profitMarginPercent,
      cash_in: cashIn,
      cash_out: cashOut,
      cashflow_bersih: cashflowBersih,
      trends: {
        total_omzet: getFirstPercent(kpiSource?.trends?.total_omzet, kpiSource?.trend_total_omzet),
        net_profit: getFirstPercent(kpiSource?.trends?.net_profit, kpiSource?.trend_net_profit),
        cashflow_bersih: getFirstPercent(kpiSource?.trends?.cashflow_bersih, kpiSource?.trend_cashflow_bersih),
      },
    },

    cashflow: {
      saldo_kas: saldoKas,
      saldo_bank: saldoBank,
      total_piutang: totalPiutang,
      total_hutang: totalHutang,
      cash_position: cashPosition,
      total_piutang_overdue: getFirstNumber(
        cashflowSource.total_piutang_overdue,
        cashflowSource.overdue_receivable,
        cashflowSource.overdue_receivable_amount,
      ),
      total_hutang_due: getFirstNumber(
        cashflowSource.total_hutang_due,
        cashflowSource.payable_due,
        cashflowSource.due_payable_amount,
      ),
    },

    inventory: {
      critical_stock_count: toNumber(
        getFirstValue(
          inventorySource.critical_stock_count,
          inventorySource.stok_kritis,
          inventorySource.critical_count,
          0,
        ),
      ),
    },

    analytics: {
      branches: {
        top_omzet: normalizeRankRows(branchSource.top_omzet || branchSource.top_revenue || branchSource.omzet, {
          nameKeys: ['branch_name', 'name', 'branch_id'],
          valueKeys: ['total_omzet', 'omzet', 'revenue', 'value'],
          subtitleKeys: ['branch_id', 'branch_code'],
        }),
        top_profit: normalizeRankRows(branchSource.top_profit || branchSource.profit, {
          nameKeys: ['branch_name', 'name', 'branch_id'],
          valueKeys: ['net_profit', 'gross_profit', 'profit', 'value'],
          subtitleKeys: ['branch_id', 'branch_code'],
        }),
        cabang_rugi: normalizeRankRows(branchSource.cabang_rugi || branchSource.loss_branches || branchSource.loss, {
          nameKeys: ['branch_name', 'name', 'branch_id'],
          valueKeys: ['loss', 'net_profit', 'profit', 'value'],
          subtitleKeys: ['branch_id', 'branch_code'],
        }),
      },

      products: {
        produk_terlaris: normalizeRankRows(productSource.produk_terlaris || productSource.best_selling || productSource.top_qty, {
          nameKeys: ['product_name', 'name', 'product_id'],
          valueKeys: ['qty', 'total_qty', 'sold_qty', 'value'],
          subtitleKeys: ['product_id', 'product_code'],
          valueType: 'qty',
        }),
        produk_profit_tertinggi: normalizeRankRows(productSource.produk_profit_tertinggi || productSource.top_profit || productSource.profit, {
          nameKeys: ['product_name', 'name', 'product_id'],
          valueKeys: ['profit', 'gross_profit', 'net_profit', 'value'],
          subtitleKeys: ['product_id', 'product_code'],
        }),
        produk_margin_terendah: normalizeRankRows(productSource.produk_margin_terendah || productSource.lowest_margin || productSource.margin_low, {
          nameKeys: ['product_name', 'name', 'product_id'],
          valueKeys: ['margin_percent', 'profit_margin_percent', 'margin', 'value'],
          subtitleKeys: ['product_id', 'product_code'],
          valueType: 'percent',
        }),
      },

      customers: {
        top_customer: normalizeRankRows(customerSource.top_customer || customerSource.customer || customerSource.top, {
          nameKeys: ['customer_name', 'name', 'customer_id'],
          valueKeys: ['total_omzet', 'omzet', 'revenue', 'value'],
          subtitleKeys: ['customer_id', 'customer_type'],
        }),
        top_reseller: normalizeRankRows(customerSource.top_reseller || customerSource.reseller, {
          nameKeys: ['customer_name', 'name', 'customer_id'],
          valueKeys: ['total_omzet', 'omzet', 'revenue', 'value'],
          subtitleKeys: ['customer_id', 'customer_type'],
        }),
        top_distributor: normalizeRankRows(customerSource.top_distributor || customerSource.distributor, {
          nameKeys: ['customer_name', 'name', 'customer_id'],
          valueKeys: ['total_omzet', 'omzet', 'revenue', 'value'],
          subtitleKeys: ['customer_id', 'customer_type'],
        }),
      },

      channels: normalizeChannelRows(
        channelSource.channel_breakdown ||
        channelSource.breakdown ||
        channelSource.sales_channel ||
        channelSource,
      ),
    },
  };

  return {
    ...metrics,
    warnings: normalizeWarnings({
      rawWarnings: base.warnings || base.alerts || base.warning_system || response?.warnings,
      metrics,
    }),
    raw_response: response,
  };
};

const getMaxValue = (rows) => {
  return Math.max(...safeArray(rows).map((row) => Math.abs(toNumber(row.value))), 1);
};

const getDisplayValue = (row) => {
  if (row.value_type === 'percent') return formatPercent(row.value);
  if (row.value_type === 'qty') return toNumber(row.value).toLocaleString('id-ID');
  return formatMoney(row.value);
};

const Badge = ({ children, tone = 'slate' }) => {
  const toneMap = {
    red: 'bg-red-50 text-red-700 border-red-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
    dark: 'bg-slate-900 text-white border-slate-900',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black ${toneMap[tone] || toneMap.slate}`}>
      {children}
    </span>
  );
};

const TrendBadge = ({ value }) => {
  const numeric = roundPercent(value);
  const isPositive = numeric >= 0;

  return (
    <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${
      isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
    }`}>
      {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {formatPercent(numeric)}
    </div>
  );
};

const KpiCard = ({ title, value, icon, tone = 'white', subtitle = '', trend = null }) => {
  const toneMap = {
    red: 'bg-red-600 text-white',
    white: 'bg-white text-slate-800 border border-slate-100',
    gold: 'bg-amber-50 text-amber-800 border border-amber-100',
    dark: 'bg-slate-950 text-white',
  };

  return (
    <div className={`rounded-[2rem] p-5 shadow-sm ${toneMap[tone] || toneMap.white}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{title}</div>
          <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
          {subtitle && (
            <div className="mt-1 text-[11px] font-bold opacity-70">{subtitle}</div>
          )}
          {trend !== null && (
            <div className="mt-3">
              <TrendBadge value={trend} />
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-white/50 bg-white/80 p-3 text-red-600 shadow-sm">
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
        <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
          <span className="text-red-600">{icon}</span>
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-[11px] font-semibold text-slate-400">{subtitle}</p>
        )}
      </div>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const RankList = ({ rows, emptyText = 'Belum ada data dari orchestrator.' }) => {
  const maxValue = getMaxValue(rows);

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm font-bold text-amber-800">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => {
        const width = Math.max((Math.abs(toNumber(row.value)) / maxValue) * 100, 4);

        return (
          <div key={`${row.id}-${index}`} className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white">
                    {index + 1}
                  </span>
                  <div className="text-sm font-black text-slate-900">{row.name}</div>
                </div>
                {row.subtitle && (
                  <div className="mt-1 pl-8 text-[11px] font-bold text-slate-400">{row.subtitle}</div>
                )}
              </div>
              <div className="text-right text-sm font-black text-slate-900">{getDisplayValue(row)}</div>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-red-600"
                style={{ width: `${width}%` }}
              />
            </div>

            {row.margin_percent !== 0 && row.value_type !== 'percent' && (
              <div className="mt-2 text-right text-[11px] font-bold text-slate-400">
                Margin {formatPercent(row.margin_percent)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const WarningCard = ({ warning }) => {
  const severity = normalizeCode(warning.severity);
  const isCritical = severity === 'CRITICAL' || warning.type === 'PROFIT_NEGATIF' || warning.type === 'CASH_NEGATIF';
  const isInfo = severity === 'INFO';

  return (
    <div className={`rounded-[2rem] border p-5 shadow-sm ${
      isCritical
        ? 'border-red-100 bg-red-50'
        : isInfo
          ? 'border-emerald-100 bg-emerald-50'
          : 'border-amber-100 bg-amber-50'
    }`}>
      <div className="flex items-start gap-4">
        <div className={`rounded-2xl bg-white p-3 shadow-sm ${
          isCritical ? 'text-red-600' : isInfo ? 'text-emerald-700' : 'text-amber-700'
        }`}>
          {isInfo ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-black ${isCritical ? 'text-red-900' : isInfo ? 'text-emerald-900' : 'text-amber-900'}`}>
            {warning.title}
          </div>
          <div className={`mt-1 text-xs font-bold ${isCritical ? 'text-red-700' : isInfo ? 'text-emerald-700' : 'text-amber-700'}`}>
            {warning.message || warning.type}
          </div>
          {toNumber(warning.amount) !== 0 && (
            <div className="mt-3">
              <Badge tone={isCritical ? 'red' : 'amber'}>{formatMoney(warning.amount)}</Badge>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AccessDenied = () => (
  <div className="rounded-[2rem] border border-red-100 bg-red-50 p-8 text-center shadow-sm">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-red-600 shadow-sm">
      <LockKeyhole size={28} />
    </div>
    <h2 className="mt-4 text-xl font-black text-red-900">Akses Owner Dashboard Ditolak</h2>
    <p className="mx-auto mt-2 max-w-xl text-sm font-bold leading-relaxed text-red-700">
      Dashboard Profit Owner hanya dapat diakses oleh role OWNER atau DEWA. Modul ini bersifat read only dan khusus Owner Command Center.
    </p>
  </div>
);

export default function TabDashboardProfitOwner({
  dbData = {},
  user,
  showToast,
}) {
  const todayStr = getTodayStr();

  const [period, setPeriod] = useState('TODAY');
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(todayStr);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [dashboardState, setDashboardState] = useState({
    status: 'IDLE',
    dependencyMissing: false,
    apiName: '',
    message: '',
    metrics: null,
  });

  const role = normalizeCode(user?.role || user?.user_role || user?.access_role || '');
  const isOwnerAllowed = ['OWNER', 'DEWA', 'AKUN_DEWA'].includes(role);

  const dateRange = useMemo(() => {
    return resolveDateRange({
      period,
      customStart,
      customEnd,
      todayStr,
    });
  }, [period, customStart, customEnd, todayStr]);

  const notify = (message, type = 'success') => {
    if (typeof showToast === 'function') {
      showToast(message, type);
    }
  };

  useEffect(() => {
    if (!isOwnerAllowed) return;

    let isMounted = true;

    const loadMetrics = async () => {
      const hasOwnerAnalytics = typeof erpOrchestrator?.getOwnerAnalytics === 'function';
      const hasDashboardMetrics = typeof erpOrchestrator?.getDashboardMetrics === 'function';

      if (!hasOwnerAnalytics && !hasDashboardMetrics) {
        if (!isMounted) return;

        setDashboardState({
          status: 'DEPENDENCY_MISSING',
          dependencyMissing: true,
          apiName: '',
          message: 'Dependency belum tersedia: erpOrchestrator.getOwnerAnalytics() atau erpOrchestrator.getDashboardMetrics().',
          metrics: null,
        });

        return;
      }

      const apiName = hasOwnerAnalytics ? 'getOwnerAnalytics' : 'getDashboardMetrics';
      const api = hasOwnerAnalytics ? erpOrchestrator.getOwnerAnalytics : erpOrchestrator.getDashboardMetrics;

      setIsLoading(true);

      try {
        const input = {
          scope: 'OWNER',
          readonly: true,
          period,
          start_date: dateRange.start_date,
          end_date: dateRange.end_date,
          requested_kpi: [
            'TOTAL_OMZET',
            'TOTAL_HPP',
            'GROSS_PROFIT',
            'NET_PROFIT',
            'PROFIT_MARGIN_PERCENT',
            'CASH_IN',
            'CASH_OUT',
            'CASHFLOW_BERSIH',
          ],
          requested_analytics: [
            'CABANG',
            'PRODUK',
            'CUSTOMER',
            'CHANNEL',
            'CASHFLOW',
            'WARNING_SYSTEM',
          ],
        };

        const context = {
          source: dbData,
          dbData,
          masterData: dbData,
          user,
          executor: user?.email || user?.name || 'OWNER_DASHBOARD',
          readonly: true,
        };

        const response = await Promise.resolve(api(input, context));

        if (!isMounted) return;

        const metrics = normalizeMetricsResponse({
          response,
          apiName,
          dateRange,
        });

        setDashboardState({
          status: 'READY',
          dependencyMissing: false,
          apiName,
          message: '',
          metrics,
        });
      } catch (error) {
        if (!isMounted) return;

        setDashboardState({
          status: 'ERROR',
          dependencyMissing: false,
          apiName,
          message: error?.message || 'Gagal mengambil Owner Analytics dari erpOrchestrator.',
          metrics: null,
        });

        notify(error?.message || 'Gagal mengambil Owner Analytics.', 'error');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadMetrics();

    return () => {
      isMounted = false;
    };
  }, [isOwnerAllowed, period, dateRange, refreshKey, dbData, user]);

  const metrics = dashboardState.metrics;

  const filteredChannelRows = useMemo(() => {
    const keyword = normalizeText(searchQuery);

    if (!metrics?.analytics?.channels) return [];

    if (!keyword) return metrics.analytics.channels;

    return metrics.analytics.channels.filter((row) => {
      return normalizeText(`${row.name} ${row.subtitle}`).includes(keyword);
    });
  }, [metrics, searchQuery]);

  if (!isOwnerAllowed) {
    return (
      <div className="space-y-6 pb-10 text-slate-700 normal-case">
        <AccessDenied />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm">
        <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-red-600/30 blur-2xl" />
        <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-amber-400/20 blur-2xl" />

        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
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
              Pusat kontrol keuntungan dan kesehatan bisnis Dimsum Aditya. Dashboard ini read only dan seluruh data berasal dari erpOrchestrator.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">OWNER ONLY</Badge>
            <Badge tone="amber">READ ONLY</Badge>
            <Badge tone="green">{dashboardState.apiName || 'ORCHESTRATOR API'}</Badge>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
              <Filter size={17} className="text-red-600" />
              Filter Periode
            </h2>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">
              Periode dikirim sebagai parameter ke orchestrator. UI tidak membaca tabel transaksi langsung.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-wrap gap-2">
              {PERIOD_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPeriod(item.id)}
                  className={`rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] transition-all ${
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
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none focus:border-red-500"
                />
                <input
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none focus:border-red-500"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => setRefreshKey((prev) => prev + 1)}
              className="flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-amber-700 transition-all hover:bg-amber-100"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone="slate">
            <CalendarClock size={12} className="mr-1" />
            {dateRange.start_date ? formatDate(dateRange.start_date) : '-'} — {dateRange.end_date ? formatDate(dateRange.end_date) : '-'}
          </Badge>
          <Badge tone="dark">Generated: {metrics?.generated_at ? formatDate(metrics.generated_at) : '-'}</Badge>
        </div>
      </div>

      {dashboardState.dependencyMissing && (
        <div className="rounded-[2rem] border border-red-100 bg-red-50 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white p-3 text-red-600 shadow-sm">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h2 className="text-sm font-black text-red-900">Dependency Orchestrator Belum Tersedia</h2>
              <p className="mt-1 text-sm font-bold leading-relaxed text-red-700">
                {dashboardState.message}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="red">Tambahkan di src/services/erpOrchestrator.js</Badge>
                <Badge tone="dark">UI tidak boleh fallback baca tabel langsung</Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {dashboardState.status === 'ERROR' && (
        <div className="rounded-[2rem] border border-red-100 bg-red-50 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white p-3 text-red-600 shadow-sm">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h2 className="text-sm font-black text-red-900">Gagal Memuat Dashboard</h2>
              <p className="mt-1 text-sm font-bold leading-relaxed text-red-700">
                {dashboardState.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {metrics && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Total Omzet"
              value={formatMoney(metrics.kpi.total_omzet)}
              icon={<ReceiptText size={18} />}
              tone="red"
              trend={metrics.kpi.trends.total_omzet}
            />
            <KpiCard
              title="Total HPP"
              value={formatMoney(metrics.kpi.total_hpp)}
              icon={<Package size={18} />}
              tone="white"
              subtitle="COGS aktual dari orchestrator"
            />
            <KpiCard
              title="Gross Profit"
              value={formatMoney(metrics.kpi.gross_profit)}
              icon={<BadgeDollarSign size={18} />}
              tone="gold"
            />
            <KpiCard
              title="Net Profit"
              value={formatMoney(metrics.kpi.net_profit)}
              icon={<TrendingUp size={18} />}
              tone={metrics.kpi.net_profit < 0 ? 'dark' : 'white'}
              trend={metrics.kpi.trends.net_profit}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Profit Margin"
              value={formatPercent(metrics.kpi.profit_margin_percent)}
              icon={<Target size={18} />}
              tone={metrics.kpi.profit_margin_percent < 0 ? 'dark' : 'white'}
            />
            <KpiCard
              title="Cash In"
              value={formatMoney(metrics.kpi.cash_in)}
              icon={<ArrowDownCircle size={18} />}
              tone="white"
            />
            <KpiCard
              title="Cash Out"
              value={formatMoney(metrics.kpi.cash_out)}
              icon={<ArrowUpCircle size={18} />}
              tone="white"
            />
            <KpiCard
              title="Cashflow Bersih"
              value={formatMoney(metrics.kpi.cashflow_bersih)}
              icon={<Activity size={18} />}
              tone={metrics.kpi.cashflow_bersih < 0 ? 'dark' : 'gold'}
              trend={metrics.kpi.trends.cashflow_bersih}
            />
          </div>

          <SectionCard
            title="Cashflow & Cash Position"
            subtitle="Saldo kas, bank, piutang, hutang, dan cash position dari orchestrator."
            icon={<WalletCards size={17} />}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <KpiCard title="Saldo Kas" value={formatMoney(metrics.cashflow.saldo_kas)} icon={<Banknote size={18} />} tone="white" />
              <KpiCard title="Saldo Bank" value={formatMoney(metrics.cashflow.saldo_bank)} icon={<Landmark size={18} />} tone="white" />
              <KpiCard title="Total Piutang" value={formatMoney(metrics.cashflow.total_piutang)} icon={<Users size={18} />} tone="gold" />
              <KpiCard title="Total Hutang" value={formatMoney(metrics.cashflow.total_hutang)} icon={<WalletCards size={18} />} tone="white" />
              <KpiCard title="Cash Position" value={formatMoney(metrics.cashflow.cash_position)} icon={<ShieldCheck size={18} />} tone={metrics.cashflow.cash_position < 0 ? 'dark' : 'red'} />
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <SectionCard
              title="Cabang — Top Omzet"
              subtitle="Cabang dengan omzet tertinggi."
              icon={<Building2 size={17} />}
            >
              <RankList rows={metrics.analytics.branches.top_omzet} />
            </SectionCard>

            <SectionCard
              title="Cabang — Top Profit"
              subtitle="Cabang dengan profit tertinggi."
              icon={<Trophy size={17} />}
            >
              <RankList rows={metrics.analytics.branches.top_profit} />
            </SectionCard>

            <SectionCard
              title="Cabang Rugi"
              subtitle="Cabang dengan profit negatif."
              icon={<TrendingDown size={17} />}
            >
              <RankList rows={metrics.analytics.branches.cabang_rugi} />
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <SectionCard
              title="Produk Terlaris"
              subtitle="Produk dengan kuantitas penjualan tertinggi."
              icon={<ShoppingBag size={17} />}
            >
              <RankList rows={metrics.analytics.products.produk_terlaris} />
            </SectionCard>

            <SectionCard
              title="Produk Profit Tertinggi"
              subtitle="Produk dengan kontribusi profit terbesar."
              icon={<Trophy size={17} />}
            >
              <RankList rows={metrics.analytics.products.produk_profit_tertinggi} />
            </SectionCard>

            <SectionCard
              title="Produk Margin Terendah"
              subtitle="Produk yang margin-nya perlu dievaluasi."
              icon={<Target size={17} />}
            >
              <RankList rows={metrics.analytics.products.produk_margin_terendah} />
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <SectionCard
              title="Top Customer"
              subtitle="Customer dengan omzet tertinggi."
              icon={<Users size={17} />}
            >
              <RankList rows={metrics.analytics.customers.top_customer} />
            </SectionCard>

            <SectionCard
              title="Top Reseller"
              subtitle="Reseller dengan performa tertinggi."
              icon={<Users size={17} />}
            >
              <RankList rows={metrics.analytics.customers.top_reseller} />
            </SectionCard>

            <SectionCard
              title="Top Distributor"
              subtitle="Distributor dengan kontribusi omzet tertinggi."
              icon={<Building2 size={17} />}
            >
              <RankList rows={metrics.analytics.customers.top_distributor} />
            </SectionCard>
          </div>

          <SectionCard
            title="Channel Performance"
            subtitle="GoFood, GrabFood, ShopeeFood, Offline, Reseller, dan Franchise."
            icon={<PieChart size={17} />}
          >
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:w-80">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-xs font-bold outline-none transition-all placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50"
                  placeholder="Cari channel..."
                />
              </div>
              <Badge tone="amber">Channel data dari orchestrator</Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredChannelRows.map((row) => (
                <div key={row.id} className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-white p-3 text-red-600 shadow-sm">
                        {row.name === 'OFFLINE_RESTO' ? <Store size={17} /> : <ShoppingBag size={17} />}
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900">{row.name}</div>
                        <div className="mt-1 text-[11px] font-bold text-slate-400">{row.subtitle || 'Sales channel'}</div>
                      </div>
                    </div>
                    <Badge tone={row.value > 0 ? 'green' : 'slate'}>{row.value > 0 ? 'ACTIVE' : 'NO DATA'}</Badge>
                  </div>

                  <div className="mt-4 text-xl font-black text-slate-900">
                    {formatMoney(row.value)}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Warning System"
            subtitle="Alert kesehatan bisnis dari orchestrator dan indikator dari metrics orchestrator."
            icon={<AlertTriangle size={17} />}
          >
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {metrics.warnings.map((warning) => (
                <WarningCard key={warning.id} warning={warning} />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Read Only Audit"
            subtitle="Dashboard ini tidak memiliki write action."
            icon={<BarChart3 size={17} />}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-emerald-700" />
                  <div>
                    <div className="text-sm font-black text-emerald-900">No Insert</div>
                    <div className="mt-1 text-[11px] font-bold text-emerald-700">Tidak ada create transaksi.</div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-emerald-700" />
                  <div>
                    <div className="text-sm font-black text-emerald-900">No Update</div>
                    <div className="mt-1 text-[11px] font-bold text-emerald-700">Tidak ada edit transaksi.</div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-emerald-700" />
                  <div>
                    <div className="text-sm font-black text-emerald-900">No Delete</div>
                    <div className="mt-1 text-[11px] font-bold text-emerald-700">Tidak ada hapus transaksi.</div>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
