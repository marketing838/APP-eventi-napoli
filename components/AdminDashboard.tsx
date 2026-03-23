
import React, { useState, useRef, useMemo } from 'react';
import { Lead, AcademyType, EventConfig, ACADEMY_THEMES, CheckInStatus, ORIENTATORI } from '../types';
import StatsCards from './StatsCards';
import LeadTable from './LeadTable';
import DiagnosticsPanel from './DiagnosticsPanel';
import TemplateSelector from './TemplateSelector';
import { parseCSV, generateCSV, syncLeadsNow, syncLeadsToCloud, deleteLeadFromCloud, saveLeadToCloud, loadPastEvents, downloadEventCSV, deleteEventFromCloud } from '../services/storageService';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';

interface AdminDashboardProps {
  leads: Lead[];
  activeEvent: EventConfig | null;
  onSetActiveEvent: (event: EventConfig | null) => void;
  onUpdateLeads: (leads: Lead[]) => void;
  onHardReset: () => void;
  onStopSession: () => void;
  onForceExit: () => void;  // Fix 2: emergenza — pulisce solo localStorage
  isAuthenticated: boolean;
  setIsAuthenticated: (val: boolean) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  leads, activeEvent, onSetActiveEvent, onUpdateLeads, onHardReset, onStopSession, onForceExit, isAuthenticated, setIsAuthenticated
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [newEventName, setNewEventName] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<AcademyType>('VIS');
  const [odDate, setOdDate] = useState('');
  const [odTime, setOdTime] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [orientatoreFilter, setOrientatoreFilter] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<'success' | 'error' | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [archiveEvents, setArchiveEvents] = useState<{ id: string; name: string; academy: string; date: string; updatedAtMs?: number }[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveDownloading, setArchiveDownloading] = useState<string | null>(null);
  const [archiveDeleting, setArchiveDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Aggiornata password richiesta: Plas1234!
    if (password === 'Plas1234!') {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Password Errata');
    }
  };

  const handleStartSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName) return;
    onSetActiveEvent({
      id: `ev-${Date.now()}`,
      name: newEventName,
      academy: selectedBrand,
      date: new Date().toISOString(),
      odDate: odDate || undefined,
      odTime: odTime || undefined,
    });
    setNewEventName('');
    setOdDate('');
    setOdTime('');
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text, activeEvent?.id);
      if (parsed.length > 0) {
        setIsImporting(true);
        setImportStatus(null);
        try {
          const mergedLeads = [...leads, ...parsed];
          // Eseguiamo il push IMMEDIATO e attendiamo conferma
          await syncLeadsToCloud(mergedLeads);
          onUpdateLeads(mergedLeads);
          setImportStatus('success');
        } catch (err: any) {
          console.error("Import error:", err);
          setImportStatus('error');
          alert(`Errore importazione: ${err.message || 'Errore sconosciuto'}`);
        } finally {
          setIsImporting(false);
          // Auto-nascondi banner dopo 6 secondi
          setTimeout(() => setImportStatus(null), 6000);
        }
      } else {
        alert("Errore nel file CSV.");
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const filteredLeads = useMemo(() => {
    let result = [...leads];

    // Filtro per Orientatore (Dropdown)
    if (orientatoreFilter) {
      result = result.filter(l => l.orientatore === orientatoreFilter);
    }

    // Filtri per Categoria (Card)
    if (activeFilter && activeFilter !== 'Totale Leads') {
      switch (activeFilter) {
        case 'Aggiornati':
          result = result.filter(l => l.stato_checkin !== CheckInStatus.NON_PERVENUTO);
          break;
        case 'Orientamento Fatto':
          result = result.filter(l => l.orientamento_effettuato === true);
          break;
        case 'Da Orientare':
          // LOGICA RICHIESTA: Chiunque abbia un orientatore assegnato MA non abbia ancora finito (senza vincolo di presenza)
          result = result.filter(l => l.orientatore && l.orientatore !== "" && !l.orientamento_effettuato && l.esito_iscrizione !== 'va via prima');
          break;
        case 'In Attesa':
          result = result.filter(l => l.stato_checkin === CheckInStatus.NON_PERVENUTO);
          break;
      }
    }

    return result;
  }, [leads, activeFilter, orientatoreFilter]);

  // Handshake Logic: Collega/Scollega due lead in modo bidirezionale e atomico
  const handleLinkLeads = async (leadId: string, partnerId: string | null) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    const batch = writeBatch(db);
    const eventId = activeEvent?.id;
    if (!eventId) return;

    let updatedLeads = [...leads];

    // Caso 1: SCOLLEGAMENTO (partnerId === null)
    if (!partnerId) {
      const oldPartnerId = lead.accompagnato_da_id;
      if (!oldPartnerId) return;

      // Update Lead A
      const leadRef = doc(db, 'events', eventId, 'leads', leadId);
      batch.update(leadRef, { accompagnato_da_id: null, updatedAtMs: Date.now() });
      updatedLeads = updatedLeads.map(l => l.id === leadId ? { ...l, accompagnato_da_id: undefined } : l);

      // Update Lead B (ex partner)
      const partnerRef = doc(db, 'events', eventId, 'leads', oldPartnerId);
      batch.update(partnerRef, { accompagnato_da_id: null, updatedAtMs: Date.now() });
      updatedLeads = updatedLeads.map(l => l.id === oldPartnerId ? { ...l, accompagnato_da_id: undefined } : l);
    } 
    // Caso 2: COLLEGAMENTO (partnerId impostato)
    else {
      const newPartner = leads.find(l => l.id === partnerId);
      if (!newPartner) return;

      // 1. Pulizia eventuali link precedenti di A
      if (lead.accompagnato_da_id) {
        const oldRef = doc(db, 'events', eventId, 'leads', lead.accompagnato_da_id);
        batch.update(oldRef, { accompagnato_da_id: null, updatedAtMs: Date.now() });
        updatedLeads = updatedLeads.map(l => l.id === lead.accompagnato_da_id ? { ...l, accompagnato_da_id: undefined } : l);
      }
      // 2. Pulizia eventuali link precedenti di B
      if (newPartner.accompagnato_da_id) {
        const oldRef = doc(db, 'events', eventId, 'leads', newPartner.accompagnato_da_id);
        batch.update(oldRef, { accompagnato_da_id: null, updatedAtMs: Date.now() });
        updatedLeads = updatedLeads.map(l => l.id === newPartner.accompagnato_da_id ? { ...l, accompagnato_da_id: undefined } : l);
      }

      // 3. Handshake A <-> B
      const leadRef = doc(db, 'events', eventId, 'leads', leadId);
      const partnerRef = doc(db, 'events', eventId, 'leads', partnerId);
      
      batch.update(leadRef, { accompagnato_da_id: partnerId, updatedAtMs: Date.now() });
      batch.update(partnerRef, { accompagnato_da_id: leadId, updatedAtMs: Date.now() });

      updatedLeads = updatedLeads.map(l => {
        if (l.id === leadId) return { ...l, accompagnato_da_id: partnerId };
        if (l.id === partnerId) return { ...l, accompagnato_da_id: leadId };
        return l;
      });
    }

    try {
      await batch.commit();
      onUpdateLeads(updatedLeads);
    } catch (e) {
      console.error("Batch link update failed:", e);
      alert("Errore durante il collegamento dei partner.");
    }
  };

  // Fix 4: updateDoc atomico — aggiorna SOLO il campo modificato
  // Evita sovrascritture ottimistiche tra 3 Admin simultanei che aggiornano campi diversi
  const handleUpdateLeadField = async (leadId: string, field: keyof Lead, value: any) => {
    const leadA = leads.find(l => l.id === leadId);
    if (!leadA) return;

    // Campi da sincronizzare se presente un partner (escluso esito_iscrizione come richiesto)
    const syncFields: (keyof Lead)[] = ['orientatore', 'orientamento_effettuato', 'bloccato', 'emergenza'];
    const partnerId = leadA.accompagnato_da_id;
    const shouldSync = syncFields.includes(field) && partnerId;

    // Aggiornamento locale immediato per feedback UI
    const updatedLeads = leads.map(l => {
      if (l.id === leadId || (shouldSync && l.id === partnerId)) {
        return { ...l, [field]: value };
      }
      return l;
    });
    onUpdateLeads(updatedLeads);

    // Scrittura Firestore
    if (activeEvent?.id) {
      try {
        if (shouldSync && partnerId) {
          // Scrittura atomica per entrambi i lead
          const batch = writeBatch(db);
          batch.update(doc(db, 'events', activeEvent.id, 'leads', leadId), { [field]: value, updatedAtMs: Date.now() });
          batch.update(doc(db, 'events', activeEvent.id, 'leads', partnerId), { [field]: value, updatedAtMs: Date.now() });
          await batch.commit();
        } else {
          // Scrittura singola standard
          const leadRef = doc(db, 'events', activeEvent.id, 'leads', leadId);
          await updateDoc(leadRef, { [field]: value, updatedAtMs: Date.now() });
        }
      } catch (e) {
        console.warn('⚠️ Update fallito per campo', field, e);
        // Fallback: se batch fallisce o non siamo in batch, prova il salvataggio standard sul lead principale
        try { await saveLeadToCloud({ ...leadA, [field]: value }); } catch { }
      }
    }
  };

  // Fix 5: carica archivio eventi on-demand (solo al click, non automatico)
  const handleToggleArchive = async () => {
    if (!showArchive) {
      setArchiveLoading(true);
      const events = await loadPastEvents().catch(() => []);
      setArchiveEvents(events as any);
      setArchiveLoading(false);
    }
    setShowArchive(s => !s);
  };

  const handleDeleteArchiveEvent = async (eventId: string) => {
    if (window.confirm('AZIONE DEFINITIVA: Vuoi eliminare questo evento e tutti i lead collegati dall\'archivio?')) {
      setArchiveDeleting(eventId);
      try {
        await deleteEventFromCloud(eventId);
        setArchiveEvents(prev => prev.filter(ev => ev.id !== eventId));
      } catch (err) {
        alert('Errore durante l\'eliminazione dell\'evento.');
      } finally {
        setArchiveDeleting(null);
      }
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (window.confirm('Sei sicuro di voler eliminare questo lead? Questa azione è irreversibile.')) {
      try {
        await deleteLeadFromCloud(leadId);
        onUpdateLeads(leads.filter(l => l.id !== leadId));
      } catch (error) {
        alert('Errore durante l\'eliminazione del lead');
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-gray-100 text-center animate-fadeIn">
          <div className="w-20 h-20 bg-black rounded-3xl mx-auto mb-8 flex items-center justify-center text-white text-3xl font-black italic shadow-2xl">!</div>
          <h2 className="text-3xl font-black mb-8 uppercase tracking-tighter italic text-gray-900">Admin Access</h2>
          <form onSubmit={handleLogin} className="space-y-6">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="DIGITA PASSWORD"
              className="w-full px-8 py-5 bg-gray-50 border-4 border-gray-100 rounded-2xl outline-none focus:border-black text-center font-black text-2xl tracking-widest text-gray-900 shadow-inner"
            />
            {error && <p className="text-red-500 font-black text-xs uppercase tracking-widest">{error}</p>}
            <button type="submit" className="w-full py-6 bg-black text-white font-black rounded-2xl shadow-2xl hover:bg-zinc-800 transition-all active:scale-95 uppercase tracking-tighter text-lg">Entra nel Sistema</button>
          </form>
        </div>
      </div>
    );
  }

  const theme = activeEvent ? ACADEMY_THEMES[activeEvent.academy] : ACADEMY_THEMES.GENERAL;

  return (
    <div className="space-y-10 animate-fadeIn">
      {/* Session Header */}
      <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl border border-gray-100">
        {activeEvent ? (
          <div className={`p-10 rounded-[2.5rem] border-4 border-${theme.primary} bg-${theme.secondary} flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl`}>
            <div>
              <span className={`bg-${theme.primary} text-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em]`}>SESSIONE LIVE ATTIVA</span>
              <h4 className="text-5xl font-black text-gray-900 mt-5 leading-none tracking-tighter uppercase italic">{activeEvent.name}</h4>
            </div>
            <button
              onClick={() => { if (window.confirm('Fermare il modulo? Potrai crearne uno nuovo.')) onStopSession(); }}
              className="px-12 py-7 bg-rose-600 hover:bg-rose-700 text-white rounded-[2rem] font-black shadow-2xl transition-all active:scale-90 uppercase tracking-tighter text-xl border-b-8 border-rose-800"
            >
              Interrompi Sessione
            </button>
          </div>
        ) : (
          <form onSubmit={handleStartSession} className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
            <div className="space-y-3">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-3">Titolo Evento</label>
              <input
                type="text"
                placeholder="es. Open Day VIS Marzo"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                className="w-full px-8 py-5 border-4 border-gray-100 rounded-[1.5rem] focus:border-black outline-none font-bold text-lg text-gray-900 bg-gray-50 shadow-inner"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-3">Target Accademia</label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value as AcademyType)}
                className="w-full px-8 py-5 border-4 border-gray-100 rounded-[1.5rem] font-black bg-white text-lg appearance-none cursor-pointer text-gray-900"
              >
                <option value="VIS">VIS (Tattoo)</option>
                <option value="REA">REA (Makeup)</option>
                <option value="DAM">DAM (Cinema)</option>
              </select>
            </div>
            <div className="space-y-3">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-3">📅 Data OD</label>
              <input
                type="date"
                value={odDate}
                onChange={(e) => setOdDate(e.target.value)}
                className="w-full px-6 py-5 border-4 border-gray-100 rounded-[1.5rem] focus:border-black outline-none font-bold text-base text-gray-900 bg-gray-50 shadow-inner"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-3">🕐 Ora OD</label>
              <input
                type="time"
                value={odTime}
                onChange={(e) => setOdTime(e.target.value)}
                className="w-full px-6 py-5 border-4 border-gray-100 rounded-[1.5rem] focus:border-black outline-none font-bold text-base text-gray-900 bg-gray-50 shadow-inner"
              />
            </div>
            <button type="submit" className="bg-black text-white py-6 px-10 rounded-[1.5rem] font-black shadow-2xl hover:bg-zinc-800 transition-all uppercase tracking-tighter text-xl border-b-8 border-zinc-900">
              Crea Sessione
            </button>
          </form>
        )}
      </div>

      {/* Fix 5: Archivio eventi passati — caricato on-demand, non imposta sessione live */}
      {!activeEvent && (
        <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-black uppercase tracking-widest text-gray-700">📦 Archivio Eventi Passati</h3>
            <button
              onClick={handleToggleArchive}
              className="px-6 py-3 rounded-2xl border-4 border-gray-100 text-gray-600 font-black uppercase text-xs hover:border-gray-400 transition-all"
            >
              {archiveLoading ? 'Caricamento...' : showArchive ? 'Chiudi' : 'Carica Lista'}
            </button>
          </div>
          {showArchive && (
            archiveEvents.length === 0 ? (
              <p className="text-gray-400 font-bold text-sm text-center py-4">Nessun evento passato trovato.</p>
            ) : (
              <div className="space-y-3">
                {archiveEvents.map(ev => (
                  <div key={ev.id} className="flex items-center justify-between p-5 rounded-2xl border-2 border-gray-100 hover:border-gray-200 transition-all">
                    <div>
                      <span className="font-black text-gray-900 text-sm">{ev.name}</span>
                      <span className="ml-3 px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-[10px] font-black uppercase">{ev.academy}</span>
                      <span className="ml-2 text-gray-400 text-xs">{ev.date ? new Date(ev.date).toLocaleDateString('it-IT') : ''}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={archiveDownloading === ev.id || archiveDeleting === ev.id}
                        onClick={async () => {
                          setArchiveDownloading(ev.id);
                          await downloadEventCSV(ev.id, ev.name);
                          setArchiveDownloading(null);
                        }}
                        className="px-5 py-2 rounded-xl bg-black text-white font-black uppercase text-[10px] hover:bg-zinc-800 transition-all disabled:opacity-50"
                      >
                        {archiveDownloading === ev.id ? 'Download...' : '⬇ Scarica CSV'}
                      </button>
                      <button
                        disabled={archiveDeleting === ev.id}
                        onClick={() => handleDeleteArchiveEvent(ev.id)}
                        className="p-2 rounded-xl bg-rose-50 text-rose-600 border-2 border-rose-100 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all disabled:opacity-50"
                        title="Elimina Evento"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      <StatsCards
        leads={leads}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {/* Status Banner */}
      {importStatus === 'success' && (
        <div className="bg-green-500 text-white p-6 rounded-[2rem] shadow-xl animate-bounce text-center font-black uppercase tracking-widest text-sm flex items-center justify-center gap-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
          DB importato correttamente in firebase
        </div>
      )}

      {isImporting && (
        <div className="bg-indigo-600 text-white p-6 rounded-[2rem] shadow-xl text-center font-black uppercase tracking-widest text-sm flex items-center justify-center gap-4 animate-pulse">
          <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          Sincronizzazione con Firebase in corso...
        </div>
      )}

      {importStatus === 'error' && (
        <div className="bg-rose-600 text-white p-6 rounded-[2rem] shadow-xl text-center font-black uppercase tracking-widest text-sm">
          ❌ Errore durante l'importazione. Riconnetti e riprova.
        </div>
      )}

      {/* Toolbar Comandi */}
      <div className="flex flex-wrap gap-8 items-center bg-white p-10 rounded-[3rem] shadow-2xl border border-gray-50">
        <div className="flex flex-col space-y-3 min-w-[350px]">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] ml-3">Filtra per Orientatore Assegnato:</label>
          <div className="flex items-center gap-4">
            <div className="relative flex-grow">
              <select
                value={orientatoreFilter}
                onChange={(e) => setOrientatoreFilter(e.target.value)}
                className="w-full px-8 py-6 border-4 border-indigo-100 rounded-[2rem] font-black uppercase text-sm bg-indigo-50 text-indigo-700 focus:border-indigo-600 outline-none appearance-none cursor-pointer shadow-lg"
              >
                <option value="">Visualizza Tutti i Leads</option>
                {ORIENTATORI.map(o => <option key={o} value={o}>LEADS DI {o.toUpperCase()}</option>)}
              </select>
              <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            <button
              onClick={async (e) => {
                const btn = e.currentTarget;
                btn.style.opacity = '0.5';
                btn.style.pointerEvents = 'none';
                try {
                  await syncLeadsNow();
                } catch (e) { }
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
              }}
              className="p-5 bg-white border-4 border-indigo-100 rounded-2xl text-indigo-600 hover:border-indigo-600 hover:shadow-lg transition-all"
              title="Sincronizza Ora"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 ml-auto">
          <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept=".csv" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!activeEvent}
            className={`px-10 py-5 rounded-[1.5rem] font-black uppercase text-xs transition-all border-4 ${!activeEvent
              ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed opacity-50'
              : 'bg-white text-black border-gray-100 hover:border-black hover:shadow-lg'
              }`}
            title={!activeEvent ? "Devi prima creare o selezionare una sessione attiva per importare leads" : "Carica file CSV dei leads"}
          >
            Importa CSV
          </button>
          <button
            onClick={() => setShowDiagnostics(s => !s)}
            className="w-10 h-10 flex items-center justify-center rounded-full opacity-10 hover:opacity-100 transition-opacity bg-gray-100 ml-4 focus:outline-none"
            title="Diagnostica"
          >
            🔬
          </button>
          {activeEvent && (
            <button
              onClick={() => setShowTemplateSelector(s => !s)}
              className={`px-8 py-5 rounded-[1.5rem] font-black uppercase text-xs transition-all shadow-sm border-4 ${showTemplateSelector ? 'bg-violet-600 text-white border-violet-500' : 'bg-violet-50 text-violet-600 border-violet-100 hover:bg-violet-100'}`}
            >
              📋 Template
            </button>
          )}
          <button
            onClick={() => { if (window.confirm('AZIONE DEFINITIVA: Vuoi azzerare il database?')) onHardReset(); }}
            className="bg-rose-50 text-rose-600 border-4 border-rose-100 px-10 py-5 rounded-[1.5rem] font-black uppercase text-xs hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-sm"
          >
            Azzera Database
          </button>
          {/* Fix 2: Force Exit — emergenza sessione bloccata, zero chiamate Firebase */}
          <button
            onClick={() => { if (window.confirm('FORCE EXIT: Pulisce solo localStorage. Usare solo in emergenza.\nContinuare?')) onForceExit(); }}
            className="bg-amber-50 text-amber-700 border-4 border-amber-200 px-8 py-5 rounded-[1.5rem] font-black uppercase text-xs hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all shadow-sm"
            title="Emergenza: pulisce localStorage senza chiamare Firebase"
          >
            🚨 Force Exit
          </button>
          <button
            onClick={() => {
              const csv = generateCSV(leads, activeEvent?.templateSnapshot);
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = `REPORT_OPEN_DAY.csv`;
              link.click();
            }}
            className="bg-black text-white px-12 py-5 rounded-[1.5rem] font-black uppercase text-xs hover:bg-zinc-800 transition-all shadow-2xl flex items-center space-x-3 border-b-8 border-zinc-900"
          >
            <span>Esporta Report Finale</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[4rem] shadow-2xl border border-gray-100 overflow-x-auto">
        <LeadTable
          leads={filteredLeads}
          onUpdateLeadField={handleUpdateLeadField}
          onLinkLeads={handleLinkLeads}
          onDeleteLead={handleDeleteLead}
          templateSnapshot={activeEvent?.templateSnapshot}
        />
      </div>

      {/* DIAGNOSTICA — visibile solo se l'admin lo abilita */}
      {showDiagnostics && (
        <DiagnosticsPanel
          currentView="ADMIN"
          activeEvent={activeEvent}
        />
      )}

      {/* TEMPLATE SELECTOR — visibile solo se c'è un evento attivo e l'admin lo apre */}
      {showTemplateSelector && activeEvent && (
        <TemplateSelector
          activeEvent={activeEvent}
          onEventUpdated={(updated) => {
            onSetActiveEvent(updated);
          }}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
