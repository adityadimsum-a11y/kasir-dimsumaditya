import React, { useState, useMemo } from 'react';
import { ShoppingCart, Plus, X, Trash2, Printer, Filter, ChefHat, CheckCheck } from 'lucide-react';
import { getTodayStr, getLocalYMD, formatRp, parseRp, KATEGORI_HARGA, generateId, safeSort, formatDate } from '../../utils/helpers';

export default function TabOrders({ orders, payments, sendToSheet, setPrintData, requestDelete, role }) {
  const [showForm, setShowForm] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editCount, setEditCount] = useState(0);

  const todayStr = getTodayStr();
  const [date, setDate] = useState(todayStr);
  const [customer, setCustomer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash / Tunai');
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [statusProd, setStatusProd] = useState('Menunggu Produksi');
  
  // STATE BARU UNTUK QUICK TAGS REQUEST PRODUKSI
  const [selectedTags, setSelectedTags] = useState([]);

  const defaultPrice = KATEGORI_HARGA[role === 'branch' ? 'Pemalang' : 'Reseller'];
  const defaultCat = role === 'branch' ? 'Pemalang' : 'Reseller';
  const [cart, setCart] = useState([{ category: defaultCat, qty: '', price: defaultPrice }]);

  const [filterFrom, setFilterFrom] = useState(todayStr);
  const [filterTo, setFilterTo] = useState(todayStr);

  const listPelangganUnik = [...new Set((orders||[]).map(s => String(s?.customer||'').toUpperCase()))];
  const cartTotal = (cart||[]).reduce((sum, item) => sum + ((Number(item?.qty)||0) * (Number(item?.price)||0)), 0);

  const QUICK_TAGS = [
      "Tanpa Udang", "Tanpa Telur Puyuh", "Tanpa Udang & Puyuh", 
      "Original Semua", "Siomay Semua", "Frozen", 
      "Packing Pisah", "Tanpa Bawang", "Tanpa Saus"
  ];

  const handleTagToggle = (tag) => {
      if (selectedTags.includes(tag)) {
          setSelectedTags(selectedTags.filter(t => t !== tag));
      } else {
          setSelectedTags([...selectedTags, tag]);
      }
  };

  const updateCartItem = (index, field, value) => {
      const newCart = [...cart]; newCart[index][field] = value;
      if (field === 'category') newCart[index].price = KATEGORI_HARGA[value] || 0;
      setCart(newCart);
  };
  const addCartRow = () => setCart([...cart, { category: defaultCat, qty: '', price: defaultPrice }]);
  const removeCartRow = (index) => setCart(cart.filter((_, i) => i !== index));

  const resetForm = () => {
    setShowForm(false); setIsEdit(false); setEditId(null); setEditCount(0);
    setDate(todayStr); setCustomer(''); setNotes(''); setPaymentMethod('Cash / Tunai'); setPaidAmount(0);
    setStatusProd('Menunggu Produksi'); setSelectedTags([]);
    setCart([{ category: defaultCat, qty: '', price: defaultPrice }]);
  };
  
  const handleEdit = (item) => {
    const relatedItems = (orders||[]).filter(p => p.id === item.id);
    setDate(String(item.date).split('T')[0]); setCustomer(item.customer); setPaymentMethod(item.paymentMethod); 
    setPaidAmount(item.paidAmount); setStatusProd(item.statusProduksi || 'Menunggu Produksi');
    
    // Pecah notes untuk mengambil tags vs manual notes
    let rawNotes = item.notes || '';
    let extractedTags = [];
    if (rawNotes.includes('[TAGS:')) {
        const tagPart = rawNotes.match(/\[TAGS:(.*?)\]/);
        if (tagPart) {
            extractedTags = tagPart[1].split(', ');
            rawNotes = rawNotes.replace(tagPart[0], '').trim();
        }
    }
    setSelectedTags(extractedTags);
    setNotes(rawNotes);

    setCart(relatedItems.map(p => ({ category: p.category, qty: p.qty, price: p.price })));
    setEditId(item.id); setEditCount(Number(item.editCount) || 0); setIsEdit(true); setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSimpan = (e) => {
    e.preventDefault();
    const invoiceId = isEdit ? editId : generateId('INV', date);
    
    if(isEdit) sendToSheet('delete', { id: editId }, 'orders');
    
    // Gabungkan tags dan manual notes ke dalam 1 kolom database
    let finalNotes = notes.trim();
    if (selectedTags.length > 0) {
        finalNotes = `[TAGS:${selectedTags.join(', ')}] ${finalNotes}`.trim();
    }
    
    const newOrdersArray = cart
      .filter(item => Number(item?.qty) > 0)
      .map((item, index) => ({
        id: invoiceId, date, customer: customer.toUpperCase(), category: item.category, 
        qty: Number(item.qty) || 0, price: Number(item.price) || 0, total: (Number(item.qty) || 0) * (Number(item.price) || 0), 
        paymentMethod, paidAmount: index === 0 ? (Number(paidAmount) || 0) : 0, 
        notes: finalNotes, 
        isSpkPrinted: isEdit ? (orders.find(o => o.id === editId)?.isSpkPrinted || false) : false, 
        statusProduksi: statusProd, 
        editCount: isEdit ? editCount + 1 : 0 
      }));

    if (newOrdersArray.length > 0) sendToSheet('insert', newOrdersArray, 'orders');
    resetForm();
  };

  const handlePrintSPK = (ord) => {
      setPrintData({ type: 'spk', data: ord });
      if (!ord.isSpkPrinted) {
          const rowsToUpdate = orders.filter(o => o.id === ord.id).map(row => ({ ...row, isSpkPrinted: true }));
          sendToSheet('delete', { id: ord.id }, 'orders');
          setTimeout(() => { sendToSheet('insert', rowsToUpdate, 'orders'); }, 300); 
      }
  };

  const handleStatusProduksiChange = (id, newStatus) => {
      const rowsToUpdate = orders.filter(o => o.id === id).map(row => ({ ...row, statusProduksi: newStatus }));
      sendToSheet('delete', { id }, 'orders');
      setTimeout(() => { sendToSheet('insert', rowsToUpdate, 'orders'); }, 300); 
  };

  const displayOrders = useMemo(() => {
    let filtered = role === 'branch' ? (orders||[]).filter(o => o?.category === 'Pemalang') : (orders||[]);
    filtered = filtered.filter(o => { const ymd = getLocalYMD(o?.date); return ymd && ymd >= filterFrom && ymd <= filterTo; });
    const groups = {};
    filtered.forEach(p => {
        if(!p?.id) return;
        if(!groups[p.id]) groups[p.id] = { ...p, items: [], totalAll: 0, isSpkPrinted: p.isSpkPrinted === true || p.isSpkPrinted === 'true' || p.isSpkPrinted === 'TRUE', statusProduksi: p.statusProduksi || 'Menunggu Produksi' };
        groups[p.id].items.push(`${p.qty} Pcs`); groups[p.id].totalAll += Number(p.total);
    });
    return Object.values(groups).sort(safeSort);
  }, [orders, role, filterFrom, filterTo]);

  return (
    <div className="space-y-4 animate-in fade-in pb-10">
      <div className="flex justify-between items-center">
        <div><h3 className="font-bold text-lg text-slate-800">Order & Penjualan {role === 'branch' ? '(Pemalang)' : '(Pusat)'}</h3></div>
        <button onClick={() => { if(showForm) resetForm(); else setShowForm(true); }} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm text-white ${showForm ? 'bg-slate-500' : 'bg-red-600'}`}>{showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Batal' : 'Buat Invoice Baru'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleSimpan} className="bg-white p-6 rounded-xl border border-red-200 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-3 mb-2 border-b border-slate-100 pb-2 flex justify-between items-center">
              <h4 className="font-bold text-red-800 text-sm flex gap-2"><ShoppingCart size={16}/> Form {isEdit ? 'Edit' : 'Input'} Pesanan</h4>
              <button type="button" onClick={resetForm} className="text-slate-400 hover:text-red-500"><X size={18}/></button>
          </div>
          <div className="space-y-1"><label className="text-sm font-medium">Tanggal</label><input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-200" /></div>
          <div className="space-y-1 lg:col-span-2"><label className="text-sm font-medium">Nama Pelanggan</label><input type="text" list="cust-list" required placeholder="Contoh: Budi..." value={customer} onChange={e => setCustomer(e.target.value)} className="w-full p-2 border rounded-lg uppercase" /><datalist id="cust-list">{listPelangganUnik.map(b => <option key={b} value={b} />)}</datalist></div>
          <div className="lg:col-span-3 bg-red-50 p-4 rounded-xl border border-red-100">
             <div className="flex justify-between items-center mb-3"><h4 className="font-bold text-sm text-red-900">Daftar Barang</h4><button type="button" onClick={addCartRow} className="bg-white px-3 py-1 text-xs font-bold text-red-600 border border-red-300 rounded">+ Tambah Barang</button></div>
             <div className="space-y-3">
                 {(cart||[]).map((item, index) => (
                     <div key={index} className="flex gap-2 items-center bg-white p-2 rounded-lg border relative pr-8">
                         <div className="w-4/12 space-y-1"><select value={item.category} onChange={e=>updateCartItem(index, 'category', e.target.value)} disabled={role === 'branch'} className="w-full p-2 border rounded text-xs uppercase font-bold">{Object.keys(KATEGORI_HARGA).map(k => <option key={k} value={k}>{k}</option>)}</select></div>
                         <div className="w-3/12 space-y-1"><input type="number" min="1" required placeholder="Qty" value={item.qty} onChange={e=>updateCartItem(index, 'qty', e.target.value)} className="w-full p-2 border rounded text-xs font-bold text-center" /></div>
                         <div className="w-5/12 space-y-1"><input type="text" required placeholder="Harga" value={formatRp(item.price)} onChange={e=>updateCartItem(index, 'price', parseRp(e.target.value))} className="w-full p-2 border rounded text-xs font-bold" /></div>
                         {(cart||[]).length > 1 && <button type="button" onClick={()=>removeCartRow(index)} className="absolute right-2 top-3 text-red-400 hover:text-red-600"><Trash2 size={16}/></button>}
                     </div>
                 ))}
             </div>
          </div>

          <div className="space-y-1 bg-amber-50 p-3 rounded-lg border border-amber-200 lg:col-span-3">
              <label className="text-xs font-bold text-amber-800">Total Seluruh Pesanan (Tagihan)</label>
              <input type="text" readOnly value={formatRp(cartTotal)} className="w-full p-3 border border-amber-300 rounded-lg font-black text-xl text-amber-900 bg-white mt-1" />
          </div>
          
          <div className="space-y-1"><label className="text-sm font-medium">Metode Pembayaran</label><select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="w-full p-2 border rounded-lg"><option>Cash / Tunai</option><option>Transfer Bank</option><option>QRIS</option></select></div>
          <div className="space-y-1"><label className="text-sm font-medium">Uang Diterima / DP</label><input type="text" required value={formatRp(paidAmount)} onChange={e => setPaidAmount(parseRp(e.target.value))} className="w-full p-2 border rounded-lg font-bold" /></div>
          <div className="space-y-1"><label className="text-sm font-medium">Status Produksi / Barang</label><select value={statusProd} onChange={e=>setStatusProd(e.target.value)} className="w-full p-2 border rounded-lg bg-blue-50 font-bold text-blue-800"><option>Menunggu Produksi</option><option>Diproses</option><option>Ready Diambil</option><option>Sudah Diambil</option></select></div>
          
          {/* SECTION REQUEST PRODUKSI (QUICK TAGS) */}
          <div className="lg:col-span-3 bg-slate-100 p-4 rounded-xl border border-slate-200 mt-2">
              <h4 className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-2"><ChefHat size={16}/> Catatan Produksi / Request Customer</h4>
              <div className="flex flex-wrap gap-2 mb-3">
                  {QUICK_TAGS.map(tag => (
                      <button 
                          key={tag} 
                          type="button"
                          onClick={() => handleTagToggle(tag)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition border ${selectedTags.includes(tag) ? 'bg-slate-800 text-white border-slate-800 shadow-sm' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-200'}`}
                      >
                          {tag}
                      </button>
                  ))}
              </div>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2 border rounded-lg text-sm" placeholder="Ketik manual tambahan catatan di sini (contoh: Ambil jam 4 sore)..." />
          </div>
          
          <div className="lg:col-span-3 flex justify-end mt-2 pt-4 border-t"><button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-bold shadow-md">Simpan {isEdit ? 'Perubahan' : 'Order & Terbitkan Invoice'}</button></div>
        </form>
      )}

      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border shadow-sm mt-4"><Filter size={16} className="text-slate-400"/><input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} className="p-1.5 text-sm border rounded" /> - <input type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)} className="p-1.5 text-sm border rounded" /></div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden mt-4">
        <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-700 text-[10px] uppercase border-b"><tr><th className="px-4 py-3">No. Order & Tgl</th><th className="px-4 py-3">Pelanggan & Request</th><th className="px-4 py-3">Pesanan</th><th className="px-4 py-3 text-center">Status Barang</th><th className="px-4 py-3 text-right">Tagihan</th><th className="px-4 py-3 text-center">Status Bayar</th><th className="px-4 py-3 text-center">Aksi / Cetak</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {displayOrders.length === 0 ? <tr><td colSpan="7" className="text-center py-12 text-slate-400">Tidak ada order ditemukan.</td></tr> : displayOrders.map((ord) => {
              const cicilan = (payments || []).filter(p => p.orderId === ord.id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
              const totalTerbayar = (Number(ord.paidAmount) || 0) + cicilan;
              const sisaHutang = (Number(ord.totalAll) || 0) - totalTerbayar;
              
              let statusBayarUI = null;
              if (sisaHutang <= 0) { statusBayarUI = <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold">LUNAS</span>; } 
              else if (ord.statusProduksi === 'Sudah Diambil') { statusBayarUI = <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold border border-red-200 shadow-sm block w-max mx-auto">PIUTANG<br/><span className="font-medium text-[9px]">Sisa: {formatRp(sisaHutang)}</span></span>; } 
              else if (totalTerbayar > 0) { statusBayarUI = <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold block w-max mx-auto">DP<br/><span className="font-medium text-[9px]">Sisa: {formatRp(sisaHutang)}</span></span>; } 
              else { statusBayarUI = <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold border">BELUM BAYAR</span>; }

              // Filter tampilan notes
              let displayNotes = ord.notes || '';
              let hasTags = false;
              if (displayNotes.includes('[TAGS:')) {
                  displayNotes = displayNotes.replace(/\[TAGS:(.*?)\]/, (match, tags) => { hasTags = true; return `<span class="bg-slate-800 text-white px-1.5 py-0.5 rounded text-[9px] font-bold mr-1 block w-max mb-1">${tags}</span>`; });
              }

              return (
              <tr key={ord.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><div className="font-mono text-[11px] font-bold text-slate-700">{ord.id}</div><div className="text-[10px] text-slate-500">{formatDate(ord.date)}</div></td>
                <td className="px-4 py-3">
                    <div className="font-bold text-slate-800 uppercase text-xs mb-1">{ord.customer}</div>
                    {ord.notes && <div className="text-[10px] text-slate-600 italic" dangerouslySetInnerHTML={{ __html: displayNotes }}></div>}
                </td>
                <td className="px-4 py-3"><ul className="list-disc pl-3 text-[10px] font-bold text-slate-600">{(ord.items||[]).map((it,idx)=><li key={idx}>{it}</li>)}</ul></td>
                <td className="px-4 py-3 text-center">
                    <select value={ord.statusProduksi} onChange={(e) => handleStatusProduksiChange(ord.id, e.target.value)} className={`text-[10px] font-bold p-1 rounded border outline-none cursor-pointer shadow-sm ${ord.statusProduksi === 'Sudah Diambil' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ord.statusProduksi === 'Ready Diambil' ? 'bg-blue-50 text-blue-700 border-blue-200' : ord.statusProduksi === 'Diproses' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                        <option value="Menunggu Produksi">Menunggu Produksi</option>
                        <option value="Diproses">Diproses</option>
                        <option value="Ready Diambil">Ready Diambil</option>
                        <option value="Sudah Diambil">Sudah Diambil</option>
                    </select>
                </td>
                <td className="px-4 py-3 text-right">
                    <div className="font-bold text-slate-800 text-sm">{formatRp(ord.totalAll)}</div>
                    <div className="text-[9px] text-slate-500">{ord.paymentMethod}</div>
                </td>
                <td className="px-4 py-3 text-center">{statusBayarUI}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-1.5">
                    <button onClick={() => handlePrintSPK(ord)} className={`p-2 rounded-lg border transition shadow-sm flex items-center justify-center relative ${ord.isSpkPrinted ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100' : 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100'}`} title={ord.isSpkPrinted ? "Cetak Ulang SPK Produksi" : "Cetak SPK Dapur"}>
                      {ord.isSpkPrinted ? <CheckCheck size={16} /> : <ChefHat size={16} />}
                    </button>
                    <button onClick={() => setPrintData({ type: 'invoice', data: ord })} className="text-slate-600 bg-slate-100 p-2 rounded-lg border hover:bg-slate-200 transition shadow-sm" title="Cetak Invoice Pembayaran">
                      <Printer size={16} />
                    </button>
                    <button onClick={() => handleEdit(ord)} className="text-blue-600 bg-blue-50 px-2 py-1 rounded-lg font-bold text-[10px] border border-blue-200 hover:bg-blue-100 transition shadow-sm">
                      EDIT
                    </button>
                    <button onClick={() => requestDelete(ord.id)} className="text-red-500 bg-red-50 p-2 rounded-lg border border-red-200 hover:bg-red-100 transition shadow-sm" title="Hapus Data">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
