import React, { useState, useMemo } from 'react';
import { Calendar, Printer, Wallet, Coins, CreditCard, ArrowRightLeft, Users, ShoppingCart, AlertCircle, Clock, Factory, Store } from 'lucide-react';
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

  // KALKULASI DATA CABANG PEMALANG (MIRRORING LOGIC PUSAT)
  const rekap = useMemo(() => {
    const isPeriod = (d) => getLocalYMD(d) >= dateFrom && getLocalYMD(d) <= dateTo;
    
    // --- 1. DATA KEUANGAN & TRANSAKSI ---
    const branchOrdersAll = (orders || []).filter(o => o?.category === 'Pemalang');
    const branchOrdersPeriod = branchOrdersAll.filter(o => isPeriod(o?.date));
    const branchReportsPeriod = (pemalangReports || []).filter(r => isPeriod(r?.date));
    
    const totalPenjualanKotor = branchOrdersPeriod.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const totalPcs = branchOrdersPeriod.reduce((sum, o) => sum + (Number(o.qty) || 0), 0);
    const setoranKePusat = branchReportsPeriod.reduce((sum, r) => sum + (Number(r.nominal) || 0), 0);
    
    // Piutang Berjalan (HANYA YANG SUDAH DIAMBIL)
    const piutangBerjalan = branchOrdersAll.map(o => {
        const cicilan = (piutangPayments || []).filter(p => p.orderId === o.id).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        return { ...o, sisaTagihan: (Number(o.total) || 0) - (Number(o.paidAmount) || 0) - cicilan, statusProduksi: o.statusProduksi || 'Menunggu Produksi' };
    }).filter(o => o.sisaTagihan > 0 && o.statusProduksi === 'Sudah Diambil');
    const totalPiutangBaru = piutangBerjalan.reduce((sum, o) => sum + o.sisaTagihan, 0);

    const customerMap = {};
    let totalTerbayarPeriode = 0;
    
    const listOrders = branchOrdersPeriod.map(o => {
        const cicilan = (piutangPayments || []).filter(p => p.orderId === o.id).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const terbayar = (Number(o.paidAmount) || 0) + cicilan;
        const sisa = (Number(o.total) || 0) - terbayar;
        
        totalTerbayarPeriode += terbayar;

        const cName = String(o.customer || '').toUpperCase();
        if(!customerMap[cName]) customerMap[cName] = { name: cName, qty: 0, porsi: 0, total: 0, frequency: 0 };
        customerMap[cName].qty += Number(o.qty);
        customerMap[cName].porsi += (Number(o.qty) / 4);
        customerMap[cName].total += Number(o.total);
        customerMap[cName].frequency += 1;

        return { ...o, items: [`${o.qty} Pcs`], totalTagihan: o.total, totalTerbayar: terbayar, sisaTagihan: sisa, status: sisa <= 0 ? 'LUNAS' : 'BELUM LUNAS' };
    });

    const topCustomersList = Object.values(customerMap).sort((a,b) => b.total - a.total);

    // --- 2. DATA OPERASIONAL ---
    const mutasiAyamAll = (stokData || []).filter(s => s.type === 'MUTASI_AYAM_PEMALANG').reduce((sum, s) => sum + Number(s.qty), 0);
    const prodPemalangAll = (stokData || []).filter(s => s.type === 'PRODUKSI_PEMALANG').reduce((sum, s) => sum + Number(s.qty), 0);
    const sisaAyam = mutasiAyamAll - (prodPemalangAll * MASTER_AYAM_KG);
    
    const terjualPcsAll = branchOrdersAll.reduce((sum, o) => sum + Number(o.qty), 0);
    const sisaFreezer = (prodPemalangAll * MASTER_PCS) - terjualPcsAll;

    const adukanHariIni = (stokData || []).filter(s => s.type === 'PRODUKSI_PEMALANG' && isPeriod(s.date)).reduce((sum, s) => sum + Number(s.qty), 0);
    
    const ops = {
        sisaAyam, sisaAyamKtg: sisaAyam / KG_PER_KANTONG,
        sisaFreezer,
        adukanHariIni, 
        ayamTerpakaiHariIni: adukanHariIni * MASTER_AYAM_KG, 
        dimsumMasukHariIni: adukanHariIni * MASTER_PCS
    };

    return {
        totalPenjualanKotor, totalPcs, setoranKePusat, totalPiutangBaru, totalTerbayarPeriode,
        listOrders,
        listPiutangBerjalan: piutangBerjalan,
        listReports: branchReportsPeriod,
        topCustomersList,
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

      {/* DASHBOARD OPERASIONAL (GAYA PUSAT) */}
      <div className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800 relative">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-emerald-400 to-amber-500"></div>
          <div className="p-5 border-b border-slate-800/60 flex justify-between items-center bg-slate-900/50">
              <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2 tracking-wide"><Factory className="text-blue-400"/> KONTROL OPERASIONAL & PRODUKSI CABANG</h2>
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

      {/* DASHBOARD KEUANGAN KAS (GAYA PUSAT) */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
              <div>
                  <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2"><Wallet size={20}/> Status Finansial & Target Cabang</h2>
                  <p className="text-xs text-slate-500">*Dihitung untuk periode {formatDate(dateFrom)} s/d {formatDate(dateTo)}.</p>
              </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard title="Total Omset Penjualan" amount={formatRp(rekap.totalPenjualanKotor)} icon={<Wallet />} color="bg-blue-50 text-blue-700 border-blue-200" />
              <StatCard title="Total Disetor (EOD)" amount={formatRp(rekap.setoranKePusat)} icon={<Coins />} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
              <StatCard title="Total Piutang Gantung (Barang Keluar)" amount={formatRp(rekap.totalPiutangBaru)} icon={<CreditCard />} color="bg-orange-50 text-orange-700 border-orange-200" />
          </div>
      </div>

      {/* TABEL 1: LAPORAN HARIAN (EOD) */}
      <div className="bg-white p-6 rounded-xl border border-indigo-200 shadow-sm flex flex-col mt-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-indigo-700"><Store size={20}/> Rekap Laporan Harian (End of Day)</h3>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-indigo-50 border-b border-indigo-100">
                      <tr><th className="px-3 py-2 text-indigo-800">Tanggal Lapor</th><th className="px-3 py-2 text-center text-indigo-800">Klaim Produksi / Order</th><th className="px-3 py-2 text-indigo-800">Sisa Fisik Freezer</th><th className="px-3 py-2 text-indigo-800">Sisa Fisik Ayam</th><th className="px-3 py-2 text-right text-indigo-800">Disetor (Rp)</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {(!rekap.listReports || rekap.listReports.length === 0) ? (
                          <tr><td colSpan="5" className="text-center py-6 text-slate-400">Tidak ada laporan EOD di periode ini.</td></tr>
                      ) : (
                          rekap.listReports.map((r, i) => (
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

      {/* TABEL 2: TRANSAKSI PENJUALAN */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col mt-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800"><ShoppingCart size={20}/> Transaksi Penjualan / Invoice Cabang</h3>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                      <tr><th className="px-3 py-2 text-slate-800">Tgl & Ref</th><th className="px-3 py-2 text-slate-800">Pelanggan</th><th className="px-3 py-2 text-center text-slate-800">Qty</th><th className="px-3 py-2 text-center text-slate-800">Via</th><th className="px-3 py-2 text-right text-slate-800">Tagihan</th><th className="px-3 py-2 text-right text-slate-800">Sisa</th><th className="px-3 py-2 text-center text-slate-800">Status Bayar</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {(!rekap.listOrders || rekap.listOrders.length === 0) ? (
                          <tr><td colSpan="7" className="text-center py-6 text-slate-400">Tidak ada data penjualan cabang di periode ini.</td></tr>
                      ) : (
                          rekap.listOrders.map((o, i) => {
                              const sisaHutang = Number(o.sisaTagihan) || 0;
                              const totalTerbayar = Number(o.totalTerbayar) || 0;
                              let statusBayarUI = null;
                              if (sisaHutang <= 0) statusBayarUI = <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold">LUNAS</span>;
                              else if (totalTerbayar === 0 && o.statusProduksi !== 'Sudah Diambil') statusBayarUI = <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold border">BELUM BAYAR</span>;
                              else if (totalTerbayar > 0 && o.statusProduksi !== 'Sudah Diambil') statusBayarUI = <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold">DP</span>;
                              else statusBayarUI = <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold border border-red-200">PIUTANG</span>;
                              
                              return (
                              <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-3 py-2"><div className="font-bold text-slate-700">{formatDate(o?.date)}</div><div className="text-[10px] text-slate-400 font-mono">{o?.id || '-'}</div></td>
                                  <td className="px-3 py-2 font-bold uppercase text-xs">{o?.customer || '-'}</td>
                                  <td className="px-3 py-2 text-center text-xs font-bold text-slate-600">{o?.qty} Pcs</td>
                                  <td className="px-3 py-2 text-center text-[10px] font-medium text-slate-600">{o?.paymentMethod || '-'}</td>
                                  <td className="px-3 py-2 text-right font-bold text-slate-700">{formatRp(o?.totalTagihan)}</td>
                                  <td className="px-3 py-2 text-right font-black text-red-600">{formatRp(sisaHutang)}</td>
                                  <td className="px-3 py-2 text-center">{statusBayarUI}</td>
                              </tr>
                          )})
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {/* TABEL 3: PIUTANG BERJALAN (SAH DIAMBIL TAPI BELUM LUNAS) */}
      {rekap.listPiutangBerjalan.length > 0 && (
          <div className="bg-white p-6 rounded-xl border border-orange-200 shadow-sm flex flex-col mt-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-orange-700"><AlertCircle size={20}/> Daftar Piutang Berjalan (Sah)</h3>
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-orange-50 border-b border-orange-100">
                          <tr><th className="px-3 py-2 text-orange-800">Tgl & Inv</th><th className="px-3 py-2 text-orange-800">Pelanggan</th><th className="px-3 py-2 text-right text-orange-800">Sisa Tagihan</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {rekap.listPiutangBerjalan.map((p, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-3 py-2"><div className="font-bold text-slate-700">{formatDate(p.date)}</div><div className="text-[10px] text-slate-400 font-mono">{p.id}</div></td>
                                  <td className="px-3 py-2 font-bold uppercase text-xs">{p.customer}</td>
                                  <td className="px-3 py-2 text-right font-black text-red-600">{formatRp(p.sisaHutang)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* GRID BAWAH: ARUS TRANSAKSI & PELANGGAN TERATAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
            <h3 className="font-bold text-lg mb-1 flex items-center gap-2 text-blue-800"><ArrowRightLeft size={20}/> Arus Transaksi Cabang</h3>
            <p className="text-xs text-slate-500 mb-4 border-b pb-2">Khusus periode {formatDate(dateFrom)} - {formatDate(dateTo)}</p>
            <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="bg-emerald-50 p-3 rounded border border-emerald-100"><div className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Total Omset Cabang</div><div className="text-lg font-black text-emerald-600">+{formatRp(rekap.totalPenjualanKotor)}</div></div>
                <div className="bg-blue-50 p-3 rounded border border-blue-100"><div className="text-[10px] font-bold text-blue-700 uppercase mb-1">Total Terbayar (Cash/TF)</div><div className="text-lg font-black text-blue-600">+{formatRp(rekap.totalTerbayarPeriode)}</div></div>
                <div className="bg-orange-50 p-3 rounded border border-orange-100"><div className="text-[10px] font-bold text-orange-700 uppercase mb-1">Piutang / DP Berjalan</div><div className="text-lg font-black text-orange-600">{formatRp((rekap.totalPenjualanKotor) - (rekap.totalTerbayarPeriode))}</div></div>
                <div className="bg-indigo-50 p-3 rounded border border-indigo-100"><div className="text-[10px] font-bold text-indigo-700 uppercase mb-1">Setoran EOD (Ke Pusat)</div><div className="text-lg font-black text-indigo-600">{formatRp(rekap.setoranKePusat)}</div></div>
            </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col max-h-[340px]">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Users size={20} className="text-slate-500"/> Pelanggan Teratas Cabang</h3>
            <div className="overflow-y-auto pr-2 flex-1 space-y-3">
               {(!rekap.topCustomersList || rekap.topCustomersList.length === 0) ? (
                   <div className="text-center text-slate-400 text-sm mt-8">Tidak ada data penjualan cabang.</div>
               ) : (
                   rekap.topCustomersList.map((cust, i) => (
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
