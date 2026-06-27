import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import KeyAuthGate from './KeyAuthGate';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [songTitle, setSongTitle] = useState('Song name');
  const [songArtist, setSongArtist] = useState('Artist');
  const [isEditingText, setIsEditingText] = useState(false);
  const [artworkUrl, setArtworkUrl] = useState('');
  const [isVideo, setIsVideo] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [manualCoverSet, setManualCoverSet] = useState(false);
  const [isMarquee, setIsMarquee] = useState(false);
  const [showFollowModal, setShowFollowModal] = useState(true);
  const [deviceName, setDeviceName] = useState('senux');
  const [isEditingDevice, setIsEditingDevice] = useState(false);
  const [showEditorMode, setShowEditorMode] = useState(false);
  const [playerOrientation, setPlayerOrientation] = useState('portrait'); // 'portrait' or 'landscape'
  const [isCoverVideo, setIsCoverVideo] = useState(false); // Whether cover art is a video file
  const [songUrl, setSongUrl] = useState('');
  const bgVideoRef = useRef(null);
  const bgCoverVideoRef = useRef(null);

  // Unified render phase state machine
  const [renderPhase, setRenderPhase] = useState('idle'); // 'idle', 'recording', 'converting', 'done', 'error'
  const [renderProgress, setRenderProgress] = useState(0);
  const [convertProgress, setConvertProgress] = useState(0);
  const [renderResult, setRenderResult] = useState(null); // Final MP4 Blob
  const [renderFileSize, setRenderFileSize] = useState(0);
  const [renderError, setRenderError] = useState('');
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(null);
  const [renderErrorDetails, setRenderErrorDetails] = useState('');
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Snippet and format rendering states
  const [renderStart, setRenderStart] = useState('0:00');
  const [renderEnd, setRenderEnd] = useState('0:30');
  const [renderResolution, setRenderResolution] = useState('720'); // '720' or '1080'
  const [renderFps, setRenderFps] = useState('30'); // '30' or '60'
  const [renderAspectRatio, setRenderAspectRatio] = useState('9:16'); // '16:9' or '9:16' or '1:1'
  const [renderCodec, setRenderCodec] = useState('h264'); // 'h264'
  const [renderBitrate, setRenderBitrate] = useState('3500'); // kbps: '2000', '3500', '6000'
  const [renderAudioQuality, setRenderAudioQuality] = useState('256'); // kbps: '128', '256', '320'
  const [isAudioFadeEnabled, setIsAudioFadeEnabled] = useState(true); // Toggle audio fading
  const [audioFadeDuration, setAudioFadeDuration] = useState('1'); // Audio fade duration in seconds
  const [usedNativeMp4, setUsedNativeMp4] = useState(false); // Track if native MP4 was used
  const [nativeRenderUri, setNativeRenderUri] = useState('');

  // Landscape layout adjustment states
  const [landscapeCardWidth, setLandscapeCardWidth] = useState(1000);
  const [landscapeCardHeight, setLandscapeCardHeight] = useState(440);
  const [landscapeArtPadding, setLandscapeArtPadding] = useState(26);
  const [landscapeDetailsGap, setLandscapeDetailsGap] = useState(32);
  const [landscapeBottomOffset, setLandscapeBottomOffset] = useState(0);
  const [isLivePhotoEnabled, setIsLivePhotoEnabled] = useState(true);

  // Initialize with a beautiful default audio waveform pattern (Intro, Verse, Build, Drop, Outro)
  const [waveformPeaks, setWaveformPeaks] = useState(() => {
    const defaultPeaks = [];
    for (let i = 0; i < 150; i++) {
      let base = 0.1;
      if (i < 28) {
        base = 0.15 + (i / 28) * 0.35;
      } else if (i < 65) {
        base = 0.4 + Math.sin(i * 0.3) * 0.15;
      } else if (i < 85) {
        base = 0.45 + ((i - 65) / 20) * 0.4 + Math.sin(i * 0.6) * 0.1;
      } else if (i < 120) {
        base = 0.8 + Math.sin(i * 0.9) * 0.18;
      } else {
        base = 0.55 * (1 - (i - 120) / 30) + Math.sin(i * 0.3) * 0.1;
      }
      defaultPeaks.push(Math.max(0.08, Math.min(1.0, base + Math.random() * 0.08)));
    }
    return defaultPeaks;
  });

  const audioRef = useRef(null);
  const songFileRef = useRef(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const canvasRef = useRef(null);
  const uiCanvasRef = useRef(null);
  const editorVisualizerRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const titleRef = useRef(null);
  const containerRef = useRef(null);
  const airplayImgRef = useRef(null);
  const volumeHighImgRef = useRef(null);
  const volumeLowImgRef = useRef(null);
  const coverVideoRef = useRef(null);

  useEffect(() => {
    const airplay = new Image();
    airplay.src = '/airplay.png';
    airplayImgRef.current = airplay;

    const vol = new Image();
    vol.src = '/volume-high.png';
    volumeHighImgRef.current = vol;

    const volLow = new Image();
    volLow.src = '/volume-low.png';
    volumeLowImgRef.current = volLow;
  }, []);

  const isRecordingRef = useRef(isRecording);
  const renderStartRef = useRef(renderStart);
  const renderEndRef = useRef(renderEnd);
  const isAudioFadeEnabledRef = useRef(isAudioFadeEnabled);
  const audioFadeDurationRef = useRef(audioFadeDuration);
  const toggleVideoRecordRef = useRef(null);

  useEffect(() => {
    isRecordingRef.current = isRecording;
    renderStartRef.current = renderStart;
    renderEndRef.current = renderEnd;
    isAudioFadeEnabledRef.current = isAudioFadeEnabled;
    audioFadeDurationRef.current = audioFadeDuration;
  }, [isRecording, renderStart, renderEnd, isAudioFadeEnabled, audioFadeDuration]);

  // Web Audio refs for recording
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const videoSourceRef = useRef(null);
  const audioDestinationRef = useRef(null);

  // Reuse FFT arrays to avoid thousands of allocations/GC pauses during rendering
  const fftReRef = useRef(new Float32Array(512));
  const fftImRef = useRef(new Float32Array(512));
  const fftMagRef = useRef(new Uint8Array(256));

  // Automatically check if title overflows to trigger smooth marquee scrolling
  useEffect(() => {
    const checkMarquee = () => {
      if (titleRef.current && containerRef.current) {
        const titleWidth = titleRef.current.scrollWidth;
        const containerWidth = containerRef.current.clientWidth;
        setIsMarquee(titleWidth > containerWidth);
      } else {
        setIsMarquee(false);
      }
    };

    // Use a small timeout to ensure the DOM has completed paint/layout and fonts are loaded
    const timer = setTimeout(checkMarquee, 100);
    return () => clearTimeout(timer);
  }, [songTitle, isVideo, isEditingText]);

  // Sync active player source
  const getActivePlayer = () => {
    return isVideo ? videoRef.current : audioRef.current;
  };

  // Helper to get actual playing state from the media element when available
  const getActualPlaying = () => {
    const player = getActivePlayer();
    if (player) return !player.paused;
    return isPlaying;
  };

  // Setup Web Audio API for clean recording stream
  const setupWebAudio = (element, isVideoType) => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Initialize AnalyserNode
    if (!analyserRef.current) {
      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = 512;
    }

    if (isVideoType) {
      if (videoSourceRef.current) return; // Already connected!
      videoSourceRef.current = ctx.createMediaElementSource(element);
      videoSourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(ctx.destination);
      if (!audioDestinationRef.current) {
        audioDestinationRef.current = ctx.createMediaStreamDestination();
      }
      analyserRef.current.connect(audioDestinationRef.current);
    } else {
      if (audioSourceRef.current) return; // Already connected!
      audioSourceRef.current = ctx.createMediaElementSource(element);
      audioSourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(ctx.destination);
      if (!audioDestinationRef.current) {
        audioDestinationRef.current = ctx.createMediaStreamDestination();
      }
      analyserRef.current.connect(audioDestinationRef.current);
    }
  };

  // Play/Pause Toggle
  const togglePlay = () => {
    const player = getActivePlayer();
    if (!player || !player.src) return;

    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      // Resume AudioContext if needed
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      // Ensure Web Audio analyser is set up
      setupWebAudio(player, isVideo);
      player.play().then(() => {
        setIsPlaying(true);
      }).catch(err => console.error("Playback failed:", err));
    }
  };

  // Metadata Reader using CDN jsmediatags
  const extractCoverArt = (file) => {
    if (manualCoverSet) return; // Keep custom upload if manually changed

    if (window.jsmediatags) {
      window.jsmediatags.read(file, {
        onSuccess: (tag) => {
          if (manualCoverSet) return; // Double-check race condition
          const { tags } = tag;
          if (tags.title) setSongTitle(tags.title);
          if (tags.artist) setSongArtist(tags.artist);

          if (tags.picture) {
            const { data, format } = tags.picture;
            let base64String = "";
            for (let i = 0; i < data.length; i++) {
              base64String += String.fromCharCode(data[i]);
            }
            const base64 = window.btoa(base64String);
            setArtworkUrl(`data:${format};base64,${base64}`);
          }
        },
        onError: (error) => {
          console.log("No ID3 tags found, using defaults:", error.type, error.info);
        }
      });
    }
  };

  const generateWaveform = async (file) => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const tempCtx = new AudioContextClass();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);
      const step = Math.ceil(channelData.length / 150);
      const peaks = [];
      
      for (let i = 0; i < 150; i++) {
        let sum = 0;
        const start = i * step;
        const end = Math.min(start + step, channelData.length);
        const count = end - start;
        for (let j = start; j < end; j++) {
          sum += Math.abs(channelData[j]);
        }
        const avg = count > 0 ? (sum / count) : 0;
        peaks.push(avg);
      }
      
      const maxPeak = Math.max(...peaks) || 1;
      const normalizedPeaks = peaks.map(p => {
        const ratio = p / maxPeak;
        // Exaggerate dynamic range differences: quiet sections drop low, beats stand out
        return Math.max(0.06, Math.pow(ratio, 1.5));
      });
      setWaveformPeaks(normalizedPeaks);
      tempCtx.close();
    } catch (err) {
      console.error("Failed to generate waveform:", err);
      // Fallback pseudo-random waveform profile with distinct quiet and loud parts
      const fakePeaks = [];
      for (let i = 0; i < 150; i++) {
        let base = 0.1;
        if (i < 28) base = 0.1 + (i / 28) * 0.2;
        else if (i < 65) base = 0.3 + Math.sin(i * 0.3) * 0.1;
        else if (i < 85) base = 0.3 + ((i - 65) / 20) * 0.5;
        else if (i < 120) base = 0.8 + Math.sin(i * 0.9) * 0.15;
        else base = 0.5 * (1 - (i - 120) / 30);
        fakePeaks.push(Math.max(0.06, Math.pow(base, 1.5) + Math.random() * 0.05));
      }
      setWaveformPeaks(fakePeaks);
    }
  };

  // Audio/Video file upload handler
  const handleSongUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    songFileRef.current = file;
    generateWaveform(file);
    const url = URL.createObjectURL(file);
    setSongUrl(url);
    const fileIsVideo = file.type.startsWith('video/');

    setIsPlaying(false);
    setIsVideo(fileIsVideo);
    setManualCoverSet(false);

    // Reset default details based on file name
    let name = file.name.replace(/\.[^/.]+$/, "");
    let artist = "Unknown Artist";
    if (name.includes(" - ")) {
      const parts = name.split(" - ");
      artist = parts[0].trim();
      name = parts.slice(1).join(" - ").trim();
    }
    setSongTitle(name);
    setSongArtist(artist);
    setArtworkUrl('');

    // Wait for DOM to update and apply source
    setTimeout(() => {
      const player = fileIsVideo ? videoRef.current : audioRef.current;
      if (player) {
        player.src = url;
        player.load();
        setupWebAudio(player, fileIsVideo);
        player.volume = volume;
      }
    }, 50);

    extractCoverArt(file);
    e.target.value = ''; // Reset input to allow selecting same file
  };

  // Helper to extract embedded MP4 from Samsung/Google Motion Photo JPEG
  const extractMotionPhotoVideo = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let ftypIdx = -1;
      for (let i = 0; i < bytes.length - 4; i++) {
        if (bytes[i] === 0x66 && bytes[i+1] === 0x74 && bytes[i+2] === 0x79 && bytes[i+3] === 0x70) {
          ftypIdx = i;
          break;
        }
      }
      if (ftypIdx !== -1) {
        const videoStart = ftypIdx - 4;
        if (videoStart >= 0) {
          const videoBytes = bytes.subarray(videoStart);
          return new Blob([videoBytes], { type: 'video/mp4' });
        }
      }
    } catch (e) {
      console.error("Error parsing motion photo:", e);
    }
    return null;
  };

  // Custom Cover Image/Video uploader
  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    let uploadFile = file;
    let isVid = file.type.startsWith('video/');

    // Auto-detect Samsung/Google Motion Photo JPEG files and extract the embedded video
    if (file.type === 'image/jpeg' || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')) {
      const motionVideoBlob = await extractMotionPhotoVideo(file);
      if (motionVideoBlob) {
        isVid = true;
        uploadFile = new File([motionVideoBlob], file.name.replace(/\.[^/.]+$/, "") + ".mp4", { type: 'video/mp4' });
        console.log("Motion Photo detected! Extracted embedded video.");
      }
    }

    let url = URL.createObjectURL(uploadFile);

    if (window.Capacitor) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const cacheDir = (Directory && Directory.Cache) ? Directory.Cache : 'CACHE';
        const filename = `temp_cover_${Date.now()}.${uploadFile.name.split('.').pop()}`;

        // Convert file to base64
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(uploadFile);
        });

        const savedFile = await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: cacheDir
        });

        const { Capacitor } = await import('@capacitor/core');
        url = Capacitor.convertFileSrc(savedFile.uri);
      } catch (err) {
        console.error("Failed to save cover to native disk:", err);
      }
    }

    setIsCoverVideo(isVid);
    setArtworkUrl(url);
    setManualCoverSet(true);
    e.target.value = ''; // Reset input to allow selecting same file
  };

  // Seekbar change handler
  const handleSeek = (e) => {
    const player = getActivePlayer();
    if (!player) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = pct * duration;
    player.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Volume slider handler
  const handleVolumeChange = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(pct);
    const player = getActivePlayer();
    if (player) player.volume = pct;
  };

  // Format seconds to standard mm:ss
  const formatTime = (s) => {
    if (isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // Star favoriting toggle
  const toggleFavorite = () => {
    setIsFavorited(!isFavorited);
  };

  // 9:16 Canvas rendering loop and recorder engine
  const startCanvasRenderLoop = (ctx, canvasWidth, canvasHeight, coverImgObj, isVideoActive, videoEl) => {
    let textScrollOffset = 0;
    let scrollPauseTicks = 0;
    const videoSmoothHeights = new Array(6).fill(0);

    // 1. Prepare optimized blurred background canvas ONCE to avoid lag & black lines
    let cachedBgCanvas = null;
    let bgFallbackColor = '#0a0a14'; // Solid fallback to prevent any transparent pixels
    if (coverImgObj && coverImgObj.complete && coverImgObj.naturalWidth !== 0) {
      // Step A: Draw a small thumbnail to sample average colors
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = 4;
      sampleCanvas.height = 4;
      const sampleCtx = sampleCanvas.getContext('2d');
      sampleCtx.drawImage(coverImgObj, 0, 0, 4, 4);
      // Extract average color from the center pixel as solid fallback
      try {
        const px = sampleCtx.getImageData(1, 1, 1, 1).data;
        bgFallbackColor = `rgb(${Math.max(0, px[0] - 20)}, ${Math.max(0, px[1] - 20)}, ${Math.max(0, px[2] - 20)})`;
      } catch (e) { /* CORS: use default */ }

      // Step B: Create a 360x640 cached blur canvas (large enough to avoid upscale artifacts)
      cachedBgCanvas = document.createElement('canvas');
      cachedBgCanvas.width = 360;
      cachedBgCanvas.height = 640;
      const cachedBgCtx = cachedBgCanvas.getContext('2d');

      // Fill entire cached canvas with solid fallback color first (prevents ANY transparent pixels)
      cachedBgCtx.fillStyle = bgFallbackColor;
      cachedBgCtx.fillRect(0, 0, 360, 640);

      // Draw cover image scaled to fill, with strong blur to create dreamy background
      cachedBgCtx.imageSmoothingEnabled = true;
      cachedBgCtx.imageSmoothingQuality = 'high';
      cachedBgCtx.save();
      cachedBgCtx.filter = 'blur(80px) saturate(1.7) brightness(1.05)';
      // Draw with 160px overflow on all sides to prevent edge bleeding
      cachedBgCtx.drawImage(coverImgObj, -160, -160, 680, 960);
      cachedBgCtx.restore();
    }

    // 2. Reusable offscreen canvas for marquee text masking to prevent garbage collection lag
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 560; // Max possible logical width
    offCanvas.height = 60;
    const offCtx = offCanvas.getContext('2d');
    
    // Helper to draw image/video with object-fit: cover cropped-centering
    const drawMediaCover = (media, x, y, w, h, r, isVideoType) => {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.clip();
      
      const mWidth = isVideoType ? (media.videoWidth || w) : (media.naturalWidth || w);
      const mHeight = isVideoType ? (media.videoHeight || h) : (media.naturalHeight || h);
      const mRatio = mWidth / mHeight;
      const targetRatio = w / h;
      
      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = mWidth;
      let sourceHeight = mHeight;
      
      if (mRatio > targetRatio) {
        sourceWidth = mHeight * targetRatio;
        sourceX = (mWidth - sourceWidth) / 2;
      } else {
        sourceHeight = mWidth / targetRatio;
        sourceY = (mHeight - sourceHeight) / 2;
      }
      
      ctx.drawImage(media, sourceX, sourceY, sourceWidth, sourceHeight, x, y, w, h);
      ctx.restore();
    };

    const renderFrame = () => {
      const activePlayer = isVideoActive ? videoEl : audioRef.current;
      const curT = activePlayer ? activePlayer.currentTime : 0;
      const dur = activePlayer ? activePlayer.duration : 0;
      const playing = activePlayer ? !activePlayer.paused : isPlaying;

      // Automatically stop rendering once custom end time limit is met
      if (isRecordingRef.current) {
        const startSecs = parseTimeToSeconds(renderStartRef.current);
        const limitSecs = parseTimeToSeconds(renderEndRef.current);
        
        let targetVolume = volume; // User's preferred volume (base line)

        if (isAudioFadeEnabledRef.current) {
          const fadeDuration = parseFloat(audioFadeDurationRef.current) || 1.0; 

          if (curT < startSecs + fadeDuration) {
            // Fade In: ramp up volume from 0 to target volume
            const elapsed = curT - startSecs;
            const factor = Math.max(0, Math.min(1, elapsed / fadeDuration));
            targetVolume = volume * factor;
          } else if (curT > limitSecs - fadeDuration) {
            // Fade Out: ramp down volume from target volume to 0
            const remaining = limitSecs - curT;
            const factor = Math.max(0, Math.min(1, remaining / fadeDuration));
            targetVolume = volume * factor;
          }
        }

        if (activePlayer) {
          activePlayer.volume = targetVolume;
        }

        if (curT >= limitSecs) {
          if (activePlayer) {
            activePlayer.pause();
            activePlayer.volume = volume; // Restore base volume
          }
          if (toggleVideoRecordRef.current) {
            toggleVideoRecordRef.current(); // Complete snippet rendering
          }
          return; // Stop animation loop
        }
      }

      // 1. Draw background — NEVER leave transparent pixels (root cause of black lines)
      // Fill solid color FIRST to guarantee zero transparency in every single frame
      ctx.fillStyle = bgFallbackColor;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      
      if (cachedBgCanvas) {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = isRecordingRef.current ? 'low' : 'medium';
        // Draw cached blur canvas stretched to fill, with substantial overflow to prevent edge gaps
        ctx.drawImage(cachedBgCanvas, -30, -30, canvasWidth + 60, canvasHeight + 60);
        ctx.restore();
        
        // Add a premium subtle dark overlay
        ctx.fillStyle = 'rgba(10, 10, 20, 0.35)';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      } else {
        // Fallback dark gradient background (solid, no transparency)
        const bgGrad = ctx.createRadialGradient(canvasWidth * 0.3, canvasHeight * 0.2, 0, canvasWidth * 0.3, canvasHeight * 0.2, canvasHeight);
        bgGrad.addColorStop(0, '#1e1b4b');
        bgGrad.addColorStop(0.4, '#0f0e1a');
        bgGrad.addColorStop(1, '#0a0a14');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      }

      // 2. Translate and Scale logical coordinate space based on physical canvasWidth
      const width = 720;
      const height = 1280;
      const scaleFactor = canvasWidth / width;
      ctx.save();
      ctx.scale(scaleFactor, scaleFactor);

      // Draw Floating Card Player Card (Centered in 720x1280 logical viewport space)
      const cardWidth = 560;
      const cardHeight = 960;
      const cardX = (width - cardWidth) / 2;
      const cardY = (height - cardHeight) / 2;
      const cardRadius = 75;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
      // Premium Glassmorphic Canvas Fill
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2.0;
      ctx.stroke();
      ctx.restore();

      // Card border removed as requested to avoid white line when rendering

      // 3. Draw Album Cover art inside the Card with aspect ratio protection (Crop & Center)
      const artPadding = 35;
      const artSize = cardWidth - (artPadding * 2);
      const artX = cardX + artPadding;
      const artY = cardY + artPadding;
      const artRadius = 20;

      if (isVideoActive && videoEl && !videoEl.paused) {
        drawMediaCover(videoEl, artX, artY, artSize, artSize, artRadius, true);
      } else if (coverImgObj && coverImgObj.complete && coverImgObj.naturalWidth !== 0) {
        drawMediaCover(coverImgObj, artX, artY, artSize, artSize, artRadius, false);
      } else {
        // Placeholder music icon cover art
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(artX, artY, artSize, artSize, artRadius);
        ctx.clip();
        ctx.fillStyle = 'linear-gradient(135deg, #1e1e35 0%, #2d2d50 100%)';
        ctx.fillRect(artX, artY, artSize, artSize);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '70px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎵', artX + artSize / 2, artY + artSize / 2);
        ctx.restore();
      }

      // 3.5. Audio Spectrum data preparation (drawn later next to song info)
      let specDataArray = null;
      if (analyserRef.current) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        specDataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(specDataArray);
      }

      // 4. Song Info text (perfect luxurious spacing)
      const infoY = artY + artSize + 60;
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 22px Inter';
      ctx.textAlign = 'left';

      // Measure title and handle scrolling text if too long
      const maxTextWidth = cardWidth - (artPadding * 2) - 80;
      const titleWidth = ctx.measureText(songTitle).width;
      
      if (titleWidth > maxTextWidth && !isRecordingRef.current) {
        // Reuse pre-allocated offscreen canvas to avoid GC allocations & performance spikes
        offCtx.clearRect(0, 0, maxTextWidth, 60);
        offCtx.globalCompositeOperation = 'source-over';

        // Draw scrolling text on the offscreen canvas
        offCtx.fillStyle = '#ffffff';
        offCtx.font = '800 22px Inter';
        offCtx.textAlign = 'left';
        offCtx.textBaseline = 'middle';
        
        // Y coordinate inside offscreen canvas (height is 60, text size is 36, so middle is 30)
        const textY = 30;
        offCtx.fillText(songTitle, textScrollOffset, textY);
        offCtx.fillText(songTitle, textScrollOffset + titleWidth + 100, textY);

        // Apply fade-in/out mask on the offscreen canvas using 'destination-in'
        offCtx.globalCompositeOperation = 'destination-in';
        const grad = offCtx.createLinearGradient(0, 0, maxTextWidth, 0);
        
        // Fade-in appears only when text is moving (i.e. not in the initial/paused phase)
        if (scrollPauseTicks > 0 || Math.abs(textScrollOffset) < 1) {
          // Stopped/paused starting phase: only fade out on the right
          grad.addColorStop(0, 'rgba(0,0,0,1)');
          grad.addColorStop(0.9, 'rgba(0,0,0,1)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
        } else {
          // Moving phase: fade in on the left AND fade out on the right
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(0.08, 'rgba(0,0,0,1)');
          grad.addColorStop(0.92, 'rgba(0,0,0,1)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
        }

        offCtx.fillStyle = grad;
        offCtx.fillRect(0, 0, maxTextWidth, 60);

        // Draw the masked offscreen canvas back to the main canvas
        ctx.drawImage(offCanvas, 0, 0, maxTextWidth, 60, cardX + artPadding, infoY - 30, maxTextWidth, 60);

        // Smooth scrolling title with timed pause matching the CSS keyframes
        if (scrollPauseTicks > 0) {
          scrollPauseTicks--;
        } else {
          textScrollOffset -= 0.6;
          if (Math.abs(textScrollOffset) >= titleWidth + 100) {
            textScrollOffset = 0;
            scrollPauseTicks = 120; // 2 seconds pause (assuming ~60fps)
          }
        }
      } else {
        let displayTitle = songTitle;
        if (titleWidth > maxTextWidth) {
          let len = songTitle.length;
          while (len > 0 && ctx.measureText(displayTitle + '...').width > maxTextWidth) {
            len--;
            displayTitle = songTitle.substring(0, len);
          }
          displayTitle += '...';
        }
        ctx.fillText(displayTitle, cardX + artPadding, infoY);
      }

      // Draw Artist
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '500 20px Inter';
      ctx.fillText(songArtist, cardX + artPadding, infoY + 30);

      // 4.5. Draw Spectrum on the right side (aligned with title + artist, bidirectional)
      if (specDataArray && specDataArray.length > 0) {
        const specBarCount = 6;
        const specGap = 3;
        const specHeight = 40;
        const specBarWidth = 2.5;
        const specTotalWidth = specBarCount * specBarWidth + (specBarCount - 1) * specGap;
        const specX = cardX + cardWidth - artPadding - specTotalWidth;
        const specCenterY = infoY + 10;

        for (let i = 0; i < specBarCount; i++) {
          let val = 0;
          if (i === 0) {
            let bassSum = 0;
            for (let b = 0; b <= 1; b++) bassSum += (specDataArray[b] || 0);
            const bassAvg = bassSum / 2;
            // Low threshold (145) to trigger easily, low multiplier (1.6) so it never hits max height
            val = bassAvg > 145 ? (bassAvg - 145) * 1.6 : 0;
          } else {
            const freqBins = [20, 36, 56, 80, 110];
            const dataIdx = freqBins[i - 1] || 20;
            val = specDataArray[dataIdx] || 0;
          }
          
          const normalized = Math.pow(val / 255, 1.8) * (i === 1 ? 0.22 : 0.65);
          const targetHeight = normalized * (specHeight / 2);
          
          // Apply fast rise and decay (instant rise, extremely fast decay)
          const decayRate = 0.75;
          if (targetHeight > videoSmoothHeights[i]) {
            videoSmoothHeights[i] += (targetHeight - videoSmoothHeights[i]) * 1.0;
          } else {
            videoSmoothHeights[i] -= (videoSmoothHeights[i] - targetHeight) * decayRate;
          }
          
          const halfH = Math.max(1.5, videoSmoothHeights[i]);
          const bx = specX + i * (specBarWidth + specGap);

          ctx.beginPath();
          ctx.roundRect(bx, specCenterY - halfH, specBarWidth, halfH, 1);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.fill();

          ctx.beginPath();
          ctx.roundRect(bx, specCenterY, specBarWidth, halfH, 1);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.fill();
        }
      }

      // 5. Seekbar
      const seekY = infoY + 80;
      const seekWidth = cardWidth - (artPadding * 2);
      
      // Track bg
      ctx.beginPath();
      ctx.roundRect(cardX + artPadding, seekY, seekWidth, 12, 6);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fill();

      // Track filled progress
      const progressPercent = dur > 0 ? (curT / dur) : 0;
      const filledWidth = seekWidth * progressPercent;
      
      ctx.beginPath();
      ctx.roundRect(cardX + artPadding, seekY, filledWidth, 12, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Time labels
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '500 18px Inter';
      ctx.textAlign = 'left';
      ctx.fillText(formatTime(curT), cardX + artPadding, seekY + 48);
      
      ctx.textAlign = 'right';
      const remainingTime = dur > 0 ? (dur - curT) : 0;
      ctx.fillText(`-${formatTime(remainingTime)}`, cardX + cardWidth - artPadding, seekY + 48);
      // 6. Navigation Controls (Skip buttons, Play/Pause - perfectly centered)
      const ctrlY = seekY + 90;
      const btnCenter = cardX + cardWidth / 2;

      // Star Outline - Leftmost
      ctx.save();
      ctx.translate(btnCenter - 190, ctrlY);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      // Draw a 5-pointed star
      const spikes = 5;
      const outerRadius = 22;
      const innerRadius = 10;
      let rot = Math.PI / 2 * 3;
      const step = Math.PI / spikes;
      ctx.moveTo(0, -outerRadius);
      for (let i = 0; i < spikes; i++) {
        let x = Math.cos(rot) * outerRadius;
        let y = Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = Math.cos(rot) * innerRadius;
        y = Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // Skip Back (<<) - Left
      ctx.save();
      ctx.translate(btnCenter - 95, ctrlY);
      ctx.scale(2.8, 2.4);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.0;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      // Left triangle
      ctx.moveTo(-1, -6);
      ctx.lineTo(-9, 0);
      ctx.lineTo(-1, 6);
      ctx.closePath();
      
      // Right triangle
      ctx.moveTo(9, -6);
      ctx.lineTo(1, 0);
      ctx.lineTo(9, 6);
      ctx.closePath();
      
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Large Center Play / Pause Button (updated to match FontAwesome style)
      ctx.save();
      ctx.translate(btnCenter, ctrlY);
      // Slightly reduce overall scale and increase bar thickness for visual parity
      ctx.scale(2.5, 2.5);
      ctx.fillStyle = '#ffffff';
      if (playing) {
        // Pause bars with balanced corner radius
        ctx.beginPath();
        ctx.roundRect(-7.5, -11, 6, 22, 1.5);
        ctx.roundRect(1.5, -11, 6, 22, 1.5);
        ctx.fill();
      } else {
        // Play triangle with slightly softer points (not too sharp)
        ctx.beginPath();
        ctx.moveTo(-6.5, -8.5);
        ctx.lineTo(8, 0);
        ctx.lineTo(-6.5, 8.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Skip Forward (>>) - Right
      ctx.save();
      ctx.translate(btnCenter + 95, ctrlY);
      ctx.scale(2.8, 2.4);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.0;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.beginPath();
      // Left triangle
      ctx.moveTo(-9, -6);
      ctx.lineTo(-1, 0);
      ctx.lineTo(-9, 6);
      ctx.closePath();
      
      // Right triangle
      ctx.moveTo(1, -6);
      ctx.lineTo(9, 0);
      ctx.lineTo(1, 6);
      ctx.closePath();
      
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 7. Volume bar (with scaled up, beautiful speaker icons)
      const volY = ctrlY + 80;
      const volX = cardX + artPadding + 48; // Shift slider to give space for larger speakers
      const volWidth = cardWidth - (artPadding * 2) - 96;
      
      // Left low-volume speaker icon
      ctx.save();
      ctx.globalAlpha = 0.95;
      if (volumeLowImgRef.current && volumeLowImgRef.current.complete) {
        ctx.drawImage(volumeLowImgRef.current, 100, 50, 800, 800, volX - 40, volY - 9, 28, 28);
      } else {
        ctx.save();
        ctx.translate(volX - 38, volY - 11);
        ctx.scale(1.8, 1.8);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.moveTo(3, 7);
        ctx.lineTo(6, 7);
        ctx.lineTo(10, 3);
        ctx.lineTo(10, 15);
        ctx.lineTo(6, 11);
        ctx.lineTo(3, 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // Volume track bg
      ctx.beginPath();
      ctx.roundRect(volX, volY, volWidth, 10, 5);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fill();

      // Volume filled progress
      ctx.beginPath();
      ctx.roundRect(volX, volY, volWidth * volume, 10, 5);
      ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
      ctx.fill();

      // Right high-volume speaker icon
      ctx.save();
      ctx.globalAlpha = 0.5;
      if (volumeHighImgRef.current && volumeHighImgRef.current.complete) {
        ctx.drawImage(volumeHighImgRef.current, 0, 0, 512, 387, volX + volWidth + 12, volY - 9, 36, 28);
      } else {
        ctx.save();
        ctx.translate(volX + volWidth + 14, volY - 11);
        ctx.scale(1.8, 1.8);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(3, 7);
        ctx.lineTo(6, 7);
        ctx.lineTo(10, 3);
        ctx.lineTo(10, 15);
        ctx.lineTo(6, 11);
        ctx.lineTo(3, 11);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(10, 9, 2.5, -Math.PI / 3, Math.PI / 3, false);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(10, 9, 5.0, -Math.PI / 3, Math.PI / 3, false);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(10, 9, 7.5, -Math.PI / 3, Math.PI / 3, false);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      
      // 8. Device selector pill button at the bottom center (Dynamic centering & width based on custom name)
      ctx.font = '600 22px Inter';
      const textWidth = ctx.measureText(deviceName).width;
      
      const pillY = volY + 40;
      const pillWidth = 32 + 22 + 14 + textWidth + 32; 
      const pillHeight = 52;
      const pillX = btnCenter - pillWidth / 2;
      const pillRadius = 26;
 
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillWidth, pillHeight, pillRadius);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fill();
 
      // AirPlay Audio icon inside pill
      if (airplayImgRef.current && airplayImgRef.current.complete) {
        ctx.save();
        ctx.translate(pillX + 32 + 11, pillY + 24);
        ctx.scale(1.05, 1.05);
        ctx.globalAlpha = 1.0;
        const img = airplayImgRef.current;
        const ratio = img.naturalWidth / img.naturalHeight;
        ctx.drawImage(img, -12 * ratio, -12, 24 * ratio, 24);
        ctx.restore();
      }
 
      // Pill Text (dynamic deviceName)
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 22px Inter';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(deviceName, pillX + 66, pillY + 24);

      ctx.restore(); // Restore scaled canvas context

      // Visualizer logic (Hidden CSS fallback keeps DOM loop from crashing)
      // Render loop repeats at screen refresh rate
      animationFrameRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrame();
  };

  // Parse mm:ss time into seconds
  const parseTimeToSeconds = (timeStr) => {
    if (!timeStr) return 0;
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      const m = parseInt(parts[0], 10) || 0;
      const s = parseInt(parts[1], 10) || 0;
      return (m * 60) + s;
    }
    return parseFloat(timeStr) || 0;
  };

  const normalizeRenderRange = (startStr, endStr, durationSeconds = 0) => {
    let start = Math.max(0, parseTimeToSeconds(startStr));
    let end = Math.max(start + 0.1, parseTimeToSeconds(endStr));
    if (durationSeconds > 0) {
      if (start >= durationSeconds) {
        return { start: durationSeconds, end: durationSeconds };
      }
      end = Math.min(end, durationSeconds);
    }
    return { start, end };
  };

  const simpleFFT = (re, im) => {
    const n = re.length;
    if (n <= 1) return;
    
    const reEven = new Float32Array(n / 2);
    const imEven = new Float32Array(n / 2);
    const reOdd = new Float32Array(n / 2);
    const imOdd = new Float32Array(n / 2);
    
    for (let i = 0; i < n / 2; i++) {
      reEven[i] = re[2 * i];
      imEven[i] = im[2 * i];
      reOdd[i] = re[2 * i + 1];
      imOdd[i] = im[2 * i + 1];
    }
    
    simpleFFT(reEven, imEven);
    simpleFFT(reOdd, imOdd);
    
    for (let k = 0; k < n / 2; k++) {
      const angle = -2 * Math.PI * k / n;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const tRe = c * reOdd[k] - s * imOdd[k];
      const tIm = s * reOdd[k] + c * imOdd[k];
      
      re[k] = reEven[k] + tRe;
      im[k] = imEven[k] + tIm;
      re[k + n / 2] = reEven[k] - tRe;
      im[k + n / 2] = imEven[k] - tIm;
    }
  };

  const getFFTDataAtTime = (audioBuffer, time) => {
    const sampleRate = audioBuffer.sampleRate;
    const startIndex = Math.floor(time * sampleRate);
    const fftSize = 512;
    const re = fftReRef.current;
    const im = fftImRef.current;
    
    let channelData;
    if (audioBuffer.numberOfChannels > 0) {
      channelData = audioBuffer.getChannelData(0);
    } else {
      return new Uint8Array(fftSize / 2);
    }

    for (let i = 0; i < fftSize; i++) {
      const idx = startIndex + i;
      if (idx >= 0 && idx < channelData.length) {
        const windowValue = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
        re[i] = channelData[idx] * windowValue;
      } else {
        re[i] = 0;
      }
      im[i] = 0;
    }

    simpleFFT(re, im);

    const magnitudes = fftMagRef.current;
    for (let i = 0; i < fftSize / 2; i++) {
      const mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
      magnitudes[i] = Math.min(255, Math.floor(mag * 380));
    }

    return magnitudes;
  };

  // Video recording toggle handler (High definition canvas output with Web Audio context source)
  const toggleVideoRecord = async () => {
    if (isRecordingRef.current) {
      // If currently exporting, we can cancel
      cancelRender();
      return;
    }

    const player = getActivePlayer();
    if (!player || !player.src || !songFileRef.current) {
      alert("Please upload/load a song file (.mp3 / .wav) before exporting.");
      return;
    }

    isRecordingRef.current = true;
    setIsRecording(true);
    setRenderPhase('recording');
    setRenderProgress(0);
    setConvertProgress(0);
    setRenderError('');

    try {
      // 1. Wait for fonts
      try {
        await document.fonts.ready;
      } catch (e) {
        console.warn(e);
      }

      // 2. Load cover image or video
      let coverImgObj = null;
      let coverVidEl = null;

      if (isCoverVideo && coverVideoRef.current && coverVideoRef.current.readyState >= 2) {
        // Capture a still frame from cover video for blurred background
        const captureCanvas = document.createElement('canvas');
        captureCanvas.width = coverVideoRef.current.videoWidth || 640;
        captureCanvas.height = coverVideoRef.current.videoHeight || 640;
        const captureCtx = captureCanvas.getContext('2d');
        captureCtx.drawImage(coverVideoRef.current, 0, 0, captureCanvas.width, captureCanvas.height);

        coverImgObj = new Image();
        coverImgObj.src = captureCanvas.toDataURL('image/jpeg', 0.8);
        await new Promise(r => { coverImgObj.onload = r; if (coverImgObj.complete) r(); });

        // Dedicated video element for offline rendering
        coverVidEl = document.createElement('video');
        coverVidEl.src = artworkUrl;
        coverVidEl.muted = true;
        coverVidEl.playsInline = true;
        coverVidEl.preload = 'auto';
        await new Promise(r => {
          coverVidEl.onloadedmetadata = () => {
            if (coverVidEl.duration && !isNaN(coverVidEl.duration)) {
              r();
            }
          };
          coverVidEl.onloadeddata = r;
          coverVidEl.onerror = r;
          coverVidEl.load();
        });

        // Wait up to 200ms to ensure duration is populated
        let checkCount = 0;
        while ((isNaN(coverVidEl.duration) || coverVidEl.duration === 0) && checkCount < 20) {
          await new Promise(resolve => setTimeout(resolve, 10));
          checkCount++;
        }

        coverVidEl.currentTime = 0;
        await new Promise(r => { coverVidEl.onseeked = r; setTimeout(r, 100); });
      } else {
        const domImg = document.querySelector('.artwork-img');
        if (domImg && domImg.src && domImg.naturalWidth > 0) {
          coverImgObj = domImg;
        } else if (artworkUrl) {
          coverImgObj = new Image();
          coverImgObj.crossOrigin = 'anonymous';
          await new Promise((resolve) => {
            coverImgObj.onload = resolve;
            coverImgObj.onerror = resolve;
            coverImgObj.src = artworkUrl;
            if (coverImgObj.complete && coverImgObj.naturalWidth > 0) resolve();
          });
        }
      }

      const durationSeconds = player.duration || 0;
      const { start, end } = normalizeRenderRange(renderStart, renderEnd, durationSeconds);
      if (durationSeconds > 0 && start >= durationSeconds) {
        alert('Waktu render tidak valid.');
        isRecordingRef.current = false;
        setIsRecording(false);
        setRenderPhase('idle');
        return;
      }

      // Set up Canvas resolution based on Aspect Ratio and Resolution
      const canvas = canvasRef.current;
      let baseRes = 720;
      if (renderResolution === '1080') {
        baseRes = 1080;
      } else if (renderResolution === '1440') {
        baseRes = 1440;
      }

      if (renderAspectRatio === '16:9') {
        canvas.width = Math.round(baseRes * (16 / 9));
        canvas.height = baseRes;
      } else if (renderAspectRatio === '1:1') {
        canvas.width = baseRes;
        canvas.height = baseRes;
      } else { // 9:16 Portrait
        canvas.width = baseRes;
        canvas.height = Math.round(baseRes * (16 / 9));
      }
      const ctx = canvas.getContext('2d');

      // Initialize Capacitor Filesystem if running on mobile
      const { Filesystem, Directory } = window.Capacitor 
        ? await import('@capacitor/filesystem') 
        : { Filesystem: null, Directory: null };
      const cacheDir = (Directory && Directory.Cache) ? Directory.Cache : 'CACHE';
      const videoFilename = 'temp_input.webm';
      const audioFilename = 'temp_audio.wav';
      let videoFileUri = '';

      if (window.Capacitor) {
        try { await Filesystem.deleteFile({ path: videoFilename, directory: cacheDir }); } catch (e) {}
        try { await Filesystem.deleteFile({ path: audioFilename, directory: cacheDir }); } catch (e) {}

        await Filesystem.writeFile({
          path: videoFilename,
          data: '',
          directory: cacheDir,
          recursive: true
        });
        const uriResult = await Filesystem.getUri({ path: videoFilename, directory: cacheDir });
        videoFileUri = uriResult.uri;
      }

      setRenderError('Mendecode audio untuk ekspor offline...');
      // 3. Decode audio buffer to PCM
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const fileArrayBuffer = await songFileRef.current.arrayBuffer();
      const decodedBuffer = await audioCtx.decodeAudioData(fileArrayBuffer);

      setRenderError('Mengekspor video frame-demi-frame...');
      
      // 4. Set up Muxer and VideoEncoder
      const { Muxer, StreamTarget } = await import('webm-muxer');

      const pages = [];
      const pageSize = 1024 * 1024; // 1MB pages
      let fileLength = 0;
      let nativeWritePromise = Promise.resolve();

      const uint8ToBase64 = (u8) => {
        let binary = '';
        const len = u8.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(u8[i]);
        }
        return window.btoa(binary);
      };

      const writeData = (data, position) => {
        const end = position + data.length;
        if (end > fileLength) {
          fileLength = end;
        }

        if (window.Capacitor && videoFileUri) {
          const dataToSave = data.slice(); // Copy to avoid reuse race conditions
          nativeWritePromise = nativeWritePromise.then(async () => {
            try {
              const base64 = uint8ToBase64(dataToSave);
              const { registerPlugin } = await import('@capacitor/core');
              const VideoTranscoder = registerPlugin('VideoTranscoder');
              await VideoTranscoder.writeChunk({
                path: videoFileUri,
                data: base64,
                offset: position
              });
            } catch (err) {
              console.error("Failed to write native chunk:", err);
            }
          });
        } else {
          let remaining = data.length;
          let dataOffset = 0;
          let writeOffset = position;

          while (remaining > 0) {
            const pageIndex = Math.floor(writeOffset / pageSize);
            const pageStart = pageIndex * pageSize;
            const offsetInPage = writeOffset - pageStart;
            const bytesToPageEnd = pageSize - offsetInPage;
            const bytesToWrite = Math.min(remaining, bytesToPageEnd);

            if (!pages[pageIndex]) {
              pages[pageIndex] = new Uint8Array(pageSize);
            }

            pages[pageIndex].set(data.subarray(dataOffset, dataOffset + bytesToWrite), offsetInPage);

            remaining -= bytesToWrite;
            dataOffset += bytesToWrite;
            writeOffset += bytesToWrite;
          }
        }
      };

      let useMp4 = false;
      let hasAudioEncoder = false;
      if (!window.Capacitor && typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined') {
        try {
          const videoSupport = await VideoEncoder.isConfigSupported({
            codec: 'avc1.4d002a', // H.264 Main Profile
            width: canvas.width,
            height: canvas.height,
            bitrate: parseInt(renderBitrate, 10) * 1000
          });
          
          const audioSupport = await AudioEncoder.isConfigSupported({
            codec: 'mp4a.40.2', // AAC-LC
            numberOfChannels: decodedBuffer.numberOfChannels,
            sampleRate: decodedBuffer.sampleRate,
            bitrate: 128000
          });

          useMp4 = videoSupport.supported && audioSupport.supported;
          hasAudioEncoder = audioSupport.supported;
        } catch (e) {
          console.warn("MP4 check failed:", e);
        }
      }

      let muxer;
      let audioEncoder = null;

      if (useMp4) {
        const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
        let muxerOpts = {
          target: new ArrayBufferTarget(),
          video: {
            codec: 'avc',
            width: canvas.width,
            height: canvas.height
          },
          fastStart: 'in-memory'
        };

        if (hasAudioEncoder) {
          muxerOpts.audio = {
            codec: 'aac',
            numberOfChannels: decodedBuffer.numberOfChannels,
            sampleRate: decodedBuffer.sampleRate
          };

          audioEncoder = new AudioEncoder({
            output: (chunk, metadata) => muxer.addAudioChunk(chunk, metadata),
            error: (e) => console.error("AudioEncoder error:", e)
          });

          audioEncoder.configure({
            codec: 'mp4a.40.2', // AAC-LC
            numberOfChannels: decodedBuffer.numberOfChannels,
            sampleRate: decodedBuffer.sampleRate,
            bitrate: 128000
          });
        }

        muxer = new Muxer(muxerOpts);
      } else {
        const { Muxer, StreamTarget } = await import('webm-muxer');
        let muxerOpts = {
          target: new StreamTarget({
            onData: (data, position) => {
              writeData(data, position);
            }
          }),
          video: {
            codec: 'V_VP9',
            width: canvas.width,
            height: canvas.height
          }
        };

        const webHasAudioEncoder = !window.Capacitor && typeof window.AudioEncoder !== 'undefined' && typeof window.AudioData !== 'undefined';
        if (webHasAudioEncoder) {
          muxerOpts.audio = {
            codec: 'A_OPUS',
            numberOfChannels: decodedBuffer.numberOfChannels,
            sampleRate: decodedBuffer.sampleRate
          };

          audioEncoder = new AudioEncoder({
            output: (chunk, metadata) => muxer.addAudioChunk(chunk, metadata),
            error: (e) => console.error("AudioEncoder error:", e)
          });

          audioEncoder.configure({
            codec: 'opus',
            numberOfChannels: decodedBuffer.numberOfChannels,
            sampleRate: decodedBuffer.sampleRate,
            bitrate: 128000
          });
        }

        muxer = new Muxer(muxerOpts);
      }

      let encoder = new VideoEncoder({
        output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
        error: (e) => {
          console.error(e);
          throw e;
        }
      });

      const fps = parseInt(renderFps, 10);
      const encoderConfig = {
        codec: useMp4 ? 'avc1.4d002a' : 'vp09.00.10.08',
        width: canvas.width,
        height: canvas.height,
        bitrate: parseInt(renderBitrate, 10) * 1000
      };
      if (useMp4) {
        encoderConfig.avc = { format: 'avc' }; // Crucial: output AVCC (not Annex B) for MP4/Windows compatibility
      }
      encoder.configure(encoderConfig);

      // Prepare drawing resources once
      let bgFallbackColor = '#0a0a14';
      let cachedBgCanvas = null;
      if (coverImgObj && coverImgObj.complete && coverImgObj.naturalWidth !== 0) {
        const sampleCanvas = document.createElement('canvas');
        sampleCanvas.width = 4;
        sampleCanvas.height = 4;
        const sampleCtx = sampleCanvas.getContext('2d');
        sampleCtx.drawImage(coverImgObj, 0, 0, 4, 4);
        try {
          const px = sampleCtx.getImageData(1, 1, 1, 1).data;
          bgFallbackColor = `rgb(${Math.max(0, px[0] - 20)}, ${Math.max(0, px[1] - 20)}, ${Math.max(0, px[2] - 20)})`;
        } catch (e) {}

        cachedBgCanvas = document.createElement('canvas');
        cachedBgCanvas.width = 360;
        cachedBgCanvas.height = 640;
        const cachedBgCtx = cachedBgCanvas.getContext('2d');
        cachedBgCtx.fillStyle = bgFallbackColor;
        cachedBgCtx.fillRect(0, 0, 360, 640);
        cachedBgCtx.imageSmoothingEnabled = true;
        cachedBgCtx.imageSmoothingQuality = 'low';
        cachedBgCtx.save();
        cachedBgCtx.filter = 'blur(80px) saturate(1.7) brightness(1.05)';
        cachedBgCtx.drawImage(coverImgObj, -160, -160, 680, 960);
        cachedBgCtx.restore();
      }

      const offCanvas = document.createElement('canvas');
      offCanvas.width = 560;
      offCanvas.height = 60;
      const offCtx = offCanvas.getContext('2d');

      const timeStep = 1 / fps;
      let currentTime = start;
      let frameIndex = 0;
      const totalFrames = Math.ceil((end - start) / timeStep);

      const videoSmoothHeights = new Array(6).fill(0);
      const prevMagnitudes = new Float32Array(256);
      const renderStartTime = performance.now();
      let renderScrollOffset = 0;
      let renderScrollPauseTicks = Math.round(2 * fps);

      // Draw loop
      while (currentTime < end) {
        if (!isRecordingRef.current) {
          // Cancelled mid-process
          return;
        }

        if (coverVidEl) {
          // Synchronize cover video time to the output timeline (currentTime - start)
          let videoTime = 0;
          if (isLivePhotoEnabled) {
            const cycleTime = (currentTime - start) % 5.0;
            videoTime = cycleTime % (coverVidEl.duration || 5.0);
          } else {
            videoTime = (currentTime - start) % (coverVidEl.duration || 1.0);
          }
          coverVidEl.currentTime = videoTime;
          await new Promise(r => {
            coverVidEl.onseeked = r;
            // Fallback timeout in case seeked doesn't fire
            setTimeout(r, 20); 
          });
        }

        const rawMagnitudes = getFFTDataAtTime(decodedBuffer, currentTime);
        const magnitudes = new Uint8Array(256);
        const smoothing = 0.82;
        for (let i = 0; i < 256; i++) {
          const smoothedVal = prevMagnitudes[i] * smoothing + rawMagnitudes[i] * (1 - smoothing);
          magnitudes[i] = smoothedVal;
          prevMagnitudes[i] = smoothedVal;
        }
        
        // Render Frame
        ctx.fillStyle = bgFallbackColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if (cachedBgCanvas) {
          ctx.save();
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'low';
          // Draw cached blur canvas stretched to fill, with substantial overflow to prevent edge gaps
          ctx.drawImage(cachedBgCanvas, -30, -30, canvas.width + 60, canvas.height + 60);
          ctx.restore();
          ctx.fillStyle = 'rgba(10, 10, 20, 0.35)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // ===== LAYOUT BRANCH: Landscape (16:9) vs Portrait/Square =====
        const isLandscapeRender = renderAspectRatio === '16:9';

        if (isLandscapeRender) {
          // ===== LANDSCAPE 16:9 CARD LAYOUT =====
          // Virtual coordinate system: 1280x720 (wide)
          const vw = 1280;
          const vh = 720;
          const scale = canvas.width / vw;
          ctx.save();
          ctx.scale(scale, scale);

          // Card dimensions and positioning (matching TikTok aspect ratio & centered)
          const cardWidth = landscapeCardWidth;
          const cardHeight = landscapeCardHeight;
          const cardX = (vw - cardWidth) / 2;
          const cardY = (vh - cardHeight) / 2;
          const cardRadius = 45;

          // Draw card background
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.fill();
          ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 2.0;
          ctx.stroke();
          ctx.restore();

          // Cover art (left side, square, clean padding)
          const artPad = landscapeArtPadding;
          const artSize = cardHeight - artPad * 2;
          const artX = cardX + artPad;
          const artY = cardY + artPad;
          const artRadius = 23;

          const elapsed = currentTime - start;
          let imgAlpha = 0.0;
          if (isLivePhotoEnabled) {
            const cycleTime = elapsed % 5.0;
            if (cycleTime >= 3.0 && cycleTime < 3.5) {
              imgAlpha = (cycleTime - 3.0) / 0.5;
            } else if (cycleTime >= 3.5 && cycleTime < 4.5) {
              imgAlpha = 1.0;
            } else if (cycleTime >= 4.5 && cycleTime < 5.0) {
              imgAlpha = (5.0 - cycleTime) / 0.5;
            }
          }

          if (coverVidEl && coverVidEl.readyState >= 2) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(artX, artY, artSize, artSize, artRadius);
            ctx.clip();
            const cvw = coverVidEl.videoWidth || artSize;
            const cvh = coverVidEl.videoHeight || artSize;
            const mRatio = cvw / cvh;
            let sx = 0, sy = 0, sw = cvw, sh = cvh;
            if (mRatio > 1) { sw = cvh; sx = (cvw - sw) / 2; }
            else { sh = cvw; sy = (cvh - sh) / 2; }
            ctx.drawImage(coverVidEl, sx, sy, sw, sh, artX, artY, artSize, artSize);

            // Draw the static cover image over it with the computed alpha
            if (imgAlpha > 0) {
              ctx.save();
              ctx.globalAlpha = imgAlpha;
              if (coverImgObj && coverImgObj.complete && coverImgObj.naturalWidth !== 0) {
                const imgRatio = coverImgObj.naturalWidth / coverImgObj.naturalHeight;
                let isx = 0, isy = 0, isw = coverImgObj.naturalWidth, ish = coverImgObj.naturalHeight;
                if (imgRatio > 1) { isw = ish; isx = (coverImgObj.naturalWidth - isw) / 2; }
                else { ish = isw; isy = (coverImgObj.naturalHeight - ish) / 2; }
                ctx.drawImage(coverImgObj, isx, isy, isw, ish, artX, artY, artSize, artSize);
              }
              ctx.restore();
            }
            ctx.restore();
          } else if (coverImgObj && coverImgObj.complete && coverImgObj.naturalWidth !== 0) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(artX, artY, artSize, artSize, artRadius);
            ctx.clip();
            const mRatio = coverImgObj.naturalWidth / coverImgObj.naturalHeight;
            let sx = 0, sy = 0, sw = coverImgObj.naturalWidth, sh = coverImgObj.naturalHeight;
            if (mRatio > 1) { sw = sh; sx = (coverImgObj.naturalWidth - sw) / 2; }
            else { sh = sw; sy = (coverImgObj.naturalHeight - sh) / 2; }
            ctx.drawImage(coverImgObj, sx, sy, sw, sh, artX, artY, artSize, artSize);
            ctx.restore();
          }

          // Right side details area
          const detailsX = artX + artSize + landscapeDetailsGap;
          const detailsW = cardX + cardWidth - detailsX - 32;
          const detailsTop = cardY + 36;

          // Song title
          ctx.fillStyle = '#ffffff';
          ctx.font = '800 30px Inter';
          ctx.textAlign = 'left';
          const maxTitleW = detailsW - 20;
          const titleW = ctx.measureText(songTitle).width;
          
          if (titleW > maxTitleW) {
            offCtx.clearRect(0, 0, maxTitleW, 60);
            offCtx.globalCompositeOperation = 'source-over';
            offCtx.fillStyle = '#ffffff';
            offCtx.font = '800 30px Inter';
            offCtx.textAlign = 'left';
            offCtx.textBaseline = 'middle';
            offCtx.fillText(songTitle, renderScrollOffset, 30);
            offCtx.fillText(songTitle, renderScrollOffset + titleW + 100, 30);
            offCtx.globalCompositeOperation = 'destination-in';
            const grad = offCtx.createLinearGradient(0, 0, maxTitleW, 0);
            if (renderScrollPauseTicks > 0 || Math.abs(renderScrollOffset) < 1) {
              grad.addColorStop(0, 'rgba(0,0,0,1)');
              grad.addColorStop(0.9, 'rgba(0,0,0,1)');
              grad.addColorStop(1, 'rgba(0,0,0,0)');
            } else {
              grad.addColorStop(0, 'rgba(0,0,0,0)');
              grad.addColorStop(0.08, 'rgba(0,0,0,1)');
              grad.addColorStop(0.92, 'rgba(0,0,0,1)');
              grad.addColorStop(1, 'rgba(0,0,0,0)');
            }
            offCtx.fillStyle = grad;
            offCtx.fillRect(0, 0, maxTitleW, 60);
            ctx.drawImage(offCanvas, 0, 0, maxTitleW, 60, detailsX, detailsTop - 20, maxTitleW, 60);
            const scrollStep = 36 / fps;
            if (renderScrollPauseTicks > 0) {
              renderScrollPauseTicks--;
            } else {
              renderScrollOffset -= scrollStep;
              if (Math.abs(renderScrollOffset) >= titleW + 100) {
                renderScrollOffset = 0;
                renderScrollPauseTicks = Math.round(2 * fps);
              }
            }
          } else {
            ctx.fillText(songTitle, detailsX, detailsTop + 14);
          }

          // Artist
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.font = '500 22px Inter';
          ctx.fillText(songArtist, detailsX, detailsTop + 48);

          // Spectrum (right-aligned with the artist line)
          const specBarCount = 6;
          const specGap = 3;
          const specHeight = 36;
          const specBarWidth = 2.5;
          const specTotalWidth = specBarCount * specBarWidth + (specBarCount - 1) * specGap;
          const specX = detailsX + detailsW - specTotalWidth;
          const specCenterY = detailsTop + 42; // Aligned near the artist name
          for (let i = 0; i < specBarCount; i++) {
            let val = 0;
            if (i === 0) { val = (magnitudes[0] + magnitudes[1]) / 2; }
            else { const freqBins = [20, 36, 56, 80, 110]; val = magnitudes[freqBins[i - 1] || 20] || 0; }
            const normalized = Math.pow(val / 255, 1.8) * (i === 1 ? 0.22 : 0.65);
            const targetHeight = normalized * (specHeight / 2);
            const decayRate = 0.75;
            if (targetHeight > videoSmoothHeights[i]) { videoSmoothHeights[i] += (targetHeight - videoSmoothHeights[i]) * 1.0; }
            else { videoSmoothHeights[i] -= (videoSmoothHeights[i] - targetHeight) * decayRate; }
            const halfH = Math.max(1.5, videoSmoothHeights[i]);
            const bx = specX + i * (specBarWidth + specGap);
            ctx.beginPath();
            ctx.roundRect(bx, specCenterY - halfH, specBarWidth, halfH, 1);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fill();
            ctx.beginPath();
            ctx.roundRect(bx, specCenterY, specBarWidth, halfH, 1);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fill();
          }

          // Seekbar
          const seekY = detailsTop + 95;
          const seekWidth = detailsW;
          ctx.beginPath();
          ctx.roundRect(detailsX, seekY, seekWidth, 8, 4);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.fill();
          const progressPercent = durationSeconds > 0 ? (currentTime / durationSeconds) : 0;
          ctx.beginPath();
          ctx.roundRect(detailsX, seekY, seekWidth * progressPercent, 8, 4);
          ctx.fillStyle = '#ffffff';
          ctx.fill();

          // Time labels
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.font = '500 18px Inter';
          ctx.textAlign = 'left';
          ctx.fillText(formatTime(currentTime), detailsX, seekY + 34);
          ctx.textAlign = 'right';
          ctx.fillText(`-${formatTime(Math.max(0, durationSeconds - currentTime))}`, detailsX + seekWidth, seekY + 34);

          // Controls (Centered backward, play/pause, forward)
          const ctrlY = seekY + 84;
          const btnCenter = detailsX + detailsW / 2;

          // Star Icon on the far left of the controls row
          ctx.save();
          ctx.translate(detailsX + 20, ctrlY);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.lineWidth = 2.2;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.beginPath();
          const spikes = 5;
          const outerRadius = 16;
          const innerRadius = 7;
          let rot = Math.PI / 2 * 3;
          const step = Math.PI / spikes;
          ctx.moveTo(0, -outerRadius);
          for (let i = 0; i < spikes; i++) {
            ctx.lineTo(Math.cos(rot) * outerRadius, Math.sin(rot) * outerRadius);
            rot += step;
            ctx.lineTo(Math.cos(rot) * innerRadius, Math.sin(rot) * innerRadius);
            rot += step;
          }
          ctx.closePath();
          ctx.stroke();
          ctx.restore();

          // Skip back
          ctx.save();
          ctx.translate(btnCenter - 80, ctrlY);
          ctx.scale(2.4, 2.0);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.0;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-1, -6); ctx.lineTo(-9, 0); ctx.lineTo(-1, 6); ctx.closePath();
          ctx.moveTo(9, -6); ctx.lineTo(1, 0); ctx.lineTo(9, 6); ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.restore();

          // Pause icon
          ctx.save();
          ctx.translate(btnCenter, ctrlY);
          ctx.scale(2.2, 2.2);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.roundRect(-7.5, -11, 6, 22, 1.5);
          ctx.roundRect(1.5, -11, 6, 22, 1.5);
          ctx.fill();
          ctx.restore();

          // Skip forward
          ctx.save();
          ctx.translate(btnCenter + 80, ctrlY);
          ctx.scale(2.4, 2.0);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.0;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-9, -6); ctx.lineTo(-1, 0); ctx.lineTo(-9, 6); ctx.closePath();
          ctx.moveTo(1, -6); ctx.lineTo(9, 0); ctx.lineTo(1, 6); ctx.closePath();
          ctx.fill(); ctx.stroke();
           ctx.restore();

          // Volume bar
          const volY = ctrlY + 65 + landscapeBottomOffset;
          const volX = detailsX + 40;
          const volWidth = detailsW - 80;

          ctx.save();
          ctx.globalAlpha = 0.95;
          if (volumeLowImgRef.current && volumeLowImgRef.current.complete) {
            ctx.drawImage(volumeLowImgRef.current, 100, 50, 800, 800, volX - 32, volY - 7, 22, 22);
          }
          ctx.restore();

          ctx.beginPath();
          ctx.roundRect(volX, volY, volWidth, 8, 4);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.fill();
          ctx.beginPath();
          ctx.roundRect(volX, volY, volWidth * volume, 8, 4);
          ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
          ctx.fill();

          ctx.save();
          ctx.globalAlpha = 0.5;
          if (volumeHighImgRef.current && volumeHighImgRef.current.complete) {
            ctx.drawImage(volumeHighImgRef.current, 0, 0, 512, 387, volX + volWidth + 10, volY - 7, 28, 22);
          }
          ctx.restore();

          // Device pill
          ctx.font = '600 18px Inter';
          const textW = ctx.measureText(deviceName).width;
          const pillY = volY + 30;
          const pillW = 26 + 18 + 10 + textW + 26;
          const pillH = 42;
          const pillX = btnCenter - pillW / 2;
          ctx.beginPath();
          ctx.roundRect(pillX, pillY, pillW, pillH, 21);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.fill();

          if (airplayImgRef.current && airplayImgRef.current.complete) {
            ctx.save();
            ctx.translate(pillX + 26 + 9, pillY + 21);
            ctx.scale(0.9, 0.9);
            ctx.globalAlpha = 1.0;
            const img = airplayImgRef.current;
            const ratio = img.naturalWidth / img.naturalHeight;
            ctx.drawImage(img, -10 * ratio, -10, 20 * ratio, 20);
            ctx.restore();
          }

          ctx.fillStyle = '#ffffff';
          ctx.font = '600 18px Inter';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(deviceName, pillX + 52, pillY + 21);

          ctx.restore(); // Restore scaled coordinates

        } else {
          // ===== PORTRAIT / SQUARE CARD LAYOUT (original) =====
          const scale = canvas.height / 1280;
          const offsetX = (canvas.width - 720 * scale) / 2;
          ctx.save();
          ctx.translate(offsetX, 0);
          ctx.scale(scale, scale);

          const cardWidth = 560;
          const cardHeight = 960;
          const cardX = (720 - cardWidth) / 2;
          const cardY = (1280 - cardHeight) / 2;
          const cardRadius = 75;

          ctx.save();
          ctx.beginPath();
          ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.fill();
          ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 2.0;
          ctx.stroke();
          ctx.restore();

          const artPadding = 35;
          const artSize = cardWidth - (artPadding * 2);
          const artX = cardX + artPadding;
          const artY = cardY + artPadding;
          const artRadius = 20;

          const elapsed = currentTime - start;
          let imgAlpha = 0.0;
          if (isLivePhotoEnabled) {
            const cycleTime = elapsed % 5.0;
            if (cycleTime >= 3.0 && cycleTime < 3.5) {
              imgAlpha = (cycleTime - 3.0) / 0.5;
            } else if (cycleTime >= 3.5 && cycleTime < 4.5) {
              imgAlpha = 1.0;
            } else if (cycleTime >= 4.5 && cycleTime < 5.0) {
              imgAlpha = (5.0 - cycleTime) / 0.5;
            }
          }

          if (coverVidEl && coverVidEl.readyState >= 2) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(artX, artY, artSize, artSize, artRadius);
            ctx.clip();
            const vw = coverVidEl.videoWidth || artSize;
            const vh = coverVidEl.videoHeight || artSize;
            const mRatio = vw / vh;
            let sx = 0, sy = 0, sw = vw, sh = vh;
            if (mRatio > 1) { sw = vh; sx = (vw - sw) / 2; }
            else { sh = vw; sy = (vh - sh) / 2; }
            ctx.drawImage(coverVidEl, sx, sy, sw, sh, artX, artY, artSize, artSize);

            // Draw the static cover image over it with the computed alpha
            if (imgAlpha > 0) {
              ctx.save();
              ctx.globalAlpha = imgAlpha;
              if (coverImgObj && coverImgObj.complete && coverImgObj.naturalWidth !== 0) {
                const imgRatio = coverImgObj.naturalWidth / coverImgObj.naturalHeight;
                let isx = 0, isy = 0, isw = coverImgObj.naturalWidth, ish = coverImgObj.naturalHeight;
                if (imgRatio > 1) { isw = ish; isx = (coverImgObj.naturalWidth - isw) / 2; }
                else { ish = isw; isy = (coverImgObj.naturalHeight - ish) / 2; }
                ctx.drawImage(coverImgObj, isx, isy, isw, ish, artX, artY, artSize, artSize);
              }
              ctx.restore();
            }
            ctx.restore();
          } else if (coverImgObj && coverImgObj.complete && coverImgObj.naturalWidth !== 0) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(artX, artY, artSize, artSize, artRadius);
            ctx.clip();
            const mRatio = coverImgObj.naturalWidth / coverImgObj.naturalHeight;
            let sx = 0, sy = 0, sw = coverImgObj.naturalWidth, sh = coverImgObj.naturalHeight;
            if (mRatio > 1) { sw = coverImgObj.naturalHeight; sx = (coverImgObj.naturalWidth - sw) / 2; }
            else { sh = coverImgObj.naturalWidth; sy = (coverImgObj.naturalHeight - sh) / 2; }
            ctx.drawImage(coverImgObj, sx, sy, sw, sh, artX, artY, artSize, artSize);
            ctx.restore();
          }

          const infoY = artY + artSize + 60;
          ctx.fillStyle = '#ffffff';
          ctx.font = '800 22px Inter';
          ctx.textAlign = 'left';

          const maxTextWidth = cardWidth - (artPadding * 2) - 80;
          const titleWidth = ctx.measureText(songTitle).width;
          
          if (titleWidth > maxTextWidth) {
            offCtx.clearRect(0, 0, maxTextWidth, 60);
            offCtx.globalCompositeOperation = 'source-over';
            offCtx.fillStyle = '#ffffff';
            offCtx.font = '800 22px Inter';
            offCtx.textAlign = 'left';
            offCtx.textBaseline = 'middle';
            const textY = 30;
            offCtx.fillText(songTitle, renderScrollOffset, textY);
            offCtx.fillText(songTitle, renderScrollOffset + titleWidth + 100, textY);
            offCtx.globalCompositeOperation = 'destination-in';
            const grad = offCtx.createLinearGradient(0, 0, maxTextWidth, 0);
            if (renderScrollPauseTicks > 0 || Math.abs(renderScrollOffset) < 1) {
              grad.addColorStop(0, 'rgba(0,0,0,1)');
              grad.addColorStop(0.9, 'rgba(0,0,0,1)');
              grad.addColorStop(1, 'rgba(0,0,0,0)');
            } else {
              grad.addColorStop(0, 'rgba(0,0,0,0)');
              grad.addColorStop(0.08, 'rgba(0,0,0,1)');
              grad.addColorStop(0.92, 'rgba(0,0,0,1)');
              grad.addColorStop(1, 'rgba(0,0,0,0)');
            }
            offCtx.fillStyle = grad;
            offCtx.fillRect(0, 0, maxTextWidth, 60);
            ctx.drawImage(offCanvas, 0, 0, maxTextWidth, 60, cardX + artPadding, infoY - 30, maxTextWidth, 60);
            const scrollStep = 36 / fps;
            if (renderScrollPauseTicks > 0) {
              renderScrollPauseTicks--;
            } else {
              renderScrollOffset -= scrollStep;
              if (Math.abs(renderScrollOffset) >= titleWidth + 100) {
                renderScrollOffset = 0;
                renderScrollPauseTicks = Math.round(2 * fps);
              }
            }
          } else {
            ctx.fillText(songTitle, cardX + artPadding, infoY);
          }

          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.font = '500 20px Inter';
          ctx.fillText(songArtist, cardX + artPadding, infoY + 30);

          // Draw Spectrum
          const specBarCount = 6;
          const specGap = 3;
          const specHeight = 40;
          const specBarWidth = 2.5;
          const specTotalWidth = specBarCount * specBarWidth + (specBarCount - 1) * specGap;
          const specX = cardX + cardWidth - artPadding - specTotalWidth;
          const specCenterY = infoY + 10;

          for (let i = 0; i < specBarCount; i++) {
            let val = 0;
            if (i === 0) {
              let bassSum = magnitudes[0] + magnitudes[1];
              val = bassSum / 2;
            } else {
              const freqBins = [20, 36, 56, 80, 110];
              val = magnitudes[freqBins[i - 1] || 20] || 0;
            }
            const normalized = Math.pow(val / 255, 1.8) * (i === 1 ? 0.22 : 0.65);
            const targetHeight = normalized * (specHeight / 2);
            const decayRate = 0.75;
            if (targetHeight > videoSmoothHeights[i]) {
              videoSmoothHeights[i] += (targetHeight - videoSmoothHeights[i]) * 1.0;
            } else {
              videoSmoothHeights[i] -= (videoSmoothHeights[i] - targetHeight) * decayRate;
            }
            const halfH = Math.max(1.5, videoSmoothHeights[i]);
            const bx = specX + i * (specBarWidth + specGap);

            ctx.beginPath();
            ctx.roundRect(bx, specCenterY - halfH, specBarWidth, halfH, 1);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fill();

            ctx.beginPath();
            ctx.roundRect(bx, specCenterY, specBarWidth, halfH, 1);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fill();
          }

          // Seekbar
          const seekY = infoY + 80;
          const seekWidth = cardWidth - (artPadding * 2);
          ctx.beginPath();
          ctx.roundRect(cardX + artPadding, seekY, seekWidth, 12, 6);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.fill();

          const progressPercent = durationSeconds > 0 ? (currentTime / durationSeconds) : 0;
          ctx.beginPath();
          ctx.roundRect(cardX + artPadding, seekY, seekWidth * progressPercent, 12, 6);
          ctx.fillStyle = '#ffffff';
          ctx.fill();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.font = '500 18px Inter';
          ctx.textAlign = 'left';
          ctx.fillText(formatTime(currentTime), cardX + artPadding, seekY + 48);

          ctx.textAlign = 'right';
          ctx.fillText(`-${formatTime(Math.max(0, durationSeconds - currentTime))}`, cardX + cardWidth - artPadding, seekY + 48);

          // Navigation Controls
          const ctrlY = seekY + 90;
          const btnCenter = cardX + cardWidth / 2;

          // Star
          ctx.save();
          ctx.translate(btnCenter - 190, ctrlY);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 2.5;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.beginPath();
          const spikes = 5;
          const outerRadius = 22;
          const innerRadius = 10;
          let rot = Math.PI / 2 * 3;
          const step = Math.PI / spikes;
          ctx.moveTo(0, -outerRadius);
          for (let i = 0; i < spikes; i++) {
            let x = Math.cos(rot) * outerRadius;
            let y = Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;
            x = Math.cos(rot) * innerRadius;
            y = Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
          }
          ctx.closePath();
          ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.translate(btnCenter - 95, ctrlY);
          ctx.scale(2.8, 2.4);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.0;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-1, -6); ctx.lineTo(-9, 0); ctx.lineTo(-1, 6); ctx.closePath();
          ctx.moveTo(9, -6); ctx.lineTo(1, 0); ctx.lineTo(9, 6); ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.translate(btnCenter, ctrlY);
          ctx.scale(2.5, 2.5);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.roundRect(-7.5, -11, 6, 22, 1.5);
          ctx.roundRect(1.5, -11, 6, 22, 1.5);
          ctx.fill();
          ctx.restore();

          ctx.save();
          ctx.translate(btnCenter + 95, ctrlY);
          ctx.scale(2.8, 2.4);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.0;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-9, -6); ctx.lineTo(-1, 0); ctx.lineTo(-9, 6); ctx.closePath();
          ctx.moveTo(1, -6); ctx.lineTo(9, 0); ctx.lineTo(1, 6); ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.restore();

          // Volume bar
          const volY = ctrlY + 80;
          const volX = cardX + artPadding + 48;
          const volWidth = cardWidth - (artPadding * 2) - 96;

          ctx.save();
          ctx.globalAlpha = 0.95;
          if (volumeLowImgRef.current && volumeLowImgRef.current.complete) {
            ctx.drawImage(volumeLowImgRef.current, 100, 50, 800, 800, volX - 40, volY - 9, 28, 28);
          } else {
            ctx.save();
            ctx.translate(volX - 38, volY - 11);
            ctx.scale(1.8, 1.8);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.beginPath();
            ctx.moveTo(3, 7); ctx.lineTo(6, 7); ctx.lineTo(10, 3); ctx.lineTo(10, 15); ctx.lineTo(6, 11); ctx.lineTo(3, 11);
            ctx.closePath(); ctx.fill();
            ctx.restore();
          }
          ctx.restore();

          ctx.beginPath();
          ctx.roundRect(volX, volY, volWidth, 10, 5);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.fill();
          ctx.beginPath();
          ctx.roundRect(volX, volY, volWidth * volume, 10, 5);
          ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
          ctx.fill();

          ctx.save();
          ctx.globalAlpha = 0.5;
          if (volumeHighImgRef.current && volumeHighImgRef.current.complete) {
            ctx.drawImage(volumeHighImgRef.current, 0, 0, 512, 387, volX + volWidth + 12, volY - 9, 36, 28);
          } else {
            ctx.save();
            ctx.translate(volX + volWidth + 14, volY - 11);
            ctx.scale(1.8, 1.8);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(3, 7); ctx.lineTo(6, 7); ctx.lineTo(10, 3); ctx.lineTo(10, 15); ctx.lineTo(6, 11); ctx.lineTo(3, 11);
            ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.arc(10, 9, 2.5, -Math.PI / 3, Math.PI / 3, false); ctx.stroke();
            ctx.beginPath(); ctx.arc(10, 9, 5.0, -Math.PI / 3, Math.PI / 3, false); ctx.stroke();
            ctx.beginPath(); ctx.arc(10, 9, 7.5, -Math.PI / 3, Math.PI / 3, false); ctx.stroke();
            ctx.restore();
          }
          ctx.restore();

          // Device Selector Pill
          ctx.font = '600 22px Inter';
          const textW = ctx.measureText(deviceName).width;
          const pillY = volY + 40;
          const pillW = 32 + 22 + 14 + textW + 32;
          const pillH = 52;
          const pillX = btnCenter - pillW / 2;
          ctx.beginPath();
          ctx.roundRect(pillX, pillY, pillW, pillH, 26);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.fill();

          if (airplayImgRef.current && airplayImgRef.current.complete) {
            ctx.save();
            ctx.translate(pillX + 32 + 11, pillY + 24);
            ctx.scale(1.05, 1.05);
            ctx.globalAlpha = 1.0;
            const img = airplayImgRef.current;
            const ratio = img.naturalWidth / img.naturalHeight;
            ctx.drawImage(img, -12 * ratio, -12, 24 * ratio, 24);
            ctx.restore();
          }

          ctx.fillStyle = '#ffffff';
          ctx.font = '600 22px Inter';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(deviceName, pillX + 66, pillY + 24);

          ctx.restore(); // Restore scaled coordinates
        }

        // Wait if hardware encoder queue is backing up to prevent Out Of Memory crashes
        while (encoder.encodeQueueSize > 5) {
          await new Promise(resolve => setTimeout(resolve, 15));
        }

        // Create frame and encode
        const timestampUs = Math.round((currentTime - start) * 1e6);
        const videoFrame = new VideoFrame(canvas, { timestamp: timestampUs });
        encoder.encode(videoFrame, { keyFrame: frameIndex % 30 === 0 });
        videoFrame.close();

        // Encode audio chunk on browser web version
        if (audioEncoder && window.AudioData) {
          try {
            const sampleRate = decodedBuffer.sampleRate;
            const numChannels = decodedBuffer.numberOfChannels;
            const samplesToEncode = Math.floor(timeStep * sampleRate);
            const startSample = Math.floor(currentTime * sampleRate);
            
            const planarBuffer = new Float32Array(samplesToEncode * numChannels);
            
            let targetVolume = volume;
            if (isAudioFadeEnabledRef.current) {
              const fadeDuration = parseFloat(audioFadeDurationRef.current) || 1.0;
              const startSecs = start;
              const limitSecs = end;
              if (currentTime < startSecs + fadeDuration) {
                targetVolume = volume * (Math.max(0, currentTime - startSecs) / fadeDuration);
              } else if (currentTime > limitSecs - fadeDuration) {
                targetVolume = volume * (Math.max(0, limitSecs - currentTime) / fadeDuration);
              }
            }

            for (let channel = 0; channel < numChannels; channel++) {
              const channelData = decodedBuffer.getChannelData(channel);
              const offset = channel * samplesToEncode;
              for (let s = 0; s < samplesToEncode; s++) {
                const srcIdx = startSample + s;
                let sampleVal = (srcIdx < channelData.length) ? channelData[srcIdx] : 0;
                planarBuffer[offset + s] = sampleVal * targetVolume;
              }
            }

            const audioData = new AudioData({
              format: 'f32-planar',
              sampleRate: sampleRate,
              numberOfFrames: samplesToEncode,
              numberOfChannels: numChannels,
              timestamp: timestampUs,
              data: planarBuffer
            });

            audioEncoder.encode(audioData);
            audioData.close();
          } catch (audioEncErr) {
            console.error("Audio encoding error during frame:", audioEncErr);
          }
        }

        // Update progress
        const currentProgress = Math.min(100, Math.round((frameIndex / totalFrames) * 100));
        setRenderProgress(currentProgress);

        currentTime += timeStep;
        frameIndex++;

        // Calculate estimated time remaining
        const elapsedMs = performance.now() - renderStartTime;
        const progressFraction = frameIndex / totalFrames;
        if (progressFraction > 0.03) {
          const totalEstimatedTimeMs = elapsedMs / progressFraction;
          const remainingTimeMs = totalEstimatedTimeMs - elapsedMs;
          const remainingSeconds = Math.ceil(remainingTimeMs / 1000);
          setEstimatedTimeRemaining(remainingSeconds);
        } else {
          setEstimatedTimeRemaining(null);
        }

        if (frameIndex % 8 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      setRenderError('Menyelesaikan encoding video...');
      await encoder.flush();
      if (audioEncoder) {
        await audioEncoder.flush();
      }
      muxer.finalize();

      if (window.Capacitor) {
        setRenderError('Menunggu penulisan native video selesai...');
        await nativeWritePromise;
      }

      let recordedBlob = null;
      if (!window.Capacitor) {
        if (useMp4) {
          const { buffer } = muxer.target;
          recordedBlob = new Blob([buffer], { type: 'video/mp4' });
          setRenderFileSize(recordedBlob.size);
        } else {
          // Reconstruct WebM recordedBlob from pages array using zero extra contiguous RAM
          const webmBlobs = [];
          let remainingBytes = fileLength;
          let pageIdx = 0;
          while (remainingBytes > 0) {
            const bytesFromPage = Math.min(remainingBytes, pageSize);
            if (pages[pageIdx]) {
              webmBlobs.push(pages[pageIdx].subarray(0, bytesFromPage));
            } else {
              webmBlobs.push(new Uint8Array(bytesFromPage));
            }
            remainingBytes -= bytesFromPage;
            pageIdx++;
          }
          recordedBlob = new Blob(webmBlobs, { type: 'video/webm' });
          setRenderFileSize(recordedBlob.size);
        }
      } else {
        setRenderFileSize(fileLength);
      }

      // Now merge/transcode
      if (window.Capacitor) {
        setRenderPhase('converting');
        setConvertProgress(40); // Immediately 40% since video file is already written
        
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const cacheDir = (Directory && Directory.Cache) ? Directory.Cache : 'CACHE';
        
        const videoFilename = 'temp_input.webm';
        const audioFilename = 'temp_audio.wav';

        // Render the faded, clipped WAV audio in Javascript
        setRenderError('Memproses efek volume fade in/out...');
        const fadedAudioBuffer = await renderFadedAudio(
          decodedBuffer,
          start,
          end,
          volume,
          isAudioFadeEnabled,
          parseFloat(audioFadeDuration) || 1.0
        );
        const wavBuffer = bufferToWav(fadedAudioBuffer);

        // Write processed WAV audio to native filesystem incrementally in chunks
        setRenderError('Menyimpan audio hasil pemrosesan...');
        const writeChunkSize = 2 * 1024 * 1024; // 2MB
        const wavBytes = new Uint8Array(wavBuffer);
        let writtenAudioBytes = 0;
        let isFirstAudioWrite = true;

        while (writtenAudioBytes < wavBytes.length) {
          const sizeToWrite = Math.min(wavBytes.length - writtenAudioBytes, writeChunkSize);
          const chunkSlice = wavBytes.subarray(writtenAudioBytes, writtenAudioBytes + sizeToWrite);
          
          const chunkBlob = new Blob([chunkSlice]);
          const chunkBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(chunkBlob);
          });

          if (isFirstAudioWrite) {
            await Filesystem.writeFile({
              path: audioFilename,
              data: chunkBase64,
              directory: cacheDir,
              recursive: true
            });
            isFirstAudioWrite = false;
          } else {
            await Filesystem.appendFile({
              path: audioFilename,
              data: chunkBase64,
              directory: cacheDir
            });
          }

          writtenAudioBytes += sizeToWrite;
        }
        setConvertProgress(70);

        const videoUriResult = await Filesystem.getUri({ path: videoFilename, directory: cacheDir });
        const audioUriResult = await Filesystem.getUri({ path: audioFilename, directory: cacheDir });

        const sanitizedTitle = (songTitle || 'senux_player').replace(/[^a-zA-Z0-9_-]/g, '_');
        const outputFilename = `${sanitizedTitle}_render.mp4`;
        try { await Filesystem.deleteFile({ path: outputFilename, directory: cacheDir }); } catch (e) {}
        const outputUriResult = await Filesystem.getUri({ path: outputFilename, directory: cacheDir });

        setConvertProgress(80);
        setRenderError('Menggabungkan video & audio secara native (Muxing)...');
        
        const { registerPlugin } = await import('@capacitor/core');
        const VideoTranscoder = registerPlugin('VideoTranscoder');
        
        const transcodeResult = await VideoTranscoder.transcode({
          videoPath: videoUriResult.uri,
          audioPath: audioUriResult.uri,
          audioStartMs: 0, // Already clipped!
          audioEndMs: Math.round((end - start) * 1000), // Mux full duration of wav
          outputPath: outputUriResult.uri
        });

        let outputSize = 0;
        try {
          const statResult = await Filesystem.stat({ path: outputFilename, directory: cacheDir });
          outputSize = statResult.size || 0;
        } catch (e) {}

        // Clean up temp
        try { await Filesystem.deleteFile({ path: videoFilename, directory: cacheDir }); } catch (e) {}
        try { await Filesystem.deleteFile({ path: audioFilename, directory: cacheDir }); } catch (e) {}

        setNativeRenderUri(transcodeResult.outputPath);
        setRenderFileSize(outputSize);
        setConvertProgress(100);
        setRenderPhase('done');
        setRenderError('');
      } else {
        // Web browser: fallback to downloading the silent WebM
        setRenderResult(recordedBlob);
        setRenderFileSize(recordedBlob.size);
        setRenderPhase('done');
        setRenderError('Ekspor WebM selesai (Browser web tidak mendukung muxing audio native).');
      }
    } catch (error) {
      console.error("Export error:", error);
      setRenderPhase('error');
      setRenderError('Gagal melakukan ekspor video: ' + error.message);
      setRenderErrorDetails(error.stack || error.message || String(error));
      setIsRecording(false);
    }
  };

  useEffect(() => {
    toggleVideoRecordRef.current = toggleVideoRecord;
  }, [toggleVideoRecord]);

  // Cancel rendering mid-process
  const cancelRender = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setIsPlaying(false);
    
    const player = getActivePlayer();
    if (player) {
      if (!player.paused) {
        player.pause();
      }
      player.volume = volume; // Restore user's default volume
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setRenderPhase('idle');
  };

  // Format file size in human readable format
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Download the final rendered file
  const handleDownloadRender = async () => {
    if (window.Capacitor && nativeRenderUri) {
      try {
        setRenderError('Menyimpan ke folder Download...');
        const { registerPlugin } = await import('@capacitor/core');
        const VideoTranscoder = registerPlugin('VideoTranscoder');
        
        const sanitizedTitle = (songTitle || 'senux_player').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `${sanitizedTitle}_render.mp4`;

        const result = await VideoTranscoder.saveToDownloads({
          videoPath: nativeRenderUri,
          filename: filename
        });
        
        if (result.success) {
          setRenderError('');
          alert('Video berhasil disimpan di folder Download ponsel Anda!');
        } else {
          throw new Error('Gagal menyimpan file.');
        }
      } catch (err) {
        console.error("Gagal menyimpan ke folder Download:", err);
        setRenderError('Gagal menyimpan: ' + err.message);
        
        // Fallback to share sheet if direct save fails
        try {
          const { Share } = await import('@capacitor/share');
          await Share.share({
            title: 'Simpan Video',
            text: 'Simpan video hasil render Anda',
            url: nativeRenderUri,
            dialogTitle: 'Simpan Video'
          });
          setRenderError('');
        } catch (shareErr) {
          console.error("Gagal share fallback:", shareErr);
        }
      }
      return;
    }

    if (!renderResult) return;
    const ext = renderResult.type.includes('mp4') ? 'mp4' : 'webm';
    
    // Sanitize filename strictly: only allow letters, numbers, dashes, and underscores
    const sanitizedTitle = (songTitle || 'senux_player')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${sanitizedTitle}_render.${ext}`;

    if (window.Capacitor) {
      try {
        setRenderError('Menyiapkan file untuk disimpan...');
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');

        const cacheDir = (Directory && Directory.Cache) ? Directory.Cache : 'CACHE';

        // 1. Buat file kosong terlebih dahulu untuk menghindari limit parameter/payload size pada bridge WebView
        const savedFile = await Filesystem.writeFile({
          path: filename,
          data: '',
          directory: cacheDir,
          recursive: true
        });

        if (!savedFile || !savedFile.uri) {
          throw new Error('Gagal mendapatkan URI file yang disimpan');
        }

        // 2. Baca Blob sebagai ArrayBuffer, lalu bagi menjadi chunk-chunk binary
        const reader = new FileReader();
        reader.readAsArrayBuffer(renderResult);
        reader.onloadend = async () => {
          try {
            const arrayBuffer = reader.result;
            if (!arrayBuffer) {
              throw new Error('Gagal membaca data video (empty ArrayBuffer)');
            }

            const view = new Uint8Array(arrayBuffer);
            const chunkSize = 32 * 1024; // 32 KB per chunk (aman untuk limit bridge Android WebView mana pun)
            
            for (let offset = 0; offset < view.length; offset += chunkSize) {
              const chunkBytes = view.subarray(offset, offset + chunkSize);
              
              // Konversi chunk bytes ke base64 secara aman agar menjadi base64 string yang utuh & valid
              let binary = '';
              const chunkLength = chunkBytes.length;
              for (let i = 0; i < chunkLength; i++) {
                binary += String.fromCharCode(chunkBytes[i]);
              }
              const chunkBase64 = window.btoa(binary);

              setRenderError(`Menyimpan video: ${Math.round((offset / view.length) * 100)}%`);

              await Filesystem.appendFile({
                path: filename,
                data: chunkBase64,
                directory: cacheDir
              });
            }

            setRenderError('Menyiapkan dialog simpan...');

            // Tampilkan share dialog Android agar user bisa simpan ke Galeri / Files / kirim
            await Share.share({
              title: 'Simpan Video',
              text: 'Simpan video hasil render Anda',
              url: savedFile.uri,
              dialogTitle: 'Simpan Video'
            });
            
            setRenderError('');
          } catch (err) {
            console.error("Gagal menyimpan file:", err);
            setRenderError('Gagal menyimpan: ' + err.message);
          }
        };
      } catch (err) {
        console.error("Gagal memproses unduhan:", err);
        setRenderError('Gagal memproses unduhan: ' + err.message);
      }
    } else {
      const url = URL.createObjectURL(renderResult);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };


  // Handle focus transition between title and artist inputs to prevent premature auto-close
  const handleContainerBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsEditingText(false);
    }
  };

  const handleTimeUpdate = () => {
    const player = getActivePlayer();
    if (player) {
      // Clamp playback position inside editor mode
      if (showEditorMode) {
        const startSecs = parseTimeToSeconds(renderStartRef.current);
        const limitSecs = parseTimeToSeconds(renderEndRef.current);
        if (player.currentTime < startSecs) {
          player.currentTime = startSecs;
        } else if (player.currentTime > limitSecs) {
          player.currentTime = startSecs; // Loop back to start range
        }
      }

      setCurrentTime(player.currentTime);
      if (isVideo && bgVideoRef.current) {
        if (Math.abs(bgVideoRef.current.currentTime - player.currentTime) > 0.25) {
          bgVideoRef.current.currentTime = player.currentTime;
        }
      }
      // Automatically stop rendering once custom end time limit is met
      if (isRecordingRef.current) {
        const startSecs = parseTimeToSeconds(renderStartRef.current);
        const limitSecs = parseTimeToSeconds(renderEndRef.current);
        const totalSecs = limitSecs - startSecs;
        if (totalSecs > 0) {
          const currentProgress = Math.min(100, Math.round(((player.currentTime - startSecs) / totalSecs) * 100));
          setRenderProgress(Math.max(0, currentProgress));
        }
        if (player.currentTime >= limitSecs) {
          player.pause();
          if (toggleVideoRecordRef.current) {
            toggleVideoRecordRef.current(); // Complete snippet rendering
          }
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    const player = getActivePlayer();
    if (player) {
      setDuration(player.duration);
      setRenderStart('0:00');
      setRenderEnd(formatTime(player.duration));
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (isRecordingRef.current) {
      if (toggleVideoRecordRef.current) {
        toggleVideoRecordRef.current(); // End recording automatically when song completes
      }
    }
  };

  // Keep React state in sync with native playback events
  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);

  // Sync background and cover video elements with playback state
  useEffect(() => {
    const bgVideo = bgVideoRef.current;
    const coverVideo = coverVideoRef.current;
    const bgCoverVideo = bgCoverVideoRef.current;
    
    if (isPlaying) {
      if (bgVideo && bgVideo.paused) bgVideo.play().catch(e => {});
      if (coverVideo && coverVideo.paused) coverVideo.play().catch(e => {});
      if (bgCoverVideo && bgCoverVideo.paused) bgCoverVideo.play().catch(e => {});
    } else {
      if (bgVideo && !bgVideo.paused) bgVideo.pause();
      if (coverVideo && !coverVideo.paused) coverVideo.pause();
      if (bgCoverVideo && !bgCoverVideo.paused) bgCoverVideo.pause();
    }
  }, [isPlaying, isVideo, isCoverVideo, songUrl, artworkUrl]);

  // Live UI Visualizer Loop
  useEffect(() => {
    let animationFrameId;

    const draw = () => {
      let dataArray = new Uint8Array(0);
      if (analyserRef.current && isPlaying) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);
      }

      const barCount = 6;
      const gap = 2;
      const barWidth = 2;
      const totalWidth = barCount * barWidth + (barCount - 1) * gap;

      const canvases = [
        { el: uiCanvasRef.current, smooths: uiCanvasRef.current?.__smooths || new Array(barCount).fill(0) },
        { el: editorVisualizerRef.current, smooths: editorVisualizerRef.current?.__smooths || new Array(barCount).fill(0) }
      ];

      // Store smooth heights array on the DOM elements to persist across frames
      if (uiCanvasRef.current && !uiCanvasRef.current.__smooths) uiCanvasRef.current.__smooths = canvases[0].smooths;
      if (editorVisualizerRef.current && !editorVisualizerRef.current.__smooths) editorVisualizerRef.current.__smooths = canvases[1].smooths;

      canvases.forEach(({ el, smooths }) => {
        if (!el) return;
        
        // Auto resize canvas to bounding box
        const rect = el.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const targetW = Math.round(rect.width * dpr);
        const targetH = Math.round(rect.height * dpr);
        if (el.width !== targetW || el.height !== targetH) {
          el.width = targetW;
          el.height = targetH;
        }

        const ctx = el.getContext('2d');
        if (!ctx) return;
        const width = el.width;
        const height = el.height;
        const centerY = height / 2;
        ctx.clearRect(0, 0, width, height);

        const offsetX = (width - totalWidth) / 2;
        
        for (let i = 0; i < barCount; i++) {
          let val = 0;
          if (dataArray.length > 0) {
            if (i === 0) {
              let bassSum = 0;
              for (let b = 0; b <= 1; b++) bassSum += (dataArray[b] || 0);
              const bassAvg = bassSum / 2;
              val = bassAvg > 145 ? (bassAvg - 145) * 1.6 : 0;
            } else {
              const freqBins = [20, 36, 56, 80, 110];
              const dataIdx = freqBins[i - 1] || 20;
              val = dataArray[dataIdx] || 0;
            }
          }

          const normalized = Math.pow(val / 255, 1.8) * (i === 1 ? 0.22 : 0.65);
          const targetHeight = normalized * height;
          
          const decayRate = 0.75;
          if (targetHeight > smooths[i]) {
            smooths[i] += (targetHeight - smooths[i]) * 1.0;
          } else {
            smooths[i] -= (smooths[i] - targetHeight) * decayRate;
          }

          const halfH = Math.max(1, smooths[i] / 2);
          const x = offsetX + i * (barWidth + gap);

          ctx.beginPath();
          ctx.roundRect(x, centerY - halfH, barWidth, halfH, 0.8);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.fill();

          ctx.beginPath();
          ctx.roundRect(x, centerY, barWidth, halfH, 0.8);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.fill();
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  // If not authenticated, show KeyAuth license gate
  if (!isAuthenticated) {
    return <KeyAuthGate onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return (
    <>
      {/* Blurred cover art background on the viewport */}
      <div 
        className="bg-artwork-overlay" 
        style={{ backgroundImage: (!isCoverVideo && artworkUrl) ? `url(${artworkUrl})` : 'none' }}
      />
      {/* Blurred cover video background (when cover is video) */}
      {isCoverVideo && artworkUrl && (
        <video
          ref={bgCoverVideoRef}
          className="bg-artwork-overlay bg-cover-video"
          src={artworkUrl}
          autoPlay
          loop
          muted
          playsInline
          style={{ objectFit: 'cover', filter: 'blur(40px) saturate(1.7) brightness(0.6)', transform: 'scale(1.3)' }}
        />
      )}
      {/* Blurred song video background (when song is video and no custom cover is set) */}
      {isVideo && !artworkUrl && songUrl && (
        <video
          ref={bgVideoRef}
          className="bg-artwork-overlay bg-cover-video"
          src={songUrl}
          loop
          muted
          playsInline
          style={{ objectFit: 'cover', filter: 'blur(40px) saturate(1.7) brightness(0.6)', transform: 'scale(1.3)' }}
        />
      )}

      {/* Social Media Follow Popup Overlay */}
      {showFollowModal && (
        <div className="follow-modal-overlay">
          <div className="follow-modal-card">
            <h2>Welcome to senux Player</h2>
            <p>Dukung saya dengan follow sosial media berikut untuk terus mendapatkan update terbaru!</p>
            
            <div className="social-links-container">
              <a href="https://www.tiktok.com/@snuqxcepele" target="_blank" rel="noopener noreferrer" className="social-link-btn tiktok">
                <i className="fa-brands fa-tiktok"></i> TikTok
              </a>
              <a href="https://www.youtube.com/@snuqxcepele" target="_blank" rel="noopener noreferrer" className="social-link-btn youtube">
                <i className="fa-brands fa-youtube"></i> YouTube
              </a>
              <a href="https://soundcloud.com/elang-29063036" target="_blank" rel="noopener noreferrer" className="social-link-btn soundcloud">
                <i className="fa-brands fa-soundcloud"></i> SoundCloud
              </a>
            </div>

            <button 
              className="start-player-btn"
              onClick={() => {
                setShowFollowModal(false);
              }}
            >
              Mulai Mendengarkan <i className="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
      )}
      {/* Control Buttons on top right */}
      <div className="top-controls-container">
        {/* Orientation Toggle Group */}
        <div className="orientation-toggle-group" style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '14px', padding: '3px', border: '1px solid rgba(255,255,255,0.06)', marginRight: '8px' }}>
          <button 
            className={`toggle-mode-btn ${playerOrientation === 'portrait' ? 'active' : ''}`}
            onClick={() => setPlayerOrientation('portrait')}
            style={{
              background: playerOrientation === 'portrait' ? 'rgba(255, 255, 255, 0.12)' : 'none',
              border: 'none',
              color: playerOrientation === 'portrait' ? '#fff' : 'rgba(255,255,255,0.5)',
              padding: '6px 14px',
              borderRadius: '11px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <i className="fa-solid fa-mobile-screen-button"></i> Portrait
          </button>
          <button 
            className={`toggle-mode-btn ${playerOrientation === 'landscape' ? 'active' : ''}`}
            onClick={() => setPlayerOrientation('landscape')}
            style={{
              background: playerOrientation === 'landscape' ? 'rgba(255, 255, 255, 0.12)' : 'none',
              border: 'none',
              color: playerOrientation === 'landscape' ? '#fff' : 'rgba(255,255,255,0.5)',
              padding: '6px 14px',
              borderRadius: '11px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <i className="fa-solid fa-laptop"></i> Landscape
          </button>
        </div>

        <button className="upload-btn" onClick={() => fileInputRef.current.click()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Upload Song
        </button>

        <button 
          className={`upload-btn record-btn ${isRecording ? 'active' : ''}`}
          onClick={() => {
            if (isRecording) {
              toggleVideoRecord();
              return;
            }
            const player = getActivePlayer();
            if (!player || !player.src || !songFileRef.current) {
              alert("Please upload/load a song file (.mp3 / .wav) before exporting.");
              return;
            }
            setShowEditorMode(true);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" fill={isRecording ? '#fff' : 'none'} />
          </svg>
          {isRecording ? 'Stop Render' : 'Render Video'}
        </button>
      </div>

      {/* Hidden inputs */}
      <input 
        type="file" 
        ref={fileInputRef} 
        id="fileInput" 
        accept="audio/*,video/*" 
        onChange={handleSongUpload} 
      />
      <input 
        type="file" 
        ref={coverInputRef} 
        id="coverInput" 
        accept="image/*,video/*" 
        onChange={handleCoverUpload} 
      />

      {/* 9:16 portrait canvas used to capture frames (Hidden off-screen) */}
      <canvas 
        ref={canvasRef} 
        width={1080} 
        height={1920} 
        style={{ display: 'none' }} 
      />

      {/* Core Player UI Card wrapper */}
      <div className={`player-wrap ${playerOrientation === 'landscape' ? 'landscape-mode' : 'portrait-mode'}`}>
        <div className="player">
          {/* Card Artwork area */}
          <div className="artwork-section">
            <div className="artwork-container">
              {/* Overlay uploader */}
              <div className="artwork-overlay" onClick={() => coverInputRef.current.click()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span>Ganti Cover</span>
              </div>

              {/* Main song video player (always rendered when isVideo for audio playback) */}
              {isVideo && (
                <video 
                  ref={videoRef} 
                  className={`artwork-video ${artworkUrl ? '' : 'visible'}`} 
                  playsInline 
                  onLoadedMetadata={handleLoadedMetadata}
                  onDurationChange={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleEnded}
                  onPlay={handlePlay}
                  onPause={handlePause}
                />
              )}

              {/* Cover art display: video cover (looping), image cover, or placeholder */}
              {artworkUrl ? (
                isCoverVideo ? (
                  <video
                    ref={coverVideoRef}
                    src={artworkUrl}
                    className="artwork-img visible"
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <img src={artworkUrl} className="artwork-img visible" alt="Cover art" />
                )
              ) : !isVideo && (
                <div className="artwork-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="rgba(255,255,255,0.4)" stroke="none" />
                  </svg>
                </div>
              )}
            </div>
          </div> {/* artwork-section */}

          <div className="player-details">
            {/* Song Info */}
            <div className="song-info">
              <div className="text-wrapper" id="songTextContainer">
                {isEditingText ? (
                  <div className="edit-metadata-container" onBlur={handleContainerBlur}>
                    <input 
                      type="text" 
                      value={songTitle} 
                      onChange={(e) => setSongTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingText(false); }}
                      autoFocus
                      className="inline-edit-input title-input"
                    />
                    <input 
                      type="text" 
                      value={songArtist} 
                      onChange={(e) => setSongArtist(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingText(false); }}
                      className="inline-edit-input artist-input"
                    />
                  </div>
                ) : (
                  <div onClick={() => setIsEditingText(true)} style={{ cursor: 'pointer', width: '100%', overflow: 'hidden' }} title="Klik untuk edit nama & artis">
                    <div className={`title-container ${isMarquee ? 'has-marquee' : ''}`} ref={containerRef}>
                      <span 
                        className={`song-name ${isMarquee ? 'marquee' : ''}`} 
                        ref={titleRef}
                      >
                        {songTitle}
                      </span>
                      {isMarquee && (
                        <span className="song-name marquee duplicate">
                          {songTitle}
                        </span>
                      )}
                    </div>
                    <div className="song-artist">{songArtist}</div>
                  </div>
                )}
              </div>
              {/* Live visualizer spectrum bars - right side aligned with title/artist */}
              <canvas ref={uiCanvasRef} className="ui-visualizer" />
            </div>

            {/* Progress Seekbar */}
            <div className="progress-section">
              <div className="progress-track" onClick={handleSeek}>
                <div 
                  className="progress-fill" 
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
              <div className="time-labels">
                <span>{formatTime(currentTime)}</span>
                <span>-{formatTime(duration > 0 ? (duration - currentTime) : 0)}</span>
              </div>
            </div>

            {/* Player controls */}
            <div className="controls" style={{ position: 'relative' }}>
              {/* Star Outline - Positioned on the left */}
              <button className="ctrl-btn small star-btn" style={{ position: 'absolute', left: '28px', opacity: 0.55 }}>
                <svg 
                  viewBox="0 0 24 24" 
                  width="34" 
                  height="34" 
                  fill="none" 
                  stroke="white" 
                  strokeWidth="2.2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>

              {/* Middle Playback buttons - centered without star */}
              <div className="control-center">
                <button className="ctrl-btn small">
                  <svg 
                    viewBox="0 0 24 24" 
                    width="40" 
                    height="40" 
                    fill="white" 
                    stroke="white" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M10 6 L2 12 L10 18 Z M20 6 L12 12 L20 18 Z" />
                  </svg>
                </button>

                {/* Prefer actual media element state when available to avoid visual desync */}
                <button className="ctrl-btn play-btn" onClick={togglePlay} aria-label={getActualPlaying() ? 'Pause' : 'Play'}>
                  <i className={`fa-solid ${getActualPlaying() ? 'fa-pause' : 'fa-play'}`} aria-hidden="true"></i>
                </button>

                <button className="ctrl-btn small">
                  <svg 
                    viewBox="0 0 24 24" 
                    width="40" 
                    height="40" 
                    fill="white" 
                    stroke="white" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M4 6 L12 12 L4 18 Z M14 6 L22 12 L14 18 Z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Volume seek section with sleek speaker SVGs */}
            <div className="volume-section">
              <img className="volume-icon volume-icon-low" src="/volume-low.png" alt="Volume Low" style={{ opacity: 0.8 }} />
              <div className="volume-track" onClick={handleVolumeChange}>
                <div className="volume-fill" style={{ width: `${volume * 100}%` }} />
              </div>
              <img className="volume-icon" src="/volume-high.png" alt="Volume High" style={{ opacity: 0.45 }} />
            </div>

            {/* Bottom Device Selector Pill */}
            <div className="device-selector-container">
              {isEditingDevice ? (
                <input 
                  type="text" 
                  value={deviceName} 
                  onChange={(e) => setDeviceName(e.target.value)}
                  onBlur={() => setIsEditingDevice(false)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingDevice(false); }}
                  autoFocus
                  className="device-pill-input"
                  style={{
                    background: 'rgba(255, 255, 255, 0.12)',
                    border: 'none',
                    borderRadius: '30px',
                    padding: '8px 18px',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    textAlign: 'center',
                    outline: 'none',
                    width: '130px'
                  }}
                />
              ) : (
                <button 
                  className="device-pill" 
                  onClick={() => setIsEditingDevice(true)} 
                  title="Klik untuk ganti nama device"
                >
                  <img src="/airplay.png" alt="AirPlay" style={{ width: '15px', height: '15px' }} />
                  <span>{deviceName}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DOM placeholders to prevent background visualizer scripts (if any) from throwing TypeErrors */}
      <div className="visualizer" style={{ display: 'none' }} />

      {/* ===== Editor Mode (CapCut-style) ===== */}
      {showEditorMode && (
        <div className="editor-overlay">
          <div className="editor-container">
            {/* Header */}
            <div className="editor-header">
              <div className="editor-header-left">
                <h2 className="editor-title">Export</h2>
                <span className="editor-status-badge">● Encoder Ready</span>
              </div>
              <button className="editor-close-btn" onClick={() => setShowEditorMode(false)} title="Tutup">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Workspace wrapper for layout */}
            <div className="editor-workspace">
              
              {/* Top Section: Preview (left) & Settings (right) */}
              <div className="editor-top-section">
                {/* Left Column: Preview */}
                <div className="editor-left-column">
                  {/* Preview Area */}
                  <div className="editor-preview-area">
                    <div 
                      className={`editor-preview-frame ${renderAspectRatio === '16:9' ? 'ratio-16-9' : renderAspectRatio === '1:1' ? 'ratio-1-1' : 'ratio-9-16'}`}
                    >
                      {/* Widescreen ratio badge */}
                      <div className="editor-ratio-badge">
                        {renderAspectRatio} · {renderResolution}p
                      </div>

                      {/* Blurred cover art background on the frame */}
                      <div 
                        className="editor-preview-bg" 
                        style={{ backgroundImage: (!isCoverVideo && artworkUrl) ? `url(${artworkUrl})` : 'none' }}
                      />
                      {isCoverVideo && artworkUrl && (
                        <video
                          className="editor-preview-bg"
                          src={artworkUrl}
                          autoPlay loop muted playsInline
                          style={{ objectFit: 'cover', filter: 'blur(80px) saturate(1.7) brightness(0.5)', transform: 'scale(1.5)', position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
                        />
                      )}

                      {/* Floating player card */}
                      <div
                        className="editor-preview-card"
                      >
                        <div className="editor-preview-card-art">
                          {artworkUrl ? (
                            isCoverVideo ? (
                              <video src={artworkUrl} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                            ) : (
                              <img src={artworkUrl} alt="Cover" />
                            )
                          ) : (
                            <div className="artwork-placeholder">🎵</div>
                          )}
                        </div>
                        <div className="editor-preview-card-info">
                          <div className="editor-preview-card-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <div className="editor-preview-card-title" style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>{songTitle}</div>
                            <canvas ref={editorVisualizerRef} className="ui-visualizer" style={{ width: '40px', height: '16px', flexShrink: 0, opacity: 0.75 }} />
                          </div>
                          <div className="editor-preview-card-artist" style={{ textAlign: 'left' }}>{songArtist}</div>
                          
                          {/* Mini seekbar */}
                          <div className="editor-preview-card-seekbar">
                            <div 
                              className="editor-preview-card-seek-fill" 
                              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                            ></div>
                          </div>

                          {/* Mini Time Markers */}
                          <div className="editor-preview-card-time-labels" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', width: '100%' }}>
                            <span>{formatTime(currentTime)}</span>
                            <span>-{formatTime(duration > 0 ? (duration - currentTime) : 0)}</span>
                          </div>

                          {/* Mini Controls Row */}
                          <div className="editor-preview-card-controls-row" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px', marginTop: '6px', position: 'relative', width: '100%' }}>
                            {/* Star button */}
                            <i className="fa-regular fa-star" style={{ position: 'absolute', left: '0', fontSize: '10px', opacity: 0.5, color: '#fff' }}></i>
                            
                            {/* Playback controls */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#fff' }}>
                              <i className="fa-solid fa-backward-step" style={{ fontSize: '10px', opacity: 0.8 }}></i>
                              <i className={`fa-solid ${getActualPlaying() ? 'fa-pause' : 'fa-play'}`} style={{ fontSize: '12px' }}></i>
                              <i className="fa-solid fa-forward-step" style={{ fontSize: '10px', opacity: 0.8 }}></i>
                            </div>
                          </div>

                          {/* Mini Volume Bar */}
                          <div className="editor-preview-card-volume" style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', marginTop: '6px', opacity: 0.5, color: '#fff' }}>
                            <i className="fa-solid fa-volume-low" style={{ fontSize: '8px' }}></i>
                            <div style={{ flex: 1, height: '2px', background: 'rgba(255,255,255,0.15)', borderRadius: '1px' }}>
                              <div style={{ width: `${volume * 100}%`, height: '100%', background: '#fff', borderRadius: '1px' }}></div>
                            </div>
                            <i className="fa-solid fa-volume-high" style={{ fontSize: '8px' }}></i>
                          </div>

                          {/* Mini Device Selector Pill */}
                          <div className="editor-preview-card-device" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '12px', padding: '3px 8px', fontSize: '8px', fontWeight: '600', color: '#fff', width: 'fit-content', margin: '6px auto 0' }}>
                            <img src="/airplay.png" alt="AirPlay" style={{ width: '8px', height: '8px', opacity: 0.8 }} />
                            <span>{deviceName}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Settings */}
                <div className="editor-right-column">
                  {/* Export Settings Panel */}
                  <div className="editor-settings-panel">
                    <h3 className="editor-settings-title">EXPORT SETTINGS</h3>
                    
                    {/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && (
                      <div className="mobile-render-warning" style={{ marginBottom: '12px' }}>
                        ⚠️ Render di HP rentan crash. Disarankan 720p & 30 FPS.
                      </div>
                    )}

                    <div className="editor-settings-grid">
                      <div className="editor-setting-card">
                        <span className="editor-setting-label">RESOLUTION</span>
                        <div className="editor-setting-options">
                          <button 
                            className={`editor-opt-btn ${renderResolution === '720' ? 'active' : ''}`}
                            onClick={() => setRenderResolution('720')}
                          >720p</button>
                          <button 
                            className={`editor-opt-btn ${renderResolution === '1080' ? 'active' : ''}`}
                            onClick={() => setRenderResolution('1080')}
                          >1080p</button>
                        </div>
                      </div>
                      
                      <div className="editor-setting-card">
                        <span className="editor-setting-label">FRAME RATE</span>
                        <div className="editor-setting-options">
                          <button 
                            className={`editor-opt-btn ${renderFps === '30' ? 'active' : ''}`}
                            onClick={() => setRenderFps('30')}
                          >30 fps</button>
                          <button 
                            className={`editor-opt-btn ${renderFps === '60' ? 'active' : ''}`}
                            onClick={() => setRenderFps('60')}
                          >60 fps</button>
                        </div>
                      </div>

                      <div className="editor-setting-card">
                        <span className="editor-setting-label">ASPECT RATIO</span>
                        <div className="editor-setting-options">
                          <button 
                            className={`editor-opt-btn ${renderAspectRatio === '16:9' ? 'active' : ''}`}
                            onClick={() => setRenderAspectRatio('16:9')}
                          >16:9 (Landscape)</button>
                          <button 
                            className={`editor-opt-btn ${renderAspectRatio === '9:16' ? 'active' : ''}`}
                            onClick={() => setRenderAspectRatio('9:16')}
                          >9:16 (Portrait)</button>
                          <button 
                            className={`editor-opt-btn ${renderAspectRatio === '1:1' ? 'active' : ''}`}
                            onClick={() => setRenderAspectRatio('1:1')}
                          >1:1 (Square)</button>
                        </div>
                      </div>
                    </div>

                    <div className="editor-fade-section">
                      <div className="editor-fade-toggle">
                        <span className="editor-setting-label">VOLUME FADE IN/OUT</span>
                        <label className="editor-switch">
                          <input 
                            type="checkbox" 
                            checked={isAudioFadeEnabled} 
                            onChange={(e) => setIsAudioFadeEnabled(e.target.checked)} 
                          />
                          <span className="editor-switch-slider"></span>
                        </label>
                      </div>
                      {isAudioFadeEnabled && (
                        <div className="editor-fade-duration">
                          <span className="editor-setting-sublabel">Durasi Fade</span>
                          <div className="editor-fade-input-wrap">
                            <input 
                              type="range" 
                              min="0.5" max="10" step="0.5"
                              value={audioFadeDuration}
                              onChange={(e) => setAudioFadeDuration(e.target.value)}
                              className="editor-fade-slider"
                            />
                            <span className="editor-fade-value">{audioFadeDuration}s</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {isCoverVideo && (
                      <div className="editor-fade-section" style={{ marginTop: '12px' }}>
                        <div className="editor-fade-toggle">
                          <span className="editor-setting-label">LIVE PHOTO LOOP (3 DETIK)</span>
                          <label className="editor-switch">
                            <input 
                              type="checkbox" 
                              checked={isLivePhotoEnabled} 
                              onChange={(e) => setIsLivePhotoEnabled(e.target.checked)} 
                            />
                            <span className="editor-switch-slider"></span>
                          </label>
                        </div>
                      </div>
                    )}

                    {renderAspectRatio === '16:9' && (
                      <div className="editor-fade-section" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <span className="editor-setting-label" style={{ display: 'block', marginBottom: '4px' }}>ATUR POSISI LANDSCAPE</span>
                        
                        <div className="editor-fade-duration">
                          <span className="editor-setting-sublabel">Lebar Card</span>
                          <div className="editor-fade-input-wrap">
                            <input 
                              type="range" 
                              min="800" max="1200" step="10"
                              value={landscapeCardWidth}
                              onChange={(e) => setLandscapeCardWidth(Number(e.target.value))}
                              className="editor-fade-slider"
                            />
                            <span className="editor-fade-value">{landscapeCardWidth}px</span>
                          </div>
                        </div>

                        <div className="editor-fade-duration">
                          <span className="editor-setting-sublabel">Tinggi Card</span>
                          <div className="editor-fade-input-wrap">
                            <input 
                              type="range" 
                              min="350" max="650" step="10"
                              value={landscapeCardHeight}
                              onChange={(e) => setLandscapeCardHeight(Number(e.target.value))}
                              className="editor-fade-slider"
                            />
                            <span className="editor-fade-value">{landscapeCardHeight}px</span>
                          </div>
                        </div>

                        <div className="editor-fade-duration">
                          <span className="editor-setting-sublabel">Padding Cover Art</span>
                          <div className="editor-fade-input-wrap">
                            <input 
                              type="range" 
                              min="10" max="80" step="2"
                              value={landscapeArtPadding}
                              onChange={(e) => setLandscapeArtPadding(Number(e.target.value))}
                              className="editor-fade-slider"
                            />
                            <span className="editor-fade-value">{landscapeArtPadding}px</span>
                          </div>
                        </div>

                        <div className="editor-fade-duration">
                          <span className="editor-setting-sublabel">Jarak Art ke Teks (Gap)</span>
                          <div className="editor-fade-input-wrap">
                            <input 
                              type="range" 
                              min="10" max="100" step="2"
                              value={landscapeDetailsGap}
                              onChange={(e) => setLandscapeDetailsGap(Number(e.target.value))}
                              className="editor-fade-slider"
                            />
                            <span className="editor-fade-value">{landscapeDetailsGap}px</span>
                          </div>
                        </div>

                        <div className="editor-fade-duration">
                          <span className="editor-setting-sublabel">Geser Baris Volume/Pill (Y)</span>
                          <div className="editor-fade-input-wrap">
                            <input 
                              type="range" 
                              min="-100" max="100" step="2"
                              value={landscapeBottomOffset}
                              onChange={(e) => setLandscapeBottomOffset(Number(e.target.value))}
                              className="editor-fade-slider"
                            />
                            <span className="editor-fade-value">{landscapeBottomOffset > 0 ? `+${landscapeBottomOffset}` : landscapeBottomOffset}px</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Section: Timeline & Export Button (Full Width) */}
              <div className="editor-bottom-section">
                {/* Timeline Section */}
                <div className="editor-timeline-section">
                  <div className="editor-time-labels">
                    <span className="timeline-limit-start">00:00</span>
                    <span className="timeline-limit-end">{formatTime(duration)}</span>
                  </div>
                  <div className="editor-timeline-track"
                    onMouseDown={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      const timeSec = pct * duration;
                      const startSecs = parseTimeToSeconds(renderStart);
                      const endSecs = parseTimeToSeconds(renderEnd);
                      const clampedTime = Math.max(startSecs, Math.min(endSecs, timeSec));
                      const player = getActivePlayer();
                      if (player) {
                        player.currentTime = clampedTime;
                        setCurrentTime(clampedTime);
                      }
                    }}
                  >
                    {/* Audio waveform visualization in the background */}
                    <div className="editor-waveform">
                      {waveformPeaks.map((peak, idx) => {
                        const pct = (idx / waveformPeaks.length) * 100;
                        const startPct = duration > 0 ? (parseTimeToSeconds(renderStart) / duration) * 100 : 0;
                        const endPct = duration > 0 ? (parseTimeToSeconds(renderEnd) / duration) * 100 : 100;
                        const isActive = pct >= startPct && pct <= endPct;
                        return (
                          <div 
                            key={idx} 
                            className="editor-waveform-bar" 
                            style={{ 
                              height: `${peak * 100}%`,
                              background: isActive ? 'rgba(99, 102, 241, 0.65)' : 'rgba(255, 255, 255, 0.12)',
                              boxShadow: isActive ? '0 0 4px rgba(99, 102, 241, 0.2)' : 'none',
                              transition: 'background 0.2s ease'
                            }}
                          />
                        );
                      })}
                    </div>

                    {/* Selected range highlight */}
                    <div className="editor-range-highlight" style={{
                      left: `${duration > 0 ? (parseTimeToSeconds(renderStart) / duration) * 100 : 0}%`,
                      width: `${duration > 0 ? ((parseTimeToSeconds(renderEnd) - parseTimeToSeconds(renderStart)) / duration) * 100 : 100}%`
                    }} />

                    {/* Playhead */}
                    <div className="editor-playhead" style={{
                      left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`
                    }} />

                    {/* Left handle */}
                    <div className="editor-handle editor-handle-left" style={{
                      left: `${duration > 0 ? (parseTimeToSeconds(renderStart) / duration) * 100 : 0}%`
                    }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const track = e.currentTarget.parentElement;
                        const onMove = (ev) => {
                          const rect = track.getBoundingClientRect();
                          const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                          const timeSec = Math.floor(pct * duration);
                          const endSecs = parseTimeToSeconds(renderEnd);
                          const clampedStart = Math.min(endSecs, timeSec);
                          setRenderStart(formatTime(clampedStart));
                          const player = getActivePlayer();
                          if (player && player.currentTime < clampedStart) {
                            player.currentTime = clampedStart;
                            setCurrentTime(clampedStart);
                          }
                        };
                        const onUp = () => {
                          document.removeEventListener('mousemove', onMove);
                          document.removeEventListener('mouseup', onUp);
                        };
                        document.addEventListener('mousemove', onMove);
                        document.addEventListener('mouseup', onUp);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        const track = e.currentTarget.parentElement;
                        const onMove = (ev) => {
                          const rect = track.getBoundingClientRect();
                          const touch = ev.touches[0];
                          const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
                          const timeSec = Math.floor(pct * duration);
                          const endSecs = parseTimeToSeconds(renderEnd);
                          const clampedStart = Math.min(endSecs, timeSec);
                          setRenderStart(formatTime(clampedStart));
                          const player = getActivePlayer();
                          if (player && player.currentTime < clampedStart) {
                            player.currentTime = clampedStart;
                            setCurrentTime(clampedStart);
                          }
                        };
                        const onEnd = () => {
                          document.removeEventListener('touchmove', onMove);
                          document.removeEventListener('touchend', onEnd);
                        };
                        document.addEventListener('touchmove', onMove, { passive: false });
                        document.addEventListener('touchend', onEnd);
                      }}
                    >
                      <div className="editor-handle-grip">
                        <div /><div /><div />
                      </div>
                    </div>

                    {/* Right handle */}
                    <div className="editor-handle editor-handle-right" style={{
                      left: `${duration > 0 ? (parseTimeToSeconds(renderEnd) / duration) * 100 : 100}%`
                    }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const track = e.currentTarget.parentElement;
                        const onMove = (ev) => {
                          const rect = track.getBoundingClientRect();
                          const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                          const timeSec = Math.floor(pct * duration);
                          const startSecs = parseTimeToSeconds(renderStart);
                          const clampedEnd = Math.max(startSecs, timeSec);
                          setRenderEnd(formatTime(clampedEnd));
                          const player = getActivePlayer();
                          if (player && player.currentTime > clampedEnd) {
                            player.currentTime = clampedEnd;
                            setCurrentTime(clampedEnd);
                          }
                        };
                        const onUp = () => {
                          document.removeEventListener('mousemove', onMove);
                          document.removeEventListener('mouseup', onUp);
                        };
                        document.addEventListener('mousemove', onMove);
                        document.addEventListener('mouseup', onUp);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        const track = e.currentTarget.parentElement;
                        const onMove = (ev) => {
                          const rect = track.getBoundingClientRect();
                          const touch = ev.touches[0];
                          const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
                          const timeSec = Math.floor(pct * duration);
                          const startSecs = parseTimeToSeconds(renderStart);
                          const clampedEnd = Math.max(startSecs, timeSec);
                          setRenderEnd(formatTime(clampedEnd));
                          const player = getActivePlayer();
                          if (player && player.currentTime > clampedEnd) {
                            player.currentTime = clampedEnd;
                            setCurrentTime(clampedEnd);
                          }
                        };
                        const onEnd = () => {
                          document.removeEventListener('touchmove', onMove);
                          document.removeEventListener('touchend', onEnd);
                        };
                        document.addEventListener('touchmove', onMove, { passive: false });
                        document.addEventListener('touchend', onEnd);
                      }}
                    >
                      <div className="editor-handle-grip">
                        <div /><div /><div />
                      </div>
                    </div>
                  </div>
                  
                  {/* Crop Range and Duration display */}
                  <div className="timeline-range-labels">
                    <span className="crop-start-label">{renderStart}</span>
                    <span className="editor-duration-text">
                      Duration: {(() => {
                        const s = parseTimeToSeconds(renderEnd) - parseTimeToSeconds(renderStart);
                        return formatTime(Math.max(0, s));
                      })()}
                    </span>
                    <span className="crop-end-label">{renderEnd}</span>
                  </div>
                </div>

                {/* Footer Buttons Split */}
                <div className="editor-footer-actions">
                  <button className="editor-preview-action-btn" onClick={togglePlay}>
                    <i className={`fa-solid ${getActualPlaying() ? 'fa-pause' : 'fa-play'}`} style={{ marginRight: '8px' }}></i>
                    {getActualPlaying() ? 'Pause Preview' : 'Play Preview'}
                  </button>
                  
                  <button className="editor-export-btn" onClick={() => {
                    setShowEditorMode(false);
                    toggleVideoRecord();
                  }}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                    </svg>
                    Export Video
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Render Overlay — Full-screen progress during recording/converting/done */}
      {renderPhase !== 'idle' && (
        <div className="render-overlay">
          {/* Recording Phase */}
          {renderPhase === 'recording' && (
            <div className="render-phase-card">
              <div className="render-phase-icon">
                <div className="recording-pulse"></div>
                <i className="fas fa-circle" style={{ color: '#ef4444', fontSize: '14px' }}></i>
              </div>
              <h3 className="render-phase-title">Merekam Video...</h3>
              <div className="render-progress-container">
                <div className="render-progress-bar">
                  <div className="render-progress-fill" style={{ width: `${renderProgress}%` }}></div>
                </div>
                <div className="render-progress-info">
                  <span>{renderProgress}%</span>
                  <span>
                    {estimatedTimeRemaining !== null 
                      ? `Sisa waktu: ${estimatedTimeRemaining}s` 
                      : 'Menghitung sisa waktu...'}
                  </span>
                </div>
              </div>
              <div className="render-specs-badge">
                <span>{renderResolution}p</span>
                <span className="specs-dot">·</span>
                <span>{renderFps} FPS</span>
                <span className="specs-dot">·</span>
                <span>{(parseInt(renderBitrate) / 1000).toFixed(1)} Mbps</span>
              </div>
              <button className="render-cancel-btn" onClick={cancelRender}>
                <i className="fas fa-times"></i> Batalkan
              </button>
            </div>
          )}

          {/* Converting Phase */}
          {renderPhase === 'converting' && (
            <div className="render-phase-card">
              <div className="render-phase-icon">
                <div className="spinner convert-spinner"></div>
              </div>
              <h3 className="render-phase-title">Mengkonversi ke MP4...</h3>
              <div className="render-progress-container">
                <div className="render-progress-bar">
                  <div className="render-progress-fill" style={{ width: `${convertProgress}%` }}></div>
                </div>
                <div className="render-progress-info">
                  <span>{convertProgress}%</span>
                </div>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '8px' }}>
                Jangan tutup aplikasi atau layar HP Anda.
              </p>
            </div>
          )}

          {/* Done Phase */}
          {renderPhase === 'done' && (
            <div className="render-phase-card">
              <div className="render-phase-icon">
                <span className="success-icon" style={{ fontSize: '48px' }}>🎉</span>
              </div>
              <h3 className="render-phase-title">Video Berhasil!</h3>

              {renderError && (
                <div className="render-warning-notice">
                  <i className="fas fa-exclamation-triangle"></i>
                  <span>{renderError}</span>
                </div>
              )}

              <div className="render-result-info">
                <div className="result-info-row">
                  <span className="result-label">Format</span>
                  <span className="result-value">MP4</span>
                </div>
                <div className="result-info-row">
                  <span className="result-label">Resolusi</span>
                  <span className="result-value">{renderResolution}p</span>
                </div>
                <div className="result-info-row">
                  <span className="result-label">FPS</span>
                  <span className="result-value">{renderFps}</span>
                </div>
                <div className="result-info-row">
                  <span className="result-label">Durasi</span>
                  <span className="result-value">{renderStart} → {renderEnd}</span>
                </div>
                <div className="result-info-row">
                  <span className="result-label">Ukuran</span>
                  <span className="result-value">{formatFileSize(renderFileSize)}</span>
                </div>
              </div>

              <button className="render-download-btn" onClick={handleDownloadRender}>
                <i className="fas fa-download"></i> Unduh MP4
              </button>

              <div className="render-done-actions">
                <button className="render-action-btn" onClick={() => setRenderPhase('idle')}>
                  Tutup
                </button>
                <button className="render-action-btn" onClick={() => {
                  setRenderPhase('idle');
                  toggleVideoRecord();
                }}>
                  <i className="fas fa-sync-alt"></i> Render Lagi
                </button>
              </div>
            </div>
          )}

          {/* Error Phase */}
          {renderPhase === 'error' && (
            <div className="render-phase-card">
              <div className="render-phase-icon">
                <i className="fas fa-exclamation-circle" style={{ color: '#ef4444', fontSize: '48px' }}></i>
              </div>
              <h3 className="render-phase-title">Render Gagal</h3>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13.5px', margin: '12px 0', textAlign: 'center' }}>
                {renderError || 'Terjadi kesalahan saat merender video. Silakan coba lagi.'}
              </p>
              
              {renderErrorDetails && (
                <div style={{ width: '100%', marginTop: '5px', marginBottom: '15px', textAlign: 'left' }}>
                  <button 
                    onClick={() => setShowErrorDetails(!showErrorDetails)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.45)',
                      fontSize: '11px',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {showErrorDetails ? 'Sembunyikan Log Error' : 'Lihat Log Error'}
                  </button>
                  {showErrorDetails && (
                    <pre style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      padding: '10px',
                      borderRadius: '8px',
                      fontSize: '10px',
                      color: '#ff8888',
                      overflowX: 'auto',
                      maxHeight: '120px',
                      whiteSpace: 'pre-wrap',
                      marginTop: '8px',
                      fontFamily: 'monospace'
                    }}>
                      {renderErrorDetails}
                    </pre>
                  )}
                </div>
              )}

              <div className="render-done-actions">
                <button className="render-action-btn" onClick={() => setRenderPhase('idle')}>
                  Tutup
                </button>
                <button className="render-action-btn" onClick={() => {
                  setRenderPhase('idle');
                  toggleVideoRecord();
                }}>
                  Coba Lagi
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <audio 
        ref={audioRef} 
        style={{ display: 'none' }} 
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onPlay={handlePlay}
        onPause={handlePause}
      />
    </>
  );
}

// Helper: Render faded and clipped audio via OfflineAudioContext
async function renderFadedAudio(decodedBuffer, start, end, volume, isFadeEnabled, fadeDuration) {
  const duration = end - start;
  const sampleRate = decodedBuffer.sampleRate;
  
  const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
    decodedBuffer.numberOfChannels,
    Math.floor(duration * sampleRate),
    sampleRate
  );
  
  const source = offlineCtx.createBufferSource();
  source.buffer = decodedBuffer;
  
  const gainNode = offlineCtx.createGain();
  
  if (isFadeEnabled && fadeDuration > 0) {
    gainNode.gain.setValueAtTime(0, 0);
    gainNode.gain.linearRampToValueAtTime(volume, Math.min(fadeDuration, duration));
    
    if (duration > fadeDuration) {
      gainNode.gain.setValueAtTime(volume, duration - fadeDuration);
      gainNode.gain.linearRampToValueAtTime(0, duration);
    }
  } else {
    gainNode.gain.setValueAtTime(volume, 0);
  }
  
  source.connect(gainNode);
  gainNode.connect(offlineCtx.destination);
  
  source.start(0, start, duration);
  
  return await offlineCtx.startRendering();
}

// Helper: Convert AudioBuffer to 16-bit WAV ArrayBuffer
function bufferToWav(buffer) {
  let numOfChan = buffer.numberOfChannels,
      length = buffer.length * numOfChan * 2 + 44,
      bufferArr = new ArrayBuffer(length),
      view = new DataView(bufferArr),
      channels = [], i, sample,
      offset = 0,
      pos = 0;

  setUint32(0x46464952);                         // "RIFF"
  setUint32(length - 8);                         // file length - 8
  setUint32(0x45564157);                         // "WAVE"

  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // chunk length
  setUint16(1);                                  // sample format (raw)
  setUint16(numOfChan);                          // channel count
  setUint32(buffer.sampleRate);                  // sample rate
  setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2);                      // block align
  setUint16(16);                                 // bits per sample

  setUint32(0x61746164);                         // "data" - chunk
  setUint32(length - pos - 4);                   // chunk length

  for (i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return bufferArr;

  function setUint16(data) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}

// Helper: Convert ArrayBuffer to Base64 asynchronously using FileReader
async function arrayBufferToBase64(buffer) {
  const blob = new Blob([buffer], { type: 'audio/wav' });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default App;
