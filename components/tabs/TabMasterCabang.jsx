import React, { useMemo, useState } from 'react';
import {
  Building2,
  Plus,
  Save,
  X,
  Edit2,
  Trash2,
  Power,
  RotateCcw,
  Search,
  Filter,
  MapPin,
  Phone,
  Mail,
  User,
  Warehouse,
  Globe,
  Clock,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Briefcase,
  Layers,
} from 'lucide-react';

import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import erpOrchestrator from '../../services/erpOrchestrator';

const BRANCH_TYPES = [
  'HEAD_OFFICE',
  'PRODUCTION_BRANCH',
  'RESTO',
  'FRANCHISE',
  'WAREHOUSE',
];

const BRANCH_STATUS = [
  'ACTIVE',
  'NON_ACTIVE',
];

const BRANCH_SCOPE = [
  'GLOBAL',
  'BRANCH',
  'FRANCHISE',
];

const TIMEZONES = [
  'Asia/Jakarta',
  'Asia/Makassar',
  'Asia/Jayapura',
];

const DEFAULT_FORM = {
  id: '',
  branch_id: '',
  branch_code: '',
  branch_name: '',
  branch_type: 'RESTO',
  branch_status: 'ACTIVE',
  branch_scope: 'BRANCH',
  alamat: '',
  kota: '',
  provinsi: '',
  nomor_telepon: '',
  email: '',
  manager: '',
  warehouse_default: '',
  timezone: 'Asia/Jakarta',
  notes: '',
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

const isSoftDeleted = (row) => {
  const value = row?.isDeleted ?? row?.is_deleted ?? row?.deleted;
  return value === true || String(value || '').toUpperCase() === 'TRUE';
};

const normalizeBranchStatus = (row) => {
  if (isSoftDeleted(row)) return 'SOFT_DELETED';

  const value = row?.branch_status ?? row?.status ?? row?.status_active ?? row?.is_active;

  if (value === false) return 'NON_ACTIVE';
  if (value === true) return 'ACTIVE';

  const normalized = normalizeCode(value || 'ACTIVE');

  if (['NON_ACTIVE', 'NONAKTIF', 'INACTIVE', 'DISABLED', 'FALSE', 'NO', 'N', '0'].includes(normalized)) {
    return 'NON_ACTIVE';
  }

  return 'ACTIVE';
};

const getRawBranchRows = ({
  masterBranches,
  master_branches,
  master_branch,
  branches,
  dbData,
}) => {
  if (Array.isArray(master_branches)) return master_branches;
  if (Array.isArray(masterBranches)) return masterBranches;
  if (Array.isArray(master_branch)) return master_branch;
  if (Array.isArray(branches)) return branches;

  if (Array.isArray(dbData?.master_branches)) return dbData.master_branches;
  if (Array.isArray(dbData?.masterBranches)) return dbData.masterBranches;
  if (Array.isArray(dbData?.master_branch)) return dbData.master_branch;
  if (Array.isArray(dbData?.branches)) return dbData.branches;

  return [];
};

const normalizeBranchDisplay = (record) => {
  const raw = record?.raw || record || {};

  const branchId = String(
    raw.branch_id ||
    raw.branchId ||
    record?.id ||
    raw.id ||
    '',
  ).trim();

  const branchCode = String(
    raw.branch_code ||
    raw.branchCode ||
    raw.code ||
    record?.code ||
    branchId ||
    '',
  ).trim();

  const branchName = String(
    raw.branch_name ||
    raw.branchName ||
    raw.nama_cabang ||
    raw.name ||
    record?.name ||
    '',
  ).trim();

  const branchType = normalizeCode(
    raw.branch_type ||
    raw.branchType ||
    raw.type ||
    'RESTO',
  );

  const branchStatus = normalizeBranchStatus(raw);

  const branchScope = normalizeCode(
    raw.branch_scope ||
    raw.branchScope ||
    raw.scope_type ||
    raw.scope ||
    record?.scope_type ||
    (branchType === 'HEAD_OFFICE' ? 'GLOBAL' : 'BRANCH'),
  );

  return {
    id: String(raw.id || branchId).trim(),
    branch_id: branchId,
    branch_code: branchCode,
    branch_name: branchName,
    branch_type: branchType,
    branch_status: branchStatus,
    branch_scope: branchScope,

    alamat: String(raw.alamat || raw.address || '').trim(),
    kota: String(raw.kota || raw.city || '').trim(),
    provinsi: String(raw.provinsi || raw.province || '').trim(),
    nomor_telepon: String(raw.nomor_telepon || raw.phone || raw.no_hp || raw.telepon || '').trim(),
    email: String(raw.email || '').trim(),
    manager: String(raw.manager || raw.pic || raw.manager_name || '').trim(),
    warehouse_default: String(raw.warehouse_default || raw.default_warehouse || raw.warehouse_id || '').trim(),
    timezone: String(raw.timezone || 'Asia/Jakarta').trim(),
    notes: String(raw.notes || raw.keterangan || raw.description || '').trim(),

    date: raw.date || raw.created_at || raw.updated_at || '',
    created_at: raw.created_at || '',
    updated_at: raw.updated_at || '',

    isDeleted: isSoftDeleted(raw),

    search_text: normalizeText([
      branchId,
      branchCode,
      branchName,
      branchType,
      branchStatus,
      branchScope,
      raw.alamat,
      raw.address,
      raw.kota,
      raw.city,
      raw.provinsi,
      raw.province,
      raw.nomor_telepon,
      raw.phone,
      raw.email,
      raw.manager,
      raw.warehouse_default,
    ].filter(Boolean).join(' ')),

    raw,
  };
};

const Badge = ({ children, tone = 'slate' }) => {
  const toneMap = {
    red: 'bg-red-50 text-red-700 border-red-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
    dark: 'bg-slate-900 text-white border-slate-900',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border ${toneMap[tone] || toneMap.slate}`}>
      {children}
    </span>
  );
};

const StatCard = ({ title, value, icon, tone = 'red' }) => {
  const toneMap = {
    red: 'bg-red-600 text-white',
    white: 'bg-white text-slate-800 border border-slate-100',
    gold: 'bg-amber-50 text-amber-800 border border-amber-100',
    dark: 'bg-slate-950 text-white',
  };

  return (
    <div className={`rounded-3xl p-5 shadow-sm ${toneMap[tone] || toneMap.white}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{title}</div>
          <div className="mt-2 text-3xl font-black tracking-tight">{value}</div>
        </div>
        <div className="p-3 rounded-2xl bg-white/80 text-red-600 shadow-sm border border-white/50">
          {icon}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children, required = false }) => (
  <div>
    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
      {label} {required && <span className="text-red-600">*</span>}
    </label>
    {children}
  </div>
);

const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50 disabled:bg-slate-50 disabled:text-slate-400';

export default function TabMasterCabang({
  masterBranches = [],
  master_branches,
  master_branch,
  branches,
  dbData = {},
  sendToSheet,
  showToast,
  user,
}) {
  const todayStr = getTodayStr();

  const [form, setForm] = useState(DEFAULT_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const rawBranches = useMemo(() => {
    return getRawBranchRows({
      masterBranches,
      master_branches,
      master_branch,
      branches,
      dbData,
    });
  }, [masterBranches, master_branches, master_branch, branches, dbData]);

  const masterSource = useMemo(() => ({
    ...(dbData || {}),
    master_branches: rawBranches,
    masterBranches: rawBranches,
    master_branch: rawBranches,
  }), [dbData, rawBranches]);

  const branchRecords = useMemo(() => {
    const result = erpOrchestrator.masterData.getBranches(masterSource, {
      includeInactive: true,
      includeDeleted: true,
      validate: false,
    });

    return (result.records || [])
      .map(normalizeBranchDisplay)
      .sort((a, b) => {
        if (a.branch_status === 'ACTIVE' && b.branch_status !== 'ACTIVE') return -1;
        if (a.branch_status !== 'ACTIVE' && b.branch_status === 'ACTIVE') return 1;
        return String(a.branch_name).localeCompare(String(b.branch_name));
      });
  }, [masterSource]);

  const searchResultIds = useMemo(() => {
    const keyword = searchQuery.trim();

    if (!keyword) return new Set();

    const result = erpOrchestrator.masterData.searchMaster(masterSource, {
      masterType: 'BRANCH',
      keyword,
      includeInactive: true,
      includeDeleted: true,
    }, {
      validate: false,
    });

    return new Set((result.records || []).flatMap((record) => {
      const branch = normalizeBranchDisplay(record);
      return [branch.id, branch.branch_id, branch.branch_code].filter(Boolean);
    }));
  }, [masterSource, searchQuery]);

  const filteredBranches = useMemo(() => {
    const keyword = normalizeText(searchQuery);

    return branchRecords.filter((branch) => {
      const statusOk = statusFilter === 'ALL'
        ? !branch.isDeleted
        : statusFilter === 'SOFT_DELETED'
          ? branch.isDeleted || branch.branch_status === 'SOFT_DELETED'
          : branch.branch_status === statusFilter && !branch.isDeleted;

      const typeOk = typeFilter === 'ALL' || branch.branch_type === typeFilter;

      const searchOk = !keyword ||
        branch.search_text.includes(keyword) ||
        searchResultIds.has(branch.id) ||
        searchResultIds.has(branch.branch_id) ||
        searchResultIds.has(branch.branch_code);

      return statusOk && typeOk && searchOk;
    });
  }, [branchRecords, searchQuery, searchResultIds, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const active = branchRecords.filter((branch) => !branch.isDeleted && branch.branch_status === 'ACTIVE').length;
    const nonActive = branchRecords.filter((branch) => !branch.isDeleted && branch.branch_status === 'NON_ACTIVE').length;
    const deleted = branchRecords.filter((branch) => branch.isDeleted || branch.branch_status === 'SOFT_DELETED').length;
    const franchise = branchRecords.filter((branch) => !branch.isDeleted && branch.branch_type === 'FRANCHISE').length;

    return {
      total: branchRecords.filter((branch) => !branch.isDeleted).length,
      active,
      nonActive,
      deleted,
      franchise,
    };
  }, [branchRecords]);

  const notify = (message, type = 'success') => {
    if (typeof showToast === 'function') {
      showToast(message, type);
      return;
    }

    if (type === 'error') {
      window.alert(message);
    }
  };

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setIsEditing(false);
    setSelectedBranch(null);
  };

  const handleGenerateId = () => {
    const newId = generateId('BR', todayStr);
    setForm((prev) => ({
      ...prev,
      branch_id: prev.branch_id || newId,
      id: prev.id || newId,
    }));
  };

  const handleEdit = (branch) => {
    setSelectedBranch(branch);
    setIsEditing(true);

    setForm({
      id: branch.id || branch.branch_id,
      branch_id: branch.branch_id,
      branch_code: branch.branch_code,
      branch_name: branch.branch_name,
      branch_type: branch.branch_type || 'RESTO',
      branch_status: branch.branch_status === 'SOFT_DELETED' ? 'NON_ACTIVE' : branch.branch_status || 'ACTIVE',
      branch_scope: branch.branch_scope || 'BRANCH',
      alamat: branch.alamat,
      kota: branch.kota,
      provinsi: branch.provinsi,
      nomor_telepon: branch.nomor_telepon,
      email: branch.email,
      manager: branch.manager,
      warehouse_default: branch.warehouse_default,
      timezone: branch.timezone || 'Asia/Jakarta',
      notes: branch.notes,
    });
  };

  const validateForm = () => {
    const warnings = [];

    if (!form.branch_id.trim()) warnings.push('Branch ID wajib diisi.');
    if (!form.branch_code.trim()) warnings.push('Branch Code wajib diisi.');
    if (!form.branch_name.trim()) warnings.push('Nama cabang wajib diisi.');
    if (!form.branch_type.trim()) warnings.push('Tipe cabang wajib dipilih.');
    if (!form.branch_status.trim()) warnings.push('Status cabang wajib dipilih.');
    if (!form.branch_scope.trim()) warnings.push('Scope cabang wajib dipilih.');
    if (!form.warehouse_default.trim()) warnings.push('Warehouse default wajib diisi.');

    const targetId = normalizeCode(form.branch_id);
    const targetCode = normalizeCode(form.branch_code);

    const duplicateId = branchRecords.find((branch) => {
      if (isEditing && branch.branch_id === selectedBranch?.branch_id) return false;
      if (branch.isDeleted) return false;
      return normalizeCode(branch.branch_id) === targetId;
    });

    const duplicateCode = branchRecords.find((branch) => {
      if (isEditing && branch.branch_id === selectedBranch?.branch_id) return false;
      if (branch.isDeleted) return false;
      return normalizeCode(branch.branch_code) === targetCode;
    });

    if (duplicateId) warnings.push(`Branch ID sudah dipakai oleh ${duplicateId.branch_name}.`);
    if (duplicateCode) warnings.push(`Branch Code sudah dipakai oleh ${duplicateCode.branch_name}.`);

    return warnings;
  };

  const createPayload = (override = {}) => {
    const branchId = String(form.branch_id || selectedBranch?.branch_id || generateId('BR', todayStr)).trim();
    const now = new Date().toISOString();

    return {
      ...(selectedBranch?.raw || {}),

      id: selectedBranch?.id || branchId,
      date: selectedBranch?.date || todayStr,

      branch_id: branchId,
      branch_code: normalizeCode(form.branch_code || branchId),
      branch_name: normalizeText(form.branch_name),
      branch_type: normalizeCode(form.branch_type),
      branch_status: normalizeCode(form.branch_status),
      branch_scope: normalizeCode(form.branch_scope),

      alamat: form.alamat.trim(),
      kota: normalizeText(form.kota),
      provinsi: normalizeText(form.provinsi),
      nomor_telepon: form.nomor_telepon.trim(),
      email: form.email.trim().toLowerCase(),
      manager: form.manager.trim(),
      warehouse_default: normalizeCode(form.warehouse_default),
      timezone: form.timezone || 'Asia/Jakarta',
      notes: form.notes.trim(),

      status: normalizeCode(form.branch_status),
      status_active: normalizeCode(form.branch_status) === 'ACTIVE',
      is_active: normalizeCode(form.branch_status) === 'ACTIVE',
      isDeleted: false,

      created_at: selectedBranch?.raw?.created_at || now,
      created_by: selectedBranch?.raw?.created_by || user?.name || user?.email || 'SYSTEM',
      updated_at: now,
      updated_by: user?.name || user?.email || 'SYSTEM',

      ...override,
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const warnings = validateForm();

    if (warnings.length > 0) {
      notify(warnings.join('\n'), 'error');
      return;
    }

    if (typeof sendToSheet !== 'function') {
      notify('sendToSheet belum tersedia. Data belum bisa disimpan ke cloud.', 'error');
      return;
    }

    const payload = createPayload();
    const action = isEditing ? 'update' : 'insert';

    const isSuccess = await sendToSheet(action, payload, 'master_branches');

    if (isSuccess) {
      notify(isEditing ? 'Master cabang berhasil diperbarui.' : 'Cabang baru berhasil ditambahkan.', 'success');
      resetForm();
    }
  };

  const handleToggleStatus = async (branch) => {
    if (typeof sendToSheet !== 'function') {
      notify('sendToSheet belum tersedia. Status cabang belum bisa diubah.', 'error');
      return;
    }

    const nextStatus = branch.branch_status === 'ACTIVE' ? 'NON_ACTIVE' : 'ACTIVE';

    const confirmed = window.confirm(
      `${nextStatus === 'NON_ACTIVE' ? 'Nonaktifkan' : 'Aktifkan ulang'} cabang ${branch.branch_name}?`,
    );

    if (!confirmed) return;

    const payload = {
      ...(branch.raw || {}),
      id: branch.id || branch.branch_id,
      branch_id: branch.branch_id,
      branch_status: nextStatus,
      status: nextStatus,
      status_active: nextStatus === 'ACTIVE',
      is_active: nextStatus === 'ACTIVE',
      isDeleted: false,
      updated_at: new Date().toISOString(),
      updated_by: user?.name || user?.email || 'SYSTEM',
    };

    const isSuccess = await sendToSheet('update', payload, 'master_branches');

    if (isSuccess) {
      notify(nextStatus === 'ACTIVE' ? 'Cabang berhasil diaktifkan ulang.' : 'Cabang berhasil dinonaktifkan.', 'success');
    }
  };

  const handleSoftDelete = async (branch) => {
    if (typeof sendToSheet !== 'function') {
      notify('sendToSheet belum tersedia. Cabang belum bisa dihapus.', 'error');
      return;
    }

    const confirmed = window.confirm(
      `Soft delete cabang ${branch.branch_name}? Data tidak dihapus permanen, hanya disembunyikan dari transaksi aktif.`,
    );

    if (!confirmed) return;

    const payload = {
      ...(branch.raw || {}),
      id: branch.id || branch.branch_id,
      branch_id: branch.branch_id,
      branch_status: 'NON_ACTIVE',
      status: 'NON_ACTIVE',
      status_active: false,
      is_active: false,
      isDeleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: user?.name || user?.email || 'SYSTEM',
      updated_at: new Date().toISOString(),
      updated_by: user?.name || user?.email || 'SYSTEM',
    };

    const isSuccess = await sendToSheet('update', payload, 'master_branches');

    if (isSuccess) {
      notify('Cabang berhasil di-soft delete.', 'success');
      if (selectedBranch?.branch_id === branch.branch_id) resetForm();
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-red-600/30 blur-2xl" />
        <div className="absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-amber-400/20 blur-2xl" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="rounded-2xl bg-red-600 p-2 shadow-sm">
                <Building2 size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                Master Cabang ERP
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              Pusat Data Cabang Dimsum Aditya
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-300">
              Kelola Tangerang HO, Pemalang Production Branch, Cibinong Resto, Warehouse, dan Franchise dari satu master resmi.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">SSOT Branch</Badge>
            <Badge tone="amber">Soft Delete Ready</Badge>
            <Badge tone="green">Multi Branch</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Cabang" value={stats.total} icon={<Layers size={18} />} tone="white" />
        <StatCard title="Aktif" value={stats.active} icon={<CheckCircle size={18} />} tone="red" />
        <StatCard title="Non Aktif" value={stats.nonActive} icon={<AlertCircle size={18} />} tone="gold" />
        <StatCard title="Franchise" value={stats.franchise} icon={<Briefcase size={18} />} tone="white" />
        <StatCard title="Soft Deleted" value={stats.deleted} icon={<Trash2 size={18} />} tone="dark" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
                  {isEditing ? <Edit2 size={16} className="text-red-600" /> : <Plus size={16} className="text-red-600" />}
                  {isEditing ? 'Edit Cabang' : 'Tambah Cabang'}
                </h2>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  Data cabang resmi untuk seluruh modul ERP.
                </p>
              </div>

              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl bg-slate-100 p-2 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Branch ID" required>
                  <div className="flex gap-2">
                    <input
                      disabled={isEditing}
                      value={form.branch_id}
                      onChange={(event) => setForm({ ...form, branch_id: normalizeCode(event.target.value), id: normalizeCode(event.target.value) })}
                      className={inputClass}
                      placeholder="TANGERANG_HO"
                    />
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={handleGenerateId}
                        className="shrink-0 rounded-2xl border border-amber-200 bg-amber-50 px-3 text-[10px] font-black text-amber-700 transition-all hover:bg-amber-100"
                      >
                        ID
                      </button>
                    )}
                  </div>
                </Field>

                <Field label="Branch Code" required>
                  <input
                    value={form.branch_code}
                    onChange={(event) => setForm({ ...form, branch_code: normalizeCode(event.target.value) })}
                    className={inputClass}
                    placeholder="TGR-HO"
                  />
                </Field>
              </div>

              <Field label="Nama Cabang" required>
                <input
                  value={form.branch_name}
                  onChange={(event) => setForm({ ...form, branch_name: event.target.value })}
                  className={inputClass}
                  placeholder="Tangerang Head Office"
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Tipe Cabang" required>
                  <select
                    value={form.branch_type}
                    onChange={(event) => setForm({ ...form, branch_type: event.target.value })}
                    className={inputClass}
                  >
                    {BRANCH_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Status" required>
                  <select
                    value={form.branch_status}
                    onChange={(event) => setForm({ ...form, branch_status: event.target.value })}
                    className={inputClass}
                  >
                    {BRANCH_STATUS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Scope" required>
                  <select
                    value={form.branch_scope}
                    onChange={(event) => setForm({ ...form, branch_scope: event.target.value })}
                    className={inputClass}
                  >
                    {BRANCH_SCOPE.map((scope) => (
                      <option key={scope} value={scope}>{scope}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Warehouse Default" required>
                  <input
                    value={form.warehouse_default}
                    onChange={(event) => setForm({ ...form, warehouse_default: normalizeCode(event.target.value) })}
                    className={inputClass}
                    placeholder="GUDANG_UTAMA"
                  />
                </Field>
              </div>

              <Field label="Alamat">
                <textarea
                  value={form.alamat}
                  onChange={(event) => setForm({ ...form, alamat: event.target.value })}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Alamat lengkap cabang..."
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Kota">
                  <input
                    value={form.kota}
                    onChange={(event) => setForm({ ...form, kota: event.target.value })}
                    className={inputClass}
                    placeholder="Bogor"
                  />
                </Field>

                <Field label="Provinsi">
                  <input
                    value={form.provinsi}
                    onChange={(event) => setForm({ ...form, provinsi: event.target.value })}
                    className={inputClass}
                    placeholder="Jawa Barat"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Nomor Telepon">
                  <input
                    value={form.nomor_telepon}
                    onChange={(event) => setForm({ ...form, nomor_telepon: event.target.value })}
                    className={inputClass}
                    placeholder="08xxxxxxxxxx"
                  />
                </Field>

                <Field label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    className={inputClass}
                    placeholder="branch@dimsumaditya.id"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Manager">
                  <input
                    value={form.manager}
                    onChange={(event) => setForm({ ...form, manager: event.target.value })}
                    className={inputClass}
                    placeholder="Nama manager"
                  />
                </Field>

                <Field label="Timezone">
                  <select
                    value={form.timezone}
                    onChange={(event) => setForm({ ...form, timezone: event.target.value })}
                    className={inputClass}
                  >
                    {TIMEZONES.map((timezone) => (
                      <option key={timezone} value={timezone}>{timezone}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Catatan operasional cabang..."
                />
              </Field>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-sm transition-all hover:bg-red-700"
              >
                <Save size={16} />
                {isEditing ? 'Simpan Perubahan' : 'Tambah Cabang'}
              </button>
            </form>
          </div>
        </div>

        <div className="xl:col-span-8">
          <div className="rounded-[2rem] border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <ShieldCheck size={17} className="text-red-600" />
                    Daftar Cabang Resmi
                  </h2>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    Data ini menjadi referensi seluruh transaksi multi-branch.
                  </p>
                </div>

                <div className="flex flex-col gap-2 md:flex-row">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-xs font-bold outline-none transition-all placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50 md:w-64"
                      placeholder="Cari nama, code, telepon, email..."
                    />
                  </div>

                  <div className="flex gap-2">
                    <div className="relative">
                      <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className="rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-xs font-black text-slate-600 outline-none focus:border-red-500"
                      >
                        <option value="ALL">SEMUA AKTIF/NONAKTIF</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="NON_ACTIVE">NON_ACTIVE</option>
                        <option value="SOFT_DELETED">SOFT_DELETED</option>
                      </select>
                    </div>

                    <select
                      value={typeFilter}
                      onChange={(event) => setTypeFilter(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none focus:border-red-500"
                    >
                      <option value="ALL">SEMUA TIPE</option>
                      {BRANCH_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cabang</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Tipe</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Status</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Lokasi</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Kontak</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Warehouse</th>
                    <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredBranches.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-14 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-red-50 text-red-600">
                          <Building2 size={24} />
                        </div>
                        <div className="mt-3 text-sm font-black text-slate-800">Cabang tidak ditemukan</div>
                        <div className="mt-1 text-xs font-semibold text-slate-400">
                          Ubah filter atau tambahkan cabang baru.
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredBranches.map((branch) => {
                    const isDeleted = branch.isDeleted || branch.branch_status === 'SOFT_DELETED';
                    const isActive = branch.branch_status === 'ACTIVE' && !isDeleted;

                    return (
                      <tr key={`${branch.branch_id}-${branch.branch_code}`} className="border-b border-slate-100 transition-colors hover:bg-red-50/30">
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isActive ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              <Building2 size={18} />
                            </div>
                            <div>
                              <div className="font-black text-slate-900">{branch.branch_name || '-'}</div>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                <Badge tone="slate">{branch.branch_id || '-'}</Badge>
                                <Badge tone="amber">{branch.branch_code || '-'}</Badge>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <Badge tone={branch.branch_type === 'HEAD_OFFICE' ? 'red' : branch.branch_type === 'FRANCHISE' ? 'amber' : 'slate'}>
                            {branch.branch_type || '-'}
                          </Badge>
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                            <Globe size={12} />
                            {branch.branch_scope || 'BRANCH'}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <Badge tone={isDeleted ? 'dark' : isActive ? 'green' : 'amber'}>
                            {isDeleted ? 'SOFT_DELETED' : branch.branch_status}
                          </Badge>
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                            <Clock size={12} />
                            {branch.updated_at ? formatDate(branch.updated_at) : branch.date ? formatDate(branch.date) : '-'}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-2 text-xs font-bold text-slate-700">
                            <MapPin size={14} className="mt-0.5 shrink-0 text-red-500" />
                            <div>
                              <div>{branch.kota || '-'}{branch.provinsi ? `, ${branch.provinsi}` : ''}</div>
                              <div className="mt-1 max-w-[220px] truncate text-[11px] font-semibold text-slate-400">
                                {branch.alamat || '-'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="space-y-1.5 text-[11px] font-bold text-slate-600">
                            <div className="flex items-center gap-2">
                              <User size={13} className="text-slate-400" />
                              {branch.manager || '-'}
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone size={13} className="text-slate-400" />
                              {branch.nomor_telepon || '-'}
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail size={13} className="text-slate-400" />
                              {branch.email || '-'}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                            <Warehouse size={15} className="text-red-600" />
                            {branch.warehouse_default || '-'}
                          </div>
                          <div className="mt-2 text-[11px] font-semibold text-slate-400">
                            {branch.timezone || 'Asia/Jakarta'}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            {!isDeleted && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(branch)}
                                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                                  title="Edit cabang"
                                >
                                  <Edit2 size={15} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(branch)}
                                  className={`rounded-xl border p-2 transition-all ${
                                    isActive
                                      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  }`}
                                  title={isActive ? 'Nonaktifkan cabang' : 'Aktifkan cabang'}
                                >
                                  {isActive ? <Power size={15} /> : <RotateCcw size={15} />}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSoftDelete(branch)}
                                  className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100"
                                  title="Soft delete cabang"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}

                            {isDeleted && (
                              <Badge tone="dark">Locked</Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
              <div className="text-[11px] font-bold text-slate-400">
                Menampilkan <span className="text-slate-800">{filteredBranches.length}</span> dari <span className="text-slate-800">{branchRecords.length}</span> data cabang.
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge tone="red">Merah = Aktif / Prioritas</Badge>
                <Badge tone="amber">Emas = Status Khusus</Badge>
                <Badge tone="slate">Putih = Data Operasional</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
