#!/usr/bin/env python3
"""
Wrapper script to integrate EasyOCR plate extraction with Node.js backend

This script is called from Node.js via child_process.spawn with JSON input
containing the list of violation frame paths.

Usage from Node.js:
    python extract_plates.py '["/path/to/frame1.jpg", "/path/to/frame2.jpg"]' '/path/to/violations/dir'
"""

import sys
import json
import os
from pathlib import Path

# Add ML_model directory to path
ml_model_dir = Path(__file__).parent
sys.path.insert(0, str(ml_model_dir))

# Write debug info immediately
with open(str(ml_model_dir / 'extract_debug.log'), 'w') as f:
    f.write(f"Script started\n")
    f.write(f"ML model dir: {ml_model_dir}\n")
    f.write(f"Args: {sys.argv}\n")

try:
    from easyocr_plate_extractor import extract_plates_from_violation_frames
except ImportError as e:
    with open(str(ml_model_dir / 'extract_debug.log'), 'a') as f:
        f.write(f"Import error: {e}\n")
    print(json.dumps({
        'success': False,
        'error': f'Failed to import easyocr_plate_extractor: {e}',
        'attempts': 0,
        'valid_extractions': 0,
        'all_extractions': []
    }))
    sys.exit(1)


def main():
    """Main entry point for plate extraction"""
    
    debug_log = ml_model_dir / 'extract_debug.log'
    
    try:
        # Parse command line arguments
        with open(str(debug_log), 'a') as f:
            f.write(f"Starting main()\n")
            
        if len(sys.argv) < 2:
            result = {
                'success': False,
                'error': 'Missing frame paths argument',
                'attempts': 0,
                'valid_extractions': 0,
                'all_extractions': []
            }
            with open(str(debug_log), 'a') as f:
                f.write(f"Missing args error\n")
            print(json.dumps(result))
            return 1
        
        # Get frames from JSON argument
        frames_json = sys.argv[1]
        violation_dir = sys.argv[2] if len(sys.argv) > 2 else '.'
        
        with open(str(debug_log), 'a') as f:
            f.write(f"Parsed args: violation_dir={violation_dir}\n")
            f.write(f"Frames JSON length: {len(frames_json)}\n")
        
        try:
            frame_paths = json.loads(frames_json)
            with open(str(debug_log), 'a') as f:
                f.write(f"JSON parsed: {len(frame_paths)} frames\n")
        except json.JSONDecodeError as e:
            result = {
                'success': False,
                'error': f'Invalid JSON for frames: {e}',
                'attempts': 0,
                'valid_extractions': 0,
                'all_extractions': []
            }
            with open(str(debug_log), 'a') as f:
                f.write(f"JSON decode error: {e}\n")
            print(json.dumps(result))
            return 1
        
        if not isinstance(frame_paths, list):
            result = {
                'success': False,
                'error': 'Frames must be a JSON array',
                'attempts': 0,
                'valid_extractions': 0,
                'all_extractions': []
            }
            with open(str(debug_log), 'a') as f:
                f.write(f"Not a list error\n")
            print(json.dumps(result))
            return 1
        
        # Construct full paths if violation_dir provided
        if violation_dir and violation_dir != '.':
            frame_paths = [
                os.path.join(violation_dir, f) if not os.path.isabs(f) else f
                for f in frame_paths
            ]
        
        with open(str(debug_log), 'a') as f:
            f.write(f"About to call extract_plates_from_violation_frames\n")
            f.write(f"First frame: {frame_paths[0] if frame_paths else 'none'}\n")
        
        # Call extractor
        result = extract_plates_from_violation_frames(frame_paths)
        
        with open(str(debug_log), 'a') as f:
            f.write(f"Extraction complete: success={result.get('success')}\n")
        
        # Ensure result is properly formatted
        if not isinstance(result, dict):
            result = {
                'success': False,
                'error': 'Invalid result type from extractor',
                'attempts': len(frame_paths),
                'valid_extractions': 0,
                'all_extractions': []
            }
        
        # Debug output
        import sys as sys2
        sys2.stderr.write(f"\n[DEBUG] Result: success={result.get('success')}, plate={result.get('plate')}\n")
        sys2.stderr.flush()
        
        # Output as JSON
        print(json.dumps(result))
        return 0 if result.get('success') else 1
    
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        debug_log = ml_model_dir / 'extract_debug.log'
        with open(str(debug_log), 'a') as f:
            f.write(f"Exception in main: {e}\n")
            f.write(f"{tb}\n")
        
        result = {
            'success': False,
            'error': f'Unexpected error: {str(e)}',
            'traceback': tb,
            'attempts': 0,
            'valid_extractions': 0,
            'all_extractions': []
        }
        print(json.dumps(result))
        return 1


if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)
