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

    // 2. PAYLOAD PEMOTONGAN FISIK
    let payloadMinus = null;
    let tableMinus = '';

    if (form.category === 'PRODUK_JADI') {
      tableMinus = 'production_batches';
      payloadMinus = {
        id: generateId('PRD', form.date) + '-VOID', date: form.date, branch_id: currentBranch,
        item_name: form.itemName, actual_yield: -qtyBuang, 
        pic: 'SISTEM OPNAME', notes: `Pengurangan otomatis: ${form.reason} (Ref: ${logId})`
      };
    } else {
      tableMinus = 'inventory_cost_layers';
      payloadMinus = {
        id: generateId('INV', form.date) + '-VOID', date: form.date, branch_id: currentBranch,
        category: form.category, item_name: `OPNAME: ${form.itemName}`, 
        qty_remaining: -qtyBuang, unit_cost: 0, status: 'DISCREPANCY', reference_id: logId
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
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      
      {/* 🚀 BANNER UTAMA - FLAT ENTERPRISE STYLE */}
      <div className="card-holo p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden bg-white">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-600"></div>
        <div className="pl-2">
           <div className="flex items-center gap-2 mb-1.5">
             <AlertOctagon size={20} className="text-rose-600"/>
             <h2 className="text-base font-extrabold normal-case text-slate-900">Opname &amp; Pemutihan stok</h2>
           </div>
           <p className="text-[10px] font-medium text-slate-400 normal-case leading-relaxed max-w-lg">
             Buang barang basi, rusak, atau hilang secara legal di sistem. Transaksi ini akan mencatat HPP barang sebagai kerugian operasional pabrik.
           </p>
        </div>

        <div className="flex gap-4 shrink-0 mt-4 md:mt-0">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-xs text-right min-w-[200px]">
             <div className="text-[9px] font-bold text-rose-600 normal-case mb-1">Total nilai kerugian (Hari ini)</div>
             <div className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(totalKerugianHariIni)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: FORM INPUT BARANG RUSAK */}
        <div className="lg:col-span-5 card-holo flex flex-col overflow-hidden border-t-4 border-t-rose-500">
          <div className="p-5 border-b border-slate-200 bg-slate-50 shrink-0">
             <h4 className="font-extrabold text-slate-800 normal-case text-xs flex items-center gap-2"><Trash2 size={16} className="text-rose-600"/> Form laporan barang rusak / hilang</h4>
          </div>
          
          <form onSubmit={handleSubmitDiscrepancy} className="p-6 space-y-5 flex-1 bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Tanggal kejadian</label>
                <input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold outline-none bg-slate-50 focus:bg-white focus:border-rose-400 transition-colors" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Nama PIC laporan</label>
                <input type="text" required value={form.pic} onChange={e=>setForm({...form, pic: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold normal-case outline-none bg-slate-50 focus:bg-white focus:border-rose-400 transition-colors" placeholder="Ketik nama..." />
              </div>
            </div>

            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Pilih kategori lokasi barang</label>
              <select required value={form.category} onChange={e=>setForm({...form, category: e.target.value, itemName: ''})} className="w-full p-2.5 border border-slate-200 rounded-xl text-[10px] font-bold outline-none cursor-pointer bg-slate-50 focus:bg-white focus:border-rose-400 transition-colors">
                <option value="PRODUK_JADI">🛒 Produk matang (Kasir POS / Freezer)</option>
                <option value="BAHAN_BAKU">🥩 Bahan baku ayam (Gudang belakang)</option>
                <option value="PACKAGING">📦 Packaging mika (Gudang belakang)</option>
              </select>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-inner">
              <label className="text-[10px] font-bold text-slate-500 normal-case block mb-1.5 flex items-center justify-between">
                <span>Nama barang spesifik</span>
                {form.unitCost > 0 && <span className="bg-white border border-slate-200 text-rose-600 px-2 py-0.5 rounded-lg text-[9px] shadow-xs">HPP: {formatRupiah(form.unitCost)}</span>}
              </label>
              <select required value={form.itemName} onChange={e=>setForm({...form, itemName: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold normal-case outline-none cursor-pointer bg-white focus:border-rose-500 shadow-xs transition-colors">
                <option value="">-- Daftar barang {form.category.replace('_', ' ').toLowerCase()} --</option>
                {currentOptions.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-bold text-rose-600 normal-case block mb-1">Jumlah dibuang</label>
                <input type="number" min="1" required value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 border-2 border-rose-200 rounded-xl text-lg font-black text-rose-700 text-center bg-rose-50/50 outline-none focus:bg-white focus:border-rose-500 transition-colors shadow-inner" placeholder="0" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Penyebab / Alasan</label>
                <select required value={form.reason} onChange={e=>setForm({...form, reason: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-[10px] font-bold normal-case outline-none cursor-pointer bg-slate-50 focus:border-rose-400 transition-colors">
                  <option value="BASI / RUSAK">Basi / Rusak</option>
                  <option value="HILANG DICURI">Hilang dicuri</option>
                  <option value="BUNGKUS SOBEK">Bungkus sobek / pecah</option>
                  <option value="SELISIH OPNAME">Selisih opname gudang</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Keterangan detail (Wajib diisi)</label>
              <input type="text" required value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium normal-case outline-none bg-slate-50 focus:bg-white focus:border-rose-400 transition-colors" placeholder="Cth: Jatuh saat diangkut, dimakan tikus..." />
            </div>

            <button type="submit" className="w-full btn-holo py-3.5 rounded-xl text-xs font-bold shadow-xs flex justify-center items-center gap-2 mt-4">
              <AlertTriangle size={14}/> Putihkan stok &amp; catat kerugian
            </button>
          </form>
        </div>

        {/* KANTONG KANAN: JURNAL HISTORI DISCREPANCY */}
        <div className="lg:col-span-7 card-holo flex flex-col overflow-hidden h-[75vh]">
          <div className="p-5 border-b border-slate-200 bg-slate-50 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
             <div>
               <h4 className="font-extrabold text-slate-800 normal-case text-xs flex items-center gap-2"><FileText size={16} className="text-rose-600"/> Buku jurnal kerugian operasional</h4>
               <p className="text-[10px] text-slate-500 font-medium normal-case mt-1">Histori stok dibuang / diputihkan secara sistem.</p>
             </div>
             <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
               <Calendar size={14} className="text-red-500 ml-0.5"/>
               <input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value || todayStr)} className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer" />
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-white border-b border-slate-200 text-[10px] normal-case text-slate-500 sticky top-0 shadow-xs">
                <tr>
                  <th className="px-5 py-3 font-bold">Waktu &amp; laporan</th>
                  <th className="px-5 py-3 font-bold">Detail barang rusak</th>
                  <th className="px-5 py-3 font-bold text-right">Nilai kerugian</th>
                  <th className="px-5 py-3 font-bold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                {historyDiscrepancy.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-24 text-slate-400 font-medium normal-case bg-white">
                      <div className="flex justify-center mb-3 opacity-30"><Archive size={40}/></div>
                      Aman terkendali! Tidak ada laporan barang rusak hari ini.
                    </td>
                  </tr>
                ) : (
                  historyDiscrepancy.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-bold">{formatDate(log.date)}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-1">{log.id}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2 py-0.5 rounded text-[8px] font-bold normal-case border mb-1.5 inline-block bg-slate-100 text-slate-600 border-slate-200 shadow-xs">
                          {log.category.replace('_', ' ').toLowerCase()}
                        </span>
                        <div className="font-extrabold text-slate-800 normal-case text-xs mb-1 line-clamp-2">{log.item_name} <span className="text-red-500 font-bold">(x{formatNumber(log.qty)})</span></div>
                        <div className="text-[9px] font-medium text-slate-500 normal-case flex flex-col gap-0.5">
                          <span>Alasan: <span className="text-amber-600 font-bold">{log.reason}</span></span>
                          <span className="line-clamp-1 truncate">"{log.notes}" - (PIC: {log.pic})</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="text-rose-600 font-extrabold text-sm">{formatRupiah(log.total_loss)}</div>
                        <div className="text-[8px] font-medium text-slate-400 normal-case mt-1">HPP: {formatRupiah(log.unit_cost)}/Pcs</div>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => { if(window.confirm("PERINGATAN!\n\nMenghapus log ini HANYA menghilangkan catatan kerugian di layar, namun STOK BARANG TIDAK AKAN KEMBALI secara otomatis (karena sudah terlanjur dibuang).\n\nTetap hapus catatan ini?")) requestDelete(log.id); }} className="p-2 text-slate-400 bg-white border border-slate-200 shadow-xs hover:text-rose-600 hover:bg-slate-50 rounded-lg transition-colors" title="Hapus catatan kerugian"><Trash2 size={16}/></button>
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
