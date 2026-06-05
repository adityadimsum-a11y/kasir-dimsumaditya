import React, { useState } from 'react';
import { Send, Truck, Clock, CheckCircle, PackageOpen, Zap } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabDistribusi({ distributionOrders, stockMovements, masterBranches, sendToSheet }) {
  const todayStr = getTodayStr();
  const [date, setDate] = useState(todayStr);
  const [toBranch, setToBranch] = useState('');
  const [qtyPcs, setQtyPcs] = useState('');

  const activeBranches = (masterBranches || []).filter(b => b.branch_id !== 'PUSAT');

  const handleKirimDO = (e) => {
      e.preventDefault();
      const doId = generateId('DO', date);
      
      // STATUS AWAL: PACKING
      const doData = { id: doId, date: date, from_branch: 'PUSAT', to_branch: toBranch, item_name: 'DIMSUM FROZEN', qty: Number(qtyPcs), status: 'PACKING' };

      // MOVEMENT: RESERVE INVENTORY
      const moveOutPusat = { id: generateId('MOV-RES', date), date: date, item_name: 'DIMSUM', from_location: 'FREEZER_PUSAT', to_location: 'RESERVED_DELIVERY', qty: Number(qtyPcs), unit: 'PCS', movement_type: 'RESERVATION', branch_id: 'PUSAT', reference_id: doId };

      sendToSheet('insert', doData, 'distribution_orders');
      sendToSheet('insert', moveOutPusat, 'stock_movements');
      
      setQtyPcs(''); setToBranch('');
      alert('DO Masuk Antrean PACKING! Stok Freezer Pusat telah di-RESERVE (dikunci).');
  };

  const handleUbahStatus = (doItem, newStatus) => {
      sendToSheet('update', { id: doItem.id, status: newStatus }, 'distribution_orders');
  };

  const listDO = (distributionOrders || []).sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* FORM PENGIRIMAN DO MANUAL */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6 border-b pb-4">
              <div className="bg-blue-100 text-blue-700 p-2 rounded-lg"><Send size={20}/></div>
              <div><h3 className="font-black text-slate-800 text-lg uppercase tracking-wide">Delivery Order (Manual)</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Barang akan masuk status PACKING & stok di-Reserve</p></div>
          </div>
          
          <form onSubmit={handleKirimDO} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Tgl Pengiriman</label><input type="date" required value={date} onChange={e=>setDate(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Cabang Tujuan</label>
                  <select required value={toBranch} onChange={e=>setToBranch(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm text-slate-800">
                      <option value="">-- Pilih Cabang --</option>
                      {activeBranches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name} ({b.branch_type})</option> )}
                  </select>
              </div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Jumlah Kirim (PCS)</label>
                  <div className="relative"><input type="number" required placeholder="0" value={qtyPcs} onChange={e=>setQtyPcs(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-xl font-black text-blue-700 text-sm pr-10" /><span className="absolute right-3 top-3 text-xs font-bold text-blue-400">Pcs</span></div>
              </div>
              
              <div className="md:col-span-3 mt-2">
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-md transition flex justify-center items-center gap-2"><PackageOpen size={18}/> Submit DO ke Tim Packing</button>
              </div>
          </form>
      </div>

      {/* STATE MACHINE: TABEL HISTORI & LIFECYCLE DO */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-6 border-t-4 border-t-slate-800">
          <div className="p-4 border-b bg-slate-50 flex items-center gap-3"><Clock size={18} className="text-slate-600"/><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Distribution Lifecycle Tracker</h4></div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-white border-b text-[10px] text-slate-500 uppercase">
                      <tr><th className="px-4 py-3">ID DO & Tgl</th><th className="px-4 py-3">Tujuan</th><th className="px-4 py-3 text-center">Qty (Pcs)</th><th className="px-4 py-3 text-center">Lifecycle Status</th><th className="px-4 py-3 text-center">Aksi Gudang</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {listDO.map(doItem => {
                          const branchName = activeBranches.find(b => b.branch_id === doItem.to_branch)?.branch_name || doItem.to_branch;
                          return (
                          <tr key={doItem.id} className="hover:bg-slate-50 transition">
                              <td className="px-4 py-3"><div className="font-mono text-[10px] font-bold text-slate-700">{doItem.id}</div><div className="text-[10px] text-slate-500">{formatDate(doItem.date)}</div></td>
                              <td className="px-4 py-3 font-black text-slate-800 uppercase">{branchName}</td>
                              <td className="px-4 py-3 text-center font-black text-blue-600">{doItem.qty}</td>
                              <td className="px-4 py-3 text-center">
                                  {doItem.status === 'PACKING' && <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded text-[9px] font-bold tracking-widest border border-slate-200">📦 PACKING</span>}
                                  {doItem.status === 'DIKIRIM' && <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded text-[9px] font-bold tracking-widest border border-orange-200 shadow-sm"><Truck size={10} className="inline mr-1"/> DI PERJALANAN</span>}
                                  {doItem.status === 'RECEIVED' && <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded text-[9px] font-bold tracking-widest border border-emerald-200 shadow-sm"><CheckCircle size={10} className="inline mr-1"/> RECEIVED (SELESAI)</span>}
                              </td>
                              <td className="px-4 py-3 text-center">
                                  {doItem.status === 'PACKING' && <button onClick={() => handleUbahStatus(doItem, 'DIKIRIM')} className="bg-indigo-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-700 shadow-sm flex items-center justify-center gap-1 mx-auto"><Zap size={12}/> Kirim Truk</button>}
                                  {doItem.status !== 'PACKING' && <span className="text-[10px] text-slate-400 italic">Menunggu Cabang</span>}
                              </td>
                          </tr>
                      )})}
                  </tbody>
              </table>
          </div>
      </div>

    </div>
  );
}
