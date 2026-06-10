import React, { useState, useMemo } from 'react';
import { ShoppingCart, Package, AlertCircle, Edit2, Printer, Trash2, CalendarDays, Lock, FileText, Undo, Wallet, BarChart3, CheckCircle2, X } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

const SALES_CHANNELS = [
  { id: 'ECERAN', label: 'Eceran / Porsian', group: 'OFFLINE', price: 2000, isManual: false },
  { id: 'MITRA', label: 'Mitra Agen', group: 'OFFLINE', price: 2000, isManual: false },
  { id: 'RESELLER', label: 'Reseller', group: 'OFFLINE', price: 2125, isManual: false },
  { id: 'PAKETAN_ACARA', label: 'Paketan Acara (Manual)', group: 'OFFLINE', price: 0, isManual: true },
  { id: 'SHOPEE', label: 'Toko Shopee', group: 'MARKETPLACE', price: 2500, isManual: false },
  { id: 'TOKOPEDIA', label: 'Tokopedia', group: 'MARKETPLACE', price: 2500, isManual: false },
  { id: 'TIKTOK', label: 'TikTok Shop', group: 'MARKETPLACE', price: 2500, isManual: false },
  { id: 'SHOPEEFOOD', label: 'ShopeeFood', group: 'MERCHANT', price: 2500, isManual: false },
  { id: 'GOFOOD', label: 'GoFood', group: 'MERCHANT', price: 2500, isManual: false },
  { id: 'GRABFOOD', label: 'GrabFood', group: 'MERCHANT', price: 2500, isManual: false },
];

export default function TabOrders({ orders = [], orders_data, productionBatches = [], production_batches, purchases = [], purchases_data, sendToSheet, showToast, user, requestDelete }) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  const [isEditing, setIsEditing] = useState(false);
  const [showKarantinaModal, setShowKarantinaModal] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);
  
  const [form, setForm] = useState({
    id: '', date: todayStr, customerName: '', channel: 'ECERAN', customPrice: 2000, qty: '',
    deliveryMethod: 'DIRECT', shippingFee: 0, paymentMethod: 'CASH', amountPaid: '', notes: '',
    customRequest: 'Dimsum Mix' 
  });

  const selectedChannelInfo = useMemo(() => SALES_CHANNELS.find(c => c.id === form.channel) || SALES_CHANNELS[0], [form.channel]);

  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realProd = useMemo(() => production_batches || productionBatches || [], [productionBatches, production_batches]);

  const stockMetrics = useMemo(() => {
    let totalMasukFreezer = 0; let totalKeluarFreezer = 0; let totalAyamMasukKg = 0; let totalAyamKeluarKg = 0; let karantinaPcs = 0; let listKarantina = [];
    realPurchases.filter(p => !p.isDeleted && p.category === 'BAHAN_BAKU' && (p.branch_id === currentBranch || p.branch_id === 'PUSAT')).forEach(p => { totalAyamMasukKg += Number(p.qty_kg || 0); });
    realProd.filter(p => !p.isDeleted && (p.branch_id === currentBranch || p.branch_id === 'PUSAT')).forEach(p => { totalMasukFreezer += Number(p.total_yield_pcs || 0); totalAyamKeluarKg += Number(p.total_ayam_kg || 0); });
    realOrders.filter(o => !o.isDeleted && (o.branch_id === currentBranch || o.branch_id === 'PUSAT')).forEach(o => {
      const qty = Number(o.qty || 0);
      if (o.delivery_method === 'PRE_ORDER' && o.status !== 'SELESAI') { karantinaPcs += qty; listKarantina.push(o); } else { totalKeluarFreezer += qty; }
    });
    const saldoFisikFreezer = totalMasukFreezer - totalKeluarFreezer;
    return { saldoFisikFreezer, karantinaPcs, sisaAvailable: saldoFisikFreezer - karantinaPcs, saldoAyamKg: Math.max(0, totalAyamMasukKg - totalAyamKeluarKg), listKarantina: listKarantina.sort((a,b) => new Date(a.date) - new Date(b.date)) };
  }, [realOrders, realProd, realPurchases, currentBranch]);

  const envelopeMetrics = useMemo(() => {
    let totalUangMasuk2Minggu = 0;
    const tanggalBatas = new Date();
    tanggalBatas.setDate(tanggalBatas.getDate() - 14);
    realOrders.filter(o => !o.isDeleted && new Date(o.date) >= tanggalBatas && (o.branch_id === currentBranch || o.branch_id === 'PUSAT')).forEach(o => {
      totalUangMasuk2Minggu += Number(o.amount_paid || o.total_amount || 0);
    });
    const KEWAJIBAN_GAJI_SEBULAN = 25000000; 
    const TARGET_AMAN_GAJI_RESERVE = KEWAJIBAN_GAJI_SEBULAN * 2; 
    const amp2_ops = totalUangMasuk2Minggu * 0.20;
    let statusGaji = 'KRITIS';
    if (amp2_ops >= TARGET_AMAN_GAJI_RESERVE) statusGaji = 'AMAN_RESERVE';
    else if (amp2_ops >= KEWAJIBAN_GAJI_SEBULAN) statusGaji = 'CUKUP_BULAN_INI';
    return {
      totalUangMasuk2Minggu, amp1_ayam: totalUangMasuk2Minggu * 0.55, amp2_ops, amp3_cadangan: totalUangMasuk2Minggu * 0.10, amp4_pribadi: totalUangMasuk2Minggu * 0.15,
      kewajibanGaji: KEWAJIBAN_GAJI_SEBULAN, targetAmanGaji: TARGET_AMAN_GAJI_RESERVE, statusGaji
    };
  }, [realOrders, currentBranch]);

  const perhitungan = useMemo(() => {
    const qty = Number(form.qty || 0);
    const hargaSatuan = selectedChannelInfo.isManual ? Number(form.customPrice || 0) : selectedChannelInfo.price;
    const totalTagihan = (qty * hargaSatuan) + Number(form.shippingFee || 0);
    const hppPokok = qty * 1125; 
    return { hargaSatuan, subtotal: qty * hargaSatuan, totalTagihan, hppPokok, profitKotor: (qty * hargaSatuan) - hppPokok, dibayar: form.paymentMethod === 'DP' ? Number(form.amountPaid || 0) : totalTagihan };
  }, [form, selectedChannelInfo]);

  const handlePrintTiketProduksi = (log) => {
    const rahasiaData = `@@WORK_ORDER@@||${log.sales_channel}||${log.custom_request || 'Dimsum Mix'}||${log.notes || '-'}`;
    triggerPrint('NOTA_DOTMATRIX', { title: 'WORK ORDER & MANIFEST PABRIK', id: log.id, date: formatDate(log.date), branch_name: log.branch_id || currentBranch, admin_name: user?.name || 'KASIR', customer_name: log.customer_name?.toUpperCase(), items: [{ name: rahasiaData, qty: log.qty, subtotal: 0 }], paymentMethod: log.delivery_method === 'PRE_ORDER' ? 'ANTREAN PRE-ORDER' : 'PENGAMBILAN LANGSUNG' });
  };

  const handlePrintInvoiceKlien = (log) => {
    const sisaUtang = Number(log.total_amount) - Number(log.amount_paid);
    triggerPrint('NOTA_DOTMATRIX', { title: 'INVOICE PENJUALAN', id: log.id, date: formatDate(log.date), branch_name: log.branch_id || currentBranch, admin_name: user?.name || 'KASIR', customer_name: log.customer_name?.toUpperCase(), items: [{ name: `DIMSUM FROZEN (${log.sales_channel})\nREQ: ${log.custom_request || 'Dimsum Mix'}`, qty: log.qty, subtotal: log.subtotal, suffix: ' Pcs' }], amount: log.total_amount, paymentMethod: sisaUtang > 0 ? `BELUM LUNAS (SISA: ${formatRupiah(sisaUtang)})` : `LUNAS (${log.payment_method})` });
  };

  const handleEditSafe = (log) => {
    try {
      setForm({ id: log.id || '', date: log.date ? String(log.date).substring(0, 10) : todayStr, customerName: log.customer_name || '', channel: log.sales_channel || 'ECERAN', customPrice: log.unit_price || 0, qty: log.qty || '', deliveryMethod: log.delivery_method || 'DIRECT', shippingFee: log.shipping_fee || 0, paymentMethod: log.payment_method || 'CASH', amountPaid: log.amount_paid !== undefined ? log.amount_paid : (log.total_amount || 0), notes: log.notes || '', customRequest: log.custom_request || 'Dimsum Mix' });
      setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { alert('Gagal memuat data edit.'); }
  };

  const handleCancelEdit = () => {
    setIsEditing(false); setForm({ id: '', date: todayStr, customerName: '', channel: 'ECERAN', customPrice: 2000, qty: '', deliveryMethod: 'DIRECT', shippingFee: 0, paymentMethod: 'CASH', amountPaid: '', notes: '', customRequest: 'Dimsum Mix' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Number(form.qty) <= 0) return alert("Jumlah beli harus lebih dari 0!");
    const trxId = isEditing ? form.id : generateId('INV', form.date);
    const payload = { id: trxId, date: form.date, branch_id: currentBranch, customer_name: form.customerName.toUpperCase(), sales_channel: form.channel, qty: Number(form.qty), unit_price: perhitungan.hargaSatuan, delivery_method: form.deliveryMethod, shipping_fee: Number(form.shippingFee), subtotal: perhitungan.subtotal, total_amount: perhitungan.totalTagihan, payment_method: form.paymentMethod, amount_paid: perhitungan.dibayar, status: form.deliveryMethod === 'PRE_ORDER' ? 'BELUM_DIKIRIM' : 'SELESAI', custom_request: form.customRequest, notes: form.notes };
    if (await sendToSheet(isEditing ? 'update' : 'insert', payload, 'orders')) { showToast('Data penjualan disimpan!', 'success'); if (form.deliveryMethod === 'PRE_ORDER') handlePrintTiketProduksi(payload); handleCancelEdit(); }
  };

  return (
    <div className="space-y-6 pb-10 relative">
      {/* 📊 BARIS UTAMA RADAR METRIK */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900 p-5 rounded-2xl shadow-md text-white border border-slate-800">
          <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Stok Available</div>
          <div className="text-3xl font-black mt-1">{formatNumber(stockMetrics.sisaAvailable)} <span className="text-sm font-bold text-slate-400">PCS</span></div>
        </div>
        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors" onClick={() => setShowKarantinaModal(true)}>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest">PO Karantina</div>
              <div className="text-3xl font-black text-amber-700 mt-1">{formatNumber(stockMetrics.karantinaPcs)} <span className="text-sm">PCS</span></div>
            </div>
            <span className="bg-amber-200 text-amber-800 text-[9px] px-2 py-1 rounded-md font-black uppercase shadow-sm">Detail</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fisik Freezer</div>
          <div className="text-3xl font-black text-blue-600 mt-1">{formatNumber(stockMetrics.saldoFisikFreezer)} <span className="text-sm">PCS</span></div>
        </div>
        <div className="bg-rose-50 p-5 rounded-2xl border border-rose-100 shadow-sm">
          <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Stok Ayam Gudang</div>
          <div className="text-3xl font-black text-rose-700 mt-1">{formatNumber(stockMetrics.saldoAyamKg)} <span className="text-sm">KG</span></div>
        </div>
        {/* PANEL CLOSING BOS ADITYA */}
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-5 rounded-2xl shadow-lg text-white flex flex-col justify-between cursor-pointer hover:scale-[1.02] transition-transform border border-indigo-500" onClick={() => setShowClosingModal(true)}>
          <div className="text-[10px] font-black text-indigo-100 uppercase tracking-widest flex items-center justify-between">
            <span>4 Amplop Virtual</span>
            <span className="bg-white/20 text-white px-2 py-1 rounded-full text-[8px]">2 MINGGUAN</span>
          </div>
          <div className="text-lg font-black mt-2">Omzet: {formatRupiah(envelopeMetrics.totalUangMasuk2Minggu)}</div>
          <div className="text-[10px] text-indigo-200 font-bold mt-2 uppercase flex items-center gap-1"><BarChart3 size={12}/> Buka Rekap Anggaran</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* KIRI: KASIR ENTRY */}
        <div className={`p-6 rounded-3xl border shadow-sm transition-all h-max ${isEditing ? 'bg-amber-50/30 border-amber-300' : 'bg-white border-slate-200'}`}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex justify-between items-center pb-4 mb-2 border-b border-slate-100">
              <h3 className={`font-black text-sm uppercase flex items-center gap-2 ${isEditing ? 'text-amber-700' : 'text-slate-800'}`}>
                {isEditing ? <Edit2 size={18}/> : <ShoppingCart size={18} className="text-emerald-600"/>} 
                {isEditing ? 'Revisi Pesanan' : 'Buat Pesanan Baru'}
              </h3>
              {isEditing && (
                <button type="button" onClick={handleCancelEdit} className="text-[10px] border border-amber-200 px-3 py-1.5 rounded-lg font-black uppercase text-amber-700 bg-white shadow-sm flex items-center gap-1 hover:bg-amber-50">
                  <Undo size={12}/> Batal Edit
                </button>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Nama Pelanggan / Agen</label>
              <input type="text" required value={form.customerName} onChange={e=>setForm({...form, customerName: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all outline-none" placeholder="Ketik nama pembeli..." />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Kategori Jual</label>
                <select value={form.channel} onChange={e=>setForm({...form, channel: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-black bg-slate-50 focus:bg-white focus:border-emerald-400 outline-none uppercase cursor-pointer">
                  {SALES_CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Jumlah (Pcs)</label>
                <input type="number" required value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-base font-black text-center text-emerald-700 bg-slate-50 focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none" placeholder="0" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Detail Pesanan (Opsional)</label>
              <input type="text" value={form.customRequest} onChange={e=>setForm({...form, customRequest: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 focus:bg-white focus:border-emerald-400 outline-none" />
            </div>

            {selectedChannelInfo.isManual && (
              <div>
                <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-1.5">Harga Kesepakatan (Per Pcs)</label>
                <input type="number" required value={form.customPrice} onChange={e=>setForm({...form, customPrice: e.target.value})} className="w-full p-3 border border-amber-200 rounded-xl text-sm font-black bg-amber-50 outline-none focus:border-amber-400" />
              </div>
            )}

            <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200 flex gap-1">
              <button type="button" onClick={() => setForm({...form, deliveryMethod: 'DIRECT'})} className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase transition-all ${form.deliveryMethod === 'DIRECT' ? 'bg-white text-emerald-700 shadow border border-slate-200' : 'text-slate-400 hover:bg-slate-100'}`}>Bawa Langsung</button>
              <button type="button" onClick={() => setForm({...form, deliveryMethod: 'PRE_ORDER', paymentMethod: 'DP', amountPaid: ''})} className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase transition-all ${form.deliveryMethod === 'PRE_ORDER' ? 'bg-white text-amber-700 shadow border border-slate-200' : 'text-slate-400 hover:bg-slate-100'}`}>Pre-Order (PO)</button>
            </div>
            
            {/* BOX TAGIHAN MEWAH */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md relative overflow-hidden border border-slate-800">
              <div className="flex justify-between items-end relative z-10 mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Tagihan Pembeli</span>
                <span className="text-3xl font-black text-white tracking-tight">{formatRupiah(perhitungan.totalTagihan)}</span>
              </div>
              {form.qty > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-2 relative z-10">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Modal Asli Pabrik:</span>
                    <span className="text-xs font-black text-rose-300">{formatRupiah(perhitungan.hppPokok)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Prediksi Laba Kotor:</span>
                    <span className="text-xs font-black text-emerald-400">+{formatRupiah(perhitungan.profitKotor)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Cara Bayar</label>
                <div className="flex gap-1 bg-slate-200/70 p-1 rounded-lg">
                  {['CASH', 'TF', 'DP'].map(m => <button key={m} type="button" onClick={() => setForm({...form, paymentMethod: m})} className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${form.paymentMethod === m ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:bg-slate-300/50'}`}>{m}</button>)}
                </div>
              </div>
              {form.paymentMethod === 'DP' && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Uang Muka (DP) yang Dibayar</label>
                  <input type="number" required value={form.amountPaid} onChange={e=>setForm({...form, amountPaid: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-base font-black text-slate-800 bg-white outline-none focus:border-blue-400" />
                </div>
              )}
            </div>

            <button type="submit" className={`w-full text-white font-black py-4 rounded-xl text-sm uppercase tracking-widest shadow-lg transition-transform hover:scale-[1.02] active:scale-95 ${isEditing ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-gradient-to-r from-emerald-500 to-teal-600'}`}>
              {isEditing ? 'Simpan Perubahan' : 'Cetak & Simpan Pesanan'}
            </button>
          </form>
        </div>
        
        {/* KANAN: TABLE LOG JURNAL */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h4 className="font-black text-xs uppercase text-slate-700 tracking-widest">Catatan Penjualan Terakhir</h4>
          </div>
          <div className="overflow-x-auto flex-1 p-2">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] uppercase text-slate-400 bg-white">
                <tr><th className="px-4 py-3 font-black">Nota & Waktu</th><th className="px-4 py-3 font-black">Data Klien</th><th className="px-4 py-3 font-black">Barang</th><th className="px-4 py-3 font-black">Status</th><th className="px-4 py-3 font-black text-center">Tindakan</th></tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-50">
                {realOrders.filter(o => !o.isDeleted).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50).map(log => {
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-bold">{formatDate(log.date)}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">{log.id}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="uppercase font-black text-slate-800">{log.customer_name}</div>
                        <div className="text-[9px] text-blue-500 font-black uppercase mt-0.5">{log.sales_channel}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-black text-emerald-600 text-sm mb-0.5">{formatNumber(log.qty)} Pcs</div>
                        <div className="text-slate-500 text-[10px] bg-slate-100 px-2 py-0.5 rounded inline-block">{log.custom_request || 'Dimsum Mix'}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {log.delivery_method === 'PRE_ORDER' ? 
                          <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-1 rounded-md flex items-center w-max gap-1"><Lock size={10}/> Karantina</span> : 
                          <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md flex items-center w-max gap-1"><CheckCircle2 size={10}/> Lunas / Diambil</span>
                        }
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center justify-center gap-2">
                          <button type="button" onClick={() => handlePrintTiketProduksi(log)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Cetak Surat Jalan"><FileText size={16}/></button>
                          <button type="button" onClick={() => handlePrintInvoiceKlien(log)} className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Cetak Nota Harga"><Printer size={16}/></button>
                          <div className="w-px h-4 bg-slate-200 mx-1"></div>
                          <button type="button" onClick={() => handleEditSafe(log)} className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg transition-colors" title="Revisi"><Edit2 size={14}/></button>
                          <button type="button" onClick={() => { if(window.confirm("Batalkan nota ini?")) requestDelete(log.id); }} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors" title="Hapus"><Trash2 size={14}/></button>
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

      {/* 🔥 MODAL DETAILED LIST ANTREAN KARANTINA PO (YANG TADI HILANG) */}
      {showKarantinaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 bg-amber-500 text-white flex justify-between items-center shrink-0">
              <h3 className="font-black flex items-center gap-2 uppercase tracking-widest text-xs"><Lock size={16}/> Manifest Antrean PO Karantina</h3>
              <button onClick={() => setShowKarantinaModal(false)} className="hover:bg-amber-600 p-1.5 rounded-lg transition-colors"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="bg-white text-[10px] uppercase text-slate-500 border-b sticky top-0 shadow-sm z-10">
                  <tr><th className="px-4 py-3 font-black">Tanggal & INV</th><th className="px-4 py-3 font-black">Nama Pembeli</th><th className="px-4 py-3 font-black">Request</th><th className="px-4 py-3 font-black text-center">Volume Booking</th><th className="px-4 py-3 font-black text-center">Aksi</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs font-bold">
                  {stockMetrics.listKarantina.length === 0 && (<tr><td colSpan="5" className="text-center py-10 text-slate-400 font-bold">Antrean bersih. Tidak ada defisit booking.</td></tr>)}
                  {stockMetrics.listKarantina.map(k => (
                    <tr key={k.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4"><div className="text-slate-800">{formatDate(k.date)}</div><div className="text-[9px] font-mono text-slate-400 mt-0.5">{k.id}</div></td>
                      <td className="px-4 py-4 uppercase text-slate-800">{k.customer_name}</td>
                      <td className="px-4 py-4 text-rose-600 font-black uppercase text-[10px]">{k.custom_request || 'Dimsum Mix'}</td>
                      <td className="px-4 py-4 text-center"><span className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg font-black">{formatNumber(k.qty)} PCS</span></td>
                      <td className="px-4 py-4 text-center"><button type="button" onClick={() => handlePrintTiketProduksi(k)} className="p-2 bg-slate-800 text-white rounded-lg text-[10px] uppercase font-black hover:bg-slate-900 inline-flex items-center gap-1.5 transition-colors shadow-sm"><Printer size={12}/> Re-Cetak Tiket</button></td>
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
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-150">
             <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-black flex items-center gap-2 uppercase tracking-widest text-xs"><Wallet size={16} className="text-blue-400"/> Buku Anggaran 4 Amplop Virtual</h3>
              <button onClick={() => setShowClosingModal(false)} className="hover:bg-slate-800 p-1.5 rounded-lg transition-colors"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex justify-between items-center">
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Uang Masuk (2 Minggu Terakhir)</div>
                  <div className="text-4xl font-black text-slate-800 mt-1">{formatRupiah(envelopeMetrics.totalUangMasuk2Minggu)}</div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-4 bg-white rounded-xl border border-l-4 border-l-rose-500 shadow-sm">
                  <div className="text-xs font-black text-slate-600 uppercase tracking-wide">1. Uang Beli Ayam (55%)</div>
                  <div className="text-base font-black text-rose-600">{formatRupiah(envelopeMetrics.amp1_ayam)}</div>
                </div>
                <div className="p-4 bg-white rounded-xl border border-l-4 border-l-blue-500 shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="text-xs font-black text-slate-600 uppercase tracking-wide">2. Uang Operasional & Gaji (20%)</div>
                    <div className="text-base font-black text-blue-600">{formatRupiah(envelopeMetrics.amp2_ops)}</div>
                  </div>
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                      <span className="text-slate-400">Kesiapan Gaji Karyawan:</span>
                      <span className={envelopeMetrics.statusGaji === 'AMAN_RESERVE' ? 'text-emerald-500' : envelopeMetrics.statusGaji === 'CUKUP_BULAN_INI' ? 'text-amber-500' : 'text-rose-500'}>
                        {envelopeMetrics.statusGaji === 'AMAN_RESERVE' ? '🟢 AMAN + DANA CADANGAN 1 BULAN' : envelopeMetrics.statusGaji === 'CUKUP_BULAN_INI' ? '🟡 HANYA CUKUP BULAN INI' : '🔴 STATUS KRITIS'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div className={`h-full transition-all ${envelopeMetrics.statusGaji === 'AMAN_RESERVE' ? 'bg-emerald-400' : envelopeMetrics.statusGaji === 'CUKUP_BULAN_INI' ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${Math.min(100, (envelopeMetrics.amp2_ops / envelopeMetrics.targetAmanGaji) * 100)}%` }}></div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center p-4 bg-white rounded-xl border border-l-4 border-l-amber-500 shadow-sm">
                  <div className="text-xs font-black text-slate-600 uppercase tracking-wide">3. Uang Jaga-jaga Pabrik (10%)</div>
                  <div className="text-base font-black text-amber-500">{formatRupiah(envelopeMetrics.amp3_cadangan)}</div>
                </div>
                <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-xl border border-indigo-100 border-l-4 border-l-indigo-600 shadow-sm">
                  <div className="text-xs font-black text-indigo-900 uppercase tracking-wide">4. Tabungan Bersih Bos (15%)</div>
                  <div className="text-base font-black text-indigo-700">{formatRupiah(envelopeMetrics.amp4_pribadi)}</div>
                </div>
              </div>
              <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200">
                <div className="text-sm font-black text-slate-800 mb-1">👉 Pindahkan uang ini ke Rekening Pribadi: <span className="text-indigo-600">{formatRupiah(envelopeMetrics.amp4_pribadi)}</span></div>
                <div className="text-[10px] text-slate-500 font-bold leading-relaxed">Sisa uang lainnya biarkan mengendap di rekening utama pabrik agar modal belanja ayam dan gajian selalu berputar dengan aman.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
