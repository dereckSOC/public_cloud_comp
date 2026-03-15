import { useMemo, useState } from 'react';
import LineChart from '../../../components/LineChart';
import PieChart from '../../../components/PieChart';
import { formatDurationMinutes } from '../utils/analyticsCalculations';

const PIE_COLORS = ['#F58491', '#ff8c42', '#8bcc5e', '#ffaa00', '#3aaed8', '#6d9f71', '#F58491'];
const DELETED_COLOR = '#6b7280';
const UNMAPPED_COLOR = '#b45309';

export default function AnalyticsTab({ data, loading, error }) {
    const responseTrendsData = data.trends.responseTrends;
    const completionTimeData = data.trends.completionTimeTrends;
    const boothCompletionRows = useMemo(
        () => data.boothCompletionRows ?? [],
        [data.boothCompletionRows]
    );
    const eventEntrants = Number.isFinite(Number(data.eventEntrants))
        ? Math.max(0, Number(data.eventEntrants))
        : 0;
    const boothCompletionAveragePct = Number.isFinite(Number(data.boothCompletionAveragePct))
        ? Math.max(0, Math.min(100, Math.round(Number(data.boothCompletionAveragePct))))
        : 0;
    const highestCompletionBooth = useMemo(() => {
        if (boothCompletionRows.length === 0) return null;
        return boothCompletionRows.reduce((best, row) => {
            if (!best) return row;
            if (row.completionRatePct > best.completionRatePct) return row;
            if (
                row.completionRatePct === best.completionRatePct &&
                row.completedDevices > best.completedDevices
            ) {
                return row;
            }
            return best;
        }, null);
    }, [boothCompletionRows]);
    const lowestCompletionBooth = useMemo(() => {
        if (boothCompletionRows.length === 0) return null;
        return boothCompletionRows.reduce((worst, row) => {
            if (!worst) return row;
            if (row.completionRatePct < worst.completionRatePct) return row;
            if (
                row.completionRatePct === worst.completionRatePct &&
                row.completedDevices < worst.completedDevices
            ) {
                return row;
            }
            return worst;
        }, null);
    }, [boothCompletionRows]);
    const questionOptionDistributions = useMemo(
        () => data.questionOptionDistributions ?? [],
        [data.questionOptionDistributions]
    );
    const [selectedQuestionId, setSelectedQuestionId] = useState('');

    const selectedQuestion = useMemo(() => {
        if (questionOptionDistributions.length === 0) return null;
        return questionOptionDistributions.find(
            (question) => String(question.questionId) === String(selectedQuestionId)
        ) ?? questionOptionDistributions[0];
    }, [questionOptionDistributions, selectedQuestionId]);

    const coloredSlices = useMemo(() => {
        if (!selectedQuestion) return [];
        let optionColorIndex = 0;
        return selectedQuestion.slices.map((slice) => {
            if (slice.bucketType === 'deleted') {
                return { ...slice, color: DELETED_COLOR };
            }
            if (slice.bucketType === 'unmapped') {
                return { ...slice, color: UNMAPPED_COLOR };
            }
            const color = PIE_COLORS[optionColorIndex % PIE_COLORS.length];
            optionColorIndex += 1;
            return { ...slice, color };
        });
    }, [selectedQuestion]);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-[#7A2F38]">Analytics & Insights</h2>
            {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {error}
                </div>
            )}
            {/* Analytics Cards with Line Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm">
                    <h3 className="text-lg font-semibold mb-4 text-[#7A2F38]">Response Trends</h3>
                    <div className="h-64">
                        <LineChart data={responseTrendsData} height={200} color="#FAB7C0" />
                    </div>
                    <div className="mt-4 text-xs text-[#7A2F38] text-center">
                        Responses over time (last 11 days)
                    </div>
                </div>
                <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm">
                    <h3 className="text-lg font-semibold mb-4 text-[#7A2F38]">Completion Time Analysis</h3>
                    <div className="h-64">
                        <LineChart data={completionTimeData} height={200} color="#ff8c42" />
                    </div>
                    <div className="mt-4 text-xs text-[#7A2F38] text-center">
                        Average completion time in minutes
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
                <div className="bg-[#FFF7ED] rounded-lg p-5 border-2 border-[#ff8c42] shadow-sm h-full flex flex-col gap-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-[#7A2F38]">Option Distribution by Question</h3>
                            <p className="text-xs text-[#7A2F38]">Active questions only</p>
                        </div>
                        {!loading && questionOptionDistributions.length > 0 && (
                            <div className="w-full lg:w-96">
                                <label htmlFor="question-distribution-select" className="sr-only">
                                    Select question
                                </label>
                                <select
                                    id="question-distribution-select"
                                    value={selectedQuestion ? String(selectedQuestion.questionId) : ''}
                                    onChange={(event) => setSelectedQuestionId(event.target.value)}
                                    className="w-full border-2 border-[#ff8c42] rounded-lg px-3 py-2 text-sm text-[#7A2F38] bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8c42] focus:border-[#ff8c42]"
                                >
                                    {questionOptionDistributions.map((question) => (
                                        <option key={question.questionId} value={question.questionId}>
                                            {question.questionText}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    {loading && (
                        <div className="text-sm text-[#7A2F38]">
                            Loading question option distribution...
                        </div>
                    )}
                    {!loading && questionOptionDistributions.length === 0 && (
                        <div className="text-sm text-[#7A2F38]">
                            No active questions configured for this event.
                        </div>
                    )}
                    {!loading && selectedQuestion && !selectedQuestion.hasOptions && (
                        <div className="text-sm text-[#7A2F38] bg-[#FFF7ED] border-2 border-[#ff8c42] rounded-lg px-4 py-3">
                            No options configured for this question yet.
                        </div>
                    )}
                    {!loading && selectedQuestion && selectedQuestion.hasOptions && selectedQuestion.totalCount === 0 && (
                        <div className="text-sm text-[#7A2F38] bg-[#FFF7ED] border-2 border-[#ff8c42] rounded-lg px-4 py-3">
                            No responses for this question yet.
                        </div>
                    )}
                    {!loading && selectedQuestion && selectedQuestion.hasOptions && selectedQuestion.totalCount > 0 && (
                        <div className="w-full flex-1 flex items-center justify-center">
                            <div className="w-full max-w-[620px] grid grid-cols-1 md:grid-cols-[1fr,260px] gap-4 md:gap-3 items-stretch">
                                <div className="flex items-center justify-center min-h-[240px]">
                                    <PieChart slices={coloredSlices} size={220} className="w-full max-w-[220px] h-auto" />
                                </div>
                                <div className="flex flex-col min-h-[240px] items-end justify-end">
                                    <div className="space-y-2 w-full max-w-[260px]">
                                        {coloredSlices.map((slice) => (
                                            <div
                                                key={slice.id}
                                                className="flex items-center gap-2 rounded-lg px-2 py-1"
                                            >
                                                <span
                                                    className="w-3 h-3 rounded-full shrink-0"
                                                    style={{ backgroundColor: slice.color }}
                                                    aria-hidden
                                                />
                                                <span className="text-sm text-[#7A2F38] truncate">{slice.label}</span>
                                            </div>
                                        ))}
                                        <div className="text-xs text-[#7A2F38] pt-2 md:text-right">
                                            Total answers considered: {selectedQuestion.totalCount}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm h-full flex flex-col gap-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-[#7A2F38] whitespace-nowrap">Booth Completion Rate</h3>
                            <p className="text-xs text-[#7A2F38]">Active booths only</p>
                        </div>
                        {!loading && (
                            <div className="w-full md:w-[420px] grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="rounded-lg border-2 border-[#ff8c42] bg-white px-3 py-2 transition-all duration-200 hover:-translate-y-1">
                                    <p className="text-[11px] uppercase tracking-wide text-[#7A2F38]">Total Participants</p>
                                    <p className="text-sm font-semibold text-[#7A2F38]">{eventEntrants}</p>
                                </div>
                                <div className="rounded-lg border-2 border-[#ff8c42] bg-white px-3 py-2 transition-all duration-200 hover:-translate-y-1">
                                    <p className="text-[11px] uppercase tracking-wide text-[#7A2F38]">Avg Completion</p>
                                    <p className="text-sm font-semibold text-[#7A2F38]">{boothCompletionAveragePct}%</p>
                                </div>
                                <div
                                    className="rounded-lg border-2 border-[#ff8c42] bg-white px-3 py-2 transition-all duration-200 hover:-translate-y-1"
                                    title={
                                        highestCompletionBooth
                                            ? `Highest completion: ${highestCompletionBooth.questTitle} (${highestCompletionBooth.completionRatePct}%)`
                                            : 'Highest completion: N/A'
                                    }
                                >
                                    <p className="text-[11px] uppercase tracking-wide text-[#7A2F38]">Highest Completion Rate</p>
                                    <p className="text-sm font-semibold text-[#7A2F38]">
                                        {highestCompletionBooth
                                            ? `${highestCompletionBooth.completionRatePct}%`
                                            : 'N/A'}
                                    </p>
                                    <p className="text-xs text-[#7A2F38] truncate">
                                        {highestCompletionBooth ? (
                                            <span className="font-semibold">{highestCompletionBooth.questTitle}</span>
                                        ) : (
                                            'No booth data'
                                        )}
                                    </p>
                                </div>
                                <div
                                    className="rounded-lg border-2 border-[#ff8c42] bg-white px-3 py-2 transition-all duration-200 hover:-translate-y-1"
                                    title={
                                        lowestCompletionBooth
                                            ? `Lowest completion: ${lowestCompletionBooth.questTitle} (${lowestCompletionBooth.completionRatePct}%)`
                                            : 'Lowest completion: N/A'
                                    }
                                >
                                    <p className="text-[11px] uppercase tracking-wide text-[#7A2F38]">Lowest Completion Rate</p>
                                    <p className="text-sm font-semibold text-[#7A2F38]">
                                        {lowestCompletionBooth
                                            ? `${lowestCompletionBooth.completionRatePct}%`
                                            : 'N/A'}
                                    </p>
                                    <p className="text-xs text-[#7A2F38] truncate">
                                        {lowestCompletionBooth ? (
                                            <span className="font-semibold">{lowestCompletionBooth.questTitle}</span>
                                        ) : (
                                            'No booth data'
                                        )}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                    {loading && (
                        <div className="text-sm text-[#7A2F38]">Loading booth completion analytics...</div>
                    )}
                    {!loading && boothCompletionRows.length === 0 && (
                        <div className="text-sm text-[#7A2F38]">No booths configured for this event.</div>
                    )}
                    {!loading && boothCompletionRows.length > 0 && eventEntrants === 0 && (
                        <div className="text-sm text-[#7A2F38] bg-white border-2 border-[#ff8c42] rounded-lg px-4 py-3">
                            No entrant devices recorded yet. Completion rates are shown as 0%.
                        </div>
                    )}
                    {!loading && boothCompletionRows.length > 0 && (
                        <div className="space-y-3">
                            {boothCompletionRows.map((row) => (
                                <div
                                    key={row.questId ?? row.questTitle}
                                    className="bg-white border-2 border-[#ff8c42] rounded-lg p-3 transition-all duration-200 hover:-translate-y-1"
                                >
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-[#7A2F38] truncate">{row.questTitle}</p>
                                            <p className="text-xs text-[#7A2F38]">
                                                {row.completedDevices} / {row.entrants} devices completed
                                            </p>
                                        </div>
                                        <div className="text-sm font-semibold text-[#7A2F38] shrink-0">
                                            {row.completionRatePct}%
                                        </div>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-[#FFEAD9] overflow-hidden">
                                        <div
                                            className="h-full bg-[#ff8c42] transition-[width] duration-300"
                                            style={{ width: `${row.completionRatePct}%` }}
                                            aria-hidden
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {/* Performance Metrics */}
            <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm">
                <h3 className="text-lg font-semibold mb-4 text-[#7A2F38]">Performance Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-[#FFF7ED] border-2 border-[#ff8c42] rounded-lg">
                        <div className="text-2xl font-bold text-[#7A2F38]">
                            {loading ? '...' : formatDurationMinutes(data.completionTime.averageMinutes)}
                        </div>
                        <div className="text-sm text-[#7A2F38]">Avg Completion Time</div>
                    </div>
                    <div className="text-center p-4 bg-[#FFF7ED] border-2 border-[#ff8c42] rounded-lg">
                        <div className="text-2xl font-bold text-[#8bcc5e]">
                            {loading ? '...' : `${data.responseRate}%`}
                        </div>
                        <div className="text-sm text-[#7A2F38]">Response Rate</div>
                    </div>
                    <div className="text-center p-4 bg-[#FFF7ED] border-2 border-[#ff8c42] rounded-lg">
                        <div className="text-2xl font-bold text-[#ffaa00]">
                            {loading ? '...' : `${data.quality.skipRatePct}%`}
                        </div>
                        <div className="text-sm text-[#7A2F38]">Drop-off Rate</div>
                    </div>
                    <div className="text-center p-4 bg-[#FFF7ED] border-2 border-[#ff8c42] rounded-lg">
                        <div className="text-2xl font-bold text-[#7A2F38]">
                            {loading ? '...' : `${data.quality.qualityScorePct}%`}
                        </div>
                        <div className="text-sm text-[#7A2F38]">Quality Score</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
