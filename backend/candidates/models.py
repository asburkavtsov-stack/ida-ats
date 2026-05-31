from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
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


class StatusHistory(models.Model):
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='status_history')
    old_stage = models.ForeignKey(VacancyStage, on_delete=models.SET_NULL, null=True, blank=True, related_name='history_from')
    new_stage = models.ForeignKey(VacancyStage, on_delete=models.SET_NULL, null=True, blank=True, related_name='history_to')
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