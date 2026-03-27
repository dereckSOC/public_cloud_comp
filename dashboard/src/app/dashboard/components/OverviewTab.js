import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import StatCard from './StatCard';

export default function OverviewTab({ data, loading, error }) {
    const [qrUrl, setQrUrl] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [qrLoading, setQrLoading] = useState(false);
    const [qrError, setQrError] = useState(null);
    const modalRef = useRef(null);

    const searchParams = useSearchParams();
    const eventId = searchParams.get('eventId');
    const eventName = searchParams.get('eventName');

    useEffect(() => {
        if (!eventId) return;
        const targetUrl = `http://gamified-feedback.eastasia.cloudapp.azure.com/?eventId=${eventId}&lang=en`;
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}&format=png`;
        setQrUrl(url);
    }, [eventId]);

    useEffect(() => {
        function handleClickOutside(e) {
            if (modalRef.current && !modalRef.current.contains(e.target)) {
                setShowModal(false);
            }
        }
        if (showModal) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showModal]);

    useEffect(() => {
        function handleEsc(e) {
            if (e.key === 'Escape') setShowModal(false);
        }
        if (showModal) document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [showModal]);

    const handleGenerate = async () => {
        if (!eventId) return;
        setQrLoading(true);
        setQrError(null);

        try {
            const targetUrl = `http://gamified-feedback.eastasia.cloudapp.azure.com/?eventId=${eventId}&lang=en`;
            const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}&format=png`;

            await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = resolve;
                img.onerror = reject;
                img.src = url;
            });

            setQrUrl(url);
            setShowModal(true);
        } catch (err) {
            setQrError('Failed to generate QR code. Please try again.');
        } finally {
            setQrLoading(false);
        }
    };

    const handleDownload = async () => {
        try {
            const response = await fetch(qrUrl);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `qr-event-${eventId}.png`;
            a.click();
            URL.revokeObjectURL(blobUrl);
        } catch {
            window.open(qrUrl, '_blank');
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold mb-2 text-[#7A2F38]">Dashboard Overview</h2>
                    <p className="text-[#7A2F38]">Monitor your questions, responses, and completion metrics.</p>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <button
                        onClick={qrUrl ? () => setShowModal(true) : handleGenerate}
                        disabled={!eventId || qrLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-[#ff8c42] text-white font-semibold rounded-lg shadow-sm hover:bg-[#e07a35] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                        {qrLoading
                            ? 'sGenerating...'
                            : qrUrl
                                ? 'View QR Code'
                                : 'Generate QR Code'}
                    </button>
                    {qrError && <p className="text-xs text-red-500">{qrError}</p>}
                </div>
            </div>
            {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {error}
                </div>
            )}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div
                        ref={modalRef}
                        className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-5 w-[340px] relative"
                    >
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-3 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
                        >
                            ✕
                        </button>

                        <h3 className="text-lg font-bold text-[#7A2F38]">Event QR Code</h3>
                        {eventName && (
                            <p className="text-sm text-[#7A2F38] -mt-3 text-center">{decodeURIComponent(eventName)}</p>
                        )}

                        <div className="border-2 border-[#ff8c42] rounded-xl p-3 bg-[#FFF7ED]">
                            <img
                                src={qrUrl}
                                alt={`QR Code for event ${eventId}`}
                                className="w-52 h-52"
                            />
                        </div>

                        <p className="text-xs text-gray-400 font-mono text-center break-all px-2">
                            Event ID: {eventId}
                        </p>

                        {/* Download button */}
                        <button
                            onClick={handleDownload}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#7A2F38] text-white font-semibold rounded-lg hover:bg-[#6a2832] transition-colors text-sm"
                        >
                            Download QR Code
                        </button>

                        <button
                            onClick={() => setShowModal(false)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-[#ff8c42] text-[#7A2F38] font-semibold rounded-lg hover:bg-[#FFF0E5] transition-colors text-sm"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Questions"
                    value={loading ? '...' : String(data.totalQuestions)}
                    icon="Questions"
                    color="purple"
                />
                <StatCard
                    title="Total Responses"
                    value={loading ? '...' : String(data.totalResponses)}
                    icon="Responses"
                    color="orange"
                />
                <StatCard
                    title="Response Rate"
                    value={loading ? '...' : `${data.responseRate}%`}
                    icon="Rate"
                    color="green"
                />
                <StatCard
                    title="Avg Completion Time"
                    value={loading ? '...' : data.avgCompletionLabel}
                    icon="Completion Time"
                    color="purple"
                />
            </div>
            {/* Recent Activity */}
            <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm">
                <h3 className="text-lg font-semibold mb-4 text-[#7A2F38]">Recent Activity</h3>
                <div className="space-y-3">
                    {(data.recentActivity.length > 0 ? data.recentActivity : [
                        { action: 'No recent activity yet.', time: '' }
                    ]).map((activity, index) => (
                        <div key={index} className="flex items-center justify-between py-2 border-b-2 border-[#ff8c42] last:border-b-0">
                            <div className="flex items-center space-x-3">
                                <div className="w-2 h-2 bg-[#ff8c42] rounded-full"></div>
                                <span className="text-sm text-[#7A2F38]">{activity.action}</span>
                            </div>
                            <span className="text-xs text-[#7A2F38]">{activity.time}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}