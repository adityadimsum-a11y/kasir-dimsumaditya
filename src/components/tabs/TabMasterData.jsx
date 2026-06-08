import React, { useState } from 'react';
import { Database, PackagePlus, Box, Truck, PlusCircle, CheckCircle, Save } from 'lucide-react';
import { generateId } from '../../utils/helpers';

export default function TabMasterData({ masterProducts, masterRawMaterials, masterSuppliers, sendToSheet, showToast }) {
  const [activeSubTab, setActiveSubTab] = useState('products');

  // FORM STATES
  const [formProduct, setFormProduct] = useState({ product_name: '', sku: '', category: 'FROZEN_GOODS', unit: 'PCS', selling_price: '', default_hpp: '' });
  const [formRaw, setFormRaw] = useState({ raw_name: '', unit: 'KG', average_cost: '' });
  const [formSupplier, setFormSupplier] = useState({ supplier_name: '', payment_term: 'CASH', contact: '' });

  const handleSimpanProduct = (e) => {
    e.preventDefault();
    const payload = { ...formProduct, id: generateId('PRD', new Date()), status_active: true };
    sendToSheet('insert', payload, 'master_products');
    setFormProduct({ product_name: '', sku: '', category: 'FROZEN_GOODS', unit: 'PCS', selling_price: '', default_hpp: '' });
  };

  const handleSimpanRaw = (e) => {
    e.preventDefault();
    const payload = { ...formRaw, id: generateId('RAW', new Date()), status: 'ACTIVE' };
    sendToSheet('insert', payload, 'master_raw_materials');
    setFormRaw({ raw_name: '', unit: 'KG', average_cost: '' });
  };

  const handleSimpanSupplier = (e) => {
    e.preventDefault();
    const payload = { ...formSupplier, id: generateId('SUP', new Date()), status: 'ACTIVE' };
    sendToSheet('insert', payload, 'master_suppliers');
    setFormSupplier({ supplier_name: '', payment_term: 'CASH', contact: '' });
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* HEADER */}
      <div className="bg-slate-900 rounded-2xl p-8 relative overflow-hidden shadow-xl border border-slate-800 flex items-center justify-between">
        <div className="absolute -top-10 -right-10 text-slate-800 opacity-40"><Database size={200}/></div>
        <div className="relative z-10 text-white">
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2 mb-1"><Database className="text-purple-400"/> Master Data Center</h2>
          <p className="text-sm text-slate-400 font-medium">Standardisasi Nama Produk, Bahan Baku, dan Supplier. Auto-Trim & Uppercase Aktif.</p>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex bg-slate-200 p-1.5 rounded-2xl w-max shadow-inner">
          <button onClick={() => setActiveSubTab('products')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition ${activeSubTab === 'products' ? 'bg-white text-purple-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}><PackagePlus size={16}/> Master Produk</button>
          <button onClick={() => setActiveSubTab('raw')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition ${activeSubTab === 'raw' ? 'bg-white text-orange-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}><Box size={16}/> Master Bahan Baku</button>
          <button onClick={() => setActiveSubTab('suppliers')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition ${activeSubTab === 'suppliers' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}><Truck size={16}/> Master Supplier</button>
      </div>

      {/* CONTENT: MASTER PRODUCTS */}
      {activeSubTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border shadow-sm h-max border-t-4 border-t-purple-500">
            <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2"><PlusCircle size={18}/> Tambah Produk Jual</h3>
            <form onSubmit={handleSimpanProduct} className="space-y-4">
              <div><label className="text-[10px] font-bold text-slate-500 uppercase">Nama Produk Jual</label><input type="text" required value={formProduct.product_name} onChange={e=>setFormProduct({...formProduct, product_name: e.target.value})} className="w-full p-2.5 border rounded-lg bg-slate-50 uppercase" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] font-bold text-slate-500 uppercase">SKU / Kode</label><input type="text" required value={formProduct.sku} onChange={e=>setFormProduct({...formProduct, sku: e.target.value})} className="w-full p-2.5 border rounded-lg bg-slate-50 uppercase" /></div>
                <div><label className="text-[10px] font-bold text-slate-500 uppercase">Satuan</label><select value={formProduct.unit} onChange={e=>setFormProduct({...formProduct, unit: e.target.value})} className="w-full p-2.5 border rounded-lg bg-slate-50"><option value="PCS">PCS</option><option value="PACK">PACK</option><option value="MIKA">MIKA</option></select></div>
              </div>
              <div><label className="text-[10px] font-bold text-slate-500 uppercase">Kategori</label><select value={formProduct.category} onChange={e=>setFormProduct({...formProduct, category: e.target.value})} className="w-full p-2.5 border rounded-lg bg-slate-50"><option value="FROZEN_GOODS">FROZEN GOODS</option><option value="READY_TO_EAT">READY TO EAT</option><option value="BEVERAGE">BEVERAGE</option></select></div>
              <button type="submit" className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"><Save size={16}/> Simpan Master Produk</button>
            </form>
          </div>
          <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b text-[10px] text-slate-500 uppercase"><tr><th className="p-3">SKU</th><th className="p-3">Nama Produk</th><th className="p-3">Kategori</th><th className="p-3 text-center">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100 font-bold text-xs">
                {(masterProducts||[]).map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-400">{p.sku}</td>
                    <td className="p-3 text-slate-800 uppercase">{p.product_name}</td>
                    <td className="p-3 text-purple-600">{p.category}</td>
                    <td className="p-3 text-center"><span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[9px]">ACTIVE</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTENT: RAW MATERIALS & SUPPLIERS SAMA POLANYA... */}
      {activeSubTab === 'raw' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="bg-white p-6 rounded-2xl border shadow-sm h-max border-t-4 border-t-orange-500">
             <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2"><PlusCircle size={18}/> Tambah Bahan Baku</h3>
             <form onSubmit={handleSimpanRaw} className="space-y-4">
                <div><label className="text-[10px] font-bold text-slate-500 uppercase">Nama Bahan Baku</label><input type="text" required value={formRaw.raw_name} onChange={e=>setFormRaw({...formRaw, raw_name: e.target.value})} className="w-full p-2.5 border rounded-lg bg-slate-50 uppercase" /></div>
                <div><label className="text-[10px] font-bold text-slate-500 uppercase">Satuan Beli</label><select value={formRaw.unit} onChange={e=>setFormRaw({...formRaw, unit: e.target.value})} className="w-full p-2.5 border rounded-lg bg-slate-50"><option value="KG">KG</option><option value="PACK">PACK</option><option value="LITER">LITER</option></select></div>
                <button type="submit" className="w-full bg-orange-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"><Save size={16}/> Simpan Bahan Baku</button>
             </form>
           </div>
           <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden p-4">
             <div className="text-xs text-slate-500 mb-2">Total Master Bahan Baku: {masterRawMaterials?.length || 0} items</div>
             <div className="flex flex-wrap gap-2">
                {(masterRawMaterials||[]).map(r => <span key={r.id} className="bg-slate-100 border px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 uppercase">{r.raw_name} ({r.unit})</span>)}
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
