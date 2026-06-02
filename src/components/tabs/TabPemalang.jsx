import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, Filter } from 'lucide-react';
import { 
  getTodayStr, getLocalYMD, formatRp, parseRp, 
  generateId, formatDate 
} from '../../utils/helpers';

export default function TabPemalang({ reports, sendToSheet, requestDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editCount, setEditCount] = useState(0);

  const todayStr = getTodayStr();
  const [date, setDate] = useState(todayStr);
  const [pesananMika, setPesananMika] = useState(''); const [pesananPorsi, setPesananPorsi] = useState('');
  const [produksiMika, setProduksiMika] = useState(''); const [produksiPorsi, setProduksiPorsi] = useState('');
  const [stokFreezer, setStokFreezer] = useState(''); 
  const [nominal, setNominal] = useState(0); const [transferDestination, setTransferDestination] = useState('BCA (WASTAM)'); 
  const [notes, setNotes] = useState('');
  
  // DIKEMBALIKAN KE DEFAULT HARI INI - HARI INI
  const [filterFrom, setFilterFrom] = useState(todayStr); 
  const [filterTo, setFilterTo] = useState(todayStr);

  const resetForm = () => {
    setShowForm(false); setIsEdit(false); setEditId(null); setEditCount(0);
    setDate(todayStr); setPesananMika(''); setPesananPorsi(''); setProduksiMika(''); setProduksiPorsi(''); setStokFreezer(''); setNominal(0); setNotes('');
  };

  const handleEdit = (item) => {
    setDate(String(item.date).split('T')[0]); setPesananMika(item.pesananMika); setPesananPorsi(item.pesananPorsi); setProduksiMika(item.produksiMika); setProduksiPorsi(item.produksiPorsi);
    setStokFreezer(item.stokFreezer); setTransferDestination(item.transferDestination); setNominal(item.nominal); setNotes(item.notes || '');
    setEditId(item.id); setEditCount(Number(item.editCount)||0); setIsEdit(true); setShowForm(true);
  };

  const handleSimpan = (e) => {
    e.preventDefault();
    const newReport = { id: isEdit ? editId : generateId('PML', date), date, pesananMika: Number(pesananMika)||0, pesananPorsi: Number(pesananPorsi)||0, produksiMika: Number(produksiMika)||0, produksiPorsi: Number(produksiPorsi)||0, stokFreezer, transferDestination, nominal: Number(nominal)||0, notes, editCount: isEdit ? editCount + 1 : 0 };
    sendToSheet(isEdit ? 'update' : 'insert', newReport, 'pemalang'); 
    resetForm();
  };

  const displayReports = useMemo(() => (reports||[]).filter(p => {
      const y = getLocalYMD(p?.date);
      return y && y >= filterFrom && y <= filterTo;
  }), [reports, filterFrom, filterTo]);

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center"><h3 className="font-bold text-lg text-slate-800">Laporan Operasional Harian</h3><button onClick={() => { if(showForm) resetForm(); else setShowForm(true); }} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm text-white ${showForm ? 'bg-slate-500' : 'bg-amber-600'}`}>{showForm ? <X size={16} /> : <Plus size={16} />} Batal / Baru</button></div>
      {showForm && (
        <form onSubmit={handleSimpan} className="bg-white p-6 rounded-xl border border-amber-200 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1 lg:col-span-4"><label className="text-sm font-medium">Tanggal</label><input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full lg:w-1/4 p-2 border rounded-lg" /></div>
          <div className="space-y-1 bg-slate-50 p-3 rounded-lg"><label className="text-xs font-bold">Pesanan (Mika)</label><input type="number" required value={pesananMika} onChange={e=>setPesananMika(e.target.value)} className="w-full p-2 border rounded" /></div>
          <div className="space-y-1 bg-slate-50 p-3 rounded-lg"><label className="text-xs font-bold">Pesanan (Porsi)</label><input type="number" required value={pesananPorsi} onChange={e=>setPesananPorsi(e.target.value)} className="w-full p-2 border rounded" /></div>
          <div className="space-y-1 bg-amber-50 p-3 rounded-lg"><label className="text-xs font-bold">Produksi (Mika)</label><input type="number" required value={produksiMika} onChange={e=>setProduksiMika(e.target.value)} className="w-full p-2 border rounded" /></div>
          <div className="space-y-1 bg-amber-50 p-3 rounded-lg"><label className="text-xs font-bold">Produksi (Porsi)</label><input type="number" required value={produksiPorsi} onChange={e=>setProduksiPorsi(e.target.value)} className="w-full p-2 border rounded" /></div>
          <div className="space-y-1 lg:col-span-4 bg-blue-50 p-4 rounded-lg border-blue-200 mt-2"><label className="text-sm font-bold text-blue-800">Sisa Stok Freezer Aktual Saat Tutup</label><input type="text" required value={stokFreezer} onChange={e => setStokFreezer(e.target.value)} className="w-full p-3 border rounded-lg uppercase" /></div>
          <div className="space-y-1 lg:col-span-2"><label className="text-sm font-medium">Nominal Disetor (Rp)</label><input type="text" required value={formatRp(nominal)} onChange={e => setNominal(parseRp(e.target.value))} className="w-full p-3 border-2 border-amber-200 rounded-lg font-bold text-lg text-amber-700" /></div>
          <div className="space-y-1 lg:col-span-1"><label className="text-sm font-medium">Tujuan TF</label><input type="text" list="bank-list" required value={transferDestination} onChange={e=>setTransferDestination(e.target.value)} className="w-full p-3 border rounded-lg font-bold" /><datalist id="bank-list"><option value="BCA (WASTAM)" /><option value="BRI (WASTAM)" /></datalist></div>
          <div className="space-y-1 lg:col-span-1"><label className="text-sm font-medium">Ket</label><input type="text" value={notes} onChange={e=>setNotes(e.target.value)} className="w-full p-3 border rounded-lg" /></div>
          <div className="lg:col-span-4 flex justify-end mt-2"><button type="submit" className="bg-amber-600 text-white px-6 py-2.5 rounded-lg font-medium">Simpan {isEdit ? 'Perubahan' : 'Laporan'}</button></div>
        </form>
      )}
      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border mt-4"><Filter size={16} className="text-slate-400"/><input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} className="p-1.5 text-sm border rounded" /> - <input type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)} className="p-1.5 text-sm border rounded" /></div>
      <div className="bg-white rounded-xl border mt-4 overflow-hidden"><table className="w-full text-sm text-left block md:table"><thead className="bg-amber-50 text-amber-800 border-b"><tr><th className="px-4 py-3">Tanggal Laporan</th><th className="px-4 py-3 text-center">Pesanan (M/P)</th><th className="px-4 py-3 text-center">Produksi (M/P)</th><th className="px-4 py-3">STOK FREEZER</th><th className="px-4 py-3 text-center">Disetor Ke</th><th className="px-4 py-3 text-right">Uang Disetor</th><th className="px-4 py-3 text-center">Aksi</th></tr></thead><tbody className="divide-y">
          {displayReports.length === 0 ? <tr><td colSpan="7" className="text-center py-12 text-slate-400">Tidak ada laporan ditemukan.</td></tr> : displayReports.map((rep) => (
            <tr key={rep.id} className="hover:bg-slate-50">
              <td className="px-4 py-3"><div className="font-medium">{formatDate(rep.date)}</div><div className="text-[10px] text-slate-400 font-mono">{rep.id}</div></td>
              <td className="px-4 py-3 text-center bg-slate-50/50"><div className="font-bold">{rep.pesananMika} M</div><div className="text-xs text-slate-500">{rep.pesananPorsi} Prs</div></td>
              <td className="px-4 py-3 text-center bg-amber-50/30"><div className="font-bold text-amber-700">{rep.produksiMika} M</div><div className="text-xs text-amber-600">{rep.produksiPorsi} Prs</div></td>
              <td className="px-4 py-3 bg-blue-50/30 font-bold text-blue-700 uppercase">{rep.stokFreezer || '-'}</td>
              <td className="px-4 py-3 text-center"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold">{rep.transferDestination || 'Pusat'}</span></td>
              <td className="px-4 py-3 text-right font-bold text-emerald-600">+{formatRp(rep.nominal)}</td>
              <td className="px-4 py-3 text-center"><div className="flex justify-center gap-2"><button onClick={() => handleEdit(rep)} className="text-blue-600 bg-blue-50 px-2 py-1 rounded-lg font-bold text-[10px]">EDIT</button><button onClick={() => requestDelete(rep.id)} className="text-red-500 bg-red-50 p-2 rounded-lg"><Trash2 size={16} /></button></div></td>
            </tr>
          ))}
      </tbody></table></div>
    </div>
  );
}
