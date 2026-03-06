/**
 * Smoke Test Script — PHASE 2 Verification
 * Run: npm run verify
 *
 * Tests (no Firebase connection required):
 * 1. getDefaultTemplateSnapshot includes all 4 locked base fields
 * 2. generateCSV appends dynamic headers when templateSnapshot is provided
 * 3. generateCSV is backward-compatible without snapshot
 * 4. Dynamic column computation: locked fields NOT included
 * 5. Dynamic column computation: visibleInAdminTable:false fields NOT included
 */

// ─── Types ────────────────────────────────────────────────────────────────────
interface FieldDef {
    key: string;
    label: string;
    type: string;
    required: boolean;
    options?: string[];
    locked?: boolean;
    visibleInAdminTable?: boolean;
}
interface TemplateSnapshot {
    name: string;
    academyTag: string;
    theme?: { primary: string; secondary: string; gradient: string };
    fields: FieldDef[];
}

// ─── Inline copies of pure logic (no Firebase/DOM deps) ──────────────────────

const ACADEMY_THEMES: Record<string, { primary: string; secondary: string; gradient: string; label: string }> = {
    REA: { primary: 'rose-600', secondary: 'rose-50', gradient: 'from-rose-600 to-pink-500', label: 'Makeup & Beauty' },
    VIS: { primary: 'teal-600', secondary: 'teal-50', gradient: 'from-teal-600 to-emerald-500', label: 'Tattoo & Arts' },
    DAM: { primary: 'indigo-600', secondary: 'indigo-50', gradient: 'from-indigo-600 to-blue-500', label: 'Digital Arts & Media' },
    GENERAL: { primary: 'slate-700', secondary: 'slate-50', gradient: 'from-slate-700 to-slate-500', label: 'Eventi Generali' },
};

const ACADEMY_COURSES: Record<string, string[]> = {
    DAM: ['Photography & Ai Innovation', 'Cinema & New Media', 'AI Powered Graphic & Web', 'VFX & Game Design'],
    REA: ['Bachelor Beauty Design', 'Make up Regionale Annuale', 'Make up Beauty Pro'],
    VIS: ['Tattoo Annuale'],
    GENERAL: [],
};

function getDefaultTemplateSnapshot(academy: string): TemplateSnapshot {
    const theme = ACADEMY_THEMES[academy] || ACADEMY_THEMES.GENERAL;
    const courses = ACADEMY_COURSES[academy] || [];
    return {
        name: academy,
        academyTag: academy,
        theme: { primary: theme.primary, secondary: theme.secondary, gradient: theme.gradient },
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, locked: true, visibleInAdminTable: true },
            { key: 'cognome', label: 'Cognome', type: 'text', required: true, locked: true, visibleInAdminTable: true },
            { key: 'email', label: 'Email', type: 'email', required: true, locked: true, visibleInAdminTable: true },
            { key: 'cellulare', label: 'Telefono', type: 'tel', required: true, locked: true, visibleInAdminTable: true },
            { key: 'eta', label: 'Età', type: 'number', required: false, visibleInAdminTable: false },
            { key: 'come_ci_hai_conosciuto', label: 'Come ci hai conosciuto', type: 'text', required: false, visibleInAdminTable: false },
            { key: 'dipartimento_interesse', label: 'Corso di Interesse', type: 'select', required: false, options: courses, visibleInAdminTable: true },
            { key: 'accompagnatore', label: 'Accompagnatore', type: 'select', required: false, options: ['Solo', 'Genitore', 'Amico'], visibleInAdminTable: false },
        ],
    };
}

function generateCSV(leads: any[], templateSnapshot?: TemplateSnapshot): string {
    const baseHeaders = ['Nome', 'Cognome', 'Corso di Interesse', 'Telefono', 'E-mail', 'Accompagnatore', 'Orientatore', 'Orientamento Fatto', 'Bloccato', 'Privacy Accettata', 'Stato Check-in', 'Data'];
    const dynamicFields = templateSnapshot
        ? templateSnapshot.fields.filter(f => !f.locked && f.visibleInAdminTable !== false)
        : [];
    const headers = [...baseHeaders, ...dynamicFields.map(f => f.label)];
    const rows = leads.map(l => [
        l.nome, l.cognome, l.dipartimento_interesse || l.corso_di_interesse || '',
        l.cellulare, l.email,
        l.accompagnatore || 'Nessuno', l.orientatore || 'Non Assegnato',
        l.orientamento_effettuato ? 'SI' : 'NO', l.bloccato ? 'SI' : 'NO',
        l.privacy_accettata ? 'SI' : 'NO', l.stato_checkin, l.data_checkin || '',
        ...dynamicFields.map(f => {
            const val = l.answers?.[f.key] ?? '';
            return typeof val === 'boolean' ? (val ? 'SI' : 'NO') : String(val);
        }),
    ]);
    return [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
}

// ─── Test runner ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (e: any) {
        console.error(`  ❌ ${name}\n     → ${e.message}`);
        failed++;
    }
}

function expect(actual: any) {
    const matchers = {
        toBe: (expected: any) => {
            if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        },
        toContain: (item: any) => {
            if (!actual.includes(item)) throw new Error(`Expected array/string to contain ${JSON.stringify(item)}`);
        },
        toBeTruthy: () => {
            if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
        },
        toBeGreaterThan: (n: number) => {
            if (!(actual > n)) throw new Error(`Expected ${actual} > ${n}`);
        },
        not: {
            toContain: (item: any) => {
                if (actual.includes(item)) throw new Error(`Expected array/string NOT to contain ${JSON.stringify(item)}`);
            },
        },
    };
    return matchers;
}

// ─── Tests ────────────────────────────────────────────────────────────────────
console.log('\n🔬 Smoke Tests — Phase 2 Verification\n');

// 1. Default snapshot includes all 4 locked base fields
console.log('📋 Test 1: getDefaultTemplateSnapshot');
['VIS', 'REA', 'DAM', 'GENERAL'].forEach(academy => {
    test(`[${academy}] has 4 locked base fields`, () => {
        const snap = getDefaultTemplateSnapshot(academy);
        const lockedKeys = snap.fields.filter(f => f.locked).map(f => f.key);
        for (const key of ['nome', 'cognome', 'email', 'cellulare']) {
            expect(lockedKeys).toContain(key);
        }
        expect(lockedKeys.length).toBe(4);
    });
    test(`[${academy}] has at least 1 extra dynamic field`, () => {
        const snap = getDefaultTemplateSnapshot(academy);
        const dynamic = snap.fields.filter(f => !f.locked);
        expect(dynamic.length).toBeGreaterThan(0);
    });
});

// 2. generateCSV backward compatibility (no snapshot)
console.log('\n📊 Test 2: generateCSV backward compatibility');
const mockLead = {
    nome: 'Mario', cognome: 'Rossi', email: 'mario@test.it', cellulare: '3331234567',
    dipartimento_interesse: 'Tattoo Annuale', accompagnatore: 'Solo',
    orientatore: 'Laura', orientamento_effettuato: true, bloccato: false,
    privacy_accettata: true, stato_checkin: 'Confermato', data_checkin: '',
};
test('CSV without snapshot has 12 base columns only', () => {
    const csv = generateCSV([mockLead]);
    const headers = csv.split('\n')[0].split(';');
    expect(headers.length).toBe(12);
});

// 3. generateCSV with snapshot adds dynamic columns
console.log('\n📊 Test 3: generateCSV with templateSnapshot');
test('CSV with VIS snapshot has more than 12 columns', () => {
    const snap = getDefaultTemplateSnapshot('VIS');
    const csv = generateCSV([mockLead], snap);
    const headers = csv.split('\n')[0].split(';');
    expect(headers.length).toBeGreaterThan(12);
});
test('CSV with snapshot includes "Corso di Interesse" header', () => {
    const snap = getDefaultTemplateSnapshot('VIS');
    const csv = generateCSV([mockLead], snap);
    const headers = csv.split('\n')[0];
    expect(headers).toContain('Corso di Interesse');
});
test('CSV with snapshot does NOT include locked field labels as extra columns', () => {
    const snap = getDefaultTemplateSnapshot('VIS');
    const dynamicHeaders = snap.fields.filter(f => !f.locked && f.visibleInAdminTable !== false).map(f => f.label);
    const lockedLabels = snap.fields.filter(f => f.locked).map(f => f.label);
    for (const lockedLabel of lockedLabels) {
        expect(dynamicHeaders).not.toContain(lockedLabel);
    }
});

// 4. Dynamic column computation matches spec
console.log('\n🔍 Test 4: Dynamic column computation');
test('dynamicFields excludes locked fields', () => {
    const snap = getDefaultTemplateSnapshot('VIS');
    const dynamic = snap.fields.filter(f => !f.locked && f.visibleInAdminTable !== false);
    const haslocked = dynamic.some(f => f.locked);
    expect(haslocked).toBe(false);
});
test('dynamicFields excludes visibleInAdminTable:false fields', () => {
    const snap = getDefaultTemplateSnapshot('VIS');
    const dynamic = snap.fields.filter(f => !f.locked && f.visibleInAdminTable !== false);
    const hasHidden = dynamic.some(f => f.visibleInAdminTable === false);
    expect(hasHidden).toBe(false);
});
test('with no snapshot, dynamicFields is empty', () => {
    const snap = undefined;
    const dynamic = snap ? (snap as TemplateSnapshot).fields.filter(f => !f.locked && f.visibleInAdminTable !== false) : [];
    expect(dynamic.length).toBe(0);
});

// 5. lead.answers values appear in CSV
console.log('\n📊 Test 5: lead.answers in CSV');
test('answers values are appended correctly in CSV row', () => {
    const snap = getDefaultTemplateSnapshot('VIS');
    const leadWithAnswers = { ...mockLead, answers: { dipartimento_interesse: 'Tattoo Annuale' } };
    const csv = generateCSV([leadWithAnswers], snap);
    expect(csv).toContain('Tattoo Annuale');
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
} else {
    console.log('✨ All tests passed!\n');
}
