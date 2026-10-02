import numpy as np
from PIL import Image
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from .models import Employee, Attendance
from .services import (
    haversine_distance, 
    evaluate_attendance_status, 
    compute_face_encoding, 
    compare_face_vectors,
    ZIGMA_OFFICE_LAT, 
    ZIGMA_OFFICE_LNG, 
    ALLOWED_RADIUS_METERS
)

class GeofenceConfigView(APIView):
    def get(self, request):
        return Response({
            "office_name": "Zigmaa Tech",
            "address": "JP THANAM COMPLEX, 16H/7, Maharaja Nagar, Jeyalani Colony, Thoothukudi, Tamil Nadu 628008",
            "office_lat": ZIGMA_OFFICE_LAT,
            "office_lng": ZIGMA_OFFICE_LNG,
            "allowed_radius_meters": ALLOWED_RADIUS_METERS
        })

class EmployeeRegisterView(APIView):
    def post(self, request):
        full_name = request.data.get('full_name', '').strip()
        email = request.data.get('email', '').strip()
        emp_id = request.data.get('emp_id', '').strip()
        designation = request.data.get('designation', 'Software Engineer')
        image_file = request.FILES.get('face_image')

        if not full_name or not email or not image_file:
            return Response({"error": "Please provide Full Name, Gmail/Email, and a clear face photo."}, status=status.HTTP_400_BAD_REQUEST)

        # Auto-generate Employee ID from Full Name if not provided
        if not emp_id:
            clean_name = ''.join([c for c in full_name if c.isalpha()])
            prefix = clean_name[:3].upper() if len(clean_name) >= 3 else (clean_name.upper() + "EMP")[:3]
            existing_count = Employee.objects.filter(emp_id__startswith=prefix).count() + 1
            emp_id = f"{prefix}_{existing_count:03d}"

        try:
            pil_image = Image.open(image_file).convert('RGB')
            image_np = np.array(pil_image)
            encoding = compute_face_encoding(image_np)
        except ValueError as ve:
            return Response({"error": str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Failed to process face image: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        employee, created = Employee.objects.update_or_create(
            emp_id=emp_id,
            defaults={
                'full_name': full_name,
                'email': email,
                'designation': designation,
                'face_encoding': encoding,
                'profile_photo': image_file,
                'is_active': True
            }
        )

        return Response({
            "message": f"Employee {full_name} registered successfully!",
            "emp_id": emp_id,
            "full_name": full_name,
            "email": email,
            "created": created
        }, status=status.HTTP_201_CREATED)

class EmployeeLoginView(APIView):
    def post(self, request):
        identifier = request.data.get('identifier', '').strip() # can be email or emp_id
        password = request.data.get('password', '').strip()

        if not identifier:
            return Response({"error": "Please enter your Gmail / Email or Employee ID."}, status=status.HTTP_400_BAD_REQUEST)

        employee = Employee.objects.filter(email__iexact=identifier, is_active=True).first()
        if not employee:
            employee = Employee.objects.filter(emp_id__iexact=identifier, is_active=True).first()

        if not employee:
            return Response({"error": "No account found matching this Gmail/Email or Employee ID."}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "message": "Login successful",
            "emp_id": employee.emp_id,
            "full_name": employee.full_name,
            "email": employee.email,
            "designation": employee.designation
        }, status=status.HTTP_200_OK)

class MarkAttendanceView(APIView):
    def post(self, request):
        emp_id = request.data.get('emp_id')
        user_lat = float(request.data.get('latitude', 0))
        user_lng = float(request.data.get('longitude', 0))
        image_file = request.FILES.get('face_image')

        # 1. Validation Checks
        if not emp_id or not image_file or not user_lat or not user_lng:
            return Response({"error": "Missing required fields (emp_id, face_image, latitude, longitude)"}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Geofence Distance Check
        dist = haversine_distance(ZIGMA_OFFICE_LAT, ZIGMA_OFFICE_LNG, user_lat, user_lng)
        if dist > ALLOWED_RADIUS_METERS:
            return Response({
                "error": f"Access denied: You are {round(dist, 1)}m away. Attendance allowed only within 70m of Zigmaa Tech, Thoothukudi."
            }, status=status.HTTP_403_FORBIDDEN)

        # 3. Employee Lookup
        try:
            employee = Employee.objects.get(emp_id=emp_id, is_active=True)
        except Employee.DoesNotExist:
            return Response({"error": f"Employee ID '{emp_id}' not found or inactive."}, status=status.HTTP_404_NOT_FOUND)

        # 4. Face Recognition Matching
        try:
            pil_image = Image.open(image_file).convert('RGB')
            uploaded_image_np = np.array(pil_image)
            captured_encoding = compute_face_encoding(uploaded_image_np)
        except Exception as e:
            return Response({"error": "Could not parse uploaded face image"}, status=status.HTTP_400_BAD_REQUEST)

        if not captured_encoding or not employee.face_encoding:
            return Response({"error": "No face recognized in snapshot or missing registered face profile"}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        is_match = compare_face_vectors(employee.face_encoding, captured_encoding, tolerance=0.50)
        if not is_match:
            return Response({"error": "Face verification mismatch! Please capture clearly."}, status=status.HTTP_401_UNAUTHORIZED)

        # 5. Timestamp & Late Calculation
        now = timezone.localtime(timezone.now())
        today = now.date()
        current_time = now.time()
        attendance_status = evaluate_attendance_status(current_time)

        # 6. Record or Update DB
        attendance, created = Attendance.objects.get_or_create(
            employee=employee,
            date=today,
            defaults={
                'check_in': current_time,
                'status': attendance_status,
                'punch_latitude': user_lat,
                'punch_longitude': user_lng,
                'distance_meters': dist,
                'verification_photo': image_file
            }
        )

        if not created:
            attendance.check_out = current_time
            attendance.save()
            return Response({
                "message": f"Punch-Out recorded successfully for {employee.full_name}",
                "employee_name": employee.full_name,
                "emp_id": employee.emp_id,
                "type": "PUNCH_OUT",
                "check_out": current_time.strftime("%I:%M %p"),
                "status": attendance.status,
                "distance": f"{round(dist, 1)}m"
            }, status=status.HTTP_200_OK)

        return Response({
            "message": f"Check-In recorded: {attendance_status}",
            "employee_name": employee.full_name,
            "emp_id": employee.emp_id,
            "type": "CHECK_IN",
            "status": attendance_status,
            "check_in": current_time.strftime("%I:%M %p"),
            "distance": f"{round(dist, 1)}m"
        }, status=status.HTTP_201_CREATED)

class AttendanceHistoryView(APIView):
    def get(self, request):
        emp_id = request.query_params.get('emp_id')
        queryset = Attendance.objects.select_related('employee').all()
        if emp_id:
            queryset = queryset.filter(employee__emp_id=emp_id)
        
        data = []
        for att in queryset[:50]:
            data.append({
                "id": att.id,
                "emp_id": att.employee.emp_id,
                "employee_name": att.employee.full_name,
                "date": att.date.strftime("%Y-%m-%d"),
                "check_in": att.check_in.strftime("%I:%M %p") if att.check_in else None,
                "check_out": att.check_out.strftime("%I:%M %p") if att.check_out else None,
                "status": att.status,
                "distance": f"{round(att.distance_meters, 1)}m"
            })
        return Response(data, status=status.HTTP_200_OK)
