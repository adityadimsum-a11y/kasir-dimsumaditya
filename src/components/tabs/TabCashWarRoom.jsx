import React, { useMemo, useState } from 'react';
import { Layers, ShieldAlert, AlertTriangle, TrendingUp, DollarSign, Package, Trash2, ArrowRight } from 'lucide-react';
import { formatRp, getTodayStr, getLocalYMD, formatDate } from '../../utils/helpers';

export default function TabCashWarRoom({ orders, purchases, expenses, cashflowTransactions, marketplaceSettlement, supplierLedger, masterBranches, inventoryCostLayers, discrepancyLogs }) {
  const todayStr = getTodayStr();
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);

  const profitStats = useMemo(() => {
    const isPeriod = (d) => getLocalYMD(d) >= dateFrom && getLocalYMD(d) <= dateTo;

    // --- 1. REAL-TIME INVENTORY VALUATION PER NODE ---
    const valuationMap = {
      'TANGERANG': { raw_chicken: 0, frozen_stock: 0, total: 0 },
      'PEMALANG': { raw_chicken: 0, frozen_stock: 0, total: 0 },
      'CIBINONG': { raw_chicken: 0, frozen_stock: 0, total: 0 }
    };

    (inventoryCostLayers || []).forEach(l => {
      if (l.isDeleted || l.status !== 'ACTIVE') return;
      const bId = String(l.branch_id).toUpperCase();
      const qty = Number(l.qty_remaining) || 0;
      const cost = Number(l.unit_cost) || 0;
      const item = String(l.item_name).toUpperCase();

      if (valuationMap[bId]) {
        const valValue = qty * cost;
        if (item === 'AYAM') valuationMap[bId].raw_chicken += valValue;
        if (item === 'DIMSUM' || item === 'DIMSUM FROZEN') valuationMap[bId].frozen_stock += valValue;
        valuationMap[bId].total += valValue;
      }
    });

    // --- 2. PROFITABILITY BREAKDOWN (REAL REVENUE VS REAL HPP) ---
    let consolidatedGrossRevenue = 0;
    let consolidatedRealHPP = 0;
    let consolidatedMarketplaceFee = 0;
    let consolidatedNetMargin = 0;

    const channelProfitability = {};
    const branchProfitability = {};

    (orders || []).filter(o => isPeriod(o.date) && !o.isDeleted).forEach(o => {
      const bId = String(o.branch_id || 'TANGERANG').toUpperCase();
      const channel = String(o.source).toUpperCase();
      const gross = Number(o.total) || 0;
      const hpp = Number(o.hpp_total) || 0;
      const fee = Number(o.fee_amount) || 0;
      const net = Number(o.net_profit) || (gross - hpp - fee);

      consolidatedGrossRevenue += gross;
      consolidatedRealHPP += hpp;
      consolidatedMarketplaceFee += fee;
      consolidatedNetMargin += net;

      // Group per Channel/Platform
      if (!channelProfitability[channel]) channelProfitability[channel] = { name: channel, gross: 0, hpp: 0, fee: 0, net: 0 };
      channelProfitability[channel].gross += gross;
      channelProfitability[channel].hpp += hpp;
      channelProfitability[channel].fee += fee;
      channelProfitability[channel].net += net;

      // Group per Cabang Node
      if (!branchProfitability[bId]) branchProfitability[bId] = { name: bId, gross: 0, hpp: 0, fee: 0, net: 0 };
      branchProfitability[bId].gross += gross;
      branchProfitability[bId].hpp += hpp;
      branchProfitability[bId].fee += fee;
      branchProfitability[bId].net += net;
    });

    // --- 3. PRODUCTION WASTE TRACKING FINANCIAL LOSS ---
    let totalWasteLossPeriod = 0;
    (discrepancyLogs || []).forEach(d => {
      if (isPeriod(d.date) && !d.isDeleted) {
        totalWasteLossPeriod += (Number(d.financial_loss) || 0);
      }
    });

    return {
      valuationList: Object.entries(valuationMap).map(([key, val]) => ({ branch: key, ...val })),
      channelList: Object.values(channelProfitability),
      branchProfitList: Object.values(branchProfitability),
      consolidatedGrossRevenue,
      consolidatedRealHPP,
      consolidatedMarketplaceFee,
      consolidatedNetMargin,
      totalWasteLossPeriod
    };
  }, [orders, inventoryCostLayers, discrepancyLogs, dateFrom, dateTo]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* FILTER CONTROL PANEL */}
      <div className="bg-white p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">🎯 Filter Real Costing & Profitability Engine</h3>
          <div className="flex gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-2 text-sm border rounded-lg bg-slate-50" />
            <span className="text-slate-400 self-center">s/d</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-2 text-sm border rounded-lg bg-slate-50" />
          </div>
        </div>
        <div className="text-xs bg-purple-900 text-white font-black px-4 py-2.5 rounded-lg flex items-center gap-2 tracking-wide">
          <Layers size={14} className="text-purple-300"/> SECURE FIFO PRICING ENGINE LATCHED
        </div>
      </div>

      {/* RENDER FINANSIAL UTAMA HOLDING KONSOLIDASI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-purple-950 rounded-2xl p-6 border text-white shadow-xl md:col-span-2">
          <div className="text-[10px] font-bold text-purple-300 uppercase tracking-widest mb-1">REAL CONSOLIDATED NET MARGIN (LABA BERSIH)</div>
          <div className="text-4xl font-black tracking-tight">{formatRp(profitStats.consolidatedNetMargin)}</div>
          <div className="text-[10px] text-purple-200 mt-2">Omset Kotor: {formatRp(profitStats.consolidatedGrossRevenue)} | Real HPP Terpotong (FIFO): -{formatRp(profitStats.consolidatedRealHPP)}</div>
        </div>

        <div className="bg-white rounded-2xl p-6 border shadow-sm border-l-4 border-l-emerald-500">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Platform & Merchant Fee</div>
          <div className="text-2xl font-black text-slate-800 mt-1">-{formatRp(profitStats.consolidatedMarketplaceFee)}</div>
          <div className="text-[10px] font-bold text-red-500 mt-2">Beban komisi aplikasi online</div>
        </div>

        <div className="bg-white rounded-2xl p-6 border shadow-sm border-l-4 border-l-red-500">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Production Waste Loss</div>
          <div className="text-2xl font-black text-red-600 mt-1">-{formatRp(profitStats.totalWasteLossPeriod)}</div>
          <div className="text-[10px] font-bold text-slate-400 mt-2">Kebocoran nilai aset (Reject/Basi)</div>
        </div>
      </div>

      {/* SEGMENTASI: REAL-TIME INVENTORY VALUATION PER BUSINESS NODE */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-black text-slate-800 text-sm tracking-wide uppercase flex items-center gap-2 mb-4"><Package size={18} className="text-purple-600"/> Real-Time Inventory Valuation (Asset Ledger)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {profitStats.valuationList.map(v => (
            <div key={v.branch} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Node: {v.branch}</div>
              <div className="flex justify-between text-xs text-slate-500 mb-1"><span>Ayam Mentah (Raw)</span><span>{formatRp(v.raw_chicken)}</span></div>
              <div className="flex justify-between text-xs text-slate-500 border-b pb-2"><span>Dimsum Jadi (FG)</span><span>{formatRp(v.frozen_stock)}</span></div>
              <div className="flex justify-between text-xs font-black text-slate-800 pt-2"><span>Total Nilai Aset</span><span className="text-purple-700">{formatRp(v.total)}</span></div>
            </div>
          ))}
        </div>
      </div>

      {/* KINERJA SALURAN & SEGMENTASI PROFITABILITAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* PROFITABILITAS PER NODE CABANG */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm mb-3">Profitability Per Business Node</h4>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase">
                <tr><th className="px-3 py-2">Business Node</th><th className="px-3 py-2 text-right">Omset</th><th className="px-3 py-2 text-right">Real HPP</th><th className="px-3 py-2 text-right">Net Margin</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-xs text-slate-700">
                {profitStats.branchProfitList.map(b => (
                  <tr key={b.name} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 uppercase">{b.name}</td>
                    <td className="px-3 py-2.5 text-right">{formatRp(b.gross)}</td>
                    <td className="px-3 py-2.5 text-right text-red-600">-{formatRp(b.hpp)}</td>
                    <td className={`px-3 py-2.5 text-right ${b.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatRp(b.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* PROFITABILITAS PER MARKETPLACE PLATFORM */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm mb-3">Platform & Marketplace Profitability</h4>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase">
                <tr><th className="px-3 py-2">Channel / Sumber</th><th className="px-3 py-2 text-right">Gross Sales</th><th className="px-3 py-2 text-right">Platform Fee</th><th className="px-3 py-2 text-right">Net Profit Margin</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-xs text-slate-700">
                {profitStats.channelList.map(c => (
                  <tr key={c.name} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 uppercase">{c.name}</td>
                    <td className="px-3 py-2.5 text-right">{formatRp(c.gross)}</td>
                    <td className="px-3 py-2.5 text-right text-red-500">-{formatRp(c.fee)}</td>
                    <td className={`px-3 py-2.5 text-right ${c.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatRp(c.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
