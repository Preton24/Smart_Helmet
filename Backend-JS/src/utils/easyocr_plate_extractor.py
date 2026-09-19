#!/usr/bin/env python3
"""
License Plate Extraction Service using EasyOCR and Frequency Voting
Implements frame-based plate detection and voting from the Colab notebook approach
"""

import os
import cv2
import re
import numpy as np
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError:
    EASYOCR_AVAILABLE = False
    logger.warning("EasyOCR not installed. Install with: pip install easyocr")

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    logger.warning("Ultralytics not installed. Install with: pip install ultralytics")


class IndianPlateValidator:
    """Validates Indian number plate format"""
    
    @staticmethod
    def is_indian_number_plate(plate_text):
        """
        Validates if a given string adheres to typical Indian number plate formats.
        
        Args:
            plate_text (str): The cleaned and uppercased string to validate.
            
        Returns:
            bool: True if the string matches an Indian number plate format, False otherwise.
        """
        if not plate_text:
            return False
            
        # Pattern for Indian Number Plates:
        # ^[A-Z]{2}        - Two uppercase letters for state code (e.g., DL, MH)
        # -?               - Optional hyphen separator
        # \d{2}            - Two digits for district code
        # -?               - Optional hyphen separator
        # (?:[A-Z]{1,2}-?)? - Optional series code (1 or 2 letters)
        # \d{4}            - Four digits for final number
        # $                - End of string
        indian_plate_pattern = r"^[A-Z]{2}-?\d{2}-?(?:[A-Z]{1,2}-?)?\d{4}$"
        return re.fullmatch(indian_plate_pattern, plate_text) is not None


class PlatePreprocessor:
    """Preprocessing for plate images to enhance OCR accuracy"""
    
    @staticmethod
    def preprocess_plate(img):
        """
        Applies image preprocessing to enhance number plate readability.
        
        Args:
            img (numpy.ndarray): The cropped image of the number plate.
            
        Returns:
            numpy.ndarray: The preprocessed image.
        """
        if img is None or img.size == 0:
            return None
            
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Use adaptive thresholding for varying lighting conditions
        thresh = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, 11, 2
        )
        
        # Apply dilation to make characters thicker
        kernel = np.ones((2, 2), np.uint8)
        dilated = cv2.dilate(thresh, kernel, iterations=1)
        
        return dilated


class TextCleaner:
    """Cleans OCR extracted text"""
    
    @staticmethod
    def clean_plate_text(text):
        """
        Cleans the extracted OCR text to remove unwanted characters.
        
        Args:
            text (str): The raw text extracted by OCR.
            
        Returns:
            str: The cleaned and formatted text, or None if unsuitable.
        """
        if not text:
            return None
        
        # Convert to uppercase
        cleaned_text = text.upper()
        
        # Remove any characters that are not alphanumeric or hyphens
        cleaned_text = re.sub(r'[^A-Z0-9-]', '', cleaned_text)
        
        # Replace common OCR errors
        cleaned_text = cleaned_text.replace('O', '0')
        cleaned_text = cleaned_text.replace('I', '1')
        cleaned_text = cleaned_text.replace('S', '5')
        cleaned_text = cleaned_text.replace('Z', '2')
        
        # Remove consecutive hyphens, strip whitespace
        cleaned_text = re.sub(r'-+', '-', cleaned_text).strip()
        cleaned_text = cleaned_text.strip('-')
        
        # Filter by length (Indian plates are typically 7-10 characters)
        if 4 <= len(cleaned_text) <= 15:
            return cleaned_text
        else:
            return None


class PlateExtractor:
    """Extracts license plates from violation frames using EasyOCR"""
    
    def __init__(self, use_gpu=False):
        """
        Initialize the plate extractor.
        
        Args:
            use_gpu (bool): Whether to use GPU for OCR (requires CUDA)
        """
        if not EASYOCR_AVAILABLE:
            raise RuntimeError("EasyOCR is not installed. Install with: pip install easyocr")
        
        logger.info("Initializing EasyOCR reader...")
        self.reader = easyocr.Reader(['en'], gpu=use_gpu, verbose=False)
        self.validator = IndianPlateValidator()
        self.preprocessor = PlatePreprocessor()
        self.cleaner = TextCleaner()
        logger.info("EasyOCR reader initialized successfully")
    
    def extract_plate_from_frame(self, frame_path, detector_model=None):
        """
        Extract license plate from a single frame.
        
        Args:
            frame_path (str): Path to the frame image
            detector_model: Optional YOLO model for plate detection
            
        Returns:
            list: List of extracted valid plate texts
        """
        valid_plates = []
        
        # Read the image
        img = cv2.imread(frame_path)
        if img is None:
            logger.warning(f"Could not read image: {frame_path}")
            return valid_plates
        
        # If detector model provided, use it to find plates
        if detector_model is not None:
            try:
                results = detector_model.predict(source=img, save=False, verbose=False, conf=0.25)
                
                for r in results:
                    if r.boxes is not None and len(r.boxes) > 0:
                        for box in r.boxes:
                            x1, y1, x2, y2 = map(int, box.xyxy[0])
                            cls_id = int(box.cls[0])
                            
                            # Check if detected object is a plate
                            try:
                                if r.names[cls_id] == 'Plate':
                                    cropped_plate = img[y1:y2, x1:x2]
                                    if cropped_plate.shape[0] > 0 and cropped_plate.shape[1] > 0:
                                        plate_text = self._extract_text_from_plate(cropped_plate)
                                        if plate_text:
                                            valid_plates.append(plate_text)
                            except (KeyError, IndexError, AttributeError):
                                continue
            except Exception as e:
                logger.warning(f"Error in plate detection: {e}")
        else:
            # If no detector, extract text from bottom 40% of frame (license plate region)
            height = img.shape[0]
            crop_height = int(height * 0.4)
            crop_top = height - crop_height
            
            plate_region = img[crop_top:, :]
            plate_text = self._extract_text_from_plate(plate_region)
            if plate_text:
                valid_plates.append(plate_text)
        
        return valid_plates
    
    def _extract_text_from_plate(self, cropped_plate):
        """
        Extract and validate text from a cropped plate image.
        
        Args:
            cropped_plate (numpy.ndarray): Cropped plate image
            
        Returns:
            str: Valid plate text or None
        """
        if cropped_plate is None or cropped_plate.size == 0:
            return None
        
        # Preprocess the plate
        preprocessed = self.preprocessor.preprocess_plate(cropped_plate)
        if preprocessed is None:
            return None
        
        # Run OCR
        try:
            ocr_results = self.reader.readtext(preprocessed, detail=1)
            
            for detection in ocr_results:
                if len(detection) >= 2:
                    bbox, text, confidence = detection[0], detection[1], detection[2]
                    
                    # Clean the extracted text
                    cleaned_text = self.cleaner.clean_plate_text(text)
                    
                    # Validate the cleaned text
                    if cleaned_text and self.validator.is_indian_number_plate(cleaned_text):
                        logger.info(f"Valid plate extracted: {cleaned_text} (confidence: {confidence:.2f})")
                        return cleaned_text
        except Exception as e:
            logger.warning(f"Error during OCR: {e}")
        
        return None
    
    def extract_from_violation_frames(self, violation_frame_paths, violation_frames_dir):
        """
        Extract plates from multiple violation frames and vote for best result.
        
        Args:
            violation_frame_paths (list): List of frame filenames
            violation_frames_dir (str): Directory containing the frames
            
        Returns:
            dict: Results with extracted plate and confidence
        """
        if not violation_frame_paths or not violation_frames_dir:
            logger.warning("No violation frames provided")
            return {
                'success': False,
                'plate': None,
                'confidence': 0,
                'message': 'No violation frames provided'
            }
        
        logger.info(f"Starting plate extraction from {len(violation_frame_paths)} frames")
        
        # Dictionary to store plate candidates with their counts and confidences
        plate_candidates = {}
        all_valid_plates = []
        
        # Process each frame
        for idx, frame_name in enumerate(violation_frame_paths):
            frame_path = os.path.join(violation_frames_dir, frame_name)
            logger.info(f"Processing frame {idx + 1}/{len(violation_frame_paths)}: {frame_name}")
            
            # Extract plates from this frame
            extracted_plates = self.extract_plate_from_frame(frame_path)
            
            for plate_text in extracted_plates:
                all_valid_plates.append(plate_text)
                
                # Update plate candidates dictionary
                if plate_text in plate_candidates:
                    plate_candidates[plate_text]['count'] += 1
                else:
                    plate_candidates[plate_text] = {'count': 1}
        
        logger.info(f"Total valid plates extracted: {len(all_valid_plates)}")
        
        if not plate_candidates:
            logger.warning("No valid plates extracted from any frame")
            return {
                'success': False,
                'plate': None,
                'confidence': 0,
                'attempts': len(violation_frame_paths),
                'message': 'No valid plates extracted from any frame'
            }
        
        # Log plate candidates
        logger.info("Plate candidates summary:")
        for plate_text, data in plate_candidates.items():
            logger.info(f"  Plate: '{plate_text}', Count: {data['count']}")
        
        # Select the best plate based on frequency
        final_plate = max(plate_candidates.items(), key=lambda x: x[1]['count'])[0]
        max_count = plate_candidates[final_plate]['count']
        
        # Calculate confidence as frequency ratio
        confidence = max_count / len(violation_frame_paths)
        
        logger.info(f"\nFinal selected plate: '{final_plate}'")
        logger.info(f"Detected in {max_count}/{len(violation_frame_paths)} frames")
        logger.info(f"Confidence: {confidence * 100:.1f}%")
        
        return {
            'success': True,
            'plate': final_plate,
            'confidence': confidence,
            'attempts': len(violation_frame_paths),
            'valid_extractions': len(all_valid_plates),
            'all_extractions': all_valid_plates,
            'message': f'Successfully extracted plate from {max_count} frames'
        }


def extract_plates_from_violation_frames(violation_frame_paths, violation_frames_dir):
    """
    Standalone function to extract plates from violation frames.
    
    Args:
        violation_frame_paths (list): List of frame filenames
        violation_frames_dir (str): Directory containing frames
        
    Returns:
        dict: Results with extracted plate information
    """
    try:
        extractor = PlateExtractor(use_gpu=False)  # Set use_gpu=True if you have CUDA
        result = extractor.extract_from_violation_frames(violation_frame_paths, violation_frames_dir)
        return result
    except Exception as e:
        logger.error(f"Plate extraction failed: {e}")
        return {
            'success': False,
            'plate': None,
            'confidence': 0,
            'error': str(e)
        }


if __name__ == '__main__':
    # Example usage
    import json
    
    violation_frames = [
        'violation_frame_00_score_80.00.jpg',
        'violation_frame_01_score_80.00.jpg',
        'violation_frame_02_score_70.00.jpg'
    ]
    
    violation_dir = './test_analysis_output/violation_frames/'
    
    if os.path.exists(violation_dir):
        result = extract_plates_from_violation_frames(violation_frames, violation_dir)
        print(json.dumps(result, indent=2))
    else:
        print(f"Directory not found: {violation_dir}")
