import React, { useState, useMemo } from 'react';
import { ShoppingCart, Package, Truck, AlertCircle, Edit2, Printer, Trash2, CalendarDays, Lock, Eye, CheckCircle2, X, FileText, Undo, Wallet, BarChart3 } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');
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
  const [showClosingModal, setShowClosingModal] = useState(false); // Modal Closing 2 Mingguan
  
  const [form, setForm] = useState({
    id: '', date: todayStr, customerName: '', channel: 'ECERAN', customPrice: 2000, qty: '',
    deliveryMethod: 'DIRECT', shippingFee: 0, paymentMethod: 'CASH', amountPaid: '', notes: '',
    customRequest: 'STANDAR MIX (SIOMAY, HAKAU, DLL)' 
  });

  const selectedChannelInfo = useMemo(() => SALES_CHANNELS.find(c => c.id === form.channel) || SALES_CHANNELS[0], [form.channel]);

  // --- ENGINE DATA TRANSAKSI ---
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

  // --- LOGIKA ALOKASI 4 AMPLOP VIRTUAL CLOSING 2 MINGGUAN ---
  const envelopeMetrics = useMemo(() => {
    let totalUangMasuk2Minggu = 0;
    const tanggalBatas = new Date();
    tanggalBatas.setDate(tanggalBatas.getDate() - 14); // Filter strict 2 minggu ke belakang

    realOrders.filter(o => !o.isDeleted && new Date(o.date) >= tanggalBatas && (o.branch_id === currentBranch || o.branch_id === 'PUSAT')).forEach(o => {
      totalUangMasuk2Minggu += Number(o.amount_paid || o.total_amount || 0);
    });

    const KEWAJIBAN_GAJI_SEBULAN = 25000000; // Master budget gaji seluruh cabang
    const TARGET_AMAN_GAJI_RESERVE = KEWAJIBAN_GAJI_SEBULAN * 2; // Bulan ini + 1 Bulan kedepan (Req Bos)

    const amp1_ayam = totalUangMasuk2Minggu * 0.55;
    const amp2_ops = totalUangMasuk2Minggu * 0.20;
    const amp3_cadangan = totalUangMasuk2Minggu * 0.10;
    const amp4_pribadi = totalUangMasuk2Minggu * 0.15;

    // Hitung status kecukupan gaji bulanan
    let statusGaji = 'KRITIS';
    if (amp2_ops >= TARGET_AMAN_GAJI_RESERVE) statusGaji = 'AMAN_RESERVE';
    else if (amp2_ops >= KEWAJIBAN_GAJI_SEBULAN) statusGaji = 'CUKUP_BULAN_INI';

    return {
      totalUangMasuk2Minggu, amp1_ayam, amp2_ops, amp3_cadangan, amp4_pribadi,
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
    const rahasiaData = `@@WORK_ORDER@@||${log.sales_channel}||${log.custom_request || 'STANDAR MIX'}||${log.notes || '-'}`;
    triggerPrint('NOTA_DOTMATRIX', {
      title: 'WORK ORDER & MANIFEST PABRIK', id: log.id, date: formatDate(log.date), branch_name: log.branch_id || currentBranch,
      admin_name: user?.name || 'KASIR', customer_name: log.customer_name?.toUpperCase(),
      items: [{ name: rahasiaData, qty: log.qty, subtotal: 0 }], paymentMethod: log.delivery_method === 'PRE_ORDER' ? 'ANTREAN PRE-ORDER' : 'PENGAMBILAN LANGSUNG'
    });
  };

  const handlePrintInvoiceKlien = (log) => {
    const sisaUtang = Number(log.total_amount) - Number(log.amount_paid);
    const textPembayaran = sisaUtang > 0 ? `BELUM LUNAS (SISA: ${formatRupiah(sisaUtang)})` : `LUNAS (${log.payment_method})`;
    triggerPrint('NOTA_DOTMATRIX', {
      title: 'INVOICE PENJUALAN', id: log.id, date: formatDate(log.date), branch_name: log.branch_id || currentBranch,
      admin_name: user?.name || 'KASIR', customer_name: log.customer_name?.toUpperCase(),
      items: [{ name: `DIMSUM FROZEN (${log.sales_channel})\nREQ: ${log.custom_request || 'STANDAR MIX'}`, qty: log.qty, subtotal: log.subtotal, suffix: ' Pcs' }],
      amount: log.total_amount, paymentMethod: textPembayaran
    });
  };

  const handleEditSafe = (log) => {
    try {
      setForm({
        id: log.id || '', date: log.date ? String(log.date).substring(0, 10) : todayStr, customerName: log.customer_name || '', channel: log.sales_channel || 'ECERAN', 
        customPrice: log.unit_price || 0, qty: log.qty || '', deliveryMethod: log.delivery_method || 'DIRECT', shippingFee: log.shipping_fee || 0, 
        paymentMethod: log.payment_method || 'CASH', amountPaid: log.amount_paid !== undefined ? log.amount_paid : (log.total_amount || 0), notes: log.notes || '', customRequest: log.custom_request || 'STANDAR MIX (SIOMAY, HAKAU, DLL)'
      });
      setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { alert('Gagal memuat data edit. Pastikan format transaksi valid.'); }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setForm({ id: '', date: todayStr, customerName: '', channel: 'ECERAN', customPrice: 2000, qty: '', deliveryMethod: 'DIRECT', shippingFee: 0, paymentMethod: 'CASH', amountPaid: '', notes: '', customRequest: 'STANDAR MIX (SIOMAY, HAKAU, DLL)' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Number(form.qty) <= 0) return alert("Jumlah beli harus lebih dari 0!");
    const trxId = isEditing ? form.id : generateId('INV', form.date);
    const payload = {
      id: trxId, date: form.date, branch_id: currentBranch, customer_name: form.customerName.toUpperCase(), sales_channel: form.channel,
      qty: Number(form.qty), unit_price: perhitungan.hargaSatuan, delivery_method: form.deliveryMethod, shipping_fee: Number(form.shippingFee),
      subtotal: perhitungan.subtotal, total_amount: perhitungan.totalTagihan, payment_method: form.paymentMethod, amount_paid: perhitungan.dibayar,
      status: form.deliveryMethod === 'PRE_ORDER' ? 'BELUM_DIKIRIM' : 'SELESAI', custom_request: form.customRequest.toUpperCase(), notes: form.notes.toUpperCase()
    };
    if (await sendToSheet(isEditing ? 'update' : 'insert', payload, 'orders')) {
      showToast('Data penjualan disimpan!', 'success');
      if (form.deliveryMethod === 'PRE_ORDER') handlePrintTiketProduksi(payload);
      handleCancelEdit();
    }
  };

  return (
    <div className="space-y-6 pb-10 relative">
      {/* 📊 BARIS UTAMA RADAR METRIK */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-white">
          <div className="text-[10px] font-black text-emerald-400 uppercase">Stok Available</div>
          <div className="text-2xl font-black mt-0.5">{formatNumber(stockMetrics.sisaAvailable)} <span className="text-xs">PCS</span></div>
        </div>
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 cursor-pointer" onClick={() => setShowKarantinaModal(true)}>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] font-black text-amber-600 uppercase">PO Karantina</div>
              <div className="text-2xl font-black text-amber-700 mt-0.5">{formatNumber(stockMetrics.karantinaPcs)} <span className="text-xs">PCS</span></div>
            </div>
            <span className="bg-amber-200 text-amber-800 text-[8px] px-1.5 py-0.5 rounded font-black uppercase">Detail</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-l-4 border-l-blue-500">
          <div className="text-[10px] font-black text-slate-400 uppercase">Fisik Freezer</div>
          <div className="text-2xl font-black text-blue-600 mt-0.5">{formatNumber(stockMetrics.saldoFisikFreezer)} <span className="text-xs">PCS</span></div>
        </div>
        <div className="bg-rose-50 p-4 rounded-xl border border-l-4 border-l-rose-500">
          <div className="text-[10px] font-black text-rose-500 uppercase">Stok Ayam Gudang</div>
          <div className="text-2xl font-black text-rose-700 mt-0.5">{formatNumber(stockMetrics.saldoAyamKg)} <span className="text-xs">KG</span></div>
        </div>
        {/* 🔥 PANEL CLOSING SHORTCUT BOS ADITYA */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-4 rounded-xl shadow-md text-white flex flex-col justify-between cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => setShowClosingModal(true)}>
          <div className="text-[10px] font-black text-blue-100 uppercase tracking-wider flex items-center justify-between">
            <span>Buku 4 Amplop Virtual</span>
            <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-[8px]">2 MINGGUAN</span>
          </div>
          <div className="text-sm font-black mt-1">Omzet: {formatRupiah(envelopeMetrics.totalUangMasuk2Minggu)}</div>
          <div className="text-[9px] text-blue-200 font-bold mt-1 uppercase flex items-center gap-1"><BarChart3 size={10}/> Klik Rekap Anggaran</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KIRI: KASIR ENTRY */}
        <div className={`p-6 rounded-2xl border shadow-sm transition-all h-max ${isEditing ? 'bg-amber-50/50 border-t-4 border-t-amber-500 border-amber-200' : 'bg-white border-t-4 border-t-emerald-600'}`}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-2">
              <h3 className={`font-black text-sm uppercase flex items-center gap-2 ${isEditing ? 'text-amber-700' : 'text-slate-800'}`}>
                {isEditing ? <Edit2 size={16}/> : <ShoppingCart size={16} className="text-emerald-600"/>} 
                {isEditing ? 'Revisi Invoice' : 'Order Management & Billing'}
              </h3>
              {isEditing && (
                <button type="button" onClick={handleCancelEdit} className="text-[10px] border border-amber-200 px-2.5 py-1 rounded-lg font-black uppercase text-amber-700 bg-white shadow-sm flex items-center gap-1 hover:bg-amber-100">
                  <Undo size={12}/> Batal Edit
                </button>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Nama Pelanggan / Agen</label>
              <input type="text" required value={form.customerName} onChange={e=>setForm({...form, customerName: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs font-bold uppercase bg-white outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Channel Distribusi</label>
                <select value={form.channel} onChange={e=>setForm({...form, channel: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs font-black bg-white uppercase cursor-pointer outline-none">
                  <optgroup label="Offline Nodes">
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
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Qty (Pcs)</label>
                <input type="number" required value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm font-black text-center text-emerald-700 outline-none" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-rose-600 uppercase block mb-1">⚠️ Request Khusus Produksi</label>
              <input type="text" required value={form.customRequest} onChange={e=>setForm({...form, customRequest: e.target.value})} className="w-full p-2.5 border-2 border-rose-200 rounded-xl text-xs font-black uppercase bg-rose-50/10 outline-none" />
            </div>
            {selectedChannelInfo.isManual && (
              <div>
                <label className="text-[10px] font-black text-amber-700 uppercase block mb-1">Harga Manual/Pcs</label>
                <input type="number" required value={form.customPrice} onChange={e=>setForm({...form, customPrice: e.target.value})} className="w-full p-2 border border-amber-300 rounded-lg text-sm font-black outline-none" />
              </div>
            )}
            <div className="bg-slate-50 p-3 rounded-xl border">
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Metode Serah Terima</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm({...form, deliveryMethod: 'DIRECT'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${form.deliveryMethod === 'DIRECT' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-sm' : 'bg-white border text-slate-400'}`}>Direct</button>
                <button type="button" onClick={() => setForm({...form, deliveryMethod: 'PRE_ORDER', paymentMethod: 'DP', amountPaid: ''})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${form.deliveryMethod === 'PRE_ORDER' ? 'bg-amber-100 text-amber-700 border border-amber-300 shadow-sm' : 'bg-white border text-slate-400'}`}>Pre-Order (PO)</button>
              </div>
            </div>
            
            <div className="bg-slate-900 text-white p-4 rounded-xl shadow-inner relative overflow-hidden">
              <div className="flex justify-between items-end relative z-10">
                <span className="text-[10px] font-black uppercase text-emerald-400">Total Tagihan Bill</span>
                <span className="text-2xl font-black">{formatRupiah(perhitungan.totalTagihan)}</span>
              </div>
              {form.qty > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700 space-y-1 relative z-10">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase text-slate-400">Estimasi Modal (HPP Ayam):</span>
                    <span className="text-xs font-black text-orange-400">{formatRupiah(perhitungan.hppPokok)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase text-slate-400">Estimasi Cuan Kotor:</span>
                    <span className="text-xs font-black text-emerald-400">+{formatRupiah(perhitungan.profitKotor)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border bg-white">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-slate-700">Metode Pembayaran</label>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                  {['CASH', 'TF', 'DP'].map(m => <button key={m} type="button" onClick={() => setForm({...form, paymentMethod: m})} className={`px-2.5 py-1 rounded text-[10px] font-black transition-all ${form.paymentMethod === m ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>{m}</button>)}
                </div>
              </div>
              {form.paymentMethod === 'DP' && (
                <div className="mt-3 pt-3 border-t border-dashed">
                  <label className="text-[10px] font-black text-amber-700 block mb-1">Nominal Setoran DP</label>
                  <input type="number" required value={form.amountPaid} onChange={e=>setForm({...form, amountPaid: e.target.value})} className="w-full p-2 border border-amber-300 text-right font-black text-amber-700 bg-amber-50/20 outline-none" />
                </div>
              )}
            </div>
            <button type="submit" className={`w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg ${isEditing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {isEditing ? 'Simpan Revisi' : 'Simpan &amp; Cetak Tiket'}
            </button>
          </form>
        </div>
        
        {/* KANAN: TABLE LOG JURNAL */}
        <div className="lg:col-span-2 bg-white rounded-2xl border flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b"><h4 className="font-black text-xs uppercase text-slate-700 tracking-widest">Log Jurnal Penjualan</h4></div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b">
                <tr><th>Invoice</th><th>Klien</th><th>Request</th><th>Fulfillment</th><th className="text-center">Aksi Dokumen</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold">
                {realOrders.filter(o => !o.isDeleted).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50).map(log => {
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap"><div>{formatDate(log.date)}</div><div className="text-[9px] font-mono text-slate-400">{log.id}</div></td>
                      <td className="px-4 py-3 whitespace-nowrap"><div className="uppercase font-black text-slate-700">{log.customer_name}</div><div className="text-[9px] text-indigo-500 uppercase font-black">{log.sales_channel} • {formatNumber(log.qty)} PCS</div></td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700 uppercase font-black text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-rose-200 text-rose-700">{log.custom_request || 'STANDAR MIX'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className={`text-[9px] font-black uppercase ${log.delivery_method === 'PRE_ORDER' ? 'text-amber-600' : 'text-emerald-600'}`}>{log.delivery_method === 'PRE_ORDER' ? '🔒 PO KARANTINA' : '✅ DIRECT'}</div>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button type="button" onClick={() => handlePrintTiketProduksi(log)} className="p-1.5 px-2 bg-rose-600 text-white rounded font-black uppercase text-[10px] shadow-sm"><FileText size={10}/> Tiket</button>
                          <button type="button" onClick={() => handlePrintInvoiceKlien(log)} className="p-1.5 px-2 bg-blue-600 text-white rounded font-black uppercase text-[10px] shadow-sm"><Printer size={10}/> Nota</button>
                          <button type="button" onClick={() => handleEditSafe(log)} className="p-1.5 px-2 bg-amber-50 border border-amber-200 text-amber-600 rounded font-black text-[10px] uppercase"><Edit2 size={10}/> Edit</button>
                          <button type="button" onClick={() => { if(window.confirm("Void?")) requestDelete(log.id); }} className="p-1.5 px-2 bg-rose-50 border border-rose-200 text-rose-600 rounded font-black text-[10px] uppercase"><Trash2 size={10}/> Void</button>
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

      {/* 🔥 MODAL 4 AMPLOP VIRTUAL & CLOSING 2 MINGGUAN (REQ BOS ADITYA) */}
      {showClosingModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-black flex items-center gap-2 uppercase tracking-widest text-xs"><Wallet size={16} className="text-blue-400"/> Buku Anggaran 4 Amplop &amp; Rekap 2 Mingguan</h3>
              <button onClick={() => setShowClosingModal(false)} className="hover:bg-slate-800 p-1 rounded-lg"><X size={20}/></button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border flex justify-between items-center">
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Akumulasi Omzet Masuk (2 Minggu Terakhir)</div>
                  <div className="text-3xl font-black text-slate-900 mt-1">{formatRupiah(envelopeMetrics.totalUangMasuk2Minggu)}</div>
                </div>
                <div className="text-right text-xs font-bold text-slate-500 uppercase">Periode Berjalan<br/>1 Bulan / 2x Closing</div>
              </div>

              {/* DAFTAR 4 AMPLOP */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-l-4 border-l-rose-500">
                  <div className="text-xs font-black text-slate-700">1. Amplop Virtual Beli Ayam (55%)</div>
                  <div className="text-sm font-black text-rose-600">{formatRupiah(envelopeMetrics.amp1_ayam)}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-l-4 border-l-blue-500 space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="text-xs font-black text-slate-700">2. Amplop Operasional &amp; Gaji Karyawan (20%)</div>
                    <div className="text-sm font-black text-blue-600">{formatRupiah(envelopeMetrics.amp2_ops)}</div>
                  </div>
                  {/* BAR CHECK KECUKUPAN GAJI + CADANGAN 1 BULAN KEDEPAN */}
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                      <span>Status Kelayakan Gaji Karyawan:</span>
                      <span className={envelopeMetrics.statusGaji === 'AMAN_RESERVE' ? 'text-emerald-600' : envelopeMetrics.statusGaji === 'CUKUP_BULAN_INI' ? 'text-amber-600' : 'text-rose-600'}>
                        {envelopeMetrics.statusGaji === 'AMAN_RESERVE' ? '🟢 AMAN + DANA CADANGAN 1 BULAN' : envelopeMetrics.statusGaji === 'CUKUP_BULAN_INI' ? '🟡 HANYA CUKUP BULAN INI' : '🔴 STATUS KRITIS (OMZET KURANG)'}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div className={`h-full transition-all ${envelopeMetrics.statusGaji === 'AMAN_RESERVE' ? 'bg-emerald-500' : envelopeMetrics.statusGaji === 'CUKUP_BULAN_INI' ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, (envelopeMetrics.amp2_ops / envelopeMetrics.targetAmanGaji) * 100)}%` }}></div>
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold mt-1">Kebutuhan Aman (Bulan ini + Bulan depan): {formatRupiah(envelopeMetrics.targetAmanGaji)}</div>
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-l-4 border-l-amber-500">
                  <div className="text-xs font-black text-slate-700">3. Amplop Dana Cadangan &amp; Investasi (10%)</div>
                  <div className="text-sm font-black text-amber-600">{formatRupiah(envelopeMetrics.amp3_cadangan)}</div>
                </div>

                <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-xl border border-indigo-200 border-l-4 border-l-indigo-600">
                  <div className="text-xs font-black text-indigo-800">4. Amplop Laba Bersih / Tabungan Bos (15%)</div>
                  <div className="text-sm font-black text-indigo-700">{formatRupiah(envelopeMetrics.amp4_pribadi)}</div>
                </div>
              </div>

              {/* ⚠️ INSTRUKSI PINDAH BUKU PINTO KELUAR ATM (REQ STRICT BOS ADITYA) */}
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-300 space-y-1.5">
                <h4 className="font-black text-amber-800 text-xs uppercase tracking-wider flex items-center gap-1">📋 PANDUAN PINDAH BUKU REKENING (CLOSING 2 MINGGUAN)</h4>
                <div className="text-base font-black text-slate-900 mt-1">
                  👉 PINDAHKAN KE TABUNGAN PRIBADI (15%): <span className="text-xl font-black text-indigo-700 underline">{formatRupiah(envelopeMetrics.amp4_pribadi)}</span>
                </div>
                <div className="text-[10px] text-slate-600 font-black uppercase tracking-tight leading-relaxed pt-2 border-t border-amber-200">
                  🚫 Dilarang keras memisahkan uang lainnya! Sisa dana sebesar 85% ({formatRupiah(envelopeMetrics.amp1_ayam + envelopeMetrics.amp2_ops + envelopeMetrics.amp3_cadangan)}) WAJIB TETAP DI REKENING UTAMA agar modal belanja ayam, operasional bulanan, dan cadangan gajian terkumpul menggunung!
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETAILED LIST ANTREAN KARANTINA PO */}
      {showKarantinaModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 bg-amber-500 text-white flex justify-between items-center shrink-0">
              <h3 className="font-black flex items-center gap-2 uppercase tracking-widest text-xs"><Lock size={14}/> Manifest Antrean PO Karantina</h3>
              <button onClick={() => setShowKarantinaModal(false)} className="hover:bg-amber-600 p-1 rounded-lg"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b sticky top-0 shadow-sm z-10">
                  <tr><th>Tanggal &amp; ID INV</th><th>Nama Pembeli</th><th>Spesifikasi Request</th><th className="text-center">Volume Booking</th><th className="text-center">Aksi</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold">
                  {stockMetrics.listKarantina.length === 0 && (<tr><td colSpan="5" className="text-center py-10 text-slate-400 font-bold">Antrean bersih. Tidak ada defisit booking.</td></tr>)}
                  {stockMetrics.listKarantina.map(k => (
                    <tr key={k.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3"><div>{formatDate(k.date)}</div><div className="text-[9px] font-mono text-slate-400">{k.id}</div></td>
                      <td className="px-4 py-3 uppercase text-slate-700">{k.customer_name}</td>
                      <td className="px-4 py-3 text-rose-700 font-black uppercase text-[10px]">{k.custom_request || 'STANDAR MIX'}</td>
                      <td className="px-4 py-3 text-center"><span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-lg font-black">{formatNumber(k.qty)} PCS</span></td>
                      <td className="px-4 py-3 text-center"><button type="button" onClick={() => handlePrintTiketProduksi(k)} className="p-1 px-2 bg-slate-800 text-white rounded text-[9px] uppercase font-black hover:bg-slate-900 inline-flex items-center gap-1"><Printer size={10}/> Re-Cetak Tiket</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
