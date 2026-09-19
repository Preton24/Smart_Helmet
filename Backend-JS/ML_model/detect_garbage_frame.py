"""
Single Frame Garbage Detection
Stateless frame-by-frame garbage classification
"""

import os
import sys
import json
import logging
import numpy as np
import cv2
from pathlib import Path
from datetime import datetime

try:
    import tensorflow as tf
    from tensorflow import keras
except ImportError:
    raise ImportError("TensorFlow not installed. Run: pip install tensorflow")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class GarbageDetector:
    """Single frame garbage detection (stateless)"""
    
    INPUT_SIZE = 224
    CLASS_NAMES = ["not_garbage", "garbage"]
    
    def __init__(self, model_path):
        """Initialize garbage detector"""
        self.model_path = model_path
        self.model = None
        self._load_model()
    
    def _load_model(self):
        """Load the Keras model"""
        try:
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Model not found: {self.model_path}")
            
            logger.info(f"Loading garbage detection model from: {self.model_path}")
            self.model = keras.models.load_model(self.model_path)
            logger.info("Garbage detection model loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load garbage model: {e}")
            raise
    
    def preprocess_frame(self, frame):
        """
        Preprocess single frame for garbage detection
        
        Args:
            frame: OpenCV frame (BGR format)
            
        Returns:
            Preprocessed frame array
        """
        try:
            # Ensure frame is valid
            if frame is None or frame.size == 0:
                raise ValueError("Invalid frame")
            
            # Convert BGR to RGB
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Resize to model input size
            frame_resized = cv2.resize(frame_rgb, (self.INPUT_SIZE, self.INPUT_SIZE))
            
            # Normalize to [0, 1]
            frame_normalized = frame_resized.astype('float32') / 255.0
            
            # Add batch dimension
            frame_batch = np.expand_dims(frame_normalized, axis=0)
            
            return frame_batch
        
        except Exception as e:
            logger.error(f"Error preprocessing frame: {e}")
            raise
    
    def detect_frame(self, frame):
        """
        Detect garbage in a single frame (stateless)
        
        Args:
            frame: OpenCV frame (BGR format)
            
        Returns:
            Dictionary with detection results
        """
        try:
            # Preprocess
            frame_batch = self.preprocess_frame(frame)
            
            # Run inference
            predictions = self.model.predict(frame_batch, verbose=0)
            
            # Parse predictions
            if len(predictions.shape) > 1 and predictions.shape[1] == 2:
                # Two output neurons (softmax)
                garbage_confidence = float(predictions[0][1])
                not_garbage_confidence = float(predictions[0][0])
            else:
                # Single output neuron (sigmoid)
                garbage_confidence = float(predictions[0][0])
                not_garbage_confidence = 1.0 - garbage_confidence
            
            # Determine class
            is_garbage = garbage_confidence > 0.5
            predicted_class = self.CLASS_NAMES[1] if is_garbage else self.CLASS_NAMES[0]
            
            result = {
                'success': True,
                'predicted_class': predicted_class,
                'is_garbage': bool(is_garbage),
                'garbage_confidence': round(garbage_confidence, 4),
                'not_garbage_confidence': round(not_garbage_confidence, 4)
            }
            
            return result
        
        except Exception as e:
            logger.error(f"Error detecting garbage in frame: {e}")
            return {
                'success': False,
                'error': str(e)
            }


# Global model instance (loaded once)
_garbage_detector = None


def get_garbage_detector(model_path):
    """Get or create global garbage detector instance"""
    global _garbage_detector
    
    if _garbage_detector is None:
        _garbage_detector = GarbageDetector(model_path)
    
    return _garbage_detector


def detect_garbage_in_frame(frame_data, model_path):
    """
    Detect garbage in a single frame
    
    Args:
        frame_data: Base64 encoded frame or frame array
        model_path: Path to the model
        
    Returns:
        Detection result dictionary
    """
    try:
        # Get detector instance
        detector = get_garbage_detector(model_path)
        
        # Convert base64 to frame if needed
        if isinstance(frame_data, str):
            import base64
            frame_bytes = base64.b64decode(frame_data)
            frame_array = np.frombuffer(frame_bytes, dtype=np.uint8)
            frame = cv2.imdecode(frame_array, cv2.IMREAD_COLOR)
        else:
            frame = frame_data
        
        # Detect garbage
        result = detector.detect_frame(frame)
        
        return result
    
    except Exception as e:
        logger.error(f"Error: {e}")
        return {
            'success': False,
            'error': str(e)
        }


def main():
    """Main entry point for CLI usage"""
    if len(sys.argv) < 3:
        print(json.dumps({
            'error': 'Usage: python detect_garbage_frame.py <frame_path> <model_path>'
        }))
        sys.exit(1)
    
    frame_path = sys.argv[1]
    model_path = sys.argv[2]
    
    try:
        logger.info(f"Reading frame: {frame_path}")
        
        # Read frame
        frame = cv2.imread(frame_path)
        if frame is None:
            raise ValueError(f"Failed to read frame: {frame_path}")
        
        # Detect garbage
        detector = get_garbage_detector(model_path)
        result = detector.detect_frame(frame)
        
        # Output JSON
        print(json.dumps(result))
        sys.exit(0 if result.get('success') else 1)
    
    except Exception as e:
        logger.error(f"Error: {e}")
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
