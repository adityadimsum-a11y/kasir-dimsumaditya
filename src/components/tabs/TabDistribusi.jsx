import React, { useState, useMemo } from 'react';
import { Truck, ArrowRightLeft, Calendar, User, Package, Layers, ClipboardList, Printer, CheckCircle2, AlertCircle } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

// 🔥 MESIN PENERJEMAH TANGGAL SAKTI (ANTI-BADAI)
const parseDateToYMD = (dbDate) => {
  if (!dbDate) return null;
  const EN_MONTHS = {
    'januari': 'january', 'februari': 'february', 'maret': 'march', 'mei': 'may',
    'juni': 'june', 'juli': 'july', 'agustus': 'august', 'oktober': 'october', 'desember': 'december'
  };
  let safeDateStr = String(dbDate).toLowerCase();
  for (const [id, en] of Object.entries(EN_MONTHS)) {
    safeDateStr = safeDateStr.replace(id, en);
  }
  try {
    const d = new Date(safeDateStr);
    if(!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
  } catch(e){}
  
  if (typeof dbDate === 'string' && dbDate.match(/^\d{4}-\d{2}-\d{2}/)) return dbDate.substring(0, 10);
  return null; 
};

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
  masterBranches = [], master_branches, 
  sendToSheet, setPrintData, showToast, user // 🔥 FIX: Gunakan setPrintData dari App.jsx
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  const todayYMD = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // --- STATE MANAGEMENT ---
  const [tableDateFilter, setTableDateFilter] = useState(todayYMD); 
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

  // 🔥 FILTER RIWAYAT TABEL MENGGUNAKAN MESIN TRANSLATOR ANTI-BADAI
  const filteredDistTable = useMemo(() => {
    return realDistOrders.filter(d => {
      if (d.isDeleted) return false;
      const dYMD = parseDateToYMD(d.date);
      return dYMD === tableDateFilter;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realDistOrders, tableDateFilter]);

  // --- ACTIONS: KIRIM SURAT JALAN BARU ---
  const handleKirimBarang = async (e) => {
    e.preventDefault();
    if (!form.destinationBranch) return alert("Pilih cabang tujuan pengiriman terlebih dahulu!");
    if (Number(form.qty) <= 0) return alert("Jumlah kuantitas pengiriman harus lebih dari 0!");

    const confirmMsg = `Konfirmasi Pembuatan Surat Jalan:\n\n` +
      `Tujuan: ${form.destinationBranch.replace('_', ' ')}\n` +
      `Muatan: ${form.qty} ${selectedItemInfo.unit} (${selectedItemInfo.name})\n` +
      `Supir/Kurir: ${form.driverName.toUpperCase()}\n\n` +
      `Lanjutkan pengiriman armada?`;

    if (!window.confirm(confirmMsg)) return;

    const doId = generateId('DO', todayStr);
    const payload = {
      id: doId, date: todayStr, origin_branch_id: currentBranch, destination_branch_id: form.destinationBranch,
      item_id: selectedItemInfo.id, item_name: selectedItemInfo.name, item_category: selectedItemInfo.category,
      qty: Number(form.qty), unit: selectedItemInfo.unit, driver_name: form.driverName.toUpperCase(),
      status: 'DALAM_PERJALANAN', 
      notes: form.notes ? form.notes.toUpperCase() : '-', verified_date: '',
      isDeleted: false
    };

    if (await sendToSheet('insert', payload, 'distribution_orders')) {
      showToast('Surat jalan pengiriman berhasil dibuat! Armada on the road.', 'success');
      handlePrintSuratJalan(payload);
      setForm({ destinationBranch: '', itemIndex: 0, qty: '', driverName: '', notes: '' });
    }
  };

  // 🔥 FIX: MENGGUNAKAN MESIN PRINT TERPUSAT APP.JSX
  const handlePrintSuratJalan = (log) => {
    if (typeof setPrintData === 'function') {
      setPrintData({
        title: 'SURAT JALAN / MANIFEST DISTRIBUSI', 
        id: log.id, 
        date: formatDate(log.date),
        branch_name: log.origin_branch_id.replace('_', ' '), 
        admin_name: user?.name || 'LOGISTIK HQ',
        customer_name: `TUJUAN: ${log.destination_branch_id.replace(/_/g, ' ')}`,
        items: [{ 
          name: `${log.item_name}\nKATEGORI: ${log.item_category.replace(/_/g, ' ')}\nSUPIR KURIR: ${log.driver_name}\nKET: ${log.notes}`, 
          qty: log.qty, 
          suffix: ` ${log.unit}`, 
          subtotal: 0 
        }],
        paymentMethod: 'DOKUMEN VALIDASI INTERNAL'
      });
    } else {
      alert("Sistem printer sedang dimuat, mohon tunggu sebentar.");
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-200">
      
      {/* CARD RUNNING HEADER - CLEAN FLAT ENTERPRISE STYLE */}
      <div className="card-holo p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600"></div>
        <div className="pl-2">
          <h2 className="text-sm font-black normal-case flex items-center gap-2 text-slate-800">
            <Truck className="text-red-600" size={18}/> Distribusi Global &amp; Logistik Antar Cabang
          </h2>
          <p className="text-[10px] font-bold text-slate-400 mt-0.5 normal-case">
            Pusat kendali rantai pasok. Mengatur pembuatan dokumen surat jalan resmi dari Pusat ke Cabang.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* FORM INPUT SURAT JALAN BARU (4 KOLOM) */}
        <div className="lg:col-span-5 card-holo p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs h-max border-t-4 border-t-blue-600">
          <form onSubmit={handleKirimBarang} className="space-y-4">
            <h3 className="font-black text-slate-800 normal-case text-xs pb-3 border-b border-slate-100 flex items-center gap-2">
              <ClipboardList size={16} className="text-blue-600"/> Buat Surat Jalan Baru
            </h3>

            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Cabang Tujuan Distribusi</label>
              <select required value={form.destinationBranch} onChange={e=>setForm({...form, destinationBranch: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-bold bg-slate-50 outline-none cursor-pointer focus:bg-white focus:border-blue-500 transition-colors shadow-3xs">
                <option value="">-- Pilih cabang tujuan --</option>
                {availableDestinations.map(b => (
                  <option key={b.branch_id} value={b.branch_id}>🏢 {b.branch_name} ({b.branch_type})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Pilih Item Logistik</label>
                <select value={form.itemIndex} onChange={e=>setForm({...form, itemIndex: Number(e.target.value)})} className="w-full p-2.5 border border-slate-200 rounded-lg text-[10px] font-bold bg-slate-50 outline-none cursor-pointer focus:bg-white focus:border-blue-500 transition-colors shadow-3xs">
                  {MASTER_LOGISTIC_ITEMS.map((item, index) => (
                    <option key={item.id} value={index}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Volume Muatan ({selectedItemInfo.unit})</label>
                <input type="number" required value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 border border-slate-200 text-center text-sm font-black text-blue-700 bg-slate-50 rounded-lg outline-none focus:bg-white focus:border-blue-500 transition-colors shadow-3xs" placeholder="0" />
              </div>
            </div>

            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Nama Supir / Kurir Pengirim</label>
              <input type="text" required value={form.driverName} onChange={e=>setForm({...form, driverName: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500 transition-colors shadow-3xs" placeholder="Ketik nama driver..." />
            </div>

            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Catatan Memo Surat Jalan</label>
              <input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-medium bg-slate-50 outline-none focus:bg-white focus:border-blue-500 transition-colors shadow-3xs" placeholder="Cth: Titip mika box ukuran kecil" />
            </div>

            <button type="submit" className="w-full text-white font-black py-3.5 rounded-lg text-xs normal-case shadow-md bg-blue-600 hover:bg-blue-700 transition-colors active:scale-95 flex items-center justify-center gap-2 cursor-pointer mt-2">
              <Truck size={14}/> Kirim Logistik &amp; Cetak Manifest
            </button>
          </form>
        </div>

        {/* JURNAL SINKRONISASI HANTARAN BARANG (7 KOLOM) */}
        <div className="lg:col-span-7 card-holo bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col overflow-hidden h-[75vh]">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
            <div>
              <h4 className="font-black text-xs normal-case text-slate-800 flex items-center gap-2">
                <ArrowRightLeft size={16} className="text-blue-600"/> Manifest Pengiriman Logistik Terakhir
              </h4>
              <p className="text-[9px] text-slate-500 font-bold normal-case mt-0.5">Menampilkan rekam jejak hantaran pada tanggal kalender berjalan.</p>
            </div>
            
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-3xs">
              <Calendar size={12} className="text-blue-600 ml-0.5"/>
              <input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value)} className="text-[10px] font-bold outline-none bg-transparent cursor-pointer text-slate-700" />
            </div>
          </div>

          <div className="overflow-x-auto flex-1 p-1 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-[10px] normal-case text-slate-500 bg-slate-50/50 border-b border-slate-100 sticky top-0 shadow-3xs z-10">
                <tr>
                  <th className="px-4 py-3 font-black">ID &amp; Cabang Tujuan</th>
                  <th className="px-4 py-3 font-black">Isi Muatan Logistik</th>
                  <th className="px-4 py-3 font-black">Supir / Memo</th>
                  <th className="px-4 py-3 font-black text-center">Status Jalan</th>
                  <th className="px-4 py-3 font-black text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-100 bg-white">
                {filteredDistTable.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-20 text-slate-400 font-medium normal-case bg-white">
                       <div className="flex flex-col items-center justify-center">
                         <Truck size={36} className="mb-2 opacity-20"/>
                         <span className="text-xs font-bold text-slate-400">Belum ada riwayat hantaran logistik antar-cabang pada tanggal ini.</span>
                       </div>
                    </td>
                  </tr>
                ) : (
                  filteredDistTable.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-black text-[11px] normal-case">🏢 {log.destination_branch_id?.replace(/_/g, ' ')}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-1">{log.id}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="font-black text-blue-700 text-sm">{formatNumber(log.qty)} <span className="text-[9px] text-blue-500 font-bold">{log.unit}</span></div>
                        <div className="text-slate-600 text-[10px] mt-0.5 normal-case font-bold">{log.item_name}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-slate-800 font-black text-[11px] flex items-center gap-1.5 normal-case"><User size={12} className="text-slate-400"/> {log.driver_name}</div>
                        <div className="text-[9px] text-slate-500 font-medium mt-1 normal-case leading-tight">Memo: "{log.notes}"</div>
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        {log.status === 'DALAM_PERJALANAN' ? (
                          <span className="text-[8px] font-black normal-case text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md flex items-center justify-center mx-auto w-max gap-1 animate-pulse border border-amber-200 shadow-3xs"><Truck size={10}/> OTR / DI JALAN</span>
                        ) : (
                          <span className="text-[8px] font-black normal-case text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md flex items-center justify-center mx-auto w-max gap-1 border border-emerald-200 shadow-3xs"><CheckCircle2 size={10}/> SAMPAI TUJUAN</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => handlePrintSuratJalan(log)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent shadow-3xs cursor-pointer" title="Re-cetak slip manifest">
                          <Printer size={14}/>
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
