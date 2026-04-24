# damicohealth.com

Static product website for **DH Field EMR** — an electronic medical record app
for international medical outreach and global health teams, published by
Damico Health Inc.

The site is a plain HTML + CSS + a sprinkle of vanilla JS build — no
frameworks, no build step. It is deployed via GitHub Pages to the custom
domain `damicohealth.com` (see `CNAME`).

## Structure

```
/                   -> index.html           Homepage (single-page scroll)
/privacy/           -> privacy/index.html   Privacy Policy
/terms/             -> terms/index.html     Terms of Service
/styles.css                                 Shared stylesheet
/CNAME                                      GitHub Pages custom domain
```

## Local preview

Any static file server will do. From this directory:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deployment

Pushes to the default branch are served by GitHub Pages. The `CNAME`
file configures the custom domain.

## Brand tokens

| Token        | Value      |
|--------------|------------|
| Primary      | `#F68630`  |
| Dark orange  | `#c2590a`  |
| Light bg     | `#fff7ed`  |
| Text         | `#1f2937`  |
| Muted text   | `#6b7280`  |
| Success      | `#10b981`  |
| Danger       | `#ef4444`  |

Fonts are loaded from Google Fonts: Quicksand (headings) and Mulish (body).

## Editing

- Marketing copy lives inline in `index.html`.
- Legal copy lives inline in `privacy/index.html` and `terms/index.html`.
- Global design tokens are defined as CSS custom properties at the top of
  `styles.css`.

## License

Copyright &copy; 2026 Damico Health Inc. All rights reserved.
