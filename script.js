import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
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

// --- AUTH ---
document.getElementById("loginBtn").addEventListener("click", () => {
  signInWithPopup(auth, provider)
    .then(result => {
      currentUser = result.user;
      loadUserData();
      toggleAuthButtons(true);
    });
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
  const ref = doc(db, "users", currentUser.uid);
  const snap = await getDoc(ref);

  localStorage.setItem("loggedPeriods", JSON.stringify(data.loggedPeriods || []));

  if (!snap.exists()) {
    await setDoc(ref, {
      periodDates: [],
      symptomLog: {}
    });
  } else {
    const data = snap.data();
    localStorage.setItem("periodDates", JSON.stringify(data.periodDates));
    localStorage.setItem("symptomLog", JSON.stringify(data.symptomLog));
  }

  loadCalendar();
  updateCycleInfo();
  loadSymptomCalendar();
  summarizePatterns();
}

async function saveUserData() {
  if (!currentUser) return;
  const ref = doc(db, "users", currentUser.uid);
  
  await updateDoc(ref, {
    periodDates: JSON.parse(localStorage.getItem("periodDates")),
    symptomLog: JSON.parse(localStorage.getItem("symptomLog")),
    loggedPeriods: JSON.parse(localStorage.getItem("loggedPeriods") || "[]")
  });

}

// --- CORE LOGIC ---

function getLastPeriod() {
  const logged = JSON.parse(localStorage.getItem("loggedPeriods")) || [];
  if (!logged.length) return new Date(); // fallback
  const sorted = logged.sort((a, b) => new Date(b) - new Date(a));
  return new Date(sorted[0]);
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
  const daysSince = Math.floor((today - lastPeriod) / (1000 * 60 * 60 * 24));
  const dayOfCycle = daysSince % avgLength;
  const phase = getPhase(dayOfCycle);

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

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  weekdays.forEach(day => {
    const label = document.createElement("div");
    label.classList.add("calendar-label");
    label.textContent = day;
    calendar.appendChild(label);
  });

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const startDay = start.getDay(); // 0 (Sun) to 6 (Sat)

  const avgLength = getAvgCycleLength();
  const lastPeriod = getLastPeriod();
  const logged = JSON.parse(localStorage.getItem("loggedPeriods")) || [];

  // Add blank cells to align the first day
  for (let i = 0; i < startDay; i++) {
    const empty = document.createElement("div");
    empty.classList.add("day");
    calendar.appendChild(empty);
  }

  // Now fill in the actual days
  for (let d = 1; d <= end.getDate(); d++) {
    const date = new Date(year, month, d);
    const iso = date.toISOString().split("T")[0];
    const dayOffset = Math.floor((date - lastPeriod) / (1000 * 60 * 60 * 24));
    const cycleDay = ((dayOffset % avgLength) + avgLength) % avgLength;
    const phase = getPhase(cycleDay);

    const day = document.createElement("div");
    day.classList.add("day");

    if (logged.includes(iso)) {
      day.classList.add("menstrual");
    } else if (cycleDay < 5) {
      day.classList.add("predicted-menstrual");
    } else {
      day.classList.add(phase);
    }

    day.textContent = d;
    day.title = iso;
    day.onclick = () => togglePeriodDate(iso);
    calendar.appendChild(day);
  }
}

async function togglePeriodDate(date) {
  const logged = JSON.parse(localStorage.getItem("loggedPeriods")) || [];
  const index = logged.indexOf(date);

  if (index > -1) {
    logged.splice(index, 1); // remove
  } else {
    logged.push(date); // add
  }

  localStorage.setItem("loggedPeriods", JSON.stringify(logged));
  await saveUserData();

  loadCalendar();
  updateCycleInfo();
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
    const date = new Date(year, month, d);
    const iso = date.toISOString().split("T")[0];
    const day = document.createElement("div");
    day.classList.add("day");

    const dayOffset = Math.floor((date - lastPeriod) / (1000 * 60 * 60 * 24));
    const cycleDay = ((dayOffset % avgLength) + avgLength) % avgLength;
    const phase = getPhase(cycleDay);

    // SYMPTOM STYLE
    if (symptomLog[iso]) {
      let primary = symptomLog[iso][0] || '';
      if (primary.includes("appetite")) primary = "appetite";
      if (!["cramps", "fatigue", "appetite", "anxiety", "acne"].includes(primary)) {
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

  const dot = document.createElement("div");
  dot.classList.add("dot");

  if (isPredictedMenstrual) {
    dot.style.background = `repeating-linear-gradient(
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

    day.appendChild(dot);

    //addPhaseDotToDay(day, date);

  }

}


function summarizePatterns() {
  const log = JSON.parse(localStorage.getItem("symptomLog")) || {};
  const avgLength = getAvgCycleLength();
  const lastPeriod = getLastPeriod();
  const counts = {};

  for (let date in log) {
    const day = new Date(date);
    const dayOffset = Math.floor((day - lastPeriod) / (1000 * 60 * 60 * 24));
    const cycleDay = ((dayOffset % avgLength) + avgLength) % avgLength;
    const phase = getPhase(cycleDay);
    log[date].forEach(symptom => {
      const key = `${symptom}_${phase}`;
      counts[key] = (counts[key] || 0) + 1;
    });
  }

  const summary = Object.entries(counts).map(([key, count]) => {
    const [symptom, phase] = key.split("_");
    return `<li>${symptom} shows up often during your <strong>${phase}</strong> phase (${count} times)</li>`;
  });

  document.getElementById("patternSummary").innerHTML = `
    <h3>Symptom Patterns</h3>
    <ul>${summary.join("")}</ul>
  `;
}

document.getElementById("symptomForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const today = new Date().toISOString().split("T")[0];
  const selected = [...document.querySelectorAll('#realtimeToggles .selected')]
  .map(btn => symptomOptions.find(opt => opt.label === btn.textContent)?.value);

  const custom = document.getElementById("customSymptom").value.trim();
  if (custom) selected.push(custom);


  const log = JSON.parse(localStorage.getItem("symptomLog")) || {};
  log[today] = symptoms;
  localStorage.setItem("symptomLog", JSON.stringify(log));
  await saveUserData();

  this.reset();
  loadSymptomCalendar();
  summarizePatterns();
  alert("Symptoms saved.");
});

// --- VIEW SWITCH ---
window.showView = (id) => {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(id + "View").classList.add("active");
};

// --- NOTIFICATIONS ---

window.enableNotifications = function () {
  if (!("Notification" in window)) {
    alert("Browser doesn't support notifications.");
    return;
  }

  Notification.requestPermission().then(permission => {
    if (permission === "granted") {
      schedulePeriodReminder();
    }
  });
};
document.getElementById("notifyBtn").addEventListener("click", enableNotifications);

function schedulePeriodReminder() {
  const lastPeriod = getLastPeriod();
  const avgLength = getAvgCycleLength();
  const nextPeriod = new Date(lastPeriod);
  nextPeriod.setDate(lastPeriod.getDate() + avgLength);

  const reminderDate = new Date(nextPeriod);
  reminderDate.setDate(reminderDate.getDate() - 3);

  const now = new Date();
  const delay = reminderDate.getTime() - now.getTime();

  if (delay <= 0) return;

  setTimeout(() => {
    new Notification("Heads up, love—your period is likely 3 days away.");
  }, delay);
}
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

  const selected = [...document.querySelectorAll('#realtimeToggles .selected')]
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

  alert(`Symptoms logged for ${date}`);
});

let calendarOffset = 0;

function changeCalendarOffset(direction) {
  calendarOffset += direction;
  loadSymptomCalendar();
}

const symptomOptions = [
  { label: "Cramps", class: "cramps", value: "cramps" },
  { label: "Fatigue", class: "fatigue", value: "fatigue" },
  { label: "Appetite ↑", class: "appetite", value: "appetite-increase" },
  { label: "Appetite ↓", class: "appetite", value: "appetite-decrease" },
  { label: "Anxiety", class: "anxiety", value: "anxiety" },
  { label: "Acne", class: "acne", value: "acne" }
];

renderSymptomToggles("realtimeToggles", symptomOptions);
renderSymptomToggles("backlogToggles", symptomOptions);

function addPhaseDotToDay(dayElement, cycleDay) {
  const phase = getPhase(cycleDay);
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

