# Beacon — Chrome extension

A Chrome extension that reads documents from your Google Drive, extracts structured data using Landing AI, and autofills web forms (including immigration forms) using the Yutori n1 vision model.

## Prerequisites

- Google Chrome browser
- A Google account (for Drive access)
- A deployed **`beacon-api`** instance (see [`beacon-api/README.md`](../beacon-api/README.md)) — **Yutori** and **Landing AI** keys live only on the server (`.env`), not in the extension
- See also: [`docs/YUTORI_PROXY.md`](../docs/YUTORI_PROXY.md)

---

## Installation

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select this `beacon-extension/` folder

---

## Usage

### First-time setup

1. Start **`beacon-api`** locally or deploy it (set `YUTORI_API_KEY` and `ALLOWED_GOOGLE_EMAILS` on the server)
2. Click the Beacon extension icon to open the sidebar
3. **Beacon API base URL** is optional if you set `BEACON_API_DEFAULT_BASE_URL` in [`defaults.js`](defaults.js) (default `http://127.0.0.1:8787`). Ensure **`beacon-api`** has `YUTORI_API_KEY` and `LANDING_AI_API_KEY` in `.env`. The URL is saved after sign-in and kept when you sign out of Google.
4. Click **Grant Drive Access** and sign in with Google when prompted (re-consent if you added new OAuth scopes)
5. A folder named **Beacon** will be created in your Google Drive automatically (or use an existing folder with that name)
6. Click **Open** to navigate to the folder and upload your documents (PDFs, Word docs, Google Docs, etc.)

### Autofilling a form

1. Navigate to the web form you want to fill
2. Open the Beacon sidebar
3. Click **Load Documents** to see files in your Beacon Drive folder
4. Click on a document — Landing AI will parse and extract all key-value fields from it
5. Review the extracted data shown in the sidebar
6. Click **Autofill Form on Current Page**
7. Yutori n1 will automatically click each field and type the corresponding value

---

## Extension Flow

```
User opens sidebar
        │
        ▼
  Beacon API base URL (Yutori + Landing keys on server only)
  Click "Grant Drive Access" → sign in with Google
        │
        ▼
  "Beacon" folder created in your Google Drive
  Upload your documents there (PDF, Word, Google Docs, etc.)
        │
        ▼
  Click "Load Documents" → see all files in your Beacon folder
        │
        ▼
  Click a document to extract its data
  → Landing AI reads the document and returns all fields as key-value pairs
        │
        ▼
  Extracted fields displayed in the sidebar
        │
        ▼
  Navigate to a web form, click "Autofill Form on Current Page"
        │
        ▼
  Yutori n1 fills the form automatically:
    1. Takes a screenshot of the page
    2. Figures out which field to click and what to type
    3. Clicks the field and types the value
    4. Takes a fresh screenshot and repeats for the next field
    5. Stops when all fields are filled
        │
        ▼
  Sidebar shows how many actions were executed
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Could not establish connection" | Reload the target page after installing/reloading the extension |
| Red dot appears in wrong position | Make sure Chrome page zoom is at 100% (View → Actual Size) |
| Autofill times out / 401 from API | beacon-api running? `YUTORI_API_KEY` set? Google token valid? Check `ALLOWED_GOOGLE_EMAILS` |
| Landing / parse errors | Set `LANDING_AI_API_KEY` on **beacon-api**; extension no longer sends a Landing key |
| Document not appearing in list | Make sure the file is inside the **Beacon** folder in Google Drive |
