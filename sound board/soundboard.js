/**
     * CHRISTMAS PLAY SOUND CUE PLAYER
     * Single-file Web Audio + HTML5 Audio cue controller with smooth exponential/linear fades
     * and built-in holiday synth fallback so you can test immediately before loading MP3s.
     */

    // 1. Exact Script Cue Definitions
    const cues = [
      {
        id: 1,
        title: "1. Jingle Bells",
        scene: "1. stseen: Keidi kodu",
        hint: "Warm opening fade-in as Keidi looks out the window.",
        keywords: ["jingle", "bells", "1"],
        fadeIn: 3.0,
        fadeOut: 3.0,
        loop: false,
        fileName: "Jingle-Bells.mp3",
        audioUrl: "audio/Jingle-Bells.mp3",
        objectUrl: null,
        synthType: "jingle"
      },
      {
        id: 2,
        title: "2. Santa-disappears",
        scene: "2. → 3. stseen: Võlukapp",
        hint: "Jõuluvana steps into the magic cabinet. Fade out on scarf toss / Varga kodu.",
        keywords: ["santa", "disappear", "kapp", "2"],
        fadeIn: 0.4,
        fadeOut: 3.0,
        loop: false,
        fileName: "Santa-disappears.mp3",
        audioUrl: "audio/Santa-disappears.mp3",
        objectUrl: null,
        synthType: "mystery"
      },
      {
        id: 3,
        title: "3. Finding-santa",
        scene: "5. → 6. stseen: Loits",
        hint: "Keidi reads from the old book; table slides away. Fade out as Jõuluvana appears.",
        keywords: ["finding", "loits", "spell", "3"],
        fadeIn: 2.0,
        fadeOut: 3.0,
        loop: false,
        fileName: "Finding-santa.mp3",
        audioUrl: "audio/Finding-santa.mp3",
        objectUrl: null,
        synthType: "wonder"
      },
      {
        id: 4,
        title: "4. Thief-gift",
        scene: "7. stseen: Kingitus",
        hint: "Varas opens the gift; house disappears into Päkapikula. Fade out on visual poof.",
        keywords: ["thief", "gift", "kingitus", "4"],
        fadeIn: 0.3,
        fadeOut: 3.0,
        loop: false,
        fileName: "Thief-gift.mp3",
        audioUrl: "audio/Thief-gift.mp3",
        objectUrl: null,
        synthType: "sparkle"
      },
      {
        id: 5,
        title: "5. We Wish You a Merry Christmas",
        scene: "7. stseen: Lõpp & kummardus",
        hint: "Joyful finale fade-in as everyone packs gifts, bows, and dances off stage.",
        keywords: ["wish", "merry", "finale", "lopp", "5"],
        fadeIn: 3.0,
        fadeOut: 4.0,
        loop: false,
        fileName: "We-wish-you-a-merry-christmas.mp3",
        audioUrl: "audio/We-wish-you-a-merry-christmas.mp3",
        objectUrl: null,
        synthType: "finale"
      }
    ];

    // 2. Player State
    let currentCueIndex = 0;
    let playState = "READY"; // "READY" | "FADING_IN" | "PLAYING" | "FADING_OUT" | "SHOW_DONE"
    let masterVolume = 0.85;
    let currentGain = 0;
    let fadeAnimFrame = null;
    let progressTimer = null;
    let playStartTime = 0;

    // Audio Engines (HTML5 Audio for real files + Web Audio Synth Fallback)
    let activeHtmlAudio = null;
    let audioCtx = null;
    let synthInterval = null;
    let synthMasterGain = null;

    // DOM References
    const cueListContainer = document.getElementById("cueListContainer");
    const stageConsole = document.getElementById("stageConsole");
    const statusBadge = document.getElementById("statusBadge");
    const statusDot = document.getElementById("statusDot");
    const statusLabel = document.getElementById("statusLabel");
    const activeCueTitle = document.getElementById("activeCueTitle");
    const activeCueNote = document.getElementById("activeCueNote");
    const primarySpaceBtn = document.getElementById("primarySpaceBtn");
    const primaryBtnMainText = document.getElementById("primaryBtnMainText");
    const primaryBtnSubText = document.getElementById("primaryBtnSubText");
    const liveGainDisplay = document.getElementById("liveGainDisplay");
    const liveLevelBar = document.getElementById("liveLevelBar");
    const elapsedDisplay = document.getElementById("elapsedDisplay");
    const trackProgressBar = document.getElementById("trackProgressBar");
    const masterVolumeSlider = document.getElementById("masterVolumeSlider");
    const masterVolumeText = document.getElementById("masterVolumeText");
    const toastMessage = document.getElementById("toastMessage");

    // Helper: Toast Notification
    let toastTimeout = null;
    function showToast(msg) {
      toastMessage.textContent = msg;
      toastMessage.style.opacity = "1";
      clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        toastMessage.style.opacity = "0";
      }, 2800);
    }

    // Helper: Format mm:ss
    function formatTime(seconds) {
      const s = Math.max(0, Math.floor(seconds));
      const mins = String(Math.floor(s / 60)).padStart(2, "0");
      const secs = String(s % 60).padStart(2, "0");
      return `${mins}:${secs}`;
    }

    // 3. Built-in Gentle Web Audio Synth Fallback (so user can test immediately!)
    function ensureAudioContext() {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
      }
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }
    }

    function playSynthNote(freq, duration, type = "sine", vol = 0.22) {
      if (!audioCtx || !synthMasterGain) return;
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const noteGain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      noteGain.gain.setValueAtTime(0.0001, now);
      noteGain.gain.exponentialRampToValueAtTime(vol, now + 0.04);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(noteGain);
      noteGain.connect(synthMasterGain);

      osc.start(now);
      osc.stop(now + duration + 0.05);
    }

    function startFallbackSynth(type) {
      stopFallbackSynth();
      ensureAudioContext();

      synthMasterGain = audioCtx.createGain();
      synthMasterGain.gain.setValueAtTime(0, audioCtx.currentTime);
      synthMasterGain.connect(audioCtx.destination);

      const patterns = {
        // Jingle Bells motif
        jingle: {
          tempo: 360,
          wave: "triangle",
          notes: [329.63, 329.63, 329.63, 0, 329.63, 329.63, 329.63, 0, 329.63, 392.00, 261.63, 293.66, 329.63, 0, 0, 0]
        },
        // Sneaky magic cabinet arpeggio
        mystery: {
          tempo: 280,
          wave: "sine",
          notes: [261.63, 311.13, 392.00, 493.88, 523.25, 493.88, 392.00, 311.13]
        },
        // Wonder / spell shimmer
        wonder: {
          tempo: 420,
          wave: "sine",
          notes: [349.23, 440.00, 523.25, 659.25, 587.33, 440.00, 523.25, 392.00]
        },
        // Bright gift teleportation bells
        sparkle: {
          tempo: 220,
          wave: "triangle",
          notes: [523.25, 659.25, 783.99, 1046.50, 783.99, 659.25]
        },
        // We Wish You a Merry Christmas motif
        finale: {
          tempo: 360,
          wave: "triangle",
          notes: [261.63, 349.23, 349.23, 392.00, 349.23, 329.63, 293.66, 293.66, 293.66, 392.00, 392.00, 440.00, 392.00, 349.23, 329.63, 261.63]
        }
      };

      const pattern = patterns[type] || patterns.jingle;
      let step = 0;

      const tick = () => {
        const freq = pattern.notes[step % pattern.notes.length];
        if (freq > 0) {
          playSynthNote(freq, (pattern.tempo / 1000) * 1.35, pattern.wave, 0.25);
        }
        step++;
      };

      tick();
      synthInterval = setInterval(tick, pattern.tempo);
    }

    function stopFallbackSynth() {
      if (synthInterval) {
        clearInterval(synthInterval);
        synthInterval = null;
      }
      if (synthMasterGain && audioCtx) {
        try {
          synthMasterGain.disconnect();
        } catch (e) {}
        synthMasterGain = null;
      }
    }

    // 4. Unified Gain Setter (applies normalized 0..1 gain * masterVolume)
    function applyGain(normalizedGain) {
      currentGain = Math.max(0, Math.min(1, normalizedGain));
      const effectiveVolume = currentGain * masterVolume;

      if (activeHtmlAudio) {
        activeHtmlAudio.volume = Math.max(0, Math.min(1, effectiveVolume));
      }
      if (synthMasterGain && audioCtx) {
        synthMasterGain.gain.setTargetAtTime(effectiveVolume, audioCtx.currentTime, 0.02);
      }

      const pct = Math.round(effectiveVolume * 100);
      liveGainDisplay.textContent = `${pct}%`;
      liveLevelBar.style.height = `${pct}%`;
    }

    // Smooth Fade Animation Loop
    function animateGainTo(targetGain, durationSec, onComplete) {
      if (fadeAnimFrame) cancelAnimationFrame(fadeAnimFrame);

      const startGain = currentGain;
      const durationMs = Math.max(50, durationSec * 1000);
      const startTime = performance.now();

      function step(now) {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / durationMs);
        // Smooth ease-in-out curve for natural theater fades
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const nextGain = startGain + (targetGain - startGain) * eased;

        applyGain(nextGain);

        if (t < 1) {
          fadeAnimFrame = requestAnimationFrame(step);
        } else {
          fadeAnimFrame = null;
          applyGain(targetGain);
          if (onComplete) onComplete();
        }
      }

      fadeAnimFrame = requestAnimationFrame(step);
    }

    // 5. Core Transport Actions
    function startCurrentCue() {
      const cue = cues[currentCueIndex];
      if (!cue) return;

      stopAllAudioImmediate(false);
      playState = "FADING_IN";
      playStartTime = performance.now();
      applyGain(0);

      const audioUrl = cue.objectUrl || cue.audioUrl;
      if (audioUrl) {
        activeHtmlAudio = new Audio(audioUrl);
        activeHtmlAudio.loop = cue.loop;
        activeHtmlAudio.volume = 0;
        activeHtmlAudio.play().catch(err => {
          console.error("Audio playback error:", err);
          showToast("Audio blocked — click button once to unlock.");
        });
      } else {
        startFallbackSynth(cue.synthType);
      }

      startProgressTracker();
      updateUI();

      animateGainTo(1, cue.fadeIn, () => {
        if (playState === "FADING_IN") {
          playState = "PLAYING";
          updateUI();
        }
      });
    }

    function fadeOutCurrentCue() {
      const cue = cues[currentCueIndex];
      if (!cue) return;

      playState = "FADING_OUT";
      updateUI();

      animateGainTo(0, cue.fadeOut, () => {
        stopAllAudioImmediate(false);
        if (currentCueIndex < cues.length - 1) {
          currentCueIndex++;
          playState = "READY";
        } else {
          playState = "SHOW_DONE";
        }
        updateUI();
      });
    }

    function stopAllAudioImmediate(resetState = true) {
      if (fadeAnimFrame) {
        cancelAnimationFrame(fadeAnimFrame);
        fadeAnimFrame = null;
      }
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
      if (activeHtmlAudio) {
        activeHtmlAudio.pause();
        activeHtmlAudio.currentTime = 0;
        activeHtmlAudio = null;
      }
      stopFallbackSynth();
      applyGain(0);
      elapsedDisplay.textContent = "00:00";
      trackProgressBar.style.width = "0%";

      if (resetState) {
        playState = "READY";
        updateUI();
      }
    }

    function startProgressTracker() {
      if (progressTimer) clearInterval(progressTimer);
      progressTimer = setInterval(() => {
        if (activeHtmlAudio && activeHtmlAudio.duration && !isNaN(activeHtmlAudio.duration)) {
          const cur = activeHtmlAudio.currentTime;
          const dur = activeHtmlAudio.duration;
          elapsedDisplay.textContent = formatTime(cur);
          trackProgressBar.style.width = `${Math.min(100, (cur / dur) * 100)}%`;
        } else {
          const elapsedSec = (performance.now() - playStartTime) / 1000;
          elapsedDisplay.textContent = formatTime(elapsedSec);
          // Gentle looping visual pulse for demo synth
          const demoPct = ((elapsedSec % 16) / 16) * 100;
          trackProgressBar.style.width = `${demoPct}%`;
        }
      }, 100);
    }

    // Main One-Button Handler (Spacebar or Giant Button Click)
    function handleSpaceAction() {
      if (playState === "READY") {
        startCurrentCue();
      } else if (playState === "FADING_IN" || playState === "PLAYING") {
        fadeOutCurrentCue();
      } else if (playState === "FADING_OUT") {
        // Pressing Space again mid-fade completes the stop immediately & advances
        stopAllAudioImmediate(false);
        if (currentCueIndex < cues.length - 1) {
          currentCueIndex++;
          playState = "READY";
        } else {
          playState = "SHOW_DONE";
        }
        updateUI();
      } else if (playState === "SHOW_DONE") {
        currentCueIndex = 0;
        playState = "READY";
        updateUI();
      }
    }

    // 6. UI Rendering
    function updateUI() {
      const cue = cues[currentCueIndex];

      // Reset console styling
      stageConsole.classList.remove("playing-glow", "border-emerald-500/50", "border-amber-500/50", "border-slate-800");
      statusLabel.classList.remove("fading-pulse");

      if (playState === "SHOW_DONE") {
        stageConsole.classList.add("border-amber-500/50");
        statusBadge.className = "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40";
        statusDot.className = "w-2 h-2 rounded-full bg-amber-400";
        statusLabel.textContent = "ETENDUS LÕPPENUD (SHOW COMPLETE)";
        activeCueTitle.textContent = "Häid jõule! All 5 Cues Completed";
        activeCueNote.textContent = "Press Space or Reset Show to return to Cue 1.";

        primarySpaceBtn.className = "w-full py-6 sm:py-7 px-6 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 active:scale-[0.995] text-white shadow-xl transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer border border-amber-400/30";
        primaryBtnMainText.textContent = "PRESS SPACE TO RESET TO CUE 1";
        primaryBtnSubText.textContent = "Ready for another run or rehearsal";
      } else if (playState === "READY") {
        stageConsole.classList.add("border-slate-800");
        statusBadge.className = "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30";
        statusDot.className = "w-2 h-2 rounded-full bg-emerald-400";
        statusLabel.textContent = `STANDBY • CUE ${cue.id} OF ${cues.length}`;
        activeCueTitle.textContent = cue.title;
        activeCueNote.textContent = `${cue.scene} • Fade in ${cue.fadeIn.toFixed(1)}s → Fade out ${cue.fadeOut.toFixed(1)}s`;

        primarySpaceBtn.className = "w-full py-6 sm:py-7 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.995] text-white shadow-xl transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer border border-emerald-400/30";
        primaryBtnMainText.textContent = `PRESS SPACE TO START CUE ${cue.id}`;
        primaryBtnSubText.textContent = `${cue.title} (${cue.fileName ? cue.fileName : "Built-in Demo Synth"})`;
      } else if (playState === "FADING_IN" || playState === "PLAYING") {
        stageConsole.classList.add("playing-glow", "border-emerald-500/50");
        statusBadge.className = "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40";
        statusDot.className = "w-2 h-2 rounded-full bg-rose-400 animate-ping";
        statusLabel.textContent = playState === "FADING_IN" ? `FADING IN (${cue.fadeIn.toFixed(1)}s)...` : `PLAYING • CUE ${cue.id}`;
        activeCueTitle.textContent = cue.title;
        activeCueNote.textContent = cue.hint;

        primarySpaceBtn.className = "w-full py-6 sm:py-7 px-6 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 active:scale-[0.995] text-white shadow-xl transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer border border-rose-400/40";
        primaryBtnMainText.textContent = `PRESS SPACE TO FADE OUT (${cue.fadeOut.toFixed(1)}s)`;
        primaryBtnSubText.textContent = currentCueIndex < cues.length - 1
          ? `After fade-out, automatically cues up: ${cues[currentCueIndex + 1].title}`
          : "Final cue — will finish show after fade-out";
      } else if (playState === "FADING_OUT") {
        stageConsole.classList.add("border-amber-500/50");
        statusBadge.className = "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40";
        statusDot.className = "w-2 h-2 rounded-full bg-amber-400";
        statusLabel.textContent = `FADING OUT (${cue.fadeOut.toFixed(1)}s)...`;
        statusLabel.classList.add("fading-pulse");
        activeCueTitle.textContent = cue.title;
        activeCueNote.textContent = "Smoothly lowering volume for transition...";

        primarySpaceBtn.className = "w-full py-6 sm:py-7 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 shadow-lg transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer border border-amber-500/40";
        primaryBtnMainText.textContent = "FADING OUT... (PRESS SPACE TO SKIP FADE)";
        primaryBtnSubText.textContent = "Letting volume glide down smoothly";
      }

      renderCueList();
    }

    function renderCueList() {
      cueListContainer.innerHTML = "";

      cues.forEach((cue, idx) => {
        const isCurrent = idx === currentCueIndex && playState !== "SHOW_DONE";
        const isCompleted = idx < currentCueIndex || playState === "SHOW_DONE";

        const card = document.createElement("div");
        card.className = `rounded-2xl p-4 border transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          isCurrent
            ? "bg-slate-900 border-amber-400/70 shadow-lg shadow-amber-500/5"
            : isCompleted
            ? "bg-slate-900/40 border-slate-800/70 opacity-75 hover:opacity-100"
            : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
        }`;

        // Left side: Cue Selection & Info
        const leftDiv = document.createElement("div");
        leftDiv.className = "flex items-start gap-3.5 cursor-pointer flex-1";
        leftDiv.onclick = () => {
          stopAllAudioImmediate(false);
          currentCueIndex = idx;
          playState = "READY";
          updateUI();
        };

        const badge = document.createElement("div");
        badge.className = `w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 mt-0.5 ${
          isCurrent
            ? "bg-amber-400 text-slate-950"
            : isCompleted
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            : "bg-slate-800 text-slate-300"
        }`;
        badge.textContent = isCompleted && !isCurrent ? "✓" : cue.id;

        const infoDiv = document.createElement("div");
        infoDiv.innerHTML = `
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-bold text-base sm:text-lg ${isCurrent ? "text-white" : "text-slate-200"}">${cue.title}</span>
            <span class="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-medium">${cue.scene}</span>
          </div>
          <p class="text-xs text-slate-400 mt-1">${cue.hint}</p>
        `;

        leftDiv.appendChild(badge);
        leftDiv.appendChild(infoDiv);

        // Right side: Fade duration controls & File attachment
        const rightDiv = document.createElement("div");
        rightDiv.className = "flex flex-wrap items-center gap-3 sm:gap-4 pl-12 md:pl-0";

        // Fade In Input
        const fadeInWrap = document.createElement("label");
        fadeInWrap.className = "flex items-center gap-1.5 text-xs text-slate-400 bg-slate-950/70 px-2.5 py-1.5 rounded-xl border border-slate-800";
        fadeInWrap.innerHTML = `<span>In:</span>`;
        const fadeInInput = document.createElement("input");
        fadeInInput.type = "number";
        fadeInInput.min = "0";
        fadeInInput.max = "15";
        fadeInInput.step = "0.5";
        fadeInInput.value = cue.fadeIn;
        fadeInInput.className = "w-12 bg-transparent text-amber-300 font-mono font-bold text-right focus:outline-none";
        fadeInInput.onchange = (e) => {
          cue.fadeIn = Math.max(0, parseFloat(e.target.value) || 0);
          updateUI();
        };
        fadeInWrap.appendChild(fadeInInput);
        fadeInWrap.appendChild(document.createTextNode("s"));

        // Fade Out Input
        const fadeOutWrap = document.createElement("label");
        fadeOutWrap.className = "flex items-center gap-1.5 text-xs text-slate-400 bg-slate-950/70 px-2.5 py-1.5 rounded-xl border border-slate-800";
        fadeOutWrap.innerHTML = `<span>Out:</span>`;
        const fadeOutInput = document.createElement("input");
        fadeOutInput.type = "number";
        fadeOutInput.min = "0.2";
        fadeOutInput.max = "15";
        fadeOutInput.step = "0.5";
        fadeOutInput.value = cue.fadeOut;
        fadeOutInput.className = "w-12 bg-transparent text-amber-300 font-mono font-bold text-right focus:outline-none";
        fadeOutInput.onchange = (e) => {
          cue.fadeOut = Math.max(0.2, parseFloat(e.target.value) || 0.5);
          updateUI();
        };
        fadeOutWrap.appendChild(fadeOutInput);
        fadeOutWrap.appendChild(document.createTextNode("s"));

        // Single File Picker
        const fileLabel = document.createElement("label");
        fileLabel.className = `cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition max-w-[180px] ${
          cue.fileName
            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
            : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
        }`;
        fileLabel.title = cue.fileName ? `Loaded: ${cue.fileName}` : "Attach MP3/WAV file (currently using demo chime)";

        const fileText = document.createElement("span");
        fileText.className = "truncate";
        fileText.textContent = cue.fileName ? `🎵 ${cue.fileName}` : "Demo Synth (Load MP3)";

        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "audio/*";
        fileInput.className = "hidden";
        fileInput.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            attachFileToCue(cue, file);
            showToast(`Loaded "${file.name}" into Cue ${cue.id}`);
          }
        };

        fileLabel.appendChild(fileText);
        fileLabel.appendChild(fileInput);

        rightDiv.appendChild(fadeInWrap);
        rightDiv.appendChild(fadeOutWrap);
        rightDiv.appendChild(fileLabel);

        card.appendChild(leftDiv);
        card.appendChild(rightDiv);
        cueListContainer.appendChild(card);
      });
    }

    function attachFileToCue(cue, file) {
      if (cue.objectUrl) {
        URL.revokeObjectURL(cue.objectUrl);
      }
      cue.fileName = file.name;
      cue.objectUrl = URL.createObjectURL(file);
      updateUI();
    }

    // 7. Bulk Multi-File Smart Matcher
    document.getElementById("bulkFileInput").addEventListener("change", (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      let matchedCount = 0;
      files.forEach((file) => {
        const lower = file.name.toLowerCase();
        const match = cues.find((c) => c.keywords.some((kw) => lower.includes(kw)));
        if (match) {
          attachFileToCue(match, file);
          matchedCount++;
        }
      });

      if (matchedCount > 0) {
        showToast(`Auto-matched ${matchedCount} audio file(s) to cues!`);
      } else {
        showToast("Selected files didn't match cue keywords — use individual buttons.");
      }
    });

    // 8. Event Listeners (Spacebar, Arrow Keys, Esc, Buttons)
    primarySpaceBtn.addEventListener("click", handleSpaceAction);

    document.getElementById("prevCueBtn").addEventListener("click", () => {
      stopAllAudioImmediate(false);
      currentCueIndex = Math.max(0, currentCueIndex - 1);
      playState = "READY";
      updateUI();
    });

    document.getElementById("nextCueBtn").addEventListener("click", () => {
      stopAllAudioImmediate(false);
      currentCueIndex = Math.min(cues.length - 1, currentCueIndex + 1);
      playState = "READY";
      updateUI();
    });

    document.getElementById("panicStopBtn").addEventListener("click", () => {
      stopAllAudioImmediate(true);
      showToast("Hard stop triggered");
    });

    document.getElementById("resetShowBtn").addEventListener("click", () => {
      stopAllAudioImmediate(false);
      currentCueIndex = 0;
      playState = "READY";
      updateUI();
      showToast("Show reset to Cue 1");
    });

    masterVolumeSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      masterVolume = val / 100;
      masterVolumeText.textContent = `${val}%`;
      applyGain(currentGain);
    });

    // Global Keyboard Shortcuts
    window.addEventListener("keydown", (e) => {
      // Ignore keyboard shortcuts if user is typing in a number input
      if (e.target.tagName === "INPUT" && e.target.type === "number") return;

      if (e.code === "Space") {
        e.preventDefault();
        handleSpaceAction();
      } else if (e.code === "Escape") {
        e.preventDefault();
        stopAllAudioImmediate(true);
        showToast("Hard stop (Esc)");
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        const nextVal = Math.min(100, Math.round(masterVolume * 100) + 5);
        masterVolume = nextVal / 100;
        masterVolumeSlider.value = nextVal;
        masterVolumeText.textContent = `${nextVal}%`;
        applyGain(currentGain);
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        const nextVal = Math.max(0, Math.round(masterVolume * 100) - 5);
        masterVolume = nextVal / 100;
        masterVolumeSlider.value = nextVal;
        masterVolumeText.textContent = `${nextVal}%`;
        applyGain(currentGain);
      }
    });

    // 9. Standalone Offline HTML Downloader
    document.getElementById("downloadHtmlBtn").addEventListener("click", () => {
      const htmlContent = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "joulunaidend-cue-player.html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Saved standalone HTML file!");
    });

    // Initialize UI on load
    updateUI();