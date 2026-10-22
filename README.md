<div align="center">

<img src="docs/board.jpg" alt="Неделя на двоих">

# Неделя на двоих

**Канбан-доска на неделю для двоих: вход по секретной ссылке, realtime, drag and drop.**

<img src="https://img.shields.io/badge/React_19-149ECA?style=flat-square&logo=react&logoColor=white" alt="React 19"> <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"> <img src="https://img.shields.io/badge/Tailwind_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind 4"> <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase"> <img src="https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white" alt="Vitest"> <img src="https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white" alt="Vercel">

<a href="https://duo-week.vercel.app"><img src="https://img.shields.io/badge/▶_Открыть_демо-000000?style=for-the-badge" alt="Демо"></a>

</div>

<table>
<tr>
<td align="center" valign="top"><img src="docs/mobile.jpg" alt="Мобильная версия" width="260"></td>
</tr>
</table>

<!-- header:end -->
Канбан-доска на неделю для двух человек. Без регистрации: вход по секретной ссылке-приглашению, изменения прилетают обоим в реальном времени.

**Демо:** https://duo-week.vercel.app

## Что умеет

- **Доступ по ссылке.** Ключ доски передаётся в заголовке `x-board-key` и проверяется политиками RLS в Supabase, аккаунты не нужны.
- **Drag and drop** между днями, статусами и дорожками участников (dnd-kit), с оптимистичными обновлениями.
- **Быстрое добавление с разбором текста:** `Купить билеты @Макс #поездка ! завтра 18:30` → исполнитель, тег, приоритет, дата и время.
- **Карточка задачи:** чек-лист, теги, время, приоритет; отмена удаления.
- **Статистика недели:** прогресс, столбцы по дням, вклад каждого участника.
- **Мгновенное открытие:** последний снимок доски кэшируется локально, свежие данные подтягиваются следом.

## Стек

React 19 · TypeScript · Vite · Tailwind CSS 4 · dnd-kit · Supabase (Postgres, RLS, Realtime) · Vitest · Oxlint · Vercel

## Запуск

```bash
npm install
cp .env.example .env.local   # вписать URL и anon-ключ своего проекта Supabase
npm run dev
npm test                     # юнит-тесты парсера и сортировки
```

Посмотреть интерфейс без Supabase можно через `demo.html`: там доска работает на in-memory-бэкенде (`src/api/memory.ts`).
