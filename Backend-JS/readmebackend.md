# Smart Helmet Backend API

Node.js/Express backend for the Smart Helmet system. Provides video analysis for traffic violations (helmet detection, vehicle detection, license plate extraction) and garbage detection.

## Tech Stack

- **Runtime**: Node.js with Express.js
- **ML Models**: Python (TensorFlow/Keras, YOLOv8, EasyOCR)
- **Python Environment**: Virtual environment at `.venv/` with Python 3.12

## Quick Start

```bash
# Install Node.js dependencies
cd Backend-JS
npm install

# Ensure Python venv is set up (Python 3.12 required for TensorFlow)
# The venv should be at Smart-Helmet/.venv/

# Start the server
npm start
```

Server runs on `http://localhost:3000`

## API Endpoints

### Health Check

```
GET /health
GET /
```

### Video Analysis (Traffic Violations)

```
POST /api/video-analysis
```

- **Content-Type**: `multipart/form-data`
- **Field**: `video` (MP4, AVI, MOV, MKV, WEBM)
- **Max Size**: 500MB

**Response**:

```json
{
  "success": true,
  "video_id": "uuid",
  "annotated_video_url": "/outputs/{id}/annotated_video.mp4",
  "best_frame_url": "/outputs/{id}/best_frame.jpg",
  "helmet_violations_count": 5,
  "license_plate": "09A03439",
  "total_frames": 300,
  "processing_time": 45.2
}
```

### Garbage Detection (Single Image)

```
POST /api/garbage-image-check
```

- **Content-Type**: `multipart/form-data`
- **Field**: `image` (JPEG, PNG)
- **Max Size**: 10MB

**Response**:

```json
{
  "success": true,
  "garbage_detected": true,
  "confidence": 0.96,
  "processed_image_path": "/outputs/garbage/image_xxx.jpg",
  "timestamp": "2026-01-31T12:00:00.000Z"
}
```

### Helmet Detection (Direct)

```
POST /helmet-detect/detect
```

- **Content-Type**: `multipart/form-data`
- **Field**: `image`

## Project Structure

```
Backend-JS/
├── src/
│   ├── server.js              # Express server entry point
│   ├── middleware/            # CORS, error handling
│   ├── routes/
│   │   ├── index.js           # Route mounting
│   │   ├── videoAnalysis.js   # POST /api/video-analysis
│   │   ├── garbageRoutes.js   # POST /api/garbage-image-check
│   │   ├── helmet.js          # POST /helmet-detect/detect
│   │   ├── sensors.js         # Sensor data endpoints
│   │   └── users.js           # User management
│   └── utils/
│       ├── dual_model_ml_service.py  # Video processing (helmet + vehicle)
│       ├── garbageDetectionProcessor.js  # Garbage detection wrapper
│       ├── detect_garbage_frame.py   # TensorFlow garbage classifier
│       ├── easyocr_plate_extractor.py  # License plate OCR
│       └── annotate_video_with_plate.py  # Video annotation
├── ML_model/
│   ├── helmet_best.pt         # YOLOv8 helmet detection model
│   ├── yolov8s.pt             # YOLOv8 vehicle detection model
│   ├── garbage_classifier.keras  # TensorFlow garbage classifier
│   └── requirements.txt       # Python dependencies
├── outputs/                   # Processed videos, frames, garbage images
├── uploads/                   # Temporary upload storage
└── package.json
```

## ML Models

| Model                  | File                       | Purpose                                    |
| ---------------------- | -------------------------- | ------------------------------------------ |
| Helmet Detection       | `helmet_best.pt`           | YOLOv8 - Detects helmet/no-helmet          |
| Vehicle Detection      | `yolov8s.pt`               | YOLOv8 - Detects cars, motorcycles, trucks |
| Garbage Classification | `garbage_classifier.keras` | TensorFlow/MobileNet - Binary classifier   |
| License Plate OCR      | EasyOCR                    | Extracts text from license plates          |

## Static File Serving

- `/outputs/*` - Annotated videos, frames, garbage images
- `/results/*` - Processed results

## Environment

The backend uses a Python virtual environment for ML processing:

- **Path**: `Smart-Helmet/.venv/`
- **Python Version**: 3.12.10 (required for TensorFlow 2.20)
- **Key Packages**: tensorflow, ultralytics, easyocr, opencv-python

## Frontend Integration

The React Native app connects to this backend at `http://<IP>:3000`.

Configure the IP in `SmartHelmetApp/config/api.ts`:

```typescript
export const API_BASE = "http://192.168.1.157:3000";
```

## Processing Flow

### Video Analysis

1. Upload video → `/api/video-analysis`
2. Extract frames using OpenCV
3. Run YOLOv8 helmet detection on each frame
4. Run YOLOv8 vehicle detection for threat analysis
5. Extract license plate using EasyOCR on best violation frame
6. Generate annotated video with bounding boxes
7. Return URLs to annotated video and best frame

### Garbage Detection

1. Upload image → `/api/garbage-image-check`
2. Resize to 224x224 for MobileNet
3. Run TensorFlow classifier
4. If garbage detected (confidence > 0.5), save annotated image
5. Return detection result and annotated image URL
