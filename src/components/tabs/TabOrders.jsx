import React, { useState, useMemo } from 'react';
import { 
  ShoppingCart, Package, Truck, AlertCircle, Edit2, 
  Printer, Trash2, CalendarDays, Lock, Eye, CheckCircle2, X, FileText 
} from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

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
  sendToSheet, showToast, user, requestDelete 
}) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'TANGERANG_PUSAT';

  const [isEditing, setIsEditing] = useState(false);
  const [showKarantinaModal, setShowKarantinaModal] = useState(false);
  
  const [form, setForm] = useState({
    id: '', date: todayStr, customerName: '', 
    channel: 'ECERAN', customPrice: 3000, qty: '',
    deliveryMethod: 'DIRECT', shippingFee: 0,
    paymentMethod: 'CASH', amountPaid: '', notes: '',
    customRequest: 'STANDAR MIX (SIOMAY, HAKAU, DLL)' // State request kustom produksi
  });

  const selectedChannelInfo = useMemo(() => SALES_CHANNELS.find(c => c.id === form.channel) || SALES_CHANNELS[0], [form.channel]);

  // --- ALGORITMA MONITORING STOK SILANG ---
  const stockMetrics = useMemo(() => {
    let totalMasukFreezer = 0;
    let totalKeluarFreezer = 0;
    let totalAyamMasukKg = 0;
    let totalAyamKeluarKg = 0;
    let karantinaPcs = 0;
    let listKarantina = [];

    (purchases || []).filter(p => !p.isDeleted && p.category === 'BAHAN_BAKU').forEach(p => {
       totalAyamMasukKg += Number(p.qty_kg || 0); 
    });

    (productionBatches || []).filter(p => !p.isDeleted).forEach(p => {
      totalMasukFreezer += Number(p.total_yield_pcs || 0);
      totalAyamKeluarKg += Number(p.total_ayam_kg || 0);
    });

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
    const saldoAyamKg = Math.max(0, totalAyamMasukKg - totalAyamKeluarKg);
    const sisaAvailable = saldoFisikFreezer - karantinaPcs;

    return { 
      saldoFisikFreezer, karantinaPcs, sisaAvailable, saldoAyamKg,
      listKarantina: listKarantina.sort((a,b) => new Date(a.date) - new Date(b.date))
    };
  }, [orders, productionBatches, purchases]);

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

  // --- HANDLER CETAK TIKET PRODUKSI 3-PLY (ARSIPIASI & VALIDASI) ---
  const handlePrintTiketProduksi = (log) => {
    triggerPrint('NOTA_DOTMATRIX', {
      title: 'TIKET KERJA PRODUKSI PABRIK (3-PLY)',
      id: 'TCK-' + log.id.substring(4),
      date: formatDate(log.date),
      branch_name: log.branch_id || currentBranch,
      admin_name: user?.name || 'ADMIN POS',
      customer_name: log.customer_name?.toUpperCase(),
      items: [
        { 
          name: `PESANAN: ${log.sales_channel}\n[REQUEST KHUSUS]: ${log.custom_request || 'STANDAR MIX'}`, 
          qty: log.qty, 
          subtotal: log.qty 
        }
      ],
      amount: log.qty,
      paymentMethod: log.delivery_method === 'PRE_ORDER' ? 'PRE-ORDER (KARANTINA)' : 'AMBIL LANGSUNG',
      footerCustom: `KETERANGAN POS: ${log.notes || '-'}\n----------------------------------------\nPLY 1: TIM DAPUR PABRIK (ARSIP WORK ORDER)\nPLY 2: VALIDASI BOS ADITYA (JIKA SELESAI)\nPLY 3: ADMIN BUKU KASIR POS (KONTROL ADD-ON)`
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Number(form.qty) <= 0) return alert("Jumlah beli harus lebih dari 0!");
    if (form.paymentMethod === 'DP' && Number(form.amountPaid) <= 0) return alert("Masukkan nominal DP!");

    if (form.deliveryMethod === 'DIRECT') {
      if (Number(form.qty) > stockMetrics.saldoFisikFreezer) {
        return alert(`❌ GAGAL! Stok fisik freezer tidak cukup! (Sisa: ${stockMetrics.saldoFisikFreezer} Pcs)`);
      }
      if (Number(form.qty) > stockMetrics.sisaAvailable) {
        const pinjam = Number(form.qty) - stockMetrics.sisaAvailable;
        const confirmPinjam = window.confirm(
          `⚠️ WARNING MEMINJAM STOK KARANTINA!\n\nStok Bebas hanya sisa ${stockMetrics.sisaAvailable} Pcs.\nOrder ini akan meminjam jatah ${pinjam} Pcs milik PO antrean orang lain!\n\nTetap eksekusi & catat log peminjaman?`
        );
        if (!confirmPinjam) return;
        form.notes = `[PINJAM STOK KARANTINA ${pinjam} PCS] ` + form.notes;
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
      custom_request: form.customRequest.toUpperCase(), // Menyimpan request kustom ke database cloud
      notes: form.notes.toUpperCase()
    };

    const action = isEditing ? 'update' : 'insert';
    const success = await sendToSheet(action, payload, 'orders');

    if (success) {
      showToast(isEditing ? 'Invoice berhasil direvisi!' : 'Invoice Penjualan Berhasil Dibuat!', 'success');
      
      // Auto-Trigger cetak tiket kerja produksi jika tipenya Pre-Order/Booking
      if (form.deliveryMethod === 'PRE_ORDER') {
         handlePrintTiketProduksi(payload);
      }

      setForm({
        id: '', date: todayStr, customerName: '', channel: 'ECERAN', customPrice: 3000, qty: '',
        deliveryMethod: 'DIRECT', shippingFee: 0, paymentMethod: 'CASH', amountPaid: '', notes: '',
        customRequest: 'STANDAR MIX (SIOMAY, HAKAU, CELL, DLL)'
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
      customRequest: log.custom_request || 'STANDAR MIX (SIOMAY, HAKAU, DLL)',
      notes: log.notes || ''
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6 pb-10 relative">
      
      {/* 📊 TOP METRICS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-xl text-white">
          <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Stok Bebas (Available)</div>
          <div className={`text-3xl font-black mt-1 ${stockMetrics.sisaAvailable < 0 ? 'text-rose-500' : 'text-white'}`}>{formatNumber(stockMetrics.sisaAvailable)} <span className="text-xs text-slate-400">PCS</span></div>
          <div className="text-[9px] text-slate-500 mt-2 font-bold">Bisa dijual langsung tanpa nabrak jatah PO</div>
        </div>

        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 shadow-sm cursor-pointer hover:bg-amber-100 transition-colors" onClick={() => setShowKarantinaModal(true)}>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Di-Booking (Karantina)</div>
              <div className="text-3xl font-black text-amber-700 mt-1">{formatNumber(stockMetrics.karantinaPcs)} <span className="text-xs">PCS</span></div>
            </div>
            <span className="bg-amber-200 text-amber-800 text-[9px] px-2 py-0.5 rounded font-black uppercase flex items-center gap-1"><Eye size={10}/> Detail PO</span>
          </div>
          <div className="text-[9px] text-amber-600/80 mt-2 font-bold">Klik untuk lihat list tiket antrean antaran produksi</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-blue-500">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Fisik Freezer</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{formatNumber(stockMetrics.saldoFisikFreezer)} <span className="text-xs">PCS</span></div>
          <div className="flex gap-3 mt-2 pt-2 border-t border-slate-100 text-[10px] font-bold text-slate-500">
            <div><span className="text-slate-800 font-black">{formatNumber(stockMetrics.saldoFisikFreezer / 50)}</span> Mika</div>
            <div><span className="text-slate-800 font-black">{formatNumber(stockMetrics.saldoFisikFreezer / 4)}</span> Porsi</div>
          </div>
        </div>

        <div className="bg-rose-50 p-5 rounded-2xl border shadow-sm border-l-4 border-l-rose-500">
          <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Stok Ayam Mentah Gudang</div>
          <div className="text-2xl font-black text-rose-700 mt-1">{formatNumber(stockMetrics.saldoAyamKg)} <span className="text-xs">KG</span></div>
          <div className="text-[9px] font-bold text-rose-600 mt-2 pt-2 border-t border-rose-100">Batas Maks Produksi: <span className="font-black">~{formatNumber(stockMetrics.saldoAyamKg * 33.3)} Pcs</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* FORM OPERASIONAL POS */}
        <div className={`p-6 rounded-2xl border border-t-4 transition-all h-max shadow-sm ${isEditing ? 'bg-amber-50/50 border-t-amber-500 border-amber-200' : 'bg-white border-t-emerald-600'}`}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm uppercase text-slate-800 flex items-center gap-2"><ShoppingCart size={16} className="text-emerald-600"/> Order Management &amp; Billing</h3>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Nama Pelanggan / Agen</label>
              <input type="text" required value={form.customerName} onChange={e=>setForm({...form, customerName: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold outline-none uppercase bg-white" placeholder="Contoh: AGEN DEDE TANGERANG" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Channel Distribusi</label>
                <select value={form.channel} onChange={e=>setForm({...form, channel: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-black outline-none bg-white uppercase cursor-pointer">
                  <optgroup label="Offline Node">
                    {SALES_CHANNELS.filter(c => c.group === 'OFFLINE').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </optgroup>
                  <optgroup label="Marketplace Engine">
                    {SALES_CHANNELS.filter(c => c.group === 'MARKETPLACE').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </optgroup>
                  <optgroup label="Merchant Delivery">
                    {SALES_CHANNELS.filter(c => c.group === 'MERCHANT').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Volume Beli (Pcs)</label>
                <input type="number" min="1" required value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-black text-emerald-700 outline-none bg-white text-center" placeholder="1000" />
              </div>
            </div>

            {/* FIELD UTAMA REQUEST KHUSUS PRODUKSI (Req Varian) */}
            <div>
              <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest block mb-1">⚠️ Request Khusus Produksi (Dicetak di Tiket 3-Ply)</label>
              <input type="text" required value={form.customRequest} onChange={e=>setForm({...form, customRequest: e.target.value})} className="w-full p-2.5 border-2 border-rose-200 focus:border-rose-400 rounded-xl text-xs font-black uppercase outline-none bg-rose-50/30 text-rose-800" placeholder="CONTOH: HANYA SIOMAY / TANPA UDANG / ISIAN JANGAN DI-MIX" />
            </div>

            {selectedChannelInfo.isManual && (
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-1">Input Harga Manual (Rp/Pcs)</label>
                <input type="number" required value={form.customPrice} onChange={e=>setForm({...form, customPrice: e.target.value})} className="w-full p-2 border border-amber-300 rounded-lg text-sm font-black outline-none" />
              </div>
            )}

            <div className="bg-slate-50 p-3 rounded-xl border">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Metode Serah Terima</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm({...form, deliveryMethod: 'DIRECT'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${form.deliveryMethod === 'DIRECT' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-sm' : 'bg-white border text-slate-400'}`}>Direct (Ambil Fisik)</button>
                <button type="button" onClick={() => setForm({...form, deliveryMethod: 'PRE_ORDER'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${form.deliveryMethod === 'PRE_ORDER' ? 'bg-amber-100 text-amber-700 border border-amber-300 shadow-sm' : 'bg-white border text-slate-400'}`}>Pre-Order (Booking Karantina)</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Ongkos Kirim (Rp)</label>
                <input type="number" min="0" value={form.shippingFee} onChange={e=>setForm({...form, shippingFee: e.target.value})} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-black outline-none text-right" />
              </div>
              <div className="pb-1.5 text-center">
                {form.qty >= 1000 && <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-1 rounded block">Bebas Ongkir Terbuka</span>}
              </div>
            </div>

            <div className="bg-slate-900 text-white p-4 rounded-xl">
              <div className="flex justify-between items-center mb-1 text-slate-400 text-xs font-bold"><span>Subtotal Barang:</span><span>{formatRupiah(perhitungan.subtotal)}</span></div>
              <div className="flex justify-between items-center mb-2 text-slate-400 text-xs font-bold border-b border-slate-700 pb-2"><span>Ongkos Logistik:</span><span>{formatRupiah(perhitungan.ongkir)}</span></div>
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Total Tagihan Bill</span>
                <span className="text-2xl font-black">{formatRupiah(perhitungan.totalTagihan)}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border bg-white border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Metode Pembayaran</label>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                  {['CASH', 'TF', 'DP'].map(m => (
                    <button key={m} type="button" onClick={() => setForm({...form, paymentMethod: m})} className={`px-2.5 py-1 rounded text-[10px] font-black transition-all ${form.paymentMethod === m ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>{m}</button>
                  ))}
                </div>
              </div>
              
              {form.paymentMethod === 'DP' && (
                <div className="mt-3 pt-3 border-t border-dashed">
                  <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-1">Nominal Setoran DP (Rp)</label>
                  <input type="number" required min="1" value={form.amountPaid} onChange={e=>setForm({...form, amountPaid: e.target.value})} className="w-full p-2 border border-amber-300 rounded-lg text-right font-black text-amber-700 bg-amber-50/50" />
                  <div className="text-right text-[9px] font-black text-rose-500 mt-1 uppercase tracking-widest">Sisa Piutang: {formatRupiah(perhitungan.totalTagihan - Number(form.amountPaid))}</div>
                </div>
              )}
            </div>

            <div><input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} placeholder="Catatan Ekspedisi (Opsional)..." className="w-full p-2.5 border rounded-xl text-xs outline-none bg-slate-50 uppercase" /></div>
            
            <button type="submit" className="w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-2">
              <Printer size={16}/> Simpan &amp; Rilis Nota Kasir
            </button>
          </form>
        </div>
        
        {/* ARSIP TRANSAKSI */}
        <div className="lg:col-span-2 bg-white rounded-2xl border flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
            <h4 className="font-black text-xs uppercase text-slate-700 tracking-widest flex items-center gap-2"><ShoppingCart size={14} className="text-blue-600"/> Log Jurnal Penjualan</h4>
          </div>
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b border-slate-200">
                <tr><th className="px-4 py-3">Invoice &amp; Tanggal</th><th className="px-4 py-3">Klien &amp; Volume</th><th className="px-4 py-3">Spesifikasi Request</th><th className="px-4 py-3">Fulfillment</th><th className="px-4 py-3 text-center">Aksi / Dokumen Kerja</th></tr>
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
                        <div className="text-[9px] font-black text-indigo-500 mt-0.5 uppercase">{log.sales_channel} • {formatNumber(log.qty)} PCS</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700 uppercase font-black tracking-tight line-clamp-2 max-w-[180px] bg-slate-100 px-2 py-1 rounded text-[10px] text-rose-700 border border-slate-200">
                          {log.custom_request || 'STANDAR MIX'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className={`text-[9px] font-black uppercase tracking-widest ${log.delivery_method === 'PRE_ORDER' ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {log.delivery_method === 'PRE_ORDER' ? '🔒 PO KARANTINA' : '✅ DIRECT OUT'}
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5">{sisaUtang > 0 ? 'STATUS: BILL DP' : 'STATUS: LUNAS'}</div>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* TOMBOL PENDUKUNG KHUSUS CETAK TIKET 3-PLY UNTUK PRODUKSI */}
                          <button type="button" onClick={() => handlePrintTiketProduksi(log)} className="p-1.5 bg-rose-600 text-white hover:bg-rose-700 rounded-lg shadow-sm flex items-center gap-1 text-[10px] font-black uppercase" title="Cetak Kertas Kerja Dapur (3-Ply)">
                            <FileText size={12}/> Tiket Pabrik
                          </button>
                          <button type="button" onClick={() => handleEdit(log)} className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg border border-amber-200" title="Edit Transaksi"><Edit2 size={12}/></button>
                          <button type="button" onClick={() => { if(window.confirm("Void invoice ini?")) requestDelete(log.id); }} className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg border border-rose-200" title="Void Invoice"><Trash2 size={12}/></button>
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

      {/* MODAL DETAILED LIST ANTREAN KARANTINA PO */}
      {showKarantinaModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-amber-500 text-white flex justify-between items-center shrink-0">
              <h3 className="font-black flex items-center gap-2 uppercase tracking-widest text-xs"><Lock size={14}/> Manifest Antrean PO Karantina (Belum Terkirim)</h3>
              <button onClick={() => setShowKarantinaModal(false)} className="hover:bg-amber-600 p-1 rounded-lg transition-colors"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b sticky top-0 shadow-sm z-10">
                  <tr><th className="px-4 py-3">Tanggal &amp; ID INV</th><th className="px-4 py-3">Nama Pembeli</th><th className="px-4 py-3">Spesifikasi Request Adonan</th><th className="px-4 py-3 text-center">Volume Booking</th><th className="px-4 py-3 text-center">Dokumen</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold">
                  {stockMetrics.listKarantina.length === 0 && (<tr><td colSpan="5" className="text-center py-10 text-slate-400 font-bold">Antrean bersih. Tidak ada defisit booking.</td></tr>)}
                  {stockMetrics.listKarantina.map(k => {
                    return (
                      <tr key={k.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3"><div className="text-slate-800">{formatDate(k.date)}</div><div className="text-[9px] font-mono text-slate-400">{k.id}</div></td>
                        <td className="px-4 py-3 uppercase text-slate-700">{k.customer_name}</td>
                        <td className="px-4 py-3 text-rose-700 font-black uppercase text-[10px]">{k.custom_request || 'STANDAR MIX'}</td>
                        <td className="px-4 py-3 text-center"><span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-lg font-black">{formatNumber(k.qty)} PCS</span></td>
                        <td className="px-4 py-3 text-center">
                          {/* RE-PRINT TIKET PRODUKSI LANGSUNG DARI MANIFEST WINDOW */}
                          <button type="button" onClick={() => handlePrintTiketProduksi(k)} className="p-1 px-2 bg-slate-800 text-white rounded text-[9px] uppercase font-black tracking-wider hover:bg-slate-900 inline-flex items-center gap-1"><Printer size={10}/> Re-Cetak Tiket</button>
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
