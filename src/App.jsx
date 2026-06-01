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

  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const titleRef = useRef(null);
  const containerRef = useRef(null);
  const ffmpegRef = useRef(null);

  const isRecordingRef = useRef(isRecording);
  const renderStartRef = useRef(renderStart);
  const renderEndRef = useRef(renderEnd);

  useEffect(() => {
    isRecordingRef.current = isRecording;
    renderStartRef.current = renderStart;
    renderEndRef.current = renderEnd;
  }, [isRecording, renderStart, renderEnd]);

  // Web Audio refs for recording
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const videoSourceRef = useRef(null);
  const audioDestinationRef = useRef(null);

  // Automatically check if title overflows to trigger smooth marquee scrolling
  useEffect(() => {
    if (titleRef.current && containerRef.current) {
      const titleWidth = titleRef.current.scrollWidth;
      const containerWidth = containerRef.current.clientWidth;
      setIsMarquee(titleWidth > containerWidth);
    } else {
      setIsMarquee(false);
    }
  }, [songTitle, isVideo]);

  // Sync active player source
  const getActivePlayer = () => {
    return isVideo ? videoRef.current : audioRef.current;
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

    if (isVideoType) {
      if (videoSourceRef.current) return; // Already connected!
      videoSourceRef.current = ctx.createMediaElementSource(element);
      videoSourceRef.current.connect(ctx.destination);
      if (!audioDestinationRef.current) {
        audioDestinationRef.current = ctx.createMediaStreamDestination();
      }
      videoSourceRef.current.connect(audioDestinationRef.current);
    } else {
      if (audioSourceRef.current) return; // Already connected!
      audioSourceRef.current = ctx.createMediaElementSource(element);
      audioSourceRef.current.connect(ctx.destination);
      if (!audioDestinationRef.current) {
        audioDestinationRef.current = ctx.createMediaStreamDestination();
      }
      audioSourceRef.current.connect(audioDestinationRef.current);
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

      // 1. Draw heavy blur background using cover art (on physical canvas dimensions)
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.save();
      
      if (coverImgObj && coverImgObj.complete && coverImgObj.naturalWidth !== 0) {
        ctx.filter = 'blur(80px) saturate(1.5) brightness(1.25)';
        ctx.drawImage(coverImgObj, -200, -200, canvasWidth + 400, canvasHeight + 400);
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
      const cardHeight = 910;
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

      // Apply border path inside card
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.stroke();
      ctx.restore();

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

      // 4. Song Info text (perfect luxurious spacing)
      const infoY = artY + artSize + 40;
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 36px Inter';
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
        offCtx.font = '800 36px Inter';
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
        if (scrollPauseTicks > 0 || Math.abs(textScrollOffset) < 15) {
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
      ctx.font = '500 24px Inter';
      ctx.fillText(songArtist, cardX + artPadding, infoY + 42);

      // 5. Seekbar
      const seekY = infoY + 90;
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
      ctx.font = '600 20px Inter';
      ctx.textAlign = 'left';
      ctx.fillText(formatTime(curT), cardX + artPadding, seekY + 38);
      
      ctx.textAlign = 'right';
      const remainingTime = dur > 0 ? (dur - curT) : 0;
      ctx.fillText(`-${formatTime(remainingTime)}`, cardX + cardWidth - artPadding, seekY + 38);

      // 6. Navigation Controls (Skip buttons, Play/Pause - perfectly centered)
      const ctrlY = seekY + 70;
      const btnCenter = cardX + cardWidth / 2;

      // Skip Back (<<) - Left
      ctx.save();
      ctx.translate(btnCenter - 120, ctrlY);
      ctx.scale(2.5, 2.5);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      // polygon points="19 20 9 12 19 4 19 20"
      ctx.beginPath();
      ctx.moveTo(19 - 12, 20 - 12);
      ctx.lineTo(9 - 12, 12 - 12);
      ctx.lineTo(19 - 12, 4 - 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // polygon points="9 20 2 12 9 4 9 20"
      ctx.beginPath();
      ctx.moveTo(9 - 12, 20 - 12);
      ctx.lineTo(2 - 12, 12 - 12);
      ctx.lineTo(9 - 12, 4 - 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Large Center Play / Pause Button (custom shape with stroke anti-aliasing)
      ctx.save();
      ctx.translate(btnCenter, ctrlY);
      ctx.scale(3.0, 3.0);
      ctx.fillStyle = '#ffffff';
      if (isPlaying) {
        // Draw rounded Pause bars (x=6, y=4, w=4, h=16, rx=1.5)
        ctx.beginPath();
        ctx.roundRect(6 - 12, 4 - 12, 4, 16, 1.5);
        ctx.roundRect(14 - 12, 4 - 12, 4, 16, 1.5);
        ctx.fill();
      } else {
        // Draw large robust Play triangle with smooth stroke edges
        ctx.beginPath();
        ctx.moveTo(7.5 - 12, 6.5 - 12);
        ctx.lineTo(16.5 - 12, 12 - 12);
        ctx.lineTo(7.5 - 12, 17.5 - 12);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.0;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
      ctx.restore();

      // Skip Forward (>>) - Right
      ctx.save();
      ctx.translate(btnCenter + 120, ctrlY);
      ctx.scale(2.5, 2.5);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // polygon points="5 4 15 12 5 20 5 4"
      ctx.beginPath();
      ctx.moveTo(5 - 12, 4 - 12);
      ctx.lineTo(15 - 12, 12 - 12);
      ctx.lineTo(5 - 12, 20 - 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // polygon points="15 4 22 12 15 20 15 4"
      ctx.beginPath();
      ctx.moveTo(15 - 12, 4 - 12);
      ctx.lineTo(22 - 12, 12 - 12);
      ctx.lineTo(15 - 12, 20 - 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 7. Volume bar (with scaled up, beautiful speaker icons)
      const volY = ctrlY + 65;
      const volX = cardX + artPadding + 48; // Shift slider to give space for larger speakers
      const volWidth = cardWidth - (artPadding * 2) - 96;
      
      // Left low-volume speaker icon (Scaled up by 1.4x)
      ctx.save();
      ctx.translate(volX - 42, volY - 7);
      ctx.scale(1.4, 1.4);
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

      // Right high-volume speaker icon with waves (Scaled up by 1.4x)
      ctx.save();
      ctx.translate(volX + volWidth + 14, volY - 7);
      ctx.scale(1.4, 1.4);
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

      // 8. Device selector pill button at the bottom center (Perfect tight spacing)
      const pillY = volY + 55;
      const pillWidth = 190;
      const pillHeight = 52;
      const pillX = btnCenter - pillWidth / 2;
      const pillRadius = 26;

      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillWidth, pillHeight, pillRadius);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fill();

      // AirPlay icon inside pill
      ctx.save();
      ctx.translate(pillX + 32, pillY + 26);
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 2.5;

      // AirPlay Triangle
      ctx.beginPath();
      ctx.moveTo(-10, 8);
      ctx.lineTo(10, 8);
      ctx.lineTo(0, -4);
      ctx.closePath();
      ctx.fill();

      // AirPlay Arcs
      ctx.beginPath();
      ctx.arc(0, -1, 10, Math.PI + 0.5, Math.PI * 2 - 0.5);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, -1, 16, Math.PI + 0.5, Math.PI * 2 - 0.5);
      ctx.stroke();
      ctx.restore();

      // Pill Text (senux)
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 22px Inter';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('senux', pillX + 66, pillY + 26);

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

  // Video recording toggle handler (High definition canvas output with Web Audio context source)
  const toggleVideoRecord = () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setIsRecording(false);
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

      // Seek active player directly to snippet starting time
      const startSecs = parseTimeToSeconds(renderStart);
      player.currentTime = startSecs;

      setIsRecording(true);
      recordedChunksRef.current = [];

      // Create high-res artwork image object to render inside card
      const coverImgObj = new Image();
      if (artworkUrl) {
        coverImgObj.src = artworkUrl;
      }

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

      // Start rendering loop immediately
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
          videoBitsPerSecond: renderResolution === '1080' ? 6000000 : 3500000 // 6 Mbps for 1080p, 3.5 Mbps for 720p
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

      // Ensure the player is playing while recording
      if (player.paused) {
        player.play().then(() => setIsPlaying(true));
      }
    }
  };

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

      // Execute conversion: transcode audio to AAC, copy video track (ultra-fast container swapping)
      await ffmpeg.run('-i', 'input.webm', '-c:v', 'copy', '-c:a', 'aac', 'output.mp4');

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
            toggleVideoRecord(); // Complete snippet rendering
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
      if (isRecording) {
        toggleVideoRecord(); // End recording automatically when song completes
      }
    };

    // Listen to both elements
    const audioEl = audioRef.current;
    const videoEl = videoRef.current;

    if (audioEl) {
      audioEl.addEventListener('timeupdate', handleTimeUpdate);
      audioEl.addEventListener('loadedmetadata', handleLoadedMetadata);
      audioEl.addEventListener('ended', handleEnded);
    }
    if (videoEl) {
      videoEl.addEventListener('timeupdate', handleTimeUpdate);
      videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
      videoEl.addEventListener('ended', handleEnded);
    }

    return () => {
      if (audioEl) {
        audioEl.removeEventListener('timeupdate', handleTimeUpdate);
        audioEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audioEl.removeEventListener('ended', handleEnded);
      }
      if (videoEl) {
        videoEl.removeEventListener('timeupdate', handleTimeUpdate);
        videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
        videoEl.removeEventListener('ended', handleEnded);
      }
    };
  }, [isVideo]);

  return (
    <>
      {/* Blurred cover art background on the viewport */}
      <div 
        className="bg-artwork-overlay" 
        style={{ backgroundImage: artworkUrl ? `url(${artworkUrl})` : 'none' }}
      />

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
                <div onClick={() => setIsEditingText(true)} style={{ cursor: 'pointer' }} title="Klik untuk edit nama & artis">
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
                <i className="fas fa-backward"></i>
              </button>

              <button className="ctrl-btn play-btn" onClick={togglePlay}>
                {isPlaying ? (
                  <svg viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" rx="1.2" fill="white" />
                    <rect x="14" y="4" width="4" height="16" rx="1.2" fill="white" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24">
                    <polygon points="7.5 6.5 16.5 12 7.5 17.5 7.5 6.5" />
                  </svg>
                )}
              </button>

              <button className="ctrl-btn small">
                <i className="fas fa-forward"></i>
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
            <button className="device-pill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polygon points="12 12 17 21 7 21 12 12" fill="currentColor" stroke="none" />
                <path d="M18.36 10.64a9 9 0 0 0-12.72 0M15.54 13.46a5 5 0 0 0-7.08 0" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
              <span>senux</span>
            </button>
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
