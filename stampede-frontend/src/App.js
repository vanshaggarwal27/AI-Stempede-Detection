// App.jsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import { Camera, Loader2, AlertTriangle, CheckCircle, WifiOff } from 'lucide-react'; // Icons

// Main App component
function App() {
  const webcamRef = useRef(null); // Reference to the webcam component
  const canvasRef = useRef(null); // Reference to the canvas for drawing detections

  const [model, setModel] = useState(null); // State to hold the loaded COCO-SSD model
  const [loadingModel, setLoadingModel] = useState(true); // State for model loading status
  const [detectedPeople, setDetectedPeople] = useState(0); // State for the number of detected people
  const [alertStatus, setAlertStatus] = useState('idle'); // 'idle', 'warning', 'alerting', 'sent', 'error'
  const [alertCooldown, setAlertCooldown] = useState(false); // To prevent rapid-fire alerts
  const [webcamEnabled, setWebcamEnabled] = useState(false); // State to control webcam activation

  // Configuration for alert thresholds
  const HIGH_DENSITY_THRESHOLD = 0; // Number of people to trigger a 'warning'
  const CRITICAL_DENSITY_THRESHOLD = 10; // Number of people to trigger an 'alert'
  const ALERT_COOLDOWN_SECONDS = 30; // Cooldown period for sending alerts

  // Backend API URL
  const BACKEND_URL = 'http://localhost:5000/api/alert/stampede'; // Ensure this matches your Node.js backend URL

  // Effect to load the COCO-SSD model when the component mounts
  useEffect(() => {
    const loadModel = async () => {
      try {
        // Ensure the CPU backend is registered first for initial loading
        await tf.setBackend('webgl'); // Prefer WebGL for performance
        await tf.ready(); // Ensure TensorFlow.js is ready

        const loadedModel = await cocoSsd.load();
        setModel(loadedModel);
        setLoadingModel(false);
        console.log('COCO-SSD model loaded successfully!');
      } catch (error) {
        console.error('Failed to load COCO-SSD model:', error);
        setLoadingModel(false);
        setAlertStatus('error'); // Indicate a critical error
      }
    };

    loadModel();
  }, []); // Empty dependency array means this runs once on mount

  // Function to detect objects in the video stream
  const detect = useCallback(async () => {
    // console.log('Detect function called.'); // Debug: confirm function is called
    if (webcamRef.current && webcamRef.current.video.readyState === 4 && model) {
      const video = webcamRef.current.video;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      // console.log(`Video readyState: ${video.readyState}, Dimensions: ${videoWidth}x${videoHeight}`); // Debug: video status

      // Set video and canvas dimensions
      video.width = videoWidth;
      video.height = videoHeight;
      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;

      // Perform object detection
      const predictions = await model.detect(video);
      // console.log('Raw predictions:', predictions); // Debug: see all predictions

      // Filter for 'person' objects and update count
      const people = predictions.filter(prediction => prediction.class === 'person');
      setDetectedPeople(people.length);
      // console.log('Detected people:', people.length); // Debug: count of people

      // Draw bounding boxes on the canvas
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, videoWidth, videoHeight); // Clear previous drawings
      ctx.font = '16px Arial';
      ctx.strokeStyle = '#FF0000'; // Red for bounding box
      ctx.lineWidth = 2;
      ctx.fillStyle = '#FF0000'; // Red for text

      people.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.stroke();
        ctx.fillText(`Person (${Math.round(prediction.score * 100)}%)`, x, y > 10 ? y - 5 : 10);
      });

      // Check for alert conditions
      if (!alertCooldown) {
        if (people.length >= CRITICAL_DENSITY_THRESHOLD) {
          setAlertStatus('alerting');
          sendAlert(`Critical stampede risk! ${people.length} people detected.`, people.length);
          setAlertCooldown(true); // Activate cooldown
          setTimeout(() => setAlertCooldown(false), ALERT_COOLDOWN_SECONDS * 1000); // Reset cooldown
        } else if (people.length >= HIGH_DENSITY_THRESHOLD) {
          setAlertStatus('warning');
          // Could send a less critical alert here or just update UI
        } else {
          setAlertStatus('idle');
        }
      }
    } else {
      // console.log('Detect conditions not met:', {
      //   webcamRefCurrent: !!webcamRef.current,
      //   videoReadyState: webcamRef.current?.video?.readyState,
      //   model: !!model
      // }); // Debug: why detect is not running
    }

    // Request next animation frame for continuous detection
    if (webcamEnabled) { // Only loop if webcam is enabled
      requestAnimationFrame(detect);
    }
  }, [model, alertCooldown, webcamEnabled]); // Dependencies for useCallback

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
          timestamp: new Date().toISOString(), // ISO 8601 format for backend
        }),
      });

      if (response.ok) {
        console.log('Alert sent to backend successfully!');
        setAlertStatus('sent');
        setTimeout(() => setAlertStatus('idle'), 5000); // Reset status after 5 seconds
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

  // Effect to start/stop the detection loop when webcamEnabled changes
  useEffect(() => {
    if (webcamEnabled && model) {
      console.log('Starting detection loop...'); // Debug: confirm loop initiation
      requestAnimationFrame(detect);
    } else if (!webcamEnabled) {
      console.log('Stopping detection loop.'); // Debug: confirm loop stopping
      // No explicit stop needed for requestAnimationFrame, it just won't call itself again
    }
  }, [webcamEnabled, model, detect]); // Added detect as a dependency

  // Render UI
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-sans antialiased">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          AI-Driven Stampede Prevention
        </h1>
        <p className="text-lg text-gray-600">Real-time crowd monitoring with automated alerts</p>
      </header>

      <div className="relative w-full max-w-4xl bg-white rounded-lg shadow-xl overflow-hidden p-6 mb-8">
        {loadingModel && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75 text-white text-xl z-10 rounded-lg">
            <Loader2 className="animate-spin mr-2" size={24} /> Loading AI Model...
          </div>
        )}

        {!webcamEnabled && !loadingModel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800 bg-opacity-75 text-white text-xl z-10 rounded-lg">
            <Camera size={48} className="mb-4" />
            <p className="mb-4">Webcam is off. Click "Enable Webcam" to start monitoring.</p>
            <button
              onClick={toggleWebcam}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
            >
              Enable Webcam
            </button>
          </div>
        )}

        <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center">
          <Webcam
            ref={webcamRef}
            muted={true}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)' // Mirror the webcam feed
            }}
            onUserMedia={() => {
              if (webcamEnabled) { // Only start if webcam was intended to be enabled
                console.log('Webcam enabled and ready.');
                requestAnimationFrame(detect); // Start detection loop
              }
            }}
            onUserMediaError={(error) => {
              console.error('Webcam access denied or error:', error);
              setWebcamEnabled(false); // Turn off webcam control
              setAlertStatus('error'); // Indicate an error
              // Display a user-friendly message
              alert("Error accessing webcam. Please ensure you've granted camera permissions and no other application is using it.");
            }}
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0"
            style={{
              transform: 'scaleX(-1)' // Mirror the canvas drawing to match the mirrored video
            }}
          />
        </div>
      </div>

      <div className="w-full max-w-4xl bg-white rounded-lg shadow-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="text-2xl font-semibold text-gray-700">
            People Detected: <span className="text-blue-600">{detectedPeople}</span>
          </div>
          <div
            className={`px-4 py-2 rounded-full font-semibold text-sm ${
              alertStatus === 'alerting'
                ? 'bg-red-500 text-white'
                : alertStatus === 'warning'
                ? 'bg-yellow-500 text-gray-900'
                : alertStatus === 'sent'
                ? 'bg-green-500 text-white'
                : alertStatus === 'error'
                ? 'bg-red-700 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {alertStatus === 'loading' && <><Loader2 className="animate-spin inline mr-2" size={16} /> Loading...</>}
            {alertStatus === 'idle' && 'Monitoring'}
            {alertStatus === 'warning' && 'High Density'}
            {alertStatus === 'alerting' && <><AlertTriangle className="inline mr-1" size={16} /> CRITICAL ALERT!</>}
            {alertStatus === 'sent' && <><CheckCircle className="inline mr-1" size={16} /> Alert Sent!</>}
            {alertStatus === 'error' && <><WifiOff className="inline mr-1" size={16} /> Error!</>}
          </div>
        </div>

        <button
          onClick={toggleWebcam}
          className={`py-3 px-6 rounded-full font-bold shadow-lg transition duration-300 ease-in-out transform hover:scale-105 ${
            webcamEnabled ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
          disabled={loadingModel}
        >
          {webcamEnabled ? 'Disable Webcam' : 'Enable Webcam'}
        </button>
      </div>

      {alertCooldown && alertStatus !== 'sent' && (
        <p className="mt-4 text-sm text-gray-500">
          Alert cooldown active. Next alert can be sent in {ALERT_COOLDOWN_SECONDS} seconds.
        </p>
      )}
      {alertStatus === 'error' && (
        <p className="mt-4 text-red-700 font-semibold">
          An error occurred. Check console for details or ensure backend is running.
        </p>
      )}
    </div>
  );
}

export default App;
