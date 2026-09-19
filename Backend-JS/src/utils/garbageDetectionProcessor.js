/**
 * Garbage Detection Frame Processor
 * Stateless single-frame garbage detection
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

// Python executable - use venv Python for TensorFlow compatibility
// venv is in Backend-JS/venv
const getPythonCmd = () => {
  const venvPath = path.join(__dirname, '../../venv');
  const winPython = path.join(venvPath, 'Scripts/python.exe');
  const unixPython = path.join(venvPath, 'bin/python');

  if (fsSync.existsSync(winPython)) return winPython;
  if (fsSync.existsSync(unixPython)) return unixPython;

  return process.platform === 'win32' ? 'py' : 'python';
};

/**
 * Run garbage detection on a single frame file
 * Returns detection result without storing frame
 */
async function detectGarbageInFrame(framePath, modelPath) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'detect_garbage_frame.py');

    // Verify model exists
    if (!fsSync.existsSync(modelPath)) {
      return reject(new Error(`Model not found: ${modelPath}`));
    }

    // Spawn Python process
    const pythonProcess = spawn(getPythonCmd(), [
      scriptPath,
      framePath,
      modelPath
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000 // 30 second timeout per frame
    });

    let outputBuffer = '';
    let errorBuffer = '';

    pythonProcess.stdout.on('data', (data) => {
      outputBuffer += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorBuffer += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(outputBuffer.trim());
          resolve(result);
        } catch (parseError) {
          reject(new Error(`Failed to parse garbage detection result: ${parseError.message}`));
        }
      } else {
        reject(new Error(`Garbage detection failed: ${errorBuffer}`));
      }
    });

    pythonProcess.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Save annotated garbage frame with confidence
 */
async function saveAnnotatedGarbageFrame(framePath, outputPath, confidence, isGarbage) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'annotate_garbage_frame.py');

    // Spawn Python process for annotation
    const pythonProcess = spawn(getPythonCmd(), [
      scriptPath,
      framePath,
      outputPath,
      confidence.toString(),
      isGarbage.toString()
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000 // 15 second timeout
    });

    let outputBuffer = '';
    let errorBuffer = '';

    pythonProcess.stdout.on('data', (data) => {
      outputBuffer += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorBuffer += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(outputBuffer.trim());
          resolve(result);
        } catch (parseError) {
          reject(new Error(`Failed to parse annotation result: ${parseError.message}`));
        }
      } else {
        reject(new Error(`Annotation failed: ${errorBuffer}`));
      }
    });

    pythonProcess.on('error', (error) => {
      reject(error);
    });
  });
}

module.exports = {
  detectGarbageInFrame,
  saveAnnotatedGarbageFrame
};
