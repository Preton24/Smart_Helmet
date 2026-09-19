// src/routes/index.js

const express = require('express');
const usersRouter = require('./users');
const sensorsRouter = require('./sensors');
const videoRouter = require('./video');
const helmetRouter = require('./helmet');
const videoAnalysisRouter = require('./videoAnalysis');
const garbageRouter = require('./garbageRoutes');
const reportRouter = require('./report');

const router = express.Router();

// Mount routers
router.use('/users', usersRouter);
router.use('/sensors', sensorsRouter);
router.use('/video', videoRouter);
router.use('/helmet-detect', helmetRouter);
router.use('/api', videoAnalysisRouter);
router.use('/api', garbageRouter);
router.use('/api', reportRouter);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString()
  });
});

// Root endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Smart Helmet Backend API',
    version: '1.0.0',
    endpoints: {
      video_analysis: 'POST /api/video-analysis',
      garbage_image_check: 'POST /api/garbage-image-check',
      garbage_result: 'POST /api/garbage-result',
      helmet_detect: 'POST /helmet-detect/detect',
      send_report: 'POST /api/send-report',
      health: 'GET /health'
    }
  });
});

module.exports = router;
