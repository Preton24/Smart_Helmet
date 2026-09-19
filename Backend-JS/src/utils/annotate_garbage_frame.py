#!/usr/bin/env python3
"""
Annotate frame with garbage detection confidence
Helper script for Node.js garbage detection processor
"""

import sys
import json
import cv2
import os

def annotate_garbage_frame(input_path, output_path, confidence, is_garbage):
    """
    Annotate frame with garbage detection label
    Args:
        input_path: Path to input frame
        output_path: Path to save annotated frame
        confidence: Confidence score (0-1)
        is_garbage: Boolean indicating garbage detected
    """
    try:
        # Read frame
        frame = cv2.imread(input_path)
        if frame is None:
            return {
                "success": False,
                "error": f"Failed to read frame: {input_path}"
            }
        
        # Only annotate if garbage detected
        if is_garbage and confidence > 0.5:
            label = f"Garbage Detected ({confidence * 100:.1f}%)"
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 1.0
            thickness = 2
            color = (0, 0, 255)  # Red for garbage (BGR)
            
            # Get text size
            text_size, baseline = cv2.getTextSize(label, font, font_scale, thickness)
            text_width, text_height = text_size
            
            # Add background rectangle
            y_pos = 40
            cv2.rectangle(
                frame,
                (10, y_pos - text_height - 10),
                (20 + text_width, y_pos + 5),
                (0, 0, 0),  # Black background
                -1
            )
            
            # Put text
            cv2.putText(
                frame,
                label,
                (15, y_pos - 5),
                font,
                font_scale,
                color,
                thickness
            )
        
        # Create output directory
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        # Save annotated frame
        success = cv2.imwrite(output_path, frame)
        if not success:
            return {
                "success": False,
                "error": f"Failed to write frame: {output_path}"
            }
        
        return {
            "success": True,
            "saved_path": output_path
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) != 5:
        print(json.dumps({
            "success": False,
            "error": "Usage: python annotate_garbage_frame.py <input> <output> <confidence> <is_garbage>"
        }))
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    confidence = float(sys.argv[3])
    is_garbage = sys.argv[4].lower() == 'true'
    
    result = annotate_garbage_frame(input_path, output_path, confidence, is_garbage)
    print(json.dumps(result))
