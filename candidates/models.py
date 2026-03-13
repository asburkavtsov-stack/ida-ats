from django.db import models

class Vacancy(models.Model):
    title = models.CharField(max_length=200)
    department = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Candidate(models.Model):
    STATUS_CHOICES = [
        ('new', 'Новий'),
        ('screening', 'Скринінг'),
        ('interview', 'Співбесіда'),
        ('offer', 'Оффер'),
        ('rejected', 'Відмова'),
    ]

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    vacancy = models.ForeignKey(Vacancy, on_delete=models.SET_NULL, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"