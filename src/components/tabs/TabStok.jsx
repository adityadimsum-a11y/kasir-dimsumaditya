import React, { useState, useMemo } from 'react';
import { Package, Plus, Trash2, Box, Server, Factory, Snowflake, TrendingUp, ArrowDownCircle, Truck, X, Printer, Edit, CheckCircle } from 'lucide-react';
import { getTodayStr, generateId, formatDate, safeSort, getLocalYMD } from '../../utils/helpers';

export default function TabStok({ stokData, purchases, orders, sendToSheet, requestDelete, setPrintData, role }) {
  const todayStr = getTodayStr();
  
  // Modals / Forms
  const [showFormBahan, setShowFormBahan] = useState(false);
  const [showFormProd, setShowFormProd] = useState(false);
  const [showFormMutasi, setShowFormMutasi] = useState(false);

  // Edit State
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);

  // Form Gudang Bahan Baku (Multiple Items)
  const [tipeBahan, setTipeBahan] = useState('MASUK');
  const [notesBahan, setNotesBahan] = useState('');
  const [bahanCart, setBahanCart] = useState([{ itemName: '', qty: '', satuan: 'PACK' }]);

  // Form Produksi (Adukan + Bahan Tambahan)
  const [adukan, setAdukan] = useState('');
  const [waktuProd, setWaktuProd] = useState('Pagi');
  const [notesProd, setNotesProd] = useState('');
  const [bahanProdCart, setBahanProdCart] = useState([]);

  // Form Mutasi Pusat
  const [qtyMutasi, setQtyMutasi] = useState('');

  // KONSTANTA STANDAR PRODUKSI & KONVERSI
  const MASTER_AYAM_KG = 30; 
  const MASTER_PCS = 1000; 
  const KG_PER_KANTONG = 10; 
  const PCS_PER_MIKA = 50; 

  const formatAyam = (kg) => `${kg} Kg (${(kg / KG_PER_KANTONG).toFixed(1).replace('.0', '')} Kantong)`;
  const formatDimsum = (pcs) => `${pcs} Pcs (${(pcs / PCS_PER_MIKA).toFixed(1).replace('.0', '')} Mika)`;

  // GABUNGAN DROPDOWN: Default System + Riwayat Unik Database
  const DEFAULT_BAHAN = ['BUMBU', 'DAUN BAWANG', 'GULA', 'MINYAK WIJEN', 'MIKA', 'PLASTIK', 'SAUS', 'TEPUNG', 'AYAM (TAMBAHAN)'];
  const listBahanUnik = [...new Set([
      ...DEFAULT_BAHAN, 
      ...(stokData||[]).filter(s => s.type === 'BAHAN_BAKU').map(s => String(s.itemName).toUpperCase())
  ])].sort();

  // ==========================================
  // ERP LOGIC: GUDANG -> PRODUKSI -> FREEZER
  // ==========================================
  const dash = useMemo(() => {
      const myBranch = role === 'admin' ? 'PUSAT' : 'PEMALANG';

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

      let stokAyamAwal = role === 'admin' 
          ? beliAyamPusat + masukAyamLokal - keluarAyamLokal - mutasiAyamDariPusat 
          : mutasiAyamDariPusat + masukAyamLokal - keluarAyamLokal;

      const myProdType = role === 'admin' ? 'PRODUKSI_PUSAT' : 'PRODUKSI_PEMALANG';
      const myProdLog = (stokData || []).filter(s => s.type === myProdType);
      
      const totalAdukanAll = myProdLog.reduce((sum, s) => sum + Number(s.qty), 0);
      const totalAyamTerpakai = totalAdukanAll * MASTER_AYAM_KG;
      const sisaAyamGudang = stokAyamAwal - totalAyamTerpakai; 

      const totalDimsumJadi = totalAdukanAll * MASTER_PCS;
      const myOrders = (orders || []).filter(o => role === 'admin' ? o.category !== 'Pemalang' : o.category === 'Pemalang');
      const terjualTotalPcs = myOrders.reduce((sum, o) => sum + Number(o.qty), 0);
      const sisaFreezer = totalDimsumJadi - terjualTotalPcs; 

      const adukanHariIni = myProdLog.filter(s => getLocalYMD(s.date) === todayStr).reduce((sum, s) => sum + Number(s.qty), 0);
      const orderHariIniPcs = myOrders.filter(o => getLocalYMD(o.date) === todayStr).reduce((sum, o) => sum + Number(o.qty), 0);

      const myLog = [...bahanLog, ...myProdLog].sort((a,b) => new Date(b.date) - new Date(a.date));
      if (role === 'admin') myLog.push(...(stokData || []).filter(s => s.type === 'MUTASI_AYAM_PEMALANG'));

      const groupedLogMap = {};
      myLog.forEach(s => {
          if (!groupedLogMap[s.id]) {
              groupedLogMap[s.id] = { id: s.id, date: s.date, type: s.type, action: s.action, notes: s.notes, items: [], branch: s.branch };
          }
          if (s.type.includes('PRODUKSI')) {
              groupedLogMap[s.id].type = s.type;
              groupedLogMap[s.id].adukanQty = s.qty;
          }
          groupedLogMap[s.id].items.push(s);
      });
      const displayLogGrouped = Object.values(groupedLogMap).sort((a,b) => new Date(b.date) - new Date(a.date));

      return {
          stokAyamAwal, sisaAyamGudang, totalAyamTerpakai, rekapBahanPendukung,
          totalAdukanAll, totalDimsumJadi, terjualTotalPcs, sisaFreezer,
          adukanHariIni, prodPcsHariIni: adukanHariIni * MASTER_PCS, prodMikaHariIni: (adukanHariIni * MASTER_PCS) / PCS_PER_MIKA,
          ayamTerpakaiHariIni: adukanHariIni * MASTER_AYAM_KG, orderHariIniPcs, orderHariIniMika: orderHariIniPcs / PCS_PER_MIKA,
          displayLogGrouped
      };
  }, [stokData, purchases, orders, role, todayStr]);

  // RESET FORMS
  const closeAllForms = () => {
      setShowFormBahan(false); setShowFormProd(false); setShowFormMutasi(false);
      setIsEdit(false); setEditId(null);
      setAdukan(''); setNotesProd(''); setBahanProdCart([]);
      setNotesBahan(''); setBahanCart([{ itemName: '', qty: '', satuan: 'PACK' }]);
      setQtyMutasi('');
  };

  const handleEdit = (g) => {
      setIsEdit(true); setEditId(g.id);
      if (g.type.includes('PRODUKSI')) {
          setAdukan(g.adukanQty); setNotesProd(g.notes.replace(/Shift (Pagi|Siang|Sore\/Malam)\. /, ''));
          const wMatch = g.notes.match(/Shift (Pagi|Siang|Sore\/Malam)/);
          if(wMatch) setWaktuProd(wMatch[1]);
          setBahanProdCart(g.items.filter(i => i.type === 'BAHAN_BAKU').map(i => ({ itemName: i.itemName, qty: i.qty, satuan: i.satuan })));
          setShowFormProd(true); setShowFormBahan(false); setShowFormMutasi(false);
      } else if (g.type === 'BAHAN_BAKU') {
          setTipeBahan(g.action); setNotesBahan(g.notes);
          setBahanCart(g.items.map(i => ({ itemName: i.itemName, qty: i.qty, satuan: i.satuan })));
          setShowFormBahan(true); setShowFormProd(false); setShowFormMutasi(false);
      } else if (g.type.includes('MUTASI')) {
          setQtyMutasi(g.items[0]?.qty || '');
          setShowFormMutasi(true); setShowFormBahan(false); setShowFormProd(false);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateBahanCart = (index, field, value) => { const newCart = [...bahanCart]; newCart[index][field] = value; setBahanCart(newCart); };
  const addBahanRow = () => setBahanCart([...bahanCart, { itemName: '', qty: '', satuan: 'PACK' }]);
  const removeBahanRow = (index) => setBahanCart(bahanCart.filter((_, i) => i !== index));

  const updateProdCart = (index, field, value) => { const newCart = [...bahanProdCart]; newCart[index][field] = value; setBahanProdCart(newCart); };
  const addProdRow = () => setBahanProdCart([...bahanProdCart, { itemName: '', qty: '', satuan: 'PACK' }]);
  const removeProdRow = (index) => setBahanProdCart(bahanProdCart.filter((_, i) => i !== index));

  const handleSimpanBahan = (e) => {
      e.preventDefault();
      if(isEdit) sendToSheet('delete', { id: editId }, 'stok');
      
      const myBranch = role === 'admin' ? 'PUSAT' : 'PEMALANG';
      const transId = isEdit ? editId : generateId(tipeBahan === 'MASUK' ? 'B-IN' : 'B-OUT', todayStr);
      const dataToInsert = bahanCart.filter(c => c.itemName && Number(c.qty) > 0).map(c => ({
          id: transId, date: todayStr, type: 'BAHAN_BAKU', branch: myBranch, action: tipeBahan,
          itemName: c.itemName.toUpperCase(), qty: Number(c.qty), satuan: c.satuan.toUpperCase(),
          notes: notesBahan || `Input ${tipeBahan} manual gudang.`, editCount: 0
      }));
      if(dataToInsert.length > 0) sendToSheet('insert', dataToInsert, 'stok');
      closeAllForms();
  };

  const handleSimpanProduksi = (e) => {
      e.preventDefault();
      if(Number(adukan) <= 0) return;
      
      const butuhAyam = Number(adukan) * MASTER_AYAM_KG;
      if(!isEdit && butuhAyam > dash.sisaAyamGudang) { 
          alert(`GAGAL: Stok Ayam di Gudang tidak mencukupi!\nKebutuhan: ${butuhAyam} Kg\nSisa: ${dash.sisaAyamGudang} Kg`); return; 
      }
      
      if(isEdit) sendToSheet('delete', { id: editId }, 'stok');

      const myBranch = role === 'admin' ? 'PUSAT' : 'PEMALANG';
      const typeProd = role === 'admin' ? 'PRODUKSI_PUSAT' : 'PRODUKSI_PEMALANG';
      const transId = isEdit ? editId : generateId('PRD', todayStr);

      const dataToInsert = [{
          id: transId, date: todayStr, type: typeProd, branch: myBranch, itemName: 'ADUKAN DIMSUM', satuan: 'ADUKAN',
          qty: Number(adukan), notes: `Shift ${waktuProd}. ${notesProd}`, editCount: 0
      }];

      bahanProdCart.filter(c => c.itemName && Number(c.qty) > 0).forEach(c => {
          dataToInsert.push({
              id: transId, date: todayStr, type: 'BAHAN_BAKU', branch: myBranch, action: 'KELUAR',
              itemName: c.itemName.toUpperCase(), qty: Number(c.qty), satuan: c.satuan.toUpperCase(),
              notes: `Bahan terpakai untuk Produksi ID: ${transId}`, editCount: 0
          });
      });

      sendToSheet('insert', dataToInsert, 'stok');
      closeAllForms();
  };

  const handleMutasiPusat = (e) => {
      e.preventDefault();
      if(!isEdit && Number(qtyMutasi) > dash.sisaAyamGudang) { alert(`Gagal: Stok Ayam Pusat kurang! Sisa: ${dash.sisaAyamGudang} Kg`); return; }
      
      if(isEdit) sendToSheet('delete', { id: editId }, 'stok');
      sendToSheet('insert', {
          id: isEdit ? editId : generateId('TRF-AYM', todayStr), date: todayStr, type: 'MUTASI_AYAM_PEMALANG', itemName: 'AYAM', satuan: 'KG',
          qty: Number(qtyMutasi), notes: 'Pengiriman ayam mentah ke Pemalang.', editCount: 0
      }, 'stok');
      closeAllForms();
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      {/* Suggestion untuk form Input Gudang (tetap datalist) */}
      <datalist id="bahan-list">{listBahanUnik.map(b => <option key={b} value={b} />)}</datalist>

      {/* SECTION 1: MONITORING OPERASIONAL (DASHBOARD REALTIME) */}
      <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-800">
          <div className="p-4 border-b border-slate-800/80 bg-slate-800/30 flex justify-between items-center">
              <h2 className="text-white font-bold flex items-center gap-2"><TrendingUp size={18} className="text-emerald-400"/> Monitoring Operasional Hari Ini ({formatDate(todayStr)})</h2>
              <div className="text-[10px] font-bold text-emerald-400 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> SINKRONISASI OTOMATIS</div>
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
          <button onClick={() => { closeAllForms(); setShowFormBahan(true); }} className="bg-slate-700 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow"><Box size={16}/> Gudang: Keluar / Masuk</button>
          <button onClick={() => { closeAllForms(); setShowFormProd(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow"><Factory size={16}/> Produksi: Eksekusi Adukan</button>
          {role === 'admin' && <button onClick={() => { closeAllForms(); setShowFormMutasi(true); }} className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow"><Truck size={16}/> Kirim Ayam (Ke Pemalang)</button>}
      </div>

      {/* FORM: GUDANG BAHAN BAKU MULTIPLE ITEMS (TETAP PAKAI INPUT BEBAS / DATALIST) */}
      {showFormBahan && (
          <form onSubmit={handleSimpanBahan} className="bg-slate-100 p-6 rounded-xl border shadow-sm border-slate-300">
              <div className="flex justify-between items-center border-b border-slate-300 pb-3 mb-4"><h3 className="font-bold text-slate-800 flex items-center gap-2"><ArrowDownCircle size={18}/> Form {isEdit?'Edit ':''}Gudang Bahan Baku</h3><button type="button" onClick={closeAllForms} className="hover:text-red-500"><X size={18}/></button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-600 uppercase">Jenis Alur Transaksi</label><select value={tipeBahan} onChange={e=>setTipeBahan(e.target.value)} className="w-full p-2 border rounded-lg font-bold bg-white"><option value="MASUK">BARANG MASUK (+)</option><option value="KELUAR">BARANG KELUAR / TERBUANG (-)</option></select></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-600 uppercase">Keterangan Nota</label><input type="text" value={notesBahan} onChange={e=>setNotesBahan(e.target.value)} className="w-full p-2 border rounded-lg bg-white" placeholder="Cth: Suplai Budi" /></div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-slate-200">
                  <div className="flex justify-between items-center mb-3"><h4 className="font-bold text-sm text-slate-700">Daftar Barang</h4><button type="button" onClick={addBahanRow} className="bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 border rounded">+ Tambah Baris</button></div>
                  <div className="space-y-2">
                      {bahanCart.map((item, index) => (
                          <div key={index} className="flex gap-2 items-center relative pr-8">
                              <div className="w-5/12"><input type="text" list="bahan-list" required placeholder="Nama Bahan (Cth: AYAM)" value={item.itemName} onChange={e=>updateBahanCart(index, 'itemName', e.target.value)} className="w-full p-2 border rounded text-xs uppercase font-bold" /></div>
                              <div className="w-3/12"><input type="number" min="1" required placeholder="Qty" value={item.qty} onChange={e=>updateBahanCart(index, 'qty', e.target.value)} className="w-full p-2 border rounded text-xs font-bold text-center" /></div>
                              <div className="w-4/12"><input type="text" required placeholder="Satuan" value={item.satuan} onChange={e=>updateBahanCart(index, 'satuan', e.target.value)} className="w-full p-2 border rounded text-xs uppercase" /></div>
                              {bahanCart.length > 1 && <button type="button" onClick={()=>removeBahanRow(index)} className="absolute right-1 top-2.5 text-red-400 hover:text-red-600"><Trash2 size={16}/></button>}
                          </div>
                      ))}
                  </div>
              </div>
              <div className="mt-4 flex justify-end"><button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white px-8 py-2.5 rounded-lg font-bold shadow-md">Simpan {isEdit?'Perubahan':'Transaksi Gudang'}</button></div>
          </form>
      )}

      {/* FORM: PRODUKSI & PEMAKAIAN BAHAN (MENGGUNAKAN DROPDOWN KHUSUS) */}
      {showFormProd && (
          <form onSubmit={handleSimpanProduksi} className="bg-blue-50 p-6 rounded-xl border shadow-sm border-blue-200">
              <div className="flex justify-between items-center border-b border-blue-200 pb-3 mb-4"><h3 className="font-bold text-blue-900 flex items-center gap-2"><Factory size={18}/> Form {isEdit?'Edit ':''}Eksekusi Produksi & Pemakaian Bahan</h3><button type="button" onClick={closeAllForms} className="text-blue-500 hover:text-red-500"><X size={18}/></button></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start mb-6">
                  <div className="space-y-1">
                      <label className="text-xs font-bold text-blue-800 uppercase">Input Total Adukan</label>
                      <input type="number" min="0.5" step="0.5" required value={adukan} onChange={e=>setAdukan(e.target.value)} className="w-full p-3 border border-blue-300 rounded-lg font-black text-xl text-blue-900" placeholder="0" />
                      <div className="text-[10px] bg-white p-2 rounded border text-slate-600 font-medium">
                          Memotong: <strong className="text-orange-600">{adukan ? formatAyam(adukan * MASTER_AYAM_KG) : '0 Kg'}</strong><br/>
                          Menambah: <strong className="text-emerald-600">{adukan ? formatDimsum(adukan * MASTER_PCS) : '0 Pcs'}</strong>
                      </div>
                  </div>
                  <div className="space-y-1"><label className="text-xs font-bold text-blue-800 uppercase">Shift / Waktu</label><select value={waktuProd} onChange={e=>setWaktuProd(e.target.value)} className="w-full p-3 border border-blue-300 rounded-lg font-bold bg-white"><option>Pagi</option><option>Siang</option><option>Sore/Malam</option></select></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-blue-800 uppercase">Keterangan Produksi</label><input type="text" value={notesProd} onChange={e=>setNotesProd(e.target.value)} className="w-full p-3 border border-blue-300 rounded-lg bg-white" placeholder="Cth: Produksi Budi" /></div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-blue-200">
                  <div className="flex justify-between items-center mb-3">
                      <div>
                          <h4 className="font-bold text-sm text-blue-800">Bahan Baku Produksi (Otomatis Keluar Gudang)</h4>
                          <p className="text-[10px] text-slate-500">Catatan: Ayam utama (-30Kg/Adukan) sudah otomatis terpotong. Gunakan tabel di bawah ini khusus untuk Bumbu, Plastik, Saus, atau Ayam Tambahan.</p>
                      </div>
                      <button type="button" onClick={addProdRow} className="bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200 rounded">+ Tambah Bahan</button>
                  </div>
                  
                  {bahanProdCart.length === 0 ? <div className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded border border-dashed">Klik "+ Tambah Bahan" untuk mencatat pemakaian Daun Bawang, Gula, Bumbu, dll.</div> : (
                      <div className="space-y-2">
                          {bahanProdCart.map((item, index) => (
                              <div key={index} className="flex gap-2 items-center relative pr-8">
                                  <div className="w-5/12">
                                      {/* MENGGUNAKAN DROPDOWN KHUSUS */}
                                      <select 
                                        required 
                                        value={item.itemName} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            updateProdCart(index, 'itemName', val);
                                            // SMART DEFAULT SATUAN
                                            let defaultSat = item.satuan || 'PACK';
                                            if (val === 'DAUN BAWANG') defaultSat = 'IKAT';
                                            else if (val === 'MINYAK WIJEN' || val === 'SAUS') defaultSat = 'BOTOL';
                                            else if (val === 'GULA' || val.includes('AYAM') || val === 'TEPUNG') defaultSat = 'KG';
                                            else if (val === 'BUMBU' || val === 'PLASTIK' || val === 'MIKA') defaultSat = 'PACK';
                                            
                                            updateProdCart(index, 'satuan', defaultSat);
                                        }} 
                                        className="w-full p-2 border border-blue-200 rounded text-xs uppercase font-bold bg-white"
                                      >
                                          <option value="" disabled>- PILIH BAHAN -</option>
                                          {listBahanUnik.map(b => <option key={b} value={b}>{b}</option>)}
                                      </select>
                                  </div>
                                  <div className="w-3/12"><input type="number" min="0.1" step="0.1" required placeholder="Qty" value={item.qty} onChange={e=>updateProdCart(index, 'qty', e.target.value)} className="w-full p-2 border border-blue-200 rounded text-xs font-bold text-center" /></div>
                                  <div className="w-4/12"><input type="text" required placeholder="Satuan" value={item.satuan} onChange={e=>updateProdCart(index, 'satuan', e.target.value)} className="w-full p-2 border border-blue-200 rounded text-xs uppercase" /></div>
                                  <button type="button" onClick={()=>removeProdRow(index)} className="absolute right-1 top-2.5 text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
              <div className="mt-4 flex justify-end"><button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold shadow-md">Simpan {isEdit?'Perubahan':'& Eksekusi'}</button></div>
          </form>
      )}

      {/* FORM: MUTASI (PUSAT) */}
      {showFormMutasi && role === 'admin' && (
          <form onSubmit={handleMutasiPusat} className="bg-orange-50 p-6 rounded-xl border shadow-sm border-orange-200">
              <div className="flex justify-between items-center border-b border-orange-200 pb-3 mb-4"><h3 className="font-bold text-orange-900 flex items-center gap-2"><Truck size={18}/> Form {isEdit?'Edit ':''}Kirim Ayam</h3><button type="button" onClick={closeAllForms} className="text-orange-500 hover:text-red-500"><X size={18}/></button></div>
              <div className="flex gap-4 items-end">
                  <div className="w-1/3 space-y-1"><label className="text-xs font-bold text-orange-800 uppercase">Total Ayam (Kg)</label><input type="number" min="1" required value={qtyMutasi} onChange={e=>setQtyMutasi(e.target.value)} className="w-full p-3 border border-orange-300 rounded-lg font-black text-xl" /></div>
                  <div className="w-2/3 flex gap-2"><button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-lg font-bold shadow-md">Kirim Ayam</button></div>
              </div>
          </form>
      )}

      {/* SECTION 2-4: FLOW (GUDANG -> PRODUKSI -> FREEZER) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

          <div className="bg-white rounded-xl border border-blue-200 shadow-sm flex flex-col">
              <div className="bg-blue-50 p-4 border-b border-blue-100"><h3 className="font-bold text-blue-900 flex items-center gap-2"><Factory size={18}/> Dapur Produksi (All Time)</h3><p className="text-[10px] text-blue-600 mt-0.5">Mesin pengolah bahan mentah menjadi barang jadi.</p></div>
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

          <div className="bg-white rounded-xl border border-emerald-200 shadow-sm flex flex-col">
              <div className="bg-emerald-50 p-4 border-b border-emerald-100"><h3 className="font-bold text-emerald-900 flex items-center gap-2"><Snowflake size={18}/> Freezer Barang Jadi</h3><p className="text-[10px] text-emerald-600 mt-0.5">Stok dimsum siap jual. Terpotong otomatis oleh Order.</p></div>
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
                          <div><div className="text-[10px] font-bold text-slate-500 uppercase">Barang Keluar (Order Jual)</div></div>
                          <div className="text-sm font-black text-red-600">-{dash.terjualTotalPcs / PCS_PER_MIKA} Mika</div>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* SECTION 5: TABEL RIWAYAT TRANSAKSI GUDANG & PRODUKSI */}
      <div className="bg-white rounded-xl border mt-6 overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-sm text-slate-800">Riwayat Transaksi Gudang & Produksi</h4></div>
        <table className="w-full text-sm text-left block md:table">
          <thead className="bg-white text-slate-600 text-[10px] uppercase border-b"><tr><th className="px-4 py-3">Tanggal & ID</th><th className="px-4 py-3 text-center">Tipe Transaksi</th><th className="px-4 py-3">Rincian Item & Keterangan</th><th className="px-4 py-3 text-center">Aksi</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {dash.displayLogGrouped.length === 0 ? <tr><td colSpan="4" className="text-center py-8 text-slate-400">Belum ada riwayat transaksi.</td></tr> : dash.displayLogGrouped.map((g) => (
              <tr key={g.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><div className="font-bold text-slate-800">{formatDate(g.date)}</div><div className="text-[10px] text-slate-500 font-mono">{g.id}</div></td>
                <td className="px-4 py-3 text-center">
                    {g.type.includes('PRODUKSI') ? <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold border border-blue-200">PRODUKSI ADUKAN</span> :
                     g.type.includes('MUTASI') ? <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-[10px] font-bold border border-orange-200">KIRIM CABANG</span> :
                     g.action === 'MASUK' ? <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold border border-emerald-200">BARANG MASUK</span> :
                     <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] font-bold border border-red-200">BARANG KELUAR</span>}
                </td>
                <td className="px-4 py-3 text-xs">
                    <ul className="list-disc pl-3 mb-1 text-slate-700 font-bold">
                        {g.type.includes('PRODUKSI') && <li>{g.adukanQty} ADUKAN DIMSUM <span className="text-orange-500 font-medium">(Mmtg {g.adukanQty * MASTER_AYAM_KG} Kg Ayam)</span></li>}
                        {g.items.filter(i => i.type === 'BAHAN_BAKU' || i.type.includes('MUTASI')).map((item, idx) => (
                            <li key={idx}>{item.itemName} <span className="font-normal text-slate-500">- {item.qty} {item.satuan}</span></li>
                        ))}
                    </ul>
                    <div className="text-[10px] text-slate-500 italic">{g.notes}</div>
                </td>
                <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                        <button onClick={() => setPrintData({ type: 'bukti_stok', data: g })} className="text-slate-600 bg-slate-100 p-2 rounded-lg border hover:bg-slate-200 transition shadow-sm" title="Cetak Bukti"><Printer size={16} /></button>
                        <button onClick={() => handleEdit(g)} className="text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200 hover:bg-blue-100 transition shadow-sm font-bold text-[10px]" title="Edit Transaksi">EDIT</button>
                        <button onClick={() => requestDelete(g.id)} className="text-red-500 bg-red-50 p-2 rounded-lg border border-red-200 hover:bg-red-100 transition shadow-sm" title="Hapus Permanen"><Trash2 size={16} /></button>
                    </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
