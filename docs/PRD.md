# Product Requirements Document (PRD)

## ShadowInglish

### Version

1.0

### Status

Draft

### Product Owner

Gelar Rahadian Fajar

# 1. Product Overview

## Background

Banyak orang mampu memahami bahasa Inggris ketika membaca maupun
mendengarkan, tetapi masih mengalami kesulitan saat berbicara seperti
native speaker. Salah satu metode yang terbukti efektif untuk
meningkatkan speaking adalah **Shadowing**, yaitu meniru secara langsung
cara berbicara native speaker.

Namun, saat ini belum banyak platform yang menyediakan pengalaman
shadowing yang interaktif dengan bantuan AI. ShadowInglish hadir sebagai
platform yang membantu pengguna berlatih speaking menggunakan video,
transcript, vocabulary, dan AI feedback sehingga proses belajar menjadi
lebih efektif.

# 2. Product Vision

Menjadi platform pembelajaran bahasa Inggris berbasis AI yang membantu
pengguna meningkatkan pronunciation, fluency, dan confidence melalui
metode shadowing.

# 3. Problem Statement

- Sulit berbicara seperti native speaker.
- Tidak tahu bagaimana memanfaatkan video berbahasa Inggris sebagai
  media belajar.
- Tidak memiliki feedback mengenai pronunciation.
- Sulit mengetahui bagian pengucapan yang salah.

# 4. Target Users

## Primary Users

- Mahasiswa
- Fresh Graduate
- Profesional
- Pelajar Bahasa Inggris

## Secondary Users

- Persiapan IELTS Speaking
- Persiapan TOEFL Speaking
- Pekerja profesional

# 5. Goals

## Business Goals

- Mendapatkan pengguna aktif.
- Menawarkan paket Premium.
- Meningkatkan retensi pengguna.

## User Goals

- Berlatih speaking setiap hari.
- Meningkatkan pronunciation.
- Meningkatkan fluency.
- Memperluas vocabulary.

# 6. Success Metrics

## MVP

- 100 pengguna pertama
- Retensi 7 hari ≥ 30%
- Minimal 5 lesson selesai per pengguna

## Premium

- Conversion Rate ≥ 5%
- Average Session ≥ 15 menit

# 7. Product Scope (MVP)

- Authentication
- Official Lessons
- Import YouTube
- Transcript
- Translation
- Vocabulary
- Audio Playback
- Shadowing Practice
- Progress Tracking

# 8. User Journey

Homepage → Dashboard → Official Lessons / Import YouTube → Shadowing
Lesson → Progress.

# 9. Functional Requirements

## Authentication

- Register
- Login
- Logout

## Official Lessons

- Daftar lesson
- Detail lesson
- Menyelesaikan lesson

## Import YouTube

- Input URL YouTube
- Menggunakan video sebagai materi belajar sesuai implementasi yang
  mematuhi hak cipta dan ketentuan platform.

## Shadowing Lesson

- Video
- Transcript
- Translation
- Vocabulary
- Play Audio
- Record Audio
- Next Sentence

## Progress

- Lesson selesai
- Total latihan
- Statistik belajar

# 10. Premium Features

## AI Pronunciation Score

- Overall Score
- Accuracy
- Fluency
- Pronunciation

## Word Analysis

- Analisis pengucapan setiap kata

## AI Pronunciation Coach

- Feedback spesifik terhadap kesalahan pengucapan

## Unlimited Features

- Unlimited Import
- Unlimited Saved Lessons
- Speaking Challenge

# 11. Non-Functional Requirements

- Responsive (Desktop, Tablet, Mobile)
- Loading \< 3 detik
- HTTPS
- Secure Authentication
- Cloud-ready

# 12. Technology Stack

## Frontend

- Next.js
- TypeScript
- Tailwind CSS
- Shadcn UI

## Backend

- Next.js API Routes
- Node.js

## Database

- Supabase PostgreSQL

## AI

- OpenAI API
- Whisper API

## Audio Processing

- FFmpeg

# 13. Monetization

## Free

- Official Lessons
- Transcript
- Translation
- Vocabulary
- Playback Speed
- Loop Sentence
- Progress

## Premium

- AI Pronunciation Score
- AI Pronunciation Coach
- Word Analysis
- Unlimited Import
- Unlimited Saved Lessons
- Speaking Challenge

# 14. Roadmap

## MVP

- Authentication
- Official Lessons
- Import YouTube
- Shadowing
- Transcript
- Translation
- Vocabulary
- Progress Tracking

## Version 1.1

- Bookmark
- Search Lesson
- Recently Learned
- User Profile

## Version 2

- AI Pronunciation Score
- AI Pronunciation Coach
- Speaking Challenge
- Unlimited Lesson Import

## Version 3

- IELTS Speaking Mode
- TOEFL Speaking Mode
- Business English
- AI Speaking Partner
- Daily Conversation Practice

# 15. Value Proposition

ShadowInglish membantu pengguna meningkatkan kemampuan berbicara bahasa
Inggris melalui metode shadowing berbasis AI dengan dukungan transcript,
translation, vocabulary, dan AI feedback sehingga proses belajar menjadi

# Product Backlog

lebih efektif dan interaktif.

| Priority  | Feature                | Status  |
| --------- | ---------------------- | ------- |
| 🔴 High   | Authentication         | ⏳ Todo |
| 🔴 High   | Official Lessons       | ⏳ Todo |
| 🔴 High   | Shadowing Player       | ⏳ Todo |
| 🔴 High   | Transcript             | ⏳ Todo |
| 🔴 High   | Translation            | ⏳ Todo |
| 🔴 High   | Vocabulary             | ⏳ Todo |
| 🟡 Medium | Progress Tracking      | ⏳ Todo |
| 🟡 Medium | Bookmark               | ⏳ Todo |
| 🟢 Low    | AI Pronunciation Score | ⏳ Todo |
| 🟢 Low    | AI Coach               | ⏳ Todo |
