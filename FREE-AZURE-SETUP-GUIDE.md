# 🆓 Free Azure & Services Setup Guide
## Zero Credits Required - Complete Emergency Alert System

### 📋 **What You'll Get (100% FREE)**
- Push notifications (unlimited)
- WhatsApp alerts (trial with $15 credit)
- Database storage (512MB)
- File storage for videos
- No ongoing costs for development

---

## 🔥 **Option 1: Firebase (Recommended - 100% FREE)**

### **Step 1: Create Firebase Project**
```bash
# 1. Go to: https://console.firebase.google.com/
# 2. Click "Add project"
# 3. Enter project name: "crowd-monitoring"
# 4. Disable Google Analytics (optional)
# 5. Click "Create project"
```

### **Step 2: Enable Services**
```bash
# In Firebase Console:
# 1. Go to "Cloud Messaging" → Enable
# 2. Go to "Storage" → Get started
# 3. Go to "Firestore Database" → Create database
# 4. Go to "Project Settings" → Service accounts
# 5. Click "Generate new private key" → Download JSON
```

### **Step 3: Get Configuration**
```javascript
// Firebase config (copy from Project Settings → General)
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "crowd-monitoring.firebaseapp.com",
  projectId: "crowd-monitoring",
  storageBucket: "crowd-monitoring.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### **Step 4: Environment Variables**
```env
# .env file - Firebase (FREE)
FIREBASE_PROJECT_ID=crowd-monitoring
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Key-Here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@crowd-monitoring.iam.gserviceaccount.com
FIREBASE_API_KEY=your-web-api-key
```

---

## 🟦 **Option 2: Azure Free Tier**

### **Step 1: Create Azure Free Account**
```bash
# 1. Go to: https://azure.microsoft.com/free/
# 2. Click "Start free"
# 3. Use personal email (no credit card for free services)
# 4. Verify identity
# 5. Get $200 credit + always free services
```

### **Step 2: Create Notification Hub (FREE Tier)**
```bash
# Install Azure CLI
# Windows: https://aka.ms/installazurecliwindows
# macOS: brew install azure-cli
# Linux: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login to Azure
az login

# Create resource group
az group create \
  --name crowd-monitoring-rg \
  --location eastus

# Create notification hub namespace (FREE tier)
az notification-hub namespace create \
  --resource-group crowd-monitoring-rg \
  --name crowd-monitoring-ns \
  --location eastus \
  --sku Free

# Create notification hub
az notification-hub create \
  --resource-group crowd-monitoring-rg \
  --namespace-name crowd-monitoring-ns \
  --name sos-alerts-hub

# Get connection string
az notification-hub authorization-rule list \
  --resource-group crowd-monitoring-rg \
  --namespace-name crowd-monitoring-ns \
  --notification-hub-name sos-alerts-hub \
  --query "[?name=='DefaultFullSharedAccessSignature'].primaryConnectionString" \
  --output tsv
```

### **Step 3: Azure Environment Variables**
```env
# .env file - Azure (FREE tier)
AZURE_NOTIFICATION_HUB_CONNECTION_STRING=Endpoint=sb://crowd-monitoring-ns.servicebus.windows.net/;SharedAccessKeyName=DefaultFullSharedAccessSignature;SharedAccessKey=your-key
AZURE_NOTIFICATION_HUB_NAME=sos-alerts-hub
```

---

## 📱 **Twilio WhatsApp Setup (FREE Trial)**

### **Step 1: Create Twilio Account**
```bash
# 1. Go to: https://www.twilio.com/try-twilio
# 2. Sign up (FREE trial with $15 credit)
# 3. Verify phone number
# 4. Complete account setup
```

### **Step 2: WhatsApp Sandbox**
```bash
# In Twilio Console:
# 1. Go to Messaging → Try it out → Send a WhatsApp message
# 2. Note your sandbox number: +1 415 523 8886
# 3. Send "join <sandbox-code>" to activate
# 4. Test by sending yourself a message
```

### **Step 3: Get Credentials**
```bash
# From Twilio Console → Settings → General:
Account SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Auth Token: your_auth_token_here
WhatsApp Number: whatsapp:+14155238886
```

### **Step 4: Twilio Environment Variables**
```env
# .env file - Twilio (FREE trial)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

---

## 🗄️ **Database Setup (FREE)**

### **Option A: MongoDB Atlas (Recommended)**
```bash
# 1. Go to: https://www.mongodb.com/cloud/atlas/register
# 2. Create account
# 3. Create FREE cluster (M0 Sandbox - 512MB)
# 4. Create database user
# 5. Whitelist IP (0.0.0.0/0 for development)
# 6. Get connection string
```

```env
# MongoDB Atlas (FREE 512MB)
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/crowd-monitoring?retryWrites=true&w=majority
```

### **Option B: Local MongoDB**
```bash
# Install MongoDB locally (FREE)
# Windows: https://www.mongodb.com/try/download/community
# macOS: brew install mongodb-community
# Ubuntu: sudo apt install mongodb

# Start MongoDB
mongod

# Connection string
MONGODB_URI=mongodb://localhost:27017/crowd-monitoring
```

---

## 🚀 **Complete Integration Example**

### **Update your backend to use FREE services:**

```javascript
// Replace in your backend-sos-routes.js
const { sendFreeEmergencyAlerts } = require('./free-notification-service');

// In your SOS approval endpoint:
if (decision === 'approved') {
  try {
    // Find nearby users within 1km
    const nearbyUsers = await User.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [sosReport.incident.location.longitude, sosReport.incident.location.latitude]
          },
          $maxDistance: 1000 // 1km radius
        }
      },
      isActive: true
    });

    // Send FREE emergency alerts
    const alertResult = await sendFreeEmergencyAlerts(sosReport, nearbyUsers);
    
    console.log(`Emergency alerts sent to ${alertResult.totalRecipients} users`);
    console.log(`Push notifications: ${alertResult.push.sent} sent, ${alertResult.push.failed} failed`);
    console.log(`WhatsApp messages: ${alertResult.whatsapp.sent} sent, ${alertResult.whatsapp.failed} failed`);
    
    res.json({
      success: true,
      message: 'SOS report approved and alerts sent',
      alertSent: {
        recipientCount: alertResult.totalRecipients,
        pushSent: alertResult.push.sent,
        whatsappSent: alertResult.whatsapp.sent
      }
    });
    
  } catch (error) {
    console.error('Alert sending error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send alerts'
    });
  }
}
```

---

## 📊 **Cost Breakdown (FREE Tiers)**

| Service | Free Tier | Monthly Limit | Cost After |
|---------|-----------|---------------|------------|
| Firebase FCM | ✅ FREE | Unlimited | Always FREE |
| Firebase Storage | ✅ FREE | 1GB | $0.026/GB |
| Firebase Firestore | ✅ FREE | 50k reads/day | $0.06/100k |
| MongoDB Atlas | ✅ FREE | 512MB | $9/month |
| Twilio WhatsApp | $15 trial | ~300 messages | $0.05/message |
| Azure Notification Hub | ✅ FREE | 1M notifications | $1/month |

**Total monthly cost for development: $0** ✨

---

## 🧪 **Testing Your Setup**

### **Test Firebase**
```javascript
// test-firebase.js
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function testFirebase() {
  try {
    const message = {
      notification: {
        title: 'Test from StampedeGuard',
        body: 'Firebase is working!'
      },
      topic: 'test'
    };
    
    const response = await admin.messaging().send(message);
    console.log('✅ Firebase test successful:', response);
  } catch (error) {
    console.error('❌ Firebase test failed:', error);
  }
}

testFirebase();
```

### **Test Twilio**
```javascript
// test-twilio.js
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function testTwilio() {
  try {
    const message = await client.messages.create({
      from: 'whatsapp:+14155238886',
      to: 'whatsapp:+your_verified_number',
      body: '🚨 Test alert from StampedeGuard - Twilio is working!'
    });
    
    console.log('✅ Twilio test successful:', message.sid);
  } catch (error) {
    console.error('❌ Twilio test failed:', error);
  }
}

testTwilio();
```

---

## ⚡ **Quick Start Commands**

```bash
# 1. Install dependencies
npm install firebase-admin twilio mongoose

# 2. Set environment variables
cp .env.example .env
# Edit .env with your free service credentials

# 3. Test services
node test-firebase.js
node test-twilio.js

# 4. Start your application
npm start
```

---

## 🎯 **What You Get**

✅ **Push Notifications**: Unlimited via Firebase FCM  
✅ **WhatsApp Alerts**: 300+ messages via Twilio trial  
✅ **Database Storage**: 512MB via MongoDB Atlas  
✅ **File Storage**: 1GB via Firebase Storage  
✅ **Real-time Updates**: Via Firebase Firestore  
✅ **No Monthly Costs**: For development usage  

**Perfect for hackathons, MVPs, and testing! 🚀**

---

## 📞 **Support**

If you need help setting up any of these services:
1. Firebase: https://firebase.google.com/docs
2. Twilio: https://www.twilio.com/docs
3. MongoDB Atlas: https://docs.atlas.mongodb.com
4. Azure: https://docs.microsoft.com/azure

All services have excellent free documentation and support!
