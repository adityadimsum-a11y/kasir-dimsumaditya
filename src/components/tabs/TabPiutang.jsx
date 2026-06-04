import React, { useState, useMemo } from 'react';
import { CreditCard, Wallet, Search, Clock, X } from 'lucide-react';
import { formatRp, getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabPiutang({ orders, purchases, payments, sendToSheet, setPrintData, role }) {
  const todayStr = getTodayStr();
  const [filterCustomer, setFilterCustomer] = useState('');
  
  // PERBAIKAN TYPO DISINI: showFormPayment sudah disamakan
  const [showFormPayment, setShowFormPayment] = useState(false); 
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Form Payment
  const [payDate, setPayDate] = useState(todayStr);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash / Tunai');

  // FILTERING LOGIC (100% AMAN ANTI-CRASH)
  const dashboardData = useMemo(() => {
      const myOrders = role === 'branch' ? (orders || []).filter(o => o?.category === 'Pemalang') : (orders || []).filter(o => o?.category !== 'Pemalang');
      const myPurchases = role === 'admin' ? (purchases || []) : [];

      const groupOrdersAll = {};
      myOrders.forEach(o => {
          if(!o?.id) return;
          if(!groupOrdersAll[o.id]) {
              groupOrdersAll[o.id] = { ...o, items: [], totalTagihan: 0, totalDibayar: Number(o.paidAmount)||0, statusProduksi: o.statusProduksi || 'Menunggu Produksi' };
          }
          groupOrdersAll[o.id].items.push(`${o.qty || 0} Pcs`);
          groupOrdersAll[o.id].totalTagihan += Number(o.total)||0;
      });

      const groupPurAll = {};
      myPurchases.forEach(p => {
          if(!p?.id) return;
          if(!groupPurAll[p.id]) {
              groupPurAll[p.id] = { ...p, items: [], totalTagihan: 0, totalDibayar: Number(p.paidAmount)||0 };
          }
          groupPurAll[p.id].items.push(`${p.itemName || '-'} (${p.qty || 0} ${p.satuan || ''})`);
          groupPurAll[p.id].totalTagihan += Number(p.total)||0;
      });

      // FILTER SYARAT PIUTANG: Sisa > 0 && Status Harus 'Sudah Diambil'
      const piutangPelanggan = Object.values(groupOrdersAll).map(grp => {
          const cicilan = (payments || []).filter(p => p?.orderId === grp.id).reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);
          return { ...grp, cicilanTerbayar: cicilan, sisaHutang: grp.totalTagihan - grp.totalDibayar - cicilan };
      }).filter(o => o.sisaHutang > 0 && o.statusProduksi === 'Sudah Diambil').sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));

      const hutangSupplier = Object.values(groupPurAll).map(grp => {
          const cicilan = (payments || []).filter(p => p?.orderId === grp.id).reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);
          return { ...grp, cicilanTerbayar: cicilan, sisaHutang: grp.totalTagihan - grp.totalDibayar - cicilan };
      }).filter(p => p.sisaHutang > 0).sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));

      const totalPiutang = piutangPelanggan.reduce((sum, item) => sum + (item.sisaHutang || 0), 0);
      const totalHutang = hutangSupplier.reduce((sum, item) => sum + (item.sisaHutang || 0), 0);

      return { piutangPelanggan, hutangSupplier, totalPiutang, totalHutang };
  }, [orders, purchases, payments, role]);

  const handleOpenPayment = (inv, type) => {
      setSelectedInvoice({ ...inv, type });
      setPayDate(todayStr); 
      setPayAmount(inv.sisaHutang); 
      setPayMethod('Cash / Tunai');
      setShowFormPayment(true); 
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSimpanPayment = (e) => {
      e.preventDefault();
      if (!selectedInvoice) return;
      
      const nominal = Number(payAmount);
      if(nominal <= 0 || nominal > selectedInvoice.sisaHutang) {
          alert('Nominal tidak valid atau melebihi sisa hutang!'); return;
      }
      
      const payId = generateId('PAY', payDate);
      const newData = { id: payId, orderId: selectedInvoice.id, date: payDate, amount: nominal, paymentMethod: payMethod, editCount: 0 };
      
      sendToSheet('insert', newData, 'payments');
      setShowFormPayment(false); 
      setSelectedInvoice(null);
      
      // Auto cetak tanda terima
      setPrintData({ 
          type: 'receipt', 
          data: { 
              payment: { ...newData, sisaAtThisPoint: selectedInvoice.sisaHutang - nominal }, 
              order: { ...selectedInvoice, tipe: selectedInvoice.type === 'HutangBeli' ? 'HUTANG' : 'PIUTANG' } 
          } 
      });
  };

  // Guard pencarian agar tidak crash jika nama customer undefined
  const piutangFiltered = filterCustomer ? (dashboardData.piutangPelanggan || []).filter(p => String(p.customer || '').toLowerCase().includes(filterCustomer.toLowerCase())) : (dashboardData.piutangPelanggan || []);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
        
        {/* CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-orange-200 shadow-sm p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none"><Clock size={64}/></div>
                <div className="text-sm font-bold text-orange-600 mb-2 uppercase">Total Piutang Berjalan (Uang Nyangkut)</div>
                <div className="text-3xl font-black text-slate-800">{formatRp(dashboardData.totalPiutang)}</div>
                <div className="text-xs text-slate-500 mt-2">Hanya order yang sudah <span className="font-bold text-orange-600">diambil pelanggan</span>.</div>
            </div>
            {role === 'admin' && (
                <div className="bg-white rounded-xl border border-red-200 shadow-sm p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none"><Wallet size={64}/></div>
                    <div className="text-sm font-bold text-red-600 mb-2 uppercase">Total Hutang Supplier (Harus Dibayar)</div>
                    <div className="text-3xl font-black text-slate-800">{formatRp(dashboardData.totalHutang)}</div>
                    <div className="text-xs text-slate-500 mt-2">Akumulasi hutang restock gudang.</div>
                </div>
            )}
        </div>

        {/* MODAL BAYAR */}
        {showFormPayment && selectedInvoice && (
            <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6 relative animate-in zoom-in-95 duration-200">
                <button type="button" onClick={() => setShowFormPayment(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20}/></button>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><CreditCard className="text-emerald-400"/> Form Pembayaran {selectedInvoice.type === 'HutangBeli' ? 'Hutang Supplier' : 'Piutang Pelanggan'}</h3>
                
                <div className="bg-slate-800 p-4 rounded-xl mb-6 grid grid-cols-2 gap-4">
                    <div><div className="text-[10px] text-slate-400 font-bold uppercase">No. Tagihan</div><div className="text-sm font-black text-white">{selectedInvoice.id}</div></div>
                    <div><div className="text-[10px] text-slate-400 font-bold uppercase">{selectedInvoice.type === 'HutangBeli' ? 'Supplier' : 'Pelanggan'}</div><div className="text-sm font-black text-white">{selectedInvoice.type === 'HutangBeli' ? selectedInvoice.supplier : selectedInvoice.customer}</div></div>
                    <div><div className="text-[10px] text-slate-400 font-bold uppercase">Sisa Tagihan Aktual</div><div className="text-xl font-black text-red-400">{formatRp(selectedInvoice.sisaHutang)}</div></div>
                </div>

                <form onSubmit={handleSimpanPayment} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-400 uppercase">Tanggal Bayar</label><input type="date" required value={payDate} onChange={e=>setPayDate(e.target.value)} className="w-full p-3 rounded-lg border-none bg-white font-bold text-slate-800" /></div>
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-400 uppercase">Nominal Dibayar</label><input type="number" max={selectedInvoice.sisaHutang} min="1" required value={payAmount} onChange={e=>setPayAmount(e.target.value)} className="w-full p-3 rounded-lg border-none bg-white font-bold text-lg text-slate-800" placeholder="Rp" /></div>
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-400 uppercase">Metode Pembayaran</label><select value={payMethod} onChange={e=>setPayMethod(e.target.value)} className="w-full p-3 rounded-lg border-none bg-white font-bold text-slate-800"><option value="Cash / Tunai">Cash / Tunai</option><option value="Transfer Bank">Transfer Bank</option><option value="QRIS">QRIS</option></select></div>
                    <div className="md:col-span-3 flex justify-end mt-4"><button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-8 py-3 rounded-xl shadow-lg transition">Simpan Pembayaran & Cetak Bukti</button></div>
                </form>
            </div>
        )}

        {/* TABEL PIUTANG PELANGGAN */}
        <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-hidden mt-6">
            <div className="p-4 border-b bg-orange-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <h4 className="font-bold text-slate-800">Daftar Tagihan Piutang (Pelanggan)</h4>
                <div className="flex bg-white rounded-lg border px-3 py-1.5 items-center gap-2 w-full md:w-64 shadow-sm"><Search size={14} className="text-slate-400"/><input type="text" placeholder="Cari pelanggan..." value={filterCustomer} onChange={e=>setFilterCustomer(e.target.value)} className="outline-none text-xs w-full"/></div>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[700px]">
                <thead className="bg-white border-b text-[10px] text-slate-500 uppercase"><tr><th className="px-4 py-3">No. Invoice & Tgl</th><th className="px-4 py-3">Pelanggan</th><th className="px-4 py-3 text-right">Total Order</th><th className="px-4 py-3 text-right">Terbayar (DP+Cicil)</th><th className="px-4 py-3 text-right">Sisa Tagihan</th><th className="px-4 py-3 text-center">Tindakan</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                    {piutangFiltered.length === 0 ? <tr><td colSpan="6" className="text-center py-8 text-slate-400">Tidak ada piutang berjalan.</td></tr> : piutangFiltered.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3"><div className="font-mono text-[11px] font-bold text-slate-700">{p.id}</div><div className="text-[10px] text-slate-500">{formatDate(p.date)}</div></td>
                            <td className="px-4 py-3 font-bold uppercase text-xs text-slate-800">{p.customer}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{formatRp(p.totalTagihan)}</td>
                            <td className="px-4 py-3 text-right text-emerald-600 font-medium">{formatRp(p.totalDibayar + p.cicilanTerbayar)}</td>
                            <td className="px-4 py-3 text-right font-black text-red-600 text-lg">{formatRp(p.sisaHutang)}</td>
                            <td className="px-4 py-3 text-center"><button type="button" onClick={()=>handleOpenPayment(p, 'PiutangJual')} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-4 py-2 rounded-lg font-bold text-[10px] shadow-sm transition">BAYAR</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
        </div>

        {/* TABEL HUTANG SUPPLIER (KHUSUS ADMIN) */}
        {role === 'admin' && (
        <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden mt-6">
            <div className="p-4 border-b bg-red-50"><h4 className="font-bold text-slate-800">Daftar Tagihan Hutang (Supplier Gudang)</h4></div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[700px]">
                <thead className="bg-white border-b text-[10px] text-slate-500 uppercase"><tr><th className="px-4 py-3">No. Invoice & Tgl</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3 text-right">Total Belanja</th><th className="px-4 py-3 text-right">Terbayar (DP+Cicil)</th><th className="px-4 py-3 text-right">Sisa Hutang</th><th className="px-4 py-3 text-center">Tindakan</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                    {(!dashboardData.hutangSupplier || dashboardData.hutangSupplier.length === 0) ? <tr><td colSpan="6" className="text-center py-8 text-slate-400">Tidak ada hutang berjalan.</td></tr> : dashboardData.hutangSupplier.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3"><div className="font-mono text-[11px] font-bold text-slate-700">{p.id}</div><div className="text-[10px] text-slate-500">{formatDate(p.date)}</div></td>
                            <td className="px-4 py-3 font-bold uppercase text-xs text-slate-800">{p.supplier}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{formatRp(p.totalTagihan)}</td>
                            <td className="px-4 py-3 text-right text-emerald-600 font-medium">{formatRp(p.totalDibayar + p.cicilanTerbayar)}</td>
                            <td className="px-4 py-3 text-right font-black text-red-600 text-lg">{formatRp(p.sisaHutang)}</td>
                            <td className="px-4 py-3 text-center"><button type="button" onClick={()=>handleOpenPayment(p, 'HutangBeli')} className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-4 py-2 rounded-lg font-bold text-[10px] shadow-sm transition">BAYAR</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
        </div>
        )}
    </div>
  );
}
