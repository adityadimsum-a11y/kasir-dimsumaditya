import React, { useState, useMemo } from 'react';
import { Landmark, Send, CheckCircle2, Clock, FileText, ArrowRightLeft, Building2, Wallet, Search } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabTreasuryConsolidation({ 
  interbranch_treasury = [], interbranch_treasury_data,
  masterBranches = [], master_branches,
  sendToSheet, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';

  // --- STATE MANAGEMENT ---
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    amount: '', originAccount: 'LACI KASIR (TUNAI)', destAccount: 'BCA PUSAT (OWNER)', notes: ''
  });

  // --- SINKRONISASI DATABASE ---
  const realTreasury = useMemo(() => interbranch_treasury_data || interbranch_treasury || [], [interbranch_treasury, interbranch_treasury_data]);
  
  // Filter Data (Pusat lihat semua, Cabang hanya lihat setorannya sendiri)
  const filteredTreasury = useMemo(() => {
    let data = realTreasury.filter(t => !t.isDeleted);
    if (!isHQ) {
      data = data.filter(t => t.branch_id === currentBranch);
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      data = data.filter(t => t.id.toLowerCase().includes(s) || t.branch_id.toLowerCase().includes(s) || (t.notes && t.notes.toLowerCase().includes(s)));
    }
    return data.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realTreasury, isHQ, currentBranch, searchTerm]);

  // --- METRIK DASHBOARD ---
  const kpi = useMemo(() => {
    let pending = 0;
    let verifiedThisMonth = 0;
    let pendingCount = 0;
    const thisMonth = new Date().getMonth();

    filteredTreasury.forEach(t => {
      const isThisMonth = new Date(t.date).getMonth() === thisMonth;
      if (t.status === 'PENDING') {
        pending += Number(t.amount);
        pendingCount += 1;
      } else if (t.status === 'VERIFIED' && isThisMonth) {
        verifiedThisMonth += Number(t.amount);
      }
    });
    return { pending, pendingCount, verifiedThisMonth };
  }, [filteredTreasury]);

  // --- ACTIONS: CABANG SUBMIT SETORAN ---
  const handleSubmitSetoran = async (e) => {
    e.preventDefault();
    if (Number(form.amount) <= 0) return alert("Nominal setoran harus lebih dari 0!");
    if (isHQ && !window.confirm("Anda login sebagai Pusat. Yakin ingin membuat simulasi setoran dari Pusat ke Pusat?")) return;

    const trxId = generateId('TRX', todayStr);
    const payload = {
      id: trxId, date: todayStr, branch_id: currentBranch, amount: Number(form.amount),
      origin_account: form.originAccount, dest_account: form.destAccount,
      status: 'PENDING', notes: form.notes.toUpperCase(), verified_date: ''
    };

    if (await sendToSheet('insert', payload, 'interbranch_treasury')) {
      showToast('Berhasil! Setoran sedang menunggu verifikasi Pusat.', 'success');
      setForm({ amount: '', originAccount: 'LACI KASIR (TUNAI)', destAccount: 'BCA PUSAT (OWNER)', notes: '' });
      if(window.confirm("Cetak struk bukti pengiriman dana?")) handlePrintSetoran(payload);
    }
  };

  // --- ACTIONS: PUSAT VERIFIKASI SETORAN (TRIPLE ACTION ERP) ---
  const handleVerifikasiPusat = async (item) => {
    if (!window.confirm(`Verifikasi Setoran: Apakah dana sebesar ${formatRupiah(item.amount)} dari ${item.branch_id.replace('_', ' ')} sudah benar-benar masuk ke rekening/laci Pusat?`)) return;

    // 1. Update status setoran menjadi VERIFIED
    const updatePayload = { ...item, status: 'VERIFIED', verified_date: new Date().toISOString() };
    const successUpdate = await sendToSheet('update', updatePayload, 'interbranch_treasury');

    if (successUpdate) {
      // 2. [Otomatisasi ERP] Buat catatan Uang Masuk (IN) di Pusat
      const cashInPayload = {
        id: generateId('CSH', todayStr), date: todayStr, branch_id: 'TANGERANG_PUSAT', type: 'IN',
        category: 'SETORAN CABANG', description: `TERIMA DARI: ${item.branch_id}`, amount: Number(item.amount), method: 'TF' // Asumsi masuk rekening
      };
      await sendToSheet('insert', cashInPayload, 'cashflow_transactions');

      // 3. [Otomatisasi ERP] Buat catatan Uang Keluar (OUT) di Cabang agar kas mereka balance
      const cashOutPayload = {
        id: generateId('CSH', todayStr) + 'X', date: todayStr, branch_id: item.branch_id, type: 'OUT',
        category: 'SETOR SETORAN KE PUSAT', description: `Sahkan oleh Pusat (ID: ${item.id})`, amount: Number(item.amount), method: 'CASH'
      };
      await sendToSheet('insert', cashOutPayload, 'cashflow_transactions');

      showToast('Setoran berhasil disahkan! Mutasi kas otomatis diperbarui di kedua cabang.', 'success');
    }
  };

  const handlePrintSetoran = (log) => {
    triggerPrint('NOTA_DOTMATRIX', {
      title: 'BUKTI TRANSFER INTERNAL (INTER-BRANCH)', id: log.id, date: formatDate(log.date), 
      branch_name: log.branch_id, admin_name: user?.name || 'ADMIN CABANG', customer_name: 'HQ TANGERANG PUSAT',
      items: [{ name: `DARI: ${log.origin_account}\nKE: ${log.dest_account}\nKET: ${log.notes}`, qty: 1, subtotal: log.amount }], 
      amount: log.amount, paymentMethod: log.status
    });
  };

  return (
    <div className="space-y-6 pb-10">
      
      {/* HEADER PAGE */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-white">
        <div>
          <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
            <Landmark className="text-blue-400"/> Konsolidasi Setoran Cabang
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
            Sistem Verifikasi Dana Masuk (Inter-Branch Treasury)
          </p>
        </div>
        <div className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
          <Building2 size={14} className="text-emerald-400"/> Akses: {isHQ ? 'HQ KENDALI PUSAT' : `CABANG ${currentBranch.replace('_', ' ')}`}
        </div>
      </div>

      {/* 3 KARTU KPI METRIK */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-amber-50/80 p-6 rounded-3xl border border-amber-200 shadow-sm relative overflow-hidden">
          <Clock className="absolute -right-4 -bottom-4 text-amber-500/10" size={120} />
          <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2 mb-2"><Clock size={14}/> Menunggu Verifikasi Pusat</div>
          <div className="text-3xl font-black text-amber-700 tracking-tight">{formatRupiah(kpi.pending)}</div>
          <div className="mt-3 text-[10px] font-bold text-amber-700/60 uppercase">Terdapat {kpi.pendingCount} antrean setoran gantung.</div>
        </div>

        <div className="bg-emerald-50/80 p-6 rounded-3xl border border-emerald-200 shadow-sm relative overflow-hidden">
          <CheckCircle2 className="absolute -right-4 -bottom-4 text-emerald-500/10" size={120} />
          <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2 mb-2"><CheckCircle2 size={14}/> Total Disahkan (Bulan Ini)</div>
          <div className="text-3xl font-black text-emerald-700 tracking-tight">{formatRupiah(kpi.verifiedThisMonth)}</div>
          <div className="mt-3 text-[10px] font-bold text-emerald-700/60 uppercase">Dana sudah masuk ke rekening/laci HQ.</div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-4">
            <div className="bg-blue-50 p-3 rounded-2xl text-blue-600"><ArrowRightLeft size={24}/></div>
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Jaringan</div>
              <div className="text-sm font-black text-slate-800 uppercase mt-1">SINKRONISASI AKTIF</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* KIRI: FORM INPUT SETORAN (KHUSUS CABANG / BISA JUGA DITES PUSAT) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-max">
          <form onSubmit={handleSubmitSetoran} className="space-y-5">
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
              <Send size={16} className="text-blue-500"/> Form Pengajuan Setoran
            </h3>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Jumlah Disetor</label>
              <input type="number" required value={form.amount} onChange={e=>setForm({...form, amount: e.target.value})} className="w-full p-4 border border-slate-200 rounded-xl text-xl font-black text-slate-800 bg-slate-50 outline-none focus:bg-white focus:border-blue-500 transition-colors" placeholder="Rp 0" />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Sumber Dana (Cabang)</label>
                <select value={form.originAccount} onChange={e=>setForm({...form, originAccount: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-black bg-slate-50 outline-none uppercase cursor-pointer">
                  <option value="LACI KASIR (TUNAI)">Laci Kasir (Tunai)</option>
                  <option value="REKENING CABANG">Rekening Operasional Cabang</option>
                </select>
              </div>
              <div className="flex justify-center -my-3 relative z-10">
                <div className="bg-white border border-slate-200 p-1.5 rounded-full text-slate-400 shadow-sm"><ArrowRightLeft size={14} className="rotate-90"/></div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Tujuan Transfer (Pusat)</label>
                <select value={form.destAccount} onChange={e=>setForm({...form, destAccount: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-black bg-slate-50 outline-none uppercase cursor-pointer">
                  <option value="BCA PUSAT (OWNER)">BCA Pusat (Owner)</option>
                  <option value="MANDIRI PUSAT">Mandiri Pusat</option>
                  <option value="BRANKAS TUNAI PUSAT">Disetor Tunai ke Brankas Pusat</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Keterangan / Pesan</label>
              <input type="text" required value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold uppercase bg-slate-50 outline-none focus:bg-white focus:border-blue-500" placeholder="Contoh: Setoran omzet akhir pekan" />
            </div>

            <button type="submit" className="w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-md bg-blue-600 hover:bg-blue-700 transition-transform active:scale-95 flex items-center justify-center gap-2">
              <Send size={14}/> Kirim Pengajuan Setoran
            </button>
          </form>
        </div>

        {/* KANAN: JURNAL STATUS SETORAN INTER-BRANCH */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h4 className="font-black text-xs uppercase text-slate-700 tracking-widest flex items-center gap-1.5">
              <FileText size={14} className="text-blue-500"/> Riwayat &amp; Status Setoran
            </h4>
            
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input type="text" placeholder="Cari ID, Cabang..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none bg-white focus:border-blue-400 shadow-sm" />
            </div>
          </div>

          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] uppercase text-slate-400 bg-white border-b">
                <tr>
                  <th className="px-4 py-3 font-black">Tanggal &amp; ID</th>
                  <th className="px-4 py-3 font-black">Asal Cabang</th>
                  <th className="px-4 py-3 font-black">Detail Transfer</th>
                  <th className="px-4 py-3 font-black text-right">Nominal</th>
                  <th className="px-4 py-3 font-black text-center">Status / Aksi</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-50">
                {filteredTreasury.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest">Belum ada riwayat setoran cabang.</td></tr>
                ) : (
                  filteredTreasury.map(log => (
                    <tr key={log.id} className={`hover:bg-slate-50/70 transition-colors ${log.status === 'PENDING' ? 'bg-amber-50/20' : ''}`}>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-bold">{formatDate(log.date)}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">{log.id}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="font-black text-slate-800 uppercase flex items-center gap-1.5"><Building2 size={12} className="text-slate-400"/> {log.branch_id.replace('_', ' ')}</div>
                      </td>
                      <td className="px-4 py-4 min-w-[200px]">
                        <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-black uppercase mb-1">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded">{log.origin_account}</span>
                          <ArrowRightLeft size={10}/>
                          <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{log.dest_account}</span>
                        </div>
                        <div className="text-[10px] text-slate-600 line-clamp-1">"{log.notes}"</div>
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <div className="font-black text-slate-800 text-sm">{formatRupiah(log.amount)}</div>
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        {log.status === 'PENDING' ? (
                          isHQ ? (
                            <button onClick={() => handleVerifikasiPusat(log)} className="bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1 w-full mx-auto">
                              <CheckCircle2 size={12}/> Terima &amp; Sahkan
                            </button>
                          ) : (
                            <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-1 rounded-md flex items-center justify-center w-max mx-auto border border-amber-200 gap-1 animate-pulse"><Clock size={10}/> Menunggu Pusat</span>
                          )
                        ) : (
                          <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md flex items-center justify-center w-max mx-auto border border-emerald-200 gap-1"><CheckCircle2 size={10}/> Disahkan</span>
                        )}
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
