
import React from 'react';
import { Lead, CheckInStatus } from '../types';

interface StatsCardsProps {
  leads: Lead[];
  activeFilter: string | null;
  onFilterChange: (label: string) => void;
}

const StatsCards: React.FC<StatsCardsProps> = ({ leads, activeFilter, onFilterChange }) => {
  const total = leads.length;
  const anyCheckin = leads.filter(l => l.stato_checkin !== CheckInStatus.NON_PERVENUTO).length;
  const orientationDone = leads.filter(l => l.orientamento_effettuato === true).length;
  
  // LOGICA CORRETTA: Qualunque lead (presente o assente) che abbia un orientatore assegnato MA non abbia ancora finito
  const orientationTodo = leads.filter(l => 
    l.orientatore && 
    l.orientatore.trim() !== "" && 
    !l.orientamento_effettuato
  ).length;
  
  const pending = leads.filter(l => l.stato_checkin === CheckInStatus.NON_PERVENUTO).length;

  const cards = [
    { label: 'Totale Leads', value: total, color: 'bg-indigo-600', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    { label: 'Aggiornati', value: anyCheckin, color: 'bg-blue-600', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
    { label: 'Orientamento Fatto', value: orientationDone, color: 'bg-green-600', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Da Orientare', value: orientationTodo, color: 'bg-rose-600', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 17c-.77 1.333.192 3 1.732 3z' },
    { label: 'In Attesa', value: pending, color: 'bg-gray-500', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
      {cards.map((card, i) => {
        const isActive = activeFilter === card.label;
        return (
          <button 
            key={i} 
            onClick={() => onFilterChange(card.label)}
            className={`text-left bg-white p-8 rounded-[3rem] shadow-2xl border-4 transition-all hover:-translate-y-2 active:scale-95 ${
              isActive ? 'border-indigo-600 ring-8 ring-indigo-500/10 scale-[1.05] z-10' : 'border-transparent hover:border-gray-100'
            }`}
          >
            <div className={`${card.color} w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-white shadow-xl shadow-${card.color.split('-')[1]}-200`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={card.icon} />
              </svg>
            </div>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] mb-2">{card.label}</p>
            <h4 className="text-5xl font-black text-gray-900 tracking-tighter leading-none italic">{card.value}</h4>
          </button>
        );
      })}
    </div>
  );
};

export default StatsCards;
