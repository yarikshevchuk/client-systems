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

LAB_COMPLEXITY = (
    "Lab 1. Measure the running time of linear search and binary search on lists of 1000, 10000 and 100000 "
    "elements and explain the results with Big O notation."
)
LAB_SORTING = (
    "Lab 2. Implement bubble sort and merge sort, count the comparisons for random lists and compare the two "
    "algorithms in a short report."
)
LAB_GRAPHS = (
    "Lab 3. Implement BFS and DFS for a graph stored as an adjacency list and print the order in which the "
    "vertices are visited."
)
LAB_SQL = (
    "Lab 1. Create two related tables and write five SELECT queries with JOIN. Describe the primary and foreign "
    "keys you used."
)


def seed():
    password = hash_password(DEMO_PASSWORD)

    def user(name, email, role, grp):
        return db.execute(
            "insert into users (name, email, password_hash, role, grp) values (?, ?, ?, ?, ?)",
            (name, email, password, role, grp))

    teacher = user("Olena Kovalenko", "olena@vns.demo", "teacher", "")
    andrii = user("Andrii Melnyk", "andrii@vns.demo", "student", "CS-21")
    maryna = user("Maryna Shevchuk", "maryna@vns.demo", "student", "CS-21")

    now = datetime.now()

    def when(days):
        return (now + timedelta(days=days)).replace(hour=23, minute=59).isoformat(timespec="minutes")

    def course(title, ai_on):
        course_id = db.execute(
            "insert into courses (title, teacher_id, grp) values (?, ?, ?)", (title, teacher, "CS-21"))
        db.execute("insert into ai_settings (course_id, summaries_on, ask_on) values (?, ?, ?)",
                   (course_id, int(ai_on), int(ai_on)))
        return course_id

    def topic(course_id, position, title):
        return db.execute(
            "insert into topics (course_id, title, position) values (?, ?, ?)", (course_id, title, position))

    def material(topic_id, title, kind, content, deadline=None, max_points=0):
        return db.execute(
            "insert into materials (topic_id, title, kind, content, deadline, max_points) values (?, ?, ?, ?, ?, ?)",
            (topic_id, title, kind, content, deadline, max_points))

    def submission(material_id, student_id, grade):
        db.execute(
            "insert into submissions (material_id, student_id, filename, submitted_at, grade) values (?, ?, ?, ?, ?)",
            (material_id, student_id, "report.pdf", now.isoformat(timespec="seconds"), grade))

    algorithms = course("Algorithms and Data Structures", True)
    t1 = topic(algorithms, 1, "Topic 1. Complexity")
    material(t1, "Lecture 1. Complexity of algorithms", "lecture", COMPLEXITY)
    lab1 = material(t1, "Lab 1. Linear and binary search", "lab", LAB_COMPLEXITY, when(-14), 10)
    t2 = topic(algorithms, 2, "Topic 2. Sorting")
    material(t2, "Lecture 2. Sorting algorithms", "lecture", SORTING)
    lab2 = material(t2, "Lab 2. Bubble sort and merge sort", "lab", LAB_SORTING, when(-3), 10)
    t3 = topic(algorithms, 3, "Topic 3. Graphs")
    material(t3, "Lecture 3. Graphs: BFS and DFS", "lecture", GRAPHS)
    material(t3, "Lab 3. Graphs: BFS and DFS", "lab", LAB_GRAPHS, when(2), 10)

    databases = course("Databases", False)
    t4 = topic(databases, 1, "Topic 1. Relational model")
    material(t4, "Lecture 1. Relational databases", "lecture", RELATIONAL)
    material(t4, "Lab 1. Tables and queries", "lab", LAB_SQL, when(5), 10)

    submission(lab1, andrii, 8)
    submission(lab1, maryna, 10)
    submission(lab2, andrii, None)

    def message(user_id, text, is_question, minutes_ago):
        created = (now - timedelta(minutes=minutes_ago)).isoformat(timespec="seconds")
        db.execute(
            "insert into messages (course_id, user_id, text, is_question, created_at) values (?, ?, ?, ?, ?)",
            (algorithms, user_id, text, int(is_question), created))

    message(teacher, "Welcome to the course. Ask your questions here instead of private chats.", False, 600)
    message(andrii, "Is Lab 3 submitted as one PDF with the code inside?", True, 90)
    message(teacher, "Yes, one PDF with the code and a short explanation.", False, 60)
