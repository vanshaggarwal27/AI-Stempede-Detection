// routes/sos.js - Express routes for SOS functionality
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const admin = require('firebase-admin');
const axios = require('axios');
const { body, validationResult, query } = require('express-validator');

// Import models (schemas defined below)
const SOSReport = require('../models/SOSReport');
const User = require('../models/User');
const Alert = require('../models/Alert');

// Import utilities
const { 
  calculateDistance, 
  sendWhatsAppAlert, 
  sendAzurePushNotification,
  authenticateUser,
  authenticateAdmin 
} = require('../utils');

// Middleware for input validation
const validateSOSReport = [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('videoUrl').isURL().withMessage('Valid video URL is required'),
  body('location.latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
  body('location.longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
  body('message').optional().isLength({ max: 500 }).withMessage('Message too long'),
];

// POST /api/sos/report - Submit new SOS report
router.post('/report', authenticateUser, validateSOSReport, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      userId,
      videoUrl,
      videoThumbnail,
      videoDuration,
      location,
      message,
      deviceInfo
    } = req.body;

    // Get user information
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get address from coordinates (using a geocoding service)
    let address = '';
    try {
      const geocodeResponse = await axios.get(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${location.longitude},${location.latitude}.json?access_token=${process.env.MAPBOX_TOKEN}`
      );
      
      if (geocodeResponse.data.features && geocodeResponse.data.features.length > 0) {
        address = geocodeResponse.data.features[0].place_name;
      }
    } catch (geocodeError) {
      console.error('Geocoding error:', geocodeError);
      address = `Lat: ${location.latitude}, Lng: ${location.longitude}`;
    }

    // Create SOS report
    const sosReport = new SOSReport({
      userId,
      userInfo: {
        name: user.name,
        phone: user.phone,
        email: user.email
      },
      incident: {
        videoUrl,
        videoThumbnail: videoThumbnail || '',
        videoDuration: videoDuration || 15,
        message: message || 'Emergency situation reported',
        location: {
          type: 'Point',
          coordinates: [location.longitude, location.latitude],
          latitude: location.latitude,
          longitude: location.longitude,
          address,
          accuracy: location.accuracy || 0
        },
        timestamp: new Date(),
        deviceInfo: deviceInfo || {}
      },
      status: 'pending',
      metadata: {
        priority: determinePriority(message),
        category: categorizeIncident(message)
      }
    });

    await sosReport.save();

    // Log the incident
    console.log(`New SOS report submitted: ${sosReport._id} by user ${userId}`);

    // Send auto-response to user (optional)
    if (user.phone) {
      try {
        await sendWhatsAppAlert(user.phone, 'sos_received', {
          userName: user.name,
          sosId: sosReport._id.toString()
        });
      } catch (whatsappError) {
        console.error('WhatsApp auto-response error:', whatsappError);
      }
    }

    res.status(201).json({
      success: true,
      sosId: sosReport._id,
      message: 'SOS report submitted successfully',
      estimatedReviewTime: '5-10 minutes'
    });

  } catch (error) {
    console.error('SOS submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/sos/pending - Get pending SOS reports for admin
router.get('/pending', authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const reports = await SOSReport.find({ status: 'pending' })
      .sort({ 'incident.timestamp': -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalCount = await SOSReport.countDocuments({ status: 'pending' });

    res.json({
      success: true,
      reports,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalReports: totalCount,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get pending SOS reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending reports'
    });
  }
});

// GET /api/sos/all - Get all SOS reports with filters
router.get('/all', authenticateAdmin, async (req, res) => {
  try {
    const {
      status,
      startDate,
      endDate,
      priority,
      category,
      page = 1,
      limit = 20
    } = req.query;

    // Build filter query
    const filter = {};
    
    if (status) filter.status = status;
    if (priority) filter['metadata.priority'] = priority;
    if (category) filter['metadata.category'] = category;
    
    if (startDate || endDate) {
      filter['incident.timestamp'] = {};
      if (startDate) filter['incident.timestamp'].$gte = new Date(startDate);
      if (endDate) filter['incident.timestamp'].$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reports = await SOSReport.find(filter)
      .sort({ 'incident.timestamp': -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalCount = await SOSReport.countDocuments(filter);

    res.json({
      success: true,
      reports,
      filters: { status, startDate, endDate, priority, category },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalReports: totalCount
      }
    });

  } catch (error) {
    console.error('Get all SOS reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports'
    });
  }
});

// PUT /api/sos/:sosId/review - Admin review SOS report
router.put('/:sosId/review', authenticateAdmin, [
  body('decision').isIn(['approved', 'rejected']).withMessage('Decision must be approved or rejected'),
  body('adminNotes').optional().isLength({ max: 1000 }).withMessage('Admin notes too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { sosId } = req.params;
    const { decision, adminNotes } = req.body;
    const adminId = req.admin.id; // From authentication middleware

    // Find the SOS report
    const sosReport = await SOSReport.findById(sosId);
    if (!sosReport) {
      return res.status(404).json({
        success: false,
        message: 'SOS report not found'
      });
    }

    if (sosReport.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'SOS report has already been reviewed'
      });
    }

    // Update report with admin review
    sosReport.status = decision;
    sosReport.adminReview = {
      reviewedBy: adminId,
      reviewedAt: new Date(),
      decision,
      adminNotes: adminNotes || ''
    };

    let alertSentResult = null;

    // If approved, send alerts to nearby users
    if (decision === 'approved') {
      try {
        alertSentResult = await sendAlertsToNearbyUsers(sosReport);
        
        sosReport.alertSent = {
          isSent: true,
          sentAt: new Date(),
          recipientCount: alertSentResult.recipientCount,
          alertId: alertSentResult.alertId
        };
      } catch (alertError) {
        console.error('Alert sending error:', alertError);
        // Continue with the review process even if alert sending fails
        sosReport.alertSent = {
          isSent: false,
          sentAt: new Date(),
          recipientCount: 0,
          alertId: null,
          error: alertError.message
        };
      }
    }

    await sosReport.save();

    // Send notification to the reporter
    try {
      const user = await User.findById(sosReport.userId);
      if (user && user.phone) {
        const templateName = decision === 'approved' ? 'sos_approved' : 'sos_reviewed';
        await sendWhatsAppAlert(user.phone, templateName, {
          userName: user.name,
          sosId: sosReport._id.toString(),
          decision
        });
      }
    } catch (notificationError) {
      console.error('User notification error:', notificationError);
    }

    res.json({
      success: true,
      message: `SOS report ${decision} successfully`,
      sosId: sosReport._id,
      alertSent: alertSentResult
    });

  } catch (error) {
    console.error('SOS review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review SOS report'
    });
  }
});

// GET /api/sos/users-in-radius - Get users within specified radius
router.get('/users-in-radius', authenticateAdmin, [
  query('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
  query('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
  query('radius').isInt({ min: 100, max: 10000 }).withMessage('Radius must be between 100m and 10km')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { latitude, longitude, radius = 1000 } = req.query;

    // Find users within radius using MongoDB geospatial query
    const users = await User.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(radius)
        }
      },
      fcmToken: { $exists: true, $ne: null }, // Only users with push tokens
      isActive: true
    }).select('_id name phone fcmToken location').lean();

    // Calculate distances and format response
    const usersWithDistance = users.map(user => ({
      userId: user._id,
      name: user.name,
      phone: user.phone,
      fcmToken: user.fcmToken,
      distance: calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        user.location.coordinates[1], // latitude
        user.location.coordinates[0]  // longitude
      )
    }));

    res.json({
      success: true,
      users: usersWithDistance,
      count: usersWithDistance.length,
      searchRadius: parseInt(radius)
    });

  } catch (error) {
    console.error('Users in radius error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to find users in radius'
    });
  }
});

// GET /api/sos/stats - Get SOS statistics for admin dashboard
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const { timeframe = 'week' } = req.query; // day, week, month, year
    
    let startDate;
    const endDate = new Date();
    
    switch (timeframe) {
      case 'day':
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    const [totalReports, pendingReports, approvedReports, rejectedReports, categoryStats] = await Promise.all([
      SOSReport.countDocuments({
        'incident.timestamp': { $gte: startDate, $lte: endDate }
      }),
      SOSReport.countDocuments({
        status: 'pending',
        'incident.timestamp': { $gte: startDate, $lte: endDate }
      }),
      SOSReport.countDocuments({
        status: 'approved',
        'incident.timestamp': { $gte: startDate, $lte: endDate }
      }),
      SOSReport.countDocuments({
        status: 'rejected',
        'incident.timestamp': { $gte: startDate, $lte: endDate }
      }),
      SOSReport.aggregate([
        {
          $match: {
            'incident.timestamp': { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$metadata.category',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      timeframe,
      period: { startDate, endDate },
      stats: {
        total: totalReports,
        pending: pendingReports,
        approved: approvedReports,
        rejected: rejectedReports,
        approvalRate: totalReports > 0 ? ((approvedReports / totalReports) * 100).toFixed(1) : 0
      },
      categoryBreakdown: categoryStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    });

  } catch (error) {
    console.error('SOS stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

// Helper Functions

// Send alerts to nearby users
async function sendAlertsToNearbyUsers(sosReport) {
  const ALERT_RADIUS = 1000; // 1km in meters
  
  const location = sosReport.incident.location;
  const coordinates = location.coordinates;

  // Find nearby users
  const nearbyUsers = await User.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: ALERT_RADIUS
      }
    },
    _id: { $ne: sosReport.userId }, // Exclude the reporter
    isActive: true,
    $or: [
      { fcmToken: { $exists: true, $ne: null } },
      { phone: { $exists: true, $ne: null } }
    ]
  }).lean();

  if (nearbyUsers.length === 0) {
    throw new Error('No nearby users found to send alerts');
  }

  // Create alert record
  const alert = new Alert({
    sosReportId: sosReport._id,
    type: 'sos_alert',
    location: {
      type: 'Point',
      coordinates: coordinates
    },
    message: `Emergency alert: ${sosReport.incident.message}`,
    recipients: nearbyUsers.map(user => user._id),
    sentAt: new Date(),
    status: 'sending'
  });

  await alert.save();

  // Send WhatsApp and Push notifications
  const notificationPromises = nearbyUsers.map(async (user) => {
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      user.location.coordinates[1],
      user.location.coordinates[0]
    );

    const promises = [];

    // WhatsApp notification
    if (user.phone) {
      promises.push(
        sendWhatsAppAlert(user.phone, 'sos_alert', {
          location: location.address,
          distance: distance.toFixed(1),
          message: sosReport.incident.message
        }).catch(error => {
          console.error(`WhatsApp error for user ${user._id}:`, error);
        })
      );
    }

    // Push notification
    if (user.fcmToken) {
      promises.push(
        sendAzurePushNotification(user.fcmToken, {
          title: '🚨 Emergency Alert',
          body: `${sosReport.metadata.category} reported ${distance.toFixed(1)}km from your location. Stay alert.`,
          data: {
            type: 'sos_alert',
            sosId: sosReport._id.toString(),
            latitude: location.latitude.toString(),
            longitude: location.longitude.toString(),
            distance: distance.toFixed(1),
            category: sosReport.metadata.category
          }
        }).catch(error => {
          console.error(`Push notification error for user ${user._id}:`, error);
        })
      );
    }

    return Promise.all(promises);
  });

  await Promise.allSettled(notificationPromises);

  // Update alert status
  alert.status = 'sent';
  await alert.save();

  return {
    recipientCount: nearbyUsers.length,
    alertId: alert._id
  };
}

// Determine priority based on message content
function determinePriority(message) {
  const highPriorityKeywords = ['stampede', 'crush', 'panic', 'emergency', 'help', 'danger'];
  const lowMessage = message.toLowerCase();
  
  for (const keyword of highPriorityKeywords) {
    if (lowMessage.includes(keyword)) {
      return 'high';
    }
  }
  
  return 'medium';
}

// Categorize incident based on message content
function categorizeIncident(message) {
  const lowMessage = message.toLowerCase();
  
  if (lowMessage.includes('stampede') || lowMessage.includes('crush') || lowMessage.includes('crowd')) {
    return 'stampede';
  } else if (lowMessage.includes('fire') || lowMessage.includes('smoke')) {
    return 'fire';
  } else if (lowMessage.includes('fight') || lowMessage.includes('violence')) {
    return 'violence';
  } else if (lowMessage.includes('medical') || lowMessage.includes('injury') || lowMessage.includes('hurt')) {
    return 'medical';
  } else {
    return 'other';
  }
}

module.exports = router;
