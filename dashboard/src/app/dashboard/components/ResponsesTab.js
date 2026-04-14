"use client";
import { useState } from 'react';
import { formatDurationMinutes, getSubmissionMetrics, getOutcomeSummary } from '../utils/analyticsCalculations';

export default function ResponsesTab({ eventId, eventName, data, loading, error, questionFilter, onClearFilter }) {
    const [exporting, setExporting] = useState(false);
    const submissionMetrics = getSubmissionMetrics(data);
    const outcomeSummary = getOutcomeSummary(data);
    const latestActivityLabel = data.recentActivity?.[0]?.time || 'No recent activity';
    const filteredResponses = questionFilter?.id
        ? data.recentResponses.filter((response) => response.questionId === questionFilter.id)
        : data.recentResponses;
    const toCsv = (rows) => {
        if (!rows || rows.length === 0) return '';
        const headers = Object.keys(rows[0]);
        const escapeCsv = (value) => {
            if (value === null || value === undefined) return '';
            const str = String(value);
            if (str.includes('"') || str.includes(',') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };
        const lines = [
            headers.join(','),
            ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(','))
        ];
        return lines.join('\n');
    };

    const downloadCsv = (filename, rows) => {
        const csv = toCsv(rows);
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const handleExportResponses = async () => {
        if (!eventId) return;
        setExporting(true);
        try {
            const res = await fetch(`/api/feedback/responses?eventId=${eventId}`);
            const body = await res.json();
            if (!res.ok) throw new Error(body?.error || 'Could not export responses.');

            const exportRows = (body.rows ?? []).map((row) => ({
                ...row,
                event_name: eventName || '',
            }));

            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            downloadCsv(`event-${eventId}-responses-${stamp}.csv`, exportRows);
        } catch (exportError) {
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-[#7A2F38]">Response Analysis</h2>
                <div className="flex space-x-2">
                    <button
                        type="button"
                        onClick={handleExportResponses}
                        disabled={exporting || loading || !eventId}
                        className="bg-white text-[#7A2F38] px-4 py-2 rounded-lg border-2 border-[#ff8c42] hover:bg-white transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {exporting ? 'Exporting...' : 'Export Data'}
                    </button>
                    <button className="bg-[#ff8c42] text-white px-4 py-2 rounded-lg hover:bg-[#ff6b1a] transition-colors shadow-sm">
                        Filter Responses
                    </button>
                </div>
            </div>
            {questionFilter?.id && (
                <div className="flex items-center justify-between bg-[#FFF7ED] border-2 border-[#ff8c42] rounded-lg px-4 py-3 shadow-sm">
                    <div className="text-sm text-[#7A2F38]">
                        Showing responses for: <span className="font-semibold">{questionFilter.text}</span>
                    </div>
                    <button
                        type="button"
                        onClick={onClearFilter}
                        className="text-xs text-[#7A2F38] hover:text-[#7A2F38] border-2 border-[#ff8c42] px-3 py-1 rounded-full"
                    >
                        Clear filter
                    </button>
                </div>
            )}
            {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {error}
                </div>
            )}
            {/* Response Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm">
                    <h3 className="text-lg font-semibold mb-4 text-[#7A2F38]">Submission Summary</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-[#7A2F38]">Total Submissions</span>
                            <span className="font-semibold text-[#8bcc5e]">
                                {loading ? '...' : data.totalResponses}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-[#7A2F38]">Answers Captured</span>
                            <span className="font-semibold text-[#7A2F38]">
                                {loading ? '...' : submissionMetrics.answersCaptured}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-[#7A2F38]">Avg Answers / Submission</span>
                            <span className="font-semibold text-[#ffaa00]">
                                {loading
                                    ? '...'
                                    : `${submissionMetrics.averageAnswersPerSubmissionLabel} of ${data.totalQuestions}`}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-[#7A2F38]">Latest Activity</span>
                            <span className="font-semibold text-[#7A2F38]">
                                {loading ? '...' : latestActivityLabel}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm">
                    <h3 className="text-lg font-semibold mb-4 text-[#7A2F38]">Completion Times</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-[#7A2F38]">Average</span>
                            <span className="font-semibold text-[#7A2F38]">
                                {loading ? '...' : formatDurationMinutes(data.completionTime.averageMinutes)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-[#7A2F38]">Fastest</span>
                            <span className="font-semibold text-[#8bcc5e]">
                                {loading ? '...' : formatDurationMinutes(data.completionTime.fastestMinutes)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-[#7A2F38]">Slowest</span>
                            <span className="font-semibold text-[#e74c3c]">
                                {loading ? '...' : formatDurationMinutes(data.completionTime.slowestMinutes)}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm">
                    <h3 className="text-lg font-semibold mb-4 text-[#7A2F38]">Outcome Summary</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-[#7A2F38]">Cell A Selections</span>
                            <span className="font-semibold text-[#8bcc5e]">
                                {loading ? '...' : outcomeSummary.cellASelections}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-[#7A2F38]">Cell B Selections</span>
                            <span className="font-semibold text-[#ffaa00]">
                                {loading ? '...' : outcomeSummary.cellBSelections}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-[#7A2F38]">Dominant Choice</span>
                            <span className="font-semibold text-[#7A2F38]">
                                {loading
                                    ? '...'
                                    : outcomeSummary.dominantChoice === 'Cell A' || outcomeSummary.dominantChoice === 'Cell B'
                                        ? `${outcomeSummary.dominantChoice} (${outcomeSummary.dominantPct}%)`
                                        : outcomeSummary.dominantChoice}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            {/* Recent Responses */}
            <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm">
                <h3 className="text-lg font-semibold mb-4 text-[#7A2F38]">Recent Responses</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b-2 border-[#ff8c42]">
                                <th className="text-left py-3 px-4 text-[#7A2F38]">Response ID</th>
                                <th className="text-left py-3 px-4 text-[#7A2F38]">Question</th>
                                <th className="text-left py-3 px-4 text-[#7A2F38]">Response</th>
                                <th className="text-left py-3 px-4 text-[#7A2F38]">Time Taken</th>
                                <th className="text-left py-3 px-4 text-[#7A2F38]">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td className="py-4 px-4 text-sm text-[#7A2F38]" colSpan="5">
                                        Loading responses...
                                    </td>
                                </tr>
                            )}
                            {!loading && filteredResponses.length === 0 && (
                                <tr>
                                    <td className="py-4 px-4 text-sm text-[#7A2F38]" colSpan="5">
                                        No responses yet.
                                    </td>
                                </tr>
                            )}
                            {!loading && filteredResponses.map((response) => (
                                <tr key={response.answerId ?? `${response.responseId}-${response.createdAt}`} className="border-b-2 border-[#ff8c42]">
                                    <td className="py-3 px-4 text-[#7A2F38]">#{response.responseId}</td>
                                    <td className="py-3 px-4 text-[#7A2F38]">{response.questionText}</td>
                                    <td className="py-3 px-4 text-[#7A2F38] max-w-xs truncate">{response.answerText}</td>
                                    <td className="py-3 px-4 text-[#7A2F38]">{response.durationLabel}</td>
                                    <td className="py-3 px-4 text-[#7A2F38]">{response.timeAgo}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
