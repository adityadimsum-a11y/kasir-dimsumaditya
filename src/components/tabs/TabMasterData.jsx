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

  // 🔥 ENGINE ANALISA REKAPAN PERUBAHAN HARGA PASAR (IDE BOS SULTAN)
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
      
      // Ambil riwayat dalam rentang tanggal
      const rangeHistory = history.filter(h => {
        const hDate = new Date(h.date).getTime();
        return hDate >= sDate && hDate <= eDate;
      });

      // Cari harga SEBELUM rentang tanggal sebagai titik ukur awal
      const historyBeforeStart = history.filter(h => new Date(h.date).getTime() < sDate);
      let startingPrice = item.default_price; // Fallback
      if (historyBeforeStart.length > 0) {
        startingPrice = historyBeforeStart[historyBeforeStart.length - 1].new_price;
      } else if (rangeHistory.length > 0 && rangeHistory[0].type !== 'BARU') {
        startingPrice = rangeHistory[0].old_price;
      } else if (rangeHistory.length > 0 && rangeHistory[0].type === 'BARU') {
        startingPrice = rangeHistory[0].new_price; // Jika barang baru di periode ini, selisih 0
      }

      // Cari harga TERAKHIR di rentang tanggal
      let endPrice = rangeHistory.length > 0 ? rangeHistory[rangeHistory.length - 1].new_price : startingPrice;
      let selisih = endPrice - startingPrice;

      // Jika hanya ada event 'BARU' di periode ini, kita anggap stabil (karena ini inisialisasi)
      if (rangeHistory.length === 1 && rangeHistory[0].type === 'BARU') {
        selisih = 0;
      }

      if (selisih > 0) {
        naikCount++;
        details.push({ item, status: 'NAIK', change: selisih, latestPrice: endPrice, oldPrice: startingPrice });
      } else if (selisih < 0) {
        turunCount++;
        details.push({ item, status: 'TURUN', change: selisih, latestPrice: endPrice, oldPrice: startingPrice });
      } else {
        stabilCount++;
        details.push({ item, status: 'STABIL', change: 0, latestPrice: endPrice, oldPrice: startingPrice });
      }
    });

    // Urutkan NAIK di atas, TURUN di tengah, STABIL di bawah
    details.sort((a, b) => {
      if (a.status === 'NAIK' && b.status !== 'NAIK') return -1;
      if (a.status === 'TURUN' && b.status === 'STABIL') return -1;
      return 0;
    });

    return { naikCount, turunCount, stabilCount, details };
  }, [activeRawMaterials, recapStart, recapEnd]);

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        <button onClick={() => setActiveTab('MENU')} className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'MENU' ? 'bg-blue-600 text-white shadow-md scale-105' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Box size={16}/> Master Daftar Menu</button>
        <button onClick={() => setActiveTab('RULES')} className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'RULES' ? 'bg-slate-800 text-amber-400 shadow-md scale-105' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Settings size={16}/> Aturan Pabrik</button>
        <button onClick={() => setActiveTab('SUPPLIER')} className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'SUPPLIER' ? 'bg-emerald-600 text-white shadow-md scale-105' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Truck size={14}/> Mitra Supplier</button>
        <button onClick={() => setActiveTab('ITEM_BIAYA')} className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'ITEM_BIAYA' ? 'bg-rose-600 text-white shadow-md scale-105' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><List size={16}/> Master Item &amp; Biaya</button>
      </div>

      {activeTab === 'MENU' && (
         <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in">
           <div className="xl:col-span-4">
             <div className={`bg-white rounded-3xl border shadow-sm p-6 ${isEditing ? 'border-amber-300' : 'border-blue-200'}`}>
               <div className="flex justify-between items-center mb-5">
                 <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm flex items-center gap-2"><Box size={18} className="text-blue-600"/> {isEditing ? 'Edit Menu' : 'Tambah Menu'}</h3>
                 {isEditing && <button type="button" onClick={() => { setIsEditing(false); setFormMenu({ id: '', product_name: '', category: 'FROZEN_GOODS', selling_price: '', default_hpp: '1125', min_order: '1', penalty_price: '0' }); }} className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg"><X size={16}/></button>}
               </div>
               <form onSubmit={handleSubmitMenu} className="space-y-4">
                 <input type="text" required value={formMenu.product_name} onChange={e=>setFormMenu({...formMenu, product_name: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl font-black text-xs uppercase outline-none" placeholder="NAMA MENU" />
                 <select value={formMenu.category} onChange={e=>setFormMenu({...formMenu, category: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl font-black text-xs outline-none">
                   <option value="FROZEN_GOODS">FROZEN / MENTAH</option>
                   <option value="READY_TO_EAT">MATANG / READY</option>
                 </select>
                 <input type="text" required value={formMenu.selling_price ? Number(formMenu.selling_price).toLocaleString('id-ID') : ''} onChange={e=>setFormMenu({...formMenu, selling_price: e.target.value.replace(/\D/g, '')})} className="w-full p-3 bg-blue-50 border rounded-xl font-black text-xs outline-none" placeholder="HARGA JUAL" />
                 <button type="submit" className="w-full bg-blue-600 text-white font-black py-3 rounded-xl text-xs uppercase shadow-md">Simpan Menu</button>
               </form>
             </div>
           </div>
           <div className="xl:col-span-8 bg-white rounded-3xl border shadow-sm overflow-hidden custom-scrollbar min-h-[50vh] overflow-x-auto">
             <table className="w-full text-sm text-left">
               <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b"><tr><th className="px-5 py-4">Menu</th><th className="px-5 py-4">Harga</th><th className="px-5 py-4 text-center">Aksi</th></tr></thead>
               <tbody className="divide-y text-xs font-bold">
                 {activeProducts.map(p => (
                   <tr key={p.id} className="hover:bg-blue-50/20"><td className="px-5 py-4 uppercase">{p.product_name}</td><td className="px-5 py-4 text-blue-700">{formatRupiah(p.selling_price)}</td><td className="px-5 py-4 text-center"><button onClick={()=> {setFormMenu(p); setIsEditing(true);}} className="p-2 text-amber-500"><Edit2 size={14}/></button></td></tr>
                 ))}
               </tbody>
             </table>
           </div>
         </div>
      )}

      {activeTab === 'SUPPLIER' && (
         <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in">
           <div className="xl:col-span-4 bg-white rounded-3xl border shadow-sm p-6 border-emerald-200">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm flex items-center gap-2"><Truck size={18} className="text-emerald-600"/> {isEditingSpl ? 'Edit Supplier' : 'Tambah Supplier'}</h3>
                {isEditingSpl && <button type="button" onClick={() => { setIsEditingSpl(false); setFormSpl({ id: '', supplier_name: '', pic_name: '', phone: '', address: '' }); }} className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg"><X size={16}/></button>}
              </div>
              <form onSubmit={handleSubmitSupplier} className="space-y-4">
                <input type="text" required value={formSpl.supplier_name} onChange={e=>setFormSpl({...formSpl, supplier_name: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-black uppercase" placeholder="NAMA PT / CV / WARUNG" />
                <input type="text" required value={formSpl.pic_name} onChange={e=>setFormSpl({...formSpl, pic_name: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-black uppercase" placeholder="NAMA SALES" />
                <input type="text" required value={formSpl.phone} onChange={e=>setFormSpl({...formSpl, phone: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-black" placeholder="NO HP" />
                <button type="submit" className="w-full bg-emerald-600 text-white font-black py-3 rounded-xl text-xs uppercase shadow-md">Simpan Supplier</button>
              </form>
           </div>
           <div className="xl:col-span-8 bg-white rounded-3xl border shadow-sm overflow-hidden custom-scrollbar min-h-[50vh] overflow-x-auto">
             <table className="w-full text-sm text-left"><thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b"><tr><th className="px-5 py-4">Nama Supplier</th><th className="px-5 py-4">Kontak</th><th className="px-5 py-4 text-center">Aksi</th></tr></thead>
             <tbody className="divide-y text-xs font-bold">
               {activeSuppliers.map(s => <tr key={s.id} className="hover:bg-emerald-50/10"><td className="px-5 py-4 uppercase">{s.supplier_name}</td><td className="px-5 py-4">{s.phone}</td><td className="px-5 py-4 text-center"><button onClick={() => {setFormSpl(s); setIsEditingSpl(true);}} className="p-2 text-amber-500"><Edit2 size={14}/></button></td></tr>)}
             </tbody></table>
           </div>
         </div>
      )}

      {/* --- TAB SAKTI: MASTER ITEM & BIAYA --- */}
      {activeTab === 'ITEM_BIAYA' && (
        <div className="flex flex-col gap-8 animate-in fade-in">
          
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            <div className="xl:col-span-4">
              <div className={`bg-white rounded-3xl border shadow-sm p-6 md:p-8 transition-all ${isEditingItem ? 'border-amber-300 shadow-amber-500/10' : 'border-rose-200'}`}>
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isEditingItem ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}><Edit2 size={20}/></div>
                    <div><h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">{isEditingItem ? 'Edit Item Biaya' : 'Daftarkan Item Baru'}</h3>{isEditingItem && <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Perubahan harga akan direkam</p>}</div>
                  </div>
                  {isEditingItem && <button type="button" onClick={() => { setIsEditingItem(false); setFormItem({ id: '', item_name: '', category: 'BAHAN BAKU', unit: '', default_price: '' }); }} className="p-1.5 bg-slate-100 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg shadow-sm"><X size={16}/></button>}
                </div>

                <form onSubmit={handleSubmitItem} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Kategori Item</label>
                    <select value={formItem.category} onChange={e=>setFormItem({...formItem, category: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-black uppercase outline-none focus:border-rose-500">
                      <option value="BAHAN BAKU">BAHAN BAKU</option>
                      <option value="KEMASAN">KEMASAN</option>
                      <option value="OPERASIONAL KENDARAAN">OPERASIONAL KENDARAAN</option>
                      <option value="ATK & PERLENGKAPAN">ATK &amp; PERLENGKAPAN</option>
                      <option value="AIR & KEBERSIHAN">AIR &amp; KEBERSIHAN</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Nama Item</label>
                    <input type="text" required value={formItem.item_name} onChange={e=>setFormItem({...formItem, item_name: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-black uppercase outline-none focus:border-rose-500" placeholder="CTH: SAOS DELMONTE" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Satuan Dasar</label>
                      <input type="text" required value={formItem.unit} onChange={e=>setFormItem({...formItem, unit: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-black uppercase outline-none focus:border-rose-500" placeholder="CTH: DUS / KG" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Harga Standar Default</label>
                      <input type="text" required value={formItem.default_price ? Number(formItem.default_price).toLocaleString('id-ID') : ''} onChange={e=>setFormItem({...formItem, default_price: e.target.value.replace(/\D/g, '')})} className="w-full p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-black outline-none focus:border-rose-500" placeholder="Rp 0" />
                    </div>
                  </div>
                  <button type="submit" className={`w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 mt-2 ${isEditingItem ? 'bg-amber-500 hover:bg-amber-600' : 'bg-rose-600 hover:bg-rose-700'}`}>
                     {isEditingItem ? <><Save size={16}/> Update &amp; Rekam Harga</> : <><Plus size={16}/> Simpan Master Item</>}
                  </button>
                </form>
              </div>
            </div>
            
            <div className="xl:col-span-8 bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b bg-slate-50 font-black text-xs uppercase tracking-widest text-slate-700">Database Master Item &amp; Beban Biaya</div>
              <div className="overflow-x-auto custom-scrollbar min-h-[50vh] max-h-[60vh]">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-white text-[10px] uppercase text-slate-400 border-b sticky top-0 shadow-sm">
                    <tr><th className="px-5 py-4">Nama Item &amp; Satuan</th><th className="px-5 py-4">Kategori Jurnal</th><th className="px-5 py-4 text-right">Harga Default (Ref)</th><th className="px-5 py-4 text-center">Aksi</th></tr>
                  </thead>
                  <tbody className="divide-y text-xs font-bold">
                    {activeRawMaterials.length === 0 ? (
                      <tr><td colSpan="4" className="text-center py-10 text-slate-400 uppercase font-black">Data Kamus Item Belum Tersedia.</td></tr>
                    ) : (
                      activeRawMaterials.map(m => (
                        <tr key={m.id} className="hover:bg-rose-50/20 transition-colors group">
                          <td className="px-5 py-4"><div className="text-sm font-black text-slate-800 uppercase">{m.item_name}</div><div className="text-[9px] text-slate-500 mt-0.5 tracking-widest uppercase font-bold">SATUAN: {m.unit}</div></td>
                          <td className="px-5 py-4 uppercase"><span className="bg-slate-100 border text-slate-600 px-2.5 py-1 rounded-md text-[9px] font-black tracking-wider">{m.category}</span></td>
                          <td className="px-5 py-4 text-right uppercase text-rose-600 font-black text-sm">{formatRupiah(m.default_price)}</td>
                          <td className="px-5 py-4 text-center opacity-50 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => openHistoryModal(m)} className="p-2 text-slate-400 bg-white border rounded-lg hover:text-blue-600 hover:bg-blue-50 shadow-sm" title="Lihat Riwayat Perubahan Harga"><History size={14}/></button>
                              <button onClick={() => { setFormItem({ id: m.id, item_name: m.item_name, category: m.category, unit: m.unit, default_price: String(m.default_price) }); setIsEditingItem(true); }} className="p-2 text-slate-400 bg-white border rounded-lg hover:text-amber-500 hover:bg-amber-50 shadow-sm"><Edit2 size={14}/></button>
                              <button onClick={async () => { if(window.confirm("Hapus item ini dari kamus pabrik?")) sendToSheet('delete', {id: m.id}, 'master_raw_materials'); }} className="p-2 text-slate-400 bg-white border rounded-lg hover:text-rose-500 hover:bg-rose-50 shadow-sm"><Trash2 size={14}/></button>
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

          {/* 🔥 NEW FEATURE: ANALISA REKAPAN PERUBAHAN HARGA PASAR */}
          <div className="bg-[#151a25] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden mt-4">
             <div className="p-6 border-b border-slate-800/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-900 to-[#151a25]">
                <div className="flex items-center gap-3">
                   <div className="bg-blue-500/20 p-2.5 rounded-xl border border-blue-500/30 text-blue-400"><BarChart2 size={20}/></div>
                   <div>
                     <h3 className="text-white font-black uppercase text-sm tracking-widest">Market Price Analytics</h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Rekapan Analisa Fluktuasi Harga Pasar Barang</p>
                   </div>
                </div>
                <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 p-2 rounded-xl">
                   <Filter size={14} className="text-slate-400 ml-1"/>
                   <input type="date" value={recapStart} onChange={e=>setRecapStart(e.target.value)} className="bg-transparent text-xs font-black text-slate-300 outline-none cursor-pointer" />
                   <span className="text-slate-500 font-bold">-</span>
                   <input type="date" value={recapEnd} onChange={e=>setRecapEnd(e.target.value)} className="bg-transparent text-xs font-black text-slate-300 outline-none cursor-pointer" />
                </div>
             </div>

             <div className="p-6 bg-slate-900/50">
               {/* SCORE CARDS */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                 <div className="bg-rose-950/30 border border-rose-900/50 p-4 rounded-2xl flex items-center justify-between">
                   <div>
                     <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Total Item Harga Naik</div>
                     <div className="text-2xl font-black text-white">{priceAnalytics.naikCount} <span className="text-[10px] text-slate-500">ITEM</span></div>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-500"><ArrowUpRight size={20}/></div>
                 </div>
                 <div className="bg-emerald-950/30 border border-emerald-900/50 p-4 rounded-2xl flex items-center justify-between">
                   <div>
                     <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total Item Harga Turun</div>
                     <div className="text-2xl font-black text-white">{priceAnalytics.turunCount} <span className="text-[10px] text-slate-500">ITEM</span></div>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500"><ArrowDownRight size={20}/></div>
                 </div>
                 <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl flex items-center justify-between">
                   <div>
                     <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Harga Stabil</div>
                     <div className="text-2xl font-black text-white">{priceAnalytics.stabilCount} <span className="text-[10px] text-slate-500">ITEM</span></div>
                   </div>
                   <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500"><Minus size={20}/></div>
                 </div>
               </div>

               {/* TABLE RINCIAN */}
               <div className="overflow-x-auto border border-slate-700/50 rounded-2xl">
                 <table className="w-full text-left text-sm">
                   <thead className="bg-slate-800 text-[9px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-700/50">
                     <tr><th className="px-5 py-3">Nama Item</th><th className="px-5 py-3">Kategori</th><th className="px-5 py-3 text-center">Status</th><th className="px-5 py-3 text-right">Perubahan / Selisih Harga</th></tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800/50 text-xs font-bold bg-slate-900/30">
                     {priceAnalytics.details.length === 0 ? (
                       <tr><td colSpan="4" className="text-center py-6 text-slate-500 uppercase">TIDAK ADA DATA ITEM.</td></tr>
                     ) : (
                       priceAnalytics.details.map((d, i) => (
                         <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                           <td className="px-5 py-3 text-white uppercase">{d.item.item_name}</td>
                           <td className="px-5 py-3 text-slate-400">{d.item.category}</td>
                           <td className="px-5 py-3 text-center">
                             <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${d.status === 'NAIK' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : d.status === 'TURUN' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                               {d.status}
                             </span>
                           </td>
                           <td className="px-5 py-3 text-right">
                             {d.status === 'STABIL' ? (
                               <span className="text-slate-500">{formatRupiah(d.latestPrice)} <span className="text-[9px]">(Tetap)</span></span>
                             ) : (
                               <div className="flex items-center justify-end gap-2 text-[11px]">
                                 <span className="text-slate-500 line-through">{formatRupiah(d.oldPrice)}</span>
                                 <ArrowRight size={10} className="text-slate-600"/>
                                 <span className={d.status === 'NAIK' ? 'text-rose-400' : 'text-emerald-400'}>{formatRupiah(d.latestPrice)}</span>
                                 <span className={`ml-1 text-[9px] px-1.5 rounded ${d.status === 'NAIK' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                                    ({d.status === 'NAIK' ? '+' : '-'}{formatRupiah(Math.abs(d.change))})
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
        <div className="bg-[#151a25] rounded-3xl border p-6 shadow-2xl overflow-hidden text-white animate-in fade-in">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4"><Settings size={24} className="text-amber-500"/> <h3 className="text-base font-black uppercase tracking-widest">Master Conversion Engine</h3></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#1c2331] p-5 rounded-xl border border-slate-700/50"><div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-3">Rule #1: Timbangan Mentah</div><div className="text-xl font-black text-white">{rules.kgPerKantong} KG = <span className="text-amber-400">1 Kantong</span></div></div>
            <div className="bg-[#1c2331] p-5 rounded-xl border border-slate-700/50"><div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-3">Rule #2: Resep Base</div><div className="text-xl font-black text-white">{rules.kgPerAdukan} KG = <span className="text-amber-400">1 Adukan</span></div></div>
          </div>
        </div>
      )}

      {/* 🔥 MODAL POPUP RIWAYAT PERUBAHAN HARGA (DENGAN INFO SELISIH) */}
      {historyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
            
            <div className="p-5 bg-slate-50 border-b flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-xl text-blue-600"><History size={20}/></div>
                <div>
                  <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">Riwayat Perubahan Harga</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{historyModal.itemName}</p>
                </div>
              </div>
              <button onClick={() => setHistoryModal(null)} className="p-2 bg-slate-200 text-slate-600 hover:bg-rose-100 hover:text-rose-600 rounded-xl transition-colors"><X size={16}/></button>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar bg-white">
              {historyModal.history.length === 0 ? (
                <div className="text-center py-10 opacity-50">
                  <Clock size={40} className="mx-auto mb-3 text-slate-400"/>
                  <p className="font-black text-xs uppercase tracking-widest text-slate-500">Belum ada riwayat perubahan harga.</p>
                </div>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                  {historyModal.history.map((hist, idx) => {
                    // 🔥 HITUNG SELISIH HARGA UNTUK DITAMPILKAN DI MODAL
                    const selisih = Math.abs(hist.new_price - hist.old_price);
                    
                    return (
                      <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-100 text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                          {hist.type === 'NAIK' ? <TrendingUp size={14} className="text-rose-600"/> : hist.type === 'TURUN' ? <TrendingDown size={14} className="text-emerald-600"/> : <Plus size={14} className="text-blue-600"/>}
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-50 border p-4 rounded-2xl shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><Calendar size={10}/> {formatDate(hist.date)}</span>
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest border ${hist.type === 'NAIK' ? 'bg-rose-50 text-rose-600 border-rose-200' : hist.type === 'TURUN' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>{hist.type}</span>
                          </div>
                          {hist.type === 'BARU' ? (
                            <div className="text-xs font-black text-slate-700">Harga Awal: <span className="text-blue-600">{formatRupiah(hist.new_price)}</span></div>
                          ) : (
                            <div className="flex items-center gap-2 text-xs font-black flex-wrap">
                              <span className="text-slate-400 line-through">{formatRupiah(hist.old_price)}</span>
                              <ArrowRight size={12} className="text-slate-300"/>
                              
                              {/* 🔥 TAMPILKAN SELISIH HARGA DI SINI */}
                              <span className={hist.type === 'NAIK' ? 'text-rose-600' : 'text-emerald-600'}>
                                {formatRupiah(hist.new_price)}
                                <span className={`text-[9px] px-1.5 py-0.5 rounded ml-1.5 ${hist.type === 'NAIK' ? 'bg-rose-100' : 'bg-emerald-100'}`}>
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
