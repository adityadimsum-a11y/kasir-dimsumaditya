import React, { useState, useMemo } from 'react';
import { 
  ShoppingCart, Plus, Minus, Trash2, Search, 
  CreditCard, UserCheck, Tag, Receipt, 
  CheckCircle2, AlertOctagon, Gift, Package, Snowflake, Timer, Calendar, UserPlus, Filter
} from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import SearchableDropdown from '../ui/SearchableDropdown';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabOrders({ 
  orders = [], 
  masterProducts = [], master_products,
  masterCustomers = [], master_customers,
  inventoryCostLayers = [], productionBatches = [],
  sendToSheet, setPrintData, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';

  // --- SINKRONISASI DATABASE ---
  const realProducts = useMemo(() => master_products || masterProducts || [], [master_products, masterProducts]);
  const realCustomers = useMemo(() => master_customers || masterCustomers || [], [master_customers, masterCustomers]);

  const activeProducts = useMemo(() => realProducts.filter(p => !p.isDeleted && String(p.isDeleted).toUpperCase() !== 'TRUE'), [realProducts]);
  const activeCustomers = useMemo(() => realCustomers.filter(c => !c.isDeleted).reverse(), [realCustomers]);

  // --- STATE MANAJEMEN KASIR ---
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [orderMode, setOrderMode] = useState('REGULAR'); // REGULAR | INFLUENCER
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');

  // Saringan Filter Histori Nota Bawah
  const [historyFilter, setHistoryFilter] = useState({ dateFrom: todayStr, dateTo: todayStr });

  // State Popup Pendaftaran Pelanggan Baru Langsung di Tempat (Inline)
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustForm, setNewCustForm] = useState({ name: '', phone: '', address: '', category: 'RESELLER', notes: '' });

  // --- ENGINE SINKRONISASI STOK LIVE INVENTORY & KONVERSI UNIT SAKTI ---
  const stockInventoryEngine = useMemo(() => {
    const layerMap = {};
    let totalFreezer = 0;
    
    (inventoryCostLayers || []).forEach(layer => {
      if (!layer.isDeleted && layer.status === 'ACTIVE' && layer.branch_id === currentBranch) {
        const qty = Number(layer.qty_remaining || 0);
        layerMap[layer.item_name] = (layerMap[layer.item_name] || 0) + qty;
        if (String(layer.item_name).toUpperCase().includes('DIMSUM')) totalFreezer += qty;
      }
    });

    let totalKarantina = 0;
    (productionBatches || []).forEach(batch => {
      if (!batch.isDeleted && batch.date === todayStr && batch.branch_id === currentBranch) {
        totalKarantina += Number(batch.actual_yield || 0);
      }
    });

    return { layerMap, totalFreezer, totalKarantina };
  }, [inventoryCostLayers, productionBatches, currentBranch, todayStr]);

  // Fungsi Pembantu Konversi Satuan untuk Ditampilkan di Katalog
  const renderConvertedStockLabel = (productName, currentPcs) => {
    const prod = activeProducts.find(p => p.product_name === productName);
    const pcsPerPorsi = prod ? Number(prod.pcs_per_porsi || 4) : 4; 
    
    const mikaValue = Math.floor(currentPcs / 50);
    const porsiValue = Math.floor(currentPcs / pcsPerPorsi);

    return (
      <div className="text-[10px] font-bold text-slate-500 normal-case mt-1 space-y-0.5">
        <div>{formatNumber(currentPcs)} PCS</div>
        <div className="text-blue-600 font-black">Setara {formatNumber(mikaValue)} Mika (Isi 50)</div>
        <div className="text-amber-600 font-black">Setara {formatNumber(porsiValue)} Porsi (Isi {pcsPerPorsi})</div>
      </div>
    );
  };

  // --- OPSI PEMBAYARAN OPERASIONAL ---
  const paymentOptions = useMemo(() => {
    if (isHQ || currentBranch === 'PRODUKSI_PEMALANG') {
      return [
        { id: 'CASH', label: 'Cash (Tunai Laci)' },
        { id: 'PIUTANG', label: 'Piutang (Tempo Pelanggan)' },
        { id: 'TF_BCA_PUSAT', label: 'Transfer BCA Pusat' },
        { id: 'TF_BRI_PUSAT', label: 'Transfer BRI Pusat' }
      ];
    }
    return [
      { id: 'CASH', label: 'Cash (Tunai Laci)' },
      { id: 'TF_QRIS', label: 'Transfer / QRIS' }
    ];
  }, [isHQ, currentBranch]);

  const customerDropdownOptions = useMemo(() => {
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

  // --- HISTORI NOTA TRANSAKSI BAWAH LAYOUT ---
  const listHistoryOrders = useMemo(() => {
    return (orders || [])
      .filter(o => {
        if (o.isDeleted) return false;
        if (!isHQ && o.branch_id !== currentBranch) return false;
        const oDate = o.date.substring(0, 10);
        return oDate >= historyFilter.dateFrom && oDate <= historyFilter.dateTo;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [orders, historyFilter, isHQ, currentBranch]);

  // --- ACTIONS KERANJANG ---
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
    setCart(prev => prev.map(item => (item.id === id) ? { ...item, qty: Math.max(1, newQty) } : item));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const cartHPP = cart.reduce((sum, item) => sum + (item.hpp * item.qty), 0);

  const setLunas = (e) => {
    e.preventDefault();
    setAmountPaid(String(cartTotal));
  };

  // --- SUBMIT PELANGGAN BARU LANGSUNG DI TEMPAT ---
  const handleAddCustomerInline = async (e) => {
    e.preventDefault();
    if (!newCustForm.name) return alert("Nama pelanggan tidak boleh kosong!");
    
    const custId = generateId('CST', todayStr);
    const payload = {
      id: custId,
      date: todayStr,
      customer_name: newCustForm.name.toUpperCase(),
      phone: newCustForm.phone || '-',
      address: newCustForm.address || '-',
      category: newCustForm.category,
      notes: newCustForm.notes.toUpperCase() || '-',
      branch_id: currentBranch,
      isDeleted: false
    };

    const success = await sendToSheet('insert', payload, 'master_customers');
    if (success) {
      showToast(`Pelanggan ${payload.customer_name} sukses terdaftar!`, 'success');
      setSelectedCustomerId(custId); // Langsung pilih otomatis di kasir
      setShowAddCustomerModal(false);
      setNewCustForm({ name: '', phone: '', address: '', category: 'RESELLER', notes: '' });
    }
  };

  // --- EKSEKUSI CHECKOUT SAKTI ---
  const handleCheckout = async () => {
    if (cart.length === 0) return alert("Keranjang belanja masih kosong!");
    if (!selectedCustomerId) return alert("Wajib memilih nama pelanggan terlebih dahulu!");
    if (orderMode === 'REGULAR' && amountPaid === '' && paymentMethod !== 'PIUTANG') return alert("Nominal pembayaran tidak boleh kosong!");

    const customer = activeCustomers.find(c => c.id === selectedCustomerId);
    const custName = customer ? customer.customer_name : 'Pelanggan Umum';
    const custCategory = customer ? customer.category : 'OFFLINE';

    const orderId = generateId('INV', todayStr);
    const nominalBayar = orderMode === 'INFLUENCER' ? 0 : (paymentMethod === 'PIUTANG' && amountPaid === '' ? 0 : Number(amountPaid));
    const finalPaymentMethod = orderMode === 'INFLUENCER' ? 'PROMO_MARKETING' : paymentMethod;
    const finalStatus = orderMode === 'INFLUENCER' ? 'LUNAS' : (nominalBayar >= cartTotal ? 'LUNAS' : 'BELUM_LUNAS');

    // Validasi Pengaman Potong Stok Live Sebelum Menembak Server
    let stockSafe = true;
    cart.forEach(item => {
      const availStock = stockInventoryEngine.layerMap[item.name] || 0;
      if (availStock < item.qty) {
        stockSafe = false;
      }
    });

    if (!stockSafe && !window.confirm("⚠️ Peringatan: Salah satu produk dalam keranjang memiliki kuantitas melebihi stok fisik freezer saat ini. Tetap paksa lanjutkan transaksi penjualan?")) {
      return;
    }

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
      if (orderMode === 'INFLUENCER') {
        const expPayload = {
          id: generateId('EXP', todayStr), date: todayStr, branch_id: currentBranch,
          category: 'BIAYA_PROMOSI', expense_name: `Promo Influencer: ${custName}`,
          amount: cartHPP, payment_method: 'SISTEM',
          description: `Klaim menu promosi gratis (${cart.reduce((s,i)=>s+i.qty,0)} Pcs). Nilai HPP dibebankan ke pos biaya promosi.`,
          isDeleted: false
        };
        await sendToSheet('insert', expPayload, 'expenses');
      } else if (nominalBayar > 0) {
        const cfPayload = {
          id: generateId('CFI', todayStr), date: todayStr, branch_id: currentBranch,
          type: 'IN', category: 'PENJUALAN POS',
          description: `Nota INV: ${orderId} - Pelanggan: ${custName} (${finalStatus})`,
          amount: nominalBayar, method: finalPaymentMethod, reference_id: orderId,
          isDeleted: false
        };
        await sendToSheet('insert', cfPayload, 'cashflow_transactions');
      }

      showToast(`Transaksi ${orderId} sukses diproses!`, 'success');

      // Cetak Dokumen Struk Thermal ala GrabMerchant Kertas Continuous Form
      setPrintData({
        title: orderMode === 'INFLUENCER' ? 'NOTA PROMOSI / COMPLIMENTARY' : 'INVOICE PENJUALAN PREMIUM',
        id: orderId, date: formatDate(todayStr),
        branch_name: currentBranch.replace(/_/g, ' '), admin_name: user?.name || 'Kasir', customer_name: custName,
        items: cart.map(item => ({ name: item.name, qty: item.qty, subtotal: item.price * item.qty })),
        amount: cartTotal, paymentMethod: finalPaymentMethod.replace(/_/g, ' '),
        history: orderMode === 'INFLUENCER' ? undefined : {
           labelLama: 'Total Belanja', nominalLama: cartTotal,
           labelAksi: 'Nominal Dibayar', nominalAksi: nominalBayar,
           labelBaru: 'Sisa Kekurangan', nominalBaru: Math.max(0, cartTotal - nominalBayar)
        }
      });

      setCart([]); setSelectedCustomerId(''); setAmountPaid(''); setNotes('');
      setOrderMode('REGULAR'); setPaymentMethod('CASH');
    }
  };

  return (
    <div className="space-y-6 pb-10">
      
      {/* ATAS: GRID KASIR POINT OF SALE UTAMA */}
      <div className="flex flex-col lg:flex-row gap-6 text-slate-700 normal-case">
        
        {/* KILI: AREA KATALOG PRODUK & MONITOR RADAR STOK */}
        <div className="flex-1 flex flex-col gap-4">
          {isHQ && (
            <div className="grid grid-cols-2 gap-4">
              <div className="card-holo bg-blue-50/40 border border-blue-200 p-4 rounded-2xl flex items-center justify-between shadow-3xs">
                <div>
                  <div className="text-[10px] font-black text-blue-600 uppercase mb-1 flex items-center gap-1.5"><Snowflake size={14}/> Stok Freezer Pabrik</div>
                  <div className="text-xl font-black text-slate-800">{formatNumber(stockInventoryEngine.totalFreezer)} <span className="text-xs font-bold text-slate-500">PCS</span></div>
                </div>
              </div>
              <div className="card-holo bg-amber-50/40 border border-amber-200 p-4 rounded-2xl flex items-center justify-between shadow-3xs">
                <div>
                  <div className="text-[10px] font-black text-amber-600 uppercase mb-1 flex items-center gap-1.5"><Timer size={14}/> Antrean Karantina Hasil Dapur</div>
                  <div className="text-xl font-black text-slate-800">{formatNumber(stockInventoryEngine.totalKarantina)} <span className="text-xs font-bold text-slate-500">PCS</span></div>
                </div>
              </div>
            </div>
          )}

          <div className="card-holo p-4 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-3xs gap-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-blue-600" size={18}/>
              <div>
                <h2 className="text-sm font-black text-slate-800 normal-case">Kasir Point of Sale</h2>
                <p className="text-[10px] font-bold text-slate-400 normal-case mt-0.5">Pilih produk dan tentukan jumlah volume belanja.</p>
              </div>
            </div>
            <div className="relative w-full sm:w-64 shrink-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input type="text" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:bg-white focus:border-blue-400 transition-colors shadow-inner normal-case" placeholder="Cari nama menu produk..." />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar max-h-[52vh] pb-4 pr-1">
            {filteredProducts.map(product => {
              const currentStock = stockInventoryEngine.layerMap[product.product_name] || 0;
              return (
                <div key={product.id} onClick={() => addToCart(product)} className="bg-white border border-slate-200 rounded-2xl p-4 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all flex flex-col justify-between h-full group relative shadow-2xs overflow-hidden">
                  <div className={`absolute top-0 right-0 px-2.5 py-1 text-[9px] font-black rounded-bl-xl ${currentStock > 500 ? 'bg-emerald-50 text-emerald-700 border-l border-b border-emerald-200' : currentStock > 0 ? 'bg-amber-50 text-amber-700 border-l border-b border-amber-200' : 'bg-rose-50 text-rose-700 border-l border-b border-rose-200'}`}>
                    {currentStock > 0 ? 'Tersedia' : 'Kosong'}
                  </div>
                  <div className="mt-2">
                    <h3 className="font-black text-slate-800 text-xs normal-case group-hover:text-blue-600 transition-colors pr-12 leading-tight">
                      {product.product_name}
                    </h3>
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Status Gudang Live:</div>
                      {renderConvertedStockLabel(product.product_name, currentStock)}
                    </div>
                  </div>
                  <div className="mt-4 pt-2 border-t border-slate-50 flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-medium">Harga Jual</span>
                    <span className="text-blue-600 font-black text-sm">{formatRupiah(product.selling_price)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* KANAN: AREA DETAIL PESANAN & CHECKOUT INTEGRASI CUSTOMER */}
        <div className="w-full lg:w-[420px] xl:w-[450px] shrink-0 flex flex-col gap-4">
          <div className="card-holo flex flex-col max-h-[40vh] bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-black text-slate-800 normal-case text-xs flex items-center gap-2"><Receipt size={14} className="text-blue-600"/> Detail Pesanan Keranjang</h3>
              <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg text-[9px] font-black shadow-3xs">{cart.length} Item</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="text-center py-16 text-slate-400 font-bold normal-case text-xs flex flex-col items-center justify-center">
                  <ShoppingCart size={32} className="mb-2 opacity-25 text-slate-400"/>
                  Keranjang masih kosong
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="flex-1 pr-2">
                        <div className="font-black text-slate-800 text-[11px] normal-case leading-tight">{item.name}</div>
                        <div className="text-blue-600 font-bold text-[10px] mt-1">{formatRupiah(item.price)}</div>
                        {renderConvertedStockLabel(item.name, item.qty)}
                      </div>
                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-3xs shrink-0">
                        <button onClick={() => updateQtyExact(item.id, item.qty - 1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-600"><Minus size={12}/></button>
                        <input type="number" value={item.qty} onChange={(e)=>updateQtyExact(item.id, parseInt(e.target.value) || 1)} className="w-10 text-center text-xs font-black text-slate-800 bg-transparent outline-none" />
                        <button onClick={() => updateQtyExact(item.id, item.qty + 1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-600"><Plus size={12}/></button>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="ml-2 p-1.5 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 size={14}/></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0 text-xs font-bold">
              <div className="flex justify-between items-center mb-1 text-slate-400">
                <span>Subtotal HPP (Modal)</span>
                <span>{formatRupiah(cartHPP)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-800">
                <span className="font-black">Total Tagihan</span>
                <span className="text-lg font-black text-blue-600 tracking-tight">{orderMode === 'INFLUENCER' ? 'Rp 0 (Promo)' : formatRupiah(cartTotal)}</span>
              </div>
            </div>
          </div>

          {/* PANEL PEMBAYARAN & SINKRONISASI CRM */}
          <div className="card-holo p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs border-t-4 border-t-blue-500">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[9px] font-bold text-slate-500 normal-case flex items-center gap-1"><UserCheck size={12}/> Pilih Pelanggan (Wajib)</label>
                  <button type="button" onClick={() => setShowAddCustomerModal(true)} className="text-[10px] font-black text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md shadow-3xs cursor-pointer">
                    <UserPlus size={10}/> + Pelanggan Baru
                  </button>
                </div>
                <SearchableDropdown 
                  options={customerDropdownOptions}
                  value={selectedCustomerId}
                  onChange={(opt) => setSelectedCustomerId(opt.id)}
                  placeholder="Ketik untuk mencari pelanggan..."
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between cursor-pointer hover:border-slate-300 shadow-inner" onClick={() => setOrderMode(p => p === 'REGULAR' ? 'INFLUENCER' : 'REGULAR')}>
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${orderMode === 'INFLUENCER' ? 'bg-red-100 text-red-600' : 'bg-white text-slate-400 border border-slate-200 shadow-3xs'}`}><Gift size={14}/></div>
                  <div>
                    <div className="text-[11px] font-black text-slate-800 normal-case">Mode Influencer / Promosi Gratis</div>
                    <div className="text-[9px] font-bold text-slate-500 normal-case mt-0.5">Biaya HPP otomatis masuk pos beban promosi marketing</div>
                  </div>
                </div>
                <div className={`w-10 h-5 rounded-full relative transition-colors ${orderMode === 'INFLUENCER' ? 'bg-red-500' : 'bg-slate-300'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${orderMode === 'INFLUENCER' ? 'translate-x-5 shadow-xs' : ''}`}></div>
                </div>
              </div>

              {orderMode === 'REGULAR' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Metode Pembayaran</label>
                      <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-800 outline-none cursor-pointer focus:bg-white shadow-3xs">
                        {paymentOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Nominal Dibayar (DP/Lunas)</label>
                      <input type="text" required={paymentMethod !== 'PIUTANG'} disabled={paymentMethod === 'PIUTANG'} value={paymentMethod === 'PIUTANG' ? '' : (amountPaid ? Number(amountPaid).toLocaleString('id-ID') : '')} onChange={e=>setAmountPaid(e.target.value.replace(/\D/g, ''))} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-800 outline-none focus:bg-white shadow-3xs disabled:opacity-50" placeholder={paymentMethod === 'PIUTANG' ? "Rp 0 (Hutang)" : "Rp 0"} />
                    </div>
                  </div>
                  {paymentMethod !== 'PIUTANG' && (
                    <div className="flex justify-end">
                      <button type="button" onClick={setLunas} className="text-[9px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors shadow-3xs cursor-pointer">Set Lunas Otomatis</button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Catatan Khusus Invoice</label>
                <input type="text" value={notes} onChange={e=>setNotes(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:bg-white shadow-3xs" placeholder="Ketik rincian memo catatan tambahan..." />
              </div>

              <button type="button" onClick={handleCheckout} className={`w-full text-white font-black py-4 rounded-xl text-xs normal-case shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${orderMode === 'INFLUENCER' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                <CheckCircle2 size={16}/> {orderMode === 'INFLUENCER' ? 'Sahkan Dokumen Promosi Gratis' : 'Sahkan & Proses Pembayaran Nota'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =======================================================
           bawah (`image_ff77c7.png`): JURNAL HISTORI TRANSAKSI AUDIT LENGKAP
      ======================================================= */}
      <div className="card-holo bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden w-full flex flex-col">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
          <div>
            <h3 className="font-black text-slate-800 text-xs flex items-center gap-2 normal-case"><Receipt size={16} className="text-blue-600"/> Buku Jurnal Arsip Riwayat Transaksi Penjualan</h3>
            <p className="text-[9px] font-bold text-slate-400 mt-0.5 normal-case">Audit data transaksi secara real-time berdasarkan saringan periode kustom.</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-xl shadow-3xs">
            <Filter size={12} className="text-blue-500 ml-1" />
            <input type="date" value={historyFilter.dateFrom} onChange={e=>setHistoryFilter(p=>({...p, dateFrom: e.target.value}))} className="text-[10px] font-bold text-slate-700 bg-transparent outline-none cursor-pointer" />
            <span className="text-slate-400 text-[10px] font-bold">s/d</span>
            <input type="date" value={historyFilter.dateTo} onChange={e=>setHistoryFilter(p=>({...p, dateTo: e.target.value}))} className="text-[10px] font-bold text-slate-700 bg-transparent outline-none cursor-pointer" />
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar p-1">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/50 text-[10px] text-slate-500 normal-case border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 font-black">No. Transaksi / Waktu</th>
                <th className="px-4 py-3 font-black">Pelanggan</th>
                <th className="px-4 py-3 font-black">Rincian Produk Dibeli</th>
                <th className="px-4 py-3 font-black text-center">Volume Qty</th>
                <th className="px-4 py-3 font-black text-center">Metode / Status</th>
                <th className="px-4 py-3 font-black text-right">Nilai Transaksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold text-xs bg-white text-slate-700">
              {listHistoryOrders.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-16 text-slate-400 font-medium normal-case">Tidak ada rekam jejak penjualan pada rentang tanggal terpilih.</td></tr>
              ) : (
                listHistoryOrders.map(item => {
                  const itemsParsed = safeJsonParse(item.items, []);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-slate-900 font-black text-[11px]">{item.id}</div>
                        <div className="text-[9px] text-slate-400 font-mono mt-0.5">{formatDate(item.date)}</div>
                        <div className="text-[9px] text-blue-500 font-medium normal-case mt-0.5">Gudang: {item.branch_id.replace(/_/g, ' ')}</div>
                      </td>
                      <td className="px-4 py-4 uppercase font-black text-slate-800 text-[11px]">
                        {item.customer_name}
                        <div className="text-[8px] font-bold text-slate-400 tracking-wider mt-0.5">JALUR: {item.sales_channel}</div>
                      </td>
                      <td className="px-4 py-4 normal-case font-medium text-[11px] text-slate-600 max-w-xs">
                        <div className="space-y-0.5">
                          {itemsParsed.map((it, idx) => (
                            <div key={idx}>• {it.name} <span className="text-blue-600 font-black">({it.qty} Pcs)</span></div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center font-black text-slate-700 text-sm">
                        {formatNumber(item.qty)} <span className="text-[9px] text-slate-400 font-normal">Pcs</span>
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[9px] font-black tracking-wide block w-max mx-auto mb-1">{item.payment_method.replace(/_/g, ' ')}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wide border block w-max mx-auto ${item.status === 'LUNAS' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'}`}>{item.status}</span>
                      </td>
                      <td className="px-4 py-4 text-right font-black text-slate-900 text-sm">
                        {formatRupiah(item.total_amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =======================================================
          MODAL DIALOG INLINE: + PENDAFTARAN PELANGGAN BARU
      ======================================================= */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <form onSubmit={handleAddCustomerInline} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <UserPlus className="text-blue-600" size={18}/>
              <h3 className="text-sm font-black text-slate-800 normal-case">Daftarkan Profil Pelanggan Baru</h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 normal-case block mb-1">Nama Pelanggan (Lengkap)</label>
                <input type="text" required value={newCustForm.name} onChange={e=>setNewCustForm({...newCustForm, name: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-bold outline-none bg-slate-50 focus:bg-white focus:border-blue-400 transition-colors" placeholder="Ketik nama lengkap..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 normal-case block mb-1">Nomor Telepon / HP</label>
                  <input type="text" value={newCustForm.phone} onChange={e=>setNewCustForm({...newCustForm, phone: e.target.value.replace(/\D/g, '')})} className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-bold outline-none bg-slate-50 focus:bg-white focus:border-blue-400 transition-colors" placeholder="08123xxx" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 normal-case block mb-1">Kategori Tingkatan</label>
                  <select value={newCustForm.category} onChange={e=>setNewCustForm({...newCustForm, category: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-[10px] font-bold outline-none bg-slate-50 cursor-pointer focus:bg-white">
                    <option value="RESELLER">RESELLER</option>
                    <option value="MITRA">MITRA</option>
                    <option value="AGEN_DISTRIBUTOR">AGEN DISTRIBUTOR</option>
                    <option value="ECERAN">ECERAN</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 normal-case block mb-1">Alamat Pengiriman</label>
                <input type="text" value={newCustForm.address} onChange={e=>setNewCustForm({...newCustForm, address: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-medium outline-none bg-slate-50 focus:bg-white focus:border-blue-400 transition-colors" placeholder="Ketik nama jalan, kota, wilayah..." />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 normal-case block mb-1">Keterangan / Deskripsi Khusus</label>
                <input type="text" value={newCustForm.notes} onChange={e=>setNewCustForm({...newCustForm, notes: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-medium outline-none bg-slate-50 focus:bg-white focus:border-blue-400 transition-colors" placeholder="Catatan tambahan..." />
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowAddCustomerModal(false)} className="flex-1 py-2.5 bg-slate-50 text-slate-600 border border-slate-200 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors normal-case">Batal (Esc)</button>
              <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition-colors shadow-sm normal-case">Simpan &amp; Pilih Otomatis</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
