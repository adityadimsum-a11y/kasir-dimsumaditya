import React, { useState, useMemo } from 'react';
import { 
  ShoppingCart, Plus, Minus, Trash2, Search, 
  CreditCard, UserCheck, Tag, Receipt, 
  CheckCircle2, AlertOctagon, Gift, Package, Snowflake, Timer
} from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import SearchableDropdown from '../ui/SearchableDropdown';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabOrders({ 
  masterProducts = [], master_products,
  masterCustomers = [], master_customers,
  inventoryCostLayers = [], productionBatches = [], // 🔥 Ditarik untuk baca stok
  sendToSheet, setPrintData, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  
  // 🔥 GEMBOK LOGIKA POS B2B (SULTAN) VS POS ECERAN (OUTLET)
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';
  const isPemalang = currentBranch === 'PRODUKSI_PEMALANG';
  const hasHQPaymentAccess = isHQ || isPemalang;

  // --- SINKRONISASI DATABASE ---
  const realProducts = useMemo(() => master_products || masterProducts || [], [master_products, masterProducts]);
  const realCustomers = useMemo(() => master_customers || masterCustomers || [], [master_customers, masterCustomers]);

  const activeProducts = useMemo(() => realProducts.filter(p => !p.isDeleted && String(p.isDeleted).toUpperCase() !== 'TRUE'), [realProducts]);
  const activeCustomers = useMemo(() => realCustomers.filter(c => !c.isDeleted).reverse(), [realCustomers]);

  // --- ENGINE BACA STOK LIVE (FREEZER & KARANTINA) ---
  const stockData = useMemo(() => {
    const map = {};
    let totalFreezer = 0;
    
    // Baca Stok Gudang / Freezer
    (inventoryCostLayers || []).forEach(layer => {
      if (!layer.isDeleted && layer.status === 'ACTIVE' && layer.branch_id === currentBranch) {
        const qty = Number(layer.qty_remaining || 0);
        map[layer.item_name] = (map[layer.item_name] || 0) + qty;
        if (String(layer.item_name).toUpperCase().includes('DIMSUM')) totalFreezer += qty;
      }
    });

    // Baca Stok Karantina (Produksi Hari Ini yang belum masuk FIFO gudang)
    let totalKarantina = 0;
    (productionBatches || []).forEach(batch => {
      if (!batch.isDeleted && batch.date === todayStr && batch.branch_id === currentBranch) {
        totalKarantina += Number(batch.actual_yield || 0);
      }
    });

    return { map, totalFreezer, totalKarantina };
  }, [inventoryCostLayers, productionBatches, currentBranch, todayStr]);

  // --- STATE MANAJEMEN KASIR ---
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form Pembayaran
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [orderMode, setOrderMode] = useState('REGULAR'); // REGULAR | INFLUENCER
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');

  // --- OPSI PEMBAYARAN DINAMIS ---
  const paymentOptions = useMemo(() => {
    if (hasHQPaymentAccess) {
      return [
        { id: 'CASH', label: 'Cash (Tunai Laci)' },
        { id: 'PIUTANG', label: 'Piutang (Tempo Agen)' }, // 🔥 B2B Wajib ada Piutang
        { id: 'TF_BCA_PUSAT', label: 'Transfer BCA Pusat' },
        { id: 'TF_BRI_PUSAT', label: 'Transfer BRI Pusat' }
      ];
    }
    return [
      { id: 'CASH', label: 'Cash (Tunai Laci)' },
      { id: 'TF_QRIS', label: 'Transfer / QRIS' }
    ];
  }, [hasHQPaymentAccess]);

  const customerOptionsDropdown = useMemo(() => {
    return activeCustomers.map(c => ({
      id: c.id,
      name: `${c.customer_name} (${c.category.replace(/_/g, ' ')})`
    }));
  }, [activeCustomers]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return activeProducts;
    const s = searchTerm.toLowerCase();
    return activeProducts.filter(p => (p.product_name || '').toLowerCase().includes(s));
  }, [activeProducts, searchTerm]);

  // --- FUNGSI KERANJANG BELANJA GROSIR ---
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

  const updateQtyExact = (id, newQty) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
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
    if (!selectedCustomerId) return alert("Pilih nama agen / pelanggan dari dropdown!");
    if (orderMode === 'REGULAR' && amountPaid === '' && paymentMethod !== 'PIUTANG') return alert("Nominal bayar atau DP tidak boleh kosong!");

    const customer = activeCustomers.find(c => c.id === selectedCustomerId);
    const custName = customer ? customer.customer_name : 'Pelanggan Umum';
    const custCategory = customer ? customer.category : 'OFFLINE';

    const orderId = generateId('INV', todayStr);
    const nominalBayar = orderMode === 'INFLUENCER' ? 0 : (paymentMethod === 'PIUTANG' && amountPaid === '' ? 0 : Number(amountPaid));
    const finalPaymentMethod = orderMode === 'INFLUENCER' ? 'PROMO_MARKETING' : paymentMethod;
    const finalStatus = orderMode === 'INFLUENCER' ? 'LUNAS' : (nominalBayar >= cartTotal ? 'LUNAS' : 'BELUM_LUNAS');

    const confirmMsg = orderMode === 'INFLUENCER' 
      ? `Konfirmasi pemberian gratis (Influencer/Promo):\n\nCustomer: ${custName}\nTotal item: ${cart.reduce((s,i)=>s+i.qty,0)} Pcs\nNilai HPP (Beban promo): ${formatRupiah(cartHPP)}\n\nLanjutkan?`
      : `Konfirmasi POS Grosir:\n\nTotal belanja: ${formatRupiah(cartTotal)}\nNominal dibayar: ${formatRupiah(nominalBayar)}\nMetode: ${finalPaymentMethod.replace(/_/g, ' ')}\n\nLanjutkan checkout?`;

    if (!window.confirm(confirmMsg)) return;

    // 1. PAYLOAD NOTA PENJUALAN
    const orderPayload = {
      id: orderId, date: todayStr, branch_id: currentBranch,
      customer_name: custName, sales_channel: custCategory,
      items: JSON.stringify(cart), qty: cart.reduce((sum, item) => sum + item.qty, 0),
      total_amount: cartTotal, amount_paid: nominalBayar,
      payment_method: finalPaymentMethod, status: finalStatus,
      notes: notes || '-', isDeleted: false
    };

    const isOrderSuccess = await sendToSheet('insert', orderPayload, 'orders');

    if (isOrderSuccess) {
      // 2A. JIKA INFLUENCER -> MASUK BEBAN PENGELUARAN (HPP)
      if (orderMode === 'INFLUENCER') {
        const expPayload = {
          id: generateId('EXP', todayStr), date: todayStr, branch_id: currentBranch,
          category: 'BIAYA_PROMOSI', expense_name: `Promo Influencer: ${custName}`,
          amount: cartHPP, payment_method: 'SISTEM',
          description: `Pemberian menu gratis (${cart.reduce((s,i)=>s+i.qty,0)} Pcs). Nilai HPP dicatat sebagai beban promosi. Catatan: ${notes}`,
          isDeleted: false
        };
        await sendToSheet('insert', expPayload, 'expenses');
      } 
      // 2B. JIKA REGULAR & ADA UANG MASUK -> MASUK CASHFLOW IN
      else if (nominalBayar > 0) {
        const cfPayload = {
          id: generateId('CFI', todayStr), date: todayStr, branch_id: currentBranch,
          type: 'IN', category: 'PENJUALAN POS',
          description: `INV: ${orderId} - Pelanggan: ${custName} (${finalStatus.replace('_', ' ')})`,
          amount: nominalBayar, method: finalPaymentMethod, reference_id: orderId,
          isDeleted: false
        };
        await sendToSheet('insert', cfPayload, 'cashflow_transactions');
      }

      showToast(`Transaksi berhasil diproses & Stok otomatis terpotong!`, 'success');

      // 3. AUTO PRINT DOT MATRIX
      if (window.confirm("Cetak struk nota untuk pelanggan?")) {
        setPrintData({
          title: orderMode === 'INFLUENCER' ? 'NOTA PROMOSI / COMPLIMENTARY' : 'INVOICE DISTRIBUSI (B2B)',
          id: orderId, date: formatDate(todayStr),
          branch_name: currentBranch.replace(/_/g, ' '), admin_name: user?.name || 'Kasir', customer_name: custName,
          items: cart.map(item => ({ name: item.name, qty: item.qty, subtotal: item.price * item.qty })),
          amount: cartTotal, paymentMethod: finalPaymentMethod.replace(/_/g, ' '),
          history: orderMode === 'INFLUENCER' ? undefined : {
             labelLama: 'Total Belanja', nominalLama: cartTotal,
             labelAksi: 'Dibayar (DP/Lunas)', nominalAksi: nominalBayar,
             labelBaru: 'Sisa Kekurangan', nominalBaru: Math.max(0, cartTotal - nominalBayar)
          }
        });
      }

      // Reset Kasir
      setCart([]); setSelectedCustomerId(''); setAmountPaid(''); setNotes('');
      setOrderMode('REGULAR'); setPaymentMethod('CASH');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-300">
      
      {/* KIRI: AREA KATALOG PRODUK & RADAR STOK (KHUSUS PUSAT) */}
      <div className="flex-1 flex flex-col gap-4">
        
        {/* 🔥 RADAR STOK PABRIK (HANYA MUNCUL DI PUSAT) */}
        {isHQ && (
          <div className="grid grid-cols-2 gap-4">
            <div className="card-holo bg-blue-50/50 border border-blue-200 p-4 rounded-2xl flex items-center justify-between shadow-2xs">
              <div>
                <div className="text-[10px] font-black text-blue-600 normal-case mb-1 flex items-center gap-1.5"><Snowflake size={14}/> Stok Freezer Pabrik</div>
                <div className="text-2xl font-black text-slate-800">{formatNumber(stockData.totalFreezer)} <span className="text-xs font-bold text-slate-500">Pcs</span></div>
              </div>
            </div>
            <div className="card-holo bg-amber-50/50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between shadow-2xs">
              <div>
                <div className="text-[10px] font-black text-amber-600 normal-case mb-1 flex items-center gap-1.5"><Timer size={14}/> Antrean Karantina (H-0)</div>
                <div className="text-2xl font-black text-slate-800">{formatNumber(stockData.totalKarantina)} <span className="text-xs font-bold text-slate-500">Pcs</span></div>
              </div>
            </div>
          </div>
        )}

        <div className="card-holo p-4 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-2xs gap-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="text-blue-600" size={18}/>
            <div>
              <h2 className="text-sm font-black text-slate-800 normal-case">Katalog POS B2B</h2>
              <p className="text-[9px] font-bold text-slate-400 normal-case mt-0.5">Sistem grosir dan eceran terpadu.</p>
            </div>
          </div>
          <div className="relative w-full sm:w-64 shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input type="text" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:bg-white focus:border-blue-400 transition-colors shadow-3xs normal-case" placeholder="Cari nama produk..." />
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar max-h-[60vh] pb-4 pr-1">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-20 text-slate-400 font-medium normal-case text-xs">Produk tidak ditemukan.</div>
          ) : (
            filteredProducts.map(product => {
              const currentStock = stockData.map[product.product_name] || 0;
              return (
                <div key={product.id} onClick={() => addToCart(product)} className="bg-white border border-slate-200 rounded-2xl p-4 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between h-full group relative shadow-2xs overflow-hidden">
                  
                  {/* BADGE STOK LIVE */}
                  <div className={`absolute top-0 right-0 px-3 py-1 text-[9px] font-black rounded-bl-xl ${currentStock > 1000 ? 'bg-emerald-100 text-emerald-700' : currentStock > 0 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                    Stok: {formatNumber(currentStock)}
                  </div>

                  <div className="mt-2">
                    <div className="text-[9px] font-bold text-slate-400 normal-case mb-1 flex items-center gap-1">
                      <Package size={10}/> {product.category === 'READY_TO_EAT' ? 'Matang' : 'Frozen'}
                    </div>
                    <h3 className="font-black text-slate-800 text-xs normal-case group-hover:text-blue-600 transition-colors pr-6">
                      {product.product_name}
                    </h3>
                  </div>
                  <div className="mt-3 text-blue-600 font-black text-sm">
                    {formatRupiah(product.selling_price)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* KANAN: AREA KERANJANG GROSIR & CHECKOUT (SULTAN MODE) */}
      <div className="w-full lg:w-[420px] xl:w-[460px] shrink-0 flex flex-col gap-4">
        
        {/* PANEL KERANJANG */}
        <div className="card-holo flex flex-col max-h-[50vh] bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
            <h3 className="font-black text-slate-800 normal-case text-xs flex items-center gap-2"><Receipt size={14} className="text-blue-600"/> Keranjang Belanja</h3>
            <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg text-[9px] font-black shadow-3xs">{cart.length} Item</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-bold normal-case text-[11px] flex flex-col items-center">
                <ShoppingCart size={36} className="mb-3 opacity-20"/>
                Keranjang masih kosong. Klik produk di sebelah kiri.
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-blue-200 transition-colors">
                    <div className="flex-1 pr-3">
                      <div className="font-black text-slate-800 text-[11px] normal-case leading-tight">{item.name}</div>
                      <div className="text-blue-600 font-black text-[10px] mt-1">{formatRupiah(item.price)} <span className="text-slate-400 font-medium">/pcs</span></div>
                    </div>
                    
                    {/* INPUT GROSIR SULTAN (Bisa diketik manual) */}
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 shadow-3xs shrink-0">
                      <button onClick={() => updateQtyExact(item.id, item.qty - 1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Minus size={12}/></button>
                      <input 
                        type="number" 
                        value={item.qty} 
                        onChange={(e) => updateQtyExact(item.id, parseInt(e.target.value) || 0)}
                        className="w-12 text-center text-xs font-black text-slate-800 bg-transparent outline-none hide-arrows"
                      />
                      <button onClick={() => updateQtyExact(item.id, item.qty + 1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Plus size={12}/></button>
                    </div>
                    
                    <button onClick={() => removeFromCart(item.id)} className="ml-2 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-slate-500 normal-case">Subtotal HPP Modal</span>
              <span className="text-[10px] font-black text-slate-500">{formatRupiah(cartHPP)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-slate-800 normal-case">Total Tagihan B2B</span>
              <span className="text-xl font-black text-blue-600 tracking-tight">{orderMode === 'INFLUENCER' ? 'Rp 0 (Promo)' : formatRupiah(cartTotal)}</span>
            </div>
          </div>
        </div>

        {/* PANEL CHECKOUT & PAYMENT */}
        <div className="card-holo p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs border-t-4 border-t-blue-500">
          <form className="space-y-4">
            
            {/* DROPDOWN PINTAR (SEARCHABLE) UNTUK NAMA AGEN/CUSTOMER */}
            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1.5 flex items-center gap-1"><UserCheck size={12}/> Cari &amp; Pilih Agen / Pelanggan</label>
              <SearchableDropdown 
                 options={customerOptionsDropdown}
                 value={selectedCustomerId}
                 onChange={(opt) => setSelectedCustomerId(opt.id)}
                 placeholder="Ketik nama agen..."
              />
            </div>

            {/* Toggle Mode Promosi/Influencer */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between cursor-pointer hover:border-slate-300 transition-colors shadow-inner" onClick={() => setOrderMode(prev => prev === 'REGULAR' ? 'INFLUENCER' : 'REGULAR')}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${orderMode === 'INFLUENCER' ? 'bg-red-100 text-red-600 shadow-sm' : 'bg-white text-slate-400 border border-slate-200 shadow-3xs'}`}><Gift size={14}/></div>
                <div>
                  <div className="text-[11px] font-black text-slate-800 normal-case">Mode Influencer / Promosi Gratis</div>
                  <div className="text-[9px] font-bold text-slate-500 normal-case mt-0.5">Nilai HPP akan dicatat sebagai beban promosi</div>
                </div>
              </div>
              <div className={`w-10 h-5 rounded-full relative transition-colors ${orderMode === 'INFLUENCER' ? 'bg-red-500' : 'bg-slate-300'}`}>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${orderMode === 'INFLUENCER' ? 'translate-x-5 shadow-sm' : ''}`}></div>
              </div>
            </div>

            {orderMode === 'REGULAR' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1.5">Metode Pembayaran</label>
                    <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold normal-case text-slate-800 outline-none cursor-pointer focus:bg-white focus:border-blue-400 transition-colors shadow-3xs">
                      {paymentOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1.5">Nominal Dibayar (DP/Lunas)</label>
                    <div className="relative">
                      <input type="text" required={paymentMethod !== 'PIUTANG'} disabled={paymentMethod === 'PIUTANG'} value={paymentMethod === 'PIUTANG' ? '' : (amountPaid ? Number(amountPaid).toLocaleString('id-ID') : '')} onChange={e=>setAmountPaid(e.target.value.replace(/\D/g, ''))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-800 outline-none focus:bg-white focus:border-blue-400 transition-colors shadow-3xs disabled:opacity-50" placeholder={paymentMethod === 'PIUTANG' ? "Rp 0 (Hutang)" : "Rp 0"} />
                    </div>
                  </div>
                </div>
                
                {paymentMethod !== 'PIUTANG' && (
                  <div className="flex justify-end">
                     <button type="button" onClick={setLunas} className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors normal-case shadow-3xs cursor-pointer active:scale-95">Set lunas otomatis</button>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1.5 flex items-center gap-1"><Tag size={12}/> Catatan Khusus Invoice</label>
              <input type="text" value={notes} onChange={e=>setNotes(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold normal-case outline-none focus:bg-white focus:border-blue-400 transition-colors shadow-3xs" placeholder={orderMode === 'INFLUENCER' ? "Ketik nama influencer / detail promosi..." : "Catatan kasir, misal: Titip supir A..."} />
            </div>

            <button type="button" onClick={handleCheckout} className={`w-full text-white font-black py-4 rounded-xl text-xs normal-case shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer mt-2 ${orderMode === 'INFLUENCER' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
              <CheckCircle2 size={16}/> {orderMode === 'INFLUENCER' ? 'Sahkan Promo & Catat Beban' : 'Sahkan Transaksi B2B'}
            </button>
          </form>
        </div>

      </div>
      
      {/* CSS untuk menyembunyikan panah naik turun di input number */}
      <style>{`
        .hide-arrows::-webkit-outer-spin-button,
        .hide-arrows::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .hide-arrows { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}
