import React, { useState, useMemo, useEffect } from 'react';
import { ShoppingCart, CheckCircle, Clock, Printer, Receipt, Store, Smartphone, AlertCircle, Percent } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';
import SearchableDropdown from '../ui/SearchableDropdown';
import PaginationController from '../ui/PaginationController';

export default function TabOrders({ orders, masterProducts, sendToSheet, setPrintData, requestDelete, role, showToast, user }) {
  const todayStr = getTodayStr();

  // =====================================
  // STATE KASIR (PHASE 12.5)
  // =====================================
  const [form, setForm] = useState({
      date: todayStr,
      sales_category: 'ECERAN', // MITRA, RESELLER, ECERAN, MERCHANT, TOKO_ONLINE
      source: 'OFFLINE', // OFFLINE, SHOPEEFOOD, GOFOOD, GRABFOOD, TOKOPEDIA, DLL
      customer_name: '',
      invoice_no: '',
      
      qty: 50,
      price: '3000', // Auto-lock untuk Tier, Kosong untuk Marketplace
      
      gross_sales: '', // Untuk Marketplace (Omzet Kotor di Nota)
      marketplace_admin_fee: '', 
      marketplace_promo: '',
      
      paymentMethod: 'CASH'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // =====================================
  // AUTO-CALCULATION ENGINE
  // =====================================
  const isMarketplace = form.sales_category === 'MERCHANT' || form.sales_category === 'TOKO_ONLINE';

  const totalGross = useMemo(() => {
      if (!isMarketplace) return Number(form.qty) * Number(form.price);
      return Number(form.gross_sales || 0);
  }, [form.qty, form.price, form.gross_sales, isMarketplace]);

  const netReceived = useMemo(() => {
      const fee = Number(form.marketplace_admin_fee || 0);
      const promo = Number(form.marketplace_promo || 0);
      return totalGross - fee - promo;
  }, [totalGross, form.marketplace_admin_fee, form.marketplace_promo]);


  // =====================================
  // HANDLERS
  // =====================================
  const handleCurrencyChange = (field, value) => {
      const rawValue = value.replace(/\D/g, ''); 
      setForm(prev => ({ ...prev, [field]: rawValue }));
  };

  const handleCategoryChange = (e) => {
      const cat = e.target.value;
      let newPrice = ''; let newSource = 'OFFLINE'; let newPayMethod = 'CASH';

      if (cat === 'MITRA') { newPrice = '2000'; }
      else if (cat === 'RESELLER') { newPrice = '2125'; }
      else if (cat === 'ECERAN') { newPrice = '3000'; }
      else if (cat === 'MERCHANT') { newSource = 'SHOPEEFOOD'; newPayMethod = 'MARKETPLACE'; }
      else if (cat === 'TOKO_ONLINE') { newSource = 'TOKOPEDIA'; newPayMethod = 'MARKETPLACE'; }

      setForm(prev => ({
          ...prev, sales_category: cat, price: newPrice, source: newSource, paymentMethod: newPayMethod,
          gross_sales: '', marketplace_admin_fee: '', marketplace_promo: ''
      }));
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      
      if(Number(form.qty) <= 0) { showToast('⛔ Qty tidak boleh kosong!', 'error'); return; }
      if(isMarketplace && !form.invoice_no) { showToast('⛔ Nomor Invoice / Order ID Marketplace wajib diisi!', 'error'); return; }

      const payload = {
          id: generateId('INV', form.date),
          date: form.date,
          branch_id: user?.branch_id || 'PUSAT',
          sales_category: form.sales_category,
          source: form.source,
          customer_name: form.customer_name || form.sales_category,
          invoice_no: form.invoice_no,
          
          qty: Number(form.qty),
          total: totalGross,
          
          marketplace_admin_fee: Number(form.marketplace_admin_fee || 0),
          marketplace_promo: Number(form.marketplace_promo || 0),
          paymentMethod: form.paymentMethod
      };

      const success = await sendToSheet('event_order', payload, 'orders');
      if (success) {
          setForm(prev => ({ ...prev, qty: 50, customer_name: '', invoice_no: '', gross_sales: '', marketplace_admin_fee: '', marketplace_promo: '' }));
      }
  };

  // Pagination Logic
  const validOrders = (orders || []).filter(o => !o.isDeleted).sort((a,b) => new Date(b.date) - new Date(a.date));
  const totalRows = validOrders.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const currentData = validOrders.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">

      {/* 1. KASIR ENGINE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
            <h3 className="font-black text-white text-lg tracking-wide uppercase flex items-center gap-2">
                <ShoppingCart size={20} className="text-amber-400"/> Sistem Kasir Penjualan
            </h3>
            <div className="text-[10px] font-bold text-slate-400 uppercase bg-slate-800 px-3 py-1 rounded-full">Phase 12.5 Active</div>
         </div>
         
         <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* BARIS 1: KATEGORI & TANGGAL */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Tgl Transaksi</label>
                        <input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-bold mt-1" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Kategori Pricing (Tier)</label>
                        <select value={form.sales_category} onChange={handleCategoryChange} className="w-full p-2.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-sm font-black mt-1 uppercase outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="ECERAN">ECERAN (Harga Standar)</option>
                            <option value="RESELLER">RESELLER (Mitra Lepas)</option>
                            <option value="MITRA">MITRA (Cabang/Tetap)</option>
                            <option value="MERCHANT" className="bg-orange-100 text-orange-800">MERCHANT (GoFood/ShopeeFood/GrabFood)</option>
                            <option value="TOKO_ONLINE" className="bg-purple-100 text-purple-800">TOKO ONLINE (Tokopedia/TikTok)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Nama / Identitas Pelanggan (Opsional)</label>
                        <input type="text" placeholder="Cth: Pak Budi / Kode Resi" value={form.customer_name} onChange={e=>setForm({...form, customer_name: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-bold mt-1 uppercase" />
                    </div>
                </div>

                {/* BARIS 2: DINAMIS BERDASARKAN KATEGORI (OFFLINE TIER VS MARKETPLACE) */}
                {!isMarketplace ? (
                    // --- MODE OFFLINE TIER (LOCK HARGA) ---
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border">
                        <div className="md:col-span-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Kuantitas Terjual</label>
                            <div className="relative mt-1">
                                <input type="number" required min="1" value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 border rounded-xl font-black text-slate-800 outline-none" />
                                <span className="absolute right-4 top-2.5 text-xs font-black text-slate-400">PCS</span>
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-bold text-emerald-600 uppercase">Harga Jual Auto-Lock (Per Pcs)</label>
                            <div className="relative mt-1">
                                <span className="absolute left-4 top-2.5 font-black text-slate-400">Rp</span>
                                <input type="text" readOnly value={Number(form.price).toLocaleString('id-ID')} className="w-full pl-10 p-2.5 bg-emerald-50/50 border border-emerald-200 rounded-xl font-black text-emerald-800 cursor-not-allowed" />
                            </div>
                            <div className="text-[9px] text-slate-500 mt-1 flex items-center gap-1"><CheckCircle size={10} className="text-emerald-500"/> Terkunci berdasarkan sistem Tier.</div>
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Metode Pembayaran</label>
                            <select value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-full p-2.5 bg-white border rounded-xl text-xs font-bold mt-1">
                                <option value="CASH">Tunai / Cash</option>
                                <option value="TRANSFER">Transfer Bank / Qris</option>
                            </select>
                        </div>
                    </div>
                ) : (
                    // --- MODE MARKETPLACE / MERCHANT (INPUT MANUAL REVENUE) ---
                    <div className="space-y-4 bg-orange-50/50 p-4 rounded-xl border border-orange-200">
                        <div className="flex items-center gap-2 mb-2 text-orange-800">
                            <Smartphone size={18}/>
                            <h4 className="font-black text-sm uppercase tracking-wide">Input Settlement Aplikasi</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-orange-700 uppercase">Platform Aplikasi</label>
                                <select value={form.source} onChange={e=>setForm({...form, source: e.target.value})} className="w-full p-2.5 bg-white border border-orange-200 rounded-xl text-xs font-bold mt-1 uppercase">
                                    {form.sales_category === 'MERCHANT' ? (
                                        <><option value="SHOPEEFOOD">ShopeeFood</option><option value="GOFOOD">GoFood</option><option value="GRABFOOD">GrabFood</option></>
                                    ) : (
                                        <><option value="TOKOPEDIA">Tokopedia</option><option value="TIKTOK_SHOP">TikTok Shop</option><option value="SHOPEE">Shopee Online</option></>
                                    )}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-orange-700 uppercase">No. Invoice / Order ID</label>
                                <input type="text" required value={form.invoice_no} onChange={e=>setForm({...form, invoice_no: e.target.value.toUpperCase()})} placeholder="Cth: ORD-12345" className="w-full p-2.5 bg-white border border-orange-200 rounded-xl text-xs font-bold mt-1 uppercase" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Dimsum Keluar</label>
                                <div className="relative mt-1">
                                    <input type="number" required min="1" value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 border rounded-xl font-black text-slate-800" />
                                    <span className="absolute right-4 top-2.5 text-xs font-black text-slate-400">PCS</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Total Tagihan Kotor Nota</label>
                                <div className="relative mt-1">
                                    <span className="absolute left-3 top-2.5 font-black text-slate-400">Rp</span>
                                    <input type="text" required placeholder="0" value={form.gross_sales ? Number(form.gross_sales).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange('gross_sales', e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-white border rounded-xl font-black text-slate-800 focus:ring-2 focus:ring-orange-500 outline-none" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            <div>
                                <label className="text-[10px] font-bold text-rose-600 uppercase flex items-center gap-1"><Percent size={10}/> Potongan Admin (Fee Aplikasi)</label>
                                <div className="relative mt-1">
                                    <span className="absolute left-3 top-2.5 font-black text-rose-300">Rp</span>
                                    <input type="text" required placeholder="0" value={form.marketplace_admin_fee ? Number(form.marketplace_admin_fee).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange('marketplace_admin_fee', e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-rose-50 border border-rose-200 rounded-xl font-black text-rose-700 focus:ring-2 focus:ring-rose-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1"><Receipt size={10}/> Tanggungan Promo Merchant</label>
                                <div className="relative mt-1">
                                    <span className="absolute left-3 top-2.5 font-black text-amber-300">Rp</span>
                                    <input type="text" placeholder="0" value={form.marketplace_promo ? Number(form.marketplace_promo).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange('marketplace_promo', e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl font-black text-amber-700 focus:ring-2 focus:ring-amber-500 outline-none" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* BARIS 3: TOTAL & SUBMIT */}
                <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 rounded-xl border border-slate-800 p-4 mt-6 shadow-xl">
                    <div className="flex items-center gap-6 text-white mb-4 md:mb-0 w-full md:w-auto">
                        <div>
                            <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Gross / Kotor</div>
                            <div className="text-xl font-bold text-slate-300">{formatRp(totalGross)}</div>
                        </div>
                        {isMarketplace && (
                            <>
                                <div className="text-slate-600 font-light text-2xl">-</div>
                                <div>
                                    <div className="text-[9px] font-black uppercase text-rose-400 tracking-widest">Fee + Promo</div>
                                    <div className="text-xl font-bold text-rose-400">{formatRp((Number(form.marketplace_admin_fee)||0) + (Number(form.marketplace_promo)||0))}</div>
                                </div>
                            </>
                        )}
                        <div className="text-slate-600 font-light text-2xl">=</div>
                        <div>
                            <div className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">Net Masuk (Revenue)</div>
                            <div className="text-3xl font-black text-emerald-400">{formatRp(netReceived)}</div>
                        </div>
                    </div>
                    
                    <button type="submit" className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-3.5 rounded-xl shadow-md transition uppercase tracking-wide text-xs flex items-center justify-center gap-2">
                        <CheckCircle size={16}/> Rekam & Potong Stok
                    </button>
                </div>

            </form>
         </div>
      </div>

      {/* 2. TABEL RIWAYAT TRANSAKSI */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
         <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
            <h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm flex items-center gap-2"><Store size={18} className="text-slate-500"/> Riwayat Transaksi Keluar</h4>
         </div>
         <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
               <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase">
                  <tr>
                     <th className="px-4 py-3">ID & Waktu</th>
                     <th className="px-4 py-3">Pelanggan & Sumber</th>
                     <th className="px-4 py-3 text-center">Kategori (Tier)</th>
                     <th className="px-4 py-3 text-center">Qty</th>
                     <th className="px-4 py-3 text-right">Omzet Kotor</th>
                     <th className="px-4 py-3 text-right">Net Revenue</th>
                     <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {currentData.length === 0 ? <tr><td colSpan="7" className="text-center py-8 text-slate-400">Tidak ada transaksi.</td></tr> : 
                  currentData.map(o => (
                     <tr key={o.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3">
                            <div className="font-bold text-slate-700">{formatDate(o.date)}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{o.invoice_no || o.id}</div>
                        </td>
                        <td className="px-4 py-3">
                            <div className="font-black uppercase text-slate-800 text-xs">{o.customer_name}</div>
                            <div className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1">
                                {(o.sales_category === 'MERCHANT' || o.sales_category === 'TOKO_ONLINE') ? <Smartphone size={10}/> : <Store size={10}/>} {o.source}
                            </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${o.sales_category==='MITRA'?'bg-purple-100 text-purple-800':o.sales_category==='RESELLER'?'bg-blue-100 text-blue-800':o.sales_category==='MERCHANT'?'bg-orange-100 text-orange-800':'bg-slate-100 text-slate-800'}`}>{o.sales_category}</span>
                        </td>
                        <td className="px-4 py-3 text-center font-black text-slate-700">{o.qty} Pcs</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-500">{formatRp(o.total)}</td>
                        <td className="px-4 py-3 text-right">
                            <div className="font-black text-emerald-600">{formatRp(Number(o.total) - (Number(o.fee_amount)||0) - (Number(o.marketplace_promo)||0))}</div>
                            {Number(o.fee_amount) > 0 && <div className="text-[9px] text-rose-500 font-bold">-Fee: {formatRp(o.fee_amount)}</div>}
                        </td>
                        <td className="px-4 py-3 text-center flex justify-center gap-2">
                           <button type="button" onClick={() => setPrintData({ type: 'INVOICE', data: o })} className="bg-slate-100 text-slate-700 p-1.5 rounded-lg hover:bg-slate-200" title="Cetak Struk"><Printer size={14}/></button>
                           {(role === 'super_admin' || role === 'admin') && (
                             <button type="button" onClick={() => requestDelete(o.id)} className="bg-rose-50 text-rose-600 p-1.5 hover:bg-rose-100 rounded-lg">Hapus</button>
                           )}
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>

         <PaginationController 
            currentPage={currentPage}
            totalPages={totalPages}
            totalRows={totalRows}
            rowsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={setRowsPerPage}
         />
      </div>
    </div>
  );
}
