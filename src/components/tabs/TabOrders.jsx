import React, { useState, useMemo } from 'react';
import { 
  ShoppingCart, Plus, Minus, Trash2, Search, 
  UserCheck, Tag, Receipt, 
  CheckCircle2, Gift, Package, PlusCircle, Printer, TrendingUp, Eye, Edit
} from 'lucide-react';
import { getTodayStr, generateId, formatDate, safeJsonParse } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabOrders({ 
  masterProducts = [], master_products,
  masterCustomers = [], master_customers,
  inventoryCostLayers = [], orders = [], piutangPayments = [],
  sendToSheet, setPrintData, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  // --- SINKRONISASI DATABASE ---
  const realProducts = useMemo(() => master_products || masterProducts || [], [master_products, masterProducts]);
  const realCustomers = useMemo(() => master_customers || masterCustomers || [], [master_customers, masterCustomers]);

  const activeProducts = useMemo(() => realProducts.filter(p => !p.isDeleted), [realProducts]);
  const activeCustomers = useMemo(() => realCustomers.filter(c => !c.isDeleted).reverse(), [realCustomers]);

  // --- STATE MANAJEMEN KASIR ---
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchHistoryTerm, setSearchHistoryTerm] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState(''); 
  
  const [historyDateFrom, setHistoryDateFrom] = useState(todayStr);
  const [historyDateTo, setHistoryDateTo] = useState(todayStr);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [orderMode, setOrderMode] = useState('REGULAR'); 
  const [notes, setNotes] = useState('');

  const [payCash, setPayCash] = useState('');
  const [payBCA, setPayBCA] = useState('');
  const [payBRI, setPayBRI] = useState('');
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  
  const [singleMethod, setSingleMethod] = useState('CASH'); 
  const [singleAmountPaid, setSingleAmountPaid] = useState(''); 
  const [dpMethod, setDpMethod] = useState('CASH');

  // STATE MODE EDIT NOTA LAMA
  const [editingOrderId, setEditingOrderId] = useState(null);

  // STATE POP-UP BUKU STAPLES (DETAIL LEDGER)
  const [showStaplesModal, setShowAddStaplesModal] = useState(false);
  const [selectedStaplesOrder, setSelectedStaplesOrder] = useState(null);

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', address: '', notes: '', category: 'RESELLER' });

  const productStockMap = useMemo(() => {
    const map = {};
    (inventoryCostLayers || []).forEach(layer => {
      if (!layer.isDeleted && layer.status === 'ACTIVE' && layer.branch_id === currentBranch) {
        map[layer.item_name] = (map[layer.item_name] || 0) + Number(layer.qty_remaining || 0);
      }
    });
    return map;
  }, [inventoryCostLayers, currentBranch]);

  const filteredCustomersForSelect = useMemo(() => {
    if (!customerSearchTerm) return activeCustomers;
    const s = customerSearchTerm.toLowerCase();
    return activeCustomers.filter(c => (c.customer_name || '').toLowerCase().includes(s));
  }, [activeCustomers, customerSearchTerm]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return activeProducts;
    const s = searchTerm.toLowerCase();
    return activeProducts.filter(p => (p.product_name || '').toLowerCase().includes(s));
  }, [activeProducts, searchTerm]);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { 
        id: product.id, name: product.product_name, 
        price: Number(product.selling_price || 0), hpp: Number(product.default_hpp || 0), qty: 1 
      }];
    });
  };

  const updateQtyExact = (id, newQty) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty: Math.max(0, newQty) } : item).filter(item => item.qty > 0));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const cartHPP = cart.reduce((sum, item) => sum + (item.hpp * item.qty), 0);

  const paymentSummary = useMemo(() => {
    if (orderMode === 'INFLUENCER') return { totalDibayar: 0, sisaBon: 0, kembalian: 0, methodStr: 'PROMO_MARKETING', breakdown: [] };

    let cash = 0; let bca = 0; let bri = 0;
    let poTerbuka = false;

    if (isSplitPayment) {
      cash = Number(payCash || 0);
      bca = Number(payBCA || 0);
      bri = Number(payBRI || 0);
    } else {
      const amt = Number(singleAmountPaid || 0);
      if (singleMethod === 'CASH') cash = amt;
      else if (singleMethod === 'TF_BCA_PUSAT') bca = amt;
      else if (singleMethod === 'TF_BRI_PUSAT') bri = amt;
      else if (singleMethod === 'COD_PO') poTerbuka = true;
      else if (singleMethod === 'DP_PIUTANG') {
        if (dpMethod === 'CASH') cash = amt;
        else if (dpMethod === 'TF_BCA_PUSAT') bca = amt;
        else if (dpMethod === 'TF_BRI_PUSAT') bri = amt;
      }
    }

    let totalBayarInput = cash + bca + bri;
    if (poTerbuka) totalBayarInput = 0;

    let kembalian = 0;
    let sisaBon = 0;

    if (totalBayarInput >= cartTotal) {
      kembalian = totalBayarInput - cartTotal;
      sisaBon = 0;
    } else {
      sisaBon = cartTotal - totalBayarInput;
      kembalian = 0;
    }

    let methods = [];
    let breakdown = [];
    if (cash > 0) { methods.push('CASH'); breakdown.push({ method: 'CASH', amount: cash - (kembalian > 0 ? kembalian : 0) }); }
    if (bca > 0) { methods.push('BCA'); breakdown.push({ method: 'TF_BCA_PUSAT', amount: bca }); }
    if (bri > 0) { methods.push('BRI'); breakdown.push({ method: 'TF_BRI_PUSAT', amount: bri }); }

    let methodStr = '';
    if (isSplitPayment) {
      methodStr = `MIX (${methods.join('+')})`;
      if (sisaBon > 0 && totalBayarInput > 0) methodStr = `DP_${methodStr}+PIUTANG`;
      else if (sisaBon === cartTotal && !poTerbuka) methodStr = 'PIUTANG';
    } else {
      if (singleMethod === 'DP_PIUTANG') {
        methodStr = `DP_${dpMethod}+PIUTANG`;
      } else {
        methodStr = singleMethod;
        if (sisaBon > 0 && totalBayarInput > 0) methodStr = `DP_${methodStr}+PIUTANG`;
        else if (sisaBon === cartTotal && !poTerbuka) methodStr = 'PIUTANG';
      }
    }

    return { totalDibayar: totalBayarInput - kembalian, sisaBon, kembalian, methodStr, breakdown };
  }, [orderMode, isSplitPayment, payCash, payBCA, payBRI, singleMethod, singleAmountPaid, cartTotal, dpMethod]);

  const setLunasOtomatis = (e) => {
    e.preventDefault();
    if (isSplitPayment) {
      setPayCash(String(cartTotal)); setPayBCA(''); setPayBRI('');
    } else {
      setSingleAmountPaid(String(cartTotal));
    }
  };

  const handleCreateCustomerFast = async (e) => {
    e.preventDefault();
    if (!newCustomerForm.name) return alert("Nama wajib diisi!");
    
    const fastId = generateId('CST', todayStr);
    const payload = {
      customer_id: fastId,
      date: todayStr,
      branch_id: currentBranch,
      customer_name: newCustomerForm.name.toUpperCase(),
      phone: newCustomerForm.phone || '-',
      address: newCustomerForm.address || '-',
      notes: newCustomerForm.notes || 'Dibuat kilat via Kasir POS',
      customer_tier: newCustomerForm.category,
      status: 'ACTIVE',
      isDeleted: false
    };

    const isSuccess = await sendToSheet('insert', [payload], 'master_customers');
    if (isSuccess) {
      showToast(`Pelanggan "${newCustomerForm.name}" Berhasil Terdaftar!`, 'success');
      setSelectedCustomerId(fastId);
      setShowAddCustomerModal(false);
      setNewCustomerForm({ name: '', phone: '', address: '', notes: '', category: 'RESELLER' });
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return alert("Keranjang belanja masih kosong!");
    if (!selectedCustomerId) return alert("Wajib pilih nama pelanggan / agen!");

    const customer = activeCustomers.find(c => c.customer_id === selectedCustomerId || c.id === selectedCustomerId);
    const custName = customer ? customer.customer_name : 'UMUM';
    const custCategory = customer ? (customer.customer_tier || customer.category) : 'OFFLINE';

    const orderId = editingOrderId ? editingOrderId : generateId('INV', todayStr);
    const totalItemQty = cart.reduce((sum, item) => sum + item.qty, 0);

    const confirmMsg = `${editingOrderId ? '⚡ REVISI NOTA PENJUALAN' : 'Konfirmasi Transaksi Grosir Aditya'}:\n\n` +
      `No Invoice: ${orderId}\n` +
      `Pelanggan: ${custName}\n` +
      `Total Belanja Aktual: ${formatRupiah(cartTotal)}\n` +
      `Total Uang Masuk (DP): ${formatRupiah(paymentSummary.totalDibayar)}\n` +
      `Sisa Bon Gantung: ${formatRupiah(paymentSummary.sisaBon)}\n\n` +
      `Sahkan & Kirim ke Cloud Database?`;

    if (!window.confirm(confirmMsg)) return;

    const orderPayload = {
      id: orderId, date: todayStr, branch_id: currentBranch,
      customer_name: custName, sales_channel: custCategory,
      items: JSON.stringify(cart), qty: totalItemQty,
      total_amount: cartTotal, amount_paid: paymentSummary.totalDibayar,
      payment_method: paymentSummary.methodStr,
      status: paymentSummary.sisaBon <= 0 ? 'LUNAS' : 'BELUM_LUNAS',
      notes: notes || '-', isDeleted: false
    };

    const actionType = editingOrderId ? 'update' : 'insert';
    const isSuccess = await sendToSheet(actionType, orderPayload, 'orders');
    
    if (isSuccess) {
      if (editingOrderId) {
        showToast(`Invoice ${orderId} Berhasil Diperbarui/Revisi!`, 'success');
        setEditingOrderId(null);
      } else {
        if (orderMode === 'INFLUENCER') {
          await sendToSheet('insert', {
            id: generateId('EXP', todayStr), date: todayStr, branch_id: currentBranch,
            category: 'BIAYA_PROPOSI', expense_name: `Beban Promo: ${custName}`,
            amount: cartHPP, payment_method: 'SISTEM', isDeleted: false,
            description: `Beban gratis menu ${totalItemQty} Pcs Nota ${orderId}. Dicatat berdasarkan nilai HPP.`
          }, 'expenses');
        } else if (paymentSummary.totalDibayar > 0) {
          for (let pay of paymentSummary.breakdown) {
            if (pay.amount <= 0) continue;
            await sendToSheet('insert', {
              id: generateId('CFI', todayStr), date: todayStr, branch_id: currentBranch,
              type: 'IN', category: 'PENJUALAN POS', amount: pay.amount, method: pay.method, reference_id: orderId,
              description: `Angsuran/Pelunasan Kasir POS ${orderId} - Klien: ${custName} (${pay.method})`, isDeleted: false
            }, 'cashflow_transactions');
          }
        }
        showToast(`Invoice ${orderId} Berhasil Diproses!`, 'success');
      }

      setPrintData({
        title: orderMode === 'INFLUENCER' ? 'NOTA COMPLIMENTARY MARKETING' : (paymentSummary.sisaBon > 0 ? 'NOTA DP & BON GANTUNG' : 'INVOICE DISTRIBUSI RESMI'),
        id: orderId, date: formatDate(todayStr), branch_name: currentBranch.replace(/_/g, ' '),
        admin_name: user?.name || 'KASIR UTAMA', customer_name: custName,
        items: cart.map(item => ({ name: item.name, qty: item.qty, subtotal: item.price * item.qty })),
        amount: cartTotal, paymentMethod: paymentSummary.methodStr.replace(/_/g, ' '),
        history: {
          labelLama: 'Total Belanja', nominalLama: cartTotal,
          labelAksi: 'Total Masuk Laci/Bank', nominalAksi: paymentSummary.totalDibayar,
          labelBaru: 'Sisa Bersih Hutang/Bon', nominalBaru: paymentSummary.sisaBon
        }
      });

      setCart([]); setSelectedCustomerId(''); setNotes('');
      setPayCash(''); setPayBCA(''); setPayBRI(''); setSingleAmountPaid('');
      setIsSplitPayment(false); setOrderMode('REGULAR'); setCustomerSearchTerm('');
      setSingleMethod('CASH'); setDpMethod('CASH');
    }
  };

  const handleTriggerEditOrder = (o) => {
    if (!window.confirm(`Tarik nota ${o.id} kembali ke kasir untuk di-revisi total?`)) return;
    
    setEditingOrderId(o.id);
    setNotes(o.notes || '');
    
    const foundCust = activeCustomers.find(c => String(c.customer_name).toUpperCase() === String(o.customer_name).toUpperCase());
    if (foundCust) setSelectedCustomerId(foundCust.customer_id || foundCust.id);

    const parsedItems = safeJsonParse(o.items, []);
    const itemsToCart = parsedItems.map(item => {
      const matchProd = activeProducts.find(p => p.product_name === item.name);
      return {
        id: matchProd ? matchProd.id : generateId('PRD', todayStr),
        name: item.name,
        price: Number(item.price || item.subtotal / item.qty || 0),
        hpp: Number(item.hpp || 0),
        qty: Number(item.qty || 0)
      };
    });
    setCart(itemsToCart);

    if (String(o.payment_method).startsWith('DP_')) {
      setSingleMethod('DP_PIUTANG');
      setSingleAmountPaid(String(o.amount_paid));
    } else if (o.payment_method === 'PIUTANG') {
      setSingleMethod('PIUTANG');
    } else if (o.payment_method === 'COD_PO') {
      setSingleMethod('COD_PO');
    } else {
      setSingleMethod(o.payment_method);
      setSingleAmountPaid(String(o.amount_paid));
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Nota ${o.id} berhasil dimuat di meja kasir!`, 'success');
  };

  const handleTriggerVoidOrder = async (orderId) => {
    if (!window.confirm(`🔥 PERINGATAN OWNER: Hapus permanen (Void) nota ${orderId} dari sistem cloud? Tindakan ini akan membatalkan potongan stok.`)) return;
    const isSuccess = await sendToSheet('update', { id: orderId, isDeleted: true }, 'orders');
    if (isSuccess) showToast(`Nota ${orderId} berhasil dihapus permanen!`, 'success');
  };

  const historyOrdersData = useMemo(() => {
    return (orders || []).filter(o => {
      if (o.isDeleted) return false;
      if (o.branch_id !== currentBranch) return false;
      return o.date >= historyDateFrom && o.date <= historyDateTo;
    }).sort((a, b) => b.id.localeCompare(a.id));
  }, [orders, currentBranch, historyDateFrom, historyDateTo]);

  const filteredHistoryOrders = useMemo(() => {
    if (!searchHistoryTerm) return historyOrdersData;
    const lower = searchHistoryTerm.toLowerCase();
    return historyOrdersData.filter(o => o.id.toLowerCase().includes(lower) || (o.customer_name || '').toLowerCase().includes(lower));
  }, [historyOrdersData, searchHistoryTerm]);

  return (
    <div className="flex flex-col gap-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-200">
      
      {/* PAPAN INFORMASI STOK LIVE ATAS */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md border border-slate-800 shrink-0">
        <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
          <Package size={14}/> Ringkasan Ketersediaan Papan Stok Master Gudang (Real-Time Live)
        </div>
        <div className="flex flex-wrap gap-3">
          {activeProducts.map(p => {
            const stockQty = productStockMap[p.product_name] || 0;
            return (
              <div key={p.id} className="bg-slate-800/60 border border-slate-700/50 px-3 py-2 rounded-xl flex items-center gap-3 min-w-[150px] shadow-3xs">
                <div className={`w-2.5 h-2.5 rounded-full ${stockQty > 500 ? 'bg-emerald-500 animate-pulse' : stockQty > 0 ? 'bg-amber-500' : 'bg-rose-600'}`}></div>
                <div>
                  <div className="text-[10px] font-bold text-slate-300 line-clamp-1 truncate uppercase max-w-[130px]">{p.product_name}</div>
                  <div className="text-xs font-black text-white mt-0.5">{formatNumber(stockQty)} <span className="text-[9px] text-slate-400 font-normal">Pcs</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editingOrderId && (
        <div className="bg-orange-600 text-white font-black text-xs p-4 rounded-xl shadow-md animate-bounce flex justify-between items-center shrink-0">
          <span>⚠️ ANDA SEDANG DALAM MODE REVISI NOTA: {editingOrderId}. KLIK BATAL JIKA INGIN KEMBALI KE NOTA BARU.</span>
          <button onClick={() => { setEditingOrderId(null); setCart([]); setSelectedCustomerId(''); setNotes(''); }} className="bg-white text-orange-700 px-3 py-1 rounded-lg font-black uppercase tracking-wider">Batal Revisi</button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* KOLOM KIRI: KATALOG BARANG */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="card-holo p-4 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-2xs gap-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-blue-600" size={18}/>
              <div>
                <h2 className="text-sm font-black text-slate-800 normal-case">Katalog POS Grosir B2B</h2>
                <p className="text-[9px] font-bold text-slate-400 normal-case mt-0.5">Ketuk item untuk memasukkan pesanan partai besar.</p>
              </div>
            </div>
            <div className="relative w-full sm:w-64 shrink-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:bg-white focus:border-blue-400 transition-colors shadow-3xs normal-case" placeholder="Cari nama barang..." />
            </div>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar max-h-[50vh] pb-2 pr-1">
            {filteredProducts.map(product => {
              const liveStock = productStockMap[product.product_name] || 0;
              return (
                <div key={product.id} onClick={() => addToCart(product)} className="bg-white border border-slate-200 rounded-2xl p-4 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between h-full group relative shadow-2xs overflow-hidden">
                  <div className={`absolute top-0 right-0 px-2.5 py-0.5 text-[9px] font-black rounded-bl-xl ${liveStock > 500 ? 'bg-emerald-100 text-emerald-800' : liveStock > 0 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                    Stok: {formatNumber(liveStock)}
                  </div>
                  <div className="mt-2">
                    <h3 className="font-black text-slate-800 text-xs normal-case group-hover:text-blue-600 transition-colors pr-10">{product.product_name}</h3>
                  </div>
                  <div className="mt-3 text-blue-600 font-black text-sm">{formatRupiah(product.selling_price)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* KOLOM KANAN: DETAIL CHECKOUT SULTAN KASIR */}
        <div className="w-full lg:w-[420px] xl:w-[460px] shrink-0 flex flex-col gap-4">
          <div className="card-holo flex flex-col max-h-[40vh] bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-black text-slate-800 normal-case text-xs flex items-center gap-2"><Receipt size={14} className="text-blue-600"/> Nota Keranjang Belanja</h3>
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-black">{cart.length} Jenis</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="text-center py-16 text-slate-400 font-bold text-[11px] flex flex-col items-center">
                  <ShoppingCart size={32} className="mb-2 opacity-20"/> Keranjang Kosong
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="flex-1 pr-2 min-w-0">
                        <div className="font-black text-slate-800 text-[11px] normal-case truncate">{item.name}</div>
                        <div className="text-blue-600 font-black text-[10px] mt-0.5">{formatRupiah(item.price)}</div>
                      </div>
                      
                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-3xs shrink-0">
                        <button type="button" onClick={() => updateQtyExact(item.id, item.qty - 1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-600"><Minus size={10}/></button>
                        <input type="number" value={item.qty} onChange={(e) => updateQtyExact(item.id, parseInt(e.target.value) || 0)} className="w-12 text-center text-xs font-black text-slate-800 bg-transparent outline-none hide-arrows" />
                        <button type="button" onClick={() => updateQtyExact(item.id, item.qty + 1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-600"><Plus size={10}/></button>
                      </div>
                      
                      <button type="button" onClick={() => removeFromCart(item.id)} className="ml-1 p-1.5 text-slate-400 hover:text-rose-600"><Trash2 size={13}/></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 text-xs font-bold shrink-0">
              <div className="flex justify-between text-slate-800 text-sm font-black"><span>Total Tagihan:</span><span className="text-base text-blue-600">{orderMode === 'INFLUENCER' ? 'Rp 0 (Promo)' : formatRupiah(cartTotal)}</span></div>
            </div>
          </div>

          <div className="card-holo p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs border-t-4 border-t-blue-500">
            <div className="space-y-4">
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[9px] font-bold text-slate-500 normal-case flex items-center gap-1"><UserCheck size={12}/> Cari Pelanggan</label>
                  <button type="button" onClick={() => setShowAddCustomerModal(true)} className="text-[9px] font-black text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5 uppercase tracking-wider cursor-pointer"><PlusCircle size={10}/> (+) Pelanggan Baru</button>
                </div>
                
                <div className="space-y-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <input 
                    type="text" 
                    value={customerSearchTerm} 
                    onChange={(e) => setCustomerSearchTerm(e.target.value)} 
                    placeholder="Ketik sepotong nama pelanggan..." 
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none"
                  />
                  <select 
                    required 
                    value={selectedCustomerId} 
                    onChange={e => setSelectedCustomerId(e.target.value)} 
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="">-- Pilih Hasil Pencarian ({filteredCustomersForSelect.length}) --</option>
                    {filteredCustomersForSelect.map(c => (
                      <option key={c.customer_id || c.id} value={c.customer_id || c.id}>{c.customer_name} ({c.customer_tier || c.category})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between cursor-pointer shadow-inner" onClick={() => setOrderMode(prev => prev === 'REGULAR' ? 'INFLUENCER' : 'REGULAR')}>
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${orderMode === 'INFLUENCER' ? 'bg-red-100 text-red-600' : 'bg-white text-slate-400 border shadow-3xs'}`}><Gift size={12}/></div>
                  <div>
                    <div className="text-[11px] font-black text-slate-800">Mode Influencer / Promosi Gratis</div>
                    <div className="text-[9px] font-bold text-slate-400 mt-0.5">HPP akan dicatat sebagai beban promosi harian.</div>
                  </div>
                </div>
                <div className={`w-8 h-4 rounded-full relative ${orderMode === 'INFLUENCER' ? 'bg-red-500' : 'bg-slate-300'}`}><div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${orderMode === 'INFLUENCER' ? 'translate-x-4' : ''}`}></div></div>
              </div>

              {orderMode === 'REGULAR' && (
                <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-inner">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-wider">Opsi Model Bayar</label>
                    <label className="flex items-center gap-1 text-[10px] font-bold text-slate-700 cursor-pointer"><input type="checkbox" checked={isSplitPayment} onChange={e=>{ setIsSplitPayment(e.target.checked); setPayCash(''); setPayBCA(''); setPayBRI(''); setSingleAmountPaid(''); }} className="accent-blue-600"/> Aktifkan Bayar Campuran (Mix)</label>
                  </div>

                  {isSplitPayment ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border shadow-3xs">
                        <span className="text-[10px] font-black text-slate-400 w-16">💵 CASH</span>
                        <input type="text" value={payCash ? Number(payCash).toLocaleString('id-ID') : ''} onChange={e=>setPayCash(e.target.value.replace(/\D/g, ''))} className="w-full text-right bg-transparent outline-none font-black text-xs text-slate-800" placeholder="0" />
                      </div>
                      <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border shadow-3xs">
                        <span className="text-[10px] font-black text-blue-600 w-16">🏦 BCA PUSAT</span>
                        <input type="text" value={payBCA ? Number(payBCA).toLocaleString('id-ID') : ''} onChange={e=>setPayBCA(e.target.value.replace(/\D/g, ''))} className="w-full text-right bg-transparent outline-none font-black text-xs text-blue-700" placeholder="0" />
                      </div>
                      <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border shadow-3xs">
                        <span className="text-[10px] font-black text-orange-600 w-16">🏦 BRI PUSAT</span>
                        <input type="text" value={payBRI ? Number(payBRI).toLocaleString('id-ID') : ''} onChange={e=>setPayBRI(e.target.value.replace(/\D/g, ''))} className="w-full text-right bg-transparent outline-none font-black text-xs text-orange-700" placeholder="0" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <select value={singleMethod} onChange={e=>{ setSingleMethod(e.target.value); setSingleAmountPaid(''); }} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none cursor-pointer shadow-3xs">
                            <option value="CASH">Cash (Tunai Laci)</option>
                            <option value="TF_BCA_PUSAT">Transfer BCA Pusat</option>
                            <option value="TF_BRI_PUSAT">Transfer BRI Pusat</option>
                            <option value="DP_PIUTANG">Bayar DP (Uang Muka)</option>
                            <option value="PIUTANG">Full Bon (Piutang Utang)</option>
                            <option value="COD_PO">PO Terbuka (Bayar Nanti)</option>
                          </select>
                        </div>
                        
                        {singleMethod !== 'DP_PIUTANG' && singleMethod !== 'PIUTANG' && singleMethod !== 'COD_PO' && (
                          <div>
                            <input type="text" value={singleAmountPaid ? Number(singleAmountPaid).toLocaleString('id-ID') : ''} onChange={e=>setSingleAmountPaid(e.target.value.replace(/\D/g, ''))} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-black text-right text-slate-800 outline-none shadow-3xs" placeholder="Rp 0" />
                          </div>
                        )}
                        {(singleMethod === 'PIUTANG' || singleMethod === 'COD_PO') && (
                          <div>
                            <input type="text" disabled value="" className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-black text-right text-slate-400 outline-none opacity-50" placeholder={singleMethod === 'PIUTANG' ? 'Rp 0 (Full Bon)' : 'Rp 0 (PO Terbuka)'} />
                          </div>
                        )}
                      </div>

                      {singleMethod === 'DP_PIUTANG' && (
                        <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-lg shadow-inner">
                          <select value={dpMethod} onChange={e=>setDpMethod(e.target.value)} className="w-1/2 p-2 bg-white border border-orange-200 rounded-lg text-[10px] font-bold outline-none cursor-pointer text-orange-900 shadow-3xs">
                            <option value="CASH">Jalur: Tunai Laci</option>
                            <option value="TF_BCA_PUSAT">Jalur: TF BCA Pusat</option>
                            <option value="TF_BRI_PUSAT">Jalur: TF BRI Pusat</option>
                          </select>
                          <input type="text" value={singleAmountPaid ? Number(singleAmountPaid).toLocaleString('id-ID') : ''} onChange={e=>setSingleAmountPaid(e.target.value.replace(/\D/g, ''))} className="w-1/2 p-2 bg-white border border-orange-200 rounded-lg text-xs font-black text-right text-orange-700 outline-none shadow-3xs placeholder:text-orange-300" placeholder="Nominal DP (Rp)" />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t border-slate-200 pt-2 text-[10px] font-bold space-y-1 text-slate-600">
                    <div className="flex justify-between"><span>Total Input Pembayaran:</span><span className="font-black text-slate-800">{formatRupiah(isSplitPayment ? Number(payCash||0)+Number(payBCA||0)+Number(payBRI||0) : Number(singleAmountPaid||0))}</span></div>
                    {paymentSummary.sisaBon > 0 && <div className="flex justify-between text-rose-600 font-black bg-rose-50 px-2 py-1 rounded"><span>⚠️ Sisa Kekurangan (Masuk Bon Gantung):</span><span>{formatRupiah(paymentSummary.sisaBon)}</span></div>}
                    {paymentSummary.kembalian > 0 && <div className="flex justify-between text-emerald-600 font-black text-xs border-2 border-dashed border-emerald-200 p-1.5 rounded-lg bg-emerald-50/50 mt-1"><span>🟢 KEMBALIAN KASIR:</span><span>{formatRupiah(paymentSummary.kembalian)}</span></div>}
                    
                    {singleMethod !== 'PIUTANG' && singleMethod !== 'COD_PO' && singleMethod !== 'DP_PIUTANG' && (
                      <div className="flex justify-end pt-1"><button type="button" onClick={setLunasOtomatis} className="text-[9px] font-black text-blue-600 bg-white border px-2 py-1 rounded shadow-3xs cursor-pointer">Set Lunas Otomatis</button></div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[9px] font-bold text-slate-500 block mb-1"><Tag size={12}/> Catatan Khusus Invoice</label>
                <input type="text" value={notes} onChange={e=>setNotes(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg text-xs font-medium normal-case outline-none bg-slate-50 focus:bg-white focus:border-blue-400 transition-colors" placeholder={orderMode === 'INFLUENCER' ? "Ketik detail target promo..." : "Catatan kasir..."} />
              </div>

              <button type="button" onClick={handleCheckout} className={`w-full text-white font-black py-3.5 rounded-xl text-xs normal-case shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${editingOrderId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                <CheckCircle2 size={16}/> {editingOrderId ? 'Simpan & Sahkan Hasil Revisi Nota' : 'Sahkan Transaksi & Potong Stok'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          📑 TABLE HISTORI NOTA PENJUALAN + AKSI TOTAL OWNER HUB
         ========================================================= */}
      <div className="card-holo bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col overflow-hidden mt-2">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
          <div>
            <h3 className="font-black text-slate-800 text-xs flex items-center gap-2 normal-case"><Receipt size={16} className="text-blue-600"/> Histori Penjualan & Re-Print Nota</h3>
            <p className="text-[9px] font-bold text-slate-400 normal-case mt-0.5">Kelola rekam jejak penjualan, re-print struk, void transaksi, serta bedah lini masa pembayaran piutang.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 bg-white border p-1.5 rounded-xl shadow-3xs w-full sm:w-auto">
            <input type="date" value={historyDateFrom} onChange={e=>setHistoryDateFrom(e.target.value)} className="text-[10px] font-bold border-none outline-none cursor-pointer bg-transparent" />
            <span className="text-slate-400 font-bold text-xs">-</span>
            <input type="date" value={historyDateTo} onChange={e=>setHistoryDateTo(e.target.value)} className="text-[10px] font-bold border-none outline-none cursor-pointer bg-transparent" />
            <div className="relative w-40 ml-2 border-l pl-2 border-slate-200">
              <Search size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Cari No. Inv / Nama..." value={searchHistoryTerm} onChange={e=>setSearchHistoryTerm(e.target.value)} className="w-full pl-7 pr-2 py-1 bg-slate-50 rounded-lg text-[9px] font-bold outline-none border border-slate-200 focus:bg-white focus:border-blue-400 normal-case" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto p-1 custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/50 text-[10px] normal-case text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 font-black">ID Transaksi & Waktu</th>
                <th className="px-4 py-3 font-black">Nama Pelanggan Agen</th>
                <th className="px-4 py-3 font-black text-center">Volume Item</th>
                <th className="px-4 py-3 font-black text-center">Metode Sistem</th>
                <th className="px-4 py-3 font-black text-right">Keuangan (Omset & Laba)</th>
                <th className="px-4 py-3 font-black text-center">Status Lunas</th>
                <th className="px-4 py-3 font-black text-center">Aksi Hub</th>
              </tr>
            </thead>
            <tbody className="text-xs font-bold divide-y divide-slate-100 bg-white">
              {filteredHistoryOrders.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-12 text-slate-400 font-medium text-xs normal-case">Tidak ada data invoice di periode ini.</td></tr>
              ) : (
                filteredHistoryOrders.map(o => {
                  let listItems = [];
                  try { listItems = safeJsonParse(o.items, []); } catch(e) {}
                  
                  let orderHPP = 0;
                  listItems.forEach(item => {
                    orderHPP += (Number(item.hpp || 0) * Number(item.qty || 0));
                  });
                  const orderProfit = Number(o.total_amount || 0) - orderHPP;

                  let totalTerbayarDynamic = Number(o.amount_paid || 0);
                  (piutangPayments || []).forEach(p => {
                    if (!p.isDeleted && p.orderId === o.id) {
                      totalTerbayarDynamic += Number(p.amount || 0);
                    }
                  });
                  
                  const sisaHutangDynamic = Math.max(0, Number(o.total_amount || 0) - totalTerbayarDynamic);
                  const statusLunasDynamic = sisaHutangDynamic <= 0 ? 'LUNAS' : 'BELUM_LUNAS';

                  return (
                    <tr key={o.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-4 py-3 whitespace-nowrap"><div onClick={() => { setSelectedStaplesOrder({ ...o, orderHPP, listItems, sisaHutangDynamic, totalTerbayarDynamic }); setShowAddStaplesModal(true); }} className="text-blue-600 hover:underline cursor-pointer font-black font-mono">{o.id}</div><div className="text-[9px] text-slate-400 font-bold mt-0.5">{formatDate(o.date)}</div></td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-800 font-black normal-case text-xs">{o.customer_name}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap text-slate-600 font-black">{formatNumber(o.qty)} <span className="text-[10px] font-normal text-slate-400">Pcs</span></td>
                      
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[9px] font-black bg-slate-100 text-slate-700 border border-slate-200">{o.payment_method}</span>
                        {String(o.payment_method).includes('DP_') && (
                          <div className="text-[9px] font-black text-orange-600 mt-1">DP Masuk: {formatRupiah(o.amount_paid)}</div>
                        )}
                      </td>
                      
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="text-slate-900 font-black text-sm">{formatRupiah(o.total_amount)}</div>
                        <div className="text-[9px] font-bold text-slate-400 mt-1 line-through decoration-slate-300">HPP: {formatRupiah(orderHPP)}</div>
                        <div className="text-[10px] font-black text-emerald-600 mt-0.5 flex items-center justify-end gap-1"><TrendingUp size={10}/> Laba: {formatRupiah(orderProfit)}</div>
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${statusLunasDynamic === 'LUNAS' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'}`}>{statusLunasDynamic}</span>
                        {sisaHutangDynamic > 0 && <div className="text-[8px] font-bold text-rose-600 mt-1">Sisa Bon: {formatRupiah(sisaHutangDynamic)}</div>}
                      </td>
                      
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" onClick={() => { setSelectedStaplesOrder({ ...o, orderHPP, listItems, sisaHutangDynamic, totalTerbayarDynamic }); setShowAddStaplesModal(true); }} className="p-1.5 text-slate-500 hover:text-emerald-600 border border-slate-200 rounded-lg bg-white shadow-3xs hover:bg-emerald-50 cursor-pointer" title="Buka Buku Staples Ledger"><Eye size={13}/></button>
                          <button type="button" onClick={() => handleTriggerEditOrder(o)} className="p-1.5 text-slate-500 hover:text-orange-600 border border-slate-200 rounded-lg bg-white shadow-3xs hover:bg-orange-50 cursor-pointer" title="Revisi/Edit Nota Total"><Edit size={13}/></button>
                          <button type="button" onClick={() => {
                            setPrintData({
                              title: 'RE-PRINT DUPLIKAT INVOICE', id: o.id, date: formatDate(o.date), branch_name: currentBranch.replace(/_/g, ' '),
                              admin_name: user?.name || 'ADMIN PUSAT', customer_name: o.customer_name,
                              items: listItems.map(i => ({ name: i.name, qty: i.qty, subtotal: i.price * i.qty })), amount: o.total_amount,
                              paymentMethod: o.payment_method.replace(/_/g, ' '),
                              history: { labelLama: 'Total Belanja', nominalLama: o.total_amount, labelAksi: 'Total Sudah Dibayar', nominalAksi: totalTerbayarDynamic, labelBaru: 'Sisa Piutang Berjalan', nominalBaru: sisaHutangDynamic }
                            });
                          }} className="p-1.5 text-slate-400 hover:text-blue-600 border border-slate-200 rounded-lg shadow-3xs bg-white cursor-pointer hover:bg-blue-50 transition-colors" title="Cetak Ulang Nota"><Printer size={14}/></button>
                          <button type="button" onClick={() => handleTriggerVoidOrder(o.id)} className="p-1.5 text-slate-400 hover:text-rose-600 border border-slate-200 rounded-lg shadow-3xs bg-white cursor-pointer hover:bg-rose-50 transition-colors" title="Void Nota Permanen"><Trash2 size={13}/></button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================
          📚 POP-UP DETAILED LEDGER INTERAKTIF (BUKU STAPLES DIGITAL)
         ========================================================= */}
      {showStaplesModal && selectedStaplesOrder && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200 overflow-hidden flex flex-col h-[80vh]">
            
            <div className="p-4 bg-slate-950 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-black text-xs uppercase flex items-center gap-1.5 text-orange-400">📖 Buku Staples Ledger Nota: {selectedStaplesOrder.id}</h3>
                <p className="text-[9px] text-slate-400 font-bold mt-0.5 normal-case">Klien: {selectedStaplesOrder.customer_name} | Tanggal Input: {formatDate(selectedStaplesOrder.date)}</p>
              </div>
              <button type="button" onClick={() => setShowAddStaplesModal(false)} className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer">✕ Close</button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar bg-slate-50 space-y-4">
              
              <div className="bg-white rounded-xl border p-3 shadow-3xs">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">1. Rincian Item Barang &amp; Laba Bersih</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b text-[10px]">
                        <th className="p-2">Nama Barang</th>
                        <th className="p-2 text-center">Qty (Pcs)</th>
                        <th className="p-2 text-right">Harga</th>
                        <th className="p-2 text-right">Subtotal</th>
                        <th className="p-2 text-right text-orange-600 bg-orange-50/50">HPP</th>
                        <th className="p-2 text-right text-emerald-600 bg-emerald-50/50">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-bold text-slate-700">
                      {selectedStaplesOrder.listItems.map((item, idx) => {
                        const totalItemHPP = Number(item.hpp || 0) * Number(item.qty || 0);
                        const totalItemProfit = (item.price * item.qty) - totalItemHPP;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2 text-slate-800 uppercase">{item.name}</td>
                            <td className="p-2 text-center">{formatNumber(item.qty)}</td>
                            <td className="p-2 text-right">{formatRupiah(item.price)}</td>
                            <td className="p-2 text-right text-slate-900">{formatRupiah(item.price * item.qty)}</td>
                            <td className="p-2 text-right text-orange-700 bg-orange-50/30">{formatRupiah(totalItemHPP)}</td>
                            <td className="p-2 text-right text-emerald-700 bg-emerald-50/30">{formatRupiah(totalItemProfit)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-xl border p-3 shadow-3xs">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">2. Rekam Jejak Aliran Setoran / Cicilan Piutang</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b text-[10px]">
                        <th className="p-2">Waktu Setor</th>
                        <th className="p-2">Metode Kas</th>
                        <th className="p-2 text-right">Jumlah Bayar</th>
                        <th className="p-2 font-mono">ID Kuitansi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-bold text-slate-600">
                      <tr>
                        <td className="p-2 text-slate-400">{formatDate(selectedStaplesOrder.date)}</td>
                        <td className="p-2"><span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px]">DP POS INITIAL</span></td>
                        <td className="p-2 text-right text-slate-800">{formatRupiah(selectedStaplesOrder.amount_paid)}</td>
                        <td className="p-2 font-mono text-[10px] text-slate-400">INITIAL_PAY</td>
                      </tr>
                      {(piutangPayments || []).filter(p => !p.isDeleted && p.orderId === selectedStaplesOrder.id).map(p => (
                        <tr key={p.id}>
                          <td className="p-2 text-slate-700">{formatDate(p.date)}</td>
                          <td className="p-2"><span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] border border-blue-100">{p.method}</span></td>
                          <td className="p-2 text-right text-blue-600">{formatRupiah(p.amount)}</td>
                          <td className="p-2 font-mono text-[10px] text-slate-400">{p.id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-3 rounded-xl space-y-1.5 font-bold text-[11px]">
                <div className="flex justify-between text-slate-400"><span>A. Nilai Omset Nota Kotor (A)</span><span>{formatRupiah(selectedStaplesOrder.total_amount)}</span></div>
                <div className="flex justify-between text-slate-400"><span>B. Akumulasi Total Uang Diterima (B)</span><span className="text-emerald-400">{formatRupiah(selectedStaplesOrder.totalTerbayarDynamic)}</span></div>
                <div className="border-t border-slate-700 my-1"></div>
                <div className="flex justify-between text-sm font-black">
                  <span>Sisa Sisa Bon Saat Ini (A - B)</span>
                  <span className={selectedStaplesOrder.sisaHutangDynamic <= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {selectedStaplesOrder.sisaHutangDynamic <= 0 ? 'Rp 0 (LUNAS BERSIH)' : formatRupiah(selectedStaplesOrder.sisaHutangDynamic)}
                  </span>
                </div>
              </div>

            </div>
            
            <div className="p-3 bg-slate-100 border-t text-right shrink-0">
              <button type="button" onClick={() => setShowAddStaplesModal(false)} className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] rounded-xl shadow-md cursor-pointer uppercase">Tutup Buku Staples</button>
            </div>
          </div>
        </div>
      )}

      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-black text-xs uppercase flex items-center gap-1.5"><PlusCircle size={14} className="text-emerald-400"/> Registrasi Pelanggan Kilat</h3>
              <button type="button" onClick={() => setShowAddCustomerModal(false)} className="text-slate-400 hover:text-white text-sm font-bold">✕</button>
            </div>
            <form onSubmit={handleCreateCustomerFast} className="p-4 space-y-3">
              <div><label className="text-[9px] font-bold text-slate-400 block mb-1">Nama Lengkap / Nama Toko Agen</label><input type="text" required value={newCustomerForm.name} onChange={e=>setNewCustomerForm({...newCustomerForm, name: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400 shadow-3xs uppercase" placeholder="Contoh: AGEN CIBINONG JAYA" /></div>
              <div><label className="text-[9px] font-bold text-slate-400 block mb-1">No. Telepon / WhatsApp</label><input type="text" value={newCustomerForm.phone} onChange={e=>setNewCustomerForm({...newCustomerForm, phone: e.target.value.replace(/\D/g, '')})} className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400 shadow-3xs" placeholder="Contoh: 0812XXXXXXXX" /></div>
              <div><label className="text-[9px] font-bold text-slate-400 block mb-1">Alamat Lengkap Pengiriman</label><input type="text" value={newCustomerForm.address} onChange={e=>setNewCustomerForm({...newCustomerForm, address: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400 shadow-3xs" placeholder="Contoh: Jl. Merdeka No. 12, RT 02/03" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 block mb-1">Jalur / Kategori Harga</label>
                  <select value={newCustomerForm.category} onChange={e=>setNewCustomerForm({...newCustomerForm, category: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-[10px] font-bold cursor-pointer outline-none">
                    <option value="RESELLER">Reseller (Rp 2.125)</option>
                    <option value="MITRA">Mitra Utama (Rp 2.000)</option>
                    <option value="ECERAN">Eceran Biasa (Rp 3.000)</option>
                    <option value="PEMALANG">Cabang Pemalang (Rp 2.250)</option>
                  </select>
                </div>
                <div><label className="text-[9px] font-bold text-slate-400 block mb-1">Keterangan Khusus</label><input type="text" value={newCustomerForm.notes} onChange={e=>setNewCustomerForm({...newCustomerForm, notes: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400 shadow-3xs" placeholder="Contoh: Ambil Sore..." /></div>
              </div>
              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setShowAddCustomerModal(false)} className="flex-1 py-2 bg-slate-100 border text-slate-600 font-bold text-[10px] rounded-lg uppercase">Batal</button>
                <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white font-black text-[10px] rounded-lg uppercase shadow-md hover:bg-emerald-700">Daftarkan & Pilih</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .hide-arrows::-webkit-outer-spin-button, .hide-arrows::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .hide-arrows { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}
