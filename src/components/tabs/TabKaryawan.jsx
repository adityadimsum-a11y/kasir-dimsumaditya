import React, { useState, useMemo } from 'react';
import { Users, Plus, X, Trash2, Calculator, FileText, CheckCircle } from 'lucide-react';
import { getTodayStr, formatRp, parseRp, generateId } from '../../utils/helpers';

export default function TabKaryawan({ karyawan, expenses, sendToSheet, requestDelete, setPrintData }) {
  const [showForm, setShowForm] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);

  const todayStr = getTodayStr();
  const [name, setName] = useState('');
  const [jabatan, setJabatan] = useState('Produksi');
  const [gajiPokok, setGajiPokok] = useState(0);
  const [uangMakan, setUangMakan] = useState(0);

  // State untuk Modal Hitung Gaji
  const [calcModal, setCalcModal] = useState(null); // null atau object karyawan
  const [gajiBulan, setGajiBulan] = useState(todayStr.substring(0, 7)); // format "YYYY-MM"
  const [hariKerja, setHariKerja] = useState(26);
  const [lembur, setLembur] = useState(0);
  const [bonus, setBonus] = useState(0);

  const resetForm = () => {
    setShowForm(false); setIsEdit(false); setEditId(null);
    setName(''); setJabatan('Produksi'); setGajiPokok(0); setUangMakan(0);
  };

  const handleEdit = (item) => {
    setName(item.name); setJabatan(item.jabatan); 
    setGajiPokok(item.gajiPokok); setUangMakan(item.uangMakan);
    setEditId(item.id); setIsEdit(true); setShowForm(true);
  };

  const handleSimpan = (e) => {
    e.preventDefault();
    const newData = {
        id: isEdit ? editId : generateId('EMP', todayStr),
        date: todayStr,
        name: name.toUpperCase(),
        jabatan,
        gajiPokok: Number(gajiPokok) || 0,
        uangMakan: Number(uangMakan) || 0
    };
    sendToSheet(isEdit ? 'update' : 'insert', newData, 'karyawan');
    resetForm();
  };

  // LOGIC PERHITUNGAN GAJI & KASBON
  const kasbonBulanIni = useMemo(() => {
      if (!calcModal) return 0;
      return (expenses || [])
        .filter(e => e.category === 'Kasbon Karyawan' && e.recipient === calcModal.name && String(e.date).startsWith(gajiBulan))
        .reduce((sum, e) => sum + (Number(e.total) || 0), 0);
  }, [expenses, calcModal, gajiBulan]);

  const totalUangMakan = hariKerja * (Number(calcModal?.uangMakan) || 0);
  const totalPendapatan = (Number(calcModal?.gajiPokok) || 0) + totalUangMakan + Number(lembur) + Number(bonus);
  const takeHomePay = totalPendapatan - kasbonBulanIni;

  const handleBayarGaji = () => {
      const confirmBayar = window.confirm(`Cetak Slip Gaji & Bayar Take Home Pay sebesar ${formatRp(takeHomePay)} kepada ${calcModal.name}? \n\nIni akan otomatis memotong Saldo Kas Anda.`);
      if (!confirmBayar) return;

      const newExpense = {
          id: generateId('OUT', todayStr), 
          date: todayStr,
          recipient: calcModal.name,
          category: 'Gaji Karyawan',
          description: `Gaji Bulan ${gajiBulan} (Termasuk UM, Lembur, Potong Kasbon)`,
          qty: 1,
          price: takeHomePay,
          total: takeHomePay,
          type: 'OUT',
          paymentMethod: 'Cash',
          editCount: 0
      };
      
      sendToSheet('insert', newExpense, 'expenses');
      alert("Gaji berhasil dibayarkan dan Kas berkurang otomatis!");
      setCalcModal(null);
  };

  return (
    <div className="space-y-4 animate-in fade-in relative">
      <div className="flex justify-between items-center">
        <div><h3 className="font-bold text-lg text-slate-800">Data Karyawan & Gaji</h3></div>
        <button onClick={() => { if(showForm) resetForm(); else setShowForm(true); }} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow-sm text-white ${showForm ? 'bg-slate-500' : 'bg-blue-600'}`}>{showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Batal' : 'Tambah Karyawan'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleSimpan} className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-4 mb-2 border-b border-slate-100 pb-2"><h4 className="font-bold text-blue-800 text-sm flex gap-2"><Users size={16}/> Form Data Karyawan</h4></div>
          <div className="space-y-1 lg:col-span-2"><label className="text-sm font-medium">Nama Lengkap</label><input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded-lg uppercase" /></div>
          <div className="space-y-1 lg:col-span-2"><label className="text-sm font-medium">Jabatan / Divisi</label><select value={jabatan} onChange={e => setJabatan(e.target.value)} className="w-full p-2 border rounded-lg"><option>Produksi</option><option>Admin Kasir</option><option>Driver / Kurir</option><option>Lainnya</option></select></div>
          <div className="space-y-1 lg:col-span-2"><label className="text-sm font-medium">Gaji Pokok (Bulanan)</label><input type="text" required value={formatRp(gajiPokok)} onChange={e => setGajiPokok(parseRp(e.target.value))} className="w-full p-2 border rounded-lg font-bold" /></div>
          <div className="space-y-1 lg:col-span-2"><label className="text-sm font-medium">Uang Harian / Makan (Per Hari)</label><input type="text" required value={formatRp(uangMakan)} onChange={e => setUangMakan(parseRp(e.target.value))} className="w-full p-2 border rounded-lg font-bold" /></div>
          <div className="lg:col-span-4 flex justify-end mt-2 pt-4 border-t"><button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium">Simpan Data</button></div>
        </form>
      )}

      {/* MODAL HITUNG GAJI */}
      {calcModal && (
          <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
                  <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-lg flex items-center gap-2"><Calculator size={20}/> Kalkulator Payroll: {calcModal.name}</h3>
                      <button onClick={() => setCalcModal(null)} className="p-1 hover:bg-slate-200 rounded-lg"><X size={20} /></button>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50">
                      <div className="space-y-4">
                          <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Bulan Gaji</label><input type="month" value={gajiBulan} onChange={e=>setGajiBulan(e.target.value)} className="w-full p-2 border rounded-lg bg-white" /></div>
                          <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Total Hari Kerja Hadir</label><input type="number" min="0" value={hariKerja} onChange={e=>setHariKerja(e.target.value)} className="w-full p-2 border rounded-lg bg-white font-bold text-lg" /></div>
                          <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Tambahan Lembur (Rp)</label><input type="text" value={formatRp(lembur)} onChange={e=>setLembur(parseRp(e.target.value))} className="w-full p-2 border rounded-lg bg-white text-blue-600 font-bold" /></div>
                          <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">Bonus Lainnya (Rp)</label><input type="text" value={formatRp(bonus)} onChange={e=>setBonus(parseRp(e.target.value))} className="w-full p-2 border rounded-lg bg-white text-emerald-600 font-bold" /></div>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                          <div className="space-y-2 text-sm">
                              <div className="flex justify-between"><span className="text-slate-500">Gaji Pokok</span><span className="font-bold">{formatRp(calcModal.gajiPokok)}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Uang Makan ({hariKerja} Hari)</span><span className="font-bold">{formatRp(totalUangMakan)}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Lembur & Bonus</span><span className="font-bold text-emerald-600">{formatRp(Number(lembur) + Number(bonus))}</span></div>
                              <div className="border-t border-dashed pt-2 flex justify-between font-bold"><span>Total Pendapatan</span><span>{formatRp(totalPendapatan)}</span></div>
                              
                              <div className="flex justify-between items-center mt-4 bg-red-50 p-2 rounded border border-red-100">
                                  <span className="text-red-800 text-xs font-bold uppercase">Potongan Kasbon Bulan Ini</span>
                                  <span className="font-black text-red-600">-{formatRp(kasbonBulanIni)}</span>
                              </div>
                          </div>
                          <div className="border-t-2 border-black pt-3 mt-4">
                              <div className="flex justify-between items-end">
                                  <span className="font-black uppercase text-sm">TAKE HOME PAY</span>
                                  <span className="text-2xl font-black text-emerald-600">{formatRp(takeHomePay)}</span>
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="p-4 border-t flex justify-end gap-3 bg-white">
                      <button onClick={() => setCalcModal(null)} className="px-4 py-2 bg-slate-100 rounded-lg font-bold text-slate-600">Batal</button>
                      <button onClick={handleBayarGaji} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-2"><CheckCircle size={18}/> Bayar & Catat Pengeluaran</button>
                  </div>
              </div>
          </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden mt-4">
        <table className="w-full text-sm text-left block md:table">
          <thead className="bg-slate-50 text-slate-800 text-xs uppercase border-b"><tr><th className="px-4 py-3">Nama Karyawan</th><th className="px-4 py-3">Jabatan</th><th className="px-4 py-3 text-right">Gaji Pokok</th><th className="px-4 py-3 text-right">Uang Harian</th><th className="px-4 py-3 text-center">Aksi (Payroll)</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {(!karyawan || karyawan.length === 0) ? <tr><td colSpan="5" className="text-center py-12 text-slate-400">Belum ada data karyawan.</td></tr> : karyawan.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-black text-slate-800 uppercase">{emp.name}</td>
                <td className="px-4 py-3 font-bold text-slate-500">{emp.jabatan}</td>
                <td className="px-4 py-3 text-right font-bold text-blue-600">{formatRp(emp.gajiPokok)}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatRp(emp.uangMakan)}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => setCalcModal(emp)} className="text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg font-bold text-xs border border-emerald-200 hover:bg-emerald-100 transition shadow-sm flex items-center gap-1">
                      <Calculator size={14}/> Hitung Gaji
                    </button>
                    <button onClick={() => handleEdit(emp)} className="text-blue-600 bg-blue-50 px-2 py-1 rounded-lg font-bold text-[10px] border border-blue-200 hover:bg-blue-100 transition shadow-sm">EDIT</button>
                    <button onClick={() => requestDelete(emp.id)} className="text-red-500 bg-red-50 p-1.5 rounded-lg border border-red-200 hover:bg-red-100 transition shadow-sm"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
