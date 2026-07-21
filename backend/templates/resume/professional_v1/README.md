# professional_v1 (Harshibar)



Template-owned presentation. The API renderer passes only:



- `profile` — `ResumeProfile` JSON
- `layout` — enabled section order + labels

## Packages

Required: `tgheros`, `marvosym`, `contour`, `ulem`, `titlesec`. Contact row uses marvosym icons (`\Telefon`, `\Letter`, `\Mundus`).



## Section fields (`metadata.json` `sections`)



Templates declare which builder fields apply to each section kind. The frontend reads this via `GET /resume-builder/templates` and hides unused inputs. Unknown field ids are ignored; omitted `sections` falls back to `frontend/src/features/resume-builder/utils/sectionFieldRegistry.ts` defaults.



`professional_v1` uses a Harshibar subset:



- **projects** — `name`, `description`, optional `start_date` / `end_date` only (no tech stack, link, or role in PDF)

- **education** — institution, degree, field, dates, location, `highlights` (labeled sub-bullets e.g. Coursework/Research), optional `cgpa`

- **work_experience** — company, title, location, dates, responsibilities, impact (no tech stack in PDF)



Profile data for hidden fields is still stored on the draft for other templates.



## Authoring rules



- Put icons, macros, and section LaTeX here — not in `template_renderer.py`.

- Use `<< value|latex >>` for all user text.

- Jinja comment delimiters are `<# #>` so LaTeX `{#1}` macro args stay safe.

- Render only the fields your layout needs; ignore the rest of `ResumeProfile`.


