import React, { useMemo } from 'react';
import { TrendingUp, MapPin, ShoppingBag, DollarSign, Activity } from 'lucide-react';
import { formatRp, getLocalYMD } from '../../utils/helpers';

export default function TabAnalytics({ orders, masterBranches, discrepancyLogs }) {

  const analytics = useMemo(() => {
    // Kumpulkan data 30 hari terakhir untuk analytics
    const today = new Date();
    const last30DaysDate = new Date(today); last30DaysDate.setDate(today.getDate() - 30);
    const str30Days = last30DaysDate.toISOString().split('T')[0];

    const branchPerf = {};
    const marketplacePerf = {};
    const productVelocity = { 'DIMSUM FROZEN': 0, 'DIMSUM MATANG': 0 };

    (masterBranches || []).forEach(b => {
      branchPerf[b.branch_id] = { name: b.branch_id, type: b.branch_type, revenue: 0, hpp: 0, margin: 0, trxCount: 0, wasteLoss: 0 };
    });

    // 1. OLAH DATA PENJUALAN
    (orders || []).forEach(o => {
      if (o.isDeleted || getLocalYMD(o.date) < str30Days) return;
      const bId = String(o.branch_id || 'TANGERANG').toUpperCase();
      const channel = String(o.source).toUpperCase();
      const gross = Number(o.total) || 0;
      const hpp = Number(o.hpp_total) || 0;
      const net = Number(o.net_profit) || 0;
      const qty = Number(o.qty) || 0;
      const item = String(o.itemName).toUpperCase();

      // Branch Perf
      if (branchPerf[bId]) {
        branchPerf[bId].revenue += gross;
        branchPerf[bId].hpp += hpp;
        branchPerf[bId].margin += net;
        branchPerf[bId].trxCount += 1;
      }

      // Marketplace Perf
      if (channel !== 'OFFLINE') {
        if (!marketplacePerf[channel]) marketplacePerf[channel] = { channel, revenue: 0, fee: 0, margin: 0, qty: 0 };
        marketplacePerf[channel].revenue += gross;
        marketplacePerf[channel].fee += Number(o.fee_amount) || 0;
        marketplacePerf[channel].margin += net;
        marketplacePerf[channel].qty += qty;
      }

      // Product Velocity
      if (productVelocity[item] !== undefined) productVelocity[item] += qty;
    });

    // 2. OLAH DATA WASTE PER BRANCH
    (discrepancyLogs || []).forEach(d => {
      if (d.isDeleted || getLocalYMD(d.date) < str30Days) return;
      const bId = String(d.branch_id).toUpperCase();
      if (branchPerf[bId]) branchPerf[bId].wasteLoss += (Number(d.financial_loss) || 0);
    });

    return {
      branchList: Object.values(branchPerf).sort((a,b) => b.margin - a.margin), // Urut dari untung terbesar
      marketplaceList: Object.values(marketplacePerf).sort((a,b) => b.revenue - a.revenue),
      productVelocity
    };
  }, [orders, masterBranches, discrepancyLogs]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="bg-white p-4 rounded-xl border flex justify-between items-center shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Activity size={18}/> Executive Reporting & Analytics (30 Hari Terakhir)</h3>
        <button onClick={() => window.print()} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md hover:bg-slate-800 transition">CETAK A4 / PDF</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* BRANCH PERFORMANCE ENGINE */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b bg-slate-50 flex items-center gap-3">
            <MapPin size={20} className="text-blue-600"/>
            <div>
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Branch Health Matrix</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Siapa Cabang Paling Menguntungkan?</p>
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="bg-white border-b text-[10px] text-slate-500 uppercase">
                <tr><th className="px-4 py-3">Node</th><th className="px-4 py-3 text-right">Omzet 30H</th><th className="px-4 py-3 text-right">Waste/Loss</th><th className="px-4 py-3 text-right">Net Margin Real</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-xs">
                {analytics.branchList.map(b => {
                  const isRugi = b.margin < 0;
                  return (
                    <tr key={b.name} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="uppercase text-slate-800">{b.name}</div>
                        <div className="text-[9px] text-slate-400">{b.trxCount} Trx</div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatRp(b.revenue)}</td>
                      <td className="px-4 py-3 text-right text-red-500">-{formatRp(b.wasteLoss)}</td>
                      <td className={`px-4 py-3 text-right text-sm ${isRugi ? 'text-red-600 bg-red-50' : 'text-emerald-600'}`}>{formatRp(b.margin)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* MARKETPLACE ANALYTICS */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b bg-slate-50 flex items-center gap-3">
            <ShoppingBag size={20} className="text-orange-600"/>
            <div>
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Marketplace Performance</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Platform mana yang paling cuan?</p>
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="bg-white border-b text-[10px] text-slate-500 uppercase">
                <tr><th className="px-4 py-3">Platform</th><th className="px-4 py-3 text-center">Pcs Terjual</th><th className="px-4 py-3 text-right">Gross Sales</th><th className="px-4 py-3 text-right">Net Margin</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-xs">
                {analytics.marketplaceList.length === 0 ? <tr><td colSpan="4" className="text-center py-4 text-slate-400">Belum ada data online</td></tr> : 
                  analytics.marketplaceList.map(m => (
                    <tr key={m.channel} className="hover:bg-slate-50">
                      <td className="px-4 py-3 uppercase text-slate-800">{m.channel}</td>
                      <td className="px-4 py-3 text-center text-blue-600">{m.qty}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatRp(m.revenue)}</td>
                      <td className="px-4 py-3 text-right text-sm text-emerald-600">{formatRp(m.margin)}</td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* INVENTORY VELOCITY ENGINE */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="font-black text-slate-800 text-sm tracking-wide uppercase flex items-center gap-2 mb-1"><TrendingUp size={18} className="text-purple-600"/> Product Velocity (30 Hari)</h3>
          <p className="text-xs font-medium text-slate-500">Seberapa cepat produk Anda diserap oleh pasar.</p>
        </div>
        <div className="flex gap-6 text-right">
          <div><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dimsum Frozen</div><div className="text-2xl font-black text-slate-800">{analytics.productVelocity['DIMSUM FROZEN']} <span className="text-sm">Pcs</span></div></div>
          <div className="border-l pl-6"><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dimsum Matang</div><div className="text-2xl font-black text-slate-800">{analytics.productVelocity['DIMSUM MATANG']} <span className="text-sm">Pcs</span></div></div>
        </div>
      </div>

    </div>
  );
}
