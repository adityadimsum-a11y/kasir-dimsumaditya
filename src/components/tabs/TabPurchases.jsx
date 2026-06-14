import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingBag, Calendar, FileText, Trash2, Printer, 
  Wallet, Truck, CheckCircle2, DollarSign, Package
} from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });

// 🔥 KAMUS PINTAR MASTER OPS (Sesuai Data Bos Sultan)
const MASTER_OPS = {
  "BAHAN BAKU": [
    { name: "Saos Delmonte", unit: "Dus", price: 108000 },
    { name: "Saos Hot", unit: "Dus", price: 130000 },
    { name: "Saos Belibis", unit: "Dus", price: 235000 },
    { name: "Crab", unit: "Pack", price: 33000 },
    { name: "Otak-otak", unit: "Pack", price: 25000 },
    { name: "Beef", unit: "Pack", price: 53000 },
    { name: "Cumi", unit: "Pack", price: 30000 },
    { name: "Udang", unit: "Kg", price: 60000 },
    { name: "Jamur", unit: "Dus", price: 600000 },
    { name: "Gula", unit: "Karung", price: 365000 },
    { name: "Minyak", unit: "Dus", price: 245000 },
    { name: "Wijen", unit: "Karung", price: 425000 },
    { name: "Garam", unit: "Karung", price: 100000 },
    { name: "Royco", unit: "Dus", price: 45000 },
    { name: "Pewarna", unit: "Pack", price: 25000 },
    { name: "Keju", unit: "Pack", price: 105000 },
    { name: "Wortel", unit: "Kg", price: 20000 },
    { name: "Bawang", unit: "Kg", price: 20000 },
    { name: "Telur", unit: "Peti", price: 300000 },
    { name: "Cakra", unit: "Karung", price: 230000 },
    { name: "Sagu", unit: "Karung", price: 235000 },
    { name: "Meizena", unit: "Karung", price: 325000 }
  ],
  "KEMASAN": [
    { name: "Mika Kecil", unit: "Dus", price: 560000 },
    { name: "Mika Besar", unit: "Dus", price: 850000 },
    { name: "Plastik 35", unit: "Pack", price: 17000 },
    { name: "Plastik Saus", unit: "Pack", price: 12000 },
    { name: "Lakban", unit: "Roll", price: 10000 }
  ],
  "OPERASIONAL KENDARAAN": [
    { name: "Bensin", unit: "Transaksi", price: 0 },
    { name: "Tambal Ban", unit: "Transaksi", price: 0 },
    { name: "Ganti Ban", unit: "Transaksi", price: 0 }
  ],
  "ATK & PERLENGKAPAN": [
    { name: "Colokan Listrik", unit: "Pcs", price: 32000 },
    { name: "Kabel + Clip", unit: "Set", price: 52000 },
    { name: "Solatif", unit: "Roll", price: 5000 },
    { name: "Teflon", unit: "Pcs", price: 350000 }
  ],
  "AIR & KEBERSIHAN": [
    { name: "Air Isi Ulang", unit: "Galon", price: 5000 },
    { name: "Aqua", unit: "Dus", price: 162000 },
    { name: "Sunlight", unit: "Botol", price: 40000 }
  ]
};

// 🔥 AUTO-NORMALIZER TANGGAL
const normalizeDateStr = (dateVal) => {
  if (!dateVal) return '';
  const strVal = String(dateVal);
  if (/^\d{4}-\d{2}-\d{2}/.test(strVal)) return strVal.substring(0, 10);
  if (strVal.includes('T')) return strVal.split('T')[0];
  const parts = strVal.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
  }
  try {
      const d = new Date(strVal);
      if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10);
  } catch(e) {}
  return strVal.substring(0, 10);
};

export default function TabPurchases({ 
  purchases = [], purchases_data,
  expenses = [], expenses_data, // 🔥 Menarik Data Beban Biaya (Expenses)
  supplierInvoices = [], supplier_invoices,
  masterSuppliers = [], master_suppliers, 
  sendToSheet, showToast, user, requestDelete 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  // --- SINKRONISASI DATABASE ---
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realSuppliers = useMemo(() => master_suppliers || masterSuppliers || [], [master_suppliers, masterSuppliers]);

  const [activeSubTab, setActiveTab] = useState('SUPPLIER');
  const [tableDateFilter, setTableDateFilter] = useState(todayStr);

  // ==========================================
  // STATE: FORM BELANJA SUPPLIER (AYAM BESAR)
  // ==========================================
  const [formSupplier, setFormSupplier] = useState({
    supplierName: '', category: 'BAHAN_BAKU', itemName: '', qty: '', price: '', 
    paymentType: 'TEMPO', paymentMethod: 'CASH', dpAmount: ''           
  });

  // ==========================================
  // STATE: FORM KAS & OPS MANUAL (BARU)
  // ==========================================
  const [formOps, setFormOps] = useState({
    category: 'BAHAN BAKU',
    itemName: '',
    unit: '',
    qty: '1',
    price: '',
    storeName: '', // Opsional (Nama Warung / Toko)
    paymentType: 'LUNAS', // Mayoritas lunas untuk kas kecil
    paymentMethod: 'CASH'
  });

  const supplierOptions = useMemo(() => {
    return realSuppliers.filter(s => !s.isDeleted && String(s.isDeleted).toUpperCase() !== 'TRUE');
  }, [realSuppliers]);

  // ENGINE KONVERSI SUPPLIER AYAM
  const hitungKantongSupplier = useMemo(() => {
    const volume = Number(formSupplier.qty || 0);
    if (formSupplier.category === 'BAHAN_BAKU') return volume / 10;
    return 0;
  }, [formSupplier.qty, formSupplier.category]);

  const totalTagihanSupplier = useMemo(() => Number(formSupplier.qty || 0) * Number(formSupplier.price || 0), [formSupplier.qty, formSupplier.price]);
  const totalTagihanOps = useMemo(() => Number(formOps.qty || 0) * Number(formOps.price || 0), [formOps.qty, formOps.price]);

  // ==========================================
  // JURNAL GABUNGAN (PURCHASES + EXPENSES)
  // ==========================================
  const historyCombined = useMemo(() => {
    const all = [];
    
    // 1. Masukkan Purchases (Belanja Aset/Barang)
    realPurchases.forEach(p => {
      if (!p.isDeleted && String(p.isDeleted).toUpperCase() !== 'TRUE') {
        all.push({
          doc_type: 'PURCHASE', id: p.id, date: p.date, branch_id: p.branch_id,
          title: p.supplier_name || p.supplierName || 'BELANJA KAS / SUPPLIER',
          subtitle: p.item_name || p.itemName,
          qty: p.qty, unit: p.unit, total_amount: Number(p.total_amount || p.amount || 0),
          paid_amount: Number(p.paid_amount || 0), payment_status: p.payment_status, payment_method: p.payment_method
        });
      }
    });

    // 2. Masukkan Expenses (Beban Operasional)
    realExpenses.forEach(e => {
      if (!e.isDeleted && String(e.isDeleted).toUpperCase() !== 'TRUE') {
        all.push({
          doc_type: 'EXPENSE', id: e.id, date: e.date, branch_id: e.branch_id,
          title: e.category || 'BIAYA OPERASIONAL',
          subtitle: e.description || e.item_name || 'Beban Kas',
          qty: 1, unit: 'LOT', total_amount: Number(e.amount || 0),
          paid_amount: Number(e.amount || 0), payment_status: 'LUNAS', payment_method: e.payment_method || 'CASH'
        });
      }
    });

    // 3. Filter Tanggal & Cabang lalu Sortir
    return all.filter(x => {
      const xDate = normalizeDateStr(x.date);
      const dateMatch = xDate === tableDateFilter;
      const xBranch = String(x.branch_id || '').toUpperCase();
      const branchMatch = currentBranch === 'TANGERANG_PUSAT' 
        ? xBranch.includes('TANGERANG')
        : xBranch === currentBranch.toUpperCase();
      return dateMatch && branchMatch;
    }).sort((a, b) => new Date(normalizeDateStr(b.date)) - new Date(normalizeDateStr(a.date)));
  }, [realPurchases, realExpenses, tableDateFilter, currentBranch]);


  // ==========================================
  // ACTIONS: SUBMIT NOTA SUPPLIER (AYAM BESAR)
  // ==========================================
  const handleSubmitSupplier = async (e) => {
    e.preventDefault();
    if (!formSupplier.supplierName) return alert("Pilih nama Supplier rekanan resmi terlebih dahulu!");
    if (Number(formSupplier.qty) <= 0) return alert("Kuantitas beli harus lebih dari 0!");

    const purchaseId = generateId('PO-DMA', todayStr);
    const calculatedTotal = totalTagihanSupplier;

    let paidAmount = 0;
    if (formSupplier.paymentType === 'LUNAS') paidAmount = calculatedTotal;
    else if (formSupplier.paymentType === 'DP') paidAmount = Number(formSupplier.dpAmount || 0);
    
    if (formSupplier.paymentType === 'DP' && paidAmount <= 0) return alert("Nominal DP tidak boleh kosong atau Rp 0!");
    if (formSupplier.paymentType === 'DP' && paidAmount >= calculatedTotal) return alert("DP melebihi atau sama dengan total tagihan, silakan pilih metode LUNAS FULL.");

    const isLunasTotal = paidAmount >= calculatedTotal;
    const finalQty = formSupplier.category === 'BAHAN_BAKU' ? hitungKantongSupplier : Number(formSupplier.qty);
    const finalPrice = finalQty > 0 ? (calculatedTotal / finalQty) : 0;
    const finalUnit = formSupplier.category === 'BAHAN_BAKU' ? 'KANTONG' : 'PCS';

    const payloadPurchase = {
      id: purchaseId, date: todayStr, branch_id: currentBranch,
      supplier_name: formSupplier.supplierName.toUpperCase(),
      item_name: formSupplier.itemName.toUpperCase(), 
      qty: finalQty, unit: finalUnit, price: finalPrice, total_amount: calculatedTotal, 
      paid_amount: paidAmount, payment_status: isLunasTotal ? 'LUNAS' : 'BELUM_LUNAS',
      payment_method: formSupplier.paymentType === 'TEMPO' ? 'HUTANG' : formSupplier.paymentMethod, isDeleted: false
    };

    const isSuccess = await sendToSheet('insert', payloadPurchase, 'purchases');

    if (isSuccess) {
      await sendToSheet('insert', {
        id: generateId('LAY', todayStr), date: todayStr, branch_id: currentBranch,
        category: formSupplier.category, item_name: formSupplier.itemName.toUpperCase(),
        qty_received: finalQty, qty_remaining: finalQty, unit_cost: finalPrice, reference_id: purchaseId, isDeleted: false
      }, 'inventory_cost_layers');

      if (paidAmount > 0) {
        await sendToSheet('insert', {
          id: generateId('CFO', todayStr), date: todayStr, branch_id: currentBranch, type: 'OUT',
          category: 'BELANJA LOGISTIK', description: `Beli ${formSupplier.itemName.toUpperCase()} ke ${formSupplier.supplierName.toUpperCase()} (${formSupplier.paymentType})`,
          amount: paidAmount, method: formSupplier.paymentMethod, reference_id: purchaseId
        }, 'cashflow_transactions');
      }
      showToast("Nota Belanja Supplier Berhasil Disimpan!", "success");
      setFormSupplier({ supplierName: '', category: 'BAHAN_BAKU', itemName: '', qty: '', price: '', paymentType: 'TEMPO', paymentMethod: 'CASH', dpAmount: '' });
    }
  };

  // ==========================================
  // ACTIONS: SUBMIT KAS & OPS MANUAL
  // ==========================================
  const handleOpsItemSelect = (e) => {
    const selectedName = e.target.value;
    const itemsInCategory = MASTER_OPS[formOps.category] || [];
    const itemDef = itemsInCategory.find(i => i.name === selectedName);
    
    if (itemDef) {
      setFormOps(prev => ({
        ...prev, 
        itemName: selectedName, 
        unit: itemDef.unit, 
        price: itemDef.price > 0 ? String(itemDef.price) : ''
      }));
    } else {
      setFormOps(prev => ({...prev, itemName: selectedName}));
    }
  };

  const handleSubmitOps = async (e) => {
    e.preventDefault();
    if (!formOps.itemName) return alert("Pilih / isi nama item!");
    if (Number(formOps.qty) <= 0) return alert("Kuantitas beli harus lebih dari 0!");
    if (Number(formOps.price) <= 0) return alert("Harga satuan wajib diisi!");

    const calculatedTotal = totalTagihanOps;
    const isBarangFisik = (formOps.category === 'BAHAN BAKU' || formOps.category === 'KEMASAN');
    const trxId = generateId(isBarangFisik ? 'PO-KAS' : 'EXP', todayStr);

    let isSuccess = false;

    // JIKA BARANG FISIK (Masuk ke Gudang Purchases & Layer)
    if (isBarangFisik) {
      const payloadPurchase = {
        id: trxId, date: todayStr, branch_id: currentBranch,
        supplier_name: formOps.storeName ? `TOKO ${formOps.storeName.toUpperCase()}` : 'BELANJA KAS MANUAL',
        item_name: formOps.itemName.toUpperCase(), 
        qty: Number(formOps.qty), unit: formOps.unit.toUpperCase(), price: Number(formOps.price), 
        total_amount: calculatedTotal, paid_amount: calculatedTotal, // Ops manual selalu dianggap lunas
        payment_status: 'LUNAS', payment_method: formOps.paymentMethod, isDeleted: false
      };
      
      isSuccess = await sendToSheet('insert', payloadPurchase, 'purchases');
      if (isSuccess) {
        await sendToSheet('insert', {
          id: generateId('LAY', todayStr), date: todayStr, branch_id: currentBranch,
          category: formOps.category.replace(' ', '_'), item_name: formOps.itemName.toUpperCase(),
          qty_received: Number(formOps.qty), qty_remaining: Number(formOps.qty), unit_cost: Number(formOps.price), reference_id: trxId, isDeleted: false
        }, 'inventory_cost_layers');
      }
    } 
    // JIKA BARANG BEBAN JASA (Masuk ke Expenses Beban Murni)
    else {
      const payloadExpense = {
        id: trxId, date: todayStr, branch_id: currentBranch,
        category: formOps.category.toUpperCase(),
        description: `${formOps.itemName.toUpperCase()} (${formOps.qty} ${formOps.unit}) ${formOps.storeName ? `- ${formOps.storeName.toUpperCase()}` : ''}`,
        amount: calculatedTotal, payment_method: formOps.paymentMethod, isDeleted: false
      };
      isSuccess = await sendToSheet('insert', payloadExpense, 'expenses');
    }

    // POTONG ARUS KAS KARENA INI TRANSAKSI LUNAS MANUAL
    if (isSuccess) {
      await sendToSheet('insert', {
        id: generateId('CFO', todayStr), date: todayStr, branch_id: currentBranch, type: 'OUT',
        category: isBarangFisik ? 'BELANJA KAS MANUAL' : 'BIAYA OPERASIONAL', 
        description: `Kas Keluar: ${formOps.itemName.toUpperCase()} (${formOps.paymentMethod})`,
        amount: calculatedTotal, method: formOps.paymentMethod, reference_id: trxId
      }, 'cashflow_transactions');

      showToast("Data Kas & Ops Manual Berhasil Disimpan!", "success");
      setFormOps({ ...formOps, itemName: '', qty: '1', price: '', storeName: '', unit: '' });
    }
  };


  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* BANNER HEAD */}
      <div className="bg-[#151a25] rounded-3xl p-6 shadow-xl border border-slate-800 flex items-center gap-3 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-rose-500"></div>
        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20"><ShoppingBag size={20} className="text-amber-400"/></div>
        <div>
          <h2 className="text-white font-black uppercase tracking-widest text-base">Belanja &amp; Biaya Operasional</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Satu pintu utama pengeluaran usaha pabrik, pembelian bahan baku, dan kas internal.</p>
        </div>
      </div>

      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl border w-fit">
        <button onClick={() => setActiveTab('SUPPLIER')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeSubTab === 'SUPPLIER' ? 'bg-white text-blue-600 shadow-sm border' : 'text-slate-500 hover:text-slate-800'}`}><Truck size={14}/> Belanja Supplier (Besar)</button>
        <button onClick={() => setActiveTab('MANUAL')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeSubTab === 'MANUAL' ? 'bg-white text-rose-600 shadow-sm border' : 'text-slate-500 hover:text-slate-800'}`}><Wallet size={14}/> Kas &amp; Ops Manual</button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* ========================================== */}
        {/* KANTONG KIRI: RENDER FORM SESUAI TAB AKTIF */}
        {/* ========================================== */}
        <div className="xl:col-span-5 flex flex-col gap-6">

          {/* FORM 1: BELANJA SUPPLIER (YANG LAMA) */}
          {activeSubTab === 'SUPPLIER' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-left-4 duration-300">
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
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">{formSupplier.category === 'BAHAN_BAKU' ? 'Volume Beli (KG)' : 'Volume Beli (Pcs)'}</label>
                    <input type="number" min="1" step="0.1" required value={formSupplier.qty} onChange={e=>setFormSupplier({...formSupplier, qty: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm text-center outline-none focus:bg-white" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-blue-600 uppercase block mb-1">{formSupplier.category === 'BAHAN_BAKU' ? 'Setara (Kantong)' : 'Satuan'}</label>
                    <div className="w-full p-3 bg-blue-50 border border-blue-200 rounded-xl font-black text-sm text-center text-blue-700">
                      {formSupplier.category === 'BAHAN_BAKU' ? `${formatNumber(hitungKantongSupplier)} KTG` : 'PCS'}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">{formSupplier.category === 'BAHAN_BAKU' ? 'Harga Per Satuan (Per KG)' : 'Harga Per Satuan (Per Pcs)'}</label>
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

                <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2 mt-2">
                  <CheckCircle2 size={16}/> Simpan Nota Belanja Supplier
                </button>
              </form>
            </div>
          )}

          {/* 🔥 FORM 2: KAS & OPS MANUAL (DESAIN KHUSUS CASCADING DROPDOWN) */}
          {activeSubTab === 'MANUAL' && (
            <div className="bg-white rounded-3xl border border-rose-200 shadow-sm overflow-hidden animate-in slide-in-from-right-4 duration-300">
              <div className="p-5 border-b bg-rose-50 font-black text-xs uppercase tracking-widest flex items-center gap-2 text-rose-700">
                <Wallet size={16} className="text-rose-600"/> Formulir Pengeluaran Kas (Petty Cash)
              </div>
              <form onSubmit={handleSubmitOps} className="p-5 space-y-4">
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Kategori Beban</label>
                    <select 
                      value={formOps.category} 
                      onChange={e=>setFormOps({...formOps, category: e.target.value, itemName: '', unit: '', price: ''})} 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-[10px] cursor-pointer outline-none focus:border-rose-400 uppercase"
                    >
                      {Object.keys(MASTER_OPS).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                     <label className="text-[9px] font-black text-rose-600 uppercase block mb-1">Pilih Item (Auto-Fill)</label>
                     <select 
                        required 
                        value={formOps.itemName} 
                        onChange={handleOpsItemSelect} 
                        className="w-full p-3 bg-rose-50 border border-rose-200 rounded-xl font-black text-[10px] text-rose-700 cursor-pointer outline-none focus:bg-white focus:border-rose-500 shadow-sm uppercase"
                      >
                        <option value="">-- KLIK PILIH ITEM --</option>
                        {(MASTER_OPS[formOps.category] || []).map(item => (
                          <option key={item.name} value={item.name}>{item.name}</option>
                        ))}
                     </select>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Nama Toko / Keterangan Tambahan (Opsional)</label>
                  <input type="text" value={formOps.storeName} onChange={e=>setFormOps({...formOps, storeName: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase text-xs outline-none focus:bg-white focus:border-rose-400" placeholder="Cth: Indomaret, Warung Sebelah..." />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Volume Beli / Jumlah</label>
                    <input type="number" min="1" step="0.1" required value={formOps.qty} onChange={e=>setFormOps({...formOps, qty: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm text-center outline-none focus:bg-white focus:border-rose-400" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Satuan Dasar</label>
                    <input type="text" required value={formOps.unit} onChange={e=>setFormOps({...formOps, unit: e.target.value})} className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl font-black text-sm text-center text-slate-600 outline-none uppercase" placeholder="Auto" />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Harga Satuan (Bisa Diedit Manual)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 font-black text-slate-400 text-sm">Rp</span>
                    <input type="text" required value={formOps.price ? Number(formOps.price).toLocaleString('id-ID') : ''} onChange={e=>setFormOps({...formOps, price: e.target.value.replace(/\D/g, '')})} className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm outline-none focus:bg-white focus:border-rose-400" placeholder="0" />
                  </div>
                </div>

                <div className="bg-rose-950 text-white p-4 rounded-xl flex justify-between items-center shadow-inner">
                  <span className="text-[9px] font-black text-rose-300 uppercase tracking-widest">Total Pengeluaran Kas:</span>
                  <span className="text-xl font-black text-rose-400">{formatRupiah(totalTagihanOps)}</span>
                </div>

                <div className="p-4 border border-rose-100 rounded-2xl bg-rose-50/50">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Metode Uang Keluar (Lunas)</label>
                  <select value={formOps.paymentMethod} onChange={e=>setFormOps({...formOps, paymentMethod: e.target.value})} className="w-full p-3 border border-rose-200 rounded-xl text-[10px] font-black uppercase outline-none cursor-pointer bg-white text-rose-700">
                    <option value="CASH">UANG TUNAI LACI KASIR</option>
                    <option value="TF_BCA">TRANSFER REK. BCA PUSAT</option>
                    <option value="TF_BRI">TRANSFER REK. BRI PUSAT</option>
                  </select>
                </div>

                <button type="submit" className="w-full bg-rose-600 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-rose-600/20 hover:bg-rose-700 transition-all active:scale-95 flex items-center justify-center gap-2 mt-2">
                  <CheckCircle2 size={16}/> Potong Kas &amp; Simpan Biaya
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ========================================== */}
        {/* KANTONG KANAN: JURNAL BUKU KAS GABUNGAN */}
        {/* ========================================== */}
        <div className="xl:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h4 className="font-black text-xs uppercase text-slate-800 tracking-widest flex items-center gap-2"><FileText size={16} className="text-blue-600"/> Jurnal Buku Kas Pengeluaran</h4>
            </div>
            <div className="flex items-center gap-2 bg-white border px-3 py-2 rounded-xl shadow-sm">
              <Calendar size={14} className="text-blue-500"/>
              <input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value || todayStr)} className="text-xs font-black text-slate-800 outline-none cursor-pointer" />
            </div>
          </div>

          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar min-h-[50vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-white text-[10px] uppercase text-slate-400 border-b border-slate-100 sticky top-0 shadow-sm">
                <tr>
                  <th className="px-5 py-4 font-black">Bukti &amp; Ref</th>
                  <th className="px-5 py-4 font-black min-w-[200px]">Detail Transaksi Belanja</th>
                  <th className="px-5 py-4 font-black text-right min-w-[180px]">Rincian Nominal</th>
                  <th className="px-5 py-4 font-black text-center">Jalur</th>
                  <th className="px-5 py-4 font-black text-center">Tindakan</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-50">
                {historyCombined.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-20 text-slate-400 font-black uppercase tracking-widest bg-slate-50/50"><div className="flex justify-center mb-3 opacity-20"><ShoppingBag size={40}/></div>Tidak ada catatan kas keluar hari ini.</td>
                  </tr>
                ) : (
                  historyCombined.map(p => {
                    const isPurchase = p.doc_type === 'PURCHASE';
                    const totalBill = Number(p.total_amount || 0);
                    const paidAmt = Number(p.paid_amount || 0);
                    const sisaHutang = totalBill - paidAmt;
                    
                    const isLunas = String(p.payment_status).toUpperCase() === 'LUNAS' || sisaHutang <= 0;
                    const isDP = paidAmt > 0 && sisaHutang > 0;
                    const pMethod = String(p.payment_method || 'CASH').replace('_', ' ');

                    const isAyam = String(p.unit).toUpperCase() === 'KANTONG';
                    const volumeKg = isAyam ? Number(p.qty) * 10 : 0; 

                    return (
                      <tr key={p.id} className={`transition-colors group ${isPurchase ? 'hover:bg-amber-50/30' : 'hover:bg-rose-50/30'}`}>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-slate-800 font-black text-sm">{formatDate(p.date)}</div>
                          <div className="text-[9px] font-mono text-slate-400 mt-1">{p.id}</div>
                          {/* Label Type */}
                          <span className={`text-[7px] font-black uppercase mt-1 px-1.5 py-0.5 rounded border inline-block ${isPurchase ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                             {isPurchase ? 'SUPPLIER ASET' : 'BEBAN OPS MANUAL'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-black text-blue-700 uppercase text-xs mb-1">{p.title}</div>
                          <div className="text-[10px] text-slate-700 uppercase font-black">{p.subtitle}</div>
                          
                          {isPurchase ? (
                            <>
                              <div className="text-[9px] text-slate-500 mt-1.5 font-bold uppercase">{isAyam ? `Volume Beli: ${formatNumber(volumeKg)} KG` : `Volume: ${formatNumber(p.qty)} ${p.unit || 'PCS'}`}</div>
                              {isAyam && <div className="text-[8px] text-emerald-600 mt-0.5 font-black tracking-widest bg-emerald-50 inline-block px-1.5 py-0.5 rounded border border-emerald-100">Masuk Gudang: {formatNumber(p.qty)} KANTONG</div>}
                            </>
                          ) : (
                            <div className="text-[9px] text-rose-500 mt-1.5 font-bold uppercase">Volume Kas: {formatNumber(p.qty)} {p.unit}</div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
                            <span>Total Nota:</span><span>{formatRupiah(totalBill)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-bold text-rose-600 mb-1 border-b border-slate-100 pb-1">
                            <span>{isDP ? 'DP Dibayar:' : (isLunas ? 'Lunas Dibayar:' : 'Dibayar:')}</span>
                            <span>{formatRupiah(paidAmt)}</span>
                          </div>
                          {!isLunas && (
                            <div className="flex justify-between items-center text-[11px] font-black text-amber-600 uppercase">
                               <span>Sisa Hutang:</span><span>{formatRupiah(sisaHutang)}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border shadow-sm ${isLunas ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isDP ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            {isLunas ? `LUNAS (${pMethod})` : isDP ? `DP (${pMethod})` : 'HUTANG FULL'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap opacity-40 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center justify-center gap-1">
                            <button type="button" onClick={() => triggerPrint('NOTA_DOTMATRIX', { 
                              title: isPurchase ? 'BUKTI BON BELANJA LOGISTIK PABRIK' : 'BUKTI PENGELUARAN KAS MANUAL', id: p.id, date: formatDate(p.date), 
                              branch_name: p.branch_id, admin_name: user?.name || 'ADMIN KAS', customer_name: p.title, 
                              items: [{ name: `${isPurchase ? 'BELANJA' : 'KAS OPS'}: ${p.subtitle}\n(Jalur: ${pMethod})`, qty: p.qty, subtotal: totalBill }], 
                              amount: totalBill, paymentMethod: isLunas ? `LUNAS (${pMethod})` : isDP ? `DP MASUK (${pMethod})` : 'HUTANG TEMPO', 
                              history: isDP ? { labelLama: 'Total Tagihan', nominalLama: totalBill, labelAksi: 'Uang Muka (DP)', nominalAksi: paidAmt, labelBaru: 'SISA HUTANG DAGANG', nominalBaru: sisaHutang } : null
                            })} className="p-2 text-slate-500 bg-white border rounded-lg hover:text-blue-600 shadow-sm"><Printer size={14}/></button>
                            <button type="button" onClick={() => { if(window.confirm(`Yakin void data ${isPurchase ? 'belanja' : 'kas'} ini? Arus uang akan ditarik mundur!`)) requestDelete(p.id); }} className="p-2 text-slate-500 bg-white border rounded-lg hover:text-rose-600 shadow-sm"><Trash2 size={14}/></button>
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
