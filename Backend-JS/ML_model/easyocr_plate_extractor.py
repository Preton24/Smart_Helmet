"""
EasyOCR-based License Plate Extraction with Frequency Voting

Extracts license plates from violation frames using EasyOCR and applies
frequency-based voting to determine the most likely plate across multiple frames.
"""

import os
import sys
import warnings

# Suppress PyTorch warnings about pin_memory
warnings.filterwarnings('ignore', category=UserWarning, module='torch')
os.environ['PYTHONWARNINGS'] = 'ignore'

import cv2
import re
import json
import logging
from pathlib import Path
from typing import List, Dict, Tuple, Optional
import numpy as np

try:
    import easyocr
except ImportError:
    raise ImportError("easyocr not installed. Run: pip install easyocr")

# Configure logging - suppress stdout for clean JSON output
log_file = Path(__file__).parent / 'plate_extraction.log'
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(str(log_file))  # Only log to file, NOT console
    ]
)
logger = logging.getLogger(__name__)


class IndianPlateValidator:
    """Validates Indian license plate format"""
    
    # Pattern for Indian plates: MH 12 AB 1234 or MH12AB1234
    # State code (2 letters) + district code (2 digits) + optional letter(s) + 4 digits
    INDIAN_PLATE_PATTERN = r'^[A-Z]{2}-?\d{2}-?(?:[A-Z]{1,2}-?)?\d{4}$'
    
    @staticmethod
    def is_indian_number_plate(text: str) -> bool:
        """
        Check if text matches Indian license plate format
        
        Args:
            text: Text to validate
            
        Returns:
            True if matches Indian plate format
        """
        if not text:
            return False
        
        # Remove spaces and convert to uppercase
        text = text.upper().replace(' ', '')
        
        # Check if matches pattern
        return bool(re.match(IndianPlateValidator.INDIAN_PLATE_PATTERN, text))


class PlatePreprocessor:
    """Preprocesses images for better OCR accuracy"""
    
    @staticmethod
    def preprocess_plate(image: np.ndarray) -> np.ndarray:
        """
        Preprocess plate image for OCR
        
        Args:
            image: Input image (BGR)
            
        Returns:
            Preprocessed image
        """
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Apply adaptive thresholding for better contrast
        thresh = cv2.adaptiveThreshold(
            blurred, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            11, 2
        )
        
        # Apply dilation to enhance text
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        dilated = cv2.dilate(thresh, kernel, iterations=1)
        
        return dilated


class TextCleaner:
    """Cleans OCR output text"""
    
    # Common OCR errors for number plates
    OCR_CORRECTIONS = {
        'O': '0',  # Letter O to zero
        'I': '1',  # Letter I to one
        'L': '1',  # Letter L to one
        'S': '5',  # Letter S to five
        'Z': '2',  # Letter Z to two
        '~': '',   # Tilde to nothing
        ':': '',   # Colon to nothing
        '<': '',   # Less than to nothing
        '>': '',   # Greater than to nothing
        '(': '',   # Parenthesis
        ')': '',   # Parenthesis
        '[': '',   # Bracket
        ']': '',   # Bracket
        '{': '',   # Brace
        '}': '',   # Brace
    }
    
    @staticmethod
    def clean_plate_text(text: str) -> Optional[str]:
        """
        Clean OCR output text
        
        Args:
            text: Raw OCR text
            
        Returns:
            Cleaned text or None if invalid
        """
        if not text:
            return None
        
        # Convert to uppercase
        text = text.upper().strip()
        
        # Fix common OCR errors
        for char, replacement in TextCleaner.OCR_CORRECTIONS.items():
            text = text.replace(char, replacement)
        
        # Remove any remaining non-alphanumeric except hyphens and spaces
        text = re.sub(r'[^A-Z0-9\-\s]', '', text)
        
        # Remove extra spaces
        text = ' '.join(text.split())
        
        # Remove hyphens and spaces for validation (but keep track of original)
        clean_alphanumeric = text.replace('-', '').replace(' ', '')
        
        # Must have at least 4 characters
        if len(clean_alphanumeric) < 4:
            return None
        
        # Maximum 15 characters (Indian plates are max 15)
        if len(clean_alphanumeric) > 15:
            # Take first 15 characters
            text = text[:15]
            clean_alphanumeric = clean_alphanumeric[:15]
        
        return text.replace(' ', '') if text else None


class PlateExtractor:
    """Extracts license plates from violation frames using EasyOCR"""
    
    def __init__(self, model_path: Optional[str] = None, device: str = 'auto'):
        """
        Initialize plate extractor
        
        Args:
            model_path: Path to YOLO detection model (optional)
            device: Device to use ('cpu', 'cuda', 'auto')
        """
        self.model_path = model_path
        
        # Auto-detect GPU
        import torch
        use_gpu = torch.cuda.is_available() if device == 'auto' else (device == 'cuda')
        
        # Initialize EasyOCR reader for English with GPU if available
        logger.info(f"Initializing EasyOCR reader (GPU: {use_gpu})...")
        self.reader = easyocr.Reader(['en'], gpu=use_gpu, verbose=False)
        logger.info("EasyOCR reader initialized")
    
    def extract_plate_from_frame(
        self,
        frame_path: str,
        crop_region: Tuple[float, float, float, float] = (0.0, 0.4, 1.0, 1.0)
    ) -> List[str]:
        """
        Extract license plate text from a single frame
        
        Args:
            frame_path: Path to frame image
            crop_region: (top, bottom) as fraction of image height to search
                        (0.4, 1.0) means bottom 60% of image
            
        Returns:
            List of extracted plate candidates
        """
        try:
            # Ensure absolute path
            frame_path = str(Path(frame_path).resolve())
            
            # Read image
            if not Path(frame_path).exists():
                logger.warning(f"Frame not found: {frame_path}")
                return []
            
            image = cv2.imread(frame_path)
            if image is None:
                logger.warning(f"Could not read image: {frame_path}")
                return []
            
            h, w = image.shape[:2]
            
            # OPTIMIZED: Only 2 crop strategies instead of 4 (faster)
            crop_strategies = [
                (0.5, h),      # Bottom 50% of image (where plates usually are)
                (0, h),        # Entire image (fallback)
            ]
            
            all_plates = []
            
            for top_idx, (top_frac, bottom) in enumerate(crop_strategies):
                if isinstance(top_frac, float):
                    top = int(h * top_frac)
                else:
                    top = top_frac
                
                if top >= bottom:
                    continue
                    
                roi = image[top:bottom, :]
                
                # Run OCR on this region
                results = self.reader.readtext(roi, detail=1)
                
                # Extract and clean text
                for (bbox, text, confidence) in results:
                    # Keep results with any reasonable confidence
                    if confidence > 0.15 and text.strip():
                        cleaned = TextCleaner.clean_plate_text(text)
                        if cleaned and len(cleaned.replace('-', '')) >= 4:
                            all_plates.append(cleaned)
                            logger.info(f"Candidate: {cleaned} (conf: {confidence:.2f})")
            
            # Remove duplicates while preserving order
            seen = set()
            unique_plates = []
            for p in all_plates:
                if p not in seen:
                    seen.add(p)
                    unique_plates.append(p)
            
            logger.info(f"Frame {Path(frame_path).name}: {len(unique_plates)} unique candidates")
            return unique_plates
        
        except Exception as e:
            logger.error(f"Error extracting plate from {frame_path}: {e}")
            return []
    
    def extract_from_violation_frames(
        self,
        frame_paths: List[str]
    ) -> Dict:
        """
        Extract plates from multiple violation frames and vote
        
        Args:
            frame_paths: List of paths to violation frame images
            
        Returns:
            Dictionary with extraction results
        """
        logger.info(f"Processing {len(frame_paths)} violation frames...")
        
        plate_votes = {}  # Dictionary to count plate occurrences
        all_extractions = []
        valid_count = 0
        
        # Process each frame
        for i, frame_path in enumerate(frame_paths):
            logger.info(f"Processing frame {i+1}/{len(frame_paths)}: {frame_path}")
            
            plates = self.extract_plate_from_frame(frame_path)
            
            # CRITICAL: Filter invalid results BEFORE voting
            valid_plates = []
            for plate in plates:
                # Skip None, empty, or too-short plates
                if not plate or not isinstance(plate, str):
                    continue
                plate = plate.strip().upper()
                if len(plate) < 4:
                    logger.debug(f"Skipping too-short plate: '{plate}'")
                    continue
                # Skip plates that are just numbers (likely not actual plates)
                if plate.isdigit() and len(plate) < 6:
                    logger.debug(f"Skipping pure-digit short plate: '{plate}'")
                    continue
                valid_plates.append(plate)
            
            all_extractions.extend(valid_plates)
            
            if valid_plates:
                valid_count += 1
                # Count occurrences of each plate
                for plate in valid_plates:
                    plate_votes[plate] = plate_votes.get(plate, 0) + 1
        
        logger.info(f"Total valid extractions: {len(all_extractions)}, Unique plates: {len(plate_votes)}")
        
        # Determine final result through voting - Prioritize Indian-format plates
        if plate_votes:
            # Separate Indian-format plates from others
            indian_plates = {}
            other_plates = {}
            
            for plate, votes in plate_votes.items():
                if IndianPlateValidator.is_indian_number_plate(plate):
                    indian_plates[plate] = votes
                else:
                    other_plates[plate] = votes
            
            # Sort both groups by votes (descending)
            sorted_indian = sorted(indian_plates.items(), key=lambda x: x[1], reverse=True)
            sorted_other = sorted(other_plates.items(), key=lambda x: x[1], reverse=True)
            
            # Prioritize: take from Indian plates first, then others
            top_candidates = sorted_indian + sorted_other
            top_plates = top_candidates[:2] if len(top_candidates) >= 2 else top_candidates
            
            # Primary plate (highest frequency, preferring Indian format)
            final_plate = top_plates[0][0]
            max_votes = top_plates[0][1]
            
            # Secondary plate (2nd highest frequency)
            secondary_plate = top_plates[1][0] if len(top_plates) > 1 else None
            secondary_votes = top_plates[1][1] if len(top_plates) > 1 else 0
            
            # Build response with both plates based on FREQUENCY, prioritizing Indian format
            response = {
                'success': True,
                'plate': final_plate,
                'frequency': max_votes,
                'plate_2': secondary_plate,
                'frequency_2': secondary_votes,
                'attempts': len(frame_paths),
                'valid_extractions': valid_count,
                'all_extractions': list(set(all_extractions)),
                'voting_mechanism': 'frequency_based',
                'votes': plate_votes,
                'top_plates': [
                    {'plate': final_plate, 'frequency': max_votes},
                    {'plate': secondary_plate, 'frequency': secondary_votes}
                ] if secondary_plate else [{'plate': final_plate, 'frequency': max_votes}]
            }
            
            # Add warnings if plates don't match Indian format
            if not IndianPlateValidator.is_indian_number_plate(final_plate):
                response['warning'] = f"Primary plate {final_plate} does not match standard Indian format"
            
            if secondary_plate and not IndianPlateValidator.is_indian_number_plate(secondary_plate):
                response['warning_2'] = f"Secondary plate {secondary_plate} does not match standard Indian format"
            
            logger.info(f"Top plates (Indian format prioritized): 1) {final_plate} ({max_votes} votes) 2) {secondary_plate} ({secondary_votes} votes)")
            return response
        else:
            logger.warning("No valid plates found in any frame")
            return {
                'success': False,
                'reason': 'No valid plates found',
                'attempts': len(frame_paths),
                'valid_extractions': valid_count,
                'all_extractions': [],
                'voting_mechanism': 'frequency_based'
            }


def extract_plates_from_violation_frames(
    frame_paths: List[str],
    **kwargs
) -> Dict:
    """
    Main function to extract plates from violation frames
    
    Args:
        frame_paths: List of frame file paths
        **kwargs: Additional arguments (device, etc.)
    
    Returns:
        Dictionary with extraction results
    """
    try:
        device = kwargs.get('device', 'auto')
        
        # Initialize extractor
        extractor = PlateExtractor(device=device)
        
        # Extract plates and vote
        result = extractor.extract_from_violation_frames(frame_paths)
        
        return result
    
    except Exception as e:
        logger.error(f"Error in extract_plates_from_violation_frames: {e}")
        return {
            'success': False,
            'error': str(e),
            'attempts': len(frame_paths),
            'valid_extractions': 0,
            'all_extractions': []
        }


def normalize_result_for_json(result):
    """
    Normalize OCR result to guaranteed JSON-serializable format.
    Locks final values and prevents null/empty fields.
    """
    # Define explicit defaults - these MUST exist in output
    normalized = {
        'success': False,
        'plate': 'N/A',
        'confidence': 0.0,
        'plate_2': None,
        'confidence_2': 0.0,
        'attempts': 0,
        'valid_extractions': 0,
        'all_extractions': [],
        'voting_mechanism': 'frequency_based',
        'votes': {}
    }
    
    if not result or not isinstance(result, dict):
        return normalized
    
    # Copy success status
    normalized['success'] = bool(result.get('success', False))
    
    # Lock primary plate - MUST be string, never null
    primary_plate = result.get('plate', '')
    if primary_plate and isinstance(primary_plate, str) and primary_plate.strip():
        normalized['plate'] = primary_plate.strip().upper()
    else:
        normalized['plate'] = 'N/A'
    
    # Lock frequency as confidence (normalize to 0-1 range if needed)
    freq = result.get('frequency', 0)
    attempts = result.get('attempts', 1) or 1  # Avoid division by zero
    if freq and isinstance(freq, (int, float)):
        # Convert frequency count to confidence ratio
        normalized['confidence'] = min(1.0, float(freq) / max(attempts, 1))
        normalized['frequency'] = int(freq)
    
    # Lock secondary plate
    secondary_plate = result.get('plate_2', '')
    if secondary_plate and isinstance(secondary_plate, str) and secondary_plate.strip():
        normalized['plate_2'] = secondary_plate.strip().upper()
        freq_2 = result.get('frequency_2', 0)
        normalized['confidence_2'] = min(1.0, float(freq_2) / max(attempts, 1)) if freq_2 else 0.0
        normalized['frequency_2'] = int(freq_2) if freq_2 else 0
    
    # Copy other fields safely
    normalized['attempts'] = int(result.get('attempts', 0))
    normalized['valid_extractions'] = int(result.get('valid_extractions', 0))
    normalized['all_extractions'] = list(result.get('all_extractions', []))
    normalized['votes'] = dict(result.get('votes', {}))
    
    # Final validation - if we have valid extractions but plate is N/A, something is wrong
    if normalized['valid_extractions'] > 0 and normalized['plate'] == 'N/A':
        # Try to recover from all_extractions
        if normalized['all_extractions']:
            normalized['plate'] = normalized['all_extractions'][0]
            normalized['success'] = True
    
    return normalized


if __name__ == '__main__':
    import sys
    
    # Create default fallback result - GUARANTEED structure
    fallback_result = {
        'success': False,
        'plate': 'N/A',
        'confidence': 0.0,
        'plate_2': None,
        'confidence_2': 0.0,
        'attempts': 0,
        'valid_extractions': 0,
        'all_extractions': [],
        'voting_mechanism': 'frequency_based',
        'votes': {}
    }
    
    try:
        if len(sys.argv) > 1:
            frames = sys.argv[1:]
            # Filter to only valid files that exist
            valid_frames = [f for f in frames if os.path.isfile(f)]
            
            if not valid_frames:
                fallback_result['reason'] = 'No valid frame files found'
                fallback_result['attempts'] = len(frames)
                result = fallback_result
            else:
                raw_result = extract_plates_from_violation_frames(valid_frames)
                # Normalize to guaranteed structure
                result = normalize_result_for_json(raw_result)
        else:
            fallback_result['reason'] = 'No frames provided'
            result = fallback_result
        
        # CRITICAL: Output single-line JSON for reliable parsing
        # Do NOT use indent - multi-line JSON causes parsing issues
        json_output = json.dumps(result, separators=(',', ':'))
        
        # Write to stdout with explicit flush
        sys.stdout.write(json_output)
        sys.stdout.write('\n')
        sys.stdout.flush()
        
        # Log success for debugging
        logger.info(f"JSON output written: plate={result.get('plate')}, success={result.get('success')}")
        
    except Exception as e:
        logger.error(f"Fatal error in main: {e}")
        fallback_result['error'] = str(e)
        fallback_result['reason'] = 'Exception during processing'
        
        # CRITICAL: Always output valid JSON even on error
        json_output = json.dumps(fallback_result, separators=(',', ':'))
        sys.stdout.write(json_output)
        sys.stdout.write('\n')
        sys.stdout.flush()
    
    # Explicit exit with code 0
    sys.exit(0)
