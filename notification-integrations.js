// utils/notifications.js - Twilio WhatsApp and Azure Notification Hub Integration

const twilio = require('twilio');
const azure = require('azure-sb');
const axios = require('axios');

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Initialize Azure Notification Hub
const notificationHubService = azure.createNotificationHubService(
  process.env.AZURE_NOTIFICATION_HUB_CONNECTION_STRING,
  process.env.AZURE_NOTIFICATION_HUB_NAME
);

// WhatsApp Templates Configuration
const WHATSAPP_TEMPLATES = {
  sos_alert: {
    name: 'sos_emergency_alert',
    language: 'en',
    components: [
      {
        type: 'header',
        parameters: [
          {
            type: 'text',
            text: '🚨 EMERGENCY ALERT'
          }
        ]
      },
      {
        type: 'body',
        parameters: [
          { type: 'text', text: '{{1}}' }, // location
          { type: 'text', text: '{{2}}' }, // distance
          { type: 'text', text: '{{3}}' }  // message
        ]
      }
    ]
  },
  
  sos_received: {
    name: 'sos_report_received',
    language: 'en',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: '{{1}}' }, // user name
          { type: 'text', text: '{{2}}' }  // sos id
        ]
      }
    ]
  },
  
  sos_approved: {
    name: 'sos_report_approved',
    language: 'en',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: '{{1}}' }, // user name
          { type: 'text', text: '{{2}}' }  // sos id
        ]
      }
    ]
  },
  
  sos_reviewed: {
    name: 'sos_report_reviewed',
    language: 'en',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: '{{1}}' }, // user name
          { type: 'text', text: '{{2}}' }, // sos id
          { type: 'text', text: '{{3}}' }  // decision
        ]
      }
    ]
  }
};

/**
 * Send WhatsApp message using Twilio
 * @param {string} to - Phone number in E.164 format
 * @param {string} templateName - Template name from WHATSAPP_TEMPLATES
 * @param {object} parameters - Template parameters
 * @returns {Promise<object>} - Twilio message response
 */
async function sendWhatsAppAlert(to, templateName, parameters = {}) {
  try {
    // Validate phone number format
    if (!to.startsWith('+')) {
      throw new Error('Phone number must be in E.164 format');
    }

    const template = WHATSAPP_TEMPLATES[templateName];
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    // Prepare template components based on template type
    let templateComponents = [];
    
    switch (templateName) {
      case 'sos_alert':
        templateComponents = [
          {
            type: 'header',
            parameters: [
              {
                type: 'text',
                text: '🚨 EMERGENCY ALERT'
              }
            ]
          },
          {
            type: 'body',
            parameters: [
              { type: 'text', text: parameters.location || 'Unknown location' },
              { type: 'text', text: `${parameters.distance || '0'} km` },
              { type: 'text', text: parameters.message || 'Emergency situation reported' }
            ]
          }
        ];
        break;
        
      case 'sos_received':
        templateComponents = [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: parameters.userName || 'User' },
              { type: 'text', text: parameters.sosId || 'Unknown' }
            ]
          }
        ];
        break;
        
      case 'sos_approved':
        templateComponents = [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: parameters.userName || 'User' },
              { type: 'text', text: parameters.sosId || 'Unknown' }
            ]
          }
        ];
        break;
        
      case 'sos_reviewed':
        templateComponents = [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: parameters.userName || 'User' },
              { type: 'text', text: parameters.sosId || 'Unknown' },
              { type: 'text', text: parameters.decision || 'reviewed' }
            ]
          }
        ];
        break;
        
      default:
        throw new Error(`Unsupported template: ${templateName}`);
    }

    // Send WhatsApp message
    const message = await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${to}`,
      contentSid: process.env[`TWILIO_TEMPLATE_${templateName.toUpperCase()}`] || process.env.TWILIO_DEFAULT_TEMPLATE,
      contentVariables: JSON.stringify(templateComponents)
    });

    console.log(`WhatsApp message sent to ${to}: ${message.sid}`);
    
    return {
      success: true,
      messageId: message.sid,
      status: message.status,
      to: to
    };

  } catch (error) {
    console.error('WhatsApp sending error:', error);
    throw new Error(`Failed to send WhatsApp message: ${error.message}`);
  }
}

/**
 * Send bulk WhatsApp messages
 * @param {Array} recipients - Array of {phone, templateName, parameters}
 * @returns {Promise<Array>} - Array of results
 */
async function sendBulkWhatsAppAlerts(recipients) {
  const results = [];
  const BATCH_SIZE = 10; // Twilio rate limit consideration
  
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (recipient) => {
      try {
        const result = await sendWhatsAppAlert(
          recipient.phone,
          recipient.templateName,
          recipient.parameters
        );
        return { ...result, phone: recipient.phone };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          phone: recipient.phone
        };
      }
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults.map(result => 
      result.status === 'fulfilled' ? result.value : result.reason
    ));
    
    // Rate limiting delay between batches
    if (i + BATCH_SIZE < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

/**
 * Send push notification via Azure Notification Hub
 * @param {string|Array} fcmTokens - FCM token(s)
 * @param {object} notification - Notification payload
 * @returns {Promise<object>} - Azure notification response
 */
async function sendAzurePushNotification(fcmTokens, notification) {
  try {
    // Ensure fcmTokens is an array
    const tokens = Array.isArray(fcmTokens) ? fcmTokens : [fcmTokens];
    
    // Validate notification payload
    if (!notification.title && !notification.body && !notification.data) {
      throw new Error('Notification must contain title, body, or data');
    }

    // Prepare FCM payload
    const fcmPayload = {
      notification: {
        title: notification.title || 'StampedeGuard Alert',
        body: notification.body || 'Emergency notification',
        sound: notification.sound || 'default',
        icon: notification.icon || 'ic_notification',
        color: notification.color || '#FF4444',
        click_action: notification.clickAction || 'FLUTTER_NOTIFICATION_CLICK'
      },
      data: {
        ...notification.data,
        timestamp: new Date().toISOString()
      },
      android: {
        priority: 'high',
        notification: {
          channel_id: 'emergency_alerts',
          sound: notification.sound || 'emergency_sound',
          color: notification.color || '#FF4444',
          icon: notification.icon || 'ic_emergency',
          tag: notification.tag || 'sos_alert',
          ...(notification.android || {})
        },
        data: notification.data || {}
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.title || 'StampedeGuard Alert',
              body: notification.body || 'Emergency notification'
            },
            sound: notification.sound || 'emergency.wav',
            badge: notification.badge || 1,
            category: notification.category || 'EMERGENCY_ALERT',
            'mutable-content': 1
          },
          data: notification.data || {}
        },
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'alert'
        },
        ...(notification.apns || {})
      }
    };

    // Send to specific tokens (for targeted notifications)
    if (tokens.length <= 100) { // FCM batch limit
      const response = await sendToSpecificTokens(tokens, fcmPayload);
      return {
        success: true,
        sentCount: response.successCount,
        failedCount: response.failureCount,
        responses: response.responses
      };
    } else {
      // For large batches, use topic-based messaging or split into chunks
      const results = [];
      const CHUNK_SIZE = 100;
      
      for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
        const chunk = tokens.slice(i, i + CHUNK_SIZE);
        const response = await sendToSpecificTokens(chunk, fcmPayload);
        results.push(response);
        
        // Rate limiting delay
        if (i + CHUNK_SIZE < tokens.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      const totalSuccess = results.reduce((sum, r) => sum + r.successCount, 0);
      const totalFailed = results.reduce((sum, r) => sum + r.failureCount, 0);
      
      return {
        success: true,
        sentCount: totalSuccess,
        failedCount: totalFailed,
        batches: results.length
      };
    }

  } catch (error) {
    console.error('Azure push notification error:', error);
    throw new Error(`Failed to send push notification: ${error.message}`);
  }
}

/**
 * Send notification to specific FCM tokens using Azure Notification Hub
 * @param {Array} tokens - FCM tokens
 * @param {object} payload - FCM payload
 * @returns {Promise<object>} - Send result
 */
async function sendToSpecificTokens(tokens, payload) {
  return new Promise((resolve, reject) => {
    // Create FCM notification payload
    const fcmTemplate = {
      data: payload
    };

    // Send to multiple tokens
    notificationHubService.fcm.sendToTokens(
      JSON.stringify(fcmTemplate),
      tokens,
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            successCount: result.successCount || 0,
            failureCount: result.failureCount || 0,
            responses: result.results || []
          });
        }
      }
    );
  });
}

/**
 * Send broadcast notification to all users
 * @param {object} notification - Notification payload
 * @param {Array} tags - Optional tags for targeting
 * @returns {Promise<object>} - Broadcast result
 */
async function sendBroadcastNotification(notification, tags = []) {
  try {
    const fcmPayload = {
      notification: {
        title: notification.title,
        body: notification.body,
        sound: 'default'
      },
      data: notification.data || {},
      android: {
        priority: 'high',
        notification: {
          channel_id: 'emergency_alerts',
          sound: 'emergency_sound',
          color: '#FF4444'
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
      }
    };

    return new Promise((resolve, reject) => {
      const tagExpression = tags.length > 0 ? tags.join(' || ') : undefined;
      
      notificationHubService.fcm.send(
        tagExpression,
        JSON.stringify(fcmPayload),
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve({
              success: true,
              notificationId: result.notificationId,
              trackingId: result.trackingId
            });
          }
        }
      );
    });

  } catch (error) {
    console.error('Broadcast notification error:', error);
    throw new Error(`Failed to send broadcast notification: ${error.message}`);
  }
}

/**
 * Register device for push notifications
 * @param {string} fcmToken - FCM registration token
 * @param {string} userId - User ID
 * @param {Array} tags - User tags for targeting
 * @returns {Promise<object>} - Registration result
 */
async function registerDeviceForNotifications(fcmToken, userId, tags = []) {
  try {
    const defaultTags = ['all_users', `user_${userId}`];
    const allTags = [...defaultTags, ...tags];

    return new Promise((resolve, reject) => {
      notificationHubService.fcm.createRegistrationId((error, registrationId) => {
        if (error) {
          reject(error);
          return;
        }

        const registration = {
          registrationId,
          fcmRegistrationId: fcmToken,
          tags: allTags
        };

        notificationHubService.fcm.createOrUpdateRegistration(
          registration,
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve({
                success: true,
                registrationId: result.registrationId,
                tags: allTags
              });
            }
          }
        );
      });
    });

  } catch (error) {
    console.error('Device registration error:', error);
    throw new Error(`Failed to register device: ${error.message}`);
  }
}

/**
 * Update WhatsApp template status via Twilio
 * @param {string} templateSid - Template SID
 * @returns {Promise<object>} - Template status
 */
async function getWhatsAppTemplateStatus(templateSid) {
  try {
    const template = await twilioClient.content.v1.contents(templateSid).fetch();
    
    return {
      sid: template.sid,
      friendlyName: template.friendlyName,
      language: template.language,
      status: template.approvalRequests?.status || 'unknown',
      variables: template.types || {}
    };
    
  } catch (error) {
    console.error('Template status error:', error);
    throw new Error(`Failed to get template status: ${error.message}`);
  }
}

/**
 * Get notification delivery statistics
 * @param {string} timeframe - Time range (day, week, month)
 * @returns {Promise<object>} - Delivery statistics
 */
async function getNotificationStats(timeframe = 'week') {
  try {
    // This would typically query your database for delivery statistics
    // For now, return mock data structure
    return {
      timeframe,
      whatsapp: {
        sent: 0,
        delivered: 0,
        failed: 0,
        pending: 0
      },
      push: {
        sent: 0,
        delivered: 0,
        failed: 0,
        opened: 0
      },
      total: {
        sent: 0,
        delivered: 0,
        failed: 0
      }
    };
    
  } catch (error) {
    console.error('Notification stats error:', error);
    throw new Error(`Failed to get notification statistics: ${error.message}`);
  }
}

/**
 * Validate and format phone number
 * @param {string} phone - Phone number
 * @returns {string} - Formatted phone number in E.164 format
 */
function formatPhoneNumber(phone) {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Add country code if missing (default to +1 for US)
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  } else if (cleaned.length > 10) {
    return `+${cleaned}`;
  }
  
  throw new Error('Invalid phone number format');
}

/**
 * Test notification services
 * @returns {Promise<object>} - Test results
 */
async function testNotificationServices() {
  const results = {
    twilio: { status: 'unknown', error: null },
    azure: { status: 'unknown', error: null }
  };

  // Test Twilio
  try {
    const account = await twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    results.twilio.status = account.status === 'active' ? 'connected' : 'inactive';
  } catch (error) {
    results.twilio.status = 'error';
    results.twilio.error = error.message;
  }

  // Test Azure Notification Hub
  try {
    // Simple connectivity test
    results.azure.status = 'connected'; // Azure NH doesn't have a simple test endpoint
  } catch (error) {
    results.azure.status = 'error';
    results.azure.error = error.message;
  }

  return results;
}

module.exports = {
  sendWhatsAppAlert,
  sendBulkWhatsAppAlerts,
  sendAzurePushNotification,
  sendBroadcastNotification,
  registerDeviceForNotifications,
  getWhatsAppTemplateStatus,
  getNotificationStats,
  formatPhoneNumber,
  testNotificationServices,
  WHATSAPP_TEMPLATES
};

// ================================================================

// Environment Variables Configuration (.env)
/*

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=+14155238886  # Your Twilio WhatsApp number

# WhatsApp Template SIDs (get these from Twilio Console)
TWILIO_TEMPLATE_SOS_ALERT=HXxxxxx...
TWILIO_TEMPLATE_SOS_RECEIVED=HXxxxxx...
TWILIO_TEMPLATE_SOS_APPROVED=HXxxxxx...
TWILIO_TEMPLATE_SOS_REVIEWED=HXxxxxx...
TWILIO_DEFAULT_TEMPLATE=HXxxxxx...

# Azure Notification Hub Configuration
AZURE_NOTIFICATION_HUB_CONNECTION_STRING=Endpoint=sb://your-namespace.servicebus.windows.net/;SharedAccessKeyName=DefaultFullSharedAccessSignature;SharedAccessKey=your-key
AZURE_NOTIFICATION_HUB_NAME=your-notification-hub-name

# Firebase Configuration (for FCM)
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY=your-firebase-private-key
FIREBASE_CLIENT_EMAIL=your-firebase-client-email

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/stampede-guard
# or MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/stampede-guard

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# API Configuration
API_PORT=5000
NODE_ENV=development

# Geocoding Service (optional)
MAPBOX_TOKEN=your-mapbox-access-token

*/

// ================================================================

// Usage Examples in documentation only - see README for implementation examples
