import React, { useState, useMemo, useEffect } from 'react';
import { 
  AlertTriangle, Archive, FileText, CheckCircle2, 
  Trash2, Search, Calendar, Package, AlertOctagon, ArrowDownToLine
} from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

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

  // --- SINKRONISASI DATABASE (DUAL-READ AMAN DARI UNDEFINED) ---
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

    if (!window.confirm(`PERINGATAN PEMUTIHAN STOK!\n\nBarang: ${form.itemName}\nJumlah Dibuang: ${qtyBuang}\nEstimasi Kerugian: ${formatRupiah(totalKerugian)}\nAlasan: ${form.reason}\n\nData akan dicatat sebagai Kerugian Operasional dan stok fisik akan dipotong permanen. Lanjutkan?`)) {
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
      pic: form.pic.toUpperCase(),
      isDeleted: false
    };

    // 2. PAYLOAD PEMOTONGAN FISIK
    let payloadMinus = null;
    let tableMinus = '';

    if (form.category === 'PRODUK_JADI') {
      tableMinus = 'production_batches';
      payloadMinus = {
        id: generateId('PRD', form.date) + '-VOID', date: form.date, branch_id: currentBranch,
        item_name: form.itemName, actual_yield: -qtyBuang, 
        pic: 'SISTEM OPNAME', notes: `Pengurangan otomatis: ${form.reason} (Ref: ${logId})`,
        isDeleted: false
      };
    } else {
      tableMinus = 'inventory_cost_layers';
      payloadMinus = {
        id: generateId('INV', form.date) + '-VOID', date: form.date, branch_id: currentBranch,
        category: form.category, item_name: `OPNAME: ${form.itemName}`, 
        qty_remaining: -qtyBuang, unit_cost: 0, status: 'DISCREPANCY', reference_id: logId,
        isDeleted: false
      };
    }

    const isSuccess = await sendToSheet('insert', payloadLog, 'discrepancy_logs');

    if (isSuccess) {
      if (payloadMinus) await sendToSheet('insert', payloadMinus, tableMinus);

      showToast(`Pemutihan stok berhasil! Kerugian Rp ${formatNumber(totalKerugian)} telah dicatat.`, 'success');
      setForm({ ...form, itemName: '', qty: '', unitCost: 0, notes: '' });
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-200">
      
      {/* 🚀 BANNER UTAMA - FLUID GRADIENT ENTERPRISE STYLE */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 lg:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 rounded-3xl shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 p-4 opacity-5"><AlertOctagon size={120} className="text-rose-500"/></div>
        <div className="relative z-10">
           <div className="flex items-center gap-2 mb-2">
             <AlertOctagon size={24} className="text-rose-500"/>
             <h2 className="text-xl font-black text-white tracking-wide">Opname &amp; Pemutihan Stok (Discrepancy)</h2>
           </div>
           <p className="text-[11px] font-bold text-slate-400 mt-1 max-w-lg leading-relaxed normal-case">
             Catat barang basi, rusak, atau hilang. Sistem akan otomatis memotong fisik dan membukukan nilai HPP sebagai kerugian di dalam jurnal akuntansi pusat.
           </p>
        </div>

        <div className="flex bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-inner text-right min-w-[240px] shrink-0 w-full md:w-auto relative z-10 backdrop-blur-sm">
           <div className="flex-1">
             <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5">Total Nilai Kerugian (Hari Ini)</div>
             <div className="text-3xl font-black text-rose-400 tracking-tight">{formatRupiah(totalKerugianHariIni)}</div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: FORM INPUT BARANG RUSAK */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden border-t-4 border-t-rose-500">
          <div className="p-5 border-b border-slate-100 bg-slate-50 shrink-0">
             <h4 className="font-black text-slate-800 text-sm flex items-center gap-2"><Trash2 size={18} className="text-rose-600"/> Form Lembar Barang Rusak / Hilang</h4>
          </div>
          
          <form onSubmit={handleSubmitDiscrepancy} className="p-6 space-y-5 flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Tanggal Kejadian</label>
                <input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold outline-none bg-slate-50 focus:bg-white focus:border-rose-400 transition-colors shadow-sm cursor-pointer" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Nama PIC Laporan</label>
                <input type="text" required value={form.pic} onChange={e=>setForm({...form, pic: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold outline-none bg-slate-50 focus:bg-white focus:border-rose-400 transition-colors shadow-sm uppercase tracking-wider" placeholder="Ketik nama..." />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Kategori Lokasi Barang</label>
              <select required value={form.category} onChange={e=>setForm({...form, category: e.target.value, itemName: ''})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer bg-slate-50 focus:bg-white focus:border-rose-400 transition-colors shadow-sm">
                <option value="PRODUK_JADI">🛒 Produk Matang (Kasir POS / Freezer)</option>
                <option value="BAHAN_BAKU">🥩 Bahan Baku Ayam (Gudang Dapur)</option>
                <option value="PACKAGING">📦 Packaging Mika (Gudang Belakang)</option>
              </select>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-inner">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between mb-2">
                <span>Pilih Spesifik Barang</span>
                {form.unitCost > 0 && <span className="bg-white border border-rose-200 text-rose-600 px-2.5 py-1 rounded-md text-[9px] shadow-sm font-black tracking-wider">HPP: {formatRupiah(form.unitCost)}</span>}
              </label>
              <select required value={form.itemName} onChange={e=>setForm({...form, itemName: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl text-sm font-black uppercase outline-none cursor-pointer bg-white focus:border-rose-500 shadow-sm transition-colors">
                <option value="">-- Daftar Barang {form.category.replace('_', ' ')} --</option>
                {currentOptions.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-rose-600 uppercase tracking-wider block mb-1.5">Jumlah Dibuang Fisik</label>
                <input type="number" min="1" required value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-3 border-2 border-rose-200 rounded-xl text-lg font-black text-rose-700 text-center bg-rose-50/50 outline-none focus:bg-white focus:border-rose-500 transition-colors shadow-inner" placeholder="0" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Penyebab Utama</label>
                <select required value={form.reason} onChange={e=>setForm({...form, reason: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-[11px] font-bold outline-none cursor-pointer bg-slate-50 focus:bg-white focus:border-rose-400 transition-colors shadow-sm">
                  <option value="BASI / RUSAK">Basi / Rusak</option>
                  <option value="HILANG DICURI">Hilang Dicuri</option>
                  <option value="BUNGKUS SOBEK">Bungkus Sobek / Pecah</option>
                  <option value="SELISIH OPNAME">Selisih Opname Gudang</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Keterangan Tambahan (Wajib)</label>
              <input type="text" required value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-medium outline-none bg-slate-50 focus:bg-white focus:border-rose-400 transition-colors shadow-sm normal-case" placeholder="Cth: Jatuh saat diangkut supir, dimakan tikus..." />
            </div>

            <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-xl text-xs font-black shadow-md flex justify-center items-center gap-2 mt-2 transition-transform active:scale-95 cursor-pointer uppercase tracking-wider">
              <AlertTriangle size={16}/> Sahkan Pemutihan &amp; Catat Kerugian
            </button>
          </form>
        </div>

        {/* KANTONG KANAN: JURNAL HISTORI DISCREPANCY */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden h-[75vh]">
          <div className="p-5 border-b border-slate-100 bg-slate-50 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
             <div>
               <h4 className="font-black text-slate-800 text-sm flex items-center gap-2"><FileText size={18} className="text-rose-600"/> Buku Jurnal Kerugian Operasional</h4>
               <p className="text-[10px] text-slate-500 font-bold mt-1 normal-case">Histori stok dibuang atau diputihkan oleh sistem.</p>
             </div>
             <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
               <Calendar size={14} className="text-rose-500 ml-0.5"/>
               <input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value || todayStr)} className="text-[11px] font-bold text-slate-700 outline-none bg-transparent cursor-pointer" />
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase text-slate-500 sticky top-0 shadow-sm z-10 tracking-wider">
                <tr>
                  <th className="px-5 py-4 font-black">Waktu &amp; Laporan</th>
                  <th className="px-5 py-4 font-black">Detail Barang Rusak</th>
                  <th className="px-5 py-4 font-black text-right">Nilai Kerugian</th>
                  <th className="px-5 py-4 font-black text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                {historyDiscrepancy.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-28 text-slate-400 font-medium normal-case bg-white">
                      <div className="flex justify-center mb-4 opacity-20"><Archive size={48}/></div>
                      <span className="font-bold text-sm">Aman terkendali!<br/>Tidak ada laporan barang rusak untuk tanggal ini.</span>
                    </td>
                  </tr>
                ) : (
                  historyDiscrepancy.map(log => (
                    <tr key={log.id} className="hover:bg-rose-50/40 transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-black text-xs">{formatDate(log.date)}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-1">{log.id}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2.5 py-1 rounded-md text-[8px] font-black uppercase border mb-2 inline-block bg-slate-50 text-slate-600 border-slate-200 shadow-sm tracking-wider">
                          {log.category.replace(/_/g, ' ')}
                        </span>
                        <div className="font-black text-slate-800 uppercase text-xs mb-1.5 leading-tight">
                          {log.item_name} <span className="text-rose-600 font-black">(x{formatNumber(log.qty)})</span>
                        </div>
                        <div className="text-[10px] font-medium text-slate-500 normal-case flex flex-col gap-1 leading-snug">
                          <span>Sebab: <span className="text-amber-600 font-bold uppercase">{log.reason}</span></span>
                          <span className="line-clamp-2 truncate italic">"{log.notes}" <br/>(Oleh: {log.pic})</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="text-rose-600 font-black text-base tracking-tight">{formatRupiah(log.total_loss)}</div>
                        <div className="text-[9px] font-bold text-slate-400 normal-case mt-1.5">HPP: {formatRupiah(log.unit_cost)}/Pcs</div>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap opacity-40 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => { if(window.confirm("PERINGATAN!\n\nMenghapus log ini HANYA menghilangkan catatan kerugian di layar, namun STOK FISIK TIDAK AKAN KEMBALI secara otomatis (karena sudah terlanjur dibuang).\n\nTetap hapus catatan ini?")) requestDelete(log.id); }} className="p-2.5 text-slate-400 bg-white border border-slate-200 shadow-sm hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer" title="Hapus catatan kerugian"><Trash2 size={16}/></button>
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
