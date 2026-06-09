import React, { useState, useMemo } from 'react';
import { ShoppingCart, CheckCircle, Printer, Users, AlertTriangle, Lock, Edit3, BookOpen } from 'lucide-react';
import { formatRp, getTodayStr, generateId } from '../../utils/helpers';
import PaginationController from '../ui/PaginationController';

export default function TabOrders({ orders, stockMovements, master_customers, sendToSheet, setPrintData, requestDelete, showToast, user }) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'CIBINONG';
  const isCibinong = String(currentBranch).toUpperCase().includes('CIBINONG') || user?.branch_type === 'OUTLET_RESTO';

  // 1. GENERATE MASTER DATA BUKU MENU LOKAL DARI TABEL STOCK_MOVEMENTS
  const bukuMenuLokal = useMemo(() => {
    const menuMap = {};
    // Ambil semua item unik menu lokal yang pernah didaftarkan di cabang ini
    (stockMovements || []).forEach(m => {
      if (!m.isDeleted && String(m.branch_id).toUpperCase() === currentBranch.toUpperCase()) {
        const name = String(m.item_name).toUpperCase();
        // Cari data awal jika ada harga tersimpan di deskripsi/ref atau gunakan default resto
        if (!menuMap[name]) {
          menuMap[name] = { 
            item_name: name, 
            price: name === 'DIMSUM' ? 15000 : 12000 // default baseline resto cibinong
          };
        }
      }
    });
    // Pastikan menu utama selalu ada
    if (!menuMap['DIMSUM']) menuMap['DIMSUM'] = { item_name: 'DIMSUM', price: 15000 };
    return Object.values(menuMap);
  }, [stockMovements, currentBranch]);

  const [form, setForm] = useState({
      date: todayStr, 
      sales_category: 'OFFLINE_RESTO', 
      source: 'OFFLINE', 
      customer_name: 'PELANGGAN RESTO', 
      invoice_no: '',
      selected_item: 'DIMSUM',
      qty: 1, 
      price: isCibinong ? 15000 : 3000, 
      paymentMethod: 'CASH'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const isMerchant = form.sales_category === 'MERCHANT';
  const isLainnya = form.sales_category === 'LAINNYA';
  const isManualPrice = isMerchant || isLainnya;

  const totalGross = useMemo(() => {
      return Number(form.qty || 0) * Number(form.price || 0);
  }, [form.qty, form.price]);

  const handleMenuChange = (itemName) => {
    const found = bukuMenuLokal.find(m => m.item_name === itemName);
    if (found && !isManualPrice) {
      setForm(prev => ({ ...prev, selected_item: itemName, price: found.price }));
    } else {
      setForm(prev => ({ ...prev, selected_item: itemName }));
    }
  };

  const handleCategoryChange = (e) => {
      const cat = e.target.value;
      let newSource = 'OFFLINE'; 
      let newPayMethod = 'CASH';
      let currentItemPrice = form.price;

      if (cat === 'MERCHANT') { 
          newSource = 'GOFOOD'; 
          newPayMethod = 'PIUTANG'; 
      } else if (cat === 'LAINNYA') {
          newSource = 'LAINNYA';
          newPayMethod = 'TF';
      } else {
          const found = bukuMenuLokal.find(m => m.item_name === form.selected_item);
          currentItemPrice = found ? found.price : 15000;
      }

      setForm(prev => ({
          ...prev, 
          sales_category: cat, 
          source: newSource, 
          paymentMethod: newPayMethod,
          price: currentItemPrice,
          invoice_no: ''
      }));
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      if(Number(form.qty) <= 0 || Number(form.price) <= 0) {
          if(showToast) showToast('Kuantitas dan Harga tidak boleh kosong!', 'error');
          return;
      }
      
      if(isMerchant && !form.invoice_no) {
          if(showToast) showToast('Nomor Order/Invoice aplikasi wajib diisi!', 'error');
          return;
      }

      const upperCustomerName = form.customer_name.toUpperCase();
      let customerId = 'CUST-RESTO-WALKIN';

      const payload = {
          id: generateId('INV', form.date), 
          date: form.date, 
          branch_id: currentBranch,
          customer_id: customerId, 
          customer_name: upperCustomerName, 
          sales_category: form.sales_category, 
          source: form.source, 
          invoice_no: form.invoice_no, 
          itemName: form.selected_item,
          qty: Number(form.qty), 
          total: totalGross,
          fee_amount: 0, 
          marketplace_promo: 0, 
          paymentMethod: form.paymentMethod
      };

      const success = await sendToSheet('event_order', payload, 'auto');
      if (success) {
          setForm(prev => ({ ...prev, qty: 1, invoice_no: '', customer_name: 'PELANGGAN RESTO' }));
          if(showToast) showToast('Pesanan Resto berhasil dicatat!', 'success');
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
            <h3 className="font-black text-white text-lg tracking-wide uppercase flex items-center gap-2"><ShoppingCart size={20} className="text-amber-400"/> Sistem Kasir Penjualan Resto</h3>
            <span className="text-[9px] font-bold text-amber-400 border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1"><BookOpen size={12}/> Mode Buku Menu Aktif</span>
         </div>
         <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Tgl Operasional</label>
                        <input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-bold mt-1 outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Kategori Pricing</label>
                        <select value={form.sales_category} onChange={handleCategoryChange} className="w-full p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-sm font-black mt-1 uppercase outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="OFFLINE_RESTO">Offline di Resto (Makan Di Tempat)</option>
                            <option value="MERCHANT">Online : Merchant (GoFood/Grab/Shopee)</option>
                            <option value="LAINNYA">Lain-nya</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Pilih Menu (Dari Master Buku Menu)</label>
                        <select value={form.selected_item} onChange={e => handleMenuChange(e.target.value)} className="w-full p-3 bg-white border border-slate-300 rounded-xl text-sm font-black mt-1 uppercase outline-none focus:ring-2 focus:ring-blue-500">
                            {bukuMenuLokal.map((m, idx) => (
                                <option key={idx} value={m.item_name}>{m.item_name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 p-5 rounded-xl border ${isManualPrice ? 'bg-orange-50/50 border-orange-200' : 'bg-slate-50 border-slate-200'}`}>
                    
                    {isMerchant && (
                        <>
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-bold text-orange-700 uppercase">Pilih Aplikasi Merchant</label>
                                <select value={form.source} onChange={e=>setForm({...form, source: e.target.value})} className="w-full p-3 bg-white border border-orange-200 rounded-xl text-xs font-bold mt-1 uppercase outline-none">
                                    <option value="GOFOOD">GoFood</option>
                                    <option value="SHOPEEFOOD">ShopeeFood</option>
                                    <option value="GRABFOOD">GrabFood</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-bold text-orange-700 uppercase">Nomor ID Pesanan Aplikasi</label>
                                <input type="text" required={isMerchant} value={form.invoice_no} onChange={e=>setForm({...form, invoice_no: e.target.value.toUpperCase()})} placeholder="Contoh: APL-89234" className="w-full p-3 bg-white border border-orange-200 rounded-xl text-xs font-bold mt-1 outline-none" />
                            </div>
                            <div className="md:col-span-4 border-b border-orange-100 my-1"></div>
                        </>
                    )}

                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Kuantitas Porsi / Pcs</label>
                        <input type="number" required min="1" value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-3 border rounded-xl font-black text-slate-800 mt-1 outline-none" />
                    </div>

                    <div className="md:col-span-2 relative group">
                        <label className={`text-[10px] font-bold uppercase flex items-center gap-1 ${isManualPrice ? 'text-orange-600' : 'text-slate-500'}`}>
                            {isManualPrice ? <Edit3 size={12}/> : <Lock size={12} className="text-emerald-500"/>} 
                            {isManualPrice ? 'Harga Aktual Merchant (Bebas Input)' : 'Harga Buku Menu Terkunci'}
                        </label>
                        <div className="relative mt-1">
                          <span className="absolute left-4 top-3.5 font-black text-slate-400">Rp</span>
                          <input 
                              type="text" 
                              required
                              readOnly={!isManualPrice} 
                              value={form.price ? Number(form.price).toLocaleString('id-ID') : ''} 
                              onChange={(e) => isManualPrice && setForm({...form, price: e.target.value.replace(/\D/g, '')})}
                              className={`w-full pl-10 p-3 border rounded-xl font-black outline-none transition-colors ${!isManualPrice ? 'bg-slate-200/60 border-slate-200 text-slate-600 cursor-not-allowed' : 'bg-white border-orange-200 text-slate-900 focus:ring-2 focus:ring-orange-500'}`} 
                          />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Metode Kas Masuk</label>
                        <select value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-full p-3 bg-white border rounded-xl text-xs font-bold mt-1 outline-none">
                            <option value="CASH">CASH (Laci Tunai)</option>
                            <option value="TF">TF (Transfer Mandiri / BCA)</option>
                            <option value="PIUTANG">PIUTANG (Mengambang di Ojek Online)</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Nama Pelanggan / Catatan Meja</label>
                    <input type="text" value={form.customer_name} onChange={e=>setForm({...form, customer_name: e.target.value})} className="w-full p-3 border bg-slate-50 rounded-xl font-bold text-sm uppercase mt-1 outline-none" />
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 rounded-2xl p-5 mt-6 shadow-xl">
                    <div>
                        <div className="text-[10px] font-black uppercase text-emerald-400">Total Tagihan Nota</div>
                        <div className="text-3xl font-black text-emerald-400">{formatRp(totalGross)}</div>
                    </div>
                    <button type="submit" className="w-full md:w-auto bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-8 py-4 rounded-xl uppercase tracking-wide text-xs flex items-center justify-center gap-2 transition">
                        <CheckCircle size={18}/> Rekam Nota & Potong Freezer
                    </button>
                </div>
            </form>
         </div>
      </div>

      {/* LOG TRANSAKSI */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
         <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Log Transaksi Kasir Node Resto</h4></div>
         <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
               <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase">
                  <tr><th>Tgl & ID</th><th>Pelanggan/Meja</th><th>Kategori Menu</th><th className="text-center">Pembayaran</th><th className="text-center">Volume</th><th className="text-right">Total Aktual</th><th className="text-center">Aksi</th></tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-xs font-bold">
                  {currentData.length === 0 ? (
                      <tr><td colSpan="7" className="text-center py-8 text-slate-400 font-bold">Belum ada transaksi di cabang ini.</td></tr>
                  ) : (
                      currentData.map(o => (
                         <tr key={o.id} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3"><div>{o.date}</div><div className="text-[9px] text-slate-400 font-mono mt-0.5">{o.invoice_no || o.id}</div></td>
                            <td className="px-4 py-3"><div className="font-black uppercase text-slate-800">{o.customer_name}</div></td>
                            <td className="px-4 py-3">
                                <div className="px-2 py-0.5 rounded bg-amber-100 text-[9px] font-black uppercase text-amber-800 w-max mb-0.5">{o.itemName || 'DIMSUM'}</div>
                                <div className="text-[9px] text-slate-500">{o.sales_category} • {o.source}</div>
                            </td>
                            <td className="px-4 py-3 text-center">
                                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 text-slate-700">{o.paymentMethod}</span>
                            </td>
                            <td className="px-4 py-3 text-center text-slate-700 font-black">{o.qty} Pcs</td>
                            <td className="px-4 py-3 text-right text-emerald-600 font-black">{formatRp(o.total)}</td>
                            <td className="px-4 py-3 flex items-center justify-center gap-2">
                                <button type="button" onClick={() => setPrintData({ type: 'INVOICE', data: o })} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><Printer size={14}/></button>
                                <button type="button" onClick={() => requestDelete(o.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded hover:bg-rose-100" title="Void Nota"><AlertTriangle size={14}/></button>
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
