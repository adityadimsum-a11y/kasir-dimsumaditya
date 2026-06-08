import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Loader2, ShieldCheck, Trash2 } from 'lucide-react';

// =====================================
// IMPOR LAYOUT (ROLE CONTROL)
// =====================================
import LayoutHQFactory from './layouts/LayoutHQFactory';
import LayoutProductionBranch from './layouts/LayoutProductionBranch';
import LayoutOutletResto from './layouts/LayoutOutletResto';

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

// =====================================
// IMPOR KOMPONEN CETAK
// =====================================
import PrintDotMatrix from './components/PrintDotMatrix';

// ⚠️ WAJIB GANTI DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA ⚠️
const API_URL_GAS = 'https://script.google.com/macros/s/AKfycbyqCaTepk_duXguiOqSM572mbUIGozcghhh8LHNMNw2e83O7Wkyu-SkjdVTO3zpTb64PA/exec';

// =====================================
// FLOATING NOTIFICATION SYSTEM (TOAST)
// =====================================
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
  // =====================================
  // CORE APP STATES (PERSISTENT SESSION)
  // =====================================
  const [user, setUser] = useState(() => {
    // Tarik memori sesi agar tidak ke-logout saat di-refresh
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

  // =====================================
  // DATA MASTER & TRANSAKSI STATE
  // =====================================
  const [dbData, setDbData] = useState({
    orders: [], purchases: [], expenses: [], payments: [], pemalang: [],
    karyawan: [], stockMovements: [], productionBatches: [], supplierLedger: [],
    cashflowTransactions: [], marketplaceSettlement: [], masterBranches: [],
    distributionOrders: [], inventoryCostLayers: [], marketplaceFeeRules: [],
    auditLogs: [], discrepancyLogs: [], chartOfAccounts: [], generalLedger: [],
    financialClosings: [], systemTasks: [], masterProducts: [], masterRawMaterials: [],
    masterRecipeBom: [], masterSuppliers: [], masterConversionRules: [], marketplaceInvoices: []
  });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // =====================================
  // ENGINE 1: METODE PENARIKAN DATA (READ)
  // =====================================
  const fetchAllDatabase = async (currentBranchId, isBackground = false) => {
    if (!API_URL_GAS || API_URL_GAS.includes('URL_WEBAPP_')) return;
    
    // Jangan tampilkan loading layar penuh jika ini adalah background sync
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

  // Sinkronisasi diam-diam (Background Sync) berjalan otomatis
  useEffect(() => {
    if (user) {
      // Tarik data saat baru buka aplikasi (muncul loading)
      fetchAllDatabase(user.branch_id, false); 
      
      // Interval penarikan data diam-diam setiap 1 Menit (60.000 ms)
      const syncInterval = setInterval(() => {
        fetchAllDatabase(user.branch_id, true); 
      }, 60000);
      
      return () => clearInterval(syncInterval);
    }
  }, [user]);

  // =====================================
  // ENGINE 2: PENGIRIMAN DATA (WRITE)
  // =====================================
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
        showToast('Data berhasil disimpan ke cloud!', 'success');
        // Update data diam-diam di background setelah sukses
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

  // =====================================
  // ENGINE 3: AUTENTIKASI (LOGIN & LOGOUT)
  // =====================================
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!API_URL_GAS || API_URL_GAS.includes('URL_WEBAPP_')) { 
      setLoginError('Sistem belum terhubung ke database cloud.'); return; 
    }
    
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
        
        // Simpan sesi ke penyimpanan browser (agar tidak ter-logout saat refresh)
        localStorage.setItem('dimsum_user', JSON.stringify(activeUser));
        setUser(activeUser);
        
        // Arahkan dashboard sesuai role
        setActiveTab(activeUser.branch_type === 'OUTLET_RESTO' || activeUser.branch_type === 'PRODUCTION_BRANCH' ? 'dashboard_branch' : 'dashboard');
      } else {
        setLoginError(resJson.data?.message || 'Username atau Password salah.');
      }
    } catch (err) {
      setLoginError('Server Offline / Tidak ada koneksi internet.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Apakah Anda yakin ingin logout dari sistem?")) {
      // Hapus data sesi dari browser
      localStorage.removeItem('dimsum_user');
      setUser(null);
      setLoginForm({ username: '', password: '' });
      setActiveTab('dashboard');
    }
  };

  // =====================================
  // ENGINE 4: GLOBAL DELETE (VOID TRANSAKSI)
  // =====================================
  const requestDelete = (id) => setConfirmDialog({ id });
  
  const handleExecuteDelete = async () => {
    if (!confirmDialog) return;
    // Panggil action delete dengan table 'auto' agar backend yang mencari letak datanya
    const isSuccess = await sendToSheet('delete', { id: confirmDialog.id }, 'auto');
    if (isSuccess) setConfirmDialog(null);
  };

  // =====================================
  // GATEKEEPER ROUTING (TAB RENDER)
  // =====================================
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <TabDashboard user={user} handleTabChange={setActiveTab} {...dbData} />;
      case 'dashboard_branch': return <TabDashboardBranch user={user} setPrintData={setPrintData} {...dbData} />;
      case 'cash_war_room': return <TabCashWarRoom user={user} {...dbData} />;
      case 'scm_war_room': return <TabSCMWarRoom user={user} {...dbData} />;
      case 'business_radar': return <TabBusinessRadar user={user} {...dbData} />;
      case 'analytics': return <TabAnalytics user={user} {...dbData} />;
      case 'orders': return <TabOrders user={user} role={user?.role} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={requestDelete} showToast={showToast} {...dbData} />;
      case 'purchases': return <TabPurchases user={user} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={requestDelete} showToast={showToast} {...dbData} />;
      case 'expenses': return <TabExpenses user={user} sendToSheet={sendToSheet} showToast={showToast} {...dbData} />;
      case 'stok': return <TabStok user={user} role={user?.role} sendToSheet={sendToSheet} requestDelete={requestDelete} showToast={showToast} {...dbData} />;
      case 'stok_outlet': return <TabStokOutlet user={user} sendToSheet={sendToSheet} showToast={showToast} {...dbData} />;
      case 'distribusi': return <TabDistribusi user={user} sendToSheet={sendToSheet} setPrintData={setPrintData} {...dbData} />;
      case 'accounting': return <TabAccounting user={user} {...dbData} />;
      case 'accounting_audit': return <TabAccountingAudit user={user} {...dbData} />;
      case 'piutang': return <TabPiutang user={user} role={user?.role} sendToSheet={sendToSheet} setPrintData={setPrintData} {...dbData} />;
      case 'karyawan': return <TabKaryawan user={user} sendToSheet={sendToSheet} setPrintData={setPrintData} showToast={showToast} {...dbData} />;
      case 'master_data': return <TabMasterData user={user} sendToSheet={sendToSheet} showToast={showToast} {...dbData} />;
      case 'pemalang': return <TabPemalang user={user} sendToSheet={sendToSheet} {...dbData} />;
      case 'monitoring_pemalang': return <TabMonitoringPemalang user={user} {...dbData} />;
      default: return <TabDashboard user={user} handleTabChange={setActiveTab} {...dbData} />;
    }
  };

  // =====================================
  // UI 1: GERBANG LOGIN JIKA BELUM OTENTIK
  // =====================================
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, #3b82f6 0%, transparent 70%)' }}></div>
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full relative z-10 border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30">
              <ShieldCheck size={32} className="text-white"/>
            </div>
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-wide">Dimsum Aditya</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sistem ERP Internal</p>
          </div>

          {loginError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold p-3 rounded-xl mb-4 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0"/> {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Username</label>
              <input type="text" required value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition" placeholder="Masukkan username" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Password</label>
              <input type="password" required value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition" placeholder="••••••••" />
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 uppercase tracking-wide text-xs mt-2 disabled:opacity-50 flex justify-center items-center gap-2">
              {isLoading ? <><Loader2 size={16} className="animate-spin"/> Memverifikasi...</> : 'Masuk Sistem'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // =====================================
  // UI 2: RENDER APLIKASI (LAYOUT)
  // =====================================
  let LayoutComponent = LayoutHQFactory;
  if (user?.branch_type === 'OUTLET_RESTO') LayoutComponent = LayoutOutletResto;
  else if (user?.branch_type === 'PRODUCTION_BRANCH') LayoutComponent = LayoutProductionBranch;

  return (
    <>
      <LayoutComponent user={user} activeTab={activeTab} setActiveTab={setActiveTab} handleLogout={handleLogout}>
        {renderContent()}
      </LayoutComponent>

      {/* Komponen Floating */}
      <ToastNotification toast={toast} onClose={() => setToast(null)} />
      <PrintDotMatrix printData={printData} onClose={() => setPrintData(null)} />
      
      {/* Dialog Konfirmasi Hapus Data (Void) */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center border">
            <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-rose-600" />
            </div>
            <h3 className="text-base font-black text-slate-800 mb-1">Batalkan Transaksi?</h3>
            <p className="text-xs text-slate-500 mb-5 font-bold">Data akan di-void dari sistem. Aksi ini akan terekam dalam audit trail.</p>
            <div className="flex gap-2 justify-center">
              <button type="button" onClick={() => setConfirmDialog(null)} className="w-1/2 px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition">Batal (ESC)</button>
              <button type="button" onClick={handleExecuteDelete} className="w-1/2 px-4 py-2.5 bg-rose-600 text-white font-black text-xs rounded-xl hover:bg-rose-700 transition flex items-center justify-center gap-2">
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Layar Loading - HANYA MUNCUL SAAT SUBMIT / DELETE */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center">
          <Loader2 size={48} className="text-blue-600 animate-spin mb-4" />
          <div className="font-black text-slate-800 tracking-widest uppercase text-sm animate-pulse">Menyinkronkan Server...</div>
        </div>
      )}
    </>
  );
}
