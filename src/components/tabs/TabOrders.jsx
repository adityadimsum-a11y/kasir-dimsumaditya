import React, { useState, useEffect } from 'react';
import { Database, PackagePlus, Box, Truck, CheckCircle, Save, Settings, Layers, Hash, Edit2, Trash2, Calculator } from 'lucide-react';
import { generateId, formatRp } from '../../utils/helpers';

export default function TabMasterData({ 
  masterProducts = [], masterRawMaterials = [], masterSuppliers = [], masterRules = [], 
  sendToSheet, showToast 
}) {
  const [activeSubTab, setActiveSubTab] = useState('products');

  // =====================================
  // STATE FORMS
  // =====================================
  const [formProduct, setFormProduct] = useState({ 
    id: '', product_name: '', sku: '', category: 'FROZEN_GOODS', unit: 'PCS', 
    selling_price: '', default_hpp: '', min_order: '1', penalty_price: '0' 
  });
  const [isEditingProduct, setIsEditingProduct] = useState(false);

  const [formRaw, setFormRaw] = useState({ raw_name: '', unit: 'KG', average_cost: '', category: 'BAHAN_BAKU' });
  const [formSupplier, setFormSupplier] = useState({ supplier_name: '', payment_term: 'CASH', contact: '' });

  // STATE DINAMIS UNTUK ENGINE KONVERSI
  const [engineRules, setEngineRules] = useState({
    timbangan_mentah: 10, resep_adukan: 30, target_yield: 1000, porsi_eceran: 4, mika_frozen: 50
  });

  useEffect(() => {
    if (masterRules && masterRules.length > 0) {
      const dbRules = masterRules[0];
      setEngineRules({
        timbangan_mentah: Number(dbRules.timbangan_mentah || 10),
        resep_adukan: Number(dbRules.resep_adukan || 30),
        target_yield: Number(dbRules.target_yield || 1000),
        porsi_eceran: Number(dbRules.porsi_eceran || 4),
        mika_frozen: Number(dbRules.mika_frozen || 50)
      });
    }
  }, [masterRules]);

  // =====================================
  // HELPER: INPUT RUPIAH OTOMATIS & AUTO HPP
  // =====================================
  const handleCurrencyChange = (setter, field, value) => {
      const rawValue = value.replace(/\D/g, ''); 
      setter(prev => ({ ...prev, [field]: rawValue }));
  };

  // 🔥 ENGINE AUTO-HITUNG HPP BERDASARKAN CORE AYAM PABRIK
  const handleAutoCalculateHPP = () => {
    // Cari harga ayam mentah di Database (Jika kosong, pakai patokan Bos: Rp 37.500)
    const ayamMentah = (masterRawMaterials || []).find(r => r.raw_name.toUpperCase().includes('AYAM'));
    const hargaAyam = ayamMentah ? Number(ayamMentah.average_cost) : 37500;

    // RUMUS: (Kg Resep Adukan x Harga Ayam) / Target Yield Pcs
    const hppDasar = (engineRules.resep_adukan * hargaAyam) / engineRules.target_yield;
    const hppBulat = Math.round(hppDasar);

    setFormProduct(prev => ({ ...prev, default_hpp: String(hppBulat) }));
    if(showToast) showToast(`HPP Otomatis dari Core Ayam: ${formatRp(hppBulat)}/Pcs!`, 'success');
  };

  // =====================================
  // HANDLERS SUBMIT & ACTIONS
  // =====================================
  const handleSimpanRules = async () => {
    if(!window.confirm("Yakin ingin mengubah standar mutlak konversi pabrik? Perubahan ini akan mempengaruhi HPP baru!")) return;
    const payload = { id: 'RULE-MASTER', ...engineRules };
    const success = await sendToSheet('update', payload, 'master_rules'); 
    if(success && showToast) showToast('Konfigurasi Mesin Konversi Berhasil Diperbarui!', 'success');
  };

  // --- KEKUASAAN OWNER: MASTER MENU ---
  const handleSimpanProduct = async (e) => {
    e.preventDefault();
    const payload = { 
        ...formProduct, 
        id: isEditingProduct ? formProduct.id : generateId('PRD', new Date().toISOString()), 
        selling_price: Number(formProduct.selling_price),
        default_hpp: Number(formProduct.default_hpp),
        min_order: Number(formProduct.min_order || 1),
        penalty_price: Number(formProduct.penalty_price || formProduct.selling_price),
        status_active: true 
    };
    
    const action = isEditingProduct ? 'update' : 'insert';
    const success = await sendToSheet(action, payload, 'master_products');
    
    if(success) {
      if(showToast) showToast(isEditingProduct ? 'Menu berhasil di-update!' : 'Menu baru berhasil ditambah!', 'success');
      setFormProduct({ id: '', product_name: '', sku: '', category: 'FROZEN_GOODS', unit: 'PCS', selling_price: '', default_hpp: '', min_order: '1', penalty_price: '0' });
      setIsEditingProduct(false);
    }
  };

  const handleEditProduct = (p) => {
    setFormProduct({
      id: p.id, product_name: p.product_name, sku: p.sku || '', category: p.category || 'FROZEN_GOODS', unit: 'PCS',
      selling_price: String(p.selling_price || 0), default_hpp: String(p.default_hpp || 0),
      min_order: String(p.min_order || 1), penalty_price: String(p.penalty_price || p.selling_price || 0)
    });
    setIsEditingProduct(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteProduct = async (id) => {
    if(window.confirm("Yakin ingin menghapus menu ini dari sistem kasir?")) {
      const success = await sendToSheet('delete', { id }, 'master_products');
      if(success && showToast) showToast('Menu berhasil dihapus!', 'success');
    }
  };

  const handleSimpanRaw = async (e) => {
    e.preventDefault();
    const payload = { ...formRaw, id: generateId('RAW', new Date().toISOString()), average_cost: Number(formRaw.average_cost), status: 'ACTIVE' };
    if (await sendToSheet('insert', payload, 'master_raw_materials')) {
      if(showToast) showToast('Data Inventory ditambah', 'success');
      setFormRaw({ raw_name: '', unit: 'KG', average_cost: '', category: formRaw.category });
    }
  };

  const handleSimpanSupplier = async (e) => {
    e.preventDefault();
    const payload = { ...formSupplier, id: generateId('SUP', new Date().toISOString()), status: 'ACTIVE' };
    if (await sendToSheet('insert', payload, 'master_suppliers')) {
      if(showToast) showToast('Mitra Supplier ditambah', 'success');
      setFormSupplier({ supplier_name: '', payment_term: 'CASH', contact: '' });
    }
  };

  const listBahanBaku = (masterRawMaterials || []).filter(r => r.category !== 'PACKAGING');
  const listPackaging = (masterRawMaterials || []).filter(r => r.category === 'PACKAGING');
  const listProducts = masterProducts || [];
  const listSuppliers = masterSuppliers || [];

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* HEADER NAVIGASI */}
      <div className="flex flex-wrap gap-2 mb-6 border-b pb-4">
        <button onClick={() => setActiveSubTab('products')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${activeSubTab === 'products' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><PackagePlus size={16} className="inline mr-2"/> Master Daftar Menu</button>
        <button onClick={() => setActiveSubTab('rules')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${activeSubTab === 'rules' ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><Settings size={16} className="inline mr-2"/> Aturan Pabrik</button>
        <button onClick={() => setActiveSubTab('raw')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${activeSubTab === 'raw' ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><Box size={16} className="inline mr-2"/> Bahan Baku (Ayam)</button>
        <button onClick={() => setActiveSubTab('packaging')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${activeSubTab === 'packaging' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><Layers size={16} className="inline mr-2"/> Packaging Inventory</button>
        <button onClick={() => setActiveSubTab('suppliers')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${activeSubTab === 'suppliers' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}><Truck size={16} className="inline mr-2"/> Mitra Supplier</button>
      </div>

      {/* ======================================= */}
      {/* TAB 1: MASTER MENU & HARGA PINTAR (OWNER)*/}
      {/* ======================================= */}
      {activeSubTab === 'products' && (
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
             <div className="lg:col-span-4 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-blue-600 h-max">
                <div className="flex items-center justify-between gap-3 mb-6 border-b pb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 text-blue-700 p-2 rounded-lg"><PackagePlus size={20}/></div>
                    <div>
                      <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">{isEditingProduct ? 'Revisi Menu' : 'Tambah Menu Baru'}</h3>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Sinkron ke Kasir POS</p>
                    </div>
                  </div>
                  {isEditingProduct && <button type="button" onClick={() => {setIsEditingProduct(false); setFormProduct({ id: '', product_name: '', sku: '', category: 'FROZEN_GOODS', unit: 'PCS', selling_price: '', default_hpp: '', min_order: '1', penalty_price: '0' })}} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded font-black uppercase border hover:bg-slate-200">Batal</button>}
                </div>
                
                <form onSubmit={handleSimpanProduct} className="space-y-4">
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Nama Menu / Produk</label><input type="text" required value={formProduct.product_name} onChange={e=>setFormProduct({...formProduct, product_name: e.target.value.toUpperCase()})} placeholder="Cth: DIMSUM AYAM MIX" className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm uppercase outline-none focus:border-blue-400" /></div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Kategori</label><select required value={formProduct.category} onChange={e=>setFormProduct({...formProduct, category: e.target.value})} className="w-full p-2.5 bg-white border rounded-xl font-black text-xs uppercase outline-none focus:border-blue-400"><option value="FROZEN_GOODS">Frozen / Mentah</option><option value="READY_TO_EAT">Siap Saji</option><option value="SAOS_BUMBU">Saos & Bumbu</option></select></div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-blue-600 uppercase">Harga Utama/Pcs</label>
                          <div className="relative"><span className="absolute left-3 top-2.5 font-black text-blue-400">Rp</span><input type="text" required value={formProduct.selling_price ? Number(formProduct.selling_price).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange(setFormProduct, 'selling_price', e.target.value)} className="w-full pl-9 pr-2 py-2.5 bg-blue-50 border border-blue-200 rounded-xl font-black text-blue-700 outline-none" placeholder="2125" /></div>
                        </div>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                      <div className="text-[10px] font-black text-amber-800 uppercase tracking-widest border-b border-amber-200/50 pb-1.5">Aturan Harga Bertingkat</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-amber-700 uppercase">Minimal Beli (Pcs)</label>
                          <input type="number" required value={formProduct.min_order} onChange={e=>setFormProduct({...formProduct, min_order: e.target.value})} className="w-full p-2 bg-white border border-amber-200 rounded-lg font-black text-xs text-center outline-none focus:border-amber-400" placeholder="100" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-rose-600 uppercase">Harga Pinalti/Ecer</label>
                          <div className="relative"><span className="absolute left-2 top-1.5 font-black text-rose-400 text-xs">Rp</span><input type="text" required value={formProduct.penalty_price ? Number(formProduct.penalty_price).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange(setFormProduct, 'penalty_price', e.target.value)} className="w-full pl-7 pr-2 py-2 bg-white border border-rose-200 rounded-lg font-black text-rose-700 text-xs outline-none focus:border-rose-400" placeholder="3000" /></div>
                        </div>
                      </div>
                      <div className="text-[8px] font-bold text-amber-600/80 leading-relaxed uppercase">Jika pelanggan beli di bawah {formProduct.min_order || 1} pcs, sistem POS akan otomatis mengunci harga di Rp {formProduct.penalty_price ? Number(formProduct.penalty_price).toLocaleString('id-ID') : 0}/pcs.</div>
                    </div>

                    {/* 🔥 FITUR AUTO HITUNG HPP CORE AYAM */}
                    <div className="space-y-1">
                        <div className="flex justify-between items-end mb-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Estimasi Modal (HPP)</label>
                          <button type="button" onClick={handleAutoCalculateHPP} className="text-[8px] bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-black uppercase tracking-wider hover:bg-indigo-600 hover:text-white transition-colors flex items-center gap-1 shadow-sm">
                            <Calculator size={10}/> Auto Core
                          </button>
                        </div>
                        <div className="relative"><span className="absolute left-3 top-2.5 font-black text-slate-400">Rp</span><input type="text" required value={formProduct.default_hpp ? Number(formProduct.default_hpp).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange(setFormProduct, 'default_hpp', e.target.value)} className="w-full pl-9 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-400" placeholder="1125" /></div>
                    </div>

                    <button type="submit" className={`w-full text-white font-black py-3.5 rounded-xl uppercase text-xs mt-4 transition shadow-md ${isEditingProduct ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>{isEditingProduct ? 'Simpan Perubahan' : 'Tambahkan Menu'}</button>
                </form>
             </div>

             <div className="lg:col-span-8 bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Daftar Menu Kasir POS</h4></div>
                  <div className="overflow-x-auto custom-scrollbar flex-1">
                    <table className="w-full text-sm text-left"><thead className="bg-slate-50 border-b text-[10px] text-slate-500 uppercase"><tr><th className="px-4 py-3">Nama Menu</th><th className="px-4 py-3 text-center">Kategori</th><th className="px-4 py-3 text-right">Harga Grosir</th><th className="px-4 py-3 text-right">Aturan Min. Order</th><th className="px-4 py-3 text-center">Aksi</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                        {listProducts.length === 0 ? <tr><td colSpan="5" className="text-center py-8 text-slate-400">Belum ada daftar menu.</td></tr> : 
                        listProducts.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50 group">
                                <td className="px-4 py-3 font-black text-slate-800 uppercase">{p.product_name}</td>
                                <td className="px-4 py-3 text-center"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[9px] font-black uppercase">{p.category.replace('_', ' ')}</span></td>
                                <td className="px-4 py-3 text-right font-black text-blue-600">{formatRp(p.selling_price)}</td>
                                <td className="px-4 py-3 text-right">
                                  <div className="text-xs font-black text-amber-700">Min. {p.min_order || 1} Pcs</div>
                                  <div className="text-[9px] text-rose-500 font-bold uppercase mt-0.5">Ecer: {formatRp(p.penalty_price || p.selling_price)}</div>
                                </td>
                                <td className="px-4 py-3 text-center opacity-40 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                  <button onClick={() => handleEditProduct(p)} className="p-1.5 text-slate-400 hover:text-amber-600 bg-amber-50 rounded mx-1"><Edit2 size={14}/></button>
                                  <button onClick={() => handleDeleteProduct(p.id)} className="p-1.5 text-slate-400 hover:text-rose-600 bg-rose-50 rounded mx-1"><Trash2 size={14}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody></table>
                  </div>
             </div>
         </div>
      )}

      {/* ======================================= */}
      {/* TAB 2: MASTER CONVERSION RULES (DYNAMIC)*/}
      {/* ======================================= */}
      {activeSubTab === 'rules' && (
         <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="bg-amber-500/20 text-amber-400 p-3 rounded-xl"><Settings size={28}/></div>
                  <div>
                      <h3 className="font-black text-white text-xl uppercase tracking-wide">Master Conversion Engine</h3>
                      <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mt-1">Ubah angka di bawah ini untuk menyesuaikan perhitungan pabrik</p>
                  </div>
                </div>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 relative overflow-hidden focus-within:border-amber-500 transition-colors">
                    <Hash className="absolute -right-4 -bottom-4 text-slate-700 opacity-50" size={100}/>
                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">Rule #1: Timbangan Mentah</div>
                    <div className="flex items-end justify-between relative z-10">
                        <div>
                            <div className="flex items-end gap-1"><input type="number" value={engineRules.timbangan_mentah} onChange={e=>setEngineRules({...engineRules, timbangan_mentah: Number(e.target.value)})} className="w-16 bg-slate-900 border border-slate-600 text-white text-3xl font-black text-center rounded-lg outline-none focus:border-amber-500 py-1" /><span className="text-sm text-slate-400 font-black mb-1">KG</span></div>
                            <div className="text-xs font-bold text-slate-500 mt-2">Timbangan Mutlak</div>
                        </div>
                        <div className="text-slate-500 mb-2 font-black text-xl">=</div>
                        <div className="text-right"><div className="text-2xl font-black text-orange-400">1 <span className="text-sm">Kantong</span></div><div className="text-xs font-bold text-slate-500 mt-1">Ayam Mentah</div></div>
                    </div>
                </div>

                <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 relative overflow-hidden focus-within:border-amber-500 transition-colors">
                    <Hash className="absolute -right-4 -bottom-4 text-slate-700 opacity-50" size={100}/>
                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">Rule #2: Resep Adukan</div>
                    <div className="flex items-end justify-between relative z-10">
                        <div>
                            <div className="flex items-end gap-1"><input type="number" value={engineRules.resep_adukan} onChange={e=>setEngineRules({...engineRules, resep_adukan: Number(e.target.value)})} className="w-16 bg-slate-900 border border-slate-600 text-white text-3xl font-black text-center rounded-lg outline-none focus:border-amber-500 py-1" /><span className="text-sm text-slate-400 font-black mb-1">KG</span></div>
                            <div className="text-xs font-bold text-slate-500 mt-2">Ayam Fillet</div>
                        </div>
                        <div className="text-slate-500 mb-2 font-black text-xl">=</div>
                        <div className="text-right"><div className="text-2xl font-black text-orange-400">1 <span className="text-sm">Adukan</span></div><div className="text-xs font-bold text-slate-500 mt-1">Mix Base</div></div>
                    </div>
                </div>

                <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 relative overflow-hidden focus-within:border-amber-500 transition-colors">
                    <Hash className="absolute -right-4 -bottom-4 text-slate-700 opacity-50" size={100}/>
                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">Rule #3: Target Yield Dasar</div>
                    <div className="flex items-end justify-between relative z-10">
                        <div><div className="text-3xl font-black text-white">1 <span className="text-sm text-slate-400">Adukan</span></div><div className="text-xs font-bold text-slate-500 mt-2">Mix Base</div></div>
                        <div className="text-slate-500 mb-2 font-black text-xl">=</div>
                        <div className="text-right">
                            <div className="flex items-end gap-1 justify-end"><input type="number" value={engineRules.target_yield} onChange={e=>setEngineRules({...engineRules, target_yield: Number(e.target.value)})} className="w-24 bg-slate-900 border border-slate-600 text-blue-400 text-3xl font-black text-center rounded-lg outline-none focus:border-amber-500 py-1" /><span className="text-sm text-slate-400 font-black mb-1">PCS</span></div>
                            <div className="text-xs font-bold text-slate-500 mt-2">Dimsum Mentah</div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 relative overflow-hidden focus-within:border-amber-500 transition-colors md:col-span-2 lg:col-span-1">
                    <Hash className="absolute -right-4 -bottom-4 text-slate-700 opacity-50" size={100}/>
                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">Rule #4: Konversi Porsi Eceran</div>
                    <div className="flex items-end justify-between relative z-10">
                        <div>
                            <div className="text-3xl font-black text-white">1 <span className="text-sm text-slate-400">Porsi</span></div>
                            <div className="text-xs font-bold text-slate-500 mt-2">Penjualan Resto</div>
                        </div>
                        <div className="text-slate-500 mb-2 font-black text-xl">=</div>
                        <div className="text-right">
                            <div className="flex items-end gap-1 justify-end">
                              <input type="number" value={engineRules.porsi_eceran} onChange={e=>setEngineRules({...engineRules, porsi_eceran: Number(e.target.value)})} className="w-16 bg-slate-900 border border-slate-600 text-purple-400 text-3xl font-black text-center rounded-lg outline-none focus:border-amber-500 py-1" />
                              <span className="text-sm text-slate-400 font-black mb-1">PCS</span>
                            </div>
                            <div className="text-xs font-bold text-slate-500 mt-2">Dimsum Mentah</div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 relative overflow-hidden focus-within:border-amber-500 transition-colors md:col-span-2 lg:col-span-2">
                    <Hash className="absolute -right-4 -bottom-4 text-slate-700 opacity-50" size={100}/>
                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">Rule #5: Konversi Packaging / Mika Frozen</div>
                    <div className="flex items-end justify-between relative z-10">
                        <div>
                            <div className="text-3xl font-black text-white">1 <span className="text-sm text-slate-400">Mika</span></div>
                            <div className="text-xs font-bold text-slate-500 mt-2">Kemasan Frozen</div>
                        </div>
                        <div className="text-slate-500 mb-2 font-black text-xl">=</div>
                        <div className="text-center">
                            <div className="flex items-end gap-1 justify-center">
                              <input type="number" value={engineRules.mika_frozen} onChange={e=>setEngineRules({...engineRules, mika_frozen: Number(e.target.value)})} className="w-20 bg-slate-900 border border-slate-600 text-pink-400 text-3xl font-black text-center rounded-lg outline-none focus:border-amber-500 py-1" />
                              <span className="text-sm text-slate-400 font-black mb-1">PCS</span>
                            </div>
                            <div className="text-xs font-bold text-slate-500 mt-2">Dimsum / Mika</div>
                        </div>
                        <div className="text-slate-500 mb-2 font-black text-xl">=</div>
                        <div className="text-right">
                            <div className="text-3xl font-black text-emerald-400">{(engineRules.target_yield / engineRules.mika_frozen).toFixed(0)} <span className="text-sm">Mika</span></div>
                            <div className="text-xs font-bold text-slate-500 mt-2">Per Adukan (Auto)</div>
                        </div>
                    </div>
                </div>

            </div>
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs font-bold text-slate-400 flex items-center gap-2"><CheckCircle size={14} className="text-amber-500"/> Pastikan klik simpan setelah mengubah angka konfigurasi di atas.</div>
                <button onClick={handleSimpanRules} className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-900 px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-transform active:scale-95 flex items-center justify-center gap-2 shadow-lg"><Save size={16}/> Simpan Konfigurasi</button>
            </div>
         </div>
      )}

      {/* ======================================= */}
      {/* TAB 3, 4, 5 (Packaging, Raw, Suppliers) */}
      {/* ======================================= */}
      {activeSubTab === 'packaging' && (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-purple-600 h-max">
                <div className="flex items-center gap-3 mb-6 border-b pb-4"><div className="bg-purple-100 text-purple-700 p-2 rounded-lg"><Layers size={20}/></div><div><h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Data Packaging Baru</h3></div></div>
                <form onSubmit={(e) => { setFormRaw(prev => ({...prev, category: 'PACKAGING'})); handleSimpanRaw(e); }} className="space-y-4">
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Nama Kemasan</label><input type="text" required value={formRaw.raw_name} onChange={e=>setFormRaw({...formRaw, raw_name: e.target.value.toUpperCase()})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm uppercase outline-none focus:border-purple-400" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Satuan Beli</label><select required value={formRaw.unit} onChange={e=>setFormRaw({...formRaw, unit: e.target.value})} className="w-full p-2.5 bg-white border rounded-xl font-black text-sm uppercase outline-none focus:border-purple-400"><option value="PCS">Pieces (Pcs)</option><option value="PACK">Pack</option><option value="BALL">Bal / Roll</option></select></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-purple-600 uppercase">Harga Modal / Satuan</label><div className="relative"><span className="absolute left-3 top-2.5 font-black text-purple-400">Rp</span><input type="text" required value={formRaw.average_cost ? Number(formRaw.average_cost).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange(setFormRaw, 'average_cost', e.target.value)} className="w-full pl-9 pr-2 py-2.5 bg-purple-50 border border-purple-200 rounded-xl font-black text-purple-700 outline-none" /></div></div>
                    <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-3.5 rounded-xl uppercase text-xs mt-4 transition shadow-md">Simpan Master Kemasan</button>
                </form>
            </div>
            <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Database Inventory Packaging</h4></div>
                  <table className="w-full text-sm text-left"><thead className="bg-slate-50 border-b text-[10px] text-slate-500 uppercase"><tr><th className="px-4 py-3">Nama Kemasan / Packaging</th><th className="px-4 py-3 text-center">Satuan Stok</th><th className="px-4 py-3 text-right">Biaya / Harga Modal</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                      {listPackaging.length === 0 ? <tr><td colSpan="3" className="text-center py-8 text-slate-400">Belum ada data kemasan.</td></tr> : 
                      listPackaging.map(r => (
                          <tr key={r.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-black text-slate-800 uppercase">{r.raw_name}</td>
                              <td className="px-4 py-3 text-center font-bold text-slate-500 uppercase">{r.unit}</td>
                              <td className="px-4 py-3 text-right font-black text-purple-600">{formatRp(r.average_cost)}</td>
                          </tr>
                      ))}
                  </tbody></table>
            </div>
         </div>
      )}

      {activeSubTab === 'raw' && (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-orange-600 h-max">
                <div className="flex items-center gap-3 mb-6 border-b pb-4"><div className="bg-orange-100 text-orange-700 p-2 rounded-lg"><Box size={20}/></div><div><h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Data Bahan Baku</h3></div></div>
                <form onSubmit={(e) => { setFormRaw(prev => ({...prev, category: 'BAHAN_BAKU'})); handleSimpanRaw(e); }} className="space-y-4">
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Nama Bahan Baku</label><input type="text" required value={formRaw.raw_name} onChange={e=>setFormRaw({...formRaw, raw_name: e.target.value.toUpperCase()})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm uppercase outline-none focus:border-orange-400" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Satuan Beli</label><select required value={formRaw.unit} onChange={e=>setFormRaw({...formRaw, unit: e.target.value})} className="w-full p-2.5 bg-white border rounded-xl font-black text-sm uppercase outline-none focus:border-orange-400"><option value="KG">Kilogram (KG)</option><option value="LITER">Liter</option></select></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-orange-600 uppercase">Harga Acuan Default</label><div className="relative"><span className="absolute left-3 top-2.5 font-black text-orange-400">Rp</span><input type="text" required value={formRaw.average_cost ? Number(formRaw.average_cost).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange(setFormRaw, 'average_cost', e.target.value)} className="w-full pl-9 pr-2 py-2.5 bg-orange-50 border border-orange-200 rounded-xl font-black text-orange-700 outline-none" /></div></div>
                    <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-3.5 rounded-xl uppercase text-xs mt-4 transition shadow-md">Simpan Bahan Baku</button>
                </form>
             </div>
             <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Database Bahan Baku</h4></div>
                  <table className="w-full text-sm text-left"><thead className="bg-slate-50 border-b text-[10px] text-slate-500 uppercase"><tr><th className="px-4 py-3">Nama Bahan Baku</th><th className="px-4 py-3 text-center">Satuan</th><th className="px-4 py-3 text-right">Harga Modal Dasar</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                      {listBahanBaku.length === 0 ? <tr><td colSpan="3" className="text-center py-8 text-slate-400">Belum ada data bahan baku.</td></tr> : 
                      listBahanBaku.map(r => (
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

      {activeSubTab === 'suppliers' && (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-slate-800 h-max">
                <div className="flex items-center gap-3 mb-6 border-b pb-4"><div className="bg-slate-100 text-slate-700 p-2 rounded-lg"><Truck size={20}/></div><div><h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Data Mitra Supplier</h3></div></div>
                <form onSubmit={handleSimpanSupplier} className="space-y-4">
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Nama Pemasok</label><input type="text" required value={formSupplier.supplier_name} onChange={e=>setFormSupplier({...formSupplier, supplier_name: e.target.value.toUpperCase()})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-sm uppercase outline-none focus:border-slate-800" placeholder="PT / Toko" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Sistem Pembayaran</label><select required value={formSupplier.payment_term} onChange={e=>setFormSupplier({...formSupplier, payment_term: e.target.value})} className="w-full p-2.5 bg-white border rounded-xl font-black text-sm uppercase outline-none focus:border-slate-800"><option value="CASH">Tunai (CASH)</option><option value="TEMPO_7_HARI">Tempo 7 Hari</option><option value="TEMPO_14_HARI">Tempo 14 Hari</option></select></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Kontak / Keterangan</label><input type="text" required value={formSupplier.contact} onChange={e=>setFormSupplier({...formSupplier, contact: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-xs outline-none focus:border-slate-800" /></div>
                    <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-3.5 rounded-xl uppercase text-xs mt-4 transition shadow-md">Simpan Supplier</button>
                </form>
             </div>
             <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Database Mitra Supplier</h4></div>
                  <table className="w-full text-sm text-left"><thead className="bg-slate-50 border-b text-[10px] text-slate-500 uppercase"><tr><th className="px-4 py-3">Nama Mitra</th><th className="px-4 py-3 text-center">Sistem Bayar</th><th className="px-4 py-3">Kontak / Ket</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                      {listSuppliers.length === 0 ? <tr><td colSpan="3" className="text-center py-8 text-slate-400">Belum ada data supplier.</td></tr> : 
                      listSuppliers.map(s => (
                          <tr key={s.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-black text-slate-800 uppercase">{s.supplier_name}</td>
                              <td className="px-4 py-3 text-center font-bold text-slate-500 uppercase"><span className="bg-slate-100 px-2 py-1 rounded">{s.payment_term.replace(/_/g, ' ')}</span></td>
                              <td className="px-4 py-3 font-bold text-slate-600">{s.contact}</td>
                          </tr>
                      ))}
                  </tbody></table>
             </div>
         </div>
      )}

    </div>
  );
}
