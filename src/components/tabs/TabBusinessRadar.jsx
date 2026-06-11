import React, { useState, useMemo } from 'react';
import { Activity, TrendingUp, ArrowDownToLine, ArrowUpRight, Award, ShoppingBag, BarChart3, PieChart, Users, Crown, Medal, CalendarClock, Package, Percent, ShieldAlert, AlertOctagon, HelpCircle } from 'lucide-react';
import { getTodayStr, formatDate } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

// ESTIMASI HPP STANDARD UNTUK ANALITIK PABRIKAN
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

  // --- SINKRONISASI DATABASE CLOUD ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realCashflow = useMemo(() => cashflow_transactions_data || cashflow_transactions || [], [cashflow_transactions, cashflow_transactions_data]);

  // --- COMPILER ALGORITMA CORE KEUANGAN & LEADERBOARD ---
  const radarMetrics = useMemo(() => {
    const limitDate = new Date();
    let daysToCount = 0;
    if (timeRange === '7_DAYS') { daysToCount = 7; limitDate.setDate(limitDate.getDate() - 7); }
    else if (timeRange === '30_DAYS') { daysToCount = 30; limitDate.setDate(limitDate.getDate() - 30); }
    else { limitDate.setHours(0,0,0,0); } // TODAY

    // AREA DATASET TREN GRAFIK
    const trendMap = {};
    if (timeRange !== 'TODAY') {
      for (let i = daysToCount - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        trendMap[d.toISOString().substring(0, 10)] = { label: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), omzet: 0, beban: 0 };
      }
    } else {
      trendMap[todayStr] = { label: 'Hari Ini', omzet: 0, beban: 0 };
    }

    const clientStats = {};
    const channelStats = {};

    let totalOmzet = 0;
    let totalBeban = 0;
    let totalPcsHariIni = 0;
    let omzetHariIniRealtime = 0;

    // 1. ANALISIS DATA ORDERS (OMZET & VOLUME)
    realOrders.filter(o => !o.isDeleted).forEach(o => {
      const orderDateStr = o.date.substring(0, 10);
      const d = new Date(o.date);
      
      let isIncluded = false;
      if (timeRange === 'TODAY' && orderDateStr === todayStr) isIncluded = true;
      else if (timeRange !== 'TODAY' && d >= limitDate) isIncluded = true;

      // Hitung Volume Pcs dari JSON String
      let totalPcs = 0;
      try {
        const itemsArr = JSON.parse(o.items || '[]');
        itemsArr.forEach(item => totalPcs += Number(item.qty || 0));
      } catch(e) { totalPcs = 0; }

      if (orderDateStr === todayStr) {
        totalPcsHariIni += totalPcs;
        omzetHariIniRealtime += Number(o.total_amount || 0);
      }

      if (isIncluded) {
        const amt = Number(o.total_amount || 0);
        totalOmzet += amt;

        if (trendMap[orderDateStr]) trendMap[orderDateStr].omzet += amt;

        const estimasiHpp = totalPcs * ESTIMASI_HPP_PER_PCS;
        const labaBersih = amt - estimasiHpp;

        // ARENA 1: KLIEN PERSONAL
        const custName = o.customer_name?.toUpperCase() || 'PELANGGAN ANONIM';
        if (!clientStats[custName]) clientStats[custName] = { qty: 0, omzet: 0, hpp: 0, profit: 0 };
        clientStats[custName].qty += totalPcs;
        clientStats[custName].omzet += amt;
        clientStats[custName].hpp += estimasiHpp;
        clientStats[custName].profit += labaBersih;

        // ARENA 2: PLATFORM / MERCHANT MALAM
        const channelName = o.sales_channel?.toUpperCase() || 'ECERAN_WALKIN';
        if (!channelStats[channelName]) channelStats[channelName] = { qty: 0, omzet: 0, hpp: 0, profit: 0 };
        channelStats[channelName].qty += totalPcs;
        channelStats[channelName].omzet += amt;
        channelStats[channelName].hpp += estimasiHpp;
        channelStats[channelName].profit += labaBersih;
      }
    });

    // 2. ANALISIS DATA BEBAN PABRIKAN
    const processBeban = (arr, dateField, amountField, isPurchaseTable = false) => {
      arr.filter(x => !x.isDeleted).forEach(x => {
        const dStr = x[dateField]?.substring(0, 10);
        const dObj = new Date(x[dateField]);
        let isIncluded = false;
        if (timeRange === 'TODAY' && dStr === todayStr) isIncluded = true;
        else if (timeRange !== 'TODAY' && dObj >= limitDate) isIncluded = true;

        if (isIncluded) {
          // Jika purchase menggunakan metode BON_GANTUNG, tetap masuk beban akumulasi P&L radar
          const amt = Number(x[amountField] || 0);
          totalBeban += amt;
          if (trendMap[dStr]) trendMap[dStr].beban += amt;
        }
      });
    };
    processBeban(realPurchases, 'date', 'total_amount', true);
    processBeban(realExpenses, 'date', 'amount');
    realCashflow.filter(c => !c.isDeleted && c.type === 'OUT').forEach(c => {
      const dStr = c.date.substring(0, 10);
      let isIncluded = false;
      if (timeRange === 'TODAY' && dStr === todayStr) isIncluded = true;
      else if (timeRange !== 'TODAY' && new Date(c.date) >= limitDate) isIncluded = true;
      if (isIncluded) {
        totalBeban += Number(c.amount || 0);
        if (trendMap[dStr]) trendMap[dStr].beban += Number(c.amount || 0);
      }
    });

    // RADAR UNTUK FOLLOW-UP TRANSAKSI MACET JATUH TEMPO
    const outstandingDebtsAndReceivables = [];
    
    // Tarik Piutang Agen Belum Lunas
    realOrders.filter(o => !o.isDeleted && ['DP', 'HUTANG'].includes(o.payment_method) && o.status !== 'SELESAI').forEach(o => {
      if (!isHQ && o.branch_id !== currentBranch) return;
      let paid = Number(o.amount_paid || 0);
      realCashflow.filter(c => !c.isDeleted && c.type === 'IN' && c.reference_id === o.id).forEach(c => paid += Number(c.amount || 0));
      const sisa = Number(o.total_amount || 0) - paid;
      if (sisa > 0) {
        outstandingDebtsAndReceivables.push({ id: o.id, name: o.customer_name, type: 'PIUTANG AGEN', amount: sisa, date: o.date, labelClass: 'bg-orange-50 text-orange-700 border-orange-200' });
      }
    });

    // Tarik Hutang Ayam / Supplier Gantung (BON GANTUNG)
    realPurchases.filter(p => !p.isDeleted && (p.payment_method === 'BON_GANTUNG' || p.payment_method === 'HUTANG') && p.status !== 'LUNAS').forEach(p => {
      if (!isHQ && p.branch_id !== currentBranch) return;
      let paid = Number(p.amount_paid || 0);
      realCashflow.filter(c => !c.isDeleted && c.type === 'OUT' && c.reference_id === p.id).forEach(c => paid += Number(c.amount || 0));
      const sisa = Number(p.total_amount || p.amount || 0) - paid;
      if (sisa > 0) {
        outstandingDebtsAndReceivables.push({ id: p.id, name: p.supplier_name || 'SUPPLIER AYAM', type: 'HUTANG BON GANTUNG', amount: sisa, date: p.date, labelClass: 'bg-rose-50 text-rose-700 border-rose-200' });
      }
    });

    // ESTIMASI SPLIT 4 AMPLOP VIRTUAL HARI INI
    const hppHari Ini = totalPcsHariIni * ESTIMASI_HPP_PER_PCS;
    const sisaBahanBaku55 = omzetHariIniRealtime * 0.55;
    const opsGaji20 = omzetHariIniRealtime * 0.20;
    const cadangan10 = omzetHariIniRealtime * 0.10;
    const profitBersih15 = omzetHariIniRealtime * 0.15;

    const sortedClients = Object.entries(clientStats).sort((a,b) => b[1].profit - a[1].profit).slice(0, 10);
    const sortedChannels = Object.entries(channelStats).sort((a,b) => b[1].profit - a[1].profit).slice(0, 10);
    const totalGlobalProfit = sortedChannels.reduce((sum, item) => sum + item[1].profit, 0);

    return {
      totalOmzet, totalBeban, netProfit: totalOmzet - totalBeban,
      trendArray, maxOmzetValue,
      topClients: sortedClients, topChannels: sortedChannels, totalGlobalProfit,
      totalPcsHariIni, omzetHariIniRealtime, hppHariIni,
      sisaBahanBaku55, opsGaji20, cadangan10, profitBersih15,
      watchList: outstandingDebtsAndReceivables.sort((a,b) => new Date(a.date) - new Date(b.date))
    };
  }, [realOrders, realPurchases, realExpenses, realCashflow, timeRange, todayStr, isHQ, currentBranch]);

  // --- GRAPHIC VECTOR CALCULATION ---
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

  const renderRankMedal = (index) => {
    if (index === 0) return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 border-2 border-white shadow flex items-center justify-center text-amber-900 shrink-0"><Crown size={15}/></div>;
    if (index === 1) return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-400 border-2 border-white shadow flex items-center justify-center text-slate-800 shrink-0"><Medal size={15}/></div>;
    if (index === 2) return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-200 to-orange-400 border-2 border-white shadow flex items-center justify-center text-orange-900 shrink-0"><Medal size={15}/></div>;
    return <div className="w-8 h-8 rounded-full bg-slate-50 border flex items-center justify-center text-slate-400 font-black text-[9px] shrink-0">#{index + 1}</div>;
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800">
      
      {/* CONTROL BANNER ATAS */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-md flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 text-white">
        <div>
          <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
            <Activity className="text-emerald-400 animate-pulse"/> Radar Bisnis &amp; Analitik Sultan
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Pemantauan otomatis 4 Amplop, HPP, serta radar piutang macet.</p>
        </div>

        <div className="flex bg-slate-800 p-1.5 rounded-2xl border border-slate-700">
          <button onClick={() => setTimeRange('TODAY')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${timeRange === 'TODAY' ? 'bg-emerald-500 text-slate-900 shadow-md scale-105' : 'text-slate-400 hover:text-white'}`}><CalendarClock size={12}/> Hari Ini</button>
          <button onClick={() => setTimeRange('7_DAYS')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${timeRange === '7_DAYS' ? 'bg-emerald-500 text-slate-900 shadow-md scale-105' : 'text-slate-400 hover:text-white'}`}><TrendingUp size={12}/> 7 Hari</button>
          <button onClick={() => setTimeRange('30_DAYS')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${timeRange === '30_DAYS' ? 'bg-emerald-500 text-slate-900 shadow-md scale-105' : 'text-slate-400 hover:text-white'}`}><BarChart3 size={12}/> 30 Hari</button>
        </div>
      </div>

      {/* THREE CARDS INDIKATOR UTAMA (Menjawab Layout image_573d61.png) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><ArrowDownToLine size={12} className="text-emerald-500"/> Aliran Omzet Masuk</div>
            <div className="text-2xl font-black text-slate-800 tracking-tight mt-1">{formatRupiah(radarMetrics.totalOmzet)}</div>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3.5 rounded-2xl border border-emerald-100"><TrendingUp size={24}/></div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><ArrowUpRight size={12} className="text-rose-500"/> Total Pengeluaran</div>
            <div className="text-2xl font-black text-slate-800 tracking-tight mt-1">{formatRupiah(radarMetrics.totalBeban)}</div>
          </div>
          <div className="bg-rose-50 text-rose-600 p-3.5 rounded-2xl border border-rose-100"><ArrowUpRight size={24}/></div>
        </div>

        <div className="bg-emerald-600 p-6 rounded-3xl text-white shadow-xl flex items-center justify-between relative overflow-hidden">
          <div className="z-10">
            <div className="text-[10px] font-black text-emerald-200 uppercase tracking-widest flex items-center gap-1.5"><Award size={12}/> Estimasi Saldo &amp; Laba</div>
            <div className="text-3xl font-black tracking-tight mt-1">{formatRupiah(radarMetrics.netProfit)}</div>
          </div>
          <div className="bg-emerald-500 text-white p-3.5 rounded-2xl border border-emerald-400 z-10"><Award size={24}/></div>
        </div>
      </div>

      {/* 🔥 INJEKSI FITUR BARU: RADAR BREAKDOWN 4 AMPLOP & HPP BERSIH (HARI INI) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-2 md:grid-cols-5 gap-4 bg-gradient-to-b from-white to-slate-50/50">
        <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">HPP Bersih Hari Ini</div>
          <div className="text-base font-black text-slate-800 mt-1">{formatRupiah(radarMetrics.hppHariIni)}</div>
          <div className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Vol: {formatNumber(radarMetrics.totalPcsHariIni)} Pcs</div>
        </div>
        <div className="p-3 bg-blue-50/40 border border-blue-100 rounded-2xl shadow-sm text-center">
          <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center justify-center gap-1"><Package size={10}/> Amplop 1 (Bahan 55%)</div>
          <div className="text-base font-black text-blue-800 mt-1">{formatRupiah(radarMetrics.sisaBahanBaku55)}</div>
        </div>
        <div className="p-3 bg-orange-50/40 border border-orange-100 rounded-2xl shadow-sm text-center">
          <div className="text-[9px] font-black text-orange-600 uppercase tracking-widest flex items-center justify-center gap-1"><Percent size={10}/> Amplop 2 (Ops 20%)</div>
          <div className="text-base font-black text-orange-800 mt-1">{formatRupiah(radarMetrics.opsGaji20)}</div>
        </div>
        <div className="p-3 bg-purple-50/40 border border-purple-100 rounded-2xl shadow-sm text-center">
          <div className="text-[9px] font-black text-purple-600 uppercase tracking-widest flex items-center justify-center gap-1"><Activity size={10}/> Amplop 3 (Jaga 10%)</div>
          <div className="text-base font-black text-purple-800 mt-1">{formatRupiah(radarMetrics.cadangan10)}</div>
        </div>
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-sm text-center col-span-2 md:col-span-1">
          <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center justify-center gap-1"><Award size={10}/> Amplop 4 (Profit 15%)</div>
          <div className="text-base font-black text-emerald-800 mt-1">{formatRupiah(radarMetrics.profitBersih15)}</div>
        </div>
      </div>

      {/* 🔥 INJEKSI FITUR BARU: RADAR WATCHLIST PIUTANG MACET & HUTANG SUPPLIER AYAM */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="text-xs font-black uppercase text-slate-700 tracking-widest flex items-center gap-2 mb-4">
          <ShieldAlert size={16} className="text-rose-500 animate-bounce"/> 🚨 Radar Pengawasan Tagihan Macet &amp; Hutang Gantung
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {radarMetrics.watchList.length === 0 ? (
            <div className="col-span-full py-6 text-center text-xs font-bold text-slate-400 bg-slate-50 border border-dashed rounded-2xl uppercase tracking-widest">Bersih Total! Tidak ada tagihan gantung yang menunggak.</div>
          ) : (
            radarMetrics.watchList.map((bill, index) => (
              <div key={index} className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center justify-between group hover:border-slate-400 transition-colors">
                <div className="space-y-1">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${bill.labelClass}`}>
                    {bill.type}
                  </span>
                  <div className="text-xs font-black text-slate-800 uppercase line-clamp-1 mt-1">{bill.name}</div>
                  <div className="text-[9px] font-mono text-slate-400">ID: {bill.id} | Tgl: {formatDate(bill.date)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Sisa Bon</div>
                  <div className="text-sm font-black text-rose-600 mt-0.5">{formatRupiah(bill.amount)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* LINE GRAPH TREN (Sembunyikan kalau filter Hari Ini) */}
      {timeRange !== 'TODAY' && radarMetrics.trendArray.length > 1 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in">
          <h3 className="text-xs font-black uppercase text-slate-700 tracking-widest flex items-center gap-2 mb-4"><BarChart3 size={16} className="text-blue-500"/> Tren Fluktuasi Keuangan Pabrik</h3>
          <div className="w-full h-44 bg-slate-50 border rounded-2xl relative p-2 overflow-hidden shadow-inner">
            <svg className="w-full h-full" viewBox="0 0 500 180" preserveAspectRatio="none">
              <line x1="0" y1="45" x2="500" y2="45" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4"/>
              <line x1="0" y1="90" x2="500" y2="90" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4"/>
              <line x1="0" y1="135" x2="500" y2="135" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4"/>
              <path d={svgCoordinates.omzetPath} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d={svgCoordinates.bebanPath} fill="none" stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur border px-2.5 py-1 rounded-xl text-[8px] font-black uppercase tracking-wider flex items-center gap-3 shadow-sm z-10">
              <div className="flex items-center gap-1"><span className="w-2.5 h-1 bg-emerald-500 rounded-full"></span> Masuk</div>
              <div className="flex items-center gap-1"><span className="w-2.5 h-1 bg-rose-500 rounded-full"></span> Keluar</div>
            </div>
          </div>
          <div className="flex justify-between items-center text-[9px] font-black text-slate-400 mt-2 px-1 uppercase tracking-widest">
            <span>{radarMetrics.trendArray[0]?.label || 'Awal'}</span>
            <span>{radarMetrics.trendArray[Math.floor(radarMetrics.trendArray.length / 2)]?.label || 'Tengah'}</span>
            <span>{radarMetrics.trendArray[radarMetrics.trendArray.length - 1]?.label || 'Hari Ini'}</span>
          </div>
        </div>
      )}

      {/* ROW LEADERBOARD DUA ARENA */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* ARENA 1: RANKING MERCHANT JALUR ONLINE */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest flex items-center gap-2">
              <ShoppingBag size={16} className="text-orange-500"/> Klasemen Jalur Merchant Online
            </h3>
            <span className="text-[8px] font-black text-slate-400 bg-white border px-2 py-1 rounded-md uppercase shadow-sm">Realtime</span>
          </div>
          
          <div className="p-4 flex-1 flex flex-col gap-2.5">
            {radarMetrics.topChannels.length === 0 ? (
              <div className="text-center py-10 text-xs font-bold text-slate-400 uppercase">Tidak ada jualan terdeteksi.</div>
            ) : (
              radarMetrics.topChannels.map(([name, stats], idx) => {
                const ratio = radarMetrics.totalGlobalProfit > 0 ? (stats.profit / radarMetrics.totalGlobalProfit) * 100 : 0;
                return (
                  <div key={idx} className="flex items-center gap-3 p-3.5 border border-slate-100 rounded-2xl hover:bg-orange-50/20 transition-all hover:border-orange-200 group">
                    {renderRankMedal(idx)}
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-xs text-slate-800 uppercase group-hover:text-orange-600 transition-colors flex justify-between items-center">
                        <span className="truncate">{name.replace('_', ' ')}</span>
                        <span className="text-xs shrink-0 ml-2">{formatRupiah(stats.omzet)}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[9px] font-black uppercase tracking-wider">
                        <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100"><Package size={10} className="inline mr-0.5"/> {formatNumber(stats.qty)} Pcs</span>
                        <span className="text-slate-400">HPP: {formatRupiah(stats.hpp)}</span>
                      </div>
                    </div>
                    <div className="text-right bg-slate-50 p-2 rounded-xl border border-slate-100 shrink-0">
                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Laba Bersih</div>
                      <div className="font-black text-xs text-emerald-600">+{formatRupiah(stats.profit)}</div>
                      {ratio > 0 && <div className="text-[7px] font-black text-orange-500 text-right mt-0.5">Share {ratio.toFixed(1)}%</div>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ARENA 2: RANKING KLIEN VIP / AGEN PERSONAL */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest flex items-center gap-2">
              <Users size={16} className="text-blue-600"/> Klasemen Klien VIP &amp; Agen Terloyal
            </h3>
            <span className="text-[8px] font-black text-slate-400 bg-white border px-2 py-1 rounded-md uppercase shadow-sm">CRM</span>
          </div>
          
          <div className="p-4 flex-1 flex flex-col gap-2.5">
            {radarMetrics.topClients.length === 0 ? (
              <div className="text-center py-10 text-xs font-bold text-slate-400 uppercase">Tidak ada transaksi terdeteksi.</div>
            ) : (
              radarMetrics.topClients.map(([name, stats], idx) => (
                <div key={idx} className="flex items-center gap-3 p-3.5 border border-slate-100 rounded-2xl hover:bg-blue-50/20 transition-all hover:border-blue-200 group">
                  {renderRankMedal(idx)}
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-xs text-slate-800 uppercase group-hover:text-blue-600 transition-colors flex justify-between items-center">
                      <span className="truncate">{name}</span>
                      <span className="text-xs shrink-0 ml-2">{formatRupiah(stats.omzet)}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[9px] font-black uppercase tracking-wider">
                      <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100"><Package size={10} className="inline mr-0.5"/> {formatNumber(stats.qty)} Pcs</span>
                      <span className="text-slate-400">HPP: {formatRupiah(stats.hpp)}</span>
                    </div>
                  </div>
                  <div className="text-right bg-slate-50 p-2 rounded-xl border border-slate-100 shrink-0">
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Kontribusi Laba</div>
                    <div className="font-black text-xs text-emerald-600">+{formatRupiah(stats.profit)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
