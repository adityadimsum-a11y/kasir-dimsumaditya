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
  
  const [activeBranch, setActiveBranch] = useState(isHQ ? 'CIBINONG' : user?.branch_id);

  // --- SINKRONISASI DATABASE ---
  const realDistOrders = useMemo(() => distribution_orders_data || distribution_orders || [], [distribution_orders, distribution_orders_data]);
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const rawBranches = useMemo(() => master_branches || masterBranches || [], [master_branches, masterBranches]);

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

    realDistOrders.filter(d => !d.isDeleted && d.destination_branch_id === activeBranch && d.status === 'DITERIMA').forEach(d => {
      const key = d.item_id;
      if (!inventoryMap[key]) {
        inventoryMap[key] = { id: key, name: d.item_name, category: d.item_category, unit: d.unit, totalIn: 0, totalOut: 0, balance: 0 };
      }
      inventoryMap[key].totalIn += Number(d.qty);
      inventoryMap[key].balance += Number(d.qty);
    });

    realOrders.filter(o => !o.isDeleted && o.branch_id === activeBranch).forEach(o => {
      const soldQty = Number(o.qty || 0);
      if (inventoryMap['DIMSUM_FROZEN']) {
        inventoryMap['DIMSUM_FROZEN'].totalOut += soldQty;
        inventoryMap['DIMSUM_FROZEN'].balance -= soldQty;
      } else {
        inventoryMap['DIMSUM_FROZEN'] = { id: 'DIMSUM_FROZEN', name: 'Dimsum Frozen Core', category: 'PRODUK_JADI', unit: 'Pcs', totalIn: 0, totalOut: soldQty, balance: -soldQty };
      }
    });

    return Object.values(inventoryMap);
  }, [realDistOrders, realOrders, activeBranch]);

  // --- ACTIONS: KONFIRMASI TERIMA BARANG ---
  const handleTerimaBarang = async (item) => {
    if (!window.confirm(`Verifikasi Fisik: Apakah Anda yakin barang "${item.item_name}" (${item.qty} ${item.unit}) sudah tiba dan sesuai dengan surat jalan?`)) return;
    
    const payload = { ...item, status: 'DITERIMA', verified_date: new Date().toISOString() };
    
    if (await sendToSheet('update', payload, 'distribution_orders')) {
      showToast('Verifikasi sukses! Stok barang otomatis masuk ke inventaris cabang.', 'success');
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      
      {/* HEADER & FILTER CABANG - FLAT STYLE */}
      <div className="card-holo p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden bg-white">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>
        <div className="pl-2">
          <h2 className="text-base font-extrabold normal-case flex items-center gap-2 text-slate-900">
            <Database className="text-blue-600" size={20}/> Logistik freezer &amp; inventaris cabang
          </h2>
          <p className="text-[10px] font-semibold text-slate-400 mt-1 normal-case tracking-wide">
            Pusat penerimaan logistik dan pemantauan stok fisik di area outlet atau dapur cabang.
          </p>
        </div>

        {isHQ && (
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 shadow-xs w-full md:w-auto mt-4 md:mt-0">
            <Filter size={14} className="text-slate-400"/>
            <span className="text-[10px] font-bold text-slate-500 normal-case">Radar cabang:</span>
            <select value={activeBranch} onChange={e => setActiveBranch(e.target.value)} className="bg-transparent text-xs font-extrabold normal-case text-blue-700 outline-none cursor-pointer">
              {outletBranches.length === 0 && <option value="CIBINONG">🏪 Resto Cibinong</option>}
              {outletBranches.map(b => (
                <option key={b.branch_id} value={b.branch_id}>
                  {b.branch_type === 'PRODUCTION_BRANCH' ? '🏭' : '🏪'} {b.branch_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PANEL KIRI: SURAT JALAN IN-TRANSIT */}
        <div className="card-holo flex flex-col overflow-hidden h-max border-t-4 border-t-amber-500">
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h3 className="font-extrabold text-xs normal-case text-slate-800 flex items-center gap-2">
              <Truck size={16} className="text-amber-500"/> Verifikasi surat jalan
            </h3>
            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold px-2 py-1 rounded-md normal-case shadow-xs">
              {inTransitOrders.length} Kiriman
            </span>
          </div>

          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar bg-white">
            {inTransitOrders.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Truck size={36} className="mx-auto mb-2 opacity-20"/>
                <div className="text-xs font-bold normal-case">Tidak ada kiriman OTR</div>
                <div className="text-[10px] mt-1 font-medium">Semua logistik sudah diterima.</div>
              </div>
            ) : (
              inTransitOrders.map(order => (
                <div key={order.id} className="bg-white border border-slate-200 p-4 rounded-xl relative overflow-hidden group shadow-xs hover:border-amber-300 transition-colors">
                  <div className="absolute top-0 right-0 bg-amber-50 text-amber-600 text-[8px] font-bold px-2.5 py-1 rounded-bl-lg normal-case border-b border-l border-amber-100">
                    Menunggu verifikasi
                  </div>
                  
                  <div className="text-[10px] text-slate-400 font-bold mb-1">{formatDate(order.date)} • {order.id}</div>
                  <div className="text-xs font-extrabold text-slate-800 normal-case line-clamp-1">{order.item_name}</div>
                  <div className="text-lg font-black text-blue-600 mt-1 mb-3">{formatNumber(order.qty)} <span className="text-[10px] font-bold text-blue-400 normal-case">{order.unit}</span></div>
                  
                  <div className="flex flex-col gap-1.5 text-[9px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mb-4 font-semibold normal-case">
                    <div className="flex justify-between"><span>Kategori:</span> <span className="text-slate-700 font-bold">{order.item_category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</span></div>
                    <div className="flex justify-between"><span>Supir/Kurir:</span> <span className="text-slate-700 font-bold">{order.driver_name}</span></div>
                    <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-0.5"><span>Memo:</span> <span className="text-slate-700 font-bold text-right line-clamp-1">{order.notes || '-'}</span></div>
                  </div>

                  <button onClick={() => handleTerimaBarang(order)} className="w-full bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 hover:border-emerald-600 font-bold text-[10px] normal-case py-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs">
                    <CheckSquare size={14}/> Konfirmasi terima fisik
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PANEL KANAN: TABEL RADAR STOK FISIK CABANG */}
        <div className="lg:col-span-2 card-holo flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h4 className="font-extrabold text-xs normal-case text-slate-800 flex items-center gap-2">
              <Package size={16} className="text-emerald-500"/> Sisa stok fisik outlet terkini
            </h4>
          </div>

          <div className="overflow-x-auto flex-1 p-1 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-[10px] normal-case text-slate-400 bg-white border-b border-slate-200 sticky top-0 shadow-xs">
                <tr>
                  <th className="px-5 py-3 font-bold">Barang &amp; Kategori</th>
                  <th className="px-5 py-3 font-bold text-center">Total terima</th>
                  <th className="px-5 py-3 font-bold text-center">Terjual / Dipakai</th>
                  <th className="px-5 py-3 font-bold text-right">Sisa fisik tersedia</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-100 bg-white">
                {branchInventory.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-20 text-slate-400 bg-white">
                      <Database size={36} className="mx-auto mb-3 opacity-20"/>
                      <div className="font-bold normal-case text-sm">Gudang kosong</div>
                      <div className="text-[10px] mt-1 font-medium">Belum ada riwayat penerimaan barang dari Pusat.</div>
                    </td>
                  </tr>
                ) : (
                  branchInventory.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-extrabold text-slate-800 normal-case text-xs mb-1">{item.name}</div>
                        <span className={`text-[9px] font-bold normal-case px-2 py-0.5 rounded-md border ${item.category === 'PRODUK_JADI' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {item.category.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap text-slate-700">
                        <div className="flex justify-center items-center gap-1.5 font-extrabold text-blue-600">
                          <ArrowDownToLine size={12} className="text-blue-500"/> {formatNumber(item.totalIn)} <span className="text-[9px] text-blue-400 font-bold normal-case">{item.unit}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap text-slate-700">
                        <div className="flex justify-center items-center gap-1.5 font-extrabold text-red-600">
                          <ArrowUpRight size={12} className="text-red-500"/> {formatNumber(item.totalOut)} <span className="text-[9px] text-red-400 font-bold normal-case">{item.unit}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className={`font-black text-lg flex justify-end items-center gap-1.5 ${item.balance <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {formatNumber(item.balance)} <span className="text-[10px] opacity-70 font-bold normal-case">{item.unit}</span>
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
