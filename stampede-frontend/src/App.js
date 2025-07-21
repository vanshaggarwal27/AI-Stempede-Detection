// App.jsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import { Camera, Loader2, AlertTriangle, CheckCircle, WifiOff, XCircle, Users, EyeOff } from 'lucide-react'; // Added Users, EyeOff icons

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  const [model, setModel] = useState(null);
  const [loadingModel, setLoadingModel] = useState(true);
  const [detectedPeople, setDetectedPeople] = useState(0);
  const [alertStatus, setAlertStatus] = useState('idle'); // 'idle', 'warning', 'alerting', 'sent', 'error', 'no-webcam'
  const [alertCooldown, setAlertCooldown] = useState(false);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [recentActivities, setRecentActivities] = useState([]); // New state for recent activities

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

      // Add to recent activities if count changes or on an interval (e.g., every few seconds)
      // For simplicity, adding on every detection frame for now, but could optimize
      // Only add if the count is different from the last recorded activity or after a certain time
      if (recentActivities.length === 0 || recentActivities[0].count !== currentPeopleCount) {
        setRecentActivities(prevActivities => [
          { timestamp: new Date().toLocaleTimeString(), count: currentPeopleCount },
          ...prevActivities.slice(0, 9) // Keep last 10 activities
        ]);
      }


      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, videoWidth, videoHeight);
      ctx.font = '16px Arial';
      ctx.strokeStyle = '#00FF00'; // Green for bounding box
      ctx.lineWidth = 2;
      ctx.fillStyle = '#00FF00'; // Green for text

      people.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.stroke();
        ctx.fillText(`Person (${Math.round(prediction.score * 100)}%)`, x, y > 10 ? y - 5 : 10);
      });

      // Check for alert conditions
      if (!alertCooldown) {
        if (currentPeopleCount >= CRITICAL_DENSITY_THRESHOLD) {
          setAlertStatus('alerting');
          sendAlert(`Critical stampede risk! ${currentPeopleCount} people detected.`, currentPeopleCount);
          setAlertCooldown(true);
          setTimeout(() => setAlertCooldown(false), ALERT_COOLDOWN_SECONDS * 1000);
        } else if (currentPeopleCount >= HIGH_DENSITY_THRESHOLD) {
          setAlertStatus('warning');
        } else {
          setAlertStatus('idle');
        }
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
  }, [model, alertCooldown, webcamEnabled, recentActivities]); // Added recentActivities to dependencies

  // Function to send alert to backend
  const sendAlert = async (message, crowdDensity) => {
    try {
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

  // Effect to manage the detection loop based on webcamEnabled state
  useEffect(() => {
    if (webcamEnabled && model) {
      requestAnimationFrame(detect);
    } else if (!webcamEnabled) {
      setDetectedPeople(0);
      setAlertStatus('idle');
    }
  }, [webcamEnabled, model, detect]);

  // Determine status text for the "Current Count" card
  const getCurrentStatusText = () => {
    if (detectedPeople >= CRITICAL_DENSITY_THRESHOLD) return "Critical";
    if (detectedPeople >= HIGH_DENSITY_THRESHOLD) return "High Density";
    return "Quiet";
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 font-sans antialiased text-gray-900">
      {/* Header */}
      <header className="w-full max-w-2xl flex items-center justify-between py-4 px-2 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Crowd Monitor</h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleWebcam}
            className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
            title={webcamEnabled ? "Disable Monitoring" : "Enable Monitoring"}
          >
            {webcamEnabled ? <EyeOff size={24} className="text-red-500" /> : <Camera size={24} className="text-blue-500" />}
          </button>
          <Users size={24} className="text-gray-600" />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden p-6 mb-6">
        {/* Loading overlay */}
        {loadingModel && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 text-blue-600 text-xl z-10 rounded-2xl flex-col p-4">
            <Loader2 className="animate-spin mb-4" size={36} />
            <p>Loading AI Model...</p>
            <p className="text-sm text-gray-500 mt-2">This might take a moment.</p>
          </div>
        )}

        {/* Webcam off overlay */}
        {!webcamEnabled && !loadingModel && (
          <div className="relative flex flex-col items-center justify-center bg-gray-200 text-gray-600 text-xl rounded-2xl p-8 h-96">
            <Camera size={64} className="mb-6 text-gray-400" />
            <p className="mb-6 text-lg text-gray-500 text-center">Webcam is off. Click the camera icon above to start monitoring.</p>
          </div>
        )}

        {/* Webcam and Canvas Container */}
        {webcamEnabled && !loadingModel && (
          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-lg">
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
          </div>
        )}
      </div>

      {/* Current Count Card */}
      <div className="w-full max-w-2xl bg-gradient-to-r from-green-500 to-green-700 text-white rounded-2xl shadow-xl p-6 text-center mb-6">
        <p className="text-lg font-medium opacity-90">Current Count</p>
        <p className="text-6xl font-extrabold my-2">{detectedPeople}</p>
        <p className="text-xl font-semibold opacity-90">{getCurrentStatusText()}</p>
      </div>

      {/* Recent Activity */}
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Activity</h2>
        <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar"> {/* Added custom-scrollbar */}
          {recentActivities.length > 0 ? (
            recentActivities.map((activity, index) => (
              <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                <span className="text-gray-600 text-sm">{activity.timestamp}</span>
                <span className="font-semibold text-gray-800">Count: {activity.count}</span>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">No recent activity yet. Enable webcam to start monitoring.</p>
          )}
        </div>
      </div>

      {/* Status and Error Messages (Moved to bottom, simplified for new UI) */}
      {alertCooldown && alertStatus !== 'sent' && (
        <p className="mt-6 text-sm text-gray-600">
          Alert cooldown active. Next alert in <span className="font-semibold text-blue-500">{ALERT_COOLDOWN_SECONDS}</span> seconds.
        </p>
      )}
      {alertStatus === 'error' && (
        <p className="mt-6 text-red-600 font-semibold text-lg animate-pulse">
          <XCircle size={18} className="inline mr-2" /> System Error! Check console.
        </p>
      )}
      {alertStatus === 'no-webcam' && (
        <p className="mt-6 text-yellow-600 font-semibold text-lg">
          <WifiOff size={18} className="inline mr-2" /> Webcam Not Ready! Grant permissions.
        </p>
      )}

      {/* Hidden original alert status display - for debugging if needed */}
      {/* <div
        className={`px-5 py-2 rounded-full font-semibold text-lg flex items-center gap-2 transition-colors duration-300 mt-4 ${
          alertStatus === 'alerting'
            ? 'bg-red-600 text-white shadow-red-500/50 animate-pulse'
            : alertStatus === 'warning'
            ? 'bg-yellow-500 text-gray-900 shadow-yellow-500/50'
            : alertStatus === 'sent'
            ? 'bg-green-600 text-white shadow-green-500/50'
            : alertStatus === 'error' || alertStatus === 'no-webcam'
            ? 'bg-red-800 text-white shadow-red-800/50'
            : 'bg-gray-700 text-gray-300'
        }`}
      >
        {alertStatus === 'loading' && <><Loader2 size={20} /> Loading...</>}
        {alertStatus === 'idle' && 'Monitoring Active'}
        {alertStatus === 'warning' && 'High Density Detected'}
        {alertStatus === 'alerting' && <><AlertTriangle size={20} /> CRITICAL ALERT!</>}
        {alertStatus === 'sent' && <><CheckCircle size={20} /> Alert Sent Successfully!</>}
        {alertStatus === 'error' && <><XCircle size={20} /> System Error!</>}
        {alertStatus === 'no-webcam' && <><WifiOff size={20} /> Webcam Not Ready!</>}
      </div> */}
    </div>
  );
}

export default App;
