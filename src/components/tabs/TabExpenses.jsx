import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, Printer, Filter } from 'lucide-react';
import { 
  getTodayStr, getFirstDayOfMonthStr, getLocalYMD, formatRp, parseRp, 
  generateId, formatDate, KATEGORI_PENGELUARAN 
} from '../../utils/helpers';

export default function TabExpenses({ expenses, sendToSheet, setPrintData, requestDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editCount, setEditCount] = useState(0);

  const [type, setType] = useState('IN'); 
  const todayStr = getTodayStr();
  const [date, setDate] = useState(todayStr);
  const [recipient, setRecipient] = useState('');
  const [category, setCategory] = useState(KATEGORI_PENGELUARAN[0]);
  const [description, setDescription] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  
  // MENGGUNAKAN TANGGAL 1 SEBAGAI DEFAULT FILTER
  const [filterFrom, setFilterFrom] = useState(getFirstDayOfMonthStr());
  const [filterTo, setFilterTo] = useState(todayStr);

  const total = (Number(qty) || 0) * (Number(price) || 0);

  const resetForm = () => {
    setShowForm(false); setIsEdit(false); setEditId(null); setEditCount(0);
    setDate(todayStr); setRecipient(''); setDescription(''); setPrice(0); setQty(''); setType('IN'); setCategory(KATEGORI_PENGELUARAN[0]); setPaymentMethod('Cash');
  };

  const handleEdit = (item) => {
    setDate(String(item.date).split('T')[0]); setRecipient(item.recipient); setCategory(item.category);
    setDescription(item.description); setType(item.type); setQty(item.qty); setPrice(item.price); setPaymentMethod(item.paymentMethod);
    setEditId(item.id); setEditCount(Number(item.editCount)||0); setIsEdit(true); setShowForm(true);
  };

  const handleSimpan = (e) => {
    e.preventDefault();
    const prefix = type === 'IN' ? 'IN' : 'OUT';
    const newExpense = { id: isEdit ? editId : generateId(prefix, date), date, recipient: String(recipient||'').toUpperCase(), category: type === 'IN' ? 'Modal Awal / Tambahan Saldo' : category, description, qty: Number(qty)||0, price: Number(price)||0, total, type, paymentMethod, editCount: isEdit ? editCount + 1 : 0 };
    sendToSheet(isEdit ? 'update' : 'insert', newExpense, 'expenses'); 
    resetForm();
  };

  const displayExpenses = useMemo(() => (expenses||[]).filter(e => {
      const y = getLocalYMD(e?.date);
      return y && y >= filterFrom && y <= filterTo;
  }), [expenses, filterFrom, filterTo]);

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center"><h3 className="font-bold text-lg">Buku Kas Umum</h3><button onClick={() => { if(showForm) resetForm(); else setShowForm(true); }} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm text-white ${showForm ? 'bg-slate-500' : 'bg-emerald-600'}`}>{showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Batal' : 'Input Transaksi'}</button></div>
      {showForm && (
        <form onSubmit={handleSimpan} className="bg-white p-6 rounded-xl border grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-full"><div className="flex bg-slate-100 p-1 rounded-lg w-full max-w-sm"><button type="button" onClick={() => setType('IN')} className={`flex-1 py-2 text-sm font-bold rounded-md ${type === 'IN' ? 'bg-white text-emerald-600' : 'text-slate-500'}`}>Kas Masuk</button><button type="button" onClick={() => setType('OUT')} className={`flex-1 py-2 text-sm font-bold rounded-md ${type === 'OUT' ? 'bg-white text-red-600' : 'text-slate-500'}`}>Kas Keluar</button></div></div>
          <div className="space-y-1"><label className="text-sm font-medium">Metode</label><select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full p-2 border rounded-lg bg-slate-50"><option value="Cash">Tunai (Cash)</option><option value="Transfer">Bank (Transfer)</option></select></div>
          <div className="space-y-1"><label className="text-sm font-medium">Tanggal</label><input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg" /></div>
          <div className="space-y-1"><label className="text-sm font-medium">Penerima / Dari</label><input type="text" required value={recipient} onChange={e => setRecipient(e.target.value)} className="w-full p-2 border rounded-lg uppercase" /></div>
          {type === 'OUT' ? <div className="space-y-1"><label className="text-sm font-medium">Kategori</label><select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-2 border rounded-lg">{KATEGORI_PENGELUARAN.map(k => <option key={k} value={k}>{k}</option>)}</select></div> : <div className="space-y-1"><label className="text-sm font-medium">Kategori</label><input type="text" disabled value="Modal Awal" className="w-full p-2 border rounded-lg bg-slate-100" /></div>}
          <div className="space-y-1 col-span-full"><label className="text-sm font-medium">Keterangan Lengkap</label><input type="text" required value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 border rounded-lg" /></div>
          <div className="space-y-1 flex gap-2"><div className="w-1/3"><label className="text-sm font-medium">Qty</label><input type="number" min="1" required value={qty} onChange={e => setQty(e.target.value)} className="w-full p-2 border rounded-lg" /></div><div className="w-2/3"><label className="text-sm font-medium">Harga Satuan (Rp)</label><input type="text" required value={formatRp(price)} onChange={e => setPrice(parseRp(e.target.value))} className="w-full p-2 border rounded-lg font-bold" /></div></div>
          <div className="space-y-1"><label className="text-sm font-medium">Total</label><div className="w-full p-2 bg-slate-100 border rounded-lg font-bold">{formatRp(total)}</div></div>
          <div className="col-span-full flex justify-end"><button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium">Simpan {isEdit ? 'Perubahan' : 'Kas'}</button></div>
        </form>
      )}
      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border mt-4"><Filter size={16} className="text-slate-400"/><input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} className="p-1.5 text-sm border rounded" /> - <input type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)} className="p-1.5 text-sm border rounded" /></div>
      <div className="bg-white rounded-xl border mt-4 overflow-hidden"><table className="w-full text-sm text-left block md:table"><thead className="bg-slate-50 border-b"><tr><th className="px-4 py-3">Tgl & ID</th><th className="px-4 py-3">Keterangan</th><th className="px-4 py-3 text-center">Via</th><th className="px-4 py-3 text-right">Nominal</th><th className="px-4 py-3 text-center">Aksi</th></tr></thead><tbody className="divide-y">
          {displayExpenses.length === 0 ? <tr><td colSpan="5" className="text-center py-12 text-slate-400">Tidak ada data.</td></tr> : displayExpenses.map((exp) => (
            <tr key={exp.id} className="hover:bg-slate-50">
              <td className="px-4 py-3"><div className="font-medium">{formatDate(exp.date)}</div><div className="text-[10px] text-slate-400 font-mono">{exp.id}</div></td>
              <td className="px-4 py-3"><div className="font-bold">{exp.category}</div><div className="text-xs text-slate-600">{exp.description} (Kpd: {exp.recipient})</div></td>
              <td className="px-4 py-3 text-center">{exp.paymentMethod}</td>
              <td className={`px-4 py-3 text-right font-bold ${exp.type === 'IN' ? 'text-emerald-600' : 'text-red-600'}`}>{exp.type === 'IN' ? '+' : '-'}{formatRp(exp.total)}</td>
              <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-2">
                      {exp.type === 'OUT' && <button onClick={() => setPrintData({ type: 'voucher', data: exp })} className="text-slate-600 bg-slate-100 p-2 rounded-lg"><Printer size={16} /></button>}
                      <button onClick={() => handleEdit(exp)} className="text-blue-600 bg-blue-50 px-2 py-1 rounded-lg font-bold text-[10px]">EDIT</button>
                      <button onClick={() => requestDelete(exp.id)} className="text-red-500 bg-red-50 p-2 rounded-lg"><Trash2 size={16} /></button>
                  </div>
              </td>
            </tr>
          ))}
      </tbody></table></div>
    </div>
  );
}
