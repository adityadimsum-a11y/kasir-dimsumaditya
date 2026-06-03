import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Wallet, 
  Clock, Store, Loader2, LogOut, 
  Package, Truck, Users
} from 'lucide-react';

import TabDashboard from './components/tabs/TabDashboard';
import TabDashboardBranch from './components/tabs/TabDashboardBranch';
import TabOrders from './components/tabs/TabOrders';
import TabPurchases from './components/tabs/TabPurchases';
import TabExpenses from './components/tabs/TabExpenses';
import TabPiutang from './components/tabs/TabPiutang';
import TabPemalang from './components/tabs/TabPemalang';
import TabStok from './components/tabs/TabStok';
import TabKaryawan from './components/tabs/TabKaryawan';
import TabMonitoringPemalang from './components/tabs/TabMonitoringPemalang';

import { 
  PrintInvoiceDotMatrix, PrintPurchase, PrintVoucher, 
  PrintReceipt, PrintReport, PrintReportBranch, PrintSPK
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
    setActiveTab(tabName); window.localStorage.setItem('dimsum_active_tab', tabName);
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
  const [karyawan, setKaryawan] = useState([]); 

  useEffect(() => { if (user) fetchData(); }, [user]);

  const handleLogin = (e) => {
    e.preventDefault();
    const { username, password } = loginForm;
    let loggedInUser = null;
    if (username === 'dnamic' && password === 'Dnamic2026!!') loggedInUser = { role: 'admin', name: 'Administrator Pusat' };
    else if (username === 'pemalang' && password === 'pemalang123') loggedInUser = { role: 'branch', name: 'Cabang Pemalang', branchId: 'Pemalang' };

    if (loggedInUser) {
      setUser(loggedInUser); window.localStorage.setItem('dimsum_user_session', JSON.stringify(loggedInUser));
      handleTabChange('dashboard'); setLoginError(''); 
    } else setLoginError('Username atau Password salah!');
  };

  const handleLogout = () => {
    setUser(null); setLoginForm({ username: '', password: '' });
    window.localStorage.removeItem('dimsum_user_session'); window.localStorage.removeItem('dimsum_active_tab');
    setOrders([]); setExpenses([]); setPiutangPayments([]); setPemalangReports([]); setStokData([]); setPurchases([]); setKaryawan([]);
  };

  const fetchData = async () => {
    if (!SCRIPT_URL) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${SCRIPT_URL}?action=read&limit=2000`);
      const result = await response.json();
      if (result.status === 'success') {
        const data = result.data || [];
        setOrders(data.filter(item => item && item.table === 'orders' && !item.isDeleted).sort(safeSort));
        setExpenses(data.filter(item => item && item.table === 'expenses' && !item.isDeleted).sort(safeSort));
        setPiutangPayments(data.filter(item => item && item.table === 'payments' && !item.isDeleted).sort(safeSort));
        setPemalangReports(data.filter(item => item && item.table === 'pemalang' && !item.isDeleted).sort(safeSort));
        setStokData(data.filter(item => item && item.table === 'stok' && !item.isDeleted).sort(safeSort));
        setPurchases(data.filter(item => item && item.table === 'purchases' && !item.isDeleted).sort(safeSort));
        setKaryawan(data.filter(item => item && item.table === 'karyawan' && !item.isDeleted).sort(safeSort));
      }
    } catch (error) { 
      console.error("Gagal terhubung ke Database:", error);
    } finally { setIsLoading(false); }
  };

  const sendToSheet = async (action, data, table) => {
    if (action === 'insert') {
        const dataArray = Array.isArray(data) ? data : [data];
        if (table === 'orders') setOrders(prev => [...dataArray, ...prev]);
        if (table === 'expenses') setExpenses(prev => [...dataArray, ...prev]);
        if (table === 'payments') setPiutangPayments(prev => [...dataArray, ...prev]);
        if (table === 'pemalang') setPemalangReports(prev => [...dataArray, ...prev]);
        if (table === 'stok') setStokData(prev => [...dataArray, ...prev]);
        if (table === 'purchases') setPurchases(prev => [...dataArray, ...prev]);
        if (table === 'karyawan') setKaryawan(prev => [...dataArray, ...prev]);
    } else if (action === 'update') {
        const dataArray = Array.isArray(data) ? data : [data];
        const updateState = (prev) => prev.map(item => {
            const found = dataArray.find(d => d.id === item.id);
            return found ? { ...item, ...found } : item;
        });
        if (table === 'orders') setOrders(updateState);
        if (table === 'expenses') setExpenses(updateState);
        if (table === 'payments') setPiutangPayments(updateState);
        if (table === 'pemalang') setPemalangReports(updateState);
        if (table === 'stok') setStokData(updateState);
        if (table === 'purchases') setPurchases(updateState);
        if (table === 'karyawan') setKaryawan(updateState);
    } else if (action === 'delete') {
        if (table === 'orders') setOrders(prev => prev.filter(o => o.id !== data.id));
        if (table === 'expenses') setExpenses(prev => prev.filter(e => e.id !== data.id));
        if (table === 'payments') setPiutangPayments(prev => prev.filter(p => p.id !== data.id));
        if (table === 'pemalang') setPemalangReports(prev => prev.filter(p => p.id !== data.id));
        if (table === 'stok') setStokData(prev => prev.filter(s => s.id !== data.id));
        if (table === 'purchases') setPurchases(prev => prev.filter(p => p.id !== data.id));
        if (table === 'karyawan') setKaryawan(prev => prev.filter(k => k.id !== data.id));
    }
    
    try { 
      await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, table, data }) }); 
    } catch (error) { console.error("Gagal kirim ke Sheet:", error); }
  };

  const executeDelete = async () => {
    if(!confirmDialog) return;
    const { type, id } = confirmDialog;
    let colName = type === 'order' ? 'orders' : type === 'expense' ? 'expenses' : type === 'payment' ? 'payments' : type === 'pemalang' ? 'pemalang' : type === 'stok' ? 'stok' : type === 'purchase' ? 'purchases' : 'karyawan';
    await sendToSheet('delete', { id }, colName); setConfirmDialog(null);
  };

  const pendingHutangPiutang = useMemo(() => {
    const piutang = (orders || []).filter(o => (Number(o.total) - Number(o.paidAmount)) > 0).length;
    return piutang;
  }, [orders]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <form onSubmit={handleLogin} className="space-y-4">
            <h1 className="text-2xl font-bold text-center">Dimsum Aditya Login</h1>
            {loginError && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm text-center">{loginError}</div>}
            <input type="text" required placeholder="Username" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} className="w-full p-3 border rounded-xl" />
            <input type="password" required placeholder="Password" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-3 border rounded-xl" />
            <button type="submit" className="w-full bg-red-600 text-white font-bold py-3.5 rounded-xl">Masuk</button>
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
  if (printData?.type === 'spk') return <PrintSPK data={printData.data} onBack={() => setPrintData(null)} />;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800">
            <h1 className="font-bold text-lg">Dimsum Aditya</h1>
            <p className="text-xs text-emerald-400">{user.name}</p>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {user.role === 'admin' && (
            <>
              <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard & Rekap" active={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} />
              <NavItem icon={<ShoppingCart size={20} />} label="Order & Penjualan" active={activeTab === 'orders'} onClick={() => handleTabChange('orders')} />
              <NavItem icon={<Truck size={20} />} label="Pembelian Bahan" active={activeTab === 'purchases'} onClick={() => handleTabChange('purchases')} />
              <NavItem icon={<Wallet size={20} />} label="Kas Umum (Lainnya)" active={activeTab === 'expenses'} onClick={() => handleTabChange('expenses')} />
              <NavItem icon={<Clock size={20} />} label="Hutang & Piutang" active={activeTab === 'piutang'} onClick={() => handleTabChange('piutang')} />
              <div className="pt-2 mt-2 border-t border-slate-800"><NavItem icon={<Package size={20} />} label="Produksi & Stok (Pusat)" active={activeTab === 'stok'} onClick={() => handleTabChange('stok')} /></div>
              <NavItem icon={<Store size={20} />} label="Monitoring Pemalang" active={activeTab === 'monitoring_pemalang'} onClick={() => handleTabChange('monitoring_pemalang')} />
              <div className="pt-2 mt-2 border-t border-slate-800"><NavItem icon={<Users size={20} />} label="Karyawan & Gaji" active={activeTab === 'karyawan'} onClick={() => handleTabChange('karyawan')} /></div>
            </>
          )}
          {user.role === 'branch' && (
            <>
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
        <header className="bg-white border-b p-4 shadow-sm"><h2 className="text-xl font-bold capitalize">{activeTab.replace('_', ' ')}</h2></header>
        <div className="flex-1 overflow-auto p-6 bg-slate-50">
          {activeTab === 'dashboard' && user.role === 'admin' && <TabDashboard orders={orders} expenses={expenses} purchases={purchases} piutangPayments={piutangPayments} pemalangReports={pemalangReports} setPrintData={setPrintData} sendToSheet={sendToSheet} />}
          {activeTab === 'dashboard' && user.role === 'branch' && <TabDashboardBranch orders={orders} pemalangReports={pemalangReports} piutangPayments={piutangPayments} setPrintData={setPrintData} stokData={stokData} />}
          {activeTab === 'orders' && <TabOrders orders={orders} payments={piutangPayments} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'order', id})} role={user.role} />}
          {activeTab === 'purchases' && user.role === 'admin' && <TabPurchases purchases={purchases} payments={piutangPayments} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'purchase', id})} />}
          {activeTab === 'expenses' && user.role === 'admin' && <TabExpenses expenses={expenses} karyawan={karyawan} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'expense', id})} />}
          {activeTab === 'piutang' && <TabPiutang orders={orders} purchases={purchases} payments={piutangPayments} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'payment', id})} setPrintData={setPrintData} role={user.role} />}
          {activeTab === 'pemalang' && <TabPemalang reports={pemalangReports} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'pemalang', id})} role={user.role} />}
          {activeTab === 'stok' && <TabStok stokData={stokData} purchases={purchases} orders={orders} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'stok', id})} role={user.role} />}
          {activeTab === 'monitoring_pemalang' && user.role === 'admin' && <TabMonitoringPemalang orders={orders} pemalangReports={pemalangReports} stokData={stokData} />}
          {activeTab === 'karyawan' && user.role === 'admin' && <TabKaryawan karyawan={karyawan} expenses={expenses} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'karyawan', id})} />}
        </div>
      </main>
    </div>
  );
}
