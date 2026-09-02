const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function check() {
  const snapshot = await db.collection('daily_records').orderBy('date', 'desc').limit(1).get();
  if (snapshot.empty) {
    console.log("No records found.");
    return;
  }
  
  const doc = snapshot.docs[0];
  const data = doc.data();
  console.log("Date:", doc.id);
  
  const history = data.siang?.history || [];
  if (history.length === 0) {
    console.log("No history found for siang.");
    return;
  }
  
  const lastSnap = history[history.length - 1];
  console.log("Last Snapshot Jam:", lastSnap.jam);
  console.log("Has tickets_3a_by_channel_visit?", !!lastSnap.tickets_3a_by_channel_visit);
  if (lastSnap.tickets_3a_by_channel_visit) {
    console.log("Keys:", Object.keys(lastSnap.tickets_3a_by_channel_visit));
  }
  console.log("Has iwm?", !!lastSnap.iwm);
}

check().catch(console.error);
