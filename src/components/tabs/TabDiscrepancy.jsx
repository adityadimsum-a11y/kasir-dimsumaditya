import React, { useState, useMemo } from 'react';
import { AlertTriangle, ClipboardCheck, Trash2, Calendar, Search, Plus, X, ShieldAlert, Package, Layers, Activity } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');
const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

// 🔥 REVISI NILAI DASAR HARGA MATRIKS GUDANG (SINKRON DOKTRIN ADITYA CORE)
const AUDIT_ITEMS = [
  { id: 'DIMSUM_FROZEN', name: 'Dimsum Frozen Core', unit: 'Pcs', estimatedCostPerUnit: 1125 }, // Rp 1.125 / Pcs
  { id: 'AYAM_MENTAH', name: 'Daging Ayam Mentah Fillet', unit: 'Kg', estimatedCostPerUnit: 37500 }, // Rp 37.500 / Kg[cite: 1]
  { id: 'BUMBU_RAHASIA', name: 'Bumbu Racikan Olahan Core', unit: 'Pack', estimatedCostPerUnit: 15000 },
  { id: 'SAUS_DIMSUM', name: 'Saus Cabai Cair Merah', unit: 'Pack', estimatedCostPerUnit: 5000 },
  { id: 'MIKA_PACKAGING', name: 'Plastik Mika Isi 50', unit: 'Pack', estimatedCostPerUnit: 12000 },
];

// --- MESIN PENERJEMAH TANGGAL ANTI-BADAI ---
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

export default function TabDiscrepancy({ 
  discrepancy_logs = [], discrepancy_logs_data,
  masterBranches = [], master_branches, sendToSheet, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';

  const todayYMD = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // --- STATE MANAGEMENT ---
  const [tableDateFilter, setTableDateFilter] = useState(todayYMD); 
  const [searchTerm, setSearchTerm] = useState('');
  const [activeBranch, setActiveBranch] = useState(isHQ ? 'ALL_BRANCHES' : currentBranch);
  const [form, setForm] = useState({
    itemIndex: 0, qty: '', reason: 'BASI', notes: ''
  });

  // --- SINKRONISASI DATABASE ---
  const realLogs = useMemo(() => discrepancy_logs_data || discrepancy_logs || [], [discrepancy_logs, discrepancy_logs_data]);
  const rawBranches = useMemo(() => master_branches || masterBranches || [], [master_branches, masterBranches]);

  const selectedItemInfo = useMemo(() => AUDIT_ITEMS[form.itemIndex] || AUDIT_ITEMS[0], [form.itemIndex]);

  const filteredBranches = useMemo(() => {
    return rawBranches.filter(b => !b.isDeleted && b.branch_id !== 'PUSAT');
  }, [rawBranches]);

  // --- FILTER ENGINE JURNAL AUDIT TANGGAL ---
  const filteredLogsTable = useMemo(() => {
    return realLogs.filter(log => {
      if (log.isDeleted) return false;
      if (activeBranch !== 'ALL_BRANCHES' && log.branch_id !== activeBranch) return false;
      
      const logYMD = parseDateToYMD(log.date);
      if (logYMD !== tableDateFilter) return false;
      
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!log.item_name.toLowerCase().includes(s) && !log.reason.toLowerCase().includes(s) && !log.id.toLowerCase().includes(s)) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realLogs, activeBranch, tableDateFilter, searchTerm]);

  // --- KPI METRIK KERUGIAN OPERASIONAL BULANAN PERIODE ---
  const lossMetrics = useMemo(() => {
    let totalRupiahHilangBulanIni = 0;
    let kejadianCount = 0;
    const currentMonthStr = todayYMD.substring(0, 7); // YYYY-MM

    realLogs.filter(log => !log.isDeleted).forEach(log => {
      const logYMD = parseDateToYMD(log.date);
      if (logYMD && logYMD.substring(0, 7) === currentMonthStr) {
        if (activeBranch === 'ALL_BRANCHES' || log.branch_id === activeBranch) {
          const matchItem = AUDIT_ITEMS.find(i => i.id === log.item_id);
          const costPerUnit = matchItem ? matchItem.estimatedCostPerUnit : 1125; // Fallback Rp 1.125[cite: 1]
          totalRupiahHilangBulanIni += (Number(log.qty_discrepancy || log.qty || 0) * costPerUnit);
          kejadianCount += 1;
        }
      }
    });

    return { totalLoss: totalRupiahHilangBulanIni, count: kejadianCount };
  }, [realLogs, activeBranch, todayYMD]);

  // --- ACTIONS: SUBMIT PENYESUAIAN STOK ---
  const handleSaveDiscrepancy = async (e) => {
    e.preventDefault();
    const inputQty = Math.abs(Number(form.qty) || 0);
    if (inputQty <= 0) return alert("Jumlah kuantitas barang opname harus lebih dari 0!");

    const logId = generateId('STP', todayStr);
    const payload = {
      id: logId,
      date: todayStr,
      branch_id: currentBranch,
      item_id: selectedItemInfo.id,
      item_name: selectedItemInfo.name,
      qty_discrepancy: inputQty, 
      unit: selectedItemInfo.unit,
      reason: form.reason,
      notes: form.notes ? form.notes.toUpperCase() : 'STOK OPNAME ADJUSTMENT',
      isDeleted: false
    };

    if (await sendToSheet('insert', payload, 'discrepancy_logs')) {
      showToast('Data laporan opname kerugian berhasil diamankan ke sistem!', 'success');
      setForm({ itemIndex: 0, qty: '', reason: 'BASI', notes: '' });
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* HEADER BANNER */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-t-4 border-t-rose-500">
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
          <ShieldAlert className="text-rose-600"/> Audit Stok Opname &amp; Kerusakan Barang
        </h2>
        <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">Pusat kendali barang susut harian. Catat produk basi, hancur, atau selisih kulkas tim di lapangan.</p>
      </div>

      {/* METRIK LOSS RADAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-rose-50 border border-rose-200 p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between shadow-sm">
          <AlertTriangle className="absolute -right-4 -bottom-4 text-rose-500/10 pointer-events-none" size={120} />
          <div>
            <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1.5"><AlertTriangle size={12}/> Laporan Kerugian Finansial (Bulan Ini)</div>
            <div className="text-3xl font-black text-rose-700 tracking-tight mt-1">{formatRupiah(lossMetrics.totalLoss)}</div>
          </div>
          <p className="text-[9px] text-rose-500 font-bold mt-4 uppercase tracking-wide">*Dihitung riil berdasarkan konversi HPP dasar core.[cite: 1]</p>
        </div>

        <div className="bg-slate-900 text-white p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between shadow-md">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><ClipboardCheck size={12}/> Total Frekuensi Kasus Barang Susut</div>
            <div className="text-3xl font-black tracking-tight mt-1">{lossMetrics.count} <span className="text-xs text-slate-400 font-black">KALI KEJADIAN</span></div>
          </div>
          <p className="text-[9px] text-slate-400 font-bold mt-4 uppercase tracking-wide">*Segera audit tim gudang jika angka menyentuh di atas 5 kali.</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600 border border-emerald-100 shadow-sm"><Activity size={24}/></div>
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kondisi Validasi Jaringan</div>
              <div className="text-sm font-black text-emerald-700 uppercase mt-0.5">SISTEM INTEGRASI KUNCI AKTIF</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* FORM INPUT ANGGARAN OPNAME */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-max">
          <form onSubmit={handleSaveDiscrepancy} className="space-y-4">
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider pb-3 border-b flex items-center gap-2">
              <Plus size={16} className="text-rose-500"/> Masukan Data Opname Lapangan
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Pilih Jenis Barang</label>
                <select value={form.itemIndex} onChange={e=>setForm({...form, itemIndex: Number(e.target.value)})} className="w-full p-2.5 border rounded-xl text-xs font-black bg-slate-50 outline-none uppercase cursor-pointer focus:border-rose-400">
                  {AUDIT_ITEMS.map((item, index) => (
                    <option key={item.id} value={index}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Volume Rusak ({selectedItemInfo.unit})</label>
                <input type="number" required placeholder="0" min="1" value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 border text-center text-sm font-black text-rose-600 bg-slate-50 rounded-xl outline-none focus:bg-white focus:border-rose-400" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Alasan Utama Penyusutan</label>
              <select value={form.reason} onChange={e=>setForm({...form, reason: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-black bg-slate-50 text-rose-700 border-rose-100 outline-none uppercase cursor-pointer focus:border-rose-400">
                <option value="BASI">⚠️ BARANG BASI / KADALUARSA</option>
                <option value="HANCUR">❌ HANCUR / CACAT PRODUKSI</option>
                <option value="HILANG">🔍 SELISIH GAIB / HILANG TIM</option>
                <option value="KEMASAN_RUSAK">📦 KEMASAN PECAH / SOBEK</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Kronologi / Catatan Saksi Lapangan</label>
              <input type="text" required placeholder="Contoh: Mati lampu semalaman di freezer pusat" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-bold uppercase bg-slate-50 outline-none focus:bg-white focus:border-rose-400" />
            </div>

            <button type="submit" className="w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-md bg-rose-600 hover:bg-rose-700 transition-transform active:scale-95 flex items-center justify-center gap-1.5">
              Simpan &amp; Potong Stok Fisik Gudang
            </button>
          </form>
        </div>

        {/* JURNAL TABEL */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h4 className="font-black text-xs uppercase text-slate-800 tracking-widest flex items-center gap-2">
                <Layers size={16} className="text-blue-500"/> Jurnal Catatan Penyusutan Stok
              </h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Filter Tanggal: {formatDate(tableDateFilter)}</p>
            </div>
            
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              {isHQ && (
                <select value={activeBranch} onChange={e => setActiveBranch(e.target.value)} className="bg-white border rounded-xl text-[10px] font-black uppercase text-slate-700 py-2 px-3 outline-none cursor-pointer shadow-sm">
                  <option value="ALL_BRANCHES">🌍 SEMUA NODE CABANG</option>
                  <option value="TANGERANG_PUSAT">🏢 TANGERANG PUSAT</option>
                  {filteredBranches.map(b => <option key={b.branch_id} value={b.branch_id}>🏢 {b.branch_name.toUpperCase()}</option>)}
                </select>
              )}
              
              <div className="flex items-center gap-2 bg-white border border-slate-300 px-2.5 py-1.5 rounded-xl shadow-sm">
                <Calendar size={14} className="text-blue-500 ml-0.5"/>
                <input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value)} className="text-xs font-black text-slate-800 outline-none bg-transparent cursor-pointer pr-1" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-[10px] uppercase text-slate-400 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 font-black">ID &amp; Lokasi</th>
                  <th className="px-5 py-3 font-black">Isi Nama Barang</th>
                  <th className="px-5 py-3 font-black text-center">Volume Susut</th>
                  <th className="px-5 py-3 font-black">Alasan / Kronologi Kejadian</th>
                  <th className="px-5 py-3 font-black text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-100">
                {filteredLogsTable.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-20 text-slate-400 bg-slate-50">
                      <div className="flex flex-col items-center justify-center">
                        <AlertTriangle size={36} className="mb-2 opacity-20"/>
                        <span className="font-black uppercase tracking-widest text-xs">Aman Bersih. Tidak ada klaim penyusutan stok untuk tanggal ini.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogsTable.map(log => {
                    const matchItem = AUDIT_ITEMS.find(i => i.id === log.item_id);
                    const cost = matchItem ? matchItem.estimatedCostPerUnit : 1125; //[cite: 1]
                    const rugiDuit = Number(log.qty_discrepancy || log.qty || 0) * cost;
                    
                    return (
                      <tr key={log.id} className="hover:bg-blue-50/40 transition-colors group">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-slate-800 font-black uppercase text-xs">🏢 {log.branch_id?.replace('_', ' ')}</div>
                          <div className="text-[9px] font-mono text-slate-400 mt-1">{log.id}</div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="font-black text-slate-800 text-xs uppercase tracking-wide">{log.item_name}</div>
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          <div className="bg-rose-50 text-rose-700 px-3 py-1 rounded-lg inline-block border border-rose-100 font-black">
                            -{formatNumber(log.qty_discrepancy || log.qty)} {log.unit}
                          </div>
                          <div className="text-[10px] text-rose-600 font-black mt-1">Loss: {formatRupiah(rugiDuit)}</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-[9px] font-black uppercase text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                            {log.reason}
                          </span>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-2">" {log.notes} "</div>
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap opacity-40 group-hover:opacity-100 transition-opacity">
                          <button type="button" onClick={() => { if(window.confirm("Yakin ingin menghapus catatan audit penyesuaian ini?")) sendToSheet('delete', { id: log.id }, 'discrepancy_logs'); }} className="p-2 text-slate-400 hover:text-white hover:bg-rose-600 border rounded-lg shadow-sm transition-all" title="Hapus Klaim">
                            <Trash2 size={14}/>
                          </button>
                        </td>
                      </tr>
                    );
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
