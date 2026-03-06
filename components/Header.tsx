
import React from 'react';
import { ViewType, EventConfig, ACADEMY_THEMES } from '../types';

interface HeaderProps {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  isAdminAuthenticated: boolean;
  onLogout: () => void;
  activeEvent: EventConfig | null;
}

const Header: React.FC<HeaderProps> = ({ currentView, setView, isAdminAuthenticated, onLogout, activeEvent }) => {
  const theme = activeEvent ? ACADEMY_THEMES[activeEvent.academy] : ACADEMY_THEMES.GENERAL;

  return (
    <header className={`bg-${theme.primary} text-white shadow-lg sticky top-0 z-50 transition-colors duration-500`}>
      <div className="container mx-auto px-4 py-4 flex justify-between items-center max-w-6xl">
        <div
          className="flex items-center space-x-2 cursor-pointer"
          onClick={() => setView('USER')}
        >
          <div className="bg-white p-2 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-${theme.primary}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {activeEvent ? activeEvent.name : 'EventLeadPro'}
            </h1>
            {activeEvent && (
              <p className="text-[10px] uppercase tracking-widest opacity-80 font-bold">
                Accademia {activeEvent.academy}
              </p>
            )}
          </div>
        </div>

        <nav>
          {currentView === 'USER' ? (
            <button
              onClick={() => setView('ADMIN')}
              className="bg-black/20 hover:bg-black/30 transition-colors px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2 border border-white/20"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Area Admin</span>
            </button>
          ) : (
            <div className="flex space-x-4 items-center">
              <button
                onClick={() => setView('USER')}
                className="text-white hover:underline transition-colors text-sm font-medium"
              >
                Vai al Check-in
              </button>
              {isAdminAuthenticated && (
                <button
                  onClick={onLogout}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all shadow"
                >
                  Logout
                </button>
              )}
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
