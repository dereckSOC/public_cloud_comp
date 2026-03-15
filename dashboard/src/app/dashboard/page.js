"use client";
export const dynamic = "force-dynamic";
import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useState, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { signOutCurrentUser } from '@psd/shared/lib/authClient';
import { useAuth } from './hooks/useAuth';
import { useAnalytics } from './hooks/useAnalytics';
import OverviewTab from './components/OverviewTab';
import AnalyticsTab from './components/AnalyticsTab';
import EventSettings from './components/EventSettings';
import QuestionsTab from './components/QuestionsTab';
import QuestsTab from './components/QuestsTab';
import ResponsesTab from './components/ResponsesTab';

function DashboardContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const rawEventId = searchParams.get('eventId');
    const queryString = rawEventId ? `?eventId=${encodeURIComponent(rawEventId)}` : '';
    const activeEventId = useMemo(() => {
        const n = Number(rawEventId);
        return Number.isFinite(n) ? n : null;
    }, [rawEventId]);
    const activeEventName = useMemo(() => {
        const name = searchParams.get('eventName');
        return name || rawEventId || 'All events';
    }, [searchParams, rawEventId]);
    const [activeTab, setActiveTab] = useState('overview');
    const [questionFilter, setQuestionFilter] = useState({ id: null, text: '' });
    const [isSigningOut, setIsSigningOut] = useState(false);

    const { authLoading, userRole, userEmail } = useAuth(activeEventId, pathname);
    const analyticsState = useAnalytics(activeEventId, authLoading);

    const handleSignOut = async () => {
        setIsSigningOut(true);
        try {
            await signOutCurrentUser();
        } catch (signOutError) {
        } finally {
            router.replace('/login');
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-[#7A2F38] text-xl font-semibold">Checking access...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-[#7A2F38]">
            {/* Header */}
            <header className="bg-[#FFF7ED] px-6 py-3 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <Image
                            src="/images/SCS-logo.png"
                            alt="SCS logo"
                            width={64}
                            height={64}
                            className="w-16 h-16 object-contain"
                        />
                        <div>
                            <h1 className="text-xl font-semibold text-[#7A2F38]">
                                <span className="font-semibold text-[#7A2F38]">{activeEventName}</span>
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-[#7A2F38]">
                            {userEmail || 'User'} {userRole ? `(${userRole})` : ''}
                        </span>
                        <Link
                            href={`/events${queryString}`}
                            className="bg-[#ff8c42] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#ff6b1a] transition-colors shadow-sm text-sm"
                        >
                            Back to Events
                        </Link>
                        <button
                            type="button"
                            onClick={handleSignOut}
                            disabled={isSigningOut}
                            className="cursor-pointer bg-white border-2 border-[#ff8c42] text-[#7A2F38] px-4 py-2 rounded-lg font-medium hover:bg-[#FFF7ED] transition-colors shadow-sm text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isSigningOut ? 'Signing out...' : 'Sign out'}
                        </button>
                    </div>
                </div>
            </header>
            {/* Navigation Tabs */}
            <nav className="bg-[#FFF7ED] px-6 py-2 border-b-2 border-[#ff8c42]">
                <div className="flex space-x-8">
                    {['overview', 'questions', 'quests', 'responses', 'analytics', 'event settings'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border border-transparent transition-colors ${activeTab === tab
                                ? 'bg-[#ff8c42] text-white border-[#ff8c42]'
                                : 'text-[#7A2F38] hover:text-[#7A2F38] hover:bg-white hover:border-[#ff8c42]'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </nav>
            {/* Main Content */}
            <main className="p-6">
                {activeTab === 'overview' && (
                    <OverviewTab
                        data={analyticsState.data}
                        loading={analyticsState.loading}
                        error={analyticsState.error}
                    />
                )}
                {activeTab === 'questions' && (
                    <QuestionsTab
                        eventId={activeEventId}
                        userRole={userRole}
                        onViewResponses={(question) => {
                            setQuestionFilter({ id: question.id, text: question.question_text });
                            setActiveTab('responses');
                        }}
                    />
                )}
                {activeTab === 'quests' && (
                    <QuestsTab eventId={activeEventId} userRole={userRole} />
                )}
                {activeTab === 'responses' && (
                    <ResponsesTab
                        eventId={activeEventId}
                        eventName={activeEventName}
                        data={analyticsState.data}
                        loading={analyticsState.loading}
                        error={analyticsState.error}
                        questionFilter={questionFilter}
                        onClearFilter={() => setQuestionFilter({ id: null, text: '' })}
                    />
                )}
                {activeTab === 'analytics' && (
                    <AnalyticsTab
                        data={analyticsState.data}
                        loading={analyticsState.loading}
                        error={analyticsState.error}
                    />
                )}
                {activeTab === 'event settings' && <EventSettings eventId={activeEventId} userRole={userRole} />}
            </main>
        </div>
    );
}

export default function ClientDashboard() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-[#7A2F38] text-xl font-semibold">Loading dashboard...</div>
            </div>
        }>
            <DashboardContent />
        </Suspense>
    );
}
