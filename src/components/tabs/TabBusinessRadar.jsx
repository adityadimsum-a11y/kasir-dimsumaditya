import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeDollarSign,
  Banknote,
  BarChart3,
  Boxes,
  Building2,
  CalendarClock,
  CheckCircle,
  Crown,
  Gauge,
  Landmark,
  LockKeyhole,
  Package,
  PieChart,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  WalletCards,
  Zap,
} from 'lucide-react';

import erpOrchestrator from '../../utils/erpOrchestrator';

const PERIOD_OPTIONS = [
  { id: 'TODAY', label: 'Hari Ini' },
  { id: 'THIS_WEEK', label: 'Minggu Ini' },
  { id: 'THIS_MONTH', label: 'Bulan Ini' },
  { id: 'THIS_YEAR', label: 'Tahun Ini' },
  { id: 'CUSTOM', label: 'Custom Date' },
];

const DEFAULT_ANALYTICS = {
  summary: {},
  branchAnalytics: {
    topBranchRevenue: [],
    topBranchProfit: [],
    worstBranch: [],
  },
  productAnalytics: {
    topProducts: [],
    topProfitProducts: [],
    lowMarginProducts: [],
  },
  customerAnalytics: {
    topCustomers: [],
    topResellers: [],
    topDistributors: [],
  },
  channelAnalytics: {},
  cashflowAnalytics: {},
  receivableAnalytics: {},
  payableAnalytics: {},
  inventoryAnalytics: {
    criticalStock: [],
    lowStock: [],
    deadStock: [],
  },
  warningCards: [],
  trendAnalytics: {},
};

const CHANNEL_KEYS = [
  { key: 'Offline', label: 'Offline', icon: ShoppingBag },
  { key: 'GoFood', label: 'GoFood', icon: ShoppingBag },
  { key: 'GrabFood', label: 'GrabFood', icon: ShoppingBag },
  { key: 'ShopeeFood', label: 'ShopeeFood', icon: ShoppingBag },
  { key: 'TikTok', label: 'TikTok', icon: ShoppingBag },
  { key: 'Franchise', label: 'Franchise', icon: Building2 },
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

const clampScore = (value) => {
  return Math.max(0, Math.min(100, Math.round(toNumber(value))));
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

const mergeAnalyticsDefaults = (analytics) => {
  const source = analytics || {};

  return {
    ...DEFAULT_ANALYTICS,
    ...source,
    summary: source.summary || {},
    branchAnalytics: {
      ...DEFAULT_ANALYTICS.branchAnalytics,
      ...(source.branchAnalytics || {}),
    },
    productAnalytics: {
      ...DEFAULT_ANALYTICS.productAnalytics,
      ...(source.productAnalytics || {}),
    },
    customerAnalytics: {
      ...DEFAULT_ANALYTICS.customerAnalytics,
      ...(source.customerAnalytics || {}),
    },
    channelAnalytics: source.channelAnalytics || {},
    cashflowAnalytics: source.cashflowAnalytics || {},
    receivableAnalytics: source.receivableAnalytics || {},
    payableAnalytics: source.payableAnalytics || {},
    inventoryAnalytics: {
      ...DEFAULT_ANALYTICS.inventoryAnalytics,
      ...(source.inventoryAnalytics || {}),
    },
    warningCards: safeArray(source.warningCards),
    trendAnalytics: source.trendAnalytics || {},
  };
};

const getHealthCategory = (score) => {
  const value = clampScore(score);

  if (value >= 85) return 'Sangat Sehat';
  if (value >= 70) return 'Sehat';
  if (value >= 55) return 'Waspada';
  if (value >= 35) return 'Bahaya';

  return 'Kritis';
};

const getScoreTone = (score) => {
  const value = clampScore(score);

  if (value >= 85) return 'green';
  if (value >= 70) return 'gold';
  if (value >= 55) return 'amber';
  if (value >= 35) return 'red';

  return 'dark';
};

const getRiskTone = (severity) => {
  const normalized = normalizeCode(severity);

  if (normalized === 'CRITICAL' || normalized === 'HIGH' || normalized === 'BAHAYA' || normalized === 'KRITIS') {
    return 'red';
  }

  if (normalized === 'WARNING' || normalized === 'MEDIUM' || normalized === 'WASPADA') {
    return 'gold';
  }

  if (normalized === 'INFO' || normalized === 'LOW' || normalized === 'AMAN') {
    return 'green';
  }

  return 'slate';
};

const getTrendDirection = (trend = {}) => {
  return normalizeCode(trend.direction || '');
};

const isTrendDown = (trend = {}) => {
  return getTrendDirection(trend) === 'DOWN' && toNumber(trend.changePercent) < 0;
};

const getMetric = (row = {}, keys = []) => {
  return pickValue(row, keys);
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

const hasWarningType = (warningCards = [], types = []) => {
  const normalizedTypes = types.map(normalizeCode);

  return safeArray(warningCards).some((warning) => {
    const warningType = normalizeCode(warning?.type || warning?.id || warning?.code || '');
    return normalizedTypes.includes(warningType);
  });
};

const createFallbackRiskCard = ({
  id,
  title,
  message,
  severity = 'INFO',
  amount = 0,
  count = 0,
  action = '',
  icon = AlertTriangle,
}) => ({
  id,
  title,
  message,
  severity,
  amount,
  count,
  action_hint: action,
  icon,
});

const buildBusinessRadarFromOwnerAnalytics = (ownerAnalyticsInput = {}) => {
  const ownerAnalytics = mergeAnalyticsDefaults(ownerAnalyticsInput);

const {
  branchAnalytics,
  productAnalytics,
  channelAnalytics,
  cashflowAnalytics,
  receivableAnalytics,
  payableAnalytics,
  inventoryAnalytics,
  warningCards,
  trendAnalytics,
} = ownerAnalytics;

  const criticalWarnings = warningCards.filter((warning) => normalizeCode(warning?.severity) === 'CRITICAL');
  const mediumWarnings = warningCards.filter((warning) => normalizeCode(warning?.severity) === 'WARNING');

  const negativeCash = hasWarningType(warningCards, ['negativeCash', 'CASH_NEGATIF']);
  const negativeProfit = hasWarningType(warningCards, ['negativeProfit', 'PROFIT_NEGATIF']);
  const overdueReceivable = hasWarningType(warningCards, ['overdueReceivable', 'PIUTANG_OVERDUE']);
  const overduePayable = hasWarningType(warningCards, ['overduePayable', 'HUTANG_OVERDUE']);
  const criticalStockWarning = hasWarningType(warningCards, ['criticalStock', 'STOK_KRITIS']);

  const worstBranches = safeArray(branchAnalytics.worstBranch);
  const lossBranches = worstBranches.filter((branch) => toNumber(branch.netProfit || branch.grossProfit || branch.totalProfit) < 0);
  const lowMarginProducts = safeArray(productAnalytics.lowMarginProducts);
  const criticalStock = safeArray(inventoryAnalytics.criticalStock);
  const lowStock = safeArray(inventoryAnalytics.lowStock);
  const deadStock = safeArray(inventoryAnalytics.deadStock);

  const revenueTrendDown = isTrendDown(trendAnalytics.revenueTrend);
  const profitTrendDown = isTrendDown(trendAnalytics.profitTrend);
  const cashflowTrendDown = isTrendDown(trendAnalytics.cashflowTrend);

  const marginTooSmall = lowMarginProducts.some((product) => {
    return hasValue(product.profitMargin) && toNumber(product.profitMargin) < 10;
  });

  const salesDrop = revenueTrendDown && Math.abs(toNumber(trendAnalytics.revenueTrend?.changePercent)) >= 20;

  let businessHealthScore = 100;
  businessHealthScore -= criticalWarnings.length * 12;
  businessHealthScore -= mediumWarnings.length * 6;
  if (negativeCash) businessHealthScore -= 18;
  if (negativeProfit) businessHealthScore -= 18;
  if (overdueReceivable) businessHealthScore -= 8;
  if (overduePayable) businessHealthScore -= 8;
  if (criticalStockWarning || criticalStock.length > 0) businessHealthScore -= 8;
  if (marginTooSmall) businessHealthScore -= 6;
  if (salesDrop) businessHealthScore -= 10;
  if (lossBranches.length > 0) businessHealthScore -= 8;

  businessHealthScore = clampScore(businessHealthScore);

  let cashDisciplineScore = 100;
  if (toNumber(cashflowAnalytics.cashPosition) < 0) cashDisciplineScore -= 30;
  if (toNumber(cashflowAnalytics.cashBalance) < 0) cashDisciplineScore -= 20;
  if (toNumber(receivableAnalytics.overdueReceivable) > 0) cashDisciplineScore -= 15;
  if (toNumber(payableAnalytics.overduePayable) > 0) cashDisciplineScore -= 15;
  if (cashflowTrendDown) cashDisciplineScore -= 10;

  cashDisciplineScore = clampScore(cashDisciplineScore);

  const financialRiskCards = [
    createFallbackRiskCard({
      id: 'cashDeficitRisk',
      title: 'Cash Deficit Risk',
      message: toNumber(cashflowAnalytics.cashPosition) < 0
        ? 'Cash position negatif. Perlu kontrol kas dan prioritas penagihan.'
        : 'Cash position masih aman berdasarkan analytics orchestrator.',
      severity: toNumber(cashflowAnalytics.cashPosition) < 0 ? 'CRITICAL' : 'INFO',
      amount: cashflowAnalytics.cashPosition,
      action: toNumber(cashflowAnalytics.cashPosition) < 0
        ? 'Prioritaskan cash in dan tahan pengeluaran non-esensial.'
        : 'Pertahankan disiplin cashflow.',
      icon: Banknote,
    }),
    createFallbackRiskCard({
      id: 'debtRisk',
      title: 'Debt Risk',
      message: toNumber(payableAnalytics.overduePayable) > 0
        ? 'Ada hutang overdue yang perlu diprioritaskan.'
        : 'Tidak ada hutang overdue signifikan dari orchestrator.',
      severity: toNumber(payableAnalytics.overduePayable) > 0 ? 'WARNING' : 'INFO',
      amount: payableAnalytics.overduePayable || payableAnalytics.totalPayable,
      action: toNumber(payableAnalytics.overduePayable) > 0
        ? 'Atur pembayaran supplier berdasarkan prioritas jatuh tempo.'
        : 'Pantau hutang supplier secara rutin.',
      icon: WalletCards,
    }),
    createFallbackRiskCard({
      id: 'receivableRisk',
      title: 'Receivable Risk',
      message: toNumber(receivableAnalytics.overdueReceivable) > 0
        ? 'Ada piutang overdue yang menekan cashflow.'
        : 'Piutang overdue masih aman berdasarkan analytics orchestrator.',
      severity: toNumber(receivableAnalytics.overdueReceivable) > 0 ? 'WARNING' : 'INFO',
      amount: receivableAnalytics.overdueReceivable || receivableAnalytics.totalReceivable,
      action: toNumber(receivableAnalytics.overdueReceivable) > 0
        ? 'Prioritaskan penagihan customer dengan aging tertua.'
        : 'Pertahankan ritme penagihan.',
      icon: Users,
    }),
  ];

  const channelRows = CHANNEL_KEYS.map((channel) => ({
    ...channel,
    data: channelAnalytics[channel.key] || {},
  }));

  const problematicChannels = channelRows.filter((channel) => {
    const data = channel.data || {};
    return toNumber(data.totalRevenue) <= 0 || toNumber(data.netProfit) < 0;
  });

  const salesRiskCards = [
    createFallbackRiskCard({
      id: 'salesDropRisk',
      title: 'Penjualan Turun',
      message: salesDrop
        ? `Revenue turun ${formatPercent(Math.abs(toNumber(trendAnalytics.revenueTrend?.changePercent)))} dibanding periode sebelumnya.`
        : 'Tidak ada penurunan penjualan drastis dari trend analytics.',
      severity: salesDrop ? 'WARNING' : 'INFO',
      amount: trendAnalytics.revenueTrend?.changeValue,
      action: salesDrop
        ? 'Cek channel, cabang, dan produk dengan performa menurun.'
        : 'Lanjutkan monitoring trend revenue.',
      icon: TrendingDown,
    }),
    createFallbackRiskCard({
      id: 'channelRisk',
      title: 'Channel Bermasalah',
      message: problematicChannels.length > 0
        ? `${problematicChannels.length} channel butuh perhatian.`
        : 'Tidak ada channel bermasalah signifikan.',
      severity: problematicChannels.length > 0 ? 'WARNING' : 'INFO',
      count: problematicChannels.length,
      action: problematicChannels.length > 0
        ? 'Evaluasi promo, komisi, dan performa channel bermasalah.'
        : 'Pertahankan performa channel aktif.',
      icon: PieChart,
    }),
    createFallbackRiskCard({
      id: 'unsoldProductRisk',
      title: 'Produk Tidak Laku',
      message: safeArray(productAnalytics.topProducts).length === 0
        ? 'Belum ada produk terlaris pada periode ini.'
        : 'Produk terlaris tersedia dari analytics orchestrator.',
      severity: safeArray(productAnalytics.topProducts).length === 0 ? 'WARNING' : 'INFO',
      action: safeArray(productAnalytics.topProducts).length === 0
        ? 'Cek traffic penjualan dan promosi produk.'
        : 'Pantau produk dengan margin rendah.',
      icon: ShoppingBag,
    }),
  ];

  const radarWarningCards = [
    ...warningCards,
    ...(marginTooSmall
      ? [
          createFallbackRiskCard({
            id: 'marginTooSmall',
            title: 'Margin terlalu kecil',
            message: 'Ada produk dengan margin di bawah batas aman.',
            severity: 'WARNING',
            count: lowMarginProducts.length,
            action: 'Evaluasi harga jual, HPP, dan promo produk margin rendah.',
            icon: Target,
          }),
        ]
      : []),
    ...(salesDrop
      ? [
          createFallbackRiskCard({
            id: 'salesDrop',
            title: 'Penjualan turun drastis',
            message: `Revenue turun ${formatPercent(Math.abs(toNumber(trendAnalytics.revenueTrend?.changePercent)))} dibanding periode sebelumnya.`,
            severity: 'WARNING',
            amount: trendAnalytics.revenueTrend?.changeValue,
            action: 'Cek channel, cabang, dan produk yang mengalami penurunan.',
            icon: TrendingDown,
          }),
        ]
      : []),
    ...(lossBranches.length > 0
      ? [
          createFallbackRiskCard({
            id: 'branchLoss',
            title: 'Cabang merugi',
            message: `${lossBranches.length} cabang memiliki profit negatif.`,
            severity: 'WARNING',
            count: lossBranches.length,
            action: 'Audit biaya, omzet, dan HPP cabang yang merugi.',
            icon: Building2,
          }),
        ]
      : []),
  ];

  const actionCenter = radarWarningCards
    .filter((warning) => normalizeCode(warning?.severity) !== 'INFO')
    .map((warning, index) => ({
      id: warning.id || warning.type || `ACTION-${index + 1}`,
      title: warning.title || 'Action Required',
      description: warning.action_hint || warning.message || 'Perlu tindakan owner.',
      severity: warning.severity || 'WARNING',
      source: warning.type || warning.id || 'BUSINESS_RADAR',
    }));

  if (actionCenter.length === 0) {
    actionCenter.push({
      id: 'NO_ACTION_REQUIRED',
      title: 'Tidak ada aksi kritis',
      description: 'Tidak ada rekomendasi kritis dari Business Radar pada periode ini.',
      severity: 'INFO',
      source: 'BUSINESS_RADAR',
    });
  }

  return {
    businessHealthScore,
    businessHealthCategory: getHealthCategory(businessHealthScore),
    cashDisciplineScore,
    cashDisciplineCategory: getHealthCategory(cashDisciplineScore),

    warningCards: radarWarningCards,

    branchRadar: {
      topBranch: safeArray(branchAnalytics.topBranchProfit)[0] || safeArray(branchAnalytics.topBranchRevenue)[0] || null,
      topBranches: safeArray(branchAnalytics.topBranchRevenue),
      problemBranches: worstBranches,
      lossBranches,
    },

    inventoryRadar: {
      stockOutRisk: criticalStock,
      deadStockRisk: deadStock,
      slowMovingProduct: lowStock,
    },

    financialRadar: {
      cashDeficitRisk: financialRiskCards[0],
      debtRisk: financialRiskCards[1],
      receivableRisk: financialRiskCards[2],
      riskCards: financialRiskCards,
    },

    salesRadar: {
      salesDropRisk: salesRiskCards[0],
      channelRisk: salesRiskCards[1],
      unsoldProductRisk: salesRiskCards[2],
      riskCards: salesRiskCards,
      problematicChannels,
    },

    ownerActionCenter: actionCenter,

    source: 'getOwnerAnalytics',
  };
};

const normalizeBusinessRadarPayload = (payload = {}, ownerAnalytics = {}) => {
  const derived = buildBusinessRadarFromOwnerAnalytics(ownerAnalytics);
  const source = payload?.businessRadar || payload?.radar || payload?.data || payload || {};

  return {
    ...derived,
    ...source,
    businessHealthScore: clampScore(source.businessHealthScore ?? source.healthScore ?? derived.businessHealthScore),
    businessHealthCategory: source.businessHealthCategory || source.healthCategory || derived.businessHealthCategory,
    cashDisciplineScore: clampScore(source.cashDisciplineScore ?? derived.cashDisciplineScore),
    cashDisciplineCategory: source.cashDisciplineCategory || derived.cashDisciplineCategory,
    warningCards: safeArray(source.warningCards).length > 0 ? safeArray(source.warningCards) : derived.warningCards,
    branchRadar: source.branchRadar || derived.branchRadar,
    inventoryRadar: source.inventoryRadar || derived.inventoryRadar,
    financialRadar: source.financialRadar || derived.financialRadar,
    salesRadar: source.salesRadar || derived.salesRadar,
    ownerActionCenter: safeArray(source.ownerActionCenter).length > 0 ? safeArray(source.ownerActionCenter) : derived.ownerActionCenter,
    source: payload ? 'getBusinessRadar/getOwnerAnalytics' : 'getOwnerAnalytics',
  };
};

const Badge = ({ children, tone = 'slate' }) => {
  const toneClass = {
    red: 'border-red-100 bg-red-50 text-red-700',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    gold: 'border-amber-100 bg-amber-50 text-amber-700',
    amber: 'border-orange-100 bg-orange-50 text-orange-700',
    slate: 'border-slate-100 bg-slate-50 text-slate-600',
    dark: 'border-slate-800 bg-slate-950 text-white',
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${toneClass[tone] || toneClass.slate}`}>
      {children}
    </span>
  );
};

const HealthGauge = ({ score, label, subtitle, icon }) => {
  const safeScore = clampScore(score);
  const tone = getScoreTone(safeScore);
  const toneClass = {
    green: 'text-emerald-700',
    gold: 'text-amber-700',
    amber: 'text-orange-700',
    red: 'text-red-700',
    dark: 'text-slate-950',
  };

  const gaugeColor = {
    green: '#059669',
    gold: '#D97706',
    amber: '#EA580C',
    red: '#DC2626',
    dark: '#111827',
  }[tone] || '#DC2626';

  return (
    <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <div
          className="flex h-44 w-44 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(${gaugeColor} ${safeScore * 3.6}deg, #F1F5F9 0deg)`,
          }}
        >
          <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white shadow-inner">
            <div className={`text-4xl font-black ${toneClass[tone] || toneClass.red}`}>
              {safeScore}
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              / 100
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 text-sm font-black text-slate-900">
          <span className="text-red-600">{icon}</span>
          {label}
        </div>
        <div className="mt-2 text-xl font-black text-slate-900">
          {subtitle}
        </div>
      </div>
    </div>
  );
};

const ScoreCard = ({ title, value, subtitle, icon, tone = 'white' }) => {
  const toneClass = {
    red: 'bg-red-600 text-white',
    dark: 'bg-slate-950 text-white',
    gold: 'border border-amber-100 bg-amber-50 text-amber-900',
    green: 'border border-emerald-100 bg-emerald-50 text-emerald-900',
    white: 'border border-slate-100 bg-white text-slate-900',
  };

  return (
    <div className={`rounded-[2rem] p-5 shadow-sm ${toneClass[tone] || toneClass.white}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">
            {title}
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight">
            {value}
          </div>
          {subtitle && (
            <div className="mt-1 text-[11px] font-bold opacity-70">
              {subtitle}
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

const RiskCard = ({ risk, fallbackIcon: FallbackIcon = ShieldAlert }) => {
  const Icon = risk?.icon || FallbackIcon;
  const severity = risk?.severity || 'INFO';
  const tone = getRiskTone(severity);
  const toneClass = {
    red: 'border-red-100 bg-red-50 text-red-900',
    gold: 'border-amber-100 bg-amber-50 text-amber-900',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-900',
    slate: 'border-slate-100 bg-slate-50 text-slate-900',
  };

  return (
    <div className={`rounded-[2rem] border p-5 shadow-sm ${toneClass[tone] || toneClass.slate}`}>
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-white p-3 text-red-600 shadow-sm">
          <Icon size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-black">
            {risk?.title || 'Risk Alert'}
          </div>
          <div className="mt-1 text-xs font-bold leading-relaxed opacity-80">
            {risk?.message || risk?.description || risk?.action_hint || '-'}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={tone}>
              {severity}
            </Badge>
            {hasValue(risk?.amount) && toNumber(risk.amount) !== 0 && (
              <Badge tone={tone}>
                {formatMoney(risk.amount)}
              </Badge>
            )}
            {hasValue(risk?.count) && toNumber(risk.count) > 0 && (
              <Badge tone="slate">
                {formatNumber(risk.count)} item
              </Badge>
            )}
          </div>

          {risk?.action_hint && (
            <div className="mt-3 rounded-2xl bg-white/70 p-3 text-xs font-bold leading-relaxed">
              {risk.action_hint}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const RankList = ({
  rows,
  titleKeys = [],
  subtitleKeys = [],
  valueKeys = [],
  valueType = 'money',
  emptyText = 'Belum ada data dari orchestrator.',
}) => {
  const list = safeArray(rows);
  const maxValue = Math.max(
    1,
    ...list.map((row) => Math.abs(toNumber(getMetric(row, valueKeys)))),
  );

  if (list.length === 0) return <EmptyState text={emptyText} />;

  return (
    <div className="space-y-3">
      {list.slice(0, 8).map((row, index) => {
        const metric = getMetric(row, valueKeys);
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

const InventoryRiskList = ({ rows, emptyText }) => {
  const list = safeArray(rows);

  if (list.length === 0) return <EmptyState text={emptyText} />;

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

const TrendMiniCard = ({ title, trend, icon }) => {
  const direction = getTrendDirection(trend);
  const isDown = direction === 'DOWN';

  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            {title}
          </div>
          <div className="mt-2 text-xl font-black text-slate-900">
            {formatMoney(trend?.currentValue)}
          </div>
          <div className="mt-1 text-[11px] font-bold text-slate-400">
            Previous: {formatMoney(trend?.previousValue)}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-3 text-red-600 shadow-sm">
          {icon}
        </div>
      </div>

      <div className={`mt-4 inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-black ${
        isDown
          ? 'border-red-100 bg-red-50 text-red-700'
          : 'border-emerald-100 bg-emerald-50 text-emerald-700'
      }`}>
        {isDown ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
        {formatPercent(trend?.changePercent)}
      </div>
    </div>
  );
};

const OwnerActionCenter = ({ actions }) => {
  const list = safeArray(actions);

  if (list.length === 0) {
    return <EmptyState text="Tidak ada rekomendasi action dari orchestrator." />;
  }

  return (
    <div className="space-y-3">
      {list.slice(0, 10).map((action, index) => (
        <div key={`${action.id || action.title || index}`} className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-sm font-black text-white">
              {index + 1}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-slate-900">
                {action.title || 'Owner Action'}
              </div>
              <div className="mt-1 text-xs font-bold leading-relaxed text-slate-500">
                {action.description || action.action_hint || '-'}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={getRiskTone(action.severity)}>
                  {action.severity || 'INFO'}
                </Badge>
                {action.source && (
                  <Badge tone="slate">
                    {action.source}
                  </Badge>
                )}
              </div>
            </div>
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
      Business Radar hanya bisa diakses oleh OWNER atau DEWA.
    </p>
  </div>
);

export default function TabBusinessRadar({
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

  const radarState = useMemo(() => {
    if (!ownerAllowed) {
      return {
        ok: false,
        status: 'ACCESS_DENIED',
        analytics: mergeAnalyticsDefaults(null),
        radar: buildBusinessRadarFromOwnerAnalytics(null),
        message: 'ACCESS DENIED',
      };
    }

    if (typeof erpOrchestrator?.getOwnerAnalytics !== 'function') {
      return {
        ok: false,
        status: 'MISSING_API',
        analytics: mergeAnalyticsDefaults(null),
        radar: buildBusinessRadarFromOwnerAnalytics(null),
        message: 'erpOrchestrator.getOwnerAnalytics() belum tersedia.',
      };
    }

    try {
      const input = {
        period,
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        readonly: true,
        scope: 'BUSINESS_RADAR',
      };

      const context = {
        source: sourceData,
        dbData: sourceData,
        user,
        readonly: true,
        executor: user?.email || user?.name || user?.username || 'BUSINESS_RADAR',
      };

      const ownerAnalytics = mergeAnalyticsDefaults(
  erpOrchestrator.getOwnerAnalytics(input, context) || {},
);

      const businessRadarPayload = typeof erpOrchestrator?.getBusinessRadar === 'function'
        ? erpOrchestrator.getBusinessRadar(input, context)
        : null;

      const radar = normalizeBusinessRadarPayload(businessRadarPayload, ownerAnalytics);

      return {
        ok: true,
        status: 'READY',
        analytics: ownerAnalytics,
        radar,
        message: '',
      };
    } catch (error) {
      return {
        ok: false,
        status: 'ERROR',
        analytics: mergeAnalyticsDefaults(null),
        radar: buildBusinessRadarFromOwnerAnalytics(null),
        message: error?.message || 'Gagal membaca Business Radar dari erpOrchestrator.',
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

  const analytics = radarState.analytics || mergeAnalyticsDefaults(null);
  const radar = radarState.radar || buildBusinessRadarFromOwnerAnalytics(analytics);

  const summary = analytics.summary || {};
  const branchAnalytics = analytics.branchAnalytics || {};
  const productAnalytics = analytics.productAnalytics || {};
  const customerAnalytics = analytics.customerAnalytics || {};
  const channelAnalytics = analytics.channelAnalytics || {};
  const cashflowAnalytics = analytics.cashflowAnalytics || {};
  const receivableAnalytics = analytics.receivableAnalytics || {};
  const payableAnalytics = analytics.payableAnalytics || {};
  const inventoryAnalytics = analytics.inventoryAnalytics || {};
  const trendAnalytics = analytics.trendAnalytics || {};

  const branchRadar = radar.branchRadar || {};
  const inventoryRadar = radar.inventoryRadar || {};
  const financialRadar = radar.financialRadar || {};
  const salesRadar = radar.salesRadar || {};
  const warningCards = safeArray(radar.warningCards);
  const ownerActions = safeArray(radar.ownerActionCenter);


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
                Enterprise Intelligence Layer
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              Business Radar
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Sistem early warning dan business intelligence untuk owner. Thin UI, read only, dan seluruh sumber data berasal dari erpOrchestrator.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">OWNER ONLY</Badge>
            <Badge tone="gold">READ ONLY</Badge>
            <Badge tone="green">{radar.source || 'getOwnerAnalytics'}</Badge>
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
              Periode dikirim ke orchestrator. UI tidak membuat transaksi dan tidak mengubah data.
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
          <Badge tone={radarState.ok ? 'green' : 'red'}>
            {radarState.status}
          </Badge>
          <Badge tone="dark">
            Thin UI
          </Badge>
        </div>
      </div>

      {!radarState.ok && (
        <div className="rounded-[2rem] border border-red-100 bg-red-50 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white p-3 text-red-600 shadow-sm">
              <AlertTriangle size={22} />
            </div>
            <div>
              <div className="text-sm font-black text-red-900">
                Business Radar belum bisa dimuat
              </div>
              <p className="mt-1 text-sm font-bold leading-relaxed text-red-700">
                {radarState.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {radarState.ok && (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <HealthGauge
              score={radar.businessHealthScore}
              label="Business Health Score"
              subtitle={radar.businessHealthCategory}
              icon={<Gauge size={18} />}
            />

            <HealthGauge
              score={radar.cashDisciplineScore}
              label="Cash Discipline Score"
              subtitle={radar.cashDisciplineCategory}
              icon={<ShieldCheck size={18} />}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ScoreCard
              title="Net Profit"
              value={formatMoney(summary.netProfit)}
              subtitle="Dari owner analytics"
              icon={<BadgeDollarSign size={18} />}
              tone={toNumber(summary.netProfit) < 0 ? 'dark' : 'white'}
            />
            <ScoreCard
              title="Cash Position"
              value={formatMoney(cashflowAnalytics.cashPosition)}
              subtitle="Cash + Bank + Piutang - Hutang"
              icon={<Banknote size={18} />}
              tone={toNumber(cashflowAnalytics.cashPosition) < 0 ? 'dark' : 'gold'}
            />
            <ScoreCard
              title="Overdue Piutang"
              value={formatMoney(receivableAnalytics.overdueReceivable)}
              subtitle={`${formatNumber(receivableAnalytics.overdueCustomerCount)} customer`}
              icon={<Users size={18} />}
              tone={toNumber(receivableAnalytics.overdueReceivable) > 0 ? 'gold' : 'white'}
            />
            <ScoreCard
              title="Overdue Hutang"
              value={formatMoney(payableAnalytics.overduePayable)}
              subtitle={`${formatNumber(payableAnalytics.overdueSupplierCount)} supplier`}
              icon={<WalletCards size={18} />}
              tone={toNumber(payableAnalytics.overduePayable) > 0 ? 'gold' : 'white'}
            />
          </div>

          <SectionCard
            title="Warning System"
            subtitle="Cash negatif, profit negatif, piutang overdue, hutang overdue, stok kritis, margin kecil, penjualan turun, dan cabang rugi."
            icon={<ShieldAlert size={17} />}
          >
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {warningCards.length > 0 ? (
                warningCards.map((warning, index) => (
                  <RiskCard
                    key={`${warning.id || warning.type || warning.title || index}`}
                    risk={warning}
                    fallbackIcon={AlertTriangle}
                  />
                ))
              ) : (
                <EmptyState text="Tidak ada warning dari orchestrator." />
              )}
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <SectionCard
              title="Branch Radar — Top Cabang"
              subtitle="Cabang dengan performa omzet/profit terbaik."
              icon={<Trophy size={17} />}
            >
              <RankList
                rows={branchRadar.topBranches || branchAnalytics.topBranchRevenue}
                titleKeys={['branch_name', 'branch_id']}
                subtitleKeys={['branch_id']}
                valueKeys={['totalRevenue', 'netProfit']}
              />
            </SectionCard>

            <SectionCard
              title="Branch Radar — Cabang Bermasalah"
              subtitle="Cabang dengan performa terendah."
              icon={<Building2 size={17} />}
            >
              <RankList
                rows={branchRadar.problemBranches || branchAnalytics.worstBranch}
                titleKeys={['branch_name', 'branch_id']}
                subtitleKeys={['branch_id']}
                valueKeys={['netProfit', 'grossProfit']}
              />
            </SectionCard>

            <SectionCard
              title="Branch Radar — Cabang Rugi"
              subtitle="Cabang dengan profit negatif."
              icon={<TrendingDown size={17} />}
            >
              <RankList
                rows={branchRadar.lossBranches}
                titleKeys={['branch_name', 'branch_id']}
                subtitleKeys={['branch_id']}
                valueKeys={['netProfit', 'grossProfit']}
                emptyText="Tidak ada cabang rugi pada periode ini."
              />
            </SectionCard>
          </div>

          <SectionCard
            title="Inventory Radar"
            subtitle="Stock out risk, dead stock risk, dan slow moving product."
            icon={<Boxes size={17} />}
          >
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-slate-900">Stock Out Risk</div>
                  <Badge tone="red">{safeArray(inventoryRadar.stockOutRisk).length} item</Badge>
                </div>
                <InventoryRiskList
                  rows={inventoryRadar.stockOutRisk || inventoryAnalytics.criticalStock}
                  emptyText="Tidak ada stock out risk."
                />
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-slate-900">Dead Stock Risk</div>
                  <Badge tone="slate">{safeArray(inventoryRadar.deadStockRisk).length} item</Badge>
                </div>
                <InventoryRiskList
                  rows={inventoryRadar.deadStockRisk || inventoryAnalytics.deadStock}
                  emptyText="Tidak ada dead stock risk."
                />
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-slate-900">Slow Moving Product</div>
                  <Badge tone="gold">{safeArray(inventoryRadar.slowMovingProduct).length} item</Badge>
                </div>
                <InventoryRiskList
                  rows={inventoryRadar.slowMovingProduct || inventoryAnalytics.lowStock}
                  emptyText="Tidak ada slow moving product."
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Financial Radar"
            subtitle="Cash deficit risk, debt risk, dan receivable risk."
            icon={<Landmark size={17} />}
          >
            <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ScoreCard
                title="Cash Balance"
                value={formatMoney(cashflowAnalytics.cashBalance)}
                icon={<Banknote size={18} />}
                tone="white"
              />
              <ScoreCard
                title="Bank Balance"
                value={formatMoney(cashflowAnalytics.bankBalance)}
                icon={<Landmark size={18} />}
                tone="white"
              />
              <ScoreCard
                title="Receivable"
                value={formatMoney(cashflowAnalytics.receivableBalance)}
                icon={<Users size={18} />}
                tone="gold"
              />
              <ScoreCard
                title="Payable"
                value={formatMoney(cashflowAnalytics.payableBalance)}
                icon={<WalletCards size={18} />}
                tone="white"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {safeArray(financialRadar.riskCards).map((risk, index) => (
                <RiskCard
                  key={`${risk.id || risk.title || index}`}
                  risk={risk}
                  fallbackIcon={WalletCards}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Sales Radar"
            subtitle="Penjualan turun, channel bermasalah, dan produk tidak laku."
            icon={<ShoppingBag size={17} />}
          >
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {safeArray(salesRadar.riskCards).map((risk, index) => (
                <RiskCard
                  key={`${risk.id || risk.title || index}`}
                  risk={risk}
                  fallbackIcon={ShoppingBag}
                />
              ))}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {CHANNEL_KEYS.map((channel) => {
                const channelData = channelAnalytics[channel.key] || {};
                const Icon = channel.icon;

                return (
                  <div key={channel.key} className="rounded-3xl border border-slate-100 bg-slate-50/70 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-white p-3 text-red-600 shadow-sm">
                          <Icon size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-black text-slate-900">
                            {channel.label}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-slate-400">
                            Channel Radar
                          </div>
                        </div>
                      </div>

                      <Badge tone={toNumber(channelData.totalRevenue) > 0 ? 'green' : 'gold'}>
                        {toNumber(channelData.totalRevenue) > 0 ? 'ACTIVE' : 'WATCH'}
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                          Revenue
                        </div>
                        <div className="mt-1 text-sm font-black text-slate-900">
                          {formatMoney(channelData.totalRevenue)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                          Profit
                        </div>
                        <div className="mt-1 text-sm font-black text-slate-900">
                          {formatMoney(channelData.netProfit)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                          Margin
                        </div>
                        <div className="mt-1 text-sm font-black text-slate-900">
                          {formatPercent(channelData.profitMargin)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                          Trx
                        </div>
                        <div className="mt-1 text-sm font-black text-slate-900">
                          {formatNumber(channelData.transactionCount)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <SectionCard
              title="Produk Margin Rendah"
              subtitle="Produk yang berpotensi menekan profit."
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

            <SectionCard
              title="Produk Tidak Laku / Lemah"
              subtitle="Pantau produk dengan performa rendah."
              icon={<Package size={17} />}
            >
              <RankList
                rows={productAnalytics.topProducts}
                titleKeys={['product_name', 'product_id']}
                subtitleKeys={['product_id']}
                valueKeys={['qtySold']}
                valueType="number"
                emptyText="Belum ada produk terjual pada periode ini."
              />
            </SectionCard>

            <SectionCard
              title="Top Customer"
              subtitle="Customer utama yang mempengaruhi performa bisnis."
              icon={<Users size={17} />}
            >
              <RankList
                rows={customerAnalytics.topCustomers}
                titleKeys={['customer_name', 'customer_id']}
                subtitleKeys={['customer_type', 'customer_id']}
                valueKeys={['totalRevenue']}
              />
            </SectionCard>
          </div>

          <SectionCard
            title="Trend Analytics"
            subtitle="Revenue, profit, cashflow, dan transaksi dari orchestrator."
            icon={<BarChart3 size={17} />}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TrendMiniCard
                title="Revenue Trend"
                trend={trendAnalytics.revenueTrend}
                icon={<TrendingUp size={18} />}
              />
              <TrendMiniCard
                title="Profit Trend"
                trend={trendAnalytics.profitTrend}
                icon={<Trophy size={18} />}
              />
              <TrendMiniCard
                title="Cashflow Trend"
                trend={trendAnalytics.cashflowTrend}
                icon={<Activity size={18} />}
              />
              <TrendMiniCard
                title="Transaction Trend"
                trend={trendAnalytics.transactionTrend}
                icon={<BarChart3 size={18} />}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Owner Action Center"
            subtitle="Rekomendasi aksi berdasarkan warning dan analytics dari orchestrator."
            icon={<Zap size={17} />}
          >
            <OwnerActionCenter actions={ownerActions} />
          </SectionCard>

          <SectionCard
            title="Read Only Compliance"
            subtitle="Business Radar tidak memiliki write action."
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
