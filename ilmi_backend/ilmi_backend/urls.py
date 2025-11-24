from django.contrib import admin
from django.urls import path, include
from . import views

urlpatterns = [
    path("admin/", admin.site.urls),

    # Главная страница (лендинг)
    path("", views.home, name="home"),

    # API аналитики
    path("", include("analytics.urls")),
]
