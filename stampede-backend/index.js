// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser'); // To parse JSON bodies
const cors = require('cors'); // To handle CORS for frontend communication
const twilio = require('twilio');
const https = require('https');
const http = require('http');

const app = express();
const port = process.env.PORT || 5000; // Use port 5000 for backend

// Twilio credentials from environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

// Helper to ensure 'whatsapp:' prefix is always added
const formatWhatsAppNumber = (number) => {
    return number.startsWith('whatsapp:') ? number : `whatsapp:${number}`;
};

const twilioWhatsAppPhoneNumber = formatWhatsAppNumber(process.env.TWILIO_PHONE_NUMBER);
const recipientWhatsAppPhoneNumber = formatWhatsAppNumber(process.env.RECIPIENT_PHONE_NUMBER);

// Initialize Twilio client
const client = new twilio(accountSid, authToken);

// Middleware
app.use(cors()); // Enable CORS for all routes (important for frontend)
app.use(bodyParser.json()); // Parse incoming JSON requests

// Health check route (versioned)
app.get('/api/v1/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
});

// API endpoint to trigger a stampede alert
app.post('/api/alert/stampede', async (req, res) => {
    const { message, crowdDensity, timestamp } = req.body;

    // Input validation
    if (!message || !crowdDensity || isNaN(Number(crowdDensity))) {
        return res.status(400).json({ success: false, error: 'Invalid input: message and numeric crowdDensity required.' });
    }

    // Simplified alert message (no date/time to reduce noise)
    const alertMessage = `🚨 STAMPEDE ALERT! 🚨\nCrowd Density: ${crowdDensity}\nDetails: ${message}`;

    console.log(`Received alert: ${alertMessage}`);
    console.log(`Attempting WhatsApp send from ${twilioWhatsAppPhoneNumber} to ${recipientWhatsAppPhoneNumber}`);

    try {
        await client.messages.create({
            body: alertMessage,
            to: recipientWhatsAppPhoneNumber,
            from: twilioWhatsAppPhoneNumber
        });

        console.log('WhatsApp alert sent successfully!');
        res.status(200).json({ success: true, message: 'WhatsApp alert sent!' });
    } catch (error) {
        console.error('Twilio Error:', error); // Internal log

        res.status(500).json({ 
            success: false, 
            error: 'WhatsApp alert failed. Please try again later.' 
        });
    }
});

// Video proxy endpoint to handle CORS issues with Firebase Storage
app.get('/api/proxy/video', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Video URL parameter is required' });
    }

    // Validate it's a Firebase Storage URL for security
    if (!url.includes('firebasestorage.googleapis.com')) {
        return res.status(400).json({ error: 'Only Firebase Storage URLs are allowed' });
    }

    console.log('🎥 Proxying video request:', url);

    try {
        // Determine protocol
        const protocol = url.startsWith('https:') ? https : http;

        // Proxy the video request
        protocol.get(url, (proxyRes) => {
            // Set appropriate headers
            res.set({
                'Content-Type': proxyRes.headers['content-type'] || 'video/mp4',
                'Content-Length': proxyRes.headers['content-length'],
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Cache-Control': 'public, max-age=3600'
            });

            // Check file size (limit to 100MB)
            const contentLength = parseInt(proxyRes.headers['content-length'] || '0');
            if (contentLength > 100 * 1024 * 1024) {
                return res.status(413).json({ error: 'Video file too large (>100MB)' });
            }

            console.log(`📊 Video size: ${(contentLength / 1024 / 1024).toFixed(2)} MB`);

            // Pipe the video data
            proxyRes.pipe(res);

        }).on('error', (error) => {
            console.error('❌ Video proxy error:', error);
            res.status(500).json({ error: 'Failed to fetch video', details: error.message });
        });

    } catch (error) {
        console.error('❌ Video proxy request error:', error);
        res.status(500).json({ error: 'Failed to proxy video request', details: error.message });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Stampede Detection Backend running at http://localhost:${port}`);
    console.log(`Make sure .env includes correct phone numbers WITHOUT "whatsapp:" prefix; it is now auto-handled.`);
    console.log(`Ensure recipient has joined the Twilio WhatsApp Sandbox.`);
});
