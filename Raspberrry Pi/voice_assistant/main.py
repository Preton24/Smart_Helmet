import sounddevice as sd
import queue
import json
import os
import time
import subprocess
import platform
import re
import urllib.request
import zipfile
import threading
import sys
import termios
import tty
from vosk import Model, KaldiRecognizer
from google import genai
from dotenv import load_dotenv

# -----------------------------
# CONFIG
# -----------------------------
# Automatically resolve directory of the script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "vosk-model-en-in-0.5")
MODEL_ZIP_PATH = os.path.join(BASE_DIR, "vosk-model-en-in-0.5.zip")
MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-en-in-0.5.zip"
SAMPLE_RATE = 16000

# Load Environment Variables from .env file
load_dotenv(os.path.join(BASE_DIR, ".env"))

# Load up to 3 Gemini API keys for rotation on quota errors
GEMINI_API_KEYS = [
    key for key in [
        os.getenv("GEMINI_API_KEY1"),
        os.getenv("GEMINI_API_KEY2"),
        os.getenv("GEMINI_API_KEY3"),
        os.getenv("GEMINI_API_KEY4"),
        os.getenv("GEMINI_API_KEY5"),
    ] if key
]
if not GEMINI_API_KEYS:
    print("Warning: No Gemini API keys found in .env file.")

current_key_index = 0

def get_gemini_client():
    """Return a Gemini client for the currently active key."""
    if not GEMINI_API_KEYS:
        return None
    return genai.Client(api_key=GEMINI_API_KEYS[current_key_index])

# -----------------------------
# ENSURE MODEL EXISTS
# -----------------------------
if not os.path.exists(MODEL_DIR):
    print(f"Vosk model not found at {MODEL_DIR}.")
    print(f"Downloading from {MODEL_URL} (this might take a few minutes)...")
    try:
        urllib.request.urlretrieve(MODEL_URL, MODEL_ZIP_PATH)
        print("Download complete. Extracting...")
        with zipfile.ZipFile(MODEL_ZIP_PATH, 'r') as zip_ref:
            zip_ref.extractall(BASE_DIR)
        os.remove(MODEL_ZIP_PATH)
        print("Model extracted successfully.")
    except Exception as e:
        print(f"Failed to download or extract model: {e}")
        exit(1)

# -----------------------------
# LOAD MODEL
# -----------------------------
print("Loading speech model...")
try:
    model = Model(MODEL_DIR)
    rec = KaldiRecognizer(model, SAMPLE_RATE)
except Exception as e:
    print(f"Failed to load Vosk model: {e}")
    exit(1)

q = queue.Queue()

# Media player state
PROCESS = None
LAST_TIME_MS = 0
START_WALL_TIME = None
MEDIA_PATH = os.path.join(BASE_DIR, "Closer.mp3")

# Detect platform for playing media and TTS
SYS_PLATFORM = platform.system()
# On macOS, VLC is usually not in PATH, use the direct binary
VLC_CMD = "/Applications/VLC.app/Contents/MacOS/VLC" if SYS_PLATFORM == "Darwin" else "cvlc"

IS_SPEAKING = False
SKIP_EVENT = threading.Event()

# -----------------------------
# MENU OPTIONS
# Press 1 or 2 in the terminal to trigger these responses
# -----------------------------
MENU_OPTIONS = [
    {"key": "1", "message": "The distance between Bangalore and Mysore is roughly 140 to 145 km"},
    {"key": "2", "message": "The current weather is mostly cloudy with a temperature of 27°C. The humidity is at 67%, with a 15 percent chance of rain and a west wind blowing at 19 mph."},
]
SPEECH_PROCESS = None

def keyboard_listener():
    """Listens for 's' key press to skip current process."""
    global SPEECH_PROCESS
    fd = sys.stdin.fileno()
    while True:
        # Save terminal settings
        old_settings = termios.tcgetattr(fd)
        try:
            tty.setcbreak(fd)
            ch = sys.stdin.read(1)
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
        
        if ch.lower() == 's':
            print("\r⏭️  Skipping...")
            SKIP_EVENT.set()
            if SPEECH_PROCESS is not None:
                try:
                    SPEECH_PROCESS.terminate()
                except:
                    pass
        elif ch in [opt["key"] for opt in MENU_OPTIONS]:
            # Find the matching menu option and speak its message
            for opt in MENU_OPTIONS:
                if ch == opt["key"]:
                    print(f"\r🔢 Key '{ch}' pressed.")
                    SKIP_EVENT.clear()
                    speak(opt["message"])
                    print("-" * 50 + "\r\n")
                    break
        elif ch.lower() == 'q': # Optional: allow quitting with 'q'
            print("\rQuitting...")
            os._exit(0)

# Start keyboard listener in background
threading.Thread(target=keyboard_listener, daemon=True).start()

def audio_callback(indata, frames, time_info, status):
    if status:
        print(status, flush=True)
    if not IS_SPEAKING:
        q.put(bytes(indata))

# -----------------------------
# SPEAK FUNCTION
# -----------------------------
def speak(text):
    global IS_SPEAKING, SPEECH_PROCESS
    # Don't speak if skip was requested
    if SKIP_EVENT.is_set():
        return

    IS_SPEAKING = True
    print(f"\r🤖 Assistant: {text}")
    
    # Sanitize text
    clean_text = re.sub(r'[^a-zA-Z0-9 \.,\?!:\-]', '', text)
    
    try:
        if SYS_PLATFORM == "Darwin":
            cmd = ["say", clean_text]
        else:
            cmd = ["espeak", clean_text]
            
        SPEECH_PROCESS = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        SPEECH_PROCESS.wait()
    except Exception as e:
        print(f"Speech error: {e}")
    finally:
        SPEECH_PROCESS = None
        # Prevent audio feedback loop
        with q.mutex:
            q.queue.clear()
        rec.Reset()
        IS_SPEAKING = False

# -----------------------------
# GEMINI FUNCTION
# -----------------------------
def ask_gemini(text):
    global current_key_index
    if not GEMINI_API_KEYS:
        return "My brain is disconnected because the Gemini API key is missing."

    prompt = (f"You are MAX, a smart helmet assistant. The user said: '{text}'. "
              f"Provide a short, conversational response (no more than 2 sentences).")

    # Try each key in rotation; cycle on 429, 503, or 403 errors
    for attempt in range(len(GEMINI_API_KEYS)):
        if SKIP_EVENT.is_set():
            return None

        try:
            client = get_gemini_client()
            response = client.models.generate_content(
                model='gemini-3.6-flash',
                contents=prompt,
            )
            # Clean up any markdown
            clean_response = response.text.replace("*", "").replace("\n", " ").strip()
            return clean_response
        except Exception as e:
            if SKIP_EVENT.is_set():
                return None
                
            error_str = str(e)
            current_key = GEMINI_API_KEYS[current_key_index]
            key_suffix = f"...{current_key[-4:]}" if len(current_key) > 4 else "..."
            
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                reason = "quota exhausted (429)"
                next_index = (current_key_index + 1) % len(GEMINI_API_KEYS)
                print(f"\rGemini key {current_key_index + 1} ({key_suffix}) rejected: {reason}. Switching to key {next_index + 1}...")
                current_key_index = next_index
            elif "503" in error_str or "UNAVAILABLE" in error_str:
                reason = "unavailable (503)"
                next_index = (current_key_index + 1) % len(GEMINI_API_KEYS)
                print(f"\rGemini key {current_key_index + 1} ({key_suffix}) rejected: {reason}. Switching to key {next_index + 1}...")
                current_key_index = next_index
            elif "403" in error_str or "PERMISSION_DENIED" in error_str:
                reason = "permission denied (403)"
                next_index = (current_key_index + 1) % len(GEMINI_API_KEYS)
                print(f"\rGemini key {current_key_index + 1} ({key_suffix}) rejected: {reason}. Switching to key {next_index + 1}...")
                current_key_index = next_index
            else:
                print(f"\rGemini Error for key {current_key_index + 1} ({key_suffix}): {e}")
                break

    return "I am having trouble connecting to my brain right now."

# -----------------------------
# INTENT LOGIC
# -----------------------------
def handle_intent(text):
    text_lower = text.lower()
    global PROCESS, LAST_TIME_MS, START_WALL_TIME

    # If external player exited on its own, clear state
    if PROCESS is not None and PROCESS.poll() is not None:
        PROCESS = None
        LAST_TIME_MS = 0
        START_WALL_TIME = None

    # Play/resume
    if any(cmd in text_lower for cmd in ["play", "resume", "start"]):
        try:
            if PROCESS is None:
                start_seconds = LAST_TIME_MS / 1000
                cmd = [
                    VLC_CMD, "--intf", "dummy", "--play-and-exit",
                    "--start-time", str(start_seconds), MEDIA_PATH
                ]
                PROCESS = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                START_WALL_TIME = time.time()
                speak("Playing")
            else:
                speak("Already playing")
        except FileNotFoundError:
            speak(f"{VLC_CMD} not found. Please install VLC.")
        except Exception as e:
            speak(f"Unable to play media: {e}")
        return

    # Pause/stop
    if any(cmd in text_lower for cmd in ["pause", "stop"]):
        try:
            if PROCESS is not None:
                elapsed = 0
                if START_WALL_TIME is not None:
                    elapsed = time.time() - START_WALL_TIME
                LAST_TIME_MS = int(LAST_TIME_MS + elapsed * 1000)
                PROCESS.terminate()
                PROCESS = None
                START_WALL_TIME = None
                speak("Paused")
            else:
                speak("Nothing is playing right now")
        except Exception as e:
            speak(f"Unable to pause media: {e}")
        return

    # Hardcoded intents
    if "hello" in text_lower:
        speak("Hello. I am ready.")
    elif "hey max" in text_lower:
        speak("Hey. How can I help you today?")
    elif text.strip() == "":
        pass
    else:
        # Fallback to Gemini API
        if SKIP_EVENT.is_set(): return
        
        print("\r🔍 Asking Gemini...")
        gemini_response = ask_gemini(text)
        
        # Check if user skipped while Gemini was thinking
        if not SKIP_EVENT.is_set() and gemini_response:
             speak(gemini_response)

# -----------------------------
# MAIN LOOP
# -----------------------------
if __name__ == "__main__":
    print("🎙️ Starting Voice Assistant...")
    try:
        with sd.RawInputStream(
            samplerate=SAMPLE_RATE,
            blocksize=8000,
            dtype='int16',
            channels=1,
            callback=audio_callback
        ):
            print("🎙️ Listening... Speak now.")
            while True:
                data = q.get()
                if rec.AcceptWaveform(data):
                    result = json.loads(rec.Result())
                    spoken_text = result.get("text", "")
                    if spoken_text:
                        print(f"🗣️  You said: {spoken_text}")
                        SKIP_EVENT.clear() # Reset skip flag for new interaction
                        handle_intent(spoken_text)
                        print("-" * 50 + "\r\n")
    except KeyboardInterrupt:
        print("\r\nExiting...")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"\rCritical Error: {e}")
