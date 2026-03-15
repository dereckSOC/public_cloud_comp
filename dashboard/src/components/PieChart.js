import { useState } from 'react';

const DEFAULT_COLORS = [
    '#F58491',
    '#ff8c42',
    '#8bcc5e',
    '#ffaa00',
    '#e74c3c',
    '#3aaed8',
    '#6d9f71',
    '#F58491'
];

const START_ANGLE = -Math.PI / 2;
const TWO_PI = Math.PI * 2;
const HOVER_OFFSET = 8;

function clampPercent(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
}

function getSlicePercentage(slice, total) {
    const provided = Number(slice?.percentage);
    if (Number.isFinite(provided)) return clampPercent(provided);
    if (!Number.isFinite(total) || total <= 0) return 0;
    return clampPercent((slice.count / total) * 100);
}

function polarToCartesian(centerX, centerY, radius, angle) {
    return {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
    };
}

function buildSlicePath(centerX, centerY, radius, startAngle, endAngle) {
    const start = polarToCartesian(centerX, centerY, radius, startAngle);
    const end = polarToCartesian(centerX, centerY, radius, endAngle);
    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${centerX} ${centerY} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
}

export default function PieChart({ slices = [], size = 240, className = '' }) {
    const [hoveredSliceId, setHoveredSliceId] = useState('');
    const svgClassName = className ? `${className} overflow-visible` : 'overflow-visible';
    const normalized = slices
        .map((slice, index) => ({
            ...slice,
            id: slice.id || `slice-${index}`,
            label: String(slice?.label || `Option ${index + 1}`),
            count: Number(slice?.count) || 0
        }))
        .filter((slice) => slice.count > 0);
    const total = normalized.reduce((sum, slice) => sum + slice.count, 0);
    const center = size / 2;
    const radius = Math.max(center - 2, 0);

    if (total <= 0) {
        return (
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className={svgClassName}
                role="img"
                aria-label="Pie chart with no data"
            >
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="#f6f1f8"
                    stroke="#ff8c42"
                    strokeWidth="2"
                />
            </svg>
        );
    }

    if (normalized.length === 1) {
        const segment = normalized[0];
        const color = segment.color || DEFAULT_COLORS[0];
        const isHovered = hoveredSliceId === segment.id;
        const percentage = getSlicePercentage(segment, total);
        return (
            <div className="relative inline-block">
                <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                    className={svgClassName}
                    role="img"
                    aria-label="Pie chart"
                >
                    <circle
                        cx={center}
                        cy={center}
                        r={radius}
                        fill={color}
                        transform={isHovered ? `translate(0 -${HOVER_OFFSET})` : undefined}
                        style={{ transition: 'transform 140ms ease-out' }}
                        onMouseEnter={() => setHoveredSliceId(segment.id)}
                        onMouseLeave={() => setHoveredSliceId('')}
                        onFocus={() => setHoveredSliceId(segment.id)}
                        onBlur={() => setHoveredSliceId('')}
                        tabIndex={0}
                    />
                </svg>
                {isHovered && (
                    <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border-2 border-[#ff8c42] bg-white px-2 py-1 text-xs font-medium text-black shadow-sm">
                        {segment.label}: {segment.count} ({percentage}%)
                    </div>
                )}
            </div>
        );
    }

    const segmentState = normalized.reduce((state, slice, index) => {
        const startAngle = state.nextAngle;
        const proportion = slice.count / total;
        const sweep = proportion * TWO_PI;
        const endAngle = startAngle + sweep;
        return {
            nextAngle: endAngle,
            segments: [
                ...state.segments,
                {
                    id: slice.id,
                    label: slice.label,
                    count: slice.count,
                    percentage: getSlicePercentage(slice, total),
                    color: slice.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
                    path: buildSlicePath(center, center, radius, startAngle, endAngle),
                    midAngle: startAngle + (sweep / 2)
                }
            ]
        };
    }, { nextAngle: START_ANGLE, segments: [] });
    const segments = segmentState.segments;
    const hoveredSegment = segments.find((segment) => segment.id === hoveredSliceId);

    return (
        <div className="relative inline-block">
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className={svgClassName}
                role="img"
                aria-label="Pie chart"
            >
                {segments.map((segment) => {
                    const isHovered = hoveredSliceId === segment.id;
                    const xOffset = isHovered ? Math.cos(segment.midAngle) * HOVER_OFFSET : 0;
                    const yOffset = isHovered ? Math.sin(segment.midAngle) * HOVER_OFFSET : 0;
                    return (
                        <g
                            key={segment.id}
                            transform={`translate(${xOffset} ${yOffset})`}
                            style={{ transition: 'transform 140ms ease-out' }}
                        >
                            <path
                                d={segment.path}
                                fill={segment.color}
                                stroke="#ffffff"
                                strokeWidth="2"
                                strokeLinejoin="round"
                                onMouseEnter={() => setHoveredSliceId(segment.id)}
                                onMouseLeave={() => setHoveredSliceId('')}
                                onFocus={() => setHoveredSliceId(segment.id)}
                                onBlur={() => setHoveredSliceId('')}
                                tabIndex={0}
                            />
                        </g>
                    );
                })}
            </svg>
            {hoveredSegment && (
                <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border-2 border-[#ff8c42] bg-white px-2 py-1 text-xs font-medium text-black shadow-sm">
                    {hoveredSegment.label}: {hoveredSegment.count} ({hoveredSegment.percentage}%)
                </div>
            )}
        </div>
    );
}
