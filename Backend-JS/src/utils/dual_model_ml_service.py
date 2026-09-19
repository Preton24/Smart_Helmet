#!/usr/bin/env python3
"""
Dual-Model Vehicle & Helmet Violation Detection Service
Runs YOLO v8 for vehicle threat detection + Custom YOLO for helmet detection
Processes videos and extracts violation frames for EasyOCR-based license plate extraction
"""

import sys
import json
import cv2
import numpy as np
import torch
from pathlib import Path
from ultralytics import YOLO
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
from datetime import datetime
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('ml_service.log')
    ]
)
logger = logging.getLogger(__name__)


class VehicleThreatAnalyzer:
    """Analyzes vehicle threats (looming, centering)"""
    
    def __init__(self):
        self.vehicle_classes = {2: 'car', 3: 'motorcycle', 5: 'bus', 7: 'truck'}
        self.track_history = {}
        
    def calculate_threat_score(self, bbox, frame_width, frame_height, track_id):
        """Calculate threat score based on looming and centering"""
        x1, y1, x2, y2 = bbox
        current_area = (x2 - x1) * (y2 - y1)
        center_x = (x1 + x2) / 2
        center_y = (y1 + y2) / 2
        
        threat = 0
        
        # Initialize tracking
        if track_id not in self.track_history:
            self.track_history[track_id] = {'areas': [current_area], 'positions': [(center_x, center_y)]}
        else:
            self.track_history[track_id]['areas'].append(current_area)
            self.track_history[track_id]['positions'].append((center_x, center_y))
            
            # Keep only last 15 frames
            if len(self.track_history[track_id]['areas']) > 15:
                self.track_history[track_id]['areas'].pop(0)
                self.track_history[track_id]['positions'].pop(0)
        
        # Looming factor (size growth)
        if len(self.track_history[track_id]['areas']) > 1:
            past_area = self.track_history[track_id]['areas'][0]
            growth_rate = (current_area - past_area) / (past_area + 1e-6)
            
            if growth_rate > 0.15:
                threat += 50
            elif growth_rate > 0.05:
                threat += 30
        
        # Centering factor
        center_distance = abs(center_x - frame_width / 2)
        if center_distance < frame_width * 0.15:
            threat += 20
            
            # Extra threat if approaching center
            if len(self.track_history[track_id]['positions']) > 1:
                prev_distance = abs(self.track_history[track_id]['positions'][-2][0] - frame_width / 2)
                if center_distance < prev_distance:
                    threat += 10
        
        return min(threat, 100)
    
    def get_color(self, threat_score):
        """Return color based on threat score"""
        if threat_score < 30:
            return (0, 255, 0)  # Green
        elif threat_score < 70:
            return (0, 255, 255)  # Yellow
        else:
            return (0, 0, 255)  # Red


class HelmetDetector:
    """Detects helmet violations"""
    
    def __init__(self, helmet_model_path):
        try:
            # Verify file exists
            helmet_path = Path(helmet_model_path)
            if not helmet_path.exists():
                raise FileNotFoundError(f"Helmet model file not found: {helmet_model_path}")
            
            logger.info(f"Loading helmet model from: {helmet_model_path}")
            self.model = YOLO(str(helmet_model_path))
            self.class_names = {0: 'WithHelmet', 1: 'WithoutHelmet', 2: 'NotPerson'}
            logger.info(f"Helmet model loaded successfully from {helmet_model_path}")
        except Exception as e:
            logger.error(f"Error loading helmet model: {e}")
            raise  # Re-raise to catch upstream
    
    def detect_helmet_violations(self, frame):
        """Detect helmet violations in frame"""
        if self.model is None:
            return []
        
        try:
            results = self.model(frame, conf=0.4)
            violations = []
            
            for result in results:
                for box in result.boxes:
                    class_id = int(box.cls[0])
                    confidence = float(box.conf[0])
                    
                    # Focus on "WithoutHelmet" detections (class_id == 1)
                    # Also look for class_id == 0 (WithHelmet) for plate region extraction
                    if class_id == 1:  # WithoutHelmet class
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                        violations.append({
                            'bbox': [x1, y1, x2, y2],
                            'class': 'WithoutHelmet',
                            'confidence': confidence,
                            'type': 'helmet_violation'
                        })
                        logger.info(f"Helmet Violation detected at [{x1}, {y1}, {x2}, {y2}]")
            
            return violations
        except Exception as e:
            logger.error(f"Error in helmet detection: {e}")
            return []


class DualModelVideoProcessor:
    """Process videos with both vehicle and helmet detection models"""
    
    def __init__(self, vehicle_model_path, helmet_model_path):
        # Verify model files exist
        vehicle_path = Path(vehicle_model_path)
        helmet_path = Path(helmet_model_path)
        
        if not vehicle_path.exists():
            raise FileNotFoundError(f"Vehicle model not found: {vehicle_model_path}")
        if not helmet_path.exists():
            raise FileNotFoundError(f"Helmet model not found: {helmet_model_path}")
        
        logger.info(f"Loading vehicle model: {vehicle_model_path}")
        self.vehicle_model = YOLO(str(vehicle_model_path))
        logger.info(f"Loading helmet detector: {helmet_model_path}")
        self.helmet_detector = HelmetDetector(str(helmet_model_path))
        self.threat_analyzer = VehicleThreatAnalyzer()
        self.violations = []
        self.best_violation_frame = None
        self.best_violation_score = 0
        self.violation_frames = []  # Store multiple frames for voting-based OCR
        
        # Garbage detection tracking (stateless, single best frame in RAM)
        self.best_garbage_frame = None
        self.best_garbage_confidence = 0.0
        self.garbage_detector = None  # Lazy loaded on first frame
        
    def process_frame(self, frame, frame_count):
        """Process single frame with both models"""
        frame_height, frame_width = frame.shape[:2]
        
        # Detect vehicles (threat detection)
        vehicle_violations = self._detect_vehicles(frame, frame_width, frame_height)
        
        # Detect helmet violations
        helmet_violations = self.helmet_detector.detect_helmet_violations(frame)
        
        # Detect garbage (stateless frame-by-frame)
        garbage_confidence, is_garbage = self._detect_garbage(frame)
        
        # Combine violations
        all_violations = vehicle_violations + helmet_violations
        
        # Calculate combined score
        combined_score = self._calculate_combined_score(vehicle_violations, helmet_violations)
        
        # Track best violation frame and extract plates
        self._update_best_violation(frame, combined_score, helmet_violations)
        
        # Track best garbage frame (single frame in RAM)
        self._update_best_garbage_frame(frame, is_garbage, garbage_confidence)
        
        # Annotate frame
        annotated_frame = self._annotate_frame(frame, vehicle_violations, helmet_violations)
        
        return annotated_frame, all_violations, combined_score
    
    def _detect_vehicles(self, frame, frame_width, frame_height):
        """Detect vehicles and calculate threat scores"""
        try:
            results = self.vehicle_model(frame, conf=0.4)
            violations = []
            
            for result in results:
                for i, box in enumerate(result.boxes):
                    class_id = int(box.cls[0])
                    confidence = float(box.conf[0])
                    track_id = int(box.id[0]) if box.id is not None else i
                    
                    # Detect vehicle classes
                    if class_id in [2, 3, 5, 7]:
                        bbox = box.xyxy[0].cpu().numpy().astype(int)
                        threat_score = self.threat_analyzer.calculate_threat_score(
                            bbox, frame_width, frame_height, track_id
                        )
                        
                        violations.append({
                            'bbox': bbox.tolist(),
                            'class': self.threat_analyzer.vehicle_classes.get(class_id, 'vehicle'),
                            'confidence': confidence,
                            'threat_score': threat_score,
                            'type': 'vehicle_threat',
                            'track_id': track_id
                        })
            
            return violations
        except Exception as e:
            logger.error(f"Error in vehicle detection: {e}")
            return []
    
    def _calculate_combined_score(self, vehicle_violations, helmet_violations):
        """Calculate combined violation score"""
        vehicle_score = max([v['threat_score'] for v in vehicle_violations], default=0)
        helmet_weight = 100 if helmet_violations else 0
        
        # Helmet violation is critical (weight = 100)
        # Vehicle threat is important (weight = 0-100)
        combined = max(helmet_weight, vehicle_score)
        
        return combined
    
    def _update_best_violation(self, frame, score, helmet_violations):
        """Store frames with high violation scores for voting-based OCR"""
        if score >= self.best_violation_score * 0.8:  # Store frames with 80%+ of best score
            self.violation_frames.append({
                'frame': frame.copy(),
                'score': score,
                'timestamp': datetime.now().isoformat()
            })
            # Keep only top 10 frames for voting
            if len(self.violation_frames) > 10:
                self.violation_frames.sort(key=lambda x: x['score'], reverse=True)
                self.violation_frames = self.violation_frames[:10]
        
        if score > self.best_violation_score:
            self.best_violation_score = score
            self.best_violation_frame = frame.copy()
    
    def _detect_garbage(self, frame):
        """
        Stateless garbage detection for single frame
        Returns: (garbage_confidence, is_garbage)
        Only best frame kept in RAM, all others discarded
        """
        try:
            # Lazy load garbage detector on first frame
            if self.garbage_detector is None:
                try:
                    from detect_garbage_frame import get_garbage_detector
                    self.garbage_detector = get_garbage_detector()
                    logger.info("Garbage detector initialized (lazy loaded)")
                except ImportError as e:
                    logger.warning(f"Garbage detector not available: {e}. Skipping garbage detection.")
                    return 0.0, False
            
            # Detect garbage in frame
            result = self.garbage_detector.detect_frame(frame)
            
            if not result.get('success', False):
                logger.warning(f"Garbage detection failed: {result.get('error', 'Unknown error')}")
                return 0.0, False
            
            garbage_confidence = result.get('garbage_confidence', 0.0)
            is_garbage = result.get('is_garbage', False)
            
            return garbage_confidence, is_garbage
            
        except Exception as e:
            logger.error(f"Error in garbage detection: {e}")
            return 0.0, False
    
    def _update_best_garbage_frame(self, frame, is_garbage, confidence):
        """
        Keep only BEST garbage frame in RAM
        Replace stored frame only if higher confidence found
        Requirement: At any time, at most ONE frame in RAM
        """
        # Only track if garbage detected
        if is_garbage and confidence > 0.5:
            # Replace stored frame only if confidence is higher
            if confidence > self.best_garbage_confidence:
                # Discard previous frame from memory
                self.best_garbage_frame = frame.copy()
                self.best_garbage_confidence = confidence
                logger.info(f"Updated best garbage frame (confidence: {confidence:.3f})")
    
    def get_best_garbage_frame(self):
        """Get best garbage frame if detected"""
        if self.best_garbage_frame is not None and self.best_garbage_confidence > 0.5:
            return self.best_garbage_frame, self.best_garbage_confidence
        return None, 0.0
    
    def _annotate_frame(self, frame, vehicle_violations, helmet_violations):
        """Annotate frame with detections"""
        try:
            annotated = frame.copy()
            
            # Annotate vehicle violations
            for violation in vehicle_violations:
                try:
                    x1, y1, x2, y2 = violation['bbox']
                    # Ensure coordinates are valid
                    x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
                    x1, x2 = max(0, x1), min(frame.shape[1], x2)
                    y1, y2 = max(0, y1), min(frame.shape[0], y2)
                    
                    threat = violation['threat_score']
                    color = self.threat_analyzer.get_color(threat)
                    
                    cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
                    label = f"{violation['class']}|{threat:.0f}"
                    cv2.putText(annotated, label, (x1, max(10, y1 - 10)),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                except Exception as e:
                    logger.warning(f"Error annotating vehicle: {e}")
                    continue
            
            # Annotate helmet violations
            for violation in helmet_violations:
                try:
                    x1, y1, x2, y2 = violation['bbox']
                    # Ensure coordinates are valid
                    x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
                    x1, x2 = max(0, x1), min(frame.shape[1], x2)
                    y1, y2 = max(0, y1), min(frame.shape[0], y2)
                    
                    color = (0, 0, 255)  # Red for helmet violation
                    
                    cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 3)
                    label = f"NO HELMET|{violation['confidence']:.2f}"
                    cv2.putText(annotated, label, (x1, max(10, y1 - 10)),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
                except Exception as e:
                    logger.warning(f"Error annotating helmet: {e}")
                    continue
            
            return annotated
        except Exception as e:
            logger.error(f"Error in annotation: {e}")
            return frame
    
    def _annotate_plate(self, frame, plate_text):
        """Annotate frame with detected license plate number"""
        try:
            annotated = frame.copy()
            height, width = frame.shape[:2]
            
            # Add a black background bar at the bottom for the plate info
            bar_height = 60
            cv2.rectangle(annotated, (0, height - bar_height), (width, height), (0, 0, 0), -1)
            
            # Add license plate text
            plate_label = f"License Plate: {plate_text}"
            text_color = (0, 255, 0)  # Green
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 1.2
            thickness = 2
            
            # Get text size to center it
            text_size = cv2.getTextSize(plate_label, font, font_scale, thickness)[0]
            text_x = (width - text_size[0]) // 2
            text_y = height - 15
            
            cv2.putText(annotated, plate_label, (text_x, text_y), font, font_scale, text_color, thickness)
            
            return annotated
        except Exception as e:
            logger.error(f"Error annotating plate: {e}")
            return frame
    
    def process_video(self, video_path, output_dir, detected_plate=None):
        """Process entire video and create annotated output with detected plate"""
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")
        
        frame_count = 0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        logger.info(f"Processing video: {video_path}")
        logger.info(f"Total frames: {total_frames}, FPS: {fps}, Resolution: {width}x{height}")
        if detected_plate:
            logger.info(f"Detected License Plate: {detected_plate}")
        
        # Create output directory
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        # Setup video writer for annotated output
        output_video_path = os.path.join(output_dir, 'annotated_violations.mp4')
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))
        
        logger.info(f"Output video will be saved to: {output_video_path}")
        
        while cap.isOpened():
            ret, frame = cap.read()
            
            if not ret:
                break
            
            annotated_frame, violations, score = self.process_frame(frame, frame_count)
            
            # Add detected license plate to frame if available
            if detected_plate:
                annotated_frame = self._annotate_plate(annotated_frame, detected_plate)
            
            # Write annotated frame to output video
            out.write(annotated_frame)
            
            if violations:
                logger.info(f"Frame {frame_count}: {len(violations)} violations detected (Score: {score})")
            
            frame_count += 1
        
        cap.release()
        out.release()
        
        # Save best violation image
        best_image_path = self._save_best_violation(output_dir)
        
        analytics = {
            'total_frames': frame_count,
            'best_violation_score': self.best_violation_score,
            'violation_frames': best_image_path,
            'annotated_video': output_video_path,
            'processing_complete': True,
            'timestamp': datetime.now().isoformat()
        }
        
        return analytics
    
    def _save_best_violation(self, output_dir):
        """Save violation frames for voting-based OCR extraction"""
        if not self.violation_frames:
            return None
        
        violation_frames_dir = os.path.join(output_dir, 'violation_frames')
        Path(violation_frames_dir).mkdir(parents=True, exist_ok=True)
        
        saved_frames = []
        for idx, violation_data in enumerate(self.violation_frames):
            filename = f"violation_frame_{idx:02d}_score_{violation_data['score']:.2f}.jpg"
            filepath = os.path.join(violation_frames_dir, filename)
            cv2.imwrite(filepath, violation_data['frame'])
            saved_frames.append(filename)
            logger.info(f"Saved violation frame: {filename}")
        
        return saved_frames


def main():
    """Main entry point"""
    if len(sys.argv) < 4:
        print(json.dumps({
            'error': 'Usage: python dual_model_ml_service.py <video_path> <vehicle_model> <helmet_model>'
        }))
        sys.exit(1)
    
    video_path = sys.argv[1]
    vehicle_model_path = sys.argv[2]
    helmet_model_path = sys.argv[3]
    output_dir = sys.argv[4] if len(sys.argv) > 4 else './results'
    
    try:
        logger.info(f"Starting dual-model processing")
        logger.info(f"Video: {video_path}")
        logger.info(f"Vehicle Model: {vehicle_model_path}")
        logger.info(f"Helmet Model: {helmet_model_path}")
        
        processor = DualModelVideoProcessor(vehicle_model_path, helmet_model_path)
        analytics = processor.process_video(video_path, output_dir)
        
        # Output as JSON for Node.js to parse
        print(json.dumps(analytics))
        
    except Exception as e:
        logger.error(f"Error processing video: {e}")
        print(json.dumps({
            'error': str(e),
            'type': 'processing_error'
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
