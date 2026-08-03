import React, { useState, useMemo } from 'react';
import { 
  Package, Truck, CheckSquare, Database, Filter, 
  ArrowDownToLine, ArrowUpRight, CheckCircle2, X, 
  AlertTriangle, ClipboardEdit, Undo2, History
} from 'lucide-react';
import { formatDate, getTodayStr, generateId, safeJsonParse } from '../../utils/helpers';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabStokOutlet({ 
  distribution_orders = [], distribution_orders_data,
  orders = [], orders_data,
  masterBranches = [], master_branches, 
  masterProducts = [], master_products,
  sendToSheet, showToast, user 
}) {
  const todayStr = getTodayStr();
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || !user?.branch_id;
  
  // Jika login sebagai HQ, default pantau Cibinong. Jika login sebagai admin cabang, otomatis terkunci di cabangnya sendiri.
  const [activeBranch, setActiveBranch] = useState(isHQ ? 'CIBINONG' : user?.branch_id);

  // --- STATE PENGURANGAN OPERASIONAL MANDIRI ---
  const [showOpnameForm, setShowOpnameForm] = useState(false);
  const [opnameForm, setFormOpname] = useState({ item_id: '', qty: '', notes: '' });

  // --- SINKRONISASI DATABASE ---
  const realDistOrders = useMemo(() => distribution_orders_data || distribution_orders || [], [distribution_orders, distribution_orders_data]);
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const rawBranches = useMemo(() => master_branches || masterBranches || [], [master_branches, masterBranches]);
  const realProducts = useMemo(() => master_products || masterProducts || [], [master_products, masterProducts]);

  // Daftar Cabang untuk Dropdown Filter
  const outletBranches = useMemo(() => {
    return rawBranches.filter(b => !b.isDeleted && b.branch_id !== 'PUSAT' && b.branch_id !== 'TANGERANG_PUSAT');
  }, [rawBranches]);

  // --- 1. DATA SURAT JALAN GANTUNG (IN-TRANSIT) ---
  const inTransitOrders = useMemo(() => {
    return realDistOrders
      .filter(d => !d.isDeleted && d.destination_branch_id === activeBranch && d.status === 'DALAM_PERJALANAN')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realDistOrders, activeBranch]);

  // --- 2. SMART INVENTORY ENGINE (INTEGRASI DINAMIS POS & LOGISTIK) ---
  const branchInventory = useMemo(() => {
    const inventoryMap = {};

    const initItem = (id, name, category, unit) => {
      if (!inventoryMap[id]) {
        inventoryMap[id] = { id, name, category, unit, totalIn: 0, totalOut: 0, balance: 0 };
      }
    };

    // A. MASUKKAN STOK DARI PUSAT
    realDistOrders.filter(d => !d.isDeleted && d.destination_branch_id === activeBranch && d.status === 'DITERIMA').forEach(d => {
      const key = d.item_id || 'DIMSUM_FROZEN';
      initItem(key, d.item_name, d.item_category || 'PRODUK_JADI', d.unit || 'Pcs');
      inventoryMap[key].totalIn += Number(d.qty || 0);
      inventoryMap[key].balance += Number(d.qty || 0);
    });

    // B. KURANGI STOK DARI PENJUALAN KASIR
    realOrders.filter(o => !o.isDeleted && o.branch_id === activeBranch).forEach(o => {
      const itemsArr = safeJsonParse(o.items, []);
      
      if (itemsArr.length > 0) {
        itemsArr.forEach(item => {
          const masterP = realProducts.find(p => p.id === item.id || p.product_name === item.name);
          let itemKey = masterP ? masterP.id : 'DIMSUM_FROZEN';
          let itemName = item.name;
          let itemCat = masterP ? masterP.category : 'PRODUK_JADI';
          
          const isPorsi = String(item.name).toUpperCase().includes('PORSI');
          const multiplier = isPorsi ? 4 : 1;
          const totalPcsDeducted = Number(item.qty || 0) * multiplier;

          initItem(itemKey, itemName, itemCat, 'Pcs');
          inventoryMap[itemKey].totalOut += totalPcsDeducted;
          inventoryMap[itemKey].balance -= totalPcsDeducted;
        });
      } else {
        const soldQty = Number(o.qty || 0);
        initItem('DIMSUM_FROZEN', 'Dimsum Frozen Core', 'PRODUK_JADI', 'Pcs');
        inventoryMap['DIMSUM_FROZEN'].totalOut += soldQty;
        inventoryMap['DIMSUM_FROZEN'].balance -= soldQty;
      }
    });

    return Object.values(inventoryMap);
  }, [realDistOrders, realOrders, activeBranch, realProducts]);

  const handleTerimaBarang = async (item) => {
    if (!window.confirm(`Verifikasi Fisik Selesai:\n\nApakah Anda yakin barang "${item.item_name}" sejumlah ${formatNumber(item.qty)} ${item.unit} sudah tiba di freezer dalam kondisi baik?`)) return;
    const payload = { ...item, status: 'DITERIMA', verified_date: new Date().toISOString() };
    if (await sendToSheet('update', payload, 'distribution_orders')) {
      showToast('Stok resmi masuk ke inventaris kulkas cabang!', 'success');
    }
  };

  const handleTolakBarang = async (item) => {
    const alasan = window.prompt(`Alasan Retur / Tolak Kiriman Surat Jalan ${item.id}:`, "Barang basi / rusak di jalan");
    if (alasan === null) return; 

    if (!window.confirm(`Konfirmasi Tolak Kiriman:\n\nBarang "${item.item_name}" (${item.qty} ${item.unit}) akan di-retur kembali ke Pusat Tangerang.\n\nLanjutkan?`)) return;

    const payload = { 
      ...item, 
      status: 'DI_RETUR_PADA_PUSAT', 
      notes: `DITOLAK CABANG: ${alasan.toUpperCase()} (Ref: ${item.notes})`,
      verified_date: new Date().toISOString() 
    };

    if (await sendToSheet('update', payload, 'distribution_orders')) {
      showToast('Surat jalan berhasil di-retur kembali ke Pusat!', 'warning');
    }
  };

  const handleLaporPemakaian = async (e) => {
    e.preventDefault();
    const qtyPakai = Number(opnameForm.qty);
    if (!opnameForm.item_id) return alert("Pilih item yang ingin dikurangi!");
    if (qtyPakai <= 0) return alert("Jumlah pemakaian harus lebih besar dari 0!");

    const selectedItem = branchInventory.find(i => i.id === opnameForm.item_id);
    if (!selectedItem) return;

    if (!window.confirm(`Laporan Pemakaian Internal:\n\nItem: ${selectedItem.name}\nJumlah Dikurangi: ${qtyPakai} ${selectedItem.unit}\nKeterangan: ${opnameForm.notes}\n\nStok akan langsung dipotong. Lanjutkan?`)) {
      return;
    }

    const dummyOrderPayload = {
      id: generateId('OPN', todayStr),
      date: todayStr,
      branch_id: activeBranch,
      customer_name: 'INTERNAL OUTLET / OPNAME',
      sales_channel: 'OFFLINE',
      items: JSON.stringify([{ id: selectedItem.id, name: selectedItem.name, qty: qtyPakai, price: 0, hpp: 0 }]),
      qty: qtyPakai,
      total_amount: 0,
      amount_paid: 0,
      payment_method: 'SISTEM_STOK',
      status: 'LUNAS',
      notes: `OPNAME MANDIRI: ${opnameForm.notes.toUpperCase()}`,
      isDeleted: false
    };

    if (await sendToSheet('insert', dummyOrderPayload, 'orders')) {
      showToast('Stok operasional berhasil diperbarui!', 'success');
      setFormOpname({ item_id: '', qty: '', notes: '' });
      setShowOpnameForm(false);
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 animate-in fade-in duration-300">
      
      {/* 🚀 HEADER & FILTER CABANG - FLUID GRADIENT */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-900 p-6 lg:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 rounded-3xl shadow-xl relative overflow-hidden border border-blue-800">
        <div className="absolute top-0 right-0 p-4 opacity-5"><Database size={120} className="text-blue-400"/></div>
        
        <div className="relative z-10 w-full md:w-2/3">
          <h2 className="text-xl font-black text-white flex items-center gap-3 mb-2 tracking-wide">
            <Database className="text-blue-400" size={24}/> Logistik Freezer &amp; Inventaris Cabang
          </h2>
          <p className="text-[11px] font-bold text-slate-400 mt-1 max-w-lg leading-relaxed">
            Pusat kendali pintu belakang outlet. Validasi surat jalan dari Pusat dan pantau running balance sisa fisik kulkas.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
          <button type="button" onClick={() => setShowOpnameForm(prev => !prev)} className="px-5 py-2.5 bg-slate-800/80 text-white hover:bg-slate-700 rounded-xl text-xs font-black transition-colors flex items-center gap-2 shadow-inner border border-slate-700/50 backdrop-blur-sm cursor-pointer">
            <ClipboardEdit size={16}/> Lapor Pemakaian Internal
          </button>

          {isHQ && (
            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl border border-white/10 shadow-inner backdrop-blur-sm">
              <Filter size={16} className="text-blue-300"/>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">Radar Cabang:</span>
              <select value={activeBranch} onChange={e => setActiveBranch(e.target.value)} className="bg-transparent text-xs font-black text-white outline-none cursor-pointer">
                {outletBranches.length === 0 && <option value="CIBINONG" className="text-slate-800">🏪 Resto Cibinong</option>}
                {outletBranches.map(b => (
                  <option key={b.branch_id} value={b.branch_id} className="text-slate-800">
                    {b.branch_type === 'PRODUCTION_BRANCH' ? '🏭' : '🏪'} {b.branch_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* FORM OPNAME */}
      {showOpnameForm && (
        <div className="bg-gradient-to-br from-amber-50 to-white p-6 border border-amber-200 shadow-sm rounded-3xl animate-in slide-in-from-top-4 duration-200">
          <h3 className="font-black text-sm text-slate-800 mb-4 flex items-center gap-2 border-b border-amber-100 pb-3">
            <ClipboardEdit size={18} className="text-amber-600" /> Form Pemakaian Internal / Penyesuaian Mika Saus
          </h3>
          <form onSubmit={handleLaporPemakaian} className="grid grid-cols-1 md:grid-cols-4 gap-5 items-end">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Pilih Barang di Kulkas</label>
              <select required value={opnameForm.item_id} onChange={e=>setFormOpname({...opnameForm, item_id: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer focus:border-amber-500 shadow-sm">
                <option value="">-- Pilih Item --</option>
                {branchInventory.map(i => <option key={i.id} value={i.id}>{i.name} (Sisa: {i.balance} {i.unit})</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Jumlah Dipakai / Rusak</label>
              <input type="number" min="1" required value={opnameForm.qty} onChange={e=>setFormOpname({...opnameForm, qty: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-base font-black text-center outline-none focus:border-amber-500 shadow-sm" placeholder="0" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Alasan Detail Pemakaian</label>
              <input type="text" required value={opnameForm.notes} onChange={e=>setFormOpname({...opnameForm, notes: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-amber-500 shadow-sm" placeholder="Misal: Saus tumpah, mika sobek..." />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-3 bg-amber-600 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:bg-amber-700 transition-colors shadow-md cursor-pointer">Potong Stok</button>
              <button type="button" onClick={() => setShowOpnameForm(false)} className="p-3 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 cursor-pointer shadow-sm"><X size={16}/></button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SURAT JALAN IN-TRANSIT */}
        <div className="bg-white flex flex-col overflow-hidden h-max border border-slate-200 rounded-3xl shadow-sm">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
              <Truck size={18} className="text-amber-500"/> Logistik Dalam Perjalanan
            </h3>
            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black px-2.5 py-1 rounded-md shadow-sm animate-pulse uppercase tracking-wider">
              {inTransitOrders.length} OTR
            </span>
          </div>

          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar bg-white">
            {inTransitOrders.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Truck size={48} className="mx-auto mb-3 opacity-20"/>
                <div className="text-sm font-black">Tidak ada pengiriman aktif</div>
                <div className="text-[11px] mt-1 font-bold">Semua boks manifest dari pusat sudah aman diverifikasi.</div>
              </div>
            ) : (
              inTransitOrders.map(order => (
                <div key={order.id} className="bg-white border border-slate-200 p-5 rounded-2xl relative overflow-hidden group shadow-sm hover:border-amber-300 transition-colors">
                  <div className="text-[10px] text-slate-400 font-bold mb-1.5">{formatDate(order.date)} • {order.id}</div>
                  <div className="text-sm font-black text-slate-800 uppercase tracking-wide line-clamp-1">{order.item_name}</div>
                  <div className="text-2xl font-black text-blue-600 mt-1 mb-4 tracking-tight">{formatNumber(order.qty)} <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">{order.unit}</span></div>
                  
                  <div className="flex flex-col gap-2 text-[10px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-5 font-bold">
                    <div className="flex justify-between"><span>Jalur Muatan:</span> <span className="text-slate-700 uppercase">{order.item_category.replace(/_/g, ' ')}</span></div>
                    <div className="flex justify-between"><span>Supir Kurir:</span> <span className="text-slate-700 uppercase">{order.driver_name}</span></div>
                    <div className="flex justify-between border-t border-slate-200 pt-2 mt-1"><span>Memo Pusat:</span> <span className="text-slate-700 text-right line-clamp-1 italic">"{order.notes || '-'}"</span></div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => handleTolakBarang(order)} className="p-3 text-slate-400 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-xl transition-colors shadow-sm cursor-pointer" title="Tolak / Retur Barang Rusak">
                      <Undo2 size={18}/>
                    </button>
                    <button onClick={() => handleTerimaBarang(order)} className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 font-black text-[11px] uppercase tracking-wider py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95">
                      <CheckSquare size={16}/> Terima Fisik Kulkas
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* NERACA STOK */}
        <div className="lg:col-span-2 bg-white flex flex-col overflow-hidden border border-slate-200 rounded-3xl shadow-sm border-t-4 border-t-blue-600">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
              <Package size={18} className="text-blue-600"/> Neraca Mutasi Sisa Fisik Kulkas Outlet Terkini
            </h4>
          </div>

          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar min-h-[50vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50/50 border-b border-slate-100 sticky top-0 shadow-sm">
                <tr>
                  <th className="px-5 py-4 font-black">Barang &amp; Kategori</th>
                  <th className="px-5 py-4 font-black text-center">Total Pasokan HQ</th>
                  <th className="px-5 py-4 font-black text-center">Total Habis (POS)</th>
                  <th className="px-5 py-4 font-black text-right">Sisa Fisik Kulkas</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-100 bg-white">
                {branchInventory.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-32 text-slate-400 bg-white">
                      <Database size={48} className="mx-auto mb-4 opacity-20"/>
                      <div className="font-black text-base tracking-wide">Kulkas Outlet Kosong</div>
                      <div className="text-xs mt-1 font-bold">Belum ada riwayat manifest logistik yang disahkan di cabang ini.</div>
                    </td>
                  </tr>
                ) : (
                  branchInventory.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-black text-slate-800 text-sm uppercase tracking-wide mb-1.5">{item.name}</div>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border ${item.category === 'PRODUK_JADI' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {item.category.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap text-slate-700">
                        <div className="flex justify-center items-center gap-1.5 font-black text-blue-600 text-sm">
                          <ArrowDownToLine size={14} className="text-blue-400"/> {formatNumber(item.totalIn)} <span className="text-[10px] text-slate-400 font-bold uppercase">{item.unit}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap text-slate-700">
                        <div className="flex justify-center items-center gap-1.5 font-black text-red-500 text-sm">
                          <ArrowUpRight size={14} className="text-red-400"/> {formatNumber(item.totalOut)} <span className="text-[10px] text-slate-400 font-bold uppercase">{item.unit}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className={`font-black text-2xl tracking-tighter flex justify-end items-center gap-1.5 ${item.balance <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {formatNumber(item.balance)} <span className="text-[10px] opacity-60 font-bold uppercase tracking-wider">{item.unit}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
