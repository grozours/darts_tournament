# Nginx Reverse Proxy + Linux Kernel Tuning Guide

This guide provides a practical tuning baseline for running this application behind Nginx as a reverse proxy under high concurrent traffic.

## Scope

- Reverse proxy: Nginx (system package, systemd-managed)
- Backend application behind Nginx
- Linux host tuning (`sysctl` + file descriptor limits)
- Validation workflow before/after load tests

## 1) Nginx Tuning (Global)

Edit `/etc/nginx/nginx.conf` and apply these baseline settings.

```nginx
user www-data;
worker_processes auto;
worker_rlimit_nofile 200000;
pid /run/nginx.pid;
error_log /var/log/nginx/error.log warn;

events {
    use epoll;
    worker_connections 4096;
    multi_accept on;
}

http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;

    keepalive_timeout 15;
    keepalive_requests 1000;

    client_header_timeout 10s;
    client_body_timeout 10s;
    send_timeout 15s;
    reset_timedout_connection on;

    types_hash_max_size 4096;
    server_tokens off;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:50m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 5;
    gzip_min_length 1024;
    gzip_types
      text/plain
      text/css
      application/json
      application/javascript
      text/xml
      application/xml
      application/xml+rss
      text/javascript
      image/svg+xml;

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

### Why this helps

- `worker_processes auto` + `epoll` improves CPU/core usage under concurrency.
- `worker_rlimit_nofile` + high `worker_connections` reduces file/socket exhaustion.
- Keepalive and timeout tuning improves connection churn behavior.
- TLS and gzip settings reduce overhead while keeping secure defaults.

## 2) Reverse Proxy Site Tuning (API + WebSocket)

In your server/site configuration, ensure API and WebSocket locations are explicitly tuned.

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl http2;
    server_name darts.bzhtech.eu;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_buffering off;
    }
}
```

## 3) Raise Nginx Open File Limits (systemd)

Set a higher `nofile` limit for the Nginx service.

```bash
sudo systemctl edit nginx
```

Add:

```ini
[Service]
LimitNOFILE=200000
```

Apply:

```bash
sudo systemctl daemon-reload
sudo systemctl restart nginx
```

Verify:

```bash
systemctl show nginx -p LimitNOFILE
pid=$(pgrep -f "nginx: worker process" | head -n1)
cat /proc/$pid/limits | grep "Max open files"
```

## 4) Linux Kernel Tuning (`sysctl`)

Create `/etc/sysctl.d/99-darts-tuning.conf`:

```conf
fs.file-max = 1000000

net.core.somaxconn = 65535
net.core.netdev_max_backlog = 16384
net.ipv4.tcp_max_syn_backlog = 16384

net.ipv4.ip_local_port_range = 10240 65535
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_tw_reuse = 1

net.ipv4.tcp_keepalive_time = 120
net.ipv4.tcp_keepalive_intvl = 30
net.ipv4.tcp_keepalive_probes = 5
```

Apply and verify:

```bash
sudo sysctl --system
sysctl net.core.somaxconn net.ipv4.tcp_max_syn_backlog net.ipv4.ip_local_port_range fs.file-max
```

## 5) Validation Checklist

### Configuration validation

```bash
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl status nginx --no-pager
```

### Runtime signal checks

```bash
ss -s
cat /proc/net/netstat | grep -E 'ListenOverflows|ListenDrops'
```

### Error-focused logs

```bash
docker compose logs -f backend 2>&1 | sed -u -r 's/\x1B\[[0-9;]*[mK]//g' | grep --line-buffered -Ei '\[error\]|Unhandled|Uncaught|Server error|Redis .*error|Database .*error|WebSocket .*error|connection failed|Failed to'
```

## 6) Load Test Protocol (Recommended)

Run the same scenario before/after tuning to compare with consistent conditions.

```bash
node scripts/simulate_anonymous_traffic.mjs --url https://darts.bzhtech.eu --visitors 1000 --duration 60
node scripts/simulate_anonymous_traffic.mjs --url https://darts.bzhtech.eu --visitors 1500 --duration 60
node scripts/simulate_anonymous_traffic.mjs --url https://darts.bzhtech.eu --visitors 2000 --duration 60
node scripts/simulate_anonymous_traffic.mjs --url https://darts.bzhtech.eu --visitors 2500 --duration 60
```

For stability validation, run endurance:

```bash
node scripts/simulate_anonymous_traffic.mjs --url https://darts.bzhtech.eu --visitors 2500 --duration 600
```

## 7) Rollback Plan

If instability appears after tuning:

1. Revert `/etc/sysctl.d/99-darts-tuning.conf` changes and run `sudo sysctl --system`.
2. Remove `LimitNOFILE` override:
   - `sudo systemctl revert nginx`
   - `sudo systemctl daemon-reload && sudo systemctl restart nginx`
3. Revert the edited Nginx directives and reload:
   - `sudo nginx -t && sudo systemctl reload nginx`

---

Use this guide as a baseline, then adapt values to your VPS size (CPU, RAM, NIC throughput) and observed production metrics.
