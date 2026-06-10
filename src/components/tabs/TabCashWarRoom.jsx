import React, { useState, useMemo } from 'react';
import { Wallet, ArrowDownToLine, ArrowUpRight, Search, Calendar, Landmark, Banknote, CreditCard, Filter, ArrowRightLeft } from 'lucide-react';
import { formatDate } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabCashWarRoom({ orders = [], orders_data, purchases = [], purchases_data, expenses = [], expenses_data, user }) {
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';

  // --- FILTER STATE ---
  const [dateFilter, setDateFilter] = useState('THIS_MONTH'); // TODAY, 7_DAYS, THIS_MONTH, CUSTOM
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeBranch, setActiveBranch] = useState(currentBranch);

  // --- DATABASE SINKRONISASI ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);

  // --- ENGINE BUKU MUTASI (MENGGABUNGKAN SEMUA ARUS KAS) ---
  const allTransactions = useMemo(() => {
    let mutasi = [];

    // 1. Uang Masuk (Penjualan)
    realOrders.filter(o => !o.isDeleted).forEach(o => {
      if (Number(o.amount_paid) > 0) {
        mutasi.push({
          id: o.id,
          date: new Date(o.date),
          branch_id: o.branch_id,
          type: 'IN',
          category: 'PENJUALAN DIMSUM',
          description: `Pembayaran dari: ${o.customer_name} (${o.sales_channel})`,
          method: o.payment_method || 'CASH',
          amount: Number(o.amount_paid)
        });
      }
    });

    // 2. Uang Keluar (Belanja Logistik & Ayam)
    realPurchases.filter(p => !p.isDeleted).forEach(p => {
      if (Number(p.amount_paid) > 0) {
        mutasi.push({
          id: p.id,
          date: new Date(p.date),
          branch_id: p.branch_id,
          type: 'OUT',
          category: `BELANJA ${p.category}`,
          description: `Pembayaran ke: ${p.supplier_name}`,
          method: p.payment_method || 'CASH',
          amount: Number(p.amount_paid)
        });
      }
    });

    // 3. Uang Keluar (Pengeluaran Operasional Lainnya)
    realExpenses.filter(e => !e.isDeleted).forEach(e => {
      if (Number(e.amount) > 0) {
        mutasi.push({
          id: e.id || `EXP-${e.date}`,
          date: new Date(e.date),
          branch_id: e.branch_id,
          type: 'OUT',
          category: 'BIAYA OPERASIONAL',
          description: e.description || e.expense_name || 'Pengeluaran Kas',
          method: e.payment_method || 'CASH',
          amount: Number(e.amount)
        });
      }
    });

    // Urutkan dari yang terbaru
    return mutasi.sort((a, b) => b.date - a.date);
  }, [realOrders, realPurchases, realExpenses]);

  // --- FILTER DATA BERDASARKAN TANGGAL & PENCARIAN ---
  const filteredMutasi = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    let start = new Date(0); // Default awalan (semua waktu)
    let end = new Date(); // Hari ini
    end.setHours(23,59,59,999);

    if (dateFilter === 'TODAY') {
      start = new Date(today);
    } else if (dateFilter === '7_DAYS') {
      start = new Date(today);
      start.setDate(start.getDate() - 7);
    } else if (dateFilter === 'THIS_MONTH') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (dateFilter === 'CUSTOM' && startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0,0,0,0);
      end = new Date(endDate);
      end.setHours(23,59,59,999);
    }

    return allTransactions.filter(trx => {
      // Filter Cabang (Owner Mode)
      if (activeBranch !== 'ALL_BRANCHES' && trx.branch_id !== activeBranch && trx.branch_id !== 'PUSAT') return false;
      
      // Filter Tanggal
      if (trx.date < start || trx.date > end) return false;

      // Filter Pencarian Text
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        if (!trx.description.toLowerCase().includes(searchLower) && 
            !trx.id.toLowerCase().includes(searchLower) &&
            !trx.category.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }, [allTransactions, dateFilter, startDate, endDate, searchTerm, activeBranch]);

  // --- KALKULASI SALDO DOMPET BERDASARKAN FILTER ---
  const walletBalance = useMemo(() => {
    let cashIn = 0; let cashOut = 0;
    let bankIn = 0; let bankOut = 0;

    filteredMutasi.forEach(trx => {
      const isBank = ['TF', 'TRANSFER', 'BANK', 'QRIS'].includes(trx.method?.toUpperCase());
      if (trx.type === 'IN') {
        if (isBank) bankIn += trx.amount; else cashIn += trx.amount;
      } else {
        if (isBank) bankOut += trx.amount; else cashOut += trx.amount;
      }
    });

    const saldoCash = cashIn - cashOut;
    const saldoBank = bankIn - bankOut;
    const totalMasuk = cashIn + bankIn;
    const totalKeluar = cashOut + bankOut;

    return { saldoCash, saldoBank, totalNet: saldoCash + saldoBank, totalMasuk, totalKeluar };
  }, [filteredMutasi]);

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-500">
      
      {/* HEADER: KARTU DOMPET PERUSAHAAN */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800 relative">
          <Landmark className="absolute right-0 top-0 opacity-5 scale-150 transform -translate-y-10 translate-x-10" size={300} />
          
          <div className="relative z-10">
            <h2 className="text-2xl font-black text-white tracking-widest uppercase flex items-center gap-3">
              <Wallet size={28} className="text-emerald-400" /> Dompet & Kas Perusahaan
            </h2>
            <p className="text-xs text-slate-400 font-bold mt-1 tracking-wider uppercase">Mode Pengawasan Owner: Mutasi Keuangan Transparan</p>
          </div>

          {/* FILTER KALENDER CEPAT */}
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 relative z-10 w-full md:w-auto overflow-x-auto">
            {[
              { id: 'TODAY', label: 'HARI INI' },
              { id: '7_DAYS', label: '7 HARI' },
              { id: 'THIS_MONTH', label: 'BULAN INI' },
              { id: 'CUSTOM', label: 'KUSTOM' }
            ].map(f => (
              <button 
                key={f.id} 
                onClick={() => setDateFilter(f.id)}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${dateFilter === f.id ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {dateFilter === 'CUSTOM' && (
          <div className="bg-slate-800/50 p-4 border-b border-slate-700 flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Dari Tanggal</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded-lg text-xs outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Sampai Tanggal</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded-lg text-xs outline-none focus:border-emerald-500" />
            </div>
          </div>
        )}

        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          {/* LACI TUNAI KASIR */}
          <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/50 relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
            <Banknote className="absolute -right-4 -bottom-4 text-emerald-500/10 group-hover:text-emerald-500/20 transition-colors" size={120} />
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2 mb-2"><Banknote size={14}/> Laci Uang Tunai (Cash)</div>
            <div className="text-3xl font-black text-white tracking-tight">{formatRupiah(walletBalance.saldoCash)}</div>
            <div className="mt-4 flex gap-4 text-[10px] font-bold text-slate-400">
              <span className="flex items-center gap-1"><ArrowDownToLine size={10} className="text-emerald-400"/> In: {formatRupiah(walletBalance.totalMasuk)}</span>
              <span className="flex items-center gap-1"><ArrowUpRight size={10} className="text-rose-400"/> Out: {formatRupiah(walletBalance.totalKeluar)}</span>
            </div>
          </div>

          {/* REKENING BANK */}
          <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/50 relative overflow-hidden group hover:border-blue-500/50 transition-colors">
            <CreditCard className="absolute -right-4 -bottom-4 text-blue-500/10 group-hover:text-blue-500/20 transition-colors" size={120} />
            <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-2"><CreditCard size={14}/> Saldo Bank (Transfer)</div>
            <div className="text-3xl font-black text-white tracking-tight">{formatRupiah(walletBalance.saldoBank)}</div>
            <div className="mt-4 flex gap-4 text-[10px] font-bold text-slate-400">
               *Uang yang masuk via TF & EDC
            </div>
          </div>

          {/* TOTAL LIKUID */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-800 p-5 rounded-2xl border border-emerald-500 shadow-lg relative overflow-hidden transform hover:scale-[1.02] transition-transform">
            <Wallet className="absolute -right-4 -bottom-4 text-white/10" size={120} />
            <div className="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-2">Total Harta Likuid (Tunai + Bank)</div>
            <div className="text-4xl font-black text-white tracking-tight">{formatRupiah(walletBalance.totalNet)}</div>
            <div className="mt-4 flex gap-2 text-[9px] font-black uppercase text-emerald-100 bg-black/20 px-3 py-1.5 rounded-lg w-max backdrop-blur-sm">
               Total Periode Ini
            </div>
          </div>
        </div>
      </div>

      {/* FILTER PENCARIAN MUTASI */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-10 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Cari transaksi, klien, nomor resi..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-bold bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all shadow-sm"
          />
        </div>
        
        {isHQ && (
          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full md:w-auto">
            <div className="pl-3 py-2 text-[10px] font-black uppercase text-slate-400"><Filter size={12} className="inline mr-1"/> Cabang:</div>
            <select value={activeBranch} onChange={e => setActiveBranch(e.target.value)} className="bg-slate-50 border-none text-xs font-black uppercase text-slate-700 py-2 pr-4 outline-none cursor-pointer rounded-lg">
              <option value="ALL_BRANCHES">🌍 NASIONAL (SEMUA)</option>
              <option value="TANGERANG_PUSAT">🏢 TANGERANG PUSAT</option>
            </select>
          </div>
        )}
      </div>

      {/* TABEL BUKU REKENING KORAN */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-xs uppercase text-slate-700 tracking-widest flex items-center gap-2"><ArrowRightLeft size={16} className="text-blue-500"/> Buku Riwayat Transaksi (Mutasi)</h3>
          <span className="text-[10px] font-bold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">Menampilkan {filteredMutasi.length} Catatan</span>
        </div>
        
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] uppercase text-slate-500 bg-white border-b border-slate-100">
              <tr>
                <th className="px-5 py-4 font-black">Waktu & Referensi</th>
                <th className="px-5 py-4 font-black">Kategori</th>
                <th className="px-5 py-4 font-black">Keterangan Transaksi</th>
                <th className="px-5 py-4 font-black text-center">Jalur Uang</th>
                <th className="px-5 py-4 font-black text-right">Mutasi Masuk</th>
                <th className="px-5 py-4 font-black text-right">Mutasi Keluar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold">
              {filteredMutasi.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-16 text-slate-400"><div className="flex flex-col items-center gap-2"><Wallet size={40} className="text-slate-200"/><span className="font-bold text-sm">Tidak ada pergerakan uang di periode ini.</span></div></td></tr>
              ) : (
                filteredMutasi.map((trx, idx) => (
                  <tr key={`${trx.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="text-slate-800 font-bold">{formatDate(trx.date)}</div>
                      <div className="text-[9px] font-mono text-slate-400 mt-0.5">{trx.id}</div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${trx.type === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {trx.category}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-slate-700 uppercase font-bold text-xs line-clamp-2">{trx.description}</div>
                      {isHQ && trx.branch_id && trx.branch_id !== 'PUSAT' && <div className="text-[8px] mt-1 bg-indigo-50 text-indigo-600 px-1.5 py-0.5 w-max rounded font-black uppercase">DARI CABANG: {trx.branch_id}</div>}
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      <span className="text-[9px] font-black uppercase text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg">
                        {trx.method}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {trx.type === 'IN' ? (
                        <span className="text-emerald-600 font-black text-sm flex items-center justify-end gap-1"><ArrowDownToLine size={12}/> {formatRupiah(trx.amount)}</span>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                       {trx.type === 'OUT' ? (
                        <span className="text-rose-600 font-black text-sm flex items-center justify-end gap-1"><ArrowUpRight size={12}/> {formatRupiah(trx.amount)}</span>
                      ) : <span className="text-slate-300">-</span>}
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
