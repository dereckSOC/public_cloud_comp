"use client";
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@psd/shared/lib/supabaseClient';

async function fetchWithAdminAuth(url, init = {}) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
        throw new Error('Could not verify admin session.');
    }

    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
        throw new Error('Missing authorization token.');
    }

    const headers = new Headers(init.headers ?? {});
    headers.set('Authorization', `Bearer ${accessToken}`);

    return fetch(url, {
        ...init,
        headers
    });
}

const createInitialEditForm = () => ({
    text: '',
    type: 'mcq',
    options: [],
    optionsLoading: false,
    saving: false
});

export default function QuestionsTab({ eventId, userRole, onViewResponses }) {
    const [questions, setQuestions] = useState([]);
    const [importableQuestions, setImportableQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [togglingId, setTogglingId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [editForm, setEditForm] = useState(createInitialEditForm);
    const [creating, setCreating] = useState(false);
    const [createForm, setCreateForm] = useState({ text: '', type: 'mcq', options: [], saving: false });
    const [importState, setImportState] = useState({ selectedId: '', loading: false, importing: false });
    const [confirmModal, setConfirmModal] = useState({ open: false, label: '', action: null, busy: false });
    const optionDraftCounterRef = useRef(0);
    const editLoadTokenRef = useRef(0);
    const questionTypeOptions = ['mcq'];
    const canImportQuestions = userRole === 'superadmin';
    const nextOptionDraftId = () => {
        optionDraftCounterRef.current += 1;
        return `option-draft-${optionDraftCounterRef.current}`;
    };
    const toFiniteNumber = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    const reindexOptionDrafts = (options) =>
        (options ?? []).map((option, index) => ({ ...option, sort_order: index }));
    const buildOptionDraft = (option = {}, fallbackSortOrder = 0) => {
        const numericId = Number(option?.id);
        return {
            local_id:
                typeof option?.local_id === 'string' && option.local_id.trim()
                    ? option.local_id
                    : Number.isFinite(numericId)
                        ? `option-existing-${numericId}`
                        : nextOptionDraftId(),
            id: Number.isFinite(numericId) ? numericId : null,
            option_text: typeof option?.option_text === 'string' ? option.option_text : '',
            choice_key: typeof option?.choice_key === 'string' ? option.choice_key.toUpperCase() : '',
            sort_order: toFiniteNumber(option?.sort_order, fallbackSortOrder)
        };
    };
    const normalizeOptionDrafts = (optionRows = []) => {
        const sortedOptions = [...(optionRows ?? [])].sort((a, b) => {
            const bySortOrder = toFiniteNumber(a?.sort_order, Number.MAX_SAFE_INTEGER) - toFiniteNumber(b?.sort_order, Number.MAX_SAFE_INTEGER);
            if (bySortOrder !== 0) return bySortOrder;
            const byCreatedAt = new Date(a?.created_at ?? 0).getTime() - new Date(b?.created_at ?? 0).getTime();
            if (Number.isFinite(byCreatedAt) && byCreatedAt !== 0) return byCreatedAt;
            return toFiniteNumber(a?.id, Number.MAX_SAFE_INTEGER) - toFiniteNumber(b?.id, Number.MAX_SAFE_INTEGER);
        });
        const draftRows = sortedOptions.length > 0
            ? sortedOptions.map((option, index) => buildOptionDraft(option, index))
            : [
                buildOptionDraft({ choice_key: 'A', option_text: '' }, 0),
                buildOptionDraft({ choice_key: 'B', option_text: '' }, 1)
            ];
        return reindexOptionDrafts(draftRows);
    };
    const createInitialCreateForm = () => ({
        text: '',
        type: 'mcq',
        options: normalizeOptionDrafts([]),
        saving: false
    });
    const validateQuestionOptions = (options) => {
        if (!Array.isArray(options) || options.length !== 2) {
            return 'Exactly 2 options are required (Cell A and Cell B).';
        }
        const normalizedChoices = options.map((option) => String(option?.choice_key ?? '').trim().toUpperCase());
        const hasInvalidChoice = normalizedChoices.some((choice) => choice !== 'A' && choice !== 'B');
        if (hasInvalidChoice) {
            return 'Each option must be assigned to A or B.';
        }
        if (new Set(normalizedChoices).size !== normalizedChoices.length) {
            return 'Options must have unique A and B assignments.';
        }
        const hasEmptyText = options.some((option) => !String(option?.option_text ?? '').trim());
        if (hasEmptyText) {
            return 'Option text cannot be empty.';
        }
        const sortOrders = options.map((option) => toFiniteNumber(option?.sort_order, Number.NaN));
        if (sortOrders.some((value) => !Number.isFinite(value))) {
            return 'Option order is invalid. Please reorder and try again.';
        }
        if (new Set(sortOrders).size !== sortOrders.length) {
            return 'Option order is duplicated. Please reorder and try again.';
        }
        return '';
    };

    useEffect(() => {
        const fetchQuestions = async () => {
            if (!eventId) {
                setError('No event selected. Pick an event to view its questions.');
                setQuestions([]);
                setLoading(false);
                return;
            }
            setLoading(true);
            setError('');
            try {
                const res = await fetchWithAdminAuth(`/api/feedback/questions?eventId=${eventId}`);
                const body = await res.json();
                if (!res.ok) throw new Error(body?.error || 'Could not load questions.');
                setQuestions(body.questions ?? []);
            } catch (err) {
                setError(err.message || 'Could not load questions for this event.');
                setQuestions([]);
            }
            setLoading(false);
        };
        fetchQuestions();
    }, [eventId]);

    useEffect(() => {
        const fetchImportableQuestions = async () => {
            if (!canImportQuestions || !eventId) {
                setImportableQuestions([]);
                return;
            }
            setImportState((prev) => ({ ...prev, loading: true }));
            try {
                // importableQuestions are returned alongside questions from the same endpoint
                const res = await fetchWithAdminAuth(`/api/feedback/questions?eventId=${eventId}`);
                const body = await res.json();
                if (!res.ok) throw new Error(body?.error || 'Could not load reusable questions.');
                setImportableQuestions(body.importableQuestions ?? []);
            } catch (err) {
                setError(err.message || 'Could not load reusable questions.');
                setImportableQuestions([]);
            }
            setImportState((prev) => ({ ...prev, loading: false }));
        };
        fetchImportableQuestions();
    }, [canImportQuestions, eventId]);

    const handleToggleQuestion = async (questionId, currentStatus) => {
        if (!eventId) return;
        setTogglingId(questionId);
        try {
            const res = await fetchWithAdminAuth('/api/feedback/questions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle', questionId, isActive: !currentStatus }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body?.error);
            setQuestions((prev) =>
                prev.map((q) =>
                    q.id === questionId ? { ...q, is_active: body.question?.is_active ?? !currentStatus } : q
                )
            );
            setError('');
        } catch (err) {
            setError(err.message || 'Could not update question status.');
        }
        setTogglingId(null);
    };

    const startEdit = async (question) => {
        if (!question?.id) return;
        const normalizedType = question.question_type || questionTypeOptions[0];
        const loadToken = editLoadTokenRef.current + 1;
        editLoadTokenRef.current = loadToken;
        setError('');
        setEditingId(question.id);
        setEditForm({
            text: question.question_text ?? '',
            type: normalizedType,
            options: [],
            optionsLoading: true,
            saving: false
        });
        try {
            const res = await fetchWithAdminAuth(`/api/feedback/questions/options?questionId=${question.id}`);
            const body = await res.json();
            if (!res.ok) throw new Error(body?.error || 'Could not load options.');
            if (editLoadTokenRef.current !== loadToken) return;
            setEditForm((prev) => ({
                ...prev,
                options: normalizeOptionDrafts(body.options ?? []),
                optionsLoading: false
            }));
        } catch (loadError) {
            if (editLoadTokenRef.current !== loadToken) return;
            setError(loadError.message || 'Could not load options for this question.');
            setEditForm((prev) => ({
                ...prev,
                options: normalizeOptionDrafts([]),
                optionsLoading: false
            }));
        }
    };

    const cancelEdit = () => {
        editLoadTokenRef.current += 1;
        setEditingId(null);
        setEditForm(createInitialEditForm());
        setError('');
    };

    const updateFormOption = (setForm, localId, updates) => {
        setError('');
        setForm((prev) => ({
            ...prev,
            options: prev.options.map((option) =>
                option.local_id === localId ? { ...option, ...updates } : option
            )
        }));
    };

    const moveFormOption = (setForm, localId, direction) => {
        setError('');
        setForm((prev) => {
            const currentIndex = prev.options.findIndex((option) => option.local_id === localId);
            if (currentIndex < 0) return prev;
            const targetIndex = currentIndex + direction;
            if (targetIndex < 0 || targetIndex >= prev.options.length) return prev;
            const reordered = [...prev.options];
            const [moved] = reordered.splice(currentIndex, 1);
            reordered.splice(targetIndex, 0, moved);
            return { ...prev, options: reindexOptionDrafts(reordered) };
        });
    };

    const addFormOption = (setForm) => {
        setError('');
        setForm((prev) => ({
            ...prev,
            options: reindexOptionDrafts([
                ...prev.options,
                buildOptionDraft(
                    {
                        option_text: '',
                        choice_key: '',
                        sort_order: prev.options.length
                    },
                    prev.options.length
                )
            ])
        }));
    };

    const removeFormOption = (setForm, localId) => {
        setError('');
        setForm((prev) => ({
            ...prev,
            options: reindexOptionDrafts(prev.options.filter((option) => option.local_id !== localId))
        }));
    };

    const openCreateForm = () => {
        setError('');
        setCreateForm(createInitialCreateForm());
        setCreating(true);
    };

    const closeCreateForm = () => {
        setError('');
        setCreateForm(createInitialCreateForm());
        setCreating(false);
    };

    const updateEditOption = (localId, updates) => {
        updateFormOption(setEditForm, localId, updates);
    };

    const handleOptionTextChange = (localId, value) => {
        updateEditOption(localId, { option_text: value });
    };

    const handleOptionChoiceChange = (localId, value) => {
        updateEditOption(localId, { choice_key: String(value ?? '').toUpperCase() });
    };

    const moveOption = (localId, direction) => {
        moveFormOption(setEditForm, localId, direction);
    };

    const addOption = () => {
        addFormOption(setEditForm);
    };

    const removeOption = (localId) => {
        removeFormOption(setEditForm, localId);
    };

    const updateCreateOption = (localId, updates) => {
        updateFormOption(setCreateForm, localId, updates);
    };

    const handleCreateOptionTextChange = (localId, value) => {
        updateCreateOption(localId, { option_text: value });
    };

    const handleCreateOptionChoiceChange = (localId, value) => {
        updateCreateOption(localId, { choice_key: String(value ?? '').toUpperCase() });
    };

    const moveCreateOption = (localId, direction) => {
        moveFormOption(setCreateForm, localId, direction);
    };

    const addCreateOption = () => {
        addFormOption(setCreateForm);
    };

    const removeCreateOption = (localId) => {
        removeFormOption(setCreateForm, localId);
    };

    const saveEdit = async () => {
        if (!editingId) return;
        const trimmedQuestionText = editForm.text.trim();
        if (!trimmedQuestionText) {
            setError('Question text cannot be empty.');
            return;
        }
        const optionValidationError = validateQuestionOptions(editForm.options);
        if (optionValidationError) {
            setError(optionValidationError);
            return;
        }
        const normalizedOptions = reindexOptionDrafts(editForm.options).map((option, index) => {
            const numericId = Number(option?.id);
            return {
                id: Number.isFinite(numericId) ? numericId : null,
                option_text: String(option?.option_text ?? '').trim(),
                sort_order: index,
                choice_key: String(option?.choice_key ?? '').toUpperCase()
            };
        });

        setEditForm((prev) => ({ ...prev, saving: true }));
        let updatedQuestion;
        try {
            const res = await fetchWithAdminAuth('/api/feedback/questions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionId: editingId,
                    questionText: trimmedQuestionText,
                    questionType: editForm.type,
                    options: normalizedOptions,
                }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body?.error || 'Could not save question changes.');
            updatedQuestion = body.question;
        } catch (err) {
            setError(err.message || 'Could not save question changes.');
            setEditForm((prev) => ({ ...prev, saving: false }));
            return;
        }

        if (!updatedQuestion || typeof updatedQuestion !== 'object') {
            setError('Could not save question changes.');
            setEditForm((prev) => ({ ...prev, saving: false }));
            return;
        }

        setQuestions((prev) =>
            prev.map((q) => (q.id === editingId ? { ...q, ...updatedQuestion } : q))
        );
        setError('');
        setEditingId(null);
        setEditForm(createInitialEditForm());
    };

    const deleteQuestion = async (questionId) => {
        if (!eventId || !questionId) return;
        setDeletingId(questionId);
        try {
            const res = await fetchWithAdminAuth(`/api/feedback/questions?questionId=${questionId}&eventId=${eventId}`, {
                method: 'DELETE',
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body?.error || 'Could not delete question.');
            setQuestions((prev) => prev.filter((q) => q.id !== questionId));
            if (editingId === questionId) {
                setEditingId(null);
                setEditForm(createInitialEditForm());
            }
        } catch (err) {
            setError(err.message || 'Could not delete question.');
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

    const saveNewQuestion = async () => {
        if (!eventId) {
            setError('No event selected. Pick an event to add questions.');
            return;
        }
        const trimmed = createForm.text.trim();
        if (!trimmed) {
            setError('Question text cannot be empty.');
            return;
        }
        const optionValidationError = validateQuestionOptions(createForm.options);
        if (optionValidationError) {
            setError(optionValidationError);
            return;
        }
        const normalizedOptions = reindexOptionDrafts(createForm.options).map((option, index) => ({
            option_text: String(option?.option_text ?? '').trim(),
            sort_order: index,
            choice_key: String(option?.choice_key ?? '').toUpperCase()
        }));
        setError('');
        setCreateForm((prev) => ({ ...prev, saving: true }));
        try {
            const res = await fetchWithAdminAuth('/api/feedback/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId,
                    questionText: trimmed,
                    questionType: createForm.type,
                    options: normalizedOptions
                }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body?.error || 'Could not create question.');
            if (body.question) {
                setQuestions((prev) => [...prev, body.question].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
                closeCreateForm();
            }
        } catch (err) {
            setError(err.message || 'Could not create question.');
        }
        setCreateForm((prev) => ({ ...prev, saving: false }));
    };

    const importExistingQuestion = async () => {
        if (!canImportQuestions) {
            return;
        }
        if (!eventId) {
            setError('No event selected. Pick an event to add questions.');
            return;
        }
        const sourceId = Number(importState.selectedId);
        if (!Number.isFinite(sourceId) || sourceId <= 0) {
            setError('Pick a question to import.');
            return;
        }

        setError('');
        setImportState((prev) => ({ ...prev, importing: true }));

        try {
            const res = await fetchWithAdminAuth('/api/feedback/questions/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, sourceQuestionId: sourceId }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body?.error || 'Could not import question.');

            if (body.question) {
                setQuestions((prev) =>
                    [...prev, body.question].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                );
            }
            setImportState({ selectedId: '', loading: false, importing: false });
        } catch (importError) {
            setError(importError.message || 'Could not import question.');
            setImportState((prev) => ({ ...prev, importing: false }));
        }
    };

    const renderOptionsEditor = ({
        form,
        validationMessage,
        onAddOption,
        onMoveOption,
        onRemoveOption,
        onOptionTextChange,
        onOptionChoiceChange
    }) => (
        <div className="rounded-lg border-2 border-[#ff8c42] bg-[#ff8c42]/25 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[#7A2F38] uppercase tracking-wide">Options</h4>
                <button
                    type="button"
                    onClick={onAddOption}
                    disabled={form.saving || form.optionsLoading}
                    className="cursor-pointer bg-white border-2 border-[#ff8c42] text-[#7A2F38] px-3 py-1 rounded text-xs hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    Add Option
                </button>
            </div>
            {form.optionsLoading ? (
                <div className="text-sm text-[#7A2F38]">Loading options…</div>
            ) : (
                <>
                    {form.options.length === 0 && (
                        <div className="text-sm text-[#7A2F38]">No options yet. Add 2 options and assign them to A and B.</div>
                    )}
                    <div className="space-y-3">
                        {form.options.map((option, index) => (
                            <div key={option.local_id} className="rounded-lg border-2 border-[#ff8c42] bg-white p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-[#7A2F38]">
                                        Option {index + 1}
                                    </span>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            type="button"
                                            onClick={() => onMoveOption(option.local_id, -1)}
                                            disabled={form.saving || form.optionsLoading || index === 0}
                                            className="cursor-pointer bg-white border-2 border-[#ff8c42] text-[#7A2F38] px-2 py-1 rounded text-xs hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onMoveOption(option.local_id, 1)}
                                            disabled={form.saving || form.optionsLoading || index === form.options.length - 1}
                                            className="cursor-pointer bg-white border-2 border-[#ff8c42] text-[#7A2F38] px-2 py-1 rounded text-xs hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            ↓
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onRemoveOption(option.local_id)}
                                            disabled={form.saving || form.optionsLoading}
                                            className="cursor-pointer bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    value={option.option_text}
                                    onChange={(e) => onOptionTextChange(option.local_id, e.target.value)}
                                    className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-sm text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42]"
                                    placeholder="Enter option text"
                                    disabled={form.saving || form.optionsLoading}
                                />
                                <div className="flex items-center space-x-3">
                                    <label className="text-sm text-[#7A2F38]">Cell</label>
                                    <select
                                        value={option.choice_key}
                                        onChange={(e) => onOptionChoiceChange(option.local_id, e.target.value)}
                                        className="rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-sm text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42]"
                                        disabled={form.saving || form.optionsLoading}
                                    >
                                        <option value="">Select</option>
                                        <option value="A">A</option>
                                        <option value="B">B</option>
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-[#7A2F38]">
                        Exactly 2 options are required, with unique A and B assignments.
                    </p>
                    {validationMessage && (
                        <p className="text-xs text-red-600">{validationMessage}</p>
                    )}
                </>
            )}
        </div>
    );

    const isCreateFormDirty =
        createForm.text.trim().length > 0 ||
        createForm.options.some((option) => String(option?.option_text ?? '').trim() || String(option?.choice_key ?? '').trim());
    const createOptionValidationMessage =
        creating && isCreateFormDirty ? validateQuestionOptions(createForm.options) : '';
    const editOptionValidationMessage = editingId ? validateQuestionOptions(editForm.options) : '';

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-[#7A2F38]">Questions</h2>
                <button
                    className="bg-[#ff8c42] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#ff6b1a] transition-colors shadow-sm"
                    onClick={creating ? closeCreateForm : openCreateForm}
                >
                    {creating ? 'Close' : 'Add New Question'}
                </button>
            </div>
            {creating && (
                <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm space-y-4">
                    <h3 className="text-lg font-semibold text-[#7A2F38]">New Question</h3>
                    <input
                        type="text"
                        value={createForm.text}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, text: e.target.value }))}
                        className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-sm text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42]"
                        placeholder="Enter question text"
                    />
                    <div className="flex items-center space-x-3">
                        <label className="text-sm text-[#7A2F38]">Type</label>
                        <select
                            value={createForm.type}
                            onChange={(e) => setCreateForm((prev) => ({ ...prev, type: e.target.value }))}
                            className="rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-sm text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42]"
                        >
                            {questionTypeOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt.replace('_', ' ')}
                                </option>
                            ))}
                        </select>
                    </div>
                    {renderOptionsEditor({
                        form: createForm,
                        validationMessage: createOptionValidationMessage,
                        onAddOption: addCreateOption,
                        onMoveOption: moveCreateOption,
                        onRemoveOption: removeCreateOption,
                        onOptionTextChange: handleCreateOptionTextChange,
                        onOptionChoiceChange: handleCreateOptionChoiceChange
                    })}
                    <div className="flex space-x-2">
                        <button
                            onClick={saveNewQuestion}
                            disabled={createForm.saving || !!createOptionValidationMessage}
                            className="bg-[#ff8c42] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#ff6b1a] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {createForm.saving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                            onClick={closeCreateForm}
                            disabled={createForm.saving}
                            className="bg-white border-2 border-[#ff8c42] text-[#7A2F38] px-4 py-2 rounded-lg text-sm font-medium hover:bg-white transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
            {canImportQuestions && (
                <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm space-y-4">
                    <h3 className="text-lg font-semibold text-[#7A2F38]">Add From Existing Questions</h3>
                    <p className="text-sm text-[#7A2F38]">
                        Reuse a question from another event and copy its options.
                    </p>
                    <div className="flex flex-col md:flex-row gap-3 md:items-center">
                        <select
                            value={importState.selectedId}
                            onChange={(e) => setImportState((prev) => ({ ...prev, selectedId: e.target.value }))}
                            disabled={importState.loading || importState.importing}
                            className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-sm text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42] disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <option value="">Select a question</option>
                            {importableQuestions.map((question) => (
                                <option key={question.id} value={question.id}>
                                    #{question.id} [Event {question.event_id}] {question.question_text}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={importExistingQuestion}
                            disabled={importState.loading || importState.importing || !importState.selectedId}
                            className="bg-[#ff8c42] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#ff6b1a] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {importState.loading ? 'Loading...' : importState.importing ? 'Importing...' : 'Import Question'}
                        </button>
                    </div>
                </div>
            )}
            {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {error}
                </div>
            )}
            {loading && (
                <div className="text-sm text-[#7A2F38]">Loading questions…</div>
            )}
            {!loading && !error && questions.length === 0 && (
                <div className="text-sm text-[#7A2F38]">No questions for this event yet.</div>
            )}
            <div className="space-y-4">
                {questions.map((question) => (
                    <div key={question.id} className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                {editingId === question.id ? (
                                    <div className="space-y-4">
                                        <input
                                            type="text"
                                            value={editForm.text}
                                            onChange={(e) => {
                                                setError('');
                                                setEditForm((prev) => ({ ...prev, text: e.target.value }));
                                            }}
                                            className="w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-sm text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42]"
                                            disabled={editForm.saving || editForm.optionsLoading}
                                        />
                                        <div className="flex items-center space-x-3">
                                            <label className="text-sm text-[#7A2F38]">Type</label>
                                            <select
                                                value={editForm.type}
                                                onChange={(e) => {
                                                    setError('');
                                                    setEditForm((prev) => ({ ...prev, type: e.target.value }));
                                                }}
                                                className="rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-sm text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42]"
                                                disabled={editForm.saving || editForm.optionsLoading}
                                            >
                                                {questionTypeOptions.map((opt) => (
                                                    <option key={opt} value={opt}>
                                                        {opt.replace('_', ' ')}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {renderOptionsEditor({
                                            form: editForm,
                                            validationMessage: editOptionValidationMessage,
                                            onAddOption: addOption,
                                            onMoveOption: moveOption,
                                            onRemoveOption: removeOption,
                                            onOptionTextChange: handleOptionTextChange,
                                            onOptionChoiceChange: handleOptionChoiceChange
                                        })}
                                    </div>
                                ) : (
                                    <>
                                        <h3 className="text-lg font-semibold text-[#7A2F38] mb-2">{question.question_text}</h3>
                                        <div className="flex items-center space-x-4 text-sm text-[#7A2F38]">
                                            <span className="bg-white border-2 border-[#ff8c42] px-2 py-1 rounded uppercase tracking-wide text-xs">
                                                {question.question_type}
                                            </span>
                                            <span className="capitalize">{question.is_active ? 'Active' : 'Inactive'}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="flex items-center space-x-3">
                                <span
                                    className={`px-3 py-1 rounded-full text-xs font-medium ${question.is_active ? 'bg-[#8bcc5e]/20 text-[#5a8b3a]' : 'bg-[#ffaa00]/20 text-[#cc8800]'
                                        }`}
                                >
                                    {question.is_active ? 'Active' : 'Inactive'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleToggleQuestion(question.id, question.is_active)}
                                    className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${question.is_active ? 'bg-[#ff8c42]' : 'bg-white border-2 border-[#ff8c42]'} disabled:opacity-60 disabled:cursor-not-allowed`}
                                    disabled={togglingId === question.id}
                                    aria-pressed={question.is_active}
                                    aria-label={`Set question ${question.is_active ? 'inactive' : 'active'}`}
                                >
                                    <span
                                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${question.is_active ? 'translate-x-6' : 'translate-x-1'}`}
                                    />
                                </button>
                            </div>
                        </div>
                        <div className="flex space-x-2">
                            {editingId === question.id ? (
                                <>
                                    <button
                                        onClick={() => requestConfirm('Save changes to this question and its options?', saveEdit)}
                                        disabled={editForm.saving || editForm.optionsLoading || !!editOptionValidationMessage || deletingId === question.id}
                                        className="cursor-pointer bg-[#ff8c42] text-white px-3 py-1 rounded text-sm hover:bg-[#ff6b1a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {editForm.saving ? 'Saving…' : 'Save'}
                                    </button>
                                    <button
                                        onClick={cancelEdit}
                                        disabled={editForm.saving || deletingId === question.id}
                                        className="cursor-pointer bg-white border-2 border-[#ff8c42] text-[#7A2F38] px-3 py-1 rounded text-sm hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => requestConfirm('Delete this question? This cannot be undone.', () => deleteQuestion(question.id))}
                                        disabled={editForm.saving || editForm.optionsLoading || deletingId === question.id}
                                        className="cursor-pointer bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {deletingId === question.id ? 'Deleting…' : 'Delete'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        className="bg-white border-2 border-[#ff8c42] text-[#7A2F38] px-3 py-1 rounded text-sm hover:bg-white transition-colors"
                                        onClick={() => startEdit(question)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        className="bg-white border-2 border-[#ff8c42] text-[#7A2F38] px-3 py-1 rounded text-sm hover:bg-white transition-colors"
                                        type="button"
                                        onClick={() => onViewResponses?.(question)}
                                    >
                                        View Responses
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {confirmModal.open && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-[#FFF7ED] rounded-lg p-6 shadow-lg w-full max-w-md border-2 border-[#ff8c42]">
                        <h3 className="text-lg font-semibold text-[#7A2F38] mb-2">Confirm changes</h3>
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
