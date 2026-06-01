import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Wallet, CreditCard, 
  Plus, Printer, Search, ChevronDown, CheckCircle, 
  Clock, X, FileText, ArrowRightLeft, Trash2, Calendar,
  Store, Coins, Loader2, LogOut, TrendingUp, Users, Package,
  ArrowDownToLine, ArrowUpFromLine, UtilityPole, Utensils, Filter
} from 'lucide-react';

// =====================================================================
// === GANTI URL DI BAWAH INI DENGAN URL WEB APP GOOGLE SCRIPT ANDA ===
// =====================================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyqCaTepk_duXguiOqSM572mbUIGozcghhh8LHNMNw2e83O7Wkyu-SkjdVTO3zpTb64PA/exec'; 
// =====================================================================

// --- UTILITIES (ANTI-CRASH, FORMAT RUPIAH & TERBILANG) ---
const formatRp = (angka) => {
  const num = Number(angka);
  if (isNaN(num) || num === 0) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
};

// Fungsi untuk membaca ketikan angka & titik dari inputan
const parseRp = (str) => {
  const num = Number(String(str).replace(/[^0-9]/g, ''));
  return isNaN(num) ? 0 : num;
};

const getLocalYMD = (dateVal) => {
    if(!dateVal) return '';
    const d = new Date(dateVal);
    if(isNaN(d.getTime())) return String(dateVal).split('T')[0];
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const formatDate = (date) => {
  if(!date) return '-';
  const d = new Date(date);
  if(isNaN(d.getTime())) return String(date).split('T')[0]; 
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
};

const generateId = (prefix, date) => {
  const d = new Date(date || Date.now());
  if(isNaN(d.getTime())) return `${prefix}-DMA-ERR-${Math.floor(Math.random()*9000)+1000}`;
  const mmyy = `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getFullYear()).slice(-2)}`;
  const seq = String(Math.floor(Math.random() * 9000) + 1000); 
  return `${prefix}-DMA-${mmyy}-${seq}`;
};

const safeSort = (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();

// Mesin Terbilang Baru (Anti-Nol)
const terbilang = (angka) => {
  const num = Math.floor(Number(angka));
  if (isNaN(num) || num < 0) return 'Nol';
  if (num === 0) return 'Nol';
  
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

// --- DATA REFERENSI ---
const KATEGORI_HARGA = {
  'Reseller': 2125,
  'Pemalang': 2250, 
  'Mitra': 2000,
  'Eceran': 3000,
  'Shopee': 0, 'Tokopedia': 0, 'TikTok': 0, 'ShopeeFood': 0, 'GoFood': 0
};

const KATEGORI_PENGELUARAN = [
  'Bahan Baku', 'Packaging', 'Operasional & Transport', 
  'Konsumsi Karyawan', 'Kasbon', 'Jamuan', 'Lainnya'
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

  // --- FUNGSI LOGIN ---
  const handleLogin = (e) => {
    e.preventDefault();
    const { username, password } = loginForm;
    if (username === 'dnamic' && password === 'Dnamic2026!!') {
      setUser({ role: 'admin', name: 'Administrator Pusat' });
      setActiveTab('dashboard');
      setLoginError('');
      fetchData(); 
    } 
    else if (username === 'pemalang' && password === 'pemalang123') {
      setUser({ role: 'branch', name: 'Cabang Pemalang', branchId: 'Pemalang' });
      setActiveTab('dashboard'); 
      setLoginError('');
      fetchData();
    } 
    else {
      setLoginError('Username atau Password salah!');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setLoginForm({ username: '', password: '' });
    setOrders([]); setExpenses([]); setPiutangPayments([]); setPemalangReports([]); setStokData([]);
  };

  // --- FUNGSI DATABASE SPREADSHEET ---
  const fetchData = async () => {
    if (!SCRIPT_URL || SCRIPT_URL === 'TARUH_LINK_GOOGLE_SCRIPT_DISINI') return;
    setIsLoading(true);
    try {
      const response = await fetch(`${SCRIPT_URL}?action=read`);
      const result = await response.json();
      if (result.status === 'success') {
        const data = result.data;
        setOrders(data.filter(item => item.table === 'orders' && !item.isDeleted).sort(safeSort));
        setExpenses(data.filter(item => item.table === 'expenses' && !item.isDeleted).sort(safeSort));
        setPiutangPayments(data.filter(item => item.table === 'payments' && !item.isDeleted).sort(safeSort));
        setPemalangReports(data.filter(item => item.table === 'pemalang' && !item.isDeleted).sort(safeSort));
        setStokData(data.filter(item => item.table === 'stok' && !item.isDeleted).sort(safeSort));
      }
    } catch (error) {
      console.error("Gagal mengambil data:", error);
      alert("Gagal terhubung ke Database. Periksa koneksi internet atau URL Script.");
    } finally {
      setIsLoading(false);
    }
  };

  const sendToSheet = async (action, data, table) => {
    if (!SCRIPT_URL || SCRIPT_URL === 'TARUH_LINK_GOOGLE_SCRIPT_DISINI') {
        alert("SIMULASI: Data disimpan di layar sementara. Harap masukkan link Script Google yang benar.");
        return;
    }
    
    if (action === 'insert') {
        if (table === 'orders') setOrders([data, ...orders]);
        if (table === 'expenses') setExpenses([data, ...expenses]);
        if (table === 'payments') setPiutangPayments([data, ...piutangPayments]);
        if (table === 'pemalang') setPemalangReports([data, ...pemalangReports]);
        if (table === 'stok') setStokData([data, ...stokData]);
    }

    try {
      const payload = { action, table, data };
      await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error("Gagal menyimpan ke Sheet:", error);
    }
  };

  const executeDelete = async () => {
    if(!confirmDialog) return;
    const { type, id } = confirmDialog;
    
    let colName = '';
    if (type === 'order') {
        colName = 'orders';
        setOrders(orders.filter(o => o.id !== id));
    } else if (type === 'expense') {
        colName = 'expenses';
        setExpenses(expenses.filter(e => e.id !== id));
    } else if (type === 'payment') {
        colName = 'payments';
        setPiutangPayments(piutangPayments.filter(p => p.id !== id));
    } else if (type === 'pemalang') {
        colName = 'pemalang';
        setPemalangReports(pemalangReports.filter(p => p.id !== id));
    } else if (type === 'stok') {
        colName = 'stok';
        setStokData(stokData.filter(s => s.id !== id));
    }

    await sendToSheet('delete', { id }, colName);
    setConfirmDialog(null);
  };

  const daftarPiutangGlobal = useMemo(() => {
    return orders.map(order => {
      const cicilan = piutangPayments.filter(p => p.orderId === order.id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const sisa = (Number(order.total) || 0) - (Number(order.paidAmount) || 0) - cicilan;
      return { ...order, sisaHutang: sisa };
    }).filter(order => order.sisaHutang > 0);
  }, [orders, piutangPayments]);

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
              <input type="text" required value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition bg-slate-50 focus:bg-white" placeholder="Masukkan username..." />
            </div>
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-1">Password</label>
              <input type="password" required value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition bg-slate-50 focus:bg-white" placeholder="••••••••" />
            </div>
            <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all mt-4">Masuk ke Sistem</button>
          </form>
        </div>
      </div>
    );
  }

  if (isLoading) {
      return (
          <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
              <Loader2 className="w-12 h-12 text-red-600 animate-spin mb-4" />
              <h2 className="text-xl font-bold text-slate-800">Menyinkronkan Database...</h2>
              <p className="text-slate-500">Menarik data terbaru dari Google Spreadsheet.</p>
          </div>
      );
  }

  if (printData?.type === 'invoice') return <PrintInvoiceDotMatrix data={printData.data} onBack={() => setPrintData(null)} />;
  if (printData?.type === 'voucher') return <PrintVoucher data={printData.data} onBack={() => setPrintData(null)} />;
  if (printData?.type === 'receipt') return <PrintReceipt data={printData.data} onBack={() => setPrintData(null)} />;
  if (printData?.type === 'report') return <PrintReport data={printData.data} onBack={() => setPrintData(null)} />;
  if (printData?.type === 'reportBranch') return <PrintReportBranch data={printData.data} onBack={() => setPrintData(null)} user={user} />;

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800">
      
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm animate-in zoom-in-95">
            <h3 className="font-bold text-lg text-red-600 mb-2">Konfirmasi Hapus Aman</h3>
            <p className="text-slate-600 text-sm mb-6">Apakah Anda yakin ingin menghapus data ini dari tampilan? (Data tetap tersimpan aman di Sheet sebagai log audit).</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium">Batal</button>
              <button onClick={executeDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium shadow-sm">Ya, Hapus Saja</button>
            </div>
          </div>
        </div>
      )}

      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg overflow-hidden p-0.5">
            <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="DA Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight truncate w-40">Dimsum Aditya</h1>
            <p className="text-xs text-emerald-400 font-bold flex items-center gap-1"><CheckCircle size={10}/> {user.name}</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {user.role === 'admin' && (
            <>
              <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard & Rekap" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
              <NavItem icon={<ShoppingCart size={20} />} label="Order & Penjualan" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
              <NavItem icon={<Wallet size={20} />} label="Kas & Pengeluaran" active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} />
              <NavItem icon={<Clock size={20} />} label="Piutang / Pending" active={activeTab === 'piutang'} onClick={() => setActiveTab('piutang')} badge={daftarPiutangGlobal.length} />
              <div className="pt-4 mt-2 border-t border-slate-800">
                <NavItem icon={<Package size={20} />} label="Stok Freezer (Pemalang)" active={activeTab === 'stok'} onClick={() => setActiveTab('stok')} />
                <NavItem icon={<Store size={20} />} label="Laporan Pemalang" active={activeTab === 'pemalang'} onClick={() => setActiveTab('pemalang')} />
              </div>
            </>
          )}

          {user.role === 'branch' && (
            <>
              <div className="text-xs font-bold text-slate-500 uppercase mb-2 px-3 tracking-wider">Akses Cabang</div>
              <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard Cabang" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
              <NavItem icon={<ShoppingCart size={20} />} label="Buat Invoice" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
              <NavItem icon={<Package size={20} />} label="Manajemen Stok" active={activeTab === 'stok'} onClick={() => setActiveTab('stok')} />
              <NavItem icon={<Store size={20} />} label="Laporan Harian" active={activeTab === 'pemalang'} onClick={() => setActiveTab('pemalang')} />
            </>
          )}
        </nav>
        
        <div className="p-4 border-t border-slate-800">
           <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white p-3 rounded-xl transition font-medium text-sm">
              <LogOut size={18} /> Keluar / Logout
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 capitalize">
            {activeTab === 'dashboard' && user.role === 'admin' ? 'Dashboard Utama' : 
             activeTab === 'dashboard' && user.role === 'branch' ? 'Dashboard Cabang' : 
             activeTab === 'piutang' ? 'Sistem Piutang' : 
             activeTab === 'pemalang' ? `Area Laporan ${user.role === 'branch' ? user.name : 'Pemalang'}` : 
             activeTab === 'stok' ? 'Manajemen Stok Bahan & Freezer' : 
             `Manajemen ${activeTab}`}
          </h2>
          <div className="text-sm font-medium text-slate-500 bg-slate-100 px-4 py-2 rounded-full border border-slate-200 flex items-center gap-2 hide-on-mobile">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date())}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 bg-slate-50 relative">
          {activeTab === 'dashboard' && user.role === 'admin' && <TabDashboard orders={orders} expenses={expenses} piutangPayments={piutangPayments} pemalangReports={pemalangReports} setPrintData={setPrintData} />}
          {activeTab === 'dashboard' && user.role === 'branch' && <TabDashboardBranch orders={orders} pemalangReports={pemalangReports} setPrintData={setPrintData} user={user} stokData={stokData} />}
          
          {activeTab === 'orders' && <TabOrders orders={orders} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'order', id})} role={user.role} />}
          
          {activeTab === 'expenses' && user.role === 'admin' && <TabExpenses expenses={expenses} sendToSheet={sendToSheet} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'expense', id})} />}
          
          {activeTab === 'piutang' && user.role === 'admin' && <TabPiutang orders={orders} payments={piutangPayments} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'payment', id})} setPrintData={setPrintData} />}
          
          {activeTab === 'pemalang' && <TabPemalang reports={pemalangReports} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'pemalang', id})} role={user.role} />}
          
          {activeTab === 'stok' && <TabStok stokData={stokData} sendToSheet={sendToSheet} requestDelete={(id) => setConfirmDialog({type: 'stok', id})} />}
        </div>
      </main>
    </div>
  );
}


// --- TAB DASHBOARD ADMIN PUSAT ---
function TabDashboard({ orders, expenses, piutangPayments, pemalangReports, setPrintData }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [chartView, setChartView] = useState('daily'); 

  const rekap = useMemo(() => {
    const isDateInRange = (dateStr) => {
        const ymd = getLocalYMD(dateStr);
        if(!ymd) return false;
        return ymd >= dateFrom && ymd <= dateTo;
    };

    const filteredOrders = orders.filter(o => isDateInRange(o.date));
    const filteredExpenses = expenses.filter(e => isDateInRange(e.date));
    const filteredPayments = piutangPayments.filter(p => isDateInRange(p.date));
    const filteredPemalang = pemalangReports.filter(p => isDateInRange(p.date));

    let penjualanCash = 0, penjualanTF = 0;
    let piutangCash = 0, piutangTF = 0;
    let kasMasukCash = 0, kasMasukTF = 0;
    let kasKeluarCash = 0, kasKeluarTF = 0;
    let setoranPemalangTF = 0;
    let totalPiutangBaru = 0;
    let totalPorsi = 0;
    let totalPcs = 0;

    const breakdownPorsi = {};
    const customerMap = {}; 
    const chartDataMap = {}; 

    filteredOrders.forEach(order => {
      const qtyNum = Number(order.qty) || 0;
      const totalNum = Number(order.total) || 0;
      const paidNum = Number(order.paidAmount) || 0;

      totalPcs += qtyNum;
      const porsiOrder = qtyNum / 4; 
      totalPorsi += porsiOrder;
      
      breakdownPorsi[order.category] = (breakdownPorsi[order.category] || 0) + porsiOrder;
      
      const custName = String(order.customer).toUpperCase();
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

      if (order.paymentMethod === 'Cash') penjualanCash += paidNum;
      else if (order.paymentMethod === 'Transfer' || order.paymentMethod === 'Pending / DP') penjualanTF += paidNum; 

      const sisaHutang = totalNum - paidNum;
      if (sisaHutang > 0) totalPiutangBaru += sisaHutang;
    });

    filteredExpenses.forEach(e => {
        const t = Number(e.total) || 0;
        if (e.type === 'IN') {
            if (e.paymentMethod === 'Cash') kasMasukCash += t;
            else kasMasukTF += t;
        } else {
            if (e.paymentMethod === 'Cash') kasKeluarCash += t;
            else kasKeluarTF += t;
        }
    });

    filteredPayments.forEach(pay => {
      const amt = Number(pay.amount) || 0;
      if (pay.paymentMethod === 'Cash') piutangCash += amt;
      else piutangTF += amt;
    });

    filteredPemalang.forEach(p => {
        setoranPemalangTF += (Number(p.nominal) || 0); 
    });

    const totalPenjualanKotor = filteredOrders.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
    const saldoCash = (kasMasukCash + penjualanCash + piutangCash) - kasKeluarCash;
    const saldoTF = (kasMasukTF + penjualanTF + piutangTF + setoranPemalangTF) - kasKeluarTF;
    const saldoAkhir = saldoCash + saldoTF;

    const finalChartData = Object.keys(chartDataMap).map(key => ({ label: key, value: chartDataMap[key] }));
    const topCustomersList = Object.values(customerMap).sort((a,b) => b.total - a.total);

    const listPiutangBerjalanLaporan = orders.map(order => {
        const cicilan = piutangPayments.filter(p => p.orderId === order.id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const sisa = (Number(order.total) || 0) - (Number(order.paidAmount) || 0) - cicilan;
        return { ...order, cicilanTerbayar: cicilan, sisaHutang: sisa };
    }).filter(order => order.sisaHutang > 0);

    const paymentsWithDetails = filteredPayments.map(pay => {
      const relatedOrder = orders.find(o => o.id === pay.orderId);
      if(!relatedOrder) return { ...pay, customer: '-', statusNota: '-' };
      const cicilan = piutangPayments.filter(p => p.orderId === pay.orderId).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const sisa = (Number(relatedOrder.total) || 0) - (Number(relatedOrder.paidAmount) || 0) - cicilan;
      return {
        ...pay,
        customer: relatedOrder.customer,
        statusNota: sisa <= 0 ? 'LUNAS' : 'BELUM LUNAS'
      };
    });

    return {
      penjualanCash, piutangCash, kasMasukCash, kasKeluarCash, saldoCash,
      penjualanTF, piutangTF, kasMasukTF, kasKeluarTF, setoranPemalangTF, saldoTF,
      saldoAkhir, totalPenjualanKotor, totalPiutangBaru, totalPorsi, totalPcs, breakdownPorsi,
      listTransaksiDetail: filteredOrders, listPembayaranPiutang: paymentsWithDetails, listPemalang: filteredPemalang, 
      topCustomersList, finalChartData, listPiutangBerjalanLaporan
    };
  }, [orders, expenses, piutangPayments, pemalangReports, dateFrom, dateTo, chartView]);

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
          <button onClick={() => setPrintData({ type: 'report', data: { rekap, dateFrom, dateTo } })} className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm w-full md:w-auto justify-center">
              <Printer size={16} /> Cetak Rekap Pusat
          </button>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
         <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800"><TrendingUp size={20} className="text-red-500"/> Metrik Pergerakan Omset</h3>
            <div className="flex bg-slate-100 p-1 rounded-lg">
               <button onClick={()=>setChartView('daily')} className={`px-3 py-1 text-xs font-bold rounded ${chartView==='daily'?'bg-white shadow text-red-600':'text-slate-500'}`}>Harian</button>
               <button onClick={()=>setChartView('monthly')} className={`px-3 py-1 text-xs font-bold rounded ${chartView==='monthly'?'bg-white shadow text-red-600':'text-slate-500'}`}>Bulanan</button>
               <button onClick={()=>setChartView('yearly')} className={`px-3 py-1 text-xs font-bold rounded ${chartView==='yearly'?'bg-white shadow text-red-600':'text-slate-500'}`}>Tahunan</button>
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

      <div>
          <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2"><Wallet size={20}/> Status Saldo Aktual</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <StatCard title="Total Saldo Keseluruhan" amount={rekap.saldoAkhir} icon={<Wallet />} color="bg-blue-50 text-blue-700 border-blue-200" />
              <StatCard title="Saldo Tunai (CASH)" amount={rekap.saldoCash} icon={<Coins />} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
              <StatCard title="Saldo Rekening (TRANSFER)" amount={rekap.saldoTF} icon={<CreditCard />} color="bg-indigo-50 text-indigo-700 border-indigo-200" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-emerald-800"><Coins size={20} /> Rincian Arus Kas Tunai (Cash)</h3>
                  <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="text-slate-600">Terima Penjualan Langsung</span>
                          <span className="font-bold text-emerald-600">+{formatRp(rekap.penjualanCash)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="text-slate-600">Terima Pelunasan Piutang</span>
                          <span className="font-bold text-emerald-600">+{formatRp(rekap.piutangCash)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="text-slate-600">Modal / Kas Masuk Lainnya</span>
                          <span className="font-bold text-emerald-600">+{formatRp(rekap.kasMasukCash)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100 text-red-600">
                          <span>Kas Keluar (Beban Tunai)</span>
                          <span className="font-bold">-{formatRp(rekap.kasKeluarCash)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 text-emerald-800">
                          <span className="font-bold">TOTAL SALDO CASH</span>
                          <span className="font-bold text-lg">{formatRp(rekap.saldoCash)}</span>
                      </div>
                  </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-indigo-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-indigo-800"><CreditCard size={20} /> Rincian Arus Kas Bank (Transfer)</h3>
                  <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="text-slate-600">Terima Penjualan Langsung</span>
                          <span className="font-bold text-indigo-600">+{formatRp(rekap.penjualanTF)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="text-slate-600">Terima Pelunasan Piutang</span>
                          <span className="font-bold text-indigo-600">+{formatRp(rekap.piutangTF)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="text-slate-600">Modal / Kas Masuk Lainnya</span>
                          <span className="font-bold text-indigo-600">+{formatRp(rekap.kasMasukTF)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="font-medium text-amber-700">Setoran Pemalang (TF Ke Pusat)</span>
                          <span className="font-bold text-amber-600">+{formatRp(rekap.setoranPemalangTF)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100 text-red-600">
                          <span>Kas Keluar (Beban Transfer)</span>
                          <span className="font-bold">-{formatRp(rekap.kasKeluarTF)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 text-indigo-800">
                          <span className="font-bold">TOTAL SALDO TRANSFER</span>
                          <span className="font-bold text-lg">{formatRp(rekap.saldoTF)}</span>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col max-h-96">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Users size={20} className="text-slate-500"/> Top Pelanggan (Periode Terpilih)</h3>
            <div className="overflow-y-auto pr-2 flex-1 space-y-3">
               {rekap.topCustomersList.map((cust, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-red-200 transition">
                     <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-orange-300 text-white' : 'bg-white text-slate-400'}`}>
                           #{i+1}
                        </div>
                        <div>
                           <div className="font-bold text-slate-800">{cust.name}</div>
                           <div className="text-xs text-slate-500">{cust.frequency}x Order • {cust.qty} Pcs ({cust.porsi} Prs)</div>
                        </div>
                     </div>
                     <div className="font-bold text-red-600">{formatRp(cust.total)}</div>
                  </div>
               ))}
               {rekap.topCustomersList.length === 0 && <div className="text-center text-slate-400 text-sm mt-8">Tidak ada data penjualan.</div>}
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col max-h-96">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><ShoppingCart size={20} className="text-slate-500"/> Ringkasan Penjualan Porsi & Info</h3>
            <div className="mb-4">
                <span className="text-4xl font-bold text-red-600">{rekap.totalPorsi}</span>
                <span className="text-slate-500 ml-2 font-medium">Porsi Terjual</span>
                <div className="text-xs text-slate-400 mt-1">(Total {rekap.totalPcs} Pcs. 1 Porsi = 4 Pcs)</div>
            </div>
            
            <div className="space-y-3 overflow-y-auto pr-2 mb-4">
                {Object.entries(rekap.breakdownPorsi).sort((a,b) => b[1] - a[1]).map(([kategori, porsi]) => (
                <div key={kategori} className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 font-medium w-24">{kategori}</span>
                    <div className="flex items-center gap-3 flex-1 ml-4">
                    <div className="h-2.5 bg-red-100 flex-1 rounded-full overflow-hidden">
                        <div className="h-full bg-red-600 rounded-full" style={{ width: `${(porsi / rekap.totalPorsi) * 100}%` }}></div>
                    </div>
                    <span className="text-sm font-bold w-12 text-right">{porsi}</span>
                    </div>
                </div>
                ))}
            </div>
        </div>
      </div>

      {rekap.listPembayaranPiutang.length > 0 && (
          <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-hidden mt-6">
            <div className="p-4 border-b border-orange-200 bg-orange-50 flex items-center gap-2">
                <Clock className="text-orange-600" size={18}/>
                <h3 className="font-bold text-orange-800">Rincian Uang Masuk dari Pelunasan/Cicilan Piutang</h3>
            </div>
            <table className="w-full text-sm text-left block md:table overflow-x-auto">
                <thead className="bg-white text-slate-500 text-xs uppercase font-semibold border-b">
                    <tr>
                        <th className="px-6 py-3">Tanggal Bayar</th>
                        <th className="px-6 py-3">ID Pembayaran</th>
                        <th className="px-6 py-3">Pelanggan</th>
                        <th className="px-6 py-3">Via</th>
                        <th className="px-6 py-3 text-right">Nominal Masuk</th>
                        <th className="px-6 py-3 text-center">Status Nota</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {rekap.listPembayaranPiutang.map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                            <td className="px-6 py-3 font-medium">{formatDate(p.date)}</td>
                            <td className="px-6 py-3 font-mono text-xs text-slate-500">{p.id}</td>
                            <td className="px-6 py-3 font-bold uppercase">{p.customer}</td>
                            <td className="px-6 py-3 text-xs font-medium text-slate-500">{p.paymentMethod}</td>
                            <td className="px-6 py-3 text-right font-bold text-orange-600">{formatRp(p.amount)}</td>
                            <td className="px-6 py-3 text-center font-bold text-[10px]">
                                {p.statusNota === 'LUNAS' ? <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded">LUNAS</span> : <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded">BELUM LUNAS</span>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
      )}
    </div>
  );
}

// --- TAB DASHBOARD CABANG (KHUSUS PEMALANG) ---
function TabDashboardBranch({ orders, pemalangReports, setPrintData, user, stokData }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [chartView, setChartView] = useState('daily'); 

  const stokAktual = useMemo(() => {
    const calc = {};
    stokData.forEach(s => {
      const nama = s.itemName.toUpperCase();
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

    const customerMap = {}; 
    const chartDataMap = {}; 

    filteredOrders.forEach(order => {
      const qtyNum = Number(order.qty) || 0;
      const totalNum = Number(order.total) || 0;

      totalPcs += qtyNum;
      totalPorsi += (qtyNum / 4); 
      totalPenjualanKotor += totalNum;
      
      const custName = String(order.customer).toUpperCase();
      if(!customerMap[custName]) customerMap[custName] = { name: custName, qty: 0, porsi: 0, total: 0, frequency: 0 };
      customerMap[custName].qty += qtyNum;
      customerMap[custName].porsi += (qtyNum / 4);
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

    filteredReports.forEach(p => {
        setoranKePusat += (Number(p.nominal) || 0); 
    });

    const finalChartData = Object.keys(chartDataMap).map(key => ({ label: key, value: chartDataMap[key] }));
    const topCustomersList = Object.values(customerMap).sort((a,b) => b.total - a.total);

    return {
      totalPenjualanKotor, setoranKePusat, totalPorsi, totalPcs,
      topCustomersList, finalChartData, listOrders: filteredOrders, listReports: filteredReports
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

      {/* WIDGET MONITORING STOK CABANG */}
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

function TabOrders({ orders, sendToSheet, setPrintData, requestDelete, role }) {
  const [showForm, setShowForm] = useState(false);
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [customer, setCustomer] = useState('');
  const [category, setCategory] = useState(role === 'branch' ? 'Pemalang' : 'Reseller');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState(KATEGORI_HARGA[role === 'branch' ? 'Pemalang' : 'Reseller']);
  const [total, setTotal] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState('');

  const [filterFrom, setFilterFrom] = useState(todayStr);
  const [filterTo, setFilterTo] = useState(todayStr);

  const handleCategoryChange = (e) => {
    const newCat = e.target.value;
    setCategory(newCat);
    const newPrice = KATEGORI_HARGA[newCat] || 0;
    setPrice(newPrice);
    const newTotal = Number(qty) * newPrice;
    setTotal(newTotal);
    if(paymentMethod !== 'Pending / DP') setPaidAmount(newTotal);
  };

  const handleQtyChange = (e) => {
    const newQty = e.target.value;
    setQty(newQty);
    const newTotal = Number(newQty) * price;
    setTotal(newTotal);
    if(paymentMethod !== 'Pending / DP') setPaidAmount(newTotal);
  };

  const handlePriceChange = (val) => {
    setPrice(val);
    const newTotal = Number(qty) * val;
    setTotal(newTotal);
    if(paymentMethod !== 'Pending / DP') setPaidAmount(newTotal);
  };

  const handleTotalChange = (val) => {
    setTotal(val);
    if(paymentMethod !== 'Pending / DP') setPaidAmount(val);
  };

  const handlePaymentMethodChange = (e) => {
    const method = e.target.value;
    setPaymentMethod(method);
    if (method !== 'Pending / DP') setPaidAmount(total); 
    else setPaidAmount(0); 
  };

  const handleSimpan = (e) => {
    e.preventDefault();
    const newOrder = {
      id: generateId('INV', date),
      date, customer, category, qty: Number(qty)||0, price: Number(price)||0, total: Number(total)||0, paymentMethod, paidAmount: Number(paidAmount)||0, notes
    };
    sendToSheet('insert', newOrder, 'orders'); 
    setShowForm(false);
    setCustomer(''); setNotes(''); setQty('');
  };

  const displayOrders = useMemo(() => {
    let filtered = role === 'branch' ? orders.filter(o => o.category === 'Pemalang') : orders;
    return filtered.filter(o => {
        const ymd = getLocalYMD(o.date);
        if(!ymd) return false;
        return ymd >= filterFrom && ymd <= filterTo;
    });
  }, [orders, role, filterFrom, filterTo]);

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
           <h3 className="font-bold text-lg text-slate-800">Order & Penjualan {role === 'branch' ? '(Pemalang)' : '(Pusat)'}</h3>
           <p className="text-sm text-slate-500">Kelola pesanan masuk dan cetak invoice Dot Matrix LX-310.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm">
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Batal' : 'Buat Invoice Baru'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSimpan} className="bg-white p-6 rounded-xl border border-red-200 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-top-4">
          <div className="lg:col-span-3 mb-2 border-b border-slate-100 pb-2">
              <h4 className="font-bold text-red-800 text-sm flex items-center gap-2"><ShoppingCart size={16}/> Form Input Pesanan</h4>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Tanggal Transaksi</label>
            <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-200" />
          </div>
          <div className="space-y-1 lg:col-span-2">
            <label className="text-sm font-medium text-slate-700">Nama Pelanggan / Agen</label>
            <input type="text" required placeholder="Contoh: Budi, ADE..." value={customer} onChange={e => setCustomer(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-200 uppercase" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Kategori / Cabang</label>
            <select value={category} onChange={handleCategoryChange} disabled={role === 'branch'} className={`w-full p-2 border rounded-lg font-medium ${role === 'branch' ? 'bg-slate-100 text-slate-500' : 'focus:ring-2 focus:ring-red-200 text-red-700 bg-red-50'}`}>
              {Object.keys(KATEGORI_HARGA).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Jumlah (Pcs)</label>
            <input type="number" min="1" required value={qty} onChange={handleQtyChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-200" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Harga per Pcs (Rp)</label>
            {/* INPUT PINTAR RUPIAH */}
            <input type="text" required value={formatRp(price)} onChange={e => handlePriceChange(parseRp(e.target.value))} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-200 font-bold" />
          </div>

          <div className="space-y-1 bg-amber-50 p-3 rounded-lg border border-amber-200 lg:col-span-3">
            <label className="text-xs font-bold text-amber-800 uppercase">Total Harga (Otomatis & Bisa Edit Manual)</label>
            {/* INPUT PINTAR RUPIAH */}
            <input type="text" required value={formatRp(total)} onChange={e => handleTotalChange(parseRp(e.target.value))} className="w-full p-3 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-400 font-bold text-lg bg-white mt-1 text-amber-900" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Metode Pembayaran</label>
            <select value={paymentMethod} onChange={handlePaymentMethodChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-200">
              <option value="Cash">Cash / Tunai</option>
              <option value="Transfer">Transfer Bank</option>
              <option value="Pending / DP">Pending (Piutang) / DP</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Uang Diterima / DP (Rp)</label>
            {/* INPUT PINTAR RUPIAH */}
            <input type="text" required value={formatRp(paidAmount)} onChange={e => setPaidAmount(parseRp(e.target.value))} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-200 font-bold" />
          </div>
          <div className="space-y-1 lg:col-span-3">
            <label className="text-sm font-medium text-slate-700">Catatan Tambahan (Opsional)</label>
            <input type="text" placeholder="Catatan invoice..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-200" />
          </div>
          
          <div className="lg:col-span-3 flex justify-end mt-2 pt-4 border-t border-slate-100">
            <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition">Simpan & Masuk Database</button>
          </div>
        </form>
      )}

      {/* FILTER TANGGAL TABEL */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm mt-4">
         <div className="flex items-center gap-2"><Filter size={16} className="text-slate-400"/><span className="text-sm font-bold text-slate-700">Filter Data:</span></div>
         <input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} className="p-1.5 text-sm border rounded focus:ring-2 focus:ring-red-200" />
         <span className="text-slate-400">-</span>
         <input type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)} className="p-1.5 text-sm border rounded focus:ring-2 focus:ring-red-200" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-4">
        <table className="w-full text-sm text-left block md:table overflow-x-auto">
          <thead className="bg-red-50 text-red-800 text-xs uppercase font-semibold border-b border-red-100">
            <tr>
              <th className="px-4 py-3 min-w-[120px]">No. Invoice & Tgl</th>
              <th className="px-4 py-3 min-w-[150px]">Pelanggan</th>
              <th className="px-4 py-3 text-center min-w-[100px]">Qty / Kategori</th>
              <th className="px-4 py-3 text-center min-w-[100px]">Metode Bayar</th>
              <th className="px-4 py-3 text-right min-w-[120px]">Total</th>
              <th className="px-4 py-3 text-center min-w-[80px]">Status</th>
              <th className="px-4 py-3 text-center min-w-[100px]">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayOrders.map((ord) => (
              <tr key={ord.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-mono text-xs font-bold text-slate-700">{ord.id}</div>
                  <div className="text-xs text-slate-500">{formatDate(ord.date)}</div>
                </td>
                <td className="px-4 py-3 font-bold text-slate-800 uppercase">{ord.customer}</td>
                <td className="px-4 py-3 text-center">
                  <div className="font-medium">{ord.qty} Pcs</div>
                  <div className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded inline-block mt-0.5">{ord.category}</div>
                </td>
                <td className="px-4 py-3 text-center font-medium text-slate-600">{ord.paymentMethod}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatRp(ord.total)}</td>
                <td className="px-4 py-3 text-center">
                  {(Number(ord.total)||0) > (Number(ord.paidAmount)||0) ? (
                    <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-[10px] font-bold tracking-wide">PIUTANG</span>
                  ) : (
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold tracking-wide">LUNAS</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => setPrintData({ type: 'invoice', data: ord })} className="text-slate-600 hover:text-slate-900 bg-slate-100 p-2 rounded-lg transition border border-slate-200 shadow-sm" title="Cetak Epson LX-310">
                      <Printer size={16} />
                    </button>
                    {/* CABANG SEKARANG BISA HAPUS INVOICENYA SENDIRI */}
                    <button onClick={() => requestDelete(ord.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-lg transition" title="Hapus Data">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {displayOrders.length === 0 && <tr><td colSpan="7" className="text-center py-12 text-slate-400">Tidak ada transaksi ditemukan pada tanggal filter tersebut.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabStok({ stokData, sendToSheet, requestDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [itemName, setItemName] = useState('');
  const [satuan, setSatuan] = useState('Kg'); 
  const [type, setType] = useState('MASUK');
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');

  const listBarangUnik = [...new Set(stokData.map(s => String(s.itemName||'').toUpperCase()))];

  const handleSimpan = (e) => {
    e.preventDefault();
    if(!itemName.trim()) { alert('Nama barang wajib diisi!'); return; }
    if(!satuan.trim()) { alert('Satuan wajib diisi! (Cth: Kg, Kantong)'); return; }
    
    const newStok = {
      id: generateId('STK', date),
      date, itemName: itemName.toUpperCase(), satuan: satuan.toUpperCase(),
      type, qty: Number(qty)||0, notes
    };
    sendToSheet('insert', newStok, 'stok');
    setShowForm(false);
    setQty(''); setNotes(''); setItemName('');
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

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
           <h3 className="font-bold text-lg text-slate-800">Manajemen Stok Bahan & Freezer</h3>
           <p className="text-sm text-slate-500">Catat keluar, masuk, dan pemakaian bahan untuk produksi.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm">
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Batal' : 'Catat Stok'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
        {Object.keys(stokAktual).length === 0 && <div className="text-sm text-slate-500 italic col-span-full">Belum ada data barang. Silakan catat stok pertama Anda.</div>}
        {Object.entries(stokAktual).map(([nama, data]) => (
            <div key={nama} className={`p-4 rounded-xl border flex flex-col justify-between ${data.sisa <= 0 ? 'bg-red-50 border-red-200' : 'bg-white border-blue-200 shadow-sm'}`}>
                <div className="text-sm font-bold text-slate-700 mb-2 truncate" title={nama}>{nama}</div>
                <div className={`text-2xl font-black ${data.sisa <= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {data.sisa} <span className="text-xs font-medium text-slate-500">{data.satuan}</span>
                </div>
                <div className="text-[9px] text-slate-400 mt-2 flex justify-between uppercase font-bold">
                    <span className="text-emerald-500">In: {data.masuk}</span> 
                    <span className="text-orange-500">Pakai: {data.terpakai}</span> 
                    <span className="text-red-500">Out: {data.keluar}</span>
                </div>
            </div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleSimpan} className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-4">
          <div className="col-span-full mb-2">
             <div className="flex bg-slate-100 p-1 rounded-lg w-full">
                <button type="button" onClick={() => setType('MASUK')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${type === 'MASUK' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}><ArrowDownToLine size={16} className="inline mb-0.5 mr-1"/> Masuk</button>
                <button type="button" onClick={() => setType('TERPAKAI')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${type === 'TERPAKAI' ? 'bg-white shadow text-orange-500' : 'text-slate-500'}`}><Utensils size={16} className="inline mb-0.5 mr-1"/> Dipakai Produksi</button>
                <button type="button" onClick={() => setType('KELUAR')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${type === 'KELUAR' ? 'bg-white shadow text-red-600' : 'text-slate-500'}`}><ArrowUpFromLine size={16} className="inline mb-0.5 mr-1"/> Keluar (Rusak/dll)</button>
             </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Tanggal</label>
            <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-200" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Nama Barang (Ketik/Pilih dari saran)</label>
            <input type="text" list="suggestions-item" required placeholder="Ketik nama bahan/barang..." value={itemName} onChange={e => setItemName(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-200 uppercase font-medium text-slate-700" />
            <datalist id="suggestions-item">
                {listBarangUnik.map(b => <option key={b} value={b} />)}
            </datalist>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Jumlah / Qty & Satuan</label>
            <div className="flex gap-2">
                <input type="number" min="1" required placeholder="Jml" value={qty} onChange={e => setQty(e.target.value)} className="w-2/3 p-2 border rounded-lg focus:ring-2 focus:ring-blue-200 font-bold" />
                <input type="text" list="satuan-list" required placeholder="Satuan" value={satuan} onChange={e => setSatuan(e.target.value)} className="w-1/3 p-2 border rounded-lg focus:ring-2 focus:ring-blue-200 uppercase font-bold text-sm text-slate-600" />
                <datalist id="satuan-list">
                    <option value="Kg" />
                    <option value="Kantong" />
                    <option value="Pcs" />
                    <option value="Bungkus" />
                    <option value="Liter" />
                    <option value="Dus" />
                    <option value="Gram" />
                </datalist>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Keterangan Opsional</label>
            <input type="text" placeholder="Cth: Dropping Pusat, Dipakai bikin Nori, Rusak..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-200" />
          </div>
          <div className="col-span-full flex justify-end mt-2">
            <button type="submit" className={`text-white px-6 py-2 rounded-lg font-medium shadow-sm transition ${type === 'MASUK' ? 'bg-emerald-600 hover:bg-emerald-700' : type === 'TERPAKAI' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-red-600 hover:bg-red-700'}`}>Simpan Log Stok</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-4">
        <table className="w-full text-sm text-left block md:table overflow-x-auto">
          <thead className="bg-blue-50 text-blue-800 text-xs uppercase font-semibold border-b border-blue-100">
            <tr>
              <th className="px-4 py-3 min-w-[120px]">Tanggal</th>
              <th className="px-4 py-3 min-w-[150px]">Nama Barang</th>
              <th className="px-4 py-3 text-center min-w-[100px]">Jenis Log</th>
              <th className="px-4 py-3 text-center min-w-[120px]">Qty & Satuan</th>
              <th className="px-4 py-3 min-w-[150px]">Keterangan</th>
              <th className="px-4 py-3 text-center min-w-[80px]">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stokData.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{formatDate(s.date)}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">{s.id}</div>
                </td>
                <td className="px-4 py-3 font-bold text-slate-800 uppercase">{s.itemName}</td>
                <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wide ${s.type === 'MASUK' ? 'bg-emerald-100 text-emerald-700' : s.type === 'TERPAKAI' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                        {s.type}
                    </span>
                </td>
                <td className={`px-4 py-3 text-center font-bold ${s.type === 'MASUK' ? 'text-emerald-600' : s.type === 'TERPAKAI' ? 'text-orange-500' : 'text-red-600'}`}>
                    {s.type === 'MASUK' ? '+' : '-'}{s.qty} <span className="text-xs uppercase font-medium">{s.satuan || 'PCS'}</span>
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs">{s.notes || '-'}</td>
                <td className="px-4 py-3 text-center">
                    <button onClick={() => requestDelete(s.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-lg transition" title="Hapus Log">
                        <Trash2 size={16} />
                    </button>
                </td>
              </tr>
            ))}
            {stokData.length === 0 && <tr><td colSpan="6" className="text-center py-12 text-slate-400">Belum ada riwayat stok.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabExpenses({ expenses, sendToSheet, setPrintData, requestDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('IN'); 
  const todayStr = new Date().toISOString().split('T')[0];
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

  const handleSimpan = (e) => {
    e.preventDefault();
    const prefix = type === 'IN' ? 'IN' : 'OUT';
    const newExpense = {
      id: generateId(prefix, date),
      date, recipient, category: type === 'IN' ? 'Modal Awal / Tambahan Saldo' : category, description, qty: Number(qty)||0, price: Number(price)||0, total, type, paymentMethod
    };
    sendToSheet('insert', newExpense, 'expenses');
    setShowForm(false);
    setRecipient(''); setDescription(''); setPrice(0); setQty('');
  };

  const displayExpenses = useMemo(() => {
    return expenses.filter(e => {
        const ymd = getLocalYMD(e.date);
        if(!ymd) return false;
        return ymd >= filterFrom && ymd <= filterTo;
    });
  }, [expenses, filterFrom, filterTo]);

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg">Buku Kas Umum</h3>
        <button onClick={() => setShowForm(!showForm)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition">
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Batal' : 'Input Transaksi / Saldo Awal'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSimpan} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-4">
          <div className="col-span-full mb-2">
             <div className="flex bg-slate-100 p-1 rounded-lg w-full max-w-sm">
                <button type="button" onClick={() => setType('IN')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${type === 'IN' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>Kas Masuk (Modal Awal)</button>
                <button type="button" onClick={() => setType('OUT')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${type === 'OUT' ? 'bg-white shadow text-red-600' : 'text-slate-500'}`}>Kas Keluar (Beban)</button>
             </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Sumber Saldo (Metode)</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-200 bg-slate-50 font-bold">
              <option value="Cash">Tunai (Cash)</option>
              <option value="Transfer">Bank (Transfer)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Tanggal</label>
            <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-200" />
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Penerima / Dari (Kepada)</label>
            <input type="text" required placeholder="Cth: TIA, Supplier, Pusat..." value={recipient} onChange={e => setRecipient(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-200 uppercase" />
          </div>
          {type === 'OUT' ? (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Kategori</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-200">
                {KATEGORI_PENGELUARAN.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Kategori Kas Masuk</label>
              <input type="text" disabled value="Modal Awal / Tambahan Saldo" className="w-full p-2 border rounded-lg bg-slate-100 text-slate-500" />
            </div>
          )}
          <div className="space-y-1 col-span-full">
            <label className="text-sm font-medium text-slate-700">Keterangan / Rincian Lengkap</label>
            <input type="text" required placeholder="Cth: Saldo awal bulan, Servis Motor, Beli Daging..." value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-200" />
          </div>
          <div className="space-y-1 flex gap-2">
             <div className="w-1/3">
                <label className="text-sm font-medium text-slate-700">Qty</label>
                <input type="number" min="1" required value={qty} onChange={e => setQty(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-200" />
             </div>
             <div className="w-2/3">
                <label className="text-sm font-medium text-slate-700">Harga Satuan (Rp)</label>
                {/* INPUT PINTAR RUPIAH */}
                <input type="text" required value={formatRp(price)} onChange={e => setPrice(parseRp(e.target.value))} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-200" />
             </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Total {type === 'IN' ? 'Masuk' : 'Keluar'}</label>
            <div className={`w-full p-2 bg-slate-100 border rounded-lg font-bold ${type==='IN'?'text-emerald-700':'text-red-700'}`}>{formatRp(total)}</div>
          </div>
          
          <div className="col-span-full flex justify-end mt-2">
            <button type="submit" className={`${type === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} text-white px-6 py-2 rounded-lg font-medium shadow-sm transition`}>
              Simpan Transaksi Kas
            </button>
          </div>
        </form>
      )}

      {/* FILTER TANGGAL TABEL */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm mt-4">
         <div className="flex items-center gap-2"><Filter size={16} className="text-slate-400"/><span className="text-sm font-bold text-slate-700">Filter Data:</span></div>
         <input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} className="p-1.5 text-sm border rounded focus:ring-2 focus:ring-emerald-200" />
         <span className="text-slate-400">-</span>
         <input type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)} className="p-1.5 text-sm border rounded focus:ring-2 focus:ring-emerald-200" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left block md:table overflow-x-auto">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b">
            <tr>
              <th className="px-4 py-3 min-w-[120px]">Tgl & ID</th>
              <th className="px-4 py-3 min-w-[200px]">Keterangan</th>
              <th className="px-4 py-3 text-center min-w-[100px]">Via</th>
              <th className="px-4 py-3 text-right min-w-[120px]">Nominal</th>
              <th className="px-4 py-3 text-center min-w-[100px]">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayExpenses.map((exp) => (
              <tr key={exp.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{formatDate(exp.date)}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{exp.id}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-bold flex items-center gap-2">
                    {exp.type === 'IN' ? <ArrowRightLeft size={14} className="text-emerald-500"/> : <ArrowRightLeft size={14} className="text-red-500"/>}
                    {exp.category}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">{exp.description} (Kpd: <span className="uppercase font-bold">{exp.recipient}</span>)</div>
                </td>
                <td className="px-4 py-3 text-center font-medium text-slate-500">{exp.paymentMethod}</td>
                <td className={`px-4 py-3 text-right font-bold ${exp.type === 'IN' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {exp.type === 'IN' ? '+' : '-'}{formatRp(exp.total)}
                </td>
                <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                        {exp.type === 'OUT' && (
                            <button onClick={() => setPrintData({ type: 'voucher', data: exp })} className="text-slate-600 hover:text-slate-900 bg-slate-100 p-2 rounded-lg transition" title="Cetak Voucher">
                            <Printer size={16} />
                            </button>
                        )}
                        <button onClick={() => requestDelete(exp.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-lg transition" title="Hapus Data">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </td>
              </tr>
            ))}
            {displayExpenses.length === 0 && <tr><td colSpan="5" className="text-center py-12 text-slate-400">Tidak ada kas masuk/keluar di tanggal tersebut.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabPiutang({ orders, payments, sendToSheet, requestDelete, setPrintData }) {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [bayarAmount, setBayarAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Transfer');

  const daftarPiutang = useMemo(() => {
    return orders.map(order => {
      const orderPayments = payments.filter(p => p.orderId === order.id);
      const cicilan = orderPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const sisa = (Number(order.total) || 0) - (Number(order.paidAmount) || 0) - cicilan;
      return { ...order, cicilanTerbayar: cicilan, sisaHutang: sisa, orderPayments };
    }).filter(order => order.sisaHutang > 0 || order.orderPayments.length > 0); 
  }, [orders, payments]);

  const handleBayar = (e) => {
    e.preventDefault();
    if(bayarAmount <= 0 || bayarAmount > selectedOrder.sisaHutang) return; 
    const tgl = new Date();
    const newPayment = {
        id: generateId('PAY', tgl.toISOString().split('T')[0]),
        orderId: selectedOrder.id,
        date: tgl.toISOString().split('T')[0],
        amount: Number(bayarAmount) || 0,
        paymentMethod 
    };
    sendToSheet('insert', newPayment, 'payments');
    setBayarAmount(0); 
  };

  const activeOrder = selectedOrder ? daftarPiutang.find(o => o.id === selectedOrder.id) : null;

  return (
    <div className="space-y-4 animate-in fade-in">
        {activeOrder && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 max-h-[90vh] overflow-auto">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-lg">Kelola Piutang & Cicilan</h3>
                        <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-700 bg-slate-100 p-1.5 rounded-full"><X size={20}/></button>
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-xl mb-6 border border-slate-200">
                        <div className="flex justify-between mb-2 pb-2 border-b border-slate-200">
                            <span className="text-slate-500 text-sm">No. Invoice Ref</span>
                            <span className="font-mono text-sm font-bold text-slate-800">{activeOrder.id}</span>
                        </div>
                        <div className="flex justify-between mb-2 pb-2 border-b border-slate-200">
                            <span className="text-slate-500 text-sm">Pelanggan</span>
                            <span className="font-bold text-sm uppercase">{activeOrder.customer}</span>
                        </div>
                        <div className="flex justify-between pt-2">
                            <span className="font-bold text-red-600">SISA HUTANG AKTUAL</span>
                            <span className="font-bold text-red-700 text-lg">{formatRp(activeOrder.sisaHutang)}</span>
                        </div>
                    </div>

                    {activeOrder.sisaHutang > 0 && (
                        <form onSubmit={handleBayar} className="space-y-4 mb-8 bg-orange-50 p-4 rounded-xl border border-orange-200 shadow-inner">
                            <h4 className="font-bold text-sm text-orange-800 flex items-center gap-2"><CreditCard size={16}/> Input Pembayaran Baru</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-orange-700">Metode Bayar Masuk</label>
                                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full p-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 mt-1 text-sm bg-white font-medium">
                                        <option value="Transfer">Transfer Bank</option>
                                        <option value="Cash">Tunai (Cash)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-orange-700">Nominal (Maks {formatRp(activeOrder.sisaHutang)})</label>
                                    {/* INPUT PINTAR RUPIAH */}
                                    <input type="text" required value={formatRp(bayarAmount)} onChange={e => {
                                        let val = parseRp(e.target.value);
                                        if(val > activeOrder.sisaHutang) val = activeOrder.sisaHutang;
                                        setBayarAmount(val);
                                    }} className="w-full p-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 mt-1 text-sm font-bold" />
                                </div>
                            </div>
                            <div className="flex justify-end mt-2">
                                <button type="submit" className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-sm text-sm">Simpan Pelunasan</button>
                            </div>
                        </form>
                    )}

                    <div>
                        <h4 className="font-bold text-sm text-slate-700 mb-3 border-b pb-1">Riwayat Pembayaran Cicilan Sebelumnya</h4>
                        {(!activeOrder.orderPayments || activeOrder.orderPayments.length === 0) ? (
                            <p className="text-sm text-slate-400 italic">Belum ada riwayat cicilan.</p>
                        ) : (
                            <div className="space-y-2">
                                {activeOrder.orderPayments.map(pay => (
                                    <div key={pay.id} className="flex justify-between items-center bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                                        <div>
                                            <div className="text-[10px] font-mono text-slate-400">{pay.id}</div>
                                            <div className="text-sm font-medium">{formatDate(pay.date)}</div>
                                        </div>
                                        <div className="text-xs font-bold text-slate-500 px-2 bg-slate-100 rounded py-0.5">{pay.paymentMethod}</div>
                                        <div className="font-bold text-emerald-600 flex-1 text-right mr-4">{formatRp(pay.amount)}</div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setPrintData({ type: 'receipt', data: { payment: pay, order: activeOrder }})} className="p-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded" title="Cetak Bukti">
                                                <Printer size={16} />
                                            </button>
                                            <button onClick={() => requestDelete(pay.id)} className="p-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded" title="Hapus">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg">Daftar Nota Piutang Berjalan</h3>
      </div>
      
      {daftarPiutang.filter(o => o.sisaHutang > 0).length === 0 ? (
          <div className="text-center p-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500">
              <CheckCircle size={48} className="mx-auto text-emerald-400 mb-3" />
              <p>Hore! Semua nota telah lunas. Tidak ada piutang saat ini.</p>
          </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {daftarPiutang.filter(o => o.sisaHutang > 0).map((order) => (
                <div key={order.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-orange-300 transition-colors">
                    <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg shadow">BELUM LUNAS</div>
                    <div className="text-sm text-slate-500 mb-1">{formatDate(order.date)}</div>
                    <div className="font-bold text-lg mb-1 uppercase">{order.customer}</div>
                    <div className="text-[10px] font-mono text-slate-400 mb-4">{order.id}</div>
                    
                    <div className="space-y-2 text-sm mb-4">
                        <div className="flex justify-between border-b border-slate-100 pb-1">
                            <span className="text-slate-500">Total Invoice</span>
                            <span className="font-medium">{formatRp(order.total)}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1">
                            <span className="text-slate-500">Telah Dicicil</span>
                            <span className="font-bold text-emerald-600">{formatRp((Number(order.paidAmount) || 0) + (Number(order.cicilanTerbayar) || 0))}</span>
                        </div>
                        <div className="flex justify-between pt-1">
                            <span className="font-bold text-red-600">Sisa Hutang</span>
                            <span className="font-bold text-red-700 text-base">{formatRp(order.sisaHutang)}</span>
                        </div>
                    </div>
                    
                    <button onClick={() => {setSelectedOrder(order); setBayarAmount(order.sisaHutang)}} className="w-full bg-orange-100 text-orange-800 hover:bg-orange-500 hover:text-white transition py-2.5 rounded-lg font-bold text-sm shadow-sm">
                        Kelola Cicilan / Pelunasan
                    </button>
                </div>
            ))}
        </div>
      )}
    </div>
  );
}

function TabPemalang({ reports, sendToSheet, requestDelete, role }) {
  const [showForm, setShowForm] = useState(false);
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [pesananMika, setPesananMika] = useState('');
  const [pesananPorsi, setPesananPorsi] = useState('');
  const [produksiMika, setProduksiMika] = useState('');
  const [produksiPorsi, setProduksiPorsi] = useState('');
  const [stokFreezer, setStokFreezer] = useState(''); 
  const [nominal, setNominal] = useState(0);
  const [transferDestination, setTransferDestination] = useState('BCA (WASTAM)'); 
  const [notes, setNotes] = useState('');

  const [filterFrom, setFilterFrom] = useState(todayStr);
  const [filterTo, setFilterTo] = useState(todayStr);

  const handleSimpan = (e) => {
    e.preventDefault();
    const newReport = {
      id: generateId('PML', date),
      date, pesananMika: Number(pesananMika)||0, pesananPorsi: Number(pesananPorsi)||0,
      produksiMika: Number(produksiMika)||0, produksiPorsi: Number(produksiPorsi)||0,
      stokFreezer, transferDestination, nominal: Number(nominal)||0, notes
    };
    sendToSheet('insert', newReport, 'pemalang');
    setShowForm(false);
    setPesananMika(''); setPesananPorsi(''); setProduksiMika(''); setProduksiPorsi(''); setStokFreezer(''); setNominal(0); setNotes('');
  };

  const displayReports = useMemo(() => {
    return reports.filter(p => {
        const ymd = getLocalYMD(p.date);
        if(!ymd) return false;
        return ymd >= filterFrom && ymd <= filterTo;
    });
  }, [reports, filterFrom, filterTo]);

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
           <h3 className="font-bold text-lg text-slate-800">Laporan Operasional Harian</h3>
           <p className="text-sm text-slate-500">Pencatatan produksi harian, status freezer tutup toko, dan setor kas (TF).</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm">
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Batal' : 'Buat Laporan Baru'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSimpan} className="bg-white p-6 rounded-xl border border-amber-200 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-4">
          <div className="lg:col-span-4 mb-2 border-b border-slate-100 pb-2">
              <h4 className="font-bold text-amber-800 text-sm flex items-center gap-2"><Store size={16}/> Form Input Laporan Harian</h4>
          </div>
          <div className="space-y-1 lg:col-span-4">
            <label className="text-sm font-medium text-slate-700">Tanggal Laporan</label>
            <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full lg:w-1/4 p-2 border rounded-lg focus:ring-2 focus:ring-amber-200" />
          </div>
          
          <div className="space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <label className="text-xs font-bold text-slate-700">Total Pesanan (MIKA)</label>
            <input type="number" min="0" required value={pesananMika} onChange={e => setPesananMika(e.target.value)} className="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-amber-200" />
          </div>
          <div className="space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <label className="text-xs font-bold text-slate-700">Total Pesanan (PORSI)</label>
            <input type="number" min="0" required value={pesananPorsi} onChange={e => setPesananPorsi(e.target.value)} className="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-amber-200" />
          </div>
          <div className="space-y-1 bg-amber-50 p-3 rounded-lg border border-amber-100">
            <label className="text-xs font-bold text-amber-800">Total Produksi (MIKA)</label>
            <input type="number" min="0" required value={produksiMika} onChange={e => setProduksiMika(e.target.value)} className="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-amber-200" />
          </div>
          <div className="space-y-1 bg-amber-50 p-3 rounded-lg border border-amber-100">
            <label className="text-xs font-bold text-amber-800">Total Produksi (PORSI)</label>
            <input type="number" min="0" required value={produksiPorsi} onChange={e => setProduksiPorsi(e.target.value)} className="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-amber-200" />
          </div>

          <div className="space-y-1 lg:col-span-4 bg-blue-50 p-4 rounded-lg border border-blue-200 mt-2">
            <label className="text-sm font-bold text-blue-800 flex items-center gap-2"><Package size={16}/> Sisa Stok Freezer Aktual Saat Tutup</label>
            <input type="text" required placeholder="Cth: KOSONG / HABIS, atau Sisa 5 Mika Nori..." value={stokFreezer} onChange={e => setStokFreezer(e.target.value)} className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-400 font-bold bg-white mt-1 uppercase" />
          </div>

          <div className="space-y-1 lg:col-span-2 mt-2">
            <label className="text-sm font-medium text-slate-700">Total Nominal Disetor ke Pusat (Rp)</label>
            {/* INPUT PINTAR RUPIAH */}
            <input type="text" required value={formatRp(nominal)} onChange={e => setNominal(parseRp(e.target.value))} className="w-full p-3 border-2 border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-400 font-bold text-lg text-amber-700" placeholder="Rp 0" />
          </div>
          <div className="space-y-1 lg:col-span-1 mt-2">
            <label className="text-sm font-medium text-slate-700">Tujuan Transfer (Bank)</label>
            <input type="text" list="bank-list" required value={transferDestination} onChange={e => setTransferDestination(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-amber-200 font-bold" />
            <datalist id="bank-list">
               <option value="BCA (WASTAM)" />
               <option value="BRI (WASTAM)" />
            </datalist>
          </div>
          <div className="space-y-1 lg:col-span-1 mt-2">
            <label className="text-sm font-medium text-slate-700">Keterangan Laporan</label>
            <input type="text" placeholder="Opsional..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-amber-200" />
          </div>
          
          <div className="lg:col-span-4 flex justify-end mt-2 pt-4 border-t border-slate-100">
            <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition">Simpan Laporan Harian</button>
          </div>
        </form>
      )}

      {/* FILTER TANGGAL TABEL */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm mt-4">
         <div className="flex items-center gap-2"><Filter size={16} className="text-slate-400"/><span className="text-sm font-bold text-slate-700">Filter Data:</span></div>
         <input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} className="p-1.5 text-sm border rounded focus:ring-2 focus:ring-amber-200" />
         <span className="text-slate-400">-</span>
         <input type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)} className="p-1.5 text-sm border rounded focus:ring-2 focus:ring-amber-200" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-4">
        <table className="w-full text-sm text-left block md:table overflow-x-auto">
          <thead className="bg-amber-50 text-amber-800 text-xs uppercase font-semibold border-b border-amber-100">
            <tr>
              <th className="px-4 py-3 min-w-[120px]">Tanggal Laporan</th>
              <th className="px-4 py-3 text-center bg-slate-50 min-w-[100px]">Pesanan (M/P)</th>
              <th className="px-4 py-3 text-center min-w-[100px]">Produksi (M/P)</th>
              <th className="px-4 py-3 bg-blue-50 text-blue-800 font-bold min-w-[150px]">STOK FREEZER</th>
              <th className="px-4 py-3 text-center min-w-[120px]">Disetor Ke</th>
              <th className="px-4 py-3 text-right min-w-[120px]">Uang Disetor</th>
              <th className="px-4 py-3 text-center min-w-[80px]">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayReports.map((rep) => (
              <tr key={rep.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{formatDate(rep.date)}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">{rep.id}</div>
                </td>
                <td className="px-4 py-3 text-center bg-slate-50/50">
                  <div className="font-bold">{rep.pesananMika}</div>
                  <div className="text-xs text-slate-500">{rep.pesananPorsi} Prs</div>
                </td>
                <td className="px-4 py-3 text-center bg-amber-50/30">
                  <div className="font-bold text-amber-700">{rep.produksiMika}</div>
                  <div className="text-xs text-amber-600">{rep.produksiPorsi} Prs</div>
                </td>
                <td className="px-4 py-3 bg-blue-50/30 font-bold text-blue-700 uppercase">
                  {rep.stokFreezer || '-'}
                </td>
                <td className="px-4 py-3 text-center">
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold tracking-wide">{rep.transferDestination || 'Pusat'}</span>
                </td>
                <td className="px-4 py-3 text-right font-bold text-emerald-600">
                  <div className="text-xs text-slate-400 font-normal mb-0.5">{rep.notes}</div>
                  +{formatRp(rep.nominal)}
                </td>
                <td className="px-4 py-3 text-center">
                    <button onClick={() => requestDelete(rep.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-lg transition" title="Hapus Laporan">
                        <Trash2 size={16} />
                    </button>
                </td>
              </tr>
            ))}
            {displayReports.length === 0 && <tr><td colSpan="7" className="text-center py-12 text-slate-400">Tidak ada laporan ditemukan pada tanggal filter tersebut.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================================
// --- LAYOUT CETAK KHUSUS PRINTER DOT MATRIX EPSON LX-310 ---
// ==========================================================
function PrintInvoiceDotMatrix({ data, onBack }) {
    useEffect(() => {
      const timer = setTimeout(() => { window.print(); }, 500);
      return () => clearTimeout(timer);
    }, []);
  
    return (
      <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: 9.5in 11in; margin: 0; }
          body { margin: 0.5in; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .hide-on-print { display: none !important; }
        }
      `}} />
      <div className="bg-white min-h-screen text-black print:bg-white print:p-0 p-8 w-full max-w-[800px] mx-auto font-mono text-sm" style={{ fontFamily: '"Courier New", Courier, monospace' }}>
        <button onClick={onBack} className="hide-on-print mb-8 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded flex items-center gap-2 font-sans font-medium">
          <ArrowRightLeft size={16} /> Kembali ke Aplikasi
        </button>
  
        <div className="border border-black p-6 print:border-none print:p-0">
          <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
              <div>
                  <h1 className="font-bold text-2xl tracking-widest uppercase mb-2">INVOICE DIMSUM ADITYA</h1>
                  <p className="text-xs leading-tight">Jl. Thamrin, RT.001/RW.003, Ketapang</p>
                  <p className="text-xs leading-tight">Kec. Cipondoh, Kota Tangerang, Banten 15147</p>
                  <p className="text-xs leading-tight">Telp/Wa : 087809020931</p>
              </div>
              <div className="text-right">
                 <h2 className="font-bold text-xl uppercase mt-2">DIMSUM ADITYA</h2>
                 <p className="text-xs">Pusat Produksi</p>
              </div>
          </div>
  
          <div className="flex justify-between items-end mb-6">
              <table className="w-[50%] text-sm">
                  <tbody>
                      <tr>
                          <td className="w-24 pb-1">NO. INVOICE</td><td className="w-4 pb-1">:</td>
                          <td className="font-bold pb-1">{data.id}</td>
                      </tr>
                      <tr>
                          <td className="w-24 pb-1">KEPADA</td><td className="w-4 pb-1">:</td>
                          <td className="font-bold uppercase pb-1">{data.customer}</td>
                      </tr>
                  </tbody>
              </table>
              <table className="w-[40%] text-sm">
                  <tbody>
                      <tr>
                          <td className="w-28 pb-1">TANGGAL</td><td className="w-4 pb-1">:</td>
                          <td className="text-right font-bold pb-1">{formatDate(data.date)}</td>
                      </tr>
                      <tr>
                          <td className="w-28 pb-1">METODE BAYAR</td><td className="w-4 pb-1">:</td>
                          <td className="text-right font-bold pb-1">{data.paymentMethod}</td>
                      </tr>
                  </tbody>
              </table>
          </div>
  
          <table className="w-full border-collapse text-sm mb-4 border border-black">
              <thead>
                  <tr className="border-b border-black">
                      <th className="p-2 border-r border-black text-left w-1/4">KATEGORI</th>
                      <th className="p-2 border-r border-black text-left w-2/5">DESKRIPSI KETERANGAN</th>
                      <th className="p-2 border-r border-black text-center">QTY</th>
                      <th className="p-2 border-r border-black text-right">HARGA (Rp)</th>
                      <th className="p-2 text-right w-1/4">TOTAL (Rp)</th>
                  </tr>
              </thead>
              <tbody>
                  <tr className="border-b border-black border-dashed">
                      <td className="p-2 border-r border-black border-dashed uppercase">{data.category}</td>
                      <td className="p-2 border-r border-black border-dashed uppercase">
                         Pembelian Dimsum {data.notes ? `- ${data.notes}` : ''}
                      </td>
                      <td className="p-2 border-r border-black border-dashed text-center font-bold">{data.qty} PCS</td>
                      <td className="p-2 border-r border-black border-dashed text-right">{formatRp(data.price).replace('Rp', '')}</td>
                      <td className="p-2 text-right font-bold">{formatRp(data.total).replace('Rp', '')}</td>
                  </tr>
                  
                  {[...Array(2)].map((_, i) => (
                      <tr key={i} className="border-b border-black border-dashed">
                          <td className="p-3 border-r border-black border-dashed"></td>
                          <td className="p-3 border-r border-black border-dashed"></td>
                          <td className="p-3 border-r border-black border-dashed"></td>
                          <td className="p-3 border-r border-black border-dashed"></td>
                          <td className="p-3"></td>
                      </tr>
                  ))}
                  
                  <tr className="border-t-2 border-black">
                      <td colSpan="3" className="p-2 border-r border-black border-dashed text-right italic text-xs">
                          {terbilang(data.total)} Rupiah
                      </td>
                      <td className="p-2 border-r border-black border-dashed font-bold text-right">GRAND TOTAL</td>
                      <td className="p-2 text-right font-bold text-lg">{formatRp(data.total)}</td>
                  </tr>
                  {(Number(data.total)||0) > (Number(data.paidAmount)||0) && (
                      <>
                      <tr>
                          <td colSpan="4" className="p-1 border-r border-black border-dashed font-bold text-right text-xs">TELAH DIBAYAR (DP)</td>
                          <td className="p-1 text-right font-bold text-xs">{formatRp(data.paidAmount)}</td>
                      </tr>
                      <tr className="border-t border-black border-dashed">
                          <td colSpan="4" className="p-1.5 border-r border-black border-dashed font-bold text-right uppercase">Sisa Tagihan (Piutang)</td>
                          <td className="p-1.5 text-right font-bold">{formatRp((Number(data.total)||0) - (Number(data.paidAmount)||0))}</td>
                      </tr>
                      </>
                  )}
              </tbody>
          </table>
  
          <div className="flex justify-between items-end mt-12 mb-4">
              <div className="text-center w-48">
                  <div className="border-b border-black border-dashed h-16 mb-1"></div>
                  <div className="text-xs uppercase">PENERIMA / PELANGGAN</div>
              </div>
              <div className="text-center w-48">
                  <div className="text-xs mb-16 text-center italic">Hormat Kami,</div>
                  <div className="border-b border-black border-dashed h-4 mb-1"></div>
                  <div className="text-xs uppercase">DIMSUM ADITYA</div>
              </div>
          </div>
  
          <div className="flex justify-between items-end mt-8 text-[10px] border-t border-black pt-2">
              <div>
                  <p className="font-bold">BCA : 1320552261 (WASTAM) | BRI : 775301006132536 (WASTAM)</p>
                  <p>Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.</p>
              </div>
              <div className="font-bold">WWW.DIMSUMADITYA.ID</div>
          </div>
        </div>
      </div>
      </>
    );
}

// Layout Cetak Rekap Laporan Cabang (KHUSUS PEMALANG) DENGAN TUJUAN TF
function PrintReportBranch({ data, onBack, user }) {
  useEffect(() => {
      const timer = setTimeout(() => { window.print(); }, 500);
      return () => clearTimeout(timer);
  }, []);
  
  const { rekap, dateFrom, dateTo } = data;

  return (
    <>
    <style dangerouslySetInnerHTML={{__html: `
      @media print {
        @page { size: A4 portrait; margin: 0.5in; }
        body { margin: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .hide-on-print { display: none !important; }
      }
    `}} />
    <div className="bg-white min-h-screen text-black print:bg-white print:p-0 p-8 w-full max-w-[800px] mx-auto">
      <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded flex items-center gap-2">
        <ArrowRightLeft size={16} /> Kembali ke Aplikasi
      </button>

      <div className="print:p-0 text-sm font-sans" style={{ fontFamily: 'Arial, sans-serif' }}>
        
        <div className="text-center mb-6 border-b-2 border-black pb-4">
            <h1 className="font-bold text-xl uppercase mt-2">Laporan Operasional {user.name}</h1>
            <p className="text-slate-600">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="border border-black p-3">
                <h3 className="font-bold text-sm border-b border-black pb-1 mb-2">RINGKASAN PENJUALAN CABANG</h3>
                <div className="flex justify-between mb-1"><span>Total Omset Kotor:</span> <span className="font-medium text-emerald-700">{formatRp(rekap.totalPenjualanKotor)}</span></div>
                <div className="flex justify-between mb-1"><span>Total Porsi Terjual:</span> <span className="font-medium text-indigo-700">{rekap.totalPorsi} Prs ({rekap.totalPcs} Pcs)</span></div>
            </div>
            <div className="border border-black p-3">
                <h3 className="font-bold text-sm border-b border-black pb-1 mb-2">RINGKASAN KAS / SETORAN</h3>
                <div className="flex justify-between mb-1"><span>Total Setoran Kas ke Pusat:</span> <span className="font-medium text-blue-700">{formatRp(rekap.setoranKePusat)}</span></div>
                <div className="flex justify-between mb-1"><span>Status Uang Disetor:</span> <span className="font-medium text-slate-500">Full Transfer Bank</span></div>
            </div>
        </div>

        <h3 className="font-bold text-md mb-2 mt-8">A. RINCIAN TRANSAKSI INVOICE CABANG</h3>
        <table className="w-full border-collapse border border-black text-sm text-left mb-8">
          <thead className="bg-gray-100">
              <tr>
                  <th className="border border-black p-2 text-center w-8">NO</th>
                  <th className="border border-black p-2">NO. INVOICE</th>
                  <th className="border border-black p-2">PELANGGAN</th>
                  <th className="border border-black p-2 text-center">METODE BAYAR</th>
                  <th className="border border-black p-2 text-center">QTY (PORSI)</th>
                  <th className="border border-black p-2 text-right">TOTAL OMSET</th>
              </tr>
          </thead>
          <tbody>
              {rekap.listOrders.map((c, i) => (
                  <tr key={i}>
                      <td className="border border-black p-2 text-center">{i + 1}</td>
                      <td className="border border-black p-2 font-mono text-xs">{c.id}</td>
                      <td className="border border-black p-2 font-bold uppercase">{c.customer}</td>
                      <td className="border border-black p-2 text-center">{c.paymentMethod}</td>
                      <td className="border border-black p-2 text-center">{c.qty} Pcs <span className="text-xs">({c.qty/4} Prs)</span></td>
                      <td className="border border-black p-2 text-right font-medium">{formatRp(c.total)}</td>
                  </tr>
              ))}
              {rekap.listOrders.length === 0 && <tr><td colSpan="6" className="border border-black p-4 text-center italic">Tidak ada transaksi.</td></tr>}
          </tbody>
        </table>

        <h3 className="font-bold text-md mb-2 mt-4">B. RINCIAN LAPORAN HARIAN & STOK FREEZER</h3>
        <table className="w-full border-collapse border border-black text-sm text-left mb-8">
            <thead className="bg-gray-100">
                <tr>
                    <th className="border border-black p-2 text-center w-8">NO</th>
                    <th className="border border-black p-2">TANGGAL</th>
                    <th className="border border-black p-2 text-center">PRODUKSI / PESANAN</th>
                    <th className="border border-black p-2">STOK FREEZER AKHIR</th>
                    <th className="border border-black p-2 text-center">TUJUAN TF</th>
                    <th className="border border-black p-2 text-right">UANG DISETOR</th>
                </tr>
            </thead>
            <tbody>
                {rekap.listReports.map((p, i) => (
                    <tr key={i}>
                        <td className="border border-black p-2 text-center">{i + 1}</td>
                        <td className="border border-black p-2">{formatDate(p.date)}</td>
                        <td className="border border-black p-2 text-center">
                            {p.produksiMika} M / {p.pesananMika} M
                        </td>
                        <td className="border border-black p-2 font-bold uppercase">{p.stokFreezer}</td>
                        <td className="border border-black p-2 text-center font-bold">{p.transferDestination || 'BCA (WASTAM)'}</td>
                        <td className="border border-black p-2 text-right font-bold text-emerald-700">{formatRp(p.nominal)}</td>
                    </tr>
                ))}
                {rekap.listReports.length === 0 && <tr><td colSpan="6" className="border border-black p-4 text-center italic">Tidak ada laporan harian.</td></tr>}
            </tbody>
        </table>

        <div className="flex justify-end mt-12">
            <div className="text-center w-48">
                <div className="text-sm mb-12 text-center">Dicetak oleh,</div>
                <div className="border-b border-dotted border-black h-4 mb-1"></div>
                <div className="text-xs uppercase">Admin {user.name}</div>
                <div className="text-xs italic text-gray-500 mt-1">{formatDate(new Date())}</div>
            </div>
        </div>
      </div>
    </div>
    </>
  );
}

function PrintVoucher({ data, onBack }) {
    useEffect(() => {
        const timer = setTimeout(() => { window.print(); }, 500);
        return () => clearTimeout(timer);
    }, []);
    return (
      <>
      <style dangerouslySetInnerHTML={{__html: `@media print { @page { size: A4 portrait; margin: 0.5in; } body { margin: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .hide-on-print { display: none !important; } }`}} />
      <div className="bg-white min-h-screen text-black print:bg-white print:p-0 p-8 w-full max-w-[800px] mx-auto">
        <button onClick={onBack} className="print:hidden mb-4 bg-slate-800 text-white px-4 py-2 rounded flex items-center gap-2"><ArrowRightLeft size={16} /> Kembali</button>
        <div className="p-8 border border-slate-200 print:border-none print:p-0 text-sm font-sans" style={{ fontFamily: 'Arial, sans-serif' }}>
          <div className="flex justify-between items-center mb-8"><h1 className="font-bold text-xl uppercase">BUKTI PENGELUARAN KAS - DIMSUM ADITYA</h1></div>
          <div className="flex justify-between items-end mb-6">
              <table className="w-[50%] text-sm"><tbody>
                      <tr><td className="font-bold w-24 pb-2">ID Voucher</td><td className="w-4 pb-2">:</td><td className="border-b border-dotted border-black pb-2">{data.id}</td></tr>
                      <tr><td className="font-bold w-24 pb-2">Kepada</td><td className="w-4 pb-2">:</td><td className="border-b border-dotted border-black pb-2 uppercase">{data.recipient}</td></tr>
              </tbody></table>
              <table className="w-[35%] text-sm"><tbody>
                      <tr><td className="font-bold w-20 pb-2">Tanggal</td><td className="w-4 pb-2">:</td><td className="border-b border-dotted border-black text-right pb-2">{formatDate(data.date)}</td></tr>
                      <tr><td className="font-bold w-20 pb-2">Metode</td><td className="w-4 pb-2">:</td><td className="border-b border-dotted border-black text-right pb-2">{data.paymentMethod}</td></tr>
              </tbody></table>
          </div>
          <table className="w-full border-collapse border border-black text-center mb-2 text-sm">
              <thead><tr><th className="border border-black p-2 bg-gray-50 w-1/4">KATEGORI</th><th className="border border-black p-2 bg-gray-50 w-2/5">KETERANGAN</th><th className="border border-black p-2 bg-gray-50 w-16">QTY</th><th className="border border-black p-2 bg-gray-50">HARGA</th><th className="border border-black p-2 bg-gray-50">TOTAL (KAS KELUAR)</th></tr></thead>
              <tbody><tr><td className="border border-black p-2">{data.category}</td><td className="border border-black p-2 uppercase">{data.description}</td><td className="border border-black p-2">{data.qty}</td><td className="border border-black p-2">{formatRp(data.price)}</td><td className="border border-black p-2 font-bold">{formatRp(data.total)}</td></tr></tbody>
          </table>
          <div className="italic text-sm font-serif mb-16 pt-2">TERBILANG : {terbilang(data.total)} Rupiah</div>
          <div className="flex justify-between items-end mb-4">
              <div className="text-center w-48 mt-12"><div className="border-b border-dotted border-black h-8 mb-1"></div><div className="text-xs">Penerima / Pelanggan</div></div>
              <div className="text-center w-48"><div className="text-sm mb-16 text-left italic">Hormat kami,</div><div className="border-b border-dotted border-black h-4 mb-1"></div><div className="text-xs">Admin / Kasir</div></div>
          </div>
        </div>
      </div>
      </>
    );
}

function PrintReceipt({ data, onBack }) {
    useEffect(() => {
        const timer = setTimeout(() => { window.print(); }, 500);
        return () => clearTimeout(timer);
    }, []);
    const { payment, order } = data;
    return (
      <>
      <style dangerouslySetInnerHTML={{__html: `@media print { @page { size: A4 portrait; margin: 0.5in; } body { margin: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .hide-on-print { display: none !important; } }`}} />
      <div className="bg-white min-h-screen text-black print:bg-white print:p-0 p-8 w-full max-w-[800px] mx-auto">
        <button onClick={onBack} className="print:hidden mb-4 bg-slate-800 text-white px-4 py-2 rounded flex items-center gap-2"><ArrowRightLeft size={16} /> Kembali</button>
        <div className="p-8 border border-slate-200 print:border-none print:p-0 text-sm font-sans" style={{ fontFamily: 'Arial, sans-serif' }}>
          <div className="flex justify-between items-center mb-10"><h1 className="font-bold text-xl uppercase border-b-2 border-black pb-2 inline-block">BUKTI PEMBAYARAN PIUTANG / CICILAN</h1></div>
          <div className="space-y-4 text-base">
              <div className="flex"><div className="w-48 font-bold">ID Pembayaran</div><div className="w-4">:</div><div className="font-mono font-medium">{payment.id}</div></div>
              <div className="flex"><div className="w-48 font-bold">Tanggal Pembayaran</div><div className="w-4">:</div><div>{formatDate(payment.date)}</div></div>
              <div className="flex"><div className="w-48 font-bold">Telah Diterima Dari</div><div className="w-4">:</div><div className="uppercase font-bold border-b border-dotted border-black flex-1">{order.customer}</div></div>
              <div className="flex"><div className="w-48 font-bold">Metode Bayar</div><div className="w-4">:</div><div className="font-bold">{payment.paymentMethod}</div></div>
              <div className="flex items-center"><div className="w-48 font-bold">Sejumlah Uang</div><div className="w-4">:</div><div className="font-bold text-lg bg-gray-100 px-4 py-1 border border-black inline-block">{formatRp(payment.amount)}</div></div>
              <div className="flex"><div className="w-48 font-bold">Terbilang</div><div className="w-4">:</div><div className="italic font-serif flex-1 capitalize border-b border-dotted border-black">{terbilang(payment.amount)} Rupiah</div></div>
              <div className="flex"><div className="w-48 font-bold">Untuk Pembayaran</div><div className="w-4">:</div><div className="flex-1">Cicilan / Pelunasan tagihan untuk No. Invoice: <strong>{order.id}</strong></div></div>
          </div>
          <div className="mt-16 flex justify-between items-end">
              <div className="text-sm p-4 border border-black bg-gray-50"><p className="font-bold mb-1">Informasi Invoice (Referensi):</p><p>Total Tagihan Awal : {formatRp(order.total)}</p><p>Sisa Hutang Terakhir : {formatRp(order.sisaHutang)}</p></div>
              <div className="text-center w-48"><div className="text-sm mb-16 text-left italic">Penerima (Kasir),</div><div className="border-b border-dotted border-black h-4 mb-1"></div><div className="text-xs uppercase text-center">Dimsum Aditya</div></div>
          </div>
        </div>
      </div>
      </>
    );
}

function PrintReport({ data, onBack }) {
    useEffect(() => {
        const timer = setTimeout(() => { window.print(); }, 500);
        return () => clearTimeout(timer);
    }, []);
    const { rekap, dateFrom, dateTo } = data;
    return (
      <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4 portrait; margin: 0.5in; }
          body { margin: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .hide-on-print { display: none !important; }
        }
      `}} />
      <div className="bg-white min-h-screen text-black print:bg-white print:p-0 p-8 w-full max-w-[800px] mx-auto">
        <button onClick={onBack} className="hide-on-print mb-4 bg-slate-800 text-white px-4 py-2 rounded flex items-center gap-2"><ArrowRightLeft size={16} /> Kembali ke Aplikasi</button>
        <div className="print:p-0 text-sm font-sans" style={{ fontFamily: 'Arial, sans-serif' }}>
          <div className="text-center mb-6 border-b-2 border-black pb-4"><h1 className="font-bold text-xl uppercase mt-2">Laporan Keuangan & Penjualan</h1><p className="text-slate-600">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p></div>
          <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="border border-black p-3"><h3 className="font-bold text-sm border-b border-black pb-1 mb-2">RINGKASAN SALDO KAS & BANK</h3><div className="flex justify-between mb-1"><span>Saldo Tunai Bersih (CASH):</span> <span className="font-medium text-emerald-700">{formatRp(rekap.saldoCash)}</span></div><div className="flex justify-between mb-1"><span>Saldo Rekening Bersih (TF):</span> <span className="font-medium text-indigo-700">{formatRp(rekap.saldoTF)}</span></div><div className="flex justify-between pt-1 border-t border-dotted border-black mt-1"><span className="font-bold">TOTAL SALDO AKTUAL:</span> <span className="font-bold text-blue-700">{formatRp(rekap.saldoAkhir)}</span></div></div>
              <div className="border border-black p-3"><h3 className="font-bold text-sm border-b border-black pb-1 mb-2">RINGKASAN OMSET & PIUTANG</h3><div className="flex justify-between mb-1"><span>Total Penjualan Kotor:</span> <span className="font-medium">{formatRp(rekap.totalPenjualanKotor)}</span></div><div className="flex justify-between mb-1"><span>Total Porsi Terjual:</span> <span className="font-medium">{rekap.totalPorsi} Porsi</span></div><div className="flex justify-between mb-1"><span>Total Piutang Berjalan:</span> <span className="font-medium text-red-600">{formatRp(rekap.totalPiutangBaru)}</span></div></div>
          </div>
          <h3 className="font-bold text-md mb-2 mt-8">A. RINCIAN TRANSAKSI & OMSET PENJUALAN (PUSAT)</h3>
          <table className="w-full border-collapse border border-black text-sm text-left mb-8">
            <thead className="bg-gray-100"><tr><th className="border border-black p-2 text-center w-8">NO</th><th className="border border-black p-2">NO. INVOICE</th><th className="border border-black p-2">PELANGGAN</th><th className="border border-black p-2">KATEGORI</th><th className="border border-black p-2">VIA (METODE)</th><th className="border border-black p-2 text-center">QTY (PORSI)</th><th className="border border-black p-2 text-right">TOTAL OMSET</th></tr></thead>
            <tbody>
                {rekap.listTransaksiDetail.map((c, i) => (
                    <tr key={i}><td className="border border-black p-2 text-center">{i + 1}</td><td className="border border-black p-2 font-mono text-xs">{c.id}</td><td className="border border-black p-2 font-bold uppercase">{c.customer}</td><td className="border border-black p-2">{c.category}</td><td className="border border-black p-2">{c.paymentMethod}</td><td className="border border-black p-2 text-center">{c.qty} Pcs <span className="text-xs">({c.qty/4} Prs)</span></td><td className="border border-black p-2 text-right font-medium">{formatRp(c.total)}</td></tr>
                ))}
                {rekap.listTransaksiDetail.length === 0 && <tr><td colSpan="7" className="border border-black p-4 text-center italic">Tidak ada transaksi.</td></tr>}
            </tbody>
          </table>
          {rekap.listPiutangBerjalanLaporan.length > 0 && (
              <>
                  <h3 className="font-bold text-md mb-2 mt-4">B. DAFTAR PIUTANG BERJALAN SAAT INI (BELUM LUNAS)</h3>
                  <table className="w-full border-collapse border border-black text-sm text-left mb-8">
                      <thead className="bg-gray-100"><tr><th className="border border-black p-2 text-center w-8">NO</th><th className="border border-black p-2">NO. INVOICE / TANGGAL</th><th className="border border-black p-2">PELANGGAN</th><th className="border border-black p-2 text-center">PESANAN</th><th className="border border-black p-2 text-right">TOTAL TAGIHAN</th><th className="border border-black p-2 text-right">TELAH DIBAYAR</th><th className="border border-black p-2 text-right text-red-600">SISA HUTANG</th></tr></thead>
                      <tbody>
                          {rekap.listPiutangBerjalanLaporan.map((o, i) => (
                              <tr key={i}><td className="border border-black p-2 text-center">{i + 1}</td><td className="border border-black p-2"><div className="font-mono text-xs font-bold">{o.id}</div><div className="text-xs text-gray-600">{formatDate(o.date)}</div></td><td className="border border-black p-2 font-bold uppercase">{o.customer}</td><td className="border border-black p-2 text-center">{o.qty} Pcs <span className="text-xs">({o.qty/4} Prs)</span></td><td className="border border-black p-2 text-right font-medium">{formatRp(o.total)}</td><td className="border border-black p-2 text-right text-emerald-600">{formatRp((Number(o.paidAmount)||0) + (Number(o.cicilanTerbayar)||0))}</td><td className="border border-black p-2 text-right font-bold text-red-600">{formatRp(o.sisaHutang)}</td></tr>
                          ))}
                      </tbody>
                  </table>
              </>
          )}
          {rekap.listPembayaranPiutang.length > 0 && (
              <>
                  <h3 className="font-bold text-md mb-2 mt-4">C. RINCIAN UANG MASUK DARI CICILAN PIUTANG (PERIODE INI)</h3>
                  <table className="w-full border-collapse border border-black text-sm text-left mb-8">
                      <thead className="bg-gray-100"><tr><th className="border border-black p-2 text-center w-8">NO</th><th className="border border-black p-2">TANGGAL</th><th className="border border-black p-2">ID PEMBAYARAN</th><th className="border border-black p-2">REF. INVOICE</th><th className="border border-black p-2">PELANGGAN</th><th className="border border-black p-2">VIA</th><th className="border border-black p-2 text-right">NOMINAL MASUK</th><th className="border border-black p-2 text-center">STATUS NOTA</th></tr></thead>
                      <tbody>
                          {rekap.listPembayaranPiutang.map((p, i) => (
                              <tr key={i}>
                                <td className="border border-black p-2 text-center">{i + 1}</td>
                                <td className="border border-black p-2">{formatDate(p.date)}</td>
                                <td className="border border-black p-2 font-mono text-xs">{p.id}</td>
                                <td className="border border-black p-2 font-mono text-xs font-bold">{p.orderId}</td>
                                <td className="border border-black p-2 font-bold uppercase">{p.customer}</td>
                                <td className="border border-black p-2">{p.paymentMethod}</td>
                                <td className="border border-black p-2 text-right font-bold">{formatRp(p.amount)}</td>
                                <td className="border border-black p-2 text-center text-[10px] font-bold">
                                    {p.statusNota === 'LUNAS' ? <span className="text-emerald-600">LUNAS</span> : <span className="text-red-600">BELUM LUNAS</span>}
                                </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </>
          )}
          {rekap.listPemalang.length > 0 && (
              <>
                  <h3 className="font-bold text-md mb-2 mt-4">D. RINCIAN LAPORAN & SETORAN CABANG PEMALANG</h3>
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

// --- MICRO COMPONENTS ---
function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 ${active ? 'bg-red-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
      <div className="flex items-center gap-3">{icon}<span className="font-medium text-sm">{label}</span></div>
      {badge > 0 && <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{badge}</span>}
    </button>
  );
}

function StatCard({ title, amount, icon, color }) {
  return (
    <div className={`p-5 rounded-xl border flex flex-col justify-between ${color}`}>
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-medium text-sm opacity-90">{title}</h3>
        <div className="p-2 bg-white/50 rounded-lg backdrop-blur-sm">{icon}</div>
      </div>
      <div className="text-2xl font-bold tracking-tight">{formatRp(amount)}</div>
    </div>
  );
}
