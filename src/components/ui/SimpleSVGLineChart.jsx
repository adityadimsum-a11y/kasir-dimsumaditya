import React from 'react';
import { formatRp } from '../../utils/helpers';

export default function SimpleSVGLineChart({ data }) {
    if(!data || data.length === 0) return null;
    const maxVal = Math.max(...data.map(d => d.value), 100); 
    const width = 800; const height = 200;
    const paddingX = 40; const paddingY = 20;
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
            {[0, 0.5, 1].map(r => {
                const y = height - paddingY - (r * chartH);
                return <line key={r} x1={paddingX} y1={y} x2={width-paddingX} y2={y} stroke="#e2e8f0" strokeDasharray="4" />
            })}
            <polyline points={polylinePoints} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {data.map((d, i) => {
                const [cx, cy] = getPoint(d.value, i).split(',');
                return (
                    <g key={i}>
                        <circle cx={cx} cy={cy} r="5" fill="#ef4444" className="hover:r-7 transition-all cursor-pointer" />
                        {data.length <= 10 && (
                            <text x={cx} y={Number(cy) - 10} textAnchor="middle" fill="#64748b" className="text-[10px] font-bold">{formatRp(d.value).replace('Rp', '')}</text>
                        )}
                        <text x={cx} y={height} textAnchor="middle" fill="#94a3b8">{d.label}</text>
                    </g>
                );
            })}
        </svg>
    )
}
