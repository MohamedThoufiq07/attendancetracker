from django.urls import path
from .views import MarkAttendanceView, EmployeeRegisterView, AttendanceHistoryView, GeofenceConfigView, EmployeeLoginView

urlpatterns = [
    path('config/', GeofenceConfigView.as_view(), name='geofence-config'),
    path('register/', EmployeeRegisterView.as_view(), name='employee-register'),
    path('login/', EmployeeLoginView.as_view(), name='employee-login'),
    path('mark-attendance/', MarkAttendanceView.as_view(), name='mark-attendance'),
    path('history/', AttendanceHistoryView.as_view(), name='attendance-history'),
]
