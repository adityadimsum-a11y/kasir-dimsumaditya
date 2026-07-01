import React, { useState, useMemo } from 'react';
import { Factory, Trash2, Calendar, ClipboardList, CheckCircle2, Printer, Database, PackageCheck } from 'lucide-react';
import { getTodayStr, generateId, formatDate, safeJsonParse } from '../../utils/helpers';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

// PATOKAN SAKRAL PABRIK ADITYA
const INTI_HPP_DIMSUM = 1125;
const INTI_HPP_AYAM = 37500;

export default function TabPemalang({ 
  pemalang = [], masterProducts = [], master_products,
  inventoryCostLayers = [], inventory_cost_layers,
  purchases = [], 
  sendToSheet, showToast, user, requestDelete, setPrintData 
}) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'TANGERANG_PUSAT';
  
  const realProducts = useMemo(() => master_products || masterProducts || [], [master_products, masterProducts]);

  const activeMenus = useMemo(() => {
    const validProducts = realProducts.filter((p) => {
      const deleted = p.isDeleted === true || String(p.isDeleted || p.is_deleted || '').toUpperCase() === 'TRUE';
      const status = String(p.status || p.status_active || p.is_active || 'Active').toUpperCase();
      return !deleted && !['NON_ACTIVE', 'INACTIVE', 'DISABLED', 'FALSE'].includes(status);
    });

    const productionProducts = validProducts.filter((p) => {
      const haystack = String([
        p.product_name,
        p.name,
        p.category,
        p.product_type,
        p.is_production_item,
        p.adukan_conversion_active,
      ].join(' ')).toUpperCase();

      return haystack.includes('DIMSUM') || haystack.includes('ADUKAN') || haystack.includes('PRODUCTION') || haystack.includes('TRUE');
    });

    return (productionProducts.length > 0 ? productionProducts : validProducts).reverse();
  }, [realProducts]);

  const [date, setDate] = useState(todayStr);
  const [pic, setPic] = useState(''); 
  const [productName, setProductName] = useState('');
  const [adukan, setAdukan] = useState('');
  const [actualInput, setActualInput] = useState('');
  const [actualUnit, setActualUnit] = useState('PORSI'); 
  const [notes, setNotes] = useState('');

  const [filterMode, setFilterMode] = useState('MINGGU_INI'); 
  const [filterMonth, setFilterMonth] = useState(todayStr.substring(0,7));

  // 🔥 ENGINE BACKWARD COMPATIBLE: Tetap bisa baca nota ayam masa lalu
  const stockAyam = useMemo(() => {
    let masukKg = 0;
    let keluarKg = 0;

    (purchases || []).forEach(p => {
      if (p.isDeleted || String(p.isDeleted).toUpperCase() === 'TRUE') return;
      
      const itemName = String(p.name || p.item_name || p.raw_name || '').toUpperCase();
      const supplierName = String(p.supplier || p.supplier_name || '').toUpperCase();
      
      if (itemName.includes('AYAM') || itemName.includes('DADA') || supplierName.includes('NANA')) {
        let qty = Number(p.qty || 0);
        const unit = String(p.unit || '').toUpperCase(); 
        if (unit.includes('KANT') || unit.includes('KNTG')) qty = qty * 10; 
        masukKg += qty;
      }
    });

    (pemalang || []).forEach(p => {
      if (p.isDeleted || String(p.isDeleted).toUpperCase() === 'TRUE') return;
      
      if (p.items) {
        const parsed = safeJsonParse(p.items, []);
        if (parsed.length > 0) {
          const fItem = parsed[0];
          // Deteksi JSON V2 vs Token Lama
          if (fItem.is_v2) {
            keluarKg += Number(fItem.ayam_kg || 0);
          } else if (String(fItem.name).startsWith('@@PRODUCTION@@')) {
            const parts = fItem.name.split('||');
            keluarKg += Number(parts[2] || 0); 
          }
        }
      }
    });

    const sisaKg = masukKg - keluarKg;
    return { masukKantong: masukKg / 10, keluarKantong: keluarKg / 10, sisaKantong: sisaKg / 10, sisaKg };
  }, [purchases, pemalang]);

  const kalkulasi = useMemo(() => {
    const adukanNum = Number(adukan || 0);
    const inputAngka = Number(actualInput || 0);
    
    const stdPcs = adukanNum * 1000;
    const stdMika = adukanNum * 20;
    const stdPorsi = adukanNum * 250;

    let actualTotalPcs = 0;
    if (actualUnit === 'MIKA') actualTotalPcs = inputAngka * 50;     
    if (actualUnit === 'PORSI') actualTotalPcs = inputAngka * 4;     
    if (actualUnit === 'PCS') actualTotalPcs = inputAngka;

    const butuhAyamKg = adukanNum * 30;
    const butuhAyamKantong = adukanNum * 3; 
    const sisaAyamKantong = stockAyam.sisaKantong - butuhAyamKantong;

    return { 
      adukanNum, stdPcs, stdMika, stdPorsi, actualTotalPcs, 
      inputAngka, butuhAyamKg, butuhAyamKantong, sisaAyamKantong 
    };
  }, [adukan, actualInput, actualUnit, stockAyam]);

  const filteredProductionLogs = useMemo(() => {
    return (pemalang || []).filter((p) => {
      if (p.isDeleted || String(p.isDeleted).toUpperCase() === 'TRUE') return false;
      
      if (filterMode === 'HARI_INI') return p.date === todayStr;
      if (filterMode === 'BULAN_INI') return String(p.date).startsWith(todayStr.substring(0,7));
      if (filterMode === 'PILIH_BULAN') return String(p.date).startsWith(filterMonth);
      if (filterMode === 'MINGGU_INI') {
         const dDate = new Date(p.date);
         const dToday = new Date(todayStr);
         const diff = (dToday - dDate) / (1000 * 60 * 60 * 24);
         return diff >= 0 && diff <= 7;
      }
      return true;
    }).sort((a, b) => b.id.localeCompare(a.id));
  }, [pemalang, filterMode, filterMonth, todayStr]);

  const summaryFiltered = useMemo(() => {
    let totalAdukan = 0; let totalYieldPcs = 0;
    filteredProductionLogs.forEach(log => {
       totalYieldPcs += Number(log.qty || 0);
       if (log.items) {
          const parsed = safeJsonParse(log.items, []);
          if (parsed.length > 0) {
             const fItem = parsed[0];
             if (fItem.is_v2) {
               totalAdukan += Number(fItem.adukan || 0);
             } else if (String(fItem.name).startsWith('@@PRODUCTION@@')) {
               const parts = fItem.name.split('||');
               totalAdukan += Number(parts[1] || 0);
             }
          }
       }
    });
    return { totalAdukan, totalYieldPcs };
  }, [filteredProductionLogs]);

  const handleAdukanChange = (val) => {
    const adk = Number(val.replace(/\D/g, ''));
    setAdukan(String(adk));
    setActualInput(String(adk * 250)); // 1 Adukan = 1000 Pcs = 250 Porsi
    setActualUnit('PORSI');
  };

  const handleSubmitProduction = async (e) => {
    e.preventDefault();
    if (kalkulasi.adukanNum <= 0) return alert("Jumlah adukan tidak boleh kosong!");
    if (kalkulasi.actualTotalPcs <= 0) return alert("Hasil fisik tidak boleh kosong!");
    if (!productName) return alert("Pilih variant produk!");
    if (!pic) return alert("Kepala Dapur/PIC wajib diisi!");

    if (kalkulasi.butuhAyamKantong > stockAyam.sisaKantong) {
      if (!window.confirm(`⚠️ Stok ayam minus!\nDapur butuh ${kalkulasi.butuhAyamKantong} Kantong, sistem sisa ${stockAyam.sisaKantong} Kantong.\nLanjutkan pencatatan minus?`)) return;
    }

    const batchId = generateId('PRD', date);

    // 🔥 V2 DATA FORMAT (Bebas dari Bom Waktu Split Teks)
    const secureItemsData = [{
      name: productName, qty: kalkulasi.actualTotalPcs, adukan: adukan, ayam_kg: kalkulasi.butuhAyamKg,
      notes: notes || '-', is_v2: true
    }];

    const confirmMsg = `=== TRIPLE ENTRY: PABRIK ADITYA ===\n\nTanggal  : ${formatDate(date)}\nPIC      : ${pic.toUpperCase()}\nAdukan   : ${adukan} Kali\nFisik Dimsum : ${formatNumber(kalkulasi.actualTotalPcs)} Pcs\nPotong Ayam : ${kalkulasi.butuhAyamKg} Kg\n\nSistem akan mencatat adukan dan menambah stok barang jadi di freezer. Lanjutkan?`;

    if (!window.confirm(confirmMsg)) return;

    // 1. ENTRY LOG BUKU PRODUKSI (PEMALANG)
    const payloadBatch = {
      id: batchId, date: date, branch_id: currentBranch, customer_name: 'PRODUKSI_ADUKAN', sales_channel: 'PRODUCTION_YIELD',
      items: JSON.stringify(secureItemsData), qty: kalkulasi.actualTotalPcs, total_amount: 0, amount_paid: 0, payment_method: 'SISTEM_PRODUKSI',
      status: 'LUNAS', notes: `${notes.toUpperCase()} (Asal: ${adukan} adukan, fisik: ${actualInput} ${actualUnit})`, isDeleted: false,
      bridge_source: 'LEGACY_FACTORY_TAB_PEMALANG',
      production_location_id: currentBranch,
      item_name: productName, pic: pic.toUpperCase() 
    };

    // 2. ENTRY KELUAR BAHAN MENTAH
    const payloadInventoryOut = {
      id: generateId('INV', date) + '-OUT', date: date, branch_id: currentBranch, category: 'BAHAN_BAKU',
      item_name: 'AYAM MENTAH FILLET', qty_remaining: -kalkulasi.butuhAyamKg, unit_cost: INTI_HPP_AYAM,
      status: 'USED_IN_PRODUCTION', reference_id: batchId, isDeleted: false
    };

    // 3. ENTRY MASUK BARANG MATANG
    const payloadInventoryIn = {
      id: generateId('INV', date) + '-IN', date: date, branch_id: currentBranch, category: 'PRODUK_JADI',
      item_name: productName.toUpperCase(), qty_remaining: kalkulasi.actualTotalPcs, unit_cost: INTI_HPP_DIMSUM,
      status: 'ACTIVE', reference_id: batchId, isDeleted: false
    };

    const isSuccess = await sendToSheet('insert', payloadBatch, 'pemalang');
    if (isSuccess) {
      await sendToSheet('insert', [payloadInventoryOut, payloadInventoryIn], 'inventory_cost_layers');
      
      if (typeof showToast === 'function') showToast(`Produksi adukan berhasil diproses mesin baru. Stok freezer bertambah.`, 'success');
      setAdukan(''); setActualInput(''); setNotes(''); setProductName(''); setPic('');
    }
  };

  const handleVoidProduction = async (id) => {
    if (!window.confirm(`🔥 PERINGATAN: Void laporan produksi ${id}?\nIni HANYA membatalkan log catatannya. Stok fisik freezer & bahan baku harus Anda sesuaikan manual melalui menu Discrepancy (Stok Basi/Hilang).`)) return;
    const isSuccess = await sendToSheet('update', { id, isDeleted: true }, 'pemalang');
    if (isSuccess && typeof showToast === 'function') showToast(`Log Batch ${id} berhasil di-void!`, 'success');
  };

  const potensiAdukan = Math.floor(stockAyam.sisaKantong / 3);

  return (
    <div className="flex flex-col gap-6 pb-10 text-slate-700 animate-in fade-in duration-300">
      
      {/* 🚀 HEADER BANNER PABRIK */}
      <div className="bg-gradient-to-r from-red-900 via-rose-900 to-red-900 p-6 lg:p-8 flex flex-col xl:flex-row justify-between items-stretch gap-6 rounded-3xl shadow-xl relative overflow-hidden border border-red-800">
        <div className="absolute top-0 right-0 p-4 opacity-5"><Factory size={120} className="text-red-400"/></div>
        
        <div className="relative z-10 w-full xl:w-1/3 shrink-0 flex flex-col justify-center">
           <div className="flex items-center gap-2 mb-3">
             <Database size={24} className="text-red-400"/>
             <h2 className="text-xl font-black text-white uppercase tracking-wide">Produksi / Adukan</h2>
           </div>
           <p className="text-[11px] font-bold text-slate-300 leading-relaxed max-w-sm">
             Gerbang resmi membuat stok barang jadi. Input adukan akan menambah stok Dimsum Original/Ayam Mix ke freezer sebelum Kasir/Order boleh jual.
           </p>
        </div>
        
        <div className="relative z-10 w-full xl:w-2/3 flex flex-col sm:flex-row gap-4">
           {/* BOX 1: STOK AYAM GUDANG */}
           <div className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5 flex flex-col justify-between shadow-inner backdrop-blur-sm relative overflow-hidden">
             {kalkulasi.sisaAyamKantong < 0 && <div className="absolute top-0 w-full left-0 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest text-center py-0.5">Stok Minus!</div>}
             <div>
               <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1">Sisa Ayam Gudang Logistik</div>
               <div className="text-4xl font-black text-white tracking-tight my-1">
                 {formatNumber(stockAyam.sisaKantong)} <span className="text-sm text-slate-500 font-bold">Kntg</span>
               </div>
             </div>
             <div className="text-[10px] font-bold text-slate-400 mt-2 border-t border-slate-700/50 pt-2 flex flex-col gap-1">
               <div className="flex justify-between">
                 <span>Masuk: <b className="text-slate-300">{formatNumber(stockAyam.masukKantong)}</b></span>
                 <span>Dipakai: <b className="text-amber-500">{formatNumber(stockAyam.keluarKantong)}</b></span>
               </div>
               <div className="text-emerald-400 bg-emerald-950/30 px-2 py-1 rounded-md mt-1 inline-block border border-emerald-900/50 w-max">
                 Potensi: <b>{potensiAdukan} Adukan</b> (~{formatNumber(potensiAdukan * 250)} Porsi)
               </div>
             </div>
           </div>

           {/* BOX 2: TOTAL PRODUKSI */}
           <div className="flex-[1.5] bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5 flex flex-col justify-center shadow-inner backdrop-blur-sm">
             <div className="text-[11px] font-black text-emerald-400 uppercase tracking-wider mb-3">Hasil Produksi ({filterMode.replace('_', ' ')})</div>
             <div className="flex flex-row items-end gap-6 mb-2">
               <div>
                 <div className="text-5xl font-black text-emerald-500 tracking-tighter leading-none drop-shadow-md">{formatNumber(summaryFiltered.totalYieldPcs)}</div>
                 <div className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-1.5 flex items-center gap-1">
                   <span>TOTAL PCS</span> <span className="px-1.5 py-0.5 bg-emerald-900/40 rounded text-emerald-400 text-[8px]">PELANGGAN</span>
                 </div>
               </div>
               <div className="h-12 w-px bg-slate-700/60 hidden sm:block"></div>
               <div>
                 <div className="text-4xl font-black text-emerald-400 tracking-tighter leading-none drop-shadow-md">{formatNumber(summaryFiltered.totalYieldPcs / 4)}</div>
                 <div className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-1.5 flex items-center gap-1">
                   <span>TOTAL PORSI</span> <span className="px-1.5 py-0.5 bg-amber-900/40 rounded text-amber-500 text-[8px]">DAPUR</span>
                 </div>
               </div>
             </div>
             <div className="text-[10px] font-bold text-emerald-600 mt-2 pt-3 border-t border-slate-700/50 flex justify-between">
               <span>Putaran Mesin: <b className="text-emerald-400 text-[11px]">{formatNumber(summaryFiltered.totalAdukan)} Adukan</b></span>
               <span>Setara Mika: <b className="text-emerald-400 text-[11px]">{formatNumber(summaryFiltered.totalYieldPcs / 50)} Mika</b></span>
             </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden border-t-4 border-t-red-600 h-max">
          <div className="p-6 border-b border-slate-100 bg-slate-50 shrink-0 flex items-center gap-2">
             <Factory size={18} className="text-red-600"/>
             <h4 className="font-black text-slate-800 uppercase tracking-wide text-sm">Form Laporan Hasil Produksi</h4>
          </div>
          <form onSubmit={handleSubmitProduction} className="p-6 space-y-5 bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Tanggal Adukan</label>
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer bg-slate-50 focus:bg-white focus:border-red-400 shadow-sm transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Kepala Dapur / PIC</label>
                <input type="text" required value={pic} onChange={(e) => setPic(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold outline-none bg-slate-50 focus:bg-white focus:border-red-400 shadow-sm uppercase tracking-wider transition-colors" placeholder="Nama Kepala Dapur..." />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Varian Produk Jadi</label>
              <select required value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-red-400 cursor-pointer shadow-sm uppercase tracking-wider transition-colors">
                <option value="">-- Pilih Variant Produk --</option>
                {activeMenus.map(m => <option key={m.id} value={m.product_name}>{m.product_name}</option>)}
              </select>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner relative">
              <div className="absolute -top-3 left-5 bg-slate-800 text-white text-[9px] font-black px-3 py-0.5 rounded-md uppercase tracking-widest shadow-md">Langkah 1</div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2 text-center mt-2">Total Adukan Hari Ini</label>
              <input type="number" min="1" required value={adukan} onChange={(e) => handleAdukanChange(e.target.value)} className="w-full py-4 border-2 border-slate-300 rounded-xl text-4xl font-black text-slate-800 bg-white outline-none text-center focus:border-red-500 shadow-sm transition-colors" placeholder="0" />
              
              {adukan && (
                <div className="mt-4 pt-3 border-t border-slate-200 flex justify-center text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <span>Target Standar: <b className="text-slate-800">{formatNumber(kalkulasi.stdPcs)} Pcs / {formatNumber(kalkulasi.stdPorsi)} Porsi</b></span>
                </div>
              )}
            </div>

            <div className="bg-red-50/50 p-5 rounded-2xl border border-red-100 shadow-inner relative">
              <div className="absolute -top-3 left-5 bg-red-600 text-white text-[9px] font-black px-3 py-0.5 rounded-md flex items-center gap-1.5 shadow-md uppercase tracking-widest"><PackageCheck size={12}/> Langkah 2</div>
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-3 text-center mt-2">Hasil Kemasan Fisik Nyata</label>
              <div className="grid grid-cols-12 gap-3 items-stretch">
                <div className="col-span-8">
                  <input type="number" min="0" required value={actualInput} onChange={(e) => setActualInput(e.target.value)} className="w-full p-4 border-2 border-red-200 rounded-xl text-3xl font-black text-red-700 bg-white outline-none text-center focus:border-red-500 shadow-sm transition-colors h-full" placeholder="0" />
                </div>
                <div className="col-span-4">
                  <select value={actualUnit} onChange={(e) => setActualUnit(e.target.value)} className="w-full px-2 bg-slate-900 text-white rounded-xl text-xs font-black outline-none cursor-pointer border-2 border-slate-800 shadow-md text-center h-full uppercase tracking-wider hover:bg-black transition-colors">
                    <option value="PORSI">Porsi (4)</option>
                    <option value="MIKA">Mika (50)</option>
                    <option value="PCS">Pcs (1)</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Catatan Tambahan</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50 outline-none focus:bg-white focus:border-red-400 shadow-sm normal-case transition-colors" placeholder="Opsional..." />
            </div>

            <button type="submit" className="w-full py-4 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 mt-2 bg-red-600 hover:bg-red-700 text-white uppercase tracking-wider transition-transform active:scale-95 cursor-pointer">
              <CheckCircle2 size={16}/> Lapor Fisik, Potong Gudang &amp; Bekukan Freezer
            </button>
          </form>
        </div>

        <div className="xl:col-span-7 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
               <h4 className="font-black text-slate-800 uppercase tracking-wide text-sm flex items-center gap-2"><ClipboardList size={18} className="text-amber-600"/> Riwayat Produksi &amp; Adukan Dapur</h4>
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
              <Calendar size={14} className="text-amber-500 ml-0.5"/>
              <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)} className="text-[11px] font-black outline-none cursor-pointer text-slate-700 uppercase tracking-wider bg-transparent">
                <option value="HARI_INI">Hari Ini</option>
                <option value="MINGGU_INI">7 Hari Terakhir</option>
                <option value="BULAN_INI">Bulan Ini</option>
                <option value="PILIH_BULAN">Pilih Bulan...</option>
              </select>
              {filterMode === 'PILIH_BULAN' && (
                <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="text-[11px] font-bold outline-none cursor-pointer text-slate-700 border-l border-slate-200 pl-2 ml-1" />
              )}
            </div>
          </div>
          
          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar min-h-[60vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200 sticky top-0 shadow-sm bg-white z-10">
                <tr>
                  <th className="px-5 py-4 font-black">Waktu &amp; Batch</th>
                  <th className="px-5 py-4 font-black text-center">Matriks Adukan</th>
                  <th className="px-5 py-4 font-black text-center">Daging Ayam</th>
                  <th className="px-5 py-4 font-black text-right">Yield Masuk Freezer</th>
                  <th className="px-5 py-4 font-black text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-100 text-slate-600">
                {filteredProductionLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-24 text-slate-400">
                      <Factory size={48} className="mx-auto mb-3 opacity-20"/>
                      <div className="text-sm font-black uppercase tracking-wider">Belum Ada Laporan</div>
                      <div className="text-[10px] font-bold normal-case mt-1">Tidak ada rekam jejak produksi dapur di periode ini.</div>
                    </td>
                  </tr>
                ) : (
                  filteredProductionLogs.map((log) => {
                    let displayAdukan = '-'; let displayAyam = '-'; let displayYield = log.qty || 0;

                    if (log.items) {
                      const parsed = safeJsonParse(log.items, []);
                      if (parsed.length > 0) {
                        const fItem = parsed[0];
                        if (fItem.is_v2) {
                           displayAdukan = fItem.adukan; displayAyam = fItem.ayam_kg; displayYield = fItem.qty;
                        } else if (String(fItem.name).startsWith('@@PRODUCTION@@')) {
                           const parts = fItem.name.split('||');
                           displayAdukan = parts[1] || '-'; displayAyam = parts[2] || '-'; displayYield = parts[3] || log.qty;
                        }
                      }
                    }

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="font-mono text-slate-800 font-black">{log.id}</div>
                          <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{formatDate(log.date)}</div>
                        </td>
                        <td className="px-5 py-4 text-center font-black text-slate-800 text-sm">{displayAdukan} <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kali</span></td>
                        <td className="px-5 py-4 text-center font-black text-slate-800 text-sm">{displayAyam} <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kg</span></td>
                        <td className="px-5 py-4 text-right font-black text-amber-600 text-lg tracking-tight">{formatNumber(displayYield)} <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Pcs</span></td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button type="button" onClick={() => {
                               if(typeof setPrintData === 'function') {
                                  setPrintData({
                                    type: 'INVOICE', title: 'Bukti Produksi Dapur', id: log.id, date: formatDate(log.date), branch_name: currentBranch.replace(/_/g, ' '),
                                    admin_name: user?.name || 'ADMIN PABRIK', customer_name: 'INVENTARIS FREEZER',
                                    items: [{ name: `HASIL ADUKAN\n(${displayAdukan} Adukan x ${displayAyam} Kg)`, qty: 1, subtotal: displayYield }],
                                    amount: displayYield, paymentMethod: 'SISTEM STOK INTERNAL'
                                  });
                               }
                            }} className="p-2.5 text-slate-400 hover:text-emerald-600 border border-slate-200 rounded-xl shadow-sm bg-white cursor-pointer transition-colors"><Printer size={16}/></button>
                            <button type="button" onClick={() => handleVoidProduction(log.id)} className="p-2.5 text-slate-400 hover:text-red-600 border border-slate-200 rounded-xl shadow-sm bg-white cursor-pointer transition-colors"><Trash2 size={16}/></button>
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
