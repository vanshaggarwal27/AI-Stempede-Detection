// firebase/config.js - Firebase Configuration for SOS Alert System
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestore, collection, addDoc, doc, updateDoc, query, onSnapshot, serverTimestamp, getDocs } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Your Firebase configuration from console
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

// Initialize Firebase services
export const analytics = getAnalytics(app);
export const storage = getStorage(app);
export const db = getFirestore(app);
export const messaging = getMessaging(app);

// Test Firebase connection
console.log('🔥 Firebase initialized successfully!');
console.log('📋 Project ID:', app.options.projectId);
console.log('📁 Storage Bucket:', app.options.storageBucket);
console.log('🌐 Auth Domain:', app.options.authDomain);

// Test Firestore connection
export const testFirestoreConnection = async () => {
  try {
    console.log('🧪 Testing Firestore connection...');
    const sosCollection = collection(db, 'sosReports');
    const snapshot = await getDocs(sosCollection);

    console.log('✅ Firestore connection successful!');
    console.log('📊 Total documents in sosReports collection:', snapshot.size);

    snapshot.forEach((doc) => {
      console.log('📄 Document:', doc.id, doc.data());
    });

    return { success: true, count: snapshot.size };
  } catch (error) {
    console.error('❌ Firestore connection failed:', error);
    return { success: false, error: error.message };
  }
};

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
  console.log('🔄 Setting up Firebase listener for sosReports collection...');
  console.log('📋 Firebase project:', db.app.options.projectId);

  try {
    // First try to get all documents to check connection
    const sosCollection = collection(db, 'sosReports');
    console.log('📁 Collection reference created:', sosCollection.path);

    // Use simpler query - just get all documents and filter client-side
    const q = query(sosCollection);

    console.log('🔍 Starting real-time listener...');

    return onSnapshot(q,
      (querySnapshot) => {
        console.log('📡 Firebase snapshot received!');
        console.log('📊 Total documents in sosReports:', querySnapshot.size);

        const allReports = [];
        const pendingReports = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          console.log('📄 Document ID:', doc.id);
          console.log('📄 Document data:', data);

          const reportData = { id: doc.id, ...data };
          allReports.push(reportData);

          // Filter for pending status client-side
          if (data.status === 'pending') {
            pendingReports.push(reportData);
            console.log('✅ Found pending report:', doc.id);
          } else {
            console.log('⏭️ Skipping non-pending report:', doc.id, 'Status:', data.status);
          }
        });

        console.log('📈 Total reports found:', allReports.length);
        console.log('📋 Pending reports found:', pendingReports.length);
        console.log('🔄 Calling callback with reports...');

        callback(pendingReports);
      },
      (error) => {
        console.error('❌ Firebase listener error:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error message:', error.message);

        // Check if it's a permission error
        if (error.code === 'permission-denied') {
          console.error('🚫 Permission denied - check Firestore security rules');
        }

        // Still call callback with empty array to show no data instead of hanging
        callback([]);
      }
    );
  } catch (error) {
    console.error('❌ Error setting up Firebase listener:', error);
    callback([]);
    return () => {}; // Return empty unsubscribe function
  }
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
        reviewedAt: serverTimestamp(),
        notificationsSent: status === 'approved' ? true : false
      }
    });

    console.log(`✅ SOS report ${reportId} ${status}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to update SOS status:', error);
    throw new Error(`Failed to update SOS status: ${error.message}`);
  }
};

// WhatsApp notification function
export const sendWhatsAppNotifications = async (sosReport, approvalData) => {
  try {
    console.log('📱 Sending WhatsApp notifications for approved SOS report...');

    // Simulate WhatsApp API call (replace with actual WhatsApp Business API)
    const whatsappData = {
      reportId: sosReport.id,
      location: sosReport.incident?.location?.address || 'Location not available',
      message: sosReport.incident?.message || 'Emergency situation',
      coordinates: {
        lat: sosReport.incident?.location?.latitude,
        lng: sosReport.incident?.location?.longitude
      },
      timestamp: new Date().toISOString(),
      adminNotes: approvalData.adminNotes
    };

    // Simulate nearby users (in real implementation, this would be from your user database)
    const nearbyUsers = [
      { name: 'User A', phone: '+91-9876543210', distance: '0.2km' },
      { name: 'User B', phone: '+91-9876543211', distance: '0.5km' },
      { name: 'User C', phone: '+91-9876543212', distance: '0.8km' },
      { name: 'User D', phone: '+91-9876543213', distance: '1.0km' }
    ];

    // Create WhatsApp message template
    const whatsappMessage = `🚨 EMERGENCY ALERT 🚨

📍 Location: ${whatsappData.location}
📱 Reported: ${whatsappData.message}
⏰ Time: ${new Date().toLocaleString()}
🗺️ Maps: https://maps.google.com/maps?q=${whatsappData.coordinates.lat},${whatsappData.coordinates.lng}

✅ Verified by Emergency Response Team
⚡ Take immediate safety precautions
📞 Contact emergency services if needed

Stay Safe! 🙏`;

    // Log notification details (replace with actual WhatsApp API calls)
    console.log('📤 WhatsApp message template:', whatsappMessage);
    console.log('👥 Sending to nearby users:', nearbyUsers);

    // Store notification log in Firestore
    await addDoc(collection(db, 'notificationLogs'), {
      reportId: sosReport.id,
      type: 'whatsapp_emergency',
      recipients: nearbyUsers,
      message: whatsappMessage,
      sentAt: serverTimestamp(),
      status: 'sent'
    });

    return {
      success: true,
      recipientCount: nearbyUsers.length,
      message: 'WhatsApp notifications sent successfully'
    };

  } catch (error) {
    console.error('❌ WhatsApp notification failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default app;
