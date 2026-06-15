import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';

import LayoutEngine from './layouts/LayoutEngine';
import TabDashboard from './components/tabs/TabDashboard';
import TabOrders from './components/tabs/TabOrders';
import TabPurchases from './components/tabs/TabPurchases';
import TabSupplierAyam from './components/tabs/TabSupplierAyam'; 
import TabExpenses from './components/tabs/TabExpenses';
import TabPiutang from './components/tabs/TabPiutang';
import TabPemalang from './components/tabs/TabPemalang';
import TabStok from './components/tabs/TabStok';
import TabDistribusi from './components/tabs/TabDistribusi';
import TabKaryawan from './components/tabs/TabKaryawan';
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

// 🔥 CONNECTED CORE CRM
import TabMasterCustomer from './components/tabs/TabMasterCustomer';
import TabMonitoringCabangUniversal from './components/tabs/TabMonitoringCabangUniversal';
import PrintDotMatrix from './components/PrintDotMatrix';

const API_URL_GAS = 'https://script.google.com/macros/s/AKfycbyqCaTepk_duXguiOqSM572mbUIGozcghhh8LHNMNw2e83O7Wkyu-SkjdVTO3zpTb64PA/exec';

const ToastNotification = ({ toast, onClose }) => {
  if (!toast) return null;
  return (
    <div className={`fixed top-4 right-4 z-[9999] px-5 py-3.5 rounded-xl shadow-lg font-bold text-xs normal-case flex items-center gap-3 animate-in slide-in-from-top-5 border duration-200 ${toast.type === 'error' ? 'bg-red-600 text-white border-red-700 shadow-red-600/20' : 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-600/20'}`}>
      <span>{toast.message}</span>
      <button onClick={onClose} className="opacity-70 hover:opacity-100 transition-opacity font-bold text-base">✕</button>
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
      if (!isBackground) showToast('Gagal menyinkronkan data dengan server cloud.', 'error');
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

  const sendToSheet = async (action, payload, tableName) => {
    if (!API_URL_GAS || API_URL_GAS.includes('URL_WEBAPP_')) {
      showToast('URL Google Apps Script belum terkonfigurasi!', 'error'); return false;
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
        showToast('Data berhasil diamankan ke cloud database!', 'success');
        fetchAllDatabase(user?.branch_id, true); 
        return true;
      } else {
        showToast(`Ditolak sistem: ${resJson.message}`, 'error'); return false;
      }
    } catch (err) {
      showToast('Koneksi internet terputus!', 'error'); return false;
    } finally {
      document.body.style.overflow = 'unset';
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true); 
    setLoginError('');

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
        setLoginError(resJson.data?.message || 'Identitas otentikasi salah.');
      }
    } catch (err) {
      setLoginError('Koneksi database pusat terputus.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Apakah Anda yakin ingin keluar dari sistem?")) {
      localStorage.removeItem('dimsum_user');
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

    switch (safeTab) {
      case 'dashboard': 
        return <TabDashboard user={user} setActiveTab={setActiveTab} showToast={showToast} {...dbData} />;
      case 'monitoring_cabang':
        return <TabMonitoringCabangUniversal user={user} setPrintData={setPrintData} {...dbData} />;
      case 'dashboard_branch': 
        return <TabDashboardBranch user={user} setPrintData={setPrintData} {...dbData} />;
      case 'pemalang': 
        return <TabPemalang user={user} sendToSheet={sendToSheet} {...dbData} />;
      case 'cash_war_room': 
        return <TabCashWarRoom user={user} sendToSheet={sendToSheet} showToast={showToast} {...dbData} />;
      case 'setoran_cabang': 
        return <TabSetoranCabang user={user} sendToSheet={sendToSheet} showToast={showToast} {...dbData} />; 
      case 'scm_war_room': 
        return <TabSCMWarRoom user={user} {...dbData} />;
      case 'business_radar': 
        return <TabBusinessRadar user={user} {...dbData} />;
      case 'analytics': 
        return <TabAnalytics user={user} {...dbData} />;
      case 'orders': 
        return <TabOrders user={user} sendToSheet={sendToSheet} setPrintData={setPrintData} showToast={showToast} {...dbData} />;
      
      // 🔥 FIX: KABEL SINKRONISASI sendToSheet SUDAH TERSAMBUNG DI SINI!
      case 'master_customer':
        return <TabMasterCustomer user={user} sendToSheet={sendToSheet} setPrintData={setPrintData} showToast={showToast} {...dbData} />;

      case 'purchases': 
        return <TabPurchases user={user} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={requestDelete} showToast={showToast} masterSuppliers={dbData.masterSuppliers} {...dbData} />;
      case 'supplier_ayam': 
        return <TabSupplierAyam user={user} sendToSheet={sendToSheet} showToast={showToast} {...dbData} />;
      case 'expenses': 
        return <TabExpenses user={user} sendToSheet={sendToSheet} showToast={showToast} {...dbData} />;
      case 'stok': 
        return <TabStok user={user} role={user?.role} sendToSheet={sendToSheet} requestDelete={requestDelete} setPrintData={setPrintData} showToast={showToast} {...dbData} />;
      case 'stok_outlet': 
        return <TabStokOutlet user={user} sendToSheet={sendToSheet} showToast={showToast} {...dbData} />;
      case 'discrepancy': 
        return <TabDiscrepancy user={user} sendToSheet={sendToSheet} showToast={showToast} {...dbData} />;
      case 'distribusi': 
        return <TabDistribusi user={user} sendToSheet={sendToSheet} setPrintData={setPrintData} showToast={showToast} {...dbData} />;
      case 'accounting': 
        return <TabAccounting user={user} {...dbData} />;
      case 'accounting_audit': 
        return <TabAccountingAudit user={user} {...dbData} />;
      case 'piutang': 
        return <TabPiutang user={user} role={user?.role} sendToSheet={sendToSheet} setPrintData={setPrintData} showToast={showToast} {...dbData} />;
      case 'karyawan': 
        return <TabKaryawan user={user} sendToSheet={sendToSheet} setPrintData={setPrintData} showToast={showToast} {...dbData} />;
      case 'master_data': 
        return <TabMasterData user={user} sendToSheet={sendToSheet} showToast={showToast} {...dbData} />;
      case 'kartu_stok': 
        return <TabKartuStok user={user} {...dbData} />;
      default: 
        return <TabDashboardBranch user={user} {...dbData} />;
    }
  };

  return (
    <div className="fixed inset-0 w-full h-screen overflow-hidden bg-transparent select-none">
      <LayoutEngine user={user} activeTab={activeTab} setActiveTab={setActiveTab} handleLogout={handleLogout}>
        {renderContent()}
      </LayoutEngine>

      <ToastNotification toast={toast} onClose={() => setToast(null)} />
      <PrintDotMatrix printData={printData} onClose={() => setPrintData(null)} />
      
      {confirmDialog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center border border-slate-200">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
              <Trash2 size={20} className="text-red-600" />
            </div>
            <h3 className="text-base font-extrabold text-slate-800 mb-1 normal-case">Batalkan Transaksi?</h3>
            <p className="text-xs text-slate-500 mb-6 font-medium normal-case">Data akan di-void dari cloud. Tindakan ini terekam otomatis dalam sistem audit trail.</p>
            <div className="flex gap-3 justify-center">
              <button type="button" onClick={() => setConfirmDialog(null)} className="flex-1 py-2.5 bg-slate-50 text-slate-600 border border-slate-200 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors normal-case">Batal (Esc)</button>
              <button type="button" onClick={handleExecuteDelete} className="flex-1 py-2.5 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2 normal-case">
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[99999] flex flex-col items-center justify-center">
          <Loader2 size={40} className="text-red-600 animate-spin mb-4" />
          <div className="font-bold text-slate-700 normal-case text-sm animate-pulse">Menyinkronkan Server Cloud...</div>
        </div>
      )}
    </div>
  );
}
