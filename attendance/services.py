import math
from datetime import time, datetime
import numpy as np

# EXACT TESTING OFFICE COORDINATES (Tirunelveli location provided in image)
ZIGMA_OFFICE_LAT = 8.692451
ZIGMA_OFFICE_LNG = 77.718733
ALLOWED_RADIUS_METERS = 70.0
CUTOFF_TIME = time(10, 0, 0)

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000  # Radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def evaluate_attendance_status(check_time: time):
    return 'LATE' if check_time > CUTOFF_TIME else 'PRESENT'

def compute_face_encoding(image_np):
    # 1. Try face_recognition library first
    try:
        import face_recognition
        face_locations = face_recognition.face_locations(image_np)
        if not face_locations:
            raise ValueError("No clear front face detected in the photo. Please provide a photo with a visible person's face.")
        if len(face_locations) > 1:
            raise ValueError("Multiple faces detected in the photo. Please provide a photo with only your face.")
        encodings = face_recognition.face_encodings(image_np, face_locations)
        if encodings:
            return encodings[0].tolist()
    except ValueError:
        raise
    except Exception:
        pass

    # 2. OpenCV fallback with face cascade
    import cv2
    gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
    cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    face_cascade = cv2.CascadeClassifier(cascade_path)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(40, 40))
    
    if len(faces) == 0:
        raise ValueError("No front face detected. Only photos with a clear front face are allowed.")
    if len(faces) > 1:
        raise ValueError("Multiple faces detected. Please capture/upload a photo of a single person.")

    (x, y, w, h) = faces[0]
    cropped = gray[y:y+h, x:x+w]

    resized = cv2.resize(cropped, (64, 64))
    hist = cv2.calcHist([resized], [0], None, [128], [0, 256]).flatten()
    norm = np.linalg.norm(hist)
    if norm > 0:
        hist = hist / norm
    return hist.tolist()

def compare_face_vectors(known_vec, candidate_vec, tolerance=0.50):
    try:
        import face_recognition
        known_np = np.array(known_vec)
        cand_np = np.array(candidate_vec)
        match_results = face_recognition.compare_faces([known_np], cand_np, tolerance=tolerance)
        return bool(match_results[0])
    except Exception:
        pass

    known_np = np.array(known_vec)
    cand_np = np.array(candidate_vec)
    if len(known_np) != len(cand_np):
        return False
    
    dist = np.linalg.norm(known_np - cand_np)
    return bool(dist <= 0.65)
