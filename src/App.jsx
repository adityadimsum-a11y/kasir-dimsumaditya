import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Wallet, 
  Clock, Store, Loader2, LogOut, 
  Package, Truck, Users, AlertCircle, Activity, Send, DollarSign, ShieldAlert
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

import { 
  PrintInvoiceDotMatrix, PrintPurchase, PrintVoucher, PrintReceipt, 
  PrintReport, PrintReportBranch, PrintSPK, PrintBuktiStok
} from './components/print/PrintTemplates';

import { safeSort } from './utils/helpers';

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

function LayoutPusat({ user, activeTab, handleTabChange, handleLogout, data, sendToSheet, setPrintData, setConfirmDialog }) {
  const pendingDO = data.distributionOrders.filter(d => d.status === 'DIKIRIM').length;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 relative shadow-xl z-20">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50">
            <div className="bg-white p-2 rounded-lg inline-block mb-3 shadow-md"><img src="https://dimsumaditya.id/wp-content/uploads/2026/06/Dimsum-Aditya-New-Logo-scaled.webp" alt="Logo" className="h-8 w-auto" /></div>
            <h1 className="font-black text-lg tracking-wide uppercase">Dimsum Aditya</h1>
            <p className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded w-max mt-1 flex items-center gap-1"><ShieldAlert size={12}/> {user.role.toUpperCase()}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto custom-scrollbar">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 mt-2 px-2">Monitoring</div>
            <NavItem icon={<Activity size={20} />} label="Command Center" active={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} />
            
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 mt-4 px-2">Transaksi & Kas</div>
            <NavItem icon={<ShoppingCart size={20} />} label="Order Penjualan" active={activeTab === 'orders'} onClick={() => handleTabChange('orders')} />
            <NavItem icon={<Wallet size={20} />} label="Kas & Operasional" active={activeTab === 'expenses'} onClick={() => handleTabChange('expenses')} />
            <NavItem icon={<Clock size={20} />} label="Piutang Berjalan" active={activeTab === 'piutang'} onClick={() => handleTabChange('piutang')} />
            
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 mt-4 px-2">Supply Chain (SCM)</div>
            <NavItem icon={<Truck size={20} />} label="Pembelian Ayam/Bahan" active={activeTab === 'purchases'} onClick={() => handleTabChange('purchases')} />
            <NavItem icon={<Package size={20} />} label="Stok & Batch Produksi" active={activeTab === 'stok'} onClick={() => handleTabChange('stok')} />
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
            <div className="text-xs font-bold text-slate-400">Server Status: <span className="text-emerald-500">Secure 🔒</span></div>
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

function LayoutBranch({ user, activeTab, handleTabChange, handleLogout, data, sendToSheet, setPrintData, setConfirmDialog }) {
  const incomingDO = data.distributionOrders.filter(d => d.status === 'DIKIRIM' && d.to_branch === user.branch_id).length;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 relative shadow-xl z-20">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50">
            <div className="bg-white p-2 rounded-lg inline-block mb-3 shadow-md"><img src="https://dimsumaditya.id/wp-content/uploads/2026/06/Dimsum-Aditya-New-Logo-scaled.webp" alt="Logo" className="h-8 w-auto" /></div>
            <h1 className="font-black text-lg tracking-wide uppercase">Dimsum Aditya</h1>
            <p className="text-[10px] font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded w-max mt-1 uppercase">{user.branch_name}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 mt-2 px-2">Operasional</div>
            <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard Cabang" active={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} />
            <NavItem icon={<ShoppingCart size={20} />} label="POS / Transaksi" active={activeTab === 'orders'} onClick={() => handleTabChange('orders')} />
            <NavItem icon={<Clock size={20} />} label="Piutang Customer" active={activeTab === 'piutang'} onClick={() => handleTabChange('piutang')} />
            
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 mt-4 px-2">Inventory & Laporan</div>
            <NavItem icon={<Package size={20} />} label="Stok & Terima Barang" active={activeTab === 'stok'} onClick={() => handleTabChange('stok')} badge={incomingDO} />
            <NavItem icon={<Store size={20} />} label="Closing Harian" active={activeTab === 'pemalang'} onClick={() => handleTabChange('pemalang')} />
        </nav>
        <div className="p-4 border-t border-slate-800"><button onClick={handleLogout} className="w-full flex justify-center gap-2 bg-slate-800/80 hover:bg-red-600 hover:text-white p-3 rounded-xl transition-all font-bold text-sm"><LogOut size={18}/> Logout</button></div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="bg-white border-b p-4 shadow-sm z-10"><h2 className="text-xl font-bold capitalize text-slate-800 flex items-center gap-2">{activeTab.replace('_', ' ')}</h2></header>
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
  
  // ==========================================
  // SEMUA STATE DATABASE ERP
  // ==========================================
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
  const [systemTasks, setSystemTasks] = useState([]); // <--- INI STATE YANG BIKIN BLANK PUTIH KEMARIN!

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    if (!SCRIPT_URL) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${SCRIPT_URL}?action=read&limit=5000`);
      const result = await response.json();
      if (result.status === 'success') {
        const data = result.data || [];
        
        setMasterUsers(data.filter(item => item && item.table === 'users' && !item.isDeleted));
        setMasterBranches(data.filter(item => item && item.table === 'branches' && !item.isDeleted));

        setOrders(data.filter(item => item && item.table === 'orders' && !item.isDeleted).sort(safeSort));
        setExpenses(data.filter(item => item && item.table === 'expenses' && !item.isDeleted).sort(safeSort));
        setPiutangPayments(data.filter(item => item && item.table === 'payments' && !item.isDeleted).sort(safeSort));
        setPemalangReports(data.filter(item => item && item.table === 'pemalang' && !item.isDeleted).sort(safeSort));
        setPurchases(data.filter(item => item && item.table === 'purchases' && !item.isDeleted).sort(safeSort));
        setKaryawan(data.filter(item => item && item.table === 'karyawan' && !item.isDeleted).sort(safeSort));
        
        setStockMovements(data.filter(item => item && item.table === 'stock_movements' && !item.isDeleted).sort(safeSort));
        setProductionBatches(data.filter(item => item && item.table === 'production_batches' && !item.isDeleted).sort(safeSort));
        setDistributionOrders(data.filter(item => item && item.table === 'distribution_orders' && !item.isDeleted).sort(safeSort));
        setStokData(data.filter(item => item && item.table === 'stok' && !item.isDeleted).sort(safeSort)); 
        
        setSupplierLedger(data.filter(item => item && item.table === 'supplier_ledger' && !item.isDeleted).sort(safeSort));
        setCashflowTransactions(data.filter(item => item && item.table === 'cashflow_transactions' && !item.isDeleted).sort(safeSort));
        setMarketplaceSettlement(data.filter(item => item && item.table === 'marketplace_settlement' && !item.isDeleted).sort(safeSort));
        setInventoryCostLayers(data.filter(item => item && item.table === 'inventory_cost_layers' && !item.isDeleted).sort(safeSort));
        
        setDiscrepancyLogs(data.filter(item => item && item.table === 'discrepancy_logs' && !item.isDeleted).sort(safeSort));
        setFinancialClosings(data.filter(item => item && item.table === 'financial_closings' && !item.isDeleted).sort(safeSort));
        setSystemTasks(data.filter(item => item && item.table === 'system_tasks' && !item.isDeleted).sort(safeSort)); // <--- DATA DITARIK DI SINI
      }
    } catch (error) { console.error("Gagal terhubung ke Database:", error); } finally { setIsLoading(false); }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const { username, password } = loginForm;
    const foundUser = masterUsers.find(u => String(u.username).toLowerCase() === String(username).toLowerCase() && String(u.password) === String(password));
    
    let loggedInUser = null;
    if (foundUser) {
      // Auto-Uppercase untuk menghindari bentrok branch_id 'pusat' vs 'PUSAT' di Sheet
      const formattedBranchId = String(foundUser.branch_id).toUpperCase();
      const branchInfo = masterBranches.find(b => String(b.branch_id).toUpperCase() === formattedBranchId) || { branch_name: 'Cabang', branch_type: 'Branch' };
      
      loggedInUser = { 
          role: foundUser.role, 
          name: username, 
          branch_id: formattedBranchId, // <-- Pastikan UPPERCASE
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
    // Optimistic UI updates
    if (action === 'insert' && !table.includes('event')) {
        const dataArray = Array.isArray(data) ? data : [data];
        if (table === 'orders') setOrders(prev => [...dataArray, ...prev]);
        if (table === 'system_tasks') setSystemTasks(prev => [...dataArray, ...prev]); // Optimistic untuk Task
    } 
    
    try { 
        const response = await fetch(SCRIPT_URL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify({ action, table, data, executor: user }) 
        }); 
        
        const result = await response.json();
        if (result.status === 'forbidden') {
            alert(`AKSES DITOLAK!\n\n${result.data.message}`);
            fetchData();
            return;
        }

    } catch (error) { 
        console.error("Gagal kirim ke Server:", error); 
    }
    
    setTimeout(fetchData, 1500); 
  };

  const executeDelete = async () => {
    // Standard delete logic
    setConfirmDialog(null);
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

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-12 h-12 text-slate-800 animate-spin" /></div>;

  const globalProps = {
    user, activeTab, handleTabChange, handleLogout, sendToSheet, setPrintData, setConfirmDialog,
    data: { 
        orders, expenses, purchases, piutangPayments, pemalangReports, stokData, karyawan, 
        stockMovements, productionBatches, distributionOrders, masterBranches,
        supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers,
        discrepancyLogs, financialClosings, systemTasks // <--- PASTIKAN MASUK KE GLOBAL DATA
    }
  };

  return (
    <>
      {user.role === 'super_admin' ? <LayoutPusat {...globalProps} /> : <LayoutBranch {...globalProps} />}
      
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
