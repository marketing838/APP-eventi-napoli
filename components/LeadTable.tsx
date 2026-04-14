
import React, { useState, useMemo } from 'react';
import { Lead, CheckInStatus, ORIENTATORI, TemplateSnapshot } from '../types';

interface LeadTableProps {
  leads: Lead[];
  onUpdateLeadField?: (id: string, field: keyof Lead, value: any) => void;
  onLinkLeads?: (leadId: string, partnerId: string | null) => void;
  onDeleteLead?: (id: string) => void;
  templateSnapshot?: TemplateSnapshot; // PHASE 2: colonne dinamiche
}

const LeadTable: React.FC<LeadTableProps> = ({ leads, onUpdateLeadField, onLinkLeads, onDeleteLead, templateSnapshot }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [partnerSearch, setPartnerSearch] = useState<{ [key: string]: string }>({});

  // PHASE 2: campi dinamici visibili nella tabella (non bloccati, visibleInAdminTable !== false)
  const dynamicFields = templateSnapshot
    ? templateSnapshot.fields.filter(f => !f.locked && f.visibleInAdminTable !== false)
    : [];

  // Mappa per lookup veloce dei lead (usata nel sorting)
  const leadMap = useMemo(() => {
    const map = new Map<string, Lead>();
    leads.forEach(l => map.set(l.id, l));
    return map;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const filtered = leads.filter(l =>
      `${l.nome} ${l.cognome}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.cellulare.includes(searchTerm)
    );

    const parseDateStr = (dateStr?: string) => {
      if (!dateStr) return 0;
      const parts = dateStr.split(', ');
      if (parts.length !== 2) return 0;
      const [day, month, year] = parts[0].split('/');
      const [hh, mm, ss] = parts[1].split(':');
      return new Date(Number(year), Number(month) - 1, Number(day), Number(hh), Number(mm), Number(ss)).getTime();
    };

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

      // 3. Ordine cronologico con raggruppamento (Coppie vicine)
      const getGroupId = (l: Lead) => (l.accompagnato_da_id && l.accompagnato_da_id < l.id) ? l.accompagnato_da_id : l.id;
      
      const gidA = getGroupId(a);
      const gidB = getGroupId(b);

      if (gidA !== gidB) {
        // Gruppi diversi: ordina per l'orario del "capogruppo"
        const repA = leadMap.get(gidA) || a;
        const repB = leadMap.get(gidB) || b;
        const timeA = parseDateStr(repA.data_checkin);
        const timeB = parseDateStr(repB.data_checkin);
        if (timeA !== timeB) return timeA - timeB;
        return gidA < gidB ? -1 : 1; // Stabilità
      }

      // Stesso gruppo: ordina internamente per data individuale
      return parseDateStr(a.data_checkin) - parseDateStr(b.data_checkin);
    });
  }, [leads, searchTerm, leadMap]);

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
      <div className="px-2 lg:px-8 pb-12 lg:space-y-4 space-y-6 pt-4 lg:pt-6">
        {/* Intestazione compatta Desktop */}
        <div className="hidden lg:flex items-center text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] px-6 pb-2 border-b-2 border-gray-100">
            <div className="w-12 text-center">N°</div>
            <div className="w-[35%]">Lead Info & Corso</div>
            <div className="w-[15%] text-center">Partner</div>
            <div className="w-[40%] text-center">Assegnazione & Status</div>
            <div className="w-[10%] text-right pr-6">Azioni</div>
        </div>

        {filteredLeads.length > 0 ? (
          filteredLeads.map((lead, index) => {
            // Logica base riga
            let baseStyles = "bg-white border-gray-200 text-gray-900";
            let opac = "opacity-100";
            let rowStyle: React.CSSProperties | undefined = undefined;

            const oInfo = (lead.orientatore || '').toLowerCase();
            let oBgColor = '';
            let oTextClass = '';
            let oBadgeClass = '';

            switch (oInfo) {
              case 'melania': oBgColor = '#800080'; oTextClass = 'text-white'; oBadgeClass = 'bg-purple-900/50'; break;
              case 'sara': oBgColor = '#B2FFFF'; oTextClass = 'text-cyan-950'; oBadgeClass = 'bg-white/50 border border-cyan-400'; break;
              case 'costanza': oBgColor = '#FF00FF'; oTextClass = 'text-white'; oBadgeClass = 'bg-fuchsia-900/50'; break;
              case 'giulia': oBgColor = '#FFA500'; oTextClass = 'text-orange-950'; oBadgeClass = 'bg-white/50 border border-orange-400'; break;
              case 'giancarlo': oBgColor = '#008000'; oTextClass = 'text-white'; oBadgeClass = 'bg-green-900/50'; break;
              case 'paolo': oBgColor = '#FF6F61'; oTextClass = 'text-white'; oBadgeClass = 'bg-rose-900/50'; break;
            }

            if (lead.bloccato) {
              if (oBgColor) {
                rowStyle = { backgroundColor: oBgColor };
                baseStyles = oTextClass + " border-transparent shadow-xl translate-x-2 ring-4 ring-black/10";
              } else {
                baseStyles = "bg-purple-200 text-purple-900 border-purple-400 shadow-xl translate-x-2";
              }
              opac = "opacity-100";
            } else if (lead.orientamento_effettuato) {
              baseStyles = "bg-emerald-50 text-gray-900 border-emerald-200";
              opac = "opacity-80";
            } else if (lead.emergenza && !lead.orientamento_effettuato) {
              baseStyles = "bg-red-100 text-red-900 border-red-500 animate-[pulse_1s_ease-in-out_infinite] translate-x-1 ring-2 ring-red-400";
              opac = "opacity-100";
            }

            // Partner logic
            const partner = lead.accompagnato_da_id ? leads.find(l => l.id === lead.accompagnato_da_id) : null;
            const pQuery = partnerSearch[lead.id] || '';
            const pResults = pQuery.length >= 2 
              ? leads.filter(l => l.id !== lead.id && `${l.nome} ${l.cognome}`.toLowerCase().includes(pQuery.toLowerCase())).slice(0, 5)
              : [];

            return (
              <div key={lead.id} style={rowStyle} className={`group flex flex-col lg:flex-row items-stretch border-2 rounded-2xl lg:rounded-[2rem] transition-all duration-300 ${baseStyles} ${opac} min-h-[100px] overflow-hidden lg:overflow-visible relative`}>
                {/* Indicatore laterale per Mobile */}
                <div className="lg:hidden absolute top-0 left-0 w-1.5 h-full opacity-80" style={{backgroundColor: lead.bloccato ? (oBgColor || '#6b7280') : (lead.emergenza && !lead.orientamento_effettuato ? '#ef4444' : lead.orientamento_effettuato ? '#10b981' : '#3b82f6')}}></div>

                {/* Header Card Mobile (Azioni + N°) */}
                <div className="lg:hidden flex justify-between items-start pt-3 px-4 pl-5">
                    <div className="flex flex-col gap-1 z-10">
                        <span className="text-xs font-black text-gray-400">#{index + 1}</span>
                        {lead.emergenza && !lead.orientamento_effettuato && (
                            <span className="px-2 py-0.5 w-fit rounded-full text-[10px] font-bold uppercase tracking-widest bg-red-100 text-red-700">Emergenza</span>
                        )}
                        {lead.bloccato && (
                            <span className="px-2 py-0.5 w-fit rounded-full text-[10px] font-bold uppercase tracking-widest bg-black/20 text-white">Bloccato</span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-1 z-10">
                        <button
                            onClick={() => onUpdateLeadField?.(lead.id, 'emergenza', !lead.emergenza)}
                            className={`p-2 rounded-lg transition-colors border shadow-sm ${lead.emergenza && !lead.orientamento_effettuato ? 'bg-red-500 text-white border-red-500 animate-pulse' : 'bg-white border-gray-200 text-gray-400 hover:text-red-500'}`}
                            title="Segnala Emergenza"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </button>
                        <button
                            onClick={() => handleToggleBlocca(lead)}
                            className={`p-2 rounded-lg transition-colors border shadow-sm ${lead.bloccato ? 'border-white/30 text-white bg-black/20' : 'bg-white border-gray-200 text-gray-400'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {lead.bloccato ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                )}
                            </svg>
                        </button>
                        {!lead.bloccato && (
                            <button
                                onClick={() => onDeleteLead?.(lead.id)}
                                className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 border border-gray-200 bg-white transition-colors shadow-sm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* 1. N° Emergenza / Presenza Desktop (nascosto su mobile) */}
                <div className={`hidden lg:flex w-16 flex-col items-center justify-center p-2 border-r-2 ${lead.bloccato ? 'border-white/20' : 'border-gray-100/50'} relative`}>
                    <span className="text-2xl font-black italic opacity-30 leading-none">{index + 1}</span>
                    <button 
                        onClick={() => onUpdateLeadField?.(lead.id, 'emergenza', !lead.emergenza)}
                        className={`absolute -left-3 -top-3 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 z-10 ${lead.emergenza && !lead.orientamento_effettuato ? 'bg-red-600 text-white animate-bounce' : 'bg-gray-100 text-gray-400 border-2 border-white'}`}
                        title="Segnala Emergenza"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </button>
                    {/* Status checkin indicator */}
                    <div className="mt-3 scale-[0.65] origin-top">
                        {getStatusBadge(lead.stato_checkin)}
                    </div>
                </div>

                {/* 2. Lead Info */}
                <div className="lg:w-[35%] py-2 lg:py-4 pl-5 lg:pl-6 pr-4 lg:pr-2 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl font-black uppercase tracking-tight leading-none">{lead.nome} {lead.cognome}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${lead.bloccato ? oBadgeClass || 'bg-black/10' : 'bg-gray-100 text-gray-500'}`}>
                            {lead.cellulare}
                        </span>
                    </div>
                    
                    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-widest ${lead.bloccato ? 'opacity-90' : 'text-gray-400'}`}>
                        {lead.email && <span className="lowercase">{lead.email}</span>}
                        <span>•</span>
                        <span className={`px-2 py-0.5 rounded-lg border text-[10px] ${lead.bloccato ? 'border-current opacity-80' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                           {lead.dipartimento_interesse || lead.corso_di_interesse || '-'}
                        </span>
                    </div>

                    {/* PHASE 2: Dynamic Fields Pills */}
                    {dynamicFields.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                        {dynamicFields.map(f => {
                            const val = lead.answers?.[f.key];
                            if (val == null || val === '') return null;
                            const display = typeof val === 'boolean' ? (val ? 'SI' : 'NO') : String(val);
                            return (
                                <span key={f.key} className={`px-2 py-1 text-[9px] font-black uppercase rounded shadow-sm ${lead.bloccato ? oBadgeClass || 'bg-black/20 text-white' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                                    {f.label}: {display}
                                </span>
                            );
                        })}
                        </div>
                    )}
                </div>

                {/* 3. Partner & Gruppo */}
                <div className={`lg:w-[15%] p-3 pl-5 lg:p-3 flex flex-row lg:flex-col items-center lg:justify-center border-t lg:border-t-0 lg:border-l-2 lg:border-r-2 ${lead.bloccato ? 'border-white/10 lg:border-white/20' : 'border-gray-100/50'}`}>
                    {/* Tipo Accompagnamento */}
                    <div className={`mr-2 lg:mr-0 px-3 py-1 lg:mb-2 rounded-full text-[10px] font-black uppercase border whitespace-nowrap ${lead.bloccato ? oBadgeClass || 'bg-black/10 border-transparent' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                        {(() => {
                          const v = (lead.accompagnatore || '').toLowerCase();
                          if (!v || v === 'solo' || v.includes('solo')) return '👤 Solo';
                          if (v.includes('genitor') || v.includes('famig') || v.includes('tutor')) return '👨‍👩‍👧 Famiglia';
                          if (v.includes('amico') || v.includes('amica')) return '👫 Amico';
                          return '—';
                        })()}
                    </div>

                    {/* Link Partner */}
                    <div className="w-full relative px-2">
                        {partner ? (
                            <div className="flex items-center justify-between gap-1 bg-indigo-600 text-white px-2 py-1.5 rounded-lg shadow-sm border border-indigo-700">
                                <span className="text-[9px] font-black uppercase whitespace-nowrap overflow-hidden text-ellipsis px-1">🔗 {partner.nome}</span>
                                {!lead.bloccato && (
                                    <button onClick={() => onLinkLeads?.(lead.id, null)} className="hover:scale-125 transition-transform bg-indigo-800/50 rounded-full p-0.5" title="Scollega">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={5} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="relative group/partner z-20">
                                <input 
                                    type="text"
                                    placeholder="CERCA PARTNER"
                                    value={pQuery}
                                    onChange={(e) => setPartnerSearch(s => ({ ...s, [lead.id]: e.target.value }))}
                                    disabled={lead.bloccato}
                                    className={`w-full rounded-lg text-center px-2 py-1.5 text-[9px] font-black uppercase outline-none transition-all placeholder-opacity-50 ${lead.bloccato ? 'bg-transparent text-inherit placeholder-current cursor-not-allowed border-0' : 'bg-gray-50 border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-gray-900 shadow-inner'}`}
                                />
                                {pResults.length > 0 && !lead.bloccato && (
                                    <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 p-2 w-[180px]">
                                        {pResults.map(p => (
                                            <button
                                                key={p.id}
                                                onMouseDown={() => {
                                                    onLinkLeads?.(lead.id, p.id);
                                                    setPartnerSearch(s => ({ ...s, [lead.id]: '' }));
                                                }}
                                                className="w-full text-left p-2 hover:bg-indigo-50 rounded-lg transition-colors border-b last:border-0 border-gray-50 flex items-center justify-between"
                                            >
                                                <div>
                                                  <div className="text-[10px] font-black uppercase text-gray-900 leading-tight">{p.nome} {p.cognome}</div>
                                                  <div className="text-[8px] font-bold text-gray-400">{p.cellulare}</div>
                                                </div>
                                                <span className="text-base ml-1">🤝</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. Operatività (Orientatore + Blocca + Orientamento + Esito) */}
                <div className={`lg:w-[40%] flex-col lg:flex-row flex items-stretch lg:items-center justify-center lg:justify-between px-4 lg:px-3 gap-2 lg:gap-0 pb-4 lg:pb-0 ${lead.bloccato ? 'pointer-events-none' : ''}`}>
                    
                    {/* Griglia mobile dropdown: Orientatore (sx) & Esito (dx) */}
                    <div className="grid grid-cols-2 lg:hidden gap-3 w-full">
                        <select
                            value={lead.orientatore || ''}
                            onChange={(e) => onUpdateLeadField?.(lead.id, 'orientatore', e.target.value)}
                            disabled={lead.bloccato}
                            className={`w-full px-2 py-2 rounded-lg text-xs font-bold uppercase shadow-sm ${lead.bloccato ? 'bg-black/10 text-white border-0 cursor-not-allowed' : 'bg-white border text-gray-900 border-gray-200'}`}
                        >
                            <option value="">A: NESSUNO</option>
                            {ORIENTATORI.map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
                        </select>
                        <select
                            value={lead.esito_iscrizione || ''}
                            onChange={(e) => {
                                if (!lead.orientamento_effettuato) { alert("Conferma prima l'appuntamento!"); return; }
                                onUpdateLeadField?.(lead.id, 'esito_iscrizione', e.target.value);
                            }}
                            disabled={lead.bloccato}
                            className={`w-full px-2 py-2 rounded-lg text-xs font-bold uppercase shadow-sm ${!lead.orientamento_effettuato ? 'bg-gray-50 text-gray-400 border border-gray-200 opacity-50' : lead.esito_iscrizione === 'iscritto' ? 'bg-emerald-600 text-white' : lead.esito_iscrizione === 'blocco posto' ? 'bg-amber-500 text-white' : lead.esito_iscrizione === 'va via prima' ? 'bg-slate-700 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                        >
                            <option value="">- ESITO -</option>
                            <option value="blocco posto">BLOCCO</option>
                            <option value="iscritto">ISCRITTO</option>
                            <option value="va via prima">VA VIA</option>
                        </select>
                    </div>

                    {/* V flag Orientamento su mobile */}
                    <div className="lg:hidden flex items-center justify-between mt-1 bg-white/40 p-2 rounded-lg border border-gray-100/50">
                        <span className="text-[10px] font-bold uppercase text-gray-500">Avvenuto?</span>
                        <button
                            onClick={() => onUpdateLeadField?.(lead.id, 'orientamento_effettuato', !lead.orientamento_effettuato)}
                            disabled={lead.bloccato}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm border ${lead.orientamento_effettuato ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-gray-300 border-gray-200'}`}
                        >
                             {lead.orientamento_effettuato ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={5} d="M5 13l4 4L19 7" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            )}
                        </button>
                    </div>

                    {/* Orientatore Dropdown Desktop */}
                    <div className="hidden lg:block relative group/ori z-10 w-32">
                        <select
                            value={lead.orientatore || ''}
                            onChange={(e) => onUpdateLeadField?.(lead.id, 'orientatore', e.target.value)}
                            disabled={lead.bloccato}
                            className={`w-full px-2 py-2.5 rounded-xl text-[10px] font-black uppercase outline-none transition-all cursor-pointer ${lead.bloccato ? 'appearance-none text-center bg-transparent border-0 scale-110 translate-x-4' : 'bg-white border-2 border-gray-200 shadow-sm hover:border-gray-400 text-gray-900'}`}
                        >
                            <option value="">NON ASS.</option>
                            {ORIENTATORI.map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
                        </select>
                    </div>

                    {/* Blocca Toggle Desktop. Needs pointer-events-auto to override father's pointer-events-none */}
                    <button
                        onClick={() => handleToggleBlocca(lead)}
                        className={`pointer-events-auto shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md mx-2 border-2 ${lead.bloccato ? 'bg-black/20 border-transparent text-white scale-[1.3] rotate-12 -translate-x-2 border border-white/20' : 'bg-white border-gray-200 text-gray-300 hover:text-fuchsia-500 hover:border-fuchsia-300 hover:scale-110'}`}
                        title={lead.bloccato ? "Sblocca riga" : "Blocca riga per lavorazione"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {lead.bloccato ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            )}
                        </svg>
                    </button>

                    {/* V flag Orientamento Desktop */}
                    <button
                        onClick={() => onUpdateLeadField?.(lead.id, 'orientamento_effettuato', !lead.orientamento_effettuato)}
                        disabled={lead.bloccato}
                        className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md border-2 mr-2 ${lead.orientamento_effettuato ? 'bg-emerald-500 border-emerald-400 text-white scale-110 rotate-3 ring-2 ring-emerald-200' : 'bg-white border-gray-200 text-gray-300 hover:text-emerald-500 hover:border-emerald-300 hover:scale-105'}`}
                        title="Segna orientamento effettuato"
                    >
                        {lead.orientamento_effettuato ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={5} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                    </button>

                    {/* Esito Dropdown Desktop */}
                    <div className="hidden lg:block w-28 relative z-10">
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
                            disabled={lead.bloccato}
                            className={`w-full px-2 py-2.5 rounded-xl border-2 font-black uppercase text-[9px] tracking-wider outline-none transition-all cursor-pointer ${!lead.orientamento_effettuato
                                ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed opacity-50'
                                : lead.esito_iscrizione === 'iscritto'
                                ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg scale-105'
                                : lead.esito_iscrizione === 'blocco posto'
                                ? 'bg-amber-500 text-white border-amber-400 shadow-lg scale-105'
                                : lead.esito_iscrizione === 'va via prima'
                                ? 'bg-slate-700 text-white border-slate-600 shadow-lg scale-105'
                                : 'bg-white text-gray-800 border-gray-300 hover:border-gray-400'
                            }`}
                        >
                            <option value="">- ESITO -</option>
                            <option value="blocco posto">BLOCCO</option>
                            <option value="iscritto">ISCRITTO</option>
                            <option value="va via prima">VA VIA</option>
                        </select>
                    </div>

                </div>

                {/* 5. Azioni / Orario / Elimina (Desktop) */}
                <div className={`hidden lg:flex w-[10%] p-3 flex-col items-center justify-center border-l-2 ${lead.bloccato ? 'border-white/20' : 'border-gray-100/50'}`}>
                    <div className={`text-[10px] font-black italic opacity-60 mb-2 whitespace-nowrap`}>
                        {lead.data_checkin?.split(',')[1] || '--:--'}
                    </div>
                    {!lead.bloccato && (
                        <button
                            onClick={() => onDeleteLead?.(lead.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all bg-gray-50 text-gray-400 hover:text-red-600 hover:bg-red-100 hover:scale-110 shadow-sm"
                            title="Elimina"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}
                </div>

              </div>
            );
          })
        ) : (
          <div className="py-40 text-center border-4 border-dashed border-gray-200 rounded-[3rem] bg-gray-50/50">
              <p className="text-gray-400 font-black uppercase tracking-[0.8em] text-xl italic">Nessun Dato Trovato</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadTable;
