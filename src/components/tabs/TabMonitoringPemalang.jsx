import React, { useState, useMemo } from 'react';
import { Calendar, Store, Factory, Wallet, Coins, AlertCircle, ShoppingCart, Users, CheckCircle, Percent } from 'lucide-react';
import { getTodayStr, formatDate, safeJsonParse } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

// --- KARTU STATISTIK FINANSIAL FLAT ENTERPRISE ---
const StatCard = ({ title, amount, icon, colorClass, textClass }) => (
  <div className={`p-6 rounded-3xl shadow-sm flex flex-col justify-between transition-transform hover:scale-[1.02] duration-300 border border-slate-100 ${colorClass}`}>
    <div className="flex justify-between items-start mb-4">
      <h3 className={`font-black text-[11px] uppercase tracking-wider opacity-80 leading-snug max-w-[120px] ${textClass}`}>{title}</h3>
      <div className={`p-3 bg-white rounded-2xl shadow-sm border border-slate-100 shrink-0 ${textClass}`}>{icon}</div>
    </div>
    <div className={`text-3xl font-black tracking-tighter mt-2 ${textClass}`}>{amount}</div>
  </div>
);

export default function TabMonitoringPemalang({ orders = [], orders_data, pemalangReports = [], purchases_data, purchases = [], stokData, user }) {
  const todayStr = getTodayStr();
  
  // 🔥 SIMPUL KENDALI PRODUKSI PEMALANG
  const currentBranch = 'PRODUKSI_PEMALANG';
  const [dateFrom, setDateFrom] = useState(todayStr); 
  const [dateTo, setDateTo] = useState(todayStr);
  
  // --- KONVERSI STANDAR MANIFEST CORE ---
  const MASTER_AYAM_KG = 30;  
  const MASTER_PCS = 1000;   
  const KG_PER_KANTONG = 10;
  const PCS_PER_MIKA = 50;

  // --- SINKRONISASI DATABASE ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);

  const stats = useMemo(() => {
    const isPeriod = (dateVal) => {
      if (!dateVal) return false;
      const cleanDate = dateVal.substring(0, 10);
      return cleanDate >= dateFrom && cleanDate <= dateTo;
    };

    // --- 1. DATA AYAM MENTAH PEMALANG ---
    let mutasiAyamPemalang = 0;
    realPurchases.filter(p => !p.isDeleted && p.category === 'BAHAN_BAKU' && String(p.branch_id).toLowerCase() === currentBranch.toLowerCase()).forEach(p => {
       mutasiAyamPemalang += Number(p.qty_kg || p.qty || 0);
    });

    const prodPemalangAll = (stokData || []).filter(s => !s.isDeleted && s.type === 'PRODUKSI_PEMALANG').reduce((sum, s) => sum + Number(s.qty || s.jumlah_adukan || 0), 0);
    const sisaAyamCabang = Math.max(0, mutasiAyamPemalang - (prodPemalangAll * MASTER_AYAM_KG));

    // --- 2. DATA STOK JADI FREEZER ---
    const branchOrdersAll = realOrders.filter(o => !o.isDeleted && String(o.branch_id).toLowerCase() === currentBranch.toLowerCase());
    
    let terjualPcsAll = 0;
    branchOrdersAll.forEach(o => {
       const items = safeJsonParse(o.items, []);
       let subPcs = 0;
       items.forEach(i => subPcs += Number(i.qty || 0));
       if (subPcs === 0) subPcs = Number(o.qty || 0);
       terjualPcsAll += subPcs;
    });

    const totalOmsetAll = branchOrdersAll.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const sisaStokFreezer = Math.max(0, (prodPemalangAll * MASTER_PCS) - terjualPcsAll);

    // --- 3. FILTER MONITOR BERDASARKAN PERIODE ---
    const branchOrdersPeriod = branchOrdersAll.filter(o => isPeriod(o.date));
    const branchReportsPeriod = (pemalangReports || []).filter(r => !r.isDeleted && isPeriod(r.date));
    
    const prodPeriode = (stokData || []).filter(s => !s.isDeleted && s.type === 'PRODUKSI_PEMALANG' && isPeriod(s.date)).reduce((sum, s) => sum + Number(s.qty || s.jumlah_adukan || 0), 0);
    
    const omsetPeriode = branchOrdersPeriod.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const setoranPeriode = branchReportsPeriod.reduce((sum, r) => sum + Number(r.nominal || r.amount || 0), 0);

    // 🔥 FIX SURVIVAL MODE: 4 AMPLOP PERCENTAGES (55, 25, 15, 5)
    const jatahAyam55 = omsetPeriode * 0.55;
    const jatahOps25 = omsetPeriode * 0.25;
    const jatahCadangan15 = omsetPeriode * 0.15;
    const jatahCuan5 = omsetPeriode * 0.05;

    const customerMap = {};
    branchOrdersPeriod.forEach(o => {
        const cName = String(o.customer_name || 'Umum / Cash').toUpperCase();
        if(!customerMap[cName]) customerMap[cName] = { name: cName, qty: 0, porsi: 0, total: 0, frequency: 0 };
        
        let subPcs = 0;
        const items = safeJsonParse(o.items, []);
        items.forEach(i => subPcs += Number(i.qty || 0));
        if (subPcs === 0) subPcs = Number(o.qty || 0);

        customerMap[cName].qty += subPcs;
        customerMap[cName].porsi += (subPcs / 4);
        customerMap[cName].total += Number(o.total_amount || 0);
        customerMap[cName].frequency += 1;
    });
    const topCustomersList = Object.values(customerMap).sort((a,b) => b.total - a.total).slice(0, 10);

    const laporanUrut = [...branchReportsPeriod].sort((a,b) => new Date(b.date) - new Date(a.date));

    return { 
        sisaAyamCabang, sisaStokFreezer, totalOmsetAll, omsetPeriode, setoranPeriode,
        prodPeriode, jatahAyam55, jatahOps25, jatahCadangan15, jatahCuan5,
        ayamTerpakaiPeriode: prodPeriode * MASTER_AYAM_KG,
        dimsumMasukPeriode: prodPeriode * MASTER_PCS,
        laporanUrut, branchOrdersPeriod, topCustomersList 
    };
  }, [realOrders, realPurchases, pemalangReports, stokData, dateFrom, dateTo]);

  return (
    <div className="space-y-6 pb-10 text-slate-700 animate-in fade-in duration-300">
      
      {/* FILTER CONTROL KALENDER */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2"><Calendar size={18} className="text-orange-600"/> Filter Rentang Pemantauan Cabang</h3>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl shadow-inner">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Dari</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-l border-slate-200 pl-3 ml-1">Sampai</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer" />
            </div>
          </div>
          <button className="bg-slate-900 text-white px-5 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md hover:bg-slate-800 transition-transform active:scale-95 cursor-pointer">
            <CheckCircle size={16}/> Mode Audit Sinkron HQ
          </button>
      </div>

      {/* MONITOR OPERASIONAL LIVE PANTAUAN PEMALANG */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative text-slate-700 border-t-4 border-t-red-600">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50">
              <div>
                  <h2 className="text-base font-black text-slate-800 flex items-center gap-2 tracking-wide uppercase"><Factory className="text-red-600"/> Pantauan Live Hasil Dapur Produksi</h2>
                  <p className="text-[11px] font-bold text-slate-400 normal-case mt-1">Monitoring otomatis pergerakan adonan dan isi freezer langsung dari server pusat</p>
              </div>
              <div className="text-right hidden sm:block">
                  <div className="text-xs font-black text-emerald-600 flex items-center justify-end gap-1.5 uppercase tracking-wider bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm animate-pulse"></span> Live Data Sinkron</div>
              </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-100 text-center bg-white">
              <div className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Adukan Cabang</div>
                  <div className="text-3xl font-black text-slate-800 tracking-tight">{stats.prodPeriode} <span className="text-sm text-amber-600 font-bold uppercase tracking-wider">Adk</span></div>
              </div>
              <div className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Daging Terpakai</div>
                  <div className="text-3xl font-black text-slate-800 tracking-tight">-{formatNumber(stats.ayamTerpakaiPeriode)} <span className="text-sm text-red-500 font-bold uppercase tracking-wider">Kg</span></div>
              </div>
              <div className="p-6 hover:bg-slate-50 transition-colors bg-red-50/20 relative">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Sisa Ayam Gudang</div>
                  <div className="text-3xl font-black text-red-600 tracking-tight">{formatNumber(stats.sisaAyamCabang)} <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">Kg</span></div>
                  <div className="text-[9px] font-black text-red-700 bg-red-100 px-2 py-1 rounded-md border border-red-200 mt-2 inline-block uppercase tracking-wider shadow-3xs">{formatNumber((stats.sisaAyamCabang / KG_PER_KANTONG).toFixed(0))} Kantong</div>
              </div>
              <div className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Masuk Freezer</div>
                  <div className="text-3xl font-black text-slate-800 tracking-tight">+{formatNumber(stats.dimsumMasukPeriode)} <span className="text-sm text-emerald-600 font-bold uppercase tracking-wider">Pcs</span></div>
                  <div className="text-[9px] font-black text-emerald-800 bg-emerald-100 px-2 py-1 rounded-md border border-emerald-200 mt-2 inline-block uppercase tracking-wider shadow-3xs">{formatNumber((stats.dimsumMasukPeriode / PCS_PER_MIKA).toFixed(0))} Mika</div>
              </div>
              <div className="p-6 hover:bg-slate-50 transition-colors bg-emerald-50/20">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Sisa Freezer (Live)</div>
                  <div className="text-3xl font-black text-emerald-600 tracking-tight">{formatNumber(stats.sisaStokFreezer)} <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">Pcs</span></div>
                  <div className="text-[9px] font-black text-emerald-800 bg-emerald-100 px-2 py-1 rounded-md border border-emerald-200 mt-2 inline-block uppercase tracking-wider shadow-3xs">{formatNumber((stats.sisaStokFreezer / PCS_PER_MIKA).toFixed(0))} Mika</div>
              </div>
          </div>
      </div>

      {/* DASHBOARD PERFORMA FINANSIAL PERIODE */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 lg:p-8">
          <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-base font-black text-slate-800 uppercase tracking-wide flex items-center gap-2"><Wallet size={20} className="text-blue-600"/> Analitik Keuangan Buku Cabang Pemalang</h2>
              <p className="text-[11px] font-bold text-slate-400 mt-1 normal-case">Laporan otomatis periode terpilih harian</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard title="Total Omset Cabang (All time)" amount={formatRupiah(stats.totalOmsetAll)} icon={<Store size={20}/>} colorClass="bg-slate-50" textClass="text-slate-800" />
              <StatCard title="Omset Cabang (Periode ini)" amount={formatRupiah(stats.omsetPeriode)} icon={<Wallet size={20}/>} colorClass="bg-blue-50/50 border-blue-100" textClass="text-blue-700" />
              <StatCard title="Total Setoran Kasir Masuk" amount={formatRupiah(stats.setoranPeriode)} icon={<Coins size={20}/>} colorClass="bg-emerald-50/50 border-emerald-100" textClass="text-emerald-700" />
          </div>
      </div>

      {/* 🔥 TARGET BRANKAS 4 AMPLOP BERJALAN PEMALANG */}
      {stats.omsetPeriode > 0 && (
         <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-l-8 border-l-amber-500">
           <h3 className="font-black text-sm text-slate-800 uppercase tracking-wide mb-5 flex items-center gap-2"><Percent size={18} className="text-amber-600"/> Proyeksi Kuota Jatah 4 Amplop (Dari Omset Periode Ini)</h3>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-5 text-center">
              <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 p-4 rounded-2xl shadow-sm border-t-4 border-t-blue-500"><div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">Amplop 1: Ayam (55%)</div><div className="text-xl font-black text-blue-700 mt-2">{formatRupiah(stats.jatahAyam55)}</div></div>
              <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 p-4 rounded-2xl shadow-sm border-t-4 border-t-emerald-500"><div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">Amplop 2: Ops &amp; Gaji (25%)</div><div className="text-xl font-black text-emerald-700 mt-2">{formatRupiah(stats.jatahOps25)}</div></div>
              <div className="bg-gradient-to-br from-orange-50 to-white border border-orange-100 p-4 rounded-2xl shadow-sm border-t-4 border-t-orange-500"><div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">Amplop 3: Cadangan (15%)</div><div className="text-xl font-black text-orange-700 mt-2">{formatRupiah(stats.jatahCadangan15)}</div></div>
              <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-100 p-4 rounded-2xl shadow-sm border-t-4 border-t-amber-500"><div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">Amplop 4: Profit (5%)</div><div className="text-xl font-black text-amber-700 mt-2">{formatRupiah(stats.jatahCuan5)}</div></div>
           </div>
         </div>
      )}

      {/* PENGECEKAN SILANG EOD LAPORAN */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
             <AlertCircle size={18} className="text-red-600"/>
             <h4 className="font-black text-slate-800 text-sm uppercase tracking-wide">Jurnal Pengecekan Silang Setoran (EOD Cabang)</h4>
          </div>
          <div className="overflow-x-auto p-2 custom-scrollbar">
              <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-5 py-4 font-black">Tanggal Lapor</th>
                        <th className="px-5 py-4 text-center font-black">Klaim Adukan Dapur</th>
                        <th className="px-5 py-4 font-black">Fisik Freezer Kulkas</th>
                        <th className="px-5 py-4 font-black">Fisik Stok Ayam</th>
                        <th className="px-5 py-4 text-right font-black">Uang Setoran Masuk</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-xs bg-white">
                      {(!stats.laporanUrut || stats.laporanUrut.length === 0) ? (
                          <tr><td colSpan="5" className="text-center py-16 text-slate-400 font-medium text-sm normal-case">Tidak ada setoran EOD tertulis dari cabang di rentang tanggal ini.</td></tr>
                      ) : (
                          stats.laporanUrut.map((r, i) => (
                              <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-5 py-4 whitespace-nowrap"><div className="font-black text-slate-800">{formatDate(r.date)}</div></td>
                                  <td className="px-5 py-4 text-center whitespace-nowrap font-black text-blue-700 bg-blue-50/50 rounded-xl">{r.produksiMika || '0'} Batch / {r.pesananMika || '0'} Order</td>
                                  <td className="px-5 py-4 font-black uppercase text-indigo-700">{formatNumber(r.stokFreezer)} Pcs</td>
                                  <td className="px-5 py-4 font-black uppercase text-orange-700">{formatNumber(r.stokAyam)} Kg</td>
                                  <td className="px-5 py-4 text-right font-black text-emerald-600 text-base tracking-tight">{formatRupiah(r.nominal)}</td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* AKTIVITAS INVOICE JUALAN NOTA */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
               <ShoppingCart size={18} className="text-orange-600"/>
               <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Buku Harian Antrean Invoice Jualan Pemalang</h3>
            </div>
            <div className="overflow-x-auto p-2 custom-scrollbar max-h-[400px]">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500 sticky top-0 z-10">
                        <tr>
                          <th className="px-5 py-4 font-black">Tanggal &amp; ID</th>
                          <th className="px-5 py-4 font-black">Nama Pelanggan</th>
                          <th className="px-5 py-4 text-center font-black">Volume</th>
                          <th className="px-5 py-4 text-right font-black">Total Tagihan</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                        {(!stats.branchOrdersPeriod || stats.branchOrdersPeriod.length === 0) ? (
                            <tr><td colSpan="4" className="text-center py-16 text-slate-400 font-medium text-sm normal-case">Tidak ada struk transaksi penjualan pada rentang periode ini.</td></tr>
                        ) : (
                            stats.branchOrdersPeriod.map((o, i) => {
                                let totalPcsInvoice = 0;
                                const items = safeJsonParse(o.items, []);
                                items.forEach(item => totalPcsInvoice += Number(item.qty || 0));
                                if (totalPcsInvoice === 0) totalPcsInvoice = Number(o.qty || 0);

                                return (
                                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-5 py-4 whitespace-nowrap"><div className="font-black text-slate-800">{formatDate(o?.date)}</div><div className="text-[10px] text-slate-400 font-mono mt-1">{o?.id || '-'}</div></td>
                                        <td className="px-5 py-4 uppercase font-black text-sm text-slate-800 whitespace-nowrap tracking-wide">{o?.customer_name || '-'}</td>
                                        <td className="px-5 py-4 text-center font-black text-blue-700 bg-blue-50/30 rounded-xl whitespace-nowrap">{formatNumber(totalPcsInvoice)} <span className="text-[10px] text-blue-500 font-bold uppercase">Pcs</span></td>
                                        <td className="px-5 py-4 text-right font-black text-emerald-600 text-base tracking-tight whitespace-nowrap">{formatRupiah(o?.total_amount)}</td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* CRM CUSTOMER LEADERBOARD */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl shadow-sm p-6 flex flex-col max-h-[480px]">
            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2 mb-5 border-b border-slate-100 pb-3"><Users size={18} className="text-red-600"/> Klasemen Pelanggan Terloyal</h3>
            <div className="overflow-y-auto pr-2 flex-1 space-y-3 custom-scrollbar">
               {(!stats.topCustomersList || stats.topCustomersList.length === 0) ? (
                   <div className="text-center text-slate-400 font-bold text-xs py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200 normal-case">Belum ada pelanggan loyal yang masuk hitungan.</div>
               ) : (
                   stats.topCustomersList.map((cust, i) => (
                       <div key={i} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-orange-300 hover:bg-orange-50/50 transition-colors shadow-sm group">
                           <div className="flex items-center gap-4">
                               <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-sm shrink-0 border border-slate-200 ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-800' : i === 2 ? 'bg-orange-400 text-white' : 'bg-white text-slate-400'}`}>#{i+1}</div>
                               <div>
                                 <div className="font-black text-slate-800 text-sm uppercase tracking-wide line-clamp-1 group-hover:text-red-600 transition-colors">{cust.name}</div>
                                 <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">{cust.frequency}x Belanja • {formatNumber(cust.qty)} Pcs ({formatNumber(cust.porsi.toFixed(0))} Porsi)</div>
                               </div>
                           </div>
                           <div className="font-black text-emerald-600 text-base tracking-tight shrink-0 pl-3">{formatRupiah(cust.total)}</div>
                       </div>
                   ))
               )}
            </div>
        </div>
      </div>

    </div>
  );
}
