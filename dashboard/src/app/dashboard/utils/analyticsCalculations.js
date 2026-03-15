export const buildEmptyAnalytics = () => ({
    totalQuestions: 0,
    totalResponses: 0,
    responseRate: 0,
    avgCompletionMinutes: 0,
    avgCompletionLabel: '0s',
    eventEntrants: 0,
    boothCompletionRows: [],
    boothCompletionAveragePct: 0,
    completionStats: { completed: 0, partial: 0, abandoned: 0 },
    completionTime: { averageMinutes: 0, fastestMinutes: 0, slowestMinutes: 0 },
    quality: { completeAnswersPct: 0, detailedResponsesPct: 0, skipRatePct: 0, qualityScorePct: 0 },
    trends: { responseTrends: [], completionTimeTrends: [] },
    questionOptionDistributions: [],
    recentResponses: [],
    recentActivity: []
});

export const clampPercent = (value) => Math.max(0, Math.min(100, Math.round(value)));

export const formatDurationMinutes = (minutes) => {
    if (!Number.isFinite(minutes) || minutes <= 0) return '0s';
    if (minutes < 1) return `${Math.round(minutes * 60)}s`;
    return `${minutes.toFixed(1)} min`;
};

export const formatRelativeTime = (value) => {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Just now';
    const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
};

export const buildDateBuckets = (days) => {
    const buckets = [];
    for (let i = days - 1; i >= 0; i -= 1) {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().slice(0, 10);
        buckets.push({ key, date });
    }
    return buckets;
};
