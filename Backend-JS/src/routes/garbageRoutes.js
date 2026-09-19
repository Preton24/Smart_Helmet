/**
 * Garbage Detection API Routes
 * Endpoints:
 *   POST /api/garbage-result - Get garbage detection result from video analysis
 *   POST /api/garbage-image-check - Check single image for garbage
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { detectGarbageInFrame, saveAnnotatedGarbageFrame } = require('../utils/garbageDetectionProcessor');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/garbage');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG/PNG images are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

const MODEL_PATH = path.join(__dirname, '../../ML_model/garbage_classifier.keras');

/**
 * POST /api/garbage-result
 * Get garbage detection result from video analysis
 * 
 * Request body:
 * {
 *   "video_id": "string",
 *   "garbage_frame_path": "path/to/best/garbage/frame.jpg" (optional)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "video_id": "string",
 *   "garbage_detected": boolean,
 *   "confidence": number (0-1),
 *   "best_garbage_frame": "path/to/annotated/frame.jpg" (if detected),
 *   "timestamp": "ISO8601"
 * }
 */
router.post('/garbage-result', async (req, res) => {
  try {
    const { video_id, garbage_frame_path } = req.body;

    if (!video_id) {
      return res.status(400).json({
        success: false,
        error: 'video_id is required'
      });
    }

    // If no frame was detected during video processing
    if (!garbage_frame_path) {
      return res.json({
        success: true,
        video_id,
        garbage_detected: false,
        confidence: 0,
        message: 'No garbage detected during video analysis',
        timestamp: new Date().toISOString()
      });
    }

    // Verify frame file exists
    try {
      await fs.access(garbage_frame_path);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'Garbage frame file not found'
      });
    }

    // Run garbage detection on the frame
    const detectionResult = await detectGarbageInFrame(garbage_frame_path, MODEL_PATH);

    if (!detectionResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Garbage detection failed',
        details: detectionResult.error
      });
    }

    // Save annotated result
    const outputDir = path.join(__dirname, '../../outputs/garbage');
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `${video_id}_best.jpg`);

    await saveAnnotatedGarbageFrame(
      garbage_frame_path,
      outputPath,
      detectionResult.garbage_confidence,
      detectionResult.is_garbage
    );

    return res.json({
      success: true,
      video_id,
      garbage_detected: detectionResult.is_garbage,
      confidence: detectionResult.garbage_confidence,
      best_garbage_frame: outputPath,
      detection_model: 'garbage_classifier.keras',
      input_size: '224x224',
      threshold: 0.5,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in garbage-result endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/garbage-image-check
 * Check single image for garbage
 * 
 * Form data:
 * - image: File (JPEG/PNG, max 10MB)
 * 
 * Response:
 * {
 *   "success": true,
 *   "garbage_detected": boolean,
 *   "confidence": number (0-1),
 *   "processed_image_path": "path/to/annotated/image.jpg" (if garbage detected),
 *   "timestamp": "ISO8601"
 * }
 */
router.post('/garbage-image-check', upload.single('image'), async (req, res) => {
  try {
    // Verify file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    const imagePath = req.file.path;

    // Run garbage detection
    const detectionResult = await detectGarbageInFrame(imagePath, MODEL_PATH);

    if (!detectionResult.success) {
      // Clean up uploaded file
      await fs.unlink(imagePath).catch(() => {});
      
      return res.status(500).json({
        success: false,
        error: 'Garbage detection failed',
        details: detectionResult.error
      });
    }

    let processedImagePath = null;
    let processedImageUrl = null;

    // If garbage detected, save annotated version
    if (detectionResult.is_garbage && detectionResult.garbage_confidence > 0.5) {
      const outputDir = path.join(__dirname, '../../outputs/garbage');
      await fs.mkdir(outputDir, { recursive: true });
      
      const timestamp = Date.now();
      const uniqueName = `image_${timestamp}_${uuidv4()}.jpg`;
      processedImagePath = path.join(outputDir, uniqueName);

      const saveResult = await saveAnnotatedGarbageFrame(
        imagePath,
        processedImagePath,
        detectionResult.garbage_confidence,
        true
      );

      if (!saveResult.success) {
        console.warn('Warning: Failed to save annotated image, but detection succeeded');
        processedImagePath = null;
      } else {
        // Convert to URL path for frontend
        processedImageUrl = `/outputs/garbage/${uniqueName}`;
      }
    }

    // Clean up temp upload
    await fs.unlink(imagePath).catch(() => {});

    return res.json({
      success: true,
      garbage_detected: detectionResult.is_garbage,
      confidence: detectionResult.garbage_confidence,
      not_garbage_confidence: detectionResult.not_garbage_confidence,
      processed_image_path: processedImageUrl,
      detection_model: 'garbage_classifier.keras',
      input_size: '224x224',
      threshold: 0.5,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in garbage-image-check endpoint:', error);
    
    // Attempt cleanup
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
