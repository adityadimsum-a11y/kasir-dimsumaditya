import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Calendar,
  Filter,
  RefreshCw,
  ShieldCheck,
  History,
  User,
  Building2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Download,
  Activity,
  AlertTriangle,
  X,
  Eye,
  Clock,
  Database,
  LockKeyhole,
} from 'lucide-react';

import erpOrchestrator from '../../utils/erpOrchestrator';

const ROWS_PER_PAGE = 20;

const ACTION_OPTIONS = [
  'ALL',
  'CREATE',
  'UPDATE',
  'DELETE',
  'VOID',
  'APPROVE',
  'REJECT',
  'LOGIN',
  'LOGOUT',
  'POST',
];

const MODULE_OPTIONS = [
  'ALL',
  'MASTER',
  'PURCHASE',
  'PRODUCTION',
  'SALES',
  'KAS_BANK',
  'PIUTANG',
  'HUTANG',
  'INVENTORY',
  'DASHBOARD',
  'SYSTEM',
];

const DEFAULT_SUMMARY = {
  totalRecords: 0,
  totalCreate: 0,
  totalUpdate: 0,
  totalDelete: 0,
  totalVoid: 0,
  totalApprove: 0,
  totalReject: 0,
  totalLogin: 0,
  totalLogout: 0,
  totalPost: 0,
};

const DEFAULT_AUDIT_RESULT = {
  summary: DEFAULT_SUMMARY,
  records: [],
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

const hasValue = (value) => {
  return value !== undefined && value !== null && value !== '';
};

const safeArray = (value) => {
  return Array.isArray(value) ? value : [];
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

const formatNumber = (value) => {
  return Math.round(toNumber(value)).toLocaleString('id-ID');
};

const getTodayStr = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const formatDateTime = (value) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

const isOwnerRole = (user = {}) => {
  const role = normalizeCode(user.role || user.user_role || user.access_role || user.position || '');
  return ['OWNER', 'DEWA'].includes(role);
};

const mergeAuditDefaults = (result) => {
  const source = result || {};

  return {
    ...DEFAULT_AUDIT_RESULT,
    ...source,
    summary: {
      ...DEFAULT_SUMMARY,
      ...(source.summary || {}),
    },
    records: safeArray(source.records),
    filters: source.filters || {},
    metadata: source.metadata || {},
    warnings: safeArray(source.warnings),
  };
};

const getActionTone = (action) => {
  const normalized = normalizeCode(action);

  const toneMap = {
    CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    UPDATE: 'bg-blue-50 text-blue-700 border-blue-100',
    DELETE: 'bg-red-50 text-red-700 border-red-100',
    VOID: 'bg-rose-100 text-rose-800 border-rose-200',
    APPROVE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    REJECT: 'bg-orange-50 text-orange-700 border-orange-100',
    LOGIN: 'bg-purple-50 text-purple-700 border-purple-100',
    LOGOUT: 'bg-slate-100 text-slate-600 border-slate-200',
    POST: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  };

  return toneMap[normalized] || 'bg-slate-50 text-slate-600 border-slate-100';
};

const ActionBadge = ({ action }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getActionTone(action)}`}>
    {action || 'UNKNOWN'}
  </span>
);

const SmallBadge = ({ children, tone = 'slate' }) => {
  const toneMap = {
    red: 'bg-red-50 text-red-700 border-red-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    gold: 'bg-amber-50 text-amber-700 border-amber-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
    dark: 'bg-slate-950 text-white border-slate-800',
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${toneMap[tone] || toneMap.slate}`}>
      {children}
    </span>
  );
};

const getRecordId = (record = {}, index = 0) => {
  return String(record.id || record.audit_id || `${record.reference_number || 'AUDIT'}-${record.entity_id || index}`);
};

const stringifySnapshot = (value) => {
  if (!hasValue(value)) return '{}';

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

const escapeCsvCell = (value) => {
  const raw = value === undefined || value === null ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
};

const buildCsv = (records = []) => {
  const headers = [
    'Timestamp',
    'User',
    'Role',
    'Cabang',
    'Module',
    'Action',
    'Reference Number',
    'Entity Type',
    'Entity ID',
    'Notes',
  ];

  const rows = safeArray(records).map((record) => [
    record.timestamp,
    record.user,
    record.role,
    record.branch,
    record.module,
    record.action,
    record.reference_number,
    record.entity_type,
    record.entity_id,
    record.notes,
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n');
};

const downloadCsv = (records = []) => {
  const csv = buildCsv(records);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = `audit-trail-${getTodayStr()}.csv`;
  anchor.click();

  URL.revokeObjectURL(url);
};

const KpiCard = ({ title, value, icon, tone = 'white' }) => {
  const toneMap = {
    red: 'bg-red-600 text-white',
    dark: 'bg-slate-950 text-white',
    gold: 'border border-amber-100 bg-amber-50 text-amber-900',
    green: 'border border-emerald-100 bg-emerald-50 text-emerald-900',
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

const Skeleton = () => (
  <div className="space-y-4">
    {[1, 2, 3, 4].map((item) => (
      <div key={item} className="animate-pulse rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="h-4 w-1/3 rounded-full bg-slate-100" />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="h-10 rounded-2xl bg-slate-100" />
          <div className="h-10 rounded-2xl bg-slate-100" />
          <div className="h-10 rounded-2xl bg-slate-100" />
        </div>
      </div>
    ))}
  </div>
);

const EmptyState = () => (
  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-8 text-center shadow-sm">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm">
      <History size={24} />
    </div>
    <div className="mt-4 text-lg font-black text-amber-900">
      Tidak ada aktivitas audit ditemukan.
    </div>
    <p className="mx-auto mt-2 max-w-xl text-sm font-bold leading-relaxed text-amber-700">
      Coba ubah filter tanggal, user, cabang, module, action, atau keyword search.
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
          Gagal memuat Audit Trail.
        </div>
        <p className="mt-1 text-sm font-bold leading-relaxed text-red-700">
          {message || 'Terjadi kesalahan saat membaca data dari erpOrchestrator.getAuditTrail().'}
        </p>
      </div>
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
      Audit Trail Command Center hanya bisa diakses oleh OWNER atau DEWA.
    </p>
  </div>
);

const DetailModal = ({ record, onClose }) => {
  if (!record) return null;

  const metadata = record.metadata || {};
  const userInfo = {
    user: record.user || '',
    role: record.role || '',
    branch: record.branch || '',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <ShieldCheck size={18} className="text-red-600" />
              Audit Detail
            </div>
            <p className="mt-1 text-xs font-bold text-slate-400">
              Read only detail drawer untuk investigasi aktivitas ERP.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
            aria-label="Close audit detail"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Timestamp
              </div>
              <div className="mt-2 text-sm font-black text-slate-900">
                {formatDateTime(record.timestamp)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                User Info
              </div>
              <div className="mt-2 text-sm font-black text-slate-900">
                {record.user || '-'} · {record.role || '-'}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Cabang
              </div>
              <div className="mt-2 text-sm font-black text-slate-900">
                {record.branch || '-'}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Module / Action
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <SmallBadge tone="slate">{record.module || '-'}</SmallBadge>
                <ActionBadge action={record.action} />
              </div>
            </div>

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
                Entity
              </div>
              <div className="mt-2 break-words text-sm font-black text-slate-900">
                {record.entity_type || '-'} · {record.entity_id || '-'}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Notes
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm font-bold leading-relaxed text-slate-700">
              {record.notes || '-'}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-950 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-800 p-4 text-sm font-black text-white">
                <Database size={16} className="text-amber-300" />
                Before Snapshot JSON
              </div>
              <pre className="max-h-[420px] overflow-auto p-4 text-xs font-semibold leading-relaxed text-slate-200">
                {stringifySnapshot(record.before_snapshot)}
              </pre>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-950 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-800 p-4 text-sm font-black text-white">
                <Database size={16} className="text-emerald-300" />
                After Snapshot JSON
              </div>
              <pre className="max-h-[420px] overflow-auto p-4 text-xs font-semibold leading-relaxed text-slate-200">
                {stringifySnapshot(record.after_snapshot)}
              </pre>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 p-4 text-sm font-black text-slate-900">
                <FileText size={16} className="text-red-600" />
                Metadata
              </div>
              <pre className="max-h-[300px] overflow-auto p-4 text-xs font-semibold leading-relaxed text-slate-600">
                {stringifySnapshot(metadata)}
              </pre>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 p-4 text-sm font-black text-slate-900">
                <User size={16} className="text-red-600" />
                User Info
              </div>
              <pre className="max-h-[300px] overflow-auto p-4 text-xs font-semibold leading-relaxed text-slate-600">
                {stringifySnapshot(userInfo)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function TabAuditTrail({
  dbData = {},
  source = null,
  user = {},
}) {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    user: '',
    branch: '',
    module: 'ALL',
    action: 'ALL',
    search: '',
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [auditState, setAuditState] = useState({
    loading: true,
    error: '',
    result: DEFAULT_AUDIT_RESULT,
  });

  const ownerAllowed = isOwnerRole(user);
  const sourceData = source || dbData || {};

  const requestInput = useMemo(() => ({
    startDate: filters.startDate,
    endDate: filters.endDate,
    user: filters.user,
    branch: filters.branch,
    module: filters.module === 'ALL' ? '' : filters.module,
    action: filters.action === 'ALL' ? '' : filters.action,
    search: filters.search,
  }), [
    filters.startDate,
    filters.endDate,
    filters.user,
    filters.branch,
    filters.module,
    filters.action,
    filters.search,
  ]);

  useEffect(() => {
    if (!ownerAllowed) {
      setAuditState({
        loading: false,
        error: '',
        result: DEFAULT_AUDIT_RESULT,
      });
      return;
    }

    if (typeof erpOrchestrator?.getAuditTrail !== 'function') {
      setAuditState({
        loading: false,
        error: 'erpOrchestrator.getAuditTrail() belum tersedia.',
        result: DEFAULT_AUDIT_RESULT,
      });
      return;
    }

    let isMounted = true;

    setAuditState((prev) => ({
      ...prev,
      loading: true,
      error: '',
    }));

    Promise.resolve()
      .then(() => {
        return erpOrchestrator.getAuditTrail(
          requestInput,
          {
            source: sourceData,
            dbData: sourceData,
            readonly: true,
            user,
            executor: user?.email || user?.name || user?.username || 'AUDIT_TRAIL_COMMAND_CENTER',
          },
        );
      })
      .then((result) => {
        if (!isMounted) return;

        setAuditState({
          loading: false,
          error: '',
          result: mergeAuditDefaults(result || {}),
        });
        setCurrentPage(1);
      })
      .catch((error) => {
        if (!isMounted) return;

        setAuditState({
          loading: false,
          error: error?.message || 'Gagal memuat Audit Trail.',
          result: DEFAULT_AUDIT_RESULT,
        });
      });

    return () => {
      isMounted = false;
    };
  }, [
    ownerAllowed,
    requestInput,
    sourceData,
    user,
    refreshKey,
  ]);

  const audit = mergeAuditDefaults(auditState.result);
  const summary = audit.summary || DEFAULT_SUMMARY;
  const records = safeArray(audit.records);
  const resultFilters = audit.filters || {};
  const metadata = audit.metadata || {};
  const warnings = safeArray(audit.warnings);

  const totalPages = Math.max(1, Math.ceil(records.length / ROWS_PER_PAGE));
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);

  const paginatedRecords = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ROWS_PER_PAGE;
    return records.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [records, safeCurrentPage]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleReset = () => {
    setFilters({
      startDate: '',
      endDate: '',
      user: '',
      branch: '',
      module: 'ALL',
      action: 'ALL',
      search: '',
    });
    setCurrentPage(1);
  };

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleExportCsv = () => {
    downloadCsv(records);
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
        <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-red-600/30 blur-2xl" />
        <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-amber-400/20 blur-2xl" />

        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="rounded-2xl bg-red-600 p-2 shadow-sm">
                <History size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                ERP Governance & Audit Layer
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              AUDIT TRAIL COMMAND CENTER
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">
              Monitor seluruh aktivitas ERP secara real-time.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <SmallBadge tone="dark">OWNER ONLY</SmallBadge>
            <SmallBadge tone="gold">READ ONLY</SmallBadge>
            <SmallBadge tone="green">getAuditTrail()</SmallBadge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Total Record" value={summary.totalRecords} icon={<Activity size={18} />} tone="red" />
        <KpiCard title="Create" value={summary.totalCreate} icon={<FileText size={18} />} tone="green" />
        <KpiCard title="Update" value={summary.totalUpdate} icon={<RefreshCw size={18} />} />
        <KpiCard title="Delete" value={summary.totalDelete} icon={<AlertTriangle size={18} />} />
        <KpiCard title="Void" value={summary.totalVoid} icon={<ShieldCheck size={18} />} tone="dark" />
        <KpiCard title="Approve" value={summary.totalApprove} icon={<ShieldCheck size={18} />} tone="green" />
        <KpiCard title="Reject" value={summary.totalReject} icon={<AlertTriangle size={18} />} tone="gold" />
        <KpiCard title="Login" value={summary.totalLogin} icon={<User size={18} />} />
        <KpiCard title="Logout" value={summary.totalLogout} icon={<User size={18} />} />
        <KpiCard title="Post" value={summary.totalPost} icon={<FileText size={18} />} tone="gold" />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <Filter size={17} className="text-red-600" />
              Filter Panel
            </div>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">
              Filter dikirim ke orchestrator. UI tidak membaca database secara langsung.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <SmallBadge tone="slate">
              Records: {formatNumber(records.length)}
            </SmallBadge>
            {metadata?.generated_at && (
              <SmallBadge tone="dark">
                Generated: {formatDate(metadata.generated_at)}
              </SmallBadge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              <Calendar size={12} />
              Tanggal Awal
            </span>
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => handleFilterChange('startDate', event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
            />
          </label>

          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              <Calendar size={12} />
              Tanggal Akhir
            </span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => handleFilterChange('endDate', event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
            />
          </label>

          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              <User size={12} />
              User
            </span>
            <input
              type="text"
              value={filters.user}
              onChange={(event) => handleFilterChange('user', event.target.value)}
              placeholder="Nama user"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
            />
          </label>

          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              <Building2 size={12} />
              Cabang
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
              Module
            </span>
            <select
              value={filters.module}
              onChange={(event) => handleFilterChange('module', event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
            >
              {MODULE_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              <ShieldCheck size={12} />
              Action
            </span>
            <select
              value={filters.action}
              onChange={(event) => handleFilterChange('action', event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
            >
              {ACTION_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block xl:col-span-2">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              <Search size={12} />
              Keyword Search
            </span>
            <input
              type="text"
              value={filters.search}
              onChange={(event) => handleFilterChange('search', event.target.value)}
              placeholder="Nomor referensi, nama user, atau entity ID"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRefresh}
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

          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 transition-all hover:bg-amber-100"
          >
            <RefreshCw size={14} />
            REFRESH
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={records.length === 0}
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 transition-all hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={14} />
            EXPORT CSV
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <SmallBadge tone="slate">
            Filter Source: {Object.keys(resultFilters).length > 0 ? 'ORCHESTRATOR' : 'DEFAULT'}
          </SmallBadge>
          {warnings.length > 0 && (
            <SmallBadge tone="gold">
              {formatNumber(warnings.length)} warning
            </SmallBadge>
          )}
        </div>
      </div>

      {auditState.error && <ErrorState message={auditState.error} />}

      {auditState.loading ? (
        <Skeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-4">
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <Clock size={17} className="text-red-600" />
                    Timeline View
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    Aktivitas terbaru dari hasil filter aktif.
                  </p>
                </div>

                <div className="max-h-[680px] space-y-3 overflow-y-auto p-5">
                  {records.length === 0 ? (
                    <EmptyState />
                  ) : (
                    records.slice(0, 12).map((record, index) => (
                      <button
                        key={getRecordId(record, index)}
                        type="button"
                        onClick={() => setSelectedRecord(record)}
                        className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition-all hover:border-red-100 hover:bg-red-50"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-red-600" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <ActionBadge action={record.action} />
                              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                                {record.module || '-'}
                              </span>
                            </div>
                            <div className="mt-2 truncate text-sm font-black text-slate-900">
                              {record.reference_number || record.entity_id || '-'}
                            </div>
                            <div className="mt-1 text-xs font-bold text-slate-500">
                              {record.user || '-'} · {formatDateTime(record.timestamp)}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="xl:col-span-8">
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                      <FileText size={17} className="text-red-600" />
                      Audit Table
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">
                      Klik row untuk membuka detail drawer.
                    </p>
                  </div>

                  <SmallBadge tone="slate">
                    Page {safeCurrentPage} of {totalPages}
                  </SmallBadge>
                </div>

                {records.length === 0 ? (
                  <div className="p-5">
                    <EmptyState />
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50">
                          <tr>
                            {[
                              'Tanggal/Waktu',
                              'User',
                              'Role',
                              'Cabang',
                              'Module',
                              'Action',
                              'Reference',
                              'Entity',
                              'Notes',
                              '',
                            ].map((column) => (
                              <th
                                key={column || 'action'}
                                className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-400"
                              >
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 bg-white">
                          {paginatedRecords.map((record, index) => (
                            <tr
                              key={getRecordId(record, index)}
                              className="transition-all hover:bg-red-50/40"
                            >
                              <td className="whitespace-nowrap px-4 py-4 text-xs font-bold text-slate-600">
                                {formatDateTime(record.timestamp)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 text-sm font-black text-slate-900">
                                {record.user || '-'}
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 text-xs font-bold text-slate-500">
                                {record.role || '-'}
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 text-xs font-bold text-slate-500">
                                {record.branch || '-'}
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 text-xs font-black text-slate-700">
                                {record.module || '-'}
                              </td>
                              <td className="whitespace-nowrap px-4 py-4">
                                <ActionBadge action={record.action} />
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 text-xs font-bold text-slate-500">
                                {record.reference_number || '-'}
                              </td>
                              <td className="px-4 py-4 text-xs font-bold text-slate-500">
                                <div className="min-w-[160px]">
                                  <div className="font-black text-slate-700">
                                    {record.entity_type || '-'}
                                  </div>
                                  <div className="mt-1 text-slate-400">
                                    {record.entity_id || '-'}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-xs font-bold text-slate-500">
                                <div className="line-clamp-2 min-w-[220px]">
                                  {record.notes || '-'}
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => setSelectedRecord(record)}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                                >
                                  <Eye size={13} />
                                  Detail
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
                      <div className="text-xs font-bold text-slate-400">
                        Menampilkan {formatNumber(paginatedRecords.length)} dari {formatNumber(records.length)} record.
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                          disabled={safeCurrentPage <= 1}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ChevronLeft size={14} />
                          Previous
                        </button>

                        <span className="rounded-2xl bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                          Page {safeCurrentPage} of {totalPages}
                        </span>

                        <button
                          type="button"
                          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                          disabled={safeCurrentPage >= totalPages}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <DetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
}

export default TabAuditTrail;
