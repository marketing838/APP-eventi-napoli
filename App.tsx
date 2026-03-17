
import React, { useState, useEffect, useCallback } from 'react';
import { ViewType, Lead, EventConfig, CheckInStatus } from './types';
import Header from './components/Header';
import UserCheckin from './components/UserCheckin';
import AdminDashboard from './components/AdminDashboard';
import * as storage from './services/storageService';
import { sendLeadToZapier } from './services/integrationService';

const App: React.FC = () => {
  const [view, setView] = useState<ViewType>('USER');
  const [leads, setLeads] = useState<Lead[]>(() => storage.getLeads());
  const [activeEvent, setActiveEvent] = useState<EventConfig | null>(() => storage.getActiveEvent());
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  const handleUpdateLeads = useCallback((newList: Lead[]) => {
    setLeads([...newList]);
    storage.saveLeads(newList);
  }, []);

  // async: setActiveEvent ora è async (Firestore-safe)
  const handleSetActiveEvent = useCallback(async (event: EventConfig | null) => {
    setActiveEvent(event);
    await storage.setActiveEvent(event);
  }, []);

  // Listen for global session sync from storageService
  useEffect(() => {
    const handleSync = (e: any) => {
      console.log('📱 App receiving global sync:', e.detail?.name);
      setActiveEvent(e.detail);
    };

    const handleLeadsSync = (e: any) => {
      console.log('📊 App receiving leads sync:', e.detail?.length, 'leads');
      setLeads([...e.detail]);
    };

    window.addEventListener('session-sync', handleSync);
    window.addEventListener('leads-sync', handleLeadsSync);
    return () => {
      window.removeEventListener('session-sync', handleSync);
      window.removeEventListener('leads-sync', handleLeadsSync);
    };
  }, []);

  // Gate leads sync: attiva solo quando la view è ADMIN e c'è un evento
  useEffect(() => {
    if (view === 'ADMIN' && activeEvent?.id) {
      storage.enableLeadsSync(activeEvent.id);
    } else {
      storage.disableLeadsSync();
    }
  }, [view, activeEvent?.id]);

  // FUNZIONE DI RESET DEFINITIVA
  const handleHardReset = useCallback(async () => {
    await storage.setActiveEvent(null); // async: aspetta Firestore prima del reload
    await storage.clearLeads();
    window.location.reload();
  }, []);

  // FUNZIONE DI CHIUSURA SESSIONE DEFINITIVA
  const handleStopSession = useCallback(async () => {
    await storage.setActiveEvent(null); // async: aspetta Firestore prima del reload
    window.location.reload();
  }, []);

  // FORCE EXIT: emergenza — pulisce solo localStorage, zero chiamate Firebase
  const handleForceExit = useCallback(() => {
    localStorage.removeItem('event_leads_v7_stable');
    localStorage.removeItem('active_event_v7_stable');
    localStorage.removeItem('event_leads_updated_at_v7');
    window.location.reload();
  }, []);

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    setView('USER');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header
        currentView={view}
        setView={setView}
        isAdminAuthenticated={isAdminAuthenticated}
        onLogout={handleAdminLogout}
        activeEvent={activeEvent}
      />

      <main className={`flex-grow container mx-auto px-4 py-8 ${view === 'ADMIN' ? 'max-w-[1600px]' : 'max-w-6xl'}`}>
        {view === 'USER' ? (
          <UserCheckin
            activeEvent={activeEvent}
            leads={leads}
            onCheckIn={async (newLead) => {
              // PHASE 3.2 FIX: Persistenza ATOMICA per il singolo lead
              // USER checkin non deve aggiornare il global state (setLeads)
              // per evitare Race Conditions locali che sovrascrivono la cache
              // dell'admin o degli altri tablet. L'Admin col listener
              // si occuperà di aggiornare l'UI di default.
              await storage.saveLeadToCloud(newLead);

              // Invio webhook a Zapier per Monday.com solo per i nuovi visitatori
              if (newLead.stato_checkin === CheckInStatus.NUOVO_LEAD && activeEvent?.academy) {
                // Costruzione stringa dataOD: "11 Marzo 2026 - ore 15:30 - Napoli"
                const MESI_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                                 'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
                let dataOD = '';
                if (activeEvent.odDate) {
                  const [y, m, d] = activeEvent.odDate.split('-');
                  const mese = MESI_IT[parseInt(m, 10) - 1];
                  const ora = activeEvent.odTime || '00:00';
                  dataOD = `${parseInt(d, 10)} ${mese} ${y} - ore ${ora} - Napoli`;
                }
                sendLeadToZapier(newLead, activeEvent.academy, dataOD).catch(console.error);
              }
            }}
          />
        ) : (
          <AdminDashboard
            leads={leads}
            activeEvent={activeEvent}
            onSetActiveEvent={handleSetActiveEvent}
            onUpdateLeads={handleUpdateLeads}
            onHardReset={handleHardReset}
            onStopSession={handleStopSession}
            onForceExit={handleForceExit}
            isAuthenticated={isAdminAuthenticated}
            setIsAuthenticated={setIsAdminAuthenticated}
          />
        )}
      </main>

      <footer className="bg-white border-t py-6 text-center text-gray-400 text-[10px] font-black uppercase tracking-[0.4em]">
        EventLeadPro Live System v7.0 - Ready for Event
      </footer>
    </div>
  );
};

export default App;
