import React, { useState, useMemo } from 'react';
import { Calendar, Printer, Wallet, Coins, CreditCard, ShoppingCart, Factory } from 'lucide-react';
import { getTodayStr, getLocalYMD, formatRp, formatDate } from '../../utils/helpers';

const StatCard = ({ title, amount, icon, color }) => (
  <div className={`p-5 rounded-xl border flex flex-col justify-between ${color}`}>
    <div className="flex justify-between items-start mb-4"><h3 className="font-medium text-sm opacity-90">{title}</h3><div className="p-2 bg-white/60 rounded-lg shadow-sm">{icon}</div></div>
    <div className="text-2xl font-bold tracking-tight">{amount}</div>
  </div>
);

export default function TabDashboardBranch({ orders, pemalangReports, piutangPayments, setPrintData, stokData }) {
  const todayStr = getTodayStr();
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);

  const MASTER_AYAM_KG = 30; 
  const MASTER_PCS = 1000; 
  const KG_PER_KANTONG = 10;
  const PCS_PER_MIKA = 50;

  // KALKULASI DATA CABANG PEMALANG
  const rekap = useMemo(() => {
    const isPeriod = (d) => getLocalYMD(d) >= dateFrom && getLocalYMD(d) <= dateTo;
    
    // --- 1. DATA KEUANGAN ---
    const branchOrdersAll = (orders || []).filter(o => o?.category === 'Pemalang');
    const branchOrdersPeriod = branchOrdersAll.filter(o => isPeriod(o?.date));
    
    const totalPenjualanKotor = branchOrdersPeriod.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const totalPcs = branchOrdersPeriod.reduce((sum, o) => sum + (Number(o.qty) || 0), 0);
    
    const setoranKePusat = (pemalangReports || []).filter(r => isPeriod(r?.date)).reduce((sum, r) => sum + (Number(r.nominal) || 0), 0);
    
    // Piutang = Total Tagihan - Paid - Cicilan (Semua waktu, bukan hanya periode)
    const piutangBerjalan = branchOrdersAll.map(o => {
        const cicilan = (piutangPayments || []).filter(p => p.orderId === o.id).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        return { ...o, sisaTagihan: (Number(o.total) || 0) - (Number(o.paidAmount) || 0) - cicilan };
    }).filter(o => o.sisaTagihan > 0);
    const totalPiutangBaru = piutangBerjalan.reduce((sum, o) => sum + o.sisaTagihan, 0);

    // --- 2. DATA OPERASIONAL (ALL TIME UNTUK SISA, PERIODE UNTUK HARI INI) ---
    const mutasiAyamAll = (stokData || []).filter(s => s.type === 'MUTASI_AYAM_PEMALANG').reduce((sum, s) => sum + Number(s.qty), 0);
    const prodPemalangAll = (stokData || []).filter(s => s.type === 'PRODUKSI_PEMALANG').reduce((sum, s) => sum + Number(s.qty), 0);
    
    const sisaAyam = mutasiAyamAll - (prodPemalangAll * MASTER_AYAM_KG);
    
    const terjualPcsAll = branchOrdersAll.reduce((sum, o) => sum + Number(o.qty), 0);
    const sisaFreezer = (prodPemalangAll * MASTER_PCS) - terjualPcsAll;

    const adukanHariIni = (stokData || []).filter(s => s.type === 'PRODUKSI_PEMALANG' && isPeriod(s.date)).reduce((sum, s) => sum + Number(s.qty), 0);
    const dimsumMasukHariIni = adukanHariIni * MASTER_PCS;
    const ayamTerpakaiHariIni = adukanHariIni * MASTER_AYAM_KG;

    const ops = {
        sisaAyam, sisaAyamKtg: sisaAyam / KG_PER_KANTONG,
        sisaFreezer,
        adukanHariIni, ayamTerpakaiHariIni, dimsumMasukHariIni
    };

    return {
        totalPenjualanKotor, totalPcs, setoranKePusat, totalPiutangBaru,
        listOrders: branchOrdersPeriod.map(o => {
            const cicilan = (piutangPayments || []).filter(p => p.orderId === o.id).reduce((s, p) => s + (Number(p.amount) || 0), 0);
            const terbayar = (Number(o.paidAmount) || 0) + cicilan;
            const sisa = (Number(o.total) || 0) - terbayar;
            return { ...o, items: [`${o.qty} Pcs`], totalTagihan: o.total, totalTerbayar: terbayar, sisaTagihan: sisa, status: sisa <= 0 ? 'LUNAS' : 'BELUM LUNAS' };
        }),
        listPiutangBerjalan: piutangBerjalan,
        listStokPusat: (stokData || []).filter(s => s.type === 'PRODUKSI_PEMALANG' && isPeriod(s.date)), 
        ops
    };
  }, [orders, pemalangReports, piutangPayments, stokData, dateFrom, dateTo]);

  const ops = rekap.ops;

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      {/* FILTER & CETAK */}
      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div><h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Calendar size={16}/> Filter Laporan & Cetak</h3><div className="flex gap-2"><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-2 text-sm border rounded-lg" /><span className="text-slate-400 self-center">s/d</span><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-2 text-sm border rounded-lg" /></div></div>
          <button onClick={() => setPrintData({ type: 'reportBranch', data: { rekap, dateFrom, dateTo } })} className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg flex gap-2 text-sm font-medium"><Printer size={16} /> Cetak Rekap Cabang</button>
      </div>

      {/* DASHBOARD OPERASIONAL CABANG (DESAIN PREMIUM DARK MODE) */}
      <div className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800 relative">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-emerald-400 to-amber-500"></div>
          
          <div className="p-5 border-b border-slate-800/60 flex justify-between items-center bg-slate-900/50">
              <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2 tracking-wide"><Factory className="text-blue-400"/> KONTROL OPERASIONAL & PRODUKSI (PEMALANG)</h2>
                  <p className="text-[11px] text-slate-400 mt-1">Monitoring real-time aktivitas dapur dan kapasitas gudang cabang.</p>
              </div>
              <div className="text-right hidden sm:block">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status Data</div>
                  <div className="text-xs font-bold text-emerald-400 flex items-center justify-end gap-1.5 mt-0.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span> LIVE REALTIME</div>
              </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-800/60 bg-slate-800/30">
              <div className="p-6 flex flex-col justify-center items-center text-center hover:bg-slate-800/50 transition">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Adukan Hari Ini</div>
                  <div className="text-3xl font-black text-white drop-shadow-md">{ops.adukanHariIni || 0} <span className="text-xs text-blue-400">Adk</span></div>
              </div>
              
              <div className="p-6 flex flex-col justify-center items-center text-center hover:bg-slate-800/50 transition">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Ayam Terpakai</div>
                  <div className="text-3xl font-black text-white drop-shadow-md">-{ops.ayamTerpakaiHariIni || 0} <span className="text-xs text-orange-400">Kg</span></div>
              </div>
              
              <div className="p-6 flex flex-col justify-center items-center text-center hover:bg-slate-800/50 transition relative overflow-hidden bg-slate-800/20">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Sisa Ayam (Live)</div>
                  <div className="text-3xl font-black text-white drop-shadow-md">{ops.sisaAyam || 0} <span className="text-xs text-emerald-400">Kg</span></div>
                  <div className="text-[10px] font-bold text-emerald-400 mt-2 px-3 py-1 bg-emerald-950/80 rounded-full border border-emerald-800/50">{(ops.sisaAyamKtg || 0).toFixed(1).replace('.0','')} Kantong</div>
              </div>
              
              <div className="p-6 flex flex-col justify-center items-center text-center hover:bg-slate-800/50 transition">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Masuk Freezer</div>
                  <div className="text-3xl font-black text-white drop-shadow-md">+{ops.dimsumMasukHariIni || 0} <span className="text-xs text-blue-400">Pcs</span></div>
                  <div className="text-[10px] font-bold text-blue-400 mt-2 px-3 py-1 bg-blue-950/80 rounded-full border border-blue-800/50">{((ops.dimsumMasukHariIni || 0) / PCS_PER_MIKA).toFixed(1).replace('.0','')} Mika</div>
              </div>
              
              <div className="p-6 flex flex-col justify-center items-center text-center hover:bg-slate-800/50 transition relative overflow-hidden bg-slate-800/20">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Sisa Freezer (Live)</div>
                  <div className="text-3xl font-black text-white drop-shadow-md">{ops.sisaFreezer || 0} <span className="text-xs text-emerald-400">Pcs</span></div>
                  <div className="text-[10px] font-bold text-emerald-400 mt-2 px-3 py-1 bg-emerald-950/80 rounded-full border border-emerald-800/50">{((ops.sisaFreezer || 0) / PCS_PER_MIKA).toFixed(1).replace('.0','')} Mika</div>
              </div>
          </div>
      </div>

      {/* DASHBOARD KEUANGAN KAS */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
              <div>
                  <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2"><Wallet size={20}/> Status Finansial Cabang</h2>
                  <p className="text-xs text-slate-500">*Dihitung untuk periode {formatDate(dateFrom)} s/d {formatDate(dateTo)}.</p>
              </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard title="Total Omset Penjualan" amount={formatRp(rekap.totalPenjualanKotor)} icon={<Wallet />} color="bg-blue-50 text-blue-700 border-blue-200" />
              <StatCard title="Total Disetor ke Pusat" amount={formatRp(rekap.setoranKePusat)} icon={<Coins />} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
              <StatCard title="Piutang Cabang (Belum Lunas)" amount={formatRp(rekap.totalPiutangBaru)} icon={<CreditCard />} color="bg-orange-50 text-orange-700 border-orange-200" />
          </div>
      </div>

      {/* TRANSAKSI PENJUALAN */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col mt-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800"><ShoppingCart size={20}/> Riwayat Penjualan Cabang (Periode Ini)</h3>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                      <tr><th className="px-3 py-2 text-slate-800">Tgl & Ref</th><th className="px-3 py-2 text-slate-800">Pelanggan</th><th className="px-3 py-2 text-center text-slate-800">Qty</th><th className="px-3 py-2 text-center text-slate-800">Via</th><th className="px-3 py-2 text-right text-slate-800">Tagihan</th><th className="px-3 py-2 text-right text-slate-800">Sisa</th><th className="px-3 py-2 text-center text-slate-800">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {(!rekap.listOrders || rekap.listOrders.length === 0) ? (
                          <tr><td colSpan="7" className="text-center py-6 text-slate-400">Tidak ada data penjualan cabang di periode ini.</td></tr>
                      ) : (
                          rekap.listOrders.map((o, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-3 py-2"><div className="font-bold text-slate-700">{formatDate(o?.date)}</div><div className="text-[10px] text-slate-400 font-mono">{o?.id || '-'}</div></td>
                                  <td className="px-3 py-2 font-bold uppercase text-xs">{o?.customer || '-'}</td>
                                  <td className="px-3 py-2 text-center text-xs font-bold text-slate-600">{o?.qty} Pcs</td>
                                  <td className="px-3 py-2 text-center text-[10px] font-medium text-slate-600">{o?.paymentMethod || '-'}</td>
                                  <td className="px-3 py-2 text-right font-bold text-slate-700">{formatRp(o?.totalTagihan)}</td>
                                  <td className="px-3 py-2 text-right font-black text-red-600">{formatRp(o?.sisaTagihan)}</td>
                                  <td className="px-3 py-2 text-center"><span className={`px-2 py-1 rounded text-[10px] font-bold ${o?.status === 'LUNAS' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{o?.status}</span></td>
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
