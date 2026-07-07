// Themed recharts wrappers for the Sky Root palette.
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

export const PALETTE = ['#00A8A5', '#4A6FA5', '#3E7C57', '#C0703B', '#6B5B95', '#A14B4B', '#2F7E7E', '#B7791F', '#8c8276'];
const AXIS = { fontSize: 12, fill: '#8c8276' };
const GRID = '#ece5d8';

function TT({ active, payload, label, fmt }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-white shadow-lift border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-xs">
      {label != null && <div className="font-bold text-neutral-900 dark:text-white mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-neutral-700 dark:text-neutral-200">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="capitalize">{p.name}:</span>
          <span className="font-bold text-neutral-900 dark:text-white">{fmt ? fmt(p.value, p.name) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function BarsChart({ data, x, bars, fmt, height = 260, stack }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey={x} tick={AXIS} axisLine={false} tickLine={false} interval={0} angle={data.length > 7 ? -20 : 0} textAnchor={data.length > 7 ? 'end' : 'middle'} height={data.length > 7 ? 50 : 30} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<TT fmt={fmt} />} cursor={{ fill: '#00A8A510' }} />
        {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {bars.map((b, i) => (
          <Bar key={b.key} dataKey={b.key} name={b.name || b.key} stackId={stack ? '1' : undefined}
            fill={b.color || PALETTE[i % PALETTE.length]} radius={stack ? 0 : [6, 6, 0, 0]} maxBarSize={48} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({ data, x, lines, fmt, height = 260, area }) {
  const Chart = area ? AreaChart : LineChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <defs>
          {lines.map((l, i) => (
            <linearGradient key={l.key} id={`g-${l.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={l.color || PALETTE[i % PALETTE.length]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={l.color || PALETTE[i % PALETTE.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey={x} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<TT fmt={fmt} />} />
        {lines.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {lines.map((l, i) => area ? (
          <Area key={l.key} type="monotone" dataKey={l.key} name={l.name || l.key} stroke={l.color || PALETTE[i % PALETTE.length]} strokeWidth={2.5} fill={`url(#g-${l.key})`} />
        ) : (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.name || l.key} stroke={l.color || PALETTE[i % PALETTE.length]} strokeWidth={2.5} dot={false} />
        ))}
      </Chart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, nameKey, valueKey, fmt, height = 240 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none">
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip content={<TT fmt={fmt} />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function GaugeChart({ value, label, height = 200, color = '#00A8A5' }) {
  const data = [{ name: label, value: Math.min(100, Math.round(value * 100)), fill: color }];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
        <RadialBar background={{ fill: '#ece5d8' }} dataKey="value" cornerRadius={20} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="font-heading" style={{ fontSize: 28, fill: '#2a251f' }}>
          {Math.round(value * 100)}%
        </text>
      </RadialBarChart>
    </ResponsiveContainer>
  );
}
