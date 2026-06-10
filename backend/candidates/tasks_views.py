import logging
import subprocess
import sys
import tempfile
import os
import json
import time

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Candidate, Task, TaskAssignment, TaskSubmission, Vacancy,
)

logger = logging.getLogger(__name__)


def _get_org(user):
    try:
        return user.profile.organization
    except Exception:
        return None


# ─── Серіалайзери ─────────────────────────────────────────────────────────────

from rest_framework import serializers


class TestCaseSerializer(serializers.Serializer):
    input = serializers.CharField(allow_blank=True)
    expected_output = serializers.CharField(allow_blank=True)
    is_hidden = serializers.BooleanField(default=False)


class QuizOptionSerializer(serializers.Serializer):
    text = serializers.CharField()
    is_correct = serializers.BooleanField(default=False)


class TaskSerializer(serializers.ModelSerializer):
    task_type_display = serializers.CharField(source='get_task_type_display', read_only=True)
    language_display = serializers.CharField(source='get_language_display', read_only=True)
    assignments_count = serializers.SerializerMethodField()
    vacancy_title = serializers.CharField(source='vacancy.title', read_only=True, default=None)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'task_type', 'task_type_display',
            'language', 'language_display', 'starter_code', 'test_cases',
            'quiz_options', 'time_limit_minutes', 'time_limit_sec',
            'memory_limit_mb', 'max_score', 'is_active',
            'vacancy', 'vacancy_title', 'assignments_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'assignments_count']
        # solution_code та solution_code НЕ повертаємо фронту

    def get_assignments_count(self, obj):
        return obj.assignments.count()


class TaskAssignmentSerializer(serializers.ModelSerializer):
    task_title = serializers.CharField(source='task.title', read_only=True)
    task_type = serializers.CharField(source='task.task_type', read_only=True)
    task_description = serializers.CharField(source='task.description', read_only=True)
    task_language = serializers.CharField(source='task.language', read_only=True)
    starter_code = serializers.CharField(source='task.starter_code', read_only=True)
    quiz_options = serializers.SerializerMethodField()
    time_limit_minutes = serializers.IntegerField(source='task.time_limit_minutes', read_only=True)
    max_score_task = serializers.IntegerField(source='task.max_score', read_only=True)
    candidate_name = serializers.SerializerMethodField()
    assigned_by_name = serializers.SerializerMethodField()
    score_percent = serializers.ReadOnlyField()
    is_expired = serializers.ReadOnlyField()
    submission = serializers.SerializerMethodField()

    class Meta:
        model = TaskAssignment
        fields = [
            'id', 'task', 'task_title', 'task_type', 'task_description',
            'task_language', 'starter_code', 'quiz_options', 'time_limit_minutes',
            'candidate', 'candidate_name',
            'assigned_by', 'assigned_by_name',
            'status', 'score', 'max_score', 'max_score_task', 'score_percent',
            'hr_comment', 'auto_result', 'is_expired',
            'deadline', 'sent_at', 'submitted_at', 'checked_at', 'created_at',
            'submission',
        ]
        read_only_fields = [
            'auto_result', 'submitted_at', 'checked_at', 'created_at',
            'score_percent', 'is_expired',
        ]

    def get_candidate_name(self, obj):
        return f"{obj.candidate.first_name} {obj.candidate.last_name}"

    def get_assigned_by_name(self, obj):
        if not obj.assigned_by:
            return None
        return obj.assigned_by.get_full_name() or obj.assigned_by.username

    def get_quiz_options(self, obj):
        # Для quiz — повертаємо варіанти БЕЗ поля is_correct
        opts = obj.task.quiz_options or []
        return [{'text': o['text']} for o in opts]

    def get_submission(self, obj):
        try:
            s = obj.submission
            return {
                'text_answer': s.text_answer,
                'code_answer': s.code_answer,
                'selected_options': s.selected_options,
                'link_url': s.link_url,
                'run_result': s.run_result,
                'submitted_at': s.submitted_at,
            }
        except Exception:
            return None


# ─── Авто-перевірка коду ──────────────────────────────────────────────────────

SUPPORTED_RUNNERS = {
    'python': {'cmd': [sys.executable], 'ext': '.py'},
    'javascript': {'cmd': ['node'], 'ext': '.js'},
    'typescript': {'cmd': ['npx', 'ts-node'], 'ext': '.ts'},
}


def run_code_safe(language, code, stdin_input='', time_limit=10, memory_limit_mb=128):
    """
    Виконує код у тимчасовому файлі з обмеженням часу.
    Повертає {'stdout': str, 'stderr': str, 'exit_code': int, 'timed_out': bool, 'execution_ms': int}
    """
    runner = SUPPORTED_RUNNERS.get(language)
    if not runner:
        return {
            'stdout': '', 'stderr': f'Мова {language} не підтримується для авто-запуску',
            'exit_code': -1, 'timed_out': False, 'execution_ms': 0,
        }

    with tempfile.NamedTemporaryFile(
            mode='w', suffix=runner['ext'], delete=False, encoding='utf-8'
    ) as f:
        f.write(code)
        tmp_path = f.name

    try:
        cmd = runner['cmd'] + [tmp_path]
        start = time.monotonic()
        try:
            result = subprocess.run(
                cmd,
                input=stdin_input,
                capture_output=True,
                text=True,
                timeout=time_limit,
                encoding='utf-8',
            )
            execution_ms = int((time.monotonic() - start) * 1000)
            return {
                'stdout': result.stdout.strip(),
                'stderr': result.stderr.strip()[:500],
                'exit_code': result.returncode,
                'timed_out': False,
                'execution_ms': execution_ms,
            }
        except subprocess.TimeoutExpired:
            return {
                'stdout': '', 'stderr': f'Час виконання перевищено ({time_limit}с)',
                'exit_code': -1, 'timed_out': True,
                'execution_ms': time_limit * 1000,
            }
    finally:
        os.unlink(tmp_path)


def auto_check_code(assignment):
    """
    Запускає код кандидата на всіх test cases завдання.
    Оновлює assignment.auto_result і повертає результат.
    """
    task = assignment.task
    try:
        submission = assignment.submission
        code = submission.code_answer
    except Exception:
        return {'error': 'Відповідь не знайдена'}

    if not code.strip():
        return {'error': 'Код порожній'}

    test_cases = task.test_cases or []
    if not test_cases:
        return {'error': 'Завдання не має тест-кейсів'}

    results = []
    passed = 0
    total = len(test_cases)

    for i, tc in enumerate(test_cases):
        expected = str(tc.get('expected_output', '')).strip()
        stdin = str(tc.get('input', ''))

        run = run_code_safe(
            language=task.language,
            code=code,
            stdin_input=stdin,
            time_limit=task.time_limit_sec,
        )

        actual = run['stdout']
        ok = (actual == expected) and not run['timed_out'] and run['exit_code'] == 0

        if ok:
            passed += 1

        # Приховані тест-кейси — не показуємо input/expected
        is_hidden = tc.get('is_hidden', False)
        results.append({
            'test_case': i + 1,
            'passed': ok,
            'timed_out': run['timed_out'],
            'execution_ms': run['execution_ms'],
            'input': stdin if not is_hidden else '🔒 прихований',
            'expected_output': expected if not is_hidden else '🔒 прихований',
            'actual_output': actual if not is_hidden else ('✓' if ok else '✗'),
            'stderr': run['stderr'] if not is_hidden else '',
        })

    score = round(passed / total * task.max_score) if total else 0
    passed_all = passed == total

    auto_result = {
        'passed': passed,
        'total': total,
        'passed_all': passed_all,
        'score': score,
        'results': results,
        'checked_at': timezone.now().isoformat(),
    }

    # Оновлюємо assignment
    assignment.auto_result = auto_result
    assignment.score = score
    assignment.status = 'passed' if passed_all else 'failed'
    assignment.checked_at = timezone.now()
    assignment.save(update_fields=['auto_result', 'score', 'status', 'checked_at'])

    return auto_result


# ─── Views ────────────────────────────────────────────────────────────────────

class TaskListCreateView(APIView):
    """
    GET  /api/tasks/         — список завдань організації
    POST /api/tasks/         — створити завдання

    Query params (GET):
        vacancy_id  — фільтр по вакансії
        task_type   — code | text | quiz | file | link
        is_active   — true/false
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = _get_org(request.user)
        qs = Task.objects.filter(organization=org)

        if request.query_params.get('vacancy_id'):
            qs = qs.filter(vacancy_id=request.query_params['vacancy_id'])
        if request.query_params.get('task_type'):
            qs = qs.filter(task_type=request.query_params['task_type'])
        if request.query_params.get('is_active') == 'false':
            qs = qs.filter(is_active=False)
        else:
            qs = qs.filter(is_active=True)

        return Response(TaskSerializer(qs, many=True).data)

    def post(self, request):
        org = _get_org(request.user)
        serializer = TaskSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=400)

        task = serializer.save(
            organization=org,
            created_by=request.user,
        )
        return Response(TaskSerializer(task).data, status=201)


class TaskDetailView(APIView):
    """
    GET    /api/tasks/<id>/
    PATCH  /api/tasks/<id>/
    DELETE /api/tasks/<id>/
    """
    permission_classes = [IsAuthenticated]

    def _get_task(self, pk, org):
        try:
            return Task.objects.get(pk=pk, organization=org)
        except Task.DoesNotExist:
            return None

    def get(self, request, pk):
        task = self._get_task(pk, _get_org(request.user))
        if not task:
            return Response({'error': 'Не знайдено'}, status=404)
        # Для деталей — повертаємо і solution_code (тільки для admin)
        data = TaskSerializer(task).data
        try:
            if request.user.profile.role in ('admin', 'superadmin'):
                data['solution_code'] = task.solution_code
        except Exception:
            pass
        return Response(data)

    def patch(self, request, pk):
        task = self._get_task(pk, _get_org(request.user))
        if not task:
            return Response({'error': 'Не знайдено'}, status=404)
        serializer = TaskSerializer(task, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=400)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        task = self._get_task(pk, _get_org(request.user))
        if not task:
            return Response({'error': 'Не знайдено'}, status=404)
        task.delete()
        return Response(status=204)


class AssignTaskView(APIView):
    """
    POST /api/tasks/<task_id>/assign/<candidate_id>/
    Видати завдання кандидату.

    Body (опціонально):
        { "deadline": "2025-07-01T12:00:00Z" }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, task_id, candidate_id):
        org = _get_org(request.user)
        try:
            task = Task.objects.get(pk=task_id, organization=org, is_active=True)
        except Task.DoesNotExist:
            return Response({'error': 'Завдання не знайдено'}, status=404)
        try:
            candidate = Candidate.objects.get(pk=candidate_id, organization=org)
        except Candidate.DoesNotExist:
            return Response({'error': 'Кандидата не знайдено'}, status=404)

        assignment, created = TaskAssignment.objects.get_or_create(
            task=task,
            candidate=candidate,
            defaults={
                'assigned_by': request.user,
                'deadline': request.data.get('deadline'),
                'max_score': task.max_score,
            }
        )

        if not created:
            return Response({
                'error': 'Завдання вже видано цьому кандидату',
                'assignment': TaskAssignmentSerializer(assignment).data,
            }, status=400)

        return Response(TaskAssignmentSerializer(assignment).data, status=201)


class CandidateTasksView(APIView):
    """
    GET /api/candidates/<candidate_id>/tasks/
    Всі завдання кандидата з результатами.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, candidate_id):
        org = _get_org(request.user)
        try:
            candidate = Candidate.objects.get(pk=candidate_id, organization=org)
        except Candidate.DoesNotExist:
            return Response({'error': 'Кандидата не знайдено'}, status=404)

        assignments = TaskAssignment.objects.filter(
            candidate=candidate,
        ).select_related('task', 'assigned_by').prefetch_related('submission')

        return Response(TaskAssignmentSerializer(assignments, many=True).data)


class TaskSubmitView(APIView):
    """
    POST /api/task-assignments/<id>/submit/
    Кандидат здає відповідь (або HR вводить за кандидата).

    Body:
        {
          "text_answer":       "...",   // для text-завдань
          "code_answer":       "...",   // для code-завдань
          "selected_options":  [0, 2],  // для quiz
          "link_url":          "https://github.com/...",
        }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        org = _get_org(request.user)
        try:
            assignment = TaskAssignment.objects.select_related(
                'task', 'candidate'
            ).get(pk=pk, candidate__organization=org)
        except TaskAssignment.DoesNotExist:
            return Response({'error': 'Не знайдено'}, status=404)

        if assignment.status in ('passed', 'failed'):
            return Response({'error': 'Завдання вже перевірено'}, status=400)

        # Оновлюємо або створюємо submission
        submission, _ = TaskSubmission.objects.update_or_create(
            assignment=assignment,
            defaults={
                'text_answer': request.data.get('text_answer', ''),
                'code_answer': request.data.get('code_answer', ''),
                'selected_options': request.data.get('selected_options', []),
                'link_url': request.data.get('link_url', ''),
                'ip_address': request.META.get('REMOTE_ADDR'),
            }
        )

        assignment.status = 'submitted'
        assignment.submitted_at = timezone.now()
        assignment.save(update_fields=['status', 'submitted_at'])

        # Якщо code — одразу запускаємо авто-перевірку
        if assignment.task.task_type == 'code' and assignment.task.test_cases:
            auto_result = auto_check_code(assignment)
            return Response({
                'submitted': True,
                'auto_checked': True,
                'auto_result': auto_result,
                'assignment': TaskAssignmentSerializer(assignment).data,
            })

        # Для quiz — авто-перевіряємо одразу
        if assignment.task.task_type == 'quiz':
            result = _check_quiz(assignment, submission)
            return Response({
                'submitted': True,
                'auto_checked': True,
                'quiz_result': result,
                'assignment': TaskAssignmentSerializer(assignment).data,
            })

        return Response({
            'submitted': True,
            'auto_checked': False,
            'assignment': TaskAssignmentSerializer(assignment).data,
        })


def _check_quiz(assignment, submission):
    """Перевіряє quiz-відповідь."""
    options = assignment.task.quiz_options or []
    correct_indices = {i for i, o in enumerate(options) if o.get('is_correct')}
    selected = set(submission.selected_options or [])
    correct = correct_indices == selected
    score = assignment.task.max_score if correct else 0

    assignment.score = score
    assignment.status = 'passed' if correct else 'failed'
    assignment.checked_at = timezone.now()
    assignment.auto_result = {
        'correct': correct,
        'correct_indices': list(correct_indices),
        'selected_indices': list(selected),
        'score': score,
    }
    assignment.save(update_fields=['score', 'status', 'checked_at', 'auto_result'])
    return assignment.auto_result


class TaskAutoCheckView(APIView):
    """
    POST /api/task-assignments/<id>/check/
    Ручний запуск авто-перевірки коду (для вже зданих завдань).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        org = _get_org(request.user)
        try:
            assignment = TaskAssignment.objects.select_related('task').get(
                pk=pk, candidate__organization=org,
            )
        except TaskAssignment.DoesNotExist:
            return Response({'error': 'Не знайдено'}, status=404)

        if assignment.task.task_type != 'code':
            return Response({'error': 'Авто-перевірка доступна тільки для code-завдань'}, status=400)

        if not hasattr(assignment, 'submission'):
            return Response({'error': 'Кандидат ще не здав відповідь'}, status=400)

        result = auto_check_code(assignment)
        return Response({
            'auto_result': result,
            'assignment': TaskAssignmentSerializer(assignment).data,
        })


class TaskReviewView(APIView):
    """
    PATCH /api/task-assignments/<id>/review/
    Ручна оцінка HR.

    Body:
        { "score": 85, "hr_comment": "Гарний код, але без обробки помилок" }
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        org = _get_org(request.user)
        try:
            assignment = TaskAssignment.objects.get(
                pk=pk, candidate__organization=org,
            )
        except TaskAssignment.DoesNotExist:
            return Response({'error': 'Не знайдено'}, status=404)

        score = request.data.get('score')
        if score is not None:
            try:
                score = int(score)
                if not (0 <= score <= assignment.max_score):
                    return Response({'error': f'Score має бути від 0 до {assignment.max_score}'}, status=400)
                assignment.score = score
            except (ValueError, TypeError):
                return Response({'error': 'Невірний формат score'}, status=400)

        if 'hr_comment' in request.data:
            assignment.hr_comment = request.data['hr_comment']

        if score is not None:
            passing_score = assignment.max_score * 0.6  # 60% — прохідний бал
            assignment.status = 'passed' if score >= passing_score else 'failed'
            assignment.checked_at = timezone.now()

        assignment.save()
        return Response(TaskAssignmentSerializer(assignment).data)
