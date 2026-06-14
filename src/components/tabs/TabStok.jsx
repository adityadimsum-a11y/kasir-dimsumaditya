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
  const realProduction = useMemo(() => production_batches || productionBatches || [], [production_batches, production_batches]);

  const [tableDateFilter, setTableDateFilter] = useState(todayStr);

  const [form, setForm] = useState({
    date: todayStr,
    pic: user?.name || '',
    productName: '',
    adukanQty: '',      
    actualInput: '',    
    actualUnit: 'MIKA', 
    notes: ''
  });

  // --- 1. ENGINE STOK BAHAN BAKU ---
  const stockGudang = useMemo(() => {
    let ayamKantong = 0;
    realInventory.forEach(inv => {
      if (inv.isDeleted || (inv.branch_id !== currentBranch && currentBranch !== 'TANGERANG_PUSAT')) return;
      if (inv.category === 'BAHAN_BAKU') ayamKantong += Number(inv.qty_remaining || 0);
    });
    return { 
      ayamKantong, 
      ayamKg: ayamKantong * 10 
    };
  }, [realInventory, currentBranch]);

  // --- 2. ENGINE KALKULATOR KONVERSI ---
  const kalkulasi = useMemo(() => {
    const adukan = Number(form.adukanQty || 0);
    const inputAngka = Number(form.actualInput || 0);
    const satuanDipilih = form.actualUnit;
    
    const stdPcs = adukan * 1000;
    const stdMika = adukan * 20;

    let actualTotalPcs = 0;
    if (satuanDipilih === 'MIKA') actualTotalPcs = inputAngka * 50;     
    if (satuanDipilih === 'PORSI') actualTotalPcs = inputAngka * 4;     
    if (satuanDipilih === 'PCS') actualTotalPcs = inputAngka;

    const previewMika = (actualTotalPcs / 50).toFixed(1);
    const previewPorsi = Math.floor(actualTotalPcs / 4);

    const selisihPcs = actualTotalPcs - stdPcs;
    const butuhAyamKg = adukan * 30;
    const butuhAyamKantong = adukan * 3; 
    
    const sisaAyamKantong = stockGudang.ayamKantong - butuhAyamKantong;
    const sisaAyamKg = stockGudang.ayamKg - butuhAyamKg;

    return { 
      adukan, stdPcs, stdMika, 
      actualTotalPcs, previewMika, previewPorsi, inputAngka, satuanDipilih, selisihPcs,
      butuhAyamKg, butuhAyamKantong, sisaAyamKantong, sisaAyamKg 
    };
  }, [form.adukanQty, form.actualInput, form.actualUnit, stockGudang]);

  const activeMenus = useMemo(() => {
    return realProducts.filter(p => !p.isDeleted && String(p.isDeleted).toUpperCase() !== 'TRUE' && p.status_active).reverse();
  }, [realProducts]);

  const historyProduction = useMemo(() => {
    return realProduction
      .filter(p => !p.isDeleted && p.date.substring(0, 10) === tableDateFilter && (p.branch_id === currentBranch || currentBranch === 'TANGERANG_PUSAT'))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realProduction, tableDateFilter, currentBranch]);

  const handleAdukanChange = (val) => {
    const adukan = Number(val.replace(/\D/g, ''));
    setForm(prev => ({
      ...prev,
      adukanQty: String(adukan),
      actualInput: String(adukan * 20), 
      actualUnit: 'MIKA'                
    }));
  };

  const handleSubmitProduction = async (e) => {
    e.preventDefault();
    if (kalkulasi.adukan <= 0) return alert("Jumlah adukan tidak boleh kosong!");
    if (kalkulasi.actualTotalPcs <= 0) return alert("Angka hasil aktual fisik tidak boleh kosong!");
    if (!form.productName) return alert("Pilih variant produk dimsum!");

    if (kalkulasi.butuhAyamKantong > stockGudang.ayamKantong) {
      if (!window.confirm(`⚠️ Stok ayam minus!\n\nDapur butuh ${kalkulasi.butuhAyamKantong} Kantong, sistem sisa ${stockGudang.ayamKantong} Kantong.\nLanjutkan pencatatan minus?`)) {
        return;
      }
    }

    const batchId = generateId('PRD', form.date);

    const payloadBatch = {
      id: batchId, date: form.date, branch_id: currentBranch,
      item_name: form.productName, 
      actual_yield: kalkulasi.actualTotalPcs, 
      pic: form.pic.toUpperCase(), 
      notes: `${form.notes.toUpperCase()} (Asal: ${kalkulasi.adukan} adukan, input fisik: ${kalkulasi.inputAngka} ${kalkulasi.satuanDipilih})`
    };

    let payloadAyam = null;
    if (kalkulasi.butuhAyamKantong > 0) {
      payloadAyam = {
        id: generateId('INV', form.date), date: form.date, branch_id: currentBranch,
        category: 'BAHAN_BAKU', item_name: `Produksi: ${form.productName} (${kalkulasi.adukan} adukan)`, 
        qty_remaining: -kalkulasi.butuhAyamKantong, unit_cost: 0, status: 'USED', reference_id: batchId
      };
    }

    const isSuccess = await sendToSheet('insert', payloadBatch, 'production_batches');
    
    if (isSuccess) {
      if (payloadAyam) sendToSheet('insert', payloadAyam, 'inventory_cost_layers');
      showToast(`Laporan produksi berhasil! ${formatNumber(kalkulasi.actualTotalPcs)} Pcs dimsum masuk ke freezer kasir.`, 'success');
      setForm({ ...form, productName: '', adukanQty: '', actualInput: '', notes: '' });
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      
      {/* 🚀 MONITOR PANEL ATAS - FLAT STYLE PROFESSIONAL */}
      <div className="card-holo p-6 relative overflow-hidden flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600"></div>
        <div className="relative z-10 flex-1 w-full pl-2">
           <div className="flex items-center gap-2 mb-4">
             <Database size={16} className="text-red-600"/>
             <h2 className="text-sm font-extrabold normal-case text-slate-800">Monitor gudang &amp; hasil fisik aktual</h2>
           </div>
           
           <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
             <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden">
               <div className="absolute top-0 w-full bg-red-50 text-red-600 text-[8px] font-bold text-center py-0.5 border-b border-slate-200">Masuk kasir POS</div>
               <div className="text-[9px] font-bold text-slate-400 normal-case mb-1 mt-2">Total aktual (Pcs)</div>
               <div className="text-2xl font-black text-slate-800">{formatNumber(kalkulasi.actualTotalPcs)}</div>
               {kalkulasi.selisihPcs !== 0 && (
                 <div className={`text-[9px] font-bold uppercase mt-1 px-2 py-0.5 rounded ${kalkulasi.selisihPcs > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                   {kalkulasi.selisihPcs > 0 ? `+${formatNumber(kalkulasi.selisihPcs)} Pcs (Surplus)` : `${formatNumber(kalkulasi.selisihPcs)} Pcs (Minus)`}
                 </div>
               )}
             </div>

             <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-xs">
               <div className="text-[9px] font-bold text-slate-400 normal-case mb-1">Target standar</div>
               <div className="text-xs font-bold text-slate-700">{formatNumber(kalkulasi.stdMika)} <span className="text-[9px] text-slate-400">Mika</span></div>
               <div className="text-xs font-bold text-slate-700">{formatNumber(kalkulasi.stdPcs)} <span className="text-[9px] text-slate-400">Pcs</span></div>
             </div>

             <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-xs">
               <div className="text-[9px] font-bold text-slate-400 normal-case mb-1">Ayam dipakai</div>
               <div className="text-sm font-extrabold text-slate-800">{formatNumber(kalkulasi.butuhAyamKantong)} <span className="text-[10px] text-slate-400 font-medium">Kantong</span></div>
               <div className="text-xs font-semibold text-slate-500">{formatNumber(kalkulasi.butuhAyamKg)} Kg</div>
             </div>

             <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-xs">
               {kalkulasi.sisaAyamKantong < 0 && <div className="absolute top-0 w-full bg-red-600 text-white text-[8px] font-bold text-center py-0.5">Minus</div>}
               <div className="text-[9px] font-bold text-slate-400 normal-case mb-1">Sisa di gudang</div>
               <div className={`text-sm font-extrabold ${kalkulasi.sisaAyamKantong < 0 ? 'text-red-600' : 'text-slate-800'}`}>{formatNumber(kalkulasi.sisaAyamKantong)} <span className="text-[10px] text-slate-400 font-medium">Kantong</span></div>
               <div className={`text-xs font-semibold ${kalkulasi.sisaAyamKg < 0 ? 'text-red-600' : 'text-slate-500'}`}>{formatNumber(kalkulasi.sisaAyamKg)} Kg</div>
             </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: FORM LAPORAN PRODUKSI */}
        <div className="xl:col-span-5 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden border-t-4 border-t-red-500">
          <div className="p-5 border-b border-slate-100 bg-slate-50 shrink-0">
             <h4 className="font-bold text-slate-800 normal-case text-xs flex items-center gap-2"><Factory size={16} className="text-red-600"/> Laporan hasil produksi</h4>
          </div>
          
          <form onSubmit={handleSubmitProduction} className="p-6 space-y-5 bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1.5">Tanggal adukan</label>
                <input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold outline-none bg-slate-50 cursor-pointer focus:border-red-400 focus:bg-white transition-colors" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1.5">Kepala dapur / PIC</label>
                <input type="text" required value={form.pic} onChange={e=>setForm({...form, pic: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold outline-none bg-slate-50 focus:border-red-400 focus:bg-white transition-colors" placeholder="Nama..." />
              </div>
            </div>

            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1.5">Varian produk jadi</label>
              <select required value={form.productName} onChange={e=>setForm({...form, productName: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:border-red-400 focus:bg-white transition-colors cursor-pointer">
                <option value="">-- Pilih variant produk --</option>
                {activeMenus.map(m => <option key={m.id} value={m.product_name}>{m.product_name}</option>)}
              </select>
            </div>

            {/* LANGKAH 1 */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner relative">
              <div className="absolute -top-3 left-4 bg-slate-200 border border-slate-300 text-slate-700 text-[8px] font-bold px-2 py-0.5 rounded normal-case">Langkah 1</div>
              <label className="text-[10px] font-bold text-slate-600 normal-case block mb-2 text-center mt-1">Total adukan hari ini</label>
              <input type="number" min="1" required value={form.adukanQty} onChange={e=>handleAdukanChange(e.target.value)} className="w-full py-3 border-2 border-slate-300 rounded-xl text-3xl font-black text-slate-800 bg-white outline-none text-center focus:border-red-500 transition-colors" placeholder="0" />
            </div>

            {/* LANGKAH 2 */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner relative">
              <div className="absolute -top-3 left-4 bg-red-600 text-white text-[8px] font-bold px-2 py-0.5 rounded normal-case flex items-center gap-1 shadow-xs"><PackageCheck size={10}/> Langkah 2</div>
              <label className="text-[10px] font-bold text-slate-600 normal-case block mb-3 text-center mt-1">Hasil kemasan fisik nyata</label>
              
              <div className="flex items-stretch gap-2">
                <input 
                  type="number" 
                  min="0" 
                  required 
                  value={form.actualInput} 
                  onChange={e=>setForm({...form, actualInput: e.target.value})} 
                  className="flex-1 p-3 border-2 border-slate-300 rounded-xl text-2xl font-black text-slate-800 bg-white outline-none text-center focus:border-red-500" 
                  placeholder="0" 
                />
                <select 
                  value={form.actualUnit} 
                  onChange={e=>setForm({...form, actualUnit: e.target.value})} 
                  className="w-32 px-2 bg-slate-800 text-white rounded-xl text-xs font-bold outline-none cursor-pointer border border-slate-700 shadow-sm text-center hover:bg-slate-900 transition-colors"
                >
                  <option value="MIKA">Mika (50)</option>
                  <option value="PORSI">Porsi (4)</option>
                  <option value="PCS">Pcs (1)</option>
                </select>
              </div>

              {/* Live Preview Ringkas */}
              {form.actualInput && (
                <div className="mt-4 pt-3.5 border-t border-slate-200 grid grid-cols-3 gap-2 animate-in fade-in duration-200">
                  <div className="bg-white border border-slate-200 rounded-xl p-2 text-center shadow-xs">
                    <div className="text-[8px] font-bold text-slate-400 normal-case mb-0.5">Total pcs</div>
                    <div className="text-xs font-bold text-slate-700">{formatNumber(kalkulasi.actualTotalPcs)}</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-2 text-center shadow-xs">
                    <div className="text-[8px] font-bold text-slate-400 normal-case mb-0.5">Setara mika</div>
                    <div className="text-xs font-bold text-slate-700">{kalkulasi.previewMika} M</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-2 text-center shadow-xs">
                    <div className="text-[8px] font-bold text-slate-400 normal-case mb-0.5">Setara porsi</div>
                    <div className="text-xs font-bold text-slate-700">{formatNumber(kalkulasi.previewPorsi)} P</div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1.5">Catatan tambahan (Opsional)</label>
              <input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold outline-none bg-slate-50 focus:border-red-400 focus:bg-white" placeholder="Cth: Sisa adonan panci..." />
            </div>

            <button type="submit" className="w-full btn-holo py-3.5 rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 mt-2">
              <CheckCircle2 size={14}/> Lapor fisik &amp; potong gudang
            </button>
          </form>
        </div>

        {/* KANTONG KANAN: JURNAL BUKU PRODUKSI */}
        <div className="xl:col-span-7 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h4 className="font-bold text-slate-800 normal-case text-xs flex items-center gap-2"><FileText size={16} className="text-red-600"/> Jurnal buku produksi dapur</h4>
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
              <Calendar size={14} className="text-red-500 ml-0.5"/>
              <input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value || todayStr)} className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer" />
            </div>
          </div>
          
          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar min-h-[60vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/50 text-[10px] normal-case text-slate-400 border-b border-slate-200 sticky top-0 shadow-xs bg-white">
                <tr>
                  <th className="px-5 py-4 font-bold">Waktu &amp; batch</th>
                  <th className="px-5 py-4 font-bold">Menu diaduk</th>
                  <th className="px-5 py-4 text-center font-bold">Ayam dipotong</th>
                  <th className="px-5 py-4 text-right font-bold">Hasil aktual (POS)</th>
                  <th className="px-5 py-4 font-bold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-100">
                {historyProduction.length === 0 ? (
                  <tr className="bg-white">
                    <td colSpan="5" className="text-center py-20 text-slate-400 normal-case font-bold">
                      <div className="flex justify-center mb-2 opacity-30"><Factory size={36}/></div>
                      Belum ada adukan dapur hari ini.
                    </td>
                  </tr>
                ) : (
                  historyProduction.map(p => {
                    const logsPotong = realInventory.filter(inv => inv.reference_id === p.id);
                    const potongAyam = logsPotong.find(inv => inv.category === 'BAHAN_BAKU');
                    
                    const notesAdukanMatch = p.notes ? p.notes.match(/ASAL: (\d+) ADUKAN/i) : null;
                    const adukanTercatat = notesAdukanMatch ? notesAdukanMatch[1] : '?';

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors group bg-white">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-slate-800 font-bold text-sm">{formatDate(p.date)}</div>
                          <div className="text-[9px] font-mono text-slate-400 mt-0.5">{p.id}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-extrabold text-slate-800 normal-case text-xs mb-1">{p.item_name}</div>
                          <div className="flex gap-2 items-center">
                            <span className="text-[9px] font-bold normal-case px-2 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200">PIC: {p.pic || '-'}</span>
                            <span className="text-[9px] font-bold normal-case px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">{adukanTercatat} adukan</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                           <span className="text-red-600 font-extrabold">{potongAyam ? Math.abs(potongAyam.qty_remaining) : 0} Ktg</span>
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="text-sm font-extrabold text-emerald-600">{formatNumber(p.actual_yield || p.qty)} <span className="text-[9px] text-emerald-600/70 font-bold">Pcs</span></div>
                          <div className="text-[9px] font-medium text-slate-400 mt-0.5 normal-case">{formatNumber(Math.floor((p.actual_yield || p.qty)/50))} Mika | {formatNumber(Math.floor((p.actual_yield || p.qty)/4))} Porsi</div>
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap opacity-60 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center justify-center gap-1.5">
                            <button type="button" onClick={() => triggerPrint('NOTA_DOTMATRIX', {
                              title: 'Bukti Setoran Produksi Dapur', id: p.id, date: formatDate(p.date),
                              branch_name: currentBranch, admin_name: user?.name || 'ADMIN', customer_name: 'GUDANG FREEZER POS',
                              items: [{ name: `HASIL AKTUAL FISIK: ${p.item_name}\n(PIC: ${p.pic} - ${adukanTercatat} ADUKAN)`, qty: 1, subtotal: p.actual_yield || p.qty }],
                              amount: p.actual_yield || p.qty, paymentMethod: 'TERCATAT DI KASIR POS',
                              history: { labelLama: 'Ayam Mentah Dipakai', nominalLama: potongAyam ? Math.abs(potongAyam.qty_remaining) : 0, labelAksi: 'Status Bahan Baku', nominalAksi: 'TERPOTONG OTOMATIS', labelBaru: 'Konversi Setara', nominalBaru: `${formatNumber(Math.floor((p.actual_yield || p.qty)/50))} Mika` }
                            })} className="p-2 text-slate-400 bg-white border border-slate-200 shadow-xs hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition-colors" title="Cetak bukti adukan"><Printer size={14}/></button>
                            <button type="button" onClick={() => { if(window.confirm("Yakin void transaksi adukan ini? Stok kasir dan ayam gudang akan ditarik mundur!")) requestDelete(p.id); }} className="p-2 text-slate-400 bg-white border border-slate-200 shadow-xs hover:text-red-600 hover:bg-slate-50 rounded-lg transition-colors" title="Hapus laporan adukan"><Trash2 size={14}/></button>
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
