import React, { useMemo, useState } from 'react';
import {
  Truck,
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
  ReceiptText,
  CalendarClock,
  BadgeDollarSign,
  Star,
  TrendingUp,
  History,
  ArrowUpDown,
  Landmark,
  CreditCard,
  Banknote,
  QrCode,
  Package,
  Flame,
  Snowflake,
  Boxes,
  CookingPot,
  Fuel,
  ClipboardList,
} from 'lucide-react';

import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import erpOrchestrator from '../../services/erpOrchestrator';

const SUPPLIER_TABLE_NAME = 'master_suppliers';

const SUPPLIER_TYPES = [
  'AYAM',
  'BAHAN_BAKU',
  'BUMBU',
  'PACKAGING',
  'TOPPING',
  'GAS',
  'FROZEN',
  'LOGISTIK',
  'UMUM',
];

const PAYMENT_METHODS = [
  'CASH',
  'TRANSFER',
  'QRIS',
];

const SUPPLIER_STATUS = [
  'ACTIVE',
  'NON_ACTIVE',
];

const DEFAULT_FORM = {
  id: '',
  supplier_id: '',
  supplier_code: '',
  supplier_name: '',
  supplier_type: 'BAHAN_BAKU',
  branch_id: '',
  nomor_telepon: '',
  email: '',
  alamat: '',
  kota: '',
  provinsi: '',
  nama_pic: '',
  nomor_pic: '',
  status: 'ACTIVE',
  termin_hari: '',
  limit_hutang: '',
  metode_pembayaran_default: 'TRANSFER',
  bank: '',
  nomor_rekening: '',
  atas_nama_rekening: '',
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

  const value = row?.status ?? row?.supplier_status ?? row?.status_active ?? row?.is_active;

  if (value === false) return 'NON_ACTIVE';
  if (value === true) return 'ACTIVE';

  const normalized = normalizeCode(value || 'ACTIVE');

  if (['NON_ACTIVE', 'NONAKTIF', 'INACTIVE', 'DISABLED', 'FALSE', 'NO', 'N', '0'].includes(normalized)) {
    return 'NON_ACTIVE';
  }

  return 'ACTIVE';
};

const getRawSupplierRows = ({
  masterSuppliers,
  master_suppliers,
  masterSupplier,
  master_supplier,
  suppliers,
  vendors,
  dbData,
}) => {
  if (Array.isArray(master_suppliers)) return master_suppliers;
  if (Array.isArray(masterSuppliers)) return masterSuppliers;
  if (Array.isArray(masterSupplier)) return masterSupplier;
  if (Array.isArray(master_supplier)) return master_supplier;
  if (Array.isArray(suppliers)) return suppliers;
  if (Array.isArray(vendors)) return vendors;

  if (Array.isArray(dbData?.master_suppliers)) return dbData.master_suppliers;
  if (Array.isArray(dbData?.masterSuppliers)) return dbData.masterSuppliers;
  if (Array.isArray(dbData?.master_supplier)) return dbData.master_supplier;
  if (Array.isArray(dbData?.suppliers)) return dbData.suppliers;
  if (Array.isArray(dbData?.vendors)) return dbData.vendors;

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

const getRawPurchaseRows = ({
  purchases,
  purchasePackages,
  purchase_packages,
  purchase_transaction_packages,
  dbData,
}) => {
  const rows = [];

  if (Array.isArray(purchases)) rows.push(...purchases);
  if (Array.isArray(purchasePackages)) rows.push(...purchasePackages);
  if (Array.isArray(purchase_packages)) rows.push(...purchase_packages);
  if (Array.isArray(purchase_transaction_packages)) rows.push(...purchase_transaction_packages);

  if (Array.isArray(dbData?.purchases)) rows.push(...dbData.purchases);
  if (Array.isArray(dbData?.purchasePackages)) rows.push(...dbData.purchasePackages);
  if (Array.isArray(dbData?.purchase_packages)) rows.push(...dbData.purchase_packages);
  if (Array.isArray(dbData?.purchase_transaction_packages)) rows.push(...dbData.purchase_transaction_packages);

  return rows;
};

const getRawPaymentRows = ({
  payments,
  supplierPayments,
  supplier_payments,
  cashflow,
  cashflow_transactions,
  supplier_ledger,
  dbData,
}) => {
  const rows = [];

  if (Array.isArray(payments)) rows.push(...payments);
  if (Array.isArray(supplierPayments)) rows.push(...supplierPayments);
  if (Array.isArray(supplier_payments)) rows.push(...supplier_payments);
  if (Array.isArray(cashflow)) rows.push(...cashflow);
  if (Array.isArray(cashflow_transactions)) rows.push(...cashflow_transactions);
  if (Array.isArray(supplier_ledger)) rows.push(...supplier_ledger);

  if (Array.isArray(dbData?.payments)) rows.push(...dbData.payments);
  if (Array.isArray(dbData?.supplierPayments)) rows.push(...dbData.supplierPayments);
  if (Array.isArray(dbData?.supplier_payments)) rows.push(...dbData.supplier_payments);
  if (Array.isArray(dbData?.cashflow)) rows.push(...dbData.cashflow);
  if (Array.isArray(dbData?.cashflow_transactions)) rows.push(...dbData.cashflow_transactions);
  if (Array.isArray(dbData?.supplier_ledger)) rows.push(...dbData.supplier_ledger);

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

const normalizeSupplierDisplay = (record) => {
  const raw = record?.raw || record || {};

  const supplierId = String(
    raw.supplier_id ||
    raw.supplierId ||
    record?.id ||
    raw.id ||
    '',
  ).trim();

  const supplierCode = String(
    raw.supplier_code ||
    raw.supplierCode ||
    raw.kode_supplier ||
    raw.code ||
    record?.code ||
    supplierId ||
    '',
  ).trim();

  const supplierName = String(
    raw.supplier_name ||
    raw.supplierName ||
    raw.nama_supplier ||
    raw.vendor_name ||
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

  const supplierType = normalizeCode(
    raw.supplier_type ||
    raw.supplierType ||
    raw.type ||
    raw.category ||
    'UMUM',
  );

  const status = normalizeStatus(raw);

  return {
    id: String(raw.id || supplierId).trim(),

    supplier_id: supplierId,
    supplier_code: supplierCode,
    supplier_name: supplierName,
    supplier_type: supplierType,

    branch_id: branchId,

    nomor_telepon: String(raw.nomor_telepon || raw.phone || raw.no_hp || raw.telepon || raw.whatsapp || '').trim(),
    email: String(raw.email || '').trim(),
    alamat: String(raw.alamat || raw.address || '').trim(),
    kota: String(raw.kota || raw.city || '').trim(),
    provinsi: String(raw.provinsi || raw.province || '').trim(),

    nama_pic: String(raw.nama_pic || raw.pic_name || raw.pic || raw.contact_person || '').trim(),
    nomor_pic: String(raw.nomor_pic || raw.pic_phone || raw.phone_pic || '').trim(),

    status,

    termin_hari: toNumber(raw.termin_hari || raw.term_days || raw.due_days || 0),
    limit_hutang: roundMoney(raw.limit_hutang || raw.credit_limit || raw.payable_limit || 0),

    metode_pembayaran_default: normalizeCode(raw.metode_pembayaran_default || raw.default_payment_method || raw.payment_method || 'TRANSFER'),

    bank: String(raw.bank || raw.bank_name || '').trim(),
    nomor_rekening: String(raw.nomor_rekening || raw.account_number || raw.no_rekening || '').trim(),
    atas_nama_rekening: String(raw.atas_nama_rekening || raw.account_name || raw.nama_rekening || '').trim(),

    notes: String(raw.notes || raw.keterangan || raw.description || '').trim(),

    created_at: raw.created_at || '',
    updated_at: raw.updated_at || '',
    date: raw.date || raw.created_at || raw.updated_at || '',

    isDeleted: isSoftDeleted(raw),

    search_text: normalizeText([
      supplierId,
      supplierCode,
      supplierName,
      supplierType,
      branchId,
      raw.nomor_telepon,
      raw.phone,
      raw.whatsapp,
      raw.email,
      raw.alamat,
      raw.address,
      raw.kota,
      raw.provinsi,
      raw.nama_pic,
      raw.pic,
      raw.nomor_pic,
      raw.bank,
      raw.nomor_rekening,
      raw.atas_nama_rekening,
    ].filter(Boolean).join(' ')),

    raw,
  };
};

const normalizePurchaseItem = (item = {}, purchase = {}) => {
  return {
    item_id: String(item.item_id || item.itemId || item.raw_material_id || item.material_id || '').trim(),
    item_name: String(item.item_name || item.itemName || item.raw_material_name || item.material_name || item.name || '').trim(),
    qty: toNumber(item.qty || item.quantity || item.qty_in || 0),
    unit: String(item.unit || item.satuan || item.uom || '').trim(),
    unit_price: roundMoney(item.unit_price || item.unitPrice || item.price || item.harga_satuan || 0),
    subtotal: roundMoney(item.subtotal || item.total || item.amount || toNumber(item.qty || 0) * toNumber(item.unit_price || item.price || 0)),
    purchase_date: purchase.purchase_date,
    purchase_id: purchase.purchase_id,
    supplier_id: purchase.supplier_id,
    supplier_name: purchase.supplier_name,
  };
};

const normalizePurchaseRecord = (row) => {
  const packageInput = row?.purchase_transaction_package || row?.purchaseTransactionPackage || row || {};
  const header = packageInput.purchase_header || row?.purchase_header || row || {};
  const snapshot = packageInput.purchase_snapshot || parseJson(header.purchase_snapshot_json, null) || null;
  const snapshotPayload = snapshot?.payload?.purchase_snapshot || snapshot?.payload || null;

  const snapshotHeader = snapshotPayload?.purchase_header || snapshotPayload?.transaction_header || {};
  const finalHeader = {
    ...snapshotHeader,
    ...header,
  };

  const items = packageInput.purchase_items ||
    snapshotPayload?.purchase_items ||
    snapshotPayload?.transaction_items ||
    row?.purchase_items ||
    parseJson(header.items_json, []) ||
    parseJson(header.itemsJson, []) ||
    [];

  const totalAmount = roundMoney(
    finalHeader.total_amount ||
    finalHeader.amount ||
    finalHeader.grand_total ||
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
    finalHeader.hutang ||
    finalHeader.amount_payable ||
    Math.max(totalAmount - amountPaid, 0),
  );

  const purchaseDate = normalizeDate(
    finalHeader.purchase_date ||
    finalHeader.date ||
    finalHeader.created_at ||
    row?.date ||
    '',
  );

  const purchase = {
    purchase_id: String(finalHeader.purchase_id || finalHeader.id || row?.id || '').trim(),
    invoice_number: String(finalHeader.invoice_number || finalHeader.no_invoice || finalHeader.nota || '').trim(),
    supplier_id: String(finalHeader.supplier_id || finalHeader.supplierId || row?.supplier_id || '').trim(),
    supplier_name: String(finalHeader.supplier_name || finalHeader.supplierName || row?.supplier_name || '').trim(),
    branch_id: String(finalHeader.branch_id || finalHeader.branchId || '').trim(),
    purchase_date: purchaseDate,
    total_amount: totalAmount,
    amount_paid: amountPaid,
    remaining_amount: remainingAmount,
    payment_method: normalizeCode(finalHeader.payment_method || finalHeader.paymentMethod || ''),
    items: [],
    raw: row,
  };

  purchase.items = Array.isArray(items)
    ? items.map((item) => normalizePurchaseItem(item, purchase))
    : [];

  return purchase;
};

const normalizePaymentRecord = (row) => {
  const raw = row || {};
  const type = normalizeCode(raw.payment_type || raw.type || raw.category || raw.kategori || '');
  const supplierId = String(raw.supplier_id || raw.supplierId || '').trim();
  const supplierName = String(raw.supplier_name || raw.supplierName || '').trim();

  const amount = roundMoney(
    raw.amount ||
    raw.nominal ||
    raw.nominal_dibayar ||
    raw.amount_paid ||
    raw.credit ||
    0,
  );

  return {
    payment_id: String(raw.payment_id || raw.id || raw.ledger_id || '').trim(),
    supplier_id: supplierId,
    supplier_name: supplierName,
    type,
    date: normalizeDate(raw.payment_date || raw.tanggal_bayar || raw.date || raw.journal_date || ''),
    amount,
    raw,
  };
};

const supplierKeyCandidates = (supplier) => {
  return [
    normalizeCode(supplier.supplier_id),
    normalizeText(supplier.supplier_name),
    normalizeCode(supplier.supplier_code),
    normalizeCode(supplier.nomor_telepon),
  ].filter(Boolean);
};

const purchaseMatchesSupplier = (purchase, supplier) => {
  const supplierKeys = new Set(supplierKeyCandidates(supplier));

  if (purchase.supplier_id && supplierKeys.has(normalizeCode(purchase.supplier_id))) return true;
  if (purchase.supplier_name && supplierKeys.has(normalizeText(purchase.supplier_name))) return true;

  return false;
};

const paymentMatchesSupplier = (payment, supplier) => {
  const supplierKeys = new Set(supplierKeyCandidates(supplier));

  if (payment.supplier_id && supplierKeys.has(normalizeCode(payment.supplier_id))) return true;
  if (payment.supplier_name && supplierKeys.has(normalizeText(payment.supplier_name))) return true;

  return false;
};

const createPriceHistory = (supplierPurchases) => {
  const items = supplierPurchases.flatMap((purchase) => purchase.items || []);

  const sorted = items
    .filter((item) => item.item_id || item.item_name)
    .sort((a, b) => {
      const dateCompare = String(a.purchase_date || '').localeCompare(String(b.purchase_date || ''));
      if (dateCompare !== 0) return dateCompare;
      return String(a.purchase_id || '').localeCompare(String(b.purchase_id || ''));
    });

  const historyByItem = new Map();

  sorted.forEach((item) => {
    const key = item.item_id || item.item_name;

    if (!historyByItem.has(key)) {
      historyByItem.set(key, {
        item_id: item.item_id,
        item_name: item.item_name,
        unit: item.unit,
        history: [],
      });
    }

    historyByItem.get(key).history.push({
      purchase_id: item.purchase_id,
      purchase_date: item.purchase_date,
      unit_price: item.unit_price,
      qty: item.qty,
      unit: item.unit,
    });
  });

  const itemHistories = Array.from(historyByItem.values()).map((row) => {
    const firstPrice = row.history[0]?.unit_price || 0;
    const lastPrice = row.history[row.history.length - 1]?.unit_price || 0;
    const changeAmount = roundMoney(lastPrice - firstPrice);
    const changePct = firstPrice > 0 ? (changeAmount / firstPrice) * 100 : 0;

    let changeCount = 0;

    row.history.forEach((entry, index) => {
      if (index === 0) return;
      if (entry.unit_price !== row.history[index - 1].unit_price) changeCount += 1;
    });

    return {
      ...row,
      first_price: roundMoney(firstPrice),
      last_price: roundMoney(lastPrice),
      change_amount: changeAmount,
      change_pct: changePct,
      change_count: changeCount,
      history_count: row.history.length,
      last_purchase_date: row.history[row.history.length - 1]?.purchase_date || '',
    };
  });

  const latestItem = [...itemHistories]
    .sort((a, b) => String(b.last_purchase_date).localeCompare(String(a.last_purchase_date)))[0] || null;

  const totalChangeCount = itemHistories.reduce((sum, row) => sum + row.change_count, 0);

  return {
    item_histories: itemHistories,
    price_history_count: sorted.length,
    price_change_count: totalChangeCount,
    latest_item: latestItem,
  };
};

const createSupplierMetrics = (supplier, purchaseRecords, paymentRecords) => {
  const supplierPurchases = purchaseRecords.filter((purchase) => purchaseMatchesSupplier(purchase, supplier));
  const supplierPayments = paymentRecords.filter((payment) => paymentMatchesSupplier(payment, supplier));

  const totalTransaksi = supplierPurchases.length;
  const totalPembelian = roundMoney(supplierPurchases.reduce((sum, purchase) => sum + toNumber(purchase.total_amount), 0));
  const paidFromPurchase = roundMoney(supplierPurchases.reduce((sum, purchase) => sum + toNumber(purchase.amount_paid), 0));
  const paidFromPayments = roundMoney(supplierPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0));
  const totalPembayaran = roundMoney(Math.max(paidFromPurchase, paidFromPayments));
  const totalHutang = roundMoney(supplierPurchases.reduce((sum, purchase) => sum + toNumber(purchase.remaining_amount), 0));

  const lastPurchaseDate = supplierPurchases
    .map((purchase) => purchase.purchase_date)
    .filter(Boolean)
    .sort()
    .pop() || '';

  const avgPurchase = totalTransaksi > 0 ? totalPembelian / totalTransaksi : 0;
  const priceHistory = createPriceHistory(supplierPurchases);

  const supplierScore = totalPembelian - totalHutang + totalTransaksi * 1000;

  return {
    total_transaksi: totalTransaksi,
    total_pembelian: totalPembelian,
    total_hutang: totalHutang,
    total_pembayaran: totalPembayaran,
    last_purchase_date: lastPurchaseDate,
    average_purchase: roundMoney(avgPurchase),
    supplier_score: roundMoney(supplierScore),
    supplier_used: totalTransaksi > 0,
    ...priceHistory,
  };
};

const getSupplierTypeIcon = (type) => {
  const normalized = normalizeCode(type);

  if (normalized === 'AYAM') return <CookingPot size={18} />;
  if (normalized === 'BAHAN_BAKU') return <Package size={18} />;
  if (normalized === 'BUMBU') return <Flame size={18} />;
  if (normalized === 'PACKAGING') return <Boxes size={18} />;
  if (normalized === 'TOPPING') return <Star size={18} />;
  if (normalized === 'GAS') return <Fuel size={18} />;
  if (normalized === 'FROZEN') return <Snowflake size={18} />;
  if (normalized === 'LOGISTIK') return <Truck size={18} />;

  return <ClipboardList size={18} />;
};

const getPaymentMethodIcon = (method) => {
  const normalized = normalizeCode(method);

  if (normalized === 'CASH') return <Banknote size={13} />;
  if (normalized === 'QRIS') return <QrCode size={13} />;

  return <CreditCard size={13} />;
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

export default function TabMasterSupplier({
  masterSuppliers = [],
  master_suppliers,
  masterSupplier,
  master_supplier,
  suppliers,
  vendors,

  masterBranches = [],
  master_branches,
  master_branch,
  branches,

  purchases = [],
  purchasePackages,
  purchase_packages,
  purchase_transaction_packages,

  payments = [],
  supplierPayments,
  supplier_payments,
  cashflow,
  cashflow_transactions,
  supplier_ledger,

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
    branch_id: isOwnerMode ? '' : userBranchId,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState(isOwnerMode ? 'ALL' : userBranchId || 'ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  const rawSuppliers = useMemo(() => {
    return getRawSupplierRows({
      masterSuppliers,
      master_suppliers,
      masterSupplier,
      master_supplier,
      suppliers,
      vendors,
      dbData,
    });
  }, [masterSuppliers, master_suppliers, masterSupplier, master_supplier, suppliers, vendors, dbData]);

  const rawBranches = useMemo(() => {
    return getRawBranchRows({
      masterBranches,
      master_branches,
      master_branch,
      branches,
      dbData,
    });
  }, [masterBranches, master_branches, master_branch, branches, dbData]);

  const rawPurchases = useMemo(() => {
    return getRawPurchaseRows({
      purchases,
      purchasePackages,
      purchase_packages,
      purchase_transaction_packages,
      dbData,
    }).map(normalizePurchaseRecord);
  }, [purchases, purchasePackages, purchase_packages, purchase_transaction_packages, dbData]);

  const rawPayments = useMemo(() => {
    return getRawPaymentRows({
      payments,
      supplierPayments,
      supplier_payments,
      cashflow,
      cashflow_transactions,
      supplier_ledger,
      dbData,
    }).map(normalizePaymentRecord);
  }, [payments, supplierPayments, supplier_payments, cashflow, cashflow_transactions, supplier_ledger, dbData]);

  const masterSource = useMemo(() => ({
    ...(dbData || {}),
    master_suppliers: rawSuppliers,
    masterSuppliers: rawSuppliers,
    suppliers: rawSuppliers,
    master_branches: rawBranches,
    masterBranches: rawBranches,
    master_branch: rawBranches,
  }), [dbData, rawSuppliers, rawBranches]);

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

  const supplierRecords = useMemo(() => {
    const result = erpOrchestrator.masterData.getSuppliers(masterSource, {
      includeInactive: true,
      includeDeleted: true,
      validate: false,
    });

    return (result.records || [])
      .map(normalizeSupplierDisplay)
      .map((supplier) => ({
        ...supplier,
        metrics: createSupplierMetrics(supplier, rawPurchases, rawPayments),
      }))
      .sort((a, b) => {
        if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
        if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
        return String(a.supplier_name).localeCompare(String(b.supplier_name));
      });
  }, [masterSource, rawPurchases, rawPayments]);

  const searchResultIds = useMemo(() => {
    const keyword = searchQuery.trim();

    if (!keyword) return new Set();

    const result = erpOrchestrator.masterData.searchMaster(masterSource, {
      masterType: 'SUPPLIER',
      keyword,
      includeInactive: true,
      includeDeleted: true,
    }, {
      validate: false,
    });

    return new Set((result.records || []).flatMap((record) => {
      const supplier = normalizeSupplierDisplay(record);
      return [
        supplier.id,
        supplier.supplier_id,
        supplier.supplier_code,
        supplier.nomor_telepon,
        supplier.email,
        supplier.nama_pic,
      ].filter(Boolean);
    }));
  }, [masterSource, searchQuery]);

  const effectiveBranchFilter = !isOwnerMode && userBranchId ? userBranchId : branchFilter;

  const filteredSuppliers = useMemo(() => {
    const keyword = normalizeText(searchQuery);

    return supplierRecords.filter((supplier) => {
      const statusOk = statusFilter === 'ALL'
        ? !supplier.isDeleted
        : statusFilter === 'SOFT_DELETED'
          ? supplier.isDeleted || supplier.status === 'SOFT_DELETED'
          : supplier.status === statusFilter && !supplier.isDeleted;

      const branchOk = effectiveBranchFilter === 'ALL' || supplier.branch_id === effectiveBranchFilter;
      const typeOk = typeFilter === 'ALL' || supplier.supplier_type === typeFilter;

      const searchOk = !keyword ||
        supplier.search_text.includes(keyword) ||
        searchResultIds.has(supplier.id) ||
        searchResultIds.has(supplier.supplier_id) ||
        searchResultIds.has(supplier.supplier_code) ||
        searchResultIds.has(supplier.nomor_telepon) ||
        searchResultIds.has(supplier.email) ||
        searchResultIds.has(supplier.nama_pic);

      return statusOk && branchOk && typeOk && searchOk;
    });
  }, [
    supplierRecords,
    searchQuery,
    searchResultIds,
    statusFilter,
    effectiveBranchFilter,
    typeFilter,
  ]);

  const analytics = useMemo(() => {
    const visible = supplierRecords.filter((supplier) => !supplier.isDeleted);
    const scoped = visible.filter((supplier) => {
      if (effectiveBranchFilter === 'ALL') return true;
      return supplier.branch_id === effectiveBranchFilter;
    });

    const active = scoped.filter((supplier) => supplier.status === 'ACTIVE').length;
    const nonActive = scoped.filter((supplier) => supplier.status === 'NON_ACTIVE').length;

    const totalPembelian = scoped.reduce((sum, supplier) => sum + supplier.metrics.total_pembelian, 0);
    const totalHutang = scoped.reduce((sum, supplier) => sum + supplier.metrics.total_hutang, 0);
    const totalPembayaran = scoped.reduce((sum, supplier) => sum + supplier.metrics.total_pembayaran, 0);
    const totalTransaksi = scoped.reduce((sum, supplier) => sum + supplier.metrics.total_transaksi, 0);

    const rankedSuppliers = [...scoped]
      .sort((a, b) => b.metrics.supplier_score - a.metrics.supplier_score);

    const favoriteSupplier = rankedSuppliers[0] || null;

    const lastUsedSupplier = [...scoped]
      .filter((supplier) => supplier.metrics.last_purchase_date)
      .sort((a, b) => String(b.metrics.last_purchase_date).localeCompare(String(a.metrics.last_purchase_date)))[0] || null;

    const topPurchaseSupplier = [...scoped]
      .sort((a, b) => b.metrics.total_pembelian - a.metrics.total_pembelian)[0] || null;

    return {
      total: scoped.length,
      active,
      nonActive,
      deleted: supplierRecords.filter((supplier) => supplier.isDeleted || supplier.status === 'SOFT_DELETED').length,
      total_pembelian: roundMoney(totalPembelian),
      total_hutang: roundMoney(totalHutang),
      total_pembayaran: roundMoney(totalPembayaran),
      total_transaksi: totalTransaksi,
      favorite_supplier: favoriteSupplier,
      last_used_supplier: lastUsedSupplier,
      top_purchase_supplier: topPurchaseSupplier,
      ranking_supplier: rankedSuppliers.slice(0, 5),
    };
  }, [supplierRecords, effectiveBranchFilter]);

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
      branch_id: isOwnerMode ? '' : userBranchId,
    });
    setIsEditing(false);
    setSelectedSupplier(null);
  };

  const handleGenerateId = () => {
    const newId = generateId('SUP', todayStr);

    setForm((prev) => ({
      ...prev,
      id: prev.id || newId,
      supplier_id: prev.supplier_id || newId,
      supplier_code: prev.supplier_code || newId,
    }));
  };

  const handleEdit = (supplier) => {
    setSelectedSupplier(supplier);
    setIsEditing(true);

    setForm({
      id: supplier.id || supplier.supplier_id,
      supplier_id: supplier.supplier_id,
      supplier_code: supplier.supplier_code,
      supplier_name: supplier.supplier_name,
      supplier_type: supplier.supplier_type || 'UMUM',
      branch_id: supplier.branch_id,
      nomor_telepon: supplier.nomor_telepon,
      email: supplier.email,
      alamat: supplier.alamat,
      kota: supplier.kota,
      provinsi: supplier.provinsi,
      nama_pic: supplier.nama_pic,
      nomor_pic: supplier.nomor_pic,
      status: supplier.status === 'SOFT_DELETED' ? 'NON_ACTIVE' : supplier.status || 'ACTIVE',
      termin_hari: String(supplier.termin_hari || ''),
      limit_hutang: String(supplier.limit_hutang || ''),
      metode_pembayaran_default: supplier.metode_pembayaran_default || 'TRANSFER',
      bank: supplier.bank,
      nomor_rekening: supplier.nomor_rekening,
      atas_nama_rekening: supplier.atas_nama_rekening,
      notes: supplier.notes,
    });
  };

  const validateForm = () => {
    const warnings = [];

    if (!form.supplier_id.trim()) warnings.push('Supplier ID wajib diisi.');
    if (!form.supplier_code.trim()) warnings.push('Supplier Code wajib diisi.');
    if (!form.supplier_name.trim()) warnings.push('Nama supplier wajib diisi.');
    if (!form.supplier_type.trim()) warnings.push('Tipe supplier wajib dipilih.');
    if (!form.branch_id.trim()) warnings.push('Branch ID wajib dipilih. Supplier tidak boleh orphan.');
    if (!form.status.trim()) warnings.push('Status supplier wajib dipilih.');
    if (!form.metode_pembayaran_default.trim()) warnings.push('Metode pembayaran default wajib dipilih.');

    const branchExists = branchRecords.some((branch) => {
      return branch.branch_id === form.branch_id && !branch.isDeleted;
    });

    if (form.branch_id && !branchExists) {
      warnings.push('Branch ID tidak ditemukan di Master Cabang. Supplier wajib terhubung ke cabang resmi.');
    }

    if (!isOwnerMode && userBranchId && form.branch_id !== userBranchId) {
      warnings.push('User cabang hanya boleh membuat/mengedit supplier di branch miliknya.');
    }

    if (toNumber(form.limit_hutang) < 0) {
      warnings.push('Limit hutang tidak boleh negatif.');
    }

    if (toNumber(form.termin_hari) < 0) {
      warnings.push('Termin hari tidak boleh negatif.');
    }

    if (form.metode_pembayaran_default === 'TRANSFER') {
      if (!form.bank.trim()) warnings.push('Bank wajib diisi untuk metode TRANSFER.');
      if (!form.nomor_rekening.trim()) warnings.push('Nomor rekening wajib diisi untuk metode TRANSFER.');
      if (!form.atas_nama_rekening.trim()) warnings.push('Atas nama rekening wajib diisi untuk metode TRANSFER.');
    }

    const targetId = normalizeCode(form.supplier_id);
    const targetCode = normalizeCode(form.supplier_code);
    const targetBranch = form.branch_id;

    const duplicateId = supplierRecords.find((supplier) => {
      if (isEditing && supplier.supplier_id === selectedSupplier?.supplier_id) return false;
      if (supplier.isDeleted) return false;
      return normalizeCode(supplier.supplier_id) === targetId && supplier.branch_id === targetBranch;
    });

    const duplicateCode = supplierRecords.find((supplier) => {
      if (isEditing && supplier.supplier_id === selectedSupplier?.supplier_id) return false;
      if (supplier.isDeleted) return false;
      return normalizeCode(supplier.supplier_code) === targetCode && supplier.branch_id === targetBranch;
    });

    if (duplicateId) warnings.push(`Supplier ID sudah dipakai oleh ${duplicateId.supplier_name} di cabang yang sama.`);
    if (duplicateCode) warnings.push(`Supplier Code sudah dipakai oleh ${duplicateCode.supplier_name} di cabang yang sama.`);

    return warnings;
  };

  const createPayload = (override = {}) => {
    const supplierId = String(form.supplier_id || selectedSupplier?.supplier_id || generateId('SUP', todayStr)).trim();
    const now = new Date().toISOString();
    const status = normalizeCode(form.status);

    return {
      ...(selectedSupplier?.raw || {}),

      id: selectedSupplier?.id || supplierId,
      date: selectedSupplier?.date || todayStr,

      supplier_id: supplierId,
      supplier_code: normalizeCode(form.supplier_code || supplierId),
      supplier_name: normalizeText(form.supplier_name),
      supplier_type: normalizeCode(form.supplier_type),

      branch_id: normalizeCode(form.branch_id),

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

      nama_pic: form.nama_pic.trim(),
      pic: form.nama_pic.trim(),
      pic_name: form.nama_pic.trim(),

      nomor_pic: form.nomor_pic.trim(),
      pic_phone: form.nomor_pic.trim(),

      status,
      supplier_status: status,
      status_active: status === 'ACTIVE',
      is_active: status === 'ACTIVE',
      isDeleted: false,

      termin_hari: toNumber(form.termin_hari),
      term_days: toNumber(form.termin_hari),

      limit_hutang: roundMoney(form.limit_hutang),
      credit_limit: roundMoney(form.limit_hutang),
      payable_limit: roundMoney(form.limit_hutang),

      metode_pembayaran_default: normalizeCode(form.metode_pembayaran_default),
      default_payment_method: normalizeCode(form.metode_pembayaran_default),

      bank: form.bank.trim(),
      bank_name: form.bank.trim(),

      nomor_rekening: form.nomor_rekening.trim(),
      account_number: form.nomor_rekening.trim(),

      atas_nama_rekening: form.atas_nama_rekening.trim(),
      account_name: form.atas_nama_rekening.trim(),

      notes: form.notes.trim(),
      keterangan: form.notes.trim(),

      created_at: selectedSupplier?.raw?.created_at || now,
      created_by: selectedSupplier?.raw?.created_by || user?.name || user?.email || 'SYSTEM',
      updated_at: now,
      updated_by: user?.name || user?.email || 'SYSTEM',

      ...override,
    };
  };

  const persistSupplier = async (action, payload) => {
    if (typeof sendToSheet !== 'function') {
      notify('sendToSheet belum tersedia. Data supplier belum bisa disimpan ke cloud.', 'error');
      return false;
    }

    let isSuccess = false;

    try {
      isSuccess = await sendToSheet(action, SUPPLIER_TABLE_NAME, payload);
    } catch (error) {
      isSuccess = false;
    }

    if (!isSuccess) {
      try {
        isSuccess = await sendToSheet(action, payload, SUPPLIER_TABLE_NAME);
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

    const isSuccess = await persistSupplier(action, payload);

    if (isSuccess) {
      notify(isEditing ? 'Master supplier berhasil diperbarui.' : 'Supplier baru berhasil ditambahkan.', 'success');
      resetForm();
    }
  };

  const handleToggleStatus = async (supplier) => {
    const nextStatus = supplier.status === 'ACTIVE' ? 'NON_ACTIVE' : 'ACTIVE';

    const confirmed = window.confirm(
      `${nextStatus === 'NON_ACTIVE' ? 'Nonaktifkan' : 'Aktifkan ulang'} supplier ${supplier.supplier_name}?`,
    );

    if (!confirmed) return;

    const payload = {
      ...(supplier.raw || {}),
      id: supplier.id || supplier.supplier_id,
      supplier_id: supplier.supplier_id,
      supplier_status: nextStatus,
      status: nextStatus,
      status_active: nextStatus === 'ACTIVE',
      is_active: nextStatus === 'ACTIVE',
      isDeleted: false,
      updated_at: new Date().toISOString(),
      updated_by: user?.name || user?.email || 'SYSTEM',
    };

    const isSuccess = await persistSupplier('update', payload);

    if (isSuccess) {
      notify(nextStatus === 'ACTIVE' ? 'Supplier berhasil diaktifkan ulang.' : 'Supplier berhasil dinonaktifkan.', 'success');
    }
  };

  const handleSoftDelete = async (supplier) => {
    const confirmed = window.confirm(
      `Soft delete supplier ${supplier.supplier_name}? Data tidak dihapus permanen, hanya disembunyikan dari transaksi aktif.`,
    );

    if (!confirmed) return;

    const payload = {
      ...(supplier.raw || {}),
      id: supplier.id || supplier.supplier_id,
      supplier_id: supplier.supplier_id,
      supplier_status: 'NON_ACTIVE',
      status: 'NON_ACTIVE',
      status_active: false,
      is_active: false,
      isDeleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: user?.name || user?.email || 'SYSTEM',
      updated_at: new Date().toISOString(),
      updated_by: user?.name || user?.email || 'SYSTEM',
    };

    const isSuccess = await persistSupplier('update', payload);

    if (isSuccess) {
      notify('Supplier berhasil di-soft delete.', 'success');
      if (selectedSupplier?.supplier_id === supplier.supplier_id) resetForm();
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
                <Truck size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">
                Master Supplier ERP
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">
              Pusat Data Supplier Dimsum Aditya
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-300">
              Seluruh pembelian wajib berasal dari supplier resmi agar stok, modal, hutang, dan histori harga terpisah per cabang.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">{isOwnerMode ? 'Owner Mode Lintas Cabang' : 'Branch Mode'}</Badge>
            <Badge tone="amber">Price History Ready</Badge>
            <Badge tone="green">Supplier Ledger Ready</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Supplier" value={analytics.total} icon={<Truck size={18} />} tone="white" />
        <StatCard title="Aktif" value={analytics.active} icon={<CheckCircle size={18} />} tone="red" />
        <StatCard title="Total Pembelian" value={formatMoney(analytics.total_pembelian)} icon={<ReceiptText size={18} />} tone="gold" />
        <StatCard title="Total Hutang" value={formatMoney(analytics.total_hutang)} icon={<WalletCards size={18} />} tone="white" />
        <StatCard title="Total Bayar" value={formatMoney(analytics.total_pembayaran)} icon={<BadgeDollarSign size={18} />} tone="dark" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-red-50 p-3 text-red-600">
              <Crown size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Supplier Favorit</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.favorite_supplier?.supplier_name || '-'}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                Score {formatMoney(analytics.favorite_supplier?.metrics?.supplier_score || 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
              <TrendingUp size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Top Purchase Supplier</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.top_purchase_supplier?.supplier_name || '-'}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                Pembelian {formatMoney(analytics.top_purchase_supplier?.metrics?.total_pembelian || 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <CalendarClock size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Supplier Terakhir Digunakan</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {analytics.last_used_supplier?.supplier_name || '-'}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                {analytics.last_used_supplier?.metrics?.last_purchase_date
                  ? formatDate(analytics.last_used_supplier.metrics.last_purchase_date)
                  : '-'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {analytics.ranking_supplier.length > 0 && (
        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
                <Star size={17} className="text-amber-500" />
                Ranking Supplier
              </h2>
              <p className="mt-1 text-[11px] font-semibold text-slate-400">
                Ranking dihitung dari pembelian, hutang, transaksi, dan histori penggunaan.
              </p>
            </div>
            <Badge tone="amber">Top 5</Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
            {analytics.ranking_supplier.map((supplier, index) => (
              <div key={supplier.supplier_id || supplier.id} className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={index === 0 ? 'red' : 'slate'}>#{index + 1}</Badge>
                  <div className="text-[10px] font-black text-slate-400">{supplier.supplier_type}</div>
                </div>
                <div className="mt-3 line-clamp-1 text-sm font-black text-slate-900">
                  {supplier.supplier_name}
                </div>
                <div className="mt-1 text-[11px] font-bold text-slate-500">
                  {formatMoney(supplier.metrics.total_pembelian)}
                </div>
                <div className="mt-2 text-[10px] font-bold text-slate-400">
                  {supplier.metrics.total_transaksi} transaksi
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
                  {isEditing ? <Edit2 size={16} className="text-red-600" /> : <Plus size={16} className="text-red-600" />}
                  {isEditing ? 'Edit Supplier' : 'Tambah Supplier'}
                </h2>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  Supplier resmi untuk purchase, stok, modal, dan hutang.
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
                <Field label="Supplier ID" required>
                  <div className="flex gap-2">
                    <input
                      disabled={isEditing}
                      value={form.supplier_id}
                      onChange={(event) => setForm({ ...form, supplier_id: normalizeCode(event.target.value), id: normalizeCode(event.target.value) })}
                      className={inputClass}
                      placeholder="SUP-001"
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

                <Field label="Supplier Code" required>
                  <input
                    value={form.supplier_code}
                    onChange={(event) => setForm({ ...form, supplier_code: normalizeCode(event.target.value) })}
                    className={inputClass}
                    placeholder="SUP-AYAM-001"
                  />
                </Field>
              </div>

              <Field label="Nama Supplier" required>
                <input
                  value={form.supplier_name}
                  onChange={(event) => setForm({ ...form, supplier_name: event.target.value })}
                  className={inputClass}
                  placeholder="Nama supplier"
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
                    Master Cabang belum tersedia. Tambahkan cabang dulu agar supplier tidak orphan.
                  </div>
                )}
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Supplier Type" required>
                  <select
                    value={form.supplier_type}
                    onChange={(event) => setForm({ ...form, supplier_type: event.target.value })}
                    className={inputClass}
                  >
                    {SUPPLIER_TYPES.map((type) => (
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
                    {SUPPLIER_STATUS.map((status) => (
                      <option key={status} value={status}>{status}</option>
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
                    placeholder="supplier@email.com"
                  />
                </Field>
              </div>

              <Field label="Alamat">
                <textarea
                  value={form.alamat}
                  onChange={(event) => setForm({ ...form, alamat: event.target.value })}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Alamat supplier..."
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
                <Field label="Nama PIC">
                  <input
                    value={form.nama_pic}
                    onChange={(event) => setForm({ ...form, nama_pic: event.target.value })}
                    className={inputClass}
                    placeholder="Nama PIC"
                  />
                </Field>

                <Field label="Nomor PIC">
                  <input
                    value={form.nomor_pic}
                    onChange={(event) => setForm({ ...form, nomor_pic: event.target.value })}
                    className={inputClass}
                    placeholder="08xxxxxxxxxx"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Termin Hari">
                  <input
                    value={form.termin_hari}
                    onChange={(event) => setForm({ ...form, termin_hari: event.target.value })}
                    className={inputClass}
                    placeholder="0"
                  />
                </Field>

                <Field label="Limit Hutang">
                  <input
                    value={form.limit_hutang}
                    onChange={(event) => setForm({ ...form, limit_hutang: event.target.value })}
                    className={inputClass}
                    placeholder="0"
                  />
                </Field>
              </div>

              <Field label="Metode Pembayaran Default" required>
                <select
                  value={form.metode_pembayaran_default}
                  onChange={(event) => setForm({ ...form, metode_pembayaran_default: event.target.value })}
                  className={inputClass}
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Bank">
                  <input
                    value={form.bank}
                    onChange={(event) => setForm({ ...form, bank: event.target.value })}
                    className={inputClass}
                    placeholder="BCA / BRI / Mandiri"
                  />
                </Field>

                <Field label="Nomor Rekening">
                  <input
                    value={form.nomor_rekening}
                    onChange={(event) => setForm({ ...form, nomor_rekening: event.target.value })}
                    className={inputClass}
                    placeholder="0000000000"
                  />
                </Field>
              </div>

              <Field label="Atas Nama Rekening">
                <input
                  value={form.atas_nama_rekening}
                  onChange={(event) => setForm({ ...form, atas_nama_rekening: event.target.value })}
                  className={inputClass}
                  placeholder="Nama pemilik rekening"
                />
              </Field>

              <Field label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Catatan supplier..."
                />
              </Field>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-sm transition-all hover:bg-red-700"
              >
                <Save size={16} />
                {isEditing ? 'Simpan Perubahan' : 'Tambah Supplier'}
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
                    Daftar Supplier Resmi
                  </h2>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    Supplier resmi untuk Purchase, Hutang, Inventory Cost Layer, dan HPP.
                  </p>
                </div>

                <div className="flex flex-col gap-2 2xl:flex-row">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-xs font-bold outline-none transition-all placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50 md:w-64"
                      placeholder="Cari supplier, kode, PIC, telepon..."
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
                      {SUPPLIER_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1420px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Supplier</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cabang</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Kontak</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pembayaran</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Analytics</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Harga</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Status</th>
                    <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSuppliers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-14 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-red-50 text-red-600">
                          <Truck size={24} />
                        </div>
                        <div className="mt-3 text-sm font-black text-slate-800">Supplier tidak ditemukan</div>
                        <div className="mt-1 text-xs font-semibold text-slate-400">
                          Ubah filter atau tambahkan supplier baru.
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredSuppliers.map((supplier) => {
                    const isDeleted = supplier.isDeleted || supplier.status === 'SOFT_DELETED';
                    const isActive = supplier.status === 'ACTIVE' && !isDeleted;
                    const branchName = branchNameById.get(supplier.branch_id) || 'Branch tidak ditemukan';
                    const isOrphan = !branchNameById.has(supplier.branch_id);
                    const payableOverLimit = supplier.limit_hutang > 0 && supplier.metrics.total_hutang > supplier.limit_hutang;

                    return (
                      <tr key={`${supplier.supplier_id}-${supplier.supplier_code}`} className="border-b border-slate-100 transition-colors hover:bg-red-50/30">
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isActive ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              {getSupplierTypeIcon(supplier.supplier_type)}
                            </div>
                            <div>
                              <div className="font-black text-slate-900">{supplier.supplier_name || '-'}</div>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                <Badge tone="slate">{supplier.supplier_id || '-'}</Badge>
                                <Badge tone="amber">{supplier.supplier_code || '-'}</Badge>
                              </div>
                              <div className="mt-2">
                                <Badge tone={supplier.supplier_type === 'AYAM' ? 'red' : supplier.supplier_type === 'PACKAGING' ? 'purple' : 'slate'}>
                                  {supplier.supplier_type || '-'}
                                </Badge>
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
                                {supplier.branch_id || '-'}
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
                          <div className="space-y-1.5 text-[11px] font-bold text-slate-600">
                            <div className="flex items-center gap-2">
                              <User size={13} className="text-slate-400" />
                              {supplier.nama_pic || '-'}
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone size={13} className="text-slate-400" />
                              {supplier.nomor_telepon || supplier.nomor_pic || '-'}
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail size={13} className="text-slate-400" />
                              {supplier.email || '-'}
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin size={13} className="text-slate-400" />
                              {supplier.kota || '-'}{supplier.provinsi ? `, ${supplier.provinsi}` : ''}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex items-center gap-2 text-xs font-black text-slate-900">
                            {getPaymentMethodIcon(supplier.metode_pembayaran_default)}
                            {supplier.metode_pembayaran_default || '-'}
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-slate-500">
                            <Landmark size={13} className="text-slate-400" />
                            {supplier.bank || '-'}
                          </div>
                          <div className="mt-1 max-w-[180px] truncate text-[11px] font-semibold text-slate-400">
                            {supplier.nomor_rekening || '-'} — {supplier.atas_nama_rekening || '-'}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-bold">
                            <div className="text-slate-400">Transaksi</div>
                            <div className="text-right text-slate-900">{supplier.metrics.total_transaksi}</div>

                            <div className="text-slate-400">Pembelian</div>
                            <div className="text-right text-slate-900">{formatMoney(supplier.metrics.total_pembelian)}</div>

                            <div className="text-slate-400">Bayar</div>
                            <div className="text-right text-emerald-700">{formatMoney(supplier.metrics.total_pembayaran)}</div>

                            <div className="text-slate-400">Hutang</div>
                            <div className={`text-right ${payableOverLimit ? 'text-red-600' : 'text-slate-900'}`}>
                              {formatMoney(supplier.metrics.total_hutang)}
                            </div>

                            <div className="text-slate-400">Last</div>
                            <div className="text-right text-slate-900">
                              {supplier.metrics.last_purchase_date ? formatDate(supplier.metrics.last_purchase_date) : '-'}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="space-y-1.5 text-[11px] font-bold">
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-slate-400">
                                <History size={12} />
                                Histori
                              </span>
                              <span className="text-slate-900">{supplier.metrics.price_history_count}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-slate-400">
                                <ArrowUpDown size={12} />
                                Perubahan
                              </span>
                              <span className={supplier.metrics.price_change_count > 0 ? 'text-amber-700' : 'text-slate-900'}>
                                {supplier.metrics.price_change_count}
                              </span>
                            </div>
                            <div className="mt-2 max-w-[210px] rounded-2xl bg-slate-50 px-3 py-2">
                              <div className="truncate text-[10px] font-black text-slate-500">
                                {supplier.metrics.latest_item?.item_name || 'Belum ada histori harga'}
                              </div>
                              <div className="mt-0.5 text-xs font-black text-slate-900">
                                {supplier.metrics.latest_item
                                  ? formatMoney(supplier.metrics.latest_item.last_price)
                                  : '-'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <Badge tone={isDeleted ? 'dark' : isActive ? 'green' : 'amber'}>
                            {isDeleted ? 'SOFT_DELETED' : supplier.status}
                          </Badge>
                          <div className="mt-2 text-[11px] font-semibold text-slate-400">
                            Termin {supplier.termin_hari || 0} hari
                          </div>
                          <div className={`mt-1 text-[11px] font-black ${payableOverLimit ? 'text-red-600' : 'text-slate-400'}`}>
                            Limit {formatMoney(supplier.limit_hutang)}
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex justify-end gap-2">
                            {!isDeleted && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(supplier)}
                                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                                  title="Edit supplier"
                                >
                                  <Edit2 size={15} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(supplier)}
                                  className={`rounded-xl border p-2 transition-all ${
                                    isActive
                                      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  }`}
                                  title={isActive ? 'Nonaktifkan supplier' : 'Aktifkan supplier'}
                                >
                                  {isActive ? <Power size={15} /> : <RotateCcw size={15} />}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSoftDelete(supplier)}
                                  className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100"
                                  title="Soft delete supplier"
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
                Menampilkan <span className="text-slate-800">{filteredSuppliers.length}</span> dari <span className="text-slate-800">{supplierRecords.length}</span> data supplier.
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge tone="red">Merah = Aktif / Supplier Kunci</Badge>
                <Badge tone="amber">Gold = Price Change / Warning</Badge>
                <Badge tone="purple">Packaging / Kategori Khusus</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
