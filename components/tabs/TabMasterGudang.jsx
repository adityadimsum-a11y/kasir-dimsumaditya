import React, { useMemo, useState } from 'react';
import {
  Warehouse,
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
  User,
  Building2,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Package,
  Snowflake,
  Truck,
  Undo2,
  ArchiveX,
  Layers,
} from 'lucide-react';

import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import erpOrchestrator from '../../services/erpOrchestrator';

const WAREHOUSE_TABLE_NAME = 'master_locations';

const WAREHOUSE_TYPES = [
  'RAW_MATERIAL',
  'PACKAGING',
  'FINISHED_GOODS',
  'FREEZER',
  'RESTO',
  'TRANSIT',
  'RETURN',
  'DAMAGED',
];

const WAREHOUSE_STATUS = [
  'ACTIVE',
  'NON_ACTIVE',
];

const DEFAULT_FORM = {
  id: '',
  warehouse_id: '',
  warehouse_code: '',
  warehouse_name: '',
  warehouse_type: 'RAW_MATERIAL',
  branch_id: '',
  status: 'ACTIVE',
  alamat: '',
  pic: '',
  nomor_telepon: '',
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

const normalizeStatus = (row) => {
  if (isSoftDeleted(row)) return 'SOFT_DELETED';

  const value = row?.status ?? row?.warehouse_status ?? row?.status_active ?? row?.is_active;

  if (value === false) return 'NON_ACTIVE';
  if (value === true) return 'ACTIVE';

  const normalized = normalizeCode(value || 'ACTIVE');

  if (['NON_ACTIVE', 'NONAKTIF', 'INACTIVE', 'DISABLED', 'FALSE', 'NO', 'N', '0'].includes(normalized)) {
    return 'NON_ACTIVE';
  }

  return 'ACTIVE';
};

const getRawWarehouseRows = ({
  masterWarehouses,
  master_warehouses,
  masterWarehouse,
  master_warehouse,
  masterLocations,
  master_locations,
  warehouses,
  locations,
  dbData,
}) => {
  if (Array.isArray(master_warehouses)) return master_warehouses;
  if (Array.isArray(masterWarehouses)) return masterWarehouses;
  if (Array.isArray(masterWarehouse)) return masterWarehouse;
  if (Array.isArray(master_warehouse)) return master_warehouse;
  if (Array.isArray(master_locations)) return master_locations;
  if (Array.isArray(masterLocations)) return masterLocations;
  if (Array.isArray(warehouses)) return warehouses;
  if (Array.isArray(locations)) return locations;

  if (Array.isArray(dbData?.master_warehouses)) return dbData.master_warehouses;
  if (Array.isArray(dbData?.masterWarehouses)) return dbData.masterWarehouses;
  if (Array.isArray(dbData?.master_warehouse)) return dbData.master_warehouse;
  if (Array.isArray(dbData?.master_locations)) return dbData.master_locations;
  if (Array.isArray(dbData?.masterLocations)) return dbData.masterLocations;
  if (Array.isArray(dbData?.warehouses)) return dbData.warehouses;
  if (Array.isArray(dbData?.locations)) return dbData.locations;

  return [];
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

  const branchName = String(
    raw.branch_name ||
    raw.branchName ||
    raw.nama_cabang ||
    raw.name ||
    record?.name ||
    branchId ||
    '',
  ).trim();

  const status = normalizeStatus({
    status: raw.branch_status || raw.status,
    is_active: raw.is_active,
    isDeleted: raw.isDeleted,
  });

  return {
    id: String(raw.id || branchId).trim(),
    branch_id: branchId,
    branch_code: String(raw.branch_code || raw.branchCode || raw.code || branchId || '').trim(),
    branch_name: branchName,
    branch_type: normalizeCode(raw.branch_type || raw.branchType || raw.type || ''),
    status,
    isDeleted: isSoftDeleted(raw),
    raw,
  };
};

const normalizeWarehouseDisplay = (record) => {
  const raw = record?.raw || record || {};

  const warehouseId = String(
    raw.warehouse_id ||
    raw.warehouseId ||
    raw.location_id ||
    raw.locationId ||
    record?.id ||
    raw.id ||
    '',
  ).trim();

  const warehouseCode = String(
    raw.warehouse_code ||
    raw.warehouseCode ||
    raw.location_code ||
    raw.locationCode ||
    raw.code ||
    record?.code ||
    warehouseId ||
    '',
  ).trim();

  const warehouseName = String(
    raw.warehouse_name ||
    raw.warehouseName ||
    raw.location_name ||
    raw.locationName ||
    raw.nama_gudang ||
    raw.name ||
    record?.name ||
    '',
  ).trim();

  const warehouseType = normalizeCode(
    raw.warehouse_type ||
    raw.warehouseType ||
    raw.location_type ||
    raw.locationType ||
    raw.type ||
    raw.category ||
    'RAW_MATERIAL',
  );

  const branchId = String(
    raw.branch_id ||
    raw.branchId ||
    raw.scope_branch_id ||
    record?.branch_id ||
    '',
  ).trim();

  const status = normalizeStatus(raw);

  return {
    id: String(raw.id || warehouseId).trim(),

    warehouse_id: warehouseId,
    warehouse_code: warehouseCode,
    warehouse_name: warehouseName,
    warehouse_type: warehouseType,

    location_id: String(raw.location_id || warehouseId).trim(),
    location_code: String(raw.location_code || warehouseCode).trim(),
    location_name: String(raw.location_name || warehouseName).trim(),

    branch_id: branchId,
    status,

    alamat: String(raw.alamat || raw.address || '').trim(),
    pic: String(raw.pic || raw.manager || raw.penanggung_jawab || '').trim(),
    nomor_telepon: String(raw.nomor_telepon || raw.phone || raw.no_hp || raw.telepon || '').trim(),
    notes: String(raw.notes || raw.keterangan || raw.description || '').trim(),

    date: raw.date || raw.created_at || raw.updated_at || '',
    created_at: raw.created_at || '',
    updated_at: raw.updated_at || '',

    isDeleted: isSoftDeleted(raw),

    search_text: normalizeText([
      warehouseId,
      warehouseCode,
      warehouseName,
      warehouseType,
      branchId,
      raw.alamat,
      raw.address,
      raw.pic,
      raw.manager,
      raw.nomor_telepon,
      raw.phone,
      raw.notes,
      raw.keterangan,
    ].filter(Boolean).join(' ')),

    raw,
  };
};

const getWarehouseTypeIcon = (type) => {
  const normalized = normalizeCode(type);

  if (normalized === 'RAW_MATERIAL') return <Package size={18} />;
  if (normalized === 'PACKAGING') return <Layers size={18} />;
  if (normalized === 'FINISHED_GOODS') return <Warehouse size={18} />;
  if (normalized === 'FREEZER') return <Snowflake size={18} />;
  if (normalized === 'RESTO') return <Building2 size={18} />;
  if (normalized === 'TRANSIT') return <Truck size={18} />;
  if (normalized === 'RETURN') return <Undo2 size={18} />;
  if (normalized === 'DAMAGED') return <ArchiveX size={18} />;

  return <Warehouse size={18} />;
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

const StatCard = ({ title, value, icon, tone = 'white' }) => {
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

export default function TabMasterGudang({
  masterWarehouses = [],
  master_warehouses,
  masterWarehouse,
  master_warehouse,
  masterLocations,
  master_locations,
  warehouses,
  locations,

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
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  const rawWarehouses = useMemo(() => {
    return getRawWarehouseRows({
      masterWarehouses,
      master_warehouses,
      masterWarehouse,
      master_warehouse,
      masterLocations,
      master_locations,
      warehouses,
      locations,
      dbData,
    });
  }, [
    masterWarehouses,
    master_warehouses,
    masterWarehouse,
    master_warehouse,
    masterLocations,
    master_locations,
    warehouses,
    locations,
    dbData,
  ]);

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
    master_warehouses: rawWarehouses,
    masterWarehouses: rawWarehouses,
    master_locations: rawWarehouses,
    masterLocations: rawWarehouses,
    warehouses: rawWarehouses,
    locations: rawWarehouses,
    master_branches: rawBranches,
    masterBranches: rawBranches,
    master_branch: rawBranches,
  }), [dbData, rawWarehouses, rawBranches]);

  const branchRecords = useMemo(() => {
    const result = erpOrchestrator.masterData.getBranches(masterSource, {
      includeInactive: true,
      includeDeleted: true,
      validate: false,
    });

    return (result.records || [])
      .map(normalizeBranchDisplay)
      .filter((branch) => !branch.isDeleted)
      .sort((a, b) => String(a.branch_name).localeCompare(String(b.branch_name)));
  }, [masterSource]);

  const activeBranchRecords = useMemo(() => {
    return branchRecords.filter((branch) => branch.status === 'ACTIVE');
  }, [branchRecords]);

  const branchNameById = useMemo(() => {
    const map = new Map();

    branchRecords.forEach((branch) => {
      map.set(branch.branch_id, branch.branch_name || branch.branch_id);
      map.set(branch.branch_code, branch.branch_name || branch.branch_id);
    });

    return map;
  }, [branchRecords]);

  const warehouseRecords = useMemo(() => {
    const result = erpOrchestrator.masterData.getWarehouses(masterSource, {
      includeInactive: true,
      includeDeleted: true,
      validate: false,
    });

    return (result.records || [])
      .map(normalizeWarehouseDisplay)
      .sort((a, b) => {
        if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
        if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
        return String(a.warehouse_name).localeCompare(String(b.warehouse_name));
      });
  }, [masterSource]);

  const searchResultIds = useMemo(() => {
    const keyword = searchQuery.trim();

    if (!keyword) return new Set();

    const result = erpOrchestrator.masterData.searchMaster(masterSource, {
      masterType: 'WAREHOUSE',
      keyword,
      includeInactive: true,
      includeDeleted: true,
    }, {
      validate: false,
    });

    return new Set((result.records || []).flatMap((record) => {
      const warehouse = normalizeWarehouseDisplay(record);
      return [
        warehouse.id,
        warehouse.warehouse_id,
        warehouse.warehouse_code,
        warehouse.location_id,
        warehouse.location_code,
      ].filter(Boolean);
    }));
  }, [masterSource, searchQuery]);

  const filteredWarehouses = useMemo(() => {
    const keyword = normalizeText(searchQuery);

    return warehouseRecords.filter((warehouse) => {
      const statusOk = statusFilter === 'ALL'
        ? !warehouse.isDeleted
        : statusFilter === 'SOFT_DELETED'
          ? warehouse.isDeleted || warehouse.status === 'SOFT_DELETED'
          : warehouse.status === statusFilter && !warehouse.isDeleted;

      const typeOk = typeFilter === 'ALL' || warehouse.warehouse_type === typeFilter;
      const branchOk = branchFilter === 'ALL' || warehouse.branch_id === branchFilter;

      const searchOk = !keyword ||
        warehouse.search_text.includes(keyword) ||
        searchResultIds.has(warehouse.id) ||
        searchResultIds.has(warehouse.warehouse_id) ||
        searchResultIds.has(warehouse.warehouse_code);

      return statusOk && typeOk && branchOk && searchOk;
    });
  }, [warehouseRecords, searchQuery, searchResultIds, statusFilter, typeFilter, branchFilter]);

  const stats = useMemo(() => {
    const visible = warehouseRecords.filter((warehouse) => !warehouse.isDeleted);

    return {
      total: visible.length,
      active: visible.filter((warehouse) => warehouse.status === 'ACTIVE').length,
      nonActive: visible.filter((warehouse) => warehouse.status === 'NON_ACTIVE').length,
      freezer: visible.filter((warehouse) => warehouse.warehouse_type === 'FREEZER').length,
      deleted: warehouseRecords.filter((warehouse) => warehouse.isDeleted || warehouse.status === 'SOFT_DELETED').length,
    };
  }, [warehouseRecords]);

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
    setSelectedWarehouse(null);
  };

  const handleGenerateId = () => {
    const newId = generateId('WH', todayStr);

    setForm((prev) => ({
      ...prev,
      id: prev.id || newId,
      warehouse_id: prev.warehouse_id || newId,
    }));
  };

  const handleEdit = (warehouse) => {
    setSelectedWarehouse(warehouse);
    setIsEditing(true);

    setForm({
      id: warehouse.id || warehouse.warehouse_id,
      warehouse_id: warehouse.warehouse_id,
      warehouse_code: warehouse.warehouse_code,
      warehouse_name: warehouse.warehouse_name,
      warehouse_type: warehouse.warehouse_type || 'RAW_MATERIAL',
      branch_id: warehouse.branch_id,
      status: warehouse.status === 'SOFT_DELETED' ? 'NON_ACTIVE' : warehouse.status || 'ACTIVE',
      alamat: warehouse.alamat,
      pic: warehouse.pic,
      nomor_telepon: warehouse.nomor_telepon,
      notes: warehouse.notes,
    });
  };

  const validateForm = () => {
    const warnings = [];

    if (!form.warehouse_id.trim()) warnings.push('Warehouse ID wajib diisi.');
    if (!form.warehouse_code.trim()) warnings.push('Warehouse Code wajib diisi.');
    if (!form.warehouse_name.trim()) warnings.push('Nama gudang wajib diisi.');
    if (!form.warehouse_type.trim()) warnings.push('Tipe gudang wajib dipilih.');
    if (!form.branch_id.trim()) warnings.push('Branch ID wajib dipilih. Gudang tidak boleh orphan.');
    if (!form.status.trim()) warnings.push('Status gudang wajib dipilih.');

    const branchExists = branchRecords.some((branch) => {
      return branch.branch_id === form.branch_id && !branch.isDeleted;
    });

    if (form.branch_id && !branchExists) {
      warnings.push('Branch ID tidak ditemukan di Master Cabang. Gudang wajib terhubung ke cabang resmi.');
    }

    const targetId = normalizeCode(form.warehouse_id);
    const targetCode = normalizeCode(form.warehouse_code);

    const duplicateId = warehouseRecords.find((warehouse) => {
      if (isEditing && warehouse.warehouse_id === selectedWarehouse?.warehouse_id) return false;
      if (warehouse.isDeleted) return false;
      return normalizeCode(warehouse.warehouse_id) === targetId;
    });

    const duplicateCode = warehouseRecords.find((warehouse) => {
      if (isEditing && warehouse.warehouse_id === selectedWarehouse?.warehouse_id) return false;
      if (warehouse.isDeleted) return false;
      return normalizeCode(warehouse.warehouse_code) === targetCode;
    });

    if (duplicateId) warnings.push(`Warehouse ID sudah dipakai oleh ${duplicateId.warehouse_name}.`);
    if (duplicateCode) warnings.push(`Warehouse Code sudah dipakai oleh ${duplicateCode.warehouse_name}.`);

    return warnings;
  };

  const createPayload = (override = {}) => {
    const warehouseId = String(form.warehouse_id || selectedWarehouse?.warehouse_id || generateId('WH', todayStr)).trim();
    const now = new Date().toISOString();
    const status = normalizeCode(form.status);

    return {
      ...(selectedWarehouse?.raw || {}),

      id: selectedWarehouse?.id || warehouseId,
      date: selectedWarehouse?.date || todayStr,

      warehouse_id: warehouseId,
      warehouse_code: normalizeCode(form.warehouse_code || warehouseId),
      warehouse_name: normalizeText(form.warehouse_name),
      warehouse_type: normalizeCode(form.warehouse_type),

      location_id: warehouseId,
      location_code: normalizeCode(form.warehouse_code || warehouseId),
      location_name: normalizeText(form.warehouse_name),
      location_type: normalizeCode(form.warehouse_type),

      branch_id: normalizeCode(form.branch_id),

      status,
      warehouse_status: status,
      status_active: status === 'ACTIVE',
      is_active: status === 'ACTIVE',
      isDeleted: false,

      alamat: form.alamat.trim(),
      address: form.alamat.trim(),

      pic: form.pic.trim(),
      manager: form.pic.trim(),

      nomor_telepon: form.nomor_telepon.trim(),
      phone: form.nomor_telepon.trim(),

      notes: form.notes.trim(),
      keterangan: form.notes.trim(),

      created_at: selectedWarehouse?.raw?.created_at || now,
      created_by: selectedWarehouse?.raw?.created_by || user?.name || user?.email || 'SYSTEM',
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
      notify('sendToSheet belum tersedia. Data gudang belum bisa disimpan ke cloud.', 'error');
      return;
    }

    const payload = createPayload();
    const action = isEditing ? 'update' : 'insert';

    const isSuccess = await sendToSheet(action, payload, WAREHOUSE_TABLE_NAME);

    if (isSuccess) {
      notify(isEditing ? 'Master gudang berhasil diperbarui.' : 'Gudang baru berhasil ditambahkan.', 'success');
      resetForm();
    }
  };

  const handleToggleStatus = async (warehouse) => {
    if (typeof sendToSheet !== 'function') {
      notify('sendToSheet belum tersedia. Status gudang belum bisa diubah.', 'error');
      return;
    }

    const nextStatus = warehouse.status === 'ACTIVE' ? 'NON_ACTIVE' : 'ACTIVE';

    const confirmed = window.confirm(
      `${nextStatus === 'NON_ACTIVE' ? 'Nonaktifkan' : 'Aktifkan ulang'} gudang ${warehouse.warehouse_name}?`,
    );

    if (!confirmed) return;

    const payload = {
      ...(warehouse.raw || {}),
      id: warehouse.id || warehouse.warehouse_id,

      warehouse_id: warehouse.warehouse_id,
      warehouse_status: nextStatus,
      status: nextStatus,
      status_active: nextStatus === 'ACTIVE',
      is_active: nextStatus === 'ACTIVE',
      isDeleted: false,

      location_id: warehouse.location_id || warehouse.warehouse_id,

      updated_at: new Date().toISOString(),
      updated_by: user?.name || user?.email || 'SYSTEM',
    };

    const isSuccess = await sendToSheet('update', payload, WAREHOUSE_TABLE_NAME);

    if (isSuccess) {
      notify(nextStatus === 'ACTIVE' ? 'Gudang berhasil diaktifkan ulang.' : 'Gudang berhasil dinonaktifkan.', 'success');
    }
  };

  const handleSoftDelete = async (warehouse) => {
    if (typeof sendToSheet !== 'function') {
      notify('sendToSheet belum tersedia. Gudang belum bisa dihapus.', 'error');
      return;
    }

    const confirmed = window.confirm(
      `Soft delete gudang ${warehouse.warehouse_name}? Data tidak dihapus permanen, hanya disembunyikan dari transaksi aktif.`,
    );

    if (!confirmed) return;

    const payload = {
      ...(warehouse.raw || {}),
      id: warehouse.id || warehouse.warehouse_id,

      warehouse_id: warehouse.warehouse_id,
      location_id: warehouse.location_id || warehouse.warehouse_id,

      warehouse_status: 'NON_ACTIVE',
      status: 'NON_ACTIVE',
      status_active: false,
      is_active: false,
      isDeleted: true,

      deleted_at: new Date().toISOString(),
      deleted_by: user?.name || user?.email || 'SYSTEM',
      updated_at: new Date().toISOString(),
      updated_by: user?.name || user?.email || 'SYSTEM',
    };

    const isSuccess = await sendToSheet('update', payload, WAREHOUSE_TABLE_NAME);

    if (isSuccess) {
      notify('Gudang berhasil di-soft delete.', 'success');
      if (selectedWarehouse?.warehouse_id === warehouse.warehouse_id) resetForm();
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
                <Warehouse size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                Master Gudang ERP
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              Pusat Data Gudang Dimsum Aditya
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-300">
              Semua stok wajib berada di gudang resmi yang terhubung ke cabang. Tidak ada stok tanpa warehouse.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">Warehouse SSOT</Badge>
            <Badge tone="amber">No Orphan Stock</Badge>
            <Badge tone="green">Inventory Ready</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Gudang" value={stats.total} icon={<Warehouse size={18} />} tone="white" />
        <StatCard title="Aktif" value={stats.active} icon={<CheckCircle size={18} />} tone="red" />
        <StatCard title="Non Aktif" value={stats.nonActive} icon={<AlertCircle size={18} />} tone="gold" />
        <StatCard title="Freezer" value={stats.freezer} icon={<Snowflake size={18} />} tone="white" />
        <StatCard title="Soft Deleted" value={stats.deleted} icon={<Trash2 size={18} />} tone="dark" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
                  {isEditing ? <Edit2 size={16} className="text-red-600" /> : <Plus size={16} className="text-red-600" />}
                  {isEditing ? 'Edit Gudang' : 'Tambah Gudang'}
                </h2>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  Setiap gudang wajib memiliki branch_id resmi.
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
                <Field label="Warehouse ID" required>
                  <div className="flex gap-2">
                    <input
                      disabled={isEditing}
                      value={form.warehouse_id}
                      onChange={(event) => setForm({ ...form, warehouse_id: normalizeCode(event.target.value), id: normalizeCode(event.target.value) })}
                      className={inputClass}
                      placeholder="WH_PML_FREEZER"
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

                <Field label="Warehouse Code" required>
                  <input
                    value={form.warehouse_code}
                    onChange={(event) => setForm({ ...form, warehouse_code: normalizeCode(event.target.value) })}
                    className={inputClass}
                    placeholder="PML-FRZ"
                  />
                </Field>
              </div>

              <Field label="Nama Gudang" required>
                <input
                  value={form.warehouse_name}
                  onChange={(event) => setForm({ ...form, warehouse_name: event.target.value })}
                  className={inputClass}
                  placeholder="Gudang Freezer Pemalang"
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Tipe Gudang" required>
                  <select
                    value={form.warehouse_type}
                    onChange={(event) => setForm({ ...form, warehouse_type: event.target.value })}
                    className={inputClass}
                  >
                    {WAREHOUSE_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Status" required>
                  <select
                    value={form.status}
                    onChange={(event) => setForm({ ...form, status: event.target.value })}
                    className={inputClass}
                  >
                    {WAREHOUSE_STATUS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Cabang Terhubung" required>
                <select
                  value={form.branch_id}
                  onChange={(event) => setForm({ ...form, branch_id: event.target.value })}
                  className={inputClass}
                >
                  <option value="">Pilih cabang resmi</option>
                  {activeBranchRecords.map((branch) => (
                    <option key={branch.branch_id} value={branch.branch_id}>
                      {branch.branch_name} — {branch.branch_id}
                    </option>
                  ))}
                </select>
                {activeBranchRecords.length === 0 && (
                  <div className="mt-2 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700">
                    Master Cabang belum tersedia. Tambahkan cabang dulu agar gudang tidak orphan.
                  </div>
                )}
              </Field>

              <Field label="Alamat">
                <textarea
                  value={form.alamat}
                  onChange={(event) => setForm({ ...form, alamat: event.target.value })}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Alamat gudang..."
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="PIC">
                  <input
                    value={form.pic}
                    onChange={(event) => setForm({ ...form, pic: event.target.value })}
                    className={inputClass}
                    placeholder="Nama PIC"
                  />
                </Field>

                <Field label="Nomor Telepon">
                  <input
                    value={form.nomor_telepon}
                    onChange={(event) => setForm({ ...form, nomor_telepon: event.target.value })}
                    className={inputClass}
                    placeholder="08xxxxxxxxxx"
                  />
                </Field>
              </div>

              <Field label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Catatan operasional gudang..."
                />
              </Field>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-sm transition-all hover:bg-red-700"
              >
                <Save size={16} />
                {isEditing ? 'Simpan Perubahan' : 'Tambah Gudang'}
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
                    Daftar Gudang Resmi
                  </h2>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    Gudang resmi untuk Purchase, Produksi, Sales, Inventory, dan Reversal.
                  </p>
                </div>

                <div className="flex flex-col gap-2 2xl:flex-row">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-xs font-bold outline-none transition-all placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50 md:w-64"
                      placeholder="Cari gudang, code, PIC, telepon..."
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
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
                      {WAREHOUSE_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>

                    <select
                      value={branchFilter}
                      onChange={(event) => setBranchFilter(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none focus:border-red-500"
                    >
                      <option value="ALL">SEMUA CABANG</option>
                      {branchRecords.map((branch) => (
                        <option key={branch.branch_id} value={branch.branch_id}>
                          {branch.branch_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Gudang</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Tipe</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cabang</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Status</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Lokasi</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">PIC</th>
                    <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredWarehouses.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-14 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-red-50 text-red-600">
                          <Warehouse size={24} />
                        </div>
                        <div className="mt-3 text-sm font-black text-slate-800">Gudang tidak ditemukan</div>
                        <div className="mt-1 text-xs font-semibold text-slate-400">
                          Ubah filter atau tambahkan gudang baru.
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredWarehouses.map((warehouse) => {
                    const isDeleted = warehouse.isDeleted || warehouse.status === 'SOFT_DELETED';
                    const isActive = warehouse.status === 'ACTIVE' && !isDeleted;
                    const branchName = branchNameById.get(warehouse.branch_id) || 'Branch tidak ditemukan';
                    const isOrphan = !branchNameById.has(warehouse.branch_id);

                    return (
                      <tr key={`${warehouse.warehouse_id}-${warehouse.warehouse_code}`} className="border-b border-slate-100 transition-colors hover:bg-red-50/30">
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isActive ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              {getWarehouseTypeIcon(warehouse.warehouse_type)}
                            </div>
                            <div>
                              <div className="font-black text-slate-900">{warehouse.warehouse_name || '-'}</div>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                <Badge tone="slate">{warehouse.warehouse_id || '-'}</Badge>
                                <Badge tone="amber">{warehouse.warehouse_code || '-'}</Badge>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <Badge tone={warehouse.warehouse_type === 'DAMAGED' || warehouse.warehouse_type === 'RETURN' ? 'amber' : warehouse.warehouse_type === 'FREEZER' ? 'red' : 'slate'}>
                            {warehouse.warehouse_type || '-'}
                          </Badge>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-2">
                            <Building2 size={15} className={isOrphan ? 'mt-0.5 shrink-0 text-red-500' : 'mt-0.5 shrink-0 text-slate-400'} />
                            <div>
                              <div className={`text-xs font-black ${isOrphan ? 'text-red-600' : 'text-slate-800'}`}>
                                {branchName}
                              </div>
                              <div className="mt-1 text-[11px] font-semibold text-slate-400">
                                {warehouse.branch_id || '-'}
                              </div>
                              {isOrphan && (
                                <div className="mt-2">
                                  <Badge tone="red">ORPHAN</Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <Badge tone={isDeleted ? 'dark' : isActive ? 'green' : 'amber'}>
                            {isDeleted ? 'SOFT_DELETED' : warehouse.status}
                          </Badge>
                          <div className="mt-2 text-[11px] font-semibold text-slate-400">
                            {warehouse.updated_at ? formatDate(warehouse.updated_at) : warehouse.date ? formatDate(warehouse.date) : '-'}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-2 text-xs font-bold text-slate-700">
                            <MapPin size={14} className="mt-0.5 shrink-0 text-red-500" />
                            <div className="max-w-[260px] truncate">
                              {warehouse.alamat || '-'}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="space-y-1.5 text-[11px] font-bold text-slate-600">
                            <div className="flex items-center gap-2">
                              <User size={13} className="text-slate-400" />
                              {warehouse.pic || '-'}
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone size={13} className="text-slate-400" />
                              {warehouse.nomor_telepon || '-'}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            {!isDeleted && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(warehouse)}
                                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                                  title="Edit gudang"
                                >
                                  <Edit2 size={15} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(warehouse)}
                                  className={`rounded-xl border p-2 transition-all ${
                                    isActive
                                      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  }`}
                                  title={isActive ? 'Nonaktifkan gudang' : 'Aktifkan gudang'}
                                >
                                  {isActive ? <Power size={15} /> : <RotateCcw size={15} />}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSoftDelete(warehouse)}
                                  className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100"
                                  title="Soft delete gudang"
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
                Menampilkan <span className="text-slate-800">{filteredWarehouses.length}</span> dari <span className="text-slate-800">{warehouseRecords.length}</span> data gudang.
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge tone="red">Merah = Aktif / Freezer</Badge>
                <Badge tone="amber">Gold = Return / Damaged</Badge>
                <Badge tone="slate">Putih = Operasional</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
