import React, { useState, useMemo } from 'react';
import { 
  ShoppingCart, Search, Plus, Trash2, Printer, 
  CheckCircle2, AlertTriangle, Clock, Wallet, Box, User,
  Calendar, FileText, ArrowDownToLine, PackageCheck, X,
  Layers, Package
} from 'lucide-react';
import { getTodayStr, generateId, formatDate, safeJsonParse } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabOrders({ 
  orders = [], orders_data, 
  masterProducts = [], master_products, 
  productionBatches = [], production_batches,
  sendToSheet, showToast, user, requestDelete 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  // --- SINKRONISASI DATABASE ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realProducts = useMemo(() => master_products || masterProducts || [], [master_products, masterProducts]);
  const realProduction = useMemo(() => production_batches || productionBatches || [], [production_batches, productionBatches]);

  // --- STATE MESIN KASIR ---
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [orderSource, setOrderSource] = useState('WALK_IN_TOKO');
  const [fulfillment, setFulfillment] = useState('LANGSUNG');
  const [paymentType, setPaymentType] = useState('LUNAS');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [dpAmount, setDpAmount] = useState('');
  const [tableDateFilter, setTableDateFilter] = useState(todayStr);

  // STATE MODAL DELIVERY (AMBIL SEBAGIAN)
  const [deliveryModal, setDeliveryModal] = useState(null);
  const [deliveryQty, setDeliveryQty] = useState('');

  // --- 1. ENGINE STOK & MASTER MENU AKTIF ---
  const activeMenus = useMemo(() => {
    return realProducts.filter(p => !p.isDeleted && String(p.isDeleted).toUpperCase() !== 'TRUE' && p.status_active).reverse();
  }, [realProducts]);

  const stockMap = useMemo(() => {
    const map = {};
    activeMenus.forEach(p => map[p.product_name] = 0);
    
    realProduction.forEach(b => {
       if(!b.isDeleted && b.item_name && (b.branch_id === currentBranch || currentBranch === 'TANGERANG_PUSAT')) {
          map[b.item_name] = (map[b.item_name] || 0) + Number(b.actual_yield || b.qty || 0);
       }
    });
    
    realOrders.forEach(o => {
       if(!o.isDeleted && (o.branch_id === currentBranch || currentBranch === 'TANGERANG_PUSAT')) {
          const items = safeJsonParse(o.items, []);
          items.forEach(i => {
             if(i.name) map[i.name] = (map[i.name] || 0) - Number(i.qty || 0);
          });
       }
    });
    return map;
  }, [activeMenus, realProduction, realOrders, currentBranch]);

  // --- 2. ENGINE KALKULATOR KERANJANG ---
  const cartCalculated = useMemo(() => {
    let totalHpp = 0;
    let totalTagihan = 0;
    let totalQty = 0;

    const items = cart.map(item => {
      const isEceran = item.qty < item.min_order;
      const hargaBerlaku = isEceran ? item.penalty_price : item.selling_price;
      const subtotal = item.qty * hargaBerlaku;
      const subHpp = item.qty * item.default_hpp;

      totalTagihan += subtotal;
      totalHpp += subHpp;
      totalQty += item.qty;

      return { ...item, hargaBerlaku, subtotal, isEceran };
    });

    return { items, totalTagihan, totalHpp, totalQty };
  }, [cart]);

  // --- 3. JURNAL RIWAYAT TRANSAKSI ---
  const historyOrders = useMemo(() => {
    return realOrders
      .filter(o => !o.isDeleted && o.date.substring(0, 10) === tableDateFilter && (o.branch_id === currentBranch || currentBranch === 'TANGERANG_PUSAT'))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realOrders, tableDateFilter, currentBranch]);

  // --- ACTIONS: KASIR ---
  const handleAddMenu = (menu) => {
    const sisaStok = stockMap[menu.product_name] || 0;
    
    if (sisaStok <= 0) {
      if (!window.confirm(`⚠️ Stok freezer kosong!\n\nMenu ${menu.product_name} saat ini habis.\nKlik OK jika ingin tetap menerima pesanan ini sebagai pre-order (Barang ditahan / DP dulu).`)) {
        return;
      }
      setFulfillment('PRE_ORDER');
    }

    setCart(prev => {
      const existing = prev.find(i => i.id === menu.id);
      if (existing) {
        return prev.map(i => i.id === menu.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { 
        id: menu.id, name: menu.product_name, category: menu.category, 
        selling_price: menu.selling_price, penalty_price: menu.penalty_price, 
        min_order: menu.min_order, default_hpp: menu.default_hpp, qty: 1, note: '' 
      }];
    });
  };

  const updateCartQty = (id, newQty) => {
    if (newQty < 1) return;
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: newQty } : i));
  };

  const removeCartItem = (id) => setCart(prev => prev.filter(i => i.id !== id));
  const updateCartNote = (id, note) => setCart(prev => prev.map(i => i.id === id ? { ...i, note } : i));

  // --- ACTIONS: SUBMIT CHECKOUT ---
  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return alert("Keranjang kasir masih kosong!");
    if (!customerName) return alert("Nama pembeli harus diisi!");

    const trxId = generateId('INV', todayStr);
    
    const nominalDibayar = paymentType === 'LUNAS' ? cartCalculated.totalTagihan : Number(dpAmount || 0);
    if (paymentType === 'DP' && nominalDibayar <= 0) return alert("Nominal uang muka (DP) tidak boleh kosong!");
    if (paymentType === 'DP' && nominalDibayar >= cartCalculated.totalTagihan) return alert("Nominal DP melebih total tagihan. Silakan gunakan metode LUNAS.");

    const statusLunas = paymentType === 'LUNAS' ? 'LUNAS' : 'BELUM_LUNAS';
    const initialQtyDelivered = fulfillment === 'PRE_ORDER' ? 0 : cartCalculated.totalQty;

    const payloadOrder = {
      id: trxId, date: new Date().toISOString(), branch_id: currentBranch,
      customer_name: customerName.toUpperCase(), sales_channel: orderSource,
      items: JSON.stringify(cartCalculated.items), qty: cartCalculated.totalQty,
      qty_delivered: initialQtyDelivered, total_amount: cartCalculated.totalTagihan,
      amount_paid: nominalDibayar, payment_method: paymentMethod, status: statusLunas,
      fulfillment_status: fulfillment === 'PRE_ORDER' ? 'PRE_ORDER' : 'DIAMBIL',
      notes: paymentType === 'DP' ? `DP masuk: ${formatRupiah(nominalDibayar)} via ${paymentMethod}` : ''
    };

    const isSuccess = await sendToSheet('insert', payloadOrder, 'orders');

    if (isSuccess) {
      if (nominalDibayar > 0) {
        await sendToSheet('insert', {
          id: generateId('CFI', todayStr), date: todayStr, branch_id: currentBranch, type: 'IN',
          category: 'PENJUALAN POS', description: `INV: ${trxId} - Pelanggan: ${customerName.toUpperCase()} (${paymentType})`,
          amount: nominalDibayar, method: paymentMethod, reference_id: trxId
        }, 'cashflow_transactions');
      }

      showToast('Transaksi Penjualan Berhasil Disimpan!', 'success');
      
      if (window.confirm("Cetak Tiket Nota / Struk Pembelian?")) {
        triggerPrint('NOTA_DOTMATRIX', {
          title: fulfillment === 'PRE_ORDER' ? 'Bukti Pre-Order (PO)' : 'Struk Penjualan',
          id: trxId, date: formatDate(todayStr), branch_name: currentBranch,
          admin_name: user?.name || 'KASIR', customer_name: customerName.toUpperCase(),
          items: cartCalculated.items.map(i => ({ name: `${i.name} ${i.isEceran ? '(Ecer)' : '(Grosir)'}\n  ${i.note ? `*Ket: ${i.note}` : ''}`, qty: i.qty, subtotal: i.subtotal })),
          amount: cartCalculated.totalTagihan, paymentMethod: `${paymentType} (${paymentMethod.replace('_', ' ')})`,
          history: paymentType === 'DP' ? { labelLama: 'Total Tagihan', nominalLama: cartCalculated.totalTagihan, labelAksi: 'Uang Muka (DP) Masuk', nominalAksi: nominalDibayar, labelBaru: 'Sisa Piutang (Belum Bayar)', nominalBaru: cartCalculated.totalTagihan - nominalDibayar } : null
        });
      }

      setCart([]); setCustomerName(''); setDpAmount(''); setPaymentType('LUNAS'); setFulfillment('LANGSUNG');
    }
  };

  const handleSubmitDelivery = async (e) => {
    e.preventDefault();
    const qtyDiberikan = Number(deliveryQty);
    if (qtyDiberikan <= 0) return alert("Jumlah barang diserahkan tidak boleh kosong!");

    const orderTarget = deliveryModal;
    const qtyTotalPesan = Number(orderTarget.qty);
    const qtySudahDiambil = Number(orderTarget.qty_delivered !== undefined ? orderTarget.qty_delivered : 0);
    const sisaHakAmbil = qtyTotalPesan - qtySudahDiambil;

    if (qtyDiberikan > sisaHakAmbil) return alert("Gagal! Jumlah yang diserahkan melebihi sisa hak ambil pelanggan.");

    const newQtyDelivered = qtySudahDiambil + qtyDiberikan;
    const isSelesaiDiambil = newQtyDelivered >= qtyTotalPesan;

    const payloadUpdate = {
      ...orderTarget, qty_delivered: newQtyDelivered,
      fulfillment_status: isSelesaiDiambil ? 'DIAMBIL' : 'DIAMBIL_SEBAGIAN'
    };

    const isSuccess = await sendToSheet('update', payloadUpdate, 'orders');
    if (isSuccess) {
      showToast(`Berhasil mencatat penyerahan ${qtyDiberikan} Pcs ke pelanggan!`, 'success');
      setDeliveryModal(null); setDeliveryQty('');
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      
      {/* 🚀 BANNER MONITOR STOK TERATAS (CLEAN ENTERPRISE LOOK) */}
      <div className="card-holo p-6 shadow-xs relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600"></div>
        <div className="flex items-center gap-2 mb-5 pl-2">
           <Box size={20} className="text-red-600"/>
           <h3 className="text-slate-800 font-extrabold normal-case text-sm">Dashboard sisa stok aktual freezer</h3>
        </div>
        
        <div className="flex overflow-x-auto gap-6 pb-4 custom-scrollbar">
          {activeMenus.map(m => {
            const stok = stockMap[m.product_name] || 0;
            const isMix = m.product_name.toUpperCase().includes('DIMSUM AYAM MIX');

            return (
              <div key={m.id} className={`flex flex-col min-w-[320px] shrink-0 rounded-2xl overflow-hidden border shadow-xs ${isMix ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-white'}`}>
                 <div className={`p-4 border-b font-bold text-xs normal-case ${isMix ? 'border-red-100 bg-red-50/60 text-red-700' : 'border-slate-100 bg-slate-50 text-slate-700'}`}>
                   {m.product_name}
                 </div>
                 
                 <div className="p-4 grid grid-cols-3 gap-3">
                    {/* Kotak PCS Dasar */}
                    <div className="flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-xl">
                       <div className="text-[9px] font-bold text-slate-400 normal-case mb-1">Total Pcs</div>
                       <div className={`text-xl font-extrabold ${stok > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatNumber(stok)}</div>
                    </div>

                    {isMix ? (
                      <>
                        {/* Kotak MIKA */}
                        <div className="flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-xl">
                           <div className="text-[9px] font-bold text-blue-500 normal-case mb-1">Mika (50)</div>
                           <div className="text-lg font-extrabold text-slate-700">{formatNumber(Math.floor(stok / 50))}</div>
                        </div>
                        {/* Kotak PORSI */}
                        <div className="flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-xl">
                           <div className="text-[9px] font-bold text-amber-600 normal-case mb-1">Porsi (4)</div>
                           <div className="text-lg font-extrabold text-slate-700">{formatNumber(Math.floor(stok / 4))}</div>
                        </div>
                      </>
                    ) : (
                      <div className="col-span-2 flex items-center justify-center p-3 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
                         <span className="text-[9px] font-bold text-slate-400 normal-case">Produk tanpa konversi</span>
                      </div>
                    )}
                 </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: KATALOG MENU */}
        <div className="xl:col-span-5 flex flex-col h-[70vh] card-holo overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50 shrink-0">
             <h4 className="font-bold text-slate-800 normal-case text-xs flex items-center gap-2"><Box size={16} className="text-red-600"/> Katalog menu (Klik untuk tambah)</h4>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeMenus.map(m => {
                const stok = stockMap[m.product_name] || 0;
                return (
                  <div key={m.id} onClick={() => handleAddMenu(m)} className={`border rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.02] flex flex-col justify-between relative overflow-hidden shadow-xs ${stok <= 0 ? 'bg-red-50/50 border-red-200 hover:border-red-300' : 'bg-white border-slate-200 hover:border-red-400'}`}>
                    {stok <= 0 && <div className="absolute -right-6 top-3 bg-red-600 text-white text-[8px] font-bold py-1 px-8 rotate-45">Habis</div>}
                    <div>
                      <h5 className="font-bold text-xs normal-case text-slate-800 pr-4 leading-tight mb-1">{m.product_name}</h5>
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{m.category.replace('_', ' ').toLowerCase()}</span>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <div className="font-extrabold text-slate-900 text-sm mb-1">{formatRupiah(m.selling_price)}</div>
                      <div className="text-[9px] font-medium text-slate-400 normal-case leading-relaxed">
                        Min beli: {m.min_order} Pcs • Ecer: {formatRupiah(m.penalty_price)}
                      </div>
                      <div className={`mt-2 text-[9px] font-bold px-2 py-1 rounded-md inline-block ${stok > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                        Stok aktif: {formatNumber(stok)} Pcs
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* KANTONG KANAN: KERANJANG & CHECKOUT */}
        <div className="xl:col-span-7 flex flex-col card-holo overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50 shrink-0">
             <h4 className="font-bold text-slate-800 normal-case text-xs flex items-center gap-2"><ShoppingCart size={16} className="text-red-600"/> Keranjang kasir</h4>
          </div>

          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-white">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <ShoppingCart size={40} className="mb-3 opacity-30"/>
                <span className="font-bold tracking-wide text-xs text-slate-400">Belum ada pesanan masuk.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {cartCalculated.items.map(item => (
                  <div key={item.id} className={`p-4 border rounded-2xl bg-white shadow-xs relative transition-all ${item.isEceran ? 'border-amber-200 bg-amber-50/10' : 'border-slate-200'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h5 className="font-bold text-xs normal-case text-slate-800">{item.name}</h5>
                        {item.isEceran ? 
                          <span className="text-[9px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100 mt-1 inline-block">Kena pinalti eceran (Min: {item.min_order} Pcs)</span> : 
                          <span className="text-[9px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100 mt-1 inline-block">Harga grosir masuk</span>
                        }
                      </div>
                      <button onClick={() => removeCartItem(item.id)} className="text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={16}/></button>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-24">
                        <label className="text-[9px] font-bold text-slate-400 normal-case block mb-1">Jumlah (Pcs)</label>
                        <input type="number" min="1" value={item.qty} onChange={(e) => updateCartQty(item.id, Number(e.target.value))} className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold text-center outline-none focus:border-red-500 bg-slate-50 focus:bg-white" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[9px] font-bold text-slate-400 normal-case block mb-1">Catatan khusus dapur</label>
                        <input type="text" value={item.note} onChange={(e) => updateCartNote(item.id, e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-red-500 bg-slate-50 focus:bg-white" placeholder="Cth: Mix hakau, mika pisah..." />
                      </div>
                    </div>
                    <div className="flex justify-between items-end mt-3 pt-3 border-t border-slate-100">
                      <span className="text-[9px] font-medium text-slate-400">Harga: {formatRupiah(item.hargaBerlaku)} / Pcs</span>
                      <span className="text-sm font-extrabold text-slate-800">{formatRupiah(item.subtotal)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 border-t border-slate-200 bg-slate-50 shrink-0 shadow-xs relative z-10">
            <form onSubmit={handleCheckout} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Nama pembeli / Pelanggan</label>
                  <input type="text" required value={customerName} onChange={e=>setCustomerName(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-white outline-none focus:border-red-500" placeholder="Ketik nama pelanggan..." />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Sumber jalur pesanan</label>
                  <select value={orderSource} onChange={e=>setOrderSource(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-white outline-none cursor-pointer focus:border-red-500">
                    <option value="WALK_IN_TOKO">Eceran / Beli langsung toko</option>
                    <option value="RESELLER_AGEN">Agen mitra / Reseller</option>
                    <option value="GOFOOD">Aplikasi GoFood</option>
                    <option value="SHOPEEFOOD">Aplikasi ShopeeFood</option>
                    <option value="GRABFOOD">Aplikasi GrabFood</option>
                  </select>
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-1 rounded-xl flex gap-1 shadow-inner">
                <button type="button" onClick={() => setFulfillment('LANGSUNG')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${fulfillment === 'LANGSUNG' ? 'bg-slate-100 text-red-600 border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'}`}><ShoppingCart size={12}/> Diambil langsung</button>
                <button type="button" onClick={() => setFulfillment('PRE_ORDER')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${fulfillment === 'PRE_ORDER' ? 'bg-slate-100 text-amber-600 border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'}`}><Clock size={12}/> Pre-Order (PO ditahan)</button>
              </div>

              {/* 🚀 KOTAK TOTAL SUMMARY BALANCED FLAT DESIGN */}
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600"></div>
                <div className="flex justify-between items-end pl-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 normal-case block mb-0.5">Total tagihan nota</span>
                    <span className="text-[9px] font-medium text-slate-400">Total kuantitas: {formatNumber(cartCalculated.totalQty)} Pcs</span>
                  </div>
                  <span className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(cartCalculated.totalTagihan)}</span>
                </div>

                {/* HANYA MUNCUL DI HQ / PUSAT */}
                {currentBranch === 'TANGERANG_PUSAT' && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 pl-2">
                    <div className="flex justify-between text-[9px] font-bold text-slate-400 normal-case">
                      <span>Perkiraan modal pabrik (HPP):</span>
                      <span className="text-red-500 font-extrabold">{formatRupiah(cartCalculated.totalHpp)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-extrabold text-slate-700 normal-case">
                      <span>Perkiraan keuntungan bersih:</span>
                      <span className="text-emerald-600">+{formatRupiah(cartCalculated.totalTagihan - cartCalculated.totalHpp)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-xs">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] font-bold text-slate-500 normal-case">Metode pembayaran</label>
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-lg border">
                    <button type="button" onClick={() => setPaymentType('LUNAS')} className={`px-3 py-1.5 rounded-md text-[9px] font-bold ${paymentType === 'LUNAS' ? 'bg-white shadow-xs text-emerald-600' : 'text-slate-500'}`}>Lunas 100%</button>
                    <button type="button" onClick={() => setPaymentType('DP')} className={`px-3 py-1.5 rounded-md text-[9px] font-bold ${paymentType === 'DP' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-500'}`}>Bayar DP</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-[10px] font-bold bg-white outline-none cursor-pointer">
                    <option value="CASH">Uang tunai laci kasir</option>
                    <option value="TF_BCA">Transfer bank BCA pusat</option>
                    <option value="TF_BRI">Transfer bank BRI pusat</option>
                  </select>
                  
                  {paymentType === 'DP' && (
                    <div className="relative animate-in fade-in zoom-in-95 duration-200">
                      <span className="absolute left-3 top-2.5 font-bold text-blue-600 text-xs">Rp</span>
                      <input type="text" required value={dpAmount ? Number(dpAmount).toLocaleString('id-ID') : ''} onChange={e=>setDpAmount(e.target.value.replace(/\D/g, ''))} className="w-full pl-8 pr-3 py-2 border-2 border-blue-200 rounded-xl font-bold text-xs text-blue-700 bg-white outline-none" placeholder="0" />
                    </div>
                  )}
                </div>
              </div>

              <button type="submit" disabled={cart.length === 0} className="w-full btn-holo py-3.5 rounded-xl text-xs font-bold shadow-xs flex justify-center items-center gap-2 disabled:opacity-50">
                <Printer size={14}/> Simpan Transaksi &amp; Cetak Tiket Nota
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 🚀 JURNAL RIWAYAT TRANSAKSI PENJUALAN BAWAH */}
      <div className="card-holo flex flex-col overflow-hidden mt-2">
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            {/* 🔥 FIX: Hapus uppercase */}
            <h4 className="font-bold text-xs normal-case text-slate-800 flex items-center gap-2"><FileText size={16} className="text-red-600"/> Riwayat jurnal transaksi POS</h4>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5 normal-case">Histori penjualan harian di outlet / pabrik ini.</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
            <Calendar size={14} className="text-red-500 ml-0.5"/>
            <input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value || todayStr)} className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer" />
          </div>
        </div>
        
        <div className="overflow-x-auto flex-1 p-1 custom-scrollbar min-h-[40vh]">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/50 text-[10px] normal-case text-slate-400 border-b border-slate-200">
              <tr>
                <th className="px-5 py-4 font-bold">Waktu nota &amp; ID</th>
                <th className="px-5 py-4 font-bold min-w-[250px]">Pelanggan &amp; rincian keranjang</th>
                <th className="px-5 py-4 font-bold text-center">Tracker pengambilan barang</th>
                <th className="px-5 py-4 font-bold text-right">Rincian tagihan nota</th>
                <th className="px-5 py-4 font-bold text-center">Aksi op</th>
              </tr>
            </thead>
            <tbody className="text-xs font-bold divide-y divide-slate-100">
              {historyOrders.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-16 text-slate-400 normal-case font-bold bg-white">
                    <div className="flex justify-center mb-2 opacity-30"><ShoppingCart size={32}/></div>
                    Tidak ada riwayat transaksi penjualan pada tanggal yang dipilih.
                  </td>
                </tr>
              ) : (
                historyOrders.map(o => {
                  const parsedItems = safeJsonParse(o.items, []);
                  const totalMasuk = Number(o.amount_paid || 0);
                  const totalTagihan = Number(o.total_amount || 0);
                  const sisaHutang = totalTagihan - totalMasuk;
                  const isDP = sisaHutang > 0;

                  const qtyTotal = Number(o.qty || 0);
                  const qtyDelivered = Number(o.qty_delivered !== undefined ? o.qty_delivered : (o.fulfillment_status === 'PRE_ORDER' ? 0 : qtyTotal));
                  const sisaBelumDiambil = qtyTotal - qtyDelivered;
                  
                  let statusBadge = '';
                  let badgeColor = '';
                  
                  if (sisaBelumDiambil <= 0) {
                    statusBadge = 'Diambil full';
                    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  } else if (qtyDelivered > 0 && sisaBelumDiambil > 0) {
                    statusBadge = 'Diambil sebagian';
                    badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                  } else {
                    statusBadge = 'PO ditahan full';
                    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                  }

                  return (
                    <tr key={o.id} className="hover:bg-slate-50 transition-colors group bg-white">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-bold text-sm">{formatDate(o.date)}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">{o.id}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-extrabold text-slate-800 normal-case text-xs mb-1">{o.customer_name}</div>
                        <span className="text-[9px] font-bold normal-case px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-500 mb-2 inline-block">{String(o.sales_channel).replace('_', ' ').toLowerCase()}</span>
                        <div className="space-y-1 mt-1">
                          {parsedItems.map((item, idx) => (
                             <div key={idx} className="text-[10px] text-slate-600 normal-case font-medium flex justify-between items-start border-b border-dashed border-slate-100 pb-1">
                               <span>• {item.name} <span className="text-red-600 font-bold">(x{formatNumber(item.qty)})</span></span>
                               <span className="text-slate-400 shrink-0 ml-2">{formatRupiah(item.subtotal)}</span>
                             </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className={`px-3 py-2 rounded-xl text-[9px] font-bold normal-case border shadow-xs inline-block bg-white ${badgeColor}`}>
                          <div className="mb-1 border-b border-inherit pb-1 font-extrabold">{statusBadge}</div>
                          <div className="text-[8px] font-medium text-slate-500 flex flex-col gap-0.5">
                            <span>Total pesan: {formatNumber(qtyTotal)}</span>
                            <span>Sdh diambil: {formatNumber(qtyDelivered)}</span>
                            {sisaBelumDiambil > 0 && <span className="text-red-600 mt-1 font-bold bg-red-50 px-1 py-0.5 rounded">Sisa tertinggal: {formatNumber(sisaBelumDiambil)}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap min-w-[180px]">
                        <div className="flex justify-between items-center text-[10px] font-medium text-slate-400 mb-1"><span>Total tagihan:</span><span className="font-bold text-slate-700">{formatRupiah(totalTagihan)}</span></div>
                        <div className="flex justify-between items-center text-[10px] font-bold text-emerald-600 mb-1 border-b border-slate-100 pb-1">
                          <span>{isDP ? 'DP masuk:' : 'Lunas masuk:'}</span>
                          <span className="flex items-center gap-0.5"><ArrowDownToLine size={10}/> {formatRupiah(totalMasuk)}</span>
                        </div>
                        {isDP && (
                          <div className="flex justify-between items-center text-[10px] font-extrabold text-red-600 normal-case"><span>Sisa piutang:</span><span>{formatRupiah(sisaHutang)}</span></div>
                        )}
                        <div className="text-[8px] font-bold text-slate-400 mt-1.5 normal-case text-right">Jalur: {String(o.payment_method || 'CASH').toLowerCase()}</div>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap opacity-60 group-hover:opacity-100 transition-opacity">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          {sisaBelumDiambil > 0 && (
                            <button type="button" onClick={() => setDeliveryModal(o)} className="w-full py-1.5 px-3 text-[9px] font-bold normal-case text-amber-700 bg-amber-50 border border-amber-200 shadow-xs hover:bg-amber-100 rounded-md transition-colors flex items-center justify-center gap-1"><PackageCheck size={12}/> Serahkan barang</button>
                          )}
                          <div className="flex gap-1.5 w-full">
                            <button type="button" onClick={() => triggerPrint('NOTA_DOTMATRIX', {
                              title: o.fulfillment_status === 'PRE_ORDER' ? 'Bukti Pre-Order Ditahan' : 'Struk Penjualan Re-Print', id: o.id, date: formatDate(o.date),
                              branch_name: currentBranch, admin_name: user?.name || 'KASIR', customer_name: o.customer_name,
                              items: parsedItems.map(i => ({ name: `${i.name}\n  ${i.note ? `*Ket: ${i.note}` : ''}`, qty: i.qty, subtotal: i.subtotal })),
                              amount: totalTagihan, paymentMethod: `${isDP ? 'DP / Uang Muka' : 'Lunas 100%'} (${String(o.payment_method).replace('_', ' ')})`,
                              history: isDP ? { labelLama: 'Total Tagihan', nominalLama: totalTagihan, labelAksi: 'Uang Muka (DP) Masuk', nominalAksi: totalMasuk, labelBaru: 'Sisa Piutang (Belum Bayar)', nominalBaru: sisaHutang } : null
                            })} className="flex-1 p-2 text-slate-400 bg-white border border-slate-200 shadow-xs hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors flex justify-center" title="Cetak ulang tiket nota"><Printer size={14}/></button>
                            
                            <button type="button" onClick={() => { if(window.confirm("Peringatan! Yakin ingin menghapus (Void) transaksi penjualan ini? Stok dan omset akan ditarik kembali!")) requestDelete(o.id); }} className="flex-1 p-2 text-slate-400 bg-white border border-slate-200 shadow-xs hover:text-red-600 hover:bg-slate-50 rounded-lg transition-colors flex justify-center" title="Void hapus transaksi"><Trash2 size={14}/></button>
                          </div>
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

      {/* 🚀 MODAL TRACKER PENGAMBILAN BARANG (AMBIL SEBAGIAN) */}
      {deliveryModal && (() => {
        const qtyTotalPesan = Number(deliveryModal.qty);
        const qtySudahDiambil = Number(deliveryModal.qty_delivered !== undefined ? deliveryModal.qty_delivered : 0);
        const sisaHakAmbil = qtyTotalPesan - qtySudahDiambil;

        return (
          <div className="fixed inset-0 bg-slate-900/40 z-[9999] flex justify-center items-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden flex flex-col">
               <div className="bg-red-600 text-white px-5 py-4 flex items-center justify-between">
                 <div className="flex items-center gap-2"><PackageCheck size={16}/><h3 className="font-bold text-xs normal-case">Serahkan barang</h3></div>
                 <button onClick={() => { setDeliveryModal(null); setDeliveryQty(''); }} className="hover:text-red-200 transition"><X size={18}/></button>
               </div>
               
               <form onSubmit={handleSubmitDelivery} className="p-5 space-y-4">
                 <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                   <div className="text-[9px] font-bold text-slate-400 normal-case mb-0.5">Nota: {deliveryModal.id}</div>
                   <div className="text-base font-extrabold text-slate-800 normal-case leading-tight">{deliveryModal.customer_name}</div>
                   <div className="text-xs font-bold text-red-600 normal-case mt-2 pt-2 border-t border-slate-200 border-dashed">
                     Sisa hak ambil: {formatNumber(sisaHakAmbil)} Pcs
                   </div>
                 </div>

                 <div>
                   <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Jumlah diserahkan saat ini (Pcs)</label>
                   <input type="number" min="1" max={sisaHakAmbil} required value={deliveryQty} onChange={e=>setDeliveryQty(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-base font-bold text-slate-800 bg-slate-50 text-center outline-none focus:bg-white focus:border-red-500 transition-colors" placeholder={`Maksimal ${sisaHakAmbil} Pcs`} />
                   <p className="text-[9px] font-medium text-slate-400 normal-case mt-2 text-center leading-relaxed">Jika agen ambil 7 mika, ketik 350. Sisa 3 mika (150 Pcs) dilacak otomatis.</p>
                 </div>

                 <button type="submit" className="w-full btn-holo py-3 rounded-lg text-xs font-bold flex justify-center items-center gap-1.5 shadow-sm">
                   <CheckCircle2 size={14}/> Konfirmasi penyerahan
                 </button>
               </form>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
