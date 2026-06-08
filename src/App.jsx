import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Wallet, Clock, Store, Loader2, LogOut, 
  Package, Truck, Users, AlertCircle, Activity, Send, ShieldAlert, TrendingUp, 
  WifiOff, PieChart, Menu, X, Search, Bell, CheckCircle, Radar, BookOpen, ShieldCheck, Database
} from 'lucide-react';

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
import PrintDotMatrix from './components/PrintDotMatrix';

import { generateRequestId } from './utils/helpers'; 

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyqCaTepk_duXguiOqSM572mbUIGozcghhh8LHNMNw2e83O7Wkyu-SkjdVTO3zpTb64PA/exec'; 

// =====================================================================
// CENTRAL ROLES & CAPABILITY CONFIG
// =====================================================================
const CAPABILITY_CONFIG = {
  'HQ_FACTORY': { can_production: true, can_supplier: true, can_global_dashboard: true, can_pos: true, can_distribute: true, can_hrd: true, can_treasury: true, can_scm_warroom: true, can_analytics: true, can_radar: true, can_accounting: true, can_audit: true, can_master_data: true },
  'PRODUCTION_BRANCH': { can_production: true, can_supplier: false, can_global_dashboard: false, can_pos: true, can_distribute: true, can_hrd: false, can_treasury: false, can_scm_warroom: false, can_analytics: false, can_radar: false, can_accounting: false, can_audit: false, can_master_data: false },
  'OUTLET_RESTO': { can_production: false, can_supplier: false, can_global_dashboard: false, can_pos: true, can_distribute: false, can_hrd: false, can_treasury: false, can_scm_warroom: false, can_analytics: false, can_radar: false, can_accounting: false, can_audit: false, can_master_data: false }
};

const CACHE_TTL = 30000; // 30 Detik Memory Cache Layer
let globalCache = { data: null, timestamp: 0 };

function NavItem({ icon, label, active, onClick, badge, disabled }) {
  return (
    <button 
      disabled={disabled} 
      onClick={onClick} 
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-xs font-bold ${disabled ? 'opacity-30 cursor-not-allowed' : ''} ${active ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
    >
      {icon} <span className="flex-1 text-left tracking-wide">{label}</span>
      {badge > 0 && <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{badge}</span>}
    </button>
  );
}

// =====================================================================
// GLOBAL TOAST NOTIFICATION COMPONENT
// =====================================================================
function ToastNotification({ toast, onClose }) {
  useEffect(() => { if(toast) { const timer = setTimeout(onClose, 3500); return () => clearTimeout(timer); } }, [toast, onClose]);
  if (!toast) return null;
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-5 text-xs font-black border ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
      {toast.type === 'success' ? <CheckCircle size={16} className="text-emerald-600"/> : <AlertCircle size={16} className="text-rose-600"/>}
      <span className="max-w-xs uppercase tracking-wide">{toast.message}</span>
      <button onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-600"><X size={14}/></button>
    </div>
  );
}

// =====================================================================
// UNIVERSAL NODE ARCHITECTURE LAYOUT
// =====================================================================
function UniversalNodeLayout({ user, activeTab, handleTabChange, handleLogout, data, sendToSheet, setPrintData, setConfirmDialog, isLoading, isOffline, showToast }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const caps = user.permissions;
  const pendingDO = data.distributionOrders?.filter(d => d.status === 'DIKIRIM' || d.status === 'IN_TRANSIT').length || 0;
  const incomingDO = data.distributionOrders?.filter(d => (d.status === 'DIKIRIM' || d.status === 'IN_TRANSIT') && d.to_branch === user.branch_id).length || 0;

  const navigateTab = (tab) => { handleTabChange(tab); setIsMobileMenuOpen(false); };
  const roleColor = user.branch_type === 'HQ_FACTORY' ? 'text-emerald-400 bg-emerald-400/10' : user.branch_type === 'PRODUCTION_BRANCH' ? 'text-purple-400 bg-purple-400/10' : 'text-orange-400 bg-orange-400/10';

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden pointer-events-auto">
      {isLoading && <div className="fixed inset-0 z-[100] bg-slate-900/10 backdrop-blur-[1px] cursor-wait flex items-center justify-center"><Loader2 className="w-10 h-10 text-red-600 animate-spin"/></div>}
      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transform transition-transform duration-300 md:relative md:translate-x-0 shadow-2xl md:shadow-none ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
            <div>
              <div className="bg-white p-1.5 rounded-lg inline-block mb-2 shadow-md"><img src="https://dimsumaditya.id/wp-content/uploads/2026/06/Dimsum-Aditya-New-Logo-scaled.webp" alt="Logo" className="h-6 w-auto" /></div>
              <h1 className="font-black text-base tracking-wide uppercase">Dimsum Aditya</h1>
              <p className={`text-[9px] font-bold px-2 py-0.5 rounded w-max mt-1 uppercase flex items-center gap-1 ${roleColor}`}>
                {user.branch_id} ({user.branch_type.split('_')[0]})
              </p>
            </div>
            <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}><X size={20}/></button>
        </div>
        
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 mt-2 px-2">Monitoring & Eksekutif</div>
            {caps.can_global_dashboard ? <NavItem icon={<Activity size={18} />} label="Command Center" active={activeTab === 'dashboard'} onClick={() => navigateTab('dashboard')} disabled={isLoading} /> : <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard Node" active={activeTab === 'dashboard'} onClick={() => navigateTab('dashboard')} disabled={isLoading} />}
            {caps.can_radar && <NavItem icon={<Radar size={18} />} label="Business Radar" active={activeTab === 'radar'} onClick={() => navigateTab('radar')} disabled={isLoading} />}
            {caps.can_treasury && <NavItem icon={<TrendingUp size={18} />} label="Cash War Room" active={activeTab === 'cash_war_room'} onClick={() => navigateTab('cash_war_room')} disabled={isLoading} />}
            
            {caps.can_accounting && <NavItem icon={<BookOpen size={18} />} label="Financial ERP" active={activeTab === 'accounting'} onClick={() => navigateTab('accounting')} disabled={isLoading} />}
            {caps.can_audit && <NavItem icon={<ShieldCheck size={18} />} label="Accounting Audit" active={activeTab === 'accounting_audit'} onClick={() => navigateTab('accounting_audit')} disabled={isLoading} />}
            
            {caps.can_analytics && <NavItem icon={<PieChart size={18} />} label="Executive Analytics" active={activeTab === 'analytics'} onClick={() => navigateTab('analytics')} disabled={isLoading} />}
            {caps.can_scm_warroom && <NavItem icon={<Truck size={18} />} label="SCM War Room" active={activeTab === 'scm_war_room'} onClick={() => navigateTab('scm_war_room')} disabled={isLoading} />}

            {caps.can_pos && (
              <>
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 mt-3 px-2">Transaksi & POS</div>
                <NavItem icon={<ShoppingCart size={18} />} label="Kasir / Transaksi" active={activeTab === 'orders'} onClick={() => navigateTab('orders')} disabled={isLoading} />
                {caps.can_global_dashboard && <NavItem icon={<Wallet size={18} />} label="Pengeluaran Kas" active={activeTab === 'expenses'} onClick={() => navigateTab('expenses')} disabled={isLoading} /> }
                <NavItem icon={<Clock size={18} />} label="Piutang Customer" active={activeTab === 'piutang'} onClick={() => navigateTab('piutang')} disabled={isLoading} />
              </>
            )}

            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 mt-3 px-2">Logistik & SCM</div>
            {caps.can_supplier && <NavItem icon={<Truck size={18} />} label="Pembelian Raw Mat" active={activeTab === 'purchases'} onClick={() => navigateTab('purchases')} disabled={isLoading} />}
            <NavItem icon={<Package size={18} />} label={caps.can_production ? "Stok & Produksi" : "Stok & Terima DO"} active={activeTab === 'stok'} onClick={() => navigateTab('stok')} badge={caps.can_global_dashboard ? 0 : incomingDO} disabled={isLoading} />
            {caps.can_distribute && <NavItem icon={<Send size={18} />} label="Delivery Order (DO)" active={activeTab === 'distribusi'} onClick={() => navigateTab('distribusi')} badge={pendingDO} disabled={isLoading} />}
            {!caps.can_global_dashboard && <NavItem icon={<Store size={18} />} label="Closing Harian" active={activeTab === 'pemalang'} onClick={() => navigateTab('pemalang')} disabled={isLoading} />}

            {caps.can_global_dashboard && (
              <>
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 mt-3 px-2">Data Holding & Konfigurasi</div>
                {caps.can_master_data && <NavItem icon={<Database size={18} />} label="Master Data Center" active={activeTab === 'master_data'} onClick={() => navigateTab('master_data')} disabled={isLoading} />}
                <NavItem icon={<Store size={18} />} label="Pantau Cabang" active={activeTab === 'monitoring_pemalang'} onClick={() => navigateTab('monitoring_pemalang')} disabled={isLoading} />
                {caps.can_hrd && <NavItem icon={<Users size={18} />} label="HRD & Payroll" active={activeTab === 'karyawan'} onClick={() => navigateTab('karyawan')} disabled={isLoading} />}
              </>
            )}
        </nav>
        <div className="p-4 border-t border-slate-800"><button onClick={handleLogout} disabled={isLoading} className="w-full flex justify-center items-center gap-2 bg-slate-800 hover:bg-red-600 hover:text-white py-2.5 rounded-lg transition-all font-bold text-xs"><LogOut size={16}/> Logout</button></div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative w-full">
        <header className="bg-white border-b px-4 py-3 shadow-sm z-10 flex justify-between items-center no-print">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-slate-600 hover:text-slate-900 bg-slate-100 p-2 rounded-lg"><Menu size={20}/></button>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 hidden sm:block">{activeTab.replace(/_/g, ' ')}</h2>
            </div>
            
            <div className="flex items-center gap-4 w-full justify-end sm:w-auto">
              <div className="relative hidden md:block w-64">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input type="text" placeholder="Global Search..." className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-full text-xs font-bold outline-none transition-all" />
              </div>
              <div className="flex items-center gap-3">
                {isOffline ? <span className="bg-rose-100 text-rose-600 p-2 rounded-full"><WifiOff size={16}/></span> : <span className="bg-slate-100 text-slate-600 p-2 rounded-full"><Bell size={16}/></span>}
                <div className="hidden sm:block text-right">
                  <div className="text-[10px] font-black text-slate-400">Operator: <span className="text-red-600 uppercase">{user.name}</span></div>
                </div>
              </div>
            </div>
        </header>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 bg-slate-50 custom-scrollbar">
          <div className="max-w-7xl mx-auto w-full">
            {activeTab === 'dashboard' && <TabDashboard {...data} sendToSheet={sendToSheet} setPrintData={setPrintData} user={user} showToast={showToast} handleTabChange={navigateTab} />}
            {activeTab === 'master_data' && caps.can_master_data && <TabMasterData masterProducts={data.masterProducts} masterRawMaterials={data.masterRawMaterials} masterSuppliers={data.masterSuppliers} sendToSheet={sendToSheet} showToast={showToast} />}
            {activeTab === 'radar' && caps.can_radar && <TabBusinessRadar orders={data.orders} stockMovements={data.stockMovements} expenses={data.expenses} supplierLedger={data.supplierLedger} cashflowTransactions={data.cashflowTransactions} inventoryCostLayers={data.inventoryCostLayers} marketplaceSettlement={data.marketplaceSettlement} masterBranches={data.masterBranches} discrepancyLogs={data.discrepancyLogs} />}
            {activeTab === 'cash_war_room' && caps.can_treasury && <TabCashWarRoom orders={data.orders} purchases={data.purchases} expenses={data.expenses} cashflowTransactions={data.cashflowTransactions} marketplaceSettlement={data.marketplaceSettlement} supplierLedger={data.supplierLedger} masterBranches={data.masterBranches} inventoryCostLayers={data.inventoryCostLayers} discrepancyLogs={data.discrepancyLogs} financialClosings={data.financialClosings} />}
            {activeTab === 'accounting' && caps.can_accounting && <TabAccounting generalLedger={data.generalLedger} chartOfAccounts={data.chartOfAccounts} />}
            {activeTab === 'accounting_audit' && caps.can_audit && <TabAccountingAudit generalLedger={data.generalLedger} inventoryCostLayers={data.inventoryCostLayers} cashflowTransactions={data.cashflowTransactions} marketplaceSettlement={data.marketplaceSettlement} />}
            {activeTab === 'analytics' && caps.can_analytics && <TabAnalytics orders={data.orders} masterBranches={data.masterBranches} discrepancyLogs={data.discrepancyLogs} />}
            {activeTab === 'scm_war_room' && caps.can_scm_warroom && <TabSCMWarRoom distributionOrders={data.distributionOrders} inventoryCostLayers={data.inventoryCostLayers} discrepancyLogs={data.discrepancyLogs} masterBranches={data.masterBranches} />}
            
            {activeTab === 'orders' && <TabOrders orders={data.orders} payments={data.piutangPayments} masterProducts={data.masterProducts} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'order', id})} role={user.role} showToast={showToast} user={user} />}
            {activeTab === 'purchases' && caps.can_supplier && <TabPurchases purchases={data.purchases} masterSuppliers={data.masterSuppliers} masterRawMaterials={data.masterRawMaterials} sendToSheet={sendToSheet} setPrintData={setPrintData} showToast={showToast} user={user} />}
            {activeTab === 'expenses' && caps.can_global_dashboard && <TabExpenses expenses={data.expenses} karyawan={data.karyawan} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'expense', id})} showToast={showToast} />}
            {activeTab === 'piutang' && <TabPiutang orders={data.orders} purchases={caps.can_global_dashboard ? data.purchases : []} payments={data.piutangPayments} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'payment', id})} setPrintData={setPrintData} role={user.role} showToast={showToast} />}
            {activeTab === 'stok' && <TabStok stockMovements={data.stockMovements} productionBatches={data.productionBatches} purchases={caps.can_global_dashboard ? data.purchases : []} orders={data.orders} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'stok', id})} role={user.role} user={user} distributionOrders={data.distributionOrders} showToast={showToast} />}
            {activeTab === 'distribusi' && caps.can_distribute && <TabDistribusi distributionOrders={data.distributionOrders} stockMovements={data.stockMovements} masterBranches={data.masterBranches} sendToSheet={sendToSheet} setPrintData={setPrintData} showToast={showToast} />}
            {activeTab === 'monitoring_pemalang' && caps.can_global_dashboard && <TabMonitoringPemalang orders={data.orders} pemalangReports={data.pemalangReports} stokData={data.stokData} />}
            {activeTab === 'karyawan' && caps.can_hrd && <TabKaryawan karyawan={data.karyawan} expenses={data.expenses} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'karyawan', id})} showToast={showToast} />}
            {activeTab === 'pemalang' && !caps.can_global_dashboard && <TabPemalang reports={data.pemalangReports} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'pemalang', id})} role={user.role} showToast={showToast} />}
          </div>
        </div>
      </main>
    </div>
  );
}

// =====================================================================
// MAIN APP ROOT ENGINE
// =====================================================================
export default function App() {
  const [user, setUser] = useState(() => { try { return window.localStorage.getItem('dimsum_user_session') ? JSON.parse(window.localStorage.getItem('dimsum_user_session')) : null; } catch (e) { return null; } }); 
  const [activeTab, setActiveTab] = useState(() => { try { return window.localStorage.getItem('dimsum_active_tab') || 'dashboard'; } catch (e) { return 'dashboard'; } });
  
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [printData, setPrintData] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null); 
  const [toast, setToast] = useState(null); 
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [data, setData] = useState({});
  
  const offlineQueueRef = useRef([]);

  const showToast = (message, type = 'success') => setToast({ message, type });
  const handleTabChange = (tabName) => { setActiveTab(tabName); window.localStorage.setItem('dimsum_active_tab', tabName); };

  // SMART KEYBOARD SHORTCUTS
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setConfirmDialog(null);
        setPrintData(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    offlineQueueRef.current = JSON.parse(window.localStorage.getItem('erp_offline_queue') || '[]');
    const handleOnline = async () => {
        setIsOffline(false);
        showToast("🌐 Jaringan Terhubung, Menyinkronkan Database...", 'success');
        if (offlineQueueRef.current.length > 0) await processOfflineQueue();
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => { fetchData(); }, [isOffline]);

  const processOfflineQueue = async () => {
      const queue = offlineQueueRef.current;
      setIsLoading(true);
      const newQueue = [];
      for (let req of queue) {
          try {
              const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(req) });
              const result = await res.json();
              if (result.status !== 'success') newQueue.push(req);
          } catch(e) { newQueue.push(req); }
      }
      offlineQueueRef.current = newQueue;
      window.localStorage.setItem('erp_offline_queue', JSON.stringify(newQueue));
      if(newQueue.length === 0) showToast("✅ Sinkronisasi Offline Tuntas.", 'success');
      fetchData(true);
  };

  const fetchData = useCallback(async (force = false) => {
    if (!SCRIPT_URL || isOffline) return;
    const now = new Date().getTime();
    if (!force && globalCache.data && (now - globalCache.timestamp < CACHE_TTL)) {
        setData(globalCache.data); return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${SCRIPT_URL}?action=read_all&limit=4000`);
      const result = await response.json();
      if (result.status === 'success') {
        const raw = result.data || [];
        const sortData = (arr) => arr.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        const processed = {
            masterUsers: raw.filter(i => i.table === 'users' && !i.isDeleted),
            masterBranches: raw.filter(i => i.table === 'branches' && !i.isDeleted),
            orders: sortData(raw.filter(i => i.table === 'orders' && !i.isDeleted)),
            expenses: sortData(raw.filter(i => i.table === 'expenses' && !i.isDeleted)),
            purchases: sortData(raw.filter(i => i.table === 'purchases' && !i.isDeleted)),
            stockMovements: sortData(raw.filter(i => i.table === 'stock_movements' && !i.isDeleted)),
            generalLedger: sortData(raw.filter(i => i.table === 'general_ledger' && !i.isDeleted)),
            chartOfAccounts: raw.filter(i => i.table === 'chart_of_accounts' && !i.isDeleted),
            masterProducts: raw.filter(i => i.table === 'master_products' && !i.isDeleted),
            masterRawMaterials: raw.filter(i => i.table === 'master_raw_materials' && !i.isDeleted),
            masterSuppliers: raw.filter(i => i.table === 'master_suppliers' && !i.isDeleted),
            piutangPayments: sortData(raw.filter(i => i.table === 'payments' && !i.isDeleted)),
            pemalangReports: sortData(raw.filter(i => i.table === 'pemalang' && !i.isDeleted)),
            karyawan: sortData(raw.filter(i => i.table === 'karyawan' && !i.isDeleted)),
            productionBatches: sortData(raw.filter(i => i.table === 'production_batches' && !i.isDeleted)),
            distributionOrders: sortData(raw.filter(i => i.table === 'distribution_orders' && !i.isDeleted)),
            supplierLedger: sortData(raw.filter(i => i.table === 'supplier_ledger' && !i.isDeleted)),
            cashflowTransactions: sortData(raw.filter(i => i.table === 'cashflow_transactions' && !i.isDeleted)),
            marketplaceSettlement: sortData(raw.filter(i => i.table === 'marketplace_settlement' && !i.isDeleted)),
            inventoryCostLayers: sortData(raw.filter(i => i.table === 'inventory_cost_layers' && !i.isDeleted)),
            discrepancyLogs: sortData(raw.filter(i => i.table === 'discrepancy_logs' && !i.isDeleted)),
            financialClosings: sortData(raw.filter(i => i.table === 'financial_closings' && !i.isDeleted)),
            marketplaceInvoices: raw.filter(i => i.table === 'marketplace_invoices' && !i.isDeleted)
        };
        globalCache = { data: processed, timestamp: now };
        setData(processed);
      }
    } catch (err) { console.error("Sync error:", err); } finally { setIsLoading(false); }
  }, [isOffline]);

  const sendToSheet = async (action, payloadData, table) => {
    const reqId = generateRequestId();
    const requestPayload = { action, table, data: payloadData, executor: user, request_id: reqId };

    if (isOffline) { 
        offlineQueueRef.current.push(requestPayload);
        window.localStorage.setItem('erp_offline_queue', JSON.stringify(offlineQueueRef.current));
        showToast("⚠️ DATA DIAMANKAN DI ANTRIAN OFFLINE LOCAL", 'error'); 
        return true; 
    }

    if (isLoading) { showToast("⏳ TRANSAKSI SEDANG DIPROSES ENGINE, MOHON TUNGGU...", 'error'); return false; }
    setIsLoading(true);
    
    try { 
        const response = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(requestPayload) }); 
        const result = await response.json();
        
        if (result.status === 'error' || result.status === 'forbidden') {
            showToast(`⛔ DITOLAK: ${result.message || 'Validasi Gagal'}`, 'error'); 
            setIsLoading(false); return false;
        }
        showToast(`✅ OPERASI SELESAI`, 'success');
        await fetchData(true); 
        return true;
    } catch (error) { 
        offlineQueueRef.current.push(requestPayload);
        window.localStorage.setItem('erp_offline_queue', JSON.stringify(offlineQueueRef.current));
        showToast("🚨 KONEKSI DROP, DATA DIALIKHAN KE BACKGROUND SYNC", 'error'); 
        setIsLoading(false); return true;
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const { username, password } = loginForm;
    const foundUser = data.masterUsers?.find(u => String(u.username).toLowerCase() === String(username).toLowerCase() && String(u.password) === String(password));
    
    if (foundUser) {
      const formattedBranchId = String(foundUser.branch_id || 'TANGERANG').toUpperCase();
      const branchInfo = data.masterBranches?.find(b => String(b.branch_id).toUpperCase() === formattedBranchId) || { branch_name: 'HQ Factory', branch_type: 'HQ_FACTORY' };
      const injectedBranchType = branchInfo.branch_type || 'HQ_FACTORY';
      const permissions = CAPABILITY_CONFIG[injectedBranchType] || CAPABILITY_CONFIG['OUTLET_RESTO'];

      const loggedInUser = { role: foundUser.role, name: username, branch_id: formattedBranchId, branch_name: branchInfo.branch_name, branch_type: injectedBranchType, permissions: permissions };
      setUser(loggedInUser); window.localStorage.setItem('dimsum_user_session', JSON.stringify(loggedInUser));
      handleTabChange('dashboard'); setLoginError(''); 
    } else { setLoginError('Username/Password salah!'); }
  };

  const handleLogout = () => { setUser(null); setLoginForm({ username: '', password: '' }); window.localStorage.removeItem('dimsum_user_session'); window.localStorage.removeItem('dimsum_active_tab'); };

  const executeDelete = async () => {
    if(!confirmDialog) return;
    const { type, id } = confirmDialog;
    let colName = 'orders';
    if (type === 'order') colName = 'orders';
    else if (type === 'expense') colName = 'expenses';
    else if (type === 'payment') colName = 'payments';
    else if (type === 'pemalang') colName = 'pemalang';
    else if (type === 'stok') colName = 'stok';
    else if (type === 'purchase') colName = 'purchases';
    else if (type === 'karyawan') colName = 'karyawan';
    
    const success = await sendToSheet('delete', { id, editCount: 0 }, colName); 
    if (success) { setConfirmDialog(null); }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none"><ShieldAlert size={400}/></div>
        <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl z-10 border border-slate-100">
          <div className="flex flex-col items-center mb-8">
            <img src="https://dimsumaditya.id/wp-content/uploads/2026/06/Dimsum-Aditya-New-Logo-scaled.webp" alt="Logo" className="h-20 w-auto mb-4 object-contain" />
            <h1 className="text-xl font-black text-slate-800 text-center tracking-tight">Enterprise ERP Control</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-2 border border-rose-100"><AlertCircle size={14}/> <span>{loginError}</span></div>}
            <div><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Username / Akses</label><input type="text" required value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none" /></div>
            <div><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Password</label><input type="password" required value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none" /></div>
            <button type="submit" disabled={isLoading} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3.5 rounded-xl shadow-md mt-6 disabled:opacity-50 tracking-wide text-xs flex justify-center items-center gap-2">{isLoading ? <Loader2 size={16} className="animate-spin"/> : 'Secure Login'}</button>
          </form>
        </div>
      </div>
    );
  }

  if (isLoading && !data.masterUsers) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm z-50 fixed inset-0">
        <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center border border-slate-100">
          <Loader2 className="w-10 h-10 text-red-600 animate-spin mb-4" />
          <div className="text-xs font-black text-slate-600 tracking-widest uppercase">Initial Enterprise Sync...</div>
        </div>
      </div>
    );
  }

  const globalProps = {
    user, activeTab, handleTabChange, handleLogout, sendToSheet, setPrintData, setConfirmDialog, isLoading, isOffline, showToast, data
  };

  return (
    <>
      <UniversalNodeLayout {...globalProps} />
      <ToastNotification toast={toast} onClose={() => setToast(null)} />
      <PrintDotMatrix printData={printData} onClose={() => setPrintData(null)} />
      {confirmDialog && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center">
              <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle size={24} className="text-rose-600" /></div>
              <h3 className="text-base font-black text-slate-800 mb-1">Konfirmasi Aksi</h3>
              <p className="text-xs text-slate-500 mb-5 font-bold">Apakah Anda yakin ingin memproses/menghapus data ini?</p>
              <div className="flex gap-2 justify-center">
                <button disabled={isLoading} onClick={() => setConfirmDialog(null)} className="w-1/2 px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition">Batal (ESC)</button>
                <button disabled={isLoading} onClick={executeDelete} className="w-1/2 px-4 py-2.5 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 shadow-md transition flex justify-center items-center gap-2">{isLoading ? <Loader2 size={12} className="animate-spin"/> : 'Eksekusi'}</button>
              </div>
            </div>
          </div>
      )}
    </>
  );
}
