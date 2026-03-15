"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJsonWithAdminAuth } from '@/app/lib/apiClient';

export default function EventSettings({ eventId, userRole }) {
    const router = useRouter();
    const [deleting, setDeleting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [nameState, setNameState] = useState({ value: '', saving: false });
    const [locationState, setLocationState] = useState({ value: '', saving: false });
    const [dateState, setDateState] = useState({ start_date: '', end_date: '', saving: false });
    const [statusState, setStatusState] = useState({ value: true, saving: false });
    const [storyModeState, setStoryModeState] = useState({ value: true, saving: false });
    const [toast, setToast] = useState(null);
    const [editConfirm, setEditConfirm] = useState({ open: false, label: '', action: null });

    const showToast = (message, variant = 'info') => {
        setToast({ message, variant });
        setTimeout(() => setToast(null), 3200);
    };

    const requestEditConfirm = (label, action) => {
        setEditConfirm({ open: true, label, action });
    };

    const confirmEdit = async () => {
        if (editConfirm.action) {
            await editConfirm.action();
        }
        setEditConfirm({ open: false, label: '', action: null });
    };

    const cancelEditConfirm = () => {
        setEditConfirm({ open: false, label: '', action: null });
    };

    const requireEventSelected = () => {
        if (!eventId || eventId === 'All events') {
            showToast('No event selected.', 'error');
            return false;
        }
        return true;
    };

    const getApiErrorMessage = (body, fallback) => {
        const detail = typeof body?.error === 'string' ? body.error.trim() : '';
        return detail || fallback;
    };

    useEffect(() => {
        const fetchEvent = async () => {
            if (!eventId || eventId === 'All events') return;
            const { response, body } = await fetchJsonWithAdminAuth(`/api/events?eventId=${eventId}`);
            if (!response.ok) {
                showToast('Could not load event details.', 'error');
                return;
            }
            const data = body.event;
            setNameState((prev) => ({ ...prev, value: data?.name || '' }));
            setLocationState((prev) => ({ ...prev, value: data?.location || '' }));
            setDateState((prev) => ({
                ...prev,
                start_date: data?.start_date || '',
                end_date: data?.end_date || ''
            }));
            setStatusState((prev) => ({ ...prev, value: data?.is_active ?? false }));
            setStoryModeState((prev) => ({ ...prev, value: data?.story_mode_enabled !== false }));
        };
        fetchEvent();
    }, [eventId]);

    const saveName = async () => {
        if (!requireEventSelected()) return;
        const trimmed = nameState.value.trim();
        if (!trimmed) {
            showToast('Event name cannot be empty.', 'error');
            return;
        }
        setNameState((prev) => ({ ...prev, saving: true }));
        const { response, body } = await fetchJsonWithAdminAuth(`/api/events/${eventId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: trimmed }),
        });
        if (!response.ok) {
            showToast(getApiErrorMessage(body, 'Could not update event name.'), 'error');
        } else {
            showToast('Event name updated.', 'success');
        }
        setNameState((prev) => ({ ...prev, saving: false }));
    };

    const saveLocation = async () => {
        if (!requireEventSelected()) return;
        const trimmed = locationState.value.trim();
        if (!trimmed) {
            showToast('Location cannot be empty.', 'error');
            return;
        }
        setLocationState((prev) => ({ ...prev, saving: true }));
        const { response, body } = await fetchJsonWithAdminAuth(`/api/events/${eventId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location: trimmed }),
        });
        if (!response.ok) {
            showToast(getApiErrorMessage(body, 'Could not update location.'), 'error');
        } else {
            showToast('Event location updated.', 'success');
        }
        setLocationState((prev) => ({ ...prev, saving: false }));
    };

    const saveDates = async () => {
        if (!requireEventSelected()) return;
        if (!dateState.start_date || !dateState.end_date) {
            showToast('Start and end dates are required.', 'error');
            return;
        }
        const start = new Date(dateState.start_date);
        const end = new Date(dateState.end_date);
        if (end < start) {
            showToast('End date cannot be before start date.', 'error');
            return;
        }
        setDateState((prev) => ({ ...prev, saving: true }));
        const { response, body } = await fetchJsonWithAdminAuth(`/api/events/${eventId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                start_date: dateState.start_date || null,
                end_date: dateState.end_date || null
            }),
        });
        if (!response.ok) {
            showToast(getApiErrorMessage(body, 'Could not update dates.'), 'error');
        } else {
            showToast('Event dates updated.', 'success');
        }
        setDateState((prev) => ({ ...prev, saving: false }));
    };

    const saveStatus = async (nextValue) => {
        if (!requireEventSelected()) return;
        setStatusState((prev) => ({ ...prev, saving: true }));
        const { response, body } = await fetchJsonWithAdminAuth(`/api/events/${eventId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: nextValue }),
        });
        if (!response.ok) {
            showToast(getApiErrorMessage(body, 'Could not update status.'), 'error');
        } else {
            setStatusState((prev) => ({ ...prev, value: nextValue }));
            showToast(`Event ${nextValue ? 'activated' : 'deactivated'}.`, 'success');
        }
        setStatusState((prev) => ({ ...prev, saving: false }));
    };

    const handleStatusToggle = () => {
        const nextValue = !statusState.value;
        requestEditConfirm(
            `Set event ${nextValue ? 'active' : 'inactive'}?`,
            () => saveStatus(nextValue)
        );
    };

    const saveStoryMode = async (nextValue) => {
        if (!requireEventSelected()) return;
        setStoryModeState((prev) => ({ ...prev, saving: true }));
        const { response, body } = await fetchJsonWithAdminAuth(`/api/events/${eventId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ story_mode_enabled: nextValue }),
        });
        const savedStoryMode = body.event?.story_mode_enabled;
        if (!response.ok) {
            showToast(getApiErrorMessage(body, 'Could not update story mode.'), 'error');
        } else if (savedStoryMode !== nextValue) {
            showToast('Story mode update could not be confirmed.', 'error');
        } else {
            setStoryModeState((prev) => ({ ...prev, value: nextValue }));
            showToast(`Story mode ${nextValue ? 'enabled' : 'disabled'}.`, 'success');
        }
        setStoryModeState((prev) => ({ ...prev, saving: false }));
    };

    const handleStoryModeToggle = () => {
        const nextValue = !storyModeState.value;
        requestEditConfirm(`Set story mode ${nextValue ? 'on' : 'off'}?`, () => saveStoryMode(nextValue));
    };

    const handleDelete = async () => {
        if (userRole !== 'superadmin') {
            showToast('Only superadmin can delete events.', 'error');
            return;
        }
        if (!requireEventSelected()) return;
        setShowConfirm(true);
    };

    const confirmDelete = async () => {
        setDeleting(true);
        const { response, body } = await fetchJsonWithAdminAuth(`/api/events/${eventId}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            showToast(getApiErrorMessage(body, 'Could not delete event. Please try again.'), 'error');
            setDeleting(false);
            setShowConfirm(false);
            return;
        }
        showToast('Event deleted.', 'success');
        router.push('/events');
    };

    const cancelDelete = () => {
        setShowConfirm(false);
    };

    return (
        <div className="space-y-4">
            {toast && (
                <div className="fixed top-4 right-4 z-50">
                    <div
                        className={`px-4 py-3 rounded-lg shadow-lg text-sm text-white ${
                            toast.variant === 'error'
                                ? 'bg-red-600'
                                : toast.variant === 'success'
                                    ? 'bg-green-600'
                                    : 'bg-white border-2 border-[#ff8c42] text-[#7A2F38]'
                        }`}
                    >
                        {toast.message}
                    </div>
                </div>
            )}
            <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm space-y-3">
                <h2 className="text-lg font-bold text-[#7A2F38]">Rename Event</h2>
                <input
                    type="text"
                    value={nameState.value}
                    onChange={(e) => setNameState((prev) => ({ ...prev, value: e.target.value }))}
                    className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-sm text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42]"
                    placeholder="Event name"
                />
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => requestEditConfirm('Save event name?', saveName)}
                        disabled={nameState.saving}
                        className="bg-[#ff8c42] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#ff6b1a] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {nameState.saving ? 'Saving…' : 'Edit name'}
                    </button>
                </div>
            </div>
            <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm space-y-3">
                <h2 className="text-lg font-bold text-[#7A2F38]">Update Location</h2>
                <input
                    type="text"
                    value={locationState.value}
                    onChange={(e) => setLocationState((prev) => ({ ...prev, value: e.target.value }))}
                    className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-sm text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42]"
                    placeholder="Location"
                />
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => requestEditConfirm('Save event location?', saveLocation)}
                        disabled={locationState.saving}
                        className="bg-[#ff8c42] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#ff6b1a] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {locationState.saving ? 'Saving…' : 'Edit location'}
                    </button>
                </div>
            </div>
            <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm space-y-3">
                <h2 className="text-lg font-bold text-[#7A2F38]">Update Dates</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-[#7A2F38] mb-1" htmlFor="event-start">
                            Start date
                        </label>
                        <input
                            id="event-start"
                            type="date"
                            value={dateState.start_date || ''}
                            onChange={(e) => setDateState((prev) => ({ ...prev, start_date: e.target.value }))}
                            className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-sm text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42]"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#7A2F38] mb-1" htmlFor="event-end">
                            End date
                        </label>
                        <input
                            id="event-end"
                            type="date"
                            value={dateState.end_date || ''}
                            onChange={(e) => setDateState((prev) => ({ ...prev, end_date: e.target.value }))}
                            className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-sm text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42]"
                        />
                    </div>
                </div>
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => requestEditConfirm('Save event dates?', saveDates)}
                        disabled={dateState.saving}
                        className="bg-[#ff8c42] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#ff6b1a] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {dateState.saving ? 'Saving…' : 'Edit dates'}
                    </button>
                </div>
            </div>
            <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm space-y-4">
                <h2 className="text-lg font-bold text-[#7A2F38]">Event Status</h2>
                <div className="flex items-center justify-between">
                    <div className="text-sm text-[#7A2F38]">
                        {statusState.value ? 'Active (Feedback Form Open)' : 'Inactive (Feedback Form Closed)'}
                    </div>
                    <button
                        type="button"
                        onClick={handleStatusToggle}
                        className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                            statusState.value ? 'bg-[#ff8c42]' : 'bg-white border-2 border-[#ff8c42]'
                        }`}
                        disabled={statusState.saving}
                        aria-pressed={statusState.value}
                        aria-label="Toggle event status"
                    >
                        <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                statusState.value ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                    </button>
                </div>
            </div>
            {userRole === 'superadmin' && (
            <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm space-y-4">
                <h2 className="text-lg font-bold text-[#7A2F38]">Story Mode</h2>
                <div className="flex items-center justify-between">
                    <div className="text-sm text-[#7A2F38]">
                        {storyModeState.value ? 'On (Intro and ending slides enabled)' : 'Off (Direct feedback flow, no story slides)'}
                    </div>
                    <button
                        type="button"
                        onClick={handleStoryModeToggle}
                        className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                            storyModeState.value ? 'bg-[#ff8c42]' : 'bg-white border-2 border-[#ff8c42]'
                        }`}
                        disabled={storyModeState.saving}
                        aria-pressed={storyModeState.value}
                        aria-label="Toggle story mode"
                    >
                        <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                storyModeState.value ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                    </button>
                </div>
            </div>
            )}
            {userRole === 'superadmin' && <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h2 className="text-lg font-bold text-[#7A2F38]">Delete Event</h2>
                        <p className="text-sm text-[#7A2F38]">Danger zone: delete this event and its data.</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {deleting ? 'Deleting…' : 'Delete Event'}
                </button>
            </div>}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-[#FFF7ED] rounded-lg p-6 shadow-lg w-full max-w-md border-2 border-[#ff8c42]">
                        <h3 className="text-lg font-semibold text-[#7A2F38] mb-2">Delete this event?</h3>
                        <p className="text-sm text-[#7A2F38] mb-4">
                            This will remove the event and its related data. This action cannot be undone.
                        </p>
                        <div className="flex items-center justify-end space-x-3">
                            <button
                                type="button"
                                onClick={cancelDelete}
                                className="text-sm text-[#7A2F38] hover:text-[#7A2F38]"
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                disabled={deleting}
                                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {deleting ? 'Deleting…' : 'Yes, delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {editConfirm.open && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-[#FFF7ED] rounded-lg p-6 shadow-lg w-full max-w-md border-2 border-[#ff8c42]">
                        <h3 className="text-lg font-semibold text-[#7A2F38] mb-2">Confirm changes</h3>
                        <p className="text-sm text-[#7A2F38] mb-4">{editConfirm.label}</p>
                        <div className="flex items-center justify-end space-x-3">
                            <button
                                type="button"
                                onClick={cancelEditConfirm}
                                className="text-sm text-[#7A2F38] hover:text-[#7A2F38]"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmEdit}
                                className="bg-[#ff8c42] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#ff6b1a] transition-colors"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
