from typing import Dict, Any, List, Optional
from datetime import datetime
from django.db.models import Q, Prefetch, QuerySet
from django.core.cache import cache

from candidates.models import Candidate, StatusHistory


class AnalyticsService:
    @staticmethod
    def calculate_time_to_hire_data(
            queryset: QuerySet,
            date_from: Optional[str] = None,
            date_to: Optional[str] = None
    ) -> List[Dict[str, Any]]:

        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        candidates_with_offer = queryset.filter(status='offer').select_related(
            'vacancy', 'assigned_to'
        ).prefetch_related(
            Prefetch(
                'status_history',
                queryset=StatusHistory.objects.filter(new_status='offer').order_by('changed_at'),
                to_attr='offer_history'
            )
        )

        time_data = []

        for candidate in candidates_with_offer:
            new_time = candidate.created_at
            first_offer = candidate.offer_history[0] if candidate.offer_history else None

            if candidate.status == 'offer' and not first_offer:
                days = 0
                offer_date = candidate.created_at
            elif first_offer and new_time:
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
                vacancy_stats[vid] = {
                    'vacancy_id': vid,
                    'vacancy_title': d['vacancy_title'],
                    'times': [],
                }
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
            ('0-7 днів', 0, 7),
            ('7-14 днів', 7, 14),
            ('14-30 днів', 14, 30),
            ('30-60 днів', 30, 60),
            ('60+ днів', 60, float('inf')),
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
    def get_cached_analytics(cache_key: str) -> Optional[Dict]:
        return cache.get(cache_key)

    @staticmethod
    def cache_analytics(cache_key: str, data: Dict, timeout: int = 3600) -> None:
        cache.set(cache_key, data, timeout)