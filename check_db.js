const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function check() {
  const q = db.collection('daily_records').orderBy('date', 'desc').limit(1);
  const snap = await q.get();
  snap.forEach(doc => {
    console.log("DATE:", doc.id);
    const data = doc.data();
    console.log("Malam tickets_3a_by_channel:", JSON.stringify(data.malam?.tickets_3a_by_channel, null, 2));
    console.log("Siang tickets_3a_by_channel_visit:", JSON.stringify(data.siang?.tickets_3a_by_channel_visit, null, 2));
  });
}
check();
