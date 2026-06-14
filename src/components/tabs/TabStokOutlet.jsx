import React, { useState, useMemo } from 'react';
import { 
  Package, Truck, CheckSquare, Database, Filter, 
  ArrowDownToLine, ArrowUpRight, CheckCircle2, X, 
  AlertTriangle, ClipboardEdit, Undo2, History
} from 'lucide-react';
import { formatDate, getTodayStr, generateId } from '../../utils/helpers';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabLogistikFreezer({ 
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

  // Daftar Cabang untuk Dropdown Filter (Hanya muncul jika yang login adalah HQ)
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

    // FUNGSI INISIALISASI ITEM AGAR TIDAK NAN
    const initItem = (id, name, category, unit) => {
      if (!inventoryMap[id]) {
        inventoryMap[id] = { id, name, category, unit, totalIn: 0, totalOut: 0, balance: 0 };
      }
    };

    // A. MASUKKAN STOK: Dari Surat Jalan yang statusnya DITERIMA dari Pusat
    realDistOrders.filter(d => !d.isDeleted && d.destination_branch_id === activeBranch && d.status === 'DITERIMA').forEach(d => {
      const key = d.item_id || 'DIMSUM_FROZEN';
      initItem(key, d.item_name, d.item_category || 'PRODUK_JADI', d.unit || 'Pcs');
      inventoryMap[key].totalIn += Number(d.qty || 0);
      inventoryMap[key].balance += Number(d.qty || 0);
    });

    // B. KURANGI STOK: Membedah Array Items dari Nota Penjualan Kasir POS di Cabang ini secara dinamis
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

  // --- ACTIONS: KONFIRMASI TERIMA BARANG SAKTI ---
  const handleTerimaBarang = async (item) => {
    if (!window.confirm(`Verifikasi Fisik Selesai:\n\nApakah Anda yakin barang "${item.item_name}" sejumlah ${formatNumber(item.qty)} ${item.unit} sudah tiba di freezer dalam kondisi baik?`)) return;
    
    const payload = { ...item, status: 'DITERIMA', verified_date: new Date().toISOString() };
    
    if (await sendToSheet('update', payload, 'distribution_orders')) {
      showToast('Stok resmi masuk ke inventaris kulkas cabang!', 'success');
    }
  };

  // --- ACTIONS: RETUR / TOLAK BARANG RUSAK ---
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

  // --- ACTIONS: LAPOR PEMAKAIAN INTERNAL / OPNAME MANDIRI ---
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

    // 🔥 FIX TYPO DI SINI: Kurung kurawal penutup objek ditambahkan sebelum kurung siku!
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
    <div className="space-y-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-300">
      
      {/* HEADER & FILTER CABANG */}
      <div className="card-holo p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden bg-white">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600"></div>
        <div className="pl-2">
          <h2 className="text-base font-extrabold normal-case flex items-center gap-2 text-slate-900">
            <Database className="text-red-600" size={20}/> Logistik freezer &amp; inventaris cabang
          </h2>
          <p className="text-[10px] font-semibold text-slate-400 mt-1 normal-case tracking-wide">
            Pusat kendali pintu belakang outlet. Validasi surat jalan dari Pusat dan pantau running balance sisa fisik kulkas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button type="button" onClick={() => setShowOpnameForm(prev => !prev)} className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs">
            <ClipboardEdit size={14}/> Lapor pemakaian internal
          </button>

          {isHQ && (
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs">
              <Filter size={14} className="text-slate-400"/>
              <span className="text-[10px] font-bold text-slate-500 normal-case">Radar cabang:</span>
              <select value={activeBranch} onChange={e => setActiveBranch(e.target.value)} className="bg-transparent text-xs font-extrabold normal-case text-blue-700 outline-none cursor-pointer">
                {outletBranches.length === 0 && <option value="CIBINONG">🏪 Resto Cibinong</option>}
                {outletBranches.map(b => (
                  <option key={b.branch_id} value={b.branch_id}>
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
        <div className="card-holo p-5 border-t-4 border-t-amber-500 bg-amber-50/20 animate-in slide-in-from-top-4 duration-200">
          <h3 className="font-extrabold text-xs text-slate-800 normal-case mb-3 flex items-center gap-1.5"><ClipboardEdit size={14} className="text-amber-600" /> Form pemakaian internal / Penyesuaian mika saus</h3>
          <form onSubmit={handleLaporPemakaian} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-[9px] font-bold text-slate-500 block mb-1">Pilih barang di kulkas</label>
              <select required value={opnameForm.item_id} onChange={e=>setFormOpname({...opnameForm, item_id: e.target.value})} className="w-full p-2 bg-white border rounded-lg text-xs font-bold outline-none cursor-pointer">
                <option value="">-- Pilih Item --</option>
                {branchInventory.map(i => <option key={i.id} value={i.id}>{i.name} (Sisa: {i.balance} {i.unit})</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-500 block mb-1">Jumlah yang dipakai/rusak</label>
              <input type="number" min="1" required value={opnameForm.qty} onChange={e=>setFormOpname({...opnameForm, qty: e.target.value})} className="w-full p-2 bg-white border rounded-lg text-xs font-bold text-center outline-none" placeholder="0" />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-500 block mb-1">Alasan detail pemakaian</label>
              <input type="text" required value={opnameForm.notes} onChange={e=>setFormOpname({...opnameForm, notes: e.target.value})} className="w-full p-2 bg-white border rounded-lg text-xs font-medium" placeholder="Misal: Saus tumpah, mika sobek, review..." />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2 bg-amber-600 text-white font-bold text-xs rounded-lg hover:bg-amber-700 transition-colors shadow-xs">Potong stok</button>
              <button type="button" onClick={() => setShowOpnameForm(false)} className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300"><X size={14}/></button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SURAT JALAN */}
        <div className="card-holo flex flex-col overflow-hidden h-max border-t-4 border-t-amber-500 shadow-xs">
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h3 className="font-extrabold text-xs normal-case text-slate-800 flex items-center gap-2">
              <Truck size={16} className="text-amber-500"/> Truk logistik dalam perjalanan
            </h3>
            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold px-2 py-1 rounded-md normal-case shadow-xs animate-pulse">
              {inTransitOrders.length} OTR
            </span>
          </div>

          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar bg-white">
            {inTransitOrders.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Truck size={36} className="mx-auto mb-2 opacity-20"/>
                <div className="text-xs font-bold normal-case">Tidak ada pengiriman aktif</div>
                <div className="text-[10px] mt-1 font-medium">Semua boks manifest dari pusat sudah aman diverifikasi.</div>
              </div>
            ) : (
              inTransitOrders.map(order => (
                <div key={order.id} className="bg-white border border-slate-200 p-4 rounded-xl relative overflow-hidden group shadow-xs hover:border-amber-300 transition-colors">
                  <div className="text-[10px] text-slate-400 font-bold mb-1">{formatDate(order.date)} • {order.id}</div>
                  <div className="text-xs font-extrabold text-slate-800 normal-case line-clamp-1">{order.item_name}</div>
                  <div className="text-lg font-black text-blue-600 mt-1 mb-3">{formatNumber(order.qty)} <span className="text-[10px] font-bold text-blue-400 normal-case">{order.unit}</span></div>
                  
                  <div className="flex flex-col gap-1.5 text-[9px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mb-4 font-semibold normal-case">
                    <div className="flex justify-between"><span>Jalur muatan:</span> <span className="text-slate-700 font-bold">{order.item_category.replace(/_/g, ' ')}</span></div>
                    <div className="flex justify-between"><span>Supir kurir:</span> <span className="text-slate-700 font-bold">{order.driver_name}</span></div>
                    <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-0.5"><span>Memo pusat:</span> <span className="text-slate-700 font-bold text-right line-clamp-1">{order.notes || '-'}</span></div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => handleTolakBarang(order)} className="p-2 text-slate-400 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition-colors shadow-xs" title="Tolak / Retur Barang Rusak">
                      <Undo2 size={16}/>
                    </button>
                    <button onClick={() => handleTerimaBarang(order)} className="flex-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 hover:border-emerald-600 font-bold text-[10px] normal-case py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs">
                      <CheckSquare size={14}/> Terima fisik kulkas
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* NERACA STOK */}
        <div className="lg:col-span-2 card-holo flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h4 className="font-extrabold text-xs normal-case text-slate-800 flex items-center gap-2">
              <Package size={16} className="text-red-600"/> Neraca mutasi sisa fisik kulkas outlet terkini
            </h4>
          </div>

          <div className="overflow-x-auto flex-1 p-1 custom-scrollbar min-h-[50vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-[10px] normal-case text-slate-500 bg-slate-50/50 border-b border-slate-200 sticky top-0 shadow-xs">
                <tr>
                  <th className="px-5 py-4 font-bold">Barang &amp; Kategori</th>
                  <th className="px-5 py-4 font-bold text-center">Total pasokan hq</th>
                  <th className="px-5 py-4 font-bold text-center">Total habis (pos/internal)</th>
                  <th className="px-5 py-4 font-bold text-right">Sisa fisik kulkas</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-100 bg-white">
                {branchInventory.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-24 text-slate-400 bg-white">
                      <Database size={36} className="mx-auto mb-3 opacity-20"/>
                      <div className="font-bold normal-case text-sm">Gudang kosong</div>
                      <div className="text-[10px] mt-1 font-medium">Belum ada riwayat manifest logistik yang disahkan di cabang ini.</div>
                    </td>
                  </tr>
                ) : (
                  branchInventory.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-extrabold text-slate-800 normal-case text-xs mb-1">{item.name}</div>
                        <span className={`text-[9px] font-bold normal-case px-2 py-0.5 rounded-md border ${item.category === 'PRODUK_JADI' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {item.category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap text-slate-700">
                        <div className="flex justify-center items-center gap-1.5 font-bold text-blue-600">
                          <ArrowDownToLine size={12} className="text-blue-500"/> {formatNumber(item.totalIn)} <span className="text-[9px] text-slate-400 normal-case">{item.unit}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap text-slate-700">
                        <div className="flex justify-center items-center gap-1.5 font-bold text-red-600">
                          <ArrowUpRight size={12} className="text-red-400"/> {formatNumber(item.totalOut)} <span className="text-[9px] text-slate-400 normal-case">{item.unit}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className={`font-black text-lg flex justify-end items-center gap-1.5 ${item.balance <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {formatNumber(item.balance)} <span className="text-[10px] opacity-60 font-bold normal-case">{item.unit}</span>
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
