import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  RefreshCw,
  X,
  Eye,
  Building2,
  Layers,
  LockKeyhole,
  FileText,
  ShieldCheck,
  ServerCog,
  Database,
  Gauge,
  ClipboardList,
} from 'lucide-react';

import erpOrchestrator from '../../utils/erpOrchestrator';

const EMPTY_OBJECT = Object.freeze({});

const SEVERITY_OPTIONS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const MODULE_FILTER_OPTIONS = [
  'ALL',
  'INVENTORY',
  'PURCHASE',
  'PRODUCTION',
  'SALES',
  'ACCOUNTING',
  'PROFIT',
  'SNAPSHOT',
  'NOTIFICATION',
  'SYSTEM',
  'AUDIT',
  'MASTER_BRANCH',
  'MASTER_PRODUCT',
  'MASTER_CUSTOMER',
  'MASTER_SUPPLIER',
  'MASTER_WAREHOUSE',
];

const REQUIRED_MODULES = [
  'INVENTORY',
  'PURCHASE',
  'PRODUCTION',
  'SALES',
  'ACCOUNTING',
  'PROFIT',
  'SNAPSHOT',
  'NOTIFICATION',
];

const DEFAULT_SUMMARY = {
  healthScore: 0,
  healthStatus: 'UNKNOWN',
  totalChecks: 0,
  totalPassed: 0,
  totalWarning: 0,
  totalCritical: 0,
  totalHigh: 0,
  totalMedium: 0,
  totalLow: 0,
  totalMissingApi: 0,
  totalDataIssue: 0,
};

const DEFAULT_RESULT = {
  summary: DEFAULT_SUMMARY,
  records: [],
  moduleHealth: [],
  recommendations: [],
  engineStatus: {},
  dataQuality: {},
  filters: {},
  metadata: {},
  warnings: [],
};

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

const clampScore = (value) => {
  return Math.max(0, Math.min(100, Math.round(safeNumber(value, 0))));
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

const normalizeSeverity = (value = '') => {
  const severity = normalizeCode(value || '');

  if (severity === 'CRITICAL') return 'CRITICAL';
  if (severity === 'HIGH') return 'HIGH';
  if (severity === 'WARNING') return 'MEDIUM';
  if (severity === 'MEDIUM') return 'MEDIUM';
  if (severity === 'LOW') return 'LOW';
  if (severity === 'INFO') return 'LOW';

  return severity || 'LOW';
};

const normalizeHealthStatus = (value = '') => {
  const status = normalizeCode(value || '');

  if (['EXCELLENT', 'SANGAT_SEHAT'].includes(status)) return 'EXCELLENT';
  if (['GOOD', 'HEALTHY', 'SEHAT', 'PASSED'].includes(status)) return 'GOOD';
  if (['WARNING', 'WARN', 'WASPADA'].includes(status)) return 'WARNING';
  if (['CRITICAL', 'FAILED', 'ERROR', 'KRITIS'].includes(status)) return 'CRITICAL';

  return 'WARNING';
};

const getSeverityTone = (severity) => {
  const normalized = normalizeSeverity(severity);

  const toneMap = {
    CRITICAL: 'border-red-200 bg-red-50 text-red-700',
    HIGH: 'border-orange-200 bg-orange-50 text-orange-700',
    MEDIUM: 'border-amber-200 bg-amber-50 text-amber-700',
    LOW: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };

  return toneMap[normalized] || 'border-slate-200 bg-slate-50 text-slate-600';
};

const getStatusTone = (status) => {
  const normalized = normalizeHealthStatus(status);

  const toneMap = {
    EXCELLENT: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    GOOD: 'border-blue-200 bg-blue-50 text-blue-700',
    WARNING: 'border-amber-200 bg-amber-50 text-amber-700',
    CRITICAL: 'border-red-200 bg-red-50 text-red-700',
  };

  return toneMap[normalized] || 'border-slate-200 bg-slate-50 text-slate-600';
};

const getSeverityIcon = (severity) => {
  const normalized = normalizeSeverity(severity);

  if (normalized === 'CRITICAL') return AlertTriangle;
  if (normalized === 'HIGH') return AlertTriangle;
  if (normalized === 'MEDIUM') return Activity;

  return CheckCircle2;
};

const getRecordId = (record = {}, index = 0) => {
  return String(record.id || record.reference_key || `${record.module || 'SYSTEM'}-${index}`);
};

const mergeSystemHealthDefaults = (result) => {
  const source = safeObject(result);

  return {
    ...DEFAULT_RESULT,
    ...source,
    summary: {
      ...DEFAULT_SUMMARY,
      ...safeObject(source.summary),
    },
    records: safeArray(source.records),
    moduleHealth: safeArray(source.moduleHealth || source.module_health || source.modules || source.moduleStatus),
    recommendations: safeArray(source.recommendations || source.recommendationPanel || source.recommendation_panel),
    engineStatus: safeObject(source.engineStatus),
    dataQuality: safeObject(source.dataQuality),
    filters: safeObject(source.filters),
    metadata: safeObject(source.metadata),
    warnings: safeArray(source.warnings),
  };
};

const resolveModuleHealthRow = (result, moduleName) => {
  const normalizedModule = normalizeCode(moduleName);
  const moduleHealth = safeArray(result.moduleHealth);

  const fromArray = moduleHealth.find((row) => {
    return normalizeCode(row.module || row.module_name || row.name || row.id) === normalizedModule;
  });

  if (fromArray) {
    return {
      module: normalizedModule,
      score: fromArray.score ?? fromArray.healthScore ?? fromArray.health_score ?? fromArray.value ?? null,
      status: fromArray.status || fromArray.healthStatus || fromArray.health_status || 'UNKNOWN',
      warningCount: fromArray.warningCount ?? fromArray.warning_count ?? fromArray.totalWarning ?? fromArray.total_warning ?? 0,
      metadata: safeObject(fromArray.metadata || fromArray.meta || fromArray),
    };
  }

  const mapSource = safeObject(result.moduleHealth);
  const mapRow = safeObject(mapSource[normalizedModule] || mapSource[moduleName]);

  if (Object.keys(mapRow).length > 0) {
    return {
      module: normalizedModule,
      score: mapRow.score ?? mapRow.healthScore ?? mapRow.health_score ?? mapRow.value ?? null,
      status: mapRow.status || mapRow.healthStatus || mapRow.health_status || 'UNKNOWN',
      warningCount: mapRow.warningCount ?? mapRow.warning_count ?? mapRow.totalWarning ?? mapRow.total_warning ?? 0,
      metadata: safeObject(mapRow.metadata || mapRow.meta || mapRow),
    };
  }

  return {
    module: normalizedModule,
    score: null,
    status: 'UNKNOWN',
    warningCount: 0,
    metadata: {},
  };
};

const buildRecommendationRows = (result) => {
  const explicitRecommendations = safeArray(result.recommendations);

  if (explicitRecommendations.length > 0) {
    return explicitRecommendations.map((item, index) => ({
      id: item.id || `REC-${index + 1}`,
      severity: normalizeSeverity(item.severity || item.priority || 'LOW'),
      module: item.module || item.source || 'SYSTEM',
      title: item.title || item.name || 'Recommendation',
      description: item.description || item.message || item.recommendation || item.action_hint || '',
      recommendation: item.recommendation || item.action_hint || item.description || item.message || '',
      metadata: safeObject(item.metadata || item.meta || item),
    }));
  }

  return safeArray(result.records)
    .filter((record) => record.action_hint || record.recommendation)
    .map((record, index) => ({
      id: `REC-${index + 1}-${getRecordId(record, index)}`,
      severity: normalizeSeverity(record.severity),
      module: record.module || 'SYSTEM',
      title: record.title || 'Recommendation',
      description: record.message || record.description || '',
      recommendation: record.action_hint || record.recommendation || '',
      metadata: safeObject(record.metadata),
    }));
};

const SeverityBadge = ({ severity }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getSeverityTone(severity)}`}>
    {normalizeSeverity(severity)}
  </span>
);

const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getStatusTone(status)}`}>
    {normalizeHealthStatus(status)}
  </span>
);

const ScoreRing = ({ score }) => {
  const safeScore = clampScore(score);
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (safeScore / 100) * circumference;

  return (
    <div className="relative h-32 w-32">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="42"
          strokeWidth="10"
          className="fill-none stroke-white/10"
        />
        <circle
          cx="50"
          cy="50"
          r="42"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="fill-none stroke-red-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-black text-white">
          {safeScore}
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
          Score
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({ title, value, icon, tone = 'white' }) => {
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
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">
            {title}
          </div>
          <div className="mt-2 text-2xl font-black">
            {formatNumber(value)}
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
      System Health hanya bisa diakses oleh OWNER atau DEWA.
    </p>
  </div>
);

const EmptyState = () => (
  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-8 text-center shadow-sm">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
      <CheckCircle2 size={24} />
    </div>
    <div className="mt-4 text-lg font-black text-emerald-900">
      System Health dalam kondisi optimal.
    </div>
    <p className="mx-auto mt-2 max-w-xl text-sm font-bold leading-relaxed text-emerald-700">
      Tidak ada issue untuk filter yang sedang aktif.
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
          Gagal memuat System Health.
        </div>
        <p className="mt-1 text-sm font-bold leading-relaxed text-red-700">
          {message || 'Terjadi kesalahan saat membaca erpOrchestrator.getSystemHealth().'}
        </p>
      </div>
    </div>
  </div>
);

const ModuleHealthCard = ({ moduleHealth }) => {
  const scoreLabel = moduleHealth.score === null || moduleHealth.score === undefined
    ? 'N/A'
    : clampScore(moduleHealth.score);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            Module
          </div>
          <div className="mt-1 text-lg font-black text-slate-950">
            {moduleHealth.module}
          </div>
        </div>

        <StatusBadge status={moduleHealth.status} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Score
          </div>
          <div className="mt-1 text-2xl font-black text-slate-950">
            {scoreLabel}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Warning
          </div>
          <div className="mt-1 text-2xl font-black text-slate-950">
            {formatNumber(moduleHealth.warningCount)}
          </div>
        </div>
      </div>
    </div>
  );
};

const IssueCard = ({ record, onClick }) => {
  const Icon = getSeverityIcon(record.severity);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-100 hover:shadow-md"
    >
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${getSeverityTone(record.severity)}`}>
          <Icon size={23} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={record.severity} />
            <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              {record.module || 'SYSTEM'}
            </span>
          </div>

          <h3 className="mt-3 text-base font-black leading-snug text-slate-950 group-hover:text-red-700">
            {record.title || 'System Issue'}
          </h3>

          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">
            {record.message || record.description || '-'}
          </p>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Recommendation
            </div>
            <div className="mt-1 text-sm font-bold leading-relaxed text-slate-700">
              {record.action_hint || record.recommendation || 'Lanjutkan monitoring rutin.'}
            </div>
          </div>
        </div>

        <div className="hidden rounded-2xl border border-slate-100 bg-slate-50 p-3 text-slate-500 transition-all group-hover:bg-red-50 group-hover:text-red-600 lg:block">
          <Eye size={18} />
        </div>
      </div>
    </button>
  );
};

const DetailModal = ({ record, onClose }) => {
  if (!record) return null;

  const metadata = safeObject(record.metadata);
  const recommendation = record.action_hint || record.recommendation || 'Lanjutkan monitoring rutin.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <ShieldCheck size={18} className="text-red-600" />
              System Health Detail
            </div>
            <p className="mt-1 text-xs font-bold text-slate-400">
              Detail issue dari ERP System Health. Read only.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
            aria-label="Close system health detail"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Severity
              </div>
              <div className="mt-3">
                <SeverityBadge severity={record.severity} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Module
              </div>
              <div className="mt-2 text-sm font-black text-slate-900">
                {record.module || '-'}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Timestamp
              </div>
              <div className="mt-2 text-sm font-black text-slate-900">
                {formatDateTime(record.timestamp)}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {record.category || 'SYSTEM_HEALTH'}
              </span>
              <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {record.status || 'UNKNOWN'}
              </span>
            </div>

            <h2 className="mt-4 text-xl font-black text-slate-950">
              {record.title || 'System Health Issue'}
            </h2>

            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
              {record.message || record.description || '-'}
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Recommendation
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm font-bold leading-relaxed text-slate-700">
              {recommendation}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Reference Key
            </div>
            <div className="mt-2 break-words text-sm font-black text-slate-900">
              {record.reference_key || '-'}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-950 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-800 p-4 text-sm font-black text-white">
              <FileText size={16} className="text-amber-300" />
              Raw JSON
            </div>
            <pre className="max-h-[420px] overflow-auto p-4 text-xs font-semibold leading-relaxed text-slate-200">
              {stringifyJson({
                record,
                metadata,
              })}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

function TabSystemHealth(props = {}) {
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
    severity: 'ALL',
    module: 'ALL',
    search: '',
  });

  const [appliedFilters, setAppliedFilters] = useState({
    severity: 'ALL',
    module: 'ALL',
    search: '',
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [healthState, setHealthState] = useState({
    loading: true,
    error: '',
    result: DEFAULT_RESULT,
  });

  const requestInput = useMemo(() => ({
    severity: appliedFilters.severity === 'ALL' ? '' : appliedFilters.severity,
    module: appliedFilters.module === 'ALL' ? '' : appliedFilters.module,
    search: appliedFilters.search,
    includeApiHealth: true,
    includeDataQuality: true,
    includeMasterHealth: true,
    includeAuditHealth: true,
  }), [
    appliedFilters.severity,
    appliedFilters.module,
    appliedFilters.search,
  ]);

  useEffect(() => {
    if (!ownerAllowed) {
      setHealthState({
        loading: false,
        error: '',
        result: DEFAULT_RESULT,
      });
      return;
    }

    if (typeof erpOrchestrator?.getSystemHealth !== 'function') {
      setHealthState({
        loading: false,
        error: 'erpOrchestrator.getSystemHealth() belum tersedia.',
        result: DEFAULT_RESULT,
      });
      return;
    }

    let isMounted = true;

    setHealthState((prev) => ({
      ...prev,
      loading: true,
      error: '',
    }));

    Promise.resolve()
      .then(() => {
        return erpOrchestrator.getSystemHealth(
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

        setHealthState({
          loading: false,
          error: '',
          result: mergeSystemHealthDefaults(result),
        });
      })
      .catch((error) => {
        if (!isMounted) return;

        setHealthState({
          loading: false,
          error: error?.message || 'Gagal memuat System Health.',
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

  const result = mergeSystemHealthDefaults(healthState.result);
  const summary = result.summary;
  const records = result.records;
  const moduleHealthRows = REQUIRED_MODULES.map((moduleName) => resolveModuleHealthRow(result, moduleName));
  const recommendations = buildRecommendationRows(result);

  const healthStatus = normalizeHealthStatus(summary.healthStatus);
  const healthScore = clampScore(summary.healthScore);

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
      severity: 'ALL',
      module: 'ALL',
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

        <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="rounded-2xl bg-red-600 p-2 shadow-sm">
                <ServerCog size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                ERP Monitoring Layer
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              SYSTEM HEALTH
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Enterprise Monitoring Dashboard untuk memantau kesehatan sistem ERP. Semua intelligence berasal dari erpOrchestrator.getSystemHealth().
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
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

          <ScoreRing score={healthScore} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard title="Overall Health Score" value={summary.healthScore} icon={<Gauge size={18} />} tone="red" />
        <KpiCard title="Total Warning" value={summary.totalWarning} icon={<AlertTriangle size={18} />} tone="amber" />
        <KpiCard title="Critical Issue" value={summary.totalCritical} icon={<AlertTriangle size={18} />} tone="dark" />
        <KpiCard title="High Issue" value={summary.totalHigh} icon={<Activity size={18} />} tone="orange" />
        <KpiCard title="Medium Issue" value={summary.totalMedium} icon={<ClipboardList size={18} />} tone="blue" />
        <KpiCard title="Low Issue" value={summary.totalLow} icon={<CheckCircle2 size={18} />} tone="green" />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <Filter size={17} className="text-red-600" />
              Filter System Health
            </div>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">
              Filter dikirim ke orchestrator. UI tidak menghitung health score sendiri.
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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              <AlertTriangle size={12} />
              Severity
            </span>
            <select
              value={filters.severity}
              onChange={(event) => handleFilterChange('severity', event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
            >
              {SEVERITY_OPTIONS.map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              <Layers size={12} />
              Module
            </span>
            <select
              value={filters.module}
              onChange={(event) => handleFilterChange('module', event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
            >
              {MODULE_FILTER_OPTIONS.map((moduleName) => (
                <option key={moduleName} value={moduleName}>
                  {moduleName}
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
              placeholder="Cari issue atau rekomendasi"
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

      {healthState.error && (
        <ErrorState message={healthState.error} />
      )}

      {healthState.loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          <div className="rounded-2xl border border-slate-100 bg-slate-950 p-6 text-white shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-black">
                  <ShieldCheck size={18} className="text-emerald-300" />
                  Overall Health Card
                </div>
                <p className="mt-1 text-sm font-medium text-slate-300">
                  Status utama berasal dari result.summary orchestrator.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={healthStatus} />
                <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                  Score {healthScore}/100
                </span>
              </div>
            </div>
          </div>

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <Database size={18} className="text-red-600" />
              Module Health
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {moduleHealthRows.map((moduleHealth) => (
                <ModuleHealthCard
                  key={moduleHealth.module}
                  moduleHealth={moduleHealth}
                />
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                      <AlertTriangle size={17} className="text-red-600" />
                      Issue List
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">
                      Klik issue untuk membuka detail modal read-only.
                    </p>
                  </div>

                  <span className="rounded-full border border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    {formatNumber(records.length)} issues
                  </span>
                </div>

                <div className="p-5">
                  {records.length === 0 ? (
                    <EmptyState />
                  ) : (
                    <div className="space-y-4">
                      {records.map((record, index) => (
                        <IssueCard
                          key={getRecordId(record, index)}
                          record={record}
                          onClick={() => setSelectedRecord(record)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="xl:col-span-4">
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <ClipboardList size={17} className="text-red-600" />
                    Recommendation Panel
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    Rekomendasi berasal dari orchestrator.
                  </p>
                </div>

                <div className="max-h-[720px] space-y-3 overflow-y-auto p-5">
                  {recommendations.length === 0 ? (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold leading-relaxed text-emerald-700">
                      Tidak ada rekomendasi khusus. Lanjutkan monitoring rutin.
                    </div>
                  ) : (
                    recommendations.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityBadge severity={item.severity} />
                          <span className="rounded-full border border-slate-100 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                            {item.module || 'SYSTEM'}
                          </span>
                        </div>

                        <div className="mt-3 text-sm font-black text-slate-900">
                          {item.title}
                        </div>

                        <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                          {item.recommendation || item.description || '-'}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      <DetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
}

export default TabSystemHealth;
