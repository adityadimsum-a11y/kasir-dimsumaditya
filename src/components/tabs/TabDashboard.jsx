import React from 'react';
import { 
  Building2, TrendingUp, AlertTriangle, Box, 
  Wallet, Coins, ShoppingCart, Store, ArrowRight, Zap, Target
} from 'lucide-react';
import { formatRp, getTodayStr, formatDate } from '../../utils/helpers';
import useDashboardPusat from '../../hooks/useDashboardPusat';
import SimpleSVGLineChart from '../ui/SimpleSVGLineChart';

export default function TabDashboard(props) {
  const todayStr = getTodayStr();
  
  // Mengambil data dari engine perhitungan khusus Pusat
  const data = useDashboardPusat(props);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* 1. HEADER & GREETING */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 flex items-center justify-between shadow-2xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900">
            <Building2 size={28} />
            </div>
            <div>
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-wide">COMMAND CENTER</h2>
            <p className="text-xs font-bold text-blue-400 mt-1 uppercase tracking-widest">Dimsum Aditya Enterprise — {formatDate(todayStr)}</p>
            </div>
        </div>
        <div className="relative z-10 hidden md:block text-right">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Valuasi Aset Gudang (HPP)</div>
            <div className="text-2xl font-black text-emerald-400 mt-1">{formatRp(data.totalValuasiGudang)}</div>
        </div>
      </div>

      {/* 2. EXECUTIVE FINANCIAL RADAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Wallet size={100}/></div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Wallet size={14}/> Kas Bersih (Global)</div>
            <div className="text-4xl font-black text-slate-800">{formatRp(data.cashReadyTotal)}</div>
            <div className="text-[10px] text-slate-500 mt-2 font-bold">Dana tunai dan saldo bank yang siap dicairkan.</div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-amber-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Coins size={100}/></div>
            <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-2"><TrendingUp size={14}/> Piutang Mengambang</div>
            <div className="text-4xl font-black text-amber-600">{formatRp(data.totalPiutangPelanggan + data.pendingMarketplace)}</div>
            <div className="text-[10px] text-amber-700/60 mt-2 font-bold">Piutang Pelanggan Lokal + Saldo tertahan di GoFood/Shopee.</div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-rose-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><AlertTriangle size={100}/></div>
            <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-4 flex items-center gap-2"><AlertTriangle size={14}/> Kewajiban Hutang Supplier</div>
            <div className="text-4xl font-black text-rose-600">{formatRp(data.hutangAyamAktif)}</div>
            <div className="text-[10px] text-rose-700/60 mt-2 font-bold">Total tagihan belanja ayam/bahan baku yang belum dilunasi.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* KOLOM KIRI (LEBAR: 2) -> AI COMMAND TASKS & TREN OMZET */}
          <div className="lg:col-span-2 space-y-6">
              
              {/* SMART ACTION COMMAND CENTER */}
              <div className="bg-white rounded-3xl border border-blue-200 shadow-sm p-6 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                      <h3 className="font-black text-slate-800 text-sm tracking-wide uppercase flex items-center gap-2">
                          <Zap size={18} className="text-blue-500"/> Sistem Rekomendasi AI (Task Queue)
                      </h3>
                      <span className="bg-blue-50 text-blue-600 px-3 py-1 text-[10px] font-black rounded-full uppercase border border-blue-100">{data.operationTasks.length} Tugas Menunggu</span>
                  </div>
                  
                  {data.operationTasks.length === 0 ? (
                      <div className="text-center py-8">
                          <Target size={40} className="mx-auto text-emerald-200 mb-3"/>
                          <h4 className="text-emerald-700 font-bold uppercase tracking-wide">Semua Operasional Terkendali</h4>
                          <p className="text-xs text-slate-500 mt-1">Stok ayam aman, dan freezer cabang masih mencukupi.</p>
                      </div>
                  ) : (
                      <div className="space-y-4">
                          {data.operationTasks.map(task => (
                              <div key={task.id} className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${task.priority === 'CRITICAL' ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                                  <div>
                                      <div className="flex items-center gap-2 mb-1">
                                          {task.priority === 'CRITICAL' && <span className="bg-rose-600 text-white text-[9px] px-2 py-0.5 rounded uppercase font-black animate-pulse">URGENT</span>}
                                          <h4 className="font-black text-slate-800 uppercase text-sm">{task.title}</h4>
                                      </div>
                                      <p className="text-xs text-slate-600 font-medium">{task.desc}</p>
                                  </div>
                                  <button className="whitespace-nowrap bg-white border border-slate-300 hover:border-slate-800 hover:bg-slate-900 hover:text-white transition px-4 py-2 rounded-xl text-xs font-black uppercase shadow-sm">
                                      {task.actionLabel}
                                  </button>
                              </div>
                          ))}
                      </div>
                  )}
              </div>

              {/* TREND GRAFIK 7 HARI */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 h-[340px] flex flex-col">
                  <h3 className="font-black text-slate-800 text-sm tracking-wide uppercase flex items-center gap-2 mb-4">
                      <TrendingUp size={18} className="text-emerald-500"/> Tren Omzet Global (7 Hari Terakhir)
                  </h3>
                  <div className="flex-1 min-h-0 bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-center">
                     {/* Menampilkan komponen Chart SVG Ringan */}
                     <SimpleSVGLineChart data={data.trendData} />
                  </div>
              </div>

          </div>

          {/* KOLOM KANAN (LEBAR: 1) -> INVENTORY FISIK & LEADERBOARD CABANG */}
          <div className="lg:col-span-1 space-y-6">
              
              {/* KARTU STOK GUDANG PUSAT */}
              <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl p-6">
                  <h3 className="font-black text-white text-sm tracking-wide uppercase flex items-center gap-2 mb-6 border-b border-slate-800 pb-4">
                      <Box size={18} className="text-blue-400"/> Fisik Gudang & Freezer Pusat
                  </h3>
                  
                  <div className="space-y-6">
                      <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Daging Ayam Mentah</div>
                          <div className="text-3xl font-black text-white">{data.ayamGudangQty.toLocaleString('id-ID')} <span className="text-sm text-orange-400">KG</span></div>
                          <div className={`mt-2 text-[10px] font-bold px-2 py-1 rounded w-max ${data.ayamDaysRemaining <= 4 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>Estimasi Tahan: {data.ayamDaysRemaining.toFixed(1)} Hari</div>
                      </div>

                      <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Dimsum Frozen</div>
                          <div className="text-3xl font-black text-white">{data.totalStokDimsumPcs.toLocaleString('id-ID')} <span className="text-sm text-blue-400">PCS</span></div>
                          <div className="mt-2 text-[10px] font-bold px-2 py-1 rounded w-max bg-blue-500/20 text-blue-400">Setara {Math.floor(data.totalStokDimsumPcs/50).toLocaleString('id-ID')} Mika</div>
                      </div>
                  </div>
              </div>

              {/* RANKING KINERJA CABANG */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col max-h-[380px]">
                  <h3 className="font-black text-slate-800 text-sm tracking-wide uppercase flex items-center gap-2 mb-4">
                      <Store size={18} className="text-indigo-500"/> Kinerja Cabang (Bulan Ini)
                  </h3>
                  <div className="overflow-y-auto pr-2 flex-1 space-y-3 custom-scrollbar">
                      {data.leaderboardArr.length === 0 ? (
                          <div className="text-center text-xs text-slate-400 py-4">Belum ada data penjualan cabang.</div>
                      ) : (
                          data.leaderboardArr.map((cabang, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition">
                                  <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-300 text-slate-700' : idx === 2 ? 'bg-orange-300 text-white' : 'bg-white text-slate-400'}`}>{idx+1}</div>
                                      <div>
                                          <div className="font-black text-slate-800 text-xs uppercase">{cabang.name}</div>
                                          <div className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider mt-0.5">Hari ini: {formatRp(cabang.omzetHariIni)}</div>
                                      </div>
                                  </div>
                                  <div className="font-black text-slate-700">{formatRp(cabang.omzetBulanIni)}</div>
                              </div>
                          ))
                      )}
                  </div>
              </div>

          </div>
      </div>

    </div>
  );
}
