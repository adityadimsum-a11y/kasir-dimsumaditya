import React, { useMemo } from 'react';
import { LayoutDashboard, TrendingUp, AlertTriangle, Package, Activity, Wallet, ShoppingCart, Box, AlertCircle, Coins } from 'lucide-react';
import { formatRp, getTodayStr } from '../../utils/helpers';

export default function TabDashboard({ orders, productionBatches, inventory_cost_layers, supplier_ledger, cashflow_transactions }) {
  const todayStr = getTodayStr();

  const metrics = useMemo(() => {
    let netRevenueHariIni = 0;
    let pcsTerjualHariIni = 0;
    let hutangSupplier = 0;
    let totalPiutang = 0;
    let stokAyamKg = 0;
    let produksiHariIniPcs = 0;
    let totalStokDimsum = 0;

    (orders || []).forEach(o => {
      if (o.isDeleted || String(o.isDeleted).toUpperCase() === 'TRUE') return;
      
      const netTotal = Number(o.total || 0) - Number(o.fee_amount || 0) - Number(o.marketplace_promo || 0);
      
      if (o.date === todayStr) {
        netRevenueHariIni += netTotal;
        pcsTerjualHariIni += Number(o.qty || 0);
      }

      if (o.paymentMethod === 'PIUTANG' || o.paymentMethod === 'MARKETPLACE_AR') {
        totalPiutang += netTotal;
      }
    });

    (cashflow_transactions || []).forEach(tx => {
      if (tx.isDeleted || String(tx.isDeleted).toUpperCase() === 'TRUE') return;
      if (tx.category === 'AR_COLLECTION' || tx.category === 'PELUNASAN_PIUTANG') {
        totalPiutang -= Number(tx.amount || 0);
      }
    });

    (supplier_ledger || []).forEach(l => {
      if (l.isDeleted || String(l.isDeleted).toUpperCase() === 'TRUE') return;
      if (l.transaction_type === 'PURCHASE') hutangSupplier += Number(l.amount || 0);
      if (l.transaction_type === 'PAYMENT') hutangSupplier -= Number(l.amount || 0);
    });

    (productionBatches || []).forEach(b => {
      if (b.isDeleted || String(b.isDeleted).toUpperCase() === 'TRUE') return;
      if (b.date === todayStr) {
        produksiHariIniPcs += Number(b.result_pcs || 0);
      }
    });

    (inventory_cost_layers || []).forEach(l => {
      if (l.isDeleted || String(l.isDeleted).toUpperCase() === 'TRUE' || l.status !== 'ACTIVE') return;
      
      if (String(l.item_name).toUpperCase() === 'AYAM') {
        stokAyamKg += Number(l.qty_remaining || 0);
      } else if (String(l.item_name).toUpperCase() === 'DIMSUM') {
        totalStokDimsum += Number(l.qty_remaining || 0);
      }
    });

    const stokDimsumMika = Math.floor(totalStokDimsum / 50);
    const stokDimsumPorsi = Math.floor(totalStokDimsum / 4);

    return { 
      netRevenueHariIni, pcsTerjualHariIni, hutangSupplier, totalPiutang, 
      stokAyamKg, produksiHariIniPcs, totalStokDimsum, stokDimsumMika, stokDimsumPorsi
    };
  }, [orders, productionBatches, inventory_cost_layers, supplier_ledger, cashflow_transactions, todayStr]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* HEADER */}
      <div className="bg-white rounded-3xl p-6 md:p-8 flex items-center gap-4 shadow-sm border border-slate-200">
        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
          <LayoutDashboard size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wide">HQ DASHBOARD</h2>
          <p className="text-xs font-bold text-slate-500 mt-1">Sistem Komando Pusat — <span className="text-blue-600">{todayStr}</span></p>
        </div>
      </div>

      {/* RADAR FOLLOW-UP (PIUTANG, HUTANG, AYAM) */}
      <div className="bg-slate-900 rounded-3xl p-1 shadow-lg border border-slate-800">
        <div className="bg-slate-800/50 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 w-full md:w-auto mb-4 md:mb-0">
            <div className="bg-orange-500/20 p-3 rounded-xl text-orange-400 border border-orange-500/30"><AlertCircle size={24} /></div>
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Radar Follow-Up Global</div>
              <div className="text-sm font-bold text-white">Pantau Urat Nadi Bisnis</div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full md:flex-1">
            <div className={`p-4 rounded-xl border flex items-center justify-between ${metrics.totalPiutang > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-800 border-slate-700'}`}>
              <div>
                <div className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Coins size={12}/> Piutang (Tagih)</div>
                <div className={`text-xl font-black ${metrics.totalPiutang > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{formatRp(metrics.totalPiutang)}</div>
              </div>
            </div>
            <div className={`p-4 rounded-xl border flex items-center justify-between ${metrics.hutangSupplier > 0 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-slate-800 border-slate-700'}`}>
              <div>
                <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1 flex items-center gap-1"><AlertTriangle size={12}/> Hutang Supplier (Bayar)</div>
                <div className={`text-xl font-black ${metrics.hutangSupplier > 0 ? 'text-rose-400' : 'text-slate-500'}`}>{formatRp(metrics.hutangSupplier)}</div>
              </div>
            </div>
            <div className={`p-4 rounded-xl border flex items-center justify-between ${metrics.stokAyamKg < 30 ? 'bg-rose-500/10 border-rose-500/30 animate-pulse' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
              <div>
                <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1 flex items-center gap-1"><Box size={12}/> Stok Inti: Daging Ayam</div>
                <div className={`text-xl font-black ${metrics.stokAyamKg < 30 ? 'text-rose-400' : 'text-emerald-400'}`}>{metrics.stokAyamKg} <span className="text-xs font-bold opacity-70">KG</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TOP CARDS METRIK HARIAN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Net Revenue Hari Ini</div>
            <div className="text-4xl font-black text-slate-800 mb-2">{formatRp(metrics.netRevenueHariIni)}</div>
            <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-max border border-emerald-100">Profit & Cash In Global</div>
          </div>
          <Wallet className="text-emerald-100 opacity-50" size={80} />
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kinerja Saluran Sales (Global)</div>
            <div className="text-4xl font-black text-slate-800 mb-2">{metrics.pcsTerjualHariIni.toLocaleString('id-ID')} <span className="text-lg font-bold text-slate-400">Pcs</span></div>
            <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg w-max border border-blue-100">Update Mesin Kasir</div>
          </div>
          <ShoppingCart className="text-blue-100 opacity-50" size={80} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LIVE PRODUCTION & INVENTORY */}
        <div className="lg:col-span-3 bg-slate-900 rounded-3xl p-6 md:p-8 shadow-xl border border-slate-800 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div>
            <h3 className="text-white font-black uppercase flex items-center gap-2 mb-6 relative z-10"><Activity className="text-emerald-400"/> Live Production & Dimsum Inventory</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
              
              <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dimsum Selesai Diproduksi Hari Ini</div>
                <div className="text-4xl font-black text-emerald-400 my-2">{metrics.produksiHariIniPcs.toLocaleString('id-ID')} <span className="text-sm text-slate-500">Pcs</span></div>
                <div className="text-[10px] font-bold text-slate-500 mt-4 pt-4 border-t border-slate-700 flex items-center gap-2"><Package size={14}/> Masuk ke Freezer Pusat</div>
              </div>

              <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Stok Dimsum (Global)</div>
                <div className="text-4xl font-black text-white my-2">{metrics.totalStokDimsum.toLocaleString('id-ID')} <span className="text-sm text-slate-500">Pcs</span></div>
                
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-700">
                   <span className="bg-blue-500/20 text-blue-300 text-[10px] font-black px-2 py-1 rounded uppercase border border-blue-500/30">Setara {metrics.stokDimsumMika.toLocaleString('id-ID')} Mika</span>
                   <span className="bg-purple-500/20 text-purple-300 text-[10px] font-black px-2 py-1 rounded uppercase border border-purple-500/30">Setara {metrics.stokDimsumPorsi.toLocaleString('id-ID')} Porsi</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
