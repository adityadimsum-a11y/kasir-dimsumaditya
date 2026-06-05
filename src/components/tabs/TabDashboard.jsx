import React, { useState } from 'react';
import { Wallet, TrendingUp, AlertCircle, Activity, ShoppingBag, Store, Package, BrainCircuit, Factory, TrendingDown, CheckSquare, Trophy, CheckCircle, Zap } from 'lucide-react';
import { formatRp, getTodayStr } from '../../utils/helpers';
import useDashboardPusat from '../../hooks/useDashboardPusat';

const getFirstDayOfMonthLocal = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
};

const StatCard = ({ title, value, icon, color, subtitle, subValue }) => (
  // ... (SAMA SEPERTI SEBELUMNYA)
  <div className={`p-5 rounded-2xl border flex flex-col justify-between relative overflow-hidden ${color} shadow-sm`}>
    <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">{icon}</div>
    <div className="flex justify-between items-start mb-2 relative z-10"><h3 className="font-bold text-[11px] opacity-90 uppercase tracking-wider">{title}</h3></div>
    <div className="relative z-10">
        <div className="text-2xl lg:text-3xl font-black tracking-tight">{value}</div>
    </div>
  </div>
);

export default function TabDashboard(props) {
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonthLocal());
  const [dateTo, setDateTo] = useState(getTodayStr());

  const dash = useDashboardPusat({ ...props, dateFrom, dateTo });

  // THE MAGIC ONE-CLICK TRIGGER
  const handleExecuteTask = (task) => {
      const confirmMsg = `Peringatan Eksekusi Otomatis:\n\nApakah Anda yakin ingin menjalankan aksi "${task.title}"?\n\nSistem akan membuat transaksi operasional ke dalam database secara otomatis.`;
      
      if(window.confirm(confirmMsg)) {
          // Menembak event_execute_task ke App.jsx yang terhubung langsung ke Backend Code.gs
          props.sendToSheet('event_execute_task', task, 'system_tasks');
          alert("Sistem sedang mengeksekusi Workflow & Audit Trail di background... Layar akan diperbarui dalam 1 detik.");
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* FILTER GLOBAL */}
      <div className="bg-white p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-2.5 rounded-xl text-white shadow-md"><BrainCircuit size={20}/></div>
              <div><h3 className="font-black text-slate-800 leading-none text-lg">Executive Command Center</h3><p className="text-[10px] font-bold text-emerald-500 uppercase mt-1 tracking-wider flex items-center gap-1"><Zap size={12}/> EXECUTION ENGINE ACTIVE</p></div>
          </div>
          {/* Date Picker */}
      </div>

      {/* TIER 1: EXECUTIVE METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="NET PROFIT (HARI INI)" value={formatRp(dash.todayNetProfit)} icon={<TrendingUp size={64}/>} color="bg-emerald-600 text-white border-emerald-700" />
        <StatCard title="TOTAL CASH READY" value={formatRp(dash.cashReadyTotal)} icon={<Wallet size={64}/>} color="bg-blue-600 text-white border-blue-700" />
        <StatCard title="HUTANG AYAM AKTIF" value={formatRp(dash.hutangAyamAktif)} icon={<AlertCircle size={64}/>} color="bg-red-600 text-white border-red-700" />
        <StatCard title="TOTAL ASSET INVENTORY" value={formatRp(dash.totalAssetInventory)} icon={<Package size={64}/>} color="bg-purple-600 text-white border-purple-700" />
      </div>

      {/* TIER 2: ONE-CLICK EXECUTION TASK ENGINE */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-indigo-600">
          <div className="flex items-center gap-3 mb-5 border-b pb-4">
              <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700"><CheckSquare size={20}/></div>
              <div><h3 className="font-black text-slate-800 uppercase tracking-wide">One-Click Action Recommendation</h3><p className="text-[10px] font-medium text-slate-500 uppercase mt-0.5">Sistem mengkalkulasi kebutuhan. Anda cukup klik 1 tombol untuk mengeksekusi.</p></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dash.automationTasks.length === 0 ? (
                  <div className="col-span-full text-center p-8 border border-dashed rounded-xl border-slate-200 text-slate-400 font-bold text-sm">
                      <CheckCircle size={32} className="mx-auto mb-2 text-emerald-400"/>
                      Semua antrean Workflow Operasional kosong. ERP berjalan sempurna.
                  </div>
              ) : (
                  dash.automationTasks.map((task, idx) => (
                      <div key={idx} className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 flex flex-col justify-between shadow-sm">
                          <div>
                              <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">{task.type}</div>
                              <h4 className="font-bold text-slate-800 text-sm mb-1">{task.title}</h4>
                              <p className="text-[11px] text-slate-600 leading-tight mb-4">{task.desc}</p>
                          </div>
                          <button onClick={() => handleExecuteTask(task)} className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-lg text-xs hover:bg-indigo-700 transition shadow flex items-center justify-center gap-2">
                              <Zap size={14}/> {task.actionLabel}
                          </button>
                      </div>
                  ))
              )}
          </div>
      </div>

      {/* ... (TIER 3: FORECAST & KPI SAMA SEPERTI SEBELUMNYA) ... */}
    </div>
  );
}
