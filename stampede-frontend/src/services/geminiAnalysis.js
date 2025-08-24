// geminiAnalysis.js - Gemini API Integration for Emergency Video Analysis
import { doc, updateDoc, addDoc, collection, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

// Gemini API configuration
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Emergency analysis prompt
const EMERGENCY_ANALYSIS_PROMPT = `Analyze the provided video and perform a two-step emergency assessment.

First, determine if the video shows a real-world, immediate emergency (like a traffic accident, fire, violence, or medical crisis).

Second, IF AND ONLY IF it is an emergency, determine the single most critical emergency service required. Choose one from: ["Police", "Ambulance", "Fire Brigade"].

Respond ONLY with a single valid JSON object following this exact structure. If "is_emergency" is false, the "primary_service" and "confidence" fields MUST be null.

{
  "is_emergency": boolean,
  "reason": "A brief one-sentence explanation for your decision.",
  "primary_service": "Your choice from the list OR null",
  "confidence": "High | Medium | Low OR null"
}`;

/**
 * Fallback emergency analysis when video processing fails
 */
const performFallbackAnalysis = (videoUrl) => {
  console.log('🔄 Performing fallback emergency analysis...');

  // Extract timestamp and location info for pattern-based analysis
  const urlParams = new URL(videoUrl).searchParams;
  const timestamp = Date.now();
  const currentHour = new Date().getHours();

  // Simple heuristic-based emergency detection
  // In a real system, this could be more sophisticated
  const isLikelyEmergency = currentHour >= 22 || currentHour <= 6; // Late night/early morning

  return {
    is_emergency: false, // Conservative approach - require manual review
    reason: "Video analysis unavailable due to technical constraints. Manual review required for emergency classification.",
    primary_service: null,
    confidence: null,
    fallback_analysis: true,
    requires_manual_review: true,
    analysis_method: "pattern-based-fallback",
    timestamp: timestamp
  };
};

/**
 * Convert video file to base64 for Gemini API with fallback handling
 */
const videoToBase64 = async (videoUrl) => {
  try {
    console.log('🎥 Converting video to base64 for Gemini analysis...');
    console.log('📹 Video URL:', videoUrl);

    // Try backend proxy first (if available)
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

    try {
      const proxyUrl = `${backendUrl}/api/proxy/video?url=${encodeURIComponent(videoUrl)}`;

      console.log('🔄 Attempting backend proxy approach...');

      // Add timeout for the request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(proxyUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'video/mp4,video/*,*/*',
        }
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log('✅ Backend proxy successful');

        const blob = await response.blob();
        console.log(`📦 Blob size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Convert to base64
        let binary = '';
        uint8Array.forEach(byte => {
          binary += String.fromCharCode(byte);
        });

        const base64Video = btoa(binary);
        const base64SizeMB = (base64Video.length / 1024 / 1024);
        console.log(`✅ Video converted to base64 (${base64SizeMB.toFixed(2)} MB)`);

        if (base64SizeMB > 20) { // Gemini has size limits
          throw new Error(`Base64 video too large: ${base64SizeMB.toFixed(2)} MB. Gemini API limit exceeded.`);
        }

        return base64Video;
      } else {
        throw new Error(`Backend proxy failed: ${response.status}`);
      }

    } catch (proxyError) {
      console.warn('⚠️ Backend proxy unavailable, trying direct fetch fallback...');

      // Try direct fetch as fallback (might fail due to CORS but worth trying)
      try {
        const response = await fetch(videoUrl, {
          method: 'GET',
          mode: 'cors',
          headers: {
            'Accept': 'video/mp4,video/*,*/*',
          }
        });

        if (response.ok) {
          console.log('✅ Direct fetch successful');

          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Convert to base64
          let binary = '';
          uint8Array.forEach(byte => {
            binary += String.fromCharCode(byte);
          });

          return btoa(binary);
        } else {
          throw new Error(`Direct fetch failed: ${response.status}`);
        }

      } catch (directError) {
        console.warn('⚠️ Both proxy and direct fetch failed due to CORS restrictions');
        throw new Error('CORS_FALLBACK_NEEDED');
      }
    }
  } catch (error) {
    console.error('❌ Error converting video to base64:', error);

    // Handle CORS fallback case - preserve the exact error message
    if (error.message === 'CORS_FALLBACK_NEEDED') {
      throw error; // Re-throw without modification
    }

    // Provide more specific error messages for other cases
    if (error.name === 'AbortError') {
      throw new Error('Video download timeout - video took too long to download (>60s)');
    } else if (error.message.includes('Backend proxy error')) {
      throw new Error(`Backend proxy error: ${error.message}`);
    } else if (error.message.includes('Failed to fetch')) {
      throw new Error(`Network error connecting to backend proxy. Make sure the backend is running at ${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}`);
    } else if (error.message.includes('too large')) {
      throw new Error(error.message);
    } else {
      throw new Error(`Video processing failed: ${error.message}. URL: ${videoUrl}`);
    }
  }
};

/**
 * Analyze video using Gemini API
 */
export const analyzeVideoWithGemini = async (videoUrl, reportId) => {
  try {
    console.log('🤖 Starting Gemini video analysis...');
    console.log('📹 Video URL:', videoUrl);
    console.log('📄 Report ID:', reportId);

    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured. Please set REACT_APP_GEMINI_API_KEY environment variable.');
    }

    // Convert video to base64
    const base64Video = await videoToBase64(videoUrl);

    // Prepare Gemini API request
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: EMERGENCY_ANALYSIS_PROMPT
            },
            {
              inline_data: {
                mime_type: "video/mp4",
                data: base64Video
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 1,
        maxOutputTokens: 500,
        responseMimeType: "application/json"
      }
    };

    console.log('📤 Sending request to Gemini API...');
    console.log('🔗 API URL:', `${GEMINI_API_URL}?key=${GEMINI_API_KEY.substring(0, 20)}...`);
    console.log('📊 Request body size:', JSON.stringify(requestBody).length, 'bytes');

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': window.location.origin
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📡 Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Gemini API error response:', errorData);
      throw new Error(`Gemini API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('📥 Gemini API response received:', data);

    // Extract the generated content
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      throw new Error('No generated content received from Gemini');
    }

    console.log('🔍 Generated analysis text:', generatedText);

    // Parse the JSON response
    let analysisResult;
    try {
      analysisResult = JSON.parse(generatedText);
    } catch (parseError) {
      console.error('❌ Failed to parse Gemini response as JSON:', parseError);
      console.log('📄 Raw response:', generatedText);
      
      // Fallback: try to extract JSON from text
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from Gemini');
      }
    }

    // Validate the response structure
    if (typeof analysisResult.is_emergency !== 'boolean') {
      throw new Error('Invalid analysis result: is_emergency must be boolean');
    }

    if (analysisResult.is_emergency) {
      const validServices = ["Police", "Ambulance", "Fire Brigade"];
      if (!validServices.includes(analysisResult.primary_service)) {
        throw new Error(`Invalid primary_service: must be one of ${validServices.join(', ')}`);
      }
      
      const validConfidence = ["High", "Medium", "Low"];
      if (!validConfidence.includes(analysisResult.confidence)) {
        throw new Error(`Invalid confidence: must be one of ${validConfidence.join(', ')}`);
      }
    } else {
      // For non-emergency, ensure fields are null
      analysisResult.primary_service = null;
      analysisResult.confidence = null;
    }

    console.log('✅ Gemini analysis completed successfully:', analysisResult);

    // Save analysis result to Firebase
    await saveAnalysisToFirebase(reportId, analysisResult, videoUrl);

    return {
      success: true,
      analysis: analysisResult,
      reportId: reportId
    };

  } catch (error) {
    console.error('❌ Gemini video analysis failed:', error);

    // Handle CORS fallback case specifically
    if (error.message === 'CORS_FALLBACK_NEEDED') {
      console.log('🔄 Using fallback analysis due to CORS restrictions...');

      const fallbackResult = performFallbackAnalysis(videoUrl);

      // Save fallback analysis result to Firebase
      await saveAnalysisToFirebase(reportId, fallbackResult, videoUrl);

      return {
        success: true,
        analysis: fallbackResult,
        reportId: reportId,
        usedFallback: true,
        message: 'Analysis completed using fallback method due to video access restrictions. Manual review recommended.'
      };
    }

    // Categorize other errors for better debugging
    let errorMessage = error.message;
    let errorCategory = 'unknown';

    if (error.message.includes('Failed to fetch')) {
      errorCategory = 'network';
      errorMessage = `Network error: ${error.message}. This could be due to internet connectivity, API access issues, or CORS problems.`;
    } else if (error.message.includes('API key')) {
      errorCategory = 'authentication';
      errorMessage = `API authentication error: ${error.message}`;
    } else if (error.message.includes('timeout')) {
      errorCategory = 'timeout';
      errorMessage = `Request timeout: ${error.message}`;
    } else if (error.message.includes('too large')) {
      errorCategory = 'file_size';
      errorMessage = `File size error: ${error.message}`;
    }

    console.error(`❌ Error category: ${errorCategory}`);
    console.error(`❌ Error details: ${errorMessage}`);

    // For other errors, try fallback analysis if video processing failed
    if (errorCategory === 'network' || errorCategory === 'timeout') {
      console.log('🔄 Attempting fallback analysis due to technical issues...');

      const fallbackResult = performFallbackAnalysis(videoUrl);

      // Save fallback analysis result to Firebase
      await saveAnalysisToFirebase(reportId, {
        ...fallbackResult,
        error: true,
        error_message: `Primary analysis failed: ${errorMessage}. Used fallback method.`,
        error_category: errorCategory
      }, videoUrl);

      return {
        success: true,
        analysis: fallbackResult,
        reportId: reportId,
        usedFallback: true,
        error: errorMessage,
        errorCategory: errorCategory,
        message: 'Analysis completed using fallback method due to technical issues. Manual review recommended.'
      };
    }

    // Save failed analysis to Firebase for tracking
    await saveAnalysisToFirebase(reportId, {
      is_emergency: false,
      reason: `Analysis failed: ${errorMessage}`,
      primary_service: null,
      confidence: null,
      error: true,
      error_message: errorMessage,
      error_category: errorCategory
    }, videoUrl);

    return {
      success: false,
      error: errorMessage,
      errorCategory: errorCategory,
      reportId: reportId
    };
  }
};

/**
 * Save analysis result to Firebase
 */
const saveAnalysisToFirebase = async (reportId, analysisResult, videoUrl) => {
  try {
    console.log('💾 Saving analysis result to Firebase...');

    // Update the original SOS report with analysis
    const reportRef = doc(db, 'sos-alerts', reportId);
    await updateDoc(reportRef, {
      geminiAnalysis: {
        ...analysisResult,
        analyzedAt: serverTimestamp(),
        videoUrl: videoUrl,
        apiVersion: 'gemini-1.5-flash'
      },
      isEmergency: analysisResult.is_emergency,
      primaryService: analysisResult.primary_service,
      analysisConfidence: analysisResult.confidence,
      lastUpdated: serverTimestamp()
    });

    // Also create a separate analysis log for tracking
    await addDoc(collection(db, 'analysis-logs'), {
      reportId: reportId,
      videoUrl: videoUrl,
      analysis: analysisResult,
      analyzedAt: serverTimestamp(),
      status: analysisResult.error ? 'failed' : 'completed'
    });

    console.log('✅ Analysis result saved to Firebase');

  } catch (error) {
    console.error('❌ Failed to save analysis to Firebase:', error);
    throw error;
  }
};

/**
 * Batch analyze multiple videos
 */
export const batchAnalyzeVideos = async (reports, onProgress) => {
  console.log(`🔄 Starting batch analysis of ${reports.length} videos...`);
  
  const results = [];
  let completed = 0;

  for (const report of reports) {
    try {
      if (report.videoUrl && !report.geminiAnalysis) {
        console.log(`📹 Analyzing video ${completed + 1}/${reports.length} - Report ID: ${report.id}`);
        
        const result = await analyzeVideoWithGemini(report.videoUrl, report.id);
        results.push(result);
        
        completed++;
        if (onProgress) {
          onProgress(completed, reports.length, result);
        }

        // Add delay to avoid API rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log(`⏭️ Skipping Report ID ${report.id} - ${!report.videoUrl ? 'No video URL' : 'Already analyzed'}`);
      }
    } catch (error) {
      console.error(`❌ Failed to analyze report ${report.id}:`, error);
      results.push({
        success: false,
        error: error.message,
        reportId: report.id
      });
    }
  }

  console.log(`✅ Batch analysis completed: ${results.filter(r => r.success).length}/${results.length} successful`);
  return results;
};

/**
 * Get analysis statistics
 */
export const getAnalysisStats = async () => {
  try {
    const analysisCollection = collection(db, 'analysis-logs');
    const snapshot = await getDocs(analysisCollection);
    
    let totalAnalyzed = 0;
    let emergencies = 0;
    let nonEmergencies = 0;
    let failed = 0;
    let serviceBreakdown = {
      'Police': 0,
      'Ambulance': 0,
      'Fire Brigade': 0
    };

    snapshot.forEach(doc => {
      const data = doc.data();
      totalAnalyzed++;
      
      if (data.status === 'failed') {
        failed++;
      } else if (data.analysis?.is_emergency) {
        emergencies++;
        if (data.analysis.primary_service) {
          serviceBreakdown[data.analysis.primary_service]++;
        }
      } else {
        nonEmergencies++;
      }
    });

    return {
      totalAnalyzed,
      emergencies,
      nonEmergencies,
      failed,
      emergencyRate: totalAnalyzed > 0 ? (emergencies / totalAnalyzed * 100).toFixed(1) : 0,
      serviceBreakdown
    };
  } catch (error) {
    console.error('❌ Failed to get analysis stats:', error);
    return null;
  }
};

const geminiService = {
  analyzeVideoWithGemini,
  batchAnalyzeVideos,
  getAnalysisStats
};

export default geminiService;
