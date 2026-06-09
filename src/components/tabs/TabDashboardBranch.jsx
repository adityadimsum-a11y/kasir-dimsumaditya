import React, { useMemo } from 'react';
import { Store, TrendingUp, Users, ShoppingBag, Clock, Receipt, Activity, CreditCard, Package, HandCoins, AlertTriangle, Beef, AlertCircle } from 'lucide-react';
import { formatRp, getTodayStr, formatDate } from '../../utils/helpers';

export default function TabDashboardBranch({ orders, master_customers, inventory_cost_layers, supplier_ledger, cashflow_transactions, user }) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'UNKNOWN_BRANCH';
  const branchName = user?.branch_name || currentBranch;

  const metrics = useMemo(() => {
    let todayOmset = 0;
    let todayTrxCount = 0;
    let todayCash = 0;
    let todayAR = 0;
    
    let totalPiutangCabang = 0;
    let hutangCabang = 0;
    let stokAyamKg = 0;

    const recentOrders = [];
    const customerStats = {};

    // 1. Data Order (Omset Harian & Piutang Gantung All Time)
    (orders || []).forEach(o => {
      if (o.isDeleted || String(o.isDeleted).toUpperCase() === 'TRUE') return;
      if (String(o.branch_id).toUpperCase() !== currentBranch.toUpperCase()) return;

      const netTotal = Number(o.total || 0) - Number(o.fee_amount || 0) - Number(o.marketplace_promo || 0);

      // Metrik Hari Ini
      if (o.date === todayStr) {
        todayOmset += netTotal;
        todayTrxCount += 1;
        if (o.paymentMethod === 'MARKETPLACE_AR') {
          todayAR += netTotal;
        } else {
          todayCash += netTotal;
        }

        const cName = o.customer_name || 'Pelanggan Anonim';
        if (!customerStats[cName]) customerStats[cName] = 0;
        customerStats[cName] += netTotal;
      }

      // Hitung Piutang Mengambang Cabang
      if (o.paymentMethod === 'PIUTANG' || o.paymentMethod === 'MARKETPLACE_AR') {
        totalPiutangCabang += netTotal;
      }

      recentOrders.push(o);
    });

    // Kurangi Piutang Cabang jika ada pelunasan
    (cashflow_transactions || []).forEach(tx => {
      if (tx.isDeleted || String(tx.isDeleted).toUpperCase() === 'TRUE') return;
      if (String(tx.branch_id).toUpperCase() !== currentBranch.toUpperCase()) return;
      if (tx.category === 'AR_COLLECTION' || tx.category === 'PELUNASAN_PIUTANG') {
        totalPiutangCabang -= Number(tx.amount || 0);
      }
    });

    // 2. Hitung Hutang Lokal Cabang
    (supplier_ledger || []).forEach(l => {
      if (l.isDeleted || String(l.isDeleted).toUpperCase() === 'TRUE') return;
      if (String(l.branch_id).toUpperCase() !== currentBranch.toUpperCase()) return;
      if (l.transaction_type === 'PURCHASE') hutangCabang += Number(l.amount || 0);
      if (l.transaction_type === 'PAYMENT') hutangCabang -= Number(l.amount || 0);
    });

    recentOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
    const topCustomers = Object.entries(customerStats)
      .map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 5);

    // 3. Stok Barang Cabang
    let stockDimsum = 0;
    (inventory_cost_layers || []).forEach(l => {
      if (l.isDeleted || String(l.isDeleted).toUpperCase() === 'TRUE' || l.status !== 'ACTIVE') return;
      if (String(l.branch_id).toUpperCase() === currentBranch.toUpperCase()) {
        if (l.item_name === 'DIMSUM') stockDimsum += Number(l.qty_remaining || 0);
        if (l.item_name === 'AYAM') stokAyamKg += Number(l.qty_remaining || 0);
      }
    });

    const stockMika = Math.floor(stockDimsum / 50);
    const stockPorsi = Math.floor(stockDimsum / 4);

    return { 
      todayOmset, todayTrxCount, todayCash, todayAR, recentOrders: recentOrders.slice(0, 8), 
      topCustomers, stockDimsum, stockMika, stockPorsi,
      totalPiutangCabang, hutangCabang, stokAyamKg
    };
  }, [orders, currentBranch, todayStr, inventory_cost_layers, supplier_ledger, cashflow_transactions]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* HEADER HERO SECTION */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex items-center gap-4 w-full">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
            <Store size={32} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-wide">{branchName}</h2>
            <p className="text-xs font-bold text-blue-400 mt-1 uppercase tracking-widest flex items-center gap-2">
              <Activity size={14} /> Node Operasional Aktif
            </p>
          </div>
        </div>
        <div className="relative z-10 bg-slate-800/80 border border-slate-700 px-6 py-3 rounded-2xl shrink-0 w-full md:w-auto text-center md:text-right backdrop-blur-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tanggal Operasional</div>
          <div className="text-sm font-bold text-white uppercase">{formatDate(todayStr)}</div>
        </div>
      </div>

      {/* RADAR FOLLOW-UP CABANG */}
      <div className="bg-white rounded-3xl p-1 shadow-sm border border-slate-200">
        <div className="bg-slate-50 rounded-2xl p-4 flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 w-full lg:w-auto border-b lg:border-b-0 lg:border-r border-slate-200 pb-4 lg:pb-0 lg:pr-6">
            <div className="bg-orange-100 text-orange-600 p-2.5 rounded-xl"><AlertCircle size={20} /></div>
            <div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Radar Follow-Up</div>
              <div className="text-sm font-black text-slate-800">Status Node</div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full lg:flex-1">
            <div className={`p-4 rounded-xl border flex items-center justify-between ${metrics.totalPiutangCabang > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
              <div>
                <div className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-1"><HandCoins size={12}/> Piutang Lokal</div>
                <div className={`text-xl font-black ${metrics.totalPiutangCabang > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{formatRp(metrics.totalPiutangCabang)}</div>
              </div>
            </div>
            <div className={`p-4 rounded-xl border flex items-center justify-between ${metrics.hutangCabang > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
              <div>
                <div className="text-[9px] font-black text-rose-600 uppercase tracking-widest mb-1 flex items-center gap-1"><AlertTriangle size={12}/> Hutang Operasional</div>
                <div className={`text-xl font-black ${metrics.hutangCabang > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{formatRp(metrics.hutangCabang)}</div>
              </div>
            </div>
            <div className={`p-4 rounded-xl border flex items-center justify-between ${metrics.stokAyamKg < 30 ? 'bg-rose-50 border-rose-200 animate-pulse' : 'bg-emerald-50 border-emerald-200'}`}>
              <div>
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Beef size={12}/> Daging Ayam (Gudang)</div>
                <div className={`text-xl font-black ${metrics.stokAyamKg < 30 ? 'text-rose-600' : 'text-emerald-600'}`}>{metrics.stokAyamKg} <span className="text-xs font-bold opacity-70">KG</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* METRIK KARTU UTAMA HARI INI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 text-emerald-50 opacity-50"><TrendingUp size={100}/></div>
          <div className="relative z-10">
            <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest mb-2 flex items-center gap-2"><TrendingUp size={16} className="text-emerald-500" /> Omset Hari Ini</h4>
            <div className="text-3xl md:text-4xl font-black text-slate-900 my-2">{formatRp(metrics.todayOmset)}</div>
            <div className="flex gap-4 mt-4 pt-4 border-t border-slate-100">
              <div><div className="text-[9px] font-bold text-slate-400 uppercase">Tunai / QRIS</div><div className="text-sm font-black text-emerald-600">{formatRp(metrics.todayCash)}</div></div>
              <div><div className="text-[9px] font-bold text-slate-400 uppercase">Aplikasi</div><div className="text-sm font-black text-orange-500">{formatRp(metrics.todayAR)}</div></div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest mb-2 flex items-center gap-2"><ShoppingBag size={16} className="text-blue-500" /> Total Transaksi</h4>
          <div className="text-3xl md:text-4xl font-black text-slate-900 my-2">{metrics.todayTrxCount} <span className="text-sm text-slate-400 font-bold">Nota</span></div>
          <div className="text-[10px] font-bold text-slate-500 mt-4 pt-4 border-t border-slate-100 flex items-center gap-1"><Clock size={12}/> Update realtime hari ini</div>
        </div>

        {/* KARTU STOK DENGAN KONVERSI OTOMATIS */}
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <h4 className="font-black text-white text-xs uppercase tracking-widest mb-2 flex items-center gap-2"><Package size={16} className="text-indigo-400" /> Sisa Stok Dimsum</h4>
            <div className="text-3xl md:text-4xl font-black text-indigo-400 my-2">{metrics.stockDimsum.toLocaleString('id-ID')} <span className="text-sm text-slate-400 font-bold">Pcs</span></div>
            
            <div className="flex flex-wrap gap-2 mt-3">
               <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black px-2 py-1 rounded uppercase border border-indigo-500/30">Setara {metrics.stockMika.toLocaleString('id-ID')} Mika</span>
               <span className="bg-purple-500/20 text-purple-300 text-[10px] font-black px-2 py-1 rounded uppercase border border-purple-500/30">Setara {metrics.stockPorsi.toLocaleString('id-ID')} Porsi</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PANEL KIRI: TRANSAKSI TERBARU */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
            <h4 className="font-black text-slate-800 tracking-widest uppercase text-xs flex items-center gap-2"><Receipt size={16} className="text-blue-600"/> Histori Transaksi Terbaru</h4>
          </div>
          <div className="overflow-x-auto flex-1 p-2">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <tr><th className="px-6 py-4">Waktu & Ref</th><th className="px-6 py-4">Pelanggan</th><th className="px-6 py-4 text-center">Volume</th><th className="px-6 py-4 text-right">Net Revenue</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold">
                {metrics.recentOrders.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-10 text-slate-400">Belum ada transaksi tercatat.</td></tr>
                ) : (
                  metrics.recentOrders.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4"><div className="text-slate-800">{formatDate(tx.date)}</div><div className="text-[9px] text-slate-400 font-mono mt-0.5">{tx.invoice_no || tx.id}</div></td>
                      <td className="px-6 py-4"><div className="text-slate-800 uppercase font-black">{tx.customer_name}</div><div className="text-[9px] text-blue-600 bg-blue-50 w-max px-1.5 py-0.5 rounded mt-1 uppercase tracking-wider">{tx.source}</div></td>
                      <td className="px-6 py-4 text-center text-slate-700">{tx.qty} Pcs</td>
                      <td className="px-6 py-4 text-right text-emerald-600 font-black text-sm">{formatRp(Number(tx.total) - Number(tx.fee_amount || 0) - Number(tx.marketplace_promo || 0))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PANEL KANAN: PELANGGAN TOP & SHORTCUT */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest mb-4 flex items-center gap-2"><Users size={16} className="text-orange-500" /> Top Pelanggan Hari Ini</h4>
            {metrics.topCustomers.length === 0 ? (
               <div className="text-center py-6 text-xs text-slate-400 font-bold border-2 border-dashed border-slate-100 rounded-xl">Belum ada data pelanggan hari ini.</div>
            ) : (
              <div className="space-y-4">
                {metrics.topCustomers.map((cust, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-black flex items-center justify-center text-xs">{idx + 1}</div><div className="text-xs font-black text-slate-700 uppercase">{cust.name}</div></div>
                    <div className="text-xs font-bold text-emerald-600">{formatRp(cust.total)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
