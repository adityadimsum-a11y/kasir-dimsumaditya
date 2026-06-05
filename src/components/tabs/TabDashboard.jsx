import React, { useState } from 'react';
import { Wallet, TrendingUp, AlertCircle, Activity, ShoppingBag, Package, BrainCircuit, TrendingDown, PieChart, ShieldCheck, Lock, CheckCircle, Scale } from 'lucide-react';
import { formatRp, getTodayStr } from '../../utils/helpers';
import useDashboardPusat from '../../hooks/useDashboardPusat';

const getFirstDayOfMonthLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

export default function TabDashboard(props) {
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonthLocal());
  const [dateTo, setDateTo] = useState(getTodayStr());

  const dash = useDashboardPusat({ ...props, dateFrom, dateTo });

  // THE CLOSING EXECUTION
  const handleExecuteClosing = () => {
      const msg = `PERINGATAN AUDIT!\n\nAnda akan melakukan Financial Closing untuk tanggal hari ini (${getTodayStr()}).\n\nSetelah dikunci, SELURUH transaksi di tanggal ini (dan sebelumnya) TIDAK BISA DIEDIT ATAU DIHAPUS lagi oleh siapapun kecuali Super Admin.\n\nLanjutkan Closing?`;
      if(window.confirm(msg)) {
          props.sendToSheet('event_closing', dash.closingPayload, 'financial_closings');
          alert('Buku Besar telah berhasil ditutup dan dibekukan untuk hari ini!');
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* HEADER COMMAND CENTER */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4 relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10"><Scale size={150}/></div>
          <div className="flex items-center gap-4 relative z-10">
              <div className="bg-indigo-500/20 p-3 rounded-xl border border-indigo-500/50 text-indigo-400"><PieChart size={24}/></div>
              <div><h3 className="font-black text-white leading-none text-xl tracking-wide">Owner Financial Command Center</h3><p className="text-[10px] font-bold text-indigo-300 uppercase mt-1.5 tracking-widest flex items-center gap-1"><ShieldCheck size={12}/> Enterprise Accounting & Balance Sheet Engine</p></div>
          </div>
          
          <div className="relative z-10 bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10 flex items-center gap-4">
              <div className="text-right">
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Status Buku Hari Ini</div>
                  {dash.isTodayClosed ? (
                      <div className="flex items-center gap-1 text-emerald-400 font-black text-sm uppercase"><Lock size={14}/> CLOSED & LOCKED</div>
                  ) : (
                      <div className="flex items-center gap-1 text-amber-400 font-black text-sm uppercase"><Activity size={14}/> OPEN (Belum Closing)</div>
                  )}
              </div>
              {!dash.isTodayClosed && props.user.role === 'super_admin' && (
                  <button onClick={handleExecuteClosing} className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 transition">
                      <Lock size={14}/> Eksekusi Closing
                  </button>
              )}
          </div>
      </div>

      {/* TIER 1: BUSINESS HEALTH SCORE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Corporate Health Score</div>
              
              {/* Score Circle */}
              <div className={`w-32 h-32 rounded-full border-8 flex items-center justify-center mb-4 ${dash.healthScore > 80 ? 'border-emerald-500' : dash.healthScore > 50 ? 'border-amber-400' : 'border-red-500'}`}>
                  <span className={`text-4xl font-black ${dash.healthScore > 80 ? 'text-emerald-600' : dash.healthScore > 50 ? 'text-amber-600' : 'text-red-600'}`}>{dash.healthScore}</span>
              </div>
              
              <h4 className={`text-lg font-black uppercase tracking-wide ${dash.healthScore > 80 ? 'text-emerald-700' : dash.healthScore > 50 ? 'text-amber-700' : 'text-red-700'}`}>{dash.healthStatus}</h4>
              <p className="text-[10px] font-bold text-slate-500 mt-2 text-center px-4">Rasio Likuiditas (Aset vs Hutang): <span className="text-slate-800">{dash.liquidityRatio.toFixed(2)}x</span></p>
          </div>

          {/* BALANCE SHEET (NERACA) */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="bg-slate-50 p-4 border-b flex items-center gap-3"><Scale size={18} className="text-slate-600"/><h3 className="font-bold text-slate-800 uppercase text-sm tracking-wide">Balance Sheet (Neraca Realtime)</h3></div>
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x flex-1">
                  
                  {/* ASSETS */}
                  <div className="p-6 flex flex-col">
                      <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b pb-2 mb-4">ASSETS (Aset Perusahaan)</h4>
                      <div className="space-y-3 flex-1">
                          <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-600">Cash & Bank (Kas Ready)</span><span className="font-black text-slate-800">{formatRp(dash.cashReadyTotal)}</span></div>
                          <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-600">Accounts Receivable (Marketplace)</span><span className="font-black text-slate-800">{formatRp(dash.pendingMarketplace)}</span></div>
                          <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-600">Inventory Value (Ayam + Frozen)</span><span className="font-black text-slate-800">{formatRp(dash.totalAssetInventory)}</span></div>
                      </div>
                      <div className="flex justify-between items-center border-t-2 border-slate-800 pt-3 mt-4"><span className="text-sm font-black uppercase text-blue-800">Total Assets</span><span className="font-black text-lg text-blue-600">{formatRp(dash.totalAssets)}</span></div>
                  </div>

                  {/* LIABILITIES & EQUITY */}
                  <div className="p-6 flex flex-col">
                      <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest border-b pb-2 mb-4">LIABILITIES & EQUITY (Kewajiban & Modal)</h4>
                      <div className="space-y-3 flex-1">
                          <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-600">Accounts Payable (Hutang Ayam)</span><span className="font-black text-red-600">{formatRp(dash.totalLiabilities)}</span></div>
                          <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-600">Modal & Retained Earnings</span><span className="font-black text-indigo-600">{formatRp(dash.totalEquity)}</span></div>
                      </div>
                      <div className="flex justify-between items-center border-t-2 border-slate-800 pt-3 mt-4"><span className="text-sm font-black uppercase text-red-800">Total L & E</span><span className="font-black text-lg text-slate-800">{formatRp(dash.totalAssets)}</span></div>
                  </div>

              </div>
          </div>
      </div>

    </div>
  );
}
