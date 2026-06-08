import React, { useState } from 'react';
import { Truck, CheckCircle, Clock } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabPurchases({ purchases, sendToSheet }) {
  const todayStr = getTodayStr();
  const [form, setForm] = useState({
      date: todayStr, supplier: '', itemName: 'AYAM FILLET',
      qty: '', satuan: 'KG', price: '', paidAmount: '', paymentMethod: 'TRANSFER'
  });

  // HELPER: INPUT RUPIAH OTOMATIS
  const handleCurrencyChange = (field, value) => {
      const rawValue = value.replace(/\D/g, ''); 
      setForm(prev => ({ ...prev, [field]: rawValue }));
  };

  const total = Number(form.qty) * Number(form.price);

  const handleSubmit = (e) => {
      e.preventDefault();
      const payload = {
          id: generateId('PRC', form.date), date: form.date, supplier: form.supplier.toUpperCase(),
          itemName: form.itemName.toUpperCase(), qty: Number(form.qty), satuan: form.satuan, 
          price: Number(form.price), total: total, paidAmount: Number(form.paidAmount), paymentMethod: form.paymentMethod
      };
      sendToSheet('event_purchase', payload, 'system_events');
      setForm({...form, qty: '', price: '', paidAmount: ''});
  };

  const listPurchases = (purchases || []).sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-blue-500">
          <div className="flex items-center gap-3 mb-6 border-b pb-4"><div className="bg-blue-100 text-blue-700 p-2 rounded-lg"><Truck size={20}/></div><div><h3 className="font-black text-slate-800 text-lg uppercase tracking-wide">Input Pembelian SCM</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Otomatis update stok gudang & hutang supplier</p></div></div>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Tanggal</label><input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Supplier</label><input type="text" required placeholder="Nama Supplier" value={form.supplier} onChange={e=>setForm({...form, supplier: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm uppercase" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Nama Barang</label><input type="text" required value={form.itemName} onChange={e=>setForm({...form, itemName: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm uppercase" /></div>
              
              <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Qty Masuk</label><input type="number" required placeholder="0" value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-black text-slate-700" /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Satuan</label><select value={form.satuan} onChange={e=>setForm({...form, satuan: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm"><option value="KG">KG</option><option value="PCS">PCS</option><option value="PACK">PACK</option></select></div>
              </div>

              {/* INPUT RUPIAH: HARGA SATUAN */}
              <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Harga Satuan (Rp)</label>
                  <div className="relative mt-1">
                      <span className="absolute left-3 top-2.5 font-black text-slate-400">Rp</span>
                      <input type="text" required placeholder="0" value={form.price ? Number(form.price).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange('price', e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border rounded-xl font-black text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
              </div>
              
              {/* INPUT RUPIAH: DIBAYAR HARI INI */}
              <div>
                  <label className="text-[10px] font-bold text-emerald-600 uppercase">Dibayar Hari Ini (Kas Keluar)</label>
                  <div className="relative mt-1">
                      <span className="absolute left-3 top-2.5 font-black text-emerald-600/50">Rp</span>
                      <input type="text" required placeholder="0" value={form.paidAmount ? Number(form.paidAmount).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange('paidAmount', e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
              </div>

              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Metode Bayar</label>
                  <select value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm">
                      <option value="TRANSFER">Transfer Bank</option><option value="CASH">Cash Laci</option>
                  </select>
              </div>

              <div className="md:col-span-4 bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center mt-2 shadow-inner text-white">
                  <div><div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Tagihan (Grand Total)</div><div className="text-2xl font-black">{formatRp(total)}</div></div>
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-3.5 rounded-xl shadow-md transition tracking-wide uppercase text-xs flex items-center gap-2"><CheckCircle size={16}/> Masukkan Gudang & Jurnal</button>
              </div>
          </form>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-6">
          <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Histori Pembelian Barang</h4></div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase"><tr><th className="px-4 py-3">Tgl & ID</th><th className="px-4 py-3">Supplier & Barang</th><th className="px-4 py-3 text-center">Qty Masuk</th><th className="px-4 py-3 text-right">Grand Total</th><th className="px-4 py-3 text-center">Status Hutang</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                      {listPurchases.map(p => {
                          const hutang = Number(p.total) - Number(p.paidAmount);
                          return (
                          <tr key={p.id} className="hover:bg-slate-50 transition">
                              <td className="px-4 py-3"><div className="font-bold text-slate-700">{formatDate(p.date)}</div><div className="text-[10px] text-slate-500 font-mono">{p.id}</div></td>
                              <td className="px-4 py-3"><div className="font-black text-slate-800 uppercase">{p.supplier}</div><div className="text-xs text-slate-500 uppercase">{p.itemName}</div></td>
                              <td className="px-4 py-3 text-center font-black text-blue-600">{p.qty} {p.satuan}</td>
                              <td className="px-4 py-3 text-right font-black text-slate-800">{formatRp(p.total)}</td>
                              <td className="px-4 py-3 text-center">{hutang > 0 ? <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[9px] font-black uppercase">Hutang {formatRp(hutang)}</span> : <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[9px] font-black uppercase">LUNAS</span>}</td>
                          </tr>
                      )})}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
}
