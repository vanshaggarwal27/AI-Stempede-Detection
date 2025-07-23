// free-notification-service.js - 100% Free Alternative to Azure
const admin = require('firebase-admin');
const twilio = require('twilio');

// Initialize Firebase (FREE)
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs"
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// Initialize Twilio (FREE trial)
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Send push notifications using Firebase (100% FREE)
 * @param {Array|string} fcmTokens - FCM registration tokens
 * @param {Object} notification - Notification payload
 * @returns {Promise<Object>} - Result object
 */
async function sendFreePushNotification(fcmTokens, notification) {
  try {
    const tokens = Array.isArray(fcmTokens) ? fcmTokens : [fcmTokens];
    
    const message = {
      notification: {
        title: notification.title || '🚨 Emergency Alert',
        body: notification.body || 'Emergency situation detected'
      },
      data: {
        type: 'sos_alert',
        timestamp: new Date().toISOString(),
        ...notification.data
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'emergency_alerts',
          sound: 'default',
          color: '#FF4444',
          icon: 'ic_emergency'
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body
            },
            sound: 'emergency.wav',
            badge: 1
          }
        }
      },
      tokens: tokens.slice(0, 500) // Firebase limit: 500 tokens per batch
    };

    const response = await admin.messaging().sendMulticast(message);
    
    console.log(`Push notifications sent: ${response.successCount}/${tokens.length}`);
    
    return {
      success: true,
      sentCount: response.successCount,
      failedCount: response.failureCount,
      responses: response.responses
    };

  } catch (error) {
    console.error('Firebase push notification error:', error);
    throw new Error(`Failed to send push notification: ${error.message}`);
  }
}

/**
 * Send WhatsApp message using Twilio FREE trial
 * @param {string} to - Phone number in E.164 format
 * @param {string} message - Message text
 * @returns {Promise<Object>} - Result object
 */
async function sendFreeWhatsAppAlert(to, message) {
  try {
    // For Twilio trial, you can only send to verified numbers
    const whatsappMessage = await twilioClient.messages.create({
      from: 'whatsapp:+14155238886', // Twilio Sandbox number (FREE)
      to: `whatsapp:${to}`,
      body: `🚨 EMERGENCY ALERT\n\n${message}\n\n⚠️ This is an automated emergency notification from StampedeGuard. Stay safe!`
    });

    console.log(`WhatsApp sent to ${to}: ${whatsappMessage.sid}`);
    
    return {
      success: true,
      messageId: whatsappMessage.sid,
      status: whatsappMessage.status,
      to: to
    };

  } catch (error) {
    console.error('WhatsApp sending error:', error);
    // For demo purposes, don't throw error
    return {
      success: false,
      error: error.message,
      to: to
    };
  }
}

/**
 * Send emergency alerts to nearby users (FREE services only)
 * @param {Object} sosReport - SOS report data
 * @param {Array} nearbyUsers - Users within radius
 * @returns {Promise<Object>} - Alert sending results
 */
async function sendFreeEmergencyAlerts(sosReport, nearbyUsers) {
  try {
    console.log(`Sending emergency alerts to ${nearbyUsers.length} nearby users (FREE services)`);
    
    // Prepare push notification tokens
    const fcmTokens = nearbyUsers
      .filter(user => user.fcmToken)
      .map(user => user.fcmToken);
    
    // Prepare WhatsApp numbers (only verified numbers for trial)
    const whatsappNumbers = nearbyUsers
      .filter(user => user.phone)
      .map(user => user.phone);

    const alertMessage = `Emergency reported at ${sosReport.incident.location.address}. 
Category: ${sosReport.metadata.category}
Message: ${sosReport.incident.message}
Stay alert and avoid the area if possible.`;

    const promises = [];

    // Send push notifications (FREE - unlimited)
    if (fcmTokens.length > 0) {
      promises.push(
        sendFreePushNotification(fcmTokens, {
          title: '🚨 Emergency Alert',
          body: `${sosReport.metadata.category} reported near your location`,
          data: {
            sosId: sosReport._id.toString(),
            latitude: sosReport.incident.location.latitude.toString(),
            longitude: sosReport.incident.location.longitude.toString(),
            category: sosReport.metadata.category
          }
        })
      );
    }

    // Send WhatsApp messages (FREE trial - limited to verified numbers)
    const whatsappPromises = whatsappNumbers.slice(0, 5).map(phone => // Limit to 5 for demo
      sendFreeWhatsAppAlert(phone, alertMessage)
    );
    
    promises.push(...whatsappPromises);

    const results = await Promise.allSettled(promises);
    
    const pushResult = results[0]?.value || { sentCount: 0, failedCount: 0 };
    const whatsappResults = results.slice(1) || [];
    
    const whatsappSuccess = whatsappResults.filter(r => r.value?.success).length;
    const whatsappFailed = whatsappResults.filter(r => !r.value?.success).length;

    return {
      success: true,
      totalRecipients: nearbyUsers.length,
      push: {
        sent: pushResult.sentCount || 0,
        failed: pushResult.failedCount || 0
      },
      whatsapp: {
        sent: whatsappSuccess,
        failed: whatsappFailed
      },
      message: `Alerts sent successfully using FREE services!`
    };

  } catch (error) {
    console.error('Emergency alert sending error:', error);
    throw new Error(`Failed to send emergency alerts: ${error.message}`);
  }
}

/**
 * Register device for push notifications (FREE)
 * @param {string} fcmToken - FCM registration token
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Registration result
 */
async function registerDeviceForFreeNotifications(fcmToken, userId) {
  try {
    // In a real app, you'd store this in your database
    // For now, just validate the token
    
    const message = {
      notification: {
        title: 'Registration Successful',
        body: 'You will now receive emergency alerts'
      },
      data: {
        type: 'registration_success',
        userId: userId
      },
      token: fcmToken
    };

    await admin.messaging().send(message);
    
    return {
      success: true,
      message: 'Device registered for emergency notifications',
      service: 'Firebase FCM (FREE)'
    };

  } catch (error) {
    console.error('Device registration error:', error);
    throw new Error(`Failed to register device: ${error.message}`);
  }
}

/**
 * Test all free notification services
 * @returns {Promise<Object>} - Test results
 */
async function testFreeNotificationServices() {
  const results = {
    firebase: { status: 'unknown', error: null },
    twilio: { status: 'unknown', error: null }
  };

  // Test Firebase
  try {
    const testMessage = {
      notification: {
        title: 'Test Notification',
        body: 'Firebase FCM is working'
      },
      topic: 'test-topic' // Use topic for testing (no specific device needed)
    };
    
    await admin.messaging().send(testMessage);
    results.firebase.status = 'connected';
    results.firebase.service = 'Firebase FCM (FREE)';
  } catch (error) {
    results.firebase.status = 'error';
    results.firebase.error = error.message;
  }

  // Test Twilio
  try {
    const account = await twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    results.twilio.status = account.status === 'active' ? 'connected' : 'inactive';
    results.twilio.service = 'Twilio WhatsApp (FREE trial)';
    results.twilio.balance = account.balance;
  } catch (error) {
    results.twilio.status = 'error';
    results.twilio.error = error.message;
  }

  return results;
}

module.exports = {
  sendFreePushNotification,
  sendFreeWhatsAppAlert,
  sendFreeEmergencyAlerts,
  registerDeviceForFreeNotifications,
  testFreeNotificationServices
};

// This service uses only FREE tier services - no credits required!
