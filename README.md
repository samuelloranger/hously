# This project is very unstable and may be subject to breaking changes. 
# Hously 🏠

A simple family utility app for managing household tasks.

## Features

- 🛒 **Shopping List** - Collaborative family shopping
- 🧹 **Chores** - Track household tasks  
- 📅 **Expiry Tracker** - Monitor food expiration dates (30-day alerts)
- 📱 **Mobile Friendly** - Responsive design

## 🚀 Quick Start with Docker

1. **Download the compose file:**
   ```bash
   curl -o compose.yml https://raw.githubusercontent.com/samuelloranger/hously/main/docker-compose.example.yml
   ```

2. **Copy the docker-compose.example.yml to your server:**
   Rename it to `docker-compose.yml` and update the env variables to fit your needs.

3. **Start the application:**
   ```bash
   docker compose up -d
   ```

## 🔧 Configuration Details

### Database

This application uses **PostgreSQL** as its database. The database connection is configured via the `DATABASE_URL` environment variable.

Example:
```
DATABASE_URL=postgresql://username:password@localhost:5432/hously
```

### Access Control Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ALLOWED_EMAILS` | Comma-separated list of allowed emails | `user1@example.com,user2@example.com` |
| `ADMIN_EMAILS` | Comma-separated list of admin emails | `admin@example.com` |
| `DATABASE_URL` | PostgreSQL database connection string | `postgresql://user:pass@localhost:5432/hously` |

## 🛠️ Docker Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/samuelloranger/hously.git
cd hously

# 2. Copy environment file and configure
cp .env.example .env
# Edit .env and set at minimum:
#   - ALLOWED_EMAILS=your-email@example.com
#   - ADMIN_EMAILS=your-email@example.com
#   - SECRET_KEY=your-secret-key (change from default!)

```bash
# 1. Install dependencies
make install

# 3. Start API locally (Terminal 2)
make dev-api

# 4. Start frontend locally (Terminal 3)
make dev-web
```

## 🔔 External Notifications

Hously supports webhook-based notifications from external services, allowing you to receive push notifications for events from your media servers, download managers, and monitoring tools.

### Supported Services

- **Media Servers**: Jellyfin, Plex
- **Media Management**: Radarr, Sonarr, Prowlarr
- **Backup**: Duplicati
- **Monitoring**: UptimeKuma

### Setup

1. **Enable a Service**:
   - Go to Settings → External Notifications
   - Find the service you want to enable
   - Click "Enable" to activate the service

2. **Generate Webhook Token**:
   - After enabling, click "Regenerate Token" to create a unique authentication token
   - Copy the webhook URL shown (format: `https://your-domain.com/api/webhooks/{service_name}?token=YOUR_TOKEN`)

3. **Configure the External Service**:
   - In your external service (Radarr, Sonarr, Plex, etc.), add a webhook notification
   - Use the webhook URL from step 2
   - The service will send events to Hously, which will forward them as push notifications

### Configuration Options

- **Notify Admins Only**: By default, external notifications are sent only to admin users. You can change this in the service settings to notify all users.
- **Custom Templates**: Each service has customizable notification templates for different event types. You can edit the title and body templates using template variables (e.g., `{{item_name}}`, `{{user_name}}`).

### Example Event Types

- **Radarr/Sonarr**: Movie/Episode grabbed, downloaded, upgraded, health issues
- **Jellyfin/Plex**: Playback started/stopped, new items added, user events
- **Duplicati**: Backup started, completed, failed
- **UptimeKuma**: Monitor up/down, certificate expiry

Available variables are shown when editing templates in the settings.

## 🐛 Troubleshooting

### Common Issues

**Import Errors in Development**
- Run `make install` to install all dependencies
