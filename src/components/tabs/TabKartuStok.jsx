import React, { useState, useMemo } from 'react';
import { Package, Box, Layers, ArrowRightLeft, Search, Archive, ArrowDownRight, ArrowUpRight, History, Database, ShieldAlert } from 'lucide-react';
// 🔥 PERBAIKAN: Menambahkan ShieldAlert ke lucide-react dan formatNumber lokal diganti toLocaleString
import { formatDate } from '../../utils/helpers';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabKartuStok({ 
  masterProducts = [], masterRawMaterials = [], 
  orders = [], purchases = [], productionBatches = [],
  user 
}) {
  const currentBranch = user?.branch_id || 'PUSAT';
  const isHQ = user?.branch_type === 'HQ_FACTORY' || currentBranch === 'PUSAT';

  // --- STATE NAVIGASI & FILTER ---
  const [activeTab, setActiveTab] = useState('FREEZER'); // 'FREEZER', 'BAHAN_BAKU', 'MUTASI'
  const [searchTerm, setSearchTerm] = useState('');

  // --- ENGINE 1: KALKULASI STOK FREEZER (PRODUK AKHIR) ---
  const freezerStock = useMemo(() => {
    const stockMap = {};
    
    // Inisialisasi dari Master Data
    (masterProducts || []).forEach(p => {
      if (!p.isDeleted) {
        stockMap[p.product_name] = { 
          id: p.id, name: p.product_name, sku: p.sku, category: p.category,
          stockIn: 0, stockOut: 0, currentStock: 0 
        };
      }
    });

    // BARANG MASUK: Dari Hasil Produksi (Yield)
    (productionBatches || []).forEach(batch => {
      if (!batch.isDeleted && batch.status === 'COMPLETED') {
        const productName = batch.product_name || 'DIMSUM FROZEN CORE'; // Asumsi default
        if (stockMap[productName]) {
          stockMap[productName].stockIn += Number(batch.total_yield_pcs || batch.actual_yield || batch.qty || 0);
        }
      }
    });

    // BARANG KELUAR: Dari Penjualan Kasir (Orders)
    (orders || []).forEach(o => {
      if (!o.isDeleted && o.status !== 'BATAL') {
        try {
          const items = JSON.parse(o.items || '[]');
          items.forEach(item => {
            const pName = item.name || item.product_name;
            if (stockMap[pName]) {
              stockMap[pName].stockOut += Number(item.qty || 0);
            }
          });
        } catch (e) { /* Abaikan jika JSON rusak */ }
      }
    });

    // Hitung Saldo Akhir
    return Object.values(stockMap).map(item => {
      item.currentStock = item.stockIn - item.stockOut;
      return item;
    }).filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [masterProducts, productionBatches, orders, searchTerm]);

  // --- ENGINE 2: KALKULASI STOK BAHAN BAKU & PACKAGING ---
  const rawStock = useMemo(() => {
    const stockMap = {};

    (masterRawMaterials || []).forEach(r => {
      if (!r.isDeleted) {
        stockMap[r.raw_name] = {
          id: r.id, name: r.raw_name, unit: r.unit, category: r.category,
          stockIn: 0, stockOut: 0, currentStock: 0
        };
      }
    });

    // BARANG MASUK: Dari Belanja Logistik / Supplier
    (purchases || []).forEach(p => {
      if (!p.isDeleted) {
        try {
          const items = JSON.parse(p.items || '[]');
          items.forEach(item => {
            const rName = item.name || item.raw_name;
            if (stockMap[rName]) {
              stockMap[rName].stockIn += Number(item.qty || 0);
            }
          });
        } catch (e) {
          // Fallback jika tidak pakai array items tapi langsung nembak nama di nota
          if (p.raw_name && stockMap[p.raw_name]) {
             stockMap[p.raw_name].stockIn += Number(p.qty || 0);
          }
        }
      }
    });

    // BARANG KELUAR: Dari Pemakaian Produksi
    (productionBatches || []).forEach(batch => {
      if (!batch.isDeleted && batch.status === 'COMPLETED') {
        // Asumsi standar pemakaian ayam (hardcode jika belum ada json ingredients)
        if (stockMap['AYAM FILLET PAHA'] && batch.total_ayam_kg) {
            stockMap['AYAM FILLET PAHA'].stockOut += Number(batch.total_ayam_kg);
        }

        try {
          const ingredients = JSON.parse(batch.ingredients_used || '[]');
          ingredients.forEach(ing => {
            const rName = ing.name || ing.raw_name;
            if (stockMap[rName]) {
              stockMap[rName].stockOut += Number(ing.qty || 0);
            }
          });
        } catch (e) { /* Abaikan */ }
      }
    });

    return Object.values(stockMap).map(item => {
      item.currentStock = item.stockIn - item.stockOut;
      return item;
    }).filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [masterRawMaterials, purchases, productionBatches, searchTerm]);

  // --- ENGINE 3: BUKU MUTASI (TIMELINE KARTU STOK) ---
  const kartuMutasi = useMemo(() => {
    const timeline = [];

    // 1. Catat Semua Penjualan (Keluar)
    (orders || []).forEach(o => {
      if (!o.isDeleted && o.status !== 'BATAL') {
        try {
          const items = JSON.parse(o.items || '[]');
          items.forEach(item => {
            timeline.push({
              id: o.id, date: o.date, type: 'OUT', category: 'PENJUALAN KASIR',
              itemName: item.name || item.product_name, qty: item.qty, reference: o.customer_name || 'Pelanggan Umum'
            });
          });
        } catch (e) {}
      }
    });

    // 2. Catat Semua Belanja (Masuk)
    (purchases || []).forEach(p => {
      if (!p.isDeleted) {
        try {
          const items = JSON.parse(p.items || '[]');
          if(items.length > 0) {
            items.forEach(item => {
              timeline.push({
                id: p.id, date: p.date, type: 'IN', category: 'BELANJA LOGISTIK',
                itemName: item.name || item.raw_name, qty: item.qty, reference: p.supplier_name || 'Supplier'
              });
            });
          } else if (p.raw_name) {
            timeline.push({
              id: p.id, date: p.date, type: 'IN', category: 'BELANJA LOGISTIK',
              itemName: p.raw_name, qty: p.qty || 1, reference: p.supplier_name || 'Supplier'
            });
          }
        } catch (e) {}
      }
    });

    // 3. Catat Produksi (Ayam/Bahan Keluar, Dimsum Masuk)
    (productionBatches || []).forEach(batch => {
      if (!batch.isDeleted && batch.status === 'COMPLETED') {
        // Dimsum Jadi (Masuk ke Freezer)
        timeline.push({
          id: batch.id, date: batch.date, type: 'IN', category: 'HASIL PRODUKSI PABRIK',
          itemName: batch.product_name || 'DIMSUM FROZEN CORE', qty: batch.total_yield_pcs || batch.actual_yield || batch.qty, reference: `Batch Porsi: ${batch.id}`
        });

        // Ayam Keluar
        if (batch.total_ayam_kg) {
            timeline.push({
              id: batch.id + '-AYM', date: batch.date, type: 'OUT', category: 'PEMAKAIAN PRODUKSI',
              itemName: 'AYAM FILLET PAHA', qty: batch.total_ayam_kg, reference: `Untuk Batch: ${batch.id}`
            });
        }

        // Bahan Dipakai Lainnya (Keluar dari Gudang)
        try {
          const ingredients = JSON.parse(batch.ingredients_used || '[]');
          ingredients.forEach(ing => {
            timeline.push({
              id: batch.id + '-ING', date: batch.date, type: 'OUT', category: 'PEMAKAIAN PRODUKSI',
              itemName: ing.name || ing.raw_name, qty: ing.qty, reference: `Untuk Batch: ${batch.id}`
            });
          });
        } catch (e) {}
      }
    });

    // Urutkan dari yang terbaru ke terlama
    return timeline
      .filter(t => t.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) || t.category?.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [orders, purchases, productionBatches, searchTerm]);

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* HEADER BANNER */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-md text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
            <Archive className="text-emerald-400" /> Pusat Komando Gudang &amp; Stok
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
            Pantau arus keluar-masuk barang dan bahan baku secara real-time.
          </p>
        </div>
        <div className="relative w-full md:w-64 text-slate-800">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input type="text" placeholder="Cari nama barang / aktivitas..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2.5 rounded-xl border-none font-bold outline-none bg-white shadow-inner text-xs focus:ring-2 focus:ring-emerald-500" />
        </div>
      </div>

      {/* NAVIGASI SUB TABS */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        <button onClick={() => setActiveTab('FREEZER')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase transition-colors flex items-center gap-2 ${activeTab === 'FREEZER' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Package size={14}/> Gudang Freezer (Produk Akhir)</button>
        <button onClick={() => setActiveTab('BAHAN_BAKU')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase transition-colors flex items-center gap-2 ${activeTab === 'BAHAN_BAKU' ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><Box size={14}/> Gudang Mentah &amp; Packaging</button>
        <button onClick={() => setActiveTab('MUTASI')} className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase transition-colors flex items-center gap-2 ${activeTab === 'MUTASI' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}><ArrowRightLeft size={14}/> Buku Mutasi Kartu Stok</button>
      </div>

      {/* TAB 1: GUDANG FREEZER */}
      {activeTab === 'FREEZER' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Database size={16} className="text-blue-500"/>
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-widest">Kondisi Stok Produk Jualan Terkini</h3>
          </div>
          <div className="overflow-x-auto p-2 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-[10px] uppercase text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-4 font-black">SKU / Nama Produk</th>
                  <th className="px-5 py-4 font-black text-center text-emerald-600">Total Masuk (Produksi)</th>
                  <th className="px-5 py-4 font-black text-center text-rose-600">Total Keluar (Terjual)</th>
                  <th className="px-5 py-4 font-black text-right text-blue-600">SISA STOK (SALDO)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs font-bold">
                {freezerStock.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-10 text-slate-400 uppercase">Data produk belum tersedia.</td></tr>
                ) : (
                  freezerStock.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-black uppercase">{item.name}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-1">{item.sku || 'NO-SKU'} | {item.category.replace('_', ' ')}</div>
                      </td>
                      <td className="px-5 py-4 text-center font-black text-emerald-600 bg-emerald-50/30">+{formatNumber(item.stockIn)}</td>
                      <td className="px-5 py-4 text-center font-black text-rose-600 bg-rose-50/30">-{formatNumber(item.stockOut)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className={`text-lg font-black ${item.currentStock <= 10 ? 'text-rose-600' : 'text-blue-700'}`}>{formatNumber(item.currentStock)}</div>
                        {item.currentStock <= 10 && <div className="text-[8px] text-rose-500 uppercase tracking-widest mt-1 animate-pulse">⚠️ Stok Kritis</div>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GUDANG BAHAN BAKU & PACKAGING */}
      {activeTab === 'BAHAN_BAKU' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Database size={16} className="text-orange-500"/>
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-widest">Kondisi Stok Bahan Baku &amp; Kemasan</h3>
          </div>
          <div className="overflow-x-auto p-2 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-[10px] uppercase text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-4 font-black">Item Logistik</th>
                  <th className="px-5 py-4 font-black text-center">Kategori &amp; Satuan</th>
                  <th className="px-5 py-4 font-black text-center text-emerald-600">Total Beli Masuk</th>
                  <th className="px-5 py-4 font-black text-center text-rose-600">Pemakaian Dapur</th>
                  <th className="px-5 py-4 font-black text-right text-orange-600">SISA GUDANG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs font-bold">
                {rawStock.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-10 text-slate-400 uppercase">Data logistik belum tersedia.</td></tr>
                ) : (
                  rawStock.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap font-black text-slate-800 uppercase">{item.name}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded border ${item.category === 'PACKAGING' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>{item.category.replace('_', ' ')}</span>
                        <div className="text-[10px] text-slate-500 mt-2 uppercase tracking-widest">Sistem: {item.unit}</div>
                      </td>
                      <td className="px-5 py-4 text-center font-black text-emerald-600 bg-emerald-50/30">+{formatNumber(item.stockIn)}</td>
                      <td className="px-5 py-4 text-center font-black text-rose-600 bg-rose-50/30">-{formatNumber(item.stockOut)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className={`text-lg font-black ${item.currentStock <= 5 ? 'text-rose-600' : 'text-orange-700'}`}>{formatNumber(item.currentStock)} <span className="text-[10px] text-slate-400 ml-1">{item.unit}</span></div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BUKU MUTASI (KARTU STOK RIIL) */}
      {activeTab === 'MUTASI' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <History size={16} className="text-slate-500"/>
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-widest">Catatan Buku Mutasi Keluar-Masuk Gudang</h3>
          </div>
          <div className="overflow-x-auto p-2 custom-scrollbar min-h-[50vh]">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-[10px] uppercase text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-4 font-black">Tanggal &amp; Waktu</th>
                  <th className="px-5 py-4 font-black">Aktivitas Sistem</th>
                  <th className="px-5 py-4 font-black">Nama Barang / Item</th>
                  <th className="px-5 py-4 font-black text-center">Status</th>
                  <th className="px-5 py-4 font-black text-right">Mutasi Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs font-bold">
                {kartuMutasi.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-24 text-slate-400 uppercase tracking-widest">
                    <div className="flex justify-center mb-3 opacity-30"><ShieldAlert size={40}/></div>
                    Belum ada aktivitas mutasi barang yang tercatat.
                  </td></tr>
                ) : (
                  kartuMutasi.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-black">{formatDate(log.date)}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-1">REF ID: {log.id}</div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-black text-slate-700 uppercase">{log.category}</div>
                        <div className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest truncate max-w-[200px]">OLEH: {log.reference}</div>
                      </td>
                      <td className="px-5 py-4 font-black text-blue-700 uppercase">{log.itemName || 'ITEM TIDAK DIKETAHUI'}</td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        {log.type === 'IN' ? (
                          <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1 rounded text-[9px] font-black uppercase flex items-center justify-center gap-1 w-max mx-auto"><ArrowDownRight size={12}/> Barang Masuk</span>
                        ) : (
                          <span className="bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1 rounded text-[9px] font-black uppercase flex items-center justify-center gap-1 w-max mx-auto"><ArrowUpRight size={12}/> Barang Keluar</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className={`text-lg font-black ${log.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
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

    </div>
  );
}
