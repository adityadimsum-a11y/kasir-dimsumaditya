import React, { useState } from 'react';
import { Wallet, TrendingUp, AlertCircle, Activity, ShoppingBag, Store, Package, BrainCircuit, TrendingDown, PieChart, ShieldCheck, Zap, Radar, LineChart, Lightbulb } from 'lucide-react';
import { formatRp, getTodayStr } from '../../utils/helpers';
import useDashboardPusat from '../../hooks/useDashboardPusat';

const getFirstDayOfMonthLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

export default function TabDashboard(props) {
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonthLocal());
  const [dateTo, setDateTo] = useState(getTodayStr());

  const dash = useDashboardPusat({ ...props, dateFrom, dateTo });

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* HEADER COMMAND CENTER */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4 relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10"><Radar size={150}/></div>
          <div className="flex items-center gap-4 relative z-10">
              <div className="bg-indigo-500/20 p-3 rounded-xl border border-indigo-500/50 text-indigo-400"><BrainCircuit size={24}/></div>
              <div><h3 className="font-black text-white leading-none text-xl tracking-wide">Business Intelligence & AI Forecast</h3><p className="text-[10px] font-bold text-indigo-300 uppercase mt-1.5 tracking-widest flex items-center gap-1"><Zap size={12}/> Predictive Decision Support System</p></div>
          </div>
          <div className="flex gap-2 relative z-10">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-2 text-sm font-bold border-none rounded-xl bg-white/10 text-white outline-none" />
              <span className="text-slate-400 self-center font-bold text-xs uppercase">s/d</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-2 text-sm font-bold border-none rounded-xl bg-white/10 text-white outline-none" />
          </div>
      </div>

      {/* TIER 1: EXECUTIVE AI INSIGHTS (THE BRAIN) */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-indigo-600">
          <div className="flex items-center gap-3 mb-5 border-b pb-4">
              <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700"><Lightbulb size={20}/></div>
              <div><h3 className="font-black text-slate-800 uppercase tracking-wide">Executive AI Insights</h3><p className="text-[10px] font-medium text-slate-500 uppercase mt-0.5">Analisa prediktif dari data operasional & finansial Anda</p></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dash.aiInsights.map((insight, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border flex gap-4 ${insight.type === 'CRITICAL' ? 'bg-red-50 border-red-200' : insight.type === 'WARNING' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                      <div className="text-2xl">{insight.icon}</div>
                      <p className={`text-xs font-bold leading-relaxed ${insight.type === 'CRITICAL' ? 'text-red-800' : insight.type === 'WARNING' ? 'text-amber-800' : 'text-emerald-800'}`}>{insight.text}</p>
                  </div>
              ))}
          </div>
      </div>

      {/* TIER 2: RUNWAY & DEMAND PLANNER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Wallet size={14}/> Cashflow Runway</div>
              <div className="text-5xl font-black text-slate-800 mb-2">{dash.forecast.cashRunwayDays} <span className="text-lg text-slate-500">HARI</span></div>
              <p className="text-[10px] font-bold text-slate-500 mb-4">Estimasi kas bebas Anda bertahan untuk membiayai operasional (Tanpa menghitung pemasukan baru).</p>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between items-center"><span className="text-xs font-bold text-slate-600">Usable Cash</span><span className="font-black text-emerald-600">{formatRp(dash.cashReadyTotal - dash.hutangAyamAktif)}</span></div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Activity size={14}/> Chicken Demand Planner (7 Hari)</div>
              <div className="text-5xl font-black text-orange-600 mb-2">{dash.forecast.targetAyam7Days} <span className="text-lg text-orange-400">KG</span></div>
              <p className="text-[10px] font-bold text-slate-500 mb-4">Kebutuhan produksi ayam untuk 7 hari ke depan berdasarkan tren moving average.</p>
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 flex justify-between items-center"><span className="text-xs font-bold text-orange-800">Defisit/Perlu Beli</span><span className="font-black text-red-600">{dash.forecast.ayamDeficit7Days} KG</span></div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><TrendingUp size={14}/> Sales Growth (vs 7 Hari Lalu)</div>
              <div className={`text-5xl font-black mb-2 ${dash.forecast.salesGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {dash.forecast.salesGrowth > 0 ? '+' : ''}{dash.forecast.salesGrowth}%
              </div>
              <p className="text-[10px] font-bold text-slate-500 mb-4">Pergerakan omzet 7 hari terakhir dibandingkan dengan 7 hari sebelumnya.</p>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between items-center"><span className="text-xs font-bold text-slate-600">True Net Profit (Periode)</span><span className="font-black text-slate-800">{formatRp(dash.trueNetProfit)}</span></div>
          </div>

      </div>

      {/* TIER 3: MARKETPLACE ANALYTICS & ROI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
          <div className="lg:col-span-12 bg-white rounded-2xl border shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6 border-b pb-4"><div className="bg-orange-100 p-2 rounded-lg text-orange-600"><LineChart size={20}/></div><h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm">Omnichannel ROI & Margin Analytics</h3></div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {dash.channelArr.map((ch, idx) => {
                      const margin = ch.gross > 0 ? ((ch.netProfit / ch.gross) * 100).toFixed(1) : 0;
                      return (
                      <div key={idx} className="p-4 border rounded-xl bg-slate-50 shadow-sm relative overflow-hidden group">
                          <div className="absolute right-0 top-0 w-1.5 h-full bg-slate-200 group-hover:bg-orange-400 transition-colors"></div>
                          <div className="flex justify-between items-center mb-4">
                              <span className="font-black text-slate-700 uppercase text-sm">{ch.channel}</span>
                              <span className={`text-[10px] font-black px-2 py-1 rounded ${margin > 20 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{margin}% Margin</span>
                          </div>
                          <div className="space-y-2 text-xs font-bold">
                              <div className="flex justify-between text-slate-600"><span>Gross Revenue:</span><span>{formatRp(ch.gross)}</span></div>
                              <div className="flex justify-between text-red-500"><span>Platform Fee:</span><span>-{formatRp(ch.fee)}</span></div>
                              <div className="flex justify-between text-emerald-600 border-t pt-2 mt-2"><span>Net Profit:</span><span className="font-black text-sm">{formatRp(ch.netProfit)}</span></div>
                          </div>
                      </div>
                  )})}
              </div>
          </div>
      </div>
      
    </div>
  );
}
