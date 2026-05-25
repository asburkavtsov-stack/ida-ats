from candidates.models import Interview, Candidate, Vacancy
from django.contrib.auth import get_user_model
from candidates.serializers import InterviewSerializer

User = get_user_model()

print("=== Перевірка об'єктів ===")
try:
    c = Candidate.objects.get(pk=1)
    print(f"candidate: {c} (org={c.organization_id})")
except Exception as e:
    print(f"candidate ERROR: {e}")

try:
    v = Vacancy.objects.get(pk=2)
    print(f"vacancy: {v} (org={v.organization_id})")
except Exception as e:
    print(f"vacancy ERROR: {e}")

try:
    u = User.objects.get(pk=3)
    print(f"interviewer: {u}")
except Exception as e:
    print(f"interviewer ERROR: {e}")

print("\n=== Тест серіалізатора ===")
data = {
    "title": "IDA",
    "candidate": 1,
    "interview_type": "online",
    "status": "scheduled",
    "scheduled_at": "2026-05-22T13:50:00.000Z",
    "duration_minutes": 60,
    "interviewer_ids": [3],
    "vacancy": 2
}
s = InterviewSerializer(data=data)
print("is_valid:", s.is_valid())
print("errors:", s.errors)