from django.shortcuts import render

def home(request):
    """
    Главная точка входа для фронтенда.
    Загружает index.html из корня проекта.
    """
    return render(request, "index.html")
