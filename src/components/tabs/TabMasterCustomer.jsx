import React, { useState, useMemo } from 'react';
import { 
  Users, Plus, Search, Edit2, Trash2, Save, 
  X, AlertTriangle, TrendingUp, AlertCircle, ShoppingCart 
} from 'lucide-react';
import { generateId, getTodayStr, getLocalYMD } from '../../utils/helpers'; // 🔥 FIX: getTodayStr sudah di-import resmi!

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabMasterCustomer({ 
  data = [], 
  orders = [], // 🔥 Ambil data order untuk dianalisa
  sendToSheet, 
  showToast 
}) {
  const todayStr = getTodayStr(); // 🔥 Variabel ini sudah aman sekarang
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState('');
  
  const [formData, setFormData] = useState({
    customer_name: '', phone: '', address: '', notes: '', category: 'RESELLER'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const getDaysDifference = (d1, d2) => {
    const diffTime = Math.abs(new Date(d1) - new Date(d2));
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // 🔥 ENGINE CRM: MENYATUKAN DATA MASTER DENGAN HISTORI TRANSAKSI
  const customerAnalytics = useMemo(() => {
    const analyticsMap = {};
    const validOrders = (orders || []).filter(o => !o.isDeleted);
    
    // Siapkan wadah untuk semua pelanggan di database
    (data || []).forEach(cust => {
      if (!cust.isDeleted) {
        analyticsMap[cust.id] = {
          ...cust,
          totalTransaksi: 0,
          totalPcs: 0,
          totalOmset: 0,
          terakhirBelanja: null,
          hariAbsen: 999,
          butuhFollowUp: false
        };
      }
    });

    // Masukkan histori belanja ke masing-masing profil pelanggan
    validOrders.forEach(o => {
      // Cari pelanggan berdasarkan nama (karena kadang kasir cuma input nama manual)
      const matchedCust = Object.values(analyticsMap).find(
        c => c.customer_name.toUpperCase() === String(o.customer_name || o.customer || '').toUpperCase()
      );

      if (matchedCust) {
        matchedCust.totalTransaksi += 1;
        matchedCust.totalPcs += Number(o.qty || 0);
        matchedCust.totalOmset += Number(o.total_amount || o.total || 0);

        if (!matchedCust.terakhirBelanja || new Date(o.date) > new Date(matchedCust.terakhirBelanja)) {
          matchedCust.terakhirBelanja = o.date;
        }
      }
    });

    // Kalkulasi Lampu Merah (Absen > 7 Hari)
    return Object.values(analyticsMap).map(cust => {
      if (cust.terakhirBelanja) {
        cust.hariAbsen = getDaysDifference(todayStr, cust.terakhirBelanja);
        cust.butuhFollowUp = cust.hariAbsen > 7; // Alarm merah jika lebih dari seminggu gak belanja
      }
      return cust;
    }).reverse();
  }, [data, orders, todayStr]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return customerAnalytics;
    const lower = searchTerm.toLowerCase();
    return customerAnalytics.filter(item => 
      (item.customer_name || '').toLowerCase().includes(lower) ||
      (item.phone || '').toLowerCase().includes(lower) ||
      (item.category || '').toLowerCase().includes(lower)
    );
  }, [customerAnalytics, searchTerm]);

  const handleEdit = (item) => {
    setFormData({
      customer_name: item.customer_name || '',
      phone: item.phone || '',
      address: item.address || '',
      notes: item.notes || '',
      category: item.category || 'RESELLER'
    });
    setCurrentId(item.id);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setFormData({ customer_name: '', phone: '', address: '', notes: '', category: 'RESELLER' });
    setIsEditing(false);
    setCurrentId('');
  };

  const handleDelete = async (id, name) => {
    if(!window.confirm(`Yakin ingin menghapus agen "${name}"? Data riwayatnya tidak akan terhapus, tapi namanya hilang dari kasir.`)) return;
    const isSuccess = await sendToSheet('update', { id, isDeleted: true }, 'master_customers');
    if(isSuccess) showToast('Data pelanggan berhasil dihapus!', 'success');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!formData.customer_name) return alert('Nama pelanggan wajib diisi!');
    
    setIsSubmitting(true);
    const payload = {
      ...formData,
      customer_name: formData.customer_name.toUpperCase(), // Paksa huruf besar biar seragam
      isDeleted: false
    };

    if (isEditing) {
      payload.id = currentId;
      const isSuccess = await sendToSheet('update', payload, 'master_customers');
      if (isSuccess) {
        showToast('Profil agen berhasil diperbarui!', 'success');
        handleCancel();
      }
    } else {
      payload.id = generateId('CST', todayStr);
      const isSuccess = await sendToSheet('insert', payload, 'master_customers');
      if (isSuccess) {
        showToast('Agen baru berhasil didaftarkan!', 'success');
        handleCancel();
      }
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-300">
      
      {/* HEADER & ANALITIK CRM SINGKAT */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2"><Users className="text-blue-600"/> Database Master CRM Agen</h2>
            <p className="text-xs font-bold text-slate-400 mt-1">Kelola data pelanggan dan pantau agen yang terdeteksi jarang berbelanja.</p>
          </div>
          <button onClick={() => { handleCancel(); setIsEditing(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-black text-xs shadow-md active:scale-95 transition-all">
            <Plus size={16} /> Tambah Agen Baru
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-lg border-t-4 border-t-blue-500">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
            <h3 className="font-black text-slate-800 text-sm">{currentId ? 'Edit Profil Agen' : 'Registrasi Agen Baru'}</h3>
            <button onClick={handleCancel} className="text-slate-400 hover:text-rose-500"><X size={20}/></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Nama Agen / Toko</label>
                <input required type="text" value={formData.customer_name} onChange={e=>setFormData({...formData, customer_name: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase outline-none focus:bg-white focus:border-blue-400" placeholder="MANDIRI JAYA" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Kategori / Harga</label>
                <select value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black outline-none focus:bg-white focus:border-blue-400 cursor-pointer">
                  <option value="RESELLER">Reseller</option>
                  <option value="MITRA">Mitra Utama</option>
                  <option value="ECERAN">Eceran Biasa</option>
                  <option value="PEMALANG">Area Pemalang</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">No. WhatsApp</label>
                <input type="text" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-400" placeholder="0812..." />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Alamat Pengiriman</label>
                <input type="text" value={formData.address} onChange={e=>setFormData({...formData, address: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-400" placeholder="Jl. Merdeka..." />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Catatan Internal (CRM)</label>
                <textarea rows="2" value={formData.notes} onChange={e=>setFormData({...formData, notes: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-blue-400" placeholder="Karakteristik pelanggan, jam operasional..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={handleCancel} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50">Batal</button>
              <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-black text-xs shadow-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                <Save size={16}/> {isSubmitting ? 'Menyimpan...' : 'Simpan Data Agen'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TABEL DATABASE AGEN (DENGAN RADAR CRM) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="relative w-full max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input type="text" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400 shadow-3xs" placeholder="Cari nama, no WA, atau kategori..." />
          </div>
          <div className="text-[10px] font-black text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-3xs hidden sm:block">
            Total Agen Aktif: {customerAnalytics.length}
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-black text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Nama Agen / Toko</th>
                <th className="px-4 py-3 text-center">Status Keaktifan Order</th>
                <th className="px-4 py-3 text-center">Akumulasi Belanja</th>
                <th className="px-4 py-3 text-center">Kontak &amp; Alamat</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
              {filteredData.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-10 text-slate-400">Data agen tidak ditemukan.</td></tr>
              ) : (
                filteredData.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-black text-slate-800 text-[13px] uppercase flex items-center gap-1.5">
                        {item.customer_name} 
                        {/* 🚨 LAMPU MERAH ABSEN CRM (Follow Up) */}
                        {item.butuhFollowUp && (
                          <span className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 animate-pulse"><AlertTriangle size={10}/> BUTUH FOLLOW UP</span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono mt-0.5">ID: {item.id} • Kategori: <span className="text-blue-600 font-black">{item.category}</span></div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className={`text-[11px] font-black ${item.butuhFollowUp ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {item.terakhirBelanja ? (item.hariAbsen === 0 ? 'Order Hari Ini!' : `${item.hariAbsen} Hari Lalu`) : 'Belum Pernah Order'}
                      </div>
                      <div className="text-[9px] text-slate-400 font-medium mt-0.5">{item.terakhirBelanja || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="font-black text-slate-800">{formatRupiah(item.totalOmset)}</div>
                      <div className="text-[9px] text-slate-500 font-bold mt-0.5 flex items-center justify-center gap-1"><ShoppingCart size={10}/> {item.totalTransaksi}x Transaksi ({formatNumber(item.totalPcs)} Pcs)</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="font-black text-slate-700">{item.phone || '-'}</div>
                      <div className="text-[9px] text-slate-400 font-medium mt-0.5 truncate max-w-[150px] mx-auto" title={item.address}>{item.address || 'Alamat belum diisi'}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => handleEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200 shadow-3xs bg-white"><Edit2 size={14}/></button>
                        <button onClick={() => handleDelete(item.id, item.customer_name)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200 shadow-3xs bg-white"><Trash2 size={14}/></button>
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
  );
}
