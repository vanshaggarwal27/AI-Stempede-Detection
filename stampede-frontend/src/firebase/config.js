// firebase/config.js - Firebase Configuration for SOS Alert System
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Your Firebase configuration from console
const firebaseConfig = {
  apiKey: "AIzaSyCjmJkYDES6OG3boUOsgAAwhFqLK9SNASQ",
  authDomain: "crowd-detection-b6f00.firebaseapp.com",
  projectId: "crowd-detection-b6f00",
  storageBucket: "crowd-detection-b6f00.firebasestorage.app",
  messagingSenderId: "460625758868",
  appId: "1:460625758868:web:76e83a66fcb3999e36c281",
  measurementId: "G-MVLJY9MMN4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const analytics = getAnalytics(app);
export const storage = getStorage(app);
export const db = getFirestore(app);
export const messaging = getMessaging(app);

// Messaging setup for push notifications
export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('✅ Notification permission granted');
      
      // Get FCM registration token
      const token = await getToken(messaging, {
        vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY // We'll set this up
      });
      
      if (token) {
        console.log('📱 FCM Token:', token);
        return token;
      } else {
        console.log('❌ No registration token available');
        return null;
      }
    } else {
      console.log('❌ Notification permission denied');
      return null;
    }
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return null;
  }
};

// Listen for foreground messages
export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      console.log('📥 Foreground message received:', payload);
      resolve(payload);
    });
  });

// Firebase Storage helpers for SOS videos
export const uploadSOSVideo = async (videoFile, userId) => {
  try {
    const timestamp = Date.now();
    const fileName = `sos_${userId}_${timestamp}.mp4`;
    const storageRef = ref(storage, `sos-videos/${fileName}`);
    
    console.log('📤 Uploading SOS video to Firebase Storage...');
    
    const snapshot = await uploadBytes(storageRef, videoFile);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log('✅ Video uploaded successfully:', downloadURL);
    
    return {
      videoUrl: downloadURL,
      fileName: fileName,
      size: snapshot.metadata.size
    };
  } catch (error) {
    console.error('❌ Video upload failed:', error);
    throw new Error(`Failed to upload video: ${error.message}`);
  }
};

// Firestore helpers for SOS reports
export const createSOSReport = async (sosData) => {
  try {
    const docRef = await addDoc(collection(db, 'sosReports'), {
      ...sosData,
      createdAt: serverTimestamp(),
      status: 'pending'
    });
    
    console.log('✅ SOS report created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Failed to create SOS report:', error);
    throw new Error(`Failed to create SOS report: ${error.message}`);
  }
};

// Real-time listener for admin panel
export const listenToSOSReports = (callback) => {
  const q = query(
    collection(db, 'sosReports'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const reports = [];
    querySnapshot.forEach((doc) => {
      reports.push({ id: doc.id, ...doc.data() });
    });
    callback(reports);
  });
};

// Update SOS report status (for admin actions)
export const updateSOSStatus = async (reportId, status, adminNotes = '') => {
  try {
    const reportRef = doc(db, 'sosReports', reportId);
    await updateDoc(reportRef, {
      status: status,
      adminReview: {
        decision: status,
        adminNotes: adminNotes,
        reviewedAt: serverTimestamp()
      }
    });
    
    console.log(`✅ SOS report ${reportId} ${status}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to update SOS status:', error);
    throw new Error(`Failed to update SOS status: ${error.message}`);
  }
};

export default app;
