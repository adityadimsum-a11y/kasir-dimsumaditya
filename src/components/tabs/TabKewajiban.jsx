import React, { useState, useMemo } from 'react';
import { 
  Target, Plus, CheckCircle2, AlertCircle, X, 
  Wallet, CalendarClock, ChevronRight, Activity, DollarSign
} from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabKewajiban({ 
  master_kewajiban = [], 
  trx_pembayaran_kewajiban = [], 
  sendToSheet, 
  showToast, 
  user 
}) {
  // --- STATE MANAGEMENT ---
  const [activeView, setActiveView] = useState('AKTIF'); // AKTIF | LUNAS
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State Form Kewajiban Baru
  const [form, setForm] = useState({
    nama_kewajiban: '',
    total_pinjaman: '',
    cicilan_per_bulan: '',
    tanggal_mulai: getTodayStr(),
    tenor_bulan: '',
    kategori: 'BANK',
    keterangan: ''
  });

  // State Form Pembayaran
  const [paymentForm, setPaymentForm] = useState({
    kewajiban_id: '',
    tanggal_bayar: getTodayStr(),
    nominal_bayar: '',
    metode_bayar: 'TF_BCA_PUSAT',
    keterangan: ''
  });

  // --- DATA ENGINE ---
  const dataKewajiban = useMemo(() => {
    // 1. Ambil semua master data kewajiban yang belum dihapus
    let list = (master_kewajiban || []).filter(k => !k.isDeleted);
    
    // 2. Gabungkan dengan data pembayarannya
    return list.map(kewajiban => {
      const historyBayar = (trx_pembayaran_kewajiban || []).filter(
        trx => trx.kewajiban_id === kewajiban.id && !trx.isDeleted
      );
      
      const totalTelahDibayar = historyBayar.reduce((sum, t) => sum + Number(t.nominal_bayar || 0), 0);
      const sisaHutang = Number(kewajiban.total_pinjaman || 0) - totalTelahDibayar;
      const progress = (totalTelahDibayar / Number(kewajiban.total_pinjaman || 1)) * 100;
      
      return {
        ...kewajiban,
        totalTelahDibayar,
        sisaHutang,
        progress: progress > 100 ? 100 : progress,
        historyBayar,
        status: sisaHutang <= 0 ? 'LUNAS' : 'AKTIF'
      };
    });
  }, [master_kewajiban, trx_pembayaran_kewajiban]);

  // Filter berdasarkan tab aktif
  const filteredData = dataKewajiban.filter(d => d.status === activeView);

  // Kalkulasi Header Dashboard
  const summary = useMemo(() => {
    let targetBulanIni = 0;
    let sisaKewajibanAktif = 0;
    let kapasitasDibebaskan = 0; // Uang yang hemat per bulan jika lunas

    dataKewajiban.forEach(d => {
      if (d.status === 'AKTIF') {
        targetBulanIni += Number(d.cicilan_per_bulan || 0);
        sisaKewajibanAktif += d.sisaHutang;
      } else {
        kapasitasDibebaskan += Number(d.cicilan_per_bulan || 0);
      }
    });

    return { targetBulanIni, sisaKewajibanAktif, kapasitasDibebaskan };
  }, [dataKewajiban]);


  // --- HANDLER TAMBAH KEWAJIBAN ---
  const handleSimpanKewajiban = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const payload = {
      id: generateId('KWJ', form.tanggal_mulai),
      nama_kewajiban: form.nama_kewajiban.toUpperCase(),
      total_pinjaman: Number(form.total_pinjaman),
      cicilan_per_bulan: Number(form.cicilan_per_bulan),
      tanggal_mulai: form.tanggal_mulai,
      tenor_bulan: Number(form.tenor_bulan),
      kategori: form.kategori,
      keterangan: form.keterangan,
      isDeleted: false
    };

    const isSuccess = await sendToSheet('insert', payload, 'master_kewajiban');
    if (isSuccess) {
      setShowModal(false); // Tutup pop-up
      setForm({
        nama_kewajiban: '', total_pinjaman: '', cicilan_per_bulan: '',
        tanggal_mulai: getTodayStr(), tenor_bulan: '', kategori: 'BANK', keterangan: ''
      });
    }
    setIsSubmitting(false);
  };


  // --- HANDLER BAYAR CICILAN ---
  const handleBukaModalBayar = (kewajiban) => {
    setPaymentForm({
      kewajiban_id: kewajiban.id,
      tanggal_bayar: getTodayStr(),
      nominal_bayar: kewajiban.cicilan_per_bulan, // Default lsg diisi angka cicilannya
      metode_bayar: 'TF_BCA_PUSAT',
      keterangan: `Cicilan ${kewajiban.nama_kewajiban}`
    });
    setShowPaymentModal(true);
  };

  const handleSimpanPembayaran = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const activeKewajiban = dataKewajiban.find(k => k.id === paymentForm.kewajiban_id);
    
    // 1. Simpan di trx_pembayaran_kewajiban
    const payloadTrx = {
      id: generateId('TRXKWJ', paymentForm.tanggal_bayar),
      kewajiban_id: paymentForm.kewajiban_id,
      tanggal_bayar: paymentForm.tanggal_bayar,
      nominal_bayar: Number(paymentForm.nominal_bayar),
      metode_bayar: paymentForm.metode_bayar,
      keterangan: paymentForm.keterangan,
      isDeleted: false
    };

    // 2. Tembak juga ke arus kas pabrik agar memotong saldo real
    const payloadCashflow = {
      id: generateId('CASHKWJ', paymentForm.tanggal_bayar),
      date: paymentForm.tanggal_bayar,
      branch_id: user?.branch_id || 'PUSAT',
      type: 'OUT',
      category: 'PEMBAYARAN_KEWAJIBAN',
      method: paymentForm.metode_bayar,
      amount: Number(paymentForm.nominal_bayar),
      description: `BAYAR CICILAN: ${activeKewajiban?.nama_kewajiban || ''} - ${paymentForm.keterangan}`,
      reference_id: paymentForm.kewajiban_id,
      isDeleted: false
    };

    // Eksekusi Paralel
    try {
      await sendToSheet('insert', payloadTrx, 'trx_pembayaran_kewajiban');
      await sendToSheet('insert', payloadCashflow, 'cashflow_transactions');
      
      showToast('Pembayaran berhasil! Kas pabrik otomatis terpotong.', 'success');
      setShowPaymentModal(false);
    } catch (err) {
      showToast('Gagal memproses pembayaran.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="space-y-6 pb-10 text-slate-700 animate-in fade-in duration-300">
      
      {/* 🌟 HERO BANNER: PUSAT KOMANDO */}
      <div className="bg-slate-900 rounded-3xl p-6 lg:p-8 relative overflow-hidden shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between gap-6">
        <div className="absolute -right-10 -top-10 opacity-10 pointer-events-none">
          <Target size={250} className="text-blue-500" />
        </div>
        
        <div className="relative z-10 w-full md:w-1/2">
          <h2 className="text-xl font-black text-white flex items-center gap-3 tracking-wide uppercase mb-6">
            <Activity className="text-blue-500" /> Pusat Komando Kewajiban
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Bulan Ini</div>
              <div className="text-2xl font-black text-white">{formatRupiah(summary.targetBulanIni)}</div>
            </div>
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Sisa Hutang</div>
              <div className="text-2xl font-black text-blue-400">{formatRupiah(summary.sisaKewajibanAktif)}</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 w-full md:w-1/3 flex flex-col gap-3">
          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 backdrop-blur-sm">
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-2">
              <CheckCircle2 size={14}/> Kapasitas Dibebaskan (Lunas)
            </div>
            <div className="text-xl font-black text-white">{formatRupiah(summary.kapasitasDibebaskan)} <span className="text-xs text-slate-400 font-bold">/ bln</span></div>
          </div>
        </div>
      </div>

      {/* 🗂️ NAVIGASI TABS & TOMBOL TAMBAH */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex bg-white rounded-full p-1.5 shadow-sm border border-slate-200">
          <button 
            onClick={() => setActiveView('AKTIF')}
            className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${activeView === 'AKTIF' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Kewajiban Aktif
          </button>
          <button 
            onClick={() => setActiveView('LUNAS')}
            className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${activeView === 'LUNAS' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Arsip Lunas
          </button>
        </div>

        {/* 🚨 INI TOMBOL TAMBAH BARU YANG BOS MAKSUD 🚨 */}
        <button 
          onClick={() => setShowModal(true)} 
          className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-md shadow-blue-600/20 transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus size={16} strokeWidth={3} /> Tambah Baru
        </button>
      </div>

      {/* 📊 TABEL DAFTAR KEWAJIBAN */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden flex flex-col">
        <div className="p-5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2 shrink-0">
          <Wallet size={18} className="text-blue-600"/>
          <h4 className="font-black text-xs text-slate-800 uppercase tracking-wider">
            {activeView === 'AKTIF' ? 'Daftar Komitmen & Kewajiban Berjalan' : 'Riwayat Kewajiban Lunas'}
          </h4>
        </div>

        <div className="overflow-x-auto custom-scrollbar p-2">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-[10px] font-black text-slate-500 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-4">Nama Kewajiban</th>
                <th className="px-5 py-4">Sisa Hutang Pokok</th>
                <th className="px-5 py-4">Beban Per Bulan</th>
                <th className="px-5 py-4">Progress Lunas</th>
                <th className="px-5 py-4 text-center">Aksi Hub</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700 bg-white">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-16 text-slate-400 font-bold text-xs normal-case">
                    Tidak ada data kewajiban {activeView.toLowerCase()}.
                  </td>
                </tr>
              ) : (
                filteredData.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-black text-slate-800 text-sm">{item.nama_kewajiban}</div>
                      <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider flex items-center gap-1">
                        <CalendarClock size={12}/> Mulai: {formatDate(item.tanggal_mulai)}
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-black text-slate-800">{formatRupiah(item.sisaHutang)}</div>
                      <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Dari {formatRupiah(item.total_pinjaman)}</div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-md inline-block">
                        {formatRupiah(item.cicilan_per_bulan)}
                      </div>
                    </td>
                    <td className="px-5 py-4 min-w-[200px]">
                      <div className="flex items-center justify-between text-[10px] font-black mb-1.5">
                        <span className="text-slate-500">{item.progress.toFixed(1)}%</span>
                        <span className="text-slate-400 uppercase">Tenor: {item.tenor_bulan} Bln</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className={`h-2 rounded-full ${item.progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${item.progress}%` }}></div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      {item.status === 'AKTIF' ? (
                        <button 
                          onClick={() => handleBukaModalBayar(item)}
                          className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm transition-colors cursor-pointer"
                        >
                          Bayar Cicilan
                        </button>
                      ) : (
                        <span className="px-4 py-2 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center justify-center gap-1">
                          <CheckCircle2 size={14}/> Lunas
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================= */}
      {/* 🟥 MODAL TAMBAH KEWAJIBAN BARU (POP-UP) 🟥 */}
      {/* ========================================= */}
      {showModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 flex justify-between items-center text-white">
              <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                <Target size={18} className="text-blue-400"/> Tambah Kewajiban / Cicilan
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSimpanKewajiban} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Nama Tagihan / Kewajiban</label>
                <input type="text" required value={form.nama_kewajiban} onChange={e => setForm({...form, nama_kewajiban: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 uppercase" placeholder="Cth: KUR BRI / Mobil Operasional" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Total Pinjaman / Pokok (Rp)</label>
                  <input type="number" required value={form.total_pinjaman} onChange={e => setForm({...form, total_pinjaman: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500" placeholder="Cth: 100000000" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Cicilan Per Bulan (Rp)</label>
                  <input type="number" required value={form.cicilan_per_bulan} onChange={e => setForm({...form, cicilan_per_bulan: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500" placeholder="Cth: 2500000" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Tanggal Mulai</label>
                  <input type="date" required value={form.tanggal_mulai} onChange={e => setForm({...form, tanggal_mulai: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Tenor (Bulan)</label>
                  <input type="number" required value={form.tenor_bulan} onChange={e => setForm({...form, tenor_bulan: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500" placeholder="Cth: 36" />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 rounded-xl text-slate-500 font-black text-xs uppercase tracking-wider hover:bg-slate-100 cursor-pointer">Batal</button>
                <button type="submit" disabled={isSubmitting} className="px-8 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider shadow-md disabled:opacity-50 cursor-pointer">
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ========================================= */}
      {/* 💸 MODAL BAYAR CICILAN (POP-UP) 💸 */}
      {/* ========================================= */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                <DollarSign size={18} className="text-slate-500"/> Eksekusi Cicilan
              </h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSimpanPembayaran} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Tanggal Bayar</label>
                <input type="date" required value={paymentForm.tanggal_bayar} onChange={e => setPaymentForm({...paymentForm, tanggal_bayar: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-slate-500" />
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Nominal Disetor (Rp)</label>
                <input type="number" required value={paymentForm.nominal_bayar} onChange={e => setPaymentForm({...paymentForm, nominal_bayar: e.target.value})} className="w-full p-3 bg-blue-50 border border-blue-200 rounded-xl text-lg font-black text-blue-700 outline-none focus:bg-white focus:border-blue-500" placeholder="Otomatis" />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Potong Saldo Dari</label>
                <select value={paymentForm.metode_bayar} onChange={e => setPaymentForm({...paymentForm, metode_bayar: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase outline-none focus:bg-white focus:border-slate-500">
                  <option value="TF_BCA_PUSAT">Rekening BCA Pusat</option>
                  <option value="TF_BRI_PUSAT">Rekening BRI Pusat</option>
                  <option value="CASH">Uang Tunai Brankas</option>
                </select>
                <div className="text-[9px] font-bold text-amber-600 mt-2 flex items-start gap-1">
                  <AlertCircle size={12} className="shrink-0 mt-0.5"/> Kas pabrik akan langsung dipotong sesuai wadah rekening di atas.
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={isSubmitting} className="w-full py-3 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest shadow-md disabled:opacity-50 cursor-pointer">
                  {isSubmitting ? 'Memproses Jurnal...' : 'Bayar & Potong Kas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
