#!/usr/bin/env python3
"""
Unified ML Service: Helmet Detection + Vehicle Threat Detection
Processes video for helmet and vehicle violations
Note: Garbage detection requires TensorFlow (optional)
"""

import json
import sys
import os
import cv2
import numpy as np
from pathlib import Path
import traceback

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from ultralytics import YOLO
except ImportError as e:
    print(f"[Error] Missing ultralytics: {e}", file=sys.stderr)
    sys.exit(1)

# TensorFlow is optional - we'll import it lazily when needed
tf = None


class DualModelMLService:
    """Unified video analysis service"""
    
    def __init__(self, model_dir):
        self.model_dir = model_dir
        self.helmet_model = None
        self.vehicle_model = None
        self.garbage_model = None
        self._load_models()
    
    def _load_models(self):
        """Load all ML models"""
        try:
            # Load YOLO models
            helmet_path = os.path.join(self.model_dir, 'helmet_best.pt')
            vehicle_path = os.path.join(self.model_dir, 'yolov8s.pt')
            
            if os.path.exists(helmet_path):
                self.helmet_model = YOLO(helmet_path)
                print("[Models] Helmet model loaded")
            else:
                print(f"[Warning] Helmet model not found: {helmet_path}", file=sys.stderr)
            
            if os.path.exists(vehicle_path):
                self.vehicle_model = YOLO(vehicle_path)
                print("[Models] Vehicle model loaded")
            else:
                print(f"[Warning] Vehicle model not found: {vehicle_path}", file=sys.stderr)
            
            # Garbage detection is DISABLED for video processing
            # Use /api/garbage-image-check for single image garbage detection
            self.garbage_model = None
            print("[Models] Garbage detection disabled for video (use image endpoint instead)")
        
        except Exception as e:
            print(f"[Error] Failed to load models: {e}", file=sys.stderr)
            raise
    
    def process_video(self, video_path, output_dir):
        """
        Process video for helmet + vehicle detection (garbage detection disabled for video)
        Use /api/garbage-image-check for single image garbage detection
        
        Args:
            video_path: Path to input video
            output_dir: Directory for outputs
            
        Returns:
            Dictionary with analysis results
        """
        try:
            # Create output directories
            os.makedirs(output_dir, exist_ok=True)
            violation_frames_dir = os.path.join(output_dir, 'violation_frames')
            os.makedirs(violation_frames_dir, exist_ok=True)
            
            # Open video
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                return {
                    "success": False,
                    "error": f"Cannot open video: {video_path}"
                }
            
            # Get video properties
            fps = cap.get(cv2.CAP_PROP_FPS)
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration = total_frames / fps if fps > 0 else 0
            
            # Video writer for annotated output - Try multiple H.264 variants for web compatibility
            output_video_path = os.path.join(output_dir, 'annotated_violations.mp4')
            
            codecs = ['avc1', 'H264', 'X264', 'mp4v']
            fourcc = None
            for codec in codecs:
                try:
                    fcc = cv2.VideoWriter_fourcc(*codec)
                    test_out = cv2.VideoWriter(os.path.join(output_dir, 'test.mp4'), fcc, 1, (width, height))
                    if test_out.isOpened():
                        test_out.release()
                        fourcc = fcc
                        print(f"[Video] Successfully initialized with codec: {codec}")
                        break
                except:
                    continue
            
            if fourcc is None:
                print("[Video] Warning: No preferred codec worked, falling back to mp4v", file=sys.stderr)
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                
            out = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))
            
            # Clean up test file if it exists
            if os.path.exists(os.path.join(output_dir, 'test.mp4')):
                os.remove(os.path.join(output_dir, 'test.mp4'))
            
            # Analysis storage
            helmet_violations = []
            vehicle_threats = []
            helmet_violation_frames = []  # Store with confidence for top 5 selection
            vehicle_violation_frames = []  # Store with threat score for top 5 selection
            garbage_frames = []
            garbage_violation_frames = []  # Store with confidence for top 5 selection
            best_garbage_frame = None
            best_garbage_confidence = 0
            best_garbage_frame_number = None
            
            frame_count = 0
            
            print(f"[Video] Total frames: {total_frames}, FPS: {fps}, Resolution: {width}x{height}")
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                frame_copy = frame.copy()
                
                # === HELMET DETECTION ===
                if self.helmet_model:
                    try:
                        helmet_results = self.helmet_model(frame, conf=0.5)
                        
                        for result in helmet_results:
                            for box in result.boxes:
                                conf = float(box.conf[0])
                                cls = int(box.cls[0])
                                x1, y1, x2, y2 = map(int, box.xyxy[0])
                                
                                # Class 0 = helmet, Class 1 = no helmet
                                if cls == 1:  # No helmet
                                    helmet_violations.append({
                                        "frame_number": frame_count,
                                        "confidence": round(conf, 2),
                                        "bbox": [x1, y1, x2, y2]
                                    })
                                    # Store for top 10 selection - score by confidence and detection size
                                    bbox_area = (x2 - x1) * (y2 - y1)
                                    helmet_violation_frames.append({
                                        "frame": frame.copy(),
                                        "confidence": conf,
                                        "bbox_area": bbox_area,  # Larger detections are better for OCR
                                        "frame_number": frame_count
                                    })
                                    
                                    # Draw red box for no helmet
                                    cv2.rectangle(frame_copy, (x1, y1), (x2, y2), (0, 0, 255), 2)
                                    cv2.putText(frame_copy, f"No Helmet {conf:.2f}", (x1, y1-5),
                                              cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
                                else:
                                    # Draw green box for helmet
                                    cv2.rectangle(frame_copy, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    
                    except Exception as e:
                        print(f"[Warning] Helmet detection error on frame {frame_count}: {e}", file=sys.stderr)
                
                # === VEHICLE DETECTION ===
                if self.vehicle_model:
                    try:
                        vehicle_results = self.vehicle_model(frame, conf=0.5)
                        
                        for result in vehicle_results:
                            for box in result.boxes:
                                conf = float(box.conf[0])
                                cls = int(box.cls[0])
                                x1, y1, x2, y2 = map(int, box.xyxy[0])
                                
                                # Calculate threat score (0-100)
                                center_x = (x1 + x2) / 2
                                center_y = (y1 + y2) / 2
                                frame_center_x = width / 2
                                frame_center_y = height / 2
                                
                                distance_from_center = np.sqrt(
                                    (center_x - frame_center_x)**2 + 
                                    (center_y - frame_center_y)**2
                                )
                                max_distance = np.sqrt(frame_center_x**2 + frame_center_y**2)
                                
                                # Threat score: higher if centered and closer
                                threat_score = min(100, int((1 - distance_from_center / max_distance) * 100 * conf))
                                
                                vehicle_threats.append({
                                    "frame_number": frame_count,
                                    "vehicle_type": self._get_vehicle_type(cls),
                                    "threat_score": threat_score,
                                    "threat_level": self._get_threat_level(threat_score),
                                    "bbox": [x1, y1, x2, y2],
                                    "confidence": round(conf, 2)
                                })
                                
                                # Store for top 10 selection - score by confidence and detection size
                                bbox_area = (x2 - x1) * (y2 - y1)
                                vehicle_violation_frames.append({
                                    "frame": frame.copy(),
                                    "confidence": conf,
                                    "bbox_area": bbox_area,  # Larger vehicle detections = better plate visibility
                                    "frame_number": frame_count
                                })
                                
                                # Draw yellow box for vehicle
                                color = (0, 165, 255) if threat_score > 70 else (0, 255, 255)
                                cv2.rectangle(frame_copy, (x1, y1), (x2, y2), color, 2)
                                cv2.putText(frame_copy, f"Threat: {threat_score}", (x1, y2+20),
                                          cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                    
                    except Exception as e:
                        print(f"[Warning] Vehicle detection error on frame {frame_count}: {e}", file=sys.stderr)
                
                # === GARBAGE DETECTION ===
                if self.garbage_model:
                    try:
                        # Import tensorflow lazily
                        import tensorflow as tf
                        
                        # Prepare frame for garbage model
                        img_resized = cv2.resize(frame, (224, 224))
                        img_array = tf.keras.preprocessing.image.img_to_array(img_resized)
                        img_array = tf.keras.applications.mobilenet.preprocess_input(img_array)
                        img_batch = tf.expand_dims(img_array, axis=0)
                        
                        # Predict
                        prediction = self.garbage_model.predict(img_batch, verbose=0)
                        garbage_conf = float(prediction[0][0]) if len(prediction[0]) > 0 else 0
                        
                        # Class 0 = garbage, Class 1 = clean
                        is_garbage = garbage_conf > 0.5
                        
                        if is_garbage:
                            garbage_frames.append({
                                "frame_number": frame_count,
                                "confidence": round(garbage_conf, 2)
                            })
                            
                            # Keep best garbage frame
                            if garbage_conf > best_garbage_confidence:
                                best_garbage_confidence = garbage_conf
                                best_garbage_frame = frame.copy()
                                best_garbage_frame_number = frame_count
                            
                            # Store for top 10 selection
                            garbage_violation_frames.append({
                                "frame": frame.copy(),
                                "confidence": garbage_conf,
                                "bbox_area": frame.size,  # Full frame area for garbage
                                "frame_number": frame_count
                            })
                            
                            # Draw red text for garbage
                            cv2.putText(frame_copy, f"GARBAGE {garbage_conf:.2f}", (10, 30),
                                      cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                    
                    except Exception as e:
                        print(f"[Warning] Garbage detection error on frame {frame_count}: {e}", file=sys.stderr)
                
                # Write annotated frame to video
                out.write(frame_copy)
                frame_count += 1
                
                # Progress every 100 frames
                if frame_count % 100 == 0:
                    print(f"[Progress] Processed {frame_count}/{total_frames} frames")
            
            # Release video resources
            cap.release()
            out.release()
            
            # Save top 10 violation frames for OCR (scored by confidence * detection size)
            violation_frame_count = 0
            
            # Top 10 helmet violations (score by confidence and bbox area for better plate visibility)
            if helmet_violation_frames:
                # Score: confidence * normalized_bbox_area
                max_area = max([f['bbox_area'] for f in helmet_violation_frames]) if helmet_violation_frames else 1
                for f in helmet_violation_frames:
                    f['score'] = f['confidence'] * (f['bbox_area'] / max_area)
                
                top_helmet = sorted(helmet_violation_frames, key=lambda x: x['score'], reverse=True)[:10]
                for item in top_helmet:
                    violation_frame_path = os.path.join(violation_frames_dir, f'{violation_frame_count:04d}.jpg')
                    cv2.imwrite(violation_frame_path, item['frame'])
                    violation_frame_count += 1
            
            # Top 10 vehicle threats (by detection confidence and size)
            if vehicle_violation_frames:
                max_area = max([f.get('bbox_area', 1) for f in vehicle_violation_frames]) if vehicle_violation_frames else 1
                for f in vehicle_violation_frames:
                    if 'bbox_area' not in f:
                        f['bbox_area'] = 0
                    f['score'] = f['confidence'] * (f['bbox_area'] / max_area)
                
                top_vehicle = sorted(vehicle_violation_frames, key=lambda x: x['score'], reverse=True)[:10]
                for item in top_vehicle:
                    violation_frame_path = os.path.join(violation_frames_dir, f'{violation_frame_count:04d}.jpg')
                    cv2.imwrite(violation_frame_path, item['frame'])
                    violation_frame_count += 1
            
            # Top 10 garbage frames (by detection confidence and size)
            if garbage_violation_frames:
                max_area = max([f.get('bbox_area', 1) for f in garbage_violation_frames]) if garbage_violation_frames else 1
                for f in garbage_violation_frames:
                    if 'bbox_area' not in f:
                        f['bbox_area'] = 0
                    f['score'] = f['confidence'] * (f['bbox_area'] / max_area)
                
                top_garbage = sorted(garbage_violation_frames, key=lambda x: x['score'], reverse=True)[:10]
                for item in top_garbage:
                    violation_frame_path = os.path.join(violation_frames_dir, f'{violation_frame_count:04d}.jpg')
                    cv2.imwrite(violation_frame_path, item['frame'])
                    violation_frame_count += 1
            
            # Save best garbage frame if found
            garbage_frame_path = None
            if best_garbage_frame is not None:
                garbage_frame_path = os.path.join(output_dir, 'best_garbage_frame.jpg')
                cv2.imwrite(garbage_frame_path, best_garbage_frame)
            
            # Compile results
            result = {
                "success": True,
                "violations": {
                    "helmet": {
                        "count": len(helmet_violations),
                        "details": helmet_violations
                    },
                    "vehicle": {
                        "count": len(vehicle_threats),
                        "details": vehicle_threats
                    },
                    "total_count": len(helmet_violations) + len(vehicle_threats)
                },
                "garbage_detected": len(garbage_frames) > 0,
                "garbage_frames_count": len(garbage_frames),
                "best_garbage_frame": garbage_frame_path,
                "best_garbage_confidence": round(best_garbage_confidence, 4),
                "best_garbage_frame_number": best_garbage_frame_number,
                "video_info": {
                    "total_frames": total_frames,
                    "fps": round(fps, 2),
                    "duration": round(duration, 2),
                    "resolution": f"{width}x{height}"
                },
                "output_video": output_video_path
            }
            
            print("[Results] Analysis complete")
            print(f"  - Helmet violations: {len(helmet_violations)}")
            print(f"  - Vehicle threats: {len(vehicle_threats)}")
            print(f"  - Garbage frames: {len(garbage_frames)}")
            print(f"  - Output video: {output_video_path}")
            
            return result
        
        except Exception as e:
            print(f"[Error] Video processing failed: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    def _get_vehicle_type(class_id):
        """Map YOLO class ID to vehicle type"""
        vehicle_classes = {
            2: "car",
            3: "motorcycle",
            5: "bus",
            7: "truck"
        }
        return vehicle_classes.get(class_id, f"vehicle_{class_id}")
    
    @staticmethod
    def _get_threat_level(threat_score):
        """Categorize threat score"""
        if threat_score < 30:
            return "low"
        elif threat_score < 70:
            return "medium"
        else:
            return "high"


def main():
    """Main entry point"""
    if len(sys.argv) < 3:
        print("Usage: python dual_model_ml_service.py <video_path> <output_dir>")
        sys.exit(1)
    
    video_path = sys.argv[1]
    output_dir = sys.argv[2]
    
    if not os.path.exists(video_path):
        result = {
            "success": False,
            "error": f"Video file not found: {video_path}"
        }
        print(json.dumps(result))
        sys.exit(1)
    
    # Initialize service
    model_dir = os.path.dirname(os.path.abspath(__file__))
    service = DualModelMLService(model_dir)
    
    # Process video
    result = service.process_video(video_path, output_dir)
    
    # Output JSON result
    print(json.dumps(result))


if __name__ == '__main__':
    main()
