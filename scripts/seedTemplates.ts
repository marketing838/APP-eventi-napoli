/**
 * Seed Script — formTemplates collection
 * Crea 5 template base in Firestore (uno per academy + GENERAL).
 * Run: npm run seed:templates
 *
 * Non sovrascrive se il documento esiste già.
 * Usa le variabili VITE_* da process.env (passate via --env-file .env.local se disponibile).
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

// ─── Firebase config da variabili d'ambiente ──────────────────────────────────
// Le variabili VITE_* sono disponibili a build time in Vite, ma non in Node.
// tsx le legge da process.env se --env-file .env.local è passato.
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId) {
    console.error('❌ VITE_FIREBASE_PROJECT_ID non trovato. Assicurati di avere .env.local con le variabili Firebase.');
    console.error('   Esegui: npm run seed:templates (legge .env.local automaticamente)');
    process.exit(1);
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// ─── Definizione dei 5 template base ─────────────────────────────────────────
const BASE_LOCKED_FIELDS = [
    { key: 'nome', label: 'Nome', type: 'text', required: true, locked: true, visibleInAdminTable: true },
    { key: 'cognome', label: 'Cognome', type: 'text', required: true, locked: true, visibleInAdminTable: true },
    { key: 'email', label: 'Email', type: 'email', required: true, locked: true, visibleInAdminTable: true },
    { key: 'cellulare', label: 'Telefono', type: 'tel', required: true, locked: true, visibleInAdminTable: true },
];

const COMMON_EXTRA = [
    { key: 'eta', label: 'Età', type: 'number', required: false, visibleInAdminTable: false },
    { key: 'come_ci_hai_conosciuto', label: 'Come ci hai conosciuto', type: 'text', required: false, visibleInAdminTable: false },
    { key: 'accompagnatore', label: 'Accompagnatore', type: 'select', required: false, options: ['Solo', 'Genitore', 'Amico'], visibleInAdminTable: false },
];

const TEMPLATES = [
    {
        id: 'tpl-vis',
        name: 'Template Tattoo & Arts (VIS)',
        academyTag: 'VIS',
        theme: { primary: 'teal-600', secondary: 'teal-50', gradient: 'from-teal-600 to-emerald-500' },
        fields: [
            ...BASE_LOCKED_FIELDS,
            { key: 'dipartimento_interesse', label: 'Corso di Interesse', type: 'select', required: false, options: ['Tattoo Annuale', 'Bachelor Tattoo & Contemporary Illustration', 'Piercing Annuale'], visibleInAdminTable: true },
            ...COMMON_EXTRA,
        ],
    },
    {
        id: 'tpl-rea',
        name: 'Template Makeup & Beauty (REA)',
        academyTag: 'REA',
        theme: { primary: 'rose-600', secondary: 'rose-50', gradient: 'from-rose-600 to-pink-500' },
        fields: [
            ...BASE_LOCKED_FIELDS,
            { key: 'dipartimento_interesse', label: 'Corso di Interesse', type: 'select', required: false, options: ['Beauty Design Bachelor', 'Make up Regionale Annuale'], visibleInAdminTable: true },
            ...COMMON_EXTRA,
        ],
    },
    {
        id: 'tpl-dam',
        name: 'Template Digital Arts & Media (DAM)',
        academyTag: 'DAM',
        theme: { primary: 'indigo-600', secondary: 'indigo-50', gradient: 'from-indigo-600 to-blue-500' },
        fields: [
            ...BASE_LOCKED_FIELDS,
            { key: 'dipartimento_interesse', label: 'Corso di Interesse', type: 'select', required: false, options: ['Photography & Ai Innovation', 'Cinema & New Media', 'AI Powered Graphic & Web', 'VFX & Game Design', 'Event & Wedding Planner', 'Acting'], visibleInAdminTable: true },
            ...COMMON_EXTRA,
        ],
    },
    {
        id: 'tpl-general',
        name: 'Template Generale',
        academyTag: 'GENERAL',
        theme: { primary: 'slate-700', secondary: 'slate-50', gradient: 'from-slate-700 to-slate-500' },
        fields: [
            ...BASE_LOCKED_FIELDS,
            ...COMMON_EXTRA,
        ],
    },
];

// ─── Seed ────────────────────────────────────────────────────────────────────
async function seed() {
    console.log(`\n📋 Seed formTemplates → Firebase [${firebaseConfig.projectId}]\n`);
    let created = 0;
    let skipped = 0;

    for (const tpl of TEMPLATES) {
        const ref = doc(db, 'formTemplates', tpl.id);
        const existing = await getDoc(ref);

        if (existing.exists()) {
            console.log(`  ⏭️  ${tpl.id} già esiste — skip`);
            skipped++;
            continue;
        }

        await setDoc(ref, {
            ...tpl,
            createdAtMs: Date.now(),
            updatedAtMs: Date.now(),
        });
        console.log(`  ✅ ${tpl.id} creato (${tpl.fields.length} campi)`);
        created++;
    }

    console.log(`\nRiepilogo: ${created} creati, ${skipped} saltati.\n`);
}

seed().catch(e => {
    console.error('❌ Seed fallito:', e);
    process.exit(1);
});
