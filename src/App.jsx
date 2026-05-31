import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Wallet, CreditCard, 
  Plus, Printer, Search, ChevronDown, CheckCircle, 
  Clock, X, FileText, ArrowRightLeft, Trash2, Calendar,
  Store, Coins, Loader2, Menu
} from 'lucide-react';

// === GANTI URL DI BAWAH INI DENGAN URL WEB APP GOOGLE SCRIPT ANDA ===
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyqCaTepk_duXguiOqSM572mbUIGozcghhh8LHNMNw2e83O7Wkyu-SkjdVTO3zpTb64PA/exec';
// =====================================================================

// --- UTILITIES ---
const formatRp = (angka) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
};

const formatDate = (date) => {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date));
};

const generateId = (prefix, date) => {
  const d = new Date(date || Date.now());
  const mmyy = `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getFullYear()).slice(-2)}`;
  const seq = String(Math.floor(Math.random() * 9000) + 1000); // 4 digit random
  return `${prefix}-DMA-${mmyy}-${seq}`;
};

const terbilang = (angka) => {
  const bilangan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  if (angka < 12) return bilangan[angka];
  if (angka < 20) return terbilang(angka - 10) + ' Belas';
  if (angka < 100) return terbilang(Math.floor(angka / 10)) + ' Puluh ' + terbilang(angka % 10);
  if (angka < 200) return 'Seratus ' + terbilang(angka - 100);
  if (angka < 1000) return terbilang(Math.floor(angka / 100)) + ' Ratus ' + terbilang(angka % 100);
  if (angka < 2000) return 'Seribu ' + terbilang(angka - 1000);
  if (angka < 1000000) return terbilang(Math.floor(angka / 1000)) + ' Ribu ' + terbilang(angka % 1000);
  if (angka < 1000000000) return terbilang(Math.floor(angka / 1000000)) + ' Juta ' + terbilang(angka % 1000000);
  return 'Lebih dari semilyar';
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
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [printData, setPrintData] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // State Mobile Menu
  
  // State Data Master
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [piutangPayments, setPiutangPayments] = useState([]);
  const [pemalangReports, setPemalangReports] = useState([]);

  // --- 1. TARIK DATA DARI GOOGLE SPREADSHEET ---
  useEffect(() => {
    setIsLoading(true);
    fetch(`${SCRIPT_URL}?action=getAll`)
      .then(res => res.json())
      .then(data => {
        const parseNum = (val) => Number(val) || 0;
        const sortDesc = (arr) => arr.sort((a,b) => new Date(b.date) - new Date(a.date));

        setOrders(sortDesc((data.orders || []).map(o => ({...o, qty: parseNum(o.qty), price: parseNum(o.price), total: parseNum(o.total), paidAmount: parseNum(o.paidAmount)}))));
        setExpenses(sortDesc((data.expenses || []).map(e => ({...e, qty: parseNum(e.qty), price: parseNum(e.price), total: parseNum(e.total)}))));
        setPiutangPayments(sortDesc((data.payments || []).map(p => ({...p, amount: parseNum(p.amount)}))));
        setPemalangReports(sortDesc((data.pemalang || []).map(p => ({...p, pesananMika: parseNum(p.pesananMika), pesananPorsi: parseNum(p.pesananPorsi), produksiMika: parseNum(p.produksiMika), produksiPorsi: parseNum(p.produksiPorsi), nominal: parseNum(p.nominal)}))));
        
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Gagal terhubung ke Google Sheets:", err);
        setIsLoading(false);
        if(SCRIPT_URL.includes('ISI_DENGAN_URL_WEB_APP')) {
           alert("Anda belum memasukkan URL Google Script Anda di kode SCRIPT_URL!");
        }
      });
  }, []);

  // --- 2. FUNGSI SIMPAN KE GOOGLE SPREADSHEET (Optimistic UI) ---
  const saveOrder = (data) => {
    setOrders(prev => [data, ...prev].sort((a,b) => new Date(b.date) - new Date(a.date)));
    fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'insert', table: 'orders', data }) }).catch(e=>console.error(e));
  };

  const saveExpense = (data) => {
    setExpenses(prev => [data, ...prev].sort((a,b) => new Date(b.date) - new Date(a.date)));
    fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'insert', table: 'expenses', data }) }).catch(e=>console.error(e));
  };

  const savePayment = (data) => {
    setPiutangPayments(prev => [data, ...prev].sort((a,b) => new Date(b.date) - new Date(a.date)));
    fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'insert', table: 'payments', data }) }).catch(e=>console.error(e));
  };

  const savePemalang = (data) => {
    setPemalangReports(prev => [data, ...prev].sort((a,b) => new Date(b.date) - new Date(a.date)));
    fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'insert', table: 'pemalang', data }) }).catch(e=>console.error(e));
  };

  // --- 3. FUNGSI HAPUS AMAN (SOFT DELETE) ---
  const executeDelete = () => {
    if(!confirmDialog) return;
    const { type, id } = confirmDialog;
    
    let tableName = '';
    if (type === 'order') {
        tableName = 'orders';
        setOrders(orders.filter(o => o.id !== id));
    } else if (type === 'expense') {
        tableName = 'expenses';
        setExpenses(expenses.filter(e => e.id !== id));
    } else if (type === 'payment') {
        tableName = 'payments';
        setPiutangPayments(piutangPayments.filter(p => p.id !== id));
    } else if (type === 'pemalang') {
        tableName = 'pemalang';
        setPemalangReports(pemalangReports.filter(p => p.id !== id));
    }

    if (tableName) {
        fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'delete', table: tableName, id }) }).catch(e=>console.error(e));
    }
    setConfirmDialog(null);
  };

  const daftarPiutangGlobal = useMemo(() => {
    return orders.map(order => {
      const cicilan = piutangPayments.filter(p => p.orderId === order.id).reduce((sum, p) => sum + p.amount, 0);
      const sisa = order.total - order.paidAmount - cicilan;
      return { ...order, sisaHutang: sisa };
    }).filter(order => order.sisaHutang > 0);
  }, [orders, piutangPayments]);

  // Handler Ganti Tab (Otomatis tutup menu di Mobile)
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  }

  if (isLoading) {
      return (
          <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
              <Loader2 className="w-12 h-12 text-red-600 animate-spin mb-4" />
              <h2 className="text-xl font-bold text-slate-800">Menarik Data dari Spreadsheet...</h2>
              <p className="text-slate-500">Mohon tunggu sebentar...</p>
          </div>
      );
  }

  if (printData?.type === 'invoice') return <PrintInvoice data={printData.data} onBack={() => setPrintData(null)} />;
  if (printData?.type === 'voucher') return <PrintVoucher data={printData.data} onBack={() => setPrintData(null)} />;
  if (printData?.type === 'receipt') return <PrintReceipt data={printData.data} onBack={() => setPrintData(null)} />;
  if (printData?.type === 'report') return <PrintReport data={printData.data} onBack={() => setPrintData(null)} />;

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800 overflow-hidden">
      
      {/* Overlay Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Modal Konfirmasi Hapus */}
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

      {/* Sidebar Responsive */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg overflow-hidden p-0.5 shrink-0">
              <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="DA Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Dimsum Aditya</h1>
              <p className="text-xs text-emerald-400 font-bold flex items-center gap-1"><CheckCircle size={10}/> Data Aktif</p>
            </div>
          </div>
          <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}><X size={24}/></button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard & Rekap" active={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} />
          <NavItem icon={<ShoppingCart size={20} />} label="Order & Penjualan" active={activeTab === 'orders'} onClick={() => handleTabChange('orders')} />
          <NavItem icon={<Wallet size={20} />} label="Kas & Pengeluaran" active={activeTab === 'expenses'} onClick={() => handleTabChange('expenses')} />
          <NavItem icon={<Clock size={20} />} label="Piutang / Pending" active={activeTab === 'piutang'} onClick={() => handleTabChange('piutang')} badge={daftarPiutangGlobal.length} />
          <div className="pt-4 mt-2 border-t border-slate-800">
             <NavItem icon={<Store size={20} />} label="Cabang Pemalang" active={activeTab === 'pemalang'} onClick={() => handleTabChange('pemalang')} />
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden w-full relative">
        <header className="bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10 shadow-sm shrink-0 gap-2">
          <div className="flex items-center gap-3 overflow-hidden">
            <button className="md:hidden p-2 bg-slate-100 text-slate-600 rounded-lg shrink-0" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={20} />
            </button>
            <h2 className="text-lg md:text-xl font-bold text-slate-800 capitalize truncate">
              {activeTab === 'dashboard' ? 'Dashboard & Laporan' : activeTab === 'piutang' ? 'Sistem Piutang' : activeTab === 'pemalang' ? 'Setoran Pemalang' : `Manajemen ${activeTab}`}
            </h2>
          </div>
          <div className="text-[10px] sm:text-xs md:text-sm font-medium text-slate-500 bg-slate-100 px-2 sm:px-4 py-1.5 md:py-2 rounded-full border border-slate-200 flex items-center gap-1.5 md:gap-2 shrink-0 whitespace-nowrap">
            <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="hidden sm:inline">{new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date())}</span>
            <span className="sm:hidden">{new Intl.DateTimeFormat('id-ID', { dateStyle: 'short' }).format(new Date())}</span>
          </div>
        </header>

        <div className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-6 bg-slate-50 relative">
          {activeTab === 'dashboard' && <TabDashboard orders={orders} expenses={expenses} piutangPayments={piutangPayments} pemalangReports={pemalangReports} setPrintData={setPrintData} />}
          {activeTab === 'orders' && <TabOrders orders={orders} saveOrder={saveOrder} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'order', id})} />}
          {activeTab === 'expenses' && <TabExpenses expenses={expenses} saveExpense={saveExpense} setPrintData={setPrintData} requestDelete={(id) => setConfirmDialog({type: 'expense', id})} />}
          {activeTab === 'piutang' && <TabPiutang orders={orders} payments={piutangPayments} savePayment={savePayment} requestDelete={(id) => setConfirmDialog({type: 'payment', id})} setPrintData={setPrintData} />}
          {activeTab === 'pemalang' && <TabPemalang reports={pemalangReports} savePemalang={savePemalang} requestDelete={(id) => setConfirmDialog({type: 'pemalang', id})} />}
        </div>
      </main>
    </div>
  );
}

// --- TAB COMPONENTS ---

// 1. TAB ORDERS
function TabOrders({ orders, saveOrder, setPrintData, requestDelete }) {
  const [showForm, setShowForm] = useState(false);
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customer, setCustomer] = useState('');
  const [category, setCategory] = useState('Reseller');
  const [qty, setQty] = useState(100);
  const [price, setPrice] = useState(KATEGORI_HARGA['Reseller']);
  const [total, setTotal] = useState(100 * KATEGORI_HARGA['Reseller']);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState(100 * KATEGORI_HARGA['Reseller']);
  const [notes, setNotes] = useState('');

  const handleCategoryChange = (e) => {
    const newCat = e.target.value;
    setCategory(newCat);
    const newPrice = KATEGORI_HARGA[newCat] || 0;
    setPrice(newPrice);
    const newTotal = qty * newPrice;
    setTotal(newTotal);
    if(paymentMethod !== 'Pending / DP') setPaidAmount(newTotal);
  };

  const handleQtyChange = (e) => {
    const newQty = Number(e.target.value);
    setQty(newQty);
    const newTotal = newQty * price;
    setTotal(newTotal);
    if(paymentMethod !== 'Pending / DP') setPaidAmount(newTotal);
  };

  const handlePriceChange = (e) => {
    const newPrice = Number(e.target.value);
    setPrice(newPrice);
    const newTotal = qty * newPrice;
    setTotal(newTotal);
    if(paymentMethod !== 'Pending / DP') setPaidAmount(newTotal);
  };

  const handleTotalChange = (e) => {
    const customTotal = Number(e.target.value);
    setTotal(customTotal);
    if(paymentMethod !== 'Pending / DP') setPaidAmount(customTotal);
  };

  const handlePaymentMethodChange = (e) => {
    const method = e.target.value;
    setPaymentMethod(method);
    if (method !== 'Pending / DP') {
      setPaidAmount(total); 
    } else {
      setPaidAmount(0); 
    }
  };

  const handleSimpan = (e) => {
    e.preventDefault();
    const newOrder = {
      id: generateId('INV', date),
      date, customer, category, qty, price, total, paymentMethod, paidAmount: Number(paidAmount), notes
    };
    saveOrder(newOrder); 
    setShowForm(false);
    setCustomer(''); setNotes('');
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
           <h3 className="font-bold text-lg text-slate-800">Order & Penjualan (Pusat)</h3>
           <p className="text-sm text-slate-500">Kelola pesanan masuk dan cetak invoice.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition shadow-sm">
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Batal' : 'Buat Invoice Baru'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSimpan} className="bg-white p-4 md:p-6 rounded-xl border border-red-200 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-top-4">
          <div className="lg:col-span-3 mb-2 border-b border-slate-100 pb-2">
              <h4 className="font-bold text-red-800 text-sm flex items-center gap-2"><ShoppingCart size={16}/> Form Input Pesanan</h4>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Tanggal Transaksi</label>
            <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-200" />
          </div>
          <div className="space-y-1 lg:col-span-2">
            <label className="text-sm font-medium text-slate-700">Nama Pelanggan / Agen</label>
            <input type="text" required placeholder="Contoh: Budi, ADE..." value={customer} onChange={e => setCustomer(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-200" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Kategori / Cabang</label>
            <select value={category} onChange={handleCategoryChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-200 font-medium text-red-700 bg-red-50">
              {Object.keys(KATEGORI_HARGA).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Jumlah (Pcs)</label>
            <input type="number" min="1" required value={qty} onChange={handleQtyChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-200" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Harga per Pcs (Rp)</label>
            <input type="number" required value={price} onChange={handlePriceChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-200" />
          </div>

          <div className="space-y-1 bg-amber-50 p-3 rounded-lg border border-amber-200 lg:col-span-3">
            <label className="text-xs font-bold text-amber-800 uppercase">Total Harga (Otomatis / Manual)</label>
            <input type="number" required value={total} onChange={handleTotalChange} className="w-full p-3 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-400 font-bold text-lg bg-white mt-1" />
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
            <input type="number" required value={paidAmount} onChange={e => setPaidAmount(Number(e.target.value))} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-200 font-bold" />
          </div>
          <div className="space-y-1 lg:col-span-3">
            <label className="text-sm font-medium text-slate-700">Catatan Tambahan (Opsional)</label>
            <input type="text" placeholder="Catatan invoice..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-200" />
          </div>
          
          <div className="lg:col-span-3 flex justify-end mt-2 pt-4 border-t border-slate-100">
            <button type="submit" className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition">Simpan ke Spreadsheet</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-4">
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[700px] text-sm text-left">
            <thead className="bg-red-50 text-red-800 text-xs uppercase font-semibold border-b border-red-100">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">No. Invoice & Tgl</th>
                <th className="px-4 py-3 whitespace-nowrap">Pelanggan</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Qty / Kategori</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Metode Bayar</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((ord) => (
                <tr key={ord.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs font-bold text-slate-700">{ord.id}</div>
                    <div className="text-xs text-slate-500">{formatDate(ord.date)}</div>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-800">{ord.customer}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="font-medium">{ord.qty} Pcs</div>
                    <div className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded inline-block">{ord.category}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatRp(ord.total)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded">{ord.paymentMethod}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {ord.total > ord.paidAmount ? (
                      <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold">PIUTANG</span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">LUNAS</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => setPrintData({ type: 'invoice', data: ord })} className="text-slate-600 hover:text-slate-900 bg-slate-100 p-2 rounded-lg transition" title="Cetak Invoice">
                        <Printer size={16} />
                      </button>
                      <button onClick={() => requestDelete(ord.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-lg transition" title="Hapus Data">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan="7" className="text-center py-12 text-slate-400">Database Kosong. Belum ada transaksi.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 2. TAB DASHBOARD
function TabDashboard({ orders, expenses, piutangPayments, pemalangReports, setPrintData }) {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const [dateFrom, setDateFrom] = useState(firstDay.toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(today.toISOString().split('T')[0]);

  const rekap = useMemo(() => {
    const filteredOrders = orders.filter(o => o.date >= dateFrom && o.date <= dateTo);
    const filteredExpenses = expenses.filter(e => e.date >= dateFrom && e.date <= dateTo);
    const filteredPayments = piutangPayments.filter(p => p.date >= dateFrom && p.date <= dateTo);
    const filteredPemalang = pemalangReports.filter(p => p.date >= dateFrom && p.date <= dateTo);

    let penjualanCash = 0, penjualanTF = 0;
    let piutangCash = 0, piutangTF = 0;
    let kasMasukCash = 0, kasMasukTF = 0;
    let kasKeluarCash = 0, kasKeluarTF = 0;
    let setoranPemalangTF = 0;

    let totalPiutangBaru = 0;
    let totalPorsi = 0;
    let totalPcs = 0;

    const breakdownPorsi = {};
    const listTransaksiDetail = [];

    filteredOrders.forEach(order => {
      totalPcs += order.qty;
      const porsiOrder = order.qty / 4; 
      totalPorsi += porsiOrder;
      
      breakdownPorsi[order.category] = (breakdownPorsi[order.category] || 0) + porsiOrder;
      
      listTransaksiDetail.push({
          id: order.id,
          date: order.date,
          customer: order.customer,
          category: order.category,
          paymentMethod: order.paymentMethod,
          qty: order.qty,
          porsi: porsiOrder,
          omset: order.total
      });

      if (order.paymentMethod === 'Cash') penjualanCash += order.paidAmount;
      else if (order.paymentMethod === 'Transfer' || order.paymentMethod === 'Pending / DP') penjualanTF += order.paidAmount; 

      const sisaHutang = order.total - order.paidAmount;
      if (sisaHutang > 0) totalPiutangBaru += sisaHutang;
    });

    filteredExpenses.forEach(e => {
        if (e.type === 'IN') {
            if (e.paymentMethod === 'Cash') kasMasukCash += e.total;
            else kasMasukTF += e.total;
        } else {
            if (e.paymentMethod === 'Cash') kasKeluarCash += e.total;
            else kasKeluarTF += e.total;
        }
    });

    const listPembayaranPiutang = [];
    filteredPayments.forEach(pay => {
      if (pay.paymentMethod === 'Cash') piutangCash += pay.amount;
      else piutangTF += pay.amount;
      
      const orderAsli = orders.find(o => o.id === pay.orderId);
      listPembayaranPiutang.push({
          id: pay.id,
          date: pay.date,
          invoiceId: pay.orderId,
          customer: orderAsli ? orderAsli.customer : 'Tidak Diketahui',
          amount: pay.amount,
          method: pay.paymentMethod
      });
    });

    let totalPorsiPemalang = 0;
    filteredPemalang.forEach(p => {
        setoranPemalangTF += p.nominal;
        totalPorsiPemalang += p.produksiPorsi;
    });

    const totalPenjualanKotor = filteredOrders.reduce((acc, curr) => acc + curr.total, 0);
    const saldoCash = (kasMasukCash + penjualanCash + piutangCash) - kasKeluarCash;
    const saldoTF = (kasMasukTF + penjualanTF + piutangTF + setoranPemalangTF) - kasKeluarTF;
    const saldoAkhir = saldoCash + saldoTF;

    const listPiutangBerjalanLaporan = orders.map(order => {
        const cicilan = piutangPayments.filter(p => p.orderId === order.id).reduce((sum, p) => sum + p.amount, 0);
        const sisa = order.total - order.paidAmount - cicilan;
        return { ...order, cicilanTerbayar: cicilan, sisaHutang: sisa };
    }).filter(order => order.sisaHutang > 0);

    return {
      penjualanCash, piutangCash, kasMasukCash, kasKeluarCash, saldoCash,
      penjualanTF, piutangTF, kasMasukTF, kasKeluarTF, setoranPemalangTF, saldoTF,
      saldoAkhir, totalPenjualanKotor, totalPiutangBaru,
      totalPorsi, totalPcs, breakdownPorsi,
      listTransaksiDetail, listPembayaranPiutang, listPemalang: filteredPemalang,
      listPiutangBerjalanLaporan
    };
  }, [orders, expenses, piutangPayments, pemalangReports, dateFrom, dateTo]);

  const handleCetakLaporan = () => {
      setPrintData({ type: 'report', data: { rekap, dateFrom, dateTo } });
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="w-full md:w-auto">
              <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Calendar size={16}/> Filter Periode Laporan</h3>
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full sm:w-auto p-2 text-sm border rounded-lg focus:ring-2 focus:ring-slate-300" />
                  <span className="text-slate-400 hidden sm:inline">s/d</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full sm:w-auto p-2 text-sm border rounded-lg focus:ring-2 focus:ring-slate-300" />
              </div>
          </div>
          <button onClick={handleCetakLaporan} className="w-full md:w-auto bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition shadow-sm">
              <Printer size={16} /> Cetak Laporan
          </button>
      </div>

      <div>
          <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2"><Wallet size={20}/> Status Saldo Aktual</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <StatCard title="Total Saldo Keseluruhan" amount={rekap.saldoAkhir} icon={<Wallet />} color="bg-blue-50 text-blue-700 border-blue-200" />
              <StatCard title="Saldo Tunai (CASH)" amount={rekap.saldoCash} icon={<Coins />} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
              <StatCard title="Saldo Rekening (TRANSFER)" amount={rekap.saldoTF} icon={<CreditCard />} color="bg-indigo-50 text-indigo-700 border-indigo-200" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Breakdown Arus Kas CASH */}
              <div className="bg-white p-4 md:p-6 rounded-xl border border-emerald-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                  <h3 className="font-bold text-base md:text-lg mb-4 flex items-center gap-2 text-emerald-800"><Coins size={20} /> Arus Kas Tunai (Cash)</h3>
                  <div className="space-y-3 text-xs md:text-sm">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="text-slate-600">Terima Penjualan Langsung (Cash)</span>
                          <span className="font-bold text-emerald-600">+{formatRp(rekap.penjualanCash)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="text-slate-600">Terima Pelunasan Piutang (Cash)</span>
                          <span className="font-bold text-emerald-600">+{formatRp(rekap.piutangCash)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="text-slate-600">Modal / Kas Masuk Lainnya (Cash)</span>
                          <span className="font-bold text-emerald-600">+{formatRp(rekap.kasMasukCash)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100 text-red-600">
                          <span>Kas Keluar (Beban Tunai)</span>
                          <span className="font-bold">-{formatRp(rekap.kasKeluarCash)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 text-emerald-800">
                          <span className="font-bold">TOTAL SALDO CASH BERSIH</span>
                          <span className="font-bold text-base md:text-lg">{formatRp(rekap.saldoCash)}</span>
                      </div>
                  </div>
              </div>

              {/* Breakdown Arus Kas TRANSFER */}
              <div className="bg-white p-4 md:p-6 rounded-xl border border-indigo-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                  <h3 className="font-bold text-base md:text-lg mb-4 flex items-center gap-2 text-indigo-800"><CreditCard size={20} /> Arus Kas Bank (Transfer)</h3>
                  <div className="space-y-3 text-xs md:text-sm">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="text-slate-600">Terima Penjualan Langsung (TF)</span>
                          <span className="font-bold text-indigo-600">+{formatRp(rekap.penjualanTF)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="text-slate-600">Terima Pelunasan Piutang (TF)</span>
                          <span className="font-bold text-indigo-600">+{formatRp(rekap.piutangTF)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="text-slate-600">Modal / Kas Masuk Lainnya (TF)</span>
                          <span className="font-bold text-indigo-600">+{formatRp(rekap.kasMasukTF)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="font-medium text-amber-700">Setoran Pemalang (Otomatis TF)</span>
                          <span className="font-bold text-amber-600">+{formatRp(rekap.setoranPemalangTF)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100 text-red-600">
                          <span>Kas Keluar (Beban Transfer)</span>
                          <span className="font-bold">-{formatRp(rekap.kasKeluarTF)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 text-indigo-800">
                          <span className="font-bold">TOTAL SALDO TRANSFER BERSIH</span>
                          <span className="font-bold text-base md:text-lg">{formatRp(rekap.saldoTF)}</span>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><ShoppingCart size={20} className="text-slate-500"/> Ringkasan Penjualan Porsi</h3>
            <div className="mb-4">
                <span className="text-4xl font-bold text-red-600">{rekap.totalPorsi}</span>
                <span className="text-slate-500 ml-2 font-medium">Porsi Terjual</span>
                <div className="text-xs text-slate-400 mt-1">(Total {rekap.totalPcs} Pcs. 1 Porsi = 4 Pcs)</div>
            </div>
            <div className="space-y-3">
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
                {Object.keys(rekap.breakdownPorsi).length === 0 && (
                    <div className="text-sm text-slate-400 italic">Belum ada data penjualan.</div>
                )}
            </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><FileText size={20} className="text-slate-500"/> Informasi Omset & Piutang</h3>
            <div className="space-y-4 text-sm md:text-base">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-600">Total Omset Penjualan Kotor</span>
                    <span className="font-bold text-base md:text-lg">{formatRp(rekap.totalPenjualanKotor)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-100">
                    <span className="text-red-600 font-medium">Piutang Baru (Periode ini)</span>
                    <span className="font-bold text-red-700 text-base md:text-lg">{formatRp(rekap.totalPiutangBaru)}</span>
                </div>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6 w-full">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-800">Detail Transaksi & Omset Penjualan (Pusat)</h3>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[700px] text-sm text-left">
              <thead className="bg-white text-slate-500 text-xs uppercase font-semibold border-b">
                  <tr>
                      <th className="px-6 py-3 whitespace-nowrap">No. Invoice</th>
                      <th className="px-6 py-3 whitespace-nowrap">Pelanggan</th>
                      <th className="px-6 py-3 whitespace-nowrap">Metode Bayar</th>
                      <th className="px-6 py-3 text-center whitespace-nowrap">Jumlah Pcs (Porsi)</th>
                      <th className="px-6 py-3 text-right whitespace-nowrap">Total Omset</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                  {rekap.listTransaksiDetail.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                          <td className="px-6 py-3 font-mono text-xs text-slate-500">{c.id}</td>
                          <td className="px-6 py-3 font-bold text-slate-800">
                              {c.customer} <span className="text-red-600 text-[10px] font-medium ml-1 bg-red-50 px-2 py-0.5 rounded">{c.category}</span>
                          </td>
                          <td className="px-6 py-3 font-medium text-slate-600">{c.paymentMethod}</td>
                          <td className="px-6 py-3 text-center font-medium">{c.qty} Pcs <span className="text-slate-400 text-xs">({c.porsi} Porsi)</span></td>
                          <td className="px-6 py-3 text-right font-bold text-emerald-600">{formatRp(c.omset)}</td>
                      </tr>
                  ))}
                  {rekap.listTransaksiDetail.length === 0 && (
                      <tr><td colSpan="5" className="text-center py-8 text-slate-400">Tidak ada transaksi di rentang tanggal ini</td></tr>
                  )}
              </tbody>
          </table>
        </div>
      </div>

      {rekap.listPembayaranPiutang.length > 0 && (
          <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-hidden mt-6">
            <div className="p-4 border-b border-orange-200 bg-orange-50 flex items-center gap-2">
                <Clock className="text-orange-600" size={18}/>
                <h3 className="font-bold text-orange-800">Rincian Uang Masuk dari Pelunasan/Cicilan Piutang</h3>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[700px] text-sm text-left">
                  <thead className="bg-white text-slate-500 text-xs uppercase font-semibold border-b">
                      <tr>
                          <th className="px-6 py-3 whitespace-nowrap">Tanggal Bayar</th>
                          <th className="px-6 py-3 whitespace-nowrap">ID Pembayaran</th>
                          <th className="px-6 py-3 whitespace-nowrap">Ref. Invoice</th>
                          <th className="px-6 py-3 whitespace-nowrap">Pelanggan</th>
                          <th className="px-6 py-3 text-center whitespace-nowrap">Via</th>
                          <th className="px-6 py-3 text-right whitespace-nowrap">Nominal Masuk</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {rekap.listPembayaranPiutang.map((p, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                              <td className="px-6 py-3 font-medium">{formatDate(p.date)}</td>
                              <td className="px-6 py-3 font-mono text-xs text-slate-500">{p.id}</td>
                              <td className="px-6 py-3 font-mono text-xs font-bold text-slate-700">{p.invoiceId}</td>
                              <td className="px-6 py-3 font-bold">{p.customer}</td>
                              <td className="px-6 py-3 text-center text-xs font-medium text-slate-500">{p.method}</td>
                              <td className="px-6 py-3 text-right font-bold text-orange-600">{formatRp(p.amount)}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
            </div>
          </div>
      )}

      {rekap.listPemalang.length > 0 && (
          <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden mt-6">
            <div className="p-4 border-b border-amber-200 bg-amber-50 flex items-center gap-2">
                <Store className="text-amber-600" size={18}/>
                <h3 className="font-bold text-amber-800">Rincian Setoran Cabang Pemalang (Otomatis TF)</h3>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[700px] text-sm text-left">
                  <thead className="bg-white text-slate-500 text-xs uppercase font-semibold border-b">
                      <tr>
                          <th className="px-6 py-3 whitespace-nowrap">Tanggal</th>
                          <th className="px-6 py-3 text-center whitespace-nowrap">Total Pesanan</th>
                          <th className="px-6 py-3 text-center whitespace-nowrap">Total Produksi</th>
                          <th className="px-6 py-3 whitespace-nowrap">Keterangan</th>
                          <th className="px-6 py-3 text-right whitespace-nowrap">Uang Disetor (TF)</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {rekap.listPemalang.map((p, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                              <td className="px-6 py-3 font-medium">{formatDate(p.date)}</td>
                              <td className="px-6 py-3 text-center font-medium">{p.pesananMika} Mika <span className="text-slate-400 text-xs">({p.pesananPorsi} Prs)</span></td>
                              <td className="px-6 py-3 text-center font-medium">{p.produksiMika} Mika <span className="text-slate-400 text-xs">({p.produksiPorsi} Prs)</span></td>
                              <td className="px-6 py-3 text-slate-600">{p.notes}</td>
                              <td className="px-6 py-3 text-right font-bold text-amber-600">{formatRp(p.nominal)}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
            </div>
          </div>
      )}
    </div>
  );
}

// 3. TAB CABANG PEMALANG
function TabPemalang({ reports, savePemalang, requestDelete }) {
  const [showForm, setShowForm] = useState(false);
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [pesananMika, setPesananMika] = useState(0);
  const [pesananPorsi, setPesananPorsi] = useState(0);
  const [produksiMika, setProduksiMika] = useState(0);
  const [produksiPorsi, setProduksiPorsi] = useState(0);
  const [nominal, setNominal] = useState(0);
  const [notes, setNotes] = useState('');

  const handleSimpan = (e) => {
    e.preventDefault();
    const newReport = {
      id: generateId('PML', date),
      date, 
      pesananMika: Number(pesananMika), pesananPorsi: Number(pesananPorsi),
      produksiMika: Number(produksiMika), produksiPorsi: Number(produksiPorsi),
      nominal: Number(nominal), notes
    };
    savePemalang(newReport);
    setShowForm(false);
    setPesananMika(0); setPesananPorsi(0); setProduksiMika(0); setProduksiPorsi(0); setNominal(0); setNotes('');
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
           <h3 className="font-bold text-lg text-slate-800">Laporan & Setoran Pemalang</h3>
           <p className="text-sm text-slate-500">Pencatatan produksi harian dan uang TF dari Pemalang.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition shadow-sm">
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Batal' : 'Input Laporan Baru'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSimpan} className="bg-white p-4 md:p-6 rounded-xl border border-amber-200 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-4">
          <div className="lg:col-span-4 mb-2 border-b border-slate-100 pb-2">
              <h4 className="font-bold text-amber-800 text-sm flex items-center gap-2"><Store size={16}/> Form Input Cabang Pemalang</h4>
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

          <div className="space-y-1 lg:col-span-2 mt-2">
            <label className="text-sm font-medium text-slate-700">Total Nominal Disetor ke Pusat (Rp)</label>
            <input type="number" min="0" required value={nominal} onChange={e => setNominal(Number(e.target.value))} className="w-full p-3 border-2 border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-400 font-bold text-lg text-amber-700" placeholder="Rp 0" />
            <p className="text-xs text-amber-600 font-medium">*Otomatis tercatat sebagai Arus Kas Bank (Transfer / TF)</p>
          </div>
          <div className="space-y-1 lg:col-span-2 mt-2">
            <label className="text-sm font-medium text-slate-700">Keterangan / Catatan</label>
            <input type="text" required placeholder="Cth: Laporan Harian, Bukti TF Lunas..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-amber-200" />
          </div>
          
          <div className="lg:col-span-4 flex justify-end mt-2 pt-4 border-t border-slate-100">
            <button type="submit" className="w-full md:w-auto bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition">Simpan ke Cloud</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-4 w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[700px] text-sm text-left">
            <thead className="bg-amber-50 text-amber-800 text-xs uppercase font-semibold border-b border-amber-100">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Tanggal & ID</th>
                <th className="px-4 py-3 text-center bg-slate-50 whitespace-nowrap">Pesanan<br/><span className="text-[10px] font-normal text-slate-500">(Mika / Porsi)</span></th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Produksi<br/><span className="text-[10px] font-normal text-amber-600">(Mika / Porsi)</span></th>
                <th className="px-4 py-3 whitespace-nowrap">Keterangan</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Uang Disetor (TF)</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((rep) => (
                <tr key={rep.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{formatDate(rep.date)}</div>
                    <div className="text-xs text-slate-500 font-mono">{rep.id}</div>
                  </td>
                  <td className="px-4 py-3 text-center bg-slate-50/50">
                    <div className="font-bold">{rep.pesananMika}</div>
                    <div className="text-xs text-slate-500">{rep.pesananPorsi} Porsi</div>
                  </td>
                  <td className="px-4 py-3 text-center bg-amber-50/30">
                    <div className="font-bold text-amber-700">{rep.produksiMika}</div>
                    <div className="text-xs text-amber-600">{rep.produksiPorsi} Porsi</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{rep.notes}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">
                    +{formatRp(rep.nominal)}
                  </td>
                  <td className="px-4 py-3 text-center">
                      <button onClick={() => requestDelete(rep.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-lg transition" title="Hapus Laporan">
                          <Trash2 size={16} />
                      </button>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && <tr><td colSpan="6" className="text-center py-12 text-slate-400">Database Kosong. Belum ada laporan dari cabang.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 4. TAB EXPENSES
function TabExpenses({ expenses, saveExpense, setPrintData, requestDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('IN'); 
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [recipient, setRecipient] = useState('');
  const [category, setCategory] = useState(KATEGORI_PENGELUARAN[0]);
  const [description, setDescription] = useState('');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  const total = qty * price;

  const handleSimpan = (e) => {
    e.preventDefault();
    const prefix = type === 'IN' ? 'IN' : 'OUT';
    const newExpense = {
      id: generateId(prefix, date),
      date, recipient, category: type === 'IN' ? 'Modal Awal / Tambahan Saldo' : category, description, qty, price, total, type, paymentMethod
    };
    saveExpense(newExpense);
    setShowForm(false);
    setRecipient(''); setDescription(''); setPrice(0); setQty(1);
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h3 className="font-bold text-lg">Buku Kas Umum</h3>
        <button onClick={() => setShowForm(!showForm)} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition">
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Batal' : 'Input Transaksi / Saldo Awal'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSimpan} className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-4">
          <div className="col-span-full mb-2">
             <div className="flex bg-slate-100 p-1 rounded-lg w-full max-w-sm">
                <button type="button" onClick={() => setType('IN')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${type === 'IN' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>Kas Masuk (Modal)</button>
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
            <input type="text" required placeholder="Cth: TIA, Supplier, Pusat..." value={recipient} onChange={e => setRecipient(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-200" />
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
            <input type="text" required placeholder="Cth: Saldo awal bulan, Beli Daging..." value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-200" />
          </div>
          <div className="space-y-1 flex gap-2 col-span-full md:col-span-1">
             <div className="w-1/3">
                <label className="text-sm font-medium text-slate-700">Qty</label>
                <input type="number" min="1" required value={qty} onChange={e => setQty(Number(e.target.value))} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-200" />
             </div>
             <div className="w-2/3">
                <label className="text-sm font-medium text-slate-700">Harga Satuan (Rp)</label>
                <input type="number" required value={price} onChange={e => setPrice(Number(e.target.value))} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-200" />
             </div>
          </div>
          <div className="space-y-1 col-span-full md:col-span-1">
            <label className="text-sm font-medium text-slate-700">Total {type === 'IN' ? 'Masuk' : 'Keluar'}</label>
            <div className={`w-full p-2 bg-slate-100 border rounded-lg font-bold ${type==='IN'?'text-emerald-700':'text-red-700'}`}>{formatRp(total)}</div>
          </div>
          
          <div className="col-span-full flex justify-end mt-2">
            <button type="submit" className={`w-full md:w-auto ${type === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition`}>
              Simpan ke Cloud
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[600px] text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Tgl & ID</th>
                <th className="px-4 py-3 whitespace-nowrap">Keterangan</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Via</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Nominal</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{formatDate(exp.date)}</div>
                    <div className="text-xs text-slate-500">{exp.id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold flex items-center gap-2">
                      {exp.type === 'IN' ? <ArrowRightLeft size={14} className="text-emerald-500"/> : <ArrowRightLeft size={14} className="text-red-500"/>}
                      {exp.category}
                    </div>
                    <div className="text-xs text-slate-600">{exp.description} (Kpd: {exp.recipient})</div>
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
              {expenses.length === 0 && <tr><td colSpan="5" className="text-center py-12 text-slate-400">Database Kosong. Belum ada kas masuk/keluar.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 5. TAB PIUTANG
function TabPiutang({ orders, payments, savePayment, requestDelete, setPrintData }) {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [bayarAmount, setBayarAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Transfer');

  const daftarPiutang = useMemo(() => {
    return orders.map(order => {
      const orderPayments = payments.filter(p => p.orderId === order.id);
      const cicilan = orderPayments.reduce((sum, p) => sum + p.amount, 0);
      const sisa = order.total - order.paidAmount - cicilan;
      return { ...order, cicilanTerbayar: cicilan, sisaHutang: sisa, orderPayments };
    }).filter(order => order.sisaHutang > 0 || order.orderPayments.length > 0); 
  }, [orders, payments]);

  const handleBayar = (e) => {
    e.preventDefault();
    if(bayarAmount <= 0 || bayarAmount > selectedOrder.sisaHutang) {
        return; 
    }
    const tgl = new Date();
    
    const newPayment = {
        id: generateId('PAY', tgl.toISOString().split('T')[0]),
        orderId: selectedOrder.id,
        date: tgl.toISOString().split('T')[0],
        amount: Number(bayarAmount),
        paymentMethod 
    };
    savePayment(newPayment);
    setBayarAmount(0); 
  };

  const activeOrder = selectedOrder ? daftarPiutang.find(o => o.id === selectedOrder.id) : null;

  return (
    <div className="space-y-4 animate-in fade-in relative">
        
        {/* Modal Bayar & Riwayat */}
        {activeOrder && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-4 md:p-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-start mb-4 sticky top-0 bg-white pb-2 border-b">
                        <h3 className="font-bold text-lg">Kelola Piutang</h3>
                        <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-700 bg-slate-100 p-1 rounded-full"><X size={20}/></button>
                    </div>
                    
                    <div className="bg-slate-50 p-3 md:p-4 rounded-xl mb-6 border border-slate-200 text-sm">
                        <div className="flex justify-between mb-2">
                            <span className="text-slate-500">No. Invoice</span>
                            <span className="font-mono font-bold text-xs">{activeOrder.id}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                            <span className="text-slate-500">Pelanggan</span>
                            <span className="font-bold">{activeOrder.customer}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                            <span className="text-slate-500">Total Tagihan Awal</span>
                            <span className="font-medium">{formatRp(activeOrder.total)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-slate-200 mt-2">
                            <span className="font-bold text-red-600">SISA HUTANG AKTUAL</span>
                            <span className="font-bold text-red-700 text-base md:text-lg">{formatRp(activeOrder.sisaHutang)}</span>
                        </div>
                    </div>

                    {activeOrder.sisaHutang > 0 && (
                        <form onSubmit={handleBayar} className="space-y-4 mb-8 bg-orange-50 p-3 md:p-4 rounded-xl border border-orange-100">
                            <h4 className="font-bold text-sm text-orange-800">Form Pembayaran Baru</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-orange-700">Metode Bayar</label>
                                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full p-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-300 mt-1 text-sm bg-white">
                                        <option value="Transfer">Transfer Bank</option>
                                        <option value="Cash">Tunai (Cash)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-orange-700">Nominal (Maks {formatRp(activeOrder.sisaHutang)})</label>
                                    <input type="number" max={activeOrder.sisaHutang} min="1" required value={bayarAmount} onChange={e => setBayarAmount(Number(e.target.value))} className="w-full p-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-300 mt-1 text-sm font-bold" />
                                </div>
                            </div>
                            <div className="flex justify-end mt-2">
                                <button type="submit" className="w-full md:w-auto px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium shadow-sm text-sm">Simpan ke Cloud</button>
                            </div>
                        </form>
                    )}

                    <div>
                        <h4 className="font-bold text-sm text-slate-700 mb-3 border-b pb-1">Riwayat Pembayaran Cicilan</h4>
                        {activeOrder.orderPayments.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">Belum ada riwayat cicilan.</p>
                        ) : (
                            <div className="space-y-2">
                                {activeOrder.orderPayments.map(pay => (
                                    <div key={pay.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-slate-200 p-3 rounded-lg shadow-sm gap-2">
                                        <div>
                                            <div className="text-[10px] font-mono text-slate-400">{pay.id}</div>
                                            <div className="text-xs md:text-sm font-medium">{formatDate(pay.date)} <span className="text-slate-400">({pay.paymentMethod})</span></div>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end flex-1 gap-4 border-t sm:border-none pt-2 sm:pt-0 mt-1 sm:mt-0">
                                            <div className="font-bold text-emerald-600">{formatRp(pay.amount)}</div>
                                            <div className="flex gap-2">
                                                <button onClick={() => setPrintData({ type: 'receipt', data: { payment: pay, order: activeOrder }})} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded" title="Cetak Bukti">
                                                    <Printer size={16} />
                                                </button>
                                                <button onClick={() => requestDelete(pay.id)} className="p-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded" title="Hapus">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
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
        <h3 className="font-bold text-lg">Daftar Piutang Berjalan</h3>
      </div>
      
      {daftarPiutang.filter(o => o.sisaHutang > 0).length === 0 ? (
          <div className="text-center p-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500">
              <CheckCircle size={48} className="mx-auto text-emerald-400 mb-3" />
              <p>Hore! Semua nota telah lunas. Tidak ada piutang saat ini.</p>
          </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {daftarPiutang.filter(o => o.sisaHutang > 0).map((order) => (
                <div key={order.id} className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-orange-300 transition-colors">
                    <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg shadow">BELUM LUNAS</div>
                    <div className="text-xs md:text-sm text-slate-500 mb-1">{formatDate(order.date)}</div>
                    <div className="font-bold text-base md:text-lg mb-1">{order.customer}</div>
                    <div className="text-[10px] md:text-xs font-mono text-slate-400 mb-4">{order.id}</div>
                    
                    <div className="space-y-2 text-xs md:text-sm mb-4">
                        <div className="flex justify-between border-b border-slate-100 pb-1">
                            <span className="text-slate-500">Total Invoice</span>
                            <span className="font-medium">{formatRp(order.total)}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1">
                            <span className="text-slate-500">Total Terbayar</span>
                            <span className="font-medium text-emerald-600">{formatRp(order.paidAmount + order.cicilanTerbayar)}</span>
                        </div>
                        <div className="flex justify-between pt-1">
                            <span className="font-bold text-red-600">Sisa Hutang</span>
                            <span className="font-bold text-red-700">{formatRp(order.sisaHutang)}</span>
                        </div>
                    </div>
                    
                    <button onClick={() => {setSelectedOrder(order); setBayarAmount(order.sisaHutang)}} className="w-full bg-orange-100 text-orange-700 hover:bg-orange-500 hover:text-white transition py-2.5 rounded-lg font-bold text-sm shadow-sm">
                        Kelola Cicilan / Pelunasan
                    </button>
                </div>
            ))}
        </div>
      )}
    </div>
  );
}

// --- PRINT LAYOUTS ---
const LogoDimsum = () => (
    <div className="flex flex-col items-center">
        <img src="https://dimsumaditya.id/wp-content/uploads/2024/10/Dimsum-Aditya.png" alt="Dimsum Aditya Logo" className="h-16 object-contain mb-1" />
    </div>
);

function PrintInvoice({ data, onBack }) {
  useEffect(() => {
    const timer = setTimeout(() => { window.print(); }, 500);
    return () => clearTimeout(timer);
  }, []);

  const deskripsi = `Pembelian Dimsum Aditya ${data.notes ? `(${data.notes})` : ''}`;

  return (
    <div className="bg-white min-h-screen text-black print:bg-white print:p-0 p-8 w-full max-w-[800px] mx-auto">
      <button onClick={onBack} className="print:hidden mb-4 bg-slate-800 text-white px-4 py-2 rounded shadow flex items-center gap-2">
        <ArrowRightLeft size={16} /> Kembali
      </button>

      <div className="p-8 border border-slate-200 print:border-none print:p-0 text-sm font-sans" style={{ fontFamily: 'Arial, sans-serif' }}>
        <div className="flex justify-between items-start mb-8">
            <div>
                <h1 className="font-bold text-xl uppercase mb-1">INVOICE DIMSUM ADITYA</h1>
                <p className="text-xs text-slate-700 leading-tight">Jl. Thamrin, RT.001/RW.003, Ketapang</p>
                <p className="text-xs text-slate-700 leading-tight">Kec. Cipondoh, Kota Tangerang, Banten 15147</p>
                <p className="text-xs text-slate-700 leading-tight">Telp/Wa : 087809020931, dimsumaditya@gmail.com</p>
            </div>
            <LogoDimsum />
        </div>

        <div className="flex justify-between items-end mb-4">
            <table className="w-[45%] text-sm">
                <tbody>
                    <tr>
                        <td className="font-bold w-24 pb-1">No. Invoice</td><td className="w-4 pb-1">:</td>
                        <td className="border-b border-dotted border-black pb-1">{data.id}</td>
                    </tr>
                    <tr>
                        <td className="font-bold w-24 pb-1">Kepada</td><td className="w-4 pb-1">:</td>
                        <td className="border-b border-dotted border-black pb-1 uppercase">{data.customer}</td>
                    </tr>
                </tbody>
            </table>
            <table className="w-[40%] text-sm">
                <tbody>
                    <tr>
                        <td className="font-bold w-28 pb-1">Tanggal</td><td className="w-4 pb-1">:</td>
                        <td className="border-b border-dotted border-black text-right pb-1">{formatDate(data.date)}</td>
                    </tr>
                    <tr>
                        <td className="font-bold w-28 pb-1">Metode Bayar</td><td className="w-4 pb-1">:</td>
                        <td className="border-b border-dotted border-black text-right pb-1">{data.paymentMethod}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <table className="w-full border-collapse border border-black text-center mb-2 text-sm mt-6">
            <thead>
                <tr>
                    <th className="border border-black p-2 bg-gray-50 w-1/5">KATEGORI</th>
                    <th className="border border-black p-2 bg-gray-50 w-2/5">DESKRIPSI</th>
                    <th className="border border-black p-2 bg-gray-50">QTY</th>
                    <th className="border border-black p-2 bg-gray-50">HARGA / Btr</th>
                    <th className="border border-black p-2 bg-gray-50 w-1/4">TOTAL</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td className="border border-black p-2">{data.category.includes('Shopee') || data.category.includes('Toko') ? `Online ${data.category}` : data.category}</td>
                    <td className="border border-black p-2 text-left">{deskripsi}</td>
                    <td className="border border-black p-2">{data.qty} Pcs</td>
                    <td className="border border-black p-2">{formatRp(data.price)}</td>
                    <td className="border border-black p-2 font-bold">{formatRp(data.total)}</td>
                </tr>
                {[...Array(3)].map((_, i) => (
                    <tr key={i}>
                        <td className="border border-black border-dashed p-3"></td>
                        <td className="border border-black border-dashed p-3"></td>
                        <td className="border border-black border-dashed p-3"></td>
                        <td className="border border-black border-dashed p-3"></td>
                        <td className="border border-black border-dashed p-3"></td>
                    </tr>
                ))}
            </tbody>
        </table>

        <div className="italic text-sm font-serif mb-12 border-b border-black pb-1 inline-block min-w-full">
            TERBILANG : {terbilang(data.total)} Rupiah
        </div>

        <div className="flex justify-between items-end mb-8 mt-4">
            <div className="text-center w-48">
                <div className="border-b border-dotted border-black h-16 mb-1"></div>
                <div className="text-xs">Penerima / Pelanggan</div>
            </div>
            <div className="text-center w-48">
                <div className="text-sm mb-12 text-left italic">Hormat kami,</div>
                <div className="border-b border-dotted border-black h-4 mb-1"></div>
                <div className="text-xs">Admin / Kasir</div>
            </div>
        </div>

        <div className="flex justify-between items-end mt-12 text-xs font-bold">
            <div>
                <p>BCA : 1320552261 (WASTAM)</p>
                <p>BRI : 775301006132536 (WASTAM)</p>
            </div>
            <div className="font-normal text-slate-500">www.dimsumaditya.id</div>
        </div>
      </div>
    </div>
  );
}

function PrintVoucher({ data, onBack }) {
    useEffect(() => {
        const timer = setTimeout(() => { window.print(); }, 500);
        return () => clearTimeout(timer);
    }, []);
  
    return (
      <div className="bg-white min-h-screen text-black print:bg-white print:p-0 p-8 w-full max-w-[800px] mx-auto">
        <button onClick={onBack} className="print:hidden mb-4 bg-slate-800 text-white px-4 py-2 rounded flex items-center gap-2">
          <ArrowRightLeft size={16} /> Kembali
        </button>
  
        <div className="p-8 border border-slate-200 print:border-none print:p-0 text-sm font-sans" style={{ fontFamily: 'Arial, sans-serif' }}>
          <div className="flex justify-between items-center mb-8">
              <h1 className="font-bold text-xl uppercase">BUKTI PENGELUARAN KAS - DIMSUM ADITYA</h1>
              <LogoDimsum />
          </div>
  
          <div className="flex justify-between items-end mb-6">
              <table className="w-[50%] text-sm">
                  <tbody>
                      <tr>
                          <td className="font-bold w-24 pb-2">ID Voucher</td><td className="w-4 pb-2">:</td>
                          <td className="border-b border-dotted border-black pb-2">{data.id}</td>
                      </tr>
                      <tr>
                          <td className="font-bold w-24 pb-2">Kepada</td><td className="w-4 pb-2">:</td>
                          <td className="border-b border-dotted border-black pb-2 uppercase">{data.recipient}</td>
                      </tr>
                  </tbody>
              </table>
              <table className="w-[35%] text-sm">
                  <tbody>
                      <tr>
                          <td className="font-bold w-20 pb-2">Tanggal</td><td className="w-4 pb-2">:</td>
                          <td className="border-b border-dotted border-black text-right pb-2">{formatDate(data.date)}</td>
                      </tr>
                      <tr>
                          <td className="font-bold w-20 pb-2">Metode</td><td className="w-4 pb-2">:</td>
                          <td className="border-b border-dotted border-black text-right pb-2">{data.paymentMethod}</td>
                      </tr>
                  </tbody>
              </table>
          </div>
  
          <table className="w-full border-collapse border border-black text-center mb-2 text-sm">
              <thead>
                  <tr>
                      <th className="border border-black p-2 bg-gray-50 w-1/4">KATEGORI</th>
                      <th className="border border-black p-2 bg-gray-50 w-2/5">KETERANGAN</th>
                      <th className="border border-black p-2 bg-gray-50 w-16">QTY</th>
                      <th className="border border-black p-2 bg-gray-50">HARGA</th>
                      <th className="border border-black p-2 bg-gray-50">TOTAL (KAS KELUAR)</th>
                  </tr>
              </thead>
              <tbody>
                  <tr>
                      <td className="border border-black p-2">{data.category}</td>
                      <td className="border border-black p-2 uppercase">{data.description}</td>
                      <td className="border border-black p-2">{data.qty}</td>
                      <td className="border border-black p-2">{formatRp(data.price)}</td>
                      <td className="border border-black p-2 font-bold">{formatRp(data.total)}</td>
                  </tr>
                  {[...Array(4)].map((_, i) => (
                      <tr key={i}>
                          <td className="border border-black border-dashed p-4"></td>
                          <td className="border border-black border-dashed p-4"></td>
                          <td className="border border-black border-dashed p-4"></td>
                          <td className="border border-black border-dashed p-4"></td>
                          <td className="border border-black border-dashed p-4"></td>
                      </tr>
                  ))}
              </tbody>
          </table>
  
          <div className="italic text-sm font-serif mb-16 pt-2">TERBILANG : {terbilang(data.total)} Rupiah</div>
  
          <div className="flex justify-between items-end mb-4">
              <div className="text-center w-48 mt-12">
                  <div className="border-b border-dotted border-black h-8 mb-1"></div>
                  <div className="text-xs">Penerima / Pelanggan</div>
              </div>
              <div className="text-center w-48">
                  <div className="text-sm mb-16 text-left italic">Hormat kami,</div>
                  <div className="border-b border-dotted border-black h-4 mb-1"></div>
                  <div className="text-xs">Admin / Kasir</div>
              </div>
          </div>
        </div>
      </div>
    );
}

function PrintReceipt({ data, onBack }) {
    useEffect(() => {
        const timer = setTimeout(() => { window.print(); }, 500);
        return () => clearTimeout(timer);
    }, []);
    
    const { payment, order } = data;
  
    return (
      <div className="bg-white min-h-screen text-black print:bg-white print:p-0 p-8 w-full max-w-[800px] mx-auto">
        <button onClick={onBack} className="print:hidden mb-4 bg-slate-800 text-white px-4 py-2 rounded flex items-center gap-2">
          <ArrowRightLeft size={16} /> Kembali
        </button>
  
        <div className="p-8 border border-slate-200 print:border-none print:p-0 text-sm font-sans" style={{ fontFamily: 'Arial, sans-serif' }}>
          <div className="flex justify-between items-center mb-10">
              <h1 className="font-bold text-xl uppercase border-b-2 border-black pb-2 inline-block">BUKTI PEMBAYARAN PIUTANG / CICILAN</h1>
              <LogoDimsum />
          </div>
  
          <div className="space-y-4 text-base">
              <div className="flex">
                  <div className="w-48 font-bold">ID Pembayaran</div>
                  <div className="w-4">:</div>
                  <div className="font-mono font-medium">{payment.id}</div>
              </div>
              <div className="flex">
                  <div className="w-48 font-bold">Tanggal Pembayaran</div>
                  <div className="w-4">:</div>
                  <div>{formatDate(payment.date)}</div>
              </div>
              <div className="flex">
                  <div className="w-48 font-bold">Telah Diterima Dari</div>
                  <div className="w-4">:</div>
                  <div className="uppercase font-bold border-b border-dotted border-black flex-1">{order.customer}</div>
              </div>
              <div className="flex">
                  <div className="w-48 font-bold">Metode Bayar</div>
                  <div className="w-4">:</div>
                  <div className="font-bold">{payment.paymentMethod}</div>
              </div>
              <div className="flex items-center">
                  <div className="w-48 font-bold">Sejumlah Uang</div>
                  <div className="w-4">:</div>
                  <div className="font-bold text-lg bg-gray-100 px-4 py-1 border border-black inline-block">
                      {formatRp(payment.amount)}
                  </div>
              </div>
              <div className="flex">
                  <div className="w-48 font-bold">Terbilang</div>
                  <div className="w-4">:</div>
                  <div className="italic font-serif flex-1 capitalize border-b border-dotted border-black">{terbilang(payment.amount)} Rupiah</div>
              </div>
              <div className="flex">
                  <div className="w-48 font-bold">Untuk Pembayaran</div>
                  <div className="w-4">:</div>
                  <div className="flex-1">Cicilan / Pelunasan tagihan untuk No. Invoice: <strong>{order.id}</strong></div>
              </div>
          </div>
  
          <div className="mt-16 flex justify-between items-end">
              <div className="text-sm p-4 border border-black bg-gray-50">
                  <p className="font-bold mb-1">Informasi Invoice (Referensi):</p>
                  <p>Total Tagihan Awal : {formatRp(order.total)}</p>
                  <p>Sisa Hutang Terakhir : {formatRp(order.sisaHutang)}</p>
              </div>
              <div className="text-center w-48">
                  <div className="text-sm mb-16 text-left italic">Penerima (Kasir),</div>
                  <div className="border-b border-dotted border-black h-4 mb-1"></div>
                  <div className="text-xs uppercase text-center">Dimsum Aditya</div>
              </div>
          </div>
        </div>
      </div>
    );
}

// Laporan Detail Update
function PrintReport({ data, onBack }) {
    useEffect(() => {
        const timer = setTimeout(() => { window.print(); }, 500);
        return () => clearTimeout(timer);
    }, []);
    
    const { rekap, dateFrom, dateTo } = data;
  
    return (
      <div className="bg-white min-h-screen text-black print:bg-white print:p-0 p-8 w-full max-w-[800px] mx-auto">
        <button onClick={onBack} className="print:hidden mb-4 bg-slate-800 text-white px-4 py-2 rounded flex items-center gap-2">
          <ArrowRightLeft size={16} /> Kembali ke Aplikasi
        </button>
  
        <div className="print:p-0 text-sm font-sans" style={{ fontFamily: 'Arial, sans-serif' }}>
          
          <div className="text-center mb-6 border-b-2 border-black pb-4">
              <LogoDimsum />
              <h1 className="font-bold text-xl uppercase mt-2">Laporan Keuangan & Penjualan</h1>
              <p className="text-slate-600">Periode: {formatDate(dateFrom)} s/d {formatDate(dateTo)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="border border-black p-3">
                  <h3 className="font-bold text-sm border-b border-black pb-1 mb-2">RINGKASAN SALDO KAS & BANK</h3>
                  <div className="flex justify-between mb-1"><span>Saldo Tunai Bersih (CASH):</span> <span className="font-medium text-emerald-700">{formatRp(rekap.saldoCash)}</span></div>
                  <div className="flex justify-between mb-1"><span>Saldo Rekening Bersih (TF):</span> <span className="font-medium text-indigo-700">{formatRp(rekap.saldoTF)}</span></div>
                  <div className="flex justify-between pt-1 border-t border-dotted border-black mt-1">
                      <span className="font-bold">TOTAL SALDO AKTUAL:</span> <span className="font-bold text-blue-700">{formatRp(rekap.saldoAkhir)}</span>
                  </div>
              </div>
              <div className="border border-black p-3">
                  <h3 className="font-bold text-sm border-b border-black pb-1 mb-2">RINGKASAN OMSET & PIUTANG</h3>
                  <div className="flex justify-between mb-1"><span>Total Penjualan Kotor:</span> <span className="font-medium">{formatRp(rekap.totalPenjualanKotor)}</span></div>
                  <div className="flex justify-between mb-1"><span>Total Porsi Terjual:</span> <span className="font-medium">{rekap.totalPorsi} Porsi</span></div>
                  <div className="flex justify-between mb-1"><span>Total Piutang Berjalan:</span> <span className="font-medium text-red-600">{formatRp(rekap.totalPiutangBaru)}</span></div>
              </div>
          </div>

          <h3 className="font-bold text-md mb-2 mt-8">A. RINCIAN TRANSAKSI & OMSET PENJUALAN (PUSAT)</h3>
          <table className="w-full border-collapse border border-black text-sm text-left mb-8">
            <thead className="bg-gray-100">
                <tr>
                    <th className="border border-black p-2 text-center w-8">NO</th>
                    <th className="border border-black p-2">NO. INVOICE</th>
                    <th className="border border-black p-2">PELANGGAN</th>
                    <th className="border border-black p-2">KATEGORI</th>
                    <th className="border border-black p-2">VIA (METODE)</th>
                    <th className="border border-black p-2 text-center">QTY (PORSI)</th>
                    <th className="border border-black p-2 text-right">TOTAL OMSET</th>
                </tr>
            </thead>
            <tbody>
                {rekap.listTransaksiDetail.map((c, i) => (
                    <tr key={i}>
                        <td className="border border-black p-2 text-center">{i + 1}</td>
                        <td className="border border-black p-2 font-mono text-xs">{c.id}</td>
                        <td className="border border-black p-2 font-bold">{c.customer}</td>
                        <td className="border border-black p-2">{c.category}</td>
                        <td className="border border-black p-2">{c.paymentMethod}</td>
                        <td className="border border-black p-2 text-center">{c.qty} Pcs <span className="text-xs">({c.porsi} Prs)</span></td>
                        <td className="border border-black p-2 text-right font-medium">{formatRp(c.omset)}</td>
                    </tr>
                ))}
                {rekap.listTransaksiDetail.length === 0 && (
                    <tr><td colSpan="7" className="border border-black p-4 text-center italic">Tidak ada transaksi.</td></tr>
                )}
            </tbody>
          </table>

          {rekap.listPiutangBerjalanLaporan.length > 0 && (
              <>
                  <h3 className="font-bold text-md mb-2 mt-4">B. DAFTAR PIUTANG BERJALAN SAAT INI (BELUM LUNAS)</h3>
                  <table className="w-full border-collapse border border-black text-sm text-left mb-8">
                      <thead className="bg-gray-100">
                          <tr>
                              <th className="border border-black p-2 text-center w-8">NO</th>
                              <th className="border border-black p-2">NO. INVOICE / TANGGAL</th>
                              <th className="border border-black p-2">PELANGGAN</th>
                              <th className="border border-black p-2 text-center">PESANAN</th>
                              <th className="border border-black p-2 text-right">TOTAL TAGIHAN</th>
                              <th className="border border-black p-2 text-right">TELAH DIBAYAR</th>
                              <th className="border border-black p-2 text-right text-red-600">SISA HUTANG</th>
                          </tr>
                      </thead>
                      <tbody>
                          {rekap.listPiutangBerjalanLaporan.map((o, i) => (
                              <tr key={i}>
                                  <td className="border border-black p-2 text-center">{i + 1}</td>
                                  <td className="border border-black p-2">
                                    <div className="font-mono text-xs font-bold">{o.id}</div>
                                    <div className="text-xs text-gray-600">{formatDate(o.date)}</div>
                                  </td>
                                  <td className="border border-black p-2 font-bold">{o.customer}</td>
                                  <td className="border border-black p-2 text-center">{o.qty} Pcs <span className="text-xs">({o.qty/4} Prs)</span></td>
                                  <td className="border border-black p-2 text-right font-medium">{formatRp(o.total)}</td>
                                  <td className="border border-black p-2 text-right text-emerald-600">{formatRp(o.paidAmount + o.cicilanTerbayar)}</td>
                                  <td className="border border-black p-2 text-right font-bold text-red-600">{formatRp(o.sisaHutang)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </>
          )}

          {rekap.listPembayaranPiutang.length > 0 && (
              <>
                  <h3 className="font-bold text-md mb-2 mt-4">C. RINCIAN UANG MASUK DARI CICILAN PIUTANG (PERIODE INI)</h3>
                  <table className="w-full border-collapse border border-black text-sm text-left mb-8">
                      <thead className="bg-gray-100">
                          <tr>
                              <th className="border border-black p-2 text-center w-8">NO</th>
                              <th className="border border-black p-2">TANGGAL</th>
                              <th className="border border-black p-2">ID PEMBAYARAN</th>
                              <th className="border border-black p-2">REF. INVOICE</th>
                              <th className="border border-black p-2">PELANGGAN</th>
                              <th className="border border-black p-2">VIA</th>
                              <th className="border border-black p-2 text-right">NOMINAL MASUK</th>
                          </tr>
                      </thead>
                      <tbody>
                          {rekap.listPembayaranPiutang.map((p, i) => (
                              <tr key={i}>
                                  <td className="border border-black p-2 text-center">{i + 1}</td>
                                  <td className="border border-black p-2">{formatDate(p.date)}</td>
                                  <td className="border border-black p-2 font-mono text-xs">{p.id}</td>
                                  <td className="border border-black p-2 font-mono text-xs font-bold">{p.invoiceId}</td>
                                  <td className="border border-black p-2 font-bold">{p.customer}</td>
                                  <td className="border border-black p-2">{p.method}</td>
                                  <td className="border border-black p-2 text-right font-bold">{formatRp(p.amount)}</td>
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
                      <thead className="bg-gray-100">
                          <tr>
                              <th className="border border-black p-2 text-center w-8">NO</th>
                              <th className="border border-black p-2">TANGGAL</th>
                              <th className="border border-black p-2 text-center">PESANAN (Mika/Porsi)</th>
                              <th className="border border-black p-2 text-center">PRODUKSI (Mika/Porsi)</th>
                              <th className="border border-black p-2">METODE BAYAR</th>
                              <th className="border border-black p-2 text-right">UANG DISETOR (TF)</th>
                          </tr>
                      </thead>
                      <tbody>
                          {rekap.listPemalang.map((p, i) => (
                              <tr key={i}>
                                  <td className="border border-black p-2 text-center">{i + 1}</td>
                                  <td className="border border-black p-2">{formatDate(p.date)}</td>
                                  <td className="border border-black p-2 text-center">{p.pesananMika} M <span className="text-xs">({p.pesananPorsi} P)</span></td>
                                  <td className="border border-black p-2 text-center">{p.produksiMika} M <span className="text-xs">({p.produksiPorsi} P)</span></td>
                                  <td className="border border-black p-2 font-bold text-indigo-700">Transfer (TF)</td>
                                  <td className="border border-black p-2 text-right font-bold">{formatRp(p.nominal)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </>
          )}

          <div className="flex justify-end mt-12">
              <div className="text-center w-48">
                  <div className="text-sm mb-12 text-center">Dicetak oleh,</div>
                  <div className="border-b border-dotted border-black h-4 mb-1"></div>
                  <div className="text-xs uppercase">Admin Pusat</div>
                  <div className="text-xs italic text-gray-500 mt-1">{formatDate(new Date())}</div>
              </div>
          </div>
        </div>
      </div>
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
