// src/routes/report.js
const express = require('express');
const router = express.Router();
const { sendEmail } = require('../utils/email');

router.post('/send-report', async (req, res) => {
  try {
    const reportData = req.body;

    if (!reportData || !reportData.type) {
      return res.status(400).json({ error: 'Missing report data or type' });
    }

    // Fire-and-forget: run email sending in background without blocking the response
    sendEmail(reportData).catch(err => {
      console.error('Background report sending failed:', err);
    });

    res.json({ success: true, message: 'Email sequence initiated' });
  } catch (error) {
    console.error('Report endpoint error:', error);
    res.status(500).json({ 
      error: 'Failed to process report request', 
      message: error.message 
    });
  }
});

module.exports = router;
