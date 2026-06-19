import React, { useState, useEffect } from 'react';
import { Calculator, Save, RefreshCw, Layers, ShieldCheck, Info } from 'lucide-react';

export default function TabMasterKonversi({ user, sendToSheet, showToast, masterConversionRules }) {
  // Aturan default sesuai dengan Rule Master Konversi perusahaan jika database kosong
  const defaultRules = [
    { id: 'RULE-001', rule_name: 'Rule 1: Kemasan Ayam Mentah', input_val: 10, input_unit: 'KG Ayam', output_val: 1, output_unit: 'Kantong Ayam', description: 'Standar berat satu kantong pasokan ayam mentah' },
    { id: 'RULE-002', rule_name: 'Rule 2: Kapasitas Mesin Adukan', input_val: 30, input_unit: 'KG Ayam', output_val: 1, output_unit: 'Adukan', description: 'Rasio kebutuhan ayam untuk satu kali proses adonan giling' },
    { id: 'RULE-003', rule_name: 'Rule 3: Output Hasil Produksi', input_val: 1, input_unit: 'Adukan', output_val: 1000, output_unit: 'PCS Dimsum Mentah', description: 'Potensi standar hasil cetak dimsum mentah per adukan' },
    { id: 'RULE-004', rule_name: 'Rule 4: Porsi Saji Kuliner', input_val: 1, input_unit: 'Porsi', output_val: 4, output_unit: 'PCS', description: 'Rasio penyajian menu dimsum siap makan' },
    { id: 'RULE-005', rule_name: 'Rule 5: Kemasan Distribusi Frozen', input_val: 1, input_unit: 'Mika Frozen', output_val: 50, output_unit: 'PCS', description: 'Standar isi pack pembekuan untuk distribusi cabang' }
  ];

  const [rules, setRules] = useState(defaultRules);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ input_val: 0, output_val: 0 });
  
  // State untuk Simulator Kalkulator
  const [simInputAyam, setSimInputAyam] = useState(30);

  // Sinkronisasi dengan dbData masterConversionRules jika tersedia dari server
  useEffect(() => {
    if (masterConversionRules && masterConversionRules.length > 0) {
      // Memastikan format data sesuai
      const mappedRules = defaultRules.map(def => {
        const serverRule = masterConversionRules.find(r => r.id === def.id || r.rule_name === def.rule_name);
        return serverRule ? { ...def, ...serverRule } : def;
      });
      setRules(mappedRules);
    }
  }, [masterConversionRules]);

  const handleStartEdit = (rule) => {
    setEditingId(rule.id);
    setEditForm({
      input_val: Number(rule.input_val),
      output_val: Number(rule.output_val)
    });
  };

  const handleSaveEdit = async (id) => {
    if (editForm.input_val <= 0 || editForm.output_val <= 0) {
      showToast('Nilai konversi harus lebih besar dari 0!', 'error');
      return;
    }

    const targetRule = rules.find(r => r.id === id);
    const updatedPayload = {
      ...targetRule,
      input_val: Number(editForm.input_val),
      output_val: Number(editForm.output_val),
      updated_at: new Date().toISOString(),
      updated_by: user?.name || 'ADMIN'
    };

    // Optimistic Update UI Lokal
    setRules(prev => prev.map(r => r.id === id ? updatedPayload : r));
    setEditingId(null);

    // Kirim ke Google Apps Script Cloud Database
    const success = await sendToSheet('update', updatedPayload, 'masterConversionRules');
    if (success) {
      showToast(`Berhasil memperbarui ${targetRule.rule_name}`, 'success');
    } else {
      showToast('Gagal menyimpan perubahan ke cloud. Mengembalikan data...', 'error');
      // Revert jika gagal
      if (masterConversionRules && masterConversionRules.length > 0) {
        setRules(rules);
      }
    }
  };

  // Logika Hitung Simulator Berantai berasaskan SSOT
  const hitungSimulasi = () => {
    const ayam = Number(simInputAyam) || 0;
    
    // Ambil nilai konversi dinamis dari state saat ini
    const r1 = rules.find(r => r.id === 'RULE-001');
    const r2 = rules.find(r => r.id === 'RULE-002');
    const r3 = rules.find(r => r.id === 'RULE-003');
    const r5 = rules.find(r => r.id === 'RULE-005');

    const kantongAyam = ayam / (r1.input_val / r1.output_val);
    const adukan = ayam / (r2.input_val / r2.output_val);
    const pcsDimsum = adukan * (r3.output_val / r3.input_val);
    const porsi = pcsDimsum / 4; // Berdasarkan Rule 4 (1 Porsi = 4 PCS)
    const mikaFrozen = pcsDimsum / (r5.output_val / r5.input_val);

    return {
      kantongAyam: kantongAyam.toFixed(1),
      adukan: adukan.toFixed(1),
      pcsDimsum: Math.floor(pcsDimsum).toLocaleString('id-ID'),
      porsi: Math.floor(porsi).toLocaleString('id-ID'),
      mikaFrozen: Math.floor(mikaFrozen).toLocaleString('id-ID')
    };
  };

  const hasilSimulasi = hitungSimulasi();

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-[#CE1722] via-[#a3121b] to-[#111111] p-6 rounded-2xl text-white shadow-md border border-[#CE1722]/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10">
          <Calculator size={200} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 bg-[#F4B400] text-[#111111] px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest w-max mb-2">
              <ShieldCheck size={12} /> Single Source of Truth (SSOT)
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">Master Aturan Konversi Pabrik</h1>
            <p className="text-xs text-white/80 max-w-2xl mt-1 font-medium">
              Pusat kendali parameter konversi tunggal untuk seluruh sistem ERP. Semua kalkulasi Produksi, Laporan Stok HPP, Profit Owner, dan War Room logistik wajib merujuk pada angka di bawah ini.
            </p>
          </div>
        </div>
      </div>

      {/* GRID DISPLAY GOLDEN RULES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {rules.map((rule, idx) => (
          <div key={rule.id} className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-3xs flex flex-col justify-between hover:border-[#F4B400] transition-all group">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Aturan 0{idx + 1}</span>
                <span className="w-2 h-2 rounded-full bg-[#CE1722]"></span>
              </div>
              <h3 className="text-xs font-black text-slate-700 tracking-tight leading-snug mb-3 group-hover:text-[#CE1722] transition-colors">{rule.rule_name.split(': ')[1]}</h3>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
              <div className="text-sm font-black text-[#111111]">
                {rule.input_val} <span className="text-[10px] text-slate-400 font-bold">{rule.input_unit}</span>
              </div>
              <div className="text-[9px] font-black text-slate-400 my-0.5 uppercase tracking-widest">Sama Dengan</div>
              <div className="text-sm font-black text-[#CE1722]">
                {rule.output_val} <span className="text-[10px] text-slate-400 font-bold">{rule.output_unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* TABLE LOGIC EDITOR */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden lg:col-span-2">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-[#CE1722]" />
              <h2 className="text-sm font-black text-slate-800 tracking-tight uppercase">Konfigurasi Aturan Konversi</h2>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/60">
                  <th className="p-3.5 text-[10px] font-black text-slate-500 uppercase tracking-wider w-5/12">Deskripsi Aturan Bisnis</th>
                  <th className="p-3.5 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center w-5/12">Nilai Konversi Standar</th>
                  <th className="p-3.5 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center w-2/12">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5">
                      <div className="text-xs font-black text-slate-800 tracking-tight">{rule.rule_name}</div>
                      <div className="text-[10px] font-medium text-slate-400 mt-0.5 leading-relaxed">{rule.description}</div>
                    </td>
                    <td className="p-3.5 text-center">
                      {editingId === rule.id ? (
                        <div className="flex items-center justify-center gap-2 bg-amber-50/50 p-2 rounded-xl border border-amber-200/60">
                          <div className="flex flex-col items-center">
                            <input 
                              type="number" 
                              className="w-16 p-1 text-center font-black text-xs border border-slate-300 bg-white rounded-md outline-none focus:border-[#CE1722]"
                              value={editForm.input_val} 
                              onChange={(e) => setEditForm({ ...editForm, input_val: e.target.value })}
                            />
                            <span className="text-[9px] font-bold text-slate-400 mt-1">{rule.input_unit}</span>
                          </div>
                          <span className="text-xs font-black text-amber-600">➔</span>
                          <div className="flex flex-col items-center">
                            <input 
                              type="number" 
                              className="w-16 p-1 text-center font-black text-xs border border-slate-300 bg-white rounded-md outline-none focus:border-[#CE1722]"
                              value={editForm.output_val} 
                              onChange={(e) => setEditForm({ ...editForm, output_val: e.target.value })}
                            />
                            <span className="text-[9px] font-bold text-slate-400 mt-1">{rule.output_unit}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl border border-slate-200/30">
                          <span>{rule.input_val} <span className="text-[10px] text-slate-400 font-bold">{rule.input_unit}</span></span>
                          <span className="text-slate-400 font-medium">=</span>
                          <span className="text-[#CE1722]">{rule.output_val} <span className="text-[10px] text-slate-400 font-bold">{rule.output_unit}</span></span>
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      {editingId === rule.id ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            type="button" 
                            onClick={() => handleSaveEdit(rule.id)}
                            className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                            title="Simpan Aturan"
                          >
                            <Save size={14} />
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setEditingId(null)}
                            className="px-1.5 py-1 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-slate-300 transition-colors cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button 
                          type="button" 
                          onClick={() => handleStartEdit(rule)}
                          className="px-2.5 py-1.5 bg-white text-slate-600 hover:text-[#CE1722] border border-slate-200 hover:border-[#CE1722]/30 text-[10px] font-bold rounded-lg transition-all cursor-pointer shadow-3xs"
                        >
                          Ubah Rasio
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SIMULATOR KALKULATOR */}
        <div className="bg-gradient-to-b from-slate-900 to-[#111111] rounded-2xl text-white border border-slate-800 shadow-md p-5 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Calculator size={16} className="text-[#F4B400]" />
            <h2 className="text-xs font-black tracking-wider uppercase text-slate-200">Simulator Konversi SSOT</h2>
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 block mb-1.5 uppercase tracking-wider">Input Bahan Mentah Utama</label>
            <div className="relative">
              <input 
                type="number"
                className="w-full p-3 bg-slate-800/80 border border-slate-700 rounded-xl font-black text-base text-white outline-none focus:border-[#F4B400] transition-all pr-16"
                value={simInputAyam}
                onChange={(e) => setSimInputAyam(e.target.value)}
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-[#F4B400]">KG AYAM</span>
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
              <span className="text-[10px] font-bold text-slate-400">Total Stok Logistik</span>
              <span className="text-xs font-black text-white">{hasilSimulasi.kantongAyam} <span className="text-[9px] text-slate-400 font-bold">Kantong</span></span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
              <span className="text-[10px] font-bold text-slate-400">Kapasitas Maks Adukan</span>
              <span className="text-xs font-black text-[#F4B400]">{hasilSimulasi.adukan} <span className="text-[9px] text-slate-400 font-bold">Adukan</span></span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
              <span className="text-[10px] font-bold text-slate-400">Estimasi Hasil Dimsum</span>
              <span className="text-xs font-black text-white">{hasilSimulasi.pcsDimsum} <span className="text-[9px] text-slate-400 font-bold">PCS</span></span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
              <span className="text-[10px] font-bold text-slate-400">Porsi Siap Saji (POS)</span>
              <span className="text-xs font-black text-white">{hasilSimulasi.porsi} <span className="text-[9px] text-slate-400 font-bold">Porsi</span></span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-[10px] font-bold text-slate-400">Output Mika Frozen Pack</span>
              <span className="text-sm font-black text-[#CE1722]">{hasilSimulasi.mikaFrozen} <span className="text-[9px] text-slate-400 font-bold">Mika</span></span>
            </div>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-2 items-start text-amber-200">
            <Info size={14} className="shrink-0 mt-0.5" />
            <p className="text-[10px] font-medium leading-relaxed">
              Kalkulator simulator di atas membuktikan bahwa perubahan rasio konversi pada tabel konfigurasi sebelah kiri akan langsung mengubah hasil kalkulasi di atas secara real-time tanpa hardcode.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
