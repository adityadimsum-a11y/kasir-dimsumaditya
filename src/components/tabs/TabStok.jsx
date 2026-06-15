import React, { useState, useMemo } from 'react';
import { Package, Search, Database, Layers, ArrowDownUp } from 'lucide-react';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabStok({ 
  inventoryCostLayers = [], inventory_cost_layers, 
  user 
}) {
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const [searchTerm, setSearchTerm] = useState('');

  const realInventory = useMemo(() => inventory_cost_layers || inventoryCostLayers || [], [inventory_cost_layers, inventoryCostLayers]);

  // ENGINE REKAP STOK GUDANG REAL-TIME
  const stockSummary = useMemo(() => {
    const map = {};
    let totalValuasi = 0;
    let totalItems = 0;

    realInventory.forEach(layer => {
      if (!layer.isDeleted && layer.status === 'ACTIVE' && (layer.branch_id === currentBranch || currentBranch === 'TANGERANG_PUSAT')) {
        const name = String(layer.item_name).toUpperCase();
        if (!map[name]) {
          map[name] = { 
            name, 
            qty: 0, 
            category: layer.category || 'UMUM', 
            total_value: 0 
          };
          totalItems++;
        }
        
        const qty = Number(layer.qty_remaining || 0);
        const cost = Number(layer.unit_cost || 0);
        
        map[name].qty += qty;
        map[name].total_value += (qty * cost);
        totalValuasi += (qty * cost);
      }
    });

    const list = Object.values(map).filter(item => item.qty !== 0);

    // Sort by name
    list.sort((a, b) => a.name.localeCompare(b.name));

    return { list, totalValuasi, totalItems: list.length };
  }, [realInventory, currentBranch]);

  const filteredStock = useMemo(() => {
    if (!searchTerm) return stockSummary.list;
    return stockSummary.list.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [stockSummary.list, searchTerm]);

  return (
    <div className="flex flex-col gap-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-200">
      
      {/* HEADER MENU */}
      <div className="card-holo p-4 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-2xs gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100"><Package size={24}/></div>
          <div>
            <h2 className="text-base font-black text-slate-800 normal-case">Manajemen Kartu Stok &amp; Gudang</h2>
            <p className="text-[10px] font-bold text-slate-400 normal-case mt-0.5">Pemantauan ketersediaan barang jadi dan bahan mentah secara real-time.</p>
          </div>
        </div>
        <div className="relative w-full sm:w-64 shrink-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input 
            type="text" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-400 transition-colors shadow-3xs normal-case" 
            placeholder="Cari nama barang..." 
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

      {/* TABEL INVENTARIS */}
      <div className="card-holo bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2 shrink-0">
          <ArrowDownUp size={16} className="text-slate-500"/>
          <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider">Daftar Inventaris Aktif</h3>
        </div>
        <div className="overflow-x-auto p-1 custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/50 text-[10px] normal-case text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-5 py-4 font-black">Nama Barang / Material</th>
                <th className="px-5 py-4 font-black text-center">Kategori</th>
                <th className="px-5 py-4 font-black text-center">Sisa Kuantitas</th>
                <th className="px-5 py-4 font-black text-right">Nilai Aset Terkunci (HPP)</th>
              </tr>
            </thead>
            <tbody className="text-xs font-bold divide-y divide-slate-100 bg-white text-slate-600">
              {filteredStock.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-12 text-slate-400 font-medium text-xs normal-case">Gudang kosong atau barang tidak ditemukan.</td></tr>
              ) : (
                filteredStock.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap text-slate-800 font-black">{item.name}</td>
                    <td className="px-5 py-3 text-center whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-md text-[9px] font-black uppercase bg-slate-100 text-slate-500 border border-slate-200">{item.category.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-5 py-3 text-center whitespace-nowrap">
                      <span className={`text-sm font-extrabold ${item.qty < 100 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatNumber(item.qty)}</span>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap text-slate-800 font-black">
                      {formatRupiah(item.total_value)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
