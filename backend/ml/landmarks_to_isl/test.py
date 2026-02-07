import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import tensorflow as tf

# 1. Load your Keras model
model = tf.keras.models.load_model("model.keras")
print("✅ Keras Model loaded")

# 2. Configure MediaPipe Hand Landmarker
# Download the model bundle from Google's site if you don't have it:
# https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
base_options = python.BaseOptions(model_asset_path='hand_landmarker.task')
options = vision.HandLandmarkerOptions(
    base_options=base_options,
    num_hands=2,
    min_hand_detection_confidence=0.7,
    min_hand_presence_confidence=0.7,
    running_mode=vision.RunningMode.VIDEO
)
detector = vision.HandLandmarker.create_from_options(options)

def build_feature_vector(hand_landmarks_list):
    """
    hand_landmarks_list is a list of Landmark objects from MediaPipe Tasks
    """
    features = []
    
    # ---- Hand count flag ----
    two_hands = 1 if len(hand_landmarks_list) == 2 else 0
    features.append(two_hands)

    # ---- Landmarks (always pad to 2 hands) ----
    for i in range(2):
        if i < len(hand_landmarks_list):
            for lm in hand_landmarks_list[i]:
                features.extend([lm.x, lm.y, lm.z])
        else:
            features.extend([0] * 63) # 21 landmarks * 3 coords

    return np.array(features, dtype=np.float32)

cap = cv2.VideoCapture(0)

while cap.isOpened():
    ret, frame = cap.read()
    if not ret: break

    # Convert frame to MediaPipe Image object
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
    
    # Calculate timestamp in ms (required for VIDEO mode)
    timestamp_ms = int(cap.get(cv2.CAP_PROP_POS_MSEC))
    if timestamp_ms == 0: # Handle cases where webcam doesn't provide prop
        timestamp_ms = int(cv2.getTickCount() / cv2.getTickFrequency() * 1000)

    # Detect hand landmarks
    detection_result = detector.detect_for_video(mp_image, timestamp_ms)

    if detection_result.hand_landmarks:
        # Build vector using the list of hand landmarks
        feature_vec = build_feature_vector(detection_result.hand_landmarks)

        if feature_vec.shape[0] == 127:
            pred = model.predict(feature_vec.reshape(1, -1), verbose=0)
            idx = np.argmax(pred)

            letter = chr(idx + 65) 
            cv2.putText(
                frame,
                f"Letter: {letter} (Index: {idx})",
                (20, 50),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.2,
                (0, 255, 0),
                3
            )

        # Draw landmarks (Legacy drawing_utils is still used for simple viz)
        # Or you can manually draw circles on frame using detection_result.hand_landmarks
        for hand_lms in detection_result.hand_landmarks:
            for lm in hand_lms:
                x, y = int(lm.x * frame.shape[1]), int(lm.y * frame.shape[0])
                cv2.circle(frame, (x, y), 3, (0, 255, 0), -1)

    cv2.imshow("Hand Sign Test", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

detector.close()
cap.release()
cv2.destroyAllWindows()