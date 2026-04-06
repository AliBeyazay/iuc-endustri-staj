MANAGED_BEAT_SCHEDULES = {
    'all-scrape': {
        'task': 'apps.scraper.tasks.run_all_scrapers',
        'crontab': {
            'minute': '0',
            'hour': '2',
            'day_of_week': '*',
            'day_of_month': '*',
            'month_of_year': '*',
        },
        'interval_seconds': 86400,
        'description': 'Run every scraper at 02:00 Europe/Istanbul.',
    },
    'expire-check': {
        'task': 'apps.scraper.tasks.deactivate_expired_listings',
        'crontab': {
            'minute': '0',
            'hour': '9',
            'day_of_week': '*',
            'day_of_month': '*',
            'month_of_year': '*',
        },
        'interval_seconds': 86400,
        'description': 'Deactivate expired listings every day at 09:00 Europe/Istanbul.',
    },
    'weekly-digest': {
        'task': 'apps.scraper.tasks.send_weekly_digest',
        'crontab': {
            'minute': '0',
            'hour': '10',
            'day_of_week': '1',
            'day_of_month': '*',
            'month_of_year': '*',
        },
        'interval_seconds': 604800,
        'description': 'Send the weekly digest every Monday at 10:00 Europe/Istanbul.',
    },
}

LEGACY_DISABLED_BEAT_TASK_NAMES = (
    'morning-scrape',
    'evening-scrape',
    'linkedin-night-scrape',
)


def build_celery_beat_schedule(crontab_factory):
    schedule = {}
    for name, spec in MANAGED_BEAT_SCHEDULES.items():
        if crontab_factory is not None:
            schedule[name] = {
                'task': spec['task'],
                'schedule': crontab_factory(**spec['crontab']),
            }
        else:
            schedule[name] = {
                'task': spec['task'],
                'schedule': spec['interval_seconds'],
            }
    return schedule


def sync_managed_beat_schedule(*, timezone_name: str):
    from django_celery_beat.models import CrontabSchedule, PeriodicTask, PeriodicTasks

    summary = {
        'created': 0,
        'updated': 0,
        'disabled': 0,
        'managed_names': [],
    }

    for name, spec in MANAGED_BEAT_SCHEDULES.items():
        crontab_kwargs = {
            **spec['crontab'],
            'timezone': timezone_name,
        }
        crontab, _ = CrontabSchedule.objects.get_or_create(**crontab_kwargs)
        _, created = PeriodicTask.objects.update_or_create(
            name=name,
            defaults={
                'task': spec['task'],
                'crontab': crontab,
                'interval': None,
                'solar': None,
                'clocked': None,
                'one_off': False,
                'enabled': True,
                'description': spec['description'],
            },
        )
        summary['managed_names'].append(name)
        if created:
            summary['created'] += 1
        else:
            summary['updated'] += 1

    summary['disabled'] = PeriodicTask.objects.filter(
        name__in=LEGACY_DISABLED_BEAT_TASK_NAMES,
        enabled=True,
    ).update(enabled=False)

    PeriodicTasks.update_changed()
    return summary
