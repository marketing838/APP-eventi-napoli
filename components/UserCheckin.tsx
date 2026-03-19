
import React, { useState } from 'react';
import { Lead, CheckInStatus, EventConfig, ACADEMY_THEMES } from '../types';
import { findLeadByEmailOrPhone } from '../services/storageService';
import LeadForm from './LeadForm';

interface UserCheckinProps {
  activeEvent: EventConfig | null;
  leads: Lead[];
  onCheckIn: (lead: Lead) => void;
}

const UserCheckin: React.FC<UserCheckinProps> = ({ activeEvent, leads, onCheckIn }) => {
  const [searchValue, setSearchValue] = useState('');
  const [foundLead, setFoundLead] = useState<Lead | null>(null);
  const [isSearching, setIsSearching] = useState(true);
  const [isLoading, setIsLoading] = useState(false); // Fix 3: spinner durante ricerca cloud
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  const theme = activeEvent ? ACADEMY_THEMES[activeEvent.academy] : ACADEMY_THEMES.GENERAL;

  // STRATEGIA: locale prima (sempre aggiornato dallo snapshot), Firestore come backup multi-device
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchValue.trim();
    if (!term) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const normSearch = term.replace(/\D/g, ''); // solo cifre
      const cleanSearchForm = normSearch.startsWith('39') && normSearch.length > 10 ? normSearch.substring(2) : normSearch;

      // ── Step 1: Ricerca LOCALE (array leads in memoria, aggiornato dallo snapshot) ──
      // Usiamo match esatto ignorando prefissi come +39 per evitare falsi positivi
      let lead: Lead | null = leads.find(l => {
        if (!cleanSearchForm) return false;
        const dbPhone1 = (l.cellulare_search || '').replace(/\D/g, '');
        const cleanDb1 = dbPhone1.startsWith('39') && dbPhone1.length > 10 ? dbPhone1.substring(2) : dbPhone1;
        const dbPhone2 = (l.cellulare || '').replace(/\D/g, '');
        const cleanDb2 = dbPhone2.startsWith('39') && dbPhone2.length > 10 ? dbPhone2.substring(2) : dbPhone2;
        return cleanSearchForm === cleanDb1 || cleanSearchForm === cleanDb2;
      }) || null;

      // ── Step 2: Backup Firestore (solo se locale non trova — scenario multi-device) ──
      // Utile quando il lead è stato inserito da un altro PC e non è ancora in localStorage.
      if (!lead && activeEvent?.id && import.meta.env.VITE_STORAGE_PROVIDER !== 'legacy') {
        lead = await findLeadByEmailOrPhone(
          activeEvent.id,
          undefined,
          normSearch
        );
        if (lead) console.log('☁️ Lead trovato su Firestore (multi-device)');
      }

      if (lead) {
        setFoundLead(lead);
        setIsSearching(false);
      } else {
        setFoundLead(null);
        setIsSearching(false);
        setMessage({ type: 'error', text: 'Non abbiamo trovato i tuoi dati. Inseriscili qui sotto.' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err) {
      console.warn('⚠️ Ricerca fallita:', err);
      setFoundLead(null);
      setIsSearching(false);
      setMessage({ type: 'error', text: 'Errore di ricerca. Riprova.' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = async (data: Lead) => {
    setIsLoading(true);
    try {
      await onCheckIn(data);
      setMessage({ type: 'success', text: 'Grazie! Check-in completato con successo.' });
      setSearchValue('');
      setFoundLead(null);
      setIsSearching(true);
      setTimeout(() => setMessage(null), 4000);
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: 'Errore di connessione. Riprova.' });
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setIsLoading(false);
    }
  };

  if (!activeEvent) {
    return (
      <div className="max-w-xl mx-auto mt-12 animate-fadeIn">
        <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-red-200">
          <div className="p-10 text-center bg-red-50">
            <div className="w-16 h-16 bg-red-500 rounded-2xl mx-auto mb-6 flex items-center justify-center text-white shadow-xl text-3xl font-black">!</div>
            <h2 className="text-2xl font-black text-red-700 mb-3 uppercase tracking-tighter">Sessione Non Configurata</h2>
            <p className="text-red-500 font-bold text-sm">
              Nessun evento attivo trovato.<br />Contatta l'amministratore per avviare una sessione.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isSearching) {
    return (
      <div className="max-w-xl mx-auto mt-12 animate-fadeIn">
        <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-gray-100">
          <div className={`p-10 text-center bg-${theme.secondary}`}>
            <div className={`w-16 h-16 bg-${theme.primary} rounded-2xl mx-auto mb-6 flex items-center justify-center text-white shadow-xl rotate-3`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-4xl font-black text-gray-900 mb-2 italic tracking-tighter">
              {activeEvent ? activeEvent.name : 'EventLeadPro'}
            </h2>
          </div>

          <form onSubmit={handleSearch} className="p-10 space-y-6">
            <div className="space-y-3">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Inserisci Cellulare</label>
              <div className="relative group">
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Es: 333 1234567"
                  className={`w-full px-6 py-5 bg-gray-50 border-2 border-gray-100 rounded-[1.5rem] focus:border-${theme.primary} outline-none transition-all text-xl font-bold shadow-inner`}
                  required
                  disabled={isLoading}
                />
                {/* Spinner durante ricerca cloud */}
                {isLoading && (
                  <div className="absolute right-5 top-1/2 -translate-y-1/2">
                    <div className={`w-6 h-6 border-4 border-${theme.primary}/20 border-t-${theme.primary} rounded-full animate-spin`} />
                  </div>
                )}
              </div>
            </div>

            {message && message.type === 'error' && (
              <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl text-sm font-bold border border-orange-100 text-center animate-bounce">
                {message.text}
              </div>
            )}

            {message && message.type === 'success' && (
              <div className="p-6 bg-green-500 text-white rounded-[1.5rem] text-center font-black text-lg shadow-xl shadow-green-200">
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-5 bg-${theme.primary} text-white font-black rounded-[1.5rem] shadow-xl shadow-${theme.primary}/30 hover:scale-[1.02] active:scale-95 transition-all text-xl uppercase tracking-tight disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {isLoading ? 'Ricerca in corso...' : 'Inizia Check-in ➔'}
            </button>

            <div className="pt-6 text-center">
              <button
                type="button"
                onClick={() => { setIsSearching(false); setFoundLead(null); }}
                className={`text-${theme.primary} font-black uppercase text-xs tracking-widest hover:underline`}
              >
                Nuovo visitatore? Registrati qui
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-6 animate-slideIn">
      <button onClick={() => setIsSearching(true)} className={`mb-6 flex items-center text-${theme.primary} font-black uppercase text-xs tracking-widest bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100`}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Torna alla ricerca
      </button>

      <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-gray-100">
        <div className={`p-8 bg-gradient-to-br ${theme.gradient} text-white`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-1">Check-in Session</p>
              <h2 className="text-3xl font-black italic tracking-tighter">
                {foundLead ? `Bentornat*, ${foundLead.nome}!` : 'Nuova iscrizione'}
              </h2>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
              <span className="text-xs font-black uppercase tracking-widest">{activeEvent?.academy}</span>
            </div>
          </div>
        </div>
        <div className="p-10">
          <LeadForm
            key={foundLead?.id || 'new'}
            initialData={foundLead || undefined}
            onSave={handleFinish}
            theme={theme.primary}
            academy={activeEvent?.academy}
            templateSnapshot={activeEvent?.templateSnapshot}
          />
        </div>
      </div>
    </div>
  );
};

export default UserCheckin;
