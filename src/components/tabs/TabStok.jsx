import React, { useState, useMemo } from 'react';
import { Package, Plus, Trash2, Box, Server, Factory, Snowflake, TrendingUp, ArrowDownCircle, Truck, X } from 'lucide-react';
import { getTodayStr, generateId, formatDate, safeSort, getLocalYMD } from '../../utils/helpers';

export default function TabStok({ stokData, purchases, orders, sendToSheet, requestDelete, role }) {
  const todayStr = getTodayStr();
  
  // Modals / Forms
  const [showFormBahan, setShowFormBahan] = useState(false);
  const [showFormProd, setShowFormProd] = useState(false);
  const [showFormMutasi, setShowFormMutasi] = useState(false); // Khusus Pusat

  // Form Produksi
  const [adukan, setAdukan] = useState('');
  const [waktuProd, setWaktuProd] = useState('Pagi');
  const [notesProd, setNotesProd] = useState('');

  // Form Bahan Baku
  const [tipeBahan, setTipeBahan] = useState('MASUK');
  const [namaBahan, setNamaBahan] = useState('AYAM');
  const [qtyBahan, setQtyBahan] = useState('');
  const [satuanBahan, setSatuanBahan] = useState('KG');

  // Form Mutasi Pusat
  const [qtyMutasi, setQtyMutasi] = useState('');

  // KONSTANTA STANDAR PRODUKSI & KONVERSI
  const MASTER_AYAM_KG = 30; 
  const MASTER_PCS = 1000; 
  const KG_PER_KANTONG = 10; 
  const PCS_PER_MIKA = 50; 

  const formatAyam = (kg) => `${kg} Kg (${(kg / KG_PER_KANTONG).toFixed(1).replace('.0', '')} Kantong)`;
  const formatDimsum = (pcs) => `${pcs} Pcs (${(pcs / PCS_PER_MIKA).toFixed(1).replace('.0', '')} Mika)`;

  // ==========================================
  // ERP LOGIC: GUDANG -> PRODUKSI -> FREEZER
  // ==========================================
  const dash = useMemo(() => {
      const myBranch = role === 'admin' ? 'PUSAT' : 'PEMALANG';

      // 1. GUDANG BAHAN BAKU (MASUK & KELUAR)
      const bahanLog = (stokData || []).filter(s => s.type === 'BAHAN_BAKU' && s.branch === myBranch);
      const mutasiAyamDariPusat = (stokData || []).filter(s => s.type === 'MUTASI_AYAM_PEMALANG').reduce((sum, s) => sum + Number(s.qty), 0);
      const beliAyamPusat = role === 'admin' ? (purchases || []).filter(p => p.itemName.toUpperCase().includes('AYAM')).reduce((sum, p) => sum + Number(p.qty), 0) : 0;

      let masukAyamLokal = 0; let keluarAyamLokal = 0;
      const rekapBahanPendukung = {};

      bahanLog.forEach(b => {
          const q = Number(b.qty) || 0;
          if (b.itemName === 'AYAM') {
              if (b.action === 'MASUK') masukAyamLokal += q; else keluarAyamLokal += q;
          } else {
              if (!rekapBahanPendukung[b.itemName]) rekapBahanPendukung[b.itemName] = { qty: 0, satuan: b.satuan };
              if (b.action === 'MASUK') rekapBahanPendukung[b.itemName].qty += q; else rekapBahanPendukung[b.itemName].qty -= q;
          }
      });

      // Total Ayam Gudang
      let stokAyamAwal = 0;
      if (role === 'admin') {
          stokAyamAwal = beliAyamPusat + masukAyamLokal - keluarAyamLokal - mutasiAyamDariPusat; // Pusat kirim ke Pemalang
      } else {
          stokAyamAwal = mutasiAyamDariPusat + masukAyamLokal - keluarAyamLokal; // Pemalang terima dari Pusat
      }

      // 2. PEMAKAIAN PRODUKSI
      const myProdType = role === 'admin' ? 'PRODUKSI_PUSAT' : 'PRODUKSI_PEMALANG';
      const myProdLog = (stokData || []).filter(s => s.type === myProdType);
      const totalAdukanAll = myProdLog.reduce((sum, s) => sum + Number(s.qty), 0);
      const totalAyamTerpakai = totalAdukanAll * MASTER_AYAM_KG;
      
      const sisaAyamGudang = stokAyamAwal - totalAyamTerpakai; // POTONG OTOMATIS

      // 3. BARANG JADI & FREEZER
      const totalDimsumJadi = totalAdukanAll * MASTER_PCS;
      
      const myOrders = (orders || []).filter(o => role === 'admin' ? o.category !== 'Pemalang' : o.category === 'Pemalang');
      const terjualTotalPcs = myOrders.reduce((sum, o) => sum + Number(o.qty), 0);
      
      const sisaFreezer = totalDimsumJadi - terjualTotalPcs; // POTONG OTOMATIS

      // 4. MONITORING HARI INI
      const adukanHariIni = myProdLog.filter(s => getLocalYMD(s.date) === todayStr).reduce((sum, s) => sum + Number(s.qty), 0);
      const orderHariIniPcs = myOrders.filter(o => getLocalYMD(o.date) === todayStr).reduce((sum, o) => sum + Number(o.qty), 0);

      // 5. RIWAYAT GABUNGAN
      const myLog = [...bahanLog, ...myProdLog].sort((a,b) => new Date(b.date) - new Date(a.date));
      if (role === 'admin') myLog.push(...(stokData || []).filter(s => s.type === 'MUTASI_AYAM_PEMALANG'));

      return {
          stokAyamAwal, sisaAyamGudang, totalAyamTerpakai,
          rekapBahanPendukung,
          totalAdukanAll, totalDimsumJadi, 
          terjualTotalPcs, sisaFreezer,
          adukanHariIni, prodPcsHariIni: adukanHariIni * MASTER_PCS, prodMikaHariIni: (adukanHariIni * MASTER_PCS) / PCS_PER_MIKA,
          ayamTerpakaiHariIni: adukanHariIni * MASTER_AYAM_KG,
          orderHariIniPcs, orderHariIniMika: orderHariIniPcs / PCS_PER_MIKA,
          myLog
      };
  }, [stokData, purchases, orders, role, todayStr]);

  // HANDLERS
  const handleSimpanBahan = (e) => {
      e.preventDefault();
      if(Number(qtyBahan) <= 0) return;
      const myBranch = role === 'admin' ? 'PUSAT' : 'PEMALANG';
      sendToSheet('insert', {
          id: generateId('BHN', todayStr), date: todayStr, type: 'BAHAN_BAKU', branch: myBranch,
          action: tipeBahan, itemName: namaBahan.toUpperCase(), qty: Number(qtyBahan), satuan: satuanBahan.toUpperCase(),
          notes: `${tipeBahan} manual gudang.`, editCount: 0
      }, 'stok');
      setShowFormBahan(false); setQtyBahan('');
  };

  const handleSimpanProduksi = (e) => {
      e.preventDefault();
      if(Number(adukan) <= 0) return;
      const butuhAyam = Number(adukan) * MASTER_AYAM_KG;
      if(butuhAyam > dash.sisaAyamGudang) { 
          alert(`GAGAL: Stok Ayam di Gudang tidak mencukupi!\n\nKebutuhan: ${butuhAyam} Kg\nSisa Gudang: ${dash.sisaAyamGudang} Kg`); return; 
      }
      const typeProd = role === 'admin' ? 'PRODUKSI_PUSAT' : 'PRODUKSI_PEMALANG';
      sendToSheet('insert', {
          id: generateId('PRD', todayStr), date: todayStr, type: typeProd, itemName: 'ADUKAN DIMSUM', satuan: 'ADUKAN',
          qty: Number(adukan), notes: `Shift ${waktuProd}. Otomatis memotong ${butuhAyam} Kg Ayam. ${notesProd}`, editCount: 0
      }, 'stok');
      setShowFormProd(false); setAdukan(''); setNotesProd('');
  };

  const handleMutasiPusat = (e) => {
      e.preventDefault();
      if(Number(qtyMutasi) > dash.sisaAyamGudang) { alert(`Gagal: Stok Ayam Pusat kurang! Sisa: ${dash.sisaAyamGudang} Kg`); return; }
      sendToSheet('insert', {
          id: generateId('TRF-AYM', todayStr), date: todayStr, type: 'MUTASI_AYAM_PEMALANG', itemName: 'AYAM', satuan: 'KG',
          qty: Number(qtyMutasi), notes: 'Pengiriman ayam mentah ke Pemalang.', editCount: 0
      }, 'stok');
      setShowFormMutasi(false); setQtyMutasi('');
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* 1. SECTION MONITORING HARIAN (DASHBOARD REALTIME) */}
      <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-800">
          <div className="p-4 border-b border-slate-800/80 bg-slate-800/30 flex justify-between items-center">
              <h2 className="text-white font-bold flex items-center gap-2"><TrendingUp size={18} className="text-emerald-400"/> Monitoring Operasional Hari Ini ({formatDate(todayStr)})</h2>
              <div className="text-[10px] font-bold text-emerald-400 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> LIVE SINKRONISASI</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-800/60">
              <div className="p-4 text-center">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Adukan Selesai</div>
                  <div className="text-2xl font-black text-white">{dash.adukanHariIni} <span className="text-xs text-blue-400">Adk</span></div>
              </div>
              <div className="p-4 text-center">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Hasil Produksi (Mika)</div>
                  <div className="text-2xl font-black text-white">+{dash.prodMikaHariIni} <span className="text-xs text-emerald-400">Mika</span></div>
                  <div className="text-[9px] text-slate-500 mt-0.5">{dash.prodPcsHariIni} Pcs</div>
              </div>
              <div className="p-4 text-center">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Order Customer (Mika)</div>
                  <div className="text-2xl font-black text-white">-{dash.orderHariIniMika} <span className="text-xs text-orange-400">Mika</span></div>
                  <div className="text-[9px] text-slate-500 mt-0.5">{dash.orderHariIniPcs} Pcs</div>
              </div>
              <div className="p-4 text-center bg-slate-800/20">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Sisa Ayam Gudang</div>
                  <div className="text-2xl font-black text-white">{dash.sisaAyamGudang} <span className="text-xs text-emerald-400">Kg</span></div>
                  <div className="text-[9px] text-orange-400 font-bold mt-0.5">{(dash.sisaAyamGudang / KG_PER_KANTONG).toFixed(1).replace('.0','')} Kantong</div>
              </div>
              <div className="p-4 text-center bg-slate-800/20">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Sisa Dimsum Freezer</div>
                  <div className="text-2xl font-black text-white">{dash.sisaFreezer / PCS_PER_MIKA} <span className="text-xs text-emerald-400">Mika</span></div>
                  <div className="text-[9px] text-blue-400 font-bold mt-0.5">{dash.sisaFreezer} Pcs</div>
              </div>
          </div>
      </div>

      {/* BUTTONS ACTION */}
      <div className="flex flex-wrap gap-3">
          <button onClick={() => { setShowFormBahan(true); setShowFormProd(false); setShowFormMutasi(false); }} className="bg-slate-700 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow"><Box size={16}/> Input Gudang (Bahan Baku)</button>
          <button onClick={() => { setShowFormProd(true); setShowFormBahan(false); setShowFormMutasi(false); }} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow"><Factory size={16}/> Input Produksi (Adukan)</button>
          {role === 'admin' && <button onClick={() => { setShowFormMutasi(true); setShowFormBahan(false); setShowFormProd(false); }} className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow"><Truck size={16}/> Kirim Ayam (Ke Pemalang)</button>}
      </div>

      {/* FORM: BAHAN BAKU */}
      {showFormBahan && (
          <form onSubmit={handleSimpanBahan} className="bg-slate-100 p-6 rounded-xl border shadow-sm border-slate-300">
              <div className="flex justify-between items-center border-b pb-3 mb-4"><h3 className="font-bold text-slate-800 flex items-center gap-2"><ArrowDownCircle size={18}/> Form In/Out Gudang Bahan Baku</h3><button type="button" onClick={()=>setShowFormBahan(false)} className="hover:text-red-500"><X size={18}/></button></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-600 uppercase">Jenis Alur</label><select value={tipeBahan} onChange={e=>setTipeBahan(e.target.value)} className="w-full p-2 border rounded-lg font-bold"><option value="MASUK">BARANG MASUK (+)</option><option value="KELUAR">BARANG KELUAR (-)</option></select></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-600 uppercase">Nama Bahan</label><select value={namaBahan} onChange={e=>{ setNamaBahan(e.target.value); if(e.target.value==='AYAM')setSatuanBahan('KG'); else if(e.target.value==='MIKA')setSatuanBahan('PACK'); else setSatuanBahan('KG'); }} className="w-full p-2 border rounded-lg font-bold"><option>AYAM</option><option>MIKA</option><option>PLASTIK</option><option>TEPUNG</option><option>SAUS</option><option>BUMBU</option><option>LAINNYA</option></select></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-600 uppercase">Jumlah {tipeBahan}</label><input type="number" min="1" required value={qtyBahan} onChange={e=>setQtyBahan(e.target.value)} className="w-full p-2 border rounded-lg font-bold" /></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-600 uppercase">Satuan</label><div className="flex gap-2"><input type="text" required value={satuanBahan} onChange={e=>setSatuanBahan(e.target.value)} className="w-full p-2 border rounded-lg uppercase" /><button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white px-4 rounded-lg font-bold">Simpan</button></div></div>
              </div>
          </form>
      )}

      {/* FORM: PRODUKSI */}
      {showFormProd && (
          <form onSubmit={handleSimpanProduksi} className="bg-blue-50 p-6 rounded-xl border shadow-sm border-blue-200">
              <div className="flex justify-between items-center border-b border-blue-200 pb-3 mb-4"><h3 className="font-bold text-blue-900 flex items-center gap-2"><Factory size={18}/> Form Eksekusi Produksi (Masak)</h3><button type="button" onClick={()=>setShowFormProd(false)} className="text-blue-500 hover:text-red-500"><X size={18}/></button></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  <div className="space-y-1">
                      <label className="text-xs font-bold text-blue-800 uppercase">Input Total Adukan</label>
                      <input type="number" min="0.5" step="0.5" required value={adukan} onChange={e=>setAdukan(e.target.value)} className="w-full p-3 border border-blue-300 rounded-lg font-black text-xl text-blue-900" placeholder="0" />
                      <div className="text-[10px] bg-white p-2 rounded border text-slate-600 font-medium">
                          Otomatis Memotong: <strong className="text-orange-600">{adukan ? (adukan * MASTER_AYAM_KG) : 0} Kg Ayam</strong><br/>
                          Otomatis Menambah: <strong className="text-emerald-600">{adukan ? (adukan * MASTER_PCS) / PCS_PER_MIKA : 0} Mika Dimsum</strong>
                      </div>
                  </div>
                  <div className="space-y-1"><label className="text-xs font-bold text-blue-800 uppercase">Shift / Waktu</label><select value={waktuProd} onChange={e=>setWaktuProd(e.target.value)} className="w-full p-3 border border-blue-300 rounded-lg font-bold"><option>Pagi</option><option>Siang</option><option>Sore/Malam</option></select></div>
                  <div className="space-y-1 flex flex-col justify-between h-full">
                      <div><label className="text-xs font-bold text-blue-800 uppercase">Keterangan Opsional</label><input type="text" value={notesProd} onChange={e=>setNotesProd(e.target.value)} className="w-full p-3 border border-blue-300 rounded-lg" placeholder="Nama Koki, dll" /></div>
                      <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-bold shadow-md mt-2">Eksekusi Produksi Sekarang</button>
                  </div>
              </div>
          </form>
      )}

      {/* FORM: MUTASI (PUSAT) */}
      {showFormMutasi && role === 'admin' && (
          <form onSubmit={handleMutasiPusat} className="bg-orange-50 p-6 rounded-xl border shadow-sm border-orange-200">
              <div className="flex justify-between items-center border-b border-orange-200 pb-3 mb-4"><h3 className="font-bold text-orange-900 flex items-center gap-2"><Truck size={18}/> Kirim Stok Ayam Ke Pemalang</h3><button type="button" onClick={()=>setShowFormMutasi(false)} className="text-orange-500 hover:text-red-500"><X size={18}/></button></div>
              <div className="flex gap-4 items-end">
                  <div className="w-1/3 space-y-1"><label className="text-xs font-bold text-orange-800 uppercase">Total Ayam (Kg)</label><input type="number" min="1" required value={qtyMutasi} onChange={e=>setQtyMutasi(e.target.value)} className="w-full p-3 border border-orange-300 rounded-lg font-black text-xl" /></div>
                  <div className="w-2/3 flex gap-2"><button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-lg font-bold shadow-md">Kirim Ayam</button></div>
              </div>
          </form>
      )}

      {/* LAYOUT GRID BAWAH */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* SECTION 2: GUDANG BAHAN BAKU */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <div className="bg-slate-100 p-4 border-b border-slate-200"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Box size={18}/> Gudang Bahan Baku</h3><p className="text-[10px] text-slate-500 mt-0.5">Penyimpanan bahan mentah belum diolah.</p></div>
              <div className="p-5 flex-1">
                  <div className="border border-orange-200 bg-orange-50 rounded-lg p-4 mb-4 relative overflow-hidden">
                      <div className="text-xs font-bold text-orange-800 uppercase mb-1">Stok Utama: AYAM</div>
                      <div className="text-3xl font-black text-orange-600">{dash.sisaAyamGudang} <span className="text-base font-bold text-orange-400">Kg</span></div>
                      <div className="text-xs font-bold text-slate-600 mt-1">Setara: {(dash.sisaAyamGudang / KG_PER_KANTONG).toFixed(1).replace('.0','')} Kantong</div>
                  </div>
                  <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-2 border-b pb-1">Bahan Pendukung Lainnya</h4>
                  <div className="space-y-2">
                      {Object.keys(dash.rekapBahanPendukung).length === 0 ? <div className="text-xs text-slate-400 italic">Belum ada bahan pendukung.</div> : 
                      Object.keys(dash.rekapBahanPendukung).map(k => (
                          <div key={k} className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1">
                              <span className="text-xs font-bold text-slate-700">{k}</span>
                              <span className="text-xs font-black bg-slate-100 px-2 py-0.5 rounded">{dash.rekapBahanPendukung[k].qty} {dash.rekapBahanPendukung[k].satuan}</span>
                          </div>
                      ))}
                  </div>
              </div>
          </div>

          {/* SECTION 3: PRODUKSI & FLOW */}
          <div className="bg-white rounded-xl border border-blue-200 shadow-sm flex flex-col">
              <div className="bg-blue-50 p-4 border-b border-blue-100"><h3 className="font-bold text-blue-900 flex items-center gap-2"><Factory size={18}/> Dapur Produksi (All Time)</h3><p className="text-[10px] text-blue-600 mt-0.5">Mesin pengolah bahan baku menjadi barang jadi.</p></div>
              <div className="p-5 flex-1 flex flex-col justify-center">
                  <div className="flex justify-between items-center bg-white border border-slate-100 p-3 rounded-lg shadow-sm mb-3">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Ayam Terpakai (Otomatis)</div>
                      <div className="text-lg font-black text-orange-600">-{dash.totalAyamTerpakai} Kg</div>
                  </div>
                  <div className="flex justify-center py-2"><ArrowDownCircle className="text-blue-300" size={24}/></div>
                  <div className="text-center py-4 bg-blue-600 text-white rounded-xl shadow-inner my-2">
                      <div className="text-xs font-bold text-blue-200 uppercase mb-1">Total Eksekusi Produksi</div>
                      <div className="text-4xl font-black">{dash.totalAdukanAll} <span className="text-lg">Adukan</span></div>
                  </div>
                  <div className="flex justify-center py-2"><ArrowDownCircle className="text-blue-300" size={24}/></div>
                  <div className="flex justify-between items-center bg-white border border-slate-100 p-3 rounded-lg shadow-sm mt-3">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Dimsum Dihasilkan (Jadi)</div>
                      <div className="text-lg font-black text-blue-600">+{dash.totalDimsumJadi / PCS_PER_MIKA} Mika</div>
                  </div>
              </div>
          </div>

          {/* SECTION 4: FREEZER BARANG JADI */}
          <div className="bg-white rounded-xl border border-emerald-200 shadow-sm flex flex-col">
              <div className="bg-emerald-50 p-4 border-b border-emerald-100"><h3 className="font-bold text-emerald-900 flex items-center gap-2"><Snowflake size={18}/> Freezer Barang Jadi (Ready Jual)</h3><p className="text-[10px] text-emerald-600 mt-0.5">Penyimpanan dimsum siap jual. Terpotong oleh Order.</p></div>
              <div className="p-5 flex-1">
                  <div className="border border-emerald-300 bg-emerald-600 text-white rounded-lg p-5 mb-5 text-center shadow-md">
                      <div className="text-xs font-bold text-emerald-200 uppercase mb-1">Sisa Stok Freezer Realtime</div>
                      <div className="text-4xl font-black">{dash.sisaFreezer / PCS_PER_MIKA} <span className="text-lg font-bold text-emerald-300">Mika</span></div>
                      <div className="text-xs font-bold text-emerald-100 mt-1">Total {dash.sisaFreezer} Pcs ({dash.sisaFreezer / 4} Porsi)</div>
                  </div>
                  
                  <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-2 border-b pb-1">Alur Keluar Masuk Freezer (All Time)</h4>
                  <div className="space-y-3">
                      <div className="flex justify-between items-center bg-slate-50 p-2 rounded border">
                          <div><div className="text-[10px] font-bold text-slate-500 uppercase">Barang Masuk (Dari Produksi)</div></div>
                          <div className="text-sm font-black text-blue-600">+{dash.totalDimsumJadi / PCS_PER_MIKA} Mika</div>
                      </div>
                      <div className="flex justify-between items-center bg-slate-50 p-2 rounded border">
                          <div><div className="text-[10px] font-bold text-slate-500 uppercase">Barang Keluar (Order Customer)</div></div>
                          <div className="text-sm font-black text-red-600">-{dash.terjualTotalPcs / PCS_PER_MIKA} Mika</div>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* SECTION 5: TABEL RIWAYAT PERGERAKAN */}
      <div className="bg-white rounded-xl border mt-6 overflow-hidden">
        <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-sm text-slate-800">Riwayat Mutasi & Pergerakan Operasional</h4></div>
        <table className="w-full text-sm text-left block md:table">
          <thead className="bg-white text-slate-600 text-[10px] uppercase border-b"><tr><th className="px-4 py-3">Tanggal & ID</th><th className="px-4 py-3 text-center">Tipe Alur</th><th className="px-4 py-3">Barang / Deskripsi</th><th className="px-4 py-3 text-right">Kuantitas</th><th className="px-4 py-3 text-center">Aksi</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {dash.myLog.length === 0 ? <tr><td colSpan="5" className="text-center py-8 text-slate-400">Belum ada riwayat operasional.</td></tr> : dash.myLog.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><div className="font-bold">{formatDate(s.date)}</div><div className="text-[10px] text-slate-400 font-mono">{s.id}</div></td>
                <td className="px-4 py-3 text-center">
                    {s.type.includes('PRODUKSI') && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold border border-blue-200">EKSEKUSI PRODUKSI</span>}
                    {s.type.includes('MUTASI_AYAM') && <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-[10px] font-bold border border-orange-200">KIRIM AYAM KE CABANG</span>}
                    {s.type === 'BAHAN_BAKU' && <span className={`px-2 py-1 rounded text-[10px] font-bold border ${s.action === 'MASUK' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'}`}>GUDANG: BAHAN {s.action}</span>}
                </td>
                <td className="px-4 py-3 text-xs font-bold uppercase">{s.itemName} <div className="text-[10px] font-normal text-slate-500 capitalize">{s.notes}</div></td>
                <td className={`px-4 py-3 text-right font-black ${s.type.includes('PRODUKSI') ? 'text-blue-600' : (s.type === 'BAHAN_BAKU' && s.action === 'MASUK' ? 'text-emerald-600' : 'text-orange-600')}`}>
                    {s.type.includes('PRODUKSI') ? `+${s.qty} Adukan` : s.type === 'BAHAN_BAKU' ? `${s.action === 'MASUK' ? '+' : '-'}${s.qty} ${s.satuan}` : `-${s.qty} KG`}
                </td>
                <td className="px-4 py-3 text-center"><button onClick={() => requestDelete(s.id)} className="text-red-500 bg-red-50 p-2 rounded-lg border border-red-200 hover:bg-red-100 transition"><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
