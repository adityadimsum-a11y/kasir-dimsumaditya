import React, { useState } from 'react';
import { ShoppingCart, CheckCircle, Clock, Printer } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabOrders({ orders, payments, sendToSheet, setPrintData, role }) {
  const todayStr = getTodayStr();
  const userSession = JSON.parse(window.localStorage.getItem('dimsum_user_session')) || { branch_id: 'PUSAT' };

  const [form, setForm] = useState({
      date: todayStr, source: 'GOFOOD', customerName: 'Customer UAT',
      itemName: 'DIMSUM FROZEN', qty: '', price: '2500', paidAmount: '0', paymentMethod: 'MARKETPLACE'
  });

  // HELPER: INPUT RUPIAH OTOMATIS
  const handleCurrencyChange = (field, value) => {
      const rawValue = value.replace(/\D/g, ''); // Buang selain angka
      setForm(prev => ({ ...prev, [field]: rawValue }));
  };

  const total = Number(form.qty) * Number(form.price);

  const handleSubmit = (e) => {
      e.preventDefault();
      if (Number(form.qty) <= 0) { alert('Qty tidak boleh kosong!'); return; }
      if (form.source !== 'OFFLINE' && form.paymentMethod !== 'MARKETPLACE') {
          if (!window.confirm(`Anda memilih Channel ${form.source} tapi pembayarannya menggunakan ${form.paymentMethod}. Yakin ini benar? (Biasanya penjualan online uangnya tertahan di Marketplace)`)) return;
      }

      const payload = {
          id: generateId('ORD', form.date), date: form.date, source: form.source, customer_name: form.customerName,
          itemName: form.itemName, qty: Number(form.qty), price: Number(form.price), total: total,
          paidAmount: Number(form.paidAmount), paymentMethod: form.paymentMethod,
          settlement_status: form.paymentMethod === 'MARKETPLACE' ? 'PENDING' : 'SETTLED',
          branch_id: userSession.branch_id
      };

      sendToSheet('event_order', payload, 'system_events');
      setForm({ ...form, qty: '', paidAmount: '0' });
  };

  const listOrders = (orders || []).sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="bg-white rounded-2xl border shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6 border-b pb-4">
              <div className="bg-blue-100 text-blue-700 p-2 rounded-lg"><ShoppingCart size={20}/></div>
              <div><h3 className="font-black text-slate-800 text-lg uppercase tracking-wide">POS / Transaksi Penjualan</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sistem otomatis menghitung Fee Marketplace & HPP (Laba Bersih)</p></div>
          </div>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Tanggal</label><input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Sumber Order</label>
                  <select value={form.source} onChange={e=>setForm({...form, source: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm">
                      <option value="OFFLINE">Offline / Toko</option><option value="GOFOOD">GoFood (Fee 20%)</option><option value="GRABFOOD">GrabFood (Fee 20%)</option><option value="SHOPEEFOOD">ShopeeFood (Fee 22%)</option><option value="TIKTOK">TikTok (Fee 5%)</option>
                  </select>
              </div>
              <div className="space-y-1.5 md:col-span-2"><label className="text-[10px] font-bold text-slate-600 uppercase">Nama Pelanggan / Catatan</label><input type="text" required value={form.customerName} onChange={e=>setForm({...form, customerName: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
              
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Barang</label>
                  <select value={form.itemName} onChange={e=>setForm({...form, itemName: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm">
                      <option value="DIMSUM FROZEN">Dimsum Frozen</option><option value="DIMSUM MATANG">Dimsum Matang</option>
                  </select>
              </div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-blue-600 uppercase">Qty (Pcs Terjual)</label><input type="number" required placeholder="0" value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 bg-blue-50 border border-blue-200 rounded-xl font-black text-blue-700" /></div>
              
              {/* INPUT RUPIAH: HARGA JUAL */}
              <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Harga Jual Satuan (Rp)</label>
                  <div className="relative mt-1">
                      <span className="absolute left-3 top-2.5 font-black text-slate-400">Rp</span>
                      <input type="text" required placeholder="0" value={form.price ? Number(form.price).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange('price', e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border rounded-xl font-black text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
              </div>
              
              {/* INPUT RUPIAH: UANG DITERIMA */}
              <div>
                  <label className="text-[10px] font-bold text-emerald-600 uppercase">Uang Diterima Hari Ini</label>
                  <div className="relative mt-1">
                      <span className="absolute left-3 top-2.5 font-black text-emerald-600/50">Rp</span>
                      <input type="text" required placeholder="0" value={form.paidAmount ? Number(form.paidAmount).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange('paidAmount', e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
              </div>

              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Metode Pembayaran</label>
                  <select value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm">
                      <option value="CASH">Cash Laci</option><option value="TRANSFER">Transfer Bank</option><option value="QRIS">QRIS</option><option value="MARKETPLACE">Tertahan di Marketplace</option>
                  </select>
              </div>

              <div className="md:col-span-3 bg-blue-50 p-4 rounded-xl border border-blue-200 flex justify-between items-center mt-2 shadow-inner">
                  <div><div className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Total Transaksi</div><div className="text-2xl font-black text-blue-700">{formatRp(total)}</div></div>
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-3.5 rounded-xl shadow-md transition tracking-wide uppercase text-xs flex items-center gap-2"><CheckCircle size={16}/> Submit Order & Jurnal</button>
              </div>
          </form>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-6">
          <div className="p-4 border-b bg-slate-50 flex items-center justify-between"><div className="flex items-center gap-3"><Clock size={18} className="text-slate-600"/><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Histori Penjualan & Laba Realtime</h4></div></div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase"><tr><th className="px-4 py-3">ID & Tgl</th><th className="px-4 py-3">Sumber & Pelanggan</th><th className="px-4 py-3 text-center">Barang</th><th className="px-4 py-3 text-right">Pendapatan Kotor</th><th className="px-4 py-3 text-center">Potongan Fee</th><th className="px-4 py-3 text-right bg-emerald-50">Net Profit (Laba)</th><th className="px-4 py-3 text-center">Cetak</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                      {listOrders.map(o => (
                          <tr key={o.id} className="hover:bg-slate-50 transition">
                              <td className="px-4 py-3"><div className="font-mono text-[10px] font-bold text-slate-700">{o.id}</div><div className="text-[10px] text-slate-500">{formatDate(o.date)}</div></td>
                              <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase mb-1 inline-block ${o.source === 'OFFLINE' ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700'}`}>{o.source}</span><div className="font-bold text-slate-800 text-xs truncate max-w-[150px]">{o.customer_name}</div></td>
                              <td className="px-4 py-3 text-center"><div className="font-black text-blue-600">{o.qty} Pcs</div><div className="text-[9px] font-bold text-slate-500 uppercase">{o.itemName}</div></td>
                              <td className="px-4 py-3 text-right font-bold text-slate-700">{formatRp(o.total)}</td>
                              <td className="px-4 py-3 text-center">{Number(o.fee_amount) > 0 ? <div className="text-red-600 font-bold text-xs">-{formatRp(o.fee_amount)}</div> : <span className="text-slate-300">-</span>}</td>
                              <td className="px-4 py-3 text-right font-black bg-emerald-50 border-l border-emerald-100"><div className="text-emerald-700">{o.net_profit !== undefined ? formatRp(o.net_profit) : 'Menghitung...'}</div>{o.hpp_total && <div className="text-[9px] text-slate-500 font-normal">HPP: -{formatRp(o.hpp_total)}</div>}</td>
                              <td className="px-4 py-3 text-center"><button onClick={() => setPrintData({ type: 'INVOICE', data: o })} className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-lg transition" title="Cetak Invoice"><Printer size={16}/></button></td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
}
