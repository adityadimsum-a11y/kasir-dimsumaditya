import React, { useState, useMemo } from 'react';
import { 
  Landmark, Search, Wallet, FileText, CheckCircle2, 
  AlertTriangle, Clock, ArrowRightLeft, ArrowDownToLine,
  X, Printer, User, ShieldCheck
} from 'lucide-react';
import { getTodayStr, generateId, formatDate, safeJsonParse } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabPiutang({ 
  orders = [], orders_data, 
  cashflow_transactions = [], cashflow_transactions_data,
  sendToSheet, showToast, user, requestDelete 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  // --- SINKRONISASI DATABASE ---
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realCashflow = useMemo(() => cashflow_transactions_data || cashflow_transactions || [], [cashflow_transactions, cashflow_transactions_data]);

  // --- STATE MANAGEMENT ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAR, setSelectedAR] = useState(null); 
  const [paymentForm, setPaymentForm] = useState({ date: todayStr, amount: '', method: 'TF_BCA', notes: '' });

  // --- 1. ENGINE PIUTANG AKTIF (BELUM LUNAS) ---
  const activeAR = useMemo(() => {
    return realOrders.filter(o => {
      if (o.isDeleted || (o.branch_id !== currentBranch && currentBranch !== 'TANGERANG_PUSAT')) return false;
      const sisa = Number(o.total_amount || 0) - Number(o.amount_paid || 0);
      return sisa > 0 || o.status === 'BELUM_LUNAS';
    }).sort((a, b) => new Date(a.date) - new Date(b.date)); 
  }, [realOrders, currentBranch]);

  const filteredAR = useMemo(() => {
    if (!searchQuery) return activeAR;
    return activeAR.filter(o => String(o.customer_name).toUpperCase().includes(searchQuery.toUpperCase()));
  }, [activeAR, searchQuery]);

  // --- 2. ENGINE HISTORI PELUNASAN PIUTANG ---
  const historyPelunasan = useMemo(() => {
    return realCashflow.filter(c => {
      return !c.isDeleted && 
             c.type === 'IN' && 
             c.category === 'PELUNASAN PIUTANG AGEN' && 
             (c.branch_id === currentBranch || currentBranch === 'TANGERANG_PUSAT');
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realCashflow, currentBranch]);

  // --- 3. METRIK DASHBOARD ---
  const metrik = useMemo(() => {
    let totalPiutangMengambang = 0;
    let totalPelangganNgutang = activeAR.length;

    activeAR.forEach(o => {
      totalPiutangMengambang += (Number(o.total_amount || 0) - Number(o.amount_paid || 0));
    });

    return { totalPiutangMengambang, totalPelangganNgutang };
  }, [activeAR]);

  // --- ACTIONS: PROSES PELUNASAN / CICILAN ---
  const handleProcessPayment = async (e) => {
    e.preventDefault();
    if (!selectedAR) return;

    const nominalBayar = Number(paymentForm.amount);
    const sisaHutang = Number(selectedAR.total_amount) - Number(selectedAR.amount_paid);

    if (nominalBayar <= 0) return alert("Nominal pembayaran harus lebih dari Rp 0!");
    if (nominalBayar > sisaHutang) {
      return alert(`Nominal bayar (${formatRupiah(nominalBayar)}) tidak boleh melebihi sisa hutang (${formatRupiah(sisaHutang)})!`);
    }

    if (!window.confirm(`Konfirmasi Terima Pembayaran:\n\nPelanggan: ${selectedAR.customer_name}\nSisa Hutang Awal: ${formatRupiah(sisaHutang)}\nDibayar: ${formatRupiah(nominalBayar)}\nVia: ${paymentForm.method.replace('_', ' ')}\n\nLanjutkan?`)) {
      return;
    }

    const currentTotalPaid = Number(selectedAR.amount_paid || 0);
    const newTotalPaid = currentTotalPaid + nominalBayar;
    const isLunasTotal = newTotalPaid >= Number(selectedAR.total_amount);

    const orderPayload = {
      ...selectedAR,
      amount_paid: newTotalPaid,
      status: isLunasTotal ? 'LUNAS' : 'BELUM_LUNAS'
    };

    const cashflowPayload = {
      id: generateId('CFI', paymentForm.date),
      date: paymentForm.date,
      branch_id: currentBranch,
      type: 'IN',
      category: 'PELUNASAN PIUTANG AGEN',
      description: `Pelunasan Nota: ${selectedAR.id} - Pelanggan: ${selectedAR.customer_name} ${isLunasTotal ? '(LUNAS TOTAL)' : '(CICILAN)'}`,
      amount: nominalBayar,
      method: paymentForm.method,
      reference_id: selectedAR.id
    };

    const isSuccess = await sendToSheet('update', orderPayload, 'orders');
    if (isSuccess) {
      await sendToSheet('insert', cashflowPayload, 'cashflow_transactions');
      
      showToast(`Pembayaran Rp ${formatNumber(nominalBayar)} diterima! Saldo Kas/Bank otomatis bertambah.`, 'success');
      setSelectedAR(null);
      setPaymentForm({ date: todayStr, amount: '', method: 'TF_BCA', notes: '' });

      if (window.confirm("Cetak kwitansi pelunasan / cicilan ini?")) {
        triggerPrint('NOTA_DOTMATRIX', {
          title: isLunasTotal ? 'KWITANSI PELUNASAN BON TOTAL' : 'KWITANSI CICILAN PIUTANG',
          id: cashflowPayload.id, date: formatDate(paymentForm.date),
          branch_name: currentBranch, admin_name: user?.name || 'ADMIN', customer_name: selectedAR.customer_name,
          items: [{ name: `Pembayaran Piutang Nota: ${selectedAR.id}\nKet: ${paymentForm.notes || '-'}`, qty: 1, subtotal: nominalBayar }],
          amount: nominalBayar, paymentMethod: paymentForm.method.replace('_', ' '),
          history: {
             labelLama: 'Sisa Hutang Sebelumnya', nominalLama: sisaHutang,
             labelAksi: 'Pembayaran Masuk Hari Ini', nominalAksi: nominalBayar,
             labelBaru: 'SISA HUTANG AKTIF SAAT INI', nominalBaru: sisaHutang - nominalBayar
          }
        });
      }
    }
  };

  const openPaymentModal = (order) => {
    setSelectedAR(order);
    const sisa = Number(order.total_amount || 0) - Number(order.amount_paid || 0);
    setPaymentForm({ date: todayStr, amount: String(sisa), method: 'TF_BCA', notes: '' });
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      
      {/* 🚀 BANNER DASHBOARD PIUTANG - FLAT ENTERPRISE STYLE */}
      <div className="card-holo p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden bg-white">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>
        <div className="relative z-10 pl-2">
           <div className="flex items-center gap-2 mb-1.5">
             <Landmark size={24} className="text-blue-600"/>
             <h2 className="text-xl font-extrabold normal-case text-slate-900">Buku penagihan piutang</h2>
           </div>
           <p className="text-[10px] font-medium text-slate-500 normal-case leading-relaxed max-w-md">
             Monitor semua nota pelanggan atau agen yang masih gantung (DP) dari Kasir POS. Tarik dana pelunasan untuk mengamankan cashflow pabrik.
           </p>
        </div>

        <div className="relative z-10 flex gap-4 shrink-0 mt-4 md:mt-0">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-xs text-right min-w-[200px]">
             <div className="text-[9px] font-bold text-rose-600 normal-case mb-1">Total tagihan gantung / piutang</div>
             <div className="text-3xl font-black text-slate-800 tracking-tight">{formatRupiah(metrik.totalPiutangMengambang)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: DAFTAR AGEN YANG NGUTANG */}
        <div className="lg:col-span-7 card-holo flex flex-col overflow-hidden border-t-4 border-t-blue-600 h-[75vh]">
          <div className="p-5 border-b border-slate-200 bg-slate-50 shrink-0 space-y-4">
             <div className="flex justify-between items-center">
               <h4 className="font-extrabold text-slate-800 normal-case text-sm flex items-center gap-2"><Clock size={16} className="text-blue-600"/> Daftar piutang aktif ({metrik.totalPelangganNgutang} Nota)</h4>
             </div>
             <div className="relative">
               <Search size={16} className="absolute left-3 top-3.5 text-slate-400"/>
               <input type="text" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold normal-case outline-none focus:border-blue-500 transition-all shadow-inner" placeholder="Cari nama agen atau pelanggan..." />
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/50">
            {filteredAR.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <ShieldCheck size={48} className="mb-3 opacity-30 text-emerald-500"/>
                <span className="font-bold normal-case text-sm">Aman! Tidak ada pelanggan yang ngutang.</span>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAR.map(order => {
                  const sisaHutang = Number(order.total_amount) - Number(order.amount_paid);
                  const parsedItems = safeJsonParse(order.items, []);
                  
                  return (
                    <div key={order.id} className="border border-slate-200 rounded-xl bg-white shadow-xs p-4 hover:border-blue-300 transition-colors">
                      <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                        <div className="flex gap-3 items-center">
                          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                            <User size={20}/>
                          </div>
                          <div>
                            <h5 className="font-extrabold text-sm normal-case text-slate-800 leading-tight">{order.customer_name}</h5>
                            <span className="text-[9px] font-mono text-slate-400 mt-0.5 block">{order.id} • {formatDate(order.date)}</span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 text-[8px] font-bold normal-case rounded bg-rose-50 text-rose-600 border border-rose-200 animate-pulse shadow-xs">Belum lunas</span>
                      </div>
                      
                      <div className="mb-4">
                        <div className="text-[9px] font-bold text-slate-400 normal-case mb-1.5">Rincian barang diambil:</div>
                        <div className="space-y-1">
                          {parsedItems.map((item, idx) => (
                             <div key={idx} className="text-[10px] text-slate-600 normal-case font-medium flex justify-between items-start">
                               <span>• {item.name} <span className="text-blue-500 font-bold">(x{formatNumber(item.qty)})</span></span>
                             </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4 shadow-inner">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1.5 normal-case"><span>Total nilai nota:</span><span>{formatRupiah(order.total_amount)}</span></div>
                        <div className="flex justify-between items-center text-[10px] font-bold text-emerald-600 mb-2 border-b border-slate-200 pb-2 normal-case"><span>DP / sudah masuk:</span><span>{formatRupiah(order.amount_paid)}</span></div>
                        <div className="flex justify-between items-center text-xs font-black text-rose-600 normal-case"><span>Sisa harus ditagih:</span><span>{formatRupiah(sisaHutang)}</span></div>
                      </div>

                      <button onClick={() => openPaymentModal(order)} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-lg text-xs normal-case shadow-sm hover:bg-blue-700 transition-colors flex justify-center items-center gap-2">
                        <Wallet size={16}/> Terima pembayaran pelunasan
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* KANTONG KANAN: JURNAL HISTORI PELUNASAN */}
        <div className="lg:col-span-5 card-holo flex flex-col overflow-hidden h-[75vh]">
          <div className="p-5 border-b border-slate-200 bg-slate-50 shrink-0">
             <h4 className="font-extrabold text-slate-800 normal-case text-sm flex items-center gap-2"><FileText size={16} className="text-emerald-600"/> Histori uang tagihan masuk</h4>
             <p className="text-[10px] text-slate-500 font-medium normal-case mt-1">Jurnal rekam jejak pelunasan nota (Cashflow masuk).</p>
          </div>
          <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-white text-[10px] normal-case text-slate-400 sticky top-0 shadow-xs border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-bold">Ref nota &amp; tgl</th>
                  <th className="px-4 py-3 font-bold">Metode &amp; pelanggan</th>
                  <th className="px-4 py-3 font-bold text-right">Uang masuk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
                {historyPelunasan.length === 0 ? (
                  <tr><td colSpan="3" className="text-center py-20 text-slate-400 font-medium normal-case bg-white">Belum ada riwayat pelunasan dari agen.</td></tr>
                ) : (
                  historyPelunasan.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-bold">{formatDate(log.date)}</div>
                        <div className="text-[9px] font-mono text-blue-500 mt-0.5 font-bold cursor-help" title="ID Referensi Nota Asli">{log.reference_id}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold normal-case border mb-1.5 inline-block ${log.method === 'CASH' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                          {log.method.replace('_', ' ')}
                        </span>
                        <div className="font-semibold text-slate-700 normal-case text-[10px] leading-relaxed line-clamp-2">{log.description}</div>
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <span className="text-emerald-600 font-extrabold text-sm flex items-center justify-end gap-1"><ArrowDownToLine size={12}/> {formatRupiah(log.amount)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 🚀 MODAL TERIMA PEMBAYARAN (CLEAN ENTERPRISE) */}
      {selectedAR && (
        <div className="fixed inset-0 bg-slate-900/40 z-[9999] flex justify-center items-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
             <div className="bg-blue-600 text-white px-5 py-4 flex items-center justify-between">
               <div className="flex items-center gap-2"><Wallet size={16}/><h3 className="font-bold text-xs normal-case">Terima dana pelunasan</h3></div>
               <button onClick={() => setSelectedAR(null)} className="hover:text-blue-200 transition"><X size={18}/></button>
             </div>
             
             <form onSubmit={handleProcessPayment} className="p-5 space-y-4">
               <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-inner text-center">
                 <div className="text-[9px] font-bold text-slate-400 normal-case mb-1">Target penagihan pelanggan</div>
                 <div className="text-base font-extrabold text-slate-800 normal-case">{selectedAR.customer_name}</div>
                 <div className="text-xs font-bold text-red-600 normal-case mt-2 pt-2 border-t border-slate-200 border-dashed">
                   Sisa hutang: {formatRupiah(Number(selectedAR.total_amount) - Number(selectedAR.amount_paid))}
                 </div>
               </div>

               <div>
                 <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Nominal uang diterima hari ini</label>
                 <div className="relative">
                   <span className="absolute left-3 top-2.5 font-bold text-emerald-500 text-xs">Rp</span>
                   <input type="text" required value={paymentForm.amount ? Number(paymentForm.amount).toLocaleString('id-ID') : ''} onChange={e=>setPaymentForm({...paymentForm, amount: e.target.value.replace(/\D/g, '')})} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm font-extrabold text-emerald-700 bg-slate-50 outline-none focus:bg-white focus:border-emerald-500 transition-colors shadow-inner" placeholder="0" />
                 </div>
                 <p className="text-[9px] font-medium text-slate-400 normal-case mt-1.5 leading-relaxed">Otomatis terisi nominal lunas. Ubah angka jika pelanggan hanya nyicil sebagian.</p>
               </div>

               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Tanggal cair</label>
                   <input type="date" required value={paymentForm.date} onChange={e=>setPaymentForm({...paymentForm, date: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-bold bg-white outline-none cursor-pointer focus:border-blue-500" />
                 </div>
                 <div>
                   <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Metode / Jalur uang</label>
                   <select required value={paymentForm.method} onChange={e=>setPaymentForm({...paymentForm, method: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-[10px] font-bold normal-case bg-white outline-none cursor-pointer focus:border-blue-500">
                     <option value="TF_BCA">Transfer (BCA Pusat)</option>
                     <option value="TF_BRI">Transfer (BRI Pusat)</option>
                     <option value="CASH">Cash (Tunai Laci)</option>
                   </select>
                 </div>
               </div>

               <div>
                 <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Catatan kasir (Opsional)</label>
                 <input type="text" value={paymentForm.notes} onChange={e=>setPaymentForm({...paymentForm, notes: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-medium normal-case bg-white outline-none focus:border-blue-500" placeholder="Misal: Titip supir, Lunas TF, dll..." />
               </div>

               <button type="submit" className="w-full btn-holo py-3.5 rounded-lg text-xs font-bold shadow-xs flex justify-center items-center gap-2">
                 <CheckCircle2 size={16}/> Sahkan &amp; masukkan ke kas
               </button>
             </form>
          </div>
        </div>
      )}

    </div>
  );
}
