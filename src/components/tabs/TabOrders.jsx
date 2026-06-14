import React, { useState, useMemo } from 'react';
import { 
  ShoppingCart, Plus, Minus, Trash2, Search, 
  CreditCard, Wallet, UserCheck, Tag, Receipt, 
  CheckCircle2, AlertTriangle, Gift
} from 'lucide-react';
import { getTodayStr, generateId, formatDate, safeJsonParse } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabOrders({ 
  masterProducts = [], master_products,
  masterCustomers = [], master_customers,
  sendToSheet, setPrintData, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';
  
  // 🔥 KUNCI PINTAR: Pemalang & Pusat punya akses ke Rekening Utama
  const isPemalang = currentBranch === 'PRODUKSI_PEMALANG';
  const hasHQPaymentAccess = isHQ || isPemalang;

  // --- SINKRONISASI DATABASE ---
  const realProducts = useMemo(() => master_products || masterProducts || [], [master_products, masterProducts]);
  const realCustomers = useMemo(() => master_customers || masterCustomers || [], [master_customers, masterCustomers]);

  const activeProducts = useMemo(() => realProducts.filter(p => !p.isDeleted && String(p.isDeleted).toUpperCase() !== 'TRUE'), [realProducts]);
  const activeCustomers = useMemo(() => realCustomers.filter(c => !c.isDeleted).reverse(), [realCustomers]);

  // --- STATE MANAJEMEN KASIR ---
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form Pembayaran
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [orderMode, setOrderMode] = useState('REGULAR'); // REGULAR | INFLUENCER
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');

  // --- OPSI PEMBAYARAN DINAMIS (Pusat & Pemalang vs Outlet Resto) ---
  const paymentOptions = useMemo(() => {
    if (hasHQPaymentAccess) {
      return [
        { id: 'CASH', label: 'Cash (Tunai Laci)' },
        { id: 'TF_QRIS', label: 'Transfer / QRIS' },
        { id: 'TF_BCA_PUSAT', label: 'Transfer BCA Pusat' },
        { id: 'TF_BRI_PUSAT', label: 'Transfer BRI Pusat' }
      ];
    }
    return [
      { id: 'CASH', label: 'Cash (Tunai Laci)' },
      { id: 'TF_QRIS', label: 'Transfer / QRIS' }
    ];
  }, [hasHQPaymentAccess]);

  // --- FILTER PRODUK ---
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return activeProducts;
    const s = searchTerm.toLowerCase();
    return activeProducts.filter(p => (p.product_name || '').toLowerCase().includes(s));
  }, [activeProducts, searchTerm]);

  // --- FUNGSI KERANJANG BELANJA ---
  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { 
        id: product.id, 
        name: product.product_name, 
        price: Number(product.selling_price || 0), 
        hpp: Number(product.default_hpp || 0),
        qty: 1 
      }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const cartHPP = cart.reduce((sum, item) => sum + (item.hpp * item.qty), 0);

  // --- AUTO SET LUNAS ---
  const setLunas = (e) => {
    e.preventDefault();
    setAmountPaid(String(cartTotal));
  };

  // --- EKSEKUSI CHECKOUT SAKTI ---
  const handleCheckout = async () => {
    if (cart.length === 0) return alert("Keranjang belanja masih kosong!");
    if (!selectedCustomerId) return alert("Pilih nama customer / kategori dari dropdown!");
    if (orderMode === 'REGULAR' && amountPaid === '') return alert("Nominal bayar atau DP tidak boleh kosong!");

    const customer = activeCustomers.find(c => c.id === selectedCustomerId);
    const custName = customer ? customer.customer_name : 'Pelanggan Umum';
    const custCategory = customer ? customer.category : 'OFFLINE';

    const orderId = generateId('INV', todayStr);
    const nominalBayar = orderMode === 'INFLUENCER' ? 0 : Number(amountPaid);
    const finalPaymentMethod = orderMode === 'INFLUENCER' ? 'PROMO_MARKETING' : paymentMethod;
    const finalStatus = orderMode === 'INFLUENCER' ? 'LUNAS' : (nominalBayar >= cartTotal ? 'LUNAS' : 'BELUM_LUNAS');

    const confirmMsg = orderMode === 'INFLUENCER' 
      ? `Konfirmasi pemberian gratis (Influencer/Promo):\n\nCustomer: ${custName}\nTotal item: ${cart.reduce((s,i)=>s+i.qty,0)} Pcs\nNilai HPP (Masuk beban promo): ${formatRupiah(cartHPP)}\n\nLanjutkan?`
      : `Konfirmasi pembayaran:\n\nTotal belanja: ${formatRupiah(cartTotal)}\nNominal dibayar: ${formatRupiah(nominalBayar)}\nMetode: ${paymentMethod.replace(/_/g, ' ')}\n\nLanjutkan checkout?`;

    if (!window.confirm(confirmMsg)) return;

    // 1. PAYLOAD NOTA PENJUALAN
    const orderPayload = {
      id: orderId,
      date: todayStr,
      branch_id: currentBranch,
      customer_name: custName,
      sales_channel: custCategory,
      items: JSON.stringify(cart),
      qty: cart.reduce((sum, item) => sum + item.qty, 0),
      total_amount: cartTotal, 
      amount_paid: nominalBayar,
      payment_method: finalPaymentMethod,
      status: finalStatus,
      notes: notes || '-',
      isDeleted: false
    };

    const isOrderSuccess = await sendToSheet('insert', orderPayload, 'orders');

    if (isOrderSuccess) {
      // 2A. JIKA INFLUENCER -> MASUK BEBAN PENGELUARAN (HPP)
      if (orderMode === 'INFLUENCER') {
        const expPayload = {
          id: generateId('EXP', todayStr),
          date: todayStr,
          branch_id: currentBranch,
          category: 'BIAYA_PROMOSI',
          expense_name: `Promo Influencer: ${custName}`,
          amount: cartHPP,
          payment_method: 'SISTEM',
          description: `Pemberian menu gratis (${cart.reduce((s,i)=>s+i.qty,0)} Pcs). Nilai HPP dicatat sebagai beban promosi. Catatan: ${notes}`,
          isDeleted: false
        };
        await sendToSheet('insert', expPayload, 'expenses');
      } 
      // 2B. JIKA REGULAR & ADA UANG MASUK -> MASUK CASHFLOW IN
      else if (nominalBayar > 0) {
        const cfPayload = {
          id: generateId('CFI', todayStr),
          date: todayStr,
          branch_id: currentBranch,
          type: 'IN',
          category: 'PENJUALAN POS',
          description: `INV: ${orderId} - Pelanggan: ${custName} (${finalStatus.replace('_', ' ')})`,
          amount: nominalBayar,
          method: finalPaymentMethod,
          reference_id: orderId,
          isDeleted: false
        };
        await sendToSheet('insert', cfPayload, 'cashflow_transactions');
      }

      showToast(`Transaksi berhasil diproses!`, 'success');

      // 3. AUTO PRINT DOT MATRIX
      if (window.confirm("Cetak struk nota untuk pelanggan?")) {
        setPrintData({
          title: orderMode === 'INFLUENCER' ? 'NOTA PROMOSI / COMPLIMENTARY' : 'NOTA PENJUALAN',
          id: orderId,
          date: formatDate(todayStr),
          branch_name: currentBranch,
          admin_name: user?.name || 'Kasir',
          customer_name: custName,
          items: cart.map(item => ({ name: item.name, qty: item.qty, subtotal: item.price * item.qty })),
          amount: cartTotal,
          paymentMethod: finalPaymentMethod.replace(/_/g, ' '),
          history: orderMode === 'INFLUENCER' ? undefined : {
             labelLama: 'Total Belanja', nominalLama: cartTotal,
             labelAksi: 'Dibayar (DP/Lunas)', nominalAksi: nominalBayar,
             labelBaru: 'Sisa kekurangan', nominalBaru: Math.max(0, cartTotal - nominalBayar)
          }
        });
      }

      // Reset Kasir
      setCart([]);
      setSelectedCustomerId('');
      setAmountPaid('');
      setNotes('');
      setOrderMode('REGULAR');
      setPaymentMethod('CASH');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-300">
      
      {/* KIRI: AREA KATALOG PRODUK */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="card-holo p-5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <ShoppingCart className="text-blue-600" size={20}/>
            <h2 className="text-base font-extrabold text-slate-800 normal-case">Kasir point of sale</h2>
          </div>
          <div className="relative w-48 md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input type="text" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500 transition-colors shadow-inner" placeholder="Cari nama menu..." />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto custom-scrollbar max-h-[70vh] pb-4">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-20 text-slate-400 font-medium normal-case">Menu tidak ditemukan.</div>
          ) : (
            filteredProducts.map(product => (
              <div key={product.id} onClick={() => addToCart(product)} className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between h-full group">
                <div>
                  <div className="text-[9px] font-bold text-slate-400 normal-case mb-1">
                    {product.category === 'READY_TO_EAT' ? 'Matang' : 'Frozen'}
                  </div>
                  <h3 className="font-extrabold text-slate-800 text-sm leading-tight normal-case group-hover:text-blue-600 transition-colors">
                    {product.product_name}
                  </h3>
                </div>
                <div className="mt-3 text-blue-600 font-black text-sm">
                  {formatRupiah(product.selling_price)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* KANAN: AREA KERANJANG & CHECKOUT */}
      <div className="w-full lg:w-[400px] xl:w-[450px] shrink-0 flex flex-col gap-4">
        
        {/* PANEL KERANJANG */}
        <div className="card-holo flex flex-col max-h-[45vh] shadow-xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
            <h3 className="font-extrabold text-slate-800 normal-case text-sm flex items-center gap-2"><Receipt size={16} className="text-blue-600"/> Detail pesanan</h3>
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold shadow-xs">{cart.length} Item</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-white">
            {cart.length === 0 ? (
              <div className="text-center py-10 text-slate-400 font-medium normal-case text-sm flex flex-col items-center">
                <ShoppingCart size={32} className="mb-2 opacity-20"/>
                Keranjang masih kosong
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-lg hover:border-slate-200 transition-colors">
                    <div className="flex-1 pr-2">
                      <div className="font-bold text-slate-800 text-xs normal-case line-clamp-1">{item.name}</div>
                      <div className="text-blue-600 font-extrabold text-[11px] mt-0.5">{formatRupiah(item.price)}</div>
                    </div>
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs shrink-0">
                      <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-md transition-colors"><Minus size={12}/></button>
                      <span className="w-6 text-center font-extrabold text-xs">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-md transition-colors"><Plus size={12}/></button>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="ml-2 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-slate-500 normal-case">Subtotal HPP (Modal)</span>
              <span className="text-xs font-bold text-slate-500">{formatRupiah(cartHPP)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-extrabold text-slate-800 normal-case">Total tagihan</span>
              <span className="text-lg font-black text-blue-600">{orderMode === 'INFLUENCER' ? 'Rp 0 (Promo)' : formatRupiah(cartTotal)}</span>
            </div>
          </div>
        </div>

        {/* PANEL CHECKOUT & PAYMENT */}
        <div className="card-holo p-5 border-t-4 border-t-blue-500 shadow-xs">
          <form className="space-y-4">
            
            {/* Customer Selection (CRM Sync) */}
            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1 flex items-center gap-1"><UserCheck size={12}/> Pilih pelanggan / jalur</label>
              <select required value={selectedCustomerId} onChange={e=>setSelectedCustomerId(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold normal-case text-slate-800 outline-none cursor-pointer focus:border-blue-500 focus:bg-white transition-colors">
                <option value="">-- Pilih customer (Wajib) --</option>
                {activeCustomers.map(c => (
                  <option key={c.id} value={c.id}>{c.customer_name} ({c.category.replace(/_/g, ' ')})</option>
                ))}
              </select>
            </div>

            {/* Toggle Mode Promosi/Influencer */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between cursor-pointer hover:border-slate-300 transition-colors" onClick={() => setOrderMode(prev => prev === 'REGULAR' ? 'INFLUENCER' : 'REGULAR')}>
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${orderMode === 'INFLUENCER' ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-500'}`}><Gift size={14}/></div>
                <div>
                  <div className="text-xs font-extrabold text-slate-800 normal-case">Mode influencer / Promosi</div>
                  <div className="text-[9px] font-medium text-slate-500 normal-case">HPP menu akan masuk ke beban biaya</div>
                </div>
              </div>
              <div className={`w-10 h-5 rounded-full relative transition-colors ${orderMode === 'INFLUENCER' ? 'bg-red-500' : 'bg-slate-300'}`}>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${orderMode === 'INFLUENCER' ? 'translate-x-5' : ''}`}></div>
              </div>
            </div>

            {orderMode === 'REGULAR' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Metode bayar</label>
                    <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold normal-case text-slate-800 outline-none cursor-pointer focus:border-blue-500">
                      {paymentOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Nominal dibayar</label>
                    <div className="relative">
                      <input type="text" required value={amountPaid ? Number(amountPaid).toLocaleString('id-ID') : ''} onChange={e=>setAmountPaid(e.target.value.replace(/\D/g, ''))} className="w-full pl-2 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-extrabold text-slate-800 outline-none focus:border-blue-500 transition-colors shadow-inner" placeholder="Rp 0" />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                   <button type="button" onClick={setLunas} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-md border border-blue-100 hover:bg-blue-100 transition-colors normal-case">Set lunas otomatis</button>
                </div>
              </>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-500 normal-case block mb-1 flex items-center gap-1"><Tag size={12}/> Catatan khusus</label>
              <input type="text" value={notes} onChange={e=>setNotes(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium normal-case outline-none focus:border-blue-500 transition-colors" placeholder={orderMode === 'INFLUENCER' ? "Ketik nama influencer / event promo..." : "Catatan kasir..."} />
            </div>

            <button type="button" onClick={handleCheckout} className={`w-full text-white font-bold py-3.5 rounded-lg text-xs normal-case shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 ${orderMode === 'INFLUENCER' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
              <CheckCircle2 size={16}/> {orderMode === 'INFLUENCER' ? 'Sahkan promo & catat beban HPP' : 'Proses pembayaran'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
