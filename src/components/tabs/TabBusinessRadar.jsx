import React, { useState, useMemo } from 'react';
import { Activity, TrendingUp, ArrowDownToLine, ArrowUpRight, Award, ShoppingBag, BarChart3, PieChart, Users, Crown, Medal, CalendarClock, Package, Percent } from 'lucide-react';
import { getTodayStr, formatDate } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

// ESTIMASI HPP STANDARD UNTUK ANALITIK (Bisa disesuaikan dengan HPP Riil Pabrik)
const ESTIMASI_HPP_PER_PCS = 1150; 

export default function TabBusinessRadar({ 
  orders = [], orders_data, purchases = [], purchases_data, 
  expenses = [], expenses_data, cashflow_transactions = [], cashflow_transactions_data,
  masterBranches = [], master_branches, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';

  // --- STATE PERIODE ANALITIK ---
  const [timeRange, setTimeRange] = useState('TODAY'); // TODAY, 7_DAYS, 30_DAYS

  // --- SINKRONISASI DATABASE ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realCashflow = useMemo(() => cashflow_transactions_data || cashflow_transactions || [], [cashflow_transactions, cashflow_transactions_data]);

  // --- COMPILER ALGORITMA BIG DATA (LEADERBOARD & RADAR) ---
  const radarMetrics = useMemo(() => {
    const limitDate = new Date();
    let daysToCount = 0;
    if (timeRange === '7_DAYS') { daysToCount = 7; limitDate.setDate(limitDate.getDate() - 7); }
    else if (timeRange === '30_DAYS') { daysToCount = 30; limitDate.setDate(limitDate.getDate() - 30); }
    else { limitDate.setHours(0,0,0,0); } // TODAY

    // DATASET DASBOR UTAMA
    const trendMap = {};
    if (timeRange !== 'TODAY') {
      for (let i = daysToCount - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        trendMap[d.toISOString().substring(0, 10)] = { label: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), omzet: 0, beban: 0 };
      }
    } else {
      trendMap[todayStr] = { label: 'Hari Ini', omzet: 0, beban: 0 };
    }

    // DATASET CRM & LEADERBOARD
    const clientStats = {};
    const channelStats = {};

    let totalOmzet = 0;
    let totalBeban = 0;

    // 1. BEDAH DATA PENJUALAN (ORDERS)
    realOrders.filter(o => !o.isDeleted).forEach(o => {
      const orderDateStr = o.date.substring(0, 10);
      const d = new Date(o.date);
      
      let isIncluded = false;
      if (timeRange === 'TODAY' && orderDateStr === todayStr) isIncluded = true;
      else if (timeRange !== 'TODAY' && d >= limitDate) isIncluded = true;

      if (isIncluded) {
        const amt = Number(o.total_amount || 0);
        totalOmzet += amt;

        if (trendMap[orderDateStr]) trendMap[orderDateStr].omzet += amt;

        // PARSING JSON ITEMS UNTUK CARI VOLUME (PCS)
        let totalPcs = 0;
        try {
          const itemsArr = JSON.parse(o.items || '[]');
          itemsArr.forEach(item => totalPcs += Number(item.qty || 0));
        } catch(e) { totalPcs = 0; } // Fallback jika JSON rusak

        // Hitung HPP & Laba Analitik
        const estimasiHpp = totalPcs * ESTIMASI_HPP_PER_PCS;
        const labaBersih = amt - estimasiHpp;

        // INJEKSI KE ARENA 1 (KLIEN VIP)
        const custName = o.customer_name?.toUpperCase() || 'PELANGGAN ANONIM';
        if (!clientStats[custName]) clientStats[custName] = { qty: 0, omzet: 0, hpp: 0, profit: 0 };
        clientStats[custName].qty += totalPcs;
        clientStats[custName].omzet += amt;
        clientStats[custName].hpp += estimasiHpp;
        clientStats[custName].profit += labaBersih;

        // INJEKSI KE ARENA 2 (PLATFORM MERCHANT)
        const channelName = o.sales_channel?.toUpperCase() || 'ECERAN_WALKIN';
        if (!channelStats[channelName]) channelStats[channelName] = { qty: 0, omzet: 0, hpp: 0, profit: 0 };
        channelStats[channelName].qty += totalPcs;
        channelStats[channelName].omzet += amt;
        channelStats[channelName].hpp += estimasiHpp;
        channelStats[channelName].profit += labaBersih;
      }
    });

    // 2. BEDAH DATA PENGELUARAN (BEBAN)
    const processBeban = (arr, dateField, amountField) => {
      arr.filter(x => !x.isDeleted).forEach(x => {
        const dStr = x[dateField]?.substring(0, 10);
        const dObj = new Date(x[dateField]);
        let isIncluded = false;
        if (timeRange === 'TODAY' && dStr === todayStr) isIncluded = true;
        else if (timeRange !== 'TODAY' && dObj >= limitDate) isIncluded = true;

        if (isIncluded) {
          const amt = Number(x[amountField] || 0);
          totalBeban += amt;
          if (trendMap[dStr]) trendMap[dStr].beban += amt;
        }
      });
    };
    processBeban(realPurchases, 'date', 'total_amount');
    processBeban(realExpenses, 'date', 'amount');
    realCashflow.filter(c => !c.isDeleted && c.type === 'OUT').forEach(c => {
      const dStr = c.date.substring(0, 10);
      let isIncluded = false;
      if (timeRange === 'TODAY' && dStr === todayStr) isIncluded = true;
      else if (timeRange !== 'TODAY' && new Date(c.date) >= limitDate) isIncluded = true;
      if (isIncluded) {
        const amt = Number(c.amount || 0);
        totalBeban += amt;
        if (trendMap[dStr]) trendMap[dStr].beban += amt;
      }
    });

    // SORTING LEADERBOARD (Ambil Top 15 Berdasarkan Profit)
    const sortedClients = Object.entries(clientStats).sort((a,b) => b[1].profit - a[1].profit).slice(0, 15);
    const sortedChannels = Object.entries(channelStats).sort((a,b) => b[1].profit - a[1].profit).slice(0, 15);

    // KALKULASI SVG LINE CHART
    const trendArray = Object.values(trendMap);
    const maxOmzetValue = Math.max(...trendArray.map(t => Math.max(t.omzet, t.beban)), 100000);

    // MENGHITUNG TOTAL LABA KESELURUHAN (Untuk Rasio Persentase)
    const totalGlobalProfit = sortedChannels.reduce((sum, item) => sum + item[1].profit, 0);

    return {
      totalOmzet, totalBeban, netProfit: totalOmzet - totalBeban,
      trendArray, maxOmzetValue,
      topClients: sortedClients,
      topChannels: sortedChannels,
      totalGlobalProfit
    };
  }, [realOrders, realPurchases, realExpenses, realCashflow, timeRange, todayStr]);

  // --- ENGINE SVG LINE CHART ---
  const svgCoordinates = useMemo(() => {
    const width = 500; const height = 180;
    const points = radarMetrics.trendArray;
    const maxVal = radarMetrics.maxOmzetValue;

    if (points.length <= 1) return { omzetPath: '', bebanPath: '' };
    const stepX = width / (points.length - 1);
    let omzetPath = ''; let bebanPath = '';

    points.forEach((p, idx) => {
      const x = idx * stepX;
      const yOmzet = height - ((p.omzet / maxVal) * (height - 20));
      const yBeban = height - ((p.beban / maxVal) * (height - 20));
      if (idx === 0) { omzetPath = `M ${x} ${yOmzet}`; bebanPath = `M ${x} ${yBeban}`; } 
      else { omzetPath += ` L ${x} ${yOmzet}`; bebanPath += ` L ${x} ${yBeban}`; }
    });
    return { omzetPath, bebanPath };
  }, [radarMetrics]);

  // --- KOMPONEN BANTUAN UNTUK MEDALI RANKING ---
  const renderRankMedal = (index) => {
    if (index === 0) return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 border-2 border-white shadow-md flex items-center justify-center text-amber-900"><Crown size={16}/></div>;
    if (index === 1) return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-400 border-2 border-white shadow-md flex items-center justify-center text-slate-800"><Medal size={16}/></div>;
    if (index === 2) return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-200 to-orange-400 border-2 border-white shadow-md flex items-center justify-center text-orange-900"><Medal size={16}/></div>;
    return <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-black text-[10px]">#{index + 1}</div>;
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800">
      
      {/* HEADER CONTROL DASHBOARD */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-md flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 text-white">
        <div>
          <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
            <Activity className="text-emerald-400 animate-pulse"/> Radar Bisnis &amp; Analitik Sultan
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Pemantauan performa Klien VIP & Jalur Merchant secara Real-Time.</p>
        </div>

        {/* CONTROLLER SAKLAR FILTER WAKTU */}
        <div className="flex bg-slate-800 p-1.5 rounded-2xl border border-slate-700 shadow-inner">
          <button onClick={() => setTimeRange('TODAY')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${timeRange === 'TODAY' ? 'bg-emerald-500 text-slate-900 shadow-md scale-105' : 'text-slate-400 hover:text-white'}`}><CalendarClock size={12}/> Hari Ini</button>
          <button onClick={() => setTimeRange('7_DAYS')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${timeRange === '7_DAYS' ? 'bg-emerald-500 text-slate-900 shadow-md scale-105' : 'text-slate-400 hover:text-white'}`}><TrendingUp size={12}/> 7 Hari</button>
          <button onClick={() => setTimeRange('30_DAYS')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${timeRange === '30_DAYS' ? 'bg-emerald-500 text-slate-900 shadow-md scale-105' : 'text-slate-400 hover:text-white'}`}><BarChart3 size={12}/> 30 Hari</button>
        </div>
      </div>

      {/* TIGA KARTU INDIKATOR UTAMA FINANSIAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-blue-300 transition-colors">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><ArrowDownToLine size={12} className="text-blue-500"/> Total Omzet Masuk</div>
            <div className="text-2xl font-black text-slate-800 tracking-tight mt-1">{formatRupiah(radarMetrics.totalOmzet)}</div>
          </div>
          <div className="bg-blue-50 text-blue-600 p-3.5 rounded-2xl border border-blue-100 group-hover:scale-105 transition-transform"><TrendingUp size={24}/></div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-rose-300 transition-colors">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><ArrowUpRight size={12} className="text-rose-500"/> Total Pengeluaran</div>
            <div className="text-2xl font-black text-slate-800 tracking-tight mt-1">{formatRupiah(radarMetrics.totalBeban)}</div>
          </div>
          <div className="bg-rose-50 text-rose-600 p-3.5 rounded-2xl border border-rose-100 group-hover:scale-105 transition-transform"><ArrowUpRight size={24}/></div>
        </div>

        <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-200 shadow-sm flex items-center justify-between relative overflow-hidden transition-transform hover:scale-[1.01]">
          <div className="z-10">
            <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5"><Award size={12}/> Estimasi Saldo & Laba</div>
            <div className="text-3xl font-black tracking-tight mt-1 text-emerald-800">{formatRupiah(radarMetrics.netProfit)}</div>
          </div>
          <div className="bg-emerald-100 text-emerald-600 p-3.5 rounded-2xl border border-emerald-200 z-10"><Award size={24}/></div>
        </div>
      </div>

      {/* GRAFIK TREN GARIS HUB (Hanya Muncul Jika Lebih Dari 1 Hari) */}
      {timeRange !== 'TODAY' && radarMetrics.trendArray.length > 1 && (
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in">
          <h3 className="text-xs font-black uppercase text-slate-700 tracking-widest flex items-center gap-2 mb-6"><BarChart3 size={16} className="text-blue-500"/> Tren Pertumbuhan Omzet vs Beban</h3>
          <div className="w-full h-48 bg-slate-50 border rounded-2xl relative p-2 overflow-hidden shadow-inner">
            <svg className="w-full h-full" viewBox="0 0 500 180" preserveAspectRatio="none">
              <line x1="0" y1="45" x2="500" y2="45" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4"/>
              <line x1="0" y1="90" x2="500" y2="90" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4"/>
              <line x1="0" y1="135" x2="500" y2="135" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4"/>
              <path d={svgCoordinates.omzetPath} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d={svgCoordinates.bebanPath} fill="none" stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur border px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-4 shadow-sm z-10">
              <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-emerald-500 rounded-full"></span> Uang Masuk</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-rose-500 rounded-full"></span> Uang Keluar</div>
            </div>
          </div>
          <div className="flex justify-between items-center text-[9px] font-black text-slate-400 mt-3 px-1 uppercase tracking-widest">
            <span>{radarMetrics.trendArray[0]?.label || 'Awal'}</span>
            <span>{radarMetrics.trendArray[Math.floor(radarMetrics.trendArray.length / 2)]?.label || 'Tengah'}</span>
            <span>{radarMetrics.trendArray[radarMetrics.trendArray.length - 1]?.label || 'Akhir'}</span>
          </div>
        </div>
      )}

      {/* DUA ARENA LEADERBOARD SULTAN */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* ARENA 1: KLASEMEN PLATFORM / MERCHANT (GOFOOD, SHOPEE, DSB) */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest flex items-center gap-2">
              <ShoppingBag size={18} className="text-orange-500"/> Leaderboard Jalur Merchant
            </h3>
            <span className="text-[9px] font-black text-slate-400 bg-white border px-2 py-1 rounded-lg uppercase shadow-sm">Arena Merchant</span>
          </div>
          
          <div className="p-4 flex-1 flex flex-col gap-3">
            {radarMetrics.topChannels.length === 0 ? (
              <div className="text-center py-10 text-xs font-bold text-slate-400 uppercase">Belum ada transaksi di periode ini.</div>
            ) : (
              radarMetrics.topChannels.map(([name, stats], idx) => {
                const isProfit = stats.profit >= 0;
                const ratio = radarMetrics.totalGlobalProfit > 0 && isProfit ? (stats.profit / radarMetrics.totalGlobalProfit) * 100 : 0;

                return (
                  <div key={idx} className="flex items-center gap-4 p-4 border border-slate-100 rounded-2xl hover:bg-orange-50/30 transition-colors hover:border-orange-200 group">
                    {renderRankMedal(idx)}
                    <div className="flex-1">
                      <div className="font-black text-sm text-slate-800 uppercase group-hover:text-orange-600 transition-colors flex justify-between items-center">
                        <span>{name.replace('_', ' ')}</span>
                        <span className="text-xs">{formatRupiah(stats.omzet)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px] font-black uppercase tracking-wider">
                        <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100"><Package size={10}/> {formatNumber(stats.qty)} Pcs</span>
                        <span className="text-slate-500">Est. HPP: {formatRupiah(stats.hpp)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-[9px] font-black text-slate-400 uppercase mb-0.5 tracking-widest">Laba Amplop 4</div>
                      <div className={`font-black text-base ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isProfit ? '+' : ''}{formatRupiah(stats.profit)}
                      </div>
                      {ratio > 0 && <div className="text-[8px] font-black text-orange-500 flex items-center justify-end gap-0.5 mt-1"><Percent size={8}/> Kontribusi {ratio.toFixed(1)}%</div>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ARENA 2: KLASEMEN KLIEN VIP / AGEN PERSONAL */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest flex items-center gap-2">
              <Users size={18} className="text-blue-600"/> Klasemen Klien VIP & Agen
            </h3>
            <span className="text-[9px] font-black text-slate-400 bg-white border px-2 py-1 rounded-lg uppercase shadow-sm">Arena Personal</span>
          </div>
          
          <div className="p-4 flex-1 flex flex-col gap-3">
            {radarMetrics.topClients.length === 0 ? (
              <div className="text-center py-10 text-xs font-bold text-slate-400 uppercase">Belum ada transaksi di periode ini.</div>
            ) : (
              radarMetrics.topClients.map(([name, stats], idx) => {
                const isProfit = stats.profit >= 0;
                
                return (
                  <div key={idx} className="flex items-center gap-4 p-4 border border-slate-100 rounded-2xl hover:bg-blue-50/30 transition-colors hover:border-blue-200 group">
                    {renderRankMedal(idx)}
                    <div className="flex-1">
                      <div className="font-black text-sm text-slate-800 uppercase group-hover:text-blue-600 transition-colors flex justify-between items-center">
                        <span className="line-clamp-1">{name}</span>
                        <span className="text-xs shrink-0 ml-2">{formatRupiah(stats.omzet)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px] font-black uppercase tracking-wider">
                        <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100"><Package size={10}/> {formatNumber(stats.qty)} Pcs</span>
                        <span className="text-slate-500">Est. HPP: {formatRupiah(stats.hpp)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-[9px] font-black text-slate-400 uppercase mb-0.5 tracking-widest">Laba Bersih Klien</div>
                      <div className={`font-black text-base ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isProfit ? '+' : ''}{formatRupiah(stats.profit)}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
