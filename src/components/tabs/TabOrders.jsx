import React, { useState } from 'react';
import { ShoppingCart, CheckCircle, Clock, Printer, Plus } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';
import SearchableDropdown from '../ui/SearchableDropdown';

export default function TabOrders({ orders, payments, masterProducts, sendToSheet, setPrintData, role, showToast, user }) {
  const todayStr = getTodayStr();

  const [form, setForm] = useState({
      date: todayStr, source: 'GOFOOD', customerName: '',
      sku: '', itemName: '', qty: '', price: '', paidAmount: '', paymentMethod: 'MARKETPLACE'
  });

  // PROTEKSI MASTER DATA CAPABILITY
  const caps = user?.permissions || {};

  const handleCurrencyChange = (field, value) => {
      const rawValue = value.replace(/\D/g, ''); 
      setForm(prev => ({ ...prev, [field]: rawValue }));
  };

  const handleSelectProduct = (product) => {
      setForm({
          ...form,
          sku: product.sku,
          itemName: product.product_name,
          price: String(product.selling_price || 0)
      });
  };

  const handleCreateNewProduct = (newProductName) => {
      // Shortcut Super Admin: Auto Fill Text
      setForm({ ...form, sku: 'NEW-SKU', itemName: newProductName.toUpperCase() });
      showToast(`Mode Buat Baru: Silakan isi Harga Jual. Produk akan otomatis masuk ke Master Data saat disubmit.`, 'success');
  };

  const total = Number(form.qty) * Number(form.price);

  const handleSubmit = (e) => {
      e.preventDefault();
      if (!form.itemName) { showToast('Pilih Produk dari Master Data!', 'error'); return; }
      if (Number(form.qty) <= 0) { showToast('Qty tidak boleh kosong!', 'error'); return; }

      const payload = {
          id: generateId('ORD', form.date), date: form.date, source: form.source, customer_name: form.customerName || 'Walk-in Customer',
          sku: form.sku, itemName: form.itemName, qty: Number(form.qty), price: Number(form.price), total: total,
          paidAmount: Number(form.paidAmount), paymentMethod: form.paymentMethod,
          settlement_status: form.paymentMethod === 'MARKETPLACE' ? 'PENDING' : 'SETTLED',
          branch_id: user.branch_id
      };

      sendToSheet('event_order', payload, 'system_events').then(success => {
          if (success) setForm({ ...form, qty: '', paidAmount: '' });
      });
  };

  const listOrders = (orders || []).sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="bg-white rounded-2xl border shadow-sm p-6 relative">
          <div className="flex items-center gap-3 mb-6 border-b pb-4">
              <div className="bg-blue-100 text-blue-700 p-2 rounded-lg"><ShoppingCart size={20}/></div>
              <div><h3 className="font-black text-slate-800 text-lg uppercase tracking-wide">POS Kasir Terintegrasi</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Master Data Driven Engine Aktif</p></div>
          </div>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Tgl</label><input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Sumber / Platform</label>
                  <select value={form.source} onChange={e=>setForm({...form, source: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm">
                      <option value="OFFLINE">Offline / Toko</option><option value="GOFOOD">GoFood</option><option value="GRABFOOD">GrabFood</option><option value="SHOPEEFOOD">ShopeeFood</option><option value="TIKTOK">TikTok Shop</option>
                  </select>
              </div>
              <div className="space-y-1.5 md:col-span-2"><label className="text-[10px] font-bold text-slate-600 uppercase">Nama Pelanggan</label><input type="text" placeholder="Boleh Kosong" value={form.customerName} onChange={e=>setForm({...form, customerName: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm uppercase" /></div>
              
              {/* MASTER DATA DROPDOWN ENFORCEMENT */}
              <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-purple-600 uppercase flex items-center justify-between">
                      Pilih Produk (Master Data)
                      {!caps.can_master_data && <span className="text-[8px] bg-slate-200 px-1 rounded text-slate-500">Read Only</span>}
                  </label>
                  <SearchableDropdown 
                      options={masterProducts || []}
                      value={form.itemName}
                      valueKey="product_name"
                      labelKey="product_name"
                      placeholder="Cari Produk Jual..."
                      onChange={handleSelectProduct}
                      canCreate={caps.can_master_data}
                      onCreateNew={handleCreateNewProduct}
                  />
              </div>

              <div className="space-y-1.5"><label className="text-[10px] font-bold text-blue-600 uppercase">Qty (Pcs)</label><input type="number" required min="1" placeholder="0" value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 bg-blue-50 border border-blue-200 rounded-xl font-black text-blue-700" /></div>
              
              <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Harga Satuan (Rp)</label>
                  <div className="relative mt-1">
                      <span className="absolute left-3 top-2.5 font-black text-slate-400">Rp</span>
                      <input type="text" required placeholder="0" value={form.price ? Number(form.price).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange('price', e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border rounded-xl font-black text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
              </div>
              
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

              <div className="md:col-span-4 bg-blue-50 p-4 rounded-xl border border-blue-200 flex justify-between items-center mt-2 shadow-inner">
                  <div><div className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Total Transaksi</div><div className="text-2xl font-black text-blue-700">{formatRp(total)}</div></div>
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-3.5 rounded-xl shadow-md transition tracking-wide uppercase text-xs flex items-center gap-2"><CheckCircle size={16}/> Submit Order & Cetak</button>
              </div>
          </form>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-6">
          <div className="p-4 border-b bg-slate-50 flex items-center justify-between"><div className="flex items-center gap-3"><Clock size={18} className="text-slate-600"/><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Histori Penjualan POS</h4></div></div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left table-compact">
                  <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase table-sticky-header"><tr><th className="px-4 py-3">ID & Tgl</th><th className="px-4 py-3">Platform & Pelanggan</th><th className="px-4 py-3 text-center">Produk (SKU)</th><th className="px-4 py-3 text-right">Pendapatan Kotor</th><th className="px-4 py-3 text-center">Cetak</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                      {listOrders.map(o => (
                          <tr key={o.id} className="hover:bg-slate-50 transition">
                              <td className="px-4 py-3"><div className="font-mono text-[10px] font-bold text-slate-700">{o.id}</div><div className="text-[10px] text-slate-500">{formatDate(o.date)}</div></td>
                              <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase mb-1 inline-block ${o.source === 'OFFLINE' ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700'}`}>{o.source}</span><div className="font-bold text-slate-800 text-xs truncate max-w-[150px]">{o.customer_name}</div></td>
                              <td className="px-4 py-3 text-center"><div className="font-black text-blue-600">{o.qty} Pcs</div><div className="text-[9px] font-bold text-slate-500 uppercase">{o.itemName} <span className="text-slate-300">({o.sku})</span></div></td>
                              <td className="px-4 py-3 text-right font-bold text-slate-700">{formatRp(o.total)}</td>
                              <td className="px-4 py-3 text-center"><button onClick={() => setPrintData({ type: 'INVOICE', data: o })} className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-lg transition"><Printer size={16}/></button></td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
}
