import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import { Camera, Loader2, AlertTriangle, CheckCircle, WifiOff, XCircle, Users, EyeOff, Activity, Shield, Bell } from 'lucide-react';
import { listenToSOSReports, testFirestoreConnection } from './firebase/config';
import CreateAlertForm from './components/CreateAlertForm';
import VideoCounter from './components/VideoCounter';
import EmergencyVideosList from './components/EmergencyVideosList';

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const lastAlertTimeRef = useRef(0);
  const alertCooldownRef = useRef(false);

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
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [firebaseConnected, setFirebaseConnected] = useState(false);

  // Configuration for alert thresholds
  const HIGH_DENSITY_THRESHOLD = 1;
  const CRITICAL_DENSITY_THRESHOLD = 3;
  const ALERT_COOLDOWN_SECONDS = 10;
  const BACKEND_URL = 'http://localhost:5000/api/alert/stampede';

  // Effect to test Firebase connection
  useEffect(() => {
    const testFirebase = async () => {
      try {
        const result = await testFirestoreConnection();
        setFirebaseConnected(result.success);
        console.log('Firebase connection:', result.success ? 'SUCCESS' : 'FAILED');
      } catch (error) {
        console.error('Firebase connection test failed:', error);
        setFirebaseConnected(false);
      }
    };

    testFirebase();
  }, []);

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

  // Object detection function
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

      // Add to recent activities
      if (recentActivities.length === 0 || recentActivities[0].count !== currentPeopleCount) {
        setRecentActivities(prevActivities => [
          { timestamp: new Date().toLocaleTimeString(), count: currentPeopleCount },
          ...prevActivities.slice(0, 9)
        ]);
      }

      // Draw detection boxes on canvas
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, videoWidth, videoHeight);
      ctx.font = 'bold 16px Arial';
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 3;
      ctx.fillStyle = '#00ffff';

      people.forEach((prediction, index) => {
        const [x, y, width, height] = prediction.bbox;
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.stroke();
        
        const label = `Person ${index + 1} (${Math.round(prediction.score * 100)}%)`;
        ctx.fillText(label, x, y > 30 ? y - 10 : y + height + 25);
      });

      // Alert condition checking
      const currentTime = Date.now();
      const timeSinceLastAlert = currentTime - lastAlertTimeRef.current;
      const cooldownActive = alertCooldownRef.current || timeSinceLastAlert < (ALERT_COOLDOWN_SECONDS * 1000);

      if (!cooldownActive && currentPeopleCount >= CRITICAL_DENSITY_THRESHOLD) {
        alertCooldownRef.current = true;
        lastAlertTimeRef.current = currentTime;

        setAlertStatus('alerting');
        sendAlert(`Critical stampede risk! ${currentPeopleCount} people detected.`, currentPeopleCount);
        setAlertCooldown(true);

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
  }, [model, webcamEnabled, recentActivities, sendAlert]);

  // Toggle webcam function
  const toggleWebcam = () => {
    setWebcamEnabled(prev => !prev);
  };

  // SOS Reports Management Functions
  const fetchSOSReports = useCallback(async () => {
    if (activeTab !== 'sos-alerts') return;

    try {
      console.log('Starting SOS reports Firebase connection...');

      const connectionTest = await testFirestoreConnection();
      if (!connectionTest.success) {
        console.error('Firebase connection test failed:', connectionTest.error);
        return;
      }

      const unsubscribe = listenToSOSReports((reports) => {
        if (!reports || reports.length === 0) {
          setSOSReports([]);
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
            message: report.message || 'Emergency situation reported',
            location: {
              latitude: report.location?.latitude || 28.7041,
              longitude: report.location?.longitude || 77.1025,
              address: report.location?.latitude && report.location?.longitude
                ? `Emergency Location: ${report.location.latitude.toFixed(4)}, ${report.location.longitude.toFixed(4)}`
                : 'Location not available'
            },
            timestamp: report.createdAt?.toDate() || new Date()
          },
          status: 'pending',
          metadata: {
            priority: 'high',
            category: 'emergency'
          }
        }));

        setSOSReports(transformedReports);
      });

      return unsubscribe;

    } catch (error) {
      console.error('Error setting up Firebase listener:', error);
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
    if (detectedPeople >= HIGH_DENSITY_THRESHOLD) return "from-yellow-400 via-yellow-500 to-orange-500";
    return "from-green-400 via-green-500 to-blue-500";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-yellow-50 to-yellow-100">
      <div className="flex flex-col items-center p-6 min-h-screen">
        {/* Header */}
        <header className="w-full max-w-6xl flex items-center justify-between py-6 px-8 mb-8">
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl shadow-lg">
              <Shield size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-800">
                SAFE GUARD
              </h1>
              <p className="text-gray-600 text-sm font-medium mt-1">
                AI-Powered Crowd Monitoring & Emergency Response System
              </p>
              
            </div>
          </div>

          <div className="flex items-center space-x-6">
            {/* Tab Navigation */}
            <div className="flex items-center space-x-2 bg-white/90 backdrop-blur-md rounded-xl p-2 border border-yellow-200 shadow-lg">
              <button
                onClick={() => setActiveTab('monitoring')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                  activeTab === 'monitoring'
                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-yellow-50'
                }`}
              >
                <Activity size={20} />
                <span className="font-medium">Live Monitor</span>
              </button>

              <button
                onClick={() => setActiveTab('sos-alerts')}
                className={`relative flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                  activeTab === 'sos-alerts'
                    ? 'bg-gradient-to-r from-red-400 to-red-500 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-yellow-50'
                }`}
              >
                <Bell size={20} />
                <span className="font-medium">SOS Alerts</span>
                {sosReports.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {sosReports.length}
                  </span>
                )}
              </button>
            </div>


            {/* Control Button */}
            {activeTab === 'monitoring' && (
              <button
                onClick={toggleWebcam}
                className={`p-4 rounded-2xl backdrop-blur-md transition-all duration-500 transform hover:scale-110 shadow-lg ${
                  webcamEnabled
                    ? 'bg-gradient-to-r from-red-400 to-red-500 border-2 border-red-200 hover:from-red-500 hover:to-red-600'
                    : 'bg-gradient-to-r from-green-400 to-green-500 border-2 border-green-200 hover:from-green-500 hover:to-green-600'
                }`}
                title={webcamEnabled ? "Disable Monitoring" : "Enable Monitoring"}
              >
                {webcamEnabled ? (
                  <EyeOff size={24} className="text-white drop-shadow-md" />
                ) : (
                  <Camera size={24} className="text-white drop-shadow-md" />
                )}
              </button>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        {activeTab === 'monitoring' ? (
          <div className="w-full max-w-7xl space-y-8">
            {/* Three Monitoring Feeds Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* CCTV Feed */}
              <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-yellow-200 overflow-hidden shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-105">
                <div className="bg-gradient-to-r from-green-400/20 to-blue-400/20 p-4 border-b border-yellow-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Camera className="text-green-600" size={20} />
                      <span className="text-gray-800 font-bold">CCTV Feed</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                      <span className="text-green-600 text-xs font-semibold">LIVE</span>
                    </div>
                  </div>
                </div>

                <div className="relative aspect-video bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg overflow-hidden">
                  {!webcamEnabled ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-yellow-50">
                      <Camera size={48} className="text-green-400 mb-3 animate-pulse" />
                      <p className="text-gray-700 font-bold">CCTV Ready</p>
                      <p className="text-gray-500 text-xs text-center">Click camera button to start</p>
                    </div>
                  ) : (
                    <div className="relative w-full h-full">
                      <Webcam
                        ref={webcamRef}
                        muted={true}
                        videoConstraints={{
                          facingMode: 'user',
                          width: { ideal: 640 },
                          height: { ideal: 480 }
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
                      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-md rounded-lg p-2 shadow-lg">
                        <div className="text-green-600 text-xs font-bold">CCTV-01</div>
                        <div className="text-gray-700 text-xs">{new Date().toLocaleTimeString()}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* CCTV Heatmap Placeholder */}
                <div className="p-4 border-t border-yellow-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-3 h-3 bg-orange-400 rounded-full animate-pulse"></div>
                    <span className="text-gray-800 text-sm font-bold">Crowd Heatmap</span>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4 text-center border border-yellow-100">
                    <div className="text-gray-600 text-xs mb-2">🔥 Density Analysis</div>
                    <div className="text-gray-500 text-xs">Heatmap will appear here when ML model processes the feed</div>
                  </div>
                </div>
              </div>

              {/* Drone Feed */}
              <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-yellow-200 overflow-hidden shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-105">
                <div className="bg-gradient-to-r from-purple-400/20 to-pink-400/20 p-4 border-b border-yellow-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Activity className="text-purple-600" size={20} />
                      <span className="text-gray-800 font-bold">Drone Feed</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-ping"></div>
                      <span className="text-purple-600 text-xs font-semibold">AERIAL</span>
                    </div>
                  </div>
                </div>

                <div className="relative aspect-video bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg overflow-hidden">
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Activity size={48} className="text-purple-400 mb-3 animate-pulse" />
                    <p className="text-gray-700 font-bold">Drone Feed</p>
                    <p className="text-gray-500 text-xs text-center">Aerial monitoring ready</p>
                  </div>
                  <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-md rounded-lg p-2 shadow-lg">
                    <div className="text-purple-600 text-xs font-bold">DRONE-01</div>
                    <div className="text-gray-700 text-xs">Ready</div>
                  </div>
                </div>

                {/* Drone Heatmap Placeholder */}
                <div className="p-4 border-t border-yellow-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
                    <span className="text-gray-800 text-sm font-bold">Aerial Heatmap</span>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4 text-center border border-yellow-100">
                    <div className="text-gray-600 text-xs mb-2">🚁 Overhead Analysis</div>
                    <div className="text-gray-500 text-xs">Aerial density mapping will appear when drone is active</div>
                  </div>
                </div>
              </div>

              {/* Satellite Feed */}
              <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-yellow-200 overflow-hidden shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-105">
                <div className="bg-gradient-to-r from-cyan-400/20 to-teal-400/20 p-4 border-b border-yellow-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Shield className="text-cyan-600" size={20} />
                      <span className="text-gray-800 font-bold">Satellite Feed</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-cyan-500 rounded-full animate-ping"></div>
                      <span className="text-cyan-600 text-xs font-semibold">ORBIT</span>
                    </div>
                  </div>
                </div>

                <div className="relative aspect-video bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg overflow-hidden">
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Shield size={48} className="text-cyan-400 mb-3 animate-pulse" />
                    <p className="text-gray-700 font-bold">Satellite Feed</p>
                    <p className="text-gray-500 text-xs text-center">Global monitoring ready</p>
                  </div>
                  <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-md rounded-lg p-2 shadow-lg">
                    <div className="text-cyan-600 text-xs font-bold">SAT-01</div>
                    <div className="text-gray-700 text-xs">Ready</div>
                  </div>
                </div>

                {/* Satellite Heatmap Placeholder */}
                <div className="p-4 border-t border-yellow-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
                    <span className="text-gray-800 text-sm font-bold">Global Heatmap</span>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4 text-center border border-yellow-100">
                    <div className="text-gray-600 text-xs mb-2">🛰️ Wide Area Analysis</div>
                    <div className="text-gray-500 text-xs">Regional crowd patterns from satellite imagery</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Analytics Grid Below Feeds */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* People Count Display */}
              <div className={`bg-gradient-to-br ${getStatusColor()} rounded-2xl p-6 text-center shadow-xl transition-all duration-300 hover:scale-105 transform`}>
                <Users className="text-white/90 mx-auto mb-4" size={32} />
                <p className="text-white/90 text-sm font-bold mb-2">People Detected</p>
                <p className="text-white text-3xl font-black mb-3 drop-shadow-md">
                  {detectedPeople}
                </p>
                <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs backdrop-blur-sm ${
                  detectedPeople >= CRITICAL_DENSITY_THRESHOLD
                    ? 'bg-red-500/40 border border-red-300/50'
                    : detectedPeople >= HIGH_DENSITY_THRESHOLD
                    ? 'bg-yellow-500/40 border border-yellow-300/50'
                    : 'bg-green-500/40 border border-green-300/50'
                }`}>
                  {detectedPeople >= CRITICAL_DENSITY_THRESHOLD && <AlertTriangle size={12} className="text-white" />}
                  <span className="text-white font-bold">
                    {getCurrentStatusText()}
                  </span>
                </div>
              </div>

              {/* System Status */}
              <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-yellow-200 p-6 shadow-xl transition-all duration-300 hover:shadow-2xl">
                <h3 className="text-gray-800 font-bold text-sm mb-4 flex items-center">
                  <Shield className="text-yellow-600 mr-2" size={16} />
                  System Status
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs font-medium">AI Model</span>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${model ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                      <span className={`text-xs font-semibold ${model ? 'text-green-600' : 'text-red-600'}`}>
                        {model ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs font-medium">Monitoring</span>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${webcamEnabled ? 'bg-green-500' : 'bg-yellow-400'} animate-pulse`}></div>
                      <span className={`text-xs font-semibold ${webcamEnabled ? 'text-green-600' : 'text-yellow-600'}`}>
                        {webcamEnabled ? 'Active' : 'Ready'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feed Status */}
              <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-yellow-200 p-6 shadow-xl transition-all duration-300 hover:shadow-2xl">
                <h3 className="text-gray-800 font-bold text-sm mb-4 flex items-center">
                  <Activity className="text-yellow-600 mr-2" size={16} />
                  Feed Status
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs font-medium">CCTV</span>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${webcamEnabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <span className={`text-xs font-semibold ${webcamEnabled ? 'text-green-600' : 'text-gray-500'}`}>
                        {webcamEnabled ? 'LIVE' : 'OFF'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs font-medium">Drone</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                      <span className="text-xs font-semibold text-yellow-600">READY</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs font-medium">Satellite</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                      <span className="text-xs font-semibold text-yellow-600">READY</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity Log */}
              <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-yellow-200 p-6 shadow-xl transition-all duration-300 hover:shadow-2xl">
                <h3 className="text-gray-800 font-bold text-sm mb-4 flex items-center">
                  <Activity className="text-yellow-600 mr-2" size={16} />
                  Recent Activity
                </h3>

                <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-2">
                  {recentActivities.length > 0 ? (
                    recentActivities.slice(0, 3).map((activity, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-2 bg-yellow-50 rounded-lg border border-yellow-100 text-xs"
                      >
                        <span className="text-gray-600 font-medium">{activity.timestamp.slice(-8)}</span>
                        <span className={`font-semibold px-2 py-1 rounded-md ${
                          activity.count >= CRITICAL_DENSITY_THRESHOLD
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : activity.count >= HIGH_DENSITY_THRESHOLD
                            ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                            : 'bg-green-100 text-green-700 border border-green-200'
                        }`}>
                          {activity.count}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-500 text-xs">No activity recorded</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* SOS Alerts System */
          <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar with Video Counter */}
            <div className="lg:col-span-1 space-y-6">
              <VideoCounter />

              {/* System Info */}
              <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-yellow-200 p-4 shadow-xl transition-all duration-300 hover:shadow-2xl">
                <div className="flex items-center space-x-2 mb-3">
                  <Shield className="text-blue-600" size={20} />
                  <h3 className="text-gray-800 font-bold text-sm">AI Analysis</h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-gray-600 font-medium">Gemini AI Active</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-gray-600 font-medium">Real-time Processing</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                    <span className="text-gray-600 font-medium">Emergency Detection</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content - Emergency Videos */}
            <div className="lg:col-span-3">
              <EmergencyVideosList />
            </div>
          </div>
        )}

        {/* Alert Messages */}
        {alertStatus === 'error' && (
          <div className="fixed bottom-6 right-6 bg-white/98 backdrop-blur-md border-2 border-red-200 rounded-2xl p-4 shadow-xl animate-bounce">
            <div className="flex items-center space-x-3">
              <XCircle size={24} className="text-red-500" />
              <div>
                <p className="text-red-600 font-bold">System Error</p>
                <p className="text-red-500 text-sm">Check console for details</p>
              </div>
            </div>
          </div>
        )}

        {alertStatus === 'no-webcam' && (
          <div className="fixed bottom-6 right-6 bg-white/98 backdrop-blur-md border-2 border-yellow-200 rounded-2xl p-4 shadow-xl animate-bounce">
            <div className="flex items-center space-x-3">
              <WifiOff size={24} className="text-yellow-500" />
              <div>
                <p className="text-yellow-600 font-bold">Camera Access Required</p>
                <p className="text-yellow-500 text-sm">Grant webcam permissions</p>
              </div>
            </div>
          </div>
        )}

        {alertStatus === 'sent' && (
          <div className="fixed bottom-6 right-6 bg-white/98 backdrop-blur-md border-2 border-green-200 rounded-2xl p-4 shadow-xl animate-bounce">
            <div className="flex items-center space-x-3">
              <CheckCircle size={24} className="text-green-500" />
              <div>
                <p className="text-green-600 font-bold">Alert Sent Successfully!</p>
                <p className="text-green-500 text-sm">Emergency services notified</p>
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
