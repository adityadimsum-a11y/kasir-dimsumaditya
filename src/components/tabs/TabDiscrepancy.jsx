import React, { useState, useMemo } from 'react';
import { AlertTriangle, ClipboardCheck, Trash2, Calendar, Search, Plus, X, ShieldAlert, Package, Layers, Activity } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');
const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

// MASTER BARANG UNTUK DI-AUDIT STOKNYA
const AUDIT_ITEMS = [
  { id: 'DIMSUM_FROZEN', name: 'Dimsum Frozen Core', unit: 'Pcs', estimatedCostPerUnit: 1125 },
  { id: 'AYAM_MENTAH', name: 'Daging Ayam Mentah Fillet', unit: 'Kg', estimatedCostPerUnit: 37500 },
  { id: 'BUMBU_RAHASIA', name: 'Bumbu Racikan Olahan Core', unit: 'Pack', estimatedCostPerUnit: 15000 },
  { id: 'SAUS_DIMSUM', name: 'Saus Cabai Cair Merah', unit: 'Pack', estimatedCostPerUnit: 5000 },
  { id: 'MIKA_PACKAGING', name: 'Plastik Mika Isi 50', unit: 'Pack', estimatedCostPerUnit: 12000 },
];

export default function TabDiscrepancy({ 
  discrepancy_logs = [], discrepancy_logs_data,
  masterBranches = [], master_branches, sendToSheet, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';

  // --- STATE MANAGEMENT ---
  const [tableDateFilter, setTableDateFilter] = useState(todayStr); // Default jurnal cuma tampil HARI INI
  const [searchTerm, setSearchTerm] = useState('');
  const [activeBranch, setActiveBranch] = useState(isHQ ? 'ALL_BRANCHES' : currentBranch);
  const [form, setForm] = useState({
    itemIndex: 0, qty: '', reason: 'BASI', notes: ''
  });

  // --- SINKRONISASI DATABASE ---
  const realLogs = useMemo(() => discrepancy_logs_data || discrepancy_logs || [], [discrepancy_logs, discrepancy_logs_data]);
  const rawBranches = useMemo(() => master_branches || masterBranches || [], [master_branches, masterBranches]);

  const selectedItemInfo = useMemo(() => AUDIT_ITEMS[form.itemIndex] || AUDIT_ITEMS[0], [form.itemIndex]);

  // Filter Cabang Dinamis
  const filteredBranches = useMemo(() => {
    return rawBranches.filter(b => !b.isDeleted && b.branch_id !== 'PUSAT');
  }, [rawBranches]);

  // --- FILTER ENGINE JURNAL AUDIT ---
  const filteredLogsTable = useMemo(() => {
    return realLogs.filter(log => {
      if (log.isDeleted) return false;
      // Filter Cabang
      if (activeBranch !== 'ALL_BRANCHES' && log.branch_id !== activeBranch) return false;
      // Filter Kalender
      if (log.date.substring(0, 10) !== tableDateFilter) return false;
      // Filter Pencarian Text
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!log.item_name.toLowerCase().includes(s) && !log.reason.toLowerCase().includes(s) && !log.id.toLowerCase().includes(s)) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realLogs, activeBranch, tableDateFilter, searchTerm]);

  // --- KPI METRIK KERUGIAN OPERASIONAL (LOSS RADAR) ---
  const lossMetrics = useMemo(() => {
    let totalRupiahHilangBulanIni = 0;
    let kejadianCount = 0;
    const thisMonthStr = todayStr.substring(0, 7); // YYYY-MM

    realLogs.filter(log => !log.isDeleted && log.date.substring(0, 7) === thisMonthStr).forEach(log => {
      if (activeBranch === 'ALL_BRANCHES' || log.branch_id === activeBranch) {
        // Cari estimasi HPP barang untuk menghitung kerugian uang riil
        const matchItem = AUDIT_ITEMS.find(i => i.id === log.item_id);
        const costPerUnit = matchItem ? matchItem.estimatedCostPerUnit : 1000;
        totalRupiahHilangBulanIni += (Number(log.qty_discrepancy || log.qty || 0) * costPerUnit);
        kejadianCount += 1;
      }
    });

    return { totalLoss: totalRupiahHilangBulanIni, count: kejadianCount };
  }, [realLogs, activeBranch, todayStr]);

  // --- ACTIONS: SUBMIT PENYESUAIAN STOK ---
  const handleSaveDiscrepancy = async (e) => {
    e.preventDefault();
    if (迫Num(form.qty) <= 0) {
      // Pembatas aman input
      const cleanQty = Math.abs(Number(form.qty) || 0);
      if (cleanQty <= 0) return alert("Kuantitas barang rusak/selisih harus lebih dari 0!");
    }

    const logId = generateId('STP', todayStr);
    const payload = {
      id: logId,
      date: todayStr,
      branch_id: currentBranch,
      item_id: selectedItemInfo.id,
      item_name: selectedItemInfo.name,
      qty_discrepancy: Number(form.qty), // Angka mutasi rugi
      unit: selectedItemInfo.unit,
      reason: form.reason,
      notes: form.notes ? form.notes.toUpperCase() : 'STOK OPNAME ADJUSTMENT',
      isDeleted: false
    };

    if (await sendToSheet('insert', payload, 'discrepancy_logs')) {
      showToast('Data kerugian stok berhasil diamankan & disimpan!', 'success');
      setForm({ itemIndex: 0, qty: '', reason: 'BASI', notes: '' });
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800">
      
      {/* HEADER BANNER */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
          <ShieldAlert className="text-rose-600"/> Audit Stok Opname &amp; Kerusakan Barang
        </h2>
        <p className="text-xs font-bold text-slate-500 mt-1">Pusat kendali barang susut. Mencatat barang basi, hancur, atau selisih fisik kulkas untuk mengunci kebocoran keuangan.</p>
      </div>

      {/* METRIK DASHBOARD LOSS RADAR (Desain Ringan Smooth) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between">
          <AlertTriangle className="absolute -right-4 -bottom-4 text-rose-500/10 pointer-events-none" size={120} />
          <div>
            <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1.5"><AlertTriangle size={12}/> Nilai Kerugian Finansial (Bulan Ini)</div>
            <div className="text-3xl font-black text-rose-700 tracking-tight mt-1">{formatRupiah(lossMetrics.totalLoss)}</div>
          </div>
          <p className="text-[9px] text-rose-600/70 font-bold mt-4 uppercase tracking-wide">*Konversi kerugian riil berdasarkan HPP pokok produksi.</p>
        </div>

        <div className="bg-slate-900 text-white p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between shadow-md">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><ClipboardCheck size={12}/> Frekuensi Penyusutan Stok</div>
            <div className="text-3xl font-black tracking-tight mt-1">{lossMetrics.count} <span className="text-xs text-slate-400 font-bold">KALI KEJADIAN</span></div>
          </div>
          <p className="text-[9px] text-slate-400 font-bold mt-4 uppercase tracking-wide">*Wajib dievaluasi bila angka kejadian di atas 5 kali.</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600 border border-emerald-100"><Activity size={24}/></div>
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kondisi Jaringan Gudang</div>
              <div className="text-sm font-black text-slate-800 uppercase mt-0.5">SISTEM KUNCI STOK AKTIF</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* FORM INPUT OPNAME BARANG RUSAK */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-max">
          <form onSubmit={handleSaveDiscrepancy} className="space-y-4">
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider pb-3 border-b flex items-center gap-2">
              <Plus size={16} className="text-rose-500"/> Input Barang Rusak / Susut
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Pilih Barang</label>
                <select value={form.itemIndex} onChange={e=>setForm({...form, itemIndex: Number(e.target.value)})} className="w-full p-2.5 border rounded-xl text-xs font-black bg-slate-50 outline-none uppercase cursor-pointer">
                  {AUDIT_ITEMS.map((item, index) => (
                    <option key={item.id} value={index}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Volume Rusak ({selectedItemInfo.unit})</label>
                <input type="number" required placeholder="0" value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 border text-center text-sm font-black text-rose-600 bg-slate-50 rounded-xl outline-none focus:bg-white focus:border-rose-400" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Alasan Penyusutan (Discrepancy Reason)</label>
              <select value={form.reason} onChange={e=>setForm({...form, reason: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-black bg-slate-50 text-rose-700 border-rose-100 outline-none uppercase cursor-pointer">
                <option value="BASI">⚠️ BARANG BASI / KADALUARSA</option>
                <option value="HANCUR">❌ HANCUR / CACAT PRODUKSI</option>
                <option value="HILANG">🔍 SELISIH GAIB / HILANG TIM</option>
                <option value="KEMASAN_RUSAK">📦 KEMASAN PECAH / SOBEK</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Kronologi / Catatan Pemeriksaan</label>
              <input type="text" required placeholder="Cth: Freezer mati semalaman di outlet Pemalang" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-rose-400" />
            </div>

            <button type="submit" className="w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-md bg-rose-600 hover:bg-rose-700 transition-transform active:scale-95 flex items-center justify-center gap-1.5">
              <ClipboardCheck size={14}/> Simpan &amp; Potong Stok Fisik
            </button>
          </form>
        </div>

        {/* TABEL MUTASI HISTORI JURNAL BARANG RUSAK */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h4 className="font-black text-xs uppercase text-slate-700 tracking-widest flex items-center gap-1.5">
                <Layers size={14} className="text-blue-500"/> Jurnal Catatan Penyusutan Stok
              </h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Filter Hari Ini: {formatDate(tableDateFilter)}</p>
            </div>
            
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              {isHQ && (
                <select value={activeBranch} onChange={e => setActiveBranch(e.target.value)} className="bg-white border rounded-xl text-[10px] font-black uppercase text-slate-700 py-2 px-3 outline-none cursor-pointer shadow-sm">
                  <option value="ALL_BRANCHES">🌍 SEMUA NODE</option>
                  <option value="TANGERANG_PUSAT">🏢 TANGERANG PUSAT</option>
                  {filteredBranches.map(b => <option key={b.branch_id} value={b.branch_id}>🏢 {b.branch_name.toUpperCase()}</option>)}
                </select>
              )}
              
              <div className="flex items-center gap-2 bg-white border px-2.5 py-1.5 rounded-xl shadow-sm">
                <Calendar size={12} className="text-slate-400"/>
                <input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value || todayStr)} className="text-xs font-black outline-none bg-transparent cursor-pointer text-slate-700" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] uppercase text-slate-400 bg-white border-b">
                <tr>
                  <th className="px-4 py-3 font-black">ID &amp; Lokasi</th>
                  <th className="px-4 py-3 font-black">Barang</th>
                  <th className="px-4 py-3 font-black text-center">Volume Susut</th>
                  <th className="px-4 py-3 font-black">Alasan / Kronologi</th>
                  <th className="px-4 py-3 font-black text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-50">
                {filteredLogsTable.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-20 text-slate-400 font-bold uppercase">Aman Bersih. Tidak ada klaim barang rusak/basi untuk tanggal {formatDate(tableDateFilter)}</td></tr>
                ) : (
                  filteredLogsTable.map(log => {
                    const matchItem = AUDIT_ITEMS.find(i => i.id === log.item_id);
                    const cost = matchItem ? matchItem.estimatedCostPerUnit : 0;
                    const rugiDuit = Number(log.qty_discrepancy || log.qty || 0) * cost;
                    
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition-colors group">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-slate-800 font-black uppercase text-xs">🏢 {log.branch_id?.replace('_', ' ')}</div>
                          <div className="text-[9px] font-mono text-slate-400 mt-1">{log.id}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="font-black text-slate-800 text-sm uppercase">{log.item_name}</div>
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <div className="bg-rose-50 text-rose-700 px-3 py-1 rounded-xl inline-block border border-rose-100 font-black">
                            -{formatNumber(log.qty_discrepancy || log.qty)} {log.unit}
                          </div>
                          <div className="text-[9px] text-rose-500 font-bold mt-1">Loss: {formatRupiah(rugiDuit)}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-[9px] font-black uppercase text-rose-600 bg-rose-100/50 px-2 py-0.5 rounded border border-rose-200">
                            {log.reason}
                          </span>
                          <div className="text-[10px] text-slate-500 font-medium italic mt-1.5">"{log.notes}"</div>
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap opacity-40 group-hover:opacity-100 transition-opacity">
                          <button type="button" onClick={() => { if(window.confirm("Hapus catatan audit ini?")) sendToSheet('delete', { id: log.id }, 'discrepancy_logs'); }} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md" title="Hapus Klaim">
                            <Trash2 size={15}/>
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
