"""
Django settings for ilmi_backend project.
"""

from pathlib import Path

# ==========================================
# PATHS
# ==========================================

BASE_DIR = Path(__file__).resolve().parent.parent
# BASE_DIR = /opt/kurs/ilmi_backend

# ==========================================
# SECURITY
# ==========================================

SECRET_KEY = 'django-insecure-_hqgk)i_^*tv&q9mhr$8+&4p1@h#u4-o-q410-5(l(pz0&#0g0'
DEBUG = True

ALLOWED_HOSTS = [
    "*",
    "ilmi.uz",
    "kurs.ilmi.uz",
    "89.39.95.53",
]

# ==========================================
# APPS
# ==========================================

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'analytics',
    'corsheaders',
]

# ==========================================
# MIDDLEWARE
# ==========================================

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',

    'corsheaders.middleware.CorsMiddleware',

    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# ==========================================
# CORS / CSRF
# ==========================================

CORS_ALLOW_ALL_ORIGINS = True

CSRF_TRUSTED_ORIGINS = [
    "https://kurs.ilmi.uz",
    "https://ilmi.uz",
]

# ==========================================
# URL CONFIG
# ==========================================

ROOT_URLCONF = 'ilmi_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',

        # Путь к index.html
        'DIRS': [
            BASE_DIR / 'ilmi_backend' / 'templates'
        ],

        'APP_DIRS': True,

        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'ilmi_backend.wsgi.application'

# ==========================================
# DATABASE
# ==========================================

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR.parent / 'db.sqlite3',
        # db.sqlite лежит в /opt/kurs/db.sqlite3
    }
}

# ==========================================
# PASSWORD VALIDATION
# ==========================================

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ==========================================
# LOCALE
# ==========================================

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Tashkent'

USE_I18N = True
USE_TZ = True

# ==========================================
# STATIC FILES
# ==========================================

STATIC_URL = "/static/"

# куда Django соберёт статику (python manage.py collectstatic)
STATIC_ROOT = BASE_DIR.parent / "staticfiles"
# /opt/kurs/staticfiles

# откуда Django читает локальную статику
STATICFILES_DIRS = [
    BASE_DIR.parent / "static",
]
# /opt/kurs/static

# ==========================================
# DEFAULT PRIMARY KEY
# ==========================================

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
