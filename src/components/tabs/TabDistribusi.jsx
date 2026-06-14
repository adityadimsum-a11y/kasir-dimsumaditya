import React, { useState, useMemo } from 'react';
import { Truck, ArrowRightLeft, Calendar, User, Package, Layers, ClipboardList, Printer, CheckCircle2, AlertCircle } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

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
  masterBranches = [], master_branches, sendToSheet, showToast, user 
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

    const doId = generateId('DO', todayStr);
    const payload = {
      id: doId, date: todayStr, origin_branch_id: currentBranch, destination_branch_id: form.destinationBranch,
      item_id: selectedItemInfo.id, item_name: selectedItemInfo.name, item_category: selectedItemInfo.category,
      qty: Number(form.qty), unit: selectedItemInfo.unit, driver_name: form.driverName.toUpperCase(),
      status: 'DALAM_PERJALANAN', 
      notes: form.notes ? form.notes.toUpperCase() : '-', verified_date: ''
    };

    if (await sendToSheet('insert', payload, 'distribution_orders')) {
      showToast('Surat jalan pengiriman berhasil dibuat! Status: Di Jalan', 'success');
      handlePrintSuratJalan(payload);
      setForm({ destinationBranch: '', itemIndex: 0, qty: '', driverName: '', notes: '' });
    }
  };

  const handlePrintSuratJalan = (log) => {
    triggerPrint('NOTA_DOTMATRIX', {
      title: 'SURAT JALAN / MANIFEST DISTRIBUSI', id: log.id, date: formatDate(log.date),
      branch_name: log.origin_branch_id, admin_name: user?.name || 'LOGISTIK HQ',
      customer_name: `TUJUAN: ${log.destination_branch_id.replace('_', ' ')}`,
      items: [{ name: `${log.item_name}\nKATEGORI: ${log.item_category.replace('_', ' ')}\nSUPIR KURIR: ${log.driver_name}\nKET: ${log.notes}`, qty: log.qty, suffix: ` ${log.unit}`, subtotal: 0 }],
      paymentMethod: 'DOKUMEN VALIDASI INTERNAL'
    });
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      
      {/* CARD RUNNING HEADER - CLEAN FLAT ENTERPRISE STYLE */}
      <div className="card-holo p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden bg-white">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600"></div>
        <div className="pl-2">
          <h2 className="text-base font-extrabold normal-case flex items-center gap-2 text-slate-900">
            <Truck className="text-red-600"/> Distribusi global &amp; logistik antar cabang
          </h2>
          <p className="text-[10px] font-semibold text-slate-400 mt-1 normal-case tracking-wide">
            Pusat kendali rantai pasok. Mengatur pembuatan dokumen surat jalan dari Pusat ke Cabang.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* FORM INPUT SURAT JALAN BARU */}
        <div className="card-holo p-6 h-max border-t-4 border-t-blue-600">
          <form onSubmit={handleKirimBarang} className="space-y-4">
            <h3 className="font-extrabold text-slate-800 normal-case text-xs pb-3 border-b border-slate-100 flex items-center gap-2">
              <ClipboardList size={16} className="text-blue-600"/> Buat surat jalan baru
            </h3>

            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Cabang tujuan distribusi</label>
              <select required value={form.destinationBranch} onChange={e=>setForm({...form, destinationBranch: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-bold bg-slate-50 outline-none cursor-pointer focus:bg-white focus:border-blue-500 transition-colors">
                <option value="">-- Pilih cabang tujuan --</option>
                {availableDestinations.map(b => (
                  <option key={b.branch_id} value={b.branch_id}>🏢 {b.branch_name} ({b.branch_type})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Pilih item logistik</label>
                <select value={form.itemIndex} onChange={e=>setForm({...form, itemIndex: Number(e.target.value)})} className="w-full p-2.5 border border-slate-200 rounded-lg text-[10px] font-bold bg-slate-50 outline-none cursor-pointer focus:bg-white focus:border-blue-500 transition-colors">
                  {MASTER_LOGISTIC_ITEMS.map((item, index) => (
                    <option key={item.id} value={index}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Volume muatan ({selectedItemInfo.unit})</label>
                <input type="number" required value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 border border-slate-200 text-center text-sm font-black text-blue-700 bg-slate-50 rounded-lg outline-none focus:bg-white focus:border-blue-500 transition-colors" placeholder="0" />
              </div>
            </div>

            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Nama kurir / Supir pengirim</label>
              <input type="text" required value={form.driverName} onChange={e=>setForm({...form, driverName: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500 transition-colors" placeholder="Ketik nama driver..." />
            </div>

            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Catatan memo surat jalan</label>
              <input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-semibold bg-slate-50 outline-none focus:bg-white focus:border-blue-500 transition-colors" placeholder="Cth: Titip mika box ukuran kecil" />
            </div>

            <button type="submit" className="w-full text-white font-bold py-3.5 rounded-lg text-xs normal-case shadow-sm bg-blue-600 hover:bg-blue-700 transition-colors active:scale-95 flex items-center justify-center gap-2">
              <Truck size={14}/> Kirim logistik &amp; cetak manifest
            </button>
          </form>
        </div>

        {/* JURNAL SINKRONISASI HANTARAN BARANG */}
        <div className="lg:col-span-2 card-holo flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h4 className="font-extrabold text-xs normal-case text-slate-800 flex items-center gap-2">
                <ArrowRightLeft size={16} className="text-blue-600"/> Manifest pengiriman logistik terakhir
              </h4>
              <p className="text-[10px] text-slate-500 font-medium normal-case mt-1">Hanya menampilkan data pada tanggal kalender berjalan</p>
            </div>
            
            <div className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-lg shadow-xs">
              <Calendar size={14} className="text-blue-600 ml-0.5"/>
              <input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value)} className="text-xs font-bold outline-none bg-transparent cursor-pointer text-slate-700" />
            </div>
          </div>

          <div className="overflow-x-auto flex-1 p-1 custom-scrollbar min-h-[50vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-[10px] normal-case text-slate-400 bg-slate-50/50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 font-bold">ID &amp; Cabang tujuan</th>
                  <th className="px-5 py-3 font-bold">Isi muatan logistik</th>
                  <th className="px-5 py-3 font-bold">Supir / Memo</th>
                  <th className="px-5 py-3 font-bold text-center">Status jalan</th>
                  <th className="px-5 py-3 font-bold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-100 bg-white">
                {filteredDistTable.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-24 text-slate-400 font-medium normal-case bg-white">
                       <div className="flex flex-col items-center justify-center">
                         <Truck size={36} className="mb-2 opacity-20"/>
                         <span>Belum ada riwayat hantaran logistik antar-cabang pada tanggal ini.</span>
                       </div>
                    </td>
                  </tr>
                ) : (
                  filteredDistTable.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-extrabold text-xs normal-case">🏢 {log.destination_branch_id?.replace('_', ' ')}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-1">{log.id}</div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-extrabold text-blue-700 text-sm">{formatNumber(log.qty)} <span className="text-[10px] text-blue-500 font-bold">{log.unit}</span></div>
                        <div className="text-slate-500 text-[10px] mt-0.5 normal-case font-bold">{log.item_name}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-slate-700 font-bold flex items-center gap-1.5 normal-case"><User size={12} className="text-slate-400"/> {log.driver_name}</div>
                        <div className="text-[10px] text-slate-400 font-medium mt-1 normal-case">Memo: "{log.notes}"</div>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        {log.status === 'DALAM_PERJALANAN' ? (
                          <span className="text-[9px] font-bold normal-case text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg flex items-center justify-center mx-auto w-max gap-1 animate-pulse border border-amber-200 shadow-xs"><Truck size={12}/> OTR / Di Jalan</span>
                        ) : (
                          <span className="text-[9px] font-bold normal-case text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center justify-center mx-auto w-max gap-1 border border-emerald-200 shadow-xs"><CheckCircle2 size={12}/> Sampai tujuan</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => handlePrintSuratJalan(log)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200 shadow-xs" title="Re-cetak slip manifest">
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
