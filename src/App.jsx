import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Wallet, CreditCard, 
  Plus, Printer, Search, ChevronDown, CheckCircle, 
  Clock, X, FileText, ArrowRightLeft, Trash2, Calendar,
  Store, Coins, Loader2, LogOut, TrendingUp, Users, Package,
  ArrowDownToLine, ArrowUpFromLine, UtilityPole, Utensils, Filter,
  Truck, Edit
} from 'lucide-react';

// =====================================================================
// === GANTI URL DI BAWAH INI DENGAN URL WEB APP GOOGLE SCRIPT ANDA ===
// =====================================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyqCaTepk_duXguiOqSM572mbUIGozcghhh8LHNMNw2e83O7Wkyu-SkjdVTO3zpTb64PA/exec'; 
// =====================================================================

// --- UTILITIES (OPTIMASI FORMAT) ---
const rpFormatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

const formatRp = (angka) => {
  const num = Number(angka);
  if (isNaN(num) || num === 0) return 'Rp 0';
  return rpFormatter.format(num);
};

const parseRp = (str) => {
  if (typeof str === 'number') return str;
  const num = Number(String(str).replace(/[^0-9]/g, ''));
  return isNaN(num) ? 0 : num;
};

const getTodayStr = () => {
    const d = new Date(new Date().getTime() + (7 * 60 * 60 * 1000)); 
    return d.toISOString().split('T')[0];
};

const getLocalYMD = (dateVal) => {
    if(!dateVal) return '';
    const str = String(dateVal);
    if(str.length >= 10 && str[4] === '-') return str.substring(0, 10);
    const d = new Date(dateVal);
    if(isNaN(d.getTime())) return str.split('T')[0];
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const formatDate = (date) => {
  if(!date) return '-';
  const d = new Date(date);
  if(isNaN(d.getTime())) return String(date).split('T')[0]; 
  return dateFormatter.format(d);
};

const generateId = (prefix, date) => {
  const d = new Date(date || Date.now());
  const mmyy = isNaN(d.getTime()) ? `ERR` : `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getFullYear()).slice(-2)}`;
  const seq = String(Math.floor(Math.random() * 9000) + 1000); 
  return `${prefix}-DMA-${mmyy}-${seq}`;
};

const safeSort = (a, b) => {
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    if(isNaN(da) || isNaN(db)) return -1;
    return db - da;
};

const terbilang = (angka) => {
  const num = Math.floor(Number(angka));
  if (isNaN(num) || num <= 0) return 'Nol';
  const t = (n) => {
    if (n < 12) return ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'][n];
    if (n < 20) return t(n - 10) + ' Belas';
    if (n < 100) return t(Math.floor(n / 10)) + ' Puluh' + (n % 10 === 0 ? '' : ' ' + t(n % 10));
    if (n < 200) return 'Seratus' + (n - 100 === 0 ? '' : ' ' + t(n - 100));
    if (n < 1000) return t(Math.floor(n / 100)) + ' Ratus' + (n % 100 === 0 ? '' : ' ' + t(n % 100));
    if (n < 2000) return 'Seribu' + (n - 1000 === 0 ? '' : ' ' + t(n - 1000));
    if (n < 1000000) return t(Math.floor(n / 1000)) + ' Ribu' + (n % 1000 === 0 ? '' : ' ' + t(n % 1000));
    if (n < 1000000000) return t(Math.floor(n / 1000000)) + ' Juta' + (n % 1000000 === 0 ? '' : ' ' + t(n % 1000000));
    if (n < 1000000000000) return t(Math.floor(n / 1000000000)) + ' Milyar' + (n % 1000000000 === 0 ? '' : ' ' + t(n % 1000000000));
    return '';
  };
  return t(num);
};

const KATEGORI_HARGA = {
  'Reseller': 2125, 'Pemalang': 2250, 'Mitra': 2000, 'Eceran': 3000,
  'Shopee': 0, 'Tokopedia': 0, 'TikTok': 0, 'ShopeeFood': 0, 'GoFood': 0
};

const SATUAN_BARANG = ['Kg', 'Gram', 'Pack', 'Kantong', 'Pcs', 'Bungkus', 'Liter', 'Tabung', 'Bal', 'Dus', 'Krat', 'Lusin'];

const KATEGORI_PENGELUARAN = [
  'Operasional & Transport', 'Konsumsi Karyawan', 'Kasbon', 'Jamuan', 'Setoran / Closing Kas Harian', 'Lainnya'
];

export default function App() {
  const [user, setUser] = useState(null); 
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [printData, setPrintData] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null); 
  
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [piutangPayments, setPiutangPayments] = useState([]);
  const [pemalangReports, setPemalangReports] = useState([]);
  const [stokData, setStokData] = useState([]); 
  const [purchases, setPurchases] = useState([]);

  const handleLogin = (e) => {
    e.preventDefault();
    const { username, password } = loginForm;
    if (username === 'dnamic' && password === 'Dnamic2026!!') {
      setUser({ role: 'admin', name: 'Administrator Pusat' });
      setActiveTab('dashboard'); setLoginError(''); fetchData(); 
    } else if (username === 'pemalang' && password === 'pemalang123') {
      setUser({ role: 'branch', name: 'Cabang Pemalang', branchId: 'Pemalang' });
      setActiveTab('dashboard'); setLoginError(''); fetchData();
    } else {
      setLoginError('Username atau Password salah!');
    }
  };

  const handleLogout = () => {
    setUser(null); setLoginForm({ username: '', password: '' });
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
        setOrders(data.filter(item => item.table === 'orders' && !item.isDeleted).sort(safeSort));
        setExpenses(data.filter(item => item.table === 'expenses' && !item.isDeleted).sort(safeSort));
        setPiutangPayments(data.filter(item => item.table === 'payments' && !item.isDeleted).sort(safeSort));
        setPemalangReports(data.filter(item => item.table === 'pemalang' && !item.isDeleted).sort(safeSort));
        setStokData(data.filter(item => item.table === 'stok' && !item.isDeleted).sort(safeSort));
        setPurchases(data.filter(item => item.table === 'purchases' && !item.isDeleted).sort(safeSort));
      }
    } catch (error) {
      console.error("Gagal ambil data:", error); alert("Gagal terhubung ke DB.");
    } finally {
      setIsLoading(false);
    }
  };

  const sendToSheet = async (action, data, table) => {
    if (!SCRIPT_URL || SCRIPT_URL === 'TARUH_LINK_GOOGLE_SCRIPT_DISINI') {
        alert("SIMULASI: Data tersimpan di layar sementara. Harap masukkan link Script Google yang benar."); return;
    }

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
    }

    try {
      await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, table, data }) });
    } catch (error) { console.error("Gagal simpan:", error); }
  };

  const executeDelete = async () => {
    if(!confirmDialog) return;
    const { type, id } = confirmDialog;
    let colName = '';
    
    if (type === 'order') { colName = 'orders'; setOrders(prev => prev.filter(o => o.id !== id)); } 
    else if (type === 'expense') { colName = 'expenses'; setExpenses(prev => prev.filter(e => e.id !== id)); } 
    else if (type === 'payment') { colName = 'payments'; setPiutangPayments(prev => prev.filter(p => p.id !== id)); } 
    else if (type === 'pemalang') { colName = 'pemalang'; setPemalangReports(prev => prev.filter(p => p.id !== id)); } 
    else if (type === 'stok') { colName = 'stok'; setStokData(prev => prev.filter(s => s.id !== id)); }
    else if (type === 'purchase') { colName = 'purchases'; setPurchases(prev => prev.filter(p => p.id !== id)); }

    await sendToSheet('delete', { id }, colName);
    setConfirmDialog(null);
  };

  const pendingHutangPiutang = useMemo(() => {
    // Group per invoice ID to handle multi-items properly for the badge
    const piutangGroups = {};
    const hutangGroups = {};

    orders.forEach(o => {
      if(!piutangGroups[o.id]) piutangGroups[o.id] = { total: 0, paid: 0 };
      piutangGroups[o.id].total += Number(o.total) || 0;
      piutangGroups[o.id].paid = Number(o.paidAmount) || 0; // DP is only recorded on the invoice level
    });

    purchases.forEach(p => {
      if(!hutangGroups[p.id]) hutangGroups[p.id] = { total: 0, paid: 0 };
      hutangGroups[p.id].total += Number(p.total) || 0;
      hutangGroups[p.id].paid = Number(p.paidAmount) || 0;
    });

    const piutang = Object.keys(piutangGroups).filter(id => {
      const cicilan = piutangPayments.filter(p => p.orderId === id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      return (piutangGroups[id].total - piutangGroups[id].paid - cicilan) > 0;
    }).length;

    const hutang = Object.keys(hutangGroups).filter(id => {
      const cicilan = piutangPayments.filter(p => p.orderId === id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      return (hutangGroups[id].total - hutangGroups[id].paid - cicilan) > 0;
    }).length;

    return piutang + hutang;
  }, [orders, purchases, piutangPayments]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="absolute w-96 h-96 bg-red-600 rounded-full blur-3xl opacity-20 top-10 left-10"></div>
        <div className="absolute w-96 h-96 bg-orange-500 rounded-full blur-3xl opacity-20 bottom-10 right-10"></div>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center shadow-inner mb-4 overflow-hidden p-1">
              <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Dimsum Aditya</h1>
            <p className="text-sm text-slate-500">Sistem Informasi Manajemen Terpadu</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium text-center">{loginError}</div>}
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-1">Username Login</label>
              <input type="text" required value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-red-500 bg-slate-50" />
            </div>
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-1">Password</label>
              <input type="password" required value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-red-500 bg-slate-50" />
            </div>
            <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg mt-4">Masuk ke Sistem</button>
          </form>
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50"><Loader2 className="w-12 h-12 text-red-600 animate-spin mb-4" />Menyinkronkan Database...</div>;

  if (printData?.type === 'invoice') return <PrintInvoiceDotMatrix data={printData.data} onBack={() => setPrintData(null)} />;
  if (printData?.type === 'purchase') return <PrintPurchase data={printData.data} onBack={() => setPrintData(null)} />;
  if (printData?.type === 'voucher') return <PrintVoucher data={printData.data} onBack={() => setPrintData(null)} />;
  if (printData?.type === 'receipt') return <PrintReceipt data={printData.data} onBack={() => setPrintData(null)} />;
  if (printData?.type === 'report') return <PrintReport data={printData.data} onBack={() => setPrintData(null)} />;
  if (printData?.type === 'reportBranch') return <PrintReportBranch data={printData.data} onBack={() => setPrintData(null)} user={user} />;

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800">
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-lg text-red-600 mb-2">Konfirmasi Hapus Aman</h3>
            <p className="text-slate-600 text-sm mb-6">Apakah Anda yakin ingin menghapus data ini secara permanen?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 bg-slate-100 rounded-lg text-sm font-bold">Batal</button>
              <button onClick={executeDelete} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold">Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}

      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-0.5"><img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="DA Logo" className="w-full h-full object-contain" /></div>
          <div><h1 className="font-bold text-lg leading-tight truncate w-40">Dimsum Aditya</h1><p className="text-xs text-emerald-400 font-bold"><CheckCircle size={10} className="inline"/> {user.name}</p></div>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {user.role === 'admin' && (
            <>
              <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard & Rekap" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
              <NavItem icon={<ShoppingCart size={20} />} label="Order & Penjualan" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
              <NavItem icon={<Truck size={20} />} label="Pembelian Bahan" active={activeTab === 'purchases'} onClick={() => setActiveTab('purchases')} />
              <NavItem icon={<Wallet size={20} />} label="Kas Umum (Lainnya)" active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} />
              <NavItem icon={<Clock size={20} />} label="Hutang & Piutang" active={activeTab === 'piutang'} onClick={() => setActiveTab('piutang')} badge={pendingHutangPiutang} />
              <div className="pt-4 mt-2 border-t border-slate-800">
                  <NavItem icon={<Package size={20} />} label="Stok Freezer Cabang" active={activeTab === 'stok'} onClick={() => setActiveTab('stok')} />
                  <NavItem icon={<Store size={20} />} label="Laporan Pemalang" active={activeTab === 'pemalang'} onClick={() => setActiveTab('pemalang')} />
              </div>
            </>
          )}
          {user.role === 'branch' && (
            <>
              <div className="text-xs font-bold text-slate-500 uppercase mb-2 px-3">Akses Cabang</div>
              <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard Cabang" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
              <NavItem icon={<ShoppingCart size={20} />} label="Buat Invoice" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
              <NavItem icon={<Clock size={20} />} label="Hutang & Piutang" active={activeTab === 'piutang'} onClick={() => setActiveTab('piutang')} />
              <NavItem icon={<Package size={20} />} label="Manajemen Stok" active={activeTab === 'stok'} onClick={() => setActiveTab('stok')} />
              <NavItem icon={<Store size={20} />} label="Laporan Harian" active={activeTab === 'pemalang'} onClick={() => setActiveTab('pemalang')} />
            </>
          )}
        </nav>
        <div className="p-4 border-t border-slate-800">
           <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white p-3 rounded-xl transition font-medium text-sm"><LogOut size={18} /> Keluar</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 capitalize">
            {activeTab === 'dashboard' ? (user.role === 'admin' ? 'Dashboard Utama' : 'Dashboard Cabang') : 
             activeTab === 'piutang' ? 'Manajemen Hutang & Piutang' : 
             activeTab === 'pemalang' ? 'Area Laporan Pemalang' : 
             activeTab === 'stok' ? 'Manajemen Stok Bahan' : 
             activeTab === 'purchases' ? 'Data Pembelian & Restock' : `Manajemen ${activeTab}`}
          </h2>
          <div className="text-sm font-medium text-slate-500 bg-slate-100 px-4 py-2 rounded-full border flex items-center gap-2 hide-on-mobile">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date())}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 bg-slate-50 relative">
          {activeTab === 'dashboard' && user.role === 'admin' && <TabDashboard orders={orders} expenses={expenses} purchases={purchases} piutangPayments={piutangPayments} pemalangReports={pemalangReports} setPrintData={setPrintData} />}
          {activeTab === 'dashboard' && user.role === 'branch' && <TabDashboardBranch orders={orders} pemalangReports={pemalangReports} setPrintData={setPrintData} user={user} stokData={stokData} />}
          {activeTab === 'orders' && <TabOrders orders={orders} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'order', id})} role={user.role} />}
          {activeTab === 'purchases' && user.role === 'admin' && <TabPurchases purchases={purchases} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'purchase', id})} setPrintData={setPrintData} />}
          {activeTab === 'expenses' && user.role === 'admin' && <TabExpenses expenses={expenses} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'expense', id})} />}
          {activeTab === 'piutang' && <TabPiutang orders={orders} purchases={purchases} payments={piutangPayments} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'payment', id})} setPrintData={setPrintData} role={user.role} />}
          {activeTab === 'pemalang' && <TabPemalang reports={pemalangReports} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'pemalang', id})} role={user.role} />}
          {activeTab === 'stok' && <TabStok stokData={stokData} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'stok', id})} />}
        </div>
      </main>
    </div>
  );
}

// --- TAB DASHBOARD PUSAT ---
function TabDashboard({ orders, expenses, purchases, piutangPayments, pemalangReports, setPrintData }) {
  const todayStr = getTodayStr();
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [chartView, setChartView] = useState('daily'); 

  const rekap = useMemo(() => {
    const isCumulative = (dateStr) => getLocalYMD(dateStr) && getLocalYMD(dateStr) <= dateTo;
    const isPeriod = (dateStr) => getLocalYMD(dateStr) && getLocalYMD(dateStr) >= dateFrom && getLocalYMD(dateStr) <= dateTo;

    // Filter Cumulative
    const cumOrdersPusat = orders.filter(o => isCumulative(o.date) && o.category !== 'Pemalang');
    const cumPurchases = purchases.filter(p => isCumulative(p.date));
    const cumExpenses = expenses.filter(e => isCumulative(e.date));
    const cumPayments = piutangPayments.filter(p => isCumulative(p.date));
    const cumPemalangReports = pemalangReports.filter(p => isCumulative(p.date));

    let kasMasukCash = 0, kasMasukTF = 0, kasKeluarCash = 0, kasKeluarTF = 0;
    let totalBebanTunai = 0, totalClosingTunai = 0;

    // Grouping by ID to prevent duplicate PaidAmount additions
    const groupedOrdersCum = {};
    cumOrdersPusat.forEach(o => {
        if(!groupedOrdersCum[o.id]) groupedOrdersCum[o.id] = { method: o.paymentMethod, paid: Number(o.paidAmount)||0 };
    });
    Object.values(groupedOrdersCum).forEach(o => {
        if(o.method === 'Cash') kasMasukCash += o.paid; else if(o.method === 'Transfer') kasMasukTF += o.paid;
    });

    const groupedPurCum = {};
    cumPurchases.forEach(p => {
        if(!groupedPurCum[p.id]) groupedPurCum[p.id] = { method: p.paymentMethod, paid: Number(p.paidAmount)||0 };
    });
    Object.values(groupedPurCum).forEach(p => {
        if(p.method === 'Cash') kasKeluarCash += p.paid; else if(p.method === 'Transfer') kasKeluarTF += p.paid;
    });

    cumExpenses.forEach(e => {
        const t = Number(e.total) || 0;
        if (e.type === 'IN') {
            if (e.paymentMethod === 'Cash') kasMasukCash += t; else kasMasukTF += t;
        } else {
            if (e.paymentMethod === 'Cash') {
                kasKeluarCash += t;
                if(e.category === 'Setoran / Closing Kas Harian') totalClosingTunai += t;
                else totalBebanTunai += t;
            } else {
                kasKeluarTF += t;
            }
        }
    });

    cumPayments.forEach(pay => {
        const amt = Number(pay.amount) || 0;
        const isMembayarHutangBeli = String(pay.orderId || '').startsWith('BUY-');
        if(isMembayarHutangBeli) {
            if (pay.paymentMethod === 'Cash') kasKeluarCash += amt; else kasKeluarTF += amt;
        } else {
            if (pay.paymentMethod === 'Cash') kasMasukCash += amt; else kasMasukTF += amt;
        }
    });

    let setoranPemalangTF = 0;
    cumPemalangReports.forEach(p => { setoranPemalangTF += (Number(p.nominal) || 0); });

    const saldoCash = kasMasukCash - kasKeluarCash;
    const saldoTF = (kasMasukTF + setoranPemalangTF) - kasKeluarTF;
    const saldoAkhir = saldoCash + saldoTF;

    // METRIK PERIODE
    const periodOrdersPusat = cumOrdersPusat.filter(o => isPeriod(o.date));
    const periodPurchases = cumPurchases.filter(p => isPeriod(p.date));
    const periodExpenses = cumExpenses.filter(e => isPeriod(e.date));
    
    let totalPenjualanKotor = 0, totalPorsi = 0, totalPcs = 0, totalPiutangBaru = 0, totalHutangBaru = 0;
    const breakdownPorsi = {}; const chartDataMap = {}; const customerMap = {};

    periodOrdersPusat.forEach(o => {
        const qty = Number(o.qty) || 0; const total = Number(o.total) || 0;
        totalPcs += qty; totalPorsi += (qty / 4); totalPenjualanKotor += total;
        breakdownPorsi[o.category] = (breakdownPorsi[o.category] || 0) + (qty / 4);

        const cName = String(o.customer || '').toUpperCase();
        if(!customerMap[cName]) customerMap[cName] = { name: cName, qty: 0, porsi: 0, total: 0, frequency: 0 };
        customerMap[cName].qty += qty; customerMap[cName].porsi += (qty / 4); customerMap[cName].total += total; customerMap[cName].frequency += 1;

        let cKey = chartView === 'daily' ? new Date(o.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : new Date(o.date).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
        chartDataMap[cKey] = (chartDataMap[cKey] || 0) + total;
    });

    // Grouping Piutang / Hutang Baru Periode ini
    const orderGroups = {};
    periodOrdersPusat.forEach(o => {
        if(!orderGroups[o.id]) orderGroups[o.id] = { total:0, paid: Number(o.paidAmount)||0 };
        orderGroups[o.id].total += Number(o.total)||0;
    });
    Object.values(orderGroups).forEach(g => { if(g.total - g.paid > 0) totalPiutangBaru += (g.total - g.paid); });

    const purGroups = {};
    periodPurchases.forEach(p => {
        if(!purGroups[p.id]) purGroups[p.id] = { total:0, paid: Number(p.paidAmount)||0 };
        purGroups[p.id].total += Number(p.total)||0;
    });
    Object.values(purGroups).forEach(g => { if(g.total - g.paid > 0) totalHutangBaru += (g.total - g.paid); });

    const finalChartData = Object.keys(chartDataMap).map(k => ({ label: k, value: chartDataMap[k] }));
    const topCustomersList = Object.values(customerMap).sort((a,b) => b.total - a.total);

    // Pengumpulan List Hutang/Piutang yg Belum Lunas dengan Grouping ID
    const groupOrdersAll = {};
    orders.filter(o => o.category !== 'Pemalang').forEach(o => {
        if(!groupOrdersAll[o.id]) groupOrdersAll[o.id] = { ...o, items: [], totalTagihan: 0, totalDibayar: Number(o.paidAmount)||0 };
        groupOrdersAll[o.id].items.push(`${o.qty} Pcs`);
        groupOrdersAll[o.id].totalTagihan += Number(o.total)||0;
    });
    const listPiutangBerjalan = Object.values(groupOrdersAll).map(grp => {
        const cicilan = piutangPayments.filter(p => p.orderId === grp.id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        return { ...grp, cicilanTerbayar: cicilan, sisaHutang: grp.totalTagihan - grp.totalDibayar - cicilan };
    }).filter(o => o.sisaHutang > 0);

    const groupPurAll = {};
    purchases.forEach(p => {
        if(!groupPurAll[p.id]) groupPurAll[p.id] = { ...p, items: [], totalTagihan: 0, totalDibayar: Number(p.paidAmount)||0 };
        groupPurAll[p.id].items.push(`${p.itemName} (${p.qty} ${p.satuan})`);
        groupPurAll[p.id].totalTagihan += Number(p.total)||0;
    });
    const listHutangBerjalan = Object.values(groupPurAll).map(grp => {
        const cicilan = piutangPayments.filter(p => p.orderId === grp.id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        return { ...grp, cicilanTerbayar: cicilan, sisaHutang: grp.totalTagihan - grp.totalDibayar - cicilan };
    }).filter(p => p.sisaHutang > 0);

    const listPembayaranSemua = cumPayments.filter(p => isPeriod(p.date)).map(pay => {
        const isHutang = String(pay.orderId || '').startsWith('BUY-');
        const relData = isHutang ? groupPurAll[pay.orderId] : groupOrdersAll[pay.orderId];
        const cicilan = piutangPayments.filter(p=>p.orderId===pay.orderId).reduce((s,p)=>s+(Number(p.amount)||0), 0);
        const sisa = (Number(relData?.totalTagihan)||0) - (Number(relData?.totalDibayar)||0) - cicilan;
        return { ...pay, customer: relData ? (isHutang ? relData.supplier : relData.customer) : '-', statusNota: sisa <= 0 ? 'LUNAS' : 'BELUM LUNAS', tipe: isHutang ? 'HUTANG' : 'PIUTANG' };
    });

    let inCashPeriode = 0, inTfPeriode = 0, outCashPeriode = 0, outTfPeriode = 0;
    Object.keys(orderGroups).forEach(id => {
        const ord = periodOrdersPusat.find(o => o.id === id);
        if(ord.paymentMethod === 'Cash') inCashPeriode += orderGroups[id].paid; else if(ord.paymentMethod === 'Transfer') inTfPeriode += orderGroups[id].paid;
    });
    Object.keys(purGroups).forEach(id => {
        const pur = periodPurchases.find(p => p.id === id);
        if(pur.paymentMethod === 'Cash') outCashPeriode += purGroups[id].paid; else if(pur.paymentMethod === 'Transfer') outTfPeriode += purGroups[id].paid;
    });

    periodExpenses.forEach(e => {
        const t = Number(e.total) || 0;
        if (e.type === 'IN') {
            if (e.paymentMethod === 'Cash') inCashPeriode += t; else inTfPeriode += t;
        } else {
            if (e.paymentMethod === 'Cash') outCashPeriode += t; else outTfPeriode += t;
        }
    });
    listPembayaranSemua.forEach(pay => {
        const amt = Number(pay.amount) || 0;
        if(pay.tipe === 'HUTANG') {
            if (pay.paymentMethod === 'Cash') outCashPeriode += amt; else outTfPeriode += amt;
        } else {
            if (pay.paymentMethod === 'Cash') inCashPeriode += amt; else inTfPeriode += amt;
        }
    });

    let setorPemalangPeriode = 0;
    cumPemalangReports.filter(p => isPeriod(p.date)).forEach(p => { setorPemalangPeriode += (Number(p.nominal) || 0); });
    inTfPeriode += setorPemalangPeriode;

    // Group items for Report Detail View
    const groupedTransaksiPusat = Object.values(periodOrdersPusat.reduce((acc, o) => {
        if(!acc[o.id]) acc[o.id] = { ...o, items: [], total: 0 };
        acc[o.id].items.push(`${o.qty} Pcs`);
        acc[o.id].total += Number(o.total)||0;
        return acc;
    }, {}));

    return {
        saldoCash, saldoTF, saldoAkhir, totalBebanTunai, totalClosingTunai,
        inCashPeriode, inTfPeriode, outCashPeriode, outTfPeriode, setorPemalangPeriode,
        totalPenjualanKotor, totalPorsi, totalPcs, breakdownPorsi, totalPiutangBaru, totalHutangBaru,
        topCustomersList, finalChartData, listPiutangBerjalan, listHutangBerjalan,
        listTransaksiDetail: groupedTransaksiPusat, listPembelianDetail: periodPurchases, 
        listExpenses: periodExpenses, listPemalang: cumPemalangReports.filter(p => isPeriod(p.date)), listPembayaranSemua
    };
  }, [orders, expenses, purchases, piutangPayments, pemalangReports, dateFrom, dateTo, chartView]);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
              <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Calendar size={16}/> Filter Laporan & Cetak</h3>
              <div className="flex gap-2">
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-2 text-sm border rounded-lg focus:ring-2 focus:ring-slate-300" />
                  <span className="text-slate-400 self-center">s/d</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-2 text-sm border rounded-lg focus:ring-2 focus:ring-slate-300" />
              </div>
          </div>
          <button onClick={() => setPrintData({ type: 'report', data: { rekap, dateFrom, dateTo } })} className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg flex gap-2 text-sm font-medium">
              <Printer size={16} /> Cetak Rekap Pusat
          </button>
      </div>

      <div>
          <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2"><Wallet size={20}/> Status Saldo Berjalan (Akumulasi Aktif)</h2>
          <p className="text-xs text-slate-500 mb-4">*Dihitung otomatis terus-menerus (continue) sampai dengan {formatDate(dateTo)}.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <StatCard title="Total Saldo Keseluruhan" amount={rekap.saldoAkhir} icon={<Wallet />} color="bg-blue-50 text-blue-700 border-blue-200" />
              <StatCard title="Saldo Tunai (CASH)" amount={rekap.saldoCash} icon={<Coins />} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
              <StatCard title="Saldo Rekening (TF)" amount={rekap.saldoTF} icon={<CreditCard />} color="bg-indigo-50 text-indigo-700 border-indigo-200" />
          </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
         <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800"><TrendingUp size={20} className="text-red-500"/> Metrik Pergerakan Omset</h3>
            <div className="flex bg-slate-100 p-1 rounded-lg">
               <button onClick={()=>setChartView('daily')} className={`px-3 py-1 text-xs font-bold rounded ${chartView==='daily'?'bg-white shadow text-red-600':'text-slate-500'}`}>Harian</button>
               <button onClick={()=>setChartView('monthly')} className={`px-3 py-1 text-xs font-bold rounded ${chartView==='monthly'?'bg-white shadow text-red-600':'text-slate-500'}`}>Bulanan</button>
            </div>
         </div>
         <div className="w-full h-56 mt-4 relative min-w-[500px]">
             {rekap.finalChartData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400 border border-dashed rounded-xl">Belum ada data di periode ini.</div>
             ) : (
                <SimpleSVGLineChart data={rekap.finalChartData} />
             )}
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-sm flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
            <h3 className="font-bold text-lg mb-1 flex items-center gap-2 text-emerald-800"><ArrowRightLeft size={20}/> Arus Uang Masuk & Keluar</h3>
            <p className="text-xs text-slate-500 mb-4 border-b pb-2">Khusus periode {formatDate(dateFrom)} - {formatDate(dateTo)}</p>
            
            <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="bg-emerald-50 p-3 rounded border border-emerald-100">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Total Masuk (Cash)</div>
                    <div className="text-lg font-black text-emerald-600">+{formatRp(rekap.inCashPeriode)}</div>
                </div>
                <div className="bg-indigo-50 p-3 rounded border border-indigo-100">
                    <div className="text-[10px] font-bold text-indigo-700 uppercase mb-1">Total Masuk (Transfer)</div>
                    <div className="text-lg font-black text-indigo-600">+{formatRp(rekap.inTfPeriode)}</div>
                    <div className="text-[9px] text-indigo-500 mt-1">Termasuk TF Cabang: {formatRp(rekap.setorPemalangPeriode)}</div>
                </div>
                <div className="bg-red-50 p-3 rounded border border-red-100">
                    <div className="text-[10px] font-bold text-red-700 uppercase mb-1">Total Keluar (Cash)</div>
                    <div className="text-lg font-black text-red-600">-{formatRp(rekap.outCashPeriode)}</div>
                </div>
                <div className="bg-orange-50 p-3 rounded border border-orange-100">
                    <div className="text-[10px] font-bold text-orange-700 uppercase mb-1">Total Keluar (Transfer)</div>
                    <div className="text-lg font-black text-orange-600">-{formatRp(rekap.outTfPeriode)}</div>
                </div>
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col max-h-[340px]">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Users size={20} className="text-slate-500"/> Pelanggan Teratas (Periode Ini)</h3>
            <div className="overflow-y-auto pr-2 flex-1 space-y-3">
               {rekap.topCustomersList.map((cust, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-200 transition">
                     <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-orange-300 text-white' : 'bg-white text-slate-400'}`}>
                           #{i+1}
                        </div>
                        <div>
                           <div className="font-bold text-slate-800">{cust.name}</div>
                           <div className="text-xs text-slate-500">{cust.frequency}x Order • {cust.qty} Pcs ({cust.porsi} Prs)</div>
                        </div>
                     </div>
                     <div className="font-bold text-emerald-600">{formatRp(cust.total)}</div>
                  </div>
               ))}
               {rekap.topCustomersList.length === 0 && <div className="text-center text-slate-400 text-sm mt-8">Tidak ada data penjualan.</div>}
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
                <h3 className="font-bold text-lg mb-4 flex gap-2"><ShoppingCart size={20} className="text-slate-500"/> Penjualan Pusat (Periode Ini)</h3>
                <div className="mb-4">
                    <span className="text-4xl font-bold text-emerald-600">{formatRp(rekap.totalPenjualanKotor)}</span>
                    <div className="text-xs text-slate-400 mt-1">Total Porsi Terjual: {rekap.totalPorsi} Prs ({rekap.totalPcs} Pcs)</div>
                </div>
                <div className="space-y-2 overflow-y-auto pr-2 mb-4">
                    {Object.entries(rekap.breakdownPorsi).sort((a,b) => b[1] - a[1]).map(([kategori, porsi]) => (
                    <div key={kategori} className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 font-medium w-24">{kategori}</span>
                        <div className="flex items-center gap-2 flex-1 ml-2">
                            <div className="h-2 bg-red-100 flex-1 rounded-full overflow-hidden">
                                <div className="h-full bg-red-600 rounded-full" style={{ width: `${rekap.totalPorsi > 0 ? (porsi / rekap.totalPorsi) * 100 : 0}%` }}></div>
                            </div>
                            <span className="font-bold w-8 text-right">{porsi}</span>
                        </div>
                    </div>
                    ))}
                </div>
            </div>
            <div className="border-t pt-4 flex justify-between p-3 bg-red-50 rounded border border-red-100">
                <span className="text-red-700 font-medium text-sm">Piutang Baru (Pusat)</span>
                <span className="font-bold text-red-800">{formatRp(rekap.totalPiutangBaru)}</span>
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
                <h3 className="font-bold text-lg mb-4 flex gap-2"><Truck size={20} className="text-slate-500"/> Pembelian Bahan (Periode Ini)</h3>
                <div className="mb-4">
                    <span className="text-4xl font-bold text-orange-600">{formatRp(rekap.listPembelianDetail.reduce((a,b) => a + Number(b.total), 0))}</span>
                    <div className="text-xs text-slate-400 mt-1">Total Transaksi Pembelian: {[...new Set(rekap.listPembelianDetail.map(x=>x.id))].length} Trx</div>
                </div>
            </div>
            <div className="border-t pt-4 flex justify-between p-3 bg-orange-50 rounded border border-orange-100">
                <span className="text-orange-800 font-medium text-sm">Hutang Baru (Supplier)</span>
                <span className="font-bold text-orange-900">{formatRp(rekap.totalHutangBaru)}</span>
            </div>
        </div>

      </div>
    </div>
  );
}

// --- TAB DASHBOARD CABANG (KHUSUS PEMALANG) ---
function TabDashboardBranch({ orders, pemalangReports, setPrintData, user, stokData }) {
  const todayStr = getTodayStr();
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [chartView, setChartView] = useState('daily'); 

  const stokAktual = useMemo(() => {
    const calc = {};
    stokData.forEach(s => {
      const nama = String(s.itemName||'').toUpperCase();
      if(!calc[nama]) calc[nama] = { masuk: 0, keluar: 0, terpakai: 0, sisa: 0, satuan: s.satuan || 'PCS' };
      if(s.type === 'MASUK') calc[nama].masuk += Number(s.qty) || 0;
      else if(s.type === 'KELUAR') calc[nama].keluar += Number(s.qty) || 0;
      else if(s.type === 'TERPAKAI') calc[nama].terpakai += Number(s.qty) || 0;

      calc[nama].sisa = calc[nama].masuk - calc[nama].keluar - calc[nama].terpakai;
    });
    return calc;
  }, [stokData]);

  const rekap = useMemo(() => {
    const isDateInRange = (dateStr) => {
        const ymd = getLocalYMD(dateStr);
        if(!ymd) return false;
        return ymd >= dateFrom && ymd <= dateTo;
    };

    const filteredOrders = orders.filter(o => isDateInRange(o.date) && o.category === 'Pemalang');
    const filteredReports = pemalangReports.filter(p => isDateInRange(p.date));

    let totalPenjualanKotor = 0;
    let setoranKePusat = 0;
    let totalPorsi = 0;
    let totalPcs = 0;
    let totalPiutangBaru = 0; 
    
    const breakdownPorsi = {}; 
    const customerMap = {}; 
    const chartDataMap = {}; 

    filteredOrders.forEach(order => {
      const qtyNum = Number(order.qty) || 0;
      const totalNum = Number(order.total) || 0;
      const paidNum = Number(order.paidAmount) || 0; 

      totalPcs += qtyNum;
      const porsiOrder = (qtyNum / 4);
      totalPorsi += porsiOrder; 
      totalPenjualanKotor += totalNum;
      
      breakdownPorsi[order.category] = (breakdownPorsi[order.category] || 0) + porsiOrder;

      const custName = String(order.customer || '').toUpperCase();
      if(!customerMap[custName]) customerMap[custName] = { name: custName, qty: 0, porsi: 0, total: 0, frequency: 0 };
      customerMap[custName].qty += qtyNum;
      customerMap[custName].porsi += porsiOrder;
      customerMap[custName].total += totalNum;
      customerMap[custName].frequency += 1;

      let chartKey = '';
      const orderDate = new Date(order.date);
      if(!isNaN(orderDate.getTime())) {
          if(chartView === 'daily') chartKey = orderDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }); 
          else if (chartView === 'monthly') chartKey = orderDate.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }); 
          else chartKey = String(orderDate.getFullYear()); 
      } else {
          chartKey = String(order.date).split('T')[0];
      }

      chartDataMap[chartKey] = (chartDataMap[chartKey] || 0) + totalNum;
    });
    
    // Grouping Piutang Pemalang
    const orderGroups = {};
    filteredOrders.forEach(o => {
        if(!orderGroups[o.id]) orderGroups[o.id] = { total:0, paid: Number(o.paidAmount)||0 };
        orderGroups[o.id].total += Number(o.total)||0;
    });
    Object.values(orderGroups).forEach(g => { if(g.total - g.paid > 0) totalPiutangBaru += (g.total - g.paid); });

    filteredReports.forEach(p => {
        setoranKePusat += (Number(p.nominal) || 0); 
    });

    const finalChartData = Object.keys(chartDataMap).map(key => ({ label: key, value: chartDataMap[key] }));
    const topCustomersList = Object.values(customerMap).sort((a,b) => b.total - a.total);

    // Grouping Orders for PrintReportBranch
    const groupedTransaksiPusat = Object.values(filteredOrders.reduce((acc, o) => {
        if(!acc[o.id]) acc[o.id] = { ...o, items: [], total: 0 };
        acc[o.id].items.push(`${o.qty} Pcs`);
        acc[o.id].total += Number(o.total)||0;
        return acc;
    }, {}));

    return {
      totalPenjualanKotor, setoranKePusat, totalPorsi, totalPcs, totalPiutangBaru, breakdownPorsi,
      topCustomersList, finalChartData, listOrders: groupedTransaksiPusat, listReports: filteredReports
    };
  }, [orders, pemalangReports, dateFrom, dateTo, chartView]);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
              <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Calendar size={16}/> Filter Periode Laporan & Grafik</h3>
              <div className="flex flex-wrap items-center gap-2">
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-2 text-sm border rounded-lg focus:ring-2 focus:ring-slate-300" />
                  <span className="text-slate-400">s/d</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-2 text-sm border rounded-lg focus:ring-2 focus:ring-slate-300" />
              </div>
          </div>
          <button onClick={() => setPrintData({ type: 'reportBranch', data: { rekap, dateFrom, dateTo } })} className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm w-full md:w-auto justify-center">
              <Printer size={16} /> Cetak Laporan Cabang
          </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="Total Omset Cabang" amount={rekap.totalPenjualanKotor} icon={<ShoppingCart />} color="bg-orange-50 text-orange-700 border-orange-200" />
          <div className="p-5 rounded-xl border flex flex-col justify-between bg-white border-slate-200">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-medium text-sm opacity-90 text-slate-600">Total Porsi Terjual</h3>
              <div className="p-2 bg-slate-50 rounded-lg text-slate-400"><Package size={20}/></div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-800">{rekap.totalPorsi} <span className="text-sm font-normal text-slate-500">Porsi ({rekap.totalPcs} Pcs)</span></div>
          </div>
          <StatCard title="Total Setoran Kas ke Pusat" amount={rekap.setoranKePusat} icon={<Wallet />} color="bg-blue-50 text-blue-700 border-blue-200" />
      </div>

      <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-blue-800"><Package size={20} /> Monitoring Sisa Stok Freezer Aktual</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Object.keys(stokAktual).length === 0 && <div className="text-sm text-slate-500 italic col-span-full">Stok kosong atau belum ada pencatatan barang.</div>}
              {Object.entries(stokAktual).map(([nama, data]) => (
                  <div key={nama} className={`p-4 rounded-xl border flex flex-col justify-between ${data.sisa <= 0 ? 'bg-red-50 border-red-200' : 'bg-white border-blue-100 shadow-sm'}`}>
                      <div className="text-sm font-bold text-slate-700 mb-2 truncate" title={nama}>{nama}</div>
                      <div className={`text-2xl font-black ${data.sisa <= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                          {data.sisa} <span className="text-xs font-medium text-slate-500">{data.satuan}</span>
                      </div>
                  </div>
              ))}
          </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
         <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800"><TrendingUp size={20} className="text-red-500"/> Grafik Penjualan Cabang</h3>
            <div className="flex bg-slate-100 p-1 rounded-lg">
               <button onClick={()=>setChartView('daily')} className={`px-3 py-1 text-xs font-bold rounded ${chartView==='daily'?'bg-white shadow text-red-600':'text-slate-500'}`}>Harian</button>
               <button onClick={()=>setChartView('monthly')} className={`px-3 py-1 text-xs font-bold rounded ${chartView==='monthly'?'bg-white shadow text-red-600':'text-slate-500'}`}>Bulanan</button>
            </div>
         </div>
         <div className="w-full h-56 mt-4 relative min-w-[500px]">
             {rekap.finalChartData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400 border border-dashed rounded-xl">Belum ada data di periode ini.</div>
             ) : (
                <SimpleSVGLineChart data={rekap.finalChartData} />
             )}
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col max-h-96">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Users size={20} className="text-slate-500"/> Top Pelanggan (Cabang Pemalang)</h3>
            <div className="overflow-y-auto pr-2 flex-1 space-y-3">
               {rekap.topCustomersList.map((cust, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-amber-200 transition">
                     <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-orange-300 text-white' : 'bg-white text-slate-400'}`}>
                           #{i+1}
                        </div>
                        <div>
                           <div className="font-bold text-slate-800">{cust.name}</div>
                           <div className="text-xs text-slate-500">{cust.frequency}x Order • {cust.qty} Pcs ({cust.porsi} Prs)</div>
                        </div>
                     </div>
                     <div className="font-bold text-amber-600">{formatRp(cust.total)}</div>
                  </div>
               ))}
               {rekap.topCustomersList.length === 0 && <div className="text-center text-slate-400 text-sm mt-8">Tidak ada data penjualan.</div>}
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
                <h3 className="font-bold text-lg mb-4 flex gap-2"><ShoppingCart size={20} className="text-slate-500"/> Penjualan Cabang (Periode Ini)</h3>
                <div className="mb-4">
                    <span className="text-4xl font-bold text-emerald-600">{formatRp(rekap.totalPenjualanKotor)}</span>
                    <div className="text-xs text-slate-400 mt-1">Total Porsi Terjual: {rekap.totalPorsi} Prs ({rekap.totalPcs} Pcs)</div>
                </div>
                <div className="space-y-2 overflow-y-auto pr-2 mb-4">
                    {Object.entries(rekap.breakdownPorsi).sort((a,b) => b[1] - a[1]).map(([kategori, porsi]) => (
                    <div key={kategori} className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 font-medium w-24">{kategori}</span>
                        <div className="flex items-center gap-2 flex-1 ml-2">
                            <div className="h-2 bg-red-100 flex-1 rounded-full overflow-hidden">
                                <div className="h-full bg-red-600 rounded-full" style={{ width: `${rekap.totalPorsi > 0 ? (porsi / rekap.totalPorsi) * 100 : 0}%` }}></div>
                            </div>
                            <span className="font-bold w-8 text-right">{porsi}</span>
                        </div>
                    </div>
                    ))}
                </div>
            </div>
            <div className="border-t pt-4 flex justify-between p-3 bg-red-50 rounded border border-red-100">
                <span className="text-red-700 font-medium text-sm">Piutang Baru (Agen Cabang)</span>
                <span className="font-bold text-red-800">{formatRp(rekap.totalPiutangBaru)}</span>
            </div>
        </div>
      </div>
    </div>
  );
}

function SimpleSVGLineChart({ data }) {
    if(!data || data.length === 0) return null;
    const maxVal = Math.max(...data.map(d => d.value), 100); 
    const width = 800; const height = 200;
    const paddingX = 40; const paddingY = 20;
    const chartW = width - (paddingX * 2);
    const chartH = height - (paddingY * 2);

    const getPoint = (val, i) => {
        const x = paddingX + (i * (chartW / (data.length - 1 || 1)));
        const y = height - paddingY - ((val / maxVal) * chartH);
        return `${x},${y}`;
    };

    const polylinePoints = data.map((d, i) => getPoint(d.value, i)).join(' ');

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full text-xs font-mono" preserveAspectRatio="none">
            {[0, 0.5, 1].map(r => {
                const y = height - paddingY - (r * chartH);
                return <line key={r} x1={paddingX} y1={y} x2={width-paddingX} y2={y} stroke="#e2e8f0" strokeDasharray="4" />
            })}
            <polyline points={polylinePoints} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {data.map((d, i) => {
                const [cx, cy] = getPoint(d.value, i).split(',');
                return (
                    <g key={i}>
                        <circle cx={cx} cy={cy} r="5" fill="#ef4444" className="hover:r-7 transition-all cursor-pointer" />
                        {data.length <= 10 && (
                            <text x={cx} y={Number(cy) - 10} textAnchor="middle" fill="#64748b" className="text-[10px] font-bold">{formatRp(d.value).replace('Rp', '')}</text>
                        )}
                        <text x={cx} y={height} textAnchor="middle" fill="#94a3b8">{d.label}</text>
                    </g>
                );
            })}
        </svg>
    )
}

// --- TAB PEMBELIAN (MULTI-INPUT KERANJANG) ---
function TabPurchases({ purchases, sendToSheet, requestDelete, setPrintData }) {
  const [showForm, setShowForm] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editCount, setEditCount] = useState(0);

  const todayStr = getTodayStr();
  const [date, setDate] = useState(todayStr);
  const [supplier, setSupplier] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState('');

  // SISTEM KERANJANG MULTI-ITEM
  const [cart, setCart] = useState([{ itemName: '', qty: '', satuan: 'Kg', price: 0 }]);

  const [filterFrom, setFilterFrom] = useState(todayStr);
  const [filterTo, setFilterTo] = useState(todayStr);

  const listSupplierUnik = [...new Set(purchases.map(s => String(s.supplier||'').toUpperCase()))];
  const listBarangUnik = [...new Set(purchases.map(s => String(s.itemName||'').toUpperCase()))];

  const cartTotal = cart.reduce((sum, item) => sum + ((Number(item.qty)||0) * (Number(item.price)||0)), 0);

  const updateCartItem = (index, field, value) => {
      const newCart = [...cart];
      newCart[index][field] = value;
      setCart(newCart);
      
      const newTot = newCart.reduce((sum, item) => sum + ((Number(item.qty)||0) * (Number(item.price)||0)), 0);
      if(paymentMethod !== 'Pending / DP') setPaidAmount(newTot);
  };

  const addCartRow = () => setCart([...cart, { itemName: '', qty: '', satuan: 'Kg', price: 0 }]);
  const removeCartRow = (index) => {
      const newCart = cart.filter((_, i) => i !== index);
      setCart(newCart);
      const newTot = newCart.reduce((sum, item) => sum + ((Number(item.qty)||0) * (Number(item.price)||0)), 0);
      if(paymentMethod !== 'Pending / DP') setPaidAmount(newTot);
  };

  const resetForm = () => {
    setShowForm(false); setIsEdit(false); setEditId(null); setEditCount(0);
    setDate(todayStr); setSupplier(''); setPaymentMethod('Cash'); setPaidAmount(0); setNotes('');
    setCart([{ itemName: '', qty: '', satuan: 'Kg', price: 0 }]);
  };

  const handleEdit = (item) => {
    // Ambil semua row yang punya ID invoice yang sama
    const relatedItems = purchases.filter(p => p.id === item.id);
    setDate(String(item.date).split('T')[0]);
    setSupplier(item.supplier); 
    setPaymentMethod(item.paymentMethod); 
    setPaidAmount(item.paidAmount); 
    setNotes(item.notes || '');
    setCart(relatedItems.map(p => ({ itemName: p.itemName, qty: p.qty, satuan: p.satuan || 'Kg', price: p.price })));
    setEditId(item.id); setEditCount(Number(item.editCount) || 0); setIsEdit(true); setShowForm(true);
  };

  const handleSimpan = (e) => {
    e.preventDefault();
    const invoiceId = isEdit ? editId : generateId('BUY', date);
    
    // Hapus data lama jika mode edit (karena kita pakai sistem multi-row per id)
    if(isEdit) sendToSheet('delete', { id: editId }, 'purchases');
    
    // Simpan semua row di cart dengan ID yang sama
    cart.forEach((item, index) => {
        if(item.itemName.trim() !== '') {
            const newPurchase = {
                id: invoiceId, date, supplier: supplier.toUpperCase(), 
                itemName: item.itemName.toUpperCase(), satuan: item.satuan.toUpperCase(), 
                qty: Number(item.qty)||0, price: Number(item.price)||0, 
                total: (Number(item.qty)||0)*(Number(item.price)||0), 
                paymentMethod, 
                paidAmount: index === 0 ? (Number(paidAmount)||0) : 0, // DP hanya dicatat di row pertama agar totalan hutang akurat
                notes, editCount: isEdit ? editCount + 1 : 0
            };
            // Kasih delay dikit agar Google Apps Script tidak kewalahan nerima banyak row
            setTimeout(() => sendToSheet('insert', newPurchase, 'purchases'), index * 300);
        }
    });
    setTimeout(() => resetForm(), cart.length * 300);
  };

  const displayPurchases = useMemo(() => {
    const filtered = purchases.filter(p => {
        const ymd = getLocalYMD(p.date);
        return ymd && ymd >= filterFrom && ymd <= filterTo;
    });

    // Grouping by ID for UI Table
    const groups = {};
    filtered.forEach(p => {
        if(!groups[p.id]) groups[p.id] = { ...p, items: [], totalAll: 0 };
        groups[p.id].items.push(`${p.itemName} (${p.qty} ${p.satuan})`);
        groups[p.id].totalAll += Number(p.total);
    });
    return Object.values(groups);
  }, [purchases, filterFrom, filterTo]);

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
           <h3 className="font-bold text-lg text-slate-800">Pembelian Bahan Baku (Restock)</h3>
           <p className="text-sm text-slate-500">Bisa input banyak barang sekaligus dalam 1 Invoice.</p>
        </div>
        <button onClick={() => { if(showForm) resetForm(); else setShowForm(true); }} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium text-white ${showForm ? 'bg-slate-500' : 'bg-orange-600'}`}>
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Batal' : 'Catat Pembelian Baru'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSimpan} className="bg-white p-6 rounded-xl border border-orange-200 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-3 border-b pb-2"><h4 className="font-bold text-orange-800 text-sm">Header Invoice Pembelian</h4></div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium">Tanggal</label>
            <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-200" />
          </div>
          <div className="space-y-1 lg:col-span-2">
            <label className="text-sm font-medium">Nama Supplier / Toko</label>
            <input type="text" list="supp-list" required value={supplier} onChange={e => setSupplier(e.target.value)} className="w-full p-2 border rounded-lg uppercase" />
            <datalist id="supp-list">{listSupplierUnik.map(b => <option key={b} value={b} />)}</datalist>
          </div>

          <div className="lg:col-span-3 bg-orange-50 p-4 rounded-xl border border-orange-100">
             <div className="flex justify-between items-center mb-3">
                 <h4 className="font-bold text-sm text-orange-900">Daftar Barang (Item)</h4>
                 <button type="button" onClick={addCartRow} className="bg-white px-3 py-1 text-xs font-bold text-orange-600 border border-orange-300 rounded shadow-sm">+ Tambah Barang</button>
             </div>
             <div className="space-y-3">
                 {cart.map((item, index) => {
                     const isAyam = String(item.itemName).toUpperCase().includes('AYAM');
                     const isKg = String(item.satuan).toUpperCase() === 'KG';
                     const infoAyam = (isAyam && isKg && item.qty) ? `(Setara ${Number(item.qty)/10} Kantong)` : '';

                     return (
                     <div key={index} className="flex flex-wrap md:flex-nowrap gap-2 items-start bg-white p-2 rounded-lg border shadow-sm relative pr-8">
                         <div className="w-full md:w-5/12 space-y-1">
                             <input type="text" list="item-list" required placeholder="Nama Barang" value={item.itemName} onChange={e=>updateCartItem(index, 'itemName', e.target.value)} className="w-full p-2 border rounded text-xs uppercase font-bold" />
                             <datalist id="item-list">{listBarangUnik.map(b => <option key={b} value={b} />)}</datalist>
                         </div>
                         <div className="w-1/2 md:w-2/12 space-y-1">
                             <input type="number" min="1" required placeholder="Qty" value={item.qty} onChange={e=>updateCartItem(index, 'qty', e.target.value)} className="w-full p-2 border rounded text-xs font-bold text-center" />
                             {infoAyam && <div className="text-[9px] font-bold text-emerald-600 leading-tight">{infoAyam}</div>}
                         </div>
                         <div className="w-1/2 md:w-2/12 space-y-1">
                             <input type="text" list="satuan-list" required placeholder="Satuan" value={item.satuan} onChange={e=>updateCartItem(index, 'satuan', e.target.value)} className="w-full p-2 border rounded text-xs uppercase" />
                             <datalist id="satuan-list">{SATUAN_BARANG.map(b=><option key={b} value={b}/>)}</datalist>
                         </div>
                         <div className="w-full md:w-3/12 space-y-1">
                             <input type="text" required placeholder="Harga Satuan" value={formatRp(item.price)} onChange={e=>updateCartItem(index, 'price', parseRp(e.target.value))} className="w-full p-2 border rounded text-xs font-bold" />
                         </div>
                         {cart.length > 1 && <button type="button" onClick={()=>removeCartRow(index)} className="absolute right-2 top-3 text-red-400 hover:text-red-600"><Trash2 size={16}/></button>}
                     </div>
                 )})}
             </div>
          </div>

          <div className="space-y-1 bg-orange-100 p-3 rounded-lg border border-orange-200 lg:col-span-3">
            <label className="text-xs font-bold text-orange-900 uppercase">Total Seluruh Belanjaan (Otomatis)</label>
            <input type="text" readOnly value={formatRp(cartTotal)} className="w-full p-3 border border-orange-300 rounded-lg font-bold text-lg bg-white mt-1 text-orange-900" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Metode Pembayaran</label>
            <select value={paymentMethod} onChange={e => {setPaymentMethod(e.target.value); if(e.target.value!=='Pending / DP') setPaidAmount(cartTotal); else setPaidAmount(0);}} className="w-full p-2 border rounded-lg">
              <option value="Cash">Cash / Tunai</option><option value="Transfer">Transfer Bank</option><option value="Pending / DP">Hutang / DP</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Uang Dibayarkan (Rp)</label>
            <input type="text" required value={formatRp(paidAmount)} onChange={e => setPaidAmount(parseRp(e.target.value))} className="w-full p-2 border rounded-lg font-bold" />
          </div>
          <div className="space-y-1 lg:col-span-1">
            <label className="text-sm font-medium">Keterangan Tambahan</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2 border rounded-lg" />
          </div>
          
          <div className="lg:col-span-3 flex justify-end mt-2 pt-4 border-t">
            <button type="submit" className="bg-orange-600 text-white px-6 py-2.5 rounded-lg font-medium">Simpan {isEdit ? 'Perubahan' : 'Data Pembelian'}</button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm mt-4">
         <div className="flex items-center gap-2"><Filter size={16} className="text-slate-400"/><span className="text-sm font-bold text-slate-700">Filter Data:</span></div>
         <input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} className="p-1.5 text-sm border rounded focus:ring-2 focus:ring-orange-200" />
         <span className="text-slate-400">-</span>
         <input type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)} className="p-1.5 text-sm border rounded focus:ring-2 focus:ring-orange-200" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mt-4 overflow-hidden">
        <table className="w-full text-sm text-left block md:table overflow-x-auto">
          <thead className="bg-orange-50 text-orange-800 text-xs uppercase border-b border-orange-100">
            <tr>
              <th className="px-4 py-3 min-w-[120px]">ID & Tanggal</th>
              <th className="px-4 py-3 min-w-[150px]">Supplier & Barang</th>
              <th className="px-4 py-3 text-center">Via</th>
              <th className="px-4 py-3 text-right">Total Belanja</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayPurchases.length === 0 && <tr><td colSpan="6" className="text-center py-8 text-slate-400">Tidak ada pembelian.</td></tr>}
            {displayPurchases.map((pur) => (
              <tr key={pur.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><div className="font-mono text-xs font-bold text-slate-700">{pur.id}</div><div className="text-xs text-slate-500">{formatDate(pur.date)}</div></td>
                <td className="px-4 py-3">
                    <div className="font-bold uppercase text-slate-800">{pur.supplier}</div>
                    <ul className="list-disc pl-3 text-[10px] text-slate-500 mt-1">{pur.items.map((it, idx) => <li key={idx}>{it}</li>)}</ul>
                </td>
                <td className="px-4 py-3 text-center font-medium text-slate-600">{pur.paymentMethod}</td>
                <td className="px-4 py-3 text-right font-bold text-orange-600">{formatRp(pur.totalAll)}</td>
                <td className="px-4 py-3 text-center">
                  {(Number(pur.totalAll)||0) > (Number(pur.paidAmount)||0) ? <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold">HUTANG</span> : <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold">LUNAS</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => setPrintData({ type: 'purchase', data: pur })} className="text-slate-600 bg-slate-100 p-2 rounded-lg transition" title="Cetak Bukti"><Printer size={16} /></button>
                    <button onClick={() => handleEdit(pur)} className="text-blue-500 bg-blue-50 p-2 rounded-lg transition" title="Edit Data"><Edit size={16} /></button>
                    <button onClick={() => requestDelete(pur.id)} className="text-red-500 bg-red-50 p-2 rounded-lg transition" title="Hapus Permanen"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- TAB STOK FREEZER (MULTI-INPUT KERANJANG) ---
function TabStok({ stokData, sendToSheet, requestDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editCount, setEditCount] = useState(0);

  const todayStr = getTodayStr();
  const [date, setDate] = useState(todayStr);
  const [type, setType] = useState('MASUK');
  const [notes, setNotes] = useState('');
  
  const [cart, setCart] = useState([{ itemName: '', satuan: 'Kg', qty: '' }]);

  const listBarangUnik = [...new Set(stokData.map(s => String(s.itemName||'').toUpperCase()))];

  const updateCartItem = (index, field, value) => {
      const newCart = [...cart];
      newCart[index][field] = value;
      setCart(newCart);
  };
  const addCartRow = () => setCart([...cart, { itemName: '', satuan: 'Kg', qty: '' }]);
  const removeCartRow = (index) => setCart(cart.filter((_, i) => i !== index));

  const resetForm = () => {
    setShowForm(false); setIsEdit(false); setEditId(null); setEditCount(0);
    setDate(todayStr); setType('MASUK'); setNotes(''); setCart([{ itemName: '', satuan: 'Kg', qty: '' }]);
  };

  const handleEdit = (item) => {
    const relatedItems = stokData.filter(p => p.id === item.id);
    setDate(String(item.date).split('T')[0]); setType(item.type); setNotes(item.notes || '');
    setCart(relatedItems.map(p => ({ itemName: p.itemName, satuan: p.satuan || 'Kg', qty: p.qty })));
    setEditId(item.id); setEditCount(Number(item.editCount)||0); setIsEdit(true); setShowForm(true);
  };

  const handleSimpan = (e) => {
    e.preventDefault();
    const batchId = isEdit ? editId : generateId('STK', date);
    if(isEdit) sendToSheet('delete', { id: editId }, 'stok');

    cart.forEach((item, index) => {
        if(item.itemName.trim() !== '' && item.satuan.trim() !== '') {
            const newStok = { id: batchId, date, itemName: item.itemName.toUpperCase(), satuan: item.satuan.toUpperCase(), type, qty: Number(item.qty)||0, notes, editCount: isEdit ? editCount + 1 : 0 };
            setTimeout(() => sendToSheet('insert', newStok, 'stok'), index * 300);
        }
    });
    setTimeout(() => resetForm(), cart.length * 300);
  };

  const stokAktual = useMemo(() => {
    const calc = {};
    stokData.forEach(s => {
      const nama = String(s.itemName||'').toUpperCase();
      if(!calc[nama]) calc[nama] = { masuk: 0, keluar: 0, terpakai: 0, sisa: 0, satuan: s.satuan || 'PCS' };
      if(s.type === 'MASUK') calc[nama].masuk += Number(s.qty) || 0;
      else if(s.type === 'KELUAR') calc[nama].keluar += Number(s.qty) || 0;
      else if(s.type === 'TERPAKAI') calc[nama].terpakai += Number(s.qty) || 0;
      calc[nama].sisa = calc[nama].masuk - calc[nama].keluar - calc[nama].terpakai;
    });
    return calc;
  }, [stokData]);

  // Grouping for Table
  const displayStok = useMemo(() => {
    const groups = {};
    stokData.forEach(p => {
        if(!groups[p.id]) groups[p.id] = { ...p, items: [] };
        groups[p.id].items.push(`${p.itemName} (${p.qty} ${p.satuan})`);
    });
    return Object.values(groups).sort(safeSort);
  }, [stokData]);

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center"><h3 className="font-bold text-lg text-slate-800">Manajemen Stok Bahan & Freezer</h3><button onClick={() => { if(showForm) resetForm(); else setShowForm(true); }} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm text-white ${showForm ? 'bg-slate-500' : 'bg-blue-600'}`}>{showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Batal' : 'Catat Stok'}</button></div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
        {Object.keys(stokAktual).length === 0 && <div className="text-sm text-slate-500 italic col-span-full">Belum ada data barang. Silakan catat stok pertama Anda.</div>}
        {Object.entries(stokAktual).map(([nama, data]) => (
            <div key={nama} className={`p-4 rounded-xl border flex flex-col justify-between ${data.sisa <= 0 ? 'bg-red-50' : 'bg-white'}`}>
                <div className="text-sm font-bold mb-2 truncate" title={nama}>{nama}</div>
                <div className={`text-2xl font-black ${data.sisa <= 0 ? 'text-red-600' : 'text-blue-600'}`}>{data.sisa} <span className="text-xs">{data.satuan}</span></div>
            </div>
        ))}
      </div>
      {showForm && (
        <form onSubmit={handleSimpan} className="bg-white p-6 rounded-xl border border-blue-200 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-full mb-2"><div className="flex bg-slate-100 p-1 rounded-lg w-full"><button type="button" onClick={() => setType('MASUK')} className={`flex-1 py-2 text-sm font-bold rounded-md ${type === 'MASUK' ? 'bg-white text-emerald-600' : 'text-slate-500'}`}>Masuk</button><button type="button" onClick={() => setType('TERPAKAI')} className={`flex-1 py-2 text-sm font-bold rounded-md ${type === 'TERPAKAI' ? 'bg-white text-orange-500' : 'text-slate-500'}`}>Dipakai Produksi</button><button type="button" onClick={() => setType('KELUAR')} className={`flex-1 py-2 text-sm font-bold rounded-md ${type === 'KELUAR' ? 'bg-white text-red-600' : 'text-slate-500'}`}>Keluar (Rusak)</button></div></div>
          <div className="space-y-1"><label className="text-sm font-medium">Tanggal</label><input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg" /></div>
          <div className="space-y-1"><label className="text-sm font-medium">Keterangan Batch</label><input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="Cth: Dropping dari Pusat" /></div>

          <div className="col-span-full bg-blue-50 p-4 rounded-xl border border-blue-100">
             <div className="flex justify-between items-center mb-3">
                 <h4 className="font-bold text-sm text-blue-900">Daftar Barang (Item)</h4>
                 <button type="button" onClick={addCartRow} className="bg-white px-3 py-1 text-xs font-bold text-blue-600 border border-blue-300 rounded shadow-sm">+ Tambah</button>
             </div>
             <div className="space-y-2">
                 {cart.map((item, index) => {
                     const isAyam = String(item.itemName).toUpperCase().includes('AYAM');
                     const isKg = String(item.satuan).toUpperCase() === 'KG';
                     const infoAyam = (isAyam && isKg && item.qty) ? `(Setara ${Number(item.qty)/10} Kantong)` : '';
                     return(
                     <div key={index} className="flex flex-wrap md:flex-nowrap gap-2 items-start bg-white p-2 rounded border relative pr-8">
                         <div className="w-full md:w-5/12"><input type="text" list="suggestions-item" required placeholder="Nama Barang" value={item.itemName} onChange={e=>updateCartItem(index,'itemName',e.target.value)} className="w-full p-2 border rounded text-xs uppercase font-bold" /><datalist id="suggestions-item">{listBarangUnik.map(b => <option key={b} value={b} />)}</datalist></div>
                         <div className="w-1/2 md:w-3/12"><input type="number" min="1" required placeholder="Qty" value={item.qty} onChange={e=>updateCartItem(index,'qty',e.target.value)} className="w-full p-2 border rounded text-xs text-center font-bold" />{infoAyam && <div className="text-[9px] font-bold text-emerald-600 mt-1">{infoAyam}</div>}</div>
                         <div className="w-1/2 md:w-4/12"><input type="text" list="satuan-list" required placeholder="Satuan (Kg/Pcs)" value={item.satuan} onChange={e=>updateCartItem(index,'satuan',e.target.value)} className="w-full p-2 border rounded text-xs uppercase" /><datalist id="satuan-list">{SATUAN_BARANG.map(b=><option key={b} value={b}/>)}</datalist></div>
                         {cart.length > 1 && <button type="button" onClick={()=>removeCartRow(index)} className="absolute right-2 top-3 text-red-400 hover:text-red-600"><Trash2 size={16}/></button>}
                     </div>
                 )})}
             </div>
          </div>
          
          <div className="col-span-full flex justify-end"><button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium">Simpan {isEdit ? 'Perubahan' : 'Log Stok'}</button></div>
        </form>
      )}
      <div className="bg-white rounded-xl border mt-4 overflow-hidden"><table className="w-full text-sm text-left block md:table"><thead className="bg-blue-50 text-blue-800 text-xs uppercase border-b"><tr><th className="px-4 py-3">Tanggal & ID</th><th className="px-4 py-3">Daftar Barang (Qty)</th><th className="px-4 py-3 text-center">Jenis</th><th className="px-4 py-3">Keterangan</th><th className="px-4 py-3 text-center">Aksi</th></tr></thead>
      <tbody className="divide-y divide-slate-100">
        {displayStok.length === 0 ? <tr><td colSpan="5" className="text-center py-12 text-slate-400">Belum ada riwayat stok.</td></tr> : displayStok.map((s) => (
          <tr key={s.id} className="hover:bg-slate-50">
            <td className="px-4 py-3"><div className="font-medium">{formatDate(s.date)}</div><div className="text-[10px] text-slate-400 font-mono">{s.id}</div></td>
            <td className="px-4 py-3"><ul className="list-disc pl-3 text-xs font-bold text-slate-800 uppercase">{s.items.map((it,idx)=><li key={idx}>{it}</li>)}</ul></td>
            <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded text-[10px] font-bold ${s.type === 'MASUK' ? 'bg-emerald-100 text-emerald-700' : s.type === 'TERPAKAI' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{s.type}</span></td>
            <td className="px-4 py-3 text-xs">{s.notes || '-'}</td>
            <td className="px-4 py-3 text-center"><div className="flex justify-center gap-2"><button onClick={() => handleEdit(s)} className="text-blue-500 bg-blue-50 p-2 rounded-lg"><Edit size={16}/></button><button onClick={() => requestDelete(s.id)} className="text-red-500 bg-red-50 p-2 rounded-lg"><Trash2 size={16} /></button></div></td>
          </tr>
        ))}
      </tbody></table></div>
    </div>
  );
}

function TabExpenses({ expenses, sendToSheet, setPrintData, requestDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editCount, setEditCount] = useState(0);

  const [type, setType] = useState('IN'); 
  const todayStr = getTodayStr();
  const [date, setDate] = useState(todayStr);
  const [recipient, setRecipient] = useState('');
  const [category, setCategory] = useState(KATEGORI_PENGELUARAN[0]);
  const [description, setDescription] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [filterFrom, setFilterFrom] = useState(todayStr);
  const [filterTo, setFilterTo] = useState(todayStr);

  const total = (Number(qty) || 0) * (Number(price) || 0);

  const resetForm = () => {
    setShowForm(false); setIsEdit(false); setEditId(null); setEditCount(0);
    setDate(todayStr); setRecipient(''); setDescription(''); setPrice(0); setQty(''); setType('IN'); setCategory(KATEGORI_PENGELUARAN[0]); setPaymentMethod('Cash');
  };

  const handleEdit = (item) => {
    setDate(String(item.date).split('T')[0]); setRecipient(item.recipient); setCategory(item.category);
    setDescription(item.description); setType(item.type); setQty(item.qty); setPrice(item.price); setPaymentMethod(item.paymentMethod);
    setEditId(item.id); setEditCount(Number(item.editCount)||0); setIsEdit(true); setShowForm(true);
  };

  const handleSimpan = (e) => {
    e.preventDefault();
    const prefix = type === 'IN' ? 'IN' : 'OUT';
    const newExpense = { id: isEdit ? editId : generateId(prefix, date), date, recipient: recipient.toUpperCase(), category: type === 'IN' ? 'Modal Awal / Tambahan Saldo' : category, description, qty: Number(qty)||0, price: Number(price)||0, total, type, paymentMethod, editCount: isEdit ? editCount + 1 : 0 };
    sendToSheet(isEdit ? 'update' : 'insert', newExpense, 'expenses'); 
    resetForm();
  };

  const displayExpenses = useMemo(() => expenses.filter(e => {
      const y = getLocalYMD(e.date);
      return y && y >= filterFrom && y <= filterTo;
  }), [expenses, filterFrom, filterTo]);

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center"><h3 className="font-bold text-lg">Buku Kas Umum</h3><button onClick={() => { if(showForm) resetForm(); else setShowForm(true); }} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm text-white ${showForm ? 'bg-slate-500' : 'bg-emerald-600'}`}>{showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Batal' : 'Input Transaksi'}</button></div>
      {showForm && (
        <form onSubmit={handleSimpan} className="bg-white p-6 rounded-xl border grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-full"><div className="flex bg-slate-100 p-1 rounded-lg w-full max-w-sm"><button type="button" onClick={() => setType('IN')} className={`flex-1 py-2 text-sm font-bold rounded-md ${type === 'IN' ? 'bg-white text-emerald-600' : 'text-slate-500'}`}>Kas Masuk</button><button type="button" onClick={() => setType('OUT')} className={`flex-1 py-2 text-sm font-bold rounded-md ${type === 'OUT' ? 'bg-white text-red-600' : 'text-slate-500'}`}>Kas Keluar</button></div></div>
          <div className="space-y-1"><label className="text-sm font-medium">Metode</label><select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full p-2 border rounded-lg bg-slate-50"><option value="Cash">Tunai (Cash)</option><option value="Transfer">Bank (Transfer)</option></select></div>
          <div className="space-y-1"><label className="text-sm font-medium">Tanggal</label><input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg" /></div>
          <div className="space-y-1"><label className="text-sm font-medium">Penerima / Dari</label><input type="text" required value={recipient} onChange={e => setRecipient(e.target.value)} className="w-full p-2 border rounded-lg uppercase" /></div>
          {type === 'OUT' ? <div className="space-y-1"><label className="text-sm font-medium">Kategori</label><select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-2 border rounded-lg">{KATEGORI_PENGELUARAN.map(k => <option key={k} value={k}>{k}</option>)}</select></div> : <div className="space-y-1"><label className="text-sm font-medium">Kategori</label><input type="text" disabled value="Modal Awal" className="w-full p-2 border rounded-lg bg-slate-100" /></div>}
          <div className="space-y-1 col-span-full"><label className="text-sm font-medium">Keterangan Lengkap</label><input type="text" required value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 border rounded-lg" /></div>
          <div className="space-y-1 flex gap-2"><div className="w-1/3"><label className="text-sm font-medium">Qty</label><input type="number" min="1" required value={qty} onChange={e => setQty(e.target.value)} className="w-full p-2 border rounded-lg" /></div><div className="w-2/3"><label className="text-sm font-medium">Harga Satuan (Rp)</label><input type="text" required value={formatRp(price)} onChange={e => setPrice(parseRp(e.target.value))} className="w-full p-2 border rounded-lg font-bold" /></div></div>
          <div className="space-y-1"><label className="text-sm font-medium">Total</label><div className="w-full p-2 bg-slate-100 border rounded-lg font-bold">{formatRp(total)}</div></div>
          <div className="col-span-full flex justify-end"><button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium">Simpan {isEdit ? 'Perubahan' : 'Kas'}</button></div>
        </form>
      )}
      <div className="flex gap-3 bg-white p-3 rounded-xl border mt-4"><Filter size={16}/><input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} className="p-1 border rounded" /> - <input type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)} className="p-1 border rounded" /></div>
      <div className="bg-white rounded-xl border mt-4 overflow-hidden"><table className="w-full text-sm text-left block md:table"><thead className="bg-slate-50 border-b"><tr><th className="px-4 py-3">Tgl & ID</th><th className="px-4 py-3">Keterangan</th><th className="px-4 py-3 text-center">Via</th><th className="px-4 py-3 text-right">Nominal</th><th className="px-4 py-3 text-center">Aksi</th></tr></thead><tbody className="divide-y">
          {displayExpenses.length === 0 ? <tr><td colSpan="5" className="text-center py-12 text-slate-400">Tidak ada data.</td></tr> : displayExpenses.map((exp) => (
            <tr key={exp.id} className="hover:bg-slate-50">
              <td className="px-4 py-3"><div className="font-medium">{formatDate(exp.date)}</div><div className="text-[10px] text-slate-400 font-mono">{exp.id}</div></td>
              <td className="px-4 py-3"><div className="font-bold">{exp.category}</div><div className="text-xs text-slate-600">{exp.description} (Kpd: {exp.recipient})</div></td>
              <td className="px-4 py-3 text-center">{exp.paymentMethod}</td>
              <td className={`px-4 py-3 text-right font-bold ${exp.type === 'IN' ? 'text-emerald-600' : 'text-red-600'}`}>{exp.type === 'IN' ? '+' : '-'}{formatRp(exp.total)}</td>
              <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-2">
                      {exp.type === 'OUT' && <button onClick={() => setPrintData({ type: 'voucher', data: exp })} className="text-slate-600 bg-slate-100 p-2 rounded-lg"><Printer size={16} /></button>}
                      <button onClick={() => handleEdit(exp)} className="text-blue-500 bg-blue-50 p-2 rounded-lg"><Edit size={16}/></button>
                      <button onClick={() => requestDelete(exp.id)} className="text-red-500 bg-red-50 p-2 rounded-lg"><Trash2 size={16} /></button>
                  </div>
              </td>
            </tr>
          ))}
      </tbody></table></div>
    </div>
  );
}

function TabPiutang({ orders, purchases, payments, sendToSheet, requestDelete, setPrintData, role }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [bayarAmount, setBayarAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Transfer');
  const [viewTab, setViewTab] = useState('piutang'); 

  const visibleOrders = useMemo(() => role === 'branch' ? orders.filter(o => o.category === 'Pemalang') : orders.filter(o => o.category !== 'Pemalang'), [orders, role]);

  const daftarPiutang = useMemo(() => {
    // Group By ID to combine multi-items properly for Sisa Hutang
    const groups = {};
    visibleOrders.forEach(o => {
        if(!groups[o.id]) groups[o.id] = { ...o, totalAll: 0, paidAll: Number(o.paidAmount)||0 };
        groups[o.id].totalAll += Number(o.total) || 0;
    });

    return Object.values(groups).map(order => {
      const orderPayments = payments.filter(p => p.orderId === order.id);
      const cicilan = orderPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const sisa = order.totalAll - order.paidAll - cicilan;
      return { ...order, tipe: 'PIUTANG', cicilanTerbayar: cicilan, sisaHutang: sisa, orderPayments };
    }).filter(o => o.sisaHutang > 0 || o.orderPayments.length > 0); 
  }, [visibleOrders, payments]);

  const daftarHutang = useMemo(() => {
    const groups = {};
    purchases.forEach(p => {
        if(!groups[p.id]) groups[p.id] = { ...p, totalAll: 0, paidAll: Number(p.paidAmount)||0 };
        groups[p.id].totalAll += Number(p.total) || 0;
    });

    return Object.values(groups).map(pur => {
      const purPayments = payments.filter(p => p.orderId === pur.id);
      const cicilan = purPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const sisa = pur.totalAll - pur.paidAll - cicilan;
      return { ...pur, tipe: 'HUTANG', customer: pur.supplier, cicilanTerbayar: cicilan, sisaHutang: sisa, orderPayments: purPayments };
    }).filter(p => p.sisaHutang > 0 || p.orderPayments.length > 0); 
  }, [purchases, payments]);

  const handleBayar = (e) => {
    e.preventDefault();
    if(bayarAmount <= 0 || bayarAmount > selectedItem?.sisaHutang) return; 
    const tgl = new Date();
    const newPayment = {
        id: generateId('PAY', tgl.toISOString().split('T')[0]),
        orderId: selectedItem.id, date: tgl.toISOString().split('T')[0],
        amount: Number(bayarAmount)||0, paymentMethod 
    };
    sendToSheet('insert', newPayment, 'payments');
    setBayarAmount(0); 
  };

  const listToRender = viewTab === 'piutang' ? (daftarPiutang || []) : (daftarHutang || []);
  const activeItem = selectedItem ? listToRender.find(o=>o.id===selectedItem.id) : null;

  return (
    <div className="space-y-4 animate-in fade-in">
        {activeItem && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-auto">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-lg">Kelola Cicilan {activeItem.tipe === 'HUTANG' ? 'ke Supplier' : 'dari Pelanggan'}</h3>
                        <button onClick={() => setSelectedItem(null)} className="p-1.5 bg-slate-100 rounded-full"><X size={20}/></button>
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-xl mb-6">
                        <div className="flex justify-between mb-2 pb-2 border-b"><span className="text-slate-500 text-sm">Ref ID</span><span className="font-mono text-sm font-bold">{activeItem.id}</span></div>
                        <div className="flex justify-between mb-2 pb-2 border-b"><span className="text-slate-500 text-sm">{activeItem.tipe === 'HUTANG' ? 'Supplier' : 'Pelanggan'}</span><span className="font-bold text-sm uppercase">{activeItem.customer}</span></div>
                        <div className="flex justify-between pt-2"><span className="font-bold text-red-600">SISA HUTANG AKTUAL</span><span className="font-bold text-red-700 text-lg">{formatRp(activeItem?.sisaHutang)}</span></div>
                    </div>

                    {(activeItem?.sisaHutang > 0) && (
                        <form onSubmit={handleBayar} className="space-y-4 mb-8 bg-blue-50 p-4 rounded-xl border border-blue-200">
                            <h4 className="font-bold text-sm text-blue-800">Input Pembayaran Cicilan</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-xs font-bold text-blue-700">Metode</label><select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="w-full p-2 border rounded-lg mt-1 text-sm"><option value="Transfer">Transfer Bank</option><option value="Cash">Tunai (Cash)</option></select></div>
                                <div><label className="text-xs font-bold text-blue-700">Nominal (Maks {formatRp(activeItem.sisaHutang)})</label><input type="text" required value={formatRp(bayarAmount)} onChange={e => {let v=parseRp(e.target.value); if(v>activeItem.sisaHutang) v=activeItem.sisaHutang; setBayarAmount(v);}} className="w-full p-2 border rounded-lg mt-1 text-sm font-bold" /></div>
                            </div>
                            <div className="flex justify-end mt-2"><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm">Simpan Cicilan</button></div>
                        </form>
                    )}

                    <div>
                        <h4 className="font-bold text-sm text-slate-700 mb-3 border-b pb-1">Riwayat Cicilan</h4>
                        {(!activeItem?.orderPayments || activeItem.orderPayments.length === 0) && <p className="text-sm text-slate-400 italic">Belum ada riwayat cicilan.</p>}
                        {(activeItem?.orderPayments || []).map(pay => (
                            <div key={pay.id} className="flex justify-between items-center bg-white border p-3 rounded-lg mb-2">
                                <div><div className="text-[10px] font-mono text-slate-400">{pay.id}</div><div className="text-sm font-medium">{formatDate(pay.date)}</div></div>
                                <div className="text-xs font-bold text-slate-500 px-2 bg-slate-100 rounded py-0.5">{pay.paymentMethod}</div>
                                <div className="font-bold text-emerald-600 flex-1 text-right mr-4">{formatRp(pay.amount)}</div>
                                <div className="flex gap-2">
                                    <button onClick={() => setPrintData({ type: 'receipt', data: { payment: pay, order: activeItem }})} className="p-1.5 bg-slate-100 rounded text-slate-600"><Printer size={16} /></button>
                                    <button onClick={() => requestDelete(pay.id)} className="p-1.5 bg-red-50 text-red-500 rounded"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

      {role === 'admin' && (
      <div className="flex bg-slate-200 p-1 rounded-xl max-w-md">
         <button onClick={()=>setViewTab('piutang')} className={`flex-1 py-2 font-bold rounded-lg text-sm transition ${viewTab==='piutang'?'bg-white shadow text-slate-800':'text-slate-500'}`}>Piutang (Pelanggan Ngutang)</button>
         <button onClick={()=>setViewTab('hutang')} className={`flex-1 py-2 font-bold rounded-lg text-sm transition ${viewTab==='hutang'?'bg-white shadow text-red-600':'text-slate-500'}`}>Hutang (Kita Ngutang Supplier)</button>
      </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {listToRender.filter(o => o.sisaHutang > 0).length === 0 ? (
          <div className="text-center p-12 bg-white rounded-xl border border-dashed text-slate-500 col-span-full">
              <CheckCircle size={48} className="mx-auto text-emerald-400 mb-3" />
              <p>Hore! Semua nota {viewTab} telah lunas.</p>
          </div>
        ) : (
          listToRender.filter(o => o.sisaHutang > 0).map((item) => (
            <div key={item.id} className={`bg-white p-5 rounded-xl border-2 relative ${viewTab==='piutang'?'border-slate-200':'border-orange-200'}`}>
                <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">BELUM LUNAS</div>
                <div className="text-sm text-slate-500 mb-1">{formatDate(item.date)}</div>
                <div className="font-bold text-lg mb-1 uppercase">{item.customer}</div>
                <div className="text-[10px] font-mono text-slate-400 mb-4">{item.id}</div>
                
                <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between border-b pb-1"><span className="text-slate-500">Total Tagihan</span><span className="font-medium">{formatRp(item.totalAll)}</span></div>
                    <div className="flex justify-between border-b pb-1"><span className="text-slate-500">Telah Dicicil</span><span className="font-bold text-emerald-600">{formatRp((Number(item.paidAll)||0)+(Number(item.cicilanTerbayar)||0))}</span></div>
                    <div className="flex justify-between pt-1"><span className="font-bold text-red-600">Sisa Hutang</span><span className="font-bold text-red-700 text-base">{formatRp(item.sisaHutang)}</span></div>
                </div>
                
                <button onClick={() => {setSelectedItem(item); setBayarAmount(item.sisaHutang)}} className={`w-full text-white py-2.5 rounded-lg font-bold text-sm transition ${viewTab==='piutang'?'bg-blue-600 hover:bg-blue-700':'bg-orange-600 hover:bg-orange-700'}`}>
                    Kelola Cicilan
                </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TabPemalang({ reports, sendToSheet, requestDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editCount, setEditCount] = useState(0);

  const todayStr = getTodayStr();
  const [date, setDate] = useState(todayStr);
  const [pesananMika, setPesananMika] = useState(''); const [pesananPorsi, setPesananPorsi] = useState('');
  const [produksiMika, setProduksiMika] = useState(''); const [produksiPorsi, setProduksiPorsi] = useState('');
  const [stokFreezer, setStokFreezer] = useState(''); 
  const [nominal, setNominal] = useState(0); const [transferDestination, setTransferDestination] = useState('BCA (WASTAM)'); 
  const [notes, setNotes] = useState('');
  const [filterFrom, setFilterFrom] = useState(todayStr); const [filterTo, setFilterTo] = useState(todayStr);

  const resetForm = () => {
    setShowForm(false); setIsEdit(false); setEditId(null); setEditCount(0);
    setDate(todayStr); setPesananMika(''); setPesananPorsi(''); setProduksiMika(''); setProduksiPorsi(''); setStokFreezer(''); setNominal(0); setNotes('');
  };

  const handleEdit = (item) => {
    setDate(String(item.date).split('T')[0]); setPesananMika(item.pesananMika); setPesananPorsi(item.pesananPorsi); setProduksiMika(item.produksiMika); setProduksiPorsi(item.produksiPorsi);
    setStokFreezer(item.stokFreezer); setTransferDestination(item.transferDestination); setNominal(item.nominal); setNotes(item.notes || '');
    setEditId(item.id); setEditCount(Number(item.editCount)||0); setIsEdit(true); setShowForm(true);
  };

  const handleSimpan = (e) => {
    e.preventDefault();
    const newReport = { id: isEdit ? editId : generateId('PML', date), date, pesananMika: Number(pesananMika)||0, pesananPorsi: Number(pesananPorsi)||0, produksiMika: Number(produksiMika)||0, produksiPorsi: Number(produksiPorsi)||0, stokFreezer, transferDestination, nominal: Number(nominal)||0, notes, editCount: isEdit ? editCount + 1 : 0 };
    sendToSheet(isEdit ? 'update' : 'insert', newReport, 'pemalang'); 
    resetForm();
  };

  const displayReports = useMemo(() => reports.filter(p => {
      const y = getLocalYMD(p.date);
      return y && y >= filterFrom && y <= filterTo;
  }), [reports, filterFrom, filterTo]);

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center"><h3 className="font-bold text-lg text-slate-800">Laporan Operasional Harian</h3><button onClick={() => { if(showForm) resetForm(); else setShowForm(true); }} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm text-white ${showForm ? 'bg-slate-500' : 'bg-amber-600'}`}>{showForm ? <X size={16} /> : <Plus size={16} />} Batal / Baru</button></div>
      {showForm && (
        <form onSubmit={handleSimpan} className="bg-white p-6 rounded-xl border border-amber-200 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1 lg:col-span-4"><label className="text-sm font-medium">Tanggal</label><input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full lg:w-1/4 p-2 border rounded-lg" /></div>
          <div className="space-y-1 bg-slate-50 p-3 rounded-lg"><label className="text-xs font-bold">Pesanan (Mika)</label><input type="number" required value={pesananMika} onChange={e=>setPesananMika(e.target.value)} className="w-full p-2 border rounded" /></div>
          <div className="space-y-1 bg-slate-50 p-3 rounded-lg"><label className="text-xs font-bold">Pesanan (Porsi)</label><input type="number" required value={pesananPorsi} onChange={e=>setPesananPorsi(e.target.value)} className="w-full p-2 border rounded" /></div>
          <div className="space-y-1 bg-amber-50 p-3 rounded-lg"><label className="text-xs font-bold">Produksi (Mika)</label><input type="number" required value={produksiMika} onChange={e=>setProduksiMika(e.target.value)} className="w-full p-2 border rounded" /></div>
          <div className="space-y-1 bg-amber-50 p-3 rounded-lg"><label className="text-xs font-bold">Produksi (Porsi)</label><input type="number" required value={produksiPorsi} onChange={e=>setProduksiPorsi(e.target.value)} className="w-full p-2 border rounded" /></div>
          <div className="space-y-1 lg:col-span-4 bg-blue-50 p-4 rounded-lg border-blue-200 mt-2"><label className="text-sm font-bold text-blue-800">Sisa Stok Freezer Aktual Saat Tutup</label><input type="text" required value={stokFreezer} onChange={e => setStokFreezer(e.target.value)} className="w-full p-3 border rounded-lg uppercase" /></div>
          <div className="space-y-1 lg:col-span-2"><label className="text-sm font-medium">Nominal Disetor (Rp)</label><input type="text" required value={formatRp(nominal)} onChange={e => setNominal(parseRp(e.target.value))} className="w-full p-3 border-2 border-amber-200 rounded-lg font-bold text-lg text-amber-700" /></div>
          <div className="space-y-1 lg:col-span-1"><label className="text-sm font-medium">Tujuan TF</label><input type="text" list="bank-list" required value={transferDestination} onChange={e=>setTransferDestination(e.target.value)} className="w-full p-3 border rounded-lg font-bold" /><datalist id="bank-list"><option value="BCA (WASTAM)" /><option value="BRI (WASTAM)" /></datalist></div>
          <div className="space-y-1 lg:col-span-1"><label className="text-sm font-medium">Ket</label><input type="text" value={notes} onChange={e=>setNotes(e.target.value)} className="w-full p-3 border rounded-lg" /></div>
          <div className="lg:col-span-4 flex justify-end mt-2"><button type="submit" className="bg-amber-600 text-white px-6 py-2.5 rounded-lg font-medium">Simpan {isEdit ? 'Perubahan' : 'Laporan'}</button></div>
        </form>
      )}
      <div className="flex gap-3 bg-white p-3 rounded-xl border mt-4"><Filter size={16}/><input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} className="p-1 border rounded" /> - <input type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)} className="p-1 border rounded" /></div>
      <div className="bg-white rounded-xl border mt-4 overflow-hidden"><table className="w-full text-sm text-left block md:table"><thead className="bg-amber-50 text-amber-800 border-b"><tr><th className="px-4 py-3">Tanggal Laporan</th><th className="px-4 py-3 text-center">Pesanan (M/P)</th><th className="px-4 py-3 text-center">Produksi (M/P)</th><th className="px-4 py-3">STOK FREEZER</th><th className="px-4 py-3 text-center">Disetor Ke</th><th className="px-4 py-3 text-right">Uang Disetor</th><th className="px-4 py-3 text-center">Aksi</th></tr></thead><tbody className="divide-y">
          {displayReports.length === 0 ? <tr><td colSpan="7" className="text-center py-12 text-slate-400">Tidak ada laporan ditemukan pada tanggal filter tersebut.</td></tr> : displayReports.map((rep) => (
            <tr key={rep.id} className="hover:bg-slate-50">
              <td className="px-4 py-3"><div className="font-medium">{formatDate(rep.date)}</div><div className="text-[10px] text-slate-400 font-mono">{rep.id}</div></td>
              <td className="px-4 py-3 text-center bg-slate-50/50"><div className="font-bold">{rep.pesananMika} M</div><div className="text-xs text-slate-500">{rep.pesananPorsi} Prs</div></td>
              <td className="px-4 py-3 text-center bg-amber-50/30"><div className="font-bold text-amber-700">{rep.produksiMika} M</div><div className="text-xs text-amber-600">{rep.produksiPorsi} Prs</div></td>
              <td className="px-4 py-3 bg-blue-50/30 font-bold text-blue-700 uppercase">{rep.stokFreezer || '-'}</td>
              <td className="px-4 py-3 text-center"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold">{rep.transferDestination || 'Pusat'}</span></td>
              <td className="px-4 py-3 text-right font-bold text-emerald-600">+{formatRp(rep.nominal)}</td>
              <td className="px-4 py-3 text-center"><div className="flex justify-center gap-2"><button onClick={() => handleEdit(rep)} className="text-blue-500 bg-blue-50 p-2 rounded-lg"><Edit size={16}/></button><button onClick={() => requestDelete(rep.id)} className="text-red-500 bg-red-50 p-2 rounded-lg"><Trash2 size={16} /></button></div></td>
            </tr>
          ))}
      </tbody></table></div>
    </div>
  );
}

// ==========================================================
// --- LAYOUT CETAK (DIPERCEPAT & DITAMBAHKAN LOGO & SATUAN) ---
// ==========================================================
function PrintReport({ data, onBack }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { rekap, dateFrom, dateTo } = data;
  return (
    <>
    <style dangerouslySetInnerHTML={{__html: `@media print { @page { size: A4 portrait; margin: 10mm; } body { margin: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-size: 11px; color: black; background: white; zoom: 0.75; } .hide-on-print { display: none !important; } table { width: 100%; border-collapse: collapse; } th, td { padding: 4px 6px !important; font-size: 10px !important; border: 1px solid black !important; } h1 { font-size: 16px !important; margin-bottom: 4px !important; } h3 { font-size: 12px !important; margin-top: 12px !important; margin-bottom: 4px !important; } .p-8 { padding: 0 !important; } .mb-8 { margin-bottom: 12px !important; } .mb-6 { margin-bottom: 8px !important; } .mt-8 { margin-top: 12px !important; } .mt-12 { margin-top: 16px !important; } .gap-4 { gap: 12px !important; } .grid-cols-2 { display: flex !important; justify-content: space-between !important; } .grid-cols-2 > div { width: 48% !important; margin-bottom: 8px !important; border: 1px solid black; padding: 6px !important; } * { box-shadow: none !important; border-radius: 0 !important; } }`}} />
    <div className="bg-white min-h-screen text-black print:bg-white print:p-0 p-8 w-full max-w-[800px] mx-auto">
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded flex items-center gap-2">Kembali ke Aplikasi</button>
      <div className="print:p-0 text-sm font-sans" style={{ fontFamily: 'Arial, sans-serif' }}>
        
        {/* LOGO ADDED */}
        <div className="flex justify-center mb-2">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{height: '60px'}} />
        </div>

        <div className="text-center mb-6 border-b-2 border-black pb-4"><h1 className="font-bold text-xl uppercase mt-2">Laporan Keuangan & Penjualan</h1><p className="text-slate-600">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p></div>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="border border-black p-3"><h3 className="font-bold text-sm border-b border-black pb-1 mb-2">RINGKASAN SALDO AKTUAL (TERAKUMULASI)</h3><div className="flex justify-between mb-1"><span>Saldo Tunai Bersih (CASH):</span> <span className="font-medium text-emerald-700">{formatRp(rekap.saldoCash)}</span></div><div className="flex justify-between mb-1"><span>Saldo Rekening Bersih (TF):</span> <span className="font-medium text-indigo-700">{formatRp(rekap.saldoTF)}</span></div><div className="flex justify-between pt-1 border-t border-dotted border-black mt-1"><span className="font-bold">TOTAL SALDO AKTUAL:</span> <span className="font-bold text-blue-700">{formatRp(rekap.saldoAkhir)}</span></div></div>
            <div className="border border-black p-3"><h3 className="font-bold text-sm border-b border-black pb-1 mb-2">RINGKASAN OMSET PUSAT (PERIODE FILTER)</h3><div className="flex justify-between mb-1"><span>Total Penjualan Kotor:</span> <span className="font-medium">{formatRp(rekap.totalPenjualanKotor)}</span></div><div className="flex justify-between mb-1"><span>Total Porsi Terjual:</span> <span className="font-medium">{rekap.totalPorsi} Porsi</span></div><div className="flex justify-between mb-1"><span>Total Piutang Berjalan:</span> <span className="font-medium text-red-600">{formatRp(rekap.totalPiutangBaru)}</span></div></div>
        </div>

        <h3 className="font-bold text-md mb-2 mt-8">A. RINCIAN TRANSAKSI & OMSET PENJUALAN (PUSAT)</h3>
        <table className="w-full border-collapse border border-black text-sm text-left mb-8">
          <thead className="bg-gray-100"><tr><th className="border border-black p-2 text-center w-8">NO</th><th className="border border-black p-2">NO. INVOICE</th><th className="border border-black p-2">PELANGGAN</th><th className="border border-black p-2">KATEGORI</th><th className="border border-black p-2">VIA</th><th className="border border-black p-2 text-center">QTY (PORSI)</th><th className="border border-black p-2 text-right">TOTAL OMSET</th></tr></thead>
          <tbody>
              {rekap.listTransaksiDetail.map((c, i) => (<tr key={i}><td className="border border-black p-2 text-center">{i + 1}</td><td className="border border-black p-2 font-mono text-xs">{c.id}</td><td className="border border-black p-2 font-bold uppercase">{c.customer}</td><td className="border border-black p-2">{c.category}</td><td className="border border-black p-2">{c.paymentMethod}</td><td className="border border-black p-2 text-center"><ul className="list-disc pl-3 text-left">{c.items.map((it,idx)=><li key={idx}>{it}</li>)}</ul></td><td className="border border-black p-2 text-right font-medium">{formatRp(c.total)}</td></tr>))}
              {rekap.listTransaksiDetail.length === 0 && <tr><td colSpan="7" className="border border-black p-4 text-center italic">Tidak ada transaksi.</td></tr>}
          </tbody>
        </table>

        {rekap.listExpenses.length > 0 && (
            <>
                <h3 className="font-bold text-md mb-2 mt-4">B. RINCIAN BUKU KAS (PENGELUARAN & CLOSING)</h3>
                <table className="w-full border-collapse border border-black text-sm text-left mb-8">
                    <thead className="bg-gray-100"><tr><th className="border border-black p-2 text-center w-8">NO</th><th className="border border-black p-2">TANGGAL</th><th className="border border-black p-2">KATEGORI</th><th className="border border-black p-2">KETERANGAN</th><th className="border border-black p-2 text-center">VIA</th><th className="border border-black p-2 text-right">NOMINAL KELUAR/MASUK</th></tr></thead>
                    <tbody>
                        {rekap.listExpenses.map((o, i) => (
                            <tr key={i}><td className="border border-black p-2 text-center">{i + 1}</td><td className="border border-black p-2">{formatDate(o.date)}</td><td className="border border-black p-2 font-bold uppercase">{o.category}</td><td className="border border-black p-2">{o.description}</td><td className="border border-black p-2 text-center">{o.paymentMethod}</td><td className={`border border-black p-2 text-right font-bold ${o.type==='IN'?'text-emerald-600':'text-red-600'}`}>{o.type==='IN'?'+':'-'}{formatRp(o.total)}</td></tr>
                        ))}
                    </tbody>
                </table>
            </>
        )}

        {rekap.listHutangBerjalan.length > 0 && (
            <>
                <h3 className="font-bold text-md mb-2 mt-4">C. DAFTAR HUTANG BAHAN BAKU (BELUM LUNAS KE SUPPLIER)</h3>
                <table className="w-full border-collapse border border-black text-sm text-left mb-8">
                    <thead className="bg-gray-100"><tr><th className="border border-black p-2 text-center w-8">NO</th><th className="border border-black p-2">TANGGAL & INVOICE</th><th className="border border-black p-2">SUPPLIER</th><th className="border border-black p-2">BARANG (SATUAN)</th><th className="border border-black p-2 text-right">TOTAL TAGIHAN</th><th className="border border-black p-2 text-right">TELAH DIBAYAR</th><th className="border border-black p-2 text-right text-red-600">SISA HUTANG</th></tr></thead>
                    <tbody>
                        {rekap.listHutangBerjalan.map((o, i) => (
                            <tr key={i}>
                                <td className="border border-black p-2 text-center">{i + 1}</td>
                                <td className="border border-black p-2"><div className="font-bold">{formatDate(o.date)}</div><div className="font-mono text-[9px]">{o.id}</div></td>
                                <td className="border border-black p-2 font-bold uppercase">{o.supplier}</td>
                                <td className="border border-black p-2 uppercase"><ul className="list-disc pl-3 text-xs">{o.items.map((it,idx)=><li key={idx}>{it}</li>)}</ul></td>
                                <td className="border border-black p-2 text-right font-medium">{formatRp(o.totalTagihan)}</td>
                                <td className="border border-black p-2 text-right text-emerald-600">{formatRp((Number(o.totalDibayar)||0) + (Number(o.cicilanTerbayar)||0))}</td>
                                <td className="border border-black p-2 text-right font-bold text-red-600">{formatRp(o.sisaHutang)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </>
        )}

        {rekap.listPiutangBerjalan.length > 0 && (
            <>
                <h3 className="font-bold text-md mb-2 mt-4">D. DAFTAR PIUTANG BERJALAN SAAT INI (BELUM LUNAS)</h3>
                <table className="w-full border-collapse border border-black text-sm text-left mb-8">
                    <thead className="bg-gray-100"><tr><th className="border border-black p-2 text-center w-8">NO</th><th className="border border-black p-2">NO. INVOICE / TGL</th><th className="border border-black p-2">PELANGGAN</th><th className="border border-black p-2 text-center">PESANAN</th><th className="border border-black p-2 text-right">TOTAL TAGIHAN</th><th className="border border-black p-2 text-right">TELAH DIBAYAR</th><th className="border border-black p-2 text-right text-red-600">SISA HUTANG</th></tr></thead>
                    <tbody>
                        {rekap.listPiutangBerjalan.map((o, i) => (
                            <tr key={i}><td className="border border-black p-2 text-center">{i + 1}</td><td className="border border-black p-2"><div className="font-mono text-xs font-bold">{o.id}</div><div className="text-xs text-gray-600">{formatDate(o.date)}</div></td><td className="border border-black p-2 font-bold uppercase">{o.customer}</td><td className="border border-black p-2 text-center"><ul className="list-disc pl-3 text-left">{o.items.map((it,idx)=><li key={idx}>{it}</li>)}</ul></td><td className="border border-black p-2 text-right font-medium">{formatRp(o.totalTagihan)}</td><td className="border border-black p-2 text-right text-emerald-600">{formatRp((Number(o.totalDibayar)||0) + (Number(o.cicilanTerbayar)||0))}</td><td className="border border-black p-2 text-right font-bold text-red-600">{formatRp(o.sisaHutang)}</td></tr>
                        ))}
                    </tbody>
                </table>
            </>
        )}

        {rekap.listPembayaranSemua.length > 0 && (
            <>
                <h3 className="font-bold text-md mb-2 mt-4">E. RINCIAN UANG MASUK & KELUAR DARI CICILAN</h3>
                <table className="w-full border-collapse border border-black text-sm text-left mb-8">
                    <thead className="bg-gray-100"><tr><th className="border border-black p-2 text-center w-8">NO</th><th className="border border-black p-2">TANGGAL</th><th className="border border-black p-2">ID PEMBAYARAN</th><th className="border border-black p-2">REF. INVOICE</th><th className="border border-black p-2">PELANGGAN / SUPPLIER</th><th className="border border-black p-2">VIA</th><th className="border border-black p-2 text-right">NOMINAL CICILAN</th><th className="border border-black p-2 text-center">STATUS NOTA</th></tr></thead>
                    <tbody>
                        {rekap.listPembayaranSemua.map((p, i) => (
                            <tr key={i}>
                              <td className="border border-black p-2 text-center">{i + 1}</td>
                              <td className="border border-black p-2">{formatDate(p.date)}</td>
                              <td className="border border-black p-2 font-mono text-[9px]">{p.id}</td>
                              <td className="border border-black p-2 font-mono text-[9px] font-bold">{p.orderId}</td>
                              <td className="border border-black p-2 font-bold uppercase">{p.customer}</td>
                              <td className="border border-black p-2">{p.paymentMethod}</td>
                              <td className={`border border-black p-2 text-right font-bold ${p.tipe === 'HUTANG'?'text-red-600':'text-emerald-600'}`}>{p.tipe === 'HUTANG'?'-':'+'}{formatRp(p.amount)}</td>
                              <td className="border border-black p-2 text-center text-[10px] font-bold">{p.statusNota === 'LUNAS' ? <span className="text-emerald-600">LUNAS</span> : <span className="text-red-600">BELUM LUNAS</span>}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </>
        )}

        {rekap.listPemalang.length > 0 && (
            <>
                <h3 className="font-bold text-md mb-2 mt-4">F. RINCIAN LAPORAN & SETORAN CABANG PEMALANG</h3>
                <table className="w-full border-collapse border border-black text-sm text-left mb-8">
                    <thead className="bg-gray-100"><tr><th className="border border-black p-2 text-center w-8">NO</th><th className="border border-black p-2">TANGGAL</th><th className="border border-black p-2 text-center">PRODUKSI / PESANAN</th><th className="border border-black p-2">STOK FREEZER</th><th className="border border-black p-2 text-center">TUJUAN TF</th><th className="border border-black p-2 text-right">UANG DISETOR</th></tr></thead>
                    <tbody>
                        {rekap.listPemalang.map((p, i) => (
                            <tr key={i}><td className="border border-black p-2 text-center">{i + 1}</td><td className="border border-black p-2">{formatDate(p.date)}</td><td className="border border-black p-2 text-center">{p.produksiMika} M / {p.pesananMika} M</td><td className="border border-black p-2 font-bold uppercase">{p.stokFreezer}</td><td className="border border-black p-2 text-center font-bold text-indigo-700">{p.transferDestination || 'BCA (WASTAM)'}</td><td className="border border-black p-2 text-right font-bold text-emerald-700">{formatRp(p.nominal)}</td></tr>
                        ))}
                    </tbody>
                </table>
            </>
        )}

        <div className="flex justify-end mt-12">
            <div className="text-center w-48">
                <div className="text-sm mb-12 text-center">Dicetak oleh,</div><div className="border-b border-dotted border-black h-4 mb-1"></div><div className="text-xs uppercase">Admin Pusat</div><div className="text-xs italic text-gray-500 mt-1">{formatDate(new Date())}</div>
            </div>
        </div>
      </div>
    </div>
    </>
  );
}

function PrintReportBranch({ data, onBack, user }) {
  useEffect(() => { const timer = setTimeout(() => { window.print(); }, 500); return () => clearTimeout(timer); }, []);
  const { rekap, dateFrom, dateTo } = data;
  return (
    <>
    <style dangerouslySetInnerHTML={{__html: `@media print { @page { size: A4 portrait; margin: 10mm; } body { margin: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-size: 11px; color: black; background: white; zoom: 0.8; } .hide-on-print { display: none !important; } table { width: 100%; border-collapse: collapse; } th, td { padding: 4px 6px !important; font-size: 10px !important; border: 1px solid black !important; } h1 { font-size: 16px !important; margin-bottom: 4px !important; } h3 { font-size: 12px !important; margin-top: 12px !important; margin-bottom: 4px !important; } .p-8 { padding: 0 !important; } .mb-8 { margin-bottom: 12px !important; } .mb-6 { margin-bottom: 8px !important; } .mt-8 { margin-top: 12px !important; } .mt-12 { margin-top: 16px !important; } .gap-4 { gap: 12px !important; } .grid-cols-2 { display: flex !important; justify-content: space-between !important; } .grid-cols-2 > div { width: 48% !important; margin-bottom: 8px !important; border: 1px solid black; padding: 6px !important; } * { box-shadow: none !important; border-radius: 0 !important; } }`}} />
    <div className="bg-white min-h-screen text-black print:bg-white print:p-0 p-8 w-full max-w-[800px] mx-auto">
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded flex items-center gap-2">Kembali ke Aplikasi</button>
      <div className="print:p-0 text-sm font-sans" style={{ fontFamily: 'Arial, sans-serif' }}>
        
        {/* LOGO ADDED */}
        <div className="flex justify-center mb-2">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Logo" style={{height: '60px'}} />
        </div>

        <div className="text-center mb-6 border-b-2 border-black pb-4"><h1 className="font-bold text-xl uppercase mt-2">Laporan Operasional {user.name}</h1><p className="text-slate-600">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p></div>
        <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="border border-black p-3"><h3 className="font-bold text-sm border-b border-black pb-1 mb-2">RINGKASAN PENJUALAN CABANG</h3><div className="flex justify-between mb-1"><span>Total Omset Kotor:</span> <span className="font-medium text-emerald-700">{formatRp(rekap.totalPenjualanKotor)}</span></div><div className="flex justify-between mb-1"><span>Total Porsi Terjual:</span> <span className="font-medium text-indigo-700">{rekap.totalPorsi} Prs ({rekap.totalPcs} Pcs)</span></div></div>
            <div className="border border-black p-3"><h3 className="font-bold text-sm border-b border-black pb-1 mb-2">RINGKASAN KAS / SETORAN</h3><div className="flex justify-between mb-1"><span>Total Setoran Kas ke Pusat:</span> <span className="font-medium text-blue-700">{formatRp(rekap.setoranKePusat)}</span></div><div className="flex justify-between mb-1"><span>Status Uang Disetor:</span> <span className="font-medium text-slate-500">Full Transfer Bank</span></div></div>
        </div>
        <h3 className="font-bold text-md mb-2 mt-8">A. RINCIAN TRANSAKSI INVOICE CABANG</h3>
        <table className="w-full border-collapse border border-black text-sm text-left mb-8">
          <thead className="bg-gray-100"><tr><th className="border border-black p-2 text-center w-8">NO</th><th className="border border-black p-2">NO. INVOICE</th><th className="border border-black p-2">PELANGGAN</th><th className="border border-black p-2 text-center">METODE BAYAR</th><th className="border border-black p-2 text-center">QTY (PORSI)</th><th className="border border-black p-2 text-right">TOTAL OMSET</th></tr></thead>
          <tbody>
              {rekap.listOrders.map((c, i) => (<tr key={i}><td className="border border-black p-2 text-center">{i + 1}</td><td className="border border-black p-2 font-mono text-xs">{c.id}</td><td className="border border-black p-2 font-bold uppercase">{c.customer}</td><td className="border border-black p-2 text-center">{c.paymentMethod}</td><td className="border border-black p-2 text-center"><ul className="list-disc pl-3 text-left">{c.items.map((it,idx)=><li key={idx}>{it}</li>)}</ul></td><td className="border border-black p-2 text-right font-medium">{formatRp(c.total)}</td></tr>))}
              {rekap.listOrders.length === 0 && <tr><td colSpan="6" className="border border-black p-4 text-center italic">Tidak ada transaksi.</td></tr>}
          </tbody>
        </table>
        <h3 className="font-bold text-md mb-2 mt-4">B. RINCIAN LAPORAN HARIAN & STOK FREEZER</h3>
        <table className="w-full border-collapse border border-black text-sm text-left mb-8">
            <thead className="bg-gray-100"><tr><th className="border border-black p-2 text-center w-8">NO</th><th className="border border-black p-2">TANGGAL</th><th className="border border-black p-2 text-center">PRODUKSI / PESANAN</th><th className="border border-black p-2">STOK FREEZER AKHIR</th><th className="border border-black p-2 text-center">TUJUAN TF</th><th className="border border-black p-2 text-right">UANG DISETOR</th></tr></thead>
            <tbody>
                {rekap.listReports.map((p, i) => (<tr key={i}><td className="border border-black p-2 text-center">{i + 1}</td><td className="border border-black p-2">{formatDate(p.date)}</td><td className="border border-black p-2 text-center">{p.produksiMika} M / {p.pesananMika} M</td><td className="border border-black p-2 font-bold uppercase">{p.stokFreezer}</td><td className="border border-black p-2 text-center font-bold">{p.transferDestination || 'BCA (WASTAM)'}</td><td className="border border-black p-2 text-right font-bold text-emerald-700">{formatRp(p.nominal)}</td></tr>))}
                {rekap.listReports.length === 0 && <tr><td colSpan="6" className="border border-black p-4 text-center italic">Tidak ada laporan harian.</td></tr>}
            </tbody>
        </table>
        <div className="flex justify-end mt-12"><div className="text-center w-48"><div className="text-sm mb-12 text-center">Dicetak oleh,</div><div className="border-b border-dotted border-black h-4 mb-1"></div><div className="text-xs uppercase">Admin {user.name}</div><div className="text-xs italic text-gray-500 mt-1">{formatDate(new Date())}</div></div></div>
      </div>
    </div>
    </>
  );
}
