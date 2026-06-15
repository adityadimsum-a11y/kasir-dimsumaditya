import React, { useState, useMemo } from 'react';
import { Factory, PlusCircle, Trash2, Calendar, ClipboardList, Info, CheckCircle2 } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabPemalang({ pemalang = [], sendToSheet, showToast, user }) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'TANGERANG_PUSAT';

  // --- STATE FORM PRODUKSI ---
  const [date, setDate] = useState(todayStr);
  const [adukan, setAdukan] = useState('');
  const [ayamTerpakai, setAyamTerpakai] = useState('');
  const [yieldPcs, setYieldPcs] = useState('');
  const [notes, setNotes] = useState('');

  // --- FILTER TIMELINE HISTORI ---
  const [filterDateFrom, setFilterPeriodeFrom] = useState(todayStr);
  const [filterDateTo, setFilterPeriodeTo] = useState(todayStr);

  // --- LOGIKA FILTER DATA PRODUKSI ---
  const filteredProductionLogs = useMemo(() => {
    return (pemalang || []).filter(p => {
      if (p.isDeleted) return false;
      return p.date >= filterDateFrom && p.date <= filterDateTo;
    }).sort((a, b) => b.id.localeCompare(a.id));
  }, [pemalang, filterDateFrom, filterDateTo]);

  // --- VALIDASI & SUBMIT INPUT FORM ---
  const handleSubmitProduction = async (e) => {
    e.preventDefault();
    if (!adukan || !ayamTerpakai || !yieldPcs) {
      return alert("Semua kolom matriks produksi wajib diisi, Bos!");
    }

    const batchId = generateId('PRD', date);
    
    // Algoritma Penyelundup Data Khusus ke database Sheet 'orders' / 'pemalang'
    // Memformat string token agar terbaca oleh radar mading pusat
    const tokenName = `@@PRODUCTION@@||${adukan}||${ayamTerpakai}||${yieldPcs}||${notes || '-'}`;

    const confirmMsg = `=== KONFIRMASI PRODUKSI ADITYA ===\n\n` +
      `ID Batch : ${batchId}\n` +
      `Tanggal  : ${formatDate(date)}\n` +
      `Adukan   : ${adukan} Kali\n` +
      `Ayam     : ${ayamTerpakai} Kg\n` +
      `Yield    : ${formatNumber(yieldPcs)} Pcs\n\n` +
      `Sahkan data untuk update stok freezer pusat?`;

    if (!window.confirm(confirmMsg)) return;

    const payload = {
      id: batchId,
      date: date,
      branch_id: currentBranch,
      customer_name: 'PABRIK_PEMALANG',
      sales_channel: 'PRODUCTION_YIELD',
      items: JSON.stringify([{ name: tokenName, qty: Number(yieldPcs), subtotal: 0 }]),
      qty: Number(yieldPcs),
      total_amount: 0,
      amount_paid: 0,
      payment_method: 'SISTEM_PRODUKSI',
      status: 'LUNAS',
      notes: notes || '-',
      isDeleted: false
    };

    // Dikirim ke sheet pemalang / orders (disesuaikan dengan arsitektur ERP holding)
    const isSuccess = await sendToSheet('insert', payload, 'pemalang');
    if (isSuccess) {
      if (typeof showToast === 'function') showToast(`Batch Produksi ${batchId} Berhasil Disahkan!`, 'success');
      setAdukan('');
      setAyamTerpakai('');
      setYieldPcs('');
      setNotes('');
    }
  };

  const handleVoidProduction = async (id) => {
    if (!window.confirm(`🔥 PERINGATAN OWNER: Void/Hapus permanen laporan produksi ${id}? Tindakan ini akan membatalkan akumulasi yield di freezer.`)) return;
    const isSuccess = await sendToSheet('update', { id, isDeleted: true }, 'pemalang');
    if (isSuccess && typeof showToast === 'function') showToast(`Batch ${id} berhasil di-void!`, 'success');
  };

  return (
    <div className="flex flex-col gap-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-200">
      
      {/* HEADER MENU */}
      <div className="card-holo p-4 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-2xs gap-4">
        <div className="flex items-center gap-2">
          <Factory className="text-amber-600" size={20}/>
          <div>
            <h2 className="text-sm font-black text-slate-800 normal-case">Laporan Hasil Produksi Dapur Pabrik</h2>
            <p className="text-[9px] font-bold text-slate-400 normal-case mt-0.5">Pencatatan harian jumlah adukan adonan, tonase pemakaian ayam harian, dan yield freezer.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* FORM INPUT BARU */}
        <div className="w-full lg:w-[360px] shrink-0">
          <div className="card-holo p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs border-t-4 border-t-amber-500">
            <h3 className="font-black text-slate-800 text-xs flex items-center gap-1.5 mb-4 normal-case"><PlusCircle size={14} className="text-amber-600"/> Input Batch Produksi</h3>
            
            <form onSubmit={handleSubmitProduction} className="space-y-4 text-xs font-bold">
              <div>
                <label className="text-[9px] font-black text-slate-400 block mb-1 uppercase tracking-wider">Tanggal Giling/Masak</label>
                <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none cursor-pointer" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-400 block mb-1 uppercase tracking-wider">Jumlah Adukan (Kali)</label>
                  <input type="number" required value={adukan} onChange={e=>setAdukan(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black outline-none placeholder:text-slate-300" placeholder="Contoh: 5" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 block mb-1 uppercase tracking-wider">Daging Ayam (Kg)</label>
                  <input type="number" step="any" required value={ayamTerpakai} onChange={e=>setAyamTerpakai(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black outline-none placeholder:text-slate-300" placeholder="Contoh: 12.5" />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 block mb-1 uppercase tracking-wider">Yield Bersih (Pcs Masuk Freezer)</label>
                <input type="number" required value={yieldPcs} onChange={e=>setYieldPcs(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black outline-none text-amber-700 placeholder:text-slate-300" placeholder="Contoh: 2500" />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 block mb-1 uppercase tracking-wider">Catatan Tambahan Kepala Dapur</label>
                <input type="text" value={notes} onChange={e=>setNotes(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none text-xs" placeholder="Misal: Es batu kurang, tekstur lembek..." />
              </div>

              <button type="submit" className="w-full text-white font-black py-3 bg-amber-600 hover:bg-amber-700 rounded-xl text-xs shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer">
                <CheckCircle2 size={14}/> Sahkan Laporan Produksi
              </button>
            </form>
          </div>
        </div>

        {/* HISTORI DATA LOG TABLE */}
        <div className="flex-1">
          <div className="card-holo bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
              <div className="flex items-center gap-2">
                <ClipboardList size={16} className="text-amber-600"/>
                <h3 className="font-black text-slate-800 text-xs normal-case">Jurnal Log Rekap Hasil Giling</h3>
              </div>
              
              <div className="flex items-center gap-2 bg-white border p-1.5 rounded-xl shadow-3xs w-full sm:w-auto">
                <Calendar size={12} className="text-slate-400 ml-1"/>
                <input type="date" value={filterDateFrom} onChange={e=>setFilterPeriodeFrom(e.target.value)} className="text-[10px] font-bold border-none outline-none cursor-pointer bg-transparent" />
                <span className="text-slate-400 font-bold text-xs">-</span>
                <input type="date" value={filterDateTo} onChange={e=>setFilterPeriodeTo(e.target.value)} className="text-[10px] font-bold border-none outline-none cursor-pointer bg-transparent" />
              </div>
            </div>

            <div className="overflow-x-auto p-1 custom-scrollbar">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50/50 text-[10px] normal-case text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-black">ID Batch &amp; Waktu</th>
                    <th className="px-4 py-3 font-black text-center">Matriks Adukan</th>
                    <th className="px-4 py-3 font-black text-center">Daging Ayam (Kg)</th>
                    <th className="px-4 py-3 font-black text-right">Yield Masuk Freezer</th>
                    <th className="px-4 py-3 font-black">Memo / Keterangan</th>
                    <th className="px-4 py-3 font-black text-center">Aksi Void</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-bold divide-y divide-slate-100 bg-white text-slate-600">
                  {filteredProductionLogs.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-12 text-slate-400 font-medium text-xs normal-case">Tidak ada rekap batch produksi pada rentang tanggal ini.</td></tr>
                  ) : (
                    filteredProductionLogs.map(log => {
                      let displayAdukan = '-';
                      let displayAyam = '-';
                      let displayYield = log.qty || 0;

                      if (log.items) {
                        const parsed = safeJsonParse(log.items, []);
                        if (parsed.length > 0 && String(parsed[0].name).startsWith('@@PRODUCTION@@')) {
                          const parts = parsed[0].name.split('||');
                          displayAdukan = parts[1] || '-';
                          displayAyam = parts[2] || '-';
                          displayYield = parts[3] || log.qty;
                        }
                      }

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-800 font-black">{log.id}<div className="text-[9px] text-slate-400 font-bold mt-0.5">{formatDate(log.date)}</div></td>
                          <td className="px-4 py-3 text-center whitespace-nowrap text-slate-800 text-sm font-black">{displayAdukan} <span className="text-[10px] text-slate-400 font-normal">Kali</span></td>
                          <td className="px-4 py-3 text-center whitespace-nowrap text-slate-800 text-sm font-black">{displayAyam} <span className="text-[10px] text-slate-400 font-normal">Kg</span></td>
                          <td className="px-4 py-3 text-right whitespace-nowrap text-amber-700 text-sm font-black">{formatNumber(displayYield)} <span className="text-[10px] text-slate-400 font-normal">Pcs</span></td>
                          <td className="px-4 py-3 font-medium normal-case max-w-xs truncate text-slate-500" title={log.notes}>{log.notes || '-'}</td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <button type="button" onClick={() => handleVoidProduction(log.id)} className="p-1.5 text-slate-400 hover:text-rose-600 border border-slate-200 rounded-lg shadow-3xs bg-white cursor-pointer hover:bg-rose-50" title="Void Laporan"><Trash2 size={13}/></button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 normal-case shrink-0">
              <Info size={12} className="text-slate-400"/>
              <span>Seluruh data yield produksi matang otomatis dikonversi sistem ke penambahan stok inventory pusat holding.</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
