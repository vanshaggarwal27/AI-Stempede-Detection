import React from 'react';
import { AlertTriangle, Clock, MapPin } from 'lucide-react';

const SOSAlertsPanel = () => {
  return (
    <div className="bg-black/40 backdrop-blur-3xl rounded-3xl border border-gray-700/50 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <AlertTriangle className="text-red-400" size={24} />
        <h2 className="text-white font-bold text-xl">SOS Alerts Panel</h2>
      </div>
      
      <div className="text-center py-8">
        <AlertTriangle className="mx-auto mb-4 text-gray-500" size={48} />
        <p className="text-gray-400">No active SOS alerts</p>
        <p className="text-gray-500 text-sm mt-2">Emergency reports will appear here</p>
      </div>
    </div>
  );
};

export default SOSAlertsPanel;
