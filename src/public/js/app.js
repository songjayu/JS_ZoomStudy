const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call");

call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;

async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(device => device.kind === "videoinput");
    const currentCamera = myStream.getVideoTracks()[0];
    cameras.forEach(camera => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label === camera.label) {
        option.selected = true;
      }
      camerasSelect.appendChild(option);
    });
  } catch (e) {
    console.error("getCameras error:", e);
  }
}

async function getMedia(deviceId) {
  const initialConstraints = {
    audio: true,
    video: { facingMode: "user" },
  };
  const cameraConstraints = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstraints
    );
    myFace.srcObject = myStream;
    await getCameras();
  } catch (e) {
    console.error("getMedia error:", e);
  }
}

function handleMuteClick() {
  myStream.getAudioTracks().forEach(track => (track.enabled = !track.enabled));
  muteBtn.innerText = muted ? "Mute" : "Unmute";
  muted = !muted;
}

function handleCameraClick() {
  myStream.getVideoTracks().forEach(track => (track.enabled = !track.enabled));
  cameraBtn.innerText = cameraOff ? "Turn Camera Off" : "Turn Camera On";
  cameraOff = !cameraOff;
}

async function handleCameraChange() {
  await getMedia(camerasSelect.value);
  if (myPeerConnection) {
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = myPeerConnection
      .getSenders()
      .find(sender => sender.track.kind === "video");
    videoSender.replaceTrack(videoTrack);
  }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall() {
  console.log("initCall");
  welcome.hidden = true;
  call.hidden = false;
  await getMedia();
  makeConnection();
}

async function handleWelcomeSubmit(event) {
  event.preventDefault();
  const input = welcomeForm.querySelector("input");
  roomName = input.value;
  await initCall();
  socket.emit("join_room", roomName);
  input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

socket.on("welcome", async () => {
  console.log("Received welcome - creating offer");
  const offer = await myPeerConnection.createOffer();
  await myPeerConnection.setLocalDescription(offer);
  socket.emit("offer", offer, roomName);
});

socket.on("offer", async (offer) => {
  console.log("Received offer - sending answer");
  await myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  await myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName);
});

socket.on("answer", async (answer) => {
  console.log("Received answer");
  await myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", async (ice) => {
  console.log("Received ICE candidate");
  await myPeerConnection.addIceCandidate(ice);
});

function makeConnection() {
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: ["stun:stun.l.google.com:19302"] },
    ],
  });
  myPeerConnection.addEventListener("icecandidate", handleIce);
  myPeerConnection.addEventListener("track", handleTrack);
  myStream.getTracks().forEach(track => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data) {
  console.log("Sending ICE candidate");
  socket.emit("ice", data.candidate, roomName);
}

function handleTrack(data) {
  console.log("Remote stream added");
  const peersFace = document.getElementById("peersFace");
  peersFace.srcObject = data.streams[0];
}
