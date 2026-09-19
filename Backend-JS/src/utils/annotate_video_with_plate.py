"""
Annotate existing video with detected license plate information
"""

import cv2
import json
import sys
import os
import logging
from pathlib import Path
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def annotate_video_with_plate(input_video_path, output_video_path, plate_text, plate_2=None):
    """
    Annotate video with detected license plate information
    
    Args:
        input_video_path: Path to input video
        output_video_path: Path to output annotated video
        plate_text: Primary license plate text
        plate_2: Secondary license plate text (optional)
    
    Returns:
        Dictionary with results
    """
    try:
        # Open input video
        cap = cv2.VideoCapture(input_video_path)
        
        if not cap.isOpened():
            return {
                'success': False,
                'error': f'Cannot open video: {input_video_path}'
            }
        
        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        logger.info(f"Input video: {width}x{height}, {fps} FPS, {total_frames} frames")
        
        # Create output directory if needed
        output_dir = os.path.dirname(output_video_path)
        if output_dir:
            Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        # Setup video writer
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))
        
        if not out.isOpened():
            return {
                'success': False,
                'error': f'Cannot create video writer for: {output_video_path}'
            }
        
        logger.info(f"Output video: {output_video_path}")
        
        frame_count = 0
        
        # Process each frame
        while cap.isOpened():
            ret, frame = cap.read()
            
            if not ret:
                break
            
            # Add plate annotation
            annotated_frame = frame.copy()
            annotated_frame = add_plate_annotation(annotated_frame, plate_text, plate_2)
            
            # Write frame to output video
            out.write(annotated_frame)
            frame_count += 1
        
        cap.release()
        out.release()
        
        logger.info(f"Video annotation complete: {frame_count} frames processed")
        
        return {
            'success': True,
            'output_video': output_video_path,
            'frames_processed': frame_count,
            'primary_plate': plate_text,
            'secondary_plate': plate_2,
            'timestamp': datetime.now().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error annotating video: {e}")
        return {
            'success': False,
            'error': str(e)
        }


def add_plate_annotation(frame, plate_text, plate_2=None):
    """
    Add license plate annotation to a frame
    
    Args:
        frame: Input frame
        plate_text: Primary license plate text
        plate_2: Secondary license plate text (optional)
    
    Returns:
        Annotated frame
    """
    try:
        height, width = frame.shape[:2]
        
        # Add a black background bar at the bottom for the plate info
        bar_height = 80 if plate_2 else 60
        cv2.rectangle(frame, (0, height - bar_height), (width, height), (0, 0, 0), -1)
        
        # Add border around the bar
        cv2.rectangle(frame, (0, height - bar_height), (width, height), (0, 255, 0), 2)
        
        # Add primary plate text
        plate_label = f"License Plate: {plate_text}"
        text_color = (0, 255, 0)  # Green
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 1.0
        thickness = 2
        
        # Get text size to center it
        text_size = cv2.getTextSize(plate_label, font, font_scale, thickness)[0]
        text_x = (width - text_size[0]) // 2
        text_y = height - (60 if plate_2 else 20)
        
        cv2.putText(frame, plate_label, (text_x, text_y), font, font_scale, text_color, thickness)
        
        # Add secondary plate if available
        if plate_2:
            plate_label_2 = f"Alternate: {plate_2}"
            text_size_2 = cv2.getTextSize(plate_label_2, font, 0.8, 1)[0]
            text_x_2 = (width - text_size_2[0]) // 2
            text_y_2 = height - 20
            
            cv2.putText(frame, plate_label_2, (text_x_2, text_y_2), font, 0.8, (0, 165, 255), 1)
        
        return frame
    
    except Exception as e:
        logger.error(f"Error adding annotation: {e}")
        return frame


def main():
    """Main entry point"""
    if len(sys.argv) < 4:
        print(json.dumps({
            'error': 'Usage: python annotate_video_with_plate.py <input_video> <output_video> <plate_text> [plate_2]'
        }))
        sys.exit(1)
    
    input_video = sys.argv[1]
    output_video = sys.argv[2]
    plate_text = sys.argv[3]
    plate_2 = sys.argv[4] if len(sys.argv) > 4 else None
    
    try:
        logger.info(f"Starting video annotation")
        logger.info(f"Primary Plate: {plate_text}")
        if plate_2:
            logger.info(f"Secondary Plate: {plate_2}")
        
        result = annotate_video_with_plate(input_video, output_video, plate_text, plate_2)
        
        # Output as JSON for Node.js to parse
        print(json.dumps(result))
        
    except Exception as e:
        logger.error(f"Error: {e}")
        print(json.dumps({
            'error': str(e),
            'type': 'annotation_error'
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
