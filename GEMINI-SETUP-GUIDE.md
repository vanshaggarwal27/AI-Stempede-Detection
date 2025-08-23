# Gemini API Setup Guide

## Overview
This system uses Google's Gemini AI to automatically analyze SOS videos and determine if they contain real emergencies. Only videos classified as emergencies will be displayed in the emergency dashboard.

## Quick Setup Steps

### 1. Get Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

### 2. Configure Environment Variables
1. Open `stampede-frontend/.env` file
2. Replace `your_gemini_api_key_here` with your actual API key:
   ```
   REACT_APP_GEMINI_API_KEY=AIzaSyABCDEF1234567890...
   ```
3. Save the file

### 3. Test the Integration
1. Upload a test SOS video through the mobile app
2. Go to the SOS Alerts tab in the dashboard
3. Click "Analyze All" to process videos
4. Videos will be automatically classified as emergency/non-emergency

## How It Works

### Video Analysis Process
1. **Upload**: SOS videos are uploaded to Firebase Storage
2. **Queue**: Videos await analysis in the database
3. **Analysis**: Gemini AI analyzes each video using our emergency detection prompt
4. **Classification**: Videos are classified as emergency or non-emergency
5. **Display**: Only emergency videos appear in the dashboard

### Analysis Response Format
```json
{
  "is_emergency": true,
  "reason": "Video shows a traffic accident with injured person",
  "primary_service": "Ambulance",
  "confidence": "High"
}
```

### Emergency Services Detected
- **Police**: Violence, crime, public safety threats
- **Ambulance**: Medical emergencies, injuries, health crises  
- **Fire Brigade**: Fires, explosions, hazardous situations

## Features

### Real-time Dashboard
- ✅ Live video counter with statistics
- ✅ Emergency rate calculations
- ✅ Analysis progress tracking
- ✅ Auto-updating displays

### Batch Processing
- ✅ Analyze all unprocessed videos at once
- ✅ Individual video re-analysis
- ✅ Progress tracking during batch operations

### Smart Filtering
- ✅ Only emergency videos displayed
- ✅ Confidence level indicators
- ✅ Service type classification
- ✅ Timestamp and location data

## Cost Considerations

### Gemini API Pricing (as of 2024)
- **Free Tier**: 15 requests per minute
- **Paid Tier**: $0.00025 per request for video analysis
- **Recommendation**: Start with free tier for testing

### Usage Optimization
- Videos are analyzed only once
- Failed analyses are retried automatically
- Batch processing reduces API calls

## Troubleshooting

### Common Issues

**1. "Gemini API key not configured"**
- Solution: Add your API key to `.env` file
- Restart the development server

**2. "Invalid JSON response from Gemini"**
- Solution: Check video format (MP4 recommended)
- Ensure video file size is under 20MB

**3. "Analysis failed" errors**
- Solution: Check internet connectivity
- Verify API key is valid and has quota remaining

**4. Videos not appearing in emergency list**
- Solution: Videos classified as non-emergency won't appear
- Use "Analyze All" to process pending videos

### Debug Mode
Enable debug logging by adding to console:
```javascript
localStorage.setItem('debug', 'true');
```

## Security Notes

### Environment Variables
- Never commit API keys to version control
- Use different keys for development/production
- Regularly rotate API keys

### Video Privacy
- Videos are temporarily downloaded for analysis
- No video data is stored by Gemini
- Original videos remain in Firebase Storage

## Support

### Getting Help
1. Check the browser console for error messages
2. Review the analysis logs in Firebase
3. Test with different video formats/sizes
4. Verify API quotas and billing status

### Emergency Contacts
- **Technical Issues**: Check Firebase console
- **API Issues**: Google AI Studio support
- **Video Issues**: Verify mobile app upload process

---

## Quick Test Checklist

- [ ] Gemini API key configured in `.env`
- [ ] Development server restarted after adding key
- [ ] Test SOS video uploaded from mobile app
- [ ] "Analyze All" button clicked in dashboard
- [ ] Video appears in emergency list (if classified as emergency)
- [ ] Video counter shows updated statistics

**Status**: Ready for emergency video analysis! 🚨🤖
