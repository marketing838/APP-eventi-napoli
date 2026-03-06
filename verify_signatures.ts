
import * as storage from './services/storageService';

const expectedExports = [
    'getLeads',
    'saveLeads',
    'clearLeads',
    'getActiveEvent',
    'setActiveEvent',
    'parseCSV',
    'generateCSV'
];

console.log('Verifying storageService.ts signatures...');

expectedExports.forEach(fnName => {
    if (typeof (storage as any)[fnName] !== 'function') {
        console.error(`❌ Missing export: ${fnName}`);
        process.exit(1);
    }
    console.log(`✅ ${fnName} is exported.`);
});

console.log('All signatures are present.');
