import React, { useState } from 'react';
import { Wallet, TrendingUp, AlertCircle, Activity, ShoppingBag, Store, Package, BrainCircuit, Timer, Factory, TrendingDown } from 'lucide-react';
import { formatRp, getTodayStr } from '../../utils/helpers';
import useDashboardPusat from '../../hooks/useDashboardPusat';

const getFirstDayOfMonthLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
};

const StatCard = ({ title, value, icon, color, subtitle, subValue }) => (
  <div className={`p-5 rounded-2xl border flex flex-col justify-between relative overflow-hidden ${color} shadow-sm`}>
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

export default function TabDashboard({ orders, expenses, purchases, piutangPayments, pemalangReports, stokData, supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers, stockMovements, masterBranches, setPrintData }) {
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonthLocal());
  const [dateTo, setDateTo] = useState(getTodayStr());

  const dash = useDashboardPusat({ orders, expenses, purchases, piutangPayments, pemalangReports, stokData, supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers, stockMovements, dateFrom, dateTo });

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* FILTER GLOBAL */}
      <div className="bg-white p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-2.5 rounded-xl text-white shadow-md"><Activity size={20}/></div>
              <div><h3 className="font-black text-slate-800 leading-none text-lg">Executive Command Center</h3><p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wider">Profitability & Decision Engine</p></div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-2 text-sm font-bold border border-slate-300 rounded-xl bg-slate-50 outline-none" />
              <span className="text-slate-400 self-center font-bold text-xs uppercase">s/d</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-2 text-sm font-bold border border-slate-300 rounded-xl bg-slate-50 outline-none" />
          </div>
      </div>

      {/* TIER 1: EXECUTIVE METRICS (OWNER LEVEL) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="NET PROFIT (HARI INI)" value={formatRp(dash.todayNetProfit)} icon={<TrendingUp size={64}/>} color="bg-emerald-600 text-white border-emerald-700" subtitle="Laba Bersih Real" subValue="Setelah HPP & Fee" />
        <StatCard title="TOTAL CASH READY" value={formatRp(dash.cashReadyTotal)} icon={<Wallet size={64}/>} color="bg-blue-600 text-white border-blue-700" subtitle="Kas Laci & Bank" subValue="Siap Dipakai" />
        <StatCard title="HUTANG AYAM AKTIF" value={formatRp(dash.hutangAyamAktif)} icon={<AlertCircle size={64}/>} color="bg-red-600 text-white border-red-700" subtitle="Kewajiban Supplier" subValue="Harus Dibayar" />
        <StatCard title="TOTAL ASSET INVENTORY" value={formatRp(dash.totalAssetInventory)} icon={<Package size={64}/>} color="bg-purple-600 text-white border-purple-700" subtitle="Valuasi Ayam & Frozen" subValue="Modal Berjalan" />
      </div>

      {/* TIER 2: FORECAST ENGINE & SMART ALERTS (NEW!) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
          
          {/* AI DECISION ENGINE */}
          <div className="lg:col-span-8 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-indigo-600">
              <div className="flex items-center gap-3 mb-6 border-b pb-4">
                  <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700"><BrainCircuit size={20}/></div>
                  <div><h3 className="font-bold text-slate-800 uppercase tracking-wide">AI Forecast & Decision Engine</h3><p className="text-[10px] font-medium text-slate-500 uppercase mt-0.5">Prediksi berbasis data pergerakan 30 Hari Terakhir</p></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 relative overflow-hidden group">
                      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition"><Factory size={80}/></div>
                      <div className="text-[10px] font-black text-slate-500 uppercase mb-2">Umur Ayam (Runway)</div>
                      <div className="text-3xl font-black text-slate-800 mb-1">{dash.forecast.ayamDays} <span className="text-sm text-slate-500">HARI</span></div>
                      <div className="text-[10px] font-bold text-orange-600">Pemakaian: {dash.forecast.ayamAvg} kg/hari</div>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 relative overflow-hidden group">
                      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition"><Package size={80}/></div>
                      <div className="text-[10px] font-black text-slate-500 uppercase mb-2">Umur Freezer (Runway)</div>
                      <div className="text-3xl font-black text-slate-800 mb-1">{dash.forecast.dimsumDays} <span className="text-sm text-slate-500">HARI</span></div>
                      <div className="text-[10px] font-bold text-blue-600">Terjual/Kirim: {dash.forecast.dimsumAvg} pcs/hari</div>
                  </div>
                  <div className={`p-4 rounded-xl border relative overflow-hidden group ${dash.forecast.cashDeficit < 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition"><TrendingDown size={80}/></div>
                      <div className={`text-[10px] font-black uppercase mb-2 ${dash.forecast.cashDeficit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{dash.forecast.cashDeficit < 0 ? 'Cashflow Deficit' : 'Cashflow Surplus'}</div>
                      <div className={`text-xl font-black mb-1 ${dash.forecast.cashDeficit < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatRp(dash.forecast.cashDeficit)}</div>
                      <div className="text-[9px] font-bold text-slate-600 leading-tight">Selisih Kas vs Hutang Ayam Aktif</div>
                  </div>
              </div>
          </div>

          {/* SMART EXECUTIVE ALERTS */}
          <div className="lg:col-span-4 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-red-500 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-4"><div className="bg-red-50 p-2 rounded-lg text-red-600"><AlertCircle size={18}/></div><h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm">Smart Executive Alerts</h3></div>
              <div className="space-y-3 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                  {dash.alerts.length === 0 ? (
                      <div className="text-center p-6 text-slate-400 text-xs italic border border-dashed rounded-xl border-slate-200">Semua operasional & finansial terpantau aman terkendali.</div>
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

      </div>

      {/* TIER 3: MARKETPLACE & BRANCH P&L */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
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
                          <div className="flex justify-between items-end mb-1"><span className="font-black text-slate-700 uppercase text-xs">{ch.channel} <span className="text-[9px] text-slate-400 font-bold ml-1">({ch.count} Order)</span></span><span className="font-black text-emerald-600 text-sm">{formatRp(ch.netProfit)}</span></div>
                          <div className="w-full bg-slate-100 rounded-full h-2 mb-1 overflow-hidden flex"><div className="bg-emerald-500 h-2" style={{width: `${margin}%`}}></div><div className="bg-red-400 h-2" style={{width: `${ch.gross > 0 ? (ch.fee / ch.gross) * 100 : 0}%`}}></div></div>
                          <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase"><span>Gross: {formatRp(ch.gross)}</span><span className="text-red-500">Fee: -{formatRp(ch.fee)}</span><span className="text-emerald-600">Margin: {margin}%</span></div>
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
                          <tr><th className="px-3 py-2 rounded-l-lg">Cabang</th><th className="px-3 py-2 text-right">Omzet</th><th className="px-3 py-2 text-right">HPP</th><th className="px-3 py-2 text-right text-red-500">Fee/Ops</th><th className="px-3 py-2 text-right text-emerald-600 rounded-r-lg">Net Profit</th></tr>
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
      <style dangerouslySetInnerHTML={{__html: `.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }`}}/>
    </div>
  );
}
