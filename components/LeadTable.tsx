
import React, { useState, useMemo } from 'react';
import { Lead, CheckInStatus, ORIENTATORI, TemplateSnapshot } from '../types';

interface LeadTableProps {
  leads: Lead[];
  onUpdateLeadField?: (id: string, field: keyof Lead, value: any) => void;
  onDeleteLead?: (id: string) => void;
  templateSnapshot?: TemplateSnapshot; // PHASE 2: colonne dinamiche
}

const LeadTable: React.FC<LeadTableProps> = ({ leads, onUpdateLeadField, onDeleteLead, templateSnapshot }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // PHASE 2: campi dinamici visibili nella tabella (non bloccati, visibleInAdminTable !== false)
  const dynamicFields = templateSnapshot
    ? templateSnapshot.fields.filter(f => !f.locked && f.visibleInAdminTable !== false)
    : [];

  const filteredLeads = useMemo(() => {
    const filtered = leads.filter(l =>
      `${l.nome} ${l.cognome}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.cellulare.includes(searchTerm)
    );

    return filtered.sort((a, b) => {
      // 1. Emergenza non orientata al top
      const aEmerg = a.emergenza && !a.orientamento_effettuato;
      const bEmerg = b.emergenza && !b.orientamento_effettuato;
      if (aEmerg && !bEmerg) return -1;
      if (!aEmerg && bEmerg) return 1;

      // 2. Va via prima in fondo
      const aViaPrima = a.esito_iscrizione === 'va via prima';
      const bViaPrima = b.esito_iscrizione === 'va via prima';
      if (aViaPrima && !bViaPrima) return 1;
      if (!aViaPrima && bViaPrima) return -1;

      // 3. Ordine cronologico ascendente (più vecchio prima)
      const parseDateStr = (dateStr?: string) => {
        if (!dateStr) return 0;
        const parts = dateStr.split(', ');
        if (parts.length !== 2) return 0;
        const [day, month, year] = parts[0].split('/');
        const [hh, mm, ss] = parts[1].split(':');
        return new Date(Number(year), Number(month) - 1, Number(day), Number(hh), Number(mm), Number(ss)).getTime();
      };

      const timeA = parseDateStr(a.data_checkin);
      const timeB = parseDateStr(b.data_checkin);
      
      return timeA - timeB;
    });
  }, [leads, searchTerm]);

  const handleToggleBlocca = (lead: Lead) => {
    if (!lead.bloccato) {
      // Controllo se è inserito l'orientatore prima di bloccare
      if (!lead.orientatore || lead.orientatore.trim() === "") {
        alert("ATTENZIONE: Devi prima assegnare un orientatore per poter bloccare questa lead.");
        return;
      }
    }
    onUpdateLeadField?.(lead.id, 'bloccato', !lead.bloccato);
  };

  const getStatusBadge = (status: CheckInStatus) => {
    switch (status) {
      case CheckInStatus.CONFERMATO:
        return <span className="bg-emerald-600 text-white px-8 py-4 rounded-[1.2rem] text-[13px] font-black uppercase shadow-lg shadow-emerald-200 border-b-4 border-emerald-800 min-w-[140px] text-center">PRESENTE</span>;
      case CheckInStatus.AGGIORNATO:
        return <span className="bg-blue-600 text-white px-8 py-4 rounded-[1.2rem] text-[13px] font-black uppercase shadow-lg shadow-blue-200 border-b-4 border-blue-800 min-w-[140px] text-center">MODIFICATO</span>;
      case CheckInStatus.NUOVO_LEAD:
        return <span className="bg-purple-600 text-white px-8 py-4 rounded-[1.2rem] text-[13px] font-black uppercase shadow-lg shadow-purple-200 border-b-4 border-purple-800 min-w-[140px] text-center">NUOVO</span>;
      default:
        return <span className="bg-gray-100 text-gray-500 px-8 py-4 rounded-[1.2rem] text-[13px] font-black uppercase border-2 border-gray-200 min-w-[140px] text-center">ASSENTE</span>;
    }
  };

  return (
    <div>
      <div className="p-10 bg-gray-50/50 border-b border-gray-100">
        <div className="relative group">
          <input
            type="text"
            placeholder="CERCA PER NOME, COGNOME O CELLULARE..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-14 py-8 border-4 border-gray-100 rounded-[2.5rem] bg-white focus:border-black outline-none transition-all font-black uppercase tracking-[0.2em] text-sm text-gray-900 shadow-xl"
          />
          <div className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-y-4 px-8">
          <thead className="text-gray-400 text-[11px] font-black uppercase tracking-[0.4em]">
            <tr>
              <th className="px-6 py-4 text-center">N°</th>
              <th className="px-8 py-4">Informazioni Lead</th>
              <th className="px-8 py-4">Corso</th>
              <th className="px-8 py-4 text-center">Accompagnatore</th>
              <th className="px-8 py-4 text-center">Presenza</th>
              <th className="px-8 py-4">Orientatore</th>
              <th className="px-8 py-4 text-center">Blocca</th>
              <th className="px-8 py-4 text-center">Orientamento</th>
              <th className="px-8 py-4 text-center">Iscrizione</th>
              <th className="px-8 py-4 text-right">Orario</th>
              {/* PHASE 2: colonne dinamiche */}
              {dynamicFields.map(f => (
                <th key={f.key} className="px-8 py-4 text-center whitespace-nowrap">{f.label}</th>
              ))}
              <th className="px-8 py-4 text-center">Elimina</th>
            </tr>
          </thead>
          <tbody className="space-y-4">
            {filteredLeads.length > 0 ? (
              filteredLeads.map((lead, index) => {
                // Logica colore riga: lilla acceso se bloccato, verde se orientamento fatto
                let rowColorClass = "bg-white";
                let rowStyle: React.CSSProperties | undefined = undefined;
                let textPrimaryClass = "text-gray-950";
                let textSecondaryClass = "text-gray-400";
                let badgeClass = "bg-slate-100 text-slate-500 border-slate-100";

                const oInfo = (lead.orientatore || '').toLowerCase();
                let oBgColor = '';
                let oTextClass = '';
                let oBadgeClass = '';
                let oBorderClass = '';

                switch (oInfo) {
                  case 'Melania': oBgColor = '#800080'; oTextClass = 'text-white'; oBadgeClass = 'bg-purple-900 border-purple-700 text-white'; oBorderClass = 'border-purple-900'; break;
                  case 'sara': oBgColor = '#B2FFFF'; oTextClass = 'text-cyan-950'; oBadgeClass = 'bg-cyan-200 border-cyan-400 text-cyan-900'; oBorderClass = 'border-cyan-400'; break;
                  case 'costanza': oBgColor = '#FF00FF'; oTextClass = 'text-white'; oBadgeClass = 'bg-fuchsia-900 border-fuchsia-700 text-white'; oBorderClass = 'border-fuchsia-900'; break;
                  case 'giulia': oBgColor = '#FFA500'; oTextClass = 'text-orange-950'; oBadgeClass = 'bg-orange-200 border-orange-400 text-orange-950'; oBorderClass = 'border-orange-600'; break;
                  case 'Giancarlo': oBgColor = '#008000'; oTextClass = 'text-white'; oBadgeClass = 'bg-green-900 border-green-700 text-white'; oBorderClass = 'border-green-900'; break;
                  case 'paolo': oBgColor = '#FF6F61'; oTextClass = 'text-white'; oBadgeClass = 'bg-rose-900 border-rose-700 text-white'; oBorderClass = 'border-rose-900'; break;
                }

                if (lead.bloccato) {
                  rowColorClass = "bg-purple-200 ring-4 ring-purple-600/50 border-purple-400 translate-x-2";
                  textPrimaryClass = "text-purple-900";
                  textSecondaryClass = "text-purple-700";
                  badgeClass = "bg-purple-300 text-purple-800 border-purple-300";

                  if (oBgColor) {
                    rowStyle = { backgroundColor: oBgColor };
                    textPrimaryClass = oTextClass;
                    textSecondaryClass = oTextClass.includes('white') ? "text-white/80" : oTextClass;
                    badgeClass = oBadgeClass;
                    rowColorClass = `ring-4 ring-[${oBgColor}]/50 ${oBorderClass} translate-x-2`;
                  }
                } else if (lead.orientamento_effettuato) {
                  rowColorClass = "bg-emerald-50/40 ring-2 ring-emerald-500/20 opacity-80";
                }

                if (lead.emergenza && !lead.orientamento_effettuato) {
                  rowColorClass = "animate-pulse bg-red-100 ring-4 ring-red-500 border-red-500 translate-x-1";
                  textPrimaryClass = "text-red-900";
                  textSecondaryClass = "text-red-700";
                  badgeClass = "bg-red-200 text-red-800 border-red-300";
                }

                return (
                  <tr key={lead.id} style={rowStyle} className={`group ${rowColorClass} shadow-sm border border-gray-100 hover:shadow-2xl transition-all duration-300 rounded-[2rem] overflow-hidden`}>
                    <td className={`px-6 py-10 text-center font-black ${lead.bloccato || (lead.emergenza && !lead.orientamento_effettuato) ? textSecondaryClass : 'text-gray-300'} text-3xl italic first:rounded-l-[2.5rem] relative`}>
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span>{index + 1}</span>
                        <button
                          onClick={() => onUpdateLeadField?.(lead.id, 'emergenza', !lead.emergenza)}
                          className={`p-2 rounded-full transition-all ${lead.emergenza ? 'bg-red-500 text-white shadow-lg ring-2 ring-red-300 animate-bounce' : 'bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-500'}`}
                          title="Segnala Emergenza"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="px-8 py-10">
                      <div className={`font-black uppercase text-2xl tracking-tighter leading-none mb-2 ${lead.bloccato ? textPrimaryClass : 'text-gray-950'}`}>
                        {lead.nome} {lead.cognome}
                      </div>
                      <div className={`text-[12px] font-bold uppercase tracking-widest flex items-center gap-2 ${!lead.bloccato && 'text-gray-400'}`}>
                        <span className={`${lead.bloccato ? badgeClass : 'bg-slate-100 text-slate-500'} px-3 py-1 rounded-full font-black`}>
                          {lead.cellulare}
                        </span>
                        <span className={`lowercase font-medium italic ${lead.bloccato ? textSecondaryClass : 'opacity-60'}`}>
                          {lead.email || 'no-email'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-10">
                      <div className={`text-[14px] font-black uppercase tracking-tighter px-5 py-3 rounded-2xl border-2 inline-block ${lead.bloccato ? badgeClass : 'bg-slate-50 border-slate-100 text-gray-800'}`}>
                        {lead.dipartimento_interesse || lead.corso_di_interesse || '-'}
                      </div>
                    </td>
                    <td className="px-8 py-10 text-center">
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black uppercase border-2 ${lead.bloccato ? badgeClass : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
                        {(() => {
                          const v = (lead.accompagnatore || '').toLowerCase();
                          if (!v || v === 'solo' || v.includes('solo')) return <><span>👤</span> Solo</>;
                          if (v.includes('genitor') || v.includes('famig') || v.includes('tutor')) return <><span>👨‍👩‍👧</span> Famiglia</>;
                          if (v.includes('amico') || v.includes('amica')) return <><span>👫</span> Amico</>;
                          return <span className="text-gray-400">—</span>;
                        })()}
                      </div>
                    </td>
                    <td className="px-8 py-10 text-center">
                      <div className="flex justify-center">{getStatusBadge(lead.stato_checkin)}</div>
                    </td>
                    <td className="px-8 py-10 min-w-[220px]">
                      <select
                        value={lead.orientatore || ''}
                        onChange={(e) => onUpdateLeadField?.(lead.id, 'orientatore', e.target.value)}
                        style={oBgColor && lead.orientatore ? { backgroundColor: oBgColor, borderColor: oBgColor, color: oTextClass.includes('white') ? 'white' : 'black' } : undefined}
                        className={`w-full px-6 py-6 rounded-[1.8rem] border-4 font-black uppercase text-sm tracking-[0.1em] outline-none transition-all shadow-xl appearance-none cursor-pointer ${lead.orientatore
                          ? `ring-8 ring-black/10 scale-[1.05] ${!oBgColor ? 'bg-black text-white border-black' : ''}`
                          : 'bg-white text-gray-300 border-gray-100 hover:border-gray-400'
                          }`}
                      >
                        <option value="">NON ASSEGNATO</option>
                        {ORIENTATORI.map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
                      </select>
                    </td>
                    <td className="px-8 py-10 text-center">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => handleToggleBlocca(lead)}
                          className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all border-4 shadow-xl ${lead.bloccato
                            ? 'bg-fuchsia-600 border-fuchsia-400 text-white scale-125 shadow-fuchsia-400 rotate-12 ring-4 ring-fuchsia-600/20'
                            : 'bg-white border-gray-100 text-gray-200 hover:border-fuchsia-300 hover:text-fuchsia-400 hover:scale-110'
                            }`}
                          title={lead.bloccato ? "Sblocca riga" : "Blocca riga (Richiede orientatore)"}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {lead.bloccato ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            )}
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="px-8 py-10 text-center">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => onUpdateLeadField?.(lead.id, 'orientamento_effettuato', !lead.orientamento_effettuato)}
                          className={`w-24 h-24 rounded-[2.2rem] flex items-center justify-center transition-all border-4 shadow-2xl ${lead.orientamento_effettuato
                            ? 'bg-emerald-600 border-emerald-400 text-white scale-110 rotate-3 shadow-emerald-200'
                            : 'bg-white border-gray-100 text-gray-200 hover:border-gray-400 hover:scale-105'
                            }`}
                        >
                          {lead.orientamento_effettuato ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={7} d="M5 13l4 4L19 7" /></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-8 py-10 text-center">
                      <div className="flex items-center justify-center">
                        <select
                          value={lead.esito_iscrizione || ''}
                          onChange={(e) => {
                            if (!lead.orientamento_effettuato) {
                              alert("Devi prima confermare l'appuntamento (Orientamento) per scegliere l'esito!");
                              return;
                            }
                            onUpdateLeadField?.(lead.id, 'esito_iscrizione', e.target.value);
                          }}
                          onClick={(e) => {
                            if (!lead.orientamento_effettuato) {
                              e.preventDefault();
                              alert("Devi prima confermare l'appuntamento (Orientamento) per scegliere l'esito!");
                            }
                          }}
                          className={`px-4 py-3 rounded-xl border-4 font-black uppercase text-[10px] tracking-wider outline-none transition-all shadow-sm appearance-none cursor-pointer ${!lead.orientamento_effettuato
                            ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed opacity-50'
                            : lead.esito_iscrizione === 'iscritto'
                              ? 'bg-emerald-600 text-white border-emerald-500 ring-4 ring-emerald-500/20'
                              : lead.esito_iscrizione === 'blocco posto'
                                ? 'bg-amber-500 text-white border-amber-400 ring-4 ring-amber-500/20'
                                : lead.esito_iscrizione === 'va via prima'
                                  ? 'bg-slate-700 text-white border-slate-600 ring-4 ring-slate-700/20'
                                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                            }`}
                        >
                          <option value="">- ESITO -</option>
                          <option value="blocco posto">BLOCCO</option>
                          <option value="iscritto">ISCRITTO</option>
                          <option value="va via prima">VA VIA PRIMA</option>
                        </select>
                      </div>
                    </td>
                    <td className={`px-8 py-10 text-right font-black ${lead.bloccato ? textSecondaryClass : 'text-gray-300'} text-[11px] italic`}>
                      {lead.data_checkin?.split(',')[1] || '---'}
                    </td>
                    {/* PHASE 2: celle dinamiche */}
                    {dynamicFields.map(f => {
                      const val = lead.answers?.[f.key] ?? '';
                      const display = typeof val === 'boolean' ? (val ? '✓' : '—') : (String(val) || '—');
                      return (
                        <td key={f.key} className="px-8 py-10 text-center text-sm font-bold text-gray-500 whitespace-nowrap">
                          {display}
                        </td>
                      );
                    })}
                    <td className="px-8 py-10 text-center last:rounded-r-[2.5rem]">
                      <button
                        onClick={() => onDeleteLead?.(lead.id)}
                        className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all border-4 bg-white border-gray-100 text-gray-200 hover:border-red-200 hover:text-red-500 hover:bg-red-50 hover:scale-110 shadow-sm hover:shadow-xl"
                        title="Elimina Lead"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10 + dynamicFields.length} className="px-8 py-60 text-center">
                  <p className="text-slate-200 font-black uppercase tracking-[0.8em] text-lg italic">Nessun Dato</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeadTable;
