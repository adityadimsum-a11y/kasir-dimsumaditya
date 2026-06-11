import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';

// =====================================
// IMPOR DYNAMIC LAYOUT ENGINE
// =====================================
import LayoutEngine from './layouts/LayoutEngine';

// =====================================
// IMPOR SELURUH TAB OPERASIONAL
// =====================================
import TabDashboard from './components/tabs/TabDashboard';
import TabOrders from './components/tabs/TabOrders';
import TabPurchases from './components/tabs/TabPurchases';
import TabExpenses from './components/tabs/TabExpenses';
import TabPiutang from './components/tabs/TabPiutang';
import TabPemalang from './components/tabs/TabPemalang';
import TabStok from './components/tabs/TabStok';
import TabDistribusi from './components/tabs/TabDistribusi';
import TabKaryawan from './components/tabs/TabKaryawan';
import TabMonitoringPemalang from './components/tabs/TabMonitoringPemalang';
import TabDashboardBranch from './components/tabs/TabDashboardBranch';
import TabCashWarRoom from './components/tabs/TabCashWarRoom';
import TabSCMWarRoom from './components/tabs/TabSCMWarRoom';
import TabAnalytics from './components/tabs/TabAnalytics';
import TabBusinessRadar from './components/tabs/TabBusinessRadar';
import TabAccounting from './components/tabs/TabAccounting';
import TabAccountingAudit from './components/tabs/TabAccountingAudit';
import TabMasterData from './components/tabs/TabMasterData';
import TabStokOutlet from './components/tabs/TabStokOutlet';
import TabSetoranCabang from './components/tabs/TabSetoranCabang';
import TabDiscrepancy from './components/tabs/TabDiscrepancy';
import TabKartuStok from './components/tabs/TabKartuStok';

// =====================================
// IMPOR KOMPONEN CETAK
// =====================================
import PrintDotMatrix from './components/PrintDotMatrix';

// =====================================
// CORE BUSINESS ENGINE
// =====================================
import { calculateCoreBusiness } from './utils/CoreBusinessEngine';

// ⚠️ URL WEB APP GOOGLE APPS SCRIPT
const API_URL_GAS =
  'https://script.google.com/macros/s/AKfycbyqCaTepk_duXguiOqSM572mbUIGozcghhh8LHNMNw2e83O7Wkyu-SkjdVTO3zpTb64PA/exec';

// =====================================
// DATABASE DEFAULT STATE
// =====================================
const EMPTY_DB_DATA = {
  orders: [],
  purchases: [],
  expenses: [],
  payments: [],
  pemalang: [],
  karyawan: [],

  stock_movements: [],
  production_batches: [],
  supplier_ledger: [],
  cashflow_transactions: [],
  marketplace_settlement: [],
  attendance_logs: [],
  users: [],
  master_branches: [],
  distribution_orders: [],
  inventory_cost_layers: [],
  marketplace_fee_rules: [],
  audit_logs: [],
  discrepancy_logs: [],
  chart_of_accounts: [],
  general_ledger: [],
  financial_closings: [],
  system_tasks: [],
  master_products: [],
  master_raw_materials: [],
  master_recipe_bom: [],
  master_suppliers: [],
  master_conversion_rules: [],
  marketplace_invoices: [],
  master_branch_types: [],
  master_branch_capabilities: [],
  interbranch_treasury: [],
  branch_settlements: [],
  master_customers: [],
  master_locations: [],

  stockMovements: [],
  productionBatches: [],
  supplierLedger: [],
  cashflowTransactions: [],
  marketplaceSettlement: [],
  attendanceLogs: [],
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
  masterBranchTypes: [],
  masterBranchCapabilities: [],
  interbranchTreasury: [],
  branchSettlements: [],
  masterCustomers: [],
  masterLocations: [],
};

const safeArray = (value) => {
  return Array.isArray(value) ? value : [];
};

const pickArray = (primary, fallback) => {
  const first = safeArray(primary);
  const second = safeArray(fallback);
  return first.length > 0 ? first : second;
};

// =====================================
// FLOATING NOTIFICATION SYSTEM
// =====================================
const ToastNotification = ({ toast, onClose }) => {
  if (!toast) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-[9999] px-6 py-3.5 rounded-2xl shadow-xl font-black text-xs uppercase tracking-wide flex items-center gap-2 animate-in slide-in-from-top-5 border duration-200 ${
        toast.type === 'error'
          ? 'bg-rose-600 text-white border-rose-500 shadow-rose-600/20'
          : 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/20'
      }`}
    >
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-4 opacity-60 hover:opacity-100 transition font-mono text-sm"
      >
        ✕
      </button>
    </div>
  );
};

export default function App() {
  // =====================================
  // CORE APP STATES
  // =====================================
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('dimsum_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      localStorage.removeItem('dimsum_user');
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const [dbData, setDbData] = useState(EMPTY_DB_DATA);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // =====================================
  // DATA ADAPTER: SNAKE_CASE + CAMELCASE
  // =====================================
  const adaptedData = useMemo(() => {
    const stockMovements = pickArray(dbData.stock_movements, dbData.stockMovements);
    const productionBatches = pickArray(dbData.production_batches, dbData.productionBatches);
    const supplierLedger = pickArray(dbData.supplier_ledger, dbData.supplierLedger);
    const cashflowTransactions = pickArray(dbData.cashflow_transactions, dbData.cashflowTransactions);
    const marketplaceSettlement = pickArray(dbData.marketplace_settlement, dbData.marketplaceSettlement);
    const attendanceLogs = pickArray(dbData.attendance_logs, dbData.attendanceLogs);
    const masterBranches = pickArray(dbData.master_branches, dbData.masterBranches);
    const distributionOrders = pickArray(dbData.distribution_orders, dbData.distributionOrders);
    const inventoryCostLayers = pickArray(dbData.inventory_cost_layers, dbData.inventoryCostLayers);
    const marketplaceFeeRules = pickArray(dbData.marketplace_fee_rules, dbData.marketplaceFeeRules);
    const auditLogs = pickArray(dbData.audit_logs, dbData.auditLogs);
    const discrepancyLogs = pickArray(dbData.discrepancy_logs, dbData.discrepancyLogs);
    const chartOfAccounts = pickArray(dbData.chart_of_accounts, dbData.chartOfAccounts);
    const generalLedger = pickArray(dbData.general_ledger, dbData.generalLedger);
    const financialClosings = pickArray(dbData.financial_closings, dbData.financialClosings);
    const systemTasks = pickArray(dbData.system_tasks, dbData.systemTasks);
    const masterProducts = pickArray(dbData.master_products, dbData.masterProducts);
    const masterRawMaterials = pickArray(dbData.master_raw_materials, dbData.masterRawMaterials);
    const masterRecipeBom = pickArray(dbData.master_recipe_bom, dbData.masterRecipeBom);
    const masterSuppliers = pickArray(dbData.master_suppliers, dbData.masterSuppliers);
    const masterConversionRules = pickArray(dbData.master_conversion_rules, dbData.masterConversionRules);
    const marketplaceInvoices = pickArray(dbData.marketplace_invoices, dbData.marketplaceInvoices);
    const masterBranchTypes = pickArray(dbData.master_branch_types, dbData.masterBranchTypes);
    const masterBranchCapabilities = pickArray(
      dbData.master_branch_capabilities,
      dbData.masterBranchCapabilities
    );
    const interbranchTreasury = pickArray(dbData.interbranch_treasury, dbData.interbranchTreasury);
    const branchSettlements = pickArray(dbData.branch_settlements, dbData.branchSettlements);
    const masterCustomers = pickArray(dbData.master_customers, dbData.masterCustomers);
    const masterLocations = pickArray(dbData.master_locations, dbData.masterLocations);

    return {
      ...EMPTY_DB_DATA,
      ...dbData,

      orders: safeArray(dbData.orders),
      purchases: safeArray(dbData.purchases),
      expenses: safeArray(dbData.expenses),
      payments: safeArray(dbData.payments),
      pemalang: safeArray(dbData.pemalang),
      karyawan: safeArray(dbData.karyawan),

      // alias khusus modul lama
      piutangPayments: safeArray(dbData.payments),
      pemalangReports: branchSettlements,
      stokData: stockMovements,

      // camelCase
      stockMovements,
      productionBatches,
      supplierLedger,
      cashflowTransactions,
      marketplaceSettlement,
      attendanceLogs,
      masterBranches,
      distributionOrders,
      inventoryCostLayers,
      marketplaceFeeRules,
      auditLogs,
      discrepancyLogs,
      chartOfAccounts,
      generalLedger,
      financialClosings,
      systemTasks,
      masterProducts,
      masterRawMaterials,
      masterRecipeBom,
      masterSuppliers,
      masterConversionRules,
      marketplaceInvoices,
      masterBranchTypes,
      masterBranchCapabilities,
      interbranchTreasury,
      branchSettlements,
      masterCustomers,
      masterLocations,

      // snake_case
      stock_movements: stockMovements,
      production_batches: productionBatches,
      supplier_ledger: supplierLedger,
      cashflow_transactions: cashflowTransactions,
      marketplace_settlement: marketplaceSettlement,
      attendance_logs: attendanceLogs,
      master_branches: masterBranches,
      distribution_orders: distributionOrders,
      inventory_cost_layers: inventoryCostLayers,
      marketplace_fee_rules: marketplaceFeeRules,
      audit_logs: auditLogs,
      discrepancy_logs: discrepancyLogs,
      chart_of_accounts: chartOfAccounts,
      general_ledger: generalLedger,
      financial_closings: financialClosings,
      system_tasks: systemTasks,
      master_products: masterProducts,
      master_raw_materials: masterRawMaterials,
      master_recipe_bom: masterRecipeBom,
      master_suppliers: masterSuppliers,
      master_conversion_rules: masterConversionRules,
      marketplace_invoices: marketplaceInvoices,
      master_branch_types: masterBranchTypes,
      master_branch_capabilities: masterBranchCapabilities,
      interbranch_treasury: interbranchTreasury,
      branch_settlements: branchSettlements,
      master_customers: masterCustomers,
      master_locations: masterLocations,
    };
  }, [dbData]);

  // =====================================
  // CORE BUSINESS ENGINE 55 / 20 / 10 / 15
  // =====================================
  const coreBusiness = useMemo(() => {
    return calculateCoreBusiness({
      orders: adaptedData.orders,
      purchases: adaptedData.purchases,
      cashflowTransactions: adaptedData.cashflowTransactions,
      productionBatches: adaptedData.productionBatches,
      stockMovements: adaptedData.stockMovements,
    });
  }, [
    adaptedData.orders,
    adaptedData.purchases,
    adaptedData.cashflowTransactions,
    adaptedData.productionBatches,
    adaptedData.stockMovements,
  ]);

  const coreAllocation = coreBusiness?.allocation || null;
  const coreStatus = coreBusiness?.status || null;

  // =====================================
  // ENGINE 1: READ DATABASE
  // =====================================
  const fetchAllDatabase = useCallback(
    async (currentBranchId, isBackground = false) => {
      if (!API_URL_GAS || API_URL_GAS.includes('URL_WEBAPP_')) return;

      if (!isBackground) setIsLoading(true);

      try {
        const response = await fetch(
          `${API_URL_GAS}?action=read_all&branch_id=${currentBranchId || 'ALL'}`
        );

        const resJson = await response.json();

        if (resJson.status === 'success' && resJson.data) {
          setDbData((prev) => ({
            ...prev,
            ...resJson.data,
          }));
        }
      } catch {
        if (!isBackground) {
          showToast('Gagal menyinkronkan data dengan server.', 'error');
        }
      } finally {
        if (!isBackground) setIsLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (!user) return undefined;

    fetchAllDatabase(user.branch_id, false);

    const syncInterval = setInterval(() => {
      fetchAllDatabase(user.branch_id, true);
    }, 60000);

    return () => clearInterval(syncInterval);
  }, [user, fetchAllDatabase]);

  // =====================================
  // ENGINE 2: WRITE DATABASE
  // =====================================
  const sendToSheet = async (action, payload, tableName) => {
    if (!API_URL_GAS || API_URL_GAS.includes('URL_WEBAPP_')) {
      showToast('URL Google Apps Script belum di-set!', 'error');
      return false;
    }

    setIsLoading(true);

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
          request_id: `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        }),
      });

      const resJson = await response.json();

      if (resJson.status === 'success') {
        showToast('Data berhasil disimpan ke server!', 'success');
        fetchAllDatabase(user?.branch_id, true);
        return true;
      }

      showToast(`Ditolak: ${resJson.message || 'Server menolak request.'}`, 'error');
      return false;
    } catch {
      showToast('Gagal! Koneksi internet terputus.', 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // =====================================
  // ENGINE 3: LOGIN & LOGOUT
  // =====================================
  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    if (!API_URL_GAS || API_URL_GAS.includes('URL_WEBAPP_')) {
      setLoginError('Sistem belum terhubung ke database cloud.');
      return;
    }

    setIsLoading(true);
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

        if (activeUser.branch_type === 'HQ_FACTORY') {
          setActiveTab('dashboard');
        } else {
          setActiveTab('dashboard_branch');
        }
      } else {
        setLoginError(resJson.data?.message || 'Username atau Password salah.');
      }
    } catch {
      setLoginError('Server Offline / Tidak ada koneksi internet.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Apakah Anda yakin ingin logout dari sistem?')) {
      localStorage.removeItem('dimsum_user');
      setUser(null);
      setLoginForm({ username: '', password: '' });
      setActiveTab('dashboard');
    }
  };

  // =====================================
  // ENGINE 4: GLOBAL DELETE
  // =====================================
  const requestDelete = (id) => setConfirmDialog({ id });

  const handleExecuteDelete = async () => {
    if (!confirmDialog) return;

    const isSuccess = await sendToSheet('delete', { id: confirmDialog.id }, 'auto');

    if (isSuccess) setConfirmDialog(null);
  };

  // =====================================
  // ROUTING TAB CONTENT
  // =====================================
  const renderContent = () => {
    let safeTab = activeTab;

    if (activeTab === 'dashboard' && user?.branch_type !== 'HQ_FACTORY') {
      safeTab = 'dashboard_branch';
    }

    const commonProps = {
      ...adaptedData,
      user,
      role: user?.role,
      sendToSheet,
      showToast,
      requestDelete,
      setPrintData,
      coreBusiness,
      coreAllocation,
      coreStatus,
    };

    switch (safeTab) {
      case 'dashboard':
        return <TabDashboard handleTabChange={setActiveTab} {...commonProps} />;

      case 'dashboard_branch':
        return <TabDashboardBranch {...commonProps} />;

      case 'pemalang':
        return <TabPemalang {...commonProps} />;

      case 'cash_war_room':
        return <TabCashWarRoom {...commonProps} />;

      case 'setoran_cabang':
        return <TabSetoranCabang {...commonProps} />;

      case 'scm_war_room':
        return <TabSCMWarRoom {...commonProps} />;

      case 'business_radar':
        return <TabBusinessRadar {...commonProps} />;

      case 'analytics':
        return <TabAnalytics {...commonProps} />;

      case 'orders':
        return <TabOrders {...commonProps} />;

      case 'purchases':
        return <TabPurchases {...commonProps} />;

      case 'expenses':
        return <TabExpenses {...commonProps} />;

      case 'stok':
        return <TabStok {...commonProps} />;

      case 'stok_outlet':
        return <TabStokOutlet {...commonProps} />;

      case 'discrepancy':
        return <TabDiscrepancy {...commonProps} />;

      case 'distribusi':
        return <TabDistribusi {...commonProps} />;

      case 'accounting':
        return <TabAccounting {...commonProps} />;

      case 'accounting_audit':
        return <TabAccountingAudit {...commonProps} />;

      case 'piutang':
        return <TabPiutang {...commonProps} />;

      case 'karyawan':
        return <TabKaryawan {...commonProps} />;

      case 'master_data':
        return <TabMasterData {...commonProps} />;

      case 'monitoring_pemalang':
        return <TabMonitoringPemalang {...commonProps} />;

      case 'kartu_stok':
        return <TabKartuStok {...commonProps} />;

      default:
        return <TabDashboardBranch {...commonProps} />;
    }
  };

  // =====================================
  // UI 1: LOGIN SCREEN
  // =====================================
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[30rem] md:w-[40rem] h-[30rem] md:h-[40rem] bg-red-500 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-pulse" />
        <div
          className="absolute top-[20%] right-[-10%] w-[25rem] md:w-[35rem] h-[25rem] md:h-[35rem] bg-orange-400 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-pulse"
          style={{ animationDelay: '2s' }}
        />
        <div
          className="absolute bottom-[-20%] left-[20%] w-[35rem] md:w-[45rem] h-[35rem] md:h-[45rem] bg-yellow-400 rounded-full mix-blend-multiply filter blur-[100px] opacity-30 animate-pulse"
          style={{ animationDelay: '4s' }}
        />

        <div className="bg-white/90 backdrop-blur-xl p-8 rounded-3xl shadow-2xl max-w-sm w-full relative z-10 border border-white/50 mb-10">
          <div className="text-center mb-6">
            <div className="flex justify-center">
              <img
                src="https://dimsumaditya.id/wp-content/uploads/2026/06/Dimsum-Aditya-New-Logo-scaled.webp"
                alt="Logo Dimsum Aditya"
                className="h-28 w-auto object-contain drop-shadow-sm hover:scale-105 transition-transform duration-300"
              />
            </div>
          </div>

          {loginError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold p-3 rounded-xl mb-4 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                Username
              </label>
              <input
                type="text"
                required
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-red-500 transition"
                placeholder="Masukkan username"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-red-500 transition"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-red-600 text-white font-black py-4 rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-600/30 uppercase tracking-wide text-xs mt-2 disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                'Masuk Sistem'
              )}
            </button>
          </form>
        </div>

        <div className="absolute bottom-6 w-full text-center z-10 flex flex-col items-center justify-center">
          <a
            href="https://dimsumaditya.id/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-black text-slate-700 hover:text-red-600 uppercase tracking-widest transition-colors block"
          >
            Dimsum Aditya
          </a>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            Supplier Dimsum Ayam Tangerang.
          </p>
        </div>
      </div>
    );
  }

  // =====================================
  // UI 2: MAIN APP
  // =====================================
  return (
    <div className="fixed inset-0 w-full h-screen overflow-hidden bg-slate-50">
      <LayoutEngine
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        handleLogout={handleLogout}
        masterCapabilities={adaptedData.master_branch_capabilities}
      >
        {renderContent()}
      </LayoutEngine>

      <ToastNotification toast={toast} onClose={() => setToast(null)} />

      <PrintDotMatrix printData={printData} onClose={() => setPrintData(null)} />

      {confirmDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center border">
            <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-rose-600" />
            </div>

            <h3 className="text-base font-black text-slate-800 mb-1">Batalkan Transaksi?</h3>

            <p className="text-xs text-slate-500 mb-5 font-bold">
              Data akan di-void dari sistem. Aksi ini akan terekam dalam audit trail.
            </p>

            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="w-1/2 px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition"
              >
                Batal (ESC)
              </button>

              <button
                type="button"
                onClick={handleExecuteDelete}
                className="w-1/2 px-4 py-2.5 bg-rose-600 text-white font-black text-xs rounded-xl hover:bg-rose-700 transition flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center">
          <Loader2 size={48} className="text-red-600 animate-spin mb-4" />
          <div className="font-black text-slate-800 tracking-widest uppercase text-sm animate-pulse">
            Menyinkronkan Server...
          </div>
        </div>
      )}
    </div>
  );
}
