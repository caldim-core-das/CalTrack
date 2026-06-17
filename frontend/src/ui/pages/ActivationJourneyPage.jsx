import React, { useState, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { routes } from "../routes.js"
import { CalTrackLogo } from "../components/CalTrackLogo.jsx"
import {
  apiFetchRegistrationDossier,
  apiSaveRegistrationDossier,
  apiDeleteRegistrationDossier,
  apiSendOTP,
  apiVerifyOTP
} from "../../api/authService.js"
import { detectFaceInVideo } from "../../utils/faceVerify.js"
import {
  Check, ArrowRight, ShieldCheck, Cpu, User, Mail, Phone,
  MapPin, CheckCircle, AlertCircle, Camera, Award,
  Play, Video, PhoneCall, RefreshCcw, Lock, ExternalLink,
  ChevronRight, Sparkles, FileText, CheckSquare, XCircle, Clock,
  KeyRound, ShieldAlert, CheckCircle2, UserCheck, Info,
  Volume2, VolumeX, Minimize, Maximize, Upload, Database,
  Fingerprint, FileCheck, PhoneIncoming, Globe
} from "lucide-react"

// Embedded styling for high-fidelity holographic aesthetics
const holographicStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;800;900&family=Plus+Jakarta+Sans:wght@300;400;600;700;800&family=Space+Mono:wght@400;700&display=swap');

  .futuristic-container {
    font-family: 'Plus Jakarta Sans', sans-serif;
    background-color: #F8FAFC;
    background-image: 
      radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.08) 0px, transparent 50%),
      radial-gradient(at 100% 100%, rgba(16, 185, 129, 0.06) 0px, transparent 50%),
      radial-gradient(at 50% 50%, rgba(139, 92, 246, 0.05) 0px, transparent 50%);
    color: #0F172A;
    min-height: 100vh;
    overflow-x: hidden;
    position: relative;
  }

  .font-orbitron {
    font-family: 'Orbitron', sans-serif;
  }

  .font-mono {
    font-family: 'Space Mono', monospace;
  }

  /* Laser line scanner animation */
  .laser-scan-overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(rgba(255, 255, 255, 0) 50%, rgba(255, 255, 255, 0.15) 50%), 
                linear-gradient(90deg, rgba(37, 99, 235, 0.03), rgba(16, 185, 129, 0.02), rgba(37, 99, 235, 0.03));
    z-index: 5;
    pointer-events: none;
    background-size: 100% 4px, 6px 100%;
  }

  .laser-bar {
    position: absolute;
    left: 0; width: 100%; height: 3px;
    background: linear-gradient(to right, transparent, #3b82f6, #10b981, #3b82f6, transparent);
    box-shadow: 0 0 10px #3b82f6, 0 0 18px #10b981;
    animation: scanner-movement 3s infinite linear;
    z-index: 10;
  }

  @keyframes scanner-movement {
    0% { top: 0%; }
    50% { top: 100%; }
    100% { top: 0%; }
  }

  /* Glass HUD Cards */
  .hud-card {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(0, 0, 0, 0.08);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.04);
  }

  .hud-card-active {
    border: 1px solid rgba(59, 130, 246, 0.4);
    box-shadow: 0 0 30px rgba(59, 130, 246, 0.08);
  }

  .cyber-input {
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(0, 0, 0, 0.12);
    color: #0F172A;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .cyber-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 15px rgba(59, 130, 246, 0.15);
    background: #ffffff;
    outline: none;
  }

  .glow-btn-blue {
    background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%);
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.2);
    transition: all 0.25s ease;
  }
  .glow-btn-blue:hover:not(:disabled) {
    transform: translateY(-1.5px);
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.3);
  }

  .glow-btn-green {
    background: linear-gradient(135deg, #047857 0%, #10b981 100%);
    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.2);
    transition: all 0.25s ease;
  }
  .glow-btn-green:hover:not(:disabled) {
    transform: translateY(-1.5px);
    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3);
  }

  .neon-text-blue {
    text-shadow: 0 0 8px rgba(59, 130, 246, 0.2);
  }
  .neon-text-green {
    text-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
  }

  /* Audio spectrum waves animation */
  .sound-bar {
    width: 3px;
    background-color: #3b82f6;
    border-radius: 3px;
    animation: bounce-wave 0.8s ease-in-out infinite alternate;
  }

  @keyframes bounce-wave {
    0% { height: 6px; }
    100% { height: 36px; }
  }

  .glitch-hud {
    position: relative;
    animation: glitch-skew 4s infinite linear alternate-reverse;
  }
  @keyframes glitch-skew {
    0% { transform: skew(0deg); }
    20% { transform: skew(0.5deg); }
    21% { transform: skew(-1deg); }
    25% { transform: skew(0deg); }
    100% { transform: skew(0deg); }
  }

  /* Light Theme Class overrides to keep tailwind classes readable */
  .futuristic-container .text-white:not(button):not(button *):not(.glow-btn-blue):not(.glow-btn-blue *):not(.glow-btn-green):not(.glow-btn-green *):not(.bg-indigo-600):not(.bg-indigo-600 *) {
    color: #0F172A !important;
  }
  .futuristic-container .text-slate-200:not(button):not(button *):not(.glow-btn-blue):not(.glow-btn-blue *):not(.glow-btn-green):not(.glow-btn-green *) {
    color: #1E293B !important;
  }
  .futuristic-container .text-slate-300:not(button):not(button *):not(.glow-btn-blue):not(.glow-btn-blue *):not(.glow-btn-green):not(.glow-btn-green *) {
    color: #334155 !important;
  }
  .futuristic-container .text-slate-400:not(button):not(button *):not(.glow-btn-blue):not(.glow-btn-blue *):not(.glow-btn-green):not(.glow-btn-green *) {
    color: #475569 !important;
  }
  .futuristic-container .text-slate-500:not(button):not(button *):not(.glow-btn-blue):not(.glow-btn-blue *):not(.glow-btn-green):not(.glow-btn-green *) {
    color: #64748B !important;
  }
  .futuristic-container .text-slate-600:not(button):not(button *):not(.glow-btn-blue):not(.glow-btn-blue *):not(.glow-btn-green):not(.glow-btn-green *) {
    color: #94A3B8 !important;
  }
  .futuristic-container .text-slate-650 {
    color: #475569 !important;
  }
  .futuristic-container .text-slate-355 {
    color: #334155 !important;
  }
  .futuristic-container .text-slate-750 {
    color: #475569 !important;
  }
  .futuristic-container .text-rose-450 {
    color: #E11D48 !important;
  }
  .futuristic-container .text-rose-400 {
    color: #E11D48 !important;
  }
  .futuristic-container .text-indigo-400:not(button):not(button *):not(.glow-btn-blue):not(.glow-btn-blue *):not(.glow-btn-green):not(.glow-btn-green *) {
    color: #4F46E5 !important;
  }
  .futuristic-container .text-blue-400:not(button):not(button *):not(.glow-btn-blue):not(.glow-btn-blue *):not(.glow-btn-green):not(.glow-btn-green *) {
    color: #2563EB !important;
  }
  .futuristic-container .text-emerald-400:not(button):not(button *):not(.glow-btn-blue):not(.glow-btn-blue *):not(.glow-btn-green):not(.glow-btn-green *) {
    color: #059669 !important;
  }
  .futuristic-container .border-slate-850 {
    border-color: rgba(0, 0, 0, 0.08) !important;
  }
  .futuristic-container .border-slate-750 {
    border-color: rgba(0, 0, 0, 0.12) !important;
  }
  .futuristic-container .border-blue-500\\/10 {
    border-color: rgba(59, 130, 246, 0.15) !important;
  }
  /* Reset Dossier Button Override */
  .futuristic-container .border-rose-500\\/30 {
    background-color: rgba(239, 68, 68, 0.05) !important;
    border: 1px solid rgba(239, 68, 68, 0.2) !important;
    color: #DC2626 !important;
  }
  .futuristic-container .border-rose-500\\/30:hover {
    background-color: rgba(239, 68, 68, 0.1) !important;
    border-color: rgba(239, 68, 68, 0.4) !important;
  }

  /* Auto-Fill Dossier Button Override */
  .futuristic-container .border-indigo-500\\/30 {
    background: #4F46E5 !important;
    border: 1px solid #4F46E5 !important;
    color: #FFFFFF !important;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
  }
  .futuristic-container .border-indigo-500\\/30:hover {
    background: #4338CA !important;
    border-color: #4338CA !important;
  }
  .futuristic-container .border-indigo-500\\/30 svg {
    color: #FFFFFF !important;
  }

  /* Back to Login Button Override */
  .futuristic-container .border-blue-500\\/30 {
    background: #FFFFFF !important;
    border: 1px solid #D1D5DB !important;
    color: #374151 !important;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
  }
  .futuristic-container .border-blue-500\\/30:hover {
    background: #F9FAFB !important;
    border-color: #C7D2FE !important;
    color: #1F2937 !important;
  }
  .futuristic-container .bg-slate-950\\/40 {
    background-color: #FFFFFF !important;
    border: 1px solid rgba(0, 0, 0, 0.08) !important;
  }
  .futuristic-container .bg-slate-950 {
    background-color: #FFFFFF !important;
  }
  .futuristic-container .bg-\\[\\#090e1a\\] {
    background-color: #F1F5F9 !important;
  }
  .futuristic-container .bg-\\[\\#060a14\\] {
    background-color: #E2E8F0 !important;
  }
  .futuristic-container .bg-\\[\\#050812\\] {
    background-color: #0F172A !important;
  }
  .futuristic-container .bg-\\[\\#090f23\\] {
    background-color: #0F172A !important;
  }
  .futuristic-container .bg-\\[\\#090e1c\\] {
    background-color: #FFFFFF !important;
  }
  .futuristic-container .bg-rose-500\\/10 {
    background-color: rgba(244, 63, 94, 0.08) !important;
  }
  .futuristic-container .bg-indigo-500\\/10 {
    background-color: rgba(99, 102, 241, 0.08) !important;
  }
  .futuristic-container .bg-blue-500\\/10 {
    background-color: rgba(59, 130, 246, 0.08) !important;
  }
  .futuristic-container .bg-emerald-500\\/10 {
    background-color: rgba(16, 185, 129, 0.08) !important;
  }
  .futuristic-container .glass-panel {
    background: rgba(255, 255, 255, 0.8) !important;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important;
  }
  .futuristic-container .bg-slate-950\\/80 {
    background-color: rgba(255, 255, 255, 0.9) !important;
  }
  .futuristic-container .bg-slate-950\\/70 {
    background-color: rgba(255, 255, 255, 0.8) !important;
  }
  .futuristic-container .bg-slate-950\\/60 {
    background-color: #FFFFFF !important;
    border: 1px solid rgba(0, 0, 0, 0.08) !important;
  }
  .futuristic-container .bg-slate-900\\/40 {
    background-color: #FFFFFF !important;
    border: 1px solid rgba(0, 0, 0, 0.08) !important;
  }
  .futuristic-container .bg-blue-950\\/20 {
    background-color: rgba(59, 130, 246, 0.04) !important;
    border: 1px solid rgba(59, 130, 246, 0.15) !important;
  }
  
  /* Preserve text colors in dark widgets (console, video, holographic pass) */
  .futuristic-container .bg-\\[\\#090f23\\] * {
    color: inherit !important;
  }
  .futuristic-container .bg-\\[\\#090f23\\] .text-blue-500 {
    color: #3b82f6 !important;
  }
  .futuristic-container .bg-\\[\\#050812\\] * {
    color: inherit !important;
  }
  
  /* Preserve high contrast text on buttons and dark cards */
  .futuristic-container button.text-white {
    color: #FFFFFF !important;
  }
  .futuristic-container .glow-btn-blue, .futuristic-container .glow-btn-green {
    color: #FFFFFF !important;
  }
  .futuristic-container .bg-gradient-to-r.from-blue-600 {
    color: #FFFFFF !important;
  }
  .futuristic-container .bg-gradient-to-r.from-blue-600 * {
    color: #FFFFFF !important;
  }
  
  /* Preserve text inside holographic active pass */
  .futuristic-container .bg-gradient-to-tr.from-slate-950 * {
    color: inherit !important;
  }
  .futuristic-container .bg-gradient-to-tr.from-slate-950 .text-white {
    color: #FFFFFF !important;
  }
  .futuristic-container .bg-gradient-to-tr.from-slate-950 .text-slate-400 {
    color: #94A3B8 !important;
  }
  .futuristic-container .bg-gradient-to-tr.from-slate-950 .text-slate-500 {
    color: #64748B !important;
  }
  .futuristic-container .bg-gradient-to-tr.from-slate-950 .text-slate-200 {
    color: #E2E8F0 !important;
  }
  .futuristic-container .bg-gradient-to-tr.from-slate-950 .text-slate-300 {
    color: #CBD5E1 !important;
  }
`

// Standalone dynamically-rendered SVG document generators (returns Base64 SVG URI)
const generateAadhaarSVG = (name, profilePic, idNumber) => {
  const photo = profilePic || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23E2E8F0'/><circle cx='50' cy='35' r='18' fill='%2394A3B8'/><path d='M20,80 Q50,55 80,80 Z' fill='%2394A3B8'/></svg>";
  const number = idNumber || "3662-8829-1092";
  const cleanName = name ? name.replace(/'/g, "&apos;") : "Candidate Name";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380" width="600" height="380">
    <rect width="600" height="380" rx="20" fill="#F9FBF7" stroke="#E0E4DC" stroke-width="4"/>
    <rect x="4" y="4" width="592" height="60" rx="16" fill="#FF9933"/>
    <text x="300" y="42" fill="#FFFFFF" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle">GOVERNMENT OF INDIA</text>
    <text x="300" y="85" fill="#333333" font-family="sans-serif" font-size="15" font-weight="bold" text-anchor="middle">UNIQUE IDENTIFICATION AUTHORITY OF INDIA</text>
    <circle cx="65" cy="140" r="30" fill="none" stroke="#000088" stroke-width="2"/>
    <circle cx="65" cy="140" r="25" fill="none" stroke="#000088" stroke-dasharray="2 2" stroke-width="2"/>
    
    <clipPath id="photo-clip-aadhaar">
      <rect x="50" y="120" width="110" height="130" rx="8" />
    </clipPath>
    <image x="50" y="120" width="110" height="130" href="${photo}" clip-path="url(#photo-clip-aadhaar)" preserveAspectRatio="xMidYMid slice" />
    <rect x="50" y="120" width="110" height="130" rx="8" fill="none" stroke="#B0B0B0" stroke-width="2"/>

    <text x="180" y="140" fill="#222" font-family="sans-serif" font-size="18" font-weight="bold">${cleanName}</text>
    <text x="180" y="165" fill="#555" font-family="sans-serif" font-size="14">DOB: 15/08/1994</text>
    <text x="180" y="190" fill="#555" font-family="sans-serif" font-size="14">Gender: Male</text>
    
    <text x="300" y="280" fill="#B91C1C" font-family="sans-serif" font-size="32" font-weight="bold" letter-spacing="4" text-anchor="middle">${number}</text>
    <text x="300" y="310" fill="#008000" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">Aadhaar - ordinary resident's identity</text>
    <rect x="4" y="340" width="592" height="36" rx="12" fill="#128807"/>
  </svg>`;

  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
};

const generatePanSVG = (name, profilePic, idNumber) => {
  const photo = profilePic || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23E2E8F0'/><circle cx='50' cy='35' r='18' fill='%2394A3B8'/><path d='M20,80 Q50,55 80,80 Z' fill='%2394A3B8'/></svg>";
  const number = idNumber || "BCHPA8892P";
  const cleanName = name ? name.toUpperCase().replace(/'/g, "&apos;") : "CANDIDATE NAME";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380" width="600" height="380">
    <rect width="600" height="380" rx="20" fill="#EAF2F8" stroke="#A9CCE3" stroke-width="4"/>
    <rect x="4" y="4" width="592" height="60" rx="16" fill="#2980B9"/>
    <text x="300" y="42" fill="#FFFFFF" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle">INCOME TAX DEPARTMENT</text>
    <text x="300" y="85" fill="#1B4F72" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">GOVT. OF INDIA</text>
    
    <clipPath id="photo-clip-pan">
      <rect x="50" y="120" width="110" height="130" rx="8" />
    </clipPath>
    <image x="50" y="120" width="110" height="130" href="${photo}" clip-path="url(#photo-clip-pan)" preserveAspectRatio="xMidYMid slice" />
    <rect x="50" y="120" width="110" height="130" rx="8" fill="none" stroke="#B0B0B0" stroke-width="2"/>

    <text x="180" y="140" fill="#222" font-family="sans-serif" font-size="14" font-weight="bold">Name / Name</text>
    <text x="180" y="165" fill="#000" font-family="sans-serif" font-size="16" font-weight="bold">${cleanName}</text>
    <text x="180" y="200" fill="#222" font-family="sans-serif" font-size="14" font-weight="bold">Father's Name</text>
    <text x="180" y="220" fill="#000" font-family="sans-serif" font-size="15" font-weight="bold">RAM PRAKASH</text>
    <text x="50" y="295" fill="#222" font-family="sans-serif" font-size="14" font-weight="bold">Date of Birth</text>
    <text x="50" y="315" fill="#000" font-family="sans-serif" font-size="15" font-weight="bold">15/08/1994</text>
    <text x="350" y="295" fill="#222" font-family="sans-serif" font-size="14" font-weight="bold">Permanent Account Number</text>
    <text x="350" y="320" fill="#B91C1C" font-family="sans-serif" font-size="24" font-weight="bold" letter-spacing="2">${number}</text>
    <rect x="4" y="340" width="592" height="36" rx="12" fill="#1F618D"/>
  </svg>`;

  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
};

const generateDrivingLicenseSVG = (name, dlNum) => {
  const number = dlNum || "DL-1420110023456";
  const cleanName = name ? name.toUpperCase().replace(/'/g, "&apos;") : "CANDIDATE NAME";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380" width="600" height="380">
    <rect width="600" height="380" rx="20" fill="#F4F6F7" stroke="#BDC3C7" stroke-width="4"/>
    <rect x="4" y="4" width="592" height="60" rx="16" fill="#1E8449"/>
    <text x="300" y="42" fill="#FFFFFF" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle">TRANSPORT DEPARTMENT</text>
    <text x="300" y="85" fill="#196F3D" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">DRIVING LICENSE - GOVT. OF INDIA</text>
    <rect x="45" y="120" width="510" height="200" rx="10" fill="#FFFFFF" stroke="#D5DBDB" stroke-width="2"/>
    <text x="70" y="165" fill="#555" font-family="sans-serif" font-size="14" font-weight="bold">Name:</text>
    <text x="220" y="165" fill="#000" font-family="sans-serif" font-size="14" font-weight="bold">${cleanName}</text>
    <text x="70" y="205" fill="#555" font-family="sans-serif" font-size="14" font-weight="bold">License Number:</text>
    <text x="220" y="205" fill="#B91C1C" font-family="sans-serif" font-size="16" font-weight="bold">${number}</text>
    <text x="70" y="245" fill="#555" font-family="sans-serif" font-size="14" font-weight="bold">Class of Vehicle:</text>
    <text x="220" y="245" fill="#000" font-family="sans-serif" font-size="14" font-weight="bold">LMV / MCWG</text>
    <text x="70" y="285" fill="#555" font-family="sans-serif" font-size="14" font-weight="bold">Validity:</text>
    <text x="220" y="285" fill="#000" font-family="sans-serif" font-size="14" font-weight="bold">Non-Transport: 14/08/2034</text>
    <rect x="4" y="340" width="592" height="36" rx="12" fill="#1E8449"/>
  </svg>`;

  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
};


const maskPhoneNumber = (phone) => {
  if (!phone) return ""
  const str = String(phone).trim()
  if (str.length > 7) {
    return str.slice(0, 3) + "*".repeat(str.length - 7) + str.slice(-4)
  }
  if (str.length > 4) {
    return str.slice(0, 1) + "*".repeat(str.length - 3) + str.slice(-2)
  }
  return str
}

export function ActivationJourneyPage() {
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState(1)
  const [timelineProgress, setTimelineProgress] = useState(20)
  const [regSubStep, setRegSubStep] = useState(1) // 1: Contact, 2: OTP, 3: Biometrics
  const [resendCooldown, setResendCooldown] = useState(0)
  const [otpDeliveryChannel, setOtpDeliveryChannel] = useState("console")

  // ── Step 1: Registration State ──
  const [regForm, setRegForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    profilePic: null,
    otpStatus: "unverified", // "unverified", "sending", "sent", "verified"
    otpTimer: 0,

    isBiometricScanning: false,
    isBiometricCompleted: false,
    isCompleted: false,
    regDate: ""
  })

  // ── Step 2: Document Verification State ──
  const [docForm, setDocForm] = useState({
    aadhaarId: "",
    panId: "",
    drivingLicenseId: "",
    aadhaarFile: null,
    panFile: null,
    drivingLicenseFile: null,
    isValidating: false,
    validationLog: [],
    validationProgress: 0,
    confidenceScore: 0,
    isCompleted: false
  })

  // ── Step 3: Video Training Academy State ──
  const [academyState, setAcademyState] = useState({
    modules: [
      { id: 1, title: "Caltrack Compliance & Operations Overview", duration: 20, completed: false, isPlaying: false, progress: 0 },
    ],
    activeModuleId: null,
    isVideoPlaying: false,
    videoDurationElapsed: 0,
    isCompleted: false
  })

  // ── Step 4: Video Interview State ──
  const [interviewState, setInterviewState] = useState({
    status: "Passed",
    activeQuestionIndex: 0,
    callDuration: 12,
    subtitles: "",
    soundWaveActive: false,
    interviewLogs: [
      { sender: "System", text: "Compliance WebRTC check bypassed by system configuration." }
    ],
    isCompleted: true
  })

  // Helper function to return dynamic interview questions mapped to current user
  const getInterviewQuestions = () => {
    const firstName = regForm.fullName.trim().split(" ")[0] || "Technician"
    return [
      { text: `Interviewer: 'Welcome ${firstName}! Let's start the L1 compliance validation. Can you confirm your previous work duration?'`, option1: "Verify 3+ Years of Electrician logs", option2: "Explain project history directly" },
      { text: "Interviewer: 'Perfect. How do you handle emergency safety outages on-site?'", option1: "Follow Caltrack emergency geofence lock", option2: "Report manually to supervisor panel" },
      { text: "Interviewer: 'Final question. Do you agree to comply with Caltrack's SLA and anti-fraud protocols?'", option1: "Accept all compliance guidelines", option2: "Confirm standard operational policies" }
    ]
  }

  const interviewQuestions = getInterviewQuestions()

  // ── Step 5: Admin Review State ──
  const [adminClearance, setAdminClearance] = useState({
    status: "pending", // "pending", "approved", "rejected"
    remarks: ""
  })

  const [otpCode, setOtpCode] = useState("")

  const [showActivePass, setShowActivePass] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [showRejectionDialog, setShowRejectionDialog] = useState(false)
  const [generatedPhoneOtp, setGeneratedPhoneOtp] = useState("")

  const [hudToast, setHudToast] = useState(null)

  const [rejectionRemarks, setRejectionRemarks] = useState("")
  const [uploadingDocs, setUploadingDocs] = useState({})
  const [activeQuiz, setActiveQuiz] = useState(null)

  // Calculate overall score
  const activeScore = useMemo(() => {
    let pts = 20
    if (regForm.otpStatus === "verified") pts += 25
    if (regForm.isBiometricCompleted) pts += 15
    if (docForm.isCompleted) pts += 20
    if (academyState.isCompleted) pts += 20
    return Math.min(pts, 100)
  }, [
    regForm.otpStatus,
    regForm.isBiometricCompleted,
    docForm.isCompleted,
    academyState.isCompleted
  ])

  // Save dossier to localStorage and backend
  useEffect(() => {
    if (regForm.fullName) {
      const dossier = {
        regForm,
        docForm,
        academyState,
        interviewState,
        adminClearance,
        trustScore: activeScore
      }
      localStorage.setItem("caltrack_activation_dossier", JSON.stringify(dossier))
      apiSaveRegistrationDossier(dossier)
    }
  }, [regForm, docForm, academyState, interviewState, adminClearance, activeScore])

  // Load saved dossier on mount, and listen to storage events for clearance status updates
  useEffect(() => {
    async function load() {
      // Try backend first
      const backendDossier = await apiFetchRegistrationDossier()
      if (backendDossier && backendDossier.regForm?.fullName) {
        if (backendDossier.regForm) setRegForm(backendDossier.regForm)
        if (backendDossier.docForm) {
          const doc = { ...backendDossier.docForm }
          if (doc.isValidating && !doc.isCompleted) {
            doc.isValidating = false
            doc.validationProgress = 0
            doc.validationLog = []
          }
          setDocForm(doc)
        }
        if (backendDossier.academyState) setAcademyState(backendDossier.academyState)
        if (backendDossier.interviewState) setInterviewState(backendDossier.interviewState)
        if (backendDossier.adminClearance) setAdminClearance(backendDossier.adminClearance)

        let step = 1
        if (backendDossier.academyState?.isCompleted) {
          step = 4
        } else if (backendDossier.docForm?.isCompleted) {
          step = 3
        } else if (backendDossier.regForm?.isCompleted) {
          step = 2
        }
        setActiveStep(step)

        const cleanedDossier = {
          ...backendDossier,
          docForm: backendDossier.docForm ? {
            ...backendDossier.docForm,
            isValidating: backendDossier.docForm.isCompleted ? backendDossier.docForm.isValidating : false,
            validationProgress: backendDossier.docForm.isCompleted ? backendDossier.docForm.validationProgress : 0,
            validationLog: backendDossier.docForm.isCompleted ? backendDossier.docForm.validationLog : []
          } : null
        }
        localStorage.setItem("caltrack_activation_dossier", JSON.stringify(cleanedDossier))
        return
      }

      // Fallback to localStorage
      const saved = localStorage.getItem("caltrack_activation_dossier")
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed.regForm) setRegForm(parsed.regForm)
          if (parsed.docForm) {
            const doc = { ...parsed.docForm }
            if (doc.isValidating && !doc.isCompleted) {
              doc.isValidating = false
              doc.validationProgress = 0
              doc.validationLog = []
            }
            setDocForm(doc)
          }
          if (parsed.academyState) setAcademyState(parsed.academyState)
          if (parsed.interviewState) setInterviewState(parsed.interviewState)
          if (parsed.adminClearance) setAdminClearance(parsed.adminClearance)

          let step = 1
          if (parsed.academyState?.isCompleted) {
            step = 4
          } else if (parsed.docForm?.isCompleted) {
            step = 3
          } else if (parsed.regForm?.isCompleted) {
            step = 2
          }
          setActiveStep(step)

          const cleanedParsed = {
            ...parsed,
            docForm: parsed.docForm ? {
              ...parsed.docForm,
              isValidating: parsed.docForm.isCompleted ? parsed.docForm.isValidating : false,
              validationProgress: parsed.docForm.isCompleted ? parsed.docForm.validationProgress : 0,
              validationLog: parsed.docForm.isCompleted ? parsed.docForm.validationLog : []
            } : null
          }
          apiSaveRegistrationDossier(cleanedParsed)
        } catch (e) {
          console.error("Failed to load saved activation dossier", e)
        }
      }
    }
    load()
  }, [])

  // Listen / poll for admin approval changes
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "caltrack_activation_dossier") {
        try {
          const parsed = JSON.parse(e.newValue)
          if (parsed.adminClearance) {
            setAdminClearance(parsed.adminClearance)
            if (parsed.adminClearance.status === "approved") {
              setShowCelebration(true)
            }
          }
        } catch (err) { }
      }
    }
    window.addEventListener("storage", handleStorageChange)

    const interval = setInterval(async () => {
      // Try backend first
      const backendDossier = await apiFetchRegistrationDossier()
      if (backendDossier && backendDossier.adminClearance) {
        localStorage.setItem("caltrack_activation_dossier", JSON.stringify(backendDossier))
        if (backendDossier.adminClearance.status !== adminClearance.status) {
          setAdminClearance(backendDossier.adminClearance)
          if (backendDossier.adminClearance.status === "approved" && !showCelebration) {
            setShowCelebration(true)
          }
        }
        return
      }

      // Fallback to local storage polling
      const saved = localStorage.getItem("caltrack_activation_dossier")
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed.adminClearance && parsed.adminClearance.status !== adminClearance.status) {
            setAdminClearance(parsed.adminClearance)
            if (parsed.adminClearance.status === "approved" && !showCelebration) {
              setShowCelebration(true)
            }
          }
        } catch (err) { }
      }
    }, 1500)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      clearInterval(interval)
    }
  }, [adminClearance.status, showCelebration])

  const quizzes = [
    {
      moduleId: 1,
      question: "What is Caltrack's primary workforce intelligence methodology?",
      options: ["A) Manual paper sign-in registers", "B) Real-time AI-driven operational telemetry", "C) Unregulated tracking without data safety"],
      correctIdx: 1
    }
  ]

  // Reference loops for intervals
  const otpTimerRef = useRef(null)
  const resendCooldownRef = useRef(null)

  const validationRef = useRef(null)
  const videoRef = useRef(null)
  const callRef = useRef(null)
  const webcamVideoRef = useRef(null)
  const logConsoleRef = useRef(null)
  const aadhaarInputRef = useRef(null)
  const panInputRef = useRef(null)
  const dlInputRef = useRef(null)

  // Auto scroll validation log console in Step 2
  useEffect(() => {
    if (logConsoleRef.current) {
      logConsoleRef.current.scrollTop = logConsoleRef.current.scrollHeight
    }
  }, [docForm.validationLog])

  // Track progress and update the timeline HUD
  useEffect(() => {
    let completedSteps = 0
    if (regForm.isCompleted) completedSteps++
    if (docForm.isCompleted) completedSteps++
    if (academyState.isCompleted) completedSteps++
    if (adminClearance.status === "approved") completedSteps++

    const progress = Math.min((completedSteps / 4) * 100 + 20, 100)
    setTimelineProgress(progress)
  }, [regForm.isCompleted, docForm.isCompleted, academyState.isCompleted, adminClearance.status])

  // Timers for OTP & Email
  useEffect(() => {
    if (regForm.otpTimer > 0) {
      otpTimerRef.current = setInterval(() => {
        setRegForm(prev => ({ ...prev, otpTimer: prev.otpTimer - 1 }))
      }, 1000)
    } else {
      clearInterval(otpTimerRef.current)
    }
    return () => clearInterval(otpTimerRef.current)
  }, [regForm.otpTimer])

  // Resend Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      resendCooldownRef.current = setInterval(() => {
        setResendCooldown(prev => prev - 1)
      }, 1000)
    } else {
      clearInterval(resendCooldownRef.current)
    }
    return () => clearInterval(resendCooldownRef.current)
  }, [resendCooldown])

  // Keep dynamically-generated documents in sync with registration updates
  useEffect(() => {
    if (docForm.isCompleted && regForm.fullName) {
      setDocForm(prev => {
        const newAadhaar = prev.aadhaarFileFileData && !prev.aadhaarFileFileData.startsWith("data:image/svg+xml")
          ? prev.aadhaarFileFileData
          : generateAadhaarSVG(regForm.fullName, regForm.profilePic, prev.aadhaarId);
        const newPan = prev.panFileFileData && !prev.panFileFileData.startsWith("data:image/svg+xml")
          ? prev.panFileFileData
          : generatePanSVG(regForm.fullName, regForm.profilePic, prev.panId);
        const newDL = prev.drivingLicenseFileFileData && !prev.drivingLicenseFileFileData.startsWith("data:image/svg+xml")
          ? prev.drivingLicenseFileFileData
          : generateDrivingLicenseSVG(regForm.fullName, prev.drivingLicenseId);

        if (newAadhaar !== prev.aadhaarFileFileData || newPan !== prev.panFileFileData || newDL !== prev.drivingLicenseFileFileData) {
          return {
            ...prev,
            aadhaarFileFileData: newAadhaar,
            panFileFileData: newPan,
            drivingLicenseFileFileData: newDL
          };
        }
        return prev;
      });
    }
  }, [regForm.fullName, regForm.profilePic])



  // ── STEP 1: FUNCTIONS ──
  const triggerMobileOTP = async () => {
    if (!regForm.phone) return alert("Please enter a phone number first.")
    setRegForm(prev => ({ ...prev, otpStatus: "sending" }))
    try {
      const res = await apiSendOTP(regForm.phone)
      if (res.code) {
        setGeneratedPhoneOtp(res.code)
      } else {
        setGeneratedPhoneOtp("SENT")
      }
      setOtpDeliveryChannel(res.delivery_channel || "console")
      setResendCooldown(30)
      setRegForm(prev => ({ ...prev, otpStatus: "sent", otpTimer: 59 }))
      setHudToast({
        type: "sms",
        title: "SMS GATEWAY ALERT",
        msg: res.code
          ? `Caltrack security verification code sent to ${regForm.phone}: ${res.code}`
          : `Caltrack security verification code sent to ${regForm.phone}`
      })
      setTimeout(() => setHudToast(null), 8000)
    } catch (err) {
      setRegForm(prev => ({ ...prev, otpStatus: "unverified" }))
      alert("Failed to send OTP: " + (err.body?.detail || err.body?.message || JSON.stringify(err)))
    }
  }

  const confirmMobileOTP = async () => {
    if (!otpCode) return alert("Please enter the verification code.")
    try {
      await apiVerifyOTP(regForm.phone, otpCode)
      setRegForm(prev => ({ ...prev, otpStatus: "verified" }))
    } catch (err) {
      alert("Verification failed: " + (err.body?.detail || err.body?.message || "Invalid or expired OTP code."))
    }
  }



  const triggerBiometricScan = () => {
    setRegForm(prev => ({ ...prev, isBiometricScanning: true }))

    // Attempt local webcam access
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          if (webcamVideoRef.current) {
            webcamVideoRef.current.srcObject = stream
          }
        })
        .catch(e => {
          console.error("Camera access failed", e)
          setRegForm(prev => ({ ...prev, isBiometricScanning: false }))
          alert("Camera access denied or unavailable. Please enable webcam permissions to proceed.")
        })
    } else {
      setRegForm(prev => ({ ...prev, isBiometricScanning: false }))
      alert("Camera hardware access is not supported on this browser device.")
    }
  }

  const capturePhotoAndContinue = () => {
    let capturedPic = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23090F1C'/><circle cx='50' cy='35' r='18' fill='%233B82F6' opacity='0.5'/><path d='M20,80 Q50,55 80,80 Z' fill='%2310B981' opacity='0.6'/><path d='M30,40 Q30,20 50,20 Q70,20 70,40 Q70,68 50,78 Q30,68 30,40 Z' fill='none' stroke='%233B82F6' stroke-width='1.5'/></svg>"
    
    try {
      if (webcamVideoRef.current && webcamVideoRef.current.srcObject) {
        const video = webcamVideoRef.current
        const canvas = document.createElement("canvas")
        canvas.width = video.videoWidth || 320
        canvas.height = video.videoHeight || 240
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.translate(canvas.width, 0)
          ctx.scale(-1, 1)
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          capturedPic = canvas.toDataURL("image/png")
        }
      }
    } catch (err) {
      console.warn("Failed to capture webcam frame, using fallback", err)
    }

    // Stop webcam stream
    if (webcamVideoRef.current?.srcObject) {
      const stream = webcamVideoRef.current.srcObject
      stream.getTracks().forEach(track => track.stop())
      webcamVideoRef.current.srcObject = null
    }

    const formattedDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    
    setRegForm(prev => ({
      ...prev,
      isBiometricScanning: false,
      isBiometricCompleted: true,
      profilePic: capturedPic,
      isCompleted: true,
      regDate: formattedDate
    }))

    setHudToast({
      type: "biometric",
      title: "PHOTO CAPTURED",
      msg: "Selfie captured successfully. Proceeding to Document Verification."
    })
    setTimeout(() => setHudToast(null), 5000)

    // Move to step 2 after a brief delay for transition
    setTimeout(() => {
      setActiveStep(2)
    }, 1200)
  }

  const handleStep1Submit = (e) => {
    e.preventDefault()
    if (!regForm.fullName || !regForm.email || !regForm.phone || !regForm.address) {
      return alert("Please fill in all registration fields.")
    }
    if (regForm.otpStatus !== "verified") return alert("Please verify your Mobile OTP first.")
    if (!regForm.isBiometricCompleted) return alert("Please complete your Biometric Profile Scan first.")

    const formattedDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    setRegForm(prev => ({ ...prev, isCompleted: true, regDate: formattedDate }))
    setActiveStep(2)
  }


  // ── STEP 2: FUNCTIONS ──
  const selectMockFile = (field, name) => {
    setUploadingDocs(prev => ({ ...prev, [field]: true }))
    setDocForm(prev => ({ ...prev, [field]: null }))
    setTimeout(() => {
      setDocForm(prev => ({ ...prev, [field]: name }))
      setUploadingDocs(prev => ({ ...prev, [field]: false }))
    }, 1200)
  }

  const handleFileChange = (e, field) => {
    const file = e.target.files[0]
    if (!file) return

    setUploadingDocs(prev => ({ ...prev, [field]: true }))
    setDocForm(prev => ({ ...prev, [field]: null }))

    const reader = new FileReader()
    reader.onload = () => {
      setDocForm(prev => ({
        ...prev,
        [field]: file.name,
        [`${field}FileData`]: reader.result
      }))
      setUploadingDocs(prev => ({ ...prev, [field]: false }))
    }
    reader.readAsDataURL(file)
  }


  const triggerAIValidation = () => {
    if (!docForm.aadhaarFile || !docForm.panFile || !docForm.drivingLicenseFile) {
      alert("Please upload Aadhaar, PAN, and Driving License details first.")
      return
    }
    if (!docForm.aadhaarId || !docForm.panId || !docForm.drivingLicenseId) {
      alert("Please enter Aadhaar, PAN, and Driving License ID input fields first.")
      return
    }

    setDocForm(prev => ({ ...prev, isValidating: true, validationProgress: 0, validationLog: [] }))

    const logs = [
      `Extracting OCR character mesh from Aadhaar: "${docForm.aadhaarFile}"...`,
      `Validating Aadhaar ID "${docForm.aadhaarId}" status... Active`,
      `Matching register name "${regForm.fullName}" against Aadhaar scan record... Match 100%`,
      `Extracting OCR signatures from PAN: "${docForm.panFile}"...`,
      `Checking PAN ID "${docForm.panId}" validity with NSDL registry... Approved`,
      `Analyzing profile webcam photo coordinates against document avatars... Match 99.8%`,
      `Validating Driving License ID "${docForm.drivingLicenseId}" authentication status... Verified`,
      "Running anti-duplicate and multi-identity sybil fraud checks... Clearance Clear",
      "Generating quantum trust confidence report index..."
    ]

    let stepIndex = 0
    let prog = 0

    validationRef.current = setInterval(() => {
      prog += 4
      if (prog % 12 === 0 && stepIndex < logs.length) {
        const nextLog = logs[stepIndex]
        setDocForm(prev => ({
          ...prev,
          validationLog: [...prev.validationLog, nextLog]
        }))
        stepIndex++
      }

      setDocForm(prev => ({ ...prev, validationProgress: Math.min(prog, 100) }))

      if (prog >= 100) {
        clearInterval(validationRef.current)
        setDocForm(prev => ({
          ...prev,
          isValidating: false,
          confidenceScore: 99,
          isCompleted: true,
          aadhaarFileFileData: prev.aadhaarFileFileData && !prev.aadhaarFileFileData.startsWith("data:image/svg+xml")
            ? prev.aadhaarFileFileData
            : generateAadhaarSVG(regForm.fullName, regForm.profilePic, prev.aadhaarId),
          panFileFileData: prev.panFileFileData && !prev.panFileFileData.startsWith("data:image/svg+xml")
            ? prev.panFileFileData
            : generatePanSVG(regForm.fullName, regForm.profilePic, prev.panId),
          drivingLicenseFileFileData: prev.drivingLicenseFileFileData && !prev.drivingLicenseFileFileData.startsWith("data:image/svg+xml")
            ? prev.drivingLicenseFileFileData
            : generateDrivingLicenseSVG(regForm.fullName, prev.drivingLicenseId)
        }))
        setTimeout(() => {
          setActiveStep(3)
        }, 1500)
      }
    }, 150)
  }


  // ── STEP 3: FUNCTIONS ──
  const selectAcademyModule = (modId) => {
    clearInterval(videoRef.current)
    setActiveQuiz(null) // Clear active quiz to show video player
    setAcademyState(prev => ({
      ...prev,
      activeModuleId: modId,
      isVideoPlaying: false,
      videoDurationElapsed: 0,
      modules: prev.modules.map(m => m.id === modId ? { ...m, isPlaying: true } : { ...m, isPlaying: false })
    }))
  }

  const triggerPlayVideo = () => {
    if (academyState.activeModuleId === null) return
    setAcademyState(prev => ({ ...prev, isVideoPlaying: true }))

    clearInterval(videoRef.current)
    videoRef.current = setInterval(() => {
      setAcademyState(prev => {
        const active = prev.modules.find(m => m.id === prev.activeModuleId)
        if (!active) return prev

        const nextProgress = active.progress + 10
        const isFinished = nextProgress >= 100

        const updatedModules = prev.modules.map(m => {
          if (m.id === prev.activeModuleId) {
            return {
              ...m,
              progress: Math.min(nextProgress, 100)
            }
          }
          return m
        })

        if (isFinished) {
          clearInterval(videoRef.current)
          setTimeout(() => {
            setActiveQuiz(quizzes[prev.activeModuleId - 1])
          }, 400)
        }

        return {
          ...prev,
          isVideoPlaying: !isFinished,
          modules: updatedModules
        }
      })
    }, 500)
  }

  const handleAnswerQuiz = (selectedIdx) => {
    if (selectedIdx === activeQuiz.correctIdx) {
      setAcademyState(prev => {
        const updatedModules = prev.modules.map(m => {
          if (m.id === activeQuiz.moduleId) {
            return { ...m, completed: true }
          }
          return m
        })
        const allFinished = updatedModules.every(m => m.completed)
        if (allFinished) {
          setTimeout(() => {
            setActiveStep(4)
          }, 1250)
        }
        return {
          ...prev,
          isCompleted: allFinished,
          modules: updatedModules
        }
      })
      setActiveQuiz(null)
    } else {
      alert("Verification Answer Incorrect! Review the compliance rule and select again.")
    }
  }

  // ── STEP 4: FUNCTIONS ──
  const triggerInterviewCall = () => {
    setInterviewState(prev => ({ ...prev, status: "Calling", subtitles: "Establishing secure WebRTC handshake..." }))
    setTimeout(() => {
      setInterviewState(prev => ({
        ...prev,
        status: "Connected",
        activeQuestionIndex: 0,
        subtitles: interviewQuestions[0].text,
        soundWaveActive: true
      }))

      // Request webcam for the call PIP
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
          .then(stream => {
            if (webcamVideoRef.current) {
              webcamVideoRef.current.srcObject = stream
            }
          })
          .catch(e => console.warn("Camera hardware access declined or unavailable for WebRTC call.", e))
      } else {
        console.warn("Camera hardware access or mediaDevices is undefined for WebRTC call.")
      }
    }, 2000)
  }

  const handleInterviewAnswer = (answerText) => {
    setInterviewState(prev => {
      const logs = [...prev.interviewLogs, { question: interviewQuestions[prev.activeQuestionIndex].text, answer: answerText }]
      const nextIndex = prev.activeQuestionIndex + 1
      const isEnd = nextIndex >= interviewQuestions.length

      if (isEnd) {
        // stop video stream for call if active
        if (webcamVideoRef.current?.srcObject) {
          const stream = webcamVideoRef.current.srcObject
          stream.getTracks().forEach(track => track.stop())
          webcamVideoRef.current.srcObject = null
        }
        setTimeout(() => {
          setActiveStep(5)
        }, 1500)
        return {
          ...prev,
          status: "Completed",
          activeQuestionIndex: 0,
          subtitles: "Call completed. Uploading audio-visual audit log to Admin console.",
          soundWaveActive: false,
          interviewLogs: logs,
          isCompleted: true
        }
      } else {
        return {
          ...prev,
          activeQuestionIndex: nextIndex,
          subtitles: interviewQuestions[nextIndex].text,
          interviewLogs: logs
        }
      }
    })
  }


  const handleAdminApprove = () => {
    setAdminClearance({ status: "approved", remarks: "All validation steps passed. Trust score satisfies criteria." })
    setShowCelebration(true)
  }

  const handleAdminReject = () => {
    setShowRejectionDialog(true)
  }

  const confirmAdminReject = (reason) => {
    setAdminClearance({
      status: "rejected",
      remarks: reason || "Identity documents mismatch with biometric registration profile."
    })
    setShowRejectionDialog(false)
  }



  const resetEntireJourney = () => {
    localStorage.removeItem("caltrack_activation_dossier")
    apiDeleteRegistrationDossier()
    setActiveStep(1)
    setRegForm({
      fullName: "",
      email: "",
      phone: "",
      address: "",
      profilePic: null,
      otpStatus: "unverified",
      otpTimer: 0,
      emailStatus: "unverified",
      emailTimer: 0,
      isBiometricScanning: false,
      isBiometricCompleted: false,
      isCompleted: false,
      regDate: ""
    })
    setDocForm({
      aadhaarId: "",
      panId: "",
      drivingLicenseId: "",
      aadhaarFile: null,
      panFile: null,
      drivingLicenseFile: null,
      isValidating: false,
      validationLog: [],
      validationProgress: 0,
      confidenceScore: 0,
      isCompleted: false
    })
    setAcademyState({
      modules: [
        { id: 1, title: "Caltrack Compliance & Operations Overview", duration: 20, completed: false, isPlaying: false, progress: 0 },
      ],
      activeModuleId: null,
      isVideoPlaying: false,
      videoDurationElapsed: 0,
      isCompleted: false
    })
    setInterviewState({
      status: "Passed",
      activeQuestionIndex: 0,
      callDuration: 12,
      subtitles: "",
      soundWaveActive: false,
      interviewLogs: [
        { sender: "System", text: "Compliance WebRTC check bypassed by system configuration." }
      ],
      isCompleted: true
    })
    setAdminClearance({
      status: "pending",
      remarks: ""
    })
    setOtpCode("")
    setShowActivePass(false)
    setShowCelebration(false)
    setShowRejectionDialog(false)
    setGeneratedPhoneOtp("")

    setRejectionRemarks("")
    setUploadingDocs({})
    setActiveQuiz(null)
    setRegSubStep(1)
  }

  const renderStepNavigation = () => {
    const isStep1Valid = regForm.otpStatus === "verified" && regForm.isBiometricCompleted
    const isStep2Valid = docForm.isCompleted
    const isStep3Valid = academyState.isCompleted

    const canGoNext =
      (activeStep === 1 && isStep1Valid) ||
      (activeStep === 2 && isStep2Valid) ||
      (activeStep === 3 && isStep3Valid);

    return (
      <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-200/60 dark:border-slate-800/60">
        {activeStep > 1 ? (
          <button
            type="button"
            onClick={() => setActiveStep(prev => prev - 1)}
            className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 bg-white shadow-sm"
          >
            ← Previous Step
          </button>
        ) : (
          <div />
        )}

        {activeStep < 4 && canGoNext && (
          <button
            type="button"
            onClick={() => setActiveStep(prev => prev + 1)}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
          >
            Continue to Step 0{activeStep + 1} →
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="futuristic-container relative pb-20">
      <style dangerouslySetInnerHTML={{ __html: holographicStyles }} />
      <div className="grid-overlay" />

      {/* Dynamic Glassmorphic Push Notification Toast */}
      <AnimatePresence>
        {hudToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9, transition: { duration: 0.2 } }}
            className="fixed top-24 right-6 z-[9999] w-80 rounded-2xl border border-blue-500/30 bg-slate-950/80 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-md"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-2xl pointer-events-none" />
            <div className="flex gap-3 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400">
                {hudToast.type === "sms" ? <PhoneIncoming className="w-5 h-5 animate-bounce" /> : <Mail className="w-5 h-5 animate-pulse" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black font-orbitron tracking-wider text-blue-400 uppercase">
                    {hudToast.title}
                  </span>
                  <span className="text-[8px] text-slate-500 font-bold uppercase">JUST NOW</span>
                </div>
                <p className="text-[11px] text-slate-200 font-bold mt-1 leading-normal break-words">
                  {hudToast.msg}
                </p>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 rounded-b-2xl overflow-hidden">
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 8, ease: "linear" }}
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP HUD BAR */}
      <div className="w-full border-b border-blue-500/10 py-5 px-8 glass-panel flex items-center justify-between sticky top-0 z-[100] backdrop-blur-md">
        <div className="flex items-center gap-4">
          <CalTrackLogo size="sm" showTagline={false} />
          <div className="h-8 w-px bg-blue-500/20" />
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[8px] font-black font-orbitron bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 tracking-wider">SECURE AUDIT</span>
            </div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Automated Activation Pipeline</div>
          </div>
        </div>

        <div className="flex items-center gap-4 font-orbitron">
          <button
            type="button"
            onClick={() => navigate(routes.login)}
            className="px-4 py-2 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
          >
            ← BACK TO LOGIN
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">

        {/* =====================================================================
            LEFT SIDEBAR HUD
            ===================================================================== */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* Mission Progress HUD */}
          <div className="hud-card rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full filter blur-xl" />
            <h2 className="font-orbitron font-black text-xs text-blue-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              JOURNEY CHRONICLE
            </h2>

            {/* Vertical timeline stepper */}
            <div className="relative pl-6 space-y-7">
              <div className="absolute left-[31px] top-4 bottom-4 w-0.5 bg-slate-850 z-0">
                <motion.div
                  className="w-full bg-gradient-to-b from-blue-500 to-emerald-500"
                  initial={{ height: "20%" }}
                  animate={{ height: `${timelineProgress}%` }}
                  transition={{ duration: 0.6 }}
                />
              </div>

              {[
                { num: 1, title: "Registration", status: regForm.isCompleted ? "✓ Verified Complete" : "Interactive Input", detail: regForm.fullName },
                { num: 2, title: "KYC & Documents", status: docForm.isCompleted ? "✓ OCR validated" : "Upload Aadhaar/PAN", detail: docForm.isCompleted ? `Confidence Index: ${docForm.confidenceScore}%` : "Awaiting files" },
                { num: 3, title: "Training Academy", status: academyState.isCompleted ? "✓ Academy certified" : "Module playback", detail: academyState.isCompleted ? "5 Modules Mastered" : "Video track active" },
                { num: 4, title: "Admin Review", status: adminClearance.status === "approved" ? "✓ Authorized" : adminClearance.status === "rejected" ? "✕ Denied" : "Awaiting Clearance", detail: adminClearance.status === "approved" ? "Active Workforce Pass" : "Security clearance" }
              ].map((step) => {
                const isActive = activeStep === step.num
                const isDone = step.num === 1 ? regForm.isCompleted :
                  step.num === 2 ? docForm.isCompleted :
                    step.num === 3 ? academyState.isCompleted :
                      adminClearance.status === "approved"

                const canVisit = step.num === 1 ||
                  (step.num === 2 && regForm.isCompleted) ||
                  (step.num === 3 && regForm.isCompleted && docForm.isCompleted) ||
                  (step.num === 4 && regForm.isCompleted && docForm.isCompleted && academyState.isCompleted);

                return (
                  <div
                    key={step.num}
                    onClick={() => {
                      if (canVisit) {
                        setActiveStep(step.num)
                      }
                    }}
                    className={`flex items-start gap-4 transition-all duration-300 relative z-10 ${canVisit ? "cursor-pointer group hover:opacity-90" : "cursor-not-allowed opacity-30"} ${isActive ? "scale-[1.02]" : ""}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold border-2 transition-all duration-300 ${isDone ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.15)]" :
                        isActive ? "bg-indigo-600 border-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.25)]" :
                          "bg-slate-50 border-slate-200 text-slate-400"
                        }`}
                    >
                      {isDone ? <Check className="w-4.5 h-4.5 text-emerald-600" strokeWidth={3} /> : step.num}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black uppercase tracking-wider ${isActive ? "text-indigo-600 font-extrabold" : isDone ? "text-slate-800 font-semibold" : "text-slate-400 font-medium"}`}>
                          {step.title}
                        </span>
                        {isDone && (
                          <span className="text-[8px] font-black bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 px-2 py-0.5 rounded">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-wider">{step.status}</div>
                      <div className="text-[9px] text-slate-400 font-semibold mt-0.5 truncate max-w-[190px]">{step.detail}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* AI Metrics HUD Widget */}
          <div className="hud-card rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full filter blur-xl" />
            <h2 className="font-orbitron font-black text-xs text-emerald-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              VERIFICATION STATUS
            </h2>

            <div className="flex items-center gap-6 mt-4">
              <div className="relative w-28 h-28 flex items-center justify-center shrink-0 bg-[#060a14] rounded-full border border-slate-800 shadow-inner">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.03)" strokeWidth="8" fill="transparent" />
                  <motion.circle
                    cx="50" cy="50" r="40"
                    stroke="url(#complianceGlow)"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={251.2}
                    initial={{ strokeDashoffset: 251.2 }}
                    animate={{ strokeDashoffset: 251.2 - (251.2 * activeScore) / 100 }}
                    transition={{ duration: 0.8 }}
                  />
                  <defs>
                    <linearGradient id="complianceGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="font-orbitron text-2xl font-black text-white leading-none">{activeScore}%</span>
                  <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest mt-1">TRUST SCORE</span>
                </div>
              </div>

              <div className="space-y-3 text-[11px] font-semibold">
                <div>
                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Interview</div>
                  <div className={`${interviewState.isCompleted ? "text-emerald-400 font-bold" : "text-slate-200"} mt-0.5`}>
                    {interviewState.isCompleted ? "✓ Completed" : "Not Started"}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Identity Scan</div>
                  <div className={`${regForm.isBiometricCompleted ? "text-emerald-400 font-bold" : "text-slate-200"} mt-0.5`}>
                    {regForm.isBiometricCompleted ? "✓ Verified" : "Pending"}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Document Check</div>
                  <div className={`${docForm.isCompleted ? "text-emerald-400 font-bold" : "text-slate-200"} mt-0.5`}>
                    {docForm.isCompleted ? "✓ Verified" : "Awaiting Upload"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================================
            RIGHT MAIN WORKSPACE CARD
            ===================================================================== */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">

            {/* ── STEP 1: REGISTRATION & PROFILE ── */}
            {activeStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="hud-card rounded-2xl p-6 md:p-8 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full filter blur-2xl" />

                {/* Step Header with sub-step indicators */}
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-850 gap-4">
                  <div className="flex items-center gap-3">
                    <span className="font-orbitron font-black text-2xl text-blue-500">01</span>
                    <div>
                      <h3 className="text-base font-black text-white uppercase tracking-wider">TECHNICIAN REGISTRATION</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                        {regSubStep === 1 ? "Step 1.1: Contact Information Details" :
                          regSubStep === 2 ? "Step 1.2: Secure Mobile OTP Verification" :
                            "Step 1.3: Biometric Facemesh Profile Scan"}
                      </p>
                    </div>
                  </div>

                  {/* Sub-step progress indicators */}
                  <div className="flex items-center gap-2">
                    {[1, 2, 3].map((s) => (
                      <div
                        key={s}
                        className={`h-1.5 rounded-full transition-all duration-300 ${regSubStep === s ? "w-8 bg-indigo-600" :
                          regSubStep > s ? "w-4 bg-emerald-500" : "w-4 bg-slate-200"
                          }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-6 space-y-6">
                  {/* SUB-STEP 1: Contact Details */}
                  {regSubStep === 1 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="space-y-2">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Full Name</label>
                          <input
                            required
                            type="text"
                            className="w-full px-4 py-3 rounded-xl cyber-input text-sm font-semibold"
                            placeholder="Enter full name"
                            value={regForm.fullName}
                            onChange={e => setRegForm(prev => ({ ...prev, fullName: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Email Address</label>
                          <input
                            required
                            type="email"
                            className="w-full px-4 py-3 rounded-xl cyber-input text-sm font-semibold"
                            placeholder="name@company.com"
                            value={regForm.email}
                            onChange={e => setRegForm(prev => ({ ...prev, email: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Phone Number</label>
                          <input
                            required
                            type="tel"
                            className="w-full px-4 py-3 rounded-xl cyber-input text-sm font-semibold"
                            placeholder="e.g. +1 (555) 019-2834"
                            value={regForm.phone}
                            onChange={e => setRegForm(prev => ({ ...prev, phone: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Permanent Residence Address</label>
                        <textarea
                          required
                          rows={3}
                          className="w-full px-4 py-3 rounded-xl cyber-input text-sm font-semibold resize-none"
                          placeholder="Street, City, Pincode"
                          value={regForm.address}
                          onChange={e => setRegForm(prev => ({ ...prev, address: e.target.value }))}
                        />
                      </div>

                      <div className="flex justify-end pt-4">
                        <button
                          type="button"
                          disabled={!regForm.fullName || !regForm.email || !regForm.phone || !regForm.address}
                          onClick={() => setRegSubStep(2)}
                          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-750 text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
                        >
                          Continue to OTP Verification <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* SUB-STEP 2: Phone OTP Verification */}
                  {regSubStep === 2 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 max-w-xl mx-auto">
                        <div className="flex items-center justify-between text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">
                          <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-indigo-600" /> Phone OTP Verification</span>
                          {regForm.otpStatus === "verified" ? (
                            <span className="text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1"><Check className="w-3.5 h-3.5" /> VERIFIED</span>
                          ) : (
                            <span className="text-amber-600 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">UNVERIFIED</span>
                          )}
                        </div>

                        <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                          We will send a 4-digit security code to your registered mobile number <strong className="text-slate-800">{maskPhoneNumber(regForm.phone)}</strong> to confirm identity.
                        </p>

                        {regForm.otpStatus === "unverified" && (
                          <button
                            type="button"
                            disabled={resendCooldown > 0}
                            onClick={triggerMobileOTP}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-[10px] font-black uppercase tracking-wider rounded-xl text-white shadow-sm transition-all"
                          >
                            {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Send Verification OTP"}
                          </button>
                        )}

                        {regForm.otpStatus === "sending" && (
                          <div className="py-3 text-center text-xs text-slate-500 font-bold animate-pulse">Sending secure SMS code...</div>
                        )}

                        {(regForm.otpStatus === "sent" || regForm.otpStatus === "verified") && (
                          <div className="flex gap-3">
                            <input
                              disabled={regForm.otpStatus === "verified"}
                              type="text"
                              maxLength={4}
                              className="w-24 text-center py-3 rounded-xl cyber-input text-sm font-orbitron"
                              placeholder="CODE"
                              value={otpCode}
                              onChange={e => setOtpCode(e.target.value)}
                            />
                            {regForm.otpStatus === "verified" ? (
                              <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                className="flex-grow py-3 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-black text-center uppercase tracking-widest rounded-xl flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/10"
                              >
                                <motion.span
                                  initial={{ rotate: -90 }}
                                  animate={{ rotate: 0 }}
                                  transition={{ delay: 0.2 }}
                                >
                                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                                </motion.span>
                                Verified Successfully
                              </motion.div>
                            ) : (
                              <button type="button" onClick={confirmMobileOTP} className="flex-grow py-3 bg-emerald-600 hover:bg-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-xl text-white transition-all">
                                Confirm Code ({regForm.otpTimer}s)
                              </button>
                            )}
                          </div>
                        )}

                        {regForm.otpStatus === "sent" && (
                          <div className="space-y-2">
                            {/* Real-time Delivery Status */}
                            <div className={`text-[10px] font-bold p-2.5 rounded-lg flex items-center gap-1.5 border ${otpDeliveryChannel === "sms"
                                ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                : "bg-blue-50 border-blue-100 text-blue-700"
                              }`}>
                              <Info className="w-3.5 h-3.5" />
                              <span>
                                {otpDeliveryChannel === "sms"
                                  ? "Real-time OTP successfully dispatched via SMS gateway."
                                  : "Development Fallback: OTP code outputted to console & HUD banner."}
                              </span>
                            </div>

                            {/* Resend Cooldown Countdown */}
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                              <span>Didn't receive the OTP?</span>
                              <button
                                type="button"
                                disabled={resendCooldown > 0}
                                onClick={triggerMobileOTP}
                                className="text-indigo-650 hover:text-indigo-800 disabled:text-slate-400 font-black uppercase tracking-wider transition-all"
                              >
                                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between pt-4 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setRegSubStep(1)}
                          className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
                        >
                          ← Back to Contact Info
                        </button>
                        <button
                          type="button"
                          disabled={regForm.otpStatus !== "verified"}
                          onClick={() => setRegSubStep(3)}
                          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
                        >
                          Continue to Biometrics <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* SUB-STEP 3: Biometric Profile Scan */}
                  {regSubStep === 3 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 max-w-xl mx-auto">
                        <div className="flex items-center justify-between text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">
                          <span className="flex items-center gap-1.5"><Fingerprint className="w-4 h-4 text-indigo-600" /> Biometric Profile Scan</span>
                          {regForm.isBiometricCompleted && <span className="text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1"><Check className="w-3.5 h-3.5" /> SECURED</span>}
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-6">
                          <div className="relative w-36 h-36 bg-black border-2 border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                            {regForm.isBiometricScanning && <div className="laser-bar" />}
                            {regForm.isBiometricCompleted ? (
                              <div className="w-full h-full bg-emerald-50/20 flex flex-col items-center justify-center text-center p-3 relative">
                                <UserCheck className="w-10 h-10 text-emerald-600 mb-1.5 animate-bounce" />
                                <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">FACE MATCHED</div>
                                <div className="text-[8px] text-slate-500 mt-1 uppercase font-bold">1:1 Vectors Verified</div>
                              </div>
                            ) : (
                              <>
                                <video
                                  ref={webcamVideoRef}
                                  autoPlay
                                  playsInline
                                  muted
                                  className="w-full h-full object-cover transform scale-x-[-1]"
                                />
                                {regForm.isBiometricScanning && (
                                  <div className="absolute inset-0 bg-blue-500/5 flex items-center justify-center pointer-events-none">
                                    <svg className="w-full h-full text-blue-400/50" viewBox="0 0 100 100">
                                      <path d="M30,45 Q30,22 50,22 Q70,22 70,45 Q70,72 50,82 Q30,72 30,45 Z" fill="none" stroke="#3b82f6" strokeWidth="0.75" strokeDasharray="3 3" className="animate-pulse" />
                                      <circle cx="42" cy="42" r="1.5" fill="#10b981" />
                                      <circle cx="58" cy="42" r="1.5" fill="#10b981" />
                                      <circle cx="50" cy="52" r="1.5" fill="#10b981" />
                                      <path d="M44,65 Q50,68 56,65" fill="none" stroke="#10b981" strokeWidth="0.75" />
                                      <text x="50" y="15" textAnchor="middle" fill="#3b82f6" fontSize="5" fontFamily="monospace" className="tracking-widest font-black font-orbitron animate-pulse">FACEMESH ACTIVE</text>
                                    </svg>
                                  </div>
                                )}
                              </>
                            )}
                            {!regForm.isBiometricScanning && !regForm.isBiometricCompleted && (
                              <div className="absolute inset-0 flex items-center justify-center text-slate-400 bg-slate-50">
                                <Camera className="w-10 h-10" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 space-y-3">
                            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                              Caltrack automated systems require a liveness biometric selfie scan to match with your government credentials in Step 2.
                            </p>
                            {regForm.isBiometricScanning ? (
                              <button
                                type="button"
                                onClick={capturePhotoAndContinue}
                                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/10 animate-bounce"
                              >
                                <Camera className="w-4 h-4" /> Capture Photo & Continue
                              </button>
                            ) : regForm.isBiometricCompleted ? (
                              <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Biometric vectors registered.
                              </div>
                            ) : (
                              <button type="button" onClick={triggerBiometricScan} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-[10px] text-white rounded-xl font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm transition-all">
                                <Camera className="w-3.5 h-3.5" /> Initialize Biometric Face Scan
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between pt-4 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setRegSubStep(2)}
                          className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
                        >
                          ← Back to OTP Verification
                        </button>
                        <button
                          type="button"
                          disabled={regForm.otpStatus !== "verified" || !regForm.isBiometricCompleted}
                          onClick={(e) => {
                            const formattedDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                            setRegForm(prev => ({ ...prev, isCompleted: true, regDate: formattedDate }))
                            setActiveStep(2)
                          }}
                          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-emerald-600/10 font-orbitron text-xs font-black uppercase tracking-widest rounded-xl text-white flex items-center gap-1.5 transition-all"
                        >
                          Complete Step 1 <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── STEP 2: DOCUMENT INTEGRATION ── */}
            {activeStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="hud-card rounded-2xl p-6 md:p-8 relative overflow-hidden"
              >
                <input
                  type="file"
                  ref={aadhaarInputRef}
                  style={{ display: "none" }}
                  onChange={(e) => handleFileChange(e, "aadhaarFile")}
                  accept=".pdf,.png,.jpg,.jpeg"
                />
                <input
                  type="file"
                  ref={panInputRef}
                  style={{ display: "none" }}
                  onChange={(e) => handleFileChange(e, "panFile")}
                  accept=".pdf,.png,.jpg,.jpeg"
                />
                <input
                  type="file"
                  ref={dlInputRef}
                  style={{ display: "none" }}
                  onChange={(e) => handleFileChange(e, "drivingLicenseFile")}
                  accept=".pdf,.png,.jpg,.jpeg"
                />
                {docForm.isValidating && <div className="laser-bar" />}
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full filter blur-2xl" />
                <div className="flex items-center justify-between pb-6 border-b border-slate-850">
                  <div className="flex items-center gap-3">
                    <span className="font-orbitron font-black text-2xl text-emerald-500">02</span>
                    <div>
                      <h3 className="text-base font-black text-white uppercase tracking-wider">IDENTITY & DOCUMENT INTEGRATION</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Upload compliance documents for automated verification checks</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Aadhaar Card ID</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 rounded-xl cyber-input text-sm font-semibold"
                        value={docForm.aadhaarId}
                        onChange={e => setDocForm(prev => ({ ...prev, aadhaarId: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">PAN Card ID</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 rounded-xl cyber-input text-sm font-semibold"
                        value={docForm.panId}
                        onChange={e => setDocForm(prev => ({ ...prev, panId: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2 col-span-2">
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Driving License ID</label>
                      <input
                        type="text"
                        placeholder="e.g. DL-1420110023456"
                        className="w-full px-4 py-3 rounded-xl cyber-input text-sm font-semibold"
                        value={docForm.drivingLicenseId}
                        onChange={e => setDocForm(prev => ({ ...prev, drivingLicenseId: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Upload Interactive Boxes */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { title: "Aadhaar Card Scan", field: "aadhaarFile", name: "aadhaar_scan.pdf" },
                      { title: "PAN Card Scan", field: "panFile", name: "pan_scan.pdf" },
                      { title: "Driving License Scan", field: "drivingLicenseFile", name: "driving_license.pdf" }
                    ].map((up) => (
                      <div
                        key={up.field}
                        onClick={() => {
                          if (uploadingDocs[up.field]) return
                          if (up.field === "aadhaarFile") aadhaarInputRef.current?.click()
                          if (up.field === "panFile") panInputRef.current?.click()
                          if (up.field === "drivingLicenseFile") dlInputRef.current?.click()
                        }}
                        className={`p-4 rounded-xl border border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 h-28 ${docForm[up.field] ? "bg-blue-500/5 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]" :
                          uploadingDocs[up.field] ? "bg-slate-950/80 border-blue-500/50 animate-pulse" :
                            "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                          }`}
                      >
                        {uploadingDocs[up.field] ? (
                          <>
                            <RefreshCcw className="w-6 h-6 text-blue-400 animate-spin mb-1.5" />
                            <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Uploading...</div>
                            <div className="text-[8px] text-slate-500 mt-1">Simulating ingest</div>
                          </>
                        ) : docForm[up.field] ? (
                          <>
                            <FileText className="w-8 h-8 text-blue-500 mb-1" />
                            <div className="text-[10px] font-black text-white truncate max-w-[130px]">{docForm[up.field]}</div>
                            <div className="text-[8px] text-emerald-400 font-bold uppercase mt-1 tracking-widest">Ready</div>
                          </>
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-slate-500 mb-1" />
                            <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{up.title}</div>
                            <div className="text-[8px] text-slate-600 font-medium mt-1">Click to attach</div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Scan Status Console */}
                  {docForm.isValidating ? (
                    <div className="p-5 rounded-xl bg-[#090f23] border border-blue-500/20 space-y-4">
                      <div className="flex items-center justify-between text-xs font-black uppercase text-blue-400 tracking-wider font-orbitron">
                        <span>AI Document Integrity Validator</span>
                        <span>{docForm.validationProgress}%</span>
                      </div>
                      <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${docForm.validationProgress}%` }} />
                      </div>
                      <div ref={logConsoleRef} className="space-y-1 max-h-36 overflow-y-auto font-mono text-[9px] text-slate-400 leading-normal">
                        {docForm.validationLog.map((log, idx) => (
                          <div key={idx} className="flex gap-2">
                            <span className="text-blue-500">&gt;&gt;</span>
                            <span>{log}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : docForm.isCompleted ? (
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/25 text-center space-y-2">
                      <div className="text-emerald-400 font-semibold text-sm flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Documents Verified Successfully
                      </div>
                      <p className="text-[11px] text-slate-400">
                        All uploaded documents have been verified and submitted for admin review.
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={triggerAIValidation}
                      className="w-full py-4 glow-btn-blue font-orbitron text-xs font-black uppercase tracking-[0.15em] rounded-xl text-white flex items-center justify-center gap-2"
                    >
                      EXECUTE DOCUMENT AI INTEGRITY CHECK <Cpu className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {renderStepNavigation()}
              </motion.div>
            )}

            {/* ── STEP 3: VIDEO TRAINING ACADEMY ── */}
            {activeStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="hud-card rounded-2xl p-6 md:p-8 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full filter blur-2xl" />
                <div className="flex items-center justify-between pb-6 border-b border-slate-850">
                  <div className="flex items-center gap-3">
                    <span className="font-orbitron font-black text-2xl text-indigo-500">03</span>
                    <div>
                      <h3 className="text-base font-black text-white uppercase tracking-wider">COMPLIANCE TRAINING ACADEMY</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Stream and pass training modules to confirm operational compliance standards</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* High Tech Video Streamer */}
                  <div className="md:col-span-7 flex flex-col gap-4">
                    <div className="aspect-video w-full bg-[#050812] border border-slate-850 rounded-xl overflow-hidden relative flex flex-col justify-between p-4 shadow-inner">

                      {activeQuiz ? (
                        <div className="absolute inset-0 bg-[#090e1c] flex flex-col justify-between p-5 z-20">
                          <div>
                            <div className="flex items-center gap-1.5 text-indigo-400 font-orbitron font-black text-[9px] uppercase tracking-widest mb-1">
                              <Award className="w-3.5 h-3.5 text-indigo-400" /> Module Certification Challenge
                            </div>
                            <h4 className="text-xs font-black text-white leading-snug mt-1">{activeQuiz.question}</h4>
                          </div>

                          <div className="space-y-2 mt-3">
                            {activeQuiz.options.map((opt, oIdx) => (
                              <button
                                key={oIdx}
                                type="button"
                                onClick={() => handleAnswerQuiz(oIdx)}
                                className="w-full text-left px-3 py-2 bg-slate-900/60 hover:bg-indigo-650/10 border border-slate-800 hover:border-indigo-500/40 rounded-lg text-[10px] font-bold text-slate-355 hover:text-white transition-all"
                              >
                                {opt}
                              </button>
                            ))}
                          </div>

                          <div className="text-[8px] text-slate-500 font-semibold text-center mt-2 tracking-wider">
                            Correct answer unlocks the next module
                          </div>
                        </div>
                      ) : academyState.activeModuleId !== null ? (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-between p-4">
                          {/* Loop video background when streaming */}
                          {academyState.isVideoPlaying && (
                            <video
                              autoPlay
                              loop
                              muted
                              playsInline
                              className="absolute inset-0 w-full h-full object-cover opacity-35 mix-blend-screen pointer-events-none z-0"
                              src="https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3c054a4d8285ab64010ecd02818b4e3f2&profile_id=165&oauth2_token_id=57447761"
                            />
                          )}
                          {/* Animated Visual Board representing class materials */}
                          <div className="flex-1 flex items-center justify-center pointer-events-none mt-2 relative z-10">
                            {academyState.activeModuleId === 1 && (
                              <div className="flex flex-col items-center gap-2">
                                <Globe className="w-10 h-10 text-indigo-500/20 animate-spin" style={{ animationDuration: '20s' }} />
                                <span className="text-[7px] text-indigo-400 font-mono tracking-widest uppercase">GLOBAL WORKFORCE ALIGNMENT</span>
                              </div>
                            )}
                            {academyState.activeModuleId === 2 && (
                              <div className="relative w-20 h-20 flex items-center justify-center">
                                <div className="absolute inset-0 border border-emerald-500/10 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
                                <div className="w-10 h-10 border border-emerald-500/20 bg-emerald-500/5 rounded-full flex items-center justify-center">
                                  <ShieldCheck className="w-5 h-5 text-emerald-400/30 animate-pulse" />
                                </div>
                                <span className="absolute bottom-[-10px] text-[7px] text-emerald-400 font-mono tracking-widest uppercase text-center w-full">GEOFENCE SECURE MATRIX</span>
                              </div>
                            )}
                            {academyState.activeModuleId === 3 && (
                              <div className="flex gap-4 items-center">
                                <div className="w-8 h-8 rounded-full border border-blue-500/20 flex items-center justify-center bg-blue-500/5 animate-pulse">
                                  <User className="w-4 h-4 text-blue-400/30" />
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-700" />
                                <div className="w-8 h-8 rounded-full border border-emerald-500/20 flex items-center justify-center bg-emerald-500/5 animate-pulse" style={{ animationDelay: '0.5s' }}>
                                  <UserCheck className="w-4 h-4 text-emerald-400/30" />
                                </div>
                              </div>
                            )}
                            {academyState.activeModuleId === 4 && (
                              <div className="w-36 max-h-16 overflow-hidden border border-slate-900 bg-slate-950/80 rounded p-1.5 font-mono text-[5.5px] text-blue-400/40 leading-tight">
                                <div className="animate-pulse">{"{"}</div>
                                <div className="pl-2">&quot;event&quot;: &quot;LOG_AUDIT_SYNC&quot;,</div>
                                <div className="pl-2">&quot;coordinates&quot;: [17.4482, 78.3741],</div>
                                <div className="pl-2">&quot;accuracy&quot;: &quot;99.98%&quot;</div>
                                <div>{"}"}</div>
                              </div>
                            )}
                            {academyState.activeModuleId === 5 && (
                              <div className="flex flex-col items-center gap-1">
                                <div className="font-orbitron font-black text-xl text-blue-500/20 animate-pulse">SLA TARGET: 120m</div>
                                <div className="text-[6px] font-mono text-slate-500 tracking-widest uppercase">DISPATCH PERFORMANCE KPI</div>
                              </div>
                            )}
                          </div>

                          {/* Video player controls */}
                          <div className="space-y-2 mt-auto">
                            <div className="text-[10px] font-black text-white uppercase tracking-wider line-clamp-1">
                              Playing: {academyState.modules.find(m => m.id === academyState.activeModuleId)?.title}
                            </div>

                            <div className="w-full h-1 bg-slate-850 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${academyState.modules.find(m => m.id === academyState.activeModuleId)?.progress}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                {academyState.isVideoPlaying ? (
                                  <button type="button" disabled className="text-blue-500"><RefreshCcw className="w-3.5 h-3.5 animate-spin" /></button>
                                ) : (
                                  <button type="button" onClick={triggerPlayVideo} className="text-white hover:text-blue-500 transition-colors">
                                    <Play className="w-4 h-4 fill-white hover:fill-blue-500" />
                                  </button>
                                )}
                                <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                                  {academyState.isVideoPlaying ? "STREAMING ACADEMY FEED..." : "CLICK PLAY TO COMMENCE"}
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                {academyState.isVideoPlaying && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      clearInterval(videoRef.current)
                                      setAcademyState(prev => {
                                        const updatedModules = prev.modules.map(m => {
                                          if (m.id === prev.activeModuleId) {
                                            return { ...m, progress: 100 }
                                          }
                                          return m
                                        })
                                        setTimeout(() => {
                                          setActiveQuiz(quizzes[prev.activeModuleId - 1])
                                        }, 400)
                                        return {
                                          ...prev,
                                          isVideoPlaying: false,
                                          modules: updatedModules
                                        }
                                      })
                                    }}
                                    className="px-2 py-0.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded text-[7px] font-black uppercase text-slate-350 transition-colors"
                                  >
                                    Fast-Forward
                                  </button>
                                )}
                                <span className="text-[9px] font-orbitron font-bold text-slate-400">
                                  {academyState.modules.find(m => m.id === academyState.activeModuleId)?.progress}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="my-auto text-center space-y-3 p-4">
                          <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/25 flex items-center justify-center mx-auto text-blue-400">
                            <Play className="w-5 h-5" />
                          </div>
                          <div className="text-[10px] font-black text-slate-350 uppercase tracking-widest">Select a Module on the right to Play</div>
                        </div>
                      )}

                      {/* Laser scanner overlay */}
                      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[size:100%_4px] pointer-events-none opacity-20" />
                    </div>


                    {/* overall logs stats */}
                    <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-850 flex items-center justify-between">
                      <div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Academy Status</div>
                        <div className="text-sm font-orbitron font-black text-white mt-1">
                          {academyState.modules.filter(m => m.completed).length} / {academyState.modules.length} COMPLETED
                        </div>
                      </div>
                      <div className="h-8 w-[1px] bg-slate-855" />
                      <div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Compliance Clearance</div>
                        <div className="text-xs font-black text-emerald-400 uppercase mt-1">
                          {academyState.isCompleted ? "✓ CERTIFIED" : "PENDING VIDEO PLAY"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Modules Sidebar */}
                  <div className="md:col-span-5 space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {academyState.modules.map((mod) => (
                      <div
                        key={mod.id}
                        onClick={() => selectAcademyModule(mod.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all duration-300 ${mod.isPlaying ? "bg-indigo-500/10 border-indigo-500/40" :
                          mod.completed ? "bg-emerald-500/5 border-emerald-500/20" :
                            "bg-slate-950/40 border-slate-850 hover:bg-slate-900"
                          }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs font-black text-slate-200 line-clamp-2 leading-tight">
                            {mod.id}. {mod.title}
                          </span>
                          {mod.completed && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />}
                        </div>
                        <div className="flex items-center justify-between mt-3 text-[8.5px] font-black uppercase text-slate-500 tracking-wider">
                          <span>DURATION: {mod.duration} MIN</span>
                          <span className={mod.completed ? "text-emerald-400" : mod.isPlaying ? "text-indigo-400 animate-pulse" : "text-slate-500"}>
                            {mod.completed ? "Completed" : mod.isPlaying ? "Active" : "Pending"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {renderStepNavigation()}
              </motion.div>
            )}

            {/* ── STEP 4: ADMIN CLEARANCE CONTROL ── */}
            {activeStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="hud-card rounded-2xl p-6 md:p-8 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full filter blur-2xl" />
                {/* Header */}
                <div className="flex items-center justify-between pb-5 border-b border-slate-850">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Application Review</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Your application has been submitted for admin review</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    adminClearance.status === "approved"
                      ? "bg-emerald-100 text-emerald-700"
                      : adminClearance.status === "rejected"
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {adminClearance.status === "approved" ? "✓ Approved" : adminClearance.status === "rejected" ? "✕ Rejected" : "⏳ Under Review"}
                  </span>
                </div>

                <div className="mt-6 space-y-6">
                  {/* Application Summary */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                      <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Application Summary</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">

                      {/* Personal Info */}
                      <div className="p-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-500">Personal Details</span>
                          <span className={`text-xs font-bold ${regForm.isCompleted ? "text-emerald-600" : "text-amber-500"}`}>
                            {regForm.isCompleted ? "✓ Complete" : "Pending"}
                          </span>
                        </div>
                        {regForm.isCompleted && (
                          <div className="mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                            <div className="flex gap-2"><span className="font-semibold w-16 shrink-0">Name</span><span>{regForm.fullName}</span></div>
                            <div className="flex gap-2"><span className="font-semibold w-16 shrink-0">Email</span><span className="truncate">{regForm.email}</span></div>
                            <div className="flex gap-2"><span className="font-semibold w-16 shrink-0">Phone</span><span>{regForm.phone}</span></div>
                          </div>
                        )}
                      </div>

                      {/* Photo */}
                      <div className="p-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-500">Photo Verification</span>
                          <span className={`text-xs font-bold ${regForm.isBiometricCompleted ? "text-emerald-600" : "text-amber-500"}`}>
                            {regForm.isBiometricCompleted ? "✓ Verified" : "Pending"}
                          </span>
                        </div>
                        {regForm.isBiometricCompleted && (
                          <div className="flex items-center gap-3 mt-1">
                            <div className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                              {regForm.profilePic ? (
                                <img src={regForm.profilePic} alt="Profile" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                                  <User className="w-5 h-5 text-slate-400" />
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-slate-500">Selfie captured and matched</span>
                          </div>
                        )}
                      </div>

                      {/* Documents */}
                      <div className="p-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-500">Documents</span>
                          <span className={`text-xs font-bold ${docForm.isCompleted ? "text-emerald-600" : "text-amber-500"}`}>
                            {docForm.isCompleted ? "✓ Verified" : "Pending"}
                          </span>
                        </div>
                        {docForm.isCompleted && (
                          <div className="mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                            <div className="flex gap-2"><span className="font-semibold w-24 shrink-0">Aadhaar</span><span>{docForm.aadhaarId}</span></div>
                            <div className="flex gap-2"><span className="font-semibold w-24 shrink-0">PAN Card</span><span>{docForm.panId}</span></div>
                            <div className="flex gap-2"><span className="font-semibold w-24 shrink-0">Driving Licence</span><span>{docForm.drivingLicenseId}</span></div>
                          </div>
                        )}
                      </div>

                      {/* Training */}
                      <div className="p-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-500">Training</span>
                          <span className={`text-xs font-bold ${academyState.isCompleted ? "text-emerald-600" : "text-amber-500"}`}>
                            {academyState.isCompleted ? `✓ ${academyState.modules.length}/${academyState.modules.length} Passed` : "Pending"}
                          </span>
                        </div>
                        {academyState.isCompleted && (
                          <div className="mt-1 text-xs text-slate-500">Compliance training module completed and quiz passed.</div>
                        )}
                      </div>

                    </div>
                  </div>

                  {/* Waiting State */}
                  {adminClearance.status === "pending" && (
                    <div className="p-6 rounded-xl bg-blue-50 border border-blue-100 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center mx-auto">
                        <RefreshCcw className="w-5 h-5 text-blue-500 animate-spin" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-700">Waiting for Admin Approval</div>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-sm mx-auto">
                          Your application has been submitted. The admin team will review your details and get back to you shortly.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Approved */}
                  {adminClearance.status === "approved" && (
                    <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-100 text-center space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                      <div className="text-sm font-bold text-emerald-700">Application Approved!</div>
                      <p className="text-xs text-slate-500">You are now an active employee. Welcome to the team!</p>
                    </div>
                  )}

                  {/* Rejected */}
                  {adminClearance.status === "rejected" && (
                    <div className="space-y-3">
                      <div className="p-5 rounded-xl bg-red-50 border border-red-100 text-center space-y-2">
                        <XCircle className="w-8 h-8 text-red-500 mx-auto" />
                        <div className="text-sm font-bold text-red-700">Application Rejected</div>
                        <p className="text-xs text-slate-500">Please review the reason below and re-apply with corrected information.</p>
                      </div>
                      {adminClearance.remarks && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-xs text-slate-600 leading-relaxed">
                          <span className="font-semibold text-red-600">Reason: </span>{adminClearance.remarks}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.removeItem("caltrack_activation_dossier")
                          apiDeleteRegistrationDossier()
                          setRegForm(p => ({ ...p, isCompleted: false, otpStatus: "unverified", isBiometricCompleted: false, fullName: "", email: "", phone: "", address: "", profilePic: null }))
                          setDocForm(p => ({ ...p, isCompleted: false, confidenceScore: 0, aadhaarFile: null, panFile: null, drivingLicenseFile: null, aadhaarId: "", panId: "", drivingLicenseId: "" }))
                          setAcademyState(p => ({ ...p, isCompleted: false, modules: p.modules.map(m => ({ ...m, completed: false, progress: 0 })) }))
                          setInterviewState(p => ({ ...p, isCompleted: true, status: "Passed" }))
                          setAdminClearance({ status: "pending", remarks: "" })
                          setOtpCode("")
                          setActiveStep(1)
                        }}
                        className="w-full py-3 bg-white hover:bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-600 rounded-xl transition-colors"
                      >
                        Re-apply with Corrected Information
                      </button>
                    </div>
                  )}

                </div>
                {renderStepNavigation()}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>

      {/* =====================================================================
          ADMIN REJECTION MODAL
          ===================================================================== */}
      <AnimatePresence>
        {showRejectionDialog && (
          <motion.div
            className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-[#030612]/90 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="hud-card max-w-md w-full rounded-2xl p-6 border border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.15)] relative overflow-hidden"
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
            >
              <h3 className="font-orbitron font-black text-sm tracking-widest text-white uppercase flex items-center gap-2 text-red-400">
                <ShieldAlert className="w-5 h-5 text-red-450" /> REJECT APPLICATION
              </h3>

              <div className="mt-4 space-y-4 text-xs">
                <p className="text-slate-400 font-semibold leading-relaxed">
                  Please log the compliance anomaly remark below. This will halt the onboarding sequence and flag the technician dossier for re-submission.
                </p>

                <div className="space-y-2">
                  <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest font-orbitron">Anomaly Reason</label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-semibold text-white focus:border-red-500 focus:outline-none"
                    onChange={e => setRejectionRemarks(e.target.value)}
                    value={rejectionRemarks}
                  >
                    <option value="">-- Choose Audit Failure Reason --</option>
                    <option value="Aadhaar Card mismatch with registration name.">Aadhaar Card mismatch with registration name.</option>
                    <option value="Biometric face vector variance exceeds 10% threshold.">Biometric face vector variance exceeds 10% threshold.</option>
                    <option value="WebRTC compliance interview speech verification failed.">WebRTC compliance interview speech verification failed.</option>
                    <option value="Driving License mismatch with government transport records.">Driving License mismatch with government transport records.</option>
                    <option value="Document OCR extraction checksum error. Scan resolution low.">Document OCR extraction checksum error. Scan resolution low.</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest font-orbitron">Custom Remarks (Optional)</label>
                  <textarea
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/85 border border-slate-800 text-xs font-semibold text-white focus:border-red-500 focus:outline-none resize-none"
                    placeholder="Enter additional audit notes..."
                    value={rejectionRemarks}
                    onChange={e => setRejectionRemarks(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRejectionDialog(false)}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] font-black uppercase tracking-wider rounded-xl text-slate-400 transition-colors font-orbitron"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => confirmAdminReject(rejectionRemarks)}
                  className="flex-grow py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-[10px] font-black uppercase tracking-wider rounded-xl text-white font-orbitron"
                >
                  Confirm Rejection
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          CELEBRATION PASS SUCCESS MODAL
          ===================================================================== */}
      <AnimatePresence>

        {showCelebration && (
          <motion.div
            className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-[#030612]/95 backdrop-blur-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="hud-card max-w-lg w-full rounded-3xl p-8 border border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.15)] relative overflow-hidden"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-emerald-500/5 rounded-full filter blur-3xl pointer-events-none" />
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <CheckCircle2 className="w-10 h-10 animate-bounce" />
              </div>

              <div className="text-center mt-6 space-y-4">
                <h3 className="font-orbitron font-black text-lg tracking-widest text-white">WORKFORCE ACTIVATION COMPLETE</h3>
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">STATUS: SYSTEM ACTIVE</p>

                <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                  Technician {regForm.fullName} has completed all biometric scans, document OCR validation checks, training classes, L1 audits, and administrative reviews.
                </p>

                {/* Digital Active Employee Pass Card */}
                <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-[#0b1021] to-[#121935] border border-blue-500/20 text-left relative overflow-hidden shadow-2xl">
                  {/* Ticking live scan line overlay */}
                  <div className="laser-bar" style={{ opacity: 0.3, animationDuration: "4s" }} />
                  <div className="absolute top-3 right-4 text-[8px] font-black font-orbitron text-blue-400 tracking-[0.2em] uppercase">CALTRACK ACTIVE PASS</div>

                  <div className="flex gap-4 items-center">
                    <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                      {regForm.profilePic ? (
                        <img src={regForm.profilePic} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <UserCheck className="w-8 h-8 text-emerald-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-black text-white uppercase tracking-wider">{regForm.fullName}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Field Operations Tech (L2)</div>
                      <div className="text-[8.5px] text-emerald-400 font-orbitron font-bold mt-1 tracking-widest">CAL-88921-2026</div>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-850 flex items-center justify-between text-[8px] font-black text-slate-500 uppercase tracking-widest">
                    <span>SECURITY STATUS: ACTIVE</span>
                    <span>EXPIRY: 06/2027</span>
                  </div>
                </div>

                <div className="pt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem("caltrack_activation_dossier")
                      apiDeleteRegistrationDossier()
                      setShowCelebration(false)
                      setActiveStep(1)
                      setRegForm(p => ({ ...p, isCompleted: false, otpStatus: "unverified", isBiometricCompleted: false, fullName: "", email: "", phone: "", address: "", profilePic: null }))
                      setDocForm(p => ({ ...p, isCompleted: false, confidenceScore: 0, aadhaarFile: null, panFile: null, drivingLicenseFile: null, aadhaarId: "", panId: "", drivingLicenseId: "" }))
                      setAcademyState(p => ({ ...p, isCompleted: false, modules: p.modules.map(m => ({ ...m, completed: false, progress: 0 })) }))
                      setInterviewState(p => ({ ...p, isCompleted: false, status: "Scheduled" }))
                      setAdminClearance(p => ({ ...p, status: "pending" }))
                      setOtpCode("")

                    }}
                    className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] font-black uppercase tracking-wider rounded-xl text-slate-300 transition-colors"
                  >
                    Reset Simulator
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCelebration(false)
                      navigate("/")
                    }}
                    className="flex-grow py-3.5 glow-btn-blue text-[10px] font-black uppercase tracking-wider rounded-xl text-white font-orbitron"
                  >
                    Enter Workspace
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

