# Billow

Landing page for Billow, invoicing and payments software for freelancers, studios and small agencies: send a quote, turn it into an invoice, collect payment online and keep the books in step, without chasing anyone.

## Run it

Plain HTML, CSS and JavaScript with no build step or dependencies. Open `index.html` in a browser, or serve the folder locally:

```bash
python3 -m http.server 4321
```

then visit http://localhost:4321.

## What's in the folder

| Path | Contents |
|---|---|
| `index.html` | Page markup |
| `styles.css` | All styles. Design tokens (colours, spacing, radius) are at the top in `:root` |
| `script.js` | Interactions: nav dropdowns and phone menu, hero slider, stat odometer, scroll fills, card animations, CTA photos, footer word swap, form validation |
| `images/` | Web-sized photos the page uses |
| `source-images/` | Original full-size photos |

## Before launch

Several things are placeholders:

- Stats, testimonials, the case study, company facts and pricing are sample content.
- Buttons and most footer links point to `#`.
- The sign-up and newsletter forms only validate the email; they aren't connected to a backend.

All animations respect the visitor's reduced-motion setting.
