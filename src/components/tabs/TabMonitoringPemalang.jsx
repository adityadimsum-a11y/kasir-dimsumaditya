import React, { useState, useMemo } from 'react';
import { Calendar, Store, Factory, Wallet, Coins, AlertCircle, ShoppingCart, Users, CheckCircle, Percent } from 'lucide-react';
import { getTodayStr, formatDate, safeSort, safeJsonParse } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

// --- KARTU STATISTIK FINANSIAL KACA BURAM ---
const StatCard = ({ title, amount, icon, colorClass, textClass }) => (
  <div className={`p-5 rounded-3xl shadow-sm flex flex-col justify-between transition-transform hover:scale-[1.02] duration-300 card-holo ${colorClass}`}>
    <div className="flex justify-between items-start mb-3">
      <h3 className={`font-black text-xs uppercase tracking-wider opacity-80 leading-tight ${textClass}`}>{title}</h3>
      <div className="p-2 bg-white/60 backdrop-blur-sm rounded-xl shadow-sm border border-white/50 shrink-0">{icon}</div>
    </div>
    <div className={`text-2xl font-black tracking-tight mt-1 ${textClass}`}>{amount}</div>
  </div>
);

export default function TabMonitoringPemalang({ orders = [], orders_data, pemalangReports = [], purchases_data, purchases = [], stokData, user }) {
  const todayStr = getTodayStr();
  
  // 🔥 FIX KABEL UTAMA: DINAMIS MENGUNCI SIMPUL KENDALI PRODUKSI PEMALANG
  const currentBranch = 'PRODUKSI_PEMALANG';
  const [dateFrom, setDateFrom] = useState(todayStr); 
  const [dateTo, setDateTo] = useState(todayStr);
  
  // --- KONVERSI STANDAR SESUAI MANIFEST DOKTRIN ADITYA CORE ---
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

    // --- 1. DATA AYAM MENTAH PEMALANG (SINKRON DARI REKAP LOGISTIK PUSAT) ---
    let mutasiAyamPemalang = 0;
    realPurchases.filter(p => !p.isDeleted && p.category === 'BAHAN_BAKU' && String(p.branch_id).toUpperCase() === currentBranch).forEach(p => {
       mutasiAyamPemalang += Number(p.qty_kg || p.qty || 0);
    });

    // Hitung adukan dapur yang tercatat di cabang Pemalang
    const prodPemalangAll = (stokData || []).filter(s => !s.isDeleted && s.type === 'PRODUKSI_PEMALANG').reduce((sum, s) => sum + Number(s.qty || s.jumlah_adukan || 0), 0);
    const sisaAyamCabang = Math.max(0, mutasiAyamPemalang - (prodPemalangAll * MASTER_AYAM_KG));

    // --- 2. DATA STOK JADI FREEZER PEMALANG ---
    const branchOrdersAll = realOrders.filter(o => !o.isDeleted && String(o.branch_id).toUpperCase() === currentBranch);
    
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

    // --- 3. FILTER MONITOR BERDASARKAN PERIODE KALENDER AKTIF ---
    const branchOrdersPeriod = branchOrdersAll.filter(o => isPeriod(o.date));
    const branchReportsPeriod = (pemalangReports || []).filter(r => !r.isDeleted && isPeriod(r.date));
    
    const prodPeriode = (stokData || []).filter(s => !s.isDeleted && s.type === 'PRODUKSI_PEMALANG' && isPeriod(s.date)).reduce((sum, s) => sum + Number(s.qty || s.jumlah_adukan || 0), 0);
    
    const omsetPeriode = branchOrdersPeriod.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const setoranPeriode = branchReportsPeriod.reduce((sum, r) => sum + Number(r.nominal || r.amount || 0), 0);

    // 🔥 AUTOMATIC GENERATE PECAHAN 4 AMPLOP BERDASARKAN OMSET PERIODE (55% - 20% - 10% - 15%)
    const jatahAyam55 = omsetPeriode * 0.55;
    const jatahOps20 = omsetPeriode * 0.20;
    const jatahCadangan10 = omsetPeriode * 0.10;
    const jatahCuan15 = omsetPeriode * 0.15;

    // Leaderboard CRM Pelanggan Terloyal Cabang Pemalang
    const customerMap = {};
    branchOrdersPeriod.forEach(o => {
        const cName = String(o.customer_name || 'UMUM / CASH').toUpperCase();
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
        prodPeriode, jatahAyam55, jatahOps20, jatahCadangan10, jatahCuan15,
        ayamTerpakaiPeriode: prodPeriode * MASTER_AYAM_KG,
        dimsumMasukPeriode: prodPeriode * MASTER_PCS,
        laporanUrut, branchOrdersPeriod, topCustomersList 
    };
  }, [realOrders, realPurchases, pemalangReports, stokData, dateFrom, dateTo]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10 text-slate-800">
      
      {/* FILTER CONTROL KALENDER - KACA BURAM */}
      <div className="card-holo p-5 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Calendar size={16} className="text-orange-500"/> Filter Rentang Pemantauan Cabang</h3>
            <div className="flex items-center gap-2 bg-white/50 border border-white/60 px-3 py-1.5 rounded-xl shadow-sm">
              <span className="text-[9px] font-black text-slate-500 uppercase">DARI</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-xs font-black text-slate-800 outline-none bg-transparent cursor-pointer" />
              <span className="text-[9px] font-black text-slate-500 uppercase border-l border-white/60 pl-2">SAMPAI</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-xs font-black text-slate-800 outline-none bg-transparent cursor-pointer" />
            </div>
          </div>
          <button className="btn-holo px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md">
            <CheckCircle size={14}/> Mode Audit Sinkron HQ
          </button>
      </div>

      {/* 🔥 REVISI: MONITOR OPERASIONAL LIVE PANTAUAN PEMALANG DIUBAH JADI LIGHT GLASSMORPHISM */}
      <div className="card-holo rounded-3xl shadow-xl overflow-hidden relative text-slate-800">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500"></div>
          
          <div className="p-5 border-b border-white/50 flex justify-between items-center bg-white/40">
              <div>
                  <h2 className="text-base font-black text-slate-800 flex items-center gap-2 tracking-widest uppercase"><Factory className="text-orange-500"/> PANTAUAN LIVE HASIL DAPUR PRODUKSI (PEMALANG)</h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Monitoring otomatis pergerakan adonan dan isi freezer langsung dari server pusat</p>
              </div>
              <div className="text-right hidden sm:block">
                  <div className="text-xs font-black text-emerald-600 flex items-center justify-end gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span> LIVE DATA SINKRON</div>
              </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-white/50 text-center bg-white/20">
              <div className="p-6 hover:bg-white/40 transition-colors">
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Adukan Cabang</div>
                  <div className="text-3xl font-black text-slate-800 tracking-tight">{stats.prodPeriode} <span className="text-xs text-amber-600 font-bold">ADK</span></div>
              </div>
              <div className="p-6 hover:bg-white/40 transition-colors">
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Daging Terpakai</div>
                  <div className="text-3xl font-black text-slate-800 tracking-tight">-{formatNumber(stats.ayamTerpakaiPeriode)} <span className="text-xs text-red-500 font-bold">KG</span></div>
              </div>
              <div className="p-6 hover:bg-white/40 transition-colors bg-white/30 relative">
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Sisa Ayam Gudang</div>
                  <div className="text-3xl font-black text-red-600 tracking-tight">{formatNumber(stats.sisaAyamCabang)} <span className="text-xs text-slate-500 font-bold">KG</span></div>
                  <div className="text-[8px] font-black text-red-700 bg-red-100/80 px-2 py-0.5 rounded-md border border-red-200 mt-2 inline-block uppercase tracking-wider">{formatNumber((stats.sisaAyamCabang / KG_PER_KANTONG).toFixed(0))} Kantong</div>
              </div>
              <div className="p-6 hover:bg-white/40 transition-colors">
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Masuk Freezer</div>
                  <div className="text-3xl font-black text-slate-800 tracking-tight">+{formatNumber(stats.dimsumMasukPeriode)} <span className="text-xs text-emerald-600 font-bold">PCS</span></div>
                  <div className="text-[8px] font-black text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200 mt-2 inline-block uppercase tracking-wider">{formatNumber((stats.dimsumMasukPeriode / PCS_PER_MIKA).toFixed(0))} Mika</div>
              </div>
              <div className="p-6 hover:bg-white/40 transition-colors bg-white/30">
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Sisa Freezer (Live)</div>
                  <div className="text-3xl font-black text-emerald-600 tracking-tight">{formatNumber(stats.sisaStokFreezer)} <span className="text-xs text-slate-500 font-bold">PCS</span></div>
                  <div className="text-[8px] font-black text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200 mt-2 inline-block uppercase tracking-wider">{formatNumber((stats.sisaStokFreezer / PCS_PER_MIKA).toFixed(0))} Mika</div>
              </div>
          </div>
      </div>

      {/* DASHBOARD PERFORMA FINANSIAL PERIODE - GLASSMORPHISM */}
      <div className="card-holo p-6 rounded-3xl">
          <div className="mb-5 border-b border-white/50 pb-3">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5"><Wallet size={16} className="text-red-500"/> Analitik Keuangan Buku Cabang Pemalang</h2>
              <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">Laporan otomatis periode terpilih harian</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <StatCard title="Total Omset Cabang (All Time)" amount={formatRupiah(stats.totalOmsetAll)} icon={<Store size={16} className="text-blue-600"/>} textClass="text-blue-900" />
              <StatCard title="Omset Cabang (Periode Ini)" amount={formatRupiah(stats.omsetPeriode)} icon={<Wallet size={16} className="text-orange-600"/>} textClass="text-orange-900" />
              <StatCard title="Total Setoran Kasir Masuk" amount={formatRupiah(stats.setoranPeriode)} icon={<Coins size={16} className="text-emerald-600"/>} textClass="text-emerald-900" />
          </div>
      </div>

      {/* 🔥 TARGET BRANKAS 4 AMPLOP BERJALAN PEMALANG - KACA KILAP */}
      {stats.omsetPeriode > 0 && (
         <div className="card-holo p-6 rounded-3xl shadow-lg border-2 border-orange-200/50">
           <h3 className="text-holo-gradient font-black text-xs uppercase tracking-widest mb-4 flex items-center gap-1.5"><Percent size={14} className="text-orange-500"/> Proyeksi Kuota Jatah 4 Amplop (Dari Omset Periode Ini)</h3>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-white/60 shadow-sm"><div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Amplop 1: Kas Ayam (55%)</div><div className="text-lg font-black text-red-600 mt-1">{formatRupiah(stats.jatahAyam55)}</div></div>
              <div className="bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-white/60 shadow-sm"><div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Amplop 2: Ops &amp; Gaji (20%)</div><div className="text-lg font-black text-blue-600 mt-1">{formatRupiah(stats.jatahOps20)}</div></div>
              <div className="bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-white/60 shadow-sm"><div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Amplop 3: Cadangan (10%)</div><div className="text-lg font-black text-amber-600 mt-1">{formatRupiah(stats.jatahCadangan10)}</div></div>
              <div className="bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-white/60 shadow-sm"><div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Amplop 4: Profit Bersih (15%)</div><div className="text-lg font-black text-emerald-600 mt-1">{formatRupiah(stats.jatahCuan15)}</div></div>
           </div>
         </div>
      )}

      {/* PENGECEKAN SILANG EOD LAPORAN */}
      <div className="card-holo rounded-3xl flex flex-col overflow-hidden">
          <div className="p-5 bg-white/40 border-b border-white/50 flex items-center gap-2">
             <AlertCircle size={18} className="text-red-500 animate-pulse"/>
             <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest">Jurnal Pengecekan Silang Setoran (EOD Cabang)</h4>
          </div>
          <div className="overflow-x-auto p-2 custom-scrollbar">
              <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-white/50 border-b border-white/60 text-[10px] text-slate-500 uppercase">
                      <tr>
                        <th className="px-5 py-3 font-black">Tanggal Lapor</th>
                        <th className="px-5 py-3 text-center font-black">Klaim Adukan Dapur</th>
                        <th className="px-5 py-3 font-black">Fisik Freezer Kulkas</th>
                        <th className="px-5 py-3 font-black">Fisik Stok Ayam</th>
                        <th className="px-5 py-3 text-right font-black">Uang Setoran Masuk</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-white/40 font-bold text-xs">
                      {(!stats.laporanUrut || stats.laporanUrut.length === 0) ? (
                          <tr><td colSpan="5" className="text-center py-12 text-slate-500 uppercase font-black tracking-widest bg-white/20">Tidak ada setoran EOD tertulis dari cabang di rentang tanggal ini.</td></tr>
                      ) : (
                          stats.laporanUrut.map((r, i) => (
                              <tr key={i} className="hover:bg-white/40 transition-colors">
                                  <td className="px-5 py-4 whitespace-nowrap"><div className="font-black text-slate-800">{formatDate(r.date)}</div></td>
                                  <td className="px-5 py-4 text-center whitespace-nowrap font-black text-blue-700 bg-blue-50/50 rounded-lg">{r.produksiMika || '0'} Batch / {r.pesananMika || '0'} Order</td>
                                  <td className="px-5 py-4 font-black uppercase text-indigo-700">{formatNumber(r.stokFreezer)} PCS</td>
                                  <td className="px-5 py-4 font-black uppercase text-orange-700">{formatNumber(r.stokAyam)} KG</td>
                                  <td className="px-5 py-4 text-right font-black text-emerald-600 text-sm">{formatRupiah(r.nominal)}</td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* AKTIVITAS INVOICE JUALAN NOTA */}
        <div className="lg:col-span-7 card-holo rounded-3xl flex flex-col overflow-hidden">
            <div className="p-5 bg-white/40 border-b border-white/50 flex items-center gap-2">
               <ShoppingCart size={16} className="text-orange-500"/>
               <h3 className="font-black text-slate-800 text-xs tracking-widest uppercase">Buku Harian Antrean Invoice Jualan Pemalang</h3>
            </div>
            <div className="overflow-x-auto p-2 custom-scrollbar max-h-[350px]">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-white/60 border-b border-white/70 text-[10px] uppercase text-slate-500 sticky top-0 z-10 shadow-sm backdrop-blur-md">
                        <tr>
                          <th className="px-4 py-3 font-black">Tanggal &amp; ID</th>
                          <th className="px-4 py-3 font-black">Nama Pelanggan</th>
                          <th className="px-4 py-3 text-center font-black">Volume</th>
                          <th className="px-4 py-3 text-right font-black">Total Tagihan</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/40 text-xs font-bold">
                        {(!stats.branchOrdersPeriod || stats.branchOrdersPeriod.length === 0) ? (
                            <tr><td colSpan="4" className="text-center py-12 text-slate-500 uppercase font-black tracking-widest bg-white/20">Tidak ada struk transaksi penjualan pada rentang periode ini.</td></tr>
                        ) : (
                            stats.branchOrdersPeriod.map((o, i) => {
                                let totalPcsInvoice = 0;
                                const items = safeJsonParse(o.items, []);
                                items.forEach(item => totalPcsInvoice += Number(item.qty || 0));
                                if (totalPcsInvoice === 0) totalPcsInvoice = Number(o.qty || 0);

                                return (
                                    <tr key={i} className="hover:bg-white/50 transition-colors">
                                        <td className="px-4 py-4 whitespace-nowrap"><div className="font-black text-slate-800">{formatDate(o?.date)}</div><div className="text-[9px] text-slate-500 font-mono mt-0.5">{o?.id || '-'}</div></td>
                                        <td className="px-4 py-4 uppercase font-black text-xs text-slate-700 whitespace-nowrap">{o?.customer_name || '-'}</td>
                                        <td className="px-4 py-4 text-center font-black text-blue-700 bg-blue-50/50 rounded-lg whitespace-nowrap">{formatNumber(totalPcsInvoice)} Pcs</td>
                                        <td className="px-4 py-4 text-right font-black text-emerald-600 whitespace-nowrap">{formatRupiah(o?.total_amount)}</td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* CRM CUSTOMER LEADERBOARD */}
        <div className="lg:col-span-5 card-holo p-6 rounded-3xl flex flex-col max-h-[415px]">
            <h3 className="font-black text-slate-800 text-xs tracking-widest uppercase flex items-center gap-2 mb-4 border-b border-white/50 pb-3"><Users size={16} className="text-red-500"/> Klasemen Pelanggan Terloyal</h3>
            <div className="overflow-y-auto pr-1 flex-1 space-y-3 custom-scrollbar">
               {(!stats.topCustomersList || stats.topCustomersList.length === 0) ? (
                   <div className="text-center text-slate-500 uppercase font-black text-[10px] tracking-widest py-12 bg-white/40 rounded-2xl border border-dashed border-white/60">Belum ada pelanggan loyal yang masuk hitungan.</div>
               ) : (
                   stats.topCustomersList.map((cust, i) => (
                       <div key={i} className="flex items-center justify-between p-3 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/60 hover:border-orange-300 hover:bg-orange-50/30 transition-colors shadow-sm group">
                           <div className="flex items-center gap-3">
                               <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shadow-md shrink-0 border border-white/50 ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-orange-400 text-white' : 'bg-white/60 text-slate-500'}`}>#{i+1}</div>
                               <div>
                                 <div className="font-black text-slate-800 text-xs uppercase line-clamp-1 group-hover:text-red-600 transition-colors">{cust.name}</div>
                                 <div className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">{cust.frequency}x Belanja • {formatNumber(cust.qty)} Pcs ({formatNumber(cust.porsi.toFixed(0))} Porsi)</div>
                               </div>
                           </div>
                           <div className="font-black text-emerald-600 text-xs shrink-0 pl-2">{formatRupiah(cust.total)}</div>
                       </div>
                   ))
               )}
            </div>
        </div>
      </div>

    </div>
  );
}
