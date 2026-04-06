# DeltaOps UI Style Guide

Полное описание дизайн-системы проекта. Используй этот документ как справочник при разработке новых страниц, компонентов и при рефакторинге UI.

---

## Стек

| Технология | Версия | Роль |
|---|---|---|
| Vue 3 | — | SPA фреймворк, Composition API + `<script setup>` |
| Tailwind CSS | v4.2 | Utility-first CSS, интеграция через `@tailwindcss/vite` |
| Vite | 8.x | Сборщик, dev-сервер |
| Vue Router | — | SPA-роутинг |
| Pinia | — | State management |

**Tailwind v4**: конфигурация через `@theme` директиву в `main.css` (нет `tailwind.config.js`).

---

## Цветовая палитра

### Основные цвета

| Токен | Hex | Назначение |
|---|---|---|
| **Body BG** | `#0f0f0f` | Фон приложения (почти чёрный) |
| **Surface** | `#1a1a1a` | Фон инпутов, карточек, вложенных элементов |
| **Surface Alt** | `#191919` | Альт. фон (дропдауны) |
| **Surface Elevated** | `#171717` | Header/Sidebar glassmorphism base |
| **Border** | `#2e2e2e` | Граница инпутов, разделители |
| **Border Hover** | `#444444` | Граница при hover |
| **Border Subtle** | `neutral-800/60` | Граница header/sidebar/nav |
| **Text Primary** | `#e5e5e5` | Основной текст |
| **Text Secondary** | `#d4d4d4` | Инпуты, менее важный текст |
| **Text Muted** | `#a3a3a3` | Второстепенный (neutral-400) |
| **Text Dim** | `#525252` | Placeholder, подсказки (neutral-600) |
| **Text Faint** | `#404040` | Hint-текст (neutral-700) |

### Акцентные цвета

| Токен CSS | Hex | Использование |
|---|---|---|
| `--color-delta-green` | `#f97316` | **Primary accent** (оранжевый, несмотря на имя) — кнопки, фокус, active-state, accent-color |
| `--color-delta-accent` | `#e2b714` | Secondary accent (жёлтый) |
| `--color-delta-dark` | `#1a1a2e` | Dark blue (исторический, редко используется) |
| `--color-delta-darker` | `#16213e` | Darker blue (исторический) |

### Olive (бренд/военная тема)

| Токен | Hex |
|---|---|
| `--color-olive-400` | `#a3b763` |
| `--color-olive-500` | `#8a9a4e` |
| `--color-olive-600` | `#6b7a3a` |
| `--color-olive-900` | `#2d3518` |

### Статусные цвета

| Токен | Hex | Статус |
|---|---|---|
| `--color-status-confirmed` | `#22c55e` | Буду (зелёный) |
| `--color-status-tentative` | `#eab308` | Возможно (жёлтый) |
| `--color-status-absent` | `#ef4444` | Не буду (красный) |
| `--color-status-no-response` | `#6b7280` | Не ответил (серый) |

### Навыки

| Токен | Hex | Уровень |
|---|---|---|
| `--color-skill-experienced` | `#22c55e` | Опытный |
| `--color-skill-intermediate` | `#eab308` | Средний |
| `--color-skill-beginner` | `#6b7280` | Новичок |

### Игровые стороны (missions)

| Сторона | BG | Border | Text | Dot |
|---|---|---|---|---|
| blue | `bg-blue-500/20` | `border-blue-500/40` | `text-blue-400` | `bg-blue-500` |
| red | `bg-red-500/20` | `border-red-500/40` | `text-red-400` | `bg-red-500` |
| green | `bg-emerald-500/20` | `border-emerald-500/40` | `text-emerald-400` | `bg-emerald-500` |

---

## Типографика

### Шрифты

Системный стек (Tailwind default):
```
-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif
```

Кастомных шрифтов нет. Моноширинный: `font-mono` (системный).

### Размеры текста

| Класс | Использование |
|---|---|
| `text-[10px]` | Мобильная навигация, мелкие badge-лейблы |
| `text-xs` (12px) | Badges, мета-информация, лейблы секций |
| `text-[13px]` | Sidebar nav items |
| `text-sm` (14px) | Основной UI-текст, инпуты, кнопки |
| `text-base` (16px) | Заголовки секций |
| `text-lg` (18px) | Заголовки модалок |
| `text-xl`–`text-2xl` | Заголовки страниц |
| `text-5xl`–`text-7xl` | Hero landing page |

### Толщина шрифта

| Класс | Использование |
|---|---|
| `font-normal` | Обычный текст |
| `font-medium` | Badges, лейблы |
| `font-semibold` | Кнопки, nav items, подзаголовки |
| `font-bold` | Заголовки, header name |
| `font-black` | Hero title (landing) |

### Tracking (letter-spacing)

| Класс | Использование |
|---|---|
| `tracking-wide` | Header name |
| `tracking-wider` | Section labels |
| `tracking-[0.15em]` | Hero title |
| `tracking-[0.2em]` | Sidebar section labels |
| `tracking-[0.35em]` | Landing subtitle |

---

## Layout (Разметка)

### Структура приложения

```
┌──────────────── AppHeader (sticky, glassmorphism) ─────────────────┐
├──────────┬─────────────────────────────────────────────────────────┤
│          │                                                         │
│ Sidebar  │  <main> (flex-1, p-4 md:p-6, overflow-auto)           │
│ (sticky) │    ┌─ ambient glow (orange, fixed, pointer-events-none)│
│ w-56 /   │    └─ <router-view />                                  │
│ w-[68px] │                                                         │
│          │                                                         │
├──────────┴─────────────────────────────────────────────────────────┤
│ mobile: MobileNav (fixed bottom, glassmorphism)  [md:hidden]      │
└────────────────────────────────────────────────────────────────────┘
```

### Desktop (md+)

- **Header**: `sticky top-0 z-40` — glassmorphism `rgba(23,23,23,0.85) + blur(12px)`
- **Sidebar**: `sticky top-[49px] h-[calc(100vh-49px)]` — gradient bg, `w-56` expanded / `w-[68px]` collapsed, `hidden md:flex`
- **Main**: `flex-1 p-4 md:p-6 overflow-auto relative`
- **Ambient glow**: `fixed top-0 right-0 w-[500px] h-[500px] bg-orange-600/[0.02] rounded-full blur-[150px]`

### Mobile (< md)

- Header остаётся
- Sidebar скрыт (`hidden md:flex`)
- MobileNav: `fixed bottom-0 left-0 right-0 z-50` — glassmorphism `rgba(18,18,18,0.9) + blur(12px)`
- Main padding: `p-4` (меньше чем на desktop)

### Breakpoints

Стандартные Tailwind:
- `sm` — 640px
- `md` — 768px (основной breakpoint: sidebar ↔ mobile nav)
- `lg` — 1024px

### Responsive паттерны

```html
<!-- Показать/скрыть -->
<div class="hidden md:flex">desktop only</div>
<div class="md:hidden">mobile only</div>

<!-- Grid адаптация -->
<div class="grid grid-cols-2 md:grid-cols-4 gap-3">

<!-- Flex адаптация -->
<div class="flex flex-col sm:flex-row items-center gap-3">

<!-- Padding адаптация -->
<main class="p-4 md:p-6">
```

---

## Компоненты

### Карточка / Контейнер

```html
<div class="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
  <!-- content -->
</div>

<!-- С hover эффектом -->
<div class="bg-neutral-900 border border-neutral-800 rounded-xl p-4
            hover:border-neutral-700 transition-all card-hover">
```

CSS-класс `card-hover` добавляет `translateY(-1px)` + box-shadow при hover.

### Кнопки

**Primary** (оранжевый):
```html
<button class="bg-orange-600/90 hover:bg-orange-500 text-white px-8 py-3 rounded-lg
               font-semibold transition-colors">
```

**Secondary** (прозрачный с рамкой):
```html
<button class="bg-transparent border border-neutral-600/40 hover:border-neutral-500/60
               text-neutral-300 hover:text-white px-6 py-3 rounded-lg transition-colors">
```

**Tertiary** (минимальный):
```html
<button class="text-neutral-500 hover:text-neutral-300 text-xs px-2 py-1.5
               rounded hover:bg-neutral-800/50 transition-colors">
```

**Disabled**: `opacity-50 cursor-not-allowed` или `disabled:opacity-50 disabled:cursor-not-allowed`

### Модалка (BaseModal)

```vue
<BaseModal :title="'Заголовок'" @close="close" :wide="false">
  <slot />
</BaseModal>
```

- Teleport в body
- Overlay: `bg-black/60`
- Box: `bg-neutral-900 border-neutral-700 rounded-xl shadow-2xl`
- Max width: `max-w-md` (default) или `max-w-2xl` (`:wide`)
- Max height: `max-h-[calc(100vh-2rem)]` + overflow-y-auto

### Бейджи

**StatusBadge**: `rounded-full text-white font-medium` + цвет из `PLAYER_STATUSES`
**SkillBadge**: `rounded-full text-xs` + цвет из `SKILL_LEVELS`
**EquipmentTag**: `rounded text-xs text-white font-medium` + динамический цвет из store
**Admin badge**: `bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded`

### Select (BaseSelect)

Кастомный dropdown, заменяет нативный `<select>`:
- Trigger: `bg-[#1a1a1a] border-[#2e2e2e] rounded-lg`
- Dropdown: Teleport в body, `bg-[#191919] border-[#333] rounded-lg shadow-xl`
- Active option: `bg-orange-500/15 text-orange-400`
- Hover: `bg-[#252525] text-white`
- Поддерживает drop-up когда мало места снизу
- Размеры: `sm` | `md`

### Checkbox (BaseCheckbox)

Кастомный, заменяет нативный:
- Unchecked: `bg-[#1a1a1a] border-[#444]`
- Checked: `bg-orange-500 border-orange-500` + белая галочка
- Размеры: `sm` (3.5) | `md` (4)

### Toast (ToastContainer)

- Fixed `top-4 right-4 z-[100]`
- Типы: `success` (green), `error` (red), `warning` (amber), `info` (neutral)
- Анимация: slide-in from right

### Спиннер (LoadingSpinner)

```html
<div class="w-8 h-8 border-2 border-neutral-700 border-t-delta-green rounded-full animate-spin">
```

### ImageLightbox

Полноэкранный просмотр изображений:
- `bg-black/95` overlay
- Навигация стрелками + клавиатура
- Счётчик `1 / N`

---

## Формы

Все формы стилизованы глобально в `main.css`:

| Элемент | Background | Border | Focus |
|---|---|---|---|
| input/textarea | `#1a1a1a` | `1px solid #2e2e2e` | `border: #f97316` + `box-shadow 1px orange/15` |
| select | `#1a1a1a` | `1px solid #2e2e2e` | аналогично |
| checkbox | `#1a1a1a` | `1.5px solid #444` | checked: `bg #f97316` |
| radio | `#1a1a1a` | `1.5px solid #444` | checked: `border #f97316` + dot |
| range | track `#333` | — | thumb: `bg #f97316`, 14px |

Placeholder: `#525252`. Disabled: `opacity: 0.5`.

---

## Иконки

**Подход**: Inline SVG paths (без внешних библиотек).

```html
<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24"
     stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="..." />
</svg>
```

- ViewBox: `0 0 24 24`
- Stroke-based, `stroke-width="2"` (или `1.5` для тонких)
- Цвет через `stroke="currentColor"` + Tailwind text-color
- Размеры: `w-3.5 h-3.5` (sidebar), `w-5 h-5` (mobile nav), `w-8 h-8` (header logo), `w-10 h-10` (lightbox arrows)

Набор иконок (ICON_PATHS): user, grid, layers, chart, users, shield, archive, settings, chevron.

---

## Glassmorphism

Используется в sticky элементах навигации:

```css
/* Header */
background: rgba(23, 23, 23, 0.85);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);

/* Sidebar */
background: linear-gradient(180deg, rgba(23,23,23,0.95), rgba(18,18,18,0.98));

/* Mobile Nav */
background: rgba(18, 18, 18, 0.9);
backdrop-filter: blur(12px);
```

Всегда с border: `border-b border-neutral-800/60` (header), `border-r border-neutral-800/60` (sidebar), `border-t border-neutral-800/60` (mobile nav).

---

## Анимации и переходы

### Transition классы

| Класс | Использование |
|---|---|
| `transition-all duration-150` | Кнопки, карточки |
| `transition-colors` | Hover на тексте, иконках |
| `transition-opacity duration-300` | Появление/исчезновение |
| `transition-transform duration-200` | Sidebar expand/collapse |

### Keyframe анимации

| Класс | Назначение |
|---|---|
| `animate-spin` | Спиннер загрузки |
| `animate-pulse` | Пульсация при загрузке (logo) |
| `animate-bounce` | Привлечение внимания |
| `animate-pulse-slow` | Медленная пульсация (4s, hero) |

### Transition Groups (Vue)

Toast: `opacity + translateX(40px)` — slide in/out from right.
BaseSelect dropdown: `opacity + scale(0.97)` — fade + slight scale.

---

## Ambient эффекты

### App Background

```css
.app-bg {
  background: #0f0f0f;
  background-image:
    radial-gradient(ellipse at 0% 0%, rgba(249, 115, 22, 0.03) 0%, transparent 50%),
    radial-gradient(ellipse at 100% 100%, rgba(138, 154, 78, 0.02) 0%, transparent 50%);
}
```

### Ambient Glow (в main)

```html
<div class="pointer-events-none fixed top-0 right-0
            w-[500px] h-[500px] bg-orange-600/[0.02]
            rounded-full blur-[150px]"></div>
```

### Selection

```css
::selection {
  background: rgba(249, 115, 22, 0.3);
  color: white;
}
```

### Scrollbar

Webkit: 6px, thumb `rgba(255,255,255,0.08)`, hover `rgba(255,255,255,0.15)`.
Firefox: `scrollbar-width: thin`.

---

## Таблицы

```html
<!-- Header row -->
<th class="text-xs text-neutral-500 font-medium px-4 py-2">

<!-- Body rows -->
<tr class="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
  <td class="px-4 py-2.5">
```

---

## Z-Index порядок

| Z | Элемент |
|---|---|
| `z-10` | Content relative |
| `z-40` | AppHeader |
| `z-50` | MobileNav, BaseModal overlay |
| `z-[100]` | ToastContainer, ImageLightbox |
| `z-[9999]` | BaseSelect dropdown (teleported) |

---

## Файловая структура стилей

```
src/
  assets/
    styles/
      main.css          ← Глобальные стили: @theme токены, формы, утилиты
      style.css          ← Консолидированные дизайн-токены (справочник)
  components/
    layout/
      AppHeader.vue      ← scoped: .header-glass
      AppSidebar.vue     ← scoped: .sidebar-bg
      MobileNav.vue      ← scoped: .mobile-nav-glass
    common/
      BaseModal.vue      ← Модалка
      BaseSelect.vue     ← Кастомный select
      BaseCheckbox.vue   ← Кастомный checkbox
      StatusBadge.vue    ← Бейдж статуса
      SkillBadge.vue     ← Бейдж навыка
      EquipmentTag.vue   ← Тег экипировки
      LoadingSpinner.vue ← Спиннер
      ToastContainer.vue ← Нотификации
      ImageLightbox.vue  ← Просмотр фото
  utils/
    constants.js         ← PLAYER_STATUSES, SKILL_LEVELS, SIDE_COLORS, EQUIPMENT_COLOR_OPTIONS
  App.vue                ← scoped: .app-bg
  pages/
    LandingPage.vue      ← scoped: hero grid, scanlines, pulse-slow
```

---

## Принципы дизайна

1. **Dark-only** — нет light mode, все компоненты предполагают тёмный фон
2. **Orange accent** — `#f97316` как единственный акцентный цвет для интерактива
3. **Glassmorphism** — полупрозрачные фоны + blur на sticky элементах
4. **Utility-first** — максимум Tailwind классов, минимум кастомного CSS
5. **Scoped styles** — кастомный CSS только в `<style scoped>` для уникальных эффектов (glass, gradients)
6. **Subtle depth** — opacity-варианты для создания глубины (`/[0.02]`, `/0.1`, `/0.3`)
7. **Military/gaming aesthetic** — olive палитра, small-caps, tracking, minimal ornament
8. **Mobile-first** — base styles для мобилки, `md:` для desktop
9. **Inline SVG** — без внешних icon-библиотек, все иконки как SVG path
10. **System fonts** — без загрузки внешних шрифтов, быстрый старт
