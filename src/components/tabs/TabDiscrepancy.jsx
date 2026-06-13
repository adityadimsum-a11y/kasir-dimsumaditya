import React, { useState, useMemo, useEffect } from 'react';
import { 
  AlertTriangle, Archive, FileText, CheckCircle2, 
  Trash2, Search, Calendar, Package, AlertOctagon, ArrowDownToLine
} from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabDiscrepancy({ 
  masterProducts = [], master_products,
  inventoryCostLayers = [], inventory_cost_layers,
  discrepancyLogs = [], discrepancy_logs,
  sendToSheet, showToast, user, requestDelete 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  // --- SINKRONISASI DATABASE ---
  const realProducts = useMemo(() => master_products || masterProducts || [], [master_products, masterProducts]);
  const realInventory = useMemo(() => inventory_cost_layers || inventoryCostLayers || [], [inventory_cost_layers, inventoryCostLayers]);
  const realDiscrepancy = useMemo(() => discrepancy_logs || discrepancyLogs || [], [discrepancy_logs, discrepancyLogs]);

  // --- STATE MANAGEMENT ---
  const [tableDateFilter, setTableDateFilter] = useState(todayStr);
  const [form, setForm] = useState({
    date: todayStr,
    pic: user?.name || '',
    category: 'PRODUK_JADI',
    itemName: '',
    qty: '',
    unitCost: 0,
    reason: 'BASI / RUSAK',
    notes: ''
  });

  // --- 1. ENGINE DROPDOWN ITEM DINAMIS ---
  // Ekstrak nama item unik dari Gudang untuk Bahan Baku & Packaging
  const rawMaterials = useMemo(() => [...new Set(realInventory.filter(i => i.category === 'BAHAN_BAKU').map(i => i.item_name))], [realInventory]);
  const packaging = useMemo(() => [...new Set(realInventory.filter(i => i.category === 'PACKAGING').map(i => i.item_name))], [realInventory]);
  const produkJadi = useMemo(() => realProducts.filter(p => !p.isDeleted && String(p.isDeleted).toUpperCase() !== 'TRUE').map(p => p.product_name), [realProducts]);

  const currentOptions = useMemo(() => {
    if (form.category === 'PRODUK_JADI') return produkJadi;
    if (form.category === 'BAHAN_BAKU') return rawMaterials;
    if (form.category === 'PACKAGING') return packaging;
    return [];
  }, [form.category, produkJadi, rawMaterials, packaging]);

  // --- 2. ENGINE AUTO-HPP (MENCARI HARGA MODAL BARANG RUSAK) ---
  useEffect(() => {
    if (!form.itemName) {
      setForm(prev => ({ ...prev, unitCost: 0 }));
      return;
    }

    let cost = 0;
    if (form.category === 'PRODUK_JADI') {
      const prod = realProducts.find(p => p.product_name === form.itemName);
      if (prod) cost = Number(prod.default_hpp || 0);
    } else {
      // Cari riwayat beli terakhir di gudang untuk item ini
      const lastPurchase = [...realInventory].reverse().find(i => i.item_name === form.itemName && Number(i.unit_cost) > 0);
      if (lastPurchase) cost = Number(lastPurchase.unit_cost);
    }
    
    setForm(prev => ({ ...prev, unitCost: cost }));
  }, [form.itemName, form.category, realProducts, realInventory]);

  // --- 3. JURNAL HISTORI PEMUTIHAN ---
  const historyDiscrepancy = useMemo(() => {
    return realDiscrepancy
      .filter(d => !d.isDeleted && d.date.substring(0, 10) === tableDateFilter && (d.branch_id === currentBranch || currentBranch === 'TANGERANG_PUSAT'))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realDiscrepancy, tableDateFilter, currentBranch]);

  // --- METRIK KERUGIAN HARI INI ---
  const totalKerugianHariIni = useMemo(() => {
    return historyDiscrepancy.reduce((sum, log) => sum + Number(log.total_loss || 0), 0);
  }, [historyDiscrepancy]);

  // --- ACTIONS: SUBMIT PEMUTIHAN STOK ---
  const handleSubmitDiscrepancy = async (e) => {
    e.preventDefault();
    const qtyBuang = Number(form.qty);
    if (qtyBuang <= 0) return alert("Jumlah barang rusak/hilang harus lebih dari 0!");
    if (!form.itemName) return alert("Pilih nama barang yang akan diputihkan!");

    const totalKerugian = qtyBuang * form.unitCost;

    if (!window.confirm(`PERINGATAN PEMUTIHAN STOK!\n\nBarang: ${form.itemName}\nJumlah Dibuang: ${qtyBuang}\nEstimasi Kerugian: ${formatRupiah(totalKerugian)}\nAlasan: ${form.reason}\n\nData akan dicatat sebagai Kerugian Operasional dan stok akan dipotong permanen. Lanjutkan?`)) {
      return;
    }

    const logId = generateId('DSC', form.date);

    // 1. PAYLOAD JURNAL UTAMA (DISCREPANCY LOGS)
    const payloadLog = {
      id: logId,
      date: form.date,
      branch_id: currentBranch,
      category: form.category,
      item_name: form.itemName,
      qty: qtyBuang,
      unit_cost: form.unitCost,
      total_loss: totalKerugian,
      reason: form.reason,
      notes: form.notes.toUpperCase(),
      pic: form.pic.toUpperCase()
    };

    // 2. PAYLOAD PEMOTONGAN FISIK (TERGANTUNG KATEGORI BARANG)
    let payloadMinus = null;
    let tableMinus = '';

    if (form.category === 'PRODUK_JADI') {
      // Tembak ke production_batches sebagai "Produksi Minus" agar Kasir POS otomatis ngurang
      tableMinus = 'production_batches';
      payloadMinus = {
        id: generateId('PRD', form.date) + '-VOID', date: form.date, branch_id: currentBranch,
        item_name: form.itemName, actual_yield: -qtyBuang, 
        pic: 'SISTEM OPNAME', notes: `PENGURANGAN OTOMATIS: ${form.reason} (Ref: ${logId})`
      };
    } else {
      // Tembak ke inventory_cost_layers untuk potong gudang ayam/mika
      tableMinus = 'inventory_cost_layers';
      payloadMinus = {
        id: generateId('INV', form.date) + '-VOID', date: form.date, branch_id: currentBranch,
        category: form.category, item_name: `OPNAME: ${form.itemName}`, 
        qty_remaining: -qtyBuang, unit_cost: 0, status: 'DISCREPANCY', reference_id: logId
      };
    }

    // Eksekusi API
    const isSuccess = await sendToSheet('insert', payloadLog, 'discrepancy_logs');

    if (isSuccess) {
      // Tembak pemotongan fisik di background
      if (payloadMinus) await sendToSheet('insert', payloadMinus, tableMinus);

      showToast(`Pemutihan Stok Berhasil! Kerugian Rp ${formatNumber(totalKerugian)} telah dicatat.`, 'success');
      setForm({ ...form, itemName: '', qty: '', unitCost: 0, notes: '' });
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* 🚀 BANNER MODAL DISCREPANCY */}
      <div className="bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-800 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 to-amber-500"></div>
        <div className="relative z-10 text-white">
           <div className="flex items-center gap-2 mb-1.5">
             <AlertOctagon size={24} className="text-rose-500 animate-pulse"/>
             <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest">Opname &amp; Pemutihan Stok</h2>
           </div>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-lg">
             Buang barang basi, rusak, atau hilang secara legal di sistem. Transaksi ini akan mencatat HPP barang sebagai Kerugian Operasional Pabrik.
           </p>
        </div>

        <div className="relative z-10 flex gap-4 shrink-0">
          <div className="bg-rose-950/30 border border-rose-900/50 rounded-2xl p-4 shadow-inner text-right">
             <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Total Nilai Kerugian (Hari Ini)</div>
             <div className="text-2xl md:text-3xl font-black text-white tracking-tight">{formatRupiah(totalKerugianHariIni)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: FORM INPUT BARANG RUSAK */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden border-t-4 border-t-rose-500">
          <div className="p-6 border-b bg-rose-50/30 shrink-0">
             <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2"><Trash2 size={16} className="text-rose-600"/> Form Laporan Barang Rusak / Hilang</h4>
          </div>
          
          <form onSubmit={handleSubmitDiscrepancy} className="p-6 space-y-5 flex-1 bg-white">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Tanggal Kejadian</label>
                <input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-black outline-none bg-slate-50 focus:bg-white focus:border-rose-400 transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Nama PIC Laporan</label>
                <input type="text" required value={form.pic} onChange={e=>setForm({...form, pic: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-black uppercase outline-none bg-slate-50 focus:bg-white focus:border-rose-400 transition-colors" placeholder="Nama..." />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Pilih Kategori Lokasi Barang</label>
              <select required value={form.category} onChange={e=>setForm({...form, category: e.target.value, itemName: ''})} className="w-full p-3 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none cursor-pointer bg-slate-50 focus:bg-white focus:border-rose-400 transition-colors">
                <option value="PRODUK_JADI">🛒 PRODUK MATANG (KASIR POS / FREEZER DEPAN)</option>
                <option value="BAHAN_BAKU">🥩 BAHAN BAKU AYAM (GUDANG BELAKANG)</option>
                <option value="PACKAGING">📦 PACKAGING MIKA (GUDANG BELAKANG)</option>
              </select>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-inner">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 flex items-center justify-between">
                <span>Nama Barang Spesifik</span>
                {form.unitCost > 0 && <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[8px]">HPP: {formatRupiah(form.unitCost)}</span>}
              </label>
              <select required value={form.itemName} onChange={e=>setForm({...form, itemName: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl text-xs font-black uppercase outline-none cursor-pointer bg-white focus:border-rose-500 shadow-sm transition-colors">
                <option value="">-- DAFTAR BARANG {form.category.replace('_', ' ')} --</option>
                {currentOptions.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest block mb-1">Jumlah Dibuang</label>
                <input type="number" min="1" required value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-3 border-2 border-rose-200 rounded-xl text-lg font-black text-rose-800 text-center bg-rose-50/50 outline-none focus:bg-white focus:border-rose-500 transition-colors shadow-inner" placeholder="0" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Penyebab / Alasan</label>
                <select required value={form.reason} onChange={e=>setForm({...form, reason: e.target.value})} className="w-full p-3.5 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none cursor-pointer bg-slate-50 focus:border-rose-400 transition-colors">
                  <option value="BASI / RUSAK">BASI / RUSAK</option>
                  <option value="HILANG DICURI">HILANG DICURI</option>
                  <option value="BUNGKUS SOBEK">BUNGKUS SOBEK / PECAH</option>
                  <option value="SELISIH OPNAME">SELISIH OPNAME GUDANG</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Keterangan Detail (Wajib Diisi)</label>
              <input type="text" required value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none bg-slate-50 focus:bg-white focus:border-rose-400 transition-colors" placeholder="Cth: Jatuh saat diangkut, dimakan tikus..." />
            </div>

            <button type="submit" className="w-full bg-rose-600 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-rose-600/20 hover:bg-rose-700 transition-transform active:scale-95 flex justify-center items-center gap-2 mt-4">
              <AlertTriangle size={16}/> Putihkan Stok &amp; Catat Kerugian
            </button>
          </form>
        </div>

        {/* KANTONG KANAN: JURNAL HISTORI DISCREPANCY */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-[75vh]">
          <div className="p-5 border-b bg-slate-50 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
             <div>
               <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2"><FileText size={16} className="text-amber-600"/> Buku Jurnal Kerugian Operasional</h4>
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">Histori stok dibuang / diputihkan secara sistem.</p>
             </div>
             <div className="flex items-center gap-2 bg-white border border-slate-300 px-3 py-2 rounded-xl shadow-sm">
               <Calendar size={14} className="text-blue-500 ml-0.5"/>
               <input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value || todayStr)} className="text-xs font-black text-slate-800 outline-none bg-transparent cursor-pointer" />
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-white text-[10px] uppercase text-slate-400 sticky top-0 shadow-sm border-b border-slate-100">
                <tr>
                  <th className="px-5 py-4 font-black">Waktu &amp; Laporan</th>
                  <th className="px-5 py-4 font-black">Detail Barang Rusak</th>
                  <th className="px-5 py-4 font-black text-right">Nilai Kerugian</th>
                  <th className="px-5 py-4 font-black text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs font-bold">
                {historyDiscrepancy.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-24 text-slate-400 font-black uppercase tracking-widest bg-slate-50/50">
                      <div className="flex justify-center mb-3 opacity-20"><Archive size={40}/></div>
                      Aman Terkendali! Tidak ada laporan barang rusak hari ini.
                    </td>
                  </tr>
                ) : (
                  historyDiscrepancy.map(log => (
                    <tr key={log.id} className="hover:bg-rose-50/30 transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-black">{formatDate(log.date)}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-1">{log.id}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border mb-1.5 inline-block bg-slate-100 text-slate-600 border-slate-200">
                          {log.category.replace('_', ' ')}
                        </span>
                        <div className="font-black text-rose-700 uppercase text-xs mb-1 line-clamp-2">{log.item_name} <span className="text-slate-500">(x{formatNumber(log.qty)})</span></div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase flex flex-col gap-0.5">
                          <span>Alasan: <span className="text-amber-600">{log.reason}</span></span>
                          <span className="line-clamp-1 truncate">"{log.notes}" - (PIC: {log.pic})</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="text-rose-600 font-black text-sm">{formatRupiah(log.total_loss)}</div>
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">HPP: {formatRupiah(log.unit_cost)}/Pcs</div>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => { if(window.confirm("PERINGATAN!\n\nMenghapus log ini HANYA menghilangkan catatan kerugian di layar, namun STOK BARANG TIDAK AKAN KEMBALI secara otomatis (karena sudah terlanjur dibuang).\n\nTetap hapus catatan ini?")) requestDelete(log.id); }} className="p-2.5 text-slate-500 bg-white border shadow-sm hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" title="Hapus Catatan Kerugian"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
