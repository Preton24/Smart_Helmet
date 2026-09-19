/**
 * License Plate OCR Handler using Voting Mechanism
 * Extracts license plate text by running OCR on multiple frames
 * and voting for the most frequently occurring character at each position
 */

const Tesseract = require('tesseract.js');
const fsSync = require('fs');
const fs = require('fs').promises;
const sharp = require('sharp');
const path = require('path');

class LicensePlateOCRHandler {
  constructor() {
    console.log('[OCR] Voting-based license plate extractor initialized');
  }

  /**
   * Validate extracted license plate characters
   */
  isValidPlateFormat(text) {
    if (!text) return false;
    const cleaned = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    // Typical license plate format: 4-10 alphanumeric characters
    if (cleaned.length < 4 || cleaned.length > 10) return false;
    const hasLetter = /[A-Z]/.test(cleaned);
    const hasNumber = /[0-9]/.test(cleaned);
    return hasLetter && hasNumber;
  }

  /**
   * Crop license plate region from image (bottom portion)
   */
  async cropLicensePlateRegion(imagePath) {
    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      // Crop bottom 40% of image for license plate region
      const cropHeight = Math.floor(metadata.height * 0.4);
      const cropTop = metadata.height - cropHeight;
      
      const croppedImage = await image
        .extract({ 
          left: 0, 
          top: cropTop, 
          width: metadata.width, 
          height: cropHeight 
        })
        .toBuffer();
      
      return croppedImage;
    } catch (error) {
      console.error(`[OCR] Cropping failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Preprocess image for better OCR accuracy
   */
  async preprocessImage(imageBuffer) {
    try {
      // Apply preprocessing: grayscale, contrast enhancement, sharpen
      const processed = await sharp(imageBuffer)
        .greyscale()
        .normalize()
        .sharpen()
        .toBuffer();
      
      return processed;
    } catch (error) {
      console.error(`[OCR] Preprocessing failed: ${error.message}`);
      return imageBuffer;
    }
  }

  /**
   * Run OCR on a single image and extract text
   */
  async runOCROnImage(imagePath) {
    try {
      if (!fsSync.existsSync(imagePath)) {
        console.warn(`[OCR] Image not found: ${imagePath}`);
        return null;
      }

      const { data: { text } } = await Tesseract.recognize(imagePath, 'eng');
      // Clean up text: remove special chars, convert to uppercase
      const cleaned = text
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .trim();
      
      return cleaned.length > 0 ? cleaned : null;
    } catch (error) {
      console.warn(`[OCR] OCR failed on image: ${error.message}`);
      return null;
    }
  }

  /**
   * Voting mechanism: Extract text from multiple frames and vote for characters
   * Returns the license plate with highest confidence based on character frequency
   */
  async extractPlateWithVoting(violationFramePaths, violationFramesDir) {
    try {
      if (!violationFramePaths || violationFramePaths.length === 0) {
        console.warn('[OCR] No violation frames provided');
        return { success: false, plate: null, confidence: 0 };
      }

      console.log(`[OCR] Starting voting-based extraction from ${violationFramePaths.length} frames`);

      const extractedTexts = [];
      const basePath = violationFramesDir; // Use provided directory path

      // Run OCR on each frame
      for (let i = 0; i < violationFramePaths.length; i++) {
        const frameName = violationFramePaths[i];
        const framePath = path.join(basePath, frameName);
        
        console.log(`[OCR] Processing frame ${i + 1}/${violationFramePaths.length}: ${frameName}`);

        // Crop license plate region
        const croppedBuffer = await this.cropLicensePlateRegion(framePath);
        if (!croppedBuffer) {
          console.warn(`[OCR] Failed to crop frame: ${frameName}`);
          continue;
        }

        // Preprocess image
        const processedBuffer = await this.preprocessImage(croppedBuffer);

        // Save processed image temporarily for OCR
        const tempPath = path.join(basePath, `temp_processed_${i}.jpg`);
        await fs.writeFile(tempPath, processedBuffer);

        // Run OCR
        const text = await this.runOCROnImage(tempPath);
        
        if (text && this.isValidPlateFormat(text)) {
          extractedTexts.push(text);
          console.log(`[OCR] Frame ${i + 1} extracted: ${text}`);
        } else {
          console.log(`[OCR] Frame ${i + 1} invalid or empty: ${text}`);
        }

        // Cleanup temp file
        try {
          await fs.unlink(tempPath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      if (extractedTexts.length === 0) {
        console.warn('[OCR] No valid plates extracted from any frame');
        return { success: false, plate: null, confidence: 0, attempts: violationFramePaths.length };
      }

      // Voting mechanism: Find the most common plate or characters by position
      const votedPlate = this.votePlates(extractedTexts);
      
      console.log(`[OCR] Voting complete. Final plate: ${votedPlate.plate}, Confidence: ${votedPlate.confidence.toFixed(2)}`);

      return {
        success: true,
        plate: votedPlate.plate,
        confidence: votedPlate.confidence,
        attempts: violationFramePaths.length,
        validExtractions: extractedTexts.length,
        allExtractions: extractedTexts
      };
    } catch (error) {
      console.error(`[OCR] Voting extraction failed: ${error.message}`);
      return { success: false, plate: null, confidence: 0, error: error.message };
    }
  }

  /**
   * Vote for the most likely license plate by character position
   * If all frames have same plate, return it with high confidence
   * Otherwise, vote character by character
   */
  votePlates(extractedTexts) {
    if (extractedTexts.length === 0) {
      return { plate: null, confidence: 0 };
    }

    // Check if all texts are identical
    const uniquePlates = new Set(extractedTexts);
    if (uniquePlates.size === 1) {
      const plate = extractedTexts[0];
      return { plate, confidence: 1.0 };
    }

    // Character-level voting
    const maxLength = Math.max(...extractedTexts.map(t => t.length));
    let votedPlate = '';
    let totalVotes = 0;
    let successfulVotes = 0;

    for (let pos = 0; pos < maxLength; pos++) {
      const charVotes = {};
      let maxVoteCount = 0;
      let mostVotedChar = '?';

      // Count votes for each character at this position
      for (const text of extractedTexts) {
        if (pos < text.length) {
          const char = text[pos];
          charVotes[char] = (charVotes[char] || 0) + 1;
          
          if (charVotes[char] > maxVoteCount) {
            maxVoteCount = charVotes[char];
            mostVotedChar = char;
          }
        }
      }

      // Only add character if it has majority vote (more than 50%)
      if (maxVoteCount > extractedTexts.length / 2) {
        votedPlate += mostVotedChar;
        successfulVotes += maxVoteCount;
      }

      totalVotes += extractedTexts.length;
    }

    // Calculate confidence: ratio of successful votes to total votes
    const confidence = totalVotes > 0 ? successfulVotes / totalVotes : 0;

    return { plate: votedPlate, confidence };
  }
}

/**
 * Run OCR on violation images and extract license plate using voting
 */
async function runOCROnViolationFrames(violationFramePaths, violationFramesDir) {
  try {
    if (!violationFramePaths || violationFramePaths.length === 0) {
      console.warn('[OCR] No violation frames to process');
      return { success: false, plate: null, confidence: 0 };
    }

    const ocrHandler = new LicensePlateOCRHandler();
    const result = await ocrHandler.extractPlateWithVoting(violationFramePaths, violationFramesDir);

    return result;
  } catch (error) {
    console.error(`[OCR] Violation frame processing failed: ${error.message}`);
    return {
      success: false,
      plate: null,
      confidence: 0,
      error: error.message
    };
  }
}

module.exports = LicensePlateOCRHandler;
module.exports.runOCROnViolationFrames = runOCROnViolationFrames;
