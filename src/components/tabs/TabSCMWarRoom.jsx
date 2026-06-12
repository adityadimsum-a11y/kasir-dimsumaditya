import React, { useMemo } from 'react';
import { Package, Truck, AlertTriangle, ShieldAlert, Timer, Box, FileWarning } from 'lucide-react';
import { formatRp, getTodayStr } from '../../utils/helpers';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');
const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

// 🔥 REVISI NILAI MODAL DASAR DIMSUM SESUAI KITAB SUCI ADITYA CORE
const INTI_HPP_DIMSUM = 1125; 

export default function TabSCMWarRoom({ distributionOrders, inventoryCostLayers, discrepancyLogs, masterBranches }) {
  const todayStr = getTodayStr();

  const scmStats = useMemo(() => {
    // 1. STOK DALAM PERJALANAN (IN TRANSIT)
    let frozenInTransit = 0;
    let activeTransitDOs = [];
    (distributionOrders || []).forEach(doItem => {
      if (doItem.status === 'IN_TRANSIT' || doItem.status === 'DIKIRIM' || doItem.status === 'DALAM_PERJALANAN') {
        frozenInTransit += Number(doItem.qty || 0);
        activeTransitDOs.push(doItem);
      }
    });

    // 2. DETEKSI UMUR SIMPAN FROZEN (FIFO AGING ENGINE)
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
      const qty = Number(layer.qty_remaining || 0);
      const isDimsum = String(layer.item_name || '').toUpperCase().includes('DIMSUM') || String(layer.item_id || '').includes('DIMSUM');

      if (!stockPerNode[bId]) stockPerNode[bId] = { frozen: 0, raw: 0 };
      if (isDimsum) stockPerNode[bId].frozen += qty;
      if (String(layer.item_name).toUpperCase() === 'AYAM') stockPerNode[bId].raw += qty;

      if (isDimsum) {
        const receivedDate = new Date(layer.received_date || layer.date);
        const diffTime = Math.abs(today - receivedDate);
        const agingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Jika umur dimsum di freezer melebihi 60 hari
        if (agingDays >= 60) {
          deadStockPcs += qty;
          // Diikat langsung ke harga modal HPP suci Rp 1.125
          agingStockValue += (qty * INTI_HPP_DIMSUM);
          agingAlerts.push({ branch: bId, id: layer.id, days: agingDays, qty: qty });
        }
      }
    });

    // 3. 🔥 REVISI ALARM RESTOCK: AMBANG BATAS KRITIS DIANGKAT KE TARGET 1 HARI (11.000 PCS)
    const CRITICAL_FROZEN_THRESHOLD = 11000;
    const reorderAlerts = [];
    Object.keys(stockPerNode).forEach(node => {
      if (stockPerNode[node].frozen < CRITICAL_FROZEN_THRESHOLD) {
        reorderAlerts.push({ node, type: 'CRITICAL', qty: stockPerNode[node].frozen });
      }
    });

    // 4. PERSENTASE KERUSAKAN LOGISTIK JALAN
    let totalShipments = 0;
    let discrepancyShipments = 0;
    (distributionOrders || []).forEach(doItem => {
      totalShipments++;
      if (doItem.status === 'DISCREPANCY' || doItem.status === 'RUSAK') discrepancyShipments++;
    });
    const discrepancyRate = totalShipments > 0 ? ((discrepancyShipments / totalShipments) * 100).toFixed(1) : 0;

    return {
      frozenInTransit, activeTransitDOs,
      deadStockPcs, agingStockValue, agingAlerts,
      reorderAlerts, stockPerNode, discrepancyRate
    };
  }, [distributionOrders, inventoryCostLayers, masterBranches, todayStr]);

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* SCM BANNER STATS TOP */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Truck size={80}/></div>
          <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Stok Dalam Perjalanan (Moving)</div>
          <div className="text-4xl font-black">{formatNumber(scmStats.frozenInTransit)} <span className="text-sm font-medium">PCS</span></div>
          <div className="text-[10px] text-slate-400 mt-2 uppercase tracking-wide">Total produk sedang dibawa kurir supir ekspedisi</div>
        </div>

        <div className="bg-white rounded-2xl p-6 border shadow-sm border-l-4 border-l-orange-500">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resiko Kadaluarsa Kulkas (&gt;60 Hari)</div>
          <div className="text-3xl font-black text-orange-600 mt-1">{formatNumber(scmStats.deadStockPcs)} <span className="text-sm font-medium">PCS</span></div>
          <div className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100 mt-2 inline-block">Valuasi Terancam Hangus: {formatRupiah(scmStats.agingStockValue)}</div>
        </div>

        <div className="bg-white rounded-2xl p-6 border shadow-sm border-l-4 border-l-red-500">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tingkat Kerusakan Pengiriman (Discrepancy)</div>
          <div className="text-3xl font-black text-red-600 mt-1">{scmStats.discrepancyRate}%</div>
          <div className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wider">Rasio susut produk hancur di jalan</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* MONITOR ARMADA AKTIF */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-black text-slate-800 text-xs tracking-widest uppercase flex items-center gap-2 mb-4 border-b pb-3"><Timer size={18} className="text-blue-600"/> Status Armada Logistik Di Jalan (In Transit)</h3>
          {scmStats.activeTransitDOs.length === 0 ? (
            <div className="text-xs text-center text-slate-400 py-10 font-bold uppercase tracking-widest bg-slate-50 rounded-xl border border-dashed">Semua armada sudah merapat. Tidak ada pengiriman aktif.</div>
          ) : (
            <div className="space-y-3 max-h-[35vh] overflow-y-auto custom-scrollbar pr-1">
              {scmStats.activeTransitDOs.map(doItem => (
                <div key={doItem.id} className="flex justify-between items-center bg-blue-50/60 border border-blue-100 p-3 rounded-xl group hover:border-blue-300 transition-colors">
                  <div>
                    <div className="text-[10px] font-black text-blue-600 uppercase mb-1">ID: {doItem.id}</div>
                    <div className="font-black text-slate-800 text-sm uppercase">Tujuan: {doItem.destination_branch_id?.replace('_', ' ')}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase mt-1">Supir Kurir: {doItem.driver_name || 'TIM EKSPEDISI'}</div>
                  </div>
                  <div className="text-right">
                     <span className="bg-blue-600 text-white px-2.5 py-1 rounded-md text-[9px] font-black tracking-widest animate-pulse inline-block shadow-sm">ON THE ROAD</span>
                     <div className="font-black text-blue-700 text-sm mt-1.5">{formatNumber(doItem.qty)} PCS</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ALARM BAWAH AMBASSADOR REORDER */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-black text-slate-800 text-xs tracking-widest uppercase flex items-center gap-2 mb-4 border-b pb-3"><AlertTriangle size={18} className="text-red-600"/> Ambang Batas Kritis Restock Cabang</h3>
          {scmStats.reorderAlerts.length === 0 ? (
            <div className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 p-4 rounded-xl uppercase tracking-wider text-center">Stok Freezer di seluruh node cabang aman di atas kuota 11.000 Pcs.</div>
          ) : (
            <div className="space-y-3 max-h-[35vh] overflow-y-auto custom-scrollbar pr-1">
              {scmStats.reorderAlerts.map(alert => (
                <div key={alert.node} className="flex justify-between items-center bg-red-50 border border-red-100 p-3 rounded-xl border-l-4 border-l-red-500">
                  <div>
                    <div className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Peringatan Kuota Menipis</div>
                    <div className="font-black text-slate-800 text-sm uppercase">NODE CABANG: {alert.node.replace('_', ' ')}</div>
                  </div>
                  <div className="text-right">
                    <span className="bg-red-600 text-white px-2.5 py-1 rounded-md text-[9px] font-black tracking-widest shadow-sm">STOK SEKARAT</span>
                    <div className="font-black text-red-700 text-xs mt-1.5">Sisa: {formatNumber(alert.qty)} Pcs</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MONITOR UMUR SIMPAN BARANG KADALUARSA */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
          <h3 className="font-black text-slate-800 text-xs tracking-widest uppercase flex items-center gap-2 mb-4 border-b pb-3"><FileWarning size={18} className="text-orange-600"/> Pengawasan Resiko Umur Simpan Gudang (Dead Stock &gt; 60 Hari)</h3>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase border-b">
                <tr>
                  <th className="px-4 py-3 font-black">Node Lokasi Gudang</th>
                  <th className="px-4 py-3 font-black">Kode Layer FIFO ID</th>
                  <th className="px-4 py-3 font-black text-center">Umur Mengendap</th>
                  <th className="px-4 py-3 font-black text-right">Kuantitas Fisik Rusak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-xs text-slate-700">
                {scmStats.agingAlerts.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-10 text-emerald-600 font-black uppercase tracking-widest bg-slate-50/50">Bersih Total! Seluruh adonan dimsum di freezer segar dan di bawah 60 hari.</td></tr>
                ) : (
                  scmStats.agingAlerts.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5 uppercase font-black text-slate-800">🏢 {a.branch.replace('_', ' ')}</td>
                      <td className="px-4 py-3.5 text-slate-400 font-mono">{a.id}</td>
                      <td className="px-4 py-3.5 text-center text-red-600 font-black tracking-wide bg-red-50/20">{a.days} Hari Membeku</td>
                      <td className="px-4 py-3.5 text-right font-black text-sm text-rose-600">{formatNumber(a.qty)} PCS</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
