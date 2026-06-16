import React, { useState, useMemo } from 'react';
import { Factory, Store, Wallet, Coins, ArrowRightLeft, TrendingUp, DollarSign } from 'lucide-react';
import TabMonitoringPemalang from './TabMonitoringPemalang';
import { getTodayStr, formatDate, safeJsonParse } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabMonitoringCabangUniversal(props) {
  // Switcher: Default ke PEMALANG
  const [selectedMonitor, setSelectedMonitor] = useState('PEMALANG'); 
  const todayStr = getTodayStr();

  // --- ENGINE ANALITIK KHUSUS RESTO CIBINONG (INLINE) ---
  const cibinongStats = useMemo(() => {
    if (selectedMonitor !== 'CIBINONG') return null;

    const orders = props.orders || [];
    const expenses = props.expenses || [];
    const settlements = props.branch_settlements || [];

    let omsetHariIni = 0;
    let omsetBulanIni = 0;
    let totalBebanHariIni = 0;
    let setoranMenungguVal = 0;

    const currentMonth = todayStr.substring(0, 7); // Format: YYYY-MM

    // Filter Khusus Cibinong
    const cibinongOrders = orders.filter(o => !o.isDeleted && String(o.branch_id).toUpperCase().includes('CIBINONG'));
    const cibinongExpenses = expenses.filter(e => !e.isDeleted && String(e.branch_id).toUpperCase().includes('CIBINONG'));
    const cibinongSettlements = settlements.filter(s => !s.isDeleted && String(s.branch_id).toUpperCase().includes('CIBINONG'));

    cibinongOrders.forEach(o => {
      const amt = Number(o.total_amount || 0);
      if (o.date === todayStr) omsetHariIni += amt;
      if (o.date.startsWith(currentMonth)) omsetBulanIni += amt;
    });

    cibinongExpenses.forEach(e => {
      if (e.date === todayStr) totalBebanHariIni += Number(e.amount || 0);
    });

    cibinongSettlements.forEach(s => {
      if (s.status === 'PENDING_VALIDASI') setoranMenungguVal += Number(s.nominal || 0);
    });

    // 4 Amplop Cibinong (Bulan Ini)
    const jatahAyam55 = omsetBulanIni * 0.55;
    const jatahOps25 = omsetBulanIni * 0.25;
    const jatahCadangan15 = omsetBulanIni * 0.15;
    const jatahCuan5 = omsetBulanIni * 0.05;

    // Leaderboard Produk Laris Cibinong
    const productMap = {};
    cibinongOrders.forEach(o => {
       const items = safeJsonParse(o.items, []);
       items.forEach(item => {
          const pName = String(item.name).toUpperCase();
          if (!productMap[pName]) productMap[pName] = { name: pName, qty: 0, revenue: 0 };
          productMap[pName].qty += Number(item.qty || 0);
          productMap[pName].revenue += (Number(item.qty || 0) * Number(item.price || 0));
       });
    });
    const topProducts = Object.values(productMap).sort((a,b) => b.qty - a.qty).slice(0, 8);

    return {
      omsetHariIni, omsetBulanIni, totalBebanHariIni, setoranMenungguVal,
      jatahAyam55, jatahOps25, jatahCadangan15, jatahCuan5,
      topProducts
    };
  }, [selectedMonitor, props.orders, props.expenses, props.branch_settlements, todayStr]);

  return (
    <div className="space-y-6 text-slate-700 animate-in fade-in duration-300 pb-10">
      
      {/* ==================== HEADER & SWITCHER AREA ==================== */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div>
          <h2 className="text-lg font-black text-slate-800 tracking-wide uppercase">Command Center Multi Cabang</h2>
          <p className="text-[11px] font-bold text-slate-400 mt-1 max-w-md leading-relaxed normal-case">
            Gunakan tombol kendali di samping untuk berpindah pantauan analitik secara langsung antara pabrik produksi dan resto outlet.
          </p>
        </div>

        {/* CONTAINER SWITCH FLUID - ENTERPRISE */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto shadow-inner border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedMonitor('PEMALANG')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all cursor-pointer uppercase tracking-wider ${
              selectedMonitor === 'PEMALANG'
                ? 'bg-white text-red-600 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Factory size={16} />
            Pabrik Pemalang
          </button>
          
          <button
            type="button"
            onClick={() => setSelectedMonitor('CIBINONG')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all cursor-pointer uppercase tracking-wider ${
              selectedMonitor === 'CIBINONG'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Store size={16} />
            Resto Cibinong
          </button>
        </div>
      </div>

      {/* ==================== CONTENT DISPLAY AREA ==================== */}
      <div className="key-render-container animate-in fade-in slide-in-from-bottom-2 duration-300">
        {selectedMonitor === 'PEMALANG' ? (
          <TabMonitoringPemalang {...props} />
        ) : (
          /* 🔥 RADAR KHUSUS RESTO CIBINONG (INLINE) 🔥 */
          cibinongStats && (
            <div className="space-y-6">
              
              <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-900 p-6 lg:p-8 rounded-3xl shadow-xl relative overflow-hidden border border-blue-800">
                <div className="absolute top-0 right-0 p-4 opacity-5"><Store size={120} className="text-blue-400"/></div>
                <div className="relative z-10 flex items-center gap-3 mb-2">
                  <Store size={24} className="text-blue-400"/>
                  <h2 className="text-xl font-black text-white uppercase tracking-wide">Radar Eksekutif: Resto Cibinong</h2>
                </div>
                <p className="relative z-10 text-[11px] font-bold text-slate-300 normal-case max-w-lg leading-relaxed">
                  Layar analitik khusus memantau performa penjualan, beban operasional, dan peringkat menu terlaris outlet Resto Cibinong.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><TrendingUp size={14} className="text-blue-500"/> Omset Hari Ini</div>
                  <div className="text-3xl font-black text-blue-700 tracking-tight">{formatRupiah(cibinongStats.omsetHariIni)}</div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><ArrowRightLeft size={14} className="text-red-500"/> Beban Operasional (H)</div>
                  <div className="text-3xl font-black text-red-600 tracking-tight">-{formatRupiah(cibinongStats.totalBebanHariIni)}</div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-t-4 border-t-emerald-500">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Wallet size={14} className="text-emerald-500"/> Total Omset (Bulan Ini)</div>
                  <div className="text-3xl font-black text-emerald-700 tracking-tight">{formatRupiah(cibinongStats.omsetBulanIni)}</div>
                </div>
                <div className="bg-amber-50 p-6 rounded-3xl border border-amber-200 shadow-sm">
                  <div className="text-[10px] font-black text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-2"><Coins size={14}/> Setoran Menunggu Validasi</div>
                  <div className="text-3xl font-black text-amber-700 tracking-tight">{formatRupiah(cibinongStats.setoranMenungguVal)}</div>
                </div>
              </div>

              {/* 4 AMPLOP CIBINONG */}
              {cibinongStats.omsetBulanIni > 0 && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-l-8 border-l-blue-500">
                  <h3 className="font-black text-sm text-slate-800 uppercase tracking-wide mb-5 flex items-center gap-2"><DollarSign size={18} className="text-blue-600"/> Proyeksi Jatah 4 Amplop (Omset Bulan Ini Cibinong)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5 text-center">
                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl shadow-inner"><div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Amplop 1 (Ayam 55%)</div><div className="text-xl font-black text-blue-700 mt-2">{formatRupiah(cibinongStats.jatahAyam55)}</div></div>
                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl shadow-inner"><div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Amplop 2 (Ops 25%)</div><div className="text-xl font-black text-emerald-700 mt-2">{formatRupiah(cibinongStats.jatahOps25)}</div></div>
                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl shadow-inner"><div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Amplop 3 (Cicilan 15%)</div><div className="text-xl font-black text-orange-700 mt-2">{formatRupiah(cibinongStats.jatahCadangan15)}</div></div>
                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl shadow-inner"><div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Amplop 4 (Profit 5%)</div><div className="text-xl font-black text-amber-700 mt-2">{formatRupiah(cibinongStats.jatahCuan5)}</div></div>
                  </div>
                </div>
              )}

              {/* TOP PRODUCTS CIBINONG */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col max-h-[480px]">
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2 mb-5 border-b border-slate-100 pb-4"><TrendingUp size={18} className="text-emerald-500"/> Klasemen Menu / Produk Terlaris Cibinong (All Time)</h3>
                  <div className="overflow-y-auto pr-2 flex-1 space-y-3 custom-scrollbar">
                     {cibinongStats.topProducts.length === 0 ? (
                         <div className="text-center text-slate-400 font-bold text-xs py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200 normal-case">Belum ada data penjualan tercatat.</div>
                     ) : (
                         cibinongStats.topProducts.map((prod, i) => (
                             <div key={i} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors shadow-sm group">
                                 <div className="flex items-center gap-4">
                                     <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-sm shrink-0 border border-slate-200 ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-800' : i === 2 ? 'bg-orange-400 text-white' : 'bg-white text-slate-400'}`}>#{i+1}</div>
                                     <div>
                                       <div className="font-black text-slate-800 text-sm uppercase tracking-wide line-clamp-1 group-hover:text-emerald-600 transition-colors">{prod.name}</div>
                                       <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">{formatNumber(prod.qty)} Pcs Terjual</div>
                                     </div>
                                 </div>
                                 <div className="font-black text-emerald-600 text-base tracking-tight shrink-0 pl-3">{formatRupiah(prod.revenue)}</div>
                             </div>
                         ))
                     )}
                  </div>
              </div>

            </div>
          )
        )}
      </div>

    </div>
  );
}
