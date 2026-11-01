import uuid
from datetime import datetime, timedelta

import db
from auth import hash_password

DEMO_PASSWORD = "demo"

COMPLEXITY = (
    "An algorithm is a finite sequence of steps that solves a problem. Time complexity describes how the running "
    "time of an algorithm grows with the size of the input n. Big O notation gives an upper bound on this growth. "
    "A loop over n items is O(n), two nested loops are O(n^2), and halving the input each step is O(log n). "
    "Space complexity measures how much extra memory an algorithm needs. When we compare algorithms we look at the "
    "worst case, because it gives a guarantee that holds for every input."
)
SORTING = (
    "Sorting arranges the elements of a list in order. Bubble sort repeatedly swaps neighbouring elements that are "
    "in the wrong order and takes O(n^2) time. Merge sort splits the list in two halves, sorts each half and merges "
    "the results in O(n log n) time. Quick sort picks a pivot element and partitions the list around it, which is "
    "O(n log n) on average. A sorting algorithm is stable if it keeps the order of equal elements."
)
GRAPHS = (
    "A graph consists of vertices connected by edges. Breadth-first search (BFS) visits the vertices level by level "
    "using a queue and finds the shortest path in an unweighted graph. Depth-first search (DFS) goes as deep as "
    "possible along each branch using a stack or recursion before it backtracks. Both searches visit every vertex "
    "and edge once, so they run in O(V + E) time. A graph can be stored as an adjacency list or an adjacency matrix."
)
RELATIONAL = (
    "A relational database stores data in tables made of rows and columns. A primary key identifies each row of a "
    "table in a unique way. A foreign key links a row to a row of another table. SQL is the language used to query "
    "and change the data. The SELECT statement reads rows, JOIN combines rows of two tables, and an index makes "
    "searching in a large table faster."
)
TRANSACTIONS = (
    "A transaction is a group of operations that the database treats as one unit. Atomicity means that either all "
    "operations of a transaction are applied or none of them. Isolation keeps concurrent transactions from seeing "
    "each other's unfinished changes. Durability guarantees that committed data survives a crash. PostgreSQL "
    "implements these rules with write-ahead logging and multiversion concurrency control."
)
ERRORS = (
    "Numerical methods work with approximate numbers, so every result has an error. The absolute error is the "
    "difference between the exact and the approximate value. The relative error divides the absolute error by the "
    "exact value. A system of equations is ill-conditioned when a small change of the input causes a large change "
    "of the result. The condition number measures this sensitivity."
)
HTTP = (
    "The web works on the client-server model. The browser sends an HTTP request and the server returns a response "
    "with a status code, headers and a body. REST describes resources with URLs and uses the methods GET, POST, PUT "
    "and DELETE. HTTP is stateless, so a server recognises a user by a cookie or a token sent with every request. "
    "Status codes starting with 2 mean success, with 4 a client error and with 5 a server error."
)
REACT = (
    "React builds an interface from components. A component receives props from its parent and keeps its own state. "
    "When the state changes React renders the component again and updates only the changed part of the DOM. Data "
    "flows in one direction, from parents to children. Lazy loading splits the code into chunks that the browser "
    "downloads only when a screen needs them."
)
TCP = (
    "TCP delivers a stream of bytes reliably and in order. A connection starts with a three-way handshake. The "
    "receiver acknowledges the data it gets and the sender sends it again if an acknowledgement does not arrive. "
    "Flow control stops a fast sender from overwhelming a slow receiver. Congestion control slows the sender down "
    "when the network is overloaded."
)

LAB_SEARCH = (
    "Lab 1. Measure the running time of linear search and binary search on lists of 1000, 10000 and 100000 "
    "elements and explain the results with Big O notation."
)
LAB_SORT = (
    "Lab 2. Implement bubble sort and merge sort, count the comparisons for random lists and compare the two "
    "algorithms in a short report."
)
LAB_GRAPH = (
    "Lab 3. Implement BFS and DFS for a graph stored as an adjacency list and print the order in which the "
    "vertices are visited."
)
LAB_SQL = (
    "Lab 1. Create two related tables and write five SELECT queries with JOIN. Describe the primary and foreign "
    "keys you used."
)
LAB_TX = "Lab 2. Show with two sessions how isolation works: run two transactions that update the same row."
LAB_ERR = "Lab 1. Solve a linear system with the Gauss method and compute the condition number of the matrix."
LAB_WEB = "Lab 1. Build a page with a list of items that loads data with fetch and shows loading and error states."
LAB_NET = "Lab 1. Capture a TCP handshake with a packet sniffer and describe every segment."


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

    user("Admin VNS", "admin@vns.demo", "admin")
    olena = user("Olena Kovalenko", "olena@vns.demo", "teacher", bio="Associate professor, algorithms and numerical methods.")
    taras = user("Taras Bondar", "taras@vns.demo", "teacher", bio="Databases, web and networks.")
    andrii = user("Andrii Melnyk", "andrii@vns.demo", "student", "CS-21", "Second-year CS student.")
    maryna = user("Maryna Shevchuk", "maryna@vns.demo", "student", "CS-21", "Head of group CS-21.")
    ivan = user("Ivan Petrenko", "ivan@vns.demo", "student", "CS-21")
    sofiia = user("Sofiia Hrytsenko", "sofiia@vns.demo", "student", "CS-21")
    danylo = user("Danylo Koval", "danylo@vns.demo", "student", "CS-21")
    user("Yulia Lysenko", "yulia@vns.demo", "student", "CS-22")
    user("Bohdan Tkach", "bohdan@vns.demo", "student", "CS-22")

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
            (material_id, student_id, "report.pdf", write_file("Demo report"), comment, at(-days_ago), grade,
             feedback, at(-days_ago + 1) if grade is not None else None))

    algorithms = course("Algorithms and Data Structures", "Complexity, sorting and graph algorithms with weekly labs.",
                        olena, "CS-21", True, True, True)
    t1 = topic(algorithms, 1, "Complexity")
    lecture1 = material(t1, "Lecture 1. Complexity of algorithms", "lecture", COMPLEXITY)
    lab1 = material(t1, "Lab 1. Linear and binary search", "lab", LAB_SEARCH, deadline(-14), 10)
    t2 = topic(algorithms, 2, "Sorting")
    material(t2, "Lecture 2. Sorting algorithms", "lecture", SORTING)
    lab2 = material(t2, "Lab 2. Bubble sort and merge sort", "lab", LAB_SORT, deadline(-3), 10)
    t3 = topic(algorithms, 3, "Graphs")
    lecture3 = material(t3, "Lecture 3. Graphs: BFS and DFS", "lecture", GRAPHS)
    lab3 = material(t3, "Lab 3. Graphs: BFS and DFS", "lab", LAB_GRAPH, deadline(2), 10)

    databases = course("Databases", "Relational model, SQL and transactions on PostgreSQL.", taras, "CS-21", True, False, False)
    t4 = topic(databases, 1, "Relational model")
    material(t4, "Lecture 1. Relational databases", "lecture", RELATIONAL)
    material(t4, "Lab 1. Tables and queries", "lab", LAB_SQL, deadline(5), 10)
    t5 = topic(databases, 2, "Transactions")
    material(t5, "Lecture 2. Transactions", "lecture", TRANSACTIONS)
    material(t5, "Lab 2. Isolation of transactions", "lab", LAB_TX, deadline(12), 15)

    numerical = course("Numerical Methods", "Errors, linear systems and iterative methods.", olena, "CS-21", False, False, False)
    t6 = topic(numerical, 1, "Errors and conditioning")
    material(t6, "Lecture 1. Errors and conditioning", "lecture", ERRORS)
    num_lab = material(t6, "Lab 1. Gauss method", "lab", LAB_ERR, deadline(7), 10)

    web = course("Web Technologies", "How the web works and how to build modern interfaces.", taras, "CS-21", True, True, True)
    t7 = topic(web, 1, "How the web works")
    material(t7, "Lecture 1. HTTP and REST", "lecture", HTTP)
    t8 = topic(web, 2, "Components")
    material(t8, "Lecture 2. Components in React", "lecture", REACT)
    material(t8, "Lab 1. A list with fetch", "lab", LAB_WEB, deadline(9), 10)

    networks = course("Computer Networks", "Protocols and packet analysis.", taras, "CS-22", True, True, False)
    t9 = topic(networks, 1, "Transport layer")
    material(t9, "Lecture 1. TCP", "lecture", TCP)
    material(t9, "Lab 1. TCP handshake", "lab", LAB_NET, deadline(6), 10)

    stored = write_file("Slides of lecture 1: complexity of algorithms.")
    db.insert(
        "insert into attachments (material_id, filename, stored_name, size, uploaded_at) values (%s, %s, %s, %s, %s)",
        (lecture1, "lecture1_slides.pdf", stored, 48 * 1024, at(-39)))

    submit(lab1, andrii, 8, "Good measurements. Explain the binary search graph in more detail.")
    submit(lab1, maryna, 10, "Excellent work.")
    submit(lab1, ivan, 7, "Add the conclusion about O(log n).")
    submit(lab1, sofiia, 9)
    submit(lab1, danylo, 6, "Measurements for 100000 elements are missing.")
    submit(lab2, andrii, None, comment="Used merge sort from the lecture.", days_ago=2)
    submit(lab2, maryna, None, days_ago=3)
    submit(lab2, ivan, 9, "Clear comparison table.")
    submit(lab2, sofiia, 10, "Great.")
    submit(lab3, maryna, None, days_ago=1)
    submit(num_lab, ivan, None, days_ago=1)

    def announcement(course_id, author, title, body, pinned, days, readers):
        announcement_id = db.insert(
            "insert into announcements (course_id, author_id, title, body, pinned, created_at) values (%s, %s, %s, %s, %s, %s)",
            (course_id, author, title, body, pinned, at(-days)))
        for reader in [author] + readers:
            db.execute("insert into announcement_reads (announcement_id, user_id, read_at) values (%s, %s, %s)",
                       (announcement_id, reader, at(-days, hours=1)))

    announcement(algorithms, olena, "Exam rules and grading",
                 "The exam is 55 points. Labs give up to 40 points during the term. Every lab has its own deadline and "
                 "late work is accepted only after a talk with me.", True, 20, [andrii, maryna, ivan, sofiia])
    announcement(algorithms, olena, "Lab 3 is due in two days",
                 "Please submit Lab 3 as one PDF with the code and a short explanation. Ask questions in the Q&A tab.",
                 False, 1, [maryna])
    announcement(databases, taras, "Welcome to Databases",
                 "We will use PostgreSQL in the labs. Install it before the first lab or use the Docker image from the course page.",
                 False, 8, [andrii, maryna])

    def message(course_id, channel, author, text, parent=None, accepted=False, resolved=False, minutes=0):
        return db.insert(
            "insert into messages (course_id, channel, user_id, parent_id, text, accepted, resolved, created_at) "
            "values (%s, %s, %s, %s, %s, %s, %s, %s)",
            (course_id, channel, author, parent, text, accepted, resolved, at(minutes=minutes)))

    q1 = message(algorithms, "qa", andrii, "Is Lab 3 submitted as one PDF with the code inside?", resolved=True, minutes=-1500)
    message(algorithms, "qa", olena, "Yes, one PDF with the code and a short explanation.", q1, accepted=True, minutes=-1400)
    q2 = message(algorithms, "qa", ivan, "In Lab 2, do we count comparisons for sorted lists as well?", resolved=False, minutes=-600)
    message(algorithms, "qa", maryna, "I counted them for random lists only, as the task says. Better ask the lecturer to be sure.", q2, minutes=-500)
    message(algorithms, "qa", danylo, "What is the difference between BFS and DFS when I need the shortest path?", minutes=-120)
    message(algorithms, "general", olena, "Welcome to the course. Use this channel for everything that is not a question.", minutes=-5000)
    message(algorithms, "general", maryna, "Does anyone want to prepare for the exam together this weekend?", minutes=-300)
    message(algorithms, "general", sofiia, "Yes, I am in. I opened a study space for it.", minutes=-280)

    def dm(sender, recipient, text, minutes, read=True):
        db.insert(
            "insert into direct_messages (sender_id, recipient_id, text, created_at, read_at) values (%s, %s, %s, %s, %s)",
            (sender, recipient, text, at(minutes=minutes), at(minutes=minutes + 5) if read else None))

    dm(andrii, olena, "Good afternoon! May I submit Lab 2 one day later because of a sick leave?", -2000)
    dm(olena, andrii, "Hello, Andrii. Yes, send it by Friday and add the medical note.", -1900)
    dm(andrii, olena, "Thank you very much!", -1890)
    dm(maryna, olena, "Could we make a subgroup chat for the lab groups?", -90, read=False)
    dm(maryna, andrii, "Remember about the study space tonight at 19:00.", -60, read=False)

    def space(title, topic_name, description, owner, members, messages):
        space_id = db.insert(
            "insert into spaces (title, topic, description, owner_id, created_at) values (%s, %s, %s, %s, %s)",
            (title, topic_name, description, owner, at(-4)))
        for member in [owner] + members:
            db.execute("insert into space_members (space_id, user_id, joined_at) values (%s, %s, %s)", (space_id, member, at(-4)))
        for index, (author, text) in enumerate(messages):
            db.insert("insert into space_messages (space_id, user_id, text, created_at) values (%s, %s, %s, %s)",
                      (space_id, author, text, at(minutes=-400 + index * 20)))

    space("Algorithms exam prep", "Algorithms", "Weekly sessions: we solve old exam tasks together.", maryna,
          [andrii, ivan, sofiia],
          [(maryna, "Let's meet tonight at 19:00 and go through sorting and graphs."),
           (ivan, "I can explain merge sort, it was clear to me."),
           (sofiia, "I will bring tasks about BFS and DFS."),
           (andrii, "Great, see you!")])
    space("SQL practice club", "Databases", "Practice SQL queries on real datasets.", ivan, [danylo],
          [(ivan, "Which dataset do you want to start with?"), (danylo, "Let's take the university schema from Lab 1.")])
    space("English for IT interviews", "English", "Mock interviews and vocabulary for developers.", sofiia, [], [])

    db.insert("insert into notes (user_id, material_id, text, updated_at) values (%s, %s, %s, %s)",
              (andrii, lecture3, "BFS = queue, shortest path in an unweighted graph.\nDFS = stack or recursion.\nBoth O(V + E).", at(-1)))

    def card(user_id, material_id, front, back, box, due):
        db.insert("insert into flashcards (user_id, material_id, front, back, box, due, created_at) values (%s, %s, %s, %s, %s, %s, %s)",
                  (user_id, material_id, front, back, box, due, at(-3)))

    card(andrii, lecture1, "Big O notation gives an upper bound on the _____ of an algorithm.", "growth", 1, at(hours=-2))
    card(andrii, lecture1, "Halving the input at each step gives O(?)", "O(log n)", 2, at(hours=-1))
    card(andrii, lecture3, "BFS uses a ... and DFS uses a stack or recursion.", "queue", 3, at(days=2))
    card(andrii, lecture3, "Running time of BFS and DFS", "O(V + E)", 1, at(days=1))

    def notification(user_id, kind, text, link, read, minutes):
        db.insert("insert into notifications (user_id, kind, text, link, read, created_at) values (%s, %s, %s, %s, %s, %s)",
                  (user_id, kind, text, link, read, at(minutes=minutes)))

    notification(andrii, "grade", "Lab 1. Linear and binary search: you got 8 / 10", f"/materials/{lab1}", True, -9000)
    notification(andrii, "announcement", "Algorithms and Data Structures: Lab 3 is due in two days", f"/courses/{algorithms}?tab=announcements", False, -1300)
    notification(andrii, "reply", "Olena Kovalenko replied to your question in Algorithms and Data Structures", f"/courses/{algorithms}?tab=discussion", True, -1400)
    notification(olena, "submission", "Maryna Shevchuk submitted Lab 3. Graphs: BFS and DFS", f"/materials/{lab3}", False, -1400)
    notification(olena, "question", "New question in Algorithms and Data Structures", f"/courses/{algorithms}?tab=discussion", False, -100)
    notification(olena, "message", "Maryna Shevchuk wrote to you", "/messages", False, -90)

    db.execute("insert into ai_usage (user_id, day, count) values (%s, %s, %s)", (andrii, now.date(), 2))
