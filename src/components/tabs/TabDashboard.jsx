import React, { useState } from 'react';
import { Wallet, TrendingUp, Calendar, Printer, AlertCircle, Activity, DollarSign, Store, ShoppingBag, Package } from 'lucide-react';
import { formatRp, getTodayStr } from '../../utils/helpers';
import useDashboardPusat from '../../hooks/useDashboardPusat';

const getFirstDayOfMonthLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
};

const StatCard = ({ title, value, icon, color, subtitle, subValue }) => (
  <div className={`p-5 rounded-2xl border flex flex-col justify-between relative overflow-hidden ${color} shadow-sm hover:shadow-md transition-shadow`}>
    <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">{icon}</div>
    <div className="flex justify-between items-start mb-2 relative z-10"><h3 className="font-bold text-[11px] opacity-90 uppercase tracking-wider">{title}</h3></div>
    <div className="relative z-10">
        <div className="text-2xl lg:text-3xl font-black tracking-tight">{value}</div>
        {subtitle && (
            <div className="flex justify-between items-center mt-2 border-t border-black/10 pt-2">
                <span className="text-[10px] font-bold opacity-80 uppercase">{subtitle}</span>
                {subValue && <span className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded">{subValue}</span>}
            </div>
        )}
    </div>
  </div>
);

export default function TabDashboard({ orders, expenses, purchases, piutangPayments, pemalangReports, stokData, supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers, masterBranches, setPrintData }) {
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonthLocal());
  const [dateTo, setDateTo] = useState(getTodayStr());

  const dash = useDashboardPusat({ orders, expenses, purchases, piutangPayments, pemalangReports, stokData, supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers, dateFrom, dateTo });

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* FILTER GLOBAL */}
      <div className="bg-white p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-2.5 rounded-xl text-white shadow-md"><Activity size={20}/></div>
              <div><h3 className="font-black text-slate-800 leading-none text-lg">Executive Command Center</h3><p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wider">Profitability & Financial Intelligence</p></div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-2 text-sm font-bold border border-slate-300 rounded-xl bg-slate-50 outline-none" />
              <span className="text-slate-400 self-center font-bold text-xs uppercase">s/d</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-2 text-sm font-bold border border-slate-300 rounded-xl bg-slate-50 outline-none" />
          </div>
      </div>

      {/* TIER 1: EXECUTIVE METRICS (OWNER LEVEL) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="NET PROFIT (HARI INI)" value={formatRp(dash.todayNetProfit)} icon={<TrendingUp size={64}/>} color="bg-emerald-600 text-white border-emerald-700 shadow-emerald-200" subtitle="Laba Bersih Real" subValue="Setelah HPP & Fee" />
        <StatCard title="TOTAL CASH READY" value={formatRp(dash.cashReadyTotal)} icon={<Wallet size={64}/>} color="bg-blue-600 text-white border-blue-700 shadow-blue-200" subtitle="Kas Laci & Bank" subValue="Siap Dipakai" />
        <StatCard title="HUTANG AYAM AKTIF" value={formatRp(dash.hutangAyamAktif)} icon={<AlertCircle size={64}/>} color="bg-red-600 text-white border-red-700 shadow-red-200" subtitle="Kewajiban Supplier" subValue="Harus Dibayar" />
        <StatCard title="TOTAL ASSET INVENTORY" value={formatRp(dash.totalAssetInventory)} icon={<Package size={64}/>} color="bg-purple-600 text-white border-purple-700 shadow-purple-200" subtitle="Valuasi Gudang & Freezer" subValue="Modal Berjalan" />
      </div>

      {/* TIER 2: FINANCIAL INTELLIGENCE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
          
          {/* KOLOM KIRI: BRANCH P&L ENGINE (LEBAR 7/12) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
              
              {/* MARKETPLACE PROFITABILITY */}
              <div className="bg-white rounded-2xl border shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4 border-b pb-3">
                      <div className="flex items-center gap-3"><div className="bg-orange-100 text-orange-600 p-2 rounded-lg"><ShoppingBag size={18}/></div><h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm">Marketplace Profitability</h3></div>
                  </div>
                  <div className="space-y-4">
                      {dash.channelArr.map((ch, idx) => {
                          const margin = ch.gross > 0 ? ((ch.netProfit / ch.gross) * 100).toFixed(1) : 0;
                          return (
                          <div key={idx} className="relative group">
                              <div className="flex justify-between items-end mb-1">
                                  <span className="font-black text-slate-700 uppercase text-xs">{ch.channel} <span className="text-[9px] text-slate-400 font-bold ml-1">({ch.count} Order)</span></span>
                                  <span className="font-black text-emerald-600 text-sm">{formatRp(ch.netProfit)}</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2 mb-1 overflow-hidden flex">
                                  <div className="bg-emerald-500 h-2" style={{width: `${margin}%`}}></div>
                                  <div className="bg-red-400 h-2" style={{width: `${ch.gross > 0 ? (ch.fee / ch.gross) * 100 : 0}%`}}></div>
                              </div>
                              <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase">
                                  <span>Gross: {formatRp(ch.gross)}</span>
                                  <span className="text-red-500">Fee: -{formatRp(ch.fee)}</span>
                                  <span className="text-emerald-600">Margin: {margin}%</span>
                              </div>
                          </div>
                      )})}
                  </div>
              </div>

              {/* BRANCH P&L */}
              <div className="bg-white rounded-2xl border shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-4 border-b pb-3"><div className="bg-blue-100 text-blue-600 p-2 rounded-lg"><Store size={18}/></div><h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm">Branch P&L (Profit & Loss)</h3></div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-[9px] text-slate-500 uppercase">
                              <tr><th className="px-3 py-2 rounded-l-lg">Cabang</th><th className="px-3 py-2 text-right">Omzet</th><th className="px-3 py-2 text-right">HPP</th><th className="px-3 py-2 text-right text-red-500">Biaya/Fee</th><th className="px-3 py-2 text-right text-emerald-600 rounded-r-lg">Net Profit</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {dash.branchArr.map((br, idx) => {
                                  const bName = (masterBranches || []).find(x => x.branch_id === br.branch_id)?.branch_name || br.branch_id;
                                  return (
                                  <tr key={idx} className="hover:bg-slate-50">
                                      <td className="px-3 py-3 font-black text-slate-700 uppercase text-xs">{bName}</td>
                                      <td className="px-3 py-3 text-right font-medium text-slate-600">{formatRp(br.omzet)}</td>
                                      <td className="px-3 py-3 text-right font-medium text-orange-600">-{formatRp(br.hpp)}</td>
                                      <td className="px-3 py-3 text-right font-medium text-red-500">-{formatRp(br.fee + br.expense)}</td>
                                      <td className="px-3 py-3 text-right font-black text-emerald-600 bg-emerald-50/50">{formatRp(br.netProfit)}</td>
                                  </tr>
                              )})}
                          </tbody>
                      </table>
                  </div>
              </div>

          </div>

          {/* KOLOM KANAN: ALERTS & PENDING (LEBAR 5/12) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* SMART ALERTS ENGINE */}
              <div className="bg-white rounded-2xl border shadow-sm flex flex-col p-5 border-t-4 border-t-red-500">
                  <div className="flex items-center gap-3 mb-4"><div className="bg-red-50 p-2 rounded-lg text-red-600"><AlertCircle size={18}/></div><h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm">Smart Alerts Engine</h3></div>
                  <div className="space-y-3">
                      {dash.alerts.length === 0 ? (
                          <div className="text-center p-6 text-slate-400 text-xs italic">Semua parameter finansial & operasional dalam kondisi prima.</div>
                      ) : (
                          dash.alerts.map((a, idx) => (
                              <div key={idx} className={`p-3 rounded-xl border flex items-start gap-3 shadow-sm bg-white ${a.type === 'danger' ? 'border-red-200' : 'border-amber-200'}`}>
                                  <AlertCircle size={18} className={`shrink-0 mt-0.5 ${a.type === 'danger' ? 'text-red-500' : 'text-amber-500'}`}/>
                                  <div>
                                      <h4 className={`text-[10px] font-black uppercase mb-0.5 ${a.type === 'danger' ? 'text-red-700' : 'text-amber-700'}`}>{a.title}</h4>
                                      <p className="text-[10px] text-slate-600 leading-snug font-medium">{a.desc}</p>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>

              {/* MARKETPLACE PENDING SETTLEMENT */}
              <div className="bg-white rounded-2xl border shadow-sm p-5 border-t-4 border-t-orange-400">
                  <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-3"><div className="bg-orange-50 p-2 rounded-lg text-orange-600"><Clock size={18}/></div><h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm">Marketplace Pending (Hold)</h3></div><span className="font-black text-orange-600 text-sm">{formatRp(dash.pendingCash)}</span></div>
                  <p className="text-xs text-slate-500 font-medium mb-2">Dana yang tertahan di Marketplace (GoFood, Shopee, dll) dan belum dicairkan ke rekening kas. Jangan hitung ini sebagai Cash Ready!</p>
              </div>

          </div>
      </div>
    </div>
  );
}
