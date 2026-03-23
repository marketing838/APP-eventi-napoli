
export enum CheckInStatus {
  NON_PERVENUTO = 'non pervenuto',
  CONFERMATO = 'Confermato',
  AGGIORNATO = 'Aggiornato',
  NUOVO_LEAD = 'Nuovo Lead'
}

export type AcademyType = 'REA' | 'VIS' | 'DAM' | 'GENERAL';

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'checkbox' | 'number' | 'date' | 'textarea';
  required: boolean;
  options?: string[];
  locked?: boolean;                  // true per i campi base
  visibleInAdminTable?: boolean;      // default true
}

export interface TemplateSnapshot {
  name: string;
  academyTag: AcademyType;
  theme?: {
    primary: string;
    secondary: string;
    gradient: string;
  };
  fields: FieldDef[];
}

/** Documento Firestore in formTemplates/{id}.
 * Separato da TemplateSnapshot: include id e timestamps. */
export interface FormTemplate {
  id: string;
  name: string;
  academyTag: AcademyType;
  tags?: string[];    // es. ['open-day', 'master-class'] — per filtering futuro
  theme?: {
    primary: string;
    secondary: string;
    gradient: string;
  };
  fields: FieldDef[];
  createdAtMs: number;
  updatedAtMs: number;
}

export interface EventConfig {
  id: string;
  name: string;
  academy: AcademyType;
  date: string;
  odDate?: string;   // es. "2026-03-11" — data Open Day (dal date picker)
  odTime?: string;   // es. "15:30" — ora Open Day (dal time picker)
  templateSnapshot?: TemplateSnapshot;
  templateId?: string;   // riferimento a formTemplates/{templateId}
}

export interface Lead {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  cellulare: string;
  cellulare_search?: string;  // Fix 3: numero normalizzato (solo cifre) per ricerca Firestore
  eta: string;
  come_ci_hai_conosciuto: string;
  corso_di_interesse?: string;
  dipartimento_interesse?: string; // Campo dinamico per le opzioni specifiche
  accompagnatore?: string; // Genitore, Amico, Da solo
  stato_checkin: CheckInStatus;
  campi_modificati: string;
  data_checkin?: string;
  eventId?: string;
  orientatore?: string; // Nuova assegnazione manuale
  orientamento_effettuato?: boolean; // Nuovo campo check
  bloccato?: boolean; // Nuovo flag per bloccare la riga (colore lilla)
  emergenza?: boolean; // Flag per segnalare un'urgenza/attenzione particolare (lampeggiante)
  esito_iscrizione?: 'blocco posto' | 'iscritto' | 'va via prima' | ''; // Nuova colonna con 'va via prima'
  privacy_accettata: boolean; // Flag per accettazione privacy policy
  answers?: Record<string, any>; // Risposte dinamiche extra
  accompagnato_da_id?: string; // ID del partner collegato
  zapier_synced?: boolean; // Tracking sincronizzazione Zapier
}

export type ViewType = 'USER' | 'ADMIN';

export const ORIENTATORI = ['Melania', 'Sara', 'Giancarlo', 'Giulia', 'Costanza', 'Paolo'];

export const ACADEMY_THEMES: Record<AcademyType, { primary: string, secondary: string, gradient: string, label: string }> = {
  REA: { primary: 'rose-600', secondary: 'rose-50', gradient: 'from-rose-600 to-pink-500', label: 'Makeup & Beauty' },
  VIS: { primary: 'teal-600', secondary: 'teal-50', gradient: 'from-teal-600 to-emerald-500', label: 'Tattoo & Arts' },
  DAM: { primary: 'indigo-600', secondary: 'indigo-50', gradient: 'from-indigo-600 to-blue-500', label: 'Digital Arts & Media' },
  GENERAL: { primary: 'slate-700', secondary: 'slate-50', gradient: 'from-slate-700 to-slate-500', label: 'Eventi Generali' }
};

export const ACADEMY_COURSES: Record<AcademyType, string[]> = {
  DAM: [
    'Photography & Ai Innovation',
    'Cinema & New Media',
    'AI Powered Graphic & Web',
    'VFX & Game Design',
    'Event & Wedding Planner',
    'Acting'
  ],
  REA: [
    'Bachelor Beauty Design',
    'Make up Regionale Annuale',
    'Make up Beauty Pro'
  ],
  VIS: [
    'Tattoo Annuale'
  ],
  GENERAL: []
};
