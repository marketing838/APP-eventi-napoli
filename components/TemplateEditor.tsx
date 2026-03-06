
import React, { useState, useCallback } from 'react';
import { FormTemplate, FieldDef, AcademyType, ACADEMY_THEMES } from '../types';
import { saveFormTemplate } from '../services/storageService';

// ─── Costanti ────────────────────────────────────────────────────────────────
const ACADEMY_OPTIONS: AcademyType[] = ['VIS', 'REA', 'DAM', 'AURA', 'GENERAL'];
const FIELD_TYPES: FieldDef['type'][] = ['text', 'email', 'tel', 'number', 'date', 'textarea', 'select', 'checkbox'];

/** Chiavi riservate — non possono essere usate per campi custom */
const RESERVED_KEYS = new Set([
    'nome', 'cognome', 'email', 'cellulare', 'eta', 'privacy_accettata',
    'stato_checkin', 'campi_modificati', 'data_checkin', 'orientatore',
    'accompagnatore', 'dipartimento_interesse', 'come_ci_hai_conosciuto', 'id',
    'eventId', 'createdAtMs', 'updatedAtMs',
]);

/** Chiavi locked che non devono mai essere rimosse */
const LOCKED_KEYS = new Set(['nome', 'cognome', 'email', 'cellulare']);

// ─── Helper ───────────────────────────────────────────────────────────────────
function labelToKey(label: string): string {
    return label
        .toLowerCase()
        .trim()
        .replace(/[àáâã]/g, 'a').replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i').replace(/[òóôõ]/g, 'o').replace(/[ùúûü]/g, 'u')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function uniqueKey(baseKey: string, existingKeys: string[]): string {
    if (!existingKeys.includes(baseKey)) return baseKey;
    let i = 2;
    while (existingKeys.includes(`${baseKey}_${i}`)) i++;
    return `${baseKey}_${i}`;
}

function validateTemplate(tpl: FormTemplate): string[] {
    const errors: string[] = [];
    if (!tpl.name.trim()) errors.push('Nome template obbligatorio');
    const keys = tpl.fields.map(f => f.key);
    if (new Set(keys).size !== keys.length) errors.push('Chiavi campo duplicate');
    tpl.fields.forEach(f => {
        if (!f.locked && RESERVED_KEYS.has(f.key)) errors.push(`Chiave riservata: "${f.key}"`);
        if (!f.label.trim()) errors.push(`Campo senza label (key: ${f.key})`);
        if (f.type === 'select' && (!f.options || f.options.length === 0))
            errors.push(`Il campo select "${f.label}" deve avere almeno 1 opzione`);
    });
    return errors;
}

// ─── Sub-componenti ───────────────────────────────────────────────────────────
const inputCls = 'w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-violet-500 focus:ring-2 focus:ring-violet-100 outline-none transition-all font-medium text-gray-800 text-sm';
const labelCls = 'block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1';

interface FieldRowProps {
    field: FieldDef;
    onChange: (updated: FieldDef) => void;
    onRemove: () => void;
}

const FieldRow: React.FC<FieldRowProps> = ({ field, onChange, onRemove }) => {
    const [optionsText, setOptionsText] = useState((field.options ?? []).join('\n'));
    const isLocked = !!field.locked;

    const update = (patch: Partial<FieldDef>) => onChange({ ...field, ...patch });

    return (
        <div className={`p-5 rounded-2xl border-2 space-y-3 ${isLocked ? 'bg-gray-50 border-gray-100 opacity-70' : 'bg-white border-gray-200 hover:border-violet-200'}`}>
            <div className="flex items-start gap-3">
                {/* Key badge */}
                <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-2 py-1 rounded-lg mt-1 shrink-0">{field.key}</span>

                {/* Label */}
                <div className="flex-1">
                    <input
                        disabled={isLocked}
                        value={field.label}
                        onChange={e => update({ label: e.target.value })}
                        placeholder="Label campo"
                        className={`${inputCls} ${isLocked ? 'cursor-not-allowed' : ''}`}
                    />
                </div>

                {/* Tipo */}
                <div className="w-32 shrink-0">
                    <select
                        disabled={isLocked}
                        value={field.type}
                        onChange={e => update({ type: e.target.value as FieldDef['type'] })}
                        className={`${inputCls} ${isLocked ? 'cursor-not-allowed' : ''}`}
                    >
                        {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                {/* Toggle required */}
                {!isLocked && (
                    <button
                        type="button"
                        onClick={() => update({ required: !field.required })}
                        className={`shrink-0 mt-1 px-3 py-1 rounded-full text-[10px] font-black uppercase border-2 transition-all ${field.required ? 'bg-rose-500 text-white border-rose-500' : 'bg-gray-100 text-gray-500 border-gray-200 hover:border-gray-300'}`}
                    >
                        {field.required ? 'Req.' : 'Opt.'}
                    </button>
                )}

                {/* Toggle visibleInAdminTable */}
                {!isLocked && (
                    <button
                        type="button"
                        onClick={() => update({ visibleInAdminTable: !(field.visibleInAdminTable ?? true) })}
                        className={`shrink-0 mt-1 px-3 py-1 rounded-full text-[10px] font-black uppercase border-2 transition-all ${(field.visibleInAdminTable ?? true) ? 'bg-indigo-100 text-indigo-600 border-indigo-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}
                        title="Visibile in tabella admin"
                    >
                        {(field.visibleInAdminTable ?? true) ? '👁 Tab' : '🙈 Tab'}
                    </button>
                )}

                {/* Remove */}
                {!isLocked ? (
                    <button
                        type="button"
                        onClick={onRemove}
                        className="shrink-0 mt-1 w-8 h-8 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white border-2 border-rose-200 transition-all font-black text-sm flex items-center justify-center"
                        title="Rimuovi campo"
                    >✕</button>
                ) : (
                    <div className="shrink-0 mt-1 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center" title="Campo bloccato">
                        <span className="text-gray-400 text-xs">🔒</span>
                    </div>
                )}
            </div>

            {/* Options editor (solo per select, non locked) */}
            {field.type === 'select' && !isLocked && (
                <div className="ml-20">
                    <label className={labelCls}>Opzioni (una per riga)</label>
                    <textarea
                        value={optionsText}
                        rows={3}
                        onChange={e => {
                            const val = e.target.value;
                            setOptionsText(val);
                            update({ options: val.split('\n').map(s => s.trim()).filter(Boolean) });
                        }}
                        className={inputCls}
                        placeholder="Prima opzione&#10;Seconda opzione&#10;Terza opzione"
                    />
                </div>
            )}
        </div>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────
interface TemplateEditorProps {
    template: FormTemplate;
    onSave: (saved: FormTemplate) => void;
    onCancel: () => void;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ template: initialTemplate, onSave, onCancel }) => {
    const [tpl, setTpl] = useState<FormTemplate>(JSON.parse(JSON.stringify(initialTemplate)));
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [success, setSuccess] = useState(false);
    const [newFieldLabel, setNewFieldLabel] = useState('');

    // Tema preset da academy
    const [useCustomTheme, setUseCustomTheme] = useState(!!(tpl.theme));

    const updateMeta = (patch: Partial<FormTemplate>) => setTpl(prev => ({ ...prev, ...patch }));

    const updateField = useCallback((index: number, updated: FieldDef) => {
        setTpl(prev => {
            const fields = [...prev.fields];
            fields[index] = updated;
            return { ...prev, fields };
        });
    }, []);

    const removeField = useCallback((index: number) => {
        setTpl(prev => ({ ...prev, fields: prev.fields.filter((_, i) => i !== index) }));
    }, []);

    const addField = () => {
        const label = newFieldLabel.trim();
        if (!label) return;
        const baseKey = labelToKey(label);
        const existingKeys = tpl.fields.map(f => f.key);
        const key = uniqueKey(baseKey, existingKeys);
        const newField: FieldDef = {
            key,
            label,
            type: 'text',
            required: false,
            visibleInAdminTable: true,
        };
        setTpl(prev => ({ ...prev, fields: [...prev.fields, newField] }));
        setNewFieldLabel('');
    };

    const handleSave = async () => {
        const validationErrors = validateTemplate(tpl);
        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            return;
        }
        setErrors([]);
        setSaving(true);
        try {
            await saveFormTemplate(tpl);
            setSuccess(true);
            setTimeout(() => {
                setSaving(false);
                onSave(tpl);
            }, 800);
        } catch (e) {
            setErrors([`Errore durante il salvataggio: ${e}`]);
            setSaving(false);
        }
    };

    // Aggiorna tema automaticamente quando cambia academy (se non custom)
    const handleAcademyChange = (academy: AcademyType) => {
        const preset = ACADEMY_THEMES[academy];
        updateMeta({
            academyTag: academy,
            theme: useCustomTheme ? tpl.theme : { primary: preset.primary, secondary: preset.secondary, gradient: preset.gradient },
        });
    };

    const isSeedTemplate = ['tpl-vis', 'tpl-rea', 'tpl-dam', 'tpl-aura', 'tpl-general'].includes(tpl.id);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter text-gray-900">
                        {initialTemplate.name ? `✏️ Modifica: ${initialTemplate.name}` : '✨ Nuovo Template'}
                    </h3>
                    {isSeedTemplate && (
                        <span className="inline-block mt-1 px-3 py-1 bg-amber-100 text-amber-700 border-2 border-amber-300 rounded-full text-[10px] font-black uppercase tracking-widest">
                            ⚠️ Template base — le modifiche sono permanenti
                        </span>
                    )}
                </div>
                <button
                    onClick={onCancel}
                    className="px-6 py-3 rounded-2xl border-2 border-gray-200 text-gray-500 font-black uppercase text-xs hover:bg-gray-100 transition-all"
                >
                    ← Annulla
                </button>
            </div>

            {/* Errori di validazione */}
            {errors.length > 0 && (
                <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 space-y-1">
                    {errors.map((e, i) => (
                        <p key={i} className="text-rose-700 text-[12px] font-bold">❌ {e}</p>
                    ))}
                </div>
            )}

            {/* Success */}
            {success && (
                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5">
                    <p className="text-emerald-700 font-black text-sm">✅ Template salvato con successo!</p>
                </div>
            )}

            {/* ── Sezione 1: Metadati ── */}
            <div className="bg-gray-50 rounded-[2rem] p-6 space-y-4">
                <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest">Metadati</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Nome template *</label>
                        <input
                            value={tpl.name}
                            onChange={e => updateMeta({ name: e.target.value })}
                            className={inputCls}
                            placeholder="Es. VIS Open Day 2025"
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Academy</label>
                        <select
                            value={tpl.academyTag}
                            onChange={e => handleAcademyChange(e.target.value as AcademyType)}
                            className={inputCls}
                        >
                            {ACADEMY_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                </div>
                <div>
                    <label className={labelCls}>Tag (separatori: virgola)</label>
                    <input
                        value={(tpl.tags ?? []).join(', ')}
                        onChange={e => updateMeta({ tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        className={inputCls}
                        placeholder="open-day, master-class, 2025"
                    />
                </div>
            </div>

            {/* ── Sezione 2: Tema ── */}
            <div className="bg-gray-50 rounded-[2rem] p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest">Tema colore</p>
                    <button
                        type="button"
                        onClick={() => {
                            const next = !useCustomTheme;
                            setUseCustomTheme(next);
                            if (!next) {
                                const preset = ACADEMY_THEMES[tpl.academyTag];
                                updateMeta({ theme: { primary: preset.primary, secondary: preset.secondary, gradient: preset.gradient } });
                            }
                        }}
                        className={`px-4 py-2 rounded-xl border-2 text-[10px] font-black uppercase transition-all ${useCustomTheme ? 'bg-violet-100 text-violet-700 border-violet-300' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                    >
                        {useCustomTheme ? 'Preset Academy (click per attivare)' : 'Override personalizzato'}
                    </button>
                </div>

                {/* Preset preview */}
                <div className="flex gap-3 flex-wrap">
                    {ACADEMY_OPTIONS.map(a => {
                        const t = ACADEMY_THEMES[a];
                        return (
                            <button
                                key={a}
                                type="button"
                                onClick={() => { handleAcademyChange(a); setUseCustomTheme(false); }}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${tpl.academyTag === a && !useCustomTheme ? `bg-${t.primary} text-white border-${t.primary}` : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                            >
                                {a}
                            </button>
                        );
                    })}
                </div>

                {/* Override theme */}
                {useCustomTheme && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className={labelCls}>Primary (es. violet-600)</label>
                            <input value={tpl.theme?.primary ?? ''} onChange={e => updateMeta({ theme: { ...(tpl.theme ?? { secondary: '', gradient: '' }), primary: e.target.value } })} className={inputCls} placeholder="violet-600" />
                        </div>
                        <div>
                            <label className={labelCls}>Secondary (es. violet-50)</label>
                            <input value={tpl.theme?.secondary ?? ''} onChange={e => updateMeta({ theme: { ...(tpl.theme ?? { primary: '', gradient: '' }), secondary: e.target.value } })} className={inputCls} placeholder="violet-50" />
                        </div>
                        <div>
                            <label className={labelCls}>Gradient (es. from-violet-600 to-purple-500)</label>
                            <input value={tpl.theme?.gradient ?? ''} onChange={e => updateMeta({ theme: { ...(tpl.theme ?? { primary: '', secondary: '' }), gradient: e.target.value } })} className={inputCls} placeholder="from-violet-600 to-purple-500" />
                        </div>
                    </div>
                )}
            </div>

            {/* ── Sezione 3: Fields Editor ── */}
            <div className="bg-gray-50 rounded-[2rem] p-6 space-y-4">
                <p className="text-[10px] font-black text-violet-600 uppercase tracking-widest">
                    Campi ({tpl.fields.length} totali · {tpl.fields.filter(f => f.locked).length} bloccati)
                </p>

                <div className="space-y-3">
                    {tpl.fields.map((field, i) => (
                        <FieldRow
                            key={field.key}
                            field={field}
                            onChange={updated => updateField(i, updated)}
                            onRemove={() => removeField(i)}
                        />
                    ))}
                </div>

                {/* Add field */}
                <div className="flex gap-3 pt-2">
                    <input
                        value={newFieldLabel}
                        onChange={e => setNewFieldLabel(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addField())}
                        placeholder="Nome del nuovo campo... (premi Enter o +)"
                        className={`${inputCls} flex-1`}
                    />
                    <button
                        type="button"
                        onClick={addField}
                        disabled={!newFieldLabel.trim()}
                        className="px-6 py-3 rounded-xl bg-violet-600 text-white font-black text-sm uppercase hover:bg-violet-700 disabled:opacity-40 transition-all shadow-md"
                    >
                        + Aggiungi
                    </button>
                </div>
                <p className="text-[10px] text-gray-400 font-bold">
                    La chiave viene generata automaticamente dal nome. I campi bloccati (🔒) non possono essere rimossi.
                </p>
            </div>

            {/* ── Save ── */}
            <div className="flex gap-4 justify-end pt-2">
                <button
                    onClick={onCancel}
                    className="px-8 py-4 rounded-2xl border-2 border-gray-200 text-gray-600 font-black uppercase text-xs hover:bg-gray-100 transition-all"
                >
                    Annulla
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-10 py-4 rounded-2xl bg-violet-600 text-white font-black uppercase text-sm hover:bg-violet-700 disabled:opacity-50 transition-all shadow-xl shadow-violet-200 border-b-4 border-violet-800"
                >
                    {saving ? 'Salvataggio...' : '💾 Salva Template'}
                </button>
            </div>
        </div>
    );
};

export default TemplateEditor;
