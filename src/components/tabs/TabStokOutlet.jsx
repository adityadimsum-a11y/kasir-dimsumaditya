import React, { useState, useMemo } from 'react';
import { Package, Download, Plus, CheckCircle, Store, Layers, Truck, ArrowRight } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabStokOutlet({ distributionOrders, stockMovements, sendToSheet, showToast, user }) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'OUTLET_1';

  // =====================================
  // STATE FORMS
  // =====================================
  const [formMenuLokal, setFormMenuLokal] = useState({ item_name: '', initial_qty: '', selling_price: '' });

  // =====================================
  // CALCULATE LIVE OUTLET STOCK
  // =====================================
  const outletStock = useMemo(() => {
      const stock = {};
      (stockMovements || []).forEach(m => {
          if (m.isDeleted || String(m.branch_id).toUpperCase() !== currentBranch.toUpperCase()) return;
          
          const item = m.item_name.toUpperCase();
          if (!stock[item]) stock[item] = 0;

          // Mutasi Tambah atau Kurang Stok Lokal Toko
          if (['PRODUCTION_RESULT', 'SALE_RETURN', 'INVENTORY_IN', 'DISTRIBUTION_RECEIPT'].includes(m.movement_type) || m.to_location.includes('FREEZER')) {
              stock[item] += Number(m.qty) || 0;
          } else if (['SALE', 'WASTE', 'INVENTORY_OUT', 'DISTRIBUTION_USAGE'].includes(m.movement_type) || m.from_location.includes('FREEZER')) {
              stock[item] -= Number(m.qty) || 0;
          }
      });
      return stock;
  }, [stockMovements, currentBranch]);

  // =====================================
  // FILTER SURAT JALAN MASUK (IN TRANSIT)
  // =====================================
  const incomingDOs = useMemo(() => {
      return (distributionOrders || []).filter(d => 
          !d.isDeleted && 
          String(d.to_branch).toUpperCase() === currentBranch.toUpperCase() &&
          (d.status === 'IN_TRANSIT' || d.status === 'DIKIRIM')
      );
  }, [distributionOrders, currentBranch]);

  // =====================================
  // HANDLERS
  // =====================================
  const handleCurrencyChange = (field, value) => {
      const rawValue = value.replace(/\D/g, ''); 
      setFormMenuLokal(prev => ({ ...prev, [field]: rawValue }));
  };

  const handleTerimaBarang = async (doItem) => {
      const confirmAction = window.confirm(`Konfirmasi penerimaan ${Number(doItem.qty).toLocaleString('id-ID')} Pcs Dimsum dari Pusat?`);
      if (!confirmAction) return;

      // 1. Kirim mutasi penambahan stok lokal ke database
      const movementPayload = {
          id: generateId('MOV-REC', todayStr),
          date: todayStr,
          item_name: doItem.item_name || 'DIMSUM',
          from_location: 'EXPEDISI',
          to_location: `${currentBranch}_FREEZER`,
          qty: Number(doItem.qty),
          unit: 'PCS',
          movement_type: 'DISTRIBUTION_RECEIPT',
          branch_id: currentBranch,
          reference_id: doItem.id
      };

      // 2. Update status DO menjadi RECEIVED di backend
      const updatedDo = { ...doItem, status: 'RECEIVED' };

      const successMove = await sendToSheet('insert', movementPayload, 'stock_movements');
      if (successMove) {
          await sendToSheet('update', updatedDo, 'distribution_orders');
          showToast('✅ Stok berhasil dimasukkan ke freezer toko.', 'success');
      }
  };

  const handleSimpanMenuLokal = async (e) => {
      e.preventDefault();
      if(Number(formMenuLokal.initial_qty) < 0) return;

      const itemId = generateId('LCL', new Date());
      
      // Catat sebagai saldo awal inventaris produk lokal toko
      const payloadStock = {
          id: generateId('MOV-LCL', todayStr),
          date: todayStr,
          item_name: formMenuLokal.item_name.toUpperCase(),
          from_location: 'SALDO_AWAL',
          to_location: `${currentBranch}_GUDANG`,
          qty: Number(formMenuLokal.initial_qty),
          unit: 'PCS',
          movement_type: 'INVENTORY_IN',
          branch_id: currentBranch,
          reference_id: itemId
      };

      const success = await sendToSheet('insert', payloadStock, 'stock_movements');
      if (success) {
          // Daftarkan ke master produk lokal (Opsional jika di-support master data)
          showToast(`✅ Menu ${formMenuLokal.item_name} berhasil didaftarkan di toko!`, 'success');
          setFormMenuLokal({ item_name: '', initial_qty: '', selling_price: '' });
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* 1. NOTIFIKASI SURAT JALAN IN-TRANSIT DARI PUSAT */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
              <h3 className="font-black text-white text-sm tracking-wide uppercase flex items-center gap-2">
                  <Truck size={18} className="text-orange-400 animate-bounce"/> Konfirmasi Surat Jalan Masuk
              </h3>
              <span className="text-[10px] bg-orange-500 text-white font-black px-2.5 py-0.5 rounded-full">{incomingDOs.length} Kiriman</span>
          </div>
          <div className="p-4 divide-y">
              {incomingDOs.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 font-bold">Tidak ada pengiriman logistik aktif menuju toko Anda saat ini.</div>
              ) : (
                  incomingDOs.map(d => (
                      <div key={d.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3 first:pt-0 last:pb-0 gap-4">
                          <div>
                              <div className="text-xs font-black text-slate-800 uppercase flex items-center gap-1">
                                  <span>{d.item_name || 'DIMSUM FROZEN'}</span> ➔ <span className="text-orange-600">{Number(d.qty).toLocaleString('id-ID')} PCS</span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-bold mt-0.5">ID Dokumen: {d.id} • Dikirim: {formatDate(d.date)}</div>
                          </div>
                          <button onClick={() => handleTerimaBarang(d)} className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-black px-4 py-2 rounded-xl uppercase tracking-wide shadow-md transition flex items-center gap-1.5 w-full sm:w-auto justify-center">
                              <Download size={14}/> Terima & Masuk Freezer
                          </button>
                      </div>
                  ))
              )}
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 2. DAFTAR SALDO STOK TOKO AKTIF */}
          <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm p-6 flex flex-col">
              <h3 className="font-black text-slate-800 text-sm tracking-wide uppercase flex items-center gap-2 mb-4">
                  <Layers size={18} className="text-slate-500"/> Sisa Stok Freezer & Rak Toko
              </h3>
              <div className="overflow-x-auto flex-1">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase">
                          <tr>
                              <th className="px-4 py-3">Nama Varian / Menu</th>
                              <th className="px-4 py-3 text-center">Tipe / Saluran</th>
                              <th className="px-4 py-3 text-right">Volume Stok Tersedia</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                          {/* Item Utama Dari Pusat */}
                          <tr className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-slate-900 font-black uppercase">DIMSUM FROZEN CORE (PUSAT)</td>
                              <td className="px-4 py-3 text-center"><span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[9px]">Pusat Tangerang</span></td>
                              <td className="px-4 py-3 text-right font-black text-sm text-slate-800">{(outletStock['DIMSUM'] || 0).toLocaleString('id-ID')} Pcs</td>
                          </tr>
                          {/* Render Menu Lokal jika ada */}
                          {Object.keys(outletStock).map(key => {
                              if (key === 'DIMSUM') return null;
                              return (
                                  <tr key={key} className="hover:bg-slate-50">
                                      <td className="px-4 py-3 text-slate-800 uppercase">{key}</td>
                                      <td className="px-4 py-3 text-center"><span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-[9px]">Menu Lokal Toko</span></td>
                                      <td className="px-4 py-3 text-right font-black text-sm text-purple-700">{(outletStock[key] || 0).toLocaleString('id-ID')} Pcs</td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>

          {/* 3. INPUT MENU AD-DON / MINUMAN LOKAL */}
          <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-orange-500 h-max">
              <div className="flex items-center gap-3 mb-4 border-b pb-3">
                  <div className="bg-orange-100 text-orange-700 p-2 rounded-lg"><Plus size={18}/></div>
                  <div>
                      <h3 className="font-black text-slate-800 text-xs uppercase tracking-wide">Registrasi Menu Lokal</h3>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Es Teh, Jeruk Peras, dll</p>
                  </div>
              </div>
              <form onSubmit={handleSimpanMenuLokal} className="space-y-4">
                  <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Nama Menu Tambahan</label>
                      <input type="text" required value={formMenuLokal.item_name} onChange={e=>setFormMenuLokal({...formMenuLokal, item_name: e.target.value.toUpperCase()})} placeholder="Cth: ES TEH MANIS JUMBO" className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-xs uppercase" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 uppercase">Stok Awal</label>
                          <input type="number" required min="0" value={formMenuLokal.initial_qty} onChange={e=>setFormMenuLokal({...formMenuLokal, initial_qty: e.target.value})} placeholder="0" className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-xs" />
                      </div>
                      {/* INPUT HARGA JUAL (LOCKED RP PREFIX) */}
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-orange-600 uppercase">Harga Jual / Cup</label>
                          <div className="relative">
                              <span className="absolute left-2.5 top-2.5 text-xs font-black text-orange-400">Rp</span>
                              <input type="text" required value={formMenuLokal.selling_price ? Number(formMenuLokal.selling_price).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange('selling_price', e.target.value)} className="w-full pl-8 pr-2 py-2.5 bg-orange-50 border border-orange-200 rounded-xl font-black text-orange-700 text-xs outline-none focus:ring-2 focus:ring-orange-500" placeholder="0" />
                          </div>
                      </div>
                  </div>
                  <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3.5 rounded-xl uppercase tracking-wider text-[10px] mt-2 transition shadow-md">
                      Daftarkan & Injeksi Stok
                  </button>
              </form>
          </div>

      </div>
    </div>
  );
}
