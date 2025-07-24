import React, { useState, useEffect } from 'react';
import { testFirestoreConnection, listenToSOSReports, createSOSReport } from '../firebase/config';
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';

const FirebaseTest = () => {
  const [testResults, setTestResults] = useState({
    connection: null,
    documents: [],
    error: null,
    loading: true
  });
  const [sosReports, setSOSReports] = useState([]);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    runConnectionTest();
  }, []);

  const runConnectionTest = async () => {
    try {
      setTestResults(prev => ({ ...prev, loading: true, error: null }));
      
      console.log('🧪 Running Firebase connection test...');
      const result = await testFirestoreConnection();
      
      setTestResults({
        connection: result.success,
        documents: [],
        error: result.error || null,
        loading: false
      });

      if (result.success) {
        console.log('✅ Firebase connection test passed!');
        startListening();
      } else {
        console.error('❌ Firebase connection test failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Test error:', error);
      setTestResults({
        connection: false,
        documents: [],
        error: error.message,
        loading: false
      });
    }
  };

  const startListening = () => {
    if (listening) return;
    
    console.log('👂 Starting Firebase listener...');
    setListening(true);
    
    const unsubscribe = listenToSOSReports((reports) => {
      console.log('📥 Firebase listener received:', reports.length, 'reports');
      setSOSReports(reports || []);
    });

    // Store unsubscribe function for cleanup
    return unsubscribe;
  };

  const addTestAlert = async () => {
    try {
      console.log('📝 Adding test SOS alert...');
      
      const testAlert = {
        userId: `test_user_${Date.now()}`,
        message: 'Test emergency situation - Firebase integration test',
        location: {
          latitude: 28.7041,
          longitude: 77.1025,
          accuracy: 5.0
        },
        videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
        deviceInfo: {
          platform: 'web',
          version: '1.0.0',
          model: 'Test Device'
        }
      };
      
      const docId = await createSOSReport(testAlert);
      console.log('✅ Test alert created with ID:', docId);
      alert(`✅ Test SOS alert created successfully!\nDocument ID: ${docId}`);
      
    } catch (error) {
      console.error('❌ Failed to create test alert:', error);
      alert(`❌ Failed to create test alert: ${error.message}`);
    }
  };

  return (
    <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Firebase Connection Test</h3>
        <button
          onClick={runConnectionTest}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Retest
        </button>
      </div>

      {/* Connection Status */}
      <div className="space-y-3">
        <div className="flex items-center space-x-3">
          {testResults.loading ? (
            <Loader2 className="animate-spin text-blue-400" size={20} />
          ) : testResults.connection ? (
            <CheckCircle className="text-green-400" size={20} />
          ) : (
            <XCircle className="text-red-400" size={20} />
          )}
          <span className="text-white font-medium">
            Firebase Connection: {
              testResults.loading ? 'Testing...' :
              testResults.connection ? 'Connected' : 'Failed'
            }
          </span>
        </div>

        {testResults.error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3">
            <div className="flex items-center space-x-2 text-red-400">
              <AlertTriangle size={16} />
              <span className="font-medium">Connection Error:</span>
            </div>
            <p className="text-red-300 text-sm mt-1">{testResults.error}</p>
          </div>
        )}

        {/* Real-time Data */}
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white font-medium">sos-alerts Collection</h4>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${listening ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-sm text-gray-400">
                {listening ? 'Listening' : 'Not connected'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Documents found:</span>
              <span className="text-white font-mono">{sosReports.length}</span>
            </div>
            
            {sosReports.length > 0 ? (
              <div className="space-y-2">
                <p className="text-green-400 text-sm">✅ Real-time data receiving!</p>
                {sosReports.slice(0, 3).map((report, index) => (
                  <div key={report.id || index} className="bg-gray-700/50 rounded p-2 text-xs">
                    <div className="text-white font-mono">ID: {report.id || 'unknown'}</div>
                    <div className="text-gray-300">User: {report.userId || 'N/A'}</div>
                    <div className="text-gray-400">Message: {report.message?.slice(0, 50) || 'N/A'}...</div>
                  </div>
                ))}
                {sosReports.length > 3 && (
                  <p className="text-gray-400 text-xs">...and {sosReports.length - 3} more</p>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-400 text-sm">No documents found in sos-alerts collection</p>
                <button
                  onClick={addTestAlert}
                  className="mt-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                >
                  Add Test Alert
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Collection Info */}
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 text-sm">
          <div className="text-blue-300 font-medium mb-2">Firebase Configuration:</div>
          <div className="space-y-1 text-blue-200">
            <div>Project: crowd-monitoring-e1f70</div>
            <div>Collection: sos-alerts</div>
            <div>Real-time: Firestore listeners active</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirebaseTest;
