# 🎁 Gift App — Frappe Installation Guide

This guide explains how to install the **Gift** custom Frappe app from `gift.zip` into an existing Frappe/ERPNext bench environment.

---

## ⚙️ Prerequisites

Make sure the following are installed and properly configured.

### 🔹 System Requirements

- Ubuntu 20.04 / 22.04 (recommended)
- Python 3.10+
- Node.js (v16 or compatible with your Frappe version)
- Redis
- MariaDB (10.6+ recommended)
- Yarn / npm

### 🔹 Frappe Bench Setup

You must already have a working Frappe bench. If not, install it first:

```bash
# Install bench
pip install frappe-bench

# Initialize bench
bench init frappe-bench --frappe-branch version-15
cd frappe-bench

# Create a site
bench new-site your-site-name

# Start bench
bench start
```

---

## 📁 Step 1: Place Your ZIP File

Upload or copy `gift.zip` into the bench `apps` directory:

```bash
cd frappe-bench/apps
```

Copy the ZIP here:

```bash
cp /path/to/gift.zip .
```

---

## 📦 Step 2: Extract the App

```bash
unzip gift.zip
```

Make sure the extracted folder structure looks like:

```
frappe-bench/
 └── apps/
      └── gift/
           ├── gift/
           ├── setup.py
           ├── requirements.txt
           └── ...
```

> ⚠️ **Important:** The extracted folder name must be `gift` and must match the Python module name defined in `setup.py`.

---

## 🔧 Step 3: Install Python Dependencies

If your app includes a `requirements.txt`, install the dependencies:

```bash
cd ../../
bench pip install -r apps/gift/requirements.txt
```

### 📂 Example `requirements.txt`

```
requests
pandas
numpy
Pillow
```

---

## ➕ Step 4: Install App on Site

```bash
bench --site your-site-name install-app gift
```

> Replace `your-site-name` with your actual site name (e.g., `mysite.localhost`).

---

## 🔄 Step 5: Run Migrations

```bash
bench --site your-site-name migrate
```

---

## ▶️ Step 6: Restart Bench

```bash
bench restart
```

---

## ✅ Verify Installation

- Open your site in a browser
- Check that:
  - **Gift** app appears under **Installed Applications**
  - All related features/modules are visible in the sidebar

---

## 🧹 Optional Cleanup

Remove the ZIP file after successful extraction:

```bash
rm frappe-bench/apps/gift.zip
```

---

## 🚀 Quick Install (All-in-One)

Run all steps at once from inside the `frappe-bench` directory:

```bash
cd frappe-bench/apps
unzip gift.zip

cd ..
bench pip install -r apps/gift/requirements.txt
bench --site your-site-name install-app gift
bench --site your-site-name migrate
bench restart
```

---

## ⚠️ Common Issues & Fixes

### ❌ App Not Found

- Ensure the extracted folder is named exactly `gift`
- Check `setup.py` for the correct `app_name = "gift"` entry

### ❌ Module Import Error

Re-run the dependency install:

```bash
bench pip install -r apps/gift/requirements.txt
```

### ❌ Permission Issues

```bash
sudo chown -R $USER:$USER frappe-bench
```

### ❌ Node / Yarn Issues

```bash
bench setup requirements
```

### ❌ Errors After Installation

Run the following in sequence:

```bash
bench build
bench --site your-site-name migrate
bench restart
```

---

## 📌 Notes

- App name **must** match the Python module name (`gift`)
- Always run `bench` commands from inside the `frappe-bench` directory
- Ensure your Frappe version is compatible with this app
- Use `bench --site your-site-name list-apps` to confirm successful installation