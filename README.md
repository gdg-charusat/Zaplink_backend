# 📦 ZapLink

Instant File Sharing with Secure QR Codes & Short Links

---

ZapLink is a lightning-fast, customizable, and secure file-sharing platform. Upload any file (PDFs, images, documents, ZIPs, etc.) and instantly generate a downloadable QR code and shareable short link. Built with a focus on simplicity, speed, and privacy, ZapLink is perfect for quick cross-device sharing without logins or installations.

---

## 🚀 Features

* 📁 Upload & share any file: PDF, image, Word, ZIP, video, etc.
* 🔗 Instant short link + downloadable QR code
* 🎨 Customize your QR code: colors, frames, logos, shapes
* 🔐 Add password protection to your shared content
* ⏳ Set link expiration by time or download limit
* 🌐 No account required for sharing or access
* 💻 Browser extension support (planned)
* 📱 Mobile-optimized file viewing experience

---

## 🪰 Tech Stack

* Frontend: React + TailwindCSS
* Backend: Node.js, Express
* Database: PostgreSQL
* Uploads: Multer + Cloudinary / AWS S3
* QR Code Generation: qrcode, qrcode.react
* Optional: Redis for cache & link expiration

---

## 📌 Use Cases

* Students sharing notes, slides, assignments
* Developers transferring logs or screenshots between devices
* Teachers distributing documents via classroom projector
* Event organizers sharing materials through a QR poster
* Designers or marketers embedding styled QR codes in media

---

## 🛠️ Installation

Separate repositories are maintained for frontend and backend:

### Backend

1. Clone the backend repo:

```bash
git clone https://github.com/gdg-charusat/Zaplink_backend.git
cd ZapLink_backend
```

2. Install dependencies:

```bash
npm install
```

3. Set up your `.env` file:

```env
PORT=5000
DATABASE_URL=postgres://username:password@host:port/dbname
CLOUDINARY_URL=your-cloudinary-url
JWT_SECRET=your-secret-key
```

4. Run the development server:

```bash
npm run dev
```

5. (Optional) Seed the database with sample data:

```bash
npm run seed
```

This will populate your database with test Zaps including examples of password-protected, quiz-protected, and time-locked content.

### Frontend

1. Clone the frontend repo:

```bash
git clone https://github.com/krishnapaljadeja/ZapLink_frontend.git
cd ZapLink_frontend
```

2. Install dependencies:

```bash
npm install
```

3. Run the frontend:

```bash
npm run dev
```

---

## 🧪 API Testing with Postman

A complete Postman collection is available in the `/postman` directory for easy API testing.

### Quick Start

1. Import `postman/postman_collection.json` into Postman
2. Import `postman/postman_environment_local.json` for environment variables
3. Run the database seed: `npm run seed`
4. Start testing all endpoints!

The collection includes:
* All API endpoints with example requests
* Pre-configured variables matching seed data
* Examples for file uploads, password protection, quiz protection, and more

For detailed instructions, see [postman/README.md](postman/README.md)

---

## 🔐 Security Features

* Password-protected access with AES hashing
* Expiry system for link or file (by time or download limit)
* Secure, unlisted link generation (random UID)
* Optional self-destruct file setting

---

## ✨ Future Add-ons

* Browser extension for 1-click upload & share
* AI summaries/previews of uploaded documents
* QR scan analytics (views, location, device)
* Custom domain for links (zap.sh/yourfile)
* Developer API access & embed widgets

---

## 📬 Feedback & Contributions

Open issues, suggest features, or contribute via pull requests!

Backend Repo: [https://github.com/krishnapaljadeja/ZapLink\_backend](https://github.com/krishnapaljadeja/ZapLink_backend)

Frontend Repo: [https://github.com/krishnapaljadeja/ZapLink\_frontend](https://github.com/krishnapaljadeja/ZapLink_frontend)
