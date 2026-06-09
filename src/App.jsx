import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
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
  const [renderBitrate, setRenderBitrate] = useState('3500'); // kbps: '2000', '3500', '6000'
  const [renderAudioQuality, setRenderAudioQuality] = useState('256'); // kbps: '128', '256', '320'
  const [isAudioFadeEnabled, setIsAudioFadeEnabled] = useState(true); // Toggle audio fading
  const [audioFadeDuration, setAudioFadeDuration] = useState('1'); // Audio fade duration in seconds
  const [usedNativeMp4, setUsedNativeMp4] = useState(false); // Track if native MP4 was used
  const [nativeRenderUri, setNativeRenderUri] = useState('');

  const audioRef = useRef(null);
  const songFileRef = useRef(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const canvasRef = useRef(null);
  const uiCanvasRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const titleRef = useRef(null);
  const containerRef = useRef(null);
  const airplayImgRef = useRef(null);
  const volumeHighImgRef = useRef(null);

  useEffect(() => {
    const airplay = new Image();
    airplay.src = '/airplay.png';
    airplayImgRef.current = airplay;

    const vol = new Image();
    vol.src = '/volume-high.png';
    volumeHighImgRef.current = vol;
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

  // Audio/Video file upload handler
  const handleSongUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    songFileRef.current = file;
    const url = URL.createObjectURL(file);
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

  // Custom Cover Image uploader
  const handleCoverUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
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
      cachedBgCtx.filter = 'blur(20px) saturate(1.7) brightness(1.05)';
      // Draw with 40px overflow on all sides to prevent edge bleeding
      cachedBgCtx.drawImage(coverImgObj, -40, -40, 440, 720);
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
        // Draw cached blur canvas stretched to fill, with slight overflow to prevent edge gaps
        ctx.drawImage(cachedBgCanvas, -2, -2, canvasWidth + 4, canvasHeight + 4);
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
      ctx.fillStyle = 'rgba(15, 15, 15, 0.45)';
      ctx.fill();
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
      ctx.fillText(formatTime(curT), cardX + artPadding, seekY + 38);
      
      ctx.textAlign = 'right';
      const remainingTime = dur > 0 ? (dur - curT) : 0;
      ctx.fillText(`-${formatTime(remainingTime)}`, cardX + cardWidth - artPadding, seekY + 38);
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
      
      // Left low-volume speaker icon (Scaled up by 1.8x)
      ctx.save();
      ctx.translate(volX - 42, volY - 16.6);
      ctx.scale(1.8, 1.8);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.moveTo(9, 6);
      ctx.lineTo(5, 9);
      ctx.lineTo(2, 9);
      ctx.lineTo(2, 15);
      ctx.lineTo(5, 15);
      ctx.lineTo(9, 18);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Volume track bg
      ctx.beginPath();
      ctx.roundRect(volX, volY, volWidth, 10, 5);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fill();

      // Volume filled progress
      ctx.beginPath();
      ctx.roundRect(volX, volY, volWidth * volume, 10, 5);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.fill();

      // Right high-volume speaker icon (Scaled up by 1.8x)
      if (volumeHighImgRef.current && volumeHighImgRef.current.complete) {
        ctx.save();
        ctx.translate(volX + volWidth + 14, volY - 16.6);
        ctx.scale(1.8, 1.8);
        ctx.globalAlpha = 0.45;
        const img = volumeHighImgRef.current;
        const ratio = img.naturalWidth / img.naturalHeight;
        ctx.drawImage(img, 0, 0, 24 * ratio, 24);
        ctx.restore();
      }
      
      // 8. Device selector pill button at the bottom center (Dynamic centering & width based on custom name)
      ctx.font = '600 22px Inter';
      const textWidth = ctx.measureText(deviceName).width;
      
      const pillY = volY + 50;
      const pillWidth = 32 + 20 + 14 + textWidth + 32; 
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
        ctx.translate(pillX + 32 + 10, pillY + 26);
        ctx.scale(1.2, 1.2);
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
      ctx.fillText(deviceName, pillX + 66, pillY + 26);

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
    const re = new Float32Array(fftSize);
    const im = new Float32Array(fftSize);
    
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

    const magnitudes = new Uint8Array(fftSize / 2);
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

      // 2. Load cover image
      let coverImgObj = null;
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

      const durationSeconds = player.duration || 0;
      const { start, end } = normalizeRenderRange(renderStart, renderEnd, durationSeconds);
      if (durationSeconds > 0 && start >= durationSeconds) {
        alert('Waktu render tidak valid.');
        isRecordingRef.current = false;
        setIsRecording(false);
        setRenderPhase('idle');
        return;
      }

      // Set up Canvas resolution
      const canvas = canvasRef.current;
      if (renderResolution === '1080') {
        canvas.width = 1080;
        canvas.height = 1920;
      } else {
        canvas.width = 720;
        canvas.height = 1280;
      }
      const ctx = canvas.getContext('2d');

      setRenderError('Mendecode audio untuk ekspor offline...');
      // 3. Decode audio buffer to PCM
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const fileArrayBuffer = await songFileRef.current.arrayBuffer();
      const decodedBuffer = await audioCtx.decodeAudioData(fileArrayBuffer);

      setRenderError('Mengekspor video frame-demi-frame...');
      
      // 4. Set up Muxer and VideoEncoder
      const { Muxer, ArrayBufferTarget } = await import('webm-muxer');

      let muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
          codec: 'V_VP9',
          width: canvas.width,
          height: canvas.height
        }
      });

      let encoder = new VideoEncoder({
        output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
        error: (e) => {
          console.error(e);
          throw e;
        }
      });

      const fps = parseInt(renderFps, 10);
      encoder.configure({
        codec: 'vp9',
        width: canvas.width,
        height: canvas.height,
        bitrate: parseInt(renderBitrate, 10) * 1000
      });

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
        cachedBgCtx.filter = 'blur(20px) saturate(1.7) brightness(1.05)';
        cachedBgCtx.drawImage(coverImgObj, -40, -40, 440, 720);
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

      // Draw loop
      while (currentTime < end) {
        if (!isRecordingRef.current) {
          // Cancelled mid-process
          return;
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
          ctx.drawImage(cachedBgCanvas, -2, -2, canvas.width + 4, canvas.height + 4);
          ctx.restore();
          ctx.fillStyle = 'rgba(10, 10, 20, 0.35)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        const scaleFactor = canvas.width / 720;
        ctx.save();
        ctx.scale(scaleFactor, scaleFactor);

        const cardWidth = 560;
        const cardHeight = 960;
        const cardX = (720 - cardWidth) / 2;
        const cardY = (1280 - cardHeight) / 2;
        const cardRadius = 75;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
        ctx.fillStyle = 'rgba(15, 15, 15, 0.45)';
        ctx.fill();
        ctx.restore();

        const artPadding = 35;
        const artSize = cardWidth - (artPadding * 2);
        const artX = cardX + artPadding;
        const artY = cardY + artPadding;
        const artRadius = 20;

        if (coverImgObj && coverImgObj.complete && coverImgObj.naturalWidth !== 0) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(artX, artY, artSize, artSize, artRadius);
          ctx.clip();
          const mRatio = coverImgObj.naturalWidth / coverImgObj.naturalHeight;
          let sx = 0, sy = 0, sw = coverImgObj.naturalWidth, sh = coverImgObj.naturalHeight;
          if (mRatio > 1) {
            sw = coverImgObj.naturalHeight;
            sx = (coverImgObj.naturalWidth - sw) / 2;
          } else {
            sh = coverImgObj.naturalWidth;
            sy = (coverImgObj.naturalHeight - sh) / 2;
          }
          ctx.drawImage(coverImgObj, sx, sy, sw, sh, artX, artY, artSize, artSize);
          ctx.restore();
        }

        const infoY = artY + artSize + 60;
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 22px Inter';
        ctx.textAlign = 'left';

        const maxTextWidth = cardWidth - (artPadding * 2) - 80;
        const titleWidth = ctx.measureText(songTitle).width;
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
        ctx.fillText(formatTime(currentTime), cardX + artPadding, seekY + 38);

        ctx.textAlign = 'right';
        ctx.fillText(`-${formatTime(Math.max(0, durationSeconds - currentTime))}`, cardX + cardWidth - artPadding, seekY + 38);

        // Navigation Controls (Skip, Pause)
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

        ctx.save();
        ctx.translate(btnCenter - 95, ctrlY);
        ctx.scale(2.8, 2.4);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.0;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-1, -6);
        ctx.lineTo(-9, 0);
        ctx.lineTo(-1, 6);
        ctx.closePath();
        ctx.moveTo(9, -6);
        ctx.lineTo(1, 0);
        ctx.lineTo(9, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
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
        ctx.moveTo(-9, -6);
        ctx.lineTo(-1, 0);
        ctx.lineTo(-9, 6);
        ctx.closePath();
        ctx.moveTo(1, -6);
        ctx.lineTo(9, 0);
        ctx.lineTo(1, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Volume bar
        const volY = ctrlY + 80;
        const volX = cardX + artPadding + 48;
        const volWidth = cardWidth - (artPadding * 2) - 96;

        ctx.save();
        ctx.translate(volX - 42, volY - 16.6);
        ctx.scale(1.8, 1.8);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.moveTo(9, 6);
        ctx.lineTo(5, 9);
        ctx.lineTo(2, 9);
        ctx.lineTo(2, 15);
        ctx.lineTo(5, 15);
        ctx.lineTo(9, 18);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.beginPath();
        ctx.roundRect(volX, volY, volWidth, 10, 5);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fill();

        ctx.beginPath();
        ctx.roundRect(volX, volY, volWidth * volume, 10, 5);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.fill();

        // Right high-volume speaker icon (Scaled up by 1.8x)
        if (volumeHighImgRef.current && volumeHighImgRef.current.complete) {
          ctx.save();
          ctx.translate(volX + volWidth + 14, volY - 16.6);
          ctx.scale(1.8, 1.8);
          ctx.globalAlpha = 0.45;
          const img = volumeHighImgRef.current;
          const ratio = img.naturalWidth / img.naturalHeight;
          ctx.drawImage(img, 0, 0, 24 * ratio, 24);
          ctx.restore();
        }

        // Device Selector Pill
        ctx.font = '600 22px Inter';
        const textW = ctx.measureText(deviceName).width;
        const pillY = volY + 50;
        const pillW = 32 + 20 + 14 + textW + 32;
        const pillH = 52;
        const pillX = btnCenter - pillW / 2;
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 26);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fill();

        // AirPlay Audio icon inside pill
        if (airplayImgRef.current && airplayImgRef.current.complete) {
          ctx.save();
          ctx.translate(pillX + 32 + 10, pillY + 26);
          ctx.scale(1.2, 1.2);
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
        ctx.fillText(deviceName, pillX + 66, pillY + 26);

        ctx.restore(); // Restore scaled coordinates

        // Wait if hardware encoder queue is backing up to prevent Out Of Memory crashes
        while (encoder.encodeQueueSize > 5) {
          await new Promise(resolve => setTimeout(resolve, 15));
        }

        // Create frame and encode
        const timestampUs = Math.round((currentTime - start) * 1e6);
        const videoFrame = new VideoFrame(canvas, { timestamp: timestampUs });
        encoder.encode(videoFrame, { keyFrame: frameIndex % 30 === 0 });
        videoFrame.close();

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

      setRenderError('Menyelesaikan encoding video WebM...');
      await encoder.flush();
      muxer.finalize();
      const webmBuffer = muxer.target.buffer;
      const recordedBlob = new Blob([webmBuffer], { type: 'video/webm' });
      setRenderFileSize(recordedBlob.size);

      // Now merge/transcode
      if (window.Capacitor) {
        setRenderPhase('converting');
        setConvertProgress(10);
        
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const cacheDir = (Directory && Directory.Cache) ? Directory.Cache : 'CACHE';
        
        const videoFilename = 'temp_input.webm';
        const originalName = songFileRef.current ? songFileRef.current.name : 'temp_audio.mp3';
        const lastDotIdx = originalName.lastIndexOf('.');
        const audioExt = lastDotIdx !== -1 ? originalName.substring(lastDotIdx) : '.mp3';
        const audioFilename = `temp_audio${audioExt}`;

        // Clean up
        try { await Filesystem.deleteFile({ path: videoFilename, directory: cacheDir }); } catch (e) {}
        try { await Filesystem.deleteFile({ path: audioFilename, directory: cacheDir }); } catch (e) {}

        // Write silent WebM
        setRenderError('Menyalin video ke penyimpanan native...');
        const webmBlob = new Blob([webmBuffer], { type: 'video/webm' });
        const videoBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(webmBlob);
        });
        await Filesystem.writeFile({
          path: videoFilename,
          data: videoBase64,
          directory: cacheDir,
          recursive: true
        });
        setConvertProgress(40);

        // Write uploaded audio
        setRenderError('Menyalin audio asli ke penyimpanan native...');
        const audioBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(songFileRef.current);
        });
        await Filesystem.writeFile({
          path: audioFilename,
          data: audioBase64,
          directory: cacheDir,
          recursive: true
        });
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
          audioStartMs: Math.round(start * 1000),
          audioEndMs: Math.round(end * 1000),
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

  // Sync seekbar and play state
  useEffect(() => {
    const handleTimeUpdate = () => {
      const player = getActivePlayer();
      if (player) {
        setCurrentTime(player.currentTime);
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
      if (player) setDuration(player.duration);
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

    // Listen to both elements
    const audioEl = audioRef.current;
    const videoEl = videoRef.current;

    if (audioEl) {
      audioEl.addEventListener('timeupdate', handleTimeUpdate);
      audioEl.addEventListener('loadedmetadata', handleLoadedMetadata);
      audioEl.addEventListener('play', handlePlay);
      audioEl.addEventListener('pause', handlePause);
      audioEl.addEventListener('ended', handleEnded);
    }
    if (videoEl) {
      videoEl.addEventListener('timeupdate', handleTimeUpdate);
      videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
      videoEl.addEventListener('play', handlePlay);
      videoEl.addEventListener('pause', handlePause);
      videoEl.addEventListener('ended', handleEnded);
    }

    return () => {
      if (audioEl) {
        audioEl.removeEventListener('timeupdate', handleTimeUpdate);
        audioEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audioEl.removeEventListener('play', handlePlay);
        audioEl.removeEventListener('pause', handlePause);
        audioEl.removeEventListener('ended', handleEnded);
      }
      if (videoEl) {
        videoEl.removeEventListener('timeupdate', handleTimeUpdate);
        videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
        videoEl.removeEventListener('play', handlePlay);
        videoEl.removeEventListener('pause', handlePause);
        videoEl.removeEventListener('ended', handleEnded);
      }
    };
  }, [isVideo]);

  // Live UI Visualizer Loop
  useEffect(() => {
    let animationFrameId;
    const canvas = uiCanvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * (window.devicePixelRatio || 1);
      canvas.height = rect.height * (window.devicePixelRatio || 1);
    };
    resizeCanvas();
    
    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(canvas);

    const ctx = canvas.getContext('2d');
    const barCount = 6;
    const gap = 2;
    const smoothHeights = new Array(barCount).fill(0);

    const draw = () => {
      if (!ctx || !canvas) return;
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;
      ctx.clearRect(0, 0, width, height);

      let dataArray = new Uint8Array(0);
      if (analyserRef.current && isPlaying) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);
      }

      const barWidth = 2;
      const totalWidth = barCount * barWidth + (barCount - 1) * gap;
      const offsetX = (width - totalWidth) / 2;
      
      for (let i = 0; i < barCount; i++) {
        let val = 0;
        if (dataArray.length > 0) {
          if (i === 0) {
            // Leftmost bar: kick/bass only (bins 0-1, sub-bass ~0-172Hz with high fftSize)
            let bassSum = 0;
            for (let b = 0; b <= 1; b++) bassSum += (dataArray[b] || 0);
            const bassAvg = bassSum / 2;
            // Low threshold (145) to trigger easily, low multiplier (1.6) so it never hits max height
            val = bassAvg > 145 ? (bassAvg - 145) * 1.6 : 0;
          } else {
            // Bars 2-6: mapped to specific active frequency bands
            const freqBins = [20, 36, 56, 80, 110];
            const dataIdx = freqBins[i - 1] || 20;
            val = dataArray[dataIdx] || 0;
          }
        }

        const normalized = Math.pow(val / 255, 1.8) * (i === 1 ? 0.22 : 0.65);
        const targetHeight = normalized * height;
        
        // Apply fast rise and decay (instant rise, extremely fast decay)
        const decayRate = 0.75;
        if (targetHeight > smoothHeights[i]) {
          smoothHeights[i] += (targetHeight - smoothHeights[i]) * 1.0; // Kecepatan naik
        } else {
          smoothHeights[i] -= (smoothHeights[i] - targetHeight) * decayRate; // Kecepatan turun
        }

        const halfH = Math.max(1, smoothHeights[i] / 2);
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

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
    };
  }, [isPlaying]);

  return (
    <>
      {/* Blurred cover art background on the viewport */}
      <div 
        className="bg-artwork-overlay" 
        style={{ backgroundImage: artworkUrl ? `url(${artworkUrl})` : 'none' }}
      />

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

      {/* Control Buttons on top right with snippet settings */}
      <div className="top-controls-container">
        <button className="upload-btn" onClick={() => fileInputRef.current.click()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Upload Song
        </button>

        <button 
          className={`upload-btn record-btn ${isRecording ? 'active' : ''}`}
          onClick={toggleVideoRecord}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" fill={isRecording ? '#fff' : 'none'} />
          </svg>
          {isRecording ? 'Stop Render' : 'Render Video'}
        </button>

        {/* Snippet Render Settings Panel */}
        {!isRecording && (
          <div className="snippet-settings-panel">
            {/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && (
              <div className="mobile-render-warning">
                ⚠️ Render di HP rentan crash (OOM). Sangat disarankan set 720p & 30 FPS.
              </div>
            )}
            <div className="settings-row">
              <label>Mulai:</label>
              <input 
                type="text" 
                value={renderStart} 
                onChange={(e) => setRenderStart(e.target.value)} 
                placeholder="0:00"
                className="snippet-input"
              />
            </div>
            <div className="settings-row">
              <label>Sampai:</label>
              <input 
                type="text" 
                value={renderEnd} 
                onChange={(e) => setRenderEnd(e.target.value)} 
                placeholder="0:30"
                className="snippet-input"
              />
            </div>
            <div className="settings-row">
              <label>Resolusi:</label>
              <select 
                value={renderResolution} 
                onChange={(e) => setRenderResolution(e.target.value)}
                className="snippet-select"
              >
                <option value="720">720p (HD)</option>
                <option value="1080">1080p (FHD)</option>
              </select>
            </div>
            <div className="settings-row">
              <label>FPS:</label>
              <select 
                value={renderFps} 
                onChange={(e) => setRenderFps(e.target.value)}
                className="snippet-select"
              >
                <option value="30">30 FPS</option>
                <option value="60">60 FPS</option>
              </select>
            </div>
            <div className="settings-row-separator" />
            <div className="settings-row checkbox-row">
              <label htmlFor="audioFadeToggle">Fade In/Out:</label>
              <input 
                id="audioFadeToggle"
                type="checkbox" 
                checked={isAudioFadeEnabled} 
                onChange={(e) => setIsAudioFadeEnabled(e.target.checked)}
                className="snippet-checkbox"
              />
            </div>
            {isAudioFadeEnabled && (
              <div className="settings-row">
                <label>Durasi Fade (s):</label>
                <input 
                  type="number" 
                  min="0.5"
                  max="15"
                  step="0.5"
                  value={audioFadeDuration} 
                  onChange={(e) => setAudioFadeDuration(e.target.value)} 
                  placeholder="1"
                  className="snippet-input duration-input"
                />
              </div>
            )}
          </div>
        )}
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
        accept="image/*" 
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
      <div className="player-wrap">
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

              {isVideo ? (
                <video 
                  ref={videoRef} 
                  className={`artwork-video ${artworkUrl ? '' : 'visible'}`} 
                  playsInline 
                />
              ) : (
                artworkUrl ? (
                  <img src={artworkUrl} className="artwork-img visible" alt="Cover art" />
                ) : (
                  <div className="artwork-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="rgba(255,255,255,0.4)" stroke="none" />
                    </svg>
                  </div>
                )
              )}
            </div>
          </div>

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
            <svg className="volume-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.667 8.167h3.5l4.666-4.667v17l-4.666-4.667h-3.5v-7.666z"/>
            </svg>
            <div className="volume-track" onClick={handleVolumeChange}>
              <div className="volume-fill" style={{ width: `${volume * 100}%` }} />
            </div>
            <svg className="volume-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11 5 L6 9 H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M22.6 1.4a15 15 0 0 1 0 21.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ fill: 'none' }}>
                  <path d="M9.1 16 A 5 5 0 1 1 14.9 16" />
                  <path d="M6.7 19.2 A 9 9 0 1 1 17.3 19.2" />
                  <path d="M4.3 22.4 A 13 13 0 1 1 19.7 22.4" />
                  <polygon points="12 12 5.5 20.5 18.5 20.5" fill="currentColor" stroke="none" />
                </svg>
                <span>{deviceName}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* DOM placeholders to prevent background visualizer scripts (if any) from throwing TypeErrors */}
      <div className="visualizer" style={{ display: 'none' }} />

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

      <audio ref={audioRef} style={{ display: 'none' }} />
    </>
  );
}

export default App;
