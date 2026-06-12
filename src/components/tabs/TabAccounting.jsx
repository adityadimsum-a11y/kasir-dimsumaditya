import React, { useState, useMemo } from 'react';
import { Scale, ArrowDownToLine, ArrowUpRight, TrendingUp, Calculator, Calendar, DollarSign, Percent, Building, Users, ShieldAlert, Award } from 'lucide-react';
import { getTodayStr, formatDate, safeJsonParse } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabAccounting({ 
  orders = [], orders_data, purchases = [], purchases_data, 
  expenses = [], expenses_data, cashflow_transactions = [], cashflow_transactions_data,
  user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  // --- STATE PERIODE FINANSIAL BAWAAN ---
  const [dateFilter, setDateFilter] = useState('THIS_MONTH'); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // --- DATABASE SINKRONISASI BAWAAN ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realCashflow = useMemo(() => cashflow_transactions_data || cashflow_transactions || [], [cashflow_transactions, cashflow_transactions_data]);

  // --- FILTER ENGINE PERIODE KALENDER BAWAAN ---
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

  // --- ENGINE UTAMA PROFIT & LOSS BAWAAN + LIVE TOTALAN ---
  const profitLossMetrics = useMemo(() => {
    let omzetJualan = 0;
    let modalBelanjaAyam = 0;
    let operasionalLainnya = 0;

    const { start, end } = filteredData;

    realOrders.filter(o => !o.isDeleted).forEach(o => {
      const d = new Date(o.date);
      if (d >= start && d <= end) {
        omzetJualan += Number(o.total_amount || 0);
      }
    });

    realPurchases.filter(p => !p.isDeleted).forEach(p => {
      const d = new Date(p.date);
      if (d >= start && d <= end) {
        if (p.category === 'BAHAN_BAKU') {
          modalBelanjaAyam += Number(p.total_amount || 0);
        } else {
          operasionalLainnya += Number(p.total_amount || 0);
        }
      }
    });

    realExpenses.filter(e => !e.isDeleted).forEach(e => {
      const d = new Date(e.date);
      if (d >= start && d <= end) {
        operasionalLainnya += Number(e.amount || 0);
      }
    });

    realCashflow.filter(c => !c.isDeleted).forEach(c => {
      const d = new Date(c.date);
      if (d >= start && d <= end) {
        if (c.type === 'OUT') {
          operasionalLainnya += Number(c.amount || 0);
        } else if (c.type === 'IN' && c.category !== 'MODAL AWAL') {
          omzetJualan += Number(c.amount || 0);
        }
      }
    });

    const totalBeban = modalBelanjaAyam + operasionalLainnya;
    const labaBersih = omzetJualan - totalBeban;
    
    const marginPersen = omzetJualan > 0 ? (labaBersih / omzetJualan) * 100 : 0;

    // 🔥 ADJUSTMENT SUNTIKAN: HITUNGAN AUTOMATIC 4 AMPLOP BERDASARKAN DOKTRIN (55% - 20% - 10% - 15%)
    const amplopAyam = omzetJualan * 0.55;         // Amplop 1: Uang Sakral Beli Ayam (55%)
    const amplopOperasional = omzetJualan * 0.20; // Amplop 2: Operasional & Pendukung (20%)
    const amplopCadangan = omzetJualan * 0.10;    // Amplop 3: Dana Jaga-jaga Pabrik (10%)
    const amplopCuanOwner = omzetJualan * 0.15;   // Amplop 4: Laba Bersih Kantong Bos (15%)

    return { 
      omzetJualan, modalBelanjaAyam, operasionalLainnya, totalBeban, labaBersih, marginPersen,
      amplopAyam, amplopOperasional, amplopCadangan, amplopCuanOwner
    };
  }, [realOrders, realPurchases, realExpenses, realCashflow, filteredData]);

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* HEADER CONTROL BULANAN */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <Scale className="text-blue-600"/> Laporan Laba Rugi &amp; Cuan Bersih
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1">Rangkuman riil kesehatan uang masuk dikurangi modal operasional pabrik.</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl border flex-wrap sm:flex-nowrap w-full lg:w-auto shadow-inner">
          {[
            { id: 'TODAY', label: 'HARI INI' },
            { id: '7_DAYS', label: '7 HARI' },
            { id: '14_DAYS', label: '2 MINGGU' },
            { id: 'THIS_MONTH', label: 'BULAN INI' },
            { id: 'CUSTOM', label: 'KUSTOM' }
          ].map(f => (
            <button 
              key={f.id} 
              type="button"
              onClick={() => setDateFilter(f.id)} 
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${dateFilter === f.id ? 'bg-slate-900 text-white shadow-md scale-105' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* PANEL KALENDER KUSTOM */}
      {dateFilter === 'CUSTOM' && (
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end animate-in fade-in duration-200">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Mulai Tanggal</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl text-xs font-black outline-none focus:border-blue-500 focus:bg-white" />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Sampai Tanggal</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl text-xs font-black outline-none focus:border-blue-500 focus:bg-white" />
          </div>
        </div>
      )}

      {/* TIGA KARTU UTAMA FINANSIAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-50/60 p-6 rounded-3xl border border-emerald-100 shadow-sm">
          <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2 mb-2">
            <ArrowDownToLine size={14}/> Total Uang Masuk (Omzet)
          </div>
          <div className="text-3xl font-black text-emerald-700 tracking-tight">{formatRupiah(profitLossMetrics.omzetJualan)}</div>
          <p className="text-[10px] text-slate-500 font-bold mt-3 uppercase tracking-tight">*Gabungan seluruh bill kasir pada periode terpilih.</p>
        </div>

        <div className="bg-rose-50/60 p-6 rounded-3xl border border-rose-100 shadow-sm">
          <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2 mb-2">
            <ArrowUpRight size={14}/> Total Pengeluaran (Beban)
          </div>
          <div className="text-3xl font-black text-rose-700 tracking-tight">{formatRupiah(profitLossMetrics.totalBeban)}</div>
          <p className="text-[10px] text-slate-500 font-bold mt-3 uppercase tracking-tight">*Akumulasi beli ayam, mika, listrik, bensin, &amp; ops.</p>
        </div>

        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
          <DollarSign className="absolute -right-4 -bottom-4 text-white/5 pointer-events-none" size={130} />
          <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2 mb-2">
            <TrendingUp size={14}/> Laba Bersih Bersih (Net Profit)
          </div>
          <div className="text-4xl font-black text-white tracking-tight">{formatRupiah(profitLossMetrics.labaBersih)}</div>
          <div className="mt-3 flex items-center gap-2">
            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border tracking-wider ${profitLossMetrics.labaBersih >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
              Persentase Untung: {Number(profitLossMetrics.marginPersen || 0).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 🔥 ADJUSTMENT SUNTIKAN: VISUAL live MONITOR 4 AMPLOP SUCI */}
      {/* ======================================================== */}
      <div className="space-y-4">
         <h3 className="font-black text-xs uppercase text-slate-700 tracking-widest flex items-center gap-2 px-1">
            <Percent size={16} className="text-amber-500"/> Alokasi Brankas 4 Amplop Otomatis (Doktrin Core Nyawa)
         </h3>
         
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* AMPLOP 1: SAKRAL BELI AYAM (55%) */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm relative overflow-hidden border-t-8 border-t-rose-500">
               <div className="flex justify-between items-start">
                  <div className="bg-rose-100 text-rose-600 p-2 rounded-xl"><Building size={16}/></div>
                  <span className="bg-rose-500 text-white font-black text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm"><Percent size={10}/> 55%</span>
               </div>
               <div className="mt-4">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Amplop 1: Uang Sakral Beli Ayam</h4>
                  <p className="text-xl font-black text-rose-700 mt-1.5 tracking-tight">{formatRupiah(profitLossMetrics.amplopAyam)}</p>
               </div>
               <div className="text-[9px] font-bold text-rose-500 bg-rose-50 p-1.5 rounded-lg border border-rose-100 mt-4 uppercase">
                  🔒 Target Dana Klien untuk Supplier Nana Ayam
               </div>
            </div>

            {/* AMPLOP 2: OPERASIONAL & BAHAN PENDUKUNG (20%) */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm relative overflow-hidden border-t-8 border-t-blue-500">
               <div className="flex justify-between items-start">
                  <div className="bg-blue-100 text-blue-600 p-2 rounded-xl"><Users size={16}/></div>
                  <span className="bg-blue-500 text-white font-black text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm"><Percent size={10}/> 20%</span>
               </div>
               <div className="mt-4">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Amplop 2: Operasional &amp; Pendukung</h4>
                  <p className="text-xl font-black text-blue-700 mt-1.5 tracking-tight">{formatRupiah(profitLossMetrics.amplopOperasional)}</p>
               </div>
               <div className="text-[9px] font-bold text-blue-500 bg-blue-50 p-1.5 rounded-lg border border-blue-100 mt-4 uppercase">
                  🛠️ Target Kuota Bumbu, Mika, Listrik &amp; Gaji
               </div>
            </div>

            {/* AMPLOP 3: DANA CADANGAN & INVESTASI (10%) */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm relative overflow-hidden border-t-8 border-t-amber-500">
               <div className="flex justify-between items-start">
                  <div className="bg-amber-100 text-amber-600 p-2 rounded-xl"><Scale size={16}/></div>
                  <span className="bg-amber-500 text-white font-black text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm"><Percent size={10}/> 10%</span>
               </div>
               <div className="mt-4">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Amplop 3: Dana Jaga-jaga Pabrik</h4>
                  <p className="text-xl font-black text-amber-700 mt-1.5 tracking-tight">{formatRupiah(profitLossMetrics.amplopCadangan)}</p>
               </div>
               <div className="text-[9px] font-bold text-amber-500 bg-amber-50 p-1.5 rounded-lg border border-amber-100 mt-4 uppercase">
                  🚨 Cadangan Servis Freezer &amp; Modal Cabang
               </div>
            </div>

            {/* AMPLOP 4: CUAN BERSIH / TABUNGAN OWNER (15%) */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm relative overflow-hidden border-t-8 border-t-emerald-500">
               <div className="flex justify-between items-start">
                  <div className="bg-emerald-100 text-emerald-600 p-2 rounded-xl"><Award size={16}/></div>
                  <span className="bg-emerald-500 text-white font-black text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm"><Percent size={10}/> 15%</span>
               </div>
               <div className="mt-4">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Amplop 4: Tabungan Bersih Pribadi</h4>
                  <p className="text-xl font-black text-emerald-700 mt-1.5 tracking-tight">{formatRupiah(profitLossMetrics.amplopCuanOwner)}</p>
               </div>
               <div className="text-[9px] font-bold text-emerald-500 bg-emerald-50 p-1.5 rounded-lg border border-emerald-100 mt-4 uppercase">
                  💰 Profit Bersih Bebas Beban Pabrik[cite: 1]
               </div>
            </div>
         </div>
      </div>

      {/* LEMBAR KERJA HITUNGAN CUAN OWNER */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
          <h3 className="font-black text-xs uppercase text-slate-700 tracking-widest flex items-center gap-2">
            <Calculator size={16} className="text-blue-500"/> Lembar Kerja Hitungan Cuan Owner
          </h3>
          <div className="text-[9px] bg-slate-100 text-slate-500 border border-slate-200 font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
              Sistem Akuntansi: Sederhana Riil
          </div>
        </div>
        
        <div className="space-y-4 max-w-4xl">
          <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border">
            <div className="font-black text-xs sm:text-sm text-slate-700 uppercase tracking-wide">A. Total Pendapatan Kotor Pabrik</div>
            <div className="font-black text-emerald-600 text-base sm:text-lg">{formatRupiah(profitLossMetrics.omzetJualan)}</div>
          </div>

          <div className="pl-6 space-y-3.5 border-l-2 border-slate-200/60 ml-4 py-2">
            <div className="flex justify-between items-center">
              <div className="font-bold text-xs text-slate-500 uppercase tracking-tight">(-) Pembelian Bahan Baku Utama Pabrik (Modal Ayam Riil)</div>
              <div className="font-black text-rose-500 text-sm">{formatRupiah(profitLossMetrics.modalBelanjaAyam)}</div>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-dashed">
              <div className="font-bold text-xs text-slate-500 uppercase tracking-tight">(-) Biaya Operasional, Listrik, Bensin, Mika, &amp; Kas Manual Riil</div>
              <div className="font-black text-rose-500 text-sm">{formatRupiah(profitLossMetrics.operasionalLainnya)}</div>
            </div>
          </div>

          <div className={`flex justify-between items-center p-4 sm:p-5 rounded-2xl border transition-all ${profitLossMetrics.labaBersih >= 0 ? 'bg-blue-50/50 border-blue-200' : 'bg-rose-50/50 border-rose-200'}`}>
            <div className={`font-black text-xs sm:text-sm uppercase tracking-wider ${profitLossMetrics.labaBersih >= 0 ? 'text-blue-900' : 'text-rose-900'}`}>
              SISA HASIL AKHIR (LABA BERSIH BERSIH RIIL DI LAPANGAN)
            </div>
            <div className={`font-black text-lg sm:text-2xl tracking-tight ${profitLossMetrics.labaBersih >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>
              {formatRupiah(profitLossMetrics.labaBersih)}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
