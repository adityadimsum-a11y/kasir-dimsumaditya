import React, { useState, useMemo } from 'react';
import { ShoppingCart, Plus, X, Trash2, Printer, Filter } from 'lucide-react';
import { 
  getTodayStr, getLocalYMD, formatRp, parseRp, 
  KATEGORI_HARGA, generateId, safeSort, formatDate 
} from '../../utils/helpers';

export default function TabOrders({ orders, sendToSheet, setPrintData, requestDelete, role }) {
  const [showForm, setShowForm] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editCount, setEditCount] = useState(0);

  const todayStr = getTodayStr();
  const [date, setDate] = useState(todayStr);
  const [customer, setCustomer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState('');

  const defaultPrice = KATEGORI_HARGA[role === 'branch' ? 'Pemalang' : 'Reseller'];
  const defaultCat = role === 'branch' ? 'Pemalang' : 'Reseller';
  const [cart, setCart] = useState([{ category: defaultCat, qty: '', price: defaultPrice }]);

  // DIKEMBALIKAN KE DEFAULT HARI INI - HARI INI
  const [filterFrom, setFilterFrom] = useState(todayStr);
  const [filterTo, setFilterTo] = useState(todayStr);

  const listPelangganUnik = [...new Set((orders||[]).map(s => String(s?.customer||'').toUpperCase()))];

  const cartTotal = (cart||[]).reduce((sum, item) => sum + ((Number(item?.qty)||0) * (Number(item?.price)||0)), 0);

  const updateCartItem = (index, field, value) => {
      const newCart = [...cart];
      newCart[index][field] = value;
      if (field === 'category') newCart[index].price = KATEGORI_HARGA[value] || 0;
      setCart(newCart);
      const newTot = newCart.reduce((sum, item) => sum + ((Number(item?.qty)||0) * (Number(item?.price)||0)), 0);
      if(paymentMethod !== 'Pending / DP') setPaidAmount(newTot);
  };

  const addCartRow = () => setCart([...cart, { category: defaultCat, qty: '', price: defaultPrice }]);
  const removeCartRow = (index) => {
      const newCart = cart.filter((_, i) => i !== index);
      setCart(newCart);
      const newTot = newCart.reduce((sum, item) => sum + ((Number(item?.qty)||0) * (Number(item?.price)||0)), 0);
      if(paymentMethod !== 'Pending / DP') setPaidAmount(newTot);
  };

  const handlePaymentMethodChange = (e) => {
    const method = e.target.value;
    setPaymentMethod(method);
    if (method !== 'Pending / DP') setPaidAmount(cartTotal); else setPaidAmount(0); 
  };

  const resetForm = () => {
    setShowForm(false); setIsEdit(false); setEditId(null); setEditCount(0);
    setDate(todayStr); setCustomer(''); setNotes('');
    setPaymentMethod('Cash'); setPaidAmount(0);
    setCart([{ category: defaultCat, qty: '', price: defaultPrice }]);
  };

  const handleEdit = (item) => {
    const relatedItems = (orders||[]).filter(p => p.id === item.id);
    setDate(String(item.date).split('T')[0]);
    setCustomer(item.customer); setPaymentMethod(item.paymentMethod); 
    setPaidAmount(item.paidAmount); setNotes(item.notes || '');
    setCart(relatedItems.map(p => ({ category: p.category, qty: p.qty, price: p.price })));
    setEditId(item.id); setEditCount(Number(item.editCount) || 0); setIsEdit(true); setShowForm(true);
  };

  const handleSimpan = (e) => {
    e.preventDefault();
    const invoiceId = isEdit ? editId : generateId('INV', date);
    if(isEdit) sendToSheet('delete', { id: editId }, 'orders');
    
    (cart||[]).forEach((item, index) => {
        if(Number(item?.qty) > 0) {
            const newOrder = {
                id: invoiceId, date, customer: customer.toUpperCase(), 
                category: item.category, qty: Number(item.qty)||0, price: Number(item.price)||0, 
                total: (Number(item.qty)||0)*(Number(item.price)||0), paymentMethod, 
                paidAmount: index === 0 ? (Number(paidAmount)||0) : 0, notes, editCount: isEdit ? editCount + 1 : 0
            };
            setTimeout(() => sendToSheet('insert', newOrder, 'orders'), index * 300);
        }
    });
    setTimeout(() => resetForm(), (cart||[]).length * 300);
  };

  const displayOrders = useMemo(() => {
    let filtered = role === 'branch' ? (orders||[]).filter(o => o?.category === 'Pemalang') : (orders||[]);
    filtered = filtered.filter(o => {
        const ymd = getLocalYMD(o?.date);
        return ymd && ymd >= filterFrom && ymd <= filterTo;
    });
    const groups = {};
    filtered.forEach(p => {
        if(!p?.id) return;
        if(!groups[p.id]) groups[p.id] = { ...p, items: [], totalAll: 0 };
        groups[p.id].items.push(`${p.qty} Pcs`);
        groups[p.id].totalAll += Number(p.total);
    });
    return Object.values(groups).sort(safeSort);
  }, [orders, role, filterFrom, filterTo]);

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div><h3 className="font-bold text-lg text-slate-800">Order & Penjualan {role === 'branch' ? '(Pemalang)' : '(Pusat)'}</h3></div>
        <button onClick={() => { if(showForm) resetForm(); else setShowForm(true); }} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm text-white ${showForm ? 'bg-slate-500 hover:bg-slate-600' : 'bg-red-600 hover:bg-red-700'}`}>
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Batal' : 'Buat Invoice Baru'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSimpan} className="bg-white p-6 rounded-xl border border-red-200 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-3 mb-2 border-b border-slate-100 pb-2"><h4 className="font-bold text-red-800 text-sm flex gap-2"><ShoppingCart size={16}/> Form {isEdit ? 'Edit' : 'Input'} Pesanan</h4></div>
          <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Tanggal Transaksi</label><input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-200" /></div>
          <div className="space-y-1 lg:col-span-2"><label className="text-sm font-medium text-slate-700">Nama Pelanggan / Agen</label><input type="text" list="cust-list" required placeholder="Contoh: Budi, ADE..." value={customer} onChange={e => setCustomer(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-200 uppercase" /><datalist id="cust-list">{listPelangganUnik.map(b => <option key={b} value={b} />)}</datalist></div>
          <div className="lg:col-span-3 bg-red-50 p-4 rounded-xl border border-red-100">
             <div className="flex justify-between items-center mb-3"><h4 className="font-bold text-sm text-red-900">Daftar Barang (Item)</h4><button type="button" onClick={addCartRow} className="bg-white px-3 py-1 text-xs font-bold text-red-600 border border-red-300 rounded shadow-sm">+ Tambah Barang</button></div>
             <div className="space-y-3">
                 {(cart||[]).map((item, index) => (
                     <div key={index} className="flex flex-wrap md:flex-nowrap gap-2 items-center bg-white p-2 rounded-lg border shadow-sm relative pr-8">
                         <div className="w-full md:w-4/12 space-y-1"><select value={item.category} onChange={e=>updateCartItem(index, 'category', e.target.value)} disabled={role === 'branch'} className="w-full p-2 border rounded text-xs uppercase font-bold">{Object.keys(KATEGORI_HARGA).map(k => <option key={k} value={k}>{k}</option>)}</select></div>
                         <div className="w-1/2 md:w-3/12 space-y-1"><input type="number" min="1" required placeholder="Qty (Pcs)" value={item.qty} onChange={e=>updateCartItem(index, 'qty', e.target.value)} className="w-full p-2 border rounded text-xs font-bold text-center" /></div>
                         <div className="w-1/2 md:w-5/12 space-y-1"><input type="text" required placeholder="Harga per Pcs" value={formatRp(item.price)} onChange={e=>updateCartItem(index, 'price', parseRp(e.target.value))} className="w-full p-2 border rounded text-xs font-bold" /></div>
                         {(cart||[]).length > 1 && <button type="button" onClick={()=>removeCartRow(index)} className="absolute right-2 top-3 text-red-400 hover:text-red-600"><Trash2 size={16}/></button>}
                     </div>
                 ))}
             </div>
          </div>
          <div className="space-y-1 bg-amber-50 p-3 rounded-lg border border-amber-200 lg:col-span-3"><label className="text-xs font-bold text-amber-800 uppercase">Total Seluruh Pesanan (Otomatis)</label><input type="text" readOnly value={formatRp(cartTotal)} className="w-full p-3 border border-amber-300 rounded-lg font-bold text-lg bg-white mt-1 text-amber-900 cursor-not-allowed" /></div>
          <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Metode Pembayaran</label><select value={paymentMethod} onChange={handlePaymentMethodChange} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-200"><option value="Cash">Cash / Tunai</option><option value="Transfer">Transfer Bank</option><option value="Pending / DP">Pending (Piutang) / DP</option></select></div>
          <div className="space-y-1"><label className="text-sm font-medium text-slate-700">Uang Diterima / DP (Rp)</label><input type="text" required value={formatRp(paidAmount)} onChange={e => setPaidAmount(parseRp(e.target.value))} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-200 font-bold" /></div>
          <div className="space-y-1 lg:col-span-3"><label className="text-sm font-medium text-slate-700">Catatan Tambahan (Opsional)</label><input type="text" placeholder="Catatan invoice..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-200" /></div>
          <div className="lg:col-span-3 flex justify-end mt-2 pt-4 border-t border-slate-100"><button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition">Simpan {isEdit ? 'Perubahan' : 'Transaksi'}</button></div>
        </form>
      )}

      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border mt-4">
         <Filter size={16} className="text-slate-400"/><span className="text-sm font-bold">Filter:</span>
         <input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} className="p-1.5 text-sm border rounded" /> - 
         <input type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)} className="p-1.5 text-sm border rounded" />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden mt-4">
        <table className="w-full text-sm text-left block md:table">
          <thead className="bg-red-50 text-red-800 text-xs uppercase border-b"><tr><th className="px-4 py-3">No. Invoice & Tgl</th><th className="px-4 py-3">Pelanggan</th><th className="px-4 py-3 text-center">Daftar Qty</th><th className="px-4 py-3 text-center">Via</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-center">Aksi</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {displayOrders.length === 0 ? <tr><td colSpan="7" className="text-center py-12 text-slate-400">Tidak ada transaksi ditemukan.</td></tr> : displayOrders.map((ord) => (
              <tr key={ord.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><div className="font-mono text-xs font-bold text-slate-700">{ord.id}</div><div className="text-xs text-slate-500">{formatDate(ord.date)}</div></td>
                <td className="px-4 py-3 font-bold text-slate-800 uppercase">{ord.customer}</td>
                <td className="px-4 py-3 text-center"><ul className="list-disc pl-3 text-xs text-left">{(ord.items||[]).map((it,idx)=><li key={idx}>{it}</li>)}</ul></td>
                <td className="px-4 py-3 text-center font-medium text-slate-600">{ord.paymentMethod}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatRp(ord.totalAll)}</td>
                <td className="px-4 py-3 text-center">{(Number(ord.totalAll)||0) > (Number(ord.paidAmount)||0) ? <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-[10px] font-bold">PIUTANG</span> : <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold">LUNAS</span>}</td>
                <td className="px-4 py-3 text-center"><div className="flex justify-center gap-2"><button onClick={() => setPrintData({ type: 'invoice', data: ord })} className="text-slate-600 bg-slate-100 p-2 rounded-lg transition" title="Cetak"><Printer size={16} /></button><button onClick={() => handleEdit(ord)} className="text-blue-600 bg-blue-50 px-2 py-1 rounded-lg font-bold text-[10px] transition" title="Edit Data">EDIT</button><button onClick={() => requestDelete(ord.id)} className="text-red-500 bg-red-50 p-2 rounded-lg transition" title="Hapus Data"><Trash2 size={16} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
