import React, { useState } from 'react';
import { Wallet, Activity, BrainCircuit, Zap, ListTodo, AlertTriangle, PlayCircle, ShieldCheck } from 'lucide-react';
import { formatRp, getTodayStr } from '../../utils/helpers';
import useDashboardPusat from '../../hooks/useDashboardPusat';

const getFirstDayOfMonthLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

export default function TabDashboard(props) {
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonthLocal());
  const [dateTo, setDateTo] = useState(getTodayStr());

  // Pastikan Anda mempassing systemTasks dari App.jsx
  const dash = useDashboardPusat({ ...props, systemTasks: props.data.systemTasks, dateFrom, dateTo });

  // THE REAL EXECUTION ENGINE
  const handleExecuteTask = (task) => {
      const isCritical = task.priority === 'CRITICAL';
      const msg = `Mengeksekusi Task: ${task.title}\n\nSistem akan menjalankan instruksi ini ke dalam database (Membuat Draft/Reserve Inventory/Approval otomatis).\n\nLanjutkan Eksekusi?`;
      
      if(window.confirm(msg)) {
          // Tembak event_execute_task ke API App.jsx
          props.sendToSheet('event_execute_task', task, 'system_tasks');
          alert('Task berhasil dilempar ke Background Queue. Layar akan diperbarui...');
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* HEADER */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl flex justify-between items-center relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10"><Zap size={150}/></div>
          <div className="flex items-center gap-4 relative z-10">
              <div className="bg-blue-500/20 p-3 rounded-xl border border-blue-500/50 text-blue-400"><BrainCircuit size={24}/></div>
              <div><h3 className="font-black text-white leading-none text-xl tracking-wide">Operation Command Center</h3><p className="text-[10px] font-bold text-blue-300 uppercase mt-1.5 tracking-widest flex items-center gap-1"><ShieldCheck size={12}/> AI Task Generation & Execution Queue</p></div>
          </div>
      </div>

      {/* OPERATION QUEUE CENTER */}
      <div className="bg-white rounded-2xl border shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700"><ListTodo size={20}/></div>
                  <h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm">Real-World Task Queue</h3>
              </div>
              <div className="text-xs font-bold text-slate-500 bg-white border px-3 py-1.5 rounded-lg shadow-sm">
                  {dash.operationTasks.length} Pending Tasks
              </div>
          </div>
          
          <div className="p-6 bg-slate-50/50">
              {dash.operationTasks.length === 0 ? (
                  <div className="text-center p-10 border border-dashed rounded-xl border-slate-300 bg-white">
                      <CheckCircle size={40} className="mx-auto mb-3 text-emerald-400"/>
                      <h4 className="font-black text-slate-700">Antrean Operasional Kosong</h4>
                      <p className="text-xs font-medium text-slate-500 mt-1">Sistem tidak mendeteksi anomali stok atau keburuhan distribusi mendesak saat ini.</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {dash.operationTasks.map((task, idx) => {
                          const isCritical = task.priority === 'CRITICAL';
                          return (
                          <div key={idx} className={`p-5 rounded-2xl border flex flex-col justify-between shadow-sm bg-white hover:shadow-md transition-shadow ${isCritical ? 'border-red-200' : 'border-slate-200'}`}>
                              <div>
                                  <div className="flex justify-between items-center mb-3">
                                      <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">{task.type}</span>
                                      <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${isCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                          {isCritical && <AlertTriangle size={10} className="inline mr-1 mb-0.5"/>}{task.priority}
                                      </span>
                                  </div>
                                  <h4 className={`font-black text-lg mb-1 ${isCritical ? 'text-red-700' : 'text-slate-800'}`}>{task.title}</h4>
                                  <p className="text-xs text-slate-600 font-medium leading-relaxed mb-5">{task.desc}</p>
                              </div>
                              <button onClick={() => handleExecuteTask(task)} className={`w-full font-black py-3.5 rounded-xl shadow-sm transition flex items-center justify-center gap-2 ${isCritical ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-200' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}>
                                  <PlayCircle size={16}/> {task.actionLabel}
                              </button>
                          </div>
                      )})}
                  </div>
              )}
          </div>
      </div>

      {/* MINI WIDGETS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <div className="bg-white p-5 rounded-xl border shadow-sm flex items-center justify-between">
              <div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cashflow Gap</div><div className={`text-xl font-black ${dash.cashDeficit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatRp(dash.cashDeficit)}</div></div>
              <Wallet size={32} className="text-slate-200"/>
          </div>
          <div className="bg-white p-5 rounded-xl border shadow-sm flex items-center justify-between">
              <div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Stok Ayam Gudang</div><div className="text-xl font-black text-slate-800">{dash.ayamGudangQty.toFixed(1)} KG</div></div>
              <Activity size={32} className="text-slate-200"/>
          </div>
          <div className="bg-white p-5 rounded-xl border shadow-sm flex items-center justify-between">
              <div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Umur Stok Ayam</div><div className={`text-xl font-black ${dash.ayamDaysRemaining <= 2 ? 'text-red-600' : 'text-slate-800'}`}>{dash.ayamDaysRemaining} HARI</div></div>
              <Zap size={32} className="text-slate-200"/>
          </div>
      </div>
      
    </div>
  );
}
