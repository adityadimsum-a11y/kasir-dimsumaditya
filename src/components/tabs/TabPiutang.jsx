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
        totalTagihan: Number(o.total || 0),
        totalBayar: Number(o.paidAmount || 0),
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
      .filter(o => o.sisaTagihan > 0 && (o.paymentMethod === 'PIUTANG' || o.statusProduksi === 'Sudah Diambil' || o.paymentMethod === 'TEMPO'))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [orders, piutangPayments, isHQ, currentBranch]);

  const filteredPiutang = useMemo(() => {
    if (!searchTerm) return piutangData;
    const lower = searchTerm.toLowerCase();
    return piutangData.filter(p => (p.customer || '').toLowerCase().includes(lower) || p.id.toLowerCase().includes(lower));
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

    const confirmMsg = `Konfirmasi Pembayaran Piutang:\n\n` +
      `Pelanggan: ${selectedOrder.customer}\n` +
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
      description: `Pelunasan Piutang Nota ${selectedOrder.id} - ${selectedOrder.customer}`,
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
          title: 'TANDA TERIMA PEMBAYARAN',
          id: payId,
          date: formatDate(todayStr),
          branch_name: selectedOrder.branch_id.replace(/_/g, ' '),
          admin_name: user?.name || 'Admin',
          customer_name: selectedOrder.customer,
          items: [{ name: `Pembayaran Piutang Nota:\n${selectedOrder.id}`, qty: 1, subtotal: amt }],
          amount: amt,
          paymentMethod: payMethod.replace(/_/g, ' '),
          history: {
            labelLama: 'Sisa Tagihan Awal', nominalLama: selectedOrder.sisaTagihan,
            labelAksi: 'Dibayar', nominalAksi: amt,
            labelBaru: 'Sisa Tagihan Baru', nominalBaru: selectedOrder.sisaTagihan - amt
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
    <div className="space-y-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-200">
      
      {/* 🚀 BANNER UTAMA - FLAT ENTERPRISE STYLE */}
      <div className="card-holo p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
        <div>
           <div className="flex items-center gap-2 mb-1">
             <DollarSign size={18} className="text-orange-600"/>
             <h2 className="text-sm font-black normal-case text-slate-800">Manajemen Piutang &amp; Tagihan Pelanggan</h2>
           </div>
           <p className="text-[10px] font-bold text-slate-400 normal-case mt-0.5">
             Kelola dan catat pembayaran cicilan atau pelunasan tagihan dari pelanggan dan agen.
           </p>
        </div>

        <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-inner text-right min-w-[200px] shrink-0 w-full md:w-auto">
           <div className="flex-1">
             <div className="text-[9px] font-bold text-orange-600 normal-case mb-0.5">Total Piutang Berjalan (Global)</div>
             <div className="text-xl font-black text-orange-700 tracking-tight">{formatRupiah(totalPiutangGlobal)}</div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* PANEL KIRI: DAFTAR PIUTANG AKTIF (7 KOLOM) */}
        <div className="lg:col-span-7 card-holo flex flex-col overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-2xs h-[75vh]">
          <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
             <h4 className="font-black text-slate-800 normal-case text-xs flex items-center gap-2">
               <History size={16} className="text-orange-600"/> Daftar Piutang Berjalan
             </h4>
             <div className="relative w-full sm:w-56">
               <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
               <input type="text" placeholder="Cari nota atau nama..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold outline-none bg-white focus:border-orange-400 shadow-3xs normal-case" />
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
            {filteredPiutang.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
                <CheckCircle2 size={40} className="mb-3 opacity-20 text-emerald-500" />
                <span className="text-xs font-bold text-center">Bebas Hutang! Tidak ada tagihan pelanggan yang menunggak.</span>
              </div>
            ) : (
              <div className="space-y-2 p-2">
                {filteredPiutang.map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => { setSelectedOrder(item); setPayAmount(item.sisaTagihan.toString()); }}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedOrder?.id === item.id ? 'bg-orange-50 border-orange-300 shadow-sm' : 'bg-white border-slate-200 hover:border-orange-200 shadow-3xs hover:shadow-sm'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-[9px] font-mono text-slate-400 mb-0.5">{item.id} • {formatDate(item.date)}</div>
                        <div className="font-black text-slate-800 text-sm normal-case">{item.customer}</div>
                        <div className="text-[10px] font-bold text-slate-500 normal-case mt-0.5">Asal Nota: {item.branch_id.replace(/_/g, ' ')}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-bold text-slate-500 normal-case mb-0.5">Sisa Tagihan</div>
                        <div className="font-black text-red-600 text-base tracking-tight">{formatRupiah(item.sisaTagihan)}</div>
                      </div>
                    </div>
                    
                    {/* Progress Bar Sederhana */}
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${(item.totalBayar / item.totalTagihan) * 100}%` }}></div>
                    </div>
                    <div className="flex justify-between text-[9px] font-bold text-slate-500 normal-case">
                      <span>Total Tagihan: {formatRupiah(item.totalTagihan)}</span>
                      <span>Terbayar: {formatRupiah(item.totalBayar)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PANEL KANAN: FORM PEMBAYARAN (5 KOLOM) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          <div className="card-holo p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs border-t-4 border-t-emerald-500">
            <h3 className="font-black text-slate-800 normal-case text-xs pb-3 border-b border-slate-100 flex items-center gap-2 mb-4">
              <CreditCard size={16} className="text-emerald-600"/> Form Pembayaran Piutang
            </h3>

            {!selectedOrder ? (
              <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <div className="flex justify-center mb-2"><AlertOctagon size={24} className="opacity-30"/></div>
                <div className="text-[10px] font-bold normal-case px-4">Klik salah satu nota di daftar sebelah kiri untuk memproses pembayaran.</div>
              </div>
            ) : (
              <form onSubmit={handleBayar} className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-inner">
                  <div className="text-[9px] font-bold text-slate-500 normal-case mb-1">Membayar Nota:</div>
                  <div className="font-black text-slate-800 text-xs">{selectedOrder.id} - {selectedOrder.customer}</div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200">
                    <span className="text-[10px] font-bold text-slate-600 normal-case">Sisa Tagihan</span>
                    <span className="font-black text-red-600">{formatRupiah(selectedOrder.sisaTagihan)}</span>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Nominal Pembayaran (Rp)</label>
                  <input type="text" required value={payAmount ? Number(payAmount).toLocaleString('id-ID') : ''} onChange={e=>setPayAmount(e.target.value.replace(/\D/g, ''))} className="w-full p-2.5 border border-emerald-300 rounded-lg text-lg font-black text-emerald-700 text-center bg-emerald-50/30 outline-none focus:bg-white focus:border-emerald-500 transition-colors shadow-3xs" placeholder="0" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Metode Bayar</label>
                    <select required value={payMethod} onChange={e=>setPayMethod(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-lg text-[10px] font-bold outline-none cursor-pointer bg-slate-50 focus:bg-white focus:border-emerald-400 transition-colors shadow-3xs">
                      <option value="CASH">Kas Tunai</option>
                      <option value="TF_BCA_PUSAT">Transfer BCA Pusat</option>
                      <option value="TF_BRI_PUSAT">Transfer BRI Pusat</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 normal-case block mb-1">Catatan Tambahan</label>
                    <input type="text" value={payNotes} onChange={e=>setPayNotes(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-lg text-[10px] font-bold normal-case outline-none bg-slate-50 focus:bg-white focus:border-emerald-400 transition-colors shadow-3xs" placeholder="Cth: Titip supir..." />
                  </div>
                </div>

                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-lg text-xs font-black shadow-md flex justify-center items-center gap-2 transition-colors cursor-pointer active:scale-95">
                  <CheckCircle2 size={14}/> Sahkan Pembayaran &amp; Cetak
                </button>
                <button type="button" onClick={() => setSelectedOrder(null)} className="w-full bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 py-2.5 rounded-lg text-[10px] font-bold shadow-3xs transition-colors cursor-pointer">
                  Batal / Pilih Nota Lain
                </button>
              </form>
            )}
          </div>

          {/* HISTORI CICILAN NOTA TERPILIH */}
          {selectedOrder && selectedOrder.cicilan.length > 0 && (
            <div className="card-holo p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
              <h4 className="font-black text-slate-800 normal-case text-[10px] mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
                <FileText size={12} className="text-blue-500"/> Riwayat Cicilan Nota Ini
              </h4>
              <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                {selectedOrder.cicilan.map(c => (
                  <div key={c.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <div className="text-[9px] font-bold text-slate-600 normal-case">{formatDate(c.date)}</div>
                      <div className="text-[8px] font-mono text-slate-400">{c.paymentMethod.replace(/_/g, ' ')}</div>
                    </div>
                    <div className="font-black text-emerald-600 text-xs">+{formatRupiah(c.amount)}</div>
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
