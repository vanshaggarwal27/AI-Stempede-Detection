// App.jsx - Full 3D Animated Stampede Detection System
import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import { animate, createTimeline } from 'animejs';
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
    if (appRef.current) {
      animate({
        targets: appRef.current,
        opacity: [0, 1],
        scale: [0.8, 1],
        rotateY: [180, 0],
        duration: 1500,
        easing: 'easeOutElastic(1, .8)',
        delay: 100
      });
    }

    // Header dramatic entrance with 3D flip
    if (headerRef.current) {
      animate({
        targets: headerRef.current,
        translateY: [-200, 0],
        rotateX: [90, 0],
        opacity: [0, 1],
        duration: 1200,
        easing: 'easeOutBounce',
        delay: 400
      });
    }

    // Staggered card animations with 3D depth
    setTimeout(() => {
      const cards = document.querySelectorAll('.animate-card');
      cards.forEach((card, index) => {
        animate({
          targets: card,
          translateX: [200, 0],
          rotateY: [45, 0],
          translateZ: [100, 0],
          opacity: [0, 1],
          duration: 1000,
          delay: index * 150 + 600,
          easing: 'easeOutQuart'
        });
      });
    }, 100);

    // Create floating 3D particle system
    createFloatingParticles();
    
    // Start continuous 3D effects
    startContinuous3DEffects();

  }, []);

  // Create floating 3D particles with physics
  const createFloatingParticles = () => {
    const particleContainer = document.createElement('div');
    particleContainer.className = 'fixed inset-0 pointer-events-none z-0';
    particleContainer.style.overflow = 'hidden';
    particleContainer.id = 'particle-container';
    
    // Remove existing container if it exists
    const existing = document.getElementById('particle-container');
    if (existing) existing.remove();
    
    for (let i = 0; i < 100; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle absolute';
      particle.style.cssText = `
        width: ${Math.random() * 4 + 2}px;
        height: ${Math.random() * 4 + 2}px;
        background: radial-gradient(circle, rgba(0,255,255,0.8) 0%, transparent 70%);
        border-radius: 50%;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        box-shadow: 0 0 10px rgba(0,255,255,0.5), 0 0 20px rgba(0,255,255,0.3);
      `;
      
      particleContainer.appendChild(particle);
      particleRefs.current.push(particle);
    }
    
    if (document.body) {
      document.body.appendChild(particleContainer);
    }

    // Animate particles in 3D space with physics
    animate({
      targets: particleRefs.current,
      translateX: () => Math.random() * 400 - 200,
      translateY: () => Math.random() * 400 - 200,
      translateZ: () => Math.random() * 200 - 100,
      rotateX: () => Math.random() * 360,
      rotateY: () => Math.random() * 360,
      rotateZ: () => Math.random() * 360,
      scale: () => Math.random() * 1.5 + 0.5,
      opacity: () => Math.random() * 0.8 + 0.2,
      duration: () => Math.random() * 8000 + 3000,
      loop: true,
      direction: 'alternate',
      easing: 'easeInOutSine',
      delay: (el, i) => i * 50
    });
  };

  // Continuous 3D effects and animations
  const startContinuous3DEffects = () => {
    // Floating logo with complex 3D motion
    animate({
      targets: '.logo-3d',
      translateY: [-15, 15],
      rotateZ: [-3, 3],
      rotateX: [-2, 2],
      scale: [1, 1.05],
      duration: 4000,
      loop: true,
      direction: 'alternate',
      easing: 'easeInOutSine'
    });

    // Dynamic background gradient morphing
    const bgElement = document.querySelector('.gradient-bg');
    if (bgElement) {
      const gradients = [
        'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 75%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 25%, #667eea 50%, #764ba2 100%)',
        'linear-gradient(135deg, #a8edea 0%, #fed6e3 25%, #f093fb 50%, #764ba2 100%)',
        'linear-gradient(135deg, #ff9a9e 0%, #fecfef 25%, #fecfef 50%, #667eea 100%)'
      ];
      
      let currentGradient = 0;
      setInterval(() => {
        currentGradient = (currentGradient + 1) % gradients.length;
        bgElement.style.background = gradients[currentGradient];
      }, 5000);
    }
  };

  // Enhanced 3D card hover effects
  const animate3DCardHover = (element, isHovering) => {
    if (element) {
      animate({
        targets: element,
        rotateX: isHovering ? -10 : 0,
        rotateY: isHovering ? 10 : 0,
        translateZ: isHovering ? 30 : 0,
        scale: isHovering ? 1.08 : 1,
        duration: 400,
        easing: 'easeOutQuart'
      });
    }
  };

  // Spectacular alert animation effects
  const triggerAlertAnimation = (severity) => {
    const colors = {
      warning: '#f59e0b',
      critical: '#ef4444',
      success: '#10b981'
    };

    // Full-screen flash effect with ripples
    const flash = document.createElement('div');
    flash.className = 'fixed inset-0 pointer-events-none z-50';
    flash.style.background = `radial-gradient(circle, ${colors[severity]}30 0%, transparent 70%)`;
    document.body.appendChild(flash);

    animate({
      targets: flash,
      opacity: [0, 1, 0],
      scale: [0.5, 1.2, 1],
      duration: 800,
      easing: 'easeOutQuart',
      complete: () => flash.remove()
    });

    // Status card dramatic 3D transformation
    animate({
      targets: '.status-card',
      scale: [1, 1.15, 1],
      rotateX: [0, 15, 0],
      rotateY: [0, -5, 0],
      translateZ: [0, 50, 0],
      duration: 1000,
      easing: 'easeOutElastic(1, .6)'
    });

    // Screen shake effect
    animate({
      targets: appRef.current,
      translateX: [0, -5, 5, -5, 5, 0],
      duration: 600,
      easing: 'easeOutQuart'
    });
  };

  // Enhanced people count animation with spectacular effects
  const animatePeopleCount = (newCount, oldCount) => {
    const element = document.querySelector('.people-count-number');
    if (element) {
      // Number counting animation
      animate({
        targets: { count: oldCount },
        count: newCount,
        duration: 1500,
        round: 1,
        easing: 'easeOutBounce',
        update: (anim) => {
          element.innerHTML = Math.round(anim.animatables[0].target.count);
        }
      });

      // Spectacular ripple effects
      const container = document.querySelector('.people-count-container');
      if (container) {
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            const ripple = document.createElement('div');
            ripple.className = 'absolute inset-0 border-4 border-cyan-400 rounded-full opacity-60';
            container.appendChild(ripple);

            animate({
              targets: ripple,
              scale: [0, 4],
              opacity: [0.6, 0],
              rotateZ: [0, 180],
              duration: 1200,
              easing: 'easeOutQuart',
              complete: () => ripple.remove()
            });
          }, i * 200);
        }
      }
    }
  };

  // Enhanced tab switching with 3D cube rotation
  const animateTabSwitch = (direction) => {
    const content = document.querySelector('.tab-content');
    if (content) {
      animate({
        targets: content,
        translateX: direction === 'left' ? [-100, 0] : [100, 0],
        rotateY: [direction === 'left' ? -30 : 30, 0],
        opacity: [0, 1],
        scale: [0.9, 1],
        duration: 1000,
        easing: 'easeOutCubic'
      });
    }
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
        
        // Success animation with fireworks effect
        triggerAlertAnimation('success');
        createFireworksEffect();
      } catch (error) {
        console.error('Failed to load COCO-SSD model:', error);
        setLoadingModel(false);
        setAlertStatus('error');
      }
    };

    loadModel();
  }, []);

  // Fireworks effect for successful model loading
  const createFireworksEffect = () => {
    for (let i = 0; i < 20; i++) {
      setTimeout(() => {
        const firework = document.createElement('div');
        firework.style.cssText = `
          position: fixed;
          width: 6px;
          height: 6px;
          background: radial-gradient(circle, #00ff00 0%, transparent 70%);
          border-radius: 50%;
          left: ${Math.random() * window.innerWidth}px;
          top: ${Math.random() * window.innerHeight}px;
          pointer-events: none;
          z-index: 1000;
          box-shadow: 0 0 15px #00ff00;
        `;
        document.body.appendChild(firework);

        animate({
          targets: firework,
          scale: [0, 2, 0],
          opacity: [1, 1, 0],
          duration: 1000,
          easing: 'easeOutQuart',
          complete: () => firework.remove()
        });
      }, i * 100);
    }
  };

  // Function to send alert to backend
  const sendAlert = useCallback(async (message, crowdDensity) => {
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
  }, [BACKEND_URL, ALERT_COOLDOWN_SECONDS]);

  // Enhanced object detection with 3D visualization
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

      // Animate count change with spectacular effects
      if (currentPeopleCount !== oldCount) {
        animatePeopleCount(currentPeopleCount, oldCount);
      }

      // Add to recent activities with animation
      if (recentActivities.length === 0 || recentActivities[0].count !== currentPeopleCount) {
        setRecentActivities(prevActivities => [
          { timestamp: new Date().toLocaleTimeString(), count: currentPeopleCount },
          ...prevActivities.slice(0, 9)
        ]);
      }

      // Enhanced canvas drawing with 3D effects
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, videoWidth, videoHeight);
      ctx.font = 'bold 18px Arial';
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 4;
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 15;

      people.forEach((prediction, index) => {
        const [x, y, width, height] = prediction.bbox;
        
        // Animated detection box with pulsing effect
        const pulseIntensity = Math.sin(Date.now() * 0.01 + index) * 0.5 + 0.5;
        ctx.globalAlpha = 0.8 + pulseIntensity * 0.2;
        
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.stroke();
        
        // Person label with enhanced styling
        const label = `Person ${index + 1} (${Math.round(prediction.score * 100)}%)`;
        ctx.fillText(label, x, y > 30 ? y - 10 : y + height + 25);
        
        ctx.globalAlpha = 1;
      });

      // Alert condition checking with enhanced animations
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

  // Enhanced webcam toggle with 3D button animation
  const toggleWebcam = () => {
    setWebcamEnabled(prev => !prev);
    
    // Spectacular 3D button animation
    animate({
      targets: '.webcam-toggle',
      rotateY: [0, 720],
      scale: [1, 1.3, 1],
      translateZ: [0, 50, 0],
      duration: 1200,
      easing: 'easeOutElastic(1, .6)'
    });
  };

  // SOS Reports Management Functions
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

      const unsubscribe = listenToSOSReports((reports) => {
        if (!reports) {
          setSOSReports([]);
          setSOSLoading(false);
          return;
        }

        if (reports.length === 0) {
          setSOSReports([]);
          setSOSLoading(false);
          return;
        }

        const transformedReports = reports.map(report => ({
          _id: report.id,
          userId: report.userId || 'unknown',
          userInfo: {
            name: `User ${report.userId?.slice(-4) || 'Anonymous'}`,
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
        }));

        setSOSReports(transformedReports);
        setSOSLoading(false);
      });

      return unsubscribe;

    } catch (error) {
      console.error('❌ Error setting up Firebase listener:', error);
      setSOSLoading(false);
      setSOSReports([]);
    }
  }, [activeTab]);

  // Effect to manage the detection loop
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

  // Effect to fetch SOS reports when switching tabs
  useEffect(() => {
    let unsubscribe = null;

    const setupListener = async () => {
      if (activeTab === 'sos-alerts') {
        unsubscribe = await fetchSOSReports();
        animateTabSwitch('right');
      } else {
        animateTabSwitch('left');
      }
    };

    setupListener();

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [fetchSOSReports, activeTab]);

  // Status helper functions
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
    <div 
      ref={appRef} 
      className="min-h-screen gradient-bg relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 75%, #f5576c 100%)',
        perspective: '1000px',
        transformStyle: 'preserve-3d'
      }}
    >
      {/* Advanced 3D Background Elements */}
      <div className="absolute inset-0 opacity-20" style={{transform: 'translateZ(-100px)'}}>
        <div className="absolute top-10 left-10 w-96 h-96 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse morphing-blob"></div>
        <div className="absolute top-40 right-10 w-80 h-80 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-700 morphing-blob"></div>
        <div className="absolute bottom-40 left-1/2 w-72 h-72 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-1000 morphing-blob"></div>
        <div className="absolute bottom-10 right-1/4 w-64 h-64 bg-gradient-to-r from-green-400 to-teal-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse morphing-blob"></div>
      </div>

      {/* Holographic Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-10 hologram-lines"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,255,255,0.3) 1px, transparent 1px), 
            linear-gradient(90deg, rgba(0,255,255,0.3) 1px, transparent 1px),
            radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px, 60px 60px, 30px 30px',
          transform: 'rotateX(45deg) rotateY(15deg) scale(1.2)'
        }}
      />

      <div className="relative z-10 flex flex-col items-center p-6 min-h-screen tab-content">
        {/* Futuristic 3D Header */}
        <header 
          ref={headerRef} 
          className="w-full max-w-6xl flex items-center justify-between py-6 px-8 mb-8" 
          style={{transform: 'translateZ(30px)'}}
        >
          <div className="flex items-center space-x-4">
            <div 
              className="logo-3d p-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-3xl shadow-2xl shadow-cyan-400/50 relative quantum-glow" 
              style={{transform: 'rotateY(10deg)'}}
            >
              <Shield size={40} className="text-white" />
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-3xl blur-xl opacity-60 animate-pulse"></div>
            </div>
            <div className="transform" style={{transform: 'rotateY(-5deg)'}}>
              <h1 className="text-5xl font-black bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent text-3d text-glow">
                STAMPEDE GUARD 3D
              </h1>
              <p className="text-cyan-300 text-sm font-medium mt-1 text-glow">
                Advanced AI-Powered 3D Crowd Monitoring & Emergency Response System
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            {/* 3D Tab Navigation */}
            <div 
              className="flex items-center space-x-2 bg-black/40 backdrop-blur-3xl rounded-3xl p-3 border border-gray-700/50 shadow-2xl cyberpunk-border" 
              style={{transform: 'rotateY(-10deg)'}}
            >
              <button
                onClick={() => setActiveTab('monitoring')}
                onMouseEnter={(e) => animate3DCardHover(e.target, true)}
                onMouseLeave={(e) => animate3DCardHover(e.target, false)}
                className={`flex items-center space-x-3 px-6 py-3 rounded-2xl transition-all duration-500 transform hover-lift ${
                  activeTab === 'monitoring'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-2xl energy-field'
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
                className={`relative flex items-center space-x-3 px-6 py-3 rounded-2xl transition-all duration-500 transform hover-lift ${
                  activeTab === 'sos-alerts'
                    ? 'bg-gradient-to-r from-red-500 to-orange-600 text-white shadow-2xl energy-field'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <Bell size={24} />
                <span className="font-bold">SOS Alerts</span>
                {sosReports.length > 0 && (
                  <span className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white text-sm rounded-full flex items-center justify-center animate-bounce pulse-orb">
                    {sosReports.length}
                  </span>
                )}
              </button>
            </div>

            {/* 3D Status Indicator */}
            <div 
              className="flex items-center space-x-3 bg-black/30 backdrop-blur-xl rounded-2xl px-4 py-3 border border-cyan-400/30 glass-morphism" 
              style={{transform: 'rotateY(5deg)'}}
            >
              <div className={`w-4 h-4 rounded-full ${webcamEnabled ? 'bg-green-400' : 'bg-red-400'} shadow-lg animate-pulse energy-field`}></div>
              <span className="text-white font-bold text-lg text-3d">
                {webcamEnabled ? 'SYSTEM ACTIVE' : 'STANDBY MODE'}
              </span>
            </div>

            {/* 3D Control Button */}
            {activeTab === 'monitoring' && (
              <button
                onClick={toggleWebcam}
                onMouseEnter={(e) => animate3DCardHover(e.target, true)}
                onMouseLeave={(e) => animate3DCardHover(e.target, false)}
                className={`webcam-toggle relative p-5 rounded-3xl backdrop-blur-3xl transition-all duration-500 transform hover:scale-110 hover-lift ${
                  webcamEnabled
                    ? 'bg-red-500/30 border-2 border-red-400/50 shadow-2xl shadow-red-500/40 energy-field'
                    : 'bg-green-500/30 border-2 border-green-400/50 shadow-2xl shadow-green-500/40 energy-field'
                }`}
                title={webcamEnabled ? "Disable 3D Monitoring" : "Enable 3D Monitoring"}
                style={{transform: 'rotateY(-15deg) rotateX(5deg)'}}
              >
                {webcamEnabled ? (
                  <EyeOff size={32} className="text-red-300" />
                ) : (
                  <Camera size={32} className="text-green-300" />
                )}
                <span className="absolute -top-3 -right-3 w-8 h-8 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center shadow-lg pulse-orb">
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
              <div 
                className="animate-card bg-black/40 backdrop-blur-3xl rounded-3xl border-2 border-cyan-400/30 overflow-hidden shadow-2xl shadow-cyan-500/20 neon-border quantum-glow"
                style={{transform: 'perspective(1000px) rotateY(-5deg)'}}
              >
                {/* Video Header */}
                <div className="bg-gradient-to-r from-cyan-500/30 to-blue-600/30 p-6 border-b border-cyan-400/20 holographic">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Activity className="text-cyan-400" size={32} />
                      <span className="text-white font-bold text-2xl text-3d">3D Live Feed</span>
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
                        <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-cyan-400/40 shadow-xl glass-morphism">
                          <div className="text-cyan-400 text-lg font-bold">3D AI DETECTION</div>
                          <div className="text-white text-sm">TensorFlow.js COCO-SSD Enhanced</div>
                        </div>
                        <div className="bg-black/60 backdrop-blur-xl rounded-2xl p-4 border border-cyan-400/40 shadow-xl glass-morphism">
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
              <div 
                className={`animate-card status-card people-count-container relative bg-gradient-to-r ${getStatusColor()} rounded-3xl p-8 text-center overflow-hidden ${getGlowEffect()} transform card-3d`}
                style={{transform: 'perspective(800px) rotateY(10deg) rotateX(-5deg)'}}
              >
                <div className="absolute inset-0 bg-white/10 backdrop-blur-xl"></div>
                <div className="relative z-10">
                  <Users className="text-white/90 mx-auto mb-6" size={64} />
                  <p className="text-white/90 text-2xl font-bold mb-4 text-3d">People Detected</p>
                  <p className="people-count-number text-white text-8xl font-black mb-6 tracking-tight text-3d text-glow">
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
                    <span className="text-white font-black text-lg text-3d">
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
              <div 
                className="animate-card bg-black/40 backdrop-blur-3xl rounded-3xl border border-gray-700/50 p-8 shadow-xl glass-morphism"
                style={{transform: 'perspective(600px) rotateY(-8deg)'}}
              >
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
              <div 
                className="animate-card bg-black/40 backdrop-blur-3xl rounded-3xl border border-gray-700/50 p-8 shadow-xl glass-morphism"
                style={{transform: 'perspective(600px) rotateY(5deg)'}}
              >
                <h3 className="text-white font-black text-2xl mb-6 flex items-center">
                  <Activity className="text-cyan-400 mr-4" size={32} />
                  3D Activity Log
                </h3>
                
                <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-3">
                  {recentActivities.length > 0 ? (
                    recentActivities.map((activity, index) => (
                      <div 
                        key={index} 
                        className="flex justify-between items-center p-4 bg-gray-800/40 rounded-2xl border border-gray-700/40 shadow-lg transform hover:scale-105 transition-all duration-300 hover-lift"
                      >
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
          /* SOS Alerts System */
          <div className="w-full max-w-6xl tab-content">
            <div className="text-center py-20">
              <div className="relative mb-8">
                <Bell size={120} className="text-cyan-400 mx-auto float-animation" />
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-red-400 rounded-full blur-2xl opacity-40 animate-pulse"></div>
              </div>
              <h2 className="text-5xl font-black text-white mb-6 text-3d text-glow">SOS Emergency System</h2>
              <p className="text-cyan-300 text-xl mb-8">3D Emergency Management Dashboard</p>
              <div className="bg-black/40 backdrop-blur-3xl rounded-3xl border border-red-500/50 p-8 glass-morphism quantum-glow">
                <p className="text-red-300 font-bold text-lg mb-4">🚨 Emergency Response Center</p>
                <p className="text-gray-300">Real-time SOS alert monitoring and emergency dispatch system</p>
                <p className="text-gray-400 text-sm mt-4">Firebase integration active • WhatsApp notifications enabled</p>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced 3D Alert Messages */}
        {alertStatus === 'error' && (
          <div className="fixed bottom-8 right-8 bg-red-500/30 backdrop-blur-3xl border-2 border-red-400/50 rounded-3xl p-6 shadow-2xl shadow-red-500/40 animate-bounce energy-field">
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
                <p className="text-green-400">Emergency services notified</p>
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
          }}
        />
      </div>
    </div>
  );
}

export default App;
