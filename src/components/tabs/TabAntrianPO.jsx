import React, { useState, useMemo } from 'react';
import { 
  PackageCheck, Clock, ArrowRight, Save, 
  Search, ThermometerSnowflake, AlertCircle, CheckCircle2,
  Eye, Receipt, Wallet, Archive, ListTodo
} from 'lucide-react';
import { getTodayStr, generateId, safeJsonParse, formatDate } from '../../utils/helpers';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');
const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabAntrianPO({ orders, inventoryCostLayers, user, sendToSheet, showToast }) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  const [activeSubTab, setActiveSubTab] = useState('ACTIVE'); // 'ACTIVE' | 'COMPLETED'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPO, setSelectedPO] = useState(null);
  const [allocations, setAllocations] = useState({}); 
  const [detailPO, setDetailPO] = useState(null);

  // =========================================================================
  // 1. ENGINE KALKULASI STOK BEBAS VS STOK KARANTINA
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
  // 2. FILTER & ENRICH DATA NOTA PO (SEMUA PO TANPA KECUALI)
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

  // Pisahkan berdasarkan Sub-Tab yang sedang aktif
  const displayedPOs = useMemo(() => {
    const targetList = activeSubTab === 'ACTIVE' 
      ? allPOOrders.filter(po => po.status !== 'SELESAI_KIRIM')
      : allPOOrders.filter(po => po.status === 'SELESAI_KIRIM');

    if (!searchTerm) return targetList;
    const lower = searchTerm.toLowerCase();
    return targetList.filter(po => po.id.toLowerCase().includes(lower) || String(po.customer_name).toLowerCase().includes(lower));
  }, [allPOOrders, activeSubTab, searchTerm]);

  // Statistik untuk Badge di Tab
  const countActive = allPOOrders.filter(po => po.status !== 'SELESAI_KIRIM').length;
  const countCompleted = allPOOrders.filter(po => po.status === 'SELESAI_KIRIM').length;

  // =========================================================================
  // 3. LOGIKA EKSEKUSI KARANTINA
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
      setActiveSubTab('COMPLETED'); // Otomatis arahkan pandangan bos ke tab riwayat
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-200">
      
      {/* HEADER BANNER */}
      <div className="card-holo p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs border-t-4 border-t-orange-500 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-1 normal-case">
            <ThermometerSnowflake className="text-orange-500" size={24} /> 
            Pusat Komando Antrian PO &amp; Freezer Karantina
          </h2>
          <p className="text-xs font-bold text-slate-500 normal-case max-w-2xl">
            Amankan hasil adukan dapur untuk pelanggan PO di sini. Stok yang dikarantina otomatis hilang dari peredaran Kasir untuk mencegah salah jual (Anti-Fitnah Gudang).
          </p>
        </div>
        <div className="bg-orange-50 border border-orange-200 px-4 py-3 rounded-xl shrink-0 flex items-center gap-3">
          <div className="bg-orange-100 p-2 rounded-lg"><PackageCheck size={20} className="text-orange-600"/></div>
          <div>
            <div className="text-[10px] font-black text-orange-800 uppercase tracking-widest">Total Antrian Berjalan</div>
            <div className="text-xl font-black text-orange-600">{countActive} <span className="text-sm">Nota</span></div>
          </div>
        </div>
      </div>

      {/* TOOLBAR FILTER & SUB-TABS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-3 rounded-xl border border-slate-200 shadow-3xs gap-3">
        
        {/* SUB TABS NAVIGATION */}
        <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto">
          <button 
            onClick={() => setActiveSubTab('ACTIVE')} 
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-black transition-all cursor-pointer ${
              activeSubTab === 'ACTIVE' ? 'bg-white text-orange-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ListTodo size={14}/> Antrian Berjalan
            <span className={`px-1.5 py-0.5 rounded text-[9px] ${activeSubTab === 'ACTIVE' ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-500'}`}>{countActive}</span>
          </button>
          
          <button 
            onClick={() => setActiveSubTab('COMPLETED')} 
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-black transition-all cursor-pointer ${
              activeSubTab === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 shadow-sm border border-emerald-100' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Archive size={14}/> Riwayat Selesai
            <span className={`px-1.5 py-0.5 rounded text-[9px] ${activeSubTab === 'COMPLETED' ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>{countCompleted}</span>
          </button>
        </div>

        <div className="relative w-full md:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input 
            type="text" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:bg-white focus:border-orange-400 transition-colors normal-case" 
            placeholder="Cari ID Nota atau Nama Klien..." 
          />
        </div>
      </div>

      {/* GRID KARTU PO */}
      {displayedPOs.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-16 text-center flex flex-col items-center justify-center text-slate-400">
          {activeSubTab === 'ACTIVE' ? (
             <>
               <CheckCircle2 size={48} className="mb-4 opacity-20 text-emerald-500" />
               <h3 className="text-sm font-black uppercase tracking-widest mb-1 text-slate-500">Semua Terkendali</h3>
               <p className="text-xs font-bold normal-case">Tidak ada antrian Pre-Order yang sedang berjalan saat ini.</p>
             </>
          ) : (
             <>
               <Archive size={48} className="mb-4 opacity-20" />
               <h3 className="text-sm font-black uppercase tracking-widest mb-1 text-slate-500">Arsip Kosong</h3>
               <p className="text-xs font-bold normal-case">Belum ada riwayat PO yang diselesaikan.</p>
             </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {displayedPOs.map(po => (
            <div key={po.id} className={`bg-white border rounded-2xl shadow-xs overflow-hidden flex flex-col transition-colors ${activeSubTab === 'COMPLETED' ? 'border-emerald-200' : 'border-slate-200 hover:border-orange-300'}`}>
              
              {/* Card Header */}
              <div className={`p-4 border-b flex justify-between items-start ${activeSubTab === 'COMPLETED' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-slate-200 text-slate-700 font-mono text-[9px] px-2 py-0.5 rounded font-black">{po.id}</span>
                    {activeSubTab === 'COMPLETED' ? (
                      <span className="bg-emerald-100 text-emerald-700 text-[9px] px-2 py-0.5 rounded font-black flex items-center gap-1"><CheckCircle2 size={10}/> SELESAI &amp; TERKIRIM</span>
                    ) : (
                      <span className="bg-red-100 text-red-700 text-[9px] px-2 py-0.5 rounded font-black flex items-center gap-1"><Clock size={10}/> Target: {formatDate(po.targetDate)}</span>
                    )}
                  </div>
                  <h3 className="font-black text-slate-800 text-base uppercase">{po.customer_name}</h3>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-500">Status Stok Karantina</div>
                  <div className={`text-lg font-black ${po.progress === 100 || activeSubTab === 'COMPLETED' ? 'text-emerald-600' : 'text-orange-600'}`}>
                    {activeSubTab === 'COMPLETED' ? '100%' : `${po.progress.toFixed(0)}%`}
                  </div>
                </div>
              </div>

              {/* Progress Bar (Jika Selesai, Bar Full Hijau) */}
              <div className="w-full bg-slate-200 h-1.5">
                <div className={`h-1.5 transition-all duration-500 ${po.progress === 100 || activeSubTab === 'COMPLETED' ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: activeSubTab === 'COMPLETED' ? '100%' : `${po.progress}%` }}></div>
              </div>

              {/* Card Body (Item List Compact) */}
              <div className={`p-4 flex-1 space-y-3 ${activeSubTab === 'COMPLETED' ? 'opacity-80' : ''}`}>
                {po.enrichedItems.map((item, i) => (
                  <div key={i} className={`flex justify-between items-center border p-2.5 rounded-xl ${activeSubTab === 'COMPLETED' ? 'bg-white border-slate-100' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex-1">
                      <div className="font-bold text-slate-700 text-xs uppercase line-clamp-1">{item.name}</div>
                      <div className="text-[10px] font-bold text-slate-400 mt-0.5">Order: {formatNumber(item.qty)} Pcs</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-[9px] font-black text-slate-400 uppercase">{activeSubTab === 'COMPLETED' ? 'Dikirim' : 'Terkumpul'}</div>
                        <div className="font-black text-sm text-emerald-600">{activeSubTab === 'COMPLETED' ? formatNumber(item.qty) : formatNumber(item.quarantined)}</div>
                      </div>
                      
                      {activeSubTab === 'ACTIVE' && (
                        <>
                          <ArrowRight size={14} className="text-slate-300"/>
                          <div className="text-right w-16">
                            <div className="text-[9px] font-black text-slate-400 uppercase">Kekurangan</div>
                            <div className="font-black text-sm text-red-500">{formatNumber(item.qty - item.quarantined)}</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Card Footer / Actions Berubah Tergantung Tab */}
              {activeSubTab === 'COMPLETED' ? (
                <div className="p-4 bg-white border-t border-slate-100">
                  <button onClick={() => setDetailPO(po)} className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-black rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer uppercase">
                    <Eye size={16}/> Buka Arsip &amp; Detail PO
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setDetailPO(po)} 
                      className="flex-1 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px] font-black rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer uppercase"
                    >
                      <Eye size={14}/> Cek Detail PO
                    </button>
                    <button 
                      onClick={() => handleOpenModal(po)} 
                      disabled={po.progress === 100}
                      className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-black rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer uppercase"
                    >
                      <ThermometerSnowflake size={14}/> {po.progress === 100 ? 'Terpenuhi 100%' : 'Alokasikan Freezer'}
                    </button>
                  </div>
                  
                  {po.progress === 100 && (
                    <button onClick={() => handleSelesaikanPO(po.id)} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition-colors cursor-pointer uppercase flex items-center justify-center gap-2 animate-in slide-in-from-bottom-2">
                      <CheckCircle2 size={16}/> Selesai &amp; Pindahkan ke Arsip
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            
            <div className={`p-4 text-white flex justify-between items-center shrink-0 ${activeSubTab === 'COMPLETED' ? 'bg-emerald-950' : 'bg-slate-950'}`}>
              <div>
                <h3 className={`font-black text-xs uppercase flex items-center gap-1.5 ${activeSubTab === 'COMPLETED' ? 'text-emerald-400' : 'text-blue-400'}`}>
                  {activeSubTab === 'COMPLETED' ? <Archive size={16}/> : <Receipt size={16}/>} Rincian Lengkap PO {activeSubTab === 'COMPLETED' ? '(ARSIP)' : ''}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5 normal-case">Klien: {detailPO.customer_name} | Nota: {detailPO.id}</p>
              </div>
              <button type="button" onClick={() => setDetailPO(null)} className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer">✕</button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar bg-slate-50 space-y-4">
              
              {/* Info Pelanggan & Catatan Khusus */}
              <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-3xs">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Tanggal Tulis Nota</span>
                  <span className="text-xs font-bold text-slate-800">{formatDate(detailPO.date)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Target Dikirim</span>
                  <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">{formatDate(detailPO.targetDate)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Catatan Kasir / Dapur:</span>
                  <div className="text-xs font-bold text-slate-700 bg-orange-50 border border-orange-100 p-2 rounded-lg italic">
                    {detailPO.notes || 'Tidak ada catatan.'}
                  </div>
                </div>
              </div>

              {/* Rincian Belanja */}
              <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-3xs">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Detail Pesanan Barang</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b text-[10px]">
                        <th className="p-2">Item</th>
                        <th className="p-2 text-center">Qty</th>
                        <th className="p-2 text-right">Harga</th>
                        <th className="p-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700 font-bold">
                      {detailPO.enrichedItems.map((itm, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2 uppercase">{itm.name}</td>
                          <td className="p-2 text-center">{formatNumber(itm.qty)} Pcs</td>
                          <td className="p-2 text-right">{formatRupiah(itm.price || (itm.subtotal/itm.qty))}</td>
                          <td className="p-2 text-right text-slate-900">{formatRupiah(itm.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Ringkasan Keuangan */}
              <div className={`text-white p-4 rounded-xl space-y-2 font-bold text-[11px] shadow-sm ${activeSubTab === 'COMPLETED' ? 'bg-gradient-to-r from-emerald-900 to-emerald-800' : 'bg-gradient-to-r from-slate-900 to-slate-800'}`}>
                <div className={`flex items-center gap-2 mb-2 pb-2 border-b border-slate-700 ${activeSubTab === 'COMPLETED' ? 'text-emerald-400' : 'text-blue-400'}`}>
                  <Wallet size={16}/> <span className="uppercase tracking-wider">Ringkasan Keuangan</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Total Nilai PO</span>
                  <span>{formatRupiah(detailPO.total_amount)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>DP / Uang Muka Masuk ({detailPO.payment_method})</span>
                  <span className="text-emerald-400">{formatRupiah(detailPO.amount_paid)}</span>
                </div>
                <div className="border-t border-slate-700 my-1"></div>
                <div className="flex justify-between text-sm font-black">
                  <span>Sisa Pembayaran</span>
                  <span className={(detailPO.total_amount - detailPO.amount_paid) <= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {(detailPO.total_amount - detailPO.amount_paid) <= 0 ? 'LUNAS' : formatRupiah(detailPO.total_amount - detailPO.amount_paid)}
                  </span>
                </div>
              </div>

            </div>
            
            <div className="p-4 bg-white border-t border-slate-200 text-right shrink-0">
              <button type="button" onClick={() => setDetailPO(null)} className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] rounded-xl shadow-md cursor-pointer uppercase w-full sm:w-auto">
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200 overflow-hidden flex flex-col h-[85vh]">
            
            <div className="p-4 bg-slate-950 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-black text-xs uppercase flex items-center gap-1.5 text-orange-400"><ThermometerSnowflake size={16}/> Eksekusi Bekukan Stok</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5 normal-case">Klien: {selectedPO.customer_name} | Nota: {selectedPO.id}</p>
              </div>
              <button type="button" onClick={() => setSelectedPO(null)} className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer">✕</button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar bg-slate-50 space-y-4">
              <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl flex gap-3 mb-4">
                <AlertCircle className="text-orange-600 shrink-0" size={18}/>
                <div className="text-[10px] font-bold text-orange-800 normal-case leading-relaxed">
                  Masukkan jumlah fisik barang yang sudah dipisahkan ke dalam Freezer khusus pesanan ini. Sistem akan otomatis memotongnya dari <b>Stok Bebas (Gudang Utama)</b>.
                </div>
              </div>

              {selectedPO.enrichedItems.map((item, idx) => {
                const sisaButuh = item.qty - item.quarantined;
                const stokBebasLive = stockData.free[item.name] || 0;
                
                if (sisaButuh <= 0) return null; // Sembunyikan yang sudah penuh

                return (
                  <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <div className="pl-2">
                      <div className="font-black text-slate-800 text-xs uppercase mb-3">{item.name}</div>
                      
                      <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-2">
                          <div className="text-[9px] font-black text-slate-400 uppercase">Sisa Dibutuhkan</div>
                          <div className="text-sm font-black text-red-600">{formatNumber(sisaButuh)}</div>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-2">
                          <div className="text-[9px] font-black text-slate-400 uppercase">Stok Karantina</div>
                          <div className="text-sm font-black text-emerald-600">{formatNumber(item.quarantined)}</div>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-2">
                          <div className="text-[9px] font-black text-blue-500 uppercase">Stok Bebas (Live)</div>
                          <div className="text-sm font-black text-blue-700">{formatNumber(stokBebasLive)}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="text-[10px] font-black text-slate-600 normal-case w-24">Alokasikan Pcs:</label>
                        <input 
                          type="text" 
                          value={allocations[item.name] || ''} 
                          onChange={(e) => handleAllocationChange(item.name, e.target.value)} 
                          className="flex-1 p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-black outline-none focus:bg-white focus:border-orange-500 text-slate-800 transition-colors"
                          placeholder="0"
                        />
                        <button 
                          onClick={() => handleAllocationChange(item.name, String(Math.min(sisaButuh, stokBebasLive)))}
                          className="px-3 py-2.5 bg-slate-800 hover:bg-black text-white text-[10px] font-black rounded-lg transition-colors cursor-pointer"
                        >
                          Max
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            
            <div className="p-4 bg-white border-t border-slate-200 flex gap-3 shrink-0">
              <button type="button" onClick={() => setSelectedPO(null)} className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-colors cursor-pointer uppercase">Batal</button>
              <button type="button" onClick={submitKarantina} className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 uppercase">
                <Save size={16}/> Kunci &amp; Simpan ke Karantina
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
