import React from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Building,
  Calculator,
  ClipboardList,
  Clock,
  Database,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';

// ======================================================
// ICON COMPATIBILITY
// Project lama pakai lucide-react versi lama.
// Alias ini menjaga UI tetap build tanpa ganti dependency.
// ======================================================
const Boxes = Package;
const BriefcaseBusiness = Briefcase;
const Building2 = Building;
const Clock3 = Clock;
const Crown = Users;
const Factory = Building;
const HandCoins = Wallet;
const Landmark = Building;
const Radar = BarChart3;
const ReceiptText = FileText;
const Scale = Calculator;
const Warehouse = Store;

const OWNER_ROLE_GROUP = new Set([
  'OWNER',
  'DEWA',
  'MONITOR_DEWA',
  'HO_TANGERANG',
  'SUPER_ADMIN',
  'SUPERADMIN',
]);

const HQ_ROLE_GROUP = new Set([
  'OWNER',
  'DEWA',
  'MONITOR_DEWA',
  'HO_TANGERANG',
  'SUPER_ADMIN',
  'SUPERADMIN',
  'ADMIN_PUSAT',
  'HQ',
  'HQ_ADMIN',
  'FINANCE',
  'ACCOUNTING',
]);

const FINANCE_ROLE_GROUP = new Set([
  'OWNER',
  'DEWA',
  'HO_TANGERANG',
  'SUPER_ADMIN',
  'SUPERADMIN',
  'FINANCE',
  'ACCOUNTING',
  'KASIR_HQ',
  'ADMIN_PUSAT',
]);

const WAREHOUSE_ROLE_GROUP = new Set([
  'OWNER',
  'DEWA',
  'HO_TANGERANG',
  'SUPER_ADMIN',
  'SUPERADMIN',
  'GUDANG',
  'WAREHOUSE',
  'STOCK',
  'STOK',
  'ADMIN_GUDANG',
]);

const PRODUCTION_ROLE_GROUP = new Set([
  'OWNER',
  'DEWA',
  'HO_TANGERANG',
  'SUPER_ADMIN',
  'SUPERADMIN',
  'PRODUCTION',
  'PRODUKSI',
  'DAPUR',
  'ADMIN_PRODUKSI',
]);

const SALES_ROLE_GROUP = new Set([
  'OWNER',
  'DEWA',
  'HO_TANGERANG',
  'SUPER_ADMIN',
  'SUPERADMIN',
  'SALES',
  'KASIR',
  'CASHIER',
  'ADMIN_SALES',
  'CABANG',
]);

const HRD_ROLE_GROUP = new Set([
  'OWNER',
  'DEWA',
  'HO_TANGERANG',
  'SUPER_ADMIN',
  'SUPERADMIN',
  'HRD',
  'HR',
  'ADMIN_HRD',
  'ADMIN_SDM',
]);

const normalizeCode = (value) => {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^\w./-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const getRoleCode = (user = {}) => {
  return normalizeCode(
    user.role ||
      user.user_role ||
      user.userRole ||
      user.access_role ||
      user.accessRole ||
      user.position ||
      user.level ||
      '',
  );
};

const getBranchTypeCode = (user = {}) => {
  return normalizeCode(user.branch_type || user.branchType || '');
};

const getBranchIdCode = (user = {}) => {
  return normalizeCode(user.branch_id || user.branchId || user.location_id || '');
};

const isOwnerUser = (user = {}) => {
  const role = getRoleCode(user);
  const branchId = getBranchIdCode(user);
  return OWNER_ROLE_GROUP.has(role) || branchId === 'HO_TANGERANG' || branchId === 'LOC_TGR';
};

const isHQUser = (user = {}) => {
  const role = getRoleCode(user);
  const branchType = getBranchTypeCode(user);
  const branchId = getBranchIdCode(user);

  return (
    isOwnerUser(user) ||
    HQ_ROLE_GROUP.has(role) ||
    branchType === 'HQ_FACTORY' ||
    branchType === 'HQ' ||
    branchId === 'PUSAT' ||
    branchId === 'TANGERANG_PUSAT' ||
    branchId === 'LOC_TGR'
  );
};

const isBranchUser = (user = {}) => Boolean(user) && !isHQUser(user);
const isFinanceUser = (user = {}) => isHQUser(user) || FINANCE_ROLE_GROUP.has(getRoleCode(user));
const isWarehouseUser = (user = {}) => isHQUser(user) || WAREHOUSE_ROLE_GROUP.has(getRoleCode(user));

const isProductionUser = (user = {}) => {
  const role = getRoleCode(user);
  const branchType = getBranchTypeCode(user);
  const branchId = getBranchIdCode(user);

  return (
    isHQUser(user) ||
    PRODUCTION_ROLE_GROUP.has(role) ||
    branchType === 'PRODUCTION_BRANCH' ||
    branchId.includes('PEMALANG')
  );
};

const isSalesUser = (user = {}) => isHQUser(user) || isBranchUser(user) || SALES_ROLE_GROUP.has(getRoleCode(user));
const isHrdUser = (user = {}) => isHQUser(user) || HRD_ROLE_GROUP.has(getRoleCode(user));

const canSeeMasterData = (user = {}) => isHQUser(user) || isOwnerUser(user);
const canSeePurchase = (user = {}) => isHQUser(user) || isOwnerUser(user);
const canSeeProduction = (user = {}) => isProductionUser(user);
const canSeeInventory = (user = {}) => isWarehouseUser(user) || isProductionUser(user) || isOwnerUser(user);
const canSeeFinance = (user = {}) => isFinanceUser(user);
const canSeePiutang = (user = {}) => isFinanceUser(user) || isSalesUser(user);
const canSeeHrdCore = (user = {}) => isHrdUser(user);
const canSeeHrdBranch = (user = {}) => isHrdUser(user) || isBranchUser(user);
const canSeeOwner = (user = {}) => isOwnerUser(user);
const canSeeAudit = (user = {}) => isOwnerUser(user) || isHQUser(user);

const MENU_GROUPS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    visible: () => true,
    items: [
      { id: 'dashboard', label: 'Dashboard Pusat', icon: LayoutDashboard, visible: (user) => isHQUser(user) || isOwnerUser(user) },
      { id: 'dashboard_branch', label: 'Dashboard Cabang', icon: Store, visible: () => true },
      { id: 'monitoring_cabang', label: 'Monitoring Cabang', icon: Radar, visible: canSeeOwner },
      { id: 'setoran_cabang', label: 'Validasi Setoran', icon: ClipboardList, visible: canSeeOwner },
    ],
  },
  {
    id: 'master_data',
    label: 'Master Data',
    visible: canSeeMasterData,
    items: [
      { id: 'master_cabang', label: 'Master Cabang', icon: Building2, visible: canSeeMasterData },
      { id: 'master_gudang', label: 'Master Gudang', icon: Warehouse, visible: canSeeMasterData },
      { id: 'master_produk', label: 'Master Produk', icon: Package, visible: canSeeMasterData },
      { id: 'master_supplier', label: 'Master Supplier', icon: Truck, visible: canSeeMasterData },
      { id: 'master_bahan_baku', label: 'Master Bahan Baku', icon: Boxes, visible: canSeeMasterData },
      { id: 'master_konversi', label: 'Master Konversi', icon: Calculator, visible: canSeeMasterData },
      { id: 'master_resep_bom', label: 'Master Resep BOM', icon: ClipboardList, visible: canSeeMasterData },
      { id: 'master_pelanggan', label: 'Master Pelanggan', icon: Users, visible: canSeeMasterData },
    ],
  },
  {
    id: 'operasional',
    label: 'Operasional',
    visible: () => true,
    items: [
      // ID sengaja memakai case lama yang sudah ada di App.jsx.
      { id: 'orders', label: 'Kasir / Order', icon: ShoppingCart, visible: isSalesUser },
      { id: 'antrian_po', label: 'Antrian PO', icon: ClipboardList, visible: isSalesUser },
      { id: 'purchases', label: 'Purchase', icon: ReceiptText, visible: canSeePurchase },
      { id: 'expenses', label: 'Belanja & Kas Keluar', icon: Wallet, visible: canSeeFinance },
      { id: 'pemalang', label: 'Produksi Pemalang', icon: Factory, visible: canSeeProduction },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    visible: canSeeInventory,
    items: [
      { id: 'stok', label: 'Stok', icon: Database, visible: canSeeInventory },
      { id: 'kartu_stok', label: 'Kartu Stok', icon: BookOpen, visible: canSeeInventory },
    ],
  },
  {
    id: 'keuangan',
    label: 'Keuangan',
    visible: (user) => canSeeFinance(user) || canSeePiutang(user),
    items: [
      { id: 'kas_bank', label: 'Kas Bank', icon: Wallet, visible: canSeeFinance },
      { id: 'piutang', label: 'Piutang', icon: Landmark, visible: canSeePiutang },
      { id: 'hutang_supplier', label: 'Hutang Supplier', icon: ReceiptText, visible: canSeeFinance },
      { id: 'accounting', label: 'Accounting', icon: Scale, visible: canSeeFinance },
      { id: 'kewajiban', label: 'Kewajiban', icon: HandCoins, visible: canSeeFinance },
    ],
  },
  {
    id: 'hrd',
    label: 'HRD',
    visible: (user) => canSeeHrdCore(user) || canSeeHrdBranch(user),
    items: [
      { id: 'karyawan', label: 'HRD Center', icon: BriefcaseBusiness, visible: canSeeHrdCore },
      { id: 'hrd_master_sdm', label: 'Master SDM', icon: Users, visible: canSeeHrdCore },
      { id: 'hrd_payroll', label: 'Payroll', icon: Wallet, visible: canSeeHrdCore },
      { id: 'hrd_lembur', label: 'Lembur', icon: Clock3, visible: canSeeHrdBranch },
      { id: 'hrd_kasbon', label: 'Kasbon', icon: HandCoins, visible: canSeeHrdBranch },
    ],
  },
  {
    id: 'owner',
    label: 'Owner',
    visible: canSeeOwner,
    items: [
      { id: 'profit_owner', label: 'Profit Owner', icon: Crown, visible: canSeeOwner },
      { id: 'business_radar', label: 'Business Radar', icon: Radar, visible: canSeeOwner },
      { id: 'notification_center', label: 'Notification Center', icon: Bell, visible: canSeeOwner },
    ],
  },
  {
    id: 'audit',
    label: 'Audit',
    visible: canSeeAudit,
    items: [
      { id: 'accounting_audit', label: 'Accounting Audit', icon: History, visible: canSeeAudit },
    ],
  },
];

const getVisibleMenuGroups = (user = {}) => {
  return MENU_GROUPS
    .filter((group) => group.visible(user))
    .map((group) => ({ ...group, items: group.items.filter((item) => item.visible(user)) }))
    .filter((group) => group.items.length > 0);
};

const NavButton = ({ item, activeTab, onClick }) => {
  const Icon = item.icon;
  const isActive = activeTab === item.id;

  return (
    <button
      type="button"
      onClick={() => onClick(item.id)}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-all normal-case ${
        isActive
          ? 'border-red-100/60 bg-red-50 text-red-600 shadow-sm'
          : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <Icon size={16} className={isActive ? 'text-red-600' : 'text-slate-400'} />
      <span className="truncate">{item.label}</span>
    </button>
  );
};

export default function LayoutEngine({ children, activeTab, setActiveTab, user, handleLogout }) {
  const userName = user?.name || user?.full_name || user?.username || 'ADMIN';
  const userRole = getRoleCode(user) || 'USER';
  const branchType = getBranchTypeCode(user) || 'BRANCH';
  const branchId = getBranchIdCode(user) || 'PUSAT';
  const branchName = branchId === 'PUSAT' ? 'TANGERANG PUSAT' : branchId.replace(/_/g, ' ');
  const visibleMenuGroups = getVisibleMenuGroups(user);

  const handleTabChange = (tabId) => {
    if (typeof setActiveTab === 'function') setActiveTab(tabId);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-800 antialiased">
      <aside className="z-20 flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white shadow-xs">
        <div className="flex shrink-0 flex-col items-center justify-center border-b border-slate-200/50 bg-white p-5">
          <img
            src="https://dimsumaditya.id/wp-content/uploads/2026/06/Dimsum-Aditya-New-Logo-scaled.webp"
            alt="Dimsum Aditya ERP"
            className="h-12 w-auto object-contain drop-shadow-sm transition-transform hover:scale-105"
          />
          <div className="mt-2 text-[8px] font-black uppercase tracking-widest text-slate-400">
            Enterprise Core System
          </div>
        </div>

        <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-4 py-6">
          {visibleMenuGroups.map((group) => (
            <div key={group.id} className="space-y-1">
              <span className="mb-2 block px-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
                {group.label}
              </span>

              {group.items.map((item) => (
                <NavButton key={item.id} item={item} activeTab={activeTab} onClick={handleTabChange} />
              ))}
            </div>
          ))}
        </div>

        <div className="shrink-0 space-y-3 border-t border-slate-100 bg-slate-50/50 p-4">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white p-2 shadow-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-600 text-sm font-black text-white shadow-inner">
              {String(userName || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-xs font-black uppercase tracking-tight text-slate-800">{userName}</h4>
              <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-wider text-slate-400">
                {userRole.replace(/_/g, ' ')}
              </p>
              <p className="mt-0.5 truncate text-[8px] font-black uppercase tracking-wider text-slate-300">
                {branchType.replace(/_/g, ' ')} · {branchName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent px-3 py-2.5 text-xs font-bold text-slate-500 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-600 normal-case shadow-3xs"
          >
            <LogOut size={14} />
            Keluar Aplikasi
          </button>
        </div>
      </aside>

      <main className="custom-scrollbar relative h-full flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
