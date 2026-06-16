import React, { useState, useMemo } from 'react';
import { DollarSign, Search, CreditCard, History, Printer, CheckCircle2, User, FileText, AlertOctagon } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabPiutang({ 
  orders = [], 
  piutangPayments = [], 
  sendToSheet, 
  setPrintData, // 🔥 Menggunakan Print Engine Baru
  showToast, 
  user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id === 'PUSAT' ? 'TANGERANG_PUSAT' : (user?.branch_id || 'TANGERANG_PUSAT');
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT';

  // --- STATE MANAGEMENT ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payNotes, setPayNotes] = useState('');

  // --- ENGINE KALKULASI PIUTANG ---
  const piutangData = useMemo(() => {
    const orderMap = {};
    
    // 1. Ambil semua nota yang valid
    (orders || []).filter(o => !o.isDeleted).forEach(o => {
      // Jika bukan HQ, hanya lihat piutang cabangnya sendiri
      if (!isHQ && o.branch_id !== currentBranch) return;

      orderMap[o.id] = {
        ...o,
        totalTagihan: Number(o.total_amount || o.total || 0), // Fix proper field checking
        totalBayar: Number(o.amount_paid || o.paidAmount || 0),
        cicilan: [],
      };
    });

    // 2. Tambahkan history pembayaran cicilan
    (piutangPayments || []).filter(p => !p.isDeleted).forEach(p => {
      if (orderMap[p.orderId]) {
        orderMap[p.orderId].totalBayar += Number(p.amount || 0);
        orderMap[p.orderId].cicilan.push(p);
      }
    });

    // 3. Hitung sisa dan filter yang masih ngutang
    return Object.values(orderMap)
      .map(o => ({ ...o, sisaTagihan: o.totalTagihan - o.totalBayar }))
      .filter(o => o.sisaTagihan > 0 && (o.payment_method === 'PIUTANG' || o.paymentMethod === 'PIUTANG' || o.statusProduksi === 'Sudah Diambil' || o.paymentMethod === 'TEMPO' || o.payment_method === 'COD_PO' || String(o.payment_method).includes('DP_')))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [orders, piutangPayments, isHQ, currentBranch]);

  const filteredPiutang = useMemo(() => {
    if (!searchTerm) return piutangData;
    const lower = searchTerm.toLowerCase();
    return piutangData.filter(p => (p.customer_name || p.customer || '').toLowerCase().includes(lower) || p.id.toLowerCase().includes(lower));
  }, [piutangData, searchTerm]);

  const totalPiutangGlobal = useMemo(() => {
    return filteredPiutang.reduce((sum, item) => sum + item.sisaTagihan, 0);
  }, [filteredPiutang]);

  // --- ACTIONS: PROSES PEMBAYARAN CICILAN / LUNAS ---
  const handleBayar = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return alert("Pilih nota tagihan terlebih dahulu!");
    
    const amt = Number(payAmount);
    if (amt <= 0) return alert("Nominal pembayaran tidak valid!");
    if (amt > selectedOrder.sisaTagihan) return alert(`Pembayaran (${formatRupiah(amt)}) melebihi sisa tagihan (${formatRupiah(selectedOrder.sisaTagihan)})!`);

    const customerName = selectedOrder.customer_name || selectedOrder.customer;

    const confirmMsg = `Konfirmasi Pembayaran Piutang:\n\n` +
      `Pelanggan: ${customerName}\n` +
      `Nota: ${selectedOrder.id}\n` +
      `Nominal Bayar: ${formatRupiah(amt)}\n` +
      `Metode: ${payMethod.replace(/_/g, ' ')}\n\n` +
      `Lanjutkan proses pembayaran?`;

    if (!window.confirm(confirmMsg)) return;

    const payId = generateId('PAY', todayStr);
    
    // Payload untuk tabel payments
    const payloadPiutang = {
      id: payId,
      date: todayStr,
      orderId: selectedOrder.id,
      amount: amt,
      paymentMethod: payMethod,
      notes: payNotes || '-',
      pic: user?.name || 'ADMIN',
      branch_id: selectedOrder.branch_id,
      isDeleted: false
    };

    // Payload untuk Jurnal Kas Utama
    const payloadCashflow = {
      id: generateId('CFI', todayStr),
      date: todayStr,
      branch_id: selectedOrder.branch_id,
      type: 'IN',
      category: 'PELUNASAN PIUTANG',
      description: `Pelunasan Piutang Nota ${selectedOrder.id} - ${customerName}`,
      amount: amt,
      method: payMethod,
      reference_id: payId,
      isDeleted: false
    };

    // Tembak ke database GAS (Tabel: payments)
    const success = await sendToSheet('insert', payloadPiutang, 'payments'); 
    if (success) {
      await sendToSheet('insert', payloadCashflow, 'cashflow_transactions');
      showToast("Pembayaran piutang berhasil dicatat!", "success");

      // 🔥 AUTO PRINT STRUK TANDA TERIMA PEMBAYARAN
      if (typeof setPrintData === 'function') {
        setPrintData({
          type: 'INVOICE',
          id: payId,
          date: formatDate(todayStr),
          branch_name: selectedOrder.branch_id.replace(/_/g, ' '),
          admin_name: user?.name || 'Admin Kasir',
          customer_name: customerName,
          position: 'BUKTI PEMBAYARAN PIUTANG',
          items: [{ name: `Pelunasan Cicilan Nota:\n${selectedOrder.id}`, qty: 1, subtotal: amt }],
          amount: amt,
          paymentMethod: payMethod.replace(/_/g, ' '),
          history: {
            labelLama: 'Sisa Tagihan Awal', nominalLama: selectedOrder.sisaTagihan,
            labelAksi: 'Total Disetor Hari Ini', nominalAksi: amt,
            labelBaru: 'SISA TAGIHAN BERJALAN', nominalBaru: selectedOrder.sisaTagihan - amt
          }
        });
      }

      // Reset form
      setSelectedOrder(null);
      setPayAmount('');
      setPayNotes('');
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 animate-in fade-in duration-200">
      
      {/* 🚀 BANNER UTAMA - FLAT ENTERPRISE STYLE */}
      <div className="p-6 lg:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5"><DollarSign size={100} className="text-orange-500"/></div>
        <div className="relative z-10">
           <div className="flex items-center gap-2 mb-2">
             <DollarSign size={20} className="text-orange-500"/>
             <h2 className="text-lg font-black text-white tracking-wide">Manajemen Piutang &amp; Tagihan Pelanggan</h2>
           </div>
           <p className="text-[11px] font-bold text-slate-400 mt-1 max-w-md leading-relaxed">
             Kelola dan catat pembayaran cicilan atau pelunasan tagihan dari pelanggan dan agen. Pembayaran akan otomatis terintegrasi ke buku kas pusat.
           </p>
        </div>

        <div className="flex bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-inner text-right min-w-[220px] shrink-0 w-full md:w-auto relative z-10 backdrop-blur-sm">
           <div className="flex-1">
             <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1.5">Total Piutang Berjalan (Global)</div>
             <div className="text-3xl font-black text-orange-400 tracking-tight">{formatRupiah(totalPiutangGlobal)}</div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* PANEL KIRI: DAFTAR PIUTANG AKTIF (7 KOLOM) */}
        <div className="lg:col-span-7 flex flex-col overflow-hidden bg-white border border-slate-200 rounded-3xl shadow-sm h-[75vh]">
          <div className="p-5 border-b border-slate-100 bg-slate-50 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
             <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
               <History size={18} className="text-orange-600"/> Daftar Piutang Berjalan
             </h4>
             <div className="relative w-full sm:w-64">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
               <input type="text" placeholder="Cari nota atau nama agen..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none bg-white focus:border-orange-400 shadow-sm" />
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {filteredPiutang.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
                <CheckCircle2 size={48} className="mb-4 opacity-20 text-emerald-500" />
                <span className="text-sm font-black text-center">Bebas Hutang!<br/>Tidak ada tagihan pelanggan yang menunggak.</span>
              </div>
            ) : (
              <div className="space-y-3 p-2">
                {filteredPiutang.map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => { setSelectedOrder(item); setPayAmount(item.sisaTagihan.toString()); }}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all hover:shadow-md ${selectedOrder?.id === item.id ? 'bg-orange-50 border-orange-300 shadow-sm' : 'bg-white border-slate-200 hover:border-orange-200'}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-[10px] font-mono font-bold text-slate-400 mb-1">{item.id} • {formatDate(item.date)}</div>
                        <div className="font-black text-slate-800 text-sm uppercase tracking-wider">{item.customer_name || item.customer}</div>
                        <div className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">Asal Nota: {item.branch_id.replace(/_/g, ' ')}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Sisa Tagihan</div>
                        <div className="font-black text-red-600 text-xl tracking-tight">{formatRupiah(item.sisaTagihan)}</div>
                      </div>
                    </div>
                    
                    {/* Progress Bar Sederhana */}
                    <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden shadow-inner">
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${(item.totalBayar / item.totalTagihan) * 100}%` }}></div>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                      <span>Total Tagihan: {formatRupiah(item.totalTagihan)}</span>
                      <span className="text-emerald-600">Terbayar: {formatRupiah(item.totalBayar)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PANEL KANAN: FORM PEMBAYARAN (5 KOLOM) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm border-t-4 border-t-emerald-500 flex flex-col overflow-hidden">
            <h3 className="font-black text-slate-800 text-sm p-5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <CreditCard size={18} className="text-emerald-600"/> Form Pembayaran Piutang
            </h3>

            {!selectedOrder ? (
              <div className="text-center py-16 text-slate-400 bg-white">
                <div className="flex justify-center mb-3"><AlertOctagon size={40} className="opacity-20"/></div>
                <div className="text-xs font-bold px-6 leading-relaxed">Klik salah satu nota di daftar sebelah kiri<br/>untuk memproses pembayaran masuk.</div>
              </div>
            ) : (
              <form onSubmit={handleBayar} className="p-5 space-y-5">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-inner">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Membayar Nota:</div>
                  <div className="font-black text-slate-800 text-sm uppercase">{selectedOrder.id} - {selectedOrder.customer_name || selectedOrder.customer}</div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200">
                    <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Sisa Tagihan Utang</span>
                    <span className="font-black text-red-600 text-lg tracking-tight">{formatRupiah(selectedOrder.sisaTagihan)}</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Nominal Pembayaran Diterima (Rp)</label>
                  <input type="text" required value={payAmount ? Number(payAmount).toLocaleString('id-ID') : ''} onChange={e=>setPayAmount(e.target.value.replace(/\D/g, ''))} className="w-full p-4 border-2 border-emerald-200 rounded-2xl text-2xl font-black text-emerald-700 text-center bg-emerald-50/50 outline-none focus:bg-white focus:border-emerald-500 transition-colors shadow-inner" placeholder="0" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Metode Bayar (Uang Masuk)</label>
                    <select required value={payMethod} onChange={e=>setPayMethod(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer bg-slate-50 focus:bg-white focus:border-emerald-400 transition-colors shadow-sm">
                      <option value="CASH">Kas Tunai (Laci)</option>
                      <option value="TF_BCA_PUSAT">Transfer BCA Pusat</option>
                      <option value="TF_BRI_PUSAT">Transfer BRI Pusat</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Catatan Tambahan</label>
                    <input type="text" value={payNotes} onChange={e=>setPayNotes(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold outline-none bg-slate-50 focus:bg-white focus:border-emerald-400 transition-colors shadow-sm" placeholder="Cth: Titip supir..." />
                  </div>
                </div>

                <div className="pt-2">
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl text-xs font-black shadow-md flex justify-center items-center gap-2 transition-transform active:scale-95 cursor-pointer uppercase tracking-wider">
                    <CheckCircle2 size={16}/> Sahkan Pembayaran &amp; Cetak
                  </button>
                  <button type="button" onClick={() => setSelectedOrder(null)} className="w-full bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 py-3 mt-3 rounded-xl text-[11px] font-black shadow-sm transition-colors cursor-pointer uppercase tracking-wider">
                    Batal / Pilih Nota Lain
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* HISTORI CICILAN NOTA TERPILIH */}
          {selectedOrder && selectedOrder.cicilan.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden">
              <h4 className="font-black text-slate-800 text-xs p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                <FileText size={14} className="text-blue-500"/> Riwayat Cicilan Nota Ini
              </h4>
              <div className="p-4 space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar">
                {selectedOrder.cicilan.map(c => (
                  <div key={c.id} className="flex justify-between items-center bg-slate-50 p-3.5 rounded-xl border border-slate-100 shadow-sm">
                    <div>
                      <div className="text-[10px] font-bold text-slate-600">{formatDate(c.date)}</div>
                      <div className="text-[9px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded mt-1.5 uppercase inline-block">{c.paymentMethod.replace(/_/g, ' ')}</div>
                    </div>
                    <div className="font-black text-emerald-600 text-sm">+{formatRupiah(c.amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
