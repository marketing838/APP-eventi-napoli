
import { Lead, CheckInStatus, EventConfig, AcademyType, FieldDef, TemplateSnapshot, FormTemplate, ACADEMY_THEMES, ACADEMY_COURSES } from '../types';
import { db } from './firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, writeBatch, deleteDoc, getDocs } from 'firebase/firestore';

const STORAGE_KEY = 'event_leads_v7_stable';
const ACTIVE_EVENT_KEY = 'active_event_v7_stable';
const TIMESTAMP_KEY = 'event_leads_updated_at_v7';

const PROVIDER = (import.meta.env.VITE_STORAGE_PROVIDER || 'legacy') as 'legacy' | 'firestore' | 'dual';
console.log('🚀 Current Storage Provider:', PROVIDER);
if (PROVIDER !== 'legacy') {
  console.log('📦 Firebase Config detected:', {
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    hasApiKey: !!import.meta.env.VITE_FIREBASE_API_KEY
  });
}

// Helper to get local timestamp
const getLocalTimestamp = (): number => {
  const ts = localStorage.getItem(TIMESTAMP_KEY);
  return ts ? parseInt(ts, 10) : 0;
};

// Helper to set local timestamp
const setLocalTimestamp = (ts: number): void => {
  localStorage.setItem(TIMESTAMP_KEY, ts.toString());
};

// Internal debounce timer
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export const getLeads = (): Lead[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const syncLeadsToCloud = async (leads: Lead[]): Promise<void> => {
  const event = getActiveEvent();
  if (!event || PROVIDER === 'legacy') {
    if (!event) throw new Error('Nessuna sessione attiva.');
    return;
  }

  console.log(`📦 Starting bulk sync for ${leads.length} leads...`);

  try {
    const BATCH_SIZE = 500;
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = leads.slice(i, i + BATCH_SIZE);

      chunk.forEach(lead => {
        const leadRef = doc(db, 'events', event.id, 'leads', lead.id);
        // Pulizia campi undefined per Firestore
        const cleanLead = JSON.parse(JSON.stringify({
          ...lead,
          updatedAtMs: Date.now(),
          schemaVersion: "v8_collection"
        }));
        batch.set(leadRef, cleanLead, { merge: true });
      });

      await batch.commit();
      console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1} committato (${chunk.length} leads)`);
    }

    setLocalTimestamp(Date.now());
    console.log('🚀 Bulk sync completed successfully');
  } catch (error: any) {
    console.error('❌ Bulk sync failed:', error);
    throw error;
  }
};

/**
 * Salva un SINGOLO lead sul cloud in modo atomico.
 */
export const saveLeadToCloud = async (lead: Lead): Promise<void> => {
  const event = getActiveEvent();
  if (!event || PROVIDER === 'legacy') return;

  try {
    const leadRef = doc(db, 'events', event.id, 'leads', lead.id);
    // Fix 2: JSON round-trip elimina campi undefined che causano errori su Firestore setDoc
    const cleanLead = JSON.parse(JSON.stringify({
      ...lead,
      updatedAtMs: Date.now(),
      schemaVersion: 'v8_collection',
    }));
    await setDoc(leadRef, cleanLead, { merge: true });

    console.log(`✅ Lead ${lead.id} synced to cloud`);
  } catch (error) {
    console.warn(`❌ Single lead sync failed (${lead.id}):`, error);
  }
};

/**
 * Elimina un lead dal cloud e aggiorna lo stato locale.
 */
export const deleteLeadFromCloud = async (leadId: string): Promise<void> => {
  const event = getActiveEvent();
  if (!event || PROVIDER === 'legacy') return;

  try {
    const leadRef = doc(db, 'events', event.id, 'leads', leadId);
    await deleteDoc(leadRef);

    console.log(`🗑️ Lead ${leadId} deleted from cloud`);

    // Aggiorniamo anche localmente per feedback immediato
    const currentLeads = getLeads();
    const updatedLeads = currentLeads.filter(l => l.id !== leadId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLeads));
    setLocalTimestamp(Date.now());

    // Notifichiamo la UI
    window.dispatchEvent(new CustomEvent('leads-sync', { detail: updatedLeads }));
  } catch (error) {
    console.error(`❌ Delete lead failed (${leadId}):`, error);
    throw error;
  }
};

const pushToFirestore = async (leads: Lead[], timestamp: number) => {
  // Passivo per v8
};

export const saveLeads = (leads: Lead[]): void => {
  const timestamp = Date.now();

  // Always update local first (synchronous part)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  setLocalTimestamp(timestamp);

  if (PROVIDER === 'legacy') return;

  // Background sync with debounce
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    pushToFirestore(leads, timestamp);
  }, 500);
};

export const clearLeads = async (): Promise<void> => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  setLocalTimestamp(Date.now());

  if (PROVIDER !== 'legacy') {
    const event = getActiveEvent();
    if (event) {
      try {
        const leadsCol = collection(db, 'events', event.id, 'leads');
        const snapshot = await getDocs(leadsCol);
        if (!snapshot.empty) {
          const BATCH_SIZE = 500;
          const docs = snapshot.docs;
          for (let i = 0; i < docs.length; i += BATCH_SIZE) {
            const batch = writeBatch(db);
            docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
        }
        console.log('🧹 Firestore collection cleared');
      } catch (e) {
        console.warn('❌ clearLeads Firestore error:', e);
      }
    }
  }
};

export const getActiveEvent = (): EventConfig | null => {
  const data = localStorage.getItem(ACTIVE_EVENT_KEY);
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    if (parsed && !parsed.id) {
      console.warn('⚠️ Active event missing ID. Generating temporary ID...');
      parsed.id = `ev-auto-${Date.now()}`;
      localStorage.setItem(ACTIVE_EVENT_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch (e) {
    console.error('Error parsing active event:', e);
    return null;
  }
};

/**
 * Genera il template snapshot di default per una academy.
 * Contiene i campi base bloccati + i campi opzionali già in uso.
 * PHASE 2 — questo viene allegato all'evento quando creato dall'admin.
 */
export const getDefaultTemplateSnapshot = (academy: AcademyType): TemplateSnapshot => {
  const theme = ACADEMY_THEMES[academy] || ACADEMY_THEMES.GENERAL;
  const courses = ACADEMY_COURSES[academy] || [];

  const baseFields: FieldDef[] = [
    { key: 'nome', label: 'Nome', type: 'text', required: true, locked: true, visibleInAdminTable: true },
    { key: 'cognome', label: 'Cognome', type: 'text', required: true, locked: true, visibleInAdminTable: true },
    { key: 'email', label: 'Email', type: 'email', required: true, locked: true, visibleInAdminTable: true },
    { key: 'cellulare', label: 'Telefono', type: 'tel', required: true, locked: true, visibleInAdminTable: true },
  ];

  const extraFields: FieldDef[] = [
    { key: 'eta', label: 'Età', type: 'number', required: false, visibleInAdminTable: false },
    { key: 'come_ci_hai_conosciuto', label: 'Come ci hai conosciuto', type: 'text', required: false, visibleInAdminTable: false },
    {
      key: 'dipartimento_interesse',
      label: 'Corso di Interesse',
      type: 'select',
      required: false,
      options: courses,
      visibleInAdminTable: true
    },
    { key: 'accompagnatore', label: 'Accompagnatore', type: 'select', required: false, options: ['Solo', 'Genitore', 'Amico'], visibleInAdminTable: false },
  ];

  return {
    name: academy,
    academyTag: academy,
    theme: {
      primary: theme.primary,
      secondary: theme.secondary,
      gradient: theme.gradient,
    },
    fields: [...baseFields, ...extraFields],
  };
};

export const setActiveEvent = async (event: EventConfig | null): Promise<void> => {
  const current = getActiveEvent();
  if (JSON.stringify(current) === JSON.stringify(event)) return;

  if (event) {
    if (!event.id) event.id = `ev-${Date.now()}`;

    // PHASE 2: se l'evento non ha ancora un templateSnapshot, lo alleghiamo ora.
    // Questo path viene eseguito SOLO dall'Admin (setActiveEvent non viene chiamato da USER).
    if (!event.templateSnapshot) {
      event.templateSnapshot = getDefaultTemplateSnapshot(event.academy || 'GENERAL');
      console.log('📋 Template snapshot generato per evento:', event.name);
    }

    localStorage.setItem(ACTIVE_EVENT_KEY, JSON.stringify(event));

    if (PROVIDER !== 'legacy') {
      // Persiste l'evento su events/{eventId} — await per garantire completamento prima di reload
      const eventDocRef = doc(db, 'events', event.id);
      await setDoc(eventDocRef, {
        id: event.id,
        name: event.name,
        academy: event.academy,
        date: event.date,
        templateSnapshot: event.templateSnapshot ?? null,
        updatedAtMs: Date.now(),
      }, { merge: true }).catch(e => console.warn('⚠️ Failed to save event metadata:', e));

      // Global sync: aggiorna anche settings/current_session — await per sincronizzazione sicura
      const settingsRef = doc(db, 'settings', 'current_session');
      await setDoc(settingsRef, {
        event,
        updatedAtMs: Date.now()
      }).catch(e => console.warn('Failed to sync global session:', e));
    }
  } else {
    localStorage.removeItem(ACTIVE_EVENT_KEY);
    if (PROVIDER !== 'legacy') {
      const settingsRef = doc(db, 'settings', 'current_session');
      // await: garantisce che Firestore riceva event=null prima del window.location.reload()
      await setDoc(settingsRef, {
        event: null,
        updatedAtMs: Date.now()
      }).catch(e => console.warn('Failed to clear global session:', e));
    }
  }

  // Restart background sync if event changed and not legacy
  if (PROVIDER !== 'legacy' && event) {
    initBackgroundSync(event.id);
  }
};

// Background Sync Logic
let unsubscribe: (() => void) | null = null;
let pollingInterval: ReturnType<typeof setInterval> | null = null;
let currentListenerEventId: string | null = null;

// Diagnostics state — updated by the sync functions below
const _diag = {
  listenerActive: false,
  listenerEventId: null as string | null,
  pollingActive: false,
  lastSnapshotAt: null as number | null,
  lastPollAt: null as number | null,
  errorCount: 0,
  lastErrorMessage: null as string | null,
  lastErrorCode: null as string | null,
};

/** Read-only snapshot of the current sync diagnostics. Safe to call from any component. */
export const getSyncDiagnostics = () => ({
  provider: PROVIDER,
  listenerActive: _diag.listenerActive,
  listenerEventId: _diag.listenerEventId,
  pollingActive: _diag.pollingActive,
  lastSnapshotAt: _diag.lastSnapshotAt,
  lastPollAt: _diag.lastPollAt,
  errorCount: _diag.errorCount,
  lastErrorMessage: _diag.lastErrorMessage,
  lastErrorCode: _diag.lastErrorCode,
});

const initBackgroundSync = (eventId: string) => {
  // Guard — non ri-creare listener se già attivo sullo stesso evento
  if (eventId === currentListenerEventId && unsubscribe) {
    console.log(`📡 Listener già attivo per evento: ${eventId}, skip re-init`);
    return;
  }

  // Cleanup listener precedente
  if (unsubscribe) unsubscribe();
  // Fix 1: rimosso pollingInterval (getDocs ogni 15s bruciava 500k+ letture/giorno su free tier)
  if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
  if (PROVIDER === 'legacy') return;

  currentListenerEventId = eventId;
  _diag.listenerEventId = eventId;
  _diag.listenerActive = true;
  _diag.pollingActive = false; // polling rimosso
  console.log(`📡 Avvio Real-time Listener per evento: ${eventId}`);
  const leadsCol = collection(db, 'events', eventId, 'leads');

  // onSnapshot: connessione persistente WebSocket — NON consuma letture Firestore aggiuntive
  unsubscribe = onSnapshot(leadsCol, (snapshot) => {
    const firebaseLeads = snapshot.docs.map(doc => doc.data() as Lead);
    console.log(`📥 Snapshot: ${firebaseLeads.length} leads ricevuti da Cloud`);
    _diag.lastSnapshotAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(firebaseLeads));
    setLocalTimestamp(Date.now());
    window.dispatchEvent(new CustomEvent('leads-sync', { detail: firebaseLeads }));
  }, (error) => {
    _diag.errorCount++;
    _diag.lastErrorMessage = error.message ?? String(error);
    _diag.lastErrorCode = (error as any).code ?? null;
    console.warn('❌ Firestore snapshot error:', error);
  });
  // NOTA: nessun polling di fallback — onSnapshot è sufficiente e free-tier safe
};

// NOTA: initBackgroundSync non parte più automaticamente al caricamento.
// Viene avviata SOLO dall'ADMIN via enableLeadsSync() per non sovraccaricare
// i dispositivi USER con listener/polling sull'intera collection.

/**
 * Abilita il listener realtime + polling fallback per la collection dei lead.
 * Da chiamare SOLO quando la view è ADMIN.
 */
export const enableLeadsSync = (eventId: string): void => {
  if (PROVIDER === 'legacy') return;
  initBackgroundSync(eventId);
};

/**
 * Disabilita listener e polling dei lead (quando si torna in view USER).
 */
export const disableLeadsSync = (): void => {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
  currentListenerEventId = null;
  _diag.listenerActive = false;
  _diag.listenerEventId = null;
  _diag.pollingActive = false;
  console.log('🔇 Lead sync disabilitato (view USER)');
};

/**
 * Lookup mirato su Firestore per email o telefono.
 * Usato dal flusso USER al check-in senza caricare l'intera lista.
 *
 * STRATEGIA TELEFONO (doppia query + migrazione on-the-fly):
 * 1. Cerca per cellulare_search (campo normalizzato — lead da Round 2 in poi)
 * 2. Se non trova (lead storici senza il campo), getDocs completo + filtro raw
 * 3. Quando trovato con fallback, aggiunge cellulare_search al documento.
 */
export const findLeadByEmailOrPhone = async (
  eventId: string,
  _email?: string, // Parametro ignorato per match solo cellulare
  phone?: string  // deve essere già normalizzato (solo cifre) dal chiamante
): Promise<Lead | null> => {
  const normSearch = phone || '';
  const cleanSearchForm = normSearch.startsWith('39') && normSearch.length > 10 ? normSearch.substring(2) : normSearch;

  if (PROVIDER === 'legacy') {
    const local = getLeads();
    return local.find(l => {
      if (!cleanSearchForm) return false;
      const dbPhone1 = (l.cellulare_search || '').replace(/\D/g, '');
      const cleanDb1 = dbPhone1.startsWith('39') && dbPhone1.length > 10 ? dbPhone1.substring(2) : dbPhone1;
      const dbPhone2 = (l.cellulare || '').replace(/\D/g, '');
      const cleanDb2 = dbPhone2.startsWith('39') && dbPhone2.length > 10 ? dbPhone2.substring(2) : dbPhone2;
      return cleanSearchForm === cleanDb1 || cleanSearchForm === cleanDb2;
    }) || null;
  }

  try {
    const {
      query: fsQuery,
      where,
      getDocs: fsGetDocs,
      collection: fsCollection,
      updateDoc: fsUpdateDoc,
    } = await import('firebase/firestore');
    const leadsCol = fsCollection(db, 'events', eventId, 'leads');

    if (cleanSearchForm) {
      // Query 1: campo normalizzato (cerchiamo con e senza il 39 iniziale tramite 'in')
      const q1 = fsQuery(leadsCol, where('cellulare_search', 'in', [cleanSearchForm, `39${cleanSearchForm}`]));
      const snap1 = await fsGetDocs(q1);
      if (!snap1.empty) return snap1.docs[0].data() as Lead;

      // Query 2: fallback per lead storici o con prefisso (scan)
      console.log(`🔍 cellulare_search miss per ${cleanSearchForm}, scan fallback raw...`);
      const snapAll = await fsGetDocs(leadsCol);
      const match = snapAll.docs.find(d => {
        const dbPhone1 = (d.data().cellulare_search || '').replace(/\D/g, '');
        const cleanDb1 = dbPhone1.startsWith('39') && dbPhone1.length > 10 ? dbPhone1.substring(2) : dbPhone1;

        const dbPhone2 = (d.data().cellulare || '').replace(/\D/g, '');
        const cleanDb2 = dbPhone2.startsWith('39') && dbPhone2.length > 10 ? dbPhone2.substring(2) : dbPhone2;

        return cleanSearchForm === cleanDb1 || cleanSearchForm === cleanDb2;
      });
      if (match) {
        const data = match.data() as Lead;
        // Migrazione on-the-fly: aggiorna il campo per renderlo veloce la prossima volta
        fsUpdateDoc(match.ref, { cellulare_search: cleanSearchForm }).catch(e =>
          console.warn('⚠️ Migrazione cellulare_search fallita:', e)
        );
        console.log('✅ Lead trovato via scan raw con match esatto, migrazione avviata');
        return data;
      }
    }

    // Fallback finale: localStorage (lead non ancora sincronizzati su Firestore)
    const local = getLeads();
    const localMatch = local.find(l => {
      if (!cleanSearchForm) return false;
      const dbPhone1 = (l.cellulare_search || '').replace(/\D/g, '');
      const cleanDb1 = dbPhone1.startsWith('39') && dbPhone1.length > 10 ? dbPhone1.substring(2) : dbPhone1;
      const dbPhone2 = (l.cellulare || '').replace(/\D/g, '');
      const cleanDb2 = dbPhone2.startsWith('39') && dbPhone2.length > 10 ? dbPhone2.substring(2) : dbPhone2;
      return cleanSearchForm === cleanDb1 || cleanSearchForm === cleanDb2;
    });
    if (localMatch) {
      console.log('📦 Lead trovato in localStorage (non sincronizzato su Firestore)');
      return localMatch;
    }

    return null;
  } catch (e) {
    console.warn('⚠️ findLeadByEmailOrPhone Firestore fallito, fallback locale:', e);
    const local = getLeads();
    return local.find(l => {
      if (!cleanSearchForm) return false;
      const dbPhone1 = (l.cellulare_search || '').replace(/\D/g, '');
      const cleanDb1 = dbPhone1.startsWith('39') && dbPhone1.length > 10 ? dbPhone1.substring(2) : dbPhone1;
      const dbPhone2 = (l.cellulare || '').replace(/\D/g, '');
      const cleanDb2 = dbPhone2.startsWith('39') && dbPhone2.length > 10 ? dbPhone2.substring(2) : dbPhone2;
      return cleanSearchForm === cleanDb1 || cleanSearchForm === cleanDb2;
    }) || null;
  }
};

/**
 * Aggiorna lo stato di sincronizzazione Zapier di un lead su Firestore.
 */
export const updateLeadSyncedStatus = async (eventId: string, leadId: string, synced: boolean) => {
  if (PROVIDER === 'legacy') return;
  try {
    const { doc: fsDoc, updateDoc: fsUpdateDoc } = await import('firebase/firestore');
    const leadRef = fsDoc(db, 'events', eventId, 'leads', leadId);
    await fsUpdateDoc(leadRef, { zapier_synced: synced });
    console.log(`📡 Lead ${leadId} zapier_synced set to ${synced}`);
  } catch (e) {
    console.error('❌ updateLeadSyncedStatus fallito:', e);
  }
};


// Global Session Sync: aggiorna solo l'evento attivo in localStorage.
// NON avvia il listener sui lead (quello è riservato a ADMIN via enableLeadsSync).
if (PROVIDER !== 'legacy') {
  const settingsRef = doc(db, 'settings', 'current_session');
  onSnapshot(settingsRef, (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    const serverEvent = data.event as EventConfig | null;
    const localEvent = getActiveEvent();

    if (JSON.stringify(serverEvent) !== JSON.stringify(localEvent)) {
      console.log('🔄 Session update:', serverEvent?.name || 'Session Closed');

      if (serverEvent) {
        localStorage.setItem(ACTIVE_EVENT_KEY, JSON.stringify(serverEvent));
        // NON chiamiamo initBackgroundSync qui — solo ADMIN deve farlo via enableLeadsSync
      } else {
        localStorage.removeItem(ACTIVE_EVENT_KEY);
        // Se la sessione viene chiusa, stoppiamo anche il listener se attivo
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
        currentListenerEventId = null;
      }

      window.dispatchEvent(new CustomEvent('session-sync', { detail: serverEvent }));
    }
  }, (error) => {
    console.error('❌ Firestore Session Sync Error:', error.message);
    if (error.code === 'permission-denied') {
      console.warn('⚠️ Controlla le regole Firestore (devono essere aperte o in Test Mode).');
    }
  });
}

export const parseCSV = (text: string, eventId?: string): Lead[] => {
  const cleanText = text.replace(/^\uFEFF/, '').trim();
  const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  // Rilevamento automatico delimitatore (; o ,)
  const firstLine = lines[0];
  const countSemicolon = (firstLine.match(/;/g) || []).length;
  const countComma = (firstLine.match(/,/g) || []).length;
  const delimiter = countSemicolon >= countComma ? ';' : ',';

  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());

  return lines.slice(1).map((line, index) => {
    const values = line.split(delimiter).map(v => v.trim());
    const lead: Lead = {
      id: `lead-${Date.now()}-${Math.floor(Math.random() * 10000)}-${index}`,
      nome: '',
      cognome: '',
      email: '',
      cellulare: '',
      eta: '',
      come_ci_hai_conosciuto: '',
      corso_di_interesse: '',
      dipartimento_interesse: '',
      stato_checkin: CheckInStatus.NON_PERVENUTO,
      campi_modificati: 'nessuno',
      eventId: eventId,
      orientamento_effettuato: false,
      bloccato: false,
      privacy_accettata: false
    };

    headers.forEach((header, i) => {
      const val = values[i] || '';
      if (header === 'nome') lead.nome = val;
      else if (header === 'cognome') lead.cognome = val;
      else if (header === 'e-mail' || header === 'email') lead.email = val.toLowerCase();
      else if (header === 'telefono' || header === 'cellulare') {
        lead.cellulare = val;
        // Fix 3: genera campo normalizzato per ricerca Firestore infallibile
        lead.cellulare_search = val.replace(/\D/g, '');
      }
      else if (header === 'corso di interesse') {
        lead.corso_di_interesse = val;
        lead.dipartimento_interesse = val;
      }
    });

    return lead;
  });
};

/**
 * Carica la lista degli eventi passati da Firestore (solo metadati, NO lead).
 * Da chiamare SOLO su click admin — non in automatico.
 */
export const loadPastEvents = async (): Promise<{ id: string; name: string; academy: string; date: string }[]> => {
  if (PROVIDER === 'legacy') return [];
  try {
    const snap = await getDocs(collection(db, 'events'));
    const activeId = getActiveEvent()?.id;
    return snap.docs
      .map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || d.id,
          academy: data.academy || '',
          date: data.date || '',
          updatedAtMs: data.updatedAtMs || 0,
        };
      })
      .filter(ev => ev.id !== activeId)
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  } catch (e) {
    console.warn('⚠️ loadPastEvents error:', e);
    return [];
  }
};

/**
 * Scarica il CSV di un evento passato eseguendo getDocs sulla sua sub-collection leads.
 * NON modifica l'evento attivo né lo stato locale.
 */
export const downloadEventCSV = async (eventId: string, eventName: string, snapshot?: TemplateSnapshot): Promise<void> => {
  if (PROVIDER === 'legacy') {
    alert('Archivio non disponibile in modalità legacy.');
    return;
  }
  try {
    const snap = await getDocs(collection(db, 'events', eventId, 'leads'));
    const leads = snap.docs.map(d => d.data() as Lead);
    const csv = generateCSV(leads, snapshot);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `REPORT_${eventName.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (e) {
    console.warn('⚠️ downloadEventCSV error:', e);
    alert('Errore nel download del report.');
  }
};

/**
 * Elimina un evento e tutti i lead associati da Firestore.
 */
export const deleteEventFromCloud = async (eventId: string): Promise<void> => {
  if (PROVIDER === 'legacy') return;
  try {
    const leadsCol = collection(db, 'events', eventId, 'leads');
    const snapshot = await getDocs(leadsCol);

    // 1. Elimina i lead in batch
    if (!snapshot.empty) {
      const BATCH_SIZE = 500;
      const docs = snapshot.docs;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }

    // 2. Elimina il documento evento
    await deleteDoc(doc(db, 'events', eventId));
    console.log(`🗑️ Evento ${eventId} e relativi lead eliminati dal cloud`);
  } catch (e) {
    console.error(`❌ deleteEventFromCloud failed (${eventId}):`, e);
    throw e;
  }
};

/**
 * Esporta i lead come CSV.
 * PHASE 2: accetta un secondo parametro opzionale templateSnapshot.
 * Se presente, aggiunge le colonne dinamiche (campi non bloccati + visibleInAdminTable !== false).
 * Backward-compatible: senza templateSnapshot il CSV è identico a prima.
 */
/** Racchiude tra virgolette i valori che contengono ; o newline (RFC 4180 / compatibile Excel). */
const escapeCSV = (val: string): string => {
  if (val.includes(';') || val.includes('\n') || val.includes('\r') || val.includes('"')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
};

export const generateCSV = (leads: Lead[], templateSnapshot?: TemplateSnapshot): string => {
  // Colonne base (invariate) + nuova intestazione Tipo Leads e Invio Zapier all'inizio
  const baseHeaders = ['Tipo Leads', 'Invio Zapier', 'Nome', 'Cognome', 'Corso di Interesse', 'Insieme a', 'Telefono', 'E-mail', 'Fonte', 'Accompagnatore', 'Orientatore', 'Orientamento Fatto', 'Esito Iscrizione', 'Bloccato', 'Privacy Accettata', 'Stato Check-in', 'Data'];

  // Colonne dinamiche (solo se snapshot presente)
  const dynamicFields = templateSnapshot
    ? templateSnapshot.fields.filter(f => !f.locked && f.visibleInAdminTable !== false)
    : [];

  const headers = [...baseHeaders, ...dynamicFields.map(f => f.label), 'Webhook Napoli'];

  const rows = leads.map(l => {
    let tipoLeads = 'Nuovo Leads';
    if (l.stato_checkin === CheckInStatus.AGGIORNATO || l.stato_checkin === CheckInStatus.CONFERMATO) {
      if (l.campi_modificati && l.campi_modificati !== 'nessuno') {
        if (l.campi_modificati.includes('modificato campo')) {
          tipoLeads = `Leads Aggiornato: ${l.campi_modificati}`;
        } else {
          tipoLeads = `Leads Aggiornato: campi modificati: ${l.campi_modificati}`;
        }
      } else {
        tipoLeads = 'Leads Già Presente (nessuna modifica)';
      }
    } else if (l.stato_checkin === CheckInStatus.NON_PERVENUTO) {
      tipoLeads = 'Pre-Iscritto (In Attesa)';
    }

    const zapierStatus = l.zapier_synced ? 'Inviato' : 'Non Inviato';

    // Trova partner per nome nel CSV
    let partnerName = '';
    if (l.accompagnato_da_id) {
      const p = leads.find(lead => lead.id === l.accompagnato_da_id);
      if (p) partnerName = `${p.nome} ${p.cognome}`;
    }

    return [
      tipoLeads,
      zapierStatus,
      l.nome,
      l.cognome,
      l.dipartimento_interesse || l.corso_di_interesse || '',
      partnerName,
      l.cellulare,
      l.email,
      l.come_ci_hai_conosciuto || '',
      l.accompagnatore || 'Nessuno',
      l.orientatore || 'Non Assegnato',
      l.orientamento_effettuato ? 'SI' : 'NO',
      l.esito_iscrizione ? l.esito_iscrizione.toUpperCase() : '',
      l.bloccato ? 'SI' : 'NO',
      l.privacy_accettata ? 'SI' : 'NO',
      l.stato_checkin,
      l.data_checkin || '',
      // Valori dinamici
      ...dynamicFields.map(f => {
        const val = l.answers?.[f.key] ?? '';
        return typeof val === 'boolean' ? (val ? 'SI' : 'NO') : String(val);
      }),
      l.zapier_synced ? 'INVIATO' : 'DA INVIARE'
    ].map(v => escapeCSV(String(v)));
  });

  return [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
};

export const syncLeadsNow = async (): Promise<void> => {
  const event = getActiveEvent();
  if (!event || PROVIDER === 'legacy') return;

  try {
    const leadsCol = collection(db, 'events', event.id, 'leads');
    const snapshot = await getDocs(leadsCol);
    const leads = snapshot.docs.map(d => d.data() as Lead);

    // Aggiorna locale e notifica UI
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
    setLocalTimestamp(Date.now());
    window.dispatchEvent(new CustomEvent('leads-sync', { detail: leads }));
    console.log('🔄 Manual sync OK:', leads.length, 'leads');
  } catch (error) {
    console.error('❌ Manual sync failed:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3.1 — Template Selector Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Carica i template disponibili per la academy specificata (o GENERAL).
 * Filtra la collection formTemplates su Firestore.
 * Ritorna [] se il provider è legacy o se non ci sono template.
 */
export const loadFormTemplates = async (academy: AcademyType): Promise<FormTemplate[]> => {
  if (PROVIDER === 'legacy') return [];
  try {
    const col = collection(db, 'formTemplates');
    // Carica tutti i template per la academy o GENERAL
    const academyQ = query(col, where('academyTag', '==', academy));
    const generalQ = query(col, where('academyTag', '==', 'GENERAL'));
    const [academySnap, generalSnap] = await Promise.all([
      getDocs(academyQ),
      getDocs(generalQ),
    ]);
    const templates: FormTemplate[] = [];
    academySnap.docs.forEach(d => templates.push({ id: d.id, ...d.data() } as FormTemplate));
    // Aggiungi GENERAL solo se diverso dall'academy richiesta
    if (academy !== 'GENERAL') {
      generalSnap.docs.forEach(d => templates.push({ id: d.id, ...d.data() } as FormTemplate));
    }
    console.log(`📝 loadFormTemplates: ${templates.length} template per [${academy}]`);
    return templates;
  } catch (e) {
    console.warn('⚠️ loadFormTemplates error:', e);
    return [];
  }
};

/**
 * Applica un FormTemplate all'evento attivo:
 * - congela templateSnapshot sull'evento
 * - imposta templateId = template.id
 * - persiste su events/{eventId} e settings/current_session
 *
 * GUARD: se activeEvent.templateSnapshot già esiste e force===false:
 *   ritorna null (la UI deve chiedere conferma all'admin).
 * Se force===true, sovrascrive.
 *
 * Non tocca il sync layer (enableLeadsSync/disableLeadsSync rimangono invariati).
 */
export const applyTemplateToEvent = async (
  activeEvent: EventConfig,
  template: FormTemplate,
  force = false
): Promise<EventConfig | null> => {
  // Guard anti-sovrascrittura
  if (activeEvent.templateSnapshot && !force) {
    console.log('🛡️ applyTemplateToEvent: snapshot già presente, force=false. Richiesta conferma.');
    return null;
  }

  const snapshot: TemplateSnapshot = {
    name: template.name,
    academyTag: template.academyTag,
    theme: template.theme,
    fields: template.fields,
  };

  const updatedEvent: EventConfig = {
    ...activeEvent,
    templateSnapshot: snapshot,
    templateId: template.id,
  };

  // Aggiorna localStorage
  localStorage.setItem(ACTIVE_EVENT_KEY, JSON.stringify(updatedEvent));

  if (PROVIDER !== 'legacy') {
    const eventDocRef = doc(db, 'events', updatedEvent.id);
    await setDoc(eventDocRef, {
      id: updatedEvent.id,
      name: updatedEvent.name,
      academy: updatedEvent.academy,
      date: updatedEvent.date,
      templateSnapshot: snapshot,
      templateId: template.id,
      updatedAtMs: Date.now(),
    }, { merge: true }).catch(e => console.warn('⚠️ applyTemplateToEvent events doc error:', e));

    const settingsRef = doc(db, 'settings', 'current_session');
    await setDoc(settingsRef, {
      event: updatedEvent,
      updatedAtMs: Date.now(),
    }).catch(e => console.warn('⚠️ applyTemplateToEvent session error:', e));
  }

  console.log(`✅ Template applicato: ${template.name} (${template.id}) → evento ${updatedEvent.id}`);
  return updatedEvent;
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3.3A — Template Builder Functions
// ─────────────────────────────────────────────────────────────────────────────

/** ID dei template base seminati — protetti da eliminazione accidentale. */
const SEED_TEMPLATE_IDS = new Set(['tpl-vis', 'tpl-rea', 'tpl-dam', 'tpl-aura', 'tpl-general']);

/**
 * Carica TUTTI i template da Firestore (non filtrati per academy).
 * Usato dal Template Builder per mostrare la lista completa.
 */
export const loadAllFormTemplates = async (): Promise<FormTemplate[]> => {
  if (PROVIDER === 'legacy') return [];
  try {
    const col = collection(db, 'formTemplates');
    const snap = await getDocs(col);
    const templates = snap.docs.map(d => ({ id: d.id, ...d.data() } as FormTemplate));
    console.log(`📝 loadAllFormTemplates: ${templates.length} template totali`);
    return templates;
  } catch (e) {
    console.warn('⚠️ loadAllFormTemplates error:', e);
    return [];
  }
};

/**
 * Salva (crea o aggiorna) un FormTemplate in Firestore.
 * Imposta updatedAtMs automaticamente.
 * Se il documento non esiste, imposta anche createdAtMs.
 */
export const saveFormTemplate = async (template: FormTemplate): Promise<void> => {
  if (PROVIDER === 'legacy') {
    console.warn('⚠️ saveFormTemplate: ignored in legacy mode');
    return;
  }
  const ref = doc(db, 'formTemplates', template.id);
  const existing = await getDoc(ref);
  const now = Date.now();
  const payload = {
    ...template,
    createdAtMs: existing.exists() ? (existing.data()?.createdAtMs ?? now) : now,
    updatedAtMs: now,
  };
  await setDoc(ref, payload);
  console.log(`✅ saveFormTemplate: "${template.name}" (${template.id}) salvato`);
};

/**
 * Elimina un FormTemplate da Firestore.
 * I template seed (tpl-vis, tpl-rea, ecc.) non possono essere eliminati senza force=true.
 * Ritorna 'deleted' se eliminato, 'blocked' se protetto.
 */
export const deleteFormTemplate = async (
  templateId: string,
  force = false
): Promise<'deleted' | 'blocked'> => {
  if (PROVIDER === 'legacy') {
    console.warn('⚠️ deleteFormTemplate: ignored in legacy mode');
    return 'blocked';
  }
  if (SEED_TEMPLATE_IDS.has(templateId) && !force) {
    console.warn(`🛡️ deleteFormTemplate: "${templateId}" è un template seed protetto. Usa force=true per eliminarlo.`);
    return 'blocked';
  }
  const ref = doc(db, 'formTemplates', templateId);
  await deleteDoc(ref);
  console.log(`🗑️ deleteFormTemplate: "${templateId}" eliminato`);
  return 'deleted';
};
