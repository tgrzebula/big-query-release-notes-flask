# BigQuery Release Hub (Flask Version) 🚀

This is a premium, feature-rich web application built with Python Flask and vanilla HTML5, CSS3, and JavaScript. It fetches the Google Cloud BigQuery Release Notes feed, parses it dynamically, and presents the updates in a chronological glassmorphic timeline dashboard.

This project was built as part of the **[5-Day AI Agents Intensive Vibe Coding Course with Google](https://www.kaggle.com/competitions/5-day-ai-agents-intensive-vibecoding-course-with-google)** on Kaggle.

---

## Features ✨

- **Atom Feed Parser**: Fetches and segments release notes dynamically on the backend.
- **Side Panel Metrics**: Animated counters showing Features, Announcements, Changes, and Breaking updates.
- **Twitter/X Sharing**: Share individual release notes with a single click, featuring automatic formatting, character limit truncation (280 chars), and a deep link pointing back to the specific update's timeline anchor.
- **Premium Glassmorphic Design**: Responsive sidebar, customized scroll progress indicator, glowing backdrops, and active status indicators.
- **Search & Filter**: Real-time keyword filtering with syntax-highlighted markups and shortcuts (`/` key).
- **Bookmarks Engine**: Save release notes to a locally cached list (stored in `localStorage`).

---

## Setup & Running 💻

### 1. Create and Activate Virtual Environment
```bash
python -m venv .venv
.venv\Scripts\activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the App
```bash
python app.py
```
Open your browser to `http://127.0.0.1:5000`.
