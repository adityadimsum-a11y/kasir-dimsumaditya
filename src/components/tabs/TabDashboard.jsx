import React, { useMemo } from 'react';
import { 
  TrendingUp, ShoppingCart, Wallet, Package, 
  Users, Layers, Award, AlertCircle, BarChart3, 
  ShieldCheck, Landmark, Globe
} from 'lucide-react';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabDashboard({ 
  orders = [], orders_data,
  purchases = [], purchases_data,
  expenses = [], expenses_data,
  financial_closings = [],
  setActiveTab, user 
}) {
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);

  // --- ENGINE ANALYTICS GLOBAL HOLDING PUSAT ---
  const globalStats = useMemo(() => {
    let totalOmsetHolding = 0;
    let totalBelanjaHolding = 0;
    let totalBiayaHolding = 0;

    realOrders.forEach(o => { if (!o.isDeleted) totalOmsetHolding += Number(o.total_amount || 0); });
    realPurchases.forEach(p => { if (!p.isDeleted) totalBelanjaHolding += Number(p.amount || p.total_price || 0); });
    realExpenses.forEach(e => { if (!e.isDeleted) totalBiayaHolding += Number(e.amount || 0); });

    const totalKekayaanNetto = totalOmsetHolding - (totalBelanjaHolding + totalBiayaHolding);

    return { totalOmsetHolding, totalBelanjaHolding, totalBiayaHolding, totalKekayaanNetto };
  }, [realOrders, realPurchases, realExpenses]);

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-200">
      
      {/* HERO BANNER GLOBAL HQ RADAR */}
      <div className="card-holo p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden bg-white">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600"></div>
        <div className="pl-2">
          <h2 className="text-base font-extrabold normal-case flex items-center gap-2 text-slate-900">
            <Globe className="text-red-600" size={20} /> Global HQ Radar &amp; Command Center
          </h2>
          <p className="text-[10px] font-semibold text-slate-400 mt-1 normal-case tracking-wide">
            Pemantauan makro seluruh aktivitas jaringan holding pabrik, logistik, dan cabang outlet dalam satu pintu utama.
          </p>
        </div>
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-xs font-bold normal-case border border-red-100 shadow-xs flex items-center gap-1.5 shrink-0">
          <ShieldCheck size={14}/> Server Pusat Aktif
        </div>
      </div>

      {/* RANGKUMAN KEUANGAN KONSOLIDASI NASIONAL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-holo p-5 bg-white border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400 normal-case">Total penjualan holding (All time)</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><TrendingUp size={12}/></div>
          </div>
          <div className="text-xl font-black text-slate-800 tracking-tight">{formatRupiah(globalStats.totalOmsetHolding)}</div>
        </div>

        <div className="card-holo p-5 bg-white border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400 normal-case">Total belanja bahan baku holding</span>
            <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg"><Package size={12}/></div>
          </div>
          <div className="text-xl font-black text-slate-800 tracking-tight">{formatRupiah(globalStats.totalBelanjaHolding)}</div>
        </div>

        <div className="card-holo p-5 bg-white border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400 normal-case">Total beban operasional global</span>
            <div className="p-1.5 bg-red-50 text-red-600 rounded-lg"><Wallet size={12}/></div>
          </div>
          <div className="text-xl font-black text-slate-800 tracking-tight">{formatRupiah(globalStats.totalBiayaHolding)}</div>
        </div>

        <div className="card-holo p-5 bg-slate-50 border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-500 normal-case">Net profit holding (Konsolidasi)</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><Landmark size={12}/></div>
          </div>
          <div className="text-xl font-black text-emerald-600 tracking-tight">{formatRupiah(globalStats.totalKekayaanNetto)}</div>
        </div>
      </div>

      {/* WORKFLOW MONITOR */}
      <div className="card-holo p-6 bg-white border border-slate-200 shadow-xs">
        <h3 className="font-extrabold text-slate-800 text-xs normal-case mb-2 flex items-center gap-1.5"><BarChart3 size={16} className="text-slate-600"/> Status penyerapan pasar</h3>
        <p className="text-xs text-slate-500 font-medium normal-case">Sistem analitik holding sedang mengompilasi data transaksi dari seluruh node cabang produksi dan outlet resto. Silakan gunakan menu sidebar untuk melihat laporan spesifik harian.</p>
      </div>

    </div>
  );
}
