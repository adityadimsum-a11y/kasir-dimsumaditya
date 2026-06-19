import React, { useState, useMemo } from 'react';
import { 
  Calculator, Plus, Search, Edit2, Trash2, 
  Save, X, ShieldCheck, ArrowRight, Building2, 
  CheckCircle2, AlertTriangle, RefreshCw
} from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

export default function TabMasterKonversi({ user, sendToSheet, showToast, masterConversionRules = [] }) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State berbasis SSOT Blueprint
  const defaultForm = {
    id: '',
    branch_id: 'GLOBAL',
    kode_rule: '',
    nama_rule: '',
    kategori: 'PRODUKSI_DAPUR',
    nilai_sumber: '',
    satuan_sumber: '',
    nilai_hasil: '',
    satuan_hasil: ''
  };
  const [form, setForm] = useState(defaultForm);

  // Filter & Search Data
  const filteredRules = useMemo(() => {
    let rules = Array.isArray(masterConversionRules) ? masterConversionRules : [];
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rules = rules.filter(r => 
        (r.nama_rule || '').toLowerCase().includes(q) || 
        (r.kode_rule || '').toLowerCase().includes(q) ||
        (r.kategori || '').toLowerCase().includes(q)
      );
    }
    
    // Sort: Global rules first, then specific branches, then alphabetically
    return rules.sort((a, b) => {
      if (a.branch_id === 'GLOBAL' && b.branch_id !== 'GLOBAL') return -1;
      if (a.branch_id !== 'GLOBAL' && b.branch_id === 'GLOBAL') return 1;
      return (a.nama_rule || '').localeCompare(b.nama_rule || '');
    });
  }, [masterConversionRules, searchQuery]);

  // Actions
  const handleOpenAdd = () => {
    setForm(defaultForm);
    setIsEditing(false);
    setShowForm(true);
  };

  const handleOpenEdit = (rule) => {
    setForm({
      id: rule.id,
      branch_id: rule.branch_id || 'GLOBAL',
      kode_rule: rule.kode_rule || '',
      nama_rule: rule.nama_rule || '',
      kategori: rule.kategori || 'PRODUKSI_DAPUR',
      nilai_sumber: rule.nilai_sumber || '',
      satuan_sumber: rule.satuan_sumber || '',
      nilai_hasil: rule.nilai_hasil || '',
      satuan_hasil: rule.satuan_hasil || ''
    });
    setIsEditing(true);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      id: isEditing ? form.id : generateId('RUL', todayStr),
      branch_id: form.branch_id.toUpperCase(),
      kode_rule: form.kode_rule.toUpperCase().replace(/\s+/g, '_'),
      nama_rule: form.nama_rule,
      kategori: form.kategori,
      nilai_sumber: Number(form.nilai_sumber),
      satuan_sumber: form.satuan_sumber.toUpperCase(),
      nilai_hasil: Number(form.nilai_hasil),
      satuan_hasil: form.satuan_hasil.toUpperCase(),
      isDeleted: false,
      updated_at: new Date().toISOString(),
      updated_by: user?.name || 'SYSTEM'
    };

    // Table name disesuaikan dengan standar backend Google Sheets kita
    const isSuccess = await sendToSheet(isEditing ? 'update' : 'insert', payload, 'master_conversion_rules');
    
    if (isSuccess) {
      showToast(isEditing ? 'Rule Konversi berhasil diupdate!' : 'Rule Konversi baru berhasil ditambahkan!', 'success');
      setShowForm(false);
      setForm(defaultForm);
    }
    
    setIsSubmitting(false);
  };

  const handleToggleStatus = async (rule) => {
    const newStatus = !rule.isDeleted;
    const actionText = newStatus ? 'menonaktifkan' : 'mengaktifkan kembali';
    
    if (!window.confirm(`Apakah Anda yakin ingin ${actionText} rule ${rule.nama_rule}? Kalkulasi yang menggunakan rule ini bisa terpengaruh.`)) return;

    const payload = {
      id: rule.id,
      isDeleted: newStatus,
      updated_at: new Date().toISOString(),
      updated_by: user?.name || 'SYSTEM'
    };

    const isSuccess = await sendToSheet('update', payload, 'master_conversion_rules');
    if (isSuccess) {
      showToast(`Rule berhasil di${newStatus ? 'nonaktifkan' : 'aktifkan'}!`, 'success');
    }
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-[#CE1722] via-[#a3121b] to-[#111111] p-6 lg:p-8 rounded-3xl text-white shadow-xl border border-[#CE1722]/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 opacity-10">
          <ShieldCheck size={250} />
        </div>
        <div className="relative z-10 w-full md:w-3/4">
          <div className="flex items-center gap-2 bg-[#F4B400] text-[#111111] px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest w-max mb-3 shadow-md">
            <RefreshCw size={14} className="animate-spin-slow" /> Single Source of Truth (SSOT)
          </div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight mb-2 flex items-center gap-3">
            <Calculator className="text-[#F4B400]" size={32} /> Master Aturan Konversi
          </h1>
          <p className="text-xs text-white/80 max-w-2xl font-medium leading-relaxed">
            Pusat kendali rasio produksi, logistik, dan operasional lintas cabang. Seluruh modul (Produksi, Stok, HPP, POS) diwajibkan untuk membaca parameter dari matriks di bawah ini guna mencegah ketidaksesuaian data akibat hardcode.
          </p>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari kode, nama rule, atau kategori..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-[#CE1722] focus:bg-white transition-colors"
          />
        </div>
        <button 
          onClick={handleOpenAdd}
          className="w-full sm:w-auto px-6 py-2.5 bg-[#111111] hover:bg-[#CE1722] text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors shadow-md cursor-pointer"
        >
          <Plus size={16} /> Tambah Rule SSOT
        </button>
      </div>

      {/* DATA GRID */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar min-h-[50vh]">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4">ID &amp; Kode Rule</th>
                <th className="px-5 py-4">Nama Aturan Dasar</th>
                <th className="px-5 py-4">Scope Area</th>
                <th className="px-5 py-4 text-center">Rasio Konversi (SSOT)</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-center">Aksi Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs bg-white">
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-16">
                    <ShieldCheck size={48} className="mx-auto text-slate-300 mb-3" />
                    <div className="font-bold text-slate-500">Kamus aturan konversi belum tersedia atau pencarian tidak ditemukan.</div>
                  </td>
                </tr>
              ) : (
                filteredRules.map((rule) => (
                  <tr key={rule.id} className={`hover:bg-slate-50 transition-colors ${rule.isDeleted ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-black text-slate-800 tracking-wider text-xs">{rule.kode_rule}</div>
                      <div className="text-[9px] font-mono text-slate-400 mt-1">{rule.id}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-700">{rule.nama_rule}</div>
                      <span className="inline-block mt-1 bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border border-slate-200">
                        {String(rule.kategori || '').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-[9px] font-black border uppercase tracking-wider flex items-center gap-1.5 w-max ${rule.branch_id === 'GLOBAL' ? 'bg-[#F4B400]/10 text-[#a87b00] border-[#F4B400]/30' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {rule.branch_id === 'GLOBAL' ? <ShieldCheck size={12}/> : <Building2 size={12}/>}
                        {rule.branch_id}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="inline-flex items-center justify-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 shadow-inner">
                        <div className="text-right">
                          <div className="font-black text-slate-800 text-sm">{rule.nilai_sumber}</div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{rule.satuan_sumber}</div>
                        </div>
                        <ArrowRight size={16} className="text-[#CE1722]" />
                        <div className="text-left">
                          <div className="font-black text-[#CE1722] text-sm">{rule.nilai_hasil}</div>
                          <div className="text-[9px] font-bold text-[#CE1722]/70 uppercase tracking-widest">{rule.satuan_hasil}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {rule.isDeleted ? (
                        <span className="bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider shadow-sm inline-flex items-center gap-1">
                          <AlertTriangle size={10} /> Nonaktif
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider shadow-sm inline-flex items-center gap-1">
                          <CheckCircle2 size={10} /> Aktif
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleOpenEdit(rule)}
                          className="p-2 text-slate-400 bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600 rounded-lg shadow-sm transition-colors cursor-pointer" 
                          title="Edit Aturan"
                        >
                          <Edit2 size={14}/>
                        </button>
                        <button 
                          onClick={() => handleToggleStatus(rule)}
                          className={`p-2 bg-white border border-slate-200 rounded-lg shadow-sm transition-colors cursor-pointer ${rule.isDeleted ? 'text-emerald-500 hover:border-emerald-300 hover:bg-emerald-50' : 'text-red-500 hover:border-red-300 hover:bg-red-50'}`} 
                          title={rule.isDeleted ? "Aktifkan" : "Nonaktifkan"}
                        >
                          {rule.isDeleted ? <CheckCircle2 size={14}/> : <Trash2 size={14}/>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 bg-[#111111] flex justify-between items-center text-white shrink-0">
              <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                <Calculator size={18} className="text-[#F4B400]"/> {isEditing ? 'Edit Master Konversi' : 'Tambah Master Konversi'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Kode Referensi Unik (Maks 20 Char)</label>
                  <input 
                    type="text" required maxLength="20"
                    value={form.kode_rule} 
                    onChange={e => setForm({...form, kode_rule: e.target.value.toUpperCase()})} 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black outline-none focus:bg-white focus:border-[#CE1722] uppercase tracking-wider" 
                    placeholder="Cth: CNV_AYAM_ADUKAN" 
                  />
                  <div className="text-[9px] text-slate-400 font-bold mt-1">Harus unik, huruf besar & underscore.</div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Scope Pabrik / Cabang</label>
                  <select 
                    value={form.branch_id} 
                    onChange={e => setForm({...form, branch_id: e.target.value})} 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-[#CE1722] cursor-pointer uppercase tracking-wider"
                  >
                    <option value="GLOBAL">GLOBAL (Berlaku Semua Cabang)</option>
                    <option value="TANGERANG_PUSAT">HQ TANGERANG PUSAT</option>
                    <option value="PEMALANG">CABANG PEMALANG</option>
                    <option value="CIBINONG">OUTLET CIBINONG</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Nama Aturan Bisnis</label>
                <input 
                  type="text" required 
                  value={form.nama_rule} 
                  onChange={e => setForm({...form, nama_rule: e.target.value})} 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-[#CE1722]" 
                  placeholder="Cth: Standar Resep 1 Adukan" 
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Kategori Proses</label>
                <select 
                  value={form.kategori} 
                  onChange={e => setForm({...form, kategori: e.target.value})} 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-[#CE1722] cursor-pointer"
                >
                  <option value="LOGISTIK_GUDANG">Logistik & Gudang</option>
                  <option value="PRODUKSI_DAPUR">Produksi & Dapur</option>
                  <option value="DISTRIBUSI_PACKING">Distribusi & Packing</option>
                  <option value="PENJUALAN_POS">Penjualan & POS</option>
                  <option value="FINANSIAL_HPP">Keuangan & HPP</option>
                </select>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner">
                <div className="text-[10px] font-black text-[#111111] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Calculator size={14} className="text-[#CE1722]"/> Matriks Persamaan Rasio
                </div>
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <div className="flex-1 w-full grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Nilai Input</label>
                      <input type="number" required min="0" step="any" value={form.nilai_sumber} onChange={e => setForm({...form, nilai_sumber: e.target.value})} className="w-full p-3 bg-white border border-slate-300 rounded-xl text-center font-black text-slate-800 outline-none focus:border-[#CE1722]" placeholder="Cth: 30" />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Satuan Input</label>
                      <input type="text" required value={form.satuan_sumber} onChange={e => setForm({...form, satuan_sumber: e.target.value.toUpperCase()})} className="w-full p-3 bg-white border border-slate-300 rounded-xl text-center font-bold text-slate-600 outline-none focus:border-[#CE1722] uppercase" placeholder="Cth: KG" />
                    </div>
                  </div>
                  
                  <div className="text-xl font-black text-slate-400 shrink-0">➔</div>
                  
                  <div className="flex-1 w-full grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Nilai Output</label>
                      <input type="number" required min="0" step="any" value={form.nilai_hasil} onChange={e => setForm({...form, nilai_hasil: e.target.value})} className="w-full p-3 bg-white border border-red-200 rounded-xl text-center font-black text-[#CE1722] outline-none focus:border-[#CE1722]" placeholder="Cth: 1" />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Satuan Output</label>
                      <input type="text" required value={form.satuan_hasil} onChange={e => setForm({...form, satuan_hasil: e.target.value.toUpperCase()})} className="w-full p-3 bg-white border border-red-200 rounded-xl text-center font-bold text-[#CE1722] outline-none focus:border-[#CE1722] uppercase" placeholder="Cth: ADUKAN" />
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-[#F4B400]/10 border border-[#F4B400]/30 rounded-xl text-[10px] font-bold text-[#a87b00] leading-relaxed">
                  Logika Pembacaan: Sistem akan menerjemahkan bahwa <strong>{form.nilai_sumber || 'X'} {form.satuan_sumber || 'Satuan'}</strong> adalah setara mutlak dengan <strong>{form.nilai_hasil || 'Y'} {form.satuan_hasil || 'Satuan'}</strong> untuk scope {form.branch_id}.
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 rounded-xl text-slate-500 font-black text-xs uppercase tracking-wider hover:bg-slate-100 cursor-pointer">Batal</button>
                <button type="submit" disabled={isSubmitting} className="px-8 py-3 rounded-xl bg-[#111111] hover:bg-[#CE1722] text-white font-black text-xs uppercase tracking-wider shadow-md disabled:opacity-50 cursor-pointer transition-colors">
                  {isSubmitting ? 'Menyimpan...' : 'Sahkan Aturan'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
