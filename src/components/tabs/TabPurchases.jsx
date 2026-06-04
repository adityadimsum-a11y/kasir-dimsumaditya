import React, { useState, useMemo } from 'react';
import { Truck, Plus, X, Trash2, Printer, Filter, CreditCard } from 'lucide-react';
import { getTodayStr, formatRp, parseRp, generateId, getLocalYMD, safeSort, formatDate } from '../../utils/helpers';

export default function TabPurchases({ purchases, payments, sendToSheet, requestDelete, setPrintData }) {
  const [showForm, setShowForm] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);

  const todayStr = getTodayStr();
  const [date, setDate] = useState(todayStr);
  const [supplier, setSupplier] = useState('');
  
  const [cart, setCart] = useState([{ itemName: '', qty: '', satuan: 'KG', price: 0 }]);
  const [paymentList, setPaymentList] = useState([]);

  const [filterFrom, setFilterFrom] = useState(todayStr);
  const [filterTo, setFilterTo] = useState(todayStr);

  const cartTotal = cart.reduce((sum, item) => sum + ((Number(item.qty)||0) * (Number(item.price)||0)), 0);
  const totalDibayar = paymentList.reduce((sum, p) => sum + (Number(p.amount)||0), 0);

  const listSupplierUnik = [...new Set((purchases||[]).map(s => String(s?.supplier||'').toUpperCase()))];

  const updateCartItem = (index, field, value) => { const newCart = [...cart]; newCart[index][field] = value; setCart(newCart); };
  const addCartRow = () => setCart([...cart, { itemName: '', qty: '', satuan: 'KG', price: 0 }]);
  const removeCartRow = (index) => setCart(cart.filter((_, i) => i !== index));

  const updatePaymentItem = (index, field, value) => { const newList = [...paymentList]; newList[index][field] = value; setPaymentList(newList); };
  const addPaymentRow = () => setPaymentList([...paymentList, { method: 'Cash', amount: '', date: todayStr }]);
  const removePaymentRow = (index) => setPaymentList(paymentList.filter((_, i) => i !== index));

  let autoStatusBayar = 'BELUM BAYAR';
  if (cartTotal > 0 && totalDibayar >= cartTotal) autoStatusBayar = 'LUNAS';
  else if (totalDibayar > 0 && totalDibayar < cartTotal) autoStatusBayar = 'DP / SEBAGIAN';

  const resetForm = () => {
    setShowForm(false); setIsEdit(false); setEditId(null);
    setDate(todayStr); setSupplier(''); 
    setCart([{ itemName: '', qty: '', satuan: 'KG', price: 0 }]); setPaymentList([]);
  };

  const handleEdit = (item) => {
    const relatedItems = (purchases||[]).filter(p => p.id === item.id);
    setDate(String(item.date).split('T')[0]); setSupplier(item.supplier);
    setCart(relatedItems.map(p => ({ itemName: p.itemName, qty: p.qty, satuan: p.satuan, price: p.price })));
    
    let loadedPayments = [];
    try { loadedPayments = JSON.parse(item.paymentMethod); } 
    catch(e) { if (Number(item.paidAmount) > 0) loadedPayments = [{ method: item.paymentMethod || 'Cash', amount: item.paidAmount, date: String(item.date).split('T')[0] }]; }
    setPaymentList(loadedPayments);

    setEditId(item.id); setIsEdit(true); setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSimpan = (e) => {
    e.preventDefault();
    const invoiceId = isEdit ? editId : generateId('BUY', date);
    if(isEdit) sendToSheet('delete', { id: editId }, 'purchases');

    const validPayments = paymentList.filter(p => Number(p.amount) > 0);
    const paymentDataString = validPayments.length > 0 ? JSON.stringify(validPayments) : '-';

    const newPurchasesArray = cart.filter(item => Number(item.qty) > 0).map((item, index) => ({
        id: invoiceId, date, supplier: supplier.toUpperCase(),
        itemName: String(item.itemName).toUpperCase(), satuan: String(item.satuan).toUpperCase(),
        qty: Number(item.qty) || 0, price: Number(item.price) || 0, total: (Number(item.qty) || 0) * (Number(item.price) || 0),
        paymentMethod: index === 0 ? paymentDataString : '-', paidAmount: index === 0 ? totalDibayar : 0, editCount: 0
    }));

    if (newPurchasesArray.length > 0) sendToSheet('insert', newPurchasesArray, 'purchases');
    resetForm();
  };

  const handlePrint = (pur) => {
      const cicilan = (payments || []).filter(p => p.orderId === pur.id);
      let basePayments = [];
      try { basePayments = JSON.parse(pur.paymentMethod); } catch(e) { if(pur.paidAmount > 0) basePayments = [{ method: pur.paymentMethod, amount: pur.paidAmount, date: pur.date }]; }
      const allPayments = [...basePayments, ...cicilan.map(c => ({ method: c.paymentMethod, amount: c.amount, date: c.date }))];
      setPrintData({ type: 'purchase', data: { ...pur, allPayments } });
  };

  const displayPurchases = useMemo(() => {
    let filtered = (purchases||[]).filter(p => { const ymd = getLocalYMD(p?.date); return ymd && ymd >= filterFrom && ymd <= filterTo; });
    const groups = {};
    filtered.forEach(p => {
        if(!p?.id) return;
        if(!groups[p.id]) groups[p.id] = { ...p, items: [], totalAll: 0 };
        groups[p.id].items.push(`${p.itemName} (${p.qty} ${p.satuan})`); groups[p.id].totalAll += Number(p.total);
    });
    return Object.values(groups).sort(safeSort);
  }, [purchases, filterFrom, filterTo]);

  return (
    <div className="space-y-4 animate-in fade-in pb-10">
      <div className="flex justify-between items-center">
        <div><h3 className="font-bold text-lg text-slate-800">Pembelian Bahan Baku</h3></div>
        <button onClick={() => { if(showForm) resetForm(); else setShowForm(true); }} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm text-white ${showForm ? 'bg-slate-500' : 'bg-orange-600'}`}>{showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Batal' : 'Buat Pembelian'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleSimpan} className="bg-white p-6 rounded-xl border border-orange-200 shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="lg:col-span-2 mb-2 border-b border-slate-100 pb-2 flex justify-between items-center"><h4 className="font-bold text-orange-800 text-sm flex gap-2"><Truck size={16}/> Form {isEdit ? 'Edit' : 'Input'} Pembelian (Otomatis Masuk Gudang)</h4><button type="button" onClick={resetForm} className="text-slate-400 hover:text-red-500"><X size={18}/></button></div>
          
          <div className="space-y-4">
              <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Tanggal Beli</label><input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-200" /></div>
              <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Nama Supplier</label><input type="text" list="supp-list" required placeholder="Contoh: Toko Berkah..." value={supplier} onChange={e => setSupplier(e.target.value)} className="w-full p-2 border rounded-lg uppercase" /><datalist id="supp-list">{listSupplierUnik.map(b => <option key={b} value={b} />)}</datalist></div>
              
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                 <div className="flex justify-between items-center mb-3"><h4 className="font-bold text-sm text-orange-900">Rincian Barang</h4><button type="button" onClick={addCartRow} className="bg-white px-3 py-1 text-xs font-bold text-orange-600 border border-orange-300 rounded hover:bg-orange-100 transition">+ Tambah Barang</button></div>
                 <div className="space-y-2">
                     {cart.map((item, index) => (
                         <div key={index} className="flex gap-2 items-center bg-white p-2 rounded-lg border relative pr-8">
                             <div className="w-4/12"><input type="text" required placeholder="Nama Barang" value={item.itemName} onChange={e=>updateCartItem(index, 'itemName', e.target.value)} className="w-full p-1.5 border rounded text-xs uppercase font-bold" /></div>
                             <div className="w-2/12"><input type="number" min="0.1" step="0.1" required placeholder="Qty" value={item.qty} onChange={e=>updateCartItem(index, 'qty', e.target.value)} className="w-full p-1.5 border rounded text-xs font-bold text-center" /></div>
                             <div className="w-2/12"><input type="text" required placeholder="Satuan" value={item.satuan} onChange={e=>updateCartItem(index, 'satuan', e.target.value)} className="w-full p-1.5 border rounded text-xs uppercase text-center" /></div>
                             <div className="w-4/12"><input type="text" required placeholder="Harga Total" value={formatRp(item.price)} onChange={e=>updateCartItem(index, 'price', parseRp(e.target.value))} className="w-full p-1.5 border rounded text-xs font-bold" /></div>
                             {cart.length > 1 && <button type="button" onClick={()=>removeCartRow(index)} className="absolute right-2 top-2.5 text-red-400 hover:text-red-600"><Trash2 size={16}/></button>}
                         </div>
                     ))}
                 </div>
              </div>
          </div>

          <div className="space-y-4 flex flex-col">
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex flex-col justify-center items-center text-center">
                  <label className="text-xs font-bold text-amber-800 uppercase mb-1">Total Belanja (Hutang)</label>
                  <div className="text-4xl font-black text-amber-900">{formatRp(cartTotal)}</div>
              </div>

              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex-1 flex flex-col">
                 <div className="flex justify-between items-center mb-3"><h4 className="font-bold text-sm text-emerald-900 flex items-center gap-2"><CreditCard size={16}/> Riwayat Pembayaran ke Supplier</h4><button type="button" onClick={addPaymentRow} className="bg-white px-3 py-1 text-[10px] font-bold text-emerald-600 border border-emerald-300 rounded hover:bg-emerald-100 transition shadow-sm">+ Tambah Pembayaran</button></div>
                 
                 {paymentList.length === 0 ? (
                     <div className="text-xs text-slate-500 italic text-center py-6 bg-white rounded border border-dashed border-emerald-200 mb-4">Belum ada pembayaran ke Supplier.<br/>Disimpan sebagai Hutang Penuh.</div>
                 ) : (
                     <div className="space-y-2 mb-4">
                         {paymentList.map((item, index) => (
                             <div key={index} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-emerald-200 relative pr-8">
                                 <div className="w-5/12 space-y-1"><select value={item.method} onChange={e=>updatePaymentItem(index, 'method', e.target.value)} className="w-full p-1.5 border rounded text-[10px] uppercase font-bold"><option>Cash</option><option>Transfer Bank</option></select></div>
                                 <div className="w-7/12 space-y-1"><input type="text" required placeholder="Nominal" value={formatRp(item.amount)} onChange={e=>updatePaymentItem(index, 'amount', parseRp(e.target.value))} className="w-full p-1.5 border rounded text-xs font-black text-emerald-700 text-right" /></div>
                                 <button type="button" onClick={()=>removePaymentRow(index)} className="absolute right-2 top-2.5 text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                             </div>
                         ))}
                     </div>
                 )}

                 <div className="border-t border-emerald-200 pt-3 mt-auto">
                     <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-slate-600 uppercase">Total Dibayar</span><span className="font-black text-emerald-700">{formatRp(totalDibayar)}</span></div>
                     <div className="flex justify-between items-center bg-white p-2 rounded border border-emerald-200 shadow-sm"><span className="text-xs font-bold text-slate-500 uppercase">Status Hutang Auto:</span><span className={`px-3 py-1 rounded text-[10px] font-black ${autoStatusBayar === 'LUNAS' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white shadow-md'}`}>{autoStatusBayar}</span></div>
                 </div>
              </div>
          </div>

          <div className="lg:col-span-2 flex justify-end mt-2 pt-4 border-t"><button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-lg font-bold shadow-md w-full md:w-auto">Simpan Data Pembelian</button></div>
        </form>
      )}

      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border shadow-sm mt-4"><Filter size={16} className="text-slate-400"/><input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} className="p-1.5 text-sm border rounded" /> - <input type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)} className="p-1.5 text-sm border rounded" /></div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden mt-4">
        <table className="w-full text-sm text-left block md:table">
          <thead className="bg-slate-50 text-slate-700 text-[10px] uppercase border-b"><tr><th className="px-4 py-3">No. Bukti & Tgl</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Daftar Barang</th><th className="px-4 py-3 text-right">Total Tagihan</th><th className="px-4 py-3 text-center">Status Pembayaran</th><th className="px-4 py-3 text-center">Aksi</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {displayPurchases.length === 0 ? <tr><td colSpan="6" className="text-center py-12 text-slate-400">Tidak ada pembelian ditemukan.</td></tr> : displayPurchases.map((pur) => {
              const cicilan = (payments || []).filter(p => p.orderId === pur.id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
              const totalTerbayar = (Number(pur.paidAmount) || 0) + cicilan;
              const sisaHutang = (Number(pur.totalAll) || 0) - totalTerbayar;
              
              let statusBayarUI = null;
              if (sisaHutang <= 0) { statusBayarUI = <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold">LUNAS</span>; } 
              else if (totalTerbayar > 0) { statusBayarUI = <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold block w-max mx-auto">DP / SEBAGIAN<br/><span className="font-medium text-[9px]">Sisa: {formatRp(sisaHutang)}</span></span>; } 
              else { statusBayarUI = <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold border border-red-200 block w-max mx-auto shadow-sm">HUTANG<br/><span className="font-medium text-[9px]">Sisa: {formatRp(sisaHutang)}</span></span>; }

              let displayVia = pur.paymentMethod;
              try { const parsed = JSON.parse(pur.paymentMethod); displayVia = parsed.map(p => p.method).join(' + '); } catch(e) {}

              return (
              <tr key={pur.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><div className="font-mono text-[11px] font-bold text-slate-700">{pur.id}</div><div className="text-[10px] text-slate-500">{formatDate(pur.date)}</div></td>
                <td className="px-4 py-3 font-bold text-slate-800 uppercase text-xs">{pur.supplier}</td>
                <td className="px-4 py-3"><ul className="list-disc pl-3 text-[10px] font-bold text-slate-600">{(pur.items||[]).map((it,idx)=><li key={idx}>{it}</li>)}</ul></td>
                <td className="px-4 py-3 text-right">
                    <div className="font-bold text-slate-800 text-sm">{formatRp(pur.totalAll)}</div>
                    <div className="text-[9px] text-slate-500 max-w-[80px] truncate ml-auto" title={displayVia}>{displayVia}</div>
                </td>
                <td className="px-4 py-3 text-center">{statusBayarUI}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-1.5">
                    <button onClick={() => handlePrint(pur)} className="text-slate-600 bg-slate-100 p-2 rounded-lg border hover:bg-slate-200 transition shadow-sm" title="Cetak Bukti Restock"><Printer size={16} /></button>
                    <button onClick={() => handleEdit(pur)} className="text-blue-600 bg-blue-50 px-2 py-1 rounded-lg font-bold text-[10px] border border-blue-200 hover:bg-blue-100 transition shadow-sm">EDIT</button>
                    <button onClick={() => requestDelete(pur.id)} className="text-red-500 bg-red-50 p-2 rounded-lg border border-red-200 hover:bg-red-100 transition shadow-sm" title="Hapus Data"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}
