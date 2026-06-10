import React, { useState, useMemo } from 'react';
import { Wallet, ArrowDownToLine, ArrowUpRight, Search, Calendar, Landmark, Banknote, CreditCard, Filter, ArrowRightLeft, Plus, X, Printer, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabCashWarRoom({ 
  orders = [], orders_data, purchases = [], purchases_data, 
  expenses = [], expenses_data, cashflow_transactions = [], cashflow_transactions_data,
  masterBranches = [], master_branches, user, sendToSheet, showToast 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';

  // --- STATE MANAJEMEN ---
  const [dateFilter, setDateFilter] = useState('THIS_MONTH'); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeBranch, setActiveBranch] = useState('ALL_BRANCHES');
  
  // State Manual Entry
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    date: todayStr, type: 'OUT', category: 'BIAYA OPERASIONAL', description: '', amount: '', method: 'CASH'
  });

  // --- DATABASE SINKRONISASI ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realCashflow = useMemo(() => cashflow_transactions_data || cashflow_transactions || [], [cashflow_transactions, cashflow_transactions_data]);
  
  // Dynamic Branches List (Biar Pemalang & Cibinong Nongol)
  const branchList = useMemo(() => {
    const raw = master_branches || masterBranches || [];
    let list = raw.filter(b => !b.isDeleted).map(b => b.branch_id);
    if(list.length === 0) list = ['TANGERANG_PUSAT', 'PEMALANG', 'RESO_CIBINONG']; // Fallback
    return list;
  }, [master_branches, masterBranches]);

  // --- ENGINE BUKU MUTASI KONSOLIDASI ---
  const allTransactions = useMemo(() => {
    let mutasi = [];
    realOrders.filter(o => !o.isDeleted && Number(o.amount_paid) > 0).forEach(o => {
      mutasi.push({ id: o.id, date: new Date(o.date), branch_id: o.branch_id, type: 'IN', category: 'PENJUALAN DIMSUM', description: `Pembayaran: ${o.customer_name}`, method: o.payment_method || 'CASH', amount: Number(o.amount_paid) });
    });
    realPurchases.filter(p => !p.isDeleted && Number(p.amount_paid) > 0).forEach(p => {
      mutasi.push({ id: p.id, date: new Date(p.date), branch_id: p.branch_id, type: 'OUT', category: `BELANJA LOGISTIK`, description: `Ke Supplier: ${p.supplier_name}`, method: p.payment_method || 'CASH', amount: Number(p.amount_paid) });
    });
    realExpenses.filter(e => !e.isDeleted && Number(e.amount) > 0).forEach(e => {
      mutasi.push({ id: e.id || `EXP-${e.date}`, date: new Date(e.date), branch_id: e.branch_id, type: 'OUT', category: 'PENGELUARAN LAIN', description: e.description || e.expense_name, method: e.payment_method || 'CASH', amount: Number(e.amount) });
    });
    realCashflow.filter(c => !c.isDeleted && Number(c.amount) > 0).forEach(c => {
      mutasi.push({ id: c.id, date: new Date(c.date), branch_id: c.branch_id, type: c.type, category: c.category || 'KAS MANUAL', description: c.description, method: c.method || 'CASH', amount: Number(c.amount) });
    });
    return mutasi.sort((a, b) => b.date - a.date);
  }, [realOrders, realPurchases, realExpenses, realCashflow]);

  // --- FILTER ENGINE ---
  const filteredMutasi = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    let start = new Date(0); let end = new Date(); end.setHours(23,59,59,999);
    if (dateFilter === 'TODAY') { start = new Date(today); } 
    else if (dateFilter === '7_DAYS') { start = new Date(today); start.setDate(start.getDate() - 7); } 
    else if (dateFilter === 'THIS_MONTH') { start = new Date(today.getFullYear(), today.getMonth(), 1); } 
    else if (dateFilter === 'CUSTOM' && startDate && endDate) { start = new Date(startDate); start.setHours(0,0,0,0); end = new Date(endDate); end.setHours(23,59,59,999); }

    return allTransactions.filter(trx => {
      if (activeBranch !== 'ALL_BRANCHES' && trx.branch_id !== activeBranch && trx.branch_id !== 'PUSAT') return false;
      if (trx.date < start || trx.date > end) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!trx.description.toLowerCase().includes(s) && !trx.id.toLowerCase().includes(s) && !trx.category.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [allTransactions, dateFilter, startDate, endDate, searchTerm, activeBranch]);

  const walletBalance = useMemo(() => {
    let cashIn = 0; let cashOut = 0; let bankIn = 0; let bankOut = 0;
    filteredMutasi.forEach(trx => {
      const isBank = ['TF', 'TRANSFER', 'BANK', 'QRIS', 'DP'].includes(trx.method?.toUpperCase());
      if (trx.type === 'IN') { if (isBank) bankIn += trx.amount; else cashIn += trx.amount; } 
      else { if (isBank) bankOut += trx.amount; else cashOut += trx.amount; }
    });
    return { saldoCash: cashIn - cashOut, saldoBank: bankIn - bankOut, totalNet: (cashIn - cashOut) + (bankIn - bankOut), totalMasuk: cashIn + bankIn, totalKeluar: cashOut + bankOut };
  }, [filteredMutasi]);

  // --- ENGINE 4 AMPLOP VIRTUAL ---
  const envelopeMetrics = useMemo(() => {
    let totalUangMasuk2Minggu = 0;
    const batas = new Date(); batas.setDate(batas.getDate() - 14);
    realOrders.filter(o => !o.isDeleted && new Date(o.date) >= batas && (o.branch_id === currentBranch || o.branch_id === 'PUSAT')).forEach(o => {
      totalUangMasuk2Minggu += Number(o.amount_paid || o.total_amount || 0);
    });
    const TARGET_GAJI = 25000000; const TARGET_AMAN = TARGET_GAJI * 2; 
    const amp2_ops = totalUangMasuk2Minggu * 0.20;
    let statusGaji = 'KRITIS';
    if (amp2_ops >= TARGET_AMAN) statusGaji = 'AMAN_RESERVE'; else if (amp2_ops >= TARGET_GAJI) statusGaji = 'CUKUP_BULAN_INI';
    return { total: totalUangMasuk2Minggu, amp1: totalUangMasuk2Minggu * 0.55, amp2: amp2_ops, amp3: totalUangMasuk2Minggu * 0.10, amp4: totalUangMasuk2Minggu * 0.15, statusGaji, target: TARGET_AMAN };
  }, [realOrders, currentBranch]);

  // --- ACTIONS ---
  const handleSaveManual = async (e) => {
    e.preventDefault();
    if(Number(manualForm.amount) <= 0) return alert("Nominal harus lebih dari 0!");
    const trxId = generateId('CSH', manualForm.date);
    const payload = { ...manualForm, id: trxId, branch_id: currentBranch, amount: Number(manualForm.amount) };
    
    if (await sendToSheet('insert', payload, 'cashflow_transactions')) {
      showToast('Mutasi kas berhasil dicatat!', 'success');
      setShowManualModal(false);
      setManualForm({ date: todayStr, type: 'OUT', category: 'BIAYA OPERASIONAL', description: '', amount: '', method: 'CASH' });
      // Tanya cetak nota kas
      if(window.confirm("Cetak Bukti Kas ini?")) handlePrintKas(payload);
    }
  };

  const handlePrintKas = (trx) => {
    const title = trx.type === 'IN' ? 'BUKTI KAS MASUK (IN)' : 'BUKTI KAS KELUAR (OUT)';
    triggerPrint('NOTA_DOTMATRIX', {
      title: title, id: trx.id, date: formatDate(trx.date), branch_name: trx.branch_id || currentBranch,
      admin_name: user?.name || 'ADMIN', customer_name: 'INTERNAL KAS / VENDOR',
      items: [{ name: `${trx.category}\n${trx.description}`, qty: 1, subtotal: trx.amount }],
      amount: trx.amount, paymentMethod: trx.method || 'CASH'
    });
  };

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-500">
      
      {/* HEADER: KARTU DOMPET PERUSAHAAN (Desain Smooth & Mewah) */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-800 relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
          <Landmark className="absolute right-0 top-0 opacity-5 scale-150 transform -translate-y-10 translate-x-10 pointer-events-none" size={300} />
          
          <div className="relative z-10">
            <h2 className="text-2xl font-black text-white tracking-widest uppercase flex items-center gap-3">
              <Wallet size={28} className="text-emerald-400" /> Dompet & Kas Perusahaan
            </h2>
            <p className="text-xs text-slate-400 font-bold mt-1 tracking-wider uppercase">Pusat Transparansi Keuangan Owner</p>
          </div>

          <div className="flex bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700 relative z-10 w-full md:w-auto overflow-x-auto shadow-inner">
            {[{ id: 'TODAY', label: 'HARI INI' }, { id: '7_DAYS', label: '7 HARI' }, { id: 'THIS_MONTH', label: 'BULAN INI' }, { id: 'CUSTOM', label: 'KUSTOM' }].map(f => (
              <button key={f.id} onClick={() => setDateFilter(f.id)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${dateFilter === f.id ? 'bg-emerald-500 text-white shadow-lg scale-105' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {dateFilter === 'CUSTOM' && (
          <div className="bg-slate-800/50 p-5 border-b border-slate-700 flex flex-wrap gap-4 items-end animate-in slide-in-from-top-2">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Dari Tanggal</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-900 border border-slate-700 text-white px-4 py-2.5 rounded-xl text-xs font-black outline-none focus:border-emerald-500 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Sampai Tanggal</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-900 border border-slate-700 text-white px-4 py-2.5 rounded-xl text-xs font-black outline-none focus:border-emerald-500 transition-colors" />
            </div>
          </div>
        )}

        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 bg-slate-900">
          <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 relative overflow-hidden group hover:border-emerald-500/50 transition-all shadow-md">
            <Banknote className="absolute -right-4 -bottom-4 text-emerald-500/10 group-hover:scale-110 transition-transform duration-500" size={140} />
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2 mb-2"><Banknote size={14}/> Laci Uang Tunai (Cash)</div>
            <div className="text-3xl font-black text-white tracking-tight">{formatRupiah(walletBalance.saldoCash)}</div>
            <div className="mt-5 flex gap-4 text-[10px] font-bold text-slate-400 bg-slate-900/50 w-max px-3 py-1.5 rounded-lg border border-slate-700/50">
              <span className="flex items-center gap-1"><ArrowDownToLine size={10} className="text-emerald-400"/> In: {formatRupiah(walletBalance.totalMasuk)}</span>
              <span className="flex items-center gap-1"><ArrowUpRight size={10} className="text-rose-400"/> Out: {formatRupiah(walletBalance.totalKeluar)}</span>
            </div>
          </div>

          <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 relative overflow-hidden group hover:border-blue-500/50 transition-all shadow-md">
            <CreditCard className="absolute -right-4 -bottom-4 text-blue-500/10 group-hover:scale-110 transition-transform duration-500" size={140} />
            <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-2"><CreditCard size={14}/> Saldo Bank (Transfer)</div>
            <div className="text-3xl font-black text-white tracking-tight">{formatRupiah(walletBalance.saldoBank)}</div>
            <div className="mt-5 text-[10px] font-bold text-slate-400 bg-slate-900/50 w-max px-3 py-1.5 rounded-lg border border-slate-700/50">
               *Akumulasi uang via Transfer & EDC
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-6 rounded-3xl border border-emerald-400/50 shadow-xl relative overflow-hidden transform hover:scale-[1.02] transition-transform">
            <Wallet className="absolute -right-4 -bottom-4 text-white/10" size={140} />
            <div className="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-2">Total Likuiditas (Tunai + Bank)</div>
            <div className="text-4xl font-black text-white tracking-tight drop-shadow-md">{formatRupiah(walletBalance.totalNet)}</div>
            <div className="mt-5 flex gap-2 text-[9px] font-black uppercase text-emerald-100 bg-black/20 px-4 py-2 rounded-xl w-max backdrop-blur-sm border border-white/10">
               Total Keseluruhan Periode Ini
            </div>
          </div>
        </div>
      </div>

      {/* RUMAH BARU 4 AMPLOP VIRTUAL (SESUAI REQUEST BOS) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <Wallet size={16} className="text-indigo-600"/> Anggaran 4 Amplop Virtual (Rekap 2 Mingguan)
          </h3>
          <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-3 py-1 rounded-lg font-black uppercase">Omzet: {formatRupiah(envelopeMetrics.total)}</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-rose-50/50 border border-rose-100 p-5 rounded-2xl shadow-sm hover:border-rose-300 transition-colors">
            <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2">1. Beli Ayam (55%)</div>
            <div className="text-xl font-black text-rose-700">{formatRupiah(envelopeMetrics.amp1)}</div>
          </div>
          <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-2xl shadow-sm hover:border-blue-300 transition-colors">
            <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">2. Ops & Gaji (20%)</div>
            <div className="text-xl font-black text-blue-700">{formatRupiah(envelopeMetrics.amp2)}</div>
            <div className="mt-3 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div className={`h-full ${envelopeMetrics.statusGaji === 'AMAN_RESERVE' ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${Math.min(100, (envelopeMetrics.amp2 / envelopeMetrics.target) * 100)}%` }}></div>
            </div>
          </div>
          <div className="bg-amber-50/50 border border-amber-100 p-5 rounded-2xl shadow-sm hover:border-amber-300 transition-colors">
            <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">3. Dana Cadangan (10%)</div>
            <div className="text-xl font-black text-amber-600">{formatRupiah(envelopeMetrics.amp3)}</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 p-5 rounded-2xl shadow-sm transform hover:scale-105 transition-transform">
            <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">4. Laba Bos (15%)</div>
            <div className="text-xl font-black text-indigo-700">{formatRupiah(envelopeMetrics.amp4)}</div>
          </div>
        </div>
      </div>

      {/* FILTER PENCARIAN & CABANG */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Cari transaksi, klien, referensi..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 text-sm font-bold bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all shadow-sm" />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {isHQ && (
            <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-2xl border border-slate-200 shadow-sm w-full md:w-auto">
              <div className="pl-3 py-2 text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><Filter size={14}/> Cabang:</div>
              <select value={activeBranch} onChange={e => setActiveBranch(e.target.value)} className="bg-slate-50 border border-slate-100 rounded-xl text-xs font-black uppercase text-slate-700 py-2.5 px-3 outline-none cursor-pointer hover:bg-slate-100 transition-colors">
                <option value="ALL_BRANCHES">🌍 NASIONAL (SEMUA)</option>
                {/* LOOPING CABANG DINAMIS */}
                {branchList.map(b => <option key={b} value={b}>🏢 {b.replace('_', ' ')}</option>)}
              </select>
            </div>
          )}
          
          <button onClick={() => setShowManualModal(true)} className="bg-slate-900 text-white font-black text-xs uppercase tracking-widest px-5 py-3.5 rounded-2xl shadow-lg hover:bg-slate-800 transition-colors flex items-center gap-2 whitespace-nowrap">
            <Plus size={16}/> Catat Kas Manual
          </button>
        </div>
      </div>

      {/* TABEL BUKU REKENING KORAN (Mewah) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-xs uppercase text-slate-700 tracking-widest flex items-center gap-2"><ArrowRightLeft size={16} className="text-blue-500"/> Buku Riwayat Transaksi (Mutasi)</h3>
          <span className="text-[10px] font-bold text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">Menampilkan {filteredMutasi.length} Catatan</span>
        </div>
        
        <div className="overflow-x-auto flex-1 p-2 custom-scrollbar">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] uppercase text-slate-400 bg-white border-b border-slate-100">
              <tr>
                <th className="px-5 py-4 font-black">Waktu & Referensi</th>
                <th className="px-5 py-4 font-black">Kategori</th>
                <th className="px-5 py-4 font-black">Keterangan Transaksi</th>
                <th className="px-5 py-4 font-black text-center">Jalur Uang</th>
                <th className="px-5 py-4 font-black text-right">Mutasi Masuk</th>
                <th className="px-5 py-4 font-black text-right">Mutasi Keluar</th>
                <th className="px-5 py-4 font-black text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold">
              {filteredMutasi.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-20 text-slate-400"><div className="flex flex-col items-center gap-3"><Wallet size={48} className="text-slate-200"/><span className="font-bold text-sm">Tidak ada pergerakan uang di periode ini.</span></div></td></tr>
              ) : (
                filteredMutasi.map((trx, idx) => (
                  <tr key={`${trx.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="text-slate-800 font-bold text-sm">{formatDate(trx.date)}</div>
                      <div className="text-[9px] font-mono text-slate-400 mt-1">{trx.id}</div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider shadow-sm border ${trx.type === 'IN' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                        {trx.category}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-slate-700 uppercase font-bold text-xs line-clamp-2">{trx.description}</div>
                      {isHQ && trx.branch_id && trx.branch_id !== 'PUSAT' && <div className="text-[8px] mt-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 w-max rounded-md font-black uppercase tracking-wider">LOKASI: {trx.branch_id.replace('_', ' ')}</div>}
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      <span className="text-[9px] font-black uppercase text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg shadow-sm">
                        {trx.method}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {trx.type === 'IN' ? (
                        <span className="text-emerald-600 font-black text-sm flex items-center justify-end gap-1.5"><ArrowDownToLine size={12}/> {formatRupiah(trx.amount)}</span>
                      ) : <span className="text-slate-200">-</span>}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                       {trx.type === 'OUT' ? (
                        <span className="text-rose-600 font-black text-sm flex items-center justify-end gap-1.5"><ArrowUpRight size={12}/> {formatRupiah(trx.amount)}</span>
                      ) : <span className="text-slate-200">-</span>}
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                      {trx.category.includes('MANUAL') ? (
                         <button onClick={() => handlePrintKas(trx)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Cetak Bukti Kas"><Printer size={16}/></button>
                      ) : <span className="text-[9px] text-slate-300">OTOMATIS</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CATAT KAS MANUAL */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-black flex items-center gap-2 uppercase tracking-widest text-xs"><FileText size={16} className="text-blue-400"/> Form Catat Kas Manual</h3>
              <button onClick={() => setShowManualModal(false)} className="hover:bg-slate-800 p-1.5 rounded-lg transition-colors"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSaveManual} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Jenis Mutasi</label>
                  <select value={manualForm.type} onChange={e => setManualForm({...manualForm, type: e.target.value})} className={`w-full p-3 rounded-xl text-xs font-black outline-none border transition-colors cursor-pointer ${manualForm.type === 'IN' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                    <option value="IN">Uang Masuk (IN)</option>
                    <option value="OUT">Uang Keluar (OUT)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Tanggal</label>
                  <input type="date" required value={manualForm.date} onChange={e => setManualForm({...manualForm, date: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-black outline-none focus:border-blue-400" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Kategori / Referensi</label>
                <input type="text" required placeholder="Contoh: SETORAN INVESTOR / UANG BENSIN" value={manualForm.category} onChange={e => setManualForm({...manualForm, category: e.target.value.toUpperCase()})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none focus:border-blue-400" />
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Keterangan Detail</label>
                <input type="text" required placeholder="Jelaskan untuk keperluan apa..." value={manualForm.description} onChange={e => setManualForm({...manualForm, description: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Nominal Uang</label>
                  <input type="number" required placeholder="0" value={manualForm.amount} onChange={e => setManualForm({...manualForm, amount: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-lg font-black text-slate-800 outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Laci / Jalur</label>
                  <select value={manualForm.method} onChange={e => setManualForm({...manualForm, method: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-black outline-none cursor-pointer">
                    <option value="CASH">Tunai (Cash)</option>
                    <option value="TF">Transfer Bank</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="w-full text-white font-black py-4 rounded-xl text-sm uppercase tracking-widest shadow-lg bg-blue-600 hover:bg-blue-700 transition-colors mt-2">
                Simpan Mutasi Manual
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
