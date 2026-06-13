import React, { useState, useMemo } from 'react';
import { 
  Factory, Box, Package, Search, Plus, Trash2, Printer, 
  CheckCircle2, AlertTriangle, Clock, Layers, ArrowRightLeft, Database,
  FileText, Calendar // 🔥 FIX CRASH: IKON SUDAH DITAMBAHKAN DI SINI
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
    usedChicken: '', // Dalam Kantong
    usedMika: '',    // Dalam Pcs/Lembar
    notes: ''
  });

  // --- 1. ENGINE STOK BAHAN BAKU (GUDANG AYAM & MIKA) ---
  const stockGudang = useMemo(() => {
    let ayamKantong = 0;
    let packagingMika = 0;

    realInventory.forEach(inv => {
      if (inv.isDeleted || (inv.branch_id !== currentBranch && currentBranch !== 'TANGERANG_PUSAT')) return;
      
      // Mengingat di TabPurchases, Ayam disave pakai Kategori BAHAN_BAKU dan sudah dikonversi ke Kantong
      if (inv.category === 'BAHAN_BAKU') {
        ayamKantong += Number(inv.qty_remaining || 0);
      }
      if (inv.category === 'PACKAGING') {
        packagingMika += Number(inv.qty_remaining || 0);
      }
    });

    return { ayamKantong, packagingMika };
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

  // --- ACTIONS: AUTO-CALCULATE BAHAN BAKU ---
  const handleYieldChange = (val) => {
    const qtyPcs = Number(val.replace(/\D/g, ''));
    
    // RUMUS SAKTI PABRIK:
    // 1 Kantong Ayam = 1000 Pcs Dimsum
    // 1 Mika = 50 Pcs Dimsum
    const estimasiAyam = Math.ceil(qtyPcs / 1000); 
    const estimasiMika = Math.ceil(qtyPcs / 50);

    setForm({
      ...form, 
      yieldQty: String(qtyPcs),
      usedChicken: String(estimasiAyam),
      usedMika: String(estimasiMika)
    });
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

    // 1. PAYLOAD PRODUKSI (MENAMBAH STOK DIMSUM JADI DI KASIR POS)
    const payloadBatch = {
      id: batchId,
      date: form.date,
      branch_id: currentBranch,
      item_name: form.productName,
      actual_yield: Number(form.yieldQty),
      pic: form.pic.toUpperCase(),
      notes: form.notes.toUpperCase()
    };

    // 2. PAYLOAD INVENTORY AYAM (MEMOTONG STOK AYAM MENTAH)
    let payloadAyam = null;
    if (Number(form.usedChicken) > 0) {
      payloadAyam = {
        id: generateId('INV', form.date), date: form.date, branch_id: currentBranch,
        category: 'BAHAN_BAKU', item_name: `PRODUKSI: ${form.productName}`, 
        qty_remaining: -Number(form.usedChicken), // Minus untuk memotong stok
        unit_cost: 0, status: 'USED', reference_id: batchId
      };
    }

    // 3. PAYLOAD INVENTORY MIKA (MEMOTONG STOK MIKA KOSONG)
    let payloadMika = null;
    if (Number(form.usedMika) > 0) {
      payloadMika = {
        id: generateId('INV', form.date) + 'M', date: form.date, branch_id: currentBranch,
        category: 'PACKAGING', item_name: `PRODUKSI: ${form.productName}`, 
        qty_remaining: -Number(form.usedMika), // Minus untuk memotong stok
        unit_cost: 0, status: 'USED', reference_id: batchId
      };
    }

    const isSuccess = await sendToSheet('insert', payloadBatch, 'production_batches');
    
    if (isSuccess) {
      // Tembak pemotongan gudang di background
      if (payloadAyam) sendToSheet('insert', payloadAyam, 'inventory_cost_layers');
      if (payloadMika) sendToSheet('insert', payloadMika, 'inventory_cost_layers');

      showToast(`Produksi ${formatNumber(form.yieldQty)} Pcs ${form.productName} Sukses! Stok gudang otomatis terpotong.`, 'success');
      setForm({ ...form, productName: '', yieldQty: '', usedChicken: '', usedMika: '', notes: '' });
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* 🚀 BANNER MONITOR GUDANG MENTAH */}
      <div className="bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500"></div>
        <div className="flex items-center gap-2 mb-5 relative z-10">
           <Database size={18} className="text-amber-400"/>
           <h3 className="text-white font-black uppercase tracking-widest text-xs">Kapasitas Gudang Mentah Saat Ini</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 relative z-10">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-inner flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Layers size={12}/> Ayam Mentah</div>
              <div className="text-3xl font-black text-white tracking-tight">{formatNumber(stockGudang.ayamKantong)} <span className="text-[10px] text-slate-500 font-bold tracking-widest">KANTONG</span></div>
              <div className="text-[9px] font-bold text-slate-500 mt-1 uppercase">≈ {formatNumber(stockGudang.ayamKantong * 10)} KG</div>
            </div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-inner flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Package size={12}/> Packaging Mika</div>
              <div className="text-3xl font-black text-white tracking-tight">{formatNumber(stockGudang.packagingMika)} <span className="text-[10px] text-slate-500 font-bold tracking-widest">LEMBAR</span></div>
              <div className="text-[9px] font-bold text-slate-500 mt-1 uppercase">Stok kemasan kosong</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: FORM LAPORAN PRODUKSI */}
        <div className="xl:col-span-5 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden border-t-4 border-t-amber-500">
          <div className="p-6 border-b bg-slate-50 shrink-0">
             <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2"><Factory size={16} className="text-amber-600"/> Laporan Hasil Produksi Dapur</h4>
             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5 leading-relaxed">Menambah stok barang matang (Kasir POS) dan otomatis memotong bahan mentah (Gudang).</p>
          </div>
          
          <form onSubmit={handleSubmitProduksi} className="p-6 space-y-5 bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Tanggal Adukan</label>
                <input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-black outline-none bg-slate-50 focus:bg-white focus:border-amber-500 transition-colors cursor-pointer" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Kepala Dapur / PIC</label>
                <input type="text" required value={form.pic} onChange={e=>setForm({...form, pic: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-black uppercase outline-none bg-slate-50 focus:bg-white focus:border-amber-500 transition-colors" placeholder="Nama..." />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Pilih Menu Jadi (Masuk Freezer POS)</label>
              <select required value={form.productName} onChange={e=>setForm({...form, productName: e.target.value})} className="w-full p-3.5 border border-slate-200 rounded-xl text-xs font-black uppercase outline-none cursor-pointer bg-slate-50 focus:bg-white focus:border-amber-500 transition-colors">
                <option value="">-- PILIH PRODUK YANG DIADUK --</option>
                {activeMenus.map(m => <option key={m.id} value={m.product_name}>{m.product_name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1.5">Total Dihasilkan (Volume Pcs)</label>
              <input type="text" required value={form.yieldQty ? Number(form.yieldQty).toLocaleString('id-ID') : ''} onChange={e=>handleYieldChange(e.target.value)} className="w-full p-4 border-2 border-emerald-200 rounded-2xl text-lg font-black text-emerald-800 bg-emerald-50/30 outline-none focus:bg-white focus:border-emerald-500 transition-colors shadow-inner" placeholder="Cth: 5000" />
            </div>

            <div className="bg-rose-50/50 p-5 border border-rose-200 rounded-2xl shadow-inner animate-in fade-in duration-300">
              <h5 className="text-[10px] font-black text-rose-800 uppercase tracking-widest flex items-center gap-1.5 mb-4 border-b border-rose-100 pb-2"><ArrowRightLeft size={14}/> Auto-Deduct Bahan Baku</h5>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-rose-600 uppercase tracking-widest block mb-1.5">Ayam Terpakai (Kantong)</label>
                  <input type="number" required min="0" value={form.usedChicken} onChange={e=>setForm({...form, usedChicken: e.target.value})} className="w-full p-3 bg-white border border-rose-200 rounded-xl font-black text-sm text-center outline-none focus:border-rose-400 transition-colors" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-amber-700 uppercase tracking-widest block mb-1.5">Mika Terpakai (Pcs)</label>
                  <input type="number" required min="0" value={form.usedMika} onChange={e=>setForm({...form, usedMika: e.target.value})} className="w-full p-3 bg-white border border-amber-200 rounded-xl font-black text-sm text-center outline-none focus:border-amber-400 transition-colors" />
                </div>
              </div>
              <p className="text-[8px] font-bold text-rose-600/70 uppercase mt-3 tracking-widest leading-relaxed">Sistem otomatis menghitung estimasi (1 Kantong Ayam = 1000 Pcs Dimsum). Ubah angka di atas jika realita lapangan berbeda.</p>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Catatan Dapur (Opsional)</label>
              <input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none bg-slate-50 focus:bg-white focus:border-amber-500 transition-colors" placeholder="Shift Pagi, Adonan Bagus..." />
            </div>

            <button type="submit" className="w-full bg-slate-900 text-white font-black py-4.5 rounded-2xl text-xs uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-transform active:scale-95 flex items-center justify-center gap-2 mt-4">
              <CheckCircle2 size={16}/> Sahkan Produksi &amp; Potong Gudang
            </button>
          </form>
        </div>

        {/* KANTONG KANAN: JURNAL RIWAYAT PRODUKSI */}
        <div className="xl:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h4 className="font-black text-xs uppercase text-slate-800 tracking-widest flex items-center gap-2"><FileText size={16} className="text-blue-600"/> Jurnal Buku Produksi Dapur</h4>
              <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wider">Histori barang matang yang berhasil dicetak.</p>
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
                  <th className="px-5 py-4 font-black">Waktu &amp; ID Batch</th>
                  <th className="px-5 py-4 font-black">Nama Menu Dimasak</th>
                  <th className="px-5 py-4 font-black text-right">Yield (Pcs)</th>
                  <th className="px-5 py-4 font-black text-center">Aksi Op</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-50">
                {historyProduction.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-20 text-slate-400 font-black uppercase tracking-widest bg-slate-50/50">
                      <div className="flex justify-center mb-3 opacity-20"><Factory size={40}/></div>
                      Tidak ada aktivitas produksi / adukan untuk tanggal yang dipilih.
                    </td>
                  </tr>
                ) : (
                  historyProduction.map(p => {
                    // Cari data potong gudang berdasarkan reference_id
                    const logsPotong = realInventory.filter(inv => inv.reference_id === p.id);
                    const potongAyam = logsPotong.find(inv => inv.category === 'BAHAN_BAKU');
                    const potongMika = logsPotong.find(inv => inv.category === 'PACKAGING');

                    return (
                      <tr key={p.id} className="hover:bg-amber-50/30 transition-colors group">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-slate-800 font-black text-sm">{formatDate(p.date)}</div>
                          <div className="text-[9px] font-mono text-slate-400 mt-1">{p.id}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-black text-blue-700 uppercase text-xs mb-1 tracking-wide">{p.item_name}</div>
                          <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded border border-slate-200 bg-slate-100 text-slate-600 mb-2 inline-block tracking-widest">PIC: {p.pic || 'TIDAK ADA NAMA'}</span>
                          
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 mt-1">
                            <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 border-b border-slate-200 pb-1">Bahan Baku Disedot:</div>
                            <div className="text-[9px] font-bold text-rose-600 uppercase">
                              • Ayam: {potongAyam ? Math.abs(potongAyam.qty_remaining) : '?'} Kantong
                            </div>
                            <div className="text-[9px] font-bold text-amber-600 uppercase mt-0.5">
                              • Mika: {potongMika ? Math.abs(potongMika.qty_remaining) : '?'} Pcs
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl inline-block shadow-sm">
                            <div className="text-[10px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-1.5"><ArrowRightLeft size={10}/> TERCETAK</div>
                            <div className="text-sm font-black text-emerald-600 mt-0.5">{formatNumber(p.actual_yield || p.qty)} Pcs</div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center justify-center gap-1.5">
                            <button type="button" onClick={() => triggerPrint('NOTA_DOTMATRIX', {
                              title: 'BUKTI SETORAN PRODUKSI DAPUR', id: p.id, date: formatDate(p.date),
                              branch_name: currentBranch, admin_name: user?.name || 'ADMIN', customer_name: 'GUDANG FREEZER POS',
                              items: [{ name: `HASIL ADUKAN: ${p.item_name}\n(PIC: ${p.pic})`, qty: 1, subtotal: p.actual_yield || p.qty }],
                              amount: p.actual_yield || p.qty, paymentMethod: 'TERCATAT DI KASIR POS',
                              history: { 
                                labelLama: 'Ayam Mentah Dipakai', nominalLama: potongAyam ? Math.abs(potongAyam.qty_remaining) : 0, 
                                labelAksi: 'Plastik Mika Dipakai', nominalAksi: potongMika ? Math.abs(potongMika.qty_remaining) : 0, 
                                labelBaru: 'STATUS BAHAN BAKU', nominalBaru: 'TERPOTONG OTOMATIS' 
                              }
                            })} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors" title="Cetak Bukti Produksi"><Printer size={16}/></button>
                            
                            {/* Tombol Void dengan Alert Extra karena menyangkut pengembalian stok */}
                            <button type="button" onClick={() => { if(window.confirm("PERINGATAN KRUSIAL!\n\nMembatalkan data produksi ini akan MENARIK KEMBALI stok dari POS Kasir, dan MENGEMBALIKAN stok ayam/mika ke Gudang.\n\nYakin void transaksi produksi ini?")) requestDelete(p.id); }} className="p-2.5 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" title="Void & Kembalikan Stok Gudang"><Trash2 size={16}/></button>
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
