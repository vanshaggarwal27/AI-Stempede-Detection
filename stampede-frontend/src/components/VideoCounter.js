// VideoCounter.js - Live Video Counter Component
import React, { useState, useEffect } from 'react';
import { Video, Activity, AlertTriangle, CheckCircle, Clock, BarChart3 } from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase/config';

const VideoCounter = () => {
  const [videoStats, setVideoStats] = useState({
    total: 0,
    analyzed: 0,
    emergencies: 0,
    nonEmergencies: 0,
    pending: 0,
    failed: 0
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Listen to SOS alerts collection for real-time updates
    const sosCollection = collection(db, 'sos-alerts');
    const sosQuery = query(sosCollection);

    const unsubscribe = onSnapshot(sosQuery, (snapshot) => {
      let total = 0;
      let analyzed = 0;
      let emergencies = 0;
      let nonEmergencies = 0;
      let pending = 0;
      let failed = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Count only documents with video URLs
        if (data.videoUrl) {
          total++;
          
          if (data.geminiAnalysis) {
            analyzed++;
            
            if (data.geminiAnalysis.error) {
              failed++;
            } else if (data.geminiAnalysis.is_emergency) {
              emergencies++;
            } else {
              nonEmergencies++;
            }
          } else {
            pending++;
          }
        }
      });

      setVideoStats({
        total,
        analyzed,
        emergencies,
        nonEmergencies,
        pending,
        failed
      });
      
      setIsLoading(false);
    }, (error) => {
      console.error('❌ Error listening to video stats:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getAnalysisProgress = () => {
    if (videoStats.total === 0) return 0;
    return ((videoStats.analyzed / videoStats.total) * 100).toFixed(1);
  };

  const getEmergencyRate = () => {
    if (videoStats.analyzed === 0) return 0;
    return ((videoStats.emergencies / videoStats.analyzed) * 100).toFixed(1);
  };

  if (isLoading) {
    return (
      <div className="bg-white/90 backdrop-blur-md rounded-xl border border-yellow-200 p-4 shadow-xl">
        <div className="flex items-center space-x-3 mb-3">
          <Video className="text-yellow-500 animate-pulse" size={20} />
          <h3 className="text-gray-800 font-bold text-sm">Video Analytics</h3>
        </div>
        <div className="text-center py-4">
          <Activity className="text-gray-500 mx-auto mb-2 animate-spin" size={24} />
          <p className="text-gray-600 text-xs">Loading statistics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/90 backdrop-blur-md rounded-xl border border-yellow-200 p-4 shadow-xl">
      <div className="flex items-center space-x-3 mb-4">
        <Video className="text-yellow-600" size={20} />
        <h3 className="text-gray-800 font-bold text-sm">Live Video Analytics</h3>
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
          <div className="text-yellow-600 text-lg font-bold">{videoStats.total}</div>
          <div className="text-yellow-500 text-xs">Total Videos</div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
          <div className="text-purple-600 text-lg font-bold">{videoStats.analyzed}</div>
          <div className="text-purple-500 text-xs">Analyzed</div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <div className="text-red-600 text-lg font-bold">{videoStats.emergencies}</div>
          <div className="text-red-500 text-xs">Emergencies</div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <div className="text-green-600 text-lg font-bold">{videoStats.nonEmergencies}</div>
          <div className="text-green-500 text-xs">Non-Emergency</div>
        </div>
      </div>

      {/* Progress Indicators */}
      <div className="space-y-3">
        {/* Analysis Progress */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-gray-600 text-xs flex items-center">
              <BarChart3 size={12} className="mr-1" />
              Analysis Progress
            </span>
            <span className="text-yellow-600 text-xs font-bold">{getAnalysisProgress()}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-yellow-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${getAnalysisProgress()}%` }}
            ></div>
          </div>
        </div>

        {/* Emergency Rate */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-gray-600 text-xs flex items-center">
              <AlertTriangle size={12} className="mr-1" />
              Emergency Rate
            </span>
            <span className="text-red-600 text-xs font-bold">{getEmergencyRate()}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-red-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${getEmergencyRate()}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="flex justify-between items-center mt-4 pt-3 border-t border-yellow-200">
        <div className="flex items-center space-x-1">
          <Clock size={12} className="text-yellow-500" />
          <span className="text-yellow-600 text-xs">{videoStats.pending} Pending</span>
        </div>

        {videoStats.failed > 0 && (
          <div className="flex items-center space-x-1">
            <AlertTriangle size={12} className="text-red-500" />
            <span className="text-red-600 text-xs">{videoStats.failed} Failed</span>
          </div>
        )}

        <div className="flex items-center space-x-1">
          <CheckCircle size={12} className="text-green-500" />
          <span className="text-green-600 text-xs">Live</span>
        </div>
      </div>

      {/* Real-time indicator */}
      <div className="text-center mt-3 pt-2 border-t border-yellow-200">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-1 h-1 bg-green-500 rounded-full animate-ping"></div>
          <span className="text-gray-600 text-xs">Auto-updating every second</span>
        </div>
      </div>
    </div>
  );
};

export default VideoCounter;
