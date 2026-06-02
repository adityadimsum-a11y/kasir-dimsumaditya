import React, { useState, useMemo } from 'react';
import { X, CheckCircle, Printer, Trash2 } from 'lucide-react';
import { formatRp, parseRp, generateId, formatDate } from '../../utils/helpers';

export default function TabPiutang({ orders, purchases, payments, sendToSheet, requestDelete, setPrintData, role }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [bayarAmount, setBayarAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Transfer');
  const [viewTab, setViewTab] = useState('piutang'); 

  const visibleOrders = useMemo(() => role === 'branch' ? (orders||[]).filter(o => o?.category === 'Pemalang') : (orders||[]).filter(o => o?.category !== 'Pemalang'), [orders, role]);

  const daftarPiutang = useMemo(() => {
    const groups = {};
    visibleOrders.forEach(o => {
        if(!o?.id) return;
        if(!groups[o.id]) groups[o.id] = { ...o, totalAll: 0, paidAll: Number(o.paidAmount)||0 };
        groups[o.id].totalAll += Number(o.total) || 0;
    });

    return Object.values(groups).map(order => {
      const orderPayments = (payments||[]).filter(p => p?.orderId === order.id);
      const cicilan = orderPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const sisa = order.totalAll - order.paidAll - cicilan;
      return { ...order, tipe: 'PIUTANG', cicilanTerbayar: cicilan, sisaHutang: sisa, orderPayments };
    }).filter(o => o.sisaHutang > 0 || (o.orderPayments && o.orderPayments.length > 0)); 
  }, [visibleOrders, payments]);

  const daftarHutang = useMemo(() => {
    const groups = {};
    (purchases||[]).forEach(p => {
        if(!p?.id) return;
        if(!groups[p.id]) groups[p.id] = { ...p, totalAll: 0, paidAll: Number(p.paidAmount)||0 };
        groups[p.id].totalAll += Number(p.total) || 0;
    });

    return Object.values(groups).map(pur => {
      const purPayments = (payments||[]).filter(p => p?.orderId === pur.id);
      const cicilan = purPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const sisa = pur.totalAll - pur.paidAll - cicilan;
      return { ...pur, tipe: 'HUTANG', customer: pur.supplier, cicilanTerbayar: cicilan, sisaHutang: sisa, orderPayments: purPayments };
    }).filter(p => p.sisaHutang > 0 || (p.orderPayments && p.orderPayments.length > 0)); 
  }, [purchases, payments]);

  const handleBayar = (e) => {
    e.preventDefault();
    if(bayarAmount <= 0 || bayarAmount > selectedItem?.sisaHutang) return; 
    const tgl = new Date();
    const newPayment = {
        id: generateId('PAY', tgl.toISOString().split('T')[0]),
        orderId: selectedItem.id, date: tgl.toISOString().split('T')[0],
        amount: Number(bayarAmount)||0, paymentMethod 
    };
    sendToSheet('insert', newPayment, 'payments');
    setBayarAmount(0); 
  };

  const listToRender = viewTab === 'piutang' ? (daftarPiutang || []) : (daftarHutang || []);
  const activeItem = selectedItem ? listToRender.find(o=>o.id===selectedItem.id) : null;

  return (
    <div className="space-y-4 animate-in fade-in">
        {activeItem && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-auto">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-lg">Kelola Cicilan {activeItem.tipe === 'HUTANG' ? 'ke Supplier' : 'dari Pelanggan'}</h3>
                        <button onClick={() => setSelectedItem(null)} className="p-1.5 bg-slate-100 rounded-full"><X size={20}/></button>
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-xl mb-6">
                        <div className="flex justify-between mb-2 pb-2 border-b"><span className="text-slate-500 text-sm">Ref ID</span><span className="font-mono text-sm font-bold">{activeItem.id}</span></div>
                        <div className="flex justify-between mb-2 pb-2 border-b"><span className="text-slate-500 text-sm">{activeItem.tipe === 'HUTANG' ? 'Supplier' : 'Pelanggan'}</span><span className="font-bold text-sm uppercase">{activeItem.customer}</span></div>
                        <div className="flex justify-between pt-2"><span className="font-bold text-red-600">SISA HUTANG AKTUAL</span><span className="font-bold text-red-700 text-lg">{formatRp(activeItem?.sisaHutang)}</span></div>
                    </div>

                    {(activeItem?.sisaHutang > 0) && (
                        <form onSubmit={handleBayar} className="space-y-4 mb-8 bg-blue-50 p-4 rounded-xl border border-blue-200">
                            <h4 className="font-bold text-sm text-blue-800">Input Pembayaran Cicilan</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-xs font-bold text-blue-700">Metode</label><select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="w-full p-2 border rounded-lg mt-1 text-sm"><option value="Transfer">Transfer Bank</option><option value="Cash">Tunai (Cash)</option></select></div>
                                <div><label className="text-xs font-bold text-blue-700">Nominal (Maks {formatRp(activeItem.sisaHutang)})</label><input type="text" required value={formatRp(bayarAmount)} onChange={e => {let v=parseRp(e.target.value); if(v>activeItem.sisaHutang) v=activeItem.sisaHutang; setBayarAmount(v);}} className="w-full p-2 border rounded-lg mt-1 text-sm font-bold" /></div>
                            </div>
                            <div className="flex justify-end mt-2"><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm">Simpan Cicilan</button></div>
                        </form>
                    )}

                    <div>
                        <h4 className="font-bold text-sm text-slate-700 mb-3 border-b pb-1">Riwayat Cicilan</h4>
                        {(!activeItem?.orderPayments || activeItem.orderPayments.length === 0) && <p className="text-sm text-slate-400 italic">Belum ada riwayat cicilan.</p>}
                        {(activeItem?.orderPayments || []).map(pay => (
                            <div key={pay.id} className="flex justify-between items-center bg-white border p-3 rounded-lg mb-2">
                                <div><div className="text-[10px] font-mono text-slate-400">{pay.id}</div><div className="text-sm font-medium">{formatDate(pay.date)}</div></div>
                                <div className="text-xs font-bold text-slate-500 px-2 bg-slate-100 rounded py-0.5">{pay.paymentMethod}</div>
                                <div className="font-bold text-emerald-600 flex-1 text-right mr-4">{formatRp(pay.amount)}</div>
                                <div className="flex gap-2">
                                    <button onClick={() => setPrintData({ type: 'receipt', data: { payment: pay, order: activeItem }})} className="p-1.5 bg-slate-100 rounded text-slate-600"><Printer size={16} /></button>
                                    <button onClick={() => requestDelete(pay.id)} className="p-1.5 bg-red-50 text-red-500 rounded"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

      {role === 'admin' && (
      <div className="flex bg-slate-200 p-1 rounded-xl max-w-md">
         <button onClick={()=>setViewTab('piutang')} className={`flex-1 py-2 font-bold rounded-lg text-sm transition ${viewTab==='piutang'?'bg-white shadow text-slate-800':'text-slate-500'}`}>Piutang (Pelanggan Ngutang)</button>
         <button onClick={()=>setViewTab('hutang')} className={`flex-1 py-2 font-bold rounded-lg text-sm transition ${viewTab==='hutang'?'bg-white shadow text-red-600':'text-slate-500'}`}>Hutang (Kita Ngutang Supplier)</button>
      </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {listToRender.filter(o => o?.sisaHutang > 0).length === 0 ? (
          <div className="text-center p-12 bg-white rounded-xl border border-dashed text-slate-500 col-span-full">
              <CheckCircle size={48} className="mx-auto text-emerald-400 mb-3" />
              <p>Hore! Semua nota {viewTab} telah lunas.</p>
          </div>
        ) : (
          listToRender.filter(o => o?.sisaHutang > 0).map((item) => (
            <div key={item.id} className={`bg-white p-5 rounded-xl border-2 relative ${viewTab==='piutang'?'border-slate-200':'border-orange-200'}`}>
                <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">BELUM LUNAS</div>
                <div className="text-sm text-slate-500 mb-1">{formatDate(item.date)}</div>
                <div className="font-bold text-lg mb-1 uppercase">{item.customer}</div>
                <div className="text-[10px] font-mono text-slate-400 mb-4">{item.id}</div>
                
                <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between border-b pb-1"><span className="text-slate-500">Total Tagihan</span><span className="font-medium">{formatRp(item.totalAll)}</span></div>
                    <div className="flex justify-between border-b pb-1"><span className="text-slate-500">Telah Dicicil</span><span className="font-bold text-emerald-600">{formatRp((Number(item.paidAll)||0)+(Number(item.cicilanTerbayar)||0))}</span></div>
                    <div className="flex justify-between pt-1"><span className="font-bold text-red-600">Sisa Hutang</span><span className="font-bold text-red-700 text-base">{formatRp(item.sisaHutang)}</span></div>
                </div>
                
                <button onClick={() => {setSelectedItem(item); setBayarAmount(item.sisaHutang)}} className={`w-full text-white py-2.5 rounded-lg font-bold text-sm transition ${viewTab==='piutang'?'bg-blue-600 hover:bg-blue-700':'bg-orange-600 hover:bg-orange-700'}`}>
                    Kelola Cicilan
                </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
