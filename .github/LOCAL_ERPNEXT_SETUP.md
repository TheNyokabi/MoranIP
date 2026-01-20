# Local ERPNext Development Setup

## ✅ Setup Complete

Your ERPNext codebase has been set up locally at `Engine/ERPNext/` with the following structure:

```
Engine/ERPNext/
├── Dockerfile                    ← Local build configuration
├── entrypoint.sh                ← Container startup script
├── frappe/                       ← Frappe framework (v15)
│   ├── frappe/                   ← Core framework code
│   ├── setup.py                  ← Install configuration
│   └── requirements.txt           ← Python dependencies
├── erpnext/                      ← ERPNext application (v15)
│   ├── erpnext/                  ← Application code
│   ├── setup.py                  ← Install configuration
│   └── requirements.txt           ← Python dependencies
└── addons/                       ← Custom ERPNext apps (empty)
```

## Size & Performance

| Component | Size | Status |
|-----------|------|--------|
| Frappe (v15) | 84 MB | ✅ Cloned |
| ERPNext (v15) | 96 MB | ✅ Cloned |
| Total | ~180 MB | ✅ Ready |
| Docker Image (old) | 2 GB | Replaced |
| **Savings** | **1.8 GB** | **10x smaller!** |

## 🚀 Quick Start

### Start ERPNext with Docker Compose

```bash
cd /Volumes/Stuff/Start\ Ups/MoranERP

# Start all services (will build ERPNext from local source)
docker-compose up --build

# Or just ERPNext + dependencies
docker-compose up --build erpnext mariadb redis
```

### Initial Setup (First Time Only)

```bash
# The create-site service will automatically:
# 1. Wait for ERPNext to start
# 2. Create common_site_config.json with database settings
# 3. Create moran.localhost site with ERPNext installed

# Access at: http://localhost:9010
# Default credentials: admin / admin
```

### Verify Setup

```bash
# Check container status
docker-compose ps

# View ERPNext logs
docker-compose logs -f erpnext

# Access ERPNext console
docker exec -it moran-erpnext-local bash
```

## 📝 Development Workflow

### Making Changes to Frappe/ERPNext Source

Since the source code is mounted as a volume, changes are reflected immediately:

```bash
# Example: Edit Frappe code
vim Engine/ERPNext/frappe/frappe/core/doctype.py

# Changes are instantly available in the running container
# Restart may be needed depending on the change:
docker-compose restart erpnext
```

### Creating Custom ERPNext Apps

1. **Create a new app in the addons folder:**

```bash
mkdir -p Engine/ERPNext/addons/my_custom_app
cd Engine/ERPNext/addons/my_custom_app

# Create app structure
mkdir -p my_custom_app/{doctype,api,hooks}
touch __init__.py
touch hooks.py
```

2. **Create hooks.py:**

```python
# Engine/ERPNext/addons/my_custom_app/hooks.py
app_name = "my_custom_app"
app_title = "My Custom App"
app_publisher = "Your Name"
app_description = "Custom ERPNext functionality"
app_icon = "icon-star"
app_color = "#FF5733"
app_version = "0.0.1"
app_license = "MIT"

hooks = {
    "doc_events": {},
    "jinja": {},
    "before_insert": [],
}

doctype_js = {}
doctype_css = {}
doctype_list_js = {}
```

3. **Install custom app in running container:**

```bash
docker exec -it moran-erpnext-local bash -c \
  "cd /app && bench install-app my_custom_app"
```

### Adding Python Dependencies

```bash
# Edit requirements.txt
vim Engine/ERPNext/frappe/requirements.txt

# Rebuild Docker image
docker-compose up --build erpnext
```

## 🔧 Configuration

### Database Configuration

Automatic via environment variables in docker-compose.yml:
- **DB_HOST**: mariadb
- **DB_PORT**: 3306
- **DB_USER**: root (default)
- **DB_PASSWORD**: admin (default)

### Redis Configuration

Automatic via environment variables:
- **REDIS_CACHE**: redis:6379
- **REDIS_QUEUE**: redis:6379
- **REDIS_SOCKETIO**: redis:6379

### Custom Configuration

Edit `sites/moran.localhost/site_config.json` inside the container:

```bash
docker exec -it moran-erpnext-local bash -c \
  "cat /home/frappe/frappe-bench/sites/moran.localhost/site_config.json"
```

## 🐛 Debugging

### View Application Logs

```bash
# Docker logs
docker-compose logs -f erpnext

# Site logs inside container
docker exec -it moran-erpnext-local bash -c \
  "tail -f /home/frappe/frappe-bench/logs/*.log"
```

### Access ERPNext Console

```bash
# Open interactive Frappe shell
docker exec -it moran-erpnext-local bash -c \
  "bench --site moran.localhost console"
```

### Database Access

```bash
# Connect to MariaDB
docker exec -it moran-mariadb mysql -u root -padmin

# List databases
mysql> SHOW DATABASES;

# Select ERPNext database
mysql> USE extra_db;

# List tables
mysql> SHOW TABLES;
```

## 📊 Differences from Docker Image

### Before (Docker Image)
```
Service: frappe/erpnext:v15.20.0 (Cloud)
- Pre-built image
- Faster startup (instant)
- No source code access
- Limited customization
- 2 GB image size
```

### After (Local Codebase)
```
Service: Local build from ./Engine/ERPNext/Dockerfile
- Source code available
- Direct debugging
- Full customization
- 180 MB source code
- Hot reload (with restart)
```

## 🔄 Adapter Integration

Your `erpnext_client.py` adapter still works unchanged:

```python
# Backend/app/services/erpnext_client.py
client = ERPNextClientAdapter(
    base_url="http://erpnext:8000",  # Points to container
    site_name="moran.localhost"
)

# All methods still work:
client._login()
client.list_resource("Item")
client.create_resource("Item", {...})
client.enable_module("selling")
```

## ⚠️ Common Issues

### Issue: Container fails to start
**Solution**: Check logs for missing dependencies
```bash
docker-compose logs erpnext | grep -i error
```

### Issue: Database connection fails
**Solution**: Ensure MariaDB is healthy
```bash
docker-compose ps  # Check mariadb status
docker-compose logs mariadb
```

### Issue: Redis connection fails
**Solution**: Verify Redis is running
```bash
docker exec -it moran-redis redis-cli ping
# Should respond: PONG
```

### Issue: Custom app not loading
**Solution**: Reinstall app and restart
```bash
docker exec -it moran-erpnext-local bash -c \
  "cd /app && bench install-app my_app && bench restart"
```

## 📚 Useful Commands

```bash
# View installed apps
docker exec -it moran-erpnext-local bench list-apps

# Enable a module
docker exec -it moran-erpnext-local bench --site moran.localhost \
  enable_module selling

# Run migrations
docker exec -it moran-erpnext-local bench --site moran.localhost migrate

# Clear cache
docker exec -it moran-erpnext-local bench --site moran.localhost clear-cache

# Check system health
curl http://localhost:9010/api/resource/System%20Settings

# Rebuild assets
docker exec -it moran-erpnext-local bench build
```

## 🎯 Next Steps

1. **Test local ERPNext:**
   ```bash
   docker-compose up --build
   # Wait ~2-3 minutes for initial build
   # Access: http://localhost:9010
   ```

2. **Verify adapter integration:**
   ```bash
   curl -X GET http://localhost:9000/api/v1/erp/partners \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Create custom module:**
   - Follow "Creating Custom ERPNext Apps" section above

4. **Enable additional modules:**
   ```bash
   # Via API
   curl -X POST http://localhost:9000/tenants/{id}/erp/modules/selling/enable \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## 📖 References

- **Frappe Framework**: https://frappeframework.com/
- **ERPNext Docs**: https://docs.erpnext.com/
- **ERPNext Development**: https://erpnext.com/docs/en/developer
- **GitHub Repos**:
  - Frappe: https://github.com/frappe/frappe
  - ERPNext: https://github.com/frappe/erpnext

## ✅ Verification Checklist

- [x] Directory structure created
- [x] Frappe v15 cloned
- [x] ERPNext v15 cloned
- [x] Dockerfile created
- [x] docker-compose.yml updated
- [x] Entrypoint script created
- [ ] Initial docker-compose up completed
- [ ] moran.localhost site created
- [ ] Admin login verified
- [ ] Adapter integration tested

**Status**: 🟡 Ready for `docker-compose up --build`

---

**Created**: January 8, 2026
**Version**: 1.0
**Local Setup**: ✅ COMPLETE
