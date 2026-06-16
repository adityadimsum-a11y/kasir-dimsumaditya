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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 border border-slate-800 shadow-lg text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5"><Truck size={90}/></div>
          <div className="text-[11px] font-black text-blue-400 mb-1.5 flex items-center gap-1.5"><Truck size={14}/> Stok Dalam Perjalanan (Moving)</div>
          <div className="text-4xl font-black tracking-tighter">{formatNumber(scmStats.frozenInTransit)} <span className="text-sm font-bold text-blue-300">Pcs</span></div>
          <div className="text-[10px] text-slate-400 mt-2 font-medium">Total produk sedang dibawa kurir supir ekspedisi.</div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 p-4 opacity-5"><FileWarning size={90} className="text-orange-500"/></div>
          <div className="text-[11px] font-black text-orange-600 mb-1.5 flex items-center gap-1.5"><Timer size={14}/> Resiko Kadaluarsa Kulkas (&gt;60 Hari)</div>
          <div className="text-4xl font-black text-orange-600 tracking-tighter mt-1">{formatNumber(scmStats.deadStockPcs)} <span className="text-sm font-bold text-orange-400">Pcs</span></div>
          <div className="text-[10px] font-black text-orange-700 bg-orange-50 px-2.5 py-1.5 rounded-lg border border-orange-100 mt-2 inline-block">
            Valuasi Terancam Hangus: {formatRupiah(scmStats.agingStockValue)}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 p-4 opacity-5"><AlertTriangle size={90} className="text-rose-500"/></div>
          <div className="text-[11px] font-black text-rose-600 mb-1.5 flex items-center gap-1.5"><Package size={14}/> Tingkat Kerusakan Jalan</div>
          <div className="text-4xl font-black text-rose-600 tracking-tighter mt-1">{scmStats.discrepancyRate}%</div>
          <div className="text-[10px] font-bold text-slate-400 mt-2">Rasio susut produk hancur di jalan ekspedisi.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* MONITOR ARMADA AKTIF */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-full">
          <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <Timer size={18} className="text-blue-600"/> Status Armada Logistik Di Jalan (In Transit)
          </h3>
          {scmStats.activeTransitDOs.length === 0 ? (
            <div className="text-xs text-center text-slate-400 py-16 font-bold bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 flex-1 flex flex-col justify-center">
              <div className="mx-auto mb-3 opacity-30"><Truck size={40}/></div>
              Semua armada sudah merapat.<br/>Tidak ada pengiriman aktif.
            </div>
          ) : (
            <div className="space-y-3 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
              {scmStats.activeTransitDOs.map(doItem => (
                <div key={doItem.id} className="flex justify-between items-center bg-slate-50 border border-slate-200 p-4 rounded-2xl group hover:border-blue-300 hover:bg-blue-50/30 transition-colors shadow-sm">
                  <div>
                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-1">ID: {doItem.id}</div>
                    <div className="font-black text-slate-800 text-sm uppercase">{doItem.destination_branch_id?.replace(/_/g, ' ')}</div>
                    <div className="text-[10px] font-bold text-slate-500 mt-1">Supir Kurir: {doItem.driver_name || 'Tim Ekspedisi'}</div>
                  </div>
                  <div className="text-right">
                     <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider animate-pulse inline-block border border-blue-200">
                       ON THE ROAD
                     </span>
                     <div className="font-black text-blue-700 text-base mt-2">{formatNumber(doItem.qty)} Pcs</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ALARM BAWAH AMBASSADOR REORDER */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-full">
          <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <AlertTriangle size={18} className="text-rose-600"/> Ambang Batas Kritis Restock Cabang
          </h3>
          {scmStats.reorderAlerts.length === 0 ? (
            <div className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-center flex-1 flex flex-col justify-center shadow-sm">
              <div className="mx-auto mb-3 opacity-50"><ShieldAlert size={40}/></div>
              Stok Freezer di seluruh node cabang aman<br/>di atas kuota 11.000 Pcs.
            </div>
          ) : (
            <div className="space-y-3 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
              {scmStats.reorderAlerts.map(alert => (
                <div key={alert.node} className="flex justify-between items-center bg-rose-50/80 border border-rose-100 p-4 rounded-2xl border-l-4 border-l-rose-500 shadow-sm hover:bg-rose-50 transition-colors">
                  <div>
                    <div className="text-[10px] font-black text-rose-500 uppercase tracking-wider mb-1">Peringatan Kuota Menipis</div>
                    <div className="font-black text-slate-800 text-sm uppercase">Node: {alert.node.replace(/_/g, ' ')}</div>
                  </div>
                  <div className="text-right">
                    <span className="bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider">
                      STOK SEKARAT
                    </span>
                    <div className="font-black text-rose-700 text-base mt-2">Sisa: {formatNumber(alert.qty)} Pcs</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MONITOR UMUR SIMPAN BARANG KADALUARSA */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm lg:col-span-2 overflow-hidden flex flex-col">
          <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <FileWarning size={18} className="text-orange-600"/> Pengawasan Resiko Umur Simpan Gudang (Dead Stock &gt; 60 Hari)
          </h3>
          <div className="overflow-x-auto custom-scrollbar flex-1 p-2">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/50 text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-5 py-4 font-black">Node Lokasi Gudang</th>
                  <th className="px-5 py-4 font-black">Kode Layer FIFO ID</th>
                  <th className="px-5 py-4 font-black text-center">Umur Mengendap</th>
                  <th className="px-5 py-4 font-black text-right">Kuantitas Fisik Terancam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-xs text-slate-700 bg-white">
                {scmStats.agingAlerts.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-16 text-emerald-600 font-black text-xs">
                       <div className="mx-auto flex justify-center mb-3 opacity-30"><ShieldAlert size={40}/></div>
                       Bersih Total! Seluruh adonan &amp; dimsum di freezer segar di bawah 60 hari.
                    </td>
                  </tr>
                ) : (
                  scmStats.agingAlerts.map(a => (
                    <tr key={a.id} className="hover:bg-orange-50/30 transition-colors">
                      <td className="px-5 py-4 font-black text-slate-800 uppercase tracking-wider">
                        <span className="text-slate-400 mr-2 text-base">🏢</span> {a.branch.replace(/_/g, ' ')}
                      </td>
                      <td className="px-5 py-4 text-slate-500 font-mono text-[10px]">{a.id}</td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-orange-700 font-black bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-200 text-[10px] shadow-sm uppercase tracking-wider">
                          {a.days} Hari Membeku
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-black text-base text-rose-600 tracking-tight">
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
