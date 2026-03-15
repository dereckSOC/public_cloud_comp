"use client";
import { useEffect, useState } from 'react';
import { fetchJsonWithAdminAuth } from '@/app/lib/apiClient';

const PIN_PATTERN = /^\d{1,6}$/;

function EyeIcon({ className = 'h-4 w-4' }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.5 12c1.8-3.6 5.2-6 9.5-6s7.7 2.4 9.5 6c-1.8 3.6-5.2 6-9.5 6s-7.7-2.4-9.5-6Z"
            />
            <circle cx="12" cy="12" r="3.2" />
        </svg>
    );
}

function EyeOffIcon({ className = 'h-4 w-4' }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
        >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.9 4.7A10.5 10.5 0 0 1 12 4.5c4.3 0 7.7 2.4 9.5 6a11 11 0 0 1-3.1 3.9"
            />
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.2 7.2A11 11 0 0 0 2.5 12c1.8 3.6 5.2 6 9.5 6 1.3 0 2.6-.2 3.7-.7"
            />
        </svg>
    );
}

export default function QuestsTab({ eventId, userRole }) {
    const [quests, setQuests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [togglingId, setTogglingId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [showPinId, setShowPinId] = useState(null);
    const [editForm, setEditForm] = useState({ title: '', description: '', pin: '', saving: false });
    const [creating, setCreating] = useState(false);
    const [createForm, setCreateForm] = useState({ title: '', description: '', pin: '', saving: false });
    const [showCreatePin, setShowCreatePin] = useState(false);
    const [confirmModal, setConfirmModal] = useState({ open: false, label: '', action: null, busy: false });

    const getApiErrorMessage = (body, fallback) => {
        const detail = typeof body?.error === 'string' ? body.error.trim() : '';
        return detail || fallback;
    };

    useEffect(() => {
        const fetchQuests = async () => {
            if (!eventId) {
                setError('No event selected. Pick an event to view its quests.');
                setQuests([]);
                setLoading(false);
                return;
            }
            setLoading(true);
            setError('');
            try {
                const { response, body } = await fetchJsonWithAdminAuth(`/api/quests?eventId=${eventId}`);
                if (!response.ok) {
                    throw new Error(getApiErrorMessage(body, 'Could not load quests for this event.'));
                }
                setQuests(body.quests ?? []);
            } catch (fetchError) {
                setError(fetchError.message || 'Could not load quests for this event.');
                setQuests([]);
            }
            setLoading(false);
        };
        fetchQuests();
    }, [eventId]);

    const handleToggleQuest = async (questId, currentStatus) => {
        if (!eventId) return;
        const nextStatus = !currentStatus;
        const questToToggle = quests.find((q) => q.id === questId);
        const pinValue = (questToToggle?.pin || '').trim();

        if (nextStatus && !PIN_PATTERN.test(pinValue)) {
            setError('Set a valid PIN (1-6 digits) before activating this quest.');
            return;
        }

        setTogglingId(questId);
        const { response, body } = await fetchJsonWithAdminAuth(`/api/quests/${questId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: nextStatus }),
        });
        if (!response.ok) {
            setError(getApiErrorMessage(body, 'Could not update quest status.'));
        } else {
            setQuests((prev) =>
                prev.map((q) =>
                    q.id === questId ? { ...q, ...body.quest, is_active: body.quest?.is_active ?? !currentStatus } : q
                )
            );
            setError('');
        }
        setTogglingId(null);
    };

    const startEdit = (quest) => {
        setEditingId(quest.id);
        setShowPinId(null);
        setEditForm({
            title: quest.title ?? '',
            description: quest.description ?? '',
            pin: quest.pin ?? '',
            saving: false
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setError('');
    };

    const saveEdit = async () => {
        if (!editingId || !eventId) return;
        const trimmedTitle = editForm.title.trim();
        if (!trimmedTitle) {
            setError('Quest title cannot be empty.');
            return;
        }
        const questToEdit = quests.find((q) => q.id === editingId);
        const pinValue = editForm.pin.trim();
        if (pinValue && !PIN_PATTERN.test(pinValue)) {
            setError('PIN must be up to 6 digits.');
            return;
        }
        if (!pinValue && questToEdit?.is_active !== false) {
            setError('Active quests require a PIN.');
            return;
        }
        setEditForm((prev) => ({ ...prev, saving: true }));
        const { response, body } = await fetchJsonWithAdminAuth(`/api/quests/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: trimmedTitle,
                description: editForm.description.trim(),
                pin: pinValue || null
            }),
        });
        if (!response.ok) {
            setError(getApiErrorMessage(body, 'Could not save quest changes.'));
        } else if (body.quest) {
            setQuests((prev) =>
                prev.map((q) => (q.id === editingId ? { ...q, ...body.quest } : q))
            );
            setError('');
            setEditingId(null);
        }
        setEditForm((prev) => ({ ...prev, saving: false }));
    };

    const deleteQuest = async (questId) => {
        if (!eventId || !questId) return;
        setDeletingId(questId);
        const { response, body } = await fetchJsonWithAdminAuth(`/api/quests/${questId}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            setError(getApiErrorMessage(body, 'Could not delete quest.'));
        } else {
            setQuests((prev) => prev.filter((q) => q.id !== questId));
            if (editingId === questId) setEditingId(null);
        }
        setDeletingId(null);
    };

    const requestConfirm = (label, action) => {
        setConfirmModal({ open: true, label, action, busy: false });
    };

    const confirmAction = async () => {
        if (!confirmModal.action) {
            setConfirmModal({ open: false, label: '', action: null, busy: false });
            return;
        }
        setConfirmModal((prev) => ({ ...prev, busy: true }));
        await confirmModal.action();
        setConfirmModal({ open: false, label: '', action: null, busy: false });
    };

    const cancelConfirm = () => {
        setConfirmModal({ open: false, label: '', action: null, busy: false });
    };

    const saveNewQuest = async () => {
        if (!eventId) {
            setError('No event selected. Pick an event to add quests.');
            return;
        }
        const trimmedTitle = createForm.title.trim();
        if (!trimmedTitle) {
            setError('Quest title cannot be empty.');
            return;
        }
        const pinValue = createForm.pin.trim();
        if (!pinValue) {
            setError('PIN is required.');
            return;
        }
        if (!PIN_PATTERN.test(pinValue)) {
            setError('PIN must be up to 6 digits.');
            return;
        }
        setError('');
        setCreateForm((prev) => ({ ...prev, saving: true }));
        const { response, body } = await fetchJsonWithAdminAuth('/api/quests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                eventId,
                title: trimmedTitle,
                description: createForm.description.trim(),
                pin: pinValue,
                isActive: true
            }),
        });
        if (!response.ok) {
            setError(getApiErrorMessage(body, 'Could not create quest.'));
        } else if (body.quest) {
            setQuests((prev) => [...prev, body.quest]);
            setCreateForm({ title: '', description: '', pin: '', saving: false });
            setShowCreatePin(false);
            setCreating(false);
        }
        setCreateForm((prev) => ({ ...prev, saving: false }));
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-[#7A2F38]">Quests</h2>
                    <p className="text-sm text-[#7A2F38] mt-1">
                        Manage quests for this event. Each quest can have a unique PIN that participants enter at the booth.
                    </p>
                </div>
                <button
                    type="button"
                    className="bg-[#ff8c42] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#ff6b1a] transition-colors shadow-sm"
                    onClick={() => {
                        setCreating((prev) => !prev);
                        setError('');
                        setCreateForm({ title: '', description: '', pin: '', saving: false });
                        setShowCreatePin(false);
                    }}
                >
                    {creating ? 'Close' : 'Add New Quest'}
                </button>
            </div>

            {/* Create form */}
            {creating && (
                <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm space-y-4">
                    <h3 className="text-lg font-semibold text-[#7A2F38]">New Quest</h3>
                    <div>
                        <label className="block text-sm font-medium text-[#7A2F38] mb-1">
                            Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={createForm.title}
                            onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                            className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-sm text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42]"
                            placeholder="e.g. Scan the Lungs"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#7A2F38] mb-1">Description</label>
                        <textarea
                            value={createForm.description}
                            onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                            rows={3}
                            className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-sm text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42] resize-none"
                            placeholder="Describe what participants need to do at this booth"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#7A2F38] mb-1">
                            PIN <span className="text-red-500">*</span>{' '}
                            <span className="text-[#7A2F38] font-normal">(1-6 digits)</span>
                        </label>
                        <div className="relative w-40">
                            <input
                                type={showCreatePin ? 'text' : 'password'}
                                value={createForm.pin}
                                onChange={(e) => {
                                    const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                                    setCreateForm((prev) => ({ ...prev, pin: digits }));
                                }}
                                inputMode="numeric"
                                maxLength={6}
                                className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-sm text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42] pr-10"
                                placeholder="e.g. 123456"
                            />
                            <button
                                type="button"
                                onClick={() => setShowCreatePin((v) => !v)}
                                className="absolute inset-y-0 right-2 flex items-center text-[#7A2F38] hover:text-[#7A2F38] transition-colors"
                                aria-label={showCreatePin ? 'Hide PIN' : 'Show PIN'}
                            >
                                {showCreatePin ? <EyeOffIcon /> : <EyeIcon />}
                            </button>
                        </div>
                    </div>
                    <div className="flex space-x-2 pt-1">
                        <button
                            type="button"
                            onClick={saveNewQuest}
                            disabled={createForm.saving}
                            className="bg-[#ff8c42] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#ff6b1a] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {createForm.saving ? 'Saving…' : 'Save Quest'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setCreating(false)}
                            disabled={createForm.saving}
                            className="bg-white border-2 border-[#ff8c42] text-[#7A2F38] px-4 py-2 rounded-lg text-sm font-medium hover:bg-white transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Error banner */}
            {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {error}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="text-sm text-[#7A2F38]">Loading quests…</div>
            )}

            {/* Empty state */}
            {!loading && !error && quests.length === 0 && (
                <div className="bg-[#FFF7ED] rounded-lg p-8 border-2 border-[#ff8c42] shadow-sm text-center">
                    <p className="text-[#7A2F38] text-sm">No quests for this event yet.</p>
                    <p className="text-[#7A2F38] text-xs mt-1">Click &ldquo;Add New Quest&rdquo; to create the first one.</p>
                </div>
            )}

            {/* Quest list */}
            <div className="space-y-4">
                {quests.map((quest) => (
                    <div key={quest.id} className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1 min-w-0">
                                {editingId === quest.id ? (
                                    /* ── Edit mode ── */
                                    <div className="space-y-3 pr-4">
                                        <div>
                                            <label className="block text-xs font-medium text-[#7A2F38] mb-1">
                                                Title <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={editForm.title}
                                                onChange={(e) =>
                                                    setEditForm((prev) => ({ ...prev, title: e.target.value }))
                                                }
                                                className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-sm text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-[#7A2F38] mb-1">
                                                Description
                                            </label>
                                            <textarea
                                                value={editForm.description}
                                                onChange={(e) =>
                                                    setEditForm((prev) => ({ ...prev, description: e.target.value }))
                                                }
                                                rows={3}
                                                className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-sm text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42] resize-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-[#7A2F38] mb-1">
                                                PIN <span className="text-[#7A2F38] font-normal">(1-6 digits, required when active)</span>
                                            </label>
                                            <div className="relative w-40">
                                                <input
                                                    type={showPinId === quest.id ? 'text' : 'password'}
                                                    value={editForm.pin}
                                                    onChange={(e) => {
                                                        const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                                                        setEditForm((prev) => ({ ...prev, pin: digits }));
                                                    }}
                                                    inputMode="numeric"
                                                    maxLength={6}
                                                    className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-sm text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42] pr-10"
                                                    placeholder="e.g. 123456"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPinId((v) => (v === quest.id ? null : quest.id))}
                                                    className="absolute inset-y-0 right-2 flex items-center text-[#7A2F38] hover:text-[#7A2F38] transition-colors"
                                                    aria-label={showPinId === quest.id ? 'Hide PIN' : 'Show PIN'}
                                                >
                                                    {showPinId === quest.id ? <EyeOffIcon /> : <EyeIcon />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* ── View mode ── */
                                    <>
                                        <h3 className="text-lg font-semibold text-[#7A2F38] mb-1 truncate">
                                            {quest.title || <span className="italic text-[#7A2F38]">Untitled quest</span>}
                                        </h3>
                                        {quest.description ? (
                                            <p className="text-sm text-[#7A2F38] mb-2 line-clamp-2">
                                                {quest.description}
                                            </p>
                                        ) : (
                                            <p className="text-sm text-[#7A2F38] italic mb-2">No description</p>
                                        )}
                                        <div className="flex items-center text-xs text-[#7A2F38]">
                                            <span className="flex items-center space-x-1">
                                                <span>PIN:</span>
                                                {quest.pin ? (
                                                    <span className="font-mono">
                                                        {showPinId === quest.id
                                                            ? quest.pin
                                                            : '•'.repeat(quest.pin.length)}
                                                    </span>
                                                ) : (
                                                    <span className="italic text-[#7A2F38]">not set</span>
                                                )}
                                                {quest.pin && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setShowPinId((v) => (v === quest.id ? null : quest.id))
                                                        }
                                                        className="ml-1 text-[#7A2F38] hover:text-[#7A2F38] transition-colors"
                                                        aria-label={showPinId === quest.id ? 'Hide PIN' : 'Reveal PIN'}
                                                    >
                                                        {showPinId === quest.id ? <EyeOffIcon /> : <EyeIcon />}
                                                    </button>
                                                )}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Active toggle + badge */}
                            <div className="flex items-center space-x-3 ml-4 flex-shrink-0">
                                <span
                                    className={`px-3 py-1 rounded-full text-xs font-medium ${quest.is_active
                                        ? 'bg-[#8bcc5e]/20 text-[#5a8b3a]'
                                        : 'bg-[#ffaa00]/20 text-[#cc8800]'
                                    }`}
                                >
                                    {quest.is_active ? 'Active' : 'Inactive'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleToggleQuest(quest.id, quest.is_active)}
                                    disabled={togglingId === quest.id}
                                    className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                                        quest.is_active ? 'bg-[#ff8c42]' : 'bg-white border-2 border-[#ff8c42]'
                                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                                    aria-pressed={quest.is_active}
                                    aria-label={`Set quest ${quest.is_active ? 'inactive' : 'active'}`}
                                >
                                    <span
                                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                            quest.is_active ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex space-x-2">
                            {editingId === quest.id ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            requestConfirm('Save changes to this quest?', saveEdit)
                                        }
                                        disabled={editForm.saving || deletingId === quest.id}
                                        className="bg-[#ff8c42] text-white px-3 py-1 rounded text-sm hover:bg-[#ff6b1a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {editForm.saving ? 'Saving…' : 'Save'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={cancelEdit}
                                        disabled={editForm.saving || deletingId === quest.id}
                                        className="bg-white border-2 border-[#ff8c42] text-[#7A2F38] px-3 py-1 rounded text-sm hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            requestConfirm(
                                                `Delete "${quest.title || 'this quest'}"? This cannot be undone.`,
                                                () => deleteQuest(quest.id)
                                            )
                                        }
                                        disabled={editForm.saving || deletingId === quest.id}
                                        className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {deletingId === quest.id ? 'Deleting…' : 'Delete'}
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    className="bg-white border-2 border-[#ff8c42] text-[#7A2F38] px-3 py-1 rounded text-sm hover:bg-white transition-colors"
                                    onClick={() => startEdit(quest)}
                                >
                                    Edit
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Confirm modal */}
            {confirmModal.open && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-[#FFF7ED] rounded-lg p-6 shadow-lg w-full max-w-md border-2 border-[#ff8c42]">
                        <h3 className="text-lg font-semibold text-[#7A2F38] mb-2">Confirm</h3>
                        <p className="text-sm text-[#7A2F38] mb-4">{confirmModal.label}</p>
                        <div className="flex items-center justify-end space-x-3">
                            <button
                                type="button"
                                onClick={cancelConfirm}
                                disabled={confirmModal.busy}
                                className="text-sm text-[#7A2F38] hover:text-[#7A2F38] disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmAction}
                                disabled={confirmModal.busy}
                                className="bg-[#ff8c42] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#ff6b1a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {confirmModal.busy ? 'Working…' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
