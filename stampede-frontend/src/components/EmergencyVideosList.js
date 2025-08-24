// EmergencyVideosList.js - Display only emergency videos from Gemini analysis
import React, { useState, useEffect } from 'react';
import { AlertTriangle, MapPin, Clock, Shield, Phone, Bot, RefreshCw } from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import { analyzeVideoWithGemini, batchAnalyzeVideos } from '../services/geminiAnalysis';

const EmergencyVideosList = () => {
  const [emergencyReports, setEmergencyReports] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    // Listen to all SOS alerts for real-time updates
    const sosCollection = collection(db, 'sos-alerts');
    const sosQuery = query(sosCollection);

    const unsubscribe = onSnapshot(sosQuery, (snapshot) => {
      const allReportsData = [];
      const emergencyReportsData = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const report = { id: doc.id, ...data };

        // Only include reports with video URLs
        if (data.videoUrl) {
          allReportsData.push(report);

          // Include in emergency list if Gemini analysis confirms it's an emergency
          if (data.geminiAnalysis?.is_emergency === true) {
            emergencyReportsData.push(report);
          }
        }
      });

      // Sort by creation time (newest first)
      const sortedEmergencies = emergencyReportsData.sort((a, b) => {
        const timeA = a.createdAt?.toDate() || new Date(0);
        const timeB = b.createdAt?.toDate() || new Date(0);
        return timeB - timeA;
      });

      const sortedAll = allReportsData.sort((a, b) => {
        const timeA = a.createdAt?.toDate() || new Date(0);
        const timeB = b.createdAt?.toDate() || new Date(0);
        return timeB - timeA;
      });

      setEmergencyReports(sortedEmergencies);
      setAllReports(sortedAll);
      setIsLoading(false);

      console.log(`📊 Emergency Reports: ${sortedEmergencies.length}/${sortedAll.length} videos`);
    });

    return () => unsubscribe();
  }, []);

  const handleAnalyzeAll = async () => {
    setAnalyzing(true);
    
    // Filter reports that haven't been analyzed yet
    const unanalyzedReports = allReports.filter(report => !report.geminiAnalysis);
    
    if (unanalyzedReports.length === 0) {
      alert('All videos have already been analyzed!');
      setAnalyzing(false);
      return;
    }

    console.log(`🤖 Starting analysis of ${unanalyzedReports.length} unanalyzed videos...`);

    try {
      await batchAnalyzeVideos(unanalyzedReports, (completed, total, result) => {
        console.log(`📊 Progress: ${completed}/${total} - ${result.success ? 'Success' : 'Failed'}: ${result.reportId}`);
      });

      alert(`✅ Analysis completed! Processed ${unanalyzedReports.length} videos.`);
    } catch (error) {
      console.error('❌ Batch analysis failed:', error);
      alert(`❌ Analysis failed: ${error.message}`);
    }

    setAnalyzing(false);
  };

  const handleAnalyzeSingle = async (report) => {
    if (report.geminiAnalysis) {
      alert('This video has already been analyzed!');
      return;
    }

    setAnalyzing(true);
    try {
      const result = await analyzeVideoWithGemini(report.videoUrl, report.id);
      if (result.success) {
        alert(`✅ Analysis completed for report ${report.id}`);
      } else {
        alert(`❌ Analysis failed: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Single analysis failed:', error);
      alert(`❌ Analysis failed: ${error.message}`);
    }
    setAnalyzing(false);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    return timestamp.toDate().toLocaleString();
  };

  const getServiceIcon = (service) => {
    switch (service) {
      case 'Police': return '👮';
      case 'Ambulance': return '🚑';
      case 'Fire Brigade': return '🚒';
      default: return '🚨';
    }
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'High': return 'text-green-600 bg-green-50 border-green-200';
      case 'Medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Low': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white/90 backdrop-blur-md rounded-xl border border-yellow-200 p-6 shadow-xl">
        <div className="text-center py-8">
          <RefreshCw className="text-yellow-500 mx-auto mb-4 animate-spin" size={48} />
          <p className="text-gray-800 text-lg font-bold mb-2">Loading Emergency Videos</p>
          <p className="text-gray-600">Connecting to Firebase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="bg-white/90 backdrop-blur-md rounded-xl border border-red-200 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="text-red-500" size={24} />
            <div>
              <h2 className="text-gray-800 font-bold text-xl">Emergency Videos</h2>
              <p className="text-red-600 text-sm">AI-Verified Emergency Situations Only</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="text-red-600 font-bold text-lg">{emergencyReports.length}</span>
              <span className="text-red-500 text-xs ml-1">Active</span>
            </div>

            <button
              onClick={handleAnalyzeAll}
              disabled={analyzing}
              className="flex items-center space-x-2 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Bot size={16} />
              <span>{analyzing ? 'Analyzing...' : 'Analyze All'}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <Bot className="text-yellow-600" size={16} />
            <span className="text-gray-600">Powered by Google Gemini AI</span>
          </div>
          <div className="flex items-center space-x-2">
            <Shield className="text-green-600" size={16} />
            <span className="text-gray-600">Real-time Analysis</span>
          </div>
        </div>
      </div>

      {/* Emergency Videos List */}
      {emergencyReports.length === 0 ? (
        <div className="bg-white/90 backdrop-blur-md rounded-xl border border-yellow-200 p-8 shadow-xl text-center">
          <AlertTriangle className="text-gray-400 mx-auto mb-4" size={64} />
          <h3 className="text-gray-800 font-bold text-lg mb-2">No Emergency Videos</h3>
          <p className="text-gray-600 mb-4">
            {allReports.length === 0
              ? 'No SOS videos have been uploaded yet.'
              : `${allReports.length} videos uploaded, but none classified as emergencies by AI.`
            }
          </p>
          {allReports.filter(r => !r.geminiAnalysis).length > 0 && (
            <p className="text-yellow-600 text-sm">
              {allReports.filter(r => !r.geminiAnalysis).length} videos pending analysis.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-6">
          {emergencyReports.map((report) => (
            <div
              key={report.id}
              className="bg-white/90 backdrop-blur-md rounded-xl border border-red-200 p-6 shadow-xl hover:border-red-300 transition-colors"
            >
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Video Player */}
                <div className="lg:col-span-1">
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                    <video
                      src={report.videoUrl}
                      controls
                      className="w-full h-full object-cover"
                      poster="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3e%3crect width='400' height='300' fill='%23000'/%3e%3ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23666' font-size='16'%3eEmergency Video%3c/text%3e%3c/svg%3e"
                    />
                    <div className="absolute top-2 left-2 bg-red-600/90 text-white px-2 py-1 rounded text-xs font-bold">
                      🚨 EMERGENCY
                    </div>
                    {report.geminiAnalysis?.confidence && (
                      <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold border ${getConfidenceColor(report.geminiAnalysis.confidence)}`}>
                        {report.geminiAnalysis.confidence} Confidence
                      </div>
                    )}
                  </div>
                </div>

                {/* Emergency Details */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-gray-800 font-bold text-lg mb-1">
                        Emergency Report #{report.id.slice(-6)}
                      </h3>
                      <p className="text-gray-600 text-sm flex items-center">
                        <Clock size={14} className="mr-1" />
                        {formatTimestamp(report.createdAt)}
                      </p>
                    </div>

                    {report.geminiAnalysis?.primary_service && (
                      <div className="flex items-center space-x-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <span className="text-lg">{getServiceIcon(report.geminiAnalysis.primary_service)}</span>
                        <span className="text-red-600 font-bold text-sm">{report.geminiAnalysis.primary_service}</span>
                      </div>
                    )}
                  </div>

                  {/* AI Analysis */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Bot className="text-yellow-600" size={16} />
                      <span className="text-yellow-700 font-bold text-sm">Gemini AI Analysis</span>
                    </div>
                    <p className="text-gray-800 text-sm mb-2">"{report.geminiAnalysis?.reason}"</p>

                    <div className="flex items-center space-x-4 text-xs">
                      <span className="text-green-600">✅ Verified Emergency</span>
                      <span className="text-yellow-600">Service: {report.geminiAnalysis?.primary_service}</span>
                      <span className={`${getConfidenceColor(report.geminiAnalysis?.confidence).split(' ')[0]}`}>
                        Confidence: {report.geminiAnalysis?.confidence}
                      </span>
                    </div>
                  </div>

                  {/* Location & Contact */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2 mb-2">
                        <MapPin className="text-cyan-600" size={16} />
                        <span className="text-cyan-700 font-bold text-sm">Location</span>
                      </div>
                      <p className="text-gray-700 text-sm">
                        {report.location?.address || 'Location not available'}
                      </p>
                      {report.location?.latitude && report.location?.longitude && (
                        <p className="text-gray-500 text-xs mt-1">
                          {report.location.latitude.toFixed(4)}, {report.location.longitude.toFixed(4)}
                        </p>
                      )}
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2 mb-2">
                        <Phone className="text-green-600" size={16} />
                        <span className="text-green-700 font-bold text-sm">Reporter</span>
                      </div>
                      <p className="text-gray-700 text-sm">
                        User {report.userId?.slice(-4) || 'Anonymous'}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">Emergency Contact Available</p>
                    </div>
                  </div>

                  {/* Message */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-gray-800 text-sm">
                      <strong>Report:</strong> {report.message || 'No additional message provided'}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-3 pt-2">
                    <button
                      onClick={() => window.open(`https://maps.google.com/maps?q=${report.location?.latitude},${report.location?.longitude}`, '_blank')}
                      disabled={!report.location?.latitude}
                      className="flex items-center space-x-2 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm transition-colors"
                    >
                      <MapPin size={14} />
                      <span>View Location</span>
                    </button>

                    <button
                      onClick={() => handleAnalyzeSingle(report)}
                      disabled={analyzing || report.geminiAnalysis}
                      className="flex items-center space-x-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm transition-colors"
                    >
                      <Bot size={14} />
                      <span>{report.geminiAnalysis ? 'Analyzed' : 'Re-analyze'}</span>
                    </button>

                    <div className="flex-1"></div>
                    
                    <div className="text-right">
                      <p className="text-gray-600 text-xs">
                        Analyzed: {report.geminiAnalysis?.analyzedAt?.toDate().toLocaleString() || 'Processing...'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmergencyVideosList;
