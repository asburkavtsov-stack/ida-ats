from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import re
import secrets
import hashlib


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

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='stages')
    vacancy = models.ForeignKey('Vacancy', on_delete=models.CASCADE, null=True, blank=True, related_name='stages')
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=7, default='#7a1a2e')
    order = models.PositiveIntegerField(default=0)
    system_key = models.CharField(max_length=20, choices=SYSTEM_KEY_CHOICES, null=True, blank=True, db_index=True)
    is_terminal = models.BooleanField(default=False, help_text='Фінальний етап (Відмова, Найнятий тощо)')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        scope = f"вакансія #{self.vacancy_id}" if self.vacancy_id else f"орг #{self.organization_id}"
        return f"{self.name} [{scope}]"

    @classmethod
    def get_for_vacancy(cls, vacancy):
        vacancy_stages = cls.objects.filter(vacancy=vacancy).order_by('order', 'id')
        if vacancy_stages.exists():
            return vacancy_stages
        return cls.objects.filter(organization=vacancy.organization, vacancy=None).order_by('order', 'id')

    @classmethod
    def create_defaults_for_org(cls, organization):
        if cls.objects.filter(organization=organization, vacancy=None).exists():
            return
        for s in DEFAULT_STAGES:
            cls.objects.create(
                organization=organization, vacancy=None,
                name=s['name'], color=s['color'], order=s['order'],
                system_key=s['system_key'], is_terminal=s['system_key'] == 'rejected',
            )

    @classmethod
    def copy_org_template_to_vacancy(cls, vacancy):
        org_stages = cls.objects.filter(organization=vacancy.organization, vacancy=None).order_by('order', 'id')
        for s in org_stages:
            cls.objects.get_or_create(
                organization=vacancy.organization, vacancy=vacancy, name=s.name,
                defaults={'color': s.color, 'order': s.order, 'system_key': s.system_key, 'is_terminal': s.is_terminal},
            )


class Vacancy(models.Model):
    EMPLOYMENT_TYPE_CHOICES = [
        ('full_time',  'Повна зайнятість'),
        ('part_time',  'Часткова зайнятість'),
        ('volunteer',  'Волонтерство'),
        ('contract',   'Контракт'),
    ]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True)
    title = models.CharField(max_length=200)
    department = models.CharField(max_length=100)
    description = models.TextField(blank=True, verbose_name='Опис вакансії')
    requirements = models.TextField(blank=True, verbose_name='Вимоги')
    city = models.CharField(max_length=100, blank=True, verbose_name='Місто')
    employment_type = models.CharField(max_length=20, choices=EMPLOYMENT_TYPE_CHOICES, default='volunteer', blank=True)
    salary_min = models.PositiveIntegerField(null=True, blank=True)
    salary_max = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    published_rabota_ua = models.BooleanField(default=False)
    rabota_ua_vacancy_id = models.CharField(max_length=50, blank=True)
    published_at_rabota_ua = models.DateTimeField(null=True, blank=True)
    published_work_ua = models.BooleanField(default=False)
    work_ua_vacancy_id = models.CharField(max_length=50, blank=True)
    published_at_work_ua = models.DateTimeField(null=True, blank=True)
    published_dou = models.BooleanField(default=False)
    dou_vacancy_url = models.URLField(blank=True)
    published_at_dou = models.DateTimeField(null=True, blank=True)
    published_linkedin = models.BooleanField(default=False)
    linkedin_vacancy_url = models.URLField(blank=True)
    published_at_linkedin = models.DateTimeField(null=True, blank=True)

    owner = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='owned_vacancies',
        verbose_name='Відповідальний HR',
    )

    def __str__(self):
        return self.title


class VacancyTemplate(models.Model):
    CATEGORY_CHOICES = [
        ('it', 'IT'), ('sales', 'Sales'), ('marketing', 'Marketing'),
        ('hr', 'HR'), ('finance', 'Finance'), ('operations', 'Operations'),
        ('design', 'Design'), ('other', 'Інше'),
    ]
    EMPLOYMENT_TYPE_CHOICES = [
        ('full_time', 'Повна зайнятість'), ('part_time', 'Часткова зайнятість'),
        ('volunteer', 'Волонтерство'), ('contract', 'Контракт'),
    ]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='vacancy_templates')
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='other')
    title = models.CharField(max_length=200)
    department = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    requirements = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    employment_type = models.CharField(max_length=20, choices=EMPLOYMENT_TYPE_CHOICES, default='volunteer', blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Шаблон вакансії'
        verbose_name_plural = 'Шаблони вакансій'
        ordering = ['category', 'name']

    def __str__(self):
        return f"[{self.get_category_display()}] {self.name}"


def normalize_phone(phone):
    if not phone:
        return ''
    return re.sub(r'\D', '', phone)


class Candidate(models.Model):
    SOURCE_CHOICES = [
        ('linkedin', 'LinkedIn'), ('dou', 'DOU'), ('work_ua', 'work.ua'),
        ('rabota_ua', 'rabota.ua'), ('recommendation', 'Рекомендація'),
        ('csv', 'CSV'), ('direct', 'Прямий відгук'), ('other', 'Інше'),
    ]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    vacancy = models.ForeignKey(Vacancy, on_delete=models.SET_NULL, null=True)
    stage = models.ForeignKey(VacancyStage, on_delete=models.SET_NULL, null=True, blank=True, related_name='candidates')
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='other', blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_candidates')
    tags = models.ManyToManyField(Tag, blank=True, related_name='candidates')

    # ── GDPR ────────────────────────────────────────────────────────────────────
    gdpr_consent         = models.BooleanField(default=False, help_text='Кандидат надав згоду на обробку персональних даних')
    gdpr_consent_date    = models.DateTimeField(null=True, blank=True, help_text='Дата надання згоди')
    gdpr_consent_text    = models.TextField(blank=True, help_text='Текст згоди на момент підписання')
    gdpr_consent_ip      = models.GenericIPAddressField(null=True, blank=True, help_text='IP-адреса при наданні згоди')
    gdpr_withdraw_date   = models.DateTimeField(null=True, blank=True, help_text='Дата відкликання згоди')
    gdpr_delete_after    = models.DateField(null=True, blank=True, help_text='Дата автовидалення (розраховується з consent_date + retention period)')
    gdpr_anonymized      = models.BooleanField(default=False, help_text='Персональні дані анонімізовані')
    gdpr_anonymized_at   = models.DateTimeField(null=True, blank=True)

    # ── Diversity & Inclusion ────────────────────────────────────────────────────
    di_gender = models.CharField(
        max_length=20, blank=True,
        choices=[
            ('male','Чоловік'),('female','Жінка'),('non_binary','Небінарний/а'),
            ('prefer_not','Не хочу вказувати'),('other','Інше'),
        ],
    )
    di_disability = models.BooleanField(null=True, blank=True)
    di_veteran    = models.BooleanField(null=True, blank=True)
    di_age_range  = models.CharField(
        max_length=10, blank=True,
        choices=[
            ('18-24','18–24'),('25-34','25–34'),('35-44','35–44'),
            ('45-54','45–54'),('55+','55+'),('prefer_not','Не вказувати'),
        ],
    )
    di_consent = models.BooleanField(
        default=False,
        help_text='Окрема згода на збір D&I даних (GDPR)',
    )

    class Meta:
        unique_together = [('email', 'organization')]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

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

    def anonymize(self):
        """Анонімізує персональні дані кандидата (GDPR право на забуття)."""
        import uuid
        uid = str(uuid.uuid4())[:8]
        self.first_name        = 'Анонім'
        self.last_name         = uid
        self.email             = f'deleted_{uid}@gdpr.local'
        self.phone             = ''
        self.notes             = ''
        self.gdpr_anonymized   = True
        self.gdpr_anonymized_at = timezone.now()
        self.save(update_fields=[
            'first_name', 'last_name', 'email', 'phone', 'notes',
            'gdpr_anonymized', 'gdpr_anonymized_at',
        ])

    def grant_consent(self, consent_text='', ip_address=None):
        """Записує GDPR-згоду кандидата."""
        from datetime import timedelta
        self.gdpr_consent      = True
        self.gdpr_consent_date = timezone.now()
        self.gdpr_consent_text = consent_text
        self.gdpr_consent_ip   = ip_address
        self.gdpr_withdraw_date = None
        # Розраховуємо дату видалення з налаштувань організації
        retention_days = 365
        if self.organization:
            try:
                retention_days = self.organization.gdpr_settings.retention_days
            except Exception:
                pass
        self.gdpr_delete_after = (timezone.now() + timedelta(days=retention_days)).date()
        self.save(update_fields=[
            'gdpr_consent', 'gdpr_consent_date', 'gdpr_consent_text',
            'gdpr_consent_ip', 'gdpr_withdraw_date', 'gdpr_delete_after',
        ])

    def withdraw_consent(self):
        """Відкликає GDPR-згоду."""
        self.gdpr_consent       = False
        self.gdpr_withdraw_date = timezone.now()
        self.save(update_fields=['gdpr_consent', 'gdpr_withdraw_date'])


REJECTION_REASON_CHOICES = [
    ('insufficient_experience',   'Недостатній досвід'),
    ('high_salary_expectations',  'Високі зарплатні очікування'),
    ('failed_technical',          'Не пройшов технічну співбесіду'),
    ('declined_offer',            'Відмовився від оферу'),
    ('failed_soft_skills',        'Не відповідає корпоративній культурі'),
    ('no_response',               'Не вийшов на зв\'язок'),
    ('position_closed',           'Вакансія закрита'),
    ('overqualified',             'Завищена кваліфікація'),
    ('other',                     'Інша причина'),
]


class RejectionReason(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='rejection_reasons')
    name = models.CharField(max_length=200)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'name']
        unique_together = [('organization', 'name')]

    def __str__(self):
        return self.name

    @classmethod
    def get_or_create_defaults(cls, organization):
        if cls.objects.filter(organization=organization).exists():
            return
        defaults = [n for _, n in REJECTION_REASON_CHOICES]
        for i, name in enumerate(defaults):
            cls.objects.create(
                organization=organization, name=name,
                is_default=True, order=i,
            )


class StatusHistory(models.Model):
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='status_history')
    old_stage = models.ForeignKey(VacancyStage, on_delete=models.SET_NULL, null=True, blank=True, related_name='history_from')
    new_stage = models.ForeignKey(VacancyStage, on_delete=models.SET_NULL, null=True, blank=True, related_name='history_to')
    old_status = models.CharField(max_length=100, blank=True, null=True)
    new_status = models.CharField(max_length=100)
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)
    rejection_reason = models.ForeignKey(
        'RejectionReason', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='status_history'
    )
    rejection_comment = models.TextField(blank=True)

    class Meta:
        ordering = ['-changed_at']

    def __str__(self):
        return f"{self.candidate} {self.old_status} → {self.new_status}"


class EmailTemplate(models.Model):
    TEMPLATE_TYPES = [
        ('interview', "Запрошення на інтерв'ю"),
        ('rejection', 'Відмова'),
        ('offer', 'Оффер'),
    ]
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='email_templates')
    template_type = models.CharField(max_length=20, choices=TEMPLATE_TYPES)
    subject = models.CharField(max_length=300, default='')
    body = models.TextField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('organization', 'template_type')]
        ordering = ['template_type']

    def __str__(self):
        return f"{self.organization.name} — {self.get_template_type_display()}"


class SentEmail(models.Model):
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='sent_emails')
    template = models.ForeignKey(EmailTemplate, on_delete=models.SET_NULL, null=True, blank=True)
    recipient_email = models.EmailField()
    subject = models.CharField(max_length=300)
    body = models.TextField()
    sent_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='sent_emails')
    sent_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, default='sent', choices=[
        ('sent', 'Відправлено'), ('failed', 'Помилка'), ('pending', 'Відправляється'),
    ])
    error_message = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-sent_at']

    def __str__(self):
        return f"{self.subject} -> {self.recipient_email} ({self.sent_at})"


class Interview(models.Model):
    INTERVIEW_TYPE_CHOICES = [('online', 'Онлайн'), ('offline', 'Офлайн')]
    STATUS_CHOICES = [
        ('scheduled', 'Заплановано'), ('completed', 'Проведено'),
        ('cancelled', 'Скасовано'), ('rescheduled', 'Перенесено'),
    ]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='interviews')
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='interviews')
    vacancy = models.ForeignKey(Vacancy, on_delete=models.SET_NULL, null=True, blank=True, related_name='interviews')
    title = models.CharField(max_length=255)
    interview_type = models.CharField(max_length=10, choices=INTERVIEW_TYPE_CHOICES, default='online')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='scheduled')
    scheduled_at = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(default=60)
    location = models.CharField(max_length=500, blank=True)
    notes = models.TextField(blank=True)
    interviewers = models.ManyToManyField(User, blank=True, related_name='interviews_as_interviewer')
    google_event_id = models.CharField(max_length=255, blank=True)
    google_meet_link = models.URLField(blank=True)
    google_calendar_link = models.URLField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_interviews')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['scheduled_at']

    def __str__(self):
        return f"{self.title} — {self.candidate} ({self.scheduled_at.strftime('%d.%m.%Y %H:%M')})"


class BlacklistedOrganization(models.Model):
    name = models.CharField(max_length=200, unique=True)
    reason = models.TextField(blank=True)
    added_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Заблокована організація'
        verbose_name_plural = 'Заблоковані організації'
        ordering = ['-created_at']

    def __str__(self):
        return self.name


# ==============================================================================
# НОВІ МОДЕЛІ ДЛЯ LED-ТЕМ, ЦІН ТА ПРОМО-КОДІВ
# ==============================================================================

class HolidayTheme(models.Model):
    """Тематичне оформлення (лединг) для головної сторінки та інтерфейсу"""
    THEME_TYPES = [
        ('new_year', 'Новорічний'),
        ('halloween', 'Хеллоуїн'),
        ('independence', 'День Незалежності'),
        ('ida_birthday', 'День народження ІДА'),
        ('default', 'Звичайний'),
    ]

    theme_type = models.CharField(max_length=20, choices=THEME_TYPES, unique=True)
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=False)

    css_variables = models.JSONField(default=dict)
    hero_image = models.URLField(blank=True)
    background_image = models.URLField(blank=True)

    primary_color = models.CharField(max_length=7, default='#7a1a2e')
    secondary_color = models.CharField(max_length=7, default='#4a0f1c')
    accent_color = models.CharField(max_length=7, default='#e8a0b0')

    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Тематичне оформлення'
        verbose_name_plural = 'Тематичні оформлення'
        ordering = ['theme_type']

    def __str__(self):
        return f"{self.get_theme_type_display()} - {self.name}"

    def save(self, *args, **kwargs):
        if self.is_active:
            HolidayTheme.objects.exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)

    @classmethod
    def get_active_theme(cls):
        theme = cls.objects.filter(is_active=True).first()
        if not theme:
            theme = cls.objects.filter(theme_type='default').first()
            if not theme:
                theme = cls.objects.create(
                    theme_type='default', name='Стандартна', is_active=True,
                    primary_color='#7a1a2e', secondary_color='#4a0f1c', accent_color='#e8a0b0'
                )
        return theme


class PricingConfig(models.Model):
    """Конфігурація цін для тарифних планів"""
    PLAN_CHOICES = [
        ('starter', 'Starter'),
        ('growth', 'Growth'),
        ('enterprise', 'Enterprise'),
    ]

    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, unique=True)
    name = models.CharField(max_length=100)
    price_monthly = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    price_yearly = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_percent = models.PositiveIntegerField(default=0)
    discount_valid_until = models.DateTimeField(null=True, blank=True)

    max_hr = models.IntegerField(default=3)
    max_vacancies = models.IntegerField(default=10)

    has_analytics = models.BooleanField(default=False)
    has_email_templates = models.BooleanField(default=False)
    has_google_integration = models.BooleanField(default=False)
    has_custom_stages = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Конфігурація цін'
        verbose_name_plural = 'Конфігурації цін'

    def __str__(self):
        return f"{self.get_plan_display()} - {self.price_monthly} грн/міс"

    def get_current_price(self):
        price = self.price_monthly
        if self.discount_percent and self.discount_valid_until and self.discount_valid_until > timezone.now():
            price = price * (100 - self.discount_percent) / 100
        return round(price, 2)

    @classmethod
    def get_all_prices(cls):
        prices = {}
        for plan_code, plan_name in cls.PLAN_CHOICES:
            config = cls.objects.filter(plan=plan_code, is_active=True).first()
            if config:
                prices[plan_code] = {
                    'monthly': float(config.get_current_price()),
                    'yearly': float(config.price_yearly),
                    'discount': config.discount_percent,
                    'discount_valid_until': config.discount_valid_until,
                    'limits': {'max_hr': config.max_hr, 'max_vacancies': config.max_vacancies},
                    'features': {
                        'analytics': config.has_analytics,
                        'email_templates': config.has_email_templates,
                        'google_integration': config.has_google_integration,
                        'custom_stages': config.has_custom_stages,
                    }
                }
        return prices


class PromoCode(models.Model):
    """Промо-коди для знижок"""
    DISCOUNT_TYPE_CHOICES = [
        ('percent', 'Відсоток'),
        ('fixed', 'Фіксована сума'),
    ]

    code = models.CharField(max_length=50, unique=True, db_index=True)
    discount_type = models.CharField(max_length=10, choices=DISCOUNT_TYPE_CHOICES, default='percent')
    discount_value = models.PositiveIntegerField()
    applicable_plans = models.JSONField(default=list, blank=True)
    max_uses = models.PositiveIntegerField(default=1)
    used_count = models.PositiveIntegerField(default=0)
    max_uses_per_user = models.PositiveIntegerField(default=1)
    valid_from = models.DateTimeField(default=timezone.now)
    valid_until = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Промо-код'
        verbose_name_plural = 'Промо-коди'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.code} - {self.discount_value}{'%' if self.discount_type == 'percent' else 'грн'}"

    def is_valid(self, plan=None):
        if not self.is_active:
            return False, "Промо-код неактивний"
        if self.used_count >= self.max_uses:
            return False, "Промо-код вже використано максимальну кількість разів"
        now = timezone.now()
        if self.valid_from and now < self.valid_from:
            return False, "Промо-код ще не активний"
        if self.valid_until and now > self.valid_until:
            return False, "Термін дії промо-коду закінчився"
        if plan and self.applicable_plans and plan not in self.applicable_plans:
            return False, f"Промо-код не застосовується до плану {plan}"
        return True, "Дійсний"

    def apply_discount(self, original_price):
        if self.discount_type == 'percent':
            return original_price * (100 - self.discount_value) / 100
        return max(0, original_price - self.discount_value)


class PromoCodeUsage(models.Model):
    """Історія використання промо-кодів"""
    promo_code = models.ForeignKey(PromoCode, on_delete=models.CASCADE, related_name='usages')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True)
    applied_to_plan = models.CharField(max_length=20)
    original_price = models.DecimalField(max_digits=10, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2)
    final_price = models.DecimalField(max_digits=10, decimal_places=2)
    used_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        verbose_name = 'Використання промо-коду'
        verbose_name_plural = 'Використання промо-кодів'
        ordering = ['-used_at']

    def __str__(self):
        return f"{self.promo_code.code} -> {self.user.email} ({self.used_at})"


class VacancyAccess(models.Model):
    """Делегований доступ HR до конкретної вакансії"""
    vacancy = models.ForeignKey(
        Vacancy, on_delete=models.CASCADE,
        related_name='shared_access',
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='vacancy_access',
    )
    granted_by = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='granted_access',
    )
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('vacancy', 'user')]
        verbose_name = 'Доступ до вакансії'
        verbose_name_plural = 'Делеговані доступи'

    def __str__(self):
        return f"{self.user.username} → {self.vacancy.title}"


class AuditLog(models.Model):
    ACTION_CHOICES = [
        ('view',          'Перегляд'),
        ('create',        'Створення'),
        ('update',        'Оновлення'),
        ('delete',        'Видалення'),
        ('status_change', 'Зміна статусу'),
        ('assign',        'Призначення'),
        ('export',        'Експорт'),
        ('access_grant',  'Надання доступу'),
        ('access_revoke', 'Відкликання доступу'),
    ]

    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True,
        related_name='audit_logs',
    )
    organization = models.ForeignKey(
        Organization, on_delete=models.SET_NULL, null=True,
        related_name='audit_logs',
    )
    action      = models.CharField(max_length=20, choices=ACTION_CHOICES)
    model_name  = models.CharField(max_length=50)
    object_id   = models.PositiveIntegerField(null=True, blank=True)
    object_repr = models.CharField(max_length=200, blank=True)
    extra_data  = models.JSONField(default=dict, blank=True)
    ip_address  = models.GenericIPAddressField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Лог дій'
        verbose_name_plural = 'Логи дій'
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['model_name', 'object_id']),
            models.Index(fields=['organization', 'created_at']),
        ]

    def __str__(self):
        return f"{self.user} — {self.action} {self.model_name} #{self.object_id}"


# ─── External API ─────────────────────────────────────────────────────────────

class ExternalAPIKey(models.Model):
    """API-ключ для зовнішніх інтеграцій. Прив'язаний до організації."""

    SCOPE_CHOICES = [
        ('read',  'Тільки читання'),
        ('write', 'Читання + запис'),
        ('full',  'Повний доступ'),
    ]

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE,
        related_name='api_keys',
    )
    name        = models.CharField(max_length=100)
    key_prefix  = models.CharField(max_length=8, db_index=True)
    key_hash    = models.CharField(max_length=64)
    scope       = models.CharField(max_length=10, choices=SCOPE_CHOICES, default='read')
    is_active   = models.BooleanField(default=True)
    created_by  = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_api_keys',
    )
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    expires_at   = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name        = 'API-ключ'
        verbose_name_plural = 'API-ключі'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} [{self.organization.name}]"

    @classmethod
    def generate(cls, organization, name, scope='read', created_by=None, expires_at=None):
        """
        Створює новий API-ключ.
        Повертає (instance, raw_key) — raw_key показується тільки один раз.
        """
        raw_key    = 'ida_' + secrets.token_urlsafe(32)
        key_hash   = hashlib.sha256(raw_key.encode()).hexdigest()
        key_prefix = raw_key[:8]
        instance   = cls.objects.create(
            organization=organization,
            name=name,
            scope=scope,
            key_prefix=key_prefix,
            key_hash=key_hash,
            created_by=created_by,
            expires_at=expires_at,
        )
        return instance, raw_key

    @classmethod
    def authenticate(cls, raw_key):
        """Перевіряє ключ. Повертає ExternalAPIKey або None."""
        if not raw_key or not raw_key.startswith('ida_'):
            return None
        prefix   = raw_key[:8]
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        try:
            api_key = cls.objects.select_related('organization').get(
                key_prefix=prefix,
                key_hash=key_hash,
                is_active=True,
            )
        except cls.DoesNotExist:
            return None
        if api_key.expires_at and api_key.expires_at < timezone.now():
            return None
        cls.objects.filter(pk=api_key.pk).update(last_used_at=timezone.now())
        return api_key

    def is_expired(self):
        return bool(self.expires_at and self.expires_at < timezone.now())


class WebhookEndpoint(models.Model):
    """Зовнішній URL, на який ATS надсилає події."""

    EVENT_CHOICES = [
        ('candidate.created',        'Новий кандидат'),
        ('candidate.status_changed', 'Зміна статусу кандидата'),
        ('candidate.hired',          'Кандидат найнятий'),
        ('candidate.rejected',       'Кандидат відхилений'),
        ('vacancy.created',          'Нова вакансія'),
        ('vacancy.closed',           'Вакансія закрита'),
    ]

    organization  = models.ForeignKey(
        Organization, on_delete=models.CASCADE,
        related_name='webhook_endpoints',
    )
    name          = models.CharField(max_length=100)
    url           = models.URLField(max_length=500)
    secret        = models.CharField(max_length=64, blank=True)
    events        = models.JSONField(default=list)
    is_active     = models.BooleanField(default=True)
    created_by    = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
    )
    created_at    = models.DateTimeField(auto_now_add=True)
    last_fired_at = models.DateTimeField(null=True, blank=True)
    fail_count    = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name        = 'Webhook'
        verbose_name_plural = 'Webhooks'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} → {self.url}"


class WebhookLog(models.Model):
    """Лог кожного виклику вебхука."""

    STATUS_CHOICES = [
        ('success', 'Успішно'),
        ('failed',  'Помилка'),
        ('timeout', 'Таймаут'),
    ]

    endpoint    = models.ForeignKey(
        WebhookEndpoint, on_delete=models.CASCADE,
        related_name='logs',
    )
    event       = models.CharField(max_length=50)
    payload     = models.JSONField()
    status      = models.CharField(max_length=10, choices=STATUS_CHOICES)
    http_status = models.PositiveIntegerField(null=True, blank=True)
    response    = models.TextField(blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    fired_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering            = ['-fired_at']
        verbose_name        = 'Webhook лог'
        verbose_name_plural = 'Webhook логи'

    def __str__(self):
        return f"{self.event} → {self.endpoint.url} [{self.status}]"


# ─── GDPR Settings ────────────────────────────────────────────────────────────

class GDPRSettings(models.Model):
    """Налаштування GDPR для організації."""

    organization     = models.OneToOneField(
        Organization, on_delete=models.CASCADE,
        related_name='gdpr_settings',
    )
    retention_days   = models.PositiveIntegerField(
        default=365,
        help_text='Скільки днів зберігати дані кандидата після надання згоди',
    )
    consent_text     = models.TextField(
        default=(
            'Я надаю згоду на обробку моїх персональних даних відповідно до '
            'Регламенту ЄС 2016/679 (GDPR) та законодавства України. '
            'Мої дані використовуватимуться виключно з метою розгляду моєї '
            'кандидатури на відкриті вакансії. Я маю право відкликати цю згоду '
            'в будь-який час, звернувшись до відповідального за обробку даних.'
        ),
        help_text='Текст згоди, який показується кандидатам',
    )
    auto_anonymize   = models.BooleanField(
        default=True,
        help_text='Автоматично анонімізувати кандидатів після закінчення терміну зберігання',
    )
    notify_before_days = models.PositiveIntegerField(
        default=30,
        help_text='За скільки днів до видалення надсилати сповіщення адміну',
    )
    dpo_email        = models.EmailField(
        blank=True,
        help_text='Email відповідального за захист даних (DPO)',
    )
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = 'GDPR налаштування'
        verbose_name_plural = 'GDPR налаштування'

    def __str__(self):
        return f"GDPR [{self.organization.name}] retention={self.retention_days}d"

# ─── Skills / Tasks ───────────────────────────────────────────────────────────

class Task(models.Model):
    TYPE_CHOICES = [
        ('code',   'Код (авто-перевірка)'),
        ('text',   'Текстова відповідь'),
        ('quiz',   'Тест з варіантами'),
        ('file',   'Завантаження файлу'),
        ('link',   'Посилання (GitHub, Figma)'),
    ]
    LANGUAGE_CHOICES = [
        ('python','Python'),('javascript','JavaScript'),('typescript','TypeScript'),
        ('java','Java'),('csharp','C#'),('cpp','C++'),('go','Go'),('rust','Rust'),
        ('sql','SQL'),('other','Інше'),
    ]

    organization     = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='tasks')
    vacancy          = models.ForeignKey('Vacancy', on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks')
    title            = models.CharField(max_length=200)
    description      = models.TextField()
    task_type        = models.CharField(max_length=20, choices=TYPE_CHOICES, default='text')
    language         = models.CharField(max_length=20, choices=LANGUAGE_CHOICES, blank=True)
    starter_code     = models.TextField(blank=True)
    solution_code    = models.TextField(blank=True)
    test_cases       = models.JSONField(default=list)
    time_limit_sec   = models.PositiveIntegerField(default=10)
    memory_limit_mb  = models.PositiveIntegerField(default=128)
    quiz_options     = models.JSONField(default=list)
    time_limit_minutes = models.PositiveIntegerField(default=60)
    max_score        = models.PositiveIntegerField(default=100)
    is_active        = models.BooleanField(default=True)
    created_by       = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Завдання'
        verbose_name_plural = 'Завдання'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.get_task_type_display()}] {self.title}"


class TaskAssignment(models.Model):
    STATUS_CHOICES = [
        ('pending',     'Очікує'),
        ('sent',        'Надіслано'),
        ('in_progress', 'Виконується'),
        ('submitted',   'Здано'),
        ('checking',    'Перевіряється'),
        ('passed',      'Пройдено'),
        ('failed',      'Не пройдено'),
        ('expired',     'Час вийшов'),
    ]

    task         = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='assignments')
    candidate    = models.ForeignKey('Candidate', on_delete=models.CASCADE, related_name='task_assignments')
    assigned_by  = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tasks')
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    score        = models.PositiveIntegerField(null=True, blank=True)
    max_score    = models.PositiveIntegerField(default=100)
    hr_comment   = models.TextField(blank=True)
    auto_result  = models.JSONField(null=True, blank=True)
    deadline     = models.DateTimeField(null=True, blank=True)
    sent_at      = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    checked_at   = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Видача завдання'
        verbose_name_plural = 'Видачі завдань'
        ordering = ['-created_at']
        unique_together = [('task', 'candidate')]

    def __str__(self):
        return f"{self.task.title} → {self.candidate}"

    @property
    def is_expired(self):
        return (
            self.deadline and timezone.now() > self.deadline
            and self.status not in ('submitted','checking','passed','failed')
        )

    @property
    def score_percent(self):
        if self.score is None or not self.max_score:
            return None
        return round(self.score / self.max_score * 100)


class TaskSubmission(models.Model):
    assignment       = models.OneToOneField(TaskAssignment, on_delete=models.CASCADE, related_name='submission')
    text_answer      = models.TextField(blank=True)
    code_answer      = models.TextField(blank=True)
    selected_options = models.JSONField(default=list)
    file_url         = models.URLField(blank=True)
    link_url         = models.URLField(blank=True)
    run_result       = models.JSONField(null=True, blank=True)
    submitted_at     = models.DateTimeField(auto_now_add=True)
    ip_address       = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        verbose_name = 'Відповідь'
        verbose_name_plural = 'Відповіді'

    def __str__(self):
        return f"Submission: {self.assignment}"


class Task(models.Model):
    """Тестове завдання, яке HR прив'язує до вакансії."""

    TYPE_CHOICES = [
        ('code', 'Код (авто-перевірка)'),
        ('text', 'Текстова відповідь'),
        ('quiz', 'Тест з варіантами'),
        ('file', 'Завантаження файлу'),
        ('link', 'Посилання (GitHub, Figma, тощо)'),
    ]

    LANGUAGE_CHOICES = [
        ('python', 'Python'),
        ('javascript', 'JavaScript'),
        ('typescript', 'TypeScript'),
        ('java', 'Java'),
        ('csharp', 'C#'),
        ('cpp', 'C++'),
        ('go', 'Go'),
        ('rust', 'Rust'),
        ('sql', 'SQL'),
        ('other', 'Інше'),
    ]

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='tasks',
    )
    vacancy = models.ForeignKey(
        'Vacancy', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='tasks',
        help_text='Якщо вказано — завдання показується тільки для цієї вакансії',
    )
    title = models.CharField(max_length=200)
    description = models.TextField(help_text='Умова завдання (Markdown підтримується)')
    task_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='text')

    # Для code-завдань
    language = models.CharField(max_length=20, choices=LANGUAGE_CHOICES, blank=True)
    starter_code = models.TextField(blank=True, help_text='Початковий шаблон коду')
    solution_code = models.TextField(blank=True, help_text='Еталонний розв\'язок (не показується кандидату)')
    test_cases = models.JSONField(
        default=list,
        help_text='[{"input": "...", "expected_output": "...", "is_hidden": false}]',
    )
    time_limit_sec = models.PositiveIntegerField(default=10, help_text='Ліміт часу виконання (секунд)')
    memory_limit_mb = models.PositiveIntegerField(default=128, help_text='Ліміт пам\'яті (МБ)')

    # Для quiz-завдань
    quiz_options = models.JSONField(
        default=list,
        help_text='[{"text": "Варіант A", "is_correct": true}, ...]',
    )

    # Метадані
    time_limit_minutes = models.PositiveIntegerField(
        default=60,
        help_text='Максимальний час на виконання завдання кандидатом (хвилини)',
    )
    max_score = models.PositiveIntegerField(default=100)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Завдання'
        verbose_name_plural = 'Завдання'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.get_task_type_display()}] {self.title}"


class TaskAssignment(models.Model):
    """Прив'язка завдання до конкретного кандидата (видача завдання)."""

    STATUS_CHOICES = [
        ('pending', 'Очікує виконання'),
        ('sent', 'Надіслано кандидату'),
        ('in_progress', 'Виконується'),
        ('submitted', 'Здано на перевірку'),
        ('checking', 'Перевіряється'),
        ('passed', 'Пройдено'),
        ('failed', 'Не пройдено'),
        ('expired', 'Час вийшов'),
    ]

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='assignments')
    candidate = models.ForeignKey(
        'Candidate', on_delete=models.CASCADE, related_name='task_assignments',
    )
    assigned_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='assigned_tasks',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    score = models.PositiveIntegerField(null=True, blank=True)
    max_score = models.PositiveIntegerField(default=100)
    hr_comment = models.TextField(blank=True, help_text='Коментар HR після перевірки')
    auto_result = models.JSONField(
        null=True, blank=True,
        help_text='Результат авто-перевірки коду: {passed, failed, errors, execution_time}',
    )
    deadline = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    checked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Видача завдання'
        verbose_name_plural = 'Видачі завдань'
        ordering = ['-created_at']
        unique_together = [('task', 'candidate')]

    def __str__(self):
        return f"{self.task.title} → {self.candidate}"

    @property
    def is_expired(self):
        return (
                self.deadline
                and timezone.now() > self.deadline
                and self.status not in ('submitted', 'checking', 'passed', 'failed')
        )

    @property
    def score_percent(self):
        if self.score is None or not self.max_score:
            return None
        return round(self.score / self.max_score * 100)


class TaskSubmission(models.Model):
    """Відповідь кандидата на завдання."""

    assignment = models.OneToOneField(
        TaskAssignment, on_delete=models.CASCADE, related_name='submission',
    )
    # Текстова відповідь або код
    text_answer = models.TextField(blank=True)
    code_answer = models.TextField(blank=True)
    # Для quiz
    selected_options = models.JSONField(default=list)
    # Для file/link
    file_url = models.URLField(blank=True)
    link_url = models.URLField(blank=True)
    # Авто-результат виконання коду
    run_result = models.JSONField(null=True, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        verbose_name = 'Відповідь'
        verbose_name_plural = 'Відповіді'

    def __str__(self):
        return f"Submission: {self.assignment}"