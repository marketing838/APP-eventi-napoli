import { Lead } from '../types';

const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/26076162/uxqcqit/';

export const sendLeadToZapier = async (lead: Lead, academy: string) => {
  try {
    const academyKey = academy.toLowerCase();
    
    const idCorso = lead.dipartimento_interesse || lead.corso_di_interesse || '';

    const payload = {
      [academyKey]: {
        idCorso: idCorso,
        nome: lead.nome,
        cognome: lead.cognome,
        email: lead.email,
        telefono: lead.cellulare,
        tipoContatto: lead.come_ci_hai_conosciuto,
        sede: 'Napoli',
        tipoModulo: 'Check-in App Eventi',
        sitoUrl: window.location.href
      }
    };

    console.log(`🚀 Sending lead to Zapier [${academyKey}]...`);
    
    // Usiamo no-cors per evitare blocchi CORS dal browser (esattamente come nel sito)
    await fetch(ZAPIER_WEBHOOK_URL, {
        method: 'POST',
        mode: 'no-cors', 
        body: JSON.stringify(payload)
    });

    console.log(`✅ Lead sent to Zapier!`);
  } catch (error) {
    console.error('❌ Failed to send lead to Zapier:', error);
  }
};
