import React, { useState } from 'react';
import { Wallet, TrendingUp, Calendar, Printer, FileText, ArrowRightLeft, BellRing, Activity, AlertCircle, Clock, CreditCard, DollarSign } from 'lucide-react';
import { formatRp, getTodayStr } from '../../utils/helpers';
import useDashboardPusat from '../../hooks/useDashboardPusat';

const getFirstDayOfMonthLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
};

const StatCard = ({ title, value, icon, color, subtitle, subValue }) => (
  <div className={`p-4 rounded-2xl border flex flex-col justify-between relative overflow-hidden ${color} shadow-sm`}>
    <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">{icon}</div>
    <div className="flex justify-between items-start mb-2 relative z-10"><h3 className="font-bold text-[10px] opacity-90 uppercase tracking-wider">{title}</h3></div>
    <div className="relative z-10">
        <div className="text-xl lg:text-2xl font-black tracking-tight">{value}</div>
        {subtitle && (
            <div className="flex justify-between items-center mt-1.5 border-t border-black/10 pt-1.5">
                <span className="text-[9px] font-bold opacity-80 uppercase">{subtitle}</span>
                {subValue && <span className="text-[10px] font-black">{subValue}</span>}
            </div>
        )}
    </div>
  </div>
);

export default function TabDashboard({ orders, expenses, purchases, piutangPayments, pemalangReports, stokData, supplierLedger, cashflowTransactions, marketplaceSettlement, setPrintData }) {
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonthLocal());
  const [dateTo, setDateTo] = useState(getTodayStr());

  const dash = useDashboardPusat({ orders, expenses, purchases, piutangPayments, pemalangReports, stokData, supplierLedger, cashflowTransactions, marketplaceSettlement, dateFrom, dateTo });

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* FILTER GLOBAL */}
      <div className="bg-white p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-2.5 rounded-xl text-white shadow-md"><DollarSign size={20}/></div>
              <div><h3 className="font-black text-slate-800 leading-none text-lg">Cashflow Core Engine</h3><p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wider">Monitor Uang Nyata & Hutang</p></div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-2 text-sm font-bold border border-slate-300 rounded-xl bg-slate-50" />
              <span className="text-slate-400 self-center font-bold text-xs uppercase">s/d</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-2 text-sm font-bold border border-slate-300 rounded-xl bg-slate-50" />
          </div>
      </div>

      {/* FINANCE CORE METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="CASH READY (SIAP PAKAI)" value={formatRp(dash.cashReadyTotal)} icon={<Wallet size={64}/>} color="bg-emerald-50 border-emerald-200 text-emerald-900" subtitle="Uang Di Laci & Bank" subValue="Realtime" />
        <StatCard title="HUTANG AYAM AKTIF" value={formatRp(dash.hutangAyamAktif)} icon={<AlertCircle size={64}/>} color="bg-red-50 border-red-200 text-red-900" subtitle="Wajib Dibayar" subValue="Supplier Ledger" />
        <StatCard title="PENDING SETTLEMENT" value={formatRp(dash.pendingCash)} icon={<Clock size={64}/>} color="bg-orange-50 border-orange-200 text-orange-900" subtitle="Uang Nyantol (Marketplace)" subValue="Menunggu Cair" />
        <StatCard title="CASHFLOW FORECAST" value={formatRp(dash.cashReadyTotal - dash.hutangAyamAktif)} icon={<TrendingUp size={64}/>} color="bg-blue-50 border-blue-200 text-blue-900" subtitle="Sisa Uang jika Hutang Lunas" subValue="Estimasi" />
      </div>

      {/* DETAIL ALERTS */}
      <div className="bg-white rounded-2xl border shadow-sm flex flex-col p-6">
          <div className="flex items-center gap-3 mb-4 border-b pb-3">
              <div className="bg-red-100 p-2 rounded-lg text-red-700"><BellRing size={20}/></div>
              <h3 className="font-bold text-lg text-slate-800 tracking-wide uppercase">Finance & Cashflow Warning</h3>
          </div>
          <div className="space-y-3">
              {dash.alerts.length === 0 ? (
                  <div className="text-center p-6 text-slate-400 text-sm italic">Cashflow aman. Cash Ready mencukupi untuk menutup hutang aktif.</div>
              ) : (
                  dash.alerts.map((a, idx) => (
                      <div key={idx} className={`p-4 rounded-xl border flex items-start gap-4 shadow-sm bg-white border-red-200`}>
                          <AlertCircle size={24} className={`shrink-0 mt-0.5 text-red-500`}/>
                          <div>
                              <h4 className={`text-xs font-black uppercase mb-1 text-red-700`}>{a.title}</h4>
                              <p className="text-xs text-slate-600 font-medium leading-snug">{a.desc}</p>
                          </div>
                      </div>
                  ))
              )}
          </div>
      </div>
    </div>
  );
}
