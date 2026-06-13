import React, { useState, useMemo } from 'react';
import { 
  Factory, Search, Printer, Trash2, 
  CheckCircle2, Layers, Database, PackageCheck,
  FileText, Calendar, Calculator, ArrowRightLeft
} from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabStok({ 
  masterProducts = [], master_products, 
  inventoryCostLayers = [], inventory_cost_layers,
  productionBatches = [], production_batches,
  sendToSheet, showToast, user, requestDelete 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  // --- SINKRONISASI DATABASE ---
  const realProducts = useMemo(() => master_products || masterProducts || [], [master_products, masterProducts]);
  const realInventory = useMemo(() => inventory_cost_layers || inventoryCostLayers || [], [inventory_cost_layers, inventoryCostLayers]);
  const realProduction = useMemo(() => production_batches || productionBatches || [], [production_batches, productionBatches]);

  const [tableDateFilter, setTableDateFilter] = useState(todayStr);

  const [form, setForm] = useState({
    date: todayStr,
    pic: user?.name || '',
    productName: '',
    adukanQty: '',      // Patokan pemotongan ayam mentah
    actualMika: '',     // Realita fisik kemasan mika dari lapangan
    actualLoosePcs: '', // Realita sisa pcs lepasan dari lapangan
    notes: ''
  });

  // --- 1. ENGINE STOK BAHAN BAKU BERKELANJUTAN (AKUMULASI SISA GUDANG) ---
  const stockGudang = useMemo(() => {
    let ayamKantong = 0;
    realInventory.forEach(inv => {
      if (inv.isDeleted || (inv.branch_id !== currentBranch && currentBranch !== 'TANGERANG_PUSAT')) return;
      if (inv.category === 'BAHAN_BAKU') ayamKantong += Number(inv.qty_remaining || 0);
    });
    return { 
      ayamKantong, 
      ayamKg: ayamKantong * 10 // Aturan Pabrik Rule #1: 1 Kantong = 10 Kg Ayam Mentah
    };
  }, [realInventory, currentBranch]);

  // --- 2. ENGINE KALKULATOR ADUKAN & DETEKSI KONVERSI LIVE ---
  const kalkulasi = useMemo(() => {
    const adukan = Number(form.adukanQty || 0);
    const aktualMika = Number(form.actualMika || 0);
    const aktualLoosePcs = Number(form.actualLoosePcs || 0);
    
    // ATURAN PABRIK RULE #2 & #3 (Target Standar)
    const stdPcs = adukan * 1000;
    const stdMika = adukan * 20;

    // TOTAL NILAI KONVERSI FISIK AKTUAL YANG DIINPUT (YANG MASUK POS KASIR)
    const actualTotalPcs = (aktualMika * 50) + aktualLoosePcs;
    const actualTotalPorsi = Math.floor(actualTotalPcs / 4); // Rule #4: 1 Porsi = 4 Pcs
    const actualTotalMikaFraction = (actualTotalPcs / 50).toFixed(1); // Rule #5: 1 Mika = 50 Pcs

    const selisihPcs = actualTotalPcs - stdPcs;

    // KEBUTUHAN AYAM MUTLAK DARI JUMLAH ADUKAN
    const butuhAyamKg = adukan * 30;
    const butuhAyamKantong = adukan * 3; // 1 Adukan = 3 Kantong Ayam
    
    // HASIL AKUMULASI SISA SEBELUMNYA DIKURANGI ADUKAN HARI INI
    const sisaAyamKantong = stockGudang.ayamKantong - butuhAyamKantong;
    const sisaAyamKg = stockGudang.ayamKg - butuhAyamKg;

    return { 
      adukan, stdPcs, stdMika, 
      actualTotalPcs, actualTotalPorsi, actualTotalMikaFraction, aktualMika, aktualLoosePcs, selisihPcs,
      butuhAyamKg, butuhAyamKantong, sisaAyamKantong, sisaAyamKg 
    };
  }, [form.adukanQty, form.actualMika, form.actualLoosePcs, stockGudang]);

  // Filter Menu Aktif
  const activeMenus = useMemo(() => {
    return realProducts.filter(p => !p.isDeleted && String(p.isDeleted).toUpperCase() !== 'TRUE' && p.status_active).reverse();
  }, [realProducts]);

  // Jurnal Riwayat Transaksi Produksi
  const historyProduction = useMemo(() => {
    return realProduction
      .filter(p => !p.isDeleted && p.date.substring(0, 10) === tableDateFilter && (p.branch_id === currentBranch || currentBranch === 'TANGERANG_PUSAT'))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realProduction, tableDateFilter, currentBranch]);

  // --- ACTIONS: AUTO-FILL HASIL AKTUAL ---
  const handleAdukanChange = (val) => {
    const adukan = Number(val.replace(/\D/g, ''));
    setForm(prev => ({
      ...prev,
      adukanQty: String(adukan),
      actualMika: String(adukan * 20), // Auto-fill pemicu nilai standar mika awal
      actualLoosePcs: '0'              // Auto-fill sisa pcs lepasan awal
    }));
  };

  // --- ACTIONS: SUBMIT LAPORAN PRODUKSI ---
  const handleSubmitProduksi = async (e) => {
    e.preventDefault();
    if (kalkulasi.adukan <= 0) return alert("Jumlah adukan tidak boleh kosong!");
    if (kalkulasi.actualTotalPcs <= 0) return alert("Hasil fisik aktual mika/pcs dari lapangan tidak boleh kosong!");
    if (!form.productName) return alert("Pilih menu dimsum yang diproduksi!");

    if (kalkulasi.butuhAyamKantong > stockGudang.ayamKantong) {
      if (!window.confirm(`⚠️ ATTENTION: STOK AYAM MINUS NOMINAL!\n\nDapur membutuhkan ${kalkulasi.butuhAyamKantong} Kantong, tetapi akumulasi sistem mencatat hanya tersedia ${stockGudang.ayamKantong} Kantong.\nLanjutkan input minus?`)) {
        return;
      }
    }

    const batchId = generateId('PRD', form.date);

    // 1. PAYLOAD PRODUKSI (Yield Aktual dalam volume PCS masuk ke Freezer POS Kasir)
    const payloadBatch = {
      id: batchId, date: form.date, branch_id: currentBranch,
      item_name: form.productName, 
      actual_yield: kalkulasi.actualTotalPcs, 
      pic: form.pic.toUpperCase(), 
      notes: `${form.notes.toUpperCase()} (ASAL: ${kalkulasi.adukan} ADUKAN, FISIK RIIL: ${kalkulasi.aktualMika} MIKA + ${kalkulasi.aktualLoosePcs} PCS)`
    };

    // 2. PAYLOAD INVENTORY AYAM (Memotong stok gudang mentah berdasarkan hitungan adukan mutlak)
    let payloadAyam = null;
    if (kalkulasi.butuhAyamKantong > 0) {
      payloadAyam = {
        id: generateId('INV', form.date), date: form.date, branch_id: currentBranch,
        category: 'BAHAN_BAKU', item_name: `PRODUKSI: ${form.productName} (${kalkulasi.adukan} ADUKAN)`, 
        qty_remaining: -kalkulasi.butuhAyamKantong, unit_cost: 0, status: 'USED', reference_id: batchId
      };
    }

    const isSuccess = await sendToSheet('insert', payloadBatch, 'production_batches');
    
    if (isSuccess) {
      if (payloadAyam) sendToSheet('insert', payloadAyam, 'inventory_cost_layers');
      showToast(`Laporan Produksi Berhasil! ${formatNumber(kalkulasi.actualTotalPcs)} Pcs Dimsum resmi masuk ke freezer kasir.`, 'success');
      setForm({ ...form, productName: '', adukanQty: '', actualMika: '', actualLoosePcs: '', notes: '' });
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* 🚀 BANNER HEADER: MONITOR GUDANG MENTAH & KALKULATOR AKUMULASI */}
      <div className="bg-[#151a25] rounded-3xl p-6 shadow-xl border border-slate-800 relative overflow-hidden flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500"></div>
        <div className="relative z-10 text-white flex-1 w-full">
           <div className="flex items-center gap-2 mb-4">
             <Database size={20} className="text-rose-500"/>
             <h2 className="text-sm font-black uppercase tracking-widest text-slate-300">Monitor Gudang &amp; Hasil Fisik Aktual</h2>
           </div>
           
           <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
             {/* KOTAK 1: TOTAL AKTUAL YANG AKAN DIKIRIM KE FREEZER POS KASIR */}
             <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden">
               <div className="absolute top-0 w-full bg-emerald-600/20 text-emerald-400 text-[8px] font-black uppercase text-center py-0.5 border-b border-emerald-500/20">MASUK KASIR POS</div>
               <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1 mt-2">Total Aktual (Pcs)</div>
               <div className="text-3xl font-black text-white">{formatNumber(kalkulasi.actualTotalPcs)}</div>
               {kalkulasi.selisihPcs !== 0 && (
                 <div className={`text-[9px] font-black uppercase mt-1 px-2 py-0.5 rounded ${kalkulasi.selisihPcs > 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-rose-500/20 text-rose-400'}`}>
                   {kalkulasi.selisihPcs > 0 ? `+${formatNumber(kalkulasi.selisihPcs)} PCS (SURPLUS)` : `${formatNumber(kalkulasi.selisihPcs)} PCS (MINUS)`}
                 </div>
               )}
             </div>

             {/* KOTAK 2: TARGET STANDAR TEORITIS MATEMATIKA */}
             <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
               <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Target Standar</div>
               <div className="text-sm font-black text-slate-300">{formatNumber(kalkulasi.stdMika)} <span className="text-[10px] text-slate-500">MIKA</span></div>
               <div className="text-sm font-black text-slate-300">{formatNumber(kalkulasi.stdPcs)} <span className="text-[10px] text-slate-500">PCS</span></div>
             </div>

             {/* KOTAK 3: AYAM YANG DIKONSUMSI DI DAPUR ADUKAN */}
             <div className="bg-rose-950/30 border border-rose-900/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
               <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Ayam Dipakai</div>
               <div className="text-xl font-black text-white">{formatNumber(kalkulasi.butuhAyamKantong)} <span className="text-[10px] text-slate-400">KANTONG</span></div>
               <div className="text-xs font-bold text-rose-300">{formatNumber(kalkulasi.butuhAyamKg)} KG</div>
             </div>

             {/* KOTAK 4: TOTAL AKUMULASI SISA GUDANG FISIK (BERLANJUT) */}
             <div className="bg-amber-950/30 border border-amber-900/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden">
               {kalkulasi.sisaAyamKantong < 0 && <div className="absolute top-0 w-full bg-rose-600 text-white text-[8px] font-black uppercase text-center py-0.5">MINUS</div>}
               <div className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">Sisa Di Gudang</div>
               <div className={`text-xl font-black ${kalkulasi.sisaAyamKantong < 0 ? 'text-rose-500' : 'text-white'}`}>{formatNumber(kalkulasi.sisaAyamKantong)} <span className="text-[10px] text-slate-400">KANTONG</span></div>
               <div className={`text-xs font-bold ${kalkulasi.sisaAyamKg < 0 ? 'text-rose-500' : 'text-amber-300'}`}>{formatNumber(kalkulasi.sisaAyamKg)} KG</div>
             </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: FORM LAPORAN PRODUKSI DUA LANGKAH OPERASIONAL */}
        <div className="xl:col-span-5 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden border-t-4 border-t-amber-500">
          <div className="p-6 border-b bg-amber-50/50 shrink-0">
             <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2"><Factory size={16} className="text-amber-600"/> Laporan Laju Produksi Dapur</h4>
          </div>
          
          <form onSubmit={handleSubmitProduksi} className="p-6 space-y-6 bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Tanggal Adukan</label>
                <input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-black outline-none bg-slate-50 cursor-pointer focus:border-amber-400" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Kepala Dapur / PIC</label>
                <input type="text" required value={form.pic} onChange={e=>setForm({...form, pic: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-black uppercase outline-none bg-slate-50 focus:border-amber-400" placeholder="Nama..." />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Menu Yang Dihasilkan</label>
              <select required value={form.productName} onChange={e=>setForm({...form, productName: e.target.value})} className="w-full p-3.5 border border-slate-200 rounded-xl text-xs font-black uppercase outline-none cursor-pointer bg-slate-50 focus:border-amber-400">
                <option value="">-- PILIH VARIANT PRODUK --</option>
                {activeMenus.map(m => <option key={m.id} value={m.product_name}>{m.product_name}</option>)}
              </select>
            </div>

            {/* LANGKAH 1: TOTAL ADUKAN HARI INI */}
            <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 shadow-inner relative">
              <div className="absolute -top-3 left-4 bg-amber-100 border border-amber-300 text-amber-800 text-[8px] font-black px-2 py-1 rounded uppercase tracking-widest">LANGKAH 1</div>
              <label className="text-[10px] font-black text-amber-800 uppercase tracking-widest block mb-2 text-center mt-2">TOTAL ADUKAN HARI INI</label>
              <input type="number" min="1" required value={form.adukanQty} onChange={e=>handleAdukanChange(e.target.value)} className="w-full py-4 border-2 border-amber-300 rounded-xl text-3xl font-black text-amber-900 bg-white outline-none text-center focus:border-amber-500 transition-colors" placeholder="Cth: 21" />
            </div>

            {/* LANGKAH 2: INPUT HASIL KEMASAN FISIK NYATA */}
            <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-200 shadow-inner relative animate-in slide-in-from-bottom-2 duration-300">
              <div className="absolute -top-3 left-4 bg-emerald-100 border border-emerald-300 text-emerald-800 text-[8px] font-black px-2 py-1 rounded uppercase tracking-widest flex items-center gap-1"><PackageCheck size={10}/> LANGKAH 2</div>
              <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block mb-3 text-center mt-2">HASIL KEMASAN FISIK NYATA</label>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Total Jadi (Mika 50)</label>
                  <input type="number" min="0" required value={form.actualMika} onChange={e=>setForm({...form, actualMika: e.target.value})} className="w-full p-3 border border-emerald-300 rounded-xl text-xl font-black text-emerald-800 bg-white outline-none text-center focus:border-emerald-500" placeholder="0" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Sisa Lepasan (Pcs)</label>
                  <input type="number" min="0" required value={form.actualLoosePcs} onChange={e=>setForm({...form, actualLoosePcs: e.target.value})} className="w-full p-3 border border-emerald-300 rounded-xl text-xl font-black text-emerald-800 bg-white outline-none text-center focus:border-emerald-500" placeholder="0" />
                </div>
              </div>

              {/* 🔥 KOTAK PENAMBAHAN FITUR: LIVE BREAKDOWN VALUE DISPLAY PANEL */}
              {form.adukanQty && (
                <div className="mt-4 pt-4 border-t border-emerald-200/60 grid grid-cols-3 gap-2 animate-in fade-in duration-300">
                  <div className="bg-white/80 border border-emerald-200 rounded-xl p-2 text-center shadow-sm">
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Pcs</div>
                    <div className="text-xs font-black text-emerald-700">{formatNumber(kalkulasi.actualTotalPcs)}</div>
                  </div>
                  <div className="bg-white/80 border border-emerald-200 rounded-xl p-2 text-center shadow-sm">
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Mika</div>
                    <div className="text-xs font-black text-blue-700">{kalkulasi.actualTotalMikaFraction} M</div>
                  </div>
                  <div className="bg-white/80 border border-emerald-200 rounded-xl p-2 text-center shadow-sm">
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Porsi</div>
                    <div className="text-xs font-black text-amber-700">{formatNumber(kalkulasi.actualTotalPorsi)} P</div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Catatan Tambahan (Opsional)</label>
              <input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none bg-slate-50 focus:border-amber-400" placeholder="Sisa adonan dimasukkan cup..." />
            </div>

            <button type="submit" className="w-full bg-slate-900 text-white font-black py-4.5 rounded-2xl text-xs uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-transform active:scale-95 flex items-center justify-center gap-2 mt-4">
              <CheckCircle2 size={16}/> Lapor Fisik &amp; Potong Gudang
            </button>
          </form>
        </div>

        {/* KANTONG KANAN: JURNAL BUKU RIWAYAT PRODUKSI */}
        <div className="xl:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h4 className="font-black text-xs uppercase text-slate-800 tracking-widest flex items-center gap-2"><FileText size={16} className="text-blue-600"/> Jurnal Buku Produksi Dapur</h4>
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-300 px-3 py-2 rounded-xl shadow-sm">
              <Calendar size={14} className="text-blue-500 ml-0.5"/>
              <input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value || todayStr)} className="text-xs font-black text-slate-800 outline-none bg-transparent cursor-pointer" />
            </div>
          </div>
          
          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar min-h-[60vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-white text-[10px] uppercase text-slate-400 border-b border-slate-100 sticky top-0 shadow-sm">
                <tr>
                  <th className="px-5 py-4 font-black">Waktu &amp; Batch</th>
                  <th className="px-5 py-4 font-black">Menu Diaduk</th>
                  <th className="px-5 py-4 font-black text-center">Ayam Dipotong</th>
                  <th className="px-5 py-4 font-black text-right">Hasil Aktual (POS)</th>
                  <th className="px-5 py-4 font-black text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-50">
                {historyProduction.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-20 text-slate-400 font-black uppercase tracking-widest bg-slate-50/50">
                      <div className="flex justify-center mb-3 opacity-20"><Factory size={40}/></div>
                      Belum ada adukan dapur hari ini.
                    </td>
                  </tr>
                ) : (
                  historyProduction.map(p => {
                    const logsPotong = realInventory.filter(inv => inv.reference_id === p.id);
                    const potongAyam = logsPotong.find(inv => inv.category === 'BAHAN_BAKU');
                    
                    const notesAdukanMatch = p.notes ? p.notes.match(/ASAL: (\d+) ADUKAN/) : null;
                    const adukanTercatat = notesAdukanMatch ? notesAdukanMatch[1] : '?';

                    return (
                      <tr key={p.id} className="hover:bg-emerald-50/30 transition-colors group">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-slate-800 font-black text-sm">{formatDate(p.date)}</div>
                          <div className="text-[9px] font-mono text-slate-400 mt-1">{p.id}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-black text-blue-700 uppercase text-xs mb-1 tracking-wide">{p.item_name}</div>
                          <div className="flex gap-2 items-center">
                            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">PIC: {p.pic || '-'}</span>
                            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">{adukanTercatat} ADUKAN</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                           <span className="text-rose-600 font-black">{potongAyam ? Math.abs(potongAyam.qty_remaining) : 0} Ktg</span>
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="text-sm font-black text-emerald-600">{formatNumber(p.actual_yield || p.qty)} <span className="text-[9px] text-emerald-600/70">Pcs</span></div>
                          <div className="text-[8px] font-black text-slate-400 mt-1 uppercase tracking-widest">{formatNumber(Math.floor((p.actual_yield || p.qty)/50))} Mika + {(p.actual_yield || p.qty)%50} Pcs</div>
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center justify-center gap-1.5">
                            <button type="button" onClick={() => triggerPrint('NOTA_DOTMATRIX', {
                              title: 'BUKTI SETORAN PRODUKSI DAPUR', id: p.id, date: formatDate(p.date),
                              branch_name: currentBranch, admin_name: user?.name || 'ADMIN', customer_name: 'GUDANG FREEZER POS',
                              items: [{ name: `HASIL AKTUAL FISIK: ${p.item_name}\n(PIC: ${p.pic} - ${adukanTercatat} ADUKAN)`, qty: 1, subtotal: p.actual_yield || p.qty }],
                              amount: p.actual_yield || p.qty, paymentMethod: 'TERCATAT DI KASIR POS',
                              history: { labelLama: 'Ayam Mentah Dipakai', nominalLama: potongAyam ? Math.abs(potongAyam.qty_remaining) : 0, labelAksi: 'Status Bahan Baku', nominalAksi: 'TERPOTONG OTOMATIS', labelBaru: 'Konversi Setara', nominalBaru: `${formatNumber(Math.floor((p.actual_yield || p.qty)/50))} Mika` }
                            })} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors" title="Cetak Bukti Adukan"><Printer size={16}/></button>
                            <button type="button" onClick={() => { if(window.confirm("Yakin void transaksi adukan ini? Stok kasir dan ayam gudang akan ditarik mundur!")) requestDelete(p.id); }} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" title="Hapus Laporan Adukan"><Trash2 size={16}/></button>
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
    </div>
  );
}
