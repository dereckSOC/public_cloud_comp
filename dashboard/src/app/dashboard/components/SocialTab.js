"use client";
import { useEffect, useState } from 'react';
import { fetchJson, fetchJsonWithAdminAuth } from '@/app/lib/apiClient';

const EMPTY_ITEM = { title: '', detail: '', url: '' };
const EMPTY_SECTION = { title: '' };

export default function SocialTab({ isEditing = false, setIsEditing = () => {} }) {
    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingSectionTitle, setEditingSectionTitle] = useState(null); // { id, title }
    const [editingItem, setEditingItem] = useState(null); // { id, section_id, title, detail, url }
    const [addingItemToSection, setAddingItemToSection] = useState(null); // section_id
    const [newItem, setNewItem] = useState(EMPTY_ITEM);
    const [addingSection, setAddingSection] = useState(false);
    const [newSection, setNewSection] = useState(EMPTY_SECTION);
    const [confirm, setConfirm] = useState({ open: false, label: '', action: null });
    const [toast, setToast] = useState(null);

    const showToast = (message, variant = 'info') => {
        setToast({ message, variant });
        setTimeout(() => setToast(null), 3200);
    };

    const requestConfirm = (label, action) => {
        setConfirm({ open: true, label, action });
    };

    const runConfirm = async () => {
        if (confirm.action) await confirm.action();
        setConfirm({ open: false, label: '', action: null });
    };

    const loadSocialData = async () => {
        const [
            { response: sectionsResponse, body: sectionsBody },
            { response: itemsResponse, body: itemsBody },
        ] = await Promise.all([
            fetchJson('/api/social/sections'),
            fetchJson('/api/social/items'),
        ]);

        if (!sectionsResponse.ok) {
            throw new Error(sectionsBody?.error || 'Could not load social sections.');
        }

        if (!itemsResponse.ok) {
            throw new Error(itemsBody?.error || 'Could not load social items.');
        }

        const items = itemsBody.items ?? [];
        return (sectionsBody.sections ?? []).map(s => ({
            ...s,
            items: items.filter(i => i.section_id === s.id),
        }));
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const nextSections = await loadSocialData();
            setSections(nextSections);
        } catch (error) {
            showToast(error.message || 'Could not load social content.', 'error');
            setSections([]);
        }
        setLoading(false);
    };

    useEffect(() => {
        let mounted = true;

        const loadInitialData = async () => {
            setLoading(true);
            let nextSections = [];
            try {
                nextSections = await loadSocialData();
            } catch (error) {
                if (mounted) {
                    showToast(error.message || 'Could not load social content.', 'error');
                }
            }
            if (!mounted) return;
            setSections(nextSections);
            setLoading(false);
        };

        void loadInitialData();

        return () => {
            mounted = false;
        };
    }, []);

    const exitEditing = () => {
        setEditingSectionTitle(null);
        setEditingItem(null);
        setAddingItemToSection(null);
        setAddingSection(false);
        setNewItem(EMPTY_ITEM);
        setNewSection(EMPTY_SECTION);
    };

    // --- Sections ---
    const saveSectionTitle = async () => {
        if (!editingSectionTitle.title.trim()) { showToast('Title is required.', 'error'); return; }
        const { response, body } = await fetchJsonWithAdminAuth(`/api/social/sections/${editingSectionTitle.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: editingSectionTitle.title.trim() }),
        });
        if (!response.ok) { showToast(body?.error || 'Could not update section.', 'error'); return; }
        showToast('Section renamed.', 'success');
        setEditingSectionTitle(null);
        fetchData();
    };

    const deleteSection = async (id) => {
        const { response, body } = await fetchJsonWithAdminAuth(`/api/social/sections/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) { showToast(body?.error || 'Could not delete section.', 'error'); return; }
        showToast('Section deleted.', 'success');
        fetchData();
    };

    const addSection = async () => {
        if (!newSection.title.trim()) { showToast('Title is required.', 'error'); return; }
        const maxOrder = sections.reduce((max, s) => Math.max(max, s.display_order), 0);
        const { response, body } = await fetchJsonWithAdminAuth('/api/social/sections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: newSection.title.trim(),
                displayOrder: maxOrder + 1,
            }),
        });
        if (!response.ok) { showToast(body?.error || 'Could not add section.', 'error'); return; }
        showToast('Section added.', 'success');
        setNewSection(EMPTY_SECTION);
        setAddingSection(false);
        fetchData();
    };

    // --- Items ---
    const saveItem = async () => {
        if (!editingItem.title.trim() || !editingItem.url.trim()) { showToast('Title and URL are required.', 'error'); return; }
        const { response, body } = await fetchJsonWithAdminAuth(`/api/social/items/${editingItem.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: editingItem.title.trim(),
                detail: editingItem.detail.trim(),
                url: editingItem.url.trim()
            }),
        });
        if (!response.ok) { showToast(body?.error || 'Could not update item.', 'error'); return; }
        showToast('Item updated.', 'success');
        setEditingItem(null);
        fetchData();
    };

    const deleteItem = async (id) => {
        const { response, body } = await fetchJsonWithAdminAuth(`/api/social/items/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) { showToast(body?.error || 'Could not delete item.', 'error'); return; }
        showToast('Item deleted.', 'success');
        fetchData();
    };

    const addItem = async (sectionId) => {
        if (!newItem.title.trim() || !newItem.url.trim()) { showToast('Title and URL are required.', 'error'); return; }
        const { response, body } = await fetchJsonWithAdminAuth('/api/social/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sectionId,
                title: newItem.title.trim(),
                detail: newItem.detail.trim(),
                url: newItem.url.trim()
            }),
        });
        if (!response.ok) { showToast(body?.error || 'Could not add item.', 'error'); return; }
        showToast('Item added.', 'success');
        setNewItem(EMPTY_ITEM);
        setAddingItemToSection(null);
        fetchData();
    };

    const inputClass = "w-full rounded-lg border-2 border-[#ff8c42] px-3 py-2 text-sm text-[#7A2F38] focus:outline-none focus:ring-2 focus:ring-[#ff8c42]";
    const btnPrimary = "bg-[#ff8c42] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#ff6b1a] transition-colors shadow-sm";
    const btnGhost = "text-sm text-[#7A2F38] hover:underline";
    const btnDanger = "bg-red-600 text-white px-3 py-1 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors";

    if (loading) return <div className="text-[#7A2F38] text-sm p-6">Loading...</div>;

    return (
        <div className="space-y-8 max-w-2xl">
            {toast && (
                <div className="fixed top-4 right-4 z-50">
                    <div className={`px-4 py-3 rounded-lg shadow-lg text-sm text-white ${
                        toast.variant === 'error' ? 'bg-red-600'
                        : toast.variant === 'success' ? 'bg-green-600'
                        : 'bg-white border-2 border-[#ff8c42] text-[#7A2F38]'
                    }`}>
                        {toast.message}
                    </div>
                </div>
            )}

            {/* Sections */}
            {sections.map((section) => (
                <div key={section.id} className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm space-y-4">
                    {/* Section header */}
                    {isEditing && editingSectionTitle?.id === section.id ? (
                        <div className="flex gap-2 items-center">
                            <input className={inputClass} value={editingSectionTitle.title}
                                onChange={(e) => setEditingSectionTitle(p => ({ ...p, title: e.target.value }))} />
                            <button className={btnGhost} onClick={() => setEditingSectionTitle(null)}>Cancel</button>
                            <button className={btnPrimary} onClick={() => requestConfirm('Save section title?', saveSectionTitle)}>Save</button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-lg font-bold text-[#7A2F38]">{section.title}</h2>
                            {isEditing && (
                                <div className="flex gap-2 shrink-0">
                                    <button className={btnPrimary} onClick={() => setEditingSectionTitle({ id: section.id, title: section.title })}>Rename</button>
                                    <button className={btnDanger} onClick={() => requestConfirm(`Delete "${section.title}" and all its items?`, () => deleteSection(section.id))}>Delete Section</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Items */}
                    {section.items.length === 0 && (
                        <p className="text-sm text-[#7A2F38]">No items yet.</p>
                    )}

                    {section.items.map((item) => (
                        <div key={item.id} className="border border-[#ff8c42] rounded-lg p-3 space-y-2">
                            {editingItem?.id === item.id ? (
                                <>
                                    <input className={inputClass} value={editingItem.title}
                                        onChange={(e) => setEditingItem(p => ({ ...p, title: e.target.value }))}
                                        placeholder="Title" />
                                    <input className={inputClass} value={editingItem.detail ?? ''}
                                        onChange={(e) => setEditingItem(p => ({ ...p, detail: e.target.value }))}
                                        placeholder="Detail (optional)" />
                                    <input className={inputClass} value={editingItem.url}
                                        onChange={(e) => setEditingItem(p => ({ ...p, url: e.target.value }))}
                                        placeholder="URL" />
                                    <div className="flex gap-2 justify-between items-center">
                                        <button className={btnDanger} onClick={() => requestConfirm('Delete this item?', () => deleteItem(item.id))}>Delete</button>
                                        <div className="flex gap-2">
                                            <button className={btnGhost} onClick={() => setEditingItem(null)}>Cancel</button>
                                            <button className={btnPrimary} onClick={() => requestConfirm('Save changes?', saveItem)}>Save</button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-semibold text-[#7A2F38]">{item.title}</p>
                                        {item.detail && <p className="text-xs text-[#7A2F38]">{item.detail}</p>}
                                        <p className="text-xs text-[#7A2F38] truncate max-w-xs">{item.url}</p>
                                    </div>
                                    {isEditing && (
                                        <button className={`${btnPrimary} shrink-0`} onClick={() => setEditingItem({ ...item, detail: item.detail ?? '' })}>Edit</button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Add item (edit mode only) */}
                    {isEditing && (
                        <div className="border-t border-[#ff8c42] pt-4">
                            {addingItemToSection === section.id ? (
                                <div className="space-y-2">
                                    <input className={inputClass} value={newItem.title}
                                        onChange={(e) => setNewItem(p => ({ ...p, title: e.target.value }))}
                                        placeholder="Title" />
                                    <input className={inputClass} value={newItem.detail}
                                        onChange={(e) => setNewItem(p => ({ ...p, detail: e.target.value }))}
                                        placeholder="Detail (optional)" />
                                    <input className={inputClass} value={newItem.url}
                                        onChange={(e) => setNewItem(p => ({ ...p, url: e.target.value }))}
                                        placeholder="URL" />
                                    <div className="flex gap-2 justify-end">
                                        <button className={btnGhost} onClick={() => { setAddingItemToSection(null); setNewItem(EMPTY_ITEM); }}>Cancel</button>
                                        <button className={btnPrimary} onClick={() => requestConfirm('Add this item?', () => addItem(section.id))}>Add Item</button>
                                    </div>
                                </div>
                            ) : (
                                <button className={btnPrimary} onClick={() => { setAddingItemToSection(section.id); setNewItem(EMPTY_ITEM); }}>+ Add Item</button>
                            )}
                        </div>
                    )}
                </div>
            ))}

            {/* Add section (edit mode only) */}
            {isEditing && (
                <div className="bg-[#FFF7ED] rounded-lg p-6 border-2 border-[#ff8c42] shadow-sm">
                    {addingSection ? (
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-[#7A2F38]">New Section</h3>
                            <input className={inputClass} value={newSection.title}
                                onChange={(e) => setNewSection({ title: e.target.value })}
                                placeholder="Section title (e.g. Others)" />
                            <div className="flex gap-2 justify-end">
                                <button className={btnGhost} onClick={() => { setAddingSection(false); setNewSection(EMPTY_SECTION); }}>Cancel</button>
                                <button className={btnPrimary} onClick={() => requestConfirm('Add this section?', addSection)}>Add Section</button>
                            </div>
                        </div>
                    ) : (
                        <button className={btnPrimary} onClick={() => setAddingSection(true)}>+ Add Section</button>
                    )}
                </div>
            )}

            {/* Confirm dialog */}
            {confirm.open && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-[#FFF7ED] rounded-lg p-6 shadow-lg w-full max-w-md border-2 border-[#ff8c42]">
                        <h3 className="text-lg font-semibold text-[#7A2F38] mb-2">Confirm</h3>
                        <p className="text-sm text-[#7A2F38] mb-4">{confirm.label}</p>
                        <div className="flex items-center justify-end space-x-3">
                            <button className={btnGhost} onClick={() => setConfirm({ open: false, label: '', action: null })}>Cancel</button>
                            <button className={btnPrimary} onClick={runConfirm}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
