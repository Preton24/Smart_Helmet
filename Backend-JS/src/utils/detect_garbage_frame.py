#!/usr/bin/env python3
"""
Stateless Garbage Detection Frame Processor
Analyzes single frames for garbage detection without buffering
Uses TensorFlow/Keras binary classifier (garbage/not_garbage)
"""

import sys
import json
import cv2
import numpy as np
import logging
from pathlib import Path

# TensorFlow imports
try:
    import tensorflow as tf
    from tensorflow import keras
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "TensorFlow/Keras not installed. Run: pip install tensorflow"
    }))
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class GarbageDetector:
    """
    Stateless binary garbage classifier
    - No frame buffering
    - Single model instance (lazy loaded)
    - Per-frame in/out processing
    """
    
    def __init__(self, model_path):
        """
        Initialize detector with model path
        Args:
            model_path: Path to garbage_classifier.keras model
        """
        self.model_path = Path(model_path)
        self.model = None
        self.input_size = (224, 224)  # Model expects 224x224 input
        
        if not self.model_path.exists():
            raise FileNotFoundError(f"Model not found: {model_path}")
        
        self._load_model()
    
    def _load_model(self):
        """Load TensorFlow/Keras model once"""
        try:
            logger.info(f"Loading garbage detection model: {self.model_path}")
            
            # Suppress TensorFlow warnings
            tf.get_logger().setLevel('ERROR')
            
            self.model = keras.models.load_model(str(self.model_path))
            logger.info(f"Model loaded successfully. Input shape: {self.model.input_shape}")
            
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise
    
    def preprocess_frame(self, frame):
        """
        Preprocess OpenCV frame for model inference
        - Resize to 224x224
        - Apply MobileNet preprocessing (matches training)
        
        Args:
            frame: OpenCV frame (BGR, uint8)
        
        Returns:
            Preprocessed frame ready for model (1, 224, 224, 3)
        """
        try:
            # Resize to model input size (keep BGR, MobileNet handles it)
            frame_resized = cv2.resize(frame, self.input_size, interpolation=cv2.INTER_LINEAR)
            
            # Convert to array and apply MobileNet preprocessing
            # This scales pixels to [-1, 1] range as expected by MobileNet
            img_array = tf.keras.preprocessing.image.img_to_array(frame_resized)
            img_array = tf.keras.applications.mobilenet.preprocess_input(img_array)
            
            # Add batch dimension: (224, 224, 3) -> (1, 224, 224, 3)
            batch = np.expand_dims(img_array, axis=0)
            
            return batch
            
        except Exception as e:
            logger.error(f"Error preprocessing frame: {e}")
            raise
    
    def detect_frame(self, frame):
        """
        Detect garbage in single frame
        Stateless: frame in, confidence out, frame not stored
        
        Args:
            frame: OpenCV frame (BGR, uint8)
        
        Returns:
            Dict with:
            {
                "success": bool,
                "is_garbage": bool,
                "garbage_confidence": float (0-1),
                "not_garbage_confidence": float (0-1),
                "error": str (optional)
            }
        """
        try:
            if self.model is None:
                return {
                    "success": False,
                    "error": "Model not loaded"
                }
            
            # Validate input
            if frame is None or frame.size == 0:
                return {
                    "success": False,
                    "error": "Invalid frame"
                }
            
            # Preprocess frame
            batch = self.preprocess_frame(frame)
            
            # Run inference
            # Model output: single sigmoid value
            # Based on typical binary classifier training order:
            # 0 = garbage (first alphabetically), 1 = not garbage
            predictions = self.model.predict(batch, verbose=0)
            
            # Extract confidence - model outputs single sigmoid value
            raw_prediction = float(predictions[0][0])
            
            # INVERTED: Low value = garbage, High value = not garbage
            # This is common when class folders are sorted alphabetically (garbage < not_garbage)
            garbage_conf = 1.0 - raw_prediction
            not_garbage_conf = raw_prediction
            
            # Classify as garbage if confidence > 0.5
            is_garbage = garbage_conf > 0.5
            
            return {
                "success": True,
                "is_garbage": is_garbage,
                "garbage_confidence": round(garbage_conf, 4),
                "not_garbage_confidence": round(not_garbage_conf, 4)
            }
            
        except Exception as e:
            logger.error(f"Error in detect_frame: {e}")
            return {
                "success": False,
                "error": str(e)
            }


# Global singleton - lazy loaded on first use
_garbage_detector = None


def get_garbage_detector(model_path=None):
    """
    Get global garbage detector instance (lazy loaded)
    
    Args:
        model_path: Optional path to model. If None, uses default location.
    
    Returns:
        GarbageDetector instance
    """
    global _garbage_detector
    
    if _garbage_detector is None:
        if model_path is None:
            # Default to ML_model directory
            script_dir = Path(__file__).parent.parent.parent
            model_path = script_dir / "ML_model" / "garbage_classifier.keras"
        
        _garbage_detector = GarbageDetector(str(model_path))
    
    return _garbage_detector


def detect_garbage_in_frame(frame, model_path=None):
    """
    Convenience function for single-frame garbage detection
    
    Args:
        frame: OpenCV frame (BGR, uint8)
        model_path: Optional path to model
    
    Returns:
        Detection result dict (see GarbageDetector.detect_frame)
    """
    detector = get_garbage_detector(model_path)
    return detector.detect_frame(frame)


if __name__ == "__main__":
    """
    CLI usage for testing:
    python detect_garbage_frame.py <image_path> [model_path]
    """
    if len(sys.argv) < 2:
        print("Usage: python detect_garbage_frame.py <image_path> [model_path]")
        sys.exit(1)
    
    image_path = sys.argv[1]
    model_path = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Read image
    frame = cv2.imread(image_path)
    if frame is None:
        print(json.dumps({
            "success": False,
            "error": f"Cannot read image: {image_path}"
        }))
        sys.exit(1)
    
    # Detect garbage
    result = detect_garbage_in_frame(frame, model_path)
    print(json.dumps(result))
