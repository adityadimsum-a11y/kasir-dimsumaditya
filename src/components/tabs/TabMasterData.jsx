import React, { useState, useMemo } from 'react';
import { 
  Box, Settings, Layers, Package, Truck, 
  Plus, Edit2, Trash2, Save, X, Calculator, ShieldCheck, 
  CheckCircle2, User, Phone, MapPin
} from 'lucide-react';
import { getTodayStr, generateId } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabMasterData({ 
  masterProducts = [], master_products,
  masterSuppliers = [], master_suppliers,
  sendToSheet, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  const [activeTab, setActiveTab] = useState('MENU');
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSpl, setIsEditingSpl] = useState(false);

  // --- SINKRONISASI DATABASE ---
  const realProducts = useMemo(() => master_products || masterProducts || [], [master_products, masterProducts]);
  const realSuppliers = useMemo(() => master_suppliers || masterSuppliers || [], [master_suppliers, masterSuppliers]);
  
  // STATE ATURAN KONVERSI PABRIK 
  const [rules, setRules] = useState({
    kgPerKantong: 10, kgPerAdukan: 30, pcsPerAdukan: 1000, pcsPerPorsi: 4, pcsPerMika: 50
  });

  // --- STATE FORM MASTER MENU ---
  const [formMenu, setFormMenu] = useState({
    id: '', product_name: '', category: 'FROZEN_GOODS', selling_price: '', default_hpp: '1125', min_order: '1', penalty_price: '0'
  });

  // --- STATE FORM MASTER SUPPLIER (🔥 BARU!) ---
  const [formSpl, setFormSpl] = useState({
    id: '', supplier_name: '', pic_name: '', phone: '', address: ''
  });

  const activeProducts = useMemo(() => {
    return realProducts.filter(p => !p.isDeleted && String(p.isDeleted).toUpperCase() !== 'TRUE').reverse();
  }, [realProducts]);

  const activeSuppliers = useMemo(() => {
    return realSuppliers.filter(s => !s.isDeleted && String(s.isDeleted).toUpperCase() !== 'TRUE').reverse();
  }, [realSuppliers]);

  // --- ACTIONS: SUBMIT MENU ---
  const handleSubmitMenu = async (e) => {
    e.preventDefault();
    if (!formMenu.product_name) return alert("Nama menu tidak boleh kosong!");
    const productId = isEditing ? formMenu.id : generateId('PRD', todayStr);
    
    const payload = {
      id: productId, date: todayStr, branch_id: currentBranch, isDeleted: false,
      product_name: formMenu.product_name.toUpperCase(),
      sku: formMenu.product_name.substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 1000),
      category: formMenu.category, unit: 'PCS', selling_price: Number(formMenu.selling_price || 0),
      default_hpp: Number(formMenu.default_hpp || 1125), status_active: true,
      min_order: Number(formMenu.min_order || 1), penalty_price: Number(formMenu.penalty_price || 0)
    };

    const isSuccess = await sendToSheet(isEditing ? 'update' : 'insert', payload, 'master_products');
    if (isSuccess) {
      showToast(isEditing ? 'Data Menu berhasil diperbarui!' : 'Menu Baru berhasil ditambah!', 'success');
      setIsEditing(false); setFormMenu({ id: '', product_name: '', category: 'FROZEN_GOODS', selling_price: '', default_hpp: '1125', min_order: '1', penalty_price: '0' });
    }
  };

  // --- ACTIONS: SUBMIT SUPPLIER (🔥 BARU!) ---
  const handleSubmitSupplier = async (e) => {
    e.preventDefault();
    if (!formSpl.supplier_name) return alert("Nama perusahaan supplier wajib diisi!");
    const splId = isEditingSpl ? formSpl.id : generateId('SPL', todayStr);

    const payload = {
      id: splId, date: todayStr, branch_id: currentBranch, isDeleted: false,
      supplier_name: formSpl.supplier_name.toUpperCase(),
      pic_name: formSpl.pic_name.toUpperCase(),
      phone: formSpl.phone, address: formSpl.address.toUpperCase()
    };

    const isSuccess = await sendToSheet(isEditingSpl ? 'update' : 'insert', payload, 'master_suppliers');
    if (isSuccess) {
      showToast(isEditingSpl ? 'Data Supplier diperbarui!' : 'Supplier resmi terdaftar!', 'success');
      setIsEditingSpl(false); setFormSpl({ id: '', supplier_name: '', pic_name: '', phone: '', address: '' });
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* NAVIGASI SUB TABS */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        <button onClick={() => setActiveTab('MENU')} className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'MENU' ? 'bg-blue-600 text-white shadow-md scale-105' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Box size={16}/> Master Daftar Menu</button>
        <button onClick={() => setActiveTab('RULES')} className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'RULES' ? 'bg-slate-800 text-amber-400 shadow-md scale-105' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Settings size={16}/> Aturan Pabrik</button>
        <button onClick={() => setActiveTab('SUPPLIER')} className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'SUPPLIER' ? 'bg-emerald-600 text-white shadow-md scale-105' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Truck size={14}/> Mitra Supplier</button>
        <button onClick={() => setActiveTab('AYAM')} className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'AYAM' ? 'bg-rose-600 text-white shadow-md scale-105' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Layers size={16}/> Bahan Baku (Ayam)</button>
        <button onClick={() => setActiveTab('PACKAGING')} className={`px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'PACKAGING' ? 'bg-amber-500 text-white shadow-md scale-105' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Package size={16}/> Packaging Inventory</button>
      </div>

      {activeTab === 'MENU' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-4">
            <div className={`bg-white rounded-3xl border shadow-sm p-6 md:p-8 transition-all duration-300 ${isEditing ? 'border-amber-300 shadow-amber-500/10' : 'border-blue-200'}`}>
              <form onSubmit={handleSubmitMenu} className="space-y-5">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Nama Menu / Produk</label>
                  <input type="text" required value={formMenu.product_name} onChange={e=>setFormMenu({...formMenu, product_name: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm uppercase outline-none focus:bg-white focus:border-blue-400" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Kategori</label>
                    <select value={formMenu.category} onChange={e=>setFormMenu({...formMenu, category: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-xs outline-none">
                      <option value="FROZEN_GOODS">FROZEN / MENTAH</option>
                      <option value="READY_TO_EAT">MATANG / READY</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-blue-600 uppercase block mb-1.5">Harga Utama/Pcs</label>
                    <input type="text" required value={formMenu.selling_price ? Number(formMenu.selling_price).toLocaleString('id-ID') : ''} onChange={e=>setFormMenu({...formMenu, selling_price: e.target.value.replace(/\D/g, '')})} className="w-full p-3.5 bg-blue-50 border border-blue-200 rounded-xl font-black text-sm text-blue-800 outline-none" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white font-black py-4.5 rounded-2xl text-xs uppercase tracking-widest shadow-xl">SIMPAN DATA MENU</button>
              </form>
            </div>
          </div>
          <div className="xl:col-span-8 bg-white rounded-3xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b">
                <tr><th className="px-6 py-4">Nama Menu</th><th className="px-6 py-4 text-right">Harga Grosir</th><th className="px-6 py-4 text-center">Aksi</th></tr>
              </thead>
              <tbody className="divide-y text-xs font-bold">
                {activeProducts.map(p => (
                  <tr key={p.id} className="hover:bg-blue-50/20">
                    <td className="px-6 py-4 uppercase">{p.product_name}<div className="text-[9px] text-slate-400 font-mono mt-1">SKU: {p.sku}</div></td>
                    <td className="px-6 py-4 text-right text-blue-700 font-black">{formatRupiah(p.selling_price)}</td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => handleEditMenu(p)} className="p-2 text-slate-500 hover:text-amber-500"><Edit2 size={14}/></button>
                      <button onClick={() => handleDeleteMenu(p.id)} className="p-2 text-slate-500 hover:text-rose-500"><Trash2 size={14}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🚀 TAB INTERKONEKSI: MASTER MITRA SUPPLIER (BOS SULTAN ENGINE) */}
      {activeTab === 'SUPPLIER' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in duration-300">
          {/* SISI KIRI: INPUT SUPPLIER */}
          <div className="xl:col-span-4">
            <div className={`bg-white rounded-3xl border shadow-sm p-6 md:p-8 transition-all ${isEditingSpl ? 'border-amber-300' : 'border-emerald-200'}`}>
              <div className="flex items-center gap-3 mb-5">
                <Truck size={20} className="text-emerald-600"/>
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">{isEditingSpl ? 'Edit Data Mitra' : 'Daftarkan Supplier Baru'}</h3>
              </div>
              <form onSubmit={handleSubmitSupplier} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Nama Perusahaan / Supplier</label>
                  <input type="text" required value={formSpl.supplier_name} onChange={e=>setFormSpl({...formSpl, supplier_name: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-black uppercase outline-none focus:border-emerald-500" placeholder="CTH: NANA AYAM" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Nama Sales / PIC Sales</label>
                  <input type="text" required value={formSpl.pic_name} onChange={e=>setFormSpl({...formSpl, pic_name: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-black uppercase outline-none focus:border-emerald-500" placeholder="CTH: PAK BUDI" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">No. WhatsApp / HP</label>
                  <input type="text" required value={formSpl.phone} onChange={e=>setFormSpl({...formSpl, phone: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-black outline-none focus:border-emerald-500" placeholder="CTH: 08123xxx" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Alamat Kantor / Gudang</label>
                  <input type="text" required value={formSpl.address} onChange={e=>setFormSpl({...formSpl, address: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-black uppercase outline-none focus:border-emerald-500" placeholder="ALAMAT..." />
                </div>
                <button type="submit" className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-md">
                   Sahkan Kemitraan Supplier
                </button>
              </form>
            </div>
          </div>
          {/* SISI KANAN: TABEL REKAPAN MITRA SUPPLIER */}
          <div className="xl:col-span-8 bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b bg-slate-50 font-black text-xs uppercase tracking-widest text-slate-700">Daftar Rekanan Supplier Resmi Pabrik</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-white text-[10px] uppercase text-slate-400 border-b">
                  <tr><th className="px-5 py-4">ID &amp; Nama Supplier</th><th className="px-5 py-4">PIC / Kontak HP</th><th className="px-5 py-4">Alamat</th><th className="px-5 py-4 text-center">Opsi</th></tr>
                </thead>
                <tbody className="divide-y text-xs font-bold">
                  {activeSuppliers.length === 0 ? (
                    <tr><td colSpan="4" className="text-center py-10 text-slate-400 uppercase font-black">Belum ada supplier terdaftar.</td></tr>
                  ) : (
                    activeSuppliers.map(s => (
                      <tr key={s.id} className="hover:bg-emerald-50/10">
                        <td className="px-5 py-4"><div className="text-sm font-black text-slate-800 uppercase">{s.supplier_name}</div><div className="text-[9px] text-slate-400 font-mono mt-0.5">{s.id}</div></td>
                        <td className="px-5 py-4 uppercase">{s.pic_name}<div className="text-[10px] text-emerald-600 font-bold mt-0.5">{s.phone}</div></td>
                        <td className="px-5 py-4 uppercase text-slate-500 max-w-[180px] truncate">{s.address}</td>
                        <td className="px-5 py-4 text-center">
                          <button onClick={() => { setFormSpl({ id: s.id, supplier_name: s.supplier_name, pic_name: s.pic_name, phone: s.phone, address: s.address }); setIsEditingSpl(true); }} className="p-2 text-slate-400 hover:text-amber-500"><Edit2 size={14}/></button>
                          <button onClick={async () => { if(window.confirm("Hapus supplier rekanan ini?")) sendToSheet('delete', {id: s.id}, 'master_suppliers'); }} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 size={14}/></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'RULES' && (
        <div className="bg-[#151a25] rounded-3xl border p-6 shadow-2xl overflow-hidden text-white">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4"><Settings size={24} className="text-amber-500"/> <h3 className="text-base font-black uppercase tracking-widest">Master Conversion Engine</h3></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-[#1c2331] p-5 rounded-xl border border-slate-700/50">
              <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-3">Rule #1: Timbangan Mentah</div>
              <div className="text-xl font-black text-white">{rules.kgPerKantong} KG = <span className="text-amber-400">1 Kantong Ayam</span></div>
            </div>
            <div className="bg-[#1c2331] p-5 rounded-xl border border-slate-700/50">
              <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-3">Rule #2: Resep Base</div>
              <div className="text-xl font-black text-white">{rules.kgPerAdukan} KG Ayam = <span className="text-amber-400">1 Adukan Dapur</span></div>
            </div>
            <div className="bg-[#1c2331] p-5 rounded-xl border border-slate-700/50">
              <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-3">Rule #3: Target Hasil</div>
              <div className="text-xl font-black text-white">1 Adukan = <span className="text-blue-400">{rules.pcsPerAdukan} PCS Dimsum</span></div>
            </div>
          </div>
          <div className="mt-8 pt-4 border-t border-slate-800 flex justify-end">
            <button onClick={() => showToast("Konfigurasi Master Pabrik Disimpan!", "success")} className="bg-amber-500 text-slate-900 font-black text-xs px-6 py-3 rounded-xl uppercase tracking-widest flex items-center gap-2"><CheckCircle2 size={14}/> Simpan Konfigurasi</button>
          </div>
        </div>
      )}

      {(activeTab === 'AYAM' || activeTab === 'PACKAGING') && (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center shadow-sm">
          <Settings size={48} className="mx-auto text-slate-200 mb-4 animate-spin-slow"/><h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-2">Modul Sedang Dalam Tahap Pengembangan</h3><p className="text-xs font-bold text-slate-400">Silakan kembali ke sub-tab aktif di atas.</p>
        </div>
      )}
    </div>
  );
}
