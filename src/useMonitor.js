import { useCallback, useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { ClosureTracker, eyeAspectRatio, expressionScores, LEFT_EYE, RIGHT_EYE, validPose } from './vision';
import { SoundEngine } from './audio';
const initial = { ear: null, closedMs: 0, alarm: false, valid: false, fps: 0, scores: {}, quality: 'Waiting for camera', history: [] };
export function useMonitor(videoRef, canvasRef, settings) {
  const [mode, setMode] = useState('idle'), [data, setData] = useState(initial), [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0), [events, setEvents] = useState([]), [ambient, setAmbient] = useState(false);
  const engine = useRef(null), detector = useRef(null), stream = useRef(null), frame = useRef(null);
  const generation = useRef(0), tracker = useRef(new ClosureTracker()), config = useRef(settings), dataRef = useRef(initial), modeRef = useRef('idle');
  config.current = settings;
  const stop = useCallback(() => {
    generation.current++; cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    engine.current?.stopAlarm(); tracker.current.reset(); modeRef.current = 'idle'; setMode('idle'); setData(initial); dataRef.current = initial;
    const c = canvasRef.current; c?.getContext('2d').clearRect(0, 0, c.width, c.height);
  }, [videoRef, canvasRef]);
  useEffect(() => () => { stop(); detector.current?.close(); engine.current?.dispose(); }, [stop]);
  useEffect(() => {
    if (!['live', 'demo'].includes(mode)) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000); return () => clearInterval(t);
  }, [mode]);
  useEffect(() => {
    const hide = () => { if (document.hidden && modeRef.current !== 'idle') { stop(); setError('Monitoring paused because this tab was hidden. Restart when you are ready.'); } };
    document.addEventListener('visibilitychange', hide); return () => document.removeEventListener('visibilitychange', hide);
  }, [stop]);
  useEffect(() => { if (!settings.sound) engine.current?.stopAlarm(); }, [settings.sound]);
  const unlock = async () => { if (!engine.current) engine.current = new SoundEngine(); await engine.current.unlock(); };
  const start = async (demo = false) => {
    stop(); setError(''); setEvents([]); setSeconds(0); setMode('loading'); modeRef.current = 'loading';
    const token = generation.current;
    try {
      try { await unlock(); } catch { setError('Audio unavailable. Visual alerts remain active.'); }
      if (token !== generation.current) return;
      if (!demo) {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access requires HTTPS and a supported browser.');
        const media = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
        if (token !== generation.current) { media.getTracks().forEach(t => t.stop()); return; }
        stream.current = media;
        media.getVideoTracks()[0].onended = () => { if (generation.current === token) { stop(); setError('Camera disconnected. Reconnect it and start again.'); } };
        videoRef.current.srcObject = media; await videoRef.current.play();
        if (!detector.current) {
          const files = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm');
          const model = await FaceLandmarker.createFromOptions(files, {
            baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task' },
            runningMode: 'VIDEO', numFaces: 2, outputFaceBlendshapes: true, minFaceDetectionConfidence: .6, minTrackingConfidence: .6
          });
          if (token !== generation.current) { model.close(); return; }
          detector.current = model;
        }
      }
      if (token !== generation.current) return;
      modeRef.current = demo ? 'demo' : 'live'; setMode(modeRef.current);
      let lastFrame = 0, lastVideo = -1, lastPublish = 0, lastHistory = 0, lastAlarm = false, history = [], smooth = {};
      const begun = performance.now();
      const lightCanvas = document.createElement('canvas'); lightCanvas.width = 32; lightCanvas.height = 18;
      const lightCtx = lightCanvas.getContext('2d', { willReadFrequently: true }); let brightness = 100, lastLight = 0;
      const loop = now => {
        if (token !== generation.current) return;
        frame.current = requestAnimationFrame(loop);
        if (now - lastFrame < 65) return; // Cap expensive inference near 15 fps.
        const video = videoRef.current;
        if (!demo && (video.readyState < 2 || video.currentTime === lastVideo)) {
          if (now - lastFrame > 500) { tracker.current.reset(); engine.current?.stopAlarm(); setData(d => ({ ...d, valid: false, alarm: false, closedMs: 0, quality: 'Video stalled · check camera' })); }
          return;
        }
        const fps = lastFrame ? Math.round(1000 / (now - lastFrame)) : 15; lastFrame = now;
        let ear, scores, valid = true, quality = 'Good tracking';
        try {
          if (demo) {
            // Explicit synthetic scenario: ordinary blinking, then a prolonged closure.
            const phase = ((now - begun) / 1000) % 24;
            ear = phase > 17 && phase < 21 ? .14 : .31 + Math.sin(now / 800) * .012;
            scores = { Neutral: .82, Happy: .12, Sad: .03, Stressed: .04, Tired: ear < .22 ? .89 : .07, Angry: .02, Surprised: .03 };
            quality = 'Simulated signals';
          } else {
            lastVideo = video.currentTime;
            const result = detector.current.detectForVideo(video, now);
            const p = result.faceLandmarks[0];
            if (now - lastLight > 1000) {
              lightCtx.drawImage(video, 0, 0, 32, 18); const pixels = lightCtx.getImageData(0, 0, 32, 18).data;
              let total = 0; for (let i = 0; i < pixels.length; i += 4) total += .2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2];
              brightness = total / (32 * 18); lastLight = now;
            }
            valid = result.faceLandmarks.length === 1 && validPose(p) && brightness > 35;
            quality = !p ? 'No face · face the camera' : result.faceLandmarks.length > 1 ? 'Multiple faces · use one driver' : brightness <= 35 ? 'Low light · brighten your face' : !valid ? 'Face forward · move closer' : fps < 8 ? 'Low frame rate' : 'Good tracking';
            ear = p ? (eyeAspectRatio(p, LEFT_EYE, video.videoWidth, video.videoHeight) + eyeAspectRatio(p, RIGHT_EYE, video.videoWidth, video.videoHeight)) / 2 : null;
            scores = valid ? expressionScores(result.faceBlendshapes[0]?.categories, ear) : {};
            const canvas = canvasRef.current, ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (p && config.current.mesh) {
              ctx.strokeStyle = 'rgba(159,235,186,.25)'; ctx.lineWidth = .7;
              for (const { start, end } of FaceLandmarker.FACE_LANDMARKS_TESSELATION) {
                ctx.beginPath(); ctx.moveTo(p[start].x * canvas.width, p[start].y * canvas.height); ctx.lineTo(p[end].x * canvas.width, p[end].y * canvas.height); ctx.stroke();
              }
              ctx.fillStyle = '#c1ff91';
              for (const i of [...LEFT_EYE, ...RIGHT_EYE]) { ctx.beginPath(); ctx.arc(p[i].x * canvas.width, p[i].y * canvas.height, 2.5, 0, Math.PI * 2); ctx.fill(); }
            }
          }
          const state = tracker.current.update(ear, now, valid && fps >= 5, config.current.threshold, config.current.duration * 1000);
          if (state.alarm && config.current.sound) engine.current?.startAlarm(); else engine.current?.stopAlarm();
          if (state.alarm && !lastAlarm) setEvents(e => [{ time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: demo ? 'Demo: prolonged eye closure' : 'Prolonged eye closure detected' }, ...e].slice(0, 20));
          lastAlarm = state.alarm;
          if (!valid) smooth = {};
          Object.entries(scores).forEach(([key, value]) => { smooth[key] = smooth[key] === undefined ? value : smooth[key] * .8 + value * .2; });
          if (now - lastHistory > 1000) { history = [...history, valid ? ear : null].slice(-60); lastHistory = now; }
          if (now - lastPublish > 100) {
            const next = { ear, ...state, valid: valid && fps >= 5, fps, scores: { ...smooth }, quality, history };
            dataRef.current = next; setData(next); lastPublish = now;
          }
        } catch (e) { stop(); setError(`Tracking stopped: ${e.message}. Please restart.`); }
      };
      frame.current = requestAnimationFrame(loop);
    } catch (e) {
      if (token !== generation.current) return;
      stop(); setError(e.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser, or explore demo mode.' : `Unable to start: ${e.message}`);
    }
  };
  const testAlarm = async () => { try { await unlock(); engine.current.startAlarm(); setTimeout(() => { if (!dataRef.current.alarm || !config.current.sound) engine.current?.stopAlarm(); }, 1500); } catch { setError('Your browser could not enable audio.'); } };
  const toggleAmbient = async () => { try { await unlock(); setAmbient(engine.current.toggleAmbient()); } catch { setError('Your browser could not enable audio.'); } };
  return { mode, data, error, seconds, events, ambient, start, stop, testAlarm, toggleAmbient };
}
