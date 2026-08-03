import React, { useState, useMemo } from 'react';
import { 
  Search, Plus, Printer, Edit2, Trash2, 
  User, Phone, MapPin, X, CheckCircle2, 
  TrendingUp, TrendingDown, Minus, Activity, Users
} from 'lucide-react';
import { getTodayStr, generateId, getLocalYMD, formatDate } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabMasterCustomer({ 
  master_customers = [], 
  orders = [], 
  sendToSheet, 
  showToast, 
  setPrintData,
  user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    id: '',
    customer_name: '',
    phone: '',
    address: '',
    category: 'AGEN_REGULER',
    notes: ''
  });

  // =========================================================================
  // 🧠 ENGINE: KALKULASI CRM & TREN BELANJA AGEN
  // =========================================================================
  const crmData = useMemo(() => {
    // 1. Siapkan Map Pelanggan
    const customerMap = {};
    (master_customers || []).forEach(c => {
      if (!c.isDeleted) {
        customerMap[c.customer_name.toUpperCase()] = {
          ...c,
          total_belanja: 0,
          frekuensi_order: 0,
          qty_bulan_ini: 0,
          qty_bulan_lalu: 0,
          terakhir_belanja: null
        };
      }
    });

    // 2. Hitung Batas Waktu untuk Analisa Tren
    const currentMonth = todayStr.substring(0, 7);
    const lastMonthDate = new Date(todayStr);
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonth = lastMonthDate.toISOString().substring(0, 7);

    // 3. Tarik Data dari Orders / Penjualan
    (orders || []).forEach(o => {
      if (o.isDeleted) return;
      const cName = String(o.customer_name || o.customer || 'UMUM').toUpperCase();
      
      if (customerMap[cName]) {
        const orderYMD = getLocalYMD(o.date);
        const orderMonth = orderYMD.substring(0, 7);
        const qtyOrder = Number(o.qty || 0);
        
        customerMap[cName].total_belanja += Number(o.total_amount || o.total || 0);
        customerMap[cName].frekuensi_order += 1;
        
        // Cari order terakhir
        if (!customerMap[cName].terakhir_belanja || new Date(o.date) > new Date(customerMap[cName].terakhir_belanja)) {
          customerMap[cName].terakhir_belanja = o.date;
        }

        // Kalkulasi Tren Kuantitas
        if (orderMonth === currentMonth) {
          customerMap[cName].qty_bulan_ini += qtyOrder;
        } else if (orderMonth === lastMonth) {
          customerMap[cName].qty_bulan_lalu += qtyOrder;
        }
      }
    });

    // 4. Ubah Map menjadi Array & Filter Pencarian
    let finalArray = Object.values(customerMap).map(c => {
      const selisihQty = c.qty_bulan_ini - c.qty_bulan_lalu;
      return {
        ...c,
        tren: selisihQty > 0 ? 'NAIK' : selisihQty < 0 ? 'TURUN' : 'STABIL',
        selisih_qty: Math.abs(selisihQty)
      };
    });

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      finalArray = finalArray.filter(c => 
        (c.customer_name || '').toLowerCase().includes(lowerSearch) ||
        (c.phone || '').toLowerCase().includes(lowerSearch) ||
        (c.category || '').toLowerCase().includes(lowerSearch)
      );
    }

    // Urutkan berdasarkan total belanja terbanyak
    return finalArray.sort((a, b) => b.total_belanja - a.total_belanja);
  }, [master_customers, orders, searchTerm, todayStr]);

  // =========================================================================
  // ⚡ ACTIONS
  // =========================================================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_name) return alert("Nama agen/toko wajib diisi!");
    
    setIsSubmitting(true);
    const isEdit = !!form.id;
    
    const payload = {
      id: isEdit ? form.id : generateId('CUST', todayStr),
      date: todayStr,
      branch_id: currentBranch,
      customer_name: form.customer_name.toUpperCase(),
      phone: form.phone,
      address: form.address,
      category: form.category,
      notes: form.notes,
      isDeleted: false
    };

    try {
      const isSuccess = await sendToSheet(isEdit ? 'update' : 'insert', payload, 'master_customers');
      if (isSuccess) {
        if(typeof showToast === 'function') showToast(isEdit ? 'Data agen diperbarui!' : 'Agen baru berhasil diregistrasi!', 'success');
        setShowModal(false);
        setForm({ id: '', customer_name: '', phone: '', address: '', category: 'AGEN_REGULER', notes: '' });
      }
    } catch(err) {
      alert("Terjadi kesalahan koneksi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (c) => {
    setForm({
      id: c.id,
      customer_name: c.customer_name,
      phone: c.phone || '',
      address: c.address || '',
      category: c.category || 'AGEN_REGULER',
      notes: c.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (c) => {
    if (window.confirm(`Yakin ingin menonaktifkan agen ${c.customer_name} dari database?`)) {
      await sendToSheet('update', { id: c.id, isDeleted: true }, 'master_customers');
      if(typeof showToast === 'function') showToast('Agen berhasil dihapus.', 'success');
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 animate-in fade-in duration-300">
      
      {/* 🌟 HERO BANNER */}
      <div className="bg-[#a04000] p-6 lg:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
          <Users size={200} className="text-white"/>
        </div>
        <div className="relative z-10 w-full md:w-2/3">
          <h2 className="text-xl lg:text-2xl font-black text-white flex items-center gap-3 tracking-wide uppercase mb-2">
            <Users size={28}/> Database Master CRM Agen
          </h2>
          <p className="text-[11px] font-bold text-white/80 leading-relaxed max-w-md">
            Kelola data identitas pelanggan, kategori harga agen, dan bedah analitik kebiasaan belanja mereka secara real-time.
          </p>
        </div>
        <div className="relative z-10 flex gap-3 w-full md:w-auto">
          {/* <button className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 backdrop-blur-sm border border-white/20">
            <Printer size={16}/> Cetak (A4)
          </button> */}
          <button 
            onClick={() => { setForm({ id: '', customer_name: '', phone: '', address: '', category: 'AGEN_REGULER', notes: '' }); setShowModal(true); }} 
            className="w-full md:w-auto px-6 py-3 bg-[#e67e22] hover:bg-[#d35400] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus size={18} strokeWidth={3}/> Registrasi Agen Baru
          </button>
        </div>
      </div>

      {/* 🔍 SEARCH BAR & COUNTER */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari nama, no WA, atau kategori..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-[#e67e22] transition-colors"
          />
        </div>
        <div className="px-6 py-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest w-full md:w-auto text-center">
          Total Agen Terdaftar: <span className="text-slate-800 text-sm ml-1">{crmData.length}</span>
        </div>
      </div>

      {/* 📊 TABEL CRM */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto custom-scrollbar min-h-[50vh]">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-[10px] font-black text-slate-500 uppercase tracking-wider bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th className="px-5 py-5 w-1/3">Nama Agen / Toko</th>
                <th className="px-5 py-5 text-center">Status Keaktifan</th>
                <th className="px-5 py-5 text-right">Akumulasi Belanja</th>
                <th className="px-5 py-5 text-center">Tren Order</th>
                <th className="px-5 py-5 text-center">Aksi Hub</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs bg-white">
              {crmData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-20">
                    <Search size={40} className="mx-auto text-slate-300 mb-3"/>
                    <div className="font-bold text-slate-400 text-sm">Data agen tidak ditemukan.</div>
                  </td>
                </tr>
              ) : (
                crmData.map(c => {
                  const hariAbsen = c.terakhir_belanja ? Math.floor((new Date() - new Date(c.terakhir_belanja)) / (1000 * 60 * 60 * 24)) : 999;
                  const isMacet = hariAbsen > 14;
                  
                  return (
                    <tr key={c.id} className="hover:bg-orange-50/30 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="font-black text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
                          {c.customer_name}
                          {c.total_belanja > 10000000 && <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">VIP</span>}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 mt-1 flex items-center gap-3">
                          <span className="flex items-center gap-1"><Phone size={10}/> {c.phone || '-'}</span>
                          <span className="flex items-center gap-1"><MapPin size={10}/> {c.address ? (c.address.length > 20 ? c.address.substring(0, 20)+'...' : c.address) : '-'}</span>
                        </div>
                        <div className="mt-1.5 inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {c.category.replace(/_/g, ' ')}
                        </div>
                      </td>
                      
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        {c.frekuensi_order === 0 ? (
                          <div className="text-[10px] font-bold text-slate-400">Belum Pernah Order</div>
                        ) : (
                          <div>
                            <div className={`text-[10px] font-black uppercase tracking-wider ${isMacet ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {isMacet ? '⚠️ Macet Belanja' : '✅ Aktif Order'}
                            </div>
                            <div className="text-[9px] font-bold text-slate-500 mt-0.5">
                              Trakhir: {hariAbsen === 0 ? 'Hari Ini' : `${hariAbsen} Hari Lalu`}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="font-black text-slate-800 text-base">{formatRupiah(c.total_belanja)}</div>
                        <div className="text-[10px] font-bold text-slate-500 mt-0.5 uppercase tracking-wider">{c.frekuensi_order}x Transaksi</div>
                      </td>

                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        {c.tren === 'NAIK' && <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 shadow-sm"><TrendingUp size={12}/> NAIK</span>}
                        {c.tren === 'TURUN' && <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100 shadow-sm"><TrendingDown size={12}/> TURUN</span>}
                        {c.tren === 'STABIL' && <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 shadow-sm"><Minus size={12}/> STABIL</span>}
                      </td>

                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleEdit(c)} className="p-2 text-slate-400 bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600 rounded-lg shadow-sm transition-colors cursor-pointer" title="Edit Data Agen">
                            <Edit2 size={14}/>
                          </button>
                          <button onClick={() => handleDelete(c)} className="p-2 text-slate-400 bg-white border border-slate-200 hover:border-rose-300 hover:text-rose-600 rounded-lg shadow-sm transition-colors cursor-pointer" title="Hapus Agen">
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* ========================================= */}
      {/* 🟥 MODAL REGISTRASI / EDIT AGEN 🟥 */}
      {/* ========================================= */}
      {showModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-[#a04000] flex justify-between items-center text-white">
              <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                <User size={18} className="text-[#f39c12]"/> {/* 🔥 INI PENYEBAB CRASH SEBELUMNYA! SEKARANG SUDAH AMAN */}
                {form.id ? 'Edit Data Agen' : 'Registrasi Agen Baru'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white transition-colors cursor-pointer"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Nama Agen / Toko / Pembeli</label>
                <input 
                  type="text" required 
                  value={form.customer_name} 
                  onChange={e => setForm({...form, customer_name: e.target.value})} 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-[#e67e22] uppercase" 
                  placeholder="Cth: TOKO BERKAH / AGEN DIMSUM CIPONDOH" 
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Nomor WhatsApp / HP</label>
                  <input 
                    type="text" 
                    value={form.phone} 
                    onChange={e => setForm({...form, phone: e.target.value})} 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-[#e67e22]" 
                    placeholder="0812xxxx..." 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Kategori Harga Agen</label>
                  <select 
                    value={form.category} 
                    onChange={e => setForm({...form, category: e.target.value})} 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase outline-none focus:bg-white focus:border-[#e67e22] cursor-pointer tracking-wider"
                  >
                    <option value="UMUM_ECERAN">Umum / Eceran</option>
                    <option value="AGEN_REGULER">Agen Reguler</option>
                    <option value="AGEN_VIP">Agen VIP / Partai Besar</option>
                    <option value="RESELLER">Reseller Dropship</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Alamat Lengkap Pengiriman</label>
                <textarea 
                  rows="2"
                  value={form.address} 
                  onChange={e => setForm({...form, address: e.target.value})} 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-[#e67e22] resize-none" 
                  placeholder="Jl. Raya Cipondoh..." 
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Catatan Internal (Khusus CRM)</label>
                <input 
                  type="text"
                  value={form.notes} 
                  onChange={e => setForm({...form, notes: e.target.value})} 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-[#e67e22]" 
                  placeholder="Cth: Sering ngutang, atau Minta dikirim jam 9 pagi..." 
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 rounded-xl text-slate-500 font-black text-xs uppercase tracking-wider hover:bg-slate-100 cursor-pointer transition-colors">Batal</button>
                <button type="submit" disabled={isSubmitting} className="px-8 py-2.5 rounded-xl bg-[#e67e22] hover:bg-[#d35400] text-white font-black text-xs uppercase tracking-wider shadow-md disabled:opacity-50 cursor-pointer transition-colors flex items-center gap-2">
                  {isSubmitting ? 'Menyimpan...' : (form.id ? 'Update Data' : 'Simpan Agen')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
