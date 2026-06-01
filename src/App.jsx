import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [songTitle, setSongTitle] = useState('daisy');
  const [songArtist, setSongArtist] = useState('[free] k-pop x r&b x ballad type beat');
  const [artworkUrl, setArtworkUrl] = useState('');
  const [isVideo, setIsVideo] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [manualCoverSet, setManualCoverSet] = useState(false);

  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Web Audio refs for recording
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const audioDestinationRef = useRef(null);

  // Sync active player source
  const getActivePlayer = () => {
    return isVideo ? videoRef.current : audioRef.current;
  };

  // Setup Web Audio API for clean recording stream
  const setupWebAudio = (element) => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.disconnect();
      } catch (e) {
        console.warn(e);
      }
    }

    audioSourceRef.current = ctx.createMediaElementSource(element);
    audioDestinationRef.current = ctx.createMediaStreamDestination();

    // Connect to system output (speaker) AND recording destination
    audioSourceRef.current.connect(ctx.destination);
    audioSourceRef.current.connect(audioDestinationRef.current);
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
        setupWebAudio(player);
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
  const startCanvasRenderLoop = (ctx, width, height, coverImgObj, isVideoActive, videoEl) => {
    let textScrollOffset = 0;
    
    const renderFrame = () => {
      // 1. Draw heavy blur background using cover art
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      
      if (coverImgObj && coverImgObj.complete && coverImgObj.naturalWidth !== 0) {
        ctx.filter = 'blur(80px) saturate(1.5) brightness(1.25)';
        ctx.drawImage(coverImgObj, -200, -200, width + 400, height + 400);
      } else {
        // Fallback dark gradient background
        const bgGrad = ctx.createRadialGradient(width * 0.3, height * 0.2, 0, width * 0.3, height * 0.2, height);
        bgGrad.addColorStop(0, '#1e1b4b');
        bgGrad.addColorStop(0.4, '#0f0e1a');
        bgGrad.addColorStop(1, '#0a0a14');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.restore();

      // 2. Draw Floating Card Player Card (Centered in 9:16 layout)
      // Scale coordinates based on 720x1280 target size
      const cardWidth = 560;
      const cardHeight = 1000;
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

      // 3. Draw Album Cover art inside the Card
      const artPadding = 35;
      const artSize = cardWidth - (artPadding * 2);
      const artX = cardX + artPadding;
      const artY = cardY + artPadding;
      const artRadius = 45;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(artX, artY, artSize, artSize, artRadius);
      ctx.clip();

      if (isVideoActive && videoEl && !videoEl.paused) {
        ctx.drawImage(videoEl, artX, artY, artSize, artSize);
      } else if (coverImgObj && coverImgObj.complete && coverImgObj.naturalWidth !== 0) {
        ctx.drawImage(coverImgObj, artX, artY, artSize, artSize);
      } else {
        // Placeholder music icon cover art
        ctx.fillStyle = 'linear-gradient(135deg, #1e1e35 0%, #2d2d50 100%)';
        ctx.fillRect(artX, artY, artSize, artSize);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '70px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎵', artX + artSize / 2, artY + artSize / 2);
      }
      ctx.restore();

      // 4. Song Info text
      const infoY = artY + artSize + 60;
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 36px Inter';
      ctx.textAlign = 'left';

      // Measure title and handle scrolling text if too long
      const maxTextWidth = cardWidth - (artPadding * 2) - 80;
      const titleWidth = ctx.measureText(songTitle).width;
      
      if (titleWidth > maxTextWidth) {
        ctx.save();
        // Clip text area to avoid overflowing card edges
        ctx.beginPath();
        ctx.rect(cardX + artPadding, infoY - 40, maxTextWidth, 60);
        ctx.clip();
        
        ctx.fillText(songTitle, cardX + artPadding + textScrollOffset, infoY);
        ctx.fillText(songTitle, cardX + artPadding + textScrollOffset + titleWidth + 100, infoY);
        
        textScrollOffset -= 1.5;
        if (Math.abs(textScrollOffset) >= titleWidth + 100) {
          textScrollOffset = 0;
        }
        ctx.restore();
      } else {
        ctx.fillText(songTitle, cardX + artPadding, infoY);
      }

      // Draw Artist
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '500 24px Inter';
      ctx.fillText(songArtist, cardX + artPadding, infoY + 50);

      // 5. Seekbar
      const seekY = infoY + 120;
      const seekWidth = cardWidth - (artPadding * 2);
      
      // Track bg
      ctx.beginPath();
      ctx.roundRect(cardX + artPadding, seekY, seekWidth, 12, 6);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fill();

      // Track filled progress
      const progressPercent = duration > 0 ? (currentTime / duration) : 0;
      const filledWidth = seekWidth * progressPercent;
      
      ctx.beginPath();
      ctx.roundRect(cardX + artPadding, seekY, filledWidth, 12, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Time labels
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '600 20px Inter';
      ctx.textAlign = 'left';
      ctx.fillText(formatTime(currentTime), cardX + artPadding, seekY + 45);
      
      ctx.textAlign = 'right';
      const remainingTime = duration > 0 ? (duration - currentTime) : 0;
      ctx.fillText(`-${formatTime(remainingTime)}`, cardX + cardWidth - artPadding, seekY + 45);

      // 6. Navigation Controls (Play/Pause, Skip buttons, Favorite Star)
      const ctrlY = seekY + 130;
      const btnCenter = cardX + cardWidth / 2;

      // Skip Back (<<) - Left
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(btnCenter - 100, ctrlY);
      ctx.lineTo(btnCenter - 75, ctrlY - 20);
      ctx.lineTo(btnCenter - 75, ctrlY + 20);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(btnCenter - 75, ctrlY);
      ctx.lineTo(btnCenter - 50, ctrlY - 20);
      ctx.lineTo(btnCenter - 50, ctrlY + 20);
      ctx.closePath();
      ctx.fill();

      // Large Center Play / Pause Button
      ctx.save();
      ctx.translate(btnCenter, ctrlY);
      if (isPlaying) {
        // Draw Pause bars
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-22, -30, 14, 60);
        ctx.fillRect(8, -30, 14, 60);
      } else {
        // Draw large robust Play triangle (borderless)
        ctx.beginPath();
        // Exact coordinate translation of play-btn svg path/polygon
        ctx.moveTo(-15, -30);
        ctx.lineTo(25, 0);
        ctx.lineTo(-15, 30);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
      ctx.restore();

      // Skip Forward (>>) - Right
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(btnCenter + 50, ctrlY);
      ctx.lineTo(btnCenter + 75, ctrlY - 20);
      ctx.lineTo(btnCenter + 75, ctrlY + 20);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(btnCenter + 75, ctrlY);
      ctx.lineTo(btnCenter + 100, ctrlY - 20);
      ctx.lineTo(btnCenter + 100, ctrlY + 20);
      ctx.closePath();
      ctx.fill();

      // Favorite Star button (outline if false, solid white if true)
      ctx.save();
      const starX = cardX + artPadding + 20;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.translate(starX, ctrlY);
      
      ctx.beginPath();
      // Draw 5-pointed star
      const spikes = 5;
      const outerRadius = 22;
      const innerRadius = 9;
      let rot = Math.PI / 2 * 3;
      let x = 0;
      let y = 0;
      const step = Math.PI / spikes;

      ctx.moveTo(0, -outerRadius);
      for (let i = 0; i < spikes; i++) {
        x = Math.cos(rot) * outerRadius;
        y = Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = Math.cos(rot) * innerRadius;
        y = Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(0, -outerRadius);
      ctx.closePath();
      
      if (isFavorited) {
        ctx.fill();
      } else {
        ctx.stroke();
      }
      ctx.restore();

      // 7. Volume bar
      const volY = ctrlY + 110;
      const volX = cardX + artPadding;
      const volWidth = cardWidth - (artPadding * 2);
      
      // Volume track bg
      ctx.beginPath();
      ctx.roundRect(volX, volY, volWidth, 10, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fill();

      // Volume filled progress
      ctx.beginPath();
      ctx.roundRect(volX, volY, volWidth * volume, 10, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fill();

      // 8. Device selector pill button at the bottom center
      const pillY = volY + 90;
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

      // Visualizer logic (Hidden CSS fallback keeps DOM loop from crashing)
      // Render loop repeats at screen refresh rate
      animationFrameRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrame();
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
        setupWebAudio(player);
      }

      setIsRecording(true);
      recordedChunksRef.current = [];

      // Create high-res artwork image object to render inside card
      const coverImgObj = new Image();
      if (artworkUrl) {
        coverImgObj.src = artworkUrl;
      }

      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;

      // Start rendering loop immediately
      startCanvasRenderLoop(ctx, width, height, coverImgObj, isVideo, videoRef.current);

      // Capture video track at 30 fps
      const canvasStream = canvas.captureStream(30);
      
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

      // Initialize MediaRecorder
      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      let recorder;
      try {
        recorder = new MediaRecorder(outputStream, options);
      } catch (e) {
        console.warn("VP9/Opus codec not supported, trying default mimeType");
        recorder = new MediaRecorder(outputStream);
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const videoDownloadUrl = URL.createObjectURL(blob);
        
        // Trigger high-quality video download
        const a = document.createElement('a');
        a.href = videoDownloadUrl;
        a.download = `${songTitle || 'senux_player'}_render.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();

      // Ensure the player is playing while recording
      if (player.paused) {
        player.play().then(() => setIsPlaying(true));
      }
    }
  };

  // Sync seekbar and play state
  useEffect(() => {
    const handleTimeUpdate = () => {
      const player = getActivePlayer();
      if (player) setCurrentTime(player.currentTime);
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

      {/* Control Buttons on top right */}
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
        width={720} 
        height={1280} 
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
              <div className="title-container">
                <span className="song-name">{songTitle}</span>
              </div>
              <div className="song-artist">{songArtist}</div>
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
            {/* Star Favorite Button */}
            <button 
              className={`ctrl-btn small ${isFavorited ? 'favorited' : ''}`} 
              id="starBtn" 
              onClick={toggleFavorite}
            >
              <svg viewBox="0 0 24 24" fill="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>

            {/* Middle Playback buttons */}
            <div className="control-center">
              <button className="ctrl-btn small">
                <svg viewBox="0 0 24 24">
                  <polygon points="19 20 9 12 19 4 19 20" />
                  <polygon points="9 20 2 12 9 4 9 20" />
                </svg>
              </button>

              <button className="ctrl-btn play-btn" onClick={togglePlay}>
                {isPlaying ? (
                  <svg viewBox="0 0 24 24">
                    <rect x="5" y="4" width="4" height="16" />
                    <rect x="15" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24">
                    <polygon points="7.5 5 18.5 12 7.5 19 7.5 5" />
                  </svg>
                )}
              </button>

              <button className="ctrl-btn small">
                <svg viewBox="0 0 24 24">
                  <polygon points="5 4 15 12 5 20 5 4" />
                  <polygon points="15 4 22 12 15 20 15 4" />
                </svg>
              </button>
            </div>
          </div>

          {/* Volume seek section */}
          <div className="volume-section">
            <div className="vol-icon">
              <svg viewBox="0 0 24 24">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              </svg>
            </div>
            <div className="volume-track" onClick={handleVolumeChange}>
              <div className="volume-fill" style={{ width: `${volume * 100}%` }} />
            </div>
            <div className="vol-icon">
              <svg viewBox="0 0 24 24">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" fill="none" />
              </svg>
            </div>
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

      <audio ref={audioRef} style={{ display: 'none' }} />
    </>
  );
}

export default App;
