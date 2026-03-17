# Yutori Chrome Extension

A Chrome extension that reads documents from your Google Drive, extracts structured data using Landing AI, and autofills web forms using the Yutori n1 vision model.

## Prerequisites

- Google Chrome browser
- A Google account (for Drive access)
- A [Landing AI](https://landing.ai) API key (`VISION_AGENT_API_KEY`)
- A [Yutori](https://yutori.com) API key

---

## Installation

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select this `chrome-extension/` folder

---

## Usage

### First-time setup

1. Click the Yutori icon in the Chrome toolbar to open the sidebar
2. Enter your **Landing AI API Key** and **Yutori API Key**
3. Click **Grant Drive Access** and sign in with Google when prompted
4. A folder named **Yutori** will be created in your Google Drive automatically
5. Click **Open** to navigate to the folder and upload your documents (PDFs, Word docs, Google Docs, etc.)

### Autofilling a form

1. Navigate to the web form you want to fill
2. Open the Yutori sidebar
3. Click **Load Documents** to see files in your Yutori Drive folder
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
  Enter Landing AI + Yutori API keys
  Click "Grant Drive Access" → sign in with Google
        │
        ▼
  "Yutori" folder created in your Google Drive
  Upload your documents there (PDF, Word, Google Docs, etc.)
        │
        ▼
  Click "Load Documents" → see all files in your Yutori folder
        │
        ▼
  Click a document to extract its data
  → Landing AI reads the document and returns all fields as key-value pairs
    (e.g. first_name: Krishna, last_name: Chakka, date_of_birth: 01/01/1990)
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
| Autofill times out | Check your Yutori API key and try again |
| Landing AI 401 error | Verify your `VISION_AGENT_API_KEY` is correct |
| Document not appearing in list | Make sure the file is inside the **Yutori** folder in Google Drive |
