import { useEffect, useState } from 'react';
import { supabase } from '@psd/shared/lib/supabaseClient';
import { buildEmptyAnalytics, clampPercent } from '../utils/analyticsCalculations';

const EMPTY_BOOTH_METRICS = {
    eventEntrants: 0,
    boothCompletionRows: [],
    boothCompletionAveragePct: 0
};

async function fetchBoothMetrics(eventId) {
    const normalizedEventId = Number(eventId);
    if (!Number.isInteger(normalizedEventId) || normalizedEventId <= 0) {
        return EMPTY_BOOTH_METRICS;
    }

    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) return EMPTY_BOOTH_METRICS;
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) return EMPTY_BOOTH_METRICS;

        const response = await fetch(
            `/api/analytics/booth-metrics?eventId=${encodeURIComponent(normalizedEventId)}`,
            {
                method: 'GET',
                headers: { Authorization: `Bearer ${accessToken}` },
                cache: 'no-store'
            }
        );

        if (!response.ok) return EMPTY_BOOTH_METRICS;

        const payload = await response.json();
        const eventEntrantsValue = Number(payload?.eventEntrants);
        const averagePctValue = Number(payload?.boothCompletionAveragePct);
        const boothCompletionRows = Array.isArray(payload?.boothCompletionRows)
            ? payload.boothCompletionRows.map((row) => {
                const questId = Number(row?.questId);
                const completedDevices = Number(row?.completedDevices);
                const entrants = Number(row?.entrants);
                const completionRatePct = Number(row?.completionRatePct);
                return {
                    questId: Number.isInteger(questId) ? questId : null,
                    questTitle: typeof row?.questTitle === 'string' && row.questTitle.trim()
                        ? row.questTitle.trim()
                        : 'Untitled booth',
                    completedDevices: Number.isFinite(completedDevices) && completedDevices > 0
                        ? Math.round(completedDevices) : 0,
                    entrants: Number.isFinite(entrants) && entrants > 0 ? Math.round(entrants) : 0,
                    completionRatePct: Number.isFinite(completionRatePct)
                        ? clampPercent(completionRatePct) : 0
                };
            })
            : [];

        return {
            eventEntrants: Number.isFinite(eventEntrantsValue) && eventEntrantsValue > 0
                ? Math.round(eventEntrantsValue) : 0,
            boothCompletionRows,
            boothCompletionAveragePct: Number.isFinite(averagePctValue)
                ? clampPercent(averagePctValue) : 0
        };
    } catch {
        return EMPTY_BOOTH_METRICS;
    }
}

export function useAnalytics(activeEventId, authLoading) {
    const [analyticsState, setAnalyticsState] = useState({
        loading: true,
        error: '',
        data: buildEmptyAnalytics()
    });

    useEffect(() => {
        if (authLoading) return;

        const loadAnalytics = async () => {
            if (!activeEventId) {
                setAnalyticsState({
                    loading: false,
                    error: '',
                    data: buildEmptyAnalytics()
                });
                return;
            }
            setAnalyticsState((prev) => ({ ...prev, loading: true, error: '' }));
            try {
                // Fetch booth metrics and response analytics in parallel
                const [boothMetrics, analyticsRes] = await Promise.all([
                    fetchBoothMetrics(activeEventId),
                    fetch(`/api/analytics/aggregate?eventId=${encodeURIComponent(activeEventId)}`, {
                        cache: 'no-store'
                    }),
                ]);

                if (!analyticsRes.ok) {
                    throw new Error('Could not load analytics.');
                }

                const analytics = await analyticsRes.json();

                setAnalyticsState({
                    loading: false,
                    error: '',
                    data: {
                        totalQuestions: analytics.totalQuestions ?? 0,
                        totalResponses: analytics.totalResponses ?? 0,
                        responseRate: analytics.responseRate ?? 0,
                        avgCompletionMinutes: analytics.avgCompletionMinutes ?? 0,
                        avgCompletionLabel: analytics.avgCompletionLabel ?? '0s',
                        eventEntrants: boothMetrics.eventEntrants,
                        boothCompletionRows: boothMetrics.boothCompletionRows,
                        boothCompletionAveragePct: boothMetrics.boothCompletionAveragePct,
                        completionStats: analytics.completionStats ?? { completed: 0, partial: 0, abandoned: 0 },
                        completionTime: analytics.completionTime ?? { averageMinutes: 0, fastestMinutes: 0, slowestMinutes: 0 },
                        quality: analytics.quality ?? {
                            completeAnswersPct: 0,
                            answerCoveragePct: 0,
                            detailedResponsesPct: 0,
                            skipRatePct: 0,
                            qualityScorePct: 0
                        },
                        trends: analytics.trends ?? { responseTrends: [], completionTimeTrends: [] },
                        questionOptionDistributions: analytics.questionOptionDistributions ?? [],
                        recentResponses: analytics.recentResponses ?? [],
                        recentActivity: analytics.recentActivity ?? [],
                    }
                });
            } catch (error) {
                setAnalyticsState({
                    loading: false,
                    error: 'Could not load analytics. Please try again.',
                    data: buildEmptyAnalytics()
                });
            }
        };
        loadAnalytics();
    }, [activeEventId, authLoading]);

    return analyticsState;
}
