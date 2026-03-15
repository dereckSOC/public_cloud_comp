export default function StatCard({ title, value, change, icon, color }) {
    const colorClasses = {
        purple: 'text-[#7A2F38]',
        orange: 'text-[#ff8c42]',
        green: 'text-[#8bcc5e]',
    };

    return (
        <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="text-2xl">{icon}</div>
                {change && (
                    <span className="text-sm font-medium text-[#8bcc5e]">
                        {change.startsWith('+') ? `+${change.slice(1)}` : change}
                    </span>
                )}
            </div>
            <div>
                <div className={`text-2xl font-bold ${colorClasses[color] || colorClasses.purple}`}>{value}</div>
                <div className="text-sm text-[#7A2F38]">{title}</div>
            </div>
        </div>
    );
}
