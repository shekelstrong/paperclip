#!/usr/bin/env python3
"""Smart Paperclip UI -> Russian translator. Only translates string literals."""
import re, sys

TR = {
    "Dashboard": "Панель управления", "Inbox": "Входящие", "Issues": "Задачи",
    "Routines": "Процедуры", "Goals": "Цели", "Workspaces": "Рабочие области",
    "Projects": "Проекты", "Agents": "Агенты", "Org": "Оргструктура",
    "Skills": "Навыки", "Costs": "Расходы", "Activity": "Активность",
    "Settings": "Настройки", "New Issue": "Новая задача", "Search": "Поиск",
    "Work": "Работа", "Company": "Компания", "Agent": "Агент",
    "CEO": "CEO", "CEO Agent": "Агент-CEO",
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
    "Error": "Ошибка", "Failed": "Ошибка", "Warning": "Предупреждение",
    "Success": "Успешно", "Pending": "Ожидание", "Running": "Выполняется",
    "Completed": "Завершено", "Cancelled": "Отменено", "Archived": "Архивировано",
    "Draft": "Черновик", "Blocked": "Заблокировано", "Paused": "Приостановлено",
    "Active": "Активен", "Stopped": "Остановлено",
    "Title": "Название", "Name": "Имя", "Description": "Описание",
    "Status": "Статус", "Priority": "Приоритет", "Type": "Тип",
    "Assignee": "Исполнитель", "Reviewer": "Рецензент", "Approver": "Утверждающий",
    "Owner": "Владелец", "Parent": "Родитель",
    "Loading...": "Загрузка...", "Loading": "Загрузка",
    "Paperclip": "Paperclip",
    "Create Issue": "Создать задачу", "No issues found.": "Задачи не найдены.",
    "No agents found.": "Агенты не найдены.", "No results found.": "Результаты не найдены.",
    "Page not found": "Страница не найдена",
    "Sign in to Paperclip": "Вход в Paperclip",
    "Get Started": "Начать",
    "New project": "Новый проект", "New goal": "Новая цель",
}

PATTERNS = sorted(TR.keys(), key=len, reverse=True)
_pat = re.compile('|'.join(re.escape(p) for p in PATTERNS))

STRING_RE = re.compile(r'"[^"\\]*(?:\\.[^"\\]*)*"|\'[^\'\\]*(?:\\.[^\'\\]*)*\'')

def smart_translate(content):
    def replacer(m):
        full = m.group(0)
        inner = full[1:-1]
        if inner in TR:
            qt = full[0]
            return qt + TR[inner] + qt
        return full
    return STRING_RE.sub(replacer, content)

if __name__ == "__main__":
    files = sys.argv[1:] if len(sys.argv) > 1 else [line.strip() for line in sys.stdin if line.strip()]
    translated = 0
    for fp in files:
        try:
            with open(fp, 'r') as f:
                orig = f.read()
            new = smart_translate(orig)
            if new != orig:
                with open(fp, 'w') as f:
                    f.write(new)
                translated += 1
        except Exception as e:
            print("ERR " + fp + ": " + str(e), file=sys.stderr)
    print("Translated " + str(translated) + "/" + str(len(files)) + " files")
