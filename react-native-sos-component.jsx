// SOSButton.jsx - React Native Component
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  Animated,
  Dimensions
} from 'react-native';
import { RNCamera } from 'react-native-camera';
import Geolocation from '@react-native-community/geolocation';
import storage from '@react-native-firebase/storage';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width, height } = Dimensions.get('window');

const SOSButton = ({ userId, onSOSSubmitted }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [sosMessage, setSOSMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  
  const cameraRef = useRef(null);
  const recordingTimer = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const RECORDING_DURATION = 15000; // 15 seconds
  const API_BASE_URL = 'https://your-api-domain.com'; // Replace with your API URL

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
    };
  }, []);

  // Start pulsing animation for SOS button
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // Check and request permissions
  const checkPermissions = async () => {
    try {
      const cameraPermission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.CAMERA 
        : PERMISSIONS.ANDROID.CAMERA;
      
      const micPermission = Platform.OS === 'ios'
        ? PERMISSIONS.IOS.MICROPHONE
        : PERMISSIONS.ANDROID.RECORD_AUDIO;

      const locationPermission = Platform.OS === 'ios'
        ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
        : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

      const permissions = [cameraPermission, micPermission, locationPermission];
      
      const results = await Promise.all(permissions.map(permission => check(permission)));
      
      const allGranted = results.every(result => result === RESULTS.GRANTED);
      
      if (!allGranted) {
        const requestResults = await Promise.all(
          permissions.map(permission => request(permission))
        );
        return requestResults.every(result => result === RESULTS.GRANTED);
      }
      
      return true;
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  };

  // Get current location
  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          console.error('Location error:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  };

  // Start video recording
  const startRecording = async () => {
    try {
      const hasPermissions = await checkPermissions();
      if (!hasPermissions) {
        Alert.alert('Permissions Required', 'Please grant camera, microphone, and location permissions to use SOS feature.');
        return;
      }

      if (!cameraRef.current) {
        Alert.alert('Error', 'Camera not ready. Please try again.');
        return;
      }

      setIsRecording(true);
      startPulseAnimation();
      
      // Start progress animation
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: RECORDING_DURATION,
        useNativeDriver: false,
      }).start();

      // Start recording with options
      const options = {
        quality: RNCamera.Constants.VideoQuality['720p'],
        maxDuration: RECORDING_DURATION / 1000, // Convert to seconds
        maxFileSize: 50 * 1024 * 1024, // 50MB limit
        videoBitrate: 2000000, // 2Mbps
      };

      const recordingPromise = cameraRef.current.recordAsync(options);
      
      // Set timer to stop recording after duration
      recordingTimer.current = setTimeout(() => {
        stopRecording();
      }, RECORDING_DURATION);

      const data = await recordingPromise;
      handleRecordingComplete(data);
      
    } catch (error) {
      console.error('Recording error:', error);
      setIsRecording(false);
      pulseAnim.stopAnimation();
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
    }
  };

  // Stop video recording
  const stopRecording = async () => {
    try {
      if (cameraRef.current && isRecording) {
        cameraRef.current.stopRecording();
      }
      
      if (recordingTimer.current) {
        clearTimeout(recordingTimer.current);
        recordingTimer.current = null;
      }
      
      setIsRecording(false);
      pulseAnim.stopAnimation();
      progressAnim.stopAnimation();
    } catch (error) {
      console.error('Stop recording error:', error);
    }
  };

  // Handle recording completion
  const handleRecordingComplete = (recordingData) => {
    setShowMessageModal(true);
    // Store recording data for later upload
    SOSButton.recordingData = recordingData;
  };

  // Upload video to Firebase Storage
  const uploadVideoToFirebase = async (videoUri) => {
    try {
      const timestamp = Date.now();
      const sosId = `sos_${userId}_${timestamp}`;
      const videoFileName = `${sosId}.mp4`;
      const thumbnailFileName = `${sosId}_thumb.jpg`;
      
      // Upload video
      const videoRef = storage().ref(`sos-videos/${videoFileName}`);
      const videoTask = videoRef.putFile(videoUri);
      
      // Monitor upload progress
      videoTask.on('state_changed', (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log(`Video upload progress: ${progress}%`);
      });

      await videoTask;
      const videoUrl = await videoRef.getDownloadURL();
      
      // Generate thumbnail (you might want to use a library like react-native-video-thumbnails)
      // For now, we'll use a placeholder or skip thumbnail generation
      const thumbnailUrl = ''; // Implement thumbnail generation if needed
      
      return {
        videoUrl,
        thumbnailUrl,
        sosId
      };
      
    } catch (error) {
      console.error('Firebase upload error:', error);
      throw new Error('Failed to upload video');
    }
  };

  // Submit SOS report
  const submitSOSReport = async () => {
    if (!SOSButton.recordingData) {
      Alert.alert('Error', 'No recording data found');
      return;
    }

    setIsUploading(true);
    setShowMessageModal(false);

    try {
      // Get current location
      const location = await getCurrentLocation();
      
      // Upload video to Firebase
      const { videoUrl, thumbnailUrl, sosId } = await uploadVideoToFirebase(
        SOSButton.recordingData.uri
      );

      // Get device info
      const deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version.toString(),
        model: Platform.OS === 'ios' ? 'iPhone' : 'Android Device' // You can use react-native-device-info for more details
      };

      // Prepare SOS report data
      const sosReportData = {
        userId,
        videoUrl,
        videoThumbnail: thumbnailUrl,
        videoDuration: SOSButton.recordingData.duration || 15,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy
        },
        message: sosMessage.trim() || 'Emergency situation reported',
        deviceInfo
      };

      // Submit to backend API
      const response = await fetch(`${API_BASE_URL}/api/sos/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getUserToken()}`, // Implement your auth token logic
        },
        body: JSON.stringify(sosReportData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        Alert.alert(
          'SOS Report Submitted',
          'Your emergency report has been submitted successfully. Help is on the way.',
          [{ text: 'OK', onPress: () => {
            setSOSMessage('');
            if (onSOSSubmitted) {
              onSOSSubmitted(result.sosId);
            }
          }}]
        );
      } else {
        throw new Error(result.message || 'Failed to submit SOS report');
      }

    } catch (error) {
      console.error('SOS submission error:', error);
      Alert.alert(
        'Submission Failed',
        'Failed to submit SOS report. Please try again or contact emergency services directly.',
        [
          { text: 'Retry', onPress: submitSOSReport },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Get user auth token (implement based on your auth system)
  const getUserToken = () => {
    // Return your user authentication token
    return 'your_auth_token_here';
  };

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <RNCamera
        ref={cameraRef}
        style={styles.camera}
        type={RNCamera.Constants.Type.back}
        flashMode={RNCamera.Constants.FlashMode.auto}
        androidCameraPermissionOptions={{
          title: 'Permission to use camera',
          message: 'We need your permission to use your camera for emergency recording',
          buttonPositive: 'Ok',
          buttonNegative: 'Cancel',
        }}
        androidRecordAudioPermissionOptions={{
          title: 'Permission to use audio recording',
          message: 'We need your permission to use your audio for emergency recording',
          buttonPositive: 'Ok',
          buttonNegative: 'Cancel',
        }}
      />

      {/* Recording Progress Bar */}
      {isRecording && (
        <View style={styles.progressContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      )}

      {/* SOS Button */}
      <View style={styles.buttonContainer}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[styles.sosButton, isRecording && styles.recordingButton]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={isUploading}
          >
            <LinearGradient
              colors={isRecording ? ['#FF6B6B', '#FF5252'] : ['#FF4444', '#CC0000']}
              style={styles.buttonGradient}
            >
              <Icon
                name={isRecording ? 'stop' : 'emergency'}
                size={40}
                color="white"
              />
              <Text style={styles.buttonText}>
                {isRecording ? 'STOP' : 'SOS'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Recording Status */}
      {isRecording && (
        <View style={styles.recordingStatus}>
          <View style={styles.recordingIndicator} />
          <Text style={styles.recordingText}>Recording Emergency Video...</Text>
        </View>
      )}

      {/* Message Modal */}
      <Modal
        visible={showMessageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMessageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Describe the Emergency</Text>
            <Text style={styles.modalSubtitle}>
              Provide a brief description to help responders understand the situation
            </Text>
            
            <TextInput
              style={styles.messageInput}
              placeholder="e.g., Large crowd stampede, people falling down..."
              multiline
              numberOfLines={3}
              value={sosMessage}
              onChangeText={setSOSMessage}
              maxLength={200}
            />
            
            <Text style={styles.characterCount}>
              {sosMessage.length}/200 characters
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowMessageModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.submitButton}
                onPress={submitSOSReport}
              >
                <Text style={styles.submitButtonText}>Submit SOS</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upload Loading Modal */}
      <Modal visible={isUploading} transparent>
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#FF4444" />
            <Text style={styles.loadingText}>Submitting Emergency Report...</Text>
            <Text style={styles.loadingSubtext}>Please wait while we process your SOS</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  progressContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF4444',
    borderRadius: 2,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
  },
  sosButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    elevation: 10,
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  recordingButton: {
    shadowColor: '#FF6B6B',
  },
  buttonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 60,
    borderWidth: 3,
    borderColor: 'white',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 5,
  },
  recordingStatus: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 20,
  },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF4444',
    marginRight: 8,
  },
  recordingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    margin: 20,
    padding: 25,
    borderRadius: 15,
    width: width - 40,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
    lineHeight: 20,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 8,
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    marginLeft: 10,
    backgroundColor: '#FF4444',
  },
  submitButtonText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    margin: 20,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 5,
    color: '#333',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default SOSButton;

// Usage Example:
// import SOSButton from './SOSButton';
// 
// const App = () => {
//   const handleSOSSubmitted = (sosId) => {
//     console.log('SOS submitted with ID:', sosId);
//     // Handle successful submission (navigate, show confirmation, etc.)
//   };
//
//   return (
//     <SOSButton 
//       userId="user_12345" 
//       onSOSSubmitted={handleSOSSubmitted}
//     />
//   );
// };
