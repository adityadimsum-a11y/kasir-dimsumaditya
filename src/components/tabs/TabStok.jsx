import React, { useState, useMemo } from 'react';
import { Package, Plus, Trash2, ArrowRightCircle, AlertTriangle, Truck } from 'lucide-react';
import { getTodayStr, generateId, formatDate, safeSort } from '../../utils/helpers';

export default function TabStok({ stokData, purchases, orders, sendToSheet, requestDelete }) {
  const todayStr = getTodayStr();
  const [showProduksi, setShowProduksi] = useState(false);
  const [showMutasi, setShowMutasi] = useState(false);

  // Form Produksi
  const [adukan, setAdukan] = useState('');
  const [waktuProd, setWaktuProd] = useState('Pagi');
  const [notesProd, setNotesProd] = useState('');

  // Form Mutasi / Kirim Cabang
  const [qtyMutasi, setQtyMutasi] = useState('');
  const [notesMutasi, setNotesMutasi] = useState('Dropping ke Pemalang');

  const MASTER_AYAM = 30; // 1 Adukan = 30 kg Ayam
  const MASTER_PCS = 1000; // 1 Adukan = 1000 Pcs Dimsum

  // LOGIC ERP PUSAT (OTOMATISASI REAL-TIME)
  const dashboardStok = useMemo(() => {
      // 1. Total Ayam Masuk (Dari Pembelian)
      const totalAyamBeli = (purchases || [])
        .filter(p => p.itemName.toUpperCase().includes('AYAM'))
        .reduce((sum, p) => sum + Number(p.qty), 0);

      // 2. Total Produksi (Adukan)
      const listProduksi = (stokData || []).filter(s => s.type === 'PRODUKSI').sort(safeSort);
      const totalAdukan = listProduksi.reduce((sum, s) => sum + Number(s.qty), 0);
      
      // 3. Kalkulasi Otomatis
      const ayamTerpakai = totalAdukan * MASTER_AYAM;
      const sisaAyam = totalAyamBeli - ayamTerpakai;
      
      const totalDimsumJadi = totalAdukan * MASTER_PCS;
      
      // 4. Pengeluaran Dimsum (Jual Pusat + Mutasi + Waste)
      const terjualPusat = (orders || []).filter(o => o.category !== 'Pemalang').reduce((sum, o) => sum + Number(o.qty), 0);
      const listMutasi = (stokData || []).filter(s => s.type === 'MUTASI_PEMALANG').sort(safeSort);
      const totalMutasi = listMutasi.reduce((sum, s) => sum + Number(s.qty), 0);
      const totalWaste = (stokData || []).filter(s => s.type === 'WASTE').reduce((sum, s) => sum + Number(s.qty), 0);

      const sisaDimsumReady = totalDimsumJadi - terjualPusat - totalMutasi - totalWaste;

      // Log Gabungan untuk Riwayat
      const logAktivitas = [...listProduksi, ...listMutasi].sort((a,b) => new Date(b.date) - new Date(a.date));

      return { totalAyamBeli, ayamTerpakai, sisaAyam, totalAdukan, totalDimsumJadi, terjualPusat, totalMutasi, sisaDimsumReady, logAktivitas };
  }, [stokData, purchases, orders]);

  const handleSimpanProduksi = (e) => {
      e.preventDefault();
      if(Number(adukan) <= 0) return;
      const newStok = {
          id: generateId('PRD', todayStr), date: todayStr,
          itemName: 'PRODUKSI ADUKAN', satuan: 'ADUKAN',
          type: 'PRODUKSI', qty: Number(adukan),
          notes: `Produksi ${waktuProd} (${adukan} Adukan). ${notesProd}`,
          editCount: 0
      };
      sendToSheet('insert', newStok, 'stok');
      setShowProduksi(false); setAdukan(''); setNotesProd('');
  };

  const handleSimpanMutasi = (e) => {
      e.preventDefault();
      if(Number(qtyMutasi) <= 0) return;
      if(Number(qtyMutasi) > dashboardStok.sisaDimsumReady) {
          alert("Gagal: Stok Dimsum Pusat tidak mencukupi untuk dikirim!"); return;
      }
      const newStok = {
          id: generateId('TRF', todayStr), date: todayStr,
          itemName: 'DIMSUM AYAM MIX', satuan: 'PCS',
          type: 'MUTASI_PEMALANG', qty: Number(qtyMutasi),
          notes: notesMutasi, editCount: 0
      };
      sendToSheet('insert', newStok, 'stok');
      setShowMutasi(false); setQtyMutasi('');
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
          <div>
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Package size={20}/> Produksi & Freezer Pusat</h3>
              <p className="text-xs text-slate-500">Sistem otomatis menghitung stok dari data Pembelian dan Penjualan.</p>
          </div>
          <div className="flex gap-2">
              <button onClick={() => { setShowMutasi(true); setShowProduksi(false); }} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm"><Truck size={16}/> Kirim ke Cabang</button>
              <button onClick={() => { setShowProduksi(true); setShowMutasi(false); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm"><Plus size={16}/> Input Produksi (Adukan)</button>
          </div>
      </div>

      {showProduksi && (
          <form onSubmit={handleSimpanProduksi} className="bg-blue-50 p-5 rounded-xl border border-blue-200 shadow-sm flex gap-3 items-end">
              <div className="w-1/4 space-y-1"><label className="text-xs font-bold text-blue-800 uppercase">Jumlah Adukan</label><input type="number" min="1" step="0.5" required value={adukan} onChange={e=>setAdukan(e.target.value)} className="w-full p-2 border rounded-lg font-bold text-lg" placeholder="Contoh: 5" /></div>
              <div className="w-1/4 space-y-1"><label className="text-xs font-bold text-blue-800 uppercase">Waktu</label><select value={waktuProd} onChange={e=>setWaktuProd(e.target.value)} className="w-full p-2 border rounded-lg font-bold h-11"><option>Pagi</option><option>Siang</option><option>Sore/Malam</option></select></div>
              <div className="w-2/4 space-y-1"><label className="text-xs font-bold text-blue-800 uppercase">Keterangan (Opsional)</label><div className="flex gap-2"><input type="text" value={notesProd} onChange={e=>setNotesProd(e.target.value)} className="w-full p-2 border rounded-lg h-11" placeholder="Nama pembuat dll" /><button type="submit" className="bg-blue-600 text-white px-6 rounded-lg font-bold whitespace-nowrap">Simpan</button><button type="button" onClick={()=>setShowProduksi(false)} className="bg-slate-200 text-slate-600 px-4 rounded-lg font-bold">Batal</button></div></div>
          </form>
      )}

      {showMutasi && (
          <form onSubmit={handleSimpanMutasi} className="bg-orange-50 p-5 rounded-xl border border-orange-200 shadow-sm flex gap-3 items-end">
              <div className="w-1/4 space-y-1"><label className="text-xs font-bold text-orange-800 uppercase">Kirim Berapa Pcs?</label><input type="number" min="1" required value={qtyMutasi} onChange={e=>setQtyMutasi(e.target.value)} className="w-full p-2 border rounded-lg font-bold text-lg" placeholder="Cth: 2000" /></div>
              <div className="w-3/4 space-y-1"><label className="text-xs font-bold text-orange-800 uppercase">Keterangan Pengiriman</label><div className="flex gap-2"><input type="text" required value={notesMutasi} onChange={e=>setNotesMutasi(e.target.value)} className="w-full p-2 border rounded-lg h-11" /><button type="submit" className="bg-orange-600 text-white px-6 rounded-lg font-bold whitespace-nowrap">Kirim Stok</button><button type="button" onClick={()=>setShowMutasi(false)} className="bg-slate-200 text-slate-600 px-4 rounded-lg font-bold">Batal</button></div></div>
          </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PANEL BAHAN BAKU (AYAM) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 p-3 border-b border-slate-200 font-bold text-slate-700 flex justify-between"><span>Bahan Baku Ayam (Filter Otomatis)</span><span>{MASTER_AYAM} Kg / Adukan</span></div>
              <div className="p-5 grid grid-cols-2 gap-4">
                  <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Dibeli (Masuk)</div>
                      <div className="text-xl font-bold">{dashboardStok.totalAyamBeli} <span className="text-sm text-slate-400">Kg</span></div>
                  </div>
                  <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Dimasak (Otomatis)</div>
                      <div className="text-xl font-bold text-orange-600">-{dashboardStok.ayamTerpakai} <span className="text-sm text-orange-400">Kg</span></div>
                  </div>
                  <div className="col-span-2 bg-slate-50 p-3 rounded-lg flex justify-between items-center border">
                      <span className="font-bold uppercase text-xs text-slate-600">Sisa Stok Ayam (Perkiraan)</span>
                      <span className={`text-2xl font-black ${dashboardStok.sisaAyam < 50 ? 'text-red-600' : 'text-emerald-600'}`}>{dashboardStok.sisaAyam} <span className="text-base font-medium">Kg</span></span>
                  </div>
              </div>
          </div>

          {/* PANEL BARANG JADI (DIMSUM) */}
          <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
              <div className="bg-blue-50 p-3 border-b border-blue-100 font-bold text-blue-800 flex justify-between"><span>Produksi Dimsum (Master Freezer)</span><span>{MASTER_PCS} Pcs / Adukan</span></div>
              <div className="p-5 grid grid-cols-3 gap-4">
                  <div className="col-span-3 flex justify-between items-end border-b border-dashed pb-3">
                      <div><div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Hasil Produksi</div><div className="text-xl font-bold text-blue-600">+{dashboardStok.totalDimsumJadi} <span className="text-sm text-blue-400">Pcs</span></div></div>
                      <div className="text-right text-xs font-bold text-blue-400">Dari {dashboardStok.totalAdukan} Adukan</div>
                  </div>
                  <div><div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Terjual (Pusat)</div><div className="text-lg font-bold text-slate-700">-{dashboardStok.terjualPusat} <span className="text-xs">Pcs</span></div></div>
                  <div><div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Mutasi Cabang</div><div className="text-lg font-bold text-orange-600">-{dashboardStok.totalMutasi} <span className="text-xs">Pcs</span></div></div>
                  <div><div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Sisa Ready Jual</div><div className={`text-2xl font-black ${dashboardStok.sisaDimsumReady < 1000 ? 'text-red-600' : 'text-emerald-600'}`}>{dashboardStok.sisaDimsumReady} <span className="text-xs">Pcs</span></div></div>
              </div>
          </div>
      </div>

      <div className="bg-white rounded-xl border mt-6 overflow-hidden">
        <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-sm">Riwayat Aktivitas Produksi & Mutasi</h4></div>
        <table className="w-full text-sm text-left block md:table">
          <thead className="bg-white text-slate-600 text-xs uppercase border-b"><tr><th className="px-4 py-3">Tanggal & ID</th><th className="px-4 py-3 text-center">Jenis Aktivitas</th><th className="px-4 py-3 text-right">Kuantitas</th><th className="px-4 py-3">Keterangan</th><th className="px-4 py-3 text-center">Aksi</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {dashboardStok.logAktivitas.length === 0 ? <tr><td colSpan="5" className="text-center py-8 text-slate-400">Belum ada riwayat produksi/mutasi.</td></tr> : dashboardStok.logAktivitas.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><div className="font-bold">{formatDate(s.date)}</div><div className="text-[10px] text-slate-400 font-mono">{s.id}</div></td>
                <td className="px-4 py-3 text-center">
                    {s.type === 'PRODUKSI' ? <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold">HASIL PRODUKSI</span> : <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-[10px] font-bold">KIRIM CABANG</span>}
                </td>
                <td className={`px-4 py-3 text-right font-black ${s.type === 'PRODUKSI' ? 'text-blue-600' : 'text-orange-600'}`}>
                    {s.type === 'PRODUKSI' ? `+${s.qty} Adukan` : `-${s.qty} Pcs`}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{s.notes}</td>
                <td className="px-4 py-3 text-center"><button onClick={() => requestDelete(s.id)} className="text-red-500 hover:text-red-700 p-2"><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
