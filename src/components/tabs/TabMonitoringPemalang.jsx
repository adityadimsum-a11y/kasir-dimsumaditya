import React, { useMemo, useState } from 'react';
import { Store, Package, ShoppingCart, TrendingUp, AlertCircle, Filter } from 'lucide-react';
import { formatRp, formatDate, getLocalYMD, getTodayStr, safeSort } from '../../utils/helpers';

export default function TabMonitoringPemalang({ orders, pemalangReports, stokData }) {
  const todayStr = getTodayStr();
  const [filterDate, setFilterDate] = useState(todayStr); 
  
  const MASTER_AYAM_KG = 30; 
  const MASTER_PCS = 1000; 
  const KG_PER_KANTONG = 10;
  const PCS_PER_MIKA = 50;

  const stats = useMemo(() => {
    const mutasiAyamPemalang = (stokData || []).filter(s => s.type === 'MUTASI_AYAM_PEMALANG').reduce((sum, s) => sum + Number(s.qty), 0);
    const prodPemalangAll = (stokData || []).filter(s => s.type === 'PRODUKSI_PEMALANG').reduce((sum, s) => sum + Number(s.qty), 0);
    const sisaAyamCabang = mutasiAyamPemalang - (prodPemalangAll * MASTER_AYAM_KG);

    const terjualPcsAll = (orders || []).filter(o => o.category === 'Pemalang').reduce((sum, o) => sum + Number(o.qty), 0);
    const omsetTotal = (orders || []).filter(o => o.category === 'Pemalang').reduce((sum, o) => sum + Number(o.totalAll || o.total), 0);
    const sisaStokFreezer = (prodPemalangAll * MASTER_PCS) - terjualPcsAll;

    const prodHariIni = (stokData || []).filter(s => s.type === 'PRODUKSI_PEMALANG' && getLocalYMD(s.date) === filterDate).reduce((sum, s) => sum + Number(s.qty), 0);
    const terjualHariIniPcs = (orders || []).filter(o => o.category === 'Pemalang' && getLocalYMD(o.date) === filterDate).reduce((sum, o) => sum + Number(o.qty), 0);
    
    // Konversi Pcs ke Mika & Porsi
    const porsiHariIni = terjualHariIniPcs / 4; 
    const mikaHariIni = terjualHariIniPcs / PCS_PER_MIKA; 

    const laporanUrut = [...(pemalangReports || [])].sort((a,b) => new Date(b.date) - new Date(a.date));

    return { 
        sisaAyamCabang, sisaStokFreezer, omsetTotal, 
        prodHariIni, terjualHariIniPcs, mikaHariIni, porsiHariIni, laporanUrut 
    };
  }, [orders, pemalangReports, stokData, filterDate]);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
        <div>
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Store size={20}/> Live Dashboard: Cabang Pemalang</h3>
            <p className="text-xs text-slate-500">Monitoring real-time kapasitas bahan baku dan produksi cabang.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-lg border">
            <Filter size={16} className="text-slate-500"/>
            <span className="text-sm font-bold text-slate-600">Pantau Hari:</span>
            <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} className="p-1.5 text-sm border rounded bg-white" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-5 rounded-xl border shadow-sm ${stats.sisaAyamCabang <= 30 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
            <div className={`text-xs font-bold uppercase mb-1 ${stats.sisaAyamCabang <= 30 ? 'text-red-500' : 'text-slate-500'}`}>Sisa Ayam (Sistem)</div>
            <div className={`text-3xl font-black ${stats.sisaAyamCabang <= 30 ? 'text-red-700' : 'text-slate-800'}`}>{stats.sisaAyamCabang} <span className="text-sm">Kg</span></div>
            <div className="text-[11px] font-bold text-orange-600 mt-1">Setara {(stats.sisaAyamCabang / KG_PER_KANTONG).toFixed(1).replace('.0','')} Kantong</div>
        </div>
        <div className={`p-5 rounded-xl border shadow-sm ${stats.sisaStokFreezer <= 1000 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'}`}>
            <div className={`text-xs font-bold uppercase mb-1 ${stats.sisaStokFreezer <= 1000 ? 'text-orange-500' : 'text-slate-500'}`}>Sisa Freezer (Sistem)</div>
            <div className={`text-3xl font-black ${stats.sisaStokFreezer <= 1000 ? 'text-orange-700' : 'text-slate-800'}`}>{stats.sisaStokFreezer} <span className="text-sm">Pcs</span></div>
            <div className="text-[11px] font-bold text-orange-600 mt-1">Setara {(stats.sisaStokFreezer / PCS_PER_MIKA).toFixed(1).replace('.0','')} Mika ({stats.sisaStokFreezer / 4} Porsi)</div>
        </div>
        <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200 shadow-sm">
            <div className="text-xs font-bold text-emerald-600 uppercase mb-1">Aktivitas Hari Ini ({formatDate(filterDate)})</div>
            <div className="flex justify-between items-end mt-2">
                <div><div className="text-[10px] font-bold text-emerald-500">PRODUKSI</div><div className="text-xl font-black text-emerald-700">{stats.prodHariIni} <span className="text-xs">Adukan</span></div></div>
                <div className="text-emerald-300">/</div>
                <div className="text-right"><div className="text-[10px] font-bold text-emerald-500">PESANAN MASUK</div><div className="text-xl font-black text-emerald-700">{stats.mikaHariIni} <span className="text-xs">Mika</span></div></div>
            </div>
        </div>
        <div className="bg-blue-50 p-5 rounded-xl border border-blue-200 shadow-sm">
            <div className="text-xs font-bold text-blue-500 uppercase mb-1">Total Omset Cabang</div>
            <div className="text-2xl font-black text-blue-700 mt-2">{formatRp(stats.omsetTotal)}</div>
            <div className="text-[10px] text-blue-400 mt-1">Akumulasi All Time Penjualan</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="font-bold text-sm mb-4 flex items-center gap-2"><AlertCircle size={16} className="text-slate-500"/> Pengecekan Silang: Fisik Cabang vs Sistem Pusat</h4>
          <table className="w-full text-sm text-left block md:table mt-2">
            <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase border-y">
                <tr><th className="px-4 py-2">Tgl Lapor</th><th className="px-4 py-2 text-center">Klaim Produksi (Mika)</th><th className="px-4 py-2 text-center">Klaim Order (Mika)</th><th className="px-4 py-2">Klaim Dimsum (Fisik)</th><th className="px-4 py-2">Klaim Ayam (Fisik)</th><th className="px-4 py-2 text-right">Uang Disetor (Rp)</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.laporanUrut.length === 0 ? <tr><td colSpan="6" className="text-center py-6 text-slate-400">Belum ada riwayat EOD cabang.</td></tr> : stats.laporanUrut.map((rep, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-700">{formatDate(rep.date)}</td>
                  <td className="px-4 py-3 text-center font-medium">{rep.produksiMika} M</td>
                  <td className="px-4 py-3 text-center font-medium">{rep.pesananMika} M</td>
                  <td className="px-4 py-3 font-bold uppercase text-indigo-700">{rep.stokFreezer || '-'}</td>
                  <td className="px-4 py-3 font-bold uppercase text-orange-700">{rep.stokAyam || '-'}</td>
                  <td className="px-4 py-3 text-right font-black text-emerald-600">{formatRp(rep.nominal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
    </div>
  );
}
