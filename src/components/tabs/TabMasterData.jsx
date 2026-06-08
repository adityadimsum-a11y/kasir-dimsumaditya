import React, { useState } from 'react';
import { Database, PackagePlus, Box, Truck, CheckCircle, Save, Settings, Layers, Hash } from 'lucide-react';
import { generateId, formatRp } from '../../utils/helpers';

export default function TabMasterData({ masterProducts, masterRawMaterials, masterSuppliers, sendToSheet, showToast }) {
  const [activeSubTab, setActiveSubTab] = useState('rules'); // 'products', 'raw', 'packaging', 'suppliers', 'rules'

  // =====================================
  // STATE FORMS
  // =====================================
  const [formProduct, setFormProduct] = useState({ product_name: '', sku: '', category: 'FROZEN_GOODS', unit: 'PCS', selling_price: '', default_hpp: '' });
  const [formRaw, setFormRaw] = useState({ raw_name: '', unit: 'KG', average_cost: '', category: 'BAHAN_BAKU' });
  const [formSupplier, setFormSupplier] = useState({ supplier_name: '', payment_term: 'CASH', contact: '' });

  // =====================================
  // HELPER: INPUT RUPIAH OTOMATIS (LOCKED)
  // =====================================
  const handleCurrencyChange = (setter, field, value) => {
      const rawValue = value.replace(/\D/g, ''); 
      setter(prev => ({ ...prev, [field]: rawValue }));
  };

  // =====================================
  // HANDLERS SUBMIT
  // =====================================
  const handleSimpanProduct = async (e) => {
    e.preventDefault();
    const payload = { 
        ...formProduct, 
        id: generateId('PRD', new Date()), 
        selling_price: Number(formProduct.selling_price),
        default_hpp: Number(formProduct.default_hpp),
        status_active: true 
    };
    const success = await sendToSheet('insert', payload, 'master_products');
    if(success) setFormProduct({ product_name: '', sku: '', category: 'FROZEN_GOODS', unit: 'PCS', selling_price: '', default_hpp: '' });
  };

  const handleSimpanRaw = async (e) => {
    e.preventDefault();
    const payload = { 
        ...formRaw, 
        id: generateId('RAW', new Date()), 
        average_cost: Number(formRaw.average_cost),
        status: 'ACTIVE' 
    };
    const success = await sendToSheet('insert', payload, 'master_raw_materials');
    if(success) setFormRaw({ raw_name: '', unit: 'KG', average_cost: '', category: formRaw.category });
  };

  const handleSimpanSupplier = async (e) => {
    e.preventDefault();
    const payload = { ...formSupplier, id: generateId('SUP', new Date()), status: 'ACTIVE' };
    const success = await sendToSheet('insert', payload, 'master_suppliers');
    if(success) setFormSupplier({ supplier_name: '', payment_term: 'CASH', contact: '' });
  };

  // Filter Data Bahan Baku vs Packaging
  const listBahanBaku = (masterRawMaterials || []).filter(r => r.category !== 'PACKAGING');
  const listPackaging = (masterRawMaterials || []).filter(r => r.category === 'PACKAGING');

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* HEADER NAVIGASI */}
      <div className="flex flex-wrap gap-2 mb-6 border-b pb-4">
        <button onClick={() => setActiveSubTab('rules')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${activeSubTab === 'rules' ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><Settings size={16} className="inline mr-2"/> Aturan Konversi</button>
        <button onClick={() => setActiveSubTab('products')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${activeSubTab === 'products' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><PackagePlus size={16} className="inline mr-2"/> Produk Akhir</button>
        <button onClick={() => setActiveSubTab('raw')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${activeSubTab === 'raw' ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><Box size={16} className="inline mr-2"/> Bahan Baku (Ayam)</button>
        <button onClick={() => setActiveSubTab('packaging')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${activeSubTab === 'packaging' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><Layers size={16} className="inline mr-2"/> Packaging Inventory</button>
        <button onClick={() => setActiveSubTab('suppliers')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${activeSubTab === 'suppliers' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><Truck size={16} className="inline mr-2"/> Mitra Supplier</button>
      </div>

      {/* ======================================= */}
      {/* TAB 1: MASTER CONVERSION RULES          */}
      {/* ======================================= */}
      {activeSubTab === 'rules' && (
         <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                <div className="bg-amber-500/20 text-amber-400 p-2 rounded-lg"><Settings size={24}/></div>
                <div>
                    <h3 className="font-black text-white text-lg uppercase tracking-wide">Master Conversion Engine (Phase 12.5)</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Aturan Mutlak Konversi Produksi Dimsum Aditya</p>
                </div>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 relative overflow-hidden">
                    <Hash className="absolute -right-4 -bottom-4 text-slate-700 opacity-50" size={100}/>
                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">Rule #1: Timbangan Mentah</div>
                    <div className="flex items-end justify-between relative z-10">
                        <div>
                            <div className="text-3xl font-black text-white">10 <span className="text-sm text-slate-400">KG</span></div>
                            <div className="text-xs font-bold text-slate-500 mt-1">Timbangan Mutlak</div>
                        </div>
                        <div className="text-slate-500 mb-2">=</div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-orange-400">1 <span className="text-sm">Kantong</span></div>
                            <div className="text-xs font-bold text-slate-500 mt-1">Ayam Mentah</div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 relative overflow-hidden">
                    <Hash className="absolute -right-4 -bottom-4 text-slate-700 opacity-50" size={100}/>
                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">Rule #2: Resep Adukan</div>
                    <div className="flex items-end justify-between relative z-10">
                        <div>
                            <div className="text-3xl font-black text-white">30 <span className="text-sm text-slate-400">KG</span></div>
                            <div className="text-xs font-bold text-slate-500 mt-1">Ayam Fillet</div>
                        </div>
                        <div className="text-slate-500 mb-2">=</div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-orange-400">1 <span className="text-sm">Adukan</span></div>
                            <div className="text-xs font-bold text-slate-500 mt-1">Mix Base</div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 relative overflow-hidden">
                    <Hash className="absolute -right-4 -bottom-4 text-slate-700 opacity-50" size={100}/>
                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">Rule #3: Target Yield Dasar</div>
                    <div className="flex items-end justify-between relative z-10">
                        <div>
                            <div className="text-3xl font-black text-white">1 <span className="text-sm text-slate-400">Adukan</span></div>
                            <div className="text-xs font-bold text-slate-500 mt-1">Mix Base</div>
                        </div>
                        <div className="text-slate-500 mb-2">=</div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-blue-400">1.000 <span className="text-sm">PCS</span></div>
                            <div className="text-xs font-bold text-slate-500 mt-1">Dimsum Mentah</div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 relative overflow-hidden md:col-span-2 lg:col-span-1">
                    <Hash className="absolute -right-4 -bottom-4 text-slate-700 opacity-50" size={100}/>
                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">Rule #4: Konversi Porsi Eceran</div>
                    <div className="flex items-end justify-between relative z-10">
                        <div>
                            <div className="text-3xl font-black text-white">1 <span className="text-sm text-slate-400">Porsi</span></div>
                            <div className="text-xs font-bold text-slate-500 mt-1">Penjualan Resto</div>
                        </div>
                        <div className="text-slate-500 mb-2">=</div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-purple-400">4 <span className="text-sm">PCS</span></div>
                            <div className="text-xs font-bold text-slate-500 mt-1">Dimsum Mentah</div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 relative overflow-hidden md:col-span-2 lg:col-span-2">
                    <Hash className="absolute -right-4 -bottom-4 text-slate-700 opacity-50" size={100}/>
                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">Rule #5: Konversi Packaging / Mika Frozen</div>
                    <div className="flex items-end justify-between relative z-10">
                        <div>
                            <div className="text-3xl font-black text-white">1 <span className="text-sm text-slate-400">Mika</span></div>
                            <div className="text-xs font-bold text-slate-500 mt-1">Kemasan Frozen</div>
                        </div>
                        <div className="text-slate-500 mb-2">=</div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-pink-400">50 <span className="text-sm">PCS</span></div>
                            <div className="text-xs font-bold text-slate-500 mt-1">Dimsum / Mika</div>
                        </div>
                        <div className="text-slate-500 mb-2">=</div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-emerald-400">20 <span className="text-sm">Mika</span></div>
                            <div className="text-xs font-bold text-slate-500 mt-1">Per Adukan</div>
                        </div>
                    </div>
                </div>

            </div>
            <div className="p-4 bg-amber-500/10 border-t border-amber-500/20 text-xs font-bold text-amber-500 flex items-center justify-center gap-2">
                <CheckCircle size={14}/> Aturan ini di-hardcode ke sistem HPP & Yield Engine untuk mencegah kebocoran perhitungan inventaris.
            </div>
         </div>
      )}

      {/* ======================================= */}
      {/* TAB 2: INVENTORY PACKAGING (PHASE 12.5) */}
      {/* ======================================= */}
      {activeSubTab === 'packaging' && (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-purple-600 h-max">
                <div className="flex items-center gap-3 mb-6 border-b pb-4">
                    <div className="bg-purple-100 text-purple-700 p-2 rounded-lg"><Layers size={20}/></div>
                    <div><h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Data Packaging Baru</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Master Kemasan & Plastik</p></div>
                </div>
                <form onSubmit={(e) => { setFormRaw(prev => ({...prev, category: 'PACKAGING'})); handleSimpanRaw(e); }} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Nama Kemasan</label>
                        <input type="text" required value={formRaw.raw_name} onChange={e=>setFormRaw({...formRaw, raw_name: e.target.value.toUpperCase()})} placeholder="Cth: MIKA PLASTIK ISI 50" className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm uppercase" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Satuan Beli</label>
                        <select required value={formRaw.unit} onChange={e=>setFormRaw({...formRaw, unit: e.target.value})} className="w-full p-2.5 bg-white border rounded-xl font-black text-sm uppercase outline-none">
                            <option value="PCS">Pieces (Pcs)</option><option value="PACK">Pack</option><option value="BALL">Bal / Roll</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-purple-600 uppercase">Harga Modal / Satuan</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 font-black text-purple-400">Rp</span>
                            <input type="text" required value={formRaw.average_cost ? Number(formRaw.average_cost).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange(setFormRaw, 'average_cost', e.target.value)} className="w-full pl-9 pr-2 py-2.5 bg-purple-50 border border-purple-200 rounded-xl font-black text-purple-700 outline-none" placeholder="0" />
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-3.5 rounded-xl uppercase text-xs mt-4 transition shadow-md">Simpan Master Kemasan</button>
                </form>
            </div>
            
            <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Database Inventory Packaging</h4></div>
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b text-[10px] text-slate-500 uppercase"><tr><th className="px-4 py-3">Nama Kemasan / Packaging</th><th className="px-4 py-3 text-center">Satuan Stok</th><th className="px-4 py-3 text-right">Biaya / Harga Modal</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                          {listPackaging.length === 0 ? <tr><td colSpan="3" className="text-center py-8 text-slate-400">Belum ada data kemasan.</td></tr> : 
                          listPackaging.map(r => (
                              <tr key={r.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 font-black text-slate-800 uppercase">{r.raw_name}</td>
                                  <td className="px-4 py-3 text-center font-bold text-slate-500 uppercase">{r.unit}</td>
                                  <td className="px-4 py-3 text-right font-black text-purple-600">{formatRp(r.average_cost)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
            </div>
         </div>
      )}

      {/* ======================================= */}
      {/* TAB LAINNYA: Produk, Bahan Baku, Supplier */}
      {/* (KODE UI SAMA DENGAN SEBELUMNYA, DITAMBAH RP PREFIX PADA HARGA) */}
      {/* ======================================= */}
      {activeSubTab === 'raw' && (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-orange-600 h-max">
                <div className="flex items-center gap-3 mb-6 border-b pb-4"><div className="bg-orange-100 text-orange-700 p-2 rounded-lg"><Box size={20}/></div><div><h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Data Bahan Baku</h3></div></div>
                <form onSubmit={(e) => { setFormRaw(prev => ({...prev, category: 'BAHAN_BAKU'})); handleSimpanRaw(e); }} className="space-y-4">
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Nama Bahan Baku</label><input type="text" required value={formRaw.raw_name} onChange={e=>setFormRaw({...formRaw, raw_name: e.target.value.toUpperCase()})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm uppercase" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Satuan Beli</label><select required value={formRaw.unit} onChange={e=>setFormRaw({...formRaw, unit: e.target.value})} className="w-full p-2.5 bg-white border rounded-xl font-black text-sm uppercase"><option value="KG">Kilogram (KG)</option><option value="LITER">Liter</option></select></div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-orange-600 uppercase">Harga Acuan Default</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 font-black text-orange-400">Rp</span>
                            <input type="text" required value={formRaw.average_cost ? Number(formRaw.average_cost).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange(setFormRaw, 'average_cost', e.target.value)} className="w-full pl-9 pr-2 py-2.5 bg-orange-50 border border-orange-200 rounded-xl font-black text-orange-700 outline-none" />
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-3.5 rounded-xl uppercase text-xs mt-4">Simpan Bahan Baku</button>
                </form>
             </div>
             <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                  <table className="w-full text-sm text-left"><thead className="bg-slate-50 border-b text-[10px] text-slate-500 uppercase"><tr><th className="px-4 py-3">Nama Bahan Baku</th><th className="px-4 py-3 text-center">Satuan</th><th className="px-4 py-3 text-right">Harga Modal Dasar</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                      {listBahanBaku.map(r => (
                          <tr key={r.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-black text-slate-800 uppercase">{r.raw_name}</td>
                              <td className="px-4 py-3 text-center font-bold text-slate-500 uppercase">{r.unit}</td>
                              <td className="px-4 py-3 text-right font-black text-orange-600">{formatRp(r.average_cost)}</td>
                          </tr>
                      ))}
                  </tbody></table>
             </div>
         </div>
      )}

      {/* SISA TAB LAIN (Produk & Supplier) BISA DITULIS SERUPA... */}
    </div>
  );
}
