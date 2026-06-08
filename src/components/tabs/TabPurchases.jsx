import React, { useState } from 'react';
import { Truck, CheckCircle, Clock } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';
import SearchableDropdown from '../ui/SearchableDropdown';

export default function TabPurchases({ purchases, masterSuppliers, masterRawMaterials, sendToSheet, showToast, user }) {
  const todayStr = getTodayStr();
  const caps = user?.permissions || {};

  const [form, setForm] = useState({
      date: todayStr, supplier: '', itemName: '',
      qty: '', satuan: 'KG', price: '', paidAmount: '', paymentMethod: 'TRANSFER'
  });

  const handleCurrencyChange = (field, value) => {
      const rawValue = value.replace(/\D/g, ''); 
      setForm(prev => ({ ...prev, [field]: rawValue }));
  };

  const handleSelectSupplier = (supp) => setForm({ ...form, supplier: supp.supplier_name });
  const handleCreateSupplier = (val) => setForm({ ...form, supplier: val.toUpperCase() });

  const handleSelectRaw = (raw) => setForm({ ...form, itemName: raw.raw_name, satuan: raw.unit, price: String(raw.average_cost || 0) });
  const handleCreateRaw = (val) => setForm({ ...form, itemName: val.toUpperCase() });

  const total = Number(form.qty) * Number(form.price);

  const handleSubmit = (e) => {
      e.preventDefault();
      if (!form.supplier || !form.itemName) { showToast('Supplier dan Bahan Baku wajib diisi dari Master Data!', 'error'); return; }

      const payload = {
          id: generateId('PRC', form.date), date: form.date, supplier: form.supplier,
          itemName: form.itemName, qty: Number(form.qty), satuan: form.satuan, 
          price: Number(form.price), total: total, paidAmount: Number(form.paidAmount), paymentMethod: form.paymentMethod,
          branch_id: user.branch_id
      };
      sendToSheet('event_purchase', payload, 'system_events').then(success => {
          if(success) setForm({...form, qty: '', price: '', paidAmount: ''});
      });
  };

  const listPurchases = (purchases || []).sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-blue-500 relative">
          <div className="flex items-center gap-3 mb-6 border-b pb-4"><div className="bg-blue-100 text-blue-700 p-2 rounded-lg"><Truck size={20}/></div><div><h3 className="font-black text-slate-800 text-lg uppercase tracking-wide">Input Pembelian Logistik</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Master Data Driven SCM</p></div></div>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Tgl</label><input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm" /></div>
              
              <div className="space-y-1.5 md:col-span-3">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Pilih Supplier Resmi</label>
                  <SearchableDropdown options={masterSuppliers||[]} value={form.supplier} valueKey="supplier_name" labelKey="supplier_name" placeholder="Cari Supplier..." onChange={handleSelectSupplier} canCreate={caps.can_master_data} onCreateNew={handleCreateSupplier} />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Pilih Bahan Baku</label>
                  <SearchableDropdown options={masterRawMaterials||[]} value={form.itemName} valueKey="raw_name" labelKey="raw_name" placeholder="Cari Bahan Baku..." onChange={handleSelectRaw} canCreate={caps.can_master_data} onCreateNew={handleCreateRaw} />
              </div>
              
              <div className="grid grid-cols-2 gap-2 md:col-span-2">
                  <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Qty Masuk</label><input type="number" required min="1" placeholder="0" value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-black text-slate-700" /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-bold text-slate-600 uppercase">Satuan</label><select value={form.satuan} onChange={e=>setForm({...form, satuan: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm"><option value="KG">KG</option><option value="PCS">PCS</option><option value="PACK">PACK</option><option value="LITER">LITER</option></select></div>
              </div>

              <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase">Harga Satuan (Rp)</label>
                  <div className="relative mt-1">
                      <span className="absolute left-3 top-2.5 font-black text-slate-400">Rp</span>
                      <input type="text" required placeholder="0" value={form.price ? Number(form.price).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange('price', e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border rounded-xl font-black text-slate-700 outline-none" />
                  </div>
              </div>
              
              <div>
                  <label className="text-[10px] font-bold text-emerald-600 uppercase">Dibayar Hari Ini (Kas Keluar)</label>
                  <div className="relative mt-1">
                      <span className="absolute left-3 top-2.5 font-black text-emerald-600/50">Rp</span>
                      <input type="text" required placeholder="0" value={form.paidAmount ? Number(form.paidAmount).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange('paidAmount', e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl font-black text-emerald-700 outline-none" />
                  </div>
              </div>

              <div className="space-y-1.5 md:col-span-2"><label className="text-[10px] font-bold text-slate-600 uppercase">Metode Bayar</label>
                  <select value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm">
                      <option value="TRANSFER">Transfer Bank</option><option value="CASH">Cash Laci</option>
                  </select>
              </div>

              <div className="md:col-span-4 bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center mt-2 shadow-inner text-white">
                  <div><div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Tagihan Belanja</div><div className="text-2xl font-black">{formatRp(total)}</div></div>
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-3.5 rounded-xl shadow-md transition tracking-wide uppercase text-xs flex items-center gap-2"><CheckCircle size={16}/> Masukkan Gudang</button>
              </div>
          </form>
      </div>
      
      {/* ... [Tabel Histori Belanja di Bawahnya Tetap Dipertahankan Seperti Sebelumnya] ... */}
    </div>
  );
}
