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

def validate_human_face(image_np):
    """Strictly checks if image contains a clear human front face with eye features."""
    # 1. Primary Check: dlib / face_recognition library
    try:
        import face_recognition
        face_locations = face_recognition.face_locations(image_np)
        if not face_locations:
            return False, "No human face detected. Please upload a clear photo of a person's face."
        if len(face_locations) > 1:
            return False, "Multiple faces detected. Please provide a photo containing only your face."
        return True, "Valid human front face detected."
    except Exception:
        pass

    # 2. Secondary Check: OpenCV Multi-Cascade (FrontalFace + Alt2 + Eye detection)
    import cv2
    gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
    gray = cv2.equalizeHist(gray)

    cascade_default = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    cascade_alt2 = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')
    cascade_eye = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

    faces = cascade_alt2.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6, minSize=(60, 60))
    if len(faces) == 0:
        faces = cascade_default.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=7, minSize=(60, 60))

    if len(faces) == 0:
        return False, "No human front face detected. Please upload a clear photo of a person's face."
    if len(faces) > 1:
        return False, "Multiple faces detected. Please upload a photo with only one face."

    (x, y, w, h) = faces[0]
    face_roi = gray[y:y+h, x:x+w]
    eyes = cascade_eye.detectMultiScale(face_roi, scaleFactor=1.1, minNeighbors=4, minSize=(15, 15))

    # Human face validation requires eye features or strong cascade confidence
    if len(eyes) == 0:
        # Re-check with default if alt2 was used
        alt_faces = cascade_default.detectMultiScale(face_roi, scaleFactor=1.1, minNeighbors=8)
        if len(alt_faces) == 0:
            return False, "Could not verify human facial features (eyes/face outline). Please upload a clear front-facing portrait."

    return True, "Valid human front face detected."

def compute_face_encoding(image_np):
    is_valid, err_msg = validate_human_face(image_np)
    if not is_valid:
        raise ValueError(err_msg)

    # Compute encoding
    try:
        import face_recognition
        face_locations = face_recognition.face_locations(image_np)
        encodings = face_recognition.face_encodings(image_np, face_locations)
        if encodings:
            return encodings[0].tolist()
    except Exception:
        pass

    import cv2
    gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
    cascade_alt2 = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')
    faces = cascade_alt2.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(50, 50))
    if len(faces) == 0:
        cascade_default = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = cascade_default.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(50, 50))

    if len(faces) > 0:
        (x, y, w, h) = faces[0]
        cropped = gray[y:y+h, x:x+w]
    else:
        cropped = gray

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
