import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

User = get_user_model()


class Command(BaseCommand):
    help = 'Create admin user and API token from environment variables'

    def handle(self, *args, **options):
        username = os.getenv('RADAR_ADMIN_USER', 'admin')
        password = os.getenv('RADAR_ADMIN_PASSWORD')
        email    = os.getenv('RADAR_ADMIN_EMAIL', '')

        if not password:
            self.stderr.write('RADAR_ADMIN_PASSWORD env var not set — skipping auth setup')
            return

        if not User.objects.filter(username=username).exists():
            User.objects.create_superuser(username=username, email=email, password=password)
            self.stdout.write(f'Created superuser: {username}')
        else:
            self.stdout.write(f'Superuser already exists: {username}')

        user  = User.objects.get(username=username)
        token, created = Token.objects.get_or_create(user=user)
        status = 'Created' if created else 'Existing'
        self.stdout.write(f'{status} API token for {username}:')
        self.stdout.write(f'RADAR_API_TOKEN={token.key}')
