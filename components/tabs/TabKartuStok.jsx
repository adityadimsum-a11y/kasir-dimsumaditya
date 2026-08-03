import React, { useState, useMemo } from 'react';
import { Package, Box, ArrowRightLeft, Search, Archive, ArrowDownRight, ArrowUpRight, History, Database, ShieldAlert } from 'lucide-react';
import { formatDate, safeJsonParse } from '../../utils/helpers';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabKartuStok({
  masterProducts = [], masterRawMaterials = [],
  orders = [], purchases = [], productionBatches = [],
  inventoryCostLayers = [] // 🔥 BACA JURNAL INVENTORI BARU
}) {
  const [activeTab, setActiveTab] = useState('FREEZER');
  const [searchTerm, setSearchTerm] = useState('');

  const hasInventoryLayer = useMemo(() => {
    return new Set((inventoryCostLayers || []).filter(l => !l.isDeleted).map(l => l.reference_id));
  }, [inventoryCostLayers]);

  // --- ENGINE FREEZER STOCK ---
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

    // 1. SMART BRIDGE V2 (Murni baca buku stok, anti ganda)
    (inventoryCostLayers || []).forEach(l => {
      if (l.isDeleted || l.category !== 'PRODUK_JADI') return;
      const key = String(l.item_name).toUpperCase();
      if (!stockMap[key]) stockMap[key] = { id: l.id, name: key, sku: '', category: 'PRODUK_JADI', stockIn: 0, stockOut: 0, currentStock: 0 };
      
      const qty = Number(l.qty_remaining || 0);
      if (qty > 0) stockMap[key].stockIn += qty;
      else stockMap[key].stockOut += Math.abs(qty);
    });

    // 2. LEGACY SYSTEM (Baca produksi lama yang belum masuk buku stok)
    (productionBatches || []).forEach(batch => {
      if (!batch.isDeleted && batch.status === 'COMPLETED' && !hasInventoryLayer.has(batch.id)) {
        const productName = String(batch.product_name || 'DIMSUM FROZEN CORE').toUpperCase(); 
        if (stockMap[productName]) {
          stockMap[productName].stockIn += Number(batch.total_yield_pcs || batch.actual_yield || batch.qty || 0);
        }
      }
    });

    (orders || []).forEach(o => {
      if (!o.isDeleted && o.status !== 'BATAL' && !hasInventoryLayer.has(o.id)) {
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
  }, [masterProducts, productionBatches, orders, inventoryCostLayers, hasInventoryLayer, searchTerm]);

  // --- ENGINE RAW STOCK (ANTI DOUBLE DEDUCTION) ---
  const rawStock = useMemo(() => {
    const stockMap = {};

    (masterRawMaterials || []).forEach(r => {
      if (!r.isDeleted && r.raw_name) {
        const key = String(r.raw_name).toUpperCase();
        stockMap[key] = {
          id: r.id, name: r.raw_name, unit: r.unit || '', category: r.category || '',
          stockIn: 0, stockOut: 0, currentStock: 0
        };
      }
    });

    // 1. SMART BRIDGE V2 (Buku Stok Pusat)
    (inventoryCostLayers || []).forEach(l => {
      if (l.isDeleted || l.category === 'PRODUK_JADI') return; 
      const key = String(l.item_name).toUpperCase();
      if (!stockMap[key]) stockMap[key] = { id: l.id, name: key, unit: 'Unit', category: l.category, stockIn: 0, stockOut: 0, currentStock: 0 };
      
      const qty = Number(l.qty_remaining || 0);
      if (qty > 0) stockMap[key].stockIn += qty;
      else stockMap[key].stockOut += Math.abs(qty);
    });

    // 2. LEGACY
    (purchases || []).forEach(p => {
      if (!p.isDeleted && !hasInventoryLayer.has(p.id)) {
        const items = safeJsonParse(p.items, []);
        if (items.length > 0) {
          items.forEach(item => {
            const rName = String(item.name || item.raw_name).toUpperCase();
            if (rName && stockMap[rName]) stockMap[rName].stockIn += Number(item.qty || 0);
          });
        } else if (p.raw_name) {
           const rName = String(p.raw_name).toUpperCase();
           if (stockMap[rName]) stockMap[rName].stockIn += Number(p.qty || 0);
        }
      }
    });

    (productionBatches || []).forEach(batch => {
      if (!batch.isDeleted && batch.status === 'COMPLETED' && !hasInventoryLayer.has(batch.id)) {
        const ingredients = safeJsonParse(batch.ingredients_used, []);
        // SAFE FALLBACK JSON
        if (ingredients.length > 0) {
           ingredients.forEach(ing => {
             const rName = String(ing.name || ing.raw_name).toUpperCase();
             if (rName && stockMap[rName]) stockMap[rName].stockOut += Number(ing.qty || 0);
           });
        }
      }
    });

    const safeSearch = (searchTerm || '').toLowerCase();
    return Object.values(stockMap).map(item => {
      item.currentStock = item.stockIn - item.stockOut;
      return item;
    }).filter(item => (item.name || '').toLowerCase().includes(safeSearch));
  }, [masterRawMaterials, purchases, productionBatches, inventoryCostLayers, hasInventoryLayer, searchTerm]);

  // --- ENGINE KARTU MUTASI TIMELINE ---
  const kartuMutasi = useMemo(() => {
    const timeline = [];

    // V2
    (inventoryCostLayers || []).forEach(l => {
      if (!l.isDeleted) {
        const isMasuk = Number(l.qty_remaining) > 0;
        timeline.push({
          id: l.reference_id || l.id, date: l.date || l.received_date, type: isMasuk ? 'IN' : 'OUT',
          category: l.category.replace(/_/g, ' '), itemName: l.item_name, qty: Math.abs(Number(l.qty_remaining)),
          reference: l.notes || l.status
        });
      }
    });

    // LEGACY
    (orders || []).forEach(o => {
      if (!o.isDeleted && o.status !== 'BATAL' && !hasInventoryLayer.has(o.id)) {
        const items = safeJsonParse(o.items, []);
        items.forEach(item => {
          timeline.push({
            id: o.id, date: o.date, type: 'OUT', category: 'Penjualan Kasir (Lama)',
            itemName: item.name || item.product_name || 'Item Tidak Diketahui', qty: item.qty || 0, reference: o.customer_name || 'Pelanggan Umum'
          });
        });
      }
    });

    (purchases || []).forEach(p => {
      if (!p.isDeleted && !hasInventoryLayer.has(p.id)) {
        const items = safeJsonParse(p.items, []);
        if(items.length > 0) {
          items.forEach(item => {
            timeline.push({
              id: p.id, date: p.date, type: 'IN', category: 'Belanja Logistik (Lama)', itemName: item.name || item.raw_name || 'Item Tidak Diketahui', qty: item.qty || 0, reference: p.supplier_name || 'Supplier'
            });
          });
        } else if (p.raw_name) {
          timeline.push({
            id: p.id, date: p.date, type: 'IN', category: 'Belanja Logistik (Lama)', itemName: p.raw_name, qty: p.qty || 1, reference: p.supplier_name || 'Supplier'
          });
        }
      }
    });

    (productionBatches || []).forEach(batch => {
      if (!batch.isDeleted && batch.status === 'COMPLETED' && !hasInventoryLayer.has(batch.id)) {
        timeline.push({
          id: batch.id, date: batch.date, type: 'IN', category: 'Hasil Produksi (Lama)', itemName: batch.product_name || 'Dimsum Frozen Core', qty: batch.total_yield_pcs || batch.actual_yield || batch.qty || 0, reference: `Batch Produksi: ${batch.id}`
        });
        const ingredients = safeJsonParse(batch.ingredients_used, []);
        ingredients.forEach(ing => {
          timeline.push({
            id: batch.id + '-ING', date: batch.date, type: 'OUT', category: 'Pemakaian Produksi', itemName: ing.name || ing.raw_name || 'Item Tidak Diketahui', qty: ing.qty || 0, reference: `Untuk Batch: ${batch.id}`
          });
        });
      }
    });

    const safeSearch = (searchTerm || '').toLowerCase();
    return timeline
      .filter(t => (t.itemName || '').toLowerCase().includes(safeSearch) || (t.category || '').toLowerCase().includes(safeSearch))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [orders, purchases, productionBatches, inventoryCostLayers, hasInventoryLayer, searchTerm]);

  return (
    <div className="space-y-6 pb-10 text-slate-700 animate-in fade-in duration-300">
      
      {/* 🚀 HEADER GUDANG - FLUID GRADIENT STYLE */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 lg:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 rounded-3xl shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 p-4 opacity-5"><Archive size={120} className="text-red-500"/></div>
        <div className="relative z-10">
           <div className="flex items-center gap-2 mb-2">
             <Archive size={24} className="text-red-500"/>
             <h2 className="text-xl font-black text-white tracking-wide">Kartu Stok &amp; Riwayat</h2>
           </div>
           <p className="text-[11px] font-bold text-slate-400 mt-1 max-w-lg leading-relaxed">
             Memantau alur stok lintas modul dengan sistem <b className="text-slate-200">Smart Bridge</b> anti-ganda.
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
        <button onClick={() => setActiveTab('FREEZER')} className={`px-6 py-3 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${activeTab === 'FREEZER' ? 'bg-white shadow-sm text-red-600 border border-slate-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-transparent'}`}><Package size={16}/> Gudang Freezer (Matang)</button>
        <button onClick={() => setActiveTab('BAHAN_BAKU')} className={`px-6 py-3 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${activeTab === 'BAHAN_BAKU' ? 'bg-white shadow-sm text-red-600 border border-slate-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-transparent'}`}><Box size={16}/> Gudang Logistik (Mentah)</button>
        <button onClick={() => setActiveTab('MUTASI')} className={`px-6 py-3 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${activeTab === 'MUTASI' ? 'bg-white shadow-sm text-red-600 border border-slate-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-transparent'}`}><ArrowRightLeft size={16}/> Buku Kartu Mutasi Stok</button>
      </div>

      {/* TAB FREEZER */}
      {activeTab === 'FREEZER' && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden border-t-4 border-t-red-600">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Database size={18} className="text-red-600"/>
            <h3 className="text-sm font-black text-slate-800">Kondisi Stok Produk Jualan Terkini</h3>
          </div>
          <div className="overflow-x-auto p-2 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                <tr><th className="px-5 py-4 font-black">SKU / Nama Produk</th><th className="px-5 py-4 font-black text-center">Masuk (Produksi)</th><th className="px-5 py-4 font-black text-center">Keluar (Jual)</th><th className="px-5 py-4 font-black text-right">Saldo Stok</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                {freezerStock.length === 0 ? (<tr><td colSpan="4" className="text-center py-16 text-slate-400 font-medium">Data produk belum tersedia.</td></tr>) : (
                  freezerStock.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap"><div className="text-slate-800 font-black text-sm uppercase tracking-wide">{item.name || 'Umum'}</div></td>
                      <td className="px-5 py-4 text-center font-black text-emerald-600 text-sm">+{formatNumber(item.stockIn)}</td>
                      <td className="px-5 py-4 text-center font-black text-red-500 text-sm">-{formatNumber(item.stockOut)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className={`text-xl font-black tracking-tight ${item.currentStock <= 10 ? 'text-red-600' : 'text-slate-800'}`}>{formatNumber(item.currentStock)}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB BAHAN BAKU */}
      {activeTab === 'BAHAN_BAKU' && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden border-t-4 border-t-amber-500">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Database size={18} className="text-amber-600"/>
            <h3 className="text-sm font-black text-slate-800">Kondisi Stok Bahan Baku &amp; Kemasan</h3>
          </div>
          <div className="overflow-x-auto p-2 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                <tr><th className="px-5 py-4 font-black">Item Logistik</th><th className="px-5 py-4 font-black text-center">Masuk</th><th className="px-5 py-4 font-black text-center">Keluar (Dapur)</th><th className="px-5 py-4 font-black text-right">Saldo Gudang</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                {rawStock.length === 0 ? (<tr><td colSpan="4" className="text-center py-16 text-slate-400 font-medium">Data logistik belum tersedia.</td></tr>) : (
                  rawStock.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap font-black text-slate-800 text-sm uppercase tracking-wide">{item.name || 'Umum'} <span className="text-[9px] text-slate-400 font-bold ml-1">({item.unit})</span></td>
                      <td className="px-5 py-4 text-center font-black text-emerald-600 text-sm">+{formatNumber(item.stockIn)}</td>
                      <td className="px-5 py-4 text-center font-black text-red-500 text-sm">-{formatNumber(item.stockOut)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className={`text-xl font-black tracking-tight ${item.currentStock <= 5 ? 'text-red-600' : 'text-slate-800'}`}>{formatNumber(item.currentStock)}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB MUTASI */}
      {activeTab === 'MUTASI' && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden border-t-4 border-t-blue-600">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <History size={18} className="text-blue-600"/>
            <h3 className="text-sm font-black text-slate-800">Catatan Buku Mutasi Keluar-Masuk Gudang</h3>
          </div>
          <div className="overflow-x-auto p-2 custom-scrollbar min-h-[50vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                <tr><th className="px-5 py-4 font-black">Waktu &amp; Ref</th><th className="px-5 py-4 font-black">Aktivitas</th><th className="px-5 py-4 font-black">Nama Item</th><th className="px-5 py-4 font-black text-right">Mutasi Volume</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                {kartuMutasi.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-24 text-slate-400 font-medium">Belum ada aktivitas mutasi.</td></tr>
                ) : (
                  kartuMutasi.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap"><div className="text-slate-800 font-black">{formatDate(log.date)}</div><div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{log.id}</div></td>
                      <td className="px-5 py-4 whitespace-nowrap"><div className="font-black text-slate-700 uppercase tracking-wide">{log.category}</div><div className="text-[10px] text-slate-500 mt-1 uppercase truncate max-w-[200px] tracking-wider">{log.reference}</div></td>
                      <td className="px-5 py-4 font-black text-slate-800 uppercase tracking-wide">{log.itemName || 'Item Tidak Diketahui'}</td>
                      <td className="px-5 py-4 text-right">
                        <div className={`text-lg tracking-tight font-black ${log.type === 'IN' ? 'text-emerald-600' : 'text-red-600'}`}>{log.type === 'IN' ? '+' : '-'}{formatNumber(log.qty)}</div>
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
