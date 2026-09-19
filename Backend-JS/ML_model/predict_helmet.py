#!/usr/bin/env python3
"""
Helmet Detection Inference Script
Loads YOLO model and performs inference on helmet detection.
Outputs JSON with detection results.
"""

import sys
import json
import argparse
from pathlib import Path
from ultralytics import YOLO


def predict_helmet(image_path, model_path):
    """
    Load YOLO model and perform helmet detection on image.
    
    Args:
        image_path: Path to the input image
        model_path: Path to the YOLO weights file
        
    Returns:
        dict: Detection results with classes, confidences, boxes, and decision
    """
    try:
        # Verify image exists
        if not Path(image_path).exists():
            return {
                'success': False,
                'error': f'Image not found: {image_path}'
            }
        
        # Verify model exists
        if not Path(model_path).exists():
            return {
                'success': False,
                'error': f'Model not found: {model_path}'
            }
        
        # Load YOLO model
        print(f"Loading YOLO model from: {model_path}", file=sys.stderr)
        model = YOLO(model_path)
        
        # Run inference
        print(f"Running inference on: {image_path}", file=sys.stderr)
        results = model.predict(source=image_path, conf=0.25)
        
        # Process first result (only one image)
        result = results[0]
        
        # Extract detection information
        detections = []
        detected_classes = set()
        has_helmet = False
        no_helmet_count = 0
        helmet_count = 0
        
        if result.boxes is not None:
            for box in result.boxes:
                # Get coordinates
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                
                # Get confidence
                confidence = float(box.conf[0])
                
                # Get class ID and class name
                class_id = int(box.cls[0])
                class_name = model.names[class_id]
                
                # Track helmet vs no-helmet
                if class_name.lower() == 'helmet':
                    helmet_count += 1
                    has_helmet = True
                elif class_name.lower() in ['no helmet', 'no_helmet', 'nothelmton']:
                    no_helmet_count += 1
                
                detected_classes.add(class_name)
                
                detections.append({
                    'class': class_name,
                    'class_id': class_id,
                    'confidence': confidence,
                    'bbox': {
                        'x1': round(x1, 2),
                        'y1': round(y1, 2),
                        'x2': round(x2, 2),
                        'y2': round(y2, 2),
                        'width': round(x2 - x1, 2),
                        'height': round(y2 - y1, 2)
                    }
                })
        
        # Determine helmet/no-helmet decision
        # Priority: 1. Presence of helmet class, 2. Count of helmets vs no-helmets
        helmet_decision = 'helmet' if has_helmet else ('no-helmet' if no_helmet_count > 0 else 'unknown')
        
        # Build response
        response = {
            'success': True,
            'image_path': str(image_path),
            'model_path': str(model_path),
            'detected_classes': list(detected_classes),
            'detection_count': len(detections),
            'detections': detections,
            'summary': {
                'helmet_count': helmet_count,
                'no_helmet_count': no_helmet_count,
                'decision': helmet_decision
            }
        }
        
        return response
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__
        }


def main():
    """Main entry point for helmet detection inference."""
    parser = argparse.ArgumentParser(
        description='YOLO Helmet Detection Inference',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python predict_helmet.py image.jpg models/helmet_best.pt
  python predict_helmet.py /path/to/image.jpg /path/to/model.pt
        '''
    )
    
    parser.add_argument('image_path', help='Path to the input image')
    parser.add_argument('model_path', help='Path to the YOLO weights file')
    
    args = parser.parse_args()
    
    # Run prediction
    result = predict_helmet(args.image_path, args.model_path)
    
    # Output JSON to stdout
    print(json.dumps(result))
    
    # Exit with appropriate code
    sys.exit(0 if result.get('success') else 1)


if __name__ == '__main__':
    main()
