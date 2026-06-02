import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Wallet, 
  CheckCircle, Clock, X, Store, Loader2, LogOut, 
  Package, Truck
} from 'lucide-react';

import TabDashboard from './components/tabs/TabDashboard';
import TabDashboardBranch from './components/tabs/TabDashboardBranch';
import TabOrders from './components/tabs/TabOrders';
import TabPurchases from './components/tabs/TabPurchases';
import TabExpenses from './components/tabs/TabExpenses';
import TabPiutang from './components/tabs/TabPiutang';
import TabPemalang from './components/tabs/TabPemalang';
import TabStok from './components/tabs/TabStok';

import { 
  PrintInvoiceDotMatrix, PrintPurchase, PrintVoucher, 
  PrintReceipt, PrintReport, PrintReportBranch 
} from './components/print/PrintTemplates';

import { safeSort, formatDate } from './utils/helpers';

// =====================================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyqCaTepk_duXguiOqSM572mbUIGozcghhh8LHNMNw2e83O7Wkyu-SkjdVTO3zpTb64PA/exec'; 
// =====================================================================

function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${active ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {badge > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{badge}</span>}
    </button>
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

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    window.localStorage.setItem('dimsum_active_tab', tabName);
  };

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [printData, setPrintData] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null); 
  
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [piutangPayments, setPiutangPayments] = useState([]);
  const [pemalangReports, setPemalangReports] = useState([]);
  const [stokData, setStokData] = useState([]); 
  const [purchases, setPurchases] = useState([]);

  useEffect(() => { if (user) fetchData(); }, [user]);

  const handleLogin = (e) => {
    e.preventDefault();
    const { username, password } = loginForm;
    let loggedInUser = null;
    if (username === 'dnamic' && password === 'Dnamic2026!!') loggedInUser = { role: 'admin', name: 'Administrator Pusat' };
    else if (username === 'pemalang' && password === 'pemalang123') loggedInUser = { role: 'branch', name: 'Cabang Pemalang', branchId: 'Pemalang' };

    if (loggedInUser) {
      setUser(loggedInUser);
      window.localStorage.setItem('dimsum_user_session', JSON.stringify(loggedInUser));
      handleTabChange('dashboard'); setLoginError(''); 
    } else setLoginError('Username atau Password salah!');
  };

  const handleLogout = () => {
    setUser(null); setLoginForm({ username: '', password: '' });
    window.localStorage.removeItem('dimsum_user_session'); window.localStorage.removeItem('dimsum_active_tab');
    setOrders([]); setExpenses([]); setPiutangPayments([]); setPemalangReports([]); setStokData([]); setPurchases([]);
  };

  const fetchData = async () => {
    if (!SCRIPT_URL || SCRIPT_URL === 'TARUH_LINK_GOOGLE_SCRIPT_DISINI') return;
    setIsLoading(true);
    try {
      const response = await fetch(`${SCRIPT_URL}?action=read`);
      const result = await response.json();
      if (result.status === 'success') {
        const data = result.data || [];
        setOrders(data.filter(item => item && item.table === 'orders' && !item.isDeleted).sort(safeSort));
        setExpenses(data.filter(item => item && item.table === 'expenses' && !item.isDeleted).sort(safeSort));
        setPiutangPayments(data.filter(item => item && item.table === 'payments' && !item.isDeleted).sort(safeSort));
        setPemalangReports(data.filter(item => item && item.table === 'pemalang' && !item.isDeleted).sort(safeSort));
        setStokData(data.filter(item => item && item.table === 'stok' && !item.isDeleted).sort(safeSort));
        setPurchases(data.filter(item => item && item.table === 'purchases' && !item.isDeleted).sort(safeSort));
      }
    } catch (error) { alert("Gagal terhubung ke Database Google Sheet."); } 
    finally { setIsLoading(false); }
  };

  const sendToSheet = async (action, data, table) => {
    if (action === 'insert') {
        if (table === 'orders') setOrders(prev => [data, ...prev]);
        if (table === 'expenses') setExpenses(prev => [data, ...prev]);
        if (table === 'payments') setPiutangPayments(prev => [data, ...prev]);
        if (table === 'pemalang') setPemalangReports(prev => [data, ...prev]);
        if (table === 'stok') setStokData(prev => [data, ...prev]);
        if (table === 'purchases') setPurchases(prev => [data, ...prev]);
    } else if (action === 'update') {
        if (table === 'orders') setOrders(prev => prev.map(o => o.id === data.id ? data : o));
        if (table === 'expenses') setExpenses(prev => prev.map(e => e.id === data.id ? data : e));
        if (table === 'payments') setPiutangPayments(prev => prev.map(p => p.id === data.id ? data : p));
        if (table === 'pemalang') setPemalangReports(prev => prev.map(p => p.id === data.id ? data : p));
        if (table === 'stok') setStokData(prev => prev.map(s => s.id === data.id ? data : s));
        if (table === 'purchases') setPurchases(prev => prev.map(p => p.id === data.id ? data : p));
    } else if (action === 'delete') {
        if (table === 'orders') setOrders(prev => prev.filter(o => o.id !== data.id));
        if (table === 'expenses') setExpenses(prev => prev.filter(e => e.id !== data.id));
        if (table === 'payments') setPiutangPayments(prev => prev.filter(p => p.id !== data.id));
        if (table === 'pemalang') setPemalangReports(prev => prev.filter(p => p.id !== data.id));
        if (table === 'stok') setStokData(prev => prev.filter(s => s.id !== data.id));
        if (table === 'purchases') setPurchases(prev => prev.filter(p => p.id !== data.id));
    }
    try { await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, table, data }) }); } catch (error) {}
  };

  const executeDelete = async () => {
    if(!confirmDialog) return;
    const { type, id } = confirmDialog;
    let colName = '';
    if (type === 'order') colName = 'orders'; else if (type === 'expense') colName = 'expenses'; else if (type === 'payment') colName = 'payments'; else if (type === 'pemalang') colName = 'pemalang'; else if (type === 'stok') colName = 'stok'; else if (type === 'purchase') colName = 'purchases';
    await sendToSheet('delete', { id }, colName); setConfirmDialog(null);
  };

  const pendingHutangPiutang = useMemo(() => {
    const piutangGroups = {}; const hutangGroups = {};
    (orders || []).forEach(o => { if(!o?.id) return; if(!piutangGroups[o.id]) piutangGroups[o.id] = { total: 0, paid: 0 }; piutangGroups[o.id].total += Number(o.total) || 0; piutangGroups[o.id].paid = Number(o.paidAmount) || 0; });
    (purchases || []).forEach(p => { if(!p?.id) return; if(!hutangGroups[p.id]) hutangGroups[p.id] = { total: 0, paid: 0 }; hutangGroups[p.id].total += Number(p.total) || 0; hutangGroups[p.id].paid = Number(p.paidAmount) || 0; });
    const piutang = Object.keys(piutangGroups).filter(id => { const cicilan = (piutangPayments || []).filter(p => p.orderId === id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0); return (piutangGroups[id].total - piutangGroups[id].paid - cicilan) > 0; }).length;
    const hutang = Object.keys(hutangGroups).filter(id => { const cicilan = (piutangPayments || []).filter(p => p.orderId === id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0); return (hutangGroups[id].total - hutangGroups[id].paid - cicilan) > 0; }).length;
    return piutang + hutang;
  }, [orders, purchases, piutangPayments]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative z-10">
          <div className="flex flex-col items-center mb-8">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" className="w-20 h-20 object-contain mb-2" />
            <h1 className="text-2xl font-bold text-slate-800">Dimsum Aditya</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm text-center">{loginError}</div>}
            <input type="text" required placeholder="Username" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} className="w-full p-3 border rounded-xl" />
            <input type="password" required placeholder="Password" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-3 border rounded-xl" />
            <button type="submit" className="w-full bg-red-600 text-white font-bold py-3.5 rounded-xl">Masuk Sistem</button>
          </form>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-12 h-12 text-red-600 animate-spin" /></div>;

  if (printData?.type === 'invoice') return <PrintInvoiceDotMatrix data={printData.data} onBack={() => setPrintData(null)} />;
  if (printData?.type === 'purchase') return <PrintPurchase data={printData.data} onBack={() => setPrintData(null)} />;
  if (printData?.type === 'voucher') return <PrintVoucher data={printData.data} onBack={() => setPrintData(null)} />;
  if (printData?.type === 'receipt') return <PrintReceipt data={printData.data} onBack={() => setPrintData(null)} />;
  if (printData?.type === 'report') return <PrintReport data={printData.data} onBack={() => setPrintData(null)} />;
  if (printData?.type === 'reportBranch') return <PrintReportBranch data={printData.data} onBack={() => setPrintData(null)} user={user} />;

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800">
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-lg text-red-600 mb-2">Hapus Data</h3>
            <p className="text-sm mb-6">Yakin ingin menghapus permanen?</p>
            <div className="flex gap-3 justify-end"><button onClick={() => setConfirmDialog(null)} className="px-4 py-2 bg-slate-100 rounded-lg">Batal</button><button onClick={executeDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg">Hapus</button></div>
          </div>
        </div>
      )}

      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-0.5"><img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" className="w-full h-full object-contain" /></div>
          <div><h1 className="font-bold text-lg leading-tight truncate w-40">Dimsum Aditya</h1><p className="text-xs text-emerald-400 font-bold">{user.name}</p></div>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {user.role === 'admin' && (
            <>
              <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard & Rekap" active={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} />
              <NavItem icon={<ShoppingCart size={20} />} label="Order & Penjualan" active={activeTab === 'orders'} onClick={() => handleTabChange('orders')} />
              <NavItem icon={<Truck size={20} />} label="Pembelian Bahan" active={activeTab === 'purchases'} onClick={() => handleTabChange('purchases')} />
              <NavItem icon={<Wallet size={20} />} label="Kas Umum (Lainnya)" active={activeTab === 'expenses'} onClick={() => handleTabChange('expenses')} />
              <NavItem icon={<Clock size={20} />} label="Hutang & Piutang" active={activeTab === 'piutang'} onClick={() => handleTabChange('piutang')} badge={pendingHutangPiutang} />
              <div className="pt-4 mt-2 border-t border-slate-800"><NavItem icon={<Package size={20} />} label="Stok Freezer" active={activeTab === 'stok'} onClick={() => handleTabChange('stok')} /></div>
            </>
          )}
          {user.role === 'branch' && (
            <>
              <div className="text-xs font-bold text-slate-500 uppercase mb-2 px-3">Akses Cabang</div>
              <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard Cabang" active={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} />
              <NavItem icon={<ShoppingCart size={20} />} label="Buat Invoice" active={activeTab === 'orders'} onClick={() => handleTabChange('orders')} />
              <NavItem icon={<Clock size={20} />} label="Hutang & Piutang" active={activeTab === 'piutang'} onClick={() => handleTabChange('piutang')} />
              <NavItem icon={<Package size={20} />} label="Manajemen Stok" active={activeTab === 'stok'} onClick={() => handleTabChange('stok')} />
              <NavItem icon={<Store size={20} />} label="Laporan Harian" active={activeTab === 'pemalang'} onClick={() => handleTabChange('pemalang')} />
            </>
          )}
        </nav>
        <div className="p-4 border-t border-slate-800"><button onClick={handleLogout} className="w-full flex justify-center gap-2 bg-slate-800 p-3 rounded-xl"><LogOut size={18}/> Keluar</button></div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b p-4 flex justify-between items-center z-10 shadow-sm"><h2 className="text-xl font-bold capitalize">Manajemen Data</h2></header>
        <div className="flex-1 overflow-auto p-6 bg-slate-50 relative">
          {activeTab === 'dashboard' && user.role === 'admin' && <TabDashboard orders={orders} expenses={expenses} purchases={purchases} piutangPayments={piutangPayments} pemalangReports={pemalangReports} setPrintData={setPrintData} />}
          {activeTab === 'dashboard' && user.role === 'branch' && <TabDashboardBranch orders={orders} pemalangReports={pemalangReports} setPrintData={setPrintData} user={user} stokData={stokData} />}
          {/* MENGIRIMKAN DATA PAYMENTS KE TAB ORDERS & PURCHASES AGAR STATUS LUNAS/PIUTANG AKURAT */}
          {activeTab === 'orders' && <TabOrders orders={orders} payments={piutangPayments} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'order', id})} role={user.role} />}
          {activeTab === 'purchases' && user.role === 'admin' && <TabPurchases purchases={purchases} payments={piutangPayments} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'purchase', id})} />}
          
          {activeTab === 'expenses' && user.role === 'admin' && <TabExpenses expenses={expenses} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'expense', id})} />}
          {activeTab === 'piutang' && <TabPiutang orders={orders} purchases={purchases} payments={piutangPayments} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'payment', id})} setPrintData={setPrintData} role={user.role} />}
          {activeTab === 'pemalang' && <TabPemalang reports={pemalangReports} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'pemalang', id})} role={user.role} />}
          {activeTab === 'stok' && <TabStok stokData={stokData} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'stok', id})} />}
        </div>
      </main>
    </div>
  );
}
