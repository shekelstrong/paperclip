#!/usr/bin/env python3
"""Paperclip UI → Russian — optimized: single-regex pass per file."""
import re, sys, os

TR = {
    # Nav & Core
    "Dashboard": "Панель управления", "Inbox": "Входящие", "Issues": "Задачи",
    "Routines": "Процедуры", "Goals": "Цели", "Workspaces": "Рабочие области",
    "Projects": "Проекты", "Agents": "Агенты", "Org": "Оргструктура",
    "Skills": "Навыки", "Costs": "Расходы", "Activity": "Активность",
    "Settings": "Настройки", "New Issue": "Новая задача", "Search": "Поиск",
    "Work": "Работа", "Company": "Компания", "Companies": "Компании",
    "Agent": "Агент", "CEO": "CEO", "CEO Agent": "Агент-CEO",
    "CFO": "CFO", "CTO": "CTO", "COO": "COO", "CMO": "CMO",
    "Engineer": "Инженер", "Human": "Человек", "Humans": "Люди",
    "Bot": "Бот",
    # Actions
    "Create": "Создать", "Add": "Добавить", "Edit": "Изменить",
    "Delete": "Удалить", "Save": "Сохранить", "Cancel": "Отмена",
    "Close": "Закрыть", "Back": "Назад", "Next": "Далее",
    "Confirm": "Подтвердить", "Submit": "Отправить", "Approve": "Одобрить",
    "Reject": "Отклонить", "Archive": "Архивировать", "Unarchive": "Разархивировать",
    "Copy": "Копировать", "Remove": "Удалить", "Update": "Обновить",
    "Refresh": "Обновить", "Send": "Отправить", "Test": "Проверить",
    "Run": "Запустить", "Start": "Начать", "Stop": "Остановить",
    "Sign In": "Войти", "Sign in": "Войти", "Sign Out": "Выйти",
    "Sign out": "Выйти", "Continue": "Продолжить", "Try again": "Попробовать снова",
    "Accept": "Принять", "Decline": "Отклонить", "Dismiss": "Закрыть",
    "Download": "Скачать", "Upload": "Загрузить", "Import": "Импорт",
    "Export": "Экспорт", "Retry": "Повторить", "Restart": "Перезапустить",
    "Reset": "Сбросить", "Pause": "Пауза", "Resume": "Продолжить",
    "Enable": "Включить", "Disable": "Отключить",
    "Yes": "Да", "No": "Нет", "Done": "Готово", "Ready": "Готово",
    "Clear": "Очистить", "Filter": "Фильтр", "Sort": "Сортировка",
    "All": "Все", "None": "Нет", "Default": "По умолчанию",
    "Custom": "Свой", "Auto": "Авто", "Required": "Обязательно",
    "Optional": "Опционально", "Unknown": "Неизвестно",
    "Unassigned": "Не назначен", "Unlimited": "Безлимит",
    "Unset": "Не задан", "None recorded": "Не записано",
    "Not set": "Не задано", "No description": "Нет описания",
    # Statuses
    "Active": "Активен", "Blocked": "Заблокирован",
    "Cancelled": "Отменён", "Completed": "Завершён",
    "Archived": "Архивирован", "Draft": "Черновик",
    "Error": "Ошибка", "Failed": "Ошибка",
    "Paused": "Приостановлен", "Pending": "Ожидание",
    "Running": "Выполняется", "Started": "Запущен",
    "Stopped": "Остановлен", "Success": "Успешно",
    "Healthy": "Работает", "Unhealthy": "Не работает",
    "Warning": "Предупреждение", "Critical": "Критично",
    "High": "Высокий", "Low": "Низкий", "Medium": "Средний",
    # Compound actions
    "Create Issue": "Создать задачу", "Create Agent": "Создать агента",
    "Create Project": "Создать проект", "Create Goal": "Создать цель",
    "Create Routine": "Создать процедуру", "Create Skill": "Создать навык",
    "Create Sub-Issue": "Создать подзадачу",
    "Add Agent": "Добавить агента", "Add Goal": "Добавить цель",
    "Add Project": "Добавить проект", "Add trigger": "Добавить триггер",
    "Add label": "Добавить метку", "Add environment": "Добавить окружение",
    "Add item": "Добавить элемент",
    "Save changes": "Сохранить изменения", "Save failed": "Ошибка сохранения",
    "Delete failed": "Ошибка удаления", "Update failed": "Ошибка обновления",
    "Create failed": "Ошибка создания",
    # Nav
    "Back to inbox": "Назад к входящим", "Back to approvals": "Назад к согласованиям",
    "Go to inbox": "Перейти к входящим", "View inbox": "Просмотр входящих",
    "View agent": "Просмотр агента", "View profile": "Просмотр профиля",
    "View run": "Просмотр запуска", "View more": "Показать больше",
    "Show more": "Показать больше", "Show less": "Показать меньше",
    "Show all": "Показать все", "Show full log": "Показать полный лог",
    "Hide full log": "Скрыть полный лог",
    "Show properties": "Показать свойства", "Show secret": "Показать секрет",
    # Tabs
    "Overview": "Обзор", "Details": "Детали", "History": "История",
    "Comments": "Комментарии", "Tasks": "Задачи", "Task": "Задача",
    "Sub-issues": "Подзадачи", "References": "Ссылки",
    "Documents": "Документы", "Files": "Файлы", "Secrets": "Секреты",
    "Triggers": "Триггеры", "Approvals": "Согласования",
    "Approval": "Согласование", "Configuration": "Конфигурация",
    "Advanced": "Дополнительно", "General": "Общие", "Billing": "Биллинг",
    "Access": "Доступ", "Profile": "Профиль", "Budget": "Бюджет",
    "Schedule": "Расписание", "Board": "Совет",
    "Documentation": "Документация",
    # Labels
    "Title": "Название", "Name": "Имя", "Email": "Почта",
    "Description": "Описание", "Status": "Статус",
    "Priority": "Приоритет", "Type": "Тип", "Scope": "Область",
    "Tags": "Метки", "Labels": "Ярлыки", "Assignee": "Исполнитель",
    "Assignees": "Исполнители", "Requester": "Заявитель",
    "Reviewer": "Рецензент", "Reviewers": "Рецензенты",
    "Approver": "Утверждающий", "Approvers": "Утверждающие",
    "Owner": "Владелец", "Parent": "Родитель",
    "Target": "Цель", "Target date": "Дата цели",
    "Created": "Создано", "Updated": "Обновлено",
    "Version": "Версия", "Model": "Модель",
    "Provider": "Провайдер", "Adapter": "Адаптер",
    "Adapters": "Адаптеры", "Command": "Команда",
    "Commands": "Команды", "Environment": "Окружение",
    "Environments": "Окружения", "Workspace": "Рабочая область",
    "Workspace name": "Название области", "Workspace ID": "ID области",
    "Folder": "Папка", "Repo": "Репозиторий", "Branch": "Ветка",
    "Port": "Порт", "Host": "Хост", "Path": "Путь", "URL": "URL",
    "Secret": "Секрет", "Token": "Токен", "Key": "Ключ",
    "Value": "Значение", "Skill": "Навык", "Skill name": "Название навыка",
    # Time
    "Today": "Сегодня", "Yesterday": "Вчера",
    "This week": "На этой неделе", "Last week": "На прошлой неделе",
    "This month": "В этом месяце", "Last month": "В прошлом месяце",
    "Now": "Сейчас", "Never": "Никогда",
    # Login
    "Sign in to Paperclip": "Вход в Paperclip",
    "Sign in to continue": "Войдите чтобы продолжить",
    "Sign in and continue": "Войти и продолжить",
    "Create your account": "Создайте аккаунт",
    "Create Account": "Создать аккаунт",
    "Create your Paperclip account": "Создайте аккаунт Paperclip",
    "Already have an account?": "Уже есть аккаунт?",
    "Need an account?": "Нужен аккаунт?",
    "Welcome to Paperclip": "Добро пожаловать в Paperclip",
    "Get Started": "Начать",
    "Signed in": "Выполнен вход", "Account": "Аккаунт",
    # Dashboard
    "Recent Runs": "Недавние запуски", "Active Agents": "Активные агенты",
    "Active / recent": "Активные / недавние",
    # Issues
    "Inbox zero.": "Входящие пусты.", "No new inbox items.": "Нет новых входящих.",
    "No issues assigned to you.": "Нет назначенных вам задач.",
    "No issues match your search.": "Нет задач по вашему поиску.",
    "Create one": "Создать задачу", "Issue": "Задача",
    "Sub-issue": "Подзадача", "New issue": "Новая задача",
    "Open Issues": "Открытые задачи", "My Issues": "Мои задачи",
    "Assigned to me": "Назначено мне", "Assign to me": "Назначить мне",
    "Assign to requester": "Назначить заявителю",
    "Assign tasks": "Назначать задачи",
    # Agents
    "Hire Agent": "Нанять агента", "New Agent": "Новый агент",
    "New agent": "Новый агент",
    "Agent paused": "Агент приостановлен", "Agent resumed": "Агент возобновлён",
    "Agent paused by budget": "Агент приостановлен (бюджет)",
    "Agent was paused by budget limits": "Агент приостановлен из-за лимитов",
    "Agent heartbeats blocked by budget": "Пульс агента заблокирован (бюджет)",
    "Agent join request": "Заявка агента",
    "Agent options": "Параметры агента", "Agent sort": "Сортировка агентов",
    "Agent status dots": "Индикаторы статуса",
    "No agents found.": "Агенты не найдены.",
    "Default agent": "Агент по умолчанию", "Default agent required": "Требуется агент по умолчанию",
    "Default agent set": "Агент по умолчанию задан",
    # Projects
    "New project": "Новый проект", "No projects found.": "Проекты не найдены.",
    "No projects yet.": "Пока нет проектов.",
    "No Project": "Без проекта", "Project default": "По умолчанию проекта",
    # Goals
    "Goal": "Цель", "New goal": "Новая цель",
    "No goals yet.": "Пока нет целей.", "Create goal": "Создать цель",
    # Routines
    "Routine": "Процедура", "Routine created": "Процедура создана",
    "Routine saved": "Процедура сохранена", "Routine run started": "Запуск процедуры начат",
    "Routine run failed": "Запуск процедуры не удался",
    "New routine": "Новая процедура", "No routines yet.": "Пока нет процедур.",
    "Run routine": "Запустить процедуру", "Run now": "Запустить сейчас",
    # Skills
    "Skill created": "Навык создан", "Skill saved": "Навык сохранён",
    "Skill updated": "Навык обновлён", "Skill removed": "Навык удалён",
    "Skill creation failed": "Ошибка создания навыка",
    "Skill import failed": "Ошибка импорта навыка",
    "Create skill": "Создать навык", "Remove skill": "Удалить навык",
    "Filter skills": "Фильтр навыков",
    # Costs
    "Usage": "Использование", "Credits": "Кредиты",
    "All-time tokens": "Токены за всё время", "USD": "USD",
    # Budget
    "Budget healthy": "Бюджет в норме", "Budget warning": "Предупреждение бюджета",
    "Budget paused": "Бюджет приостановлен",
    "Set budget": "Установить бюджет", "Update budget": "Обновить бюджет",
    # Workspaces
    "Working directory": "Рабочая директория", "Local folder": "Локальная папка",
    "Set local folder": "Задать папку", "Change local folder": "Сменить папку",
    "Clear local folder": "Очистить папку",
    "GitHub repo": "Репозиторий GitHub", "Repo URL": "URL репозитория",
    "Clear repo": "Очистить репозиторий", "No Workspace": "Без области",
    "Start services": "Запустить службы", "Stop services": "Остановить службы",
    # Secrets
    "Create secret": "Создать секрет", "Secret created": "Секрет создан",
    "Secret deleted": "Секрет удалён", "Secret name": "Название секрета",
    "No secrets yet.": "Пока нет секретов.",
    # Misc
    "Paperclip": "Paperclip", "Loading...": "Загрузка...",
    "Loading": "Загрузка", "An error occurred": "Произошла ошибка",
    "Unexpected error": "Неожиданная ошибка",
    "Action failed": "Действие не удалось", "Request failed": "Запрос не удался",
    "The request failed.": "Запрос не выполнен.",
    "Please fill in all required fields.": "Заполните все обязательные поля.",
    "This field is required": "Обязательное поле",
    "No results found.": "Результаты не найдены.",
    "Coming soon": "Скоро", "Preview": "Предпросмотр",
    "Page not found": "Страница не найдена",
    "This route does not exist.": "Этого маршрута не существует.",
    "Not Found": "Не найдено", "Select...": "Выбрать...",
    "Select an option": "Выберите вариант",
}

# Sort by length descending so longer strings match first
PATTERNS = sorted(TR.keys(), key=len, reverse=True)

# Build a single compiled regex: all keys joined by |
_pat = re.compile('|'.join(re.escape(p) for p in PATTERNS))

def translate(text):
    return _pat.sub(lambda m: TR[m.group()], text)

if __name__ == "__main__":
    files = sys.argv[1:] if len(sys.argv) > 1 else [line.strip() for line in sys.stdin if line.strip()]
    translated = 0
    for fp in files:
        try:
            with open(fp, 'r') as f:
                orig = f.read()
            new = translate(orig)
            if new != orig:
                with open(fp, 'w') as f:
                    f.write(new)
                translated += 1
        except Exception as e:
            print(f"ERR {fp}: {e}", file=sys.stderr)
    print(f"Translated {translated}/{len(files)} files")
