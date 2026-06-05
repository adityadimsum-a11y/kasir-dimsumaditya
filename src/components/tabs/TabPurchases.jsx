import React, { useState } from 'react';
import { Truck, Package, Clock, CheckCircle } from 'lucide-react';
import { formatRp, generateId, getTodayStr, formatDate } from '../../utils/helpers';

export default function TabPurchases({ purchases, sendToSheet, setPrintData }) {
  const todayStr = getTodayStr();
  
  // State Default untuk UAT SKENARIO A
  const [form, setForm] = useState({
    date: todayStr, 
    supplier: 'PT AYAM JAYA (UAT)', 
    itemName: 'AYAM',
    qty: '1000', 
    satuan: 'KG', 
    price: '37500', 
    paidAmount: '0', 
    paymentMethod: 'HUTANG/PENDING'
  });

  const total = Number(form.qty) * Number(form.price);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      id: generateId('PUR', form.date),
      date: form.date, supplier: form.supplier, itemName: form.itemName,
      qty: Number(form.qty), satuan: form.satuan, price: Number(form.price),
      total: total, paidAmount: Number(form.paidAmount), paymentMethod: form.paymentMethod
    };
    
    // 🔥 THE MAGIC ENGINE: Menembak event_purchase, BUKAN sekadar insert!
    sendToSheet('event_purchase', payload, 'system_events');
    
    // Reset Qty setelah sukses
    setForm({...form, qty: '', paidAmount: ''});
  };

  const listPurchases = (purchases || []).sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* FORM PEMBELIAN & AUTO JOURNAL */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6 border-b pb-4">
              <div className="bg-indigo-100 text-indigo-700 p-2 rounded-lg"><Truck size={20}/></div>
              <div><h3 className="font-black text-slate-800 text-lg uppercase tracking-wide">Penerimaan Bahan Baku (Purchasing)</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sistem akan otomatis menghitung FIFO Cost Layer & General Ledger</p></div>
          </div>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Tanggal</label><input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Supplier</label><input type="text" required value={form.supplier} onChange={e=>setForm({...form, supplier: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Barang</label><input type="text" required value={form.itemName} onChange={e=>setForm({...form, itemName: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Satuan</label><input type="text" required value={form.satuan} onChange={e=>setForm({...form, satuan: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
              
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Qty (Masuk)</label><input type="number" required value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl font-black text-blue-700" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Harga Satuan (Rp)</label><input type="number" required value={form.price} onChange={e=>setForm({...form, price: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl font-black text-slate-700" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Dibayar Hari Ini (Rp)</label><input type="number" required value={form.paidAmount} onChange={e=>setForm({...form, paidAmount: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl font-black text-emerald-700" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Metode Pembayaran</label>
                  <select value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-sm">
                      <option value="HUTANG/PENDING">Hutang / Pending</option>
                      <option value="CASH">Cash Laci</option>
                      <option value="TRANSFER">Transfer Bank</option>
                  </select>
              </div>

              <div className="md:col-span-4 bg-indigo-50 p-4 rounded-xl border border-indigo-200 flex justify-between items-center mt-2 shadow-inner">
                  <div><div className="text-[10px] font-black text-indigo-800 uppercase tracking-widest">Total Tagihan (Invoice)</div><div className="text-2xl font-black text-indigo-700">{formatRp(total)}</div></div>
                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 py-3.5 rounded-xl shadow-md transition tracking-wide uppercase text-xs">Eksekusi & Auto Journal</button>
              </div>
          </form>
      </div>

      {/* TABEL HISTORI */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-6">
          <div className="p-4 border-b bg-slate-50 flex items-center gap-3"><Clock size={18} className="text-slate-600"/><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Histori Penerimaan & Jurnal</h4></div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase">
                      <tr><th className="px-4 py-3">ID & Tgl</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3 text-center">Barang</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-center">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {listPurchases.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-4 py-3"><div className="font-mono text-[10px] font-bold text-slate-700">{p.id}</div><div className="text-[10px] text-slate-500">{formatDate(p.date)}</div></td>
                              <td className="px-4 py-3 font-bold text-slate-800 uppercase text-xs">{p.supplier}</td>
                              <td className="px-4 py-3 text-center"><div className="font-black text-blue-700 text-xs">{p.qty} {p.satuan}</div><div className="text-[9px] font-bold text-slate-500 uppercase">{p.itemName}</div></td>
                              <td className="px-4 py-3 text-right font-black text-slate-700">{formatRp(p.total)}</td>
                              <td className="px-4 py-3 text-center">
                                  {p.total - p.paidAmount <= 0 ? (
                                      <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[9px] font-black uppercase"><CheckCircle size={10} className="inline mr-1"/>LUNAS</span>
                                  ) : (
                                      <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[9px] font-black uppercase">HUTANG</span>
                                  )}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
}
