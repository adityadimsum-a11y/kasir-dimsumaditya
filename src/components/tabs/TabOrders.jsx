import React, { useState, useMemo } from 'react';
import { 
  ShoppingCart, Plus, Minus, Trash2, Search, 
  UserCheck, Tag, Receipt, CheckCircle2, Gift, Package, 
  PlusCircle, Printer, Eye, Edit, ChefHat, AlertTriangle, Unlock, TrendingUp, Info, Calendar 
} from 'lucide-react';
import { getTodayStr, generateId, formatDate, safeJsonParse, getLocalYMD } from '../../utils/helpers';

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
  const [targetDate, setTargetDate] = useState(''); 

  const [payCash, setPayCash] = useState(''); const [displayPayCash, setDisplayPayCash] = useState('');
  const [payBCA, setPayBCA] = useState(''); const [displayPayBCA, setDisplayPayBCA] = useState('');
  const [payBRI, setPayBRI] = useState(''); const [displayPayBRI, setDisplayPayBRI] = useState('');
  const [singleAmountPaid, setSingleAmountPaid] = useState(''); const [displaySingleAmountPaid, setDisplaySingleAmountPaid] = useState('');
  
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [singleMethod, setSingleMethod] = useState('CASH'); 
  const [dpMethod, setDpMethod] = useState('CASH');

  const [editingOrderId, setEditingOrderId] = useState(null);
  const [showStaplesModal, setShowAddStaplesModal] = useState(false);
  const [selectedStaplesOrder, setSelectedStaplesOrder] = useState(null);

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', address: '', notes: '', category: 'RESELLER' });

  // --- STATE PINJAM KARANTINA ---
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [borrowForm, setBorrowForm] = useState({ product: null, poId: '', qty: '', maxQty: 0 });

  const handleMoneyInput = (val, setRaw, setDisplay) => {
    const rawVal = val.replace(/\D/g, '');
    setRaw(rawVal);
    setDisplay(rawVal ? Number(rawVal).toLocaleString('id-ID') : '');
  };

  // =========================================================================
  // 1. ENGINE KALKULASI STOK BEBAS VS STOK KARANTINA (LIVE)
  // =========================================================================
  const stockData = useMemo(() => {
    const free = {};
    const quarantine = {};
    const poQuarantineDetails = {}; 

    (inventoryCostLayers || []).forEach(layer => {
      if (layer.isDeleted || layer.branch_id !== currentBranch) return;
      
      if (layer.status === 'ACTIVE') {
        free[layer.item_name] = (free[layer.item_name] || 0) + Number(layer.qty_remaining || 0);
      } 
      else if (layer.status === 'KARANTINA') {
        quarantine[layer.item_name] = (quarantine[layer.item_name] || 0) + Number(layer.qty_remaining || 0);
        
        if (!poQuarantineDetails[layer.reference_id]) poQuarantineDetails[layer.reference_id] = {};
        poQuarantineDetails[layer.reference_id][layer.item_name] = (poQuarantineDetails[layer.reference_id][layer.item_name] || 0) + Number(layer.qty_remaining || 0);
      }
    });
    return { free, quarantine, poQuarantineDetails };
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

  // 🔥 ENGINE LOGIKA HARGA BERTINGKAT (GROSIR VS ECERAN)
  const getProductPriceForCustomer = (product, customerId, currentQty = 1) => {
    const wholesaleQty = Number(product.wholesale_qty || 1);
    const wholesalePrice = Number(product.selling_price || 0);
    const retailPrice = Number(product.retail_price || product.penalty_price || product.selling_price || 0);

    if (wholesaleQty > 1 && currentQty < wholesaleQty) {
        return retailPrice;
    }
    return wholesalePrice;
  };

  const addToCart = (product, forcedQty = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      const newTotalQty = existing ? existing.qty + forcedQty : forcedQty;
      const dynamicPrice = getProductPriceForCustomer(product, selectedCustomerId, newTotalQty);

      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: newTotalQty, price: dynamicPrice } : item);
      }
      return [...prev, { id: product.id, name: product.product_name, price: dynamicPrice, hpp: Number(product.default_hpp || 0), qty: newTotalQty }];
    });
  };

  const handleProductClick = (product) => {
    const freeStock = stockData.free[product.product_name] || 0;
    const cartItem = cart.find(i => i.id === product.id);
    const currentCartQty = cartItem ? cartItem.qty : 0;

    if (freeStock - currentCartQty <= 0) {
      const qStock = stockData.quarantine[product.product_name] || 0;
      if (qStock > 0) {
        setBorrowForm({ product, poId: '', qty: '', maxQty: 0 });
        setShowBorrowModal(true);
      } else {
        showToast(`Stok Bebas Habis & Tidak ada stok Karantina untuk dipinjam!`, 'error');
      }
      return;
    }
    addToCart(product, 1);
  };

  const handleCustomerChange = (newCustId) => {
      setSelectedCustomerId(newCustId);
      if (cart.length > 0) {
          setCart(prev => prev.map(item => {
              const productMaster = activeProducts.find(p => p.id === item.id);
              if (productMaster) return { ...item, price: getProductPriceForCustomer(productMaster, newCustId, item.qty) };
              return item;
          }));
      }
  };

  const updateQtyExact = (id, newQty) => {
    const product = activeProducts.find(p => p.id === id);
    if (!product) return;
    const freeStock = stockData.free[product.product_name] || 0;
    
    if (newQty > freeStock) {
       showToast(`Maksimal stok bebas hanya ${freeStock} Pcs! Pinjam karantina jika kurang.`, 'error');
       return;
    }

    if (newQty > 0 && newQty < Number(product.min_order || 1)) {
       showToast(`Peringatan: Minimal pembelian ${product.product_name} adalah ${product.min_order} Pcs!`, 'warning');
    }

    setCart(prev => prev.map(item => {
       if (item.id === id) {
           const finalQty = Math.max(0, newQty);
           const dynamicPrice = getProductPriceForCustomer(product, selectedCustomerId, finalQty);
           return { ...item, qty: finalQty, price: dynamicPrice };
       }
       return item;
    }).filter(item => item.qty > 0));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const cartHPP = cart.reduce((sum, item) => sum + (item.hpp * item.qty), 0);

  const paymentSummary = useMemo(() => {
    if (orderMode === 'INFLUENCER') return { totalDibayar: 0, sisaBon: 0, kembalian: 0, methodStr: 'PROMO_MARKETING', breakdown: [] };

    let cash = 0; let bca = 0; let bri = 0; let poTerbuka = false;
    if (isSplitPayment) { cash = Number(payCash || 0); bca = Number(payBCA || 0); bri = Number(payBRI || 0); } 
    else {
      const amt = Number(singleAmountPaid || 0);
      if (singleMethod === 'CASH') cash = amt;
      else if (singleMethod === 'TF_BCA_PUSAT') bca = amt;
      else if (singleMethod === 'TF_BRI_PUSAT') bri = amt;
      else if (singleMethod === 'COD_PO') poTerbuka = true;
      else if (singleMethod === 'DP_PIUTANG') {
        if (dpMethod === 'CASH') cash = amt; else if (dpMethod === 'TF_BCA_PUSAT') bca = amt; else if (dpMethod === 'TF_BRI_PUSAT') bri = amt;
      }
    }

    let totalBayarInput = cash + bca + bri;
    if (poTerbuka) totalBayarInput = 0;

    let kembalian = 0; let sisaBon = 0;
    if (totalBayarInput >= cartTotal) { kembalian = totalBayarInput - cartTotal; sisaBon = 0; } 
    else { sisaBon = cartTotal - totalBayarInput; kembalian = 0; }

    let methods = []; let breakdown = [];
    if (cash > 0) { methods.push('CASH'); breakdown.push({ method: 'CASH', amount: cash - (kembalian > 0 ? kembalian : 0) }); }
    if (bca > 0) { methods.push('BCA'); breakdown.push({ method: 'TF_BCA_PUSAT', amount: bca }); }
    if (bri > 0) { methods.push('BRI'); breakdown.push({ method: 'TF_BRI_PUSAT', amount: bri }); }

    let methodStr = '';
    if (isSplitPayment) {
      methodStr = `MIX (${methods.join('+')})`;
      if (sisaBon > 0 && totalBayarInput > 0) methodStr = `DP_${methodStr}+PIUTANG`;
      else if (sisaBon === cartTotal && !poTerbuka) methodStr = 'PIUTANG';
    } else {
      if (singleMethod === 'DP_PIUTANG') methodStr = `DP_${dpMethod}+PIUTANG`;
      else {
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
      handleMoneyInput(String(cartTotal), setPayCash, setDisplayPayCash); 
      handleMoneyInput('', setPayBCA, setDisplayPayBCA); 
      handleMoneyInput('', setPayBRI, setDisplayPayBRI); 
    } 
    else handleMoneyInput(String(cartTotal), setSingleAmountPaid, setDisplaySingleAmountPaid);
  };

  const handleCreateCustomerFast = async (e) => {
    e.preventDefault();
    if (!newCustomerForm.name) return alert("Nama wajib diisi!");
    const fastId = generateId('CST', todayStr);
    const payload = {
      customer_id: fastId, date: todayStr, branch_id: currentBranch,
      customer_name: newCustomerForm.name.toUpperCase(), phone: newCustomerForm.phone || '-', address: newCustomerForm.address || '-',
      notes: newCustomerForm.notes || 'Dibuat kilat via Kasir POS', customer_tier: newCustomerForm.category, status: 'ACTIVE', isDeleted: false
    };
    const isSuccess = await sendToSheet('insert', [payload], 'master_customers');
    if (isSuccess) {
      showToast(`Pelanggan "${newCustomerForm.name}" Berhasil Terdaftar!`, 'success');
      handleCustomerChange(fastId); setShowAddCustomerModal(false);
      setNewCustomerForm({ name: '', phone: '', address: '', notes: '', category: 'RESELLER' });
    }
  };

  const poOptionsForBorrow = useMemo(() => {
    if (!borrowForm.product) return [];
    const opts = [];
    const pName = borrowForm.product.product_name;
    Object.entries(stockData.poQuarantineDetails).forEach(([poId, items]) => {
      const qty = items[pName] || 0;
      if (qty > 0) {
        const po = orders.find(o => o.id === poId);
        opts.push({ poId, qty, customer: po?.customer_name || 'UMUM' });
      }
    });
    return opts;
  }, [borrowForm.product, stockData.poQuarantineDetails, orders]);

  const executeBorrowKarantina = async () => {
    if (!borrowForm.poId) return alert("Pilih Nota PO sumber pinjaman!");
    const borrowQtyNum = Number(borrowForm.qty);
    if (borrowQtyNum <= 0 || borrowQtyNum > borrowForm.maxQty) return alert("Angka pinjaman tidak valid!");
    if (!window.confirm(`Pinjam ${borrowQtyNum} Pcs dari PO ${borrowForm.poId}? Tindakan ini akan tercatat di sistem.`)) return;

    const p1 = { id: generateId('INV', todayStr) + '-QOUT', date: todayStr, branch_id: currentBranch, category: 'BONGKAR_KARANTINA', item_name: borrowForm.product.product_name, qty_remaining: -borrowQtyNum, unit_cost: 0, status: 'KARANTINA', reference_id: borrowForm.poId, notes: `Dibongkar paksa Kasir POS`, isDeleted: false };
    const p2 = { id: generateId('INV', todayStr) + '-FREE', date: todayStr, branch_id: currentBranch, category: 'STOK_PINJAMAN', item_name: borrowForm.product.product_name, qty_remaining: borrowQtyNum, unit_cost: 0, status: 'ACTIVE', reference_id: 'PINJAMAN', notes: `Bongkaran dari PO ${borrowForm.poId}`, isDeleted: false };
    
    const success = await sendToSheet('insert', [p1, p2], 'inventory_cost_layers');
    if (success) {
       setNotes(prev => {
          const addNote = `[PINJAM KARANTINA] ${borrowQtyNum} Pcs ${borrowForm.product.product_name} dari PO ${borrowForm.poId}`;
          return prev ? prev + ' | ' + addNote : addNote;
       });
       addToCart(borrowForm.product, borrowQtyNum);
       setShowBorrowModal(false);
       showToast('Stok berhasil dipinjam & masuk keranjang otomatis!', 'success');
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

    let finalNotes = notes || '-';
    if (singleMethod === 'COD_PO' && targetDate) finalNotes = `(TARGET PO: ${formatDate(targetDate)}) ${finalNotes}`;

    const confirmMsg = `${editingOrderId ? '⚡ REVISI NOTA PENJUALAN' : 'Konfirmasi Transaksi Grosir Aditya'}:\n\nNo Invoice: ${orderId}\nPelanggan: ${custName}\nTotal Belanja Aktual: ${formatRupiah(cartTotal)}\nTotal Uang Masuk: ${formatRupiah(paymentSummary.totalDibayar)}\nSisa Bon Gantung: ${formatRupiah(paymentSummary.sisaBon)}\n\nSahkan & Kirim ke Cloud?`;
    if (!window.confirm(confirmMsg)) return;

    // 🔥 JANTUNG KASIR: TRIPLE-ENTRY PADA CHECKOUT
    const orderPayload = {
      id: orderId, date: todayStr, branch_id: currentBranch, customer_name: custName, sales_channel: custCategory,
      items: JSON.stringify(cart), qty: totalItemQty, total_amount: cartTotal, amount_paid: paymentSummary.totalDibayar,
      payment_method: paymentSummary.methodStr, status: paymentSummary.sisaBon <= 0 ? 'LUNAS' : 'BELUM_LUNAS', notes: finalNotes, isDeleted: false
    };

    const actionType = editingOrderId ? 'update' : 'insert';
    const isSuccess = await sendToSheet(actionType, orderPayload, 'orders');
    
    if (isSuccess) {
      if (editingOrderId) {
        showToast(`Invoice ${orderId} Berhasil Diperbarui! (Keuangan tidak diubah otomatis)`, 'warning'); 
        setEditingOrderId(null);
      } else {
        
        // 🔥 TRIGGER AUTO-POTONG STOK BARANG JADI (FREEZER) UNTUK SETIAP ITEM DI KERANJANG
        const inventoryPayloads = cart.map((item, idx) => ({
           id: `${orderId}-OUT-${idx}`, date: todayStr, branch_id: currentBranch, category: 'PRODUK_JADI',
           item_name: item.name.toUpperCase(), qty_received: 0, qty_remaining: -item.qty, unit_cost: item.hpp || 1125,
           status: 'SOLD', reference_id: orderId, isDeleted: false
        }));

        await sendToSheet('insert', inventoryPayloads, 'inventory_cost_layers');

        // PENCATATAN UANG MASUK (CASHFLOW)
        if (orderMode === 'INFLUENCER') {
          await sendToSheet('insert', { id: generateId('EXP', todayStr), date: todayStr, branch_id: currentBranch, category: 'BIAYA_PROMOSI', description: `Beban gratis menu ${totalItemQty} Pcs Nota ${orderId}.`, amount: cartHPP, payment_method: 'SISTEM', employee_name: 'SISTEM', isDeleted: false }, 'expenses');
        } else if (paymentSummary.totalDibayar > 0) {
          for (let pay of paymentSummary.breakdown) {
            if (pay.amount <= 0) continue;
            await sendToSheet('insert', { id: generateId('CFI', todayStr), date: todayStr, branch_id: currentBranch, type: 'IN', category: 'PENJUALAN POS', amount: pay.amount, method: pay.method, reference_id: orderId, description: `Pelunasan POS ${orderId} - Klien: ${custName} (${pay.method})`, isDeleted: false }, 'cashflow_transactions');
          }
        }
        showToast(`Invoice ${orderId} Berhasil Diproses & Stok Berkurang!`, 'success');
      }

      setPrintData({
        type: 'INVOICE', id: orderId, date: formatDate(todayStr), branch_name: currentBranch.replace(/_/g, ' '),
        admin_name: user?.name || 'Kasir Utama', customer_name: custName, items: cart.map(item => ({ name: item.name, qty: item.qty, subtotal: item.price * item.qty, price: item.price })),
        amount: cartTotal, paymentMethod: paymentSummary.methodStr.replace(/_/g, ' '), notes: finalNotes,
        history: { labelLama: 'Total Belanja', nominalLama: cartTotal, labelAksi: 'Total Masuk Kas', nominalAksi: paymentSummary.totalDibayar, labelBaru: 'Sisa Piutang Berjalan', nominalBaru: paymentSummary.sisaBon }
      });

      // Clear Form
      setCart([]); setSelectedCustomerId(''); setNotes(''); setTargetDate(''); 
      setPayCash(''); setDisplayPayCash('');
      setPayBCA(''); setDisplayPayBCA('');
      setPayBRI(''); setDisplayPayBRI('');
      setSingleAmountPaid(''); setDisplaySingleAmountPaid('');
      setIsSplitPayment(false); setOrderMode('REGULAR'); setCustomerSearchTerm(''); setSingleMethod('CASH'); setDpMethod('CASH');
    }
  };

  const handleTriggerEditOrder = (o) => {
    if (!window.confirm(`⚠️ PERHATIAN OWNER:\nTarik nota ${o.id} untuk direvisi?\n\nCATATAN PENTING: Revisi hanya akan mengubah rincian barang. Jika TOTAL HARGA berubah, Jurnal Arus Kas Pusat TIDAK AKAN OTOMATIS BERUBAH. Anda harus membatalkan (VOID) nota ini dan membuat nota baru jika ingin kas tetap sinkron.`)) return;
    
    setEditingOrderId(o.id);
    const notesArr = (o.notes || '').split(') ');
    if (notesArr.length > 1 && notesArr[0].includes('TARGET PO')) setNotes(notesArr[1]); else setNotes(o.notes || '');
    
    const foundCust = activeCustomers.find(c => String(c.customer_name).toUpperCase() === String(o.customer_name).toUpperCase());
    if (foundCust) setSelectedCustomerId(foundCust.customer_id || foundCust.id);

    const parsedItems = safeJsonParse(o.items, []);
    const itemsToCart = parsedItems.map(item => {
      const matchProd = activeProducts.find(p => p.product_name === item.name);
      return { id: matchProd ? matchProd.id : generateId('PRD', todayStr), name: item.name, price: Number(item.price || item.subtotal / item.qty || 0), hpp: Number(item.hpp || 0), qty: Number(item.qty || 0) };
    });
    setCart(itemsToCart);

    if (String(o.payment_method).startsWith('DP_')) { setSingleMethod('DP_PIUTANG'); handleMoneyInput(String(o.amount_paid), setSingleAmountPaid, setDisplaySingleAmountPaid); } 
    else if (o.payment_method === 'PIUTANG') setSingleMethod('PIUTANG'); 
    else if (o.payment_method === 'COD_PO') setSingleMethod('COD_PO'); 
    else { setSingleMethod(o.payment_method); handleMoneyInput(String(o.amount_paid), setSingleAmountPaid, setDisplaySingleAmountPaid); }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Nota ${o.id} berhasil dimuat di meja kasir untuk direvisi!`, 'warning');
  };

  const handleTriggerVoidOrder = async (orderId) => {
    if (!window.confirm(`🔥 PERINGATAN OWNER:\nHapus permanen (Void) nota ${orderId} dari sistem cloud?\nTindakan ini HANYA akan mengubah status nota, TIDAK MENGEMBALIKAN STOK FISIK YANG SUDAH DIPOTONG. Gunakan Opname jika barang kembali ke gudang.`)) return;
    const isSuccess = await sendToSheet('update', { id: orderId, isDeleted: true }, 'orders');
    if (isSuccess) showToast(`Nota ${orderId} berhasil dihapus permanen!`, 'success');
  };

  const historyOrdersData = useMemo(() => {
    return (orders || []).filter(o => {
      if (o.isDeleted || o.branch_id !== currentBranch) return false;
      const oDate = getLocalYMD(o.date);
      return oDate >= historyDateFrom && oDate <= historyDateTo;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [orders, currentBranch, historyDateFrom, historyDateTo]);

  const filteredHistoryOrders = useMemo(() => {
    if (!searchHistoryTerm) return historyOrdersData;
    const lower = searchHistoryTerm.toLowerCase();
    return historyOrdersData.filter(o => o.id.toLowerCase().includes(lower) || (o.customer_name || '').toLowerCase().includes(lower));
  }, [historyOrdersData, searchHistoryTerm]);

  return (
    <div className="flex flex-col gap-6 pb-10 text-slate-700 animate-in fade-in duration-200">
      
      {/* 🔥 FLUID GRADIENT MONITOR - PAPAN STOK LIVE ATAS */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white rounded-3xl p-5 shadow-2xl border border-slate-800 shrink-0 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-32 -right-32 w-72 h-72 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 text-[11px] font-black text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
          <Package size={16}/> Ringkasan Ketersediaan Papan Stok Master Gudang (Real-Time)
        </div>
        <div className="relative z-10 flex flex-wrap gap-4">
          {activeProducts.map(p => {
            const freeStock = stockData.free[p.product_name] || 0;
            const qStock = stockData.quarantine[p.product_name] || 0;
            return (
              <div key={p.id} className="bg-gradient-to-br from-slate-800/80 to-slate-900 border border-slate-700/60 p-4 rounded-2xl flex flex-col justify-between gap-3 min-w-[190px] shadow-lg flex-1 sm:flex-none relative overflow-hidden group hover:border-slate-500 transition-colors">
                
                {qStock > 0 && (
                  <div className="absolute top-0 right-0 bg-orange-600 text-white text-[9px] font-black px-2 py-0.5 rounded-bl-lg">
                    {formatNumber(qStock)} Karantina
                  </div>
                )}
                
                <div className="flex items-start gap-2.5">
                   <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 shadow-sm ${freeStock > 500 ? 'bg-emerald-400 animate-pulse shadow-emerald-500/50' : freeStock > 0 ? 'bg-amber-400 shadow-amber-500/50' : 'bg-rose-500 shadow-rose-500/50'}`}></div>
                   <div>
                     <div className="text-[11px] font-bold text-slate-300 uppercase leading-snug line-clamp-2">{p.product_name}</div>
                     <div className="text-xl font-black text-white mt-1">{formatNumber(freeStock)} <span className="text-[10px] text-slate-400 font-normal normal-case">Pcs (Bebas)</span></div>
                   </div>
                </div>

                <div className="flex gap-1.5 mt-1 border-t border-slate-700/50 pt-2">
                   <span className="bg-slate-950/60 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[9px] font-bold shadow-inner">{Math.floor(freeStock/50)} Mika</span>
                   <span className="bg-slate-950/60 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[9px] font-bold shadow-inner">{Math.floor(freeStock/4)} Porsi</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editingOrderId && (
        <div className="bg-orange-600 text-white font-black text-xs p-4 rounded-xl shadow-md animate-bounce flex justify-between items-center shrink-0">
          <span>⚠️ ANDA SEDANG DALAM MODE REVISI NOTA: {editingOrderId}. KLIK BATAL JIKA INGIN KEMBALI KE NOTA BARU.</span>
          <button onClick={() => { setEditingOrderId(null); setCart([]); setSelectedCustomerId(''); setNotes(''); setTargetDate(''); }} className="bg-white text-orange-700 px-3 py-1 rounded-lg font-black uppercase tracking-wider cursor-pointer">Batal Revisi</button>
        </div>
      )}

      {/* SWAP LAYOUT: KIRI (FORM KASIR), KANAN (KATALOG MENU) */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* KOLOM KIRI: DETAIL CHECKOUT SULTAN KASIR */}
        <div className="w-full lg:w-[420px] xl:w-[460px] shrink-0 flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col max-h-[40vh] overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-black text-slate-800 uppercase tracking-wide text-xs flex items-center gap-2"><Receipt size={14} className="text-blue-600"/> Nota Keranjang Belanja</h3>
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
                        <div className="font-black text-slate-800 text-[11px] uppercase truncate">{item.name}</div>
                        <div className="text-blue-600 font-black text-[10px] mt-0.5">{formatRupiah(item.price)}</div>
                      </div>
                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm shrink-0">
                        <button type="button" onClick={() => updateQtyExact(item.id, item.qty - 1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-600 cursor-pointer"><Minus size={10}/></button>
                        <input type="number" value={item.qty} onChange={(e) => updateQtyExact(item.id, parseInt(e.target.value) || 0)} className="w-12 text-center text-xs font-black text-slate-800 bg-transparent outline-none hide-arrows" />
                        <button type="button" onClick={() => updateQtyExact(item.id, item.qty + 1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-600 cursor-pointer"><Plus size={10}/></button>
                      </div>
                      <button type="button" onClick={() => removeFromCart(item.id)} className="ml-1 p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"><Trash2 size={13}/></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 text-xs font-bold shrink-0">
              <div className="flex justify-between items-center text-slate-800 text-sm font-black"><span className="uppercase tracking-wider">Total Tagihan:</span><span className="text-base text-blue-600">{orderMode === 'INFLUENCER' ? 'Rp 0 (Promo)' : formatRupiah(cartTotal)}</span></div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm border-t-4 border-t-blue-500 p-5">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1"><UserCheck size={12}/> Cari Pelanggan</label>
                  <button type="button" onClick={() => setShowAddCustomerModal(true)} className="text-[9px] font-black text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5 uppercase tracking-wider cursor-pointer"><PlusCircle size={10}/> (+) Pelanggan Baru</button>
                </div>
                <div className="space-y-2 bg-slate-50 p-2 rounded-xl border border-slate-200 shadow-inner">
                  <input type="text" value={customerSearchTerm} onChange={(e) => setCustomerSearchTerm(e.target.value)} placeholder="Ketik sepotong nama pelanggan..." className="w-full p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none uppercase tracking-wider" />
                  <select required value={selectedCustomerId} onChange={e => handleCustomerChange(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none cursor-pointer uppercase tracking-wider">
                    <option value="">-- Pilih Hasil Pencarian ({filteredCustomersForSelect.length}) --</option>
                    {filteredCustomersForSelect.map(c => (
                      <option key={c.customer_id || c.id} value={c.customer_id || c.id}>{c.customer_name} ({c.customer_tier || c.category})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between cursor-pointer shadow-inner" onClick={() => setOrderMode(prev => prev === 'REGULAR' ? 'INFLUENCER' : 'REGULAR')}>
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${orderMode === 'INFLUENCER' ? 'bg-red-100 text-red-600' : 'bg-white text-slate-400 border shadow-sm'}`}><Gift size={12}/></div>
                  <div>
                    <div className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Mode Influencer / Promosi Gratis</div>
                    <div className="text-[9px] font-bold text-slate-400 mt-0.5 normal-case">HPP akan dicatat sebagai beban promosi harian.</div>
                  </div>
                </div>
                <div className={`w-8 h-4 rounded-full relative ${orderMode === 'INFLUENCER' ? 'bg-red-500' : 'bg-slate-300'}`}><div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${orderMode === 'INFLUENCER' ? 'translate-x-4' : ''}`}></div></div>
              </div>

              {orderMode === 'REGULAR' && (
                <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-inner">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-wider">Opsi Model Bayar</label>
                    <label className="flex items-center gap-1 text-[10px] font-black text-slate-700 cursor-pointer uppercase tracking-wider"><input type="checkbox" disabled={editingOrderId !== null} checked={isSplitPayment} onChange={e=>{ setIsSplitPayment(e.target.checked); setPayCash(''); setDisplayPayCash(''); setPayBCA(''); setDisplayPayBCA(''); setPayBRI(''); setDisplayPayBRI(''); }} className="accent-blue-600"/> Aktifkan Bayar Campuran (Mix)</label>
                  </div>

                  {isSplitPayment ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border shadow-sm">
                        <span className="text-[10px] font-black text-slate-400 w-16">💵 CASH</span>
                        <input type="text" disabled={editingOrderId !== null} value={displayPayCash} onChange={e=>handleMoneyInput(e.target.value, setPayCash, setDisplayPayCash)} className="w-full text-right bg-transparent outline-none font-black text-xs text-slate-800" placeholder="0" />
                      </div>
                      <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border shadow-sm">
                        <span className="text-[10px] font-black text-blue-600 w-16">🏦 BCA PUSAT</span>
                        <input type="text" disabled={editingOrderId !== null} value={displayPayBCA} onChange={e=>handleMoneyInput(e.target.value, setPayBCA, setDisplayPayBCA)} className="w-full text-right bg-transparent outline-none font-black text-xs text-blue-700" placeholder="0" />
                      </div>
                      <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border shadow-sm">
                        <span className="text-[10px] font-black text-orange-600 w-16">🏦 BRI PUSAT</span>
                        <input type="text" disabled={editingOrderId !== null} value={displayPayBRI} onChange={e=>handleMoneyInput(e.target.value, setPayBRI, setDisplayPayBRI)} className="w-full text-right bg-transparent outline-none font-black text-xs text-orange-700" placeholder="0" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <select disabled={editingOrderId !== null} value={singleMethod} onChange={e=>{ setSingleMethod(e.target.value); setSingleAmountPaid(''); setDisplaySingleAmountPaid(''); }} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none cursor-pointer shadow-sm uppercase tracking-wider">
                            <option value="CASH">Cash (Tunai Laci)</option>
                            <option value="TF_BCA_PUSAT">Transfer BCA Pusat</option>
                            <option value="TF_BRI_PUSAT">Transfer BRI Pusat</option>
                            <option value="DP_PIUTANG">Bayar DP (Uang Muka)</option>
                            <option value="PIUTANG">Full Bon (Piutang Utang)</option>
                            <option value="COD_PO">PO Terbuka (Bayar Nanti)</option>
                          </select>
                        </div>
                        {singleMethod !== 'DP_PIUTANG' && singleMethod !== 'PIUTANG' && singleMethod !== 'COD_PO' && (
                          <div><input type="text" disabled={editingOrderId !== null} value={displaySingleAmountPaid} onChange={e=>handleMoneyInput(e.target.value, setSingleAmountPaid, setDisplaySingleAmountPaid)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-black text-right text-slate-800 outline-none shadow-sm" placeholder="Rp 0" /></div>
                        )}
                        {(singleMethod === 'PIUTANG' || singleMethod === 'COD_PO') && (
                          <div><input type="text" disabled value="" className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-black text-right text-slate-400 outline-none opacity-50 shadow-inner" placeholder={singleMethod === 'PIUTANG' ? 'Rp 0 (Full Bon)' : 'Rp 0 (PO Terbuka)'} /></div>
                        )}
                      </div>
                      
                      {singleMethod === 'DP_PIUTANG' && (
                        <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-lg shadow-inner">
                          <select disabled={editingOrderId !== null} value={dpMethod} onChange={e=>setDpMethod(e.target.value)} className="w-1/2 p-2 bg-white border border-orange-200 rounded-lg text-[10px] font-bold outline-none cursor-pointer text-orange-900 shadow-sm uppercase tracking-wider"><option value="CASH">Jalur: Tunai Laci</option><option value="TF_BCA_PUSAT">Jalur: TF BCA Pusat</option><option value="TF_BRI_PUSAT">Jalur: TF BRI Pusat</option></select>
                          <input type="text" disabled={editingOrderId !== null} value={displaySingleAmountPaid} onChange={e=>handleMoneyInput(e.target.value, setSingleAmountPaid, setDisplaySingleAmountPaid)} className="w-1/2 p-2 bg-white border border-orange-200 rounded-lg text-xs font-black text-right text-orange-700 outline-none shadow-sm placeholder:text-orange-300" placeholder="Nominal DP (Rp)" />
                        </div>
                      )}
                      {singleMethod === 'COD_PO' && (
                        <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg shadow-inner">
                          <label className="text-[9px] font-black text-purple-800 block mb-1 uppercase tracking-wider">Set Tanggal Target Acara / PO: (Opsional)</label>
                          <input type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)} className="w-full p-2 bg-white border border-purple-200 rounded-lg text-xs font-bold text-purple-900 outline-none cursor-pointer shadow-sm" />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t border-slate-200 pt-2 text-[10px] font-bold space-y-1 text-slate-600 uppercase tracking-wider">
                    <div className="flex justify-between items-center"><span>Total Input Bayar:</span><span className="font-black text-slate-800">{formatRupiah(isSplitPayment ? Number(payCash||0)+Number(payBCA||0)+Number(payBRI||0) : Number(singleAmountPaid||0))}</span></div>
                    {paymentSummary.sisaBon > 0 && <div className="flex justify-between items-center text-rose-600 font-black bg-rose-50 px-2 py-1 rounded"><span>⚠️ Sisa Kurang (Masuk Bon Gantung):</span><span>{formatRupiah(paymentSummary.sisaBon)}</span></div>}
                    {paymentSummary.kembalian > 0 && <div className="flex justify-between items-center text-emerald-600 font-black text-xs border-2 border-dashed border-emerald-200 p-1.5 rounded-lg bg-emerald-50/50 mt-1"><span>🟢 KEMBALIAN KASIR:</span><span>{formatRupiah(paymentSummary.kembalian)}</span></div>}
                    {singleMethod !== 'PIUTANG' && singleMethod !== 'COD_PO' && singleMethod !== 'DP_PIUTANG' && editingOrderId === null && (
                      <div className="flex justify-end pt-1"><button type="button" onClick={setLunasOtomatis} className="text-[9px] font-black text-blue-600 bg-white border px-2 py-1 rounded shadow-sm cursor-pointer hover:bg-blue-50 transition-colors">Set Lunas Otomatis</button></div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black text-slate-500 block mb-1 uppercase tracking-wider flex items-center gap-1"><Tag size={12}/>Catatan Khusus Invoice / Request Dapur</label>
                <input type="text" value={notes} onChange={e=>setNotes(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-medium normal-case outline-none bg-slate-50 focus:bg-white focus:border-blue-400 transition-colors shadow-inner" placeholder={orderMode === 'INFLUENCER' ? "Ketik detail target promo..." : "Contoh: Bawa sore hari, jangan pakai daun bawang..."} />
              </div>

              <button type="button" onClick={handleCheckout} className={`w-full text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-widest shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${editingOrderId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                <CheckCircle2 size={16}/> {editingOrderId ? 'Simpan & Sahkan Hasil Revisi Nota' : 'Sahkan Transaksi & Potong Stok'}
              </button>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: KATALOG BARANG */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 rounded-lg border border-blue-100"><ShoppingCart className="text-blue-600" size={18}/></div>
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Katalog POS Grosir B2B</h2>
                <p className="text-[9px] font-bold text-slate-400 normal-case mt-0.5">Ketuk item untuk memasukkan pesanan partai besar.</p>
              </div>
            </div>
            <div className="relative w-full sm:w-64 shrink-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:bg-white focus:border-blue-400 transition-colors shadow-inner normal-case" placeholder="Cari nama barang..." />
            </div>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar max-h-[70vh] pb-2 pr-1">
            {filteredProducts.map(product => {
              const freeStock = stockData.free[product.product_name] || 0;
              const qStock = stockData.quarantine[product.product_name] || 0;
              
              const wholesalePrice = Number(product.selling_price || 0);
              const retailPrice = Number(product.retail_price || product.penalty_price || product.selling_price || 0);
              const wholesaleQty = Number(product.wholesale_qty || 1);

              return (
                <div key={product.id} onClick={() => handleProductClick(product)} className={`bg-white border rounded-3xl p-4 cursor-pointer hover:shadow-md transition-all flex flex-col justify-between h-full group relative shadow-sm overflow-hidden ${freeStock <= 0 && qStock > 0 ? 'border-orange-300 hover:border-orange-500 bg-orange-50/30' : 'border-slate-200 hover:border-blue-400'}`}>
                  
                  <div className="absolute top-0 right-0 flex flex-col items-end">
                    <div className={`px-2.5 py-0.5 text-[9px] font-black rounded-bl-xl uppercase tracking-wider shadow-sm ${freeStock > 500 ? 'bg-emerald-100 text-emerald-800' : freeStock > 0 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'}`}>
                      Bebas: {formatNumber(freeStock)}
                    </div>
                    {qStock > 0 && (
                      <div className="px-2.5 py-0.5 text-[8px] font-black bg-orange-100 text-orange-800 rounded-bl-xl border-l border-b border-orange-200 uppercase tracking-wider shadow-sm">
                        PO: {formatNumber(qStock)}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 mb-2">
                    <h3 className="font-black text-slate-800 text-xs uppercase tracking-wide group-hover:text-blue-600 transition-colors pr-2 leading-snug line-clamp-2">{product.product_name}</h3>
                  </div>
                  
                  <div className="space-y-2 mt-auto">
                    {wholesaleQty > 1 ? (
                      <div className="space-y-1.5">
                        <div className="text-[9px] font-black text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-md flex justify-between uppercase tracking-wider shadow-inner">
                          <span>Eceran (&lt; {wholesaleQty}):</span> <span className="text-rose-600 font-black">{formatRupiah(retailPrice)}</span>
                        </div>
                        <div className="text-[9px] font-black text-slate-500 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-md flex justify-between uppercase tracking-wider shadow-sm">
                          <span>Grosir (&ge; {wholesaleQty}):</span> <span className="text-emerald-700 font-black">{formatRupiah(wholesalePrice)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-emerald-600 font-black text-sm tracking-tight">{formatRupiah(wholesalePrice)}</div>
                    )}

                    <div className="flex justify-between items-end pt-1">
                      <div className="flex items-center gap-1.5">
                         <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 shadow-3xs" title="1 Mika = 50 Pcs">1 MK = 50</span>
                         <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 shadow-3xs" title="1 Porsi = 4 Pcs">1 PR = 4</span>
                      </div>

                      {freeStock <= 0 && qStock > 0 && (
                        <div className="text-[9px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200 flex items-center gap-1 animate-pulse uppercase tracking-wider shadow-sm">
                          <Unlock size={10}/> Pinjam PO
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* =========================================================
          MODAL DARURAT: PINJAM STOK KARANTINA KASIR (CROSS-BORROW)
         ========================================================= */}
      {showBorrowModal && borrowForm.product && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-orange-200 overflow-hidden flex flex-col">
            <div className="p-6 flex flex-col items-center text-center border-b border-slate-100 bg-orange-50">
              <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 mb-3 shadow-sm border border-orange-200">
                <AlertTriangle size={28}/>
              </div>
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Stok Bebas Kosong!</h3>
              <p className="text-[11px] font-bold text-slate-500 mt-2 normal-case leading-relaxed">
                Stok bebas <b>{borrowForm.product.product_name}</b> di gudang habis total. Anda bisa meminjam stok dari Nota PO yang sedang dikarantina.
              </p>
            </div>
            
            <div className="p-6 bg-white space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2">Pilih Nota PO Sumber Pinjaman</label>
                <select 
                  value={borrowForm.poId} 
                  onChange={(e) => {
                    const selected = poOptionsForBorrow.find(opt => opt.poId === e.target.value);
                    setBorrowForm({ ...borrowForm, poId: e.target.value, maxQty: selected ? selected.qty : 0, qty: '' });
                  }} 
                  className="w-full p-3.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:border-orange-500 outline-none cursor-pointer text-slate-800 uppercase tracking-wider shadow-sm transition-colors"
                >
                  <option value="">-- Pilih Nota PO Karantina --</option>
                  {poOptionsForBorrow.map(opt => (
                    <option key={opt.poId} value={opt.poId}>
                      PO: {opt.customer} ({opt.poId}) - Tersedia: {formatNumber(opt.qty)} Pcs
                    </option>
                  ))}
                </select>
              </div>

              {borrowForm.poId && (
                <div className="animate-in fade-in slide-in-from-top-2 p-4 bg-orange-50 rounded-2xl border border-orange-100 shadow-inner">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-2 flex justify-between">
                    <span>Jumlah Pcs Dipinjam</span>
                    <span className="text-orange-600">Maks: {formatNumber(borrowForm.maxQty)} Pcs</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      max={borrowForm.maxQty}
                      value={borrowForm.qty} 
                      onChange={(e) => setBorrowForm({ ...borrowForm, qty: e.target.value.replace(/\D/g, '') })}
                      className="flex-1 p-3 border border-slate-300 rounded-xl text-xl font-black outline-none focus:border-orange-500 text-slate-800 text-center shadow-sm"
                      placeholder="0"
                    />
                    <button 
                      onClick={() => setBorrowForm({ ...borrowForm, qty: String(borrowForm.maxQty) })}
                      className="px-4 py-3.5 bg-slate-800 hover:bg-black text-white text-[10px] font-black rounded-xl transition-colors cursor-pointer uppercase tracking-wider shadow-md"
                    >
                      Bongkar Semua
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-4 shrink-0">
              <button onClick={() => setShowBorrowModal(false)} className="flex-1 py-3.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl transition-colors cursor-pointer uppercase tracking-wider shadow-sm">Batal</button>
              <button onClick={executeBorrowKarantina} disabled={!borrowForm.poId || !borrowForm.qty || Number(borrowForm.qty) <= 0} className="flex-1 py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95">
                <Unlock size={14}/> Bongkar &amp; Pindahkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          📑 TABLE HISTORI NOTA PENJUALAN + AKSI TOTAL OWNER HUB
         ========================================================= */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden mt-2">
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 shrink-0">
          <div>
            <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 uppercase tracking-wider"><Receipt size={18} className="text-blue-600"/> Histori Penjualan &amp; Re-Print Nota</h3>
            <p className="text-[11px] font-bold text-slate-400 normal-case mt-1 max-w-md leading-relaxed">Kelola rekam jejak penjualan, re-print struk, void transaksi, serta cetak Work Order (WO) dapur.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 p-2 rounded-2xl shadow-sm w-full sm:w-auto">
            <div className="flex items-center gap-2 px-2">
              <Calendar size={14} className="text-blue-500"/>
              <input type="date" value={historyDateFrom} onChange={e=>setHistoryDateFrom(e.target.value)} className="text-[11px] font-bold border-none outline-none cursor-pointer bg-transparent text-slate-700" />
              <span className="text-slate-300 font-bold text-sm">-</span>
              <input type="date" value={historyDateTo} onChange={e=>setHistoryDateTo(e.target.value)} className="text-[11px] font-bold border-none outline-none cursor-pointer bg-transparent text-slate-700" />
            </div>
            <div className="relative w-full sm:w-64 border-t sm:border-t-0 sm:border-l pl-0 sm:pl-3 border-slate-100 pt-2 sm:pt-0 mt-1 sm:mt-0">
              <Search size={14} className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Cari No. Inv / Nama..." value={searchHistoryTerm} onChange={e=>setSearchHistoryTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-xl text-[10px] font-bold outline-none border border-slate-200 focus:bg-white focus:border-blue-400 normal-case transition-colors" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto p-2 custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-100 sticky top-0 shadow-sm z-10">
              <tr>
                <th className="px-5 py-4 font-black">ID Transaksi &amp; Waktu</th>
                <th className="px-5 py-4 font-black">Nama Pelanggan Agen</th>
                <th className="px-5 py-4 font-black text-center">Volume Item</th>
                <th className="px-5 py-4 font-black text-center">Metode Sistem</th>
                <th className="px-5 py-4 font-black text-right">Keuangan (Omset &amp; Laba)</th>
                <th className="px-5 py-4 font-black text-center">Status Lunas</th>
                <th className="px-5 py-4 font-black text-center">Aksi Hub</th>
              </tr>
            </thead>
            <tbody className="text-xs font-bold divide-y divide-slate-100 bg-white">
              {filteredHistoryOrders.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-20 text-slate-400 font-medium text-sm normal-case">Tidak ada data invoice di periode ini.</td></tr>
              ) : (
                filteredHistoryOrders.map(o => {
                  let listItems = [];
                  try { listItems = safeJsonParse(o.items, []); } catch(e) {}
                  
                  let orderHPP = 0;
                  listItems.forEach(item => { orderHPP += (Number(item.hpp || 0) * Number(item.qty || 0)); });
                  const orderProfit = Number(o.total_amount || 0) - orderHPP;

                  let totalTerbayarDynamic = Number(o.amount_paid || 0);
                  let paymentHistory = [];
                  if (Number(o.amount_paid) > 0) {
                      paymentHistory.push({ date: formatDate(o.date), method: o.payment_method.replace(/_/g, ' '), amount: o.amount_paid, refId: 'DP AWAL' });
                  }
                  (piutangPayments || []).forEach(p => {
                    if (!p.isDeleted && p.orderId === o.id) {
                      totalTerbayarDynamic += Number(p.amount || 0);
                      paymentHistory.push({ date: formatDate(p.date), method: p.method.replace(/_/g, ' '), amount: p.amount, refId: p.id });
                    }
                  });
                  const sisaHutangDynamic = Math.max(0, Number(o.total_amount || 0) - totalTerbayarDynamic);
                  const statusLunasDynamic = sisaHutangDynamic <= 0 ? 'LUNAS' : 'BELUM_LUNAS';
                  
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div onClick={() => { setSelectedStaplesOrder({ ...o, orderHPP, listItems, sisaHutangDynamic, totalTerbayarDynamic }); setShowAddStaplesModal(true); }} className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-black font-mono text-[11px] mb-1">{o.id}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{formatDate(o.date)}</div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-slate-800 font-black uppercase text-xs tracking-wide">{o.customer_name}</td>
                      <td className="px-5 py-4 text-center whitespace-nowrap text-slate-600 font-black text-sm">{formatNumber(o.qty)} <span className="text-[10px] font-normal text-slate-400 uppercase tracking-wider">Pcs</span></td>
                      
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-md text-[9px] font-black bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">{o.payment_method}</span>
                        {String(o.payment_method).includes('DP_') && (
                          <div className="text-[10px] font-black text-orange-600 mt-1.5 uppercase tracking-wider">DP Masuk: {formatRupiah(o.amount_paid)}</div>
                        )}
                      </td>
                      
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="text-slate-900 font-black text-base tracking-tight">{formatRupiah(o.total_amount)}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1 line-through decoration-slate-300">HPP: {formatRupiah(orderHPP)}</div>
                        <div className="text-[11px] font-black text-emerald-600 mt-1 flex items-center justify-end gap-1.5"><TrendingUp size={12}/> Laba: {formatRupiah(orderProfit)}</div>
                      </td>

                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider ${statusLunasDynamic === 'LUNAS' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm' : 'bg-rose-100 text-rose-700 border border-rose-200 shadow-sm'}`}>{statusLunasDynamic}</span>
                        {sisaHutangDynamic > 0 && <div className="text-[10px] font-black text-rose-600 mt-2 uppercase tracking-wider">Sisa Bon: {formatRupiah(sisaHutangDynamic)}</div>}
                      </td>
                      
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button type="button" onClick={() => handleTriggerEditOrder(o)} className="p-2 text-slate-500 hover:text-orange-600 border border-slate-200 rounded-xl bg-white shadow-sm hover:bg-orange-50 cursor-pointer transition-colors" title="Revisi/Edit Nota Total"><Edit size={16}/></button>
                          
                          <button type="button" onClick={() => {
                            setPrintData({
                              type: 'INVOICE', 
                              id: o.id, date: formatDate(o.date), branch_name: currentBranch.replace(/_/g, ' '),
                              admin_name: user?.name || 'ADMIN PUSAT', customer_name: o.customer_name,
                              items: listItems.map(i => ({ name: i.name, qty: i.qty, subtotal: i.price * i.qty, price: i.price })), amount: o.total_amount,
                              paymentMethod: o.payment_method.replace(/_/g, ' '), notes: o.notes, paymentHistory: paymentHistory,
                              history: { labelLama: 'Total Belanja', nominalLama: o.total_amount, labelAksi: 'Total Sudah Dibayar', nominalAksi: totalTerbayarDynamic, labelBaru: 'Sisa Piutang Berjalan', nominalBaru: sisaHutangDynamic }
                            });
                          }} className="p-2 text-slate-400 hover:text-blue-600 border border-slate-200 rounded-xl shadow-sm bg-white cursor-pointer hover:bg-blue-50 transition-colors" title="Cetak Ulang Invoice Pelanggan"><Printer size={16}/></button>

                          <button type="button" onClick={() => {
                             let tgDate = '';
                             let cNotes = o.notes || '';
                             if (cNotes.includes('TARGET PO')) {
                                const splitted = cNotes.split(') ');
                                tgDate = splitted[0].replace('(TARGET PO: ', '');
                                cNotes = splitted.length > 1 ? splitted[1] : '';
                             }
                             setPrintData({
                              type: 'WO', id: o.id, date: formatDate(o.date), branch_name: currentBranch.replace(/_/g, ' '),
                              admin_name: user?.name || 'ADMIN PUSAT', customer_name: o.customer_name, targetDate: tgDate,
                              items: listItems.map(i => ({ name: i.name, qty: i.qty, unit: i.unit })), notes: cNotes
                            });
                          }} className="p-2 text-slate-400 hover:text-purple-600 border border-slate-200 rounded-xl shadow-sm bg-white cursor-pointer hover:bg-purple-50 transition-colors" title="Cetak Work Order (WO) Dapur"><ChefHat size={16}/></button>

                          <button type="button" onClick={() => handleTriggerVoidOrder(o.id)} className="p-2 text-slate-400 hover:text-rose-600 border border-slate-200 rounded-xl shadow-sm bg-white cursor-pointer hover:bg-rose-50 transition-colors" title="Void Nota Permanen"><Trash2 size={14}/></button>
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

      {/* POP-UP DETAILED LEDGER INTERAKTIF (BUKU STAPLES DIGITAL) */}
      {showStaplesModal && selectedStaplesOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col h-[85vh]">
            <div className="p-5 bg-slate-950 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-black text-sm uppercase flex items-center gap-2 text-orange-400 tracking-wider">📖 Buku Staples Ledger Nota: {selectedStaplesOrder.id}</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Klien: {selectedStaplesOrder.customer_name} | Tanggal Input: {formatDate(selectedStaplesOrder.date)}</p>
              </div>
              <button type="button" onClick={() => setShowAddStaplesModal(false)} className="text-slate-400 hover:text-white font-bold text-lg cursor-pointer">✕</button>
            </div>
            
            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar bg-slate-50 space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-3">1. Rincian Item Barang &amp; Laba Bersih</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b text-[10px] uppercase tracking-wider">
                        <th className="p-3">Nama Barang</th><th className="p-3 text-center">Qty</th><th className="p-3 text-right">Harga</th>
                        <th className="p-3 text-right">Subtotal</th><th className="p-3 text-right text-orange-600 bg-orange-50/50">HPP</th><th className="p-3 text-right text-emerald-600 bg-emerald-50/50">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-bold text-slate-700">
                      {selectedStaplesOrder.listItems.map((item, idx) => {
                        const totalItemHPP = Number(item.hpp || 0) * Number(item.qty || 0);
                        const totalItemProfit = (item.price * item.qty) - totalItemHPP;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 text-slate-800 uppercase tracking-wide">{item.name}</td><td className="p-3 text-center">{formatNumber(item.qty)} Pcs</td>
                            <td className="p-3 text-right">{formatRupiah(item.price)}</td><td className="p-3 text-right text-slate-900 font-black">{formatRupiah(item.price * item.qty)}</td>
                            <td className="p-3 text-right text-orange-700 bg-orange-50/30">{formatRupiah(totalItemHPP)}</td><td className="p-3 text-right text-emerald-700 bg-emerald-50/30 font-black">{formatRupiah(totalItemProfit)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-3">2. Rekam Jejak Aliran Setoran / Cicilan Piutang</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b text-[10px] uppercase tracking-wider"><th className="p-3">Waktu Setor</th><th className="p-3 text-center">Metode Kas</th><th className="p-3 text-right">Jumlah Bayar</th><th className="p-3 font-mono">ID Kuitansi</th></tr>
                    </thead>
                    <tbody className="divide-y font-bold text-slate-600">
                      <tr className="hover:bg-slate-50/50 transition-colors"><td className="p-3 text-slate-500">{formatDate(selectedStaplesOrder.date)}</td><td className="p-3 text-center"><span className="px-2 py-1 bg-slate-100 rounded-md text-[9px] uppercase font-black border border-slate-200 shadow-3xs">DP POS INITIAL</span></td><td className="p-3 text-right text-slate-800 font-black text-sm">{formatRupiah(selectedStaplesOrder.amount_paid)}</td><td className="p-3 font-mono text-[10px] text-slate-400">INITIAL_PAY</td></tr>
                      {(piutangPayments || []).filter(p => !p.isDeleted && p.orderId === selectedStaplesOrder.id).map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors"><td className="p-3 text-slate-800">{formatDate(p.date)}</td><td className="p-3 text-center"><span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-[9px] border border-blue-200 uppercase font-black shadow-3xs">{p.method}</span></td><td className="p-3 text-right text-blue-700 font-black text-sm">{formatRupiah(p.amount)}</td><td className="p-3 font-mono text-[10px] text-slate-400">{p.id}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl space-y-2.5 font-bold text-[11px] normal-case shadow-md">
                <div className="flex justify-between text-slate-400 uppercase tracking-wider"><span>A. Nilai Omset Nota Kotor (A)</span><span>{formatRupiah(selectedStaplesOrder.total_amount)}</span></div>
                <div className="flex justify-between text-slate-400 uppercase tracking-wider"><span>B. Akumulasi Total Uang Diterima (B)</span><span className="text-emerald-400">{formatRupiah(selectedStaplesOrder.totalTerbayarDynamic)}</span></div>
                <div className="border-t border-slate-700 my-2"></div>
                <div className="flex justify-between text-sm font-black uppercase tracking-wider">
                  <span>Sisa Bon Saat Ini (A - B)</span>
                  <span className={selectedStaplesOrder.sisaHutangDynamic <= 0 ? 'text-emerald-400' : 'text-rose-400 text-lg tracking-tight'}>{selectedStaplesOrder.sisaHutangDynamic <= 0 ? 'Rp 0 (LUNAS BERSIH)' : formatRupiah(selectedStaplesOrder.sisaHutangDynamic)}</span>
                </div>
              </div>
            </div>
            <div className="p-5 bg-white border-t border-slate-200 text-right shrink-0">
              <button type="button" onClick={() => setShowAddStaplesModal(false)} className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] uppercase tracking-wider rounded-xl shadow-md cursor-pointer transition-transform active:scale-95 w-full sm:w-auto">Tutup Buku Staples</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRASI PELANGGAN KILAT */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2"><PlusCircle size={18} className="text-emerald-400"/> Registrasi Pelanggan Kilat</h3>
              <button type="button" onClick={() => setShowAddCustomerModal(false)} className="text-slate-400 hover:text-white text-xl font-bold cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleCreateCustomerFast} className="p-6 space-y-4 bg-slate-50">
              <div><label className="text-[10px] font-black text-slate-500 block mb-1.5 uppercase tracking-wider">Nama Lengkap / Nama Toko Agen</label><input type="text" required value={newCustomerForm.name} onChange={e=>setNewCustomerForm({...newCustomerForm, name: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400 shadow-sm uppercase" placeholder="Contoh: AGEN CIBINONG JAYA" /></div>
              <div><label className="text-[10px] font-black text-slate-500 block mb-1.5 uppercase tracking-wider">No. Telepon / WhatsApp</label><input type="text" value={newCustomerForm.phone} onChange={e=>setNewCustomerForm({...newCustomerForm, phone: e.target.value.replace(/\D/g, '')})} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400 shadow-sm" placeholder="Contoh: 0812XXXXXXXX" /></div>
              <div><label className="text-[10px] font-black text-slate-500 block mb-1.5 uppercase tracking-wider">Alamat Lengkap Pengiriman</label><input type="text" value={newCustomerForm.address} onChange={e=>setNewCustomerForm({...newCustomerForm, address: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400 shadow-sm normal-case" placeholder="Contoh: Jl. Merdeka No. 12, RT 02/03" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1.5 uppercase tracking-wider">Kategori Harga</label>
                  <select value={newCustomerForm.category} onChange={e=>setNewCustomerForm({...newCustomerForm, category: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold cursor-pointer outline-none shadow-sm uppercase tracking-wider">
                    <option value="RESELLER">Reseller</option><option value="MITRA">Mitra Utama</option><option value="ECERAN">Eceran Biasa</option><option value="PEMALANG">Cb. Pemalang</option>
                  </select>
                </div>
                <div><label className="text-[10px] font-black text-slate-500 block mb-1.5 uppercase tracking-wider">Keterangan Khusus</label><input type="text" value={newCustomerForm.notes} onChange={e=>setNewCustomerForm({...newCustomerForm, notes: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400 shadow-sm normal-case" placeholder="Cth: Ambil Sore..." /></div>
              </div>
              <div className="pt-3 flex gap-3">
                <button type="button" onClick={() => setShowAddCustomerModal(false)} className="flex-1 py-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl uppercase tracking-wider cursor-pointer transition-colors shadow-sm">Batal</button>
                <button type="submit" className="flex-1 py-3.5 bg-emerald-600 text-white font-black text-xs rounded-xl uppercase tracking-wider shadow-md hover:bg-emerald-700 cursor-pointer transition-transform active:scale-95">Daftarkan &amp; Pilih</button>
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
