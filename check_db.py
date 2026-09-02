import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import json

cred = credentials.Certificate('serviceAccountKey.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

docs = db.collection('daily_records').order_by('date', direction=firestore.Query.DESCENDING).limit(1).stream()
for doc in docs:
    data = doc.to_dict()
    print("DATE:", doc.id)
    print("Malam tickets_3a_by_channel:", json.dumps(data.get('malam', {}).get('tickets_3a_by_channel'), indent=2))
    print("Siang tickets_3a_by_channel_visit:", json.dumps(data.get('siang', {}).get('tickets_3a_by_channel_visit'), indent=2))
