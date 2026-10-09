// Seed data: one demo university, three users, one course, two materials
// with real extracted text, and one pre-generated practice quiz.
// The quiz is pre-generated so the FULL core loop (take quiz -> get scored
// -> see explanations) works even before an ANTHROPIC_API_KEY is configured.
//
// Run with: npm run db:seed   (from the repo root)
// Demo logins (password for all three): coursemind
//   alex@demo.edu  (student)
//   maya@demo.edu  (student)
//   sam@demo.edu   (TA)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const HASH_TABLE_NOTES = `CS201 Lecture 9 - Hash Tables and Collision Resolution

1. Motivation
Arrays give O(1) access by index, but real programs look things up by key (a username, a word, a product ID). A hash table gives us (expected) O(1) insert, lookup, and delete by key. It is arguably the most used data structure in practice: Python dicts, Java HashMaps, JavaScript objects and Maps are all hash tables.

2. The core idea
A hash table is an array of m buckets plus a hash function h(key) that maps a key to an index in [0, m-1]. To insert (key, value): compute i = h(key) mod m and store the pair at bucket i. To look up a key: hash it again and inspect bucket i.

3. Hash functions
A good hash function is (a) deterministic, (b) fast, and (c) spreads keys uniformly across buckets. For strings, a common scheme is polynomial rolling hashing: h(s) = s[0]*p^(n-1) + s[1]*p^(n-2) + ... + s[n-1], computed mod a large prime, with p a small prime like 31. EXAM NOTE: you should be able to compute a small polynomial hash by hand.

4. Collisions
Two different keys can hash to the same bucket - a collision. By the pigeonhole principle collisions are unavoidable once you have more possible keys than buckets, so every hash table needs a collision resolution strategy. The two big families:

4a. Separate chaining
Each bucket holds a linked list (or dynamic array) of all pairs that hashed there. Insert appends to the list; lookup walks the list comparing keys. With a good hash function and load factor alpha = n/m, the expected chain length is alpha, so expected lookup is O(1 + alpha). Worst case (all keys in one chain) degrades to O(n).

4b. Open addressing
All entries live directly in the array. On collision, probe for another slot according to a probe sequence:
- Linear probing: try i, i+1, i+2, ... (simple, cache-friendly, but suffers primary clustering - runs of occupied slots grow and merge)
- Quadratic probing: try i, i+1^2, i+2^2, ... (reduces primary clustering, can suffer secondary clustering)
- Double hashing: step size comes from a second hash function h2(key), the strongest of the three.
Deletion under open addressing is tricky: you cannot simply empty a slot or you break probe chains. Standard fix: tombstones (mark slot as deleted-but-was-occupied).

5. Load factor and resizing
The load factor alpha = n/m drives performance. Chaining stays reasonable up to alpha approx 1; open addressing degrades sharply as alpha -> 1 (probe lengths blow up). Typical policy: when alpha exceeds a threshold (e.g. 0.75 like Java's HashMap), allocate a new array of roughly double the size and re-insert every element (rehashing). Rehashing is O(n) but amortized O(1) per insert.

6. Complexity summary
Operation   | Average | Worst
Insert      | O(1)    | O(n)
Lookup      | O(1)    | O(n)
Delete      | O(1)    | O(n)
The worst case happens with pathological key sets or a bad hash function. Java 8+ HashMap converts long chains into red-black trees, bounding worst-case bucket operations at O(log n).

7. When NOT to use a hash table
- You need ordered iteration or range queries (use a balanced BST / B-tree)
- You need stable worst-case guarantees (real-time systems)
- Keys are tiny dense integers (a plain array is better)

PROF'S EXAM HINTS (from review session): be ready to (1) trace linear probing inserts into a small table by hand, including a deletion with tombstones, (2) explain why doubling capacity keeps amortized insert O(1), (3) compare chaining vs open addressing trade-offs in 3-4 sentences.`;

const BST_NOTES = `CS201 Lecture 11 - Binary Search Trees

1. Definition
A binary search tree (BST) is a binary tree where for every node N: all keys in N's left subtree are less than N.key, and all keys in the right subtree are greater. This invariant makes search a guided walk: at each node go left or right by comparison.

2. Operations
- search(k): start at root, compare, descend. O(h) where h is tree height.
- insert(k): search until you fall off the tree, attach the new node there. O(h).
- delete(k): three cases - leaf (just remove), one child (splice child up), two children (replace with in-order successor: the minimum of the right subtree, then delete that successor node). Deletion's two-child case is the classic exam question.
- in-order traversal (left, node, right) visits keys in sorted order - this is THE defining property to remember.

3. Height matters
All costs are O(h). A balanced tree has h = O(log n); inserting sorted input into a naive BST produces a degenerate "linked list" with h = n - 1, making everything O(n). This motivates self-balancing trees (AVL, red-black) covered next lecture.

4. BST vs hash table
BSTs give O(log n) operations but support ordered operations hash tables cannot: min/max, predecessor/successor, range queries [a, b], sorted iteration. Choose by access pattern.

PROF'S EXAM HINTS: trace insertions one by one and draw the tree, perform a two-child deletion showing the successor swap, and explain what input order produces the worst-case height and why.`;

// QuizQuestion[] - must match packages/core/src/types.ts (QuizQuestionSchema)
const SEED_QUIZ_QUESTIONS = [
  {
    id: "q1",
    type: "mcq",
    topic: "hash functions",
    prompt: "What property is NOT required of a good hash function?",
    options: [
      "It is deterministic - the same key always hashes to the same value",
      "It distributes keys uniformly across buckets",
      "It is reversible - the key can be recovered from the hash",
      "It is fast to compute",
    ],
    correctOption: 2,
    explanation:
      "Hash functions for hash tables only need to be deterministic, fast, and uniform. Reversibility is irrelevant (and cryptographic hashes are deliberately one-way). See Lecture 9, section 3.",
  },
  {
    id: "q2",
    type: "mcq",
    topic: "collision resolution",
    prompt:
      "In separate chaining with load factor alpha = n/m and a good hash function, the expected cost of an unsuccessful lookup is:",
    options: ["O(1 + alpha)", "O(alpha^2)", "O(log n)", "O(m/n)"],
    correctOption: 0,
    explanation:
      "Expected chain length equals the load factor alpha, so a lookup costs the hash computation O(1) plus walking an expected alpha entries: O(1 + alpha). Lecture 9, section 4a.",
  },
  {
    id: "q3",
    type: "mcq",
    topic: "open addressing",
    prompt: "Why does deleting from an open-addressing hash table require tombstones?",
    options: [
      "To keep the load factor accurate for resizing decisions",
      "Emptying a slot could break the probe chain, making later keys unfindable",
      "SQLite requires them for crash recovery",
      "Tombstones speed up future insertions",
    ],
    correctOption: 1,
    explanation:
      "Lookups probe until they hit an EMPTY slot. If you truly empty a deleted slot that sits mid-chain, probing stops early and keys placed after it become unreachable. A tombstone says 'keep probing past me'. Lecture 9, section 4b.",
  },
  {
    id: "q4",
    type: "mcq",
    topic: "load factor & resizing",
    prompt:
      "A table doubles its capacity and rehashes when alpha exceeds 0.75. Rehashing costs O(n). Why is insertion still amortized O(1)?",
    options: [
      "Because rehashing happens in a background thread",
      "Because each O(n) rehash is 'paid for' by the Theta(n) cheap insertions since the previous rehash",
      "Because the hash function gets faster as the table grows",
      "It isn't - amortized insertion is O(log n)",
    ],
    correctOption: 1,
    explanation:
      "Between rehashes you perform Theta(n) constant-time insertions. Spreading the O(n) rehash cost over those insertions charges each one O(1) extra - the classic doubling argument (same as dynamic arrays). Lecture 9, section 5.",
  },
  {
    id: "q5",
    type: "mcq",
    topic: "primary clustering",
    prompt: "Primary clustering is a problem specific to:",
    options: ["Separate chaining", "Linear probing", "Double hashing", "Polynomial string hashing"],
    correctOption: 1,
    explanation:
      "Under linear probing, occupied runs grow and merge: any key hashing into a run must probe to its end, lengthening it further. Quadratic probing reduces it; double hashing largely avoids it. Lecture 9, section 4b.",
  },
  {
    id: "q6",
    type: "short",
    topic: "chaining vs open addressing",
    prompt:
      "In 3-4 sentences, compare separate chaining and open addressing: name one advantage of each and state which degrades faster as the load factor approaches 1.",
    sampleAnswer:
      "Chaining is simple, tolerates load factors at or above 1, and makes deletion trivial, but costs extra memory for list nodes and has poor cache locality. Open addressing stores everything in one array, so it is cache-friendly and allocation-free, but deletion needs tombstones. Open addressing degrades much faster as alpha -> 1 because probe sequences lengthen sharply, while chaining degrades gradually (expected chain length just grows linearly with alpha).",
    explanation:
      "Full credit needs: one real advantage per scheme, plus identifying open addressing as the one that collapses near alpha = 1. This is one of the prof's three stated review-session targets.",
  },
  {
    id: "q7",
    type: "short",
    topic: "linear probing trace",
    prompt:
      "Insert keys 19, 26, 12, 33 into an empty table of size 7 using h(k) = k mod 7 and linear probing. Give the final index of each key.",
    sampleAnswer:
      "h(19)=5 -> slot 5. h(26)=5 -> collision, probe 6 -> slot 6. h(12)=5 -> collision, probe 6 (full), probe 0 -> slot 0. h(33)=5 -> collision, probe 6, 0 (full), probe 1 -> slot 1. Final: 19->5, 26->6, 12->0, 33->1.",
    explanation:
      "All four keys are congruent to 5 mod 7, so they pile onto slot 5 and the probe sequence wraps around the end of the array - exactly the by-hand trace the prof said to expect.",
  },
  {
    id: "q8",
    type: "code",
    topic: "implementation",
    prompt:
      "Write a function `contains(table, key)` for a separate-chaining hash table, where `table` is an array of lists of (key, value) pairs and `hash(key)` is given. Any common language or pseudocode.",
    sampleAnswer:
      "def contains(table, key):\n    bucket = table[hash(key) % len(table)]\n    for (k, v) in bucket:\n        if k == key:\n            return True\n    return False",
    explanation:
      "The essential moves: reduce the hash modulo the table length, then linearly scan ONLY that bucket comparing actual keys (the comparison is required - multiple keys share a bucket). Returning after checking just the first entry is the classic mistake.",
  },
];

async function main() {
  console.log("Seeding Hyntor database...");
  const passwordHash = await bcrypt.hash("coursemind", 10);
  // lastActiveAt = yesterday -> demo users' streaks CONTINUE (+1) on their
  // first activity instead of resetting to 1.
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const uni = await prisma.university.upsert({
    where: { emailDomain: "demo.edu" },
    update: {},
    create: { name: "Demo University", emailDomain: "demo.edu" },
  });

  const alex = await prisma.user.upsert({
    where: { email: "alex@demo.edu" },
    update: {},
    create: {
      email: "alex@demo.edu",
      name: "Alex Demo",
      passwordHash,
      role: "STUDENT",
      universityId: uni.id,
      xp: 120,
      streakCount: 3,
      lastActiveAt: yesterday,
    },
  });
  const maya = await prisma.user.upsert({
    where: { email: "maya@demo.edu" },
    update: {},
    create: {
      email: "maya@demo.edu",
      name: "Maya Chen",
      passwordHash,
      role: "STUDENT",
      universityId: uni.id,
      xp: 340,
      streakCount: 11,
      lastActiveAt: yesterday,
    },
  });
  const sam = await prisma.user.upsert({
    where: { email: "sam@demo.edu" },
    update: {},
    create: {
      email: "sam@demo.edu",
      name: "Sam Okafor",
      passwordHash,
      role: "TA",
      universityId: uni.id,
      xp: 90,
      streakCount: 1,
      lastActiveAt: yesterday,
    },
  });

  // Course (find-or-create by code since code isn't unique in the schema)
  let course = await prisma.course.findFirst({ where: { code: "CS201" } });
  if (!course) {
    course = await prisma.course.create({
      data: {
        code: "CS201",
        title: "Data Structures & Algorithms",
        subject: "Computer Science",
        description:
          "Core data structures (lists, trees, hash tables, graphs), the algorithms that operate on them, and how to reason about time/space complexity.",
      },
    });
  }

  for (const u of [alex, maya, sam]) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: u.id, courseId: course.id } },
      update: {},
      create: {
        userId: u.id,
        courseId: course.id,
        roleInCourse: u.role === "TA" ? "TA" : "STUDENT",
      },
    });
  }

  let hashNotes = await prisma.material.findFirst({
    where: { courseId: course.id, title: "Lecture 9 - Hash Tables & Collision Resolution" },
  });
  if (!hashNotes) {
    hashNotes = await prisma.material.create({
      data: {
        courseId: course.id,
        uploaderId: maya.id,
        title: "Lecture 9 - Hash Tables & Collision Resolution",
        type: "NOTES",
        extractedText: HASH_TABLE_NOTES,
        // upvoteCount is set from real MaterialUpvote rows below, so the
        // denormalized count always matches the join table.
      },
    });
  }

  let bstNotes = await prisma.material.findFirst({
    where: { courseId: course.id, title: "Lecture 11 - Binary Search Trees" },
  });
  if (!bstNotes) {
    bstNotes = await prisma.material.create({
      data: {
        courseId: course.id,
        uploaderId: alex.id,
        title: "Lecture 11 - Binary Search Trees",
        type: "NOTES",
        extractedText: BST_NOTES,
      },
    });
  }

  // Seed real upvotes (a student never upvotes their own upload), then
  // recompute upvoteCount from the join table so the two never drift.
  const seedUpvotes = [
    { material: hashNotes, voters: [alex, sam] }, // Maya's notes
    { material: bstNotes, voters: [maya, sam] }, // Alex's notes
  ];
  for (const { material, voters } of seedUpvotes) {
    for (const voter of voters) {
      await prisma.materialUpvote.upsert({
        where: { materialId_userId: { materialId: material.id, userId: voter.id } },
        update: {},
        create: { materialId: material.id, userId: voter.id },
      });
    }
    const upvoteCount = await prisma.materialUpvote.count({ where: { materialId: material.id } });
    await prisma.material.update({ where: { id: material.id }, data: { upvoteCount } });
  }

  const quizExists = await prisma.quiz.findFirst({
    where: { courseId: course.id, title: "Hash Tables - Practice Quiz" },
  });
  if (!quizExists) {
    await prisma.quiz.create({
      data: {
        courseId: course.id,
        sourceMaterialId: hashNotes.id,
        creatorId: null, // AI-generated
        title: "Hash Tables - Practice Quiz",
        questions: JSON.stringify(SEED_QUIZ_QUESTIONS),
      },
    });
  }

  console.log("Seed complete.");
  console.log("Demo logins (password: coursemind): alex@demo.edu, maya@demo.edu, sam@demo.edu");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
