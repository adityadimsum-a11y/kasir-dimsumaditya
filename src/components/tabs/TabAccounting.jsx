import React, { useState, useMemo } from 'react';
import { Scale, ArrowDownToLine, ArrowUpRight, TrendingUp, Calculator, Calendar, DollarSign, Percent, Building, Users, ShieldAlert, Award } from 'lucide-react';
import { getTodayStr, formatDate, safeJsonParse } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabAccounting({ 
  orders = [], orders_data, 
  purchases = [], purchases_data, 
  expenses = [], expenses_data, 
  user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  // --- STATE PERIODE FINANSIAL BAWAAN ---
  const [dateFilter, setDateFilter] = useState('THIS_MONTH'); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // --- DATABASE SINKRONISASI BAWAAN AMAN ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);

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

  // --- ENGINE UTAMA PROFIT & LOSS (FIXED DOUBLE COUNT) ---
  const profitLossMetrics = useMemo(() => {
    let omzetJualan = 0;
    let modalBelanjaAyam = 0;
    let operasionalLainnya = 0;

    const { start, end } = filteredData;

    // 1. MURNI HANYA BACA DARI NOTA JUALAN (ORDERS)
    realOrders.filter(o => !o.isDeleted).forEach(o => {
      const d = new Date(o.date);
      if (d >= start && d <= end) {
        omzetJualan += Number(o.total_amount || 0);
      }
    });

    // 2. MURNI HANYA BACA DARI NOTA KULAKAN (PURCHASES)
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

    // 3. MURNI HANYA BACA DARI BIAYA LAIN (EXPENSES)
    realExpenses.filter(e => !e.isDeleted).forEach(e => {
      const d = new Date(e.date);
      if (d >= start && d <= end) {
        operasionalLainnya += Number(e.amount || 0);
      }
    });

    const totalBeban = modalBelanjaAyam + operasionalLainnya;
    const labaBersih = omzetJualan - totalBeban;
    const marginPersen = omzetJualan > 0 ? (labaBersih / omzetJualan) * 100 : 0;

    // DOKTRIN 4 AMPLOP VIRTUAL
    const amplopAyam = omzetJualan * 0.55;         
    const amplopOperasional = omzetJualan * 0.20; 
    const amplopCadangan = omzetJualan * 0.10;    
    const amplopCuanOwner = omzetJualan * 0.15;   

    return { 
      omzetJualan, modalBelanjaAyam, operasionalLainnya, totalBeban, labaBersih, marginPersen,
      amplopAyam, amplopOperasional, amplopCadangan, amplopCuanOwner
    };
  }, [realOrders, realPurchases, realExpenses, filteredData]);

  return (
    <div className="space-y-6 pb-10 text-slate-800 normal-case animate-in fade-in duration-300">
      
      {/* HEADER CONTROL BULANAN */}
      <div className="card-holo bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-sm font-black text-slate-800 normal-case flex items-center gap-2">
            <Scale className="text-blue-600" size={18}/> Jurnal Laba Rugi &amp; Cuan Bersih
          </h2>
          <p className="text-[10px] font-bold text-slate-500 mt-1 normal-case">Rangkuman riil kesehatan uang masuk dikurangi modal operasional pabrik.</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border flex-wrap sm:flex-nowrap w-full lg:w-auto shadow-inner">
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
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black normal-case transition-all whitespace-nowrap ${dateFilter === f.id ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* PANEL KALENDER KUSTOM */}
      {dateFilter === 'CUSTOM' && (
        <div className="card-holo bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-4 items-end animate-in fade-in duration-200">
          <div>
            <label className="text-[10px] font-bold text-slate-500 normal-case block mb-1.5">Mulai Tanggal</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-slate-200 bg-slate-50 px-4 py-2 rounded-xl text-xs font-bold outline-none focus:border-blue-500 focus:bg-white" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 normal-case block mb-1.5">Sampai Tanggal</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-slate-200 bg-slate-50 px-4 py-2 rounded-xl text-xs font-bold outline-none focus:border-blue-500 focus:bg-white" />
          </div>
        </div>
      )}

      {/* TIGA KARTU UTAMA FINANSIAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-50/60 p-6 rounded-2xl border border-emerald-100 shadow-xs">
          <div className="text-[10px] font-black text-emerald-600 normal-case flex items-center gap-2 mb-2">
            <ArrowDownToLine size={14}/> Total Pendapatan Kotor (Omzet)
          </div>
          <div className="text-2xl font-black text-emerald-700 tracking-tight">{formatRupiah(profitLossMetrics.omzetJualan)}</div>
          <p className="text-[9px] text-slate-500 font-bold mt-2 normal-case">*Murni dari total nota invoice kasir cabang/agen.</p>
        </div>

        <div className="bg-rose-50/60 p-6 rounded-2xl border border-rose-100 shadow-xs">
          <div className="text-[10px] font-black text-rose-600 normal-case flex items-center gap-2 mb-2">
            <ArrowUpRight size={14}/> Total Pengeluaran (Beban Ops)
          </div>
          <div className="text-2xl font-black text-rose-700 tracking-tight">{formatRupiah(profitLossMetrics.totalBeban)}</div>
          <p className="text-[9px] text-slate-500 font-bold mt-2 normal-case">*Akumulasi kulakan ayam, mika, listrik &amp; payroll.</p>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-md relative overflow-hidden">
          <DollarSign className="absolute -right-4 -bottom-4 text-white/5 pointer-events-none" size={130} />
          <div className="text-[10px] font-black text-emerald-400 normal-case flex items-center gap-2 mb-2">
            <TrendingUp size={14}/> Laba Bersih (Net Profit)
          </div>
          <div className="text-3xl font-black text-white tracking-tight">{formatRupiah(profitLossMetrics.labaBersih)}</div>
          <div className="mt-3 flex items-center gap-2">
            <span className={`text-[9px] font-black normal-case px-2.5 py-1 rounded-md border tracking-wider ${profitLossMetrics.labaBersih >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
              Margin Keuntungan: {Number(profitLossMetrics.marginPersen || 0).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* ALOKASI 4 AMPLOP OTOMATIS */}
      <div className="space-y-4">
         <h3 className="font-black text-xs normal-case text-slate-700 flex items-center gap-2 px-1">
            <Percent size={16} className="text-amber-500"/> Simulasi Brankas 4 Amplop Doktrin Utama
         </h3>
         
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden border-t-4 border-t-rose-500">
               <div className="flex justify-between items-start">
                  <div className="text-[10px] font-black text-slate-400 normal-case">Amplop 1: Uang Sakral Beli Ayam</div>
                  <span className="bg-rose-100 text-rose-700 font-black text-[9px] px-1.5 py-0.5 rounded shadow-3xs">55%</span>
               </div>
               <p className="text-lg font-black text-rose-700 mt-2 tracking-tight">{formatRupiah(profitLossMetrics.amplopAyam)}</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden border-t-4 border-t-blue-500">
               <div className="flex justify-between items-start">
                  <div className="text-[10px] font-black text-slate-400 normal-case">Amplop 2: Ops &amp; Gaji Tim</div>
                  <span className="bg-blue-100 text-blue-700 font-black text-[9px] px-1.5 py-0.5 rounded shadow-3xs">20%</span>
               </div>
               <p className="text-lg font-black text-blue-700 mt-2 tracking-tight">{formatRupiah(profitLossMetrics.amplopOperasional)}</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden border-t-4 border-t-amber-500">
               <div className="flex justify-between items-start">
                  <div className="text-[10px] font-black text-slate-400 normal-case">Amplop 3: Dana Cadangan Pabrik</div>
                  <span className="bg-amber-100 text-amber-700 font-black text-[9px] px-1.5 py-0.5 rounded shadow-3xs">10%</span>
               </div>
               <p className="text-lg font-black text-amber-700 mt-2 tracking-tight">{formatRupiah(profitLossMetrics.amplopCadangan)}</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden border-t-4 border-t-emerald-500">
               <div className="flex justify-between items-start">
                  <div className="text-[10px] font-black text-slate-400 normal-case">Amplop 4: Profit Bersih Owner</div>
                  <span className="bg-emerald-100 text-emerald-700 font-black text-[9px] px-1.5 py-0.5 rounded shadow-3xs">15%</span>
               </div>
               <p className="text-lg font-black text-emerald-700 mt-2 tracking-tight">{formatRupiah(profitLossMetrics.amplopCuanOwner)}</p>
            </div>
         </div>
      </div>

      {/* LEMBAR KERJA HITUNGAN CUAN OWNER */}
      <div className="card-holo bg-white rounded-3xl border border-slate-200 shadow-xs p-6 md:p-8">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
          <h3 className="font-black text-xs normal-case text-slate-800 flex items-center gap-2">
            <Calculator size={16} className="text-blue-500"/> Lembar Kerja Akuntansi (Sederhana Riil)
          </h3>
        </div>
        
        <div className="space-y-3 max-w-4xl">
          <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="font-black text-xs text-slate-700 normal-case">A. Total Pendapatan Kotor Pabrik (Hanya Invoice Kasir)</div>
            <div className="font-black text-emerald-600 text-sm">{formatRupiah(profitLossMetrics.omzetJualan)}</div>
          </div>

          <div className="pl-4 sm:pl-6 space-y-3 border-l-2 border-slate-200/60 ml-2 sm:ml-4 py-2">
            <div className="flex justify-between items-center">
              <div className="font-bold text-[11px] text-slate-500 normal-case">(-) Modal Kulakan Bahan Baku Ayam</div>
              <div className="font-black text-rose-500 text-xs">-{formatRupiah(profitLossMetrics.modalBelanjaAyam)}</div>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-200">
              <div className="font-bold text-[11px] text-slate-500 normal-case">(-) Biaya Operasional (Bumbu, Gaji, Listrik, Mika)</div>
              <div className="font-black text-rose-500 text-xs">-{formatRupiah(profitLossMetrics.operasionalLainnya)}</div>
            </div>
          </div>

          <div className={`flex justify-between items-center p-4 rounded-xl border transition-all mt-2 ${profitLossMetrics.labaBersih >= 0 ? 'bg-blue-50/50 border-blue-200' : 'bg-rose-50/50 border-rose-200'}`}>
            <div className={`font-black text-xs normal-case ${profitLossMetrics.labaBersih >= 0 ? 'text-blue-800' : 'text-rose-800'}`}>
              LABA BERSIH (NET INCOME OPERASIONAL)
            </div>
            <div className={`font-black text-lg tracking-tight ${profitLossMetrics.labaBersih >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>
              {formatRupiah(profitLossMetrics.labaBersih)}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
