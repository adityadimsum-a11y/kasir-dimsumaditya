import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  Search,
  Filter,
  RefreshCw,
  X,
  Eye,
  Building2,
  Layers,
  Activity,
  Clock3,
  LockKeyhole,
  FileText,
} from 'lucide-react';

import erpOrchestrator from '../../utils/erpOrchestrator';

const EMPTY_OBJECT = Object.freeze({});

const PRIORITY_OPTIONS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const STATUS_OPTIONS = ['ALL', 'OPEN', 'READ', 'RESOLVED'];
const DEFAULT_MODULE_OPTIONS = [
  'ALL',
  'INVENTORY',
  'PAYABLE',
  'RECEIVABLE',
  'CASHFLOW',
  'PROFIT',
  'HPP',
  'SALES',
  'PRODUCTION',
  'SUPPLIER',
  'SYSTEM',
  'BUSINESS_RADAR',
];

const DEFAULT_SUMMARY = {
  totalNotifications: 0,
  totalCritical: 0,
  totalHigh: 0,
  totalMedium: 0,
  totalLow: 0,
  totalOpen: 0,
  totalRead: 0,
  totalResolved: 0,
};

const DEFAULT_RESULT = {
  summary: DEFAULT_SUMMARY,
  records: [],
  filters: {
    active: {},
    options: {},
  },
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

const mergeNotificationDefaults = (result) => {
  const source = safeObject(result);

  return {
    ...DEFAULT_RESULT,
    ...source,
    summary: {
      ...DEFAULT_SUMMARY,
      ...safeObject(source.summary),
    },
    records: safeArray(source.records),
    filters: {
      ...DEFAULT_RESULT.filters,
      ...safeObject(source.filters),
      active: safeObject(source.filters?.active),
      options: safeObject(source.filters?.options),
    },
    metadata: safeObject(source.metadata),
    warnings: safeArray(source.warnings),
  };
};

const buildModuleOptions = (dynamicModules = []) => {
  const values = [
    ...DEFAULT_MODULE_OPTIONS,
    ...safeArray(dynamicModules),
  ]
    .map(normalizeCode)
    .filter(Boolean)
    .filter((value) => value !== 'ALL');

  return ['ALL', ...Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))];
};

const getPriorityTone = (priority) => {
  const normalized = normalizeCode(priority);

  const toneMap = {
    CRITICAL: 'border-red-200 bg-red-50 text-red-700',
    HIGH: 'border-orange-200 bg-orange-50 text-orange-700',
    MEDIUM: 'border-amber-200 bg-amber-50 text-amber-700',
    LOW: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };

  return toneMap[normalized] || 'border-slate-200 bg-slate-50 text-slate-600';
};

const getPriorityIcon = (priority) => {
  const normalized = normalizeCode(priority);

  if (normalized === 'CRITICAL') return ShieldAlert;
  if (normalized === 'HIGH') return AlertTriangle;
  if (normalized === 'MEDIUM') return Info;

  return CheckCircle2;
};

const getStatusTone = (status) => {
  const normalized = normalizeCode(status);

  const toneMap = {
    OPEN: 'border-red-100 bg-red-50 text-red-700',
    READ: 'border-blue-100 bg-blue-50 text-blue-700',
    RESOLVED: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  };

  return toneMap[normalized] || 'border-slate-200 bg-slate-50 text-slate-600';
};

const getRecordId = (record = {}, index = 0) => {
  return String(record.id || record.notification_id || `${record.type || 'NTF'}-${record.entity_id || index}`);
};

const PriorityBadge = ({ priority }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getPriorityTone(priority)}`}>
    {priority || 'LOW'}
  </span>
);

const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getStatusTone(status)}`}>
    {status || 'OPEN'}
  </span>
);

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
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
    {[1, 2, 3, 4].map((item) => (
      <div
        key={item}
        className="animate-pulse rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
      >
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-slate-100" />
          <div className="flex-1">
            <div className="h-4 w-1/3 rounded-full bg-slate-100" />
            <div className="mt-3 h-3 w-2/3 rounded-full bg-slate-100" />
            <div className="mt-2 h-3 w-1/2 rounded-full bg-slate-100" />
          </div>
        </div>
      </div>
    ))}
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
      Notification Center hanya bisa diakses oleh OWNER atau DEWA.
    </p>
  </div>
);

const EmptyState = () => (
  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-8 text-center shadow-sm">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
      <Bell size={24} />
    </div>
    <div className="mt-4 text-lg font-black text-amber-900">
      Tidak ada notifikasi.
    </div>
    <p className="mx-auto mt-2 max-w-xl text-sm font-bold leading-relaxed text-amber-700">
      Semua kondisi ERP aman untuk filter yang sedang aktif.
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
          Gagal memuat Notification Center.
        </div>
        <p className="mt-1 text-sm font-bold leading-relaxed text-red-700">
          {message || 'Terjadi kesalahan saat membaca erpOrchestrator.getNotifications().'}
        </p>
      </div>
    </div>
  </div>
);

const NotificationCard = ({ record, onClick }) => {
  const Icon = getPriorityIcon(record.priority);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-100 hover:shadow-md"
    >
      <div className="flex items-start gap-4">
        <div className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border ${getPriorityTone(record.priority)}`}>
          <Icon size={24} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={record.priority} />
            <StatusBadge status={record.status} />
          </div>

          <h3 className="mt-3 text-base font-black leading-snug text-slate-950 group-hover:text-red-700">
            {record.title || 'ERP Notification'}
          </h3>

          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">
            {record.message || '-'}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-2 text-xs font-bold text-slate-500 md:grid-cols-3">
            <div className="flex items-center gap-2">
              <Clock3 size={14} className="text-slate-400" />
              <span>{formatDateTime(record.timestamp)}</span>
            </div>

            <div className="flex items-center gap-2">
              <Layers size={14} className="text-slate-400" />
              <span>{record.module || '-'}</span>
            </div>

            <div className="flex items-center gap-2">
              <Building2 size={14} className="text-slate-400" />
              <span>{record.branch || '-'}</span>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Action Hint
            </div>
            <div className="mt-1 text-sm font-bold leading-relaxed text-slate-700">
              {record.action_hint || 'Lanjutkan monitoring rutin.'}
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
  const notes = record.notes || record.note || record.description || record.message || '-';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <Bell size={18} className="text-red-600" />
              Notification Detail
            </div>
            <p className="mt-1 text-xs font-bold text-slate-400">
              Detail notifikasi dari ERP Intelligence. Read only.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
            aria-label="Close notification detail"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Priority
              </div>
              <div className="mt-3">
                <PriorityBadge priority={record.priority} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Status
              </div>
              <div className="mt-3">
                <StatusBadge status={record.status} />
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
                {record.module || 'SYSTEM'}
              </span>
              <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {record.type || 'NOTIFICATION'}
              </span>
            </div>

            <h2 className="mt-4 text-xl font-black text-slate-950">
              {record.title || 'ERP Notification'}
            </h2>

            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
              {record.message || '-'}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Reference Number
              </div>
              <div className="mt-2 break-words text-sm font-black text-slate-900">
                {record.reference_number || '-'}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Entity Type
              </div>
              <div className="mt-2 break-words text-sm font-black text-slate-900">
                {record.entity_type || '-'}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Entity ID
              </div>
              <div className="mt-2 break-words text-sm font-black text-slate-900">
                {record.entity_id || '-'}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Notes
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm font-bold leading-relaxed text-slate-700">
              {notes}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Action Hint
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm font-bold leading-relaxed text-slate-700">
              {record.action_hint || 'Lanjutkan monitoring rutin.'}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-950 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-800 p-4 text-sm font-black text-white">
              <FileText size={16} className="text-amber-300" />
              Raw Metadata JSON
            </div>
            <pre className="max-h-[420px] overflow-auto p-4 text-xs font-semibold leading-relaxed text-slate-200">
              {stringifyJson(metadata)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

function TabNotificationCenter(props = {}) {
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
    priority: 'ALL',
    module: 'ALL',
    branch: '',
    status: 'ALL',
    search: '',
  });

  const [appliedFilters, setAppliedFilters] = useState({
  priority: 'ALL',
  module: 'ALL',
  branch: '',
  status: 'ALL',
  search: '',
});

  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [notificationState, setNotificationState] = useState({
    loading: true,
    error: '',
    result: DEFAULT_RESULT,
  });

const requestInput = useMemo(() => ({
  priority: appliedFilters.priority === 'ALL' ? '' : appliedFilters.priority,
  module: appliedFilters.module === 'ALL' ? '' : appliedFilters.module,
  branch: appliedFilters.branch,
  status: appliedFilters.status === 'ALL' ? '' : appliedFilters.status,
  search: appliedFilters.search,
}), [
  appliedFilters.priority,
  appliedFilters.module,
  appliedFilters.branch,
  appliedFilters.status,
  appliedFilters.search,
]);

  useEffect(() => {
    if (!ownerAllowed) {
      setNotificationState({
        loading: false,
        error: '',
        result: DEFAULT_RESULT,
      });
      return;
    }

    if (typeof erpOrchestrator?.getNotifications !== 'function') {
      setNotificationState({
        loading: false,
        error: 'erpOrchestrator.getNotifications() belum tersedia.',
        result: DEFAULT_RESULT,
      });
      return;
    }

    let isMounted = true;

    setNotificationState((prev) => ({
      ...prev,
      loading: true,
      error: '',
    }));

    Promise.resolve()
      .then(() => {
        return erpOrchestrator.getNotifications(
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

        setNotificationState({
          loading: false,
          error: '',
          result: mergeNotificationDefaults(result),
        });
      })
      .catch((error) => {
        if (!isMounted) return;

        setNotificationState({
          loading: false,
          error: error?.message || 'Gagal memuat Notification Center.',
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

  const result = mergeNotificationDefaults(notificationState.result);
  const summary = result.summary;
  const records = result.records;

  const moduleOptions = useMemo(() => {
    return buildModuleOptions(result.filters?.options?.modules);
  }, [result.filters]);

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
    priority: 'ALL',
    module: 'ALL',
    branch: '',
    status: 'ALL',
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
                <Bell size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                ERP Intelligence Layer
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              NOTIFICATION CENTER
            </h1>

            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Pusat peringatan otomatis untuk Owner. Semua intelligence berasal dari erpOrchestrator.getNotifications().
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Total Notification" value={summary.totalNotifications} icon={<Bell size={18} />} tone="red" />
        <KpiCard title="Critical" value={summary.totalCritical} icon={<ShieldAlert size={18} />} tone="dark" />
        <KpiCard title="High" value={summary.totalHigh} icon={<AlertTriangle size={18} />} tone="orange" />
        <KpiCard title="Medium" value={summary.totalMedium} icon={<Info size={18} />} tone="amber" />
        <KpiCard title="Low" value={summary.totalLow} icon={<CheckCircle2 size={18} />} tone="green" />
        <KpiCard title="Open" value={summary.totalOpen} icon={<Activity size={18} />} />
        <KpiCard title="Read" value={summary.totalRead} icon={<Eye size={18} />} tone="blue" />
        <KpiCard title="Resolved" value={summary.totalResolved} icon={<CheckCircle2 size={18} />} tone="green" />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <Filter size={17} className="text-red-600" />
              Filter Notification
            </div>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">
              Filter dikirim ke orchestrator. UI tidak membuat notifikasi sendiri.
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
              <ShieldAlert size={12} />
              Priority
            </span>
            <select
              value={filters.priority}
              onChange={(event) => handleFilterChange('priority', event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
            >
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
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
              {moduleOptions.map((moduleName) => (
                <option key={moduleName} value={moduleName}>
                  {moduleName}
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
              <Activity size={12} />
              Status
            </span>
            <select
              value={filters.status}
              onChange={(event) => handleFilterChange('status', event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
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
              placeholder="Cari notifikasi"
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

      {notificationState.error && (
        <ErrorState message={notificationState.error} />
      )}

      {notificationState.loading ? (
        <LoadingSkeleton />
      ) : records.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {records.map((record, index) => (
            <NotificationCard
              key={getRecordId(record, index)}
              record={record}
              onClick={() => setSelectedRecord(record)}
            />
          ))}
        </div>
      )}

      <DetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
}

export default TabNotificationCenter;
