import React, { useState, useMemo } from 'react';
import { Package, Plus, Trash2, ArrowRightCircle, AlertTriangle, Truck, Server } from 'lucide-react';
import { getTodayStr, generateId, formatDate, safeSort } from '../../utils/helpers';

export default function TabStok({ stokData, purchases, orders, sendToSheet, requestDelete, role }) {
  const todayStr = getTodayStr();
  const [showProduksi, setShowProduksi] = useState(false);
  const [showMutasi, setShowMutasi] = useState(false);

  // Form Produksi
  const [adukan, setAdukan] = useState('');
  const [waktuProd, setWaktuProd] = useState('Pagi');
  const [notesProd, setNotesProd] = useState('');

  // Form Mutasi Ayam (Pusat ke Cabang)
  const [qtyAyam, setQtyAyam] = useState('');
  const [notesMutasi, setNotesMutasi] = useState('Kirim Bahan Baku Ayam ke Pemalang');

  const MASTER_AYAM_KG = 30; // 1 Adukan = 30 kg Ayam
  const MASTER_PCS = 1000; // 1 Adukan = 1000 Pcs Dimsum
  const KG_PER_KANTONG = 10; // 1 Kantong = 10 Kg

  const formatAyam = (kg) => `${kg} Kg (${(kg / KG_PER_KANTONG).toFixed(1).replace('.0', '')} Kantong)`;

  // ==========================================
  // ERP LOGIC: PUSAT VS CABANG (PEMALANG)
  // ==========================================
  const dashboardStok = useMemo(() => {
      // 1. DATA BAHAN BAKU (AYAM) DARI PEMBELIAN PUSAT
      const totalAyamBeliPusat = (purchases || []).filter(p => p.itemName.toUpperCase().includes('AYAM')).reduce((sum, p) => sum + Number(p.qty), 0);
      
      // 2. DATA MUTASI AYAM (PUSAT -> PEMALANG)
      const listMutasiAyam = (stokData || []).filter(s => s.type === 'MUTASI_AYAM_PEMALANG').sort(safeSort);
      const ayamDikirimKePemalang = listMutasiAyam.reduce((sum, s) => sum + Number(s.qty), 0);

      // 3. DATA PRODUKSI PUSAT VS PEMALANG
      const prodPusat = (stokData || []).filter(s => s.type === 'PRODUKSI_PUSAT').sort(safeSort);
      const prodPemalang = (stokData || []).filter(s => s.type === 'PRODUKSI_PEMALANG').sort(safeSort);
      
      const adukanPusat = prodPusat.reduce((sum, s) => sum + Number(s.qty), 0);
      const adukanPemalang = prodPemalang.reduce((sum, s) => sum + Number(s.qty), 0);

      const ayamTerpakaiPusat = adukanPusat * MASTER_AYAM_KG;
      const ayamTerpakaiPemalang = adukanPemalang * MASTER_AYAM_KG;

      // 4. SISA BAHAN BAKU AKTUAL
      const sisaAyamPusat = totalAyamBeliPusat - ayamDikirimKePemalang - ayamTerpakaiPusat;
      const sisaAyamPemalang = ayamDikirimKePemalang - ayamTerpakaiPemalang; 

      // 5. DATA BARANG JADI (DIMSUM)
      const dimsumJadiPusat = adukanPusat * MASTER_PCS;
      const dimsumJadiPemalang = adukanPemalang * MASTER_PCS;

      // 6. PENJUALAN (ORDER)
      const terjualPusat = (orders || []).filter(o => o.category !== 'Pemalang').reduce((sum, o) => sum + Number(o.qty), 0);
      const terjualPemalang = (orders || []).filter(o => o.category === 'Pemalang').reduce((sum, o) => sum + Number(o.qty), 0);

      // 7. SISA FREEZER AKTUAL
      const sisaFreezerPusat = dimsumJadiPusat - terjualPusat;
      const sisaFreezerPemalang = dimsumJadiPemalang - terjualPemalang;

      return { 
          totalAyamBeliPusat, ayamDikirimKePemalang, sisaAyamPusat, sisaAyamPemalang, 
          adukanPusat, adukanPemalang, ayamTerpakaiPusat, ayamTerpakaiPemalang,
          dimsumJadiPusat, dimsumJadiPemalang, terjualPusat, terjualPemalang, 
          sisaFreezerPusat, sisaFreezerPemalang,
          logMutasi: listMutasiAyam, logProdPusat: prodPusat, logProdPemalang: prodPemalang
      };
  }, [stokData, purchases, orders]);

  // Log tabel menyesuaikan role
  const displayLog = role === 'admin' 
    ? [...dashboardStok.logMutasi, ...dashboardStok.logProdPusat].sort((a,b) => new Date(b.date) - new Date(a.date))
    : [...dashboardStok.logProdPemalang].sort((a,b) => new Date(b.date) - new Date(a.date));

  const handleSimpanProduksi = (e) => {
      e.preventDefault();
      if(Number(adukan) <= 0) return;
      
      const stokAyamTersedia = role === 'admin' ? dashboardStok.sisaAyamPusat : dashboardStok.sisaAyamPemalang;
      const butuhAyam = Number(adukan) * MASTER_AYAM_KG;
      
      if(butuhAyam > stokAyamTersedia) {
          alert(`Gagal: Stok Ayam ${role === 'admin' ? 'Pusat' : 'Pemalang'} tidak cukup!\n\nButuh: ${formatAyam(butuhAyam)}\nSisa Sistem: ${formatAyam(stokAyamTersedia)}`);
          return;
      }

      const typeProd = role === 'admin' ? 'PRODUKSI_PUSAT' : 'PRODUKSI_PEMALANG';
      const newStok = {
          id: generateId('PRD', todayStr), date: todayStr,
          itemName: 'PRODUKSI ADUKAN', satuan: 'ADUKAN',
          type: typeProd, qty: Number(adukan),
          notes: `Produksi ${waktuProd} (${adukan} Adukan). Memotong ${formatAyam(butuhAyam)}. ${notesProd}`,
          editCount: 0
      };
      sendToSheet('insert', newStok, 'stok');
      setShowProduksi(false); setAdukan(''); setNotesProd('');
  };

  const handleSimpanMutasiAyam = (e) => {
      e.preventDefault();
      if(Number(qtyAyam) <= 0) return;
      if(Number(qtyAyam) > dashboardStok.sisaAyamPusat) {
          alert(`Gagal: Stok Ayam Pusat tidak mencukupi untuk dikirim!\nSisa Sistem: ${formatAyam(dashboardStok.sisaAyamPusat)}`); return;
      }
      const newStok = {
          id: generateId('TRF-AYM', todayStr), date: todayStr,
          itemName: 'BAHAN BAKU AYAM', satuan: 'KG',
          type: 'MUTASI_AYAM_PEMALANG', qty: Number(qtyAyam),
          notes: notesMutasi, editCount: 0
      };
      sendToSheet('insert', newStok, 'stok');
      setShowMutasi(false); setQtyAyam('');
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
          <div>
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Server size={20}/> Mesin Produksi & Stok {role === 'admin' ? '(Pusat)' : '(Pemalang)'}</h3>
              <p className="text-xs text-slate-500">1 Adukan = 30 Kg (3 Kantong) Ayam = 1000 Pcs Dimsum.</p>
          </div>
          <div className="flex gap-2">
              {role === 'admin' && <button onClick={() => { setShowMutasi(true); setShowProduksi(false); }} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm"><Truck size={16}/> Kirim Ayam ke Pemalang</button>}
              <button onClick={() => { setShowProduksi(true); setShowMutasi(false); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm"><Plus size={16}/> Input Produksi (Adukan)</button>
          </div>
      </div>

      {showProduksi && (
          <form onSubmit={handleSimpanProduksi} className="bg-blue-50 p-5 rounded-xl border border-blue-200 shadow-sm flex gap-3 items-end">
              <div className="w-1/4 space-y-1"><label className="text-xs font-bold text-blue-800 uppercase">Jumlah Adukan</label><input type="number" min="1" step="0.5" required value={adukan} onChange={e=>setAdukan(e.target.value)} className="w-full p-2 border rounded-lg font-bold text-lg" placeholder="Contoh: 5" /><div className="text-[10px] font-bold text-blue-600 mt-1">Akan memotong: {adukan ? formatAyam(adukan * MASTER_AYAM_KG) : '0 Kg'}</div></div>
              <div className="w-1/4 space-y-1 pb-5"><label className="text-xs font-bold text-blue-800 uppercase">Waktu</label><select value={waktuProd} onChange={e=>setWaktuProd(e.target.value)} className="w-full p-2 border rounded-lg font-bold h-11"><option>Pagi</option><option>Siang</option><option>Sore/Malam</option></select></div>
              <div className="w-2/4 space-y-1 pb-5"><label className="text-xs font-bold text-blue-800 uppercase">Keterangan (Opsional)</label><div className="flex gap-2"><input type="text" value={notesProd} onChange={e=>setNotesProd(e.target.value)} className="w-full p-2 border rounded-lg h-11" placeholder="Nama pembuat dll" /><button type="submit" className="bg-blue-600 text-white px-6 rounded-lg font-bold whitespace-nowrap">Simpan Produksi</button><button type="button" onClick={()=>setShowProduksi(false)} className="bg-slate-200 text-slate-600 px-4 rounded-lg font-bold">Batal</button></div></div>
          </form>
      )}

      {showMutasi && role === 'admin' && (
          <form onSubmit={handleSimpanMutasiAyam} className="bg-orange-50 p-5 rounded-xl border border-orange-200 shadow-sm flex gap-3 items-end">
              <div className="w-1/4 space-y-1"><label className="text-xs font-bold text-orange-800 uppercase">Kirim Ayam (Kg)</label><input type="number" min="1" required value={qtyAyam} onChange={e=>setQtyAyam(e.target.value)} className="w-full p-2 border rounded-lg font-bold text-lg" placeholder="Cth: 200" /><div className="text-[10px] font-bold text-orange-600 mt-1">Setara: {qtyAyam ? (qtyAyam / KG_PER_KANTONG).toFixed(1).replace('.0','') : 0} Kantong</div></div>
              <div className="w-3/4 space-y-1 pb-5"><label className="text-xs font-bold text-orange-800 uppercase">Keterangan Pengiriman</label><div className="flex gap-2"><input type="text" required value={notesMutasi} onChange={e=>setNotesMutasi(e.target.value)} className="w-full p-2 border rounded-lg h-11" /><button type="submit" className="bg-orange-600 text-white px-6 rounded-lg font-bold whitespace-nowrap">Kirim Bahan</button><button type="button" onClick={()=>setShowMutasi(false)} className="bg-slate-200 text-slate-600 px-4 rounded-lg font-bold">Batal</button></div></div>
          </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PANEL BAHAN BAKU (AYAM) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 p-3 border-b border-slate-200 font-bold text-slate-700 flex justify-between"><span>Gudang Bahan Baku (Ayam)</span><span>{MASTER_AYAM_KG} Kg (3 Kantong) / Adukan</span></div>
              <div className="p-5 grid grid-cols-2 gap-4">
                  {role === 'admin' ? (
                      <>
                        <div><div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Pembelian Pusat</div><div className="text-xl font-bold">{formatAyam(dashboardStok.totalAyamBeliPusat)}</div></div>
                        <div><div className="text-[10px] uppercase font-bold text-orange-500 mb-1">Dikirim ke Cabang Pemalang</div><div className="text-xl font-bold text-orange-600">-{formatAyam(dashboardStok.ayamDikirimKePemalang)}</div></div>
                        <div className="col-span-2 border-t border-dashed pt-3"><div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Dipakai Produksi Pusat ({dashboardStok.adukanPusat} Adukan)</div><div className="text-xl font-bold text-slate-600">-{formatAyam(dashboardStok.ayamTerpakaiPusat)}</div></div>
                      </>
                  ) : (
                      <>
                        <div><div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Suplai dari Pusat (Akumulasi)</div><div className="text-xl font-bold text-blue-600">+{formatAyam(dashboardStok.ayamDikirimKePemalang)}</div></div>
                        <div><div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Dipakai Produksi ({dashboardStok.adukanPemalang} Adukan)</div><div className="text-xl font-bold text-orange-600">-{formatAyam(dashboardStok.ayamTerpakaiPemalang)}</div></div>
                      </>
                  )}
                  <div className={`col-span-2 p-3 rounded-lg flex justify-between items-center border ${role === 'admin' ? (dashboardStok.sisaAyamPusat <= 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50') : (dashboardStok.sisaAyamPemalang <= 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50')}`}>
                      <span className="font-bold uppercase text-xs text-slate-600">Sisa Ayam Ready</span>
                      <span className={`text-xl font-black ${role === 'admin' ? (dashboardStok.sisaAyamPusat <= 0 ? 'text-red-600' : 'text-emerald-600') : (dashboardStok.sisaAyamPemalang <= 0 ? 'text-red-600' : 'text-emerald-600')}`}>
                          {role === 'admin' ? formatAyam(dashboardStok.sisaAyamPusat) : formatAyam(dashboardStok.sisaAyamPemalang)}
                      </span>
                  </div>
              </div>
          </div>

          {/* PANEL BARANG JADI (DIMSUM) */}
          <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
              <div className="bg-blue-50 p-3 border-b border-blue-100 font-bold text-blue-800 flex justify-between"><span>Kapasitas Freezer (Dimsum Jadi)</span><span>{MASTER_PCS} Pcs / Adukan</span></div>
              <div className="p-5 grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex justify-between items-end border-b border-dashed pb-3">
                      <div><div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Hasil Produksi Dimsum</div><div className="text-xl font-bold text-blue-600">+{role === 'admin' ? dashboardStok.dimsumJadiPusat : dashboardStok.dimsumJadiPemalang} <span className="text-sm text-blue-400">Pcs</span></div></div>
                      <div className="text-right text-xs font-bold text-blue-400">Dari {role === 'admin' ? dashboardStok.adukanPusat : dashboardStok.adukanPemalang} Adukan</div>
                  </div>
                  <div className="col-span-2"><div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Terjual & Keluar</div><div className="text-lg font-bold text-slate-700">-{role === 'admin' ? dashboardStok.terjualPusat : dashboardStok.terjualPemalang} <span className="text-xs">Pcs</span></div></div>
                  <div className={`col-span-2 p-3 rounded-lg flex justify-between items-center border ${role === 'admin' ? (dashboardStok.sisaFreezerPusat <= 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50') : (dashboardStok.sisaFreezerPemalang <= 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50')}`}>
                      <span className="font-bold uppercase text-xs text-slate-600">Isi Freezer Aktual (Tersedia)</span>
                      <span className={`text-2xl font-black ${role === 'admin' ? (dashboardStok.sisaFreezerPusat <= 0 ? 'text-red-600' : 'text-emerald-600') : (dashboardStok.sisaFreezerPemalang <= 0 ? 'text-red-600' : 'text-emerald-600')}`}>
                          {role === 'admin' ? dashboardStok.sisaFreezerPusat : dashboardStok.sisaFreezerPemalang} <span className="text-base font-medium">Pcs</span>
                      </span>
                  </div>
              </div>
          </div>
      </div>

      <div className="bg-white rounded-xl border mt-6 overflow-hidden">
        <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-sm">Riwayat Mutasi Bahan & Produksi</h4></div>
        <table className="w-full text-sm text-left block md:table">
          <thead className="bg-white text-slate-600 text-xs uppercase border-b"><tr><th className="px-4 py-3">Tanggal & ID</th><th className="px-4 py-3 text-center">Jenis Aktivitas</th><th className="px-4 py-3 text-right">Kuantitas</th><th className="px-4 py-3">Keterangan</th><th className="px-4 py-3 text-center">Aksi</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {displayLog.length === 0 ? <tr><td colSpan="5" className="text-center py-8 text-slate-400">Belum ada riwayat aktivitas.</td></tr> : displayLog.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><div className="font-bold">{formatDate(s.date)}</div><div className="text-[10px] text-slate-400 font-mono">{s.id}</div></td>
                <td className="px-4 py-3 text-center">
                    {s.type.includes('PRODUKSI') ? <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold">HASIL PRODUKSI</span> : <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-[10px] font-bold">KIRIM AYAM (B.BAKU)</span>}
                </td>
                <td className={`px-4 py-3 text-right font-black ${s.type.includes('PRODUKSI') ? 'text-blue-600' : 'text-orange-600'}`}>
                    {s.type.includes('PRODUKSI') ? `+${s.qty} Adukan` : formatAyam(s.qty)}
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
