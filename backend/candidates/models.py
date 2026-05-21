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


class Vacancy(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True)
    title = models.CharField(max_length=200)
    department = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


def normalize_phone(phone):
    """Нормалізує телефон: залишає тільки цифри."""
    if not phone:
        return ''
    return re.sub(r'\D', '', phone)


class Candidate(models.Model):
    STATUS_CHOICES = [
        ('new', 'Новий'),
        ('screening', 'Скринінг'),
        ('interview', 'Співбесіда'),
        ('offer', 'Оффер'),
        ('rejected', 'Відмова'),
    ]

    SOURCE_CHOICES = [
        ('linkedin', 'LinkedIn'),
        ('dou', 'DOU'),
        ('recommendation', 'Рекомендація'),
        ('csv', 'CSV'),
        ('direct', 'Прямий відгук'),
        ('other', 'Інше'),
    ]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    vacancy = models.ForeignKey(Vacancy, on_delete=models.SET_NULL, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new')
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='other', blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    assigned_to = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='assigned_candidates',
        verbose_name='Призначений HR'
    )

    tags = models.ManyToManyField(Tag, blank=True, related_name='candidates')

    class Meta:
        unique_together = [('email', 'organization')]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

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
        duplicates = qs.filter(email_q | phone_q).distinct()
        return duplicates


class StatusHistory(models.Model):
    candidate = models.ForeignKey(
        Candidate, on_delete=models.CASCADE, related_name='status_history'
    )
    old_status = models.CharField(max_length=20, blank=True, null=True)
    new_status = models.CharField(max_length=20)
    changed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-changed_at']

    def __str__(self):
        return f"{self.candidate} {self.old_status} → {self.new_status}"


class EmailTemplate(models.Model):
    TEMPLATE_TYPES = [
        ('interview', 'Запрошення на інтерв\'ю'),
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
        ('sent', 'Відправлено'),
        ('failed', 'Помилка'),
        ('pending', 'Відправляється'),
    ])
    error_message = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-sent_at']
        verbose_name = 'Відправлений email'
        verbose_name_plural = 'Відправлені emailи'

    def __str__(self):
        return f"{self.subject} -> {self.recipient_email} ({self.sent_at})"


class Interview(models.Model):
    INTERVIEW_TYPE_CHOICES = [
        ('online', 'Онлайн'),
        ('offline', 'Офлайн'),
    ]
    STATUS_CHOICES = [
        ('scheduled', 'Заплановано'),
        ('completed', 'Проведено'),
        ('cancelled', 'Скасовано'),
        ('rescheduled', 'Перенесено'),
    ]

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE,
        related_name='interviews'
    )
    candidate = models.ForeignKey(
        Candidate, on_delete=models.CASCADE,
        related_name='interviews'
    )
    vacancy = models.ForeignKey(
        Vacancy, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='interviews'
    )

    title = models.CharField(max_length=255)
    interview_type = models.CharField(
        max_length=10,
        choices=INTERVIEW_TYPE_CHOICES,
        default='online'
    )
    status = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default='scheduled'
    )

    scheduled_at = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(default=60)
    location = models.CharField(max_length=500, blank=True)
    notes = models.TextField(blank=True)

    interviewers = models.ManyToManyField(
        User,
        blank=True,
        related_name='interviews_as_interviewer'
    )

    # Google Calendar
    google_event_id = models.CharField(max_length=255, blank=True)
    google_meet_link = models.URLField(blank=True)
    google_calendar_link = models.URLField(blank=True)

    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_interviews'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['scheduled_at']
        verbose_name = "Інтерв'ю"
        verbose_name_plural = "Інтерв'ю"

    def __str__(self):
        return f"{self.title} — {self.candidate} ({self.scheduled_at.strftime('%d.%m.%Y %H:%M')})"