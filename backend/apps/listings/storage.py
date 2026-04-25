"""
CV dosya yükleme soyutlaması.

CV_STORAGE_BACKEND ayarına göre dosyayı ya yerel diske (local dev)
ya da Cloudflare R2'ye (production) kaydeder.

Kullanım:
    from .storage import upload_cv
    cv_url = upload_cv(request.FILES['cv'], str(request.user.id))
"""
from __future__ import annotations

import os

from django.conf import settings


def upload_cv(file_obj, user_id: str) -> str:
    """
    CV dosyasını yapılandırılmış depolama alanına yükler ve public URL döner.

    Args:
        file_obj: Django UploadedFile nesnesi (request.FILES['cv'])
        user_id:  Öğrenci UUID'si (str)

    Returns:
        str: Yüklenen dosyanın erişilebilir URL'si
    """
    backend = getattr(settings, 'CV_STORAGE_BACKEND', 'local')
    if backend == 'r2':
        return _upload_to_r2(file_obj, user_id)
    return _upload_to_local(file_obj, user_id)


# ── Backends ─────────────────────────────────────────────────────────

def _upload_to_r2(file_obj, user_id: str) -> str:
    """Cloudflare R2'ye (S3-uyumlu) yükle."""
    import boto3

    client = boto3.client(
        's3',
        endpoint_url=f'https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name='auto',
    )
    key = f'cvs/{user_id}.pdf'
    client.upload_fileobj(
        file_obj,
        settings.R2_BUCKET_NAME,
        key,
        ExtraArgs={'ContentType': 'application/pdf'},
    )
    public_url = (settings.R2_PUBLIC_URL or '').rstrip('/')
    return f'{public_url}/{key}'


def _upload_to_local(file_obj, user_id: str) -> str:
    """Lokal MEDIA_ROOT'a yükle (geliştirme ortamı fallback)."""
    dest = os.path.join(settings.MEDIA_ROOT, 'cvs', f'{user_id}.pdf')
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, 'wb+') as handle:
        for chunk in file_obj.chunks():
            handle.write(chunk)
    media_url = (settings.MEDIA_URL or '/media/').rstrip('/')
    return f'{media_url}/cvs/{user_id}.pdf'
