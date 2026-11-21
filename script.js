/* =========================
   VISUALS: bracketed parse trees and dependency arc diagrams (SVG)
   treeSvg("(S (NP (N dogs)) (VP (V bark)))", {pick:true, label:"..."})
   depSvg({words:[...], arcs:[[head, dependent, "label", hot?], ...], root: index}, {pick:true})
   With {pick:true} nodes/words become clickable (data-key attributes).
========================= */

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function parseBracket(str) {
    const toks = str.match(/\(|\)|[^\s()]+/g);
    let i = 0;
    function node() {
        i++;                                   // "("
        const label = toks[i++];
        const kids = [];
        while (toks[i] !== ")") {
            if (toks[i] === "(") kids.push(node());
            else kids.push({ word: toks[i++] });
        }
        i++;                                   // ")"
        return { label, kids };
    }
    return node();
}

function treeSvg(bracket, opts) {
    opts = opts || {};
    const root = parseBracket(bracket);
    const LH = 56, TOP = 26;
    const words = [];
    let maxD = 0;

    (function walk(n, d) {
        if (n.word !== undefined) { n.leafIndex = words.length; words.push(n); return; }
        n.depth = d; maxD = Math.max(maxD, d);
        n.kids.forEach(k => walk(k, d + 1));
    })(root, 0);

    // horizontal positions of the words
    let cursor = 0;
    words.forEach(w => {
        w.w = Math.max(58, w.word.length * 11 + 26);
        w.x = cursor + w.w / 2;
        cursor += w.w + 8;
    });
    const W = cursor;
    const wordY = TOP + (maxD + 1) * LH;
    const H = wordY + 26;

    (function place(n) {
        if (n.word !== undefined) return;
        n.kids.forEach(place);
        const first = n.kids[0], last = n.kids[n.kids.length - 1];
        n.x = (first.x + last.x) / 2;
        n.y = TOP + n.depth * LH;
        n.yield = n.kids.map(k => k.word !== undefined ? k.word : k.yield).join(" ");
    })(root);

    let lines = "", pills = "";
    (function draw(n) {
        if (n.word !== undefined) return;
        n.kids.forEach(k => {
            if (k.word !== undefined) lines += `<line x1="${n.x}" y1="${n.y + 13}" x2="${k.x}" y2="${wordY - 13}"/>`;
            else lines += `<line x1="${n.x}" y1="${n.y + 13}" x2="${k.x}" y2="${k.y - 13}"/>`;
            draw(k);
        });
        const pw = Math.max(38, n.label.length * 11 + 20);
        const key = `${n.label}|${n.yield}`;
        const inner = `<rect class="pill" x="${n.x - pw / 2}" y="${n.y - 13}" width="${pw}" height="26" rx="13"/><text class="nt" x="${n.x}" y="${n.y + 5.5}">${esc(n.label)}</text>`;
        pills += opts.pick
            ? `<g class="tnode" data-key="${esc(key)}" data-label="${esc(n.label)} (${esc(n.yield)})" tabindex="0" role="button" aria-label="${esc(n.label)}: ${esc(n.yield)}">${inner}</g>`
            : inner;
    })(root);

    words.forEach(w => {
        pills += `<rect class="pill-t" x="${w.x - w.w / 2}" y="${wordY - 13}" width="${w.w}" height="26" rx="13"/><text class="tm" x="${w.x}" y="${wordY + 5.5}">${esc(w.word)}</text>`;
    });

    const label = opts.label || "Parse tree: " + words.map(w => w.word).join(" ");
    return `<svg class="tree-svg auto" style="max-width:${Math.round(W)}px" viewBox="0 0 ${Math.round(W)} ${H}" role="img" aria-label="${esc(label)}">${lines}${pills}</svg>`;
}

function depSvg(spec, opts) {
    opts = opts || {};
    const words = spec.words, arcs = spec.arcs || [];
    const root = spec.root;
    

    let cursor = 0;
    const ws = words.map(t => {
        const w = Math.max(54, t.length * 10 + 24);
        const x = cursor + w / 2;
        cursor += w + 6;
        return { t, w, x };
    });
    const W = cursor;

    const hOf = (a) => 26 + 24 * Math.abs(a[0] - a[1]);
    const maxH = arcs.length ? Math.max(...arcs.map(hOf)) : 0;
    const ROOT_LEN = Math.max(46, maxH + 36);        // ROOT label sits above every arc
    const topSpace = ROOT_LEN + 34;
    const baseY = topSpace + 30;
    const H = baseY + 26;
    const y0 = baseY - 14;                     // top edge of the word pills

    // spread the start points of arcs that leave the same head
    const offsets = {};
    ["L", "R"].forEach(side => {
        const byHead = {};
        arcs.forEach((a, i) => {
            const goesRight = a[1] > a[0];
            if ((side === "R") !== goesRight) return;
            (byHead[a[0]] = byHead[a[0]] || []).push(i);
        });
        Object.values(byHead).forEach(list => {
            list.sort((p, q) => Math.abs(arcs[p][0] - arcs[p][1]) - Math.abs(arcs[q][0] - arcs[q][1]));
            list.forEach((idx, k) => { offsets[idx] = (side === "R" ? 1 : -1) * (6 + 12 * k); });
        });
    });

    let svg = "";
    arcs.forEach((a, i) => {
        const [h, d, lab, hot] = a;
        const x1 = ws[h].x + (offsets[i] || 0), x2 = ws[d].x;
        const H0 = hOf(a);
        const cls = hot ? "dep-arc hot" : "dep-arc";
        const text = hot ? "?" : lab;
        const tw = Math.max(30, text.length * 8 + 12);
        const mid = (x1 + x2) / 2, ty = y0 - H0;
        svg += `<g class="${cls}"><path d="M ${x1} ${y0} C ${x1} ${y0 - H0 * 1.33}, ${x2} ${y0 - H0 * 1.33}, ${x2} ${y0}"/>` +
               `<polygon points="${x2 - 5},${y0 - 9} ${x2 + 5},${y0 - 9} ${x2},${y0}"/>` +
               `<rect x="${mid - tw / 2}" y="${ty - 10}" width="${tw}" height="19" rx="9"/><text x="${mid}" y="${ty + 4}">${esc(text)}</text></g>`;
    });

    if (root !== undefined) {
        const rx = ws[root].x;
        svg += `<g class="dep-arc root"><line x1="${rx}" y1="${y0 - ROOT_LEN}" x2="${rx}" y2="${y0 - 9}"/>` +
               `<polygon points="${rx - 5},${y0 - 9} ${rx + 5},${y0 - 9} ${rx},${y0}"/>` +
               `<rect x="${rx - 25}" y="${y0 - ROOT_LEN - 18}" width="50" height="19" rx="9"/><text x="${rx}" y="${y0 - ROOT_LEN - 4}">ROOT</text></g>`;
    }

    ws.forEach((w, i) => {
        const inner = `<rect class="pill-t" x="${w.x - w.w / 2}" y="${baseY - 14}" width="${w.w}" height="28" rx="14"/><text class="tm" x="${w.x}" y="${baseY + 5.5}">${esc(w.t)}</text>`;
        svg += opts.pick
            ? `<g class="tnode dword" data-key="${i}" data-label="${esc(w.t)}" tabindex="0" role="button" aria-label="${esc(w.t)}">${inner}</g>`
            : inner;
    });

    const label = opts.label || "Dependency diagram: " + words.join(" ");
    return `<svg class="dep-svg auto" style="max-width:${Math.round(W)}px" viewBox="0 0 ${Math.round(W)} ${H}" role="img" aria-label="${esc(label)}">${svg}</svg>`;
}

/* Fill any <div data-tree="..."> or <div data-dep='{...}'> placed in the HTML */
function renderStaticVisuals() {
    document.querySelectorAll("[data-tree]").forEach(el => {
        el.innerHTML = treeSvg(el.dataset.tree, { label: el.getAttribute("aria-label") || undefined });
    });
    document.querySelectorAll("[data-dep]").forEach(el => {
        el.innerHTML = depSvg(JSON.parse(el.dataset.dep), { label: el.getAttribute("aria-label") || undefined });
    });
}

/* =========================
   DEPENDENCY PARSING PAGE DATA
   types: match, mcq, multi, pick (click a word in the sentence)
   Arcs for the main examples were checked with spaCy (en_core_web_sm).
   Relation names follow spaCy's style: nsubj, dobj, det, amod, advmod, prep, pobj, ROOT.
========================= */

const PAGE = {
    name: "dependency parsing",
    all:  "Excellent! You can find heads and dependents, read relation labels, and tell dependency parses from constituency parses.",
    good: "Good job! Review the questions you missed and try again.",
    low:  "Keep practicing! Remember: every word except the ROOT has exactly one head, and an arc goes from the head to its dependent."
};

/* sentences: word lists and arcs as [head index, dependent index, label] */
const S_DOG  = { words: ["the", "dog", "chased", "the", "cat"], root: 2,
    arcs: [[1, 0, "det"], [2, 1, "nsubj"], [4, 3, "det"], [2, 4, "dobj"]] };
const S_SMALL = { words: ["a", "small", "dog", "chased", "the", "cat"], root: 3,
    arcs: [[2, 0, "det"], [2, 1, "amod"], [3, 2, "nsubj"], [3, 5, "dobj"], [5, 4, "det"]] };
const S_FISH = { words: ["the", "hungry", "cat", "quickly", "ate", "a", "fish"], root: 4,
    arcs: [[2, 0, "det"], [2, 1, "amod"], [4, 2, "nsubj"], [4, 3, "advmod"], [4, 6, "dobj"], [6, 5, "det"]] };
const TEL_WORDS = ["the", "dog", "saw", "the", "man", "with", "a", "telescope"];
const PARSE_A = { words: TEL_WORDS, root: 2,
    arcs: [[1, 0, "det"], [2, 1, "nsubj"], [2, 4, "dobj"], [4, 3, "det"], [2, 5, "prep"], [5, 7, "pobj"], [7, 6, "det"]] };
const PARSE_B = { words: TEL_WORDS, root: 2,
    arcs: [[1, 0, "det"], [2, 1, "nsubj"], [2, 4, "dobj"], [4, 3, "det"], [4, 5, "prep"], [5, 7, "pobj"], [7, 6, "det"]] };

/* Warm-up (click to select) */
const practice = {
    words: ["the", "dog", "chased", "the", "cat"],
    answer: [1, 4],
    correctHtml: "<strong>dog</strong> (the subject) and <strong>cat</strong> (the object) depend directly on <strong>chased</strong>. The two <em>the</em> words depend on their nouns instead.",
    wrongHtml: "Words that depend directly on the verb are the ones doing and receiving the action: who chased, and what was chased.",
    result: {
        label: "Arcs from chased:",
        items: [{ text: "chased → dog (nsubj)", hot: true }, { text: "chased → cat (dobj)", hot: true }]
    }
};

const questions = [
    /* ---------- EASY ---------- */
    {
        level: "easy",
        type: "mcq",
        title: "What is a head?",
        instruction: "Choose the one correct option.",
        prompt: "In a dependency parse, what is the head of a word?",
        options: [
            "The first word of the sentence",
            "The word it depends on, which it is attached to",
            "The longest word in the sentence",
            "The word that comes right before it"
        ],
        answer: "The word it depends on, which it is attached to",
        explain: "Each arc joins a <strong>head</strong> to a <strong>dependent</strong>. In \"the dog\", the word <em>dog</em> is the head and <em>the</em> depends on it. The head is not always the neighbouring word."
    },
    {
        level: "easy",
        type: "match",
        title: "Relation labels",
        instruction: "Click a label on the left, then its meaning on the right.",
        prompt: "Match each relation label to what it means.",
        left: [
            { text: "<b>nsubj</b>", answer: "The subject: who does the action" },
            { text: "<b>dobj</b>",  answer: "The direct object: what the action is done to" },
            { text: "<b>det</b>",   answer: "A determiner such as <b>the</b> or <b>a</b>" },
            { text: "<b>amod</b>",  answer: "An adjective that describes a noun" }
        ],
        right: [
            "An adjective that describes a noun",
            "The subject: who does the action",
            "A determiner such as <b>the</b> or <b>a</b>",
            "The direct object: what the action is done to"
        ],
        explain: "In \"the dog chased the cat\", <em>dog</em> is the <strong>nsubj</strong> of <em>chased</em> and <em>cat</em> is its <strong>dobj</strong>. <strong>det</strong> links <em>the</em> to its noun, and <strong>amod</strong> links an adjective like <em>small</em> to the noun it describes."
    },
    {
        level: "easy",
        type: "pick",
        title: "Find the ROOT",
        instruction: "Click the correct word.",
        prompt: "Click the ROOT of this sentence: the one word that is not a dependent of any other word.",
        visual: { kind: "dep", words: S_SMALL.words, arcs: S_SMALL.arcs, label: "Dependency arcs for a small dog chased the cat, without the ROOT marked" },
        answerNode: 3,
        explain: "Every arrow points at a dependent, and <strong>chased</strong> is the only word that no arrow points to. That makes it the ROOT, the main verb that the rest of the sentence hangs from."
    },
    {
        level: "easy",
        type: "match",
        title: "Find the head",
        instruction: "Click a word on the left, then its head on the right.",
        prompt: "In \"a small dog chased the cat\", match each word to its head.",
        reuse: true,
        left: [
            { text: "small", answer: "dog" },
            { text: "dog",   answer: "chased" },
            { text: "the",   answer: "cat" },
            { text: "cat",   answer: "chased" }
        ],
        right: ["chased", "a", "cat", "dog"],
        explain: "<em>small</em> describes <strong>dog</strong>, and <em>the</em> belongs to <strong>cat</strong>. The subject <em>dog</em> and the object <em>cat</em> both depend on the verb <strong>chased</strong>, which is why that answer is used twice."
    },

    /* ---------- MEDIUM ---------- */
    {
        level: "medium",
        type: "mcq",
        title: "Name the missing label",
        instruction: "Choose the one correct option.",
        prompt: "What is the label on the orange arc from cat to hungry?",
        context: '<div class="tree-wrap">' + depSvg({ words: S_FISH.words, root: S_FISH.root,
            arcs: S_FISH.arcs.map(a => a[2] === "amod" ? [a[0], a[1], a[2], true] : a) }, { label: "Dependency diagram of the hungry cat quickly ate a fish with one arc marked ?" }) + '</div>',
        options: ["nsubj", "dobj", "det", "amod"],
        answer: "amod",
        explain: "<em>hungry</em> is an adjective describing the noun <em>cat</em>, so the relation is <strong>amod</strong>. The other three labels are already used on other arcs: <em>the</em> and <em>a</em> are det, <em>cat</em> is the nsubj, and <em>fish</em> is the dobj."
    },
    {
        level: "medium",
        type: "multi",
        grid: true,
        title: "Dependents of a word",
        instruction: "Select every correct option.",
        prompt: "In \"the hungry cat quickly ate a fish\", which words depend directly on the verb \"ate\"?",
        options: ["the", "hungry", "cat", "quickly", "a", "fish"],
        answers: ["cat", "quickly", "fish"],
        explain: '<strong>cat</strong> (nsubj), <strong>quickly</strong> (advmod) and <strong>fish</strong> (dobj) attach directly to <em>ate</em>. The words <em>the</em>, <em>hungry</em> and <em>a</em> depend on their nouns instead.' +
            '<div class="tree-wrap">' + depSvg(S_FISH, { label: "Dependency diagram of the hungry cat quickly ate a fish" }) + '</div>'
    },
    {
        level: "medium",
        type: "match",
        title: "Two kinds of parse",
        instruction: "Click a statement on the left, then the kind of parse it describes.",
        prompt: "Match each statement to constituency parsing or dependency parsing.",
        reuse: true,
        left: [
            { text: "It has phrase labels such as NP and VP",       answer: "Constituency parse" },
            { text: "It links each word directly to its head",      answer: "Dependency parse" },
            { text: "It groups words into nested brackets",          answer: "Constituency parse" },
            { text: "It uses relation labels such as nsubj and dobj", answer: "Dependency parse" }
        ],
        right: ["Dependency parse", "Constituency parse"],
        explain: "A <strong>constituency</strong> parse groups words into phrases (NP, VP, S). A <strong>dependency</strong> parse has no phrase nodes: it only links words to words, and each link has a relation label."
    },

    /* ---------- HARD ---------- */
    {
        level: "hard",
        type: "pick",
        title: "Where does \"with\" attach?",
        instruction: "Click the correct word.",
        prompt: "In this reading, the man has the telescope. Click the head of the word \"with\".",
        visual: { kind: "dep", words: TEL_WORDS, arcs: [], label: "The sentence the dog saw the man with a telescope" },
        answerNode: 4,
        explain: "If the man has the telescope, then <em>with a telescope</em> describes <strong>man</strong>, so <em>with</em> depends on <em>man</em>. If it depended on <em>saw</em>, the dog would be using the telescope." +
            '<div class="tree-wrap">' + depSvg(PARSE_B, { label: "Dependency diagram where with attaches to man" }) + '</div>'
    },
    {
        level: "hard",
        type: "mcq",
        title: "Which parse means what?",
        instruction: "Choose the one correct option.",
        prompt: "Which parse means that the dog used the telescope to see the man?",
        context:
            '<div class="tree-cap">Parse A</div><div class="tree-wrap">' + depSvg(PARSE_A, { label: "Parse A: with attaches to saw" }) + '</div>' +
            '<div class="tree-cap">Parse B</div><div class="tree-wrap">' + depSvg(PARSE_B, { label: "Parse B: with attaches to man" }) + '</div>',
        options: ["Parse A", "Parse B", "Both parses", "Neither parse"],
        answer: "Parse A",
        explain: "In <strong>Parse A</strong>, <em>with</em> depends on the verb <em>saw</em>, so the telescope is how the seeing was done. In Parse B it depends on <em>man</em>, so the man has the telescope. This is attachment ambiguity again."
    },
    {
        level: "hard",
        type: "multi",
        title: "Rules of a dependency tree",
        instruction: "Select every correct option.",
        prompt: "Select all the statements that are true for a dependency tree of one sentence.",
        options: [
            "Every word except the ROOT has exactly one head",
            "A word can have several dependents",
            "A sentence can have two ROOT words",
            "A word can have two heads",
            "Arcs link words directly, with no phrase nodes such as NP",
            "There is an NP node above every noun"
        ],
        answers: [
            "Every word except the ROOT has exactly one head",
            "A word can have several dependents",
            "Arcs link words directly, with no phrase nodes such as NP"
        ],
        explain: "The tree has <strong>one ROOT</strong>, and every other word has <strong>exactly one head</strong>, but a head can have many dependents (<em>ate</em> has three). There are no phrase nodes like NP in a dependency tree."
    }
];

/* =========================
   MIXED QUESTION ENGINE
   Supports four question types:
   match - click an item on the left, then its match on the right (with connecting lines)
   mcq   - choose one option
   multi - select all options that apply
   order - click the steps in the correct order (numbers appear as you click)
   Any question may also carry a reference box (q.context) shown above the answer area.
   Expects these globals from the data section above:
   practice, questions, PAGE
========================= */

const LEVEL_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" };
const TYPE_LABEL = { match: "Match the column", mcq: "Multiple choice", multi: "Select all that apply", order: "Put in order", pick: "Click to answer" };
const LINE_COLORS = ["#5b57d9", "#d97a1f", "#1f9d8b", "#c23b8a", "#3a7bd5", "#8a6d1f", "#7a4fd0", "#4a5568", "#b5483a", "#2a8f9d"];
const practiceAnswer = new Set(practice.answer);
let practiceSelection = new Set();

let currentQuestionIndex = 0;
let activeLeft = null;                                   // match: left item waiting for its match
let questionResults = new Array(questions.length).fill(null);

// answers[q]: match -> array (left index -> chosen right index or null); mcq -> index or null; multi -> Set of indexes
let answers = questions.map(q =>
    q.type === "match" ? q.left.map(() => null) : q.type === "mcq" ? null : q.type === "order" ? [] : q.type === "pick" ? null : new Set()
);
// key[q]: match -> array of correct right indexes; mcq -> correct index; multi -> Set of correct indexes
const key = questions.map(q =>
    q.type === "match" ? q.left.map(l => q.right.indexOf(l.answer))
    : q.type === "mcq" ? q.options.indexOf(q.answer)
    : q.type === "order" ? q.correctOrder.map(t => q.options.indexOf(t))
    : q.type === "pick" ? String(q.answerNode)
    : new Set(q.answers.map(a => q.options.indexOf(a)))
);

/* =========================
   HELPERS
========================= */

function plain(html) {
    const d = document.createElement("div");
    d.innerHTML = html;
    return d.textContent;
}

function makeChip(text, onClick) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "word-chip";
    chip.textContent = text;
    chip.setAttribute("aria-pressed", "false");
    chip.addEventListener("click", onClick);
    return chip;
}

function setChipSelected(chip, isSelected) {
    chip.classList.toggle("selected", isSelected);
    chip.setAttribute("aria-pressed", isSelected ? "true" : "false");
}

function sameSet(a, b) {
    return a.size === b.size && [...a].every(v => b.has(v));
}

/* =========================
   WARM-UP (click to select)
========================= */

function renderPractice() {
    const container = document.getElementById("practiceSentence");
    container.innerHTML = "";
    practiceSelection = new Set();

    practice.words.forEach((word, index) => {
        const chip = makeChip(word, () => {
            if (practiceSelection.has(index)) practiceSelection.delete(index);
            else practiceSelection.add(index);
            setChipSelected(chip, practiceSelection.has(index));
        });
        container.appendChild(chip);
    });
}

function checkPractice() {
    const feedback = document.getElementById("practiceFeedback");
    const result = document.getElementById("practiceResult");
    const isCorrect = sameSet(practiceSelection, practiceAnswer);

    feedback.className = isCorrect ? "feedback show correct" : "feedback show wrong";
    feedback.innerHTML = isCorrect
        ? "<strong>🎉 Correct!</strong><br>" + practice.correctHtml
        : "<strong>❌ Not quite.</strong><br>" + practice.wrongHtml;

    result.className = "practice-result show";
    result.innerHTML = `
        <div class="result-label">${practice.result.label}</div>
        <div class="result-chips">
            ${practice.result.items.map(t => `<span class="result-chip${t.hot ? " changed" : ""}">${t.text}</span>`).join("")}
        </div>
    `;

    document.querySelectorAll("#practiceSentence .word-chip").forEach((chip, index) => {
        chip.classList.remove("correct", "missed", "wrong-selected");
        if (practiceAnswer.has(index)) {
            chip.classList.add(practiceSelection.has(index) ? "correct" : "missed");
        } else if (practiceSelection.has(index)) {
            chip.classList.add("wrong-selected");
        }
    });
}

/* =========================
   PROGRESS STRIP
========================= */

function buildProgressStrip() {
    const strip = document.getElementById("progressStrip");
    strip.innerHTML = "";
    questions.forEach((q, i) => {
        const seg = document.createElement("button");
        seg.type = "button";
        seg.className = "progress-seg seg-" + q.level;
        seg.textContent = i + 1;
        seg.addEventListener("click", () => {
            currentQuestionIndex = i;
            activeLeft = null;
            renderQuestion();
        });
        strip.appendChild(seg);
    });
}

function updateProgressStrip() {
    document.querySelectorAll("#progressStrip .progress-seg").forEach((seg, i) => {
        const r = questionResults[i];
        seg.classList.toggle("seg-correct", r === true);
        seg.classList.toggle("seg-wrong", r === false);
        seg.classList.toggle("seg-current", i === currentQuestionIndex);
        const status = r === true ? "correct" : r === false ? "incorrect" : "not checked";
        seg.setAttribute("aria-label", `Question ${i + 1}, ${LEVEL_LABEL[questions[i].level]}, ${TYPE_LABEL[questions[i].type]}, ${status}`);
        if (i === currentQuestionIndex) seg.setAttribute("aria-current", "step");
        else seg.removeAttribute("aria-current");
    });
}

/* =========================
   QUESTION RENDERING
========================= */

function renderQuestion() {
    const q = questions[currentQuestionIndex];
    const area = document.getElementById("taskArea");
    area.innerHTML = "";

    document.getElementById("currentQuestion").textContent = currentQuestionIndex + 1;
    document.getElementById("questionInstruction").textContent = q.instruction;

    const box = document.getElementById("questionBox");
    box.innerHTML = "";
    const meta = document.createElement("div");
    meta.className = "question-meta";
    const title = document.createElement("span");
    title.className = "question-title";
    title.textContent = q.title;
    const level = document.createElement("span");
    level.className = "level level-" + q.level;
    level.textContent = LEVEL_LABEL[q.level];
    const type = document.createElement("span");
    type.className = "type-pill";
    type.textContent = TYPE_LABEL[q.type];
    meta.append(title, level, type);
    const prompt = document.createElement("div");
    prompt.className = "question-prompt";
    prompt.textContent = q.prompt;
    box.append(meta, prompt);

    if (q.context) {
        const ctx = document.createElement("div");
        ctx.className = "q-context";
        ctx.innerHTML = q.context;
        area.appendChild(ctx);
    }

    if (q.type === "match") renderMatchBoard(q, area);
    else if (q.type === "order") renderOrder(q, area);
    else if (q.type === "pick") renderPick(q, area);
    else renderOptions(q, area);

    resetFeedback();
    if (questionResults[currentQuestionIndex] !== null) showFeedback(true);

    refreshQuestion();
    updateNavigationButtons();
    updateProgressStrip();
    requestAnimationFrame(refreshQuestion);
}

/* ----- option cards (mcq and multi) ----- */

function renderOptions(q, area) {
    const list = document.createElement("div");
    list.className = "opt-list" + (q.grid ? " grid" : "") + (q.mono ? " mono" : "");
    list.id = "optList";
    list.setAttribute("role", q.type === "mcq" ? "radiogroup" : "group");
    list.setAttribute("aria-label", q.type === "mcq" ? "Choose one option" : "Select all that apply");

    q.options.forEach((text, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "opt";
        btn.dataset.index = i;
        btn.setAttribute("role", q.type === "mcq" ? "radio" : "checkbox");
        const mark = document.createElement("span");
        mark.className = q.type === "mcq" ? "opt-key" : "opt-box";
        mark.setAttribute("aria-hidden", "true");
        if (q.type === "mcq") mark.textContent = String.fromCharCode(65 + i);
        const label = document.createElement("span");
        label.className = "opt-text";
        label.innerHTML = text;
        btn.append(mark, label);
        btn.addEventListener("click", () => onOptionClick(i));
        list.appendChild(btn);
    });
    area.appendChild(list);

    if (q.type === "multi") {
        const legend = document.createElement("p");
        legend.className = "opt-legend";
        legend.id = "optLegend";
        legend.textContent = "There can be more than one correct option. Select every one that applies.";
        area.appendChild(legend);
    }
}

function onOptionClick(i) {
    const q = questions[currentQuestionIndex];
    if (q.type === "mcq") {
        answers[currentQuestionIndex] = i;
    } else {
        const set = answers[currentQuestionIndex];
        if (set.has(i)) set.delete(i); else set.add(i);
    }
    onAnswerChanged();
}

/* ----- click a node / word in a diagram ----- */

function renderPick(q, area) {
    const wrap = document.createElement("div");
    wrap.className = "pick-wrap";
    wrap.id = "pickWrap";
    wrap.innerHTML = q.visual.kind === "tree"
        ? treeSvg(q.visual.tree, { pick: true, label: q.visual.label })
        : depSvg(q.visual, { pick: true, label: q.visual.label });
    area.appendChild(wrap);

    wrap.querySelectorAll("[data-key]").forEach(el => {
        el.addEventListener("click", () => onPickClick(el.dataset.key));
        el.addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPickClick(el.dataset.key); }
        });
    });

    const tools = document.createElement("div");
    tools.className = "match-tools";
    const hint = document.createElement("span");
    hint.textContent = q.visual.kind === "tree"
        ? "Click a node (a purple label) in the tree. Click another one to change your answer."
        : "Click a word in the sentence. Click another one to change your answer.";
    tools.appendChild(hint);
    area.appendChild(tools);
}

function onPickClick(k) {
    answers[currentQuestionIndex] = k;
    onAnswerChanged();
}

function refreshPick() {
    const wrap = document.getElementById("pickWrap");
    if (!wrap) return;
    const ans = answers[currentQuestionIndex];
    const k = key[currentQuestionIndex];
    const checked = questionResults[currentQuestionIndex] !== null;
    let chosenLabel = "";
    wrap.querySelectorAll("[data-key]").forEach(el => {
        const selected = el.dataset.key === ans;
        const right = el.dataset.key === k;
        if (selected) chosenLabel = el.dataset.label;
        el.classList.toggle("is-selected", selected && !checked);
        el.classList.toggle("is-correct", checked && right);
        el.classList.toggle("is-wrong", checked && selected && !right);
        el.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    document.getElementById("selectionStatus").textContent = ans === null ? "Click your answer in the diagram" : "Selected: " + chosenLabel;
}

/* ----- put in order ----- */

function renderOrder(q, area) {
    if (q.start) {
        const start = document.createElement("div");
        start.className = "order-start";
        start.innerHTML = q.start;
        area.appendChild(start);
    }

    const list = document.createElement("div");
    list.className = "opt-list order-list";
    list.id = "optList";
    list.setAttribute("role", "group");
    list.setAttribute("aria-label", "Click the steps in order");

    q.options.forEach((text, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "opt";
        btn.dataset.index = i;
        const mark = document.createElement("span");
        mark.className = "opt-key";
        mark.setAttribute("aria-hidden", "true");
        const label = document.createElement("span");
        label.className = "opt-text";
        label.innerHTML = text;
        btn.append(mark, label);
        btn.addEventListener("click", () => onOrderClick(i));
        list.appendChild(btn);
    });
    area.appendChild(list);

    const tools = document.createElement("div");
    tools.className = "match-tools";
    const hint = document.createElement("span");
    hint.id = "orderHint";
    hint.textContent = "Click the steps in order, first step first. Click a numbered step again to remove it.";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "link-button";
    clear.textContent = "Reset order";
    clear.addEventListener("click", clearOrder);
    tools.append(hint, clear);
    area.appendChild(tools);
}

function onOrderClick(i) {
    const seq = answers[currentQuestionIndex];
    const pos = seq.indexOf(i);
    if (pos === -1) seq.push(i);
    else seq.splice(pos, 1);
    onAnswerChanged();
}

function clearOrder() {
    answers[currentQuestionIndex] = [];
    onAnswerChanged();
}

function refreshOrder() {
    const q = questions[currentQuestionIndex];
    const list = document.getElementById("optList");
    if (!list) return;
    const seq = answers[currentQuestionIndex];
    const k = key[currentQuestionIndex];
    const checked = questionResults[currentQuestionIndex] !== null;

    list.querySelectorAll(".opt").forEach((btn, i) => {
        const pos = seq.indexOf(i);
        const placed = pos !== -1;
        const right = placed && k[pos] === i;
        btn.querySelector(".opt-key").textContent = placed ? pos + 1 : "";
        btn.classList.toggle("is-selected", placed && !checked);
        btn.classList.toggle("is-correct", checked && right);
        btn.classList.toggle("is-wrong", checked && placed && !right);
        btn.setAttribute("aria-label", plain(q.options[i]) + (placed ? ", step " + (pos + 1) : ", not placed yet"));
    });

    document.getElementById("selectionStatus").textContent = `${seq.length} of ${q.options.length} steps placed`;
}

/* ----- match board ----- */

function renderMatchBoard(q, area) {
    const board = document.createElement("div");
    board.className = "match-board";
    board.id = "matchBoard";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "match-lines");
    svg.setAttribute("aria-hidden", "true");
    svg.id = "matchLines";

    const cols = document.createElement("div");
    cols.className = "match-cols";

    const leftCol = document.createElement("div");
    leftCol.className = "match-col";
    q.left.forEach((item, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "match-item match-left";
        btn.dataset.index = i;
        const leftLabel = document.createElement("span");
        leftLabel.className = "match-label";
        leftLabel.innerHTML = item.text;
        btn.appendChild(leftLabel);
        btn.addEventListener("click", () => onLeftClick(i));
        leftCol.appendChild(btn);
    });

    const gap = document.createElement("div");
    gap.className = "match-gap";

    const rightCol = document.createElement("div");
    rightCol.className = "match-col";
    q.right.forEach((text, j) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "match-item match-right";
        btn.dataset.index = j;
        const label = document.createElement("span");
        label.className = "match-label";
        label.innerHTML = text;
        const dots = document.createElement("span");
        dots.className = "match-dots";
        btn.append(label, dots);
        btn.addEventListener("click", () => onRightClick(j));
        rightCol.appendChild(btn);
    });

    cols.append(leftCol, gap, rightCol);
    board.append(svg, cols);

    const tools = document.createElement("div");
    tools.className = "match-tools";
    const hint = document.createElement("span");
    hint.id = "matchHint";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "link-button";
    clear.textContent = "Clear matches";
    clear.addEventListener("click", clearMatches);
    tools.append(hint, clear);

    area.append(board, tools);
}

function onLeftClick(i) {
    activeLeft = activeLeft === i ? null : i;
    refreshQuestion();
}

function onRightClick(j) {
    const q = questions[currentQuestionIndex];
    const sel = answers[currentQuestionIndex];
    if (activeLeft === null) {
        document.getElementById("matchHint").textContent = "Click an item on the left first, then its match on the right.";
        return;
    }
    if (!q.reuse) {
        sel.forEach((v, k) => { if (v === j && k !== activeLeft) sel[k] = null; });
    }
    sel[activeLeft] = j;
    activeLeft = null;
    onAnswerChanged();
}

function clearMatches() {
    answers[currentQuestionIndex] = questions[currentQuestionIndex].left.map(() => null);
    activeLeft = null;
    onAnswerChanged();
}

/* ----- shared change handling and drawing ----- */

function onAnswerChanged() {
    // Changing an answer after checking clears the old result so it can be checked again.
    if (questionResults[currentQuestionIndex] !== null) {
        questionResults[currentQuestionIndex] = null;
        resetFeedback();
        updateProgressStrip();
    }
    refreshQuestion();
}

function refreshQuestion() {
    const q = questions[currentQuestionIndex];
    if (q.type === "match") refreshMatch();
    else if (q.type === "order") refreshOrder();
    else if (q.type === "pick") refreshPick();
    else refreshOptions();
}

function refreshOptions() {
    const q = questions[currentQuestionIndex];
    const list = document.getElementById("optList");
    if (!list) return;
    const checked = questionResults[currentQuestionIndex] !== null;
    const ans = answers[currentQuestionIndex];
    const k = key[currentQuestionIndex];

    list.querySelectorAll(".opt").forEach((btn, i) => {
        const selected = q.type === "mcq" ? ans === i : ans.has(i);
        const isRight = q.type === "mcq" ? k === i : k.has(i);
        btn.classList.toggle("is-selected", selected && !checked);
        btn.classList.toggle("is-correct", checked && selected && isRight || (checked && q.type === "mcq" && isRight));
        btn.classList.toggle("is-wrong", checked && selected && !isRight);
        btn.classList.toggle("is-missed", checked && q.type === "multi" && !selected && isRight);
        btn.setAttribute("aria-checked", selected ? "true" : "false");
    });

    const status = document.getElementById("selectionStatus");
    if (q.type === "mcq") {
        status.textContent = ans === null ? "Choose one option" : `Option ${String.fromCharCode(65 + ans)} selected`;
    } else {
        status.textContent = `${ans.size} option${ans.size === 1 ? "" : "s"} selected`;
    }
}

function refreshMatch() {
    const board = document.getElementById("matchBoard");
    if (!board) return;
    const q = questions[currentQuestionIndex];
    const sel = answers[currentQuestionIndex];
    const k = key[currentQuestionIndex];
    const checked = questionResults[currentQuestionIndex] !== null;
    const lefts = [...board.querySelectorAll(".match-left")];
    const rights = [...board.querySelectorAll(".match-right")];

    lefts.forEach((btn, i) => {
        const matched = sel[i] !== null;
        btn.classList.toggle("is-active", activeLeft === i);
        btn.classList.toggle("is-matched", matched);
        btn.classList.toggle("is-correct", checked && matched && sel[i] === k[i]);
        btn.classList.toggle("is-wrong", checked && matched && sel[i] !== k[i]);
        btn.style.setProperty("--c", LINE_COLORS[i % LINE_COLORS.length]);
        btn.setAttribute("aria-pressed", activeLeft === i ? "true" : "false");
        btn.setAttribute("aria-label", plain(q.left[i].text) + (matched ? ", matched with " + plain(q.right[sel[i]]) : ", not matched yet"));
    });

    rights.forEach((btn, j) => {
        const dots = btn.querySelector(".match-dots");
        dots.innerHTML = "";
        sel.forEach((v, i) => {
            if (v === j) {
                const dot = document.createElement("i");
                dot.style.background = LINE_COLORS[i % LINE_COLORS.length];
                dots.appendChild(dot);
            }
        });
        btn.classList.toggle("is-used", sel.includes(j));
    });

    drawLines(board, lefts, rights, sel, k, checked);

    const done = sel.filter(v => v !== null).length;
    const status = document.getElementById("selectionStatus");
    status.textContent = activeLeft !== null
        ? `Selected "${plain(q.left[activeLeft].text)}". Now click its match on the right.`
        : `${done} of ${q.left.length} matched`;
    const hint = document.getElementById("matchHint");
    if (hint) hint.textContent = "Click an item on the left, then its match on the right. Click a left item again to change its match.";
}

function drawLines(board, lefts, rights, sel, k, checked) {
    const svg = document.getElementById("matchLines");
    const b = board.getBoundingClientRect();
    svg.setAttribute("width", b.width);
    svg.setAttribute("height", b.height);
    svg.innerHTML = "";

    // spread the end points when several lines land on the same right item
    const seen = {};
    const counts = {};
    sel.forEach(v => { if (v !== null) counts[v] = (counts[v] || 0) + 1; });

    sel.forEach((j, i) => {
        if (j === null) return;
        const lb = lefts[i].getBoundingClientRect();
        const rb = rights[j].getBoundingClientRect();
        const n = seen[j] = (seen[j] === undefined ? 0 : seen[j] + 1);
        const spread = (n - (counts[j] - 1) / 2) * 6;
        const x1 = lb.right - b.left, y1 = lb.top + lb.height / 2 - b.top;
        const x2 = rb.left - b.left,  y2 = rb.top + rb.height / 2 - b.top + spread;
        const mid = (x1 + x2) / 2;
        const ok = checked && j === k[i];
        const bad = checked && !ok;
        const color = ok ? "#2e9d5b" : bad ? "#d6455a" : LINE_COLORS[i % LINE_COLORS.length];

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", color);
        path.setAttribute("stroke-width", "3");
        path.setAttribute("stroke-linecap", "round");
        if (bad) path.setAttribute("stroke-dasharray", "6 5");
        svg.appendChild(path);

        [[x1, y1], [x2, y2]].forEach(([cx, cy]) => {
            const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            c.setAttribute("cx", cx); c.setAttribute("cy", cy); c.setAttribute("r", 4.5);
            c.setAttribute("fill", color);
            svg.appendChild(c);
        });
    });
}

window.addEventListener("resize", () => requestAnimationFrame(refreshQuestion));

/* =========================
   CHECKING
========================= */

function checkAnswer() {
    const q = questions[currentQuestionIndex];
    const ans = answers[currentQuestionIndex];
    const k = key[currentQuestionIndex];
    const feedback = document.getElementById("feedback");
    let ok;

    if (q.type === "match") {
        if (ans.some(v => v === null)) {
            feedback.className = "feedback show wrong";
            feedback.innerHTML = "<strong>Match every item on the left first.</strong><br>Click an item on the left, then its match on the right, then check again.";
            return;
        }
        ok = ans.every((v, i) => v === k[i]);
    } else if (q.type === "pick") {
        if (ans === null) {
            feedback.className = "feedback show wrong";
            feedback.innerHTML = "<strong>Click an answer first.</strong><br>Click your answer in the diagram, then check again.";
            return;
        }
        ok = ans === k;
    } else if (q.type === "order") {
        if (ans.length < q.options.length) {
            feedback.className = "feedback show wrong";
            feedback.innerHTML = "<strong>Place every step first.</strong><br>Click all the steps in order, then check again.";
            return;
        }
        ok = ans.every((v, i) => v === k[i]);
    } else if (q.type === "mcq") {
        if (ans === null) {
            feedback.className = "feedback show wrong";
            feedback.innerHTML = "<strong>Choose an option first.</strong><br>Pick the option you think is correct, then check again.";
            return;
        }
        ok = ans === k;
    } else {
        if (ans.size === 0) {
            feedback.className = "feedback show wrong";
            feedback.innerHTML = "<strong>Select at least one option first.</strong><br>Pick every option that applies, then check again.";
            return;
        }
        ok = sameSet(ans, k);
    }

    questionResults[currentQuestionIndex] = ok;
    showFeedback(false);
    updateProgressStrip();
    refreshQuestion();
}

function showFeedback(isSaved) {
    const q = questions[currentQuestionIndex];
    const feedback = document.getElementById("feedback");
    const explain = document.getElementById("explainBox");
    const ok = questionResults[currentQuestionIndex] === true;
    const ans = answers[currentQuestionIndex];
    const k = key[currentQuestionIndex];

    feedback.className = ok ? "feedback show correct" : "feedback show wrong";
    if (ok) {
        feedback.innerHTML = isSaved
            ? "<strong>🎉 Correct!</strong><br>You answered this question correctly."
            : "<strong>🎉 Correct!</strong><br>" + (q.type === "match" ? "Every match is right." : q.type === "order" ? "Every step is in the right place." : q.type === "pick" ? "You clicked the right spot." : q.type === "mcq" ? "That is the correct option." : "You selected exactly the right options.");
    } else if (q.type === "match") {
        const wrong = ans.filter((v, i) => v !== k[i]).length;
        feedback.innerHTML = `<strong>❌ Not quite.</strong><br>${wrong} of ${q.left.length} matches are wrong (shown as red dashed lines). Read the correct matches below, then change your matches to try again.`;
    } else if (q.type === "pick") {
        feedback.innerHTML = "<strong>❌ Not quite.</strong><br>Your choice is shown in red and the correct answer in green. Read the explanation below, then click again.";
    } else if (q.type === "order") {
        const wrong = ans.filter((v, i) => v !== k[i]).length;
        feedback.innerHTML = `<strong>❌ Not quite.</strong><br>${wrong} of ${q.options.length} steps are in the wrong place (red dashed). Read the correct order below, then reset and try again.`;
    } else if (q.type === "mcq") {
        feedback.innerHTML = "<strong>❌ Not quite.</strong><br>The correct option is shown in green. Read the explanation below, then try again.";
    } else {
        feedback.innerHTML = "<strong>❌ Not quite.</strong><br>Green options are correct. Red dashed options should not be selected, and green dashed options are ones you missed. Read the explanation below, then try again.";
    }

    let html = "<strong>Why:</strong> " + q.explain;
    if (!ok && q.type === "match") {
        html += '<div class="answer-key"><strong>Correct matches</strong><ul>' +
            q.left.map(l => `<li><span>${l.text}</span><span class="key-arrow">→</span><span>${l.answer}</span></li>`).join("") +
            "</ul></div>";
    }
    if (!ok && q.type === "order") {
        html += '<div class="answer-key"><strong>Correct order</strong><ol class="key-steps">' +
            q.correctOrder.map((t, i) => `<li><span>${t}</span>${q.rules ? `<span class="key-rule">${q.rules[i]}</span>` : ""}</li>`).join("") +
            "</ol></div>";
    }
    explain.className = "explain-box show";
    explain.innerHTML = html;
}

function resetFeedback() {
    const feedback = document.getElementById("feedback");
    const explain = document.getElementById("explainBox");
    feedback.className = "feedback";
    feedback.innerHTML = "";
    explain.className = "explain-box";
    explain.innerHTML = "";
}

/* =========================
   NAVIGATION & FINISH
========================= */

function nextQuestion() {
    if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        activeLeft = null;
        renderQuestion();
    }
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        activeLeft = null;
        renderQuestion();
    }
}

function updateNavigationButtons() {
    const previousButton = document.getElementById("previousButton");
    const nextButton = document.getElementById("nextButton");
    previousButton.disabled = currentQuestionIndex === 0;

    if (currentQuestionIndex === questions.length - 1) {
        nextButton.textContent = "Finish Task ✓";
        nextButton.onclick = finishTask;
    } else {
        nextButton.textContent = "Next →";
        nextButton.onclick = nextQuestion;
    }
}

function finishTask() {
    const score = questionResults.filter(r => r === true).length;
    const total = questions.length;
    const taskCard = document.querySelector(".task-card");

    const levelScores = ["easy", "medium", "hard"].map(level => {
        const idx = questions.map((q, i) => q.level === level ? i : -1).filter(i => i !== -1);
        const got = idx.filter(i => questionResults[i] === true).length;
        return `<li><span><span class="level level-${level}">${LEVEL_LABEL[level]}</span></span><span>${got} / ${idx.length}</span></li>`;
    }).join("");

    const recap = questions.map((q, i) => {
        const status = questionResults[i] === true
            ? '<span class="ok">Correct</span>'
            : questionResults[i] === false
                ? '<span class="no">Incorrect</span>'
                : '<span class="no">Not checked</span>';
        return `<li><span>${i + 1}. ${q.title}</span>${status}</li>`;
    }).join("");

    taskCard.innerHTML = `
        <div class="final-score">
            <div class="score-icon">🎉</div>
            <h2>Task Completed!</h2>
            <p>You completed all ${total} ${PAGE.name} challenges.</p>
            <div class="score-circle">${score}/${total}</div>
            <ul class="recap">${levelScores}</ul>
            <ul class="recap">${recap}</ul>
            <p class="score-message">
                ${score === total
                    ? PAGE.all
                    : score >= Math.ceil(total * 0.7)
                    ? PAGE.good
                    : PAGE.low
                }
            </p>
            <button onclick="restartQuiz()">Try Again</button>
        </div>
    `;
}

function restartQuiz() {
    location.reload();
}

document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("totalQuestions").textContent = questions.length;
    if (typeof renderStaticVisuals === "function") renderStaticVisuals();
    renderPractice();
    buildProgressStrip();
    renderQuestion();
});
