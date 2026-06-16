import React, { useState, useMemo } from 'react';
import { 
  PackageCheck, Clock, ArrowRight, Save, 
  Search, ThermometerSnowflake, AlertCircle, CheckCircle2,
  Eye, Receipt, Wallet, Archive, ListTodo, Calendar, Package
} from 'lucide-react';
import { getTodayStr, generateId, safeJsonParse, formatDate } from '../../utils/helpers';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');
const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabAntrianPO({ orders, inventoryCostLayers, masterProducts, master_products, user, sendToSheet, showToast }) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  const [activeSubTab, setActiveSubTab] = useState('ACTIVE'); // 'ACTIVE' | 'COMPLETED'
  const [searchTerm, setSearchTerm] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState(todayStr);
  const [historyDateTo, setHistoryDateTo] = useState(todayStr);

  const [selectedPO, setSelectedPO] = useState(null);
  const [allocations, setAllocations] = useState({}); 
  const [detailPO, setDetailPO] = useState(null);

  // =========================================================================
  // 1. DATA MASTER PRODUK (UNTUK PAPAN STOK ATAS)
  // =========================================================================
  const realProducts = useMemo(() => master_products || masterProducts || [], [master_products, masterProducts]);
  const activeProducts = useMemo(() => realProducts.filter(p => !p.isDeleted), [realProducts]);

  // =========================================================================
  // 2. ENGINE KALKULASI STOK BEBAS VS STOK KARANTINA
  // =========================================================================
  const stockData = useMemo(() => {
    const free = {};
    const quarantine = {}; 
    
    (inventoryCostLayers || []).forEach(l => {
      if (l.isDeleted || l.branch_id !== currentBranch) return;
      
      if (l.status === 'ACTIVE') {
        free[l.item_name] = (free[l.item_name] || 0) + Number(l.qty_remaining || 0);
      } 
      else if (l.status === 'KARANTINA') {
        if (!quarantine[l.reference_id]) quarantine[l.reference_id] = {};
        quarantine[l.reference_id][l.item_name] = (quarantine[l.reference_id][l.item_name] || 0) + Number(l.qty_remaining || 0);
      }
    });
    return { free, quarantine };
  }, [inventoryCostLayers, currentBranch]);

  // =========================================================================
  // 3. FILTER & ENRICH DATA NOTA PO (SEMUA PO TANPA KECUALI)
  // =========================================================================
  const allPOOrders = useMemo(() => {
    const filtered = (orders || []).filter(o => {
      if (o.isDeleted || o.branch_id !== currentBranch) return false;
      return o.payment_method === 'COD_PO' || String(o.notes).includes('TARGET PO');
    });

    return filtered.map(po => {
      const items = safeJsonParse(po.items, []);
      let totalOrdered = 0;
      let totalQuarantined = 0;
      
      const enrichedItems = items.map(i => {
        const qQty = stockData.quarantine[po.id]?.[i.name] || 0;
        totalOrdered += Number(i.qty || 0);
        totalQuarantined += qQty;
        return { ...i, quarantined: qQty };
      });

      let target = 'Tanpa Target';
      if (po.notes && po.notes.includes('TARGET PO:')) {
          const split1 = po.notes.split('TARGET PO: ');
          if (split1.length > 1) target = split1[1].split(')')[0];
      }

      const progress = totalOrdered > 0 ? (totalQuarantined / totalOrdered) * 100 : 0;

      return { 
        ...po, 
        targetDate: target, 
        enrichedItems, 
        totalOrdered, 
        totalQuarantined, 
        progress: Math.min(progress, 100) 
      };
    }).sort((a,b) => new Date(b.date) - new Date(a.date));
  }, [orders, currentBranch, stockData]);

  // Pisahkan berdasarkan Sub-Tab yang sedang aktif + Filter Kalender
  const displayedPOs = useMemo(() => {
    let targetList = [];

    if (activeSubTab === 'ACTIVE') {
      targetList = allPOOrders.filter(po => po.status !== 'SELESAI_KIRIM');
    } else {
      // Jika di Tab Arsip/Selesai, terapkan filter tanggal
      targetList = allPOOrders.filter(po => {
        if (po.status !== 'SELESAI_KIRIM') return false;
        const d = po.date.substring(0, 10);
        return d >= historyDateFrom && d <= historyDateTo;
      });
    }

    if (!searchTerm) return targetList;
    const lower = searchTerm.toLowerCase();
    return targetList.filter(po => po.id.toLowerCase().includes(lower) || String(po.customer_name).toLowerCase().includes(lower));
  }, [allPOOrders, activeSubTab, searchTerm, historyDateFrom, historyDateTo]);

  const countActive = allPOOrders.filter(po => po.status !== 'SELESAI_KIRIM').length;

  // =========================================================================
  // 4. LOGIKA EKSEKUSI KARANTINA
  // =========================================================================
  const handleOpenModal = (po) => {
    setSelectedPO(po);
    setAllocations({});
  };

  const handleAllocationChange = (itemName, val) => {
    setAllocations(prev => ({ ...prev, [itemName]: val.replace(/\D/g, '') }));
  };

  const submitKarantina = async () => {
    const payloads = [];
    let hasInput = false;

    for (const item of selectedPO.enrichedItems) {
      const inputVal = Number(allocations[item.name] || 0);
      if (inputVal > 0) {
        hasInput = true;
        const availableFreeStock = stockData.free[item.name] || 0;
        const remainingNeeded = item.qty - item.quarantined;

        if (inputVal > availableFreeStock) {
          return alert(`Gagal! Stok Bebas Gudang untuk ${item.name} tidak mencukupi. (Sisa: ${availableFreeStock})`);
        }
        if (inputVal > remainingNeeded) {
          return alert(`Gagal! Angka alokasi ${item.name} melebihi sisa kekurangan PO.`);
        }

        payloads.push({
          id: generateId('INV', todayStr) + '-OUT-' + Math.floor(Math.random() * 1000),
          date: todayStr, branch_id: currentBranch, category: 'PENYESUAIAN_KARANTINA',
          item_name: item.name, qty_remaining: -inputVal, unit_cost: 0, status: 'USED',
          reference_id: selectedPO.id, notes: `Dikunci untuk Karantina PO (${selectedPO.id})`, isDeleted: false
        });

        payloads.push({
          id: generateId('INV', todayStr) + '-IN-' + Math.floor(Math.random() * 1000),
          date: todayStr, branch_id: currentBranch, category: 'KARANTINA_PO',
          item_name: item.name, qty_remaining: inputVal, unit_cost: 0, status: 'KARANTINA', 
          reference_id: selectedPO.id, notes: `Stok Karantina Beku`, isDeleted: false
        });
      }
    }

    if (!hasInput) return alert("Silakan isi jumlah yang ingin dikarantina terlebih dahulu!");
    if (!window.confirm("Kunci stok ini untuk Karantina? (Stok bebas akan otomatis berkurang dan tidak bisa dijual di kasir)")) return;

    const isSuccess = await sendToSheet('insert', payloads, 'inventory_cost_layers');
    if (isSuccess) {
      showToast("Stok berhasil diamankan di Freezer Karantina!", "success");
      setSelectedPO(null);
    }
  };

  const handleSelesaikanPO = async (poId) => {
    if (!window.confirm("Tandai PO ini sebagai Selesai/Terkirim? (Akan dipindahkan ke Tab Riwayat Selesai)")) return;
    const isSuccess = await sendToSheet('update', { id: poId, status: 'SELESAI_KIRIM' }, 'orders');
    if (isSuccess) {
      showToast("Nota PO berhasil dipindahkan ke Arsip!", "success");
      setActiveSubTab('COMPLETED'); 
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-10 text-slate-700 animate-in fade-in duration-200">
      
      {/* HEADER BANNER: PAPAN STOK & TOTAL ANTRIAN */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 flex flex-col xl:flex-row justify-between items-start gap-6 relative overflow-hidden">
        
        {/* KIRI: PAPAN STOK BEBAS */}
        <div className="flex-1 w-full overflow-hidden z-10">
          <h2 className="text-base font-black text-slate-800 flex items-center gap-2 mb-4 tracking-wide">
            <ThermometerSnowflake className="text-orange-500" size={20} /> 
            Pusat Komando Antrian PO &amp; Stok Bebas Gudang (Live)
          </h2>
          <div className="flex overflow-x-auto custom-scrollbar pb-3 gap-4">
            {activeProducts.map(p => {
              const stockQty = stockData.free[p.product_name] || 0;
              return (
                <div key={p.id} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col min-w-[180px] shadow-sm shrink-0 hover:border-orange-300 transition-colors">
                  <div className="text-[10px] font-bold text-slate-500 uppercase leading-snug whitespace-normal break-words mb-3 line-clamp-2 min-h-[30px]">
                    {p.product_name}
                  </div>
                  <div className="text-2xl font-black text-slate-800 leading-none mb-2">
                    {formatNumber(stockQty)} <span className="text-[10px] text-slate-400 font-normal normal-case">Pcs</span>
                  </div>
                  <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 self-start">
                    {formatNumber((stockQty/50).toFixed(1))} Mika | {formatNumber(Math.floor(stockQty/4))} Porsi
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* KANAN: TOTAL ANTRIAN BADGE */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 border border-orange-200 p-6 rounded-3xl shrink-0 flex items-center gap-4 xl:w-80 shadow-sm w-full xl:w-auto z-10">
          <div className="bg-orange-200/50 p-4 rounded-2xl shadow-inner"><PackageCheck size={36} className="text-orange-600"/></div>
          <div>
            <div className="text-[10px] font-black text-orange-800 uppercase tracking-widest mb-1">Total Antrian Berjalan</div>
            <div className="text-3xl font-black text-orange-600 tracking-tight">{countActive} <span className="text-sm font-bold text-orange-700/70 normal-case">Nota Aktif</span></div>
          </div>
        </div>

      </div>

      {/* TOOLBAR FILTER & SUB-TABS */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm gap-4">
        
        {/* SUB TABS NAVIGATION */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl w-full xl:w-auto overflow-x-auto custom-scrollbar shrink-0 shadow-inner">
          <button 
            onClick={() => setActiveSubTab('ACTIVE')} 
            className={`flex-1 xl:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'ACTIVE' ? 'bg-white text-orange-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ListTodo size={16}/> Antrian Berjalan
            <span className={`px-2 py-0.5 rounded-md text-[10px] ${activeSubTab === 'ACTIVE' ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-500'}`}>{countActive}</span>
          </button>
          
          <button 
            onClick={() => setActiveSubTab('COMPLETED')} 
            className={`flex-1 xl:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 shadow-sm border border-emerald-100' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Archive size={16}/> Riwayat Selesai
          </button>
        </div>

        {/* SEARCH & KALENDER (KALENDER MUNCUL JIKA TAB COMPLETED) */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
          {activeSubTab === 'COMPLETED' && (
            <div className="flex items-center justify-between w-full sm:w-auto gap-2 bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl shrink-0">
               <Calendar size={16} className="text-slate-400 shrink-0"/>
               <input type="date" value={historyDateFrom} onChange={e=>setHistoryDateFrom(e.target.value)} className="text-[11px] font-bold bg-transparent outline-none cursor-pointer text-slate-600 w-full sm:w-auto" />
               <span className="text-slate-400 font-bold">-</span>
               <input type="date" value={historyDateTo} onChange={e=>setHistoryDateTo(e.target.value)} className="text-[11px] font-bold bg-transparent outline-none cursor-pointer text-slate-600 w-full sm:w-auto" />
            </div>
          )}

          <div className="relative w-full sm:w-72 shrink-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input 
              type="text" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-orange-400 transition-colors shadow-sm" 
              placeholder="Cari ID Nota atau Nama Klien..." 
            />
          </div>
        </div>
      </div>

      {/* GRID KARTU PO */}
      {displayedPOs.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-20 text-center flex flex-col items-center justify-center text-slate-400 shadow-sm">
          {activeSubTab === 'ACTIVE' ? (
             <>
               <CheckCircle2 size={56} className="mb-4 opacity-20 text-emerald-500" />
               <h3 className="text-base font-black tracking-wide mb-1 text-slate-600">Semua Terkendali</h3>
               <p className="text-sm font-bold normal-case">Tidak ada antrian Pre-Order yang sedang berjalan saat ini.</p>
             </>
          ) : (
             <>
               <Archive size={56} className="mb-4 opacity-20" />
               <h3 className="text-base font-black tracking-wide mb-1 text-slate-600">Arsip Kosong</h3>
               <p className="text-sm font-bold normal-case">Belum ada riwayat PO yang diselesaikan pada periode ini.</p>
             </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {displayedPOs.map(po => (
            <div key={po.id} className={`bg-white border rounded-3xl shadow-sm overflow-hidden flex flex-col transition-colors hover:shadow-md ${activeSubTab === 'COMPLETED' ? 'border-emerald-200' : 'border-slate-200 hover:border-orange-300'}`}>
              
              {/* Card Header */}
              <div className={`p-5 border-b flex justify-between items-start ${activeSubTab === 'COMPLETED' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-slate-200 text-slate-700 font-mono text-[10px] px-2 py-0.5 rounded-md font-black">{po.id}</span>
                    {activeSubTab === 'COMPLETED' ? (
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-md font-black flex items-center gap-1 uppercase tracking-wider border border-emerald-200"><CheckCircle2 size={12}/> Selesai &amp; Terkirim</span>
                    ) : (
                      <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-md font-black flex items-center gap-1 uppercase tracking-wider border border-red-200"><Clock size={12}/> Target: {formatDate(po.targetDate)}</span>
                    )}
                  </div>
                  <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{po.customer_name}</h3>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Status Karantina</div>
                  <div className={`text-2xl font-black tracking-tighter ${po.progress === 100 || activeSubTab === 'COMPLETED' ? 'text-emerald-600' : 'text-orange-600'}`}>
                    {activeSubTab === 'COMPLETED' ? '100%' : `${po.progress.toFixed(0)}%`}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 h-2">
                <div className={`h-2 transition-all duration-500 ${po.progress === 100 || activeSubTab === 'COMPLETED' ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: activeSubTab === 'COMPLETED' ? '100%' : `${po.progress}%` }}></div>
              </div>

              {/* Card Body (Item List Compact) */}
              <div className={`p-5 flex-1 space-y-3 ${activeSubTab === 'COMPLETED' ? 'opacity-80' : ''}`}>
                {po.enrichedItems.map((item, i) => (
                  <div key={i} className={`flex justify-between items-center border p-3 rounded-2xl ${activeSubTab === 'COMPLETED' ? 'bg-white border-slate-100' : 'bg-slate-50 border-slate-100 shadow-3xs'}`}>
                    <div className="flex-1 pr-2">
                      <div className="font-bold text-slate-800 text-xs uppercase line-clamp-1">{item.name}</div>
                      <div className="text-[10px] font-bold text-slate-500 mt-1 normal-case">Order: {formatNumber(item.qty)} Pcs</div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">{activeSubTab === 'COMPLETED' ? 'Dikirim' : 'Terkumpul'}</div>
                        <div className="font-black text-base text-emerald-600">{activeSubTab === 'COMPLETED' ? formatNumber(item.qty) : formatNumber(item.quarantined)}</div>
                      </div>
                      
                      {activeSubTab === 'ACTIVE' && (
                        <>
                          <ArrowRight size={16} className="text-slate-300"/>
                          <div className="text-right w-16">
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Kekurangan</div>
                            <div className="font-black text-base text-red-500">{formatNumber(item.qty - item.quarantined)}</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Card Footer / Actions */}
              {activeSubTab === 'COMPLETED' ? (
                <div className="p-5 bg-white border-t border-slate-100">
                  <button onClick={() => setDetailPO(po)} className="w-full py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-black rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider">
                    <Eye size={16}/> Buka Arsip &amp; Detail PO
                  </button>
                </div>
              ) : (
                <div className="p-5 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setDetailPO(po)} 
                      className="flex-1 py-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px] font-black rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                    >
                      <Eye size={16}/> Cek Detail PO
                    </button>
                    <button 
                      onClick={() => handleOpenModal(po)} 
                      disabled={po.progress === 100}
                      className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-black rounded-xl shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer uppercase tracking-wider"
                    >
                      <ThermometerSnowflake size={16}/> {po.progress === 100 ? 'Terpenuhi 100%' : 'Alokasikan Freezer'}
                    </button>
                  </div>
                  
                  {po.progress === 100 && (
                    <button onClick={() => handleSelesaikanPO(po.id)} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition-transform active:scale-95 cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2 animate-in slide-in-from-bottom-2">
                      <CheckCircle2 size={18}/> Selesai &amp; Pindahkan ke Arsip
                    </button>
                  )}
                </div>
              )}

            </div>
          ))}
        </div>
      )}

      {/* =========================================================================
          MODAL DETAIL PO (MINI LEDGER)
         ========================================================================= */}
      {detailPO && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            
            <div className={`p-5 text-white flex justify-between items-center shrink-0 ${activeSubTab === 'COMPLETED' ? 'bg-emerald-950' : 'bg-slate-950'}`}>
              <div>
                <h3 className={`font-black text-sm uppercase flex items-center gap-2 tracking-wider ${activeSubTab === 'COMPLETED' ? 'text-emerald-400' : 'text-blue-400'}`}>
                  {activeSubTab === 'COMPLETED' ? <Archive size={18}/> : <Receipt size={18}/>} Rincian Lengkap PO
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Klien: {detailPO.customer_name} | Nota: {detailPO.id}</p>
              </div>
              <button type="button" onClick={() => setDetailPO(null)} className="text-slate-400 hover:text-white font-bold text-xl cursor-pointer">✕</button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar bg-slate-50 space-y-5">
              
              {/* Info Pelanggan & Catatan Khusus */}
              <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Tanggal Tulis Nota</span>
                  <span className="text-xs font-bold text-slate-800">{formatDate(detailPO.date)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Target Dikirim</span>
                  <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-3 py-1 rounded-lg">{formatDate(detailPO.targetDate)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Catatan Kasir / Dapur:</span>
                  <div className="text-xs font-bold text-slate-700 bg-orange-50 border border-orange-200 p-3 rounded-xl italic leading-relaxed">
                    "{detailPO.notes || 'Tidak ada catatan.'}"
                  </div>
                </div>
              </div>

              {/* Rincian Belanja */}
              <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3">Detail Pesanan Barang</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b text-[10px] uppercase tracking-wider">
                        <th className="p-3">Item</th>
                        <th className="p-3 text-center">Qty</th>
                        <th className="p-3 text-right">Harga</th>
                        <th className="p-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700 font-bold">
                      {detailPO.enrichedItems.map((itm, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="p-3 uppercase">{itm.name}</td>
                          <td className="p-3 text-center">{formatNumber(itm.qty)} Pcs</td>
                          <td className="p-3 text-right">{formatRupiah(itm.price || (itm.subtotal/itm.qty))}</td>
                          <td className="p-3 text-right text-slate-900 font-black">{formatRupiah(itm.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Ringkasan Keuangan */}
              <div className={`text-white p-5 rounded-2xl space-y-3 font-bold text-xs shadow-md ${activeSubTab === 'COMPLETED' ? 'bg-gradient-to-r from-emerald-900 to-emerald-800' : 'bg-gradient-to-r from-slate-900 to-slate-800'}`}>
                <div className={`flex items-center gap-2 mb-3 pb-3 border-b border-slate-700 ${activeSubTab === 'COMPLETED' ? 'text-emerald-400' : 'text-blue-400'}`}>
                  <Wallet size={18}/> <span className="uppercase tracking-widest text-[10px]">Ringkasan Keuangan</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Total Nilai PO</span>
                  <span>{formatRupiah(detailPO.total_amount)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>DP / Uang Muka Masuk ({detailPO.payment_method})</span>
                  <span className="text-emerald-400">{formatRupiah(detailPO.amount_paid)}</span>
                </div>
                <div className="border-t border-slate-700 my-2"></div>
                <div className="flex justify-between text-sm font-black">
                  <span>Sisa Pembayaran</span>
                  <span className={(detailPO.total_amount - detailPO.amount_paid) <= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {(detailPO.total_amount - detailPO.amount_paid) <= 0 ? 'LUNAS' : formatRupiah(detailPO.total_amount - detailPO.amount_paid)}
                  </span>
                </div>
              </div>

            </div>
            
            <div className="p-5 bg-white border-t border-slate-200 text-right shrink-0">
              <button type="button" onClick={() => setDetailPO(null)} className="w-full sm:w-auto px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] uppercase tracking-wider rounded-xl shadow-md cursor-pointer transition-colors">
                Tutup Arsip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL ALOKASI KARANTINA (DARI STOK BEBAS -> KE FREEZER PO)
         ========================================================================= */}
      {selectedPO && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl border border-slate-200 overflow-hidden flex flex-col h-[85vh]">
            
            <div className="p-5 bg-slate-950 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-black text-sm uppercase flex items-center gap-2 text-orange-400 tracking-wider"><ThermometerSnowflake size={18}/> Eksekusi Bekukan Stok</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Klien: {selectedPO.customer_name} | Nota: {selectedPO.id}</p>
              </div>
              <button type="button" onClick={() => setSelectedPO(null)} className="text-slate-400 hover:text-white font-bold text-xl cursor-pointer">✕</button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar bg-slate-50 space-y-5">
              <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex gap-3 mb-2 shadow-sm">
                <AlertCircle className="text-orange-600 shrink-0 mt-0.5" size={20}/>
                <div className="text-[10px] font-bold text-orange-800 normal-case leading-relaxed">
                  Masukkan jumlah fisik barang yang sudah dipisahkan ke dalam Freezer khusus pesanan ini. Sistem akan otomatis memotongnya dari <b>Stok Bebas (Gudang Utama)</b>.
                </div>
              </div>

              {selectedPO.enrichedItems.map((item, idx) => {
                const sisaButuh = item.qty - item.quarantined;
                const stokBebasLive = stockData.free[item.name] || 0;
                
                if (sisaButuh <= 0) return null; // Sembunyikan yang sudah penuh

                return (
                  <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                    <div className="pl-3">
                      <div className="font-black text-slate-800 text-sm uppercase tracking-wide mb-4">{item.name}</div>
                      
                      <div className="grid grid-cols-3 gap-3 mb-5 text-center">
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-inner">
                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Sisa Dibutuhkan</div>
                          <div className="text-lg font-black text-red-600">{formatNumber(sisaButuh)}</div>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-inner">
                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Stok Karantina</div>
                          <div className="text-lg font-black text-emerald-600">{formatNumber(item.quarantined)}</div>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 shadow-inner">
                          <div className="text-[9px] font-black text-blue-500 uppercase tracking-wider mb-1">Stok Bebas (Live)</div>
                          <div className="text-lg font-black text-blue-700">{formatNumber(stokBebasLive)}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider shrink-0">Alokasikan Pcs:</label>
                        <input 
                          type="text" 
                          value={allocations[item.name] || ''} 
                          onChange={(e) => handleAllocationChange(item.name, e.target.value)} 
                          className="flex-1 p-3 bg-slate-50 border border-slate-300 rounded-xl text-base font-black outline-none focus:bg-white focus:border-orange-500 text-slate-800 transition-colors shadow-inner"
                          placeholder="0"
                        />
                        <button 
                          onClick={() => handleAllocationChange(item.name, String(Math.min(sisaButuh, stokBebasLive)))}
                          className="px-4 py-3 bg-slate-800 hover:bg-black text-white text-[11px] font-black rounded-xl transition-colors cursor-pointer uppercase tracking-wider shadow-md"
                        >
                          Max
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            
            <div className="p-5 bg-white border-t border-slate-200 flex gap-4 shrink-0">
              <button type="button" onClick={() => setSelectedPO(null)} className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-colors cursor-pointer uppercase tracking-wider">Batal</button>
              <button type="button" onClick={submitKarantina} className="flex-1 py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider transition-transform active:scale-95">
                <Save size={18}/> Kunci &amp; Simpan Ke Karantina
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
