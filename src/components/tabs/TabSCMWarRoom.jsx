import React, { useMemo } from 'react';
import { Package, Truck, AlertTriangle, ShieldAlert, Timer, Box, FileWarning } from 'lucide-react';
import { getTodayStr } from '../../utils/helpers';

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
    <div className="space-y-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-200">
      
      {/* SCM BANNER STATS TOP */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-holo bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-md text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Truck size={80}/></div>
          <div className="text-[10px] font-bold text-blue-400 normal-case mb-1">Stok Dalam Perjalanan (Moving)</div>
          <div className="text-3xl font-black tracking-tight">{formatNumber(scmStats.frozenInTransit)} <span className="text-xs font-bold text-blue-300">Pcs</span></div>
          <div className="text-[9px] text-slate-400 mt-2 normal-case">Total produk sedang dibawa kurir supir ekspedisi.</div>
        </div>

        <div className="card-holo bg-white rounded-2xl p-5 border border-slate-200 shadow-xs relative overflow-hidden border-t-4 border-t-orange-500">
          <div className="text-[10px] font-black text-slate-500 normal-case">Resiko Kadaluarsa Kulkas (&gt;60 Hari)</div>
          <div className="text-3xl font-black text-orange-600 tracking-tight mt-1">{formatNumber(scmStats.deadStockPcs)} <span className="text-xs font-bold text-orange-400">Pcs</span></div>
          <div className="text-[9px] font-bold text-orange-700 bg-orange-50 px-2 py-1 rounded-md border border-orange-100 mt-2 inline-block normal-case">
            Valuasi Terancam Hangus: {formatRupiah(scmStats.agingStockValue)}
          </div>
        </div>

        <div className="card-holo bg-white rounded-2xl p-5 border border-slate-200 shadow-xs relative overflow-hidden border-t-4 border-t-red-500">
          <div className="text-[10px] font-black text-slate-500 normal-case">Tingkat Kerusakan Jalan (Discrepancy)</div>
          <div className="text-3xl font-black text-red-600 tracking-tight mt-1">{scmStats.discrepancyRate}%</div>
          <div className="text-[9px] font-bold text-slate-400 mt-2 normal-case">Rasio susut produk hancur di jalan ekspedisi.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* MONITOR ARMADA AKTIF */}
        <div className="card-holo bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <h3 className="font-black text-slate-800 text-xs normal-case flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <Timer size={16} className="text-blue-600"/> Status Armada Logistik Di Jalan (In Transit)
          </h3>
          {scmStats.activeTransitDOs.length === 0 ? (
            <div className="text-xs text-center text-slate-400 py-12 font-bold normal-case bg-slate-50/50 rounded-xl border border-dashed border-slate-200 flex-1 flex flex-col justify-center">
              Semua armada sudah merapat. Tidak ada pengiriman aktif.
            </div>
          ) : (
            <div className="space-y-3 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
              {scmStats.activeTransitDOs.map(doItem => (
                <div key={doItem.id} className="flex justify-between items-center bg-slate-50 border border-slate-200 p-3.5 rounded-xl group hover:border-blue-300 transition-colors shadow-3xs">
                  <div>
                    <div className="text-[9px] font-black text-blue-600 normal-case mb-1">ID: {doItem.id}</div>
                    <div className="font-black text-slate-800 text-xs normal-case">Tujuan: {doItem.destination_branch_id?.replace(/_/g, ' ')}</div>
                    <div className="text-[9px] font-bold text-slate-500 normal-case mt-0.5">Supir Kurir: {doItem.driver_name || 'Tim Ekspedisi'}</div>
                  </div>
                  <div className="text-right">
                     <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-[9px] font-black normal-case animate-pulse inline-block shadow-3xs border border-blue-200">
                       ON THE ROAD
                     </span>
                     <div className="font-black text-blue-700 text-sm mt-1.5">{formatNumber(doItem.qty)} Pcs</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ALARM BAWAH AMBASSADOR REORDER */}
        <div className="card-holo bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <h3 className="font-black text-slate-800 text-xs normal-case flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <AlertTriangle size={16} className="text-red-600"/> Ambang Batas Kritis Restock Cabang
          </h3>
          {scmStats.reorderAlerts.length === 0 ? (
            <div className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 p-5 rounded-xl normal-case text-center shadow-3xs">
              Stok Freezer di seluruh node cabang aman di atas kuota 11.000 Pcs.
            </div>
          ) : (
            <div className="space-y-3 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
              {scmStats.reorderAlerts.map(alert => (
                <div key={alert.node} className="flex justify-between items-center bg-red-50/50 border border-red-100 p-3.5 rounded-xl border-l-4 border-l-red-500 shadow-3xs hover:bg-red-50 transition-colors">
                  <div>
                    <div className="text-[9px] font-black text-red-500 normal-case mb-1">Peringatan Kuota Menipis</div>
                    <div className="font-black text-slate-800 text-xs normal-case">Node: {alert.node.replace(/_/g, ' ')}</div>
                  </div>
                  <div className="text-right">
                    <span className="bg-red-100 text-red-700 border border-red-200 px-2 py-1 rounded-md text-[9px] font-black normal-case shadow-3xs">
                      STOK SEKARAT
                    </span>
                    <div className="font-black text-red-700 text-sm mt-1.5">Sisa: {formatNumber(alert.qty)} Pcs</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MONITOR UMUR SIMPAN BARANG KADALUARSA */}
        <div className="card-holo bg-white p-5 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 overflow-hidden flex flex-col">
          <h3 className="font-black text-slate-800 text-xs normal-case flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <FileWarning size={16} className="text-orange-600"/> Pengawasan Resiko Umur Simpan Gudang (Dead Stock &gt; 60 Hari)
          </h3>
          <div className="overflow-x-auto custom-scrollbar flex-1 p-1">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/50 text-[10px] text-slate-500 normal-case border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 font-black">Node Lokasi Gudang</th>
                  <th className="px-4 py-3 font-black">Kode Layer FIFO ID</th>
                  <th className="px-4 py-3 font-black text-center">Umur Mengendap</th>
                  <th className="px-4 py-3 font-black text-right">Kuantitas Fisik Rusak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-xs text-slate-700 bg-white">
                {scmStats.agingAlerts.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-12 text-emerald-600 font-black normal-case text-xs">
                      Bersih Total! Seluruh adonan &amp; dimsum di freezer segar di bawah 60 hari.
                    </td>
                  </tr>
                ) : (
                  scmStats.agingAlerts.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 normal-case font-black text-slate-800">
                        <span className="text-slate-400 mr-1">🏢</span> {a.branch.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-4 text-slate-500 font-mono text-[10px]">{a.id}</td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-red-600 font-black bg-red-50 px-2.5 py-1 rounded-md border border-red-100 text-[10px]">
                          {a.days} Hari Membeku
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-black text-sm text-rose-600">
                        {formatNumber(a.qty)} Pcs
                      </td>
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
