import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Wallet, 
  Clock, Store, Loader2, LogOut, 
  Package, Truck, Users, AlertCircle, Activity, Send, ShieldAlert, Factory
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
import PrintDotMatrix from './components/PrintDotMatrix';

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyqCaTepk_duXguiOqSM572mbUIGozcghhh8LHNMNw2e83O7Wkyu-SkjdVTO3zpTb64PA/exec'; 

function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${active ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {badge > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{badge}</span>}
    </button>
  );
}

// =====================================================================
// 1. LAYOUT HQ FACTORY (TANGERANG / PUSAT)
// =====================================================================
function LayoutHQFactory({ user, activeTab, handleTabChange, handleLogout, data, sendToSheet, setPrintData, setConfirmDialog }) {
  const pendingDO = data.distributionOrders.filter(d => d.status === 'DIKIRIM').length;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 relative shadow-xl z-20">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50">
            <div className="bg-white p-2 rounded-lg inline-block mb-3 shadow-md"><img src="https://dimsumaditya.id/wp-content/uploads/2026/06/Dimsum-Aditya-New-Logo-scaled.webp" alt="Logo" className="h-8 w-auto" /></div>
            <h1 className="font-black text-lg tracking-wide uppercase">Dimsum Aditya</h1>
            <p className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded w-max mt-1 flex items-center gap-1"><ShieldAlert size={12}/> HQ FACTORY</p>
        </div>
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto custom-scrollbar">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 mt-2 px-2">Monitoring</div>
            <NavItem icon={<Activity size={20} />} label="Command Center" active={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} />
            
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 mt-4 px-2">Transaksi & Kas</div>
            <NavItem icon={<ShoppingCart size={20} />} label="Order Penjualan" active={activeTab === 'orders'} onClick={() => handleTabChange('orders')} />
            <NavItem icon={<Wallet size={20} />} label="Kas & Operasional" active={activeTab === 'expenses'} onClick={() => handleTabChange('expenses')} />
            <NavItem icon={<Clock size={20} />} label="Piutang Berjalan" active={activeTab === 'piutang'} onClick={() => handleTabChange('piutang')} />
            
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 mt-4 px-2">Supply Chain (SCM)</div>
            <NavItem icon={<Truck size={20} />} label="Pembelian Raw Mat" active={activeTab === 'purchases'} onClick={() => handleTabChange('purchases')} />
            <NavItem icon={<Package size={20} />} label="Stok & Produksi HQ" active={activeTab === 'stok'} onClick={() => handleTabChange('stok')} />
            <NavItem icon={<Send size={20} />} label="Delivery Order (DO)" active={activeTab === 'distribusi'} onClick={() => handleTabChange('distribusi')} badge={pendingDO} />
            
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 mt-4 px-2">Distribusi & SDM</div>
            <NavItem icon={<Store size={20} />} label="Monitoring Cabang" active={activeTab === 'monitoring_pemalang'} onClick={() => handleTabChange('monitoring_pemalang')} />
            <NavItem icon={<Users size={20} />} label="HRD & Payroll" active={activeTab === 'karyawan'} onClick={() => handleTabChange('karyawan')} />
        </nav>
        <div className="p-4 border-t border-slate-800"><button onClick={handleLogout} className="w-full flex justify-center gap-2 bg-slate-800/80 hover:bg-red-600 hover:text-white p-3 rounded-xl transition-all font-bold text-sm"><LogOut size={18}/> Logout</button></div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="bg-white border-b p-4 shadow-sm z-10 flex justify-between items-center">
            <h2 className="text-xl font-bold capitalize text-slate-800 flex items-center gap-2">{activeTab.replace('_', ' ')}</h2>
            <div className="text-xs font-bold text-slate-400">Node: <span className="text-emerald-500 font-black">{user.branch_id}</span></div>
        </header>
        <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
          {activeTab === 'dashboard' && <TabDashboard {...data} sendToSheet={sendToSheet} setPrintData={setPrintData} user={user} />}
          {activeTab === 'orders' && <TabOrders orders={data.orders} payments={data.piutangPayments} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'order', id})} role={user.role} />}
          {activeTab === 'purchases' && <TabPurchases purchases={data.purchases} sendToSheet={sendToSheet} setPrintData={setPrintData} />}
          {activeTab === 'expenses' && <TabExpenses expenses={data.expenses} karyawan={data.karyawan} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'expense', id})} />}
          {activeTab === 'piutang' && <TabPiutang orders={data.orders} purchases={data.purchases} payments={data.piutangPayments} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'payment', id})} setPrintData={setPrintData} role={user.role} />}
          {activeTab === 'stok' && <TabStok stockMovements={data.stockMovements} productionBatches={data.productionBatches} purchases={data.purchases} orders={data.orders} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'stok', id})} role={user.role} user={user} distributionOrders={data.distributionOrders} />}
          {activeTab === 'distribusi' && <TabDistribusi distributionOrders={data.distributionOrders} stockMovements={data.stockMovements} masterBranches={data.masterBranches} sendToSheet={sendToSheet} setPrintData={setPrintData} />}
          {activeTab === 'monitoring_pemalang' && <TabMonitoringPemalang orders={data.orders} pemalangReports={data.pemalangReports} stokData={data.stokData} />}
          {activeTab === 'karyawan' && <TabKaryawan karyawan={data.karyawan} expenses={data.expenses} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'karyawan', id})} />}
        </div>
      </main>
    </div>
  );
}

// =====================================================================
// 2. LAYOUT BRANCH NODE (Mencakup PRODUCTION BRANCH & OUTLET RESTO)
// =====================================================================
function LayoutBranchNode({ user, activeTab, handleTabChange, handleLogout, data, sendToSheet, setPrintData, setConfirmDialog }) {
  const incomingDO = data.distributionOrders.filter(d => d.status === 'DIKIRIM' && d.to_branch === user.branch_id).length;
  
  const isProduction = user.branch_type === 'PRODUCTION_BRANCH';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 relative shadow-xl z-20">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50">
            <div className="bg-white p-2 rounded-lg inline-block mb-3 shadow-md"><img src="https://dimsumaditya.id/wp-content/uploads/2026/06/Dimsum-Aditya-New-Logo-scaled.webp" alt="Logo" className="h-8 w-auto" /></div>
            <h1 className="font-black text-lg tracking-wide uppercase">Dimsum Aditya</h1>
            <p className={`text-[10px] font-bold px-2 py-0.5 rounded w-max mt-1 uppercase flex items-center gap-1 ${isProduction ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                {isProduction ? <Factory size={12}/> : <Store size={12}/>}
                {user.branch_name} ({user.branch_type})
            </p>
        </div>
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 mt-2 px-2">Operasional</div>
            <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard Node" active={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} />
            <NavItem icon={<ShoppingCart size={20} />} label="POS / Transaksi" active={activeTab === 'orders'} onClick={() => handleTabChange('orders')} />
            <NavItem icon={<Clock size={20} />} label="Piutang Customer" active={activeTab === 'piutang'} onClick={() => handleTabChange('piutang')} />
            
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 mt-4 px-2">Inventory & Laporan</div>
            <NavItem icon={<Package size={20} />} label={isProduction ? "Stok & Produksi" : "Stok & Terima DO"} active={activeTab === 'stok'} onClick={() => handleTabChange('stok')} badge={incomingDO} />
            <NavItem icon={<Store size={20} />} label="Closing Harian" active={activeTab === 'pemalang'} onClick={() => handleTabChange('pemalang')} />
        </nav>
        <div className="p-4 border-t border-slate-800"><button onClick={handleLogout} className="w-full flex justify-center gap-2 bg-slate-800/80 hover:bg-red-600 hover:text-white p-3 rounded-xl transition-all font-bold text-sm"><LogOut size={18}/> Logout</button></div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="bg-white border-b p-4 shadow-sm z-10 flex justify-between items-center">
            <h2 className="text-xl font-bold capitalize text-slate-800 flex items-center gap-2">{activeTab.replace('_', ' ')}</h2>
            <div className="text-xs font-bold text-slate-400">Node: <span className="text-emerald-500 font-black">{user.branch_id}</span></div>
        </header>
        <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
          {activeTab === 'dashboard' && <TabDashboardBranch orders={data.orders} pemalangReports={data.pemalangReports} piutangPayments={data.piutangPayments} setPrintData={setPrintData} stokData={data.stokData} />}
          {activeTab === 'orders' && <TabOrders orders={data.orders} payments={data.piutangPayments} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'order', id})} role={user.role} />}
          {activeTab === 'piutang' && <TabPiutang orders={data.orders} purchases={[]} payments={data.piutangPayments} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'payment', id})} setPrintData={setPrintData} role={user.role} />}
          {activeTab === 'stok' && <TabStok stockMovements={data.stockMovements} productionBatches={data.productionBatches} purchases={[]} orders={data.orders} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'stok', id})} role={user.role} user={user} distributionOrders={data.distributionOrders} />}
          {activeTab === 'pemalang' && <TabPemalang reports={data.pemalangReports} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'pemalang', id})} role={user.role} />}
        </div>
      </main>
    </div>
  );
}

// =====================================================================
// MAIN APP COMPONENT
// =====================================================================
export default function App() {
  const [user, setUser] = useState(() => {
    try { return window.localStorage.getItem('dimsum_user_session') ? JSON.parse(window.localStorage.getItem('dimsum_user_session')) : null; } 
    catch (error) { return null; }
  }); 

  const [activeTab, setActiveTab] = useState(() => {
    try { return window.localStorage.getItem('dimsum_active_tab') || 'dashboard'; } 
    catch (error) { return 'dashboard'; }
  });

  const handleTabChange = (tabName) => { setActiveTab(tabName); window.localStorage.setItem('dimsum_active_tab', tabName); };

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [printData, setPrintData] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null); 
  
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
      }
    } catch (error) { 
      console.error("Gagal terhubung ke Database:", error); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const { username, password } = loginForm;
    const foundUser = masterUsers.find(u => String(u.username).toLowerCase() === String(username).toLowerCase() && String(u.password) === String(password));
    let loggedInUser = null;
    if (foundUser) {
      const formattedBranchId = String(foundUser.branch_id).toUpperCase();
      const branchInfo = masterBranches.find(b => String(b.branch_id).toUpperCase() === formattedBranchId) || { branch_name: 'HQ', branch_type: 'HQ_FACTORY' };
      loggedInUser = { 
          role: foundUser.role, 
          name: username, 
          branch_id: formattedBranchId, 
          branch_name: branchInfo.branch_name, 
          branch_type: branchInfo.branch_type 
      };
    } 
    if (loggedInUser) {
      setUser(loggedInUser); window.localStorage.setItem('dimsum_user_session', JSON.stringify(loggedInUser));
      handleTabChange('dashboard'); setLoginError(''); 
    } else setLoginError('Username/Password salah!');
  };

  const handleLogout = () => { setUser(null); setLoginForm({ username: '', password: '' }); window.localStorage.removeItem('dimsum_user_session'); window.localStorage.removeItem('dimsum_active_tab'); };

  const sendToSheet = async (action, data, table) => {
    setIsLoading(true);
    try { 
        const response = await fetch(SCRIPT_URL, { 
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, table, data, executor: user }) 
        }); 
        const result = await response.json();
        if (result.status === 'forbidden' || result.status === 'error') {
            setIsLoading(false); alert(`⛔ SISTEM MENOLAK AKSI ANDA!\n\nAlasan: ${result.data?.message || result.message || 'Terjadi pelanggaran aturan sistem.'}`); return false;
        }
        if (result.status === 'success') {
            if (result.data?.message) alert(`✅ ${result.data.message}`);
            await fetchData(); setIsLoading(false); return true;
        }
    } catch (error) { 
        console.error("Gagal kirim ke Server:", error); alert("🚨 TERJADI KESALAHAN JARINGAN ATAU SERVER!\nData Anda belum tersimpan. Silakan coba lagi."); setIsLoading(false); return false;
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
    await sendToSheet('delete', { id }, colName); setConfirmDialog(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl z-10">
          <div className="flex flex-col items-center mb-8">
            <img src="https://dimsumaditya.id/wp-content/uploads/2026/06/Dimsum-Aditya-New-Logo-scaled.webp" alt="Logo" className="h-28 w-auto mb-4 object-contain" />
            <h1 className="text-2xl font-black text-slate-800 text-center tracking-tight">Enterprise ERP</h1>
            <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"><ShieldAlert size={12}/> SECURE LOGIN</div>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            {loginError && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-center gap-2"><AlertCircle size={16}/> <span>{loginError}</span></div>}
            <div><label className="text-xs font-bold text-slate-500 uppercase ml-1">Username</label><input type="text" required value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} className="w-full p-3.5 bg-slate-50 border rounded-xl font-medium" /></div>
            <div><label className="text-xs font-bold text-slate-500 uppercase ml-1">Password</label><input type="password" required value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-3.5 bg-slate-50 border rounded-xl font-medium" /></div>
            <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-md mt-6">Secure Login</button>
          </form>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm z-50 fixed inset-0">
        <Loader2 className="w-12 h-12 text-slate-800 animate-spin mb-4" />
        <div className="text-sm font-bold text-slate-600 tracking-widest uppercase">Menyinkronkan Data Server...</div>
      </div>
    );
  }

  const globalProps = {
    user, activeTab, handleTabChange, handleLogout, sendToSheet, setPrintData, setConfirmDialog,
    data: { 
        orders, expenses, purchases, piutangPayments, pemalangReports, stokData, karyawan, 
        stockMovements, productionBatches, distributionOrders, masterBranches,
        supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers,
        discrepancyLogs, financialClosings, systemTasks
    }
  };

  // RESOLUSI ROUTING MULTI-NODE
  // Memastikan kompabilitas jika session user lama belum punya branch_type
  const bType = user.branch_type || (user.role === 'super_admin' ? 'HQ_FACTORY' : 'PRODUCTION_BRANCH');

  return (
    <>
      {bType === 'HQ_FACTORY' ? <LayoutHQFactory {...globalProps} /> : <LayoutBranchNode {...globalProps} />}
      
      <PrintDotMatrix printData={printData} onClose={() => setPrintData(null)} />
      
      {confirmDialog && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5"><AlertCircle size={40} className="text-red-500" /></div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Hapus Permanen?</h3>
              <div className="flex gap-3 justify-center mt-6">
                <button onClick={() => setConfirmDialog(null)} className="w-1/2 px-4 py-3.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition">Batal</button>
                <button onClick={executeDelete} className="w-1/2 px-4 py-3.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-md transition">Ya, Hapus</button>
              </div>
            </div>
          </div>
      )}
    </>
  );
}
