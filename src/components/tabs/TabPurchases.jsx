import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, Printer, Filter } from 'lucide-react';
import { 
  getTodayStr, getLocalYMD, formatRp, parseRp, 
  generateId, safeSort, formatDate, SATUAN_BARANG 
} from '../../utils/helpers';

export default function TabPurchases({ purchases, sendToSheet, requestDelete, setPrintData }) {
  const [showForm, setShowForm] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editCount, setEditCount] = useState(0);

  const todayStr = getTodayStr();
  const [date, setDate] = useState(todayStr);
  const [supplier, setSupplier] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState('');

  const [cart, setCart] = useState([{ itemName: '', qty: '', satuan: 'Kg', price: 0 }]);

  // DIKEMBALIKAN KE DEFAULT HARI INI - HARI INI
  const [filterFrom, setFilterFrom] = useState(todayStr);
  const [filterTo, setFilterTo] = useState(todayStr);

  const listSupplierUnik = [...new Set((purchases||[]).map(s => String(s?.supplier||'').toUpperCase()))];
  const listBarangUnik = [...new Set((purchases||[]).map(s => String(s?.itemName||'').toUpperCase()))];

  const cartTotal = (cart||[]).reduce((sum, item) => sum + ((Number(item?.qty)||0) * (Number(item?.price)||0)), 0);

  const updateCartItem = (index, field, value) => {
      const newCart = [...cart];
      newCart[index][field] = value;
      setCart(newCart);
      const newTot = newCart.reduce((sum, item) => sum + ((Number(item?.qty)||0) * (Number(item?.price)||0)), 0);
      if(paymentMethod !== 'Pending / DP') setPaidAmount(newTot);
  };

  const addCartRow = () => setCart([...cart, { itemName: '', qty: '', satuan: 'Kg', price: 0 }]);
  const removeCartRow = (index) => {
      const newCart = cart.filter((_, i) => i !== index);
      setCart(newCart);
      const newTot = newCart.reduce((sum, item) => sum + ((Number(item?.qty)||0) * (Number(item?.price)||0)), 0);
      if(paymentMethod !== 'Pending / DP') setPaidAmount(newTot);
  };

  const resetForm = () => {
    setShowForm(false); setIsEdit(false); setEditId(null); setEditCount(0);
    setDate(todayStr); setSupplier(''); setPaymentMethod('Cash'); setPaidAmount(0); setNotes('');
    setCart([{ itemName: '', qty: '', satuan: 'Kg', price: 0 }]);
  };

  const handleEdit = (item) => {
    const relatedItems = (purchases||[]).filter(p => p.id === item.id);
    setDate(String(item.date).split('T')[0]);
    setSupplier(item.supplier); setPaymentMethod(item.paymentMethod); 
    setPaidAmount(item.paidAmount); setNotes(item.notes || '');
    setCart(relatedItems.map(p => ({ itemName: p.itemName, qty: p.qty, satuan: p.satuan || 'Kg', price: p.price })));
    setEditId(item.id); setEditCount(Number(item.editCount) || 0); setIsEdit(true); setShowForm(true);
  };

  const handleSimpan = (e) => {
    e.preventDefault();
    const invoiceId = isEdit ? editId : generateId('BUY', date);
    if(isEdit) sendToSheet('delete', { id: editId }, 'purchases');
    
    (cart||[]).forEach((item, index) => {
        if(String(item?.itemName).trim() !== '') {
            const newPurchase = {
                id: invoiceId, date, supplier: supplier.toUpperCase(), 
                itemName: String(item.itemName).toUpperCase(), satuan: String(item.satuan).toUpperCase(), 
                qty: Number(item.qty)||0, price: Number(item.price)||0, 
                total: (Number(item.qty)||0)*(Number(item.price)||0), paymentMethod, 
                paidAmount: index === 0 ? (Number(paidAmount)||0) : 0, notes, editCount: isEdit ? editCount + 1 : 0
            };
            setTimeout(() => sendToSheet('insert', newPurchase, 'purchases'), index * 300);
        }
    });
    setTimeout(() => resetForm(), (cart||[]).length * 300);
  };

  const displayPurchases = useMemo(() => {
    const filtered = (purchases||[]).filter(p => {
        const ymd = getLocalYMD(p?.date);
        return ymd && ymd >= filterFrom && ymd <= filterTo;
    });
    const groups = {};
    filtered.forEach(p => {
        if(!p?.id) return;
        if(!groups[p.id]) groups[p.id] = { ...p, items: [], totalAll: 0 };
        groups[p.id].items.push(`${p.itemName} (${p.qty} ${p.satuan})`);
        groups[p.id].totalAll += Number(p.total);
    });
    return Object.values(groups).sort(safeSort);
  }, [purchases, filterFrom, filterTo]);

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div><h3 className="font-bold text-lg text-slate-800">Pembelian Bahan Baku (Restock)</h3><p className="text-sm text-slate-500">Bisa input banyak barang sekaligus dalam 1 Invoice.</p></div>
        <button onClick={() => { if(showForm) resetForm(); else setShowForm(true); }} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium text-white ${showForm ? 'bg-slate-500' : 'bg-orange-600'}`}>
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Batal' : 'Catat Pembelian Baru'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSimpan} className="bg-white p-6 rounded-xl border border-orange-200 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-3 border-b pb-2"><h4 className="font-bold text-orange-800 text-sm">Header Invoice Pembelian</h4></div>
          <div className="space-y-1"><label className="text-sm font-medium">Tanggal</label><input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-200" /></div>
          <div className="space-y-1 lg:col-span-2"><label className="text-sm font-medium">Nama Supplier / Toko</label><input type="text" list="supp-list" required value={supplier} onChange={e => setSupplier(e.target.value)} className="w-full p-2 border rounded-lg uppercase" /><datalist id="supp-list">{listSupplierUnik.map(b => <option key={b} value={b} />)}</datalist></div>

          <div className="lg:col-span-3 bg-orange-50 p-4 rounded-xl border border-orange-100">
             <div className="flex justify-between items-center mb-3"><h4 className="font-bold text-sm text-orange-900">Daftar Barang (Item)</h4><button type="button" onClick={addCartRow} className="bg-white px-3 py-1 text-xs font-bold text-orange-600 border border-orange-300 rounded shadow-sm">+ Tambah Barang</button></div>
             <div className="space-y-3">
                 {(cart||[]).map((item, index) => {
                     const isAyam = String(item?.itemName || '').toUpperCase().includes('AYAM');
                     const isKg = String(item?.satuan || '').toUpperCase() === 'KG';
                     const infoAyam = (isAyam && isKg && item.qty) ? `(Setara ${Number(item.qty)/10} Kantong)` : '';
                     return (
                     <div key={index} className="flex flex-wrap md:flex-nowrap gap-2 items-start bg-white p-2 rounded-lg border shadow-sm relative pr-8">
                         <div className="w-full md:w-5/12 space-y-1"><input type="text" list="item-list" required placeholder="Nama Barang" value={item.itemName} onChange={e=>updateCartItem(index, 'itemName', e.target.value)} className="w-full p-2 border rounded text-xs uppercase font-bold" /><datalist id="item-list">{listBarangUnik.map(b => <option key={b} value={b} />)}</datalist></div>
                         <div className="w-1/2 md:w-2/12 space-y-1"><input type="number" min="1" required placeholder="Qty" value={item.qty} onChange={e=>updateCartItem(index, 'qty', e.target.value)} className="w-full p-2 border rounded text-xs font-bold text-center" />{infoAyam && <div className="text-[9px] font-bold text-emerald-600 leading-tight">{infoAyam}</div>}</div>
                         <div className="w-1/2 md:w-2/12 space-y-1"><input type="text" list="satuan-list" required placeholder="Satuan" value={item.satuan} onChange={e=>updateCartItem(index, 'satuan', e.target.value)} className="w-full p-2 border rounded text-xs uppercase" /><datalist id="satuan-list">{SATUAN_BARANG.map(b=><option key={b} value={b}/>)}</datalist></div>
                         <div className="w-full md:w-3/12 space-y-1"><input type="text" required placeholder="Harga Satuan" value={formatRp(item.price)} onChange={e=>updateCartItem(index, 'price', parseRp(e.target.value))} className="w-full p-2 border rounded text-xs font-bold" /></div>
                         {(cart||[]).length > 1 && <button type="button" onClick={()=>removeCartRow(index)} className="absolute right-2 top-3 text-red-400 hover:text-red-600"><Trash2 size={16}/></button>}
                     </div>
                 )})}
             </div>
          </div>
          <div className="space-y-1 bg-orange-100 p-3 rounded-lg border border-orange-200 lg:col-span-3"><label className="text-xs font-bold text-orange-900 uppercase">Total Seluruh Belanjaan (Otomatis)</label><input type="text" readOnly value={formatRp(cartTotal)} className="w-full p-3 border border-orange-300 rounded-lg font-bold text-lg bg-white mt-1 text-orange-900 cursor-not-allowed" /></div>
          <div className="space-y-1"><label className="text-sm font-medium">Metode Pembayaran</label><select value={paymentMethod} onChange={e => {setPaymentMethod(e.target.value); if(e.target.value!=='Pending / DP') setPaidAmount(cartTotal); else setPaidAmount(0);}} className="w-full p-2 border rounded-lg"><option value="Cash">Cash / Tunai</option><option value="Transfer">Transfer Bank</option><option value="Pending / DP">Hutang / DP</option></select></div>
          <div className="space-y-1"><label className="text-sm font-medium">Uang Dibayarkan (Rp)</label><input type="text" required value={formatRp(paidAmount)} onChange={e => setPaidAmount(parseRp(e.target.value))} className="w-full p-2 border rounded-lg font-bold" /></div>
          <div className="space-y-1 lg:col-span-1"><label className="text-sm font-medium">Keterangan Tambahan</label><input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2 border rounded-lg" /></div>
          <div className="lg:col-span-3 flex justify-end mt-2 pt-4 border-t"><button type="submit" className="bg-orange-600 text-white px-6 py-2.5 rounded-lg font-medium">Simpan {isEdit ? 'Perubahan' : 'Data Pembelian'}</button></div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm mt-4">
         <div className="flex items-center gap-2"><Filter size={16} className="text-slate-400"/><span className="text-sm font-bold text-slate-700">Filter Data:</span></div>
         <input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} className="p-1.5 text-sm border rounded focus:ring-2 focus:ring-orange-200" />
         <span className="text-slate-400">-</span>
         <input type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)} className="p-1.5 text-sm border rounded focus:ring-2 focus:ring-orange-200" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mt-4 overflow-hidden">
        <table className="w-full text-sm text-left block md:table overflow-x-auto">
          <thead className="bg-orange-50 text-orange-800 text-xs uppercase border-b border-orange-100"><tr><th className="px-4 py-3 min-w-[120px]">ID & Tanggal</th><th className="px-4 py-3 min-w-[150px]">Supplier & Barang</th><th className="px-4 py-3 text-center">Via</th><th className="px-4 py-3 text-right">Total Belanja</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-center">Aksi</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {displayPurchases.length === 0 && <tr><td colSpan="6" className="text-center py-8 text-slate-400">Tidak ada pembelian.</td></tr>}
            {displayPurchases.map((pur) => (
              <tr key={pur.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><div className="font-mono text-xs font-bold text-slate-700">{pur.id}</div><div className="text-xs text-slate-500">{formatDate(pur.date)}</div></td>
                <td className="px-4 py-3"><div className="font-bold uppercase text-slate-800">{pur.supplier}</div><ul className="list-disc pl-3 text-[10px] text-slate-500 mt-1">{(pur.items||[]).map((it, idx) => <li key={idx}>{it}</li>)}</ul></td>
                <td className="px-4 py-3 text-center font-medium text-slate-600">{pur.paymentMethod}</td>
                <td className="px-4 py-3 text-right font-bold text-orange-600">{formatRp(pur.totalAll)}</td>
                <td className="px-4 py-3 text-center">{(Number(pur.totalAll)||0) > (Number(pur.paidAmount)||0) ? <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold">HUTANG</span> : <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold">LUNAS</span>}</td>
                <td className="px-4 py-3 text-center"><div className="flex justify-center gap-2"><button onClick={() => setPrintData({ type: 'purchase', data: pur })} className="text-slate-600 bg-slate-100 p-2 rounded-lg transition" title="Cetak Bukti"><Printer size={16} /></button><button onClick={() => handleEdit(pur)} className="text-blue-600 bg-blue-50 px-2 py-1 rounded-lg font-bold text-[10px] transition" title="Edit Data">EDIT</button><button onClick={() => requestDelete(pur.id)} className="text-red-500 bg-red-50 p-2 rounded-lg transition" title="Hapus Permanen"><Trash2 size={16} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
