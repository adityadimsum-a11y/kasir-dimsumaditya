import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';

import { safeJsonParse, generateRequestId } from './utils/helpers';

import LayoutEngine from './layouts/LayoutEngine';
import PrintDotMatrix from './components/PrintDotMatrix';

import TabDashboard from './components/tabs/TabDashboard';
import TabDashboardBranch from './components/tabs/TabDashboardBranch';

import TabMasterCabang from './components/tabs/TabMasterCabang';
import TabMasterGudang from './components/tabs/TabMasterGudang';
import TabMasterProduk from './components/tabs/TabMasterProduk';
import TabMasterSupplier from './components/tabs/TabMasterSupplier';
import TabMasterBahanBaku from './components/tabs/TabMasterBahanBaku';
import TabMasterKonversi from './components/tabs/TabMasterKonversi';
import TabMasterResepBOM from './components/tabs/TabMasterResepBOM';
import TabMasterPelanggan from './components/tabs/TabMasterPelanggan';

import TabPurchase from './components/tabs/TabPurchase';
import TabProduction from './components/tabs/TabProduction';
import TabSales from './components/tabs/TabSales';

import TabStok from './components/tabs/TabStok';
import TabKartuStok from './components/tabs/TabKartuStok';

import TabKasBank from './components/tabs/TabKasBank';
import TabPiutang from './components/tabs/TabPiutang';
import TabHutangSupplier from './components/tabs/TabHutangSupplier';
import TabAccounting from './components/tabs/TabAccounting';
import TabKewajiban from './components/tabs/TabKewajiban';

import TabKaryawan from './components/tabs/TabKaryawan';

import TabDashboardProfitOwner from './components/tabs/TabDashboardProfitOwner';
import TabExecutiveDashboard from './components/tabs/TabExecutiveDashboard';
import TabBusinessRadar from './components/tabs/TabBusinessRadar';
import TabNotificationCenter from './components/tabs/TabNotificationCenter';

import TabAccountingAudit from './components/tabs/TabAccountingAudit';

// HIDE + LEGACY. Tidak tampil di menu. Dipertahankan untuk pembanding/testing.
import TabProfitOwner from './components/tabs/TabProfitOwner';
import TabOrders from './components/tabs/TabOrders';
import TabAntrianPO from './components/tabs/TabAntrianPO';
import TabPurchases from './components/tabs/TabPurchases';

const API_URL_GAS = 'https://script.google.com/macros/s/AKfycbybKUYeFHFZ7pV7AvHlbJwUp_RqjSCdO71i2arQ9fAQODKr3AEOJ_m0CCY-X7IkGNg98Q/exec';

const FINAL_TAB_KEYS = new Set([
  'dashboard',
  'dashboard_branch',

  'master_cabang',
  'master_gudang',
  'master_produk',
  'master_supplier',
  'master_bahan_baku',
  'master_konversi',
  'master_resep_bom',
  'master_pelanggan',

  'purchase',
  'production',
  'sales',

  'stok',
  'kartu_stok',

  'kas_bank',
  'piutang',
  'hutang_supplier',
  'accounting',
  'kewajiban',

  'karyawan',
  'hrd_master_sdm',
  'hrd_payroll',
  'hrd_lembur',
  'hrd_kasbon',

  'dashboard_profit_owner',
  'executive_dashboard',
  'business_radar',
  'notification_center',

  'accounting_audit',
]);

const HIDDEN_LEGACY_TAB_KEYS = new Set([
  'profit_owner_legacy',
  'orders_legacy',
  'antrian_po_legacy',
  'purchases_legacy',
]);

const HIDDEN_BACKLOG_TAB_KEYS = new Set([
  'analytics',
  'scm_war_room',
  'supplier_ayam',
  'stok_outlet',
  'discrepancy',
  'distribusi',
  'monitoring_pemalang',
  'monitoring_cabang',
  'expenses',

  'profit_analytics',
  'financial_analytics',
  'cashflow_dashboard',
  'sales_analytics',
  'production_analytics',
  'purchasing_analytics',
  'inventory_analytics',
  'customer_analytics',
  'product_analytics',
  'supplier_analytics',
  'branch_analytics',
  'branch_performance',
  'profit_leakage',
]);

const LEGACY_TAB_ALIASES = Object.freeze({
  orders: 'sales',
  antrian_po: 'sales',
  purchases: 'purchase',
  pemalang: 'production',
  master_customer: 'master_pelanggan',
  master_data: 'master_produk',
  profit_owner: 'dashboard_profit_owner',
  expenses: 'kas_bank',
  setoran_cabang: 'kas_bank',
});

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

const MASTER_TABS = new Set([
  'master_cabang',
  'master_gudang',
  'master_produk',
  'master_supplier',
  'master_bahan_baku',
  'master_konversi',
  'master_resep_bom',
  'master_pelanggan',
]);

const OWNER_TABS = new Set([
  'dashboard_profit_owner',
  'executive_dashboard',
  'business_radar',
  'notification_center',
  'profit_owner_legacy',
]);

const HRD_HQ_TABS = new Set([
  'karyawan',
  'hrd_master_sdm',
  'hrd_payroll',
]);

const HRD_BRANCH_TABS = new Set([
  'hrd_lembur',
  'hrd_kasbon',
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
  return normalizeCode(user.branch_id || user.branchId || '');
};

const isOwnerUser = (user = {}) => {
  const role = getRoleCode(user);
  const branchId = getBranchIdCode(user);
  return OWNER_ROLE_GROUP.has(role) || branchId === 'HO_TANGERANG';
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
    branchId === 'TANGERANG_PUSAT'
  );
};

const isBranchUser = (user = {}) => {
  return Boolean(user) && !isHQUser(user);
};

const isFinanceUser = (user = {}) => {
  const role = getRoleCode(user);
  return isHQUser(user) || FINANCE_ROLE_GROUP.has(role);
};

const isWarehouseUser = (user = {}) => {
  const role = getRoleCode(user);
  return isHQUser(user) || WAREHOUSE_ROLE_GROUP.has(role);
};

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

const isSalesUser = (user = {}) => {
  const role = getRoleCode(user);
  return isHQUser(user) || isBranchUser(user) || SALES_ROLE_GROUP.has(role);
};

const isHrdUser = (user = {}) => {
  const role = getRoleCode(user);
  return isHQUser(user) || HRD_ROLE_GROUP.has(role);
};

const getDefaultTabForUser = (user = {}) => {
  return isHQUser(user) || isOwnerUser(user) ? 'dashboard' : 'dashboard_branch';
};

const normalizeTabKey = (tabKey) => {
  const key = String(tabKey || '').trim();
  return LEGACY_TAB_ALIASES[key] || key;
};

const canAccessTab = (tabKey, user = {}) => {
  if (!user) return false;

  if (tabKey === 'dashboard') return isHQUser(user) || isOwnerUser(user);
  if (tabKey === 'dashboard_branch') return true;

  if (MASTER_TABS.has(tabKey)) return isHQUser(user) || isOwnerUser(user);
  if (OWNER_TABS.has(tabKey)) return isOwnerUser(user);

  if (tabKey === 'purchase') return isHQUser(user) || isOwnerUser(user);
  if (tabKey === 'production') return isProductionUser(user);
  if (tabKey === 'sales') return isSalesUser(user);

  if (tabKey === 'stok') return isWarehouseUser(user) || isProductionUser(user);
  if (tabKey === 'kartu_stok') return isWarehouseUser(user) || isProductionUser(user) || isOwnerUser(user);

  if (tabKey === 'kas_bank') return isFinanceUser(user);
  if (tabKey === 'piutang') return isFinanceUser(user) || isSalesUser(user);
  if (tabKey === 'hutang_supplier') return isFinanceUser(user);
  if (tabKey === 'accounting') return isFinanceUser(user);
  if (tabKey === 'kewajiban') return isFinanceUser(user) || isOwnerUser(user);

  if (HRD_HQ_TABS.has(tabKey)) return isHrdUser(user);
  if (HRD_BRANCH_TABS.has(tabKey)) return isHrdUser(user) || isBranchUser(user);

  if (tabKey === 'accounting_audit') return isOwnerUser(user) || isHQUser(user);

  if (tabKey === 'orders_legacy') return isOwnerUser(user) || isHQUser(user);
  if (tabKey === 'antrian_po_legacy') return isOwnerUser(user) || isHQUser(user);
  if (tabKey === 'purchases_legacy') return isOwnerUser(user) || isHQUser(user);

  return false;
};

const resolveAuthorizedTab = (tabKey, user = {}) => {
  const defaultTab = getDefaultTabForUser(user);
  const normalizedTab = normalizeTabKey(tabKey);

  if (HIDDEN_BACKLOG_TAB_KEYS.has(normalizedTab)) return defaultTab;

  const isFinalTab = FINAL_TAB_KEYS.has(normalizedTab);
  const isHiddenLegacyTab = HIDDEN_LEGACY_TAB_KEYS.has(normalizedTab);

  if (!isFinalTab && !isHiddenLegacyTab) return defaultTab;
  if (!canAccessTab(normalizedTab, user)) return defaultTab;

  return normalizedTab;
};

const ToastNotification = ({ toast, onClose }) => {
  if (!toast) return null;

  return (
    <div className={`fixed right-4 top-4 z-[9999] flex items-center gap-3 rounded-xl border px-5 py-3.5 text-xs font-bold shadow-lg duration-200 animate-in slide-in-from-top-5 normal-case ${toast.type === 'error' ? 'border-red-700 bg-red-600 text-white shadow-red-600/20' : 'border-emerald-700 bg-emerald-600 text-white shadow-emerald-600/20'}`}>
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={onClose}
        className="cursor-pointer text-base font-bold opacity-70 transition-opacity hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
};

const ContentSkeleton = () => (
  <div className="w-full space-y-6 duration-500 animate-in fade-in">
    <div className="mb-6 flex gap-4">
      <div className="skeleton h-10 w-48 rounded-xl" />
      <div className="skeleton h-10 w-32 rounded-xl" />
    </div>
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <div className="skeleton h-32 w-full rounded-2xl" />
      <div className="skeleton h-32 w-full rounded-2xl" />
      <div className="skeleton h-32 w-full rounded-2xl" />
    </div>
    <div className="skeleton mt-6 h-80 w-full rounded-2xl" />
  </div>
);

export default function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('dimsum_user');
    return safeJsonParse(savedUser, null);
  });

  const [activeTab, setActiveTab] = useState(() => {
    const savedUser = localStorage.getItem('dimsum_user');
    const parsed = safeJsonParse(savedUser, null);
    return parsed ? getDefaultTabForUser(parsed) : 'dashboard';
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const [dbData, setDbData] = useState(() => {
    const cachedData = localStorage.getItem('dimsum_db_cache');
    const parsedCache = safeJsonParse(cachedData, null);

    return parsedCache || {
      orders: [],
      purchases: [],
      expenses: [],
      payments: [],
      pemalang: [],
      karyawan: [],

      stockMovements: [],
      productionBatches: [],
      supplierLedger: [],
      cashflowTransactions: [],
      marketplaceSettlement: [],
      masterBranches: [],
      distributionOrders: [],
      inventoryCostLayers: [],
      marketplaceFeeRules: [],
      auditLogs: [],
      discrepancyLogs: [],
      chartOfAccounts: [],
      generalLedger: [],
      financialClosings: [],
      systemTasks: [],
      masterProducts: [],
      masterRawMaterials: [],
      masterRecipeBom: [],
      masterSuppliers: [],
      masterConversionRules: [],
      marketplaceInvoices: [],
      master_branch_types: [],
      master_branch_capabilities: [],
      interbranch_treasury: [],
      branch_settlements: [],
      master_customers: [],
      master_locations: [],
      master_kewajiban: [],
      trx_pembayaran_kewajiban: [],
      master_conversion_rules: [],

      master_branches: [],
      master_products: [],
      master_raw_materials: [],
      master_recipe_bom: [],
      master_suppliers: [],
      master_pelanggan: [],
      master_warehouses: [],
      master_gudang: [],

      purchase_orders: [],
      purchase_items: [],
      production_orders: [],
      production_items: [],
      sales_orders: [],
      sales_items: [],
      cash_bank_transactions: [],
      receivables: [],
      receivable_payments: [],
      payables: [],
      payable_payments: [],
      accounting_journals: [],
      accounting_entries: [],

      payroll_records: [],
      lembur_records: [],
      kasbon_records: [],
      employee_loans: [],
      employee_payments: [],
    };
  });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchAllDatabase = useCallback(async (currentBranchId) => {
    if (!API_URL_GAS || API_URL_GAS.includes('URL_WEBAPP_')) return;

    setIsSyncing(true);

    try {
      const response = await fetch(`${API_URL_GAS}?action=read_all&branch_id=${currentBranchId || 'ALL'}`);
      const resJson = await response.json();

      if (resJson.status === 'success' && resJson.data) {
        setDbData((prev) => {
          const newData = { ...prev, ...resJson.data };
          localStorage.setItem('dimsum_db_cache', JSON.stringify(newData));
          return newData;
        });
      }
    } catch (err) {
      console.error('Background Sync Error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchAllDatabase(user.branch_id);
    }
  }, [user, fetchAllDatabase]);

  useEffect(() => {
    if (!user) return;

    const safeTab = resolveAuthorizedTab(activeTab, user);
    if (safeTab !== activeTab) {
      setActiveTab(safeTab);
    }
  }, [activeTab, user]);

  const sendToSheet = async (action, payload, tableName) => {
    if (!API_URL_GAS || API_URL_GAS.includes('URL_WEBAPP_')) {
      showToast('URL Google Apps Script belum terkonfigurasi!', 'error');
      return false;
    }

    setIsSaving(true);

    try {
      const response = await fetch(API_URL_GAS, {
        method: 'POST',
        body: JSON.stringify({
          action,
          table: tableName,
          data: payload,
          executor: {
            name: user?.name || 'SYSTEM',
            branch_id: user?.branch_id || 'PUSAT',
          },
          request_id: generateRequestId(),
        }),
      });

      const resJson = await response.json();

      if (resJson.status === 'success') {
        showToast('Data berhasil diamankan ke cloud database!', 'success');

        if (action === 'insert' && tableName && tableName !== 'auto') {
          setDbData((prev) => {
            const currentTableData = prev[tableName] || [];
            const payloadArray = Array.isArray(payload) ? payload : [payload];

            const newDataInjected = payloadArray.map((item) => ({
              ...item,
              id: item.id || resJson.data?.data?.id || `TEMP-${Date.now()}`,
              isDeleted: false,
            }));

            const updatedState = {
              ...prev,
              [tableName]: [...newDataInjected, ...currentTableData],
            };

            localStorage.setItem('dimsum_db_cache', JSON.stringify(updatedState));
            return updatedState;
          });
        } else if (action === 'update' && tableName && tableName !== 'auto') {
          setDbData((prev) => {
            const currentTableData = prev[tableName] || [];
            const payloadArray = Array.isArray(payload) ? payload : [payload];

            const updatedTableData = currentTableData.map((row) => {
              const updatedRow = payloadArray.find((item) => (
                item.id === row.id ||
                item.customer_id === row.customer_id ||
                item.do_id === row.do_id
              ));

              return updatedRow ? { ...row, ...updatedRow } : row;
            });

            const updatedState = { ...prev, [tableName]: updatedTableData };
            localStorage.setItem('dimsum_db_cache', JSON.stringify(updatedState));
            return updatedState;
          });
        }

        setTimeout(() => {
          fetch(`${API_URL_GAS}?branch_id=${user?.branch_id || 'ALL'}&table=${tableName}`)
            .then((res) => res.json())
            .then((silentRes) => {
              if (silentRes.status === 'success' && silentRes.data && silentRes.data[tableName]) {
                setDbData((prev) => ({ ...prev, [tableName]: silentRes.data[tableName] }));
              }
            })
            .catch((error) => console.log('Silent sync failed', error));
        }, 3000);

        return true;
      }

      showToast(`Ditolak sistem: ${resJson.message}`, 'error');
      return false;
    } catch (err) {
      showToast('Koneksi internet terputus!', 'error');
      return false;
    } finally {
      document.body.style.overflow = 'unset';
      setIsSaving(false);
    }
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setLoginError('');

    try {
      const response = await fetch(API_URL_GAS, {
        method: 'POST',
        body: JSON.stringify({
          action: 'login',
          data: {
            username: loginForm.username,
            password: loginForm.password,
          },
        }),
      });

      const resJson = await response.json();

      if (resJson.status === 'success' && resJson.data?.success) {
        const activeUser = resJson.data.user;
        localStorage.setItem('dimsum_user', JSON.stringify(activeUser));
        setUser(activeUser);
        setActiveTab(getDefaultTabForUser(activeUser));
      } else {
        setLoginError(resJson.data?.message || 'Identitas otentikasi salah.');
      }
    } catch (err) {
      setLoginError('Koneksi database pusat terputus.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Apakah Anda yakin ingin keluar dari sistem?')) {
      localStorage.removeItem('dimsum_user');
      localStorage.removeItem('dimsum_db_cache');
      setUser(null);
      setLoginForm({ username: '', password: '' });
      setActiveTab('dashboard');
    }
  };

  const requestDelete = (id) => {
    setConfirmDialog({ id });
  };

  const handleExecuteDelete = async () => {
    if (!confirmDialog) return;

    const isSuccess = await sendToSheet('delete', { id: confirmDialog.id }, 'auto');
    if (isSuccess) setConfirmDialog(null);
  };

  const renderHrd = (initialSubTab) => (
    <TabKaryawan
      {...dbData}
      user={user}
      sendToSheet={sendToSheet}
      showToast={showToast}
      setPrintData={setPrintData}
      initialSubTab={initialSubTab}
      defaultSubTab={initialSubTab}
    />
  );

  const renderContent = () => {
    const safeTab = resolveAuthorizedTab(activeTab, user);
    const hasCache = Array.isArray(dbData.orders) && dbData.orders.length > 0;

    if (isSyncing && !hasCache) {
      return <ContentSkeleton />;
    }

    const readOnlyProps = {
      user,
      source: dbData,
      dbData,
      setPrintData,
      showToast,
      ...dbData,
    };

    const writeProps = {
      ...readOnlyProps,
      sendToSheet,
      requestDelete,
    };

    switch (safeTab) {
      case 'dashboard':
        return <TabDashboard {...readOnlyProps} setActiveTab={setActiveTab} />;

      case 'dashboard_branch':
        return <TabDashboardBranch {...readOnlyProps} setActiveTab={setActiveTab} />;

      case 'master_cabang':
        return <TabMasterCabang {...writeProps} />;

      case 'master_gudang':
        return <TabMasterGudang {...writeProps} />;

      case 'master_produk':
        return <TabMasterProduk {...writeProps} />;

      case 'master_supplier':
        return <TabMasterSupplier {...writeProps} />;

      case 'master_bahan_baku':
        return <TabMasterBahanBaku {...writeProps} />;

      case 'master_konversi':
        return (
          <TabMasterKonversi
            {...writeProps}
            masterConversionRules={dbData.master_conversion_rules || dbData.masterConversionRules || []}
          />
        );

      case 'master_resep_bom':
        return <TabMasterResepBOM {...writeProps} />;

      case 'master_pelanggan':
        return <TabMasterPelanggan {...writeProps} />;

      case 'purchase':
        return <TabPurchase {...writeProps} />;

      case 'production':
        return <TabProduction {...writeProps} />;

      case 'sales':
        return <TabSales {...writeProps} />;

      case 'stok':
        return <TabStok {...writeProps} role={user?.role} />;

      case 'kartu_stok':
        return <TabKartuStok {...readOnlyProps} />;

      case 'kas_bank':
        return <TabKasBank {...writeProps} />;

      case 'piutang':
        return <TabPiutang {...writeProps} role={user?.role} />;

      case 'hutang_supplier':
        return <TabHutangSupplier {...writeProps} />;

      case 'accounting':
        return <TabAccounting {...writeProps} />;

      case 'kewajiban':
        return <TabKewajiban {...writeProps} />;

      case 'karyawan':
        return renderHrd('');

      case 'hrd_master_sdm':
        return renderHrd('master');

      case 'hrd_payroll':
        return renderHrd('payroll');

      case 'hrd_lembur':
        return renderHrd('lembur');

      case 'hrd_kasbon':
        return renderHrd('kasbon');

      case 'dashboard_profit_owner':
        return <TabDashboardProfitOwner {...readOnlyProps} />;

      case 'executive_dashboard':
        return <TabExecutiveDashboard {...readOnlyProps} />;

      case 'business_radar':
        return <TabBusinessRadar {...readOnlyProps} />;

      case 'notification_center':
        return <TabNotificationCenter {...readOnlyProps} />;

      case 'accounting_audit':
        return <TabAccountingAudit {...readOnlyProps} />;

      case 'profit_owner_legacy':
        return <TabProfitOwner {...writeProps} legacyMode />;

      case 'orders_legacy':
        return <TabOrders {...writeProps} setPrintData={setPrintData} />;

      case 'antrian_po_legacy':
        return <TabAntrianPO {...writeProps} setPrintData={setPrintData} />;

      case 'purchases_legacy':
        return (
          <TabPurchases
            {...writeProps}
            masterSuppliers={dbData.masterSuppliers || dbData.master_suppliers || []}
            setPrintData={setPrintData}
          />
        );

      default:
        return <TabDashboardBranch {...readOnlyProps} setActiveTab={setActiveTab} />;
    }
  };

  if (!user) {
    return (
      <div
        className="fixed inset-0 flex h-screen w-full items-center justify-center overflow-hidden p-4 font-sans antialiased"
        style={{
          background: 'radial-gradient(circle at 10% 20%, rgb(254, 205, 211) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgb(254, 240, 138) 0%, transparent 40%), radial-gradient(circle at 50% 50%, rgb(248, 250, 252) 0%, transparent 100%)',
          backgroundColor: '#f8fafc',
        }}
      >
        <div className="w-full max-w-sm space-y-6 rounded-3xl border border-white/50 bg-white/90 p-7 shadow-2xl shadow-rose-900/10 backdrop-blur-md duration-300 animate-in zoom-in-95">
          <div className="flex flex-col items-center text-center">
            <img
              src="https://dimsumaditya.id/wp-content/uploads/2026/06/Dimsum-Aditya-New-Logo-scaled.webp"
              alt="Logo Dimsum Aditya"
              className="mb-4 h-24 w-auto object-contain drop-shadow-sm"
            />
            <h2 className="text-xl font-black tracking-tight text-slate-800">
              Selamat Datang
            </h2>
            <p className="mt-1 text-xs font-bold text-slate-400">
              Silakan login ke akun Anda
            </p>
          </div>

          {loginError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] font-bold text-red-600 animate-shake">
              <AlertCircle size={14} className="shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                Username
              </label>
              <input
                type="text"
                required
                value={loginForm.username}
                onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-sm font-bold outline-none transition-all focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10 normal-case"
                placeholder="Masukkan username"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                Password
              </label>
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-sm font-bold outline-none transition-all focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 font-bold text-white shadow-md shadow-red-600/20 transition-all hover:bg-red-700 active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'Login'}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center border-t border-slate-100 pt-4 text-center">
            <a
              href="https://dimsumaditya.id"
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-red-600"
            >
              Dimsum Aditya
            </a>
            <div className="mt-1 text-[8px] font-bold text-slate-300">
              Supplier Dimsum Ayam Tangerang.
            </div>
            <div className="mt-2 text-[9px] font-black uppercase tracking-widest text-red-600">
              by Dnamic Network
            </div>
          </div>
        </div>

        <ToastNotification toast={toast} onClose={() => setToast(null)} />
      </div>
    );
  }

  const safeActiveTab = resolveAuthorizedTab(activeTab, user);

  return (
    <div className="fixed inset-0 h-screen w-full select-none overflow-hidden bg-transparent">
      <LayoutEngine
        user={user}
        activeTab={safeActiveTab}
        setActiveTab={setActiveTab}
        handleLogout={handleLogout}
      >
        {renderContent()}
      </LayoutEngine>

      {isSyncing && Array.isArray(dbData.orders) && dbData.orders.length > 0 && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[9000] flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur duration-300 animate-in slide-in-from-top-5 fade-in">
          <Loader2 size={12} className="animate-spin text-red-500" />
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            Menyinkronkan...
          </span>
        </div>
      )}

      <ToastNotification toast={toast} onClose={() => setToast(null)} />
      <PrintDotMatrix printData={printData} onClose={() => setPrintData(null)} />

      {confirmDialog && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px] duration-150 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-red-100 bg-red-50">
              <Trash2 size={20} className="text-red-600" />
            </div>
            <h3 className="mb-1 text-base font-extrabold text-slate-800 normal-case">
              Batalkan Transaksi?
            </h3>
            <p className="mb-6 text-xs font-medium text-slate-500 normal-case">
              Data akan di-void dari cloud. Tindakan ini terekam otomatis dalam sistem audit trail.
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="flex-1 cursor-pointer rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 normal-case"
              >
                Batal (Esc)
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white transition-colors hover:bg-red-700 normal-case"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSaving && (
        <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm">
          <Loader2 size={40} className="mb-4 animate-spin text-red-600" />
          <div className="animate-pulse text-sm font-bold text-slate-700 normal-case">
            Memproses Data...
          </div>
        </div>
      )}
    </div>
  );
}
