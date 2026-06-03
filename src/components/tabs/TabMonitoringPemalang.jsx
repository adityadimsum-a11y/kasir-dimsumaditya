import React, { useMemo } from 'react';
import { Store, Package, ShoppingCart, TrendingUp, AlertCircle } from 'lucide-react';
import { formatRp, formatDate, safeSort } from '../../utils/helpers';

export default function TabMonitoringPemalang({ orders, pemalangReports, stokData }) {
  
  // LOGIC KALKULASI REAL-TIME CABANG PEMALANG
  const stats = useMemo(() => {
    // 1. Total Mutasi Masuk dari Pusat
    const mutasiMasuk = (stokData || []).filter(s => s.type === 'MUTASI_PEMALANG').reduce((sum, s) => sum + Number(s.qty), 0);
    
    // 2. Total Terjual (Dari Invoice Pemalang)
    const terjualPcs = (orders || []).filter(o => o.category === 'Pemalang').reduce((sum, o) => sum + Number(o.qty), 0);
    const omsetTotal = (orders || []).filter(o => o.category === 'Pemalang').reduce((sum, o) => sum + Number(o.total), 0);
    
    // 3. Sisa Stok Aktual (Sistem)
    const sisaStokSistem = mutasiMasuk - terjualPcs;
    
    // 4. Laporan Terakhir Cabang
    const laporanUrut = [...(pemalangReports || [])].sort((a,b) => new Date(b.date) - new Date(a.date));
    const laporanTerakhir = laporanUrut.length > 0 ? laporanUrut[0] : null;

    return { mutasiMasuk, terjualPcs, omsetTotal, sisaStokSistem, laporanTerakhir, laporanUrut };
  }, [orders, pemalangReports, stokData]);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Store size={20}/> Pusat Kontrol: Cabang Pemalang</h3>
            <p className="text-xs text-slate-500">Monitoring pergerakan stok dan penjualan cabang secara real-time.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm">
            <div className="text-xs font-bold text-blue-500 uppercase mb-1">Total Kiriman Pusat</div>
            <div className="text-2xl font-black text-blue-700">{stats.mutasiMasuk} <span className="text-sm">Pcs</span></div>
            <div className="text-[10px] text-slate-400 mt-1">Akumulasi Mutasi Stok</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm">
            <div className="text-xs font-bold text-emerald-500 uppercase mb-1">Total Terjual (Sistem)</div>
            <div className="text-2xl font-black text-emerald-700">{stats.terjualPcs} <span className="text-sm">Pcs</span></div>
            <div className="text-[10px] text-slate-400 mt-1">Setara {stats.terjualPcs / 4} Porsi</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-orange-200 shadow-sm relative overflow-hidden">
            <div className="text-xs font-bold text-orange-500 uppercase mb-1">Sisa Stok Realtime</div>
            <div className="text-3xl font-black text-orange-700">{stats.sisaStokSistem} <span className="text-sm">Pcs</span></div>
            <div className="text-[10px] text-slate-400 mt-1">Sisa Barang Ready Jual</div>
            <Package size={40} className="absolute -bottom-2 -right-2 text-orange-100" />
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-bold text-slate-500 uppercase mb-1">Total Omset (Akumulasi)</div>
            <div className="text-2xl font-black text-slate-700">{formatRp(stats.omsetTotal)}</div>
            <div className="text-[10px] text-slate-400 mt-1">Berdasarkan Invoice Cabang</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="font-bold text-sm mb-4 flex items-center gap-2"><AlertCircle size={16} className="text-blue-500"/> Pengecekan Silang (Audit Fisik vs Sistem)</h4>
          {stats.laporanTerakhir ? (
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border">
                  <div>
                      <div className="text-xs text-slate-500">Laporan Fisik Terakhir Cabang: <strong>{formatDate(stats.laporanTerakhir.date)}</strong></div>
                      <div className="text-lg font-bold">Stok Freezer Laporan: <span className="text-indigo-600">{stats.laporanTerakhir.stokFreezer}</span></div>
                  </div>
                  <div className="text-right">
                      <div className="text-xs text-slate-500">Estimasi Sistem Seharusnya:</div>
                      <div className="text-lg font-bold text-orange-600">{stats.sisaStokSistem} Pcs</div>
                  </div>
              </div>
          ) : (
              <div className="text-sm text-slate-400 italic">Belum ada laporan harian dari cabang.</div>
          )}
      </div>

      <div className="bg-white rounded-xl border mt-4 overflow-hidden">
        <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-sm">Riwayat Laporan Harian (End of Day)</h4></div>
        <table className="w-full text-sm text-left block md:table">
          <thead className="bg-white text-slate-600 text-xs uppercase border-b"><tr><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3 text-center">Produksi / Pesanan (Mika)</th><th className="px-4 py-3">Stok Laporan (Teks)</th><th className="px-4 py-3 text-right">Uang Disetor</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {stats.laporanUrut.length === 0 ? <tr><td colSpan="4" className="text-center py-8 text-slate-400">Belum ada riwayat.</td></tr> : stats.laporanUrut.map((rep, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-bold">{formatDate(rep.date)}</td>
                <td className="px-4 py-3 text-center">{rep.produksiMika} M / {rep.pesananMika} M</td>
                <td className="px-4 py-3 font-bold uppercase text-indigo-700">{rep.stokFreezer || '-'}</td>
                <td className="px-4 py-3 text-right font-black text-emerald-600">{formatRp(rep.nominal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
