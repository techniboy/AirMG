import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface HRPoint {
  time: string;
  hr: number;
}

interface HRChartProps {
  data: HRPoint[];
  color?: string;
}

export function HRChart({ data, color = '#FF4F73' }: HRChartProps) {
  if (!data || data.length < 2) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl bg-surface-inset">
        <span className="text-sm text-text-tertiary">No HR data available.</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={128}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.4} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1B2620" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="time"
          tick={{ fill: '#6F7A74', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={['auto', 'auto']}
          tick={{ fill: '#6F7A74', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={30}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#0D1512',
            border: '1px solid #1B2620',
            borderRadius: 8,
            color: '#F4F7F5',
            fontSize: 12,
          }}
          formatter={(val: number) => [`${val} bpm`, 'HR']}
        />
        <Area
          type="monotone"
          dataKey="hr"
          stroke={color}
          strokeWidth={1.5}
          fill="url(#hrGrad)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
