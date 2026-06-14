import React, { useState, useMemo } from 'react';
import { 
  Users, Search, Plus, Edit2, Trash2, Save, 
  X, Phone, MapPin, Tag, Filter, UserCheck 
} from 'lucide-react';
import { getTodayStr, generateId } from '../../utils/helpers';

export default function TabMasterCustomer({ 
  masterCustomers = [], master_customers, 
  sendToSheet, showToast, user, requestDelete 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  // --- SINKRONISASI DATABASE ---
  const realCustomers = useMemo(() => master_customers || masterCustomers || [], [master_customers, masterCustomers]);

  // --- STATE MANAJEMEN ---
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');

  const [form, setForm] = useState({
    id: '',
    customer_name: '',
    phone: '',
    address: '',
    category: 'OFFLINE',
    notes: ''
  });

  const CUSTOMER_CATEGORIES = [
    { id: 'OFFLINE', label: 'Offline / Walk-in', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    { id: 'GOFOOD', label: 'GoFood', color: 'bg-red-50 text-red-600 border-red-200' },
    { id: 'GRABFOOD', label: 'GrabFood', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    { id: 'SHOPEEFOOD', label: 'ShopeeFood', color: 'bg-orange-50 text-orange-600 border-orange-200' },
    { id: 'RESELLER_AGEN', label: 'Reseller / Agen', color: 'bg-blue-50 text-blue-600 border-blue-200' },
    { id: 'MARKETPLACE_LAIN', label: 'Marketplace Lainnya', color: 'bg-purple-50 text-purple-600 border-purple-200' }
  ];

  // --- FILTER & SEARCH ---
  const filteredCustomers = useMemo(() => {
    let result = realCustomers.filter(c => !c.isDeleted);
    
    if (filterCategory !== 'ALL') {
      result = result.filter(c => c.category === filterCategory);
    }
    
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(c => 
        (c.customer_name || '').toLowerCase().includes(s) || 
        (c.phone || '').toLowerCase().includes(s)
      );
    }
    
    return result.reverse(); // Yang terbaru di atas
  }, [realCustomers, filterCategory, searchTerm]);

  // --- ACTIONS ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_name) return alert("Nama customer wajib diisi!");

    const custId = isEditing ? form.id : generateId('CUST', todayStr);
    const payload = {
      id: custId,
      date: todayStr,
      branch_id: currentBranch,
      customer_name: form.customer_name.toUpperCase(),
      phone: form.phone || '-',
      address: form.address || '-',
      category: form.category,
      notes: form.notes || '-',
      isDeleted: false
    };

    const isSuccess = await sendToSheet(isEditing ? 'update' : 'insert', payload, 'master_customers');
    if (isSuccess) {
      showToast(isEditing ? 'Data customer berhasil diperbarui!' : 'Customer baru berhasil didaftarkan!', 'success');
      resetForm();
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setForm({ id: '', customer_name: '', phone: '', address: '', category: 'OFFLINE', notes: '' });
  };

  const handleEditClick = (cust) => {
    setForm({
      id: cust.id,
      customer_name: cust.customer_name,
      phone: cust.phone !== '-' ? cust.phone : '',
      address: cust.address !== '-' ? cust.address : '',
      category: cust.category || 'OFFLINE',
      notes: cust.notes !== '-' ? cust.notes : ''
    });
    setIsEditing(true);
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-300">
      
      {/* HEADER BANNER - FLAT ENTERPRISE */}
      <div className="card-holo p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden bg-white">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600"></div>
        <div className="pl-2">
          <h2 className="text-base font-extrabold normal-case flex items-center gap-2 text-slate-900">
            <Users className="text-indigo-600" size={20} /> Master data customer (CRM)
          </h2>
          <p className="text-[10px] font-semibold text-slate-400 mt-1 normal-case tracking-wide">
            Basis data utama pelanggan. Tentukan kategori (Gofood/Offline/dll) untuk analitik penjualan.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: FORM INPUT */}
        <div className="xl:col-span-4 card-holo p-6 border-t-4 border-t-indigo-500 h-max">
          <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-slate-800 normal-case text-sm flex items-center gap-2">
              <UserCheck size={16} className="text-indigo-600"/> {isEditing ? 'Edit profil customer' : 'Daftarkan customer baru'}
            </h3>
            {isEditing && (
              <button type="button" onClick={resetForm} className="p-1.5 bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shadow-xs">
                <X size={14}/>
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Nama lengkap / Akun / Toko</label>
              <input type="text" required value={form.customer_name} onChange={e=>setForm({...form, customer_name: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg font-bold text-xs normal-case outline-none focus:border-indigo-500 transition-colors" placeholder="Ketik nama customer..." />
            </div>

            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Kategori jalur pelanggan</label>
              <select required value={form.category} onChange={e=>setForm({...form, category: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs normal-case outline-none cursor-pointer focus:border-indigo-500 focus:bg-white transition-colors">
                {CUSTOMER_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1 flex items-center gap-1"><Phone size={10}/> Nomor HP / WhatsApp (Opsional)</label>
                <input type="text" value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg font-medium text-xs normal-case outline-none focus:border-indigo-500 transition-colors" placeholder="08xx..." />
              </div>
            </div>

            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1 flex items-center gap-1"><MapPin size={10}/> Alamat pengiriman (Opsional)</label>
              <input type="text" value={form.address} onChange={e=>setForm({...form, address: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg font-medium text-xs normal-case outline-none focus:border-indigo-500 transition-colors" placeholder="Alamat lengkap jika agen/reseller..." />
            </div>

            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1 flex items-center gap-1"><Tag size={10}/> Catatan khusus (Opsional)</label>
              <input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg font-medium text-xs normal-case outline-none focus:border-indigo-500 transition-colors" placeholder="Sering beli grosir, langganan..." />
            </div>

            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-lg text-xs normal-case shadow-sm transition-colors flex items-center justify-center gap-2 mt-2">
              {isEditing ? <><Save size={14}/> Simpan perubahan</> : <><Plus size={14}/> Daftarkan customer</>}
            </button>
          </form>
        </div>

        {/* KANTONG KANAN: DATABASE CUSTOMER */}
        <div className="xl:col-span-8 card-holo flex flex-col overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h4 className="font-extrabold text-xs normal-case text-slate-800">Database pelanggan aktif</h4>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {/* FILTER KATEGORI */}
              <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 shadow-xs">
                <Filter size={14} className="text-slate-400 mr-1"/>
                <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)} className="bg-transparent text-[10px] font-bold text-slate-700 outline-none cursor-pointer py-2">
                  <option value="ALL">Semua kategori</option>
                  {CUSTOMER_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              
              {/* SEARCH BAR */}
              <div className="relative w-full sm:w-48">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input type="text" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-indigo-500 transition-colors shadow-xs" placeholder="Cari nama/HP..." />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto flex-1 p-1 custom-scrollbar min-h-[50vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-white border-b border-slate-200 text-[10px] normal-case text-slate-400 sticky top-0 shadow-xs">
                <tr>
                  <th className="px-5 py-3 font-bold">Profil pelanggan</th>
                  <th className="px-5 py-3 font-bold">Kontak &amp; alamat</th>
                  <th className="px-5 py-3 font-bold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="text-center py-20 text-slate-400 normal-case font-medium">
                      <div className="flex justify-center mb-3 opacity-30"><Users size={40}/></div>
                      Tidak ada data customer yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map(cust => {
                    const catInfo = CUSTOMER_CATEGORIES.find(c => c.id === cust.category) || CUSTOMER_CATEGORIES[0];
                    return (
                      <tr key={cust.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="font-extrabold text-slate-800 text-sm normal-case">{cust.customer_name}</div>
                          <div className={`inline-block px-2 py-0.5 mt-1.5 rounded-md text-[9px] font-bold normal-case border shadow-xs ${catInfo.color}`}>
                            {catInfo.label}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 text-slate-600 mb-1 font-medium"><Phone size={12} className="text-slate-400"/> {cust.phone}</div>
                          <div className="flex items-center gap-1.5 text-slate-500 font-normal line-clamp-1"><MapPin size={12} className="text-slate-400"/> {cust.address}</div>
                        </td>
                        <td className="px-5 py-4 text-center opacity-60 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => handleEditClick(cust)} className="p-2 text-slate-400 bg-white border border-slate-200 rounded-lg hover:text-blue-600 hover:bg-blue-50 shadow-xs transition-colors" title="Edit Profil">
                              <Edit2 size={14}/>
                            </button>
                            <button onClick={() => { if(window.confirm("Yakin hapus customer ini?")) requestDelete(cust.id); }} className="p-2 text-slate-400 bg-white border border-slate-200 rounded-lg hover:text-red-600 hover:bg-red-50 shadow-xs transition-colors" title="Hapus Customer">
                              <Trash2 size={14}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
