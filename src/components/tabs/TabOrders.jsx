import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Printer, Search, Banknote, CheckCircle2, AlertCircle, RefreshCw, ShoppingBag, Clock, Lock, Unlock, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabOrders({ 
  masterProducts = [], master_products,
  masterCustomers = [], master_customers,
  masterConversionRules = [], master_conversion_rules, 
  orders = [], 
  user, sendToSheet, showToast 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user && user.branch_id && user.branch_id !== 'PUSAT') ? user.branch_id : 'TANGERANG_PUSAT';

  // --- SINKRONISASI DATABASE (ANTI-CRASH) ---
  const realProducts = useMemo(() => Array.isArray(master_products || masterProducts) ? (master_products || masterProducts) : [], [master_products, masterProducts]);
  const realCustomers = useMemo(() => Array.isArray(master_customers || masterCustomers) ? (master_customers || masterCustomers) : [], [master_customers, masterCustomers]);
  const realConversions = useMemo(() => Array.isArray(master_conversion_rules || masterConversionRules) ? (master_conversion_rules || masterConversionRules) : [], [master_conversion_rules, masterConversionRules]);
  
  const todaysOrders = useMemo(() => {
    if (!orders || !Array.isArray(orders)) return [];
    return orders.filter(o => o && o.date === todayStr).reverse();
  }, [orders, todayStr]);

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

  // --- STATE UNIVERSAL CART ---
  const [cart, setCart] = useState([]);
  const [inputItem, setInputItem] = useState({ productId: '', qty: '', price: '', isCustomPrice: false });

  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- HARGA PINTAR (SMART PRICING ENGINE) ---
  const getProductPrice = (product, channel) => {
    if (!product) return 0;
    // Harga prioritas khusus pelanggan lama
    if (selectedCustomer && selectedCustomer.custom_price > 0 && (product.name || product.product_name)?.toUpperCase().includes('DIMSUM')) {
      return selectedCustomer.custom_price;
    }
    // Harga standar per jalur channel
    if (channel === 'RESELLER_AGEN') return product.price_reseller || product.selling_price || 0;
    if (channel === 'MITRA_DISTRIBUTOR') return product.price_mitra || product.selling_price || 0;
    if (channel === 'ECERAN_WALKIN') return product.price_eceran || product.selling_price || 0;
    if (channel === 'PEMALANG') return product.price_pemalang || product.selling_price || 0;
    
    // Default fallback
    return product.selling_price || product.price_eceran || 0;
  };

  const handleChannelChange = (e) => {
    const newChannel = e.target.value;
    setForm({ ...form, salesChannel: newChannel });
    
    // Update harga di form input yang belum masuk keranjang
    if (inputItem.productId && !inputItem.isCustomPrice) {
      const prod = realProducts.find(p => p.id === inputItem.productId);
      if (prod) setInputItem(prev => ({ ...prev, price: getProductPrice(prod, newChannel) }));
    }
    
    // Auto-update harga barang di keranjang jika belum dilock custom
    setCart(prev => prev.map(item => {
      if (item.isCustomPrice) return item;
      const prod = realProducts.find(p => p.id === item.id);
      return { ...item, price: getProductPrice(prod, newChannel) };
    }));
  };

  const handleSelectProduct = (e) => {
    const id = e.target.value;
    const prod = realProducts.find(p => p.id === id);
    if (prod) {
      setInputItem({ productId: id, qty: '', price: getProductPrice(prod, form.salesChannel), isCustomPrice: false });
    } else {
      setInputItem({ productId: '', qty: '', price: '', isCustomPrice: false });
    }
  };

  const handleAddToCart = () => {
    if (!inputItem.productId || !inputItem.qty || !inputItem.price) return alert('Lengkapi pilihan produk, Qty, dan Harga!');
    const prod = realProducts.find(p => p.id === inputItem.productId);
    if (!prod) return alert('Produk tidak valid!');
    
    const existingIndex = cart.findIndex(c => c.id === prod.id && c.price === Number(inputItem.price));
    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].qty += Number(inputItem.qty);
      setCart(newCart);
    } else {
      setCart(prev => [...prev, {
        id: prod.id, name: prod.name || prod.product_name,
        qty: Number(inputItem.qty),
        price: Number(inputItem.price),
        isCustomPrice: inputItem.isCustomPrice
      }]);
    }
    setInputItem({ productId: '', qty: '', price: '', isCustomPrice: false });
  };

  const handleRemoveFromCart = (index) => setCart(prev => prev.filter((_, i) => i !== index));

  // --- ENGINE ESTIMASI KONVERSI MIKA PACK ---
  const calculateConversion = () => {
    const totalDimsumQty = cart.reduce((sum, item) => item.name.toUpperCase().includes('DIMSUM') ? sum + item.qty : sum, 0);
    if (totalDimsumQty <= 0) return '0 PACK';
    
    const rule = realConversions.find(c => (c.item_name && c.item_name.toUpperCase().includes('MKA')) || (c.item_name && c.item_name.toUpperCase().includes('PACK')));
    const nilai = Number(rule ? (rule.nilai_konversi || rule.qty_konversi || 50) : 50); 
    const namaUnit = rule ? (rule.nama_konversi || rule.unit_konversi || 'PACK') : 'PACK';
    return `${(totalDimsumQty / nilai).toFixed(1)} ${namaUnit}`;
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
    
    if (cust.custom_price > 0) {
       setCart(prev => prev.map(item => {
         if (item.name.toUpperCase().includes('DIMSUM') && !item.isCustomPrice) return { ...item, price: cust.custom_price };
         return item;
       }));
    }
  };

  const totalTagihan = useMemo(() => cart.reduce((sum, item) => sum + (item.qty * item.price), 0), [cart]);
  const kembalian = useMemo(() => Math.max(0, Number(form.amountPaid || 0) - totalTagihan), [form.amountPaid, totalTagihan]);

  // --- ACTIONS: SUBMIT TRANSAKSI ---
  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!customerSearch) return alert("Nama Pelanggan/Agen wajib diisi!");
    if (cart.length === 0) return alert("Keranjang belanja masih kosong!");
    if (form.paymentMethod !== 'TEMPO' && Number(form.amountPaid || 0) < totalTagihan && form.paymentMethod !== 'DP') return alert("Uang bayar kurang dari total tagihan!");

    const orderId = generateId('ORD', todayStr);
    let sisaTagihan = totalTagihan - Number(form.amountPaid || 0);
    if (sisaTagihan < 0 || form.paymentMethod === 'CASH' || form.paymentMethod === 'TF') sisaTagihan = 0;

    const finalItems = cart.map(c => ({ id: c.id, name: c.name, qty: c.qty, price: c.price }));

    const payloadOrder = {
      id: orderId, date: todayStr, branch_id: currentBranch,
      customer_name: customerSearch, sales_channel: form.salesChannel,
      total_amount: totalTagihan, amount_paid: form.paymentMethod === 'TEMPO' ? 0 : Number(form.amountPaid || 0),
      payment_method: form.paymentMethod, status: form.paymentMethod === 'TEMPO' || form.paymentMethod === 'DP' ? 'PIUTANG' : 'SELESAI',
      notes: form.notes.toUpperCase(),
      items: JSON.stringify(finalItems)
    };

    const successOrder = await sendToSheet('insert', payloadOrder, 'orders');

    if (successOrder) {
      if (form.isUpdateMasterPrice) {
        const custId = selectedCustomer ? selectedCustomer.id : generateId('CUST', todayStr);
        const dimsumItem = cart.find(c => c.name.toUpperCase().includes('DIMSUM'));
        const newCustomPrice = dimsumItem ? dimsumItem.price : 0;
        
        await sendToSheet(selectedCustomer ? 'update' : 'insert', {
          id: custId, name: customerSearch, phone: selectedCustomer?.phone || '-', address: selectedCustomer?.address || '-',
          branch_id: currentBranch, join_date: todayStr, custom_price: newCustomPrice
        }, 'master_customers');
      }

      const nominalKasMasuk = form.paymentMethod === 'TEMPO' ? 0 : Number(form.amountPaid || 0);
      if (nominalKasMasuk > 0) {
        await sendToSheet('insert', {
          id: 'CFI-' + new Date().getTime(), date: todayStr, branch_id: currentBranch, type: 'IN',
          category: 'PENJUALAN ' + form.salesChannel, description: `Nota: ${orderId} (${customerSearch})`,
          amount: Math.min(nominalKasMasuk, totalTagihan), method: form.paymentMethod, reference_id: orderId
        }, 'cashflow_transactions');
      }

      // AUTO-POTONG STOK GUDANG 
      finalItems.forEach((item, index) => {
        sendToSheet('insert', {
          id: generateId('SM-OUT', todayStr) + '-' + index, date: todayStr, branch_id: currentBranch,
          movement_type: 'SALE', item_name: item.name.toUpperCase(), qty: Number(item.qty),
          reference_id: orderId, notes: `Terjual via ${form.salesChannel}`
        }, 'stock_movements');
      });

      showToast('Transaksi Sukses! Nota terekam, kas masuk & stok terpotong otomatis.', 'success');
      
      triggerPrint('NOTA_DOTMATRIX', {
        title: 'NOTA PENJUALAN', id: orderId, date: formatDate(todayStr),
        branch_name: currentBranch, admin_name: user?.name || 'KASIR', customer_name: customerSearch, 
        items: finalItems.map(c => ({ name: c.name, qty: c.qty, subtotal: c.qty * c.price })),
        amount: totalTagihan, paymentMethod: form.paymentMethod === 'TEMPO' ? 'TEMPO / BON GANTUNG' : form.paymentMethod,
        history: form.paymentMethod === 'TEMPO' || form.paymentMethod === 'DP' ? { labelAksi: 'NOMINAL DP/BAYAR', nominalAksi: nominalKasMasuk, labelBaru: 'SISA PIUTANG BON', nominalBaru: sisaTagihan } : null
      });

      setCart([]); setCustomerSearch(''); setSelectedCustomer(null);
      setForm({ salesChannel: 'RESELLER_AGEN', paymentMethod: 'CASH', amountPaid: '', notes: '', isUpdateMasterPrice: false });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-10 h-full min-h-screen">
      
      {/* 💼 KOLOM KIRI: FORM MESIN KASIR */}
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
            </div>

            {/* 2. JALUR PLATFORM */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Platform / Jalur Merchant</label>
              <select value={form.salesChannel} onChange={handleChannelChange} className="w-full p-3 border rounded-xl text-xs font-black uppercase outline-none bg-slate-50 border-slate-200 cursor-pointer focus:border-blue-400 focus:bg-white">
                <option value="RESELLER_AGEN">💼 RESELLER / AGEN LANGSUNG</option>
                <option value="MITRA_DISTRIBUTOR">🏢 MITRA / DISTRIBUTOR</option>
                <option value="ECERAN_WALKIN">🛒 ECERAN / WALK-IN</option>
                <option value="PAKETAN_ACARA">🎁 PAKETAN ACARA</option>
                <option disabled>───────────────</option>
                <option value="GOFOOD">🛵 GOFOOD</option>
                <option value="GRABFOOD">🛵 GRABFOOD</option>
                <option value="SHOPEEFOOD">🛵 SHOPEEFOOD</option>
                <option value="TOKOPEDIA">📦 TOKOPEDIA / TIKTOK SHOP</option>
              </select>
            </div>

            {/* 3. UNIVERSAL KERANJANG BELANJA (MULTI ITEM) */}
            <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-2xl shadow-inner animate-in fade-in space-y-4">
              <div className="flex justify-between items-center mb-1">
                <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5"><ShoppingCart size={14}/> Keranjang Penjualan Dinamis</div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 items-end">
                <div className="flex-1 w-full">
                  <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Pilih Produk</label>
                  <select value={inputItem.productId} onChange={handleSelectProduct} className="w-full p-2.5 text-xs font-black uppercase border border-blue-200 rounded-xl outline-none focus:border-blue-400 bg-white cursor-pointer">
                    <option value="">-- Pilih Barang --</option>
                    {realProducts.map(p => <option key={p.id} value={p.id}>{p.name || p.product_name}</option>)}
                  </select>
                </div>
                <div className="w-full sm:w-24">
                  <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Qty</label>
                  <input type="number" min="1" placeholder="Qty" value={inputItem.qty} onChange={e=>setInputItem({...inputItem, qty: e.target.value})} className="w-full p-2.5 text-xs font-black text-center border border-blue-200 rounded-xl outline-none focus:border-blue-400 bg-white" />
                </div>
                <div className="w-full sm:w-36 relative">
                  <label className="text-[9px] font-bold text-slate-500 uppercase flex justify-between items-center mb-1">
                    Harga 
                    <button type="button" onClick={() => setInputItem({...inputItem, isCustomPrice: !inputItem.isCustomPrice})} className="text-blue-500 hover:text-blue-700 bg-blue-100 p-0.5 rounded" title="Buka Gembok Harga">
                      {inputItem.isCustomPrice ? <Unlock size={10} className="text-rose-500"/> : <Lock size={10} className="text-emerald-500"/>}
                    </button>
                  </label>
                  <input type="number" placeholder="Rp" value={inputItem.price} onChange={e=>setInputItem({...inputItem, price: e.target.value, isCustomPrice: true})} readOnly={!inputItem.isCustomPrice} className={`w-full p-2.5 text-xs font-black border border-blue-200 rounded-xl outline-none focus:border-blue-400 ${!inputItem.isCustomPrice ? 'bg-slate-100 text-slate-500' : 'bg-white text-emerald-700 focus:ring-1 focus:ring-emerald-400'}`} />
                </div>
                <button type="button" onClick={handleAddToCart} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl transition-colors shadow-sm sm:h-[38px] sm:w-[42px] flex items-center justify-center shrink-0 mt-2 sm:mt-0">
                  <Plus size={16}/> <span className="sm:hidden text-xs font-bold uppercase ml-1">Tambah Ke Nota</span>
                </button>
              </div>

              {cart.length > 0 && (
                <div className="space-y-2 mt-4 pt-3 border-t border-blue-200/50">
                  {cart.map((c, i) => (
                    <div key={i} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-blue-100 shadow-sm text-xs font-bold uppercase group">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md text-[10px]">{c.qty}x</span>
                        <span className="text-slate-700">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-emerald-600 font-black">{formatRupiah(c.qty * c.price)}</div>
                          {c.isCustomPrice && <div className="text-[8px] text-rose-500 tracking-wider">Harga Custom</div>}
                        </div>
                        <button type="button" onClick={()=>handleRemoveFromCart(i)} className="text-slate-300 hover:text-rose-500 transition-colors p-1"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  ))}
                  
                  <div className="mt-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
                    <div className="flex items-center gap-2 text-[10px] font-black text-blue-600 bg-white px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm">
                      <RefreshCw size={12} className="animate-spin" style={{ animationDuration: '4s' }}/> 
                      ESTIMASI KEMASAN: {calculateConversion()}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:bg-slate-50">
                      <input type="checkbox" checked={form.isUpdateMasterPrice} onChange={e=>setForm({...form, isUpdateMasterPrice: e.target.checked})} className="w-3.5 h-3.5 accent-blue-600" />
                      <span className="text-[9px] font-bold text-slate-600">Jadikan Harga Tetap Pelanggan</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* 4. TOTAL & PEMBAYARAN */}
            <div className="border-t border-slate-100 pt-4 mt-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Metode Pembayaran</label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[{ id: 'CASH', label: 'CASH' }, { id: 'TF', label: 'TRANSFER' }, { id: 'DP', label: 'TITIP DP' }, { id: 'TEMPO', label: 'TEMPO/BON' }].map(method => (
                  <button key={method.id} type="button" onClick={() => setForm({...form, paymentMethod: method.id, amountPaid: method.id === 'TEMPO' ? '0' : form.amountPaid})} className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all border ${form.paymentMethod === method.id ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-105' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{method.label}</button>
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
                <span>Sistem mencatat sebagai Piutang Bon Gantung. Tagihan akan direkap pada menu Piutang.</span>
              </div>
            )}
            
            <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Catatan Tambahan Nota</label><input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-2.5 border border-slate-200 bg-slate-50 rounded-xl text-xs font-bold uppercase outline-none focus:bg-white" placeholder="Ketik catatan..." /></div>

            <button type="submit" disabled={cart.length === 0} className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl text-xs uppercase shadow-xl shadow-emerald-600/30 hover:bg-emerald-700 transition-all active:scale-95 mt-4 tracking-widest flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
              <Printer size={16}/> SIMPAN DAN CETAK NOTA KASIR
            </button>
          </form>
        </div>
      </div>

      {/* 📊 KOLOM KANAN: TABEL RIWAYAT TRANSAKSI HARI INI */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full max-h-[85vh]">
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest flex items-center justify-between border-b pb-3 mb-4">
            <span className="flex items-center gap-2"><Clock size={16} className="text-orange-500"/> Riwayat Nota Hari Ini</span>
            <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[9px]">{todaysOrders.length} TRX</span>
          </h3>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {todaysOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-40">
                <Clock size={40} className="text-slate-400 mb-3" />
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
