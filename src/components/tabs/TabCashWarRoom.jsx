import React, { useState, useMemo } from 'react';
import { Wallet, ArrowDownToLine, ArrowUpRight, Search, Calendar, Landmark, Banknote, CreditCard, Filter, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { getTodayStr, formatDate } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabCashWarRoom({ 
  orders = [], orders_data, purchases = [], purchases_data, 
  expenses = [], expenses_data, cashflow_transactions = [], cashflow_transactions_data,
  masterBranches = [], master_branches, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  // --- STATE MANAJEMEN ---
  const [dateFilter, setDateFilter] = useState('THIS_MONTH'); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeBranch, setActiveBranch] = useState('ALL_BRANCHES'); // Default: Gabungan Nasional

  // --- DATABASE SINKRONISASI ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realCashflow = useMemo(() => cashflow_transactions_data || cashflow_transactions || [], [cashflow_transactions, cashflow_transactions_data]);
  
  // --- PARSING DAFTAR CABANG SEARA DINAMIS DARI SPREADSHEET ---
  const dynamicBranchOptions = useMemo(() => {
    const rawBranches = master_branches || masterBranches || [];
    // Ambil data cabang aktif yang tidak dihapus
    const activeList = rawBranches.filter(b => !b.isDeleted).map(b => ({
      id: b.branch_id,
      name: b.branch_name,
      type: b.branch_type
    }));

    // Jika database kosong, sistem otomatis pakai fallback data resmi Bos Aditya
    if (activeList.length === 0) {
      return [
        { id: 'TANGERANG_PUSAT', name: 'Tangerang Pusat', type: 'HQ_FACTORY' },
        { id: 'PRODUKSI_PEMALANG', name: 'Produksi Pemalang', type: 'PRODUCTION_BRANCH' },
        { id: 'CIBINONG', name: 'Resto Cibinong', type: 'OUTLET_RESTO' }
      ];
    }
    return activeList;
  }, [master_branches, masterBranches]);

  // --- ENGINE KONSOLIDASI BUKU MUTASI ---
  const allTransactions = useMemo(() => {
    let mutasi = [];
    
    // 1. Data Uang Masuk Kasir
    realOrders.filter(o => !o.isDeleted && Number(o.amount_paid) > 0).forEach(o => {
      mutasi.push({ id: o.id, date: new Date(o.date), branch_id: o.branch_id || 'TANGERANG_PUSAT', type: 'IN', category: 'PENJUALAN DIMSUM', description: `Pembayaran: ${o.customer_name} (${o.sales_channel})`, method: o.payment_method || 'CASH', amount: Number(o.amount_paid) });
    });
    
    // 2. Data Pengeluaran Pembelian Logistik
    realPurchases.filter(p => !p.isDeleted && Number(p.amount_paid) > 0).forEach(p => {
      mutasi.push({ id: p.id, date: new Date(p.date), branch_id: p.branch_id || 'TANGERANG_PUSAT', type: 'OUT', category: `BELANJA LOGISTIK`, description: `Ke Supplier: ${p.supplier_name} (${p.item_name})`, method: p.payment_method || 'CASH', amount: Number(p.amount_paid) });
    });
    
    // 3. Data Biaya Pengeluaran Lain-lain
    realExpenses.filter(e => !e.isDeleted && Number(e.amount) > 0).forEach(e => {
      mutasi.push({ id: e.id || `EXP-${e.date}`, date: new Date(e.date), branch_id: e.branch_id || 'TANGERANG_PUSAT', type: 'OUT', category: 'PENGELUARAN LAIN', description: e.description || e.expense_name, method: e.payment_method || 'CASH', amount: Number(e.amount) });
    });
    
    // 4. Data Kas Manual & Operasional Tambahan (Pindahan dari Tahap 2)
    realCashflow.filter(c => !c.isDeleted && Number(c.amount) > 0).forEach(c => {
      mutasi.push({ id: c.id, date: new Date(c.date), branch_id: c.branch_id || 'TANGERANG_PUSAT', type: c.type, category: c.category || 'KAS MANUAL', description: c.description, method: c.method || 'CASH', amount: Number(c.amount) });
    });
    
    return mutasi.sort((a, b) => b.date - a.date);
  }, [realOrders, realPurchases, realExpenses, realCashflow]);

  // --- FILTER MUTASI PERIODE & CABANG ---
  const filteredMutasi = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    let start = new Date(0); let end = new Date(); end.setHours(23,59,59,999);
    
    if (dateFilter === 'TODAY') { start = new Date(today); } 
    else if (dateFilter === '7_DAYS') { start = new Date(today); start.setDate(start.getDate() - 7); } 
    else if (dateFilter === 'THIS_MONTH') { start = new Date(today.getFullYear(), today.getMonth(), 1); } 
    else if (dateFilter === 'CUSTOM' && startDate && endDate) { start = new Date(startDate); start.setHours(0,0,0,0); end = new Date(endDate); end.setHours(23,59,59,999); }

    return allTransactions.filter(trx => {
      // Logic filter dinamis multi-branch
      if (activeBranch !== 'ALL_BRANCHES') {
        if (trx.branch_id !== activeBranch) return false;
      }
      if (trx.date < start || trx.date > end) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!trx.description.toLowerCase().includes(s) && !trx.id.toLowerCase().includes(s) && !trx.category.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [allTransactions, dateFilter, startDate, endDate, searchTerm, activeBranch]);

  // --- HITUNG METRIK SALDO AKHIR REKENING ---
  const walletBalance = useMemo(() => {
    let cashIn = 0; let cashOut = 0; let bankIn = 0; let bankOut = 0;
    filteredMutasi.forEach(trx => {
      const isBank = ['TF', 'TRANSFER', 'BANK', 'QRIS', 'DP'].includes(trx.method?.toUpperCase());
      if (trx.type === 'IN') { if (isBank) bankIn += trx.amount; else cashIn += trx.amount; } 
      else { if (isBank) bankOut += trx.amount; else cashOut += trx.amount; }
    });
    return { saldoCash: cashIn - cashOut, saldoBank: bankIn - bankOut, totalNet: (cashIn - cashOut) + (bankIn - bankOut), totalMasuk: cashIn + bankIn, totalKeluar: cashOut + bankOut };
  }, [filteredMutasi]);

  // --- CORE ENGINE METHOD 4 AMPLOP VIRTUAL KONSOLIDASI ---
  const envelopeMetrics = useMemo(() => {
    let totalUangMasuk2Minggu = 0;
    const batas = new Date(); batas.setDate(batas.getDate() - 14);
    
    // Mengambil total omzet riil nasional atau cabang sesuai filter berjalan dalam siklus 2 minggu
    realOrders.filter(o => !o.isDeleted && new Date(o.date) >= batas).forEach(o => {
      if (activeBranch === 'ALL_BRANCHES' || o.branch_id === activeBranch) {
        totalUangMasuk2Minggu += Number(o.amount_paid || o.total_amount || 0);
      }
    });

    const KEWAJIBAN_GAJI = 25000000; 
    const TARGET_AMAN = KEWAJIBAN_GAJI * 2; // Gaji bulan berjalan + Cadangan 1 bulan kedepan
    const amp2_ops = totalUangMasuk2Minggu * 0.20;
    
    let statusGaji = 'KRITIS';
    if (amp2_ops >= TARGET_AMAN) statusGaji = 'AMAN_RESERVE'; 
    else if (amp2_ops >= KEWAJIBAN_GAJI) statusGaji = 'CUKUP_BULAN_INI';

    return { total: totalUangMasuk2Minggu, amp1: totalUangMasuk2Minggu * 0.55, amp2: amp2_ops, amp3: totalUangMasuk2Minggu * 0.10, amp4: totalUangMasuk2Minggu * 0.15, statusGaji, target: TARGET_AMAN };
  }, [realOrders, activeBranch]);

  return (
    <div className="space-y-6 pb-10 text-slate-800">
      
      {/* 💳 PANEL UTAMA: DESAIN SMART WALLET (RINGAN & TANPA BLUR) */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-md overflow-hidden">
        <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 bg-slate-950">
          <div>
            <h2 className="text-xl font-black text-white tracking-widest uppercase flex items-center gap-2">
              <Wallet size={24} className="text-emerald-400" /> Dompet &amp; Kas Perusahaan
            </h2>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Pusat Transparansi Saldo Fisik &amp; Mutasi Rekening</p>
          </div>

          {/* FILTER KALENDER CEPAT */}
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 w-full md:w-auto overflow-x-auto">
            {[{ id: 'TODAY', label: 'HARI INI' }, { id: '7_DAYS', label: '7 HARI' }, { id: 'THIS_MONTH', label: 'BULAN INI' }, { id: 'CUSTOM', label: 'KUSTOM' }].map(f => (
              <button key={f.id} onClick={() => setDateFilter(f.id)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${dateFilter === f.id ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {dateFilter === 'CUSTOM' && (
          <div className="bg-slate-800 p-4 border-b border-slate-700 flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Dari Tanggal</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded-lg text-xs font-black outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Sampai Tanggal</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded-lg text-xs font-black outline-none" />
            </div>
          </div>
        )}

        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-900">
          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700 shadow-sm relative overflow-hidden">
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><Banknote size={12}/> Uang Tunai / Laci Kasir</div>
            <div className="text-2xl font-black text-white tracking-tight">{formatRupiah(walletBalance.saldoCash)}</div>
            <div className="mt-4 flex gap-3 text-[9px] font-bold text-slate-400">
              <span className="text-emerald-400">Masuk: {formatRupiah(walletBalance.totalMasuk)}</span>
            </div>
          </div>

          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700 shadow-sm relative overflow-hidden">
            <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><CreditCard size={12}/> Saldo Rekening Bank</div>
            <div className="text-2xl font-black text-white tracking-tight">{formatRupiah(walletBalance.saldoBank)}</div>
            <div className="text-[9px] text-slate-500 font-bold mt-4">*Uang digital masuk via Transfer Bank / QRIS</div>
          </div>

          <div className="bg-gradient-to-br from-emerald-600 to-teal-800 p-5 rounded-2xl border border-emerald-500 shadow-md">
            <div className="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-1">Total Likuiditas Siap Cair</div>
            <div className="text-3xl font-black text-white tracking-tight">{formatRupiah(walletBalance.totalNet)}</div>
            <div className="mt-4 text-[9px] font-black uppercase text-emerald-100 bg-black/20 px-2.5 py-1 rounded-md w-max">Periode Berjalan</div>
          </div>
        </div>
      </div>

      {/* 💼 RUMAH ASLI 4 AMPLOP VIRTUAL — KONSOLIDASI (UI SMOOTH) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <Wallet size={16} className="text-indigo-600"/> Alokasi 4 Amplop Virtual Dimsum Aditya
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Siklus Anggaran Berjalan: 2 Minggu Terakhir</p>
          </div>
          <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1.5 rounded-xl font-black uppercase">Total Omzet: {formatRupiah(envelopeMetrics.total)}</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-rose-50/50 border border-rose-100 p-5 rounded-2xl">
            <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">1. Dana Ayam (55%)</div>
            <div className="text-xl font-black text-rose-700">{formatRupiah(envelopeMetrics.amp1)}</div>
          </div>
          
          <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-2xl space-y-2">
            <div className="flex justify-between items-center">
              <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest">2. Ops &amp; Gaji (20%)</div>
              <div className="text-[9px] font-black text-blue-700">
                {envelopeMetrics.statusGaji === 'AMAN_RESERVE' ? '🟢 AMAN +1 BULAN' : '🟡 AMAN BULAN INI'}
              </div>
            </div>
            <div className="text-xl font-black text-blue-700">{formatRupiah(envelopeMetrics.amp2)}</div>
            <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, (envelopeMetrics.amp2 / envelopeMetrics.target) * 100)}%` }}></div>
            </div>
          </div>

          <div className="bg-amber-50/50 border border-amber-100 p-5 rounded-2xl">
            <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">3. Jaga-jaga Pabrik (10%)</div>
            <div className="text-xl font-black text-amber-700">{formatRupiah(envelopeMetrics.amp3)}</div>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 p-5 rounded-2xl">
            <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">4. Bersih Tabungan Bos (15%)</div>
            <div className="text-xl font-black text-indigo-700">{formatRupiah(envelopeMetrics.amp4)}</div>
            <div className="text-[9px] text-slate-400 font-bold mt-1.5 border-t border-indigo-100/50 pt-1">👉 Pindahkan ke ATM Pribadi</div>
          </div>
        </div>
      </div>

      {/* FILTER PENCARIAN & SELECT CABANG DINAMIS */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input type="text" placeholder="Cari mutasi kas..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 text-xs font-bold outline-none bg-white focus:border-emerald-400 shadow-sm" />
        </div>
        
        {/* FILTRASI CABANG 4 PILIHAN MUTLAK (SINKRON SPREADSHEET) */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-slate-200 shadow-sm w-full md:w-auto">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Pilih Node Cabang:</span>
          <select value={activeBranch} onChange={e => setActiveBranch(e.target.value)} className="bg-slate-50 text-xs font-black uppercase text-slate-700 py-2 px-3 outline-none cursor-pointer rounded-xl border border-slate-200/50">
            <option value="ALL_BRANCHES">🌍 NASIONAL (GABUNGAN ALL)</option>
            <option value="TANGERANG_PUSAT">🏢 TANGERANG PUSAT</option>
            {/* Cabang-cabang lain yang ditarik dari Spreadsheet otomatis ngetrend di sini */}
            {dynamicBranchOptions.filter(b => b.id !== 'TANGERANG_PUSAT' && b.id !== 'PUSAT').map(b => (
              <option key={b.id} value={b.id}>
                {b.type === 'PRODUCTION_BRANCH' ? '🏭' : '🏪'} {b.name.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TABEL BUKU REKENING KORAN (RINGAN TANPA BERAT) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-black text-xs uppercase text-slate-700 tracking-widest flex items-center gap-2"><ArrowRightLeft size={14} className="text-blue-500"/> Jurnal Rekening Koran Mutasi Konsolidasi</h4>
          <span className="text-[9px] font-black text-slate-500 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">VOLUME: {filteredMutasi.length} KORAN</span>
        </div>
        
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] uppercase text-slate-400 bg-white border-b">
              <tr>
                <th className="px-5 py-3 font-black">Nota &amp; Waktu</th>
                <th className="px-5 py-3 font-black">Kategori Buku</th>
                <th className="px-5 py-3 font-black">Deskripsi Aliran Kas</th>
                <th className="px-5 py-3 font-black text-center">Laci</th>
                <th className="px-5 py-3 font-black text-right">Uang Masuk</th>
                <th className="px-5 py-3 font-black text-right">Uang Keluar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold">
              {filteredMutasi.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-16 text-slate-400 font-bold uppercase tracking-wide">Bersih. Tidak ada pergerakan mutasi kas di filter ini.</td></tr>
              ) : (
                filteredMutasi.map((trx, idx) => (
                  <tr key={`${trx.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="text-slate-800 font-bold">{formatDate(trx.date)}</div>
                      <div className="text-[9px] font-mono text-slate-400 mt-0.5">{trx.id}</div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${trx.type === 'IN' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                        {trx.category}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-slate-700 uppercase font-black text-xs line-clamp-1">{trx.description}</div>
                      <div className="text-[8px] text-slate-400 font-black mt-1 uppercase">NODE ORIGIN: {trx.branch_id?.replace('_', ' ')}</div>
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      <span className="text-[9px] font-black uppercase text-slate-500 bg-slate-50 border px-2 py-0.5 rounded shadow-sm">
                        {trx.method}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {trx.type === 'IN' ? (
                        <span className="text-emerald-600 font-black text-sm flex items-center justify-end gap-1"><ArrowDownToLine size={11}/> {formatRupiah(trx.amount)}</span>
                      ) : <span className="text-slate-200">-</span>}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                       {trx.type === 'OUT' ? (
                        <span className="text-rose-600 font-black text-sm flex items-center justify-end gap-1"><ArrowUpRight size={11}/> {formatRupiah(trx.amount)}</span>
                      ) : <span className="text-slate-200">-</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
