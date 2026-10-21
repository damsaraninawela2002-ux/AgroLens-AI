# AgroLens AI – Crop Disease Detection & Farmer Advisory Platform

## Overview

### Problem
Sri Lankan farmers often struggle to quickly and accurately identify crop diseases in the field, leading to delayed intervention, inappropriate pesticide usage, and significant yield losses.

### Solution
**AgroLens AI** enables farmers to simply upload a photo of an affected crop leaf. An AI-powered deep learning model detects the disease with a confidence score and provides actionable treatment and prevention advice in both **Sinhala** and **English**.

## Planned Features
- **Leaf Disease Detection:** Automated crop disease classification powered by **MobileNetV2**.
- **Explainable AI (Grad-CAM Heatmap):** Visual heatmaps highlighting the infected regions on the leaf image.
- **Gemini AI Advisory Chatbot:** Interactive, bilingual (Sinhala/English) farming assistant for treatment guidance and agronomic advice.
- **Role-Based Access Control (3 Roles):**
  - **Farmer:** Upload leaf photos, view diagnoses, chat with AI advisor, and track scan history.
  - **Agricultural Officer:** Review diagnoses, verify uncertain cases, and provide expert feedback.
  - **Admin:** Manage users, monitor platform analytics, and oversee model updates.
- **District Disease Outbreak Map:** Interactive geographical visualization of disease trends across Sri Lankan districts.
- **Officer Feedback Loop for Retraining:** Expert-verified leaf images and corrections collected for continuous model retraining.
- **Optional ESP32 IoT Sensor Dashboard:** Real-time monitoring of field environmental metrics (soil moisture, temperature, humidity).

## Tech Stack
- **Frontend:** React, Vite, Tailwind CSS, Recharts, React-Leaflet
- **Backend:** FastAPI (Python)
- **Database:** MongoDB Atlas
- **Machine Learning & AI:** TensorFlow / Keras (MobileNetV2), Google Gemini API

## Project Structure

```text
AgroLens AI/
├── Backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   └── security.py
│   │   ├── models/
│   │   │   └── __init__.py
│   │   ├── routes/
│   │   │   └── __init__.py
│   │   ├── services/
│   │   │   └── __init__.py
│   │   └── ml_models/
│   ├── uploads/
│   ├── .env.example
│   └── requirements.txt
├── Frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── context/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── ML/
│   ├── datasets/
│   ├── models/
│   ├── notebooks/
│   └── retrain/
├── .gitignore
└── README.md
```

## Status
**Status: In development**
