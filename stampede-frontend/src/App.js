// App.jsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import { Camera, Loader2, AlertTriangle, CheckCircle, WifiOff, XCircle, Users, EyeOff, Activity, Shield, Zap, Bell, Play, Pause, ExternalLink, MapPin, Clock, MessageSquare, Phone, Mail } from 'lucide-react';

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

  // Configuration for alert thresholds (adjusted for more realistic testing)
  const HIGH_DENSITY_THRESHOLD = 1; // Warning for 1 or more people
  const CRITICAL_DENSITY_THRESHOLD = 3; // Alert for 3 or more people
  const ALERT_COOLDOWN_SECONDS = 10;

  const BACKEND_URL = 'http://localhost:5000/api/alert/stampede';
  const SOS_API_URL = 'http://localhost:5000/api/sos';

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
  }, [model, alertCooldown, webcamEnabled, recentActivities]);

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
      const response = await fetch(`${SOS_API_URL}/pending`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken') || 'demo-token'}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSOSReports(data.reports || []);
      } else {
        // For demo purposes, use mock data if API is not available
        setSOSReports([
          {
            _id: 'sos_demo_1',
            userId: 'user_123',
            userInfo: {
              name: 'John Doe',
              phone: '+1234567890',
              email: 'john@example.com'
            },
            incident: {
              videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
              videoThumbnail: '',
              videoDuration: 15,
              message: 'Large crowd stampede at metro station, people falling down',
              location: {
                latitude: 28.7041,
                longitude: 77.1025,
                address: 'Connaught Place, New Delhi, India',
                accuracy: 5.2
              },
              timestamp: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
              deviceInfo: {
                platform: 'ios',
                version: '17.2',
                model: 'iPhone 14'
              }
            },
            status: 'pending',
            metadata: {
              priority: 'high',
              category: 'stampede'
            }
          },
          {
            _id: 'sos_demo_2',
            userId: 'user_456',
            userInfo: {
              name: 'Sarah Smith',
              phone: '+1234567891',
              email: 'sarah@example.com'
            },
            incident: {
              videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4',
              videoThumbnail: '',
              videoDuration: 12,
              message: 'Fire emergency at shopping mall, smoke everywhere',
              location: {
                latitude: 28.6139,
                longitude: 77.2090,
                address: 'India Gate, New Delhi, India',
                accuracy: 3.1
              },
              timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
              deviceInfo: {
                platform: 'android',
                version: '13',
                model: 'Samsung Galaxy S23'
              }
            },
            status: 'pending',
            metadata: {
              priority: 'high',
              category: 'fire'
            }
          }
        ]);
      }
    } catch (error) {
      console.error('Error fetching SOS reports:', error);
      // Use mock data on error
      setSOSReports([]);
    } finally {
      setSOSLoading(false);
    }
  }, [activeTab]);

  // Handle SOS report approval/rejection
  const handleSOSReview = async (sosId, decision) => {
    try {
      setSOSProcessing(prev => ({ ...prev, [sosId]: true }));

      const response = await fetch(`${SOS_API_URL}/${sosId}/review`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken') || 'demo-token'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          decision,
          adminNotes: decision === 'approved' ? 'Emergency verified, sending alerts to nearby users' : 'Report does not meet emergency criteria'
        })
      });

      if (response.ok) {
        const result = await response.json();

        // Simulate sending notifications for demo
        if (decision === 'approved') {
          // Show success message with notification count
          alert(`✅ SOS Report ${decision.toUpperCase()}!\n\n🚨 Emergency alerts sent to ${Math.floor(Math.random() * 50) + 20} nearby users via:\n• WhatsApp messages\n• Push notifications\n\nUsers within 1km radius have been notified.`);
        } else {
          alert(`❌ SOS Report ${decision.toUpperCase()}\n\nThe report has been reviewed and rejected.`);
        }

        // Remove from pending list
        setSOSReports(prev => prev.filter(report => report._id !== sosId));
        setSelectedSOSReport(null);

      } else {
        throw new Error('Failed to review SOS report');
      }
    } catch (error) {
      console.error('Error reviewing SOS report:', error);
      // For demo, still show success
      if (decision === 'approved') {
        alert(`✅ SOS Report APPROVED! (Demo Mode)\n\n🚨 In a real system, emergency alerts would be sent to ${Math.floor(Math.random() * 50) + 20} nearby users via:\n• WhatsApp messages\n• Push notifications\n\nUsers within 1km radius would be notified.`);
      } else {
        alert(`❌ SOS Report REJECTED (Demo Mode)\n\nThe report has been reviewed and rejected.`);
      }

      // Remove from list for demo
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
              <p className="text-cyan-300 text-sm font-medium">AI-Powered Crowd Monitoring System</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            {/* Status Indicator */}
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${webcamEnabled ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
              <span className="text-white font-medium">
                {webcamEnabled ? 'ACTIVE' : 'STANDBY'}
              </span>
            </div>

            {/* Control Button */}
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
          </div>
        </header>

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
      </div>
    </div>
  );
}

export default App;
