import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Wallet, 
  Clock, Store, Loader2, LogOut, 
  Package, Truck, Users, AlertCircle
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
  PrintReceipt, PrintReport, PrintReportBranch, PrintSPK, PrintBuktiStok
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
  
  // STATE UNTUK POP-UP KONFIRMASI DELETE
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
    await sendToSheet('delete', { id }, colName); 
    setConfirmDialog(null);
  };

  const pendingHutangPiutang = useMemo(() => {
    const piutang = (orders || []).filter(o => (Number(o.total) - Number(o.paidAmount)) > 0).length;
    return piutang;
  }, [orders]);

  // ==========================================
  // DESAIN LOGIN CENTERED MINIMALIST (NO IMAGE)
  // ==========================================
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        
        {/* Ornamen Latar Belakang Lingkaran Halus (Opsional, agar tidak terlalu kosong) */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-red-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

        {/* Card Form Login */}
        <div className="w-full max-w-md bg-white p-8 lg:p-10 rounded-3xl shadow-xl border border-slate-100 relative z-10 animate-in fade-in zoom-in duration-500">
          
          {/* Bagian Logo dan Judul */}
          <div className="flex flex-col items-center mb-8">
            <img 
              src="https://dimsumaditya.id/wp-content/uploads/2026/06/Dimsum-Aditya-New-Logo-scaled.webp" 
              alt="Logo Dimsum Aditya" 
              className="h-28 w-auto mb-4 object-contain"
            />
            <h1 className="text-2xl font-black text-slate-800 text-center tracking-tight">Sistem Enterprise</h1>
            <p className="text-slate-500 mt-1 text-sm text-center font-medium">Masuk untuk mengelola kasir dan operasional</p>
          </div>

          {/* Form Input */}
          <form onSubmit={handleLogin} className="space-y-5">
            {loginError && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100 flex items-center gap-2">
                 <AlertCircle size={16} className="shrink-0"/> <span>{loginError}</span>
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Username</label>
              <input 
                type="text" 
                required 
                placeholder="Masukkan username" 
                value={loginForm.username} 
                onChange={e => setLoginForm({...loginForm, username: e.target.value})} 
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-medium text-slate-800 placeholder-slate-400" 
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Password</label>
              <input 
                type="password" 
                required 
                placeholder="••••••••" 
                value={loginForm.password} 
                onChange={e => setLoginForm({...loginForm, password: e.target.value})} 
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-medium text-slate-800 placeholder-slate-400" 
              />
            </div>
            
            <button 
              type="submit" 
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-[0_4px_12px_rgba(220,38,38,0.3)] hover:shadow-[0_6px_16px_rgba(220,38,38,0.4)] hover:-translate-y-0.5 transition-all mt-6"
            >
              Masuk ke Sistem
            </button>
          </form>
        </div>

        {/* Footer Copyright */}
        <div className="absolute bottom-6 text-center w-full text-[11px] font-medium text-slate-400 z-10">
           &copy; {new Date().getFullYear()} Hak Cipta Dilindungi.<br/>
           Sistem Manajemen oleh <a href="https://dimsumaditya.id/" target="_blank" rel="noreferrer" className="text-red-600 font-bold hover:underline transition">Dimsum Aditya</a>
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
  if (printData?.type === 'bukti_stok') return <PrintBuktiStok data={printData.data} onBack={() => setPrintData(null)} />;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 relative shadow-xl z-20">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50">
            {/* Menambahkan Logo Kecil di Sidebar Menu agar serasi */}
            <div className="bg-white p-2 rounded-lg inline-block mb-3 shadow-md">
                <img src="https://dimsumaditya.id/wp-content/uploads/2026/06/Dimsum-Aditya-New-Logo-scaled.webp" alt="Logo" className="h-8 w-auto" />
            </div>
            <h1 className="font-black text-lg tracking-wide uppercase">Dimsum Aditya</h1>
            <p className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded w-max mt-1">{user.name}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {user.role === 'admin' && (
            <>
              <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard & Rekap" active={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} />
              <NavItem icon={<ShoppingCart size={20} />} label="Order & Penjualan" active={activeTab === 'orders'} onClick={() => handleTabChange('orders')} />
              <NavItem icon={<Truck size={20} />} label="Pembelian Bahan" active={activeTab === 'purchases'} onClick={() => handleTabChange('purchases')} />
              <NavItem icon={<Wallet size={20} />} label="Kas Umum (Lainnya)" active={activeTab === 'expenses'} onClick={() => handleTabChange('expenses')} />
              <NavItem icon={<Clock size={20} />} label="Hutang & Piutang" active={activeTab === 'piutang'} onClick={() => handleTabChange('piutang')} />
              <div className="pt-2 mt-2 border-t border-slate-800/60"><NavItem icon={<Package size={20} />} label="Produksi & Stok (Pusat)" active={activeTab === 'stok'} onClick={() => handleTabChange('stok')} /></div>
              <NavItem icon={<Store size={20} />} label="Monitoring Pemalang" active={activeTab === 'monitoring_pemalang'} onClick={() => handleTabChange('monitoring_pemalang')} />
              <div className="pt-2 mt-2 border-t border-slate-800/60"><NavItem icon={<Users size={20} />} label="Karyawan & Gaji" active={activeTab === 'karyawan'} onClick={() => handleTabChange('karyawan')} /></div>
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
        <div className="p-4 border-t border-slate-800"><button onClick={handleLogout} className="w-full flex justify-center gap-2 bg-slate-800/80 hover:bg-red-600 hover:text-white p-3 rounded-xl transition-all font-bold text-sm"><LogOut size={18}/> Keluar Sistem</button></div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="bg-white border-b p-4 shadow-sm z-10"><h2 className="text-xl font-bold capitalize text-slate-800 flex items-center gap-2">{activeTab.replace('_', ' ')}</h2></header>
        <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
          {activeTab === 'dashboard' && user.role === 'admin' && <TabDashboard orders={orders} expenses={expenses} purchases={purchases} piutangPayments={piutangPayments} pemalangReports={pemalangReports} stokData={stokData} setPrintData={setPrintData} sendToSheet={sendToSheet} />}
          {activeTab === 'dashboard' && user.role === 'branch' && <TabDashboardBranch orders={orders} pemalangReports={pemalangReports} piutangPayments={piutangPayments} setPrintData={setPrintData} stokData={stokData} />}
          {activeTab === 'orders' && <TabOrders orders={orders} payments={piutangPayments} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'order', id})} role={user.role} />}
          {activeTab === 'purchases' && user.role === 'admin' && <TabPurchases purchases={purchases} payments={piutangPayments} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'purchase', id})} />}
          {activeTab === 'expenses' && user.role === 'admin' && <TabExpenses expenses={expenses} karyawan={karyawan} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'expense', id})} />}
          {activeTab === 'piutang' && <TabPiutang orders={orders} purchases={purchases} payments={piutangPayments} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'payment', id})} setPrintData={setPrintData} role={user.role} />}
          {activeTab === 'pemalang' && <TabPemalang reports={pemalangReports} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'pemalang', id})} role={user.role} />}
          {activeTab === 'stok' && <TabStok stokData={stokData} purchases={purchases} orders={orders} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'stok', id})} setPrintData={setPrintData} role={user.role} />}
          {activeTab === 'monitoring_pemalang' && user.role === 'admin' && <TabMonitoringPemalang orders={orders} pemalangReports={pemalangReports} stokData={stokData} />}
          {activeTab === 'karyawan' && user.role === 'admin' && <TabKaryawan karyawan={karyawan} expenses={expenses} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'karyawan', id})} />}
        </div>
        
        {/* ========================================== */}
        {/* MODAL POP-UP KONFIRMASI DELETE PERMANEN */}
        {/* ========================================== */}
        {confirmDialog && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center transform transition-all scale-100">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
                  <AlertCircle size={40} className="text-red-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Konfirmasi Hapus</h3>
              <p className="text-sm text-slate-500 mb-8 font-medium leading-relaxed">Apakah Anda yakin ingin menghapus data ini secara permanen? Data yang dihapus akan mempengaruhi seluruh kalkulasi kas dan stok.</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setConfirmDialog(null)} className="w-1/2 px-4 py-3.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition">Batal</button>
                <button onClick={executeDelete} className="w-1/2 px-4 py-3.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-md transition">Ya, Hapus!</button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
