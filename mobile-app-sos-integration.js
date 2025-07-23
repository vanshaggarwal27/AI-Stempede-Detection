// Mobile App SOS API Integration
// React Native / Expo implementation

import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

class SOSService {
  constructor() {
    this.API_BASE_URL = 'https://your-backend-domain.com/api';
    this.storage = getStorage();
  }

  /**
   * Complete SOS submission flow
   * @param {string} userId - Current user ID
   * @param {string} videoUri - Local video file URI
   * @param {string} message - Emergency message
   * @returns {Promise<Object>} - API response
   */
  async submitSOSReport(userId, videoUri, message) {
    try {
      console.log('Starting SOS submission...');
      
      // Step 1: Get current location
      const location = await this.getCurrentLocation();
      
      // Step 2: Upload video to Firebase
      const { videoUrl, videoDuration } = await this.uploadVideoToFirebase(videoUri, userId);
      
      // Step 3: Get device info
      const deviceInfo = await this.getDeviceInfo();
      
      // Step 4: Submit to your backend
      const response = await this.sendSOSToBackend({
        userId,
        videoUrl,
        videoDuration,
        location,
        message,
        deviceInfo
      });
      
      console.log('SOS submitted successfully:', response);
      return response;
      
    } catch (error) {
      console.error('SOS submission failed:', error);
      throw error;
    }
  }

  /**
   * Get current GPS location
   * @returns {Promise<Object>} - Location coordinates
   */
  async getCurrentLocation() {
    try {
      // Check permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        maximumAge: 10000,
        timeout: 15000,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 5.0
      };
      
    } catch (error) {
      console.error('Location error:', error);
      throw new Error('Failed to get location');
    }
  }

  /**
   * Upload video to Firebase Storage
   * @param {string} videoUri - Local video file URI
   * @param {string} userId - User ID for file naming
   * @returns {Promise<Object>} - Upload result with URL
   */
  async uploadVideoToFirebase(videoUri, userId) {
    try {
      const timestamp = Date.now();
      const fileName = `sos_${userId}_${timestamp}.mp4`;
      const storageRef = ref(this.storage, `sos-videos/${fileName}`);
      
      // Read file as blob
      const response = await fetch(videoUri);
      const blob = await response.blob();
      
      // Upload to Firebase
      console.log('Uploading video to Firebase...');
      const snapshot = await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      // Get video duration (you may need a video processing library)
      const videoDuration = await this.getVideoDuration(videoUri);
      
      return {
        videoUrl: downloadURL,
        videoDuration: videoDuration
      };
      
    } catch (error) {
      console.error('Firebase upload error:', error);
      throw new Error('Failed to upload video');
    }
  }

  /**
   * Get device information
   * @returns {Promise<Object>} - Device details
   */
  async getDeviceInfo() {
    const { Platform, Constants } = require('expo-constants');
    
    return {
      platform: Platform.OS, // 'ios' or 'android'
      version: Platform.Version?.toString() || 'unknown',
      model: Constants.deviceName || 'unknown'
    };
  }

  /**
   * Get video duration
   * @param {string} videoUri - Video file URI
   * @returns {Promise<number>} - Duration in seconds
   */
  async getVideoDuration(videoUri) {
    // You can use expo-av or react-native-video-info for this
    // For now, return default duration
    return 15; // Default 15 seconds
  }

  /**
   * Send SOS data to your backend API
   * @param {Object} sosData - Complete SOS report data
   * @returns {Promise<Object>} - API response
   */
  async sendSOSToBackend(sosData) {
    try {
      const token = await this.getUserAuthToken(); // Implement your auth token retrieval
      
      const response = await fetch(`${this.API_BASE_URL}/sos/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: sosData.userId,
          videoUrl: sosData.videoUrl,
          videoDuration: sosData.videoDuration,
          location: sosData.location,
          message: sosData.message,
          deviceInfo: sosData.deviceInfo
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'API request failed');
      }

      const result = await response.json();
      return result;
      
    } catch (error) {
      console.error('Backend API error:', error);
      throw error;
    }
  }

  /**
   * Get user authentication token
   * @returns {Promise<string>} - JWT token
   */
  async getUserAuthToken() {
    // Implement your authentication logic
    // This could be from AsyncStorage, Secure Store, or your auth provider
    const token = await AsyncStorage.getItem('userAuthToken');
    if (!token) {
      throw new Error('User not authenticated');
    }
    return token;
  }
}

// Usage Example in React Native Component
export default function SOSButton() {
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sosService = new SOSService();
  const cameraRef = useRef(null);

  const handleSOSSubmit = async () => {
    try {
      setIsSubmitting(true);
      
      // Record video (your existing video recording logic)
      const videoUri = await recordEmergencyVideo();
      
      // Get emergency message from user input
      const message = "Emergency situation - need immediate help";
      
      // Submit SOS report
      const result = await sosService.submitSOSReport(
        'current_user_id', // Replace with actual user ID
        videoUri,
        message
      );
      
      // Show success message
      Alert.alert(
        'SOS Submitted',
        `Emergency report submitted successfully. Report ID: ${result.sosId}. Expected review time: ${result.estimatedReviewTime}`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      Alert.alert(
        'Submission Failed',
        `Failed to submit SOS report: ${error.message}. Please try again or contact emergency services directly.`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const recordEmergencyVideo = async () => {
    // Your video recording implementation
    setIsRecording(true);
    
    const recordingOptions = {
      quality: Camera.Constants.VideoQuality['720p'],
      maxDuration: 15,
      mute: false
    };
    
    const video = await cameraRef.current.recordAsync(recordingOptions);
    setIsRecording(false);
    
    return video.uri;
  };

  return (
    <View style={styles.container}>
      <Camera ref={cameraRef} style={styles.camera} type={Camera.Constants.Type.back}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.sosButton, isSubmitting && styles.disabledButton]}
            onPress={handleSOSSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" size="large" />
            ) : (
              <Text style={styles.sosButtonText}>🚨 SOS</Text>
            )}
          </TouchableOpacity>
        </View>
      </Camera>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
  },
  sosButton: {
    backgroundColor: '#FF4444',
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'white',
  },
  disabledButton: {
    opacity: 0.6,
  },
  sosButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
