// Test script for Firebase sos-alerts collection connection
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, addDoc, serverTimestamp } = require("firebase/firestore");

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC6XtUDmKv0aul-zUL3TRH1i2UxWtgCLU0",
  authDomain: "crowd-monitoring-e1f70.firebaseapp.com",
  projectId: "crowd-monitoring-e1f70",
  storageBucket: "crowd-monitoring-e1f70.firebasestorage.app",
  messagingSenderId: "1069463850395",
  appId: "1:1069463850395:web:f24d177297c60e0c50a53e",
  measurementId: "G-68VH97XQ6V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testFirebaseConnection() {
  try {
    console.log('🔥 Testing Firebase connection...');
    console.log('📋 Project ID:', app.options.projectId);
    
    // Test reading from sos-alerts collection
    console.log('\n📖 Testing read from sos-alerts collection...');
    const sosAlertsCollection = collection(db, 'sos-alerts');
    const snapshot = await getDocs(sosAlertsCollection);
    
    console.log('✅ Successfully connected to sos-alerts collection!');
    console.log('📊 Total documents found:', snapshot.size);
    
    if (snapshot.size > 0) {
      console.log('\n📄 Documents in collection:');
      snapshot.forEach((doc) => {
        console.log('- Document ID:', doc.id);
        console.log('- Document data:', doc.data());
        console.log('---');
      });
    } else {
      console.log('📭 Collection is empty - this is normal for a new setup');
      
      // Optionally add a test document
      console.log('\n📝 Adding test SOS alert document...');
      const testAlert = {
        userId: 'test_user_12345',
        message: 'Test emergency situation - Firebase connection verification',
        location: {
          latitude: 28.7041,
          longitude: 77.1025,
          accuracy: 5.0
        },
        videoUrl: 'https://example.com/test-video.mp4',
        deviceInfo: {
          platform: 'web',
          version: '1.0.0',
          model: 'Test Device'
        },
        createdAt: serverTimestamp(),
        status: 'pending'
      };
      
      const docRef = await addDoc(sosAlertsCollection, testAlert);
      console.log('✅ Test document added with ID:', docRef.id);
      console.log('🎉 Firebase sos-alerts collection is fully operational!');
    }
    
  } catch (error) {
    console.error('❌ Firebase connection test failed:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    if (error.code === 'permission-denied') {
      console.log('\n🚫 Permission denied - please check Firestore security rules');
      console.log('Make sure your Firestore rules allow read/write access');
    }
  }
}

// Run the test
testFirebaseConnection().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
