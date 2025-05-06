document.addEventListener("DOMContentLoaded", () => {
    loadCalendar();
    updateCycleInfo();
    loadSymptomCalendar();
    summarizePatterns();
  
    document.getElementById("symptomForm").addEventListener("submit", function (e) {
      e.preventDefault();
      const checked = [...document.querySelectorAll('input[name="symptom"]:checked')]
        .map(input => input.value);
  
      const today = new Date().toISOString().split("T")[0];
      const symptomLog = JSON.parse(localStorage.getItem("symptomLog")) || {};
      symptomLog[today] = checked;
      localStorage.setItem("symptomLog", JSON.stringify(symptomLog));
  
      alert("Symptoms saved.");
      this.reset();
      loadSymptomCalendar();
      summarizePatterns();
    });
  });
  
  function showView(id) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(id + "View").classList.add("active");
  }
  
  function getLastPeriod() {
    let stored = JSON.parse(localStorage.getItem("periodDates")) || [];
    if (stored.length === 0) {
      const today = new Date().toISOString().split("T")[0];
      stored.push(today);
      localStorage.setItem("periodDates", JSON.stringify(stored));
    }
    return new Date(stored[stored.length - 1]);
  }
  
  function getAvgCycleLength() {
    const stored = JSON.parse(localStorage.getItem("periodDates")) || [];
    if (stored.length < 2) return 28;
    let total = 0;
    for (let i = 1; i < stored.length; i++) {
      const prev = new Date(stored[i - 1]);
      const curr = new Date(stored[i]);
      total += (curr - prev) / (1000 * 60 * 60 * 24);
    }
    return Math.round(total / (stored.length - 1));
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
    return map[phase] || "";
  }
  
  function updateCycleInfo() {
    const lastPeriod = getLastPeriod();
    const avgLength = getAvgCycleLength();
    const today = new Date();
    const daysSince = Math.floor((today - lastPeriod) / (1000 * 60 * 60 * 24));
    const dayOfCycle = daysSince % avgLength;
    const phase = getPhase(dayOfCycle);
  
    document.getElementById("cycleInfo").innerHTML = `
      <p>Day ${dayOfCycle} of your cycle</p>
      <p><strong>${getPhaseName(phase)}</strong></p>
    `;
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
      return `<li>${symptom.replace("-", " ")} shows up often during your <strong>${phase}</strong> phase (${count} times)</li>`;
    });
  
    document.getElementById("patternSummary").innerHTML = `
      <h3>Symptom Patterns</h3>
      <ul>${summary.join("")}</ul>
    `;
  }
  