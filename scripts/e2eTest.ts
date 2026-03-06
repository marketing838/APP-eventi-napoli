/**
 * E2E Test Script — Phase 3.2A: Dynamic USER Form + Snapshot Freeze
 * ─────────────────────────────────────────────────────────────────
 * SAFE: crea solo dati di test isolati. NON modifica template/eventi di produzione.
 * Run: npm run test:e2e-3.2a
 *
 * STEP 1 — Duplica tpl-vis come template di test con campo extra
 * STEP 2 — Crea evento di test, applica il template (force=true)
 * STEP 3 — Crea lead di test con answers
 * STEP 4 — Verifica logica CSV (in-process)
 * STEP 5 — Stampa report finale per validazione manuale (max 30s)
 * CLEANUP — Elimina lead/evento di test (template opzionale)
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId) {
    console.error('❌ VITE_FIREBASE_PROJECT_ID mancante. Serve .env.local con credenziali Firebase.');
    process.exit(1);
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// ─── CSV generation (inline — non importa il modulo browser) ─────────────────
interface FieldDef { key: string; label: string; locked?: boolean; visibleInAdminTable?: boolean; }
interface TemplateSnapshot { name: string; academyTag: string; theme?: { primary: string; secondary: string; gradient: string }; fields: FieldDef[]; }
interface Lead { id: string; nome: string; cognome: string; email: string; cellulare: string; answers?: Record<string, any>;[k: string]: any; }

function generateCSV(leads: Lead[], snapshot?: TemplateSnapshot): string {
    const BASE_HEADERS = ['ID', 'Nome', 'Cognome', 'Email', 'Cellulare', 'Età', 'Orientatore', 'Accompagnatore', 'Dipartimento', 'Come ci ha conosciuto', 'Stato Check-in', 'Ultima modifica'];
    const dynamicFields = snapshot
        ? snapshot.fields.filter(f => !f.locked && f.visibleInAdminTable !== false)
        : [];
    const headers = [...BASE_HEADERS, ...dynamicFields.map(f => f.label)];
    const rows = leads.map(lead => {
        const base = [lead.id, lead.nome, lead.cognome, lead.email, lead.cellulare,
        lead.eta ?? '', lead.orientatore ?? '', lead.accompagnatore ?? '',
        lead.dipartimento_interesse ?? '', lead.come_ci_hai_conosciuto ?? '',
        lead.stato_checkin ?? '', lead.data_checkin ?? ''];
        const extra = dynamicFields.map(f => lead.answers?.[f.key] ?? '');
        return [...base, ...extra].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    return [headers.join(','), ...rows].join('\n');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const pass = (msg: string) => console.log(`  ✅ ${msg}`);
const fail = (msg: string) => { console.log(`  ❌ ${msg}`); process.exit(1); };
const info = (msg: string) => console.log(`  ℹ️  ${msg}`);

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function run() {
    const TS = Date.now();
    const tplId = `tpl-vis-e2e-${TS}`;
    const eventId = `e2e-event-${TS}`;
    const leadId = `e2e-lead-${TS}`;

    console.log(`\n🧪 Phase 3.2A — E2E Test  [Firebase: ${firebaseConfig.projectId}]`);
    console.log(`   Template: ${tplId}`);
    console.log(`   Evento:   ${eventId}`);
    console.log(`   Lead:     ${leadId}\n`);

    // ───────────────────────────────────────────────────────────────────────────
    // STEP 1 — Duplica tpl-vis + aggiungi campo dinamico
    // ───────────────────────────────────────────────────────────────────────────
    console.log('📋 STEP 1 — Duplica template tpl-vis con campo extra');

    const srcRef = doc(db, 'formTemplates', 'tpl-vis');
    const srcSnap = await getDoc(srcRef);
    if (!srcSnap.exists()) fail('tpl-vis non trovato in Firestore — esegui prima npm run seed:templates');
    const srcData = srcSnap.data() as any;
    info(`tpl-vis letto: ${srcData.fields.length} campi`);

    const extraField = {
        key: 'esperienza_tatuaggi',
        label: 'Esperienza con i tatuaggi?',
        type: 'select',
        required: false,
        options: ['Prima volta', 'Ho qualche tatuaggio', 'Molto tatuato'],
        visibleInAdminTable: true,
    };

    const newTemplate = {
        ...srcData,
        id: tplId,
        name: `VIS E2E Test ${TS}`,
        fields: [...srcData.fields, extraField],
        createdAtMs: TS,
        updatedAtMs: TS,
    };

    await setDoc(doc(db, 'formTemplates', tplId), newTemplate);
    pass(`Template ${tplId} creato (${newTemplate.fields.length} campi)`);

    // Verifica
    const tplCheck = await getDoc(doc(db, 'formTemplates', tplId));
    if (!tplCheck.exists()) fail('Template non trovato dopo scrittura');
    const tplData = tplCheck.data() as any;
    const hasExtraField = tplData.fields.some((f: any) => f.key === 'esperienza_tatuaggi');
    if (!hasExtraField) fail('Campo esperienza_tatuaggi non presente');
    if (tplData.fields.length !== srcData.fields.length + 1) fail('Conteggio campi errato');
    pass(`Campo esperienza_tatuaggi presente. Campi totali: ${tplData.fields.length}`);

    // ───────────────────────────────────────────────────────────────────────────
    // STEP 2 — Crea evento di test + applica template
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n📅 STEP 2 — Crea evento di test e applica template');

    const snapshot: TemplateSnapshot = {
        name: newTemplate.name,
        academyTag: newTemplate.academyTag,
        theme: newTemplate.theme,
        fields: newTemplate.fields,
    };

    const eventDoc = {
        id: eventId,
        name: `E2E-TEST-${TS}`,
        academy: 'VIS',
        date: new Date().toISOString().split('T')[0],
        templateId: tplId,
        templateSnapshot: snapshot,
        createdAtMs: TS,
        updatedAtMs: TS,
    };

    await setDoc(doc(db, 'events', eventId), eventDoc);
    pass(`Evento ${eventId} creato`);

    // Verifica
    const evCheck = await getDoc(doc(db, 'events', eventId));
    if (!evCheck.exists()) fail('Evento non trovato dopo scrittura');
    const evData = evCheck.data() as any;
    if (evData.templateId !== tplId) fail(`templateId errato: ${evData.templateId}`);
    if (!evData.templateSnapshot) fail('templateSnapshot assente');
    const snapHasExtra = evData.templateSnapshot.fields.some((f: any) => f.key === 'esperienza_tatuaggi');
    if (!snapHasExtra) fail('Campo extra non presente nello snapshot');
    pass(`templateId: ${evData.templateId}`);
    pass(`templateSnapshot.fields: ${evData.templateSnapshot.fields.length} campi`);
    pass('Campo esperienza_tatuaggi presente nello snapshot ✓');

    // ───────────────────────────────────────────────────────────────────────────
    // STEP 3 — Crea lead di test con answers
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n👤 STEP 3 — Crea lead di test con answers');

    const leadDoc = {
        id: leadId,
        nome: 'Test',
        cognome: 'E2E',
        email: `test.e2e.${TS}@example.com`,
        cellulare: '+39 000 0000000',
        stato_checkin: 'Nuovo Lead',
        data_checkin: new Date().toLocaleString('it-IT'),
        createdAtMs: TS,
        updatedAtMs: TS,
        answers: {
            esperienza_tatuaggi: 'Prima volta',
        },
    };

    await setDoc(doc(db, 'events', eventId, 'leads', leadId), leadDoc);
    pass(`Lead ${leadId} creato`);

    // Verifica
    const leadCheck = await getDoc(doc(db, 'events', eventId, 'leads', leadId));
    if (!leadCheck.exists()) fail('Lead non trovato dopo scrittura');
    const leadData = leadCheck.data() as any;
    if (leadData.answers?.esperienza_tatuaggi !== 'Prima volta') fail(`answers errati: ${JSON.stringify(leadData.answers)}`);
    if (!leadData.updatedAtMs) fail('updatedAtMs assente');
    pass(`answers.esperienza_tatuaggi = "${leadData.answers.esperienza_tatuaggi}"`);
    pass('updatedAtMs presente');

    // ───────────────────────────────────────────────────────────────────────────
    // STEP 4 — Verifica CSV (in-process)
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n📊 STEP 4 — Verifica logica CSV');

    const csvLeads: Lead[] = [leadData as Lead];
    const csv = generateCSV(csvLeads, snapshot as TemplateSnapshot);
    const lines = csv.split('\n');
    const header = lines[0];
    const row = lines[1] ?? '';

    if (!header.includes('Esperienza con i tatuaggi?')) fail(`Header CSV mancante "Esperienza con i tatuaggi?"\nHEADER: ${header}`);
    pass('Header CSV contiene "Esperienza con i tatuaggi?"');

    if (!row.includes('Prima volta')) fail(`Riga CSV non contiene "Prima volta"\nROW: ${row}`);
    pass('Riga CSV contiene "Prima volta"');

    // ───────────────────────────────────────────────────────────────────────────
    // STEP 5 — Report finale
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n' + '─'.repeat(60));
    console.log('📋 REPORT E2E — Phase 3.2A');
    console.log('─'.repeat(60));
    console.log(`  Template creato:       ${tplId}`);
    console.log(`  Evento creato:         ${eventId}`);
    console.log(`  Lead creato:           ${leadId}`);
    console.log(`  Snapshot → campo extra: YES`);
    console.log(`  CSV header/value:      YES`);
    console.log('─'.repeat(60));
    console.log('\n🧑 VALIDAZIONE MANUALE (max 30s):');
    console.log('  1. Apri Admin → Imposta evento attivo: seleziona da Firebase');
    console.log(`     (cerca "E2E-TEST-${TS}" o usa ID: ${eventId})`);
    console.log('  2. Apri Diagnostica 🔬 → verifica:');
    console.log(`     - Template ID:     ${tplId}`);
    console.log(`     - Snapshot presente: SÌ`);
    console.log(`     - Campi dinamici:  >= 1`);
    console.log('  3. Apri form USER → verifica sezione "Informazioni aggiuntive"');
    console.log('     → deve mostrare "Esperienza con i tatuaggi?" come select');
    console.log('');

    // ───────────────────────────────────────────────────────────────────────────
    // CLEANUP — Elimina lead e evento di test (template rimane per ispezione)
    // ───────────────────────────────────────────────────────────────────────────
    console.log('🧹 CLEANUP — Eliminazione dati di test');

    await deleteDoc(doc(db, 'events', eventId, 'leads', leadId));
    pass(`Lead ${leadId} eliminato`);

    await deleteDoc(doc(db, 'events', eventId));
    pass(`Evento ${eventId} eliminato`);

    // Il template tpl-vis-e2e rimane in Firestore per ispezione manuale.
    // Decommentare per eliminarlo:
    // await deleteDoc(doc(db, 'formTemplates', tplId));
    // pass(`Template ${tplId} eliminato`);
    info(`Template ${tplId} conservato per ispezione (puoi eliminarlo manualmente)`);

    console.log('\n✨ E2E Test completato con successo — tutti gli step superati!\n');
}

run().catch(e => {
    console.error('❌ E2E Test fallito:', e);
    process.exit(1);
});
