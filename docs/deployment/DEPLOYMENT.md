# Deployment Guide — AMR Risk Assessment Tool

This guide covers deploying the AMR tool to a production Linux server (Ubuntu 22.04).

---

## Architecture Overview

```
Internet → Nginx (reverse proxy)
              ├── /          → Frontend (React static files)
              └── /api/      → Backend (Django via Gunicorn)
                                └── PostgreSQL
```

---

## Server Requirements

| Component | Minimum |
|-----------|---------|
| OS | Ubuntu 22.04 LTS |
| CPU | 2 vCPU |
| RAM | 2 GB |
| Disk | 20 GB |
| Python | 3.11+ |
| Node.js | 18+ |
| PostgreSQL | 15 |

---

## 1. Server Initial Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y python3 python3-pip python3-venv \
  postgresql postgresql-contrib nginx git curl

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## 2. PostgreSQL Setup

```bash
sudo -u postgres psql

-- Inside psql:
CREATE DATABASE amr_tool;
CREATE USER amr_user WITH PASSWORD 'strong-password-here';
GRANT ALL PRIVILEGES ON DATABASE amr_tool TO amr_user;
ALTER DATABASE amr_tool OWNER TO amr_user;
\q
```

---

## 3. Application Setup

```bash
# Create app user
sudo useradd -m -s /bin/bash amrapp
sudo su - amrapp

# Clone repository
git clone <your-repo-url> /home/amrapp/amr-tool
cd /home/amrapp/amr-tool
```

### Backend

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create production .env
cp .env.example .env
nano .env
```

**Production `.env`:**
```env
SECRET_KEY=generate-a-long-random-secret-key-here
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

DB_NAME=amr_tool
DB_USER=amr_user
DB_PASSWORD=strong-password-here
DB_HOST=localhost
DB_PORT=5432

CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

> Generate a secret key: `python -c "import secrets; print(secrets.token_urlsafe(50))"`

```bash
# Run migrations and seed data
python manage.py makemigrations compounds config module_rq
python manage.py migrate
python manage.py load_compounds
python manage.py load_module_config

# Collect static files
python manage.py collectstatic --noinput

# Create admin user
python manage.py createsuperuser

# Generate API tokens for each team/vendor
python manage.py drf_create_token <username>
```

### Frontend

```bash
cd ../frontend

# Install and build
npm install

# Create production .env
cp .env.example .env
nano .env
```

**Production `.env`:**
```env
VITE_API_BASE_URL=https://yourdomain.com/api/v1
VITE_API_TOKEN=your-api-token-here
```

```bash
npm run build
# Build output is at frontend/dist/
```

---

## 4. Gunicorn Setup (Backend Process Manager)

```bash
# Test Gunicorn works
cd /home/amrapp/amr-tool/backend
source venv/bin/activate
gunicorn core.wsgi:application --bind 0.0.0.0:8001
# Ctrl+C to stop
```

Create a systemd service:

```bash
sudo nano /etc/systemd/system/amr-backend.service
```

```ini
[Unit]
Description=AMR Tool Django Backend
After=network.target postgresql.service

[Service]
User=amrapp
Group=amrapp
WorkingDirectory=/home/amrapp/amr-tool/backend
Environment="PATH=/home/amrapp/amr-tool/backend/venv/bin"
EnvironmentFile=/home/amrapp/amr-tool/backend/.env
ExecStart=/home/amrapp/amr-tool/backend/venv/bin/gunicorn \
    core.wsgi:application \
    --workers 3 \
    --bind 127.0.0.1:8001 \
    --timeout 120 \
    --access-logfile /var/log/amr-backend/access.log \
    --error-logfile /var/log/amr-backend/error.log
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# Create log directory
sudo mkdir -p /var/log/amr-backend
sudo chown amrapp:amrapp /var/log/amr-backend

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable amr-backend
sudo systemctl start amr-backend
sudo systemctl status amr-backend
```

---

## 5. Nginx Setup (Reverse Proxy)

```bash
sudo nano /etc/nginx/sites-available/amr-tool
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Frontend — serve React build
    location / {
        root /home/amrapp/amr-tool/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 20M;
    }

    # Django Admin
    location /admin/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Django static files
    location /static/ {
        alias /home/amrapp/amr-tool/backend/staticfiles/;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/amr-tool /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 6. SSL Certificate (HTTPS) — Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is set up automatically
sudo certbot renew --dry-run
```

---

## 7. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## Deployment Checklist

- [ ] `DEBUG=False` in production `.env`
- [ ] Strong `SECRET_KEY` generated
- [ ] Database password set
- [ ] `ALLOWED_HOSTS` set to your domain
- [ ] `CORS_ALLOWED_ORIGINS` set to your frontend domain (HTTPS)
- [ ] `collectstatic` run
- [ ] Migrations applied
- [ ] Seed data loaded (`load_compounds`, `load_module_config`)
- [ ] PNEC values entered via Django Admin
- [ ] Gunicorn service running
- [ ] Nginx configured and running
- [ ] SSL certificate installed
- [ ] Firewall enabled

---

## Updating the Application

```bash
cd /home/amrapp/amr-tool

# Pull latest code
git pull origin main

# Backend update
cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart amr-backend

# Frontend update
cd ../frontend
npm install
npm run build

# Reload Nginx
sudo systemctl reload nginx
```

---

## Monitoring & Logs

```bash
# Backend logs
sudo journalctl -u amr-backend -f
tail -f /var/log/amr-backend/error.log

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Service status
sudo systemctl status amr-backend
sudo systemctl status nginx
sudo systemctl status postgresql
```

---

## Backup — Database

```bash
# Backup
pg_dump -U amr_user amr_tool > amr_tool_backup_$(date +%Y%m%d).sql

# Restore
psql -U amr_user amr_tool < amr_tool_backup_20260424.sql
```

> Recommended: Set up a daily cron job for automated backups.

```bash
crontab -e
# Add:
0 2 * * * pg_dump -U amr_user amr_tool > /home/amrapp/backups/amr_tool_$(date +\%Y\%m\%d).sql
```
