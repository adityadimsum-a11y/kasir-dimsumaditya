import React, { useState, useMemo } from 'react';
import { ShoppingCart, Package, AlertCircle, Edit2, Printer, Trash2, X, FileText, Undo, Lock, CheckCircle2, Calendar } from 'lucide-react';
import { getTodayStr, generateId, formatDate, safeJsonParse, formatRp } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

// TRANSLATE KATEGORI MENU BIAR ENAK DIBACA
const terjemahkanKategori = (kat) => {
  if(kat === 'READY_TO_EAT') return 'SIAP SAJI (MATANG)';
  if(kat === 'FROZEN_GOODS') return 'MENTAH / FROZEN';
  if(kat === 'SAOS_BUMBU') return 'SAOS & BUMBU';
  return kat;
};

// DAFTAR PILIHAN METODE BAYAR YANG GAMPANG DIMENGERTI
const PILIHAN_BAYAR = [
  { id: 'CASH', label: 'TUNAI (LUNAS)' },
  { id: 'TF', label: 'TRANSFER (LUNAS)' },
  { id: 'DP', label: 'BAYAR DP (UANG MUKA)' }
];

const SALES_CHANNELS = [
  { id: 'ECERAN_WALKIN', label: 'Eceran / Beli Langsung ke Toko', group: 'OFFLINE' },
  { id: 'MITRA_AGEN', label: 'Mitra Agen Resmi', group: 'OFFLINE' },
  { id: 'RESELLER', label: 'Reseller Biasa', group: 'OFFLINE' },
  { id: 'PAKETAN_ACARA', label: 'Pesanan Acara / Catering', group: 'OFFLINE' },
  { id: 'SHOPEE', label: 'Toko Shopee', group: 'MARKETPLACE' },
  { id: 'TOKOPEDIA', label: 'Tokopedia', group: 'MARKETPLACE' },
  { id: 'TIKTOK', label: 'TikTok Shop', group: 'MARKETPLACE' },
  { id: 'SHOPEEFOOD', label: 'ShopeeFood', group: 'MERCHANT' },
  { id: 'GOFOOD', label: 'GoFood', group: 'MERCHANT' },
  { id: 'GRABFOOD', label: 'GrabFood', group: 'MERCHANT' },
];

export default function TabOrders({ 
  orders = [], orders_data, 
  productionBatches = [], production_batches, 
  purchases = [], purchases_data, 
  masterProducts = [], master_products,
  sendToSheet, showToast, user, requestDelete 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  const todayYMD = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const [isEditing, setIsEditing] = useState(false);
  const [showKarantinaModal, setShowKarantinaModal] = useState(false);
  const [filterDate, setFilterDate] = useState(todayYMD); 
  
  const [form, setForm] = useState({
    id: '', date: todayStr, customerName: '', channel: 'ECERAN_WALKIN', 
    deliveryMethod: 'DIRECT', paymentMethod: 'CASH', amountPaid: '', notes: '',
  });

  const [cart, setCart] = useState([]);

  // --- SINKRONISASI DATABASE ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realProd = useMemo(() => production_batches || productionBatches || [], [productionBatches, production_batches]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  
  const realProducts = useMemo(() => {
      const data = master_products || masterProducts;
      return Array.isArray(data) ? data : [];
  }, [masterProducts, master_products]);

  // --- ENGINE STOK & KARANTINA ---
  const stockMetrics = useMemo(() => {
    let totalMasukFreezer = 0; let totalKeluarFreezer = 0; let totalAyamMasukKg = 0; let totalAyamKeluarKg = 0; let karantinaPcs = 0; let listKarantina = [];

    realPurchases.filter(p => !p.isDeleted && p.category === 'BAHAN_BAKU' && (p.branch_id === currentBranch || p.branch_id === 'PUSAT')).forEach(p => { totalAyamMasukKg += Number(p.qty_kg || 0); });
    realProd.filter(p => !p.isDeleted && (p.branch_id === currentBranch || p.branch_id === 'PUSAT')).forEach(p => { totalMasukFreezer += Number(p.total_yield_pcs || 0); totalAyamKeluarKg += Number(p.total_ayam_kg || 0); });
    
    realOrders.filter(o => !o.isDeleted && (o.branch_id === currentBranch || o.branch_id === 'PUSAT')).forEach(o => {
      let totalQtyNota = 0;
      const parsedItems = safeJsonParse(o.items, []);
      parsedItems.forEach(i => totalQtyNota += Number(i.qty || 0));
      if (totalQtyNota === 0) totalQtyNota = Number(o.qty || 0);

      if (o.delivery_method === 'PRE_ORDER' && o.status !== 'SELESAI') { 
        karantinaPcs += totalQtyNota; listKarantina.push({...o, calculatedQty: totalQtyNota}); 
      } else { 
        totalKeluarFreezer += totalQtyNota; 
      }
    });

    const saldoFisikFreezer = totalMasukFreezer - totalKeluarFreezer;
    return { saldoFisikFreezer, karantinaPcs, sisaAvailable: saldoFisikFreezer - karantinaPcs, saldoAyamKg: Math.max(0, totalAyamMasukKg - totalAyamKeluarKg), listKarantina: listKarantina.sort((a,b) => new Date(a.date) - new Date(b.date)) };
  }, [realOrders, realProd, realPurchases, currentBranch]);

  // --- ENGINE KERANJANG & HARGA PINTAR ---
  const handleAddToCart = (product) => {
    setCart(prevCart => {
      const existingIdx = prevCart.findIndex(item => item.product_id === product.id);
      if (existingIdx >= 0) {
        const newCart = [...prevCart];
        const newQty = newCart[existingIdx].qty + 1;
        const finalPrice = newQty >= (product.min_order || 1) ? Number(product.selling_price) : Number(product.penalty_price || product.selling_price);
        
        newCart[existingIdx] = { ...newCart[existingIdx], qty: newQty, price: finalPrice, subtotal: newQty * finalPrice };
        return newCart;
      } else {
        const initialQty = 1;
        const finalPrice = initialQty >= (product.min_order || 1) ? Number(product.selling_price) : Number(product.penalty_price || product.selling_price);
        return [...prevCart, {
          product_id: product.id, name: product.product_name, category: product.category,
          qty: initialQty, price: finalPrice, subtotal: initialQty * finalPrice, request: ''
        }];
      }
    });
  };

  const handleUpdateCartItem = (index, field, value) => {
    setCart(prevCart => {
      const newCart = [...prevCart];
      const item = newCart[index];
      
      if (field === 'qty') {
        const newQty = Number(value);
        const masterProd = realProducts.find(p => p.id === item.product_id);
        if (masterProd) {
          const finalPrice = newQty >= (masterProd.min_order || 1) ? Number(masterProd.selling_price) : Number(masterProd.penalty_price || masterProd.selling_price);
          newCart[index] = { ...item, qty: newQty, price: finalPrice, subtotal: newQty * finalPrice };
        } else {
          newCart[index] = { ...item, qty: newQty, subtotal: newQty * item.price };
        }
      } else {
        newCart[index] = { ...item, [field]: value };
      }
      return newCart;
    });
  };

  const handleRemoveFromCart = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const cartTotals = useMemo(() => {
    let totalQty = 0; let totalTagihan = 0; let totalHpp = 0;
    cart.forEach(item => {
      totalQty += item.qty;
      totalTagihan += item.subtotal;
      const masterProd = realProducts.find(p => p.id === item.product_id);
      totalHpp += item.qty * Number(masterProd?.default_hpp || 0);
    });
    return { totalQty, totalTagihan, totalHpp, profitKotor: totalTagihan - totalHpp };
  }, [cart, realProducts]);

  const dibayarFinal = form.paymentMethod === 'DP' ? Number(form.amountPaid || 0) : cartTotals.totalTagihan;

  // --- ACTIONS PRINT & SUBMIT ---
  const handlePrintTiketProduksi = (log) => {
    const parsedItems = safeJsonParse(log.items, []);
    const printItems = parsedItems.map(item => ({
      name: `@@WORK_ORDER@@||${log.sales_channel}||${item.name} (${item.request || 'STANDAR'})||${log.notes || '-'}`,
      qty: item.qty, subtotal: 0
    }));

    triggerPrint('NOTA_DOTMATRIX', {
      title: 'WORK ORDER & MANIFEST PABRIK',
      id: log.id, date: formatDate(log.date), branch_name: log.branch_id || currentBranch,
      admin_name: user?.name || 'KASIR', customer_name: log.customer_name?.toUpperCase(),
      items: printItems.length > 0 ? printItems : [{ name: `@@WORK_ORDER@@||${log.sales_channel}||STANDAR MIX||${log.notes || '-'}`, qty: log.qty, subtotal: 0 }],
      paymentMethod: log.delivery_method === 'PRE_ORDER' ? 'ANTREAN PRE-ORDER' : 'PENGAMBILAN LANGSUNG'
    });
  };

  const handlePrintInvoiceKlien = (log) => {
    const sisaUtang = Number(log.total_amount) - Number(log.amount_paid);
    const textPembayaran = sisaUtang > 0 ? `BELUM LUNAS (SISA: ${formatRupiah(sisaUtang)})` : `LUNAS (${log.payment_method})`;
    
    const parsedItems = safeJsonParse(log.items, []);
    const printItems = parsedItems.map(item => ({
      name: `${item.name}\nKet: ${item.request || 'Sesuai Standar'}`, 
      qty: item.qty, subtotal: item.subtotal, suffix: ' Pcs'
    }));

    triggerPrint('NOTA_DOTMATRIX', {
      title: 'INVOICE PENJUALAN KLIEN',
      id: log.id, date: formatDate(log.date), branch_name: log.branch_id || currentBranch,
      admin_name: user?.name || 'KASIR', customer_name: log.customer_name?.toUpperCase(),
      items: printItems.length > 0 ? printItems : [{ name: `DIMSUM FROZEN (${log.sales_channel})`, qty: log.qty, subtotal: log.subtotal, suffix: ' Pcs' }],
      amount: log.total_amount, paymentMethod: textPembayaran
    });
  };

  const handleEditSafe = (log) => {
    try {
      const parsedItems = safeJsonParse(log.items, []);
      if (parsedItems.length === 0) {
        setCart([{ product_id: 'LEGACY', name: log.item_name || 'ITEM HISTORI LAMA', qty: log.qty, price: log.unit_price, subtotal: log.subtotal, request: log.custom_request }]);
      } else {
        setCart(parsedItems);
      }
      
      setForm({
        id: log.id || '', date: log.date ? String(log.date).substring(0, 10) : todayStr, 
        customerName: log.customer_name || '', channel: log.sales_channel || 'ECERAN_WALKIN', 
        deliveryMethod: log.delivery_method || 'DIRECT', paymentMethod: log.payment_method || 'CASH', 
        amountPaid: log.amount_paid !== undefined ? log.amount_paid : (log.total_amount || 0), notes: log.notes || ''
      });
      setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { alert('Gagal memuat data edit.'); }
  };

  const handleCancelEdit = () => {
    setIsEditing(false); setCart([]);
    setForm({ id: '', date: todayStr, customerName: '', channel: 'ECERAN_WALKIN', deliveryMethod: 'DIRECT', paymentMethod: 'CASH', amountPaid: '', notes: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return alert("Keranjang belanja masih kosong! Silakan pilih menu.");
    if (cartTotals.totalQty <= 0) return alert("Jumlah kuantitas tidak boleh 0!");

    const trxId = isEditing ? form.id : generateId('INV', form.date);
    const payload = {
      id: trxId, date: form.date, branch_id: currentBranch, customer_name: form.customerName.toUpperCase(), sales_channel: form.channel,
      items: JSON.stringify(cart), 
      qty: cartTotals.totalQty, 
      unit_price: cart[0]?.price || 0, 
      subtotal: cartTotals.totalTagihan, total_amount: cartTotals.totalTagihan, payment_method: form.paymentMethod, amount_paid: dibayarFinal,
      delivery_method: form.deliveryMethod, shipping_fee: 0,
      status: form.deliveryMethod === 'PRE_ORDER' ? 'BELUM_DIKIRIM' : 'SELESAI', notes: form.notes.toUpperCase()
    };

    if (await sendToSheet(isEditing ? 'update' : 'insert', payload, 'orders')) {
      showToast('Data penjualan disimpan & stok berhasil terpotong!', 'success');
      if (form.deliveryMethod === 'PRE_ORDER') handlePrintTiketProduksi(payload);
      handleCancelEdit();
    }
  };

  const isMatchDate = (dbDate, targetYMD) => {
    if (!targetYMD) return true; 
    if (!dbDate) return false;
    
    const EN_MONTHS = {
      'januari': 'january', 'februari': 'february', 'maret': 'march', 'mei': 'may',
      'juni': 'june', 'juli': 'july', 'agustus': 'august', 'oktober': 'october', 'desember': 'december'
    };
    
    let safeDateStr = String(dbDate).toLowerCase();
    for (const [id, en] of Object.entries(EN_MONTHS)) {
      safeDateStr = safeDateStr.replace(id, en);
    }
    
    try {
      const d = new Date(safeDateStr);
      if(!isNaN(d.getTime())) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}` === targetYMD;
      }
    } catch(e){}

    return String(dbDate).includes(targetYMD);
  };

  return (
    <div className="space-y-6 pb-10 relative animate-in fade-in duration-300">
      
      {/* ========================================= */}
      {/* WIDGET ATAS: INFO STOK BAHASA INDONESIA    */}
      {/* ========================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-white shadow-md relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/20 rounded-full blur-2xl"></div>
          <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest relative z-10">Stok Siap Dijual (Tersedia)</div>
          <div className="text-3xl font-black mt-1 relative z-10">{formatNumber(stockMetrics.sisaAvailable)} <span className="text-xs">PCS</span></div>
        </div>
        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 cursor-pointer shadow-sm hover:shadow-md transition-all hover:border-amber-400" onClick={() => setShowKarantinaModal(true)}>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1"><Lock size={12}/> Pesanan Ditahan (Karantina PO)</div>
              <div className="text-3xl font-black text-amber-700 mt-1">{formatNumber(stockMetrics.karantinaPcs)} <span className="text-xs">PCS</span></div>
            </div>
            <span className="bg-amber-500 text-white text-[9px] px-2.5 py-1 rounded-md font-black uppercase shadow-sm">Lihat Detail</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-l-4 border-l-blue-500 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Barang di Freezer (Keseluruhan)</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{formatNumber(stockMetrics.saldoFisikFreezer)} <span className="text-xs">PCS</span></div>
        </div>
        <div className="bg-rose-50 p-5 rounded-2xl border border-l-4 border-l-rose-500 shadow-sm">
          <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Stok Ayam Mentah (Gudang)</div>
          <div className="text-2xl font-black text-rose-700 mt-1">{formatNumber(stockMetrics.saldoAyamKg)} <span className="text-xs">KG</span></div>
        </div>
      </div>

      {/* ========================================= */}
      {/* ROW ATAS: KATALOG & KERANJANG KASIR         */}
      {/* ========================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* KATALOG MENU (KIRI) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border shadow-sm p-5 border-t-4 border-t-blue-500 h-max">
           <h3 className="font-black text-xs uppercase text-slate-800 tracking-widest flex items-center gap-2 mb-4"><Package size={16} className="text-blue-600"/> Katalog Menu (Klik untuk menambah)</h3>
           <div className="grid grid-cols-2 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
             {realProducts.length === 0 ? (
                <div className="col-span-2 text-center py-6 text-slate-400 text-xs font-bold border border-dashed rounded-xl bg-slate-50 uppercase tracking-widest">
                   Menu kosong. Tambahkan menu di "Master Data".
                </div>
             ) : (
               realProducts.map(prod => (
                 <div key={prod.id} onClick={() => handleAddToCart(prod)} className="bg-slate-50 border border-slate-200 p-3 rounded-xl cursor-pointer hover:border-blue-400 hover:shadow-md transition-all active:scale-95 group flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-black text-slate-800 uppercase group-hover:text-blue-700 leading-tight">{prod.product_name}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase mt-1">{terjemahkanKategori(prod.category)}</div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-200/60">
                      <div className="text-sm font-black text-emerald-600">{formatRupiah(prod.selling_price)}</div>
                      <div className="text-[8px] font-black text-amber-600 uppercase mt-0.5 tracking-wider">Minimal: {prod.min_order || 1} Pcs | Harga Ecer: {formatRupiah(prod.penalty_price || prod.selling_price)}</div>
                    </div>
                 </div>
               ))
             )}
           </div>
        </div>

        {/* KERANJANG KASIR (KANAN) */}
        <div className={`lg:col-span-7 rounded-2xl border shadow-sm p-6 transition-all h-max ${isEditing ? 'bg-amber-50/40 border-amber-300' : 'bg-white border-slate-200'}`}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className={`font-black text-sm uppercase flex items-center gap-2 tracking-widest ${isEditing ? 'text-amber-700' : 'text-slate-800'}`}>
                {isEditing ? <Edit2 size={16}/> : <ShoppingCart size={16} className="text-emerald-600"/>} 
                {isEditing ? 'Revisi Nota Penjualan' : 'Keranjang Kasir'}
              </h3>
              {isEditing && <button type="button" onClick={handleCancelEdit} className="text-[10px] border border-amber-200 px-2.5 py-1 rounded-lg font-black uppercase text-amber-700 bg-white shadow-sm flex items-center gap-1 hover:bg-amber-100 transition-colors"><Undo size={12}/> Batal Revisi</button>}
            </div>

            {/* LIST KERANJANG (MULTI-ITEM) */}
            <div className="space-y-3 mb-6 max-h-[35vh] overflow-y-auto custom-scrollbar pr-2">
              {cart.length === 0 ? (
                <div className="text-center py-8 border border-dashed rounded-xl bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-widest">Keranjang masih kosong. Silakan pilih menu di kiri.</div>
              ) : (
                cart.map((item, index) => {
                  const masterProd = realProducts.find(p => p.id === item.product_id);
                  const minOrder = masterProd?.min_order || 1;
                  const isPenalty = item.qty < minOrder;

                  return (
                    <div key={index} className={`p-3 border rounded-xl relative ${isPenalty ? 'bg-rose-50/30 border-rose-200' : 'bg-white border-slate-200 shadow-sm'}`}>
                      <button type="button" onClick={() => handleRemoveFromCart(index)} className="absolute -top-2 -right-2 bg-rose-100 text-rose-600 rounded-full p-1 border border-rose-200 hover:bg-rose-600 hover:text-white transition-colors"><X size={12}/></button>
                      
                      <div className="font-black text-xs text-slate-800 uppercase mb-2">{item.name}</div>
                      
                      <div className="flex items-center gap-3">
                        <div className="w-20">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Jumlah (Pcs)</label>
                          <input type="number" min="1" value={item.qty} onChange={(e) => handleUpdateCartItem(index, 'qty', e.target.value)} className="w-full p-1.5 border rounded-md text-sm font-black text-center outline-none focus:border-blue-400" />
                        </div>
                        <div className="flex-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Catatan Tambahan (Bila Ada)</label>
                          <input type="text" value={item.request} onChange={(e) => handleUpdateCartItem(index, 'request', e.target.value)} placeholder="Contoh: Mix Hakau, dll..." className="w-full p-1.5 border rounded-md text-xs font-bold uppercase outline-none focus:border-blue-400" />
                        </div>
                      </div>
                      
                      <div className="mt-3 flex justify-between items-end border-t border-slate-100 pt-2">
                        <div>
                          <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Harga per Pcs {isPenalty && <span className="text-rose-500 bg-rose-100 px-1 rounded ml-1 animate-pulse">Terkena Harga Eceran</span>}</div>
                          <div className={`font-black text-sm ${isPenalty ? 'text-rose-600' : 'text-slate-800'}`}>{formatRupiah(item.price)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Subtotal Barang</div>
                          <div className="font-black text-emerald-600 text-sm">{formatRupiah(item.subtotal)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Nama Pembeli / Pelanggan</label>
                <input type="text" required value={form.customerName} onChange={e=>setForm({...form, customerName: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs font-black uppercase outline-none focus:border-blue-400" placeholder="UMUM" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Sumber Jalur Pembeli</label>
                <select value={form.channel} onChange={e=>setForm({...form, channel: e.target.value})} className="w-full p-2.5 border rounded-xl text-[10px] font-black bg-white uppercase outline-none cursor-pointer">
                  <optgroup label="Toko Fisik / Langsung">{SALES_CHANNELS.filter(c => c.group === 'OFFLINE').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>
                  <optgroup label="Online / Aplikasi">{SALES_CHANNELS.filter(c => c.group !== 'OFFLINE').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>
                </select>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Pilih Metode Pengambilan Barang</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm({...form, deliveryMethod: 'DIRECT', paymentMethod: 'CASH'})} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${form.deliveryMethod === 'DIRECT' ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-400 shadow-sm scale-105' : 'bg-white border text-slate-500 hover:bg-slate-100'}`}><CheckCircle2 size={14} className="inline mr-1"/> Langsung Diambil</button>
                
                <button type="button" onClick={() => setForm({...form, deliveryMethod: 'PRE_ORDER', paymentMethod: 'DP', amountPaid: ''})} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all flex flex-col items-center justify-center ${form.deliveryMethod === 'PRE_ORDER' ? 'bg-orange-500 text-white border-2 border-orange-600 shadow-md scale-105' : 'bg-white border text-slate-500 hover:bg-slate-100'}`}>
                  <span><Lock size={12} className="inline mr-1 mb-0.5"/> Dipesan Duluan (PO)</span>
                  <span className={`text-[7px] ${form.deliveryMethod === 'PRE_ORDER' ? 'text-orange-200' : 'text-slate-400'}`}>(Stok Akan Ditahan di Freezer)</span>
                </button>
              </div>
            </div>
            
            {/* BOX TAGIHAN (TOTAL) */}
            <div className="bg-slate-900 text-white p-5 rounded-xl shadow-inner relative overflow-hidden mt-4">
              <div className="flex justify-between items-end relative z-10 mb-2">
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-400 tracking-widest block">Total Tagihan Pelanggan</span>
                  <span className="text-[9px] text-slate-400">Total Banyaknya Barang: {formatNumber(cartTotals.totalQty)}</span>
                </div>
                <span className="text-3xl font-black text-emerald-400 tracking-tight">{formatRupiah(cartTotals.totalTagihan)}</span>
              </div>
              {cartTotals.totalQty > 0 && (
                <div className="pt-3 border-t border-slate-700/50 space-y-1 relative z-10">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400"><span>Perkiraan Modal Pabrik (HPP):</span><span className="text-orange-400">{formatRupiah(cartTotals.totalHpp)}</span></div>
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400"><span>Perkiraan Laba Keuntungan:</span><span className="text-emerald-400">+{formatRupiah(cartTotals.profitKotor)}</span></div>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border bg-white mt-2">
              <div className="flex justify-between items-center mb-3 border-b pb-2">
                <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Pilih Cara Pembayaran</label>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg flex-wrap justify-end">
                  {PILIHAN_BAYAR.map(m => (
                    <button key={m.id} type="button" onClick={() => setForm({...form, paymentMethod: m.id})} className={`px-3 py-1.5 rounded text-[9px] font-black transition-colors ${form.paymentMethod === m.id ? 'bg-white shadow-sm text-blue-600 border border-blue-200' : 'text-slate-500 hover:bg-slate-200'}`}>{m.label}</button>
                  ))}
                </div>
              </div>
              
              {form.paymentMethod === 'DP' && (
                <div className="animate-in fade-in">
                  <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest block mb-1">Jumlah Uang Muka (DP) yang Dibayar</label>
                  <input type="number" required value={form.amountPaid} onChange={e=>setForm({...form, amountPaid: e.target.value})} className="w-full p-3 border-2 border-orange-200 rounded-lg text-right font-black text-orange-700 bg-orange-50/50 outline-none focus:border-orange-400" placeholder="Ketik angka nominal DP..." />
                </div>
              )}
              {form.paymentMethod !== 'DP' && form.deliveryMethod === 'PRE_ORDER' && (
                 <div className="text-[9px] font-bold text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                   <AlertCircle size={10} className="inline mr-1"/> Pilih 'Bayar DP' jika pelanggan hanya bayar sebagian. Pilih 'Tunai/Transfer' jika sudah dilunasi di awal.
                 </div>
              )}
            </div>

            <button type="submit" className={`w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-xl transition-transform active:scale-95 flex items-center justify-center gap-2 mt-4 ${isEditing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {isEditing ? <><Edit2 size={16}/> Simpan Hasil Revisi</> : <><Printer size={16}/> Simpan &amp; Cetak Tiket Nota</>}
            </button>
          </form>
        </div>

      </div>

      {/* ========================================= */}
      {/* ROW BAWAH: LOG HISTORI TRANSAKSI (FULL)     */}
      {/* ========================================= */}
      <div className="bg-white rounded-3xl border flex flex-col overflow-hidden shadow-sm mt-8">
        <div className="p-5 bg-slate-50 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div>
             <h4 className="font-black text-sm uppercase text-slate-800 tracking-widest flex items-center gap-2"><FileText size={18} className="text-blue-600"/> Riwayat Transaksi Kasir</h4>
             <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Hanya menampilkan data pada tanggal yang dipilih di kanan</p>
           </div>
           
           <div className="flex flex-wrap items-center gap-2">
             <div className="flex items-center gap-2 bg-white border border-slate-300 p-2 rounded-xl shadow-sm">
               <Calendar size={16} className="text-blue-600 ml-1"/>
               <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="text-xs font-black text-slate-800 uppercase outline-none bg-transparent cursor-pointer pr-2" />
             </div>
             
             {filterDate !== '' ? (
               <button onClick={() => setFilterDate('')} className="bg-slate-100 border border-slate-200 text-slate-600 px-3 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-colors shadow-sm">
                 Tampilkan Semua Tanggal
               </button>
             ) : (
               <button onClick={() => setFilterDate(todayYMD)} className="bg-blue-50 border border-blue-200 text-blue-600 px-3 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-blue-100 transition-colors shadow-sm">
                 Tampilkan Hari Ini
               </button>
             )}
           </div>
        </div>
        
        <div className="overflow-x-auto p-4 custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-100 text-[10px] uppercase text-slate-500 border-b-2 border-slate-200">
              <tr>
                <th className="px-5 py-4 font-black rounded-tl-xl">No. Nota &amp; Tanggal</th>
                <th className="px-5 py-4 font-black">Nama Pelanggan &amp; Pesanan</th>
                <th className="px-5 py-4 font-black text-center">Status Pengambilan</th>
                <th className="px-5 py-4 font-black text-right">Total Tagihan</th>
                <th className="px-5 py-4 font-black text-center rounded-tr-xl">Aksi / Cetak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-bold">
              {realOrders
                .filter(o => !o.isDeleted && isMatchDate(o.date, filterDate)) 
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map(log => {
                const itemsArr = safeJsonParse(log.items, []);
                let displayItemName = log.item_name || 'BANYAK JENIS MENU';
                if (itemsArr.length === 1) displayItemName = itemsArr[0].name;
                else if (itemsArr.length > 1) displayItemName = `${itemsArr[0].name} (ditambah ${itemsArr.length - 1} jenis lain)`;

                return (
                  <tr key={log.id} className="hover:bg-blue-50/50 group transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap"><div className="text-slate-800 font-black">{formatDate(log.date)}</div><div className="text-[10px] font-mono text-slate-400 mt-1">{log.id}</div></td>
                    <td className="px-5 py-4 min-w-[250px]">
                      <div className="uppercase font-black text-slate-800 text-sm mb-1">{log.customer_name}</div>
                      <div className="text-[9px] font-black tracking-widest text-blue-600 uppercase mb-2 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 w-max">{log.sales_channel.replace('_', ' ')} • <span className="text-slate-600">{formatNumber(log.qty)} Biji Terjual</span></div>
                      <div className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-1 rounded inline-block border">{displayItemName}</div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-center">
                      <div className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border shadow-sm w-max mx-auto ${log.delivery_method === 'PRE_ORDER' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}>
                        {log.delivery_method === 'PRE_ORDER' ? <><Lock size={12} className="inline mr-1 mb-0.5"/> PO (Stok Ditahan)</> : <><CheckCircle2 size={12} className="inline mr-1 mb-0.5"/> Langsung Diambil</>}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="text-sm font-black text-slate-800">{formatRupiah(log.total_amount)}</div>
                      <div className={`text-[9px] font-black uppercase tracking-widest mt-1 ${log.payment_method === 'DP' ? 'text-orange-500' : 'text-emerald-500'}`}>{log.payment_method === 'DP' ? `Sisa Belum Lunas (Bayar DP: ${formatRupiah(log.amount_paid)})` : 'SUDAH LUNAS'}</div>
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => handlePrintTiketProduksi(log)} className="p-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-black uppercase flex items-center gap-1.5 text-[10px] shadow-sm"><FileText size={14}/> Tiket Dapur</button>
                        <button type="button" onClick={() => handlePrintInvoiceKlien(log)} className="p-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-black uppercase flex items-center gap-1.5 text-[10px] shadow-sm"><Printer size={14}/> Nota Klien</button>
                        <button type="button" onClick={() => handleEditSafe(log)} className="p-2 bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-500 hover:text-white rounded-lg transition-colors" title="Revisi Nota"><Edit2 size={16}/></button>
                        <button type="button" onClick={() => { if(window.confirm("Yakin ingin menghapus total nota kasir ini?")) requestDelete(log.id); }} className="p-2 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-colors" title="Hapus Nota"><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              
              {realOrders.filter(o => !o.isDeleted && isMatchDate(o.date, filterDate)).length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center py-20 bg-slate-50 border-t border-slate-100">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Calendar size={40} className="mb-3 opacity-20"/>
                      <span className="font-black uppercase tracking-widest text-xs">Tidak ada riwayat transaksi pada tanggal ini.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POP-UP MODAL DAFTAR ANTRIAN PO KARANTINA */}
      {showKarantinaModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 bg-amber-50 border-b border-amber-200 flex justify-between items-center">
              <div>
                <h3 className="font-black text-sm uppercase tracking-widest text-amber-800 flex items-center gap-2"><Lock size={18}/> Daftar Antrean Pesanan PO (Stok Ditahan)</h3>
                <p className="text-[10px] font-bold text-amber-600/80 mt-1 uppercase">Stok ini sudah dikunci untuk pemesan dan tidak boleh dijual ke pelanggan yang datang langsung.</p>
              </div>
              <button onClick={() => setShowKarantinaModal(false)} className="p-2 bg-amber-100 text-amber-700 hover:bg-amber-600 hover:text-white rounded-xl transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-2 overflow-y-auto custom-scrollbar flex-1">
              <table className="w-full text-sm text-left">
                <thead className="bg-white text-[10px] uppercase text-slate-400 border-b border-slate-100 sticky top-0 z-10">
                  <tr><th className="px-5 py-4 font-black">Tanggal &amp; No. Nota</th><th className="px-5 py-4 font-black">Nama Pelanggan / Agen</th><th className="px-5 py-4 font-black text-center">Banyaknya Pesanan Ditahan</th><th className="px-5 py-4 font-black text-center">Aksi (Jika Diambil)</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs font-bold">
                  {stockMetrics.listKarantina.length === 0 ? (
                    <tr><td colSpan="4" className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest">Tidak ada antrean pesanan PO (karantina kosong).</td></tr>
                  ) : (
                    stockMetrics.listKarantina.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4 whitespace-nowrap"><div className="text-slate-800 font-black">{formatDate(order.date)}</div><div className="text-[9px] font-mono text-slate-400 mt-0.5">{order.id}</div></td>
                        <td className="px-5 py-4"><div className="font-black text-slate-800 text-sm uppercase">{order.customer_name}</div><div className="text-[9px] text-blue-600 font-black tracking-widest mt-1 uppercase">Sistem: {order.sales_channel.replace('_', ' ')}</div></td>
                        <td className="px-5 py-4 text-center whitespace-nowrap"><div className="text-xl font-black text-amber-600">{formatNumber(order.calculatedQty)} <span className="text-[10px] text-amber-500/50">PCS</span></div></td>
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          <button onClick={() => {
                            if(window.confirm(`Selesaikan pesanan atas nama ${order.customer_name}? Stok di freezer akan resmi dikurangi sekarang.`)) {
                              sendToSheet('update', { ...order, status: 'SELESAI' }, 'orders');
                              setShowKarantinaModal(false); showToast('Pesanan selesai! Stok fisik telah resmi terpotong.', 'success');
                            }
                          }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-colors flex items-center justify-center gap-1.5 mx-auto">
                            <CheckCircle2 size={12}/> Lepas Fisik (Sudah Diambil)
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
