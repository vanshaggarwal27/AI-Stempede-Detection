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
const twilioWhatsAppPhoneNumber = process.env.TWILIO_PHONE_NUMBER; // Assuming it's the WhatsApp FROM number
const recipientWhatsAppPhoneNumber = process.env.RECIPIENT_PHONE_NUMBER; // Assuming it's the WhatsApp TO number

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
    const { message, crowdDensity, timestamp } = req.body; // 'timestamp' is still received but not used in the message

    if (!message || !crowdDensity) { // Removed timestamp from validation as it's not strictly needed for the message content
        return res.status(400).json({ success: false, error: 'Missing required fields: message, crowdDensity' });
    }

    // Simplified alert message - NO DATE/TIME
    const alertMessage = `🚨 STAMPEDE ALERT! 🚨\nCrowd Density: ${crowdDensity}\nDetails: ${message}`;

    console.log(`Received alert: ${alertMessage}`);
    console.log(`Attempting to send WhatsApp message from: ${twilioWhatsAppPhoneNumber} to: ${recipientWhatsAppPhoneNumber}`);

    try {
        await client.messages.create({
            body: alertMessage,
            to: recipientWhatsAppPhoneNumber, // Must include 'whatsapp:' prefix
            from: twilioWhatsAppPhoneNumber   // Must include 'whatsapp:' prefix
        });
        console.log('WhatsApp alert sent successfully!');
        res.status(200).json({ success: true, message: 'WhatsApp alert sent!' });
    } catch (error) {
        console.error('Error sending WhatsApp:', error.message);
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