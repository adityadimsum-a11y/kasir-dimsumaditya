import React, { useState, useMemo } from 'react';
import { Package, Truck, CheckSquare, Database, Filter, ArrowDownToLine, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { formatDate, formatTime } from '../../utils/helpers';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabLogistikFreezer({ 
  distribution_orders = [], distribution_orders_data,
  orders = [], orders_data,
  masterBranches = [], master_branches, 
  sendToSheet, showToast, user 
}) {
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || !user?.branch_id;
  
  // Jika login sebagai HQ, default pantau Cibinong. Jika login sebagai admin cabang, otomatis terkunci di cabangnya sendiri.
  const [activeBranch, setActiveBranch] = useState(isHQ ? 'CIBINONG' : user?.branch_id);

  // --- SINKRONISASI DATABASE ---
  const realDistOrders = useMemo(() => distribution_orders_data || distribution_orders || [], [distribution_orders, distribution_orders_data]);
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const rawBranches = useMemo(() => master_branches || masterBranches || [], [master_branches, masterBranches]);

  // Daftar Cabang untuk Dropdown Filter (Hanya muncul jika yang login adalah HQ)
  const outletBranches = useMemo(() => {
    return rawBranches.filter(b => !b.isDeleted && b.branch_id !== 'PUSAT' && b.branch_id !== 'TANGERANG_PUSAT');
  }, [rawBranches]);

  // --- 1. DATA SURAT JALAN GANTUNG (IN-TRANSIT) ---
  const inTransitOrders = useMemo(() => {
    return realDistOrders
      .filter(d => !d.isDeleted && d.destination_branch_id === activeBranch && d.status === 'DALAM_PERJALANAN')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realDistOrders, activeBranch]);

  // --- 2. ENGINE KALKULASI STOK FISIK CABANG ---
  const branchInventory = useMemo(() => {
    const inventoryMap = {};

    // A. Tambahkan stok dari barang yang SUDAH DITERIMA dari Pusat
    realDistOrders.filter(d => !d.isDeleted && d.destination_branch_id === activeBranch && d.status === 'DITERIMA').forEach(d => {
      const key = d.item_id;
      if (!inventoryMap[key]) {
        inventoryMap[key] = { id: key, name: d.item_name, category: d.item_category, unit: d.unit, totalIn: 0, totalOut: 0, balance: 0 };
      }
      inventoryMap[key].totalIn += Number(d.qty);
      inventoryMap[key].balance += Number(d.qty);
    });

    // B. Kurangi stok dari penjualan kasir di cabang tersebut (Khusus Dimsum Frozen)
    realOrders.filter(o => !o.isDeleted && o.branch_id === activeBranch).forEach(o => {
      const soldQty = Number(o.qty || 0);
      // Asumsi dasar: Penjualan POS memotong stok 'DIMSUM_FROZEN'
      if (inventoryMap['DIMSUM_FROZEN']) {
        inventoryMap['DIMSUM_FROZEN'].totalOut += soldQty;
        inventoryMap['DIMSUM_FROZEN'].balance -= soldQty;
      } else {
        // Jika belum pernah dikirim tapi sudah ada penjualan (Kasus Minus/Anomaly)
        inventoryMap['DIMSUM_FROZEN'] = { id: 'DIMSUM_FROZEN', name: 'Dimsum Frozen Core', category: 'PRODUK_JADI', unit: 'Pcs', totalIn: 0, totalOut: soldQty, balance: -soldQty };
      }
    });

    return Object.values(inventoryMap);
  }, [realDistOrders, realOrders, activeBranch]);

  // --- ACTIONS: KONFIRMASI TERIMA BARANG ---
  const handleTerimaBarang = async (item) => {
    if (!window.confirm(`Verifikasi Fisik: Apakah Anda yakin barang "${item.item_name}" (${item.qty} ${item.unit}) sudah tiba dan sesuai dengan surat jalan?`)) return;
    
    // Update status menjadi DITERIMA agar stok resmi berpindah ke gudang cabang
    const payload = { ...item, status: 'DITERIMA', verified_date: new Date().toISOString() };
    
    if (await sendToSheet('update', payload, 'distribution_orders')) {
      showToast('Verifikasi sukses! Stok barang otomatis masuk ke inventaris cabang.', 'success');
    }
  };

  return (
    <div className="space-y-6 pb-10">
      
      {/* HEADER & FILTER CABANG */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <Database className="text-blue-600"/> Logistik Freezer &amp; Inventaris
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1">Pusat penerimaan logistik dan pemantauan stok fisik di area outlet / dapur cabang.</p>
        </div>

        {/* Jika Bos (HQ) yang buka, bisa pilih mau mantau cabang mana */}
        {isHQ && (
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-2xl border border-slate-200 shadow-inner w-full md:w-auto">
            <Filter size={14} className="text-slate-400"/>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Radar Cabang:</span>
            <select value={activeBranch} onChange={e => setActiveBranch(e.target.value)} className="bg-transparent text-xs font-black uppercase text-blue-700 outline-none cursor-pointer">
              {outletBranches.length === 0 && <option value="CIBINONG">🏪 RESTO CIBINONG</option>}
              {outletBranches.map(b => (
                <option key={b.branch_id} value={b.branch_id}>
                  {b.branch_type === 'PRODUCTION_BRANCH' ? '🏭' : '🏪'} {b.branch_name.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* PANEL KIRI (1 KOLOM): SURAT JALAN IN-TRANSIT MINTA KONFIRMASI */}
        <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-md flex flex-col overflow-hidden h-max">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
            <h3 className="font-black text-xs uppercase text-white tracking-widest flex items-center gap-2">
              <Truck size={16} className="text-amber-400"/> Verifikasi Surat Jalan
            </h3>
            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-black px-2 py-1 rounded-md uppercase">
              {inTransitOrders.length} Kiriman
            </span>
          </div>

          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {inTransitOrders.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <Truck size={32} className="mx-auto mb-2 opacity-20"/>
                <div className="text-xs font-bold uppercase tracking-wider">Tidak ada kiriman OTR</div>
                <div className="text-[10px] mt-1">Semua logistik sudah diterima.</div>
              </div>
            ) : (
              inTransitOrders.map(order => (
                <div key={order.id} className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 bg-amber-500/20 text-amber-400 text-[8px] font-black px-2 py-1 rounded-bl-lg uppercase tracking-wider">
                    Menunggu Verifikasi
                  </div>
                  
                  <div className="text-[10px] text-slate-400 font-bold mb-1">{formatDate(order.date)} • {order.id}</div>
                  <div className="text-sm font-black text-white uppercase line-clamp-1">{order.item_name}</div>
                  <div className="text-xl font-black text-blue-400 mt-1 mb-3">{formatNumber(order.qty)} <span className="text-xs text-blue-400/50">{order.unit}</span></div>
                  
                  <div className="flex flex-col gap-1.5 text-[9px] text-slate-400 bg-slate-900 p-2.5 rounded-xl border border-slate-700/50 mb-4 font-bold uppercase tracking-wider">
                    <div className="flex justify-between"><span>Kategori:</span> <span className="text-slate-300">{order.item_category}</span></div>
                    <div className="flex justify-between"><span>Supir/Kurir:</span> <span className="text-slate-300">{order.driver_name}</span></div>
                    <div className="flex justify-between border-t border-slate-800 pt-1.5 mt-0.5"><span>Memo:</span> <span className="text-slate-300 text-right line-clamp-1">{order.notes || '-'}</span></div>
                  </div>

                  <button onClick={() => handleTerimaBarang(order)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg">
                    <CheckSquare size={14}/> Konfirmasi Terima Fisik
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PANEL KANAN (2 KOLOM): TABEL RADAR STOK FISIK CABANG */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h4 className="font-black text-xs uppercase text-slate-700 tracking-widest flex items-center gap-2">
              <Package size={16} className="text-emerald-500"/> Sisa Stok Fisik Outlet Terkini
            </h4>
          </div>

          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] uppercase text-slate-400 bg-white border-b border-slate-100">
                <tr>
                  <th className="px-5 py-4 font-black">Barang &amp; Kategori</th>
                  <th className="px-5 py-4 font-black text-right">Total Terima</th>
                  <th className="px-5 py-4 font-black text-right">Terjual / Dipakai</th>
                  <th className="px-5 py-4 font-black text-right text-emerald-600">Sisa Fisik Tersedia</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-50">
                {branchInventory.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-20 text-slate-400">
                      <Database size={40} className="mx-auto mb-3 opacity-20"/>
                      <div className="font-bold uppercase tracking-wider text-sm">Gudang Kosong</div>
                      <div className="text-[10px] mt-1">Belum ada riwayat penerimaan barang dari Pusat.</div>
                    </td>
                  </tr>
                ) : (
                  branchInventory.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-black text-slate-800 uppercase text-sm mb-1">{item.name}</div>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${item.category === 'PRODUK_JADI' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {item.category.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap text-slate-600">
                        <div className="flex justify-end items-center gap-1.5 font-black">
                          <ArrowDownToLine size={12} className="text-blue-400"/> {formatNumber(item.totalIn)} <span className="text-[9px] text-slate-400 font-bold">{item.unit}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap text-slate-600">
                        <div className="flex justify-end items-center gap-1.5 font-black">
                          <ArrowUpRight size={12} className="text-rose-400"/> {formatNumber(item.totalOut)} <span className="text-[9px] text-slate-400 font-bold">{item.unit}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className={`font-black text-xl flex justify-end items-center gap-1.5 ${item.balance <= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {formatNumber(item.balance)} <span className="text-[10px] opacity-60 font-bold">{item.unit}</span>
                        </div>
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
