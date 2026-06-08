import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

// =====================================
// IMPOR LAYOUT (BERDASARKAN ROLE)
// =====================================
import LayoutHQFactory from './layouts/LayoutHQFactory';
import LayoutProductionBranch from './layouts/LayoutProductionBranch';
import LayoutOutletResto from './layouts/LayoutOutletResto';

// =====================================
// IMPOR SEMUA TAB COMPONENTS
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
import TabStokOutlet from './components/tabs/TabStokOutlet'; // Komponen Baru Phase 12.5

// =====================================
// IMPOR KOMPONEN PENDUKUNG
// =====================================
import PrintDotMatrix from './components/PrintDotMatrix';

// (Opsional) Jika Anda punya komponen Toast terpisah:
const ToastNotification = ({ toast, onClose }) => {
  if (!toast) return null;
  return (
    <div className={`fixed top-4 right-4 z-[9999] px-6 py-3 rounded-xl shadow-xl font-bold text-sm flex items-center gap-2 animate-in slide-in-from-top-5 ${toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
      <span>{toast.message}</span>
      <button onClick={onClose} className="ml-4 opacity-70 hover:opacity-100 font-black">X</button>
    </div>
  );
};

export default function App() {
  // =====================================
  // STATE SISTEM & USER
  // =====================================
  // Ganti initial state user sesuai mekanisme login Anda. 
  // Contoh Bypass Login untuk UAT (Hapus jika menggunakan form login asli):
  const [user, setUser] = useState({
    name: 'Super Admin',
    username: 'admin',
    branch_id: 'PUSAT',
    branch_type: 'HQ_FACTORY', // 'HQ_FACTORY' | 'PRODUCTION_BRANCH' | 'OUTLET_RESTO'
    role: 'super_admin'
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // =====================================
  // STATE DATA DATABASE (DARI GOOGLE SHEETS)
  // =====================================
  const [data, setData] = useState({
    orders: [], purchases: [], expenses: [], payments: [], pemalang: [],
    karyawan: [], stockMovements: [], productionBatches: [], supplierLedger: [],
    cashflowTransactions: [], marketplaceSettlement: [], masterBranches: [],
    distributionOrders: [], inventoryCostLayers: [], marketplaceFeeRules: [],
    auditLogs: [], discrepancyLogs: [], chartOfAccounts: [], generalLedger: [],
    financialClosings: [], systemTasks: [], masterProducts: [], masterRawMaterials: [],
    masterRecipeBom: [], masterSuppliers: [], masterConversionRules: [], marketplaceInvoices: []
  });

  // =====================================
  // FUNGSI HELPER GLOBAL
  // =====================================
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleLogout = () => {
    const confirmOut = window.confirm("Apakah Anda yakin ingin keluar dari sistem?");
    if (confirmOut) {
      setUser(null);
      // Hapus token/localStorage jika ada
    }
  };

  // Dummy / Placeholder fungsi sendToSheet (Ganti dengan fetch ke API Google Apps Script Anda)
  const sendToSheet = async (action, payload, table) => {
    setIsLoading(true);
    try {
      // TODO: Masukkan script fetch API GAS Anda di sini
      console.log(`[SIMULASI API] Action: ${action}, Table: ${table}`, payload);
      
      // Simulasi delay jaringan
      await new Promise(res => setTimeout(res, 800));
      showToast(`Data berhasil disimpan ke ${table}`, 'success');
      return true;
    } catch (error) {
      showToast('Gagal memproses data!', 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const requestDelete = (id) => {
    setConfirmDialog({ id });
  };

  const handleExecuteDelete = async () => {
    if (!confirmDialog) return;
    await sendToSheet('delete', { id: confirmDialog.id }, 'auto');
    setConfirmDialog(null);
  };

  // =====================================
  // LOGIC RENDER TABS
  // =====================================
  const renderContent = () => {
    switch (activeTab) {
      // EXECUTIVE & DASHBOARD
      case 'dashboard': return <TabDashboard user={user} handleTabChange={setActiveTab} {...data} />;
      case 'dashboard_branch': return <TabDashboardBranch user={user} setPrintData={setPrintData} {...data} />;
      case 'cash_war_room': return <TabCashWarRoom user={user} {...data} />;
      case 'scm_war_room': return <TabSCMWarRoom user={user} {...data} />;
      case 'business_radar': return <TabBusinessRadar user={user} {...data} />;
      case 'analytics': return <TabAnalytics user={user} {...data} />;
      
      // CORE OPERATIONS
      case 'orders': return <TabOrders user={user} role={user?.role} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={requestDelete} showToast={showToast} {...data} />;
      case 'purchases': return <TabPurchases user={user} sendToSheet={sendToSheet} showToast={showToast} {...data} />;
      case 'expenses': return <TabExpenses user={user} sendToSheet={sendToSheet} showToast={showToast} {...data} />;
      
      // PRODUCTION & LOGISTICS
      case 'stok': return <TabStok user={user} role={user?.role} sendToSheet={sendToSheet} requestDelete={requestDelete} showToast={showToast} {...data} />;
      case 'stok_outlet': return <TabStokOutlet user={user} sendToSheet={sendToSheet} showToast={showToast} {...data} />; // TAB BARU OUTLET
      case 'distribusi': return <TabDistribusi user={user} sendToSheet={sendToSheet} setPrintData={setPrintData} {...data} />;
      
      // FINANCE & HR
      case 'accounting': return <TabAccounting user={user} {...data} />;
      case 'accounting_audit': return <TabAccountingAudit user={user} {...data} />;
      case 'piutang': return <TabPiutang user={user} role={user?.role} sendToSheet={sendToSheet} setPrintData={setPrintData} {...data} />;
      case 'karyawan': return <TabKaryawan user={user} sendToSheet={sendToSheet} setPrintData={setPrintData} showToast={showToast} {...data} />;
      
      // SYSTEM & MASTER
      case 'master_data': return <TabMasterData user={user} sendToSheet={sendToSheet} showToast={showToast} {...data} />;
      case 'pemalang': return <TabPemalang user={user} sendToSheet={sendToSheet} {...data} />;
      case 'monitoring_pemalang': return <TabMonitoringPemalang user={user} {...data} />;
      
      default: return <TabDashboard user={user} handleTabChange={setActiveTab} {...data} />;
    }
  };

  // =====================================
  // RENDER APP
  // =====================================
  
  // Jika belum login, tampilkan layar login sederhana (Mencegah Blank Screen)
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center">
          <h1 className="text-2xl font-black text-slate-800 mb-2 uppercase">Dimsum Aditya</h1>
          <p className="text-sm font-bold text-slate-500 mb-6">Enterprise ERP Login</p>
          <button onClick={() => setUser({ name: 'Admin Pusat', username: 'admin', branch_id: 'PUSAT', branch_type: 'HQ_FACTORY', role: 'super_admin' })} className="w-full bg-blue-600 text-white font-black py-3 rounded-xl hover:bg-blue-700 transition">
            Login UAT (Pusat)
          </button>
          <button onClick={() => setUser({ name: 'Kasir Toko', username: 'kasir', branch_id: 'OUTLET_1', branch_type: 'OUTLET_RESTO', role: 'branch' })} className="w-full bg-orange-600 text-white font-black py-3 rounded-xl hover:bg-orange-700 transition mt-3">
            Login UAT (Outlet)
          </button>
        </div>
      </div>
    );
  }

  // Pilih Layout berdasarkan tipe cabang User
  let LayoutComponent = LayoutHQFactory;
  if (user?.branch_type === 'OUTLET_RESTO') {
    LayoutComponent = LayoutOutletResto;
  } else if (user?.branch_type === 'PRODUCTION_BRANCH') {
    LayoutComponent = LayoutProductionBranch;
  }

  return (
    <>
      <LayoutComponent 
        user={user} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        handleLogout={handleLogout}
      >
        {/* Render Tab yang Aktif */}
        {renderContent()}
      </LayoutComponent>

      {/* Komponen Mengambang (Floating/Overlay) */}
      <ToastNotification toast={toast} onClose={() => setToast(null)} />
      <PrintDotMatrix printData={printData} onClose={() => setPrintData(null)} />
      
      {/* Dialog Konfirmasi Hapus */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center border">
            <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={24} className="text-rose-600" />
            </div>
            <h3 className="text-base font-black text-slate-800 mb-1">Konfirmasi Aksi</h3>
            <p className="text-xs text-slate-500 mb-5 font-bold">Apakah Anda yakin ingin memproses/menghapus data ini?</p>
            <div className="flex gap-2 justify-center">
              <button type="button" onClick={() => setConfirmDialog(null)} className="w-1/2 px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition">Batal (ESC)</button>
              <button type="button" onClick={handleExecuteDelete} className="w-1/2 px-4 py-2.5 bg-rose-600 text-white font-black text-xs rounded-xl hover:bg-rose-700 transition">Ya, Lanjutkan</button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center">
          <Loader2 size={48} className="text-blue-600 animate-spin mb-4" />
          <div className="font-black text-slate-800 tracking-widest uppercase text-sm animate-pulse">Menyinkronkan Data...</div>
        </div>
      )}
    </>
  );
}
