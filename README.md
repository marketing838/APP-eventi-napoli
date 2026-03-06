# EventLeadPro — Sede Napoli

Replica dell'app EventLeadPro dedicata alla sede di **Napoli**.
Stesso codice, database Firebase separato.

## Setup iniziale

### 1. Installa dipendenze
```bash
npm install
```

### 2. Configura Firebase
Copia le credenziali del progetto Firebase di Napoli nel file `.env.local`:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 3. Seed dei template iniziali (prima volta)
```bash
npm run seed:templates
```

### 4. Avvia in locale
```bash
npm run dev
```

## Deploy su Vercel
1. Crea un nuovo progetto su [vercel.com](https://vercel.com) collegato a questo repo GitHub
2. Aggiungi le variabili d'ambiente Firebase nel pannello Vercel (Settings → Environment Variables)
3. Deploy automatico ad ogni push su `main`

## Note
- Questo progetto è **completamente indipendente** dalla sede di Roma
- I dati (leads, eventi) sono isolati nel proprio Firestore
- Versione: v7.0 — EventLeadPro Live System
