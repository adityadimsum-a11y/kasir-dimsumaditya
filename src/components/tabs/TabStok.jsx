import React, { useState, useMemo } from 'react';
import { Package, Box, ArrowRightLeft, Search, Archive, ArrowDownRight, ArrowUpRight, History, Database, ShieldAlert } from 'lucide-react';
import { formatDate, safeJsonParse } from '../../utils/helpers';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabStok({
  masterProducts = [], masterRawMaterials = [],
  orders = [], purchases = [], productionBatches = []
}) {
  const [activeTab, setActiveTab] = useState('FREEZER');
  const [searchTerm, setSearchTerm] = useState('');

  const freezerStock = useMemo(() => {
    const stockMap = {};
    
    (masterProducts || []).forEach(p => {
      if (!p.isDeleted && p.product_name) {
        stockMap[p.product_name] = { 
          id: p.id, name: p.product_name, sku: p.sku || '', category: p.category || '',
          stockIn: 0, stockOut: 0, currentStock: 0 
        };
      }
    });

    (productionBatches || []).forEach(batch => {
      if (!batch.isDeleted && batch.status === 'COMPLETED') {
        const productName = batch.product_name || 'DIMSUM FROZEN CORE'; 
        if (stockMap[productName]) {
          stockMap[productName].stockIn += Number(batch.total_yield_pcs || batch.actual_yield || batch.qty || 0);
        }
      }
    });

    (orders || []).forEach(o => {
      if (!o.isDeleted && o.status !== 'BATAL') {
        const items = safeJsonParse(o.items, []);
        items.forEach(item => {
          const pName = item.name || item.product_name;
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
  }, [masterProducts, productionBatches, orders, searchTerm]);

  const rawStock = useMemo(() => {
    const stockMap = {};

    (masterRawMaterials || []).forEach(r => {
      if (!r.isDeleted && r.raw_name) {
        stockMap[r.raw_name] = {
          id: r.id, name: r.raw_name, unit: r.unit || '', category: r.category || '',
          stockIn: 0, stockOut: 0, currentStock: 0
        };
      }
    });

    (purchases || []).forEach(p => {
      if (!p.isDeleted) {
        const items = safeJsonParse(p.items, []);
        if (items.length > 0) {
          items.forEach(item => {
            const rName = item.name || item.raw_name;
            if (rName && stockMap[rName]) {
              stockMap[rName].stockIn += Number(item.qty || 0);
            }
          });
        } else if (p.raw_name && stockMap[p.raw_name]) {
           stockMap[p.raw_name].stockIn += Number(p.qty || 0);
        }
      }
    });

    (productionBatches || []).forEach(batch => {
      if (!batch.isDeleted && batch.status === 'COMPLETED') {
        if (stockMap['AYAM FILLET PAHA'] && batch.total_ayam_kg) {
            stockMap['AYAM FILLET PAHA'].stockOut += Number(batch.total_ayam_kg);
        }
        const ingredients = safeJsonParse(batch.ingredients_used, []);
        ingredients.forEach(ing => {
          const rName = ing.name || ing.raw_name;
          if (rName && stockMap[rName]) {
            stockMap[rName].stockOut += Number(ing.qty || 0);
          }
        });
      }
    });

    const safeSearch = (searchTerm || '').toLowerCase();
    return Object.values(stockMap).map(item => {
      item.currentStock = item.stockIn - item.stockOut;
      return item;
    }).filter(item => (item.name || '').toLowerCase().includes(safeSearch));
  }, [masterRawMaterials, purchases, productionBatches, searchTerm]);

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
        } else if (p.raw_name) {
          timeline.push({
            id: p.id, date: p.date, type: 'IN', category: 'Belanja Logistik',
            itemName: p.raw_name, qty: p.qty || 1, reference: p.supplier_name || 'Supplier'
          });
        }
      }
    });

    (productionBatches || []).forEach(batch => {
      if (!batch.isDeleted && batch.status === 'COMPLETED') {
        timeline.push({
          id: batch.id, date: batch.date, type: 'IN', category: 'Hasil Produksi Pabrik',
          itemName: batch.product_name || 'Dimsum Frozen Core', 
          qty: batch.total_yield_pcs || batch.actual_yield || batch.qty || 0, 
          reference: `Batch Produksi: ${batch.id}`
        });

        if (batch.total_ayam_kg) {
            timeline.push({
              id: batch.id + '-AYM', date: batch.date, type: 'OUT', category: 'Pemakaian Produksi',
              itemName: 'AYAM FILLET PAHA', qty: batch.total_ayam_kg, reference: `Untuk Batch: ${batch.id}`
            });
        }

        const ingredients = safeJsonParse(batch.ingredients_used, []);
        ingredients.forEach(ing => {
          timeline.push({
            id: batch.id + '-ING', date: batch.date, type: 'OUT', category: 'Pemakaian Produksi',
            itemName: ing.name || ing.raw_name || 'Item Tidak Diketahui', 
            qty: ing.qty || 0, reference: `Untuk Batch: ${batch.id}`
          });
        });
      }
    });

    const safeSearch = (searchTerm || '').toLowerCase();
    return timeline
      .filter(t => (t.itemName || '').toLowerCase().includes(safeSearch) || (t.category || '').toLowerCase().includes(safeSearch))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [orders, purchases, productionBatches, searchTerm]);

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      {/* HEADER GUDANG - FLAT STYLE */}
      <div className="card-holo p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden bg-white border border-slate-200 rounded-2xl">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600"></div>
        <div className="pl-2">
          <h2 className="text-base font-extrabold normal-case flex items-center gap-2 text-slate-900">
            <Archive className="text-red-600" size={20} /> Pusat komando gudang &amp; stok
          </h2>
          <p className="text-[10px] font-semibold text-slate-400 mt-1 normal-case tracking-wide">
            Pantau arus keluar-masuk barang dan bahan baku secara real-time.
          </p>
        </div>
        <div className="relative w-full md:w-64 text-slate-700">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder="Cari nama barang / aktivitas..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 font-bold outline-none bg-slate-50 text-xs focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all shadow-inner" 
          />
        </div>
      </div>

      {/* FILTER TAB BAR - CLEAN ENTERPRISE TABS */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        <button onClick={() => setActiveTab('FREEZER')} className={`px-5 py-2.5 rounded-lg font-bold text-xs normal-case transition-all flex items-center gap-2 ${activeTab === 'FREEZER' ? 'bg-white shadow-xs text-red-600 border border-slate-200/50' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'}`}><Package size={14}/> Gudang freezer (Produk akhir)</button>
        <button onClick={() => setActiveTab('BAHAN_BAKU')} className={`px-5 py-2.5 rounded-lg font-bold text-xs normal-case transition-all flex items-center gap-2 ${activeTab === 'BAHAN_BAKU' ? 'bg-white shadow-xs text-red-600 border border-slate-200/50' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'}`}><Box size={14}/> Gudang mentah &amp; packaging</button>
        <button onClick={() => setActiveTab('MUTASI')} className={`px-5 py-2.5 rounded-lg font-bold text-xs normal-case transition-all flex items-center gap-2 ${activeTab === 'MUTASI' ? 'bg-white shadow-xs text-red-600 border border-slate-200/50' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'}`}><ArrowRightLeft size={14}/> Buku mutasi kartu stok</button>
      </div>

      {/* TAB FREEZER / INVENTORY AKTIF */}
      {activeTab === 'FREEZER' && (
        <div className="card-holo flex flex-col overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <Database size={16} className="text-red-600"/>
            <h3 className="text-xs font-extrabold normal-case text-slate-800">Kondisi stok produk jualan terkini</h3>
          </div>
          <div className="overflow-x-auto p-1 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-white border-b border-slate-200 text-[10px] normal-case text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-bold">SKU / Nama produk</th>
                  <th className="px-5 py-3 font-bold text-center">Total masuk (Produksi)</th>
                  <th className="px-5 py-3 font-bold text-center">Total keluar (Terjual)</th>
                  <th className="px-5 py-3 font-bold text-right">Sisa stok (Saldo)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                {freezerStock.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-10 text-slate-400 normal-case font-medium">Data produk belum tersedia.</td></tr>
                ) : (
                  freezerStock.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-extrabold normal-case">{item.name || 'Umum'}</div>
                        <div className="text-[9px] font-medium text-slate-400 mt-1 normal-case">{item.sku || 'Tanpa SKU'} • {item.category ? item.category.replace(/_/g, ' ') : 'Umum'}</div>
                      </td>
                      <td className="px-5 py-4 text-center font-extrabold text-emerald-600">+{formatNumber(item.stockIn)}</td>
                      <td className="px-5 py-4 text-center font-extrabold text-red-500">-{formatNumber(item.stockOut)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className={`text-lg font-black ${item.currentStock <= 10 ? 'text-red-600' : 'text-slate-800'}`}>{formatNumber(item.currentStock)}</div>
                        {item.currentStock <= 10 && <div className="text-[8px] text-red-500 font-bold normal-case mt-1 animate-pulse">⚠️ Stok Kritis</div>}
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
        <div className="card-holo flex flex-col overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <Box size={16} className="text-red-600"/>
            <h3 className="text-xs font-extrabold normal-case text-slate-800">Kondisi stok bahan baku &amp; kemasan</h3>
          </div>
          <div className="overflow-x-auto p-1 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-white border-b border-slate-200 text-[10px] normal-case text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-bold">Item logistik</th>
                  <th className="px-5 py-3 font-bold text-center">Kategori &amp; satuan</th>
                  <th className="px-5 py-3 font-bold text-center">Total beli masuk</th>
                  <th className="px-5 py-3 font-bold text-center">Pemakaian dapur</th>
                  <th className="px-5 py-3 font-bold text-right">Sisa gudang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                {rawStock.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-10 text-slate-400 normal-case font-medium">Data logistik belum tersedia.</td></tr>
                ) : (
                  rawStock.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap font-extrabold text-slate-800 normal-case">{item.name || 'Umum'}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`px-2.5 py-1 text-[9px] font-bold normal-case rounded-md border ${item.category === 'PACKAGING' || item.category === 'KEMASAN' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>{item.category ? item.category.replace(/_/g, ' ') : 'Umum'}</span>
                        <div className="text-[9px] text-slate-400 mt-2 font-medium normal-case">Satuan: {item.unit || 'Pcs'}</div>
                      </td>
                      <td className="px-5 py-4 text-center font-extrabold text-emerald-600">+{formatNumber(item.stockIn)}</td>
                      <td className="px-5 py-4 text-center font-extrabold text-red-500">-{formatNumber(item.stockOut)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className={`text-lg font-black ${item.currentStock <= 5 ? 'text-red-600' : 'text-slate-800'}`}>{formatNumber(item.currentStock)} <span className="text-[10px] text-slate-400 font-semibold ml-0.5 normal-case">{item.unit || ''}</span></div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB BUKU MUTASI */}
      {activeTab === 'MUTASI' && (
        <div className="card-holo flex flex-col overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <History size={16} className="text-red-600"/>
            <h3 className="text-xs font-extrabold normal-case text-slate-800">Catatan buku mutasi keluar-masuk gudang</h3>
          </div>
          <div className="overflow-x-auto p-1 custom-scrollbar min-h-[50vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-white border-b border-slate-200 text-[10px] normal-case text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-bold">Tanggal &amp; Waktu</th>
                  <th className="px-5 py-3 font-bold">Aktivitas sistem</th>
                  <th className="px-5 py-3 font-bold">Nama barang / Item</th>
                  <th className="px-5 py-3 font-bold text-center">Status</th>
                  <th className="px-5 py-3 font-bold text-right">Mutasi volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                {kartuMutasi.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-20 text-slate-400 normal-case font-medium">
                      <div className="flex justify-center mb-3 opacity-20"><ShieldAlert size={36}/></div>
                      Belum ada aktivitas mutasi barang yang tercatat.
                    </td>
                  </tr>
                ) : (
                  kartuMutasi.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-bold">{formatDate(log.date)}</div>
                        <div className="text-[9px] font-medium text-slate-400 mt-1">Ref: {log.id}</div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-700 normal-case">{log.category}</div>
                        <div className="text-[9px] text-slate-500 mt-1 normal-case truncate max-w-[200px]">Oleh: {log.reference}</div>
                      </td>
                      <td className="px-5 py-4 font-extrabold text-slate-800 normal-case">{log.itemName || 'Item tidak diketahui'}</td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        {log.type === 'IN' ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-md text-[9px] font-bold normal-case flex items-center justify-center gap-1 w-max mx-auto shadow-xs"><ArrowDownRight size={12}/> Barang masuk</span>
                        ) : (
                          <span className="bg-red-50 text-red-700 border border-red-100 px-2.5 py-1 rounded-md text-[9px] font-bold normal-case flex items-center justify-center gap-1 w-max mx-auto shadow-xs"><ArrowUpRight size={12}/> Barang keluar</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className={`text-lg font-black ${log.type === 'IN' ? 'text-emerald-600' : 'text-red-600'}`}>
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
