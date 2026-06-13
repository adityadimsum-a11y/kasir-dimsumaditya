import React, { useState, useMemo } from 'react';
import { 
  Factory, Search, Printer, Trash2, 
  CheckCircle2, Layers, Database,
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
    adukanQty: '', // 🔥 INI YANG BARU: INPUT JUMLAH ADUKAN
    notes: ''
  });

  // --- 1. ENGINE STOK BAHAN BAKU (HANYA AYAM) ---
  const stockGudang = useMemo(() => {
    let ayamKantong = 0;
    realInventory.forEach(inv => {
      if (inv.isDeleted || (inv.branch_id !== currentBranch && currentBranch !== 'TANGERANG_PUSAT')) return;
      if (inv.category === 'BAHAN_BAKU') ayamKantong += Number(inv.qty_remaining || 0);
    });
    return { 
      ayamKantong, 
      ayamKg: ayamKantong * 10 // 1 Kantong = 10 Kg
    };
  }, [realInventory, currentBranch]);

  // --- 2. ENGINE KALKULATOR ADUKAN REAL-TIME ---
  const kalkulasi = useMemo(() => {
    const adukan = Number(form.adukanQty || 0);
    
    // RUMUS MUTLAK PABRIK BOS SULTAN:
    const yieldPcs = adukan * 1000;
    const yieldMika = adukan * 20;     // 1000 / 50
    const yieldPorsi = adukan * 250;   // 1000 / 4

    const butuhAyamKg = adukan * 30;
    const butuhAyamKantong = adukan * 3; // 30 / 10
    
    const sisaAyamKantong = stockGudang.ayamKantong - butuhAyamKantong;
    const sisaAyamKg = stockGudang.ayamKg - butuhAyamKg;

    return { 
      adukan, yieldPcs, yieldMika, yieldPorsi, 
      butuhAyamKg, butuhAyamKantong, sisaAyamKantong, sisaAyamKg 
    };
  }, [form.adukanQty, stockGudang]);

  // Filter Menu Aktif
  const activeMenus = useMemo(() => {
    return realProducts.filter(p => !p.isDeleted && String(p.isDeleted).toUpperCase() !== 'TRUE' && p.status_active).reverse();
  }, [realProducts]);

  // Jurnal Riwayat Produksi
  const historyProduction = useMemo(() => {
    return realProduction
      .filter(p => !p.isDeleted && p.date.substring(0, 10) === tableDateFilter && (p.branch_id === currentBranch || currentBranch === 'TANGERANG_PUSAT'))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realProduction, tableDateFilter, currentBranch]);

  // --- ACTIONS: SUBMIT LAPORAN PRODUKSI ---
  const handleSubmitProduksi = async (e) => {
    e.preventDefault();
    if (kalkulasi.adukan <= 0) return alert("Jumlah adukan tidak boleh kosong!");
    if (!form.productName) return alert("Pilih menu yang diproduksi!");

    if (kalkulasi.butuhAyamKantong > stockGudang.ayamKantong) {
      if (!window.confirm(`⚠️ STOK AYAM MINUS!\n\nDapur butuh ${kalkulasi.butuhAyamKantong} Kantong, tapi di sistem sisa ${stockGudang.ayamKantong} Kantong.\nData gudang akan tercatat minus (-). Tetap lanjutkan?`)) {
        return;
      }
    }

    const batchId = generateId('PRD', form.date);

    // 1. PAYLOAD PRODUKSI (Yield dalam PCS untuk Kasir POS)
    const payloadBatch = {
      id: batchId, date: form.date, branch_id: currentBranch,
      item_name: form.productName, 
      actual_yield: kalkulasi.yieldPcs, // Tetap simpan sebagai Pcs biar kasir jualan eceran gampang
      pic: form.pic.toUpperCase(), 
      notes: `${form.notes.toUpperCase()} (ASAL: ${kalkulasi.adukan} ADUKAN)`
    };

    // 2. PAYLOAD INVENTORY AYAM (Memotong dalam satuan Kantong)
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
      showToast(`Laporan ${kalkulasi.adukan} Adukan Sukses! Kasir mendapat ${formatNumber(kalkulasi.yieldPcs)} Pcs Dimsum.`, 'success');
      setForm({ ...form, productName: '', adukanQty: '', notes: '' });
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* 🚀 BANNER MONITOR GUDANG MENTAH & KALKULATOR HASIL (DESAIN BARU!) */}
      <div className="bg-[#151a25] rounded-3xl p-6 shadow-xl border border-slate-800 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500"></div>
        <div className="relative z-10 text-white flex-1 w-full">
           <div className="flex items-center gap-2 mb-4">
             <Database size={20} className="text-rose-500"/>
             <h2 className="text-sm font-black uppercase tracking-widest text-slate-300">Gudang Bahan Baku &amp; Estimasi Hasil</h2>
           </div>
           
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
             {/* KOTAK 1: HASIL PCS */}
             <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
               <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Estimasi Total Pcs</div>
               <div className="text-2xl font-black text-white">{formatNumber(kalkulasi.yieldPcs)}</div>
             </div>
             {/* KOTAK 2: HASIL MIKA & PORSI */}
             <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
               <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Setara Konversi</div>
               <div className="text-sm font-black text-white">{formatNumber(kalkulasi.yieldMika)} <span className="text-[10px] text-slate-400">MIKA</span></div>
               <div className="text-sm font-black text-white">{formatNumber(kalkulasi.yieldPorsi)} <span className="text-[10px] text-slate-400">PORSI</span></div>
             </div>
             {/* KOTAK 3: AYAM DIPAKAI */}
             <div className="bg-rose-950/30 border border-rose-900/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
               <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Ayam Dipakai</div>
               <div className="text-lg font-black text-white">{formatNumber(kalkulasi.butuhAyamKantong)} <span className="text-[10px] text-slate-400">KANTONG</span></div>
               <div className="text-xs font-bold text-rose-300">{formatNumber(kalkulasi.butuhAyamKg)} KG</div>
             </div>
             {/* KOTAK 4: SISA GUDANG */}
             <div className="bg-amber-950/30 border border-amber-900/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden">
               {kalkulasi.sisaAyamKantong < 0 && <div className="absolute top-0 w-full bg-rose-600 text-white text-[8px] font-black uppercase text-center py-0.5">MINUS</div>}
               <div className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">Sisa Di Gudang</div>
               <div className={`text-lg font-black ${kalkulasi.sisaAyamKantong < 0 ? 'text-rose-500' : 'text-white'}`}>{formatNumber(kalkulasi.sisaAyamKantong)} <span className="text-[10px] text-slate-400">KANTONG</span></div>
               <div className={`text-xs font-bold ${kalkulasi.sisaAyamKg < 0 ? 'text-rose-500' : 'text-amber-300'}`}>{formatNumber(kalkulasi.sisaAyamKg)} KG</div>
             </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: FORM LAPORAN PRODUKSI (BERDASARKAN ADUKAN) */}
        <div className="xl:col-span-5 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden border-t-4 border-t-amber-500">
          <div className="p-6 border-b bg-amber-50/50 shrink-0">
             <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2"><Factory size={16} className="text-amber-600"/> Laporan Adukan Dapur</h4>
          </div>
          
          <form onSubmit={handleSubmitProduksi} className="p-6 space-y-5 bg-white">
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
                <option value="">-- PILIH PRODUK --</option>
                {activeMenus.map(m => <option key={m.id} value={m.product_name}>{m.product_name}</option>)}
              </select>
            </div>

            <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 shadow-inner">
              <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-2 text-center">TOTAL ADUKAN HARI INI</label>
              <input type="number" min="1" required value={form.adukanQty} onChange={e=>setForm({...form, adukanQty: e.target.value})} className="w-full py-5 border-2 border-amber-300 rounded-2xl text-4xl font-black text-amber-900 bg-white outline-none text-center focus:border-amber-500 transition-colors" placeholder="0" />
              <p className="text-[8px] font-bold text-amber-600 uppercase text-center mt-3 tracking-widest">Ketik jumlah adukan (Contoh: 21). Sistem akan menghitung Pcs, Mika, Porsi, & Potongan Ayam secara otomatis di monitor atas.</p>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Catatan Tambahan (Opsional)</label>
              <input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none bg-slate-50 focus:border-amber-400" placeholder="Shift Pagi, Adonan Bagus..." />
            </div>

            <button type="submit" className="w-full bg-amber-500 text-white font-black py-4.5 rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-amber-500/20 hover:bg-amber-600 transition-transform active:scale-95 flex items-center justify-center gap-2 mt-4">
              <CheckCircle2 size={16}/> Simpan Produksi &amp; Potong Gudang
            </button>
          </form>
        </div>

        {/* KANTONG KANAN: JURNAL RIWAYAT PRODUKSI */}
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
                  <th className="px-5 py-4 font-black text-right">Yield (Pcs)</th>
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
                    const adukanTercatat = (p.actual_yield || p.qty) / 1000;

                    return (
                      <tr key={p.id} className="hover:bg-amber-50/30 transition-colors group">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-slate-800 font-black text-sm">{formatDate(p.date)}</div>
                          <div className="text-[9px] font-mono text-slate-400 mt-1">{p.id}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-black text-blue-700 uppercase text-xs mb-1 tracking-wide">{p.item_name}</div>
                          <div className="flex gap-2 items-center">
                            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">PIC: {p.pic || '-'}</span>
                            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">{formatNumber(adukanTercatat)} ADUKAN</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                           <span className="text-rose-600 font-black">{potongAyam ? Math.abs(potongAyam.qty_remaining) : 0} Ktg</span>
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="text-sm font-black text-emerald-600">{formatNumber(p.actual_yield || p.qty)}</div>
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center justify-center gap-1.5">
                            <button type="button" onClick={() => triggerPrint('NOTA_DOTMATRIX', {
                              title: 'BUKTI SETORAN PRODUKSI DAPUR', id: p.id, date: formatDate(p.date),
                              branch_name: currentBranch, admin_name: user?.name || 'ADMIN', customer_name: 'GUDANG FREEZER POS',
                              items: [{ name: `HASIL ADUKAN: ${p.item_name}\n(PIC: ${p.pic} - ${adukanTercatat} ADUKAN)`, qty: 1, subtotal: p.actual_yield || p.qty }],
                              amount: p.actual_yield || p.qty, paymentMethod: 'TERCATAT DI KASIR POS',
                              history: { labelLama: 'Ayam Mentah Dipakai', nominalLama: potongAyam ? Math.abs(potongAyam.qty_remaining) : 0, labelAksi: 'Status Bahan Baku', nominalAksi: 'TERPOTONG OTOMATIS', labelBaru: 'Konversi Setara', nominalBaru: `${formatNumber((p.actual_yield || p.qty)/50)} Mika` }
                            })} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors" title="Cetak Bukti Adukan"><Printer size={16}/></button>
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
