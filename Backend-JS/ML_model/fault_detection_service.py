#!/usr/bin/env python3
"""
Video Processing Service for Node.js Backend
This script acts as a bridge between Node.js and the YOLO ML model
It takes input/output paths and returns JSON analytics
"""

import sys
import json
import os
import cv2
import torch
import numpy as np
from collections import deque
from ultralytics import YOLO
import time

# ================= Configuration =================
MODEL_TYPE = 'yolov8s.pt'
CONF_THRESHOLD = 0.4
TARGET_CLASSES = [2, 3, 5, 7]  # Vehicles IDs

# ================= Setup Device =================
device = 'cuda' if torch.cuda.is_available() else 'cpu'

try:
    if device == 'cuda':
        torch.backends.cudnn.benchmark = True
        print(f"GPU Detected: {torch.cuda.get_device_name(0)}")
    else:
        print(f"Using CPU for processing")

    # Load model
    print(f"Loading YOLO model: {MODEL_TYPE}")
    model_path = os.path.join(os.path.dirname(__file__), MODEL_TYPE)
    model = YOLO(model_path)
    model.to(device)
    print("Model loaded successfully")

except Exception as e:
    print(f"Error loading model: {str(e)}")
    sys.exit(1)


# ================= Impact Analyzer Class =================
class ImpactAnalyzer:
    def __init__(self, history_length=15):
        self.track_history = {}
        self.history_length = history_length
        self.max_threat_score = 0
        self.total_threat_samples = 0

    def get_box_center_area(self, box):
        x1, y1, x2, y2 = box
        center_x = int((x1 + x2) / 2)
        center_y = int((y1 + y2) / 2)
        area = (x2 - x1) * (y2 - y1)
        return center_x, center_y, area

    def calculate_threat(self, track_id, current_box, frame_width):
        curr_cx, curr_cy, curr_area = self.get_box_center_area(current_box)
        frame_center_x = frame_width / 2

        if track_id not in self.track_history:
            self.track_history[track_id] = deque(maxlen=self.history_length)
            self.track_history[track_id].append((current_box, curr_cx, curr_area))
            return 0, (0, 255, 0)

        past_box, past_cx, past_area = self.track_history[track_id][0]
        threat_score = 0

        # Looming Factor
        growth_rate = (curr_area - past_area) / past_area if past_area > 0 else 0
        if growth_rate > 0.05:
            threat_score += 30
        if growth_rate > 0.15:
            threat_score += 50

        # Centering Factor
        past_offset = abs(past_cx - frame_center_x)
        curr_offset = abs(curr_cx - frame_center_x)
        if curr_offset < past_offset and curr_offset < (frame_width / 3):
            threat_score += 30

        threat_score = min(max(int(threat_score), 0), 100)
        
        # Update max threat tracking
        if threat_score > self.max_threat_score:
            self.max_threat_score = threat_score
        self.total_threat_samples += 1

        if threat_score < 30:
            color = (0, 255, 0)  # Green
        elif threat_score < 70:
            color = (0, 255, 255)  # Yellow
        else:
            color = (0, 0, 255)  # Red

        self.track_history[track_id].append((current_box, curr_cx, curr_area))
        return threat_score, color


# ================= Processing Function =================
def process_video_file(input_path, output_path):
    """Process video with YOLO detection and threat analysis"""
    
    analyzer = ImpactAnalyzer(history_length=10)
    analytics_data = {}

    print(f"Opening video: {input_path}")
    cap = cv2.VideoCapture(input_path)

    if not cap.isOpened():
        print(f"ERROR: Could not open video: {input_path}")
        return False, None

    fps = int(cap.get(cv2.CAP_PROP_FPS))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    print(f"Video info: {width}x{height}, {fps}fps, {total_frames} frames")

    # Setup video writer
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    if not out.isOpened():
        print(f"ERROR: Could not create output video: {output_path}")
        return False, None

    print(f"Starting processing of {total_frames} frames...")
    frame_count = 0
    high_threat_frames = 0

    processing_start = time.time()

    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break

        frame_count += 1
        if frame_count % 30 == 0:
            print(f"Processing frame {frame_count}/{total_frames}")

        # Run tracking on GPU
        results = model.track(
            frame,
            persist=True,
            conf=CONF_THRESHOLD,
            classes=TARGET_CLASSES,
            verbose=False,
            device=device
        )

        # Analyze results
        if results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy().astype(int)
            track_ids = results[0].boxes.id.cpu().numpy().astype(int)
            classes = results[0].boxes.cls.cpu().numpy().astype(int)
            confidences = results[0].boxes.conf.cpu().numpy()

            for box, track_id, cls_id, conf in zip(boxes, track_ids, classes, confidences):
                x1, y1, x2, y2 = box
                
                # Calculate threat
                score, color = analyzer.calculate_threat(track_id, box, width)

                # Store analytics
                if track_id not in analytics_data:
                    analytics_data[track_id] = {
                        'frames': [],
                        'max_score': 0,
                        'object_class': model.names[cls_id]
                    }

                analytics_data[track_id]['frames'].append({
                    'frame': frame_count,
                    'score': score,
                    'confidence': float(conf)
                })
                
                if score > analytics_data[track_id]['max_score']:
                    analytics_data[track_id]['max_score'] = score

                if score >= 70:
                    high_threat_frames += 1

                # Draw annotations
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                class_name = model.names[cls_id]
                label = f"ID:{track_id} {class_name}|{score}"
                t_size = cv2.getTextSize(label, 0, 0.6, 2)[0]
                cv2.rectangle(frame, (x1, y1 - t_size[1] - 6), (x1 + t_size[0], y1), color, -1)
                cv2.putText(frame, label, (x1, y1 - 5), 0, 0.6, (255, 255, 255), 2)

        out.write(frame)

    cap.release()
    out.release()

    processing_time = time.time() - processing_start
    print(f"Finished processing in {processing_time:.2f} seconds")

    # Compile analytics summary
    summary = {
        'totalFrames': total_frames,
        'detectedObjects': len(analytics_data),
        'incidentFrames': high_threat_frames,
        'riskScore': analyzer.max_threat_score / 100.0 if analyzer.max_threat_score > 0 else 0,
        'processingTime': round(processing_time, 2),
        'device': device.upper(),
        'trackingSummary': {
            'totalTracks': len(analytics_data),
            'averageThreatScore': round(analyzer.total_threat_samples / len(analytics_data)) if analytics_data else 0,
            'maxThreatScore': analyzer.max_threat_score
        },
        'trackDetails': analytics_data
    }

    return True, summary


# ================= Main Execution =================
if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python fault_detection_service.py <input_path> <output_path>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    # Validate input file
    if not os.path.exists(input_path):
        print(f"ERROR: Input file not found: {input_path}")
        sys.exit(1)

    try:
        success, analytics = process_video_file(input_path, output_path)
        
        if success:
            # Output analytics as JSON for Node.js to parse
            print("ANALYTICS_JSON:" + json.dumps(analytics))
            print("SUCCESS: Video processing completed")
            sys.exit(0)
        else:
            print("ERROR: Video processing failed")
            sys.exit(1)

    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
