import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Printer, Search, Banknote, CheckCircle2, AlertCircle, RefreshCw, ShoppingBag, History, Lock, Unlock, Plus, Trash2, PackageOpen } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

const STANDARD_PRICES = {
  'MITRA_DISTRIBUTOR': 2000,
  'RESELLER_AGEN': 2125,
  'ECERAN_WALKIN': 3000
};

const OJOL_CHANNELS = ['GOFOOD', 'GRABFOOD', 'SHOPEEFOOD'];
const ECOMMERCE_CHANNELS = ['SHOPEE', 'TOKOPEDIA', 'TIKTOK_SHOP', 'PAKETAN_ACARA'];

export default function TabOrders({ 
  masterProducts = [], master_products,
  masterCustomers = [], master_customers,
  masterConversionRules = [], master_conversion_rules, 
  orders = [], // Tarik data order untuk riwayat
  user, sendToSheet, showToast 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  const realProducts = useMemo(() => master_products || masterProducts || [], [master_products, masterProducts]);
  const realCustomers = useMemo(() => master_customers || masterCustomers || [], [master_customers, masterCustomers]);
  const realConversions = useMemo(() => master_conversion_rules || masterConversionRules || [], [master_conversion_rules, masterConversionRules]);
  
  // Ambil transaksi khusus hari ini untuk papan riwayat
  const todaysOrders = useMemo(() => orders.filter(o => o.date === todayStr).reverse(), [orders, todayStr]);

  // --- STATE CRM ---
  const [customerSearch, setCustomerSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null); 

  // --- STATE FORM TRANSAKSI ---
  const [form, setForm] = useState({
    salesChannel: 'RESELLER_AGEN',
    paymentMethod: 'CASH',
    amountPaid: '',
    notes: '',
    isUpdateMasterPrice: false
  });

  // --- STATE MODE GROSIR (BULK) ---
  const [bulkQty, setBulkQty] = useState('');
  const [bulkPrice, setBulkPrice] = useState(2125);

  // --- STATE MODE MERCHANT OJOL ---
  const [merchantCart, setMerchantCart] = useState([]);
  const [merchantInput, setMerchantInput] = useState({ productId: '', qty: '', price: '' });

  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 🔥 ENGINE CERDAS: Update harga grosir otomatis saat jalur platform diubah
  useEffect(() => {
    if (STANDARD_PRICES[form.salesChannel]) {
      setBulkPrice(STANDARD_PRICES[form.salesChannel]);
      setForm(prev => ({ ...prev, isUpdateMasterPrice: false })); // Reset gembok
    } else {
      setBulkPrice(3000); // Default untuk e-commerce/paketan
    }
  }, [form.salesChannel]);

  // Status Logika Gembok
  const isStandardChannel = Object.keys(STANDARD_PRICES).includes(form.salesChannel);
  const isPriceLocked = isStandardChannel && !form.isUpdateMasterPrice;
  const isOjolMode = OJOL_CHANNELS.includes(form.salesChannel);

  // --- ENGINE ESTIMASI KONVERSI MIKA PACK ---
  const calculateConversion = (qtyPcs) => {
    const qty = Number(qtyPcs || 0);
    if (qty <= 0) return '';
    const rule = realConversions.find(c => 
      (c.item_name && c.item_name.toUpperCase().includes('MKA')) || 
      (c.item_name && c.item_name.toUpperCase().includes('PACK'))
    );
    const nilai = Number(rule?.nilai_konversi || rule?.qty_konversi || 50); 
    const namaUnit = rule?.nama_konversi || rule?.unit_konversi || 'PACK';
    return `${(qty / nilai).toFixed(1)} ${namaUnit}`;
  };

  // --- HANDLER CUSTOMER ---
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return [];
    const searchLower = customerSearch.toLowerCase();
    return realCustomers.filter(c => !c.isDeleted && c.name && c.name.toLowerCase().includes(searchLower)).slice(0, 5);
  }, [realCustomers, customerSearch]);

  const handleSelectCustomer = (cust) => {
    setCustomerSearch(cust.name);
    setSelectedCustomer(cust);
    setShowSuggestions(false);
  };

  // --- HANDLER MERCHANT OJOL ---
  const handleAddMerchantItem = () => {
    if (!merchantInput.productId || !merchantInput.qty || !merchantInput.price) return alert('Lengkapi data menu!');
    const prod = realProducts.find(p => p.id === merchantInput.productId);
    setMerchantCart(prev => [...prev, {
      id: prod.id, name: prod.name,
      qty: Number(merchantInput.qty),
      currentPrice: Number(merchantInput.price)
    }]);
    setMerchantInput({ productId: '', qty: '', price: '' });
  };

  const handleRemoveMerchantItem = (index) => {
    setMerchantCart(prev => prev.filter((_, i) => i !== index));
  };

  // --- KALKULASI TAGIHAN ---
  const totalTagihan = useMemo(() => {
    if (isOjolMode) return merchantCart.reduce((sum, item) => sum + (item.qty * item.currentPrice), 0);
    return Number(bulkQty || 0) * Number(bulkPrice || 0);
  }, [isOjolMode, merchantCart, bulkQty, bulkPrice]);

  const kembalian = useMemo(() => Math.max(0, Number(form.amountPaid || 0) - totalTagihan), [form.amountPaid, totalTagihan]);

  // --- ACTIONS: SUBMIT TRANSAKSI ---
  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!customerSearch) return alert("Nama Pelanggan/Agen wajib diisi!");
    if (isOjolMode && merchantCart.length === 0) return alert("Keranjang menu ojol masih kosong!");
    if (!isOjolMode && Number(bulkQty || 0) <= 0) return alert("Quantity Dimsum harus diisi!");
    
    if (form.paymentMethod !== 'TEMPO' && Number(form.amountPaid || 0) < totalTagihan && form.paymentMethod !== 'DP') {
      return alert("Uang bayar kurang dari total tagihan!");
    }

    const orderId = generateId('ORD', todayStr);
    let sisaTagihan = totalTagihan - Number(form.amountPaid || 0);
    if (sisaTagihan < 0 || form.paymentMethod === 'CASH' || form.paymentMethod === 'TF') sisaTagihan = 0;

    const orderStatus = form.paymentMethod === 'TEMPO' || form.paymentMethod === 'DP' ? 'PIUTANG' : 'SELESAI';

    // Rangkai item berdasarkan Mode (Ojol vs Bulk)
    const finalItems = isOjolMode ? merchantCart.map(c => ({ id: c.id, name: c.name, qty: c.qty, price: c.currentPrice })) 
      : [{ id: 'DIMSUM-MIX-BULK', name: 'DIMSUM AYAM MIX (GROSIR)', qty: Number(bulkQty), price: Number(bulkPrice) }];

    const payloadOrder = {
      id: orderId, date: todayStr, branch_id: currentBranch,
      customer_name: customerSearch, sales_channel: form.salesChannel,
      total_amount: totalTagihan, amount_paid: form.paymentMethod === 'TEMPO' ? 0 : Number(form.amountPaid || 0),
      payment_method: form.paymentMethod, status: orderStatus,
      notes: form.notes.toUpperCase(),
      items: JSON.stringify(finalItems)
    };

    const successOrder = await sendToSheet('insert', payloadOrder, 'orders');

    if (successOrder) {
      // Jika ubah harga master dicentang
      if (form.isUpdateMasterPrice && isStandardChannel) {
        const custId = selectedCustomer ? selectedCustomer.id : generateId('CUST', todayStr);
        const payloadCustomer = {
          id: custId, name: customerSearch, phone: selectedCustomer?.phone || '-', address: selectedCustomer?.address || '-',
          branch_id: currentBranch, join_date: todayStr,
          custom_price: Number(bulkPrice || 0)
        };
        await sendToSheet(selectedCustomer ? 'update' : 'insert', payloadCustomer, 'master_customers');
      }

      const nominalKasMasuk = form.paymentMethod === 'TEMPO' ? 0 : Number(form.amountPaid || 0);
      if (nominalKasMasuk > 0) {
        const dppMasuk = Math.min(nominalKasMasuk, totalTagihan); 
        await sendToSheet('insert', {
          id: 'CFI-' + new Date().getTime(), date: todayStr, branch_id: currentBranch, type: 'IN',
          category: 'PENJUALAN ' + form.salesChannel, description: `Nota: ${orderId} (${customerSearch})`,
          amount: dppMasuk, method: form.paymentMethod, reference_id: orderId
        }, 'cashflow_transactions');
      }

      showToast('Transaksi Sukses! Nota Bon berhasil direkam.', 'success');
      
      triggerPrint('NOTA_DOTMATRIX', {
        title: 'NOTA PENJUALAN DIMSUM', id: orderId, date: formatDate(todayStr),
        branch_name: currentBranch, admin_name: user?.name || 'KASIR',
        customer_name: customerSearch, items: finalItems.map(c => ({ name: c.name, qty: c.qty, subtotal: c.qty * c.price })),
        amount: totalTagihan, paymentMethod: form.paymentMethod === 'TEMPO' ? 'TEMPO / BON GANTUNG' : form.paymentMethod,
        history: form.paymentMethod === 'TEMPO' || form.paymentMethod === 'DP' ? { labelAksi: 'NOMINAL DP/BAYAR', nominalAksi: form.paymentMethod === 'TEMPO' ? 0 : Number(form.amountPaid||0), labelBaru: 'SISA PIUTANG BON', nominalBaru: sisaTagihan } : null
      });

      // Reset
      setMerchantCart([]); setCustomerSearch(''); setSelectedCustomer(null); setBulkQty('');
      setForm({ salesChannel: 'RESELLER_AGEN', paymentMethod: 'CASH', amountPaid: '', notes: '', isUpdateMasterPrice: false });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-10 h-full min-h-screen">
      
      {/* 💼 KOLOM KIRI (JANTUNG OPERASIONAL): FORM MESIN KASIR */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        <form onSubmit={handleCheckout} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl flex-1 flex flex-col relative overflow-hidden">
          
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest flex items-center gap-2 border-b pb-3 mb-5">
            <ShoppingBag size={16} className="text-blue-600"/> Mesin Kasir Operasional (POS)
          </h3>

          <div className="space-y-5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            
            {/* 1. NAMA PELANGGAN */}
            <div className="relative" ref={wrapperRef}>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Nama Pelanggan / Agen</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input type="text" required placeholder="Ketik nama pelanggan..." value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value.toUpperCase()); setSelectedCustomer(null); setShowSuggestions(true); }} onFocus={() => customerSearch && setShowSuggestions(true)} className="w-full pl-9 pr-3 py-3 border rounded-xl text-sm uppercase font-black outline-none bg-slate-50 border-slate-200 focus:border-blue-400 focus:bg-white text-slate-800" />
              </div>
              
              {showSuggestions && filteredCustomers.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                  {filteredCustomers.map(cust => (
                    <div key={cust.id} onClick={() => handleSelectCustomer(cust)} className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0 transition-colors">
                      <div className="font-black text-xs text-slate-800 uppercase flex items-center gap-2">
                        {cust.name} {cust.custom_price > 0 && <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">HARGA MASTER: {formatRupiah(cust.custom_price)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {customerSearch && (
                <div className="mt-2 flex items-center gap-1.5">
                  {selectedCustomer ? (
                    <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-100 px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle2 size={10}/> Database Terdaftar</span>
                  ) : (
                    <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-100 px-2 py-0.5 rounded flex items-center gap-1"><AlertCircle size={10}/> Pembeli Umum Biasa</span>
                  )}
                </div>
              )}
            </div>

            {/* 2. JALUR PLATFORM */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Platform / Jalur Merchant</label>
              <select value={form.salesChannel} onChange={e=>setForm({...form, salesChannel: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-black uppercase outline-none bg-slate-50 border-slate-200 cursor-pointer focus:border-blue-400 focus:bg-white">
                <option value="RESELLER_AGEN">💼 RESELLER / AGEN LANGSUNG</option>
                <option value="MITRA_DISTRIBUTOR">🏢 MITRA / DISTRIBUTOR</option>
                <option value="ECERAN_WALKIN">🛒 ECERAN / WALK-IN</option>
                <option value="PAKETAN_ACARA">🎁 PAKETAN ACARA</option>
                <option disabled>───────────────</option>
                <option value="GOFOOD">🛵 GOFOOD</option>
                <option value="GRABFOOD">🛵 GRABFOOD</option>
                <option value="SHOPEEFOOD">🛵 SHOPEEFOOD</option>
                <option disabled>───────────────</option>
                <option value="SHOPEE">📦 SHOPEE E-COMMERCE</option>
                <option value="TOKOPEDIA">📦 TOKOPEDIA</option>
                <option value="TIKTOK_SHOP">📦 TIKTOK SHOP</option>
              </select>
            </div>

            {/* 3. AREA HYBRID: GROSIR VS OJOL */}
            {isOjolMode ? (
              <div className="p-4 bg-orange-50/50 border border-orange-200 rounded-2xl animate-in fade-in space-y-4">
                <div className="text-[10px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-1.5"><PackageOpen size={14}/> Mode Merchant Ojol (Multi Menu)</div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select value={merchantInput.productId} onChange={e => {
                    const id = e.target.value;
                    const p = realProducts.find(x => x.id === id);
                    setMerchantInput({ ...merchantInput, productId: id, price: p?.price || '' });
                  }} className="flex-1 p-2.5 text-xs font-black uppercase border border-orange-200 rounded-xl outline-none">
                    <option value="">-- Pilih Menu Ojol --</option>
                    {realProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" placeholder="Qty" value={merchantInput.qty} onChange={e=>setMerchantInput({...merchantInput, qty: e.target.value})} className="w-20 p-2.5 text-xs font-black text-center border border-orange-200 rounded-xl outline-none" />
                  <input type="number" placeholder="Harga Jual" value={merchantInput.price} onChange={e=>setMerchantInput({...merchantInput, price: e.target.value})} className="w-28 p-2.5 text-xs font-black border border-orange-200 rounded-xl outline-none" />
                  <button type="button" onClick={handleAddMerchantItem} className="bg-orange-500 hover:bg-orange-600 text-white p-2.5 rounded-xl transition-colors"><Plus size={16}/></button>
                </div>
                {/* Mini Cart Ojol */}
                {merchantCart.length > 0 && (
                  <div className="space-y-2 mt-3 pt-3 border-t border-orange-200">
                    {merchantCart.map((c, i) => (
                      <div key={i} className="flex justify-between items-center bg-white p-2 rounded-lg border border-orange-100 text-xs font-bold uppercase">
                        <span>{c.qty}x {c.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-600 font-black">{formatRupiah(c.qty * c.currentPrice)}</span>
                          <button type="button" onClick={()=>handleRemoveMerchantItem(i)} className="text-rose-400 hover:text-rose-600"><Trash2 size={12}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 bg-blue-50 border border-blue-200 rounded-2xl shadow-inner animate-in fade-in">
                <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5 mb-3"><PackageOpen size={14}/> Mode Penjualan Grosir (Bulk)</div>
                <div className="flex flex-col sm:flex-row items-end gap-4">
                  <div className="flex-1 w-full">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Nama Produk Fix</label>
                    <div className="p-3 bg-slate-200 text-slate-500 rounded-xl text-xs font-black uppercase cursor-not-allowed border border-slate-300">DIMSUM AYAM MIX (MASTER)</div>
                  </div>
                  <div className="w-full sm:w-32">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Input Qty (Pcs)</label>
                    <input type="number" required={!isOjolMode} min="1" value={bulkQty} onChange={e=>setBulkQty(e.target.value)} className="w-full p-3 border border-blue-300 rounded-xl text-sm font-black text-blue-800 outline-none text-center focus:ring-2 focus:ring-blue-400 bg-white" placeholder="Cth: 1000" />
                  </div>
                  <div className="w-full sm:w-40 relative">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1 flex items-center gap-1">Harga Satuan {isPriceLocked ? <Lock size={10} className="text-rose-500"/> : <Unlock size={10} className="text-emerald-500"/>}</label>
                    <span className="absolute left-3 bottom-3 text-xs font-black text-slate-400">Rp</span>
                    <input type="number" required value={bulkPrice} onChange={e=>setBulkPrice(e.target.value)} readOnly={isPriceLocked} className={`w-full pl-9 pr-3 py-3 border rounded-xl text-sm font-black outline-none transition-colors ${isPriceLocked ? 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed' : 'bg-white text-emerald-700 border-emerald-300 focus:ring-2 focus:ring-emerald-400'}`} />
                  </div>
                </div>
                
                {/* Radar Konversi & Checklist Update Master */}
                <div className="mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-2 text-[10px] font-black text-blue-600 bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200">
                    <RefreshCw size={12} className="animate-spin" style={{ animationDuration: '4s' }}/> 
                    {calculateConversion(bulkQty) ? `ESTIMASI: ${calculateConversion(bulkQty)}` : 'ESTIMASI: 0 PACK'}
                  </div>
                  
                  {isStandardChannel && (
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:bg-slate-50">
                      <input type="checkbox" checked={form.isUpdateMasterPrice} onChange={e=>setForm({...form, isUpdateMasterPrice: e.target.checked})} className="w-3.5 h-3.5 accent-blue-600" />
                      <span className="text-[9px] font-bold text-slate-600">Buka Gembok Harga &amp; Simpan ke Master</span>
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* 4. TOTAL & PEMBAYARAN */}
            <div className="border-t border-slate-100 pt-4 mt-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Metode Pembayaran</label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { id: 'CASH', label: 'CASH' },
                  { id: 'TF', label: 'TRANSFER' },
                  { id: 'DP', label: 'TITIP DP' },
                  { id: 'TEMPO', label: 'TEMPO / BON' }
                ].map(method => (
                  <button key={method.id} type="button" onClick={() => {
                    const nextPaid = method.id === 'TEMPO' ? '0' : form.amountPaid;
                    setForm({...form, paymentMethod: method.id, amountPaid: nextPaid});
                  }} className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all border ${form.paymentMethod === method.id ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-105' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{method.label}</button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl relative overflow-hidden">
              <Banknote className="absolute -right-4 -bottom-4 text-emerald-500/20 pointer-events-none" size={100} />
              <div className="text-[10px] text-emerald-400 uppercase tracking-widest font-black flex items-center gap-1 mb-1">Total Tagihan Final</div>
              <div className="text-3xl font-black tracking-tight z-10 relative">{formatRupiah(totalTagihan)}</div>
            </div>

            {form.paymentMethod !== 'TEMPO' ? (
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 flex justify-between">
                  <span>Nominal Uang Diterima Kasir</span>
                  {kembalian > 0 && <span className="text-amber-500 font-black">Kembalian: {formatRupiah(kembalian)}</span>}
                </label>
                <input type="text" required value={formatRupiah(form.amountPaid)} onChange={e=>setForm({...form, amountPaid: e.target.value.replace(/\D/g, '')})} className={`w-full p-4 border rounded-xl text-lg font-black outline-none text-center ${Number(form.amountPaid||0) < totalTagihan && form.paymentMethod !== 'DP' ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-emerald-50 border-emerald-300 text-emerald-800 focus:bg-white'}`} placeholder="Rp 0" />
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] font-bold text-amber-800 uppercase tracking-wide flex items-center gap-2 animate-in fade-in">
                <AlertCircle size={16} className="shrink-0 text-amber-600"/>
                <span>Sistem mencatat sebagai Piutang Bon Gantung. Total tagihan akan ditagih pada pelunasan invoice berikutnya.</span>
              </div>
            )}
            
            <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Catatan Tambahan Nota</label><input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-2.5 border border-slate-200 bg-slate-50 rounded-xl text-xs font-bold uppercase outline-none focus:bg-white" placeholder="Ketik catatan..." /></div>

            <button type="submit" className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl text-xs uppercase shadow-xl shadow-emerald-600/30 hover:bg-emerald-700 transition-all active:scale-95 mt-4 tracking-widest flex items-center justify-center gap-2 shrink-0">
              <Printer size={16}/> SIMPAN DAN CETAK NOTA KASIR
            </button>
          </form>
        </div>
      </div>

      {/* 📊 KOLOM KANAN (PAPAN KONTROL): TABEL RIWAYAT TRANSAKSI HARI INI */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full max-h-[85vh]">
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest flex items-center justify-between border-b pb-3 mb-4">
            <span className="flex items-center gap-2"><History size={16} className="text-orange-500"/> Riwayat Nota Hari Ini</span>
            <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[9px]">{todaysOrders.length} TRX</span>
          </h3>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {todaysOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-40">
                <History size={40} className="text-slate-400 mb-3" />
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Belum Ada Transaksi</div>
              </div>
            ) : (
              todaysOrders.map((ord, idx) => (
                <div key={idx} className="p-3 border border-slate-200 rounded-xl bg-slate-50 hover:bg-white transition-colors cursor-default">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-[10px] font-black text-blue-600">{ord.id}</div>
                      <div className="text-xs font-black text-slate-800 uppercase mt-0.5">{ord.customer_name}</div>
                    </div>
                    <div className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${ord.status === 'PIUTANG' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {ord.payment_method === 'TEMPO' ? 'BON GANTUNG' : ord.payment_method}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                    <span className="truncate max-w-[150px]">{ord.sales_channel.replace('_', ' ')}</span>
                    <span className="text-xs font-black text-slate-800">{formatRupiah(ord.total_amount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
