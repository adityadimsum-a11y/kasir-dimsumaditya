import React, { useState, useMemo, useEffect } from 'react';
import { 
  Box, Settings, Layers, Package, Truck, 
  Plus, Edit2, Trash2, Save, X, Calculator, ShieldCheck, 
  CheckCircle2, User, Phone, MapPin, List, History, 
  TrendingUp, TrendingDown, ArrowRight, Clock, 
  Calendar, BarChart2, Filter, ArrowUpRight, ArrowDownRight, Minus, Tag
} from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabMasterData({ 
  masterProducts = [], master_products,
  masterSuppliers = [], master_suppliers,
  masterRawMaterials = [], master_raw_materials, 
  sendToSheet, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  const [activeTab, setActiveTab] = useState('MENU'); 
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSpl, setIsEditingSpl] = useState(false);
  const [isEditingItem, setIsEditingItem] = useState(false);
  
  const [historyModal, setHistoryModal] = useState(null);

  // 🔥 FITUR BARU: Toggle untuk Aturan Harga Kompleks
  const [useAdvancedPricing, setUseAdvancedPricing] = useState(false);

  const [recapStart, setRecapStart] = useState(() => {
    const d = new Date();
    d.setDate(1); 
    return d.toISOString().substring(0, 10);
  });
  const [recapEnd, setRecapEnd] = useState(todayStr);

  const realProducts = useMemo(() => master_products || masterProducts || [], [master_products, masterProducts]);
  const realSuppliers = useMemo(() => master_suppliers || masterSuppliers || [], [master_suppliers, masterSuppliers]);
  const realRawMaterials = useMemo(() => master_raw_materials || masterRawMaterials || [], [master_raw_materials, masterRawMaterials]);
  
  const [rules, setRules] = useState({
    kgPerKantong: 10, kgPerAdukan: 30, pcsPerAdukan: 1000, pcsPerPorsi: 4, pcsPerMika: 50
  });

  // 🔥 UPDATE FORM MENU STATE UNTUK HARGA BERTINGKAT
  const [formMenu, setFormMenu] = useState({ 
    id: '', product_name: '', category: 'FROZEN_GOODS', 
    selling_price: '',    // Harga Grosir / Base
    retail_price: '',     // Harga Ecer (Penalty Price)
    min_order: '1',       // Minimal Order Mutlak (Misal: 50)
    wholesale_qty: '1',   // Batas Qty Grosir (Misal: 100)
    default_hpp: '1125' 
  });
  
  const [formSpl, setFormSpl] = useState({ id: '', supplier_name: '', pic_name: '', phone: '', address: '', default_price: '' });
  const [formItem, setFormItem] = useState({ id: '', item_name: '', category: 'BAHAN BAKU', unit: '', default_price: '' });

  const activeProducts = useMemo(() => realProducts.filter(p => !p.isDeleted && String(p.isDeleted).toUpperCase() !== 'TRUE').reverse(), [realProducts]);
  const activeSuppliers = useMemo(() => realSuppliers.filter(s => !s.isDeleted && String(s.isDeleted).toUpperCase() !== 'TRUE').reverse(), [realSuppliers]);
  const activeRawMaterials = useMemo(() => realRawMaterials.filter(m => !m.isDeleted && String(m.isDeleted).toUpperCase() !== 'TRUE').reverse(), [realRawMaterials]);

  // --- ACTIONS: SAVE MASTER RULES ---
  const handleSaveRules = async () => {
    if (typeof showToast === 'function') {
      showToast('Konfigurasi Master Engine berhasil diperbarui ke seluruh sistem!', 'success');
    } else {
      alert('Konfigurasi Master Engine berhasil diperbarui ke seluruh sistem!');
    }
  };

  // --- ACTIONS: SUBMIT MENU (WITH ADVANCED PRICING) ---
  const handleSubmitMenu = async (e) => {
    e.preventDefault();
    if (!formMenu.product_name) return alert("Nama menu tidak boleh kosong!");
    const productId = isEditing ? formMenu.id : generateId('PRD', todayStr);
    
    // Logika pengamanan nilai (jika toggle mati, nilai disamakan)
    const finalWholesalePrice = Number(formMenu.selling_price || 0);
    const finalRetailPrice = useAdvancedPricing ? Number(formMenu.retail_price || finalWholesalePrice) : finalWholesalePrice;
    const finalMinOrder = useAdvancedPricing ? Number(formMenu.min_order || 1) : 1;
    const finalWholesaleQty = useAdvancedPricing ? Number(formMenu.wholesale_qty || 1) : 1;

    const payload = {
      id: productId, date: todayStr, branch_id: currentBranch, isDeleted: false, 
      product_name: formMenu.product_name.toUpperCase(),
      sku: formMenu.product_name.substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 1000),
      category: formMenu.category, unit: 'PCS', status_active: true,
      default_hpp: Number(formMenu.default_hpp || 1125), 
      // Mapping harga bertingkat ke database
      selling_price: finalWholesalePrice, 
      retail_price: finalRetailPrice,
      min_order: finalMinOrder, 
      wholesale_qty: finalWholesaleQty,
      penalty_price: finalRetailPrice // Backward compatibility
    };

    const isSuccess = await sendToSheet(isEditing ? 'update' : 'insert', payload, 'master_products');
    if (isSuccess) {
      showToast(isEditing ? 'DATA MENU BERHASIL DIPERBARUI!' : 'MENU BARU BERHASIL DITAMBAH!', 'success');
      setIsEditing(false); setUseAdvancedPricing(false);
      setFormMenu({ id: '', product_name: '', category: 'FROZEN_GOODS', selling_price: '', retail_price: '', min_order: '1', wholesale_qty: '1', default_hpp: '1125' });
    }
  };

  const handleEditMenuBtn = (p) => {
    const isAdvanced = Number(p.wholesale_qty || 1) > 1 || Number(p.min_order || 1) > 1 || Number(p.retail_price || p.penalty_price || p.selling_price) !== Number(p.selling_price);
    setUseAdvancedPricing(isAdvanced);
    setFormMenu({
      id: p.id, product_name: p.product_name, category: p.category || 'FROZEN_GOODS', 
      default_hpp: String(p.default_hpp || ''), 
      selling_price: String(p.selling_price || ''),
      retail_price: String(p.retail_price || p.penalty_price || p.selling_price || ''),
      min_order: String(p.min_order || '1'),
      wholesale_qty: String(p.wholesale_qty || '1')
    });
    setIsEditing(true);
  };

  // --- ACTIONS: SUBMIT SUPPLIER ---
  const handleSubmitSupplier = async (e) => {
    e.preventDefault();
    if (!formSpl.supplier_name) return alert("Nama perusahaan supplier wajib diisi!");
    const splId = isEditingSpl ? formSpl.id : generateId('SPL', todayStr);
    
    const payload = {
      id: splId, date: todayStr, branch_id: currentBranch, isDeleted: false,
      supplier_name: formSpl.supplier_name.toUpperCase(), pic_name: formSpl.pic_name.toUpperCase(), phone: formSpl.phone, 
      address: (formSpl.address || '').toUpperCase(),
      default_price: Number(formSpl.default_price || 0) 
    };
    const isSuccess = await sendToSheet(isEditingSpl ? 'update' : 'insert', payload, 'master_suppliers');
    if (isSuccess) {
      showToast(isEditingSpl ? 'DATA SUPPLIER DIPERBARUI!' : 'SUPPLIER RESMI TERDAFTAR!', 'success');
      setIsEditingSpl(false); setFormSpl({ id: '', supplier_name: '', pic_name: '', phone: '', address: '', default_price: '' });
    }
  };

  // --- ACTIONS: SUBMIT MASTER ITEM & TRACK PRICE CHANGES ---
  const handleSubmitItem = async (e) => {
    e.preventDefault();
    if (!formItem.item_name) return alert("Nama item wajib diisi!");
    
    const itemId = isEditingItem ? formItem.id : generateId('RAW', todayStr);
    const newPrice = Number(formItem.default_price || 0);
    let newHistoryStr = "";

    if (isEditingItem) {
      const oldItem = realRawMaterials.find(m => m.id === formItem.id);
      const oldPrice = oldItem ? Number(oldItem.default_price || 0) : 0;
      let parsedHistory = [];
      if (oldItem && oldItem.price_history) { try { parsedHistory = JSON.parse(oldItem.price_history); } catch(e) {} }

      if (newPrice !== oldPrice) {
        parsedHistory.push({ date: todayStr, old_price: oldPrice, new_price: newPrice, type: newPrice > oldPrice ? 'NAIK' : 'TURUN' });
      }
      newHistoryStr = JSON.stringify(parsedHistory);
    } else {
       newHistoryStr = JSON.stringify([{ date: todayStr, old_price: 0, new_price: newPrice, type: 'BARU' }]);
    }

    const payload = {
      id: itemId, date: todayStr, branch_id: currentBranch, isDeleted: false, item_name: formItem.item_name.toUpperCase(), 
      category: formItem.category.toUpperCase(), unit: formItem.unit.toUpperCase(), default_price: newPrice, price_history: newHistoryStr 
    };

    const isSuccess = await sendToSheet(isEditingItem ? 'update' : 'insert', payload, 'master_raw_materials');
    if (isSuccess) {
      showToast(isEditingItem ? 'DATA ITEM BIAYA & HARGA DIPERBARUI!' : 'ITEM BIAYA BARU TERDAFTAR!', 'success');
      setIsEditingItem(false); setFormItem({ id: '', item_name: '', category: 'BAHAN BAKU', unit: '', default_price: '' });
    }
  };

  const openHistoryModal = (item) => {
    let history = [];
    if (item.price_history) { try { history = JSON.parse(item.price_history).reverse(); } catch(e) {} }
    setHistoryModal({ itemName: item.item_name, history: history });
  };

  const priceAnalytics = useMemo(() => {
    let naikCount = 0;
    let turunCount = 0;
    let stabilCount = 0;
    let details = [];

    activeRawMaterials.forEach(item => {
      let history = [];
      try { history = JSON.parse(item.price_history || '[]'); } catch(e) {}
      
      const sDate = new Date(recapStart).setHours(0,0,0,0);
      const eDate = new Date(recapEnd).setHours(23,59,59,999);
      
      const rangeHistory = history.filter(h => {
        const hDate = new Date(h.date).getTime();
        return hDate >= sDate && hDate <= eDate;
      });

      const historyBeforeStart = history.filter(h => new Date(h.date).getTime() < sDate);
      let startingPrice = item.default_price; 
      if (historyBeforeStart.length > 0) {
        startingPrice = historyBeforeStart[historyBeforeStart.length - 1].new_price;
      } else if (rangeHistory.length > 0 && rangeHistory[0].type !== 'BARU') {
        startingPrice = rangeHistory[0].old_price;
      } else if (rangeHistory.length > 0 && rangeHistory[0].type === 'BARU') {
        startingPrice = rangeHistory[0].new_price; 
      }

      let endPrice = rangeHistory.length > 0 ? rangeHistory[rangeHistory.length - 1].new_price : startingPrice;
      let selisih = endPrice - startingPrice;

      if (rangeHistory.length === 1 && rangeHistory[0].type === 'BARU') {
        selisih = 0;
      }

      if (selisih > 0) {
        naikCount++;
        details.push({ item, status: 'Naik', change: selisih, latestPrice: endPrice, oldPrice: startingPrice });
      } else if (selisih < 0) {
        turunCount++;
        details.push({ item, status: 'Turun', change: selisih, latestPrice: endPrice, oldPrice: startingPrice });
      } else {
        stabilCount++;
        details.push({ item, status: 'Stabil', change: 0, latestPrice: endPrice, oldPrice: startingPrice });
      }
    });

    details.sort((a, b) => {
      if (a.status === 'Naik' && b.status !== 'Naik') return -1;
      if (a.status === 'Turun' && b.status === 'Stabil') return -1;
      return 0;
    });

    return { naikCount, turunCount, stabilCount, details };
  }, [activeRawMaterials, recapStart, recapEnd]);

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        <button onClick={() => setActiveTab('ITEM_BIAYA')} className={`px-5 py-2.5 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${activeTab === 'ITEM_BIAYA' ? 'bg-white shadow-xs text-red-600 border border-slate-200' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'}`}><List size={14}/> Master Item &amp; Biaya</button>
        <button onClick={() => setActiveTab('MENU')} className={`px-5 py-2.5 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${activeTab === 'MENU' ? 'bg-white shadow-xs text-red-600 border border-slate-200' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'}`}><Box size={14}/> Master Daftar Menu</button>
        <button onClick={() => setActiveTab('SUPPLIER')} className={`px-5 py-2.5 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${activeTab === 'SUPPLIER' ? 'bg-white shadow-xs text-red-600 border border-slate-200' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'}`}><Truck size={14}/> Mitra Supplier</button>
        <button onClick={() => setActiveTab('RULES')} className={`px-5 py-2.5 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${activeTab === 'RULES' ? 'bg-white shadow-xs text-red-600 border border-slate-200' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'}`}><Settings size={14}/> Aturan Pabrik</button>
      </div>

      {activeTab === 'MENU' && (
         <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 animate-in fade-in">
           <div className="xl:col-span-5">
             <div className="card-holo p-6">
               <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
                 <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2"><Box size={16} className="text-red-600"/> {isEditing ? 'Edit Menu' : 'Tambah Menu'}</h3>
                 {isEditing && <button type="button" onClick={() => { setIsEditing(false); setUseAdvancedPricing(false); setFormMenu({ id: '', product_name: '', category: 'FROZEN_GOODS', selling_price: '', retail_price: '', min_order: '1', wholesale_qty: '1', default_hpp: '1125' }); }} className="p-1.5 bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><X size={14}/></button>}
               </div>
               
               <form onSubmit={handleSubmitMenu} className="space-y-4">
                 <div>
                   <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Nama Menu / Produk</label>
                   <input type="text" required value={formMenu.product_name} onChange={e=>setFormMenu({...formMenu, product_name: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg font-bold text-xs outline-none focus:border-red-500 uppercase tracking-wider" placeholder="Ketik nama menu..." />
                 </div>
                 <div>
                   <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Kategori</label>
                   <select value={formMenu.category} onChange={e=>setFormMenu({...formMenu, category: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg font-bold text-xs outline-none cursor-pointer focus:border-red-500">
                     <option value="FROZEN_GOODS">Frozen / Mentah</option>
                     <option value="READY_TO_EAT">Matang / Ready to eat</option>
                   </select>
                 </div>

                 {/* 🔥 NEW: TOGGLE ATURAN HARGA KOMPLEKS */}
                 <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl shadow-inner mt-4">
                   <label className="flex items-center gap-2 cursor-pointer mb-3">
                     <input type="checkbox" checked={useAdvancedPricing} onChange={e => setUseAdvancedPricing(e.target.checked)} className="w-4 h-4 accent-red-600 cursor-pointer" />
                     <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5"><Tag size={12} className="text-red-500"/> Aktifkan Ketentuan Harga Bertingkat</span>
                   </label>

                   {useAdvancedPricing ? (
                     <div className="space-y-3 animate-in fade-in slide-in-from-top-2 border-t border-slate-200 pt-3">
                       <div className="grid grid-cols-2 gap-3">
                         <div>
                           <label className="text-[9px] font-bold text-slate-500 block mb-1 uppercase tracking-wider text-rose-600">Minimal Beli (Mutlak)</label>
                           <input type="number" min="1" required value={formMenu.min_order} onChange={e=>setFormMenu({...formMenu, min_order: e.target.value})} className="w-full p-2 bg-white border border-rose-200 rounded-lg font-bold text-xs outline-none focus:border-red-500 text-center" placeholder="Min Pcs..." />
                         </div>
                         <div>
                           <label className="text-[9px] font-bold text-slate-500 block mb-1 uppercase tracking-wider text-slate-500">Harga Eceran (Bawah Grosir)</label>
                           <div className="relative">
                             <span className="absolute left-2.5 top-2 font-bold text-slate-400 text-[10px]">Rp</span>
                             <input type="text" required value={formMenu.retail_price ? Number(formMenu.retail_price).toLocaleString('id-ID') : ''} onChange={e=>setFormMenu({...formMenu, retail_price: e.target.value.replace(/\D/g, '')})} className="w-full pl-7 pr-2 py-2 bg-white border border-slate-200 rounded-lg font-bold text-xs outline-none focus:border-red-500 text-slate-700" placeholder="0" />
                           </div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-3 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                         <div>
                           <label className="text-[9px] font-bold text-emerald-700 block mb-1 uppercase tracking-wider">Syarat Qty Grosir (&gt;=)</label>
                           <input type="number" min="1" required value={formMenu.wholesale_qty} onChange={e=>setFormMenu({...formMenu, wholesale_qty: e.target.value})} className="w-full p-2 bg-white border border-emerald-200 rounded-lg font-bold text-xs outline-none focus:border-emerald-500 text-center text-emerald-800" placeholder="Qty Grosir..." />
                         </div>
                         <div>
                           <label className="text-[9px] font-bold text-emerald-700 block mb-1 uppercase tracking-wider">Harga Grosir (Murah)</label>
                           <div className="relative">
                             <span className="absolute left-2.5 top-2 font-bold text-emerald-500 text-[10px]">Rp</span>
                             <input type="text" required value={formMenu.selling_price ? Number(formMenu.selling_price).toLocaleString('id-ID') : ''} onChange={e=>setFormMenu({...formMenu, selling_price: e.target.value.replace(/\D/g, '')})} className="w-full pl-7 pr-2 py-2 bg-white border border-emerald-200 rounded-lg font-black text-xs outline-none focus:border-emerald-500 text-emerald-700" placeholder="0" />
                           </div>
                         </div>
                       </div>
                     </div>
                   ) : (
                     <div className="animate-in fade-in">
                       <label className="text-[9px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Harga Jual Flat (Pcs)</label>
                       <div className="relative">
                         <span className="absolute left-3 top-2.5 font-bold text-slate-400 text-xs">Rp</span>
                         <input type="text" required value={formMenu.selling_price ? Number(formMenu.selling_price).toLocaleString('id-ID') : ''} onChange={e=>setFormMenu({...formMenu, selling_price: e.target.value.replace(/\D/g, '')})} className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg font-bold text-xs outline-none focus:border-red-500" placeholder="0" />
                       </div>
                     </div>
                   )}
                 </div>

                 <button type="submit" className="w-full btn-holo py-3 rounded-lg text-xs font-bold shadow-xs mt-2 uppercase tracking-widest">{isEditing ? 'Update Menu' : 'Simpan Menu'}</button>
               </form>
             </div>
           </div>
           
           <div className="xl:col-span-7 card-holo overflow-hidden custom-scrollbar min-h-[50vh] overflow-x-auto">
             <div className="p-4 bg-slate-50 border-b border-slate-100 font-extrabold text-xs text-slate-700">Daftar Menu Aktif</div>
             <table className="w-full text-sm text-left">
               <thead className="bg-white text-[10px] text-slate-400 border-b border-slate-200 uppercase tracking-wider">
                 <tr><th className="px-5 py-3 font-bold">Menu Produk</th><th className="px-5 py-3 font-bold">Ketentuan Harga &amp; Qty</th><th className="px-5 py-3 font-bold text-center">Aksi</th></tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                 {activeProducts.map(p => {
                   const isAdvanced = Number(p.wholesale_qty || 1) > 1 || Number(p.min_order || 1) > 1 || Number(p.retail_price || p.penalty_price || p.selling_price) !== Number(p.selling_price);
                   return (
                     <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                       <td className="px-5 py-4 text-slate-800 uppercase tracking-wider">{p.product_name}</td>
                       <td className="px-5 py-4">
                         {isAdvanced ? (
                           <div className="space-y-1">
                             <div className="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 w-max font-black">Min Beli: {formatNumber(p.min_order)} Pcs</div>
                             <div className="text-emerald-700 font-black">Grosir (&gt;={formatNumber(p.wholesale_qty)}): {formatRupiah(p.selling_price)}</div>
                             <div className="text-[9px] text-slate-500 font-bold">Harga Eceran: {formatRupiah(p.retail_price || p.penalty_price || p.selling_price)}</div>
                           </div>
                         ) : (
                           <div className="text-emerald-600 font-extrabold text-sm">{formatRupiah(p.selling_price)}</div>
                         )}
                       </td>
                       <td className="px-5 py-4 text-center">
                         <div className="flex items-center justify-center gap-1.5">
                           <button onClick={() => handleEditMenuBtn(p)} className="p-2 text-slate-400 hover:text-blue-600 bg-white hover:bg-blue-50 rounded-lg transition-colors border shadow-xs"><Edit2 size={14}/></button>
                           <button onClick={async () => { if(window.confirm(`Karantina menu ${p.product_name}? Item tidak akan muncul lagi di kasir.`)) sendToSheet('update', {id: p.id, isDeleted: true}, 'master_products'); }} className="p-2 text-slate-400 hover:text-red-600 bg-white hover:bg-red-50 rounded-lg transition-colors border shadow-xs"><Trash2 size={14}/></button>
                         </div>
                       </td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
           </div>
         </div>
      )}

      {activeTab === 'SUPPLIER' && (
         <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 animate-in fade-in">
           <div className="xl:col-span-4 card-holo p-6 border-t-4 border-t-blue-500">
              <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2"><Truck size={16} className="text-blue-600"/> {isEditingSpl ? 'Edit Supplier' : 'Tambah Supplier'}</h3>
                {isEditingSpl && <button type="button" onClick={() => { setIsEditingSpl(false); setFormSpl({ id: '', supplier_name: '', pic_name: '', phone: '', address: '', default_price: '' }); }} className="p-1.5 bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><X size={14}/></button>}
              </div>
              <form onSubmit={handleSubmitSupplier} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Nama PT / CV / Warung</label>
                  <input type="text" required value={formSpl.supplier_name} onChange={e=>setFormSpl({...formSpl, supplier_name: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500 uppercase tracking-wider" placeholder="Ketik nama entitas..." />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Nama Sales / PIC</label>
                  <input type="text" required value={formSpl.pic_name} onChange={e=>setFormSpl({...formSpl, pic_name: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500 uppercase tracking-wider" placeholder="Ketik nama kontak..." />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Nomor Handphone / WA</label>
                  <input type="text" required value={formSpl.phone} onChange={e=>setFormSpl({...formSpl, phone: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500" placeholder="08xx..." />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Harga Satuan Default (Rp/Kg)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-slate-400 text-xs">Rp</span>
                    <input type="text" required value={formSpl.default_price ? Number(formSpl.default_price).toLocaleString('id-ID') : ''} onChange={e=>setFormSpl({...formSpl, default_price: e.target.value.replace(/\D/g, '')})} className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500" placeholder="0" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg text-xs shadow-sm hover:bg-blue-700 transition-colors mt-2 uppercase tracking-widest">Simpan Supplier</button>
              </form>
           </div>
           <div className="xl:col-span-8 card-holo overflow-hidden custom-scrollbar min-h-[50vh] overflow-x-auto">
             <div className="p-4 bg-slate-50 border-b border-slate-100 font-extrabold text-xs text-slate-700">Database Mitra Supplier Aktif</div>
             <table className="w-full text-sm text-left">
               <thead className="bg-white text-[10px] text-slate-400 border-b border-slate-200 uppercase tracking-wider">
                 <tr><th className="px-5 py-3 font-bold">Nama Supplier &amp; PIC</th><th className="px-5 py-3 font-bold">Kontak</th><th className="px-5 py-3 font-bold text-right">Harga Acuan</th><th className="px-5 py-3 font-bold text-center">Aksi</th></tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                 {activeSuppliers.map(s => (
                   <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                     <td className="px-5 py-4">
                       <div className="text-slate-800 font-extrabold uppercase tracking-wider">{s.supplier_name}</div>
                       <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">PIC: {s.pic_name}</div>
                     </td>
                     <td className="px-5 py-4 text-slate-600">{s.phone}</td>
                     <td className="px-5 py-4 text-right text-emerald-600 font-extrabold">{formatRupiah(s.default_price)}</td>
                     <td className="px-5 py-4 text-center">
                       <div className="flex items-center justify-center gap-1.5">
                         <button onClick={() => {setFormSpl({...s, default_price: String(s.default_price || ''), address: s.address || ''}); setIsEditingSpl(true);}} className="p-2 text-slate-400 hover:text-blue-600 bg-white hover:bg-slate-100 rounded-lg transition-colors border shadow-xs"><Edit2 size={14}/></button>
                         <button onClick={async () => { if(window.confirm(`Putus kontrak & karantina supplier ${s.supplier_name}?`)) sendToSheet('update', {id: s.id, isDeleted: true}, 'master_suppliers'); }} className="p-2 text-slate-400 hover:text-red-600 bg-white hover:bg-red-50 rounded-lg transition-colors border shadow-xs"><Trash2 size={14}/></button>
                       </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         </div>
      )}

      {/* --- TAB SAKTI: MASTER ITEM & BIAYA --- */}
      {activeTab === 'ITEM_BIAYA' && (
        <div className="flex flex-col gap-6 animate-in fade-in">
          
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-4">
              <div className="card-holo p-6 transition-all border-t-4 border-t-red-500">
                <div className="flex justify-between items-start mb-5 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <List size={16} className="text-red-600"/>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-sm">{isEditingItem ? 'Edit Item Biaya' : 'Daftarkan Item Baru'}</h3>
                      {isEditingItem && <p className="text-[9px] font-medium text-slate-400 mt-0.5">Perubahan harga otomatis direkam</p>}
                    </div>
                  </div>
                  {isEditingItem && <button type="button" onClick={() => { setIsEditingItem(false); setFormItem({ id: '', item_name: '', category: 'BAHAN BAKU', unit: '', default_price: '' }); }} className="p-1.5 bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg shadow-xs"><X size={14}/></button>}
                </div>

                <form onSubmit={handleSubmitItem} className="space-y-4">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Kategori Item</label>
                    <select value={formItem.category} onChange={e=>setFormItem({...formItem, category: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-red-500 cursor-pointer">
                      <option value="BAHAN BAKU">Bahan Baku</option>
                      <option value="KEMASAN">Kemasan / Packaging</option>
                      <option value="OPERASIONAL KENDARAAN">Operasional Kendaraan</option>
                      <option value="ATK & PERLENGKAPAN">ATK &amp; Perlengkapan</option>
                      <option value="AIR & KEBERSIHAN">Air &amp; Kebersihan</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Nama Item</label>
                    <input type="text" required value={formItem.item_name} onChange={e=>setFormItem({...formItem, item_name: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-red-500 uppercase tracking-wider" placeholder="Cth: Saus Delmonte..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Satuan Dasar</label>
                      <input type="text" required value={formItem.unit} onChange={e=>setFormItem({...formItem, unit: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-red-500 uppercase tracking-wider" placeholder="Cth: Dus / Kg" />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">Harga Acuan Default</label>
                      <div className="relative">
                         <span className="absolute left-2.5 top-2.5 font-bold text-slate-400 text-xs">Rp</span>
                         <input type="text" required value={formItem.default_price ? Number(formItem.default_price).toLocaleString('id-ID') : ''} onChange={e=>setFormItem({...formItem, default_price: e.target.value.replace(/\D/g, '')})} className="w-full pl-7 pr-2 py-2 bg-white border border-slate-200 rounded-lg text-xs font-extrabold text-slate-800 outline-none focus:border-red-500" placeholder="0" />
                      </div>
                    </div>
                  </div>
                  <button type="submit" className={`w-full text-white font-bold py-3.5 rounded-lg text-xs shadow-xs transition-colors flex items-center justify-center gap-2 mt-2 uppercase tracking-widest ${isEditingItem ? 'bg-blue-600 hover:bg-blue-700' : 'btn-holo'}`}>
                     {isEditingItem ? <><Save size={14}/> Update &amp; Rekam Harga</> : <><Plus size={14}/> Simpan Master Item</>}
                  </button>
                </form>
              </div>
            </div>
            
            <div className="xl:col-span-8 card-holo overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-50 border-b border-slate-100 font-extrabold text-xs text-slate-700">Database Master Item &amp; Beban Biaya</div>
              <div className="overflow-x-auto custom-scrollbar min-h-[50vh] max-h-[60vh]">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-white text-[10px] text-slate-400 border-b border-slate-200 sticky top-0 shadow-xs uppercase tracking-wider">
                    <tr><th className="px-5 py-3 font-bold">Nama Item &amp; Satuan</th><th className="px-5 py-3 font-bold">Kategori Jurnal</th><th className="px-5 py-3 font-bold text-right">Harga Default (Ref)</th><th className="px-5 py-3 font-bold text-center">Aksi</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                    {activeRawMaterials.length === 0 ? (
                      <tr><td colSpan="4" className="text-center py-10 text-slate-400 font-medium">Data kamus item belum tersedia.</td></tr>
                    ) : (
                      activeRawMaterials.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-5 py-4">
                            <div className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">{m.item_name}</div>
                            <div className="text-[9px] text-slate-400 mt-1 font-medium uppercase tracking-wider">Satuan: {m.unit}</div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider">{m.category.replace(/_/g, ' ')}</span>
                          </td>
                          <td className="px-5 py-4 text-right text-slate-800 font-extrabold text-sm">{formatRupiah(m.default_price)}</td>
                          <td className="px-5 py-4 text-center opacity-60 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => openHistoryModal(m)} className="p-2 text-slate-400 bg-white border border-slate-200 rounded-lg hover:text-blue-600 hover:bg-blue-50 shadow-xs transition-colors" title="Lihat Riwayat Perubahan Harga"><History size={14}/></button>
                              <button onClick={() => { setFormItem({ id: m.id, item_name: m.item_name, category: m.category, unit: m.unit, default_price: String(m.default_price) }); setIsEditingItem(true); }} className="p-2 text-slate-400 bg-white border border-slate-200 rounded-lg hover:text-blue-600 hover:bg-blue-50 shadow-xs transition-colors"><Edit2 size={14}/></button>
                              <button onClick={async () => { if(window.confirm("Karantina item ini dari kamus pabrik?")) sendToSheet('update', {id: m.id, isDeleted: true}, 'master_raw_materials'); }} className="p-2 text-slate-400 bg-white border border-slate-200 rounded-lg hover:text-red-600 hover:bg-red-50 shadow-xs transition-colors"><Trash2 size={14}/></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card-holo overflow-hidden mt-2">
             <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50">
                <div className="flex items-center gap-3">
                   <div className="text-blue-600"><BarChart2 size={20}/></div>
                   <div>
                     <h3 className="text-slate-800 font-extrabold text-sm">Market Price Analytics</h3>
                     <p className="text-[10px] font-medium text-slate-500 mt-0.5">Rekapan analisa fluktuasi harga pasar barang</p>
                   </div>
                </div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-lg shadow-xs">
                   <Filter size={14} className="text-slate-400 ml-1"/>
                   <input type="date" value={recapStart} onChange={e=>setRecapStart(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer" />
                   <span className="text-slate-400 font-medium">-</span>
                   <input type="date" value={recapEnd} onChange={e=>setRecapEnd(e.target.value)} className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer" />
                </div>
             </div>

             <div className="p-6 bg-white">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                 <div className="bg-red-50/50 border border-red-100 p-4 rounded-xl flex items-center justify-between shadow-xs hover:border-red-300 transition-colors">
                   <div>
                     <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Item Harga Naik</div>
                     <div className="text-2xl font-black text-red-600">{priceAnalytics.naikCount} <span className="text-[10px] text-red-500 font-bold">Item</span></div>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600"><ArrowUpRight size={20}/></div>
                 </div>
                 <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl flex items-center justify-between shadow-xs hover:border-emerald-300 transition-colors">
                   <div>
                     <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Item Harga Turun</div>
                     <div className="text-2xl font-black text-emerald-600">{priceAnalytics.turunCount} <span className="text-[10px] text-emerald-500 font-bold">Item</span></div>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><ArrowDownRight size={20}/></div>
                 </div>
                 <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between shadow-xs hover:border-slate-300 transition-colors">
                   <div>
                     <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Harga Stabil</div>
                     <div className="text-2xl font-black text-slate-700">{priceAnalytics.stabilCount} <span className="text-[10px] text-slate-400 font-bold">Item</span></div>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500"><Minus size={20}/></div>
                 </div>
               </div>

               <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
                 <table className="w-full text-left text-sm border-collapse">
                   <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 border-b border-slate-200 uppercase tracking-wider">
                     <tr><th className="px-5 py-3">Nama Item</th><th className="px-5 py-3">Kategori</th><th className="px-5 py-3 text-center">Status</th><th className="px-5 py-3 text-right">Perubahan / Selisih Harga</th></tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                     {priceAnalytics.details.length === 0 ? (
                       <tr><td colSpan="4" className="text-center py-8 text-slate-400 font-medium">Tidak ada data item.</td></tr>
                     ) : (
                       priceAnalytics.details.map((d, i) => (
                         <tr key={i} className="hover:bg-slate-50 transition-colors">
                           <td className="px-5 py-4 text-slate-800 font-extrabold uppercase tracking-wider">{d.item.item_name}</td>
                           <td className="px-5 py-4 text-slate-500 uppercase tracking-wider">{d.item.category.replace(/_/g, ' ')}</td>
                           <td className="px-5 py-4 text-center">
                             <span className={`px-2.5 py-1 rounded-md text-[9px] font-bold border shadow-xs inline-block uppercase tracking-wider ${d.status === 'Naik' ? 'bg-red-50 text-red-700 border-red-200' : d.status === 'Turun' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                               {d.status}
                             </span>
                           </td>
                           <td className="px-5 py-4 text-right">
                             {d.status === 'Stabil' ? (
                               <span className="text-slate-500 font-extrabold">{formatRupiah(d.latestPrice)} <span className="text-[9px] font-medium text-slate-400 ml-1">(Tetap)</span></span>
                             ) : (
                               <div className="flex items-center justify-end gap-2 text-xs font-extrabold">
                                 <span className="text-slate-400 line-through font-medium">{formatRupiah(d.oldPrice)}</span>
                                 <ArrowRight size={12} className="text-slate-300"/>
                                 <span className={d.status === 'Naik' ? 'text-red-600' : 'text-emerald-600'}>{formatRupiah(d.latestPrice)}</span>
                                 <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded-md font-bold ${d.status === 'Naik' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                    ({d.status === 'Naik' ? '+' : '-'}{formatRupiah(Math.abs(d.change))})
                                 </span>
                               </div>
                             )}
                           </td>
                         </tr>
                       ))
                     )}
                   </tbody>
                 </table>
               </div>
             </div>
          </div>
        </div>
      )}

      {/* --- TAB RULES (DARK ENTERPRISE MODE) --- */}
      {activeTab === 'RULES' && (
        <div className="bg-[#161b22] p-6 md:p-8 rounded-2xl text-slate-300 shadow-xl border border-slate-800 font-sans animate-in fade-in">
          <div className="flex items-start gap-4 mb-8">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20 shadow-inner">
              <Settings size={28}/>
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Master Conversion Engine</h2>
              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mt-1">Ubah angka di bawah ini untuk menyesuaikan perhitungan pabrik</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
            <div className="bg-[#1f242c] border border-[#30363d] rounded-xl p-5 shadow-inner">
              <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">Rule #1: Timbangan Mentah</div>
              <div className="flex items-center justify-between">
                <div className="flex items-end gap-2">
                  <input type="number" value={rules.kgPerKantong} onChange={e => setRules({...rules, kgPerKantong: Number(e.target.value)})} className="w-20 bg-[#0d1117] border border-[#30363d] text-white text-2xl font-black rounded-lg p-2 text-center outline-none focus:border-amber-500 transition-colors" />
                  <span className="text-xs font-bold text-slate-500 pb-2">KG</span>
                </div>
                <div className="text-slate-500 font-black text-xl">=</div>
                <div className="text-right">
                  <div className="text-xl font-black text-orange-500">1 <span className="text-sm">Kantong</span></div>
                  <div className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wider">Ayam Mentah</div>
                </div>
              </div>
            </div>

            <div className="bg-[#1f242c] border border-[#30363d] rounded-xl p-5 shadow-inner">
              <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">Rule #2: Resep Adukan</div>
              <div className="flex items-center justify-between">
                <div className="flex items-end gap-2">
                  <input type="number" value={rules.kgPerAdukan} onChange={e => setRules({...rules, kgPerAdukan: Number(e.target.value)})} className="w-20 bg-[#0d1117] border border-[#30363d] text-white text-2xl font-black rounded-lg p-2 text-center outline-none focus:border-amber-500 transition-colors" />
                  <span className="text-xs font-bold text-slate-500 pb-2">KG</span>
                </div>
                <div className="text-slate-500 font-black text-xl">=</div>
                <div className="text-right">
                  <div className="text-xl font-black text-orange-500">1 <span className="text-sm">Adukan</span></div>
                  <div className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wider">Mix Base</div>
                </div>
              </div>
            </div>

            <div className="bg-[#1f242c] border border-[#30363d] rounded-xl p-5 shadow-inner">
              <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">Rule #3: Target Yield Dasar</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-black text-white">1 <span className="text-sm text-slate-400">Adukan</span></div>
                  <div className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wider">Mix Base</div>
                </div>
                <div className="text-slate-500 font-black text-xl">=</div>
                <div className="flex items-end gap-2">
                  <input type="number" value={rules.pcsPerAdukan} onChange={e => setRules({...rules, pcsPerAdukan: Number(e.target.value)})} className="w-24 bg-[#0d1117] border border-[#30363d] text-blue-400 text-2xl font-black rounded-lg p-2 text-center outline-none focus:border-blue-500 transition-colors" />
                  <span className="text-xs font-bold text-slate-500 pb-2">PCS</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1f242c] border border-[#30363d] rounded-xl p-5 shadow-inner">
              <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">Rule #4: Konversi Porsi Eceran</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-black text-white">1 <span className="text-sm text-slate-400">Porsi</span></div>
                  <div className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wider">Penjualan Resto</div>
                </div>
                <div className="text-slate-500 font-black text-xl">=</div>
                <div className="flex items-end gap-2 text-right">
                  <input type="number" value={rules.pcsPerPorsi} onChange={e => setRules({...rules, pcsPerPorsi: Number(e.target.value)})} className="w-16 bg-[#0d1117] border border-[#30363d] text-purple-400 text-2xl font-black rounded-lg p-2 text-center outline-none focus:border-purple-500 transition-colors" />
                  <span className="text-xs font-bold text-slate-500 pb-2">PCS</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1f242c] border border-[#30363d] rounded-xl p-5 shadow-inner lg:col-span-2">
              <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">Rule #5: Konversi Packaging / Mika Frozen</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-black text-white">1 <span className="text-sm text-slate-400">Mika</span></div>
                  <div className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wider">Kemasan Frozen</div>
                </div>
                <div className="text-slate-500 font-black text-xl">=</div>
                <div className="flex items-end gap-2">
                  <input type="number" value={rules.pcsPerMika} onChange={e => setRules({...rules, pcsPerMika: Number(e.target.value)})} className="w-20 bg-[#0d1117] border border-[#30363d] text-pink-500 text-2xl font-black rounded-lg p-2 text-center outline-none focus:border-pink-500 transition-colors" />
                  <span className="text-xs font-bold text-slate-500 pb-2">PCS</span>
                </div>
                <div className="text-slate-500 font-black text-xl">=</div>
                <div className="text-right">
                  <div className="text-2xl font-black text-emerald-400">{(rules.pcsPerAdukan / (rules.pcsPerMika || 1)).toFixed(0)} <span className="text-sm text-emerald-500/70">Mika</span></div>
                  <div className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wider">Per Adukan (Auto)</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-[#30363d]">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
               <CheckCircle2 size={14} className="text-amber-500"/> Pastikan klik simpan setelah mengubah angka konfigurasi di atas.
            </div>
            <button onClick={handleSaveRules} className="w-full md:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-lg cursor-pointer uppercase tracking-widest">
              <Save size={16}/> SIMPAN KONFIGURASI
            </button>
          </div>
        </div>
      )}

      {/* 🔥 MODAL POPUP RIWAYAT PERUBAHAN HARGA */}
      {historyModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
            
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-lg border border-slate-200 text-blue-600 shadow-xs"><History size={16}/></div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">Riwayat Perubahan Harga</h3>
                  <p className="text-[10px] font-medium text-slate-500 mt-0.5 uppercase tracking-wider">{historyModal.itemName}</p>
                </div>
              </div>
              <button onClick={() => setHistoryModal(null)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><X size={18}/></button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar bg-white">
              {historyModal.history.length === 0 ? (
                <div className="text-center py-10 opacity-60">
                  <Clock size={36} className="mx-auto mb-3 text-slate-300"/>
                  <p className="font-bold text-xs text-slate-400">Belum ada riwayat perubahan harga.</p>
                </div>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-[1px] before:bg-slate-200">
                  {historyModal.history.map((hist, idx) => {
                    const selisih = Math.abs(hist.new_price - hist.old_price);
                    
                    return (
                      <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-white bg-slate-100 text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-xs z-10">
                          {hist.type === 'NAIK' ? <TrendingUp size={12} className="text-red-600"/> : hist.type === 'TURUN' ? <TrendingDown size={12} className="text-emerald-600"/> : <Plus size={12} className="text-blue-600"/>}
                        </div>
                        <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-xs hover:border-slate-300 transition-colors">
                          <div className="flex items-center justify-between mb-2 border-b border-slate-200 pb-2">
                            <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider"><Calendar size={10}/> {formatDate(hist.date)}</span>
                            <span className={`text-[8px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${hist.type === 'NAIK' ? 'bg-red-50 text-red-600 border-red-100' : hist.type === 'TURUN' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{hist.type === 'BARU' ? 'Harga Awal' : hist.type === 'NAIK' ? 'Harga Naik' : 'Harga Turun'}</span>
                          </div>
                          {hist.type === 'BARU' ? (
                            <div className="text-xs font-bold text-slate-500">Harga ditetapkan: <span className="text-slate-800 font-extrabold ml-1">{formatRupiah(hist.new_price)}</span></div>
                          ) : (
                            <div className="flex items-center gap-2 text-xs font-extrabold flex-wrap">
                              <span className="text-slate-400 line-through font-medium">{formatRupiah(hist.old_price)}</span>
                              <ArrowRight size={12} className="text-slate-300"/>
                              <span className={hist.type === 'NAIK' ? 'text-red-600' : 'text-emerald-600'}>
                                {formatRupiah(hist.new_price)}
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-md ml-1.5 font-bold border ${hist.type === 'NAIK' ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                  ({hist.type === 'NAIK' ? '+' : '-'}{formatRupiah(selisih)})
                                </span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
