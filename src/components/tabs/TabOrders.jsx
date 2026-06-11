import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ShoppingCart, User, Trash2, Printer, Search, Banknote, Smartphone, MapPin, Tag, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

// 🔥 FIX SAKTI: Mengunci Aturan Harga Sesuai Standar Mutlak Pabrik Dimsum Aditya
const getProductPriceByChannel = (prod, channel) => {
  if (channel === 'MITRA_DISTRIBUTOR') return 2000;
  if (channel === 'RESELLER_AGEN') return 2125;
  if (channel === 'ECERAN_WALKIN') return 3000;
  // Untuk Merchant Online / Paketan Acara, ambil harga default master produk sebagai basis awal (bisa diedit manual)
  return Number(prod.price || 3000); 
};

export default function TabOrders({ 
  masterProducts = [], master_products,
  masterCustomers = [], master_customers,
  masterConversionRules = [], master_conversion_rules, 
  user, sendToSheet, showToast 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  // --- SINKRONISASI DATABASE ---
  const realProducts = useMemo(() => master_products || masterProducts || [], [master_products, masterProducts]);
  const realCustomers = useMemo(() => master_customers || masterCustomers || [], [master_customers, masterCustomers]);
  const realConversions = useMemo(() => master_conversion_rules || masterConversionRules || [], [master_conversion_rules, masterConversionRules]);

  // --- STATE KERANJANG BELANJA ---
  const [cart, setCart] = useState([]);
  
  // --- STATE CRM & FORM KASIR ---
  const [customerSearch, setCustomerSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null); 
  const [isNewCustomer, setIsNewCustomer] = useState(false); 

  const [form, setForm] = useState({
    phone: '', address: '',
    salesChannel: 'ECERAN_WALKIN',
    paymentMethod: 'CASH',
    amountPaid: '',
    notes: '',
    isUpdateMasterPrice: false,
    newMasterPrice: ''
  });

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

  // 🔥 UPDATE HARGA SINKRON REAL-TIME SAAT KLIK JALUR PLATFORM MERCHANT
  useEffect(() => {
    setCart(prevCart => {
      if (prevCart.length === 0) return prevCart;
      return prevCart.map(item => {
        const freshProd = realProducts.find(p => p.id === item.id);
        if (freshProd) {
          return { ...item, currentPrice: getProductPriceByChannel(freshProd, form.salesChannel) };
        }
        return item;
      });
    });
  }, [form.salesChannel, realProducts]);

  // --- ENGINE SAKTI: KONVERSI SATUAN PACK MIKA (Isi 50 Pcs per Pack) ---
  const calculateConversion = (itemName, qtyPcs) => {
    const qty = Number(qtyPcs || 0);
    if (qty <= 0) return '';

    const rule = realConversions.find(c => 
      (c.product_name && c.product_name.toUpperCase() === itemName.toUpperCase()) ||
      (c.item_name && c.item_name.toUpperCase() === itemName.toUpperCase())
    );

    if (rule) {
      const nilai = Number(rule.nilai_konversi || rule.qty_konversi || 50); 
      const namaUnit = rule.nama_konversi || rule.unit_konversi || 'PACK';
      return `${(qty / nilai).toFixed(1)} ${namaUnit}`;
    }

    // Default standar mika dimsum: 1 Pack isi 50 biji
    return `${(qty / 50).toFixed(1)} PACK`;
  };

  // --- ENGINE AUTO-SUGGESTION CUSTOMER ---
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return [];
    const searchLower = customerSearch.toLowerCase();
    return realCustomers.filter(c => !c.isDeleted && c.name && c.name.toLowerCase().includes(searchLower)).slice(0, 5);
  }, [realCustomers, customerSearch]);

  const handleSelectCustomer = (cust) => {
    setCustomerSearch(cust.name);
    setSelectedCustomer(cust);
    setIsNewCustomer(false);
    setForm(prev => ({ ...prev, phone: cust.phone || '', address: cust.address || '' }));
    setShowSuggestions(false);
  };

  const handleCustomerSearchChange = (e) => {
    const val = e.target.value.toUpperCase();
    setCustomerSearch(val);
    setSelectedCustomer(null); 
    setIsNewCustomer(true); 
    setShowSuggestions(true);
  };

  // --- LOGIKA PERHITUNGAN KERANJANG ---
  const handleAddToCart = (product) => {
    setCart(prev => {
      const exist = prev.find(item => item.id === product.id);
      const matchedPrice = getProductPriceByChannel(product, form.salesChannel);
      if (exist) return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { ...product, qty: 1, currentPrice: matchedPrice }];
    });
  };

  const handleUpdateCartQty = (id, newQty) => {
    const cleanQty = Math.max(0, Number(newQty || 0));
    if (cleanQty === 0) return setCart(prev => prev.filter(item => item.id !== id));
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty: cleanQty } : item));
  };

  const handleUpdateCartPrice = (id, newPrice) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, currentPrice: Number(newPrice) } : item));
  };

  const handleRemoveFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const totalTagihan = useMemo(() => cart.reduce((sum, item) => sum + (item.qty * item.currentPrice), 0), [cart]);
  const kembalian = useMemo(() => Math.max(0, Number(form.amountPaid || 0) - totalTagihan), [form.amountPaid, totalTagihan]);

  // --- ACTIONS: SUBMIT TRANSAKSI ---
  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return alert("Keranjang kosong!");
    if (!customerSearch) return alert("Nama Pelanggan/Agen wajib diisi!");
    
    if (form.paymentMethod !== 'TEMPO' && Number(form.amountPaid || 0) < totalTagihan && form.paymentMethod !== 'DP') {
      return alert("Uang bayar kurang dari total tagihan!");
    }

    const orderId = generateId('ORD', todayStr);
    let sisaTagihan = totalTagihan - Number(form.amountPaid || 0);
    if (sisaTagihan < 0 || form.paymentMethod === 'CASH' || form.paymentMethod === 'TF') sisaTagihan = 0;

    const orderStatus = form.paymentMethod === 'TEMPO' || form.paymentMethod === 'DP' ? 'PIUTANG' : 'SELESAI';

    const payloadOrder = {
      id: orderId, date: todayStr, branch_id: currentBranch,
      customer_name: customerSearch, sales_channel: form.salesChannel,
      total_amount: totalTagihan, amount_paid: form.paymentMethod === 'TEMPO' ? 0 : Number(form.amountPaid || 0),
      payment_method: form.paymentMethod, status: orderStatus,
      notes: form.notes.toUpperCase(),
      items: JSON.stringify(cart.map(c => ({ id: c.id, name: c.name, qty: c.qty, price: c.currentPrice })))
    };

    const successOrder = await sendToSheet('insert', payloadOrder, 'orders');

    if (successOrder) {
      if (isNewCustomer || form.isUpdateMasterPrice) {
        const custId = selectedCustomer ? selectedCustomer.id : generateId('CUST', todayStr);
        const payloadCustomer = {
          id: custId, name: customerSearch, phone: form.phone || '-', address: form.address || '-',
          branch_id: currentBranch, join_date: todayStr,
          custom_price: form.isUpdateMasterPrice ? Number(form.newMasterPrice || 0) : (selectedCustomer ? selectedCustomer.custom_price : 0)
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

      showToast('Transaksi Sukses! Invoice Bon Gantung berhasil dicatat.', 'success');
      
      triggerPrint('NOTA_DOTMATRIX', {
        title: 'NOTA PENJUALAN DIMSUM', id: orderId, date: formatDate(todayStr),
        branch_name: currentBranch, admin_name: user?.name || 'KASIR',
        customer_name: customerSearch, items: cart.map(c => ({ name: c.name, qty: c.qty, subtotal: c.qty * c.currentPrice })),
        amount: totalTagihan, paymentMethod: form.paymentMethod === 'TEMPO' ? 'TEMPO / BON GANTUNG' : form.paymentMethod,
        history: form.paymentMethod === 'TEMPO' || form.paymentMethod === 'DP' ? { labelAksi: 'NOMINAL DP/BAYAR', nominalAksi: form.paymentMethod === 'TEMPO' ? 0 : Number(form.amountPaid||0), labelBaru: 'SISA PIUTANG BON', nominalBaru: sisaTagihan } : null
      });

      setCart([]); setCustomerSearch(''); setSelectedCustomer(null); setIsNewCustomer(false);
      setForm({ phone: '', address: '', salesChannel: 'ECERAN_WALKIN', paymentMethod: 'CASH', amountPaid: '', notes: '', isUpdateMasterPrice: false, newMasterPrice: '' });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-10 h-full min-h-screen">
      
      {/* 🛒 KOLOM KIRI: KATALOG DAN KERANJANG */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        
        {/* KATALOG PRODUK */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-black uppercase text-slate-700 tracking-widest flex items-center gap-2 mb-4">
            <ShoppingCart size={16} className="text-blue-500"/> Katalog Produk Gudang
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {realProducts.length === 0 ? (
              <div className="col-span-full py-8 text-center text-xs font-bold text-slate-400">Master produk belum diatur.</div>
            ) : (
              realProducts.filter(p => !p.isDeleted).map(prod => {
                const dynamicPrice = getProductPriceByChannel(prod, form.salesChannel);
                return (
                  <div key={prod.id} onClick={() => handleAddToCart(prod)} className="border border-slate-200 rounded-2xl p-3 cursor-pointer hover:border-blue-500 hover:bg-blue-600/5 transition-all active:scale-95 group flex flex-col justify-between h-full relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-blue-100 text-blue-700 text-[8px] font-black px-2 py-0.5 rounded-bl-lg">➕ AMBIL</div>
                    <div className="font-black text-slate-800 text-xs uppercase leading-tight mb-2 group-hover:text-blue-700">{prod.name}</div>
                    <div className="text-sm font-black text-emerald-600">{formatRupiah(dynamicPrice)}<span className="text-[9px] text-slate-400 ml-1">/ {prod.unit || 'Pcs'}</span></div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* KERANJANG PESANAN */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col">
          <h3 className="text-xs font-black uppercase text-slate-700 tracking-widest flex items-center gap-2 mb-4 border-b pb-3">
            <Tag size={16} className="text-orange-500"/> Keranjang Pesanan
          </h3>
          
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs font-bold text-slate-400 uppercase tracking-widest">Keranjang masih kosong</div>
            ) : (
              cart.map((item, index) => {
                const conversionText = calculateConversion(item.name, item.qty);
                return (
                  <div key={index} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl animate-in fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-black text-slate-800 uppercase text-xs mb-1.5">{item.name}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400">Harga (Rp):</span>
                        <input type="number" value={item.currentPrice} onChange={(e) => handleUpdateCartPrice(item.id, e.target.value)} className="w-24 p-1 border rounded bg-white text-xs font-black text-emerald-600 outline-none" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <div className="flex flex-col items-center">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Input Qty (PCS)</label>
                        <div className="flex items-center bg-white border rounded-xl overflow-hidden shadow-sm focus-within:border-blue-400">
                          <button type="button" onClick={() => handleUpdateCartQty(item.id, item.qty - 1)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 font-black text-slate-600 transition-colors">-</button>
                          <input type="number" value={item.qty} onChange={(e) => handleUpdateCartQty(item.id, e.target.value)} className="w-16 text-center text-xs font-black outline-none bg-white p-1" placeholder="0" />
                          <button type="button" onClick={() => handleUpdateCartQty(item.id, item.qty + 1)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 font-black text-slate-600 transition-colors">+</button>
                        </div>
                      </div>

                      {conversionText && (
                        <div className="bg-blue-50 border border-blue-100 px-3 py-2 rounded-xl flex items-center gap-1.5 min-w-[90px] justify-center">
                          <RefreshCw size={12} className="text-blue-500 animate-spin" style={{ animationDuration: '4s' }} />
                          <div className="text-center">
                            <div className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Estimasi</div>
                            <div className="text-[10px] font-black text-blue-700 tracking-wide">{conversionText}</div>
                          </div>
                        </div>
                      )}

                      <div className="text-right min-w-[100px]">
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Subtotal</div>
                        <div className="font-black text-slate-800 text-sm">{formatRupiah(item.qty * item.currentPrice)}</div>
                      </div>

                      <button type="button" onClick={() => handleRemoveFromCart(item.id)} className="p-2 text-slate-300 hover:text-rose-600 transition-colors"><Trash2 size={14}/></button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 💼 KOLOM KANAN: CRM DAN FORM PEMBAYARAN */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl flex-1 flex flex-col relative overflow-hidden">
          <form onSubmit={handleCheckout} className="space-y-5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest flex items-center gap-2 border-b pb-3">
              <User size={16} className="text-blue-600"/> Data Agen dan Pembayaran
            </h3>

            {/* SEARCH CRM DROPDOWN */}
            <div className="relative" ref={wrapperRef}>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Nama Pelanggan / Agen</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input type="text" required placeholder="Ketik nama pelanggan..." value={customerSearch} onChange={handleCustomerSearchChange} onFocus={() => customerSearch && setShowSuggestions(true)} className={`w-full pl-9 pr-3 py-3 border rounded-xl text-sm uppercase font-black outline-none transition-colors ${isNewCustomer && customerSearch ? 'bg-amber-50 border-amber-300 focus:border-amber-500 text-amber-900' : 'bg-slate-50 border-slate-200 focus:border-blue-400 focus:bg-white text-slate-800'}`} />
              </div>
              
              {showSuggestions && filteredCustomers.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                  {filteredCustomers.map(cust => (
                    <div key={cust.id} onClick={() => handleSelectCustomer(cust)} className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0 transition-colors">
                      <div className="font-black text-xs text-slate-800 uppercase flex items-center gap-2">
                        {cust.name} {cust.custom_price > 0 && <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">HARGA MASTER: {formatRupiah(cust.custom_price)}</span>}
                      </div>
                      <div className="text-[9px] font-bold text-slate-400 mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1"><Smartphone size={10}/> {cust.phone}</span>
                        <span className="flex items-center gap-1"><MapPin size={10}/> {cust.branch_id}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {customerSearch && (
                <div className="mt-2 flex items-center gap-1.5">
                  {isNewCustomer ? (
                    <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-100 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse"><AlertCircle size={10}/> Agen Baru (Akan didaftarkan ke Master)</span>
                  ) : (
                    <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-100 px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle2 size={10}/> Database Terdaftar</span>
                  )}
                </div>
              )}
            </div>

            {isNewCustomer && customerSearch && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/50 border border-amber-100 rounded-2xl animate-in slide-in-from-top-2">
                <div><label className="text-[9px] font-black text-amber-700 uppercase tracking-widest block mb-1"><Smartphone size={10} className="inline mr-1"/> No. WhatsApp</label><input type="text" placeholder="0812..." value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} className="w-full p-2 border border-amber-200 rounded-lg text-xs font-bold bg-white outline-none focus:border-amber-400" /></div>
                <div><label className="text-[9px] font-black text-amber-700 uppercase tracking-widest block mb-1"><MapPin size={10} className="inline mr-1"/> Alamat Wilayah</label><input type="text" placeholder="Kota/Jalan..." value={form.address} onChange={e=>setForm({...form, address: e.target.value})} className="w-full p-2 border border-amber-200 rounded-lg text-xs font-bold uppercase bg-white outline-none focus:border-amber-400" /></div>
              </div>
            )}

            {/* JALUR PLATFORM MERCHANT */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Platform / Jalur Merchant</label>
              <select value={form.salesChannel} onChange={e=>setForm({...form, salesChannel: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-black uppercase outline-none bg-slate-50 cursor-pointer focus:border-blue-400 focus:bg-white">
                <option value="ECERAN_WALKIN">🛒 ECERAN / WALK-IN (Rp 3.000)</option>
                <option value="RESELLER_AGEN">💼 RESELLER / AGEN LANGSUNG (Rp 2.125)</option>
                <option value="MITRA_DISTRIBUTOR">🏢 MITRA / DISTRIBUTOR (Rp 2.000)</option>
                <option disabled>───────────────</option>
                <option value="GOFOOD">🛵 GOFOOD (CUSTOM)</option>
                <option value="GRABFOOD">🛵 GRABFOOD (CUSTOM)</option>
                <option value="SHOPEEFOOD">🛵 SHOPEEFOOD (CUSTOM)</option>
                <option disabled>───────────────</option>
                <option value="SHOPEE">📦 SHOPEE E-COMMERCE (CUSTOM)</option>
                <option value="TOKOPEDIA">📦 TOKOPEDIA (CUSTOM)</option>
                <option value="TIKTOK_SHOP">📦 TIKTOK SHOP (CUSTOM)</option>
              </select>
            </div>

            {/* PASIF CHECKLIST PERUBAHAN HARGA MASTER KONTRAK */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.isUpdateMasterPrice} onChange={e=>setForm({...form, isUpdateMasterPrice: e.target.checked})} className="w-4 h-4 mt-0.5 accent-blue-600" />
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-700 tracking-widest block">Simpan Sebagai Perubahan Harga Master Klien</span>
                  <span className="text-[9px] font-bold text-slate-400">Centang hanya jika ada negosiasi kontrak harga baru di masa mendatang.</span>
                </div>
              </label>
              
              {form.isUpdateMasterPrice && (
                <div className="mt-3 pt-3 border-t border-slate-200 animate-in slide-in-from-top-1">
                  <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1">Ketik Harga Master Kontrak Baru (Rp)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">Rp</span>
                    <input type="number" required placeholder="Contoh: 1850" value={form.newMasterPrice} onChange={e=>setForm({...form, newMasterPrice: e.target.value})} className="w-full pl-9 pr-3 py-2.5 border border-blue-300 rounded-xl text-sm font-black text-blue-900 bg-white outline-none" />
                  </div>
                </div>
              )}
            </div>

            {/* METODE PEMBAYARAN */}
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
            
            <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Catatan Pesanan / Keterangan Gantung Bon</label><input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-2.5 border border-slate-200 bg-slate-50 rounded-xl text-xs font-bold uppercase outline-none focus:bg-white" placeholder="Contoh: Nota bon gantung diambil senin..." /></div>

            <button type="submit" disabled={cart.length === 0} className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl text-xs uppercase disabled:opacity-40 shadow-xl shadow-emerald-600/30 hover:bg-emerald-700 transition-all active:scale-95 mt-4 tracking-widest flex items-center justify-center gap-2 shrink-0">
              <Printer size={16}/> SIMPAN DAN CETAK NOTA KASIR
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}
