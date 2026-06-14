import React, { useState, useMemo } from 'react';
import { 
  Box, Settings, Layers, Package, Truck, 
  Plus, Edit2, Trash2, Save, X, Calculator, ShieldCheck, 
  CheckCircle2, User, Phone, MapPin, List, History, 
  TrendingUp, TrendingDown, ArrowRight, Clock, 
  Calendar, BarChart2, Filter, ArrowUpRight, ArrowDownRight, Minus
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

  const [activeTab, setActiveTab] = useState('ITEM_BIAYA'); 
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSpl, setIsEditingSpl] = useState(false);
  const [isEditingItem, setIsEditingItem] = useState(false);
  
  // STATE MODAL RIWAYAT
  const [historyModal, setHistoryModal] = useState(null);

  // 🔥 STATE FILTER REKAPAN ANALISA HARGA
  const [recapStart, setRecapStart] = useState(() => {
    const d = new Date();
    d.setDate(1); // Set default ke awal bulan
    return d.toISOString().substring(0, 10);
  });
  const [recapEnd, setRecapEnd] = useState(todayStr);

  // --- SINKRONISASI DATABASE ---
  const realProducts = useMemo(() => master_products || masterProducts || [], [master_products, masterProducts]);
  const realSuppliers = useMemo(() => master_suppliers || masterSuppliers || [], [master_suppliers, masterSuppliers]);
  const realRawMaterials = useMemo(() => master_raw_materials || masterRawMaterials || [], [master_raw_materials, masterRawMaterials]);
  
  const [rules, setRules] = useState({
    kgPerKantong: 10, kgPerAdukan: 30, pcsPerAdukan: 1000, pcsPerPorsi: 4, pcsPerMika: 50
  });

  const [formMenu, setFormMenu] = useState({ id: '', product_name: '', category: 'FROZEN_GOODS', selling_price: '', default_hpp: '1125', min_order: '1', penalty_price: '0' });
  const [formSpl, setFormSpl] = useState({ id: '', supplier_name: '', pic_name: '', phone: '', address: '' });
  const [formItem, setFormItem] = useState({ id: '', item_name: '', category: 'BAHAN BAKU', unit: '', default_price: '' });

  const activeProducts = useMemo(() => realProducts.filter(p => !p.isDeleted && String(p.isDeleted).toUpperCase() !== 'TRUE').reverse(), [realProducts]);
  const activeSuppliers = useMemo(() => realSuppliers.filter(s => !s.isDeleted && String(s.isDeleted).toUpperCase() !== 'TRUE').reverse(), [realSuppliers]);
  const activeRawMaterials = useMemo(() => realRawMaterials.filter(m => !m.isDeleted && String(m.isDeleted).toUpperCase() !== 'TRUE').reverse(), [realRawMaterials]);

  // --- ACTIONS: SUBMIT MENU ---
  const handleSubmitMenu = async (e) => {
    e.preventDefault();
    if (!formMenu.product_name) return alert("Nama menu tidak boleh kosong!");
    const productId = isEditing ? formMenu.id : generateId('PRD', todayStr);
    const payload = {
      id: productId, date: todayStr, branch_id: currentBranch, isDeleted: false, product_name: formMenu.product_name.toUpperCase(),
      sku: formMenu.product_name.substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 1000),
      category: formMenu.category, unit: 'PCS', selling_price: Number(formMenu.selling_price || 0),
      default_hpp: Number(formMenu.default_hpp || 1125), status_active: true, min_order: Number(formMenu.min_order || 1), penalty_price: Number(formMenu.penalty_price || 0)
    };
    const isSuccess = await sendToSheet(isEditing ? 'update' : 'insert', payload, 'master_products');
    if (isSuccess) {
      showToast(isEditing ? 'Data Menu berhasil diperbarui!' : 'Menu Baru berhasil ditambah!', 'success');
      setIsEditing(false); setFormMenu({ id: '', product_name: '', category: 'FROZEN_GOODS', selling_price: '', default_hpp: '1125', min_order: '1', penalty_price: '0' });
    }
  };

  // --- ACTIONS: SUBMIT SUPPLIER ---
  const handleSubmitSupplier = async (e) => {
    e.preventDefault();
    if (!formSpl.supplier_name) return alert("Nama perusahaan supplier wajib diisi!");
    const splId = isEditingSpl ? formSpl.id : generateId('SPL', todayStr);
    const payload = {
      id: splId, date: todayStr, branch_id: currentBranch, isDeleted: false,
      supplier_name: formSpl.supplier_name.toUpperCase(), pic_name: formSpl.pic_name.toUpperCase(), phone: formSpl.phone, address: formSpl.address.toUpperCase()
    };
    const isSuccess = await sendToSheet(isEditingSpl ? 'update' : 'insert', payload, 'master_suppliers');
    if (isSuccess) {
      showToast(isEditingSpl ? 'Data Supplier diperbarui!' : 'Supplier resmi terdaftar!', 'success');
      setIsEditingSpl(false); setFormSpl({ id: '', supplier_name: '', pic_name: '', phone: '', address: '' });
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
      showToast(isEditingItem ? 'Data Item Biaya & Harga diperbarui!' : 'Item Biaya Baru terdaftar!', 'success');
      setIsEditingItem(false); setFormItem({ id: '', item_name: '', category: 'BAHAN BAKU', unit: '', default_price: '' });
    }
  };

  const openHistoryModal = (item) => {
    let history = [];
    if (item.price_history) { try { history = JSON.parse(item.price_history).reverse(); } catch(e) {} }
    setHistoryModal({ itemName: item.item_name, history: history });
  };

  // 🔥 ENGINE ANALISA REKAPAN PERUBAHAN HARGA PASAR
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
      
      {/* FILTER TABS - FLAT ENTERPRISE */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        <button onClick={() => setActiveTab('ITEM_BIAYA')} className={`px-5 py-2.5 rounded-lg font-bold text-xs normal-case transition-all flex items-center gap-2 ${activeTab === 'ITEM_BIAYA' ? 'bg-white shadow-xs text-red-600 border border-slate-200' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'}`}><List size={14}/> Master item &amp; biaya</button>
        <button onClick={() => setActiveTab('MENU')} className={`px-5 py-2.5 rounded-lg font-bold text-xs normal-case transition-all flex items-center gap-2 ${activeTab === 'MENU' ? 'bg-white shadow-xs text-red-600 border border-slate-200' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'}`}><Box size={14}/> Master daftar menu</button>
        <button onClick={() => setActiveTab('SUPPLIER')} className={`px-5 py-2.5 rounded-lg font-bold text-xs normal-case transition-all flex items-center gap-2 ${activeTab === 'SUPPLIER' ? 'bg-white shadow-xs text-red-600 border border-slate-200' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'}`}><Truck size={14}/> Mitra supplier</button>
        <button onClick={() => setActiveTab('RULES')} className={`px-5 py-2.5 rounded-lg font-bold text-xs normal-case transition-all flex items-center gap-2 ${activeTab === 'RULES' ? 'bg-white shadow-xs text-red-600 border border-slate-200' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'}`}><Settings size={14}/> Aturan pabrik</button>
      </div>

      {activeTab === 'MENU' && (
         <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 animate-in fade-in">
           <div className="xl:col-span-4">
             <div className="card-holo p-6">
               <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
                 <h3 className="font-extrabold text-slate-800 normal-case text-sm flex items-center gap-2"><Box size={16} className="text-red-600"/> {isEditing ? 'Edit menu' : 'Tambah menu'}</h3>
                 {isEditing && <button type="button" onClick={() => { setIsEditing(false); setFormMenu({ id: '', product_name: '', category: 'FROZEN_GOODS', selling_price: '', default_hpp: '1125', min_order: '1', penalty_price: '0' }); }} className="p-1.5 bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><X size={14}/></button>}
               </div>
               <form onSubmit={handleSubmitMenu} className="space-y-4">
                 <div>
                   <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Nama menu / Produk</label>
                   <input type="text" required value={formMenu.product_name} onChange={e=>setFormMenu({...formMenu, product_name: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg font-bold text-xs normal-case outline-none focus:border-red-500" placeholder="Ketik nama menu..." />
                 </div>
                 <div>
                   <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Kategori</label>
                   <select value={formMenu.category} onChange={e=>setFormMenu({...formMenu, category: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg font-bold text-xs normal-case outline-none cursor-pointer focus:border-red-500">
                     <option value="FROZEN_GOODS">Frozen / Mentah</option>
                     <option value="READY_TO_EAT">Matang / Ready to eat</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Harga jual (Pcs)</label>
                   <div className="relative">
                     <span className="absolute left-3 top-2.5 font-bold text-slate-400 text-xs">Rp</span>
                     <input type="text" required value={formMenu.selling_price ? Number(formMenu.selling_price).toLocaleString('id-ID') : ''} onChange={e=>setFormMenu({...formMenu, selling_price: e.target.value.replace(/\D/g, '')})} className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg font-bold text-xs outline-none focus:border-red-500" placeholder="0" />
                   </div>
                 </div>
                 <button type="submit" className="w-full btn-holo py-3 rounded-lg text-xs font-bold shadow-xs mt-2">Simpan menu</button>
               </form>
             </div>
           </div>
           <div className="xl:col-span-8 card-holo overflow-hidden custom-scrollbar min-h-[50vh] overflow-x-auto">
             <div className="p-4 bg-slate-50 border-b border-slate-100 font-extrabold text-xs normal-case text-slate-700">Daftar menu aktif</div>
             <table className="w-full text-sm text-left">
               <thead className="bg-white text-[10px] normal-case text-slate-400 border-b border-slate-200">
                 <tr><th className="px-5 py-3 font-bold">Menu</th><th className="px-5 py-3 font-bold">Harga</th><th className="px-5 py-3 font-bold text-center">Aksi</th></tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                 {activeProducts.map(p => (
                   <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                     <td className="px-5 py-4 normal-case text-slate-800">{p.product_name}</td>
                     <td className="px-5 py-4 text-emerald-600 font-extrabold">{formatRupiah(p.selling_price)}</td>
                     <td className="px-5 py-4 text-center">
                       <button onClick={()=> {setFormMenu(p); setIsEditing(true);}} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors border shadow-xs"><Edit2 size={14}/></button>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         </div>
      )}

      {activeTab === 'SUPPLIER' && (
         <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 animate-in fade-in">
           <div className="xl:col-span-4 card-holo p-6 border-t-4 border-t-blue-500">
              <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-800 normal-case text-sm flex items-center gap-2"><Truck size={16} className="text-blue-600"/> {isEditingSpl ? 'Edit supplier' : 'Tambah supplier'}</h3>
                {isEditingSpl && <button type="button" onClick={() => { setIsEditingSpl(false); setFormSpl({ id: '', supplier_name: '', pic_name: '', phone: '', address: '' }); }} className="p-1.5 bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><X size={14}/></button>}
              </div>
              <form onSubmit={handleSubmitSupplier} className="space-y-4">
                <div>
                  <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Nama PT / CV / Warung</label>
                  <input type="text" required value={formSpl.supplier_name} onChange={e=>setFormSpl({...formSpl, supplier_name: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold normal-case outline-none focus:border-blue-500" placeholder="Ketik nama entitas..." />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Nama Sales / PIC</label>
                  <input type="text" required value={formSpl.pic_name} onChange={e=>setFormSpl({...formSpl, pic_name: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold normal-case outline-none focus:border-blue-500" placeholder="Ketik nama kontak..." />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Nomor Handphone / WA</label>
                  <input type="text" required value={formSpl.phone} onChange={e=>setFormSpl({...formSpl, phone: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500" placeholder="08xx..." />
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg text-xs normal-case shadow-sm hover:bg-blue-700 transition-colors mt-2">Simpan supplier</button>
              </form>
           </div>
           <div className="xl:col-span-8 card-holo overflow-hidden custom-scrollbar min-h-[50vh] overflow-x-auto">
             <div className="p-4 bg-slate-50 border-b border-slate-100 font-extrabold text-xs normal-case text-slate-700">Database mitra supplier aktif</div>
             <table className="w-full text-sm text-left">
               <thead className="bg-white text-[10px] normal-case text-slate-400 border-b border-slate-200">
                 <tr><th className="px-5 py-3 font-bold">Nama supplier &amp; PIC</th><th className="px-5 py-3 font-bold">Kontak</th><th className="px-5 py-3 font-bold text-center">Aksi</th></tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                 {activeSuppliers.map(s => (
                   <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                     <td className="px-5 py-4">
                       <div className="text-slate-800 font-extrabold normal-case">{s.supplier_name}</div>
                       <div className="text-[10px] font-medium text-slate-500 normal-case mt-0.5">PIC: {s.pic_name}</div>
                     </td>
                     <td className="px-5 py-4 text-slate-600">{s.phone}</td>
                     <td className="px-5 py-4 text-center">
                       <button onClick={() => {setFormSpl(s); setIsEditingSpl(true);}} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors border shadow-xs"><Edit2 size={14}/></button>
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
                      <h3 className="font-extrabold text-slate-800 normal-case text-sm">{isEditingItem ? 'Edit item biaya' : 'Daftarkan item baru'}</h3>
                      {isEditingItem && <p className="text-[9px] font-medium text-slate-400 normal-case mt-0.5">Perubahan harga otomatis direkam</p>}
                    </div>
                  </div>
                  {isEditingItem && <button type="button" onClick={() => { setIsEditingItem(false); setFormItem({ id: '', item_name: '', category: 'Bahan Baku', unit: '', default_price: '' }); }} className="p-1.5 bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg shadow-xs"><X size={14}/></button>}
                </div>

                <form onSubmit={handleSubmitItem} className="space-y-4">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Kategori item</label>
                    <select value={formItem.category} onChange={e=>setFormItem({...formItem, category: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold normal-case outline-none focus:border-red-500 cursor-pointer">
                      <option value="BAHAN BAKU">Bahan baku</option>
                      <option value="KEMASAN">Kemasan / Packaging</option>
                      <option value="OPERASIONAL KENDARAAN">Operasional kendaraan</option>
                      <option value="ATK & PERLENGKAPAN">ATK &amp; perlengkapan</option>
                      <option value="AIR & KEBERSIHAN">Air &amp; kebersihan</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Nama item</label>
                    <input type="text" required value={formItem.item_name} onChange={e=>setFormItem({...formItem, item_name: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold normal-case outline-none focus:border-red-500" placeholder="Cth: Saus Delmonte..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Satuan dasar</label>
                      <input type="text" required value={formItem.unit} onChange={e=>setFormItem({...formItem, unit: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold normal-case outline-none focus:border-red-500" placeholder="Cth: Dus / Kg" />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Harga acuan default</label>
                      <div className="relative">
                         <span className="absolute left-2.5 top-2.5 font-bold text-slate-400 text-xs">Rp</span>
                         <input type="text" required value={formItem.default_price ? Number(formItem.default_price).toLocaleString('id-ID') : ''} onChange={e=>setFormItem({...formItem, default_price: e.target.value.replace(/\D/g, '')})} className="w-full pl-7 pr-2 py-2 bg-white border border-slate-200 rounded-lg text-xs font-extrabold text-slate-800 outline-none focus:border-red-500" placeholder="0" />
                      </div>
                    </div>
                  </div>
                  <button type="submit" className={`w-full text-white font-bold py-3.5 rounded-lg text-xs normal-case shadow-xs transition-colors flex items-center justify-center gap-2 mt-2 ${isEditingItem ? 'bg-blue-600 hover:bg-blue-700' : 'btn-holo'}`}>
                     {isEditingItem ? <><Save size={14}/> Update &amp; rekam harga</> : <><Plus size={14}/> Simpan master item</>}
                  </button>
                </form>
              </div>
            </div>
            
            <div className="xl:col-span-8 card-holo overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-50 border-b border-slate-100 font-extrabold text-xs normal-case text-slate-700">Database master item &amp; beban biaya</div>
              <div className="overflow-x-auto custom-scrollbar min-h-[50vh] max-h-[60vh]">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-white text-[10px] normal-case text-slate-400 border-b border-slate-200 sticky top-0 shadow-xs">
                    <tr><th className="px-5 py-3 font-bold">Nama item &amp; satuan</th><th className="px-5 py-3 font-bold">Kategori jurnal</th><th className="px-5 py-3 font-bold text-right">Harga default (Ref)</th><th className="px-5 py-3 font-bold text-center">Aksi</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                    {activeRawMaterials.length === 0 ? (
                      <tr><td colSpan="4" className="text-center py-10 text-slate-400 normal-case font-medium">Data kamus item belum tersedia.</td></tr>
                    ) : (
                      activeRawMaterials.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-5 py-4">
                            <div className="text-sm font-extrabold text-slate-800 normal-case">{m.item_name}</div>
                            <div className="text-[9px] text-slate-400 mt-1 normal-case font-medium">Satuan: {m.unit}</div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md text-[9px] font-bold normal-case">{m.category.toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</span>
                          </td>
                          <td className="px-5 py-4 text-right normal-case text-slate-800 font-extrabold text-sm">{formatRupiah(m.default_price)}</td>
                          <td className="px-5 py-4 text-center opacity-60 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => openHistoryModal(m)} className="p-2 text-slate-400 bg-white border border-slate-200 rounded-lg hover:text-blue-600 hover:bg-blue-50 shadow-xs transition-colors" title="Lihat riwayat perubahan harga"><History size={14}/></button>
                              <button onClick={() => { setFormItem({ id: m.id, item_name: m.item_name, category: m.category, unit: m.unit, default_price: String(m.default_price) }); setIsEditingItem(true); }} className="p-2 text-slate-400 bg-white border border-slate-200 rounded-lg hover:text-blue-600 hover:bg-blue-50 shadow-xs transition-colors"><Edit2 size={14}/></button>
                              <button onClick={async () => { if(window.confirm("Hapus item ini dari kamus pabrik?")) sendToSheet('delete', {id: m.id}, 'master_raw_materials'); }} className="p-2 text-slate-400 bg-white border border-slate-200 rounded-lg hover:text-red-600 hover:bg-red-50 shadow-xs transition-colors"><Trash2 size={14}/></button>
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

          {/* 🔥 NEW FEATURE: ANALISA REKAPAN PERUBAHAN HARGA PASAR (CLEAN ENTERPRISE) */}
          <div className="card-holo overflow-hidden mt-2">
             <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50">
                <div className="flex items-center gap-3">
                   <div className="text-blue-600"><BarChart2 size={20}/></div>
                   <div>
                     <h3 className="text-slate-800 font-extrabold normal-case text-sm">Market price analytics</h3>
                     <p className="text-[10px] font-medium text-slate-500 normal-case mt-0.5">Rekapan analisa fluktuasi harga pasar barang</p>
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
               {/* SCORE CARDS */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                 <div className="bg-red-50/50 border border-red-100 p-4 rounded-xl flex items-center justify-between shadow-xs hover:border-red-300 transition-colors">
                   <div>
                     <div className="text-[9px] font-bold text-slate-500 normal-case mb-1">Total item harga naik</div>
                     <div className="text-2xl font-black text-red-600">{priceAnalytics.naikCount} <span className="text-[10px] text-red-500 font-bold">Item</span></div>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600"><ArrowUpRight size={20}/></div>
                 </div>
                 <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl flex items-center justify-between shadow-xs hover:border-emerald-300 transition-colors">
                   <div>
                     <div className="text-[9px] font-bold text-slate-500 normal-case mb-1">Total item harga turun</div>
                     <div className="text-2xl font-black text-emerald-600">{priceAnalytics.turunCount} <span className="text-[10px] text-emerald-500 font-bold">Item</span></div>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><ArrowDownRight size={20}/></div>
                 </div>
                 <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between shadow-xs hover:border-slate-300 transition-colors">
                   <div>
                     <div className="text-[9px] font-bold text-slate-500 normal-case mb-1">Total harga stabil</div>
                     <div className="text-2xl font-black text-slate-700">{priceAnalytics.stabilCount} <span className="text-[10px] text-slate-400 font-bold">Item</span></div>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500"><Minus size={20}/></div>
                 </div>
               </div>

               {/* TABLE RINCIAN */}
               <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
                 <table className="w-full text-left text-sm border-collapse">
                   <thead className="bg-slate-50 text-[10px] normal-case font-bold text-slate-400 border-b border-slate-200">
                     <tr><th className="px-5 py-3">Nama item</th><th className="px-5 py-3">Kategori</th><th className="px-5 py-3 text-center">Status</th><th className="px-5 py-3 text-right">Perubahan / Selisih harga</th></tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                     {priceAnalytics.details.length === 0 ? (
                       <tr><td colSpan="4" className="text-center py-8 text-slate-400 normal-case font-medium">Tidak ada data item.</td></tr>
                     ) : (
                       priceAnalytics.details.map((d, i) => (
                         <tr key={i} className="hover:bg-slate-50 transition-colors">
                           <td className="px-5 py-4 text-slate-800 normal-case font-extrabold">{d.item.item_name}</td>
                           <td className="px-5 py-4 text-slate-500 normal-case">{d.item.category.toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</td>
                           <td className="px-5 py-4 text-center">
                             <span className={`px-2.5 py-1 rounded-md text-[9px] font-bold normal-case border shadow-xs inline-block ${d.status === 'Naik' ? 'bg-red-50 text-red-700 border-red-200' : d.status === 'Turun' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
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

      {/* --- TAB RULES --- */}
      {activeTab === 'RULES' && (
        <div className="card-holo p-6 md:p-8 animate-in fade-in">
          <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
             <Settings size={20} className="text-red-600"/> 
             <h3 className="text-base font-extrabold normal-case text-slate-800">Master conversion engine</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-xs">
               <div className="text-[10px] font-bold text-slate-500 normal-case mb-2">Rule #1: Timbangan mentah</div>
               <div className="text-xl font-black text-slate-800">{rules.kgPerKantong} Kg = <span className="text-red-600">1 Kantong</span></div>
            </div>
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-xs">
               <div className="text-[10px] font-bold text-slate-500 normal-case mb-2">Rule #2: Resep base</div>
               <div className="text-xl font-black text-slate-800">{rules.kgPerAdukan} Kg = <span className="text-red-600">1 Adukan</span></div>
            </div>
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
                  <h3 className="font-extrabold text-slate-800 normal-case text-sm">Riwayat perubahan harga</h3>
                  <p className="text-[10px] font-medium text-slate-500 normal-case mt-0.5">{historyModal.itemName}</p>
                </div>
              </div>
              <button onClick={() => setHistoryModal(null)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><X size={18}/></button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar bg-white">
              {historyModal.history.length === 0 ? (
                <div className="text-center py-10 opacity-60">
                  <Clock size={36} className="mx-auto mb-3 text-slate-300"/>
                  <p className="font-bold text-xs normal-case text-slate-400">Belum ada riwayat perubahan harga.</p>
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
                            <span className="text-[9px] font-bold text-slate-400 normal-case flex items-center gap-1"><Calendar size={10}/> {formatDate(hist.date)}</span>
                            <span className={`text-[8px] font-bold px-2 py-0.5 rounded-md normal-case border ${hist.type === 'NAIK' ? 'bg-red-50 text-red-600 border-red-100' : hist.type === 'TURUN' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{hist.type === 'BARU' ? 'Harga awal' : hist.type === 'NAIK' ? 'Harga naik' : 'Harga turun'}</span>
                          </div>
                          {hist.type === 'BARU' ? (
                            <div className="text-xs font-bold text-slate-500 normal-case">Harga ditetapkan: <span className="text-slate-800 font-extrabold ml-1">{formatRupiah(hist.new_price)}</span></div>
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
