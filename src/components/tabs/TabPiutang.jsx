import React, { useState, useMemo } from 'react';
import { X, Printer, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { getTodayStr, formatRp, parseRp, generateId, formatDate, safeSort } from '../../utils/helpers';

export default function TabPiutang({ orders, purchases, payments, sendToSheet, requestDelete, setPrintData, role }) {
  const [tab, setTab] = useState('piutang');
  const [selectedItem, setSelectedItem] = useState(null);
  
  // FILTER STATUS PIUTANG/HUTANG
  const [filterStatus, setFilterStatus] = useState('BELUM LUNAS');

  const todayStr = getTodayStr();
  const [payDate, setPayDate] = useState(todayStr);
  const [payMethod, setPayMethod] = useState('Transfer Bank');
  const [payAmount, setPayAmount] = useState(0);

  const listPiutang = useMemo(() => {
      const groups = {};
      (orders || []).filter(o => (Number(o.total) || 0) > (Number(o.paidAmount) || 0)).forEach(o => {
          if(!groups[o.id]) groups[o.id] = { ...o, totalTagihan: 0, totalDibayar: Number(o.paidAmount)||0, items: [] };
          groups[o.id].totalTagihan += Number(o.total)||0;
          groups[o.id].items.push(`${o.qty} Pcs`);
      });
      return Object.values(groups).map(g => {
          const cicilanList = (payments||[]).filter(p => p.orderId === g.id).sort(safeSort);
          const totalCicilan = cicilanList.reduce((sum, p) => sum + (Number(p.amount)||0), 0);
          const sisa = g.totalTagihan - g.totalDibayar - totalCicilan;
          return { ...g, cicilanList, totalCicilan, sisaHutang: sisa };
      }).sort((a,b) => new Date(b.date) - new Date(a.date));
  }, [orders, payments]);

  const listHutang = useMemo(() => {
      const groups = {};
      (purchases || []).filter(p => (Number(p.total) || 0) > (Number(p.paidAmount) || 0)).forEach(p => {
          if(!groups[p.id]) groups[p.id] = { ...p, totalTagihan: 0, totalDibayar: Number(p.paidAmount)||0, items: [] };
          groups[p.id].totalTagihan += Number(p.total)||0;
          groups[p.id].items.push(`${p.itemName} (${p.qty} ${p.satuan})`);
      });
      return Object.values(groups).map(g => {
          const cicilanList = (payments||[]).filter(p => p.orderId === g.id).sort(safeSort);
          const totalCicilan = cicilanList.reduce((sum, p) => sum + (Number(p.amount)||0), 0);
          const sisa = g.totalTagihan - g.totalDibayar - totalCicilan;
          return { ...g, cicilanList, totalCicilan, sisaHutang: sisa };
      }).sort((a,b) => new Date(b.date) - new Date(a.date));
  }, [purchases, payments]);

  const handleSimpanCicilan = (e) => {
      e.preventDefault();
      if(payAmount <= 0) return alert('Nominal tidak boleh 0');
      if(payAmount > selectedItem.sisaHutang) return alert('Nominal melebihi sisa hutang!');
      const newPay = { id: generateId('PAY', payDate), date: payDate, orderId: selectedItem.id, amount: Number(payAmount)||0, paymentMethod: payMethod };
      sendToSheet('insert', newPay, 'payments');
      setSelectedItem(prev => ({ ...prev, sisaHutang: prev.sisaHutang - payAmount, totalCicilan: prev.totalCicilan + payAmount, cicilanList: [newPay, ...prev.cicilanList] }));
      setPayAmount(0); setPayDate(todayStr);
  };

  const activeList = tab === 'piutang' ? listPiutang : listHutang;
  
  // PENERAPAN FILTER
  let displayedList = activeList;
  if (filterStatus === 'BELUM LUNAS') displayedList = activeList.filter(item => item.sisaHutang > 0);
  if (filterStatus === 'LUNAS') displayedList = activeList.filter(item => item.sisaHutang <= 0);

  return (
    <div className="space-y-4 animate-in fade-in relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-200 pb-2">
        <div className="flex gap-2">
            <button onClick={() => setTab('piutang')} className={`px-4 py-2 font-bold text-sm rounded-t-lg transition ${tab === 'piutang' ? 'bg-white text-blue-600 border border-b-0 shadow-[0_-4px_6px_-2px_rgba(0,0,0,0.05)]' : 'text-slate-500 hover:bg-slate-200'}`}>Piutang (Pelanggan Ngutang)</button>
            {role === 'admin' && <button onClick={() => setTab('hutang')} className={`px-4 py-2 font-bold text-sm rounded-t-lg transition ${tab === 'hutang' ? 'bg-white text-orange-600 border border-b-0 shadow-[0_-4px_6px_-2px_rgba(0,0,0,0.05)]' : 'text-slate-500 hover:bg-slate-200'}`}>Hutang (Kita Ngutang)</button>}
        </div>
        
        {/* TOMBOL FILTER CANGGIH */}
        <div className="flex bg-slate-200 p-1 rounded-lg w-full md:w-auto">
            <button onClick={() => setFilterStatus('BELUM LUNAS')} className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition ${filterStatus === 'BELUM LUNAS' ? 'bg-white text-red-600 shadow' : 'text-slate-500 hover:text-slate-700'}`}>Belum Lunas</button>
            <button onClick={() => setFilterStatus('LUNAS')} className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition ${filterStatus === 'LUNAS' ? 'bg-white text-emerald-600 shadow' : 'text-slate-500 hover:text-slate-700'}`}>Sudah Lunas</button>
            <button onClick={() => setFilterStatus('SEMUA')} className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition ${filterStatus === 'SEMUA' ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'}`}>Semua</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedList.length === 0 && <div className="col-span-full text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed">Tidak ada data di filter ini.</div>}
        {displayedList.map((item, idx) => (
          <div key={idx} className={`bg-white border rounded-xl p-5 shadow-sm relative overflow-hidden transition hover:shadow-md ${item.sisaHutang <= 0 ? 'border-emerald-200' : 'border-slate-200'}`}>
            <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-black uppercase rounded-bl-lg ${item.sisaHutang <= 0 ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                {item.sisaHutang <= 0 ? 'SUDAH LUNAS' : 'BELUM LUNAS'}
            </div>
            <div className="text-xs text-slate-500 mb-1">{formatDate(item.date)}</div>
            <div className="font-black text-lg uppercase text-slate-800">{item.customer || item.supplier}</div>
            <div className="text-[10px] font-mono text-slate-400 mb-4">{item.id}</div>
            
            <div className="space-y-2 mb-4 text-sm border-t border-slate-100 pt-3">
              <div className="flex justify-between"><span className="text-slate-500">Total Tagihan</span><span className="font-bold">{formatRp(item.totalTagihan)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Telah Dicicil/DP</span><span className="font-bold text-emerald-600">{formatRp(item.totalDibayar + item.totalCicilan)}</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-2"><span className="font-bold text-slate-700">Sisa {tab === 'piutang' ? 'Piutang' : 'Hutang'}</span><span className={`font-black ${item.sisaHutang <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatRp(item.sisaHutang)}</span></div>
            </div>
            
            <button onClick={() => setSelectedItem({ ...item, tipe: tab === 'piutang' ? 'PIUTANG' : 'HUTANG' })} className={`w-full py-2.5 rounded-lg text-sm font-bold text-white transition ${item.sisaHutang <= 0 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {item.sisaHutang <= 0 ? 'Lihat Riwayat Lunas' : 'Kelola Cicilan'}
            </button>
          </div>
        ))}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-lg">Kelola Cicilan / Riwayat</h3>
                <button onClick={() => setSelectedItem(null)} className="p-1 hover:bg-slate-200 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto">
                <div className="flex justify-between mb-2 text-sm"><span className="text-slate-500">Ref ID</span><span className="font-bold font-mono">{selectedItem.id}</span></div>
                <div className="flex justify-between mb-4 text-sm pb-4 border-b border-dashed"><span className="text-slate-500">{tab==='piutang'?'Pelanggan':'Supplier'}</span><span className="font-bold uppercase">{selectedItem.customer || selectedItem.supplier}</span></div>
                
                <div className={`flex justify-between items-center mb-6 p-4 rounded-xl border ${selectedItem.sisaHutang <= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-100'}`}>
                    <span className={`font-bold ${selectedItem.sisaHutang <= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{selectedItem.sisaHutang <= 0 ? 'STATUS: LUNAS SEPENUHNYA' : 'SISA HUTANG AKTUAL'}</span>
                    <span className={`text-xl font-black ${selectedItem.sisaHutang <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatRp(selectedItem.sisaHutang)}</span>
                </div>

                {selectedItem.sisaHutang > 0 && (
                    <form onSubmit={handleSimpanCicilan} className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
                        <h4 className="font-bold text-sm text-blue-900 mb-3">Input Pembayaran Cicilan Baru</h4>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="space-y-1"><label className="text-xs font-bold text-blue-800">Tanggal Bayar</label><input type="date" required value={payDate} onChange={e=>setPayDate(e.target.value)} className="w-full p-2 border rounded" /></div>
                            <div className="space-y-1"><label className="text-xs font-bold text-blue-800">Metode</label><select value={payMethod} onChange={e=>setPayMethod(e.target.value)} className="w-full p-2 border rounded"><option>Transfer Bank</option><option>Cash</option></select></div>
                        </div>
                        <div className="space-y-1 mb-3"><label className="text-xs font-bold text-blue-800">Nominal (Maks {formatRp(selectedItem.sisaHutang)})</label><input type="text" required value={formatRp(payAmount)} onChange={e=>setPayAmount(parseRp(e.target.value))} className="w-full p-2 border rounded font-bold text-lg" /></div>
                        <div className="flex justify-end"><button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold text-sm shadow-sm">Simpan Pembayaran</button></div>
                    </form>
                )}

                <h4 className="font-bold text-sm mb-3">Riwayat Cicilan Masuk</h4>
                <div className="space-y-2">
                    {selectedItem.cicilanList.length === 0 && <p className="text-xs text-slate-400 italic">Belum ada riwayat cicilan tambahan (hanya DP/Awal).</p>}
                    {selectedItem.cicilanList.map((c, i) => (
                        <div key={i} className="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50 transition">
                            <div><div className="text-[10px] text-slate-400 font-mono mb-0.5">{c.id}</div><div className="text-xs font-bold">{formatDate(c.date)} <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded ml-1 text-[9px]">{c.paymentMethod}</span></div></div>
                            <div className="flex items-center gap-4"><span className="font-black text-emerald-600">{formatRp(c.amount)}</span>
                                <div className="flex gap-1">
                                    <button type="button" onClick={() => setPrintData({ type: 'receipt', data: { payment: c, order: selectedItem } })} className="p-1.5 text-slate-500 hover:text-blue-600 bg-slate-100 rounded hover:bg-blue-50 transition" title="Cetak Bukti Cicilan"><Printer size={14} /></button>
                                    <button type="button" onClick={() => { requestDelete(c.id); setSelectedItem(null); }} className="p-1.5 text-slate-500 hover:text-red-600 bg-slate-100 rounded hover:bg-red-50 transition" title="Hapus Pembayaran"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
