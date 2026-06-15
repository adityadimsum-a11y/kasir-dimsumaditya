import React, { useState, useMemo } from 'react';
// 🔥 FIX: Ikon Database dan PackageCheck sudah dimasukkan!
import { Factory, PlusCircle, Trash2, Calendar, ClipboardList, Info, CheckCircle2, Printer, Database, PackageCheck } from 'lucide-react';
import { getTodayStr, generateId, formatDate, safeJsonParse } from '../../utils/helpers';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabPemalang({ 
  pemalang = [], masterProducts = [], master_products,
  inventoryCostLayers = [], inventory_cost_layers,
  sendToSheet, showToast, user, requestDelete, setPrintData 
}) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'TANGERANG_PUSAT';
  
  const realInventory = useMemo(() => inventory_cost_layers || inventoryCostLayers || [], [inventory_cost_layers, inventoryCostLayers]);
  const realProducts = useMemo(() => master_products || masterProducts || [], [master_products, masterProducts]);

  const activeMenus = useMemo(() => {
    return realProducts.filter(p => !p.isDeleted && String(p.isDeleted).toUpperCase() !== 'TRUE' && p.status_active).reverse();
  }, [realProducts]);

  const [date, setDate] = useState(todayStr);
  const [pic, setPic] = useState(user?.name || '');
  const [productName, setProductName] = useState('');
  const [adukan, setAdukan] = useState('');
  const [ayamTerpakai, setAyamTerpakai] = useState('');
  const [actualInput, setActualInput] = useState('');
  const [actualUnit, setActualUnit] = useState('MIKA');
  const [notes, setNotes] = useState('');

  const [filterDateFrom, setFilterPeriodeFrom] = useState(todayStr);
  const [filterDateTo, setFilterPeriodeTo] = useState(todayStr);

  const stockGudang = useMemo(() => {
    let ayamKantong = 0;
    realInventory.forEach(inv => {
      if (inv.isDeleted || (inv.branch_id !== currentBranch && currentBranch !== 'TANGERANG_PUSAT')) return;
      if (inv.category === 'BAHAN_BAKU') ayamKantong += Number(inv.qty_remaining || 0);
    });
    return { ayamKantong, ayamKg: ayamKantong * 10 };
  }, [realInventory, currentBranch]);

  const kalkulasi = useMemo(() => {
    const adukanNum = Number(adukan || 0);
    const inputAngka = Number(actualInput || 0);
    
    const stdPcs = adukanNum * 1000;
    const stdMika = adukanNum * 20;

    let actualTotalPcs = 0;
    if (actualUnit === 'MIKA') actualTotalPcs = inputAngka * 50;     
    if (actualUnit === 'PORSI') actualTotalPcs = inputAngka * 4;     
    if (actualUnit === 'PCS') actualTotalPcs = inputAngka;

    const previewMika = (actualTotalPcs / 50).toFixed(1);
    const previewPorsi = Math.floor(actualTotalPcs / 4);

    const selisihPcs = actualTotalPcs - stdPcs;
    const butuhAyamKg = adukanNum * 30;
    const butuhAyamKantong = adukanNum * 3; 
    
    const sisaAyamKantong = stockGudang.ayamKantong - butuhAyamKantong;
    const sisaAyamKg = stockGudang.ayamKg - butuhAyamKg;

    return { 
      adukanNum, stdPcs, stdMika, actualTotalPcs, previewMika, previewPorsi, 
      inputAngka, selisihPcs, butuhAyamKg, butuhAyamKantong, sisaAyamKantong, sisaAyamKg 
    };
  }, [adukan, actualInput, actualUnit, stockGudang]);

  const filteredProductionLogs = useMemo(() => {
    return (pemalang || []).filter((p) => {
      if (p.isDeleted) return false;
      return p.date >= filterDateFrom && p.date <= filterDateTo;
    }).sort((a, b) => b.id.localeCompare(a.id));
  }, [pemalang, filterDateFrom, filterDateTo]);

  const handleAdukanChange = (val) => {
    const adk = Number(val.replace(/\D/g, ''));
    setAdukan(String(adk));
    setActualInput(String(adk * 20)); 
    setActualUnit('MIKA');
  };

  const handleSubmitProduction = async (e) => {
    e.preventDefault();
    if (kalkulasi.adukanNum <= 0) return alert("Jumlah adukan tidak boleh kosong!");
    if (kalkulasi.actualTotalPcs <= 0) return alert("Hasil fisik tidak boleh kosong!");
    if (!productName) return alert("Pilih variant produk!");

    if (kalkulasi.butuhAyamKantong > stockGudang.ayamKantong) {
      if (!window.confirm(`⚠️ Stok ayam minus!\nDapur butuh ${kalkulasi.butuhAyamKantong} Kantong, sistem sisa ${stockGudang.ayamKantong} Kantong.\nLanjutkan pencatatan minus?`)) return;
    }

    const batchId = generateId('PRD', date);
    const tokenName = `@@PRODUCTION@@||${adukan}||${ayamTerpakai}||${kalkulasi.actualTotalPcs}||${notes || '-'}`;

    const confirmMsg = `=== KONFIRMASI PRODUKSI ADITYA ===\n\nID Batch : ${batchId}\nTanggal  : ${formatDate(date)}\nAdukan   : ${adukan} Kali\nAyam     : ${ayamTerpakai} Kg\nYield    : ${formatNumber(kalkulasi.actualTotalPcs)} Pcs\n\nSahkan data untuk update stok freezer?`;

    if (!window.confirm(confirmMsg)) return;

    const payloadBatch = {
      id: batchId, date: date, branch_id: currentBranch, customer_name: 'PABRIK_PEMALANG', sales_channel: 'PRODUCTION_YIELD',
      items: JSON.stringify([{ name: tokenName, qty: kalkulasi.actualTotalPcs, subtotal: 0 }]),
      qty: kalkulasi.actualTotalPcs, total_amount: 0, amount_paid: 0, payment_method: 'SISTEM_PRODUKSI',
      status: 'LUNAS', notes: `${notes.toUpperCase()} (Asal: ${adukan} adukan, fisik: ${actualInput} ${actualUnit})`, isDeleted: false,
      item_name: productName, pic: pic.toUpperCase()
    };

    let payloadAyam = null;
    if (kalkulasi.butuhAyamKantong > 0) {
      payloadAyam = {
        id: generateId('INV', date), date: date, branch_id: currentBranch, category: 'BAHAN_BAKU', 
        item_name: `Produksi: ${productName} (${adukan} adukan)`, 
        qty_remaining: -kalkulasi.butuhAyamKantong, unit_cost: 0, status: 'USED', reference_id: batchId
      };
    }

    const isSuccess = await sendToSheet('insert', payloadBatch, 'pemalang');
    if (isSuccess) {
      if (payloadAyam) sendToSheet('insert', payloadAyam, 'inventory_cost_layers');
      if (typeof showToast === 'function') showToast(`Batch Produksi ${batchId} Disahkan!`, 'success');
      setAdukan(''); setAyamTerpakai(''); setActualInput(''); setNotes(''); setProductName('');
    }
  };

  const handleVoidProduction = async (id) => {
    if (!window.confirm(`🔥 PERINGATAN: Void laporan produksi ${id}? Ini akan membatalkan akumulasi stok.`)) return;
    const isSuccess = await sendToSheet('update', { id, isDeleted: true }, 'pemalang');
    if (isSuccess && typeof showToast === 'function') showToast(`Batch ${id} berhasil di-void!`, 'success');
  };

  return (
    <div className="flex flex-col gap-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-200">
      
      <div className="card-holo p-6 relative overflow-hidden flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white border border-slate-200 rounded-2xl">
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
             </div>
             <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-xs">
               <div className="text-[9px] font-bold text-slate-400 normal-case mb-1">Target standar</div>
               <div className="text-xs font-bold text-slate-700">{formatNumber(kalkulasi.stdMika)} <span className="text-[9px] text-slate-400">Mika</span></div>
               <div className="text-xs font-bold text-slate-700">{formatNumber(kalkulasi.stdPcs)} <span className="text-[9px] text-slate-400">Pcs</span></div>
             </div>
             <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-xs">
               <div className="text-[9px] font-bold text-slate-400 normal-case mb-1">Ayam dipakai</div>
               <div className="text-sm font-extrabold text-slate-800">{formatNumber(kalkulasi.butuhAyamKantong)} <span className="text-[10px] text-slate-400 font-medium">Kantong</span></div>
             </div>
             <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-xs">
               {kalkulasi.sisaAyamKantong < 0 && <div className="absolute top-0 w-full bg-red-600 text-white text-[8px] font-bold text-center py-0.5">Minus</div>}
               <div className="text-[9px] font-bold text-slate-400 normal-case mb-1">Sisa di gudang</div>
               <div className={`text-sm font-extrabold ${kalkulasi.sisaAyamKantong < 0 ? 'text-red-600' : 'text-slate-800'}`}>{formatNumber(kalkulasi.sisaAyamKantong)} <span className="text-[10px] text-slate-400 font-medium">Kantong</span></div>
             </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden border-t-4 border-t-red-500">
          <div className="p-5 border-b border-slate-100 bg-slate-50 shrink-0 flex items-center gap-2">
             <Factory size={16} className="text-red-600"/>
             <h4 className="font-bold text-slate-800 normal-case text-xs">Laporan hasil produksi</h4>
          </div>
          <form onSubmit={handleSubmitProduction} className="p-6 space-y-5 bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1.5">Tanggal adukan</label>
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer focus:border-red-400" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1.5">Kepala dapur / PIC</label>
                <input type="text" required value={pic} onChange={(e) => setPic(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-red-400" placeholder="Nama..." />
              </div>
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1.5">Varian produk jadi</label>
              <select required value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:border-red-400 cursor-pointer">
                <option value="">-- Pilih variant produk --</option>
                {activeMenus.map(m => <option key={m.id} value={m.product_name}>{m.product_name}</option>)}
              </select>
            </div>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner relative">
              <div className="absolute -top-3 left-4 bg-slate-200 border border-slate-300 text-slate-700 text-[8px] font-bold px-2 py-0.5 rounded normal-case">Langkah 1</div>
              <label className="text-[10px] font-bold text-slate-600 normal-case block mb-2 text-center mt-1">Total adukan hari ini</label>
              <input type="number" min="1" required value={adukan} onChange={(e) => handleAdukanChange(e.target.value)} className="w-full py-3 border-2 border-slate-300 rounded-xl text-3xl font-black text-slate-800 bg-white outline-none text-center focus:border-red-500" placeholder="0" />
            </div>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner relative">
              <div className="absolute -top-3 left-4 bg-red-600 text-white text-[8px] font-bold px-2 py-0.5 rounded normal-case flex items-center gap-1 shadow-xs"><PackageCheck size={10}/> Langkah 2</div>
              <label className="text-[10px] font-bold text-slate-600 normal-case block mb-3 text-center mt-1">Hasil kemasan fisik nyata</label>
              <div className="grid grid-cols-12 gap-2 items-stretch">
                <div className="col-span-8">
                  <input type="number" min="0" required value={actualInput} onChange={(e) => setActualInput(e.target.value)} className="w-full p-3 border-2 border-slate-300 rounded-xl text-2xl font-black text-slate-800 bg-white outline-none text-center focus:border-red-500 shadow-inner h-full" placeholder="0" />
                </div>
                <div className="col-span-4">
                  <select value={actualUnit} onChange={(e) => setActualUnit(e.target.value)} className="w-full px-1 bg-slate-800 text-white rounded-xl text-xs font-bold outline-none cursor-pointer border border-slate-700 shadow-sm text-center h-full">
                    <option value="MIKA">Mika (50)</option>
                    <option value="PORSI">Porsi (4)</option>
                    <option value="PCS">Pcs (1)</option>
                  </select>
                </div>
              </div>
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1.5">Daging Ayam (Kg) Terpakai</label>
              <input type="number" step="any" required value={ayamTerpakai} onChange={(e) => setAyamTerpakai(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-red-400" placeholder="Cth: 12.5" />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1.5">Catatan tambahan</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-red-400" placeholder="Opsional..." />
            </div>
            <button type="submit" className="w-full py-3.5 rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 mt-2 bg-red-600 hover:bg-red-700 text-white">
              <CheckCircle2 size={14}/> Lapor fisik &amp; potong gudang
            </button>
          </form>
        </div>

        <div className="xl:col-span-7 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h4 className="font-bold text-slate-800 normal-case text-xs flex items-center gap-2"><ClipboardList size={16} className="text-amber-600"/> Jurnal log rekap hasil giling</h4>
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
              <Calendar size={14} className="text-amber-500 ml-0.5"/>
              <input type="date" value={filterDateFrom} onChange={(e) => setFilterPeriodeFrom(e.target.value)} className="text-[10px] font-bold outline-none cursor-pointer" />
              <span>-</span>
              <input type="date" value={filterDateTo} onChange={(e) => setFilterPeriodeTo(e.target.value)} className="text-[10px] font-bold outline-none cursor-pointer" />
            </div>
          </div>
          
          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar min-h-[60vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/50 text-[10px] normal-case text-slate-500 border-b border-slate-200 sticky top-0 shadow-xs bg-white">
                <tr>
                  <th className="px-5 py-4 font-bold">Waktu &amp; batch</th>
                  <th className="px-5 py-4 font-bold text-center">Matriks Adukan</th>
                  <th className="px-5 py-4 font-bold text-center">Daging Ayam</th>
                  <th className="px-5 py-4 font-bold text-right">Yield Masuk Freezer</th>
                  <th className="px-5 py-4 font-bold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-100 text-slate-600">
                {filteredProductionLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-20 text-slate-400 normal-case">
                      <div className="flex justify-center mb-2 opacity-30"><Factory size={36}/></div>
                      Belum ada laporan produksi dapur.
                    </td>
                  </tr>
                ) : (
                  filteredProductionLogs.map((log) => {
                    let displayAdukan = '-';
                    let displayAyam = '-';
                    let displayYield = log.qty || 0;

                    if (log.items) {
                      const parsed = safeJsonParse(log.items, []);
                      if (parsed.length > 0 && String(parsed[0].name).startsWith('@@PRODUCTION@@')) {
                        const parts = parsed[0].name.split('||');
                        displayAdukan = parts[1] || '-';
                        displayAyam = parts[2] || '-';
                        displayYield = parts[3] || log.qty;
                      }
                    }

                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap font-mono text-slate-800">
                          {log.id}<div className="text-[9px] text-slate-400 mt-0.5">{formatDate(log.date)}</div>
                        </td>
                        <td className="px-5 py-4 text-center text-slate-800">{displayAdukan} Kali</td>
                        <td className="px-5 py-4 text-center text-slate-800">{displayAyam} Kg</td>
                        <td className="px-5 py-4 text-right text-amber-700">{formatNumber(displayYield)} Pcs</td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button type="button" onClick={() => {
                               if(typeof setPrintData === 'function') {
                                  setPrintData({
                                    title: 'Bukti Produksi', id: log.id, date: formatDate(log.date), branch_name: currentBranch,
                                    admin_name: user?.name || 'ADMIN', customer_name: 'FREEZER',
                                    items: [{ name: `HASIL ADUKAN\n(${displayAdukan} Adukan)`, qty: 1, subtotal: displayYield }],
                                    amount: displayYield, paymentMethod: 'SISTEM'
                                  });
                               }
                            }} className="p-2 text-slate-400 hover:text-emerald-600 border border-slate-200 rounded-lg shadow-xs"><Printer size={14}/></button>
                            <button type="button" onClick={() => handleVoidProduction(log.id)} className="p-2 text-slate-400 hover:text-red-600 border border-slate-200 rounded-lg shadow-xs"><Trash2 size={14}/></button>
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
