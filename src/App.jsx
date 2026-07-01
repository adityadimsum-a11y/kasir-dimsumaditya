import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';

import { safeJsonParse, generateRequestId } from './utils/helpers';
import { loginBridge, getLegacyBootstrap } from './services/erpApiClient';
import { adaptLegacyBootstrap } from './services/legacyDataAdapter';
import { legacyWriteAction } from './services/legacyWriteAdapter';

import LayoutEngine from './layouts/LayoutEngine';
import TabDashboard from './components/tabs/TabDashboard';
import TabOrders from './components/tabs/TabOrders';
import TabPurchases from './components/tabs/TabPurchases';
import TabChickenPurchase from './components/tabs/TabChickenPurchase';
import TabSupplierAyam from './components/tabs/TabSupplierAyam';
import TabSupplierDebtControl from './components/tabs/TabSupplierDebtControl';
import TabExpenses from './components/tabs/TabExpenses';
import TabPiutang from './components/tabs/TabPiutang';
import TabPemalang from './components/tabs/TabPemalang';
import TabStok from './components/tabs/TabStok';
import TabDistribusi from './components/tabs/TabDistribusi';
import TabKaryawan from './components/tabs/TabKaryawan';
import TabDashboardBranch from './components/tabs/TabDashboardBranch';
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

import TabProfitOwner from './components/tabs/TabProfitOwner';
import TabKewajiban from './components/tabs/TabKewajiban';
import TabMasterKonversi from './components/tabs/TabMasterKonversi';

import TabMasterCustomer from './components/tabs/TabMasterCustomer';
import TabAntrianPO from './components/tabs/TabAntrianPO';
import TabMonitoringCabangUniversal from './components/tabs/TabMonitoringCabangUniversal';
import PrintDotMatrix from './components/PrintDotMatrix';

// Backend baru dikonfigurasi via VITE_ERP_API_URL / localStorage dimsum_new_erp_api_url.
// API_URL_GAS lama sengaja tidak dipakai lagi agar transaksi tidak masuk mesin lama.

const DEFAULT_DB_DATA = {
  orders: [],
  orders_data: [],

  purchases: [],
  purchases_data: [],

  expenses: [],
  expenses_data: [],

  payments: [],
  pemalang: [],
  pemalangReports: [],

  karyawan: [],
  stockMovements: [],
  stock_movements: [],

  stokData: [],
  stok_data: [],

  productionBatches: [],
  production_batches: [],

  supplierLedger: [],
  supplier_ledger: [],

  cashflowTransactions: [],
  cashflow_transactions: [],

  marketplaceSettlement: [],
  marketplace_settlement: [],

  masterBranches: [],
  master_branches: [],

  distributionOrders: [],
  distribution_orders: [],

  inventoryCostLayers: [],
  inventory_cost_layers: [],

  marketplaceFeeRules: [],
  marketplace_fee_rules: [],

  auditLogs: [],
  audit_logs: [],

  discrepancyLogs: [],
  discrepancy_logs: [],

  chartOfAccounts: [],
  chart_of_accounts: [],

  generalLedger: [],
  general_ledger: [],

  financialClosings: [],
  financial_closings: [],

  systemTasks: [],
  system_tasks: [],

  masterProducts: [],
  master_products: [],

  masterRawMaterials: [],
  master_raw_materials: [],

  masterRecipeBom: [],
  master_recipe_bom: [],

  masterSuppliers: [],
  master_suppliers: [],

  masterConversionRules: [],
  master_conversion_rules: [],

  masterAmplopRules: [],
  master_amplop_rules: [],

  marketplaceInvoices: [],
  marketplace_invoices: [],

  master_branch_types: [],
  master_branch_capabilities: [],

  interbranch_treasury: [],
  branch_settlements: [],

  master_customers: [],
  masterCustomers: [],

  master_locations: [],

  piutangPayments: [],
  piutang_payments: [],

  master_kewajiban: [],
  trx_pembayaran_kewajiban: [],
};

const ToastNotification = ({ toast, onClose }) => {
  if (!toast) return null;

  return (
    <div className={`fixed top-4 right-4 z-[9999] px-5 py-3.5 rounded-xl shadow-lg font-bold text-xs normal-case flex items-center gap-3 animate-in slide-in-from-top-5 border duration-200 ${
      toast.type === 'error'
        ? 'bg-red-600 text-white border-red-700 shadow-red-600/20'
        : 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-600/20'
    }`}
    >
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={onClose}
        className="opacity-70 hover:opacity-100 transition-opacity font-bold text-base cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
};

const ContentSkeleton = () => (
  <div className="space-y-6 w-full animate-in fade-in duration-500">
    <div className="flex gap-4 mb-6">
      <div className="skeleton h-10 w-48 rounded-xl" />
      <div className="skeleton h-10 w-32 rounded-xl" />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="skeleton h-32 rounded-2xl w-full" />
      <div className="skeleton h-32 rounded-2xl w-full" />
      <div className="skeleton h-32 rounded-2xl w-full" />
    </div>

    <div className="skeleton h-80 rounded-2xl w-full mt-6" />
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

    if (parsed) return parsed.branch_type === 'HQ_FACTORY' ? 'dashboard' : 'dashboard_branch';

    return 'dashboard';
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

    return {
      ...DEFAULT_DB_DATA,
      ...(parsedCache || {}),
    };
  });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchAllDatabase = useCallback(async (currentBranchId, activeSessionToken) => {
    const sessionToken = activeSessionToken || localStorage.getItem('dimsum_session_token') || user?.session_token || '';

    if (!sessionToken) return;

    setIsSyncing(true);

    try {
      const result = await getLegacyBootstrap(sessionToken, {
        branch_id: currentBranchId || user?.branch_id || 'ALL',
        dashboard_scope: 'HOME_OWNER',
      });

      if (result.success) {
        const adaptedData = adaptLegacyBootstrap(result.data, {
          user,
          defaultDbData: DEFAULT_DB_DATA,
        });

        setDbData((prev) => {
          const newData = {
            ...DEFAULT_DB_DATA,
            ...prev,
            ...adaptedData,
          };

          localStorage.setItem('dimsum_db_cache', JSON.stringify(newData));

          return newData;
        });
      } else {
        console.error('Legacy bridge sync rejected:', result.message, result.error);
      }
    } catch (err) {
      console.error('Background Sync Error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchAllDatabase(user.branch_id, user.session_token);
    }
  }, [user, fetchAllDatabase]);

  const sendToSheet = async (action, payload, tableName) => {
    const sessionToken = user?.session_token || localStorage.getItem('dimsum_session_token') || '';

    if (!sessionToken) {
      showToast('Session baru belum aktif. Silakan login ulang.', 'error');
      return false;
    }

    setIsSaving(true);

    try {
      const result = await legacyWriteAction({
        action,
        tableName,
        payload,
        user,
        sessionToken,
        requestId: generateRequestId(),
      });

      if (!result.success) {
        showToast(result.message || 'Fitur simpan ini belum disambungkan ke mesin baru.', 'error');
        return false;
      }

      showToast(result.message || 'Data berhasil diproses mesin baru.', 'success');
      await fetchAllDatabase(user?.branch_id || 'ALL', sessionToken);
      return true;
    } catch (err) {
      showToast(err.message || 'Koneksi mesin baru terputus.', 'error');
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
      const result = await loginBridge({
        username: loginForm.username,
        password: loginForm.password,
      });

      if (result.success && result.user) {
        const activeUser = result.user;
        const sessionToken = result.sessionToken || activeUser.session_token || '';

        localStorage.setItem('dimsum_user', JSON.stringify(activeUser));
        localStorage.setItem('dimsum_session_token', sessionToken);

        setUser(activeUser);
        setActiveTab(activeUser.branch_type === 'HQ_FACTORY' ? 'dashboard' : 'dashboard_branch');
        await fetchAllDatabase(activeUser.branch_id, sessionToken);
      } else {
        setLoginError(result.message || 'Identitas otentikasi salah.');
      }
    } catch (err) {
      setLoginError(err.message || 'Koneksi database pusat terputus.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Apakah Anda yakin ingin keluar dari sistem?')) {
      localStorage.removeItem('dimsum_user');
      localStorage.removeItem('dimsum_db_cache');
      localStorage.removeItem('dimsum_session_token');

      setUser(null);
      setLoginForm({ username: '', password: '' });
      setActiveTab('dashboard');
    }
  };

  const requestDelete = (id) => setConfirmDialog({ id });

  const handleExecuteDelete = async () => {
    if (!confirmDialog) return;

    const isSuccess = await sendToSheet('delete', { id: confirmDialog.id }, 'auto');

    if (isSuccess) setConfirmDialog(null);
  };

  const renderContent = () => {
    let safeTab = activeTab;

    if (activeTab === 'dashboard' && user?.branch_type !== 'HQ_FACTORY') {
      safeTab = 'dashboard_branch';
    }

    const hasCache = (dbData.orders || []).length > 0 || (dbData.orders_data || []).length > 0;

    if (isSyncing && !hasCache) {
      return <ContentSkeleton />;
    }

    switch (safeTab) {
      case 'dashboard':
        return (
          <TabDashboard
            user={user}
            setActiveTab={setActiveTab}
            showToast={showToast}
            {...dbData}
          />
        );

      case 'monitoring_cabang':
        return (
          <TabMonitoringCabangUniversal
            user={user}
            setPrintData={setPrintData}
            {...dbData}
          />
        );

      case 'dashboard_branch':
        return (
          <TabDashboardBranch
            user={user}
            setPrintData={setPrintData}
            {...dbData}
          />
        );

      case 'pemalang':
        return (
          <TabPemalang
            user={user}
            sendToSheet={sendToSheet}
            requestDelete={requestDelete}
            setPrintData={setPrintData}
            showToast={showToast}
            {...dbData}
          />
        );

      case 'setoran_cabang':
        return (
          <TabSetoranCabang
            user={user}
            sendToSheet={sendToSheet}
            showToast={showToast}
            {...dbData}
          />
        );

      case 'scm_war_room':
        return <TabSCMWarRoom user={user} {...dbData} />;

      case 'business_radar':
        return <TabBusinessRadar user={user} {...dbData} />;

      case 'analytics':
        return <TabAnalytics user={user} {...dbData} />;

      case 'orders':
        return (
          <TabOrders
            user={user}
            sendToSheet={sendToSheet}
            setPrintData={setPrintData}
            showToast={showToast}
            {...dbData}
          />
        );

      case 'master_customer':
        return (
          <TabMasterCustomer
            user={user}
            sendToSheet={sendToSheet}
            setPrintData={setPrintData}
            showToast={showToast}
            {...dbData}
          />
        );

      case 'antrian_po':
        return (
          <TabAntrianPO
            user={user}
            sendToSheet={sendToSheet}
            showToast={showToast}
            setPrintData={setPrintData}
            {...dbData}
          />
        );

      case 'purchases':
        return (
          <TabChickenPurchase
            user={user}
            sendToSheet={sendToSheet}
            setPrintData={setPrintData}
            requestDelete={requestDelete}
            showToast={showToast}
            masterSuppliers={dbData.masterSuppliers}
            {...dbData}
          />
        );

      case 'supplier_ayam':
        return (
          <TabSupplierAyam
            user={user}
            sendToSheet={sendToSheet}
            showToast={showToast}
            {...dbData}
          />
        );

      case 'expenses':
        return (
          <TabExpenses
            user={user}
            sendToSheet={sendToSheet}
            showToast={showToast}
            {...dbData}
          />
        );

      case 'stok':
        return (
          <TabStok
            user={user}
            role={user?.role}
            sendToSheet={sendToSheet}
            requestDelete={requestDelete}
            setPrintData={setPrintData}
            showToast={showToast}
            {...dbData}
          />
        );

      case 'stok_outlet':
        return (
          <TabStokOutlet
            user={user}
            sendToSheet={sendToSheet}
            showToast={showToast}
            {...dbData}
          />
        );

      case 'discrepancy':
        return (
          <TabDiscrepancy
            user={user}
            sendToSheet={sendToSheet}
            showToast={showToast}
            {...dbData}
          />
        );

      case 'distribusi':
        return (
          <TabDistribusi
            user={user}
            sendToSheet={sendToSheet}
            setPrintData={setPrintData}
            showToast={showToast}
            {...dbData}
          />
        );

      case 'hutang_supplier':
        return (
          <TabSupplierDebtControl
            user={user}
            sendToSheet={sendToSheet}
            showToast={showToast}
            {...dbData}
          />
        );

      case 'accounting':
        return (
          <TabAccounting
            user={user}
            setPrintData={setPrintData}
            {...dbData}
          />
        );

      case 'accounting_audit':
        return <TabAccountingAudit user={user} {...dbData} />;

      case 'piutang':
        return (
          <TabPiutang
            user={user}
            role={user?.role}
            sendToSheet={sendToSheet}
            setPrintData={setPrintData}
            showToast={showToast}
            {...dbData}
          />
        );

      case 'karyawan':
        return (
          <TabKaryawan
            user={user}
            sendToSheet={sendToSheet}
            setPrintData={setPrintData}
            showToast={showToast}
            {...dbData}
          />
        );

      case 'master_data':
        return (
          <TabMasterData
            user={user}
            sendToSheet={sendToSheet}
            showToast={showToast}
            {...dbData}
          />
        );

      case 'kartu_stok':
        return <TabKartuStok user={user} {...dbData} />;

      case 'profit_owner':
        return (
          <TabProfitOwner
            user={user}
            sendToSheet={sendToSheet}
            showToast={showToast}
            {...dbData}
          />
        );

      case 'kewajiban':
        return (
          <TabKewajiban
            user={user}
            sendToSheet={sendToSheet}
            showToast={showToast}
            {...dbData}
          />
        );

      case 'master_konversi':
        return (
          <TabMasterKonversi
            user={user}
            sendToSheet={sendToSheet}
            showToast={showToast}
            masterConversionRules={dbData.master_conversion_rules || dbData.masterConversionRules}
          />
        );

      default:
        return <TabDashboardBranch user={user} {...dbData} />;
    }
  };

  if (!user) {
    return (
      <div
        className="fixed inset-0 w-full h-screen overflow-hidden flex items-center justify-center font-sans antialiased p-4"
        style={{
          background: 'radial-gradient(circle at 10% 20%, rgb(254, 205, 211) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgb(254, 240, 138) 0%, transparent 40%), radial-gradient(circle at 50% 50%, rgb(248, 250, 252) 0%, transparent 100%)',
          backgroundColor: '#f8fafc',
        }}
      >
        <div className="w-full max-w-sm bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl shadow-rose-900/10 border border-white/50 p-7 space-y-6 animate-in zoom-in-95 duration-300">
          <div className="flex flex-col items-center text-center">
            <img
              src="https://dimsumaditya.id/wp-content/uploads/2026/06/Dimsum-Aditya-New-Logo-scaled.webp"
              alt="Logo Dimsum Aditya"
              className="h-24 w-auto object-contain mb-4 drop-shadow-sm"
            />

            <h2 className="text-xl font-black text-slate-800 tracking-tight">
              Selamat Datang
            </h2>
            <p className="text-xs font-bold text-slate-400 mt-1">
              Silakan login ke akun Anda
            </p>
          </div>

          {loginError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 font-bold text-[11px] flex items-center gap-2 animate-shake">
              <AlertCircle size={14} className="shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 block mb-1.5 uppercase tracking-wider">
                Username
              </label>
              <input
                type="text"
                required
                value={loginForm.username}
                onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
                className="w-full p-3.5 bg-slate-50/50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all normal-case"
                placeholder="Masukkan username"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 block mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                className="w-full p-3.5 bg-slate-50/50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-2.5 mt-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md shadow-red-600/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'Login'}
            </button>
          </form>

          <div className="text-center mt-6 pt-4 border-t border-slate-100 flex flex-col items-center">
            <a
              href="https://dimsumaditya.id"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-600 transition-colors cursor-pointer"
            >
              Dimsum Aditya
            </a>
            <div className="text-[8px] font-bold text-slate-300 mt-1">
              Supplier Dimsum Ayam Tangerang.
            </div>

            <div className="text-[9px] font-black text-red-600 mt-2 tracking-widest uppercase">
              by Dnamic Network
            </div>
          </div>
        </div>

        <ToastNotification toast={toast} onClose={() => setToast(null)} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-screen overflow-hidden bg-transparent select-none">
      <LayoutEngine
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        handleLogout={handleLogout}
      >
        {renderContent()}
      </LayoutEngine>

      {isSyncing && ((dbData.orders || []).length > 0 || (dbData.orders_data || []).length > 0) && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9000] px-3 py-1.5 bg-white/90 backdrop-blur border border-slate-200 rounded-full shadow-sm flex items-center gap-2 animate-in slide-in-from-top-5 fade-in duration-300 pointer-events-none">
          <Loader2 size={12} className="text-red-500 animate-spin" />
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
            Menyinkronkan...
          </span>
        </div>
      )}

      <ToastNotification toast={toast} onClose={() => setToast(null)} />
      <PrintDotMatrix printData={printData} onClose={() => setPrintData(null)} />

      {confirmDialog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center border border-slate-200">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
              <Trash2 size={20} className="text-red-600" />
            </div>

            <h3 className="text-base font-extrabold text-slate-800 mb-1 normal-case">
              Batalkan Transaksi?
            </h3>
            <p className="text-xs text-slate-500 mb-6 font-medium normal-case">
              Data akan di-void dari cloud. Tindakan ini terekam otomatis dalam sistem audit trail.
            </p>

            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2.5 bg-slate-50 text-slate-600 border border-slate-200 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors normal-case cursor-pointer"
              >
                Batal (Esc)
              </button>

              <button
                type="button"
                onClick={handleExecuteDelete}
                className="flex-1 py-2.5 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2 normal-case cursor-pointer"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSaving && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[99999] flex flex-col items-center justify-center">
          <Loader2 size={40} className="text-red-600 animate-spin mb-4" />
          <div className="font-bold text-slate-700 normal-case text-sm animate-pulse">
            Memproses Data...
          </div>
        </div>
      )}
    </div>
  );
}
