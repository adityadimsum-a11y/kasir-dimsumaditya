import React, { useState, useMemo } from 'react';
import { 
  ShoppingBag, Calendar, FileText, Trash2, Printer, 
  Wallet, Truck, CheckCircle2, Plus, ShoppingCart, User,
  Database, Edit2
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
  inventoryCostLayers = [], inventory_cost_layers,
  expenses = [], expenses_data, 
  masterSuppliers = [], master_suppliers, 
  masterRawMaterials = [], master_raw_materials, 
  karyawan = [], master_karyawan, 
  sendToSheet, showToast, user, requestDelete, setPrintData
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realSuppliers = useMemo(() => master_suppliers || masterSuppliers || [], [master_suppliers, masterSuppliers]);
  const realRawMaterials = useMemo(() => master_raw_materials || masterRawMaterials || [], [master_raw_materials, masterRawMaterials]);
  const realKaryawan = useMemo(() => master_karyawan || karyawan || [], [karyawan, master_karyawan]);
  const realInventory = useMemo(() => inventory_cost_layers || inventoryCostLayers || [], [inventory_cost_layers, inventoryCostLayers]);

  const [activeSubTab, setActiveTab] = useState('SUPPLIER'); 
  const [tableDateFilter, setTableDateFilter] = useState(todayStr);
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);

  // ==========================================
  // MONITOR STOK GUDANG (LIVE)
  // ==========================================
  const stockGudang = useMemo(() => {
    let ayamKantong = 0;
    realInventory.forEach(inv => {
      if (inv.isDeleted || (inv.branch_id !== currentBranch && currentBranch !== 'TANGERANG_PUSAT')) return;
      if (inv.category === 'BAHAN_BAKU') ayamKantong += Number(inv.qty_remaining || 0);
    });
    return { ayamKantong, ayamKg: ayamKantong * 10 };
  }, [realInventory, currentBranch]);

  // ==========================================
  // FORM SUPPLIER AYAM BESAR (RE-DESIGN SULTAN)
  // ==========================================
  const [formSupplier, setFormSupplier] = useState({ supplierName: '', itemName: 'Daging fillet dada mentah', qty: '', price: '' });
  
  // LOGIKA PEMBAYARAN MIX / SPLIT ALA KASIR
  const [splIsSplit, setSplIsSplit] = useState(false);
  const [splPayCash, setSplPayCash] = useState('');
  const [splPayBCA, setSplPayBCA] = useState('');
  const [splPayBRI, setSplPayBRI] = useState('');
  const [splSingleMethod, setSplSingleMethod] = useState('PIUTANG'); // CASH, TF_BCA_PUSAT, TF_BRI_PUSAT, DP_PIUTANG, PIUTANG
  const [splDpMethod, setSplDpMethod] = useState('CASH');
  const [splSingleAmount, setSplSingleAmount] = useState('');

  // ==========================================
  // STATE MULTI-ITEM KAS & OPS MANUAL
  // ==========================================
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [storeName, setStoreName] = useState('');
  const [cashGiven, setCashGiven] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [cart, setCart] = useState([]);
  const [itemSelector, setItemSelector] = useState({ category: 'Bahan Baku', itemName: '', unit: '', qty: '1', price: '' });

  const supplierOptions = useMemo(() => realSuppliers.filter(s => !s.isDeleted && String(s.isDeleted).toUpperCase() !== 'TRUE'), [realSuppliers]);
  const employeeOptions = useMemo(() => realKaryawan.filter(k => !k.isDeleted && String(k.isDeleted).toUpperCase() !== 'TRUE'), [realKaryawan]);

  const opsCategories = useMemo(() => {
    const validItems = realRawMaterials.filter(m => !m.isDeleted && String(m.isDeleted).toUpperCase() !== 'TRUE');
    const cats = [...new Set(validItems.map(m => m.category))];
    if (cats.length === 0) return ['Bahan Baku', 'Kemasan', 'Operasional Kendaraan', 'ATK & Perlengkapan', 'Air & Kebersihan'];
    return cats;
  }, [realRawMaterials]);

  // KALKULASI SUPPLIER
  const hitungKantongSupplier = useMemo(() => Number(formSupplier.qty || 0) / 10, [formSupplier.qty]);
  const totalTagihanSupplier = useMemo(() => Number(formSupplier.qty || 0) * Number(formSupplier.price || 0), [formSupplier.qty, formSupplier.price]);
  
  // PEMBAYARAN SUPPLIER SUMMARY
  const splPaymentSummary = useMemo(() => {
    let cash = 0, bca = 0, bri = 0;
    if (splIsSplit) {
      cash = Number(splPayCash || 0); bca = Number(splPayBCA || 0); bri = Number(splPayBRI || 0);
    } else {
      const amt = Number(splSingleAmount || 0);
      if (splSingleMethod === 'CASH') cash = amt;
      else if (splSingleMethod === 'TF_BCA_PUSAT') bca = amt;
      else if (splSingleMethod === 'TF_BRI_PUSAT') bri = amt;
      else if (splSingleMethod === 'DP_PIUTANG') {
        if (splDpMethod === 'CASH') cash = amt; else if (splDpMethod === 'TF_BCA_PUSAT') bca = amt; else if (splDpMethod === 'TF_BRI_PUSAT') bri = amt;
      }
    }

    let totalMasuk = cash + bca + bri;
    let sisaHutang = Math.max(0, totalTagihanSupplier - totalMasuk);

    let methods = []; let breakdown = [];
    if (cash > 0) { methods.push('CASH'); breakdown.push({ method: 'CASH', amount: cash }); }
    if (bca > 0) { methods.push('BCA'); breakdown.push({ method: 'TF_BCA_PUSAT', amount: bca }); }
    if (bri > 0) { methods.push('BRI'); breakdown.push({ method: 'TF_BRI_PUSAT', amount: bri }); }

    let methodStr = splIsSplit ? `MIX (${methods.join('+')})` : splSingleMethod;
    if (sisaHutang > 0 && totalMasuk > 0) methodStr = splIsSplit ? `DP_MIX+HUTANG` : `DP_${splDpMethod}+HUTANG`;
    if (sisaHutang === totalTagihanSupplier) methodStr = 'HUTANG_TEMPO';

    return { totalMasuk, sisaHutang, methodStr, breakdown };
  }, [splIsSplit, splPayCash, splPayBCA, splPayBRI, splSingleMethod, splSingleAmount, splDpMethod, totalTagihanSupplier]);

  const setLunasOtomatisSupplier = (e) => {
    e.preventDefault();
    if (splIsSplit) { setSplPayCash(String(totalTagihanSupplier)); setSplPayBCA(''); setSplPayBRI(''); } 
    else setSplSingleAmount(String(totalTagihanSupplier));
  };

  // KALKULASI CART MANUAL
  const totalTagihanCart = useMemo(() => cart.reduce((sum, item) => sum + item.total, 0), [cart]);
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
        all.push({ doc_type: 'PURCHASE', id: p.id, date: p.date, branch_id: p.branch_id, title: p.supplier_name || p.supplierName || 'Belanja kas / supplier', subtitle: p.item_name || p.itemName, qty: p.qty, unit: p.unit, price: p.price, total_amount: Number(p.total_amount || p.amount || 0), paid_amount: Number(p.paid_amount || 0), payment_status: p.payment_status, payment_method: p.payment_method, employee_name: p.employee_name, change_status: p.change_status });
      }
    });
    realExpenses.forEach(e => {
      if (!e.isDeleted && String(e.isDeleted).toUpperCase() !== 'TRUE') {
        all.push({ doc_type: 'EXPENSE', id: e.id, date: e.date, branch_id: e.branch_id, title: e.category || 'Biaya operasional', subtitle: e.description || e.item_name || 'Beban kas', qty: 1, unit: 'Lot', total_amount: Number(e.amount || 0), paid_amount: Number(e.amount || 0), payment_status: 'LUNAS', payment_method: e.payment_method || 'CASH', employee_name: e.employee_name, change_status: e.change_status });
      }
    });
    return all.filter(x => normalizeDateStr(x.date) === tableDateFilter && (currentBranch === 'TANGERANG_PUSAT' ? String(x.branch_id || '').toUpperCase().includes('TANGERANG') : String(x.branch_id || '').toUpperCase() === currentBranch.toUpperCase())).sort((a, b) => new Date(normalizeDateStr(b.date)) - new Date(normalizeDateStr(a.date)));
  }, [realPurchases, realExpenses, tableDateFilter, currentBranch]);

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleSupplierSelect = (e) => {
    const splName = e.target.value;
    const splData = supplierOptions.find(s => s.supplier_name === splName);
    setFormSupplier(prev => ({ 
       ...prev, 
       supplierName: splName, 
       price: splData && splData.default_price ? String(splData.default_price) : '' 
    }));
  };

  const handleAddItemToCart = () => {
    if (!itemSelector.itemName) return alert("Pilih item terlebih dahulu!");
    if (Number(itemSelector.qty) <= 0 || Number(itemSelector.price) <= 0) return alert("Jumlah dan harga harus lebih dari 0!");

    const newItem = {
      cart_id: 'CART-' + new Date().getTime(), category: itemSelector.category, itemName: itemSelector.itemName,
      unit: itemSelector.unit || 'Pcs', qty: Number(itemSelector.qty), price: Number(itemSelector.price), total: Number(itemSelector.qty) * Number(itemSelector.price)
    };

    setCart(prev => [...prev, newItem]);
    setItemSelector(prev => ({ ...prev, itemName: '', qty: '1', price: '', unit: '' }));
  };

  const handleRemoveFromCart = (cartId) => setCart(prev => prev.filter(item => item.cart_id !== cartId));

  const handleOpsItemSelect = (e) => {
    const selectedName = e.target.value;
    const itemDef = realRawMaterials.find(i => !i.isDeleted && i.category === itemSelector.category && i.item_name === selectedName);
    if (itemDef) setItemSelector(prev => ({ ...prev, itemName: selectedName, unit: itemDef.unit || 'Pcs', price: itemDef.default_price > 0 ? String(itemDef.default_price) : '' }));
    else setItemSelector(prev => ({ ...prev, itemName: selectedName }));
  };

  // SUBMIT FORM SUPPLIER BESAR (AYAM) - ALGORITMA BARU
  const handleSubmitSupplier = async (e) => {
    e.preventDefault();
    if (!formSupplier.supplierName) return alert("Pilih nama Supplier rekanan resmi terlebih dahulu!");
    if (totalTagihanSupplier <= 0) return alert("Total tagihan nol! Masukkan volume dan harga yang benar.");

    const purchaseId = editingPurchaseId ? editingPurchaseId : generateId('PO-DMA', todayStr);
    
    // 🔥 PERBAIKAN LOGIKA: Simpan murni dalam Kg dan Harga per Kg
    const finalQtyKg = Number(formSupplier.qty); 
    const finalPricePerKg = Number(formSupplier.price);
    
    if (!window.confirm(`${editingPurchaseId ? 'Revisi Nota Supplier' : 'Sahkan Nota Belanja Supplier'} senilai ${formatRupiah(totalTagihanSupplier)}? Stok Gudang akan bertambah otomatis.`)) return;

    const payloadPurchase = {
      id: purchaseId, date: todayStr, branch_id: currentBranch,
      supplier_name: formSupplier.supplierName.toUpperCase(), item_name: formSupplier.itemName.toUpperCase(), 
      qty: finalQtyKg, unit: 'Kg', price: finalPricePerKg, // Simpan sbg Kg
      total_amount: totalTagihanSupplier, paid_amount: splPaymentSummary.totalMasuk, payment_status: splPaymentSummary.sisaHutang <= 0 ? 'LUNAS' : 'BELUM_LUNAS',
      payment_method: splPaymentSummary.methodStr, isDeleted: false
    };

    const actionType = editingPurchaseId ? 'update' : 'insert';
    const isSuccess = await sendToSheet(actionType, payloadPurchase, 'purchases');
    
    if (isSuccess) {
      // Input inventory
      if (!editingPurchaseId) {
         // 🔥 PERBAIKAN LOGIKA: Inventory tetap simpan sebagai Kantong
         await sendToSheet('insert', { id: generateId('LAY', todayStr), date: todayStr, branch_id: currentBranch, category: 'BAHAN_BAKU', item_name: `BELANJA: ${formSupplier.itemName.toUpperCase()} (${formSupplier.supplierName.toUpperCase()})`, qty_received: hitungKantongSupplier, qty_remaining: hitungKantongSupplier, unit_cost: finalPricePerKg * 10, reference_id: payloadPurchase.id, isDeleted: false }, 'inventory_cost_layers');
         // Input Cashflow
         for (let pay of splPaymentSummary.breakdown) {
            if (pay.amount <= 0) continue;
            await sendToSheet('insert', { id: generateId('CFO', todayStr), date: todayStr, branch_id: currentBranch, type: 'OUT', category: 'BELANJA LOGISTIK', description: `Pembayaran ${formSupplier.itemName.toUpperCase()} ke ${formSupplier.supplierName.toUpperCase()}`, amount: pay.amount, method: pay.method, reference_id: payloadPurchase.id }, 'cashflow_transactions');
         }
      }
      showToast(editingPurchaseId ? "Revisi Belanja Berhasil!" : "Nota Belanja Supplier Berhasil Disimpan!", "success");
      setFormSupplier({ supplierName: '', itemName: 'Daging fillet dada mentah', qty: '', price: '' });
      setSplSingleAmount(''); setSplPayCash(''); setSplPayBCA(''); setSplPayBRI(''); setEditingPurchaseId(null);
    }
  };

  const handleEditPurchase = (p) => {
     if (!window.confirm("Tarik nota belanja ini untuk direvisi? Pastikan Anda mengecek ulang nilai yang dimasukkan.")) return;
     setEditingPurchaseId(p.id);
     setActiveTab('SUPPLIER');
     
     // Logika konversi aman untuk data lama yg mungkin pakai Kantong
     const isKg = String(p.unit).toLowerCase() === 'kg';
     const convertedQty = isKg ? p.qty : String(Number(p.qty) * 10);
     const convertedPrice = isKg ? p.price : String(Number(p.total_amount) / (Number(p.qty) * 10));

     setFormSupplier({
        supplierName: p.title, itemName: p.subtitle, 
        qty: convertedQty, 
        price: convertedPrice > 0 ? convertedPrice : '0'
     });
     setSplSingleAmount(String(p.paid_amount));
     window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    setCart([]); setSelectedEmployee(''); setStoreName(''); setCashGiven('');
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-200">
      
      {/* 🔥 BANNER KARTU STOK GUDANG AYAM (NEW) - FIXED TITLE */}
      <div className="card-holo p-6 shadow-xs flex items-center gap-3 relative overflow-hidden bg-white border border-slate-200 rounded-2xl">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0"><Truck size={18} className="text-blue-600"/></div>
        <div className="flex-1">
          <h2 className="text-slate-800 font-extrabold normal-case text-base">Belanja &amp; Pembayaran Supplier</h2>
          <p className="text-[10px] text-slate-500 font-medium normal-case mt-0.5">Satu pintu utama pengeluaran kas internal dan pembayaran nota supplier pabrik.</p>
        </div>
      </div>

      <div className="card-holo p-5 bg-white border border-slate-200 rounded-2xl shadow-sm border-t-4 border-t-red-500 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-4">
        <div>
           <h2 className="text-sm font-extrabold normal-case text-slate-800 flex items-center gap-2"><Database size={16} className="text-red-600"/> Papan Monitor Sisa Stok Daging Ayam</h2>
           <p className="text-[10px] text-slate-500 font-bold mt-0.5 normal-case">Cek ketersediaan aktual di Gudang Utama sebelum melakukan belanja ke Mitra Supplier.</p>
        </div>
        <div className="flex gap-4">
           <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-center shadow-inner">
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sisa Gudang (Kantong)</div>
              <div className={`text-xl font-black ${stockGudang.ayamKantong <= 0 ? 'text-red-600' : 'text-slate-800'}`}>{formatNumber(stockGudang.ayamKantong)} <span className="text-[10px] text-slate-500 font-medium">Kantong</span></div>
           </div>
           <div className="bg-red-50 border border-red-200 px-4 py-2 rounded-xl text-center shadow-inner">
              <div className="text-[9px] font-bold text-red-400 uppercase tracking-widest">Setara Kilogram (Kg)</div>
              <div className={`text-xl font-black ${stockGudang.ayamKg <= 0 ? 'text-red-600' : 'text-red-700'}`}>{formatNumber(stockGudang.ayamKg)} <span className="text-[10px] text-red-500 font-medium">Kg</span></div>
           </div>
        </div>
      </div>

      {/* SUB TAB SELECTOR */}
      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-fit shadow-inner">
        <button onClick={() => setActiveTab('MANUAL')} className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 ${activeSubTab === 'MANUAL' ? 'bg-white text-red-600 shadow-xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}><Wallet size={12}/> Kas &amp; ops manual</button>
        <button onClick={() => setActiveTab('SUPPLIER')} className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2 ${activeSubTab === 'SUPPLIER' ? 'bg-white text-blue-600 shadow-xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}><Truck size={12}/> Nota supplier besar</button>
      </div>

      {editingPurchaseId && (
        <div className="bg-orange-600 text-white font-black text-xs p-4 rounded-xl shadow-md animate-bounce flex justify-between items-center shrink-0">
          <span>⚠️ ANDA SEDANG DALAM MODE REVISI NOTA BELANJA. KLIK BATAL JIKA INGIN KEMBALI.</span>
          <button onClick={() => { setEditingPurchaseId(null); setFormSupplier({ supplierName: '', itemName: 'Daging fillet dada mentah', qty: '', price: '' }); }} className="bg-white text-orange-700 px-3 py-1 rounded-lg font-black uppercase tracking-wider cursor-pointer">Batal Revisi</button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: FORM INPUT */}
        <div className="xl:col-span-5 flex flex-col gap-6">

          {/* FORM KAS & OPS MANUAL */}
          {activeSubTab === 'MANUAL' && (
            <div className="card-holo overflow-hidden border-t-4 border-t-red-500 shadow-sm animate-in slide-in-from-left-2">
              <div className="p-5 border-b border-slate-100 bg-slate-50 font-bold text-xs flex items-center gap-2 text-slate-800 normal-case">
                <ShoppingCart size={16} className="text-red-600"/> Formulir pengeluaran kas (Multi-item)
              </div>
              <div className="p-5 space-y-4">
                
                {/* PIC KARYAWAN & WARUNG */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 p-3 rounded-2xl shadow-inner">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1 normal-case flex items-center gap-1"><User size={10}/> Karyawan pembawa uang</label>
                    <select required value={selectedEmployee} onChange={e=>setSelectedEmployee(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-[10px] outline-none cursor-pointer">
                      <option value="">-- Pilih karyawan --</option>
                      {employeeOptions.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1 normal-case">Nama toko / Warung</label>
                    <input type="text" value={storeName} onChange={e=>setStoreName(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-[10px] outline-none" placeholder="Cth: Warung Madura, Toko Aceng" />
                  </div>
                </div>

                {/* SELECTOR ITEM */}
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

                {/* KERANJANG */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-inner bg-slate-50">
                  <div className="bg-slate-100 p-2.5 text-[9px] font-bold text-slate-500 normal-case flex justify-between border-b">
                     <span>Keranjang belanja kas harian</span><span>{cart.length} Item</span>
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

                {/* SINKRONISASI KAS */}
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
                     <option value="TF_BCA_PUSAT">TF Rek BCA pusat</option>
                     <option value="TF_BRI_PUSAT">TF Rek BRI pusat</option>
                   </select>
                </div>

                <button type="button" onClick={handleSubmitMultiOps} className="w-full btn-holo py-3.5 rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2">
                  <CheckCircle2 size={14}/> Potong kas &amp; simpan biaya
                </button>
              </div>
            </div>
          )}

          {/* FORM NOTA SUPPLIER BESAR (NEW LOGIC) */}
          {activeSubTab === 'SUPPLIER' && (
            <div className="card-holo overflow-hidden border-t-4 border-t-blue-600 shadow-sm animate-in slide-in-from-left-2">
              <div className="p-5 border-b border-slate-100 bg-slate-50 font-bold text-xs flex items-center gap-2 text-slate-800 normal-case">
                <FileText size={16} className="text-blue-600"/> Formulir Belanja Bahan Baku Utama
              </div>
              <form onSubmit={handleSubmitSupplier} className="p-5 space-y-4">
                
                <div>
                  <label className="text-[9px] font-bold text-slate-500 block mb-1 normal-case flex items-center gap-1">Pilih Rekanan Supplier Resmi</label>
                  <select required value={formSupplier.supplierName} onChange={handleSupplierSelect} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs cursor-pointer outline-none focus:border-blue-500 text-blue-700">
                    <option value="">-- Pilih supplier --</option>
                    {supplierOptions.map(s => <option key={s.id} value={s.supplier_name}>{s.supplier_name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-500 block mb-1 normal-case">Nama Item Bahan Baku</label>
                  <input type="text" required value={formSupplier.itemName} onChange={e=>setFormSupplier({...formSupplier, itemName: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" placeholder="Cth: Daging fillet dada mentah" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1 normal-case">Volume beli (Kg)</label>
                    <input type="number" min="1" step="0.1" required value={formSupplier.qty} onChange={e=>setFormSupplier({...formSupplier, qty: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-sm text-center outline-none focus:border-blue-500 shadow-inner" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1 normal-case">Setara Konversi</label>
                    <div className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl font-black text-xs text-center text-white shadow-sm">
                      {formatNumber(hitungKantongSupplier)} Kantong
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-500 block mb-1 normal-case">Harga Satuan (Per Kg) - Otomatis dari Master</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-slate-400 text-xs">Rp</span>
                    <input type="text" required value={formSupplier.price ? Number(formSupplier.price).toLocaleString('id-ID') : ''} onChange={e=>setFormSupplier({...formSupplier, price: e.target.value.replace(/\D/g, '')})} className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500" placeholder="0" />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex justify-between items-center shadow-inner mt-2">
                  <span className="text-[10px] font-bold text-slate-500 normal-case uppercase tracking-wider">Total Tagihan:</span>
                  <span className="text-xl font-black text-slate-800">{formatRupiah(totalTagihanSupplier)}</span>
                </div>

                {/* MIX PAYMENT ALA KASIR POS UNTUK SUPPLIER */}
                <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-inner">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-wider">Opsi Model Bayar</label>
                    <label className="flex items-center gap-1 text-[10px] font-bold text-slate-700 cursor-pointer"><input type="checkbox" checked={splIsSplit} onChange={e=>{ setSplIsSplit(e.target.checked); setSplPayCash(''); setSplPayBCA(''); setSplPayBRI(''); setSplSingleAmount(''); }} className="accent-blue-600"/> Aktifkan Bayar Campuran (Mix)</label>
                  </div>

                  {splIsSplit ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border shadow-3xs">
                        <span className="text-[10px] font-black text-slate-400 w-16">💵 LACI CASH</span>
                        <input type="text" value={splPayCash ? Number(splPayCash).toLocaleString('id-ID') : ''} onChange={e=>setSplPayCash(e.target.value.replace(/\D/g, ''))} className="w-full text-right bg-transparent outline-none font-black text-xs text-slate-800" placeholder="0" />
                      </div>
                      <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border shadow-3xs">
                        <span className="text-[10px] font-black text-blue-600 w-16">🏦 BCA PUSAT</span>
                        <input type="text" value={splPayBCA ? Number(splPayBCA).toLocaleString('id-ID') : ''} onChange={e=>setSplPayBCA(e.target.value.replace(/\D/g, ''))} className="w-full text-right bg-transparent outline-none font-black text-xs text-blue-700" placeholder="0" />
                      </div>
                      <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border shadow-3xs">
                        <span className="text-[10px] font-black text-orange-600 w-16">🏦 BRI PUSAT</span>
                        <input type="text" value={splPayBRI ? Number(splPayBRI).toLocaleString('id-ID') : ''} onChange={e=>setSplPayBRI(e.target.value.replace(/\D/g, ''))} className="w-full text-right bg-transparent outline-none font-black text-xs text-orange-700" placeholder="0" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <select value={splSingleMethod} onChange={e=>{ setSplSingleMethod(e.target.value); setSplSingleAmount(''); }} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none cursor-pointer shadow-3xs">
                            <option value="CASH">Cash (Tunai Laci)</option>
                            <option value="TF_BCA_PUSAT">Transfer BCA Pusat</option>
                            <option value="TF_BRI_PUSAT">Transfer BRI Pusat</option>
                            <option value="DP_PIUTANG">Bayar DP Awal</option>
                            <option value="PIUTANG">Full Bon (Hutang Tempo)</option>
                          </select>
                        </div>
                        {splSingleMethod !== 'DP_PIUTANG' && splSingleMethod !== 'PIUTANG' && (
                          <div><input type="text" value={splSingleAmount ? Number(splSingleAmount).toLocaleString('id-ID') : ''} onChange={e=>setSplSingleAmount(e.target.value.replace(/\D/g, ''))} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-black text-right text-slate-800 outline-none shadow-3xs" placeholder="Rp 0" /></div>
                        )}
                        {splSingleMethod === 'PIUTANG' && (
                          <div><input type="text" disabled value="" className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-black text-right text-slate-400 outline-none opacity-50" placeholder="Rp 0 (Full Bon)" /></div>
                        )}
                      </div>
                      {splSingleMethod === 'DP_PIUTANG' && (
                        <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg shadow-inner">
                          <select value={splDpMethod} onChange={e=>setSplDpMethod(e.target.value)} className="w-1/2 p-2 bg-white border border-blue-200 rounded-lg text-[10px] font-bold outline-none cursor-pointer text-blue-900 shadow-3xs"><option value="CASH">Jalur: Tunai Laci</option><option value="TF_BCA_PUSAT">Jalur: TF BCA Pusat</option><option value="TF_BRI_PUSAT">Jalur: TF BRI Pusat</option></select>
                          <input type="text" value={splSingleAmount ? Number(splSingleAmount).toLocaleString('id-ID') : ''} onChange={e=>setSplSingleAmount(e.target.value.replace(/\D/g, ''))} className="w-1/2 p-2 bg-white border border-blue-200 rounded-lg text-xs font-black text-right text-blue-700 outline-none shadow-3xs placeholder:text-blue-300" placeholder="Nominal DP (Rp)" />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t border-slate-200 pt-2 text-[10px] font-bold space-y-1 text-slate-600">
                    <div className="flex justify-between"><span>Total Dikeluarkan Kasir:</span><span className="font-black text-slate-800">{formatRupiah(splPaymentSummary.totalMasuk)}</span></div>
                    {splPaymentSummary.sisaHutang > 0 && <div className="flex justify-between text-rose-600 font-black bg-rose-50 px-2 py-1 rounded mt-1 border border-rose-200"><span>⚠️ Sisa Tagihan (Masuk Hutang Dagang):</span><span>{formatRupiah(splPaymentSummary.sisaHutang)}</span></div>}
                    {splSingleMethod !== 'PIUTANG' && splSingleMethod !== 'DP_PIUTANG' && (
                      <div className="flex justify-end pt-1"><button type="button" onClick={setLunasOtomatisSupplier} className="text-[9px] font-black text-blue-600 bg-white border border-blue-200 px-2 py-1 rounded shadow-3xs cursor-pointer hover:bg-blue-50">Set Lunas Sesuai Tagihan</button></div>
                    )}
                  </div>
                </div>

                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 py-3.5 rounded-xl text-white text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-colors uppercase tracking-wider">
                  <CheckCircle2 size={14}/> {editingPurchaseId ? 'Sahkan Revisi Belanja' : 'Sahkan Nota Belanja Supplier'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* KANAN: JURNAL BUKU KAS GABUNGAN */}
        <div className="xl:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <div><h4 className="font-bold text-xs normal-case text-slate-800 flex items-center gap-2"><FileText size={16} className="text-blue-600"/> Jurnal buku kas &amp; belanja aktual</h4></div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs"><Calendar size={14} className="text-blue-500"/><input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value || todayStr)} className="text-xs font-bold text-slate-700 outline-none cursor-pointer" /></div>
          </div>
          <div className="overflow-x-auto flex-1 p-1 custom-scrollbar min-h-[50vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/50 text-[10px] normal-case text-slate-400 border-b border-slate-200 sticky top-0 shadow-xs bg-white">
                <tr><th className="px-5 py-4">Bukti &amp; Ref</th><th className="px-5 py-4 min-w-[200px]">Detail transaksi</th><th className="px-5 py-4 text-right min-w-[180px]">Rincian nominal</th><th className="px-5 py-4 text-center">Status</th><th className="px-5 py-4 text-center">Aksi (Sultan)</th></tr>
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
                    const pMethod = String(p.payment_method || 'CASH').replace(/_/g, ' ');
                    
                    const isKantong = String(p.unit).toLowerCase() === 'kantong';
                    const isKg = String(p.unit).toLowerCase() === 'kg';

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors bg-white group">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-slate-800 font-bold text-sm">{formatDate(p.date)}</div>
                          <div className="text-[9px] font-mono text-slate-400 mt-0.5">{p.id}</div>
                          <span className={`text-[8px] font-bold normal-case mt-1 px-1.5 py-0.5 rounded border inline-block ${isPurchase ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{isPurchase ? 'Barang gudang / Supplier' : 'Biaya operasional'}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-800 text-xs normal-case mb-0.5">{p.title}</div>
                          <div className="text-[10px] text-slate-500 normal-case font-medium">{p.subtitle}</div>
                          {p.employee_name && <div className="text-[9px] font-bold text-slate-600 mt-1">PIC: {p.employee_name} <span className={p.change_status === 'PENDING' ? 'text-amber-600' : 'text-emerald-600'}>{p.change_status === 'PENDING' ? '(⏳ sisa kembalian gantung)' : '(✅ lunas balance)'}</span></div>}
                          <div className="text-[9px] text-blue-600 font-bold mt-0.5">Vol: {formatNumber(p.qty)} {p.unit} {isKantong ? `(≈ ${formatNumber(p.qty * 10)} Kg)` : isKg ? `(≈ ${formatNumber(p.qty / 10)} Kantong)` : ''}</div>
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="text-slate-400 text-[10px] font-medium">Nota: {formatRupiah(totalBill)}</div>
                          <div className="text-slate-800 font-extrabold">Bayar: {formatRupiah(paidAmt)}</div>
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold border ${isLunas ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{isLunas ? `Lunas` : 'Hutang / DP'}</span>
                          <div className="text-[8px] text-slate-400 mt-1">{pMethod}</div>
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap opacity-60 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center justify-center gap-1.5">
                            <button type="button" onClick={() => {
                               if(typeof setPrintData === 'function') {
                                  setPrintData({
                                    type: 'PURCHASE', 
                                    title: 'NOTA BELANJA SUPPLIER', 
                                    id: p.id, date: formatDate(p.date), branch_name: currentBranch,
                                    admin_name: user?.name || 'ADMIN', 
                                    customer_name: p.title, 
                                    supplier_name: p.title, 
                                    items: [{ name: p.subtitle, qty: p.qty, unit: p.unit, subtotal: totalBill }],
                                    amount: totalBill, paymentMethod: pMethod,
                                    history: { labelLama: 'Total Tagihan', nominalLama: totalBill, labelAksi: 'Total Dibayar', nominalAksi: paidAmt, labelBaru: 'Sisa Hutang', nominalBaru: Math.max(0, totalBill - paidAmt) }
                                  });
                               }
                            }} className="p-1.5 text-slate-400 hover:text-emerald-600 border border-slate-200 rounded-lg bg-white shadow-3xs hover:bg-emerald-50 cursor-pointer" title="Cetak Bukti"><Printer size={13}/></button>

                            {isPurchase && (isKantong || isKg) && (
                               <button type="button" onClick={() => handleEditPurchase(p)} className="p-1.5 text-slate-400 hover:text-blue-600 border border-slate-200 rounded-lg bg-white shadow-3xs hover:bg-blue-50 cursor-pointer" title="Edit / Revisi Nota"><Edit2 size={13}/></button>
                            )}

                            <button type="button" onClick={() => { if(window.confirm("🔥 PERINGATAN: Yakin void pembatalan data pengeluaran belanja ini secara permanen?")) requestDelete(p.id); }} className="p-1.5 text-slate-400 hover:text-red-600 border border-slate-200 rounded-lg bg-white shadow-3xs hover:bg-red-50 cursor-pointer" title="Void / Hapus Permanen"><Trash2 size={13}/></button>
                          </div>
                        </td>
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
