/**
 * Video Analysis API Routes
 * Comprehensive video analysis: helmet detection + vehicle threats + garbage detection + plate extraction
 * 
 * Routes:
 *   POST /api/video-analysis - Upload and analyze video (helmet + garbage + plates)
 *   POST /api/garbage-analysis - Get garbage detection results
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Configuration
const UPLOADS_DIR = path.join(__dirname, '../../uploads/videos');
const OUTPUTS_DIR = path.join(__dirname, '../../outputs');
const ML_SERVICE = path.join(__dirname, '../../ML_model/dual_model_ml_service.py');
const OCR_SERVICE = path.join(__dirname, '../../ML_model/easyocr_plate_extractor.py');
// Note: Garbage detection is disabled for videos - use /api/garbage-image-check for images

// Python executable - use venv Python for TensorFlow compatibility
const getPythonCmd = () => {
  const venvPath = path.join(__dirname, '../../venv');
  const winPython = path.join(venvPath, 'Scripts/python.exe');
  const unixPython = path.join(venvPath, 'bin/python');

  if (fsSync.existsSync(winPython)) return winPython;
  if (fsSync.existsSync(unixPython)) return unixPython;

  return process.platform === 'win32' ? 'py' : 'python';
};

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      cb(null, UPLOADS_DIR);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `analysis_${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const videoExts = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (videoExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Video format not supported. Use: ${videoExts.join(', ')}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit for videos
  }
});

/**
 * POST /api/video-analysis
 * Upload and analyze video for helmet violations, vehicle threats, garbage, and license plates
 * 
 * Request:
 *   - multipart/form-data with 'video' field
 *   - File: MP4, AVI, MOV, MKV, WEBM, FLV, WMV
 * 
 * Response:
 * {
 *   "success": true,
 *   "video_id": "uuid",
 *   "video": {
 *     "filename": "analysis_123-xxx.mp4",
 *     "upload_path": "/uploads/videos/analysis_123-xxx.mp4",
 *     "size": 1234567,
 *     "duration": 30.5,
 *     "fps": 25,
 *     "resolution": "1920x1080"
 *   },
 *   "analysis": {
 *     "helmet_violations": [
 *       {
 *         "frame_number": 100,
 *         "confidence": 0.95,
 *         "bbox": [10, 20, 100, 150]
 *       }
 *     ],
 *     "vehicle_threats": [
 *       {
 *         "type": "car",
 *         "threat_score": 85,
 *         "frame_number": 100
 *       }
 *     ],
 *     "garbage_detection": {
 *       "detected": true,
 *       "best_frame_path": "/outputs/garbage/video_123_best.jpg",
 *       "confidence": 0.87,
 *       "frame_number": 150
 *     },
 *     "license_plates": {
 *       "primary": "MH14GE9533",
 *       "primary_votes": 6,
 *       "secondary": "H0W1T10K55",
 *       "secondary_votes": 10,
 *       "extraction_confidence": 0.92,
 *       "frames_analyzed": 10
 *     }
 *   },
 *   "output": {
 *     "annotated_video": "/outputs/annotated_violations.mp4",
 *     "violation_frames": "/outputs/violation_frames/",
 *     "garbage_frames": "/outputs/garbage/",
 *     "analytics_file": "/outputs/analysis_123.json"
 *   },
 *   "statistics": {
 *     "total_frames": 750,
 *     "violation_frames_count": 50,
 *     "processing_time_seconds": 45,
 *     "frames_per_second": 16.7
 *   },
 *   "timestamp": "2026-01-30T12:34:56.789Z"
 * }
 */
router.post('/video-analysis', upload.single('video'), async (req, res) => {
  let uploadedFile = null;
  const videoId = uuidv4();

  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No video file uploaded. Please provide a video with field name "video"'
      });
    }

    uploadedFile = req.file;
    const videoPath = uploadedFile.path;
    const filename = uploadedFile.filename;
    const startTime = Date.now();

    console.log(`\n${'='.repeat(70)}`);
    console.log(`[Video Analysis] Starting comprehensive video analysis`);
    console.log(`[Video Analysis] Video ID: ${videoId}`);
    console.log(`[Video Analysis] File: ${filename}`);
    console.log(`[Video Analysis] Size: ${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`${'='.repeat(70)}\n`);

    // Create output directory
    const outputDir = path.join(OUTPUTS_DIR, videoId);
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(path.join(outputDir, 'violation_frames'), { recursive: true });

    // Step 1: Run Python ML Service for helmet and vehicle detection
    // NOTE: Garbage detection is disabled for videos - use /api/garbage-image-check for images
    console.log(`[Step 1] Running ML service (helmet + vehicle detection)...`);
    const mlResults = await runMLService(videoPath, outputDir);

    if (!mlResults.success) {
      console.error(`[Error] ML service failed:`, mlResults.error);
      return res.status(500).json({
        success: false,
        error: 'ML service analysis failed',
        details: mlResults.error
      });
    }

    console.log(`[Step 1] ML service completed`);
    const helmetCount = mlResults.violations?.helmet?.count || 0;
    const vehicleCount = mlResults.violations?.vehicle?.count || 0;
    console.log(`[Results] Helmet violations found: ${helmetCount}`);
    console.log(`[Results] Vehicle threats found: ${vehicleCount}\n`);

    // Debug: Log the actual violations data
    console.log(`[Debug] Helmet details: ${JSON.stringify(mlResults.violations?.helmet?.details || []).substring(0, 100)}...`);
    console.log(`[Debug] Vehicle details: ${JSON.stringify(mlResults.violations?.vehicle?.details || []).substring(0, 100)}...`);

    // Step 2: Run OCR for license plate extraction (if violation frames exist)
    console.log(`[Step 2] Running OCR for license plate extraction...`);
    let ocrResults = { success: false, plates: { primary: 'N/A', confidence: 0 } };

    const violationFramesDir = path.join(outputDir, 'violation_frames');
    if (fsSync.existsSync(violationFramesDir)) {
      const frameFiles = fsSync.readdirSync(violationFramesDir);
      if (frameFiles.length > 0) {
        ocrResults = await runOCRService(violationFramesDir);
        if (ocrResults.success) {
          console.log(`[Step 2] OCR completed`);
          console.log(`[Results] Primary plate: ${ocrResults.plates?.primary || 'N/A'}`);
          console.log(`[Results] Confidence: ${(ocrResults.plates?.confidence || 0).toFixed(2)}\n`);
        } else {
          console.warn(`[Warning] OCR service failed, using N/A`);
        }
      } else {
        console.log(`[Step 2] No violation frames to process for OCR\n`);
      }
    } else {
      console.log(`[Step 2] No violation frames directory found\n`);
    }

    // Step 3: Garbage detection is disabled for videos
    // Use POST /api/garbage-image-check for single image garbage detection

    // Calculate processing time
    const processingTime = (Date.now() - startTime) / 1000;

    // Get best helmet violation frame
    let bestHelmetFrame = null;
    if (fsSync.existsSync(violationFramesDir)) {
      const files = fsSync.readdirSync(violationFramesDir).sort();
      if (files.length > 0) {
        bestHelmetFrame = `/outputs/${videoId}/violation_frames/${files[0]}`;
      }
    }

    // CRITICAL: Extract license plate with guaranteed fallback
    // Lock the value - once assigned, it cannot be overwritten
    let finalLicensePlate = 'N/A';
    if (ocrResults && ocrResults.plates && typeof ocrResults.plates.primary === 'string') {
      const plate = ocrResults.plates.primary.trim().toUpperCase();
      if (plate && plate !== '' && plate !== 'N/A') {
        finalLicensePlate = plate;
      }
    }
    console.log(`[Final License Plate] ${finalLicensePlate}`);

    // Construct SIMPLIFIED response for frontend
    const analysisResponse = {
      success: true,
      video_id: videoId,
      helmet_detection: {
        violations_count: mlResults.violations?.helmet?.count || 0,
        best_frame: bestHelmetFrame,
        details: mlResults.violations?.helmet?.details || []
      },
      vehicle_threats: {
        threats_count: mlResults.violations?.vehicle?.count || 0,
        details: mlResults.violations?.vehicle?.details || []
      },
      // Use the locked final value - NEVER null
      license_plate: finalLicensePlate,
      // Include additional OCR metadata for debugging
      license_plate_details: {
        primary: ocrResults.plates?.primary || 'N/A',
        primary_frequency: ocrResults.plates?.primary_frequency || 0,
        secondary: ocrResults.plates?.secondary || null,
        secondary_frequency: ocrResults.plates?.secondary_frequency || 0,
        confidence: ocrResults.plates?.confidence || 0,
        frames_analyzed: ocrResults.attempts || 0,
        valid_extractions: ocrResults.valid_extractions || 0
      },
      annotated_video: `/outputs/${videoId}/annotated_violations.mp4`,
      // Garbage detection disabled for videos - use /api/garbage-image-check for images
      processing_time_seconds: parseFloat(processingTime.toFixed(2))
    };

    // Save analysis to file
    const analyticsFile = path.join(outputDir, 'analysis.json');
    await fs.writeFile(analyticsFile, JSON.stringify(analysisResponse, null, 2));

    console.log(`[Summary] Analysis complete in ${processingTime.toFixed(2)}s`);
    console.log(`[Summary] Output saved to: ${outputDir}\n`);

    res.json(analysisResponse);

  } catch (error) {
    console.error(`[Video Analysis Error]`, error);

    res.status(500).json({
      success: false,
      error: 'Internal server error during video analysis',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/garbage-analysis
 * DEPRECATED: Garbage detection is disabled for video processing.
 * Use POST /api/garbage-image-check for single image garbage detection instead.
 * 
 * This endpoint now returns a message indicating garbage detection is not available for videos.
 */
router.post('/garbage-analysis', async (req, res) => {
  try {
    const { video_id } = req.body;

    // Garbage detection is disabled for videos
    return res.json({
      success: true,
      video_id: video_id || null,
      message: 'Garbage detection is disabled for video processing. Use POST /api/garbage-image-check for single image garbage detection.',
      garbage_analysis: {
        detected: false,
        available: false,
        recommendation: 'Upload a single image to /api/garbage-image-check for garbage detection.'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[Garbage Analysis Error]`, error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during garbage analysis',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Run Python ML Service for video analysis
 */
function runMLService(videoPath, outputDir) {
  return new Promise((resolve, reject) => {
    const pythonCmd = getPythonCmd();

    const pythonProcess = spawn(pythonCmd, [
      ML_SERVICE,
      videoPath,
      outputDir
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 600000 // 10 minute timeout for large videos
    });

    let outputBuffer = '';
    let errorBuffer = '';

    pythonProcess.stdout.on('data', (data) => {
      outputBuffer += data.toString();
      console.log(`[ML Service] ${data.toString().trim()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      errorBuffer += data.toString();
      console.log(`[ML Service Warn] ${data.toString().trim()}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          // Try to parse JSON from last line
          const lines = outputBuffer.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const result = JSON.parse(lastLine);
          resolve(result);
        } catch (parseError) {
          console.error(`[ML Service Parse Error]`, parseError);
          resolve({
            success: true,
            violations: { helmet: { count: 0, details: [] }, vehicle: { count: 0, details: [] }, total_count: 0 },
            garbage_detected: false,
            video_info: { total_frames: 0, fps: 0, duration: 0, resolution: 'N/A' }
          });
        }
      } else {
        reject(new Error(`ML service failed (exit code ${code}): ${errorBuffer}`));
      }
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start ML service: ${error.message}`));
    });
  });
}

/**
 * Run OCR Service for license plate extraction
 * Returns normalized result with guaranteed structure
 */
function runOCRService(violationFramesDir) {
  return new Promise((resolve, reject) => {
    // Default result structure - GUARANTEED fields
    const defaultResult = {
      success: false,
      plates: {
        primary: 'N/A',
        primary_frequency: 0,
        secondary: null,
        secondary_frequency: 0,
        confidence: 0
      },
      attempts: 0,
      valid_extractions: 0
    };

    // Check if violation frames exist
    if (!fsSync.existsSync(violationFramesDir)) {
      console.log(`[OCR] Directory not found: ${violationFramesDir}`);
      resolve(defaultResult);
      return;
    }

    // Get all .jpg files from violation frames directory
    // Use forward slashes for Python compatibility on Windows
    const frameFiles = fsSync.readdirSync(violationFramesDir)
      .filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
      .map(f => path.join(violationFramesDir, f).replace(/\\/g, '/'))
      .sort()
      .slice(0, 5);  // OPTIMIZED: Only 5 frames for faster OCR (was 10)

    if (frameFiles.length === 0) {
      console.log(`[OCR] No frame files found in: ${violationFramesDir}`);
      resolve(defaultResult);
      return;
    }

    console.log(`[OCR] Processing ${frameFiles.length} frames...`);
    console.log(`[OCR] First frame: ${frameFiles[0]}`);

    const pythonCmd = getPythonCmd();
    const ocrServicePath = OCR_SERVICE.replace(/\\/g, '/');

    // Build command args
    const args = [ocrServicePath, ...frameFiles];
    console.log(`[OCR] Command: ${pythonCmd} ${args.slice(0, 3).join(' ')}...`);

    const pythonProcess = spawn(pythonCmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 180000, // 3 minute timeout
      shell: false  // Avoid shell interpretation issues
    });

    let outputBuffer = '';
    let errorBuffer = '';

    pythonProcess.stdout.on('data', (data) => {
      outputBuffer += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorBuffer += data.toString();
    });

    pythonProcess.on('close', (code) => {
      console.log(`[OCR] Process exited with code: ${code}`);
      console.log(`[OCR] Output length: ${outputBuffer.length}, Error length: ${errorBuffer.length}`);

      // Log any stderr output for debugging
      if (errorBuffer.length > 0) {
        console.log(`[OCR Stderr] ${errorBuffer.substring(0, 1000)}`);
      }

      // Accept code 0 or null (null can happen on Windows)
      if ((code === 0 || code === null) && outputBuffer.trim().length > 0) {
        try {
          // Find JSON in output - Python outputs single-line compact JSON
          const lines = outputBuffer.trim().split('\n');
          let jsonStr = null;

          // Search from end for JSON object (single line)
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('{') && line.endsWith('}')) {
              jsonStr = line;
              break;
            }
          }

          if (!jsonStr) {
            console.error(`[OCR] No valid JSON found in output`);
            console.error(`[OCR Output] ${outputBuffer.substring(0, 500)}`);
            resolve(defaultResult);
            return;
          }

          const rawResult = JSON.parse(jsonStr);
          console.log(`[OCR Raw] plate=${rawResult.plate}, success=${rawResult.success}`);

          // CRITICAL: Map Python field names to Node.js expected structure
          const normalizedResult = {
            success: Boolean(rawResult.success),
            plates: {
              // Python uses 'plate', Node.js expects 'plates.primary'
              primary: rawResult.plate || 'N/A',
              primary_frequency: rawResult.frequency || 0,
              secondary: rawResult.plate_2 || null,
              secondary_frequency: rawResult.frequency_2 || 0,
              // Use the confidence field if present, otherwise calculate from frequency
              confidence: rawResult.confidence || 0
            },
            attempts: rawResult.attempts || 0,
            valid_extractions: rawResult.valid_extractions || 0,
            all_plates: rawResult.all_extractions || [],
            votes: rawResult.votes || {}
          };

          console.log(`[OCR Mapped] primary=${normalizedResult.plates.primary}`);
          resolve(normalizedResult);

        } catch (parseError) {
          console.error(`[OCR Parse Error] ${parseError.message}`);
          console.error(`[OCR Output] ${outputBuffer.substring(0, 500)}`);
          resolve(defaultResult);
        }
      } else {
        console.error(`[OCR Error] Exit code: ${code}, output length: ${outputBuffer.length}`);
        if (errorBuffer) console.error(`[OCR Stderr] ${errorBuffer.substring(0, 500)}`);
        resolve(defaultResult);
      }
    });

    pythonProcess.on('error', (error) => {
      console.error(`[OCR Process Error] ${error.message}`);
      resolve(defaultResult);
    });
  });
}

module.exports = router;
