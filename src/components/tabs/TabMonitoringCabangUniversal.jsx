import React, { useState } from 'react';
import { Factory, Store } from 'lucide-react';
import TabMonitoringPemalang from './TabMonitoringPemalang';
import TabDashboardBranch from './TabDashboardBranch';

export default function TabMonitoringCabangUniversal(props) {
  // State utama untuk memilih cabang yang ingin dipantau oleh HQ/Admin Pusat
  // Default awal kita arahkan ke PEMALANG sesuai bawaan sistem sebelumnya
  const [selectedMonitor, setSelectedMonitor] = useState('PEMALANG'); // Pilihan: 'PEMALANG' | 'CIBINONG'

  return (
    <div className="space-y-6 text-slate-700 normal-case animate-in fade-in duration-200">
      
      {/* ==================== HEADER & SWITCHER AREA ==================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <h2 className="text-base font-black text-slate-800 tracking-tight uppercase">Monitor Multi Cabang</h2>
          <p className="text-[11px] font-bold text-slate-400 normal-case mt-0.5">
            Gunakan tombol kendali di samping untuk berpindah pemantauan antar pabrik produksi dan resto outlet.
          </p>
        </div>

        {/* CONTAINER TOMBOL SWITCH FLUID - STYLE ENTERPRISE CLEAN */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-max gap-1 shadow-inner border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedMonitor('PEMALANG')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedMonitor === 'PEMALANG'
                ? 'bg-white text-red-600 shadow-xs border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Factory size={14} />
            Pabrik Pemalang
          </button>
          
          <button
            type="button"
            onClick={() => setSelectedMonitor('CIBINONG')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedMonitor === 'CIBINONG'
                ? 'bg-white text-blue-600 shadow-xs border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Store size={14} />
            Resto Cibinong
          </button>
        </div>
      </div>

      {/* ==================== CONTENT DISPLAY AREA ==================== */}
      {/* Menggunakan transisi halus micro-interaction agar perpindahan layar tidak kaku */}
      <div className="key-render-container animate-in fade-in zoom-in-98 duration-150">
        {selectedMonitor === 'PEMALANG' ? (
          // Jika memilih Pemalang, oper seluruh properti ke TabMonitoringPemalang asli
          <TabMonitoringPemalang {...props} />
        ) : (
          // Jika memilih Cibinong, oper properti dan paksa prop forcedBranchId menjadi 'CIBINONG'
          <TabDashboardBranch {...props} forcedBranchId="CIBINONG" />
        )}
      </div>

    </div>
  );
}
