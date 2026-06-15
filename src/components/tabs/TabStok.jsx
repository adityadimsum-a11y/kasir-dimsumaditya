import React, { useState, useMemo } from 'react';
import { Package, Box, ArrowRightLeft, Search, Archive, ArrowDownRight, ArrowUpRight, History, Database, ShieldAlert } from 'lucide-react';
import { formatDate, safeJsonParse } from '../../utils/helpers';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');
const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabStok({
  orders = [], purchases = [], pemalang = [],
  inventoryCostLayers = [], inventory_cost_layers, user
}) {
  const [activeTab, setActiveTab] = useState('FREEZER');
  const [searchTerm, setSearchTerm] = useState('');
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  const realInventory = useMemo(() => inventory_cost_layers || inventoryCostLayers || [], [inventory_cost_layers, inventoryCostLayers]);

  // ENGINE REKAP STOK GUDANG REAL-TIME (DARI INVENTORY COST LAYERS)
  const stockSummary = useMemo(() => {
    const map = {};
    let totalValuasi = 0;
    let totalItems = 0;

    realInventory.forEach(layer => {
      if (!layer.isDeleted && layer.status === 'ACTIVE' && (layer.branch_id === currentBranch || currentBranch === 'TANGERANG_PUSAT')) {
        const name = String(layer.item_name).toUpperCase();
        if (!map[name]) {
          map[name] = { name, qty: 0, category: layer.category || 'UMUM', total_value: 0 };
          totalItems++;
        }
        const qty = Number(layer.qty_remaining || 0);
        const cost = Number(layer.unit_cost || 0);
        
        map[name].qty += qty;
        map[name].total_value += (qty * cost);
        totalValuasi += (qty * cost);
      }
    });

    const list = Object.values(map).filter(item => item.qty !== 0).sort((a, b) => a.name.localeCompare(b.name));
    return { list, totalValuasi, totalItems: list.length };
  }, [realInventory, currentBranch]);

  const filteredFreezerStock = useMemo(() => {
    const list = stockSummary.list.filter(item => item.category !== 'BAHAN_BAKU' && item.category !== 'PACKAGING' && item.category !== 'KEMASAN');
    if (!searchTerm) return list;
    return list.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [stockSummary.list, searchTerm]);

  const filteredRawStock = useMemo(() => {
    const list = stockSummary.list.filter(item => item.category === 'BAHAN_BAKU' || item.category === 'PACKAGING' || item.category === 'KEMASAN');
    if (!searchTerm) return list;
    return list.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [stockSummary.list, searchTerm]);

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

    (pemalang || []).forEach(p => {
      if (!p.isDeleted) {
         timeline.push({
            id: p.id, date: p.date, type: 'IN', category: 'Produksi Pabrik',
            itemName: p.item_name || 'Dimsum Frozen', qty: p.qty || 0, reference: `Adukan Dapur`
         });
      }
    });

    const safeSearch = (searchTerm || '').toLowerCase();
    return timeline
      .filter(t => (t.itemName || '').toLowerCase().includes(safeSearch) || (t.category || '').toLowerCase().includes(safeSearch))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [orders, purchases, pemalang, searchTerm]);

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-200">
      
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

      {/* SUMMARY WIDGETS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Varian Tersimpan</div>
            <div className="text-2xl font-black text-slate-800">{formatNumber(stockSummary.totalItems)} <span className="text-xs text-slate-400 font-medium">Jenis</span></div>
          </div>
          <div className="p-3 bg-slate-50 text-slate-500 rounded-xl border border-slate-100"><Layers size={20}/></div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between md:col-span-2 border-l-4 border-l-blue-500">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Valuasi Harta Gudang (HPP)</div>
            <div className="text-2xl font-black text-blue-600">{formatRupiah(stockSummary.totalValuasi)}</div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100"><Database size={20}/></div>
        </div>
      </div>

      {/* FILTER TAB BAR */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        <button onClick={() => setActiveTab('FREEZER')} className={`px-5 py-2.5 rounded-lg font-bold text-xs normal-case transition-all flex items-center gap-2 ${activeTab === 'FREEZER' ? 'bg-white shadow-xs text-red-600 border border-slate-200/50' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'}`}><Package size={14}/> Papan Saldo Stok (Aktif)</button>
        <button onClick={() => setActiveTab('BAHAN_BAKU')} className={`px-5 py-2.5 rounded-lg font-bold text-xs normal-case transition-all flex items-center gap-2 ${activeTab === 'BAHAN_BAKU' ? 'bg-white shadow-xs text-red-600 border border-slate-200/50' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'}`}><Box size={14}/> Gudang mentah &amp; packaging</button>
        <button onClick={() => setActiveTab('MUTASI')} className={`px-5 py-2.5 rounded-lg font-bold text-xs normal-case transition-all flex items-center gap-2 ${activeTab === 'MUTASI' ? 'bg-white shadow-xs text-red-600 border border-slate-200/50' : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'}`}><ArrowRightLeft size={14}/> Buku mutasi keluar-masuk</button>
      </div>

      {/* TAB FREEZER / INVENTORY AKTIF */}
      {activeTab === 'FREEZER' && (
        <div className="card-holo flex flex-col overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <Database size={16} className="text-red-600"/>
            <h3 className="text-xs font-extrabold normal-case text-slate-800">Daftar Inventaris Aktif (Produk Jualan)</h3>
          </div>
          <div className="overflow-x-auto p-1 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-white border-b border-slate-200 text-[10px] normal-case text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-bold">Nama Barang / Material</th>
                  <th className="px-5 py-3 font-bold text-center">Kategori</th>
                  <th className="px-5 py-3 font-bold text-center">Sisa Kuantitas</th>
                  <th className="px-5 py-3 font-bold text-right">Nilai Aset Terkunci (HPP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                {filteredFreezerStock.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-10 text-slate-400 normal-case font-medium">Gudang kosong atau barang tidak ditemukan.</td></tr>
                ) : (
                  filteredFreezerStock.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap text-slate-800 font-black">{item.name}</td>
                      <td className="px-5 py-4 text-center">
                        <span className="px-2.5 py-1 rounded-md text-[9px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">{item.category.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`text-sm font-extrabold ${item.qty < 100 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatNumber(item.qty)}</span>
                      </td>
                      <td className="px-5 py-4 text-right text-slate-800 font-black">
                        {formatRupiah(item.total_value)}
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
            <h3 className="text-xs font-extrabold normal-case text-slate-800">Kondisi stok bahan mentah &amp; kemasan</h3>
          </div>
          <div className="overflow-x-auto p-1 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-white border-b border-slate-200 text-[10px] normal-case text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-bold">Item logistik</th>
                  <th className="px-5 py-3 font-bold text-center">Kategori</th>
                  <th className="px-5 py-3 font-bold text-center">Sisa gudang</th>
                  <th className="px-5 py-3 font-bold text-right">Nilai Aset Terkunci (HPP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                {filteredRawStock.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-10 text-slate-400 normal-case font-medium">Data logistik belum tersedia.</td></tr>
                ) : (
                  filteredRawStock.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap font-extrabold text-slate-800 normal-case">{item.name || 'Umum'}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`px-2.5 py-1 text-[9px] font-bold normal-case rounded-md border ${item.category === 'PACKAGING' || item.category === 'KEMASAN' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>{item.category ? item.category.replace(/_/g, ' ') : 'Umum'}</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className={`text-lg font-black ${item.qty <= 5 ? 'text-red-600' : 'text-slate-800'}`}>{formatNumber(item.qty)}</div>
                      </td>
                      <td className="px-5 py-4 text-right text-slate-800 font-black">
                        {formatRupiah(item.total_value)}
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
