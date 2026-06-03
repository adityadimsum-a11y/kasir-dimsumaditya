import React, { useState } from 'react';
import { Store, Plus, Trash2 } from 'lucide-react';
import { getTodayStr, generateId, formatDate, formatRp, parseRp } from '../../utils/helpers';

export default function TabPemalang({ reports, sendToSheet, requestDelete, role }) {
  const [showForm, setShowForm] = useState(false);
  const todayStr = getTodayStr();

  // Form Laporan Harian
  const [date, setDate] = useState(todayStr);
  const [produksiMika, setProduksiMika] = useState('');
  const [pesananMika, setPesananMika] = useState('');
  const [stokFreezer, setStokFreezer] = useState('KOSONG / HABIS');
  const [stokAyam, setStokAyam] = useState('HABIS');
  const [nominal, setNominal] = useState(0);
  const [transferDestination, setTransferDestination] = useState('BCA (WASTAM)');

  const resetForm = () => {
    setShowForm(false); setDate(todayStr); setProduksiMika(''); setPesananMika(''); 
    setStokFreezer('KOSONG / HABIS'); setStokAyam('HABIS'); setNominal(0);
  };

  const handleSimpan = (e) => {
    e.preventDefault();
    const newReport = {
      id: generateId('RPT', date), table: 'pemalang', date,
      produksiMika: Number(produksiMika)||0, 
      pesananMika: Number(pesananMika)||0,
      stokFreezer: stokFreezer.toUpperCase(),
      stokAyam: stokAyam.toUpperCase(), // INI DATA BARU SISA AYAM KANTONG
      nominal: Number(nominal)||0,
      transferDestination
    };
    sendToSheet('insert', newReport, 'pemalang');
    resetForm();
  };

  const displayReports = [...(reports || [])].sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Store size={20} /> Laporan Harian Pemalang</h3>
        <button onClick={() => { if(showForm) resetForm(); else setShowForm(true); }} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm text-white font-bold shadow-sm ${showForm ? 'bg-slate-500' : 'bg-indigo-600'}`}>
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Batal' : 'Buat Laporan Baru'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSimpan} className="bg-indigo-50 p-6 rounded-xl border border-indigo-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-full border-b border-indigo-200 pb-2 mb-2"><h4 className="font-bold text-indigo-900 text-sm">Form End of Day (EOD) Kasir</h4></div>
          <div className="space-y-1"><label className="text-sm font-bold text-indigo-800">Tanggal Laporan</label><input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg" /></div>
          <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><label className="text-sm font-bold text-indigo-800">Produksi (Mika)</label><input type="number" min="0" required value={produksiMika} onChange={e => setProduksiMika(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="Cth: 120" /></div>
              <div className="space-y-1"><label className="text-sm font-bold text-indigo-800">Pesanan (Mika)</label><input type="number" min="0" required value={pesananMika} onChange={e => setPesananMika(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="Cth: 120" /></div>
          </div>
          
          <div className="space-y-1"><label className="text-sm font-bold text-indigo-800">Stok Freezer (Fisik Aktual)</label><input type="text" required value={stokFreezer} onChange={e => setStokFreezer(e.target.value)} className="w-full p-2 border rounded-lg uppercase" placeholder="Cth: KOSONG atau SISA 10 MIKA" /></div>
          <div className="space-y-1"><label className="text-sm font-bold text-indigo-800">Stok Ayam (Fisik Aktual)</label><input type="text" required value={stokAyam} onChange={e => setStokAyam(e.target.value)} className="w-full p-2 border rounded-lg uppercase" placeholder="Cth: HABIS atau SISA 2 KANTONG" /></div>
          
          <div className="space-y-1"><label className="text-sm font-bold text-indigo-800">Nominal Setoran Tunai</label><input type="text" required value={formatRp(nominal)} onChange={e => setNominal(parseRp(e.target.value))} className="w-full p-2 border rounded-lg font-bold text-lg" /></div>
          <div className="space-y-1"><label className="text-sm font-bold text-indigo-800">Transfer Ke Rekening</label><select value={transferDestination} onChange={e => setTransferDestination(e.target.value)} className="w-full p-2 border rounded-lg font-bold h-[46px]"><option>BCA (WASTAM)</option><option>BRI (WASTAM)</option><option>LAINNYA</option></select></div>
          <div className="col-span-full flex justify-end mt-2 pt-4 border-t border-indigo-200"><button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-lg font-bold shadow-md">Simpan Laporan EOD</button></div>
        </form>
      )}

      <div className="bg-white rounded-xl border mt-4 overflow-hidden">
        <table className="w-full text-sm text-left block md:table">
          <thead className="bg-slate-50 border-b">
            <tr><th className="px-4 py-3">Tanggal & ID</th><th className="px-4 py-3 text-center">Produksi / Pesanan</th><th className="px-4 py-3">Stok Dimsum Fisik</th><th className="px-4 py-3">Stok Ayam Fisik</th><th className="px-4 py-3 text-right">Uang Disetor</th><th className="px-4 py-3 text-center">Aksi</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayReports.length === 0 ? <tr><td colSpan="6" className="text-center py-12 text-slate-400">Belum ada riwayat laporan harian.</td></tr> : displayReports.map((rep) => (
              <tr key={rep.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><div className="font-bold">{formatDate(rep.date)}</div><div className="text-[10px] text-slate-400 font-mono">{rep.id}</div></td>
                <td className="px-4 py-3 text-center font-bold text-slate-600">{rep.produksiMika} M / {rep.pesananMika} M</td>
                <td className="px-4 py-3 font-black text-indigo-700">{rep.stokFreezer}</td>
                <td className="px-4 py-3 font-black text-orange-700">{rep.stokAyam || '-'}</td>
                <td className="px-4 py-3 text-right"><div className="font-black text-emerald-600">{formatRp(rep.nominal)}</div><div className="text-[10px] text-slate-500">Ke: {rep.transferDestination}</div></td>
                <td className="px-4 py-3 text-center"><button onClick={() => requestDelete(rep.id)} className="text-red-500 bg-red-50 p-2 rounded-lg hover:bg-red-100 transition shadow-sm"><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
