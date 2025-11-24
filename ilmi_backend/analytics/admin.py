from django.contrib import admin
from .models import (
    VisitorSession,
    PageView,
    SectionView,
    ClickEvent,
    FreeLessonLead,
    FailedLead,
)


@admin.register(VisitorSession)
class VisitorSessionAdmin(admin.ModelAdmin):
    list_display = (
        "session_key",
        "first_visit",
        "last_visit",
        "visit_count",
        "utm_source",
        "utm_medium",
        "utm_campaign",
    )
    search_fields = ("session_key", "user_agent", "ip_address")
    list_filter = ("utm_source", "utm_medium", "utm_campaign", "last_visit")
    readonly_fields = ("first_visit", "last_visit", "visit_count")


@admin.register(PageView)
class PageViewAdmin(admin.ModelAdmin):
    list_display = ("page_path", "session", "created_at")
    list_filter = ("page_path", "created_at")
    search_fields = ("page_path", "session__session_key")
    readonly_fields = ("created_at",)


@admin.register(SectionView)
class SectionViewAdmin(admin.ModelAdmin):
    list_display = ("page_path", "section_id", "visible_ratio", "session", "created_at")
    list_filter = ("page_path", "section_id", "created_at")
    search_fields = ("section_id", "page_path", "session__session_key")
    readonly_fields = ("created_at",)


@admin.register(ClickEvent)
class ClickEventAdmin(admin.ModelAdmin):
    list_display = ("event_id", "page_path", "session", "created_at")
    list_filter = ("event_id", "page_path", "created_at")
    search_fields = ("event_id", "page_path", "session__session_key")
    readonly_fields = ("created_at",)


@admin.register(FreeLessonLead)
class FreeLessonLeadAdmin(admin.ModelAdmin):
    list_display = (
        "full_name",
        "phone",
        "course_slug",
        "created_at",
        "source",
        "is_valid_number",
        "session",
    )
    list_filter = ("course_slug", "source", "is_valid_number", "created_at")
    search_fields = ("full_name", "phone", "session__session_key")
    readonly_fields = ("id", "created_at")


@admin.register(FailedLead)
class FailedLeadAdmin(admin.ModelAdmin):
    list_display = (
        "full_name",
        "phone",
        "course_slug",
        "event",
        "created_at",
        "session",
    )
    list_filter = ("course_slug", "event", "created_at")
    search_fields = ("full_name", "phone", "session__session_key")
    readonly_fields = ("id", "created_at")
