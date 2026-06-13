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
  const [selectedAR, setSelectedAR] = useState(null); // Menyimpan data order yang mau dilunasi
  const [paymentForm, setPaymentForm] = useState({ date: todayStr, amount: '', method: 'TF_BCA', notes: '' });

  // --- 1. ENGINE PIUTANG AKTIF (BELUM LUNAS) ---
  const activeAR = useMemo(() => {
    return realOrders.filter(o => {
      if (o.isDeleted || (o.branch_id !== currentBranch && currentBranch !== 'TANGERANG_PUSAT')) return false;
      const sisa = Number(o.total_amount || 0) - Number(o.amount_paid || 0);
      return sisa > 0 || o.status === 'BELUM_LUNAS';
    }).sort((a, b) => new Date(a.date) - new Date(b.date)); // Yang paling lama ngutang di atas
  }, [realOrders, currentBranch]);

  // Filter pencarian nama pelanggan
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

    // 1. PAYLOAD UPDATE NOTA KASIR (ORDERS)
    const orderPayload = {
      ...selectedAR,
      amount_paid: newTotalPaid,
      status: isLunasTotal ? 'LUNAS' : 'BELUM_LUNAS'
    };

    // 2. PAYLOAD UANG MASUK (CASHFLOW IN)
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

    // Eksekusi Update & Insert Beruntun
    const isSuccess = await sendToSheet('update', orderPayload, 'orders');
    if (isSuccess) {
      await sendToSheet('insert', cashflowPayload, 'cashflow_transactions');
      
      showToast(`Pembayaran Rp ${formatNumber(nominalBayar)} diterima! Saldo Kas/Bank otomatis bertambah.`, 'success');
      setSelectedAR(null);
      setPaymentForm({ date: todayStr, amount: '', method: 'TF_BCA', notes: '' });

      // Auto Print Kwitansi Pelunasan
      if (window.confirm("Cetak Kwitansi Pelunasan / Cicilan ini?")) {
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
    // Set default amount ke sisa hutang (Biar gampang kalau mau lunasin full)
    setPaymentForm({ date: todayStr, amount: String(sisa), method: 'TF_BCA', notes: '' });
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* 🚀 BANNER DASHBOARD PIUTANG */}
      <div className="bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-800 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-500"></div>
        <div className="relative z-10 text-white">
           <div className="flex items-center gap-2 mb-1.5">
             <Landmark size={24} className="text-blue-400"/>
             <h2 className="text-2xl font-black uppercase tracking-widest">Buku Penagihan Piutang</h2>
           </div>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-md">
             Monitor semua nota pelanggan/agen yang masih gantung (DP) dari Kasir POS. Tarik dana pelunasan untuk mengamankan Cashflow pabrik.
           </p>
        </div>

        <div className="relative z-10 flex gap-4 shrink-0">
          <div className="bg-slate-950/50 border border-slate-700/50 rounded-2xl p-4 shadow-inner text-right">
             <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Total Tagihan Gantung / Piutang</div>
             <div className="text-2xl md:text-3xl font-black text-white tracking-tight">{formatRupiah(metrik.totalPiutangMengambang)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: DAFTAR AGEN YANG NGUTANG */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden border-t-4 border-t-blue-500 h-[75vh]">
          <div className="p-5 border-b bg-slate-50 shrink-0 space-y-4">
             <div className="flex justify-between items-center">
               <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2"><Clock size={16} className="text-blue-600"/> Daftar Piutang Aktif ({metrik.totalPelangganNgutang} Nota)</h4>
             </div>
             <div className="relative">
               <Search size={16} className="absolute left-3 top-3.5 text-slate-400"/>
               <input type="text" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-xs font-black uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all" placeholder="Cari nama agen atau pelanggan..." />
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/30">
            {filteredAR.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <ShieldCheck size={48} className="mb-3 opacity-20 text-emerald-500"/>
                <span className="font-black uppercase tracking-widest text-xs text-slate-400">Aman! Tidak ada pelanggan yang ngutang.</span>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAR.map(order => {
                  const sisaHutang = Number(order.total_amount) - Number(order.amount_paid);
                  const parsedItems = safeJsonParse(order.items, []);
                  
                  return (
                    <div key={order.id} className="border border-slate-200 rounded-2xl bg-white shadow-sm p-4 hover:border-blue-300 transition-colors">
                      <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                        <div className="flex gap-3 items-center">
                          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                            <User size={20}/>
                          </div>
                          <div>
                            <h5 className="font-black text-sm uppercase text-slate-800 leading-tight">{order.customer_name}</h5>
                            <span className="text-[9px] font-mono text-slate-400 mt-0.5 block">{order.id} • {formatDate(order.date)}</span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 text-[8px] font-black uppercase rounded bg-rose-50 text-rose-600 border border-rose-200 tracking-widest animate-pulse">BELUM LUNAS</span>
                      </div>
                      
                      <div className="mb-4">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Rincian Barang Diambil:</div>
                        <div className="space-y-1">
                          {parsedItems.map((item, idx) => (
                             <div key={idx} className="text-[10px] text-slate-600 uppercase font-bold flex justify-between items-start">
                               <span>• {item.name} <span className="text-blue-500 font-black">(x{formatNumber(item.qty)})</span></span>
                             </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1.5"><span>Total Nilai Nota:</span><span>{formatRupiah(order.total_amount)}</span></div>
                        <div className="flex justify-between items-center text-[10px] font-bold text-emerald-600 mb-2 border-b border-slate-200 pb-2"><span>DP / Sudah Masuk:</span><span>{formatRupiah(order.amount_paid)}</span></div>
                        <div className="flex justify-between items-center text-xs font-black text-rose-600 uppercase tracking-wider"><span>Sisa Harus Ditagih:</span><span>{formatRupiah(sisaHutang)}</span></div>
                      </div>

                      <button onClick={() => openPaymentModal(order)} className="w-full bg-blue-600 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest shadow-md hover:bg-blue-700 transition-transform active:scale-95 flex justify-center items-center gap-2">
                        <Wallet size={16}/> Terima Pembayaran Pelunasan
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* KANTONG KANAN: JURNAL HISTORI PELUNASAN */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-[75vh]">
          <div className="p-5 border-b bg-slate-50 shrink-0">
             <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2"><FileText size={16} className="text-emerald-600"/> Histori Uang Tagihan Masuk</h4>
             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">Jurnal rekam jejak pelunasan nota (Cashflow Masuk).</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-white text-[10px] uppercase text-slate-400 sticky top-0 shadow-sm border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 font-black">Ref Nota &amp; Tgl</th>
                  <th className="px-4 py-3 font-black">Metode &amp; Pelanggan</th>
                  <th className="px-4 py-3 font-black text-right">Uang Masuk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs font-bold">
                {historyPelunasan.length === 0 ? (
                  <tr><td colSpan="3" className="text-center py-16 text-slate-400 font-black uppercase tracking-widest bg-slate-50/50">Belum ada riwayat pelunasan dari agen.</td></tr>
                ) : (
                  historyPelunasan.map(log => (
                    <tr key={log.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-black">{formatDate(log.date)}</div>
                        <div className="text-[9px] font-mono text-blue-500 mt-0.5 font-bold cursor-help" title="ID Referensi Nota Asli">{log.reference_id}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border mb-1.5 inline-block ${log.method === 'CASH' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                          {log.method.replace('_', ' ')}
                        </span>
                        <div className="font-bold text-slate-700 uppercase text-[10px] leading-relaxed line-clamp-2">{log.description}</div>
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <span className="text-emerald-600 font-black text-sm flex items-center justify-end gap-1"><ArrowDownToLine size={12}/> {formatRupiah(log.amount)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 🚀 MODAL TERIMA PEMBAYARAN (SULTAN POP-UP) */}
      {selectedAR && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border w-full max-w-md overflow-hidden flex flex-col">
             <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
               <div className="flex items-center gap-2"><Wallet size={18}/><h3 className="font-black text-sm uppercase tracking-wider">Terima Dana Pelunasan</h3></div>
               <button onClick={() => setSelectedAR(null)} className="hover:text-blue-200 transition"><X size={20}/></button>
             </div>
             
             <form onSubmit={handleProcessPayment} className="p-6 space-y-5">
               <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl shadow-inner text-center">
                 <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Target Penagihan Pelanggan</div>
                 <div className="text-lg font-black text-blue-900 uppercase">{selectedAR.customer_name}</div>
                 <div className="text-xs font-black text-rose-600 uppercase mt-2 pt-2 border-t border-blue-200 border-dashed">
                   Sisa Hutang: {formatRupiah(Number(selectedAR.total_amount) - Number(selectedAR.amount_paid))}
                 </div>
               </div>

               <div>
                 <label className="text-[10px] font-black text-emerald-600 uppercase block mb-1">Nominal Uang Diterima Hari Ini</label>
                 <div className="relative">
                   <span className="absolute left-4 top-3.5 font-black text-emerald-400">Rp</span>
                   <input type="text" required value={paymentForm.amount ? Number(paymentForm.amount).toLocaleString('id-ID') : ''} onChange={e=>setPaymentForm({...paymentForm, amount: e.target.value.replace(/\D/g, '')})} className="w-full pl-11 pr-4 py-3 border-2 border-emerald-200 rounded-xl text-lg font-black text-emerald-700 bg-emerald-50/30 outline-none focus:bg-white focus:border-emerald-500 transition-colors" placeholder="0" />
                 </div>
                 <p className="text-[9px] font-bold text-slate-500 uppercase mt-1.5 leading-relaxed tracking-wider">Otomatis terisi nominal lunas. Ubah angka jika pelanggan hanya nyicil sebagian.</p>
               </div>

               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Tanggal Cair</label>
                   <input type="date" required value={paymentForm.date} onChange={e=>setPaymentForm({...paymentForm, date: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-black bg-slate-50 outline-none cursor-pointer" />
                 </div>
                 <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Metode / Jalur Uang</label>
                   <select required value={paymentForm.method} onChange={e=>setPaymentForm({...paymentForm, method: e.target.value})} className="w-full p-3 border rounded-xl text-[10px] font-black uppercase bg-slate-50 outline-none cursor-pointer focus:border-blue-400">
                     <option value="TF_BCA">TRANSFER (BCA PUSAT)</option>
                     <option value="TF_BRI">TRANSFER (BRI PUSAT)</option>
                     <option value="CASH">CASH (TUNAI LACI KASIR)</option>
                   </select>
                 </div>
               </div>

               <div>
                 <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Catatan Kasir (Opsional)</label>
                 <input type="text" value={paymentForm.notes} onChange={e=>setPaymentForm({...paymentForm, notes: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-bold uppercase bg-slate-50 outline-none focus:bg-white focus:border-blue-400" placeholder="Misal: Titip supir, Lunas TF, dll..." />
               </div>

               <button type="submit" className="w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-xl bg-blue-600 hover:bg-blue-700 transition-transform active:scale-95 flex justify-center items-center gap-2">
                 <CheckCircle2 size={16}/> Sahkan &amp; Masukkan Ke Kas
               </button>
             </form>
          </div>
        </div>
      )}

    </div>
  );
}
