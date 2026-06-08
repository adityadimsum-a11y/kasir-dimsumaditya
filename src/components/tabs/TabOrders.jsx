import React, { useState, useMemo } from 'react';
import { ShoppingCart, CheckCircle, Printer, Receipt, Store, Smartphone } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';
import PaginationController from '../ui/PaginationController';

export default function TabOrders({ orders, masterProducts, sendToSheet, setPrintData, requestDelete, role, showToast, user }) {
  const todayStr = getTodayStr();

  const [form, setForm] = useState({
      date: todayStr, sales_category: 'ECERAN', source: 'OFFLINE', customer_name: '', invoice_no: '',
      qty: 50, price: '3000', gross_sales: '', marketplace_admin_fee: '', marketplace_promo: '', paymentMethod: 'CASH'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const isMarketplace = form.sales_category === 'MERCHANT' || form.sales_category === 'TOKO_ONLINE';

  const totalGross = useMemo(() => {
      if (!isMarketplace) return Number(form.qty) * Number(form.price);
      return Number(form.gross_sales || 0);
  }, [form.qty, form.price, form.gross_sales, isMarketplace]);

  const netReceived = useMemo(() => {
      return totalGross - Number(form.marketplace_admin_fee || 0) - Number(form.marketplace_promo || 0);
  }, [totalGross, form.marketplace_admin_fee, form.marketplace_promo]);

  const handleCategoryChange = (e) => {
      const cat = e.target.value;
      let newPrice = ''; let newSource = 'OFFLINE'; let newPayMethod = 'CASH';

      if (cat === 'MITRA') newPrice = '2000';
      else if (cat === 'RESELLER') newPrice = '2125';
      else if (cat === 'ECERAN') newPrice = '3000';
      else if (cat === 'MERCHANT') { newSource = 'SHOPEEFOOD'; newPayMethod = 'MARKETPLACE'; }
      else if (cat === 'TOKO_ONLINE') { newSource = 'TOKOPEDIA'; newPayMethod = 'MARKETPLACE'; }

      setForm(prev => ({
          ...prev, sales_category: cat, price: newPrice, source: newSource, paymentMethod: newPayMethod,
          gross_sales: '', marketplace_admin_fee: '', marketplace_promo: ''
      }));
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      if(Number(form.qty) <= 0) return;
      if(isMarketplace && !form.invoice_no) return;

      const payload = {
          id: generateId('INV', form.date), date: form.date, branch_id: user?.branch_id || 'PUSAT',
          sales_category: form.sales_category, source: form.source, customer_name: form.customer_name || form.sales_category,
          invoice_no: form.invoice_no, qty: Number(form.qty), total: totalGross,
          marketplace_admin_fee: Number(form.marketplace_admin_fee || 0), marketplace_promo: Number(form.marketplace_promo || 0), paymentMethod: form.paymentMethod
      };

      const success = await sendToSheet('event_order', payload, 'orders');
      if (success) {
          setForm(prev => ({ ...prev, qty: 50, customer_name: '', invoice_no: '', gross_sales: '', marketplace_admin_fee: '', marketplace_promo: '' }));
      }
  };

  const validOrders = (orders || []).filter(o => !o.isDeleted).sort((a,b) => new Date(b.date) - new Date(a.date));
  const totalRows = validOrders.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const currentData = validOrders.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
            <h3 className="font-black text-white text-lg tracking-wide uppercase flex items-center gap-2"><ShoppingCart size={20} className="text-amber-400"/> Sistem Kasir Penjualan</h3>
         </div>
         <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Tgl Transaksi</label>
                        <input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-bold mt-1" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Kategori Pricing (Tier)</label>
                        <select value={form.sales_category} onChange={handleCategoryChange} className="w-full p-2.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-sm font-black mt-1 uppercase outline-none">
                            <option value="ECERAN">ECERAN (Rp 3.000)</option><option value="RESELLER">RESELLER (Rp 2.125)</option><option value="MITRA">MITRA (Rp 2.000)</option>
                            <option value="MERCHANT">MERCHANT (GoFood/GrabFood/ShopeeFood)</option><option value="TOKO_ONLINE">TOKO ONLINE (Tokopedia/TikTok)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Identitas Pelanggan / Resi</label>
                        <input type="text" placeholder="Cth: Pak Budi" value={form.customer_name} onChange={e=>setForm({...form, customer_name: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-bold mt-1 uppercase" />
                    </div>
                </div>

                {!isMarketplace ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Kuantitas Terjual</label>
                            <div className="relative mt-1"><input type="number" required min="1" value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 border rounded-xl font-black text-slate-800" /><span className="absolute right-4 top-2.5 text-xs font-black text-slate-400">PCS</span></div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-emerald-600 uppercase">Harga Jual Auto-Lock</label>
                            <div className="relative mt-1"><span className="absolute left-4 top-2.5 font-black text-slate-400">Rp</span><input type="text" readOnly value={Number(form.price).toLocaleString('id-ID')} className="w-full pl-10 p-2.5 bg-emerald-50/50 border border-emerald-200 rounded-xl font-black text-emerald-800 cursor-not-allowed" /></div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Metode Bayar</label>
                            <select value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-full p-2.5 bg-white border rounded-xl text-xs font-bold mt-1"><option value="CASH">Cash / Tunai</option><option value="TRANSFER">Transfer / QRIS</option></select>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 bg-orange-50/50 p-4 rounded-xl border border-orange-200">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-orange-700 uppercase">Platform</label>
                                <select value={form.source} onChange={e=>setForm({...form, source: e.target.value})} className="w-full p-2.5 bg-white border border-orange-200 rounded-xl text-xs font-bold mt-1 uppercase">
                                    {form.sales_category === 'MERCHANT' ? <><option value="SHOPEEFOOD">ShopeeFood</option><option value="GOFOOD">GoFood</option><option value="GRABFOOD">GrabFood</option></> : <><option value="TOKOPEDIA">Tokopedia</option><option value="TIKTOK_SHOP">TikTok Shop</option></>}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-orange-700 uppercase">No. Invoice / Order ID</label>
                                <input type="text" required value={form.invoice_no} onChange={e=>setForm({...form, invoice_no: e.target.value.toUpperCase()})} placeholder="ORD-123" className="w-full p-2.5 bg-white border border-orange-200 rounded-xl text-xs font-bold mt-1" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Qty Keluar (Pcs)</label>
                                <input type="number" required min="1" value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 border rounded-xl font-black mt-1" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Total Tagihan Kotor Nota</label>
                                <div className="relative mt-1"><span className="absolute left-3 top-2.5 font-black text-slate-400">Rp</span><input type="text" required value={form.gross_sales ? Number(form.gross_sales).toLocaleString('id-ID') : ''} onChange={e=>setForm({...form, gross_sales: e.target.value.replace(/\D/g, '')})} className="w-full pl-9 pr-3 py-2.5 bg-white border rounded-xl font-black" /></div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            <div>
                                <label className="text-[10px] font-bold text-rose-600 uppercase">Potongan Fee Aplikasi</label>
                                <div className="relative mt-1"><span className="absolute left-3 top-2.5 font-black text-rose-300">Rp</span><input type="text" required value={form.marketplace_admin_fee ? Number(form.marketplace_admin_fee).toLocaleString('id-ID') : ''} onChange={e=>setForm({...form, marketplace_admin_fee: e.target.value.replace(/\D/g, '')})} className="w-full pl-9 pr-3 py-2.5 bg-rose-50 border rounded-xl font-black" /></div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-amber-600 uppercase">Subsidi Promo Merchant</label>
                                <div className="relative mt-1"><span className="absolute left-3 top-2.5 font-black text-amber-300">Rp</span><input type="text" value={form.marketplace_promo ? Number(form.marketplace_promo).toLocaleString('id-ID') : ''} onChange={e=>setForm({...form, marketplace_promo: e.target.value.replace(/\D/g, '')})} className="w-full pl-9 pr-3 py-2.5 bg-amber-50 border rounded-xl font-black" /></div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 rounded-xl p-4 mt-6 shadow-xl">
                    <div className="flex items-center gap-6 text-white mb-4 md:mb-0">
                        <div><div className="text-[9px] font-black uppercase text-slate-400">Gross Sales</div><div className="text-xl font-bold">{formatRp(totalGross)}</div></div>
                        <div><div className="text-[10px] font-black uppercase text-emerald-400">Net Revenue Diterima</div><div className="text-3xl font-black text-emerald-400">{formatRp(netReceived)}</div></div>
                    </div>
                    <button type="submit" className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-3.5 rounded-xl uppercase tracking-wide text-xs flex items-center gap-2"><CheckCircle size={16}/> Rekam Transaksi</button>
                </div>
            </form>
         </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
         <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Riwayat Transaksi Toko</h4></div>
         <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
               <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase">
                  <tr><th>ID Dokumen</th><th>Pelanggan</th><th className="text-center">Tier</th><th className="text-center">Volume</th><th className="text-right">Kotor</th><th className="text-right">Net Revenue</th><th className="text-center">Aksi</th></tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-xs font-bold">
                  {currentData.map(o => (
                     <tr key={o.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3"><div>{formatDate(o.date)}</div><div className="text-[10px] text-slate-400 font-mono">{o.invoice_no || o.id}</div></td>
                        <td className="px-4 py-3"><div className="font-black uppercase">{o.customer_name}</div><div className="text-[10px] text-blue-600">{o.source}</div></td>
                        <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 rounded bg-slate-100 text-[9px] font-black">{o.sales_category}</span></td>
                        <td className="px-4 py-3 text-center text-slate-700 font-black">{o.qty} Pcs</td>
                        <td className="px-4 py-3 text-right text-slate-400">{formatRp(o.total)}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-black">{formatRp(Number(o.total) - (Number(o.fee_amount)||0) - (Number(o.marketplace_promo)||0))}</td>
                        <td className="px-4 py-3 text-center"><button type="button" onClick={() => setPrintData({ type: 'INVOICE', data: o })} className="bg-slate-100 p-1.5 rounded hover:bg-slate-200"><Printer size={14}/></button></td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
         <PaginationController currentPage={currentPage} totalPages={totalPages} totalRows={totalRows} rowsPerPage={rowsPerPage} onPageChange={setCurrentPage} onRowsPerPageChange={setRowsPerPage} />
      </div>
    </div>
  );
}
