// App.jsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import { Camera, Loader2, AlertTriangle, CheckCircle, WifiOff, XCircle, Users, EyeOff, Activity, Shield, Zap, Bell, Play, ExternalLink, MapPin, Clock, MessageSquare, Phone, Mail, Plus } from 'lucide-react';
import { listenToSOSReports, updateSOSStatus, sendWhatsAppNotifications, testFirestoreConnection, listenToActiveAlerts } from './firebase/config';
import CreateAlertForm from './components/CreateAlertForm';

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const lastAlertTimeRef = useRef(0); // Track last alert time immediately
  const alertCooldownRef = useRef(false); // Immediate cooldown tracking

  const [model, setModel] = useState(null);
  const [loadingModel, setLoadingModel] = useState(true);
  const [detectedPeople, setDetectedPeople] = useState(0);
  const [alertStatus, setAlertStatus] = useState('idle'); // 'idle', 'warning', 'alerting', 'sent', 'error', 'no-webcam'
  const [alertCooldown, setAlertCooldown] = useState(false);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [recentActivities, setRecentActivities] = useState([]);

  // SOS Alerts Management State
  const [activeTab, setActiveTab] = useState('monitoring'); // 'monitoring' or 'sos-alerts'
  const [sosReports, setSOSReports] = useState([]);
  const [selectedSOSReport, setSelectedSOSReport] = useState(null);
  const [sosLoading, setSOSLoading] = useState(false);
  const [sosProcessing, setSOSProcessing] = useState({});
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState([]);

  // Configuration for alert thresholds (adjusted for more realistic testing)
  const HIGH_DENSITY_THRESHOLD = 1; // Warning for 1 or more people
  const CRITICAL_DENSITY_THRESHOLD = 3; // Alert for 3 or more people
  const ALERT_COOLDOWN_SECONDS = 10;

  const BACKEND_URL = 'http://localhost:5000/api/alert/stampede';

  // Effect to load the COCO-SSD model
  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.setBackend('webgl');
        await tf.ready();

        const loadedModel = await cocoSsd.load();
        setModel(loadedModel);
        setLoadingModel(false);
        console.log('COCO-SSD model loaded successfully!');
      } catch (error) {
        console.error('Failed to load COCO-SSD model:', error);
        setLoadingModel(false);
        setAlertStatus('error');
      }
    };

    loadModel();
  }, []);

  // Function to detect objects in the video stream
  const detect = useCallback(async () => {
    if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState === 4 && model) {
      const video = webcamRef.current.video;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      if (canvasRef.current) {
        canvasRef.current.width = videoWidth;
        canvasRef.current.height = videoHeight;
      }

      const predictions = await model.detect(video);
      const people = predictions.filter(prediction => prediction.class === 'person');
      const currentPeopleCount = people.length;
      setDetectedPeople(currentPeopleCount);

      // Add to recent activities if count changes
      if (recentActivities.length === 0 || recentActivities[0].count !== currentPeopleCount) {
        setRecentActivities(prevActivities => [
          { timestamp: new Date().toLocaleTimeString(), count: currentPeopleCount },
          ...prevActivities.slice(0, 9) // Keep last 10 activities
        ]);
      }

      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, videoWidth, videoHeight);
      ctx.font = '16px Arial';
      ctx.strokeStyle = '#00ffff'; // Cyan for futuristic look
      ctx.lineWidth = 3;
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 10;

      people.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.stroke();
        ctx.fillText(`Person (${Math.round(prediction.score * 100)}%)`, x, y > 10 ? y - 5 : 10);
      });

      // Check for alert conditions with robust cooldown
      const currentTime = Date.now();
      const timeSinceLastAlert = currentTime - lastAlertTimeRef.current;
      const cooldownActive = alertCooldownRef.current || timeSinceLastAlert < (ALERT_COOLDOWN_SECONDS * 1000);

      if (!cooldownActive && currentPeopleCount >= CRITICAL_DENSITY_THRESHOLD) {
        // Immediately set cooldown to prevent spam
        alertCooldownRef.current = true;
        lastAlertTimeRef.current = currentTime;

        setAlertStatus('alerting');
        sendAlert(`Critical stampede risk! ${currentPeopleCount} people detected.`, currentPeopleCount);
        setAlertCooldown(true);

        // Reset cooldown after timeout
        setTimeout(() => {
          alertCooldownRef.current = false;
          setAlertCooldown(false);
        }, ALERT_COOLDOWN_SECONDS * 1000);
      } else if (currentPeopleCount >= HIGH_DENSITY_THRESHOLD) {
        setAlertStatus('warning');
      } else {
        setAlertStatus('idle');
      }
    } else {
      if (webcamEnabled && !model) {
        setAlertStatus('error');
      } else if (webcamEnabled && (!webcamRef.current || !webcamRef.current.video || webcamRef.current.video.readyState !== 4)) {
        setAlertStatus('no-webcam');
      }
    }

    if (webcamEnabled) {
      requestAnimationFrame(detect);
    }
  }, [model, webcamEnabled, recentActivities]);

  // Function to send alert to backend
  const sendAlert = async (message, crowdDensity) => {
    // Double-check cooldown before sending (extra protection)
    const currentTime = Date.now();
    const timeSinceLastAlert = currentTime - lastAlertTimeRef.current;

    if (timeSinceLastAlert < (ALERT_COOLDOWN_SECONDS * 1000)) {
      console.log('Alert blocked: Still in cooldown period');
      return;
    }

    try {
      console.log('Sending alert to backend:', message);
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          crowdDensity: crowdDensity,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        console.log('Alert sent to backend successfully!');
        setAlertStatus('sent');
        setTimeout(() => setAlertStatus('idle'), 5000);
      } else {
        const errorData = await response.json();
        console.error('Failed to send alert to backend:', errorData);
        setAlertStatus('error');
      }
    } catch (error) {
      console.error('Network error sending alert:', error);
      setAlertStatus('error');
    }
  };

  // Function to start/stop webcam and detection
  const toggleWebcam = () => {
    setWebcamEnabled(prev => !prev);
  };

  // SOS Reports Management Functions
  const fetchSOSReports = useCallback(async () => {
    if (activeTab !== 'sos-alerts') return;

    try {
      setSOSLoading(true);
      console.log('🔥 Starting SOS reports Firebase connection...');

      // First test the Firestore connection
      const connectionTest = await testFirestoreConnection();
      if (!connectionTest.success) {
        console.error('❌ Firebase connection test failed:', connectionTest.error);
        setSOSLoading(false);
        return;
      }

      console.log('✅ Firebase connection test passed!');
      console.log('🔥 Setting up Firebase real-time listener for SOS reports...');

      // Set up real-time listener for Firebase SOS reports
      const unsubscribe = listenToSOSReports((reports) => {
        console.log('🔥 Firebase Listener Triggered!');
        console.log('📥 Raw Firebase data received:', reports);
        console.log('📊 Number of reports:', reports ? reports.length : 'undefined');

        // Always process Firebase data, even if empty
        if (!reports) {
          console.log('❌ Firebase returned null/undefined data');
          setSOSReports([]);
          setSOSLoading(false);
          return;
        }

        if (reports.length === 0) {
          console.log('📋 Firebase connected but no pending SOS reports found');
          setSOSReports([]);
          setSOSLoading(false);
          return;
        }

        console.log('✅ Processing real Firebase SOS reports:', reports.length);

        // Transform Firebase data to match user's actual Firestore structure
        const transformedReports = reports.map(report => {
          console.log('🔄 Transforming report:', report.id, report);

          return {
            _id: report.id,
            userId: report.userId || 'unknown',
            userInfo: {
              name: `User ${report.userId.slice(-4)}` || 'Anonymous User', // Generate name from userId
              phone: '+91-XXXX-XXXX', // Not in user's structure
              email: 'user@example.com' // Not in user's structure
            },
            incident: {
              videoUrl: report.videoUrl || '',
              videoThumbnail: report.videoThumbnail || '', // Optional field
              videoDuration: report.videoDuration || 0,
              message: report.message || 'Emergency situation reported',
              location: {
                latitude: report.location?.latitude || 28.7041,
                longitude: report.location?.longitude || 77.1025,
                address: report.location?.latitude && report.location?.longitude
                  ? `Emergency Location: ${report.location.latitude.toFixed(4)}, ${report.location.longitude.toFixed(4)}`
                  : 'Location not available',
                accuracy: report.location?.accuracy || 0
              },
              timestamp: report.createdAt?.toDate() || new Date(),
              deviceInfo: {
                platform: report.deviceInfo?.platform || 'unknown',
                version: report.deviceInfo?.version || 'unknown',
                model: report.deviceInfo?.model || 'unknown'
              }
            },
            status: 'pending', // Default to pending since not in user's structure
            metadata: {
              priority: 'high', // Default priority for emergency reports
              category: 'emergency',
              firebaseDocId: report.id
            }
          };
        });

        setSOSReports(transformedReports);
        setSOSLoading(false);
      });

      // Store unsubscribe function for cleanup
      return unsubscribe;

    } catch (error) {
      console.error('❌ Error setting up Firebase listener:', error);
      setSOSLoading(false);

      // Fallback to demo data if Firebase fails
      console.log('📋 Using demo data as fallback...');
      setSOSReports([
        {
          _id: 'demo_firebase_1',
          userId: 'demo_user_1',
          userInfo: {
            name: 'Demo User - Firebase',
            phone: '+91-9876543210',
            email: 'demo@firebase.com'
          },
          incident: {
            videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
            videoThumbnail: '',
            videoDuration: 15,
            message: 'Demo emergency report - Firebase integration active',
            location: {
              latitude: 28.7041,
              longitude: 77.1025,
              address: 'Firebase Demo Location, New Delhi, India',
              accuracy: 5.0
            },
            timestamp: new Date(Date.now() - 5 * 60 * 1000),
            deviceInfo: {
              platform: 'web',
              version: '1.0',
              model: 'Firebase Demo'
            }
          },
          status: 'pending',
          metadata: {
            priority: 'high',
            category: 'demo'
          }
        }
      ]);
    }
  }, [activeTab]);

  // Handle SOS report approval/rejection
  const handleSOSReview = async (sosId, decision) => {
    try {
      setSOSProcessing(prev => ({ ...prev, [sosId]: true }));

      console.log(`🔄 Processing SOS report ${sosId} with decision: ${decision}`);

      // Find the current report for WhatsApp notifications
      const currentReport = sosReports.find(report => report._id === sosId);

      // Update Firebase with admin decision
      const adminNotes = decision === 'approved'
        ? 'Emergency verified, sending alerts to nearby users'
        : 'Report does not meet emergency criteria';

      await updateSOSStatus(sosId, decision, adminNotes);

      // Send WhatsApp notifications if approved
      if (decision === 'approved' && currentReport) {
        console.log('📱 Sending WhatsApp notifications...');

        const whatsappResult = await sendWhatsAppNotifications(currentReport, { adminNotes });

        if (whatsappResult.success) {
          alert(`�� SOS Report APPROVED!\n\n🚨 Emergency alerts sent successfully!\n\n📱 WhatsApp notifications sent to ${whatsappResult.recipientCount} nearby users\n📍 Location: ${currentReport.incident?.location?.address || 'Location not available'}\n⏰ Time: ${new Date().toLocaleString()}\n\n✅ Notifications include:\n• Emergency location details\n• Google Maps link\n• Safety instructions\n• Emergency contact info\n\nUsers within 1km radius have been notified via WhatsApp! 📲`);
        } else {
          alert(`✅ SOS Report APPROVED!\n\n⚠️ WhatsApp notification failed: ${whatsappResult.error}\n\nReport status updated in Firebase successfully.`);
        }
      } else {
        alert(`❌ SOS Report REJECTED\n\nThe report has been reviewed and rejected.\n📝 Admin Notes: ${adminNotes}\n✅ Status updated in Firebase Firestore.`);
      }

      // Remove from pending list (Firebase listener will handle this automatically)
      setSOSReports(prev => prev.filter(report => report._id !== sosId));
      setSelectedSOSReport(null);

      console.log(`✅ SOS report ${sosId} ${decision} successfully`);

    } catch (error) {
      console.error('❌ Error reviewing SOS report:', error);

      // Show error but still provide demo functionality
      if (decision === 'approved') {
        alert(`✅ SOS Report APPROVED! (Offline Mode)\n\n⚠️ Firebase connection issue, but in a real system:\n\n📱 WhatsApp notifications would be sent to nearby users\n📍 Location alerts would be distributed\n🚨 Emergency services would be notified\n\nFirebase Error: ${error.message}`);
      } else {
        alert(`❌ SOS Report REJECTED (Offline Mode)\n\nThe report has been reviewed and rejected.\n⚠️ Firebase unavailable - changes not persisted.\n\nError: ${error.message}`);
      }

      // Remove from list for demo even on error
      setSOSReports(prev => prev.filter(report => report._id !== sosId));
      setSelectedSOSReport(null);
    } finally {
      setSOSProcessing(prev => ({ ...prev, [sosId]: false }));
    }
  };

  // Format time ago
  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-300 bg-red-900/30 border-red-500/50';
      case 'medium': return 'text-yellow-300 bg-yellow-900/30 border-yellow-500/50';
      case 'low': return 'text-green-300 bg-green-900/30 border-green-500/50';
      default: return 'text-gray-300 bg-gray-900/30 border-gray-500/50';
    }
  };

  // Effect to manage the detection loop based on webcamEnabled state
  useEffect(() => {
    if (webcamEnabled && model) {
      requestAnimationFrame(detect);
    } else if (!webcamEnabled) {
      setDetectedPeople(0);
      setAlertStatus('idle');
      // Reset cooldown when webcam is disabled
      alertCooldownRef.current = false;
      lastAlertTimeRef.current = 0;
      setAlertCooldown(false);
    }
  }, [webcamEnabled, model, detect]);

  // Effect to fetch SOS reports when switching to SOS alerts tab
  useEffect(() => {
    let unsubscribe = null;

    const setupListener = async () => {
      console.log('🚀 Setting up Firebase listener for SOS reports...');
      console.log('📱 Active tab:', activeTab);

      if (activeTab === 'sos-alerts') {
        console.log('✅ On SOS alerts tab - connecting to Firebase...');
        unsubscribe = await fetchSOSReports();
      } else {
        console.log('ℹ️ Not on SOS alerts tab - skipping Firebase connection');
      }
    };

    setupListener();

    // Cleanup Firebase listener on unmount
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        console.log('🧹 Cleaning up Firebase SOS reports listener');
        unsubscribe();
      }
    };
  }, [fetchSOSReports, activeTab]);

  // Auto-refresh SOS reports every 30 seconds when on SOS tab
  useEffect(() => {
    if (activeTab === 'sos-alerts') {
      const interval = setInterval(fetchSOSReports, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab, fetchSOSReports]);

  // Listen to active alerts
  useEffect(() => {
    if (activeTab === 'sos-alerts') {
      console.log('🚨 Setting up active alerts listener...');
      const unsubscribe = listenToActiveAlerts((alerts) => {
        console.log('📡 Active alerts received:', alerts.length);
        setActiveAlerts(alerts);
      });

      return () => {
        if (unsubscribe && typeof unsubscribe === 'function') {
          console.log('🧹 Cleaning up active alerts listener');
          unsubscribe();
        }
      };
    }
  }, [activeTab]);

  // Determine status text for the "Current Count" card
  const getCurrentStatusText = () => {
    if (detectedPeople >= CRITICAL_DENSITY_THRESHOLD) return "CRITICAL ALERT";
    if (detectedPeople >= HIGH_DENSITY_THRESHOLD) return "HIGH DENSITY";
    return "AREA SECURE";
  };

  const getStatusColor = () => {
    if (detectedPeople >= CRITICAL_DENSITY_THRESHOLD) return "from-red-500 via-red-600 to-red-700";
    if (detectedPeople >= HIGH_DENSITY_THRESHOLD) return "from-yellow-500 via-orange-500 to-red-500";
    return "from-green-400 via-blue-500 to-purple-600";
  };

  const getGlowEffect = () => {
    if (detectedPeople >= CRITICAL_DENSITY_THRESHOLD) return "shadow-red-500/50 shadow-2xl";
    if (detectedPeople >= HIGH_DENSITY_THRESHOLD) return "shadow-yellow-500/50 shadow-xl";
    return "shadow-blue-500/30 shadow-lg";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-700"></div>
        <div className="absolute bottom-40 left-1/2 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000"></div>
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-5"
           style={{
             backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
             backgroundSize: '50px 50px'
           }}>
      </div>

      <div className="relative z-10 flex flex-col items-center p-6 min-h-screen">
        {/* Futuristic Header */}
        <header className="w-full max-w-6xl flex items-center justify-between py-6 px-8 mb-8">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full shadow-lg shadow-cyan-400/50">
              <Shield size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-extrabold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                STAMPEDE GUARD
              </h1>
              <p className="text-cyan-300 text-sm font-medium">AI-Powered Crowd Monitoring & Emergency Response System</p>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            {/* Tab Navigation */}
            <div className="flex items-center space-x-2 bg-black/40 backdrop-blur-lg rounded-2xl p-2 border border-gray-700/50">
              <button
                onClick={() => setActiveTab('monitoring')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                  activeTab === 'monitoring'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <Activity size={20} />
                <span className="font-medium">Live Monitor</span>
              </button>

              <button
                onClick={() => setActiveTab('sos-alerts')}
                className={`relative flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                  activeTab === 'sos-alerts'
                    ? 'bg-gradient-to-r from-red-500 to-orange-600 text-white shadow-lg'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <Bell size={20} />
                <span className="font-medium">SOS Alerts</span>
                {sosReports.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                    {sosReports.length}
                  </span>
                )}
              </button>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${webcamEnabled ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
              <span className="text-white font-medium">
                {webcamEnabled ? 'ACTIVE' : 'STANDBY'}
              </span>
            </div>

            {/* Control Button */}
            {activeTab === 'monitoring' && (
              <button
                onClick={toggleWebcam}
                className={`relative p-4 rounded-2xl backdrop-blur-lg transition-all duration-300 transform hover:scale-105 ${
                  webcamEnabled
                    ? 'bg-red-500/20 border border-red-400/50 shadow-lg shadow-red-500/25 hover:bg-red-500/30'
                    : 'bg-green-500/20 border border-green-400/50 shadow-lg shadow-green-500/25 hover:bg-green-500/30'
                }`}
                title={webcamEnabled ? "Disable Monitoring" : "Enable Monitoring"}
              >
                {webcamEnabled ? (
                  <EyeOff size={28} className="text-red-300" />
                ) : (
                  <Camera size={28} className="text-green-300" />
                )}
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center">
                  <Zap size={12} className="text-white" />
                </span>
              </button>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        {activeTab === 'monitoring' ? (
          <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Video Feed - Takes 2/3 width on large screens */}
          <div className="lg:col-span-2">
            <div className="bg-black/40 backdrop-blur-xl rounded-3xl border border-cyan-400/30 overflow-hidden shadow-2xl shadow-cyan-500/20">
              {/* Video Header */}
              <div className="bg-gradient-to-r from-cyan-500/20 to-blue-600/20 p-4 border-b border-cyan-400/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Activity className="text-cyan-400" size={24} />
                    <span className="text-white font-semibold text-lg">Live Feed</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-red-300 text-sm font-medium">REC</span>
                  </div>
                </div>
              </div>

              {/* Video Content */}
              <div className="relative aspect-video bg-black">
                {/* Loading overlay */}
                {loadingModel && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20">
                    <div className="text-center">
                      <div className="relative mb-6">
                        <Loader2 className="animate-spin text-cyan-400 mx-auto" size={64} />
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
                      </div>
                      <p className="text-2xl font-bold text-white mb-2">Initializing AI Model</p>
                      <p className="text-cyan-300">Advanced neural networks loading...</p>
                      <div className="mt-4 w-64 h-2 bg-gray-700 rounded-full mx-auto overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Webcam off overlay */}
                {!webcamEnabled && !loadingModel && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800/50 to-blue-900/50 backdrop-blur-sm">
                    <div className="relative">
                      <Camera size={96} className="text-gray-400 mb-6" />
                      <div className="absolute inset-0 bg-gradient-to-r from-gray-400 to-blue-400 rounded-full blur-xl opacity-30 animate-pulse"></div>
                    </div>
                    <p className="text-2xl font-bold text-white mb-2">Monitoring Standby</p>
                    <p className="text-blue-300 text-center max-w-md">
                      Click the camera icon to activate crowd detection system
                    </p>
                  </div>
                )}

                {/* Webcam and Canvas Container */}
                {webcamEnabled && !loadingModel && (
                  <div className="relative w-full h-full">
                    <Webcam
                      ref={webcamRef}
                      muted={true}
                      videoConstraints={{
                        facingMode: 'user',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                      }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: 'scaleX(-1)'
                      }}
                      onUserMedia={() => {
                        if (webcamEnabled && model) {
                          requestAnimationFrame(detect);
                        }
                      }}
                      onUserMediaError={(error) => {
                        console.error('Webcam access denied or error:', error);
                        setWebcamEnabled(false);
                        setAlertStatus('error');
                        alert("Error accessing webcam. Please ensure you've granted camera permissions and no other application is using it.");
                      }}
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0"
                      style={{
                        width: '100%',
                        height: '100%',
                        transform: 'scaleX(-1)'
                      }}
                    />
                    
                    {/* HUD Overlay */}
                    <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
                      <div className="bg-black/50 backdrop-blur-md rounded-lg p-3 border border-cyan-400/30">
                        <div className="text-cyan-400 text-sm font-medium">AI DETECTION</div>
                        <div className="text-white text-xs">TensorFlow.js COCO-SSD</div>
                      </div>
                      <div className="bg-black/50 backdrop-blur-md rounded-lg p-3 border border-cyan-400/30">
                        <div className="text-cyan-400 text-sm font-medium">TIMESTAMP</div>
                        <div className="text-white text-xs">{new Date().toLocaleTimeString()}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Stats and Controls */}
          <div className="space-y-6">
            {/* People Count Display */}
            <div className={`relative bg-gradient-to-r ${getStatusColor()} rounded-3xl p-8 text-center overflow-hidden ${getGlowEffect()}`}>
              <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
              <div className="relative z-10">
                <Users className="text-white/80 mx-auto mb-4" size={48} />
                <p className="text-white/90 text-lg font-medium mb-2">People Detected</p>
                <p className="text-white text-7xl font-black mb-4 tracking-tight">
                  {detectedPeople}
                </p>
                <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full ${
                  detectedPeople >= CRITICAL_DENSITY_THRESHOLD 
                    ? 'bg-red-500/30 border border-red-300/50' 
                    : detectedPeople >= HIGH_DENSITY_THRESHOLD 
                    ? 'bg-yellow-500/30 border border-yellow-300/50'
                    : 'bg-green-500/30 border border-green-300/50'
                }`}>
                  {detectedPeople >= CRITICAL_DENSITY_THRESHOLD && <AlertTriangle size={16} className="text-white animate-pulse" />}
                  <span className="text-white font-bold text-sm">
                    {getCurrentStatusText()}
                  </span>
                </div>
              </div>
              
              {/* Animated rings */}
              {detectedPeople >= CRITICAL_DENSITY_THRESHOLD && (
                <>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-red-300/30 rounded-full animate-ping"></div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 border-2 border-red-300/20 rounded-full animate-ping delay-150"></div>
                </>
              )}
            </div>

            {/* System Status */}
            <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
              <h3 className="text-white font-bold text-lg mb-4 flex items-center">
                <Shield className="text-cyan-400 mr-3" size={24} />
                System Status
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">AI Model</span>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${model ? 'bg-green-400' : 'bg-red-400'}`}></div>
                    <span className={`text-sm font-medium ${model ? 'text-green-400' : 'text-red-400'}`}>
                      {model ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Camera Feed</span>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${webcamEnabled ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                    <span className={`text-sm font-medium ${webcamEnabled ? 'text-green-400' : 'text-gray-400'}`}>
                      {webcamEnabled ? 'Active' : 'Standby'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Alert System</span>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${alertCooldown ? 'bg-yellow-400' : 'bg-green-400'}`}></div>
                    <span className={`text-sm font-medium ${alertCooldown ? 'text-yellow-400' : 'text-green-400'}`}>
                      {alertCooldown ? 'Cooldown' : 'Ready'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
              <h3 className="text-white font-bold text-lg mb-4 flex items-center">
                <Activity className="text-cyan-400 mr-3" size={24} />
                Activity Log
              </h3>
              
              <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2">
                {recentActivities.length > 0 ? (
                  recentActivities.map((activity, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg border border-gray-700/30">
                      <span className="text-gray-400 text-sm font-mono">{activity.timestamp}</span>
                      <span className={`font-bold text-sm px-2 py-1 rounded ${
                        activity.count >= CRITICAL_DENSITY_THRESHOLD 
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : activity.count >= HIGH_DENSITY_THRESHOLD 
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                          : 'bg-green-500/20 text-green-300 border border-green-500/30'
                      }`}>
                        {activity.count} detected
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Users className="text-gray-600 mx-auto mb-3" size={48} />
                    <p className="text-gray-500 text-sm">No activity recorded</p>
                    <p className="text-gray-600 text-xs">Enable monitoring to start</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        ) : (
          /* SOS Alerts Management */
          <div className="w-full max-w-6xl">
            {/* Active Alerts Banner */}
            {activeAlerts.length > 0 && (
              <div className="mb-6 bg-gradient-to-r from-red-500/20 to-orange-600/20 backdrop-blur-xl rounded-2xl border border-red-500/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-red-500 rounded-lg animate-pulse">
                      <AlertTriangle className="text-white" size={20} />
                    </div>
                    <div>
                      <h3 className="text-red-300 font-bold text-lg">🚨 Active Emergency Alerts</h3>
                      <p className="text-red-200 text-sm">{activeAlerts.length} alert{activeAlerts.length !== 1 ? 's' : ''} currently active</p>
                    </div>
                  </div>
                  <div className="text-red-300 text-sm">
                    <div className="w-3 h-3 bg-red-400 rounded-full animate-ping"></div>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {activeAlerts.slice(0, 3).map((alert) => (
                    <div key={alert.id} className="bg-black/30 rounded-lg p-3 border border-red-500/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{alert.title}</p>
                          <p className="text-red-200 text-sm">{alert.location?.address || 'Location not specified'}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            alert.severity === 'high' ? 'bg-red-500/30 text-red-300' :
                            alert.severity === 'medium' ? 'bg-yellow-500/30 text-yellow-300' :
                            'bg-green-500/30 text-green-300'
                          }`}>
                            {alert.severity?.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {activeAlerts.length > 3 && (
                    <p className="text-red-300 text-sm text-center">
                      +{activeAlerts.length - 3} more active alerts
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* SOS Reports List */}
              <div className="lg:col-span-2">
                <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 overflow-hidden">
                  <div className="p-6 border-b border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-white flex items-center space-x-3">
                          <AlertTriangle className="text-red-400" size={28} />
                          <span>Emergency SOS Reports</span>
                        </h2>
                        <div className="flex items-center space-x-2 mt-1">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          <span className="text-xs text-green-400">Real-time Firebase Firestore</span>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-400">Project: crowd-monitoring-e1f70</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-gray-400 text-sm">
                          {sosReports.length} pending review{sosReports.length !== 1 ? 's' : ''}
                        </span>
                        <button
                          onClick={() => setShowCreateAlert(true)}
                          className="flex items-center space-x-2 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white px-4 py-2 rounded-lg transition-all font-medium"
                          title="Create New Alert"
                        >
                          <Plus size={16} />
                          <span>Create Alert</span>
                        </button>
                        <button
                          onClick={fetchSOSReports}
                          className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          title="Refresh Firebase Data"
                        >
                          <Activity size={16} className="text-white" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {sosLoading ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin mx-auto mb-4 w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                      <p className="text-gray-400">Loading SOS reports...</p>
                    </div>
                  ) : sosReports.length === 0 ? (
                    <div className="p-8 text-center">
                      <CheckCircle className="mx-auto mb-4 text-green-500" size={48} />
                      <p className="text-gray-400 text-lg">No pending SOS reports</p>
                      <p className="text-gray-500 text-sm mt-2">All emergency reports have been reviewed</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-700/50">
                      {sosReports.map((report) => (
                        <div
                          key={report._id}
                          className={`p-6 hover:bg-gray-800/50 transition-colors cursor-pointer ${
                            selectedSOSReport?._id === report._id ? 'bg-blue-900/30 border-l-4 border-blue-500' : ''
                          }`}
                          onClick={() => setSelectedSOSReport(report)}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getPriorityColor(report.metadata.priority)}`}>
                                🚨 {report.metadata.priority.toUpperCase()} PRIORITY
                              </div>
                              <div className="px-2 py-1 bg-orange-900/30 border border-orange-500/50 rounded-full text-xs font-medium text-orange-300">
                                PENDING REVIEW
                              </div>
                            </div>
                            <span className="text-gray-400 text-sm">{formatTimeAgo(report.incident.timestamp)}</span>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center space-x-2 text-gray-300">
                              <Users size={16} />
                              <span className="font-medium text-white">{report.userInfo.name}</span>
                              <span className="text-gray-500">•</span>
                              <span className="text-gray-400">{report.userInfo.phone}</span>
                            </div>

                            <div className="flex items-center space-x-2 text-gray-300">
                              <MapPin size={16} />
                              <span className="text-sm">{report.incident.location.address || 'Location unavailable'}</span>
                            </div>

                            <div className="flex items-start space-x-2 text-gray-300">
                              <MessageSquare size={16} className="mt-0.5" />
                              <span className="text-sm">{report.incident.message}</span>
                            </div>

                            <div className="flex items-center space-x-4 text-gray-400 text-sm">
                              <div className="flex items-center space-x-1">
                                <Clock size={14} />
                                <span>Video: {report.incident.videoDuration}s</span>
                              </div>
                              <div className="flex items-center space-x-1 bg-green-900/30 px-2 py-1 rounded border border-green-500/50">
                                <div className="w-1 h-1 bg-green-400 rounded-full"></div>
                                <span className="text-green-400 text-xs">Firebase Storage</span>
                              </div>
                              <span className="capitalize bg-gray-800/50 px-2 py-1 rounded text-cyan-300">
                                {report.metadata.category}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3 mt-6">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSOSReview(report._id, 'approved');
                              }}
                              disabled={sosProcessing[report._id]}
                              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm transition-colors font-medium"
                            >
                              <CheckCircle size={16} />
                              <span>APPROVE & DISPATCH EMERGENCY SERVICES</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSOSReview(report._id, 'rejected');
                              }}
                              disabled={sosProcessing[report._id]}
                              className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm transition-colors font-medium"
                            >
                              <XCircle size={16} />
                              <span>❌ REJECT</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Report Detail */}
              <div className="lg:col-span-1">
                {selectedSOSReport ? (
                  <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 overflow-hidden">
                    <div className="p-6 border-b border-gray-700/50">
                      <h3 className="text-xl font-bold text-white">Emergency Details</h3>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Video Player */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-white flex items-center space-x-2">
                          <Play size={16} className="text-red-400" />
                          <span>Emergency Video</span>
                          <div className="flex items-center space-x-1 ml-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-xs text-green-400 font-medium">Firebase Storage</span>
                          </div>
                        </h4>
                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-blue-300">🔗 Storage Bucket:</span>
                            <span className="text-blue-200 font-mono">crowd-monitoring-e1f70</span>
                          </div>
                          <div className="flex items-center justify-between text-xs mt-1">
                            <span className="text-blue-300">📁 Project ID:</span>
                            <span className="text-blue-200 font-mono">crowd-monitoring-e1f70</span>
                          </div>
                        </div>
                        <div className="relative bg-black rounded-lg overflow-hidden aspect-video border border-green-500/30">
                          {selectedSOSReport.incident.videoUrl ? (
                            <video
                              src={selectedSOSReport.incident.videoUrl}
                              controls
                              className="w-full h-full object-cover"
                              poster={selectedSOSReport.incident.videoThumbnail}
                              onLoadStart={() => console.log('���� Loading video from Firebase Storage:', selectedSOSReport.incident.videoUrl)}
                              onCanPlay={() => console.log('✅ Video loaded successfully from Firebase')}
                              onError={(e) => console.error('❌ Video loading error:', e)}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-800">
                              <div className="text-center">
                                <AlertTriangle className="mx-auto mb-2 text-yellow-500" size={32} />
                                <p className="text-gray-400 text-sm">Video not available</p>
                                <p className="text-gray-500 text-xs">Firebase Storage URL missing</p>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setShowVideoModal(true)}
                            className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 text-sm"
                          >
                            <ExternalLink size={14} />
                            <span>Open full screen</span>
                          </button>
                          {selectedSOSReport.incident.videoUrl && (
                            <div className="flex items-center space-x-2 text-green-400 text-xs">
                              <div className="w-1 h-1 bg-green-400 rounded-full"></div>
                              <span>Streamed from Firebase</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* User Information */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-white">Reporter Information</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Name:</span>
                            <span className="text-white font-medium">{selectedSOSReport.userInfo.name}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Phone:</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-white font-mono">{selectedSOSReport.userInfo.phone}</span>
                              <button className="text-green-400 hover:text-green-300">
                                <Phone size={14} />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Email:</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-white">{selectedSOSReport.userInfo.email}</span>
                              <button className="text-blue-400 hover:text-blue-300">
                                <Mail size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Location Information */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-white">Location Details</h4>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-gray-400">Address:</span>
                            <p className="text-white mt-1 bg-gray-800/50 p-2 rounded">{selectedSOSReport.incident.location.address || 'Address not available'}</p>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Coordinates:</span>
                            <span className="text-white font-mono text-xs">
                              {selectedSOSReport.incident.location.latitude.toFixed(6)}, {selectedSOSReport.incident.location.longitude.toFixed(6)}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            const lat = selectedSOSReport.incident.location.latitude;
                            const lng = selectedSOSReport.incident.location.longitude;
                            window.open(`https://maps.google.com/maps?q=${lat},${lng}`, '_blank');
                          }}
                          className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 text-sm bg-blue-900/20 px-3 py-2 rounded-lg w-full justify-center"
                        >
                          <MapPin size={14} />
                          <span>View on Google Maps</span>
                        </button>
                      </div>

                      {/* Firebase Metadata */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-white">Firebase Details</h4>
                        <div className="bg-gray-800/50 rounded-lg p-3 space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Document ID:</span>
                            <span className="text-white font-mono text-xs">{selectedSOSReport._id}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Collection:</span>
                            <span className="text-cyan-300 font-mono">sos-alerts</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Status:</span>
                            <span className="text-orange-300 font-medium">{selectedSOSReport.status}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Firebase Project:</span>
                            <span className="text-green-300 font-mono text-xs">crowd-monitoring-e1f70</span>
                          </div>
                        </div>
                      </div>

                      {/* Emergency Actions */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-white text-lg">🚨 EMERGENCY ACTIONS</h4>
                        <div className="space-y-3">
                          <button
                            onClick={() => handleSOSReview(selectedSOSReport._id, 'approved')}
                            disabled={sosProcessing[selectedSOSReport._id]}
                            className="w-full flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-4 rounded-lg transition-colors font-bold text-lg"
                          >
                            <CheckCircle size={24} />
                            <span>APPROVE & DISPATCH EMERGENCY SERVICES</span>
                          </button>

                          <button
                            onClick={() => handleSOSReview(selectedSOSReport._id, 'rejected')}
                            disabled={sosProcessing[selectedSOSReport._id]}
                            className="w-full flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-4 rounded-lg transition-colors font-bold text-lg"
                          >
                            <XCircle size={24} />
                            <span>❌ REJECT REPORT</span>
                          </button>
                        </div>

                        <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-3 text-sm">
                          <p className="text-yellow-300 font-medium mb-1">⚠️ Emergency Dispatch Action:</p>
                          <p className="text-yellow-200">Clicking APPROVE will instantly:
                          <br/>• Find fastest routes from nearest Hospital, Fire Brigade & Police to emergency location
                          <br/>• Send route details via WhatsApp to emergency services
                          <br/>• Alert all users within 1km radius
                          <br/>• Dispatch emergency responders with optimal navigation</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-8 text-center">
                    <AlertTriangle className="mx-auto mb-4 text-gray-500" size={48} />
                    <p className="text-gray-400">Select an SOS report to view details</p>
                    <p className="text-gray-500 text-sm mt-2">Click on any pending report to review emergency details</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Video Modal */}
        {showVideoModal && selectedSOSReport && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-black rounded-lg overflow-hidden max-w-4xl w-full max-h-[90vh] border border-green-500/30">
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <h3 className="text-white font-semibold">Emergency Video - {selectedSOSReport.userInfo.name}</h3>
                  <div className="flex items-center space-x-2 bg-green-900/30 px-2 py-1 rounded border border-green-500/50">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-green-400 text-xs font-medium">Firebase Storage</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowVideoModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <XCircle size={24} />
                </button>
              </div>
              <div className="p-4">
                {selectedSOSReport.incident.videoUrl ? (
                  <video
                    src={selectedSOSReport.incident.videoUrl}
                    controls
                    autoPlay
                    className="w-full h-auto"
                    poster={selectedSOSReport.incident.videoThumbnail}
                    onLoadStart={() => console.log('🎥 Full screen video loading from Firebase Storage')}
                    onCanPlay={() => console.log('✅ Full screen video ready to play')}
                  />
                ) : (
                  <div className="w-full h-96 flex items-center justify-center bg-gray-800 rounded">
                    <div className="text-center">
                      <AlertTriangle className="mx-auto mb-4 text-yellow-500" size={48} />
                      <p className="text-gray-400 text-lg mb-2">Video not available</p>
                      <p className="text-gray-500">Firebase Storage URL missing or invalid</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Alert Messages */}
        {alertStatus === 'error' && (
          <div className="fixed bottom-6 right-6 bg-red-500/20 backdrop-blur-lg border border-red-400/50 rounded-2xl p-4 shadow-lg shadow-red-500/25 animate-pulse">
            <div className="flex items-center space-x-3">
              <XCircle size={24} className="text-red-400" />
              <div>
                <p className="text-red-300 font-bold">System Error</p>
                <p className="text-red-400 text-sm">Check console for details</p>
              </div>
            </div>
          </div>
        )}

        {alertStatus === 'no-webcam' && (
          <div className="fixed bottom-6 right-6 bg-yellow-500/20 backdrop-blur-lg border border-yellow-400/50 rounded-2xl p-4 shadow-lg shadow-yellow-500/25">
            <div className="flex items-center space-x-3">
              <WifiOff size={24} className="text-yellow-400" />
              <div>
                <p className="text-yellow-300 font-bold">Camera Access Required</p>
                <p className="text-yellow-400 text-sm">Grant webcam permissions</p>
              </div>
            </div>
          </div>
        )}

        {alertStatus === 'sent' && (
          <div className="fixed bottom-6 right-6 bg-green-500/20 backdrop-blur-lg border border-green-400/50 rounded-2xl p-4 shadow-lg shadow-green-500/25">
            <div className="flex items-center space-x-3">
              <CheckCircle size={24} className="text-green-400" />
              <div>
                <p className="text-green-300 font-bold">Alert Sent Successfully!</p>
                <p className="text-green-400 text-sm">WhatsApp notification delivered</p>
              </div>
            </div>
          </div>
        )}

        {/* Create Alert Form */}
        <CreateAlertForm
          isOpen={showCreateAlert}
          onClose={() => setShowCreateAlert(false)}
          onSuccess={(alertId) => {
            console.log('Alert created successfully:', alertId);
            alert('🚨 Alert Created Successfully!\n\nAlert ID: ' + alertId + '\n\nThe alert has been saved to Firebase and will be distributed to users in the specified area.');
            // You could also refresh any active alerts list here
          }}
        />
      </div>
    </div>
  );
}

export default App;
