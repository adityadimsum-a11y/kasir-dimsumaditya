import React, { useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Save,
  X,
  Edit2,
  Trash2,
  Power,
  RotateCcw,
  Search,
  Filter,
  Building2,
  Phone,
  Mail,
  MapPin,
  User,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Crown,
  WalletCards,
  TrendingUp,
  ReceiptText,
  CalendarClock,
  BadgeDollarSign,
  Star,
  Zap,
} from 'lucide-react';

import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import erpOrchestrator from '../../services/erpOrchestrator';

const CUSTOMER_TABLE_NAME = 'master_customers';

const CUSTOMER_TYPES = [
  'RETAIL',
  'RESELLER',
  'AGENT',
  'DISTRIBUTOR',
  'RESTO',
  'CAFE',
  'FRANCHISE',
  'MARKETPLACE',
  'INTERNAL',
];

const CUSTOMER_GROUPS = [
  'OFFLINE',
  'ONLINE',
  'MERCHANT',
  'WHOLESALE',
];

const CUSTOMER_STATUS = [
  'ACTIVE',
  'NON_ACTIVE',
];

const DEFAULT_FORM = {
  id: '',
  customer_id: '',
  customer_code: '',
  customer_name: '',
  customer_type: 'RETAIL',
  branch_id: '',
  customer_group: 'OFFLINE',
  nomor_telepon: '',
  email: '',
  alamat: '',
  kota: '',
  provinsi: '',
  tanggal_gabung: '',
  status: 'ACTIVE',
  limit_piutang: '',
  jatuh_tempo_hari: '',
  sales_pic: '',
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

const formatMoney = (value) => {
  return `Rp${roundMoney(value).toLocaleString('id-ID')}`;
};

const normalizeDate = (value) => {
  if (!value) return '';

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return raw.substring(0, 10);

  return parsed.toISOString().substring(0, 10);
};

const isSoftDeleted = (row) => {
  const value = row?.isDeleted ?? row?.is_deleted ?? row?.deleted;
  return value === true || String(value || '').toUpperCase() === 'TRUE';
};

const normalizeStatus = (row) => {
  if (isSoftDeleted(row)) return 'SOFT_DELETED';

  const value = row?.status ?? row?.customer_status ?? row?.status_active ?? row?.is_active;

  if (value === false) return 'NON_ACTIVE';
  if (value === true) return 'ACTIVE';

  const normalized = normalizeCode(value || 'ACTIVE');

  if (['NON_ACTIVE', 'NONAKTIF', 'INACTIVE', 'DISABLED', 'FALSE', 'NO', 'N', '0'].includes(normalized)) {
    return 'NON_ACTIVE';
  }

  return 'ACTIVE';
};

const getRawCustomerRows = ({
  masterCustomers,
  master_customers,
  masterCustomer,
  master_customer,
  customers,
  pelanggan,
  dbData,
}) => {
  if (Array.isArray(master_customers)) return master_customers;
  if (Array.isArray(masterCustomers)) return masterCustomers;
  if (Array.isArray(masterCustomer)) return masterCustomer;
  if (Array.isArray(master_customer)) return master_customer;
  if (Array.isArray(customers)) return customers;
  if (Array.isArray(pelanggan)) return pelanggan;

  if (Array.isArray(dbData?.master_customers)) return dbData.master_customers;
  if (Array.isArray(dbData?.masterCustomers)) return dbData.masterCustomers;
  if (Array.isArray(dbData?.master_customer)) return dbData.master_customer;
  if (Array.isArray(dbData?.customers)) return dbData.customers;
  if (Array.isArray(dbData?.pelanggan)) return dbData.pelanggan;

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

const getRawSalesRows = ({ orders, salesPackages, sales_packages, dbData }) => {
  const rows = [];

  if (Array.isArray(orders)) rows.push(...orders);
  if (Array.isArray(salesPackages)) rows.push(...salesPackages);
  if (Array.isArray(sales_packages)) rows.push(...sales_packages);

  if (Array.isArray(dbData?.orders)) rows.push(...dbData.orders);
  if (Array.isArray(dbData?.salesPackages)) rows.push(...dbData.salesPackages);
  if (Array.isArray(dbData?.sales_packages)) rows.push(...dbData.sales_packages);

  return rows;
};

const parseJson = (value, fallback = null) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(String(value));
  } catch (error) {
    return fallback;
  }
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

const normalizeCustomerDisplay = (record) => {
  const raw = record?.raw || record || {};

  const customerId = String(
    raw.customer_id ||
    raw.customerId ||
    record?.id ||
    raw.id ||
    '',
  ).trim();

  const customerCode = String(
    raw.customer_code ||
    raw.customerCode ||
    raw.kode_customer ||
    raw.code ||
    record?.code ||
    customerId ||
    '',
  ).trim();

  const customerName = String(
    raw.customer_name ||
    raw.customerName ||
    raw.nama_customer ||
    raw.nama_pelanggan ||
    raw.name ||
    record?.name ||
    '',
  ).trim();

  const branchId = String(
    raw.branch_id ||
    raw.branchId ||
    raw.scope_branch_id ||
    record?.branch_id ||
    '',
  ).trim();

  const customerType = normalizeCode(
    raw.customer_type ||
    raw.customerType ||
    raw.type ||
    'RETAIL',
  );

  const customerGroup = normalizeCode(
    raw.customer_group ||
    raw.customerGroup ||
    raw.group ||
    raw.channel_group ||
    'OFFLINE',
  );

  const status = normalizeStatus(raw);

  return {
    id: String(raw.id || customerId).trim(),

    customer_id: customerId,
    customer_code: customerCode,
    customer_name: customerName,
    customer_type: customerType,
    customer_group: customerGroup,

    branch_id: branchId,

    nomor_telepon: String(raw.nomor_telepon || raw.phone || raw.no_hp || raw.telepon || raw.whatsapp || '').trim(),
    email: String(raw.email || '').trim(),
    alamat: String(raw.alamat || raw.address || '').trim(),
    kota: String(raw.kota || raw.city || '').trim(),
    provinsi: String(raw.provinsi || raw.province || '').trim(),

    tanggal_gabung: normalizeDate(raw.tanggal_gabung || raw.join_date || raw.created_date || raw.date || ''),
    status,

    limit_piutang: roundMoney(raw.limit_piutang || raw.credit_limit || 0),
    jatuh_tempo_hari: toNumber(raw.jatuh_tempo_hari || raw.due_days || raw.term_days || 0),

    sales_pic: String(raw.sales_pic || raw.salesPic || raw.pic || raw.sales || '').trim(),
    notes: String(raw.notes || raw.keterangan || raw.description || '').trim(),

    created_at: raw.created_at || '',
    updated_at: raw.updated_at || '',
    date: raw.date || raw.created_at || raw.updated_at || '',

    isDeleted: isSoftDeleted(raw),

    search_text: normalizeText([
      customerId,
      customerCode,
      customerName,
      customerType,
      customerGroup,
      branchId,
      raw.nomor_telepon,
      raw.phone,
      raw.whatsapp,
      raw.email,
      raw.alamat,
      raw.address,
      raw.kota,
      raw.provinsi,
      raw.sales_pic,
      raw.pic,
    ].filter(Boolean).join(' ')),

    raw,
  };
};

const normalizeSalesRecord = (row) => {
  const packageInput = row?.sales_transaction_package || row?.salesTransactionPackage || row || {};
  const header = packageInput.order_header || row?.order_header || row || {};
  const snapshot = packageInput.sales_snapshot || parseJson(header.sales_snapshot_json, null) || null;
  const snapshotPayload = snapshot?.payload?.order_snapshot || snapshot?.payload || null;

  const snapshotHeader = snapshotPayload?.order_header || snapshotPayload?.transaction_header || {};
  const finalHeader = {
    ...snapshotHeader,
    ...header,
  };

  const customerId = String(finalHeader.customer_id || finalHeader.customerId || row?.customer_id || '').trim();
  const customerName = String(finalHeader.customer_name || finalHeader.customerName || row?.customer_name || '').trim();

  const totalRevenue = roundMoney(
    finalHeader.total_revenue ||
    finalHeader.total_amount ||
    finalHeader.grand_total ||
    finalHeader.amount ||
    finalHeader.subtotal ||
    0,
  );

  const amountPaid = roundMoney(
    finalHeader.amount_paid ||
    finalHeader.paid_amount ||
    finalHeader.total_paid ||
    0,
  );

  const remainingAmount = roundMoney(
    finalHeader.remaining_amount ||
    finalHeader.piutang ||
    Math.max(totalRevenue - amountPaid, 0),
  );

  const totalHpp = roundMoney(
    finalHeader.total_hpp ||
    finalHeader.hpp_total ||
    finalHeader.cogs ||
    0,
  );

  const grossProfit = roundMoney(
    finalHeader.gross_profit !== undefined
      ? finalHeader.gross_profit
      : totalRevenue - totalHpp,
  );

  const orderDate = normalizeDate(
    finalHeader.order_date ||
    finalHeader.date ||
    finalHeader.created_at ||
    row?.date ||
    '',
  );

  return {
    order_id: String(finalHeader.order_id || finalHeader.id || row?.id || '').trim(),
    invoice_number: String(finalHeader.invoice_number || finalHeader.no_invoice || '').trim(),
    customer_id: customerId,
    customer_name: customerName,
    branch_id: String(finalHeader.branch_id || finalHeader.branchId || '').trim(),
    order_date: orderDate,
    sales_channel: normalizeCode(finalHeader.sales_channel || finalHeader.salesChannel || ''),
    total_revenue: totalRevenue,
    total_hpp: totalHpp,
    gross_profit: grossProfit,
    remaining_amount: remainingAmount,
    raw: row,
  };
};

const customerKeyCandidates = (customer) => {
  return [
    normalizeCode(customer.customer_id),
    normalizeText(customer.customer_name),
    normalizeCode(customer.customer_code),
    normalizeCode(customer.nomor_telepon),
  ].filter(Boolean);
};

const salesMatchesCustomer = (sale, customer) => {
  const customerKeys = new Set(customerKeyCandidates(customer));

  if (sale.customer_id && customerKeys.has(normalizeCode(sale.customer_id))) return true;
  if (sale.customer_name && customerKeys.has(normalizeText(sale.customer_name))) return true;

  return false;
};

const createCustomerMetrics = (customer, salesRecords) => {
  const customerSales = salesRecords.filter((sale) => salesMatchesCustomer(sale, customer));

  const totalTransaksi = customerSales.length;
  const totalOmzet = roundMoney(customerSales.reduce((sum, sale) => sum + toNumber(sale.total_revenue), 0));
  const totalPiutang = roundMoney(customerSales.reduce((sum, sale) => sum + toNumber(sale.remaining_amount), 0));
  const totalProfit = roundMoney(customerSales.reduce((sum, sale) => sum + toNumber(sale.gross_profit), 0));

  const lastOrderDate = customerSales
    .map((sale) => sale.order_date)
    .filter(Boolean)
    .sort()
    .pop() || '';

  const avgOrderValue = totalTransaksi > 0 ? totalOmzet / totalTransaksi : 0;
  const clv = totalProfit;
  const valuableScore = totalProfit - totalPiutang;

  return {
    total_transaksi: totalTransaksi,
    total_omzet: totalOmzet,
    total_piutang: totalPiutang,
    total_profit: totalProfit,
    last_order_date: lastOrderDate,
    average_order_value: roundMoney(avgOrderValue),
    customer_lifetime_value: roundMoney(clv),
    valuable_score: roundMoney(valuableScore),
  };
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
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border ${toneMap[tone] || toneMap.slate}`}>
      {children}
    </span>
  );
};

const StatCard = ({ title, value, icon, tone = 'white', subtitle = '' }) => {
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
          <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
          {subtitle && (
            <div className="mt-1 text-[11px] font-bold opacity-70">{subtitle}</div>
          )}
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

export default function TabMasterPelanggan({
  masterCustomers = [],
  master_customers,
  masterCustomer,
  master_customer,
  customers,
  pelanggan,

  masterBranches = [],
  master_branches,
  master_branch,
  branches,

  orders = [],
  salesPackages,
  sales_packages,

  dbData = {},
  sendToSheet,
  showToast,
  user,
}) {
  const todayStr = getTodayStr();

  const isOwnerMode = useMemo(() => {
    const role = normalizeCode(user?.role || user?.user_role || '');
    const branchType = normalizeCode(user?.branch_type || user?.branchType || '');
    const branchId = normalizeCode(user?.branch_id || user?.branchId || '');

    return [
      'OWNER',
      'SUPER_ADMIN',
      'ADMIN_PUSAT',
      'HEAD_OFFICE',
      'HQ',
      'DEWA',
      'AKUN_DEWA',
    ].includes(role) ||
      ['HEAD_OFFICE', 'HQ_FACTORY', 'HQ'].includes(branchType) ||
      ['TANGERANG', 'TANGERANG_HO', 'HO_TANGERANG'].includes(branchId);
  }, [user]);

  const userBranchId = String(user?.branch_id || user?.branchId || '').trim();

  const [form, setForm] = useState({
    ...DEFAULT_FORM,
    tanggal_gabung: todayStr,
    branch_id: isOwnerMode ? '' : userBranchId,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState(isOwnerMode ? 'ALL' : userBranchId || 'ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  const rawCustomers = useMemo(() => {
    return getRawCustomerRows({
      masterCustomers,
      master_customers,
      masterCustomer,
      master_customer,
      customers,
      pelanggan,
      dbData,
    });
  }, [masterCustomers, master_customers, masterCustomer, master_customer, customers, pelanggan, dbData]);

  const rawBranches = useMemo(() => {
    return getRawBranchRows({
      masterBranches,
      master_branches,
      master_branch,
      branches,
      dbData,
    });
  }, [masterBranches, master_branches, master_branch, branches, dbData]);

  const rawSales = useMemo(() => {
    return getRawSalesRows({
      orders,
      salesPackages,
      sales_packages,
      dbData,
    }).map(normalizeSalesRecord);
  }, [orders, salesPackages, sales_packages, dbData]);

  const masterSource = useMemo(() => ({
    ...(dbData || {}),
    master_customers: rawCustomers,
    masterCustomers: rawCustomers,
    customers: rawCustomers,
    master_branches: rawBranches,
    masterBranches: rawBranches,
    master_branch: rawBranches,
  }), [dbData, rawCustomers, rawBranches]);

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

  const customerRecords = useMemo(() => {
    const result = erpOrchestrator.masterData.getCustomers(masterSource, {
      includeInactive: true,
      includeDeleted: true,
      validate: false,
    });

    return (result.records || [])
      .map(normalizeCustomerDisplay)
      .map((customer) => ({
        ...customer,
        metrics: createCustomerMetrics(customer, rawSales),
      }))
      .sort((a, b) => {
        if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
        if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
        return String(a.customer_name).localeCompare(String(b.customer_name));
      });
  }, [masterSource, rawSales]);

  const searchResultIds = useMemo(() => {
    const keyword = searchQuery.trim();

    if (!keyword) return new Set();

    const result = erpOrchestrator.masterData.searchMaster(masterSource, {
      masterType: 'CUSTOMER',
      keyword,
      includeInactive: true,
      includeDeleted: true,
    }, {
      validate: false,
    });

    return new Set((result.records || []).flatMap((record) => {
      const customer = normalizeCustomerDisplay(record);
      return [
        customer.id,
        customer.customer_id,
        customer.customer_code,
        customer.nomor_telepon,
        customer.email,
      ].filter(Boolean);
    }));
  }, [masterSource, searchQuery]);

  const effectiveBranchFilter = !isOwnerMode && userBranchId ? userBranchId : branchFilter;

  const filteredCustomers = useMemo(() => {
    const keyword = normalizeText(searchQuery);

    return customerRecords.filter((customer) => {
      const statusOk = statusFilter === 'ALL'
        ? !customer.isDeleted
        : statusFilter === 'SOFT_DELETED'
          ? customer.isDeleted || customer.status === 'SOFT_DELETED'
          : customer.status === statusFilter && !customer.isDeleted;

      const branchOk = effectiveBranchFilter === 'ALL' || customer.branch_id === effectiveBranchFilter;
      const typeOk = typeFilter === 'ALL' || customer.customer_type === typeFilter;
      const groupOk = groupFilter === 'ALL' || customer.customer_group === groupFilter;

      const searchOk = !keyword ||
        customer.search_text.includes(keyword) ||
        searchResultIds.has(customer.id) ||
        searchResultIds.has(customer.customer_id) ||
        searchResultIds.has(customer.customer_code) ||
        searchResultIds.has(customer.nomor_telepon) ||
        searchResultIds.has(customer.email);

      return statusOk && branchOk && typeOk && groupOk && searchOk;
    });
  }, [
    customerRecords,
    searchQuery,
    searchResultIds,
    statusFilter,
    effectiveBranchFilter,
    typeFilter,
    groupFilter,
  ]);

  const analytics = useMemo(() => {
    const visible = customerRecords.filter((customer) => !customer.isDeleted);
    const scoped = visible.filter((customer) => {
      if (effectiveBranchFilter === 'ALL') return true;
      return customer.branch_id === effectiveBranchFilter;
    });

    const active = scoped.filter((customer) => customer.status === 'ACTIVE').length;
    const nonActive = scoped.filter((customer) => customer.status === 'NON_ACTIVE').length;

    const totalOmzet = scoped.reduce((sum, customer) => sum + customer.metrics.total_omzet, 0);
    const totalPiutang = scoped.reduce((sum, customer) => sum + customer.metrics.total_piutang, 0);
    const totalProfit = scoped.reduce((sum, customer) => sum + customer.metrics.total_profit, 0);
    const totalTransaksi = scoped.reduce((sum, customer) => sum + customer.metrics.total_transaksi, 0);

    const topCustomer = [...scoped].sort((a, b) => b.metrics.total_omzet - a.metrics.total_omzet)[0] || null;
    const mostValuable = [...scoped].sort((a, b) => b.metrics.valuable_score - a.metrics.valuable_score)[0] || null;
    const highestClv = [...scoped].sort((a, b) => b.metrics.customer_lifetime_value - a.metrics.customer_lifetime_value)[0] || null;

    return {
      total: scoped.length,
      active,
      nonActive,
      deleted: customerRecords.filter((customer) => customer.isDeleted || customer.status === 'SOFT_DELETED').length,
      total_omzet: roundMoney(totalOmzet),
      total_piutang: roundMoney(totalPiutang),
      total_profit: roundMoney(totalProfit),
      total_transaksi: totalTransaksi,
      top_customer: topCustomer,
      most_valuable_customer: mostValuable,
      highest_clv_customer: highestClv,
    };
  }, [customerRecords, effectiveBranchFilter]);

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
    setForm({
      ...DEFAULT_FORM,
      tanggal_gabung: todayStr,
      branch_id: isOwnerMode ? '' : userBranchId,
    });
    setIsEditing(false);
    setSelectedCustomer(null);
  };

  const handleGenerateId = () => {
    const newId = generateId('CUST', todayStr);

    setForm((prev) => ({
      ...prev,
      id: prev.id || newId,
      customer_id: prev.customer_id || newId,
    }));
  };

  const handleQuickTemplate = () => {
    const newId = generateId('CUST', todayStr);

    setForm((prev) => ({
      ...prev,
      id: prev.id || newId,
      customer_id: prev.customer_id || newId,
      customer_code: prev.customer_code || newId,
      customer_type: prev.customer_type || 'RETAIL',
      customer_group: prev.customer_group || 'OFFLINE',
      branch_id: prev.branch_id || (!isOwnerMode ? userBranchId : activeBranchRecords[0]?.branch_id || ''),
      tanggal_gabung: prev.tanggal_gabung || todayStr,
      status: 'ACTIVE',
      jatuh_tempo_hari: prev.jatuh_tempo_hari || '0',
      limit_piutang: prev.limit_piutang || '0',
    }));
  };

  const handleEdit = (customer) => {
    setSelectedCustomer(customer);
    setIsEditing(true);

    setForm({
      id: customer.id || customer.customer_id,
      customer_id: customer.customer_id,
      customer_code: customer.customer_code,
      customer_name: customer.customer_name,
      customer_type: customer.customer_type || 'RETAIL',
      branch_id: customer.branch_id,
      customer_group: customer.customer_group || 'OFFLINE',
      nomor_telepon: customer.nomor_telepon,
      email: customer.email,
      alamat: customer.alamat,
      kota: customer.kota,
      provinsi: customer.provinsi,
      tanggal_gabung: customer.tanggal_gabung || todayStr,
      status: customer.status === 'SOFT_DELETED' ? 'NON_ACTIVE' : customer.status || 'ACTIVE',
      limit_piutang: String(customer.limit_piutang || ''),
      jatuh_tempo_hari: String(customer.jatuh_tempo_hari || ''),
      sales_pic: customer.sales_pic,
      notes: customer.notes,
    });
  };

  const validateForm = () => {
    const warnings = [];

    if (!form.customer_id.trim()) warnings.push('Customer ID wajib diisi.');
    if (!form.customer_code.trim()) warnings.push('Customer Code wajib diisi.');
    if (!form.customer_name.trim()) warnings.push('Nama pelanggan wajib diisi.');
    if (!form.customer_type.trim()) warnings.push('Tipe pelanggan wajib dipilih.');
    if (!form.customer_group.trim()) warnings.push('Customer group wajib dipilih.');
    if (!form.branch_id.trim()) warnings.push('Branch ID wajib dipilih. Customer tidak boleh orphan.');
    if (!form.tanggal_gabung.trim()) warnings.push('Tanggal gabung wajib diisi.');
    if (!form.status.trim()) warnings.push('Status pelanggan wajib dipilih.');

    const branchExists = branchRecords.some((branch) => {
      return branch.branch_id === form.branch_id && !branch.isDeleted;
    });

    if (form.branch_id && !branchExists) {
      warnings.push('Branch ID tidak ditemukan di Master Cabang. Customer wajib terhubung ke cabang resmi.');
    }

    if (!isOwnerMode && userBranchId && form.branch_id !== userBranchId) {
      warnings.push('User cabang hanya boleh membuat/mengedit customer di branch miliknya.');
    }

    if (toNumber(form.limit_piutang) < 0) {
      warnings.push('Limit piutang tidak boleh negatif.');
    }

    if (toNumber(form.jatuh_tempo_hari) < 0) {
      warnings.push('Jatuh tempo hari tidak boleh negatif.');
    }

    const targetId = normalizeCode(form.customer_id);
    const targetCode = normalizeCode(form.customer_code);
    const targetBranch = form.branch_id;

    const duplicateId = customerRecords.find((customer) => {
      if (isEditing && customer.customer_id === selectedCustomer?.customer_id) return false;
      if (customer.isDeleted) return false;
      return normalizeCode(customer.customer_id) === targetId && customer.branch_id === targetBranch;
    });

    const duplicateCode = customerRecords.find((customer) => {
      if (isEditing && customer.customer_id === selectedCustomer?.customer_id) return false;
      if (customer.isDeleted) return false;
      return normalizeCode(customer.customer_code) === targetCode && customer.branch_id === targetBranch;
    });

    if (duplicateId) warnings.push(`Customer ID sudah dipakai oleh ${duplicateId.customer_name} di cabang yang sama.`);
    if (duplicateCode) warnings.push(`Customer Code sudah dipakai oleh ${duplicateCode.customer_name} di cabang yang sama.`);

    return warnings;
  };

  const createPayload = (override = {}) => {
    const customerId = String(form.customer_id || selectedCustomer?.customer_id || generateId('CUST', todayStr)).trim();
    const now = new Date().toISOString();
    const status = normalizeCode(form.status);

    return {
      ...(selectedCustomer?.raw || {}),

      id: selectedCustomer?.id || customerId,
      date: selectedCustomer?.date || todayStr,

      customer_id: customerId,
      customer_code: normalizeCode(form.customer_code || customerId),
      customer_name: normalizeText(form.customer_name),
      customer_type: normalizeCode(form.customer_type),

      branch_id: normalizeCode(form.branch_id),
      customer_group: normalizeCode(form.customer_group),

      nomor_telepon: form.nomor_telepon.trim(),
      phone: form.nomor_telepon.trim(),
      whatsapp: form.nomor_telepon.trim(),

      email: form.email.trim().toLowerCase(),

      alamat: form.alamat.trim(),
      address: form.alamat.trim(),

      kota: normalizeText(form.kota),
      city: normalizeText(form.kota),

      provinsi: normalizeText(form.provinsi),
      province: normalizeText(form.provinsi),

      tanggal_gabung: normalizeDate(form.tanggal_gabung),
      join_date: normalizeDate(form.tanggal_gabung),

      status,
      customer_status: status,
      status_active: status === 'ACTIVE',
      is_active: status === 'ACTIVE',
      isDeleted: false,

      limit_piutang: roundMoney(form.limit_piutang),
      credit_limit: roundMoney(form.limit_piutang),

      jatuh_tempo_hari: toNumber(form.jatuh_tempo_hari),
      due_days: toNumber(form.jatuh_tempo_hari),

      sales_pic: form.sales_pic.trim(),
      pic: form.sales_pic.trim(),

      notes: form.notes.trim(),
      keterangan: form.notes.trim(),

      created_at: selectedCustomer?.raw?.created_at || now,
      created_by: selectedCustomer?.raw?.created_by || user?.name || user?.email || 'SYSTEM',
      updated_at: now,
      updated_by: user?.name || user?.email || 'SYSTEM',

      ...override,
    };
  };

  const persistCustomer = async (action, payload) => {
    if (typeof sendToSheet !== 'function') {
      notify('sendToSheet belum tersedia. Data pelanggan belum bisa disimpan ke cloud.', 'error');
      return false;
    }

    let isSuccess = false;

    try {
      isSuccess = await sendToSheet(action, CUSTOMER_TABLE_NAME, payload);
    } catch (error) {
      isSuccess = false;
    }

    if (!isSuccess) {
      try {
        isSuccess = await sendToSheet(action, payload, CUSTOMER_TABLE_NAME);
      } catch (error) {
        isSuccess = false;
      }
    }

    return Boolean(isSuccess);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const warnings = validateForm();

    if (warnings.length > 0) {
      notify(warnings.join('\n'), 'error');
      return;
    }

    const payload = createPayload();
    const action = isEditing ? 'update' : 'insert';

    const isSuccess = await persistCustomer(action, payload);

    if (isSuccess) {
      notify(isEditing ? 'Master pelanggan berhasil diperbarui.' : 'Pelanggan baru berhasil ditambahkan.', 'success');
      resetForm();
    }
  };

  const handleToggleStatus = async (customer) => {
    const nextStatus = customer.status === 'ACTIVE' ? 'NON_ACTIVE' : 'ACTIVE';

    const confirmed = window.confirm(
      `${nextStatus === 'NON_ACTIVE' ? 'Nonaktifkan' : 'Aktifkan ulang'} pelanggan ${customer.customer_name}?`,
    );

    if (!confirmed) return;

    const payload = {
      ...(customer.raw || {}),
      id: customer.id || customer.customer_id,
      customer_id: customer.customer_id,
      customer_status: nextStatus,
      status: nextStatus,
      status_active: nextStatus === 'ACTIVE',
      is_active: nextStatus === 'ACTIVE',
      isDeleted: false,
      updated_at: new Date().toISOString(),
      updated_by: user?.name || user?.email || 'SYSTEM',
    };

    const isSuccess = await persistCustomer('update', payload);

    if (isSuccess) {
      notify(nextStatus === 'ACTIVE' ? 'Pelanggan berhasil diaktifkan ulang.' : 'Pelanggan berhasil dinonaktifkan.', 'success');
    }
  };

  const handleSoftDelete = async (customer) => {
    const confirmed = window.confirm(
      `Soft delete pelanggan ${customer.customer_name}? Data tidak dihapus permanen, hanya disembunyikan dari transaksi aktif.`,
    );

    if (!confirmed) return;

    const payload = {
      ...(customer.raw || {}),
      id: customer.id || customer.customer_id,
      customer_id: customer.customer_id,
      customer_status: 'NON_ACTIVE',
      status: 'NON_ACTIVE',
      status_active: false,
      is_active: false,
      isDeleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: user?.name || user?.email || 'SYSTEM',
      updated_at: new Date().toISOString(),
      updated_by: user?.name || user?.email || 'SYSTEM',
    };

    const isSuccess = await persistCustomer('update', payload);

    if (isSuccess) {
      notify('Pelanggan berhasil di-soft delete.', 'success');
      if (selectedCustomer?.customer_id === customer.customer_id) resetForm();
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
                <Users size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                Master Pelanggan ERP
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              Pusat Data Pelanggan Dimsum Aditya
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-300">
              Setiap transaksi penjualan wajib punya customer resmi agar piutang, omzet, profit, dan analytics terpisah per cabang.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">{isOwnerMode ? 'Owner Mode Lintas Cabang' : 'Branch Mode'}</Badge>
            <Badge tone="amber">Customer Ledger Ready</Badge>
            <Badge tone="green">CLV Analytics</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Customer" value={analytics.total} icon={<Users size={18} />} tone="white" />
        <StatCard title="Aktif" value={analytics.active} icon={<CheckCircle size={18} />} tone="red" />
        <StatCard title="Total Omzet" value={formatMoney(analytics.total_omzet)} icon={<ReceiptText size={18} />} tone="gold" />
        <StatCard title="Total Piutang" value={formatMoney(analytics.total_piutang)} icon={<WalletCards size={18} />} tone="white" />
        <StatCard title="Total Profit" value={formatMoney(analytics.total_profit)} icon={<TrendingUp size={18} />} tone="dark" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-red-50 p-3 text-red-600">
              <Crown size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Top Customer</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.top_customer?.customer_name || '-'}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                Omzet {formatMoney(analytics.top_customer?.metrics?.total_omzet || 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
              <Star size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Most Valuable Customer</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.most_valuable_customer?.customer_name || '-'}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                Score {formatMoney(analytics.most_valuable_customer?.metrics?.valuable_score || 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <BadgeDollarSign size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Customer Lifetime Value</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.highest_clv_customer?.customer_name || '-'}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                CLV {formatMoney(analytics.highest_clv_customer?.metrics?.customer_lifetime_value || 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
                  {isEditing ? <Edit2 size={16} className="text-red-600" /> : <Plus size={16} className="text-red-600" />}
                  {isEditing ? 'Edit Pelanggan' : 'Tambah Pelanggan'}
                </h2>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  Quick add customer untuk transaksi sales cepat.
                </p>
              </div>

              <div className="flex gap-2">
                {!isEditing && (
                  <button
                    type="button"
                    onClick={handleQuickTemplate}
                    className="rounded-xl bg-amber-50 p-2 text-amber-700 transition-all hover:bg-amber-100"
                    title="Quick customer template"
                  >
                    <Zap size={16} />
                  </button>
                )}

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
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Customer ID" required>
                  <div className="flex gap-2">
                    <input
                      disabled={isEditing}
                      value={form.customer_id}
                      onChange={(event) => setForm({ ...form, customer_id: normalizeCode(event.target.value), id: normalizeCode(event.target.value) })}
                      className={inputClass}
                      placeholder="CUST-001"
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

                <Field label="Customer Code" required>
                  <input
                    value={form.customer_code}
                    onChange={(event) => setForm({ ...form, customer_code: normalizeCode(event.target.value) })}
                    className={inputClass}
                    placeholder="CUST-CBN-001"
                  />
                </Field>
              </div>

              <Field label="Nama Pelanggan" required>
                <input
                  value={form.customer_name}
                  onChange={(event) => setForm({ ...form, customer_name: event.target.value })}
                  className={inputClass}
                  placeholder="Nama pelanggan"
                />
              </Field>

              <Field label="Cabang Terhubung" required>
                <select
                  disabled={!isOwnerMode && Boolean(userBranchId)}
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
                    Master Cabang belum tersedia. Tambahkan cabang dulu agar customer tidak orphan.
                  </div>
                )}
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Customer Type" required>
                  <select
                    value={form.customer_type}
                    onChange={(event) => setForm({ ...form, customer_type: event.target.value })}
                    className={inputClass}
                  >
                    {CUSTOMER_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Customer Group" required>
                  <select
                    value={form.customer_group}
                    onChange={(event) => setForm({ ...form, customer_group: event.target.value })}
                    className={inputClass}
                  >
                    {CUSTOMER_GROUPS.map((group) => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
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
                    placeholder="customer@email.com"
                  />
                </Field>
              </div>

              <Field label="Alamat">
                <textarea
                  value={form.alamat}
                  onChange={(event) => setForm({ ...form, alamat: event.target.value })}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Alamat pelanggan..."
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
                <Field label="Tanggal Gabung" required>
                  <input
                    type="date"
                    value={form.tanggal_gabung}
                    onChange={(event) => setForm({ ...form, tanggal_gabung: event.target.value })}
                    className={inputClass}
                  />
                </Field>

                <Field label="Status" required>
                  <select
                    value={form.status}
                    onChange={(event) => setForm({ ...form, status: event.target.value })}
                    className={inputClass}
                  >
                    {CUSTOMER_STATUS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Limit Piutang">
                  <input
                    value={form.limit_piutang}
                    onChange={(event) => setForm({ ...form, limit_piutang: event.target.value })}
                    className={inputClass}
                    placeholder="0"
                  />
                </Field>

                <Field label="Jatuh Tempo Hari">
                  <input
                    value={form.jatuh_tempo_hari}
                    onChange={(event) => setForm({ ...form, jatuh_tempo_hari: event.target.value })}
                    className={inputClass}
                    placeholder="0"
                  />
                </Field>
              </div>

              <Field label="Sales PIC">
                <input
                  value={form.sales_pic}
                  onChange={(event) => setForm({ ...form, sales_pic: event.target.value })}
                  className={inputClass}
                  placeholder="Nama sales / PIC"
                />
              </Field>

              <Field label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Catatan pelanggan..."
                />
              </Field>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-sm transition-all hover:bg-red-700"
              >
                <Save size={16} />
                {isEditing ? 'Simpan Perubahan' : 'Tambah Pelanggan'}
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
                    Daftar Pelanggan Resmi
                  </h2>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    Customer resmi untuk Sales, Piutang, Accounting, dan Analytics.
                  </p>
                </div>

                <div className="flex flex-col gap-2 2xl:flex-row">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-xs font-bold outline-none transition-all placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50 md:w-64"
                      placeholder="Cari nama, kode, telepon, email..."
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
                      disabled={!isOwnerMode && Boolean(userBranchId)}
                      value={effectiveBranchFilter}
                      onChange={(event) => {
                        if (isOwnerMode) setBranchFilter(event.target.value);
                      }}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none focus:border-red-500 disabled:bg-slate-50"
                    >
                      <option value="ALL">SEMUA CABANG</option>
                      {branchRecords.map((branch) => (
                        <option key={branch.branch_id} value={branch.branch_id}>
                          {branch.branch_name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={typeFilter}
                      onChange={(event) => setTypeFilter(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none focus:border-red-500"
                    >
                      <option value="ALL">SEMUA TIPE</option>
                      {CUSTOMER_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>

                    <select
                      value={groupFilter}
                      onChange={(event) => setGroupFilter(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none focus:border-red-500"
                    >
                      <option value="ALL">SEMUA GROUP</option>
                      {CUSTOMER_GROUPS.map((group) => (
                        <option key={group} value={group}>{group}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1320px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pelanggan</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cabang</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Tipe / Group</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Kontak</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Piutang</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Analytics</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Status</th>
                    <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCustomers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-14 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-red-50 text-red-600">
                          <Users size={24} />
                        </div>
                        <div className="mt-3 text-sm font-black text-slate-800">Pelanggan tidak ditemukan</div>
                        <div className="mt-1 text-xs font-semibold text-slate-400">
                          Ubah filter atau tambahkan pelanggan baru.
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredCustomers.map((customer) => {
                    const isDeleted = customer.isDeleted || customer.status === 'SOFT_DELETED';
                    const isActive = customer.status === 'ACTIVE' && !isDeleted;
                    const branchName = branchNameById.get(customer.branch_id) || 'Branch tidak ditemukan';
                    const isOrphan = !branchNameById.has(customer.branch_id);

                    return (
                      <tr key={`${customer.customer_id}-${customer.customer_code}`} className="border-b border-slate-100 transition-colors hover:bg-red-50/30">
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isActive ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              <Users size={18} />
                            </div>
                            <div>
                              <div className="font-black text-slate-900">{customer.customer_name || '-'}</div>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                <Badge tone="slate">{customer.customer_id || '-'}</Badge>
                                <Badge tone="amber">{customer.customer_code || '-'}</Badge>
                              </div>
                              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                                <CalendarClock size={12} />
                                Gabung {customer.tanggal_gabung ? formatDate(customer.tanggal_gabung) : '-'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-2">
                            <Building2 size={15} className={isOrphan ? 'mt-0.5 shrink-0 text-red-500' : 'mt-0.5 shrink-0 text-slate-400'} />
                            <div>
                              <div className={`text-xs font-black ${isOrphan ? 'text-red-600' : 'text-slate-800'}`}>
                                {branchName}
                              </div>
                              <div className="mt-1 text-[11px] font-semibold text-slate-400">
                                {customer.branch_id || '-'}
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
                          <div className="flex flex-wrap gap-1.5">
                            <Badge tone={customer.customer_type === 'DISTRIBUTOR' || customer.customer_type === 'FRANCHISE' ? 'red' : customer.customer_type === 'RESELLER' ? 'amber' : 'slate'}>
                              {customer.customer_type || '-'}
                            </Badge>
                            <Badge tone="purple">{customer.customer_group || '-'}</Badge>
                          </div>
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                            <User size={12} />
                            PIC {customer.sales_pic || '-'}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="space-y-1.5 text-[11px] font-bold text-slate-600">
                            <div className="flex items-center gap-2">
                              <Phone size={13} className="text-slate-400" />
                              {customer.nomor_telepon || '-'}
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail size={13} className="text-slate-400" />
                              {customer.email || '-'}
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin size={13} className="text-slate-400" />
                              {customer.kota || '-'}{customer.provinsi ? `, ${customer.provinsi}` : ''}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="text-xs font-black text-slate-900">
                            Limit {formatMoney(customer.limit_piutang)}
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-slate-400">
                            Tempo {customer.jatuh_tempo_hari || 0} hari
                          </div>
                          <div className={`mt-2 text-xs font-black ${customer.metrics.total_piutang > customer.limit_piutang && customer.limit_piutang > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                            Piutang {formatMoney(customer.metrics.total_piutang)}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-bold">
                            <div className="text-slate-400">Transaksi</div>
                            <div className="text-right text-slate-900">{customer.metrics.total_transaksi}</div>

                            <div className="text-slate-400">Omzet</div>
                            <div className="text-right text-slate-900">{formatMoney(customer.metrics.total_omzet)}</div>

                            <div className="text-slate-400">Profit</div>
                            <div className="text-right text-emerald-700">{formatMoney(customer.metrics.total_profit)}</div>

                            <div className="text-slate-400">Last Order</div>
                            <div className="text-right text-slate-900">
                              {customer.metrics.last_order_date ? formatDate(customer.metrics.last_order_date) : '-'}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <Badge tone={isDeleted ? 'dark' : isActive ? 'green' : 'amber'}>
                            {isDeleted ? 'SOFT_DELETED' : customer.status}
                          </Badge>
                          <div className="mt-2 text-[11px] font-semibold text-slate-400">
                            {customer.updated_at ? formatDate(customer.updated_at) : customer.date ? formatDate(customer.date) : '-'}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            {!isDeleted && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(customer)}
                                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                                  title="Edit pelanggan"
                                >
                                  <Edit2 size={15} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(customer)}
                                  className={`rounded-xl border p-2 transition-all ${
                                    isActive
                                      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  }`}
                                  title={isActive ? 'Nonaktifkan pelanggan' : 'Aktifkan pelanggan'}
                                >
                                  {isActive ? <Power size={15} /> : <RotateCcw size={15} />}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSoftDelete(customer)}
                                  className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100"
                                  title="Soft delete pelanggan"
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
                Menampilkan <span className="text-slate-800">{filteredCustomers.length}</span> dari <span className="text-slate-800">{customerRecords.length}</span> data pelanggan.
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge tone="red">Merah = Aktif / Prioritas</Badge>
                <Badge tone="amber">Gold = Reseller / Warning</Badge>
                <Badge tone="purple">Group Customer</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
