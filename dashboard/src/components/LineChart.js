export default function LineChart({ data = [], height = 200, color = "#FAB7C0" }) {
    // Default sample data if none provided
    const chartData = data.length > 0 ? data : [
        { x: 0, y: 30 }, { x: 1, y: 45 }, { x: 2, y: 35 },
        { x: 3, y: 55 }, { x: 4, y: 50 }, { x: 5, y: 65 },
        { x: 6, y: 60 }, { x: 7, y: 75 }
    ];

    const width = 400;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Find min and max values for scaling
    const maxY = Math.max(...chartData.map(d => d.y), 100);
    const minY = Math.min(...chartData.map(d => d.y), 0);
    const rangeY = maxY - minY || 1;

    // Calculate points
    const points = chartData.map((point, index) => {
        const x = padding + (index / (chartData.length - 1 || 1)) * chartWidth;
        const y = padding + chartHeight - ((point.y - minY) / rangeY) * chartHeight;
        return { x, y };
    });

    // Create path for line
    const pathData = points.map((point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
    ).join(' ');

    // Create area path (for fill under line)
    const areaPath = `${pathData} L ${points[points.length - 1].x} ${padding + chartHeight} L ${points[0].x} ${padding + chartHeight} Z`;

    return (
        <div className="w-full">
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
                {/* Grid lines */}
                {[0, 1, 2, 3, 4].map((i) => {
                    const y = padding + (i / 4) * chartHeight;
                    return (
                        <line
                            key={i}
                            x1={padding}
                            y1={y}
                            x2={width - padding}
                            y2={y}
                            stroke="#FAB7C0"
                            strokeWidth="1"
                            strokeDasharray="2,2"
                            opacity="0.5"
                        />
                    );
                })}

                {/* Area under line */}
                <path
                    d={areaPath}
                    fill={color}
                    fillOpacity="0.1"
                />

                {/* Main line */}
                <path
                    d={pathData}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Data points */}
                {points.map((point, index) => (
                    <circle
                        key={index}
                        cx={point.x}
                        cy={point.y}
                        r="4"
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth="2"
                    />
                ))}
            </svg>
        </div>
    );
}
