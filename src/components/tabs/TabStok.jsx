import React, { useState, useMemo } from 'react';
import { 
  Factory, Box, Search, Plus, Trash2, Printer, 
  CheckCircle2, AlertTriangle, Layers, ArrowRightLeft, Database,
  FileText, Calendar, Calculator
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
    yieldQty: '',
    usedChicken: '', // Hanya Ayam yang dipotong
    notes: ''
  });

  // --- 1. ENGINE STOK BAHAN BAKU (HANYA AYAM) ---
  const stockGudang = useMemo(() => {
    let ayamKantong = 0;
    realInventory.forEach(inv => {
      if (inv.isDeleted || (inv.branch_id !== currentBranch && currentBranch !== 'TANGERANG_PUSAT')) return;
      if (inv.category === 'BAHAN_BAKU') ayamKantong += Number(inv.qty_remaining || 0);
    });
    return { ayamKantong };
  }, [realInventory, currentBranch]);

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

  // --- ACTIONS: AUTO-CALCULATE ---
  const handleYieldChange = (val) => {
    const qtyPcs = Number(val.replace(/\D/g, ''));
    // Estimasi: 1 Kantong Ayam = 1000 Pcs Dimsum
    const estimasiAyam = Math.ceil(qtyPcs / 1000); 

    setForm({ ...form, yieldQty: String(qtyPcs), usedChicken: String(estimasiAyam) });
  };

  // --- ACTIONS: SUBMIT LAPORAN PRODUKSI ---
  const handleSubmitProduksi = async (e) => {
    e.preventDefault();
    if (Number(form.yieldQty) <= 0) return alert("Jumlah hasil produksi tidak boleh kosong!");
    if (!form.productName) return alert("Pilih menu yang diproduksi!");

    if (Number(form.usedChicken) > stockGudang.ayamKantong) {
      if (!window.confirm("⚠️ PERINGATAN: Input ayam terpakai MELEBIHI stok fisik di gudang sistem (Minus). Tetap lanjutkan?")) return;
    }

    const batchId = generateId('PRD', form.date);

    // 1. PAYLOAD PRODUKSI (MENAMBAH STOK DIMSUM KASIR POS)
    const payloadBatch = {
      id: batchId, date: form.date, branch_id: currentBranch,
      item_name: form.productName, actual_yield: Number(form.yieldQty),
      pic: form.pic.toUpperCase(), notes: form.notes.toUpperCase()
    };

    // 2. PAYLOAD INVENTORY AYAM (MEMOTONG STOK AYAM MENTAH GUDANG)
    let payloadAyam = null;
    if (Number(form.usedChicken) > 0) {
      payloadAyam = {
        id: generateId('INV', form.date), date: form.date, branch_id: currentBranch,
        category: 'BAHAN_BAKU', item_name: `PRODUKSI: ${form.productName}`, 
        qty_remaining: -Number(form.usedChicken), unit_cost: 0, status: 'USED', reference_id: batchId
      };
    }

    const isSuccess = await sendToSheet('insert', payloadBatch, 'production_batches');
    
    if (isSuccess) {
      if (payloadAyam) sendToSheet('insert', payloadAyam, 'inventory_cost_layers');
      showToast(`Produksi ${formatNumber(form.yieldQty)} Pcs ${form.productName} Sukses! Stok ayam terpotong otomatis.`, 'success');
      setForm({ ...form, productName: '', yieldQty: '', usedChicken: '', notes: '' });
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* 🚀 BANNER MONITOR GUDANG MENTAH (HANYA AYAM) */}
      <div className="bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-800 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500"></div>
        <div className="relative z-10 text-white">
           <div className="flex items-center gap-2 mb-1.5">
             <Database size={24} className="text-rose-500"/>
             <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest">Gudang Bahan Baku</h2>
           </div>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-md">
             Monitor stok daging ayam yang siap diaduk oleh Kepala Dapur hari ini.
           </p>
        </div>

        <div className="relative z-10 flex gap-4 shrink-0">
          <div className="bg-rose-950/30 border border-rose-900/50 rounded-2xl p-4 shadow-inner text-right">
             <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Stok Ayam Mentah</div>
             <div className="text-2xl md:text-3xl font-black text-white tracking-tight">{formatNumber(stockGudang.ayamKantong)} <span className="text-[10px] text-slate-500 font-bold tracking-widest">KANTONG</span></div>
             <div className="text-[9px] font-bold text-slate-500 mt-1 uppercase">≈ {formatNumber(stockGudang.ayamKantong * 10)} KG</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: FORM LAPORAN PRODUKSI */}
        <div className="xl:col-span-5 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden border-t-4 border-t-amber-500">
          <div className="p-6 border-b bg-slate-50 shrink-0">
             <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2"><Factory size={16} className="text-amber-600"/> Laporan Adukan Dapur</h4>
          </div>
          
          <form onSubmit={handleSubmitProduksi} className="p-6 space-y-5 bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Tanggal Adukan</label>
                <input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-black outline-none bg-slate-50 cursor-pointer" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Kepala Dapur</label>
                <input type="text" required value={form.pic} onChange={e=>setForm({...form, pic: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-black uppercase outline-none bg-slate-50" placeholder="Nama..." />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Menu Yang Dihasilkan</label>
              <select required value={form.productName} onChange={e=>setForm({...form, productName: e.target.value})} className="w-full p-3.5 border border-slate-200 rounded-xl text-xs font-black uppercase outline-none cursor-pointer bg-slate-50">
                <option value="">-- PILIH PRODUK --</option>
                {activeMenus.map(m => <option key={m.id} value={m.product_name}>{m.product_name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1.5">Total Dihasilkan (Pcs)</label>
              <input type="text" required value={form.yieldQty ? Number(form.yieldQty).toLocaleString('id-ID') : ''} onChange={e=>handleYieldChange(e.target.value)} className="w-full p-4 border-2 border-emerald-200 rounded-2xl text-lg font-black text-emerald-800 bg-emerald-50/30 outline-none text-center" placeholder="Cth: 5000" />
            </div>

            {/* 🔥 PANEL KALKULATOR KONVERSI INFORMASIONAL (TIDAK MEMOTONG STOK MIKA) */}
            {form.yieldQty && (
              <div className="bg-indigo-50/50 p-4 border border-indigo-200 rounded-2xl animate-in fade-in duration-300">
                <h5 className="text-[9px] font-black text-indigo-800 uppercase tracking-widest flex items-center gap-1.5 mb-2"><Calculator size={12}/> Konversi Nilai Barang Jadi:</h5>
                <div className="flex gap-4">
                  <div className="flex-1 bg-white border border-indigo-100 rounded-xl p-2.5 text-center shadow-sm">
                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-0.5">Setara Mika (50)</div>
                    <div className="text-sm font-black text-indigo-700">{formatNumber(Math.floor(Number(form.yieldQty) / 50))}</div>
                  </div>
                  <div className="flex-1 bg-white border border-indigo-100 rounded-xl p-2.5 text-center shadow-sm">
                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-0.5">Setara Porsi (4)</div>
                    <div className="text-sm font-black text-indigo-700">{formatNumber(Math.floor(Number(form.yieldQty) / 4))}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-rose-50/50 p-4 border border-rose-200 rounded-2xl animate-in fade-in duration-300">
              <label className="text-[9px] font-black text-rose-600 uppercase tracking-widest flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5"><ArrowRightLeft size={12}/> Ayam Terpakai (Kantong)</span>
                <span className="text-[8px] bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded">AUTO DEDUCT GUDANG</span>
              </label>
              <input type="number" required min="0" value={form.usedChicken} onChange={e=>setForm({...form, usedChicken: e.target.value})} className="w-full p-3 bg-white border border-rose-200 rounded-xl font-black text-sm outline-none" />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Catatan Dapur (Opsional)</label>
              <input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none bg-slate-50" placeholder="Shift Pagi, Adonan Bagus..." />
            </div>

            <button type="submit" className="w-full bg-amber-500 text-white font-black py-4.5 rounded-2xl text-xs uppercase tracking-widest shadow-xl hover:bg-amber-600 transition-transform active:scale-95 flex items-center justify-center gap-2 mt-4">
              <CheckCircle2 size={16}/> Lapor Produksi &amp; Potong Ayam
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

                    return (
                      <tr key={p.id} className="hover:bg-amber-50/30 transition-colors group">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-slate-800 font-black text-sm">{formatDate(p.date)}</div>
                          <div className="text-[9px] font-mono text-slate-400 mt-1">{p.id}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-black text-blue-700 uppercase text-xs mb-1 tracking-wide">{p.item_name}</div>
                          <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">PIC: {p.pic || '-'}</span>
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
                              items: [{ name: `HASIL ADUKAN: ${p.item_name}\n(PIC: ${p.pic})`, qty: 1, subtotal: p.actual_yield || p.qty }],
                              amount: p.actual_yield || p.qty, paymentMethod: 'TERCATAT DI KASIR POS',
                              history: { labelLama: 'Ayam Mentah Dipakai', nominalLama: potongAyam ? Math.abs(potongAyam.qty_remaining) : 0, labelAksi: 'Status Bahan Baku', nominalAksi: 'TERPOTONG OTOMATIS', labelBaru: 'Konversi', nominalBaru: `${Math.floor((p.actual_yield || p.qty)/50)} Mika` }
                            })} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"><Printer size={16}/></button>
                            <button type="button" onClick={() => { if(window.confirm("Yakin void transaksi ini? Stok kasir dan ayam gudang akan dikembalikan!")) requestDelete(p.id); }} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 size={16}/></button>
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
