
import React, { useState, useEffect, useCallback } from 'react';
import { EventConfig, FormTemplate, AcademyType, ACADEMY_THEMES, FieldDef } from '../types';
import {
    loadFormTemplates,
    applyTemplateToEvent,
    loadAllFormTemplates,
    deleteFormTemplate,
} from '../services/storageService';
import TemplateEditor from './TemplateEditor';

// ─── Campi locked base — usati per "Crea nuovo" ───────────────────────────────
const BASE_LOCKED_FIELDS: FieldDef[] = [
    { key: 'nome', label: 'Nome', type: 'text', required: true, locked: true, visibleInAdminTable: true },
    { key: 'cognome', label: 'Cognome', type: 'text', required: true, locked: true, visibleInAdminTable: true },
    { key: 'email', label: 'Email', type: 'email', required: true, locked: true, visibleInAdminTable: true },
    { key: 'cellulare', label: 'Telefono', type: 'tel', required: true, locked: true, visibleInAdminTable: true },
];

function emptyTemplate(academy: AcademyType): FormTemplate {
    const theme = ACADEMY_THEMES[academy];
    return {
        id: `tpl-custom-${Date.now()}`,
        name: '',
        academyTag: academy,
        tags: [],
        theme: { primary: theme.primary, secondary: theme.secondary, gradient: theme.gradient },
        fields: [...BASE_LOCKED_FIELDS],
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
    };
}

function duplicateTemplate(src: FormTemplate): FormTemplate {
    return {
        ...JSON.parse(JSON.stringify(src)),
        id: `${src.id}-copy-${Date.now()}`,
        name: `Copia di ${src.name}`,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
    };
}

// ─── Badge academy ────────────────────────────────────────────────────────────
const BADGE_COLORS: Record<string, string> = {
    VIS: 'bg-teal-100 text-teal-700 border-teal-300',
    REA: 'bg-rose-100 text-rose-700 border-rose-300',
    DAM: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    GENERAL: 'bg-slate-100 text-slate-700 border-slate-300',
};

const AcademyBadge = ({ academy }: { academy: AcademyType }) => (
    <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border-2 ${BADGE_COLORS[academy] ?? BADGE_COLORS.GENERAL}`}>
        {ACADEMY_THEMES[academy]?.label ?? academy}
    </span>
);

// ─── Props ────────────────────────────────────────────────────────────────────
interface TemplateSelectorProps {
    activeEvent: EventConfig;
    onEventUpdated: (updated: EventConfig) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────
const TemplateSelector: React.FC<TemplateSelectorProps> = ({ activeEvent, onEventUpdated }) => {
    const [templates, setTemplates] = useState<FormTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [confirmReplace, setConfirmReplace] = useState<string | null>(null);
    const [applying, setApplying] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'warning'; msg: string } | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Carica tutti i template (non filtrati) per il builder
    const loadTemplates = useCallback(async () => {
        setLoading(true);
        const all = await loadAllFormTemplates().catch(() => [] as FormTemplate[]);
        setTemplates(all);
        setLoading(false);
    }, []);

    useEffect(() => { loadTemplates(); }, [loadTemplates]);

    // ── Selezione template → evento ──────────────────────────────────────────
    const handleSelect = async (tpl: FormTemplate, force = false) => {
        if (activeEvent.templateSnapshot && !force) {
            setConfirmReplace(tpl.id);
            return;
        }
        setConfirmReplace(null);
        setApplying(tpl.id);
        setStatus(null);
        try {
            const updated = await applyTemplateToEvent(activeEvent, tpl, force);
            if (updated) {
                onEventUpdated(updated);
                setStatus({ type: 'success', msg: `Template "${tpl.name}" applicato con successo.` });
            }
        } catch {
            setStatus({ type: 'error', msg: `Errore durante l'applicazione del template.` });
        } finally {
            setApplying(null);
        }
    };

    // ── Elimina template ─────────────────────────────────────────────────────
    const handleDelete = async (tpl: FormTemplate, force = false) => {
        const result = await deleteFormTemplate(tpl.id, force).catch(() => 'blocked' as const);
        if (result === 'blocked') {
            setStatus({ type: 'warning', msg: `"${tpl.name}" è un template base protetto e non può essere eliminato.` });
        } else {
            setStatus({ type: 'success', msg: `Template "${tpl.name}" eliminato.` });
            setTemplates(prev => prev.filter(t => t.id !== tpl.id));
        }
        setDeletingId(null);
    };

    // ── Salvataggio dall'editor ──────────────────────────────────────────────
    const handleEditorSave = async (saved: FormTemplate) => {
        setTemplates(prev => {
            const idx = prev.findIndex(t => t.id === saved.id);
            if (idx === -1) return [...prev, saved];
            const next = [...prev];
            next[idx] = saved;
            return next;
        });
        setEditingTemplate(null);

        if (saved.id === activeEvent.templateId) {
            try {
                const updated = await applyTemplateToEvent(activeEvent, saved, true);
                if (updated) {
                    onEventUpdated(updated);
                    setStatus({ type: 'success', msg: `Template "${saved.name}" salvato e applicato all'evento attuale.` });
                }
            } catch {
                setStatus({ type: 'warning', msg: `Template salvato, ma errore nell'aggiornamento automatico dell'evento.` });
            }
        } else {
            setStatus({ type: 'success', msg: `Template "${saved.name}" salvato.` });
        }
    };

    const activeTemplateId = activeEvent.templateId;

    // ─── Schermata editor ─────────────────────────────────────────────────────
    if (editingTemplate) {
        return (
            <div className="bg-white border-4 border-dashed border-violet-200 rounded-[3rem] p-10">
                <TemplateEditor
                    template={editingTemplate}
                    onSave={handleEditorSave}
                    onCancel={() => setEditingTemplate(null)}
                />
            </div>
        );
    }

    // ─── Schermata lista ──────────────────────────────────────────────────────
    return (
        <div className="bg-white border-4 border-dashed border-indigo-200 rounded-[3rem] p-10 space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter text-gray-900">📋 Template Builder</h3>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                        Evento: <span className="text-gray-700">{activeEvent.name}</span> — <span className="text-gray-700">{activeEvent.academy}</span>
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {activeEvent.templateSnapshot && (
                        <span className="px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 border-2 border-emerald-300">
                            ✓ Snapshot attivo
                        </span>
                    )}
                    <button
                        onClick={() => setEditingTemplate(emptyTemplate(activeEvent.academy))}
                        className="px-6 py-3 rounded-2xl bg-violet-600 text-white font-black uppercase text-xs hover:bg-violet-700 transition-all shadow-lg shadow-violet-200 border-b-4 border-violet-800"
                    >
                        + Crea nuovo
                    </button>
                </div>
            </div>

            {/* Status message */}
            {status && (
                <div className={`px-6 py-4 rounded-2xl text-[12px] font-bold border-2 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                    status.type === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                        'bg-rose-50 text-rose-700 border-rose-300'
                    }`}>
                    {status.type === 'success' ? '✅ ' : status.type === 'warning' ? '⚠️ ' : '❌ '}{status.msg}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="text-center py-12 text-gray-400 font-black uppercase tracking-widest text-sm animate-pulse">
                    Caricamento template...
                </div>
            )}

            {/* Empty state */}
            {!loading && templates.length === 0 && (
                <div className="text-center py-12 space-y-4">
                    <p className="text-gray-300 font-black uppercase tracking-widest text-sm">Nessun template trovato</p>
                    <p className="text-[12px] text-gray-400">
                        Esegui <code className="bg-gray-100 px-2 py-1 rounded font-mono">npm run seed:templates</code> oppure crea un nuovo template.
                    </p>
                </div>
            )}

            {/* Template list */}
            {!loading && templates.length > 0 && (
                <div className="space-y-3">
                    {templates.map(tpl => {
                        const isActive = tpl.id === activeTemplateId;
                        const isApplying = applying === tpl.id;
                        const needsConfirm = confirmReplace === tpl.id;
                        const isDeleting = deletingId === tpl.id;
                        const isSeed = ['tpl-vis', 'tpl-rea', 'tpl-dam', 'tpl-general'].includes(tpl.id);
                        const dynamicCount = tpl.fields.filter(f => !f.locked && f.visibleInAdminTable !== false).length;

                        return (
                            <div
                                key={tpl.id}
                                className={`flex items-start justify-between gap-4 p-6 rounded-[2rem] border-4 transition-all ${isActive ? 'border-emerald-400 bg-emerald-50 shadow-emerald-100 shadow-lg' : 'border-gray-100 bg-white hover:border-gray-300'
                                    }`}
                            >
                                {/* Info */}
                                <div className="space-y-2 flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-black uppercase tracking-tight text-gray-900 text-base">{tpl.name}</span>
                                        {isActive && (
                                            <span className="px-3 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest">ATTIVO</span>
                                        )}
                                        {isSeed && (
                                            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-400 text-[10px] font-black uppercase">BASE</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <AcademyBadge academy={tpl.academyTag} />
                                        <span className="text-[11px] text-gray-400 font-bold">
                                            {tpl.fields.length} campi · {dynamicCount} dinamici
                                        </span>
                                        {tpl.tags && tpl.tags.length > 0 && (
                                            <span className="text-[10px] text-violet-400 font-bold">{tpl.tags.join(', ')}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                    {/* Confirm replace snapshot */}
                                    {needsConfirm ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-amber-700 font-black">Sostituire snapshot?</span>
                                            <button onClick={() => setConfirmReplace(null)} className="px-4 py-2 rounded-xl border-2 border-gray-200 text-gray-500 text-[11px] font-black uppercase hover:bg-gray-100 transition-all">Annulla</button>
                                            <button onClick={() => handleSelect(tpl, true)} className="px-4 py-2 rounded-xl bg-amber-500 text-white text-[11px] font-black uppercase hover:bg-amber-600 transition-all shadow-md">Sostituisci</button>
                                        </div>
                                    ) : isDeleting ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-rose-700 font-black">Conferma eliminazione?</span>
                                            <button onClick={() => setDeletingId(null)} className="px-4 py-2 rounded-xl border-2 border-gray-200 text-gray-500 text-[11px] font-black uppercase hover:bg-gray-100 transition-all">Annulla</button>
                                            <button onClick={() => handleDelete(tpl, false)} className="px-4 py-2 rounded-xl bg-rose-500 text-white text-[11px] font-black uppercase hover:bg-rose-600 transition-all shadow-md">Elimina</button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            {/* Seleziona / Sostituisci */}
                                            <button
                                                onClick={() => handleSelect(tpl)}
                                                disabled={isApplying}
                                                className={`px-5 py-2 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all border-4 disabled:opacity-50 ${isActive
                                                    ? 'bg-white text-emerald-700 border-emerald-300 hover:border-emerald-500'
                                                    : 'bg-black text-white border-black hover:bg-zinc-800 shadow-xl border-b-4 border-zinc-900'
                                                    }`}
                                            >
                                                {isApplying ? '...' : isActive ? 'Sostituisci' : 'Seleziona'}
                                            </button>
                                            {/* Duplica */}
                                            <button
                                                onClick={() => setEditingTemplate(duplicateTemplate(tpl))}
                                                className="px-4 py-2 rounded-xl border-2 border-gray-200 text-gray-600 text-[11px] font-black uppercase hover:bg-gray-100 hover:border-gray-300 transition-all"
                                                title="Duplica template"
                                            >
                                                📄 Duplica
                                            </button>
                                            {/* Modifica */}
                                            <button
                                                onClick={() => setEditingTemplate(JSON.parse(JSON.stringify(tpl)))}
                                                className="px-4 py-2 rounded-xl border-2 border-violet-200 text-violet-600 text-[11px] font-black uppercase hover:bg-violet-50 transition-all"
                                                title="Modifica template"
                                            >
                                                ✏️ Modifica
                                            </button>
                                            {/* Elimina */}
                                            <button
                                                onClick={() => setDeletingId(tpl.id)}
                                                className="w-8 h-8 rounded-full border-2 border-rose-100 text-rose-400 hover:bg-rose-50 hover:border-rose-300 transition-all font-black text-sm flex items-center justify-center"
                                                title={isSeed ? 'Template base (non eliminabile)' : 'Elimina template'}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default TemplateSelector;
