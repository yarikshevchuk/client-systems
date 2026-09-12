# Документація

```
docs/
├── product/        що будуємо і для кого
├── architecture/   як це влаштовано
├── development/    як з цим працювати
└── project/        хто, коли, що відкрито
```

## Мапа документів

Статуси: ⚪ шаблон · 🟡 чернетка · 🟢 узгоджено.

| Розділ | Документ | Про що | Статус |
|---|---|---|---|
| Продукт | [vision.md](product/vision.md) | Проблема, для кого, цінність, цілі й не-цілі | 🟡 |
| | [requirements.md](product/requirements.md) | MVP-скоуп, функціональні та нефункціональні вимоги | 🟡 |
| | [user-flows.md](product/user-flows.md) | Ключові сценарії та перелік екранів | 🟡 |
| | [glossary.md](product/glossary.md) | Словник термінів | 🟡 |
| Архітектура | [overview.md](architecture/overview.md) | Пайплайн, компоненти, стек | 🟡 |
| | [data-model.md](architecture/data-model.md) | Сутності та зв'язки | 🟡 |
| | [api.md](architecture/api.md) | Контракт REST API між фронтом і беком | ⚪ |
| | [decisions/](architecture/decisions/README.md) | Журнал архітектурних рішень (ADR) | ⚪ |
| Розробка | [setup.md](development/setup.md) | Як підняти проєкт локально | ⚪ |
| | [conventions.md](development/conventions.md) | Мова, гілки, коміти, PR, код-стайл | ⚪ |
| Проєкт | [team.md](project/team.md) | Склад команди, ролі, зони відповідальності | ⚪ |
| | [roadmap.md](project/roadmap.md) | Вимоги курсу, етапи, дедлайни | 🟡 |
| | [open-questions.md](project/open-questions.md) | Відкриті питання — живий список | 🟡 |

## Правила

- Один документ — одна тема. Нова велика тема — новий файл у відповідному розділі + рядок у таблиці вище.
- Незаповнене місце позначаємо `TBD (Qn)`, де `Qn` — номер питання в [open-questions.md](project/open-questions.md).
- Рішення, що змінює архітектуру чи стек, спершу оформлюємо як ADR у [decisions/](architecture/decisions/README.md), потім оновлюємо профільний документ.
- PR, що змінює поведінку застосунку, оновлює й відповідні документи.
