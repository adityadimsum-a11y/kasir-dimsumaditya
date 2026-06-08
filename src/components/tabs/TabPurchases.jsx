import React, { useState } from 'react';
import { Truck, Package, Database, ShieldAlert, Trash2, Printer } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';

// TAMBAHKAN setPrintData dan requestDelete DI PROPS BAWAAN
export default function TabPurchases({ purchases, masterSuppliers, masterRawMaterials, sendToSheet, showToast, setPrintData, requestDelete, user }) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'PUSAT';

  const [form, setForm] = useState({
      date: todayStr, supplierName: '', itemName: '', qty: '', unit: 'KG', price: '', paidAmount: '', paymentMethod: 'CASH'
  });

  const totalTagihan = Number(form.qty || 0) * Number(form.price || 0);
  const dpDibayar = Number(form.paidAmount || 0);
  const sisaHutang = totalTagihan - dpDibayar;
  const isHutang = sisaHutang > 0;

  const handleCurrencyChange = (field, value) => {
      const rawValue = value.replace(/\D/g, ''); 
      setForm(prev => ({ ...prev, [field]: rawValue }));
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      if (!form.supplierName || !form.itemName || Number(form.qty) <= 0 || Number(form.price) <= 0) {
          alert("Mohon isi Kuantitas dan Harga Satuan!"); return;
      }

      const upperSupplier = form.supplierName.toUpperCase();
      const upperItem = form.itemName.toUpperCase();

      const purchaseId = generateId('PUR', form.date);
      const purchasePayload = {
          id: purchaseId, date: form.date, branch_id: currentBranch,
          supplierName: upperSupplier, supplier_name: upperSupplier,
          itemName: upperItem, item_name: upperItem,
          qty: Number(form.qty), unit: form.unit, price: Number(form.price),
          totalAmount: totalTagihan, total_amount: totalTagihan,
          paidAmount: dpDibayar, paid_amount: dpDibayar,
          paymentMethod: form.paymentMethod, payment_method: form.paymentMethod,
          paymentStatus: isHutang ? 'HUTANG' : 'LUNAS', payment_status: isHutang ? 'HUTANG' : 'LUNAS'
      };

      const success = await sendToSheet('insert', purchasePayload, 'purchases');
      
      if (success) {
          if (isHutang) {
              await sendToSheet('insert', {
                  id: generateId('AP', form.date), date: form.date, branch_id: currentBranch, 
                  supplier_name: upperSupplier, transaction_type: 'PURCHASE', amount: sisaHutang, 
                  reference_id: purchaseId, notes: `Hutang Beli ${form.qty} ${form.unit} ${upperItem}`
              }, 'supplier_ledger');
          }

          await sendToSheet('insert', {
              id: generateId('MOV-IN', form.date), date: form.date, branch_id: currentBranch,
              item_name: upperItem, from_location: 'SUPPLIER', to_location: `${currentBranch}_GUDANG`,
              qty: Number(form.qty), unit: form.unit, movement_type: 'PURCHASE_RECEIPT', reference_id: purchaseId
          }, 'stock_movements');

          setForm({ date: todayStr, supplierName: '', itemName: '', qty: '', unit: 'KG', price: '', paidAmount: '', paymentMethod: 'CASH' });
      }
  };

  const validPurchases = (purchases || []).filter(p => !p.isDeleted).sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
         {/* ... BAGIAN FORM INPUT (SAMA SEPERTI SEBELUMNYA) ... */}
         <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
            <h3 className="font-black text-white text-sm tracking-wide uppercase flex items-center gap-2">
                <Truck size={18} className="text-blue-400"/> Input Pembelian Logistik
            </h3>
         </div>
         
         <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Tgl Beli</label>
                        <input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-bold mt-1" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-blue-600 uppercase">Nama Supplier</label>
                        <input list="supplier-list" required placeholder="Contoh: NANA AYAM" value={form.supplierName} onChange={e=>setForm({...form, supplierName: e.target.value})} className="w-full p-2.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-sm font-black mt-1 uppercase outline-none" />
                        <datalist id="supplier-list">
                            {(masterSuppliers || []).map((s, i) => <option key={i} value={s.supplier_name || s.supplierName} />)}
                        </datalist>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-4 border-b">
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Bahan Baku</label>
                        <input list="item-list" required placeholder="Contoh: AYAM FILLET" value={form.itemName} onChange={e=>setForm({...form, itemName: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl text-sm font-black mt-1 uppercase outline-none" />
                        <datalist id="item-list">
                            {(masterRawMaterials || []).map((m, i) => <option key={i} value={m.raw_name || m.itemName} />)}
                        </datalist>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Kuantitas Masuk</label>
                        <input type="number" required min="0.1" step="any" value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 border rounded-xl font-black mt-1 text-slate-800" placeholder="0" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Satuan</label>
                        <select value={form.unit} onChange={e=>setForm({...form, unit: e.target.value})} className="w-full p-2.5 bg-white border rounded-xl text-xs font-bold mt-1">
                            <option value="KG">Kilogram (KG)</option><option value="PCS">Pieces (Pcs)</option><option value="PACK">Pack / Bal</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Harga Satuan (Modal)</label>
                        <div className="relative mt-1"><span className="absolute left-3 top-2.5 font-black text-slate-400">Rp</span><input type="text" required value={form.price ? Number(form.price).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange('price', e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-white border rounded-xl font-black" placeholder="0" /></div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-emerald-600 uppercase">DP Dibayar Hari Ini</label>
                        <div className="relative mt-1"><span className="absolute left-3 top-2.5 font-black text-emerald-400">Rp</span><input type="text" value={form.paidAmount ? Number(form.paidAmount).toLocaleString('id-ID') : ''} onChange={e=>handleCurrencyChange('paidAmount', e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl font-black text-emerald-700 outline-none" placeholder="Kosongkan jika hutang penuh" /></div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Metode Kas Keluar</label>
                        <select value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-full p-2.5 bg-white border rounded-xl text-xs font-bold mt-1"><option value="CASH">Kas Tunai / Laci</option><option value="TRANSFER">Transfer Bank</option></select>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 rounded-xl p-4 mt-6 shadow-xl">
                    <div>
                        <div className="text-[9px] font-black uppercase text-slate-400">Total Tagihan Belanja</div>
                        <div className="text-2xl font-black text-white">{formatRp(totalTagihan)}</div>
                    </div>
                    <button type="submit" className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-3.5 rounded-xl uppercase tracking-wide text-xs flex items-center justify-center gap-2 shadow-lg">
                        <Package size={16}/> Masukkan Gudang
                    </button>
                </div>
            </form>
         </div>
      </div>

      {/* TABEL RIWAYAT BELANJA + TOMBOL AKSI */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mt-6">
         <div className="p-4 border-b bg-slate-50"><h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Riwayat Belanja Bahan Baku</h4></div>
         <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
               <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase">
                  <tr><th>Tanggal</th><th>Supplier</th><th>Item</th><th className="text-center">Kuantitas</th><th className="text-right">Total Tagihan</th><th className="text-center">Status</th><th className="text-center">Aksi</th></tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-xs font-bold">
                  {validPurchases.length === 0 ? (
                      <tr><td colSpan="7" className="text-center py-6 text-slate-400 font-bold">Belum ada data transaksi.</td></tr>
                  ) : (
                      validPurchases.slice(0, 50).map(p => {
                          const sName = p.supplierName || p.supplier_name || 'UNKNOWN';
                          const iName = p.itemName || p.item_name || 'UNKNOWN';
                          const tAmt = Number(p.totalAmount || p.total_amount || 0);
                          const pAmt = Number(p.paidAmount || p.paid_amount || 0);
                          const pStatus = p.paymentStatus || p.payment_status || 'LUNAS';
                          const sHutang = tAmt - pAmt;

                          return (
                             <tr key={p.id} className="hover:bg-slate-50 transition">
                                <td className="px-4 py-3">{formatDate(p.date)}</td>
                                <td className="px-4 py-3 font-black uppercase text-slate-800">{sName}</td>
                                <td className="px-4 py-3 text-slate-600 uppercase">{iName}</td>
                                <td className="px-4 py-3 text-center text-blue-600 font-black">{p.qty} {p.unit}</td>
                                <td className="px-4 py-3 text-right text-slate-800 font-black">{formatRp(tAmt)}</td>
                                <td className="px-4 py-3 text-center">
                                    {pStatus === 'LUNAS' || sHutang <= 0 ? 
                                      <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase">Lunas</span> : 
                                      <div className="flex flex-col items-center"><span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-black uppercase">Hutang</span><span className="text-[8px] text-rose-500 mt-0.5">Sisa: {formatRp(sHutang)}</span></div>
                                    }
                                </td>
                                {/* TOMBOL AKSI: PRINT DAN HAPUS */}
                                <td className="px-4 py-3 flex items-center justify-center gap-2">
                                    <button onClick={() => setPrintData({ type: 'PURCHASE', data: p })} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition" title="Print Bukti">
                                        <Printer size={14} />
                                    </button>
                                    <button onClick={() => requestDelete(p.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded hover:bg-rose-100 transition" title="Batalkan (Void)">
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                             </tr>
                          )
                      })
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
