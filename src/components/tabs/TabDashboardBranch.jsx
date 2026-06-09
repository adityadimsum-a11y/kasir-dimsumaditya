import React, { useMemo } from 'react';
import { Store, TrendingUp, Users, ShoppingBag, Clock, Receipt, Activity, CreditCard } from 'lucide-react';
import { formatRp, getTodayStr, formatDate } from '../../utils/helpers';

export default function TabDashboardBranch({ orders, master_customers, inventory_cost_layers, user }) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'UNKNOWN_BRANCH';
  const branchName = user?.branch_name || currentBranch;

  // 1. ENGINE KALKULASI METRIK HARI INI KHUSUS CABANG INI
  const metrics = useMemo(() => {
    let todayOmset = 0;
    let todayTrxCount = 0;
    let todayCash = 0;
    let todayAR = 0;
    const recentOrders = [];
    const customerStats = {};

    (orders || []).forEach(o => {
      // Filter hanya data cabang ini dan tidak dihapus
      if (o.isDeleted || String(o.isDeleted).toUpperCase() === 'TRUE') return;
      if (String(o.branch_id).toUpperCase() !== currentBranch.toUpperCase()) return;

      // Ambil transaksi hari ini
      if (o.date === todayStr) {
        const netTotal = Number(o.total || 0) - Number(o.fee_amount || 0) - Number(o.marketplace_promo || 0);
        todayOmset += netTotal;
        todayTrxCount += 1;

        if (o.paymentMethod === 'MARKETPLACE_AR') {
          todayAR += netTotal;
        } else {
          todayCash += netTotal;
        }

        // Hitung Pelanggan Teratas
        const cName = o.customer_name || 'Pelanggan Anonim';
        if (!customerStats[cName]) customerStats[cName] = 0;
        customerStats[cName] += netTotal;
      }

      // Kumpulkan untuk list transaksi terbaru (maksimal 10)
      recentOrders.push(o);
    });

    // Urutkan transaksi dari yang terbaru
    recentOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Urutkan pelanggan top
    const topCustomers = Object.entries(customerStats)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Hitung sisa stok cabang ini (Dimsum saja sebagai patokan utama)
    let stockDimsum = 0;
    (inventory_cost_layers || []).forEach(l => {
      if (l.isDeleted || String(l.isDeleted).toUpperCase() === 'TRUE') return;
      if (String(l.branch_id).toUpperCase() === currentBranch.toUpperCase() && l.status === 'ACTIVE' && l.item_name === 'DIMSUM') {
        stockDimsum += Number(l.qty_remaining || 0);
      }
    });

    return { todayOmset, todayTrxCount, todayCash, todayAR, recentOrders: recentOrders.slice(0, 8), topCustomers, stockDimsum };
  }, [orders, currentBranch, todayStr, inventory_cost_layers]);

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
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-wide">
              {branchName}
            </h2>
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

      {/* METRIK KARTU UTAMA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 text-emerald-50 opacity-50"><TrendingUp size={100}/></div>
          <div className="relative z-10">
            <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest mb-2 flex items-center gap-2"><TrendingUp size={16} className="text-emerald-500" /> Omset Hari Ini</h4>
            <div className="text-3xl md:text-4xl font-black text-slate-900 my-2">{formatRp(metrics.todayOmset)}</div>
            <div className="flex gap-4 mt-4 pt-4 border-t border-slate-100">
              <div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">Tunai / QRIS</div>
                <div className="text-sm font-black text-emerald-600">{formatRp(metrics.todayCash)}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold text-slate-400 uppercase">Piutang Apps</div>
                <div className="text-sm font-black text-orange-500">{formatRp(metrics.todayAR)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest mb-2 flex items-center gap-2"><ShoppingBag size={16} className="text-blue-500" /> Total Transaksi</h4>
          <div className="text-3xl md:text-4xl font-black text-slate-900 my-2">{metrics.todayTrxCount} <span className="text-sm text-slate-400 font-bold">Nota</span></div>
          <div className="text-[10px] font-bold text-slate-500 mt-4 pt-4 border-t border-slate-100 flex items-center gap-1">
            <Clock size={12}/> Update realtime dari mesin kasir
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
          <h4 className="font-black text-white text-xs uppercase tracking-widest mb-2 flex items-center gap-2"><Store size={16} className="text-indigo-400" /> Sisa Stok Dimsum</h4>
          <div className="text-3xl md:text-4xl font-black text-indigo-400 my-2">{metrics.stockDimsum.toLocaleString('id-ID')} <span className="text-sm text-slate-400 font-bold">Pcs</span></div>
          <div className="text-[10px] font-bold text-slate-400 mt-4 pt-4 border-t border-slate-800 flex items-center gap-1">
            Sisa fisik tercatat di Freezer Cabang
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
                <tr>
                  <th className="px-6 py-4">Waktu & Ref</th>
                  <th className="px-6 py-4">Pelanggan</th>
                  <th className="px-6 py-4 text-center">Volume</th>
                  <th className="px-6 py-4 text-right">Net Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold">
                {metrics.recentOrders.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-10 text-slate-400">Belum ada transaksi tercatat.</td></tr>
                ) : (
                  metrics.recentOrders.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <div className="text-slate-800">{formatDate(tx.date)}</div>
                        <div className="text-[9px] text-slate-400 font-mono mt-0.5">{tx.invoice_no || tx.id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-800 uppercase font-black">{tx.customer_name}</div>
                        <div className="text-[9px] text-blue-600 bg-blue-50 w-max px-1.5 py-0.5 rounded mt-1 uppercase tracking-wider">{tx.source}</div>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-700">
                        {tx.qty} Pcs
                      </td>
                      <td className="px-6 py-4 text-right text-emerald-600 font-black text-sm">
                        {formatRp(Number(tx.total) - Number(tx.fee_amount || 0) - Number(tx.marketplace_promo || 0))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PANEL KANAN: PELANGGAN TOP & SHORTCUT */}
        <div className="lg:col-span-1 space-y-6">
          {/* Top Customers Card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest mb-4 flex items-center gap-2"><Users size={16} className="text-orange-500" /> Top Pelanggan Hari Ini</h4>
            {metrics.topCustomers.length === 0 ? (
               <div className="text-center py-6 text-xs text-slate-400 font-bold border-2 border-dashed border-slate-100 rounded-xl">Belum ada data pelanggan hari ini.</div>
            ) : (
              <div className="space-y-4">
                {metrics.topCustomers.map((cust, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-black flex items-center justify-center text-xs">{idx + 1}</div>
                      <div className="text-xs font-black text-slate-700 uppercase">{cust.name}</div>
                    </div>
                    <div className="text-xs font-bold text-emerald-600">{formatRp(cust.total)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Info Card */}
          <div className="bg-blue-50 rounded-3xl border border-blue-100 p-6">
            <h4 className="font-black text-blue-900 text-xs uppercase tracking-widest mb-2 flex items-center gap-2"><CreditCard size={16} /> Informasi Kasir</h4>
            <p className="text-xs text-blue-700 font-medium mb-4">Pastikan Anda selalu melakukan <b>Closing & Settlement</b> di penghujung hari operasional untuk menyetorkan kas ke Pusat.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
