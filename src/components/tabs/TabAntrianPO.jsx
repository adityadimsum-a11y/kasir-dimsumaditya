import React, { useState, useMemo } from 'react';
import { 
  PackageCheck, Clock, ArrowRight, Save, 
  Search, ThermometerSnowflake, Box, AlertCircle, CheckCircle2
} from 'lucide-react';
import { getTodayStr, generateId, safeJsonParse, formatDate } from '../../utils/helpers';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabAntrianPO({ orders, inventoryCostLayers, user, sendToSheet, showToast }) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPO, setSelectedPO] = useState(null);
  const [allocations, setAllocations] = useState({}); 

  // =========================================================================
  // 1. ENGINE KALKULASI STOK BEBAS VS STOK KARANTINA
  // =========================================================================
  const stockData = useMemo(() => {
    const free = {};
    const quarantine = {}; 
    
    (inventoryCostLayers || []).forEach(l => {
      if (l.isDeleted || l.branch_id !== currentBranch) return;
      
      // Hitung Stok Bebas Jual (Tidak termasuk yang dikarantina)
      if (l.status === 'ACTIVE') {
        free[l.item_name] = (free[l.item_name] || 0) + Number(l.qty_remaining || 0);
      } 
      // Hitung Dompet Karantina (Dikelompokkan per ID Nota PO)
      else if (l.status === 'KARANTINA') {
        if (!quarantine[l.reference_id]) quarantine[l.reference_id] = {};
        quarantine[l.reference_id][l.item_name] = (quarantine[l.reference_id][l.item_name] || 0) + Number(l.qty_remaining || 0);
      }
    });
    return { free, quarantine };
  }, [inventoryCostLayers, currentBranch]);

  // =========================================================================
  // 2. FILTER & ENRICH DATA NOTA PO (PROGRES KARANTINA)
  // =========================================================================
  const poOrders = useMemo(() => {
    const filtered = (orders || []).filter(o => {
      if (o.isDeleted || o.branch_id !== currentBranch) return false;
      // Deteksi Nota PO: Metode bayar COD_PO atau ada keterangan TARGET PO
      const isPO = o.payment_method === 'COD_PO' || String(o.notes).includes('TARGET PO');
      // Sembunyikan yang sudah diarsipkan / selesai total
      return isPO && o.status !== 'SELESAI_KIRIM'; 
    });

    return filtered.map(po => {
      const items = safeJsonParse(po.items, []);
      let totalOrdered = 0;
      let totalQuarantined = 0;
      
      const enrichedItems = items.map(i => {
        // Ambil saldo karantina khusus untuk item ini di nota ini
        const qQty = stockData.quarantine[po.id]?.[i.name] || 0;
        totalOrdered += Number(i.qty || 0);
        totalQuarantined += qQty;
        return { ...i, quarantined: qQty };
      });

      // Cabut Tanggal Target dari Notes jika ada
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

  // Pencarian Cepat
  const displayedPOs = useMemo(() => {
    if (!searchTerm) return poOrders;
    const lower = searchTerm.toLowerCase();
    return poOrders.filter(po => po.id.toLowerCase().includes(lower) || String(po.customer_name).toLowerCase().includes(lower));
  }, [poOrders, searchTerm]);

  // =========================================================================
  // 3. LOGIKA EKSEKUSI KARANTINA (DARI STOK BEBAS -> KE FREEZER KARANTINA)
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

        // 1. Catat Barang Keluar dari Stok Bebas
        payloads.push({
          id: generateId('INV', todayStr) + '-OUT-' + Math.floor(Math.random() * 1000),
          date: todayStr, branch_id: currentBranch, category: 'PENYESUAIAN_KARANTINA',
          item_name: item.name, qty_remaining: -inputVal, unit_cost: 0, status: 'USED',
          reference_id: selectedPO.id, notes: `Dikunci untuk Karantina PO (${selectedPO.id})`, isDeleted: false
        });

        // 2. Catat Barang Masuk ke Dompet Karantina Nota Ini
        payloads.push({
          id: generateId('INV', todayStr) + '-IN-' + Math.floor(Math.random() * 1000),
          date: todayStr, branch_id: currentBranch, category: 'KARANTINA_PO',
          item_name: item.name, qty_remaining: inputVal, unit_cost: 0, status: 'KARANTINA', // STATUS SAKTI
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
    if (!window.confirm("Tandai PO ini sebagai Selesai/Terkirim? (Akan hilang dari daftar antrian Karantina)")) return;
    const isSuccess = await sendToSheet('update', { id: poId, status: 'SELESAI_KIRIM' }, 'orders');
    if (isSuccess) showToast("Nota PO diarsipkan!", "success");
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
            <div className="text-xl font-black text-orange-600">{displayedPOs.length} <span className="text-sm">Nota</span></div>
          </div>
        </div>
      </div>

      {/* TOOLBAR FILTER */}
      <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-3xs">
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
          <CheckCircle2 size={48} className="mb-4 opacity-20 text-emerald-500" />
          <h3 className="text-sm font-black uppercase tracking-widest mb-1 text-slate-500">Semua Terkendali</h3>
          <p className="text-xs font-bold normal-case">Tidak ada antrian Pre-Order yang sedang berjalan saat ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {displayedPOs.map(po => (
            <div key={po.id} className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col hover:border-orange-300 transition-colors">
              
              {/* Card Header */}
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-slate-200 text-slate-700 font-mono text-[9px] px-2 py-0.5 rounded font-black">{po.id}</span>
                    <span className="bg-red-100 text-red-700 text-[9px] px-2 py-0.5 rounded font-black flex items-center gap-1"><Clock size={10}/> Target: {formatDate(po.targetDate)}</span>
                  </div>
                  <h3 className="font-black text-slate-800 text-base uppercase">{po.customer_name}</h3>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-500">Status Stok Karantina</div>
                  <div className={`text-lg font-black ${po.progress === 100 ? 'text-emerald-600' : 'text-orange-600'}`}>
                    {po.progress.toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 h-1.5">
                <div className={`h-1.5 transition-all duration-500 ${po.progress === 100 ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${po.progress}%` }}></div>
              </div>

              {/* Card Body (Item List Compact) */}
              <div className="p-4 flex-1 space-y-3">
                {po.enrichedItems.map((item, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
                    <div className="flex-1">
                      <div className="font-bold text-slate-700 text-xs uppercase line-clamp-1">{item.name}</div>
                      <div className="text-[10px] font-bold text-slate-400 mt-0.5">Order: {formatNumber(item.qty)} Pcs</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-[9px] font-black text-slate-400 uppercase">Terkumpul</div>
                        <div className="font-black text-sm text-emerald-600">{formatNumber(item.quarantined)}</div>
                      </div>
                      <ArrowRight size={14} className="text-slate-300"/>
                      <div className="text-right w-16">
                        <div className="text-[9px] font-black text-slate-400 uppercase">Kekurangan</div>
                        <div className="font-black text-sm text-red-500">{formatNumber(item.qty - item.quarantined)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Card Footer / Actions */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => handleOpenModal(po)} 
                  disabled={po.progress === 100}
                  className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-black rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ThermometerSnowflake size={14}/> {po.progress === 100 ? 'Stok Terpenuhi 100%' : 'Alokasikan Ke Freezer'}
                </button>
                {po.progress === 100 && (
                  <button onClick={() => handleSelesaikanPO(po.id)} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition-colors cursor-pointer">
                    Selesai &amp; Arsipkan
                  </button>
                )}
              </div>

            </div>
          ))}
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
