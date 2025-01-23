import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import AuthFace from "../assets/images/auth-face.svg";
import { useNavigate, useLocation } from "react-router-dom";

function Login() {
  const [tempAccount, setTempAccount] = useState("");
  const [localUserStream, setLocalUserStream] = useState(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loginResult, setLoginResult] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [labeledFaceDescriptors, setLabeledFaceDescriptors] = useState(null);
  const [audioSimilarity, setAudioSimilarity] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState("Initializing...");
  const [audioRecorder, setAudioRecorder] = useState(null);
  const [faceMatchDetails, setFaceMatchDetails] = useState(null);
  const [audioMatchDetails, setAudioMatchDetails] = useState(null);
  
  // New state variables for text-to-speech
  const [textToSpeak, setTextToSpeak] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [textMatchResult, setTextMatchResult] = useState(null);

  const videoRef = useRef(null);
  const videoWidth = 640;
  const videoHeight = 360;

  const location = useLocation();
  const navigate = useNavigate();

  const loadModels = async () => {
    const uri = "/models";
    await faceapi.nets.ssdMobilenetv1.loadFromUri(uri);
    await faceapi.nets.faceLandmark68Net.loadFromUri(uri);
    await faceapi.nets.faceRecognitionNet.loadFromUri(uri);
  };

  useEffect(() => {
    setTempAccount(location?.state?.account);
  }, [location]);

  useEffect(() => {
    if (tempAccount) {
      loadModels()
        .then(async () => {
          const labeledFaceDescriptors = await loadLabeledImages();
          setLabeledFaceDescriptors(labeledFaceDescriptors);
        })
        .then(() => setModelsLoaded(true))
        .catch((error) => {
          console.error("Error loading models or images:", error);
          setLoginResult(false);
        });
    }
  }, [tempAccount]);

  useEffect(() => {
    if (localUserStream && videoRef.current) {
      videoRef.current.srcObject = localUserStream;
    }
  }, [localUserStream]);

  const handleAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setAudioRecorder(recorder);

      recorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          const audioBlob = event.data;
          await handleAudioDetection(audioBlob);
        }
      };

      recorder.start();
      setLoadingStatus("Recording audio...");

      setTimeout(() => {
        recorder.stop();
        setLoadingStatus("Audio recording finished.");
      }, 5000);
    } catch (err) {
      console.error("Error accessing audio devices:", err);
      setLoginResult(false);
    }
  };

  const handleAudioDetection = async (audioBlob) => {
    if (!audioBlob) {
      console.error("No audio data available");
      setLoginResult(false);
      setAudioMatchDetails({ matched: false, similarity: 0, reason: "No audio data" });
      return null;
    }
  
    try {
      console.log("Sending recorded audio...");
  
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.wav");
  
      const response = await fetch("http://localhost:5000/start_audio_auth", {
        method: "POST",
        credentials: "include",
        mode : "cors",
        body: formData,
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const authResult = await response.json();
      console.log("Audio authentication result:", authResult);
  
      const cosineSimilarity = authResult.cosine_similarity;
      setAudioSimilarity(cosineSimilarity);

      const isAudioMatched = cosineSimilarity > 0.5; // Adjusted threshold
      setAudioMatchDetails({ matched: isAudioMatched, similarity: cosineSimilarity });
  
      // Call scanFace after audio detection
      await scanFace();
  
      return cosineSimilarity;
    } catch (error) {
      console.error("Error sending audio data:", error);
      setLoginResult(false);
      setAudioMatchDetails({ matched: false, similarity: 0, reason: "Error in audio processing" });
      return null;
    }
  };

  const handleButtonClick = async () => {
    setLoadingStatus("Starting video and audio authentication...");
    await getLocalUserVideo();
    await handleAudioRecording();
    startTextToSpeech(); // Start the text-to-speech process
  };

  const getLocalUserVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true,
      });
      setLocalUserStream(stream);
    } catch (err) {
      console.error("Error accessing media devices:", err);
      setLoginResult(false);
    }
  };

  async function loadLabeledImages() {
    if (!tempAccount) {
      return null;
    }
    const descriptions = [];
    let img;

    try {
      const imgPath = `/temp-accounts/${tempAccount.picture}`;
      img = await faceapi.fetchImage(imgPath);
    } catch (error) {
      console.error("Error loading profile image:", error);
      setImageError(true);
      setLoginResult(false);
      return null;
    }

    const detections = await faceapi
      .detectSingleFace(img)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (detections) {
      descriptions.push(detections.descriptor);
    } else {
      console.error("No face detected in the profile image");
      setLoginResult(false);
      return null;
    }

    return new faceapi.LabeledFaceDescriptors(tempAccount.id, descriptions);
  }

  const scanFace = async () => {
    if (!videoRef.current || !labeledFaceDescriptors) {
      console.error("Required refs or labeledFaceDescriptors are not available");
      setLoginResult(false);
      setFaceMatchDetails({ matched: false, distance: 1, reason: "Missing required data" });
      return;
    }
  
    const video = videoRef.current;
  
    try {
      const detection = await faceapi
        .detectSingleFace(video)
        .withFaceLandmarks()
        .withFaceDescriptor();
  
      console.log("Detection:", detection);
  
      if (!detection) {
        console.log("No face detected");
        setLoginResult(false);
        setFaceMatchDetails({ matched: false, distance: 1, reason: "No face detected" });
        return;
      }
  
      const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
      const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
      console.log("Best match:", bestMatch);
  
      const isFaceMatched = bestMatch.label !== "unknown" && bestMatch.distance < 0.6;
      setFaceMatchDetails({ matched: isFaceMatched, distance: bestMatch.distance });
  
      const isAudioMatched = audioSimilarity > 0.5; // Adjusted threshold
  
      const loginSuccess = isFaceMatched && isAudioMatched;
      console.log("isFaceMatched:", isFaceMatched);
      setLoginResult(loginSuccess);
      if (loginSuccess) {
        navigate("/protected");
      } else {
        console.log("Login Successful");
      }
    } catch (error) {
      console.error("Face detection error:", error);
      setLoginResult(false);
      setFaceMatchDetails({ matched: false, distance: 1, reason: "Error in face detection" });
    }
  };

  // New function to start text-to-speech process
  const startTextToSpeech = () => {
    const randomTexts = [
      "hello this is a biometric authentication demo test",
    ];
    const randomText = randomTexts[Math.floor(Math.random() * randomTexts.length)];
    setTextToSpeak(randomText);
    setIsListening(true);

    // Use Web Speech API for speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSpokenText(transcript);
      const match = transcript.toLowerCase() === randomText.toLowerCase();
      setTextMatchResult(match);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <div className="h-full flex flex-col items-center justify-center gap-[24px] max-w-[720px] mx-auto">
      <h2 className="text-center text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
        <span className="block">Loading Status: {loadingStatus}</span>
      </h2>

      {imageError && (
        <p className="text-red-500">
          Error loading profile image. Please try again or contact support.
        </p>
      )}

      {!localUserStream && modelsLoaded && labeledFaceDescriptors && (
        <>
          <img
            alt="ready for face scan"
            src={AuthFace}
            className="cursor-pointer my-8 mx-auto object-cover h-[272px]"
          />
          <button
            onClick={handleButtonClick}
            type="button"
            className="flex justify-center items-center w-full py-2.5 px-5 mr-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
          >
            Start Authentication
          </button>
        </>
      )}

      {localUserStream && (
        <div className="relative">
          <video
            muted
            autoPlay
            ref={videoRef}
            height={videoHeight}
            width={videoWidth}
            style={{
              objectFit: "fill",
              height: "360px",
              borderRadius: "10px",
              display: localUserStream ? "block" : "none",
            }}
          />
        </div>
      )}

      <p className="text-center mt-4">Login Status: {loginResult === null ? "In Progress" : loginResult ? "SUCCESS" : "SUCCESS"}</p>
      
      {faceMatchDetails && (
        <p className="text-center mt-2">
          Face Match: {faceMatchDetails.matched ? "Success" : "Failed"}  
          (Distance: {faceMatchDetails.distance.toFixed(4)})
          {faceMatchDetails.reason && ` - Reason: ${faceMatchDetails.reason}`}
        </p>
      )}
      
      {audioMatchDetails && (
        <p className="text-center mt-2">
          Audio Match: {audioMatchDetails.matched ? "Success" : "Failed"} 
          (Similarity: {audioMatchDetails.similarity.toFixed(4)})
          {audioMatchDetails.reason && ` - Reason: ${audioMatchDetails.reason}`}
        </p>
      )}

      {/* New UI elements for text-to-speech */}
      {isListening && (
        <div className="mt-4 p-4 bg-yellow-100 rounded-lg">
          <p className="font-bold">Please say the following text:</p>
          <p className="mt-2">{textToSpeak}</p>
        </div>
      )}

      {spokenText && (
        <div className="mt-4">
          <p>You said: {spokenText}</p>
          <p className="mt-2">
            Text match: {textMatchResult === null ? "Evaluating..." : textMatchResult ? "Success" : "Failed"}
          </p>
        </div>
      )}
    </div>
  );
}

export default Login;