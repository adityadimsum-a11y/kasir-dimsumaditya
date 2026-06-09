import React, { useState, useMemo } from 'react';
import { ShoppingCart, Package, Truck, CalendarDays, CreditCard, User, AlertCircle, CheckCircle2, FileText, Printer, Lock, Unlock, Clock, TrendingUp, DollarSign } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

// HARGA MASTER DIMSUM ADITYA
const PRICING = {
  MITRA: 2000,
  RESELLER: 2125,
  ECERAN: 3000
};

export default function TabPenjualan({ 
  salesOrders = [], sales_orders, 
  productionBatches = [], production_batches, 
  sendToSheet, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'PUSAT';
  
  const realSalesOrders = sales_orders || salesOrders || [];
  const realProductionBatches = production_batches || productionBatches || [];
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState(new Set());

  // STATE FORM INPUT POS
  const [form, setForm] = useState({
    date: todayStr, customerName: '', customerType: 'ECERAN', 
    qtyPcs: '', fulfillmentType: 'DIRECT', deliveryDate: todayStr, 
    karantinaStatus: 'LOCKED', shippingCost: '0', amountPaid: '', paymentMethod: 'CASH', notes: ''
  });

  // 1. KALKULATOR HARGA & PIUTANG OTOMATIS
  const calc = useMemo(() => {
    const qty = Number(form.qtyPcs || 0);
    const hargaSatuan = PRICING[form.customerType] || 0;
    const subtotal = qty * hargaSatuan;
    const ongkir = Number(form.shippingCost || 0);
    const grandTotal = subtotal + ongkir;
    const dibayar = Number(form.amountPaid || 0);
    const sisaPiutang = Math.max(0, grandTotal - dibayar);
    
    let paymentStatus = 'BELUM BAYAR';
    if (dibayar >= grandTotal && grandTotal > 0) paymentStatus = 'LUNAS';
    else if (dibayar > 0) paymentStatus = 'DP / SEBAGIAN';

    return { hargaSatuan, subtotal, ongkir, grandTotal, dibayar, sisaPiutang, paymentStatus };
  }, [form.qtyPcs, form.customerType, form.shippingCost, form.amountPaid]);

  // 2. RADAR STOK GUDANG (ANTI PHANTOM STOCK)
  const metrikStok = useMemo(() => {
    let totalFisikMasuk = 0;
    let totalFisikKeluar = 0;
    let totalKarantina = 0;

    // Hitung Barang Jadi dari Pabrik
    realProductionBatches.forEach(p => {
      if (!p.isDeleted && !optimisticDeletedIds.has(p.id)) {
        totalFisikMasuk += Number(p.total_yield_pcs || 0);
      }
    });

    // Hitung Barang Keluar & Karantina dari Data Penjualan
    realSalesOrders.forEach(s => {
      if (!s.isDeleted && !optimisticDeletedIds.has(s.id)) {
        const qty = Number(s.qty_pcs || 0);
        if (s.fulfillment_status === 'DIAMBIL_FISIK') {
          totalFisikKeluar += qty;
        } else if (s.fulfillment_status === 'DIKARANTINA') {
          totalKarantina += qty;
        }
      }
    });

    const stokFisikGudang = totalFisikMasuk - totalFisikKeluar;
    const stokBebas = stokFisikGudang - totalKarantina;
    
    return { stokFisikGudang, totalKarantina, stokBebas };
  }, [realProductionBatches, realSalesOrders, optimisticDeletedIds]);

  const aktifOrderLog = useMemo(() => {
    return realSalesOrders.filter(s => !s.isDeleted && !optimisticDeletedIds.has(s.id)).sort((a,b) => new Date(b.date) - new Date(a.date));
  }, [realSalesOrders, optimisticDeletedIds]);

  // HANDLER SUBMIT PENJUALAN
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Number(form.qtyPcs) <= 0) return alert("Jumlah QTY Pcs tidak boleh kosong!");
    if (form.fulfillmentType === 'DIRECT' && Number(form.qtyPcs) > metrikStok.stokBebas) {
      return alert(`STOK BEBAS TIDAK MENCUKUPI! Sisa stok bebas hanya ${formatNumber(metrikStok.stokBebas)} Pcs. Sisa barang di freezer adalah milik customer lain yang dikarantina.`);
    }

    const orderId = generateId('INV', form.date);
    let finalFulfillmentStatus = form.fulfillmentType === 'DIRECT' ? 'DIAMBIL_FISIK' : form.karantinaStatus;

    const payloadOrder = {
      id: orderId, date: form.date, branch_id: currentBranch,
      customer_name: form.customerName.toUpperCase(), customer_type: form.customerType,
      qty_pcs: Number(form.qtyPcs), price_per_pcs: calc.hargaSatuan, subtotal: calc.subtotal,
      shipping_cost: calc.ongkir, grand_total: calc.grandTotal,
      amount_paid: calc.dibayar, payment_status: calc.paymentStatus, payment_method: form.paymentMethod,
      fulfillment_type: form.fulfillmentType, fulfillment_status: finalFulfillmentStatus, delivery_date: form.fulfillmentType === 'DIRECT' ? form.date : form.deliveryDate,
      notes: form.notes
    };

    const success = await sendToSheet('insert', payloadOrder, 'sales_orders');
    if (success) {
      // JIKA ADA UANG MASUK (CASH/TF), OTOMATIS CATAT KE BUKU KAS/TREASURY!
      if (calc.dibayar > 0) {
        await sendToSheet('insert', {
          id: 'CFI-' + new Date().getTime(), date: form.date, branch_id: form.paymentMethod === 'TF' ? 'HQ_FACTORY' : currentBranch,
          transaction_type: 'INFLOW', category: 'PENJUALAN_OMSET', amount: calc.dibayar, payment_method: form.paymentMethod,
          reference_id: orderId, description: `Pembayaran ${calc.paymentStatus} Invoice ${orderId} (${form.customerName})`
        }, 'cashflow_transactions');
      }

      if(showToast) showToast('Order Penjualan Berhasil Disimpan!', 'success');
      setForm({ ...form, customerName: '', qtyPcs: '', shippingCost: '0', amountPaid: '', notes: '' });
    }
  };

  const handleUbahStatusKarantina = async (orderId, statusBaru) => {
    // Logika buka-tutup gembok karantina by Bos
    await sendToSheet('update', { id: orderId, fulfillment_status: statusBaru }, 'sales_orders');
    if(showToast) showToast(`Status karantina diubah jadi ${statusBaru}`, 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* 📊 RADAR STOK GUDANG FREEZER (REAL-TIME OMS) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 p-5 rounded-2xl border shadow-lg border-l-4 border-l-emerald-500 relative overflow-hidden text-white">
          <Package className="absolute -right-4 -bottom-4 text-emerald-400 opacity-20" size={100} />
          <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest relative z-10 flex items-center gap-1"><Unlock size={12}/> STOK BEBAS (AVAILABLE)</div>
          <div className="text-3xl font-black text-white mt-1 relative z-10">{formatNumber(metrikStok.stokBebas)} <span className="text-sm font-bold text-slate-400">PCS</span></div>
          <div className="text-[9px] text-slate-400 mt-2">Aman dijual langsung ke Walk-in Customer</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-orange-500 relative overflow-hidden">
          <Lock className="absolute -right-4 -bottom-4 text-orange-50 opacity-50" size={100} />
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10 flex items-center gap-1"><Lock size={12}/> DI-BOOKING (KARANTINA)</div>
          <div className="text-3xl font-black text-orange-600 mt-1 relative z-10">{formatNumber(metrikStok.totalKarantina)} <span className="text-sm font-bold text-slate-400">PCS</span></div>
          <div className="text-[9px] text-slate-500 mt-2 font-bold">Stok ini milik PO yang belum dikirim!</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-blue-500 relative overflow-hidden">
          <Package className="absolute -right-4 -bottom-4 text-blue-50 opacity-50" size={100} />
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10 flex items-center gap-1">TOTAL FISIK FREEZER</div>
          <div className="text-3xl font-black text-blue-600 mt-1 relative z-10">{formatNumber(metrikStok.stokFisikGudang)} <span className="text-sm font-bold text-slate-400">PCS</span></div>
          <div className="text-[9px] text-slate-500 mt-2">Sesuai dengan jumlah asli di dalam kulkas</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 📝 FORM INPUT POS / KASIR ENTERPRISE */}
        <div className="p-6 rounded-2xl border border-t-4 border-t-emerald-600 bg-white shadow-sm h-max">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm uppercase text-slate-800 flex items-center gap-2">
                <ShoppingCart size={16} className="text-emerald-600"/> POS &amp; Order Management
              </h3>
            </div>

            {/* INFO PELANGGAN & HARGA TIER */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nama Pelanggan / ID Cust</label>
                <input type="text" required value={form.customerName} onChange={e=>setForm({...form, customerName: e.target.value})} className="w-full p-2.5 mt-1 border rounded-xl text-xs font-bold outline-none uppercase bg-slate-50 focus:bg-white focus:border-emerald-400" placeholder="Contoh: BOS REZA JAKARTA..." />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Kategori Harga</label>
                <select value={form.customerType} onChange={e=>setForm({...form, customerType: e.target.value})} className="w-full p-2.5 mt-1 border border-blue-200 bg-blue-50 text-blue-800 rounded-xl text-xs font-black uppercase outline-none focus:border-blue-500 cursor-pointer">
                  <option value="ECERAN">Eceran (Rp 3.000)</option>
                  <option value="RESELLER">Reseller (Rp 2.125)</option>
                  <option value="MITRA">Mitra (Rp 2.000)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Jumlah Beli (PCS)</label>
                <input type="number" min="1" required value={form.qtyPcs} onChange={e=>setForm({...form, qtyPcs: e.target.value})} className="w-full p-2.5 mt-1 border rounded-xl text-sm font-black text-emerald-700 outline-none bg-slate-50 focus:bg-white focus:border-emerald-400" placeholder="0 Pcs" />
                {form.qtyPcs && <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase text-right">Setara: {formatNumber(Number(form.qtyPcs)/50)} Mika</div>}
              </div>
            </div>

            {/* METODE PEMENUHAN & KARANTINA */}
            <div className="p-4 border border-slate-200 rounded-2xl bg-slate-50">
              <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-3 block flex items-center gap-1"><Truck size={12}/> Metode Serah Terima Barang</label>
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={()=>setForm({...form, fulfillmentType: 'DIRECT'})} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition border ${form.fulfillmentType==='DIRECT' ? 'bg-emerald-100 border-emerald-300 text-emerald-800 shadow-sm' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>Direct (Ambil Fisik)</button>
                <button type="button" onClick={()=>setForm({...form, fulfillmentType: 'PO'})} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition border ${form.fulfillmentType==='PO' ? 'bg-orange-100 border-orange-300 text-orange-800 shadow-sm' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>Pre-Order / Kirim Nanti</button>
              </div>

              {form.fulfillmentType === 'PO' && (
                <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-2 fade-in">
                  <div>
                    <label className="text-[9px] font-black text-orange-600 uppercase">Jadwal Rencana Kirim</label>
                    <input type="date" required value={form.deliveryDate} onChange={e=>setForm({...form, deliveryDate: e.target.value})} className="w-full p-2 mt-1 border border-orange-200 rounded-lg text-xs font-bold outline-none" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-orange-600 uppercase flex justify-between"><span>Status Gudang</span></label>
                    <select value={form.karantinaStatus} onChange={e=>setForm({...form, karantinaStatus: e.target.value})} className={`w-full p-2 mt-1 border rounded-lg text-xs font-black uppercase outline-none ${form.karantinaStatus==='LOCKED' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                      <option value="LOCKED">🔒 Kunci Stok Fisik</option>
                      <option value="STANDBY">🔓 Biarkan Bebas (Pinjam)</option>
                    </select>
                  </div>
                  <div className="col-span-2 text-[8px] mt-1 text-slate-500 font-bold italic">*Jika stok kurang/Standby, alarm SPK Dapur otomatis nyala!</div>
                </div>
              )}
            </div>

            {/* BIAYA & PEMBAYARAN */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Subtotal Barang:</span>
                <span className="text-sm font-black text-slate-800">{formatRupiah(calc.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">Biaya Logistik/Ongkir:</span>
                <input type="text" value={formatRupiah(form.shippingCost)} onChange={e=>setForm({...form, shippingCost: e.target.value.replace(/\D/g, '')})} className="w-1/2 p-2 border border-slate-200 rounded-lg text-xs font-bold outline-none text-right" placeholder="Rp 0" />
              </div>
              <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl text-white shadow-inner">
                <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">TOTAL TAGIHAN</span>
                <span className="text-xl font-black">{formatRupiah(calc.grandTotal)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-amber-50/50 p-3 rounded-xl border border-amber-200">
              <div className="col-span-2 flex justify-between items-end">
                <label className="text-[10px] font-black text-amber-800 uppercase flex items-center gap-1"><CreditCard size={12}/> Nominal Dibayar (Uang Masuk)</label>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${calc.paymentStatus === 'LUNAS' ? 'bg-emerald-200 text-emerald-800' : (calc.paymentStatus === 'BELUM BAYAR' ? 'bg-rose-200 text-rose-800' : 'bg-orange-200 text-orange-800')}`}>{calc.paymentStatus}</span>
              </div>
              <div className="col-span-2 flex gap-2">
                <select value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-1/3 p-2 border border-amber-300 rounded-lg text-xs font-black bg-white outline-none">
                  <option value="CASH">CASH</option>
                  <option value="TF">TRANSFER</option>
                </select>
                <input type="text" value={formatRupiah(form.amountPaid)} onChange={e=>setForm({...form, amountPaid: e.target.value.replace(/\D/g, '')})} className="flex-1 p-2 border border-amber-300 rounded-lg text-sm font-black text-emerald-700 outline-none text-right" placeholder="Rp 0" />
              </div>
              {calc.sisaPiutang > 0 && (
                <div className="col-span-2 text-[10px] font-black text-rose-600 uppercase text-right border-t border-amber-200 pt-2">
                  Sisa Piutang Gantung: {formatRupiah(calc.sisaPiutang)}
                </div>
              )}
            </div>
            
            <button type="submit" className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg hover:bg-emerald-700 hover:shadow-emerald-600/30 transition-all flex justify-center items-center gap-2">
              <Printer size={16}/> Simpan &amp; Cetak Invoice
            </button>
          </form>
        </div>
        
        {/* 📚 TABEL ARSIP PENJUALAN & MANAJEMEN PIUTANG/PO */}
        <div className="lg:col-span-2 bg-white rounded-2xl border flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
            <h4 className="font-black text-xs uppercase text-slate-700 tracking-widest flex items-center gap-2"><FileText size={14} className="text-blue-600"/> Arsip Invoice &amp; Fulfillment</h4>
          </div>
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b border-slate-200">
                <tr><th className="px-4 py-3 whitespace-nowrap">ID Invoice</th><th className="px-4 py-3 whitespace-nowrap">Pelanggan &amp; QTY</th><th className="px-4 py-3 whitespace-nowrap">Status Tagihan</th><th className="px-4 py-3 whitespace-nowrap">Logistik &amp; Gudang</th><th className="px-4 py-3 whitespace-nowrap text-center">Aksi</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold">
                {aktifOrderLog.map(order => {
                  const sisaUtang = Math.max(0, Number(order.grand_total || 0) - Number(order.amount_paid || 0));
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-slate-800">{formatDate(order.date)}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">{order.id}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="uppercase text-slate-800 font-black flex items-center gap-1"><User size={12} className="text-slate-400"/> {order.customer_name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${order.customer_type === 'MITRA' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>{order.customer_type}</span>
                          <span className="text-[10px] font-black text-emerald-600">{formatNumber(order.qty_pcs)} Pcs</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className={`text-[10px] font-black uppercase flex items-center gap-1 ${order.payment_status === 'LUNAS' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {order.payment_status === 'LUNAS' ? <CheckCircle2 size={12}/> : <AlertCircle size={12}/>} {order.payment_status}
                        </div>
                        <div className="text-xs font-black text-slate-800 mt-1">{formatRupiah(order.grand_total)}</div>
                        {sisaUtang > 0 && <div className="text-[9px] text-rose-500 mt-0.5">Sisa: {formatRupiah(sisaUtang)}</div>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {order.fulfillment_status === 'DIAMBIL_FISIK' ? (
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 w-max"><CheckCircle2 size={10}/> DIAMBIL LANGSUNG</span>
                        ) : (
                          <div>
                            <div className="text-[9px] font-black text-orange-600 flex items-center gap-1 mb-1"><CalendarDays size={10}/> Kirim: {formatDate(order.delivery_date)}</div>
                            <select 
                              value={order.fulfillment_status} 
                              onChange={(e) => handleUbahStatusKarantina(order.id, e.target.value)}
                              className={`text-[9px] font-black uppercase px-2 py-1 rounded border outline-none cursor-pointer ${order.fulfillment_status==='DIKARANTINA' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}
                            >
                              <option value="DIKARANTINA">🔒 STOK TERKUNCI</option>
                              <option value="STANDBY">🔓 LEPAS (STANDBY)</option>
                              <option value="DIAMBIL_FISIK">✅ SUDAH DIKIRIM</option>
                            </select>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button type="button" onClick={() => {
                            triggerPrint('NOTA_DOTMATRIX', {
                              title: 'INVOICE / NOTA PENJUALAN', id: order.id, date: formatDate(order.date),
                              branch_name: currentBranch, admin_name: user?.name || 'KASIR PUSAT', customer_name: order.customer_name, position: order.customer_type,
                              items: [
                                { name: `Dimsum Frozen (${order.customer_type})`, qty: order.qty_pcs, subtotal: order.subtotal, suffix: ' Pcs' },
                                { name: `Biaya Logistik / Pengiriman`, qty: 1, subtotal: order.shipping_cost, suffix: '' }
                              ],
                              amount: order.amount_paid, paymentMethod: order.payment_method, 
                              footerCustom: sisaUtang > 0 ? `SISA PIUTANG TAGIHAN: ${formatRupiah(sisaUtang)}` : `LUNAS TERBAYAR. TERIMA KASIH.`
                            });
                          }} className="p-1.5 text-white bg-slate-800 hover:bg-slate-900 shadow rounded-lg transition-transform hover:scale-105" title="Cetak Invoice"><Printer size={12}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {aktifOrderLog.length === 0 && (
                  <tr><td colSpan="5" className="px-4 py-12 text-center text-slate-400 font-black uppercase tracking-widest bg-slate-50/50"><ShoppingCart size={24} className="mx-auto mb-2 opacity-50"/>Belum Ada Transaksi Penjualan</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
