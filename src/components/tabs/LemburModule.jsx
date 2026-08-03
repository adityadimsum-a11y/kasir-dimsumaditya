import React, { useState, useMemo, useEffect } from 'react';
import { Users, Clock, Trophy, Coffee, DollarSign, ArrowDownToLine, Printer, Trash2 } from 'lucide-react';

// --- HELPER LOKAL ANTI-CRASH ---
const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');
const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};
const generateId = (prefix, dateStr) => {
  const dStr = dateStr ? dateStr.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '');
  const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${dStr}-${randomPart}`;
};

export default function LemburModule({ 
  employees, expenses, globalCompiled, activeBranch, todayStr, 
  sendToSheet, onViewDetails, user, setOptimisticDeletedIds, 
  isHQ, showToast, optimisticDeletedIds, totalPorsiHariIni, totalPcsHariIni,
  setPrintData // 🔥 MENGGUNAKAN MESIN PRINT TERPUSAT APP.JSX
}) {
  
  // 🔥 STATE BARU: Menambahkan Nominal Fleksibel untuk Lembur & Jamuan
  const [form, setForm] = useState({ 
    date: todayStr, 
    picId: '', 
    participants: [], 
    isLembur: false, 
    lemburNominal: '30000', // Default bisa diedit
    isBonus: false, 
    isJamuan: false,
    jamuanNominal: '100000' // Default bisa diedit
  });

  // STATE UNTUK RAW INPUT ANTI-KURSOR LOMPAT
  const [displayLembur, setDisplayLembur] = useState('30.000');
  const [displayJamuan, setDisplayJamuan] = useState('100.000');
  
  const handleLemburInput = (e) => {
      const val = e.target.value.replace(/\D/g, '');
      setForm(prev => ({...prev, lemburNominal: val}));
      setDisplayLembur(val ? Number(val).toLocaleString('id-ID') : '');
  };

  const handleJamuanInput = (e) => {
      const val = e.target.value.replace(/\D/g, '');
      setForm(prev => ({...prev, jamuanNominal: val}));
      setDisplayJamuan(val ? Number(val).toLocaleString('id-ID') : '');
  };

  useEffect(() => {
    if (!form.picId && employees.length > 0) {
      const leader = employees.find(e => e.position === 'LEADER_TIM' || e.position === 'KEPALA_DAPUR');
      if (leader) setForm(p => ({ ...p, picId: leader.id }));
    }
  }, [employees, form.picId]);

  const toggleParticipant = (empId) => {
    setForm(prev => {
      const current = prev.participants;
      if (current.includes(empId)) return { ...prev, participants: current.filter(id => id !== empId) };
      return { ...prev, participants: [...current, empId] };
    });
  };

  const historyLembur = useMemo(() => { 
    const targetBId = String(activeBranch || '').trim().toUpperCase(); 
    return (expenses || []).filter(e => e && !e.isDeleted && !optimisticDeletedIds.has(e.id) && e.category === 'LEMBUR_BONUS' && (targetBId === 'SEMUA_CABANG' || String(e.branch_id || '').trim().toUpperCase() === targetBId)).sort((a, b) => new Date(b.date) - new Date(a.date)); 
  }, [expenses, activeBranch, optimisticDeletedIds]);

  const handleDelete = async (id) => {
    if(window.confirm("Yakin ingin membatalkan/void data pencairan lembur & bonus tim ini? Uang kas akan kembali utuh.")) {
      setOptimisticDeletedIds(prev => new Set(prev).add(id)); 
      const success = await sendToSheet('delete', { id }, 'expenses');
      if(success) { 
        if(showToast) showToast('Data klaim lembur berhasil dibatalkan.', 'success'); 
      } else { 
        setOptimisticDeletedIds(prev => { const n = new Set(prev); n.delete(id); return n; }); 
      }
    }
  };

  const isTargetTembus = totalPorsiHariIni >= 2500;
  const qtyPeserta = form.participants.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
      
      {/* KANTONG KIRI: FORM KLAIM */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 border-t-4 border-t-blue-600 h-max shadow-sm">
        
        {isTargetTembus ? (
          <div className="bg-gradient-to-r from-emerald-50 to-emerald-100/50 border border-emerald-200 text-emerald-800 p-5 rounded-2xl mb-6 flex items-start gap-4 shadow-sm animate-in fade-in duration-500">
             <div className="text-4xl mt-1 drop-shadow-md">🎉</div>
             <div>
               <div className="font-black uppercase tracking-wider text-sm text-emerald-700">Bonus Target Tembus!</div>
               <div className="text-[11px] font-bold mt-1 text-emerald-700/80 leading-relaxed normal-case">Adukan dapur berhasil mencapai <b>{formatNumber(totalPorsiHariIni)} Porsi</b> (Atau {formatNumber(totalPcsHariIni)} Pcs). Silakan klaim bonus Omset Rp 20.000 per Kepala!</div>
             </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 text-slate-600 p-5 rounded-2xl mb-6 flex items-start gap-4 shadow-sm animate-in fade-in duration-500">
             <div className="text-4xl mt-1 opacity-50 grayscale">⏳</div>
             <div>
               <div className="font-black uppercase tracking-wider text-sm text-slate-700">Target Belum Tercapai</div>
               <div className="text-[11px] font-bold mt-1 text-slate-500 leading-relaxed normal-case">Adukan dapur hari ini baru tercetak <b>{formatNumber(totalPorsiHariIni)} Porsi</b> ({formatNumber(totalPcsHariIni)} Pcs). Butuh &gt;2500 Porsi untuk membuka kunci bonus omset.</div>
             </div>
          </div>
        )}

        <form onSubmit={async (e) => {
          e.preventDefault(); if (!form.picId) return;
          if ((form.isLembur || form.isBonus) && qtyPeserta === 0) return alert("Wajib memilih minimal 1 orang peserta lembur/bonus dari daftar di bawah!");

          const expenseId = generateId('LMB', form.date);
          const empData = globalCompiled[form.picId];
          const penempatanTrx = activeBranch === 'SEMUA_CABANG' ? empData?.branch_id : activeBranch;
          
          // 🔥 KALKULASI DENGAN NOMINAL FLEKSIBEL
          let subLembur = form.isLembur ? Number(form.lemburNominal) * qtyPeserta : 0;
          let subBonus = form.isBonus ? 20000 * qtyPeserta : 0;
          let subJamuan = form.isJamuan ? Number(form.jamuanNominal) : 0;
          let totalCair = subLembur + subBonus + subJamuan;

          if (totalCair === 0) return alert("Pilih minimal satu kotak komponen klaim di bawah, atau pastikan nominal terisi!");

          const confirmMsg = `Konfirmasi Pencairan Dana Kesejahteraan:\n\n` +
            `Total Cair: ${formatRupiah(totalCair)}\n` +
            `PIC Penerima: ${empData?.name}\n\n` +
            `Uang fisik laci perusahaan akan otomatis dipotong. Lanjutkan?`;
            
          if (!window.confirm(confirmMsg)) return;

          const participantNames = form.participants.map(id => globalCompiled[id]?.name).join(', ');
          let descText = [];
          if(form.isLembur) descText.push(`Uang Lembur ${qtyPeserta} Org (Rp ${formatNumber(form.lemburNominal)}/org)`);
          if(form.isBonus) descText.push(`Bonus Target ${qtyPeserta} Org`);
          if(form.isJamuan) descText.push(`Dana Jamuan Tim (Rp ${formatNumber(form.jamuanNominal)})`);
          
          const deskripsiFinal = `${descText.join(' + ')}. Peserta Absen: ${participantNames || 'Tim Global'}`;

          const payload = { id: expenseId, date: form.date, branch_id: penempatanTrx, employee_id: form.picId, category: 'LEMBUR_BONUS', amount: totalCair, description: deskripsiFinal, isDeleted: false };
          
          const success = await sendToSheet('insert', payload, 'expenses');
          if (success) {
            await sendToSheet('insert', { id: generateId('CFO', todayStr), date: form.date, branch_id: penempatanTrx, type: 'OUT', category: 'UANG LEMBUR & BONUS', amount: totalCair, method: 'CASH', reference_id: expenseId, description: `Pencairan Lembur/Bonus Tim Dapur & Outlet (PIC Pencairan: ${empData?.name})`, isDeleted: false }, 'cashflow_transactions');
            
            setForm({ date: todayStr, picId: '', participants: [], isLembur: false, lemburNominal: '30000', isBonus: false, isJamuan: false, jamuanNominal: '100000' });
            setDisplayLembur('30.000'); setDisplayJamuan('100.000');
            if (showToast) showToast('Dana lembur/bonus sukses dicairkan! Uang fisik laci kasir otomatis terpotong.', 'success');
          }
        }} className="space-y-5">
          
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Tgl Eksekusi Cair</label>
            <input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold outline-none bg-slate-50 focus:bg-white focus:border-blue-400 transition-colors shadow-sm cursor-pointer" />
          </div>
          
          <div>
            <label className="text-[10px] font-black text-blue-600 uppercase tracking-wider block mb-1.5">1. Penanggung Jawab (PIC Penerima Uang Tunai)</label>
            <select required value={form.picId} onChange={e=>setForm({...form, picId: e.target.value})} className="w-full p-3 border border-blue-200 bg-blue-50/50 rounded-xl font-bold text-xs uppercase tracking-wider outline-none cursor-pointer focus:bg-white focus:border-blue-500 transition-colors shadow-sm">
              <option value="">-- Pilih Leader Tim / Penanggung Jawab --</option>
              {employees.map(k => <option key={k.id} value={k.id}>{k.name} ({k.position.replace(/_/g, ' ')}) - CAB {k.branch_id}</option>)}
            </select>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-inner">
            <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2"><Users size={16} className="text-blue-500"/> 2. Daftar Peserta Anggota Tim ({qtyPeserta} Orang Hadir)</label>
            <div className="flex flex-wrap gap-2">
              {employees.map(emp => (
                <label key={emp.id} className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all ${form.participants.includes(emp.id) ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-105' : 'bg-white border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 shadow-sm'}`}>
                  <input type="checkbox" className="hidden" checked={form.participants.includes(emp.id)} onChange={() => toggleParticipant(emp.id)} />
                  {emp.name}
                </label>
              ))}
            </div>
            {qtyPeserta === 0 && <div className="text-[10px] text-rose-500 font-bold normal-case mt-4 italic">*Wajib tap / klik nama anggota tim di atas untuk mendaftarkan absen peserta lembur.</div>}
          </div>

          <div className="space-y-3 mt-4">
            
            {/* 🔥 FLEKSIBEL: UANG LEMBUR */}
            <div className={`flex justify-between items-center p-4 border rounded-2xl shadow-sm transition-colors ${form.isLembur ? 'border-blue-400 bg-blue-50/50' : 'bg-white border-slate-200'}`}>
              <label className="flex items-center gap-3 cursor-pointer flex-1">
                <input type="checkbox" checked={form.isLembur} onChange={e=>setForm({...form, isLembur: e.target.checked})} className="w-5 h-5 accent-blue-600 cursor-pointer shrink-0"/>
                <div>
                  <div className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2"><Clock size={16} className="text-blue-600"/> Jam Lembur Lewat 17:00 WIB</div>
                  <div className="text-[10px] font-bold text-slate-500 mt-1 normal-case">Uang lembur tambahan per kepala</div>
                </div>
              </label>
              <div className={`flex items-center gap-1.5 bg-white px-3 py-2 rounded-xl border shadow-inner ml-2 transition-colors ${form.isLembur ? 'border-blue-300' : 'border-slate-100 opacity-50'}`}>
                <span className={`text-[10px] font-black ${form.isLembur ? 'text-blue-600' : 'text-slate-400'}`}>Rp</span>
                <input 
                  type="text" 
                  value={displayLembur} 
                  onChange={handleLemburInput}
                  disabled={!form.isLembur}
                  className={`w-20 text-right outline-none text-base font-black disabled:bg-transparent ${form.isLembur ? 'text-blue-700' : 'text-slate-400'}`}
                  placeholder="0"
                />
              </div>
            </div>

            {/* 🔒 FIXED: BONUS OMSET */}
            <label className={`flex justify-between items-center p-4 border rounded-2xl shadow-sm cursor-pointer transition-colors hover:bg-slate-50 ${form.isBonus ? 'border-emerald-400 bg-emerald-50/50' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-3 flex-1">
                <input type="checkbox" disabled={!isTargetTembus} checked={form.isBonus} onChange={e=>setForm({...form, isBonus: e.target.checked})} className="w-5 h-5 accent-emerald-600 cursor-pointer disabled:opacity-50 shrink-0"/>
                <div>
                  <div className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2"><Trophy size={16} className={isTargetTembus ? "text-emerald-600" : "text-slate-400"}/> Bonus Omset Target Harian</div>
                  <div className="text-[10px] font-bold text-slate-500 mt-1 normal-case">Bonus apresiasi tembus target per kepala</div>
                </div>
              </div>
              <div className={`font-black text-sm bg-white px-4 py-2 rounded-xl border shadow-sm ml-2 shrink-0 ${isTargetTembus ? 'text-emerald-600 border-emerald-200' : 'text-slate-400 border-slate-100 opacity-50'}`}>
                Rp 20.000
              </div>
            </label>

            {/* 🔥 FLEKSIBEL: UANG JAMUAN MAKAN */}
            <div className={`flex justify-between items-center p-4 border rounded-2xl shadow-sm transition-colors ${form.isJamuan ? 'border-orange-400 bg-orange-50/50' : 'bg-white border-slate-200'}`}>
              <label className="flex items-center gap-3 cursor-pointer flex-1">
                <input type="checkbox" checked={form.isJamuan} onChange={e=>setForm({...form, isJamuan: e.target.checked})} className="w-5 h-5 accent-orange-500 cursor-pointer shrink-0"/>
                <div>
                  <div className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2"><Coffee size={16} className="text-orange-600"/> Uang Dana Jamuan / Makan</div>
                  <div className="text-[10px] font-bold text-slate-500 mt-1 normal-case">Pengeluaran beli makanan global tim</div>
                </div>
              </label>
              <div className={`flex items-center gap-1.5 bg-white px-3 py-2 rounded-xl border shadow-inner ml-2 transition-colors ${form.isJamuan ? 'border-orange-300' : 'border-slate-100 opacity-50'}`}>
                <span className={`text-[10px] font-black ${form.isJamuan ? 'text-orange-600' : 'text-slate-400'}`}>Rp</span>
                <input 
                  type="text" 
                  value={displayJamuan} 
                  onChange={handleJamuanInput}
                  disabled={!form.isJamuan}
                  className={`w-24 text-right outline-none text-base font-black disabled:bg-transparent ${form.isJamuan ? 'text-orange-700' : 'text-slate-400'}`}
                  placeholder="0"
                />
              </div>
            </div>

          </div>

          <button type="submit" disabled={!form.picId} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest disabled:opacity-40 shadow-md hover:bg-slate-800 transition-transform active:scale-95 mt-2 flex items-center justify-center gap-2 cursor-pointer">
            <DollarSign size={16}/> Cairkan Uang &amp; Catat Kas
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
        <div className="p-6 bg-slate-50 border-b border-slate-100 font-black text-sm uppercase tracking-wider text-slate-800 flex items-center gap-2">
          <Clock size={18} className="text-blue-500"/> Arsip Bukti Pencairan Lembur &amp; Bonus Tim
        </div>
        <div className="overflow-x-auto p-2 custom-scrollbar flex-1">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-100 sticky top-0 shadow-sm z-10">
              <tr>
                <th className="px-5 py-4 font-black">Waktu Cair &amp; ID</th>
                <th className="px-5 py-4 font-black">Penerima Dana Tunai (PIC)</th>
                <th className="px-5 py-4 font-black">Rincian Komponen Diklaim</th>
                <th className="px-5 py-4 font-black text-right">Total Uang Cair</th>
                <th className="px-5 py-4 font-black text-center">Aksi Hub</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
              {historyLembur.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-32 text-slate-400 font-black uppercase tracking-widest bg-white">
                    <div className="mx-auto flex justify-center mb-4 opacity-20"><Coffee size={48}/></div>
                    Belum ada aktivitas klaim lembur atau bonus di area cabang ini.
                  </td>
                </tr>
              ) : (
                historyLembur.map(log => {
                  const emp = globalCompiled[log.employee_id];
                  return (
                    <tr key={log.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-black text-sm">{formatDate(log.date)}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-1">{log.id}</div>
                      </td>
                      <td onClick={() => emp && onViewDetails(emp)} className="px-5 py-4 flex items-center gap-3 cursor-pointer">
                        <img src={emp?.photo_url} alt="Profile" className="w-12 h-12 rounded-xl object-cover border shadow-sm group-hover:scale-105 transition-transform" onError={(e)=>{e.target.src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}}/>
                        <div>
                          <span className="uppercase font-black text-slate-800 group-hover:text-blue-600 transition-colors block tracking-wide text-sm mb-1">{emp?.name || 'TIM OPERASIONAL'}</span>
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Lokasi: {emp?.branch_id.replace(/_/g, ' ') || activeBranch.replace(/_/g, ' ')}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[11px] text-slate-600 leading-relaxed normal-case font-medium max-w-sm">
                        {log.description}
                      </td>
                      <td className="px-5 py-4 text-right text-emerald-600 font-black whitespace-nowrap text-lg tracking-tight">
                        <div className="flex items-center justify-end gap-1.5"><ArrowDownToLine size={14}/> {formatRupiah(log.amount)}</div>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap opacity-40 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center justify-center gap-2">
                          <button type="button" onClick={() => {
                            if (typeof setPrintData === 'function') {
                              setPrintData({
                                type: 'INVOICE', 
                                title: 'BUKTI CAIR LEMBUR & BONUS', 
                                id: log.id, date: formatDate(log.date), 
                                branch_name: emp?.branch_id || activeBranch, 
                                admin_name: user?.name || 'ADMIN HRD', 
                                customer_name: emp?.name || 'P. JAWAB TIM',
                                position: 'OPERASIONAL',
                                items: [{ name: `Pencairan Tunai:\n${log.description}`, qty: 1, subtotal: log.amount }], 
                                amount: log.amount, paymentMethod: 'POTONG KAS TUNAI',
                                history: { labelLama: 'Total Pencairan', nominalLama: log.amount, labelAksi: 'Uang Diserahkan ke PIC', nominalAksi: log.amount, labelBaru: 'SALDO', nominalBaru: 0 }
                              });
                            }
                          }} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer" title="Cetak Ulang Slip Nota">
                            <Printer size={16}/>
                          </button>
                          
                          {isHQ && (
                            <button type="button" onClick={() => handleDelete(log.id)} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer" title="Void & Batalkan Data">
                              <Trash2 size={16}/>
                            </button>
                          )}
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
    </div>
  );
}
