import React, { useState, useMemo } from 'react';
import { Calendar, Store, Factory, Wallet, Coins, AlertCircle, ShoppingCart, Users, CheckCircle, Percent } from 'lucide-react';
import { getTodayStr, formatDate, safeSort, safeJsonParse } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

// --- KARTU STATISTIK FINANSIAL FLAT ENTERPRISE ---
const StatCard = ({ title, amount, icon, colorClass, textClass }) => (
  <div className={`p-5 rounded-3xl shadow-sm flex flex-col justify-between transition-transform hover:scale-[1.02] duration-300 card-holo ${colorClass}`}>
    <div className="flex justify-between items-start mb-3">
      {/* Teks Lembut, Rapi, Bold Berwibawa */}
      <h3 className={`font-bold text-xs normal-case opacity-85 leading-tight ${textClass}`}>{title}</h3>
      <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 shrink-0">{icon}</div>
    </div>
    <div className={`text-2xl font-black tracking-tight mt-1 ${textClass}`}>{amount}</div>
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

    const jatahAyam55 = omsetPeriode * 0.55;
    const jatahOps20 = omsetPeriode * 0.20;
    const jatahCadangan10 = omsetPeriode * 0.10;
    const jatahCuan15 = omsetPeriode * 0.15;

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
        prodPeriode, jatahAyam55, jatahOps20, jatahCadangan10, jatahCuan15,
        ayamTerpakaiPeriode: prodPeriode * MASTER_AYAM_KG,
        dimsumMasukPeriode: prodPeriode * MASTER_PCS,
        laporanUrut, branchOrdersPeriod, topCustomersList 
    };
  }, [realOrders, realPurchases, pemalangReports, stokData, dateFrom, dateTo]);

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      
      {/* FILTER CONTROL KALENDER */}
      <div className="card-holo p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            {/* 🔥 SUNTIKAN SEMBUH: Judul Adem normal-case */}
            <h3 className="text-sm font-bold text-slate-800 normal-case mb-2 flex items-center gap-1.5"><Calendar size={16} className="text-orange-500"/> Filter rentang pemantauan cabang</h3>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
              <span className="text-[9px] font-bold text-slate-400 normal-case">Dari</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer" />
              <span className="text-[9px] font-bold text-slate-400 normal-case border-l border-slate-200 pl-2">Sampai</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer" />
            </div>
          </div>
          <button className="btn-holo px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs">
            <CheckCircle size={14}/> Mode audit sinkron HQ
          </button>
      </div>

      {/* MONITOR OPERASIONAL LIVE PANTAUAN PEMALANG */}
      <div className="card-holo overflow-hidden relative text-slate-700">
          <div className="absolute top-0 left-0 w-full h-1 bg-red-600"></div>
          
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
              <div>
                  {/* 🔥 SUNTIKAN SEMBUH: Judul dari CAPS LOCK diubah jadi normal-case sejuk */}
                  <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2 tracking-wide normal-case"><Factory className="text-orange-500"/> Pantauan live hasil dapur produksi (Pemalang)</h2>
                  <p className="text-[10px] font-medium text-slate-400 normal-case mt-0.5">Monitoring otomatis pergerakan adonan dan isi freezer langsung dari server pusat</p>
              </div>
              <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-emerald-600 flex items-center justify-end gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs"></span> Live data sinkron</div>
              </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-100 text-center bg-white">
              <div className="p-5 hover:bg-slate-50 transition-colors">
                  <div className="text-[9px] font-bold text-slate-400 normal-case mb-1">Adukan cabang</div>
                  <div className="text-xl font-extrabold text-slate-800 tracking-tight">{stats.prodPeriode} <span className="text-xs text-amber-600 font-bold">Adk</span></div>
              </div>
              <div className="p-5 hover:bg-slate-50 transition-colors">
                  <div className="text-[9px] font-bold text-slate-400 normal-case mb-1">Daging terpakai</div>
                  <div className="text-xl font-extrabold text-slate-800 tracking-tight">-{formatNumber(stats.ayamTerpakaiPeriode)} <span className="text-xs text-red-500 font-bold">Kg</span></div>
              </div>
              <div className="p-5 hover:bg-slate-50 transition-colors bg-slate-50/30 relative">
                  <div className="text-[9px] font-bold text-slate-400 normal-case mb-1">Sisa ayam gudang</div>
                  <div className="text-xl font-extrabold text-red-600 tracking-tight">{formatNumber(stats.sisaAyamCabang)} <span className="text-xs text-slate-500 font-bold">Kg</span></div>
                  <div className="text-[8px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 mt-1 inline-block normal-case">{formatNumber((stats.sisaAyamCabang / KG_PER_KANTONG).toFixed(0))} Kantong</div>
              </div>
              <div className="p-5 hover:bg-slate-50 transition-colors">
                  <div className="text-[9px] font-bold text-slate-400 normal-case mb-1">Masuk freezer</div>
                  <div className="text-xl font-extrabold text-slate-800 tracking-tight">+{formatNumber(stats.dimsumMasukPeriode)} <span className="text-xs text-emerald-600 font-bold">Pcs</span></div>
                  <div className="text-[8px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-200 mt-1 inline-block normal-case">{formatNumber((stats.dimsumMasukPeriode / PCS_PER_MIKA).toFixed(0))} Mika</div>
              </div>
              <div className="p-5 hover:bg-slate-50 transition-colors bg-slate-50/30">
                  <div className="text-[9px] font-bold text-slate-400 normal-case mb-1">Sisa freezer (Live)</div>
                  <div className="text-xl font-extrabold text-emerald-600 tracking-tight">{formatNumber(stats.sisaStokFreezer)} <span className="text-xs text-slate-500 font-bold">Pcs</span></div>
                  <div className="text-[8px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-200 mt-1 inline-block normal-case">{formatNumber((stats.sisaStokFreezer / PCS_PER_MIKA).toFixed(0))} Mika</div>
              </div>
          </div>
      </div>

      {/* DASHBOARD PERFORMA FINANSIAL PERIODE */}
      <div className="card-holo p-6">
          <div className="mb-5 border-b border-slate-100 pb-3">
              {/* 🔥 SUNTIKAN SEMBUH: Judul normal-case */}
              <h2 className="text-sm font-extrabold text-slate-800 normal-case flex items-center gap-1.5"><Wallet size={16} className="text-red-500"/> Analitik keuangan buku cabang Pemalang</h2>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5 normal-case">Laporan otomatis periode terpilih harian</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <StatCard title="Total omset cabang (All time)" amount={formatRupiah(stats.totalOmsetAll)} icon={<Store size={16} className="text-blue-600"/>} colorClass="bg-white" textClass="text-slate-800" />
              <StatCard title="Omset cabang (Periode ini)" amount={formatRupiah(stats.omsetPeriode)} icon={<Wallet size={16} className="text-orange-600"/>} colorClass="bg-white" textClass="text-orange-600" />
              <StatCard title="Total setoran kasir masuk" amount={formatRupiah(stats.setoranPeriode)} icon={<Coins size={16} className="text-emerald-600"/>} colorClass="bg-white" textClass="text-emerald-600" />
          </div>
      </div>

      {/* 🔥 TARGET BRANKAS 4 AMPLOP BERJALAN PEMALANG */}
      {stats.omsetPeriode > 0 && (
         <div className="card-holo p-5 border-l-4 border-l-orange-500 shadow-sm">
           {/* 🔥 SUNTIKAN SEMBUH: Judul normal-case */}
           <h3 className="font-extrabold text-xs text-slate-800 normal-case mb-4 flex items-center gap-1.5"><Percent size={14} className="text-orange-500"/> Proyeksi kuota jatah 4 amplop (Dari omset periode ini)</h3>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl"><div className="text-[8px] font-bold text-slate-400 normal-case">Amplop 1: Kas ayam (55%)</div><div className="text-base font-extrabold text-red-600 mt-1">{formatRupiah(stats.jatahAyam55)}</div></div>
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl"><div className="text-[8px] font-bold text-slate-400 normal-case">Amplop 2: Ops &amp; Gaji (20%)</div><div className="text-base font-extrabold text-blue-600 mt-1">{formatRupiah(stats.jatahOps20)}</div></div>
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl"><div className="text-[8px] font-bold text-slate-400 normal-case">Amplop 3: Cadangan (10%)</div><div className="text-base font-extrabold text-amber-600 mt-1">{formatRupiah(stats.jatahCadangan10)}</div></div>
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl"><div className="text-[8px] font-bold text-slate-400 normal-case">Amplop 4: Profit bersih (15%)</div><div className="text-base font-extrabold text-emerald-600 mt-1">{formatRupiah(stats.jatahCuan15)}</div></div>
           </div>
         </div>
      )}

      {/* PENGECEKAN SILANG EOD LAPORAN */}
      <div className="card-holo flex flex-col overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
             <AlertCircle size={16} className="text-red-500"/>
             {/* 🔥 SUNTIKAN SEMBUH: Judul normal-case */}
             <h4 className="font-extrabold text-slate-800 text-sm normal-case">Jurnal pengecekan silang setoran (EOD cabang)</h4>
          </div>
          <div className="overflow-x-auto p-1 custom-scrollbar">
              <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-50/50 border-b border-slate-200 text-[10px] text-slate-400 normal-case">
                      <tr>
                        <th className="px-5 py-3 font-bold">Tanggal lapor</th>
                        <th className="px-5 py-3 text-center font-bold">Klaim adukan dapur</th>
                        <th className="px-5 py-3 font-bold">Fisik freezer kulkas</th>
                        <th className="px-5 py-3 font-bold">Fisik stok ayam</th>
                        <th className="px-5 py-3 text-right font-bold">Uang setoran masuk</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-xs">
                      {(!stats.laporanUrut || stats.laporanUrut.length === 0) ? (
                          <tr><td colSpan="5" className="text-center py-10 text-slate-400 normal-case font-bold bg-white">Tidak ada setoran EOD tertulis dari cabang di rentang tanggal ini.</td></tr>
                      ) : (
                          stats.laporanUrut.map((r, i) => (
                              <tr key={i} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-5 py-4 whitespace-nowrap"><div className="font-bold text-slate-800">{formatDate(r.date)}</div></td>
                                  <td className="px-5 py-4 text-center whitespace-nowrap font-bold text-blue-700 bg-blue-50/50 rounded-lg">{r.produksiMika || '0'} Batch / {r.pesananMika || '0'} Order</td>
                                  <td className="px-5 py-4 font-bold normal-case text-indigo-700">{formatNumber(r.stokFreezer)} Pcs</td>
                                  <td className="px-5 py-4 font-bold normal-case text-orange-700">{formatNumber(r.stokAyam)} Kg</td>
                                  <td className="px-5 py-4 text-right font-extrabold text-emerald-600 text-sm">{formatRupiah(r.nominal)}</td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* AKTIVITAS INVOICE JUALAN NOTA */}
        <div className="lg:col-span-7 card-holo flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
               <ShoppingCart size={16} className="text-orange-500"/>
               {/* 🔥 SUNTIKAN SEMBUH: Judul normal-case */}
               <h3 className="font-extrabold text-slate-800 text-sm normal-case">Buku harian antrean invoice jualan Pemalang</h3>
            </div>
            <div className="overflow-x-auto p-1 custom-scrollbar max-h-[350px]">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] normal-case text-slate-400 sticky top-0 z-10 bg-white">
                        <tr>
                          <th className="px-4 py-3 font-bold">Tanggal &amp; ID</th>
                          <th className="px-4 py-3 font-bold">Nama pelanggan</th>
                          <th className="px-4 py-3 text-center font-bold">Volume</th>
                          <th className="px-4 py-3 text-right font-bold">Total tagihan</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-bold">
                        {(!stats.branchOrdersPeriod || stats.branchOrdersPeriod.length === 0) ? (
                            <tr><td colSpan="4" className="text-center py-10 text-slate-400 normal-case font-bold bg-white">Tidak ada struk transaksi penjualan pada rentang periode ini.</td></tr>
                        ) : (
                            stats.branchOrdersPeriod.map((o, i) => {
                                let totalPcsInvoice = 0;
                                const items = safeJsonParse(o.items, []);
                                items.forEach(item => totalPcsInvoice += Number(item.qty || 0));
                                if (totalPcsInvoice === 0) totalPcsInvoice = Number(o.qty || 0);

                                return (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-4 whitespace-nowrap"><div className="font-bold text-slate-700">{formatDate(o?.date)}</div><div className="text-[9px] text-slate-400 font-mono mt-0.5">{o?.id || '-'}</div></td>
                                        <td className="px-4 py-4 normal-case font-bold text-xs text-slate-700 whitespace-nowrap">{o?.customer_name || '-'}</td>
                                        <td className="px-4 py-4 text-center font-bold text-blue-600 bg-blue-50/50 rounded-lg whitespace-nowrap">{formatNumber(totalPcsInvoice)} Pcs</td>
                                        <td className="px-4 py-4 text-right font-extrabold text-emerald-600 whitespace-nowrap">{formatRupiah(o?.total_amount)}</td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* CRM CUSTOMER LEADERBOARD */}
        <div className="lg:col-span-5 card-holo p-5 flex flex-col max-h-[415px]">
            {/* 🔥 SUNTIKAN SEMBUH: Judul normal-case */}
            <h3 className="font-extrabold text-slate-800 text-sm normal-case flex items-center gap-2 mb-4 border-b border-slate-100 pb-2"><Users size={16} className="text-red-500"/> Klasemen pelanggan terloyal</h3>
            <div className="overflow-y-auto pr-1 flex-1 space-y-2.5 custom-scrollbar">
               {(!stats.topCustomersList || stats.topCustomersList.length === 0) ? (
                   <div className="text-center text-slate-400 normal-case font-bold text-[10px] py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">Belum ada pelanggan loyal yang masuk hitungan.</div>
               ) : (
                   stats.topCustomersList.map((cust, i) => (
                       <div key={i} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-orange-300 hover:bg-orange-50/30 transition-colors shadow-xs group">
                           <div className="flex items-center gap-3">
                               <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shadow-xs shrink-0 border border-slate-200 ${i === 0 ? 'bg-amber-100 text-amber-700 font-extrabold' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-white text-slate-400'}`}>#{i+1}</div>
                               <div>
                                 <div className="font-bold text-slate-800 text-xs normal-case line-clamp-1 group-hover:text-red-600 transition-colors">{cust.name}</div>
                                 <div className="text-[9px] font-medium text-slate-400 normal-case mt-0.5">{cust.frequency}x belanja • {formatNumber(cust.qty)} Pcs ({formatNumber(cust.porsi.toFixed(0))} Porsi)</div>
                               </div>
                           </div>
                           <div className="font-extrabold text-emerald-600 text-xs shrink-0 pl-2">{formatRupiah(cust.total)}</div>
                       </div>
                   ))
               )}
            </div>
        </div>
      </div>

    </div>
  );
}
