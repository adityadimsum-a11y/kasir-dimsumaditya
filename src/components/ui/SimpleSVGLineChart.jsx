import React from 'react';

// 🔥 FIX: Menggunakan Helper Mandiri agar tidak crash dengan modul luar
const formatAngkaPendek = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
};

export default function SimpleSVGLineChart({ data }) {
    if(!data || data.length === 0) return null;
    
    // Tentukan nilai maksimum untuk batas Y (minimal 100 agar grafik tidak flat kalau angka kecil)
    const maxVal = Math.max(...data.map(d => d.value), 100); 
    
    // Dimensi SVG
    const width = 800; const height = 200;
    const paddingX = 40; const paddingY = 25;
    const chartW = width - (paddingX * 2);
    const chartH = height - (paddingY * 2);

    const getPoint = (val, i) => {
        const x = paddingX + (i * (chartW / (data.length - 1 || 1)));
        const y = height - paddingY - ((val / maxVal) * chartH);
        return `${x},${y}`;
    };

    const polylinePoints = data.map((d, i) => getPoint(d.value, i)).join(' ');

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full text-xs font-mono" preserveAspectRatio="none">
            {/* Background Grid Lines */}
            {[0, 0.5, 1].map(r => {
                const y = height - paddingY - (r * chartH);
                return <line key={r} x1={paddingX} y1={y} x2={width-paddingX} y2={y} stroke="#f1f5f9" strokeWidth="2" strokeDasharray="6" />
            })}
            
            {/* The Main Line Chart */}
            <polyline 
               points={polylinePoints} 
               fill="none" 
               stroke="#3b82f6" // Warna Biru Elegan
               strokeWidth="3.5" 
               strokeLinecap="round" 
               strokeLinejoin="round" 
               className="drop-shadow-sm"
            />
            
            {/* Data Points & Labels */}
            {data.map((d, i) => {
                const [cx, cy] = getPoint(d.value, i).split(',');
                return (
                    <g key={i} className="group">
                        {/* Area penangkap hover biar lebih lebar */}
                        <circle cx={cx} cy={cy} r="15" fill="transparent" className="cursor-pointer" />
                        
                        {/* Titik grafik asli */}
                        <circle cx={cx} cy={cy} r="4.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="2" className="transition-all duration-300 group-hover:r-[6px]" />
                        
                        {/* Teks Nominal di atas titik (Muncul kalau data <= 15 titik agar tidak tumpuk) */}
                        {data.length <= 15 && (
                            <text x={cx} y={Number(cy) - 12} textAnchor="middle" fill="#64748b" className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                {formatAngkaPendek(d.value)}
                            </text>
                        )}
                        
                        {/* Label Bawah X-Axis */}
                        <text x={cx} y={height - 5} textAnchor="middle" fill="#94a3b8" className="text-[9px] font-bold uppercase tracking-wider">{d.label}</text>
                    </g>
                );
            })}
        </svg>
    )
}
