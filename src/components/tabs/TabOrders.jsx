import React, { useState, useMemo } from 'react';
import { ShoppingCart, Package, Truck, AlertCircle, Edit2, Printer, Trash2, CalendarDays, Lock, Eye, CheckCircle2, X, FileText } from 'lucide-react';
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

export default function TabOrders({ orders = [], orders_data, productionBatches = [], production_batches, purchases = [], purchases_data, sendToSheet, showToast, user, requestDelete }) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  const [isEditing, setIsEditing] = useState(false);
  const [showKarantinaModal, setShowKarantinaModal] = useState(false);
  
  const [form, setForm] = useState({
    id: '', date: todayStr, customerName: '', channel: 'ECERAN', customPrice: 3000, qty: '',
    deliveryMethod: 'DIRECT', shippingFee: 0, paymentMethod: 'CASH', amountPaid: '', notes: '',
    customRequest: 'STANDAR MIX (SIOMAY, HAKAU, DLL)' 
  });

  const selectedChannelInfo = useMemo(() => SALES_CHANNELS.find(c => c.id === form.channel) || SALES_CHANNELS[0], [form.channel]);

  const stockMetrics = useMemo(() => {
    let totalMasukFreezer = 0; let totalKeluarFreezer = 0; let totalAyamMasukKg = 0; let totalAyamKeluarKg = 0; let karantinaPcs = 0; let listKarantina = [];
    const realPurchases = purchases_data || purchases || [];
    const realProd = production_batches || productionBatches || [];
    const realOrders = orders_data || orders || [];

    realPurchases.filter(p => !p.isDeleted && p.category === 'BAHAN_BAKU' && (p.branch_id === currentBranch || p.branch_id === 'PUSAT')).forEach(p => { totalAyamMasukKg += Number(p.qty_kg || 0); });
    realProd.filter(p => !p.isDeleted && (p.branch_id === currentBranch || p.branch_id === 'PUSAT')).forEach(p => { totalMasukFreezer += Number(p.total_yield_pcs || 0); totalAyamKeluarKg += Number(p.total_ayam_kg || 0); });
    realOrders.filter(o => !o.isDeleted && (o.branch_id === currentBranch || o.branch_id === 'PUSAT')).forEach(o => {
      const qty = Number(o.qty || 0);
      if (o.delivery_method === 'PRE_ORDER' && o.status !== 'SELESAI') { karantinaPcs += qty; listKarantina.push(o); } else { totalKeluarFreezer += qty; }
    });
    const saldoFisikFreezer = totalMasukFreezer - totalKeluarFreezer;
    return { saldoFisikFreezer, karantinaPcs, sisaAvailable: saldoFisikFreezer - karantinaPcs, saldoAyamKg: Math.max(0, totalAyamMasukKg - totalAyamKeluarKg), listKarantina: listKarantina.sort((a,b) => new Date(a.date) - new Date(b.date)) };
  }, [orders, orders_data, productionBatches, production_batches, purchases, purchases_data, currentBranch]);

  const perhitungan = useMemo(() => {
    const qty = Number(form.qty || 0);
    const hargaSatuan = selectedChannelInfo.isManual ? Number(form.customPrice || 0) : selectedChannelInfo.price;
    const totalTagihan = (qty * hargaSatuan) + Number(form.shippingFee || 0);
    return { hargaSatuan, subtotal: qty * hargaSatuan, totalTagihan, dibayar: form.paymentMethod === 'DP' ? Number(form.amountPaid || 0) : totalTagihan };
  }, [form, selectedChannelInfo]);

  const handlePrintTiketProduksi = (log) => {
    const rahasiaData = `@@WORK_ORDER@@||${log.sales_channel}||${log.custom_request || 'STANDAR MIX'}||${log.notes || '-'}`;
    triggerPrint('NOTA_DOTMATRIX', {
      title: 'WORK ORDER & MANIFEST PABRIK',
      id: log.id, date: formatDate(log.date), branch_name: log.branch_id || currentBranch,
      admin_name: user?.name || 'KASIR', customer_name: log.customer_name?.toUpperCase(),
      items: [{ name: rahasiaData, qty: log.qty, subtotal: 0 }],
      paymentMethod: log.delivery_method === 'PRE_ORDER' ? 'ANTREAN PRE-ORDER' : 'PENGAMBILAN LANGSUNG'
    });
  };

  const handlePrintInvoiceKlien = (log) => {
    const sisaUtang = Number(log.total_amount) - Number(log.amount_paid);
    const textPembayaran = sisaUtang > 0 ? `BELUM LUNAS (SISA: ${formatRupiah(sisaUtang)})` : `LUNAS (${log.payment_method})`;
    triggerPrint('NOTA_DOTMATRIX', {
      title: 'INVOICE PENJUALAN',
      id: log.id, date: formatDate(log.date), branch_name: log.branch_id || currentBranch,
      admin_name: user?.name || 'KASIR', customer_name: log.customer_name?.toUpperCase(),
      items: [{ name: `DIMSUM FROZEN (${log.sales_channel})\nREQ: ${log.custom_request || 'STANDAR MIX'}`, qty: log.qty, subtotal: log.subtotal, suffix: ' Pcs' }],
      amount: log.total_amount, paymentMethod: textPembayaran
    });
  };

  // LOGIKA EDIT ANTI-CRASH
  const handleEditSafe = (log) => {
    try {
      setForm({
        id: log.id || '', 
        date: log.date ? String(log.date).substring(0, 10) : todayStr, 
        customerName: log.customer_name || '', 
        channel: log.sales_channel || 'ECERAN', 
        customPrice: log.unit_price || 0, 
        qty: log.qty || '', 
        deliveryMethod: log.delivery_method || 'DIRECT', 
        shippingFee: log.shipping_fee || 0, 
        paymentMethod: log.payment_method || 'CASH', 
        amountPaid: log.amount_paid !== undefined ? log.amount_paid : (log.total_amount || 0), 
        notes: log.notes || '', 
        customRequest: log.custom_request || 'STANDAR MIX (SIOMAY, HAKAU, DLL)'
      });
      setIsEditing(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      alert('Gagal memuat data edit. Pastikan format transaksi valid.');
    }
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
      setForm({ id: '', date: todayStr, customerName: '', channel: 'ECERAN', customPrice: 3000, qty: '', deliveryMethod: 'DIRECT', shippingFee: 0, paymentMethod: 'CASH', amountPaid: '', notes: '', customRequest: 'STANDAR MIX (SIOMAY, HAKAU, DLL)' });
      setIsEditing(false);
    }
  };

  const realOrders = orders_data || orders || [];

  return (
    <div className="space-y-6 pb-10 relative">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-white">
          <div className="text-[10px] font-black text-emerald-400 uppercase">Stok Available</div>
          <div className="text-3xl font-black mt-1">{formatNumber(stockMetrics.sisaAvailable)} <span className="text-xs">PCS</span></div>
        </div>
        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 cursor-pointer" onClick={() => setShowKarantinaModal(true)}>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] font-black text-amber-600 uppercase">Di-Booking (Karantina)</div>
              <div className="text-3xl font-black text-amber-700 mt-1">{formatNumber(stockMetrics.karantinaPcs)} <span className="text-xs">PCS</span></div>
            </div>
            <span className="bg-amber-200 text-amber-800 text-[9px] px-2 py-0.5 rounded font-black uppercase">Detail</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-l-4 border-l-blue-500">
          <div className="text-[10px] font-black text-slate-400 uppercase">Fisik Freezer</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{formatNumber(stockMetrics.saldoFisikFreezer)} <span className="text-xs">PCS</span></div>
        </div>
        <div className="bg-rose-50 p-5 rounded-2xl border border-l-4 border-l-rose-500">
          <div className="text-[10px] font-black text-rose-500 uppercase">Stok Ayam Gudang</div>
          <div className="text-2xl font-black text-rose-700 mt-1">{formatNumber(stockMetrics.saldoAyamKg)} <span className="text-xs">KG</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl border bg-white border-t-emerald-600 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="font-black text-sm uppercase text-slate-800">Order Management &amp; Billing</h3>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Nama Pelanggan</label>
              <input type="text" required value={form.customerName} onChange={e=>setForm({...form, customerName: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs font-bold uppercase" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Channel</label>
                <select value={form.channel} onChange={e=>setForm({...form, channel: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs font-black bg-white uppercase">
                  <optgroup label="Offline">
                    {SALES_CHANNELS.filter(c => c.group === 'OFFLINE').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </optgroup>
                  <optgroup label="Marketplace">
                    {SALES_CHANNELS.filter(c => c.group === 'MARKETPLACE').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </optgroup>
                  <optgroup label="Merchant">
                    {SALES_CHANNELS.filter(c => c.group === 'MERCHANT').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Qty (Pcs)</label>
                <input type="number" required value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm font-black text-center" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-rose-600 uppercase block mb-1">⚠️ Request Khusus Produksi</label>
              <input type="text" required value={form.customRequest} onChange={e=>setForm({...form, customRequest: e.target.value})} className="w-full p-2.5 border-2 border-rose-200 rounded-xl text-xs font-black uppercase bg-rose-50/20" />
            </div>
            {selectedChannelInfo.isManual && (
              <div>
                <label className="text-[10px] font-black text-amber-700 uppercase block mb-1">Harga Manual/Pcs</label>
                <input type="number" required value={form.customPrice} onChange={e=>setForm({...form, customPrice: e.target.value})} className="w-full p-2 border border-amber-300 rounded-lg text-sm font-black" />
              </div>
            )}
            <div className="bg-slate-50 p-3 rounded-xl border">
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Metode Serah Terima</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm({...form, deliveryMethod: 'DIRECT'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${form.deliveryMethod === 'DIRECT' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-white border'}`}>Direct</button>
                <button type="button" onClick={() => setForm({...form, deliveryMethod: 'PRE_ORDER', paymentMethod: 'DP', amountPaid: ''})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${form.deliveryMethod === 'PRE_ORDER' ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-white border'}`}>Pre-Order (PO)</button>
              </div>
            </div>
            <div className="bg-slate-900 text-white p-4 rounded-xl">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black uppercase text-emerald-400">Total Tagihan Bill</span>
                <span className="text-2xl font-black">{formatRupiah(perhitungan.totalTagihan)}</span>
              </div>
            </div>
            <div className="p-4 rounded-xl border bg-white">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-slate-700">Metode Pembayaran</label>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                  {['CASH', 'TF', 'DP'].map(m => <button key={m} type="button" onClick={() => setForm({...form, paymentMethod: m})} className={`px-2.5 py-1 rounded text-[10px] font-black ${form.paymentMethod === m ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>{m}</button>)}
                </div>
              </div>
              {form.paymentMethod === 'DP' && (
                <div className="mt-3 pt-3 border-t border-dashed">
                  <label className="text-[10px] font-black text-amber-700 block mb-1">Nominal Setoran DP</label>
                  <input type="number" required value={form.amountPaid} onChange={e=>setForm({...form, amountPaid: e.target.value})} className="w-full p-2 border border-amber-300 text-right font-black text-amber-700 bg-amber-50/20" />
                </div>
              )}
            </div>
            <button type="submit" className="w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest bg-emerald-600">Simpan &amp; Cetak Tiket</button>
          </form>
        </div>
        
        <div className="lg:col-span-2 bg-white rounded-2xl border flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b"><h4 className="font-black text-xs uppercase text-slate-700">Log Jurnal Penjualan</h4></div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b">
                <tr><th>Invoice</th><th>Klien</th><th>Request</th><th>Fulfillment</th><th className="text-center">Aksi Dokumen</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold">
                {realOrders.filter(o => !o.isDeleted).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50).map(log => {
                  return (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap"><div>{formatDate(log.date)}</div><div className="text-[9px] font-mono text-slate-400">{log.id}</div></td>
                      <td className="px-4 py-3 whitespace-nowrap"><div className="uppercase font-black text-slate-700">{log.customer_name}</div><div className="text-[9px] text-indigo-500 uppercase">{log.sales_channel} • {formatNumber(log.qty)} PCS</div></td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700 uppercase font-black text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-rose-200 text-rose-700">{log.custom_request || 'STANDAR MIX'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className={`text-[9px] font-black uppercase ${log.delivery_method === 'PRE_ORDER' ? 'text-amber-600' : 'text-emerald-600'}`}>{log.delivery_method === 'PRE_ORDER' ? '🔒 PO KARANTINA' : '✅ DIRECT'}</div>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* TOMBOL CETAK */}
                          <button type="button" onClick={() => handlePrintTiketProduksi(log)} className="p-1.5 px-2 bg-rose-600 text-white rounded font-black uppercase flex items-center gap-1 text-[10px]"><FileText size={10}/> Tiket</button>
                          <button type="button" onClick={() => handlePrintInvoiceKlien(log)} className="p-1.5 px-2 bg-blue-600 text-white rounded font-black uppercase flex items-center gap-1 text-[10px]"><Printer size={10}/> Nota</button>
                          
                          {/* TOMBOL EDIT & HAPUS DIPERBESAR */}
                          <button type="button" onClick={() => handleEditSafe(log)} className="p-1.5 px-2 bg-amber-50 border border-amber-200 text-amber-600 rounded flex items-center gap-1 font-black text-[10px] uppercase"><Edit2 size={12}/> Edit</button>
                          <button type="button" onClick={() => { if(window.confirm("Void?")) requestDelete(log.id); }} className="p-1.5 px-2 bg-rose-50 border border-rose-200 text-rose-600 rounded flex items-center gap-1 font-black text-[10px] uppercase"><Trash2 size={12}/> Void</button>
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
    </div>
  );
}
