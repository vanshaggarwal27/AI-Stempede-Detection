// App.jsx - 3D Animated Version with Anime.js
import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import anime from 'animejs';
import { Camera, Loader2, AlertTriangle, CheckCircle, WifiOff, XCircle, Users, EyeOff, Activity, Shield, Zap, Bell, Play, ExternalLink, MapPin, Clock, MessageSquare, Phone, Mail, Plus } from 'lucide-react';
import { listenToSOSReports, updateSOSStatus, sendWhatsAppNotifications, testFirestoreConnection, listenToActiveAlerts } from './firebase/config';
import CreateAlertForm from './components/CreateAlertForm';

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const lastAlertTimeRef = useRef(0);
  const alertCooldownRef = useRef(false);
  const appRef = useRef(null);
  const headerRef = useRef(null);
  const particleRefs = useRef([]);

  const [model, setModel] = useState(null);
  const [loadingModel, setLoadingModel] = useState(true);
  const [detectedPeople, setDetectedPeople] = useState(0);
  const [alertStatus, setAlertStatus] = useState('idle');
  const [alertCooldown, setAlertCooldown] = useState(false);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [recentActivities, setRecentActivities] = useState([]);

  // SOS Alerts Management State
  const [activeTab, setActiveTab] = useState('monitoring');
  const [sosReports, setSOSReports] = useState([]);
  const [selectedSOSReport, setSelectedSOSReport] = useState(null);
  const [sosLoading, setSOSLoading] = useState(false);
  const [sosProcessing, setSOSProcessing] = useState({});
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState([]);

  // Configuration for alert thresholds
  const HIGH_DENSITY_THRESHOLD = 1;
  const CRITICAL_DENSITY_THRESHOLD = 3;
  const ALERT_COOLDOWN_SECONDS = 10;
  const BACKEND_URL = 'http://localhost:5000/api/alert/stampede';

  // 3D Animation Effects with Anime.js
  useEffect(() => {
    // Initial page load 3D entrance animation
    anime({
      targets: appRef.current,
      opacity: [0, 1],
      scale: [0.8, 1],
      duration: 1200,
      easing: 'easeOutElastic(1, .8)',
      delay: 100
    });

    // Header dramatic entrance
    anime({
      targets: headerRef.current,
      translateY: [-100, 0],
      opacity: [0, 1],
      duration: 1000,
      easing: 'easeOutBounce',
      delay: 300
    });

    // Staggered card animations
    anime({
      targets: '.animate-card',
      translateX: [100, 0],
      rotateY: [45, 0],
      opacity: [0, 1],
      duration: 800,
      delay: anime.stagger(150, {start: 500}),
      easing: 'easeOutQuart'
    });

    // Floating particles background
    createFloatingParticles();
    
    // Continuous 3D rotation effects
    startContinuous3DEffects();

  }, []);

  // Create floating 3D particles
  const createFloatingParticles = () => {
    const particleContainer = document.createElement('div');
    particleContainer.className = 'fixed inset-0 pointer-events-none z-0';
    particleContainer.style.overflow = 'hidden';
    
    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div');
      particle.className = 'absolute w-2 h-2 bg-cyan-400 rounded-full opacity-20';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.top = Math.random() * 100 + '%';
      
      particleContainer.appendChild(particle);
      particleRefs.current.push(particle);
    }
    
    document.body.appendChild(particleContainer);

    // Animate particles in 3D space
    anime({
      targets: particleRefs.current,
      translateX: () => anime.random(-200, 200),
      translateY: () => anime.random(-200, 200),
      translateZ: () => anime.random(-100, 100),
      rotateX: () => anime.random(0, 360),
      rotateY: () => anime.random(0, 360),
      scale: [0.5, 1.5],
      opacity: [0.1, 0.8],
      duration: () => anime.random(3000, 8000),
      loop: true,
      direction: 'alternate',
      easing: 'easeInOutSine',
      delay: anime.stagger(50)
    });
  };

  // Continuous 3D effects
  const startContinuous3DEffects = () => {
    // Floating logo effect
    anime({
      targets: '.logo-3d',
      translateY: [-10, 10],
      rotateZ: [-2, 2],
      duration: 4000,
      loop: true,
      direction: 'alternate',
      easing: 'easeInOutSine'
    });

    // Background gradient shift
    anime({
      targets: '.gradient-bg',
      background: [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      ],
      duration: 8000,
      loop: true,
      easing: 'easeInOutQuad'
    });
  };

  // 3D Card hover effects
  const animate3DCardHover = (element, isHovering) => {
    anime({
      targets: element,
      rotateX: isHovering ? -5 : 0,
      rotateY: isHovering ? 5 : 0,
      translateZ: isHovering ? 20 : 0,
      scale: isHovering ? 1.05 : 1,
      duration: 300,
      easing: 'easeOutQuart'
    });
  };

  // Alert animation effects
  const triggerAlertAnimation = (severity) => {
    const colors = {
      warning: '#f59e0b',
      critical: '#ef4444',
      success: '#10b981'
    };

    // Screen flash effect
    const flash = document.createElement('div');
    flash.className = 'fixed inset-0 pointer-events-none z-50';
    flash.style.background = `radial-gradient(circle, ${colors[severity]}20 0%, transparent 70%)`;
    document.body.appendChild(flash);

    anime({
      targets: flash,
      opacity: [0, 0.8, 0],
      duration: 500,
      easing: 'easeInOutQuad',
      complete: () => flash.remove()
    });

    // Status card dramatic scale
    anime({
      targets: '.status-card',
      scale: [1, 1.1, 1],
      rotateX: [0, 10, 0],
      duration: 600,
      easing: 'easeOutElastic(1, .6)'
    });
  };

  // Tab switching 3D animation
  const animateTabSwitch = (direction) => {
    anime({
      targets: '.tab-content',
      translateX: direction === 'left' ? [-100, 0] : [100, 0],
      rotateY: [direction === 'left' ? -20 : 20, 0],
      opacity: [0, 1],
      duration: 800,
      easing: 'easeOutCubic'
    });
  };

  // Enhanced people count animation
  const animatePeopleCount = (newCount, oldCount) => {
    anime({
      targets: '.people-count-number',
      innerHTML: [oldCount, newCount],
      duration: 1000,
      round: 1,
      easing: 'easeOutBounce',
      update: (anim) => {
        document.querySelector('.people-count-number').innerHTML = Math.round(anim.animatables[0].target.innerHTML);
      }
    });

    // Ripple effect on count change
    const ripple = document.createElement('div');
    ripple.className = 'absolute inset-0 border-4 border-cyan-400 rounded-full opacity-50';
    document.querySelector('.people-count-container').appendChild(ripple);

    anime({
      targets: ripple,
      scale: [0, 3],
      opacity: [0.5, 0],
      duration: 800,
      easing: 'easeOutQuad',
      complete: () => ripple.remove()
    });
  };

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
        
        // Success animation
        triggerAlertAnimation('success');
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
      const oldCount = detectedPeople;
      setDetectedPeople(currentPeopleCount);

      // Animate count change
      if (currentPeopleCount !== oldCount) {
        animatePeopleCount(currentPeopleCount, oldCount);
      }

      // Add to recent activities if count changes
      if (recentActivities.length === 0 || recentActivities[0].count !== currentPeopleCount) {
        setRecentActivities(prevActivities => [
          { timestamp: new Date().toLocaleTimeString(), count: currentPeopleCount },
          ...prevActivities.slice(0, 9)
        ]);
      }

      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, videoWidth, videoHeight);
      ctx.font = '16px Arial';
      ctx.strokeStyle = '#00ffff';
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

      // Check for alert conditions
      const currentTime = Date.now();
      const timeSinceLastAlert = currentTime - lastAlertTimeRef.current;
      const cooldownActive = alertCooldownRef.current || timeSinceLastAlert < (ALERT_COOLDOWN_SECONDS * 1000);

      if (!cooldownActive && currentPeopleCount >= CRITICAL_DENSITY_THRESHOLD) {
        alertCooldownRef.current = true;
        lastAlertTimeRef.current = currentTime;

        setAlertStatus('alerting');
        triggerAlertAnimation('critical');
        sendAlert(`Critical stampede risk! ${currentPeopleCount} people detected.`, currentPeopleCount);
        setAlertCooldown(true);

        setTimeout(() => {
          alertCooldownRef.current = false;
          setAlertCooldown(false);
        }, ALERT_COOLDOWN_SECONDS * 1000);
      } else if (currentPeopleCount >= HIGH_DENSITY_THRESHOLD) {
        setAlertStatus('warning');
        triggerAlertAnimation('warning');
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
  }, [model, webcamEnabled, recentActivities, detectedPeople, sendAlert]);

  // Function to send alert to backend
  const sendAlert = async (message, crowdDensity) => {
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
        triggerAlertAnimation('success');
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
    
    // 3D button animation
    anime({
      targets: '.webcam-toggle',
      rotateY: [0, 360],
      scale: [1, 1.2, 1],
      duration: 800,
      easing: 'easeOutElastic(1, .6)'
    });
  };

  // SOS Reports Management Functions (keeping existing functionality)
  const fetchSOSReports = useCallback(async () => {
    if (activeTab !== 'sos-alerts') return;

    try {
      setSOSLoading(true);
      console.log('🔥 Starting SOS reports Firebase connection...');

      const connectionTest = await testFirestoreConnection();
      if (!connectionTest.success) {
        console.error('❌ Firebase connection test failed:', connectionTest.error);
        setSOSLoading(false);
        return;
      }

      console.log('✅ Firebase connection test passed!');
      console.log('🔥 Setting up Firebase real-time listener for SOS reports...');

      const unsubscribe = listenToSOSReports((reports) => {
        console.log('🔥 Firebase Listener Triggered!');
        console.log('📥 Raw Firebase data received:', reports);
        console.log('📊 Number of reports:', reports ? reports.length : 'undefined');

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

        const transformedReports = reports.map(report => {
          console.log('🔄 Transforming report:', report.id, report);

          return {
            _id: report.id,
            userId: report.userId || 'unknown',
            userInfo: {
              name: `User ${report.userId.slice(-4)}` || 'Anonymous User',
              phone: '+91-XXXX-XXXX',
              email: 'user@example.com'
            },
            incident: {
              videoUrl: report.videoUrl || '',
              videoThumbnail: report.videoThumbnail || '',
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
            status: 'pending',
            metadata: {
              priority: 'high',
              category: 'emergency',
              firebaseDocId: report.id
            }
          };
        });

        setSOSReports(transformedReports);
        setSOSLoading(false);
      });

      return unsubscribe;

    } catch (error) {
      console.error('❌ Error setting up Firebase listener:', error);
      setSOSLoading(false);

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

      const currentReport = sosReports.find(report => report._id === sosId);

      const adminNotes = decision === 'approved'
        ? 'Emergency verified, sending alerts to nearby users'
        : 'Report does not meet emergency criteria';

      await updateSOSStatus(sosId, decision, adminNotes);

      if (decision === 'approved' && currentReport) {
        console.log('📱 Sending WhatsApp notifications...');

        const whatsappResult = await sendWhatsAppNotifications(currentReport, { adminNotes });

        if (whatsappResult.success) {
          alert(`🚨 SOS Report APPROVED!\n\n🚨 Emergency alerts sent successfully!\n\n📱 WhatsApp notifications sent to ${whatsappResult.recipientCount} nearby users\n📍 Location: ${currentReport.incident?.location?.address || 'Location not available'}\n⏰ Time: ${new Date().toLocaleString()}\n\n✅ Notifications include:\n• Emergency location details\n• Google Maps link\n• Safety instructions\n• Emergency contact info\n\nUsers within 1km radius have been notified via WhatsApp! 📲`);
        } else {
          alert(`✅ SOS Report APPROVED!\n\n⚠️ WhatsApp notification failed: ${whatsappResult.error}\n\nReport status updated in Firebase successfully.`);
        }
      } else {
        alert(`❌ SOS Report REJECTED\n\nThe report has been reviewed and rejected.\n📝 Admin Notes: ${adminNotes}\n✅ Status updated in Firebase Firestore.`);
      }

      setSOSReports(prev => prev.filter(report => report._id !== sosId));
      setSelectedSOSReport(null);

      console.log(`✅ SOS report ${sosId} ${decision} successfully`);

    } catch (error) {
      console.error('❌ Error reviewing SOS report:', error);

      if (decision === 'approved') {
        alert(`✅ SOS Report APPROVED! (Offline Mode)\n\n⚠️ Firebase connection issue, but in a real system:\n\n📱 WhatsApp notifications would be sent to nearby users\n📍 Location alerts would be distributed\n🚨 Emergency services would be notified\n\nFirebase Error: ${error.message}`);
      } else {
        alert(`❌ SOS Report REJECTED (Offline Mode)\n\nThe report has been reviewed and rejected.\n⚠️ Firebase unavailable - changes not persisted.\n\nError: ${error.message}`);
      }

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
        animateTabSwitch('right');
      } else {
        console.log('ℹ️ Not on SOS alerts tab - skipping Firebase connection');
        animateTabSwitch('left');
      }
    };

    setupListener();

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
    <div ref={appRef} className="min-h-screen gradient-bg relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 75%, #f5576c 100%)',
      perspective: '1000px'
    }}>
      {/* Advanced 3D Background Elements */}
      <div className="absolute inset-0 opacity-20" style={{transform: 'translateZ(-50px)'}}>
        <div className="absolute top-10 left-10 w-96 h-96 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse float-animation"></div>
        <div className="absolute top-40 right-10 w-80 h-80 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-700" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-40 left-1/2 w-72 h-72 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-1000" style={{animationDelay: '4s'}}></div>
        <div className="absolute bottom-10 right-1/4 w-64 h-64 bg-gradient-to-r from-green-400 to-teal-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{animationDelay: '6s'}}></div>
      </div>

      {/* Holographic Grid Overlay */}
      <div className="absolute inset-0 opacity-10"
           style={{
             backgroundImage: `
               linear-gradient(rgba(0,255,255,0.3) 1px, transparent 1px), 
               linear-gradient(90deg, rgba(0,255,255,0.3) 1px, transparent 1px),
               radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 1px, transparent 1px)
             `,
             backgroundSize: '60px 60px, 60px 60px, 30px 30px',
             transform: 'rotateX(45deg) rotateY(15deg) scale(1.2)'
           }}>
      </div>

      <div className="relative z-10 flex flex-col items-center p-6 min-h-screen tab-content">
        {/* Futuristic 3D Header */}
        <header ref={headerRef} className="w-full max-w-6xl flex items-center justify-between py-6 px-8 mb-8" style={{transform: 'translateZ(20px)'}}>
          <div className="flex items-center space-x-4">
            <div className="logo-3d p-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-3xl shadow-2xl shadow-cyan-400/50 relative" style={{transform: 'rotateY(10deg)'}}>
              <Shield size={40} className="text-white" />
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-3xl blur-xl opacity-60 animate-pulse"></div>
            </div>
            <div className="transform" style={{transform: 'rotateY(-5deg)'}}>
              <h1 className="text-5xl font-black bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent text-glow">
                STAMPEDE GUARD 3D
              </h1>
              <p className="text-cyan-300 text-sm font-medium mt-1">Advanced AI-Powered 3D Crowd Monitoring System</p>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            {/* 3D Tab Navigation */}
            <div className="flex items-center space-x-2 bg-black/40 backdrop-blur-3xl rounded-3xl p-3 border border-gray-700/50 shadow-2xl" style={{transform: 'rotateY(-10deg)'}}>
              <button
                onClick={() => setActiveTab('monitoring')}
                onMouseEnter={(e) => animate3DCardHover(e.target, true)}
                onMouseLeave={(e) => animate3DCardHover(e.target, false)}
                className={`flex items-center space-x-3 px-6 py-3 rounded-2xl transition-all duration-500 transform ${
                  activeTab === 'monitoring'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-2xl'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <Activity size={24} />
                <span className="font-bold">Live Monitor 3D</span>
              </button>

              <button
                onClick={() => setActiveTab('sos-alerts')}
                onMouseEnter={(e) => animate3DCardHover(e.target, true)}
                onMouseLeave={(e) => animate3DCardHover(e.target, false)}
                className={`relative flex items-center space-x-3 px-6 py-3 rounded-2xl transition-all duration-500 transform ${
                  activeTab === 'sos-alerts'
                    ? 'bg-gradient-to-r from-red-500 to-orange-600 text-white shadow-2xl'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <Bell size={24} />
                <span className="font-bold">SOS Alerts</span>
                {sosReports.length > 0 && (
                  <span className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white text-sm rounded-full flex items-center justify-center animate-bounce">
                    {sosReports.length}
                  </span>
                )}
              </button>
            </div>

            {/* 3D Status Indicator */}
            <div className="flex items-center space-x-3 bg-black/30 backdrop-blur-xl rounded-2xl px-4 py-3 border border-cyan-400/30" style={{transform: 'rotateY(5deg)'}}>
              <div className={`w-4 h-4 rounded-full ${webcamEnabled ? 'bg-green-400' : 'bg-red-400'} shadow-lg animate-pulse`}></div>
              <span className="text-white font-bold text-lg">
                {webcamEnabled ? 'SYSTEM ACTIVE' : 'STANDBY MODE'}
              </span>
            </div>

            {/* 3D Control Button */}
            {activeTab === 'monitoring' && (
              <button
                onClick={toggleWebcam}
                onMouseEnter={(e) => animate3DCardHover(e.target, true)}
                onMouseLeave={(e) => animate3DCardHover(e.target, false)}
                className={`webcam-toggle relative p-5 rounded-3xl backdrop-blur-3xl transition-all duration-500 transform hover:scale-110 ${
                  webcamEnabled
                    ? 'bg-red-500/30 border-2 border-red-400/50 shadow-2xl shadow-red-500/40'
                    : 'bg-green-500/30 border-2 border-green-400/50 shadow-2xl shadow-green-500/40'
                }`}
                title={webcamEnabled ? "Disable 3D Monitoring" : "Enable 3D Monitoring"}
                style={{transform: 'rotateY(-15deg) rotateX(5deg)'}}
              >
                {webcamEnabled ? (
                  <EyeOff size={32} className="text-red-300" />
                ) : (
                  <Camera size={32} className="text-green-300" />
                )}
                <span className="absolute -top-3 -right-3 w-8 h-8 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                  <Zap size={16} className="text-white" />
                </span>
              </button>
            )}
          </div>
        </header>

        {/* Main 3D Content Area */}
        {activeTab === 'monitoring' ? (
          <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main 3D Video Feed */}
          <div className="lg:col-span-2">
            <div className="animate-card bg-black/40 backdrop-blur-3xl rounded-3xl border-2 border-cyan-400/30 overflow-hidden shadow-2xl shadow-cyan-500/20 neon-border"
                 style={{transform: 'perspective(1000px) rotateY(-5deg)'}}>
              {/* Video Header */}
              <div className="bg-gradient-to-r from-cyan-500/30 to-blue-600/30 p-6 border-b border-cyan-400/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Activity className="text-cyan-400" size={32} />
                    <span className="text-white font-bold text-2xl">3D Live Feed</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                    <span className="text-red-300 text-lg font-bold">RECORDING</span>
                  </div>
                </div>
              </div>

              {/* 3D Video Content */}
              <div className="relative aspect-video bg-black video-container">
                {/* Enhanced Loading overlay */}
                {loadingModel && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-xl z-20">
                    <div className="text-center">
                      <div className="relative mb-8">
                        <Loader2 className="animate-spin text-cyan-400 mx-auto enhanced-spin" size={80} />
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full blur-2xl opacity-60 animate-pulse"></div>
                      </div>
                      <p className="text-3xl font-black text-white mb-4 text-glow">Initializing 3D AI Model</p>
                      <p className="text-cyan-300 text-lg">Advanced neural networks loading...</p>
                      <div className="mt-6 w-80 h-3 bg-gray-700 rounded-full mx-auto overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Enhanced Webcam off overlay */}
                {!webcamEnabled && !loadingModel && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800/60 to-blue-900/60 backdrop-blur-xl">
                    <div className="relative">
                      <Camera size={120} className="text-gray-400 mb-8 float-animation" />
                      <div className="absolute inset-0 bg-gradient-to-r from-gray-400 to-blue-400 rounded-full blur-2xl opacity-40 animate-pulse"></div>
                    </div>
                    <p className="text-3xl font-black text-white mb-4 text-glow">3D Monitoring Standby</p>
                    <p className="text-blue-300 text-center max-w-md text-lg">
                      Activate the 3D camera system to begin advanced crowd detection
                    </p>
                  </div>
                )}

                {/* Enhanced Webcam and Canvas Container */}
                {webcamEnabled && !loadingModel && (
                  <div className="relative w-full h-full" style={{transform: 'rotateY(2deg)'}}>
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
                        transform: 'scaleX(-1)',
                        filter: 'brightness(1.1) contrast(1.2) saturate(1.3)'
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
                        alert("Error accessing webcam. Please ensure you've granted camera permissions.");
                      }}
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0"
                      style={{
                        width: '100%',
                        height: '100%',
                        transform: 'scaleX(-1)',
                        filter: 'drop-shadow(0 0 10px cyan)'
                      }}
                    />
                    
                    {/* Enhanced HUD Overlay */}
                    <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
                      <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-cyan-400/40 shadow-xl">
                        <div className="text-cyan-400 text-lg font-bold">3D AI DETECTION</div>
                        <div className="text-white text-sm">TensorFlow.js COCO-SSD Enhanced</div>
                      </div>
                      <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-cyan-400/40 shadow-xl">
                        <div className="text-cyan-400 text-lg font-bold">TIMESTAMP</div>
                        <div className="text-white text-sm">{new Date().toLocaleTimeString()}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Enhanced 3D Sidebar */}
          <div className="space-y-8">
            {/* Enhanced 3D People Count Display */}
            <div className={`animate-card status-card people-count-container relative bg-gradient-to-r ${getStatusColor()} rounded-3xl p-8 text-center overflow-hidden ${getGlowEffect()} transform`}
                 style={{transform: 'perspective(800px) rotateY(10deg) rotateX(-5deg)'}}>
              <div className="absolute inset-0 bg-white/10 backdrop-blur-xl"></div>
              <div className="relative z-10">
                <Users className="text-white/90 mx-auto mb-6" size={64} />
                <p className="text-white/90 text-2xl font-bold mb-4">People Detected</p>
                <p className="people-count-number text-white text-8xl font-black mb-6 tracking-tight text-glow">
                  {detectedPeople}
                </p>
                <div className={`inline-flex items-center space-x-3 px-6 py-3 rounded-full ${
                  detectedPeople >= CRITICAL_DENSITY_THRESHOLD 
                    ? 'bg-red-500/40 border-2 border-red-300/50' 
                    : detectedPeople >= HIGH_DENSITY_THRESHOLD 
                    ? 'bg-yellow-500/40 border-2 border-yellow-300/50'
                    : 'bg-green-500/40 border-2 border-green-300/50'
                }`}>
                  {detectedPeople >= CRITICAL_DENSITY_THRESHOLD && <AlertTriangle size={20} className="text-white animate-bounce" />}
                  <span className="text-white font-black text-lg">
                    {getCurrentStatusText()}
                  </span>
                </div>
              </div>
              
              {/* Enhanced animated rings */}
              {detectedPeople >= CRITICAL_DENSITY_THRESHOLD && (
                <>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 border-4 border-red-300/40 rounded-full animate-ping"></div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-52 h-52 border-4 border-red-300/30 rounded-full animate-ping delay-150"></div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-4 border-red-300/20 rounded-full animate-ping delay-300"></div>
                </>
              )}
            </div>

            {/* Enhanced 3D System Status */}
            <div className="animate-card bg-black/40 backdrop-blur-3xl rounded-3xl border border-gray-700/50 p-8 shadow-xl"
                 style={{transform: 'perspective(600px) rotateY(-8deg)'}}>
              <h3 className="text-white font-black text-2xl mb-6 flex items-center">
                <Shield className="text-cyan-400 mr-4" size={32} />
                3D System Status
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-lg">AI Model</span>
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${model ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-red-400 shadow-lg shadow-red-400/50'} animate-pulse`}></div>
                    <span className={`text-lg font-bold ${model ? 'text-green-400' : 'text-red-400'}`}>
                      {model ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-lg">3D Camera Feed</span>
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${webcamEnabled ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-gray-400'} animate-pulse`}></div>
                    <span className={`text-lg font-bold ${webcamEnabled ? 'text-green-400' : 'text-gray-400'}`}>
                      {webcamEnabled ? 'Active' : 'Standby'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-lg">Alert System</span>
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${alertCooldown ? 'bg-yellow-400 shadow-lg shadow-yellow-400/50' : 'bg-green-400 shadow-lg shadow-green-400/50'} animate-pulse`}></div>
                    <span className={`text-lg font-bold ${alertCooldown ? 'text-yellow-400' : 'text-green-400'}`}>
                      {alertCooldown ? 'Cooldown' : 'Ready'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced 3D Activity Log */}
            <div className="animate-card bg-black/40 backdrop-blur-3xl rounded-3xl border border-gray-700/50 p-8 shadow-xl"
                 style={{transform: 'perspective(600px) rotateY(5deg)'}}>
              <h3 className="text-white font-black text-2xl mb-6 flex items-center">
                <Activity className="text-cyan-400 mr-4" size={32} />
                3D Activity Log
              </h3>
              
              <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-3">
                {recentActivities.length > 0 ? (
                  recentActivities.map((activity, index) => (
                    <div key={index} className="flex justify-between items-center p-4 bg-gray-800/40 rounded-2xl border border-gray-700/40 shadow-lg transform hover:scale-105 transition-all duration-300">
                      <span className="text-gray-400 text-sm font-mono">{activity.timestamp}</span>
                      <span className={`font-bold text-lg px-3 py-2 rounded-xl ${
                        activity.count >= CRITICAL_DENSITY_THRESHOLD 
                          ? 'bg-red-500/30 text-red-300 border border-red-500/40 shadow-red-500/30'
                          : activity.count >= HIGH_DENSITY_THRESHOLD 
                          ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 shadow-yellow-500/30'
                          : 'bg-green-500/30 text-green-300 border border-green-500/40 shadow-green-500/30'
                      } shadow-lg`}>
                        {activity.count} detected
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Users className="text-gray-600 mx-auto mb-4 float-animation" size={64} />
                    <p className="text-gray-500 text-lg">No activity recorded</p>
                    <p className="text-gray-600 text-sm">Enable 3D monitoring to start</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        ) : (
          /* Enhanced 3D SOS Alerts Management */
          <div className="w-full max-w-6xl tab-content">
            {/* Active Alerts Banner */}
            {activeAlerts.length > 0 && (
              <div className="mb-8 bg-gradient-to-r from-red-500/30 to-orange-600/30 backdrop-blur-3xl rounded-3xl border-2 border-red-500/50 p-6 danger-pulse transform"
                   style={{transform: 'perspective(800px) rotateX(-5deg)'}}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-red-500 rounded-2xl animate-bounce">
                      <AlertTriangle className="text-white" size={28} />
                    </div>
                    <div>
                      <h3 className="text-red-300 font-black text-2xl">🚨 Active Emergency Alerts</h3>
                      <p className="text-red-200 text-lg">{activeAlerts.length} alert{activeAlerts.length !== 1 ? 's' : ''} currently active</p>
                    </div>
                  </div>
                  <div className="text-red-300">
                    <div className="w-4 h-4 bg-red-400 rounded-full animate-ping"></div>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {activeAlerts.slice(0, 3).map((alert) => (
                    <div key={alert.id} className="bg-black/40 rounded-2xl p-4 border border-red-500/40">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-bold text-lg">{alert.title}</p>
                          <p className="text-red-200">{alert.location?.address || 'Location not specified'}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-3 py-2 rounded-xl text-sm font-bold ${
                            alert.severity === 'high' ? 'bg-red-500/40 text-red-300' :
                            alert.severity === 'medium' ? 'bg-yellow-500/40 text-yellow-300' :
                            'bg-green-500/40 text-green-300'
                          }`}>
                            {alert.severity?.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {activeAlerts.length > 3 && (
                    <p className="text-red-300 text-center">
                      +{activeAlerts.length - 3} more active alerts
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Enhanced 3D SOS Reports List */}
              <div className="lg:col-span-2">
                <div className="animate-card bg-black/40 backdrop-blur-3xl rounded-3xl border-2 border-gray-700/50 overflow-hidden shadow-2xl"
                     style={{transform: 'perspective(1000px) rotateY(-3deg)'}}>
                  <div className="p-8 border-b border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-3xl font-black text-white flex items-center space-x-4">
                          <AlertTriangle className="text-red-400" size={36} />
                          <span>3D Emergency SOS Reports</span>
                        </h2>
                        <div className="flex items-center space-x-3 mt-2">
                          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                          <span className="text-sm text-green-400 font-bold">Real-time Firebase Firestore</span>
                          <span className="text-sm text-gray-500">•</span>
                          <span className="text-sm text-gray-400">Project: crowd-monitoring-e1f70</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-gray-400 text-lg">
                          {sosReports.length} pending review{sosReports.length !== 1 ? 's' : ''}
                        </span>
                        <button
                          onClick={() => setShowCreateAlert(true)}
                          onMouseEnter={(e) => animate3DCardHover(e.target, true)}
                          onMouseLeave={(e) => animate3DCardHover(e.target, false)}
                          className="flex items-center space-x-3 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white px-6 py-3 rounded-2xl transition-all font-bold transform"
                          title="Create New Alert"
                        >
                          <Plus size={20} />
                          <span>Create Alert</span>
                        </button>
                        <button
                          onClick={fetchSOSReports}
                          onMouseEnter={(e) => animate3DCardHover(e.target, true)}
                          onMouseLeave={(e) => animate3DCardHover(e.target, false)}
                          className="p-3 bg-blue-600 hover:bg-blue-700 rounded-2xl transition-colors transform"
                          title="Refresh Firebase Data"
                        >
                          <Activity size={20} className="text-white" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {sosLoading ? (
                    <div className="p-12 text-center">
                      <div className="animate-spin mx-auto mb-6 w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full enhanced-spin"></div>
                      <p className="text-gray-400 text-xl">Loading SOS reports...</p>
                    </div>
                  ) : sosReports.length === 0 ? (
                    <div className="p-12 text-center">
                      <CheckCircle className="mx-auto mb-6 text-green-500 float-animation" size={64} />
                      <p className="text-gray-400 text-2xl font-bold">No pending SOS reports</p>
                      <p className="text-gray-500 text-lg mt-3">All emergency reports have been reviewed</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-700/50">
                      {sosReports.map((report) => (
                        <div
                          key={report._id}
                          className={`p-8 hover:bg-gray-800/50 transition-all cursor-pointer transform hover:scale-105 ${
                            selectedSOSReport?._id === report._id ? 'bg-blue-900/40 border-l-4 border-blue-500' : ''
                          }`}
                          onClick={() => setSelectedSOSReport(report)}
                        >
                          <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center space-x-4">
                              <div className={`px-4 py-2 rounded-full text-sm font-bold border ${getPriorityColor(report.metadata.priority)}`}>
                                🚨 {report.metadata.priority.toUpperCase()} PRIORITY
                              </div>
                              <div className="px-3 py-2 bg-orange-900/40 border border-orange-500/50 rounded-full text-sm font-bold text-orange-300">
                                PENDING REVIEW
                              </div>
                            </div>
                            <span className="text-gray-400 text-lg">{formatTimeAgo(report.incident.timestamp)}</span>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center space-x-3 text-gray-300">
                              <Users size={20} />
                              <span className="font-bold text-white text-lg">{report.userInfo.name}</span>
                              <span className="text-gray-500">•</span>
                              <span className="text-gray-400">{report.userInfo.phone}</span>
                            </div>

                            <div className="flex items-center space-x-3 text-gray-300">
                              <MapPin size={20} />
                              <span className="text-lg">{report.incident.location.address || 'Location unavailable'}</span>
                            </div>

                            <div className="flex items-start space-x-3 text-gray-300">
                              <MessageSquare size={20} className="mt-1" />
                              <span className="text-lg">{report.incident.message}</span>
                            </div>

                            <div className="flex items-center space-x-6 text-gray-400 text-lg">
                              <div className="flex items-center space-x-2">
                                <Clock size={18} />
                                <span>Video: {report.incident.videoDuration}s</span>
                              </div>
                              <div className="flex items-center space-x-2 bg-green-900/40 px-3 py-2 rounded border border-green-500/50">
                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                <span className="text-green-400 text-sm">Firebase Storage</span>
                              </div>
                              <span className="capitalize bg-gray-800/50 px-3 py-2 rounded text-cyan-300">
                                {report.metadata.category}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-4 mt-8">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSOSReview(report._id, 'approved');
                              }}
                              onMouseEnter={(e) => animate3DCardHover(e.target, true)}
                              onMouseLeave={(e) => animate3DCardHover(e.target, false)}
                              disabled={sosProcessing[report._id]}
                              className="flex items-center space-x-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-4 rounded-2xl text-lg transition-all font-bold transform"
                            >
                              <CheckCircle size={20} />
                              <span>APPROVE & DISPATCH EMERGENCY SERVICES</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSOSReview(report._id, 'rejected');
                              }}
                              onMouseEnter={(e) => animate3DCardHover(e.target, true)}
                              onMouseLeave={(e) => animate3DCardHover(e.target, false)}
                              disabled={sosProcessing[report._id]}
                              className="flex items-center space-x-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-4 rounded-2xl text-lg transition-all font-bold transform"
                            >
                              <XCircle size={20} />
                              <span>❌ REJECT</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced 3D Selected Report Detail - keeping existing functionality but with 3D styling */}
              <div className="lg:col-span-1">
                {selectedSOSReport ? (
                  <div className="animate-card bg-black/40 backdrop-blur-3xl rounded-3xl border-2 border-gray-700/50 overflow-hidden shadow-2xl"
                       style={{transform: 'perspective(800px) rotateY(8deg)'}}>
                    <div className="p-6 border-b border-gray-700/50">
                      <h3 className="text-2xl font-black text-white">Emergency Details</h3>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Video Player - keeping existing functionality */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-white flex items-center space-x-3 text-lg">
                          <Play size={20} className="text-red-400" />
                          <span>Emergency Video</span>
                          <div className="flex items-center space-x-2 ml-3">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-xs text-green-400 font-bold">Firebase Storage</span>
                          </div>
                        </h4>
                        <div className="bg-blue-900/30 border border-blue-500/40 rounded-2xl p-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-blue-300">🔗 Storage Bucket:</span>
                            <span className="text-blue-200 font-mono">crowd-monitoring-e1f70</span>
                          </div>
                          <div className="flex items-center justify-between text-sm mt-1">
                            <span className="text-blue-300">📁 Project ID:</span>
                            <span className="text-blue-200 font-mono">crowd-monitoring-e1f70</span>
                          </div>
                        </div>
                        <div className="relative bg-black rounded-2xl overflow-hidden aspect-video border-2 border-green-500/40 shadow-xl">
                          {selectedSOSReport.incident.videoUrl ? (
                            <video
                              src={selectedSOSReport.incident.videoUrl}
                              controls
                              className="w-full h-full object-cover"
                              poster={selectedSOSReport.incident.videoThumbnail}
                              onLoadStart={() => console.log('🎥 Loading video from Firebase Storage:', selectedSOSReport.incident.videoUrl)}
                              onCanPlay={() => console.log('✅ Video loaded successfully from Firebase')}
                              onError={(e) => console.error('❌ Video loading error:', e)}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-800">
                              <div className="text-center">
                                <AlertTriangle className="mx-auto mb-3 text-yellow-500" size={40} />
                                <p className="text-gray-400 text-lg">Video not available</p>
                                <p className="text-gray-500 text-sm">Firebase Storage URL missing</p>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setShowVideoModal(true)}
                            onMouseEnter={(e) => animate3DCardHover(e.target, true)}
                            onMouseLeave={(e) => animate3DCardHover(e.target, false)}
                            className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 transform"
                          >
                            <ExternalLink size={16} />
                            <span>Open full screen</span>
                          </button>
                          {selectedSOSReport.incident.videoUrl && (
                            <div className="flex items-center space-x-2 text-green-400 text-sm">
                              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                              <span>Streamed from Firebase</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* User Information - keeping existing content */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-white text-lg">Reporter Information</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Name:</span>
                            <span className="text-white font-bold">{selectedSOSReport.userInfo.name}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Phone:</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-white font-mono">{selectedSOSReport.userInfo.phone}</span>
                              <button className="text-green-400 hover:text-green-300">
                                <Phone size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Email:</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-white">{selectedSOSReport.userInfo.email}</span>
                              <button className="text-blue-400 hover:text-blue-300">
                                <Mail size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Location Information - keeping existing content */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-white text-lg">Location Details</h4>
                        <div className="space-y-2">
                          <div>
                            <span className="text-gray-400">Address:</span>
                            <p className="text-white mt-1 bg-gray-800/50 p-3 rounded-xl">{selectedSOSReport.incident.location.address || 'Address not available'}</p>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Coordinates:</span>
                            <span className="text-white font-mono text-sm">
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
                          onMouseEnter={(e) => animate3DCardHover(e.target, true)}
                          onMouseLeave={(e) => animate3DCardHover(e.target, false)}
                          className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 bg-blue-900/30 px-4 py-3 rounded-2xl w-full justify-center transform"
                        >
                          <MapPin size={16} />
                          <span>View on Google Maps</span>
                        </button>
                      </div>

                      {/* Firebase Metadata - keeping existing content */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-white text-lg">Firebase Details</h4>
                        <div className="bg-gray-800/50 rounded-2xl p-4 space-y-2 text-sm">
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
                            <span className="text-orange-300 font-bold">{selectedSOSReport.status}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Firebase Project:</span>
                            <span className="text-green-300 font-mono text-xs">crowd-monitoring-e1f70</span>
                          </div>
                        </div>
                      </div>

                      {/* Enhanced 3D Emergency Actions */}
                      <div className="space-y-4">
                        <h4 className="font-black text-white text-2xl">🚨 EMERGENCY ACTIONS</h4>
                        <div className="space-y-4">
                          <button
                            onClick={() => handleSOSReview(selectedSOSReport._id, 'approved')}
                            onMouseEnter={(e) => animate3DCardHover(e.target, true)}
                            onMouseLeave={(e) => animate3DCardHover(e.target, false)}
                            disabled={sosProcessing[selectedSOSReport._id]}
                            className="w-full flex items-center justify-center space-x-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-5 rounded-2xl transition-all font-black text-xl transform"
                          >
                            <CheckCircle size={32} />
                            <span>APPROVE & DISPATCH EMERGENCY SERVICES</span>
                          </button>

                          <button
                            onClick={() => handleSOSReview(selectedSOSReport._id, 'rejected')}
                            onMouseEnter={(e) => animate3DCardHover(e.target, true)}
                            onMouseLeave={(e) => animate3DCardHover(e.target, false)}
                            disabled={sosProcessing[selectedSOSReport._id]}
                            className="w-full flex items-center justify-center space-x-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-5 rounded-2xl transition-all font-black text-xl transform"
                          >
                            <XCircle size={32} />
                            <span>❌ REJECT REPORT</span>
                          </button>
                        </div>

                        <div className="bg-yellow-900/40 border-2 border-yellow-500/50 rounded-2xl p-4 text-sm">
                          <p className="text-yellow-300 font-bold mb-2">⚠️ Emergency Dispatch Action:</p>
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
                  <div className="animate-card bg-black/40 backdrop-blur-3xl rounded-3xl border-2 border-gray-700/50 p-12 text-center shadow-xl"
                       style={{transform: 'perspective(600px) rotateY(10deg)'}}>
                    <AlertTriangle className="mx-auto mb-6 text-gray-500 float-animation" size={64} />
                    <p className="text-gray-400 text-xl">Select an SOS report to view details</p>
                    <p className="text-gray-500 text-lg mt-3">Click on any pending report to review emergency details</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Enhanced 3D Video Modal - keeping existing functionality */}
        {showVideoModal && selectedSOSReport && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6 backdrop-blur-xl">
            <div className="bg-black rounded-3xl overflow-hidden max-w-6xl w-full max-h-[90vh] border-2 border-green-500/40 shadow-2xl transform"
                 style={{transform: 'perspective(1200px) rotateY(-2deg)'}}>
              <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <h3 className="text-white font-black text-2xl">Emergency Video - {selectedSOSReport.userInfo.name}</h3>
                  <div className="flex items-center space-x-3 bg-green-900/40 px-3 py-2 rounded border border-green-500/50">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-green-400 text-sm font-bold">Firebase Storage</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowVideoModal(false)}
                  onMouseEnter={(e) => animate3DCardHover(e.target, true)}
                  onMouseLeave={(e) => animate3DCardHover(e.target, false)}
                  className="text-gray-400 hover:text-white transform"
                >
                  <XCircle size={32} />
                </button>
              </div>
              <div className="p-6">
                {selectedSOSReport.incident.videoUrl ? (
                  <video
                    src={selectedSOSReport.incident.videoUrl}
                    controls
                    autoPlay
                    className="w-full h-auto rounded-2xl"
                    poster={selectedSOSReport.incident.videoThumbnail}
                    onLoadStart={() => console.log('🎥 Full screen video loading from Firebase Storage')}
                    onCanPlay={() => console.log('✅ Full screen video ready to play')}
                  />
                ) : (
                  <div className="w-full h-96 flex items-center justify-center bg-gray-800 rounded-2xl">
                    <div className="text-center">
                      <AlertTriangle className="mx-auto mb-6 text-yellow-500" size={64} />
                      <p className="text-gray-400 text-2xl mb-3">Video not available</p>
                      <p className="text-gray-500 text-lg">Firebase Storage URL missing or invalid</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Enhanced 3D Alert Messages */}
        {alertStatus === 'error' && (
          <div className="fixed bottom-8 right-8 bg-red-500/30 backdrop-blur-3xl border-2 border-red-400/50 rounded-3xl p-6 shadow-2xl shadow-red-500/40 animate-bounce danger-pulse">
            <div className="flex items-center space-x-4">
              <XCircle size={32} className="text-red-400" />
              <div>
                <p className="text-red-300 font-black text-lg">System Error</p>
                <p className="text-red-400">Check console for details</p>
              </div>
            </div>
          </div>
        )}

        {alertStatus === 'no-webcam' && (
          <div className="fixed bottom-8 right-8 bg-yellow-500/30 backdrop-blur-3xl border-2 border-yellow-400/50 rounded-3xl p-6 shadow-2xl shadow-yellow-500/40 animate-bounce">
            <div className="flex items-center space-x-4">
              <WifiOff size={32} className="text-yellow-400" />
              <div>
                <p className="text-yellow-300 font-black text-lg">Camera Access Required</p>
                <p className="text-yellow-400">Grant webcam permissions</p>
              </div>
            </div>
          </div>
        )}

        {alertStatus === 'sent' && (
          <div className="fixed bottom-8 right-8 bg-green-500/30 backdrop-blur-3xl border-2 border-green-400/50 rounded-3xl p-6 shadow-2xl shadow-green-500/40 animate-bounce">
            <div className="flex items-center space-x-4">
              <CheckCircle size={32} className="text-green-400" />
              <div>
                <p className="text-green-300 font-black text-lg">Alert Sent Successfully!</p>
                <p className="text-green-400">WhatsApp notification delivered</p>
              </div>
            </div>
          </div>
        )}

        {/* Create Alert Form - keeping existing functionality */}
        <CreateAlertForm
          isOpen={showCreateAlert}
          onClose={() => setShowCreateAlert(false)}
          onSuccess={(alertId) => {
            console.log('Alert created successfully:', alertId);
            alert('🚨 Alert Created Successfully!\n\nAlert ID: ' + alertId + '\n\nThe alert has been saved to Firebase and will be distributed to users in the specified area.');
          }}
        />
      </div>
    </div>
  );
}

export default App;
