import React, { useState, useMemo } from 'react';
import { Scale, ArrowDownToLine, ArrowUpRight, TrendingUp, Calculator, Calendar, DollarSign, Percent, Building, Users, ShieldAlert, Award, Printer, Wallet, CreditCard, Banknote, Info } from 'lucide-react';
import { getTodayStr, formatDate, safeJsonParse } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabAccounting({ 
  orders = [], orders_data, 
  purchases = [], purchases_data, 
  expenses = [], expenses_data, 
  cashflowTransactions = [], cashflow_transactions, // SUNTIKAN BARU BACA ARUS KAS DOMPET
  user, setPrintData // SUNTIKAN FITUR PRINT LAPORAN
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  // --- STATE PERIODE FINANSIAL ---
  const [dateFilter, setDateFilter] = useState('THIS_MONTH'); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // --- DATABASE SINKRONISASI ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realCashflow = useMemo(() => cashflow_transactions || cashflowTransactions || [], [cashflow_transactions, cashflowTransactions]);

  // --- FILTER ENGINE PERIODE KALENDER ---
  const filteredData = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    let start = new Date(0); let end = new Date(); end.setHours(23,59,59,999);

    if (dateFilter === 'TODAY') {
      start = new Date(today);
    } else if (dateFilter === '7_DAYS') {
      start = new Date(today); start.setDate(start.getDate() - 7);
    } else if (dateFilter === '14_DAYS') {
      start = new Date(today); start.setDate(start.getDate() - 14); 
    } else if (dateFilter === 'THIS_MONTH') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (dateFilter === 'CUSTOM' && startDate && endDate) {
      start = new Date(startDate); start.setHours(0,0,0,0);
      end = new Date(endDate); end.setHours(23,59,59,999);
    }

    return { start, end };
  }, [dateFilter, startDate, endDate]);

  // --- ENGINE SALDO DOMPET FISIK (REAL-TIME ALL TIME) ---
  const walletBalances = useMemo(() => {
    let bca = 0; let bri = 0; let cash = 0;
    realCashflow.filter(c => !c.isDeleted).forEach(c => {
      const amt = Number(c.amount || 0);
      if (c.method === 'TF_BCA_PUSAT') { c.type === 'IN' ? bca += amt : bca -= amt; }
      else if (c.method === 'TF_BRI_PUSAT') { c.type === 'IN' ? bri += amt : bri -= amt; }
      else if (c.method === 'CASH') { c.type === 'IN' ? cash += amt : cash -= amt; }
    });
    return { bca, bri, cash };
  }, [realCashflow]);

  // --- ENGINE UTAMA PROFIT & LOSS ---
  const profitLossMetrics = useMemo(() => {
    let omzetJualan = 0;
    let modalBelanjaAyam = 0;
    let operasionalLainnya = 0;

    const { start, end } = filteredData;

    // 1. DARI NOTA JUALAN (ORDERS)
    realOrders.filter(o => !o.isDeleted).forEach(o => {
      const d = new Date(o.date);
      if (d >= start && d <= end) {
        omzetJualan += Number(o.total_amount || 0);
      }
    });

    // 2. DARI NOTA KULAKAN (PURCHASES)
    realPurchases.filter(p => !p.isDeleted).forEach(p => {
      const d = new Date(p.date);
      if (d >= start && d <= end) {
        if (p.category === 'BAHAN_BAKU') {
          modalBelanjaAyam += Number(p.total_amount || p.amount || 0);
        } else {
          operasionalLainnya += Number(p.total_amount || p.amount || 0);
        }
      }
    });

    // 3. DARI BIAYA LAIN (EXPENSES)
    realExpenses.filter(e => !e.isDeleted).forEach(e => {
      const d = new Date(e.date);
      if (d >= start && d <= end) {
        operasionalLainnya += Number(e.amount || 0);
      }
    });

    const totalBeban = modalBelanjaAyam + operasionalLainnya;
    const labaBersih = omzetJualan - totalBeban;
    const marginPersen = omzetJualan > 0 ? (labaBersih / omzetJualan) * 100 : 0;

    // 🔥 DOKTRIN 4 AMPLOP VIRTUAL (MODE SURVIVAL)
    const amplopAyam = omzetJualan * 0.55;         // 55% Beli Ayam & Selipan Hutang Lama
    const amplopOperasional = omzetJualan * 0.25;  // 25% Ops, Bumbu, Logistik Pemalang
    const amplopCicilan = omzetJualan * 0.15;      // 15% Leasing, Ruko, Mess, BRI
    const amplopCuanOwner = omzetJualan * 0.05;    // 5% Laba Pribadi Bos (Berdarah dulu)

    return { 
      omzetJualan, modalBelanjaAyam, operasionalLainnya, totalBeban, labaBersih, marginPersen,
      amplopAyam, amplopOperasional, amplopCicilan, amplopCuanOwner
    };
  }, [realOrders, realPurchases, realExpenses, filteredData]);

  // --- AKSI: CETAK LAPORAN NERACA ---
  const handlePrintLaporan = () => {
    if (typeof setPrintData !== 'function') return alert("Fungsi printer belum tersambung!");
    let periodeLabel = dateFilter.replace(/_/g, ' ');
    if (dateFilter === 'CUSTOM') periodeLabel = `${formatDate(startDate)} s.d ${formatDate(endDate)}`;

    setPrintData({
      type: 'INVOICE', 
      id: `LAPORAN-${todayStr.replace(/-/g,'')}`, 
      date: formatDate(todayStr), 
      branch_name: 'PABRIK TANGERANG PUSAT', 
      admin_name: user?.name || 'Sistem Akuntansi', 
      customer_name: 'Laporan Internal Owner', 
      position: 'Laporan Keuangan',
      notes: 'Doktrin 4 Amplop: Beli Ayam (55%), Operasional (25%), Cicilan & Aset (15%), Laba Bos (5%)',
      items: [
        { name: '1. Total Uang Masuk (Omset)', qty: 1, subtotal: profitLossMetrics.omzetJualan },
        { name: '2. Modal Belanja Ayam', qty: 1, subtotal: -profitLossMetrics.modalBelanjaAyam },
        { name: '3. Biaya Operasional & Gaji', qty: 1, subtotal: -profitLossMetrics.operasionalLainnya }
      ], 
      amount: profitLossMetrics.labaBersih, 
      paymentMethod: 'REKAP LAPORAN SISTEM',
      history: { 
        labelLama: 'Total Uang Masuk', nominalLama: profitLossMetrics.omzetJualan, 
        labelAksi: 'Total Modal Keluar', nominalAksi: profitLossMetrics.totalBeban, 
        labelBaru: 'KEUNTUNGAN BERSIH PABRIK', nominalBaru: profitLossMetrics.labaBersih 
      }
    });
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* HEADER CONTROL BULANAN & TOMBOL PRINT */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Scale className="text-blue-600" size={18}/> Jurnal Laba Rugi &amp; Cuan Bersih
          </h2>
          <p className="text-[10px] font-bold text-slate-500 mt-1">Rangkuman riil kesehatan uang masuk dikurangi modal operasional pabrik.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-xl border flex-wrap sm:flex-nowrap w-full sm:w-auto shadow-inner">
            {[
              { id: 'TODAY', label: 'Hari Ini' },
              { id: '7_DAYS', label: '7 Hari' },
              { id: '14_DAYS', label: '2 Minggu' },
              { id: 'THIS_MONTH', label: 'Bulan Ini' },
              { id: 'CUSTOM', label: 'Kustom' }
            ].map(f => (
              <button 
                key={f.id} 
                type="button"
                onClick={() => setDateFilter(f.id)} 
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black transition-all whitespace-nowrap ${dateFilter === f.id ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={handlePrintLaporan} className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] rounded-xl flex items-center justify-center gap-2 shadow-md transition-colors">
            <Printer size={14}/> Cetak Laporan
          </button>
        </div>
      </div>

      {/* PANEL KALENDER KUSTOM */}
      {dateFilter === 'CUSTOM' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end animate-in fade-in duration-200">
          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-1.5">Mulai Tanggal</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-slate-200 bg-slate-50 px-4 py-2 rounded-xl text-xs font-bold outline-none focus:border-blue-500 focus:bg-white" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-1.5">Sampai Tanggal</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-slate-200 bg-slate-50 px-4 py-2 rounded-xl text-xs font-bold outline-none focus:border-blue-500 focus:bg-white" />
          </div>
        </div>
      )}

      {/* 🔥 TIGA KARTU UTAMA FINANSIAL (FLUID GRADIENT) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-6 rounded-3xl border border-emerald-200 shadow-sm relative overflow-hidden">
          <div className="text-[11px] font-black text-emerald-700 flex items-center gap-2 mb-2">
            <ArrowDownToLine size={16}/> Total Uang Masuk (Omset)
          </div>
          <div className="text-3xl font-black text-emerald-800 tracking-tight">{formatRupiah(profitLossMetrics.omzetJualan)}</div>
          <p className="text-[10px] text-emerald-600/80 font-bold mt-2">*Murni dari total nota invoice kasir cabang/agen.</p>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 p-6 rounded-3xl border border-rose-200 shadow-sm relative overflow-hidden">
          <div className="text-[11px] font-black text-rose-700 flex items-center gap-2 mb-2">
            <ArrowUpRight size={16}/> Total Modal Keluar (HPP & Ops)
          </div>
          <div className="text-3xl font-black text-rose-800 tracking-tight">{formatRupiah(profitLossMetrics.totalBeban)}</div>
          <p className="text-[10px] text-rose-600/80 font-bold mt-2">*Akumulasi kulakan ayam, mika, listrik &amp; payroll.</p>
        </div>

        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-lg relative overflow-hidden">
          <DollarSign className="absolute -right-4 -bottom-4 text-emerald-500/10 pointer-events-none" size={130} />
          <div className="text-[11px] font-black text-emerald-400 flex items-center gap-2 mb-2 relative z-10">
            <TrendingUp size={16}/> Keuntungan Bersih (Profit Pabrik)
          </div>
          <div className="text-3xl font-black text-white tracking-tight relative z-10">{formatRupiah(profitLossMetrics.labaBersih)}</div>
          <div className="mt-3 flex items-center gap-2 relative z-10">
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${profitLossMetrics.labaBersih >= 0 ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/20 border-rose-500/30 text-rose-300'}`}>
              Sisa Margin Keuntungan: {Number(profitLossMetrics.marginPersen || 0).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* 🔥 KOMPARASI: WADAH FISIK (DOMPET) VS KEWAJIBAN 4 AMPLOP */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* PANEL KIRI: REALITA DOMPET (WADAH FISIK) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-5 bg-slate-50 border-b border-slate-100">
               <h3 className="font-black text-xs text-slate-800 flex items-center gap-2">
                 <Wallet size={16} className="text-blue-500"/> Realita Saldo Dompet (Wadah Fisik)
               </h3>
               <p className="text-[9px] font-bold text-slate-500 mt-1">Sisa uang riil yang tercatat di dalam sistem kasir/bank saat ini.</p>
            </div>
            
            <div className="p-5 space-y-4 flex-1">
              <div className="flex items-start gap-4 p-4 border border-blue-200 bg-blue-50/50 rounded-2xl">
                <div className="bg-blue-100 text-blue-600 p-2.5 rounded-xl border border-blue-200"><CreditCard size={20}/></div>
                <div>
                  <div className="text-[10px] font-black text-slate-500">Saldo Rekening BCA</div>
                  <div className="text-xl font-black text-blue-700 my-0.5">{formatRupiah(walletBalances.bca)}</div>
                  <div className="text-[9px] font-bold text-slate-500 flex items-center gap-1"><Info size={10}/> Wadah suci khusus Amplop 1 (Ayam).</div>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 border border-orange-200 bg-orange-50/50 rounded-2xl">
                <div className="bg-orange-100 text-orange-600 p-2.5 rounded-xl border border-orange-200"><CreditCard size={20}/></div>
                <div>
                  <div className="text-[10px] font-black text-slate-500">Saldo Rekening BRI</div>
                  <div className="text-xl font-black text-orange-700 my-0.5">{formatRupiah(walletBalances.bri)}</div>
                  <div className="text-[9px] font-bold text-slate-500 flex items-center gap-1"><Info size={10}/> Wadah untuk Amplop 3 (Cicilan) &amp; Amplop 4.</div>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 border border-emerald-200 bg-emerald-50/50 rounded-2xl">
                <div className="bg-emerald-100 text-emerald-600 p-2.5 rounded-xl border border-emerald-200"><Banknote size={20}/></div>
                <div>
                  <div className="text-[10px] font-black text-slate-500">Uang Tunai (Laci &amp; Brankas)</div>
                  <div className="text-xl font-black text-emerald-700 my-0.5">{formatRupiah(walletBalances.cash)}</div>
                  <div className="text-[9px] font-bold text-slate-500 flex items-center gap-1"><Info size={10}/> Wadah khusus Amplop 2 (Ops &amp; Gaji Harian).</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL KANAN: KEWAJIBAN 4 AMPLOP */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-5 bg-slate-50 border-b border-slate-100">
               <h3 className="font-black text-xs text-slate-800 flex items-center gap-2">
                 <Percent size={16} className="text-amber-500"/> Kewajiban 4 Amplop (Hak Uang)
               </h3>
               <p className="text-[9px] font-bold text-slate-500 mt-1">Pembagian jatah uang berdasarkan total omset {dateFilter.replace(/_/g, ' ').toLowerCase()}. Cocokkan angkanya dengan saldo dompet di samping.</p>
            </div>
            
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden border-t-4 border-t-blue-500">
                 <div className="flex justify-between items-start">
                    <div className="text-[10px] font-black text-slate-500">1. Uang Sakral Nana Ayam</div>
                    <span className="bg-blue-100 text-blue-700 font-black text-[9px] px-1.5 py-0.5 rounded shadow-sm">55%</span>
                 </div>
                 <p className="text-xl font-black text-blue-700 mt-2 tracking-tight">{formatRupiah(profitLossMetrics.amplopAyam)}</p>
                 <div className="text-[9px] font-bold text-slate-400 mt-2 pt-2 border-t border-slate-100 leading-snug">Wajib diamankan di BCA untuk modal ayam berikutnya + selipan hutang lama.</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden border-t-4 border-t-emerald-500">
                 <div className="flex justify-between items-start">
                    <div className="text-[10px] font-black text-slate-500">2. Ops, Bumbu, Logistik & Gaji</div>
                    <span className="bg-emerald-100 text-emerald-700 font-black text-[9px] px-1.5 py-0.5 rounded shadow-sm">25%</span>
                 </div>
                 <p className="text-xl font-black text-emerald-700 mt-2 tracking-tight">{formatRupiah(profitLossMetrics.amplopOperasional)}</p>
                 <div className="text-[9px] font-bold text-slate-400 mt-2 pt-2 border-t border-slate-100 leading-snug">Jatah untuk uang laci. Jika kurang, baru pindah buku tarik tunai dari BCA.</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden border-t-4 border-t-orange-500">
                 <div className="flex justify-between items-start">
                    <div className="text-[10px] font-black text-slate-500">3. Komitmen Cicilan &amp; Aset</div>
                    <span className="bg-orange-100 text-orange-700 font-black text-[9px] px-1.5 py-0.5 rounded shadow-sm">15%</span>
                 </div>
                 <p className="text-xl font-black text-orange-700 mt-2 tracking-tight">{formatRupiah(profitLossMetrics.amplopCicilan)}</p>
                 <div className="text-[9px] font-bold text-slate-400 mt-2 pt-2 border-t border-slate-100 leading-snug">Uang di transfer ke BRI untuk bayar Leasing Mobil, Motor, Mess, dan Auto-Debit.</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden border-t-4 border-t-amber-500">
                 <div className="flex justify-between items-start">
                    <div className="text-[10px] font-black text-slate-500">4. Laba Pribadi Bos (Survival)</div>
                    <span className="bg-amber-100 text-amber-700 font-black text-[9px] px-1.5 py-0.5 rounded shadow-sm">5%</span>
                 </div>
                 <p className="text-xl font-black text-amber-700 mt-2 tracking-tight">{formatRupiah(profitLossMetrics.amplopCuanOwner)}</p>
                 <div className="text-[9px] font-bold text-slate-400 mt-2 pt-2 border-t border-slate-100 leading-snug">Laba bersih Owner. Ditransfer ke BRI dan bisa dinikmati bersama keluarga.</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* LEMBAR KERJA AKUNTANSI */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
          <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
            <Calculator size={18} className="text-blue-500"/> Lembar Kerja Akuntansi (Sederhana Riil)
          </h3>
        </div>
        
        <div className="space-y-3 max-w-4xl">
          <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="font-black text-xs text-slate-700">A. Total Uang Masuk Pabrik (Hanya Invoice Kasir)</div>
            <div className="font-black text-emerald-600 text-sm">{formatRupiah(profitLossMetrics.omzetJualan)}</div>
          </div>

          <div className="pl-4 sm:pl-6 space-y-3 border-l-2 border-slate-200/60 ml-2 sm:ml-4 py-2">
            <div className="flex justify-between items-center">
              <div className="font-bold text-[11px] text-slate-500">(-) Modal Kulakan Bahan Baku Ayam</div>
              <div className="font-black text-rose-500 text-xs">-{formatRupiah(profitLossMetrics.modalBelanjaAyam)}</div>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-200">
              <div className="font-bold text-[11px] text-slate-500">(-) Biaya Operasional (Bumbu, Gaji, Listrik, Mika)</div>
              <div className="font-black text-rose-500 text-xs">-{formatRupiah(profitLossMetrics.operasionalLainnya)}</div>
            </div>
          </div>

          <div className={`flex justify-between items-center p-4 rounded-xl border transition-all mt-2 ${profitLossMetrics.labaBersih >= 0 ? 'bg-blue-50/50 border-blue-200' : 'bg-rose-50/50 border-rose-200'}`}>
            <div className={`font-black text-xs ${profitLossMetrics.labaBersih >= 0 ? 'text-blue-800' : 'text-rose-800'}`}>
              KEUNTUNGAN BERSIH KASIR (PROFIT RIIL)
            </div>
            <div className={`font-black text-xl tracking-tight ${profitLossMetrics.labaBersih >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>
              {formatRupiah(profitLossMetrics.labaBersih)}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
