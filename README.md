# MoranERP Platform

A cloud-agnostic, containerized ERP platform combining Odoo (Transactional Engine), FastAPI (API Gateway), and Next.js (Frontend).

## 🧱 Architecture

- **Frontend**: Next.js + Tailwind + Shadcn UI (Port `4000`)
- **API Gateway**: FastAPI (Port `9000`)
- **Engine**: Odoo 16 CE (Port `9069`)
- **Datastore**: PostgreSQL (Port `6432`)
- **Message Broker**: Kafka (Port `9092`)
- **Monitoring**: Prometheus, Grafana, cAdvisor

## 🚀 Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js (for local frontend dev, optional)
- Python 3.11 (for local backend dev, optional)

### Quick Start

1. **Build and Start Services**
   ```bash
   docker-compose up -d --build
   ```

2. **Access Services**
   - **Frontend**: [http://localhost:4000](http://localhost:4000) (or http://app.localhost via Traefik)
   - **API Gateway**: [http://localhost:9000/docs](http://localhost:9000/docs) (or http://api.localhost/docs)
   - **Odoo**: [http://localhost:9069](http://localhost:9069) (or http://odoo.localhost)
   - **Grafana**: [http://localhost:9001](http://localhost:9001)
   - **Traefik Dashboard**: [http://localhost:8080](http://localhost:8080)
   - **Kafka UI**: [http://localhost:9080](http://localhost:9080)
   - **Mailpit**: [http://localhost:8025](http://localhost:8025)

### Development

#### Project Structure
```
/
├── Backend/        # FastAPI Application
├── Engine/         # Odoo Configuration & Addons
├── Frontend/       # Next.js Application
├── monitoring/     # Prometheus & Grafana Config
└── docker-compose.yml
```

#### Monitoring Credentials
- **Grafana**: admin / admin (default)
- **Odoo**: admin / admin (configured in .env)

## 🛠 Troubleshooting

- **Odoo DB Connection**: Ensure PostgreSQL is healthy. Check logs: `docker logs moran-postgres`.
- **Kafka Connection**: Ensure Kafka is reachable. Use Kafka UI at Port 9080.
- **Rebuild**: `docker-compose build --no-cache` if dependencies change.
