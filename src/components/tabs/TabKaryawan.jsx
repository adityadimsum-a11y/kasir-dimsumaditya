import React, { useState, useMemo } from 'react';
import { Users, DollarSign, Wallet, FileText, Printer, Calendar, CheckCircle2, Building2, Search, ArrowRightLeft } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabKaryawan({ 
  karyawan = [], karyawan_data,
  orders = [], orders_data,
  user, sendToSheet, showToast, requestDelete 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';

  // --- STATE MANAGEMENT ---
  const [tableDateFilter, setTableDateFilter] = useState(todayStr.substring(0, 7)); // Default nampilin Bulan Ini (YYYY-MM)
  const [searchTerm, setSearchTerm] = useState('');
  
  const [form, setForm] = useState({
    date: todayStr, employeeName: '', role: 'PRODUKSI', 
    baseSalary: '', bonus: '', deductions: '', paymentMethod: 'TF', notes: ''
  });

  // --- SINKRONISASI DATABASE ---
  const realKaryawan = useMemo(() => karyawan_data || karyawan || [], [karyawan, karyawan_data]);
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);

  // --- ENGINE KALKULASI BUDGET (AMPLOP 2 - 20% OMZET) ---
  const budgetMetrics = useMemo(() => {
    let omzet2Minggu = 0;
    const batas = new Date(); batas.setDate(batas.getDate() - 14);
    
    realOrders.filter(o => !o.isDeleted && new Date(o.date) >= batas).forEach(o => {
      // Ambil omzet nasional jika HQ, atau omzet cabang jika login cabang
      if (isHQ || o.branch_id === currentBranch) {
        omzet2Minggu += Number(o.amount_paid || o.total_amount || 0);
      }
    });

    const budgetAmplop2 = omzet2Minggu * 0.20; // 20% Jatah Ops & Gaji
    
    // Hitung total gaji yang SUDAH DIBAYAR bulan ini
    let paidThisMonth = 0;
    realKaryawan.filter(k => !k.isDeleted && k.date.substring(0, 7) === todayStr.substring(0, 7)).forEach(k => {
      if (isHQ || k.branch_id === currentBranch) {
        paidThisMonth += Number(k.net_salary || 0);
      }
    });

    return { 
      budget: budgetAmplop2, 
      paid: paidThisMonth, 
      remaining: budgetAmplop2 - paidThisMonth,
      status: (budgetAmplop2 - paidThisMonth) >= 0 ? 'AMAN' : 'OVERBUDGET'
    };
  }, [realOrders, realKaryawan, isHQ, currentBranch, todayStr]);

  // --- REALTIME NET SALARY CALCULATION ---
  const netSalary = useMemo(() => {
    const base = Number(form.baseSalary || 0);
    const plus = Number(form.bonus || 0);
    const min = Number(form.deductions || 0);
    return base + plus - min;
  }, [form]);

  // --- FILTER TABEL JURNAL GAJI ---
  const filteredPayroll = useMemo(() => {
    return realKaryawan.filter(k => {
      if (k.isDeleted) return false;
      if (!isHQ && k.branch_id !== currentBranch) return false;
      if (k.date.substring(0, 7) !== tableDateFilter) return false; // Filter per bulan
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!k.employee_name.toLowerCase().includes(s) && !k.id.toLowerCase().includes(s)) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realKaryawan, isHQ, currentBranch, tableDateFilter, searchTerm]);

  // --- ACTIONS: PROSES PEMBAYARAN GAJI ---
  const handlePaySalary = async (e) => {
    e.preventDefault();
    if (netSalary <= 0) return alert("Total Gaji Bersih tidak boleh 0 atau minus!");

    const payrollId = generateId('PAY', form.date);
    
    // 1. Payload untuk Buku Riwayat Gaji Karyawan
    const payrollPayload = {
      id: payrollId, date: form.date, branch_id: currentBranch,
      employee_name: form.employeeName.toUpperCase(), role: form.role,
      base_salary: Number(form.baseSalary), bonus: Number(form.bonus),
      deductions: Number(form.deductions), net_salary: netSalary,
      payment_method: form.paymentMethod, notes: form.notes, status: 'PAID'
    };

    // Eksekusi API
    if (await sendToSheet('insert', payrollPayload, 'karyawan')) {
      
      // 2. OTOMATISASI ERP: Buat Catatan Uang Keluar (OUT) ke Dompet Perusahaan
      const cashOutPayload = {
        id: `CSH-${payrollId}`, date: form.date, branch_id: currentBranch, type: 'OUT',
        category: 'GAJI KARYAWAN', description: `Gaji: ${form.employeeName.toUpperCase()} (${form.role})`,
        amount: netSalary, method: form.paymentMethod
      };
      await sendToSheet('insert', cashOutPayload, 'cashflow_transactions');

      showToast(`Gaji ${form.employeeName} berhasil dibayarkan & Saldo Kas otomatis dipotong!`, 'success');
      if (window.confirm("Cetak Slip Gaji Karyawan?")) handlePrintSlip(payrollPayload);
      
      // Reset Form
      setForm({ date: todayStr, employeeName: '', role: 'PRODUKSI', baseSalary: '', bonus: '', deductions: '', paymentMethod: 'TF', notes: '' });
    }
  };

  const handlePrintSlip = (log) => {
    triggerPrint('NOTA_DOTMATRIX', {
      title: 'SLIP GAJI KARYAWAN (CONFIDENTIAL)', id: log.id, date: formatDate(log.date),
      branch_name: log.branch_id, admin_name: user?.name || 'FINANCE', customer_name: `${log.employee_name} (${log.role})`,
      items: [
        { name: 'Gaji Pokok Utama', qty: 1, subtotal: log.base_salary },
        { name: 'Bonus / Lembur / Makan', qty: 1, subtotal: log.bonus },
        { name: 'Potongan / Kasbon', qty: 1, subtotal: -(log.deductions) }
      ],
      amount: log.net_salary, paymentMethod: log.payment_method
    });
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800">
      
      {/* HEADER BANNER */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
            <Users className="text-emerald-400"/> Smart Payroll &amp; Gaji
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
            Distribusi gaji otomatis terhubung ke sistem Dompet Perusahaan.
          </p>
        </div>
        <div className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
          <Building2 size={14} className="text-blue-400"/> Node: {isHQ ? 'HQ KENDALI PUSAT' : currentBranch.replace('_', ' ')}
        </div>
      </div>

      {/* KPI METRIK ANGGARAN AMPLOP 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><Wallet size={12}/> Plafon Anggaran Gaji (Amplop 2)</div>
          <div className="text-3xl font-black text-slate-800 tracking-tight">{formatRupiah(budgetMetrics.budget)}</div>
          <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-wide">*Alokasi 20% dari omzet 14 Hari terakhir.</p>
        </div>

        <div className="bg-blue-50/80 p-6 rounded-3xl border border-blue-200 shadow-sm relative overflow-hidden">
          <DollarSign className="absolute -right-4 -bottom-4 text-blue-500/10" size={120} />
          <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5 mb-1"><CheckCircle2 size={12}/> Total Gaji Cair (Bulan Ini)</div>
          <div className="text-3xl font-black text-blue-700 tracking-tight">{formatRupiah(budgetMetrics.paid)}</div>
          <p className="text-[9px] text-blue-600/60 font-bold mt-2 uppercase tracking-wide">*Akumulasi pembayaran yang sudah sukses.</p>
        </div>

        <div className={`p-6 rounded-3xl border shadow-sm relative overflow-hidden transition-colors ${budgetMetrics.status === 'AMAN' ? 'bg-emerald-50/80 border-emerald-200' : 'bg-rose-50/80 border-rose-200'}`}>
          <div className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-1 ${budgetMetrics.status === 'AMAN' ? 'text-emerald-600' : 'text-rose-600'}`}>
            <ArrowRightLeft size={12}/> Sisa Nafas Anggaran Gaji
          </div>
          <div className={`text-3xl font-black tracking-tight ${budgetMetrics.status === 'AMAN' ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatRupiah(budgetMetrics.remaining)}
          </div>
          <div className="mt-3">
            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md border tracking-wider ${budgetMetrics.status === 'AMAN' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse'}`}>
              STATUS: {budgetMetrics.status === 'AMAN' ? 'TERKENDALI' : 'DEFISIT (BAHAYA)'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* KIRI: FORM INPUT PEMBAYARAN GAJI */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-max">
          <form onSubmit={handlePaySalary} className="space-y-4">
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
              <FileText size={16} className="text-emerald-500"/> Proses Pembayaran Gaji
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nama Lengkap Karyawan</label>
                <input type="text" required value={form.employeeName} onChange={e=>setForm({...form, employeeName: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-black uppercase bg-slate-50 outline-none focus:bg-white focus:border-emerald-500" placeholder="Ketik nama karyawan..." />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tanggal Cair</label>
                <input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-black bg-slate-50 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Posisi / Jabatan</label>
                <select value={form.role} onChange={e=>setForm({...form, role: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-black bg-slate-50 outline-none uppercase cursor-pointer">
                  <option value="PRODUKSI">Tim Produksi / Dapur</option>
                  <option value="KASIR_OUTLET">Kasir / Frontliner</option>
                  <option value="SUPIR_KURIR">Supir / Kurir Logistik</option>
                  <option value="ADMIN_HQ">Admin Pusat</option>
                </select>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">1. Gaji Pokok (Base)</label>
                <input type="number" required value={form.baseSalary} onChange={e=>setForm({...form, baseSalary: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm font-black bg-white outline-none focus:border-emerald-500" placeholder="Rp 0" />
              </div>
              <div>
                <label className="text-[10px] font-black text-blue-500 uppercase block mb-1">2. (+) Uang Makan / Lembur / Bonus</label>
                <input type="number" value={form.bonus} onChange={e=>setForm({...form, bonus: e.target.value})} className="w-full p-2 border border-blue-200 rounded-lg text-sm font-black text-blue-700 bg-white outline-none" placeholder="Rp 0" />
              </div>
              <div>
                <label className="text-[10px] font-black text-rose-500 uppercase block mb-1">3. (-) Potongan Absen / Kasbon</label>
                <input type="number" value={form.deductions} onChange={e=>setForm({...form, deductions: e.target.value})} className="w-full p-2 border border-rose-200 rounded-lg text-sm font-black text-rose-700 bg-white outline-none" placeholder="Rp 0" />
              </div>
            </div>

            <div className="bg-slate-900 text-white p-4 rounded-xl shadow-inner border border-slate-800">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Gaji Diterima (Take Home Pay)</span>
                <span className="text-2xl font-black text-emerald-400">{formatRupiah(netSalary)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Metode Cair</label>
                <select value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-black bg-slate-50 outline-none uppercase cursor-pointer">
                  <option value="TF">Transfer Bank</option>
                  <option value="CASH">Tunai (Amplop)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Bulan Periode</label>
                <input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold uppercase bg-slate-50 outline-none" placeholder="Cth: GAJI JUNI 2026" />
              </div>
            </div>

            <button type="submit" className="w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-md bg-emerald-600 hover:bg-emerald-700 transition-transform active:scale-95 flex items-center justify-center gap-2">
              <DollarSign size={14}/> Bayar Gaji &amp; Potong Kas Utama
            </button>
          </form>
        </div>

        {/* KANAN: JURNAL SLIP GAJI */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h4 className="font-black text-xs uppercase text-slate-700 tracking-widest flex items-center gap-1.5">
                <Printer size={14} className="text-blue-500"/> Riwayat &amp; Cetak Slip Gaji
              </h4>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input type="text" placeholder="Cari nama..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-32 pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none bg-white focus:border-emerald-400 shadow-sm" />
              </div>
              <div className="flex items-center gap-2 bg-white border px-2.5 py-1.5 rounded-xl shadow-sm">
                <Calendar size={12} className="text-slate-400"/>
                <input type="month" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value || todayStr.substring(0, 7))} className="text-xs font-black outline-none bg-transparent cursor-pointer text-slate-700" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] uppercase text-slate-400 bg-white border-b">
                <tr>
                  <th className="px-4 py-3 font-black">Identitas Pekerja</th>
                  <th className="px-4 py-3 font-black">Rincian Komponen</th>
                  <th className="px-4 py-3 font-black text-right">Take Home Pay</th>
                  <th className="px-4 py-3 font-black text-center">Status</th>
                  <th className="px-4 py-3 font-black text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-50">
                {filteredPayroll.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest">Belum ada pembayaran gaji di bulan {tableDateFilter}</td></tr>
                ) : (
                  filteredPayroll.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-black uppercase text-sm mb-1">{log.employee_name}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 border bg-white px-2 py-0.5 rounded shadow-sm">{log.role.replace('_', ' ')}</span>
                          <span className="text-[9px] text-slate-400 font-bold">{formatDate(log.date)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 min-w-[180px]">
                        <div className="space-y-1 text-[9px] font-black uppercase">
                          <div className="flex justify-between text-slate-600"><span>Pokok:</span> <span>{formatRupiah(log.base_salary)}</span></div>
                          {Number(log.bonus) > 0 && <div className="flex justify-between text-blue-600"><span>Bonus/Makan:</span> <span>+{formatRupiah(log.bonus)}</span></div>}
                          {Number(log.deductions) > 0 && <div className="flex justify-between text-rose-600"><span>Potongan:</span> <span>-{formatRupiah(log.deductions)}</span></div>}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <div className="font-black text-emerald-600 text-base">{formatRupiah(log.net_salary)}</div>
                        <div className="text-[9px] text-slate-400 font-bold mt-1 uppercase">VIA: {log.payment_method}</div>
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md flex items-center justify-center w-max mx-auto border border-emerald-200 gap-1">
                          <CheckCircle2 size={10}/> TERBAYAR
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap opacity-40 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => handlePrintSlip(log)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex flex-col items-center gap-1 mx-auto" title="Cetak Slip">
                          <Printer size={16}/>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
