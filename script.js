import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDSJiK860tmo6-VcfEtGpsNvEsmH4cEYDI",
  authDomain: "trackerapp-e1ac6.firebaseapp.com",
  projectId: "trackerapp-e1ac6",
  storageBucket: "trackerapp-e1ac6.appspot.com",
  messagingSenderId: "564625055842",
  appId: "1:564625055842:web:1df7b8c33b9f3fe5ee313b",
  measurementId: "G-DS39BZFTVG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// --- GLOBAL ---
let currentUser = null;
let calendarOffset = 0;
let regularCalendarOffset = 0;



// --- AUTH ---
document.getElementById("loginBtn").addEventListener("click", () => {
  //signInWithRedirect(auth, provider)
  signInWithPopup(auth, provider)
  .then(result => {
    currentUser = result.user;
    loadUserData();
    toggleAuthButtons(true);
  })
  .catch(error => {
    console.error("Popup login failed:", error.message);
  });


    //console.log('logged in');
});

getRedirectResult(auth)
  .then(result => {
    if (result && result.user) {
      currentUser = result.user;
      //console.log("Logged in via redirect:", currentUser.email);
      loadUserData();
      toggleAuthButtons(true);
    }
  })
  .catch(error => {
    console.error("Redirect login error:", error.message);
  });

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => {
    currentUser = null;
    toggleAuthButtons(false);
    alert("Logged out.");
  });
});

onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    loadUserData();
    toggleAuthButtons(true);
  } else {
    toggleAuthButtons(false);
  }

});

function toggleAuthButtons(loggedIn) {
  document.getElementById("loginBtn").style.display = loggedIn ? "none" : "inline";
  document.getElementById("logoutBtn").style.display = loggedIn ? "inline" : "none";
}

// --- DATA ---
async function loadUserData() {
  if (!currentUser) return;

  const ref = doc(db, "users", currentUser.uid);
let snap = await getDoc(ref);

// If it doesn't exist, create it
if (!snap.exists()) {
  await setDoc(ref, {
    periodDates: [],
    symptomLog: {},
    loggedPeriods: []
  });
  // Force a fresh read after creation
  snap = await getDoc(ref);
}

const data = snap.data();

// ✅ Now update localStorage
localStorage.setItem("periodDates", JSON.stringify(data.periodDates || []));
localStorage.setItem("symptomLog", JSON.stringify(data.symptomLog || {}));
localStorage.setItem("loggedPeriods", JSON.stringify(data.loggedPeriods || []));

  //console.log("Loaded data:", data);
  loadCalendar();
  updateCycleInfo();
  loadSymptomCalendar();
  summarizePatterns();
}


async function saveUserData() {
  if (!currentUser) return;
  const ref = doc(db, "users", currentUser.uid);
  
  const snap = await getDoc(ref);
if (!snap.exists()) {
  await setDoc(ref, {
    periodDates: [],
    symptomLog: {},
    loggedPeriods: []
  });
}
await updateDoc(ref, {
  periodDates: JSON.parse(localStorage.getItem("periodDates") || "[]"),
  symptomLog: JSON.parse(localStorage.getItem("symptomLog") || "{}"),
  loggedPeriods: JSON.parse(localStorage.getItem("loggedPeriods") || "[]")
});

//console.log('data saved');

}

// --- CORE LOGIC ---


function getLastPeriod(referenceDate = new Date()) {
  const map = JSON.parse(localStorage.getItem("loggedPeriodsMap") || "{}");
  const dates = Object.entries(map)
    .filter(([_, type]) => type === "period" || type === "last")
    .map(([d]) => new Date(d + "T12:00:00"))
    .filter(d => d <= referenceDate)
    .sort((a, b) => b - a);

  return dates[0] || null;
}




function getCyclePhaseForDate(date) {
  const logged = JSON.parse(localStorage.getItem("loggedPeriods")) || [];
  const iso = date.getFullYear() + '-' +
              String(date.getMonth() + 1).padStart(2, '0') + '-' +
              String(date.getDate()).padStart(2, '0');

  const isLogged = logged.includes(iso);
  const isTodayOrFuture = date >= (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  
  const avgLength = getAvgCycleLength();
  const totalMenstrualDays = 5;

  const loggedDates = logged.map(d => new Date(d + "T12:00:00")).sort((a, b) => b - a);
  if (!loggedDates.length) return null;

  const anchor = getCycleAnchor(date);
  if (!anchor || date < anchor) return null;

  const map = JSON.parse(localStorage.getItem("loggedPeriodsMap") || {});
const yesterdayISO = getLocalISO(new Date(date.getTime() - 86400000));

// 🔥 Special case: if yesterday was marked "last", skip menstrual logic
if (map[yesterdayISO] === "last" && !map[iso]) {
  const avgLength = getAvgCycleLength();
  const anchor = new Date(date); // today becomes the anchor
  const dayOffset = 5; // we skip menstrual (0-4), start at day 5

  const cycleDay = ((dayOffset % avgLength) + avgLength) % avgLength;
  return getPhase(cycleDay);
}


  const dayOffset = Math.floor((date - anchor) / (1000 * 60 * 60 * 24));
  //console.log("date:" + date + " anchor:" + anchor);

  // 💥 Phase logic starts here

  if (dayOffset < totalMenstrualDays) {
    if (isLogged) return "menstrual";
    if (isTodayOrFuture) return "predicted-menstrual";
    return null; // avoid showing predictions in the past
  }



  const cycleDay = ((dayOffset % avgLength) + avgLength) % avgLength;
  return getPhase(cycleDay);
}


function getAvgCycleLength() {
  const dates = JSON.parse(localStorage.getItem("periodDates")) || [];
  if (dates.length < 2) return 28;
  let total = 0;
  for (let i = 1; i < dates.length; i++) {
    total += (new Date(dates[i]) - new Date(dates[i - 1])) / (1000 * 60 * 60 * 24);
  }
  return Math.round(total / (dates.length - 1));
}

function getPhase(day) {
  if (day < 5) return "menstrual";
  if (day < 14) return "follicular";
  if (day < 16) return "ovulation";
  return "luteal";
}

function getPhaseName(phase) {
  const map = {
    menstrual: "Menstrual — You may feel more tired or emotional. Rest is key.",
    follicular: "Follicular — Energy begins to rise. Great time for focus.",
    ovulation: "Ovulation — Peak energy and mood. Libido may be higher.",
    luteal: "Luteal — Mood shifts, cravings, or fatigue may appear."
  };
  return map[phase];
}



// --- CYCLE INFO ---
function updateCycleInfo() {
  const lastPeriod = getLastPeriod();
  const avgLength = getAvgCycleLength();
  const today = new Date();
today.setHours(12, 0, 0, 0);

  const daysSince = Math.floor((today - lastPeriod) / (1000 * 60 * 60 * 24));
  const dayOfCycle = daysSince % avgLength;
  const phase = getCyclePhaseForDate(today);

  //console.log(phase);

  const cycleInfo = document.getElementById("cycleInfo");
  const cycleTips = document.getElementById("cycleTips");

  // Reset and apply phase class for matching background
  //cycleInfo.className = phase;
  cycleTips.className = phase;


  //cycleInfo.innerHTML = `<p>Day ${dayOfCycle} of your cycle</p>`;
  cycleTips.innerHTML = `<p><strong> ${getPhaseName(phase)}</strong></p>`;
}


function loadCalendar() {
  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";
  const base = new Date(); // 12PM avoids day-flipping

  base.setMonth(base.getMonth() + calendarOffset);
  const year = base.getFullYear();
  const month = base.getMonth();

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  weekdays.forEach(day => {
    const label = document.createElement("div");
    label.classList.add("reg-calendar-label");
    label.textContent = day;
    calendar.appendChild(label);
  });

  const startDay = start.getDay(); // 0 (Sun) to 6 (Sat)

  const avgLength = getAvgCycleLength();
  const lastPeriod = getLastPeriod();
  const logged = JSON.parse(localStorage.getItem("loggedPeriods")) || [];

  const label = document.getElementById("regCalendarMonthLabel");
  label.textContent = `${base.toLocaleString('default', { month: 'long' })} ${year}`;

  // Add blank cells to align the first day
  for (let i = 0; i < startDay; i++) {
    const empty = document.createElement("div");
    empty.classList.add("day");
    calendar.appendChild(empty);
  }

  // Now fill in the actual days
  for (let d = 1; d <= end.getDate(); d++) {
    const date = new Date(year, month, d, 12, 0, 0);
    const iso = date.toISOString().split("T")[0];
    const dayOffset = Math.floor((date - lastPeriod) / (1000 * 60 * 60 * 24));
    const cycleDay = ((dayOffset % avgLength) + avgLength) % avgLength;
    const phase = getCyclePhaseForDate(date);

    const day = document.createElement("div");
    day.classList.add("day");

    if (logged.includes(iso)) {
      day.classList.add("menstrual");
    } else if (cycleDay < 5) {
      day.classList.add("predicted-menstrual");
    } else if (cycleDay > 4){
      day.classList.add(phase);
    }

    day.textContent = d;
    day.title = iso;
    day.onclick = () => togglePeriodDate(iso);
    calendar.appendChild(day);
  }
}

function togglePeriodDate(date) {
  if (typeof date === "string") {
    date = new Date(date + "T12:00:00");
  }

  const iso = getLocalISO(date);
  let log = JSON.parse(localStorage.getItem("loggedPeriodsMap") || "{}");
  let status = log[iso]; // undefined, "period", or "last"

  // 🔄 Cycle through states
  if (!status) {
    log[iso] = "period";
  } else if (status === "period") {
    log[iso] = "last";
  } else if (status === "last") {
    delete log[iso];
  }

  if (log[iso] === "period") {
    console.log(`${iso} → Logged as period day`);
  } else if (log[iso] === "last") {
    console.log(`${iso} → Logged as LAST day of period`);
  } else {
    console.log(`${iso} → Unlogged (removed from period)`);
  }
  

  // 🔁 Sort dates for cycle detection logic
  const entries = Object.entries(log)
    .map(([d, type]) => ({ date: new Date(d + "T12:00:00"), iso: d, type }))
    .sort((a, b) => a.date - b.date);

  // 🔥 Auto-move new first date to front if >4 day gap
  const thisIndex = entries.findIndex(e => e.iso === iso);
  const prev = entries[thisIndex - 1];

  if (prev && (log[iso] === "period" || log[iso] === "last")) {
    const gap = Math.floor((date - prev.date) / (1000 * 60 * 60 * 24));
    if (gap > 4) {
      const entry = entries.splice(thisIndex, 1)[0];
      entries.unshift(entry); // new cycle start
    }
  }

  // Rebuild log from sorted entries
  const newMap = {};
  entries.forEach(e => {
    newMap[e.iso] = e.type;
  });

  localStorage.setItem("loggedPeriodsMap", JSON.stringify(newMap));

  // Optional debug
  const cycleStart = entries[0]?.date;
  if (cycleStart) {
    const dayNum = Math.floor((date - cycleStart) / (1000 * 60 * 60 * 24));
    console.log(`Cycle day ${dayNum} (${log[iso]})`);
  }

  loadCalendar();
  saveUserData();
  updateCycleInfo();
}


function getLocalISO(date) {
  return date.getFullYear() + '-' +
         String(date.getMonth() + 1).padStart(2, '0') + '-' +
         String(date.getDate()).padStart(2, '0');
}


function getCycleAnchor(date) {
  const logged = JSON.parse(localStorage.getItem("loggedPeriods")) || [];
  const sorted = logged
    .map(d => new Date(d + "T12:00:00"))
    .sort((a, b) => a - b);

  let anchor = null;
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    if (date < current) break;

    // If there's a next date and it's > 4 days away, this is the start of a cycle
    if (!next || Math.floor((next - current) / (1000 * 60 * 60 * 24)) > 4) {
      anchor = current;
    }
  }

  return anchor;
}



// --- SYMPTOMS ---
function loadSymptomCalendar() {

  const container = document.getElementById("symptomCalendar");
  container.innerHTML = "";

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  weekdays.forEach(day => {
    const label = document.createElement("div");
    label.classList.add("calendar-label");
    label.textContent = day;
    container.appendChild(label);
  });

  const base = new Date();
  base.setMonth(base.getMonth() + calendarOffset);
  const year = base.getFullYear();
  const month = base.getMonth();

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const startDay = start.getDay();

  const symptomLog = JSON.parse(localStorage.getItem("symptomLog")) || {};
  const avgLength = getAvgCycleLength();
  const loggedPeriods = (JSON.parse(localStorage.getItem("loggedPeriods")) || []).sort();
  const lastPeriod = getLastPeriod();

  const label = document.getElementById("calendarMonthLabel");
  label.textContent = `${base.toLocaleString('default', { month: 'long' })} ${year}`;

  for (let i = 0; i < startDay; i++) {
    const blank = document.createElement("div");
    blank.classList.add("day");
    container.appendChild(blank);
  }

  for (let d = 1; d <= end.getDate(); d++) {
    const date = new Date(year, month, d, 12, 0, 0);
    const iso = date.toISOString().split("T")[0];
    const day = document.createElement("div");
    day.classList.add("day");

    const dayOffset = Math.floor((date - lastPeriod) / (1000 * 60 * 60 * 24));
    const cycleDay = ((dayOffset % avgLength) + avgLength) % avgLength;
    const phase = getCyclePhaseForDate(date);
    

    // SYMPTOM STYLE
    if (symptomLog[iso]) {
      let primary = symptomLog[iso][0] || '';
      //if (primary.includes("fatigue")) primary = "fatigue";
      if (!["cramps", "fatigue", "appetite-increase", "appetite-decrease", "anxiety", "acne"].includes(primary)) {
        primary = "anxiety";
      }
      day.classList.add(`symptom-${primary}`);
      day.title = symptomLog[iso].join(", ");
    }
    

    const number = document.createElement("span");
number.textContent = d;
number.classList.add("day-number");
day.appendChild(number);

    container.appendChild(day);

    const logged = JSON.parse(localStorage.getItem("loggedPeriods")) || [];
  const isConfirmedPeriod = logged.includes(iso);
  const isPredictedMenstrual = phase === "menstrual" && !isConfirmedPeriod;
  const isFuture = date >= new Date().setHours(0, 0, 0, 0);
const isLogged = logged.includes(iso);

const ring = document.createElement("div");
ring.classList.add("symptom-ring");

const dot = document.createElement("div");
dot.classList.add("phase-dot"); // rename to match your style
// apply your menstrual phase dot styles here as before...

if (isLogged) {
  dot.classList.add("menstrual");
} else if (phase === "menstrual" && isFuture) {
  dot.classList.add("predicted-menstrual");
}

//else if (phase === "menstrual" && isFuture) {

if (phase) {
  if (isPredictedMenstrual) {
    dot.style.backgroundColor = `repeating-linear-gradient(
      -45deg,
      #6C0E32,
      #6C0E32 4px,
      #FFF2F3 4px,
      #FFF2F3 8px
      )`;
    number.style.color = "color: #fff;"
    number.style.textShadow = `
      -1px -1px 0 #6C0E32,
       1px -1px 0 #6C0E32,
      -1px  1px 0 #6C0E32,
       1px  1px 0 #6C0E32`;
    
  } else {

    dot.style.backgroundColor = {
      menstrual: "#6C0E32",
      follicular: "#A53860",
      ovulation: "#DA627D",
      luteal: "#FFA5AB"
    }[phase];
    
  }
}

// Add 6 outer symptom dots
for (let i = 0; i < 6; i++) {
  const symptomDot = document.createElement("div");
  symptomDot.classList.add("symptom-dot", `symptom-${i}`);
  ring.appendChild(symptomDot);
}

ring.appendChild(dot);
day.appendChild(ring);
renderSymptomDots(day, iso);

  }

}

const symptomColorMap = {
  cramps: "#6C0E32",
  fatigue: "#227C9D",
  "appetite-increase": "#72B569",
  "appetite-decrease": "#AFD5AA",
  anxiety: "#FFBA49",
  acne: "#EF6461",
};

const symptomOrder = ["cramps", "fatigue", "appetite-increase", "appetite-decrease", "anxiety", "acne"];

function renderSymptomDots(dayEl, iso) {
  const symptomLog = JSON.parse(localStorage.getItem("symptomLog")) || {};
  const symptoms = symptomLog[iso] || [];

  symptomOrder.forEach((symptom, index) => {
    const dot = dayEl.querySelector(`.symptom-dot.symptom-${index}`);
    if (!dot) return;

    if (symptoms.includes(symptom)) {
      dot.style.backgroundColor = symptomColorMap[symptom];
      dot.style.borderColor = symptomColorMap[symptom];
    } else {
      dot.style.backgroundColor = "transparent";
      dot.style.borderColor = "transparent";
    }
  });
}



function summarizePatterns() {
  const log = JSON.parse(localStorage.getItem("symptomLog")) || {};
  const periods = (JSON.parse(localStorage.getItem("loggedPeriods")) || []).map(d => new Date(d + "T12:00:00")).sort((a, b) => a - b);
  if (!periods.length) return;

  const patternSummary = {};

  Object.entries(log).forEach(([dateStr, symptoms]) => {
    const date = new Date(dateStr + "T12:00:00");
    const nextPeriod = periods.find(p => p >= date);
    if (!nextPeriod) return;

    const daysBefore = Math.floor((nextPeriod - date) / (1000 * 60 * 60 * 24));
    const phase = getCyclePhaseForDate(date);
    if (!phase) return;

    symptoms.forEach(symptom => {
      if (!patternSummary[phase]) patternSummary[phase] = {};
      if (!patternSummary[phase][symptom]) patternSummary[phase][symptom] = [];
      patternSummary[phase][symptom].push(daysBefore);
    });
  });

  const summary = document.getElementById("patternSummary");
  summary.innerHTML = "";

  Object.entries(patternSummary).forEach(([phase, symptomMap]) => {
    const section = document.createElement("div");
    section.innerHTML = `<h3 style="margin-top: 1em;">Phase: <strong style="color: #A53860;">${phase}</strong></h3>`;

    const symptomGrid = document.createElement("div");
    symptomGrid.style.display = "grid";
    symptomGrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(140px, 1fr))";
    symptomGrid.style.gap = "10px";
    symptomGrid.style.marginTop = "0.5em";

    const sortedSymptoms = Object.entries(symptomMap).sort((a, b) => {
      const aAvg = avg(a[1]);
      const bAvg = avg(b[1]);
      return aAvg - bAvg;
    });

    sortedSymptoms.forEach(([symptom, daysList]) => {
      const avgDays = Math.round(avg(daysList));
      const when = avgDays === 0
        ? "on the first day"
        : `${avgDays} day${avgDays !== 1 ? "s" : ""} before`;

      const card = document.createElement("div");
      card.className = "symptom-card";
      card.style.padding = "8px 10px";
      card.style.borderRadius = "10px";
      card.style.fontSize = "0.85em";
      card.style.background = getSymptomColor(symptom) || "#ccc";
      card.style.color = "#fff";
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.alignItems = "center";
      card.style.textAlign = "center";

      card.innerHTML = `
        <strong style="text-transform: capitalize;">${symptom}</strong>
        <span style="font-weight: 300;">${when}</span>
      `;

      symptomGrid.appendChild(card);
    });

    section.appendChild(symptomGrid);
    summary.appendChild(section);
  });

  function avg(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function getSymptomColor(symptom) {
    const map = {
      "cramps": "#6C0E32",
      "fatigue": "#227C9D",
      "appetite-increase": "#72B569",
      "appetite-decrease": "#AFD5AA",
      "anxiety": "#FFBA49",
      "acne": "#EF6461"
    };
    return map[symptom] || "#888";
  }
  
}




document.getElementById("symptomForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const today = new Date().toISOString().split("T")[0];
  const selected = [...document.querySelectorAll('#realtimeToggles .selected')]
  .map(btn => symptomOptions.find(opt => opt.label === btn.textContent)?.value);

  const custom = document.getElementById("customSymptom").value.trim();
  if (custom) selected.push(custom);


  const log = JSON.parse(localStorage.getItem("symptomLog")) || {};
  log[today] = selected;
  localStorage.setItem("symptomLog", JSON.stringify(log));
  await saveUserData();

  this.reset();
  loadSymptomCalendar();
  summarizePatterns();
  saveUserData();
  alert("Symptoms saved.");
});



// --- VIEW SWITCH ---
window.showView = (id) => {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(id + "View").classList.add("active");
};

// --- NOTIFICATIONS ---

window.addEventListener("load", () => {
  if (!document.getElementById("calendar").children.length) {
    loadCalendar();
    updateCycleInfo();
    loadSymptomCalendar();
    summarizePatterns();

  }
});

function renderSymptomToggles(targetId, symptomList) {
  const container = document.getElementById(targetId);
  container.innerHTML = "";

  symptomList.forEach(symptom => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("symptom-toggle", `symptom-${symptom.class}`);
    btn.textContent = symptom.label;

    btn.addEventListener("click", () => {
      btn.classList.toggle("selected");
    });

    container.appendChild(btn);
  });
}


document.getElementById("backlogForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const date = document.getElementById("backlogDate").value;
  if (!date) return alert("Please choose a date.");

  const selected = [...document.querySelectorAll('#backlogToggles .selected')]
  .map(btn => symptomOptions.find(opt => opt.label === btn.textContent)?.value);

  const custom = document.getElementById("customBacklogSymptom").value.trim();
  if (custom) selected.push(custom);

  const log = JSON.parse(localStorage.getItem("symptomLog")) || {};
  log[date] = selected;
  localStorage.setItem("symptomLog", JSON.stringify(log));
  await saveUserData();

  this.reset();
  loadSymptomCalendar();
  summarizePatterns();
  saveUserData();

  alert(`Symptoms logged for ${date}`);
});

const symptomOptions = [
  { label: "Cramps", class: "cramps", value: "cramps" },
  { label: "Fatigue", class: "fatigue", value: "fatigue" },
  { label: "Appetite ↑", class: "appetite-increase", value: "appetite-increase" },
  { label: "Appetite ↓", class: "appetite-decrease", value: "appetite-decrease" },
  { label: "Anxiety", class: "anxiety", value: "anxiety" },
  { label: "Acne", class: "acne", value: "acne" }
];

renderSymptomToggles("realtimeToggles", symptomOptions);
renderSymptomToggles("backlogToggles", symptomOptions);

function addPhaseDotToDay(dayElement, date) {
  const phase = getCyclePhaseForDate(date);
  const dot = document.createElement("div");
  dot.classList.add("dot");
  dot.style.backgroundColor = {
    menstrual: "#6C0E32",
    follicular: "#A53860",
    ovulation: "#DA627D",
    luteal: "#FFA5AB"
  }[phase];

  dayElement.appendChild(dot);
}

document.addEventListener("DOMContentLoaded", () => {
  const leftArrow = document.querySelector('.arrow-btn.left');
  const rightArrow = document.querySelector('.arrow-btn.right');

  if (leftArrow && rightArrow) {
    leftArrow.addEventListener("click", () => changeCalendarOffset(-1));
    rightArrow.addEventListener("click", () => changeCalendarOffset(1));
  }

  const symptomForm = document.getElementById("symptomForm");
  const backlogForm = document.getElementById("backlogForm");

  if (symptomForm) {
    symptomForm.addEventListener("submit", function (e) {
      e.preventDefault();
      // handle symptom logging
    });
  }

  if (backlogForm) {
    backlogForm.addEventListener("submit", function (e) {
      e.preventDefault();
      // handle backlog logging
    });
  }

  const left = document.querySelector('.arrow-btn.left-regular');
  const right = document.querySelector('.arrow-btn.right-regular');

  if (left && right) {
    left.addEventListener("click", () => changeCalendarOffset(-1));
    right.addEventListener("click", () => changeCalendarOffset(1));
  }
});


function changeCalendarOffset(direction) {
  calendarOffset += direction;
  loadSymptomCalendar();
  loadCalendar();
}

window.saveUserData = saveUserData;
window.loadUserData = loadUserData;

window.db = getFirestore(app);
window.setDoc = setDoc;
window.doc = doc;

