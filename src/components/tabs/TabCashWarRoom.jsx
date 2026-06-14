import React, { useState, useMemo } from 'react';
import { Wallet, ArrowDownToLine, ArrowUpRight, Search, Calendar, Landmark, Banknote, CreditCard, Filter, ArrowRightLeft, CheckCircle2, Package, Percent, ShieldAlert, Crown, Medal, CalendarClock } from 'lucide-react';
import { getTodayStr, formatDate, safeJsonParse } from '../../utils/helpers';

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
  const [activeBranch, setActiveBranch] = useState('ALL_BRANCHES'); 

  // --- DATABASE SINKRONISASI ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realCashflow = useMemo(() => cashflow_transactions_data || cashflow_transactions || [], [cashflow_transactions, cashflow_transactions_data]);
  
  // --- PARSING DAFTAR CABANG DINAMIS ---
  const dynamicBranchOptions = useMemo(() => {
    const rawBranches = master_branches || masterBranches || [];
    const activeList = rawBranches.filter(b => !b.isDeleted).map(b => ({
      id: b.branch_id,
      name: b.branch_name,
      type: b.branch_type
    }));

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
    
    // 1. Uang Masuk Kasir POS Penjualan
    realOrders.filter(o => !o.isDeleted && Number(o.amount_paid) > 0).forEach(o => {
      mutasi.push({ id: o.id, date: new Date(o.date), branch_id: o.branch_id || 'TANGERANG_PUSAT', type: 'IN', category: 'PENJUALAN DIMSUM', description: `Pembayaran: ${o.customer_name} (${o.sales_channel})`, method: o.payment_method || 'CASH', amount: Number(o.amount_paid) });
    });
    
    // 2. Pengeluaran Belanja Bahan Baku Dapur / Ayam
    realPurchases.filter(p => !p.isDeleted && Number(p.amount_paid) > 0).forEach(p => {
      mutasi.push({ id: p.id, date: new Date(p.date), branch_id: p.branch_id || 'TANGERANG_PUSAT', type: 'OUT', category: `BELANJA LOGISTIK`, description: `Ke Supplier: ${p.supplier_name} (${p.item_name})`, method: p.payment_method || 'CASH', amount: Number(p.amount_paid) });
    });
    
    // 3. Biaya Pengeluaran Biaya Operasional / Kasbon Manual
    realExpenses.filter(e => !e.isDeleted && Number(e.amount) > 0).forEach(e => {
      mutasi.push({ id: e.id || `EXP-${e.date}`, date: new Date(e.date), branch_id: e.branch_id || 'TANGERANG_PUSAT', type: 'OUT', category: 'PENGELUARAN LAIN', description: e.description || e.expense_name, method: e.payment_method || 'CASH', amount: Number(e.amount) });
    });
    
    // 4. Catatan Buku Arus Kas Manual
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

  // --- ENGINE ALOKASI 4 AMPLOP KONSOLIDASI (DOKTRIN SUCI 55% - 20% - 10% - 15%) ---
  const envelopeMetrics = useMemo(() => {
    let totalUangMasuk2Minggu = 0;
    const batas = new Date(); batas.setDate(batas.getDate() - 14);
    
    realOrders.filter(o => !o.isDeleted && new Date(o.date) >= batas).forEach(o => {
      if (activeBranch === 'ALL_BRANCHES' || o.branch_id === activeBranch) {
        let totalPcs = 0;
        const itemsArr = safeJsonParse(o.items, []);
        itemsArr.forEach(item => totalPcs += Number(item.qty || 0));
        if (totalPcs === 0) totalPcs = Number(o.qty || 0);

        totalUangMasuk2Minggu += Number(o.amount_paid || o.total_amount || 0);
      }
    });

    const KEWAJIBAN_GAJI = 25000000; 
    const TARGET_AMAN = KEWAJIBAN_GAJI * 2; 
    const amp2_ops = totalUangMasuk2Minggu * 0.20; // Alokasi Operasional & Pendukung (20%)
    
    let statusGaji = 'KRITIS';
    if (amp2_ops >= TARGET_AMAN) statusGaji = 'AMAN_RESERVE'; 
    else if (amp2_ops >= KEWAJIBAN_GAJI) statusGaji = 'CUKUP_BULAN_INI';

    return { 
      total: totalUangMasuk2Minggu, 
      amp1: totalUangMasuk2Minggu * 0.55,  // Jatah Kas Supplier Ayam Nana (55%)
      amp2: amp2_ops, 
      amp3: totalUangMasuk2Minggu * 0.10,  // Jatah Kas Jaga-jaga Pabrik (10%)
      amp4: totalUangMasuk2Minggu * 0.15,  // Profit Bersih Kantong Bos (15%)
      statusGaji, 
      target: TARGET_AMAN 
    };
  }, [realOrders, activeBranch]);

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      
      {/* PANEL UTAMA SMART WALLET - FLAT ENTERPRISE STYLE */}
      <div className="card-holo overflow-hidden flex flex-col">
        <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 bg-slate-50/50 relative">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600"></div>
          <div className="pl-2">
            <h2 className="text-lg md:text-xl font-extrabold text-slate-800 normal-case flex items-center gap-2">
              <Wallet size={20} className="text-red-600" /> Dompet &amp; kas perusahaan
            </h2>
            <p className="text-[10px] text-slate-500 font-bold normal-case mt-0.5">Pusat transparansi saldo fisik &amp; mutasi rekening</p>
          </div>

          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-xs w-full md:w-auto overflow-x-auto">
            {[{ id: 'TODAY', label: 'Hari ini' }, { id: '7_DAYS', label: '7 Hari' }, { id: 'THIS_MONTH', label: 'Bulan ini' }, { id: 'CUSTOM', label: 'Kustom' }].map(f => (
              <button key={f.id} type="button" onClick={() => setDateFilter(f.id)} className={`px-4 py-2 rounded-lg text-[10px] font-bold normal-case transition-all whitespace-nowrap ${dateFilter === f.id ? 'btn-holo shadow-xs' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {dateFilter === 'CUSTOM' && (
          <div className="bg-white p-4 border-b border-slate-200 flex flex-wrap gap-4 items-end animate-in fade-in">
            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Dari tanggal</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-lg text-xs font-bold outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Sampai tanggal</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2 rounded-lg text-xs font-bold outline-none focus:border-red-500" />
            </div>
          </div>
        )}

        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 bg-white">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between hover:border-emerald-300 transition-colors">
            <div>
              <div className="text-[10px] font-bold text-slate-500 normal-case flex items-center gap-1.5 mb-1"><Banknote size={14} className="text-emerald-500"/> Uang tunai / Laci kasir</div>
              <div className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(walletBalance.saldoCash)}</div>
            </div>
            <div className="mt-4 text-[9px] font-bold text-slate-400 normal-case pt-3 border-t border-slate-100">
              <span className="text-emerald-600">Total arus masuk: {formatRupiah(walletBalance.totalMasuk)}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between hover:border-blue-300 transition-colors">
            <div>
              <div className="text-[10px] font-bold text-slate-500 normal-case flex items-center gap-1.5 mb-1"><CreditCard size={14} className="text-blue-500"/> Saldo rekening bank</div>
              <div className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(walletBalance.saldoBank)}</div>
            </div>
            <div className="text-[9px] text-slate-400 font-medium mt-4 normal-case pt-3 border-t border-slate-100">
              *Uang digital masuk via transfer bank / QRIS
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-emerald-500 to-teal-500"></div>
            <div className="pl-2">
              <div className="text-[10px] font-bold text-slate-500 normal-case mb-1">Total likuiditas tunai siap cair</div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">{formatRupiah(walletBalance.totalNet)}</div>
            </div>
            <div className="mt-4 pl-2 text-[9px] font-extrabold normal-case text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md w-max border border-emerald-100">
              Kas konsolidasi
            </div>
          </div>
        </div>
      </div>

      {/* 💼 ALOKASI REKENING 4 AMPLOP VIRTUAL */}
      <div className="card-holo p-6 md:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-xs font-extrabold text-slate-800 normal-case flex items-center gap-2">
              <Wallet size={16} className="text-red-600"/> Alokasi brankas 4 amplop virtual (Siklus 2 minggu)
            </h3>
            <p className="text-[10px] text-slate-500 font-medium normal-case mt-1">Membelah omset kasir riil nasional mengikuti maklumat core nyawa</p>
          </div>
          <span className="text-[10px] bg-red-50 text-red-700 border border-red-100 px-3 py-1.5 rounded-lg font-bold normal-case shadow-xs">
            Omzet berjalan: {formatRupiah(envelopeMetrics.total)}
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* AMPLOP 1 */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl border-t-4 border-t-red-500 shadow-xs">
            <div className="text-[10px] font-bold text-slate-500 normal-case mb-1">1. Jatah kas ayam (55%)</div>
            <div className="text-xl font-black text-red-600 tracking-tight">{formatRupiah(envelopeMetrics.amp1)}</div>
            <div className="text-[8px] font-semibold text-slate-400 normal-case mt-2 pt-2 border-t border-slate-200">🔒 Rekening khusus supplier Nana Ayam</div>
          </div>
          
          {/* AMPLOP 2 */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-2 border-t-4 border-t-blue-500 shadow-xs flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <div className="text-[10px] font-bold text-slate-500 normal-case">2. Ops &amp; Gaji (20%)</div>
              <div className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-white border border-slate-200 normal-case text-slate-600 shadow-xs">
                {envelopeMetrics.statusGaji === 'AMAN_RESERVE' ? '🟢 Aman +1 bulan' : '🟡 Cukup bulan ini'}
              </div>
            </div>
            <div className="text-xl font-black text-blue-600 tracking-tight">{formatRupiah(envelopeMetrics.amp2)}</div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, (envelopeMetrics.amp2 / envelopeMetrics.target) * 100)}%` }}></div>
            </div>
          </div>

          {/* AMPLOP 3 */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl border-t-4 border-t-amber-500 shadow-xs">
            <div className="text-[10px] font-bold text-slate-500 normal-case mb-1">3. Jaga-jaga pabrik (10%)</div>
            <div className="text-xl font-black text-amber-600 tracking-tight">{formatRupiah(envelopeMetrics.amp3)}</div>
            <div className="text-[8px] font-semibold text-slate-400 normal-case mt-2 pt-2 border-t border-slate-200">🚨 Servis kompresor &amp; freezer</div>
          </div>

          {/* AMPLOP 4 */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl border-t-4 border-t-emerald-500 shadow-xs">
            <div className="text-[10px] font-bold text-slate-500 normal-case mb-1">4. Profit bersih owner (15%)</div>
            <div className="text-xl font-black text-emerald-600 tracking-tight">{formatRupiah(envelopeMetrics.amp4)}</div>
            <div className="text-[8px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 mt-2 normal-case flex items-center gap-1 w-max">
                <CheckCircle2 size={10}/> Aman masuk rekening pribadi
            </div>
          </div>
        </div>
      </div>

      {/* FILTER SEARCH & NODE CABANG */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input type="text" placeholder="Cari bukti mutasi kas..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold normal-case outline-none bg-white focus:border-red-500 shadow-sm transition-colors" />
        </div>
        
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm w-full md:w-auto">
          <span className="text-[10px] font-bold text-slate-500 normal-case">Pilih cabang / node:</span>
          <select value={activeBranch} onChange={e => setActiveBranch(e.target.value)} className="bg-slate-50 text-xs font-bold normal-case text-slate-800 py-1.5 px-3 outline-none cursor-pointer rounded-lg border border-slate-200">
            <option value="ALL_BRANCHES">🌍 Nasional (Gabungan seluruh cabang)</option>
            <option value="TANGERANG_PUSAT">🏢 Tangerang Pusat</option>
            {dynamicBranchOptions.filter(b => b.id !== 'TANGERANG_PUSAT' && b.id !== 'PUSAT').map(b => (
              <option key={b.id} value={b.id}>
                {b.type === 'PRODUCTION_BRANCH' ? '🏭' : '🏪'} {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TABEL REKENING KORAN MUTASI KONSOLIDASI */}
      <div className="card-holo flex flex-col overflow-hidden">
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-extrabold text-xs normal-case text-slate-800 flex items-center gap-2"><ArrowRightLeft size={16} className="text-red-600"/> Jurnal catatan koran mutasi kas</h4>
          <span className="text-[9px] font-bold text-slate-500 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-xs normal-case">Volume: {filteredMutasi.length} baris mutasi</span>
        </div>
        
        <div className="overflow-x-auto flex-1 custom-scrollbar min-h-[50vh]">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-[10px] normal-case text-slate-500 bg-slate-50/50 border-b border-slate-200 sticky top-0 shadow-xs">
              <tr>
                <th className="px-5 py-4 font-bold">Nota &amp; waktu</th>
                <th className="px-5 py-4 font-bold">Kategori buku</th>
                <th className="px-5 py-4 font-bold min-w-[250px]">Deskripsi aliran kas</th>
                <th className="px-5 py-4 font-bold text-center">Metode</th>
                <th className="px-5 py-4 font-bold text-right">Uang masuk</th>
                <th className="px-5 py-4 font-bold text-right">Uang keluar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
              {filteredMutasi.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-24 text-slate-400 bg-white">
                    <div className="flex flex-col items-center justify-center">
                      <ArrowRightLeft size={40} className="mb-3 opacity-20"/>
                      <span className="font-bold normal-case text-sm">Tidak ada pergerakan kas pada filter periode ini.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMutasi.map((trx, idx) => (
                  <tr key={`${trx.id}-${idx}`} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="text-slate-800 font-bold">{formatDate(trx.date)}</div>
                      <div className="text-[9px] font-mono text-slate-400 mt-1">{trx.id}</div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-md text-[9px] font-bold normal-case border shadow-xs ${trx.type === 'IN' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {trx.category.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-slate-800 normal-case font-bold text-xs line-clamp-2 group-hover:text-red-600 transition-colors leading-relaxed">{trx.description}</div>
                      <div className="text-[9px] text-slate-400 font-medium mt-1 normal-case">Cabang: {trx.branch_id?.replace('_', ' ')}</div>
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      <span className="text-[9px] font-bold normal-case text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md shadow-xs">
                        {trx.method.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {trx.type === 'IN' ? (
                        <span className="text-emerald-600 font-extrabold text-sm flex items-center justify-end gap-1"><ArrowDownToLine size={12}/> {formatRupiah(trx.amount)}</span>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                       {trx.type === 'OUT' ? (
                        <span className="text-red-600 font-extrabold text-sm flex items-center justify-end gap-1"><ArrowUpRight size={12}/> {formatRupiah(trx.amount)}</span>
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
