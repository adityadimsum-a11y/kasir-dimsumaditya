import React, { useState, useMemo } from 'react';
import { Activity, TrendingUp, ArrowDownToLine, ArrowUpRight, Award, ShoppingBag, BarChart3, PieChart, Users, Crown, Medal, CalendarClock, Package, Percent, ShieldAlert } from 'lucide-react';
import { getTodayStr, formatDate, safeJsonParse } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

// 🔥 REVISI CORE: DIKUNCI MATI KE RP 1.125 SESUAI MANIFEST 1.020 KG AYAM = 34.000 PCS (ANTI-BOCOR)
const ESTIMASI_HPP_PER_PCS = 1125; 

export default function TabBusinessRadar({ 
  orders = [], orders_data, purchases = [], purchases_data, 
  expenses = [], expenses_data, cashflow_transactions = [], cashflow_transactions_data,
  masterBranches = [], master_branches, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';

  const [timeRange, setTimeRange] = useState('TODAY'); 

  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realCashflow = useMemo(() => cashflow_transactions_data || cashflow_transactions || [], [cashflow_transactions, cashflow_transactions_data]);

  // (SISA LOGIK YANG BOS PASTE - DIBIARKAN UTUH 1000%)
  const [settleModal, setSettleModal] = useState(null);
  const [settleForm, setSettleForm] = useState({ actualReturned: '', upahJalan: '', pembulatan: '0' });

  const radarMetrics = useMemo(() => {
    const limitDate = new Date();
    let daysToCount = 0;
    if (timeRange === '7_DAYS') { daysToCount = 7; limitDate.setDate(limitDate.getDate() - 7); }
    else if (timeRange === '30_DAYS') { daysToCount = 30; limitDate.setDate(limitDate.getDate() - 30); }
    else { limitDate.setHours(0,0,0,0); } 

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

    realOrders.filter(o => !o.isDeleted).forEach(o => {
      const orderDateStr = o.date.substring(0, 10);
      const d = new Date(o.date);
      
      let isIncluded = false;
      if (timeRange === 'TODAY' && orderDateStr === todayStr) isIncluded = true;
      else if (timeRange !== 'TODAY' && d >= limitDate) isIncluded = true;

      let totalPcs = 0;
      const itemsArr = safeJsonParse(o.items, []);
      itemsArr.forEach(item => totalPcs += Number(item.qty || 0));

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

        const custName = o.customer_name?.tonormal-case() || 'PELANGGAN ANONIM';
        if (!clientStats[custName]) clientStats[custName] = { qty: 0, omzet: 0, hpp: 0, profit: 0 };
        clientStats[custName].qty += totalPcs;
        clientStats[custName].omzet += amt;
        clientStats[custName].hpp += estimasiHpp;
        clientStats[custName].profit += labaBersih;

        const channelName = o.sales_channel?.tonormal-case() || 'ECERAN_WALKIN';
        if (!channelStats[channelName]) channelStats[channelName] = { qty: 0, omzet: 0, hpp: 0, profit: 0 };
        channelStats[channelName].qty += totalPcs;
        channelStats[channelName].omzet += amt;
        channelStats[channelName].hpp += estimasiHpp;
        channelStats[channelName].profit += labaBersih;
      }
    });

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
        totalBeban += Number(c.amount || 0);
        if (trendMap[dStr]) trendMap[dStr].beban += Number(c.amount || 0);
      }
    });

    const outstandingDebtsAndReceivables = [];
    
    realOrders.filter(o => !o.isDeleted && ['DP', 'HUTANG'].includes(o.payment_method) && o.status !== 'SELESAI').forEach(o => {
      if (!isHQ && o.branch_id !== currentBranch) return;
      let paid = Number(o.amount_paid || 0);
      realCashflow.filter(c => !c.isDeleted && c.type === 'IN' && c.reference_id === o.id).forEach(c => paid += Number(c.amount || 0));
      const sisa = Number(o.total_amount || 0) - paid;
      if (sisa > 0) {
        outstandingDebtsAndReceivables.push({ id: o.id, name: o.customer_name, type: 'Piutang Agen', amount: sisa, date: o.date, labelClass: 'bg-orange-50 text-orange-700 border-orange-200' });
      }
    });

    realPurchases.filter(p => !p.isDeleted && (p.payment_method === 'BON_GANTUNG' || p.payment_method === 'HUTANG') && p.status !== 'LUNAS').forEach(p => {
      if (!isHQ && p.branch_id !== currentBranch) return;
      let paid = Number(p.amount_paid || 0);
      realCashflow.filter(c => !c.isDeleted && c.type === 'OUT' && c.reference_id === p.id).forEach(c => paid += Number(c.amount || 0));
      const sisa = Number(p.total_amount || p.amount || 0) - paid;
      if (sisa > 0) {
        outstandingDebtsAndReceivables.push({ id: p.id, name: p.supplier_name || 'Supplier Ayam', type: 'Hutang Bon Gantung', amount: sisa, date: p.date, labelClass: 'bg-rose-50 text-rose-700 border-rose-200' });
      }
    });

    // 🔥 AMANKAN REKAP DATA SESUAI KITAB SUCI ADITYA DIMSUM (55% - 20% - 10% - 15%)
    const hppHariIni = totalPcsHariIni * ESTIMASI_HPP_PER_PCS;
    const sisaBahanBaku55 = omzetHariIniRealtime * 0.55;
    const opsGaji20 = omzetHariIniRealtime * 0.20;
    const cadangan10 = omzetHariIniRealtime * 0.10;
    const profitBersih15 = omzetHariIniRealtime * 0.15;

    const sortedClients = Object.entries(clientStats).sort((a,b) => b[1].profit - a[1].profit).slice(0, 10);
    const sortedChannels = Object.entries(channelStats).sort((a,b) => b[1].profit - a[1].profit).slice(0, 10);
    const totalGlobalProfit = sortedChannels.reduce((sum, item) => sum + (item[1]?.profit || 0), 0);

    const finalTrendArray = Object.values(trendMap);
    const maxOmzetValue = Math.max(...finalTrendArray.map(t => Math.max(t.omzet, t.beban)), 100000);

    return {
      totalOmzet, totalBeban, netProfit: totalOmzet - totalBeban,
      trendArray: finalTrendArray, maxOmzetValue,
      topClients: sortedClients, topChannels: sortedChannels, totalGlobalProfit,
      totalPcsHariIni, omzetHariIniRealtime, hppHariIni,
      sisaBahanBaku55, opsGaji20, cadangan10, profitBersih15,
      watchList: outstandingDebtsAndReceivables.sort((a,b) => new Date(a.date) - new Date(b.date))
    };
  }, [realOrders, realPurchases, realExpenses, realCashflow, timeRange, todayStr, isHQ, currentBranch]);

  const svgCoordinates = useMemo(() => {
    const width = 500; const height = 180;
    const points = radarMetrics.trendArray;
    const maxVal = radarMetrics.maxOmzetValue;
    if (!points || points.length <= 1) return { omzetPath: '', bebanPath: '' };
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
    if (index === 0) return <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-200 shadow-xs flex items-center justify-center text-amber-700 shrink-0"><Crown size={14}/></div>;
    if (index === 1) return <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 shadow-xs flex items-center justify-center text-slate-700 shrink-0"><Medal size={14}/></div>;
    if (index === 2) return <div className="w-7 h-7 rounded-lg bg-orange-100 border border-orange-200 shadow-xs flex items-center justify-center text-orange-700 shrink-0"><Medal size={14}/></div>;
    return <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 font-bold text-[10px] shrink-0">#{index + 1}</div>;
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 animate-in fade-in duration-300 normal-case">
      
      {/* HEADER RADAR - FLAT BOX (GRAB STYLE) */}
      <div className="card-holo p-6 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600"></div>
        <div className="pl-2">
          <h2 className="text-slate-900 text-base font-extrabold flex items-center gap-2">
            <Activity className="text-red-600"/> Radar Bisnis &amp; Analitik Sultan
          </h2>
          <p className="text-[10px] font-semibold text-slate-400 mt-1">Pemantauan otomatis 4 Amplop Kas, Monitor HPP, serta radar piutang jatuh tempo.</p>
        </div>

        {/* TIME CONTROLLER BUTTON GROUP */}
        <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-xl shadow-xs">
          <button type="button" onClick={() => setTimeRange('TODAY')} className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${timeRange === 'TODAY' ? 'bg-white shadow-xs text-red-600 border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}><CalendarClock size={12}/> Hari Ini</button>
          <button type="button" onClick={() => setTimeRange('7_DAYS')} className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${timeRange === '7_DAYS' ? 'bg-white shadow-xs text-red-600 border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}><TrendingUp size={12}/> 7 Hari</button>
          <button type="button" onClick={() => setTimeRange('30_DAYS')} className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${timeRange === '30_DAYS' ? 'bg-white shadow-xs text-red-600 border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}><BarChart3 size={12}/> 30 Hari</button>
        </div>
      </div>

      {/* METRIK KARTU REKAP - FLAT CARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-holo p-5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-400 normal-case tracking-wide flex items-center gap-1.5"><ArrowDownToLine size={12} className="text-emerald-600"/> Aliran Omzet Masuk</div>
            <div className="text-xl font-extrabold text-slate-800 tracking-tight mt-1">{formatRupiah(radarMetrics.totalOmzet)}</div>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl border border-emerald-100/50 shadow-xs"><TrendingUp size={20}/></div>
        </div>

        <div className="card-holo p-5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-400 normal-case tracking-wide flex items-center gap-1.5"><ArrowUpRight size={12} className="text-red-600"/> Total Pengeluaran Riil</div>
            <div className="text-xl font-extrabold text-slate-800 tracking-tight mt-1">{formatRupiah(radarMetrics.totalBeban)}</div>
          </div>
          <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100/50 shadow-xs"><ArrowUpRight size={20}/></div>
        </div>

        <div className="card-holo p-5 flex items-center justify-between relative overflow-hidden">
          <div>
            <div className="text-[10px] font-bold text-slate-400 normal-case tracking-wide flex items-center gap-1.5"><Award size={12} className="text-amber-600"/> Estimasi Sisa Selisih Laba</div>
            <div className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">{formatRupiah(radarMetrics.netProfit)}</div>
          </div>
          <div className="bg-amber-50 text-amber-600 p-3 rounded-xl border border-amber-100/50 shadow-xs"><Award size={20}/></div>
        </div>
      </div>

      {/* MONITOR BANNER 4 AMPLOP LIVE - FLAT BOX STYLE */}
      <div className="card-holo p-5 grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl shadow-xs text-center">
          <div className="text-[9px] font-bold text-slate-400 normal-case tracking-wide">HPP Realtime Hari Ini</div>
          <div className="text-sm font-extrabold text-slate-800 mt-1">{formatRupiah(radarMetrics.hppHariIni)}</div>
          <div className="text-[8px] font-bold text-slate-400 mt-0.5 normal-case">Vol: {formatNumber(radarMetrics.totalPcsHariIni)} Pcs</div>
        </div>
        <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl text-center">
          <div className="text-[9px] font-bold text-red-600 normal-case tracking-wide flex items-center justify-center gap-1"><Package size={10}/> Amplop 1 (Bahan 55%)</div>
          <div className="text-sm font-extrabold text-red-800 mt-1">{formatRupiah(radarMetrics.sisaBahanBaku55)}</div>
        </div>
        <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-center">
          <div className="text-[9px] font-bold text-blue-600 normal-case tracking-wide flex items-center justify-center gap-1"><Percent size={10}/> Amplop 2 (Ops 20%)</div>
          <div className="text-sm font-extrabold text-blue-800 mt-1">{formatRupiah(radarMetrics.opsGaji20)}</div>
        </div>
        <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl text-center">
          <div className="text-[9px] font-bold text-amber-600 normal-case tracking-wide flex items-center justify-center gap-1"><Activity size={10}/> Amplop 3 (Jaga 10%)</div>
          <div className="text-sm font-extrabold text-amber-800 mt-1">{formatRupiah(radarMetrics.cadangan10)}</div>
        </div>
        <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-center col-span-2 md:col-span-1">
          <div className="text-[9px] font-bold text-emerald-600 normal-case tracking-wide flex items-center justify-center gap-1"><Award size={10}/> Amplop 4 (Profit 15%)</div>
          <div className="text-sm font-extrabold text-emerald-800 mt-1">{formatRupiah(radarMetrics.profitBarsih15 || radarMetrics.profitBersih15)}</div>
        </div>
      </div>

      {/* WATCHLIST UTANG PIUTANG */}
      <div className="card-holo p-5">
        <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-2 mb-4">
          <ShieldAlert size={16} className="text-red-500"/> Radar Pengawasan Tagihan Macet &amp; Hutang Gantung
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {radarMetrics.watchList.length === 0 ? (
            <div className="col-span-full py-6 text-center text-xs font-bold text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl normal-case">Bersih Total! Tidak ada tagihan gantung yang menunggak.</div>
          ) : (
            radarMetrics.watchList.map((bill, index) => (
              <div key={index} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between group hover:border-red-300 transition-colors">
                <div className="space-y-1">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-bold normal-case border ${bill.labelClass}`}>
                    {bill.type}
                  </span>
                  <div className="text-xs font-bold text-slate-800 mt-1">{bill.name}</div>
                  <div className="text-[9px] font-mono text-slate-400">ID: {bill.id} | Tgl: {formatDate(bill.date)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[8px] font-bold text-slate-400 normal-case tracking-wider">Sisa Bon</div>
                  <div className="text-sm font-extrabold text-red-600 mt-0.5">{formatRupiah(bill.amount)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* TREND GRAPH */}
      {timeRange !== 'TODAY' && radarMetrics.trendArray.length > 1 && (
        <div className="card-holo p-5 animate-in fade-in">
          <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-2 mb-4"><BarChart3 size={16} className="text-red-600"/> Tren Fluktuasi Keuangan Pabrik</h3>
          <div className="w-full h-44 bg-slate-50 border border-slate-200 rounded-xl relative p-2 overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 500 180" preserveAspectRatio="none">
              <line x1="0" y1="45" x2="500" y2="45" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4"/>
              <line x1="0" y1="90" x2="500" y2="90" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4"/>
              <line x1="0" y1="135" x2="500" y2="135" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4"/>
              <path d={svgCoordinates.omzetPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d={svgCoordinates.bebanPath} fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="absolute top-3 right-3 bg-white border border-slate-200 px-2 py-1 rounded-lg text-[8px] font-bold flex items-center gap-3 shadow-xs">
              <div className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Masuk</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full"></span> Keluar</div>
            </div>
          </div>
          <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 mt-2 px-1">
            <span>{radarMetrics.trendArray[0]?.label || 'Awal'}</span>
            <span>{radarMetrics.trendArray[Math.floor(radarMetrics.trendArray.length / 2)]?.label || 'Tengah'}</span>
            <span>{radarMetrics.trendArray[radarMetrics.trendArray.length - 1]?.label || 'Hari Ini'}</span>
          </div>
        </div>
      )}

      {/* CLASSIFICATIONS KLASEMEN */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card-holo flex flex-col overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
              <ShoppingBag size={16} className="text-red-600"/> Klasemen Jalur Penjualan Agen
            </h3>
            <span className="text-[8px] font-bold text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-md normal-case">Realtime</span>
          </div>
          
          <div className="p-4 flex-1 flex flex-col gap-2">
            {radarMetrics.topChannels.length === 0 ? (
              <div className="text-center py-8 text-xs font-bold text-slate-400">Tidak ada jualan terdeteksi.</div>
            ) : (
              radarMetrics.topChannels.map(([name, stats], idx) => {
                const ratio = radarMetrics.totalGlobalProfit > 0 ? (stats.profit / radarMetrics.totalGlobalProfit) * 100 : 0;
                return (
                  <div key={idx} className="flex items-center gap-3 p-3 border border-slate-100 bg-white rounded-xl hover:bg-slate-50 transition-all shadow-xs">
                    {renderRankMedal(idx)}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs text-slate-800 group-hover:text-red-600 flex justify-between items-center">
                        <span className="truncate">{name.replace('_', ' ')}</span>
                        <span className="text-xs shrink-0 ml-2 font-extrabold">{formatRupiah(stats.omzet)}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[9px] font-semibold text-slate-400">
                        <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 font-bold"><Package size={10} className="inline mr-0.5"/> {formatNumber(stats.qty)} Pcs</span>
                        <span>HPP: {formatRupiah(stats.hpp)}</span>
                      </div>
                    </div>
                    <div className="text-right bg-slate-50 border border-slate-100 p-2 rounded-lg shrink-0">
                      <div className="text-[8px] font-bold text-slate-400 normal-case tracking-wider mb-0.5">Laba Bersih</div>
                      <div className="font-extrabold text-xs text-emerald-600">+{formatRupiah(stats.profit)}</div>
                      {ratio > 0 && <div className="text-[7px] font-bold text-red-500 text-right mt-0.5">Share {ratio.toFixed(1)}%</div>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="card-holo flex flex-col overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
              <Users size={16} className="text-red-600"/> Klasemen Klien VIP &amp; Mitra Loyal
            </h3>
            <span className="text-[8px] font-bold text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-md normal-case">CRM</span>
          </div>
          
          <div className="p-4 flex-1 flex flex-col gap-2">
            {radarMetrics.topClients.length === 0 ? (
              <div className="text-center py-8 text-xs font-bold text-slate-400">Tidak ada transaksi terdeteksi.</div>
            ) : (
              radarMetrics.topClients.map(([name, stats], idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 border border-slate-100 bg-white rounded-xl hover:bg-slate-50 transition-all shadow-xs">
                  {renderRankMedal(idx)}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs text-slate-800 group-hover:text-red-600 flex justify-between items-center">
                      <span className="truncate">{name}</span>
                      <span className="text-xs shrink-0 ml-2 font-extrabold">{formatRupiah(stats.omzet)}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[9px] font-semibold text-slate-400">
                      <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-bold"><Package size={10} className="inline mr-0.5"/> {formatNumber(stats.qty)} Pcs</span>
                      <span>HPP: {formatRupiah(stats.hpp)}</span>
                    </div>
                  </div>
                  <div className="text-right bg-slate-50 border border-slate-100 p-2 rounded-lg shrink-0">
                    <div className="text-[8px] font-bold text-slate-400 normal-case tracking-wider mb-0.5">Kontribusi Laba</div>
                    <div className="font-extrabold text-xs text-emerald-600">+{formatRupiah(stats.profit)}</div>
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
