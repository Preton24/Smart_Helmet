// src/routes/helmet.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Configuration
const UPLOAD_FOLDER = path.join(__dirname, '..', '..', 'uploads');
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'bmp', 'gif'];
const MODEL_PATH = path.join(__dirname, '..', '..', 'ML_model', 'helmet_best.pt');
const PREDICT_SCRIPT = path.join(__dirname, '..', '..', 'ML_model', 'predict_helmet.py');

// Python executable - use venv Python for TensorFlow compatibility
const getPythonCmd = () => {
  const venvPath = path.join(__dirname, '../../venv');
  const winPython = path.join(venvPath, 'Scripts/python.exe');
  const unixPython = path.join(venvPath, 'bin/python');

  if (fsSync.existsSync(winPython)) return winPython;
  if (fsSync.existsSync(unixPython)) return unixPython;

  return process.platform === 'win32' ? 'py' : 'python';
};

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
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `helmet_${uniqueSuffix}${ext}`);
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
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

/**
 * POST /helmet-detect
 * 
 * Upload an image and perform helmet detection using YOLO model.
 * 
 * Request:
 *   - multipart/form-data with 'image' field
 *   - File: JPEG, PNG, BMP, or GIF
 * 
 * Response:
 * {
 *   "success": true,
 *   "image": {
 *     "filename": "helmet_1234567890-xxx.jpg",
 *     "path": "/uploads/helmet_1234567890-xxx.jpg",
 *     "size": 12345
 *   },
 *   "detection": {
 *     "detected_classes": ["helmet", "no-helmet"],
 *     "detection_count": 2,
 *     "detections": [
 *       {
 *         "class": "helmet",
 *         "confidence": 0.95,
 *         "bbox": { "x1": 10, "y1": 20, "x2": 100, "y2": 150, ... }
 *       }
 *     ],
 *     "summary": {
 *       "helmet_count": 1,
 *       "no_helmet_count": 1,
 *       "decision": "helmet"
 *     }
 *   },
 *   "timestamp": "2025-01-29T12:34:56.789Z"
 * }
 */
router.post('/detect', upload.single('image'), async (req, res) => {
  let uploadedFile = null;

  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file uploaded. Please provide an image with field name "image"'
      });
    }

    uploadedFile = req.file;
    const imagePath = uploadedFile.path;
    const filename = uploadedFile.filename;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[Helmet Detection] Image uploaded: ${filename}`);
    console.log(`[Helmet Detection] File size: ${(uploadedFile.size / 1024).toFixed(2)} KB`);
    console.log(`[Helmet Detection] Starting YOLO inference...`);
    console.log(`${'='.repeat(60)}\n`);

    // Verify model file exists
    if (!require('fs').existsSync(MODEL_PATH)) {
      console.error(`[Error] Model not found: ${MODEL_PATH}`);
      return res.status(500).json({
        success: false,
        error: 'YOLO model file not found',
        details: MODEL_PATH
      });
    }

    // Run Python inference script
    const detectionResult = await runYOLOInference(imagePath, MODEL_PATH);

    if (!detectionResult.success) {
      console.error(`[Error] YOLO inference failed:`, detectionResult.error);
      return res.status(400).json({
        success: false,
        error: 'Helmet detection inference failed',
        details: detectionResult.error
      });
    }

    console.log(`[Helmet Detection] Inference completed successfully`);
    console.log(`[Results] Detected classes: ${detectionResult.detected_classes.join(', ')}`);
    console.log(`[Results] Decision: ${detectionResult.summary.decision}`);
    console.log(`[Results] Detection count: ${detectionResult.detection_count}\n`);

    // Return structured response
    res.json({
      success: true,
      image: {
        filename,
        path: `/uploads/${filename}`,
        size: uploadedFile.size,
        mimetype: uploadedFile.mimetype
      },
      detection: {
        detected_classes: detectionResult.detected_classes,
        detection_count: detectionResult.detection_count,
        detections: detectionResult.detections,
        summary: detectionResult.summary
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[Helmet Detection Error]`, error);

    res.status(500).json({
      success: false,
      error: 'Internal server error during helmet detection',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });

  }
});

/**
 * Execute Python YOLO inference script
 * 
 * @param {string} imagePath - Path to the image file
 * @param {string} modelPath - Path to the YOLO model weights
 * @returns {Promise<object>} Detection results as JSON
 */
function runYOLOInference(imagePath, modelPath) {
  return new Promise((resolve, reject) => {
    // Use venv Python if available
    const pythonCmd = getPythonCmd();

    const pythonProcess = spawn(pythonCmd, [
      PREDICT_SCRIPT,
      imagePath,
      modelPath
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000 // 2 minute timeout
    });

    let outputBuffer = '';
    let errorBuffer = '';

    pythonProcess.stdout.on('data', (data) => {
      outputBuffer += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      const errorMsg = data.toString();
      errorBuffer += errorMsg;
      // Don't treat stderr output as fatal - YOLO may output warnings
      console.log(`[ML Service] ${errorMsg.trim()}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          // Parse JSON output from the Python script
          const result = JSON.parse(outputBuffer.trim());
          resolve(result);
        } catch (parseError) {
          console.error(`[Parse Error] Failed to parse Python output:`, parseError);
          console.error(`[Debug] Output was:`, outputBuffer);
          reject(new Error(`Failed to parse inference results: ${parseError.message}`));
        }
      } else {
        console.error(`[Python Error] Exit code: ${code}`);
        console.error(`[Python Error] stderr: ${errorBuffer}`);
        console.error(`[Python Error] stdout: ${outputBuffer}`);
        reject(new Error(`YOLO inference failed (exit code ${code}): ${errorBuffer || 'Unknown error'}`));
      }
    });

    pythonProcess.on('error', (error) => {
      console.error(`[Process Error] Failed to start Python process:`, error);
      reject(new Error(`Failed to start YOLO inference: ${error.message}`));
    });

    // Handle timeout
    pythonProcess.on('timeout', () => {
      pythonProcess.kill();
      reject(new Error('YOLO inference timed out'));
    });
  });
}

/**
 * GET /helmet-detect/health
 * Health check endpoint for helmet detection service
 */
router.get('/health', (req, res) => {
  const modelExists = require('fs').existsSync(MODEL_PATH);
  const scriptExists = require('fs').existsSync(PREDICT_SCRIPT);

  res.json({
    service: 'helmet-detection',
    status: modelExists && scriptExists ? 'ready' : 'degraded',
    components: {
      model: {
        exists: modelExists,
        path: MODEL_PATH
      },
      script: {
        exists: scriptExists,
        path: PREDICT_SCRIPT
      }
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
