import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  MapPin, 
  Clock, 
  Shield, 
  Send,
  X,
  Loader2,
  CheckCircle
} from 'lucide-react';
import { createAlert, getUserLocation } from '../firebase/config';

const CreateAlertForm = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: '',
    severity: 'medium',
    source: 'admin_panel',
    radius: 500,
    location: {
      latitude: 0,
      longitude: 0,
      address: ''
    },
    expiresAt: ''
  });

  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  // Alert types
  const alertTypes = [
    { value: 'fire', label: 'Fire Alert', icon: '🔥' },
    { value: 'medical', label: 'Medical Alert', icon: '🚑' },
    { value: 'crowd_warning', label: 'Crowd Warning', icon: '👥' },
    { value: 'weather', label: 'Weather Alert', icon: '🌦️' },
    { value: 'security', label: 'Security Alert', icon: '🔒' },
    { value: 'general', label: 'General Alert', icon: '📢' }
  ];

  // Set default expiration to 24 hours from now
  useEffect(() => {
    if (isOpen) {
      const tomorrow = new Date();
      tomorrow.setHours(tomorrow.getHours() + 24);
      setFormData(prev => ({
        ...prev,
        expiresAt: tomorrow.toISOString().slice(0, 16)
      }));
    }
  }, [isOpen]);

  // Get current location
  const getCurrentLocation = async () => {
    setGettingLocation(true);
    setLocationError('');

    try {
      const location = await getUserLocation();
      
      if (location.success) {
        setFormData(prev => ({
          ...prev,
          location: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            address: location.address || `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`
          }
        }));
      } else {
        setLocationError(location.error || 'Failed to get location');
      }
    } catch (error) {
      setLocationError('Error getting location: ' + error.message);
    } finally {
      setGettingLocation(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.message || !formData.type) {
      alert('Please fill in all required fields');
      return;
    }

    if (!formData.location.latitude || !formData.location.longitude) {
      alert('Please set a location for the alert');
      return;
    }

    setLoading(true);

    try {
      const alertData = {
        ...formData,
        isActive: true,
        location: {
          latitude: parseFloat(formData.location.latitude),
          longitude: parseFloat(formData.location.longitude),
          address: formData.location.address
        },
        radius: parseInt(formData.radius),
        expiresAt: new Date(formData.expiresAt)
      };

      const alertId = await createAlert(alertData);
      
      console.log('✅ Alert created successfully:', alertId);
      
      if (onSuccess) {
        onSuccess(alertId);
      }
      
      // Reset form
      setFormData({
        title: '',
        message: '',
        type: '',
        severity: 'medium',
        source: 'admin_panel',
        radius: 500,
        location: { latitude: 0, longitude: 0, address: '' },
        expiresAt: ''
      });
      
      onClose();
      
    } catch (error) {
      console.error('❌ Error creating alert:', error);
      alert('Failed to create alert: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black/90 backdrop-blur-xl rounded-2xl border border-gray-700/50 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-red-500 to-orange-600 rounded-lg">
                <AlertTriangle className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Create New Alert</h2>
                <p className="text-gray-400 text-sm">Send emergency alerts to nearby users</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Alert Type */}
          <div className="space-y-3">
            <label className="text-white font-semibold">Alert Type *</label>
            <div className="grid grid-cols-2 gap-3">
              {alertTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type: type.value }))}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    formData.type === type.value
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-gray-800/50 border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{type.icon}</span>
                    <span className="font-medium text-sm">{type.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-white font-semibold">Alert Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter alert title (e.g., Emergency Evacuation Required)"
              className="w-full p-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <label className="text-white font-semibold">Alert Message *</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Enter detailed alert message..."
              rows={4}
              className="w-full p-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              required
            />
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <label className="text-white font-semibold">Severity Level</label>
            <div className="flex space-x-3">
              {['low', 'medium', 'high'].map((severity) => (
                <button
                  key={severity}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, severity }))}
                  className={`px-4 py-2 rounded-lg border font-medium transition-all ${
                    formData.severity === severity
                      ? severity === 'high' 
                        ? 'bg-red-600/20 border-red-500 text-red-300'
                        : severity === 'medium'
                        ? 'bg-yellow-600/20 border-yellow-500 text-yellow-300'
                        : 'bg-green-600/20 border-green-500 text-green-300'
                      : 'bg-gray-800/50 border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {severity.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-3">
            <label className="text-white font-semibold">Alert Location *</label>
            
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={getCurrentLocation}
                disabled={gettingLocation}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {gettingLocation ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <MapPin size={16} />
                )}
                <span>{gettingLocation ? 'Getting Location...' : 'Use Current Location'}</span>
              </button>
            </div>

            {locationError && (
              <p className="text-red-400 text-sm">{locationError}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-sm">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={formData.location.latitude}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    location: { ...prev.location, latitude: e.target.value }
                  }))}
                  className="w-full p-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={formData.location.longitude}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    location: { ...prev.location, longitude: e.target.value }
                  }))}
                  className="w-full p-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-sm">Address</label>
              <input
                type="text"
                value={formData.location.address}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  location: { ...prev.location, address: e.target.value }
                }))}
                placeholder="Enter location address"
                className="w-full p-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Radius */}
          <div className="space-y-2">
            <label className="text-white font-semibold">Alert Radius (meters)</label>
            <select
              value={formData.radius}
              onChange={(e) => setFormData(prev => ({ ...prev, radius: parseInt(e.target.value) }))}
              className="w-full p-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={100}>100m - Very Small Area</option>
              <option value={250}>250m - Small Area</option>
              <option value={500}>500m - Medium Area (Default)</option>
              <option value={1000}>1km - Large Area</option>
              <option value={2000}>2km - Very Large Area</option>
              <option value={5000}>5km - City Block</option>
            </select>
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <label className="text-white font-semibold">Alert Expires At</label>
            <input
              type="datetime-local"
              value={formData.expiresAt}
              onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
              className="w-full p-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center space-x-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg transition-all font-semibold"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
              <span>{loading ? 'Creating Alert...' : 'Create & Send Alert'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Warning Notice */}
          <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4 mt-6">
            <div className="flex items-start space-x-3">
              <Shield className="text-yellow-400 mt-0.5" size={20} />
              <div>
                <p className="text-yellow-300 font-medium text-sm">Emergency Alert Notice</p>
                <p className="text-yellow-200 text-sm mt-1">
                  This alert will be sent immediately to all users within the specified radius. 
                  Please ensure all information is accurate before sending.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAlertForm;
