import React, { useState, useMemo } from 'react';
import { 
  Users, Plus, Search, Edit2, Trash2, Save, 
  X, AlertTriangle, ShoppingCart, BarChart3, 
  TrendingUp, TrendingDown, Package, History, Activity
} from 'lucide-react';
import { generateId, getTodayStr, getLocalYMD, safeJsonParse, formatDate } from '../../utils/helpers'; 

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabMasterCustomer({ 
  data = [], 
  orders = [], 
  sendToSheet, 
  showToast,
  user 
}) {
  const todayStr = getTodayStr(); 
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState('');
  
  const [formData, setFormData] = useState({
    customer_name: '', phone: '', address: '', notes: '', category: 'RESELLER'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // STATE POP-UP MODAL MADING ANALITIK
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [activeCustDetail, setActiveCustDetail] = useState(null);

  const getDaysDifference = (d1, d2) => {
    const diffTime = Math.abs(new Date(d1) - new Date(d2));
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // 🔥 ENGINE CRM INTELIJEN: PROSES SINKRONISASI HISTORI NOTA
  const customerAnalytics = useMemo(() => {
    const analyticsMap = {};
    const validOrders = (orders || []).filter(o => !o.isDeleted);
    
    const todayObj = new Date(todayStr);
    const sevenAgo = new Date(todayObj); sevenAgo.setDate(todayObj.getDate() - 7);
    const fourteenAgo = new Date(todayObj); fourteenAgo.setDate(todayObj.getDate() - 14);
    
    const limit7 = sevenAgo.toISOString().split('T')[0];
    const limit14 = fourteenAgo.toISOString().split('T')[0];

    (data || []).forEach(cust => {
      if (cust && !cust.isDeleted && cust.id) {
        analyticsMap[cust.id] = {
          ...cust,
          totalTransaksi: 0, totalPcs: 0, totalOmset: 0,
          terakhirBelanja: null, hariAbsen: 999, butuhFollowUp: false,
          qtyW1: 0, qtyW2: 0, itemMap: {}, history: []
        };
      }
    });

    validOrders.forEach(o => {
      const matchedCust = Object.values(analyticsMap).find(
        c => String(c.customer_name || '').toUpperCase() === String(o.customer_name || o.customer || '').toUpperCase()
      );

      if (matchedCust) {
        matchedCust.totalTransaksi += 1;
        matchedCust.totalPcs += Number(o.qty || 0);
        matchedCust.totalOmset += Number(o.total_amount || o.total || 0);

        if (!matchedCust.terakhirBelanja || new Date(o.date) > new Date(matchedCust.terakhirBelanja)) {
          matchedCust.terakhirBelanja = o.date;
        }

        const orderDateYMD = getLocalYMD(o.date);
        if (orderDateYMD >= limit7 && orderDateYMD <= todayStr) {
          matchedCust.qtyW1 += Number(o.qty || 0);
        } else if (orderDateYMD >= limit14 && orderDateYMD < limit7) {
          matchedCust.qtyW2 += Number(o.qty || 0);
        }

        let parsedItems = [];
        try { parsedItems = safeJsonParse(o.items, []); } catch(e) {}
        parsedItems.forEach(i => {
          if(i && i.name) {
            matchedCust.itemMap[i.name] = (matchedCust.itemMap[i.name] || 0) + (Number(i.qty) || 0);
          }
        });

        matchedCust.history.push(o);
      }
    });

    return Object.values(analyticsMap).map(cust => {
      if (cust.terakhirBelanja) {
        cust.hariAbsen = getDaysDifference(todayStr, cust.terakhirBelanja);
        cust.butuhFollowUp = cust.hariAbsen > 7; 
      }

      cust.selisihPcs = cust.qtyW1 - cust.qtyW2;
      if (cust.selisihPcs > 0) cust.trend = 'NAIK';
      else if (cust.selisihPcs < 0) cust.trend = 'TURUN';
      else cust.trend = 'STABIL';

      const favs = Object.keys(cust.itemMap).map(k => ({ name: k, qty: cust.itemMap[k] }));
      cust.topItems = favs.sort((a,b) => b.qty - a.qty).slice(0, 3);
      cust.recentHistory = cust.history.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

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

  // 🔥 SINKRONISASI PASAK BUMI: PROSES SUBMIT DENGAN BUNGKUSAN ARRAY ANTI-TOLAK
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer_name.trim()) return alert('Nama pelanggan wajib diisi!');
    
    setIsSubmitting(true);
    
    // Penyusunan struktur objek data murni tanpa membawa sampah state kotor React
    const rawPayload = {
      id: isEditing ? currentId : generateId('CST', todayStr),
      date: todayStr,                     
      branch_id: currentBranch,           
      customer_name: formData.customer_name.trim().toUpperCase(), 
      phone: formData.phone.trim() || '-',
      address: formData.address.trim() || '-',
      notes: formData.notes.trim() || '-',
      category: formData.category || 'RESELLER',
      isDeleted: false                    
    };

    // 🔥 VAKSIN UTAMA: Membungkus payload ke dalam format Bungkusan Array `[rawPayload]`
    // Trik ini memaksa fungsi `Array.isArray(p)` di Apps Script Bos bekerja melebarkan kolom
    // secara otomatis ke sebelah kanan Sheets tanpa memicu error Out of Bounds!
    const finalPayload = isEditing ? rawPayload : [rawPayload];

    try {
      const actionType = isEditing ? 'update' : 'insert';
      const isSuccess = await sendToSheet(actionType, finalPayload, 'master_customers');
      
      if (isSuccess) {
        showToast(isEditing ? 'Profil agen berhasil diperbarui!' : 'Agen baru berhasil didaftarkan!', 'success');
        handleCancel();
      }
    } catch (error) {
      alert('Koneksi terputus atau format database Apps Script menolak data!');
    } finally {
      setIsSubmitting(false); // Melepaskan kuncian loading tombol
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-300">
      
      {/* HEADER & ANALITIK CRM SINGKAT */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2"><Users className="text-orange-600"/> Database Master CRM Agen</h2>
            <p className="text-xs font-bold text-slate-400 mt-1">Kelola data pelanggan dan bedah analitik kebiasaan belanja mereka.</p>
          </div>
          <button onClick={() => { handleCancel(); setIsEditing(true); }} className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-black text-xs shadow-md active:scale-95 transition-all">
            <Plus size={16} /> Tambah Agen Baru
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-lg border-t-4 border-t-orange-500">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
            <h3 className="font-black text-slate-800 text-sm">{currentId ? 'Edit Profil Agen' : 'Registrasi Agen Baru'}</h3>
            <button onClick={handleCancel} className="text-slate-400 hover:text-rose-500"><X size={20}/></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Nama Agen / Toko</label>
                <input required type="text" value={formData.customer_name} onChange={e=>setFormData({...formData, customer_name: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase outline-none focus:bg-white focus:border-orange-400" placeholder="MANDIRI JAYA" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Kategori / Harga</label>
                <select value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black outline-none focus:bg-white focus:border-orange-400 cursor-pointer">
                  <option value="RESELLER">Reseller</option>
                  <option value="MITRA">Mitra Utama</option>
                  <option value="ECERAN">Eceran Biasa</option>
                  <option value="PEMALANG">Area Pemalang</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">No. WhatsApp</label>
                <input type="text" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-orange-400" placeholder="0812..." />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Alamat Pengiriman</label>
                <input type="text" value={formData.address} onChange={e=>setFormData({...formData, address: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-orange-400" placeholder="Jl. Merdeka..." />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Catatan Internal (CRM)</label>
                <textarea rows="2" value={formData.notes} onChange={e=>setFormData({...formData, notes: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-orange-400" placeholder="Karakteristik pelanggan, jam operasional..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" disabled={isSubmitting} onClick={handleCancel} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 disabled:opacity-50">Batal</button>
              <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-orange-600 text-white font-black text-xs shadow-md hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2">
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
            <input type="text" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-orange-400 shadow-3xs" placeholder="Cari nama, no WA, atau kategori..." />
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
                <th className="px-4 py-3 text-center">Status Keaktifan</th>
                <th className="px-4 py-3 text-center">Akumulasi Belanja</th>
                <th className="px-4 py-3 text-center">Tren Order</th>
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
                        {item.butuhFollowUp && (
                          <span className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 animate-pulse"><AlertTriangle size={10}/> FOLLOW UP</span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono mt-0.5">ID: {item.id} • Kategori: <span className="text-orange-600 font-black">{item.category}</span></div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className={`text-[11px] font-black ${item.butuhFollowUp ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {item.terakhirBelanja ? (item.hariAbsen === 0 ? 'Order Hari Ini!' : `${item.hariAbsen} Hari Lalu`) : 'Belum Ada'}
                      </div>
                      <div className="text-[9px] text-slate-400 font-medium mt-0.5">{item.terakhirBelanja ? formatDate(item.terakhirBelanja) : '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="font-black text-slate-800">{formatRupiah(item.totalOmset)}</div>
                      <div className="text-[9px] text-slate-500 font-bold mt-0.5 flex items-center justify-center gap-1"><ShoppingCart size={10}/> {item.totalTransaksi}x ({formatNumber(item.totalPcs)} Pcs)</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.trend === 'NAIK' && <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md flex items-center justify-center gap-1 w-max mx-auto"><TrendingUp size={12}/> Naik</span>}
                      {item.trend === 'TURUN' && <span className="text-[10px] text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md flex items-center justify-center gap-1 w-max mx-auto"><TrendingDown size={12}/> Turun</span>}
                      {item.trend === 'STABIL' && <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md flex items-center justify-center gap-1 w-max mx-auto"><Activity size={12}/> Stabil</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => { setActiveCustDetail(item); setShowAnalyticsModal(true); }} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors border border-transparent hover:border-orange-200 shadow-3xs bg-white" title="Bedah Analitik &amp; Kebiasaan"><BarChart3 size={14}/></button>
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

      {/* POP-UP MODAL MADING INTELIJEN PELANGGAN */}
      {showAnalyticsModal && activeCustDetail && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col h-[85vh]">
            
            <div className="p-5 bg-slate-900 text-white flex justify-between items-start shrink-0 relative overflow-hidden">
              <div className="absolute right-0 top-0 opacity-10"><BarChart3 size={100}/></div>
              <div className="relative z-10">
                <h3 className="font-black text-base uppercase flex items-center gap-2"><BarChart3 size={18} className="text-orange-400"/> Bedah Profil: {activeCustDetail.customer_name}</h3>
                <div className="flex gap-4 mt-2 text-[10px] font-medium text-slate-300 normal-case">
                  <span className="flex items-center gap-1">📞 {activeCustDetail.phone || 'No HP kosong'}</span>
                  <span className="flex items-center gap-1">📍 {activeCustDetail.address || 'Alamat kosong'}</span>
                </div>
              </div>
              <button onClick={() => setShowAnalyticsModal(false)} className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer relative z-10">✕</button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar bg-slate-50 space-y-5">
              
              <div className="grid grid-cols-2 gap-4 shrink-0">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs flex flex-col justify-center items-center text-center">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status Fluktuasi Order</div>
                  {activeCustDetail.trend === 'NAIK' && <div className="text-emerald-600 font-black flex items-center gap-1.5 text-sm"><TrendingUp size={16}/> Naik {formatNumber(activeCustDetail.selisihPcs)} Pcs</div>}
                  {activeCustDetail.trend === 'TURUN' && <div className="text-rose-600 font-black flex items-center gap-1.5 text-sm"><TrendingDown size={16}/> Turun {formatNumber(Math.abs(activeCustDetail.selisihPcs))} Pcs</div>}
                  {activeCustDetail.trend === 'STABIL' && <div className="text-slate-600 font-black flex items-center gap-1.5 text-sm"><Activity size={16}/> Stabil</div>}
                  <div className="text-[9px] text-slate-400 mt-1 font-medium normal-case">Komparasi 7 hari vs 14 hari lalu.</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs flex flex-col justify-center items-center text-center">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Kontribusi Agen</div>
                  <div className="text-lg font-black text-slate-800 tracking-tight">{formatRupiah(activeCustDetail.totalOmset)}</div>
                  <div className="text-[9px] text-slate-400 mt-1 font-medium normal-case">Akumulasi {activeCustDetail.totalTransaksi} nota terdaftar.</div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-3xs overflow-hidden">
                <div className="px-4 py-3 bg-orange-50/50 border-b border-orange-100 text-[10px] font-black text-orange-800 uppercase flex items-center gap-1.5">
                  <Package size={14}/> Top 3 Menu Favorit Agen
                </div>
                <div className="p-4 flex flex-col gap-3">
                  {activeCustDetail.topItems.length === 0 ? (
                    <div className="text-center text-slate-400 text-xs font-bold py-4">Belum ada riwayat pembelian item.</div>
                  ) : (
                    activeCustDetail.topItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black ${idx === 0 ? 'bg-amber-400 text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}>#{idx+1}</span>
                          <span className="font-bold text-slate-800 text-xs normal-case">{item.name}</span>
                        </div>
                        <span className="font-black text-orange-600 text-xs bg-orange-50 px-2 py-1 rounded-md">{formatNumber(item.qty)} Pcs</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-3xs overflow-hidden">
                <div className="px-4 py-3 bg-blue-50/50 border-b border-blue-100 text-[10px] font-black text-blue-800 uppercase flex items-center gap-1.5">
                  <History size={14}/> 5 Riwayat Nota Terakhir
                </div>
                <div className="divide-y divide-slate-100">
                  {activeCustDetail.recentHistory.length === 0 ? (
                    <div className="text-center text-slate-400 text-xs font-bold py-6">Belum ada riwayat transaksi.</div>
                  ) : (
                    activeCustDetail.recentHistory.map((nota, idx) => (
                      <div key={idx} className="p-3.5 flex justify-between items-center hover:bg-slate-50 transition-colors">
                        <div>
                          <div className="text-[11px] font-black text-slate-800 flex items-center gap-2">
                            {formatDate(nota.date)}
                            <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase ${nota.status === 'LUNAS' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{nota.status}</span>
                          </div>
                          <div className="text-[9px] font-mono text-slate-400 mt-1">{nota.id}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-slate-800 text-sm tracking-tight">{formatRupiah(nota.total_amount)}</div>
                          <div className="text-[9px] text-slate-500 font-bold mt-0.5 normal-case">{formatNumber(nota.qty)} Pcs dibeli</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {activeCustDetail.notes && (
                <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 text-xs font-medium text-amber-800 normal-case leading-relaxed">
                  <strong className="block mb-1 text-[10px] uppercase tracking-widest text-amber-600/70">Catatan Internal:</strong>
                  "{activeCustDetail.notes}"
                </div>
              )}

            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 text-right shrink-0">
              <button onClick={() => { setShowAnalyticsModal(false); }} className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer">
                Tutup Mading
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
