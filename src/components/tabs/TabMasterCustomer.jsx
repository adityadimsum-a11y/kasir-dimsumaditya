import React, { useState, useMemo } from 'react';
import { 
  Users, Plus, Search, Edit2, Trash2, Save, 
  X, AlertTriangle, ShoppingCart, BarChart3, 
  TrendingUp, TrendingDown, Package, History, Activity, Printer,
  Award, ChevronRight, Filter
} from 'lucide-react';
import { generateId, getTodayStr, getLocalYMD, safeJsonParse, formatDate } from '../../utils/helpers'; 

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabMasterCustomer({ 
  master_customers = [], 
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

  const [showForm, setShowForm] = useState(false); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // STATE MADING ANALITIK & FILTER BULAN
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [activeCustDetail, setActiveCustDetail] = useState(null);
  const [modalFilterMonth, setModalFilterMonth] = useState(() => todayStr.substring(0, 7)); // Format YYYY-MM

  const getDaysDifference = (d1, d2) => {
    const diffTime = Math.abs(new Date(d1) - new Date(d2));
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // 🔥 ENGINE CRM INTELIJEN & PROFIT HPP
  const customerAnalytics = useMemo(() => {
    const analyticsMap = {};
    const validOrders = (orders || []).filter(o => !o.isDeleted);
    
    const todayObj = new Date(todayStr);
    const sevenAgo = new Date(todayObj); sevenAgo.setDate(todayObj.getDate() - 7);
    const fourteenAgo = new Date(todayObj); fourteenAgo.setDate(todayObj.getDate() - 14);
    
    const limit7 = sevenAgo.toISOString().split('T')[0];
    const limit14 = fourteenAgo.toISOString().split('T')[0];

    (master_customers || []).forEach(cust => {
      const custId = cust.customer_id || cust.id; 
      if (cust && !cust.isDeleted && custId) {
        analyticsMap[custId] = {
          ...cust,
          customer_id: custId,
          totalTransaksi: 0, totalPcs: 0, totalOmset: 0, totalHPP: 0, 
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
        
        let orderHPP = 0;
        parsedItems.forEach(i => {
          if(i && i.name) {
            matchedCust.itemMap[i.name] = (matchedCust.itemMap[i.name] || 0) + (Number(i.qty) || 0);
            orderHPP += (Number(i.hpp || 0) * Number(i.qty || 0)); // Kalkulasi HPP per item
          }
        });

        matchedCust.totalHPP += orderHPP;
        matchedCust.history.push({ ...o, orderHPP }); // Simpan HPP ke dalam history spesifik
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

      cust.totalProfit = cust.totalOmset - cust.totalHPP; 

      const favs = Object.keys(cust.itemMap).map(k => ({ name: k, qty: cust.itemMap[k] }));
      cust.topItems = favs.sort((a,b) => b.qty - a.qty).slice(0, 3);

      return cust;
    }).reverse();
  }, [master_customers, orders, todayStr]);

  // 🔥 ENGINE LEADERBOARD TOP 10 SULTAN
  const top10Customers = useMemo(() => {
    return [...customerAnalytics]
      .filter(c => c.totalOmset > 0)
      .sort((a, b) => b.totalOmset - a.totalOmset)
      .slice(0, 10);
  }, [customerAnalytics]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return customerAnalytics;
    const lower = searchTerm.toLowerCase();
    return customerAnalytics.filter(item => 
      (item.customer_name || '').toLowerCase().includes(lower) ||
      (item.phone || '').toLowerCase().includes(lower) ||
      (item.customer_tier || item.category || '').toLowerCase().includes(lower)
    );
  }, [customerAnalytics, searchTerm]);

  // 🔥 FILTER HISTORY MADING BERDASARKAN BULAN PILIHAN
  const filteredModalHistory = useMemo(() => {
    if (!activeCustDetail) return [];
    return activeCustDetail.history
      .filter(o => String(o.date).startsWith(modalFilterMonth)) // Hanya tampil bulan yang dipilih
      .sort((a,b) => new Date(b.date) - new Date(a.date));
  }, [activeCustDetail, modalFilterMonth]);

  const handleEdit = (item) => {
    setFormData({
      customer_name: item.customer_name || '',
      phone: item.phone || '',
      address: item.address || '',
      notes: item.notes || '',
      category: item.customer_tier || item.category || 'RESELLER' 
    });
    setCurrentId(item.customer_id); 
    setShowForm(true); 
    setIsEditing(true);
  };

  const handleCancel = () => {
    setFormData({ customer_name: '', phone: '', address: '', notes: '', category: 'RESELLER' });
    setShowForm(false);
    setIsEditing(false);
    setCurrentId('');
  };

  const handleDelete = async (id, name) => {
    if(!window.confirm(`Yakin ingin menghapus agen "${name}"? Data riwayatnya tidak akan terhapus, tapi namanya hilang dari mesin kasir.`)) return;
    const isSuccess = await sendToSheet('update', { customer_id: id, isDeleted: true }, 'master_customers');
    if(isSuccess) showToast('Data pelanggan berhasil dihapus!', 'success');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer_name.trim()) return alert('Nama pelanggan wajib diisi!');
    
    setIsSubmitting(true);
    const isEditMode = !!currentId; 

    const rawPayload = {
      customer_id: isEditMode ? currentId : generateId('CST', todayStr),
      customer_name: formData.customer_name.trim().toUpperCase(),
      branch_id: currentBranch,
      customer_tier: formData.category || 'RESELLER',
      phone: formData.phone.trim() || '-',
      address: formData.address.trim() || '-',
      status: 'ACTIVE',
      notes: formData.notes.trim() || '-',
      isDeleted: false
    };

    const finalPayload = isEditMode ? rawPayload : [rawPayload];

    try {
      const actionType = isEditMode ? 'update' : 'insert';
      const isSuccess = await sendToSheet(actionType, finalPayload, 'master_customers');
      
      if (isSuccess) {
        showToast(isEditMode ? 'Profil agen berhasil diperbarui!' : 'Agen baru berhasil didaftarkan!', 'success');
        handleCancel();
      }
    } catch (error) {
      alert(`CRASH SISTEM: ${error.message}`);
    } finally {
      setIsSubmitting(false); 
    }
  };

  const handlePrintRekap = () => {
    if (filteredData.length === 0) return alert('Tidak ada data yang bisa dicetak!');
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('Gagal mencetak. Pop-up terblokir oleh browser Anda!');

    let tableRows = '';
    filteredData.forEach((item, index) => {
      tableRows += `
        <tr>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${index + 1}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${item.customer_name}<br><small style="color: #64748b; font-weight: normal;">ID: ${item.customer_id}</small></td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.customer_tier || item.category}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0;">${item.phone || '-'}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${formatRupiah(item.totalOmset)}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.totalTransaksi}x</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.terakhirBelanja ? formatDate(item.terakhirBelanja) : 'Belum Ada'}</td>
        </tr>
      `;
    });

    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rekap Pelanggan CRM - Dimsum Aditya</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #ea580c; padding-bottom: 15px; }
            h2 { margin: 0 0 8px 0; color: #ea580c; font-size: 26px; text-transform: uppercase; letter-spacing: 1px; }
            p { margin: 0; color: #64748b; font-size: 14px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th { background-color: #f8fafc; padding: 12px 8px; border-bottom: 2px solid #cbd5e1; text-align: left; font-weight: 900; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; }
            .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; font-style: italic; }
            @media print {
              body { padding: 0; }
              @page { margin: 1.5cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>REKAPITULASI MASTER DATABASE AGEN</h2>
            <p>Tanggal Cetak: ${formatDate(todayStr)} | Filter: ${searchTerm ? `"${searchTerm}"` : 'Semua Data'} | Total Data: ${filteredData.length} Agen</p>
          </div>
          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 5%;">No</th>
                <th style="width: 25%;">Nama Agen / ID</th>
                <th style="text-align: center; width: 12%;">Kategori</th>
                <th style="width: 15%;">No. Telepon</th>
                <th style="text-align: right; width: 15%;">Akumulasi Omset</th>
                <th style="text-align: center; width: 13%;">Frekuensi Order</th>
                <th style="text-align: center; width: 15%;">Terakhir Belanja</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div class="footer">
            *Dokumen ini dicetak otomatis dari Enterprise Command Center - Dimsum Aditya.
          </div>
          <script>
            window.onload = () => { 
              setTimeout(() => {
                window.print(); 
                window.close(); 
              }, 500); 
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlTemplate);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 animate-in fade-in duration-300">
      
      {/* 🚀 HEADER & ANALITIK CRM SINGKAT - FLUID GRADIENT */}
      <div className="bg-gradient-to-r from-orange-900 via-orange-800 to-orange-900 p-6 lg:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 rounded-3xl shadow-xl relative overflow-hidden border border-orange-800">
        <div className="absolute top-0 right-0 p-4 opacity-10"><Users size={120} className="text-orange-300"/></div>
        <div className="relative z-10 w-full md:w-1/2">
          <h2 className="text-xl lg:text-2xl font-black text-white flex items-center gap-3 mb-2 tracking-wide uppercase">
             <Users className="text-orange-400" size={28}/> Database Master CRM Agen
          </h2>
          <p className="text-[11px] font-bold text-slate-300 leading-relaxed max-w-sm normal-case">
             Kelola data identitas pelanggan, kategori harga agen, dan bedah analitik kebiasaan belanja mereka secara real-time.
          </p>
        </div>
        
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto mt-2 md:mt-0 shrink-0">
          <button onClick={handlePrintRekap} className="w-full sm:w-auto bg-slate-900/60 hover:bg-slate-800 text-white px-5 py-3.5 rounded-xl flex items-center justify-center gap-2 font-black text-[11px] border border-slate-700/50 shadow-inner backdrop-blur-sm active:scale-95 transition-all uppercase tracking-wider cursor-pointer">
            <Printer size={16} className="text-slate-400" /> Cetak (A4)
          </button>
          <button onClick={() => { handleCancel(); setShowForm(true); }} className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 font-black text-[11px] shadow-md active:scale-95 transition-transform uppercase tracking-wider cursor-pointer">
            <Plus size={16} /> Registrasi Agen Baru
          </button>
        </div>
      </div>

      {/* 🔥 LEADERBOARD TOP 10 AGEN SULTAN */}
      {top10Customers.length > 0 && !showForm && (
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 rounded-3xl shadow-md text-white relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
          <h3 className="text-sm font-black uppercase tracking-widest mb-5 flex items-center gap-2 relative z-10"><Award size={18}/> Klasemen Top 10 Agen Sultan</h3>
          
          <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-3 snap-x relative z-10">
            {top10Customers.map((cust, idx) => (
              <div 
                key={cust.customer_id} 
                onClick={() => { setActiveCustDetail(cust); setShowAnalyticsModal(true); setModalFilterMonth(todayStr.substring(0, 7)); }}
                className="bg-white/10 hover:bg-white/20 border border-white/20 p-4 rounded-2xl min-w-[220px] shrink-0 cursor-pointer snap-start transition-all shadow-inner group"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className={`w-7 h-7 flex items-center justify-center rounded-full text-[10px] font-black shadow-md ${idx === 0 ? 'bg-amber-300 text-amber-900' : idx === 1 ? 'bg-slate-200 text-slate-700' : idx === 2 ? 'bg-orange-800 text-white' : 'bg-white/20 text-white'}`}>#{idx + 1}</span>
                  <span className="text-[9px] font-bold bg-black/20 px-2.5 py-1 rounded-md tracking-wider uppercase">{cust.totalTransaksi} Order</span>
                </div>
                <div className="font-black text-sm truncate uppercase tracking-wide group-hover:text-amber-100 transition-colors">{cust.customer_name}</div>
                <div className="text-[10px] font-bold text-white/70 mt-1 mb-3 uppercase tracking-wider">{cust.customer_tier || cust.category}</div>
                <div className="font-black text-amber-200 text-xl tracking-tight">{formatRupiah(cust.totalOmset)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm border-t-4 border-t-orange-500 animate-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
            <h3 className="font-black text-slate-800 text-base uppercase tracking-wider flex items-center gap-2"><User size={20} className="text-orange-500"/> {currentId ? 'Edit Profil Agen' : 'Form Registrasi Agen Baru'}</h3>
            <button onClick={handleCancel} className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer bg-slate-50 hover:bg-rose-50 p-2 rounded-full"><X size={20}/></button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Nama Agen / Toko</label>
                <input required type="text" value={formData.customer_name} onChange={e=>setFormData({...formData, customer_name: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase outline-none focus:bg-white focus:border-orange-400 shadow-sm transition-colors" placeholder="Cth: MANDIRI JAYA" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Kategori / Level Harga</label>
                <select value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black outline-none focus:bg-white focus:border-orange-400 cursor-pointer shadow-sm uppercase tracking-wider transition-colors">
                  <option value="RESELLER">Reseller</option>
                  <option value="MITRA">Mitra Utama</option>
                  <option value="ECERAN">Eceran Biasa</option>
                  <option value="PEMALANG">Area Pemalang</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">No. Telepon / WhatsApp</label>
                <input type="text" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-orange-400 shadow-sm transition-colors" placeholder="0812XXXXXXXX" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Alamat Lengkap Pengiriman</label>
                <input type="text" value={formData.address} onChange={e=>setFormData({...formData, address: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-orange-400 shadow-sm normal-case transition-colors" placeholder="Jl. Merdeka No. 12..." />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Catatan Internal (Rahasia CRM)</label>
                <textarea rows="3" value={formData.notes} onChange={e=>setFormData({...formData, notes: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-orange-400 shadow-sm normal-case transition-colors" placeholder="Ketik karakteristik pelanggan, preferensi jadwal pengiriman, dll..." />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 mt-2">
              <button type="button" disabled={isSubmitting} onClick={handleCancel} className="px-8 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-black text-[11px] hover:bg-slate-50 disabled:opacity-50 uppercase tracking-wider cursor-pointer transition-colors w-full sm:w-auto">Batal</button>
              <button type="submit" disabled={isSubmitting} className="px-8 py-3.5 rounded-xl bg-orange-600 text-white font-black text-[11px] shadow-md hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer transition-transform active:scale-95 w-full sm:w-auto">
                {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                {isSubmitting ? 'Menyimpan...' : 'Simpan Data Agen'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 shrink-0">
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input type="text" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-orange-400 shadow-sm transition-colors normal-case" placeholder="Cari nama, no WA, atau kategori..." />
          </div>
          <div className="text-[10px] font-black text-slate-500 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm uppercase tracking-wider hidden sm:block">
            Total Agen Terdaftar: {filteredData.length}
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar flex-1 p-2">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-[10px] font-black text-slate-500 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100 sticky top-0 z-10">
              <tr>
                <th className="px-5 py-4">Nama Agen / Toko</th>
                <th className="px-5 py-4 text-center">Status Keaktifan</th>
                <th className="px-5 py-4 text-center">Akumulasi Belanja</th>
                <th className="px-5 py-4 text-center">Tren Order</th>
                <th className="px-5 py-4 text-center">Aksi Hub</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700 bg-white">
              {filteredData.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-20 text-slate-400 font-bold text-sm normal-case"><Search size={40} className="mx-auto mb-3 opacity-20"/>Data agen tidak ditemukan.</td></tr>
              ) : (
                filteredData.map(item => (
                  <tr key={item.customer_id || item.id} className="hover:bg-orange-50/30 transition-colors group">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-black text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2 mb-1">
                        {item.customer_name} 
                        {item.butuhFollowUp && (
                          <span className="flex items-center gap-1 text-[8px] px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200 animate-pulse tracking-wider shadow-sm"><AlertTriangle size={10}/> FOLLOW UP</span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono font-bold uppercase tracking-wider">ID: {item.customer_id} • <span className="text-orange-600 font-black">{item.customer_tier || item.category}</span></div>
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      <div className={`text-[11px] font-black uppercase tracking-wider ${item.butuhFollowUp ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {item.terakhirBelanja ? (item.hariAbsen === 0 ? 'Order Hari Ini!' : `${item.hariAbsen} Hari Lalu`) : 'Belum Pernah'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">{item.terakhirBelanja ? formatDate(item.terakhirBelanja) : '-'}</div>
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      <div className="font-black text-slate-800 text-base tracking-tight">{formatRupiah(item.totalOmset)}</div>
                      <div className="text-[10px] text-slate-500 font-bold mt-1.5 flex items-center justify-center gap-1 uppercase tracking-wider"><ShoppingCart size={12}/> {item.totalTransaksi}x ({formatNumber(item.totalPcs)} Pcs)</div>
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      {item.trend === 'NAIK' && <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 w-max mx-auto shadow-sm"><TrendingUp size={14}/> Naik</span>}
                      {item.trend === 'TURUN' && <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 w-max mx-auto shadow-sm"><TrendingDown size={14}/> Turun</span>}
                      {item.trend === 'STABIL' && <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 w-max mx-auto shadow-sm"><Activity size={14}/> Stabil</span>}
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap opacity-40 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { setActiveCustDetail(item); setShowAnalyticsModal(true); setModalFilterMonth(todayStr.substring(0, 7)); }} className="p-2.5 text-orange-600 hover:bg-orange-50 rounded-xl transition-colors border border-slate-200 hover:border-orange-300 shadow-sm bg-white cursor-pointer" title="Bedah Analitik & Kebiasaan"><BarChart3 size={16}/></button>
                        <button onClick={() => handleEdit(item)} className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors border border-slate-200 hover:border-blue-300 shadow-sm bg-white cursor-pointer" title="Edit Profil"><Edit2 size={16}/></button>
                        <button onClick={() => handleDelete(item.customer_id, item.customer_name)} className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors border border-slate-200 hover:border-rose-300 shadow-sm bg-white cursor-pointer" title="Hapus Permanen"><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAnalyticsModal && activeCustDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl border border-slate-200 overflow-hidden flex flex-col h-[90vh]">
            
            <div className="p-6 bg-slate-950 text-white flex justify-between items-start shrink-0 relative overflow-hidden">
              <div className="absolute right-0 top-0 opacity-5"><BarChart3 size={120}/></div>
              <div className="relative z-10">
                <h3 className="font-black text-lg uppercase tracking-wide flex items-center gap-2.5"><BarChart3 size={20} className="text-orange-400"/> Bedah Profil Mading: {activeCustDetail.customer_name}</h3>
                <div className="flex flex-wrap gap-4 mt-2.5 text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700/50 shadow-inner">📞 {activeCustDetail.phone || 'No HP kosong'}</span>
                  <span className="flex items-center gap-1.5 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700/50 shadow-inner">📍 {activeCustDetail.address || 'Alamat kosong'}</span>
                </div>
              </div>
              <button onClick={() => setShowAnalyticsModal(false)} className="text-slate-400 hover:text-white text-xl font-bold cursor-pointer relative z-10 transition-colors">✕</button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar bg-slate-50 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 shrink-0">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center relative overflow-hidden">
                  <div className="absolute top-0 w-full h-1 bg-blue-500"></div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 mt-1">Status Fluktuasi Order</div>
                  {activeCustDetail.trend === 'NAIK' && <div className="text-emerald-600 font-black flex items-center gap-2 text-lg"><TrendingUp size={20}/> Naik {formatNumber(activeCustDetail.selisihPcs)} Pcs</div>}
                  {activeCustDetail.trend === 'TURUN' && <div className="text-rose-600 font-black flex items-center gap-2 text-lg"><TrendingDown size={20}/> Turun {formatNumber(Math.abs(activeCustDetail.selisihPcs))} Pcs</div>}
                  {activeCustDetail.trend === 'STABIL' && <div className="text-slate-600 font-black flex items-center gap-2 text-lg"><Activity size={20}/> Stabil</div>}
                  <div className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-wider">Komparasi 7 Hari VS 14 Hari Lalu.</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center relative overflow-hidden">
                  <div className="absolute top-0 w-full h-1 bg-emerald-500"></div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 mt-1">Akumulasi Belanja</div>
                  <div className="text-3xl font-black text-slate-800 tracking-tight my-1">{formatRupiah(activeCustDetail.totalOmset)}</div>
                  <div className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">Total {activeCustDetail.totalTransaksi} Nota Terdaftar.</div>
                </div>
                
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center md:col-span-2 border-t-4 border-t-orange-500">
                  <div className="text-[10px] font-black text-white bg-orange-600 uppercase tracking-widest mb-4 px-3 py-1 rounded-md shadow-md">Rahasia Dapur (HQ Only)</div>
                  <div className="grid grid-cols-2 w-full gap-5 divide-x divide-slate-100">
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Total Modal (HPP)</div>
                      <div className="text-xl font-black text-slate-700 tracking-tight line-through decoration-slate-300">{formatRupiah(activeCustDetail.totalHPP)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Total Estimasi Profit</div>
                      <div className="text-xl font-black text-emerald-600 tracking-tight flex justify-center items-center gap-1.5"><TrendingUp size={16}/> {formatRupiah(activeCustDetail.totalProfit)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 bg-orange-50/80 border-b border-orange-100 text-[11px] font-black text-orange-800 uppercase flex items-center gap-2 tracking-wider">
                  <Package size={16}/> Top 3 Menu Favorit Agen
                </div>
                <div className="p-5 flex flex-col gap-3">
                  {activeCustDetail.topItems.length === 0 ? (
                    <div className="text-center text-slate-400 text-xs font-bold py-6">Belum ada riwayat pembelian item.</div>
                  ) : (
                    activeCustDetail.topItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl shadow-3xs">
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 flex items-center justify-center rounded-full text-[11px] font-black shadow-sm border border-slate-200 ${idx === 0 ? 'bg-amber-400 text-white' : 'bg-white text-slate-500'}`}>#{idx+1}</span>
                          <span className="font-black text-slate-800 text-sm uppercase tracking-wide">{item.name}</span>
                        </div>
                        <span className="font-black text-orange-700 text-sm bg-orange-100 px-3 py-1.5 rounded-lg border border-orange-200 shadow-sm">{formatNumber(item.qty)} Pcs</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 bg-blue-50/80 border-b border-blue-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="text-[11px] font-black text-blue-800 uppercase flex items-center gap-2 tracking-wider">
                    <History size={16}/> Riwayat Nota Bulanan
                  </div>
                  <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border border-blue-200 shadow-sm">
                    <Filter size={14} className="text-blue-400"/>
                    <input type="month" value={modalFilterMonth} onChange={e=>setModalFilterMonth(e.target.value)} className="text-[10px] font-bold outline-none text-blue-900 bg-transparent cursor-pointer uppercase tracking-wider" />
                  </div>
                </div>
                
                <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto custom-scrollbar p-2">
                  {filteredModalHistory.length === 0 ? (
                    <div className="text-center text-slate-400 text-xs font-bold py-12">Belum ada riwayat transaksi di bulan ini.</div>
                  ) : (
                    filteredModalHistory.map((nota, idx) => (
                      <div key={idx} className="p-4 flex justify-between items-center hover:bg-slate-50/80 transition-colors rounded-xl">
                        <div>
                          <div className="text-[11px] font-black text-slate-800 flex items-center gap-2 mb-1.5 tracking-wider">
                            {formatDate(nota.date)}
                            <span className={`px-2 py-0.5 rounded-md text-[8px] uppercase tracking-wider border shadow-3xs ${nota.status === 'LUNAS' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>{nota.status}</span>
                          </div>
                          <div className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded w-max border border-slate-200">{nota.id}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-slate-900 text-base tracking-tight mb-1">{formatRupiah(nota.total_amount)}</div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">HPP: <span className="line-through decoration-slate-300">{formatRupiah(nota.orderHPP)}</span> | Profit: <span className="text-emerald-600 font-black">{formatRupiah(nota.total_amount - nota.orderHPP)}</span></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {activeCustDetail.notes && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 text-sm font-bold text-amber-900 normal-case leading-relaxed shadow-inner">
                  <strong className="block mb-2 text-[10px] uppercase tracking-widest text-amber-700/80 flex items-center gap-1.5"><AlertTriangle size={14}/> Catatan Internal CRM:</strong>
                  "{activeCustDetail.notes}"
                </div>
              )}

            </div>

            <div className="p-5 bg-white border-t border-slate-200 text-right shrink-0">
              <button onClick={() => setShowAnalyticsModal(false)} className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] uppercase tracking-wider rounded-xl shadow-md transition-transform active:scale-95 cursor-pointer w-full sm:w-auto">
                Tutup Mading
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
