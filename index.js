import {
    GestureRecognizer,
    FilesetResolver,
    DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

let gestureRecognizer;
let runningMode = "VIDEO";
let enableWebcamButton;
let webcamRunning = false;
const videoHeight = "360px";
const videoWidth = "480px";
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const gestureOutput = document.getElementById('gesture_output');
const protectedContent = document.getElementById('protectedContent');
const unlockedImage = document.getElementById('unlockedImage');
const birthdayCard = document.getElementById('birthdayCard');

// Define the gesture sequence that will unlock the birthday card
const unlockSequence = ['Thumb_Up', 'Open_Palm', 'Closed_Fist']; // Example sequence
let gestureSequence = [];

// Throttle function to limit the rate of function calls
function throttle(func, delay) {
    let lastCall = 0;
    return function (...args) {
        const now = new Date().getTime();
        if (now - lastCall < delay) {
            return;
        }
        lastCall = now;
        return func(...args);
    };
}

// Function to process user gestures
const processGesture = throttle((userGesture) => {
    if (userGesture !== "None") {
        // Add the recognized gesture to the sequence if it's not "None"
        if (gestureSequence.length === 0 || gestureSequence[gestureSequence.length - 1] !== userGesture) {
            // Add the recognized gesture to the sequence if it's not "None" and is unique
            gestureSequence.push(userGesture);
            if (gestureSequence.length > 3) {
                gestureSequence.shift(); // Keep only the last 5 gestures
            }
        }
        console.log(gestureSequence, unlockSequence)
        // Check if the recognized gesture sequence matches the unlock sequence
        if (JSON.stringify(gestureSequence) === JSON.stringify(unlockSequence)) {
            // Hide all other content
            document.querySelectorAll('body > *:not(#birthdayCard)').forEach(el => el.style.display = 'none');
            gestureOutput.style.display = 'none'
            // Show the birthday card
            birthdayCard.style.display = 'block';
            success = true
        }
    }
}, 200);

// Before we can use GestureRecognizer class we must wait for it to finish loading.
const createGestureRecognizer = async () => {
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU"
        },
        runningMode: runningMode
    });
};
createGestureRecognizer();

// Check if webcam access is supported.
function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// If webcam supported, add event listener to button for when user wants to activate it.
if (hasGetUserMedia()) {
    enableWebcamButton = document.getElementById("webcamButton");
    enableWebcamButton.style.display = 'block'; // Show the button
    enableWebcamButton.addEventListener("click", enableCam);
} else {
    console.warn("getUserMedia() is not supported by your browser");
}

// Enable the live webcam view and start detection.
function enableCam(event) {
    if (!gestureRecognizer) {
        alert("Please wait for gestureRecognizer to load");
        return;
    }

    if (webcamRunning === true) {
        webcamRunning = false;
        enableWebcamButton.innerText = "ENABLE PREDICTIONS";
    } else {
        webcamRunning = true;
        enableWebcamButton.innerText = "DISABLE PREDICTIONS";
    }

    // getUsermedia parameters.
    const constraints = {
        video: true
    };

    // Activate the webcam stream.
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        videoElement.srcObject = stream;
        videoElement.addEventListener("loadeddata", predictWebcam);
        videoElement.style.display = 'block'; // Show the video element
        canvasElement.style.display = 'block'; // Show the canvas element
    });
}

let lastVideoTime = -1;
let results = undefined;
let success = false
async function predictWebcam() {
    // Now let's start detecting the stream.
    if(success) return
    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await gestureRecognizer.setOptions({ runningMode: "VIDEO" });
    }
    let nowInMs = Date.now();
    if (videoElement.currentTime !== lastVideoTime) {
        lastVideoTime = videoElement.currentTime;
        results = gestureRecognizer.recognizeForVideo(videoElement, nowInMs);
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    const drawingUtils = new DrawingUtils(canvasCtx);

    canvasElement.style.height = videoHeight;
    videoElement.style.height = videoHeight;
    canvasElement.style.width = videoWidth;
    videoElement.style.width = videoWidth;

    if (results.landmarks) {
        for (const landmarks of results.landmarks) {
            drawingUtils.drawConnectors(
                landmarks,
                GestureRecognizer.HAND_CONNECTIONS,
                {
                    color: "#00FF00",
                    lineWidth: 5
                }
            );
            drawingUtils.drawLandmarks(landmarks, {
                color: "#FF0000",
                lineWidth: 2
            });
        }
    }
    canvasCtx.restore();
    if (results.gestures.length > 0) {
        gestureOutput.style.display = "block";
        gestureOutput.style.width = videoWidth;
        const userGesture = results.gestures[0][0].categoryName;
        const categoryScore = parseFloat(
            results.gestures[0][0].score * 100
        ).toFixed(2);
        gestureOutput.innerText = `Gesture: ${userGesture}\nConfidence: ${categoryScore}%`;

        // Process the user gesture with throttling
        processGesture(userGesture);
    } else {
        gestureOutput.style.display = "none";
    }
    // Call this function again to keep predicting when the browser is ready.
    if (webcamRunning === true) {
        window.requestAnimationFrame(predictWebcam);
    }
}