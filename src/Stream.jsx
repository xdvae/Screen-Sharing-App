// Stream.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import io from "socket.io-client";
import "./Stream.css";

const socket = io("http://localhost:5000");

function Stream() {
  const [broadcasting, setBroadcasting] = useState(false);
  const [streamId, setStreamId] = useState("");
  const [quality, setQuality] = useState("720p");
  const [frameRate, setFrameRate] = useState(30);
  const [includeAudio, setIncludeAudio] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);
  const videoRef = useRef(null);
  const peerConnections = useRef({});

  useEffect(() => {
    socket.on("connect", () => {
      console.log("[BROADCAST] Connected to server");
    });
    socket.on("signal", (data) => {
      console.log("[BROADCAST] Received signal:", data);
      const { type, data: signalData, from } = data;
      if (type === "offer") {
        console.log("[BROADCAST] Received offer from joiner:", from);
        // Create new peer connection with STUN server
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        peerConnections.current[from] = pc;

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log("[BROADCAST] Sending ICE candidate to joiner:", from, event.candidate);
            socket.emit("signal", {
              room: streamId,
              type: "ice-candidate",
              data: event.candidate,
              to: from,
            });
          }
        };

        // Set remote description with joiner's offer
        pc.setRemoteDescription(new RTCSessionDescription(signalData))
          .then(() => {
            console.log("[BROADCAST] Remote description set successfully for joiner:", from);
            // Add broadcaster media tracks to the connection
            if (mediaStream) {
              const tracks = mediaStream.getTracks();
              console.log("[BROADCAST] Adding tracks:", tracks);
              tracks.forEach((track) => pc.addTrack(track, mediaStream));
            } else {
              console.error("[BROADCAST] mediaStream is null. Cannot add tracks.");
            }
          })
          .then(() => {
            // Create answer after tracks are added
            return pc.createAnswer();
          })
          .then((answer) => {
            console.log("[BROADCAST] Created answer for joiner:", from, answer);
            return pc.setLocalDescription(answer).then(() => answer);
          })
          .then((answer) => {
            console.log("[BROADCAST] Local description set. Sending answer to joiner:", from);
            socket.emit("signal", {
              room: streamId,
              type: "answer",
              data: answer,
              to: from,
            });
          })
          .catch((err) => {
            console.error("[BROADCAST] Error handling offer from joiner:", from, err);
          });
      } else if (type === "ice-candidate") {
        const pc = peerConnections.current[from];
        if (pc) {
          console.log("[BROADCAST] Adding ICE candidate from joiner:", from, signalData);
          pc.addIceCandidate(new RTCIceCandidate(signalData))
            .catch((err) => console.error("[BROADCAST] Error adding ICE candidate:", err));
        } else {
          console.warn("[BROADCAST] No peer connection found for joiner:", from);
        }
      }
    });

    return () => {
      socket.off("signal");
    };
  }, [mediaStream, streamId]);

  const startBroadcast = async () => {
    const generatedId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setStreamId(generatedId);
    console.log("[BROADCAST] Generated stream ID:", generatedId);

    let width, height;
    if (quality === "480p") {
      width = 854; height = 480;
    } else if (quality === "720p") {
      width = 1280; height = 720;
    } else if (quality === "1080p") {
      width = 1920; height = 1080;
    } else if (quality === "2k") {
      width = 2560; height = 1440;
    } else if (quality === "4k") {
      width = 3840; height = 2160;
    }

    try {
      console.log("[BROADCAST] Requesting screen capture with constraints:", { width, height, frameRate, includeAudio });
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width, height, frameRate },
        audio: includeAudio,
      });
      console.log("[BROADCAST] Received media stream:", stream);
      videoRef.current.srcObject = stream;
      setMediaStream(stream);
      setBroadcasting(true);

      // Notify the server that this client is broadcasting
      socket.emit("join", { room: generatedId, username: "Broadcaster" });
      socket.emit("start_broadcast", { room: generatedId });
    } catch (err) {
      console.error("[BROADCAST] Error starting broadcast:", err);
    }
  };

  const stopBroadcast = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
      console.log("[BROADCAST] Stopped media stream.");
    }
    Object.values(peerConnections.current).forEach((pc) => pc.close());
    peerConnections.current = {};
    setBroadcasting(false);
    socket.emit("leave", { room: streamId, username: "Broadcaster" });
    console.log("[BROADCAST] Left room:", streamId);
  };

  return (
    <div className="stream-container">
      <div className="stream-block">
        <h2>Stream Your Screen</h2>
        <div className="options">
          <div className="option-group">
            <label htmlFor="quality">Quality:</label>
            <select
              id="quality"
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
            >
              <option value="480p">480p</option>
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="2k">2K (2560×1440)</option>
              <option value="4k">4K (3840×2160)</option>
            </select>
          </div>
          <div className="option-group">
            <label htmlFor="frameRate">Frame Rate (fps):</label>
            <select
              id="frameRate"
              value={frameRate}
              onChange={(e) => setFrameRate(Number(e.target.value))}
            >
              <option value={30}>30</option>
              <option value={60}>60</option>
            </select>
          </div>
          <div className="option-group">
            <label htmlFor="audio">Include Audio:</label>
            <input
              type="checkbox"
              id="audio"
              checked={includeAudio}
              onChange={(e) => setIncludeAudio(e.target.checked)}
            />
          </div>
        </div>
        {broadcasting ? (
          <button className="stop-button" onClick={stopBroadcast}>
            Stop Broadcast
          </button>
        ) : (
          <button className="start-button" onClick={startBroadcast}>
            Start Broadcast
          </button>
        )}
        {broadcasting && (
          <div className="stream-id">
            <p>Your stream code:</p>
            <h3>{streamId}</h3>
            <p>
              Share this link:{" "}
              <code>{`${window.location.origin}/join/${streamId}`}</code>
            </p>
          </div>
        )}
        <video ref={videoRef} autoPlay playsInline className="stream-video" />
        <Link to="/" className="back-button">
          Back to Home
        </Link>
      </div>
    </div>
  );
}

export default Stream;
