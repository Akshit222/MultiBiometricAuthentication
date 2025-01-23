from flask import Flask, request, jsonify
import numpy as np
from feature_extractor import extract_features  # Import your feature extractor
from sklearn.metrics.pairwise import cosine_similarity
import wave  # Add this import for handling WAV files
from werkzeug.utils import secure_filename
from flask_cors import CORS
import pyaudio  # For recording audio
import subprocess 
from pathlib import Path
import cv2  # For face detection
import os
from flask import Flask, jsonify

app = Flask(__name__)
CORS(app, supports_credentials=True, resources={r"/*": {"origins": "*"}})

# Set up upload folder
app.config['UPLOAD_FOLDER'] = '.'  # Use current directory
app.config['VOICE_FILES_FOLDER'] = 'voice_files'  # Folder for audio files

# Create voice_files directory if it doesn't exist
if not os.path.exists(app.config['VOICE_FILES_FOLDER']):
    os.makedirs(app.config['VOICE_FILES_FOLDER'])

# Increase maximum content length (e.g., to 16 MB)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB

# Auto-record voice function
def auto_record_voice(duration=5):
    # Set up audio recording parameters
    chunk = 1024
    sample_format = pyaudio.paInt16
    channels = 1
    fs = 44100

    # Initialize PyAudio
    p = pyaudio.PyAudio()
    print("Starting voice recording...")

    # Start recording
    stream = p.open(format=sample_format, channels=channels, rate=fs, input=True, frames_per_buffer=chunk)
    frames = []

    # Record audio for the specified duration
    for _ in range(int(fs / chunk * duration)):
        data = stream.read(chunk)
        frames.append(data)

    # Stop and cleanup
    stream.stop_stream()
    stream.close()
    p.terminate()

    # Save recorded audio in WAV format in the voice_files folder
    file_path = os.path.join(app.config['VOICE_FILES_FOLDER'], "recorded_audio.wav")
    with wave.open(file_path, 'wb') as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(p.get_sample_size(sample_format))
        wf.setframerate(fs)
        wf.writeframes(b''.join(frames))

    print(f"Voice recorded and saved as {file_path}")
    return file_path
# Route to start recording voice (5 seconds)
app.config['VOICE_FILES_FOLDER'] = './voice_files'  # Update this path as needed

@app.route('/start_audio_auth', methods=['POST'])
def start_audio_auth():
    # Start recording for a fixed duration (5 seconds)
    file_path = auto_record_voice(duration=5)  # Recording for 5 seconds

    # Get list of all .wav files in the voice_files folder
    voice_files_folder = app.config['VOICE_FILES_FOLDER']
    wav_files = [f for f in os.listdir(voice_files_folder) if f.endswith('.wav')]

    # Ensure there are exactly two .wav files for comparison
    if len(wav_files) != 2:
        print("There must be exactly two .wav files in the voice_files folder.")
        return jsonify({"message": "There must be exactly two .wav files in the folder for comparison", "success": False}), 400

    # Extract the file paths for the two .wav files
    file1_path = os.path.join(voice_files_folder, wav_files[0])
    file2_path = os.path.join(voice_files_folder, wav_files[1])

    # Extract features for the two files using the feature extractor
    print("Extracting features for file1:", file1_path)
    features1 = extract_features(file1_path)
    if features1 is None:
        return jsonify({"message": f"Error extracting features from {wav_files[0]}", "success": False}), 500

    print("Extracting features for file2:", file2_path)
    features2 = extract_features(file2_path)
    if features2 is None:
        return jsonify({"message": f"Error extracting features from {wav_files[1]}", "success": False}), 500

    # Calculate cosine similarity between the two feature vectors
    similarity = cosine_similarity([features1], [features2])[0][0]
    print(f"Cosine similarity between {wav_files[0]} and {wav_files[1]}: {similarity}")

    # Return the result with cosine similarity as a float
    return jsonify({
        "message": "Cosine similarity calculated successfully",
        "file1": wav_files[0],
        "file2": wav_files[1],
        "cosine_similarity": float(similarity),  # Convert to Python float
        "success": True
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
