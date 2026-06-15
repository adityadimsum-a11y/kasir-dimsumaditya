import React, { useState, useMemo } from 'react';
import { 
  ShoppingBag, Calendar, FileText, Trash2, Printer, 
  Wallet, Truck, CheckCircle2, Plus, ShoppingCart, User
} from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });

const normalizeDateStr = (dateVal) => {
  if (!dateVal) return '';
  const strVal = String(dateVal);
  if (/^\d{4}-\d{2}-\d{2}/.test(strVal)) return strVal.substring(0, 10);
  if (strVal.includes('T')) return strVal.split('T')[0];
  const parts = strVal.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return strVal.substring(0, 10);
};

export default function TabPurchases({ 
  purchases = [], purchases_data,
  expenses = [], expenses_data, 
  masterSuppliers = [], master_suppliers, 
  masterRawMaterials = [], master_raw_materials, 
  karyawan = [], master_karyawan, 
  sendToSheet, showToast, user, requestDelete 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realSuppliers = useMemo(() => master_suppliers || masterSuppliers || [], [master_suppliers, masterSuppliers]);
  const realRawMaterials = useMemo(() => master_raw_materials || masterRawMaterials || [], [master_raw_materials, masterRawMaterials]);
  const realKaryawan = useMemo(() => master_karyawan || karyawan || [], [karyawan, master_karyawan]);

  const [activeSubTab, setActiveTab] = useState('MANUAL'); 
  const [tableDateFilter, setTableDateFilter] = useState(todayStr);

  // FORM SUPPLIER AYAM BESAR
  const [formSupplier, setFormSupplier] = useState({
    supplierName: '', category: 'BAHAN_BAKU', itemName: '', qty: '', price: '', paymentType: 'TEMPO', paymentMethod: 'CASH', dpAmount: ''           
  });

  // ==========================================
  // STATE MULTI-ITEM KAS & OPS MANUAL
  // ==========================================
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [storeName, setStoreName] = useState('');
  const [cashGiven, setCashGiven] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  
  // Keranjang belanja sementara (Cart)
  const [cart, setCart] = useState([]);
  
  // Input selector item kas manual
  const [itemSelector, setItemSelector] = useState({
    category: 'Bahan Baku', itemName: '', unit: '', qty: '1', price: ''
  });

  const supplierOptions = useMemo(() => realSuppliers.filter(s => !s.isDeleted && String(s.isDeleted).toUpperCase() !== 'TRUE'), [realSuppliers]);
  const employeeOptions = useMemo(() => realKaryawan.filter(k => !k.isDeleted && String(k.isDeleted).toUpperCase() !== 'TRUE'), [realKaryawan]);

  const opsCategories = useMemo(() => {
    const validItems = realRawMaterials.filter(m => !m.isDeleted && String(m.isDeleted).toUpperCase() !== 'TRUE');
    const cats = [...new Set(validItems.map(m => m.category))];
    if (cats.length === 0) return ['Bahan Baku', 'Kemasan', 'Operasional Kendaraan', 'ATK & Perlengkapan', 'Air & Kebersihan'];
    return cats;
  }, [realRawMaterials]);

  const hitungKantongSupplier = useMemo(() => formSupplier.category === 'BAHAN_BAKU' ? Number(formSupplier.qty || 0) / 10 : 0, [formSupplier.qty, formSupplier.category]);
  const totalTagihanSupplier = useMemo(() => Number(formSupplier.qty || 0) * Number(formSupplier.price || 0), [formSupplier.qty, formSupplier.price]);
  
  // Total akumulasi belanjaan di keranjang
  const totalTagihanCart = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.total, 0);
  }, [cart]);

  // Estimasi kembalian kasbon karyawan
  const estimasiKembalian = useMemo(() => {
    const cash = Number(cashGiven || 0);
    if (cash === 0 || cash < totalTagihanCart) return 0;
    return cash - totalTagihanCart;
  }, [cashGiven, totalTagihanCart]);

  // JURNAL BUKU KAS GABUNGAN
  const historyCombined = useMemo(() => {
    const all = [];
    realPurchases.forEach(p => {
      if (!p.isDeleted && String(p.isDeleted).toUpperCase() !== 'TRUE') {
        all.push({ doc_type: 'PURCHASE', id: p.id, date: p.date, branch_id: p.branch_id, title: p.supplier_name || p.supplierName || 'Belanja kas / supplier', subtitle: p.item_name || p.itemName, qty: p.qty, unit: p.unit, total_amount: Number(p.total_amount || p.amount || 0), paid_amount: Number(p.paid_amount || 0), payment_status: p.payment_status, payment_method: p.payment_method, employee_name: p.employee_name, change_status: p.change_status });
      }
    });
    realExpenses.forEach(e => {
      if (!e.isDeleted && String(e.isDeleted).toUpperCase() !== 'TRUE') {
        all.push({ doc_type: 'EXPENSE', id: e.id, date: e.date, branch_id: e.branch_id, title: e.category || 'Biaya operasional', subtitle: e.description || e.item_name || 'Beban kas', qty: 1, unit: 'Lot', total_amount: Number(e.amount || 0), paid_amount: Number(e.amount || 0), payment_status: 'LUNAS', payment_method: e.payment_method || 'CASH', employee_name: e.employee_name, change_status: e.change_status });
      }
    });
    return all.filter(x => normalizeDateStr(x.date) === tableDateFilter && (currentBranch === 'TANGERANG_PUSAT' ? String(x.branch_id || '').toUpperCase().includes('TANGERANG') : String(x.branch_id || '').toUpperCase() === currentBranch.toUpperCase())).sort((a, b) => new Date(normalizeDateStr(b.date)) - new Date(normalizeDateStr(a.date)));
  }, [realPurchases, realExpenses, tableDateFilter, currentBranch]);

  // ACTION TAMBAH BARANG KE KERANJANG
  const handleAddItemToCart = () => {
    if (!itemSelector.itemName) return alert("Pilih item terlebih dahulu!");
    if (Number(itemSelector.qty) <= 0 || Number(itemSelector.price) <= 0) return alert("Jumlah dan harga harus lebih dari 0!");

    const newItem = {
      cart_id: 'CART-' + new Date().getTime(),
      category: itemSelector.category,
      itemName: itemSelector.itemName,
      unit: itemSelector.unit || 'Pcs',
      qty: Number(itemSelector.qty),
      price: Number(itemSelector.price),
      total: Number(itemSelector.qty) * Number(itemSelector.price)
    };

    setCart(prev => [...prev, newItem]);
    setItemSelector(prev => ({ ...prev, itemName: '', qty: '1', price: '', unit: '' }));
  };

  const handleRemoveFromCart = (cartId) => {
    setCart(prev => prev.filter(item => item.cart_id !== cartId));
  };

  const handleOpsItemSelect = (e) => {
    const selectedName = e.target.value;
    const itemDef = realRawMaterials.find(i => !i.isDeleted && i.category === itemSelector.category && i.item_name === selectedName);
    if (itemDef) {
      setItemSelector(prev => ({ ...prev, itemName: selectedName, unit: itemDef.unit || 'Pcs', price: itemDef.default_price > 0 ? String(itemDef.default_price) : '' }));
    } else {
      setItemSelector(prev => ({ ...prev, itemName: selectedName }));
    }
  };

  // SUBMIT FORM SUPPLIER BESAR (AYAM)
  const handleSubmitSupplier = async (e) => {
    e.preventDefault();
    if (!formSupplier.supplierName) return alert("Pilih nama Supplier rekanan resmi terlebih dahulu!");
    const calculatedTotal = totalTagihanSupplier;
    let paidAmount = formSupplier.paymentType === 'LUNAS' ? calculatedTotal : (formSupplier.paymentType === 'DP' ? Number(formSupplier.dpAmount || 0) : 0);
    const finalQty = formSupplier.category === 'BAHAN_BAKU' ? hitungKantongSupplier : Number(formSupplier.qty);
    const finalPrice = finalQty > 0 ? (calculatedTotal / finalQty) : 0;
    
    const payloadPurchase = {
      id: generateId('PO-DMA', todayStr), date: todayStr, branch_id: currentBranch,
      supplier_name: formSupplier.supplierName.toUpperCase(), item_name: formSupplier.itemName.toUpperCase(), 
      qty: finalQty, unit: formSupplier.category === 'BAHAN_BAKU' ? 'Kantong' : 'Pcs', price: finalPrice, 
      total_amount: calculatedTotal, paid_amount: paidAmount, payment_status: paidAmount >= calculatedTotal ? 'LUNAS' : 'BELUM_LUNAS',
      payment_method: formSupplier.paymentType === 'TEMPO' ? 'HUTANG' : formSupplier.paymentMethod, isDeleted: false
    };

    const isSuccess = await sendToSheet('insert', payloadPurchase, 'purchases');
    if (isSuccess) {
      await sendToSheet('insert', { id: generateId('LAY', todayStr), date: todayStr, branch_id: currentBranch, category: formSupplier.category, item_name: formSupplier.itemName.toUpperCase(), qty_received: finalQty, qty_remaining: finalQty, unit_cost: finalPrice, reference_id: payloadPurchase.id, isDeleted: false }, 'inventory_cost_layers');
      if (paidAmount > 0) await sendToSheet('insert', { id: generateId('CFO', todayStr), date: todayStr, branch_id: currentBranch, type: 'OUT', category: 'BELANJA LOGISTIK', description: `Beli ${formSupplier.itemName.toUpperCase()} ke ${formSupplier.supplierName.toUpperCase()} (${formSupplier.paymentType})`, amount: paidAmount, method: formSupplier.paymentMethod, reference_id: payloadPurchase.id }, 'cashflow_transactions');
      showToast("Nota Belanja Supplier Berhasil Disimpan!", "success");
      setFormSupplier({ supplierName: '', category: 'BAHAN_BAKU', itemName: '', qty: '', price: '', paymentType: 'TEMPO', paymentMethod: 'CASH', dpAmount: '' });
    }
  };

  // ==========================================
  // ACTIONS: SUBMIT MULTI-ITEM KASBON ENGINE
  // ==========================================
  const handleSubmitMultiOps = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return alert("Wajib memilih nama Karyawan Penerima Uang / Kasbon!");
    if (cart.length === 0) return alert("Keranjang belanja masih kosong! Tambahkan item belanja terlebih dahulu.");
    
    const cashGivenNum = Number(cashGiven || 0);
    if (cashGivenNum < totalTagihanCart) {
      return alert(`Uang yang diberikan (${formatRupiah(cashGivenNum)}) kurang dari total nota aktual (${formatRupiah(totalTagihanCart)})!`);
    }

    const kasbonId = generateId('KSB', todayStr);
    const hasKembalian = estimasiKembalian > 0;
    
    for (let item of cart) {
      const isBarangFisik = (item.category === 'Bahan Baku' || item.category === 'Kemasan' || item.category === 'BAHAN BAKU' || item.category === 'KEMASAN');
      const itemTrxId = generateId(isBarangFisik ? 'PO-KAS' : 'EXP', todayStr);

      if (isBarangFisik) {
        await sendToSheet('insert', {
          id: itemTrxId, date: todayStr, branch_id: currentBranch,
          supplier_name: storeName ? `Toko ${storeName.toUpperCase()}` : 'Belanja kas manual',
          item_name: item.itemName.toUpperCase(), qty: item.qty, unit: item.unit, price: item.price,
          total_amount: item.total, paid_amount: item.total, payment_status: 'LUNAS', payment_method: paymentMethod,
          employee_name: selectedEmployee.toUpperCase(), cash_given: cashGivenNum, expected_change: estimasiKembalian,
          change_status: hasKembalian ? 'PENDING' : 'SETTLED', kasbon_id: kasbonId, isDeleted: false
        }, 'purchases');

        await sendToSheet('insert', { 
          id: generateId('LAY', todayStr), date: todayStr, branch_id: currentBranch, category: item.category.toUpperCase().replace(' ', '_'), 
          item_name: item.itemName.toUpperCase(), qty_received: item.qty, qty_remaining: item.qty, unit_cost: item.price, 
          reference_id: itemTrxId, isDeleted: false 
        }, 'inventory_cost_layers');
      } else {
        await sendToSheet('insert', {
          id: itemTrxId, date: todayStr, branch_id: currentBranch, category: item.category.toUpperCase(),
          description: `${item.itemName.toUpperCase()} (${item.qty} ${item.unit}) ${storeName ? `- ${storeName.toUpperCase()}` : ''}`,
          amount: item.total, payment_method: paymentMethod, employee_name: selectedEmployee.toUpperCase(), cash_given: cashGivenNum, 
          expected_change: estimasiKembalian, change_status: hasKembalian ? 'PENDING' : 'SETTLED', kasbon_id: kasbonId, isDeleted: false
        }, 'expenses');
      }
    }

    await sendToSheet('insert', {
      id: generateId('CFO', todayStr), date: todayStr, branch_id: currentBranch, type: 'OUT',
      category: 'KASBON BELANJA KARYAWAN', 
      description: `Kasbon keluar ke ${selectedEmployee.toUpperCase()} (Nota: ${formatRupiah(totalTagihanCart)}, Titipan: ${formatRupiah(cashGivenNum)})`,
      amount: cashGivenNum, method: paymentMethod, reference_id: kasbonId
    }, 'cashflow_transactions');

    showToast(`Sukses mencatat kasbon ${selectedEmployee}. Menunggu sisa kembalian di setor!`, "success");
    setCart([]);
    setSelectedEmployee('');
    setStoreName('');
    setCashGiven('');
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      
      {/* BANNER HEAD - FLAT WORKSPACE STYLE */}
      <div className="card-holo p-6 shadow-xs flex items-center gap-3 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600"></div>
        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center border border-red-100 shrink-0"><Wallet size={18} className="text-red-600"/></div>
        <div>
          <h2 className="text-slate-800 font-extrabold normal-case text-base">Kas keluar &amp; belanja</h2>
          <p className="text-[10px] text-slate-400 font-semibold normal-case mt-0.5">Satu pintu utama pengeluaran kas internal dan pembayaran nota supplier pabrik.</p>
        </div>
      </div>

      {/* SUB TAB SELECTOR */}
      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-fit shadow-inner">
        <button onClick={() => setActiveTab('MANUAL')} className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 ${activeSubTab === 'MANUAL' ? 'bg-white text-red-600 shadow-xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}><Wallet size={12}/> Kas &amp; ops manual</button>
        <button onClick={() => setActiveTab('SUPPLIER')} className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 ${activeSubTab === 'SUPPLIER' ? 'bg-white text-red-600 shadow-xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}><Truck size={12}/> Nota supplier besar</button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: FORM INPUT */}
        <div className="xl:col-span-5 flex flex-col gap-6">

          {/* FORM KAS & OPS MANUAL */}
          {activeSubTab === 'MANUAL' && (
            <div className="card-holo overflow-hidden border-t-4 border-t-red-500 shadow-sm">
              <div className="p-5 border-b border-slate-100 bg-slate-50 font-bold text-xs flex items-center gap-2 text-slate-800 normal-case">
                <ShoppingCart size={16} className="text-red-600"/> Formulir pengeluaran kas (Multi-item)
              </div>
              <div className="p-5 space-y-4">
                
                {/* PIC KARYAWAN & WARUNG */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 p-3 rounded-2xl shadow-inner">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1 normal-case flex items-center gap-1"><User size={10}/> Karyawan pembawa uang</label>
                    <select 
                      required 
                      value={selectedEmployee} 
                      onChange={e=>setSelectedEmployee(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-[10px] outline-none cursor-pointer"
                    >
                      <option value="">-- Pilih karyawan --</option>
                      {employeeOptions.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1 normal-case">Nama toko / Warung</label>
                    <input type="text" value={storeName} onChange={e=>setStoreName(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-[10px] outline-none" placeholder="Cth: Warung Madura, Toko Aceng" />
                  </div>
                </div>

                {/* 🔥 RE-DESIGN STABIL GRID: AREA SELEKTOR ITEM KERANJANG ANTI KEPOTONG */}
                <div className="border border-slate-200 p-4 rounded-2xl bg-slate-50/50 space-y-3 shadow-xs">
                  <div className="text-[9px] font-bold text-slate-500 normal-case border-b border-slate-200 pb-1.5 flex items-center gap-1">Selector input item belanja</div>
                  
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-5">
                      <select value={itemSelector.category} onChange={e=>setItemSelector({...itemSelector, category: e.target.value, itemName: '', unit: '', price: ''})} className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold text-[10px] outline-none cursor-pointer">
                        {opsCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div className="col-span-7">
                       <select value={itemSelector.itemName} onChange={handleOpsItemSelect} className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold text-[10px] text-red-600 outline-none cursor-pointer">
                          <option value="">-- Pilih variant item --</option>
                          {realRawMaterials.filter(m => !m.isDeleted && m.category === itemSelector.category).map(item => (
                            <option key={item.id} value={item.item_name}>{item.item_name}</option>
                          ))}
                       </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[8px] font-bold text-slate-400 normal-case block mb-0.5">Jumlah</label>
                      <input type="number" min="0.1" step="0.1" value={itemSelector.qty} onChange={e=>setItemSelector({...itemSelector, qty: e.target.value})} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-center font-bold text-xs outline-none" />
                    </div>
                    <div>
                      <label className="text-[8px] font-bold text-slate-400 normal-case block mb-0.5">Satuan</label>
                      <input type="text" value={itemSelector.unit} onChange={e=>setItemSelector({...itemSelector, unit: e.target.value})} className="w-full p-2 bg-white/40 border border-slate-200 text-center font-bold text-xs text-slate-500 rounded-lg" placeholder="Pcs" />
                    </div>
                    <div>
                      <label className="text-[8px] font-bold text-slate-400 normal-case block mb-0.5">Harga satuan</label>
                      <input type="number" value={itemSelector.price} onChange={e=>setItemSelector({...itemSelector, price: e.target.value})} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-right font-bold text-xs outline-none" placeholder="0" />
                    </div>
                  </div>

                  <button type="button" onClick={handleAddItemToCart} className="w-full bg-slate-800 text-white text-[9px] font-bold py-2 rounded-lg hover:bg-slate-900 transition-colors shadow-xs">
                     + Masukkan ke keranjang
                  </button>
                </div>

                {/* TAMPILAN KERANJANG BELANJA */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-inner bg-slate-50">
                  <div className="bg-slate-100 p-2.5 text-[9px] font-bold text-slate-500 normal-case flex justify-between border-b">
                     <span>Keranjang belanja kas harian</span>
                     <span>{cart.length} Item</span>
                  </div>
                  <div className="max-h-[18vh] overflow-y-auto divide-y divide-slate-100 font-semibold text-[11px] bg-white">
                     {cart.length === 0 ? (
                       <div className="p-6 text-center text-slate-400 normal-case text-[9px] font-bold">Keranjang belanja kosong.</div>
                     ) : (
                       cart.map(item => (
                         <div key={item.cart_id} className="p-2.5 flex justify-between items-center hover:bg-slate-50/50">
                            <div>
                              <div className="text-slate-800 font-bold">{item.itemName}</div>
                              <div className="text-[9px] text-slate-400 font-medium">{item.qty} {item.unit} x {formatRupiah(item.price)}</div>
                            </div>
                            <div className="flex items-center gap-3">
                               <span className="text-slate-800 font-extrabold">{formatRupiah(item.total)}</span>
                               <button type="button" onClick={()=>handleRemoveFromCart(item.cart_id)} className="text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={12}/></button>
                            </div>
                         </div>
                       ))
                     )}
                  </div>
                  <div className="bg-slate-900 text-white p-3 flex justify-between items-center font-bold">
                     <span className="text-[9px] text-slate-400 normal-case">Total nota aktual:</span>
                     <span className="text-base text-emerald-400 font-black">{formatRupiah(totalTagihanCart)}</span>
                  </div>
                </div>

                {/* SINKRONISASI KAS KELUAR */}
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl grid grid-cols-2 gap-3 shadow-inner">
                   <div>
                     <label className="text-[9px] font-bold text-slate-500 block mb-1 normal-case">Uang kas diberikan owner</label>
                     <div className="relative">
                       <span className="absolute left-3 top-2.5 font-bold text-slate-400 text-xs">Rp</span>
                       <input type="text" required value={cashGiven ? Number(cashGiven).toLocaleString('id-ID') : ''} onChange={e=>setCashGiven(e.target.value.replace(/\D/g, ''))} className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-lg font-bold text-xs bg-white outline-none focus:border-red-500 text-slate-700" placeholder="0" />
                     </div>
                   </div>
                   <div>
                     <label className="text-[9px] font-bold text-slate-500 block mb-1 normal-case">Sisa kembalian wajib</label>
                     <div className="w-full p-2 bg-blue-50 border border-blue-200 rounded-xl font-extrabold text-xs text-center text-blue-700">
                        {formatRupiah(estimasiKembalian)}
                     </div>
                   </div>
                </div>

                <div className="p-2.5 border border-slate-200 rounded-xl bg-white flex justify-between items-center text-[9px] font-bold text-slate-400 normal-case">
                   <span>Jalur uang laci</span>
                   <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="bg-transparent border-none outline-none cursor-pointer text-slate-700 font-bold">
                     <option value="CASH">Cash / Tunai laci</option>
                     <option value="TF_BCA">TF Rek BCA pusat</option>
                     <option value="TF_BRI">TF Rek BRI pusat</option>
                   </select>
                </div>

                <button type="button" onClick={handleSubmitMultiOps} className="w-full btn-holo py-3.5 rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2">
                  <CheckCircle2 size={14}/> Potong kas &amp; simpan biaya
                </button>
              </div>
            </div>
          )}

          {/* FORM NOTA SUPPLIER BESAR */}
          {activeSubTab === 'SUPPLIER' && (
            <div className="card-holo overflow-hidden border-t-4 border-t-red-500 shadow-sm">
              <div className="p-5 border-b border-slate-100 bg-slate-50 font-bold text-xs flex items-center gap-2 text-slate-800 normal-case">
                <FileText size={16} className="text-red-600"/> Formulir nota supplier (Gudang pusat)
              </div>
              <form onSubmit={handleSubmitSupplier} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1 normal-case">Pilih rekanan supplier</label>
                    <select required value={formSupplier.supplierName} onChange={e=>setFormSupplier({...formSupplier, supplierName: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs cursor-pointer outline-none focus:border-red-500">
                      <option value="">-- Pilih supplier --</option>
                      {supplierOptions.map(s => <option key={s.id} value={s.supplier_name}>{s.supplier_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1 normal-case">Kategori barang</label>
                    <select value={formSupplier.category} onChange={e=>setFormSupplier({...formSupplier, category: e.target.value, qty: '', price: ''})} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs cursor-pointer outline-none focus:border-red-500">
                      <option value="BAHAN_BAKU">Bahan baku (Ayam)</option>
                      <option value="PACKAGING">Packaging / Mika</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 block mb-1 normal-case">Nama item / Deskripsi</label>
                  <input type="text" required value={formSupplier.itemName} onChange={e=>setFormSupplier({...formSupplier, itemName: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-red-500" placeholder="Cth: Daging fillet dada mentah" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1 normal-case">Volume beli (Kg)</label>
                    <input type="number" min="1" step="0.1" required value={formSupplier.qty} onChange={e=>setFormSupplier({...formSupplier, qty: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-sm text-center outline-none focus:border-red-500" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1 normal-case">Setara volume</label>
                    <div className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-center text-slate-600">
                      {formSupplier.category === 'BAHAN_BAKU' ? `${formatNumber(hitungKantongSupplier)} Kantong` : 'Pcs'}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 block mb-1 normal-case">Harga satuan (Per Kg)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-slate-400 text-xs">Rp</span>
                    <input type="text" required value={formSupplier.price ? Number(formSupplier.price).toLocaleString('id-ID') : ''} onChange={e=>setFormSupplier({...formSupplier, price: e.target.value.replace(/\D/g, '')})} className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-red-500" placeholder="0" />
                  </div>
                </div>
                <div className="bg-white border border-slate-200 p-4 rounded-xl flex justify-between items-center shadow-xs">
                  <span className="text-[9px] font-bold text-slate-400 normal-case">Total tagihan nota:</span>
                  <span className="text-xl font-black text-slate-800">{formatRupiah(totalTagihanSupplier)}</span>
                </div>
                <div className="p-4 border border-slate-200 rounded-2xl bg-white shadow-xs">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-[9px] font-bold text-slate-500 normal-case">Metode / Jalur bayar</label>
                    <div className="flex gap-1 bg-slate-100 border p-1 rounded-md">
                      <button type="button" onClick={() => setFormSupplier({...formSupplier, paymentType: 'TEMPO', dpAmount: ''})} className={`px-2 py-1.5 rounded-md text-[9px] font-bold ${formSupplier.paymentType === 'TEMPO' ? 'bg-white shadow-xs text-red-600' : 'text-slate-500'}`}>Tempo full</button>
                      <button type="button" onClick={() => setFormSupplier({...formSupplier, paymentType: 'DP'})} className={`px-2 py-1.5 rounded-md text-[9px] font-bold ${formSupplier.paymentType === 'DP' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-500'}`}>Bayar DP</button>
                      <button type="button" onClick={() => setFormSupplier({...formSupplier, paymentType: 'LUNAS', dpAmount: ''})} className={`px-2 py-1.5 rounded-md text-[9px] font-bold ${formSupplier.paymentType === 'LUNAS' ? 'bg-white shadow-xs text-emerald-600' : 'text-slate-500'}`}>Lunas full</button>
                    </div>
                  </div>
                  {formSupplier.paymentType !== 'TEMPO' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 border-t border-slate-100 pt-3">
                      <select value={formSupplier.paymentMethod} onChange={e=>setFormSupplier({...formSupplier, paymentMethod: e.target.value})} className="w-full p-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none cursor-pointer">
                        <option value="CASH">Laci kasir / Tunai</option>
                        <option value="TF_BCA">Transfer BCA pusat</option>
                        <option value="TF_BRI">Transfer BRI pusat</option>
                      </select>
                      {formSupplier.paymentType === 'DP' && (
                        <div className="relative">
                          <span className="absolute left-3 top-2 font-bold text-blue-600 text-xs">Rp</span>
                          <input type="text" required value={formSupplier.dpAmount ? Number(formSupplier.dpAmount).toLocaleString('id-ID') : ''} onChange={e=>setFormSupplier({...formSupplier, dpAmount: e.target.value.replace(/\D/g, '')})} className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-xl font-bold text-xs text-blue-700 outline-none focus:border-red-500" placeholder="Nominal DP..." />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button type="submit" className="w-full btn-holo py-3 rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={14}/> Simpan nota belanja supplier
                </button>
              </form>
            </div>
          )}
        </div>

        {/* JURNAL BUKU KAS GABUNGAN */}
        <div className="xl:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <div><h4 className="font-bold text-xs normal-case text-slate-800 flex items-center gap-2"><FileText size={16} className="text-red-600"/> Jurnal buku kas &amp; belanja</h4></div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs"><Calendar size={14} className="text-red-500"/><input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value || todayStr)} className="text-xs font-bold text-slate-700 outline-none cursor-pointer" /></div>
          </div>
          <div className="overflow-x-auto flex-1 p-1 custom-scrollbar min-h-[50vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/50 text-[10px] normal-case text-slate-400 border-b border-slate-200 sticky top-0 shadow-xs bg-white">
                <tr><th className="px-5 py-4">Bukti &amp; Ref</th><th className="px-5 py-4 min-w-[200px]">Detail transaksi</th><th className="px-5 py-4 text-right min-w-[180px]">Rincian nominal</th><th className="px-5 py-4 text-center">Jalur</th><th className="px-5 py-4 text-center">Tindakan</th></tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-100 bg-white">
                {historyCombined.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-20 text-slate-400 normal-case font-bold"><Wallet size={36} className="mx-auto mb-2 opacity-20"/>Tidak ada catatan kas keluar.</td></tr>
                ) : (
                  historyCombined.map(p => {
                    const isPurchase = p.doc_type === 'PURCHASE';
                    const totalBill = Number(p.total_amount || 0);
                    const paidAmt = Number(p.paid_amount || 0);
                    const isLunas = String(p.payment_status).toUpperCase() === 'LUNAS' || (totalBill - paidAmt) <= 0;
                    const pMethod = String(p.payment_method || 'CASH').replace('_', ' ');
                    const isAyam = String(p.unit).toLowerCase() === 'kantong';

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors bg-white">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-slate-800 font-bold text-sm">{formatDate(p.date)}</div>
                          <div className="text-[9px] font-mono text-slate-400 mt-0.5">{p.id}</div>
                          <span className={`text-[8px] font-bold normal-case mt-1 px-1.5 py-0.5 rounded border inline-block ${isPurchase ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{isPurchase ? 'Barang gudang' : 'Biaya ops'}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-800 text-xs normal-case mb-0.5">{p.title}</div>
                          <div className="text-[10px] text-slate-500 normal-case font-medium">{p.subtitle}</div>
                          {p.employee_name && <div className="text-[9px] font-bold text-slate-600 mt-1">PIC: {p.employee_name} <span className={p.change_status === 'PENDING' ? 'text-amber-600' : 'text-emerald-600'}>{p.change_status === 'PENDING' ? '(⏳ sisa kembalian gantung)' : '(✅ lunas balance)'}</span></div>}
                          <div className="text-[9px] text-slate-400 font-medium mt-0.5">Volume: {formatNumber(p.qty)} {p.unit} {isAyam && `(≈ ${formatNumber(p.qty * 10)} Kg ayam)`}</div>
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="text-slate-400 text-[10px] font-medium">Nota: {formatRupiah(totalBill)}</div>
                          <div className="text-slate-800 font-extrabold">Bayar: {formatRupiah(paidAmt)}</div>
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap"><span className={`px-2 py-0.5 rounded text-[8px] font-bold border ${isLunas ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{isLunas ? `Lunas (${pMethod.toLowerCase()})` : 'Tempo / DP'}</span></td>
                        <td className="px-5 py-4 text-center whitespace-nowrap opacity-50 hover:opacity-100"><button type="button" onClick={() => { if(window.confirm("Yakin void pembatalan data pengeluaran belanja ini?")) requestDelete(p.id); }} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={14}/></button></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
