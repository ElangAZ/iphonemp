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

  // FFmpeg transcode states
  const [showModal, setShowModal] = useState(false);
  const [webmBlob, setWebmBlob] = useState(null);
  const [conversionStatus, setConversionStatus] = useState('idle'); // 'idle', 'loading_ffmpeg', 'converting', 'success', 'error'
  const [conversionProgress, setConversionProgress] = useState(0);

  // Snippet and format rendering states
  const [renderStart, setRenderStart] = useState('0:00');
  const [renderEnd, setRenderEnd] = useState('0:30');
  const [renderResolution, setRenderResolution] = useState('720'); // '720' or '1080'
  const [renderFps, setRenderFps] = useState('30'); // '30' or '60'
  const [isAudioFadeEnabled, setIsAudioFadeEnabled] = useState(true); // Toggle audio fading
  const [audioFadeDuration, setAudioFadeDuration] = useState('1'); // Audio fade duration in seconds

  const audioRef = useRef(null);
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
  const ffmpegRef = useRef(null);

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

      // 1. Draw heavy blur background using cover art (on physical canvas dimensions)
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.save();
      
      if (coverImgObj && coverImgObj.complete && coverImgObj.naturalWidth !== 0) {
        // High-performance ultra-dreamy blur (16x16 downscale + 45px filter) for perfect iOS-style color blending
        ctx.imageSmoothingEnabled = true;
        
        const tinyCanvas = document.createElement('canvas');
        tinyCanvas.width = 16;
        tinyCanvas.height = 16;
        const tinyCtx = tinyCanvas.getContext('2d');
        tinyCtx.drawImage(coverImgObj, 0, 0, 16, 16);
        
        ctx.save();
        ctx.filter = 'blur(45px) saturate(1.7) brightness(1.05)';
        ctx.drawImage(tinyCanvas, -150, -150, canvasWidth + 300, canvasHeight + 300);
        ctx.restore();
        
        // Add a premium subtle dark overlay
        ctx.fillStyle = 'rgba(10, 10, 20, 0.35)';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      } else {
        // Fallback dark gradient background
        const bgGrad = ctx.createRadialGradient(canvasWidth * 0.3, canvasHeight * 0.2, 0, canvasWidth * 0.3, canvasHeight * 0.2, canvasHeight);
        bgGrad.addColorStop(0, '#1e1b4b');
        bgGrad.addColorStop(0.4, '#0f0e1a');
        bgGrad.addColorStop(1, '#0a0a14');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      }
      ctx.restore();

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
      // Draw card round path with shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = 100;
      ctx.shadowOffsetY = 40;
      
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
      
      if (titleWidth > maxTextWidth) {
        // Create an offscreen canvas for the marquee text masking
        const offCanvas = document.createElement('canvas');
        offCanvas.width = maxTextWidth;
        offCanvas.height = 60;
        const offCtx = offCanvas.getContext('2d');

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
        ctx.drawImage(offCanvas, cardX + artPadding, infoY - 30);

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
        ctx.fillText(songTitle, cardX + artPadding, infoY);
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
            val = bassAvg > 195 ? (bassAvg - 195) * 3.5 : 0;
          } else {
            const freqBins = [20, 36, 56, 80, 110];
            const dataIdx = freqBins[i - 1] || 20;
            val = specDataArray[dataIdx] || 0;
          }
          
          const normalized = Math.pow(val / 255, 1.8) * 0.65;
          const targetHeight = normalized * (specHeight / 2);
          
          // Apply smooth delay/decay transition
          if (targetHeight > videoSmoothHeights[i]) {
            videoSmoothHeights[i] += (targetHeight - videoSmoothHeights[i]) * 0.35;
          } else {
            videoSmoothHeights[i] -= (videoSmoothHeights[i] - targetHeight) * 0.22;
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

      // Skip Back (<<) - Left
      ctx.save();
      ctx.translate(btnCenter - 95, ctrlY);
      ctx.scale(2.8, 2.4);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      // Left triangle
      ctx.moveTo(0.5, -6);
      ctx.lineTo(-8.5, 0);
      ctx.lineTo(0.5, 6);
      ctx.closePath();
      
      // Right triangle
      ctx.moveTo(8.5, -6);
      ctx.lineTo(-0.5, 0);
      ctx.lineTo(8.5, 6);
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
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.beginPath();
      // Left triangle
      ctx.moveTo(-8.5, -6);
      ctx.lineTo(0.5, 0);
      ctx.lineTo(-8.5, 6);
      ctx.closePath();
      
      // Right triangle
      ctx.moveTo(-0.5, -6);
      ctx.lineTo(8.5, 0);
      ctx.lineTo(-0.5, 6);
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

      // Right high-volume speaker icon with waves (Scaled up by 1.8x)
      ctx.save();
      ctx.translate(volX + volWidth + 14, volY - 16.6);
      ctx.scale(1.8, 1.8);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      
      // Speaker body
      ctx.beginPath();
      ctx.moveTo(9, 6);
      ctx.lineTo(5, 9);
      ctx.lineTo(2, 9);
      ctx.lineTo(2, 15);
      ctx.lineTo(5, 15);
      ctx.lineTo(9, 18);
      ctx.closePath();
      ctx.fill();

      // Wave Arc 1
      ctx.beginPath();
      ctx.arc(9, 12, 5, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();

      // Wave Arc 2
      ctx.beginPath();
      ctx.arc(9, 12, 9, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
      ctx.restore();
      
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
 
      // AirDrop icon inside pill (using Path2D)
      ctx.save();
      ctx.translate(pillX + 32 + 10, pillY + 26);
      ctx.scale(0.028, 0.028);
      ctx.translate(-512, -512);
      ctx.fillStyle = '#ffffff';
      const airdropPath = new Path2D("M938.666667 554.666667a426.666667 426.666667 0 0 1-109.653334 285.44 21.76 21.76 0 0 1-30.72 0l-15.36-15.36a21.76 21.76 0 0 1 0-29.013334 362.666667 362.666667 0 1 0-540.16 0 21.76 21.76 0 0 1 0 29.013334l-15.36 15.36a21.76 21.76 0 0 1-30.72 0A426.666667 426.666667 0 1 1 938.666667 554.666667zM512 256a298.666667 298.666667 0 0 0-226.986667 493.226667 23.893333 23.893333 0 0 0 15.36 7.253333 23.04 23.04 0 0 0 16.213334-6.4l14.933333-14.933333a21.333333 21.333333 0 0 0 0-29.013334 234.666667 234.666667 0 1 1 358.4 0 21.333333 21.333333 0 0 0 0 29.013334l14.933333 14.933333a23.04 23.04 0 0 0 16.213334 6.4 23.893333 23.893333 0 0 0 15.36-7.253333A298.666667 298.666667 0 0 0 512 256z m85.333333 360.533333a21.333333 21.333333 0 0 0 2.133334 27.306667l15.36 15.36a21.333333 21.333333 0 0 0 16.64 5.973333 20.053333 20.053333 0 0 0 15.36-8.533333 170.666667 170.666667 0 1 0-273.066667 0 20.053333 20.053333 0 0 0 15.36 8.533333 21.333333 21.333333 0 0 0 16.64-5.973333l15.36-15.36a21.333333 21.333333 0 0 0 2.133333-27.306667 106.666667 106.666667 0 1 1 174.08 0zM469.333333 554.666667a42.666667 42.666667 0 1 0 42.666667-42.666667 42.666667 42.666667 0 0 0-42.666667 42.666667z m74.666667 137.386666a32 32 0 0 0-22.613333-9.386666h-18.773334a32 32 0 0 0-22.613333 9.386666l-159.146667 158.72a21.76 21.76 0 0 0 0 30.293334l8.96 8.533333a20.053333 20.053333 0 0 0 14.933334 6.4h334.08a20.053333 20.053333 0 0 0 14.933333-6.4l8.96-8.533333a21.333333 21.333333 0 0 0 0-30.293334z");
      ctx.fill(airdropPath);
      ctx.restore();
 
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

  // Video recording toggle handler (High definition canvas output with Web Audio context source)
  const toggleVideoRecord = async () => {
    if (isRecordingRef.current) {
      // Stop recording
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

      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    } else {
      // Start recording
      const canvas = canvasRef.current;
      if (!canvas) return;

      const player = getActivePlayer();
      if (!player || !player.src) {
        alert("Please load a song or video before recording.");
        return;
      }

      // Check audioContext and setup if needed
      if (!audioContextRef.current) {
        setupWebAudio(player, isVideo);
      }

      isRecordingRef.current = true;
      setIsRecording(true);
      recordedChunksRef.current = [];

      // 1. Wait for all web fonts to be fully loaded (critical for canvas text rendering on mobile)
      try {
        await document.fonts.ready;
      } catch (e) {
        console.warn("Font loading check failed, proceeding anyway:", e);
      }

      // 2. Prepare cover image - clone to a fresh Image to guarantee load state
      let coverImgObj = null;
      const domImg = document.querySelector('.artwork-img');
      if (domImg && domImg.src && domImg.naturalWidth > 0) {
        // DOM image is already loaded and valid, use it directly
        coverImgObj = domImg;
      } else if (artworkUrl) {
        // Create new image and wait for it to fully load
        coverImgObj = new Image();
        coverImgObj.crossOrigin = 'anonymous';
        await new Promise((resolve) => {
          coverImgObj.onload = resolve;
          coverImgObj.onerror = resolve; // proceed even if image fails
          coverImgObj.src = artworkUrl;
          // If already cached/complete, resolve immediately
          if (coverImgObj.complete && coverImgObj.naturalWidth > 0) resolve();
        });
      }

      // 3. Validate render start/end and wait for player metadata before seeking
      const durationSeconds = player.duration || 0;
      const { start, end } = normalizeRenderRange(renderStart, renderEnd, durationSeconds);
      if (durationSeconds > 0 && start >= durationSeconds) {
        alert('Waktu render tidak valid. Pastikan "Mulai" berada di dalam durasi lagu/video.');
        isRecordingRef.current = false;
        setIsRecording(false);
        return;
      }

      if (end <= start) {
        alert('Waktu render tidak valid. Pastikan "Sampai" lebih besar dari "Mulai".');
        isRecordingRef.current = false;
        setIsRecording(false);
        return;
      }

      // Keep refs in sync with the validated snippet range for rendering and stopping logic
      const validatedStart = formatTime(start);
      const validatedEnd = formatTime(end);
      renderStartRef.current = validatedStart;
      renderEndRef.current = validatedEnd;
      if (validatedStart !== renderStart) setRenderStart(validatedStart);
      if (validatedEnd !== renderEnd) setRenderEnd(validatedEnd);

      if (player.readyState < 1) {
        await new Promise((resolve) => {
          const onLoaded = () => {
            player.removeEventListener('loadedmetadata', onLoaded);
            resolve();
          };
          player.addEventListener('loadedmetadata', onLoaded);
          // Safety timeout if loadedmetadata never fires
          setTimeout(resolve, 1500);
        });
      }

      player.currentTime = start;
      await new Promise((resolve) => {
        const onSeeked = () => {
          player.removeEventListener('seeked', onSeeked);
          resolve();
        };
        player.addEventListener('seeked', onSeeked);
        // Safety timeout in case seeked event never fires (some mobile browsers)
        setTimeout(resolve, 1500);
      });

      // Configure resolution dynamically on the physical canvas object
      if (renderResolution === '1080') {
        canvas.width = 1080;
        canvas.height = 1920;
      } else {
        canvas.width = 720;
        canvas.height = 1280;
      }

      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;

      // Start rendering loop (fonts loaded, image ready, player seeked)
      startCanvasRenderLoop(ctx, width, height, coverImgObj, isVideo, videoRef.current);

      // Capture video track at dynamic framerate (30 FPS or 60 FPS)
      const canvasStream = canvas.captureStream(parseInt(renderFps, 10));
      
      // Capture digital audio track from our Web Audio destination node
      let audioTrack = null;
      if (audioDestinationRef.current) {
        const audioStream = audioDestinationRef.current.stream;
        if (audioStream && audioStream.getAudioTracks().length > 0) {
          audioTrack = audioStream.getAudioTracks()[0];
        }
      }

      // Combine video and audio tracks
      const outputStream = new MediaStream();
      canvasStream.getVideoTracks().forEach(track => outputStream.addTrack(track));
      if (audioTrack) {
        outputStream.addTrack(audioTrack);
      }

      // Initialize MediaRecorder - high quality WebM render as base format
      let mimeType = 'video/webm;codecs=vp9,opus';
      let fileExt = 'webm';

      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
          mimeType = 'video/webm;codecs=vp9,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          mimeType = 'video/webm';
        }
      }

      let recorder;
      try {
        const options = { 
          mimeType,
          videoBitsPerSecond: renderResolution === '1080' ? 6000000 : 3500000, // 6 Mbps for 1080p, 3.5 Mbps for 720p
          audioBitsPerSecond: 320000 // Studio grade 320kbps audio encoding
        };
        recorder = new MediaRecorder(outputStream, options);
      } catch (e) {
        recorder = new MediaRecorder(outputStream);
        mimeType = recorder.mimeType || 'video/webm';
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        setWebmBlob(blob);
        setShowModal(true);
        setConversionStatus('idle');
        setConversionProgress(0);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();

      // 4. Start playback AFTER recorder is capturing (so no frames are lost)
      if (player.paused) {
        player.play().then(() => setIsPlaying(true)).catch(err => console.error("Play failed:", err));
      }
    }
  };

  useEffect(() => {
    toggleVideoRecordRef.current = toggleVideoRecord;
  }, [toggleVideoRecord]);

  // Handle direct WebM file download
  const handleDownloadWebm = () => {
    if (!webmBlob) return;
    const url = URL.createObjectURL(webmBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${songTitle || 'senux_player'}_render.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Convert WebM to MP4 using single-threaded FFmpeg.wasm in browser
  const handleConvertToMp4 = async () => {
    if (!webmBlob) return;
    
    try {
      setConversionStatus('loading_ffmpeg');
      setConversionProgress(0);

      // Load FFmpeg from window object (loaded via index.html script tag)
      if (!ffmpegRef.current) {
        if (!window.FFmpeg) {
          throw new Error("FFmpeg library not loaded from CDN.");
        }
        const { createFFmpeg } = window.FFmpeg;
        ffmpegRef.current = createFFmpeg({
          log: true,
          corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
        });
      }

      const ffmpeg = ffmpegRef.current;
      if (!ffmpeg.isLoaded()) {
        await ffmpeg.load();
      }

      // Track progress
      ffmpeg.setProgress(({ ratio }) => {
        setConversionProgress(Math.min(99, Math.round(ratio * 100)));
      });

      setConversionStatus('converting');

      // Write the file into FFmpeg's virtual file system
      const arrayBuffer = await webmBlob.arrayBuffer();
      ffmpeg.FS('writeFile', 'input.webm', new Uint8Array(arrayBuffer));

      // Execute conversion: transcode audio to AAC at high-fidelity 320k, copy video track (ultra-fast container swapping)
      await ffmpeg.run('-i', 'input.webm', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', 'output.mp4');

      // Read output
      const data = ffmpeg.FS('readFile', 'output.mp4');
      const mp4Blob = new Blob([data.buffer], { type: 'video/mp4' });
      const mp4Url = URL.createObjectURL(mp4Blob);

      // Trigger MP4 download
      const a = document.createElement('a');
      a.href = mp4Url;
      a.download = `${songTitle || 'senux_player'}_render.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setConversionProgress(100);
      setConversionStatus('success');
      
      // Clean up files in virtual FS to free up browser memory
      try {
        ffmpeg.FS('unlink', 'input.webm');
        ffmpeg.FS('unlink', 'output.mp4');
      } catch (err) {
        console.warn("Clean up virtual files warning:", err);
      }
    } catch (error) {
      console.error("FFmpeg conversion error:", error);
      setConversionStatus('error');
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
          const limitSecs = parseTimeToSeconds(renderEndRef.current);
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
            // Very high threshold: only real kick hits
            val = bassAvg > 195 ? (bassAvg - 195) * 3.5 : 0;
          } else {
            // Bars 2-6: mapped to specific active frequency bands
            const freqBins = [20, 36, 56, 80, 110];
            const dataIdx = freqBins[i - 1] || 20;
            val = dataArray[dataIdx] || 0;
          }
        }

        const normalized = Math.pow(val / 255, 1.8) * 0.65;
        const targetHeight = normalized * height;
        if (targetHeight > smoothHeights[i]) {
          smoothHeights[i] += (targetHeight - smoothHeights[i]) * 0.35; // Kecepatan naik
        } else {
          smoothHeights[i] -= (smoothHeights[i] - targetHeight) * 0.22; // Kecepatan turun (makin besar = makin cepat turun)
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
          <div className="controls">
            {/* Middle Playback buttons - centered without star */}
            <div className="control-center">
              <button className="ctrl-btn small">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="white">
                  <path d="M11 6 L2 12 L11 18 Z M20 6 L11 12 L20 18 Z" />
                </svg>
              </button>

              {/* Prefer actual media element state when available to avoid visual desync */}
              <button className="ctrl-btn play-btn" onClick={togglePlay} aria-label={getActualPlaying() ? 'Pause' : 'Play'}>
                <i className={`fa-solid ${getActualPlaying() ? 'fa-pause' : 'fa-play'}`} aria-hidden="true"></i>
              </button>

              <button className="ctrl-btn small">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="white">
                  <path d="M4 6 L13 12 L4 18 Z M13 6 L22 12 L13 18 Z" />
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
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
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
                <svg viewBox="0 0 1024 1024" fill="currentColor">
                  <path d="M938.666667 554.666667a426.666667 426.666667 0 0 1-109.653334 285.44 21.76 21.76 0 0 1-30.72 0l-15.36-15.36a21.76 21.76 0 0 1 0-29.013334 362.666667 362.666667 0 1 0-540.16 0 21.76 21.76 0 0 1 0 29.013334l-15.36 15.36a21.76 21.76 0 0 1-30.72 0A426.666667 426.666667 0 1 1 938.666667 554.666667zM512 256a298.666667 298.666667 0 0 0-226.986667 493.226667 23.893333 23.893333 0 0 0 15.36 7.253333 23.04 23.04 0 0 0 16.213334-6.4l14.933333-14.933333a21.333333 21.333333 0 0 0 0-29.013334 234.666667 234.666667 0 1 1 358.4 0 21.333333 21.333333 0 0 0 0 29.013334l14.933333 14.933333a23.04 23.04 0 0 0 16.213334 6.4 23.893333 23.893333 0 0 0 15.36-7.253333A298.666667 298.666667 0 0 0 512 256z m85.333333 360.533333a21.333333 21.333333 0 0 0 2.133334 27.306667l15.36 15.36a21.333333 21.333333 0 0 0 16.64 5.973333 20.053333 20.053333 0 0 0 15.36-8.533333 170.666667 170.666667 0 1 0-273.066667 0 20.053333 20.053333 0 0 0 15.36 8.533333 21.333333 21.333333 0 0 0 16.64-5.973333l15.36-15.36a21.333333 21.333333 0 0 0 2.133333-27.306667 106.666667 106.666667 0 1 1 174.08 0zM469.333333 554.666667a42.666667 42.666667 0 1 0 42.666667-42.666667 42.666667 42.666667 0 0 0-42.666667 42.666667z m74.666667 137.386666a32 32 0 0 0-22.613333-9.386666h-18.773334a32 32 0 0 0-22.613333 9.386666l-159.146667 158.72a21.76 21.76 0 0 0 0 30.293334l8.96 8.533333a20.053333 20.053333 0 0 0 14.933334 6.4h334.08a20.053333 20.053333 0 0 0 14.933333-6.4l8.96-8.533333a21.333333 21.333333 0 0 0 0-30.293334z" />
                </svg>
                <span>{deviceName}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* DOM placeholders to prevent background visualizer scripts (if any) from throwing TypeErrors */}
      <div className="visualizer" style={{ display: 'none' }} />

      {/* Premium Transcode Modal Overlay */}
      {showModal && (
        <div className="transcode-modal-overlay">
          <div className="transcode-modal-card">
            <button className="close-modal-btn" onClick={() => setShowModal(false)}>×</button>
            
            <div className="transcode-header">
              <span className="success-icon">🎉</span>
              <h3>Video Berhasil Dirender!</h3>
              <p>Pilih format unduhan video yang Anda inginkan:</p>
            </div>

            <div className="conversion-options">
              {/* Option 1: Direct WebM */}
              <div className="option-box">
                <div className="option-info">
                  <h4>Format WebM (Instan)</h4>
                  <p>Sangat cepat tanpa loading, langsung siap di-upload ke WhatsApp, TikTok, Instagram, atau YouTube!</p>
                </div>
                <button className="option-btn webm-btn" onClick={handleDownloadWebm}>
                  <i className="fas fa-bolt"></i> Unduh WebM
                </button>
              </div>

              {/* Option 2: Transcode to MP4 */}
              <div className="option-box">
                <div className="option-info">
                  <h4>Format MP4 (Untuk Galeri HP)</h4>
                  {/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? (
                    <div className="mobile-warning-box">
                      <p className="warning-text">⚠️ <strong>Peringatan HP/Mobile:</strong></p>
                      <p className="warning-desc">Proses konversi MP4 di browser HP membutuhkan RAM sangat besar dan **sering membuat browser HP crash/menutup sendiri**.</p>
                      <p className="recommend-text">💡 <strong>Sangat Disarankan:</strong> Unduh format <strong>WebM (Instan)</strong> di atas, lalu kirim ke WhatsApp atau upload ke IG/TikTok. Sosmed akan mengubahnya ke MP4 secara otomatis!</p>
                    </div>
                  ) : (
                    <p>Mengonversi WebM ke MP4 agar bisa disimpan langsung di galeri handphone Anda offline.</p>
                  )}
                </div>

                {conversionStatus === 'idle' && (
                  <button className="option-btn mp4-btn" onClick={handleConvertToMp4}>
                    {/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? (
                      <>
                        <i className="fas fa-exclamation-triangle"></i> Tetap Paksa Konversi MP4
                      </>
                    ) : (
                      <>
                        <i className="fas fa-sync-alt"></i> Konversi ke MP4
                      </>
                    )}
                  </button>
                )}

                {conversionStatus === 'loading_ffmpeg' && (
                  <div className="conversion-status-loading">
                    <div className="spinner"></div>
                    <span>Menyiapkan Engine Konverter...</span>
                  </div>
                )}

                {conversionStatus === 'converting' && (
                  <div className="conversion-status-progress">
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill" style={{ width: `${conversionProgress}%` }}></div>
                    </div>
                    <span>Mengonversi ke MP4: {conversionProgress}%</span>
                  </div>
                )}

                {conversionStatus === 'success' && (
                  <div className="conversion-status-success">
                    <i className="fas fa-check-circle"></i>
                    <span>Konversi Berhasil! MP4 telah diunduh.</span>
                    <button className="option-btn mp4-btn reset-btn" onClick={() => setConversionStatus('idle')}>
                      Konversi Ulang
                    </button>
                  </div>
                )}

                {conversionStatus === 'error' && (
                  <div className="conversion-status-error">
                    <i className="fas fa-exclamation-circle"></i>
                    <span>Konversi gagal. Coba format WebM (Instan).</span>
                    <button className="option-btn mp4-btn reset-btn" onClick={handleConvertToMp4}>
                      Coba Lagi
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <audio ref={audioRef} style={{ display: 'none' }} />
    </>
  );
}

export default App;
