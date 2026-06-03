import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { 
  getTodayStr, generateId, safeSort, formatDate, SATUAN_BARANG 
} from '../../utils/helpers';

export default function TabStok({ stokData, sendToSheet, requestDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editCount, setEditCount] = useState(0);

  const todayStr = getTodayStr();
  const [date, setDate] = useState(todayStr);
  const [type, setType] = useState('MASUK');
  const [notes, setNotes] = useState('');
  
  const [cart, setCart] = useState([{ itemName: '', satuan: 'Kg', qty: '' }]);

  const listBarangUnik = [...new Set((stokData||[]).map(s => String(s?.itemName||'').toUpperCase()))];

  const updateCartItem = (index, field, value) => {
      const newCart = [...cart];
      newCart[index][field] = value;
      setCart(newCart);
  };
  const addCartRow = () => setCart([...cart, { itemName: '', satuan: 'Kg', qty: '' }]);
  const removeCartRow = (index) => setCart((cart||[]).filter((_, i) => i !== index));

  const resetForm = () => {
    setShowForm(false); setIsEdit(false); setEditId(null); setEditCount(0);
    setDate(todayStr); setType('MASUK'); setNotes(''); setCart([{ itemName: '', satuan: 'Kg', qty: '' }]);
  };

  const handleEdit = (item) => {
    const relatedItems = (stokData||[]).filter(p => p.id === item.id);
    setDate(String(item.date).split('T')[0]); setType(item.type); setNotes(item.notes || '');
    setCart(relatedItems.map(p => ({ itemName: p.itemName, satuan: p.satuan || 'Kg', qty: p.qty })));
    setEditId(item.id); setEditCount(Number(item.editCount)||0); setIsEdit(true); setShowForm(true);
  };

  const handleSimpan = (e) => {
    e.preventDefault();
    const batchId = isEdit ? editId : generateId('STK', date);
    
    if(isEdit) sendToSheet('delete', { id: editId }, 'stok');

    const newStokArray = cart
      .filter(item => String(item?.itemName).trim() !== '' && String(item?.satuan).trim() !== '')
      .map(item => ({
        id: batchId, 
        date, 
        itemName: String(item.itemName).toUpperCase(), 
        satuan: String(item.satuan).toUpperCase(), 
        type, 
        qty: Number(item.qty) || 0, 
        notes, 
        editCount: isEdit ? editCount + 1 : 0 
      }));

    if (newStokArray.length > 0) {
      sendToSheet('insert', newStokArray, 'stok');
    }
    
    resetForm();
  };

  const stokAktual = useMemo(() => {
    const calc = {};
    (stokData||[]).forEach(s => {
      if(!s?.itemName) return;
      const nama = String(s.itemName).toUpperCase();
      if(!calc[nama]) calc[nama] = { masuk: 0, keluar: 0, terpakai: 0, sisa: 0, satuan: s.satuan || 'PCS' };
      if(s.type === 'MASUK') calc[nama].masuk += Number(s.qty) || 0;
      else if(s.type === 'KELUAR') calc[nama].keluar += Number(s.qty) || 0;
      else if(s.type === 'TERPAKAI') calc[nama].terpakai += Number(s.qty) || 0;
      calc[nama].sisa = calc[nama].masuk - calc[nama].keluar - calc[nama].terpakai;
    });
    return calc;
  }, [stokData]);

  const displayStok = useMemo(() => {
    const groups = {};
    (stokData||[]).forEach(p => {
        if(!p?.id) return;
        if(!groups[p.id]) groups[p.id] = { ...p, items: [] };
        groups[p.id].items.push(`${p.itemName} (${p.qty} ${p.satuan})`);
    });
    return Object.values(groups).sort(safeSort);
  }, [stokData]);

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center"><h3 className="font-bold text-lg text-slate-800">Manajemen Stok Bahan</h3><button onClick={() => { if(showForm) resetForm(); else setShowForm(true); }} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm text-white ${showForm ? 'bg-slate-500' : 'bg-blue-600'}`}>{showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Batal' : 'Catat Stok'}</button></div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
        {Object.keys(stokAktual).length === 0 && <div className="text-sm text-slate-500 italic col-span-full">Belum ada data barang. Silakan catat stok pertama Anda.</div>}
        {Object.entries(stokAktual).map(([nama, data]) => (
            <div key={nama} className={`p-4 rounded-xl border flex flex-col justify-between ${data.sisa <= 0 ? 'bg-red-50' : 'bg-white'}`}>
                <div className="text-sm font-bold mb-2 truncate" title={nama}>{nama}</div>
                <div className={`text-2xl font-black ${data.sisa <= 0 ? 'text-red-600' : 'text-blue-600'}`}>{data.sisa} <span className="text-xs">{data.satuan}</span></div>
            </div>
        ))}
      </div>
      {showForm && (
        <form onSubmit={handleSimpan} className="bg-white p-6 rounded-xl border border-blue-200 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-full mb-2"><div className="flex bg-slate-100 p-1 rounded-lg w-full"><button type="button" onClick={() => setType('MASUK')} className={`flex-1 py-2 text-sm font-bold rounded-md ${type === 'MASUK' ? 'bg-white text-emerald-600' : 'text-slate-500'}`}>Masuk</button><button type="button" onClick={() => setType('TERPAKAI')} className={`flex-1 py-2 text-sm font-bold rounded-md ${type === 'TERPAKAI' ? 'bg-white text-orange-500' : 'text-slate-500'}`}>Dipakai Produksi</button><button type="button" onClick={() => setType('KELUAR')} className={`flex-1 py-2 text-sm font-bold rounded-md ${type === 'KELUAR' ? 'bg-white text-red-600' : 'text-slate-500'}`}>Keluar (Rusak)</button></div></div>
          <div className="space-y-1"><label className="text-sm font-medium">Tanggal</label><input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-lg" /></div>
          <div className="space-y-1"><label className="text-sm font-medium">Keterangan Batch</label><input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="Cth: Dropping dari Pusat" /></div>

          <div className="col-span-full bg-blue-50 p-4 rounded-xl border border-blue-100">
             <div className="flex justify-between items-center mb-3">
                 <h4 className="font-bold text-sm text-blue-900">Daftar Barang</h4>
                 <button type="button" onClick={addCartRow} className="bg-white px-3 py-1 text-xs font-bold text-blue-600 border border-blue-300 rounded shadow-sm">+ Tambah</button>
             </div>
             <div className="space-y-2">
                 {(cart||[]).map((item, index) => {
                     const isAyam = String(item?.itemName || '').toUpperCase().includes('AYAM');
                     const isKg = String(item?.satuan || '').toUpperCase() === 'KG';
                     const infoAyam = (isAyam && isKg && item.qty) ? `(Setara ${Number(item.qty)/10} Kantong)` : '';
                     return(
                     <div key={index} className="flex flex-wrap md:flex-nowrap gap-2 items-start bg-white p-2 rounded border relative pr-8">
                         <div className="w-full md:w-5/12"><input type="text" list="suggestions-item" required placeholder="Nama Barang" value={item.itemName} onChange={e=>updateCartItem(index,'itemName',e.target.value)} className="w-full p-2 border rounded text-xs uppercase font-bold" /><datalist id="suggestions-item">{listBarangUnik.map(b => <option key={b} value={b} />)}</datalist></div>
                         <div className="w-1/2 md:w-3/12"><input type="number" min="1" required placeholder="Qty" value={item.qty} onChange={e=>updateCartItem(index,'qty',e.target.value)} className="w-full p-2 border rounded text-xs text-center font-bold" />{infoAyam && <div className="text-[9px] font-bold text-emerald-600 mt-1">{infoAyam}</div>}</div>
                         <div className="w-1/2 md:w-4/12"><input type="text" list="satuan-list" required placeholder="Satuan (Kg/Pcs)" value={item.satuan} onChange={e=>updateCartItem(index,'satuan',e.target.value)} className="w-full p-2 border rounded text-xs uppercase" /><datalist id="satuan-list">{SATUAN_BARANG.map(b=><option key={b} value={b}/>)}</datalist></div>
                         {(cart||[]).length > 1 && <button type="button" onClick={()=>removeCartRow(index)} className="absolute right-2 top-3 text-red-400 hover:text-red-600"><Trash2 size={16}/></button>}
                     </div>
                 )})}
             </div>
          </div>
          <div className="col-span-full flex justify-end"><button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium">Simpan {isEdit ? 'Perubahan' : 'Log Stok'}</button></div>
        </form>
      )}
      <div className="bg-white rounded-xl border mt-4 overflow-hidden"><table className="w-full text-sm text-left block md:table"><thead className="bg-blue-50 text-blue-800 text-xs uppercase border-b"><tr><th className="px-4 py-3">Tanggal & ID</th><th className="px-4 py-3">Daftar Barang (Qty)</th><th className="px-4 py-3 text-center">Jenis</th><th className="px-4 py-3">Keterangan</th><th className="px-4 py-3 text-center">Aksi</th></tr></thead>
      <tbody className="divide-y divide-slate-100">
        {displayStok.length === 0 ? <tr><td colSpan="5" className="text-center py-12 text-slate-400">Belum ada riwayat stok.</td></tr> : displayStok.map((s) => (
          <tr key={s.id} className="hover:bg-slate-50">
            <td className="px-4 py-3"><div className="font-medium">{formatDate(s.date)}</div><div className="text-[10px] text-slate-400 font-mono">{s.id}</div></td>
            <td className="px-4 py-3"><ul className="list-disc pl-3 text-xs font-bold text-slate-800 uppercase">{(s.items||[]).map((it,idx)=><li key={idx}>{it}</li>)}</ul></td>
            <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded text-[10px] font-bold ${s.type === 'MASUK' ? 'bg-emerald-100 text-emerald-700' : s.type === 'TERPAKAI' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{s.type}</span></td>
            <td className="px-4 py-3 text-xs">{s.notes || '-'}</td>
            <td className="px-4 py-3 text-center"><div className="flex justify-center gap-2"><button onClick={() => handleEdit(s)} className="text-blue-600 bg-blue-50 px-2 py-1 rounded-lg font-bold text-[10px]">EDIT</button><button onClick={() => requestDelete(s.id)} className="text-red-500 bg-red-50 p-2 rounded-lg"><Trash2 size={16} /></button></div></td>
          </tr>
        ))}
      </tbody></table></div>
    </div>
  );
}
