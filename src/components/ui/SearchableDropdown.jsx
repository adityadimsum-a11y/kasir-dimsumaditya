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
        className={`w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-sm flex justify-between items-center transition-all ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'cursor-pointer hover:border-slate-400 focus:ring-2 focus:ring-red-500'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={displayLabel ? 'text-slate-800 uppercase' : 'text-slate-400'}>
          {displayLabel || placeholder || 'Pilih Data...'}
        </span>
        <ChevronDown size={16} className="text-slate-400" />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-hidden flex flex-col animate-in slide-in-from-top-2">
          <div className="p-2 border-b bg-slate-50 flex items-center gap-2">
            <Search size={14} className="text-slate-400" />
            <input 
              type="text" 
              autoFocus 
              placeholder="Ketik untuk mencari..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value.toUpperCase())}
              className="w-full bg-transparent outline-none text-xs font-bold text-slate-700"
            />
          </div>
          
          <div className="overflow-y-auto flex-1 custom-scrollbar p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => (
                <div 
                  key={idx} 
                  className="px-3 py-2 hover:bg-slate-100 cursor-pointer rounded-lg text-xs font-bold text-slate-700 uppercase"
                  onClick={() => { onChange(opt); setIsOpen(false); setSearchTerm(''); }}
                >
                  {opt[labelKey]}
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-xs text-slate-400">Data tidak ditemukan.</div>
            )}
            
            {/* SUPER ADMIN SHORTCUT: Create New Master Data */}
            {canCreate && searchTerm && !exactMatch && (
              <div 
                className="px-3 py-2 mt-1 bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer rounded-lg text-xs font-black uppercase flex items-center gap-2 border border-red-100 transition-colors"
                onClick={() => { onCreateNew(searchTerm); setIsOpen(false); setSearchTerm(''); }}
              >
                <Plus size={14}/> Tambah Baru "{searchTerm}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
