import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';
import LayoutEngine from './layouts/LayoutEngine';
import TabDashboard from './components/tabs/TabDashboard';
import TabDashboardBranch from './components/tabs/TabDashboardBranch';
import TabOrders from './components/tabs/TabOrders';
import TabPurchases from './components/tabs/TabPurchases';
import TabExpenses from './components/tabs/TabExpenses';
import TabPiutang from './components/tabs/TabPiutang';
import TabPemalang from './components/tabs/TabPemalang';
import TabStok from './components/tabs/TabStok';
import TabDistribusi from './components/tabs/TabDistribusi';
import TabKaryawan from './components/tabs/TabKaryawan';
import TabMonitoringPemalang from './components/tabs/TabMonitoringPemalang';
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
import PrintDotMatrix from './components/PrintDotMatrix';
import { allocateRevenue, checkRevenueStatus } from './utils/CoreBusinessEngine';

const API_URL_GAS = 'YOUR_GAS_URL';

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
    const saved = localStorage.getItem('dimsum_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [loginForm, setLoginForm] = useState({ username:'', password:'' });
  const [loginError, setLoginError] = useState('');

  const [dbData, setDbData] = useState({ /* semua state dbData seperti sebelumnya */ });
  
  // ====== Core Business ======
  const [coreAllocation, setCoreAllocation] = useState(null);
  const [coreStatus, setCoreStatus] = useState(null);

  const showToast = useCallback((message,type='success')=> {
    setToast({message,type}); setTimeout(()=>setToast(null),3500);
  },[]);

  // ====== Fetch Database ======
  const fetchAllDatabase = async (branchId, isBackground=false)=>{
    if (!API_URL_GAS.includes('URL_WEBAPP_')) return;
    if(!isBackground) setIsLoading(true);
    try {
      const res = await fetch(`${API_URL_GAS}?action=read_all&branch_id=${branchId||'ALL'}`);
      const json = await res.json();
      if(json.status==='success' && json.data) setDbData(prev=>({...prev,...json.data}));
    } catch { if(!isBackground) showToast('Gagal menyinkron server','error'); }
    finally { if(!isBackground) setIsLoading(false);}
  };

  useEffect(()=>{
    if(user){
      fetchAllDatabase(user.branch_id,false);
      const interval=setInterval(()=>fetchAllDatabase(user.branch_id,true),60000);
      return ()=>clearInterval(interval);
    }
  },[user]);

  // ====== Send to Sheet ======
  const sendToSheet = async (action,payload,tableName)=>{
    if(API_URL_GAS.includes('URL_WEBAPP_')) { showToast('URL GAS belum di-set','error'); return false;}
    setIsLoading(true);
    try{
      const res=await fetch(API_URL_GAS,{method:'POST',body:JSON.stringify({
        action,table:tableName,data:payload,
        executor:{name:user?.name||'SYSTEM',branch_id:user?.branch_id||'PUSAT'},
        request_id:'REQ-'+new Date().getTime()+Math.floor(Math.random()*1000)
      })});
      const json=await res.json();
      if(json.status==='success'){ showToast('Data berhasil disimpan!','success'); fetchAllDatabase(user?.branch_id,true); return true;}
      else{ showToast(`Ditolak: ${json.message}`,'error'); return false;}
    } catch { showToast('Gagal! Koneksi putus','error'); return false; }
    finally{ setIsLoading(false); }
  };

  // ====== Login / Logout ======
  const handleLoginSubmit = async (e)=>{
    e.preventDefault();
    if(API_URL_GAS.includes('URL_WEBAPP_')){setLoginError('Belum terhubung cloud'); return;}
    setIsLoading(true); setLoginError('');
    try{
      const res=await fetch(API_URL_GAS,{method:'POST',body:JSON.stringify({action:'login',data:loginForm})});
      const json=await res.json();
      if(json.status==='success' && json.data?.success){
        const u=json.data.user;
        localStorage.setItem('dimsum_user',JSON.stringify(u));
        setUser(u); setActiveTab(u.branch_type==='HQ_FACTORY'?'dashboard':'dashboard_branch');
      } else setLoginError(json.data?.message||'Username/Password salah');
    } catch { setLoginError('Server offline / koneksi putus'); }
    finally{ setIsLoading(false);}
  };
  const handleLogout=()=>{if(window.confirm('Logout?')){localStorage.removeItem('dimsum_user'); setUser(null); setLoginForm({username:'',password:''}); setActiveTab('dashboard');}};

  // ====== Delete ======
  const requestDelete=id=>setConfirmDialog({id});
  const handleExecuteDelete=async()=>{
    if(!confirmDialog) return;
    const s=await sendToSheet('delete',{id:confirmDialog.id},'auto');
    if(s) setConfirmDialog(null);
  };

  // ====== Hitung Core Business ======
  useEffect(()=>{
    if(dbData.orders && dbData.orders.length>0){
      const totalRevenue=dbData.orders.reduce((s,o)=>s+(o.total_amount||o.total||0),0);
      const allocation=allocateRevenue(totalRevenue);
      const status=checkRevenueStatus(allocation);
      setCoreAllocation(allocation); setCoreStatus(status);
    }
  },[dbData.orders]);

  // ====== Render Content ======
  const renderContent=()=>{
    const safeTab=activeTab==='dashboard' && user?.branch_type!=='HQ_FACTORY' ? 'dashboard_branch':activeTab;

    const adaptedData={
      ...dbData,
      orders: dbData.orders||[],
      purchases: dbData.purchases||[],
      expenses: dbData.expenses||[],
      karyawan: dbData.karyawan||[],
      piutangPayments: dbData.payments||[],
      pemalangReports: dbData.branch_settlements||[],
      stokData: dbData.stock_movements||[]
    };

    switch(safeTab){
      case 'dashboard': return <TabDashboard user={user} handleTabChange={setActiveTab} {...adaptedData} coreAllocation={coreAllocation} coreStatus={coreStatus}/>;
      case 'dashboard_branch': return <TabDashboardBranch user={user} setPrintData={setPrintData} {...adaptedData} coreAllocation={coreAllocation} coreStatus={coreStatus}/>;
      // tab lainnya tetap {...dbData} + {...adaptedData}
      default: return <TabDashboardBranch user={user} {...adaptedData} coreAllocation={coreAllocation} coreStatus={coreStatus}/>;
    }
  };

  if(!user) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* UI login */}
    </div>
  );

  return (
    <div className="fixed inset-0 w-full h-screen overflow-hidden bg-slate-50">
      <LayoutEngine user={user} activeTab={activeTab} setActiveTab={setActiveTab} handleLogout={handleLogout} masterCapabilities={dbData.master_branch_capabilities}>
        {renderContent()}
      </LayoutEngine>
      <ToastNotification toast={toast} onClose={()=>setToast(null)}/>
      <PrintDotMatrix printData={printData} onClose={()=>setPrintData(null)}/>
      {confirmDialog && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/60">
          {/* confirm delete UI */}
        </div>
      )}
      {isLoading && (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-white/80">
          <Loader2 size={48} className="animate-spin text-red-600 mb-4"/>
          <div className="animate-pulse font-black uppercase text-sm tracking-widest">Menyinkronkan Server...</div>
        </div>
      )}
    </div>
  );
}
