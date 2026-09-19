// src/routes/video.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { processVideoWithDualModels, checkDualModelDependencies } = require('../utils');

const router = express.Router();

// Configuration
const UPLOAD_FOLDER = path.join(__dirname, '..', '..', 'uploads');
const VIOLATIONS_FOLDER = path.join(__dirname, '..', '..', 'violations');
const ALLOWED_EXTENSIONS = ['mp4', 'avi', 'mov', 'mkv'];

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(UPLOAD_FOLDER, { recursive: true });
      cb(null, UPLOAD_FOLDER);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Use one of: ${ALLOWED_EXTENSIONS.join(', ')}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB
  }
});

/**
 * POST /video/upload
 * Upload and process video with DUAL ML Models:
 * 1. YOLO v8 for vehicle threat detection
 * 2. Custom YOLO for helmet violation detection
 * 
 * Returns: Best violation image + analytics
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  let inputPath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    inputPath = req.file.path;
    const originalFilename = req.file.originalname;
    const processId = `violation_${Date.now()}_${uuidv4().slice(0, 8)}`;

    // Create unique folder for this video processing
    const outputDir = path.join(VIOLATIONS_FOLDER, processId);
    await fs.mkdir(outputDir, { recursive: true });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[Video Upload] File received: ${originalFilename}`);
    console.log(`[Video Upload] Process ID: ${processId}`);
    console.log(`[Video Upload] File size: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`[Video Upload] Starting dual-model processing...`);
    console.log(`${'='.repeat(60)}\n`);

    // Check if dual model dependencies are available
    const hasDeps = await checkDualModelDependencies();
    if (!hasDeps) {
      console.warn('[Warning] Dual model dependencies not fully available');
    }

    // Process video with DUAL ML MODELS
    let analytics;
    try {
      const result = await processVideoWithDualModels(inputPath, outputDir);
      analytics = result.analytics;
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`[Processing Complete] Dual model analysis finished`);
      console.log(`[Results] Best violation score: ${analytics.best_violation_score || 0}`);
      console.log(`[Results] Best violation image: ${analytics.best_violation_image || 'None'}`);
      console.log(`${'='.repeat(60)}\n`);
      
    } catch (processingError) {
      console.error(`[Processing Error] ${processingError.message}`);
      
      // Return error but don't fail completely
      analytics = {
        error: processingError.message,
        type: 'processing_error',
        best_violation_score: 0,
        best_violation_image: null
      };
    }

    // Prepare response
    const violationImagePath = analytics.best_violation_image 
      ? `/violations/${processId}/${analytics.best_violation_image}`
      : null;

    res.json({
      success: true,
      message: 'Dual-model video processing complete',
      process_id: processId,
      original_filename: originalFilename,
      violations_folder: `/violations/${processId}`,
      best_violation_image: violationImagePath,
      analytics: {
        best_violation_score: analytics.best_violation_score || 0,
        total_frames_processed: analytics.total_frames || 0,
        processing_timestamp: analytics.timestamp || new Date().toISOString(),
        models_used: ['YOLO_v8_Vehicle_Threat', 'Custom_YOLO_Helmet_Detection']
      }
    });

  } catch (error) {
    console.error(`[Error] ${error.message}`);
    
    // Clean up uploaded file on error
    if (inputPath) {
      try {
        await fs.unlink(inputPath);
      } catch (cleanupError) {
        console.error('[Cleanup Error]', cleanupError);
      }
    }
    
    res.status(500).json({ 
      error: error.message,
      type: 'upload_processing_error'
    });
  }
});

/**
 * GET /video/violations/:processId/:filename
 * Download the best violation image from a processed video
 */
router.get('/violations/:processId/:filename', async (req, res) => {
  try {
    const { processId, filename } = req.params;
    const filePath = path.join(VIOLATIONS_FOLDER, processId, filename);
    
    // Validate path to prevent directory traversal
    if (!filePath.startsWith(VIOLATIONS_FOLDER)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
      await fs.access(filePath);
      res.download(filePath);
    } catch {
      res.status(404).json({ error: 'Violation image not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /video/status/:processId
 * Get processing status of a video
 */
router.get('/status/:processId', async (req, res) => {
  try {
    const { processId } = req.params;
    const processDir = path.join(VIOLATIONS_FOLDER, processId);
    
    try {
      await fs.access(processDir);
      const files = await fs.readdir(processDir);
      
      res.json({
        process_id: processId,
        status: 'completed',
        files_generated: files,
        violations_folder: `/violations/${processId}`
      });
    } catch {
      res.json({
        process_id: processId,
        status: 'not_found',
        error: 'Process not found or still processing'
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
