import { Lead } from '../types';

const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/26076162/uxqcqit/';

export const sendLeadToZapier = async (lead: Lead, academy: string, dataOD?: string) => {
  try {
    const academyKey = academy.toLowerCase();
    
    const idCorso = lead.dipartimento_interesse || lead.corso_di_interesse || '';

    const payload = {
      idCorso: idCorso,
      nome: lead.nome,
      cognome: lead.cognome,
      email: lead.email,
      telefono: lead.cellulare,
      tipoContatto: lead.come_ci_hai_conosciuto,
      sede: 'Napoli',
      accademia: academyKey.toUpperCase(),
      tipoModulo: 'Check-in App Eventi',
      sitoUrl: window.location.href,
      dataOD: dataOD || ''
    };

    console.log(`🚀 Sending lead to Zapier [${academyKey}]...`);
    
    // Usiamo no-cors per evitare blocchi CORS dal browser (esattamente come nel sito)
    await fetch(ZAPIER_WEBHOOK_URL, {
        method: 'POST',
        mode: 'no-cors', 
        body: JSON.stringify(payload)
    });

    console.log(`✅ Lead sent to Zapier!`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send lead to Zapier:', error);
    return false;
  }
};
