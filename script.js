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
    symptomLog: JSON.parse(localStorage.getItem("symptomLog"))
  });
}

// --- CORE LOGIC ---
function getLastPeriod() {
  let dates = JSON.parse(localStorage.getItem("periodDates")) || [];
  return new Date(dates[dates.length - 1] || new Date());
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
  cycleInfo.className = phase;
  cycleTips.className = phase;

  cycleInfo.innerHTML = `<p>Day ${dayOfCycle} of your cycle</p>`;
  cycleTips.innerHTML = `<p><strong>🌙 ${getPhaseName(phase)}</strong></p>`;
}


function loadCalendar() {
  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const avgLength = getAvgCycleLength();
  const lastPeriod = getLastPeriod();
  const symptomLog = JSON.parse(localStorage.getItem("symptomLog")) || {};


  for (let d = 1; d <= end.getDate(); d++) {
    const date = new Date(today.getFullYear(), today.getMonth(), d);
    const dayOffset = Math.floor((date - lastPeriod) / (1000 * 60 * 60 * 24));
    const cycleDay = ((dayOffset % avgLength) + avgLength) % avgLength;
    const phase = getPhase(cycleDay);
    const day = document.createElement("div");
    day.classList.add("day", phase);
    const iso = date.toISOString().split("T")[0];
    if (symptomLog[iso]) day.classList.add("symptom-day");
    day.innerText = d;
    calendar.appendChild(day);
  }
}

// --- SYMPTOMS ---
document.getElementById("symptomForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const today = new Date().toISOString().split("T")[0];
  const symptoms = [
    ...document.querySelectorAll('input[name="symptom"]:checked')
  ].map(i => i.value);

  const custom = document.getElementById("customSymptom").value.trim();
  if (custom) symptoms.push(custom);

  const log = JSON.parse(localStorage.getItem("symptomLog")) || {};
  log[today] = symptoms;
  localStorage.setItem("symptomLog", JSON.stringify(log));
  await saveUserData();

  this.reset();
  loadSymptomCalendar();
  summarizePatterns();
  alert("Symptoms saved.");
});

function loadSymptomCalendar() {
  const container = document.getElementById("symptomCalendar");
  container.innerHTML = "";
  const log = JSON.parse(localStorage.getItem("symptomLog")) || {};
  const days = Object.keys(log).sort().slice(-30);

  days.forEach(dateStr => {
    const date = new Date(dateStr);
    const day = document.createElement("div");
    day.classList.add("day", "symptom-day");
    day.title = log[dateStr].join(", ");
    day.innerText = date.getDate();
    container.appendChild(day);
  });
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
  }
});
