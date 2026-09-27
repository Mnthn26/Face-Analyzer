# CoPilot · AI Driver Awareness & Well-Being Monitor

A complete, client-side React application for webcam-based eye-closure monitoring, facial-expression indicators, and optional well-being feedback. Built with React, Vite, MediaPipe Face Landmarker, Canvas, and the Web Audio API. No backend, API key, video upload, or external audio asset is needed.

> **Experimental awareness aid, not a certified safety or medical system.** Configure and test only while safely parked. Never operate the dashboard while driving. If tired, stop safely and rest regardless of what the dashboard says. Facial expressions cannot reliably determine someone's internal emotions.

## Run locally

Requires Node.js 20.19+ (or Node.js 22.12+) and npm.

```bash
npm ci
npm run dev
# Open http://localhost:5173 on the same computer.

npm test          # EAR, time-based alarms, resets, hysteresis, expression rules
npm run build    # Production bundle in dist/
npm run preview  # Preview the production build
```

The server binds to `0.0.0.0`. The Arena HTTPS preview domain is allowed. Browser code makes no localhost backend requests.

**Camera requirements:** use HTTPS in deployment, or localhost on your own computer. Plain HTTP on a LAN IP does not normally allow camera access. Allow the browser camera permission. Embedded previews must delegate camera access (e.g. `allow="camera; fullscreen"`); if permissions are blocked in an iframe, open the HTTPS preview directly in a new tab. The camera permission prompt may not appear until the preview is opened directly.

The first live session downloads a pinned MediaPipe WASM runtime from jsDelivr and Face Landmarker model from Google Cloud Storage. Google Fonts are optional; system fonts are fallbacks. Internet and access to those hosts are required for model initialization. Camera frames, landmarks, and scores are not sent to these hosts. For an offline deployment, self-host the pinned runtime/model and fonts and change the URLs in `src/useMonitor.js` and `index.html`.

## Try it

1. Click **Try demo** for synthetic signals without camera/model access. Each 24-second cycle includes a four-second simulated closure starting at second 17; with default settings the alarm begins around second 19. Demo labels remain visible.
2. In **Preferences**, test the alarm at a comfortable system volume. Synthesized audio requires a user gesture and audible device output. A browser cannot override system mute or volume. Test alarm plays even if automatic alarms are muted.
3. Click **Start camera**. Face the camera with both eyes visible and good lighting. Default closed-eye threshold is EAR `< 0.22`, default continuous duration is `2.0s`.
4. Adjust threshold and delay while stationary for your camera/eyes. These defaults are not universal or clinically validated. A lower threshold can miss closures; a higher threshold can generate false alerts.
5. Use **Session insights** to review up to 20 alerts. **Export session** downloads JSON with settings, elapsed time, and alert timestamps—never images or biometric data. Data is in memory only. A new session clears the prior log; refreshing clears all session data.
6. **End session** releases the camera and stops the alarm. Ambient tones are separately user-controlled. Hiding the browser tab stops monitoring and requires an explicit restart.

## Component-level architecture

```text
Start camera (user gesture)
  ├─ unlock AudioContext
  └─ getUserMedia(video only) → muted, inline <video>
       └─ requestAnimationFrame (~15 inference FPS ceiling)
            ├─ skip duplicate video frames
            ├─ MediaPipe detectForVideo
            │    ├─ face landmarks → optional Canvas triangulated mesh
            │    └─ facial blendshapes → heuristic expression indicators
            ├─ quality gate: single face / distance / yaw / roll / lighting / FPS
            ├─ pixel-space left & right EAR → mean EAR
            │    └─ ClosureTracker: timestamps + hysteresis + continuity
            │          ├─ 2s continuous closure → visual warning + synthesized alarm
            │          └─ open eyes / invalid tracking → reset + silence
            └─ UI (~10 updates/sec) + 60-point EAR timeline (~1Hz)
                 ├─ expression bars → contextual well-being card
                 ├─ awareness gauge + closure timer
                 └─ in-memory alert log → explicit JSON download
```

### Project structure

```text
index.html           HTML entry, optional hosted fonts
src/main.jsx         Responsive dashboard, controls, dialogs, demo illustration
src/styles.css       Dark UI, responsive layouts, reduced-motion support
src/useMonitor.js    Camera/model lifecycle, frame loop, quality gates, demo mode
src/vision.js        EAR geometry, ClosureTracker, pose checks, expression rules
src/audio.js         Local oscillator alarm and user-controlled ambient tones
src/vision.test.js   Pure algorithm unit tests using Node's built-in test runner
vite.config.js       React and HTTPS preview host configuration
```

### EAR and continuous closure

For six ordered eye contour points:

```text
EAR = (distance(p2,p6) + distance(p3,p5)) / (2 × distance(p1,p4))
```

MediaPipe coordinates are normalized separately by image width and height. Convert them to pixels before computing distances, or a wide video frame will distort the ratio. We use the mean of the left/right eye ratios.

The safety tracker uses `performance.now()` rather than closed-frame counts. Alarm duration is stable under ordinary variable frame rates. Hysteresis keeps an already-closed state until EAR reaches `threshold + 0.025`; this reduces threshold jitter. Any invalid frame or inference gap over 500ms breaks closure continuity. UI expression smoothing is deliberately **not** applied to the EAR safety trigger.

### Expression pipeline (not emotion recognition)

MediaPipe is a facial landmark/blendshape model, **not** a validated emotion classifier. This application implements transparent, uncalibrated heuristic mappings:

| UI label | Facial signal |
| --- | --- |
| Happy | Mean left/right mouth smile |
| Sad | Mean mouth frown and inner-brow raise |
| Angry | Mean left/right brow lowering |
| Stressed | Mean brow lowering and mouth press |
| Surprised | Mean jaw opening and eye widening |
| Tired | Low EAR-derived indicator |
| Neutral | Complement of the largest primary signal |

Scores are exponentially smoothed for display, need not sum to 100%, and are **not confidence probabilities** or evidence of mental state. Mapping stress, tiredness, sadness, or anger from movement is especially uncertain. User self-report is preferable for real well-being assessment. Suggestions are optional, non-diagnostic, and encourage safely stopping/resting rather than using stimulation to continue driving.

### Audio

`SoundEngine` synthesizes a repeating square-wave warning with alternating 740/980Hz frequencies and a gain envelope. Opening the eyes, invalid tracking, muting alarms, ending the session, or hiding the page stops it. Ambient playback uses three quiet sine oscillators; it never starts automatically. Audio level is intentionally bounded: validate the audible level on the actual device rather than assuming software can guarantee loudness.

## Edge cases, performance, and limits

- **Missing/occluded faces:** clear closure timer; explicitly show unavailable tracking rather than an awake state. Multiple faces are rejected (model requests up to two faces).
- **Side profile/distance/roll:** geometric gates reject unsuitable poses. These are approximate checks, not calibrated pose estimates; eye occlusion, glasses, glare, and individual facial geometry can still cause errors.
- **Lighting:** low-resolution frame luminance sampled once per second warns on dark images. This is a coarse whole-frame proxy, not exposure calibration or face-region lighting analysis; backlighting can defeat it.
- **Frame drops:** cap inference near 15 FPS, skip repeated video frames, reject rates below 5 FPS, reset continuity across gaps over 500ms, and invalidate stalled video. Missing time is never counted as proof of closed eyes. Conservative invalidation can miss genuine closures during poor tracking.
- **Main-thread inference:** MediaPipe runs synchronously. UI updates are throttled and sampling is inexpensive, but slow devices may still stall. A worker/OffscreenCanvas architecture is the next optimization for sustained high-resolution deployment. Main-thread starvation can delay audio stop/UI updates.
- **False alerts/missed detections:** default thresholds vary across people and hardware; normal down-gaze or squinting may resemble closed eyes. This is eye-closure detection, not proof of sleep, and it cannot detect all types of impaired attention. There is no calibrated probability of drowsiness.
- **Hidden tabs:** visibility changes stop monitoring and release the camera, rather than silently depending on throttled browser timers. Keep the page visible and the device awake.
- **Permissions/model errors:** actionable errors are shown; camera tracks are released on failure/cancellation. Demo remains available if camera/model access fails.
- **Privacy:** no storage, analytics, recording, or server inference. A user-initiated JSON download is the only export. Initial third-party asset requests reveal normal network metadata, not video data.

## Validation

`npm test` covers pixel-correct EAR, continuous closure, short blinks, loss of tracking, frame gaps, hysteresis, configurable delay, and bounded expression scores. `npm run build` checks the production bundle.

Both passed in the development sandbox. Automated browser installation and model-host connectivity were blocked by network TLS failures there; live webcam/model inference and audible device behavior have **not** been verified in that environment.

Before use, manually verify in a current Chrome/Edge browser:

- Demo alarm activates after its continuous closure interval and stops on reopening.
- Camera permission allowed/denied, camera disconnected, and model network failure.
- A normal blink produces no alarm; a stationary, intentional prolonged eye closure does.
- Sound toggle, test alarm, device mute, ambient start/stop, and end-session cleanup.
- Low light, glasses, no face, two faces, side profile, and reduced device performance.
- Hidden tab behavior; mobile viewport; keyboard navigation; full screen; session export.

A real automotive deployment requires representative validation, human-factors review, calibrated per-user/device thresholds, robust occlusion handling, and hardware/browser-independent fail-safe monitoring. This browser prototype does not provide those guarantees.
