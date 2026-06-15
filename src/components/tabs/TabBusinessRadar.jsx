import React, { useMemo, useState } from 'react';
import { Award, Trophy, Users, ShoppingBag, DollarSign, Calendar, TrendingUp, Filter, BarChart3, Star } from 'lucide-react';
import { formatDate, safeJsonParse } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabBusinessRadar({ 
  orders = [], 
  masterBranches = [], master_branches, 
  cashflowTransactions = [] 
}) {
  const [branchScope, setBranchScope] = useState('ALL_BRANCHES');
  const [rankMetric, setRankScope] = useState('TOTAL_OMSET'); // TOTAL_OMSET | TOTAL_QTY | FREKUENSI

  const realBranches = useMemo(() => master_branches || masterBranches || [], [master_branches, masterBranches]);

  // --- ENGINE SAKTI MULTI-BRANCH CUSTOMER LEADERBOARD ---
  const leaderboardIntelligence = useMemo(() => {
    const leaderMap = {};

    (orders || []).forEach(o => {
      if (o.isDeleted) return;
      
      // Saringan Scope Multi-Cabang (Pusat Tangerang bisa melacak Pemalang & Ritel sekaligus)
      if (branchScope !== 'ALL_BRANCHES' && o.branch_id !== branchScope) return;

      const cName = String(o.customer_name || 'PELANGGAN UMUM').toUpperCase().trim();
      const items = safeJsonParse(o.items, []);
      const totalVolumePcs = items.reduce((s, i) => s + Number(i.qty || 0), 0);

      if (!leaderMap[cName]) {
        leaderMap[cName] = {
          name: cName,
          branchOrigin: o.branch_id,
          totalBelanja: 0,
          totalVolume: 0,
          frekuensiOrder: 0
        };
      }

      leaderMap[cName].totalBelanja += Number(o.total_amount || 0);
      leaderMap[cName].totalVolume += totalVolumePcs;
      leaderMap[cName].frekuensiOrder += 1;
    });

    // Mengurutkan klasemen liga berdasarkan metrik pilihan Bos Sultan
    return Object.values(leaderMap).sort((a, b) => {
      if (rankMetric === 'TOTAL_OMSET') return b.totalBelanja - a.totalBelanja;
      if (rankMetric === 'TOTAL_QTY') return b.totalVolume - a.totalVolume;
      return b.frekuensiOrder - a.frekuensiOrder;
    });
  }, [orders, branchScope, rankMetric]);

  // --- STATISTIK MAKRO RADAR BISNIS SULTAN ---
  const makroStats = useMemo(() => {
    let omsetGlobal = 0;
    let qtyGlobal = 0;
    (orders || []).forEach(o => {
      if(!o.isDeleted) {
        omsetGlobal += Number(o.total_amount || 0);
        qtyGlobal += Number(o.qty || 0);
      }
    });
    return { omsetGlobal, qtyGlobal };
  }, [orders]);

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-200">
      
      {/* HEADER BANNER RADAR */}
      <div className="card-holo bg-white p-5 border border-slate-200 rounded-2xl shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-red-50 text-red-600 p-2.5 rounded-xl shadow-3xs"><BarChart3 size={18}/></div>
          <div>
            <h2 className="text-sm font-black text-slate-800 normal-case">Radar Performa &amp; Analitik Makro Sultan</h2>
            <p className="text-[10px] font-bold text-slate-400 normal-case mt-0.5">Analisis pertumbuhan omset dan klasemen liga pelanggan berharga tinggi.</p>
          </div>
        </div>
        <div className="flex gap-4 text-right text-xs font-bold">
          <div className="bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl shadow-inner">
            <div className="text-[8px] text-slate-400 uppercase">Omset Konsolidasi</div>
            <div className="font-black text-slate-800 text-sm mt-0.5">{formatRupiah(makroStats.omsetGlobal)}</div>
          </div>
        </div>
      </div>

      {/* CORE LEADERBOARD MATRIX */}
      <div className="card-holo bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
        
        {/* SUB-HEADER SARINGAN MATRIX LEADERBOARD */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-amber-500" />
            <h4 className="font-black text-slate-800 text-xs normal-case">Top Klasemen Liga Pelanggan (Leaderboard Multi-Cabang)</h4>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Filter Cabang Scope */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1.5 rounded-lg shadow-3xs">
              <Filter size={10} className="text-slate-400 ml-1"/>
              <select value={branchScope} onChange={e=>setBranchScope(e.target.value)} className="text-[10px] font-bold text-slate-600 outline-none bg-transparent cursor-pointer">
                <option value="ALL_BRANCHES">Semua Wilayah Cabang</option>
                <option value="TANGERANG_PUSAT">Tangerang Pusat (HQ)</option>
                <option value="PRODUKSI_PEMALANG">Cabang Pemalang</option>
                {realBranches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
              </select>
            </div>

            {/* Filter Metrik Pengurutan */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1.5 rounded-lg shadow-3xs">
              <Star size={10} className="text-amber-500 ml-1"/>
              <select value={rankMetric} onChange={e=>setRankScope(e.target.value)} className="text-[10px] font-bold text-slate-600 outline-none bg-transparent cursor-pointer">
                <option value="TOTAL_OMSET">Berdasar Total Belanja (Rupiah)</option>
                <option value="TOTAL_QTY">Berdasar Volume Muatan (Pcs)</option>
                <option value="FREKUENSI">Berdasar Frekuensi Keaktifan Order</option>
              </select>
            </div>
          </div>
        </div>

        {/* DATA TABEL MATRIX */}
        <div className="overflow-x-auto custom-scrollbar p-1">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/50 text-[10px] text-slate-500 normal-case border-b border-slate-100">
              <tr>
                <th className="px-5 py-3 font-black text-center w-16">Peringkat</th>
                <th className="px-5 py-3 font-black">Nama Lengkap Pelanggan</th>
                <th className="px-5 py-3 font-black text-center">Asal Node Cabang</th>
                <th className="px-5 py-3 font-black text-center">Frekuensi Transaksi</th>
                <th className="px-5 py-3 font-black text-center">Volume Kuantitas</th>
                <th className="px-5 py-3 font-black text-right">Kontribusi Omset Belanja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold text-xs bg-white text-slate-700">
              {leaderboardIntelligence.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-16 text-slate-400 font-medium normal-case">Tidak ada rekam jejak liga pelanggan ditemukan untuk scope wilayah ini.</td></tr>
              ) : (
                leaderboardIntelligence.map((item, idx) => (
                  <tr key={item.name} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4 text-center">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] shadow-3xs mx-auto ${idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-300 text-slate-700' : idx === 2 ? 'bg-orange-400 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        #{idx + 1}
                      </span>
                    </td>
                    <td className="px-5 py-4 uppercase font-black text-slate-900 text-[11px] flex items-center gap-2">
                       {item.name}
                       {idx === 0 && <span className="bg-amber-50 text-amber-700 text-[8px] font-black tracking-wider px-1.5 py-0.5 rounded border border-amber-200">JUARA UMUM</span>}
                    </td>
                    <td className="px-5 py-4 text-center text-slate-500 font-bold normal-case text-[11px]">
                      🏢 {item.branchOrigin.replace(/_/g, ' ')}
                    </td>
                    <td className="px-5 py-4 text-center font-black text-slate-700 text-xs">
                      {item.frekuensiOrder} <span className="text-[10px] text-slate-400 font-normal">Kali Invoice</span>
                    </td>
                    <td className="px-5 py-4 text-center font-black text-blue-600 text-xs">
                      {formatNumber(item.totalVolume)} <span className="text-[10px] text-slate-400 font-normal">PCS</span>
                    </td>
                    <td className="px-5 py-4 text-right font-black text-emerald-600 text-sm">
                      {formatRupiah(item.totalBelanja)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
