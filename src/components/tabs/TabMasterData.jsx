import React, { useState, useMemo } from 'react';
import { 
  Box, Settings, Layers, Package, Truck, 
  Plus, Edit2, Trash2, Save, X, Calculator, ShieldCheck 
} from 'lucide-react';
import { getTodayStr, generateId } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabMasterData({ 
  masterProducts = [], master_products,
  masterConversionRules = [], master_conversion_rules,
  sendToSheet, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  const [activeTab, setActiveTab] = useState('MENU');
  const [isEditing, setIsEditing] = useState(false);

  // --- SINKRONISASI DATABASE ---
  const realProducts = useMemo(() => master_products || masterProducts || [], [master_products, masterProducts]);
  const realRules = useMemo(() => master_conversion_rules || masterConversionRules || [], [master_conversion_rules, masterConversionRules]);

  // --- STATE FORM MASTER MENU ---
  const [formMenu, setFormMenu] = useState({
    id: '', product_name: '', category: 'FROZEN_GOODS', 
    selling_price: '', default_hpp: '1125', min_order: '1', penalty_price: '0'
  });

  const activeProducts = useMemo(() => {
    return realProducts.filter(p => !p.isDeleted && String(p.isDeleted).toUpperCase() !== 'TRUE').reverse();
  }, [realProducts]);

  // --- ACTIONS: SUBMIT MENU ---
  const handleSubmitMenu = async (e) => {
    e.preventDefault();
    if (!formMenu.product_name) return alert("Nama menu tidak boleh kosong!");

    const productId = isEditing ? formMenu.id : generateId('PRD', todayStr);
    
    const payload = {
      id: productId, date: todayStr, branch_id: currentBranch, isDeleted: false,
      product_name: formMenu.product_name.toUpperCase(),
      sku: formMenu.product_name.substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 1000),
      category: formMenu.category, unit: 'PCS',
      selling_price: Number(formMenu.selling_price || 0),
      default_hpp: Number(formMenu.default_hpp || 1125), status_active: true,
      min_order: Number(formMenu.min_order || 1), penalty_price: Number(formMenu.penalty_price || 0)
    };

    const actionType = isEditing ? 'update' : 'insert';
    const isSuccess = await sendToSheet(actionType, payload, 'master_products');
    
    if (isSuccess) {
      showToast(isEditing ? 'Data Menu berhasil diperbarui!' : 'Menu Baru berhasil ditambah!', 'success');
      handleCancelEditMenu();
    }
  };

  const handleEditMenu = (menu) => {
    setFormMenu({
      id: menu.id, product_name: menu.product_name, category: menu.category,
      selling_price: String(menu.selling_price || 0), default_hpp: String(menu.default_hpp || 0),
      min_order: String(menu.min_order || 1), penalty_price: String(menu.penalty_price || 0)
    });
    setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEditMenu = () => {
    setIsEditing(false);
    setFormMenu({ id: '', product_name: '', category: 'FROZEN_GOODS', selling_price: '', default_hpp: '1125', min_order: '1', penalty_price: '0' });
  };

  const handleDeleteMenu = async (id) => {
    if (window.confirm("Yakin ingin menghapus menu ini?")) {
      const isSuccess = await sendToSheet('delete', { id }, 'master_products');
      if (isSuccess) showToast('Menu berhasil dihapus.', 'success');
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* 🚀 NAVIGASI SUB TABS */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        <button onClick={() => setActiveTab('MENU')} className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'MENU' ? 'bg-blue-600 text-white shadow-md scale-105' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Box size={16}/> Master Daftar Menu</button>
        <button onClick={() => setActiveTab('RULES')} className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'RULES' ? 'bg-slate-800 text-white shadow-md scale-105' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Settings size={16}/> Aturan Pabrik</button>
        <button onClick={() => setActiveTab('AYAM')} className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'AYAM' ? 'bg-rose-600 text-white shadow-md scale-105' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Layers size={16}/> Bahan Baku (Ayam)</button>
        <button onClick={() => setActiveTab('PACKAGING')} className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'PACKAGING' ? 'bg-amber-500 text-white shadow-md scale-105' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Package size={16}/> Packaging Inventory</button>
        <button onClick={() => setActiveTab('SUPPLIER')} className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'SUPPLIER' ? 'bg-emerald-600 text-white shadow-md scale-105' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Truck size={16}/> Mitra Supplier</button>
      </div>

      {activeTab === 'MENU' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* KANTONG KIRI: FORM INPUT MASTER MENU */}
          <div className="xl:col-span-4">
            <div className={`bg-white rounded-3xl border shadow-sm p-6 md:p-8 transition-all duration-300 ${isEditing ? 'border-amber-300 shadow-amber-500/10' : 'border-blue-200'}`}>
              <div className="flex items-start gap-4 mb-6">
                <div className={`p-3 rounded-2xl ${isEditing ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                  {isEditing ? <Edit2 size={24}/> : <Box size={24}/>}
                </div>
                <div className="flex-1 flex justify-between items-start">
                   <div>
                      <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">{isEditing ? 'Mode Edit Menu' : 'Tambah Menu Baru'}</h3>
                      <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Sinkron Langsung Ke Kasir POS</p>
                   </div>
                   {isEditing && (
                     <button type="button" onClick={handleCancelEditMenu} className="p-1.5 bg-slate-100 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><X size={16}/></button>
                   )}
                </div>
              </div>

              <form onSubmit={handleSubmitMenu} className="space-y-5">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Nama Menu / Produk</label>
                  <input type="text" required value={formMenu.product_name} onChange={e=>setFormMenu({...formMenu, product_name: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm uppercase text-slate-800 outline-none focus:bg-white focus:border-blue-400 transition-colors" placeholder="CTH: DIMSUM AYAM MIX" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Kategori</label>
                    <select value={formMenu.category} onChange={e=>setFormMenu({...formMenu, category: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-xs uppercase text-slate-800 outline-none cursor-pointer focus:border-blue-400 transition-colors">
                      <option value="FROZEN_GOODS">FROZEN / MENTAH</option>
                      <option value="READY_TO_EAT">MATANG / READY</option>
                      <option value="BUMBU_SAUS">BUMBU / SAUS</option>
                      <option value="PACKAGING">PACKAGING / MIKA</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1.5">Harga Utama/Pcs</label>
                    <div className="relative">
                      <span className="absolute left-4 top-3.5 font-black text-blue-400">Rp</span>
                      <input type="text" required value={formMenu.selling_price ? Number(formMenu.selling_price).toLocaleString('id-ID') : ''} onChange={e=>setFormMenu({...formMenu, selling_price: e.target.value.replace(/\D/g, '')})} className="w-full pl-11 pr-3 py-3.5 bg-blue-50 border border-blue-200 rounded-xl font-black text-sm text-blue-800 outline-none focus:bg-white focus:border-blue-500 transition-colors" placeholder="0" />
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50/50 border border-amber-200 p-5 rounded-2xl shadow-inner">
                  <h4 className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-3 border-b border-amber-100 pb-2 flex items-center gap-1.5"><Layers size={14}/> Aturan Harga Bertingkat</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-amber-700 uppercase tracking-widest block mb-1.5">Minimal Beli (Pcs)</label>
                      <input type="number" min="1" required value={formMenu.min_order} onChange={e=>setFormMenu({...formMenu, min_order: e.target.value})} className="w-full p-3 bg-white border border-amber-200 rounded-xl font-black text-sm text-center outline-none focus:border-amber-400 transition-colors" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-rose-600 uppercase tracking-widest block mb-1.5">Harga Pinalti/Ecer</label>
                      <div className="relative">
                        <span className="absolute left-3 top-3.5 font-black text-rose-400 text-xs">Rp</span>
                        <input type="text" value={formMenu.penalty_price ? Number(formMenu.penalty_price).toLocaleString('id-ID') : ''} onChange={e=>setFormMenu({...formMenu, penalty_price: e.target.value.replace(/\D/g, '')})} className="w-full pl-9 pr-2 py-3 bg-white border border-rose-200 rounded-xl font-black text-sm text-rose-700 outline-none focus:border-rose-400 transition-colors" placeholder="0" />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-between mb-1.5">
                    <span>Estimasi Modal (HPP)</span>
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[8px] flex items-center gap-1"><Settings size={10}/> Auto Core</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 font-black text-slate-400">Rp</span>
                    <input type="text" required value={formMenu.default_hpp ? Number(formMenu.default_hpp).toLocaleString('id-ID') : ''} onChange={e=>setFormMenu({...formMenu, default_hpp: e.target.value.replace(/\D/g, '')})} className="w-full pl-11 pr-3 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm text-slate-700 outline-none focus:bg-white focus:border-blue-400 transition-colors" placeholder="0" />
                  </div>
                </div>

                <button type="submit" className={`w-full text-white font-black py-4.5 rounded-2xl text-xs uppercase tracking-widest shadow-xl transition-transform active:scale-95 flex items-center justify-center gap-2 mt-2 ${isEditing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {isEditing ? <><Save size={16}/> Simpan Update Menu</> : <><Plus size={16}/> Daftarkan Menu Baru</>}
                </button>
              </form>
            </div>
          </div>

          {/* KANTONG KANAN: TABEL DAFTAR MENU */}
          <div className="xl:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50">
              <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
                <Box size={16} className="text-blue-600"/> Daftar Menu Kasir POS
              </h4>
            </div>
            <div className="overflow-x-auto flex-1 custom-scrollbar min-h-[60vh]">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-white border-b text-[10px] uppercase text-slate-400 sticky top-0 shadow-sm">
                  <tr>
                    <th className="px-6 py-4 font-black">Nama Menu</th>
                    <th className="px-6 py-4 font-black">Kategori</th>
                    <th className="px-6 py-4 font-black text-right">Harga Grosir</th>
                    <th className="px-6 py-4 font-black text-center">Min. Order</th>
                    <th className="px-6 py-4 font-black text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs font-bold">
                  {activeProducts.map(p => (
                    <tr key={p.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-black text-slate-800 text-sm uppercase">{p.product_name}</div>
                        <div className="text-[9px] text-slate-400 font-mono mt-1 font-bold">SKU: {p.sku} | HPP: {formatRupiah(p.default_hpp)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-wider border shadow-sm">{p.category.replace('_', ' ')}</span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap text-blue-700 font-black text-sm">
                        {formatRupiah(p.selling_price)}
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl inline-block shadow-sm">
                          <div className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Min: {p.min_order} Pcs</div>
                          <div className="text-[9px] font-bold text-rose-600 mt-0.5">Ecer: {formatRupiah(p.penalty_price)}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center justify-center gap-1.5">
                          <button type="button" onClick={() => handleEditMenu(p)} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:bg-amber-50 hover:text-amber-600 rounded-xl transition-colors"><Edit2 size={16}/></button>
                          <button type="button" onClick={() => handleDeleteMenu(p.id)} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors"><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 TAB BARU: ATURAN PABRIK (DIBUKA GEMBOKNYA) */}
      {activeTab === 'RULES' && (
        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden animate-in zoom-in-95 duration-300">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-500 to-slate-300"></div>
          <div className="flex items-center gap-3 mb-6 text-white">
            <ShieldCheck size={32} className="text-emerald-400"/>
            <div>
              <h3 className="text-xl font-black uppercase tracking-widest">Aturan Konversi Sistem (Read-Only)</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Nilai baku yang digunakan oleh seluruh modul ERP Dimsum Aditya.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-inner text-center">
              <Calculator size={36} className="mx-auto text-rose-500 mb-4 opacity-50"/>
              <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Rasio Ayam vs Dimsum</div>
              <div className="text-3xl font-black text-white">1 : 1.000</div>
              <div className="text-[9px] font-bold text-slate-500 mt-2 uppercase">(1 Kantong Ayam Mentah = Estimasi 1.000 Pcs Dimsum Jadi)</div>
            </div>
            
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-inner text-center">
              <Package size={36} className="mx-auto text-amber-500 mb-4 opacity-50"/>
              <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">Rasio Grosir Mika</div>
              <div className="text-3xl font-black text-white">1 : 50</div>
              <div className="text-[9px] font-bold text-slate-500 mt-2 uppercase">(1 Mika Grosir Frozen = Berisi 50 Pcs Dimsum)</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-inner text-center">
              <Box size={36} className="mx-auto text-blue-500 mb-4 opacity-50"/>
              <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Rasio Porsi Eceran</div>
              <div className="text-3xl font-black text-white">1 : 4</div>
              <div className="text-[9px] font-bold text-slate-500 mt-2 uppercase">(1 Porsi Matang / Eceran = Berisi 4 Pcs Dimsum)</div>
            </div>
          </div>
        </div>
      )}

      {/* Sisa tab lain masih tahap pengembangan */}
      {(activeTab === 'AYAM' || activeTab === 'PACKAGING' || activeTab === 'SUPPLIER') && (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center shadow-sm">
          <Settings size={48} className="mx-auto text-slate-200 mb-4 animate-spin-slow"/>
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-2">Modul Sedang Dalam Tahap Pengembangan</h3>
          <p className="text-xs font-bold text-slate-400">Silakan kembali ke tab MASTER DAFTAR MENU.</p>
        </div>
      )}

    </div>
  );
}
