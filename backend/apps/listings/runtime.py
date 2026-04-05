import os
from pathlib import Path

from django.conf import settings
from django.db import connection


def get_runtime_environment() -> str:
    explicit_environment = getattr(settings, 'ENVIRONMENT', '') or os.environ.get('APP_ENV', '')
    if explicit_environment:
        return str(explicit_environment).lower()

    settings_module = os.environ.get('DJANGO_SETTINGS_MODULE', '')
    if settings_module.endswith('.prod'):
        return 'prod'
    if settings_module.endswith('.dev'):
        return 'dev'
    return 'dev' if settings.DEBUG else 'prod'


def get_database_runtime_info() -> dict[str, str]:
    database_settings = connection.settings_dict
    engine = database_settings.get('ENGINE', '')
    database_name = str(database_settings.get('NAME', '') or '')
    database_host = str(database_settings.get('HOST', '') or '')
    database_port = str(database_settings.get('PORT', '') or '')

    if 'sqlite' in engine:
        return {
            'engine': 'sqlite',
            'host': 'local file',
            'name': Path(database_name).name or database_name,
        }

    host_summary = database_host or 'unknown host'
    if database_port:
        host_summary = f'{host_summary}:{database_port}'

    return {
        'engine': 'postgres',
        'host': host_summary,
        'name': database_name or 'unknown database',
    }


def get_admin_runtime_info(request=None) -> dict[str, str]:
    database_info = get_database_runtime_info()
    backend_base_url = ''
    if request is not None:
        backend_base_url = request.build_absolute_uri('/').rstrip('/')

    return {
        'environment': get_runtime_environment(),
        'database_engine': database_info['engine'],
        'database_host': database_info['host'],
        'database_name': database_info['name'],
        'frontend_url': getattr(settings, 'FRONTEND_URL', ''),
        'backend_base_url': backend_base_url,
    }
