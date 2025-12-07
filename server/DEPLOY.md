# Deploying Irodori API on Synology NAS

## Prerequisites

- Synology NAS with Docker package installed
- SSH access or File Station access to your NAS

## Step 1: Install Docker (if not already installed)

1. Open **Package Center** on your Synology
2. Search for **Container Manager** (previously called Docker)
3. Click **Install**

## Step 2: Copy Server Files to NAS

Copy the entire `server/` folder to your Synology NAS.

**Option A: Using File Station**
1. Open File Station
2. Navigate to a shared folder (e.g., `docker/irodori-server`)
3. Upload these files:
   - `package.json`
   - `index.js`
   - `db.js`
   - `Dockerfile`
   - `docker-compose.yml`

**Option B: Using SCP (command line)**
```bash
scp -r server/* user@your-nas-ip:/volume1/docker/irodori-server/
```

## Step 3: Build and Run with Docker

### Option A: Using Container Manager UI

1. Open **Container Manager**
2. Go to **Project** tab
3. Click **Create**
4. Set project name: `irodori-api`
5. Set path to your server folder
6. Click **Create**

### Option B: Using SSH

1. SSH into your NAS:
   ```bash
   ssh user@your-nas-ip
   ```

2. Navigate to the server folder:
   ```bash
   cd /volume1/docker/irodori-server
   ```

3. Build and start:
   ```bash
   docker-compose up -d --build
   ```

4. Check if running:
   ```bash
   docker ps
   ```

## Step 4: Test the API

From your computer, test the connection:

```bash
curl http://YOUR-NAS-IP:3456/api/health
```

Expected response:
```json
{"status":"ok","timestamp":1234567890}
```

## Step 5: Find Your NAS IP Address

**On the NAS:**
- Go to **Control Panel** → **Network** → **Network Interface**
- Note the IP address (e.g., `192.168.1.100`)

**Or use the Synology QuickConnect URL:**
- Format: `http://YOUR-QUICKCONNECT-ID.quickconnect.to:3456`
- Note: QuickConnect may require additional port forwarding setup

## Step 6: Configure Irodori App

In the Irodori Electron app:
1. Open Settings
2. Set API URL to: `http://YOUR-NAS-IP:3456`
3. Test connection

## Troubleshooting

### Check container logs
```bash
docker logs irodori-api
```

### Restart the container
```bash
docker-compose restart
```

### Rebuild after changes
```bash
docker-compose up -d --build
```

### Check if port is open
```bash
netstat -tlnp | grep 3456
```

## Data Location

The SQLite database is stored in a Docker volume named `irodori-data`.

To backup:
```bash
docker cp irodori-api:/app/data/irodori.db ./irodori-backup.db
```

To find the volume location:
```bash
docker volume inspect irodori-server_irodori-data
```

## Security Notes

- The API has no authentication by default
- Only expose on your local network
- For external access, consider:
  - Setting up a VPN
  - Adding API key authentication
  - Using Synology's reverse proxy with HTTPS
