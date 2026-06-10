import React, { useState, useMemo } from 'react';
import { Factory, Package, Activity, Layers, Printer, Edit2, Trash2, CalendarDays, Undo, Plus, ArrowDown } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

// MASTER RUMUS KONVERSI PABRIK (BOM)
const BOM = {
  KG_AYAM_PER_ADUKAN: 30,
  KANTONG_AYAM_PER_ADUKAN: 3,
  PCS_YIELD_PER_ADUKAN: 1000,
  PORSI_YIELD_PER_ADUKAN: 250,
  MIKA_YIELD_PER_ADUKAN: 20,
  HPP_AYAM_PER_ADUKAN: 1125000
};

export default function TabStok({ 
  productionBatches = [], production_batches, 
  karyawan = [], masterBranches = [], master_branches,
  sendToSheet, showToast, user, requestDelete 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';
  
  const [activeBranchFilter, setActiveBranchFilter] = useState(currentBranch);
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState(new Set());
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({
    id: '', date: todayStr, picId: '', adukan: '1', notes: ''
  });

  const realProductionBatches = production_batches || productionBatches || [];
  const realMasterBranches = master_branches || masterBranches || [];
  
  const daftarCabangId = useMemo(() => {
    const list = realMasterBranches.filter(b => b && !b.isDeleted && b.branch_id).map(b => b.branch_id);
    if (!list.includes('TANGERANG_PUSAT')) list.push('TANGERANG_PUSAT');
    return list;
  }, [realMasterBranches]);

  const activeEmployees = useMemo(() => {
    return (karyawan || []).filter(k => k && !k.isDeleted && k.status === 'AKTIF' && (isHQ || k.branch_id === currentBranch));
  }, [karyawan, currentBranch, isHQ]);

  // ALGORITMA KONVERSI SUPER DETAIL
  const kalkulasiOtomatis = useMemo(() => {
    const qty = Number(form.adukan || 0);
    return {
      ayamKg: qty * BOM.KG_AYAM_PER_ADUKAN,
      ayamKantong: qty * BOM.KANTONG_AYAM_PER_ADUKAN,
      hasilPcs: qty * BOM.PCS_YIELD_PER_ADUKAN,
      hasilMika: qty * BOM.MIKA_YIELD_PER_ADUKAN,
      hasilPorsi: qty * BOM.PORSI_YIELD_PER_ADUKAN,
      hppTotal: qty * BOM.HPP_AYAM_PER_ADUKAN
    };
  }, [form.adukan]);

  const historyProduksi = useMemo(() => {
    return realProductionBatches.filter(p => {
      if (!p || p.isDeleted || optimisticDeletedIds.has(p.id)) return false;
      if (activeBranchFilter !== 'SEMUA_CABANG' && p.branch_id !== activeBranchFilter && p.branch_id !== 'PUSAT') return false;
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realProductionBatches, activeBranchFilter, optimisticDeletedIds]);

  const metrikRadar = useMemo(() => {
    let adukanHariIni = 0; let pcsHariIni = 0; let ayamKgHariIni = 0;
    let adukanBulanIni = 0; let pcsBulanIni = 0; let hppBulanIni = 0;
    const today = new Date();

    historyProduksi.forEach(p => {
      const qtyAdukan = Number(p.total_adukan || 0);
      const pDate = p.date ? new Date(p.date) : new Date();
      const isToday = pDate.getDate() === today.getDate() && pDate.getMonth() === today.getMonth() && pDate.getFullYear() === today.getFullYear();
      const isThisMonth = pDate.getMonth() === today.getMonth() && pDate.getFullYear() === today.getFullYear();

      if (isToday) {
        adukanHariIni += qtyAdukan;
        pcsHariIni += Number(p.total_yield_pcs || 0);
        ayamKgHariIni += Number(p.total_ayam_kg || 0);
      }
      if (isThisMonth) {
        adukanBulanIni += qtyAdukan;
        pcsBulanIni += Number(p.total_yield_pcs || 0);
        hppBulanIni += Number(p.hpp_estimate || 0);
      }
    });
    return { adukanHariIni, pcsHariIni, ayamKgHariIni, adukanBulanIni, pcsBulanIni, hppBulanIni };
  }, [historyProduksi]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.picId) return alert("Pilih penanggung jawab (PIC) produksi!");
    if (Number(form.adukan) <= 0) return alert("Jumlah adukan harus lebih dari 0!");

    const batchId = isEditing ? form.id : generateId('PRD', form.date);
    const payload = {
      id: batchId, date: form.date, branch_id: currentBranch, pic_id: form.picId,
      total_adukan: Number(form.adukan), total_ayam_kg: kalkulasiOtomatis.ayamKg,
      total_yield_pcs: kalkulasiOtomatis.hasilPcs, hpp_estimate: kalkulasiOtomatis.hppTotal, 
      notes: form.notes.toUpperCase()
    };

    let success = false;
    if (isEditing) { success = await sendToSheet('update', payload, 'production_batches'); } 
    else { success = await sendToSheet('insert', payload, 'production_batches'); }

    if (success) {
      if (showToast) showToast(isEditing ? 'Data produksi diupdate!' : 'Produksi berhasil dicatat!', 'success');
      setForm({ id: '', date: todayStr, picId: '', adukan: '1', notes: '' });
      setIsEditing(false);
    }
  };

  const handleEdit = (log) => {
    setForm({
      id: log.id, date: log.date.split('T')[0], picId: log.pic_id || '', 
      adukan: String(log.total_adukan || 0), notes: log.notes || ''
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if(window.confirm("AWAS! Menghapus data ini akan merusak laporan stok gudang. Yakin ingin menghapus?")) {
      if(requestDelete) {
        requestDelete(id);
      } else {
        setOptimisticDeletedIds(prev => { const n = new Set(prev); n.add(id); return n; });
        const success = await sendToSheet('delete', { id }, 'production_batches');
        if(success) { if(showToast) showToast('Data produksi divoid.', 'success'); } 
        else { setOptimisticDeletedIds(prev => { const n = new Set(prev); n.delete(id); return n; }); }
      }
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* 📊 METRIK ATAS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-emerald-500 relative overflow-hidden">
          <Activity className="absolute -right-4 -bottom-4 text-emerald-50 opacity-50" size={100} />
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">Total Adukan Hari Ini</div>
          <div className="text-2xl font-black text-emerald-600 mt-1 relative z-10">{formatNumber(metrikRadar.adukanHariIni)} <span className="text-xs">BATCH</span></div>
        </div>
        <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-blue-500 relative overflow-hidden">
          <Layers className="absolute -right-4 -bottom-4 text-blue-50 opacity-50" size={100} />
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">Ayam Terpakai Hari Ini</div>
          <div className="text-2xl font-black text-blue-600 mt-1 relative z-10">{formatNumber(metrikRadar.ayamKgHariIni)} <span className="text-xs">KG</span></div>
        </div>
        <div className="bg-slate-900 p-5 rounded-2xl shadow-md border border-slate-800 md:col-span-2 grid grid-cols-2 gap-4 text-white relative overflow-hidden">
          <Factory className="absolute -right-2 -bottom-4 text-slate-800 opacity-50" size={120} />
          <div className="relative z-10">
            <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Yield Frozen Bulan Ini</div>
            <div className="text-xl font-black mt-1">{formatNumber(metrikRadar.pcsBulanIni)} <span className="text-[10px] text-slate-400">PCS</span></div>
          </div>
          <div className="relative z-10">
            <div className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Akumulasi HPP (Modal Ayam)</div>
            <div className="text-xl font-black mt-1">{formatRupiah(metrikRadar.hppBulanIni)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KIRI: FORM PRODUKSI */}
        <div className={`p-6 rounded-2xl border transition-all h-max shadow-sm ${isEditing ? 'bg-amber-50/50 border-t-4 border-t-amber-500 border-amber-200' : 'bg-white border-t-4 border-t-emerald-600'}`}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm uppercase text-slate-800 flex items-center gap-2">
                {isEditing ? <Edit2 size={16} className="text-amber-600"/> : <Factory size={16} className="text-emerald-600"/>} 
                {isEditing ? 'Revisi Laporan Produksi' : 'Laporan Produksi Baru'}
              </h3>
              {isEditing && (
                <button type="button" onClick={() => { setIsEditing(false); setForm({ id: '', date: todayStr, picId: '', adukan: '1', notes: '' }); }} className="text-[10px] border px-2.5 py-1 rounded-lg font-black uppercase text-slate-500 bg-white shadow-sm flex items-center gap-1 hover:bg-slate-50">
                  <Undo size={12}/> Batal
                </button>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tanggal Produksi</label>
              <input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 mt-1 border rounded-xl text-xs font-bold outline-none bg-slate-50" />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Kepala Produksi (PIC)</label>
              <select required value={form.picId} onChange={e=>setForm({...form, picId: e.target.value})} className="w-full p-3 mt-1 border border-slate-300 rounded-xl font-black text-sm uppercase outline-none bg-white cursor-pointer">
                <option value="">-- Pilih PIC Bertugas --</option>
                {activeEmployees.map(k => <option key={k.id} value={k.id}>{k.name} ({k.position})</option>)}
              </select>
            </div>

            {/* 🔥 PANEL RINCIAN KONVERSI (SUDAH DIKEMBALIKAN) 🔥 */}
            <div className="p-5 bg-emerald-50/50 border border-emerald-200 rounded-2xl shadow-inner">
              <label className="text-xs font-black text-emerald-800 uppercase flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5"><Plus size={14}/> Total Adukan Selesai</div>
                <div className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-lg shadow-sm">BATCH</div>
              </label>
              <input type="number" min="0.5" step="0.5" required value={form.adukan} onChange={e=>setForm({...form, adukan: e.target.value})} className="w-full p-4 border-2 border-emerald-300 bg-white rounded-xl font-black text-3xl text-center text-emerald-700 outline-none focus:border-emerald-500 transition-colors" />
              
              {/* DETAILS KONVERSI (AYAM, MIKA, PORSI) */}
              <div className="mt-5 pt-4 border-t border-emerald-200/60 grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-sm">
                  <div className="text-[9px] font-black uppercase text-rose-500 tracking-widest mb-1">Potong Stok Ayam</div>
                  <div className="text-lg font-black text-rose-700 flex items-center gap-1"><ArrowDown size={14}/> -{formatNumber(kalkulasiOtomatis.ayamKg)} Kg</div>
                  <div className="text-[10px] font-bold text-slate-500 mt-1 bg-slate-50 px-2 py-1 rounded inline-block border border-slate-100">
                    Konversi: {formatNumber(kalkulasiOtomatis.ayamKantong)} Kantong
                  </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm">
                  <div className="text-[9px] font-black uppercase text-blue-500 tracking-widest mb-1">Tambah Stok Frozen</div>
                  <div className="text-lg font-black text-blue-700 flex items-center gap-1"><Package size={14}/> +{formatNumber(kalkulasiOtomatis.hasilPcs)} Pcs</div>
                  <div className="text-[10px] font-bold text-slate-500 mt-1 bg-slate-50 px-2 py-1 rounded inline-block border border-slate-100">
                    {formatNumber(kalkulasiOtomatis.hasilMika)} Mika / {formatNumber(kalkulasiOtomatis.hasilPorsi)} Porsi
                  </div>
                </div>
                <div className="col-span-2 bg-orange-50 p-3 rounded-xl border border-orange-200 flex justify-between items-center shadow-sm">
                  <div className="text-[10px] font-black uppercase text-orange-700 tracking-widest">Estimasi HPP Ayam</div>
                  <div className="text-lg font-black text-orange-700">{formatRupiah(kalkulasiOtomatis.hppTotal)}</div>
                </div>
              </div>
            </div>

            <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Keterangan / Shift (Opsional)</label><input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} placeholder="Shift Siang..." className="w-full p-2.5 mt-1 border rounded-xl text-xs uppercase outline-none bg-slate-50" /></div>
            
            <button type="submit" className={`w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg transition-all ${isEditing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {isEditing ? 'Simpan Revisi' : 'Simpan & Kunci Stok Produksi'}
            </button>
          </form>
        </div>
        
        {/* KANAN: TABEL JURNAL PRODUKSI */}
        <div className="lg:col-span-2 bg-white rounded-2xl border flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
            <h4 className="font-black text-xs uppercase text-slate-700 tracking-widest flex items-center gap-2"><CalendarDays size={14} className="text-emerald-600"/> Buku Jurnal Produksi &amp; Yield</h4>
            {isHQ && (
              <select value={activeBranchFilter} onChange={e => setActiveBranchFilter(e.target.value)} className="text-[10px] font-black uppercase bg-white border rounded-lg px-2 py-1 outline-none text-slate-600 cursor-pointer shadow-sm">
                <option value="SEMUA_CABANG">🌍 NASIONAL</option>
                {daftarCabangId.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
          </div>
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b border-slate-200">
                <tr><th className="px-4 py-3 whitespace-nowrap">Tgl &amp; ID Laporan</th><th className="px-4 py-3 whitespace-nowrap">PIC &amp; Lokasi</th><th className="px-4 py-3 whitespace-nowrap text-center">Batch (Adukan)</th><th className="px-4 py-3 whitespace-nowrap text-right bg-rose-50/50 text-rose-600">Material (Ayam)</th><th className="px-4 py-3 whitespace-nowrap text-right bg-blue-50/50 text-blue-600">Yield (Frozen)</th><th className="px-4 py-3 whitespace-nowrap text-center">Aksi</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold">
                {historyProduksi.map(log => {
                  const emp = (karyawan || []).find(k => k.id === log.pic_id);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-slate-800">{formatDate(log.date)}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">{log.id}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="uppercase text-slate-700 font-black">{emp?.name || log.pic_id || 'UNKNOWN'}</div>
                        <div className="text-[9px] font-black text-indigo-400 mt-0.5 tracking-wider uppercase">LOK: {log.branch_id}</div>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center bg-emerald-100 text-emerald-800 px-3 py-1 rounded-lg text-sm font-black border border-emerald-200 shadow-sm">{log.total_adukan}</div>
                      </td>
                      {/* RINCIAN KONVERSI DI TABEL */}
                      <td className="px-4 py-3 text-right bg-rose-50/30 whitespace-nowrap">
                        <div className="text-rose-600 font-black flex items-center justify-end gap-1"><ArrowDown size={10}/> -{formatNumber(log.total_ayam_kg)} Kg</div>
                        <div className="text-[9px] text-slate-400 mt-0.5 font-bold">({formatNumber((log.total_ayam_kg / BOM.KG_AYAM_PER_ADUKAN) * BOM.KANTONG_AYAM_PER_ADUKAN)} Kantong)</div>
                      </td>
                      <td className="px-4 py-3 text-right bg-blue-50/30 whitespace-nowrap">
                        <div className="text-blue-600 font-black flex items-center justify-end gap-1"><Package size={10}/> +{formatNumber(log.total_yield_pcs)} Pcs</div>
                        <div className="text-[9px] text-slate-400 mt-0.5 font-bold">({formatNumber(log.total_yield_pcs / BOM.MIKA_YIELD_PER_ADUKAN)} Mika)</div>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* TOMBOL CETAK LAPORAN PRODUKSI BYPASS JSON */}
                          <button type="button" onClick={() => {
                            const rahasiaJson = JSON.stringify({ type: 'PRODUCTION', adukan: log.total_adukan, ayam: log.total_ayam_kg, yield: log.total_yield_pcs, notes: log.notes || '-' });
                            triggerPrint('NOTA_DOTMATRIX', {
                              title: 'LAPORAN HASIL PRODUKSI PABRIK',
                              id: log.id, date: formatDate(log.date), branch_name: log.branch_id || currentBranch,
                              admin_name: user?.name || 'SISTEM', customer_name: emp?.name || 'TIM PRODUKSI',
                              items: [{ name: rahasiaJson, qty: 1, subtotal: 0 }]
                            });
                          }} className="p-1.5 px-2 text-white bg-slate-800 hover:bg-slate-900 shadow rounded-lg flex items-center gap-1 text-[10px] uppercase font-black tracking-wider"><Printer size={12}/> Print</button>
                          
                          {isHQ && (
                            <>
                              <button type="button" onClick={() => handleEdit(log)} className="p-1.5 bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 rounded-lg"><Edit2 size={12}/></button>
                              <button type="button" onClick={() => handleDelete(log.id)} className="p-1.5 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 rounded-lg"><Trash2 size={12}/></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
