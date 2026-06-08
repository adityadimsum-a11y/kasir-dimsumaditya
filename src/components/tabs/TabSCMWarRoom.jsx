import React, { useMemo } from 'react';
import { Package, Truck, AlertTriangle, ShieldAlert, Timer, Box, FileWarning } from 'lucide-react';
import { formatRp, getTodayStr, getLocalYMD } from '../../utils/helpers';

export default function TabSCMWarRoom({ distributionOrders, inventoryCostLayers, discrepancyLogs, masterBranches }) {
  const todayStr = getTodayStr();

  const scmStats = useMemo(() => {
    // 1. IN TRANSIT INVENTORY
    let frozenInTransit = 0;
    let activeTransitDOs = [];
    (distributionOrders || []).forEach(doItem => {
      if (doItem.status === 'IN_TRANSIT' || doItem.status === 'DIKIRIM') {
        frozenInTransit += Number(doItem.qty);
        activeTransitDOs.push(doItem);
      }
    });

    // 2. FROZEN AGING & EXPIRY ENGINE (FIFO LAYERS)
    let agingStockValue = 0;
    let deadStockPcs = 0;
    const agingAlerts = [];
    const today = new Date(todayStr);

    const stockPerNode = {};
    (masterBranches || []).forEach(b => {
      stockPerNode[b.branch_id] = { frozen: 0, raw: 0 };
    });

    (inventoryCostLayers || []).forEach(layer => {
      if (layer.status !== 'ACTIVE' || layer.isDeleted) return;
      const bId = String(layer.branch_id).toUpperCase();
      const qty = Number(layer.qty_remaining);
      const isDimsum = String(layer.item_name).toUpperCase().includes('DIMSUM');

      if (!stockPerNode[bId]) stockPerNode[bId] = { frozen: 0, raw: 0 };
      if (isDimsum) stockPerNode[bId].frozen += qty;
      if (String(layer.item_name).toUpperCase() === 'AYAM') stockPerNode[bId].raw += qty;

      if (isDimsum) {
        const receivedDate = new Date(layer.received_date || layer.date);
        const diffTime = Math.abs(today - receivedDate);
        const agingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (agingDays >= 60) {
          deadStockPcs += qty;
          agingStockValue += (qty * Number(layer.unit_cost));
          agingAlerts.push({ branch: bId, id: layer.id, days: agingDays, qty: qty });
        }
      }
    });

    // 3. REORDER ALERT ENGINE
    const CRITICAL_FROZEN_THRESHOLD = 2000;
    const reorderAlerts = [];
    Object.keys(stockPerNode).forEach(node => {
      if (stockPerNode[node].frozen < CRITICAL_FROZEN_THRESHOLD) {
        reorderAlerts.push({ node, type: 'CRITICAL', qty: stockPerNode[node].frozen });
      }
    });

    // 4. SHIPMENT DISCREPANCY RATE
    let totalShipments = 0;
    let discrepancyShipments = 0;
    (distributionOrders || []).forEach(doItem => {
      totalShipments++;
      if (doItem.status === 'DISCREPANCY') discrepancyShipments++;
    });
    const discrepancyRate = totalShipments > 0 ? ((discrepancyShipments / totalShipments) * 100).toFixed(1) : 0;

    return {
      frozenInTransit, activeTransitDOs,
      deadStockPcs, agingStockValue, agingAlerts,
      reorderAlerts, stockPerNode, discrepancyRate
    };
  }, [distributionOrders, inventoryCostLayers, masterBranches, todayStr]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* SCM HEADER STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 rounded-2xl p-6 border shadow-xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Truck size={80}/></div>
          <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Transit Inventory (Moving)</div>
          <div className="text-4xl font-black">{scmStats.frozenInTransit.toLocaleString('id-ID')} <span className="text-sm">PCS</span></div>
          <div className="text-[10px] text-slate-400 mt-2">Sedang dalam perjalanan ekspedisi ke cabang</div>
        </div>

        <div className="bg-white rounded-2xl p-6 border shadow-sm border-l-4 border-l-orange-500">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Frozen Aging Warning (>60 Hari)</div>
          <div className="text-3xl font-black text-orange-600 mt-1">{scmStats.deadStockPcs.toLocaleString('id-ID')} <span className="text-sm">PCS</span></div>
          <div className="text-[10px] font-bold text-slate-400 mt-2">Valuasi Terancam: {formatRp(scmStats.agingStockValue)}</div>
        </div>

        <div className="bg-white rounded-2xl p-6 border shadow-sm border-l-4 border-l-red-500">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shipment Discrepancy Rate</div>
          <div className="text-3xl font-black text-red-600 mt-1">{scmStats.discrepancyRate}%</div>
          <div className="text-[10px] font-bold text-slate-400 mt-2">Tingkat kerusakan/kehilangan logistik</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ACTIVE TRANSIT SHIPMENTS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-black text-slate-800 text-sm tracking-wide uppercase flex items-center gap-2 mb-4"><Timer size={18} className="text-blue-600"/> Active Shipments (In Transit)</h3>
          {scmStats.activeTransitDOs.length === 0 ? (
            <div className="text-xs text-center text-slate-400 py-4">Tidak ada armada logistik yang sedang jalan.</div>
          ) : (
            <div className="space-y-3">
              {scmStats.activeTransitDOs.map(doItem => (
                <div key={doItem.id} className="flex justify-between items-center bg-blue-50 border border-blue-100 p-3 rounded-xl">
                  <div>
                    <div className="text-[10px] font-bold text-blue-500 mb-1">{doItem.source_branch} ➔ {doItem.destination_branch}</div>
                    <div className="font-black text-slate-800">{doItem.qty} PCS</div>
                  </div>
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold animate-pulse">MOVING</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* REORDER ALERTS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-black text-slate-800 text-sm tracking-wide uppercase flex items-center gap-2 mb-4"><AlertTriangle size={18} className="text-red-600"/> Reorder & Low Stock Alerts</h3>
          {scmStats.reorderAlerts.length === 0 ? (
            <div className="text-xs font-bold text-emerald-600 bg-emerald-50 p-3 rounded-xl">Stok di seluruh Node aman (di atas batas kritis).</div>
          ) : (
            <div className="space-y-3">
              {scmStats.reorderAlerts.map(alert => (
                <div key={alert.node} className="flex justify-between items-center bg-red-50 border border-red-100 p-3 rounded-xl">
                  <div>
                    <div className="text-[10px] font-bold text-red-500 mb-1">NODE: {alert.node}</div>
                    <div className="font-black text-slate-800 text-xs">Sisa Freezer: {alert.qty} PCS</div>
                  </div>
                  <span className="bg-red-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold">RESTOCK REQUIRED</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* EXPIRY & AGING MONITORING */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
          <h3 className="font-black text-slate-800 text-sm tracking-wide uppercase flex items-center gap-2 mb-4"><FileWarning size={18} className="text-orange-600"/> Frozen Expiry Risk (Dead Stock > 60 Hari)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase">
                <tr><th className="px-3 py-2">Node Lokasi</th><th className="px-3 py-2">Layer Cost ID</th><th className="px-3 py-2 text-center">Umur Simpan (Hari)</th><th className="px-3 py-2 text-right">Kuantitas Terdampak</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-xs text-slate-700">
                {scmStats.agingAlerts.length === 0 ? <tr><td colSpan="4" className="text-center py-4 text-emerald-600">Tidak ada dead stock yang terdeteksi.</td></tr> : 
                  scmStats.agingAlerts.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 uppercase">{a.branch}</td>
                      <td className="px-3 py-2.5 text-slate-500">{a.id}</td>
                      <td className="px-3 py-2.5 text-center text-red-600">{a.days} Hari</td>
                      <td className="px-3 py-2.5 text-right">{a.qty} PCS</td>
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
