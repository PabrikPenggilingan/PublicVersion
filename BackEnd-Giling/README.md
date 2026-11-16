# Belanja Giling Management System

Sistem Pencatatan Belanja Gabah & Pasca Proses - Wizard-based web application untuk mengelola pembelian gabah kering padi (GKP), proses penggilingan, dan penjualan hasil produksi.

## 🚀 Tech Stack

- **Backend:** Express.js (Node.js 18)
- **Frontend:** React 18 + TypeScript + Vite (served from [`FrontEnd-Giling`](../FrontEnd-Giling))
- **Database:** PostgreSQL 14
- **Storage:** Supabase Storage (optional, mocked locally if not configured)
- **Proxy:** NGINX (single entry point for both API and frontend)
- **Deploy:** Docker Compose (full-stack: DB + API + Frontend + NGINX)

> 📄 For a deep-dive into the Docker architecture, see [ABOUT_DOCKERIZE.md](./ABOUT_DOCKERIZE.md).

## 📋 Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- PostgreSQL 15 (for local development without Docker)

## 🛠️ Quick Start

### Pure Local Development (Recommended)

This is the fastest way for development with hot reload and easy debugging.

#### Prerequisites
- Node.js 18+
- PostgreSQL 15+

#### 1. Install PostgreSQL

**MacOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql-15
sudo systemctl start postgresql
```

**Windows:**
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

#### 2. Create Database and User

```bash
# Login ke PostgreSQL
sudo -u postgres psql
# Atau di Windows: psql -U postgres

# Jalankan commands berikut:
CREATE USER gabah_user WITH PASSWORD 'gabah_password' CREATEROLE;
CREATE DATABASE gabah_db OWNER gabah_user;
CREATE DATABASE gabah_logs OWNER gabah_user;
GRANT ALL PRIVILEGES ON DATABASE gabah_db TO gabah_user;
GRANT ALL PRIVILEGES ON DATABASE gabah_logs TO gabah_user;
\q
```

#### 3. Setup Backend 

```bash
# Clone repository
git clone https://github.com/PabrikPenggilingan/BackEnd-Giling.git
cd BackEnd-Giling

# Copy environment file
cp .env.example .env
# .env sudah configured untuk localhost, tidak perlu edit

# Install dependencies
cd backend
npm install

# Run migrations
npm run migrate

# Seed initial data
npm run seed

# Start development server with hot reload
npm run dev
```

#### 4. Access the API
- API: http://localhost:3000/api
- Health check: http://localhost:3000/health

#### 5. Default Credentials
- Username: `admin`
- Password: `admin123`

**⚠️ Change default password in production!**

---

### Hybrid Mode (Docker Database + Local Backend)

If you prefer using Docker for database but want local backend for hot reload:

```bash
# Start only PostgreSQL with Docker
docker-compose -f docker-compose.dev.yml up -d

# Setup backend locally
cd backend
npm install
cp ../.env.example .env
# .env sudah configured untuk localhost:5432

npm run migrate
npm run seed
npm run dev
```

---

### Using Docker Compose (Full Stack) [Use this one!!!]

This is the recommended approach. It starts the entire application — database, backend API, frontend UI, and NGINX — with a **single command**.

> ⚠️ **Both repos must be cloned as siblings:**
> ```
> AERP/
> ├── BackEnd-Giling/   ◄── run docker-compose from here
> └── FrontEnd-Giling/  ◄── built automatically by Docker
> ```

1. **Clone both repositories:**
```bash
git clone https://github.com/PabrikPenggilingan/BackEnd-Giling.git
git clone https://github.com/PabrikPenggilingan/FrontEnd-Giling.git
cd BackEnd-Giling
```

2. **Set up environment variables:**
```bash
cp .env.example .env
```
*(The `.env.example` is pre-configured for Docker Compose. Optionally add Supabase keys for file uploads.)*

3. **Start all services (DB + API + Frontend + NGINX):**
```bash
docker-compose up -d --build
```
*(Docker builds the API and React frontend, starts the database, runs migrations, and wires everything through NGINX automatically.)*

4. **Seed the database (Optional but recommended):**
```bash
docker-compose exec api npm run seed
```

5. **Access the application:**
- **Frontend UI:** http://localhost
- **API Base URL:** http://localhost/api
- **Health check:** http://localhost/health

## 📚 Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database Schema](docs/DB_SCHEMA.md)
- [API Reference](docs/API_REFERENCE.md)
- [Backup Runbook](docs/BACKUP_RUNBOOK.md)
- [Perubahan 15 Nov 2026: Pengiriman, Potongan, Bukti Kas, Finance & Data per Pabrik](docs/Akmal/DOKUMENTASI_PERUBAHAN_2026_11_15.md)

## 🔑 Default Credentials

After seeding:
- **Username:** admin
- **Password:** admin123

**⚠️ IMPORTANT:** Change the default password in production!

## 📦 Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Route controllers
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Utility functions
│   │   └── validators/     # Input validation
│   ├── migrations/         # Database migrations
│   ├── scripts/            # Utility scripts
│   └── seeds/              # Seed data
├── nginx/                  # NGINX configuration
├── docs/                   # Documentation
└── docker-compose.yml      # Docker Compose config
```

## 🧪 Testing

```bash
cd backend
npm test
```

## 📝 Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with hot reload
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed database with initial data
- `npm test` - Run tests

## 🔒 Security

- JWT-based authentication
- Role-based access control (Admin, Operator, Viewer)
- Input validation with Joi
- SQL injection protection with parameterized queries
- Helmet.js for HTTP headers security

## 🌍 Environment Variables

See `.env.example` for all available environment variables.

## 📄 License

ISC

## 👥 Contributing

Contributions are welcome! Please read our contributing guidelines first.

## 📞 Support

For support, email support@example.com or create an issue in the repository.
