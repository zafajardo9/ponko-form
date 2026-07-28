import { useId, useMemo, useState } from "react";

type TimeSeriesDatum = {
  date: string;
  value: number;
};

interface TimeSeriesChartProps {
  data: TimeSeriesDatum[];
  kind: "area" | "bar";
  color: string;
  label: string;
  valueLabel: (value: number) => string;
  axisLabel?: (value: number) => string;
  integerValues?: boolean;
}

const WIDTH = 420;
const HEIGHT = 240;
const PLOT = { left: 40, right: 10, top: 12, bottom: 32 };

function localDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function shortDate(date: string) {
  return localDate(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function longDate(date: string) {
  return localDate(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function niceMaximum(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function chartPoints(data: TimeSeriesDatum[], maximum: number) {
  const plotWidth = WIDTH - PLOT.left - PLOT.right;
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
  const denominator = Math.max(data.length - 1, 1);
  return data.map((datum, index) => ({
    ...datum,
    x: PLOT.left + (index / denominator) * plotWidth,
    y: PLOT.top + plotHeight - (datum.value / maximum) * plotHeight,
  }));
}

export function TimeSeriesChart({
  data,
  kind,
  color,
  label,
  valueLabel,
  axisLabel = (value) => String(value),
  integerValues = false,
}: TimeSeriesChartProps) {
  const titleId = useId();
  const descriptionId = useId();
  const gradientId = useId().replace(/:/g, "");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const maximum = niceMaximum(Math.max(0, ...data.map((datum) => datum.value)));
  const points = useMemo(() => chartPoints(data, maximum), [data, maximum]);
  const plotBottom = HEIGHT - PLOT.bottom;
  const plotWidth = WIDTH - PLOT.left - PLOT.right;
  const barWidth = Math.max(3, Math.min(14, plotWidth / Math.max(data.length, 1) - 3));
  const active = activeIndex === null ? null : points[activeIndex];
  const tickIndexes = Array.from(
    new Set([0, 7, 14, 21, Math.max(data.length - 1, 0)]),
  ).filter((index) => index < data.length);
  const gridIntervalCount = integerValues
    ? Math.min(4, Math.max(1, Math.floor(maximum)))
    : 4;

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#8e8b82]">
        No chart data available
      </div>
    );
  }

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const firstPoint = points[0];
  const lastPoint = points.at(-1);
  if (!firstPoint || !lastPoint) return null;
  const areaPath = `${linePath} L ${lastPoint.x} ${plotBottom} L ${firstPoint.x} ${plotBottom} Z`;

  return (
    <div className="relative h-full min-h-56 w-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-full w-full"
        role="img"
        aria-labelledby={`${titleId} ${descriptionId}`}
      >
        <title id={titleId}>{label}</title>
        <desc id={descriptionId}>
          Daily values for the last {data.length} days. Maximum {valueLabel(maximum)}.
        </desc>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.24" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {Array.from(
          { length: gridIntervalCount + 1 },
          (_, index) => index / gridIntervalCount,
        ).map((ratio) => {
          const y = PLOT.top + ratio * (plotBottom - PLOT.top);
          const value = maximum * (1 - ratio);
          return (
            <g key={ratio} aria-hidden="true">
              <line
                x1={PLOT.left}
                x2={WIDTH - PLOT.right}
                y1={y}
                y2={y}
                stroke="#e6dfd8"
                strokeDasharray="3 4"
              />
              <text
                x={PLOT.left - 7}
                y={y + 4}
                textAnchor="end"
                className="fill-[#6c6a64] text-[10px]"
              >
                {axisLabel(value)}
              </text>
            </g>
          );
        })}

        {kind === "area" ? (
          <>
            <path d={areaPath} fill={`url(#${gradientId})`} aria-hidden="true" />
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              aria-hidden="true"
            />
          </>
        ) : null}

        {points.map((point, index) => {
          const barHeight = Math.max(0, plotBottom - point.y);
          const ariaLabel = `${longDate(point.date)}: ${valueLabel(point.value)}`;
          return kind === "bar" ? (
            <g key={point.date}>
              <rect
                x={point.x - barWidth / 2}
                y={point.y}
                width={barWidth}
                height={barHeight}
                rx="3"
                fill={color}
                opacity={
                  activeIndex === null || activeIndex === index ? 1 : 0.48
                }
                aria-hidden="true"
              />
              <rect
                x={point.x - Math.max(barWidth, 14) / 2}
                y={PLOT.top}
                width={Math.max(barWidth, 14)}
                height={plotBottom - PLOT.top}
                fill="transparent"
                tabIndex={0}
                role="graphics-symbol"
                aria-label={ariaLabel}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
              />
            </g>
          ) : (
            <g key={point.date}>
              <circle
                cx={point.x}
                cy={point.y}
                r={activeIndex === index ? 4.5 : 2.5}
                fill={color}
                aria-hidden="true"
              />
              <circle
                cx={point.x}
                cy={point.y}
                r="9"
                fill="transparent"
                tabIndex={0}
                role="graphics-symbol"
                aria-label={ariaLabel}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
              />
            </g>
          );
        })}

        {tickIndexes.map((index) => (
          <text
            key={data[index].date}
            x={points[index].x}
            y={HEIGHT - 8}
            textAnchor={
              index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"
            }
            className="fill-[#6c6a64] text-[10px]"
            aria-hidden="true"
          >
            {shortDate(data[index].date)}
          </text>
        ))}
      </svg>

      {active ? (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-lg border border-[#e6dfd8] bg-white px-3 py-2 shadow-sm"
          style={{
            left: `${Math.min(82, Math.max(2, (active.x / WIDTH) * 100))}%`,
            transform: "translateX(-50%)",
          }}
          aria-hidden="true"
        >
          <p className="whitespace-nowrap text-xs text-[#6c6a64]">
            {longDate(active.date)}
          </p>
          <p className="whitespace-nowrap text-sm font-semibold text-[#141413]">
            {valueLabel(active.value)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
