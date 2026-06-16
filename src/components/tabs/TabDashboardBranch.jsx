import React, { useState, useMemo } from 'react';
import { Calendar, Printer, Wallet, Coins, CreditCard, Store, TrendingUp, ArrowRightLeft } from 'lucide-react';
import { getTodayStr, getLocalYMD, formatDate, safeJsonParse } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabDashboardBranch({ orders = [], pemalangReports = [], piutangPayments = [], expenses = [], branch_settlements = [], setPrintData, stokData = [], forcedBranchId = null, user }) {
  const todayStr = getTodayStr();
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);

  const activeBranchId = forcedBranchId || user?.branch_id || 'CIBINONG';

  const rekap = useMemo(() => {
    const isPeriod = (d) => {
      const ymd = getLocalYMD(d);
      return ymd >= dateFrom && ymd <= dateTo;
    };
    
    // Filter Khusus Cabang Ini
    const branchOrdersAll = (orders || []).filter(o => !o.isDeleted && String(o.branch_id).toUpperCase().includes(activeBranchId.toUpperCase()));
    const branchOrdersPeriod = branchOrdersAll.filter(o => isPeriod(o?.date));
    const branchSettlementsPeriod = (branch_settlements || []).filter(s => !s.isDeleted && String(s.branch_id).toUpperCase().includes(activeBranchId.toUpperCase()) && isPeriod(s?.date));
    const branchExpensesPeriod = (expenses || []).filter(e => !e.isDeleted && String(e.branch_id).toUpperCase().includes(activeBranchId.toUpperCase()) && isPeriod(e?.date));
    
    const totalPenjualanKotor = branchOrdersPeriod.reduce((sum, o) => sum + (Number(o.total_amount || o.total || 0)), 0);
    const totalPcs = branchOrdersPeriod.reduce((sum, o) => sum + (Number(o.qty || 0)), 0);
    const setoranKePusat = branchSettlementsPeriod.reduce((sum, r) => sum + (Number(r.nominal || r.amount || 0)), 0);
    const bebanOps = branchExpensesPeriod.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    
    const piutangBerjalan = branchOrdersAll.map(o => {
        const cicilan = (piutangPayments || []).filter(p => !p.isDeleted && p.orderId === o.id).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const baseTotal = Number(o.total_amount || o.total || 0);
        const basePaid = Number(o.amount_paid || o.paidAmount || 0);
        return { ...o, sisaTagihan: baseTotal - basePaid - cicilan };
    }).filter(o => o.sisaTagihan > 0);
    
    const totalPiutangBaru = piutangBerjalan.reduce((sum, o) => sum + o.sisaTagihan, 0);

    // Leaderboard Produk
    const productMap = {};
    branchOrdersPeriod.forEach(o => {
       const items = safeJsonParse(o.items, []);
       items.forEach(item => {
          const pName = String(item.name).toUpperCase();
          if (!productMap[pName]) productMap[pName] = { name: pName, qty: 0, revenue: 0 };
          productMap[pName].qty += Number(item.qty || 0);
          productMap[pName].revenue += (Number(item.qty || 0) * Number(item.price || 0));
       });
    });
    const topProducts = Object.values(productMap).sort((a,b) => b.qty - a.qty).slice(0, 8);

    // Leaderboard Pelanggan
    const customerMap = {};
    branchOrdersPeriod.forEach(o => {
        const cName = String(o.customer_name || o.customer || 'UMUM').toUpperCase();
        if(!customerMap[cName]) customerMap[cName] = { name: cName, total: 0, frequency: 0 };
        customerMap[cName].total += Number(o.total_amount || o.total || 0);
        customerMap[cName].frequency += 1;
    });
    const topCustomers = Object.values(customerMap).sort((a,b) => b.total - a.total).slice(0, 8);

    return {
        totalPenjualanKotor, totalPcs, setoranKePusat, totalPiutangBaru, bebanOps,
        topProducts, topCustomers
    };
  }, [orders, branch_settlements, piutangPayments, expenses, activeBranchId, dateFrom, dateTo]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10 text-slate-800 duration-300">
      
      {/* 🚀 HEADER BANNER - FLUID GRADIENT */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-900 p-6 lg:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 rounded-3xl shadow-xl relative overflow-hidden border border-blue-800">
        <div className="absolute top-0 right-0 p-4 opacity-5"><Store size={120} className="text-blue-400"/></div>
        <div className="relative z-10 w-full md:w-2/3">
          <h2 className="text-xl font-black text-white flex items-center gap-3 tracking-wide mb-2 uppercase">
            <Store className="text-blue-400" size={24}/> Radar Eksekutif: Resto {activeBranchId.replace(/_/g, ' ')}
          </h2>
          <p className="text-[11px] font-bold text-slate-400 max-w-lg leading-relaxed normal-case">
            Layar analitik khusus untuk memantau performa penjualan, beban operasional, dan peringkat menu terlaris pada periode berjalan.
          </p>
        </div>

        <div className="relative z-10 flex flex-col gap-3 w-full md:w-auto shrink-0 bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/50 px-4 py-2.5 rounded-xl shadow-inner">
             <Calendar size={16} className="text-blue-400"/>
             <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-xs font-bold border-none bg-transparent outline-none cursor-pointer text-white uppercase tracking-wider" />
             <span className="text-slate-500 font-bold px-1">-</span>
             <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-xs font-bold border-none bg-transparent outline-none cursor-pointer text-white uppercase tracking-wider" />
          </div>
          <button onClick={() => {
            if (typeof setPrintData === 'function') {
              setPrintData({ type: 'reportBranch', data: { rekap, dateFrom, dateTo, branchName: activeBranchId } });
            }
          }} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-wider shadow-md transition-transform active:scale-95 cursor-pointer">
             <Printer size={16} /> Cetak Rekap Outlet
          </button>
        </div>
      </div>

      {/* MATRIKS KEUANGAN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-t-4 border-t-blue-500">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><TrendingUp size={16} className="text-blue-500"/> Total Omset Penjualan</div>
          <div className="text-3xl font-black text-blue-700 tracking-tight">{formatRupiah(rekap.totalPenjualanKotor)}</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-t-4 border-t-red-500">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><ArrowRightLeft size={16} className="text-red-500"/> Total Beban Operasional</div>
          <div className="text-3xl font-black text-red-600 tracking-tight">-{formatRupiah(rekap.bebanOps)}</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-t-4 border-t-emerald-500">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Coins size={16} className="text-emerald-500"/> Total Setoran Pusat</div>
          <div className="text-3xl font-black text-emerald-700 tracking-tight">{formatRupiah(rekap.setoranKePusat)}</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-t-4 border-t-orange-500">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2"><CreditCard size={16} className="text-orange-500"/> Piutang Agen Belum Lunas</div>
          <div className="text-3xl font-black text-orange-700 tracking-tight">{formatRupiah(rekap.totalPiutangBaru)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEADERBOARD PRODUK */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col max-h-[480px]">
            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2 mb-5 border-b border-slate-100 pb-4"><TrendingUp size={18} className="text-emerald-500"/> Peringkat Menu Terlaris</h3>
            <div className="overflow-y-auto pr-2 flex-1 space-y-3 custom-scrollbar">
               {rekap.topProducts.length === 0 ? (
                   <div className="text-center text-slate-400 font-bold text-xs py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200 normal-case">Belum ada data penjualan tercatat.</div>
               ) : (
                   rekap.topProducts.map((prod, i) => (
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

        {/* LEADERBOARD CUSTOMER */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col max-h-[480px]">
            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2 mb-5 border-b border-slate-100 pb-4"><Store size={18} className="text-blue-500"/> Pelanggan / Agen Terloyal</h3>
            <div className="overflow-y-auto pr-2 flex-1 space-y-3 custom-scrollbar">
               {rekap.topCustomers.length === 0 ? (
                   <div className="text-center text-slate-400 font-bold text-xs py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200 normal-case">Belum ada data pelanggan tercatat.</div>
               ) : (
                   rekap.topCustomers.map((cust, i) => (
                       <div key={i} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-blue-300 hover:bg-blue-50/50 transition-colors shadow-sm group">
                           <div className="flex items-center gap-4">
                               <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-sm shrink-0 border border-slate-200 ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-800' : i === 2 ? 'bg-orange-400 text-white' : 'bg-white text-slate-400'}`}>#{i+1}</div>
                               <div>
                                 <div className="font-black text-slate-800 text-sm uppercase tracking-wide line-clamp-1 group-hover:text-blue-600 transition-colors">{cust.name}</div>
                                 <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">{cust.frequency}x Transaksi</div>
                               </div>
                           </div>
                           <div className="font-black text-blue-600 text-base tracking-tight shrink-0 pl-3">{formatRupiah(cust.total)}</div>
                       </div>
                   ))
               )}
            </div>
        </div>
      </div>

    </div>
  );
}
