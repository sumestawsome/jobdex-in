import fs from 'fs';
import path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
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

async function testData() {
  const [tasksSnap, eventsSnap, usersSnap] = await Promise.all([
    db.collection('tasks').get(),
    db.collection('events').get(),
    db.collection('users').get(),
  ]);

  const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.is_archived !== true);
  const allEvents = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const activeEventsList = allEvents.filter(e => e.status !== 'selesai');
  const activeEvents = activeEventsList.length;
  const activeEventNames = Array.from(new Set(activeEventsList.map(e => e.name || "Acara Aktif")));

  const activeJobsList = tasks.filter(t => t.status !== 'approved');
  const activeJobs = activeJobsList.length;
  const activeJobsDivisionCount = activeJobsList.filter(t => !t.event_id).length;
  const activeJobsEventCount = activeJobsList.filter(t => !!t.event_id).length;

  const stuckCount = tasks.filter(t => t.status === 'stuck' || t.status === 'butuh_bantuan').length;
  const approvalCount = tasks.filter(t => t.status === 'menunggu_approval').length;
  const revisionCount = tasks.filter(t => t.status === 'perlu_revisi' || t.status === 'revisi_dikerjakan').length;
  const needsAttention = tasks.filter(t =>
    t.status === 'stuck' || t.status === 'butuh_bantuan' || t.status === 'menunggu_approval' || t.status === 'perlu_revisi'
  ).length;

  const completedTotal = tasks.filter(t => t.status === 'approved').length;

  console.log('=== DASHBOARD METRICS SUMMARY ===');
  console.log('Active Events:', activeEvents, '| Names:', activeEventNames.join(', '));
  console.log('Active Jobs:', activeJobs, `(${activeJobsDivisionCount} divisi, ${activeJobsEventCount} acara)`);
  console.log('Needs Attention:', needsAttention, `(${stuckCount} stuck, ${approvalCount} approval, ${revisionCount} revisi)`);
  console.log('Completed Total:', completedTotal);

  console.log('\n=== ACTIVE JOBS IN QUEUE ===');
  activeJobsList.forEach(t => {
    console.log(`- [${t.status}] ${t.name} (Deadline: ${t.deadline?.toDate?.() || t.deadline})`);
  });
}

testData();
