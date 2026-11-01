import uuid
from datetime import datetime, timedelta

import db
from auth import hash_password

DEMO_PASSWORD = "demo"

COMPLEXITY = (
    "Алгоритм — це скінченна послідовність кроків, яка розв'язує задачу. Часова складність описує, як зростає час "
    "роботи алгоритму зі збільшенням розміру вхідних даних n. Нотація Big O дає верхню межу цього зростання. "
    "Цикл по n елементах має складність O(n), два вкладені цикли дають O(n^2), а поділ даних навпіл на кожному "
    "кроці дає O(log n). Просторова складність показує, скільки додаткової пам'яті потрібно алгоритму. "
    "Алгоритми порівнюють за найгіршим випадком, бо він дає гарантію для будь-яких вхідних даних."
)
SORTING = (
    "Сортування впорядковує елементи списку. Сортування бульбашкою багаторазово міняє місцями сусідні елементи, "
    "що стоять у неправильному порядку, і працює за час O(n^2). Сортування злиттям ділить список навпіл, "
    "сортує кожну половину й зливає результати за час O(n log n). Швидке сортування обирає опорний елемент "
    "і розбиває список навколо нього, що в середньому дає O(n log n). Алгоритм сортування називають стабільним, "
    "якщо він зберігає порядок однакових елементів."
)
GRAPHS = (
    "Граф складається з вершин, з'єднаних ребрами. Пошук у ширину (BFS) відвідує вершини рівень за рівнем "
    "за допомогою черги й знаходить найкоротший шлях у графі без ваг. Пошук у глибину (DFS) заходить якомога "
    "глибше вздовж кожної гілки за допомогою стеку або рекурсії, а потім повертається назад. Обидва алгоритми "
    "відвідують кожну вершину й ребро один раз, тому працюють за час O(V + E). Граф можна зберігати як список "
    "суміжності або як матрицю суміжності."
)
RELATIONAL = (
    "Реляційна база даних зберігає дані в таблицях із рядків і стовпців. Первинний ключ однозначно ідентифікує "
    "кожен рядок таблиці. Зовнішній ключ зв'язує рядок із рядком іншої таблиці. SQL — це мова для запитів "
    "і зміни даних. Оператор SELECT читає рядки, JOIN об'єднує рядки двох таблиць, а індекс пришвидшує пошук "
    "у великій таблиці."
)
TRANSACTIONS = (
    "Транзакція — це група операцій, яку база даних розглядає як одне ціле. Атомарність означає, що або всі "
    "операції транзакції виконуються, або жодна. Ізоляція не дає паралельним транзакціям бачити незавершені "
    "зміни одна одної. Довговічність гарантує, що зафіксовані дані переживуть збій. PostgreSQL реалізує ці "
    "правила через журнал попереднього запису та багатоверсійний контроль паралелізму."
)
ERRORS = (
    "Чисельні методи працюють із наближеними числами, тому кожен результат має похибку. Абсолютна похибка — це "
    "різниця між точним і наближеним значенням. Відносна похибка ділить абсолютну на точне значення. Система "
    "рівнянь погано обумовлена, якщо мала зміна вхідних даних спричиняє велику зміну результату. Число "
    "обумовленості вимірює цю чутливість."
)
HTTP = (
    "Веб працює за моделлю клієнт-сервер. Браузер надсилає HTTP-запит, а сервер повертає відповідь зі статус-кодом, "
    "заголовками й тілом. REST описує ресурси через URL і використовує методи GET, POST, PUT та DELETE. "
    "HTTP не зберігає стан, тому сервер розпізнає користувача за cookie або токеном, який надсилається з кожним "
    "запитом. Статус-коди на 2 означають успіх, на 4 — помилку клієнта, а на 5 — помилку сервера."
)
REACT = (
    "React будує інтерфейс із компонентів. Компонент отримує props від батьківського компонента й має власний "
    "стан. Коли стан змінюється, React знову відображає компонент і оновлює лише змінену частину DOM. Дані "
    "течуть в одному напрямку, від батьків до дітей. Ліниве завантаження ділить код на частини, які браузер "
    "завантажує лише тоді, коли екран їх потребує."
)
TCP = (
    "TCP надійно доставляє потік байтів у правильному порядку. З'єднання починається з триетапного рукостискання. "
    "Отримувач підтверджує дані, які отримав, а відправник надсилає їх знову, якщо підтвердження не надійшло. "
    "Керування потоком не дає швидкому відправнику перевантажити повільного отримувача. Керування перевантаженням "
    "уповільнює відправника, коли мережа переповнена."
)

LAB_SEARCH = (
    "Лабораторна 1. Виміряйте час роботи лінійного й бінарного пошуку на списках із 1000, 10000 і 100000 "
    "елементів та поясніть результати за допомогою нотації Big O."
)
LAB_SORT = (
    "Лабораторна 2. Реалізуйте сортування бульбашкою та злиттям, порахуйте кількість порівнянь для випадкових "
    "списків і порівняйте два алгоритми в короткому звіті."
)
LAB_GRAPH = (
    "Лабораторна 3. Реалізуйте BFS і DFS для графа у вигляді списку суміжності та виведіть порядок, "
    "у якому відвідуються вершини."
)
LAB_SQL = (
    "Лабораторна 1. Створіть дві пов'язані таблиці й напишіть п'ять запитів SELECT з JOIN. Опишіть первинні "
    "та зовнішні ключі, які ви використали."
)
LAB_TX = "Лабораторна 2. Покажіть у двох сесіях, як працює ізоляція: виконайте дві транзакції, що оновлюють один рядок."
LAB_ERR = "Лабораторна 1. Розв'яжіть систему лінійних рівнянь методом Гауса й обчисліть число обумовленості матриці."
LAB_WEB = "Лабораторна 1. Зробіть сторінку зі списком, що завантажує дані через fetch і показує стани завантаження та помилки."
LAB_NET = "Лабораторна 1. Перехопіть TCP-рукостискання аналізатором пакетів і опишіть кожен сегмент."


def write_file(text):
    db.UPLOADS.mkdir(exist_ok=True)
    stored = uuid.uuid4().hex
    (db.UPLOADS / stored).write_text(text)
    return stored


def seed():
    password = hash_password(DEMO_PASSWORD)
    now = datetime.now()

    def at(days=0, hours=0, minutes=0):
        return now + timedelta(days=days, hours=hours, minutes=minutes)

    def deadline(days):
        return (now + timedelta(days=days)).replace(hour=23, minute=59, second=0, microsecond=0)

    def user(name, email, role, grp="", bio=""):
        return db.insert(
            "insert into users (name, email, password_hash, role, grp, bio, created_at, last_seen) "
            "values (%s, %s, %s, %s, %s, %s, %s, %s)",
            (name, email, password, role, grp, bio, at(-60), at(hours=-1)))

    user("Адміністратор VNS", "admin@vns.demo", "admin")
    olena = user("Олена Коваленко", "olena@vns.demo", "teacher", bio="Доцент, алгоритми та чисельні методи.")
    taras = user("Тарас Бондар", "taras@vns.demo", "teacher", bio="Бази даних, веб і мережі.")
    andrii = user("Андрій Мельник", "andrii@vns.demo", "student", "КН-21", "Студент другого курсу.")
    maryna = user("Марина Шевчук", "maryna@vns.demo", "student", "КН-21", "Староста групи КН-21.")
    ivan = user("Іван Петренко", "ivan@vns.demo", "student", "КН-21")
    sofiia = user("Софія Гриценко", "sofiia@vns.demo", "student", "КН-21")
    danylo = user("Данило Коваль", "danylo@vns.demo", "student", "КН-21")
    user("Юлія Лисенко", "yulia@vns.demo", "student", "КН-22")
    user("Богдан Ткач", "bohdan@vns.demo", "student", "КН-22")

    def course(title, description, teacher, grp, summaries, ask, cards):
        course_id = db.insert(
            "insert into courses (title, description, teacher_id, grp, created_at) values (%s, %s, %s, %s, %s)",
            (title, description, teacher, grp, at(-50)))
        db.execute("insert into ai_settings (course_id, summaries_on, ask_on, flashcards_on) values (%s, %s, %s, %s)",
                   (course_id, summaries, ask, cards))
        return course_id

    def topic(course_id, position, title):
        return db.insert("insert into topics (course_id, title, position) values (%s, %s, %s)", (course_id, title, position))

    def material(topic_id, title, kind, content, due=None, points=0):
        return db.insert(
            "insert into materials (topic_id, title, kind, content, deadline, max_points, created_at) "
            "values (%s, %s, %s, %s, %s, %s, %s)", (topic_id, title, kind, content, due, points, at(-40)))

    def submit(material_id, student_id, grade=None, feedback="", comment="", days_ago=3):
        db.insert(
            "insert into submissions (material_id, student_id, filename, stored_name, comment, submitted_at, grade, "
            "feedback, graded_at) values (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (material_id, student_id, "report.pdf", write_file("Демонстраційний звіт"), comment, at(-days_ago), grade,
             feedback, at(-days_ago + 1) if grade is not None else None))

    algorithms = course("Алгоритми та структури даних", "Складність, сортування й графи з щотижневими лабораторними.",
                        olena, "КН-21", True, True, True)
    t1 = topic(algorithms, 1, "Складність")
    lecture1 = material(t1, "Лекція 1. Складність алгоритмів", "lecture", COMPLEXITY)
    lab1 = material(t1, "Лабораторна 1. Лінійний і бінарний пошук", "lab", LAB_SEARCH, deadline(-14), 10)
    t2 = topic(algorithms, 2, "Сортування")
    material(t2, "Лекція 2. Алгоритми сортування", "lecture", SORTING)
    lab2 = material(t2, "Лабораторна 2. Сортування бульбашкою та злиттям", "lab", LAB_SORT, deadline(-3), 10)
    t3 = topic(algorithms, 3, "Графи")
    lecture3 = material(t3, "Лекція 3. Графи: BFS і DFS", "lecture", GRAPHS)
    lab3 = material(t3, "Лабораторна 3. Графи: BFS і DFS", "lab", LAB_GRAPH, deadline(2), 10)

    databases = course("Бази даних", "Реляційна модель, SQL і транзакції на PostgreSQL.", taras, "КН-21", True, False, False)
    t4 = topic(databases, 1, "Реляційна модель")
    material(t4, "Лекція 1. Реляційні бази даних", "lecture", RELATIONAL)
    material(t4, "Лабораторна 1. Таблиці та запити", "lab", LAB_SQL, deadline(5), 10)
    t5 = topic(databases, 2, "Транзакції")
    material(t5, "Лекція 2. Транзакції", "lecture", TRANSACTIONS)
    material(t5, "Лабораторна 2. Ізоляція транзакцій", "lab", LAB_TX, deadline(12), 15)

    numerical = course("Чисельні методи", "Похибки, лінійні системи та ітераційні методи.", olena, "КН-21", False, False, False)
    t6 = topic(numerical, 1, "Похибки та обумовленість")
    material(t6, "Лекція 1. Похибки та обумовленість", "lecture", ERRORS)
    num_lab = material(t6, "Лабораторна 1. Метод Гауса", "lab", LAB_ERR, deadline(7), 10)

    web = course("Веб-технології", "Як працює веб і як будувати сучасні інтерфейси.", taras, "КН-21", True, True, True)
    t7 = topic(web, 1, "Як працює веб")
    material(t7, "Лекція 1. HTTP і REST", "lecture", HTTP)
    t8 = topic(web, 2, "Компоненти")
    material(t8, "Лекція 2. Компоненти в React", "lecture", REACT)
    material(t8, "Лабораторна 1. Список з fetch", "lab", LAB_WEB, deadline(9), 10)

    networks = course("Комп'ютерні мережі", "Протоколи та аналіз пакетів.", taras, "КН-22", True, True, False)
    t9 = topic(networks, 1, "Транспортний рівень")
    material(t9, "Лекція 1. TCP", "lecture", TCP)
    material(t9, "Лабораторна 1. Рукостискання TCP", "lab", LAB_NET, deadline(6), 10)

    stored = write_file("Слайди лекції 1: складність алгоритмів.")
    db.insert(
        "insert into attachments (material_id, filename, stored_name, size, uploaded_at) values (%s, %s, %s, %s, %s)",
        (lecture1, "lecture1_slides.pdf", stored, 48 * 1024, at(-39)))

    submit(lab1, andrii, 8, "Добрі вимірювання. Поясніть графік бінарного пошуку докладніше.")
    submit(lab1, maryna, 10, "Чудова робота.")
    submit(lab1, ivan, 7, "Додайте висновок про O(log n).")
    submit(lab1, sofiia, 9)
    submit(lab1, danylo, 6, "Немає вимірювань для 100000 елементів.")
    submit(lab2, andrii, None, comment="Використав сортування злиттям з лекції.", days_ago=2)
    submit(lab2, maryna, None, days_ago=3)
    submit(lab2, ivan, 9, "Зрозуміла таблиця порівняння.")
    submit(lab2, sofiia, 10, "Чудово.")
    submit(lab3, maryna, None, days_ago=1)
    submit(num_lab, ivan, None, days_ago=1)

    def announcement(course_id, author, title, body, pinned, days, readers):
        announcement_id = db.insert(
            "insert into announcements (course_id, author_id, title, body, pinned, created_at) values (%s, %s, %s, %s, %s, %s)",
            (course_id, author, title, body, pinned, at(-days)))
        for reader in [author] + readers:
            db.execute("insert into announcement_reads (announcement_id, user_id, read_at) values (%s, %s, %s)",
                       (announcement_id, reader, at(-days, hours=1)))

    announcement(algorithms, olena, "Правила іспиту та оцінювання",
                 "Іспит коштує 55 балів. Лабораторні дають до 40 балів протягом семестру. У кожної лабораторної "
                 "власний дедлайн, а пізні роботи приймаються лише після розмови зі мною.", True, 20, [andrii, maryna, ivan, sofiia])
    announcement(algorithms, olena, "Лабораторна 3: лишилося два дні",
                 "Будь ласка, здайте лабораторну 3 одним PDF з кодом і коротким поясненням. Запитання ставте у вкладці Q&A.",
                 False, 1, [maryna])
    announcement(databases, taras, "Ласкаво просимо на курс «Бази даних»",
                 "У лабораторних ми використовуватимемо PostgreSQL. Встановіть його перед першою лабораторною або скористайтеся образом Docker.",
                 False, 8, [andrii, maryna])

    def message(course_id, channel, author, text, parent=None, accepted=False, resolved=False, minutes=0):
        return db.insert(
            "insert into messages (course_id, channel, user_id, parent_id, text, accepted, resolved, created_at) "
            "values (%s, %s, %s, %s, %s, %s, %s, %s)",
            (course_id, channel, author, parent, text, accepted, resolved, at(minutes=minutes)))

    q1 = message(algorithms, "qa", andrii, "Лабораторну 3 потрібно здавати одним PDF з кодом усередині?", resolved=True, minutes=-1500)
    message(algorithms, "qa", olena, "Так, одним PDF з кодом і коротким поясненням.", q1, accepted=True, minutes=-1400)
    q2 = message(algorithms, "qa", ivan, "У лабораторній 2 порівняння для відсортованих списків теж рахувати?", resolved=False, minutes=-600)
    message(algorithms, "qa", maryna, "Я рахувала лише для випадкових списків, як сказано в завданні. Краще уточнити в викладачки.", q2, minutes=-500)
    message(algorithms, "qa", danylo, "Чим відрізняються BFS і DFS, коли потрібен найкоротший шлях?", minutes=-120)
    message(algorithms, "general", olena, "Ласкаво просимо на курс. Цей канал для всього, що не є запитанням.", minutes=-5000)
    message(algorithms, "general", maryna, "Хтось хоче разом готуватися до іспиту на вихідних?", minutes=-300)
    message(algorithms, "general", sofiia, "Так, я за. Я створила навчальний простір для цього.", minutes=-280)

    def dm(sender, recipient, text, minutes, read=True):
        db.insert(
            "insert into direct_messages (sender_id, recipient_id, text, created_at, read_at) values (%s, %s, %s, %s, %s)",
            (sender, recipient, text, at(minutes=minutes), at(minutes=minutes + 5) if read else None))

    dm(andrii, olena, "Добрий день! Чи можна здати лабораторну 2 на день пізніше через лікарняний?", -2000)
    dm(olena, andrii, "Добрий день, Андрію. Так, надішліть до п'ятниці й додайте довідку.", -1900)
    dm(andrii, olena, "Дуже дякую!", -1890)
    dm(maryna, olena, "Чи можемо створити чат підгрупи для лабораторних груп?", -90, read=False)
    dm(maryna, andrii, "Не забудь про навчальний простір сьогодні о 19:00.", -60, read=False)

    def space(title, topic_name, description, owner, members, messages):
        space_id = db.insert(
            "insert into spaces (title, topic, description, owner_id, created_at) values (%s, %s, %s, %s, %s)",
            (title, topic_name, description, owner, at(-4)))
        for member in [owner] + members:
            db.execute("insert into space_members (space_id, user_id, joined_at) values (%s, %s, %s)", (space_id, member, at(-4)))
        for index, (author, text) in enumerate(messages):
            db.insert("insert into space_messages (space_id, user_id, text, created_at) values (%s, %s, %s, %s)",
                      (space_id, author, text, at(minutes=-400 + index * 20)))

    space("Підготовка до іспиту з алгоритмів", "Алгоритми", "Щотижневі зустрічі: разом розв'язуємо задачі з минулих іспитів.", maryna,
          [andrii, ivan, sofiia],
          [(maryna, "Давайте зустрінемося сьогодні о 19:00 і пройдемо сортування та графи."),
           (ivan, "Я можу пояснити сортування злиттям, мені воно було зрозуміле."),
           (sofiia, "Я принесу задачі на BFS і DFS."),
           (andrii, "Чудово, до зустрічі!")])
    space("SQL-клуб", "Бази даних", "Практикуємо SQL-запити на реальних наборах даних.", ivan, [danylo],
          [(ivan, "З якого набору даних хочете почати?"), (danylo, "Давайте візьмемо схему університету з лабораторної 1.")])
    space("Англійська для співбесід в IT", "Англійська", "Пробні співбесіди й лексика для розробників.", sofiia, [], [])

    db.insert("insert into notes (user_id, material_id, text, updated_at) values (%s, %s, %s, %s)",
              (andrii, lecture3, "BFS = черга, найкоротший шлях у графі без ваг.\nDFS = стек або рекурсія.\nОбидва O(V + E).", at(-1)))

    def card(user_id, material_id, front, back, box, due):
        db.insert("insert into flashcards (user_id, material_id, front, back, box, due, created_at) values (%s, %s, %s, %s, %s, %s, %s)",
                  (user_id, material_id, front, back, box, due, at(-3)))

    card(andrii, lecture1, "Нотація Big O дає верхню межу _____ алгоритму.", "зростання", 1, at(hours=-2))
    card(andrii, lecture1, "Поділ даних навпіл на кожному кроці дає складність O(?)", "O(log n)", 2, at(hours=-1))
    card(andrii, lecture3, "BFS використовує ..., а DFS — стек або рекурсію.", "чергу", 3, at(days=2))
    card(andrii, lecture3, "Час роботи BFS і DFS", "O(V + E)", 1, at(days=1))

    def notification(user_id, kind, text, link, read, minutes):
        db.insert("insert into notifications (user_id, kind, text, link, read, created_at) values (%s, %s, %s, %s, %s, %s)",
                  (user_id, kind, text, link, read, at(minutes=minutes)))

    notification(andrii, "grade", "Лабораторна 1. Лінійний і бінарний пошук: ви отримали 8 / 10", f"/materials/{lab1}", True, -9000)
    notification(andrii, "announcement", "Алгоритми та структури даних: Лабораторна 3: лишилося два дні", f"/courses/{algorithms}?tab=announcements", False, -1300)
    notification(andrii, "reply", "Олена Коваленко: нова відповідь на ваше питання в курсі «Алгоритми та структури даних»", f"/courses/{algorithms}?tab=discussion", True, -1400)
    notification(olena, "submission", "Нова здача: Марина Шевчук, Лабораторна 3. Графи: BFS і DFS", f"/materials/{lab3}", False, -1400)
    notification(olena, "question", "Нове питання в курсі «Алгоритми та структури даних»", f"/courses/{algorithms}?tab=discussion", False, -100)
    notification(olena, "message", "Марина Шевчук написала вам", "/messages", False, -90)

    db.execute("insert into ai_usage (user_id, day, count) values (%s, %s, %s)", (andrii, now.date(), 2))
