# candidates/services/analytics_service.py
from typing import Dict, Any, List, Optional
from django.db.models import Q, Prefetch, QuerySet, Count
from django.core.cache import cache


class AnalyticsService:

    @staticmethod
    def _get_offer_stage_ids(queryset: QuerySet) -> List[int]:
        """IDs стейджів is_terminal=True (аналог 'offer')."""
        from candidates.models import VacancyStage
        org_ids = list(queryset.values_list('organization_id', flat=True).distinct())
        return list(
            VacancyStage.objects.filter(
                Q(is_terminal=True) & (
                    Q(vacancy__organization_id__in=org_ids) | Q(vacancy__isnull=True)
                )
            ).values_list('id', flat=True)
        )

    @staticmethod
    def _get_rejected_stage_ids(queryset: QuerySet) -> List[int]:
        """IDs стейджів system_key='rejected'."""
        from candidates.models import VacancyStage
        org_ids = list(queryset.values_list('organization_id', flat=True).distinct())
        return list(
            VacancyStage.objects.filter(
                Q(system_key='rejected') & (
                    Q(vacancy__organization_id__in=org_ids) | Q(vacancy__isnull=True)
                )
            ).values_list('id', flat=True)
        )

    @staticmethod
    def calculate_time_to_hire_data(
            queryset: QuerySet,
            date_from: Optional[str] = None,
            date_to: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        from candidates.models import StatusHistory

        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        terminal_stage_ids = AnalyticsService._get_offer_stage_ids(queryset)
        offer_filter = Q(stage_id__in=terminal_stage_ids) if terminal_stage_ids else Q(pk__in=[])

        candidates_with_offer = queryset.filter(offer_filter).select_related(
            'vacancy', 'assigned_to', 'stage'
        ).prefetch_related(
            Prefetch(
                'status_history',
                queryset=StatusHistory.objects.filter(
                    new_stage__is_terminal=True
                ).order_by('changed_at'),
                to_attr='offer_history'
            )
        )

        time_data = []
        for candidate in candidates_with_offer:
            new_time = candidate.created_at
            first_offer = candidate.offer_history[0] if candidate.offer_history else None

            if not first_offer:
                days = 0
                offer_date = candidate.created_at
            elif new_time:
                days = round((first_offer.changed_at - new_time).total_seconds() / 86400, 1)
                offer_date = first_offer.changed_at
            else:
                continue

            if days >= 0:
                time_data.append({
                    'candidate_id': candidate.id,
                    'candidate_name': f"{candidate.first_name} {candidate.last_name}",
                    'vacancy_id': candidate.vacancy_id,
                    'vacancy_title': candidate.vacancy.title if candidate.vacancy else '—',
                    'assigned_to_id': candidate.assigned_to_id,
                    'assigned_to_name': f"{candidate.assigned_to.first_name} {candidate.assigned_to.last_name}".strip() if candidate.assigned_to else None,
                    'days': days,
                    'new_date': new_time,
                    'offer_date': offer_date,
                })

        return time_data

    @staticmethod
    def calculate_statistics(time_data: List[Dict]) -> Dict[str, Any]:
        if not time_data:
            return {
                'overall_avg': None,
                'median': None,
                'total_offers': 0,
                'by_vacancy': [],
                'by_period': [],
                'distribution': [],
                'trend': [],
            }

        all_days = [d['days'] for d in time_data]
        overall_avg = round(sum(all_days) / len(all_days), 1)
        all_days_sorted = sorted(all_days)
        median = round(all_days_sorted[len(all_days_sorted) // 2], 1)

        vacancy_stats = {}
        for d in time_data:
            vid = d['vacancy_id']
            if vid not in vacancy_stats:
                vacancy_stats[vid] = {'vacancy_id': vid, 'vacancy_title': d['vacancy_title'], 'times': []}
            vacancy_stats[vid]['times'].append(d['days'])

        by_vacancy = []
        for vid, stat in vacancy_stats.items():
            times = stat['times']
            avg = round(sum(times) / len(times), 1)
            times_sorted = sorted(times)
            by_vacancy.append({
                'vacancy_id': vid,
                'vacancy_title': stat['vacancy_title'],
                'avg_days': avg,
                'median_days': round(times_sorted[len(times_sorted) // 2], 1),
                'offers_count': len(times),
                'min_days': round(min(times), 1),
                'max_days': round(max(times), 1),
            })
        by_vacancy.sort(key=lambda x: x['avg_days'])

        ranges = [
            ('0-7 днів', 0, 7), ('7-14 днів', 7, 14), ('14-30 днів', 14, 30),
            ('30-60 днів', 30, 60), ('60+ днів', 60, float('inf')),
        ]
        distribution = []
        for label, min_d, max_d in ranges:
            count = sum(1 for d in all_days if min_d <= d < max_d)
            distribution.append({
                'range': label,
                'count': count,
                'percentage': round(count / len(all_days) * 100, 1) if all_days else 0,
            })

        return {
            'overall_avg': overall_avg,
            'median': median,
            'total_offers': len(time_data),
            'by_vacancy': by_vacancy,
            'distribution': distribution,
            'time_data': time_data,
        }

    @staticmethod
    def calculate_monthly_trend(queryset: QuerySet) -> List[Dict[str, Any]]:
        from django.db.models.functions import TruncMonth
        from django.db.models import Count as DCount

        monthly = (
            queryset
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(total=DCount('id'))
            .order_by('month')
        )

        terminal_ids = AnalyticsService._get_offer_stage_ids(queryset)
        rejected_ids = AnalyticsService._get_rejected_stage_ids(queryset)

        offer_q = Q(stage_id__in=terminal_ids) if terminal_ids else Q(pk__in=[])
        rejected_q = Q(stage_id__in=rejected_ids) if rejected_ids else Q(pk__in=[])

        monthly_offers = (
            queryset.filter(offer_q)
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(total=DCount('id'))
            .order_by('month')
        )
        monthly_rejected = (
            queryset.filter(rejected_q)
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(total=DCount('id'))
            .order_by('month')
        )

        offers_map   = {str(r['month'])[:7]: r['total'] for r in monthly_offers   if r['month']}
        rejected_map = {str(r['month'])[:7]: r['total'] for r in monthly_rejected if r['month']}

        result = []
        for row in monthly:
            if not row['month']:
                continue
            month_key = str(row['month'])[:7]
            result.append({
                'month':    month_key,
                'label':    row['month'].strftime('%b %Y'),
                'total':    row['total'],
                'offers':   offers_map.get(month_key, 0),
                'rejected': rejected_map.get(month_key, 0),
            })
        return result

    @staticmethod
    def calculate_funnel_data(queryset: QuerySet) -> List[Dict[str, Any]]:
        from django.db.models import Count as DCount

        stages_data = (
            queryset
            .exclude(stage__isnull=True)
            .values('stage_id', 'stage__name', 'stage__color', 'stage__order', 'stage__is_terminal')
            .annotate(count=DCount('id'))
            .order_by('stage__order')
        )
        no_stage = queryset.filter(stage__isnull=True).count()

        result = []
        for row in stages_data:
            result.append({
                'stage_id':    row['stage_id'],
                'label':       row['stage__name'] or '—',
                'color':       row['stage__color'] or '#7a1a2e',
                'count':       row['count'],
                'is_terminal': row['stage__is_terminal'],
            })
        if no_stage > 0:
            result.append({
                'stage_id': None, 'label': 'Без етапу',
                'color': '#aaaaaa', 'count': no_stage, 'is_terminal': False,
            })
        return result

    @staticmethod
    def get_cached_analytics(cache_key: str):
        return cache.get(cache_key)

    @staticmethod
    def cache_analytics(cache_key: str, data: Dict, timeout: int = 3600) -> None:
        cache.set(cache_key, data, timeout)

    @staticmethod
    def calculate_hr_effectiveness(queryset: QuerySet) -> List[Dict[str, Any]]:
        from django.contrib.auth.models import User

        terminal_ids = AnalyticsService._get_offer_stage_ids(queryset)
        rejected_ids = AnalyticsService._get_rejected_stage_ids(queryset)

        offer_q    = Q(stage_id__in=terminal_ids) if terminal_ids else Q(pk__in=[])
        rejected_q = Q(stage_id__in=rejected_ids) if rejected_ids else Q(pk__in=[])

        hr_ids = queryset.exclude(assigned_to__isnull=True).values_list('assigned_to', flat=True).distinct()

        hr_stats = []
        for hr_id in hr_ids:
            try:
                hr_user = User.objects.get(id=hr_id)
            except User.DoesNotExist:
                continue

            hr_candidates = queryset.filter(assigned_to=hr_id)
            total = hr_candidates.count()
            if total == 0:
                continue

            offers   = hr_candidates.filter(offer_q).count()
            rejected = hr_candidates.filter(rejected_q).count()
            interviews = hr_candidates.exclude(offer_q).exclude(rejected_q).exclude(
                Q(stage__order__lte=1) | Q(stage__isnull=True)
            ).count()

            conversion_rate  = round(offers / total * 100, 1) if total > 0 else 0
            interview_rate   = round((interviews + offers) / total * 100, 1) if total > 0 else 0
            active           = total - rejected

            time_data = AnalyticsService.calculate_time_to_hire_data(hr_candidates)
            avg_time  = round(sum(d['days'] for d in time_data) / len(time_data), 1) if time_data else None

            hr_name = f"{hr_user.first_name} {hr_user.last_name}".strip() or hr_user.username

            by_status_qs = dict(
                hr_candidates.exclude(stage__isnull=True)
                .values('stage__system_key')
                .annotate(count=Count('id'))
                .values_list('stage__system_key', 'count')
            )

            hr_stats.append({
                'hr_id':            hr_id,
                'hr_name':          hr_name,
                'hr_email':         hr_user.email,
                'hr_username':      hr_user.username,
                'total_candidates': total,
                'offers_count':     offers,
                'interviews_count': interviews,
                'rejected_count':   rejected,
                'active_candidates':active,
                'conversion_rate':  conversion_rate,
                'interview_rate':   interview_rate,
                'time_to_hire_avg': avg_time,
                'by_status': {s: by_status_qs.get(s, 0) for s in
                              ['new', 'screening', 'interview', 'offer', 'rejected']},
            })

        hr_stats.sort(key=lambda x: (-x['conversion_rate'], -x['total_candidates']))
        return hr_stats