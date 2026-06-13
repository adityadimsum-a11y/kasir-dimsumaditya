import React, { useState, useMemo } from 'react';
import { 
  ShoppingCart, Search, Plus, Trash2, Printer, 
  CheckCircle2, AlertTriangle, Clock, Wallet, Box, User,
  Calendar, FileText, ArrowDownToLine, PackageCheck, X
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
      if (!window.confirm(`⚠️ STOK FREEZER KOSONG!\n\nMenu ${menu.product_name} saat ini habis.\nKlik OK jika ingin tetap menerima pesanan ini sebagai PRE-ORDER (Barang ditahan / DP dulu).`)) {
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
      id: trxId,
      date: new Date().toISOString(),
      branch_id: currentBranch,
      customer_name: customerName.toUpperCase(),
      sales_channel: orderSource,
      items: JSON.stringify(cartCalculated.items),
      qty: cartCalculated.totalQty,
      qty_delivered: initialQtyDelivered, // TRACKER BARANG DIAMBIL
      total_amount: cartCalculated.totalTagihan,
      amount_paid: nominalDibayar,
      payment_method: paymentMethod,
      status: statusLunas,
      fulfillment_status: fulfillment === 'PRE_ORDER' ? 'PRE_ORDER' : 'DIAMBIL',
      notes: paymentType === 'DP' ? `DP MASUK: ${formatRupiah(nominalDibayar)} VIA ${paymentMethod}` : ''
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
          title: fulfillment === 'PRE_ORDER' ? 'BUKTI PRE-ORDER (PO)' : 'STRUK PENJUALAN',
          id: trxId, date: formatDate(todayStr), branch_name: currentBranch,
          admin_name: user?.name || 'KASIR', customer_name: customerName.toUpperCase(),
          items: cartCalculated.items.map(i => ({ name: `${i.name} ${i.isEceran ? '(Ecer)' : '(Grosir)'}\n  ${i.note ? `*Ket: ${i.note}` : ''}`, qty: i.qty, subtotal: i.subtotal })),
          amount: cartCalculated.totalTagihan, paymentMethod: `${paymentType} (${paymentMethod.replace('_', ' ')})`,
          history: paymentType === 'DP' ? { labelLama: 'Total Tagihan', nominalLama: cartCalculated.totalTagihan, labelAksi: 'Uang Muka (DP) Masuk', nominalAksi: nominalDibayar, labelBaru: 'SISA PIUTANG (BELUM BAYAR)', nominalBaru: cartCalculated.totalTagihan - nominalDibayar } : null
        });
      }

      setCart([]); setCustomerName(''); setDpAmount(''); setPaymentType('LUNAS'); setFulfillment('LANGSUNG');
    }
  };

  // --- ACTIONS: SERAHKAN BARANG (PARSIAL / AMBIL SEBAGIAN) ---
  const handleSubmitDelivery = async (e) => {
    e.preventDefault();
    const qtyDiberikan = Number(deliveryQty);
    if (qtyDiberikan <= 0) return alert("Jumlah barang diserahkan tidak boleh kosong!");

    const orderTarget = deliveryModal;
    const qtyTotalPesan = Number(orderTarget.qty);
    const qtySudahDiambil = Number(orderTarget.qty_delivered !== undefined ? orderTarget.qty_delivered : 0);
    const sisaHakAmbil = qtyTotalPesan - qtySudahDiambil;

    if (qtyDiberikan > sisaHakAmbil) return alert(`Gagal! Jumlah yang diserahkan (${qtyDiberikan} Pcs) melebihi sisa hak ambil pelanggan (${sisaHakAmbil} Pcs).`);

    const newQtyDelivered = qtySudahDiambil + qtyDiberikan;
    const isSelesaiDiambil = newQtyDelivered >= qtyTotalPesan;

    const payloadUpdate = {
      ...orderTarget,
      qty_delivered: newQtyDelivered,
      fulfillment_status: isSelesaiDiambil ? 'DIAMBIL' : 'DIAMBIL_SEBAGIAN'
    };

    const isSuccess = await sendToSheet('update', payloadUpdate, 'orders');
    if (isSuccess) {
      showToast(`Berhasil mencatat penyerahan ${qtyDiberikan} Pcs ke pelanggan!`, 'success');
      setDeliveryModal(null);
      setDeliveryQty('');
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* 🚀 BANNER MONITOR STOK TERATAS (DENGAN KONVERSI KHUSUS DIMSUM MIX) */}
      <div className="bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-400 to-amber-500"></div>
        <div className="flex items-center gap-2 mb-4">
           <Box size={18} className="text-blue-400"/>
           <h3 className="text-white font-black uppercase tracking-widest text-xs">Pemantauan Stok Aktual Freezer</h3>
        </div>
        <div className="flex overflow-x-auto gap-4 pb-2 custom-scrollbar">
          {activeMenus.map(m => {
            const stok = stockMap[m.product_name] || 0;
            const isMix = m.product_name.toUpperCase().includes('DIMSUM AYAM MIX'); // Deteksi khusus Dimsum Mix

            return (
              <div key={m.id} className={`border rounded-2xl p-4 min-w-[160px] shrink-0 shadow-inner ${isMix ? 'bg-indigo-950/40 border-indigo-500/50' : 'bg-slate-950 border-slate-800'}`}>
                <div className={`text-[9px] font-black uppercase tracking-widest line-clamp-1 mb-1 ${isMix ? 'text-indigo-300' : 'text-slate-400'}`}>{m.product_name}</div>
                <div className={`text-2xl font-black tracking-tight ${stok > 0 ? 'text-emerald-400' : 'text-rose-500'}`}>{formatNumber(stok)} <span className="text-[10px] text-slate-500 font-bold">PCS</span></div>
                
                {/* KONVERSI KHUSUS DIMSUM MIX */}
                {isMix && (
                  <div className="mt-2 pt-2 border-t border-indigo-500/30 flex flex-col gap-0.5">
                     <div className="text-[9px] font-bold text-indigo-200">≈ {formatNumber(Math.floor(stok / 50))} <span className="text-indigo-400 uppercase">Mika (Isi 50)</span></div>
                     <div className="text-[9px] font-bold text-indigo-200">≈ {formatNumber(Math.floor(stok / 4))} <span className="text-indigo-400 uppercase">Porsi (Isi 4)</span></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: KATALOG MENU */}
        <div className="xl:col-span-5 flex flex-col h-[70vh] bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b bg-slate-50 shrink-0">
             <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2"><Box size={16} className="text-blue-600"/> Katalog Menu (Klik Untuk Jual)</h4>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeMenus.map(m => {
                const stok = stockMap[m.product_name] || 0;
                return (
                  <div key={m.id} onClick={() => handleAddMenu(m)} className={`border rounded-2xl p-4 cursor-pointer transition-all hover:shadow-md active:scale-95 flex flex-col justify-between relative overflow-hidden ${stok <= 0 ? 'bg-rose-50/30 border-rose-200 hover:border-rose-400' : 'bg-white border-slate-200 hover:border-blue-400'}`}>
                    {stok <= 0 && <div className="absolute -right-6 top-3 bg-rose-500 text-white text-[8px] font-black uppercase tracking-widest py-1 px-8 rotate-45 shadow-sm">KOSONG</div>}
                    <div>
                      <h5 className="font-black text-xs uppercase text-slate-800 pr-4 leading-tight mb-1">{m.product_name}</h5>
                      <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{m.category.replace('_', ' ')}</span>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100/80">
                      <div className="font-black text-blue-700 text-sm mb-1">{formatRupiah(m.selling_price)}</div>
                      <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                        Min Beli: {m.min_order} Pcs<br/>Harga Ecer: {formatRupiah(m.penalty_price)}
                      </div>
                      <div className={`mt-2 text-[9px] font-black uppercase px-2 py-1 rounded-md inline-block tracking-widest ${stok > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'}`}>
                        STOK AKTIF: {formatNumber(stok)} PCS
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* KANTONG KANAN: KERANJANG & CHECKOUT */}
        <div className="xl:col-span-7 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden border-t-4 border-t-emerald-500">
          <div className="p-5 border-b bg-emerald-50/30 shrink-0">
             <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2"><ShoppingCart size={16} className="text-emerald-600"/> Keranjang Kasir</h4>
          </div>

          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-50/30">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <ShoppingCart size={48} className="mb-3 opacity-20"/>
                <span className="font-black uppercase tracking-widest text-xs">Belum ada pesanan masuk.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {cartCalculated.items.map(item => (
                  <div key={item.id} className={`p-4 border rounded-2xl bg-white shadow-sm relative transition-all ${item.isEceran ? 'border-amber-300' : 'border-slate-200'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h5 className="font-black text-xs uppercase text-slate-800">{item.name}</h5>
                        {item.isEceran ? 
                          <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded border border-amber-200 uppercase tracking-widest mt-1 inline-block">Terkena Pinalti Harga Ecer (Min: {item.min_order})</span> : 
                          <span className="text-[8px] font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 uppercase tracking-widest mt-1 inline-block">Lolos Harga Grosir</span>
                        }
                      </div>
                      <button onClick={() => removeCartItem(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-24">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Jumlah (Pcs)</label>
                        <input type="number" min="1" value={item.qty} onChange={(e) => updateCartQty(item.id, Number(e.target.value))} className="w-full p-2 border border-slate-200 rounded-lg text-xs font-black text-center outline-none focus:border-emerald-400 bg-slate-50" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Catatan Tambahan Khusus Dapur</label>
                        <input type="text" value={item.note} onChange={(e) => updateCartNote(item.id, e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold uppercase outline-none focus:border-emerald-400 bg-slate-50" placeholder="Cth: Mix Hakau, dll..." />
                      </div>
                    </div>
                    <div className="flex justify-between items-end mt-3 pt-3 border-t border-slate-100">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Harga: {formatRupiah(item.hargaBerlaku)}/Pcs</span>
                      <span className="text-sm font-black text-emerald-600">{formatRupiah(item.subtotal)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 border-t bg-white shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] relative z-10">
            <form onSubmit={handleCheckout} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Nama Pembeli / Pelanggan</label>
                  <input type="text" required value={customerName} onChange={e=>setCustomerName(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-xs font-black uppercase outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors" placeholder="Ketik nama pelanggan..." />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Sumber Jalur Pembeli</label>
                  <select value={orderSource} onChange={e=>setOrderSource(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-xs font-black uppercase outline-none cursor-pointer bg-slate-50 focus:border-emerald-500 transition-colors">
                    <option value="WALK_IN_TOKO">ECERAN / BELI LANGSUNG TOKO</option>
                    <option value="RESELLER_AGEN">AGEN MITRA / RESELLER</option>
                    <option value="GOFOOD">APLIKASI GOFOOD</option>
                    <option value="SHOPEEFOOD">APLIKASI SHOPEEFOOD</option>
                    <option value="GRABFOOD">APLIKASI GRABFOOD</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 p-1.5 rounded-2xl flex gap-1.5 border border-slate-200">
                <button type="button" onClick={() => setFulfillment('LANGSUNG')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${fulfillment === 'LANGSUNG' ? 'bg-white shadow-sm border border-slate-200 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}><ShoppingCart size={14}/> Diambil Langsung</button>
                <button type="button" onClick={() => setFulfillment('PRE_ORDER')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${fulfillment === 'PRE_ORDER' ? 'bg-white shadow-sm border border-slate-200 text-amber-600' : 'text-slate-500 hover:text-slate-800'}`}><Clock size={14}/> Pre-Order (PO Ditahan)</button>
              </div>

              <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl relative overflow-hidden border border-slate-800">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Total Tagihan Nota</span>
                  <span className="text-3xl font-black tracking-tight">{formatRupiah(cartCalculated.totalTagihan)}</span>
                </div>
                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest border-t border-slate-800 pt-2 text-slate-400">
                  <span>Total Kuantitas: {formatNumber(cartCalculated.totalQty)} Pcs</span>
                  <span className="text-indigo-400">Est. Laba Kotor: {formatRupiah(cartCalculated.totalTagihan - cartCalculated.totalHpp)}</span>
                </div>
              </div>

              <div className="p-4 border border-slate-200 rounded-2xl bg-slate-50 shadow-inner">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cara Pembayaran</label>
                  <div className="flex gap-1 bg-slate-200/60 p-1 rounded-lg">
                    <button type="button" onClick={() => setPaymentType('LUNAS')} className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest ${paymentType === 'LUNAS' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}>LUNAS 100%</button>
                    <button type="button" onClick={() => setPaymentType('DP')} className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest ${paymentType === 'DP' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>BAYAR DP / UANG MUKA</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-[10px] font-black uppercase outline-none cursor-pointer bg-white focus:border-emerald-500">
                    <option value="CASH">UANG TUNAI LACI KASIR</option>
                    <option value="TF_BCA">TRANSFER REKENING BCA PUSAT</option>
                    <option value="TF_BRI">TRANSFER REKENING BRI PUSAT</option>
                  </select>
                  
                  {paymentType === 'DP' && (
                    <div className="relative animate-in fade-in zoom-in-95 duration-200">
                      <span className="absolute left-3 top-3.5 font-black text-blue-500 text-xs">Rp</span>
                      <input type="text" required value={dpAmount ? Number(dpAmount).toLocaleString('id-ID') : ''} onChange={e=>setDpAmount(e.target.value.replace(/\D/g, ''))} className="w-full pl-9 pr-3 py-3 border-2 border-blue-200 rounded-xl font-black text-sm text-blue-700 bg-white outline-none focus:border-blue-500" placeholder="0" />
                    </div>
                  )}
                </div>
              </div>

              <button type="submit" disabled={cart.length === 0} className="w-full bg-emerald-600 text-white font-black py-4.5 rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-transform active:scale-95 flex justify-center items-center gap-2 disabled:opacity-50 disabled:active:scale-100">
                <Printer size={16}/> Simpan Transaksi &amp; Cetak Tiket Nota
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 🚀 JURNAL RIWAYAT TRANSAKSI PENJUALAN BAWAH */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden mt-2">
        <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h4 className="font-black text-xs uppercase text-slate-800 tracking-widest flex items-center gap-2"><FileText size={16} className="text-blue-600"/> Riwayat Jurnal Transaksi POS</h4>
            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wider">Histori penjualan harian di Outlet / Pabrik ini.</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-300 px-3 py-2 rounded-xl shadow-sm">
            <Calendar size={14} className="text-blue-500 ml-0.5"/>
            <input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value || todayStr)} className="text-xs font-black text-slate-800 outline-none bg-transparent cursor-pointer" />
          </div>
        </div>
        
        <div className="overflow-x-auto flex-1 p-2 custom-scrollbar min-h-[40vh]">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-white text-[10px] uppercase text-slate-400 border-b border-slate-100">
              <tr>
                <th className="px-5 py-4 font-black">Waktu Nota &amp; ID</th>
                <th className="px-5 py-4 font-black min-w-[250px]">Pelanggan &amp; Rincian Keranjang</th>
                <th className="px-5 py-4 font-black text-center">Tracker Pengambilan Barang</th>
                <th className="px-5 py-4 font-black text-right">Rincian Tagihan Nota</th>
                <th className="px-5 py-4 font-black text-center">Aksi Op</th>
              </tr>
            </thead>
            <tbody className="text-xs font-bold divide-y divide-slate-50">
              {historyOrders.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-16 text-slate-400 font-black uppercase tracking-widest bg-slate-50/50">
                    <div className="flex justify-center mb-3 opacity-20"><ShoppingCart size={36}/></div>
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

                  // TRACKER BARANG LOGIC
                  const qtyTotal = Number(o.qty || 0);
                  const qtyDelivered = Number(o.qty_delivered !== undefined ? o.qty_delivered : (o.fulfillment_status === 'PRE_ORDER' ? 0 : qtyTotal));
                  const sisaBelumDiambil = qtyTotal - qtyDelivered;
                  
                  let statusBadge = '';
                  let badgeColor = '';
                  
                  if (sisaBelumDiambil <= 0) {
                    statusBadge = '✅ DIAMBIL FULL';
                    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  } else if (qtyDelivered > 0 && sisaBelumDiambil > 0) {
                    statusBadge = '⏳ DIAMBIL SEBAGIAN';
                    badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                  } else {
                    statusBadge = '⏳ PO DITAHAN FULL';
                    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                  }

                  return (
                    <tr key={o.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-black text-sm">{formatDate(o.date)}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-1">{o.id}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-black text-blue-700 uppercase text-xs mb-1 tracking-wide">{o.customer_name}</div>
                        <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded border border-slate-200 bg-slate-100 text-slate-600 mb-2 inline-block tracking-widest">{String(o.sales_channel).replace('_', ' ')}</span>
                        <div className="space-y-1 mt-1">
                          {parsedItems.map((item, idx) => (
                             <div key={idx} className="text-[10px] text-slate-600 uppercase font-bold flex justify-between items-start border-b border-dashed border-slate-100 pb-1">
                               <span>• {item.name} <span className="text-blue-500 font-black">(x{formatNumber(item.qty)})</span></span>
                               <span className="text-slate-400 shrink-0 ml-2">{formatRupiah(item.subtotal)}</span>
                             </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <div className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-sm inline-block ${badgeColor}`}>
                          <div className="mb-1 border-b border-black/10 pb-1">{statusBadge}</div>
                          <div className="text-[8px] flex flex-col gap-0.5">
                            <span>Total Pesan: {formatNumber(qtyTotal)}</span>
                            <span className="text-emerald-600">Sdh Diambil: {formatNumber(qtyDelivered)}</span>
                            {sisaBelumDiambil > 0 && <span className="text-rose-600 mt-1 font-black bg-rose-100 rounded px-1 py-0.5">SISA TERTINGGAL: {formatNumber(sisaBelumDiambil)}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap min-w-[180px]">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1"><span>Total Tagihan:</span><span>{formatRupiah(totalTagihan)}</span></div>
                        <div className="flex justify-between items-center text-[10px] font-bold text-emerald-600 mb-1 border-b border-slate-100 pb-1">
                          <span>{isDP ? 'DP Masuk:' : 'Lunas Masuk:'}</span>
                          <span className="flex items-center gap-1"><ArrowDownToLine size={10}/> {formatRupiah(totalMasuk)}</span>
                        </div>
                        {isDP && (
                          <div className="flex justify-between items-center text-[11px] font-black text-rose-600 uppercase"><span>Sisa Piutang:</span><span>{formatRupiah(sisaHutang)}</span></div>
                        )}
                        <div className="text-[8px] font-black text-slate-400 mt-1.5 uppercase text-right tracking-widest">Jalur: {String(o.payment_method || 'CASH').replace('_', ' ')}</div>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          {sisaBelumDiambil > 0 && (
                            <button type="button" onClick={() => setDeliveryModal(o)} className="w-full py-2 px-3 text-[9px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 border border-amber-300 shadow-sm hover:bg-amber-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 mb-1"><PackageCheck size={14}/> Serahkan Barang</button>
                          )}
                          <div className="flex gap-1.5 w-full">
                            <button type="button" onClick={() => triggerPrint('NOTA_DOTMATRIX', {
                              title: o.fulfillment_status === 'PRE_ORDER' ? 'BUKTI PRE-ORDER DITAHAN' : 'STRUK PENJUALAN RE-PRINT', id: o.id, date: formatDate(o.date),
                              branch_name: currentBranch, admin_name: user?.name || 'KASIR', customer_name: o.customer_name,
                              items: parsedItems.map(i => ({ name: `${i.name}\n  ${i.note ? `*Ket: ${i.note}` : ''}`, qty: i.qty, subtotal: i.subtotal })),
                              amount: totalTagihan, paymentMethod: `${isDP ? 'DP/UANG MUKA' : 'LUNAS 100%'} (${String(o.payment_method).replace('_', ' ')})`,
                              history: isDP ? { labelLama: 'Total Tagihan', nominalLama: totalTagihan, labelAksi: 'Uang Muka (DP) Masuk', nominalAksi: totalMasuk, labelBaru: 'SISA PIUTANG (BELUM BAYAR)', nominalBaru: sisaHutang } : null
                            })} className="flex-1 p-2 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors flex justify-center" title="Cetak Ulang Tiket Nota"><Printer size={16}/></button>
                            
                            <button type="button" onClick={() => { if(window.confirm("PERINGATAN! Yakin ingin MENGHAPUS (Void) transaksi penjualan ini? Stok dan Omset akan ditarik kembali!")) requestDelete(o.id); }} className="flex-1 p-2 text-slate-500 bg-white border border-slate-200 shadow-sm hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex justify-center" title="Void Hapus Transaksi"><Trash2 size={16}/></button>
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
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white rounded-3xl shadow-2xl border w-full max-w-sm overflow-hidden flex flex-col">
               <div className="bg-amber-500 text-white px-6 py-4 flex items-center justify-between">
                 <div className="flex items-center gap-2"><PackageCheck size={18}/><h3 className="font-black text-sm uppercase tracking-wider">Serahkan Barang (Cicil)</h3></div>
                 <button onClick={() => { setDeliveryModal(null); setDeliveryQty(''); }} className="hover:text-amber-200 transition"><X size={20}/></button>
               </div>
               
               <form onSubmit={handleSubmitDelivery} className="p-6 space-y-5">
                 <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl shadow-inner text-center">
                   <div className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Nota: {deliveryModal.id}</div>
                   <div className="text-lg font-black text-amber-900 uppercase leading-tight">{deliveryModal.customer_name}</div>
                   <div className="text-xs font-black text-rose-600 uppercase mt-2 pt-2 border-t border-amber-200 border-dashed">
                     Sisa Hak Ambil: {formatNumber(sisaHakAmbil)} Pcs
                   </div>
                 </div>

                 <div>
                   <label className="text-[10px] font-black text-emerald-600 uppercase block mb-1">Jumlah Diserahkan Saat Ini (Pcs)</label>
                   <input type="number" min="1" max={sisaHakAmbil} required value={deliveryQty} onChange={e=>setDeliveryQty(e.target.value)} className="w-full p-4 border-2 border-emerald-200 rounded-xl text-lg font-black text-emerald-700 bg-emerald-50/30 text-center outline-none focus:bg-white focus:border-emerald-500 transition-colors" placeholder={`Maks: ${sisaHakAmbil}`} />
                   <p className="text-[9px] font-bold text-slate-500 uppercase mt-2 text-center leading-relaxed tracking-wider">Jika Agen ambil 7 Mika, ketik 350. Sisa 3 Mika (150 Pcs) akan dilacak otomatis di sistem.</p>
                 </div>

                 <button type="submit" className="w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-xl bg-amber-500 hover:bg-amber-600 transition-transform active:scale-95 flex justify-center items-center gap-2">
                   <CheckCircle2 size={16}/> Konfirmasi Penyerahan
                 </button>
               </form>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
