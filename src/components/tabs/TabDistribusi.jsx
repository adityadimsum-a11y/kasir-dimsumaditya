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
      `Tujuan: ${form.destinationBranch.replace(/_/g, ' ')}\n` +
      `Muatan: ${formatNumber(form.qty)} ${selectedItemInfo.unit} (${selectedItemInfo.name})\n` +
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
        branch_name: log.origin_branch_id.replace(/_/g, ' '), 
        admin_name: user?.name || 'LOGISTIK HQ',
        customer_name: `TUJUAN PENGIRIMAN: ${log.destination_branch_id.replace(/_/g, ' ')}`,
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
    <div className="space-y-6 pb-10 text-slate-700 animate-in fade-in duration-200">
      
      {/* CARD RUNNING HEADER - CLEAN FLAT ENTERPRISE STYLE */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 lg:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600"></div>
        <div className="pl-3">
          <h2 className="text-lg font-black flex items-center gap-2 text-slate-800 tracking-wide">
            <Truck className="text-blue-600" size={24}/> Distribusi Global &amp; Logistik Antar Cabang
          </h2>
          <p className="text-[11px] font-bold text-slate-400 mt-1.5 normal-case max-w-xl leading-relaxed">
            Pusat kendali rantai pasok. Mengatur pembuatan dokumen surat jalan resmi dari Pusat ke Cabang untuk bahan mentah, kemasan, maupun produk jadi.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* FORM INPUT SURAT JALAN BARU (4 KOLOM) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl shadow-sm h-max border-t-4 border-t-blue-600 overflow-hidden">
          <form onSubmit={handleKirimBarang} className="p-6 space-y-5">
            <h3 className="font-black text-slate-800 uppercase tracking-wider text-xs pb-4 border-b border-slate-100 flex items-center gap-2">
              <ClipboardList size={18} className="text-blue-600"/> Buat Surat Jalan Baru
            </h3>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Cabang Tujuan Distribusi</label>
              <select required value={form.destinationBranch} onChange={e=>setForm({...form, destinationBranch: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 outline-none cursor-pointer focus:bg-white focus:border-blue-500 transition-colors shadow-sm">
                <option value="">-- Pilih cabang tujuan --</option>
                {availableDestinations.map(b => (
                  <option key={b.branch_id} value={b.branch_id}>🏢 {b.branch_name} ({b.branch_type})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Pilih Item Logistik</label>
                <select value={form.itemIndex} onChange={e=>setForm({...form, itemIndex: Number(e.target.value)})} className="w-full p-3 border border-slate-200 rounded-xl text-[10px] font-bold bg-slate-50 outline-none cursor-pointer focus:bg-white focus:border-blue-500 transition-colors shadow-sm uppercase tracking-wider">
                  {MASTER_LOGISTIC_ITEMS.map((item, index) => (
                    <option key={item.id} value={index}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Volume Muatan ({selectedItemInfo.unit})</label>
                <input type="number" required value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-3 border border-slate-200 text-center text-base font-black text-blue-700 bg-slate-50 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-colors shadow-inner" placeholder="0" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Nama Supir / Kurir Pengirim</label>
              <input type="text" required value={form.driverName} onChange={e=>setForm({...form, driverName: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500 transition-colors shadow-sm uppercase tracking-wider" placeholder="Ketik nama driver..." />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Catatan Memo Surat Jalan</label>
              <input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50 outline-none focus:bg-white focus:border-blue-500 transition-colors shadow-sm normal-case" placeholder="Cth: Titip mika box ukuran kecil" />
            </div>

            <button type="submit" className="w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-wider shadow-md bg-blue-600 hover:bg-blue-700 transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer mt-4">
              <Truck size={16}/> Kirim Logistik &amp; Cetak Manifest
            </button>
          </form>
        </div>

        {/* JURNAL SINKRONISASI HANTARAN BARANG (7 KOLOM) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden h-[75vh]">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
            <div>
              <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-blue-600"/> Manifest Pengiriman Logistik Terakhir
              </h4>
              <p className="text-[10px] text-slate-500 font-bold normal-case mt-1">Menampilkan rekam jejak hantaran logistik pada tanggal kalender berjalan.</p>
            </div>
            
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
              <Calendar size={14} className="text-blue-500 ml-0.5"/>
              <input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value)} className="text-[11px] font-bold outline-none bg-transparent cursor-pointer text-slate-700" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-[10px] uppercase text-slate-500 bg-slate-50/50 border-b border-slate-100 sticky top-0 shadow-sm z-10 tracking-wider">
                <tr>
                  <th className="px-5 py-4 font-black">ID &amp; Cabang Tujuan</th>
                  <th className="px-5 py-4 font-black">Isi Muatan Logistik</th>
                  <th className="px-5 py-4 font-black">Supir / Memo</th>
                  <th className="px-5 py-4 font-black text-center">Status Jalan</th>
                  <th className="px-5 py-4 font-black text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-100 bg-white">
                {filteredDistTable.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-24 text-slate-400 font-medium normal-case bg-white">
                       <div className="flex flex-col items-center justify-center">
                         <Truck size={48} className="mb-3 opacity-20"/>
                         <span className="text-sm font-black text-slate-400">Belum ada riwayat hantaran logistik<br/>antar-cabang pada tanggal ini.</span>
                       </div>
                    </td>
                  </tr>
                ) : (
                  filteredDistTable.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-black text-xs uppercase">🏢 {log.destination_branch_id?.replace(/_/g, ' ')}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-1">{log.id}</div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-black text-blue-700 text-sm">{formatNumber(log.qty)} <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">{log.unit}</span></div>
                        <div className="text-slate-600 text-[10px] mt-1 uppercase tracking-wider font-bold">{log.item_name}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-slate-800 font-black text-xs flex items-center gap-2 uppercase tracking-wider"><User size={14} className="text-slate-400"/> {log.driver_name}</div>
                        <div className="text-[10px] text-slate-500 font-medium mt-1.5 normal-case leading-tight italic">Memo: "{log.notes}"</div>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        {log.status === 'DALAM_PERJALANAN' ? (
                          <span className="text-[9px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg flex items-center justify-center mx-auto w-max gap-1.5 animate-pulse border border-amber-200 shadow-sm"><Truck size={12}/> OTR / DI JALAN</span>
                        ) : (
                          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center justify-center mx-auto w-max gap-1.5 border border-emerald-200 shadow-sm"><CheckCircle2 size={12}/> SAMPAI TUJUAN</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap opacity-40 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => handlePrintSuratJalan(log)} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors border border-transparent shadow-sm cursor-pointer" title="Re-cetak slip manifest">
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
