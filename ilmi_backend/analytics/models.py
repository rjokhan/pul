import uuid
from django.db import models


class VisitorSession(models.Model):
    """
    Уникальная сессия посетителя.
    session_key — UUID, который создаёт фронтенд (localStorage).
    Используется для отслеживания уникальных пользователей и повторных визитов.
    """
    session_key = models.CharField(max_length=64, unique=True)
    first_visit = models.DateTimeField(auto_now_add=True)
    last_visit = models.DateTimeField(auto_now=True)
    visit_count = models.PositiveIntegerField(default=1)

    user_agent = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    # Дополнительно сохраняем UTM (если потом добавишь)
    utm_source = models.CharField(max_length=128, blank=True)
    utm_medium = models.CharField(max_length=128, blank=True)
    utm_campaign = models.CharField(max_length=128, blank=True)
    utm_content = models.CharField(max_length=128, blank=True)
    utm_term = models.CharField(max_length=128, blank=True)

    def __str__(self):
        return self.session_key

    class Meta:
        verbose_name = "Сессия пользователя"
        verbose_name_plural = "Сессии пользователей"
        ordering = ("-last_visit",)
        indexes = [
            models.Index(fields=["last_visit"]),
        ]


class PageView(models.Model):
    """
    Каждый просмотр страницы.
    Считаем посещения, понимаем общий поток трафика.
    """
    session = models.ForeignKey(
        VisitorSession,
        on_delete=models.CASCADE,
        related_name="page_views",
    )
    page_path = models.CharField(max_length=255, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Просмотр страницы"
        verbose_name_plural = "Просмотры страниц"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["page_path", "created_at"]),
        ]

    def __str__(self):
        return f"{self.page_path} @ {self.created_at:%Y-%m-%d %H:%M}"


class SectionView(models.Model):
    """
    Просмотр секции лендинга.
    Благодаря этому видно где просадка по глубине.
    """
    session = models.ForeignKey(
        VisitorSession,
        on_delete=models.CASCADE,
        related_name="section_views",
    )
    page_path = models.CharField(max_length=255, db_index=True)
    section_id = models.CharField(max_length=64, db_index=True)
    # доля видимой высоты секции (0–1)
    visible_ratio = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Просмотр секции"
        verbose_name_plural = "Просмотры секций"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["page_path", "section_id"]),
            models.Index(fields=["section_id", "created_at"]),
        ]

    def __str__(self):
        return f"{self.page_path} – {self.section_id} ({self.visible_ratio})"


class ClickEvent(models.Model):
    """
    Фиксируем каждый клик по важным кнопкам.
    Например:
    - free_lesson_click
    - buy_click
    - trailer_play
    - appstore_click
    """
    session = models.ForeignKey(
        VisitorSession,
        on_delete=models.CASCADE,
        related_name="click_events",
    )
    page_path = models.CharField(max_length=255, db_index=True)
    event_id = models.CharField(max_length=64, db_index=True)
    meta = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Событие клика"
        verbose_name_plural = "События кликов"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["event_id", "created_at"]),
            models.Index(fields=["page_path", "event_id"]),
        ]

    def __str__(self):
        return f"{self.event_id} @ {self.created_at:%Y-%m-%d %H:%M}"


class FreeLessonLead(models.Model):
    """
    Лид из попапа бесплатного урока.
    Система без SMS-подтверждения, только сбор ФИО и телефона.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        VisitorSession,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="free_lesson_leads",
    )

    course_slug = models.CharField(max_length=128, db_index=True)
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=64)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    source = models.CharField(max_length=64, default="free_lesson_popup", db_index=True)

    # полезно для аналитики
    is_valid_number = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Лид бесплатного урока"
        verbose_name_plural = "Лиды бесплатного урока"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["phone", "created_at"]),
        ]

    def __str__(self):
        return f"{self.full_name} – {self.phone}"


class FailedLead(models.Model):
    """
    Частично заполненные лиды:
    - ввели имя, но не телефон
    - начали вводить форму, но закрыли
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        VisitorSession,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="failed_leads",
    )

    course_slug = models.CharField(max_length=128, db_index=True)
    full_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=64, blank=True)
    event = models.CharField(max_length=64, db_index=True)  # abandoned, filled_name_only etc.

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Незавершённый лид"
        verbose_name_plural = "Незавершённые лиды"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["event", "created_at"]),
        ]

    def __str__(self):
        return f"Failed lead – {self.full_name} / {self.phone}"
