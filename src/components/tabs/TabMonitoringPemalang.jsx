import React, { useState, useMemo } from 'react';
import { Calendar, Store, Factory, Wallet, Coins, AlertCircle, ShoppingCart, Users, CheckCircle } from 'lucide-react';
import { formatRp, formatDate, getLocalYMD, getTodayStr, safeSort } from '../../utils/helpers';

const StatCard = ({ title, amount, icon, color }) => (
  <div className={`p-5 rounded-xl border flex flex-col justify-between ${color}`}>
    <div className="flex justify-between items-start mb-4"><h3 className="font-medium text-sm opacity-90">{title}</h3><div className="p-2 bg-white/60 rounded-lg shadow-sm">{icon}</div></div>
    <div className="text-2xl font-bold tracking-tight">{amount}</div>
  </div>
);

export default function TabMonitoringPemalang({ orders, pemalangReports, stokData }) {
  const todayStr = getTodayStr();
  const [dateFrom, setDateFrom] = useState(todayStr); 
  const [dateTo, setDateTo] = useState(todayStr);
  
  const MASTER_AYAM_KG = 30; 
  const MASTER_PCS = 1000; 
  const KG_PER_KANTONG = 10;
  const PCS_PER_MIKA = 50;

  const stats = useMemo(() => {
    const isPeriod = (d) => getLocalYMD(d) >= dateFrom && getLocalYMD(d) <= dateTo;

    // --- 1. DATA AYAM CABANG PEMALANG (Semua Waktu) ---
    const mutasiAyamPemalang = (stokData || []).filter(s => s.type === 'MUTASI_AYAM_PEMALANG').reduce((sum, s) => sum + Number(s.qty), 0);
    const prodPemalangAll = (stokData || []).filter(s => s.type === 'PRODUKSI_PEMALANG').reduce((sum, s) => sum + Number(s.qty), 0);
    const sisaAyamCabang = mutasiAyamPemalang - (prodPemalangAll * MASTER_AYAM_KG);

    // --- 2. DATA DIMSUM CABANG PEMALANG (Semua Waktu) ---
    const branchOrdersAll = (orders || []).filter(o => o.category === 'Pemalang');
    const terjualPcsAll = branchOrdersAll.reduce((sum, o) => sum + Number(o.qty), 0);
    const totalOmsetAll = branchOrdersAll.reduce((sum, o) => sum + Number(o.totalAll || o.total), 0);
    const sisaStokFreezer = (prodPemalangAll * MASTER_PCS) - terjualPcsAll;

    // --- 3. AKTIVITAS PERIODE INI ---
    const branchOrdersPeriod = branchOrdersAll.filter(o => isPeriod(o.date));
    const branchReportsPeriod = (pemalangReports || []).filter(r => isPeriod(r.date));
    
    const prodPeriode = (stokData || []).filter(s => s.type === 'PRODUKSI_PEMALANG' && isPeriod(s.date)).reduce((sum, s) => sum + Number(s.qty), 0);
    
    const omsetPeriode = branchOrdersPeriod.reduce((sum, o) => sum + Number(o.totalAll || o.total), 0);
    const setoranPeriode = branchReportsPeriod.reduce((sum, r) => sum + Number(r.nominal), 0);

    // Leaderboard Pelanggan Teratas Cabang
    const customerMap = {};
    const listOrders = branchOrdersPeriod.map(o => {
        const cName = String(o.customer || '').toUpperCase();
        if(!customerMap[cName]) customerMap[cName] = { name: cName, qty: 0, porsi: 0, total: 0, frequency: 0 };
        customerMap[cName].qty += Number(o.qty);
        customerMap[cName].porsi += (Number(o.qty) / 4);
        customerMap[cName].total += Number(o.totalAll || o.total);
        customerMap[cName].frequency += 1;
        return o;
    }).sort(safeSort);
    const topCustomersList = Object.values(customerMap).sort((a,b) => b.total - a.total);

    const laporanUrut = [...branchReportsPeriod].sort((a,b) => new Date(b.date) - new Date(a.date));

    return { 
        sisaAyamCabang, sisaStokFreezer, totalOmsetAll, omsetPeriode, setoranPeriode,
        prodPeriode, 
        ayamTerpakaiPeriode: prodPeriode * MASTER_AYAM_KG,
        dimsumMasukPeriode: prodPeriode * MASTER_PCS,
        laporanUrut, listOrders, topCustomersList 
    };
  }, [orders, pemalangReports, stokData, dateFrom, dateTo]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* FILTER TANGGAL (GAYA PUSAT) */}
      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div><h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Calendar size={16}/> Filter Pemantauan Cabang</h3><div className="flex gap-2"><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-2 text-sm border rounded-lg bg-slate-50 hover:bg-white transition" /><span className="text-slate-400 self-center">s/d</span><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-2 text-sm border rounded-lg bg-slate-50 hover:bg-white transition" /></div></div>
          <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border border-emerald-200"><CheckCircle size={16}/> Mode Audit Aktif</div>
      </div>

      {/* DASHBOARD OPERASIONAL CABANG (DARK MODE PANEL) */}
      <div className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800 relative">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-emerald-400 to-amber-500"></div>
          
          <div className="p-5 border-b border-slate-800/60 flex justify-between items-center bg-slate-900/50">
              <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2 tracking-wide"><Factory className="text-blue-400"/> PANTAUAN LIVE OPERASIONAL (PEMALANG)</h2>
                  <p className="text-[11px] text-slate-400 mt-1">Monitoring real-time aktivitas mesin pabrik cabang dari layar Pusat Anda.</p>
              </div>
              <div className="text-right hidden sm:block">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status Sinkronisasi</div>
                  <div className="text-xs font-bold text-emerald-400 flex items-center justify-end gap-1.5 mt-0.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span> LIVE DATA TERSAMBUNG</div>
              </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-800/60 bg-slate-800/30">
              <div className="p-6 flex flex-col justify-center items-center text-center hover:bg-slate-800/50 transition">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Adukan Cabang</div>
                  <div className="text-3xl font-black text-white drop-shadow-md">{stats.prodPeriode} <span className="text-xs text-blue-400">Adk</span></div>
              </div>
              <div className="p-6 flex flex-col justify-center items-center text-center hover:bg-slate-800/50 transition">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Ayam Terpakai</div>
                  <div className="text-3xl font-black text-white drop-shadow-md">-{stats.ayamTerpakaiPeriode} <span className="text-xs text-orange-400">Kg</span></div>
              </div>
              <div className="p-6 flex flex-col justify-center items-center text-center hover:bg-slate-800/50 transition relative overflow-hidden bg-slate-800/20">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Sisa Ayam (Live)</div>
                  <div className="text-3xl font-black text-white drop-shadow-md">{stats.sisaAyamCabang} <span className="text-xs text-emerald-400">Kg</span></div>
                  <div className="text-[10px] font-bold text-emerald-400 mt-2 px-3 py-1 bg-emerald-950/80 rounded-full border border-emerald-800/50">{(stats.sisaAyamCabang / KG_PER_KANTONG).toFixed(1).replace('.0','')} Kantong</div>
              </div>
              <div className="p-6 flex flex-col justify-center items-center text-center hover:bg-slate-800/50 transition">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Masuk Freezer</div>
                  <div className="text-3xl font-black text-white drop-shadow-md">+{stats.dimsumMasukPeriode} <span className="text-xs text-blue-400">Pcs</span></div>
                  <div className="text-[10px] font-bold text-blue-400 mt-2 px-3 py-1 bg-blue-950/80 rounded-full border border-blue-800/50">{(stats.dimsumMasukPeriode / PCS_PER_MIKA).toFixed(1).replace('.0','')} Mika</div>
              </div>
              <div className="p-6 flex flex-col justify-center items-center text-center hover:bg-slate-800/50 transition relative overflow-hidden bg-slate-800/20">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Sisa Freezer (Live)</div>
                  <div className="text-3xl font-black text-white drop-shadow-md">{stats.sisaStokFreezer} <span className="text-xs text-emerald-400">Pcs</span></div>
                  <div className="text-[10px] font-bold text-emerald-400 mt-2 px-3 py-1 bg-emerald-950/80 rounded-full border border-emerald-800/50">{(stats.sisaStokFreezer / PCS_PER_MIKA).toFixed(1).replace('.0','')} Mika</div>
              </div>
          </div>
      </div>

      {/* DASHBOARD KEUANGAN KAS (CABANG) */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
              <div>
                  <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2"><Wallet size={20}/> Performa Finansial Cabang</h2>
                  <p className="text-xs text-slate-500">*Dihitung untuk periode {formatDate(dateFrom)} s/d {formatDate(dateTo)}.</p>
              </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard title="Total Omset Cabang (All Time)" amount={formatRp(stats.totalOmsetAll)} icon={<Store />} color="bg-blue-50 text-blue-700 border-blue-200" />
              <StatCard title="Omset Cabang (Periode Ini)" amount={formatRp(stats.omsetPeriode)} icon={<Wallet />} color="bg-indigo-50 text-indigo-700 border-indigo-200" />
              <StatCard title="Total Disetor Cabang (EOD)" amount={formatRp(stats.setoranPeriode)} icon={<Coins />} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
          </div>
      </div>

      {/* TABEL AUDIT 1: Pengecekan Silang Fisik vs Sistem */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col mt-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800"><AlertCircle size={20} className="text-orange-500"/> Audit Pengecekan Silang (Laporan Cabang)</h3>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                      <tr><th className="px-3 py-2 text-slate-700">Tgl Lapor</th><th className="px-3 py-2 text-center text-slate-700">Klaim Produksi / Order</th><th className="px-3 py-2 text-slate-700">Klaim Sisa Freezer</th><th className="px-3 py-2 text-slate-700">Klaim Sisa Ayam</th><th className="px-3 py-2 text-right text-slate-700">Uang Disetor (Ke Pusat)</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {(!stats.laporanUrut || stats.laporanUrut.length === 0) ? (
                          <tr><td colSpan="5" className="text-center py-6 text-slate-400">Tidak ada laporan EOD dari cabang di periode ini.</td></tr>
                      ) : (
                          stats.laporanUrut.map((r, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-3 py-2"><div className="font-bold text-slate-700">{formatDate(r.date)}</div></td>
                                  <td className="px-3 py-2 text-center font-bold text-slate-600">{r.produksiMika} M / {r.pesananMika} M</td>
                                  <td className="px-3 py-2 font-bold uppercase text-indigo-700">{r.stokFreezer}</td>
                                  <td className="px-3 py-2 font-bold uppercase text-orange-700">{r.stokAyam || '-'}</td>
                                  <td className="px-3 py-2 text-right font-black text-emerald-600">{formatRp(r.nominal)}</td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* TABEL 2: Riwayat Penjualan Invoice */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800"><ShoppingCart size={20}/> Aktivitas Invoice Cabang</h3>
            <div className="overflow-x-auto max-h-[300px]">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                        <tr><th className="px-3 py-2 text-slate-800">Tgl & Ref</th><th className="px-3 py-2 text-slate-800">Pelanggan</th><th className="px-3 py-2 text-center text-slate-800">Qty</th><th className="px-3 py-2 text-right text-slate-800">Tagihan</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {(!stats.listOrders || stats.listOrders.length === 0) ? (
                            <tr><td colSpan="4" className="text-center py-6 text-slate-400">Tidak ada transaksi penjualan di periode ini.</td></tr>
                        ) : (
                            stats.listOrders.map((o, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                    <td className="px-3 py-2"><div className="font-bold text-slate-700">{formatDate(o?.date)}</div><div className="text-[10px] text-slate-400 font-mono">{o?.id || '-'}</div></td>
                                    <td className="px-3 py-2 font-bold uppercase text-xs">{o?.customer || '-'}</td>
                                    <td className="px-3 py-2 text-center text-xs font-bold text-slate-600">{o?.qty} Pcs</td>
                                    <td className="px-3 py-2 text-right font-bold text-emerald-600">{formatRp(o?.totalAll || o?.total)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* TABEL 3: Pelanggan Teratas */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col max-h-[400px]">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Users size={20} className="text-slate-500"/> Pelanggan Teratas Cabang</h3>
            <div className="overflow-y-auto pr-2 flex-1 space-y-3">
               {(!stats.topCustomersList || stats.topCustomersList.length === 0) ? (
                   <div className="text-center text-slate-400 text-sm mt-8">Belum ada pelanggan tercatat.</div>
               ) : (
                   stats.topCustomersList.map((cust, i) => (
                       <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-200 transition">
                           <div className="flex items-center gap-3">
                               <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-orange-300 text-white' : 'bg-white text-slate-400'}`}>#{i+1}</div>
                               <div><div className="font-bold text-slate-800">{cust.name}</div><div className="text-xs text-slate-500">{cust.frequency}x Order • {cust.qty} Pcs ({cust.porsi} Prs)</div></div>
                           </div>
                           <div className="font-bold text-emerald-600">{formatRp(cust.total)}</div>
                       </div>
                   ))
               )}
            </div>
        </div>
      </div>
    </div>
  );
}
