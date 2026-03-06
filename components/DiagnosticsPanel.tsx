
import React, { useState, useEffect } from 'react';
import { EventConfig, TemplateSnapshot } from '../types';
import { getSyncDiagnostics } from '../services/storageService';

interface DiagnosticsPanelProps {
    currentView: string;
    activeEvent: EventConfig | null;
}

const fmt = (ts: number | null): string => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleTimeString('it-IT');
};

const Badge = ({ ok, label }: { ok: boolean; label: string }) => (
    <span className={`inline-block px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest ${ok ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300' : 'bg-rose-100 text-rose-700 border-2 border-rose-300'}`}>
        {label}
    </span>
);

const Row = ({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) => (
    <div className={`flex items-start justify-between py-3 border-b border-gray-100 last:border-0 gap-4 ${warn ? 'bg-amber-50 -mx-4 px-4 rounded-xl' : ''}`}>
        <span className="text-[11px] font-black uppercase tracking-widest text-gray-400 flex-shrink-0">{label}</span>
        <span className="text-[13px] font-bold text-gray-800 text-right break-all">{value}</span>
    </div>
);

const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({ currentView, activeEvent }) => {
    const [diag, setDiag] = useState(() => getSyncDiagnostics());
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setDiag(getSyncDiagnostics());
            setTick(t => t + 1);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const snap = activeEvent?.templateSnapshot as TemplateSnapshot | undefined;
    const dynamicFieldCount = snap ? snap.fields.filter(f => !f.locked && f.visibleInAdminTable !== false).length : 0;
    const totalFields = snap ? snap.fields.length : 0;
    const isResourceExhausted = diag.lastErrorCode === 'resource-exhausted';

    return (
        <div className="bg-white border-4 border-dashed border-gray-200 rounded-[3rem] p-10 space-y-2">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter text-gray-900">🔬 Diagnostica Sistema</h3>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-1">Aggiornamento ogni 3s — tick #{tick}</p>
                </div>
                <div className="flex gap-3">
                    <Badge ok={diag.provider !== 'legacy'} label={diag.provider} />
                    <Badge ok={currentView === 'ADMIN'} label={currentView} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
                {/* Evento */}
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-300 mb-3">Evento Attivo</p>
                    <Row label="ID" value={activeEvent?.id ?? '—'} />
                    <Row label="Nome" value={activeEvent?.name ?? '—'} />
                    <Row label="Data" value={activeEvent?.date ? new Date(activeEvent.date).toLocaleDateString('it-IT') : '—'} />
                    <Row label="Academy" value={activeEvent?.academy ?? '—'} />
                </div>

                {/* Template Snapshot */}
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-300 mb-3">Template Snapshot</p>
                    <Row label="Template ID" value={activeEvent?.templateId ?? '—'} />
                    <Row label="Snapshot presente" value={<Badge ok={!!snap} label={snap ? 'SÌ' : 'NO'} />} />
                    <Row label="Totale campi" value={snap ? `${totalFields}` : '—'} />
                    <Row label="Campi dinamici (visibili)" value={snap ? `${dynamicFieldCount}` : '—'} />
                    {snap && (
                        <Row
                            label="Academy tag"
                            value={snap.academyTag}
                        />
                    )}
                </div>

                {/* Sync Status */}
                <div className="mt-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-300 mb-3">Sync Layer</p>
                    <Row label="Listener realtime" value={<Badge ok={diag.listenerActive} label={diag.listenerActive ? 'ATTIVO' : 'OFF'} />} />
                    <Row label="Listener evento ID" value={diag.listenerEventId ?? '—'} />
                    <Row label="Polling attivo" value={<Badge ok={diag.pollingActive} label={diag.pollingActive ? 'ATTIVO' : 'OFF'} />} />
                    <Row label="Ultimo snapshot" value={fmt(diag.lastSnapshotAt)} />
                    <Row label="Ultimo poll" value={fmt(diag.lastPollAt)} />
                </div>

                {/* Errori */}
                <div className="mt-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-300 mb-3">Errori</p>
                    <Row label="Errori totali" value={diag.errorCount === 0 ? <Badge ok label="0" /> : <span className="text-rose-600 font-black">{diag.errorCount}</span>} />
                    <Row
                        label="Ultimo codice"
                        value={diag.lastErrorCode ? <span className={isResourceExhausted ? 'text-rose-700 font-black animate-pulse' : 'text-amber-600 font-black'}>{diag.lastErrorCode}</span> : '—'}
                        warn={isResourceExhausted}
                    />
                    <Row label="Ultimo messaggio" value={diag.lastErrorMessage ?? '—'} />
                    {isResourceExhausted && (
                        <div className="mt-3 p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl text-[12px] font-bold text-rose-700">
                            ⚠️ RESOURCE_EXHAUSTED: Firestore quota raggiunta. Riduci la frequenza di polling o verifica il piano Firebase.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DiagnosticsPanel;
