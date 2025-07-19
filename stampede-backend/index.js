// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser'); // To parse JSON bodies
const cors = require('cors'); // To handle CORS for frontend communication
const twilio = require('twilio');

const app = express();
const port = process.env.PORT || 5000; // Use port 5000 for backend

// Twilio credentials from environment variables
// IMPORTANT: These variables in .env MUST include the 'whatsapp:' prefix
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppPhoneNumber = process.env.TWILIO_PHONE_NUMBER; // Renamed for clarity, assuming it's the WhatsApp FROM number
const recipientWhatsAppPhoneNumber = process.env.RECIPIENT_PHONE_NUMBER; // Renamed for clarity, assuming it's the WhatsApp TO number

// Initialize Twilio client
const client = new twilio(accountSid, authToken);

// Middleware
app.use(cors()); // Enable CORS for all routes (important for frontend)
app.use(bodyParser.json()); // Parse incoming JSON requests

// Basic test route
app.get('/', (req, res) => {
    res.send('Stampede Detection Backend API is running!');
});

// API endpoint to trigger a stampede alert
app.post('/api/alert/stampede', async (req, res) => {
    const { message, crowdDensity, timestamp } = req.body;

    if (!message || !crowdDensity || !timestamp) {
        return res.status(400).json({ success: false, error: 'Missing required fields: message, crowdDensity, timestamp' });
    }

    // Format the alert message
    const alertMessage = `🚨 STAMPEDE ALERT! 🚨\nCrowd Density: ${crowdDensity}\nTime: ${new Date(timestamp).toLocaleString('en-US', { timeZone: 'Asia/Kolkata'})}\nDetails: ${message}`;
    // Using 'en-US' locale and 'Asia/Kolkata' timezone for more consistent date formatting for India.

    console.log(`Received alert: ${alertMessage}`);
    console.log(`Attempting to send WhatsApp message from: ${twilioWhatsAppPhoneNumber} to: ${recipientWhatsAppPhoneNumber}`);

    try {
        await client.messages.create({
            body: alertMessage,
            to: recipientWhatsAppPhoneNumber, // Must include 'whatsapp:' prefix, e.g., 'whatsapp:+919876543210'
            from: twilioWhatsAppPhoneNumber   // Must include 'whatsapp:' prefix, e.g., 'whatsapp:+14155238886'
        });
        console.log('WhatsApp alert sent successfully!');
        res.status(200).json({ success: true, message: 'WhatsApp alert sent!' });
    } catch (error) {
        console.error('Error sending WhatsApp:', error.message); // Log only the message for cleaner output
        res.status(500).json({ success: false, error: 'Failed to send WhatsApp alert', details: error.message });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Stampede Backend listening on port ${port}`);
    console.log(`Access it at http://localhost:${port}`);
    console.log(`Make sure your .env has whatsapp: prefixes for phone numbers!`);
    console.log(`Also, ensure your recipient phone has joined the Twilio WhatsApp Sandbox!`);
});