import React, { useState, useMemo } from 'react';
import { Truck, ArrowRightLeft, Calendar, User, Package, Layers, ClipboardList, Printer, CheckCircle2, AlertCircle } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

// MASTER DATA DROP-DOWN MULTI-KATEGORI LOGISTIK
const MASTER_LOGISTIC_ITEMS = [
  { id: 'DIMSUM_FROZEN', name: 'Dimsum Frozen Core', category: 'PRODUK_JADI', unit: 'Pcs' },
  { id: 'AYAM_MENTAH', name: 'Daging Ayam Mentah Fillet', category: 'BAHAN_BAKU', unit: 'Kg' },
  { id: 'BUMBU_RAHASIA', name: 'Bumbu Racikan Olahan Core', category: 'BAHAN_BAKU', unit: 'Pack' },
  { id: 'SAUS_DIMSUM', name: 'Saus Cabai Cair Merah', category: 'LOGISTIK_MANDIRI', unit: 'Pack' },
  { id: 'MIKA_PACKAGING', name: 'Plastik Mika Isi 50', category: 'LOGISTIK_MANDIRI', unit: 'Pack' },
];

export default function TabDistribution({ 
  distribution_orders = [], distribution_orders_data,
  masterBranches = [], master_branches, sendToSheet, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  // --- STATE MANAGEMENT ---
  const [tableDateFilter, setTableDateFilter] = useState(todayStr); // Default tabel cuma tampil HARI INI
  const [form, setForm] = useState({
    destinationBranch: '', itemIndex: 0, qty: '', driverName: '', notes: ''
  });

  // --- SINKRONISASI DATABASE ---
  const realDistOrders = useMemo(() => distribution_orders_data || distribution_orders || [], [distribution_orders, distribution_orders_data]);
  const rawBranches = useMemo(() => master_branches || masterBranches || [], [master_branches, masterBranches]);

  // Filter Cabang Tujuan (Kecuali Pusat Sendiri)
  const availableDestinations = useMemo(() => {
    return rawBranches.filter(b => !b.isDeleted && b.branch_id !== 'PUSAT' && b.branch_id !== 'TANGERANG_PUSAT');
  }, [rawBranches]);

  const selectedItemInfo = useMemo(() => MASTER_LOGISTIC_ITEMS[form.itemIndex] || MASTER_LOGISTIC_ITEMS[0], [form.itemIndex]);

  // Filter riwayat surat jalan khusus tanggal yang dipilih di kalender kecil
  const filteredDistTable = useMemo(() => {
    return realDistOrders.filter(d => !d.isDeleted && d.date.substring(0, 10) === tableDateFilter);
  }, [realDistOrders, tableDateFilter]);

  // --- ACTIONS: KIRIM SURAT JALAN BARU ---
  const handleKirimBarang = async (e) => {
    e.preventDefault();
    if (!form.destinationBranch) return alert("Pilih cabang tujuan pengiriman terlebih dahulu!");
    if (Number(form.qty) <= 0) return alert("Jumlah kuantitas pengiriman harus lebih dari 0!");

    const doId = generateId('DO', todayStr);
    const payload = {
      id: doId, date: todayStr, origin_branch_id: currentBranch, destination_branch_id: form.destinationBranch,
      item_id: selectedItemInfo.id, item_name: selectedItemInfo.name, item_category: selectedItemInfo.category,
      qty: Number(form.qty), unit: selectedItemInfo.unit, driver_name: form.driverName.toUpperCase(),
      status: 'DALAM_PERJALANAN', // Dikunci menggantung, nunggu konfirmasi cabang penerima
      notes: form.notes ? form.notes.toUpperCase() : '-', verified_date: ''
    };

    if (await sendToSheet('insert', payload, 'distribution_orders')) {
      showToast('Surat jalan berhasil dibuat! Status: Dalam Perjalanan', 'success');
      handlePrintSuratJalan(payload);
      setForm({ destinationBranch: '', itemIndex: 0, qty: '', driverName: '', notes: '' });
    }
  };

  const handlePrintSuratJalan = (log) => {
    triggerPrint('NOTA_DOTMATRIX', {
      title: 'SURAT JALAN / MANIFEST INTER-NODE', id: log.id, date: formatDate(log.date),
      branch_name: log.origin_branch_id, admin_name: user?.name || 'LOGISTIK HQ',
      customer_name: `TUJUAN: ${log.destination_branch_id.replace('_', ' ')}`,
      items: [{ name: `${log.item_name}\nKATEGORI: ${log.item_category}\nSUPIR: ${log.driver_name}\nKET: ${log.notes}`, qty: log.qty, suffix: ` ${log.unit}`, subtotal: 0 }],
      paymentMethod: 'DOKUMEN VALIDASI INTERNAL'
    });
  };

  return (
    <div className="space-y-6 pb-10">
      
      {/* CARD RUNNING HEADER */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-md">
        <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
          <Truck className="text-blue-400"/> Distribusi Global &amp; Logistik Inter-Node
        </h2>
        <p className="text-xs font-bold text-slate-400 mt-1">Pusat kendali rantai pasok. Mengatur pembuatan dokumen Surat Jalan (Manifest hantaran bahan baku &amp; produk jadi) dari Pusat ke Cabang.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* KANTONG KIRI: INPUT FORM SURAT JALAN BARU (SMOOTH & MEWAH) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-max">
          <form onSubmit={handleKirimBarang} className="space-y-5">
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider pb-3 border-b flex items-center gap-2">
              <ClipboardList size={16} className="text-blue-500"/> Buat Surat Jalan Baru
            </h3>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Cabang Hub Tujuan</label>
              <select required value={form.destinationBranch} onChange={e=>setForm({...form, destinationBranch: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-black bg-slate-50 outline-none uppercase cursor-pointer">
                <option value="">-- PILIH CABANG TUJUAN --</option>
                {availableDestinations.map(b => (
                  <option key={b.branch_id} value={b.branch_id}>🏢 {b.branch_name.toUpperCase()} ({b.branch_type})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Pilih Item Logistik</label>
                <select value={form.itemIndex} onChange={e=>setForm({...form, itemIndex: Number(e.target.value)})} className="w-full p-3 border rounded-xl text-xs font-black bg-slate-50 outline-none uppercase cursor-pointer">
                  {MASTER_LOGISTIC_ITEMS.map((item, index) => (
                    <option key={item.id} value={index}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Volume Kuantitas ({selectedItemInfo.unit})</label>
                <input type="number" required value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-3 border rounded-xl text-base font-black text-center text-blue-700 bg-slate-50 outline-none focus:bg-white focus:border-blue-500" placeholder="0" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Nama Kurir / Supir Pengirim</label>
              <input type="text" required value={form.driverName} onChange={e=>setForm({...form, driverName: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-bold uppercase bg-slate-50 outline-none focus:bg-white focus:border-blue-500" placeholder="Ketik nama driver..." />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Catatan Memo Surat Jalan</label>
              <input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500" placeholder="Contoh: Titip mika box ukuran kecil" />
            </div>

            <button type="submit" className="w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-md bg-blue-600 hover:bg-blue-700 transition-transform active:scale-95 flex items-center justify-center gap-2">
              <Truck size={14}/> Kirim Logistik &amp; Cetak Surat Jalan
            </button>
          </form>
        </div>

        {/* KANTONG KANAN: TRACKING PANEL REAL-TIME HARI INI */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h4 className="font-black text-xs uppercase text-slate-700 tracking-widest flex items-center gap-1.5">
                <ArrowRightLeft size={14} className="text-blue-500"/> Manifest Pengiriman Logistik Terakhir
              </h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Filter Tanggal: {formatDate(tableDateFilter)}</p>
            </div>
            
            <div className="flex items-center gap-2 bg-white border px-2.5 py-1.5 rounded-xl shadow-sm">
              <Calendar size={12} className="text-slate-400"/>
              <input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value || todayStr)} className="text-xs font-black outline-none bg-transparent cursor-pointer text-slate-700" />
            </div>
          </div>

          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] uppercase text-slate-400 bg-white border-b">
                <tr>
                  <th className="px-4 py-3 font-black">ID &amp; Tujuan</th>
                  <th className="px-4 py-3 font-black">Isi Muatan</th>
                  <th className="px-4 py-3 font-black">Supir / Memo</th>
                  <th className="px-4 py-3 font-black text-center">Status Jalan</th>
                  <th className="px-4 py-3 font-black text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-50">
                {filteredDistTable.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-20 text-slate-400 font-bold uppercase">Tidak ada riwayat pengiriman logistik inter-node pada tanggal {formatDate(tableDateFilter)}</td></tr>
                ) : (
                  filteredDistTable.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-black uppercase text-xs">🏢 {log.destination_branch_id?.replace('_', ' ')}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-1">{log.id}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="font-black text-blue-700 text-sm">{formatNumber(log.qty)} {log.unit}</div>
                        <div className="text-slate-500 text-[10px] mt-0.5 uppercase font-medium">{log.item_name}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-slate-700 font-bold flex items-center gap-1"><User size={11} className="text-slate-400"/> {log.driver_name}</div>
                        <div className="text-[10px] text-slate-400 font-medium italic mt-0.5">Memo: "{log.notes}"</div>
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        {log.status === 'DALAM_PERJALANAN' ? (
                          <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-1 rounded-md flex items-center justify-center mx-auto w-max gap-1 animate-pulse border border-amber-200"><Truck size={10}/> OTR / Di Jalan</span>
                        ) : (
                          <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md flex items-center justify-center mx-auto w-max gap-1 border border-emerald-200"><CheckCircle2 size={10}/> Diterima Cabang</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => handlePrintSuratJalan(log)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Re-Cetak Surat Jalan">
                          <Printer size={16}/>
                        </button>
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
  );
}
