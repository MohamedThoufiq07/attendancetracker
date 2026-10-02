from django.db import models
from django.contrib.auth.models import AbstractUser

class Employee(models.Model):
    emp_id = models.CharField(max_length=20, unique=True)
    full_name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    designation = models.CharField(max_length=100)
    joining_date = models.DateField(auto_now_add=True)
    face_encoding = models.JSONField(help_text="128-dimensional face embedding vector or pixel signature", null=True, blank=True)
    profile_photo = models.ImageField(upload_to="employees/photos/", null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.emp_id} - {self.full_name}"

class Attendance(models.Model):
    STATUS_CHOICES = (
        ('PRESENT', 'On Time (Present)'),
        ('LATE', 'Late Arrival'),
        ('HALF_DAY', 'Half Day'),
        ('ABSENT', 'Absent'),
    )
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='attendances')
    date = models.DateField(auto_now_add=True, db_index=True)
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PRESENT')
    punch_latitude = models.FloatField()
    punch_longitude = models.FloatField()
    distance_meters = models.FloatField()
    verification_photo = models.ImageField(upload_to="attendance/punches/%Y/%m/%d/", null=True, blank=True)

    class Meta:
        unique_together = ('employee', 'date')
        ordering = ['-date', '-check_in']

    def __str__(self):
        return f"{self.employee.emp_id} - {self.date} ({self.status})"
