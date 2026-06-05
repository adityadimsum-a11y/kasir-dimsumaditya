import React, { useState } from 'react';
import { Wallet, TrendingUp, AlertCircle, Activity, ShoppingBag, Store, Package, BrainCircuit, Factory, TrendingDown, CheckSquare, Trophy, CheckCircle } from 'lucide-react';
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

  const dash = useDashboardPusat({ orders, expenses, purchases, piutangPayments, pemalangReports, stokData, supplierLedger, cashflowTransactions, marketplaceSettlement, inventoryCostLayers, stockMovements, masterBranches, dateFrom, dateTo });

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* FILTER GLOBAL */}
      <div className="bg-white p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-2.5 rounded-xl text-white shadow-md"><BrainCircuit size={20}/></div>
              <div><h3 className="font-black text-slate-800 leading-none text-lg">AI Automation Engine</h3><p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wider">Business Decision & Auto-Pilot Mode</p></div>
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

      {/* TIER 2: AUTO-PILOT TASK ENGINE (NEW!) */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-indigo-600">
          <div className="flex items-center gap-3 mb-5 border-b pb-4">
              <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700"><CheckSquare size={20}/></div>
              <div><h3 className="font-black text-slate-800 uppercase tracking-wide">Auto-Pilot Task Recommendations</h3><p className="text-[10px] font-medium text-slate-500 uppercase mt-0.5">Tugas otomatis hasil generate AI berdasarkan predikisi stok & kas</p></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dash.automationTasks.length === 0 ? (
                  <div className="col-span-full text-center p-8 border border-dashed rounded-xl border-slate-200 text-slate-400 font-bold text-sm">
                      <CheckCircle size={32} className="mx-auto mb-2 text-emerald-400"/>
                      Tidak ada tugas mendesak. Operasional berjalan otomatis dengan lancar.
                  </div>
              ) : (
                  dash.automationTasks.map((task, idx) => (
                      <div key={idx} className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/30 flex flex-col justify-between">
                          <div>
                              <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">{task.type}</div>
                              <h4 className="font-bold text-slate-800 text-sm mb-1">{task.title}</h4>
                              <p className="text-[11px] text-slate-600 leading-tight mb-4">{task.desc}</p>
                          </div>
                          <button className="w-full bg-white border border-indigo-200 text-indigo-700 font-bold py-2 rounded-lg text-xs hover:bg-indigo-600 hover:text-white transition shadow-sm">
                              {task.actionLabel}
                          </button>
                      </div>
                  ))
              )}
          </div>
      </div>

      {/* TIER 3: FORECAST ENGINE & KPI BOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
          
          {/* AI DECISION ENGINE */}
          <div className="lg:col-span-8 bg-white rounded-2xl border shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6 border-b pb-4">
                  <div className="bg-slate-100 p-2 rounded-lg text-slate-700"><Activity size={20}/></div>
                  <h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm">Inventory & Runway Forecast</h3>
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

          {/* KPI ENGINE BOARD */}
          <div className="lg:col-span-4 bg-white rounded-2xl border shadow-sm p-6 flex flex-col h-full bg-gradient-to-b from-white to-amber-50/30">
              <div className="flex items-center gap-3 mb-4 border-b pb-3"><div className="bg-amber-100 p-2 rounded-lg text-amber-600"><Trophy size={18}/></div><h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm">Business Intelligence KPI</h3></div>
              <div className="space-y-4 flex-1">
                  
                  {dash.kpiEngine.bestBranch && (
                      <div className="flex items-center gap-3 p-3 bg-white border border-amber-200 rounded-xl shadow-sm">
                          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-black">1</div>
                          <div><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cabang Paling Profitable</div><div className="font-black text-slate-800 text-sm">{masterBranches.find(b => b.branch_id === dash.kpiEngine.bestBranch.branch_id)?.branch_name || dash.kpiEngine.bestBranch.branch_id}</div><div className="text-[10px] font-bold text-emerald-600">{formatRp(dash.kpiEngine.bestBranch.netProfit)} Net Profit</div></div>
                      </div>
                  )}

                  {dash.kpiEngine.bestChannel && (
                      <div className="flex items-center gap-3 p-3 bg-white border border-blue-200 rounded-xl shadow-sm">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black"><ShoppingBag size={18}/></div>
                          <div><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Marketplace Terbaik</div><div className="font-black text-slate-800 text-sm">{dash.kpiEngine.bestChannel.channel}</div><div className="text-[10px] font-bold text-emerald-600">{formatRp(dash.kpiEngine.bestChannel.netProfit)} Net Profit</div></div>
                      </div>
                  )}

                  {dash.kpiEngine.worstMarginChannel && (
                      <div className="flex items-center gap-3 p-3 bg-white border border-red-200 rounded-xl shadow-sm">
                          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-black"><TrendingDown size={18}/></div>
                          <div><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Margin Paling Bocor</div><div className="font-black text-slate-800 text-sm">{dash.kpiEngine.worstMarginChannel.channel}</div><div className="text-[10px] font-bold text-red-500">Margin hanya {((dash.kpiEngine.worstMarginChannel.netProfit / dash.kpiEngine.worstMarginChannel.gross) * 100).toFixed(1)}%</div></div>
                      </div>
                  )}

              </div>
          </div>

      </div>
    </div>
  );
}
