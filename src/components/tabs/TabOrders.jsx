import React, { useState, useMemo } from 'react';
import { 
  ShoppingCart, Package, Truck, AlertCircle, Edit2, 
  Printer, Trash2, CalendarDays, Lock, Eye, CheckCircle2, ChevronDown, X 
} from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

// --- DATABASE KATEGORI & HARGA ---
const SALES_CHANNELS = [
  { id: 'ECERAN', label: 'Eceran Standard', group: 'OFFLINE', price: 3000, isManual: false },
  { id: 'MITRA', label: 'Mitra Agen', group: 'OFFLINE', price: 2500, isManual: false },
  { id: 'RESELLER', label: 'Reseller', group: 'OFFLINE', price: 2700, isManual: false },
  { id: 'PAKETAN_ACARA', label: 'Paketan Acara (Manual)', group: 'OFFLINE', price: 0, isManual: true },
  { id: 'SHOPEE', label: 'Toko Shopee', group: 'MARKETPLACE', price: 3000, isManual: false },
  { id: 'TOKOPEDIA', label: 'Tokopedia', group: 'MARKETPLACE', price: 3000, isManual: false },
  { id: 'TIKTOK', label: 'TikTok Shop', group: 'MARKETPLACE', price: 3000, isManual: false },
  { id: 'SHOPEEFOOD', label: 'ShopeeFood', group: 'MERCHANT', price: 3500, isManual: false },
  { id: 'GOFOOD', label: 'GoFood', group: 'MERCHANT', price: 3500, isManual: false },
  { id: 'GRABFOOD', label: 'GrabFood', group: 'MERCHANT', price: 3500, isManual: false },
];

export default function TabOrders({ 
  orders = [], productionBatches = [], purchases = [], masterBranches = [],
  sendToSheet, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'TANGERANG_PUSAT';

  // --- STATE MANAJEMEN ---
  const [isEditing, setIsEditing] = useState(false);
  const [showKarantinaModal, setShowKarantinaModal] = useState(false);
  
  const [form, setForm] = useState({
    id: '', date: todayStr, customerName: '', 
    channel: 'ECERAN', customPrice: 3000, qty: '',
    deliveryMethod: 'DIRECT', shippingFee: 0,
    paymentMethod: 'CASH', amountPaid: '', notes: ''
  });

  const selectedChannelInfo = useMemo(() => SALES_CHANNELS.find(c => c.id === form.channel) || SALES_CHANNELS[0], [form.channel]);

  // --- ALGORITMA KALKULASI STOK & KARANTINA ---
  const stockMetrics = useMemo(() => {
    let totalMasukFreezer = 0;
    let totalKeluarFreezer = 0;
    let totalAyamMasukKg = 0;
    let totalAyamKeluarKg = 0;
    let karantinaPcs = 0;
    let listKarantina = [];

    // 1. Hitung Ayam Masuk (Dari Tab Logistik/Pembelian)
    (purchases || []).filter(p => !p.isDeleted && p.category === 'BAHAN_BAKU').forEach(p => {
       // Asumsi ada logic konversi, kita dummy akumulasi nominal jika qty kg tidak ada
       totalAyamMasukKg += Number(p.qty_kg || 0); 
    });

    // 2. Hitung Hasil Produksi & Ayam Keluar
    (productionBatches || []).filter(p => !p.isDeleted).forEach(p => {
      totalMasukFreezer += Number(p.total_yield_pcs || 0);
      totalAyamKeluarKg += Number(p.total_ayam_kg || 0);
    });

    // 3. Hitung Penjualan & PO Karantina
    (orders || []).filter(o => !o.isDeleted).forEach(o => {
      const qty = Number(o.qty || 0);
      if (o.delivery_method === 'PRE_ORDER' && o.status !== 'SELESAI') {
        karantinaPcs += qty;
        listKarantina.push(o);
      } else {
        totalKeluarFreezer += qty;
      }
    });

    const saldoFisikFreezer = totalMasukFreezer - totalKeluarFreezer;
    const saldoAyamKg = Math.max(0, totalAyamMasukKg - totalAyamKeluarKg); // Mencegah minus jika data purchase belum lengkap
    const sisaAvailable = saldoFisikFreezer - karantinaPcs;

    return { 
      saldoFisikFreezer, 
      karantinaPcs, 
      sisaAvailable, 
      saldoAyamKg,
      listKarantina: listKarantina.sort((a,b) => new Date(a.date) - new Date(b.date))
    };
  }, [orders, productionBatches, purchases]);

  // --- ALGORITMA HARGA & TAGIHAN ---
  const perhitungan = useMemo(() => {
    const qty = Number(form.qty || 0);
    const hargaSatuan = selectedChannelInfo.isManual ? Number(form.customPrice || 0) : selectedChannelInfo.price;
    const subtotal = qty * hargaSatuan;
    const ongkir = Number(form.shippingFee || 0);
    const totalTagihan = subtotal + ongkir;
    const dibayar = form.paymentMethod === 'DP' ? Number(form.amountPaid || 0) : totalTagihan;
    const sisaPiutang = totalTagihan - dibayar;

    return { hargaSatuan, subtotal, ongkir, totalTagihan, dibayar, sisaPiutang };
  }, [form, selectedChannelInfo]);

  // --- HANDLE SUBMIT & SMART WARNING GUARDRAILS ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Number(form.qty) <= 0) return alert("Jumlah beli harus lebih dari 0!");
    if (form.paymentMethod === 'DP' && Number(form.amountPaid) <= 0) return alert("Masukkan nominal DP yang dibayarkan!");

    // ALGORITMA GUARDRAIL KARANTINA (Req 7)
    if (form.deliveryMethod === 'DIRECT') {
      if (Number(form.qty) > stockMetrics.saldoFisikFreezer) {
        return alert(`❌ GAGAL! Stok fisik di freezer tidak cukup! (Sisa: ${stockMetrics.saldoFisikFreezer} Pcs)`);
      }
      
      if (Number(form.qty) > stockMetrics.sisaAvailable) {
        const pinjam = Number(form.qty) - stockMetrics.sisaAvailable;
        const confirmPinjam = window.confirm(
          `⚠️ PERINGATAN STOK KARANTINA!\n\nStok Bebas hanya sisa ${stockMetrics.sisaAvailable} Pcs.\nTransaksi ini akan MEMINJAM ${pinjam} Pcs dari stok milik Karantina PO orang lain!\n\nLanjutkan & catat sebagai "Pinjam Karantina"?`
        );
        if (!confirmPinjam) return;
        form.notes = `[PINJAM KARANTINA ${pinjam} PCS] ` + form.notes;
      }
    }

    const trxId = isEditing ? form.id : generateId('INV', form.date);
    const payload = {
      id: trxId, date: form.date, branch_id: currentBranch,
      customer_name: form.customerName.toUpperCase(), sales_channel: form.channel,
      qty: Number(form.qty), unit_price: perhitungan.hargaSatuan, 
      delivery_method: form.deliveryMethod, shipping_fee: perhitungan.ongkir,
      subtotal: perhitungan.subtotal, total_amount: perhitungan.totalTagihan,
      payment_method: form.paymentMethod, amount_paid: perhitungan.dibayar,
      status: form.deliveryMethod === 'PRE_ORDER' ? 'BELUM_DIKIRIM' : 'SELESAI',
      notes: form.notes.toUpperCase()
    };

    const action = isEditing ? 'update' : 'insert';
    const success = await sendToSheet(action, payload, 'orders');

    if (success) {
      showToast(isEditing ? 'Invoice berhasil direvisi!' : 'Invoice Penjualan Berhasil Dibuat!', 'success');
      setForm({
        id: '', date: todayStr, customerName: '', channel: 'ECERAN', customPrice: 3000, qty: '',
        deliveryMethod: 'DIRECT', shippingFee: 0, paymentMethod: 'CASH', amountPaid: '', notes: ''
      });
      setIsEditing(false);
    }
  };

  const handleEdit = (log) => {
    setForm({
      id: log.id, date: log.date.split('T')[0], customerName: log.customer_name,
      channel: log.sales_channel || 'ECERAN', customPrice: log.unit_price, qty: log.qty,
      deliveryMethod: log.delivery_method || 'DIRECT', shippingFee: log.shipping_fee || 0,
      paymentMethod: log.payment_method || 'CASH', amountPaid: log.amount_paid || log.total_amount, 
      notes: log.notes || ''
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6 pb-10 relative">
      
      {/* 📊 TOP METRICS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1. STOK BEBAS */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden text-white">
          <Package className="absolute -right-4 -bottom-4 text-emerald-500 opacity-20" size={100} />
          <div className="relative z-10">
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 size={12}/> Stok Bebas (Available)</div>
            <div className={`text-3xl font-black mt-1 ${stockMetrics.sisaAvailable < 0 ? 'text-rose-500' : 'text-white'}`}>
              {formatNumber(stockMetrics.sisaAvailable)} <span className="text-xs text-slate-400 font-bold">PCS</span>
            </div>
            <div className="text-[9px] text-slate-500 mt-2 font-bold">Aman dijual langsung ke Walk-In Customer</div>
          </div>
        </div>

        {/* 2. KARANTINA (PO) */}
        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 shadow-sm relative overflow-hidden cursor-pointer hover:bg-amber-100 transition-colors" onClick={() => setShowKarantinaModal(true)}>
          <Lock className="absolute -right-4 -bottom-4 text-amber-500 opacity-10" size={100} />
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5"><Lock size={12}/> Di-Booking (Karantina)</div>
              <div className="text-3xl font-black text-amber-700 mt-1">{formatNumber(stockMetrics.karantinaPcs)} <span className="text-xs opacity-70">PCS</span></div>
            </div>
            <button className="bg-amber-200 text-amber-800 text-[9px] px-2 py-1 rounded font-black uppercase flex items-center gap-1"><Eye size={10}/> Detail</button>
          </div>
          <div className="text-[9px] text-amber-600/80 mt-2 font-bold relative z-10">Stok milik PO & Agen. Jangan diotak-atik!</div>
        </div>

        {/* 3. TOTAL FISIK FREEZER (KONVERSI) */}
        <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-blue-500 relative overflow-hidden">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Fisik Freezer</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{formatNumber(stockMetrics.saldoFisikFreezer)} <span className="text-xs">PCS</span></div>
          <div className="flex gap-3 mt-2 pt-2 border-t border-slate-100">
            <div className="text-[10px] font-bold text-slate-500"><span className="text-slate-800 font-black">{formatNumber(stockMetrics.saldoFisikFreezer / 50)}</span> Mika</div>
            <div className="text-[10px] font-bold text-slate-500"><span className="text-slate-800 font-black">{formatNumber(stockMetrics.saldoFisikFreezer / 4)}</span> Porsi</div>
          </div>
        </div>

        {/* 4. BAHAN BAKU AYAM (GUDANG) */}
        <div className="bg-rose-50 p-5 rounded-2xl border shadow-sm border-l-4 border-l-rose-500 relative overflow-hidden">
          <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Stok Ayam Mentah</div>
          <div className="text-2xl font-black text-rose-700 mt-1">{formatNumber(stockMetrics.saldoAyamKg)} <span className="text-xs">KG</span></div>
          <div className="flex justify-between items-end mt-2 pt-2 border-t border-rose-100">
            <div className="text-[10px] font-bold text-rose-600/80">Estimasi Yield: <span className="font-black text-rose-700">~{formatNumber(stockMetrics.saldoAyamKg * 33.3)} Pcs</span></div>
          </div>
        </div>
      </div>

      {/* 📝 FORM POS & ARSIP */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* KIRI: FORM INPUT */}
        <div className={`p-6 rounded-2xl border border-t-4 transition-all h-max shadow-sm ${isEditing ? 'bg-amber-50/50 border-t-amber-500 border-amber-200' : 'bg-white border-t-emerald-600'}`}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm uppercase text-slate-800 flex items-center gap-2"><ShoppingCart size={16} className={isEditing ? 'text-amber-600' : 'text-emerald-600'}/> {isEditing ? 'Revisi Invoice' : 'POS & Order Management'}</h3>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Nama Pelanggan / ID Cust</label>
              <input type="text" required value={form.customerName} onChange={e=>setForm({...form, customerName: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold outline-none bg-white uppercase" placeholder="Contoh: DEDE / ORDER-001" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Kategori / Channel</label>
                <select value={form.channel} onChange={e=>setForm({...form, channel: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-black outline-none bg-white uppercase cursor-pointer">
                  <optgroup label="Offline & Reseller">
                    {SALES_CHANNELS.filter(c => c.group === 'OFFLINE').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </optgroup>
                  <optgroup label="Marketplace">
                    {SALES_CHANNELS.filter(c => c.group === 'MARKETPLACE').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </optgroup>
                  <optgroup label="Merchant Delivery">
                    {SALES_CHANNELS.filter(c => c.group === 'MERCHANT').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Jumlah Beli (Pcs)</label>
                <input type="number" min="1" required value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-black text-emerald-700 outline-none bg-white text-center" placeholder="1000" />
                {form.qty > 0 && <div className="text-[9px] text-right font-bold text-slate-400 mt-1">Setara: {formatNumber(form.qty / 50)} Mika</div>}
              </div>
            </div>

            {selectedChannelInfo.isManual && (
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-1">Harga Satuan Manual (Rp)</label>
                <input type="number" required value={form.customPrice} onChange={e=>setForm({...form, customPrice: e.target.value})} className="w-full p-2 border-2 border-amber-300 rounded-lg text-sm font-black outline-none" />
              </div>
            )}

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Metode Serah Terima Barang</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm({...form, deliveryMethod: 'DIRECT'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${form.deliveryMethod === 'DIRECT' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-sm' : 'bg-white border text-slate-400'}`}>Direct (Ambil Fisik)</button>
                <button type="button" onClick={() => setForm({...form, deliveryMethod: 'PRE_ORDER'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${form.deliveryMethod === 'PRE_ORDER' ? 'bg-amber-100 text-amber-700 border border-amber-300 shadow-sm' : 'bg-white border text-slate-400'}`}>Pre-Order / Kirim Nanti</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Biaya Ongkir (Rp)</label>
                <input type="number" min="0" value={form.shippingFee} onChange={e=>setForm({...form, shippingFee: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-black outline-none text-right" />
              </div>
              <div className="pb-1">
                {form.qty >= 1000 && <div className="text-[9px] font-black text-emerald-600 bg-emerald-100 px-2 py-1 rounded text-center">🎟️ Memenuhi Syarat Gratis Ongkir</div>}
              </div>
            </div>

            <div className="bg-slate-900 text-white p-4 rounded-xl shadow-inner mt-4">
              <div className="flex justify-between items-center mb-1 text-slate-400 text-xs font-bold"><span>Subtotal Barang:</span><span>{formatRupiah(perhitungan.subtotal)}</span></div>
              <div className="flex justify-between items-center mb-3 text-slate-400 text-xs font-bold border-b border-slate-700 pb-3"><span>Biaya Ongkir:</span><span>{formatRupiah(perhitungan.ongkir)}</span></div>
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Total Tagihan</span>
                <span className="text-2xl font-black">{formatRupiah(perhitungan.totalTagihan)}</span>
              </div>
            </div>

            <div className={`p-4 rounded-xl border-2 ${form.paymentMethod === 'DP' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
              <div className="flex justify-between items-center mb-3">
                <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">💳 Pembayaran</label>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                  {['CASH', 'TF', 'DP'].map(m => (
                    <button key={m} type="button" onClick={() => setForm({...form, paymentMethod: m})} className={`px-3 py-1 rounded text-[10px] font-black transition-all ${form.paymentMethod === m ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:bg-slate-200'}`}>{m}</button>
                  ))}
                </div>
              </div>
              
              {form.paymentMethod === 'DP' && (
                <div className="mt-3 pt-3 border-t border-amber-200/50">
                  <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-1">Nominal DP Dibayar (Rp)</label>
                  <input type="number" required min="1" value={form.amountPaid} onChange={e=>setForm({...form, amountPaid: e.target.value})} className="w-full p-2.5 border-2 border-amber-300 bg-white rounded-xl text-lg font-black text-amber-700 outline-none text-right" placeholder="Rp 0" />
                  <div className="text-right text-[10px] font-black text-rose-500 mt-1 uppercase tracking-widest">Sisa Piutang: {formatRupiah(perhitungan.totalTagihan - Number(form.amountPaid))}</div>
                </div>
              )}
            </div>

            <div><input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} placeholder="Catatan Tambahan (Opsional)..." className="w-full p-2.5 border rounded-xl text-xs outline-none bg-slate-50" /></div>
            
            <button type="submit" className={`w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 ${isEditing ? 'bg-amber-500 shadow-amber-500/30' : 'bg-emerald-600 shadow-emerald-600/30'}`}>
              <Printer size={16}/> {isEditing ? 'Simpan Revisi' : 'Simpan & Cetak Invoice'}
            </button>
          </form>
        </div>
        
        {/* KANAN: ARSIP PENJUALAN */}
        <div className="lg:col-span-2 bg-white rounded-2xl border flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
            <h4 className="font-black text-xs uppercase text-slate-700 tracking-widest flex items-center gap-2"><CalendarDays size={14} className="text-blue-600"/> Arsip Invoice & Fulfillment</h4>
          </div>
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b border-slate-200">
                <tr><th className="px-4 py-3 whitespace-nowrap">ID Invoice</th><th className="px-4 py-3 whitespace-nowrap">Pelanggan & Channel</th><th className="px-4 py-3 whitespace-nowrap">Status Pembayaran</th><th className="px-4 py-3 whitespace-nowrap">Status Pengiriman</th><th className="px-4 py-3 whitespace-nowrap text-center">Aksi</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold">
                {orders.filter(o => !o.isDeleted).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50).map(log => {
                  const sisaUtang = Number(log.total_amount) - Number(log.amount_paid);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-slate-800">{formatDate(log.date)}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">{log.id}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="uppercase text-slate-700 font-black">{log.customer_name}</div>
                        <div className="text-[9px] font-black text-blue-500 mt-0.5 tracking-wider uppercase">{log.sales_channel} • {formatNumber(log.qty)} PCS</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-black text-slate-700">{formatRupiah(log.total_amount)}</div>
                        <div className={`text-[9px] font-black mt-0.5 uppercase tracking-widest px-1.5 py-0.5 rounded inline-block ${sisaUtang > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {sisaUtang > 0 ? `DP (${formatRupiah(log.amount_paid)})` : log.payment_method}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${log.delivery_method === 'PRE_ORDER' ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {log.delivery_method === 'PRE_ORDER' ? <><Lock size={10}/> PO KARANTINA</> : <><CheckCircle2 size={10}/> DIAMBIL LANGSUNG</>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button type="button" onClick={() => handleEdit(log)} className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg"><Edit2 size={12}/></button>
                          <button type="button" className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg"><Trash2 size={12}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* 🔴 MODAL DETAIL KARANTINA (Req 5) */}
      {showKarantinaModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-amber-500 text-white flex justify-between items-center shrink-0">
              <h3 className="font-black flex items-center gap-2 uppercase tracking-widest"><Lock size={18}/> Detail Buku Karantina (Pre-Order Aktif)</h3>
              <button onClick={() => setShowKarantinaModal(false)} className="hover:bg-amber-600 p-1 rounded-lg transition-colors"><X size={20}/></button>
            </div>
            <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-center gap-4 shrink-0">
              <div className="text-4xl font-black text-amber-700">{formatNumber(stockMetrics.karantinaPcs)} <span className="text-sm">PCS</span></div>
              <div className="text-xs font-bold text-amber-800 uppercase leading-relaxed">Total Dimsum Frozen yang sedang di-booking dan menunggu diambil/dikirim.<br/>Harus dipenuhi sebelum membuat order baru!</div>
            </div>
            <div className="overflow-y-auto flex-1 custom-scrollbar p-0">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b sticky top-0 shadow-sm z-10">
                  <tr><th className="px-4 py-3">Tgl PO & ID</th><th className="px-4 py-3">Nama Klien</th><th className="px-4 py-3 text-center">Jumlah Booking</th><th className="px-4 py-3">Status Utang</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold">
                  {stockMetrics.listKarantina.length === 0 && (<tr><td colSpan="4" className="text-center py-10 text-slate-400 font-bold">Belum ada antrean karantina aktif.</td></tr>)}
                  {stockMetrics.listKarantina.map(k => {
                    const sisa = Number(k.total_amount) - Number(k.amount_paid);
                    return (
                      <tr key={k.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3"><div className="text-slate-800">{formatDate(k.date)}</div><div className="text-[9px] font-mono text-slate-400">{k.id}</div></td>
                        <td className="px-4 py-3 uppercase text-slate-700">{k.customer_name}</td>
                        <td className="px-4 py-3 text-center"><span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-lg font-black shadow-sm">{formatNumber(k.qty)} PCS</span></td>
                        <td className="px-4 py-3">
                          {sisa > 0 ? <span className="text-rose-600">Sisa Bill: {formatRupiah(sisa)}</span> : <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12}/> LUNAS</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
