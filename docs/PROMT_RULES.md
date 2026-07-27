- Selalu baca PRD.md sebelum mengerjakan task.
- Selalu baca AI_CONTEXT.md.
- Fokus hanya pada task yang diminta.
- Jangan menambahkan fitur baru tanpa instruksi.
- Jangan mengubah wireframe.
- Jangan mengubah struktur project.
- Jangan mengubah stack teknologi.

---

Gunakan

- TypeScript Strict
- Functional Component
- App Router
- React Hooks
- React Query
- Zustand
- React Hook Form
- Zod

---

Design Style

- Linear Inspired
- Minimal
- Clean
- Responsive

Desktop First (MVP)

- Implementasikan layout desktop sesuai wireframe.
- Gunakan Tailwind CSS dengan breakpoint yang baik.
- Hindari fixed width yang menyulitkan responsive.
- Komponen harus reusable.
- Responsive akan menjadi task tersendiri setelah semua halaman MVP selesai.

Gunakan

- Tailwind CSS

Icons

- Lucide

Animasi

- Hover
- Transition

Hindari animasi berlebihan.

---

Gunakan struktur

app/

components/

features/

hooks/

lib/

services/

types/

constants/

utils/

---

Gunakan struktur

app/

components/

features/

hooks/

lib/

services/

types/

constants/

utils/

---

Gunakan

Supabase PostgreSQL

Semua migration harus jelas.

Gunakan UUID.

Gunakan timestamp.

Gunakan soft delete bila diperlukan.

---

Jangan gunakan any.

Gunakan interface atau type.

Pisahkan reusable component.

Pisahkan business logic.

Gunakan custom hook jika logic dipakai lebih dari sekali.

Jangan hardcode.

Gunakan Environment Variable.

Selalu lakukan error handling.

---

Setiap task harus mengikuti urutan:

1.

Baca PRD.md

2.

Baca AI_CONTEXT.md

3.

Pahami Wireframe

4.

Jelaskan rencana implementasi

5.

Sebutkan edge case

6.

Implementasikan kode

7.

Lakukan self review

8.

Jelaskan perubahan

9.

Sebutkan task berikutnya

10.

Berhenti.
Jangan mengerjakan task berikutnya tanpa instruksi.

---

AI tidak boleh:

- mengubah layout
- mengubah dependency
- mengubah struktur folder
- mengubah arsitektur

tanpa meminta persetujuan user.

---

Gunakan Conventional Commit.

Contoh

feat:

fix:

refactor:

docs:

test:

chore:

---

Jika membuat fitur baru

Update

BACKLOG.md

ROADMAP.md

bila memang berubah.

---

Sebelum memberikan kode.

AI harus menjelaskan:

- Apa yang akan dibuat.

Setelah selesai.

AI harus menjelaskan

- File yang berubah.
- Kenapa berubah.
- Apa yang perlu dites.
