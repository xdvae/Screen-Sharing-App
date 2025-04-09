// Join.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import "./Join.css";

// Dynamic socket connection
const socket = io(
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : window.location.origin
);

function Join() {
  const { id } = useParams(); // Stream code from URL (e.g. /join/ABC123)
  const [streamCode, setStreamCode] = useState("");
  const [joined, setJoined] = useState(false);
  const [quality, setQuality] = useState("720p");
  const [broadcasterId, setBroadcasterId] = useState(null);
  const videoRef = useRef(null);
  const pc = useRef(null);

  useEffect(() => {
    socket.on("connect", () => {
      console.log("[JOIN] Connected to server");
      if (id) {
        console.log("[JOIN] Auto-joining room from URL:", id);
        setStreamCode(id);
        joinStream(id);
      }
    });

    socket.on("broadcaster_id", (data) => {
      console.log("[JOIN] Received broadcaster ID:", data.broadcasterId);
      setBroadcasterId(data.broadcasterId);
    });

    socket.on("signal", (data) => {
      console.log("[JOIN] Received signal:", data);
      const { type, data: signalData, from } = data;
      if (type === "answer") {
        pc.current
          .setRemoteDescription(new RTCSessionDescription(signalData))
          .then(() => {
            console.log("[JOIN] Set remote description with answer");
          })
          .catch((err) => console.error("[JOIN] Error setting remote description:", err));
        setBroadcasterId(from);
      } else if (type === "ice-candidate") {
        pc.current
          .addIceCandidate(new RTCIceCandidate(signalData))
          .then(() => {
            console.log("[JOIN] ICE candidate added");
          })
          .catch((err) => console.error("[JOIN] Error adding ICE candidate:", err));
      }
    });

    return () => {
      socket.off("connect");
      socket.off("signal");
      socket.off("broadcaster_id");
    };
  }, [id]);

  const joinStream = (room = streamCode) => {
    if (room.trim() !== "") {
      console.log("[JOIN] Joining room:", room);
      socket.emit("join", { room, username: "Viewer" });
      setJoined(true);
      // Request the broadcaster's socket ID.
      socket.emit("get_broadcaster", { room });

      // Create a new peer connection with a STUN server.
      pc.current = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      // Add transceiver for video in recvonly mode.
      pc.current.addTransceiver("video", { direction: "recvonly" });
      // Optionally, for audio, add:
      // pc.current.addTransceiver("audio", { direction: "recvonly" });

      pc.current.onicecandidate = (event) => {
        if (event.candidate && broadcasterId) {
          console.log("[JOIN] Sending ICE candidate to broadcaster:", event.candidate);
          socket.emit("signal", {
            room,
            type: "ice-candidate",
            data: event.candidate,
            to: broadcasterId,
          });
        }
      };

      pc.current.ontrack = (event) => {
        console.log("[JOIN] Received remote track", event.streams[0]);
        videoRef.current.srcObject = event.streams[0];
      };

      // Create an offer, set it locally, and send it.
      pc.current.createOffer()
        .then((offer) => {
          console.log("[JOIN] Created offer:", offer);
          return pc.current.setLocalDescription(offer).then(() => offer);
        })
        .then((offer) => {
          console.log("[JOIN] Sending offer to broadcaster");
          socket.emit("signal", {
            room,
            type: "offer",
            data: offer,
          });
        })
        .catch((err) => console.error("[JOIN] Error creating offer:", err));
    }
  };

  const goFullScreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      } else if (videoRef.current.webkitRequestFullscreen) {
        videoRef.current.webkitRequestFullscreen();
      } else if (videoRef.current.msRequestFullscreen) {
        videoRef.current.msRequestFullscreen();
      }
    }
  };

  return (
    <div className="join-container">
      {!joined ? (
        <div className="join-form">
          <h2>Join a Stream</h2>
          <input
            type="text"
            placeholder="Enter Stream Code"
            value={streamCode}
            onChange={(e) => setStreamCode(e.target.value)}
            className="code-input"
          />
          <button onClick={() => joinStream()} className="join-button">
            Join Stream
          </button>
          <Link to="/" className="back-button">Back to Home</Link>
        </div>
      ) : (
        <div className="join-block">
          <h2>Viewing Stream: {streamCode}</h2>
          <div className="video-container">
            <video ref={videoRef} autoPlay playsInline controls className="join-video" />
          </div>
          <div className="settings">
            <div className="option-group">
              <label htmlFor="quality">Quality:</label>
              <select id="quality" value={quality} onChange={(e) => setQuality(e.target.value)}>
                <option value="480p">480p</option>
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
                <option value="2k">2K (2560×1440)</option>
                <option value="4k">4K (3840×2160)</option>
              </select>
            </div>
            <button onClick={goFullScreen} className="fullscreen-button">
              Go Fullscreen
            </button>
          </div>
          <Link to="/" className="back-button">Back to Home</Link>
        </div>
      )}
    </div>
  );
}

export default Join;
