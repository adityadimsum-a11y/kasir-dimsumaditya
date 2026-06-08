import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Wallet, Clock, Store, Loader2, LogOut, 
  Package, Truck, Users, AlertCircle, Activity, Send, ShieldAlert, TrendingUp, WifiOff, PieChart, Menu, X, Search, Bell, CheckCircle, Radar, BookOpen, ShieldCheck, Database
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
import TabMasterData from './components/tabs/TabMasterData'; // MODUL PHASE 10
import PrintDotMatrix from './components/PrintDotMatrix';

import { generateRequestId } from './utils/helpers'; 

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyqCaTepk_duXguiOqSM572mbUIGozcghhh8LHNMNw2e83O7Wkyu-SkjdVTO3zpTb64PA/exec'; 

// =====================================================================
// CENTRAL CAPABILITY ENGINE
// =====================================================================
const CAPABILITY_CONFIG = {
  'HQ_FACTORY': { can_production: true, can_supplier: true, can_global_dashboard: true, can_pos: true, can_distribute: true, can_hrd: true, can_treasury: true, can_scm_warroom: true, can_analytics: true, can_radar: true, can_accounting: true, can_audit: true, can_master_data: true },
  'PRODUCTION_BRANCH': { can_production: true, can_supplier: false, can_global_dashboard: false, can_pos: true, can_distribute: true, can_hrd: false, can_treasury: false, can_scm_warroom: false, can_analytics: false, can_radar: false, can_accounting: false, can_audit: false, can_master_data: false },
  'OUTLET_RESTO': { can_production: false, can_supplier: false, can_global_dashboard: false, can_pos: true, can_distribute: false, can_hrd: false, can_treasury: false, can_scm_warroom: false, can_analytics: false, can_radar: false, can_accounting: false, can_audit: false, can_master_data: false }
};

function NavItem({ icon, label, active, onClick, badge, disabled }) {
  return (
    <button disabled={disabled} onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${active ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
      {icon} <span className="flex-1 text-left">{label}</span>
      {badge > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{badge}</span>}
    </button>
  );
}

function ToastNotification({ toast, onClose }) {
  useEffect(() => { if(toast) { const timer = setTimeout(onClose, 4000); return () => clearTimeout(timer); } }, [toast, onClose]);
  if (!toast) return null;
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-5 text-sm font-bold border ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
      {toast.type === 'success' ? <CheckCircle size={20} className="text-emerald-600"/> : <AlertCircle size={20} className="text-red-600"/>}
      <span className="max-w-xs">{toast.message}</span>
      <button onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-600"><X size={16}/></button>
    </div>
  );
}

// =====================================================================
// DYNAMIC NODE SYSTEM LAYOUT
// =====================================================================
function UniversalNodeLayout({ user, activeTab, handleTabChange, handleLogout, data, sendToSheet, setPrintData, setConfirmDialog, isLoading, isOffline, showToast }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const caps = user.permissions;
  const pendingDO = data.distributionOrders.filter(d => d.status === 'DIKIRIM' || d.status === 'IN_TRANSIT').length;
  const incomingDO = data.distributionOrders.filter(d => (d.status === 'DIKIRIM' || d.status === 'IN_TRANSIT') && d.to_branch === user.branch_id).length;

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
              <h2 className="text-lg md:text-xl font-black capitalize text-slate-800 hidden sm:block">{activeTab.replace(/_/g, ' ')}</h2>
            </div>
            
            <div className="flex items-center gap-4 w-full justify-end sm:w-auto">
              <div className="relative hidden md:block w-64">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input type="text" placeholder="Global Search..." className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-full text-xs font-medium focus:ring-2 focus:ring-red-500 outline-none transition-all" />
              </div>
              <div className="flex items-center gap-3">
                {isOffline ? <span className="bg-red-100 text-red-600 p-2 rounded-full"><WifiOff size={16}/></span> : <span className="bg-slate-100 text-slate-600 p-2 rounded-full hover:bg-slate-200 cursor-pointer"><Bell size={16}/></span>}
                <div className="hidden sm:block text-right">
                  <div className="text-[10px] font-bold text-slate-400">Log: <span className="text-red-600 uppercase">{user.name}</span></div>
                </div>
              </div>
            </div>
        </header>
        
        <div className={`flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 bg-slate-50 custom-scrollbar ${isLoading ? 'opacity-60 grayscale-[30%] transition-opacity duration-300' : 'transition-opacity duration-300'}`}>
          <div className="max-w-7xl mx-auto w-full">
            {activeTab === 'dashboard' && (caps.can_global_dashboard ? <TabDashboard {...data} sendToSheet={sendToSheet} setPrintData={setPrintData} user={user} showToast={showToast} /> : <TabDashboardBranch orders={data.orders} pemalangReports={data.pemalangReports} piutangPayments={data.piutangPayments} setPrintData={setPrintData} stokData={data.stokData} showToast={showToast} />)}
            {activeTab === 'master_data' && caps.can_master_data && <TabMasterData masterProducts={data.masterProducts} masterRawMaterials={data.masterRawMaterials} masterSuppliers={data.masterSuppliers} sendToSheet={sendToSheet} showToast={showToast} />}
            {activeTab === 'radar' && caps.can_radar && <TabBusinessRadar orders={data.orders} stockMovements={data.stockMovements} expenses={data.expenses} supplierLedger={data.supplierLedger} cashflowTransactions={data.cashflowTransactions} inventoryCostLayers={data.inventoryCostLayers} marketplaceSettlement={data.marketplaceSettlement} masterBranches={data.masterBranches} discrepancyLogs={data.discrepancyLogs} />}
            {activeTab === 'cash_war_room' && caps.can_treasury && <TabCashWarRoom orders={data.orders} purchases={data.purchases} expenses={data.expenses} cashflowTransactions={data.cashflowTransactions} marketplaceSettlement={data.marketplaceSettlement} supplierLedger={data.supplierLedger} masterBranches={data.masterBranches} inventoryCostLayers={data.inventoryCostLayers} discrepancyLogs={data.discrepancyLogs} financialClosings={data.financialClosings} />}
            {activeTab === 'accounting' && caps.can_accounting && <TabAccounting generalLedger={data.generalLedger} chartOfAccounts={data.chartOfAccounts} />}
            {activeTab === 'accounting_audit' && caps.can_audit && <TabAccountingAudit generalLedger={data.generalLedger} inventoryCostLayers={data.inventoryCostLayers} cashflowTransactions={data.cashflowTransactions} marketplaceSettlement={data.marketplaceSettlement} />}
            {activeTab === 'analytics' && caps.can_analytics && <TabAnalytics orders={data.orders} masterBranches={data.masterBranches} discrepancyLogs={data.discrepancyLogs} />}
            {activeTab === 'scm_war_room' && caps.can_scm_warroom && <TabSCMWarRoom distributionOrders={data.distributionOrders} inventoryCostLayers={data.inventoryCostLayers} discrepancyLogs={data.discrepancyLogs} masterBranches={data.masterBranches} />}
            
            {/* CORE OPERATIONS */}
            {activeTab === 'orders' && <TabOrders orders={data.orders} payments={data.piutangPayments} masterProducts={data.masterProducts} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'order', id})} role={user.role} showToast={showToast} />}
            {activeTab === 'purchases' && caps.can_supplier && <TabPurchases purchases={data.purchases} masterSuppliers={data.masterSuppliers} masterRawMaterials={data.masterRawMaterials} sendToSheet={sendToSheet} setPrintData={setPrintData} showToast={showToast} />}
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
// MAIN APP ENTRY COMPONENT
// =====================================================================
export default function App() {
  const [user, setUser] = useState(() => { try { return window.localStorage.getItem('dimsum_user_session') ? JSON.parse(window.localStorage.getItem('dimsum_user_session')) : null; } catch (error) { return null; } }); 
  const [activeTab, setActiveTab] = useState(() => { try { return window.localStorage.getItem('dimsum_active_tab') || 'dashboard'; } catch (error) { return 'dashboard'; } });
  const handleTabChange = (tabName) => { setActiveTab(tabName); window.localStorage.setItem('dimsum_active_tab', tabName); };

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [printData, setPrintData] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null); 
  const [toast, setToast] = useState(null); 

  const showToast = (message, type = 'success') => setToast({ message, type });
  
  // STATE MANAGEMENT DATA
  const [masterUsers, setMasterUsers] = useState([]);
  const [masterBranches, setMasterBranches] = useState([]);
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [piutangPayments, setPiutangPayments] = useState([]);
  const [pemalangReports, setPemalangReports] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [karyawan, setKaryawan] = useState([]); 
  const [stockMovements, setStockMovements] = useState([]); 
  const [productionBatches, setProductionBatches] = useState([]); 
  const [distributionOrders, setDistributionOrders] = useState([]); 
  const [stokData, setStokData] = useState([]); 
  const [supplierLedger, setSupplierLedger] = useState([]);
  const [cashflowTransactions, setCashflowTransactions] = useState([]);
  const [marketplaceSettlement, setMarketplaceSettlement] = useState([]);
  const [inventoryCostLayers, setInventoryCostLayers] = useState([]);
  const [discrepancyLogs, setDiscrepancyLogs] = useState([]);
  const [financialClosings, setFinancialClosings] = useState([]);
  const [systemTasks, setSystemTasks] = useState([]); 
  const [generalLedger, setGeneralLedger] = useState([]);
  const [chartOfAccounts, setChartOfAccounts] = useState([]);
  
  // PHASE 10: MASTER DATA
  const [masterProducts, setMasterProducts] = useState([]);
  const [masterRawMaterials, setMasterRawMaterials] = useState([]);
  const [masterSuppliers, setMasterSuppliers] = useState([]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    if (!SCRIPT_URL) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${SCRIPT_URL}?action=read&limit=5000`);
      const result = await response.json();
      if (result.status === 'success') {
        const data = result.data || [];
        const sortData = (arr) => arr.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        setMasterUsers(data.filter(item => item && item.table === 'users' && !item.isDeleted));
        setMasterBranches(data.filter(item => item && item.table === 'branches' && !item.isDeleted));
        setOrders(sortData(data.filter(item => item && item.table === 'orders' && !item.isDeleted)));
        setExpenses(sortData(data.filter(item => item && item.table === 'expenses' && !item.isDeleted)));
        setPiutangPayments(sortData(data.filter(item => item && item.table === 'payments' && !item.isDeleted)));
        setPemalangReports(sortData(data.filter(item => item && item.table === 'pemalang' && !item.isDeleted)));
        setPurchases(sortData(data.filter(item => item && item.table === 'purchases' && !item.isDeleted)));
        setKaryawan(sortData(data.filter(item => item && item.table === 'karyawan' && !item.isDeleted)));
        setStockMovements(sortData(data.filter(item => item && item.table === 'stock_movements' && !item.isDeleted)));
        setProductionBatches(sortData(data.filter(item => item && item.table === 'production_batches' && !item.isDeleted)));
        setDistributionOrders(sortData(data.filter(item => item && item.table === 'distribution_orders' && !item.isDeleted)));
        setStokData(sortData(data.filter(item => item && item.table === 'stok' && !item.isDeleted))); 
        setSupplierLedger(sortData(data.filter(item => item && item.table === 'supplier_ledger' && !item.isDeleted)));
        setCashflowTransactions(sortData(data.filter(item => item && item.table === 'cashflow_transactions' && !item.isDeleted)));
        setMarketplaceSettlement(sortData(data.filter(item => item && item.table === 'marketplace_settlement' && !item.isDeleted)));
        setInventoryCostLayers(sortData(data.filter(item => item && item.table === 'inventory_cost_layers' && !item.isDeleted)));
        setDiscrepancyLogs(sortData(data.filter(item => item && item.table === 'discrepancy_logs' && !item.isDeleted)));
        setFinancialClosings(sortData(data.filter(item => item && item.table === 'financial_closings' && !item.isDeleted)));
        setSystemTasks(sortData(data.filter(item => item && item.table === 'system_tasks' && !item.isDeleted))); 
        setGeneralLedger(sortData(data.filter(item => item && item.table === 'general_ledger' && !item.isDeleted)));
        setChartOfAccounts(data.filter(item => item && item.table === 'chart_of_accounts' && !item.isDeleted));
        
        // Phase 10
        setMasterProducts(data.filter(item => item && item.table === 'master_products' && !item.isDeleted));
        setMasterRawMaterials(data.filter(item => item && item.table === 'master_raw_materials' && !item.isDeleted));
        setMasterSuppliers(data.filter(item => item && item.table === 'master_suppliers' && !item.isDeleted));
      }
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const { username, password } = loginForm;
    const foundUser = masterUsers.find(u => String(u.username).toLowerCase() === String(username).toLowerCase() && String(u.password) === String(password));
    
    if (foundUser) {
      const formattedBranchId = String(foundUser.branch_id || 'TANGERANG').toUpperCase();
      const branchInfo = masterBranches.find(b => String(b.branch_id).toUpperCase() === formattedBranchId) || { branch_name: 'HQ Factory', branch_type: 'HQ_FACTORY' };
      const injectedBranchType = branchInfo.branch_type || 'HQ_FACTORY';
      const permissions = CAPABILITY_CONFIG[injectedBranchType] || CAPABILITY_CONFIG['OUTLET_RESTO'];

      const loggedInUser = { role: foundUser.role, name: username, branch_id: formattedBranchId, branch_name: branchInfo.branch_name, branch_type: injectedBranchType, permissions: permissions };
      setUser(loggedInUser); window.localStorage.setItem('dimsum_user_session', JSON.stringify(loggedInUser));
      handleTabChange('dashboard'); setLoginError(''); 
    } else { setLoginError('Username/Password salah!'); }
  };

  const handleLogout = () => { setUser(null); setLoginForm({ username: '', password: '' }); window.localStorage.removeItem('dimsum_user_session'); window.localStorage.removeItem('dimsum_active_tab'); };

  const sendToSheet = async (action, data, table) => {
    if (isOffline) { showToast("⚠️ OFFLINE: Tidak ada koneksi internet.", 'error'); return false; }
    if (isLoading) { showToast("⏳ Mohon tunggu, sistem sedang memproses...", 'error'); return false; }
    
    setIsLoading(true);
    const reqId = generateRequestId(); 
    
    try { 
        const response = await fetch(SCRIPT_URL, { 
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify({ action, table, data, executor: user, request_id: reqId }) 
        }); 
        
        const result = await response.json();
        
        if (result.status === 'forbidden' || result.status === 'error') {
            setIsLoading(false); 
            const errorMsg = result.data?.message || result.message || 'Terjadi pelanggaran sistem.';
            showToast(`⛔ GAGAL: ${errorMsg}`, 'error'); 
            return false;
        }
        
        if (result.status === 'success') {
            if (result.data?.message) { showToast(`✅ ${result.data.message}`, 'success'); } 
            else { showToast(`✅ Transaksi berhasil disimpan.`, 'success'); }
            
            await fetchData(); 
            setIsLoading(false); 
            return true;
        }
    } catch (error) { 
        console.error("Gagal kirim ke Server:", error); 
        showToast("🚨 FATAL ERROR: Gagal terhubung ke server.", 'error'); 
        setIsLoading(false); 
        return false;
    }
  };

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
            {loginError && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2 border border-red-100"><AlertCircle size={14}/> <span>{loginError}</span></div>}
            <div><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Username / Akses</label><input type="text" required value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm focus:ring-2 focus:ring-red-500 outline-none" /></div>
            <div><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Password</label><input type="password" required value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm focus:ring-2 focus:ring-red-500 outline-none" /></div>
            <button type="submit" disabled={isLoading} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-md mt-6 disabled:opacity-50 tracking-wide text-sm flex justify-center items-center gap-2">{isLoading ? <Loader2 size={16} className="animate-spin"/> : 'Secure Login'}</button>
          </form>
        </div>
      </div>
    );
  }

  if (isLoading && masterUsers.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm z-50 fixed inset-0">
        <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center border border-slate-100">
          <Loader2 className="w-10 h-10 text-red-600 animate-spin mb-4" />
          <div className="text-xs font-bold text-slate-600 tracking-widest uppercase">Initial Sync...</div>
        </div>
      </div>
    );
  }

  const globalProps = {
    user, activeTab, handleTabChange, handleLogout, sendToSheet, setPrintData, setConfirmDialog, isLoading, isOffline, showToast,
    data: { 
      orders, expenses, purchases, piutangPayments, pemalangReports, stokData, karyawan, stockMovements, 
      productionBatches, distributionOrders, masterBranches, supplierLedger, cashflowTransactions, 
      marketplaceSettlement, inventoryCostLayers, discrepancyLogs, financialClosings, systemTasks,
      generalLedger, chartOfAccounts, 
      masterProducts, masterRawMaterials, masterSuppliers // PHASE 10 DATA
    }
  };

  return (
    <>
      <UniversalNodeLayout {...globalProps} />
      <ToastNotification toast={toast} onClose={() => setToast(null)} />
      <PrintDotMatrix printData={printData} onClose={() => setPrintData(null)} />
      {confirmDialog && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5"><AlertCircle size={32} className="text-red-600" /></div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Hapus Permanen?</h3>
              <p className="text-xs text-slate-500 mb-6 font-medium">Data yang dihapus akan dicatat di Audit Log.</p>
              <div className="flex gap-3 justify-center">
                <button disabled={isLoading} onClick={() => setConfirmDialog(null)} className="w-1/2 px-4 py-3 bg-slate-100 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-200 transition disabled:opacity-50">Batal</button>
                <button disabled={isLoading} onClick={executeDelete} className="w-1/2 px-4 py-3 bg-red-600 text-white font-bold text-sm rounded-xl hover:bg-red-700 shadow-md transition disabled:opacity-50 flex justify-center items-center gap-2">{isLoading ? <Loader2 size={16} className="animate-spin"/> : 'Hapus'}</button>
              </div>
            </div>
          </div>
      )}
    </>
  );
}
