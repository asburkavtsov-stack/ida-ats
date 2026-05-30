from django.db import models
from django.contrib.auth.models import User
import re


class Organization(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    is_active = models.BooleanField(default=True)
    max_hr = models.IntegerField(default=3)
    max_vacancies = models.IntegerField(default=10)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class UserProfile(models.Model):
    ROLE_CHOICES = [
        ('superadmin', 'Супер-адмін'),
        ('admin', 'Адмін організації'),
        ('hr', 'HR менеджер'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    organization = models.ForeignKey(Organization, on_delete=models.SET_NULL, null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='hr')

    def __str__(self):
        return f"{self.user.username} — {self.role}"


class Tag(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='tags')
    name = models.CharField(max_length=50)
    color = models.CharField(max_length=7, default='#7a1a2e')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('organization', 'name')]
        ordering = ['name']

    def __str__(self):
        return self.name


# ─── VacancyStage ─────────────────────────────────────────────────────────────
# Кастомні колонки канбану.
# vacancy=None  → шаблон організації (базовий пайплайн)
# vacancy=...   → override для конкретної вакансії
# system_key    → прив'язка до системної аналітики (new/offer/rejected/None)

DEFAULT_STAGES = [
    {'name': 'Новий',       'color': '#7a1a2e', 'order': 0, 'system_key': 'new'},
    {'name': 'Скринінг',    'color': '#b03050', 'order': 1, 'system_key': 'screening'},
    {'name': 'Співбесіда',  'color': '#8a3a5a', 'order': 2, 'system_key': 'interview'},
    {'name': 'Оффер',       'color': '#c2185b', 'order': 3, 'system_key': 'offer'},
    {'name': 'Відмова',     'color': '#757575', 'order': 4, 'system_key': 'rejected'},
]


class VacancyStage(models.Model):
    SYSTEM_KEY_CHOICES = [
        ('new',       'Новий'),
        ('screening', 'Скринінг'),
        ('interview', 'Співбесіда'),
        ('offer',     'Оффер'),
        ('rejected',  'Відмова'),
    ]

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='stages'
    )
    # null → шаблон орг; not null → override вакансії
    vacancy = models.ForeignKey(
        'Vacancy', on_delete=models.CASCADE,
        null=True, blank=True, related_name='stages'
    )

    name       = models.CharField(max_length=100)
    color      = models.CharField(max_length=7, default='#7a1a2e')
    order      = models.PositiveIntegerField(default=0)

    # Системний ключ — для аналітики і сумісності
    # None = кастомний стейдж без прив'язки до системного
    system_key = models.CharField(
        max_length=20, choices=SYSTEM_KEY_CHOICES,
        null=True, blank=True, db_index=True
    )
    is_terminal = models.BooleanField(
        default=False,
        help_text='Фінальний етап (Відмова, Найнятий тощо)'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'id']
        verbose_name        = 'Етап вакансії'
        verbose_name_plural = 'Етапи вакансій'

    def __str__(self):
        scope = f"вакансія #{self.vacancy_id}" if self.vacancy_id else f"орг #{self.organization_id}"
        return f"{self.name} [{scope}]"

    @classmethod
    def get_for_vacancy(cls, vacancy):
        """
        Повертає стейджі для вакансії:
        якщо є override — повертає їх, інакше — шаблон організації.
        """
        vacancy_stages = cls.objects.filter(vacancy=vacancy).order_by('order', 'id')
        if vacancy_stages.exists():
            return vacancy_stages
        return cls.objects.filter(
            organization=vacancy.organization, vacancy=None
        ).order_by('order', 'id')

    @classmethod
    def create_defaults_for_org(cls, organization):
        """Створює дефолтні стейджі для організації якщо їх ще немає."""
        if cls.objects.filter(organization=organization, vacancy=None).exists():
            return
        for s in DEFAULT_STAGES:
            cls.objects.create(
                organization=organization,
                vacancy=None,
                name=s['name'],
                color=s['color'],
                order=s['order'],
                system_key=s['system_key'],
                is_terminal=s['system_key'] == 'rejected',
            )

    @classmethod
    def copy_org_template_to_vacancy(cls, vacancy):
        """Копіює шаблон організації як override для конкретної вакансії."""
        org_stages = cls.objects.filter(
            organization=vacancy.organization, vacancy=None
        ).order_by('order', 'id')
        for s in org_stages:
            cls.objects.get_or_create(
                organization=vacancy.organization,
                vacancy=vacancy,
                name=s.name,
                defaults={
                    'color': s.color,
                    'order': s.order,
                    'system_key': s.system_key,
                    'is_terminal': s.is_terminal,
                }
            )


class Vacancy(models.Model):
    EMPLOYMENT_TYPE_CHOICES = [
        ('full_time',  'Повна зайнятість'),
        ('part_time',  'Часткова зайнятість'),
        ('volunteer',  'Волонтерство'),
        ('contract',   'Контракт'),
    ]

    organization     = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True)
    title            = models.CharField(max_length=200)
    department       = models.CharField(max_length=100)
    description      = models.TextField(blank=True, verbose_name='Опис вакансії')
    requirements     = models.TextField(blank=True, verbose_name='Вимоги')
    city             = models.CharField(max_length=100, blank=True, verbose_name='Місто')
    employment_type  = models.CharField(
        max_length=20, choices=EMPLOYMENT_TYPE_CHOICES,
        default='volunteer', blank=True, verbose_name='Тип зайнятості'
    )
    salary_min       = models.PositiveIntegerField(null=True, blank=True, verbose_name='Зарплата від')
    salary_max       = models.PositiveIntegerField(null=True, blank=True, verbose_name='Зарплата до')
    is_active        = models.BooleanField(default=True)
    created_at       = models.DateTimeField(auto_now_add=True)

    # --- Job board публікації ---
    published_rabota_ua     = models.BooleanField(default=False, verbose_name='rabota.ua')
    rabota_ua_vacancy_id    = models.CharField(max_length=50, blank=True)
    published_at_rabota_ua  = models.DateTimeField(null=True, blank=True)

    published_work_ua       = models.BooleanField(default=False, verbose_name='work.ua')
    work_ua_vacancy_id      = models.CharField(max_length=50, blank=True)
    published_at_work_ua    = models.DateTimeField(null=True, blank=True)

    published_dou           = models.BooleanField(default=False, verbose_name='DOU')
    dou_vacancy_url         = models.URLField(blank=True)
    published_at_dou        = models.DateTimeField(null=True, blank=True)

    published_linkedin      = models.BooleanField(default=False, verbose_name='LinkedIn')
    linkedin_vacancy_url    = models.URLField(blank=True)
    published_at_linkedin   = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.title

    @property
    def published_boards(self):
        boards = []
        if self.published_rabota_ua: boards.append('rabota_ua')
        if self.published_work_ua:   boards.append('work_ua')
        if self.published_dou:       boards.append('dou')
        if self.published_linkedin:  boards.append('linkedin')
        return boards


class VacancyTemplate(models.Model):
    CATEGORY_CHOICES = [
        ('it', 'IT'), ('sales', 'Sales'), ('marketing', 'Marketing'),
        ('hr', 'HR'), ('finance', 'Finance'), ('operations', 'Operations'),
        ('design', 'Design'), ('other', 'Інше'),
    ]
    EMPLOYMENT_TYPE_CHOICES = [
        ('full_time', 'Повна зайнятість'), ('part_time', 'Часткова зайнятість'),
        ('volunteer', 'Волонтерство'),     ('contract', 'Контракт'),
    ]

    organization    = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='vacancy_templates')
    name            = models.CharField(max_length=200, verbose_name='Назва шаблону')
    category        = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='other')
    title           = models.CharField(max_length=200)
    department      = models.CharField(max_length=100, blank=True)
    description     = models.TextField(blank=True)
    requirements    = models.TextField(blank=True)
    city            = models.CharField(max_length=100, blank=True)
    employment_type = models.CharField(max_length=20, choices=EMPLOYMENT_TYPE_CHOICES, default='volunteer', blank=True)
    is_active       = models.BooleanField(default=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = 'Шаблон вакансії'
        verbose_name_plural = 'Шаблони вакансій'
        ordering            = ['category', 'name']

    def __str__(self):
        return f"[{self.get_category_display()}] {self.name}"


def normalize_phone(phone):
    if not phone:
        return ''
    return re.sub(r'\D', '', phone)


class Candidate(models.Model):
    SOURCE_CHOICES = [
        ('linkedin', 'LinkedIn'), ('dou', 'DOU'),
        ('work_ua', 'work.ua'),   ('rabota_ua', 'rabota.ua'),
        ('recommendation', 'Рекомендація'), ('csv', 'CSV'),
        ('direct', 'Прямий відгук'), ('other', 'Інше'),
    ]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True)
    first_name   = models.CharField(max_length=100)
    last_name    = models.CharField(max_length=100)
    email        = models.EmailField()
    phone        = models.CharField(max_length=20, blank=True)
    vacancy      = models.ForeignKey(Vacancy, on_delete=models.SET_NULL, null=True)

    # ─── Новий stage FK замість status CharField ───────────────
    stage        = models.ForeignKey(
        VacancyStage, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='candidates',
        verbose_name='Етап'
    )

    source       = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='other', blank=True)
    notes        = models.TextField(blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    assigned_to  = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='assigned_candidates', verbose_name='Призначений HR'
    )
    tags = models.ManyToManyField(Tag, blank=True, related_name='candidates')

    class Meta:
        unique_together = [('email', 'organization')]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

    # Зворотна сумісність: .status повертає system_key або id стейджу
    @property
    def status(self):
        if self.stage:
            return self.stage.system_key or f'stage_{self.stage_id}'
        return 'new'

    @property
    def status_label(self):
        return self.stage.name if self.stage else 'Новий'

    def save(self, *args, **kwargs):
        if self.phone:
            self.phone = normalize_phone(self.phone)
        super().save(*args, **kwargs)

    def check_duplicate(self):
        from django.db.models import Q
        qs = Candidate.objects.filter(organization=self.organization)
        if self.pk:
            qs = qs.exclude(pk=self.pk)
        email_q = Q(email__iexact=self.email)
        phone_q = Q()
        if self.phone:
            phone_normalized = normalize_phone(self.phone)
            phone_q = Q(phone=phone_normalized) | Q(phone__iexact=self.phone)
        return qs.filter(email_q | phone_q).distinct()


class StatusHistory(models.Model):
    candidate  = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='status_history')
    old_stage  = models.ForeignKey(
        VacancyStage, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='history_from'
    )
    new_stage  = models.ForeignKey(
        VacancyStage, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='history_to'
    )
    # Зберігаємо назви для читабельності навіть якщо стейдж видалено
    old_status = models.CharField(max_length=100, blank=True, null=True)
    new_status = models.CharField(max_length=100)
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-changed_at']

    def __str__(self):
        return f"{self.candidate} {self.old_status} → {self.new_status}"


class EmailTemplate(models.Model):
    TEMPLATE_TYPES = [
        ('interview', "Запрошення на інтерв'ю"),
        ('rejection', 'Відмова'),
        ('offer',     'Оффер'),
    ]
    organization  = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='email_templates')
    template_type = models.CharField(max_length=20, choices=TEMPLATE_TYPES)
    subject       = models.CharField(max_length=300, default='')
    body          = models.TextField()
    is_active     = models.BooleanField(default=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('organization', 'template_type')]
        ordering        = ['template_type']

    def __str__(self):
        return f"{self.organization.name} — {self.get_template_type_display()}"


class SentEmail(models.Model):
    candidate       = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='sent_emails')
    template        = models.ForeignKey(EmailTemplate, on_delete=models.SET_NULL, null=True, blank=True)
    recipient_email = models.EmailField()
    subject         = models.CharField(max_length=300)
    body            = models.TextField()
    sent_by         = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='sent_emails')
    sent_at         = models.DateTimeField(auto_now_add=True)
    status          = models.CharField(max_length=20, default='sent', choices=[
        ('sent', 'Відправлено'), ('failed', 'Помилка'), ('pending', 'Відправляється'),
    ])
    error_message = models.TextField(blank=True, null=True)

    class Meta:
        ordering     = ['-sent_at']
        verbose_name = 'Відправлений email'
        verbose_name_plural = 'Відправлені emailи'

    def __str__(self):
        return f"{self.subject} -> {self.recipient_email} ({self.sent_at})"


class Interview(models.Model):
    INTERVIEW_TYPE_CHOICES = [('online', 'Онлайн'), ('offline', 'Офлайн')]
    STATUS_CHOICES = [
        ('scheduled',   'Заплановано'), ('completed', 'Проведено'),
        ('cancelled',   'Скасовано'),   ('rescheduled', 'Перенесено'),
    ]

    organization     = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='interviews')
    candidate        = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='interviews')
    vacancy          = models.ForeignKey(Vacancy, on_delete=models.SET_NULL, null=True, blank=True, related_name='interviews')
    title            = models.CharField(max_length=255)
    interview_type   = models.CharField(max_length=10, choices=INTERVIEW_TYPE_CHOICES, default='online')
    status           = models.CharField(max_length=15, choices=STATUS_CHOICES, default='scheduled')
    scheduled_at     = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(default=60)
    location         = models.CharField(max_length=500, blank=True)
    notes            = models.TextField(blank=True)
    interviewers     = models.ManyToManyField(User, blank=True, related_name='interviews_as_interviewer')
    google_event_id  = models.CharField(max_length=255, blank=True)
    google_meet_link = models.URLField(blank=True)
    google_calendar_link = models.URLField(blank=True)
    created_by       = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_interviews')
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        ordering            = ['scheduled_at']
        verbose_name        = "Інтерв'ю"
        verbose_name_plural = "Інтерв'ю"

    def __str__(self):
        return f"{self.title} — {self.candidate} ({self.scheduled_at.strftime('%d.%m.%Y %H:%M')})"


class BlacklistedOrganization(models.Model):
    name       = models.CharField(max_length=200, unique=True, verbose_name='Назва організації')
    reason     = models.TextField(blank=True, verbose_name='Причина')
    added_by   = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name        = 'Заблокована організація'
        verbose_name_plural = 'Заблоковані організації'
        ordering            = ['-created_at']

    def __str__(self):
        return self.name