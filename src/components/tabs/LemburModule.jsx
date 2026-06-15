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
    if(window.confirm("Yakin ingin membatalkan/void data pencairan lembur & bonus tim ini?")) {
      setOptimisticDeletedIds(prev => new Set(prev).add(id)); 
      const success = await sendToSheet('delete', { id }, 'expenses');
      if(success) { 
        if(showToast) showToast('Data lembur berhasil dibatalkan.', 'success'); 
      } else { 
        setOptimisticDeletedIds(prev => { const n = new Set(prev); n.delete(id); return n; }); 
      }
    }
  };

  const isTargetTembus = totalPorsiHariIni >= 2500;
  const qtyPeserta = form.participants.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 normal-case">
      <div className="card-holo bg-white p-6 rounded-2xl border border-slate-200 border-t-4 border-t-blue-600 h-max shadow-2xs">
        
        {isTargetTembus ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl mb-6 flex items-start gap-3 shadow-3xs animate-in fade-in duration-500">
             <div className="text-3xl mt-0.5">🎉</div>
             <div>
               <div className="font-black normal-case text-sm text-emerald-700">Bonus Target Tembus!</div>
               <div className="text-[10px] font-bold mt-1 text-emerald-700/80 normal-case leading-relaxed">Adukan dapur berhasil mencapai <b>{formatNumber(totalPorsiHariIni)} Porsi</b> (Atau {formatNumber(totalPcsHariIni)} Pcs). Silakan klaim bonus Omset Rp 20.000 per Kepala!</div>
             </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 text-slate-600 p-4 rounded-xl mb-6 flex items-start gap-3 shadow-3xs animate-in fade-in duration-500">
             <div className="text-3xl mt-0.5 opacity-50">⏳</div>
             <div>
               <div className="font-black normal-case text-sm text-slate-700">Target Belum Tercapai</div>
               <div className="text-[10px] font-bold mt-1 text-slate-500 normal-case leading-relaxed">Adukan dapur hari ini baru tercetak <b>{formatNumber(totalPorsiHariIni)} Porsi</b> ({formatNumber(totalPcsHariIni)} Pcs). Butuh &gt;2500 Porsi untuk membuka kunci bonus omset.</div>
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
            if (showToast) showToast('Dana lembur/bonus sukses dicairkan! Uang fisik laci kasir otomatis terpotong.', 'success');
          }
        }} className="space-y-4">
          
          <div>
            <label className="text-[10px] font-bold text-slate-500 normal-case block mb-1">Tgl Eksekusi Cair</label>
            <input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-bold outline-none bg-slate-50 focus:bg-white focus:border-blue-400 transition-colors shadow-3xs cursor-pointer" />
          </div>
          
          <div>
            <label className="text-[10px] font-bold text-blue-600 normal-case block mb-1.5">1. Penanggung Jawab (PIC Penerima Uang Tunai)</label>
            <select required value={form.picId} onChange={e=>setForm({...form, picId: e.target.value})} className="w-full p-2.5 border border-blue-200 bg-blue-50/50 rounded-lg font-bold text-xs normal-case outline-none cursor-pointer focus:bg-white focus:border-blue-500 transition-colors shadow-3xs">
              <option value="">-- Pilih Leader Tim / Penanggung Jawab --</option>
              {employees.map(k => <option key={k.id} value={k.id}>{k.name} ({k.position.replace(/_/g, ' ')}) - CAB {k.branch_id}</option>)}
            </select>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner">
            <label className="text-[10px] font-bold text-slate-700 normal-case mb-3 flex items-center gap-1.5"><Users size={14} className="text-blue-500"/> 2. Daftar Peserta Anggota Tim ({qtyPeserta} Orang Hadir)</label>
            <div className="flex flex-wrap gap-2">
              {employees.map(emp => (
                <label key={emp.id} className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-[10px] font-bold normal-case cursor-pointer transition-all ${form.participants.includes(emp.id) ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-105' : 'bg-white border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600'}`}>
                  <input type="checkbox" className="hidden" checked={form.participants.includes(emp.id)} onChange={() => toggleParticipant(emp.id)} />
                  {emp.name}
                </label>
              ))}
            </div>
            {qtyPeserta === 0 && <div className="text-[9px] text-rose-500 font-bold normal-case mt-3 italic">*Wajib tap / klik nama anggota tim di atas untuk mendaftarkan absen peserta lembur.</div>}
          </div>

          <div className="space-y-3 mt-4">
            
            {/* 🔥 FLEKSIBEL: UANG LEMBUR */}
            <div className={`flex justify-between items-center p-3 border rounded-xl shadow-3xs transition-colors ${form.isLembur ? 'border-blue-400 bg-blue-50/50' : 'bg-white border-slate-200'}`}>
              <label className="flex items-center gap-3 cursor-pointer flex-1">
                <input type="checkbox" checked={form.isLembur} onChange={e=>setForm({...form, isLembur: e.target.checked})} className="w-4 h-4 accent-blue-600 cursor-pointer shrink-0"/>
                <div>
                  <div className="text-[11px] font-black text-slate-800 normal-case flex items-center gap-1.5"><Clock size={14} className="text-blue-600"/> Jam Lembur Lewat 17:00 WIB</div>
                  <div className="text-[9px] font-bold text-slate-500 mt-0.5 normal-case">Uang lembur tambahan per kepala</div>
                </div>
              </label>
              <div className={`flex items-center gap-1 bg-white px-2 py-1.5 rounded-lg border shadow-3xs ml-2 transition-colors ${form.isLembur ? 'border-blue-300' : 'border-slate-100 opacity-50'}`}>
                <span className={`text-[10px] font-black ${form.isLembur ? 'text-blue-600' : 'text-slate-400'}`}>Rp</span>
                <input 
                  type="text" 
                  value={form.lemburNominal ? Number(form.lemburNominal).toLocaleString('id-ID') : ''} 
                  onChange={e => setForm({...form, lemburNominal: e.target.value.replace(/\D/g, '')})}
                  disabled={!form.isLembur}
                  className={`w-16 sm:w-20 text-right outline-none text-sm font-black disabled:bg-transparent ${form.isLembur ? 'text-blue-700' : 'text-slate-400'}`}
                  placeholder="0"
                />
              </div>
            </div>

            {/* 🔒 FIXED: BONUS OMSET */}
            <label className={`flex justify-between items-center p-3 border rounded-xl shadow-3xs cursor-pointer transition-colors hover:bg-slate-50 ${form.isBonus ? 'border-emerald-400 bg-emerald-50/50' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-3 flex-1">
                <input type="checkbox" disabled={!isTargetTembus} checked={form.isBonus} onChange={e=>setForm({...form, isBonus: e.target.checked})} className="w-4 h-4 accent-emerald-600 cursor-pointer disabled:opacity-50 shrink-0"/>
                <div>
                  <div className="text-[11px] font-black text-slate-800 normal-case flex items-center gap-1.5"><Trophy size={14} className={isTargetTembus ? "text-emerald-600" : "text-slate-400"}/> Bonus Omset Target Harian</div>
                  <div className="text-[9px] font-bold text-slate-500 mt-0.5 normal-case">Bonus apresiasi tembus target per kepala</div>
                </div>
              </div>
              <div className={`font-black text-sm bg-white px-3 py-1.5 rounded-lg border shadow-3xs ml-2 shrink-0 ${isTargetTembus ? 'text-emerald-600 border-emerald-200' : 'text-slate-400 border-slate-100 opacity-50'}`}>
                Rp 20.000
              </div>
            </label>

            {/* 🔥 FLEKSIBEL: UANG JAMUAN MAKAN */}
            <div className={`flex justify-between items-center p-3 border rounded-xl shadow-3xs transition-colors ${form.isJamuan ? 'border-orange-400 bg-orange-50/50' : 'bg-white border-slate-200'}`}>
              <label className="flex items-center gap-3 cursor-pointer flex-1">
                <input type="checkbox" checked={form.isJamuan} onChange={e=>setForm({...form, isJamuan: e.target.checked})} className="w-4 h-4 accent-orange-500 cursor-pointer shrink-0"/>
                <div>
                  <div className="text-[11px] font-black text-slate-800 normal-case flex items-center gap-1.5"><Coffee size={14} className="text-orange-600"/> Uang Dana Jamuan / Konsumsi</div>
                  <div className="text-[9px] font-bold text-slate-500 mt-0.5 normal-case">Pengeluaran beli makanan global tim</div>
                </div>
              </label>
              <div className={`flex items-center gap-1 bg-white px-2 py-1.5 rounded-lg border shadow-3xs ml-2 transition-colors ${form.isJamuan ? 'border-orange-300' : 'border-slate-100 opacity-50'}`}>
                <span className={`text-[10px] font-black ${form.isJamuan ? 'text-orange-600' : 'text-slate-400'}`}>Rp</span>
                <input 
                  type="text" 
                  value={form.jamuanNominal ? Number(form.jamuanNominal).toLocaleString('id-ID') : ''} 
                  onChange={e => setForm({...form, jamuanNominal: e.target.value.replace(/\D/g, '')})}
                  disabled={!form.isJamuan}
                  className={`w-16 sm:w-20 text-right outline-none text-sm font-black disabled:bg-transparent ${form.isJamuan ? 'text-orange-700' : 'text-slate-400'}`}
                  placeholder="0"
                />
              </div>
            </div>

          </div>

          <button type="submit" disabled={!form.picId} className="w-full bg-slate-900 text-white font-black py-3.5 rounded-xl text-xs normal-case disabled:opacity-40 shadow-md hover:bg-slate-800 transition-transform active:scale-95 mt-4 flex items-center justify-center gap-2 cursor-pointer">
            <DollarSign size={14}/> Cairkan Uang &amp; Catat Kas
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 card-holo bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden shadow-2xs h-[75vh]">
        <div className="p-4 bg-slate-50 border-b border-slate-100 font-black text-xs normal-case text-slate-800 flex items-center gap-2">
          <Clock size={16} className="text-blue-500"/> Arsip Bukti Pencairan Lembur &amp; Bonus Tim
        </div>
        <div className="overflow-x-auto p-1 custom-scrollbar flex-1">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/50 text-[10px] normal-case text-slate-500 border-b border-slate-100 sticky top-0 shadow-3xs z-10">
              <tr>
                <th className="px-5 py-3 font-black">Waktu Cair &amp; ID</th>
                <th className="px-5 py-3 font-black">Penerima Dana Tunai (PIC)</th>
                <th className="px-5 py-3 font-black">Rincian Komponen Diklaim</th>
                <th className="px-5 py-3 font-black text-right">Total Uang Cair</th>
                <th className="px-5 py-3 font-black text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold bg-white">
              {historyLembur.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-24 text-slate-400 font-bold normal-case bg-white">
                    Belum ada aktivitas klaim lembur atau bonus di area cabang ini.
                  </td>
                </tr>
              ) : (
                historyLembur.map(log => {
                  const emp = globalCompiled[log.employee_id];
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-black text-xs">{formatDate(log.date)}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-1">{log.id}</div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="normal-case text-blue-700 font-black text-xs">{emp?.name || 'TIM OPERASIONAL'}</div>
                        <div className="text-[9px] font-bold text-slate-400 mt-0.5 normal-case">LOKASI: {emp?.branch_id.replace(/_/g, ' ') || activeBranch.replace(/_/g, ' ')}</div>
                      </td>
                      <td className="px-5 py-4 text-[10px] text-slate-600 leading-relaxed normal-case font-medium max-w-sm">
                        {log.description}
                      </td>
                      <td className="px-5 py-4 text-right text-emerald-600 font-black whitespace-nowrap text-sm">
                        <div className="flex items-center justify-end gap-1.5"><ArrowDownToLine size={12}/> {formatRupiah(log.amount)}</div>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center justify-center gap-2">
                          {/* 🔥 FIX: RE-ROUTING PRINT KE APP.JSX */}
                          <button type="button" onClick={() => {
                            if (typeof setPrintData === 'function') {
                              setPrintData({
                                title: 'BUKTI CAIR LEMBUR & BONUS', 
                                id: log.id, date: formatDate(log.date), 
                                branch_name: emp?.branch_id || activeBranch, 
                                admin_name: user?.name || 'ADMIN HRD', 
                                customer_name: emp?.name || 'P. JAWAB TIM',
                                items: [{ name: `Pencairan Tunai:\n${log.description}`, qty: 1, subtotal: log.amount }], 
                                amount: log.amount, paymentMethod: 'POTONG KAS TUNAI'
                              });
                            }
                          }} className="p-2 text-slate-400 bg-white border border-slate-200 shadow-3xs hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" title="Cetak Ulang Slip Nota">
                            <Printer size={16}/>
                          </button>
                          
                          {isHQ && (
                            <button type="button" onClick={() => handleDelete(log.id)} className="p-2 text-slate-400 bg-white border border-slate-200 shadow-3xs hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" title="Void & Batalkan Data">
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
