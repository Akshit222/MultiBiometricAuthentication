import librosa
import numpy as np
import soundfile as sf

def extract_features(file_name):
    try:
        # Try loading with librosa first
        y, sr = librosa.load(file_name)
    except Exception as e:
        print(f"Error loading with librosa: {e}")
        try:
            # Fallback to soundfile
            y, sr = sf.read(file_name)
            y = y.T  # soundfile loads as (n_channels, n_samples), so transpose
        except Exception as e:
            print(f"Error loading with soundfile: {e}")
            raise ValueError(f"Unable to load audio file: {file_name}")

    y = librosa.util.normalize(y)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=40)
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    mel = librosa.feature.melspectrogram(y=y, sr=sr)

    mfcc_mean = np.mean(mfcc.T, axis=0)
    mfcc_std = np.std(mfcc.T, axis=0)
    chroma_mean = np.mean(chroma.T, axis=0)
    chroma_std = np.std(chroma.T, axis=0)
    mel_mean = np.mean(mel.T, axis=0)
    mel_std = np.std(mel.T, axis=0)

    return np.hstack((mfcc_mean, mfcc_std, chroma_mean, chroma_std, mel_mean, mel_std))

if __name__ == "__main__":
    file_name = 'user_voice.wav'
    try:
        features = extract_features(file_name)
        print(f"Extracted Features: {features}")
    except Exception as e:
        print(f"Error extracting features: {e}")