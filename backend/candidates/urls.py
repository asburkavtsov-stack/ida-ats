from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CandidateViewSet, VacancyViewSet, VacancyTemplateViewSet, VacancyStageViewSet,
    OrganizationViewSet, UserListView, current_user, CandidateExportCSVView,
    EmailTemplateViewSet, SentEmailViewSet, google_auth_status,
    TagViewSet, time_to_hire_analytics, candidate_time_to_hire_detail,
    export_time_to_hire_csv, hr_effectiveness_analytics, export_hr_effectiveness_csv,
    export_time_to_hire_excel, export_time_to_hire_pdf, export_hr_effectiveness_excel,
    export_hr_effectiveness_pdf, export_full_report_excel, export_full_report_pdf,
    InterviewViewSet, BlacklistViewSet,
    HolidayThemeViewSet, PricingConfigViewSet, PromoCodeViewSet,
    public_pricing, RejectionReasonViewSet, rejection_analytics,
    AuditLogView, RegisterView, monthly_trend_analytics,
    ModeratorNoteViewSet,  # ← НОВЕ
)
from .job_board_views import (
    vacancy_feed_rabota_ua,
    vacancy_feed_work_ua,
    work_ua_webhook,
    job_board_application_webhook,
)
from .external_api_views import (
    ExtVacancyListView, ExtVacancyDetailView,
    ExtCandidateCreateView, ExtCandidateStatusView,
    ExtWebhookListCreateView, ExtWebhookDetailView,
    ExtWebhookTestView, ExtWebhookLogsView, ExtAPIKeyInfoView,
    APIKeyManageView, APIKeyDetailManageView,
)
from .gdpr_views import (
    CandidateGDPRConsentView,
    CandidateGDPRAnonymizeView,
    CandidateGDPRExportView,
    GDPRSettingsView,
    GDPRExpiringCandidatesView,
    GDPRRunCleanupView,
)
from .tasks_views import (
    TaskListCreateView, TaskDetailView, AssignTaskView,
    CandidateTasksView, TaskSubmitView, TaskAutoCheckView, TaskReviewView,
)
from .views import di_analytics, anonymous_candidate, predictive_analytics
from .views import beta_status, beta_apply, beta_applications_list, beta_application_review, beta_config_view

router = DefaultRouter()
router.register(r'candidates',        CandidateViewSet,       basename='candidate')
router.register(r'vacancies',         VacancyViewSet,         basename='vacancy')
router.register(r'vacancy-templates', VacancyTemplateViewSet, basename='vacancy-template')
router.register(r'vacancy-stages',    VacancyStageViewSet,    basename='vacancy-stage')
router.register(r'organizations',     OrganizationViewSet,    basename='organization')
router.register(r'users',             UserListView,           basename='users')
router.register(r'email-templates',   EmailTemplateViewSet,   basename='email-template')
router.register(r'sent-emails',       SentEmailViewSet,       basename='sent-emails')
router.register(r'tags',              TagViewSet,             basename='tag')
router.register(r'interviews',        InterviewViewSet,       basename='interview')
router.register(r'blacklist',         BlacklistViewSet,       basename='blacklist')
router.register(r'holiday-themes',    HolidayThemeViewSet)
router.register(r'pricing-config',    PricingConfigViewSet)
router.register(r'promo-codes',       PromoCodeViewSet)
router.register(r'rejection-reasons', RejectionReasonViewSet, basename='rejection-reason')
router.register(r'moderator-notes',   ModeratorNoteViewSet,   basename='moderator-note')  # ← НОВЕ


urlpatterns = [
    path('candidates/export/',          CandidateExportCSVView.as_view(),                         name='candidates-export'),
    path('candidates/check-duplicate/', CandidateViewSet.as_view({'post': 'check_duplicate'}),    name='candidate-check-duplicate'),
    path('candidates/import-csv/',      CandidateViewSet.as_view({'post': 'import_csv'}),         name='candidate-import-csv'),

    path('vacancies/feed/rabota-ua/',   vacancy_feed_rabota_ua,                                   name='feed-rabota-ua'),
    path('vacancies/feed/work-ua/',     vacancy_feed_work_ua,                                     name='feed-work-ua'),

    path('webhooks/work-ua/',           work_ua_webhook,                                          name='webhook-work-ua'),
    path('webhooks/job-application/',   job_board_application_webhook,                            name='webhook-job-application'),

    path('', include(router.urls)),
    path('me/', current_user, name='current-user'),
    path('users-detail/<int:pk>/', UserListView.as_view({'patch': 'partial_update', 'delete': 'destroy'}), name='user-detail'),

    path('analytics/time-to-hire/',                          time_to_hire_analytics,           name='time-to-hire'),
    path('analytics/time-to-hire/candidate/<int:candidate_id>/', candidate_time_to_hire_detail, name='time-to-hire-candidate'),
    path('analytics/time-to-hire/export/',                   export_time_to_hire_csv,          name='time-to-hire-export'),
    path('analytics/time-to-hire/export-excel/',             export_time_to_hire_excel,        name='time-to-hire-export-excel'),
    path('analytics/time-to-hire/export-pdf/',               export_time_to_hire_pdf,          name='time-to-hire-export-pdf'),
    path('analytics/hr-effectiveness/',                      hr_effectiveness_analytics,       name='hr-effectiveness'),
    path('analytics/hr-effectiveness/export/',               export_hr_effectiveness_csv,      name='hr-effectiveness-export'),
    path('analytics/hr-effectiveness/export-excel/',         export_hr_effectiveness_excel,    name='hr-effectiveness-export-excel'),
    path('analytics/hr-effectiveness/export-pdf/',           export_hr_effectiveness_pdf,      name='hr-effectiveness-export-pdf'),
    path('analytics/export-full-excel/',                     export_full_report_excel,         name='full-report-export-excel'),
    path('analytics/export-full-pdf/',                       export_full_report_pdf,           name='full-report-export-pdf'),
    path('analytics/rejection-reasons/',                     rejection_analytics,              name='rejection-analytics'),
    path('analytics/monthly-trend/',                         monthly_trend_analytics,          name='monthly-trend'),
    path('public/pricing/', public_pricing, name='public_pricing'),
    path('audit-log/', AuditLogView.as_view(), name='audit-log'),
    path('register/', RegisterView.as_view(), name='register'),

    path('analytics/predictive/',     predictive_analytics,       name='predictive-analytics'),

    path('google-auth-status/', google_auth_status, name='google-auth-status'),

    # ── Moderator actions (block/unblock) — router автоматично генерує:
    # POST /api/candidates/<id>/block/
    # POST /api/candidates/<id>/unblock/
    # POST /api/vacancies/<id>/block/
    # POST /api/vacancies/<id>/unblock/
    # GET/POST /api/moderator-notes/
    # GET/PATCH/DELETE /api/moderator-notes/<id>/

    # ── External REST API (авт. по API Key: Authorization: Bearer ida_...) ──
    path('v1/ext/me/',                                  ExtAPIKeyInfoView.as_view(),        name='ext-me'),
    path('v1/ext/vacancies/',                           ExtVacancyListView.as_view(),       name='ext-vacancies'),
    path('v1/ext/vacancies/<int:pk>/',                  ExtVacancyDetailView.as_view(),     name='ext-vacancy-detail'),
    path('v1/ext/candidates/',                          ExtCandidateCreateView.as_view(),   name='ext-candidate-create'),
    path('v1/ext/candidates/<int:pk>/status/',          ExtCandidateStatusView.as_view(),   name='ext-candidate-status'),
    path('v1/ext/webhooks/',                            ExtWebhookListCreateView.as_view(), name='ext-webhooks'),
    path('v1/ext/webhooks/<int:pk>/',                   ExtWebhookDetailView.as_view(),     name='ext-webhook-detail'),
    path('v1/ext/webhooks/<int:pk>/test/',              ExtWebhookTestView.as_view(),       name='ext-webhook-test'),
    path('v1/ext/webhooks/<int:pk>/logs/',              ExtWebhookLogsView.as_view(),       name='ext-webhook-logs'),

    # ── Internal API Keys management (авт. по JWT, тільки Admin/SuperAdmin) ──
    path('internal/api-keys/',          APIKeyManageView.as_view(),       name='api-keys-list'),
    path('internal/api-keys/<int:pk>/', APIKeyDetailManageView.as_view(), name='api-keys-detail'),

    # ── GDPR ──────────────────────────────────────────────────────────────────
    path('candidates/<int:pk>/gdpr/consent/',   CandidateGDPRConsentView.as_view(),   name='gdpr-consent'),
    path('candidates/<int:pk>/gdpr/anonymize/', CandidateGDPRAnonymizeView.as_view(), name='gdpr-anonymize'),
    path('candidates/<int:pk>/gdpr/export/',    CandidateGDPRExportView.as_view(),    name='gdpr-export'),
    path('gdpr/settings/',                      GDPRSettingsView.as_view(),           name='gdpr-settings'),
    path('gdpr/candidates/expiring/',           GDPRExpiringCandidatesView.as_view(), name='gdpr-expiring'),
    path('gdpr/run-cleanup/',                   GDPRRunCleanupView.as_view(),         name='gdpr-cleanup'),

    # ── Skills / Tasks ────────────────────────────────────────────────────────
    path('tasks/',                                          TaskListCreateView.as_view(),  name='tasks-list'),
    path('tasks/<int:pk>/',                                 TaskDetailView.as_view(),      name='tasks-detail'),
    path('tasks/<int:task_id>/assign/<int:candidate_id>/',  AssignTaskView.as_view(),      name='tasks-assign'),
    path('candidates/<int:candidate_id>/tasks/',            CandidateTasksView.as_view(),  name='candidate-tasks'),
    path('task-assignments/<int:pk>/submit/',               TaskSubmitView.as_view(),      name='task-submit'),
    path('task-assignments/<int:pk>/check/',                TaskAutoCheckView.as_view(),   name='task-check'),
    path('task-assignments/<int:pk>/review/',               TaskReviewView.as_view(),      name='task-review'),

    # ── Diversity & Inclusion ─────────────────────────────────────────────────
    path('analytics/di/',                    di_analytics,        name='di-analytics'),
    path('candidates/<int:pk>/anonymous/',   anonymous_candidate, name='candidate-anonymous'),

    # ── Beta Testing ──────────────────────────────────────────────────────────
    # Public (без авторизації)
    path('public/beta-status/', beta_status, name='beta_status'),
    path('public/beta-apply/',  beta_apply,  name='beta_apply'),
    # Superadmin
    path('beta/applications/',                       beta_applications_list,  name='beta_applications_list'),
    path('beta/applications/<int:app_id>/review/',   beta_application_review, name='beta_application_review'),
    path('beta/config/',                             beta_config_view,        name='beta_config'),
]