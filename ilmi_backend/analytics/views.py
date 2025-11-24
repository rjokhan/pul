import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .models import (
    VisitorSession,
    PageView,
    SectionView,
    ClickEvent,
    FreeLessonLead,
    FailedLead,
)


# ===== UTILS =====

def get_json(request):
    try:
        return json.loads(request.body.decode("utf-8"))
    except Exception:
        # Если пришёл невалидный JSON – просто возвращаем пустой словарь
        return {}


def get_session(session_key: str, *, increment_visit: bool = False):
    """
    Создаёт или обновляет VisitorSession.

    visit_count увеличиваем ТОЛЬКО там, где это реально визит:
    - register_session
    - page_view
    """
    if not session_key:
        return None

    session, created = VisitorSession.objects.get_or_create(
        session_key=session_key,
        defaults={"visit_count": 1}
    )

    # Увеличиваем счётчик посещений только при нужных вызовах
    if not created and increment_visit:
        session.visit_count += 1

    # last_visit обновляем при любом обращении
    update_fields = ["last_visit"]
    if created or increment_visit:
        update_fields.append("visit_count")

    session.save(update_fields=update_fields)
    return session


def _get_ip(request):
    # Если будешь за nginx — лучше смотреть HTTP_X_FORWARDED_FOR
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


# ===== API: REGISTRATION OF SESSION =====

@csrf_exempt
@require_POST
def api_register_session(request):
    """
    Эндпоинт на будущее.
    Сейчас фронт его не вызывает, но он готов.

    Ожидает:
    {
      "session_id": "...",
      "user_agent": "...",
      "utm_source": "...", ...
    }
    """
    data = get_json(request)
    session_id = data.get("session_id")
    user_agent = data.get("user_agent", "")
    ip = _get_ip(request)

    session = get_session(session_id, increment_visit=True)
    if session:
        session.user_agent = user_agent
        session.ip_address = ip
        session.utm_source = data.get("utm_source", "") or session.utm_source
        session.utm_medium = data.get("utm_medium", "") or session.utm_medium
        session.utm_campaign = data.get("utm_campaign", "") or session.utm_campaign
        session.utm_content = data.get("utm_content", "") or session.utm_content
        session.utm_term = data.get("utm_term", "") or session.utm_term
        session.save(
            update_fields=[
                "user_agent",
                "ip_address",
                "utm_source",
                "utm_medium",
                "utm_campaign",
                "utm_content",
                "utm_term",
                "last_visit",
            ]
        )

    return JsonResponse({"success": True})


# ===== API: PAGE VIEW =====

@csrf_exempt
@require_POST
def api_page_view(request):
    """
    Фронт: safeFetch(`${ANALYTICS_BASE}/page-view/`, {
        session_id,
        page_path,
        user_agent
    })
    """
    data = get_json(request)
    session_id = data.get("session_id")
    page = data.get("page_path", "/")
    user_agent = data.get("user_agent", "")

    session = get_session(session_id, increment_visit=True)
    if session:
        if user_agent and not session.user_agent:
            session.user_agent = user_agent
            session.save(update_fields=["user_agent", "last_visit"])

        PageView.objects.create(session=session, page_path=page)

    return JsonResponse({"success": True})


# ===== API: SECTION VIEW =====

@csrf_exempt
@require_POST
def api_section_view(request):
    """
    Фронт: safeFetch(`${ANALYTICS_BASE}/section-view/`, {
        session_id,
        page_path,
        section_id,
        visible_ratio
    })
    """
    data = get_json(request)
    session_id = data.get("session_id")
    session = get_session(session_id, increment_visit=False)

    if session:
        SectionView.objects.create(
            session=session,
            page_path=data.get("page_path", "/"),
            section_id=data.get("section_id", ""),
            visible_ratio=data.get("visible_ratio"),
        )

    return JsonResponse({"success": True})


# ===== API: CLICK EVENT =====

@csrf_exempt
@require_POST
def api_click_event(request):
    """
    Фронт: safeFetch(`${ANALYTICS_BASE}/event/`, {
        session_id,
        page_path,
        event_id,
        meta: {...}
    })
    """
    data = get_json(request)
    session_id = data.get("session_id")
    session = get_session(session_id, increment_visit=False)

    if session:
        ClickEvent.objects.create(
            session=session,
            page_path=data.get("page_path", "/"),
            event_id=data.get("event_id", ""),
            meta=data.get("meta") or {},  # всегда dict, а не None
        )

    return JsonResponse({"success": True})


# ===== API: FREE LESSON LEAD =====

@csrf_exempt
@require_POST
def api_free_lesson_lead(request):
    """
    Фронт (LEADS_ENDPOINT):
    safeFetch("/api/leads/free-lesson/", {
        session_id,
        course_slug,
        full_name,
        phone
    })
    """
    data = get_json(request)

    session = None
    if data.get("session_id"):
        session = get_session(data["session_id"], increment_visit=False)

    lead = FreeLessonLead.objects.create(
        session=session,
        course_slug=data.get("course_slug", "unknown"),
        full_name=(data.get("full_name") or "").strip(),
        phone=(data.get("phone") or "").strip(),
        is_valid_number=data.get("is_valid_number", True),
    )

    return JsonResponse({"success": True, "id": str(lead.id)})


# ===== API: FAILED LEAD =====

@csrf_exempt
@require_POST
def api_failed_lead(request):
    """
    На будущее, если решишь слать незавершённые заявки.
    """
    data = get_json(request)

    session = None
    if data.get("session_id"):
        session = get_session(data["session_id"], increment_visit=False)

    FailedLead.objects.create(
        session=session,
        course_slug=data.get("course_slug", "unknown"),
        full_name=(data.get("full_name") or "").strip(),
        phone=(data.get("phone") or "").strip(),
        event=data.get("event", "unknown"),
    )

    return JsonResponse({"success": True})
