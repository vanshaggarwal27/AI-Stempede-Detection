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
    if (detectedPeople >= CRITICAL_DENSITY_THRESHOLD) return "from-red-500 to-red-700";
    if (detectedPeople >= HIGH_DENSITY_THRESHOLD) return "from-yellow-500 to-orange-500";
    return "from-green-400 to-blue-500";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <div className="flex flex-col items-center p-6 min-h-screen">
        {/* Header */}
        <header className="w-full max-w-6xl flex items-center justify-between py-6 px-8 mb-8">
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-blue-600 rounded-xl shadow-lg">
              <Shield size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">
                STAMPEDE GUARD
              </h1>
              <p className="text-blue-300 text-sm font-medium mt-1">
                AI-Powered Crowd Monitoring & Emergency Response System
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            {/* Tab Navigation */}
            <div className="flex items-center space-x-2 bg-black/30 backdrop-blur-md rounded-xl p-2 border border-gray-600">
              <button
                onClick={() => setActiveTab('monitoring')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                  activeTab === 'monitoring'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700'
                }`}
              >
                <Activity size={20} />
                <span className="font-medium">Live Monitor</span>
              </button>

              <button
                onClick={() => setActiveTab('sos-alerts')}
                className={`relative flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                  activeTab === 'sos-alerts'
                    ? 'bg-red-600 text-white shadow-lg'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700'
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

            {/* Status Indicator */}
            <div className="flex items-center space-x-4 bg-black/30 backdrop-blur-md rounded-lg px-4 py-2 border border-gray-600">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${firebaseConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
                <span className="text-white text-sm font-medium">Firebase</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${webcamEnabled ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
                <span className="text-white text-sm font-medium">
                  {webcamEnabled ? 'MONITORING' : 'STANDBY'}
                </span>
              </div>
            </div>

            {/* Control Button */}
            {activeTab === 'monitoring' && (
              <button
                onClick={toggleWebcam}
                className={`p-3 rounded-xl backdrop-blur-md transition-all duration-300 ${
                  webcamEnabled
                    ? 'bg-red-600/80 border border-red-400 hover:bg-red-600'
                    : 'bg-green-600/80 border border-green-400 hover:bg-green-600'
                }`}
                title={webcamEnabled ? "Disable Monitoring" : "Enable Monitoring"}
              >
                {webcamEnabled ? (
                  <EyeOff size={24} className="text-white" />
                ) : (
                  <Camera size={24} className="text-white" />
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
              <div className="bg-black/40 backdrop-blur-md rounded-xl border border-gray-600 overflow-hidden shadow-xl">
                <div className="bg-gradient-to-r from-green-600/30 to-blue-600/30 p-4 border-b border-gray-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Camera className="text-green-400" size={20} />
                      <span className="text-white font-bold">CCTV Feed</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                      <span className="text-green-300 text-xs">LIVE</span>
                    </div>
                  </div>
                </div>

                <div className="relative aspect-video bg-black">
                  {!webcamEnabled ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/60">
                      <Camera size={48} className="text-gray-400 mb-3" />
                      <p className="text-white font-bold">CCTV Standby</p>
                      <p className="text-gray-400 text-xs text-center">Activate monitoring system</p>
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
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md rounded p-2">
                        <div className="text-green-400 text-xs font-bold">CCTV-01</div>
                        <div className="text-white text-xs">{new Date().toLocaleTimeString()}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* CCTV Heatmap Placeholder */}
                <div className="p-4 border-t border-gray-600">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
                    <span className="text-white text-sm font-bold">Crowd Heatmap</span>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                    <div className="text-gray-400 text-xs mb-2">🔥 Density Analysis</div>
                    <div className="text-gray-500 text-xs">Heatmap will appear here when ML model processes the feed</div>
                  </div>
                </div>
              </div>

              {/* Drone Feed */}
              <div className="bg-black/40 backdrop-blur-md rounded-xl border border-gray-600 overflow-hidden shadow-xl">
                <div className="bg-gradient-to-r from-purple-600/30 to-pink-600/30 p-4 border-b border-gray-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Activity className="text-purple-400" size={20} />
                      <span className="text-white font-bold">Drone Feed</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-ping"></div>
                      <span className="text-purple-300 text-xs">AERIAL</span>
                    </div>
                  </div>
                </div>

                <div className="relative aspect-video bg-black">
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/60">
                    <Activity size={48} className="text-gray-400 mb-3" />
                    <p className="text-white font-bold">Drone Standby</p>
                    <p className="text-gray-400 text-xs text-center">Waiting for aerial connection</p>
                  </div>
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md rounded p-2">
                    <div className="text-purple-400 text-xs font-bold">DRONE-01</div>
                    <div className="text-white text-xs">Offline</div>
                  </div>
                </div>

                {/* Drone Heatmap Placeholder */}
                <div className="p-4 border-t border-gray-600">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                    <span className="text-white text-sm font-bold">Aerial Heatmap</span>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                    <div className="text-gray-400 text-xs mb-2">🚁 Overhead Analysis</div>
                    <div className="text-gray-500 text-xs">Aerial density mapping will appear when drone is active</div>
                  </div>
                </div>
              </div>

              {/* Satellite Feed */}
              <div className="bg-black/40 backdrop-blur-md rounded-xl border border-gray-600 overflow-hidden shadow-xl">
                <div className="bg-gradient-to-r from-cyan-600/30 to-teal-600/30 p-4 border-b border-gray-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Shield className="text-cyan-400" size={20} />
                      <span className="text-white font-bold">Satellite Feed</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-cyan-500 rounded-full animate-ping"></div>
                      <span className="text-cyan-300 text-xs">ORBIT</span>
                    </div>
                  </div>
                </div>

                <div className="relative aspect-video bg-black">
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/60">
                    <Shield size={48} className="text-gray-400 mb-3" />
                    <p className="text-white font-bold">Satellite Standby</p>
                    <p className="text-gray-400 text-xs text-center">Connecting to orbital feed</p>
                  </div>
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md rounded p-2">
                    <div className="text-cyan-400 text-xs font-bold">SAT-01</div>
                    <div className="text-white text-xs">Syncing...</div>
                  </div>
                </div>

                {/* Satellite Heatmap Placeholder */}
                <div className="p-4 border-t border-gray-600">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-3 h-3 bg-cyan-400 rounded-full"></div>
                    <span className="text-white text-sm font-bold">Global Heatmap</span>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                    <div className="text-gray-400 text-xs mb-2">🛰️ Wide Area Analysis</div>
                    <div className="text-gray-500 text-xs">Regional crowd patterns from satellite imagery</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Analytics Grid Below Feeds */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* People Count Display */}
              <div className={`bg-gradient-to-r ${getStatusColor()} rounded-xl p-6 text-center shadow-xl`}>
                <Users className="text-white/90 mx-auto mb-4" size={32} />
                <p className="text-white/90 text-sm font-bold mb-2">People Detected</p>
                <p className="text-white text-3xl font-black mb-3">
                  {detectedPeople}
                </p>
                <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs ${
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
              <div className="bg-black/40 backdrop-blur-md rounded-xl border border-gray-600 p-6 shadow-xl">
                <h3 className="text-white font-bold text-sm mb-4 flex items-center">
                  <Shield className="text-blue-400 mr-2" size={16} />
                  System Status
                </h3>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-xs">AI Model</span>
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${model ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
                      <span className={`text-xs font-medium ${model ? 'text-green-400' : 'text-red-400'}`}>
                        {model ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-xs">Firebase</span>
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${firebaseConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
                      <span className={`text-xs font-medium ${firebaseConnected ? 'text-green-400' : 'text-red-400'}`}>
                        {firebaseConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-xs">Monitoring</span>
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${webcamEnabled ? 'bg-green-400' : 'bg-gray-400'} animate-pulse`}></div>
                      <span className={`text-xs font-medium ${webcamEnabled ? 'text-green-400' : 'text-gray-400'}`}>
                        {webcamEnabled ? 'Active' : 'Standby'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feed Status */}
              <div className="bg-black/40 backdrop-blur-md rounded-xl border border-gray-600 p-6 shadow-xl">
                <h3 className="text-white font-bold text-sm mb-4 flex items-center">
                  <Activity className="text-green-400 mr-2" size={16} />
                  Feed Status
                </h3>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-xs">CCTV</span>
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${webcamEnabled ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                      <span className={`text-xs ${webcamEnabled ? 'text-green-400' : 'text-gray-400'}`}>
                        {webcamEnabled ? 'LIVE' : 'OFF'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-xs">Drone</span>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                      <span className="text-xs text-gray-400">OFF</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-xs">Satellite</span>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                      <span className="text-xs text-gray-400">OFF</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity Log */}
              <div className="bg-black/40 backdrop-blur-md rounded-xl border border-gray-600 p-6 shadow-xl">
                <h3 className="text-white font-bold text-sm mb-4 flex items-center">
                  <Activity className="text-blue-400 mr-2" size={16} />
                  Recent Activity
                </h3>

                <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1">
                  {recentActivities.length > 0 ? (
                    recentActivities.slice(0, 3).map((activity, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-2 bg-gray-800/40 rounded text-xs"
                      >
                        <span className="text-gray-400">{activity.timestamp.slice(-8)}</span>
                        <span className={`font-medium px-2 py-1 rounded ${
                          activity.count >= CRITICAL_DENSITY_THRESHOLD
                            ? 'bg-red-500/30 text-red-300'
                            : activity.count >= HIGH_DENSITY_THRESHOLD
                            ? 'bg-yellow-500/30 text-yellow-300'
                            : 'bg-green-500/30 text-green-300'
                        }`}>
                          {activity.count}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-gray-500 text-xs">No activity</p>
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
              <div className="bg-black/40 backdrop-blur-md rounded-xl border border-gray-600 p-4 shadow-xl">
                <div className="flex items-center space-x-2 mb-3">
                  <Shield className="text-blue-400" size={20} />
                  <h3 className="text-white font-bold text-sm">AI Analysis</h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-gray-300">Gemini AI Active</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <span className="text-gray-300">Real-time Processing</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                    <span className="text-gray-300">Emergency Detection</span>
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
          <div className="fixed bottom-6 right-6 bg-red-600/90 backdrop-blur-md border border-red-500 rounded-lg p-4 shadow-xl">
            <div className="flex items-center space-x-3">
              <XCircle size={24} className="text-red-200" />
              <div>
                <p className="text-red-100 font-bold">System Error</p>
                <p className="text-red-200 text-sm">Check console for details</p>
              </div>
            </div>
          </div>
        )}

        {alertStatus === 'no-webcam' && (
          <div className="fixed bottom-6 right-6 bg-yellow-600/90 backdrop-blur-md border border-yellow-500 rounded-lg p-4 shadow-xl">
            <div className="flex items-center space-x-3">
              <WifiOff size={24} className="text-yellow-200" />
              <div>
                <p className="text-yellow-100 font-bold">Camera Access Required</p>
                <p className="text-yellow-200 text-sm">Grant webcam permissions</p>
              </div>
            </div>
          </div>
        )}

        {alertStatus === 'sent' && (
          <div className="fixed bottom-6 right-6 bg-green-600/90 backdrop-blur-md border border-green-500 rounded-lg p-4 shadow-xl">
            <div className="flex items-center space-x-3">
              <CheckCircle size={24} className="text-green-200" />
              <div>
                <p className="text-green-100 font-bold">Alert Sent Successfully!</p>
                <p className="text-green-200 text-sm">Emergency services notified</p>
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
