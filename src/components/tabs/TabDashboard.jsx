import React, { useState } from 'react';
import { Wallet, TrendingUp, AlertCircle, Activity, ShoppingBag, Store, Package, BrainCircuit, Factory, TrendingDown, FileText, PieChart } from 'lucide-react';
import { formatRp, getTodayStr } from '../../utils/helpers';
import useDashboardPusat from '../../hooks/useDashboardPusat';

const getFirstDayOfMonthLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

export default function TabDashboard(props) {
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonthLocal());
  const [dateTo, setDateTo] = useState(getTodayStr());

  const dash = useDashboardPusat({ ...props, dateFrom, dateTo });

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* HEADER */}
      <div className="bg-white p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 border-l-8 border-l-slate-800">
          <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-2.5 rounded-xl text-white shadow-md"><PieChart size={20}/></div>
              <div><h3 className="font-black text-slate-800 leading-none text-lg">Financial & Costing Command Center</h3><p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wider">Enterprise-Grade Financial Accuracy Engine</p></div>
          </div>
          <div className="flex gap-2">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-2 text-sm font-bold border border-slate-300 rounded-xl bg-slate-50 outline-none" />
              <span className="text-slate-400 self-center font-bold text-xs uppercase">s/d</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-2 text-sm font-bold border border-slate-300 rounded-xl bg-slate-50 outline-none" />
          </div>
      </div>

      {/* TIER 1: THE REAL BOTTOM LINE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-md relative overflow-hidden">
            <TrendingUp size={80} className="absolute -right-4 -bottom-4 opacity-20" />
            <h3 className="font-bold text-[10px] opacity-80 uppercase tracking-widest mb-2">TRUE NET PROFIT (Periode)</h3>
            <div className="text-3xl font-black">{formatRp(dash.trueNetProfit)}</div>
            <div className="mt-3 text-[10px] font-bold opacity-90 border-t border-white/20 pt-2">Setelah HPP, Fee, Opex & Waste</div>
        </div>
        <div className="bg-blue-600 text-white p-5 rounded-2xl shadow-md relative overflow-hidden">
            <Package size={80} className="absolute -right-4 -bottom-4 opacity-20" />
            <h3 className="font-bold text-[10px] opacity-80 uppercase tracking-widest mb-2">ASSET VALUATION (INVENTORY)</h3>
            <div className="text-3xl font-black">{formatRp(dash.totalAssetInventory)}</div>
            <div className="mt-3 text-[10px] font-bold opacity-90 border-t border-white/20 pt-2">Ayam Gudang & Frozen Freezer</div>
        </div>
        <div className={`p-5 rounded-2xl shadow-md relative overflow-hidden text-white ${dash.cashflowHealth >= 0 ? 'bg-indigo-600' : 'bg-red-600'}`}>
            <Wallet size={80} className="absolute -right-4 -bottom-4 opacity-20" />
            <h3 className="font-bold text-[10px] opacity-80 uppercase tracking-widest mb-2">CASHFLOW SURVIVAL (RUNWAY)</h3>
            <div className="text-3xl font-black">{formatRp(dash.cashflowHealth)}</div>
            <div className="mt-3 text-[10px] font-bold opacity-90 border-t border-white/20 pt-2">Sisa Kas Setelah Hutang Lunas</div>
        </div>
        <div className="bg-amber-500 text-white p-5 rounded-2xl shadow-md relative overflow-hidden">
            <AlertCircle size={80} className="absolute -right-4 -bottom-4 opacity-20" />
            <h3 className="font-bold text-[10px] opacity-80 uppercase tracking-widest mb-2">HUTANG AYAM JATUH TEMPO</h3>
            <div className="text-3xl font-black">{formatRp(dash.hutangAyamAktif)}</div>
            <div className="mt-3 text-[10px] font-bold opacity-90 border-t border-white/20 pt-2 flex justify-between">Pending Cair: {formatRp(dash.pendingMarketplace)}</div>
        </div>
      </div>

      {/* TIER 2: FINANCIAL STATEMENT (P&L) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
          
          <div className="lg:col-span-8 bg-white rounded-2xl border shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6 border-b pb-4"><div className="bg-slate-100 p-2 rounded-lg text-slate-700"><FileText size={20}/></div><h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm">Statement of Profit & Loss (P&L)</h3></div>
              
              <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100"><span className="font-black text-slate-600 text-xs">GROSS REVENUE (OMZET KOTOR)</span><span className="font-black text-slate-800 text-lg">{formatRp(dash.totalGrossSales)}</span></div>
                  <div className="flex justify-between items-center px-3 border-l-2 border-orange-500 ml-2"><span className="font-bold text-slate-500 text-xs">Cost of Goods Sold (HPP FIFO)</span><span className="font-bold text-orange-600">-{formatRp(dash.totalHPP)}</span></div>
                  <div className="flex justify-between items-center px-3 border-l-2 border-red-500 ml-2"><span className="font-bold text-slate-500 text-xs">Marketplace Fees & Deductions</span><span className="font-bold text-red-600">-{formatRp(dash.totalFees)}</span></div>
                  <div className="flex justify-between items-center px-3 border-l-2 border-indigo-500 ml-2"><span className="font-bold text-slate-500 text-xs">Operational Expenses (OPEX)</span><span className="font-bold text-indigo-600">-{formatRp(dash.totalOpex)}</span></div>
                  <div className="flex justify-between items-center px-3 border-l-2 border-red-800 ml-2"><span className="font-bold text-slate-500 text-xs">Waste & Discrepancy Loss</span><span className="font-bold text-red-800">-{formatRp(dash.totalWasteCost)}</span></div>
                  <div className="flex justify-between items-center bg-emerald-50 p-4 rounded-lg border border-emerald-200 mt-4"><span className="font-black text-emerald-800 text-sm">REAL NET PROFIT</span><span className="font-black text-emerald-600 text-2xl">{formatRp(dash.trueNetProfit)}</span></div>
              </div>
          </div>

          <div className="lg:col-span-4 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-blue-500 flex flex-col">
              <div className="flex items-center gap-3 mb-4"><div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Store size={18}/></div><h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm">Branch P&L Analytics</h3></div>
              <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                  {dash.branchArr.map((br, idx) => (
                      <div key={idx} className="p-3 border rounded-xl bg-slate-50 shadow-sm hover:shadow transition">
                          <div className="flex justify-between items-center mb-2"><h4 className="font-black text-xs uppercase text-slate-700">{br.branch_id}</h4><span className={`text-[10px] font-black px-2 py-0.5 rounded ${br.netProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{formatRp(br.netProfit)}</span></div>
                          <div className="grid grid-cols-2 gap-2 text-[9px] font-bold text-slate-500">
                              <div>Omzet: {formatRp(br.omzet)}</div><div>HPP: -{formatRp(br.hpp)}</div>
                              <div>Fee: -{formatRp(br.fee)}</div><div className="text-red-600">Waste: -{formatRp(br.waste)}</div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>

      </div>
    </div>
  );
}
