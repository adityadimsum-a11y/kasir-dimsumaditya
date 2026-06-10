import React, { useState, useMemo } from 'react';
import { Factory, Package, Activity, Layers, Printer, Edit2, Trash2, CalendarDays, Undo, Plus, ArrowDown } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabStok({ productionBatches = [], production_batches, karyawan = [], masterBranches = [], master_branches, sendToSheet, showToast, user }) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';
  
  const [activeBranchFilter, setActiveBranchFilter] = useState(currentBranch);
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ id: '', date: todayStr, picId: '', adukan: '1', notes: '' });

  const realProductionBatches = production_batches || productionBatches || [];
  const realMasterBranches = master_branches || masterBranches || [];
  
  const activeEmployees = useMemo(() => (karyawan || []).filter(k => k && !k.isDeleted && k.status === 'AKTIF' && (isHQ || k.branch_id === currentBranch)), [karyawan, currentBranch, isHQ]);

  const kalkulasiOtomatis = useMemo(() => {
    const qty = Number(form.adukan || 0);
    return { ayamKg: qty * 30, hasilPcs: qty * 1000, hppTotal: qty * 1125000 };
  }, [form.adukan]);

  const historyProduksi = useMemo(() => {
    return realProductionBatches.filter(p => !p.isDeleted && !optimisticDeletedIds.has(p.id) && (activeBranchFilter === 'SEMUA_CABANG' || p.branch_id === activeBranchFilter || p.branch_id === 'PUSAT')).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realProductionBatches, activeBranchFilter, optimisticDeletedIds]);

  const metrikRadar = useMemo(() => {
    let adukanHariIni = 0; let pcsHariIni = 0; let ayamKgHariIni = 0; let adukanBulanIni = 0; let pcsBulanIni = 0; let hppBulanIni = 0;
    const today = new Date();
    historyProduksi.forEach(p => {
      const qtyAdukan = Number(p.total_adukan || 0);
      const pDate = p.date ? new Date(p.date) : new Date();
      const isToday = pDate.getDate() === today.getDate() && pDate.getMonth() === today.getMonth() && pDate.getFullYear() === today.getFullYear();
      const isThisMonth = pDate.getMonth() === today.getMonth() && pDate.getFullYear() === today.getFullYear();
      if (isToday) { adukanHariIni += qtyAdukan; pcsHariIni += Number(p.total_yield_pcs || 0); ayamKgHariIni += Number(p.total_ayam_kg || 0); }
      if (isThisMonth) { adukanBulanIni += qtyAdukan; pcsBulanIni += Number(p.total_yield_pcs || 0); hppBulanIni += Number(p.hpp_estimate || 0); }
    });
    return { adukanHariIni, pcsHariIni, ayamKgHariIni, adukanBulanIni, pcsBulanIni, hppBulanIni };
  }, [historyProduksi]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.picId) return alert("Pilih PIC!");
    const batchId = isEditing ? form.id : generateId('PRD', form.date);
    const payload = { id: batchId, date: form.date, branch_id: currentBranch, pic_id: form.picId, total_adukan: Number(form.adukan), total_ayam_kg: kalkulasiOtomatis.ayamKg, total_yield_pcs: kalkulasiOtomatis.hasilPcs, hpp_estimate: kalkulasiOtomatis.hppTotal, notes: form.notes.toUpperCase() };
    if (await sendToSheet(isEditing ? 'update' : 'insert', payload, 'production_batches')) {
      showToast('Produksi dicatat!', 'success');
      setForm({ id: '', date: todayStr, picId: '', adukan: '1', notes: '' });
      setIsEditing(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-l-4 border-l-emerald-500">
          <div className="text-[10px] font-black text-slate-400 uppercase">Total Adukan Hari Ini</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{formatNumber(metrikRadar.adukanHariIni)} BATCH</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-l-4 border-l-blue-500">
          <div className="text-[10px] font-black text-slate-400 uppercase">Ayam Terpakai Hari Ini</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{formatNumber(metrikRadar.ayamKgHariIni)} KG</div>
        </div>
        <div className="bg-slate-900 p-5 rounded-2xl text-white md:col-span-2 grid grid-cols-2 gap-4">
          <div><div className="text-[9px] font-black text-emerald-400 uppercase">Yield Frozen Bulan Ini</div><div className="text-xl font-black mt-1">{formatNumber(metrikRadar.pcsBulanIni)} PCS</div></div>
          <div><div className="text-[9px] font-black text-orange-400 uppercase">Akumulasi HPP Ayam</div><div className="text-xl font-black mt-1">{formatRupiah(metrikRadar.hppBulanIni)}</div></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl border bg-white border-t-emerald-600 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <h3 className="font-black text-sm uppercase text-slate-800">Laporan Produksi Baru</h3>
            <div><label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Tanggal</label><input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs font-bold" /></div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Kepala Produksi (PIC)</label>
              <select required value={form.picId} onChange={e=>setForm({...form, picId: e.target.value})} className="w-full p-3 border rounded-xl font-black text-sm bg-white cursor-pointer uppercase">
                <option value="">-- Pilih PIC --</option>
                {activeEmployees.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <label className="text-xs font-black text-emerald-800 uppercase block mb-2">Total Adukan Selesai</label>
              <input type="number" min="1" step="0.5" required value={form.adukan} onChange={e=>setForm({...form, adukan: e.target.value})} className="w-full p-3 border-2 border-emerald-300 rounded-xl font-black text-2xl text-center text-emerald-700 outline-none" />
            </div>
            <div><label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Keterangan</label><input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} placeholder="Shift..." className="w-full p-2.5 border rounded-xl text-xs uppercase" /></div>
            <button type="submit" className="w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest bg-emerald-600">Simpan &amp; Kunci Stok</button>
          </form>
        </div>
        
        <div className="lg:col-span-2 bg-white rounded-2xl border flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b"><h4 className="font-black text-xs uppercase text-slate-700">Buku Jurnal Produksi &amp; Yield</h4></div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b">
                <tr><th>Tgl &amp; ID</th><th>PIC</th><th className="text-center">Adukan</th><th className="text-right">Ayam</th><th className="text-right">Yield</th><th className="text-center">Aksi</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold">
                {historyProduksi.map(log => {
                  const emp = (karyawan || []).find(k => k.id === log.pic_id);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3"><div>{formatDate(log.date)}</div><div className="text-[9px] font-mono text-slate-400">{log.id}</div></td>
                      <td className="px-4 py-3"><div className="uppercase text-slate-700 font-black">{emp?.name || log.pic_id || 'UNKNOWN'}</div></td>
                      <td className="px-4 py-3 text-center"><span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg font-black">{log.total_adukan}</span></td>
                      <td className="px-4 py-3 text-right text-rose-600">-{formatNumber(log.total_ayam_kg)} Kg</td>
                      <td className="px-4 py-3 text-right text-blue-600">+{formatNumber(log.total_yield_pcs)} Pcs</td>
                      <td className="px-4 py-3 text-center">
                        {/* CETAK LAPORAN PRODUKSI BYPASS JSON */}
                        <button type="button" onClick={() => {
                          const rahasiaJson = JSON.stringify({ type: 'PRODUCTION', adukan: log.total_adukan, ayam: log.total_ayam_kg, yield: log.total_yield_pcs, notes: log.notes || '-' });
                          triggerPrint('NOTA_DOTMATRIX', {
                            title: 'LAPORAN HASIL PRODUKSI PABRIK',
                            id: log.id, date: formatDate(log.date), branch_name: log.branch_id || currentBranch,
                            admin_name: user?.name || 'SISTEM', customer_name: emp?.name || 'TIM PRODUKSI',
                            items: [{ name: rahasiaJson, qty: 1, subtotal: 0 }]
                          });
                        }} className="p-1.5 text-white bg-slate-800 hover:bg-slate-900 shadow rounded-lg"><Printer size={12}/></button>
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
