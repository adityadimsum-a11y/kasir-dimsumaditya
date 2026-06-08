import React, { useState, useMemo } from 'react';
import { ShoppingCart, CheckCircle, Clock, Printer, Receipt } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';
import SearchableDropdown from '../ui/SearchableDropdown';
import PaginationController from '../ui/PaginationController'; // Kunci Phase 11 & 12

export default function TabOrders({ orders, payments, masterProducts, sendToSheet, setPrintData, requestDelete, role, showToast, user }) {
  const todayStr = getTodayStr();

  // 1. FORM STATE
  const [form, setForm] = useState({
      date: todayStr, sales_category: 'ECERAN', source: 'OFFLINE', customerName: '',
      sku: '', itemName: '', qty: 50, price: '3000', paidAmount: '', paymentMethod: 'CASH',
      invoice_no: '', marketplace_admin_fee: '0', marketplace_promo: '0'
  });

  // 2. PAGINATION STATES
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const handleCurrencyChange = (field, value) => {
      const rawValue = value.replace(/\D/g, ''); 
      setForm(prev => ({ ...prev, [field]: rawValue }));
  };

  // AUTOMATIC TIER PRICING LOCK SYSTEM (PHASE 12.5)
  const handleTierPriceLock = (category) => {
     let price = '3000'; 
     let source = 'OFFLINE';
     let payMethod = 'CASH';

     if (category === 'MITRA') price = '2000';
     if (category === 'RESELLER') price = '2125';
     if (category === 'MERCHANT' || category === 'TOKO ONLINE') {
        price = '2500'; 
        source = 'GOFOOD';
        payMethod = 'MARKETPLACE';
     }

     setForm(prev => ({ ...prev, sales_category: category, price, source, paymentMethod: payMethod }));
  };

  const handleSelectProduct = (product) => {
      setForm(prev => ({ ...prev, sku: product.sku, itemName: product.product_name }));
  };

  const totalGrossValue = Number(form.qty) * Number(form.price);
  const netReceivedValue = form.sales_category === 'MERCHANT' || form.sales_category === 'TOKO ONLINE' 
     ? totalGrossValue - Number(form.marketplace_admin_fee) - Number(form.marketplace_promo)
     : totalGrossValue;

  const handleSubmit = (e) => {
      e.preventDefault();
      if (!form.itemName) { showToast('Pilih Produk dari Master Data!', 'error'); return; }

      const payload = {
          id: generateId('ORD', form.date), date: form.date, source: form.source, sales_category: form.sales_category,
          customer_name: form.customerName || 'CUSTOMER REGULER', sku: form.sku, itemName: form.itemName,
          qty: Number(form.qty), price: Number(form.price), total: totalGrossValue, paidAmount: Number(form.paidAmount || netReceivedValue),
          paymentMethod: form.paymentMethod, invoice_no: form.invoice_no,
          marketplace_admin_fee: Number(form.marketplace_admin_fee), marketplace_promo: Number(form.marketplace_promo),
          settlement_status: form.paymentMethod === 'MARKETPLACE' ? 'PENDING' : 'SETTLED', branch_id: user.branch_id
      };

      sendToSheet('event_order', payload, 'system_events').then(success => {
          if (success) {
              setForm(prev => ({ ...prev, qty: 50, paidAmount: '', invoice_no: '', marketplace_admin_fee: '0', marketplace_promo: '0' }));
              setCurrentPage(1);
          }
      });
  };

  // 3. COMPUTED MEMOIZED PACINATION LOGIC (ANTI BREAK)
  const sortedOrders = useMemo(() => {
    return (orders || []).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [orders]);

  const totalRows = sortedOrders.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);

  const paginatedOrders = useMemo(() => {
    const startIdx = (currentPage - 1) * rowsPerPage;
    return sortedOrders.slice(startIdx, startIdx + rowsPerPage);
  }, [sortedOrders, currentPage, rowsPerPage]);

  return (
    <div className="space-y-6 animate-in fade-in duration-150 pb-10">
      {/* CHICKEN CASHFLOW ESTIMATOR */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl border shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h4 className="text-xs font-black text-cyan-400 tracking-wider uppercase flex items-center gap-1.5"><Receipt size={14}/> Chicken Cashflow Engine</h4>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Sistem mengukur kesiapan operasional belanja komoditas berikutnya secara real-time.</p>
         </div>
         <div className="bg-slate-800 border border-slate-700 p-3 rounded-xl font-bold text-xs">
            Estimasi Kemampuan Kas Sisa: <span className="text-emerald-400 font-black">Ready Lini Belanja</span>
         </div>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm p-6">
          <div className="flex bg-slate-100 p-1 rounded-xl w-max mb-6 no-print">
             {['ECERAN', 'RESELLER', 'MITRA', 'MERCHANT'].map(t => (
                <button key={t} type="button" onClick={() => handleTierPriceLock(t)} className={`px-4 py-2 rounded-lg font-black text-xs uppercase transition ${form.sales_category === t ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>{t}</button>
             ))}
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Tgl</label><input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-xs" /></div>
              <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-bold text-slate-600 uppercase">Pilih Produk (Master Global)</label>
                  <SearchableDropdown options={masterProducts||[]} value={form.itemName} valueKey="product_name" labelKey="product_name" placeholder="Pilih Dimsum..." onChange={handleSelectProduct} />
              </div>
              <div className="space-y-1"><label className="text-[10px] font-black text-blue-600 uppercase">Kuantitas Jual (Pcs)</label><input type="number" required min="1" value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 bg-blue-50 border border-blue-200 rounded-xl font-black text-blue-700" /></div>
              
              {(form.sales_category === 'MERCHANT' || form.sales_category === 'TOKO ONLINE') && (
                 <>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-purple-600 uppercase">Nama Platform</label>
                       <select value={form.source} onChange={e=>setForm({...form, source: e.target.value})} className="w-full p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-xs font-black text-purple-800">
                          <option value="GOFOOD">GOFOOD</option><option value="GRABFOOD">GRABFOOD</option><option value="SHOPEEFOOD">SHOPEEFOOD</option><option value="TIKTOK">TIKTOK SHOP</option>
                       </select>
                    </div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-purple-600 uppercase">No. Invoice Platform</label><input type="text" required placeholder="Contoh: INV/2026/..." value={form.invoice_no} onChange={e=>setForm({...form, invoice_no: e.target.value})} className="w-full p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-xs font-bold" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-rose-600 uppercase">Potongan Admin (Rp)</label><input type="text" value={form.marketplace_admin_fee ? Number(form.marketplace_admin_fee).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange('marketplace_admin_fee', e.target.value)} className="w-full p-2.5 bg-rose-50 border border-rose-200 rounded-xl font-bold text-xs text-rose-700" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-rose-600 uppercase">Promo Ditanggung Toko</label><input type="text" value={form.marketplace_promo ? Number(form.marketplace_promo).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange('marketplace_promo', e.target.value)} className="w-full p-2.5 bg-rose-50 border border-rose-200 rounded-xl font-bold text-xs text-rose-700" /></div>
                 </>
              )}

              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Harga Patokan Tier (Rp)</label><input type="text" disabled value={Number(form.price).toLocaleString('id-ID')} className="w-full p-2.5 bg-slate-100 border text-slate-500 rounded-xl font-black text-xs" /></div>
              <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase">Nama Pelanggan / Catatan</label><input type="text" placeholder=" Walk-in" value={form.customerName} onChange={e=>setForm({...form, customerName: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-xs uppercase" /></div>
              
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-600 uppercase">Metode Pembayaran</label>
                  <select disabled={form.sales_category==='MERCHANT'} value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-xs">
                      <option value="CASH">CASH / LACI TOKO</option><option value="TRANSFER">TRANSFER BANK</option><option value="QRIS">QRIS</option><option value="MARKETPLACE">TERTAHAN DI PLATFORM</option>
                  </select>
              </div>

              <div className="md:col-span-4 bg-slate-900 p-4 rounded-xl flex justify-between items-center text-white mt-4 shadow-xl">
                  <div>
                     <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Uang Bersih Diterima (Net)</div>
                     <div className="text-xl font-black text-emerald-400">{formatRp(netReceivedValue)}</div>
                     <div className="text-[9px] text-slate-500 font-bold">Kotor: {formatRp(totalGrossValue)}</div>
                  </div>
                  <button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-black px-8 py-3 rounded-xl uppercase text-xs tracking-wide flex items-center gap-2"><CheckCircle size={16}/> Amankan Nota Transaksi</button>
              </div>
          </form>
      </div>

      {/* RECONCILIATION DATA VIEW TABLE */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-6 flex flex-col">
         <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase"><tr><th className="p-3">ID Nota</th><th className="p-3">Kategori</th><th className="p-3 text-center">Volume</th><th className="p-3 text-right">Kotor (Gross)</th><th className="p-3 text-right">Potongan/Promo</th><th className="p-3 text-center">Aksi</th></tr></thead>
            <tbody className="divide-y divide-slate-100 font-bold text-xs text-slate-700">
               {paginatedOrders.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50">
                     <td className="p-3 font-mono text-[10px] text-slate-500">{o.id}</td>
                     <td className="p-3"><span className={`px-2 py-0.5 rounded text-[9px] ${o.sales_category==='MITRA'?'bg-purple-100 text-purple-800':o.sales_category==='RESELLER'?'bg-blue-100 text-blue-800':'bg-slate-100 text-slate-800'}`}>{o.sales_category}</span></td>
                     <td className="p-3 text-center">{o.qty} Pcs</td>
                     <td className="p-3 text-right text-slate-400">{formatRp(o.total)}</td>
                     <td className="p-3 text-right text-rose-600">-{formatRp((Number(o.fee_amount)||0) + (Number(o.marketplace_promo)||0))}</td>
                     <td className="p-3 text-center flex items-center justify-center gap-2">
                        <button type="button" onClick={() => setPrintData({ type: 'INVOICE', data: o })} className="bg-slate-100 text-slate-700 p-1 rounded hover:bg-slate-200"><Printer size={14}/></button>
                        {(role === 'super_admin' || role === 'admin') && (
                          <button type="button" onClick={() => requestDelete(o.id)} className="text-rose-600 p-1 hover:bg-rose-50 rounded">Hapus</button>
                        )}
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>

         {/* CONTROLLER INTEGRASI PHASE 11 */}
         <PaginationController 
            currentPage={currentPage}
            totalPages={totalPages}
            totalRows={totalRows}
            rowsPerPage={rowsPerPage}
            onPageChange={handlePageChange}
            onRowsPerPageChange={handleRowsPerPageChange}
         />
      </div>

    </div>
  );
}
