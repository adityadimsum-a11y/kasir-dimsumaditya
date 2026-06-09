import React, { useState, useMemo } from 'react';
import { ShoppingCart, CheckCircle, Printer, Users, AlertTriangle, Lock, Edit3 } from 'lucide-react';
import { formatRp, getTodayStr, generateId, KATEGORI_HARGA } from '../../utils/helpers';
import PaginationController from '../ui/PaginationController';

export default function TabOrders({ orders, master_customers, sendToSheet, setPrintData, requestDelete, showToast, user }) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'PUSAT';
  
  // Deteksi apakah yang login adalah Resto (Cibinong)
  const isResto = user?.branch_type === 'OUTLET_RESTO' || String(currentBranch).toUpperCase().includes('CIBINONG');

  const [form, setForm] = useState({
      date: todayStr, 
      sales_category: 'ECERAN', 
      source: 'OFFLINE', 
      customer_name: '', 
      invoice_no: '',
      qty: 50, 
      price: KATEGORI_HARGA['Eceran'], 
      paymentMethod: 'CASH'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Kunci harga jika kategori offline standar. Buka manual jika Merchant, Marketplace, atau Paketan Acara
  const isManualPrice = ['MERCHANT', 'MARKETPLACE', 'PAKETAN_ACARA'].includes(form.sales_category);

  const totalGross = useMemo(() => {
      return Number(form.qty || 0) * Number(form.price || 0);
  }, [form.qty, form.price]);

  const handleCurrencyChange = (value) => {
      const rawValue = value.replace(/\D/g, ''); 
      setForm(prev => ({ ...prev, price: rawValue }));
  };

  const handleCategoryChange = (e) => {
      const cat = e.target.value;
      let newSource = 'OFFLINE'; 
      let newPayMethod = 'CASH';
      let autoPrice = '';

      // Tentukan default Platform & Metode Pembayaran berdasarkan Kategori
      if (cat === 'MERCHANT') { 
          newSource = 'GOFOOD'; 
          newPayMethod = 'PIUTANG'; // Default piutang karena uang nyangkut di platform
      }
      else if (cat === 'MARKETPLACE') { 
          newSource = 'TOKO_SHOPEE'; 
          newPayMethod = 'PIUTANG'; 
      }
      else if (cat === 'PAKETAN_ACARA') {
          newSource = 'OFFLINE_EVENT';
          newPayMethod = 'TF';
      }
      else {
          let mappedPriceKey = 'Eceran';
          if (cat === 'RESELLER') mappedPriceKey = 'Reseller';
          if (cat === 'MITRA') mappedPriceKey = 'Mitra';
          autoPrice = KATEGORI_HARGA[mappedPriceKey] || 0;
      }

      setForm(prev => ({
          ...prev, 
          sales_category: cat, 
          source: newSource, 
          paymentMethod: newPayMethod,
          price: autoPrice, 
          invoice_no: '' // Reset invoice saat ganti kategori
      }));
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      if(Number(form.qty) <= 0 || Number(form.price) <= 0) {
          if(showToast) showToast('Kuantitas dan Harga tidak boleh kosong!', 'error');
          return;
      }
      
      const isOnline = form.sales_category === 'MERCHANT' || form.sales_category === 'MARKETPLACE';
      if(isOnline && !form.invoice_no) {
          if(showToast) showToast('Nomor Invoice/Pesanan dari aplikasi wajib diisi!', 'error');
          return;
      }

      if(!form.customer_name) {
          if(showToast) showToast('Nama Pelanggan wajib diisi!', 'error');
          return;
      }

      const upperCustomerName = form.customer_name.toUpperCase();
      let customerId = '';

      const existingCustomer = (master_customers || []).find(c => String(c.customer_name).toUpperCase() === upperCustomerName);
      
      if (existingCustomer) {
          customerId = existingCustomer.customer_id;
      } else {
          customerId = generateId('CUST', new Date());
          await sendToSheet('insert', {
              customer_id: customerId,
              customer_name: upperCustomerName,
              branch_id: currentBranch,
              customer_tier: form.sales_category,
              status: 'ACTIVE'
          }, 'master_customers');
      }

      const payload = {
          id: generateId('INV', form.date), 
          date: form.date, 
          branch_id: currentBranch,
          customer_id: customerId, 
          customer_name: upperCustomerName, 
          sales_category: form.sales_category, 
          source: form.source, 
          invoice_no: form.invoice_no, 
          qty: Number(form.qty), 
          total: totalGross,
          fee_amount: 0, // Dikosongkan karena harga sudah diketik harga aktual/bersih
          marketplace_promo: 0, 
          paymentMethod: form.paymentMethod
      };

      const success = await sendToSheet('event_order', payload, 'auto');
      if (success) {
          setForm(prev => ({ ...prev, qty: 50, customer_name: '', invoice_no: '' }));
          if(showToast) showToast('Transaksi berhasil dicatat!', 'success');
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
            <span className="text-[9px] font-bold text-amber-400 border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1"><Users size={12}/> Master Customer Aktif</span>
         </div>
         <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Tgl Transaksi</label>
                        <input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-bold mt-1 outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Kategori Pricing (Tier)</label>
                        <select value={form.sales_category} onChange={handleCategoryChange} className="w-full p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-sm font-black mt-1 uppercase outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="ECERAN">ECERAN (Offline)</option>
                            <option value="RESELLER">RESELLER (Offline)</option>
                            <option value="MITRA">MITRA (Offline)</option>
                            <option value="MERCHANT">MERCHANT (GoFood/ShopeeFood)</option>
                            <option value="MARKETPLACE">MARKETPLACE (Shopee/Toped/TikTok)</option>
                            {!isResto && <option value="PAKETAN_ACARA">PAKETAN ACARA (Event)</option>}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Pelanggan (Wajib Terdata)</label>
                        <input 
                            list="customer-list" required placeholder="Ketik Nama Pelanggan..." 
                            value={form.customer_name} onChange={e=>setForm({...form, customer_name: e.target.value.toUpperCase()})} 
                            className="w-full p-3 bg-white border border-slate-300 rounded-xl text-sm font-black mt-1 uppercase outline-none focus:ring-2 focus:ring-blue-500" 
                        />
                        <datalist id="customer-list">
                            {(master_customers || []).map((c, idx) => <option key={idx} value={c.customer_name} />)}
                        </datalist>
                    </div>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 p-5 rounded-xl border ${isManualPrice ? 'bg-orange-50/50 border-orange-200' : 'bg-slate-50 border-slate-200'}`}>
                    
                    {/* KHUSUS ONLINE: Munculkan pilihan platform dan No Invoice */}
                    {(form.sales_category === 'MERCHANT' || form.sales_category === 'MARKETPLACE') && (
                        <>
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-bold text-orange-700 uppercase">Platform Penjualan</label>
                                <select value={form.source} onChange={e=>setForm({...form, source: e.target.value})} className="w-full p-3 bg-white border border-orange-200 rounded-xl text-xs font-bold mt-1 uppercase outline-none">
                                    {form.sales_category === 'MERCHANT' ? (
                                        <><option value="GOFOOD">GoFood</option><option value="SHOPEEFOOD">ShopeeFood</option></>
                                    ) : (
                                        <><option value="TOKO_SHOPEE">Toko Shopee</option><option value="TOKOPEDIA">Tokopedia</option><option value="TIKTOK_SHOP">TikTok Shop</option></>
                                    )}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-bold text-orange-700 uppercase">No. Invoice / Order ID</label>
                                <input type="text" required value={form.invoice_no} onChange={e=>setForm({...form, invoice_no: e.target.value.toUpperCase()})} placeholder="Contoh: ORD-123" className="w-full p-3 bg-white border border-orange-200 rounded-xl text-xs font-bold mt-1 outline-none" />
                            </div>
                            <div className="md:col-span-4 border-b border-orange-100 my-1"></div>
                        </>
                    )}

                    {/* INPUT STANDAR: Qty, Harga, Metode Bayar */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Kuantitas Terjual</label>
                        <div className="relative mt-1">
                            <input type="number" required min="1" value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-3 border rounded-xl font-black text-slate-800 outline-none" />
                            <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-400">Pcs</span>
                        </div>
                    </div>

                    <div className="md:col-span-2 relative group">
                        <label className={`text-[10px] font-bold uppercase flex items-center gap-1 ${isManualPrice ? 'text-orange-600' : 'text-slate-500'}`}>
                            {isManualPrice ? <Edit3 size={12}/> : <Lock size={12} className="text-emerald-500"/>} 
                            {isManualPrice ? 'Harga Aktual (Bebas Input)' : 'Harga Satuan Terkunci'}
                        </label>
                        <div className="relative mt-1">
                            <span className="absolute left-4 top-3.5 font-black text-slate-400">Rp</span>
                            <input 
                                type="text" 
                                required
                                readOnly={!isManualPrice} 
                                value={form.price ? Number(form.price).toLocaleString('id-ID') : ''} 
                                onChange={(e) => isManualPrice && handleCurrencyChange(e.target.value)}
                                className={`w-full pl-10 p-3 border rounded-xl font-black outline-none transition-colors ${!isManualPrice ? 'bg-slate-200/60 border-slate-200 text-slate-600 cursor-not-allowed' : 'bg-white border-orange-200 text-slate-900 focus:ring-2 focus:ring-orange-500'}`} 
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Metode Pembayaran</label>
                        <select value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-full p-3 bg-white border rounded-xl text-xs font-bold mt-1 outline-none">
                            <option value="CASH">CASH (Tunai / Laci)</option>
                            <option value="TF">TF (Transfer BCA / BRI / QRIS)</option>
                            <option value="PIUTANG">PIUTANG (Dana Aplikasi / Kasbon)</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 rounded-2xl p-5 mt-6 shadow-xl border border-slate-800">
                    <div className="flex items-center gap-6 text-white mb-4 md:mb-0 w-full md:w-auto">
                        <div>
                            <div className="text-[10px] font-black uppercase text-emerald-400">Net Revenue Transaksi</div>
                            <div className="text-3xl md:text-4xl font-black text-emerald-400">{formatRp(totalGross)}</div>
                        </div>
                    </div>
                    <button type="submit" className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-4 rounded-xl uppercase tracking-wide text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-blue-900/50">
                        <CheckCircle size={18}/> Rekam Transaksi & Potong Stok
                    </button>
                </div>
            </form>
         </div>
      </div>

      {/* TABEL RIWAYAT TRANSAKSI */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
         <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Log Transaksi Kasir Node Ini</h4></div>
         <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
               <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase">
                  <tr><th>Tgl & ID</th><th>Pelanggan</th><th className="text-center">Kategori & Platform</th><th className="text-center">Pembayaran</th><th className="text-center">Volume</th><th className="text-right">Total Aktual</th><th className="text-center">Aksi</th></tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-xs font-bold">
                  {currentData.length === 0 ? (
                      <tr><td colSpan="7" className="text-center py-8 text-slate-400 font-bold">Belum ada transaksi di cabang ini.</td></tr>
                  ) : (
                      currentData.map(o => (
                         <tr key={o.id} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3"><div>{o.date}</div><div className="text-[9px] text-slate-400 font-mono mt-0.5">{o.invoice_no || o.id}</div></td>
                            <td className="px-4 py-3 font-black uppercase text-slate-800">{o.customer_name}</td>
                            <td className="px-4 py-3 text-center">
                                <div className="px-2 py-0.5 rounded bg-slate-100 text-[9px] font-black uppercase text-slate-600 mb-0.5 w-max mx-auto">{o.sales_category}</div>
                                {o.source !== 'OFFLINE' && <div className="text-[9px] text-blue-600 uppercase">{o.source}</div>}
                            </td>
                            <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${o.paymentMethod === 'PIUTANG' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {o.paymentMethod}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-center text-slate-700 font-black">{o.qty} Pcs</td>
                            <td className="px-4 py-3 text-right text-emerald-600 font-black">{formatRp(o.total)}</td>
                            <td className="px-4 py-3 flex items-center justify-center gap-2">
                                <button type="button" onClick={() => setPrintData({ type: 'INVOICE', data: o })} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><Printer size={14}/></button>
                                <button type="button" onClick={() => requestDelete(o.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded hover:bg-rose-100" title="Void Transaksi"><AlertTriangle size={14}/></button>
                            </td>
                         </tr>
                      ))
                  )}
               </tbody>
            </table>
         </div>
         <PaginationController currentPage={currentPage} totalPages={totalPages} totalRows={totalRows} rowsPerPage={rowsPerPage} onPageChange={setCurrentPage} onRowsPerPageChange={setRowsPerPage} />
      </div>
    </div>
  );
}
