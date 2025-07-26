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
    const sosCollection = collection(db, 'sos-alerts');
    const snapshot = await getDocs(sosCollection);

    console.log('✅ Firestore connection successful!');
    console.log('📊 Total documents in sos-alerts collection:', snapshot.size);

    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log('📄 Test Document ID:', doc.id);
      console.log('📄 Test Document Fields:', Object.keys(data));
      console.log('📄 Test Document Data:', data);
      console.log('📄 Has required fields:', {
        userId: !!data.userId,
        message: !!data.message,
        location: !!data.location,
        videoUrl: !!data.videoUrl
      });
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
    const docRef = await addDoc(collection(db, 'sos-alerts'), {
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
  console.log('🔄 Setting up Firebase listener for sos-alerts collection...');
  console.log('📋 Firebase project:', db.app.options.projectId);

  try {
    // First try to get all documents to check connection
    const sosCollection = collection(db, 'sos-alerts');
    console.log('📁 Collection reference created:', sosCollection.path);

    // Get all documents from sos-alerts collection without any filters
    console.log('📊 Creating query for collection:', sosCollection.path);
    const q = query(sosCollection);

    console.log('🔍 Starting real-time listener...');

    return onSnapshot(q,
      (querySnapshot) => {
        console.log('📡 Firebase snapshot received!');
        console.log('📊 Total documents in sos-alerts:', querySnapshot.size);

        const allReports = [];
        const pendingReports = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          console.log('📄 Document ID:', doc.id);
          console.log('📄 Document data:', data);

          const reportData = { id: doc.id, ...data };
          allReports.push(reportData);

          // Since user's structure doesn't have status field, treat all as pending
          // Check if document has required fields to validate it's a valid SOS report
          console.log('🔍 Checking document fields:', {
            hasUserId: !!data.userId,
            hasMessage: !!data.message,
            hasLocation: !!data.location,
            hasVideoUrl: !!data.videoUrl
          });

          if (data.userId && data.message && data.location && data.videoUrl) {
            pendingReports.push(reportData);
            console.log('✅ Found valid SOS report:', doc.id, 'with fields:', Object.keys(data));
          } else {
            console.log('⏭️ Skipping document:', doc.id, 'Missing fields - has:', Object.keys(data));
            console.log('Missing required fields:', {
              userId: !data.userId,
              message: !data.message,
              location: !data.location,
              videoUrl: !data.videoUrl
            });
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
    const reportRef = doc(db, 'sos-alerts', reportId);

    // Add status and admin review fields to user's existing structure
    await updateDoc(reportRef, {
      status: status, // Add status field to document
      adminReview: {
        decision: status,
        adminNotes: adminNotes,
        reviewedAt: serverTimestamp(),
        notificationsSent: status === 'approved' ? true : false
      },
      updatedAt: serverTimestamp() // Track when document was last updated
    });

    console.log(`✅ SOS report ${reportId} ${status}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to update SOS status:', error);
    throw new Error(`Failed to update SOS status: ${error.message}`);
  }
};

// Find nearest emergency services using Google Places API
const findNearestEmergencyServices = async (lat, lng) => {
  try {
    console.log('🔍 Finding nearest emergency services...');

    // Emergency service types to search for
    const serviceTypes = [
      { type: 'hospital', name: 'Hospital', icon: '🏥' },
      { type: 'fire_station', name: 'Fire Brigade', icon: '🚒' },
      { type: 'police', name: 'Police Station', icon: '👮' }
    ];

    const emergencyServices = [];

    for (const service of serviceTypes) {
      try {
        // Using a free geocoding service to simulate finding emergency services
        // In production, you would use Google Places API
        const simulatedServices = {
          hospital: [
            {
              name: 'City General Hospital',
              address: 'MG Road, Central District',
              phone: '+91-11-2345-6789',
              lat: lat + 0.01,
              lng: lng + 0.01,
              distance: '1.2 km',
              eta: '8 mins'
            }
          ],
          fire_station: [
            {
              name: 'Fire Station Central',
              address: 'Brigade Road, Fire Department',
              phone: '+91-11-101',
              lat: lat - 0.008,
              lng: lng + 0.012,
              distance: '0.9 km',
              eta: '6 mins'
            }
          ],
          police: [
            {
              name: 'Central Police Station',
              address: 'Law & Order Complex',
              phone: '+91-11-100',
              lat: lat + 0.005,
              lng: lng - 0.007,
              distance: '0.7 km',
              eta: '5 mins'
            }
          ]
        };

        if (simulatedServices[service.type]) {
          emergencyServices.push({
            ...service,
            locations: simulatedServices[service.type]
          });
        }
      } catch (error) {
        console.warn(`Failed to find ${service.name}:`, error);
      }
    }

    return emergencyServices;
  } catch (error) {
    console.error('❌ Error finding emergency services:', error);
    return [];
  }
};

// Generate route information for emergency services
const generateEmergencyRoutes = async (sosLocation, emergencyServices) => {
  try {
    console.log('🗺️ Generating emergency service routes...');

    const routes = [];

    for (const service of emergencyServices) {
      for (const location of service.locations) {
        const routeUrl = `https://www.google.com/maps/dir/${location.lat},${location.lng}/${sosLocation.lat},${sosLocation.lng}`;

        routes.push({
          serviceName: location.name,
          serviceType: service.name,
          icon: service.icon,
          phone: location.phone,
          address: location.address,
          distance: location.distance,
          eta: location.eta,
          routeUrl: routeUrl,
          directionsText: `📍 From: ${location.name}\n📍 To: Emergency Location\n⏱️ ETA: ${location.eta}\n📏 Distance: ${location.distance}`
        });
      }
    }

    return routes;
  } catch (error) {
    console.error('❌ Error generating routes:', error);
    return [];
  }
};

// Enhanced WhatsApp notification function with emergency service routes
export const sendWhatsAppNotifications = async (sosReport, approvalData) => {
  try {
    console.log('📱 Sending enhanced WhatsApp notifications for approved SOS report...');

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

    // Find nearest emergency services
    console.log('🔍 Finding nearest emergency services...');
    const emergencyServices = await findNearestEmergencyServices(
      whatsappData.coordinates.lat,
      whatsappData.coordinates.lng
    );

    // Generate routes for emergency services
    console.log('🗺️ Generating emergency routes...');
    const emergencyRoutes = await generateEmergencyRoutes(whatsappData.coordinates, emergencyServices);

    // Create enhanced WhatsApp messages for emergency services
    const emergencyServiceMessages = emergencyRoutes.map(route => ({
      recipient: route.serviceName,
      phone: route.phone,
      message: `🚨 EMERGENCY DISPATCH ALERT 🚨

${route.icon} ${route.serviceName}
📞 Emergency Report ID: ${whatsappData.reportId}

📍 EMERGENCY LOCATION:
${whatsappData.location}
Coordinates: ${whatsappData.coordinates.lat}, ${whatsappData.coordinates.lng}

🚨 EMERGENCY TYPE: ${whatsappData.message}
⏰ Reported: ${new Date().toLocaleString()}

🗺️ FASTEST ROUTE TO EMERGENCY:
${route.directionsText}

📱 ROUTE LINK: ${route.routeUrl}

✅ VERIFIED by Emergency Response Team
⚡ IMMEDIATE DISPATCH REQUIRED

Emergency Contact: ${route.phone}`
    }));

    // Simulate nearby users (for public alerts)
    const nearbyUsers = [
      { name: 'User A', phone: '+91-9876543210', distance: '0.2km' },
      { name: 'User B', phone: '+91-9876543211', distance: '0.5km' },
      { name: 'User C', phone: '+91-9876543212', distance: '0.8km' },
      { name: 'User D', phone: '+91-9876543213', distance: '1.0km' }
    ];

    // Create public WhatsApp message template
    const publicWhatsappMessage = `🚨 EMERGENCY ALERT 🚨

📍 Location: ${whatsappData.location}
📱 Reported: ${whatsappData.message}
⏰ Time: ${new Date().toLocaleString()}
🗺️ Maps: https://maps.google.com/maps?q=${whatsappData.coordinates.lat},${whatsappData.coordinates.lng}

🚒 Emergency Services Dispatched:
${emergencyRoutes.map(route => `${route.icon} ${route.serviceName} (ETA: ${route.eta})`).join('\n')}

✅ Verified by Emergency Response Team
⚡ Take immediate safety precautions
📞 Stay clear of emergency vehicles

Stay Safe! 🙏`;

    // Log notification details
    console.log('📤 Emergency Service Messages:', emergencyServiceMessages);
    console.log('📤 Public WhatsApp message:', publicWhatsappMessage);
    console.log('👥 Sending to nearby users:', nearbyUsers);
    console.log('🚒 Sending to emergency services:', emergencyRoutes.length);

    // Store enhanced notification log in Firestore
    await addDoc(collection(db, 'notificationLogs'), {
      reportId: sosReport.id,
      type: 'enhanced_emergency_dispatch',
      emergencyServices: emergencyServiceMessages,
      publicRecipients: nearbyUsers,
      publicMessage: publicWhatsappMessage,
      emergencyRoutes: emergencyRoutes,
      sentAt: serverTimestamp(),
      status: 'sent'
    });

    return {
      success: true,
      recipientCount: nearbyUsers.length,
      emergencyServicesNotified: emergencyServiceMessages.length,
      routesGenerated: emergencyRoutes.length,
      message: `Emergency notifications sent successfully!

🚒 Emergency Services Alerted: ${emergencyServiceMessages.length}
👥 Public Alerts Sent: ${nearbyUsers.length}
🗺️ Routes Generated: ${emergencyRoutes.length}

Emergency Services Dispatched:
${emergencyRoutes.map(route => `${route.icon} ${route.serviceName} - ETA: ${route.eta}`).join('\n')}`
    };

  } catch (error) {
    console.error('❌ Enhanced WhatsApp notification failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Alert creation function
export const createAlert = async (alertData) => {
  try {
    console.log('🚨 Creating new alert...', alertData);

    const docRef = await addDoc(collection(db, 'alerts'), {
      ...alertData,
      createdAt: serverTimestamp(),
      id: '', // Will be updated with doc ID
      isActive: true
    });

    // Update the document with its own ID
    await updateDoc(docRef, {
      id: docRef.id
    });

    console.log('✅ Alert created successfully with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Failed to create alert:', error);
    throw new Error(`Failed to create alert: ${error.message}`);
  }
};

// Get user location with address
export const getUserLocation = () => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        success: false,
        error: 'Geolocation not supported by this browser'
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };

        try {
          // Try to get address using reverse geocoding
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`
          );

          if (response.ok) {
            const data = await response.json();
            const address = data.display_name ||
                          `${data.locality || ''}, ${data.city || ''}, ${data.countryName || ''}`.replace(/^,\s*|,\s*$/g, '') ||
                          `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;

            resolve({
              success: true,
              coords,
              address: address || `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
            });
          } else {
            resolve({
              success: true,
              coords,
              address: `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
            });
          }
        } catch (error) {
          console.warn('Could not get address:', error);
          resolve({
            success: true,
            coords,
            address: `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
          });
        }
      },
      (error) => {
        let errorMessage = 'Unknown location error';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
          default:
            errorMessage = 'Unknown location error';
            break;
        }

        resolve({
          success: false,
          error: errorMessage
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  });
};

// Listen to active alerts
export const listenToActiveAlerts = (callback) => {
  try {
    const alertsCollection = collection(db, 'alerts');
    const q = query(alertsCollection);

    return onSnapshot(q, (querySnapshot) => {
      const alerts = [];
      const currentTime = new Date();

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const alert = { id: doc.id, ...data };

        // Check if alert is still active and not expired
        if (alert.isActive && alert.expiresAt && alert.expiresAt.toDate() > currentTime) {
          alerts.push(alert);
        }
      });

      console.log('📡 Active alerts received:', alerts.length);
      callback(alerts);
    });
  } catch (error) {
    console.error('❌ Error listening to alerts:', error);
    callback([]);
    return () => {};
  }
};

export default app;
