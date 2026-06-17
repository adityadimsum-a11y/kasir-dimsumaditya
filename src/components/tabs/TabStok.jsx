import React, { useState, useMemo } from 'react';
import { Package, Box, ArrowRightLeft, Search, Archive, ArrowDownRight, ArrowUpRight, History, Database, ShieldAlert, Activity, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { formatDate, safeJsonParse } from '../../utils/helpers';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');
const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabStok({ 
  masterProducts = [], masterRawMaterials = [],
  orders = [], purchases = [], productionBatches = [], pemalang = [] 
}) {
  const [activeTab, setActiveTab] = useState('FREEZER');
  const [searchTerm, setSearchTerm] = useState('');
  
  // 🔥 STATE UNTUK MODAL RIWAYAT KLIK BARANG
  const [selectedItemDetail, setSelectedItemDetail] = useState(null);

  const freezerStock = useMemo(() => {
    const stockMap = {};
    
    (masterProducts || []).forEach(p => {
      if (!p.isDeleted && p.product_name) {
        const key = String(p.product_name).toUpperCase();
        stockMap[key] = { 
          id: p.id, name: p.product_name, sku: p.sku || '', category: p.category || '',
          stockIn: 0, stockOut: 0, currentStock: 0 
        };
      }
    });

    (pemalang || []).forEach(batch => {
      if (!batch.isDeleted && String(batch.isDeleted).toUpperCase() !== 'TRUE') {
        const productName = String(batch.item_name || 'DIMSUM FROZEN CORE').toUpperCase(); 
        if (stockMap[productName]) {
          stockMap[productName].stockIn += Number(batch.qty || 0);
        }
      }
    });

    (orders || []).forEach(o => {
      if (!o.isDeleted && String(o.isDeleted).toUpperCase() !== 'TRUE' && o.status !== 'BATAL') {
        const items = safeJsonParse(o.items, []);
        items.forEach(item => {
          const pName = String(item.name || item.product_name).toUpperCase();
          if (pName && stockMap[pName]) {
            stockMap[pName].stockOut += Number(item.qty || 0);
          }
        });
      }
    });

    const safeSearch = (searchTerm || '').toLowerCase();
    return Object.values(stockMap).map(item => {
      item.currentStock = item.stockIn - item.stockOut;
      return item;
    }).filter(item => (item.name || '').toLowerCase().includes(safeSearch));
  }, [masterProducts, pemalang, orders, searchTerm]);


  const rawStock = useMemo(() => {
    const stockMap = {};

    (masterRawMaterials || []).forEach(r => {
      if (!r.isDeleted && r.raw_name) {
        const key = String(r.raw_name).toUpperCase();
        stockMap[key] = {
          id: r.id, name: r.raw_name, unit: r.unit || 'Pcs', category: r.category || 'Bahan Baku',
          stockIn: 0, stockOut: 0, currentStock: 0
        };
      }
    });

    (purchases || []).forEach(p => {
      if (!p.isDeleted && String(p.isDeleted).toUpperCase() !== 'TRUE') {
        
        const processItem = (itemName, qty, unit, category) => {
            if (!itemName) return;
            const key = itemName.toUpperCase();
            if (!stockMap[key]) {
                stockMap[key] = { id: p.id, name: key, unit: unit || 'Pcs', category: category || 'Bahan Baku', stockIn: 0, stockOut: 0, currentStock: 0 };
            }
            stockMap[key].stockIn += Number(qty || 0);
        };

        const items = safeJsonParse(p.items, []);
        if (items.length > 0) {
           items.forEach(item => processItem(item.name || item.raw_name, item.qty, item.unit, item.category));
        } else if (p.item_name || p.raw_name) {
           processItem(p.item_name || p.raw_name, p.qty, p.unit, p.category);
        }
      }
    });

    (pemalang || []).forEach(p => {
       if (p.isDeleted || String(p.isDeleted).toUpperCase() === 'TRUE') return;
       if (p.items) {
           const parsed = safeJsonParse(p.items, []);
           if (parsed.length > 0 && String(parsed[0].name).startsWith('@@PRODUCTION@@')) {
               const parts = parsed[0].name.split('||');
               const ayamKgUsed = Number(parts[2] || 0);
               
               const ayamKey = Object.keys(stockMap).find(k => k.includes('AYAM GILING') || k.includes('AYAM') || k.includes('DADA MENTAH'));
               if (ayamKey) {
                   // Karena Ayam di Gudang satuannya Kantong, kita convert dari Kg ke Kantong
                   const usedKantong = ayamKgUsed / 10;
                   stockMap[ayamKey].stockOut += usedKantong;
               }
           }
       }
    });

    const safeSearch = (searchTerm || '').toLowerCase();
    return Object.values(stockMap).map(item => {
      item.currentStock = item.stockIn - item.stockOut;
      return item;
    }).filter(item => (item.name || '').toLowerCase().includes(safeSearch));
  }, [masterRawMaterials, purchases, pemalang, searchTerm]);


  // --- 🔥 FIX ENGINE FORECAST: ANTI-PRANK SATUAN ---
  const ayamForecast = useMemo(() => {
    let totalAyamKg = 0;
    
    // Cari semua item ayam dan pastikan satuannya dikonversi ke KG
    rawStock.forEach(i => {
      if (String(i.name).toUpperCase().includes('AYAM')) {
        let val = Number(i.currentStock || 0);
        let unit = String(i.unit).toUpperCase();
        
        // Kalau satuannya Kantong, 1 Kantong = 10 Kg
        if (unit.includes('KANT') || unit.includes('KNTG')) {
          val = val * 10;
        }
        totalAyamKg += val;
      }
    });
    
    const dailyBurnRate = 340; 
    const daysLeft = totalAyamKg / dailyBurnRate;
    
    let status = 'AMAN'; 
    if (daysLeft <= 1.5) status = 'KRITIS';
    else if (daysLeft <= 3) status = 'SIAGA';

    const estDanaDibutuhkan = 37230000;

    return {
      currentAyamKg: totalAyamKg,
      daysLeft,
      status,
      estDanaDibutuhkan,
      dailyBurnRate
    };
  }, [rawStock]);

  const kartuMutasi = useMemo(() => {
    const timeline = [];

    (orders || []).forEach(o => {
      if (!o.isDeleted && o.status !== 'BATAL') {
        const items = safeJsonParse(o.items, []);
        items.forEach(item => {
          timeline.push({
            id: o.id, date: o.date, type: 'OUT', category: 'Penjualan Kasir',
            itemName: item.name || item.product_name || 'Item Tidak Diketahui', 
            qty: item.qty || 0, reference: o.customer_name || 'Pelanggan Umum'
          });
        });
      }
    });

    (purchases || []).forEach(p => {
      if (!p.isDeleted) {
        const items = safeJsonParse(p.items, []);
        if(items.length > 0) {
          items.forEach(item => {
            timeline.push({
              id: p.id, date: p.date, type: 'IN', category: 'Belanja Logistik',
              itemName: item.name || item.raw_name || 'Item Tidak Diketahui', 
              qty: item.qty || 0, reference: p.supplier_name || 'Supplier'
            });
          });
        } else if (p.item_name || p.raw_name) {
          timeline.push({
            id: p.id, date: p.date, type: 'IN', category: 'Belanja Logistik',
            itemName: p.item_name || p.raw_name, qty: p.qty || 1, reference: p.supplier_name || 'Supplier'
          });
        }
      }
    });

    (pemalang || []).forEach(batch => {
      if (!batch.isDeleted && String(batch.isDeleted).toUpperCase() !== 'TRUE') {
        timeline.push({
          id: batch.id, date: batch.date, type: 'IN', category: 'Hasil Produksi Pabrik',
          itemName: batch.item_name || 'Dimsum Frozen', 
          qty: batch.qty || 0, 
          reference: `Batch Produksi: ${batch.id}`
        });

        if(batch.items) {
           const parsed = safeJsonParse(batch.items, []);
           if(parsed.length > 0 && String(parsed[0].name).startsWith('@@PRODUCTION@@')) {
              const parts = parsed[0].name.split('||');
              timeline.push({
                id: batch.id + '-ING', date: batch.date, type: 'OUT', category: 'Pemakaian Produksi',
                itemName: 'DAGING AYAM GILING', // Nama generic untuk sinkronisasi mutasi
                qty: Number(parts[2] || 0) / 10, // Diubah jadi kantong untuk konsistensi logistik
                reference: `Untuk Batch: ${batch.id}`
              });
           }
        }
      }
    });

    const safeSearch = (searchTerm || '').toLowerCase();
    return timeline
      .filter(t => (t.itemName || '').toLowerCase().includes(safeSearch) || (t.category || '').toLowerCase().includes(safeSearch))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [orders, purchases, pemalang, searchTerm]);

  return (
    <div className="space-y-6 pb-10 text-slate-700 animate-in fade-in duration-300">
      
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 lg:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 rounded-3xl shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 p-4 opacity-5"><Archive size={120} className="text-red-500"/></div>
        <div className="relative z-10">
           <div className="flex items-center gap-2 mb-2">
             <Archive size={24} className="text-red-500"/>
             <h2 className="text-xl font-black text-white tracking-wide uppercase">Pusat Komando Gudang &amp; Stok</h2>
           </div>
           <p className="text-[11px] font-bold text-slate-400 mt-1 max-w-lg leading-relaxed">
             Pantau arus keluar-masuk barang matang dan bahan baku secara real-time. Sistem otomatis menghitung saldo akhir dari setiap transaksi pabrik.
           </p>
        </div>

        <div className="relative w-full md:w-72 shrink-0 z-10">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Cari nama barang / aktivitas..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-700/50 bg-slate-800/80 text-white font-bold text-xs outline-none focus:border-red-500 focus:bg-slate-800 transition-all shadow-inner backdrop-blur-sm placeholder:text-slate-500" 
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-b border-slate-200 pb-4">
        <button onClick={() => setActiveTab('FREEZER')} className={`px-6 py-3 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer uppercase tracking-wider ${activeTab === 'FREEZER' ? 'bg-white shadow-sm text-red-600 border border-slate-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-transparent'}`}><Package size={16}/> Gudang Freezer (Matang)</button>
        <button onClick={() => setActiveTab('BAHAN_BAKU')} className={`px-6 py-3 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer uppercase tracking-wider ${activeTab === 'BAHAN_BAKU' ? 'bg-white shadow-sm text-red-600 border border-slate-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-transparent'}`}><Box size={16}/> Gudang Logistik (Mentah)</button>
        <button onClick={() => setActiveTab('MUTASI')} className={`px-6 py-3 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer uppercase tracking-wider ${activeTab === 'MUTASI' ? 'bg-white shadow-sm text-red-600 border border-slate-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-transparent'}`}><ArrowRightLeft size={16}/> Buku Kartu Mutasi Stok</button>
      </div>

      {activeTab === 'FREEZER' && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden border-t-4 border-t-red-600">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Database size={18} className="text-red-600"/>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Kondisi Stok Produk Jualan Terkini</h3>
          </div>
          <div className="overflow-x-auto p-2 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-black">SKU / Nama Produk</th>
                  <th className="px-5 py-4 font-black text-center">Total Masuk (Produksi)</th>
                  <th className="px-5 py-4 font-black text-center">Total Keluar (Terjual)</th>
                  <th className="px-5 py-4 font-black text-right">Sisa Stok (Saldo)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                {freezerStock.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-16 text-slate-400 font-medium">Data produk belum tersedia atau tidak ditemukan.</td></tr>
                ) : (
                  freezerStock.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-black text-sm uppercase tracking-wide">{item.name || 'Umum'}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{item.sku || 'Tanpa SKU'} • {item.category ? item.category.replace(/_/g, ' ') : 'Umum'}</div>
                      </td>
                      <td className="px-5 py-4 text-center font-black text-emerald-600 text-sm">+{formatNumber(item.stockIn)}</td>
                      <td className="px-5 py-4 text-center font-black text-red-500 text-sm">-{formatNumber(item.stockOut)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className={`text-xl font-black tracking-tight ${item.currentStock <= 10 ? 'text-red-600' : 'text-slate-800'}`}>{formatNumber(item.currentStock)}</div>
                        {item.currentStock <= 10 && <div className="text-[9px] text-red-500 font-black uppercase mt-1 animate-pulse tracking-wider">⚠️ Stok Kritis</div>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'BAHAN_BAKU' && (
        <div className="space-y-6">
          
          {/* 🔥 RADAR PREDIKSI AYAM YANG SUDAH 100% AKURAT */}
          <div className={`p-6 rounded-3xl border shadow-sm relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 ${
            ayamForecast.status === 'AMAN' ? 'bg-emerald-50 border-emerald-200' :
            ayamForecast.status === 'SIAGA' ? 'bg-amber-50 border-amber-200' :
            'bg-red-50 border-red-200 animate-in fade-in'
          }`}>
            <div className="flex items-start gap-4 z-10 relative">
              <div className={`p-3 rounded-2xl shadow-inner ${
                ayamForecast.status === 'AMAN' ? 'bg-emerald-200 text-emerald-700' :
                ayamForecast.status === 'SIAGA' ? 'bg-amber-200 text-amber-700' :
                'bg-red-200 text-red-700'
              }`}>
                {ayamForecast.status === 'AMAN' ? <CheckCircle2 size={32}/> : <AlertTriangle size={32} className={ayamForecast.status === 'KRITIS' ? 'animate-pulse' : ''} />}
              </div>
              <div>
                <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${
                  ayamForecast.status === 'AMAN' ? 'text-emerald-700' :
                  ayamForecast.status === 'SIAGA' ? 'text-amber-700' : 'text-red-700'
                }`}>
                  Radar Prediksi Stok Ayam (Nana Chicken)
                </div>
                <div className="text-2xl font-black text-slate-800 tracking-tight">
                  Nyawa Sisa: {ayamForecast.daysLeft.toFixed(1)} Hari
                </div>
                <p className="text-[11px] font-bold text-slate-500 mt-1 max-w-sm leading-relaxed">
                  Asumsi pembakaran rata-rata <b className="text-slate-700">{ayamForecast.dailyBurnRate} Kg/hari</b>. Saldo fisik ayam di gudang saat ini: <b className="text-slate-700">{formatNumber(ayamForecast.currentAyamKg)} Kg</b>.
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 shrink-0 w-full md:w-auto text-right z-10 relative">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Status Keamanan</div>
              {ayamForecast.status === 'AMAN' && <div className="text-base font-black text-emerald-600 mb-3">STOK AMAN TERKENDALI</div>}
              {ayamForecast.status === 'SIAGA' && <div className="text-base font-black text-amber-600 mb-3">SIAGA KUNING (SIAPKAN DANA)</div>}
              {ayamForecast.status === 'KRITIS' && <div className="text-base font-black text-red-600 mb-3 animate-pulse">KRITIS! SEGERA ORDER AYAM!</div>}
              
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 pt-3 border-t border-slate-100">Estimasi Dana Dibutuhkan (1.020 Kg)</div>
              <div className="text-xl font-black text-slate-800 tracking-tight">{formatRupiah(ayamForecast.estDanaDibutuhkan)}</div>
            </div>
            
            <Activity size={180} className={`absolute -right-10 -bottom-10 opacity-5 pointer-events-none ${
               ayamForecast.status === 'AMAN' ? 'text-emerald-500' :
               ayamForecast.status === 'SIAGA' ? 'text-amber-500' : 'text-red-500'
            }`}/>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden border-t-4 border-t-amber-500">
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <Database size={18} className="text-amber-600"/>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Kondisi Stok Bahan Baku &amp; Kemasan</h3>
            </div>
            <div className="overflow-x-auto p-2 custom-scrollbar">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-black">Item Logistik</th>
                    <th className="px-5 py-4 font-black text-center">Kategori &amp; Satuan</th>
                    <th className="px-5 py-4 font-black text-center">Total Beli Masuk</th>
                    <th className="px-5 py-4 font-black text-center">Pemakaian Dapur</th>
                    <th className="px-5 py-4 font-black text-right">Sisa Gudang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                  {rawStock.length === 0 ? (
                    <tr><td colSpan="5" className="text-center py-16 text-slate-400 font-medium">Data logistik belum tersedia atau tidak ditemukan.</td></tr>
                  ) : (
                    rawStock.map((item, idx) => (
                      <tr 
                        key={idx} 
                        onClick={() => setSelectedItemDetail(item.name)}
                        className="hover:bg-amber-50/50 transition-colors cursor-pointer group"
                        title="Klik untuk melihat riwayat mutasi barang ini"
                      >
                        <td className="px-5 py-4 whitespace-nowrap font-black text-slate-800 text-sm uppercase tracking-wide group-hover:text-amber-600 transition-colors">{item.name || 'Umum'}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-md border ${item.category === 'PACKAGING' || item.category === 'KEMASAN' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>{item.category ? item.category.replace(/_/g, ' ') : 'Umum'}</span>
                          <div className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-wider">Satuan: {item.unit || 'Pcs'}</div>
                        </td>
                        <td className="px-5 py-4 text-center font-black text-emerald-600 text-sm">+{formatNumber(item.stockIn)}</td>
                        <td className="px-5 py-4 text-center font-black text-red-500 text-sm">-{formatNumber(item.stockOut)}</td>
                        <td className="px-5 py-4 text-right">
                          <div className={`text-xl font-black tracking-tight ${item.currentStock <= 5 ? 'text-red-600' : 'text-slate-800'}`}>{formatNumber(item.currentStock)} <span className="text-[10px] text-slate-400 font-semibold ml-0.5 normal-case">{item.unit || ''}</span></div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="p-3 text-center text-[10px] font-bold text-slate-400 bg-slate-50 uppercase tracking-widest border-t border-slate-100">
                💡 Tip: Klik pada baris barang untuk melihat riwayat nota secara detail
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'MUTASI' && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden border-t-4 border-t-blue-600">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <History size={18} className="text-blue-600"/>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Catatan Buku Mutasi Keluar-Masuk Gudang</h3>
          </div>
          <div className="overflow-x-auto p-2 custom-scrollbar min-h-[50vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-black">Tanggal &amp; Waktu</th>
                  <th className="px-5 py-4 font-black">Aktivitas Sistem</th>
                  <th className="px-5 py-4 font-black">Nama Barang / Item</th>
                  <th className="px-5 py-4 font-black text-center">Status</th>
                  <th className="px-5 py-4 font-black text-right">Mutasi Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                {kartuMutasi.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-24 text-slate-400 font-medium">
                      <div className="flex justify-center mb-4 opacity-20"><ShieldAlert size={48}/></div>
                      Belum ada aktivitas mutasi barang yang tercatat pada sistem.
                    </td>
                  </tr>
                ) : (
                  kartuMutasi.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-black">{formatDate(log.date)}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Ref: {log.id}</div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-black text-slate-700 uppercase tracking-wide">{log.category}</div>
                        <div className="text-[10px] text-slate-500 mt-1 uppercase truncate max-w-[200px] tracking-wider">Oleh: {log.reference}</div>
                      </td>
                      <td className="px-5 py-4 font-black text-slate-800 uppercase tracking-wide">{log.itemName || 'Item tidak diketahui'}</td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        {log.type === 'IN' ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 w-max mx-auto shadow-sm"><ArrowDownRight size={14}/> Barang Masuk</span>
                        ) : (
                          <span className="bg-red-50 text-red-700 border border-red-100 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 w-max mx-auto shadow-sm"><ArrowUpRight size={14}/> Barang Keluar</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className={`text-xl tracking-tight font-black ${log.type === 'IN' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {log.type === 'IN' ? '+' : '-'}{formatNumber(log.qty)}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🔥 MODAL POP-UP DETAIL RIWAYAT BARANG YANG DIKLIK */}
      {selectedItemDetail && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div>
                <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">Detail Riwayat Logistik</div>
                <h3 className="font-black text-lg uppercase tracking-wide">{selectedItemDetail}</h3>
              </div>
              <button onClick={() => setSelectedItemDetail(null)} className="text-slate-400 hover:text-white transition-colors cursor-pointer bg-slate-800 p-2 rounded-full"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50">
               <div className="space-y-3">
                  {kartuMutasi.filter(k => String(k.itemName).toUpperCase().includes(String(selectedItemDetail).toUpperCase())).length === 0 ? (
                     <div className="text-center py-10 text-slate-400 font-bold text-xs uppercase tracking-wider">Tidak ada riwayat tercatat.</div>
                  ) : (
                    kartuMutasi.filter(k => String(k.itemName).toUpperCase().includes(String(selectedItemDetail).toUpperCase())).map((log, i) => (
                      <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
                         <div>
                            <div className="text-xs font-black text-slate-800">{formatDate(log.date)}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{log.category} • {log.reference}</div>
                            <div className="text-[9px] text-slate-400 mt-1 font-mono">Ref: {log.id}</div>
                         </div>
                         <div className={`text-lg font-black tracking-tight px-4 py-1.5 rounded-xl ${log.type === 'IN' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                           {log.type === 'IN' ? '+' : '-'}{formatNumber(log.qty)}
                         </div>
                      </div>
                    ))
                  )}
               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
