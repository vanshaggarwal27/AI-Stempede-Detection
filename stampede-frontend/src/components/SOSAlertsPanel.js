// components/SOSAlertsPanel.js - Admin Panel for SOS Alerts
import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Eye, 
  MapPin, 
  Clock, 
  Users, 
  MessageSquare, 
  Filter,
  Download,
  RefreshCw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ExternalLink,
  Phone,
  Mail
} from 'lucide-react';

const SOSAlertsPanel = () => {
  const [sosReports, setSOSReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [filter, setFilter] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isProcessing, setIsProcessing] = useState({});

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // Fetch SOS reports
  const fetchSOSReports = useCallback(async () => {
    try {
      setLoading(true);
      const endpoint = filter === 'pending' ? '/api/sos/pending' : '/api/sos/all';
      const queryParams = new URLSearchParams({
        page: currentPage,
        limit: 10,
        ...(filter !== 'pending' && { status: filter }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(`${API_BASE_URL}${endpoint}?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch SOS reports');

      const data = await response.json();
      setSOSReports(data.reports || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Error fetching SOS reports:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filter, searchTerm]);

  // Fetch statistics
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sos/stats?timeframe=week`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats || {});
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchSOSReports();
    fetchStats();
  }, [fetchSOSReports, fetchStats]);

  // Auto-refresh every 30 seconds for pending reports
  useEffect(() => {
    if (filter === 'pending') {
      const interval = setInterval(fetchSOSReports, 30000);
      return () => clearInterval(interval);
    }
  }, [filter, fetchSOSReports]);

  // Handle admin review
  const handleReview = async (sosId, decision, adminNotes = '') => {
    try {
      setIsProcessing(prev => ({ ...prev, [sosId]: true }));

      const response = await fetch(`${API_BASE_URL}/api/sos/${sosId}/review`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ decision, adminNotes })
      });

      if (!response.ok) throw new Error('Failed to review SOS report');

      const result = await response.json();
      
      // Show success message
      alert(`SOS report ${decision} successfully! ${result.alertSent ? `Alerts sent to ${result.alertSent.recipientCount} users.` : ''}`);
      
      // Refresh the list
      fetchSOSReports();
      setSelectedReport(null);
      
    } catch (error) {
      console.error('Error reviewing SOS report:', error);
      alert('Failed to review SOS report. Please try again.');
    } finally {
      setIsProcessing(prev => ({ ...prev, [sosId]: false }));
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
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'text-orange-600 bg-orange-100';
      case 'approved': return 'text-green-600 bg-green-100';
      case 'rejected': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                SOS Alert Management
              </h1>
              <p className="text-gray-300 mt-2">Review and manage emergency reports from users</p>
            </div>
            
            <button
              onClick={fetchSOSReports}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <RefreshCw size={20} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-orange-500/30 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-300 text-sm font-medium">Pending Review</p>
                  <p className="text-orange-400 text-3xl font-bold">{stats.pending || 0}</p>
                </div>
                <AlertTriangle className="text-orange-400" size={32} />
              </div>
            </div>

            <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-green-500/30 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-300 text-sm font-medium">Approved</p>
                  <p className="text-green-400 text-3xl font-bold">{stats.approved || 0}</p>
                </div>
                <CheckCircle className="text-green-400" size={32} />
              </div>
            </div>

            <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-red-500/30 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-300 text-sm font-medium">Rejected</p>
                  <p className="text-red-400 text-3xl font-bold">{stats.rejected || 0}</p>
                </div>
                <XCircle className="text-red-400" size={32} />
              </div>
            </div>

            <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-blue-500/30 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-300 text-sm font-medium">Total (Week)</p>
                  <p className="text-blue-400 text-3xl font-bold">{stats.total || 0}</p>
                </div>
                <Users className="text-blue-400" size={32} />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center space-x-2">
              <Filter className="text-gray-400" size={20} />
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-black/40 backdrop-blur-xl border border-gray-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="">All Reports</option>
              </select>
            </div>

            <input
              type="text"
              placeholder="Search by location, message, or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-black/40 backdrop-blur-xl border border-gray-600 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 max-w-md"
            />
          </div>
        </div>

        {/* SOS Reports List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Reports List */}
          <div className="lg:col-span-2">
            <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 overflow-hidden">
              <div className="p-6 border-b border-gray-700/50">
                <h2 className="text-xl font-bold text-white">
                  {filter === 'pending' ? 'Pending Reports' : 'All Reports'}
                </h2>
              </div>

              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin mx-auto mb-4 w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  <p className="text-gray-400">Loading reports...</p>
                </div>
              ) : sosReports.length === 0 ? (
                <div className="p-8 text-center">
                  <AlertTriangle className="mx-auto mb-4 text-gray-500" size={48} />
                  <p className="text-gray-400">No reports found</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700/50">
                  {sosReports.map((report) => (
                    <div
                      key={report._id}
                      className={`p-6 hover:bg-gray-800/50 transition-colors cursor-pointer ${
                        selectedReport?._id === report._id ? 'bg-blue-900/30 border-l-4 border-blue-500' : ''
                      }`}
                      onClick={() => setSelectedReport(report)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(report.metadata.priority)}`}>
                            {report.metadata.priority.toUpperCase()}
                          </div>
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                            {report.status.toUpperCase()}
                          </div>
                        </div>
                        <span className="text-gray-400 text-sm">{formatTimeAgo(report.incident.timestamp)}</span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-gray-300">
                          <Users size={16} />
                          <span className="font-medium">{report.userInfo.name}</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-gray-400">{report.userInfo.phone}</span>
                        </div>

                        <div className="flex items-center space-x-2 text-gray-300">
                          <MapPin size={16} />
                          <span className="text-sm">{report.incident.location.address || 'Location unavailable'}</span>
                        </div>

                        <div className="flex items-start space-x-2 text-gray-300">
                          <MessageSquare size={16} className="mt-0.5" />
                          <span className="text-sm line-clamp-2">{report.incident.message}</span>
                        </div>

                        <div className="flex items-center space-x-2 text-gray-400 text-sm">
                          <Clock size={14} />
                          <span>Video: {report.incident.videoDuration || 15}s</span>
                          <span>•</span>
                          <span className="capitalize">{report.metadata.category}</span>
                        </div>
                      </div>

                      {report.status === 'pending' && (
                        <div className="flex items-center space-x-2 mt-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReview(report._id, 'approved');
                            }}
                            disabled={isProcessing[report._id]}
                            className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm transition-colors"
                          >
                            <CheckCircle size={14} />
                            <span>Approve</span>
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReview(report._id, 'rejected');
                            }}
                            disabled={isProcessing[report._id]}
                            className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm transition-colors"
                          >
                            <XCircle size={14} />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-6 border-t border-gray-700/50 flex items-center justify-between">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    Previous
                  </button>
                  
                  <span className="text-gray-300">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Selected Report Detail */}
          <div className="lg:col-span-1">
            {selectedReport ? (
              <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 overflow-hidden">
                <div className="p-6 border-b border-gray-700/50">
                  <h3 className="text-xl font-bold text-white">Report Details</h3>
                </div>

                <div className="p-6 space-y-6">
                  {/* Video Player */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-white">Emergency Video</h4>
                    <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                      <video
                        src={selectedReport.incident.videoUrl}
                        controls
                        className="w-full h-full object-cover"
                        poster={selectedReport.incident.videoThumbnail}
                      />
                    </div>
                    <button
                      onClick={() => setShowVideoModal(true)}
                      className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 text-sm"
                    >
                      <ExternalLink size={14} />
                      <span>Open in full screen</span>
                    </button>
                  </div>

                  {/* User Information */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-white">Reporter Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Name:</span>
                        <span className="text-white">{selectedReport.userInfo.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Phone:</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-white">{selectedReport.userInfo.phone}</span>
                          <button className="text-blue-400 hover:text-blue-300">
                            <Phone size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Email:</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-white">{selectedReport.userInfo.email}</span>
                          <button className="text-blue-400 hover:text-blue-300">
                            <Mail size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Location Information */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-white">Location Details</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-400">Address:</span>
                        <p className="text-white mt-1">{selectedReport.incident.location.address || 'Address not available'}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Coordinates:</span>
                        <span className="text-white font-mono text-xs">
                          {selectedReport.incident.location.latitude.toFixed(6)}, {selectedReport.incident.location.longitude.toFixed(6)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Accuracy:</span>
                        <span className="text-white">{selectedReport.incident.location.accuracy}m</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {
                        const lat = selectedReport.incident.location.latitude;
                        const lng = selectedReport.incident.location.longitude;
                        window.open(`https://maps.google.com/maps?q=${lat},${lng}`, '_blank');
                      }}
                      className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 text-sm"
                    >
                      <MapPin size={14} />
                      <span>View on Google Maps</span>
                    </button>
                  </div>

                  {/* Incident Details */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-white">Incident Report</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-400">Message:</span>
                        <p className="text-white mt-1 bg-gray-800/50 p-3 rounded-lg">
                          {selectedReport.incident.message}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Category:</span>
                        <span className="text-white capitalize">{selectedReport.metadata.category}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Priority:</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(selectedReport.metadata.priority)}`}>
                          {selectedReport.metadata.priority.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Reported:</span>
                        <span className="text-white">{new Date(selectedReport.incident.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Admin Actions */}
                  {selectedReport.status === 'pending' && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-white">Admin Actions</h4>
                      <div className="space-y-2">
                        <button
                          onClick={() => handleReview(selectedReport._id, 'approved')}
                          disabled={isProcessing[selectedReport._id]}
                          className="w-full flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-3 rounded-lg transition-colors"
                        >
                          <CheckCircle size={20} />
                          <span>Approve & Send Alerts</span>
                        </button>
                        
                        <button
                          onClick={() => handleReview(selectedReport._id, 'rejected')}
                          disabled={isProcessing[selectedReport._id]}
                          className="w-full flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-3 rounded-lg transition-colors"
                        >
                          <XCircle size={20} />
                          <span>Reject Report</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Alert Status */}
                  {selectedReport.alertSent?.isSent && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-white">Alert Status</h4>
                      <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-3">
                        <div className="flex items-center space-x-2 text-green-400 mb-2">
                          <CheckCircle size={16} />
                          <span className="font-medium">Alerts Sent Successfully</span>
                        </div>
                        <div className="text-sm text-green-300">
                          <p>Recipients: {selectedReport.alertSent.recipientCount} users</p>
                          <p>Sent at: {new Date(selectedReport.alertSent.sentAt).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-8 text-center">
                <Eye className="mx-auto mb-4 text-gray-500" size={48} />
                <p className="text-gray-400">Select a report to view details</p>
              </div>
            )}
          </div>
        </div>

        {/* Video Modal */}
        {showVideoModal && selectedReport && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-black rounded-lg overflow-hidden max-w-4xl w-full max-h-[90vh]">
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-white font-semibold">Emergency Video - {selectedReport.userInfo.name}</h3>
                <button
                  onClick={() => setShowVideoModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <XCircle size={24} />
                </button>
              </div>
              <div className="p-4">
                <video
                  src={selectedReport.incident.videoUrl}
                  controls
                  autoPlay
                  className="w-full h-auto"
                  poster={selectedReport.incident.videoThumbnail}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SOSAlertsPanel;
