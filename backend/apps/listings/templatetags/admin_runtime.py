from django import template

from apps.listings.runtime import get_admin_runtime_info

register = template.Library()


@register.inclusion_tag('admin/includes/runtime_banner.html', takes_context=True)
def render_admin_runtime_banner(context):
    request = context.get('request')
    return {
        'runtime_info': get_admin_runtime_info(request),
    }
