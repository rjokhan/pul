from django.urls import path
from . import views

urlpatterns = [
    path(
        "api/track/register-session/",
        views.api_register_session,
        name="api_register_session",
    ),

    path(
        "api/track/page-view/",
        views.api_page_view,
        name="api_page_view",
    ),
    path(
        "api/track/section-view/",
        views.api_section_view,
        name="api_section_view",
    ),
    path(
        "api/track/event/",
        views.api_click_event,
        name="api_click_event",
    ),

    path(
        "api/leads/free-lesson/",
        views.api_free_lesson_lead,
        name="api_free_lesson_lead",
    ),
    path(
        "api/leads/failed/",
        views.api_failed_lead,
        name="api_failed_lead",
    ),
]
