"""
URL configuration for vaultsql project.
"""
from django.urls import path
from vaultsql.api import api

urlpatterns = [
    path("api/", api.urls),
]
