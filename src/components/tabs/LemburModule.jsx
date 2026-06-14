import React, { useState, useMemo, useEffect } from 'react';
import { Users, Clock, Trophy, Coffee, DollarSign, ArrowDownToLine, Printer, Trash2 } from 'lucide-react';

// 🔥 FIX JALUR KABEL PRINTER: Cukup mundur 2 langkah (../../)
import { triggerPrint } from '../../utils/PrintUtility';

// --- HELPER LOKAL ANTI-CRASH ---
const formatRupiah = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');
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

export default function LemburModule({ employees, expenses, globalCompiled, activeBranch, todayStr, sendToSheet, onViewDetails, user, setOptimisticDeletedIds, isHQ, showToast, optimisticDeletedIds, totalPorsiHariIni, totalPcsHariIni }) {
  const [form, setForm] = useState({ date: todayStr, picId: '', participants: [], isLembur: false, isBonus: false, isJamuan: false });
  
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

  const historyLembur = useMemo(() => { const targetBId = String(activeBranch || '').trim().toUpperCase(); return (expenses || []).filter(e => e && !e.isDeleted && !optimisticDeletedIds.has(e.id) && e.category === 'LEMBUR_BONUS' && (targetBId === 'SEMUA_CABANG' || String(e.branch_id || '').trim().toUpperCase() === targetBId)).sort((a, b) => new Date(b.date) - new Date(a.date)); }, [expenses, activeBranch, optimisticDeletedIds]);

  const handleDelete = async (id) => {
    if(window.confirm("Yakin ingin membatalkan/void data pencairan lembur & bonus tim ini?")) {
      setOptimisticDeletedIds(prev => new Set(prev).add(id)); const success = await sendToSheet('delete', { id }, 'expenses');
      if(success) { if(showToast) showToast('Data lembur berhasil dibatalkan.', 'success'); } else { setOptimisticDeletedIds(prev => { const n = new Set(prev); n.delete(id); return n; }); }
    }
  };

  const isTargetTembus = totalPorsiHariIni >= 2500;
  const qtyPeserta = form.participants.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-3xl border border-t-4 border-t-blue-600 h-max shadow-sm">
        
        {isTargetTembus ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-5 rounded-2xl mb-6 flex items-start gap-4 shadow-sm animate-in fade-in duration-500">
             <div className="text-4xl mt-1">🎉</div><div><div className="font-black uppercase text-base tracking-widest text-emerald-700">Bonus Target Tembus!</div><div className="text-[10px] font-bold mt-1 text-emerald-700/80 uppercase leading-relaxed tracking-wide">Adukan dapur berhasil mencapai <b>{formatNumber(totalPorsiHariIni)} Porsi</b> (Atau {formatNumber(totalPcsHariIni)} Pcs). Silakan klaim bonus Omset Rp 20.000 per Kepala!</div></div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 text-slate-600 p-5 rounded-2xl mb-6 flex items-start gap-4 shadow-sm animate-in fade-in duration-500">
             <div className="text-4xl mt-1 opacity-50">⏳</div><div><div className="font-black uppercase text-base tracking-widest text-slate-700">Target Belum Tercapai</div><div className="text-[10px] font-bold mt-1 text-slate-500 uppercase leading-relaxed tracking-wide">Adukan dapur hari ini baru tercetak <b>{formatNumber(totalPorsiHariIni)} Porsi</b> ({formatNumber(totalPcsHariIni)} Pcs). Butuh &gt;2500 Porsi untuk membuka kunci bonus omset.</div></div>
          </div>
        )}

        <form onSubmit={async (e) => {
          e.preventDefault(); if (!form.picId) return;
          if ((form.isLembur || form.isBonus) && qtyPeserta === 0) return alert("Wajib memilih minimal 1 orang peserta lembur/bonus dari daftar di bawah!");

          const expenseId = generateId('LMB', form.date);
          const empData = globalCompiled[form.picId];
          const penempatanTrx = activeBranch === 'SEMUA_CABANG' ? empData?.branch_id : activeBranch;
          
          let subLembur = form.isLembur ? 30000 * qtyPeserta : 0;
          let subBonus = form.isBonus ? 20000 * qtyPeserta : 0;
          let subJamuan = form.isJamuan ? 100000 : 0;
          let totalCair = subLembur + subBonus + subJamuan;

          if (totalCair === 0) return alert("Pilih minimal satu kotak komponen klaim di bawah!");

          const participantNames = form.participants.map(id => globalCompiled[id]?.name).join(', ');
          let descText = [];
          if(form.isLembur) descText.push(`Uang Lembur ${qtyPeserta} Org`);
          if(form.isBonus) descText.push(`Bonus Target ${qtyPeserta} Org`);
          if(form.isJamuan) descText.push('Dana Jamuan Tim Shift');
          const deskripsiFinal = `${descText.join(' + ')}. Peserta Absen: ${participantNames || 'Tim Global'}`;

          const payload = { id: expenseId, date: form.date, branch_id: penempatanTrx, employee_id: form.picId, category: 'LEMBUR_BONUS', amount: totalCair, description: deskripsiFinal };
          
          const success = await sendToSheet('insert', payload, 'expenses');
          if (success) {
            await sendToSheet('insert', { id: generateId('CFO', todayStr), date: form.date, branch_id: penempatanTrx, type: 'OUT', category: 'UANG LEMBUR & BONUS', amount: totalCair, method: 'CASH', reference_id: expenseId, description: `Pencairan Lembur/Bonus Tim Dapur & Outlet (PIC Pencairan: ${empData?.name})` }, 'cashflow_transactions');
            setForm({ date: todayStr, picId: '', participants: [], isLembur: false, isBonus: false, isJamuan: false });
            if (showToast) showToast('Dana lembur/bonus sukses dicairkan! Uang fisik laci kasir otomatis terpotong.', 'success');
          }
        }} className="space-y-4">
          
          <div><label className="text-[10px] font-black tracking-widest text-slate-400 uppercase block mb-1">Tgl Eksekusi Cair</label><input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-black outline-none bg-slate-50 focus:bg-white focus:border-blue-400 transition-colors" /></div>
          
          <div>
            <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1.5">1. Penanggung Jawab (PIC Penerima Uang Tunai)</label>
            <select required value={form.picId} onChange={e=>setForm({...form, picId: e.target.value})} className="w-full p-3 border border-blue-200 bg-blue-50/50 rounded-xl font-black text-xs uppercase outline-none cursor-pointer focus:bg-white focus:border-blue-500 transition-colors"><option value="">-- Pilih Leader Tim / Penanggung Jawab --</option>{employees.map(k => <option key={k.id} value={k.id}>{k.name} ({k.position.replace('_', ' ')}) - CAB {k.branch_id}</option>)}</select>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner">
            <label className="text-[10px] font-black text-slate-700 uppercase mb-3 flex items-center gap-1.5 tracking-widest"><Users size={14} className="text-blue-500"/> 2. Daftar Peserta Anggota Tim ({qtyPeserta} Orang Hadir)</label>
            <div className="flex flex-wrap gap-2.5">
              {employees.map(emp => (
                <label key={emp.id} className={`flex items-center gap-2 px-3.5 py-2 border rounded-xl text-[10px] font-black uppercase cursor-pointer transition-all ${form.participants.includes(emp.id) ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-105' : 'bg-white border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600'}`}>
                  <input type="checkbox" className="hidden" checked={form.participants.includes(emp.id)} onChange={() => toggleParticipant(emp.id)} />
                  {emp.name}
                </label>
              ))}
            </div>
            {qtyPeserta === 0 && <div className="text-[9px] text-rose-500 font-bold uppercase tracking-wider mt-4 italic">*Wajib tap / klik nama anggota tim di atas untuk mendaftarkan absen peserta lembur.</div>}
          </div>

          <div className="space-y-3 mt-4">
            <label className={`flex justify-between items-center p-4 border rounded-2xl shadow-sm cursor-pointer transition-colors hover:bg-slate-50 ${form.isLembur ? 'border-blue-400 bg-blue-50/50' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={form.isLembur} onChange={e=>setForm({...form, isLembur: e.target.checked})} className="w-4 h-4 accent-blue-600 cursor-pointer"/>
                <div><div className="text-[11px] font-black text-slate-800 uppercase flex items-center gap-1.5"><Clock size={14} className="text-blue-600"/> Jam Lembur Lewat 17:00 WIB</div><div className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wide">Uang lembur tambahan per kepala</div></div>
              </div>
              <div className="font-black text-blue-600 text-sm bg-white px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm">Rp 30.000</div>
            </label>

            <label className={`flex justify-between items-center p-4 border rounded-2xl shadow-sm cursor-pointer transition-colors hover:bg-slate-50 ${form.isBonus ? 'border-emerald-400 bg-emerald-50/50' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <input type="checkbox" disabled={!isTargetTembus} checked={form.isBonus} onChange={e=>setForm({...form, isBonus: e.target.checked})} className="w-4 h-4 accent-emerald-600 cursor-pointer disabled:opacity-50"/>
                <div><div className="text-[11px] font-black text-slate-800 uppercase flex items-center gap-1.5"><Trophy size={14} className={isTargetTembus ? "text-emerald-600" : "text-slate-400"}/> Bonus Omset Target Harian</div><div className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wide">Bonus apresiasi tembus target per kepala</div></div>
              </div>
              <div className={`font-black text-sm bg-white px-3 py-1.5 rounded-lg border shadow-sm ${isTargetTembus ? 'text-emerald-600 border-emerald-100' : 'text-slate-400 border-slate-100'}`}>Rp 20.000</div>
            </label>

            <label className={`flex justify-between items-center p-4 border rounded-2xl shadow-sm cursor-pointer transition-colors hover:bg-slate-50 ${form.isJamuan ? 'border-orange-400 bg-orange-50/50' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={form.isJamuan} onChange={e=>setForm({...form, isJamuan: e.target.checked})} className="w-4 h-4 accent-orange-500 cursor-pointer"/>
                <div><div className="text-[11px] font-black text-slate-800 uppercase flex items-center gap-1.5"><Coffee size={14} className="text-orange-600"/> Uang Dana Jamuan / Konsumsi Tim</div><div className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wide">Pengeluaran beli makanan global (bukan perorangan)</div></div>
              </div>
              <div className="font-black text-orange-600 text-sm bg-white px-3 py-1.5 rounded-lg border border-orange-100 shadow-sm">Rp 100.000</div>
            </label>
          </div>

          <button type="submit" disabled={!form.picId} className="w-full bg-slate-900 text-white font-black py-4.5 rounded-2xl text-xs uppercase disabled:opacity-40 shadow-xl hover:bg-slate-800 transition-transform active:scale-95 mt-4 tracking-widest flex items-center justify-center gap-2">
            <DollarSign size={16}/> Cairkan Uang &amp; Cetak Bukti Nota Kasir
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
        <div className="p-5 bg-slate-50 border-b border-slate-100 font-black text-xs uppercase tracking-widest text-slate-700 flex items-center gap-2"><Clock size={16} className="text-blue-500"/> Arsip Bukti Pencairan Lembur &amp; Bonus Tim Operasional</div>
        <div className="overflow-x-auto p-2 custom-scrollbar flex-1">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-white text-[10px] uppercase text-slate-400 border-b border-slate-100"><tr><th className="px-5 py-3 font-black">Waktu Cair &amp; ID</th><th className="px-5 py-3 font-black">Penerima Dana Tunai (PIC)</th><th className="px-5 py-3 font-black">Rincian Komponen Diklaim</th><th className="px-5 py-3 font-black text-right">Total Uang Cair</th><th className="px-5 py-3 font-black text-center">Aksi Operasional</th></tr></thead>
            <tbody className="divide-y divide-slate-50 text-xs font-bold">
              {historyLembur.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-20 text-slate-400 font-black uppercase tracking-widest bg-slate-50/50">Belum ada aktivitas klaim lembur atau bonus di area cabang ini.</td></tr>
              ) : (
                historyLembur.map(log => {
                  const emp = globalCompiled[log.employee_id];
                  return (
                    <tr key={log.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap"><div className="text-slate-800 font-black text-sm">{formatDate(log.date)}</div><div className="text-[9px] font-mono text-slate-400 mt-1">{log.id}</div></td>
                      <td className="px-5 py-4 whitespace-nowrap"><div className="uppercase text-blue-700 font-black text-xs tracking-wide">{emp?.name || 'TIM OPERASIONAL / KEPALA'}</div><div className="text-[8px] font-black tracking-widest text-slate-400 mt-1.5 uppercase">LOKASI CABANG: {emp?.branch_id.replace('_', ' ') || activeBranch.replace('_', ' ')}</div></td>
                      <td className="px-5 py-4 text-[10px] text-slate-600 leading-relaxed uppercase max-w-sm">{log.description}</td>
                      <td className="px-5 py-4 text-right text-emerald-600 font-black whitespace-nowrap text-sm flex items-center justify-end gap-1.5"><ArrowDownToLine size={12}/> {formatRupiah(log.amount)}</td>
                      <td className="px-5 py-4 text-center whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center justify-center gap-1.5">
                          <button type="button" onClick={() => triggerPrint('NOTA_DOTMATRIX', {
                            title: 'SLIP BUKTI PENCAIRAN LEMBUR & BONUS TIM', id: log.id, date: formatDate(log.date), periode: formatDate(log.date).substring(3),
                            branch_name: emp?.branch_id || activeBranch, admin_name: user?.name || 'ADMIN HRD', customer_name: emp?.name || 'P. JAWAB TIM', position: emp?.position.replace('_', ' ') || 'STAF',
                            items: [{ name: `Pencairan Tunai:\n${log.description}`, qty: 1, subtotal: log.amount }], amount: log.amount, paymentMethod: 'POTONG KAS LACI TUNAI FISIK'
                          })} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="Cetak Ulang Slip Nota"><Printer size={16}/></button>
                          
                          {isHQ && (<button type="button" onClick={() => handleDelete(log.id)} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" title="Void & Batalkan Data"><Trash2 size={16}/></button>)}
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
