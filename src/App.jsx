import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';
import LayoutEngine from './layouts/LayoutEngine';

// Tabs
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

// Print
import PrintDotMatrix from './components/PrintDotMatrix';

const API_URL_GAS = 'https://script.google.com/macros/s/AKfycbyqCaTepk_duXguiOqSM572mbUIGozcghhh8LHNMNw2e83O7Wkyu-SkjdVTO3zpTb64PA/exec';

// Toast Component
const ToastNotification = ({ toast, onClose }) => {
  if (!toast) return null;
  return (
    <div className={`fixed top-4 right-4 z-[9999] px-6 py-3.5 rounded-2xl shadow-xl font-black text-xs uppercase tracking-wide flex items-center gap-2 animate-in slide-in-from-top-5 border duration-200 ${toast.type === 'error' ? 'bg-rose-600 text-white border-rose-500 shadow-rose-600/20' : 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/20'}`}>
      <span>{toast.message}</span>
      <button onClick={onClose} className="ml-4 opacity-60 hover:opacity-100 transition font-mono text-sm">✕</button>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('dimsum_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // Core DB state
  const [dbData, setDbData] = useState({
    orders: [], purchases: [], expenses: [], payments: [], pemalang: [],
    karyawan: [], stockMovements: [], productionBatches: [], supplierLedger: [],
    cashflowTransactions: [], marketplaceSettlement: [], masterBranches: [],
    distributionOrders: [], inventoryCostLayers: [], marketplaceFeeRules: [],
    auditLogs: [], discrepancyLogs: [], chartOfAccounts: [], generalLedger: [],
    financialClosings: [], systemTasks: [], masterProducts: [], masterRawMaterials: [],
    masterRecipeBom: [], masterSuppliers: [], masterConversionRules: [], marketplaceInvoices: [],
    master_branch_types: [], master_branch_capabilities: [], interbranch_treasury: [], 
    branch_settlements: [], master_customers: [], master_locations: []
  });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Fetch All DB
  const fetchAllDatabase = async (currentBranchId, isBackground = false) => {
    if (!API_URL_GAS || API_URL_GAS.includes('URL_WEBAPP_')) return;
    if (!isBackground) setIsLoading(true); 
    try {
      const response = await fetch(`${API_URL_GAS}?action=read_all&branch_id=${currentBranchId || 'ALL'}`);
      const resJson = await response.json();
      if (resJson.status === 'success' && resJson.data) {
        setDbData(prev => ({ ...prev, ...resJson.data }));
      }
    } catch (err) {
      if (!isBackground) showToast('Gagal menyinkronkan data dengan server.', 'error');
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAllDatabase(user.branch_id, false); 
      const syncInterval = setInterval(() => {
        fetchAllDatabase(user.branch_id, true); 
      }, 60000);
      return () => clearInterval(syncInterval);
    }
  }, [user]);

  // Send Data to Sheet
  const sendToSheet = async (action, payload, tableName) => {
    if (!API_URL_GAS || API_URL_GAS.includes('URL_WEBAPP_')) {
      showToast('URL Google Apps Script belum di-set!', 'error'); return false;
    }
    setIsLoading(true);
    try {
      const response = await fetch(API_URL_GAS, {
        method: 'POST',
        body: JSON.stringify({
          action: action, 
          table: tableName, 
          data: payload,
          executor: { name: user?.name || 'SYSTEM', branch_id: user?.branch_id || 'PUSAT' },
          request_id: 'REQ-' + new Date().getTime() + Math.floor(Math.random() * 1000)
        })
      });
      const resJson = await response.json();
      if (resJson.status === 'success') {
        showToast('Data berhasil disimpan ke server!', 'success');
        fetchAllDatabase(user?.branch_id, true);
        return true;
      } else {
        showToast(`Ditolak: ${resJson.message}`, 'error'); return false;
      }
    } catch (err) {
      showToast('Gagal! Koneksi internet terputus.', 'error'); return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Login / Logout
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!API_URL_GAS || API_URL_GAS.includes('URL_WEBAPP_')) { 
      setLoginError('Sistem belum terhubung ke database cloud.'); return; 
    }
    setIsLoading(true); setLoginError('');
    try {
      const response = await fetch(API_URL_GAS, {
        method: 'POST',
        body: JSON.stringify({ action: 'login', data: { username: loginForm.username, password: loginForm.password } })
      });
      const resJson = await response.json();
      if (resJson.status === 'success' && resJson.data?.success) {
        const activeUser = resJson.data.user;
        localStorage.setItem('dimsum_user', JSON.stringify(activeUser));
        setUser(activeUser);
        setActiveTab(activeUser.branch_type === 'HQ_FACTORY' ? 'dashboard' : 'dashboard_branch');
      } else {
        setLoginError(resJson.data?.message || 'Username atau Password salah.');
      }
    } catch (err) {
      setLoginError('Server Offline / Tidak ada koneksi internet.');
    } finally { setIsLoading(false); }
  };

  const handleLogout = () => {
    if (window.confirm("Apakah Anda yakin ingin logout dari sistem?")) {
      localStorage.removeItem('dimsum_user');
      setUser(null); setLoginForm({ username: '', password: '' }); setActiveTab('dashboard');
    }
  };

  // Delete
  const requestDelete = (id) => setConfirmDialog({ id });
  const handleExecuteDelete = async () => {
    if (!confirmDialog) return;
    const isSuccess = await sendToSheet('delete', { id: confirmDialog.id }, 'auto');
    if (isSuccess) setConfirmDialog(null);
  };

  // Render Content + Adapter
  const renderContent = () => {
    let safeTab = activeTab;
    if (activeTab === 'dashboard' && user?.branch_type !== 'HQ_FACTORY') safeTab = 'dashboard_branch';

    // **Adapter Konsisten**
    const adaptedData = {
      orders: dbData.orders || [],
      purchases: dbData.purchases || [],
      expenses: dbData.expenses || [],
      karyawan: dbData.karyawan || [],
      piutangPayments: dbData.payments || [],
      pemalangReports: dbData.branch_settlements || [],
      stokData: dbData.stock_movements || [],
      masterBranches: dbData.master_branches || [],
      inventoryCostLayers: dbData.inventory_cost_layers || [],
      stockMovements: dbData.stock_movements || [],
      supplierLedger: dbData.supplier_ledger || [],
      cashflowTransactions: dbData.cashflow_transactions || [],
      marketplaceSettlement: dbData.marketplace_settlement || [],
      discrepancyLogs: dbData.discrepancy_logs || [],
      financialClosings: dbData.financial_closings || [],
      systemTasks: dbData.system_tasks || [],
      masterProducts: dbData.master_products || [],
      masterRawMaterials: dbData.master_raw_materials || [],
      masterRecipeBom: dbData.master_recipe_bom || [],
      masterSuppliers: dbData.master_suppliers || [],
      masterConversionRules: dbData.master_conversion_rules || [],
      marketplaceFeeRules: dbData.marketplace_fee_rules || [],
      masterCustomers: dbData.master_customers || [],
      masterLocations: dbData.master_locations || []
    };

    const allProps = { ...dbData, ...adaptedData, user, sendToSheet, showToast, requestDelete, setPrintData };

    switch (safeTab) {
      case 'dashboard': return <TabDashboard {...allProps} handleTabChange={setActiveTab} />;
      case 'dashboard_branch': return <TabDashboardBranch {...allProps} />;
      case 'pemalang': return <TabPemalang {...allProps} />;
      case 'cash_war_room': return <TabCashWarRoom {...allProps} />;
      case 'setoran_cabang': return <TabSetoranCabang {...allProps} />;
      case 'scm_war_room': return <TabSCMWarRoom {...allProps} />;
      case 'business_radar': return <TabBusinessRadar {...allProps} />;
      case 'analytics': return <TabAnalytics {...allProps} />;
      case 'orders': return <TabOrders {...allProps} />;
      case 'purchases': return <TabPurchases {...allProps} />;
      case 'expenses': return <TabExpenses {...allProps} />;
      case 'stok': return <TabStok {...allProps} />;
      case 'stok_outlet': return <TabStokOutlet {...allProps} />;
      case 'discrepancy': return <TabDiscrepancy {...allProps} />;
      case 'distribusi': return <TabDistribusi {...allProps} />;
      case 'accounting': return <TabAccounting {...allProps} />;
      case 'accounting_audit': return <TabAccountingAudit {...allProps} />;
      case 'piutang': return <TabPiutang {...allProps} />;
      case 'karyawan': return <TabKaryawan {...allProps} />;
      case 'master_data': return <TabMasterData {...allProps} />;
      case 'monitoring_pemalang': return <TabMonitoringPemalang {...allProps} />;
      case 'kartu_stok': return <TabKartuStok {...allProps} />;
      default: return <TabDashboardBranch {...allProps} />;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
        {/* login UI omitted for brevity */}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-screen overflow-hidden bg-slate-50">
      <LayoutEngine 
        user={user} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        handleLogout={handleLogout}
        masterCapabilities={dbData.master_branch_capabilities}
      >
        {renderContent()}
      </LayoutEngine>
      <ToastNotification toast={toast} onClose={() => setToast(null)} />
      <PrintDotMatrix printData={printData} onClose={() => setPrintData(null)} />
      {confirmDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          {/* dialog content omitted for brevity */}
        </div>
      )}
      {isLoading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center">
          <Loader2 size={48} className="text-red-600 animate-spin mb-4" />
          <div className="font-black text-slate-800 tracking-widest uppercase text-sm animate-pulse">Menyinkronkan Server...</div>
        </div>
      )}
    </div>
  );
}
