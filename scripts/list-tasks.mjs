import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

async function main() {
  const tasksSnap = await db.collection('tasks').get();
  console.log('--- TASKS (' + tasksSnap.size + ') ---');
  tasksSnap.docs.forEach(d => {
    const data = d.data();
    console.log(d.id, '|', data.title || data.name, '| status:', data.status, '| deadline:', data.deadline?.toDate?.() || data.deadline, '| pic_id:', data.pic_id);
  });

  const emSnap = await db.collectionGroup('event_members').get();
  console.log('--- EVENT MEMBERS (' + emSnap.size + ') ---');
  emSnap.docs.forEach(d => {
    console.log(d.ref.path, '->', JSON.stringify(d.data()));
  });
}
main();
