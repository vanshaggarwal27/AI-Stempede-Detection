// models/SOSReport.js - SOS Report Schema
const mongoose = require('mongoose');

const sosReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  userInfo: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true }
  },
  
  incident: {
    videoUrl: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^https?:\/\/.+/.test(v);
        },
        message: 'Video URL must be a valid HTTP/HTTPS URL'
      }
    },
    
    videoThumbnail: {
      type: String,
      default: ''
    },
    
    videoDuration: {
      type: Number,
      min: 1,
      max: 30,
      default: 15
    },
    
    message: {
      type: String,
      required: true,
      maxlength: 500,
      trim: true
    },
    
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        validate: {
          validator: function(v) {
            return v.length === 2 && 
                   v[0] >= -180 && v[0] <= 180 && // longitude
                   v[1] >= -90 && v[1] <= 90;     // latitude
          },
          message: 'Coordinates must be [longitude, latitude] with valid ranges'
        }
      },
      latitude: {
        type: Number,
        required: true,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        required: true,
        min: -180,
        max: 180
      },
      address: {
        type: String,
        default: ''
      },
      accuracy: {
        type: Number,
        default: 0
      }
    },
    
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    
    deviceInfo: {
      platform: { type: String, enum: ['ios', 'android', 'web'], default: 'android' },
      version: { type: String, default: '' },
      model: { type: String, default: '' }
    }
  },
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  
  adminReview: {
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    decision: {
      type: String,
      enum: ['approved', 'rejected'],
      default: null
    },
    adminNotes: {
      type: String,
      maxlength: 1000,
      default: ''
    }
  },
  
  alertSent: {
    isSent: {
      type: Boolean,
      default: false
    },
    sentAt: {
      type: Date,
      default: null
    },
    recipientCount: {
      type: Number,
      default: 0
    },
    alertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Alert',
      default: null
    },
    error: {
      type: String,
      default: null
    }
  },
  
  metadata: {
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      index: true
    },
    category: {
      type: String,
      enum: ['stampede', 'fire', 'violence', 'medical', 'other'],
      default: 'other',
      index: true
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
sosReportSchema.index({ 'incident.location': '2dsphere' });
sosReportSchema.index({ status: 1, 'incident.timestamp': -1 });
sosReportSchema.index({ userId: 1, 'incident.timestamp': -1 });
sosReportSchema.index({ 'metadata.priority': 1, 'incident.timestamp': -1 });
sosReportSchema.index({ 'metadata.category': 1, 'incident.timestamp': -1 });

// Virtual for time since creation
sosReportSchema.virtual('timeSinceCreation').get(function() {
  return Date.now() - this.incident.timestamp.getTime();
});

// Static method to find nearby reports
sosReportSchema.statics.findNearby = function(longitude, latitude, maxDistance = 5000) {
  return this.find({
    'incident.location': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance
      }
    }
  });
};

module.exports = mongoose.model('SOSReport', sosReportSchema);

// ================================================================

// models/User.js - User Schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Invalid email format'
    }
  },
  
  phone: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^\+[1-9]\d{1,14}$/.test(v); // E.164 format
      },
      message: 'Phone number must be in E.164 format (+1234567890)'
    }
  },
  
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  
  fcmToken: {
    type: String,
    default: null,
    index: true
  },
  
  preferences: {
    enableSOSAlerts: {
      type: Boolean,
      default: true
    },
    alertRadius: {
      type: Number,
      default: 1000, // meters
      min: 100,
      max: 5000
    },
    enableWhatsApp: {
      type: Boolean,
      default: true
    },
    enablePushNotifications: {
      type: Boolean,
      default: true
    }
  },
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  lastSeen: {
    type: Date,
    default: Date.now
  },
  
  sosReportsCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ location: '2dsphere' });
userSchema.index({ fcmToken: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ isActive: 1, lastSeen: -1 });

// Static method to find users in radius
userSchema.statics.findInRadius = function(longitude, latitude, radius = 1000) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: radius
      }
    },
    isActive: true,
    'preferences.enableSOSAlerts': true
  });
};

// Update location method
userSchema.methods.updateLocation = function(longitude, latitude) {
  this.location.coordinates = [longitude, latitude];
  this.location.lastUpdated = new Date();
  return this.save();
};

const User = mongoose.model('User', userSchema);

// ================================================================

// models/Alert.js - Alert Schema
const alertSchema = new mongoose.Schema({
  sosReportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SOSReport',
    required: true,
    index: true
  },
  
  type: {
    type: String,
    enum: ['sos_alert', 'system_alert', 'test_alert'],
    default: 'sos_alert',
    index: true
  },
  
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  
  recipients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  deliveryStats: {
    whatsappSent: { type: Number, default: 0 },
    whatsappDelivered: { type: Number, default: 0 },
    whatsappFailed: { type: Number, default: 0 },
    pushSent: { type: Number, default: 0 },
    pushDelivered: { type: Number, default: 0 },
    pushFailed: { type: Number, default: 0 }
  },
  
  status: {
    type: String,
    enum: ['pending', 'sending', 'sent', 'failed'],
    default: 'pending',
    index: true
  },
  
  sentAt: {
    type: Date,
    default: Date.now
  },
  
  error: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
alertSchema.index({ location: '2dsphere' });
alertSchema.index({ sentAt: -1 });
alertSchema.index({ type: 1, status: 1 });

const Alert = mongoose.model('Alert', alertSchema);

// ================================================================

// models/Admin.js - Admin Schema
const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  
  role: {
    type: String,
    enum: ['admin', 'super_admin', 'moderator'],
    default: 'admin'
  },
  
  permissions: {
    canReviewSOS: { type: Boolean, default: true },
    canSendAlerts: { type: Boolean, default: true },
    canViewStats: { type: Boolean, default: true },
    canManageUsers: { type: Boolean, default: false },
    canManageAdmins: { type: Boolean, default: false }
  },
  
  statistics: {
    sosReviewsCount: { type: Number, default: 0 },
    alertsSentCount: { type: Number, default: 0 },
    lastReviewAt: { type: Date, default: null }
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

adminSchema.index({ email: 1 });
adminSchema.index({ role: 1, isActive: 1 });

const Admin = mongoose.model('Admin', adminSchema);

// ================================================================

// Database Connection and Setup
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Create initial indexes if they don't exist
    await Promise.all([
      SOSReport.createIndexes(),
      User.createIndexes(),
      Alert.createIndexes(),
      Admin.createIndexes()
    ]);
    
    console.log('Database indexes created successfully');
    
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Export all models and connection function
module.exports = {
  SOSReport,
  User,
  Alert,
  Admin,
  connectDB
};

// ================================================================

// utils/index.js - Utility Functions

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

// Authentication middleware
const authenticateUser = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    // Verify JWT token (implement your JWT verification logic)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token or user not found.' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Invalid token.' 
    });
  }
};

const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id);
    
    if (!admin || !admin.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token or admin not found.' 
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Invalid token.' 
    });
  }
};

module.exports = {
  calculateDistance,
  authenticateUser,
  authenticateAdmin
};
