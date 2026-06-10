import React, { useState, useMemo } from 'react';
import { ShoppingCart, Edit2, Printer, Trash2, Calendar, Lock, FileText, Undo, Wallet, BarChart3, CheckCircle2, X } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

// MASTER DATA HARGA DEFAULT (BISA DIUPDATE VIA CHECKBOX)
const INITIAL_CHANNELS = [
  { id: 'ECERAN', label: 'Eceran / Porsian', group: 'OFFLINE', price: 2000, isManual: false },
  { id: 'MITRA', label: 'Mitra Agen', group: 'OFFLINE', price: 2000, isManual: false },
  { id: 'RESELLER', label: 'Reseller', group: 'OFFLINE', price: 2125, isManual: false },
  { id: 'PAKETAN_ACARA', label: 'Paketan Acara (Manual)', group: 'OFFLINE', price: 0, isManual: true },
  { id: 'SHOPEE', label: 'Toko Shopee', group: 'MARKETPLACE', price: 2500, isManual: false },
  { id: 'TOKOPEDIA', label: 'Tokopedia', group: 'MARKETPLACE', price: 2500, isManual: false },
  { id: 'TIKTOK', label: 'TikTok Shop', group: 'MARKETPLACE', price: 2500, isManual: false },
];

export default function TabOrders({ orders = [], orders_data, productionBatches = [], production_batches, purchases = [], purchases_data, sendToSheet, showToast, user, requestDelete }) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  // --- STATE MANAGEMENT ---
  const [channels, setChannels] = useState(INITIAL_CHANNELS);
  const [isEditing, setIsEditing] = useState(false);
  const [showKarantinaModal, setShowKarantinaModal] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [tableDateFilter, setTableDateFilter] = useState(todayStr); // Default tabel kanan cuma tampil TANGGAL HARI INI
  const [updateMasterPrice, setUpdateMasterPrice] = useState(false); // Checkbox simpan harga master

  // --- FORM STATE (DENGAN CORE KONVERSI OTOMATIS) ---
  const [form, setForm] = useState({
    id: '', date: todayStr, customerName: '', channel: 'ECERAN', customPrice: 2000,
    qtyPcs: '', qtyMika: '', qtyPorsi: '', // 3 inputan konversi berdampingan
    deliveryMethod: 'DIRECT', shippingFee: 0, paymentMethod: 'CASH', amountPaid: '', notes: '',
    customRequest: 'Dimsum Mix' 
  });

  const selectedChannelInfo = useMemo(() => channels.find(c => c.id === form.channel) || channels[0], [form.channel, channels]);

  // --- ENGINE SINKRONISASI DATABASE ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realProd = useMemo(() => production_batches || productionBatches || [], [productionBatches, production_batches]);

  // --- LOGIKA HUBUNGAN TIMBAL BALIK KONVERSI (Pcs = 1, Mika = 50 Pcs, Porsi = 4 Pcs) ---
  const handleKonversi = (value, unitType) => {
    const num = Math.max(0, parseInt(value) || 0);
    if (num === 0) {
      setForm(prev => ({ ...prev, qtyPcs: '', qtyMika: '', qtyPorsi: '' }));
      return;
    }

    if (unitType === 'PCS') {
      setForm(prev => ({
        ...prev,
        qtyPcs: num,
        qtyMika: Math.round(num / 50),
        qtyPorsi: Math.round(num / 4)
      }));
    } else if (unitType === 'MIKA') {
      setForm(prev => ({
        ...prev,
        qtyPcs: num * 50,
        qtyMika: num,
        qtyPorsi: Math.round((num * 50) / 4)
      }));
    } else if (unitType === 'PORSI') {
      setForm(prev => ({
        ...prev,
        qtyPcs: num * 4,
        qtyMika: Math.round((num * 4) / 50),
        qtyPorsi: num
      }));
    }
  };

  // --- METRIK STOK & AMPLOP ---
  const stockMetrics = useMemo(() => {
    let totalMasukFreezer = 0; let totalKeluarFreezer = 0; let totalAyamMasukKg = 0; let totalAyamKeluarKg = 0; let karantinaPcs = 0; let listKarantina = [];
    realPurchases.filter(p => !p.isDeleted && p.category === 'BAHAN_BAKU').forEach(p => { totalAyamMasukKg += Number(p.qty_kg || 0); });
    realProd.filter(p => !p.isDeleted).forEach(p => { totalMasukFreezer += Number(p.total_yield_pcs || 0); totalAyamKeluarKg += Number(p.total_ayam_kg || 0); });
    realOrders.filter(o => !o.isDeleted).forEach(o => {
      const qty = Number(o.qty || 0);
      if (o.delivery_method === 'PRE_ORDER' && o.status !== 'SELESAI') { karantinaPcs += qty; listKarantina.push(o); } else { totalKeluarFreezer += qty; }
    });
    return { sisaAvailable: totalMasukFreezer - totalKeluarFreezer - karantinaPcs, karantinaPcs, saldoFisikFreezer: totalMasukFreezer - totalKeluarFreezer, saldoAyamKg: Math.max(0, totalAyamMasukKg - totalAyamKeluarKg), listKarantina };
  }, [realOrders, realProd, realPurchases]);

  const envelopeMetrics = useMemo(() => {
    let total2Minggu = 0;
    const batas = new Date(); batas.setDate(batas.getDate() - 14);
    realOrders.filter(o => !o.isDeleted && new Date(o.date) >= batas).forEach(o => total2Minggu += Number(o.amount_paid || o.total_amount || 0));
    return { total: total2Minggu, amp1: total2Minggu * 0.55, amp2: total2Minggu * 0.20, amp3: total2Minggu * 0.10, amp4: total2Minggu * 0.15 };
  }, [realOrders]);

  const perhitungan = useMemo(() => {
    const qty = Number(form.qtyPcs || 0);
    const hargaSatuan = selectedChannelInfo.isManual ? Number(form.customPrice || 0) : selectedChannelInfo.price;
    const totalTagihan = (qty * hargaSatuan) + Number(form.shippingFee || 0);
    return { hargaSatuan, totalTagihan, hppPokok: qty * 1125, profitKotor: (qty * hargaSatuan) - (qty * 1125), dibayar: form.paymentMethod === 'DP' ? Number(form.amountPaid || 0) : totalTagihan };
  }, [form, selectedChannelInfo]);

  // --- ACTIONS ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    const qtyFinal = Number(form.qtyPcs || 0);
    if (qtyFinal <= 0) return alert("Kuantitas produk tidak boleh kosong!");
    
    const trxId = isEditing ? form.id : generateId('INV', form.date);
    const payload = {
      id: trxId, date: form.date, branch_id: currentBranch, customer_name: form.customerName.toUpperCase(), sales_channel: form.channel,
      qty: qtyFinal, unit_price: perhitungan.hargaSatuan, delivery_method: form.deliveryMethod, shipping_fee: Number(form.shippingFee),
      subtotal: qtyFinal * perhitungan.hargaSatuan, total_amount: perhitungan.totalTagihan, payment_method: form.paymentMethod, amount_paid: perhitungan.dibayar,
      status: form.deliveryMethod === 'PRE_ORDER' ? 'BELUM_DIKIRIM' : 'SELESAI', custom_request: form.customRequest, notes: form.notes
    };

    // Bila checkbox di-centang, perbarui state master harga lokal aplikasi
    if (updateMasterPrice && !selectedChannelInfo.isManual) {
      setChannels(prev => prev.map(c => c.id === form.channel ? { ...c, price: Number(perhitungan.hargaSatuan) } : c));
      // Sekaligus kirim data update master ke sheets
      await sendToSheet('insert', { id: form.channel, product_name: form.channel, standard_price: Number(perhitungan.hargaSatuan) }, 'master_products');
    }

    if (await sendToSheet(isEditing ? 'update' : 'insert', payload, 'orders')) {
      showToast('Transaksi berhasil disimpan!', 'success');
      if (form.deliveryMethod === 'PRE_ORDER') handlePrintTiketProduksi(payload);
      handleCancelEdit();
    }
  };

  const handlePrintTiketProduksi = (log) => {
    triggerPrint('NOTA_DOTMATRIX', { title: 'WORK ORDER MANIFEST', id: log.id, date: formatDate(log.date), branch_name: log.branch_id, admin_name: user?.name || 'KASIR', customer_name: log.customer_name, items: [{ name: `MANUFACTURING ORDER\nREQ: ${log.custom_request}`, qty: log.qty, suffix: ' Pcs', subtotal: 0 }], paymentMethod: 'PO ANTRIAN' });
  };

  const handlePrintInvoiceKlien = (log) => {
    triggerPrint('NOTA_DOTMATRIX', { title: 'INVOICE DIMSUM ADITYA', id: log.id, date: formatDate(log.date), branch_name: log.branch_id, admin_name: user?.name || 'KASIR', customer_name: log.customer_name, items: [{ name: `DIMSUM FROZEN CORE\nREQ: ${log.custom_request}`, qty: log.qty, suffix: ' Pcs', subtotal: log.subtotal }], amount: log.total_amount, paymentMethod: log.payment_method });
  };

  const handleEditSafe = (log) => {
    setForm({ id: log.id, date: log.date.substring(0,10), customerName: log.customer_name, channel: log.sales_channel, customPrice: log.unit_price, qtyPcs: log.qty, qtyMika: Math.round(log.qty / 50), qtyPorsi: Math.round(log.qty / 4), deliveryMethod: log.delivery_method, shippingFee: log.shipping_fee, paymentMethod: log.payment_method, amountPaid: log.amount_paid, notes: log.notes, customRequest: log.custom_request || 'Dimsum Mix' });
    setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setIsEditing(false); setUpdateMasterPrice(false);
    setForm({ id: '', date: todayStr, customerName: '', channel: 'ECERAN', customPrice: 2000, qtyPcs: '', qtyMika: '', qtyPorsi: '', deliveryMethod: 'DIRECT', shippingFee: 0, paymentMethod: 'CASH', amountPaid: '', notes: '', customRequest: 'Dimsum Mix' });
  };

  // Filter khusus untuk tabel kanan (Hanya nampilin tanggal yang dipilih di kalender kecil)
  const filteredOrdersTable = useMemo(() => {
    return realOrders.filter(o => !o.isDeleted && o.date.substring(0, 10) === tableDateFilter);
  }, [realOrders, tableDateFilter]);

  return (
    <div className="space-y-6 pb-10">
      
      {/* CARD KPI ATAS */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-slate-900 p-5 rounded-2xl text-white border border-slate-800 shadow-sm">
          <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Stok Available</div>
          <div className="text-3xl font-black mt-1">{formatNumber(stockMetrics.sisaAvailable)} <span className="text-xs text-slate-400">PCS</span></div>
        </div>
        <div onClick={() => setShowKarantinaModal(true)} className="bg-amber-50 p-5 rounded-2xl border border-amber-200 cursor-pointer hover:bg-amber-100/50 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest">PO Karantina</div>
              <div className="text-3xl font-black text-amber-700 mt-1">{formatNumber(stockMetrics.karantinaPcs)} <span className="text-xs">PCS</span></div>
            </div>
            <span className="bg-amber-200 text-amber-800 text-[8px] px-2 py-0.5 rounded-md font-black uppercase">Detail</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fisik Freezer</div>
          <div className="text-3xl font-black text-blue-600 mt-1">{formatNumber(stockMetrics.saldoFisikFreezer)} <span className="text-xs">PCS</span></div>
        </div>
        <div className="bg-rose-50 p-5 rounded-2xl border border-rose-100 shadow-sm">
          <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Stok Ayam Gudang</div>
          <div className="text-3xl font-black text-rose-700 mt-1">{formatNumber(stockMetrics.saldoAyamKg)} <span className="text-xs">KG</span></div>
        </div>
        <div onClick={() => setShowClosingModal(true)} className="bg-gradient-to-br from-indigo-600 to-blue-700 p-5 rounded-2xl shadow-md text-white flex flex-col justify-between cursor-pointer hover:opacity-95 border border-indigo-500">
          <div className="text-[10px] font-black text-indigo-100 uppercase tracking-widest">4 Amplop Virtual</div>
          <div className="text-base font-black mt-2">Omzet: {formatRupiah(envelopeMetrics.total)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* KIRI: PANEL INPUT PENJUALAN MEWAH */}
        <div className={`p-6 rounded-3xl border shadow-sm transition-all h-max ${isEditing ? 'bg-amber-50/30 border-amber-300' : 'bg-white border-slate-200'}`}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider flex items-center gap-2"><ShoppingCart size={16} className="text-emerald-500"/> {isEditing ? 'Revisi Transaksi' : 'Buat Pesanan Baru'}</h3>
              {isEditing && <button type="button" onClick={handleCancelEdit} className="text-[10px] bg-white border px-2.5 py-1 rounded-lg font-black text-amber-700 uppercase shadow-sm">Batal</button>}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5 tracking-wider">Nama Pelanggan / Agen</label>
              <input type="text" required value={form.customerName} onChange={e=>setForm({...form, customerName: e.target.value})} className="w-full p-3 border rounded-xl text-sm font-bold uppercase bg-slate-50 outline-none focus:bg-white focus:border-emerald-400" placeholder="Ketik nama pembeli..." />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5 tracking-wider">Kategori Agen &amp; Harga Master</label>
              <select value={form.channel} onChange={e=>setForm({...form, channel: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-black bg-slate-50 outline-none uppercase cursor-pointer">
                {channels.map(c => <option key={c.id} value={c.id}>{c.label} {c.price > 0 ? `(${formatRupiah(c.price)}/Pcs)` : '(Input Manual)'}</option>)}
              </select>
            </div>

            {/* BARIS CHECKBOX GANTI HARGA MASTER DAN HARGA KUSTOM */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border">
              {selectedChannelInfo.isManual ? (
                <div className="w-full">
                  <label className="text-[10px] font-black text-amber-600 uppercase block mb-1">Harga Custom/Pcs</label>
                  <input type="number" required value={form.customPrice} onChange={e=>setForm({...form, customPrice: e.target.value})} className="w-full p-2 border border-amber-200 rounded-lg text-xs font-black outline-none bg-white" />
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer w-full select-none">
                  <input type="checkbox" checked={updateMasterPrice} onChange={e => setUpdateMasterPrice(e.target.checked)} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-400 w-4 h-4 cursor-pointer" />
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">Simpan sebagai Harga Master baru jika ada perubahan harga</span>
                </label>
              )}
            </div>

            {/* ⚡ PANEL GRID CORE KONVERSI TIGA KANTONG (INPUT YANG MANA SAJA OTOMATIS BERUBAH) */}
            <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100 space-y-3">
              <div className="text-[10px] font-black text-emerald-700 uppercase tracking-widest text-center border-b border-emerald-100/50 pb-2">Kalkulator Konversi Volume Dimsum</div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase block text-center mb-1">Satuan Pcs</label>
                  <input type="number" value={form.qtyPcs} onChange={e => handleKonversi(e.target.value, 'PCS')} className="w-full p-2.5 border border-emerald-200 text-center text-sm font-black text-emerald-800 rounded-xl bg-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" placeholder="0" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase block text-center mb-1">Satuan Mika</label>
                  <input type="number" value={form.qtyMika} onChange={e => handleKonversi(e.target.value, 'MIKA')} className="w-full p-2.5 border border-emerald-200 text-center text-sm font-black text-emerald-800 rounded-xl bg-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" placeholder="0" />
                  <div className="text-[8px] text-slate-400 text-center font-bold mt-0.5">@50 Pcs</div>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase block text-center mb-1">Satuan Porsi</label>
                  <input type="number" value={form.qtyPorsi} onChange={e => handleKonversi(e.target.value, 'PORSI')} className="w-full p-2.5 border border-emerald-200 text-center text-sm font-black text-emerald-800 rounded-xl bg-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" placeholder="0" />
                  <div className="text-[8px] text-slate-400 text-center font-bold mt-0.5">@4 Pcs</div>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5 tracking-wider">Detail Varian / Request Khusus</label>
              <input type="text" value={form.customRequest} onChange={e=>setForm({...form, customRequest: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-bold bg-slate-50 outline-none" />
            </div>

            <div className="bg-slate-50 p-1 rounded-xl border flex gap-1">
              <button type="button" onClick={() => setForm({...form, deliveryMethod: 'DIRECT'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${form.deliveryMethod === 'DIRECT' ? 'bg-white text-emerald-700 shadow-sm border' : 'text-slate-400'}`}>Bawa Langsung</button>
              <button type="button" onClick={() => setForm({...form, deliveryMethod: 'PRE_ORDER', paymentMethod: 'DP', amountPaid: ''})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${form.deliveryMethod === 'PRE_ORDER' ? 'bg-white text-amber-700 shadow-sm border' : 'text-slate-400'}`}>Pre-Order (PO)</button>
            </div>

            {/* STRIP BILL TOTAL */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl border relative overflow-hidden">
              <div className="flex justify-between items-end relative z-10">
                <span className="text-[10px] font-black uppercase text-slate-400">Total Tagihan</span>
                <span className="text-2xl font-black tracking-tight">{formatRupiah(perhitungan.totalTagihan)}</span>
              </div>
              {Number(form.qtyPcs) > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-800 space-y-1 text-[10px] font-bold text-slate-400 flex justify-between">
                  <span>Estimasi Keuntungan Kotor:</span>
                  <span className="text-emerald-400 font-black">+{formatRupiah(perhitungan.profitKotor)}</span>
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl border bg-slate-50/60">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-500 uppercase">Jalur Bayar</label>
                <div className="flex gap-1 bg-slate-200/50 p-1 rounded-md">
                  {['CASH', 'TF', 'DP'].map(m => <button key={m} type="button" onClick={() => setForm({...form, paymentMethod: m})} className={`px-2.5 py-1 rounded text-[10px] font-black ${form.paymentMethod === m ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>{m}</button>)}
                </div>
              </div>
              {form.paymentMethod === 'DP' && (
                <div className="mt-3 pt-3 border-t border-dashed">
                  <label className="text-[10px] font-black text-amber-700 block mb-1">Setoran Uang Muka (DP)</label>
                  <input type="number" required value={form.amountPaid} onChange={e=>setForm({...form, amountPaid: e.target.value})} className="w-full p-2 border border-amber-200 rounded-lg text-right font-black bg-white" placeholder="0" />
                </div>
              )}
            </div>

            <button type="submit" className={`w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-md transition-transform active:scale-95 ${isEditing ? 'bg-amber-500' : 'bg-emerald-600'}`}>
              {isEditing ? 'Simpan Revisi' : 'Simpan &amp; Cetak Nota'}
            </button>
          </form>
        </div>

        {/* KANAN: JURNAL TRANSAKSI (REALTIME HARI INI SAJA + FILTER TANGGAL BERJALAN) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border flex flex-col overflow-hidden shadow-sm">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h4 className="font-black text-xs uppercase text-slate-700 tracking-widest">Daftar Transaksi Kasir</h4>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase">Status Tampilan: {tableDateFilter === todayStr ? 'Hari Ini (Real-time)' : 'Histori Masa Lalu'}</p>
            </div>
            
            {/* KALENDER KECIL FILTER LOG JURNAL KASIR */}
            <div className="flex items-center gap-2 bg-white border px-2.5 py-1.5 rounded-xl shadow-sm">
              <Calendar size={12} className="text-slate-400"/>
              <input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value || todayStr)} className="text-xs font-black outline-none bg-transparent cursor-pointer text-slate-700" />
            </div>
          </div>

          <div className="overflow-x-auto flex-1 p-2">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] uppercase text-slate-400 bg-white">
                <tr><th className="px-3 py-3 font-black">Nota</th><th className="px-3 py-3 font-black">Klien / Agen</th><th className="px-3 py-3 font-black">Volume</th><th className="px-3 py-3 font-black">Status</th><th className="px-3 py-3 font-black text-center">Tindakan</th></tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-50">
                {filteredOrdersTable.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-20 text-slate-400 font-bold uppercase tracking-tight">Tidak ada transaksi keluar/masuk untuk tanggal {formatDate(tableDateFilter)}</td></tr>
                ) : (
                  filteredOrdersTable.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-bold">{formatDate(log.date)}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">{log.id}</div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="uppercase font-black text-slate-800">{log.customer_name}</div>
                        <div className="text-[9px] text-blue-500 font-black uppercase mt-0.5">{log.sales_channel}</div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="font-black text-emerald-600 text-sm">{formatNumber(log.qty)} Pcs</div>
                        <div className="text-slate-400 text-[9px] font-medium mt-0.5">{log.custom_request}</div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        {log.delivery_method === 'PRE_ORDER' ? 
                          <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-1 rounded-md flex items-center w-max gap-1"><Lock size={10}/> Karantina</span> : 
                          <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md flex items-center w-max gap-1"><CheckCircle2 size={10}/> Diambil</span>
                        }
                      </td>
                      <td className="px-3 py-4 text-center whitespace-nowrap opacity-60 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center justify-center gap-1.5">
                          <button type="button" onClick={() => handlePrintTiketProduksi(log)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors" title="Tiket Kerja Dapur"><FileText size={15}/></button>
                          <button type="button" onClick={() => handlePrintInvoiceKlien(log)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title="Cetak Invoice Nota"><Printer size={15}/></button>
                          <button type="button" onClick={() => handleEditSafe(log)} className="p-1.5 text-slate-400 hover:text-amber-500 rounded-md transition-colors" title="Revisi"><Edit2 size={13}/></button>
                          <button type="button" onClick={() => { if(window.confirm("Void Nota?")) requestDelete(log.id); }} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition-colors" title="Hapus"><Trash2 size={13}/></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL DETAILED LIST ANTREAN KARANTINA PO */}
      {showKarantinaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden animate-in duration-100">
            <div className="p-5 bg-amber-500 text-white flex justify-between items-center shrink-0">
              <h3 className="font-black flex items-center gap-2 uppercase tracking-widest text-xs"><Lock size={16}/> Manifest Antrean PO Karantina (Booking Gudang)</h3>
              <button onClick={() => setShowKarantinaModal(false)} className="hover:bg-amber-600 p-1 rounded-lg"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="bg-white text-[10px] uppercase text-slate-500 border-b sticky top-0 shadow-sm z-10">
                  <tr><th className="px-4 py-3 font-black">Tanggal &amp; INV</th><th>Nama Pembeli</th><th>Request Varian</th><th className="text-center">Volume Booking</th><th className="text-center">Aksi</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs font-bold">
                  {stockMetrics.listKarantina.length === 0 && (<tr><td colSpan="5" className="text-center py-10 text-slate-400 font-bold">Antrean PO Kosong Bersih.</td></tr>)}
                  {stockMetrics.listKarantina.map(k => (
                    <tr key={k.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4"><div>{formatDate(k.date)}</div><div className="text-[9px] font-mono text-slate-400 mt-0.5">{k.id}</div></td>
                      <td className="px-4 py-4 uppercase text-slate-700">{k.customer_name}</td>
                      <td className="px-4 py-4 text-rose-700 font-black uppercase text-[10px]">{k.custom_request}</td>
                      <td className="px-4 py-4 text-center"><span className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg font-black">{formatNumber(k.qty)} PCS</span></td>
                      <td className="px-4 py-4 text-center"><button type="button" onClick={() => handlePrintTiketProduksi(k)} className="p-2 bg-slate-800 text-white rounded-lg text-[10px] uppercase font-black flex items-center gap-1.5 mx-auto"><FileText size={12}/> Re-Cetak Tiket</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4 AMPLOP VIRTUAL CLOSING (2 MINGGUAN) */}
      {showClosingModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
             <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-black flex items-center gap-2 uppercase tracking-widest text-xs"><Wallet size={16} className="text-blue-400"/> Buku Anggaran 4 Amplop Virtual</h3>
              <button onClick={() => setShowClosingModal(false)} className="hover:bg-slate-800 p-1.5 rounded-lg"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-slate-50 p-5 rounded-2xl border flex justify-between items-center">
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Uang Masuk (2 Minggu Terakhir)</div>
                  <div className="text-4xl font-black text-slate-800 mt-1">{formatRupiah(envelopeMetrics.total)}</div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-4 bg-white rounded-xl border border-l-4 border-l-rose-500 shadow-sm">
                  <div className="text-xs font-black text-slate-600 uppercase">1. Uang Beli Ayam (55%)</div>
                  <div className="text-base font-black text-rose-600">{formatRupiah(envelopeMetrics.amp1)}</div>
                </div>
                <div className="flex justify-between items-center p-4 bg-white rounded-xl border border-l-4 border-l-blue-500 shadow-sm">
                  <div className="text-xs font-black text-slate-600 uppercase">2. Uang Operasional &amp; Gaji (20%)</div>
                  <div className="text-base font-black text-blue-600">{formatRupiah(envelopeMetrics.amp2)}</div>
                </div>
                <div className="flex justify-between items-center p-4 bg-white rounded-xl border border-l-4 border-l-amber-500 shadow-sm">
                  <div className="text-xs font-black text-slate-600 uppercase">3. Uang Jaga-jaga Pabrik (10%)</div>
                  <div className="text-base font-black text-amber-500">{formatRupiah(envelopeMetrics.amp3)}</div>
                </div>
                <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-xl border border-indigo-100 border-l-4 border-l-indigo-600 shadow-sm">
                  <div className="text-xs font-black text-indigo-900 uppercase">4. Tabungan Bersih Bos (15%)</div>
                  <div className="text-base font-black text-indigo-700">{formatRupiah(envelopeMetrics.amp4)}</div>
                </div>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs font-bold text-slate-600 leading-relaxed">
                👉 Pindahkan porsi Laba Bersih 15% (**{formatRupiah(envelopeMetrics.amp4)}**) ke rekening pribadi Bos Aditya. Biarkan sisanya tetap berputar di rekening utama sebagai modal kerja.
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
