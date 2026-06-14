import React, { useState, useMemo } from 'react';
import { 
  ShoppingBag, Calendar, FileText, Trash2, Printer, 
  Wallet, Truck, CheckCircle2, Plus, ShoppingCart, User
} from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

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
  karyawan = [], master_karyawan, // 🔥 AMBIL DARI MASTER SDM
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
  // STATE MULTI-ITEM KAS & OPS MANUAL (SULTAN ENGINE)
  // ==========================================
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [storeName, setStoreName] = useState('');
  const [cashGiven, setCashGiven] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  
  // Keranjang belanja sementara (Cart)
  const [cart, setCart] = useState([]);
  
  // Input selector item kas manual
  const [itemSelector, setItemSelector] = useState({
    category: 'BAHAN BAKU', itemName: '', unit: '', qty: '1', price: ''
  });

  const supplierOptions = useMemo(() => realSuppliers.filter(s => !s.isDeleted && String(s.isDeleted).toUpperCase() !== 'TRUE'), [realSuppliers]);
  const employeeOptions = useMemo(() => realKaryawan.filter(k => !k.isDeleted && String(k.isDeleted).toUpperCase() !== 'TRUE'), [realKaryawan]);

  const opsCategories = useMemo(() => {
    const validItems = realRawMaterials.filter(m => !m.isDeleted && String(m.isDeleted).toUpperCase() !== 'TRUE');
    const cats = [...new Set(validItems.map(m => m.category))];
    if (cats.length === 0) return ['BAHAN BAKU', 'KEMASAN', 'OPERASIONAL KENDARAAN', 'ATK & PERLENGKAPAN', 'AIR & KEBERSIHAN'];
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
        all.push({ doc_type: 'PURCHASE', id: p.id, date: p.date, branch_id: p.branch_id, title: p.supplier_name || p.supplierName || 'BELANJA KAS / SUPPLIER', subtitle: p.item_name || p.itemName, qty: p.qty, unit: p.unit, total_amount: Number(p.total_amount || p.amount || 0), paid_amount: Number(p.paid_amount || 0), payment_status: p.payment_status, payment_method: p.payment_method, employee_name: p.employee_name, change_status: p.change_status });
      }
    });
    realExpenses.forEach(e => {
      if (!e.isDeleted && String(e.isDeleted).toUpperCase() !== 'TRUE') {
        all.push({ doc_type: 'EXPENSE', id: e.id, date: e.date, branch_id: e.branch_id, title: e.category || 'BIAYA OPERASIONAL', subtitle: e.description || e.item_name || 'Beban Kas', qty: 1, unit: 'LOT', total_amount: Number(e.amount || 0), paid_amount: Number(e.amount || 0), payment_status: 'LUNAS', payment_method: e.payment_method || 'CASH', employee_name: e.employee_name, change_status: e.change_status });
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
      unit: itemSelector.unit || 'PCS',
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
      setItemSelector(prev => ({ ...prev, itemName: selectedName, unit: itemDef.unit || 'PCS', price: itemDef.default_price > 0 ? String(itemDef.default_price) : '' }));
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
      qty: finalQty, unit: formSupplier.category === 'BAHAN_BAKU' ? 'KANTONG' : 'PCS', price: finalPrice, 
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
  // ACTIONS: SUBMIT MULTI-ITEM KASBON ENGINE (EXECUTE)
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
    
    // Kirim item keranjang satu per satu secara pararel cerdas
    for (let item of cart) {
      const isBarangFisik = (item.category === 'BAHAN BAKU' || item.category === 'KEMASAN');
      const itemTrxId = generateId(isBarangFisik ? 'PO-KAS' : 'EXP', todayStr);

      if (isBarangFisik) {
        await sendToSheet('insert', {
          id: itemTrxId, date: todayStr, branch_id: currentBranch,
          supplier_name: storeName ? `TOKO ${storeName.toUpperCase()}` : 'BELANJA KAS MANUAL',
          item_name: item.itemName.toUpperCase(), qty: item.qty, unit: item.unit.toUpperCase(), price: item.price,
          total_amount: item.total, paid_amount: item.total, payment_status: 'LUNAS', payment_method: paymentMethod,
          employee_name: selectedEmployee.toUpperCase(), cash_given: cashGivenNum, expected_change: estimasiKembalian,
          change_status: hasKembalian ? 'PENDING' : 'SETTLED', kasbon_id: kasbonId, isDeleted: false
        }, 'purchases');

        await sendToSheet('insert', { 
          id: generateId('LAY', todayStr), date: todayStr, branch_id: currentBranch, category: item.category.replace(' ', '_'), 
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

    // POTONG DANA TUNAI SEBESAR UANG YANG DIKASIH OWNER (Rp 700.000)
    await sendToSheet('insert', {
      id: generateId('CFO', todayStr), date: todayStr, branch_id: currentBranch, type: 'OUT',
      category: 'KASBON BELANJA KARYAWAN', 
      description: `Kasbon Keluar ke ${selectedEmployee.toUpperCase()} (Nota: ${formatRupiah(totalTagihanCart)}, Titipan: ${formatRupiah(cashGivenNum)})`,
      amount: cashGivenNum, method: paymentMethod, reference_id: kasbonId
    }, 'cashflow_transactions');

    showToast(`Sukses mencatat kasbon ${selectedEmployee}. Menunggu sisa kembalian di setor!`, "success");
    setCart([]);
    setSelectedEmployee('');
    setStoreName('');
    setCashGiven('');
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* BANNER HEAD */}
      <div className="bg-[#151a25] rounded-3xl p-6 shadow-xl border border-slate-800 flex items-center gap-3 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-rose-500"></div>
        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20"><Wallet size={20} className="text-amber-400"/></div>
        <div>
          <h2 className="text-white font-black uppercase tracking-widest text-base">Kas Keluar &amp; Belanja</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Satu pintu utama pengeluaran kas internal dan pembayaran nota supplier pabrik.</p>
        </div>
      </div>

      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl border w-fit">
        <button onClick={() => setActiveTab('MANUAL')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeSubTab === 'MANUAL' ? 'bg-white text-rose-600 shadow-sm border' : 'text-slate-500 hover:text-slate-800'}`}><Wallet size={14}/> Kas &amp; Ops Manual (Multi-Item)</button>
        <button onClick={() => setActiveTab('SUPPLIER')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeSubTab === 'SUPPLIER' ? 'bg-white text-blue-600 shadow-sm border' : 'text-slate-500 hover:text-slate-800'}`}><Truck size={14}/> Nota Supplier Besar</button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: FORM INPUT */}
        <div className="xl:col-span-5 flex flex-col gap-6">

          {/* 🔥 FORM KAS & OPS MANUAL: UPGRADE MULTI-ITEM KERANJANG SULTAN */}
          {activeSubTab === 'MANUAL' && (
            <div className="bg-white rounded-3xl border border-rose-200 shadow-sm overflow-hidden animate-in slide-in-from-left-4 duration-300">
              <div className="p-5 border-b bg-rose-50 font-black text-xs uppercase tracking-widest flex items-center gap-2 text-rose-700">
                <ShoppingCart size={16} className="text-rose-600"/> Formulir Pengeluaran Kas (Multi-Item)
              </div>
              <div className="p-5 space-y-4">
                
                {/* PILIHAN KARYAWAN PENERIMA UANG */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1 flex items-center gap-1"><User size={10}/> Karyawan Pembawa Uang</label>
                    <select 
                      required 
                      value={selectedEmployee} 
                      onChange={e=>setSelectedEmployee(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-black text-[10px] outline-none cursor-pointer uppercase"
                    >
                      <option value="">-- PILIH KARYAWAN --</option>
                      {employeeOptions.map(emp => <option key={hist.id || emp.id} value={emp.name}>{emp.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Nama Toko / Warung</label>
                    <input type="text" value={storeName} onChange={e=>setStoreName(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold uppercase text-[10px] outline-none" placeholder="WARUNG MADURA, ACENG, DLL" />
                  </div>
                </div>

                {/* AREA PEMILIHAN BARANG KE KERANJANG */}
                <div className="border border-rose-100 p-3.5 rounded-2xl bg-rose-50/20 space-y-3">
                  <div className="text-[9px] font-black text-rose-700 uppercase tracking-widest border-b border-rose-100 pb-1.5 flex items-center gap-1">➕ Selector Input Item Belanja</div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <select value={itemSelector.category} onChange={e=>setItemSelector({...itemSelector, category: e.target.value, itemName: '', unit: '', price: ''})} className="w-full p-2 bg-white border rounded-xl font-black text-[10px] outline-none uppercase">
                        {opsCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div>
                       <select value={itemSelector.itemName} onChange={handleOpsItemSelect} className="w-full p-2 bg-white border border-rose-200 rounded-xl font-black text-[10px] text-rose-700 outline-none uppercase">
                          <option value="">-- PILIH ITEM --</option>
                          {realRawMaterials.filter(m => !m.isDeleted && m.category === itemSelector.category).map(item => (
                            <option key={item.id} value={item.item_name}>{item.item_name}</option>
                          ))}
                       </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Jumlah</label>
                      <input type="number" min="0.1" step="0.1" value={itemSelector.qty} onChange={e=>setItemSelector({...itemSelector, qty: e.target.value})} className="w-full p-2 bg-white border rounded-xl text-center font-black text-xs outline-none" />
                    </div>
                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Satuan</label>
                      <input type="text" value={itemSelector.unit} onChange={e=>setItemSelector({...itemSelector, unit: e.target.value})} className="w-full p-2 bg-slate-50 border text-center font-black text-xs text-slate-500 rounded-xl uppercase" placeholder="Auto" />
                    </div>
                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Harga/Satuan</label>
                      <input type="number" value={itemSelector.price} onChange={e=>setItemSelector({...itemSelector, price: e.target.value})} className="w-full p-2 bg-white border rounded-xl text-right font-black text-xs outline-none" placeholder="0" />
                    </div>
                  </div>

                  <button type="button" onClick={handleAddItemToCart} className="w-full bg-rose-700 text-white text-[9px] font-black uppercase tracking-widest py-2 rounded-xl hover:bg-rose-800 transition shadow-sm">
                     + Masukkan Keranjang
                  </button>
                </div>

                {/* LIST TAMPILAN KERANJANG BELANJA AKTUAL */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-inner bg-slate-50">
                  <div className="bg-slate-200/60 p-2 text-[9px] font-black uppercase text-slate-600 tracking-wider flex justify-between">
                     <span>🛒 Keranjang Belanja Karyawan</span>
                     <span>{cart.length} Item</span>
                  </div>
                  <div className="max-h-[18vh] overflow-y-auto divide-y divide-slate-200 font-bold text-[11px]">
                     {cart.length === 0 ? (
                       <div className="p-6 text-center text-slate-400 uppercase text-[9px] font-black tracking-widest">Keranjang masih kosong</div>
                     ) : (
                       cart.map(item => (
                         <div key={item.cart_id} className="p-2.5 flex justify-between items-center bg-white hover:bg-slate-50">
                            <div>
                              <div className="uppercase text-slate-800 font-black">{item.itemName}</div>
                              <div className="text-[9px] text-slate-400">{item.qty} {item.unit} x {formatRupiah(item.price)}</div>
                            </div>
                            <div className="flex items-center gap-3">
                               <span className="text-slate-900 font-black">{formatRupiah(item.total)}</span>
                               <button type="button" onClick={()=>handleRemoveFromCart(item.cart_id)} className="text-rose-500 hover:text-rose-700"><Trash2 size={12}/></button>
                            </div>
                         </div>
                       ))
                     )}
                  </div>
                  <div className="bg-slate-900 text-white p-3.5 flex justify-between items-center font-black">
                     <span className="text-[10px] text-emerald-400 uppercase">TOTAL NOTA AKTUAL:</span>
                     <span className="text-lg text-emerald-400">{formatRupiah(totalTagihanCart)}</span>
                  </div>
                </div>

                {/* SINKRONISASI KAS KELUAR & ESTIMASI KEMBALIAN */}
                <div className="bg-slate-100 border p-3.5 rounded-2xl grid grid-cols-2 gap-3 shadow-inner">
                   <div>
                     <label className="text-[9px] font-black text-slate-600 uppercase block mb-1">Uang Kas Diberikan Owner</label>
                     <div className="relative">
                       <span className="absolute left-3 top-2.5 font-black text-slate-400 text-xs">Rp</span>
                       <input type="text" required value={cashGiven ? Number(cashGiven).toLocaleString('id-ID') : ''} onChange={e=>setCashGiven(e.target.value.replace(/\D/g, ''))} className="w-full pl-8 pr-2 py-2 border rounded-xl font-black text-sm bg-white outline-none focus:border-rose-400 text-slate-800" placeholder="Cth: 700.000" />
                     </div>
                   </div>
                   <div>
                     <label className="text-[9px] font-black text-blue-600 uppercase block mb-1">Estimasi Kembalian Wajib</label>
                     <div className="w-full p-2.5 bg-blue-50 border border-blue-200 rounded-xl font-black text-sm text-center text-blue-700">
                        {formatRupiah(estimasiKembalian)}
                     </div>
                   </div>
                </div>

                <div className="p-3 border rounded-xl bg-white flex justify-between items-center text-[9px] font-black uppercase text-slate-500">
                   <span>Jalur Uang Laci</span>
                   <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="p-1 bg-transparent border-none outline-none cursor-pointer text-slate-800 font-black">
                     <option value="CASH">CASH / TUNAI LACI</option>
                     <option value="TF_BCA">TF REK BCA PUSAT</option>
                     <option value="TF_BRI">TF REK BRI PUSAT</option>
                   </select>
                </div>

                <button type="button" onClick={handleSubmitMultiOps} className="w-full bg-rose-600 text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-widest shadow-lg hover:bg-rose-700 transition active:scale-95 flex items-center justify-center gap-2">
                  <CheckCircle2 size={16}/> Potong Kas &amp; Simpan Biaya
                </button>
              </div>
            </div>
          )}

          {/* FORM NOTA SUPPLIER BESAR (AYAM BESAR) */}
          {activeSubTab === 'SUPPLIER' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-right-4 duration-300">
              <div className="p-5 border-b bg-slate-50 font-black text-xs uppercase tracking-widest flex items-center gap-2 text-slate-700">
                <FileText size={16} className="text-blue-600"/> Formulir Nota Supplier (Gudang)
              </div>
              <form onSubmit={handleSubmitSupplier} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-emerald-700 uppercase block mb-1">Pilih Rekanan Supplier</label>
                    <select required value={formSupplier.supplierName} onChange={e=>setFormSupplier({...formSupplier, supplierName: e.target.value})} className="w-full p-3 bg-emerald-50/50 border border-emerald-300 rounded-xl font-black text-xs cursor-pointer outline-none focus:bg-white focus:border-emerald-500 shadow-sm">
                      <option value="">-- PILIH SUPPLIER --</option>
                      {supplierOptions.map(s => <option key={s.id} value={s.supplier_name}>{s.supplier_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Kategori Barang</label>
                    <select value={formSupplier.category} onChange={e=>setFormSupplier({...formSupplier, category: e.target.value, qty: '', price: ''})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-xs cursor-pointer outline-none">
                      <option value="BAHAN_BAKU">BAHAN BAKU (AYAM)</option>
                      <option value="PACKAGING">PACKAGING / MIKA</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Nama Item / Deskripsi</label>
                  <input type="text" required value={formSupplier.itemName} onChange={e=>setFormSupplier({...formSupplier, itemName: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase text-xs outline-none focus:bg-white" placeholder="Cth: DAGING FILLET DADA" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Volume Beli (KG)</label>
                    <input type="number" min="1" step="0.1" required value={formSupplier.qty} onChange={e=>setFormSupplier({...formSupplier, qty: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm text-center outline-none focus:bg-white" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-blue-600 uppercase block mb-1">Setara (Kantong)</label>
                    <div className="w-full p-3 bg-blue-50 border border-blue-200 rounded-xl font-black text-sm text-center text-blue-700">
                      {formSupplier.category === 'BAHAN_BAKU' ? `${formatNumber(hitungKantongSupplier)} KTG` : 'PCS'}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Harga Per Satuan (Per KG)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 font-black text-slate-400 text-sm">Rp</span>
                    <input type="text" required value={formSupplier.price ? Number(formSupplier.price).toLocaleString('id-ID') : ''} onChange={e=>setFormSupplier({...formSupplier, price: e.target.value.replace(/\D/g, '')})} className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm outline-none focus:bg-white" placeholder="0" />
                  </div>
                </div>
                <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center shadow-inner">
                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Total Tagihan Nota:</span>
                  <span className="text-xl font-black text-emerald-400">{formatRupiah(totalTagihanSupplier)}</span>
                </div>
                <div className="p-4 border border-slate-200 rounded-2xl bg-slate-50 shadow-inner">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Metode / Jalur Bayar</label>
                    <div className="flex gap-1 bg-slate-200/60 p-1 rounded-lg">
                      <button type="button" onClick={() => setFormSupplier({...formSupplier, paymentType: 'TEMPO', dpAmount: ''})} className={`px-2 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest ${formSupplier.paymentType === 'TEMPO' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500'}`}>TEMPO FULL</button>
                      <button type="button" onClick={() => setFormSupplier({...formSupplier, paymentType: 'DP'})} className={`px-2 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest ${formSupplier.paymentType === 'DP' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>BAYAR DP</button>
                      <button type="button" onClick={() => setFormSupplier({...formSupplier, paymentType: 'LUNAS', dpAmount: ''})} className={`px-2 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest ${formSupplier.paymentType === 'LUNAS' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}>LUNAS FULL</button>
                    </div>
                  </div>
                  {formSupplier.paymentType !== 'TEMPO' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 border-t border-slate-200 pt-3">
                      <select value={formSupplier.paymentMethod} onChange={e=>setFormSupplier({...formSupplier, paymentMethod: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl text-[10px] font-black uppercase outline-none cursor-pointer bg-white">
                        <option value="CASH">LACI KASIR / TUNAI</option>
                        <option value="TF_BCA">TRANSFER BCA PUSAT</option>
                        <option value="TF_BRI">TRANSFER BRI PUSAT</option>
                      </select>
                      {formSupplier.paymentType === 'DP' && (
                        <div className="relative">
                          <span className="absolute left-3 top-3.5 font-black text-blue-500 text-xs">Rp</span>
                          <input type="text" required value={formSupplier.dpAmount ? Number(formSupplier.dpAmount).toLocaleString('id-ID') : ''} onChange={e=>setFormSupplier({...formSupplier, dpAmount: e.target.value.replace(/\D/g, '')})} className="w-full pl-9 pr-3 py-3 border-2 border-blue-200 rounded-xl font-black text-sm text-blue-700 bg-white outline-none" placeholder="Nominal DP..." />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg hover:bg-slate-800 flex items-center justify-center gap-2 mt-2">
                  <CheckCircle2 size={16}/> Simpan Nota Belanja Supplier
                </button>
              </form>
            </div>
          )}
        </div>

        {/* JURNAL BUKU KAS GABUNGAN */}
        <div className="xl:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <div><h4 className="font-black text-xs uppercase text-slate-800 tracking-widest flex items-center gap-2"><FileText size={16} className="text-blue-600"/> Jurnal Buku Kas &amp; Belanja</h4></div>
            <div className="flex items-center gap-2 bg-white border px-3 py-2 rounded-xl shadow-sm"><Calendar size={14} className="text-blue-500"/><input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value || todayStr)} className="text-xs font-black text-slate-800 outline-none cursor-pointer" /></div>
          </div>
          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar min-h-[50vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-white text-[10px] uppercase text-slate-400 border-b sticky top-0 shadow-sm">
                <tr><th className="px-5 py-4">Bukti &amp; Ref</th><th className="px-5 py-4 min-w-[200px]">Detail Transaksi</th><th className="px-5 py-4 text-right min-w-[180px]">Rincian Nominal</th><th className="px-5 py-4 text-center">Jalur</th><th className="px-5 py-4 text-center">Tindakan</th></tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-50">
                {historyCombined.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-20 text-slate-400 font-black uppercase"><Wallet size={40} className="mx-auto mb-2 opacity-20"/>Tidak ada catatan kas keluar.</td></tr>
                ) : (
                  historyCombined.map(p => {
                    const isPurchase = p.doc_type === 'PURCHASE';
                    const totalBill = Number(p.total_amount || 0);
                    const paidAmt = Number(p.paid_amount || 0);
                    const isLunas = String(p.payment_status).toUpperCase() === 'LUNAS' || (totalBill - paidAmt) <= 0;
                    const pMethod = String(p.payment_method || 'CASH').replace('_', ' ');
                    const isAyam = String(p.unit).toUpperCase() === 'KANTONG';

                    return (
                      <tr key={p.id} className={`transition-colors ${isPurchase ? 'hover:bg-amber-50/20' : 'hover:bg-rose-50/20'}`}>
                        <td className="px-5 py-4">
                          <div className="text-slate-800 font-black text-sm">{formatDate(p.date)}</div>
                          <div className="text-[9px] font-mono text-slate-400 mt-1">{p.id}</div>
                          <span className={`text-[7px] font-black uppercase mt-1 px-1.5 py-0.5 rounded border inline-block ${isPurchase ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>{isPurchase ? 'ASET / BARANG' : 'BEBAN OPS'}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-black text-blue-700 text-xs uppercase mb-0.5">{p.title}</div>
                          <div className="text-[10px] text-slate-700 uppercase font-black">{p.subtitle}</div>
                          {p.employee_name && <div className="text-[9px] font-black text-indigo-600 mt-1">PIC JALAN: {p.employee_name} {p.change_status === 'PENDING' ? '(⏳ KEMBALIAN BELUM DISETOR)' : '(✅ SETTLED)'}</div>}
                          <div className="text-[9px] text-slate-400 mt-0.5">Volume: {formatNumber(p.qty)} {p.unit} {isAyam && `(≈ ${formatNumber(p.qty * 10)} KG)`}</div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="text-slate-500">Total: {formatRupiah(totalBill)}</div>
                          <div className="text-rose-600 text-[10px]">Bayar: {formatRupiah(paidAmt)}</div>
                        </td>
                        <td className="px-5 py-4 text-center"><span className={`px-2 py-0.5 rounded text-[8px] font-black border ${isLunas ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{isLunas ? `LUNAS (${pMethod})` : 'TEMPO/DP'}</span></td>
                        <td className="px-5 py-4 text-center opacity-40 hover:opacity-100"><button type="button" onClick={() => { if(window.confirm("Void data belanja?")) requestDelete(p.id); }} className="p-2 text-slate-500 hover:text-rose-600"><Trash2 size={14}/></button></td>
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
