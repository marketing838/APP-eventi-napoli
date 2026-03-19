
import React, { useState } from 'react';
import { Lead, CheckInStatus, AcademyType, ACADEMY_COURSES, TemplateSnapshot } from '../types';
import DynamicFields from './DynamicFields';

interface LeadFormProps {
  initialData?: Lead;
  onSave: (data: Lead) => void;
  theme?: string;
  academy?: AcademyType;
  templateSnapshot?: TemplateSnapshot;  // Phase 3.2A — campi dinamici extra
}

const LeadForm: React.FC<LeadFormProps> = ({ initialData, onSave, theme = 'indigo-600', academy = 'GENERAL', templateSnapshot }) => {
  // Campi già gestiti hardcoded nel form base — non mostrarli tra i campi dinamici
  const BASE_KEYS = new Set(['nome', 'cognome', 'email', 'cellulare', 'eta', 'come_ci_hai_conosciuto', 'dipartimento_interesse', 'accompagnatore', 'privacy_accettata']);

  const dynamicFields = templateSnapshot
    ? templateSnapshot.fields.filter(f => !f.locked && !BASE_KEYS.has(f.key))
    : [];

  const [formData, setFormData] = useState({
    nome: initialData?.nome || '',
    cognome: initialData?.cognome || '',
    email: initialData?.email || '',
    cellulare: initialData?.cellulare || '',
    eta: initialData?.eta || '',
    come_ci_hai_conosciuto: initialData?.come_ci_hai_conosciuto || '',
    dipartimento_interesse: initialData?.dipartimento_interesse || '',
    accompagnatore: initialData?.accompagnatore || '',
    privacy_accettata: initialData?.privacy_accettata || false,
  });

  const [answers, setAnswers] = useState<Record<string, any>>(
    initialData?.answers ?? {}
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.nome.trim()) newErrors.nome = 'Obbligatorio';
    if (!formData.cognome.trim()) newErrors.cognome = 'Obbligatorio';
    if (!formData.cellulare.trim()) newErrors.cellulare = 'Obbligatorio';
    if (!formData.email.trim()) newErrors.email = 'Obbligatorio';
    if (!formData.eta.trim()) newErrors.eta = 'Obbligatorio';
    if (!formData.come_ci_hai_conosciuto) newErrors.come_ci_hai_conosciuto = 'Seleziona un\'opzione';
    if (!formData.accompagnatore) newErrors.accompagnatore = 'Seleziona un\'opzione';
    if (academy !== 'GENERAL' && courses.length > 0 && !formData.dipartimento_interesse) newErrors.dipartimento_interesse = 'Seleziona un corso';
    if (!formData.privacy_accettata) newErrors.privacy_accettata = 'Necessario accettare la privacy';
    // Validazione campi dinamici extra
    dynamicFields.forEach(f => {
      if (f.required && (answers[f.key] === undefined || answers[f.key] === '' || answers[f.key] === false)) {
        newErrors[f.key] = 'Obbligatorio';
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Anti-multiclick
    if (!validate()) return;
    setIsSubmitting(true);

    let updatedStatus = CheckInStatus.NUOVO_LEAD;
    let modifiedFields: string[] = [];

    if (initialData) {
      const fields = ['nome', 'cognome', 'email', 'cellulare', 'eta', 'come_ci_hai_conosciuto', 'dipartimento_interesse', 'accompagnatore', 'privacy_accettata'] as const;
      fields.forEach(field => {
        if (formData[field] !== (initialData as any)[field]) modifiedFields.push(field);
      });
      // Fix: verifica anche cambiamenti nei campi dinamici (answers)
      if (JSON.stringify(answers) !== JSON.stringify(initialData.answers ?? {})) {
        modifiedFields.push('risposte_extra');
      }
      updatedStatus = modifiedFields.length > 0 ? CheckInStatus.AGGIORNATO : CheckInStatus.CONFERMATO;
    }


    // 3.2 FIX: Usa un ID super-randomico e timestamp per evitare
    // collisioni perfette se 4 device premono "INVIA" al millisecondo esatto
    const generateSafeId = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `lead-${Date.now()}-${crypto.randomUUID().split('-')[0]}`;
      }
      return `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    };

    onSave({
      ...initialData,
      id: initialData?.id || generateSafeId(),
      ...formData,
      cellulare_search: formData.cellulare.replace(/\D/g, ''), // Fix 3: campo normalizzato per ricerca Firestore
      answers: dynamicFields.length > 0 ? answers : (initialData?.answers ?? {}), // Fix 2: mai undefined
      stato_checkin: updatedStatus,
      campi_modificati: modifiedFields.length > 0 ? modifiedFields.join(', ') : 'nessuno',
      data_checkin: new Date().toLocaleString('it-IT')
    } as Lead);
  };

  const inputClasses = (err?: string) => `w-full px-4 py-4 bg-gray-50 border-2 ${err ? 'border-red-500' : 'border-gray-100'} rounded-2xl focus:ring-4 focus:ring-${theme}/10 focus:border-${theme} outline-none transition-all font-medium text-gray-700`;

  const accompagnatoreOptions = [
    { id: 'solo', label: 'Sono da solo', icon: '👤' },
    { id: 'genitore', label: 'Con un genitore', icon: '👪' },
    { id: 'amico', label: 'Con un amico', icon: '👫' },
  ];

  // CERCHIAMO OPZIONI DI CORSO DAL TEMPLATE CUSTOM, se disponibile
  const dipartimentoField = templateSnapshot?.fields.find(f => f.key === 'dipartimento_interesse');
  const courses = dipartimentoField?.options || ACADEMY_COURSES[academy] || [];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome</label>
          <input type="text" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className={inputClasses(errors.nome)} placeholder="Enea" />
          {errors.nome && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1 italic">{errors.nome}</p>}
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cognome</label>
          <input type="text" value={formData.cognome} onChange={(e) => setFormData({ ...formData, cognome: e.target.value })} className={inputClasses(errors.cognome)} placeholder="Rossi" />
          {errors.cognome && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1 italic">{errors.cognome}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cellulare</label>
          <input type="tel" value={formData.cellulare} onChange={(e) => setFormData({ ...formData, cellulare: e.target.value })} className={inputClasses(errors.cellulare)} placeholder="+39 ..." />
          {errors.cellulare && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1 italic">{errors.cellulare}</p>}
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">E-mail</label>
          <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClasses(errors.email)} placeholder="mario@esempio.it" />
          {errors.email && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1 italic">{errors.email}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Età</label>
          <input type="number" value={formData.eta} onChange={(e) => setFormData({ ...formData, eta: e.target.value })} className={inputClasses(errors.eta)} placeholder="18" />
          {errors.eta && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1 italic">{errors.eta}</p>}
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Come ci hai conosciuto?</label>
          <select value={formData.come_ci_hai_conosciuto} onChange={(e) => setFormData({ ...formData, come_ci_hai_conosciuto: e.target.value })} className={inputClasses(errors.come_ci_hai_conosciuto)}>
            <option value="">Seleziona...</option>
            <option value="Instagram">Instagram</option>
            <option value="Facebook">Facebook</option>
            <option value="Sito Web">Sito Web</option>
            <option value="Fiere">Fiere</option>
            <option value="Passaparola">Passaparola</option>
            <option value="Altro">Altro</option>
          </select>
          {errors.come_ci_hai_conosciuto && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1 italic">{errors.come_ci_hai_conosciuto}</p>}
        </div>
      </div>

      {academy !== 'GENERAL' && courses.length > 0 && (
        <div className="bg-gray-50 p-6 rounded-[2rem] border-2 border-gray-100">
          <label className={`text-[10px] font-black text-${theme} uppercase tracking-widest ml-1 block mb-3`}>Dipartimento / Corso di Interesse</label>
          <div className="grid grid-cols-1 gap-2">
            {courses.map((course) => (
              <button
                key={course}
                type="button"
                onClick={() => setFormData({ ...formData, dipartimento_interesse: course })}
                className={`text-left px-5 py-3 rounded-xl border-2 transition-all font-bold text-sm ${formData.dipartimento_interesse === course
                  ? `bg-white border-${theme} text-${theme} shadow-lg ring-2 ring-${theme}/10`
                  : 'bg-white border-transparent text-gray-500 hover:border-gray-200'
                  }`}
              >
                {course}
              </button>
            ))}
          </div>
          {errors.dipartimento_interesse && <p className="text-red-500 text-[10px] font-bold mt-2 ml-1 italic">{errors.dipartimento_interesse}</p>}
        </div>
      )}

      <div>
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 block mb-3">Oggi sono venuto...</label>
        <div className="grid grid-cols-3 gap-3">
          {accompagnatoreOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFormData({ ...formData, accompagnatore: opt.label })}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${formData.accompagnatore === opt.label
                ? `bg-white border-${theme} shadow-lg ring-4 ring-${theme}/10`
                : 'bg-gray-50 border-transparent hover:border-gray-200 opacity-60'
                }`}
            >
              <span className="text-2xl mb-1">{opt.icon}</span>
              <span className={`text-[10px] font-black uppercase text-center ${formData.accompagnatore === opt.label ? `text-${theme}` : 'text-gray-500'}`}>{opt.label}</span>
            </button>
          ))}
        </div>
        {errors.accompagnatore && <p className="text-red-500 text-[10px] font-bold mt-2 ml-1 italic text-center">{errors.accompagnatore}</p>}
      </div>

      {/* Sezione campi dinamici da templateSnapshot — Phase 3.2A */}
      {dynamicFields.length > 0 && (
        <div className="bg-gray-50 p-6 rounded-[2rem] border-2 border-gray-100 space-y-4">
          <p className={`text-[10px] font-black text-${theme} uppercase tracking-widest`}>Informazioni aggiuntive</p>
          <DynamicFields
            fields={dynamicFields}
            values={answers}
            errors={errors}
            onChange={(key, val) => setAnswers(prev => ({ ...prev, [key]: val }))}
            theme={theme}
          />
        </div>
      )}

      {/* Sezione Privacy */}
      <div className={`bg-gray-50 p-6 rounded-2xl border-2 ${errors.privacy_accettata ? 'border-red-500' : 'border-gray-100'} transition-all`}>
        <label className="flex items-start space-x-3 cursor-pointer group">
          <div className="relative flex items-center mt-1">
            <input
              type="checkbox"
              checked={formData.privacy_accettata}
              onChange={(e) => setFormData({ ...formData, privacy_accettata: e.target.checked })}
              className="sr-only"
            />
            <div className={`w-6 h-6 border-2 rounded-md transition-all flex items-center justify-center ${formData.privacy_accettata
              ? `bg-${theme} border-${theme}`
              : 'bg-white border-gray-300 group-hover:border-gray-400'
              }`}>
              {formData.privacy_accettata && (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-[11px] font-bold text-gray-600 leading-tight">
            Accetto il trattamento dei dati personali secondo l'informativa consultabile alla pagina{' '}
            <a
              href="https://plasgroup.it/privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
              className={`text-${theme} underline decoration-2 underline-offset-2 hover:opacity-80 transition-opacity`}
              onClick={(e) => e.stopPropagation()}
            >
              Privacy Policy
            </a>.
          </span>
        </label>
        {errors.privacy_accettata && (
          <p className="text-red-500 text-[10px] font-black mt-2 ml-9 uppercase tracking-tighter">
            Campo obbligatorio per procedere
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full py-5 bg-${theme} text-white font-black rounded-2xl shadow-xl shadow-${theme}/20 hover:scale-[1.02] active:scale-95 transition-all text-lg uppercase tracking-tight disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100`}
      >
        {isSubmitting
          ? '⏳ Salvataggio in corso...'
          : initialData ? 'Conferma Check-in ✨' : 'Registrati ora 🚀'
        }
      </button>
    </form>
  );
};

export default LeadForm;
