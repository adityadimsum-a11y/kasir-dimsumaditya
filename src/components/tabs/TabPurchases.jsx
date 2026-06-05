import React, { useState } from 'react';
import { Truck, Search, Download, Printer, PlusCircle, Factory, Zap } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabPurchases({ purchases, sendToSheet, setPrintData }) {
  const todayStr = getTodayStr();
  const [date, setDate] = useState(todayStr);
  const [supplier, setSupplier] = useState('');
  const [itemName, setItemName] = useState('AYAM MENTAH UTUH');
  const [qty, setQty] = useState('');
  const [satuan, setSatuan] = useState('KG');
  const [price, setPrice] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash / Tunai');
  const [filterSupplier, setFilterSupplier] = useState('');

  const handleSimpan = (e) => {
    e.preventDefault();
    const total = Number(qty) * Number(price);
    const id = generateId('BUY', date);

    const newData = {
      id, date, supplier, itemName,
      qty: Number(qty), satuan, price: Number(price),
      total, paidAmount: Number(paidAmount), paymentMethod,
      isDeleted: false, branch_id: 'PUSAT'
    };

    // THE MAGIC TRIGGER: Send to AUTO JOURNAL EVENT ENGINE
    sendToSheet('event_purchase', newData, 'purchases');

    alert(`Auto-Journal Executed!\n\n1. Pembelian ${itemName} dicatat\n2. Stok Gudang bertambah\n3. Ledger Hutang Supplier tercatat\n4. Cashflow terpotong (jika ada DP/Lunas)`);

    setSupplier(''); setQty(''); setPrice(''); setPaidAmount('');
    setPrintData({ type: 'purchase', data: newData });
  };

  const listData = purchases ? purchases.filter(p => p.supplier && p.supplier.toLowerCase().includes(filterSupplier.toLowerCase())).sort((a, b) => new Date(b.date) - new Date(a.date)) : [];

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* FORM INPUT PEMBELIAN DENGAN EVENT ENGINE */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Zap size={120} /></div>
        
        <div className="flex items-center gap-3 mb-6 border-b pb-4 relative z-10">
          <div className="bg-orange-100 text-orange-600 p-2.5 rounded-xl"><Truck size={24} /></div>
          <div>
            <h3 className="font-black text-slate-800 text-lg uppercase tracking-wide">Purchase & Restock System</h3>
            <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest flex items-center gap-1"><Zap size={10}/> Powered by Auto Journal Engine</p>
          </div>
        </div>

        <form onSubmit={handleSimpan} className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
          <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Tgl Beli</label><input type="date" required value={date} onChange={e=>setDate(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" /></div>
          <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Supplier</label><input type="text" required placeholder="Cth: Suplier Ayam Pak Budi" value={supplier} onChange={e=>setSupplier(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm uppercase" /></div>
          <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Barang / Bahan</label><input type="text" required value={itemName} onChange={e=>setItemName(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm uppercase" /></div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Jumlah</label><input type="number" step="0.01" required value={qty} onChange={e=>setQty(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-blue-700 text-sm" /></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Satuan</label><select value={satuan} onChange={e=>setSatuan(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm"><option value="KG">KG</option><option value="PCS">PCS</option><option value="KARUNG">KARUNG</option></select></div>
          </div>

          <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Harga Satuan</label><input type="number" required placeholder="Rp" value={price} onChange={e=>setPrice(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm" /></div>
          <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Total Tagihan (Auto)</label><div className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-black text-slate-500 text-sm cursor-not-allowed">{formatRp(Number(qty)*Number(price))}</div></div>
          
          <div className="space-y-1 border border-orange-200 bg-orange-50/50 p-2 rounded-xl"><label className="text-[10px] font-black text-orange-700 uppercase block mb-1">Dibayar Hari Ini (DP/Lunas)</label><input type="number" required placeholder="Cth: 0 jika hutang" value={paidAmount} onChange={e=>setPaidAmount(e.target.value)} className="w-full p-2 bg-white border border-orange-200 rounded-lg font-black text-emerald-600 text-sm" /></div>
          <div className="space-y-1 border border-orange-200 bg-orange-50/50 p-2 rounded-xl"><label className="text-[10px] font-black text-orange-700 uppercase block mb-1">Metode Bayar / Kas</label><select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="w-full p-2 bg-white border border-orange-200 rounded-lg font-bold text-sm text-slate-700"><option>Cash / Tunai</option><option>Transfer BCA</option><option>Transfer Mandiri</option></select></div>

          <div className="md:col-span-4 mt-2 border-t pt-4">
            <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-md transition flex items-center justify-center gap-2">
              <Zap size={18} className="text-yellow-400" /> Eksekusi Pembelian & Auto Journal
            </button>
          </div>
        </form>
      </div>

      {/* TABEL HISTORI PEMBELIAN */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
            <h4 className="font-bold text-slate-800 tracking-wide uppercase text-sm">Log History Pembelian</h4>
            <div className="flex bg-white rounded-lg border px-3 py-1.5 items-center gap-2 w-64 shadow-sm"><Search size={14} className="text-slate-400"/><input type="text" placeholder="Cari supplier..." value={filterSupplier} onChange={e=>setFilterSupplier(e.target.value)} className="outline-none text-xs w-full font-medium"/></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white border-b text-[10px] text-slate-500 uppercase">
              <tr><th className="px-4 py-3">TGL & ID</th><th className="px-4 py-3">SUPPLIER</th><th className="px-4 py-3">BARANG / ITEM</th><th className="px-4 py-3 text-right">TOTAL TAGIHAN</th><th className="px-4 py-3 text-right">DIBAYAR KAS</th><th className="px-4 py-3 text-right">SISA HUTANG</th><th className="px-4 py-3 text-center">BUKTI</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listData.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-8 text-slate-400 italic">Belum ada transaksi pembelian.</td></tr>
              ) : listData.map((p) => {
                  const sisaHutang = (Number(p.total) || 0) - (Number(p.paidAmount) || 0);
                  return (
                  <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3"><div className="font-bold text-slate-700">{formatDate(p.date)}</div><div className="font-mono text-[9px] text-slate-400">{p.id}</div></td>
                      <td className="px-4 py-3 font-black text-slate-800 uppercase">{p.supplier}</td>
                      <td className="px-4 py-3 font-bold text-orange-700 text-xs">{p.itemName} <span className="text-slate-500 font-medium">({p.qty} {p.satuan})</span></td>
                      <td className="px-4 py-3 text-right font-black text-slate-700">{formatRp(p.total)}</td>
                      <td className="px-4 py-3 text-right font-black text-emerald-600">{formatRp(p.paidAmount)}</td>
                      <td className="px-4 py-3 text-right font-black text-red-600">{sisaHutang > 0 ? formatRp(sisaHutang) : <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[9px]">LUNAS</span>}</td>
                      <td className="px-4 py-3 text-center"><button onClick={() => setPrintData({ type: 'purchase', data: p })} className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-lg transition"><Printer size={16} /></button></td>
                  </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
