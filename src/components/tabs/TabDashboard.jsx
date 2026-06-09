import React, { useMemo } from 'react';
import { LayoutDashboard, TrendingUp, AlertTriangle, Package, Activity, Wallet, ShoppingCart } from 'lucide-react';
import { formatRp, getTodayStr, formatDate } from '../../utils/helpers';

export default function TabDashboard({ orders, productionBatches, inventory_cost_layers, supplier_ledger }) {
  const todayStr = getTodayStr();

  const metrics = useMemo(() => {
    let netRevenueHariIni = 0;
    let pcsTerjualHariIni = 0;
    let hutangSupplier = 0;
    let stokAyamKg = 0;
    let produksiHariIniPcs = 0;
    let totalStokDimsum = 0;

    // 1. Hitung Revenue & Sales Hari Ini (Global)
    (orders || []).forEach(o => {
      if (o.isDeleted || String(o.isDeleted).toUpperCase() === 'TRUE') return;
      if (o.date === todayStr) {
        netRevenueHariIni += (Number(o.total || 0) - Number(o.fee_amount || 0) - Number(o.marketplace_promo || 0));
        pcsTerjualHariIni += Number(o.qty || 0);
      }
    });

    // 2. Hitung Hutang Supplier
    (supplier_ledger || []).forEach(l => {
      if (l.isDeleted || String(l.isDeleted).toUpperCase() === 'TRUE') return;
      if (l.transaction_type === 'PURCHASE') hutangSupplier += Number(l.amount || 0);
      if (l.transaction_type === 'PAYMENT') hutangSupplier -= Number(l.amount || 0);
    });

    // 3. Hitung Produksi Hari Ini
    (productionBatches || []).forEach(b => {
      if (b.isDeleted || String(b.isDeleted).toUpperCase() === 'TRUE') return;
      if (b.date === todayStr) {
        produksiHariIniPcs += Number(b.result_pcs || 0);
      }
    });

    // 4. Hitung Sisa Stok Global (Ayam & Dimsum)
    (inventory_cost_layers || []).forEach(l => {
      if (l.isDeleted || String(l.isDeleted).toUpperCase() === 'TRUE' || l.status !== 'ACTIVE') return;
      
      if (String(l.item_name).toUpperCase() === 'AYAM') {
        stokAyamKg += Number(l.qty_remaining || 0);
      } else if (String(l.item_name).toUpperCase() === 'DIMSUM') {
        totalStokDimsum += Number(l.qty_remaining || 0);
      }
    });

    // RUMUS KONVERSI GLOBAL
    const stokDimsumMika = Math.floor(totalStokDimsum / 50);
    const stokDimsumPorsi = Math.floor(totalStokDimsum / 4);

    return { 
      netRevenueHariIni, 
      pcsTerjualHariIni, 
      hutangSupplier, 
      stokAyamKg, 
      produksiHariIniPcs, 
      totalStokDimsum,
      stokDimsumMika,
      stokDimsumPorsi
    };
  }, [orders, productionBatches, inventory_cost_layers, supplier_ledger, todayStr]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* HEADER */}
      <div className="bg-white rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <LayoutDashboard size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wide">HQ DASHBOARD</h2>
            <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-2">Sistem Komando Utama Dimsum Aditya — <span className="text-blue-600">{formatDate(todayStr)}</span></p>
          </div>
        </div>
      </div>

      {/* TOP CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Net Revenue Hari Ini</div>
          <div className="text-2xl font-black text-slate-800 mb-2">{formatRp(metrics.netRevenueHariIni)}</div>
          <div className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded w-max">Profit & Cash In</div>
          <Wallet className="absolute right-4 top-4 text-emerald-50 opacity-50" size={60} />
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kinerja Saluran Sales</div>
          <div className="text-2xl font-black text-slate-800 mb-2">{metrics.pcsTerjualHariIni.toLocaleString('id-ID')} <span className="text-sm font-bold text-slate-500">Pcs Terjual</span></div>
          <div className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded w-max">Global All Node</div>
          <ShoppingCart className="absolute right-4 top-4 text-blue-50 opacity-50" size={60} />
        </div>

        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm relative overflow-hidden">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Hutang Supplier (Ayam)</div>
          <div className="text-2xl font-black text-rose-600 mb-2">{formatRp(metrics.hutangSupplier)}</div>
          <div className="text-[9px] font-bold text-rose-600 flex items-center gap-1"><AlertTriangle size={10}/> Menunggu pelunasan kas</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm relative overflow-hidden">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ayam Mentah (Gudang)</div>
          <div className="text-2xl font-black text-amber-600 mb-2">{metrics.stokAyamKg} <span className="text-sm font-bold text-amber-600/60">KG</span></div>
          {metrics.stokAyamKg < 30 ? (
            <div className="text-[9px] font-bold text-rose-600 flex items-center gap-1"><AlertTriangle size={10}/> Kurang dari 1 Adukan!</div>
          ) : (
            <div className="text-[9px] font-bold text-amber-600 flex items-center gap-1">Stok aman untuk produksi</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LIVE PRODUCTION & INVENTORY (DENGAN KONVERSI) */}
        <div className="lg:col-span-2 bg-slate-900 rounded-3xl p-6 md:p-8 shadow-xl border border-slate-800 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div>
            <h3 className="text-white font-black uppercase flex items-center gap-2 mb-6 relative z-10"><Activity className="text-emerald-400"/> Live Production & Inventory</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
              
              <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dimsum Selesai Diproduksi Hari Ini</div>
                <div className="text-3xl font-black text-emerald-400 my-2">{metrics.produksiHariIniPcs.toLocaleString('id-ID')} <span className="text-sm text-slate-500">Pcs</span></div>
                <div className="text-[10px] font-bold text-slate-500 mt-3 pt-3 border-t border-slate-700">Masuk ke Freezer Pusat</div>
              </div>

              {/* KARTU STOK GLOBAL DENGAN KONVERSI OTOMATIS */}
              <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Stok Dimsum (Global)</div>
                <div className="text-3xl font-black text-white my-2">{metrics.totalStokDimsum.toLocaleString('id-ID')} <span className="text-sm text-slate-500">Pcs</span></div>
                
                {/* TAMPILAN KONVERSI DI DASHBOARD HQ */}
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-700">
                   <span className="bg-blue-500/20 text-blue-300 text-[10px] font-black px-2 py-1 rounded uppercase border border-blue-500/30">Setara {metrics.stokDimsumMika.toLocaleString('id-ID')} Mika</span>
                   <span className="bg-purple-500/20 text-purple-300 text-[10px] font-black px-2 py-1 rounded uppercase border border-purple-500/30">Setara {metrics.stokDimsumPorsi.toLocaleString('id-ID')} Porsi</span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* SYSTEM ALERTS */}
        <div className="lg:col-span-1 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col">
          <h3 className="font-black text-slate-800 text-sm uppercase flex items-center gap-2 mb-6"><AlertTriangle className="text-orange-500" size={18}/> System Alerts</h3>
          <div className="flex-1 space-y-4">
            {metrics.stokAyamKg < 30 ? (
               <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl">
                 <h4 className="font-black text-orange-800 text-xs uppercase flex items-center gap-2 mb-1"><AlertTriangle size={14}/> Stok Ayam Menipis</h4>
                 <p className="text-[10px] font-bold text-orange-600">Sisa di gudang: {metrics.stokAyamKg} KG. Segera order ke supplier untuk produksi besok.</p>
               </div>
            ) : (
               <div className="text-center py-8 text-xs font-bold text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                 Semua sistem berjalan normal. Tidak ada peringatan.
               </div>
            )}
            
            {metrics.hutangSupplier > 0 && (
               <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl">
                 <h4 className="font-black text-rose-800 text-xs uppercase flex items-center gap-2 mb-1"><AlertTriangle size={14}/> Tagihan Supplier Aktif</h4>
                 <p className="text-[10px] font-bold text-rose-600">Terdapat AP sebesar {formatRp(metrics.hutangSupplier)} yang belum dilunasi.</p>
               </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
