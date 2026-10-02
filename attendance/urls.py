from django.urls import path
from .views import MarkAttendanceView, EmployeeRegisterView, AttendanceHistoryView, GeofenceConfigView, EmployeeLoginView, VerifyFaceView

urlpatterns = [
    path('config/', GeofenceConfigView.as_view(), name='geofence-config'),
    path('register/', EmployeeRegisterView.as_view(), name='employee-register'),
    path('login/', EmployeeLoginView.as_view(), name='employee-login'),
    path('verify-face/', VerifyFaceView.as_view(), name='verify-face'),
    path('mark-attendance/', MarkAttendanceView.as_view(), name='mark-attendance'),
    path('history/', AttendanceHistoryView.as_view(), name='attendance-history'),
]
