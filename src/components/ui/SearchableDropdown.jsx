import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Plus } from 'lucide-react';

export default function SearchableDropdown({ 
  options, value, onChange, placeholder, valueKey = 'id', labelKey = 'name', 
  canCreate = false, onCreateNew, disabled = false 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => String(opt[valueKey]) === String(value));
  const displayLabel = selectedOption ? selectedOption[labelKey] : '';

  const filteredOptions = options.filter(opt => 
    String(opt[labelKey]).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exactMatch = options.find(opt => String(opt[labelKey]).toLowerCase() === searchTerm.toLowerCase());

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        className={`w-full p-2.5 bg-white border rounded-xl font-bold text-xs flex justify-between items-center transition-all ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' : 'cursor-pointer border-slate-300 hover:border-blue-400'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={displayLabel ? 'text-slate-800 normal-case' : 'text-slate-400 normal-case'}>
          {displayLabel || placeholder || 'Pilih data...'}
        </span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-500' : 'text-slate-400'}`} />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-[999] w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Search size={14} className="text-slate-400 ml-1" />
            <input 
              type="text" 
              autoFocus 
              placeholder="Ketik untuk mencari..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-transparent outline-none text-[11px] font-bold text-slate-700 normal-case placeholder:font-medium placeholder:text-slate-400"
            />
          </div>
          
          <div className="overflow-y-auto flex-1 custom-scrollbar p-1.5 space-y-0.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => (
                <div 
                  key={idx} 
                  className="px-3 py-2 hover:bg-slate-50 cursor-pointer rounded-lg text-[11px] font-bold text-slate-700 normal-case transition-colors"
                  onClick={() => { onChange(opt); setIsOpen(false); setSearchTerm(''); }}
                >
                  {opt[labelKey]}
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-[10px] font-medium text-slate-400 normal-case">Data tidak ditemukan.</div>
            )}
            
            {/* SUPER ADMIN SHORTCUT: Create New Master Data */}
            {canCreate && searchTerm && !exactMatch && (
              <div 
                className="px-3 py-2 mt-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-2 border border-emerald-100 transition-colors"
                onClick={() => { onCreateNew(searchTerm); setIsOpen(false); setSearchTerm(''); }}
              >
                <Plus size={12}/> Tambah Baru "{searchTerm}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
